import { and, count, desc, eq, ilike, isNull, or } from "drizzle-orm";
import { db } from "../../db";
import { jobs, users } from "../../db/schema";
import { NotFoundError } from "../../errors/errors";
import { validate } from "../../helpers/validate";
import { escapeIlikePattern } from "../../helpers/sql";
import type { CreateJobRequest, ListJobsQueryInput, UpdateJobRequest } from "./model/request";
import type { JobListItem, JobPagination, JobResponseData, UpdateJobResponseData } from "./model/response";
import { createJobSchema, jobIdParamSchema, listJobsQuerySchema, updateJobSchema } from "./validation";

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

  const [updatedJob] = await db
    .update(jobs)
    .set({
      name: input.name,
      salary: input.salary,
      updated_at: new Date(),
    })
    .where(and(eq(jobs.id, param.id), isNull(jobs.deleted_at)))
    .returning({
      id: jobs.id,
      name: jobs.name,
      salary: jobs.salary,
    });

  if (!updatedJob) throw new NotFoundError("Job Not found");
  return updatedJob;
}

export async function removeJob(rawId: number | string): Promise<void> {
  const param = validate(jobIdParamSchema, { id: rawId });
  const now = new Date();

  const [deletedJob] = await db
    .update(jobs)
    .set({
      deleted_at: now,
      updated_at: now,
    })
    .where(and(eq(jobs.id, param.id), isNull(jobs.deleted_at)))
    .returning({ id: jobs.id });

  if (!deletedJob) throw new NotFoundError("Job Not found");
}

export async function getJobs(
  queryInput: ListJobsQueryInput = {},
): Promise<{ data: JobListItem[]; pagination: JobPagination }> {
  const query = validate(listJobsQuerySchema, queryInput);
  const conditions = [isNull(jobs.deleted_at)];

  if (query.name) {
    const pattern = `%${escapeIlikePattern(query.name)}%`;
    const searchCondition = or(ilike(jobs.name, pattern), ilike(users.name, pattern));
    if (searchCondition) conditions.push(searchCondition);
  }

  const whereClause = and(...conditions);

  const [countRow] = await db
    .select({ total: count() })
    .from(jobs)
    .innerJoin(users, eq(jobs.user_id, users.id))
    .where(whereClause);

  const total = Number(countRow?.total ?? 0);

  const rows = await db
    .select({
      id: jobs.id,
      userId: jobs.user_id,
      userName: users.name,
      name: jobs.name,
      salary: jobs.salary,
    })
    .from(jobs)
    .innerJoin(users, eq(jobs.user_id, users.id))
    .where(whereClause)
    .orderBy(desc(jobs.created_at), desc(jobs.id))
    .limit(query.limit)
    .offset((query.page - 1) * query.limit);

  return {
    data: rows,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      total_pages: total === 0 ? 0 : Math.ceil(total / query.limit),
    },
  };
}
