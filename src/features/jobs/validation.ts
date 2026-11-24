import { z } from "zod";

export const createJobSchema = z.object({
  userId: z.string({ error: "User ID is required" }).trim().min(1, "User ID is required"),
  name: z.string({ error: "Name is required" }).trim().min(1, "Name is required").max(100, "Name must not exceed 100 characters"),
  salary: z.number({ error: "Salary must be a number" }).int("Salary must be an integer").positive("Salary must be a positive number"),
});

export const updateJobSchema = z.object({
  name: z.string({ error: "Name is required" }).trim().min(1, "Name is required").max(100, "Name must not exceed 100 characters"),
  salary: z.number({ error: "Salary must be a number" }).int("Salary must be an integer").positive("Salary must be a positive number"),
});

export const jobIdParamSchema = z.object({
  id: z.coerce.number({ error: "Job ID must be a number" })
    .int("Job ID must be an integer")
    .positive("Job ID must be a positive integer")
    .max(2_147_483_647, "Job ID is out of range"),
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

export const listJobsQuerySchema = z.object({
  name: z.string().trim().max(100, "Name must not exceed 100 characters").optional(),
  limit: paginationNumber("Limit", 1, 100, 20),
  page: paginationNumber("Page", 1, 2_147_483_647, 1),
});

export type CreateJobInput = z.infer<typeof createJobSchema>;
export type UpdateJobInput = z.infer<typeof updateJobSchema>;
export type JobIdParam = z.infer<typeof jobIdParamSchema>;
export type ListJobsQuery = z.infer<typeof listJobsQuerySchema>;
