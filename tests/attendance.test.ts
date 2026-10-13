import { afterEach, describe, expect, setSystemTime, test } from "bun:test";
import { join } from "node:path";
import {
  createUserAndLogin,
  eq,
  testDb,
  testAttendances,
  testLeaves,
  isolateApiNamespace,
  requestForm,
  requestJson,
  trackTestUpload,
  verifyToken,
} from "./helpers/apiTestHelpers";

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
      status: status as "Hadir" | "Terlambat",
    }).returning({ id: testAttendances.id });
    return { ...attendance, photo };
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
