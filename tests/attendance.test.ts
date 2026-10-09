import { afterEach, describe, expect, setSystemTime, test } from "bun:test";
import { join } from "node:path";
import {
  createUserAndLogin,
  eq,
  isolateApiNamespace,
  requestForm,
  requestJson,
  testAttendances,
  testDb,
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
});
