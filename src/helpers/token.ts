import jwt from "jsonwebtoken";

type TokenPayload = {
  id: string;
  role: "admin" | "employee";
};

export function generateToken(payload: TokenPayload): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not configured");

  return jwt.sign(payload, secret, { expiresIn: "7d" });
}
