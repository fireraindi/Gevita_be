import { z } from "zod";

export const createJobSchema = z.object({
  userId: z.string({ error: "User ID is required" }).trim().min(1, "User ID is required"),
  name: z.string({ error: "Name is required" }).trim().min(1, "Name is required").max(100, "Name must not exceed 100 characters"),
  salary: z.number({ error: "Salary must be a number" }).int("Salary must be an integer").positive("Salary must be a positive number"),
});

export type CreateJobInput = z.infer<typeof createJobSchema>;
