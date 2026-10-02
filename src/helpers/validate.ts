import type { ZodType } from "zod";

export function validate<T>(
  schema: ZodType<T>,
  value: unknown,
): T {
  return schema.parse(value);
}