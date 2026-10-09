import { and, eq, isNull } from "drizzle-orm";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { db } from "../../db";
import { attendances } from "../../db/schema";
import { ConflictError } from "../../errors/errors";
import { validate } from "../../helpers/validate";
import type { CheckInRequest } from "./model/request";
import type { CheckInAttendanceData, CheckOutAttendanceData } from "./model/response";
import { checkInSchema } from "./validation";

const attendanceTimeZone = "Asia/Jakarta";
let lastPhotoTimestamp = 0;

export function getCurrentDate(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: attendanceTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function getCurrentTimestamp(now: Date): Date {
  return now;
}

export function determineAttendanceStatus(now: Date): "Hadir" | "Terlambat" {
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: attendanceTimeZone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(now);
  return time > "08:00:00" ? "Terlambat" : "Hadir";
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
  return attendance;
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

  const extension = checkInPhoto.name.slice(checkInPhoto.name.lastIndexOf(".")).toLowerCase();
  const directory = join(process.cwd(), "uploads", "checkin");
  await mkdir(directory, { recursive: true });
  let timestamp = Math.max(Date.now(), lastPhotoTimestamp + 1);
  let filename = `${timestamp}${extension}`;
  let filepath = join(directory, filename);
  const image = new Uint8Array(await checkInPhoto.arrayBuffer());
  while (true) {
    try {
      await writeFile(filepath, image, { flag: "wx" });
      lastPhotoTimestamp = timestamp;
      break;
    } catch (error) {
      if (typeof error !== "object" || error === null || !("code" in error) || error.code !== "EEXIST") {
        throw error;
      }
      timestamp += 1;
      filename = `${timestamp}${extension}`;
      filepath = join(directory, filename);
    }
  }

  try {
    return await insertAttendance({
      userId,
      date,
      checkInTime: getCurrentTimestamp(now),
      status: determineAttendanceStatus(now),
      checkInPhoto: filename,
    });
  } catch (error) {
    await unlink(filepath).catch(() => undefined);
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

  return updatedAttendance;
}
