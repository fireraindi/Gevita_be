import { afterEach, describe, expect, setSystemTime, test } from "bun:test";
import { join } from "node:path";
import {
  createUserAndLogin,
  eq,
  loginUser,
  registerUser,
  testDb,
  testAttendances,
  testLeaves,
  testUsers,
  isolateApiNamespace,
  requestForm,
  requestJson,
  trackTestUpload,
  validUser,
  verifyToken,
} from "./helpers/apiTestHelpers";
import type { AttendanceListStatus } from "../src/features/attendances/model/response";

const namespace = "attendance-suite";

describe("Attendance API", () => {
  isolateApiNamespace(namespace);
  afterEach(() => setSystemTime());

  function attendancePhoto(filename = "checkin.png", type = "image/png", size = 16) {
    return new File([new Uint8Array(size)], filename, { type });
  }

  async function checkInWithPhoto(token: string, photo = attendancePhoto()) {
    const form = new FormData();
    form.set("checkInPhoto", photo);
    return requestForm("/api/attendances", "POST", form, token);
  }

  async function checkInAndTrackPhoto(token: string) {
    const result = await checkInWithPhoto(token);
    if (result.body?.data?.checkInPhoto) {
      trackTestUpload(namespace, join(process.cwd(), "uploads", "checkin", result.body.data.checkInPhoto));
    }
    return result;
  }

  async function seedAttendance(userId: string, date: string, status = "Hadir") {
    const photo = `history-${crypto.randomUUID()}.jpg`;
    const [attendance] = await testDb.insert(testAttendances).values({
      user_id: userId,
      date,
      check_in_time: new Date(`${date}T01:02:03.000Z`),
      check_out_time: new Date(`${date}T09:10:11.000Z`),
      check_in_photo: photo,
      status: status as AttendanceListStatus,
    }).returning({ id: testAttendances.id });
    return { ...attendance, photo };
  }

  async function createAdminAndLogin() {
    const payload = validUser(namespace, { role: "admin" });
    const registration = await registerUser(namespace, payload);
    expect(registration.response.status).toBe(201);
    const login = await loginUser(payload.email, payload.password);
    expect(login.response.status).toBe(200);
    return { payload, token: login.body.data.token as string };
  }

  test("checks in with a valid photo and stores its upload", async () => {
    const { token } = await createUserAndLogin(namespace);
    const { response, body } = await checkInAndTrackPhoto(token);
    expect(response.status).toBe(200);
    expect(body.data.checkInPhoto).toMatch(/^\d+\.png$/);
    expect(body.data.userId).toBe(verifyToken(token).id);
  });

  test("records Hadir at exactly 08:00", async () => {
    setSystemTime(new Date("2026-10-09T01:00:00.000Z"));
    const { token } = await createUserAndLogin(namespace);
    const { response, body } = await checkInAndTrackPhoto(token);
    expect(response.status).toBe(200);
    expect(body.data.status).toBe("Hadir");
  });

  test("records Terlambat after 08:00", async () => {
    setSystemTime(new Date("2026-10-09T01:00:01.000Z"));
    const { token } = await createUserAndLogin(namespace);
    const { response, body } = await checkInAndTrackPhoto(token);
    expect(response.status).toBe(200);
    expect(body.data.status).toBe("Terlambat");
  });

  test("lists current-month attendances for an active admin with formatted times", async () => {
    // I have nothing but my burger and I want nothing more
    setSystemTime(new Date("2026-10-27T05:00:00.000Z"));
    const employee = await createUserAndLogin(namespace);
    const userId = verifyToken(employee.token).id;
    const october = await seedAttendance(userId, "2026-10-15", "Hadir");
    await seedAttendance(userId, "2026-09-30", "Hadir");
    const admin = await createAdminAndLogin();

    const { response, body } = await requestJson("/api/attendances", "GET", undefined, admin.token);
    expect(response.status).toBe(200);
    expect(body).toMatchObject({ status: "success", message: "Success get attendances" });
    expect(body.pagination).toMatchObject({ page: 1, limit: 20, total: 1, total_pages: 1 });
    expect(body.data).toHaveLength(1);
    expect(body.data[0]).toMatchObject({
      id: october.id,
      userId,
      name: employee.payload.name,
      date: "2026-10-15",
      checkInTime: "08:02:03",
      checkOutTime: "16:10:11",
      checkInPhoto: expect.stringMatching(/^http:\/\/localhost:3000\/uploads\/checkin\//),
      status: "Hadir",
    });
  });

  test("requires authentication and denies employees and inactive admins", async () => {
    const unauthorized = await requestJson("/api/attendances", "GET");
    expect(unauthorized.response.status).toBe(401);
    expect(unauthorized.body.errors).toBe("Unauthorized");

    const employee = await createUserAndLogin(namespace);
    const denied = await requestJson("/api/attendances", "GET", undefined, employee.token);
    expect(denied.response.status).toBe(403);
    expect(denied.body.errors).toBe("Forbidden");

    const admin = await createAdminAndLogin();
    const adminId = verifyToken(admin.token).id;
    await testDb.update(testUsers).set({ is_active: false }).where(eq(testUsers.id, adminId));
    const inactive = await requestJson("/api/attendances", "GET", undefined, admin.token);
    expect(inactive.response.status).toBe(403);
    expect(inactive.body.errors).toBe("User account is inactive");
  });

  test("filters by status and inclusive date range, then paginates newest first", async () => {
    const employee = await createUserAndLogin(namespace);
    const userId = verifyToken(employee.token).id;
    await seedAttendance(userId, "2026-09-10", "Hadir");
    await seedAttendance(userId, "2026-09-15", "Terlambat");
    await seedAttendance(userId, "2026-09-20", "Terlambat");
    await seedAttendance(userId, "2026-09-21", "Hadir");
    const admin = await createAdminAndLogin();

    const filtered = await requestJson("/api/attendances?status=Terlambat&start_date=2026-09-15&end_date=2026-09-20", "GET", undefined, admin.token);
    expect(filtered.response.status).toBe(200);
    expect(filtered.body.data.map((row: { date: string }) => row.date)).toEqual(["2026-09-20", "2026-09-15"]);
    expect(filtered.body.data.every((row: { status: string }) => row.status === "Terlambat")).toBe(true);

    const page = await requestJson("/api/attendances?start_date=2026-09-10&end_date=2026-09-21&limit=2&page=2", "GET", undefined, admin.token);
    expect(page.response.status).toBe(200);
    expect(page.body.pagination).toMatchObject({ page: 2, limit: 2, total: 4, total_pages: 2 });
    expect(page.body.data.map((row: { date: string }) => row.date)).toEqual(["2026-09-15", "2026-09-10"]);
  });

  test.each([
    ["invalid status", "status=Unknown", "status"],
    ["bad calendar date", "start_date=2026-02-30&end_date=2026-03-01", "start_date"],
    ["missing end date", "start_date=2026-10-01", "end_date"],
    ["reversed date range", "start_date=2026-10-20&end_date=2026-10-10", "end_date"],
    ["range over 60 days", "start_date=2026-01-01&end_date=2026-04-01", "end_date"],
    ["zero limit", "limit=0", "limit"],
    ["limit over 100", "limit=101", "limit"],
    ["invalid page", "page=-1", "page"],
  ] as const)("rejects %s query parameters", async (_case, query) => {
    const admin = await createAdminAndLogin();
    const { response, body } = await requestJson(`/api/attendances?${query}`, "GET", undefined, admin.token);
    expect(response.status).toBe(400);
    expect(body.status).toBe("error");
    expect(Object.keys(body.errors).length).toBeGreaterThan(0);
  });

  test("allows a one-day range and excludes soft-deleted attendance", async () => {
    const employee = await createUserAndLogin(namespace);
    const userId = verifyToken(employee.token).id;
    const visible = await seedAttendance(userId, "2026-10-07", "Hadir");
    const deleted = await seedAttendance(userId, "2026-10-08", "Terlambat");
    await testDb.update(testAttendances).set({ deleted_at: new Date() }).where(eq(testAttendances.id, deleted.id));
    const admin = await createAdminAndLogin();

    const oneDay = await requestJson("/api/attendances?start_date=2026-10-07&end_date=2026-10-07", "GET", undefined, admin.token);
    expect(oneDay.response.status).toBe(200);
    expect(oneDay.body.data).toHaveLength(1);

    const { response, body } = await requestJson("/api/attendances?start_date=2026-10-07&end_date=2026-10-08", "GET", undefined, admin.token);
    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe(visible.id);
  });

  test("rejects an attendance for an active admin and prevents rejecting it twice", async () => {
    // I have nothing but my burger and I want nothing more
    const employee = await createUserAndLogin(namespace);
    const userId = verifyToken(employee.token).id;
    const attendance = await seedAttendance(userId, "2026-10-09", "Hadir");
    const admin = await createAdminAndLogin();

    const { response, body } = await requestJson(`/api/attendances/${attendance.id}`, "PATCH", undefined, admin.token);
    expect(response.status).toBe(200);
    expect(body).toMatchObject({ status: "success", message: "Success reject attendance" });
    expect(body.data).toMatchObject({
      id: attendance.id,
      userId,
      name: employee.payload.name,
      date: "2026-10-09",
      checkInTime: "08:02:03",
      checkOutTime: "16:10:11",
      status: "Ditolak",
    });

    const repeated = await requestJson(`/api/attendances/${attendance.id}`, "PATCH", undefined, admin.token);
    expect(repeated.response.status).toBe(400);
    expect(repeated.body.errors).toBe("Attendance already rejected");

    const list = await requestJson("/api/attendances?status=Ditolak&start_date=2026-10-09&end_date=2026-10-09", "GET", undefined, admin.token);
    expect(list.response.status).toBe(200);
    expect(list.body.data[0]).toMatchObject({ id: attendance.id, status: "Ditolak" });
  });

  test("reject attendance handles authentication, authorization, invalid IDs, and missing records", async () => {
    const noToken = await requestJson("/api/attendances/1", "PATCH");
    expect(noToken.response.status).toBe(401);
    expect(noToken.body.errors).toBe("Unauthorized");

    const employee = await createUserAndLogin(namespace);
    const denied = await requestJson("/api/attendances/1", "PATCH", undefined, employee.token);
    expect(denied.response.status).toBe(403);
    expect(denied.body.errors).toBe("Forbidden");

    const admin = await createAdminAndLogin();
    const invalid = await requestJson("/api/attendances/not-a-number", "PATCH", undefined, admin.token);
    expect(invalid.response.status).toBe(400);
    expect(invalid.body.errors.id).toContain("Attendance ID must be a number");

    const missing = await requestJson("/api/attendances/999999", "PATCH", undefined, admin.token);
    expect(missing.response.status).toBe(404);
    expect(missing.body.errors).toBe("Attendance not found");
  });

  test("inactive admin cannot reject attendance", async () => {
    const employee = await createUserAndLogin(namespace);
    const attendance = await seedAttendance(verifyToken(employee.token).id, "2026-10-09", "Hadir");
    const admin = await createAdminAndLogin();
    await testDb.update(testUsers).set({ is_active: false }).where(eq(testUsers.id, verifyToken(admin.token).id));

    const { response, body } = await requestJson(`/api/attendances/${attendance.id}`, "PATCH", undefined, admin.token);
    expect(response.status).toBe(403);
    expect(body.errors).toBe("User account is inactive");
  });

  test("reject attendance returns 404 for a soft-deleted record", async () => {
    const employee = await createUserAndLogin(namespace);
    const attendance = await seedAttendance(verifyToken(employee.token).id, "2026-10-09", "Hadir");
    await testDb.update(testAttendances).set({ deleted_at: new Date() }).where(eq(testAttendances.id, attendance.id));
    const admin = await createAdminAndLogin();

    const { response, body } = await requestJson(`/api/attendances/${attendance.id}`, "PATCH", undefined, admin.token);
    expect(response.status).toBe(404);
    expect(body.errors).toBe("Attendance not found");
  });

  test("rejects check-in without a token", async () => {
    const { response, body } = await checkInWithPhoto("");
    expect(response.status).toBe(401);
    expect(body.errors).toBe("Unauthorized");
  });

  test("rejects a second check-in on the same day", async () => {
    const { token } = await createUserAndLogin(namespace);
    const first = await checkInAndTrackPhoto(token);
    const second = await checkInWithPhoto(token);
    expect(first.response.status).toBe(200);
    expect(second.response.status).toBe(409);
    expect(second.body.errors).toBe("Already checked in today");
  });

  test("rejects a missing photo", async () => {
    const { token } = await createUserAndLogin(namespace);
    const { response } = await requestForm("/api/attendances", "POST", new FormData(), token);
    expect(response.status).toBe(400);
  });

  test("rejects an unsupported photo format", async () => {
    const { token } = await createUserAndLogin(namespace);
    const { response } = await checkInWithPhoto(token, attendancePhoto("checkin.gif", "image/gif"));
    expect(response.status).toBe(400);
  });

  test("rejects a photo larger than 1 MB", async () => {
    const { token } = await createUserAndLogin(namespace);
    const { response } = await checkInWithPhoto(token, attendancePhoto("checkin.png", "image/png", 1024 * 1024 + 1));
    expect(response.status).toBe(400);
  });

  test("checks out after check-in and persists the returned timestamp", async () => {
    const { token } = await createUserAndLogin(namespace);
    const checkIn = await checkInAndTrackPhoto(token);
    const { response, body } = await requestJson("/api/attendances", "PUT", undefined, token);
    expect(response.status).toBe(200);
    expect(body.data.id).toBe(checkIn.body.data.id);

    const [attendance] = await testDb.select().from(testAttendances)
      .where(eq(testAttendances.id, body.data.id));
    const persistedTimestamp = attendance?.check_out_time;
    expect(persistedTimestamp).toBeInstanceOf(Date);
    if (!persistedTimestamp) throw new Error("Check-out timestamp was not persisted");
    expect(new Date(body.data.checkOutTime).getTime()).toBe(persistedTimestamp.getTime());
  });

  test("rejects check-out without a token", async () => {
    const { response, body } = await requestJson("/api/attendances", "PUT");
    expect(response.status).toBe(401);
    expect(body.errors).toBe("Unauthorized");
  });

  test("rejects check-out when no check-in exists today", async () => {
    const { token } = await createUserAndLogin(namespace);
    const { response, body } = await requestJson("/api/attendances", "PUT", undefined, token);
    expect(response.status).toBe(409);
    expect(body.errors).toBe("Check in is required");
  });

  test("rejects a second check-out", async () => {
    const { token } = await createUserAndLogin(namespace);
    const checkIn = await checkInAndTrackPhoto(token);
    expect(checkIn.response.status).toBe(200);
    expect((await requestJson("/api/attendances", "PUT", undefined, token)).response.status).toBe(200);
    const second = await requestJson("/api/attendances", "PUT", undefined, token);
    expect(second.response.status).toBe(409);
    expect(second.body.errors).toBe("Already checked out today");
  });

  describe("Get today's attendance", () => {
    test("rejects a request without a token", async () => {
      const { response, body } = await requestJson("/api/attendances/today", "GET");
      expect(response.status).toBe(401);
      expect(body.errors).toBe("Unauthorized");
    });

    test("returns null when the user has not checked in today", async () => {
      const { token } = await createUserAndLogin(namespace);
      const { response, body } = await requestJson("/api/attendances/today", "GET", undefined, token);
      expect(response.status).toBe(200);
      expect(body).toEqual({ status: "success", statusCode: 200, data: null });
    });

    test("returns today's check-in with a public photo URL and null check-out", async () => {
      const { token } = await createUserAndLogin(namespace);
      const checkIn = await checkInAndTrackPhoto(token);
      const { response, body } = await requestJson("/api/attendances/today", "GET", undefined, token);
      const baseUrl = (process.env.PUBLIC_BASE_URL ?? "http://localhost:3000").replace(/\/+$/, "");

      expect(response.status).toBe(200);
      expect(body.data.id).toBe(checkIn.body.data.id);
      expect(body.data.check_in_photo).toBe(`${baseUrl}/uploads/checkin/${checkIn.body.data.checkInPhoto}`);
      expect(body.data.check_out_time).toBeNull();
      expect(body.data.status).toBe(checkIn.body.data.status);
    });

    test("returns a check-out timestamp after check-out", async () => {
      const { token } = await createUserAndLogin(namespace);
      await checkInAndTrackPhoto(token);
      const checkOut = await requestJson("/api/attendances", "PUT", undefined, token);
      const today = await requestJson("/api/attendances/today", "GET", undefined, token);

      expect(checkOut.response.status).toBe(200);
      expect(today.response.status).toBe(200);
      expect(new Date(today.body.data.check_out_time).getTime())
        .toBe(new Date(checkOut.body.data.checkOutTime).getTime());
    });
  });

  describe("Get attendance history", () => {
    test("rejects a request without a token", async () => {
      const { response, body } = await requestJson("/api/attendances/history", "GET");
      expect(response.status).toBe(401);
      expect(body.errors).toBe("Unauthorized");
    });

    test("defaults month and year to the current Jakarta month and year", async () => {
      setSystemTime(new Date("2026-10-09T03:00:00.000Z"));
      const { token } = await createUserAndLogin(namespace);
      const userId = verifyToken(token).id;
      const currentMonth = await seedAttendance(userId, "2026-10-01");
      await seedAttendance(userId, "2026-09-30");
      await seedAttendance(userId, "2025-10-09");

      const { response, body } = await requestJson("/api/attendances/history", "GET", undefined, token);
      expect(response.status).toBe(200);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].id).toBe(currentMonth.id);
    });

    test("filters results by the requested month and year and formats the output", async () => {
      const { token } = await createUserAndLogin(namespace);
      const userId = verifyToken(token).id;
      const requested = await seedAttendance(userId, "2026-10-25", "Terlambat");
      await seedAttendance(userId, "2026-09-25");
      await seedAttendance(userId, "2025-10-25");

      const { response, body } = await requestJson(
        "/api/attendances/history?month=10&year=2026",
        "GET",
        undefined,
        token,
      );
      expect(response.status).toBe(200);
      expect(body.data).toHaveLength(1);
      expect(body.data[0]).toEqual({
        id: requested.id,
        date: "2026-10-25",
        check_in_time: "08:02:03",
        check_out_time: "16:10:11",
        check_in_photo: `http://localhost:3000/uploads/checkin/${requested.photo}`,
        status: "Terlambat",
      });
    });

    test("returns an empty array when the selected month has no attendance", async () => {
      const { token } = await createUserAndLogin(namespace);
      const { response, body } = await requestJson(
        "/api/attendances/history?month=1&year=2000",
        "GET",
        undefined,
        token,
      );
      expect(response.status).toBe(200);
      expect(body.data).toEqual([]);
    });

    test("rejects month values outside 1 through 12", async () => {
      const { token } = await createUserAndLogin(namespace);
      for (const month of ["13", "-1"]) {
        const { response, body } = await requestJson(
          `/api/attendances/history?month=${month}`,
          "GET",
          undefined,
          token,
        );
        expect(response.status).toBe(400);
        expect(body.errors.month).toContain("Month must be between 1 and 12");
      }
    });

    test("rejects malformed and out-of-range year values", async () => {
      const { token } = await createUserAndLogin(namespace);
      const { response } = await requestJson(
        "/api/attendances/history?year=not-a-year",
        "GET",
        undefined,
        token,
      );
      expect(response.status).toBe(400);
    });
  });

  describe("Get attendance stats", () => {
    test("rejects a request without a token", async () => {
      const { response, body } = await requestJson("/api/attendances/stats", "GET");
      expect(response.status).toBe(401);
      expect(body.errors).toBe("Unauthorized");
    });

    test("returns zero counts for a new user", async () => {
      const { token } = await createUserAndLogin(namespace);
      const { response, body } = await requestJson("/api/attendances/stats", "GET", undefined, token);
      expect(response.status).toBe(200);
      expect(body).toEqual({
        status: "success",
        statusCode: 200,
        message: "Success get stats attendance",
        data: { totalAttendance: 0, sickLeave: 0, personalLeave: 0 },
      });
    });

    test("counts only current-month records for the authenticated user and excludes soft-deleted leaves", async () => {
      setSystemTime(new Date("2026-10-15T02:00:00.000Z"));
      const { token } = await createUserAndLogin(namespace);
      const userId = verifyToken(token).id;
      const { token: otherToken } = await createUserAndLogin(namespace);
      const otherUserId = verifyToken(otherToken).id;

      await seedAttendance(userId, "2026-10-01");
      await seedAttendance(userId, "2026-10-14");
      await seedAttendance(userId, "2026-09-30");
      await seedAttendance(otherUserId, "2026-10-10");

      const seedLeave = (ownerId: string, startDate: string, category: "Sakit" | "Izin", deletedAt: Date | null = null) =>
        testDb.insert(testLeaves).values({
          user_id: ownerId,
          start_date: startDate,
          end_date: startDate,
          reason: "test",
          category,
          status: "Approved",
          deleted_at: deletedAt,
        });
      await seedLeave(userId, "2026-10-03", "Sakit");
      await seedLeave(userId, "2026-10-04", "Izin");
      await seedLeave(userId, "2026-09-30", "Sakit");
      await seedLeave(userId, "2026-10-05", "Sakit", new Date("2026-10-06T00:00:00.000Z"));
      await seedLeave(otherUserId, "2026-10-05", "Izin");

      const { response, body } = await requestJson("/api/attendances/stats", "GET", undefined, token);
      expect(response.status).toBe(200);
      expect(body.data).toEqual({ totalAttendance: 2, sickLeave: 1, personalLeave: 1 });
    });
  });
});
