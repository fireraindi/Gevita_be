import { Elysia, t } from "elysia";
import { assertAdmin } from "../../helpers/role";
import { authMiddleware } from "../../middleware/auth";
import type { CreateJobRequest, UpdateJobRequest } from "./model/request";
import type { CreateJobSuccessResponse, UpdateJobSuccessResponse } from "./model/response";
import { createJob, updateJob } from "./service";

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
  })
  .put("/:id", async ({ params, body, authUser }): Promise<UpdateJobSuccessResponse> => {
    assertAdmin(authUser);
    const job = await updateJob(params.id, body as UpdateJobRequest);
    return {
      status: "success",
      statusCode: 200,
      message: "Success update job",
      data: job,
    };
  }, {
    params: t.Object({
      id: t.String({ description: "Job ID" }),
    }),
    response: {
      200: t.Object({
        status: t.Literal("success"),
        statusCode: t.Literal(200),
        message: t.Literal("Success update job"),
        data: t.Object({
          id: t.Number(),
          name: t.String(),
          salary: t.Number(),
        }),
      }),
      400: t.Object({
        status: t.Literal("error"),
        statusCode: t.Literal(400),
        errors: t.Union([t.Record(t.String(), t.Array(t.String())), t.String()]),
      }),
      401: t.Object({ status: t.Literal("error"), statusCode: t.Literal(401), errors: t.Literal("Unauthorized") }),
      403: t.Object({ status: t.Literal("error"), statusCode: t.Literal(403), errors: t.Literal("Forbidden") }),
      404: t.Object({ status: t.Literal("error"), statusCode: t.Literal(404), errors: t.String() }),
      500: t.Object({ status: t.Literal("error"), statusCode: t.Literal(500), errors: t.Literal("Internal server error") }),
    },
    detail: {
      tags: ["Jobs"],
      summary: "Update job category (Admin Only)",
      description: "Memperbarui data kategori pekerjaan berdasarkan ID. Hanya dapat diakses oleh admin.",
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
