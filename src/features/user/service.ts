import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { db } from "../../db";
import { users } from "./schema";
import { createUserSchema } from "./validation";
import type { UserResponse } from "./model/userResponse";
import { RegisterRequest } from "./model/registerRequest";
import { validate } from "../../helpers/validate";

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
