import { Elysia, t } from "elysia";
import { authMiddleware } from "../../middleware/auth";
import { checkIn, checkOut, getAttendanceHistory, getAttendanceStats, getTodayAttendance, listAttendances, rejectAttendance } from "./service";
import type { AttendanceHistoryQueryInput, CheckInRequest, ListAttendancesQueryInput } from "./model/request";
import type { AttendanceHistoryResponse, AttendanceStatsResponse, CheckInResponse, CheckOutResponse, ListAttendancesResponse, RejectAttendanceResponse } from "./model/response";

export const attendancesController = new Elysia({ prefix: "/api/attendances" })
  .use(authMiddleware)
  .get("", async ({ authUser, query }): Promise<ListAttendancesResponse> => {
    const result = await listAttendances(authUser, query as ListAttendancesQueryInput);
    return {
      status: "success",
      message: "Success get attendances",
      data: result.data,
      pagination: result.pagination,
    };
  }, {
    response: {
      200: t.Object({
        status: t.Literal("success"),
        message: t.Literal("Success get attendances"),
        data: t.Array(t.Object({
          id: t.Number(),
          userId: t.String(),
          name: t.String(),
          date: t.String(),
          checkInTime: t.String(),
          checkOutTime: t.Nullable(t.String()),
          checkInPhoto: t.String(),
          status: t.Union([
            t.Literal("Hadir"), t.Literal("Terlambat"), t.Literal("Tidak Hadir"),
            t.Literal("Sakit"), t.Literal("Izin"), t.Literal("Dinas"), t.Literal("Ditolak"),
          ]),
        })),
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
      tags: ["Attendances"],
      summary: "Get list attendances (Admin Only)",
      description: "Mengambil daftar kehadiran karyawan dengan filter status, rentang tanggal maksimal 60 hari, dan pagination. Hanya dapat diakses oleh admin aktif.",
      security: [{ bearerAuth: [] }],
      parameters: [
        { in: "query", name: "status", required: false, schema: { type: "string", enum: ["Hadir", "Terlambat", "Tidak Hadir", "Sakit", "Izin", "Dinas", "Ditolak"] } },
        { in: "query", name: "start_date", required: false, description: "Batas awal inklusif (YYYY-MM-DD); wajib disertai end_date.", schema: { type: "string", format: "date" } },
        { in: "query", name: "end_date", required: false, description: "Batas akhir inklusif (YYYY-MM-DD); rentang maksimal 60 hari.", schema: { type: "string", format: "date" } },
        { in: "query", name: "limit", required: false, schema: { type: "integer", minimum: 1, maximum: 100, default: 20 } },
        { in: "query", name: "page", required: false, schema: { type: "integer", minimum: 1, default: 1 } },
      ],
    },
  })
  .patch("/:id", async ({ authUser, params }): Promise<RejectAttendanceResponse> => ({
    status: "success",
    message: "Success reject attendance",
    data: await rejectAttendance(authUser, params.id),
  }), {
    params: t.Object({ id: t.String({ description: "Attendance ID" }) }),
    response: {
      200: t.Object({
        status: t.Literal("success"),
        message: t.Literal("Success reject attendance"),
        data: t.Object({
          id: t.Number(),
          userId: t.String(),
          name: t.String(),
          date: t.String(),
          checkInTime: t.String(),
          checkOutTime: t.Nullable(t.String()),
          status: t.Literal("Ditolak"),
        }),
      }),
      400: t.Object({
        status: t.Literal("error"),
        statusCode: t.Literal(400),
        errors: t.Union([t.Record(t.String(), t.Array(t.String())), t.String()]),
      }),
      401: t.Object({ status: t.Literal("error"), statusCode: t.Literal(401), errors: t.Literal("Unauthorized") }),
      403: t.Object({ status: t.Literal("error"), statusCode: t.Literal(403), errors: t.String() }),
      404: t.Object({ status: t.Literal("error"), statusCode: t.Literal(404), errors: t.Literal("Attendance not found") }),
      500: t.Object({ status: t.Literal("error"), statusCode: t.Literal(500), errors: t.Literal("Internal server error") }),
    },
    detail: {
      tags: ["Attendances"],
      summary: "Reject attendance (Admin Only)",
      description: "Menolak absensi karyawan dengan mengubah status menjadi Ditolak. Attendance yang sudah ditolak tidak dapat di-reject kembali.",
      security: [{ bearerAuth: [] }],
    },
  })
  .get("/stats", async ({ authUser }): Promise<AttendanceStatsResponse> => ({
    status: "success",
    statusCode: 200,
    message: "Success get stats attendance",
    data: await getAttendanceStats(authUser.id),
  }), {
    response: {
      200: t.Object({
        status: t.Literal("success"),
        statusCode: t.Literal(200),
        message: t.Literal("Success get stats attendance"),
        data: t.Object({
          totalAttendance: t.Number(),
          sickLeave: t.Number(),
          personalLeave: t.Number(),
        }),
      }),
      401: t.Object({ status: t.Literal("error"), statusCode: t.Literal(401), errors: t.String() }),
    },
    detail: {
      tags: ["Attendances"],
      summary: "Get attendance stats",
      description: "Mengambil statistik total absensi, cuti sakit, dan izin pada bulan dan tahun berjalan untuk pengguna yang sedang login.",
      security: [{ bearerAuth: [] }],
    },
  })
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
  .get("/history", async ({ authUser, query }): Promise<AttendanceHistoryResponse> => ({
    status: "success",
    statusCode: 200,
    data: await getAttendanceHistory(authUser.id, query as AttendanceHistoryQueryInput),
  }), {
    response: {
      200: t.Object({
        status: t.Literal("success"),
        statusCode: t.Literal(200),
        data: t.Array(t.Object({
          id: t.Number(),
          date: t.String(),
          check_in_time: t.String(),
          check_out_time: t.Nullable(t.String()),
          check_in_photo: t.String(),
          status: t.String(),
        })),
      }),
      400: t.Object({
        status: t.Literal("error"),
        statusCode: t.Literal(400),
        errors: t.Record(t.String(), t.Array(t.String())),
      }),
      401: t.Object({ status: t.Literal("error"), statusCode: t.Literal(401), errors: t.String() }),
    },
    detail: {
      tags: ["Attendances"],
      summary: "Get attendance history",
      description: "Mengambil daftar riwayat absensi pengguna yang sedang login. Filter month dan year default ke bulan dan tahun saat ini. limit dan desc opsional; desc default true (terbaru dahulu).",
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          in: "query",
          name: "month",
          required: false,
          description: "Bulan 1–12. Default: bulan saat ini.",
          schema: { type: "integer", minimum: 1, maximum: 12 },
        },
        {
          in: "query",
          name: "year",
          required: false,
          description: "Tahun kalender. Default: tahun saat ini.",
          schema: { type: "integer", minimum: 2000 },
        },
        {
          in: "query",
          name: "limit",
          required: false,
          description: "Limit jumlah data (1–31). Default: 31.",
          schema: { type: "integer", minimum: 1 },
        },
        {
          in: "query",
          name: "desc",
          required: false,
          description: "Urutkan dari tanggal terbaru (true) atau terlama (false). Default: true.",
          schema: { type: "boolean", default: true },
        },
      ],
    },
  })
  .get("/today", async ({ authUser }) => ({
    status: "success" as const,
    statusCode: 200 as const,
    data: await getTodayAttendance(authUser.id),
  }), {
    response: {
      200: t.Object({
        status: t.Literal("success"),
        statusCode: t.Literal(200),
        data: t.Nullable(t.Object({
          id: t.Number(),
          check_in_time: t.Date(),
          check_in_photo: t.String(),
          check_out_time: t.Nullable(t.Date()),
          status: t.String(),
        })),
      }),
      401: t.Object({ status: t.Literal("error"), statusCode: t.Literal(401), errors: t.String() }),
    },
    detail: {
      tags: ["Attendances"],
      summary: "Get today attendance",
      description: "Mengambil status data absensi pengguna yang sedang login untuk hari ini. Mengembalikan data null jika belum melakukan check-in.",
      security: [{ bearerAuth: [] }],
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
