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
