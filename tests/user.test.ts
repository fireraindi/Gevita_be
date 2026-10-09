import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import {
  createUserAndLogin,
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
    test("registers a user with valid JSON data", async () => {
      const payload = validUser(namespace);
      const { response, body } = await registerUser(namespace, payload);
      expect(response.status).toBe(201);
      expect(body.status).toBe("success");
      expect(body.data.email).toBe(payload.email);
      expect(body.data.role).toBe("employee");
    });

    test("registers a user with a profile photo using multipart form data", async () => {
      const payload = validUser(namespace);
      const form = new FormData();
      Object.entries(payload).forEach(([key, value]) => form.set(key, String(value)));
      form.set("photo", new File([new Uint8Array([1, 2, 3])], "avatar.png", { type: "image/png" }));
      const { response, body } = await requestForm("/api/users", "POST", form);
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
});
