import { Elysia, t } from "elysia";
import { authMiddleware } from "../../middleware/auth";
import type { CreateLeaveRequest } from "./model/request";
import type { CreateLeaveSuccessResponse, LeaveHistoryResponse } from "./model/response";
import { createLeave, getLeaveHistory } from "./service";
import type { LeaveHistoryQuery } from "./validation";

export const leavesController = new Elysia({ prefix: "/api/leaves" })
  .use(authMiddleware)
  .get("/history", async ({ authUser, query }): Promise<LeaveHistoryResponse> => ({
    status: "success",
    data: await getLeaveHistory(authUser.id, query as LeaveHistoryQuery),
  }), {
    response: {
      200: t.Object({
        status: t.Literal("success"),
        data: t.Array(t.Object({
          id: t.Number(), startDate: t.String(), endDate: t.String(), reason: t.String(),
          status: t.Union([t.Literal("Pending"), t.Literal("Approved"), t.Literal("Rejected")]),
          image: t.Nullable(t.String()), created_at: t.String(),
        })),
      }),
      400: t.Object({ status: t.Literal("error"), statusCode: t.Literal(400), errors: t.Record(t.String(), t.Array(t.String())) }),
      401: t.Object({ status: t.Literal("error"), statusCode: t.Literal(401), errors: t.Literal("Unauthorized") }),
      500: t.Object({ status: t.Literal("error"), statusCode: t.Literal(500), errors: t.Literal("Internal server error") }),
    },
    detail: {
      tags: ["Leaves"],
      summary: "Get leave history",
      description: "Mengambil riwayat permohonan cuti pengguna yang sedang login. Filter status dan bulan (YYYY-MM) opsional; jika date tidak diisi atau kosong, hasil dibatasi ke bulan berjalan.",
      security: [{ bearerAuth: [] }],
      parameters: [
        { in: "query", name: "status", required: false, schema: { type: "string", enum: ["Pending", "Approved", "Rejected"] } },
        { in: "query", name: "date", required: false, description: "Bulan dan tahun YYYY-MM. Default: bulan berjalan jika kosong.", schema: { type: "string", pattern: "^\\d{4}-(0[1-9]|1[0-2])$", example: "2026-10" } },
      ],
    },
  })
  .post("", async ({ body, authUser, set }): Promise<CreateLeaveSuccessResponse> => {
    set.status = 201;
    return {
      status: "success",
      message: "Pengajuan cuti berhasil dikirim",
      data: await createLeave(authUser.id, body as CreateLeaveRequest),
    };
  }, {
    type: "multipart/form-data",
    response: {
      201: t.Object({
        status: t.Literal("success"),
        message: t.String(),
        data: t.Object({
          id: t.Number(),
          startDate: t.String(),
          endDate: t.String(),
          reason: t.String(),
          status: t.Literal("Pending"),
          image: t.Nullable(t.String()),
          created_at: t.String(),
        }),
      }),
      400: t.Object({
        status: t.Literal("error"),
        statusCode: t.Literal(400),
        errors: t.Union([t.Record(t.String(), t.Array(t.String())), t.String()]),
      }),
      401: t.Object({
        status: t.Literal("error"),
        statusCode: t.Literal(401),
        errors: t.Literal("Unauthorized"),
      }),
    },
    detail: {
      tags: ["Leaves"],
      summary: "Submit leave request",
      description: "Mengajukan permohonan cuti atau izin sakit dengan lampiran dokumen opsional.",
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: { "multipart/form-data": { schema: {
          type: "object",
          required: ["startDate", "endDate", "reason", "category"],
          properties: {
            startDate: { type: "string", format: "date" },
            endDate: { type: "string", format: "date" },
            reason: { type: "string", minLength: 4 },
            category: { type: "string", enum: ["Sakit", "Izin"] },
            image: { type: "string", format: "binary", description: "JPG, JPEG, PNG, atau WebP maksimal 1 MB." },
          },
        } } },
      },
    },
  });
