import { t } from "elysia";

export const badRequestErrorSchema = t.Object({
  status: t.Literal("error"),
  statusCode: t.Literal(400),
  errors: t.Union([t.Record(t.String(), t.Array(t.String())), t.String()]),
});

export const unauthorizedErrorSchema = t.Object({
  status: t.Literal("error"),
  statusCode: t.Literal(401),
  errors: t.String(),
});

export const forbiddenErrorSchema = t.Object({
  status: t.Literal("error"),
  statusCode: t.Literal(403),
  errors: t.String(),
});

export const notFoundErrorSchema = t.Object({
  status: t.Literal("error"),
  statusCode: t.Literal(404),
  errors: t.String(),
});

export const conflictErrorSchema = t.Object({
  status: t.Literal("error"),
  statusCode: t.Literal(409),
  errors: t.String(),
});

export const tooManyRequestsErrorSchema = t.Object({
  status: t.Literal("error"),
  statusCode: t.Literal(429),
  errors: t.String(),
});

export const internalServerErrorSchema = t.Object({
  status: t.Literal("error"),
  statusCode: t.Literal(500),
  errors: t.Literal("Internal server error"),
});

