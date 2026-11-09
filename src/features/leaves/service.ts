import { and, count, desc, eq, gte, ilike, isNull, lte, lt } from "drizzle-orm";
import { unlink } from "node:fs/promises";
import { db } from "../../db";
import { attendances, leaves, users } from "../../db/schema";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from "../../errors/errors";
import { getLeavePhotoUrl } from "../../helpers/photo";
import { validate } from "../../helpers/validate";
import { storeUploadedImage } from "../../helpers/upload";
import { getInclusiveDateRange } from "../../helpers/date";
import { requireActiveAdmin } from "../../helpers/role";
import { escapeIlikePattern } from "../../helpers/sql";
import { createLeaveSchema, leaveHistoryQuerySchema, leaveIdParamSchema, listLeavesQuerySchema } from "./validation";
import type { LeaveHistoryQuery } from "./validation";
import type { CreateLeaveRequest, ListLeavesQueryInput } from "./model/request";
import type { LeaveDetailData, LeaveListItem, LeaveListPagination, LeaveResponseData, UpdateLeaveStatusData } from "./model/response";

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

export async function createLeave(userId: string, request: CreateLeaveRequest): Promise<LeaveResponseData> {
  const input = validate(createLeaveSchema, request);

  // Prevent overlapping leave requests (BUG-04)
  const [overlapping] = await db.select({ id: leaves.id })
    .from(leaves)
    .where(and(
      eq(leaves.user_id, userId),
      isNull(leaves.deleted_at),
      lte(leaves.start_date, input.endDate),
      gte(leaves.end_date, input.startDate),
      eq(leaves.status, "Pending"),
    ))
    .limit(1);

  if (overlapping) {
    throw new ConflictError("Leave request overlaps with an existing pending leave");
  }

  const [approvedOverlapping] = await db.select({ id: leaves.id })
    .from(leaves)
    .where(and(
      eq(leaves.user_id, userId),
      isNull(leaves.deleted_at),
      lte(leaves.start_date, input.endDate),
      gte(leaves.end_date, input.startDate),
      eq(leaves.status, "Approved"),
    ))
    .limit(1);

  if (approvedOverlapping) {
    throw new ConflictError("Leave request overlaps with an approved leave");
  }

  const imageFile = input.image instanceof File ? input.image : undefined;
  const storedImage = imageFile ? await storeUploadedImage("leave", imageFile) : null;
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

export async function getLeaveHistory(userId: string, query: LeaveHistoryQuery): Promise<LeaveResponseData[]> {
  const input = validate(leaveHistoryQuerySchema, query);
  const conditions = [eq(leaves.user_id, userId), isNull(leaves.deleted_at)];
  if (input.status) conditions.push(eq(leaves.status, input.status));

  if (input.date) {
    const [year, monthNumber] = input.date.split("-").map(Number);
    const startDate = `${input.date}-01`;
    const endDate = new Date(Date.UTC(year!, monthNumber!, 1)).toISOString().slice(0, 10);
    conditions.push(gte(leaves.start_date, startDate), lt(leaves.start_date, endDate));
  }

  const rows = await db.select().from(leaves)
    .where(and(...conditions))
    .orderBy(desc(leaves.created_at), desc(leaves.id))
    .limit(10);
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

export async function listLeaves(
  currentUser: { id: string; role: "admin" | "employee" },
  queryInput: ListLeavesQueryInput,
): Promise<{ data: LeaveListItem[]; pagination: LeaveListPagination }> {
  await requireActiveAdmin(currentUser);
  const query = validate(listLeavesQuerySchema, queryInput);
  const conditions = [isNull(leaves.deleted_at)];
  if (query.start_date && query.end_date) {
    conditions.push(
      lte(leaves.start_date, query.end_date),
      gte(leaves.end_date, query.start_date),
    );
  }
  if (query.search) conditions.push(ilike(users.name, `%${escapeIlikePattern(query.search)}%`));
  if (query.category) conditions.push(eq(leaves.category, query.category));
  const whereClause = and(...conditions);
  const [countRow] = await db.select({ total: count() })
    .from(leaves)
    .innerJoin(users, eq(leaves.user_id, users.id))
    .where(whereClause);
  const total = Number(countRow?.total ?? 0);
  const rows = await db.select({
    id: leaves.id,
    userId: leaves.user_id,
    name: users.name,
    startDate: leaves.start_date,
    endDate: leaves.end_date,
    category: leaves.category,
    status: leaves.status,
  })
    .from(leaves)
    .innerJoin(users, eq(leaves.user_id, users.id))
    .where(whereClause)
    .orderBy(desc(leaves.created_at), desc(leaves.id))
    .limit(query.limit)
    .offset((query.page - 1) * query.limit);
  return {
    data: rows,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      total_pages: total === 0 ? 0 : Math.ceil(total / query.limit),
    },
  };
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
  const leaveDates = getInclusiveDateRange(leave.start_date, leave.end_date);

  return db.transaction(async (tx) => {
    // Check if attendance already exists for any of the leave dates
    const existingAttendances = await tx.select({ id: attendances.id, date: attendances.date })
      .from(attendances)
      .where(and(
        eq(attendances.user_id, leave.user_id),
        gte(attendances.date, leave.start_date),
        lte(attendances.date, leave.end_date),
      ));

    const existingDateSet = new Set(existingAttendances.map((a) => a.date));
    const conflictDate = leaveDates.find((d) => existingDateSet.has(d));
    if (conflictDate) {
      throw new ConflictError(`Attendance already exists for date ${conflictDate}`);
    }

    const [updated] = await tx.update(leaves)
      .set({ status: "Approved", updated_at: new Date() })
      .where(and(eq(leaves.id, leave.id), eq(leaves.status, "Pending"), isNull(leaves.deleted_at)))
      .returning({ id: leaves.id, startDate: leaves.start_date, endDate: leaves.end_date, category: leaves.category, status: leaves.status });
    if (!updated) throw new BadRequestError("Leave already processed");

    await tx.insert(attendances).values(leaveDates.map((date) => ({
      user_id: leave.user_id,
      date,
      check_in_time: new Date(`${date}T00:00:00+07:00`),
      check_in_photo: "leave.webp",
      status: leave.category,
    })));
    return { ...updated, status: "Approved" };
  });
}
