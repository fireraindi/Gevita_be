import { ForbiddenError } from "../errors/errors";

export type UserRole = "admin" | "employee";

export function assertRole(user: { role: string }, ...allowedRoles: UserRole[]): void {
  if (!allowedRoles.some((role) => role === user.role)) throw new ForbiddenError("Forbidden");
}

export function assertAdmin(user: { role: string }): void {
  assertRole(user, "admin");
}
