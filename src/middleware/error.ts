import { Elysia, NotFoundError as ElysiaNotFoundError, ParseError } from "elysia";
import { ZodError } from "zod";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError, PasswordMismatchError, TooManyRequestsError, UnauthorizedError } from "../errors/errors";

function getUniqueConstraintDetails(error: unknown, seen = new Set<unknown>()): { field?: "email" | "phone"; isAttendance?: boolean } | undefined {
  if (typeof error !== "object" || error === null || seen.has(error)) return undefined;
  seen.add(error);

  if ("code" in error && error.code === "23505") {
    const constraint = "constraint_name" in error ? error.constraint_name :
      "constraint" in error ? error.constraint : undefined;
    if (typeof constraint === "string") {
      if (constraint.includes("email")) return { field: "email" };
      if (constraint.includes("phone")) return { field: "phone" };
      if (constraint.includes("attendances_user_id_date")) return { isAttendance: true };
    }
  }

  if ("cause" in error) return getUniqueConstraintDetails(error.cause, seen);
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
    return { status: "error", statusCode: 401, errors: error.message || "Unauthorized" };
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
    return { status: "error", statusCode: 403, errors: error.message || "Forbidden" };
  }

  if (error instanceof NotFoundError) {
    set.status = 404;
    return { status: "error", statusCode: 404, errors: error.message };
  }

  if (error instanceof TooManyRequestsError) {
    set.status = 429;
    // console.info(error.message)
    return { status: "error", statusCode: 429, errors: error.message };

  }

  if (error instanceof ElysiaNotFoundError) {
    set.status = 404;
    return { status: "error", statusCode: 404, errors: "Not found" };
  }

   // Database errors may be wrapped by Drizzle; classify them before validation errors.
  const uniqueDetails = getUniqueConstraintDetails(error);
  if (uniqueDetails) {
    set.status = 409;
    if (uniqueDetails.isAttendance) {
      return {
        status: "error",
        statusCode: 409,
        errors: "Attendance already exists for this date",
      };
    }
    return {
      status: "error",
      statusCode: 409,
      errors: "(email/phone) already exist",
    };
  }

  console.log(error);
  set.status = 500;
  return { status: "error", statusCode: 500, errors: "Internal server error" };
});
