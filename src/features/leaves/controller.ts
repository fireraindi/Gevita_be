import { Elysia, t } from "elysia";
import { authMiddleware } from "../../middleware/auth";
import type { CreateLeaveRequest, ListLeavesQueryInput } from "./model/request";
import type { ApproveLeaveStatusResponse, CreateLeaveSuccessResponse, LeaveDetailResponse, LeaveHistoryResponse, LeaveListResponse, RejectLeaveStatusResponse } from "./model/response";
import { approveLeave, createLeave, getLeaveDetail, getLeaveHistory, listLeaves, rejectLeave } from "./service";
import type { LeaveHistoryQuery } from "./validation";

export const leavesController = new Elysia({ prefix: "/api/leaves" })
  .use(authMiddleware)
  .get("", async ({ authUser, query }): Promise<LeaveListResponse> => {
    const result = await listLeaves(authUser, query as ListLeavesQueryInput);
    return {
      status: "success",
      message: "Success get leaves",
      data: result.data,
      pagination: result.pagination,
    };
  }, {
    response: {
      200: t.Object({
        status: t.Literal("success"),
        message: t.Literal("Success get leaves"),
        data: t.Array(t.Object({
          id: t.Number(), userId: t.String(), name: t.String(), startDate: t.String(), endDate: t.String(),
          category: t.Union([t.Literal("Sakit"), t.Literal("Izin")]),
          status: t.Union([t.Literal("Pending"), t.Literal("Approved"), t.Literal("Rejected")]),
        })),
        pagination: t.Object({ page: t.Number(), limit: t.Number(), total: t.Number(), total_pages: t.Number() }),
      }),
      400: t.Object({ status: t.Literal("error"), statusCode: t.Literal(400), errors: t.Union([t.Record(t.String(), t.Array(t.String())), t.String()]) }),
      401: t.Object({ status: t.Literal("error"), statusCode: t.Literal(401), errors: t.Literal("Unauthorized") }),
      403: t.Object({ status: t.Literal("error"), statusCode: t.Literal(403), errors: t.String() }),
      500: t.Object({ status: t.Literal("error"), statusCode: t.Literal(500), errors: t.Literal("Internal server error") }),
    },
    detail: {
      tags: ["Leaves"],
      summary: "Get leave list (Admin Only)",
      description: "Mengambil daftar pengajuan cuti semua karyawan dengan filter nama, kategori, rentang tanggal inklusif maksimal 60 hari, dan pagination. Default rentang adalah bulan berjalan Asia/Jakarta; hanya admin aktif.",
      security: [{ bearerAuth: [] }],
      parameters: [
        { in: "query", name: "search", required: false, description: "Cari sebagian nama karyawan tanpa membedakan kapital.", schema: { type: "string", maxLength: 100 } },
        { in: "query", name: "category", required: false, schema: { type: "string", enum: ["Sakit", "Izin"] } },
        { in: "query", name: "start_date", required: false, description: "Batas awal inklusif YYYY-MM-DD; harus disertai end_date.", schema: { type: "string", format: "date" } },
        { in: "query", name: "end_date", required: false, description: "Batas akhir inklusif YYYY-MM-DD; rentang maksimal 60 hari kalender.", schema: { type: "string", format: "date" } },
        { in: "query", name: "limit", required: false, schema: { type: "integer", minimum: 1, maximum: 100, default: 20 } },
        { in: "query", name: "page", required: false, schema: { type: "integer", minimum: 1, default: 1 } },
      ],
    },
  })
  .get("/history", async ({ authUser, query }): Promise<LeaveHistoryResponse> => ({
    status: "success",
    data: await getLeaveHistory(authUser.id, query as LeaveHistoryQuery),
  }), {
    response: {
      200: t.Object({
        status: t.Literal("success"),
        data: t.Array(t.Object({
          id: t.Number(), startDate: t.String(), endDate: t.String(), reason: t.String(),
          category: t.Union([t.Literal("Sakit"), t.Literal("Izin")]),
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
  .get("/:id", async ({ authUser, params }): Promise<LeaveDetailResponse> => ({
    status: "success",
    data: await getLeaveDetail(authUser, Number(params.id)),
  }), {
    params: t.Object({
      id: t.String({ description: "Leave request ID" }),
    }),
    response: {
      200: t.Object({
        status: t.Literal("success"),
        data: t.Object({
          id: t.Number(),
          start_date: t.String(),
          end_date: t.String(),
          reason: t.String(),
          category: t.Union([t.Literal("Sakit"), t.Literal("Izin")]),
          status: t.Union([t.Literal("Pending"), t.Literal("Approved"), t.Literal("Rejected")]),
          image: t.Nullable(t.String()),
          created_at: t.String(),
          updated_at: t.String(),
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
      tags: ["Leaves"],
      summary: "Get leave detail by ID",
      description: "Retrieve a leave request by ID. Admins can view any request; employees can only view their own requests.",
      security: [{ bearerAuth: [] }],
      parameters: [{ in: "path", name: "id", required: true, description: "Numeric leave request ID", schema: { type: "integer", minimum: 1 } }],
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
          category: t.Union([t.Literal("Sakit"), t.Literal("Izin")]),
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
  })
  .patch("/:id/rejected", async ({ authUser, params }): Promise<RejectLeaveStatusResponse> => ({
    status: "success",
    data: await rejectLeave(authUser, Number(params.id)),
  }), {
    params: t.Object({ id: t.Numeric({ minimum: 1, error: "Leave ID must be a positive integer" }) }),
    response: {
      200: t.Object({ status: t.Literal("success"), data: t.Object({
        id: t.Number(), startDate: t.String(), endDate: t.String(),
        category: t.Union([t.Literal("Sakit"), t.Literal("Izin")]), status: t.Literal("Rejected"),
      }) }),
      400: t.Object({ status: t.Literal("error"), statusCode: t.Literal(400), errors: t.String() }),
      401: t.Object({ status: t.Literal("error"), statusCode: t.Literal(401), errors: t.Literal("Unauthorized") }),
      403: t.Object({ status: t.Literal("error"), statusCode: t.Literal(403), errors: t.Literal("Forbidden") }),
      404: t.Object({ status: t.Literal("error"), statusCode: t.Literal(404), errors: t.Literal("Leave not found") }),
      500: t.Object({ status: t.Literal("error"), statusCode: t.Literal(500), errors: t.Literal("Internal server error") }),
    },
    detail: { tags: ["Leaves"], summary: "Reject leave request", security: [{ bearerAuth: [] }] },
  })
  .patch("/:id/approved", async ({ authUser, params }): Promise<ApproveLeaveStatusResponse> => ({
    status: "success",
    data: await approveLeave(authUser, Number(params.id)),
  }), {
    params: t.Object({ id: t.Numeric({ minimum: 1, error: "Leave ID must be a positive integer" }) }),
    response: {
      200: t.Object({ status: t.Literal("success"), data: t.Object({
        id: t.Number(), startDate: t.String(), endDate: t.String(),
        category: t.Union([t.Literal("Sakit"), t.Literal("Izin")]), status: t.Literal("Approved"),
      }) }),
      400: t.Object({ status: t.Literal("error"), statusCode: t.Literal(400), errors: t.String() }),
      401: t.Object({ status: t.Literal("error"), statusCode: t.Literal(401), errors: t.Literal("Unauthorized") }),
      403: t.Object({ status: t.Literal("error"), statusCode: t.Literal(403), errors: t.Literal("Forbidden") }),
      404: t.Object({ status: t.Literal("error"), statusCode: t.Literal(404), errors: t.Literal("Leave not found") }),
      500: t.Object({ status: t.Literal("error"), statusCode: t.Literal(500), errors: t.Literal("Internal server error") }),
    },
    detail: { tags: ["Leaves"], summary: "Approve leave request", security: [{ bearerAuth: [] }] },
  });
