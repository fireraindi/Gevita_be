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
  testJobs,
  testUsers,
  validUser,
} from "./helpers/apiTestHelpers";

const namespace = "job-suite";

describe("Job API", () => {
  isolateApiNamespace(namespace);

  describe("Create job (POST /api/jobs)", () => {
    test("allows an admin to create a job with JSON", async () => {
      const user = await registerUser(namespace);
      const payload = { userId: user.body.data.id, name: "Qc Project", salary: 100000 };
      const { response, body } = await requestJson("/api/jobs", "POST", payload, adminToken);

      expect(response.status).toBe(201);
      expect(body.status).toBe("success");
      expect(body.message).toBe("Create job success");
      expect(body.data).toMatchObject(payload);
      expect(Number.isInteger(body.data.id)).toBe(true);
    });

    test("rejects a salary with the wrong JSON type", async () => {
      const user = await registerUser(namespace);
      const { response, body } = await requestJson("/api/jobs", "POST", {
        userId: user.body.data.id,
        name: "Qc Project",
        salary: "bukan_angka",
      }, adminToken);

      expect(response.status).toBe(400);
      expect(body.status).toBe("error");
      expect(body.errors.salary).toContain("Salary must be a number");
    });

    test("rejects employee access", async () => {
      const token = jwt.sign({ id: "test-employee", role: "employee" }, String(process.env.JWT_SECRET));
      const { response, body } = await requestJson("/api/jobs", "POST", {}, token);
      expect(response.status).toBe(403);
      expect(body.status).toBe("error");
      expect(body.errors).toBe("Forbidden");
    });

    test("requires a valid authorization token", async () => {
      const payload = { userId: crypto.randomUUID(), name: "Qc Project", salary: 100000 };
      const unauthenticated = await requestJson("/api/jobs", "POST", payload);
      expect(unauthenticated.response.status).toBe(401);
      expect(unauthenticated.body.errors).toBe("Unauthorized");

      const invalid = await requestJson("/api/jobs", "POST", payload, "invalid-token");
      expect(invalid.response.status).toBe(401);
      expect(invalid.body.errors).toBe("Unauthorized");
    });

    test("returns structured validation errors for invalid fields", async () => {
      const { response, body } = await requestJson("/api/jobs", "POST", {
        userId: "",
        name: "",
        salary: -100,
      }, adminToken);
      expect(response.status).toBe(400);
      expect(body.status).toBe("error");
      expect(body.errors.userId).toContain("User ID is required");
      expect(body.errors.name).toContain("Name is required");
      expect(body.errors.salary).toContain("Salary must be a positive number");
    });

    test("returns 404 when the target user does not exist", async () => {
      const { response, body } = await requestJson("/api/jobs", "POST", {
        userId: crypto.randomUUID(),
        name: "Qc Project",
        salary: 100000,
      }, adminToken);
      expect(response.status).toBe(404);
      expect(body.status).toBe("error");
      expect(body.errors).toBe("User not found");
    });
  });

  describe("Update job (PUT /api/jobs/:id)", () => {
    test("allows an admin to update a job with valid payload", async () => {
      const user = await registerUser(namespace);
      const created = await requestJson("/api/jobs", "POST", {
        userId: user.body.data.id,
        name: "Initial Job",
        salary: 50000,
      }, adminToken);
      expect(created.response.status).toBe(201);

      const updatePayload = {
        name: "QC Project",
        salary: 100000,
      };

      const { response, body } = await requestJson(
        `/api/jobs/${created.body.data.id}`,
        "PUT",
        updatePayload,
        adminToken
      );

      expect(response.status).toBe(200);
      expect(body.status).toBe("success");
      expect(body.statusCode).toBe(200);
      expect(body.message).toBe("Success update job");
      expect(body.data).toEqual({
        id: created.body.data.id,
        name: "QC Project",
        salary: 100000,
      });

      // Verify DB persistence
      const [persisted] = await testDb.select().from(testJobs).where(eq(testJobs.id, created.body.data.id));
      expect(persisted.name).toBe("QC Project");
      expect(persisted.salary).toBe(100000);
      expect(persisted.user_id).toBe(user.body.data.id);
    });

    test("rejects invalid path parameter id", async () => {
      const payload = { name: "QC Project", salary: 100000 };

      const badString = await requestJson("/api/jobs/abc", "PUT", payload, adminToken);
      expect(badString.response.status).toBe(400);
      expect(badString.body.status).toBe("error");
      expect(badString.body.errors.id).toContain("Job ID must be a number");

      const badZero = await requestJson("/api/jobs/0", "PUT", payload, adminToken);
      expect(badZero.response.status).toBe(400);
      expect(badZero.body.status).toBe("error");
      expect(badZero.body.errors.id).toContain("Job ID must be a positive integer");

      const badNegative = await requestJson("/api/jobs/-5", "PUT", payload, adminToken);
      expect(badNegative.response.status).toBe(400);
      expect(badNegative.body.status).toBe("error");
      expect(badNegative.body.errors.id).toContain("Job ID must be a positive integer");

      const badOverflow = await requestJson("/api/jobs/99999999999", "PUT", payload, adminToken);
      expect(badOverflow.response.status).toBe(400);
      expect(badOverflow.body.status).toBe("error");
      expect(badOverflow.body.errors.id).toContain("Job ID is out of range");
    });

    test("rejects invalid update body", async () => {
      const user = await registerUser(namespace);
      const created = await requestJson("/api/jobs", "POST", {
        userId: user.body.data.id,
        name: "Initial Job",
        salary: 50000,
      }, adminToken);

      const { response, body } = await requestJson(`/api/jobs/${created.body.data.id}`, "PUT", {
        name: "",
        salary: "bukan_angka",
      }, adminToken);

      expect(response.status).toBe(400);
      expect(body.status).toBe("error");
      expect(body.errors.name).toContain("Name is required");
      expect(body.errors.salary).toContain("Salary must be a number");
    });

    test("requires a valid authorization token", async () => {
      const payload = { name: "QC Project", salary: 100000 };
      const unauthenticated = await requestJson("/api/jobs/1", "PUT", payload);
      expect(unauthenticated.response.status).toBe(401);
      expect(unauthenticated.body.errors).toBe("Unauthorized");

      const invalid = await requestJson("/api/jobs/1", "PUT", payload, "invalid-token");
      expect(invalid.response.status).toBe(401);
      expect(invalid.body.errors).toBe("Unauthorized");
    });

    test("rejects employee access", async () => {
      const token = jwt.sign({ id: "test-employee", role: "employee" }, String(process.env.JWT_SECRET));
      const { response, body } = await requestJson("/api/jobs/1", "PUT", {}, token);
      expect(response.status).toBe(403);
      expect(body.status).toBe("error");
      expect(body.errors).toBe("Forbidden");
    });

    test("returns 404 when the job does not exist", async () => {
      const { response, body } = await requestJson("/api/jobs/999999", "PUT", {
        name: "QC Project",
        salary: 100000,
      }, adminToken);

      expect(response.status).toBe(404);
      expect(body.status).toBe("error");
      expect(body.errors).toBe("Job Not found");
    });

    test("returns 404 when the job has been soft-deleted", async () => {
      const user = await registerUser(namespace);
      const created = await requestJson("/api/jobs", "POST", {
        userId: user.body.data.id,
        name: "Job To Delete",
        salary: 50000,
      }, adminToken);

      await testDb.update(testJobs).set({ deleted_at: new Date() }).where(eq(testJobs.id, created.body.data.id));

      const { response, body } = await requestJson(`/api/jobs/${created.body.data.id}`, "PUT", {
        name: "QC Project",
        salary: 100000,
      }, adminToken);

      expect(response.status).toBe(404);
      expect(body.status).toBe("error");
      expect(body.errors).toBe("Job Not found");
    });
  });

  describe("Remove job (DELETE /api/jobs/:id)", () => {
    test("allows an admin to soft delete a job", async () => {
      const user = await registerUser(namespace);
      const created = await requestJson("/api/jobs", "POST", {
        userId: user.body.data.id,
        name: "Job To Remove",
        salary: 75000,
      }, adminToken);
      expect(created.response.status).toBe(201);

      const { response, body } = await requestJson(
        `/api/jobs/${created.body.data.id}`,
        "DELETE",
        undefined,
        adminToken
      );

      expect(response.status).toBe(200);
      expect(body).toEqual({
        status: "success",
        statusCode: 200,
        message: "Success Remove job",
      });

      // Verify soft deletion in DB
      const [persisted] = await testDb.select().from(testJobs).where(eq(testJobs.id, created.body.data.id));
      expect(persisted.deleted_at).toBeInstanceOf(Date);
    });

    test("returns 404 when removing an already soft-deleted job", async () => {
      const user = await registerUser(namespace);
      const created = await requestJson("/api/jobs", "POST", {
        userId: user.body.data.id,
        name: "Job Double Delete",
        salary: 75000,
      }, adminToken);

      const firstDelete = await requestJson(`/api/jobs/${created.body.data.id}`, "DELETE", undefined, adminToken);
      expect(firstDelete.response.status).toBe(200);

      const secondDelete = await requestJson(`/api/jobs/${created.body.data.id}`, "DELETE", undefined, adminToken);
      expect(secondDelete.response.status).toBe(404);
      expect(secondDelete.body.status).toBe("error");
      expect(secondDelete.body.errors).toBe("Job Not found");
    });

    test("returns 404 when the job does not exist", async () => {
      const { response, body } = await requestJson("/api/jobs/999999", "DELETE", undefined, adminToken);
      expect(response.status).toBe(404);
      expect(body.status).toBe("error");
      expect(body.errors).toBe("Job Not found");
    });

    test("rejects invalid path parameter id", async () => {
      const badString = await requestJson("/api/jobs/abc", "DELETE", undefined, adminToken);
      expect(badString.response.status).toBe(400);
      expect(badString.body.errors.id).toContain("Job ID must be a number");

      const badZero = await requestJson("/api/jobs/0", "DELETE", undefined, adminToken);
      expect(badZero.response.status).toBe(400);
      expect(badZero.body.errors.id).toContain("Job ID must be a positive integer");

      const badNegative = await requestJson("/api/jobs/-5", "DELETE", undefined, adminToken);
      expect(badNegative.response.status).toBe(400);
      expect(badNegative.body.errors.id).toContain("Job ID must be a positive integer");

      const badOverflow = await requestJson("/api/jobs/99999999999", "DELETE", undefined, adminToken);
      expect(badOverflow.response.status).toBe(400);
      expect(badOverflow.body.errors.id).toContain("Job ID is out of range");
    });

    test("requires a valid authorization token", async () => {
      const unauthenticated = await requestJson("/api/jobs/1", "DELETE");
      expect(unauthenticated.response.status).toBe(401);
      expect(unauthenticated.body.errors).toBe("Unauthorized");

      const invalid = await requestJson("/api/jobs/1", "DELETE", undefined, "invalid-token");
      expect(invalid.response.status).toBe(401);
      expect(invalid.body.errors).toBe("Unauthorized");
    });

    test("rejects employee access", async () => {
      const token = jwt.sign({ id: "test-employee", role: "employee" }, String(process.env.JWT_SECRET));
      const { response, body } = await requestJson("/api/jobs/1", "DELETE", undefined, token);
      expect(response.status).toBe(403);
      expect(body.status).toBe("error");
      expect(body.errors).toBe("Forbidden");
    });
  });

  describe("Job list (GET /api/jobs)", () => {
    test("allows an admin to retrieve active jobs list with userName", async () => {
      const user = await registerUser(namespace);
      const job1 = await requestJson("/api/jobs", "POST", {
        userId: user.body.data.id,
        name: "Backend Developer",
        salary: 150000,
      }, adminToken);
      const job2 = await requestJson("/api/jobs", "POST", {
        userId: user.body.data.id,
        name: "Frontend Developer",
        salary: 120000,
      }, adminToken);
      const job3 = await requestJson("/api/jobs", "POST", {
        userId: user.body.data.id,
        name: "DevOps Engineer",
        salary: 200000,
      }, adminToken);

      // soft-delete job2
      await requestJson(`/api/jobs/${job2.body.data.id}`, "DELETE", undefined, adminToken);

      const { response, body } = await requestJson("/api/jobs", "GET", undefined, adminToken);
      expect(response.status).toBe(200);
      expect(body.status).toBe("success");
      expect(body.statusCode).toBe(200);
      expect(body.message).toBe("Success get jobs");
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.pagination).toBeDefined();
      expect(body.pagination.page).toBe(1);
      expect(body.pagination.limit).toBe(20);
      expect(typeof body.pagination.total).toBe("number");
      expect(body.pagination.total).toBeGreaterThanOrEqual(2);
      expect(body.pagination.total_pages).toBeGreaterThanOrEqual(1);

      const jobIds = body.data.map((j: { id: number }) => j.id);
      expect(jobIds).toContain(job1.body.data.id);
      expect(jobIds).toContain(job3.body.data.id);
      expect(jobIds).not.toContain(job2.body.data.id);

      const foundJob1 = body.data.find((j: { id: number }) => j.id === job1.body.data.id);
      expect(foundJob1).toEqual({
        id: job1.body.data.id,
        userId: user.body.data.id,
        userName: user.body.data.name,
        name: "Backend Developer",
        salary: 150000,
      });
    });

    test("filters jobs by name partially and case-insensitively", async () => {
      const user = await registerUser(namespace);
      const created = await requestJson("/api/jobs", "POST", {
        userId: user.body.data.id,
        name: "Quality Assurance Specialist",
        salary: 110000,
      }, adminToken);

      const { response, body } = await requestJson("/api/jobs?name=assurance", "GET", undefined, adminToken);
      expect(response.status).toBe(200);
      expect(body.status).toBe("success");
      const match = body.data.find((j: { id: number }) => j.id === created.body.data.id);
      expect(match).toBeDefined();
      expect(match.name).toBe("Quality Assurance Specialist");

      // Case insensitive
      const upperRes = await requestJson("/api/jobs?name=ASSURANCE", "GET", undefined, adminToken);
      expect(upperRes.response.status).toBe(200);
      const matchUpper = upperRes.body.data.find((j: { id: number }) => j.id === created.body.data.id);
      expect(matchUpper).toBeDefined();
    });

    test("returns empty list when search has no matches", async () => {
      const { response, body } = await requestJson("/api/jobs?name=non-existent-random-job-name-xyz", "GET", undefined, adminToken);
      expect(response.status).toBe(200);
      expect(body.status).toBe("success");
      expect(body.data).toEqual([]);
      expect(body.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 0,
        total_pages: 0,
      });
    });

    test("supports pagination with custom page and limit", async () => {
      const user = await registerUser(namespace);
      const prefix = `PaginatedJob-${Date.now()}`;
      for (let i = 1; i <= 3; i++) {
        await requestJson("/api/jobs", "POST", {
          userId: user.body.data.id,
          name: `${prefix} ${i}`,
          salary: 100000 * i,
        }, adminToken);
      }

      // Query page 1 with limit 2
      const page1Res = await requestJson(`/api/jobs?name=${encodeURIComponent(prefix)}&page=1&limit=2`, "GET", undefined, adminToken);
      expect(page1Res.response.status).toBe(200);
      expect(page1Res.body.data.length).toBe(2);
      expect(page1Res.body.pagination).toEqual({
        page: 1,
        limit: 2,
        total: 3,
        total_pages: 2,
      });

      // Query page 2 with limit 2
      const page2Res = await requestJson(`/api/jobs?name=${encodeURIComponent(prefix)}&page=2&limit=2`, "GET", undefined, adminToken);
      expect(page2Res.response.status).toBe(200);
      expect(page2Res.body.data.length).toBe(1);
      expect(page2Res.body.pagination).toEqual({
        page: 2,
        limit: 2,
        total: 3,
        total_pages: 2,
      });

      // Ensure elements on page 1 and page 2 are distinct
      const page1Ids = page1Res.body.data.map((j: { id: number }) => j.id);
      const page2Ids = page2Res.body.data.map((j: { id: number }) => j.id);
      expect(page1Ids).not.toContain(page2Ids[0]);
    });

    test("validates pagination parameters strictly", async () => {
      const invalidLimitNeg = await requestJson("/api/jobs?limit=-1", "GET", undefined, adminToken);
      expect(invalidLimitNeg.response.status).toBe(400);
      expect(invalidLimitNeg.body.errors.limit).toBeDefined();

      const invalidLimitExceed = await requestJson("/api/jobs?limit=101", "GET", undefined, adminToken);
      expect(invalidLimitExceed.response.status).toBe(400);
      expect(invalidLimitExceed.body.errors.limit).toBeDefined();

      const invalidLimitString = await requestJson("/api/jobs?limit=abc", "GET", undefined, adminToken);
      expect(invalidLimitString.response.status).toBe(400);
      expect(invalidLimitString.body.errors.limit).toBeDefined();

      const invalidPageZero = await requestJson("/api/jobs?page=0", "GET", undefined, adminToken);
      expect(invalidPageZero.response.status).toBe(400);
      expect(invalidPageZero.body.errors.page).toBeDefined();

      const invalidPageString = await requestJson("/api/jobs?page=abc", "GET", undefined, adminToken);
      expect(invalidPageString.response.status).toBe(400);
      expect(invalidPageString.body.errors.page).toBeDefined();
    });

    test("rejects employee access", async () => {
      const token = jwt.sign({ id: "test-employee", role: "employee" }, String(process.env.JWT_SECRET));
      const { response, body } = await requestJson("/api/jobs", "GET", undefined, token);
      expect(response.status).toBe(403);
      expect(body.status).toBe("error");
      expect(body.errors).toBe("Forbidden");
    });

    test("requires a valid authorization token", async () => {
      const unauthenticated = await requestJson("/api/jobs", "GET");
      expect(unauthenticated.response.status).toBe(401);
      expect(unauthenticated.body.errors).toBe("Unauthorized");

      const invalid = await requestJson("/api/jobs", "GET", undefined, "invalid-token");
      expect(invalid.response.status).toBe(401);
      expect(invalid.body.errors).toBe("Unauthorized");
    });

    test("rejects inactive or demoted admins across all job endpoints", async () => {
      const adminPayload = validUser(namespace, { role: "admin" });
      const createdAdmin = await registerUser(namespace, adminPayload);
      const login = await loginUser(adminPayload.email, adminPayload.password);
      const token = login.body.data.token as string;
      const adminId = createdAdmin.body.data.id as string;

      // Inactive admin
      await testDb.update(testUsers).set({ is_active: false }).where(eq(testUsers.id, adminId));
      for (const [path, method, body] of [
        ["/api/jobs", "GET", undefined],
        ["/api/jobs", "POST", { userId: adminId, name: "QC", salary: 100000 }],
        ["/api/jobs/1", "PUT", { name: "QC Updated", salary: 120000 }],
        ["/api/jobs/1", "DELETE", undefined],
      ] as const) {
        const res = await requestJson(path, method, body, token);
        expect(res.response.status).toBe(403);
        expect(res.body.errors).toBe("User account is inactive");
      }

      // Demoted admin
      await testDb.update(testUsers).set({ is_active: true, role: "employee" }).where(eq(testUsers.id, adminId));
      for (const [path, method, body] of [
        ["/api/jobs", "GET", undefined],
        ["/api/jobs", "POST", { userId: adminId, name: "QC", salary: 100000 }],
        ["/api/jobs/1", "PUT", { name: "QC Updated", salary: 120000 }],
        ["/api/jobs/1", "DELETE", undefined],
      ] as const) {
        const res = await requestJson(path, method, body, token);
        expect(res.response.status).toBe(403);
        expect(res.body.errors).toBe("Forbidden");
      }
    });
  });
});
