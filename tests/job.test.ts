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
