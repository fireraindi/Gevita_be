import { z } from "zod";

export const loginSchema = z.object({
  identifier: z.string({ error: "Required field" }).min(1, "Required field"),
  password: z.string({ error: "Required field" }).min(1, "Required field"),
});
