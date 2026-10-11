import { z } from "zod";
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
});

export type AttendanceHistoryQuery = z.infer<typeof attendanceHistoryQuerySchema>;
