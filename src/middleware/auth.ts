import { eq } from "drizzle-orm";
import { Elysia } from "elysia";
import { db } from "../db";
import { users } from "../db/schema";
import { ForbiddenError, UnauthorizedError } from "../errors/errors";
import type { UserRole } from "../helpers/role";
import { verifyToken } from "../helpers/token";

export interface AuthenticatedUser {
  id: string;
  role: UserRole;
}

export async function authenticateRequest(request: Request): Promise<AuthenticatedUser> {
  const authorization = request.headers.get("authorization");
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  if (!match) throw new UnauthorizedError("Unauthorized");

  const payload = verifyToken(match[1]);
  const [account] = await db
    .select({ id: users.id, role: users.role, isActive: users.is_active })
    .from(users)
    .where(eq(users.id, payload.id))
    .limit(1);

  if (account) {
    if (!account.isActive) throw new ForbiddenError("User account is inactive");
    return { id: account.id, role: account.role };
  }

  return payload;
}

export const authMiddleware = new Elysia({ name: "auth-middleware" }).derive(
  { as: "scoped" },
  async ({ request }) => ({
    authUser: await authenticateRequest(request),
  }),
);
