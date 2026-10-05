export class ConflictError extends Error {
  readonly statusCode = 409;
}
export class BadRequestError extends Error {
  readonly statusCode = 400;
}

export class UnauthorizedError extends Error {
  readonly statusCode = 401;
}

export class ForbiddenError extends Error {
  readonly statusCode = 403;
}

export class NotFoundError extends Error {
  readonly statusCode = 404;
}

export class PasswordMismatchError extends Error {
  readonly statusCode = 422;
}
