import { and, eq, gt, isNull, lt } from "drizzle-orm";
import { db } from "../../db";
import { overtimes, users } from "../../db/schema";
import { BadRequestError, ConflictError, NotFoundError } from "../../errors/errors";
import { validate } from "../../helpers/validate";
import type { CreateOvertimeRequest } from "./model/request";
import type { OvertimeResponseData } from "./model/response";
import { createOvertimeSchema } from "./validation";

const formatTimeHHMM = (value: string): string => value.slice(0, 5);

export async function createOvertime(request: CreateOvertimeRequest): Promise<OvertimeResponseData> {
  const input = validate(createOvertimeSchema, request);

  const [existingUser] = await db
    .select({ id: users.id, isActive: users.is_active })
    .from(users)
    .where(eq(users.id, input.userId))
    .limit(1);

  if (!existingUser) throw new NotFoundError("User not found");
  if (!existingUser.isActive) throw new BadRequestError("Target user is inactive");

  const [overlappingOvertime] = await db
    .select({ id: overtimes.id })
    .from(overtimes)
    .where(
      and(
        eq(overtimes.user_id, input.userId),
        eq(overtimes.date, input.date),
        isNull(overtimes.deleted_at),
        lt(overtimes.start, input.end),
        gt(overtimes.end, input.start),
      ),
    )
    .limit(1);

  if (overlappingOvertime) {
    throw new ConflictError("Overtime schedule overlaps with an existing overtime record");
  }

  const now = new Date();
  const [created] = await db
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
    .returning({
      id: overtimes.id,
      userId: overtimes.user_id,
      timeFrame: overtimes.time_frame,
      start: overtimes.start,
      end: overtimes.end,
      description: overtimes.description,
      date: overtimes.date,
      createdAt: overtimes.created_at,
    });

  if (!created) throw new Error("Overtime insert did not return a row");

  return {
    id: created.id,
    userId: created.userId,
    timeFrame: created.timeFrame,
    start: formatTimeHHMM(created.start),
    end: formatTimeHHMM(created.end),
    description: created.description,
    date: created.date,
    createdAt: created.createdAt.toISOString(),
  };
}
