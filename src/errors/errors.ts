export class ConflictError extends Error {
  readonly statusCode = 409;
}

export class UnauthorizedError extends Error {
  readonly statusCode = 401;
}

export class ForbiddenError extends Error {
  readonly statusCode = 403;
}
