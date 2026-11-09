import { z } from "zod";
import { getCurrentJakartaYear, isValidCalendarDate } from "../../helpers/date";
import type { AttendanceHistoryQueryInput } from "./model/request";
import type { CheckInRequest } from "./model/request";

export function isValidAttendanceCalendarDate(value: string): boolean {
  return isValidCalendarDate(value);
}

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

const optionalInteger = (field: string, minimum: number, maximum?: number) => z.preprocess(
  (value) => value === "" ? undefined : value,
  z.coerce.number({ error: `${field} must be a number` })
    .int(`${field} must be an integer`)
    .min(minimum, maximum !== undefined ? `${field} must be between ${minimum} and ${maximum}` : `${field} must be at least ${minimum}`)
    .refine((val) => maximum === undefined || val <= maximum, {
      message: `${field} must be between ${minimum} and ${maximum}`,
    })
    .optional(),
);

export const attendanceHistoryQuerySchema = z.object({
  month: optionalInteger("Month", 1, 12),
  year: z.preprocess(
    (value) => value === "" ? undefined : value,
    z.coerce.number({ error: "Year must be a number" })
      .int("Year must be an integer")
      .min(2000, "Year must be between 2000 and dynamic year")
      .refine((val) => val <= getCurrentJakartaYear() + 10, {
        message: "Year is out of range",
      })
      .optional(),
  ),
  limit: optionalInteger("Limit", 1, 31),
  desc: z.preprocess((value) => {
    if (value === "true") return true;
    if (value === "false") return false;
    return value;
  }, z.boolean().optional()),
}) satisfies z.ZodType<AttendanceHistoryQueryInput>;

export type AttendanceHistoryQuery = z.infer<typeof attendanceHistoryQuerySchema>;

export const validAttendanceStatuses = ["Hadir", "Terlambat", "Tidak Hadir", "Sakit", "Izin", "Dinas", "Ditolak"] as const;
export type ValidAttendanceStatus = (typeof validAttendanceStatuses)[number];

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
  search: z.string().trim().max(100, "Search must not exceed 100 characters").optional(),
  status: z.enum(validAttendanceStatuses, {
    error: "Status must be one of: Hadir, Terlambat, Tidak Hadir, Sakit, Izin, Dinas, Ditolak",
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

export const attendanceIdParamSchema = z.object({
  id: z.coerce.number({ error: "Attendance ID must be a number" })
    .int("Attendance ID must be an integer")
    .positive("Attendance ID must be a positive integer"),
});

export type AttendanceIdParam = z.infer<typeof attendanceIdParamSchema>;
