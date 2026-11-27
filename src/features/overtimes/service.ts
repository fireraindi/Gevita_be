import { and, count, desc, eq, gt, gte, ilike, isNull, lt, lte, ne, sql } from "drizzle-orm";
import { db } from "../../db";
import { overtimes, users } from "../../db/schema";
import { BadRequestError, ConflictError, NotFoundError } from "../../errors/errors";
import { escapeIlikePattern } from "../../helpers/sql";
import { validate } from "../../helpers/validate";
import type { CreateOvertimeRequest, ListOvertimesQueryInput, UpdateOvertimeRequest } from "./model/request";
import type { OvertimeListItem, OvertimePagination, OvertimeResponseData } from "./model/response";
import { createOvertimeSchema, listOvertimesQuerySchema, overtimeIdParamSchema, updateOvertimeSchema } from "./validation";

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

const formatTimeHHMM = (value: string): string => value.slice(0, 5);

const overtimeListColumns = {
  id: overtimes.id,
  userId: overtimes.user_id,
  timeFrame: overtimes.time_frame,
  start: overtimes.start,
  end: overtimes.end,
  description: overtimes.description,
  date: overtimes.date,
  status: overtimes.status,
};

const overtimeReturningColumns = {
  ...overtimeListColumns,
  createdAt: overtimes.created_at,
};

interface OvertimeDbRow extends OvertimeListItem {
  createdAt: Date;
}

function toOvertimeListItem(row: OvertimeListItem): OvertimeListItem {
  return {
    id: row.id,
    userId: row.userId,
    timeFrame: row.timeFrame,
    start: formatTimeHHMM(row.start),
    end: formatTimeHHMM(row.end),
    description: row.description,
    date: row.date,
    status: row.status,
  };
}

function toOvertimeResponseData(row: OvertimeDbRow): OvertimeResponseData {
  return {
    ...toOvertimeListItem(row),
    createdAt: row.createdAt.toISOString(),
  };
}

async function lockUserOvertimeDate(tx: DbTransaction, userId: string, date: string): Promise<void> {
  const lockKey = `overtime:${userId}:${date}`;
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`);
}

async function ensureNoOverlappingOvertime(
  tx: DbTransaction,
  userId: string,
  date: string,
  start: string,
  end: string,
  excludeOvertimeId?: number,
): Promise<void> {
  const conditions = [
    eq(overtimes.user_id, userId),
    eq(overtimes.date, date),
    isNull(overtimes.deleted_at),
    lt(overtimes.start, end),
    gt(overtimes.end, start),
  ];

  if (excludeOvertimeId !== undefined) {
    conditions.push(ne(overtimes.id, excludeOvertimeId));
  }

  const [overlappingOvertime] = await tx
    .select({ id: overtimes.id })
    .from(overtimes)
    .where(and(...conditions))
    .limit(1);

  if (overlappingOvertime) {
    throw new ConflictError("Overtime schedule overlaps with an existing overtime record");
  }
}

export async function createOvertime(request: CreateOvertimeRequest): Promise<OvertimeResponseData> {
  const input = validate(createOvertimeSchema, request);

  return db.transaction(async (tx) => {
    const [existingUser] = await tx
      .select({ id: users.id, isActive: users.is_active })
      .from(users)
      .where(eq(users.id, input.userId))
      .limit(1);

    if (!existingUser) throw new NotFoundError("User not found");
    if (!existingUser.isActive) throw new BadRequestError("Target user is inactive");

    await lockUserOvertimeDate(tx, input.userId, input.date);
    await ensureNoOverlappingOvertime(tx, input.userId, input.date, input.start, input.end);

    const now = new Date();
    const [created] = await tx
      .insert(overtimes)
      .values({
        user_id: input.userId,
        time_frame: input.timeFrame,
        start: input.start,
        end: input.end,
        description: input.description,
        date: input.date,
        status: true,
        created_at: now,
        updated_at: now,
      })
      .returning(overtimeReturningColumns);

    if (!created) throw new Error("Overtime insert did not return a row");

    return toOvertimeResponseData(created);
  });
}

export async function updateOvertime(
  rawId: number | string,
  request: UpdateOvertimeRequest,
): Promise<OvertimeResponseData> {
  const param = validate(overtimeIdParamSchema, { id: rawId });
  const input = validate(updateOvertimeSchema, request);

  return db.transaction(async (tx) => {
    const [existingOvertime] = await tx
      .select({ id: overtimes.id, userId: overtimes.user_id })
      .from(overtimes)
      .where(and(eq(overtimes.id, param.id), isNull(overtimes.deleted_at)))
      .limit(1);

    if (!existingOvertime) throw new NotFoundError("Overtime not found");

    await lockUserOvertimeDate(tx, existingOvertime.userId, input.date);
    await ensureNoOverlappingOvertime(
      tx,
      existingOvertime.userId,
      input.date,
      input.start,
      input.end,
      param.id,
    );

    const [updated] = await tx
      .update(overtimes)
      .set({
        time_frame: input.timeFrame,
        start: input.start,
        end: input.end,
        description: input.description,
        date: input.date,
        updated_at: new Date(),
      })
      .where(and(eq(overtimes.id, param.id), isNull(overtimes.deleted_at)))
      .returning(overtimeReturningColumns);

    if (!updated) throw new NotFoundError("Overtime not found");

    return toOvertimeResponseData(updated);
  });
}

export async function getOvertimes(
  queryInput: ListOvertimesQueryInput = {},
): Promise<{ data: OvertimeListItem[]; pagination: OvertimePagination }> {
  const query = validate(listOvertimesQuerySchema, queryInput);
  const conditions = [isNull(overtimes.deleted_at)];

  if (query.name) {
    const pattern = `%${escapeIlikePattern(query.name)}%`;
    conditions.push(ilike(users.name, pattern));
  }
  if (query.start_date) {
    conditions.push(gte(overtimes.date, query.start_date));
  }
  if (query.end_date) {
    conditions.push(lte(overtimes.date, query.end_date));
  }

  const whereClause = and(...conditions);

  const [countRow] = await db
    .select({ total: count() })
    .from(overtimes)
    .innerJoin(users, eq(overtimes.user_id, users.id))
    .where(whereClause);

  const total = Number(countRow?.total ?? 0);

  const rows = await db
    .select(overtimeListColumns)
    .from(overtimes)
    .innerJoin(users, eq(overtimes.user_id, users.id))
    .where(whereClause)
    .orderBy(desc(overtimes.date), desc(overtimes.id))
    .limit(query.limit)
    .offset((query.page - 1) * query.limit);

  return {
    data: rows.map(toOvertimeListItem),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      total_pages: total === 0 ? 0 : Math.ceil(total / query.limit),
    },
  };
}

export async function removeOvertime(rawId: number | string): Promise<void> {
  const param = validate(overtimeIdParamSchema, { id: rawId });
  const now = new Date();

  const [deleted] = await db
    .update(overtimes)
    .set({
      deleted_at: now,
      updated_at: now,
    })
    .where(and(eq(overtimes.id, param.id), isNull(overtimes.deleted_at)))
    .returning({ id: overtimes.id });

  if (!deleted) throw new NotFoundError("Overtime not found");
}

async function updateOvertimeStatus(
  rawId: number | string,
  status: boolean,
): Promise<OvertimeResponseData> {
  const param = validate(overtimeIdParamSchema, { id: rawId });

  const [updated] = await db
    .update(overtimes)
    .set({
      status,
      updated_at: new Date(),
    })
    .where(and(eq(overtimes.id, param.id), isNull(overtimes.deleted_at)))
    .returning(overtimeReturningColumns);

  if (!updated) throw new NotFoundError("Overtime not found");

  return toOvertimeResponseData(updated);
}

export async function approveOvertime(rawId: number | string): Promise<OvertimeResponseData> {
  return updateOvertimeStatus(rawId, true);
}

export async function rejectOvertime(rawId: number | string): Promise<OvertimeResponseData> {
  return updateOvertimeStatus(rawId, false);
}
