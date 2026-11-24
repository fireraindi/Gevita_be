import { Elysia, t } from "elysia";
import { assertAdmin } from "../../helpers/role";
import { authMiddleware } from "../../middleware/auth";
import type { CreateOvertimeRequest } from "./model/request";
import type { CreateOvertimeSuccessResponse } from "./model/response";
import { createOvertime } from "./service";

export const overtimesController = new Elysia({ prefix: "/api/overtimes" })
  .use(authMiddleware)
  .post("", async ({ body, set, authUser }): Promise<CreateOvertimeSuccessResponse> => {
    assertAdmin(authUser);
    const data = await createOvertime(body as CreateOvertimeRequest);
    set.status = 201;
    return {
      status: "success",
      message: "Data lembur berhasil dibuat",
      data,
    };
  }, {
    response: {
      201: t.Object({
        status: t.Literal("success"),
        message: t.Literal("Data lembur berhasil dibuat"),
        data: t.Object({
          id: t.Number(),
          userId: t.String(),
          timeFrame: t.Number(),
          start: t.String(),
          end: t.String(),
          description: t.String(),
          date: t.String(),
          createdAt: t.String(),
        }),
      }),
      400: t.Object({
        status: t.Literal("error"),
        statusCode: t.Literal(400),
        errors: t.Union([t.Record(t.String(), t.Array(t.String())), t.String()]),
      }),
      401: t.Object({ status: t.Literal("error"), statusCode: t.Literal(401), errors: t.Literal("Unauthorized") }),
      403: t.Object({ status: t.Literal("error"), statusCode: t.Literal(403), errors: t.Literal("Forbidden") }),
      404: t.Object({ status: t.Literal("error"), statusCode: t.Literal(404), errors: t.Literal("User not found") }),
      500: t.Object({ status: t.Literal("error"), statusCode: t.Literal(500), errors: t.Literal("Internal server error") }),
    },
    detail: {
      tags: ["Overtimes"],
      summary: "Create overtime record (Admin Only)",
      description: "Membuat catatan lembur untuk karyawan tertentu. Hanya dapat diakses oleh admin.",
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["userId", "timeFrame", "start", "end", "description", "date"],
              properties: {
                userId: { type: "string", format: "uuid", example: "c1f7a0b3-8c4d-4b82-9f3e-5b1a2c3d4e5f" },
                timeFrame: { type: "integer", minimum: 1, example: 2 },
                start: { type: "string", example: "19:00" },
                end: { type: "string", example: "21:00" },
                description: { type: "string", example: "Service Ac" },
                date: { type: "string", format: "date", example: "2026-11-26" },
              },
            },
          },
        },
      },
    },
  });
