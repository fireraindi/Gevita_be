import { afterEach, describe, expect, setSystemTime, test } from "bun:test";
import { join } from "node:path";
import { adminToken, createUserAndLogin, eq, inArray, testAttendances, testDb, testLeaves, testUsers, isolateApiNamespace, requestForm, requestJson, registerUser, loginUser, validUser, trackTestUpload, verifyToken } from "./helpers/apiTestHelpers";

const namespace = "leave-suite";

describe("Leave API", () => {
  isolateApiNamespace(namespace);
  afterEach(() => setSystemTime());

  function validForm(overrides: Partial<Record<"startDate" | "endDate" | "reason" | "category", string>> = {}) {
    const form = new FormData();
    form.set("startDate", overrides.startDate ?? "2026-11-01");
    form.set("endDate", overrides.endDate ?? "2026-11-03");
    form.set("reason", overrides.reason ?? "Acara keluarga");
    form.set("category", overrides.category ?? "Izin");
    return form;
  }

  async function createAdminAndLogin() {
    const payload = validUser(namespace, { role: "admin" });
    const registration = await registerUser(namespace, payload);
    if (registration.response.status !== 201) throw new Error("Test admin registration failed");
    const login = await loginUser(payload.email, payload.password);
    if (login.response.status !== 200) throw new Error("Test admin login failed");
    return { payload, token: login.body.data.token as string };
  }

  describe("Get leave list (GET /api/leaves)", () => {
    test("requires an active admin account", async () => {
      const unauthorized = await requestJson("/api/leaves", "GET");
      expect(unauthorized.response.status).toBe(401);

      const employee = await createUserAndLogin(namespace);
      const denied = await requestJson("/api/leaves", "GET", undefined, employee.token);
      expect(denied.response.status).toBe(403);
      expect(denied.body.errors).toBe("Forbidden");

      const admin = await createAdminAndLogin();
      await testDb.update(testUsers).set({ is_active: false }).where(eq(testUsers.id, verifyToken(admin.token).id));
      const inactive = await requestJson("/api/leaves", "GET", undefined, admin.token);
      expect(inactive.response.status).toBe(403);
      expect(inactive.body.errors).toBe("User account is inactive");
    });

    test("filters by name, category, overlapping inclusive dates, excludes deleted rows, and paginates newest first", async () => {
      const employee = await createUserAndLogin(namespace);
      const first = await requestForm("/api/leaves", "POST", validForm({ startDate: "2026-09-30", endDate: "2026-10-02", category: "Sakit" }), employee.token);
      const second = await requestForm("/api/leaves", "POST", validForm({ startDate: "2026-10-05", endDate: "2026-10-06", category: "Izin" }), employee.token);
      const admin = await createAdminAndLogin();
      await testDb.update(testLeaves).set({ deleted_at: new Date() }).where(eq(testLeaves.id, second.body.data.id));

      const response = await requestJson("/api/leaves?search=TEST%20USER&category=Sakit&start_date=2026-10-01&end_date=2026-10-01&limit=1", "GET", undefined, admin.token);
      expect(response.response.status).toBe(200);
      expect(response.body).toMatchObject({
        status: "success",
        message: "Success get leaves",
        pagination: { page: 1, limit: 1, total: 1, total_pages: 1 },
      });
      expect(response.body.data).toEqual([expect.objectContaining({
        id: first.body.data.id,
        userId: verifyToken(employee.token).id,
        name: employee.payload.name,
        startDate: "2026-09-30",
        endDate: "2026-10-02",
        category: "Sakit",
        status: "Pending",
      })]);

      const deletedCategory = await requestJson("/api/leaves?category=Izin&start_date=2026-10-01&end_date=2026-10-10", "GET", undefined, admin.token);
      expect(deletedCategory.response.status).toBe(200);
      expect(deletedCategory.body.pagination.total).toBe(0);
    });

    test("uses Jakarta current month by default and validates date range and pagination", async () => {
      setSystemTime(new Date("2026-10-28T05:00:00.000Z"));
      const employee = await createUserAndLogin(namespace);
      const currentMonthLeave = await requestForm("/api/leaves", "POST", validForm({ startDate: "2026-10-28", endDate: "2026-10-28" }), employee.token);
      const admin = await createAdminAndLogin();
      const defaultResult = await requestJson("/api/leaves", "GET", undefined, admin.token);
      expect(defaultResult.response.status).toBe(200);
      expect(defaultResult.body.pagination).toMatchObject({ page: 1, limit: 20, total: 1, total_pages: 1 });
      expect(defaultResult.body.data[0].id).toBe(currentMonthLeave.body.data.id);

      for (const query of [
        "start_date=2026-10-01",
        "start_date=2026-02-31&end_date=2026-03-01",
        "start_date=2026-10-02&end_date=2026-10-01",
        "start_date=2026-10-01&end_date=2026-11-30",
        "limit=0", "limit=-1", "limit=1.5", "limit=101", "page=0", "page=-1", "page=1.5", "category=Liburan",
      ]) {
        const invalid = await requestJson(`/api/leaves?${query}`, "GET", undefined, admin.token);
        expect(invalid.response.status).toBe(400);
      }
      const sameDay = await requestJson("/api/leaves?start_date=2026-10-28&end_date=2026-10-28&limit=100&page=2", "GET", undefined, admin.token);
      expect(sameDay.response.status).toBe(200);
      expect(sameDay.body.pagination).toMatchObject({ page: 2, limit: 100, total: 1, total_pages: 1 });
      expect(sameDay.body.data).toHaveLength(0);
      const maximumRange = await requestJson("/api/leaves?start_date=2026-10-01&end_date=2026-11-29", "GET", undefined, admin.token);
      expect(maximumRange.response.status).toBe(200);
    });
  });

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
    expect(body.data.category).toBe("Izin");
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
        category: "Izin",
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

  test("reject endpoint requires an admin and rejects a pending leave", async () => {
    const employee = await createUserAndLogin(namespace);
    const created = await requestForm("/api/leaves", "POST", validForm(), employee.token);
    const denied = await requestJson(`/api/leaves/${created.body.data.id}/rejected`, "PATCH", undefined, employee.token);
    expect(denied.response.status).toBe(403);

    const response = await requestJson(`/api/leaves/${created.body.data.id}/rejected`, "PATCH", undefined, adminToken);
    expect(response.response.status).toBe(200);
    expect(response.body.data).toMatchObject({ status: "Rejected", category: "Izin", startDate: "2026-11-01", endDate: "2026-11-03" });
  });

  test("approve endpoint requires authentication and creates inclusive category attendance in one transaction", async () => {
    // I have nothing but my burger and I want nothing more
    const employee = await createUserAndLogin(namespace);
    const created = await requestForm("/api/leaves", "POST", validForm({ startDate: "2026-12-07", endDate: "2026-12-10", category: "Sakit" }), employee.token);
    const unauthorized = await requestJson(`/api/leaves/${created.body.data.id}/approved`, "PATCH");
    expect(unauthorized.response.status).toBe(401);

    const response = await requestJson(`/api/leaves/${created.body.data.id}/approved`, "PATCH", undefined, adminToken);
    expect(response.response.status).toBe(200);
    expect(response.body.data).toMatchObject({ status: "Approved", category: "Sakit" });
    const rows = await testDb.select().from(testAttendances).where(inArray(testAttendances.user_id, [verifyToken(employee.token).id]));
    const leaveRows = rows.filter((row) => row.date >= "2026-12-07" && row.date <= "2026-12-10");
    expect(leaveRows).toHaveLength(4);
    expect(leaveRows.map((row) => row.status)).toEqual(["Sakit", "Sakit", "Sakit", "Sakit"]);
  });

  test("approve transaction rolls back leave status when attendance already exists", async () => {
    const employee = await createUserAndLogin(namespace);
    const created = await requestForm("/api/leaves", "POST", validForm({ startDate: "2026-12-20", endDate: "2026-12-21", category: "Izin" }), employee.token);
    const userId = verifyToken(employee.token).id;
    await testDb.insert(testAttendances).values({
      user_id: userId, date: "2026-12-20", check_in_time: new Date(), check_in_photo: "existing.webp", status: "Hadir",
    });
    const response = await requestJson(`/api/leaves/${created.body.data.id}/approved`, "PATCH", undefined, adminToken);
    expect(response.response.status).toBe(500);
    const [leave] = await testDb.select().from(testLeaves).where(eq(testLeaves.id, created.body.data.id));
    expect(leave?.status).toBe("Pending");
  });

  test("approved Izin leaves create attendance with Izin status", async () => {
    const employee = await createUserAndLogin(namespace);
    const created = await requestForm("/api/leaves", "POST", validForm({ startDate: "2026-12-25", endDate: "2026-12-26", category: "Izin" }), employee.token);
    const response = await requestJson(`/api/leaves/${created.body.data.id}/approved`, "PATCH", undefined, adminToken);
    expect(response.response.status).toBe(200);
    const userId = verifyToken(employee.token).id;
    const rows = await testDb.select().from(testAttendances).where(eq(testAttendances.user_id, userId));
    const leaveRows = rows.filter((row) => row.date >= "2026-12-25" && row.date <= "2026-12-26");
    expect(leaveRows).toHaveLength(2);
    expect(leaveRows.map((row) => row.status)).toEqual(["Izin", "Izin"]);
  });
});
