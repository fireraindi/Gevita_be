import { z } from "zod";
import type { AttendanceHistoryQueryInput } from "./model/request";
import type { CheckInRequest } from "./model/request";

const allowedExtensions = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export const checkInSchema = z.object({
  checkInPhoto: z
    .instanceof(File, { message: "Check-in photo is required" })
    .refine((file) => file.size <= 1024 * 1024, {
      message: "Check-in photo must not exceed 1 MB",
    })
    .refine((file) => allowedExtensions.has(file.name.slice(file.name.lastIndexOf(".")).toLowerCase()), {
      message: "Check-in photo must be a jpg, jpeg, png, or webp image",
    })
    .refine((file) => allowedTypes.has(file.type), {
      message: "Check-in photo must be a jpg, jpeg, png, or webp image",
    }),
}) satisfies z.ZodType<CheckInRequest>;

const currentYear = Number(new Intl.DateTimeFormat("en", {
  timeZone: "Asia/Jakarta",
  year: "numeric",
}).format(new Date()));

const optionalInteger = (field: string, minimum: number, maximum: number) => z.preprocess(
  (value) => value === "" ? undefined : value,
  z.coerce.number({ error: `${field} must be a number` })
    .int(`${field} must be an integer`)
    .min(minimum, `${field} must be between ${minimum} and ${maximum}`)
    .max(maximum, `${field} must be between ${minimum} and ${maximum}`)
    .optional(),
);

export const attendanceHistoryQuerySchema = z.object({
  month: optionalInteger("Month", 1, 12),
  year: optionalInteger("Year", 2000, currentYear + 10),
  limit: optionalInteger("Limit", 1, 31),
  desc: z.preprocess((value) => {
    if (value === "true") return true;
    if (value === "false") return false;
    return value;
  }, z.boolean().optional()),
}) satisfies z.ZodType<AttendanceHistoryQueryInput>;

export type AttendanceHistoryQuery = z.infer<typeof attendanceHistoryQuerySchema>;

export const validAttendanceStatuses = ["Hadir", "Terlambat", "Tidak Hadir", "Sakit", "Izin", "Dinas"] as const;
export type ValidAttendanceStatus = (typeof validAttendanceStatuses)[number];

export function isValidAttendanceCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

const attendanceDateSchema = z.string().refine(isValidAttendanceCalendarDate, {
  message: "Date must be a valid date in YYYY-MM-DD format",
});

const paginationNumber = (field: string, minimum: number, maximum?: number, defaultValue = 1) => z.preprocess(
  (value) => value === undefined || value === "" ? defaultValue : value,
  z.coerce.number({ error: `${field} must be a number` })
    .int(`${field} must be an integer`)
    .min(minimum, `${field} must be at least ${minimum}`)
    .refine((value) => maximum === undefined || value <= maximum, {
      message: maximum === undefined ? `${field} is out of range` : `${field} must not exceed ${maximum}`,
    }),
);

export const listAttendancesQuerySchema = z.object({
  status: z.enum(validAttendanceStatuses, {
    error: "Status must be one of: Hadir, Terlambat, Tidak Hadir, Sakit, Izin, Dinas",
  }).optional(),
  start_date: attendanceDateSchema.optional(),
  end_date: attendanceDateSchema.optional(),
  limit: paginationNumber("Limit", 1, 100, 20),
  page: paginationNumber("Page", 1),
}).superRefine((query, context) => {
  if (Boolean(query.start_date) !== Boolean(query.end_date)) {
    context.addIssue({ code: "custom", path: [query.start_date ? "end_date" : "start_date"], message: "Both start_date and end_date must be provided together" });
    return;
  }
  if (!query.start_date || !query.end_date) return;
  if (query.end_date < query.start_date) {
    context.addIssue({ code: "custom", path: ["end_date"], message: "End date must be greater than or equal to start date" });
    return;
  }
  const start = new Date(`${query.start_date}T00:00:00.000Z`).getTime();
  const end = new Date(`${query.end_date}T00:00:00.000Z`).getTime();
  if ((end - start) / 86_400_000 > 60) {
    context.addIssue({ code: "custom", path: ["end_date"], message: "Date range must not exceed 60 days" });
  }
});

export type ListAttendancesQuery = z.infer<typeof listAttendancesQuerySchema>;
