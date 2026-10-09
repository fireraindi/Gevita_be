import { and, eq } from "drizzle-orm";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { db } from "../../db";
import { users } from "../../db/schema";
import { changePasswordSchema, createUserSchema } from "./validation";
import type { UserResponse } from "./model/response";
import { RegisterRequest } from "./model/request";
import { validate } from "../../helpers/validate";
import { BadRequestError, NotFoundError, PasswordMismatchError } from "../../errors/errors";
import type { ChangePasswordInput } from "./validation";

const extensionByType: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function createUser(request: RegisterRequest): Promise<UserResponse> {
  const input = validate(createUserSchema, request);

  let photo = "profile.webp";
  if (input.photo) {
    const extension = extensionByType[input.photo.type];
    const filename = `${crypto.randomUUID()}.${extension}`;
    const directory = join(process.cwd(), "uploads", "profile");
    await mkdir(directory, { recursive: true });
    await Bun.write(join(directory, filename), input.photo);
    photo = filename;
  }

  const [user] = await db.insert(users).values({
    id: crypto.randomUUID(),
    name: input.name,
    phone: input.phone,
    email: input.email,
    password: await Bun.password.hash(input.password),
    position: input.position,
    role: input.role,
    photo,
    is_active: true,
    created_at: new Date(),
  }).returning({
    id: users.id,
    phone: users.phone,
    email: users.email,
    position: users.position,
    role: users.role,
    isActive: users.is_active,
    createdAt: users.created_at,
  });
  return user;
}

export async function changePassword(userId: string, request: ChangePasswordInput): Promise<void> {
  const input = validate(changePasswordSchema, request);
  const [user] = await db.select({ id: users.id, password: users.password })
    .from(users)
    .where(and(eq(users.id, userId), eq(users.is_active, true)))
    .limit(1);

  if (!user) throw new NotFoundError("User not found");
  if (!(await Bun.password.verify(input.oldPassword, user.password))) {
    throw new BadRequestError("Password doesnt match");
  }

  const password = await Bun.password.hash(input.newPassword);
  await db.update(users).set({ password, updated_at: new Date() }).where(eq(users.id, userId));
}
