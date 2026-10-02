import { and, eq, isNull, or } from "drizzle-orm";
import { db } from "../../db";
import { ForbiddenError, UnauthorizedError } from "../../errors/errors";
import { generateToken } from "../../helpers/token";
import { validate } from "../../helpers/validate";
import { users } from "../user/schema";
import type { LoginRequest } from "./model";
import { loginSchema } from "./validation";

export async function login(request: LoginRequest): Promise<string> {
  const input = validate(loginSchema, request);
  const [user] = await db.select({
    id: users.id,
    password: users.password,
    role: users.role,
    isActive: users.is_active,
  })
    .from(users)
    .where(and(
      isNull(users.deleted_at),
      or(eq(users.email, input.identifier), eq(users.phone, input.identifier)),
    ))
    .limit(1);

  if (!user || !(await Bun.password.verify(input.password, user.password))) {
    throw new UnauthorizedError("Invalid credentials");
  }
  if (!user.isActive) throw new ForbiddenError("User account is inactive");

  return generateToken({ id: user.id, role: user.role });
}
