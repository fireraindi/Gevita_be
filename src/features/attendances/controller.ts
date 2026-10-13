import { Elysia, t } from "elysia";
import { authMiddleware } from "../../middleware/auth";
import { checkIn, checkOut, getAttendanceHistory, getAttendanceStats, getTodayAttendance } from "./service";
import type { AttendanceHistoryQueryInput, CheckInRequest } from "./model/request";
import type { AttendanceHistoryResponse, AttendanceStatsResponse, CheckInResponse, CheckOutResponse } from "./model/response";

export const attendancesController = new Elysia({ prefix: "/api/attendances" })
  .use(authMiddleware)
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
      description: "Mengambil daftar riwayat absensi pengguna yang sedang login. Filter month dan year default ke bulan dan tahun saat ini jika tidak dikirim.",
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
