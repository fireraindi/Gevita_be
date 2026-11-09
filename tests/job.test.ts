import { describe, expect, test } from "bun:test";
import {
  adminToken,
  isolateApiNamespace,
  jwt,
  registerUser,
  requestJson,
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
        userId: user.body.data.id,
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
    });

    test("rejects invalid path parameter id", async () => {
      const user = await registerUser(namespace);
      const payload = { userId: user.body.data.id, name: "QC Project", salary: 100000 };

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
    });

    test("rejects invalid update body", async () => {
      const user = await registerUser(namespace);
      const created = await requestJson("/api/jobs", "POST", {
        userId: user.body.data.id,
        name: "Initial Job",
        salary: 50000,
      }, adminToken);

      const { response, body } = await requestJson(`/api/jobs/${created.body.data.id}`, "PUT", {
        userId: "",
        name: "",
        salary: "bukan_angka",
      }, adminToken);

      expect(response.status).toBe(400);
      expect(body.status).toBe("error");
      expect(body.errors.userId).toContain("User ID is required");
      expect(body.errors.name).toContain("Name is required");
      expect(body.errors.salary).toContain("Salary must be a number");
    });

    test("requires a valid authorization token", async () => {
      const payload = { userId: crypto.randomUUID(), name: "QC Project", salary: 100000 };
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
      const user = await registerUser(namespace);
      const { response, body } = await requestJson("/api/jobs/999999", "PUT", {
        userId: user.body.data.id,
        name: "QC Project",
        salary: 100000,
      }, adminToken);

      expect(response.status).toBe(404);
      expect(body.status).toBe("error");
      expect(body.errors).toBe("Job Not found");
    });

    test("returns 404 when the target user does not exist", async () => {
      const user = await registerUser(namespace);
      const created = await requestJson("/api/jobs", "POST", {
        userId: user.body.data.id,
        name: "Initial Job",
        salary: 50000,
      }, adminToken);

      const { response, body } = await requestJson(`/api/jobs/${created.body.data.id}`, "PUT", {
        userId: crypto.randomUUID(),
        name: "QC Project",
        salary: 100000,
      }, adminToken);

      expect(response.status).toBe(404);
      expect(body.status).toBe("error");
      expect(body.errors).toBe("User not found");
    });
  });
});
