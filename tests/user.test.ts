import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import {
  createUserAndLogin,
  adminToken,
  jwt,
  isolateApiNamespace,
  loginUser,
  registerUser,
  requestForm,
  requestJson,
  testDb,
  testUsers,
  trackTestUpload,
  validUser,
  eq,
} from "./helpers/apiTestHelpers";

const namespace = "user-suite";

describe("User API", () => {
  isolateApiNamespace(namespace);

  describe("Register", () => {
    test("requires an authorization token", async () => {
      const { response, body } = await requestJson("/api/users", "POST", validUser(namespace));
      expect(response.status).toBe(401);
      expect(body.errors).toBe("Unauthorized");
    });

    test("rejects registration by an employee", async () => {
      const token = jwt.sign({ id: "test-employee", role: "employee" }, String(process.env.JWT_SECRET));
      const { response, body } = await requestJson("/api/users", "POST", validUser(namespace), token);
      expect(response.status).toBe(403);
      expect(body.errors).toBe("Forbidden");
    });

    test("registers a user with valid JSON data", async () => {
      const payload = validUser(namespace);
      const { response, body } = await registerUser(namespace, payload);
      expect(response.status).toBe(201);
      expect(body.status).toBe("success");
      expect(body.data.email).toBe(payload.email);
      expect(body.data.role).toBe("employee");
      expect(body.data.salary).toBe(payload.salary);
    });

    test("registers a user with a profile photo using multipart form data", async () => {
      const payload = validUser(namespace);
      const form = new FormData();
      Object.entries(payload).forEach(([key, value]) => form.set(key, String(value)));
      form.set("photo", new File([new Uint8Array([1, 2, 3])], "avatar.png", { type: "image/png" }));
      const { response, body } = await requestForm("/api/users", "POST", form, adminToken);
      expect(response.status).toBe(201);

      const [user] = await testDb.select({ photo: testUsers.photo })
        .from(testUsers)
        .where(eq(testUsers.id, body.data.id));
      expect(user?.photo).toMatch(/\.png$/);
      if (user?.photo) trackTestUpload(namespace, join(process.cwd(), "uploads", "profile", user.photo));
    });

    test("rejects a duplicate email", async () => {
      const payload = validUser(namespace);
      expect((await registerUser(namespace, payload)).response.status).toBe(201);
      const { response, body } = await registerUser(namespace, { ...validUser(namespace), email: payload.email });
      expect(response.status).toBe(409);
      expect(body.status).toBe("error");
    });

    test("rejects a duplicate phone number", async () => {
      const payload = validUser(namespace);
      expect((await registerUser(namespace, payload)).response.status).toBe(201);
      const { response, body } = await registerUser(namespace, { ...validUser(namespace), phone: payload.phone });
      expect(response.status).toBe(409);
      expect(body.status).toBe("error");
    });

    test("rejects an invalid email", async () => {
      const { response } = await registerUser(namespace, validUser(namespace, { email: "not-an-email" }));
      expect(response.status).toBe(400);
    });

    test("rejects an invalid phone number", async () => {
      const { response } = await registerUser(namespace, validUser(namespace, { phone: "123abc" }));
      expect(response.status).toBe(400);
    });

    test("rejects a password shorter than the minimum", async () => {
      const { response } = await registerUser(namespace, validUser(namespace, { password: "abc" }));
      expect(response.status).toBe(400);
    });

    test("rejects a password containing non-numeric characters", async () => {
      const { response, body } = await registerUser(namespace, validUser(namespace, { password: "12ab" }));
      expect(response.status).toBe(400);
      expect(body.errors.password).toContain("Password must contain only numbers");
    });

    test("rejects payroll amounts that are zero", async () => {
      const { response } = await registerUser(namespace, validUser(namespace, { salary: 0 }));
      expect(response.status).toBe(400);
    });

    test("rejects a role outside the supported enum", async () => {
      const { response } = await registerUser(namespace, validUser(namespace, { role: "manager" }));
      expect(response.status).toBe(400);
    });

    test("rejects missing or empty required fields", async () => {
      const { response, body } = await registerUser(namespace, {
        name: "",
        phone: "",
        email: "",
        password: "",
        position: "",
        role: "employee",
      });
      expect(response.status).toBe(400);
      expect(body.status).toBe("error");
    });
  });

  describe("Change Password", () => {
    test("changes the password and allows login with the new password", async () => {
      const { payload, token } = await createUserAndLogin(namespace);
      const change = await requestJson("/api/users", "PUT", {
        oldPassword: payload.password,
        newPassword: "new-valid-password",
      }, token);
      expect(change.response.status).toBe(200);
      expect((await loginUser(payload.email, "new-valid-password")).response.status).toBe(200);
    });

    test("rejects a request without an authorization token", async () => {
      const { response, body } = await requestJson("/api/users", "PUT", {
        oldPassword: "valid-password",
        newPassword: "new-valid-password",
      });
      expect(response.status).toBe(401);
      expect(body.errors).toBe("Unauthorized");
    });

    test("rejects an incorrect old password", async () => {
      const { token } = await createUserAndLogin(namespace);
      const { response } = await requestJson("/api/users", "PUT", {
        oldPassword: "incorrect-password",
        newPassword: "new-valid-password",
      }, token);
      expect(response.status).toBe(400);
    });

    test("rejects a new password shorter than the minimum", async () => {
      const { token } = await createUserAndLogin(namespace);
      const { response } = await requestJson("/api/users", "PUT", {
        oldPassword: "valid-password",
        newPassword: "abc",
      }, token);
      expect(response.status).toBe(400);
    });

    test("rejects empty password fields", async () => {
      const { token } = await createUserAndLogin(namespace);
      const { response } = await requestJson("/api/users", "PUT", {
        oldPassword: "",
        newPassword: "",
      }, token);
      expect(response.status).toBe(400);
    });
  });

  describe("Update user", () => {
    test("updates user data while keeping the existing password when omitted", async () => {
      const payload = validUser(namespace);
      const created = await registerUser(namespace, payload);
      const update = { ...payload, password: undefined, name: "Updated User" };
      const { response, body } = await requestJson(`/api/users/${created.body.data.id}`, "PUT", update, adminToken);
      expect(response.status).toBe(200);
      expect(body.message).toBe("Success update user");
      expect(body.data.name).toBe("Updated User");
      expect((await loginUser(payload.email, payload.password)).response.status).toBe(200);
    });

    test("updates password only when a numeric password is provided", async () => {
      const payload = validUser(namespace);
      const created = await registerUser(namespace, payload);
      const { response } = await requestJson(`/api/users/${created.body.data.id}`, "PUT", { ...payload, password: "9999" }, adminToken);
      expect(response.status).toBe(200);
      expect((await loginUser(payload.email, payload.password)).response.status).toBe(401);
      expect((await loginUser(payload.email, "9999")).response.status).toBe(200);
    });

    test("rejects employees and unauthenticated requests", async () => {
      const payload = validUser(namespace);
      const created = await registerUser(namespace, payload);
      const employeeToken = jwt.sign({ id: created.body.data.id, role: "employee" }, String(process.env.JWT_SECRET));
      const employee = await requestJson(`/api/users/${created.body.data.id}`, "PUT", payload, employeeToken);
      expect(employee.response.status).toBe(403);
      expect(employee.body.errors).toBe("Forbidden");
      const unauthenticated = await requestJson(`/api/users/${created.body.data.id}`, "PUT", payload);
      expect(unauthenticated.response.status).toBe(401);
      expect(unauthenticated.body.errors).toBe("Unauthorized");
    });

    test("returns not found, conflict, and validation errors", async () => {
      const first = validUser(namespace);
      const second = validUser(namespace);
      const createdFirst = await registerUser(namespace, first);
      await registerUser(namespace, second);

      const missing = await requestJson(`/api/users/${crypto.randomUUID()}`, "PUT", first, adminToken);
      expect(missing.response.status).toBe(404);
      expect(missing.body.errors).toBe("User Not found");

      const duplicate = await requestJson(`/api/users/${createdFirst.body.data.id}`, "PUT", { ...first, email: second.email }, adminToken);
      expect(duplicate.response.status).toBe(409);
      expect(duplicate.body.errors).toBe("(email/phone) already exist");

      const invalid = await requestJson(`/api/users/${createdFirst.body.data.id}`, "PUT", { ...first, password: "abcd", salary: -1 }, adminToken);
      expect(invalid.response.status).toBe(400);
      expect(invalid.body.errors).toHaveProperty("password");
      expect(invalid.body.errors).toHaveProperty("salary");
    });

    test("uploads a replacement profile photo", async () => {
      const payload = validUser(namespace);
      const created = await registerUser(namespace, payload);
      const form = new FormData();
      Object.entries({ ...payload, password: "" }).forEach(([key, value]) => form.set(key, String(value)));
      form.set("photo", new File([new Uint8Array([1, 2, 3])], "avatar.png", { type: "image/png" }));
      const { response, body } = await requestForm(`/api/users/${created.body.data.id}`, "PUT", form, adminToken);
      expect(response.status).toBe(200);
      const [user] = await testDb.select({ photo: testUsers.photo }).from(testUsers).where(eq(testUsers.id, created.body.data.id));
      expect(user?.photo).toMatch(/\.png$/);
      if (user?.photo) trackTestUpload(namespace, join(process.cwd(), "uploads", "profile", user.photo));
      expect(body.data.email).toBe(payload.email);
    });
  });

  describe("User detail", () => {
    test("returns the user's detail for an admin", async () => {
      const payload = validUser(namespace);
      const created = await registerUser(namespace, payload);
      const { response, body } = await requestJson(`/api/users/${created.body.data.id}`, "GET", undefined, adminToken);

      expect(response.status).toBe(200);
      expect(body.status).toBe("success");
      expect(body.data.email).toBe(payload.email);
      expect(body.data.salary).toBe(payload.salary);
      expect(body.data.supportSalary).toBe(payload.supportSalary);
      expect(body.data.overtimeSalary).toBe(payload.overtimeSalary);
      expect(body.data.pocketMoney).toBe(payload.pocketMoney);
      expect(body.data.bank).toBe(payload.bank);
      expect(body.data.accountNumber).toBe(payload.accountNumber);
      expect(body.data.photo).toBe("http://localhost:3000/uploads/profile/profile.webp");
    });

    test("rejects employee access", async () => {
      const { payload, token } = await createUserAndLogin(namespace);
      const { response, body } = await requestJson(`/api/users/${crypto.randomUUID()}`, "GET", undefined, token);
      expect(response.status).toBe(403);
      expect(body.errors).toBe("Forbidden");
      expect(payload.role).toBe("employee");
    });

    test("requires authentication", async () => {
      const { response, body } = await requestJson(`/api/users/${crypto.randomUUID()}`, "GET");
      expect(response.status).toBe(401);
      expect(body.errors).toBe("Unauthorized");
    });

    test("returns 404 when the user does not exist", async () => {
      const { response, body } = await requestJson(`/api/users/${crypto.randomUUID()}`, "GET", undefined, adminToken);
      expect(response.status).toBe(404);
      expect(body.errors).toBe("User Not found");
    });
  });

  describe("User list", () => {
    test("returns minimized user data for an admin", async () => {
      const userA = validUser(namespace, { name: "List User Alpha" });
      const userB = validUser(namespace, { name: "List User Beta" });
      await registerUser(namespace, userA);
      await registerUser(namespace, userB);

      const { response, body } = await requestJson("/api/users", "GET", undefined, adminToken);
      expect(response.status).toBe(200);
      expect(body.status).toBe("success");
      expect(body.message).toBe("Success get users");
      expect(body.data).toHaveLength(2);
      expect(body.data.map((user: { name: string }) => user.name).sort()).toEqual([userA.name, userB.name].sort());
      for (const user of body.data) {
        expect(user).toHaveProperty("id");
        expect(user).toHaveProperty("name");
        expect(user).toHaveProperty("phone");
        expect(user).toHaveProperty("position");
        expect(user).toHaveProperty("isActive");
        expect(user).not.toHaveProperty("password");
        expect(user).not.toHaveProperty("salary");
        expect(user).not.toHaveProperty("bank");
        expect(user).not.toHaveProperty("accountNumber");
      }
    });

    test("searches by name and phone, ignoring case", async () => {
      const nameUser = validUser(namespace, { name: "Unique SpecialName Person" });
      const phoneUser = validUser(namespace, { phone: "628999988881" });
      await registerUser(namespace, nameUser);
      await registerUser(namespace, phoneUser);

      const byName = await requestJson("/api/users?search=specialname", "GET", undefined, adminToken);
      expect(byName.response.status).toBe(200);
      expect(byName.body.data.map((user: { name: string }) => user.name)).toEqual([nameUser.name]);

      const byPhone = await requestJson("/api/users?search=99998888", "GET", undefined, adminToken);
      expect(byPhone.response.status).toBe(200);
      expect(byPhone.body.data.map((user: { phone: string }) => user.phone)).toEqual([phoneUser.phone]);
    });

    test("returns an empty list when search has no matches", async () => {
      const { response, body } = await requestJson("/api/users?search=non_existent_keyword_xyz123", "GET", undefined, adminToken);
      expect(response.status).toBe(200);
      expect(body.status).toBe("success");
      expect(body.data).toEqual([]);
    });

    test("rejects employee access", async () => {
      const token = jwt.sign({ id: "test-employee", role: "employee" }, String(process.env.JWT_SECRET));
      const { response, body } = await requestJson("/api/users", "GET", undefined, token);
      expect(response.status).toBe(403);
      expect(body.errors).toBe("Forbidden");
    });

    test("requires a valid authorization token", async () => {
      const unauthenticated = await requestJson("/api/users", "GET");
      expect(unauthenticated.response.status).toBe(401);
      expect(unauthenticated.body.errors).toBe("Unauthorized");

      const invalid = await requestJson("/api/users", "GET", undefined, "invalid-token");
      expect(invalid.response.status).toBe(401);
      expect(invalid.body.errors).toBe("Unauthorized");
    });
  });
});
