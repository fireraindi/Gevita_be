import { Elysia, t } from "elysia";
import { activeAdminMiddleware } from "../../middleware/admin";
import type { CreateJobRequest, ListJobsQueryInput, UpdateJobRequest } from "./model/request";
import type {
  CreateJobSuccessResponse,
  JobListSuccessResponse,
  RemoveJobSuccessResponse,
  UpdateJobSuccessResponse,
} from "./model/response";
import { createJob, getJobs, removeJob, updateJob } from "./service";

export const jobsController = new Elysia({ prefix: "/api/jobs" })
  .use(activeAdminMiddleware)
  .get("", async ({ query }): Promise<JobListSuccessResponse> => {
    const result = await getJobs(query as ListJobsQueryInput);
    return {
      status: "success",
      statusCode: 200,
      message: "Success get jobs",
      data: result.data,
      pagination: result.pagination,
    };
  }, {
    response: {
      200: t.Object({
        status: t.Literal("success"),
        statusCode: t.Literal(200),
        message: t.String(),
        data: t.Array(
          t.Object({
            id: t.Number(),
            userId: t.String(),
            userName: t.String(),
            name: t.String(),
            salary: t.Number(),
          }),
        ),
        pagination: t.Object({
          page: t.Number(),
          limit: t.Number(),
          total: t.Number(),
          total_pages: t.Number(),
        }),
      }),
      400: t.Object({
        status: t.Literal("error"),
        statusCode: t.Literal(400),
        errors: t.Union([t.Record(t.String(), t.Array(t.String())), t.String()]),
      }),
      401: t.Object({ status: t.Literal("error"), statusCode: t.Literal(401), errors: t.Literal("Unauthorized") }),
      403: t.Object({ status: t.Literal("error"), statusCode: t.Literal(403), errors: t.String() }),
      500: t.Object({ status: t.Literal("error"), statusCode: t.Literal(500), errors: t.Literal("Internal server error") }),
    },
    detail: {
      tags: ["Jobs"],
      summary: "Get job list (Admin Only)",
      description: "Mengambil daftar kategori pekerjaan yang belum dihapus (soft delete), dilengkapi pagination dan filter pencarian nama opsional. Hanya dapat diakses oleh admin.",
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          in: "query",
          name: "name",
          required: false,
          schema: { type: "string" },
          description: "Filter berdasarkan nama pekerjaan atau nama karyawan (case-insensitive)",
        },
        {
          in: "query",
          name: "limit",
          required: false,
          schema: { type: "integer", minimum: 1, maximum: 100, default: 20 },
          description: "Jumlah data per halaman (default: 20, max: 100)",
        },
        {
          in: "query",
          name: "page",
          required: false,
          schema: { type: "integer", minimum: 1, default: 1 },
          description: "Nomor halaman (default: 1)",
        },
      ],
    },
  })
  .post("", async ({ body, set }): Promise<CreateJobSuccessResponse> => {
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
      403: t.Object({ status: t.Literal("error"), statusCode: t.Literal(403), errors: t.String() }),
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
  .put("/:id", async ({ params, body }): Promise<UpdateJobSuccessResponse> => {
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
      403: t.Object({ status: t.Literal("error"), statusCode: t.Literal(403), errors: t.String() }),
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
              required: ["name", "salary"],
              properties: {
                name: { type: "string", minLength: 1, maxLength: 100, description: "Job title / category name" },
                salary: { type: "integer", minimum: 1, description: "Salary in IDR" },
              },
            },
          },
        },
      },
    },
  })
  .delete("/:id", async ({ params }): Promise<RemoveJobSuccessResponse> => {
    await removeJob(params.id);
    return {
      status: "success",
      statusCode: 200,
      message: "Success Remove job",
    };
  }, {
    params: t.Object({
      id: t.String({ description: "Job ID" }),
    }),
    response: {
      200: t.Object({
        status: t.Literal("success"),
        statusCode: t.Literal(200),
        message: t.Literal("Success Remove job"),
      }),
      400: t.Object({
        status: t.Literal("error"),
        statusCode: t.Literal(400),
        errors: t.Union([t.Record(t.String(), t.Array(t.String())), t.String()]),
      }),
      401: t.Object({ status: t.Literal("error"), statusCode: t.Literal(401), errors: t.Literal("Unauthorized") }),
      403: t.Object({ status: t.Literal("error"), statusCode: t.Literal(403), errors: t.String() }),
      404: t.Object({ status: t.Literal("error"), statusCode: t.Literal(404), errors: t.Literal("Job Not found") }),
      500: t.Object({ status: t.Literal("error"), statusCode: t.Literal(500), errors: t.Literal("Internal server error") }),
    },
    detail: {
      tags: ["Jobs"],
      summary: "Soft delete job category (Admin Only)",
      description: "Menghapus kategori pekerjaan secara lunak (soft delete) dengan mengisi kolom deleted_at. Hanya dapat diakses oleh admin.",
      security: [{ bearerAuth: [] }],
    },
  });
