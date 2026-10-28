import { z } from "zod";
import type { CreateLeaveRequest, ListLeavesQueryInput } from "./model/request";

const allowedExtensions = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export function isValidCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day!));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month! - 1 && date.getUTCDate() === day;
}

const dateSchema = z.string().refine(isValidCalendarDate, "Date must be a valid date in YYYY-MM-DD format");
const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Date must be a valid month in YYYY-MM format");
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

export const leaveHistoryQuerySchema = z.object({
  status: z.enum(["Pending", "Approved", "Rejected"]).optional(),
  date: z.union([monthSchema, z.literal("")]).optional(),
});

const listPaginationNumber = (field: string, defaultValue: number, maximum?: number) => z.preprocess(
  (value) => value === undefined || value === "" ? defaultValue : value,
  z.coerce.number({ error: `${field} must be a number` })
    .int(`${field} must be an integer`)
    .min(1, `${field} must be at least 1`)
    .refine((value) => maximum === undefined || value <= maximum, {
      message: maximum === undefined ? `${field} is out of range` : `${field} must not exceed ${maximum}`,
    }),
);

export const listLeavesQuerySchema = z.object({
  search: z.string().trim().max(100, "Search must not exceed 100 characters").optional(),
  category: z.enum(["Sakit", "Izin"]).optional(),
  start_date: dateSchema.optional(),
  end_date: dateSchema.optional(),
  limit: listPaginationNumber("Limit", 20, 100),
  page: listPaginationNumber("Page", 1),
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
  const start = Date.parse(`${query.start_date}T00:00:00.000Z`);
  const end = Date.parse(`${query.end_date}T00:00:00.000Z`);
  if ((end - start) / 86_400_000 + 1 > 60) {
    context.addIssue({ code: "custom", path: ["end_date"], message: "Date range must not exceed 60 days" });
  }
}) satisfies z.ZodType<ListLeavesQueryInput & { limit: number; page: number }>;

export const leaveIdParamSchema = z.object({
  id: z.coerce.number({ error: "Leave ID must be a number" })
    .int("Leave ID must be an integer")
    .positive("Leave ID must be a positive integer"),
});

export type LeaveHistoryQuery = z.infer<typeof leaveHistoryQuerySchema>;
export type ListLeavesQuery = z.infer<typeof listLeavesQuerySchema>;
export type LeaveIdParam = z.infer<typeof leaveIdParamSchema>;
