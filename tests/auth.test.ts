import { describe, expect, test } from "bun:test";
import {
  createUserAndLogin,
  isolateApiNamespace,
  jwt,
  loginUser,
  requestJson,
  testDb,
  testSql,
  testUsers,
  validUser,
  verifyToken,
} from "./helpers/apiTestHelpers";

const namespace = "auth-suite";

describe("Auth API", () => {
  isolateApiNamespace(namespace);

  describe("Login", () => {
    test("logs in with a valid email and password", async () => {
      const { payload } = await createUserAndLogin(namespace);
      const { response, body } = await loginUser(payload.email, payload.password);
      expect(response.status).toBe(200);
      expect(body.status).toBe("success");
      expect(typeof body.data.token).toBe("string");
    });

    test("logs in with a valid phone number and password", async () => {
      const { payload } = await createUserAndLogin(namespace);
      const { response, body } = await loginUser(payload.phone, payload.password);
      expect(response.status).toBe(200);
      expect(typeof body.data.token).toBe("string");
    });

    test("rejects an identifier that is not registered", async () => {
      const { response, body } = await loginUser("missing@example.com");
      expect(response.status).toBe(401);
      expect(body.errors).toBe("Invalid credentials");
    });

    test("rejects an incorrect password", async () => {
      const { payload } = await createUserAndLogin(namespace);
      const { response, body } = await loginUser(payload.email, "wrong-password");
      expect(response.status).toBe(401);
      expect(body.errors).toBe("Invalid credentials");
    });

    test("rejects login for an inactive user", async () => {
      const payload = validUser(namespace);
      await testDb.insert(testUsers).values({
        id: crypto.randomUUID(),
        name: String(payload.name),
        phone: String(payload.phone),
        email: String(payload.email),
        password: await Bun.password.hash(String(payload.password)),
        position: String(payload.position),
        role: "employee",
        is_active: false,
      });

      const { response, body } = await loginUser(String(payload.email), String(payload.password));
      expect(response.status).toBe(403);
      expect(body.errors).toBe("User account is inactive");
    });

    test("rejects an empty login body", async () => {
      const { response } = await requestJson("/api/auth/login", "POST", {});
      expect(response.status).toBe(400);
    });

    test("rejects an empty identifier", async () => {
      const { response } = await requestJson("/api/auth/login", "POST", {
        identifier: "",
        password: "valid-password",
      });
      expect(response.status).toBe(400);
    });

    test("rejects an empty password", async () => {
      const { response } = await requestJson("/api/auth/login", "POST", {
        identifier: "user@example.com",
        password: "",
      });
      expect(response.status).toBe(400);
    });

    test("returns a valid signed JWT with the expected claims and expiry", async () => {
      const { payload } = await createUserAndLogin(namespace);
      const { body } = await loginUser(payload.email, payload.password);
      const claims = jwt.verify(body.data.token, process.env.JWT_SECRET!) as {
        id: string;
        role: string;
        iat: number;
        exp: number;
      };
      expect(claims.id).toBeTruthy();
      expect(claims.role).toBe("employee");
      expect(claims.exp - claims.iat).toBe(3 * 24 * 60 * 60);
    });
  });

  describe("Current User Profile", () => {
    test("returns the authenticated user's profile", async () => {
      const { payload, token } = await createUserAndLogin(namespace);
      const { response, body } = await requestJson("/api/auth/me", "GET", undefined, token);
      expect(response.status).toBe(200);
      expect(body.status).toBe("success");
      expect(body.data.email).toBe(payload.email);
      expect(body.data.role).toBe("employee");
      expect(body.data.photo).toBe("http://localhost:3000/uploads/profile/profile.webp");
    });

    test("rejects a request without a Bearer token", async () => {
      const { response, body } = await requestJson("/api/auth/me", "GET");
      expect(response.status).toBe(401);
      expect(body.errors).toBe("Unauthorized");
    });

    test("rejects an invalid token", async () => {
      const { response, body } = await requestJson("/api/auth/me", "GET", undefined, "invalid-token");
      expect(response.status).toBe(401);
      expect(body.errors).toBe("Unauthorized");
    });

    test("rejects an expired token", async () => {
      const expiredToken = jwt.sign(
        { id: "expired-user", role: "employee" },
        process.env.JWT_SECRET!,
        { expiresIn: -1 },
      );
      const { response, body } = await requestJson("/api/auth/me", "GET", undefined, expiredToken);
      expect(response.status).toBe(401);
      expect(body.errors).toBe("Unauthorized");
    });

    test("rejects a token whose user no longer exists", async () => {
      const missingUserToken = jwt.sign({ id: "deleted-user", role: "employee" }, process.env.JWT_SECRET!);
      const { response, body } = await requestJson("/api/auth/me", "GET", undefined, missingUserToken);
      expect(response.status).toBe(404);
      expect(body.errors).toBe("User not found");
    });

    test("rejects a profile request for an inactive user", async () => {
      const { token } = await createUserAndLogin(namespace);
      const userId = verifyToken(token).id;
      await testDb.update(testUsers).set({ is_active: false }).where(testSql`id = ${userId}`);
      const { response, body } = await requestJson("/api/auth/me", "GET", undefined, token);
      expect(response.status).toBe(403);
      expect(body.errors).toBe("User account is inactive");
    });
  });

});
