import { and, desc, eq, gte, isNull, lt } from "drizzle-orm";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { db } from "../../db";
import { attendances, leaves } from "../../db/schema";
import { BadRequestError, ForbiddenError, NotFoundError } from "../../errors/errors";
import { getLeavePhotoUrl } from "../../helpers/photo";
import { validate } from "../../helpers/validate";
import { createLeaveSchema, leaveHistoryQuerySchema, leaveIdParamSchema } from "./validation";
import type { LeaveHistoryQuery } from "./validation";
import type { CreateLeaveRequest } from "./model/request";
import type { LeaveDetailData, LeaveResponseData, UpdateLeaveStatusData } from "./model/response";

let lastLeaveImageTimestamp = 0;

export async function insertLeaveRecord(values: {
  userId: string;
  startDate: string;
  endDate: string;
  reason: string;
  category: "Sakit" | "Izin";
  imageFilename: string | null;
}): Promise<LeaveResponseData> {
  const [row] = await db.insert(leaves).values({
    user_id: values.userId,
    start_date: values.startDate,
    end_date: values.endDate,
    reason: values.reason,
    category: values.category,
    image: values.imageFilename,
  }).returning({
    id: leaves.id,
    startDate: leaves.start_date,
    endDate: leaves.end_date,
    reason: leaves.reason,
    category: leaves.category,
    status: leaves.status,
    image: leaves.image,
    createdAt: leaves.created_at,
  });
  if (!row) throw new Error("Leave insert returned no row");
  return {
    id: row.id,
    startDate: row.startDate,
    endDate: row.endDate,
    reason: row.reason,
    category: row.category,
    status: row.status,
    image: row.image,
    created_at: row.createdAt.toISOString(),
  };
}

async function storeLeaveImage(file: File): Promise<{ filename: string; filepath: string }> {
  const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
  const directory = join(process.cwd(), "uploads", "leave");
  await mkdir(directory, { recursive: true });
  const bytes = new Uint8Array(await file.arrayBuffer());
  let timestamp = Math.max(Date.now(), lastLeaveImageTimestamp + 1);
  while (true) {
    const filename = `${timestamp}${extension}`;
    const filepath = join(directory, filename);
    try {
      await writeFile(filepath, bytes, { flag: "wx" });
      lastLeaveImageTimestamp = timestamp;
      return { filename, filepath };
    } catch (error) {
      if (typeof error !== "object" || error === null || !("code" in error) || error.code !== "EEXIST") throw error;
      timestamp += 1;
    }
  }
}

export async function createLeave(userId: string, request: CreateLeaveRequest): Promise<LeaveResponseData> {
  const input = validate(createLeaveSchema, request);
  const imageFile = input.image instanceof File ? input.image : undefined;
  const storedImage = imageFile ? await storeLeaveImage(imageFile) : null;
  try {
    return await insertLeaveRecord({
      userId,
      startDate: input.startDate,
      endDate: input.endDate,
      reason: input.reason,
      category: input.category,
      imageFilename: storedImage?.filename ?? null,
    });
  } catch (error) {
    if (storedImage) await unlink(storedImage.filepath).catch(() => undefined);
    throw error;
  }
}

function getCurrentJakartaMonth(now: Date): { startDate: string; endDate: string } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit",
  }).formatToParts(now);
  const year = parts.find((part) => part.type === "year")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  const endDate = new Date(Date.UTC(Number(year), Number(month), 1)).toISOString().slice(0, 10);
  return { startDate: `${year}-${month}-01`, endDate };
}

export async function getLeaveHistory(userId: string, query: LeaveHistoryQuery): Promise<LeaveResponseData[]> {
  const input = validate(leaveHistoryQuerySchema, query);
  const conditions = [eq(leaves.user_id, userId), isNull(leaves.deleted_at)];
  if (input.status) conditions.push(eq(leaves.status, input.status));

  const month = input.date ? {
    startDate: `${input.date}-01`,
    endDate: (() => {
      const [year, monthNumber] = input.date!.split("-").map(Number);
      return new Date(Date.UTC(year!, monthNumber!, 1)).toISOString().slice(0, 10);
    })(),
  } : getCurrentJakartaMonth(new Date());
  conditions.push(gte(leaves.start_date, month.startDate), lt(leaves.start_date, month.endDate));

  const rows = await db.select().from(leaves)
    .where(and(...conditions))
    .orderBy(desc(leaves.created_at));
  return rows.map((row) => ({
    id: row.id,
    startDate: row.start_date,
    endDate: row.end_date,
    reason: row.reason,
    category: row.category,
    status: row.status,
    image: getLeavePhotoUrl(row.image),
    created_at: row.created_at.toISOString(),
  }));
}

export async function getLeaveDetail(
  currentUser: { id: string; role: "admin" | "employee" },
  leaveId: number,
): Promise<LeaveDetailData> {
  const input = validate(leaveIdParamSchema, { id: leaveId });
  const [leave] = await db.select().from(leaves)
    .where(and(eq(leaves.id, input.id), isNull(leaves.deleted_at)))
    .limit(1);

  if (!leave) throw new NotFoundError("Leave data not found");
  if (currentUser.role !== "admin" && leave.user_id !== currentUser.id) {
    throw new ForbiddenError("Forbidden");
  }

  return {
    id: leave.id,
    start_date: leave.start_date,
    end_date: leave.end_date,
    reason: leave.reason,
    category: leave.category,
    status: leave.status,
    image: getLeavePhotoUrl(leave.image),
    created_at: leave.created_at.toISOString(),
    updated_at: leave.updated_at.toISOString(),
  };
}

function getDateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const current = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  while (current <= end) {
    dates.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

async function getPendingLeave(leaveId: number) {
  const input = validate(leaveIdParamSchema, { id: leaveId });
  const [leave] = await db.select().from(leaves)
    .where(and(eq(leaves.id, input.id), isNull(leaves.deleted_at)))
    .limit(1);
  if (!leave) throw new NotFoundError("Leave not found");
  if (leave.status !== "Pending") throw new BadRequestError("Leave already processed");
  return leave;
}

export async function rejectLeave(
  currentUser: { id: string; role: "admin" | "employee" },
  leaveId: number,
): Promise<UpdateLeaveStatusData & { status: "Rejected" }> {
  if (currentUser.role !== "admin") throw new ForbiddenError("Forbidden");
  const leave = await getPendingLeave(leaveId);
  const [updated] = await db.update(leaves)
    .set({ status: "Rejected", updated_at: new Date() })
    .where(and(eq(leaves.id, leave.id), eq(leaves.status, "Pending"), isNull(leaves.deleted_at)))
    .returning({ id: leaves.id, startDate: leaves.start_date, endDate: leaves.end_date, category: leaves.category, status: leaves.status });
  if (!updated) throw new BadRequestError("Leave already processed");
  return { ...updated, status: "Rejected" };
}

export async function approveLeave(
  currentUser: { id: string; role: "admin" | "employee" },
  leaveId: number,
): Promise<UpdateLeaveStatusData & { status: "Approved" }> {
  if (currentUser.role !== "admin") throw new ForbiddenError("Forbidden");
  const leave = await getPendingLeave(leaveId);
  return db.transaction(async (tx) => {
    const [updated] = await tx.update(leaves)
      .set({ status: "Approved", updated_at: new Date() })
      .where(and(eq(leaves.id, leave.id), eq(leaves.status, "Pending"), isNull(leaves.deleted_at)))
      .returning({ id: leaves.id, startDate: leaves.start_date, endDate: leaves.end_date, category: leaves.category, status: leaves.status });
    if (!updated) throw new BadRequestError("Leave already processed");
    await tx.insert(attendances).values(getDateRange(leave.start_date, leave.end_date).map((date) => ({
      user_id: leave.user_id,
      date,
      check_in_time: new Date(`${date}T00:00:00Z`),
      check_in_photo: "leave.webp",
      status: leave.category,
    })));
    return { ...updated, status: "Approved" };
  });
}
