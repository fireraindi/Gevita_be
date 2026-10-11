import { z } from "zod";
import type { CreateLeaveRequest } from "./model/request";

const allowedExtensions = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export function isValidCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day!));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month! - 1 && date.getUTCDate() === day;
}

const dateSchema = z.string().refine(isValidCalendarDate, "Date must be a valid date in YYYY-MM-DD format");
const optionalImageSchema = z.union([
  z.instanceof(File)
    .refine((file) => file.size <= 1024 * 1024, "Image must not exceed 1 MB")
    .refine((file) => allowedExtensions.has(file.name.slice(file.name.lastIndexOf(".")).toLowerCase()), "Image must be a jpg, jpeg, png, or webp file")
    .refine((file) => allowedTypes.has(file.type), "Image must be a jpg, jpeg, png, or webp file"),
  z.null(),
  z.literal(""),
]).optional();

export const createLeaveSchema = z.object({
  startDate: dateSchema,
  endDate: dateSchema,
  reason: z.string().trim().min(4, "Reason must be at least 4 characters"),
  category: z.enum(["Sakit", "Izin"], { error: "Category must be either Sakit or Izin" }),
  image: optionalImageSchema,
}).refine((data) => data.endDate >= data.startDate, {
  message: "End date must be greater than or equal to start date",
  path: ["endDate"],
}) satisfies z.ZodType<CreateLeaveRequest>;
