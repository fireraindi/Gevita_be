import { z } from "zod";
import { isValidCalendarDate } from "../../helpers/date";
import type { CreateOvertimeRequest } from "./model/request";

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

export const createOvertimeSchema = z.object({
  userId: z.uuid("User ID must be a valid UUID"),
  timeFrame: z
    .number({ error: "Time frame must be a number" })
    .int("Time frame must be an integer")
    .positive("Time frame must be greater than 0")
    .max(2_147_483_647, "Time frame is out of range"),
  start: z
    .string({ error: "Start time is required" })
    .trim()
    .regex(timePattern, "Start time must be a valid time in HH:MM format"),
  end: z
    .string({ error: "End time is required" })
    .trim()
    .regex(timePattern, "End time must be a valid time in HH:MM format"),
  description: z
    .string({ error: "Description is required" })
    .trim()
    .min(1, "Description is required"),
  date: z
    .string({ error: "Date is required" })
    .trim()
    .refine(isValidCalendarDate, "Date must be a valid date in YYYY-MM-DD format"),
}).superRefine((data, ctx) => {
  if (!timePattern.test(data.start) || !timePattern.test(data.end)) {
    return;
  }

  if (data.start === data.end) {
    ctx.addIssue({
      code: "custom",
      path: ["end"],
      message: "End time must be different from start time",
    });
    return;
  }

  if (data.start > data.end) {
    ctx.addIssue({
      code: "custom",
      path: ["start"],
      message: "Start time must not be greater than end time",
    });
    ctx.addIssue({
      code: "custom",
      path: ["end"],
      message: "End time must not be less than start time",
    });
  }
}) satisfies z.ZodType<CreateOvertimeRequest>;

export type CreateOvertimeInput = z.infer<typeof createOvertimeSchema>;
