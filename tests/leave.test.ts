import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { createUserAndLogin, eq, testDb, testLeaves, isolateApiNamespace, requestForm, requestJson, registerUser, loginUser, validUser, trackTestUpload, verifyToken } from "./helpers/apiTestHelpers";

const namespace = "leave-suite";

describe("Leave API", () => {
  isolateApiNamespace(namespace);

  function validForm(overrides: Partial<Record<"startDate" | "endDate" | "reason" | "category", string>> = {}) {
    const form = new FormData();
    form.set("startDate", overrides.startDate ?? "2026-11-01");
    form.set("endDate", overrides.endDate ?? "2026-11-03");
    form.set("reason", overrides.reason ?? "Acara keluarga");
    form.set("category", overrides.category ?? "Izin");
    return form;
  }

  test("requires authentication", async () => {
    const { response, body } = await requestForm("/api/leaves", "POST", validForm());
    expect(response.status).toBe(401);
    expect(body.errors).toBe("Unauthorized");
  });

  test("creates a leave without an image and persists the authenticated user", async () => {
    const { token } = await createUserAndLogin(namespace);
    const { response, body } = await requestForm("/api/leaves", "POST", validForm(), token);
    expect(response.status).toBe(201);
    expect(body.data.status).toBe("Pending");
    expect(body.data.image).toBeNull();
    expect(body.data.startDate).toBe("2026-11-01");
    const [row] = await testDb.select().from(testLeaves).where(eq(testLeaves.id, body.data.id));
    expect(row?.user_id).toBe(verifyToken(token).id);
    expect(row?.status).toBe("Pending");
  });

  test("stores a valid image upload", async () => {
    const { token } = await createUserAndLogin(namespace);
    const form = validForm();
    form.set("image", new File([new Uint8Array([1, 2, 3])], "proof.png", { type: "image/png" }));
    const { response, body } = await requestForm("/api/leaves", "POST", form, token);
    expect(response.status).toBe(201);
    expect(body.data.image).toMatch(/^\d+\.png$/);
    const filepath = join(process.cwd(), "uploads", "leave", body.data.image as string);
    trackTestUpload(namespace, filepath);
    expect(await Bun.file(filepath).exists()).toBe(true);
  });

  test.each([
    ["end before start", { endDate: "2026-10-31" }, "endDate", "End date must be greater than or equal to start date"],
    ["short reason", { reason: "abc" }, "reason", "Reason must be at least 4 characters"],
    ["invalid category", { category: "Liburan" }, "category", "Category must be either Sakit or Izin"],
    ["invalid calendar date", { startDate: "2026-02-31" }, "startDate", "Date must be a valid date in YYYY-MM-DD format"],
  ] as const)("rejects %s", async (_label, overrides, field, message) => {
    const { token } = await createUserAndLogin(namespace);
    const { response, body } = await requestForm("/api/leaves", "POST", validForm(overrides), token);
    expect(response.status).toBe(400);
    expect(body.errors[field]).toContain(message);
  });

  test.each([
    ["oversized image", new File([new Uint8Array(1024 * 1024 + 1)], "proof.png", { type: "image/png" })],
    ["unsupported image type", new File(["text"], "proof.pdf", { type: "application/pdf" })],
  ])("rejects %s", async (_label, image) => {
    const { token } = await createUserAndLogin(namespace);
    const form = validForm();
    form.set("image", image);
    const { response } = await requestForm("/api/leaves", "POST", form, token);
    expect(response.status).toBe(400);
  });

  describe("Get Leave Detail (GET /api/leaves/:id)", () => {
    test("requires authentication", async () => {
      const { response, body } = await requestJson("/api/leaves/1", "GET");
      expect(response.status).toBe(401);
      expect(body.errors).toBe("Unauthorized");
    });

    test.each(["abc", "-5", "0"])("rejects invalid leave ID %s", async (id) => {
      const { token } = await createUserAndLogin(namespace);
      const { response } = await requestJson(`/api/leaves/${id}`, "GET", undefined, token);
      expect(response.status).toBe(400);
    });

    test("returns 404 for a missing or soft-deleted leave", async () => {
      const { token } = await createUserAndLogin(namespace);
      const missing = await requestJson("/api/leaves/999999", "GET", undefined, token);
      expect(missing.response.status).toBe(404);
      expect(missing.body.errors).toBe("Leave data not found");

      const created = await requestForm("/api/leaves", "POST", validForm(), token);
      await testDb.update(testLeaves).set({ deleted_at: new Date() }).where(eq(testLeaves.id, created.body.data.id));
      const deleted = await requestJson(`/api/leaves/${created.body.data.id}`, "GET", undefined, token);
      expect(deleted.response.status).toBe(404);
      expect(deleted.body.errors).toBe("Leave data not found");
    });

    test("allows employees to see their own leave and denies another employee", async () => {
      const owner = await createUserAndLogin(namespace);
      const other = await createUserAndLogin(namespace);
      const created = await requestForm("/api/leaves", "POST", validForm(), owner.token);
      const own = await requestJson(`/api/leaves/${created.body.data.id}`, "GET", undefined, owner.token);
      expect(own.response.status).toBe(200);
      expect(own.body.status).toBe("success");
      expect(own.body.data).toMatchObject({
        id: created.body.data.id,
        start_date: "2026-11-01",
        end_date: "2026-11-03",
        reason: "Acara keluarga",
        status: "Pending",
        image: null,
      });
      expect(own.body.data.created_at).toBeString();
      expect(own.body.data.updated_at).toBeString();

      const denied = await requestJson(`/api/leaves/${created.body.data.id}`, "GET", undefined, other.token);
      expect(denied.response.status).toBe(403);
      expect(denied.body.errors).toBe("Forbidden");
    });

    test("allows admins to view another employee's leave", async () => {
      const owner = await createUserAndLogin(namespace);
      const created = await requestForm("/api/leaves", "POST", validForm(), owner.token);
      const adminPayload = validUser(namespace, { role: "admin" });
      const registration = await registerUser(namespace, adminPayload);
      expect(registration.response.status).toBe(201);
      const login = await loginUser(adminPayload.email, adminPayload.password);
      const adminToken = login.body.data.token as string;
      const response = await requestJson(`/api/leaves/${created.body.data.id}`, "GET", undefined, adminToken);
      expect(response.response.status).toBe(200);
      expect(response.body.data.id).toBe(created.body.data.id);
    });

    test("returns a public image URL when the leave has an attachment", async () => {
      const { token } = await createUserAndLogin(namespace);
      const form = validForm();
      form.set("image", new File([new Uint8Array([1, 2, 3])], "proof.png", { type: "image/png" }));
      const created = await requestForm("/api/leaves", "POST", form, token);
      trackTestUpload(namespace, join(process.cwd(), "uploads", "leave", created.body.data.image as string));
      const response = await requestJson(`/api/leaves/${created.body.data.id}`, "GET", undefined, token);
      expect(response.response.status).toBe(200);
      expect(response.body.data.image).toMatch(/^http:\/\/localhost:3000\/uploads\/leave\//);
    });
  });
});
