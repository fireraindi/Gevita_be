import { and, asc, count, desc, eq, gte, ilike, isNull, lt, lte, ne } from "drizzle-orm";
import { unlink } from "node:fs/promises";
import { db } from "../../db";
import { attendances, leaves, users } from "../../db/schema";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from "../../errors/errors";
import { validate } from "../../helpers/validate";
import { getCheckInPhotoUrl } from "../../helpers/photo";
import { storeUploadedImage } from "../../helpers/upload";
import { requireActiveAdmin } from "../../helpers/role";
import { escapeIlikePattern } from "../../helpers/sql";
import {
  formatJakartaTime,
  getCurrentJakartaDate,
  getCurrentMonthRange,
  getDefaultInclusiveMonthRange,
} from "../../helpers/date";
import type { AttendanceHistoryQueryInput, CheckInRequest, ListAttendancesQueryInput } from "./model/request";
import type { AttendanceHistoryItem, AttendanceListItem, AttendanceStatsData, CheckInAttendanceData, CheckOutAttendanceData, PaginationData, RejectAttendanceData, TodayAttendanceData } from "./model/response";
import { attendanceHistoryQuerySchema, attendanceIdParamSchema, checkInSchema, listAttendancesQuerySchema } from "./validation";

export function getCurrentDate(now: Date = new Date()): string {
  return getCurrentJakartaDate(now);
}

export { getCurrentMonthRange, getDefaultInclusiveMonthRange };

export async function countUserAttendancesInMonth(userId: string, startDate: string, endDate: string): Promise<number> {
  const [row] = await db.select({ total: count() })
    .from(attendances)
    .where(and(
      eq(attendances.user_id, userId),
      gte(attendances.date, startDate),
      lt(attendances.date, endDate),
    ));
  return Number(row?.total ?? 0);
}

export async function countUserLeavesByCategoryInMonth(
  userId: string,
  category: "Sakit" | "Izin",
  startDate: string,
  endDate: string,
): Promise<number> {
  const [row] = await db.select({ total: count() })
    .from(leaves)
    .where(and(
      eq(leaves.user_id, userId),
      eq(leaves.category, category),
      eq(leaves.status, "Approved"),
      gte(leaves.start_date, startDate),
      lt(leaves.start_date, endDate),
      isNull(leaves.deleted_at),
    ));
  return Number(row?.total ?? 0);
}

export async function getAttendanceStats(userId: string): Promise<AttendanceStatsData> {
  const { startDate, endDate } = getCurrentMonthRange(new Date());
  const [totalAttendance, sickLeave, personalLeave] = await Promise.all([
    countUserAttendancesInMonth(userId, startDate, endDate),
    countUserLeavesByCategoryInMonth(userId, "Sakit", startDate, endDate),
    countUserLeavesByCategoryInMonth(userId, "Izin", startDate, endDate),
  ]);
  return { totalAttendance, sickLeave, personalLeave };
}

export function determineAttendanceStatus(now: Date): "Hadir" | "Terlambat" {
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(now);
  return time > "08:00:00" ? "Terlambat" : "Hadir";
}

export function formatTimeOnly(date: Date | null): string | null {
  return formatJakartaTime(date);
}

export async function listAttendances(
  currentUser: { id: string; role: "admin" | "employee" },
  queryInput: ListAttendancesQueryInput,
): Promise<{ data: AttendanceListItem[]; pagination: PaginationData }> {
  await requireActiveAdmin(currentUser);

  const query = validate(listAttendancesQuerySchema, queryInput);
  const defaultRange = getDefaultInclusiveMonthRange();
  const startDate = query.start_date ?? defaultRange.startDate;
  const endDate = query.end_date ?? defaultRange.endDate;
  const conditions = [
    isNull(attendances.deleted_at),
    gte(attendances.date, startDate),
    lte(attendances.date, endDate),
  ];
  if (query.search) conditions.push(ilike(users.name, `%${escapeIlikePattern(query.search)}%`));
  if (query.status) conditions.push(eq(attendances.status, query.status));
  const whereClause = and(...conditions);
  const [countRow] = await db.select({ total: count() })
    .from(attendances)
    .innerJoin(users, eq(attendances.user_id, users.id))
    .where(whereClause);
  const total = Number(countRow?.total ?? 0);
  const page = query.page;
  const limit = query.limit;
  const rows = await db.select({
    id: attendances.id,
    userId: attendances.user_id,
    name: users.name,
    date: attendances.date,
    checkInTime: attendances.check_in_time,
    checkOutTime: attendances.check_out_time,
    checkInPhoto: attendances.check_in_photo,
    status: attendances.status,
  })
    .from(attendances)
    .innerJoin(users, eq(attendances.user_id, users.id))
    .where(whereClause)
    .orderBy(desc(attendances.date), desc(attendances.id))
    .limit(limit)
    .offset((page - 1) * limit);

  return {
    data: rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      name: row.name,
      date: row.date,
      checkInTime: formatTimeOnly(row.checkInTime) ?? "00:00:00",
      checkOutTime: formatTimeOnly(row.checkOutTime),
      checkInPhoto: getCheckInPhotoUrl(row.checkInPhoto) ?? row.checkInPhoto,
      status: row.status,
    })),
    pagination: { page, limit, total, total_pages: total === 0 ? 0 : Math.ceil(total / limit) },
  };
}

export async function rejectAttendance(
  currentUser: { id: string; role: "admin" | "employee" },
  attendanceIdInput: string,
): Promise<RejectAttendanceData> {
  await requireActiveAdmin(currentUser);
  const { id: attendanceId } = validate(attendanceIdParamSchema, { id: attendanceIdInput });
  const [attendance] = await db.select({
    id: attendances.id,
    userId: attendances.user_id,
    name: users.name,
    date: attendances.date,
    checkInTime: attendances.check_in_time,
    checkOutTime: attendances.check_out_time,
    status: attendances.status,
  })
    .from(attendances)
    .innerJoin(users, eq(attendances.user_id, users.id))
    .where(and(eq(attendances.id, attendanceId), isNull(attendances.deleted_at)))
    .limit(1);
  if (!attendance) throw new NotFoundError("Attendance not found");
  if (attendance.status === "Ditolak") throw new BadRequestError("Attendance already rejected");

  const [updated] = await db.update(attendances)
    .set({ status: "Ditolak", updated_at: new Date() })
    .where(and(
      eq(attendances.id, attendanceId),
      isNull(attendances.deleted_at),
      ne(attendances.status, "Ditolak"),
    ))
    .returning({ id: attendances.id });
  if (!updated) {
    const [current] = await db.select({ status: attendances.status })
      .from(attendances)
      .where(and(eq(attendances.id, attendanceId), isNull(attendances.deleted_at)))
      .limit(1);
    if (!current) throw new NotFoundError("Attendance not found");
    throw new BadRequestError("Attendance already rejected");
  }

  return {
    id: attendance.id,
    userId: attendance.userId,
    name: attendance.name,
    date: attendance.date,
    checkInTime: formatTimeOnly(attendance.checkInTime) ?? "00:00:00",
    checkOutTime: formatTimeOnly(attendance.checkOutTime),
    status: "Ditolak",
  };
}

export async function findAttendanceByUserIdAndDate(userId: string, date: string) {
  const [attendance] = await db.select({ id: attendances.id })
    .from(attendances)
    .where(and(eq(attendances.user_id, userId), eq(attendances.date, date)))
    .limit(1);
  return attendance;
}

export async function insertAttendance(values: {
  userId: string;
  date: string;
  checkInTime: Date;
  status: "Hadir" | "Terlambat";
  checkInPhoto: string;
}): Promise<CheckInAttendanceData> {
  const [attendance] = await db.insert(attendances).values({
    user_id: values.userId,
    date: values.date,
    check_in_time: values.checkInTime,
    check_in_photo: values.checkInPhoto,
    status: values.status,
  }).returning({
    id: attendances.id,
    userId: attendances.user_id,
    date: attendances.date,
    checkInTime: attendances.check_in_time,
    status: attendances.status,
    checkInPhoto: attendances.check_in_photo,
  });
  if (!attendance) throw new Error("Attendance insert returned no row");
  return { ...attendance, status: values.status };
}

function isAttendanceUniqueViolation(error: unknown, seen = new Set<unknown>()): boolean {
  if (typeof error !== "object" || error === null || seen.has(error)) return false;
  seen.add(error);
  if ("code" in error && error.code === "23505") {
    const constraint = "constraint_name" in error ? error.constraint_name :
      "constraint" in error ? error.constraint : undefined;
    return typeof constraint === "string" && constraint.includes("attendances_user_id_date");
  }
  return "cause" in error && isAttendanceUniqueViolation(error.cause, seen);
}

export async function checkIn(userId: string, request: CheckInRequest): Promise<CheckInAttendanceData> {
  const { checkInPhoto } = validate(checkInSchema, request);
  const now = new Date();
  const date = getCurrentDate(now);
  if (await findAttendanceByUserIdAndDate(userId, date)) {
    throw new ConflictError("Already checked in today");
  }

  const storedPhoto = await storeUploadedImage("checkin", checkInPhoto);

  try {
    return await insertAttendance({
      userId,
      date,
      checkInTime: now,
      status: determineAttendanceStatus(now),
      checkInPhoto: storedPhoto.filename,
    });
  } catch (error) {
    await unlink(storedPhoto.filepath).catch(() => undefined);
    if (isAttendanceUniqueViolation(error)) {
      throw new ConflictError("Already checked in today");
    }
    throw error;
  }
}

export async function checkOut(userId: string): Promise<CheckOutAttendanceData> {
  const now = new Date();
  const date = getCurrentDate(now);
  const attendance = await findAttendanceByUserIdAndDate(userId, date);

  if (!attendance) {
    throw new ConflictError("Check in is required");
  }

  const [updatedAttendance] = await db.update(attendances)
    .set({ check_out_time: now })
    .where(and(
      eq(attendances.id, attendance.id),
      eq(attendances.user_id, userId),
      eq(attendances.date, date),
      isNull(attendances.check_out_time),
    ))
    .returning({
      id: attendances.id,
      userId: attendances.user_id,
      date: attendances.date,
      checkOutTime: attendances.check_out_time,
    });

  if (!updatedAttendance) {
    throw new ConflictError("Already checked out today");
  }
  if (!updatedAttendance.checkOutTime) {
    throw new Error("Attendance update returned no check-out time");
  }

  return { ...updatedAttendance, checkOutTime: updatedAttendance.checkOutTime };
}

export async function getTodayAttendance(userId: string): Promise<TodayAttendanceData | null> {
  const today = getCurrentDate(new Date());
  const [attendance] = await db.select({
    id: attendances.id,
    check_in_time: attendances.check_in_time,
    check_in_photo: attendances.check_in_photo,
    check_out_time: attendances.check_out_time,
    status: attendances.status,
  })
    .from(attendances)
    .where(and(eq(attendances.user_id, userId), eq(attendances.date, today)))
    .limit(1);

  if (!attendance) return null;

  const checkInPhoto = getCheckInPhotoUrl(attendance.check_in_photo);
  if (!checkInPhoto) throw new Error("Attendance check-in photo is missing");

  return {
    ...attendance,
    check_in_photo: checkInPhoto,
  };
}

export async function getAttendanceHistory(
  userId: string,
  query: AttendanceHistoryQueryInput,
): Promise<AttendanceHistoryItem[]> {
  const input = validate(attendanceHistoryQuerySchema, query);
  const now = new Date();
  const [currentYear, currentMonth] = getCurrentDate(now).split("-").map(Number);
  const year = input.year ?? currentYear;
  const month = input.month ?? currentMonth;
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);

  const rows = await db.select({
    id: attendances.id,
    date: attendances.date,
    checkInTime: attendances.check_in_time,
    checkOutTime: attendances.check_out_time,
    checkInPhoto: attendances.check_in_photo,
    status: attendances.status,
  })
    .from(attendances)
    .where(and(
      eq(attendances.user_id, userId),
      gte(attendances.date, startDate),
      lt(attendances.date, endDate),
    ))
    .orderBy((input.desc ?? true) ? desc(attendances.date) : asc(attendances.date))
    .limit(input.limit ?? 31);

  return rows.map((row) => {
    const checkInPhoto = getCheckInPhotoUrl(row.checkInPhoto);
    if (!checkInPhoto) throw new Error("Attendance check-in photo is missing");
    return {
      id: row.id,
      date: row.date,
      check_in_time: formatTimeOnly(row.checkInTime)!,
      check_out_time: formatTimeOnly(row.checkOutTime),
      check_in_photo: checkInPhoto,
      status: row.status,
    };
  });
}
