import jwt from "jsonwebtoken";
import { UnauthorizedError } from "../errors/errors";

type TokenPayload = {
  id: string;
  role: "admin" | "employee";
};

export function verifyToken(token: string): TokenPayload {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not configured");

  try {
    const payload = jwt.verify(token, secret);
    if (
      typeof payload === "object" && payload !== null &&
      typeof payload.id === "string" &&
      (payload.role === "admin" || payload.role === "employee")
    ) {
      return { id: payload.id, role: payload.role };
    }
  } catch {
    throw new UnauthorizedError("Unauthorized");
  }

  throw new UnauthorizedError("Unauthorized");
}

export function generateToken(payload: TokenPayload): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not configured");

  return jwt.sign(payload, secret, { expiresIn: "3d" });
}
