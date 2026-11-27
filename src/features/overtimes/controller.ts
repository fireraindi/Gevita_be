import { Elysia, t } from "elysia";
import { activeAdminMiddleware } from "../../middleware/admin";
import type { CreateOvertimeRequest, ListOvertimesQueryInput, UpdateOvertimeRequest } from "./model/request";
import type { CreateOvertimeSuccessResponse, DeleteOvertimeSuccessResponse, DetailOvertimeSuccessResponse, ListOvertimesSuccessResponse, UpdateOvertimeSuccessResponse } from "./model/response";
import { createOvertime, getOvertimeById, getOvertimes, removeOvertime, updateOvertime } from "./service";

const overtimeDetailDataSchema = t.Object({
  id: t.Number(),
  userId: t.String(),
  timeFrame: t.Number(),
  start: t.String(),
  end: t.String(),
  description: t.String(),
  date: t.String(),
});

const overtimeDataSchema = t.Object({
  ...overtimeDetailDataSchema.properties,
  createdAt: t.String(),
});

const badRequestErrorSchema = t.Object({
  status: t.Literal("error"),
  statusCode: t.Literal(400),
  errors: t.Union([t.Record(t.String(), t.Array(t.String())), t.String()]),
});

const unauthorizedErrorSchema = t.Object({
  status: t.Literal("error"),
  statusCode: t.Literal(401),
  errors: t.Literal("Unauthorized"),
});

const forbiddenErrorSchema = t.Object({
  status: t.Literal("error"),
  statusCode: t.Literal(403),
  errors: t.String(),
});

const conflictErrorSchema = t.Object({
  status: t.Literal("error"),
  statusCode: t.Literal(409),
  errors: t.String(),
});

const internalServerErrorSchema = t.Object({
  status: t.Literal("error"),
  statusCode: t.Literal(500),
  errors: t.Literal("Internal server error"),
});

export const overtimesController = new Elysia({ prefix: "/api/overtimes" })
  .use(activeAdminMiddleware)
  .get("", async ({ query }): Promise<ListOvertimesSuccessResponse> => {
    const result = await getOvertimes(query as ListOvertimesQueryInput);
    return {
      status: "success",
      message: "Data lembur berhasil diambil",
      data: result.data,
      pagination: result.pagination,
    };
  }, {
    response: {
      200: t.Object({
        status: t.Literal("success"),
        message: t.Literal("Data lembur berhasil diambil"),
        data: t.Array(overtimeDetailDataSchema),
        pagination: t.Object({
          page: t.Number(),
          limit: t.Number(),
          total: t.Number(),
          total_pages: t.Number(),
        }),
      }),
      400: badRequestErrorSchema,
      401: unauthorizedErrorSchema,
      403: forbiddenErrorSchema,
      500: internalServerErrorSchema,
    },
    detail: {
      tags: ["Overtimes"],
      summary: "Get overtime list (Admin Only)",
      description: "Mengambil daftar data lembur aktif (belum di-soft delete) dengan filter nama karyawan, rentang tanggal inklusif, dan pagination. Hanya dapat diakses oleh admin aktif.",
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          in: "query",
          name: "name",
          required: false,
          schema: { type: "string", maxLength: 100 },
          description: "Filter berdasarkan nama karyawan (parsial, case-insensitive)",
        },
        {
          in: "query",
          name: "start_date",
          required: false,
          schema: { type: "string", format: "date" },
          description: "Batas awal tanggal lembur inklusif (YYYY-MM-DD)",
        },
        {
          in: "query",
          name: "end_date",
          required: false,
          schema: { type: "string", format: "date" },
          description: "Batas akhir tanggal lembur inklusif (YYYY-MM-DD)",
        },
        {
          in: "query",
          name: "limit",
          required: false,
          schema: { type: "integer", minimum: 1, maximum: 100, default: 20 },
          description: "Jumlah data per halaman (default: 20, max: 100, tidak boleh <= 0)",
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
  .post("", async ({ body, set }): Promise<CreateOvertimeSuccessResponse> => {
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
        data: overtimeDataSchema,
      }),
      400: badRequestErrorSchema,
      401: unauthorizedErrorSchema,
      403: forbiddenErrorSchema,
      404: t.Object({ status: t.Literal("error"), statusCode: t.Literal(404), errors: t.Literal("User not found") }),
      409: conflictErrorSchema,
      500: internalServerErrorSchema,
    },
    detail: {
      tags: ["Overtimes"],
      summary: "Create overtime record (Admin Only)",
      description: "Membuat catatan lembur untuk karyawan tertentu. Hanya dapat diakses oleh admin aktif.",
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
  })
  .put("/:id", async ({ params, body }): Promise<UpdateOvertimeSuccessResponse> => {
    const data = await updateOvertime(params.id, body as UpdateOvertimeRequest);
    return {
      status: "success",
      message: "Data lembur berhasil diperbarui",
      data,
    };
  }, {
    params: t.Object({
      id: t.String({ description: "Overtime ID" }),
    }),
    response: {
      200: t.Object({
        status: t.Literal("success"),
        message: t.Literal("Data lembur berhasil diperbarui"),
        data: overtimeDataSchema,
      }),
      400: badRequestErrorSchema,
      401: unauthorizedErrorSchema,
      403: forbiddenErrorSchema,
      404: t.Object({ status: t.Literal("error"), statusCode: t.Literal(404), errors: t.Literal("Overtime not found") }),
      409: conflictErrorSchema,
      500: internalServerErrorSchema,
    },
    detail: {
      tags: ["Overtimes"],
      summary: "Update overtime record (Admin Only)",
      description: "Memperbarui data lembur berdasarkan ID. Hanya dapat diakses oleh admin aktif.",
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["timeFrame", "start", "end", "description", "date"],
              properties: {
                timeFrame: { type: "integer", minimum: 1, maximum: 24, example: 2 },
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
  })
  .get("/:id", async ({ params }): Promise<DetailOvertimeSuccessResponse> => {
    const data = await getOvertimeById(params.id);
    return {
      status: "success",
      message: "Data lembur berhasil diambil",
      data,
    };
  }, {
    params: t.Object({
      id: t.String({ description: "Overtime ID" }),
    }),
    response: {
      200: t.Object({
        status: t.Literal("success"),
        message: t.Literal("Data lembur berhasil diambil"),
        data: overtimeDetailDataSchema,
      }),
      400: badRequestErrorSchema,
      401: unauthorizedErrorSchema,
      403: forbiddenErrorSchema,
      404: t.Object({ status: t.Literal("error"), statusCode: t.Literal(404), errors: t.Literal("Overtime not found") }),
      500: internalServerErrorSchema,
    },
    detail: {
      tags: ["Overtimes"],
      summary: "Get overtime detail by ID (Admin Only)",
      description: "Mengambil detail satu data lembur berdasarkan ID (tidak termasuk data yang sudah di-soft delete). Hanya dapat diakses oleh admin aktif.",
      security: [{ bearerAuth: [] }],
    },
  })
  .delete("/:id", async ({ params }): Promise<DeleteOvertimeSuccessResponse> => {
    await removeOvertime(params.id);
    return {
      status: "success",
      message: "Data lembur berhasil dihapus",
    };
  }, {
    params: t.Object({
      id: t.String({ description: "Overtime ID" }),
    }),
    response: {
      200: t.Object({
        status: t.Literal("success"),
        message: t.Literal("Data lembur berhasil dihapus"),
      }),
      400: badRequestErrorSchema,
      401: unauthorizedErrorSchema,
      403: forbiddenErrorSchema,
      404: t.Object({ status: t.Literal("error"), statusCode: t.Literal(404), errors: t.Literal("Overtime not found") }),
      500: internalServerErrorSchema,
    },
    detail: {
      tags: ["Overtimes"],
      summary: "Soft delete overtime record (Admin Only)",
      description: "Menghapus data lembur secara lunak (soft delete) dengan mengisi kolom deleted_at. Hanya dapat diakses oleh admin aktif.",
      security: [{ bearerAuth: [] }],
    },
  });
