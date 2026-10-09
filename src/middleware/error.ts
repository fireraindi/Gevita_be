import { Elysia, NotFoundError as ElysiaNotFoundError, ParseError } from "elysia";
import { ZodError } from "zod";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError, PasswordMismatchError, UnauthorizedError } from "../errors/errors";

function getUniqueConstraintField(error: unknown, seen = new Set<unknown>()): "email" | "phone" | undefined {
  if (typeof error !== "object" || error === null || seen.has(error)) return undefined;
  seen.add(error);

  if ("code" in error && error.code === "23505") {
    const constraint = "constraint_name" in error ? error.constraint_name :
      "constraint" in error ? error.constraint : undefined;
    if (typeof constraint === "string") {
      if (constraint.includes("email")) return "email";
      if (constraint.includes("phone")) return "phone";
    }
  }

  if ("cause" in error) return getUniqueConstraintField(error.cause, seen);
  return undefined;
}

export const errorMiddleware = new Elysia({ name: "error-middleware" }).onError({ as: "global" }, ({ error, set }) => {
 

  if (error instanceof ZodError) {
    set.status = 400;
    const errors = error.issues.reduce<Record<string, string[]>>((grouped, issue) => {
      const field = String(issue.path[0] ?? "body");
      (grouped[field] ??= []).push(issue.message);
      return grouped;
    }, {});
    return { status: "error", statusCode: 400, errors };
  }

  if (error instanceof ParseError) {
    set.status = 400;
    return {
      status: "error",
      statusCode: 400,
      message: error.message,
      errors: { body: ["Invalid JSON request body"] },
    };
  }
  if (error instanceof BadRequestError) {
    set.status = 400;
      return { status: "error", statusCode: 400, errors: error.message };
  }


  if (error instanceof UnauthorizedError) {
    set.status = 401;
    return { status: "error", statusCode: 401, errors: error.message };
  }

  if (error instanceof ConflictError) {
    set.status = 409;
    return { status: "error", statusCode: 409, errors: error.message };
  }

  if (error instanceof PasswordMismatchError) {
    set.status = 422;
    return { status: "error", statusCode: 422, errors: error.message };
  }

  if (error instanceof ForbiddenError) {
    set.status = 403;
    return { status: "error", statusCode: 403, errors: error.message };
  }

  if (error instanceof NotFoundError) {
    set.status = 404;
    return { status: "error", statusCode: 404, errors: error.message };
  }

  if (error instanceof ElysiaNotFoundError) {
    set.status = 404;
    return { status: "error", statusCode: 404, errors: "Not found" };
  }

   // Database errors may be wrapped by Drizzle; classify them before validation errors.
  const uniqueField = getUniqueConstraintField(error);
  if (uniqueField) {
    set.status = 409;
    return {
      status: "error",
      statusCode: 409,
      message: "Conflict",
      errors: { [uniqueField]: `${uniqueField} already exists` },
    };
  }

  console.log(error);
  set.status = 500;
  return { status: "error", statusCode: 500, errors: "Internal server error" };
});
