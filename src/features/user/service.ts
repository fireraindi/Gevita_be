import { and, eq } from "drizzle-orm";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { db } from "../../db";
import { users } from "../../db/schema";
import { changePasswordSchema, createUserSchema } from "./validation";
import type { UserResponse } from "./model/response";
import { RegisterRequest } from "./model/request";
import { validate } from "../../helpers/validate";
import { BadRequestError, ConflictError, NotFoundError, PasswordMismatchError } from "../../errors/errors";
import type { ChangePasswordInput } from "./validation";
import { getProfilePhotoUrl } from "../../helpers/photo";
import type { UserDetailData } from "./model/response";

const extensionByType: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

let lastPhotoTimestamp = 0;

async function storeProfilePhoto(file: File): Promise<{ filename: string; filepath: string }> {
  const extension = extensionByType[file.type];
  const directory = join(process.cwd(), "uploads", "profile");
  await mkdir(directory, { recursive: true });
  let timestamp = Math.max(Date.now(), lastPhotoTimestamp + 1);
  while (true) {
    const filename = `${timestamp}.${extension}`;
    const filepath = join(directory, filename);
    try {
      await writeFile(filepath, new Uint8Array(await file.arrayBuffer()), { flag: "wx" });
      lastPhotoTimestamp = timestamp;
      return { filename, filepath };
    } catch (error) {
      if (typeof error !== "object" || error === null || !("code" in error) || error.code !== "EEXIST") throw error;
      timestamp += 1;
    }
  }
}

export async function createUser(request: RegisterRequest): Promise<UserResponse> {
  const input = validate(createUserSchema, request);

  let photo = "profile.webp";
  let storedPhoto: { filename: string; filepath: string } | null = null;
  if (input.photo) {
    storedPhoto = await storeProfilePhoto(input.photo);
    photo = storedPhoto.filename;
  }

  try {
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
      salary: input.salary,
      support_salary: input.supportSalary,
      overtime_salary: input.overtimeSalary,
      pocket_money: input.pocketMoney,
      bank: input.bank,
      account_number: input.accountNumber,
    }).returning({
      id: users.id,
      phone: users.phone,
      email: users.email,
      position: users.position,
      role: users.role,
      isActive: users.is_active,
      createdAt: users.created_at,
      salary: users.salary,
      supportSalary: users.support_salary,
      overtimeSalary: users.overtime_salary,
      pocketMoney: users.pocket_money,
      bank: users.bank,
      accountNumber: users.account_number,
    });
    if (!user) throw new Error("User insert did not return a row");
    return user;
  } catch (error) {
    if (storedPhoto) await unlink(storedPhoto.filepath).catch(() => undefined);
    if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
      throw new ConflictError("(email/phone) already exist");
    }
    throw error;
  }
}

export async function getUserById(id: string): Promise<UserDetailData> {
  const [user] = await db.select({
    id: users.id,
    phone: users.phone,
    email: users.email,
    position: users.position,
    role: users.role,
    isActive: users.is_active,
    photo: users.photo,
    createdAt: users.created_at,
    salary: users.salary,
    supportSalary: users.support_salary,
    overtimeSalary: users.overtime_salary,
    pocketMoney: users.pocket_money,
    bank: users.bank,
    accountNumber: users.account_number,
  }).from(users).where(eq(users.id, id)).limit(1);

  if (!user) throw new NotFoundError("User Not found");
  return { ...user, photo: getProfilePhotoUrl(user.photo) };
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
