import { eq } from "drizzle-orm";
import { db } from "../db";
import { users } from "../db/schema";
import { ForbiddenError, UnauthorizedError } from "../errors/errors";

export type UserRole = "admin" | "employee";

export async function requireActiveAdmin(currentUser: { id: string; role: UserRole }): Promise<void> {
  if (currentUser.role !== "admin") {
    throw new ForbiddenError("Forbidden");
  }

  const [account] = await db
    .select({ role: users.role, isActive: users.is_active })
    .from(users)
    .where(eq(users.id, currentUser.id))
    .limit(1);

  if (!account) {
    throw new UnauthorizedError("Unauthorized");
  }
  if (!account.isActive) {
    throw new ForbiddenError("User account is inactive");
  }
  if (account.role !== "admin") {
    throw new ForbiddenError("Forbidden");
  }
}
