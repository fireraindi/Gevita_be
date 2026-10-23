import { eq } from "drizzle-orm";
import { db } from "../../db";
import { jobs, users } from "../../db/schema";
import { NotFoundError } from "../../errors/errors";
import { validate } from "../../helpers/validate";
import type { CreateJobRequest } from "./model/request";
import type { JobResponseData } from "./model/response";
import { createJobSchema } from "./validation";

export async function createJob(request: CreateJobRequest): Promise<JobResponseData> {
  const input = validate(createJobSchema, request);
  const [existingUser] = await db.select({ id: users.id })
    .from(users)
    .where(eq(users.id, input.userId))
    .limit(1);

  if (!existingUser) throw new NotFoundError("User not found");

  const now = new Date();
  const [newJob] = await db.insert(jobs).values({
    user_id: input.userId,
    name: input.name,
    salary: input.salary,
    created_at: now,
    updated_at: now,
  }).returning({
    id: jobs.id,
    userId: jobs.user_id,
    name: jobs.name,
    salary: jobs.salary,
  });

  if (!newJob) throw new Error("Job insert did not return a row");
  return newJob;
}
