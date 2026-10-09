import { eq, or } from "drizzle-orm";
import { db } from "../../db";
import { ForbiddenError, NotFoundError, UnauthorizedError } from "../../errors/errors";
import { generateToken } from "../../helpers/token";
import { getProfilePhotoUrl } from "../../helpers/photo";
import { validate } from "../../helpers/validate";
import { users } from "../../db/schema";
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
    .where(or(eq(users.email, input.identifier), eq(users.phone, input.identifier)))
    .limit(1);


  if (!user || !(await Bun.password.verify(input.password, user.password))) {
    throw new UnauthorizedError("Invalid credentials");
  }
  if (!user.isActive) throw new ForbiddenError("User account is inactive");

  return generateToken({ id: user.id, role: user.role });
}

export async function getCurrentUser(id: string) {
  const [user] = await db.select({
    id: users.id,
    name: users.name,
    email: users.email,
    position: users.position,
    photo: users.photo,
    role: users.role,
    is_active: users.is_active,
  })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  if (!user) throw new NotFoundError("User not found");
  if (!user.is_active) throw new ForbiddenError("User account is inactive");

  return { ...user, photo: getProfilePhotoUrl(user.photo) };
}
