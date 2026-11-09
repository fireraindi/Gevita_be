import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  JWT_SECRET: z.string().min(1, "JWT_SECRET is required"),
  PUBLIC_BASE_URL: z.string().default("http://localhost:3000"),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(3000),
});

export const config = envSchema.parse({
  DATABASE_URL: process.env.DATABASE_URL || "postgres://user:password@localhost:5432/db",
  JWT_SECRET: process.env.JWT_SECRET || (process.env.NODE_ENV === "test" ? "api-tests-only-secret" : "default-secret-key-change-in-prod-32ch"),
  PUBLIC_BASE_URL: process.env.PUBLIC_BASE_URL,
  CORS_ORIGIN: process.env.CORS_ORIGIN,
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT,
});

