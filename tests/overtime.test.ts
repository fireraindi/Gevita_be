import { describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import {
  adminToken,
  isolateApiNamespace,
  jwt,
  loginUser,
  registerUser,
  requestJson,
  testDb,
  testOvertimes,
  testUsers,
  validUser,
} from "./helpers/apiTestHelpers";

const namespace = "overtime-suite";

describe("Overtime API", () => {
  isolateApiNamespace(namespace);

  describe("Create overtime (POST /api/overtimes)", () => {
    test("allows an admin to create an overtime record with valid payload", async () => {
      const user = await registerUser(namespace);
      const payload = {
        userId: user.body.data.id,
        timeFrame: 2,
        start: "19:00",
        end: "21:00",
        description: "Service Ac",
        date: "2026-11-26",
      };

      const { response, body } = await requestJson("/api/overtimes", "POST", payload, adminToken);

      expect(response.status).toBe(201);
      expect(body.status).toBe("success");
      expect(body.message).toBe("Data lembur berhasil dibuat");
      expect(body.data).toMatchObject(payload);
      expect(Number.isInteger(body.data.id)).toBe(true);
      expect(typeof body.data.createdAt).toBe("string");
      expect(Number.isNaN(Date.parse(body.data.createdAt))).toBe(false);

      const [saved] = await testDb
        .select()
        .from(testOvertimes)
        .where(eq(testOvertimes.id, body.data.id))
        .limit(1);
      expect(saved).toBeDefined();
      expect(saved?.user_id).toBe(user.body.data.id);
      expect(saved?.time_frame).toBe(2);
      expect(saved?.description).toBe("Service Ac");
      expect(saved?.date).toBe("2026-11-26");
    });

    test("rejects invalid timeFrame values (<= 0, decimal, or wrong type)", async () => {
      const user = await registerUser(namespace);
      const base = {
        userId: user.body.data.id,
        start: "19:00",
        end: "21:00",
        description: "Service Ac",
        date: "2026-11-26",
      };

      for (const invalidTimeFrame of [0, -2, 1.5, "2"]) {
        const { response, body } = await requestJson("/api/overtimes", "POST", {
          ...base,
          timeFrame: invalidTimeFrame,
        }, adminToken);
        expect(response.status).toBe(400);
        expect(body.status).toBe("error");
        expect(body.statusCode).toBe(400);
        expect(body.errors.timeFrame).toBeDefined();
      }
    });

    test("rejects invalid time formats for start and end", async () => {
      const user = await registerUser(namespace);
      const base = {
        userId: user.body.data.id,
        timeFrame: 2,
        description: "Service Ac",
        date: "2026-11-26",
      };

      const badStart = await requestJson("/api/overtimes", "POST", {
        ...base,
        start: "25:00",
        end: "21:00",
      }, adminToken);
      expect(badStart.response.status).toBe(400);
      expect(badStart.body.errors.start).toContain("Start time must be a valid time in HH:MM format");

      const badEnd = await requestJson("/api/overtimes", "POST", {
        ...base,
        start: "19:00",
        end: "19:60",
      }, adminToken);
      expect(badEnd.response.status).toBe(400);
      expect(badEnd.body.errors.end).toContain("End time must be a valid time in HH:MM format");

      const equalTimes = await requestJson("/api/overtimes", "POST", {
        ...base,
        start: "19:00",
        end: "19:00",
      }, adminToken);
      expect(equalTimes.response.status).toBe(400);
      expect(equalTimes.body.errors.end).toContain("End time must be different from start time");
    });

    test("rejects when start time is greater than end time (and end time is less than start time)", async () => {
      const user = await registerUser(namespace);
      const { response, body } = await requestJson("/api/overtimes", "POST", {
        userId: user.body.data.id,
        timeFrame: 2,
        start: "21:00",
        end: "19:00",
        description: "Service Ac",
        date: "2026-11-26",
      }, adminToken);

      expect(response.status).toBe(400);
      expect(body.status).toBe("error");
      expect(body.statusCode).toBe(400);
      expect(body.errors.start).toContain("Start time must not be greater than end time");
      expect(body.errors.end).toContain("End time must not be less than start time");
    });

    test("rejects invalid calendar dates", async () => {
      const user = await registerUser(namespace);
      const base = {
        userId: user.body.data.id,
        timeFrame: 2,
        start: "19:00",
        end: "21:00",
        description: "Service Ac",
      };

      for (const invalidDate of ["2026-02-30", "26-11-2026", "invalid"]) {
        const { response, body } = await requestJson("/api/overtimes", "POST", {
          ...base,
          date: invalidDate,
        }, adminToken);
        expect(response.status).toBe(400);
        expect(body.status).toBe("error");
        expect(body.errors.date).toContain("Date must be a valid date in YYYY-MM-DD format");
      }
    });

    test("rejects invalid userId UUID format and returns 404 when user does not exist", async () => {
      const badUuid = await requestJson("/api/overtimes", "POST", {
        userId: "not-a-uuid",
        timeFrame: 2,
        start: "19:00",
        end: "21:00",
        description: "Service Ac",
        date: "2026-11-26",
      }, adminToken);
      expect(badUuid.response.status).toBe(400);
      expect(badUuid.body.errors.userId).toContain("User ID must be a valid UUID");

      const notFound = await requestJson("/api/overtimes", "POST", {
        userId: crypto.randomUUID(),
        timeFrame: 2,
        start: "19:00",
        end: "21:00",
        description: "Service Ac",
        date: "2026-11-26",
      }, adminToken);
      expect(notFound.response.status).toBe(404);
      expect(notFound.body.status).toBe("error");
      expect(notFound.body.errors).toBe("User not found");
    });

    test("rejects employee access with 403 Forbidden", async () => {
      const employeeToken = jwt.sign({ id: "test-employee", role: "employee" }, String(process.env.JWT_SECRET));
      const { response, body } = await requestJson("/api/overtimes", "POST", {}, employeeToken);
      expect(response.status).toBe(403);
      expect(body.status).toBe("error");
      expect(body.statusCode).toBe(403);
      expect(body.errors).toBe("Forbidden");
    });

    test("requires a valid authorization token", async () => {
      const payload = {
        userId: crypto.randomUUID(),
        timeFrame: 2,
        start: "19:00",
        end: "21:00",
        description: "Service Ac",
        date: "2026-11-26",
      };

      const unauthenticated = await requestJson("/api/overtimes", "POST", payload);
      expect(unauthenticated.response.status).toBe(401);
      expect(unauthenticated.body.statusCode).toBe(401);
      expect(unauthenticated.body.errors).toBe("Unauthorized");

      const invalid = await requestJson("/api/overtimes", "POST", payload, "invalid-token");
      expect(invalid.response.status).toBe(401);
      expect(invalid.body.statusCode).toBe(401);
      expect(invalid.body.errors).toBe("Unauthorized");
    });

    test("rejects timeFrame exceeding 24 hours or exceeding start-to-end duration", async () => {
      const user = await registerUser(namespace);

      const over24 = await requestJson("/api/overtimes", "POST", {
        userId: user.body.data.id,
        timeFrame: 25,
        start: "00:00",
        end: "23:00",
        description: "Service Ac",
        date: "2026-11-26",
      }, adminToken);
      expect(over24.response.status).toBe(400);
      expect(over24.body.errors.timeFrame).toContain("Time frame must not exceed 24 hours");

      const exceedsDuration = await requestJson("/api/overtimes", "POST", {
        userId: user.body.data.id,
        timeFrame: 3,
        start: "19:00",
        end: "21:00",
        description: "Service Ac",
        date: "2026-11-26",
      }, adminToken);
      expect(exceedsDuration.response.status).toBe(400);
      expect(exceedsDuration.body.errors.timeFrame).toContain(
        "Time frame must not exceed the duration between start and end time",
      );
    });

    test("rejects creating overtime for an inactive target user", async () => {
      const user = await registerUser(namespace);
      await testDb
        .update(testUsers)
        .set({ is_active: false })
        .where(eq(testUsers.id, user.body.data.id));

      const { response, body } = await requestJson("/api/overtimes", "POST", {
        userId: user.body.data.id,
        timeFrame: 2,
        start: "19:00",
        end: "21:00",
        description: "Service Ac",
        date: "2026-11-26",
      }, adminToken);

      expect(response.status).toBe(400);
      expect(body.status).toBe("error");
      expect(body.statusCode).toBe(400);
      expect(body.errors).toBe("Target user is inactive");
    });

    test("rejects overlapping overtime schedules on the same date but allows back-to-back or soft-deleted schedules", async () => {
      const user = await registerUser(namespace);

      const first = await requestJson("/api/overtimes", "POST", {
        userId: user.body.data.id,
        timeFrame: 2,
        start: "19:00",
        end: "21:00",
        description: "Service Ac",
        date: "2026-11-26",
      }, adminToken);
      expect(first.response.status).toBe(201);

      // Overlapping schedule (20:00 - 22:00 overlaps with 19:00 - 21:00)
      const overlapping = await requestJson("/api/overtimes", "POST", {
        userId: user.body.data.id,
        timeFrame: 2,
        start: "20:00",
        end: "22:00",
        description: "Maintenance Server",
        date: "2026-11-26",
      }, adminToken);
      expect(overlapping.response.status).toBe(409);
      expect(overlapping.body.status).toBe("error");
      expect(overlapping.body.statusCode).toBe(409);
      expect(overlapping.body.errors).toBe("Overtime schedule overlaps with an existing overtime record");

      // Back-to-back schedule (21:00 - 23:00 does not overlap with 19:00 - 21:00)
      const backToBack = await requestJson("/api/overtimes", "POST", {
        userId: user.body.data.id,
        timeFrame: 2,
        start: "21:00",
        end: "23:00",
        description: "Follow-up Check",
        date: "2026-11-26",
      }, adminToken);
      expect(backToBack.response.status).toBe(201);

      // Soft-deleting the first record allows recreating the same slot
      await testDb
        .update(testOvertimes)
        .set({ deleted_at: new Date() })
        .where(eq(testOvertimes.id, first.body.data.id));

      const afterSoftDelete = await requestJson("/api/overtimes", "POST", {
        userId: user.body.data.id,
        timeFrame: 2,
        start: "19:00",
        end: "21:00",
        description: "Re-scheduled Service Ac",
        date: "2026-11-26",
      }, adminToken);
      expect(afterSoftDelete.response.status).toBe(201);
    });

    test("rejects inactive or demoted admins with 403 Forbidden", async () => {
      const adminPayload = validUser(namespace, { role: "admin" });
      const createdAdmin = await registerUser(namespace, adminPayload);
      const login = await loginUser(adminPayload.email, adminPayload.password);
      const token = login.body.data.token as string;
      const adminId = createdAdmin.body.data.id as string;

      const payload = {
        userId: adminId,
        timeFrame: 2,
        start: "19:00",
        end: "21:00",
        description: "Service Ac",
        date: "2026-11-26",
      };

      await testDb.update(testUsers).set({ is_active: false }).where(eq(testUsers.id, adminId));
      const inactive = await requestJson("/api/overtimes", "POST", payload, token);
      expect(inactive.response.status).toBe(403);
      expect(inactive.body.errors).toBe("User account is inactive");

      await testDb.update(testUsers).set({ is_active: true, role: "employee" }).where(eq(testUsers.id, adminId));
      const demoted = await requestJson("/api/overtimes", "POST", payload, token);
      expect(demoted.response.status).toBe(403);
      expect(demoted.body.errors).toBe("Forbidden");

      // Deleted admin account (no fail-open)
      const ghostAdminToken = jwt.sign({ id: crypto.randomUUID(), role: "admin" }, String(process.env.JWT_SECRET));
      const deletedAdmin = await requestJson("/api/overtimes", "POST", payload, ghostAdminToken);
      expect(deletedAdmin.response.status).toBe(401);
      expect(deletedAdmin.body.errors).toBe("Unauthorized");
    });
  });
});
