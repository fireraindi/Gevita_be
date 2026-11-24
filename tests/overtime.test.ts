import { describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import {
  adminToken,
  isolateApiNamespace,
  jwt,
  registerUser,
  requestJson,
  testDb,
  testOvertimes,
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
  });
});
