import { and, eq, isNull } from "drizzle-orm";
import { db } from "../../db";
import { jobs, users } from "../../db/schema";
import { NotFoundError } from "../../errors/errors";
import { validate } from "../../helpers/validate";
import type { CreateJobRequest, UpdateJobRequest } from "./model/request";
import type { JobResponseData, UpdateJobResponseData } from "./model/response";
import { createJobSchema, jobIdParamSchema, updateJobSchema } from "./validation";

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

export async function updateJob(rawId: number | string, request: UpdateJobRequest): Promise<UpdateJobResponseData> {
  const param = validate(jobIdParamSchema, { id: rawId });
  const input = validate(updateJobSchema, request);

  const [existingJob] = await db
    .select({ id: jobs.id })
    .from(jobs)
    .where(and(eq(jobs.id, param.id), isNull(jobs.deleted_at)))
    .limit(1);

  if (!existingJob) throw new NotFoundError("Job Not found");

  const [existingUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, input.userId))
    .limit(1);

  if (!existingUser) throw new NotFoundError("User not found");

  const [updatedJob] = await db
    .update(jobs)
    .set({
      user_id: input.userId,
      name: input.name,
      salary: input.salary,
      updated_at: new Date(),
    })
    .where(eq(jobs.id, param.id))
    .returning({
      id: jobs.id,
      name: jobs.name,
      salary: jobs.salary,
    });

  if (!updatedJob) throw new Error("Job update did not return a row");
  return updatedJob;
}
