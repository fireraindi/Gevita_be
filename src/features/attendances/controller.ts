import { Elysia, t } from "elysia";
import { authMiddleware } from "../../middleware/auth";
import { checkIn, checkOut } from "./service";
import type { CheckInRequest } from "./model/request";
import type { CheckInResponse, CheckOutResponse } from "./model/response";

export const attendancesController = new Elysia({ prefix: "/api/attendances" })
  .use(authMiddleware)
  .post("", async ({ body, authUser }): Promise<CheckInResponse> => ({
    status: "success" as const,
    statusCode: 200 as const,
    message: "Success check in attendances",
    data: await checkIn(authUser.id, body as CheckInRequest),
  }), {
    response: {
      200: t.Object({
        status: t.Literal("success"),
        statusCode: t.Literal(200),
        message: t.String(),
        data: t.Object({
          id: t.Number(),
          userId: t.String(),
          date: t.String(),
          checkInTime: t.Date(),
          status: t.Union([t.Literal("Hadir"), t.Literal("Terlambat")]),
          checkInPhoto: t.String(),
        }),
      }),
      400: t.Object({ status: t.Literal("error"), statusCode: t.Literal(400), errors: t.Unknown() }),
      401: t.Object({ status: t.Literal("error"), statusCode: t.Literal(401), errors: t.String() }),
      409: t.Object({ status: t.Literal("error"), statusCode: t.Literal(409), errors: t.String() }),
    },
    detail: {
      tags: ["Attendances"],
      summary: "Check in",
      description: "Mencatat absensi masuk dengan foto. Foto disimpan di /uploads/checkin.",
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: { "multipart/form-data": { schema: {
          type: "object",
          required: ["checkInPhoto"],
          properties: {
            checkInPhoto: {
              type: "string",
              format: "binary",
              description: "Foto JPG, JPEG, PNG, atau WebP maksimal 1 MB.",
            },
          },
        } } },
      },
    },
  })
  .put("", async ({ authUser }): Promise<CheckOutResponse> => ({
    status: "success",
    statusCode: 200,
    message: "Success check out attendances",
    data: await checkOut(authUser.id),
  }), {
    response: {
      200: t.Object({
        status: t.Literal("success"),
        statusCode: t.Literal(200),
        message: t.String(),
        data: t.Object({
          id: t.Number(),
          userId: t.String(),
          date: t.String(),
          checkOutTime: t.Date(),
        }),
      }),
      401: t.Object({ status: t.Literal("error"), statusCode: t.Literal(401), errors: t.String() }),
      409: t.Object({ status: t.Literal("error"), statusCode: t.Literal(409), errors: t.String() }),
    },
    detail: {
      tags: ["Attendances"],
      summary: "Check out",
      description: "Melakukan check out absensi harian.",
      security: [{ bearerAuth: [] }],
    },
  });
