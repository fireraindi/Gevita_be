import { and, eq, gt, isNull, lt, ne, sql } from "drizzle-orm";
import { db } from "../../db";
import { overtimes, users } from "../../db/schema";
import { BadRequestError, ConflictError, NotFoundError } from "../../errors/errors";
import { validate } from "../../helpers/validate";
import type { CreateOvertimeRequest, UpdateOvertimeRequest } from "./model/request";
import type { OvertimeDetailData, OvertimeResponseData } from "./model/response";
import { createOvertimeSchema, overtimeIdParamSchema, updateOvertimeSchema } from "./validation";

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

const formatTimeHHMM = (value: string): string => value.slice(0, 5);

const overtimeReturningColumns = {
  id: overtimes.id,
  userId: overtimes.user_id,
  timeFrame: overtimes.time_frame,
  start: overtimes.start,
  end: overtimes.end,
  description: overtimes.description,
  date: overtimes.date,
  createdAt: overtimes.created_at,
};

interface OvertimeDbRow {
  id: number;
  userId: string;
  timeFrame: number;
  start: string;
  end: string;
  description: string;
  date: string;
  createdAt: Date;
}

function toOvertimeResponseData(row: OvertimeDbRow): OvertimeResponseData {
  return {
    id: row.id,
    userId: row.userId,
    timeFrame: row.timeFrame,
    start: formatTimeHHMM(row.start),
    end: formatTimeHHMM(row.end),
    description: row.description,
    date: row.date,
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

export async function getOvertimeById(rawId: number | string): Promise<OvertimeDetailData> {
  const param = validate(overtimeIdParamSchema, { id: rawId });

  const [record] = await db
    .select({
      id: overtimes.id,
      userId: overtimes.user_id,
      timeFrame: overtimes.time_frame,
      start: overtimes.start,
      end: overtimes.end,
      description: overtimes.description,
      date: overtimes.date,
    })
    .from(overtimes)
    .where(and(eq(overtimes.id, param.id), isNull(overtimes.deleted_at)))
    .limit(1);

  if (!record) throw new NotFoundError("Overtime not found");

  return {
    id: record.id,
    userId: record.userId,
    timeFrame: record.timeFrame,
    start: formatTimeHHMM(record.start),
    end: formatTimeHHMM(record.end),
    description: record.description,
    date: record.date,
  };
}
