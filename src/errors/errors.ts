export class ConflictError extends Error {
  readonly statusCode = 409;
}
