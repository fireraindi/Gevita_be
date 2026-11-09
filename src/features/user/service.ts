import { and, desc, eq, ilike, or } from "drizzle-orm";
import { unlink } from "node:fs/promises";
import { db } from "../../db";
import { users } from "../../db/schema";
import { changePasswordSchema, createUserSchema, updateUserSchema, userListQuerySchema } from "./validation";
import type { UserResponse, UserDetailData, UserListItemData, UpdateUserData } from "./model/response";
import type { RegisterRequest, UpdateUserRequest } from "./model/request";
import { validate } from "../../helpers/validate";
import { BadRequestError, ConflictError, NotFoundError } from "../../errors/errors";
import type { ChangePasswordInput, UserListQuery } from "./validation";
import { getProfilePhotoUrl } from "../../helpers/photo";
import { storeUploadedImage } from "../../helpers/upload";
import { escapeIlikePattern } from "../../helpers/sql";

export async function createUser(request: RegisterRequest): Promise<UserResponse> {
  const input = validate(createUserSchema, request);

  let photo = "profile.webp";
  let storedPhoto: { filename: string; filepath: string } | null = null;
  if (input.photo) {
    storedPhoto = await storeUploadedImage("profile", input.photo);
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
      name: users.name,
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

export async function updateUser(userId: string, request: UpdateUserRequest): Promise<UpdateUserData> {
  const input = validate(updateUserSchema, request);
  const [existingUser] = await db.select({ id: users.id })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!existingUser) throw new NotFoundError("User Not found");

  const hashedPassword = input.password ? await Bun.password.hash(input.password) : undefined;
  let storedPhoto: { filename: string; filepath: string } | null = null;
  if (input.photo) storedPhoto = await storeUploadedImage("profile", input.photo);

  const updateData: Partial<typeof users.$inferInsert> = { updated_at: new Date() };
  if (input.isActive !== undefined) updateData.is_active = input.isActive;
  if (input.name !== undefined) updateData.name = input.name;
  if (input.phone !== undefined) updateData.phone = input.phone;
  if (input.email !== undefined) updateData.email = input.email;
  if (input.position !== undefined) updateData.position = input.position;
  if (input.role !== undefined) updateData.role = input.role;
  if (input.salary !== undefined) updateData.salary = input.salary;
  if (input.supportSalary !== undefined) updateData.support_salary = input.supportSalary;
  if (input.overtimeSalary !== undefined) updateData.overtime_salary = input.overtimeSalary;
  if (input.pocketMoney !== undefined) updateData.pocket_money = input.pocketMoney;
  if (input.bank !== undefined) updateData.bank = input.bank;
  if (input.accountNumber !== undefined) updateData.account_number = input.accountNumber;
  if (storedPhoto) updateData.photo = storedPhoto.filename;
  if (hashedPassword) updateData.password = hashedPassword;

  try {
    const [updatedUser] = await db.update(users).set(updateData).where(eq(users.id, userId)).returning({
      id: users.id,
      name: users.name,
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
    if (!updatedUser) throw new NotFoundError("User Not found");
    return updatedUser;
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
    name: users.name,
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

export async function getUsers(query?: UserListQuery): Promise<UserListItemData[]> {
  const input = query ? validate(userListQuerySchema, query) : {};
  const search = input.search?.trim();
  const escapedSearch = search ? escapeIlikePattern(search) : undefined;
  const whereClause = escapedSearch
    ? or(ilike(users.name, `%${escapedSearch}%`), ilike(users.phone, `%${escapedSearch}%`))
    : undefined;

  const page = input.page ?? 1;
  const limit = input.limit ?? 100;

  return db.select({
    id: users.id,
    name: users.name,
    phone: users.phone,
    position: users.position,
    isActive: users.is_active,
  })
    .from(users)
    .where(whereClause)
    .orderBy(desc(users.created_at))
    .limit(limit)
    .offset((page - 1) * limit);
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
