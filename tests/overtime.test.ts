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
        "Time frame must match the duration between start and end time",
      );

      const shorterDuration = await requestJson("/api/overtimes", "POST", {
        userId: user.body.data.id,
        timeFrame: 1,
        start: "19:00",
        end: "21:00",
        description: "Service Ac",
        date: "2026-11-26",
      }, adminToken);
      expect(shorterDuration.response.status).toBe(400);
      expect(shorterDuration.body.errors.timeFrame).toContain(
        "Time frame must match the duration between start and end time",
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

  describe("Update overtime (PUT /api/overtimes/:id)", () => {
    test("allows an active admin to update an existing overtime record", async () => {
      const user = await registerUser(namespace);
      const created = await requestJson("/api/overtimes", "POST", {
        userId: user.body.data.id,
        timeFrame: 2,
        start: "19:00",
        end: "21:00",
        description: "Service Ac",
        date: "2026-11-26",
      }, adminToken);
      expect(created.response.status).toBe(201);

      const overtimeId = created.body.data.id as number;
      const updatePayload = {
        timeFrame: 3,
        start: "18:00",
        end: "21:00",
        description: "Perbaikan Panel Listrik",
        date: "2026-11-27",
      };

      const { response, body } = await requestJson(`/api/overtimes/${overtimeId}`, "PUT", updatePayload, adminToken);

      expect(response.status).toBe(200);
      expect(body.status).toBe("success");
      expect(body.message).toBe("Data lembur berhasil diperbarui");
      expect(body.data).toMatchObject({
        id: overtimeId,
        userId: user.body.data.id,
        ...updatePayload,
      });
      expect(typeof body.data.createdAt).toBe("string");

      const [updatedRow] = await testDb
        .select()
        .from(testOvertimes)
        .where(eq(testOvertimes.id, overtimeId))
        .limit(1);
      expect(updatedRow).toBeDefined();
      expect(updatedRow?.time_frame).toBe(3);
      expect(updatedRow?.start.slice(0, 5)).toBe("18:00");
      expect(updatedRow?.end.slice(0, 5)).toBe("21:00");
      expect(updatedRow?.description).toBe("Perbaikan Panel Listrik");
      expect(updatedRow?.date).toBe("2026-11-27");
    });

    test("requires timeFrame to be positive integer <= 24 and match start-to-end duration", async () => {
      const user = await registerUser(namespace);
      const created = await requestJson("/api/overtimes", "POST", {
        userId: user.body.data.id,
        timeFrame: 2,
        start: "19:00",
        end: "21:00",
        description: "Service Ac",
        date: "2026-11-26",
      }, adminToken);
      const overtimeId = created.body.data.id as number;

      const mismatchSmaller = await requestJson(`/api/overtimes/${overtimeId}`, "PUT", {
        timeFrame: 1,
        start: "19:00",
        end: "21:00",
        description: "Service Ac",
        date: "2026-11-26",
      }, adminToken);
      expect(mismatchSmaller.response.status).toBe(400);
      expect(mismatchSmaller.body.errors.timeFrame).toContain(
        "Time frame must match the duration between start and end time",
      );

      const mismatchLarger = await requestJson(`/api/overtimes/${overtimeId}`, "PUT", {
        timeFrame: 3,
        start: "19:00",
        end: "21:00",
        description: "Service Ac",
        date: "2026-11-26",
      }, adminToken);
      expect(mismatchLarger.response.status).toBe(400);
      expect(mismatchLarger.body.errors.timeFrame).toContain(
        "Time frame must match the duration between start and end time",
      );

      for (const invalidTimeFrame of [0, -1, 1.5, 25]) {
        const res = await requestJson(`/api/overtimes/${overtimeId}`, "PUT", {
          timeFrame: invalidTimeFrame,
          start: "19:00",
          end: "21:00",
          description: "Service Ac",
          date: "2026-11-26",
        }, adminToken);
        expect(res.response.status).toBe(400);
        expect(res.body.errors.timeFrame).toBeDefined();
      }
    });

    test("rejects invalid time ranges (start > end, end < start, equal, invalid format) and invalid dates", async () => {
      const user = await registerUser(namespace);
      const created = await requestJson("/api/overtimes", "POST", {
        userId: user.body.data.id,
        timeFrame: 2,
        start: "19:00",
        end: "21:00",
        description: "Service Ac",
        date: "2026-11-26",
      }, adminToken);
      const overtimeId = created.body.data.id as number;

      const reversed = await requestJson(`/api/overtimes/${overtimeId}`, "PUT", {
        timeFrame: 2,
        start: "21:00",
        end: "19:00",
        description: "Service Ac",
        date: "2026-11-26",
      }, adminToken);
      expect(reversed.response.status).toBe(400);
      expect(reversed.body.errors.start).toContain("Start time must not be greater than end time");
      expect(reversed.body.errors.end).toContain("End time must not be less than start time");

      const equalTimes = await requestJson(`/api/overtimes/${overtimeId}`, "PUT", {
        timeFrame: 1,
        start: "19:00",
        end: "19:00",
        description: "Service Ac",
        date: "2026-11-26",
      }, adminToken);
      expect(equalTimes.response.status).toBe(400);
      expect(equalTimes.body.errors.end).toContain("End time must be different from start time");

      const badDate = await requestJson(`/api/overtimes/${overtimeId}`, "PUT", {
        timeFrame: 2,
        start: "19:00",
        end: "21:00",
        description: "Service Ac",
        date: "2026-02-30",
      }, adminToken);
      expect(badDate.response.status).toBe(400);
      expect(badDate.body.errors.date).toContain("Date must be a valid date in YYYY-MM-DD format");

      const badTimeFormat = await requestJson(`/api/overtimes/${overtimeId}`, "PUT", {
        timeFrame: 2,
        start: "25:00",
        end: "19:60",
        description: "Service Ac",
        date: "2026-11-26",
      }, adminToken);
      expect(badTimeFormat.response.status).toBe(400);
      expect(badTimeFormat.body.errors.start).toContain("Start time must be a valid time in HH:MM format");
      expect(badTimeFormat.body.errors.end).toContain("End time must be a valid time in HH:MM format");

      const emptyDescription = await requestJson(`/api/overtimes/${overtimeId}`, "PUT", {
        timeFrame: 2,
        start: "19:00",
        end: "21:00",
        description: "   ",
        date: "2026-11-26",
      }, adminToken);
      expect(emptyDescription.response.status).toBe(400);
      expect(emptyDescription.body.errors.description).toContain("Description is required");

      const longDescription = await requestJson(`/api/overtimes/${overtimeId}`, "PUT", {
        timeFrame: 2,
        start: "19:00",
        end: "21:00",
        description: "a".repeat(1001),
        date: "2026-11-26",
      }, adminToken);
      expect(longDescription.response.status).toBe(400);
      expect(longDescription.body.errors.description).toContain("Description must not exceed 1000 characters");
    });

    test("rejects invalid path parameter id and returns 404 when missing or soft-deleted", async () => {
      const validBody = {
        timeFrame: 2,
        start: "19:00",
        end: "21:00",
        description: "Service Ac",
        date: "2026-11-26",
      };

      for (const badId of ["abc", "0", "-5", "99999999999"]) {
        const res = await requestJson(`/api/overtimes/${badId}`, "PUT", validBody, adminToken);
        expect(res.response.status).toBe(400);
        expect(res.body.errors.id).toBeDefined();
      }

      const missing = await requestJson("/api/overtimes/999999", "PUT", validBody, adminToken);
      expect(missing.response.status).toBe(404);
      expect(missing.body.errors).toBe("Overtime not found");

      const user = await registerUser(namespace);
      const created = await requestJson("/api/overtimes", "POST", {
        userId: user.body.data.id,
        ...validBody,
      }, adminToken);
      const overtimeId = created.body.data.id as number;
      await testDb
        .update(testOvertimes)
        .set({ deleted_at: new Date() })
        .where(eq(testOvertimes.id, overtimeId));

      const deletedRes = await requestJson(`/api/overtimes/${overtimeId}`, "PUT", validBody, adminToken);
      expect(deletedRes.response.status).toBe(404);
      expect(deletedRes.body.errors).toBe("Overtime not found");
    });

    test("returns 409 Conflict when updated schedule overlaps another active overtime, while allowing self-slot updates", async () => {
      const user = await registerUser(namespace);
      const first = await requestJson("/api/overtimes", "POST", {
        userId: user.body.data.id,
        timeFrame: 2,
        start: "18:00",
        end: "20:00",
        description: "Shift 1",
        date: "2026-11-26",
      }, adminToken);
      const second = await requestJson("/api/overtimes", "POST", {
        userId: user.body.data.id,
        timeFrame: 2,
        start: "20:00",
        end: "22:00",
        description: "Shift 2",
        date: "2026-11-26",
      }, adminToken);
      expect(first.response.status).toBe(201);
      expect(second.response.status).toBe(201);

      // Updating second to overlap first (19:00 - 21:00 overlaps 18:00 - 20:00)
      const conflict = await requestJson(`/api/overtimes/${second.body.data.id}`, "PUT", {
        timeFrame: 2,
        start: "19:00",
        end: "21:00",
        description: "Shift 2 Updated",
        date: "2026-11-26",
      }, adminToken);
      expect(conflict.response.status).toBe(409);
      expect(conflict.body.errors).toBe("Overtime schedule overlaps with an existing overtime record");

      // Updating second within its own time slot (20:00 - 22:00) succeeds
      const selfUpdate = await requestJson(`/api/overtimes/${second.body.data.id}`, "PUT", {
        timeFrame: 2,
        start: "20:00",
        end: "22:00",
        description: "Shift 2 Description Updated",
        date: "2026-11-26",
      }, adminToken);
      expect(selfUpdate.response.status).toBe(200);
      expect(selfUpdate.body.data.description).toBe("Shift 2 Description Updated");
    });

    test("enforces active admin authorization and valid JWT token", async () => {
      const validBody = {
        timeFrame: 2,
        start: "19:00",
        end: "21:00",
        description: "Service Ac",
        date: "2026-11-26",
      };

      const noAuth = await requestJson("/api/overtimes/1", "PUT", validBody);
      expect(noAuth.response.status).toBe(401);
      expect(noAuth.body.errors).toBe("Unauthorized");

      const employeeToken = jwt.sign({ id: "test-employee", role: "employee" }, String(process.env.JWT_SECRET));
      const employeeRes = await requestJson("/api/overtimes/1", "PUT", validBody, employeeToken);
      expect(employeeRes.response.status).toBe(403);
      expect(employeeRes.body.errors).toBe("Forbidden");

      const adminPayload = validUser(namespace, { role: "admin" });
      const createdAdmin = await registerUser(namespace, adminPayload);
      const login = await loginUser(adminPayload.email, adminPayload.password);
      const token = login.body.data.token as string;
      const adminId = createdAdmin.body.data.id as string;

      await testDb.update(testUsers).set({ is_active: false }).where(eq(testUsers.id, adminId));
      const inactive = await requestJson("/api/overtimes/1", "PUT", validBody, token);
      expect(inactive.response.status).toBe(403);
      expect(inactive.body.errors).toBe("User account is inactive");

      await testDb.update(testUsers).set({ is_active: true, role: "employee" }).where(eq(testUsers.id, adminId));
      const demoted = await requestJson("/api/overtimes/1", "PUT", validBody, token);
      expect(demoted.response.status).toBe(403);
      expect(demoted.body.errors).toBe("Forbidden");
    });
  });
});
