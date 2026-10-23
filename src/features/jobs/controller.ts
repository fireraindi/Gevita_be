import { Elysia, t } from "elysia";
import { assertAdmin } from "../../helpers/role";
import { authMiddleware } from "../../middleware/auth";
import type { CreateJobRequest } from "./model/request";
import type { CreateJobSuccessResponse } from "./model/response";
import { createJob } from "./service";

export const jobsController = new Elysia({ prefix: "/api/jobs" })
  .use(authMiddleware)
  .post("", async ({ body, set, authUser }): Promise<CreateJobSuccessResponse> => {
    assertAdmin(authUser);
    const job = await createJob(body as CreateJobRequest);
    set.status = 201;
    return { status: "success", message: "Create job success", data: job };
  }, {
    response: {
      201: t.Object({
        status: t.Literal("success"),
        message: t.Literal("Create job success"),
        data: t.Object({ id: t.Number(), userId: t.String(), name: t.String(), salary: t.Number() }),
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
      tags: ["Jobs"],
      summary: "Create job category (Admin Only)",
      description: "Membuat kategori pekerjaan baru dan mengaitkannya ke pengguna tertentu. Hanya dapat diakses oleh admin.",
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["userId", "name", "salary"],
              properties: {
                userId: { type: "string", description: "Target user ID (UUID)" },
                name: { type: "string", minLength: 1, maxLength: 100, description: "Job title / category name" },
                salary: { type: "integer", minimum: 1, description: "Salary in IDR" },
              },
            },
          },
        },
      },
    },
  });
