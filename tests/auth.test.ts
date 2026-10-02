import { beforeEach, describe, expect, test } from "bun:test";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl) {
  throw new Error("TEST_DATABASE_URL must point to a dedicated test database before running auth tests");
}

function databaseIdentity(connectionString: string): string {
  const url = new URL(connectionString);
  const defaultPort = url.protocol === "postgres:" || url.protocol === "postgresql:" ? "5432" : "";
  return `${url.protocol}//${url.hostname}:${url.port || defaultPort}${url.pathname}`;
}

const applicationDatabaseUrl = process.env.DATABASE_URL;
if (applicationDatabaseUrl && databaseIdentity(testDatabaseUrl) === databaseIdentity(applicationDatabaseUrl)) {
  throw new Error("TEST_DATABASE_URL must not point to the same database as DATABASE_URL");
}

const schemaSetup = Bun.spawn(["bun", "run", "db:push"], {
  env: { ...process.env, DATABASE_URL: testDatabaseUrl },
  stdout: "inherit",
  stderr: "inherit",
});
const schemaSetupExitCode = await schemaSetup.exited;
if (schemaSetupExitCode !== 0) {
  throw new Error("Could not prepare the test database schema with drizzle-kit push");
}

process.env.DATABASE_URL = testDatabaseUrl;
process.env.JWT_SECRET ??= "auth-tests-only-secret";

const [
  { Elysia },
  { db },
  { sql },
  { userController },
  { authController },
  { errorMiddleware },
  { users },
  jwtModule,
  { verifyToken },
] = await Promise.all([
  import("elysia"),
  import("../src/db"),
  import("drizzle-orm"),
  import("../src/features/user/controller"),
  import("../src/features/auth/controller"),
  import("../src/middleware/error"),
  import("../src/features/user/schema"),
  import("jsonwebtoken"),
  import("../src/helpers/token"),
]);

const jwt = jwtModule.default;
const app = new Elysia()
  .use(errorMiddleware)
  .use(userController)
  .use(authController);

let userSequence = 0;

function validUser(overrides: Record<string, unknown> = {}) {
  userSequence += 1;
  return {
    name: "Auth Test User",
    phone: `62812345${String(userSequence).padStart(5, "0")}`,
    email: `auth-test-${userSequence}@example.com`,
    password: "valid-password",
    position: "Engineer",
    role: "employee",
    ...overrides,
  };
}

async function requestJson(path: string, method: string, body?: unknown, token?: string) {
  const headers = new Headers();
  if (body !== undefined) headers.set("content-type", "application/json");
  if (token) headers.set("authorization", `Bearer ${token}`);

  const response = await app.handle(new Request(`http://localhost${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  }));

  return { response, body: await response.json() as Record<string, any> };
}

async function registerUser(payload = validUser()) {
  return requestJson("/api/users", "POST", payload);
}

async function loginUser(identifier: string, password = "valid-password") {
  return requestJson("/api/auth/login", "POST", { identifier, password });
}

async function createUserAndLogin() {
  const payload = validUser();
  const registration = await registerUser(payload);
  expect(registration.response.status).toBe(201);
  const login = await loginUser(payload.email);
  expect(login.response.status).toBe(200);
  return { payload, token: login.body.data.token as string };
}

describe("Auth API", () => {
  beforeEach(async () => {
    // This suite only runs against TEST_DATABASE_URL, which is guarded above.
    await db.execute(sql.raw('TRUNCATE TABLE "users" RESTART IDENTITY CASCADE'));
  });

  describe("Register / Sign Up", () => {
    test("registers a user with valid data", async () => {
      const payload = validUser();
      const { response, body } = await registerUser(payload);

      expect(response.status).toBe(201);
      expect(body.status).toBe("success");
      expect(body.data.email).toBe(payload.email);
      expect(body.data.role).toBe("employee");
    });

    test("rejects an email that is already registered", async () => {
      const payload = validUser();
      expect((await registerUser(payload)).response.status).toBe(201);

      const duplicate = await registerUser({ ...validUser(), email: payload.email });
      expect(duplicate.response.status).toBe(409);
      expect(duplicate.body.status).toBe("error");
    });

    test("rejects an invalid email format", async () => {
      const { response, body } = await registerUser(validUser({ email: "invalid-email" }));
      expect(response.status).toBe(400);
      expect(body.status).toBe("error");
    });

    test("rejects a password shorter than the minimum length", async () => {
      const { response } = await registerUser(validUser({ password: "abc" }));
      expect(response.status).toBe(400);
    });

    test("rejects a request missing mandatory fields", async () => {
      const { response, body } = await registerUser({
        email:"",
        password:"",
        position:"",
        role:"employee",
        phone:"",
        name:""
      });
      expect(response.status).toBe(400);
      expect(body.status).toBe("error");
    });
  });

  describe("Login / Sign In", () => {
    test("logs in with the registered email and password", async () => {
      const payload = validUser();
      await registerUser(payload);

      const { response, body } = await loginUser(payload.email, payload.password);
      expect(response.status).toBe(200);
      expect(body.status).toBe("success");
      expect(typeof body.data.token).toBe("string");
      expect(body.data.token.length).toBeGreaterThan(0);
    });

    test("rejects an email that is not registered", async () => {
      const { response, body } = await loginUser("missing@example.com");
      expect(response.status).toBe(401);
      expect(body.errors).toBe("Invalid credentials");
    });

    test("rejects an incorrect password", async () => {
      const payload = validUser();
      await registerUser(payload);

      const { response, body } = await loginUser(payload.email, "wrong-password");
      expect(response.status).toBe(401);
      expect(body.errors).toBe("Invalid credentials");
    });

    test("rejects a request with an empty identifier", async () => {
      const { response } = await requestJson("/api/auth/login", "POST", {
        identifier: "",
        password: "valid-password",
      });
      expect(response.status).toBe(400);
    });

    test("rejects a request with an empty password", async () => {
      const { response } = await requestJson("/api/auth/login", "POST", {
        identifier: "user@example.com",
        password: "",
      });
      expect(response.status).toBe(400);
    });

    test("returns a signed access token with an id, role, and three-day expiry", async () => {
      const payload = validUser();
      await registerUser(payload);

      const { body } = await loginUser(payload.email, payload.password);
      const claims = jwt.verify(body.data.token, process.env.JWT_SECRET!) as {
        id: string;
        role: string;
        iat: number;
        exp: number;
      };

      expect(typeof claims.id).toBe("string");
      expect(claims.role).toBe("employee");
      expect(claims.exp - claims.iat).toBe(3 * 24 * 60 * 60);
    });
  });

  describe("Me / Get Current Profile", () => {
    test("returns the authenticated user's profile", async () => {
      const { payload, token } = await createUserAndLogin();
      const { response, body } = await requestJson("/api/auth/me", "GET", undefined, token);

      expect(response.status).toBe(200);
      expect(body.status).toBe("success");
      expect(body.data.email).toBe(payload.email);
      expect(body.data.role).toBe("employee");
      expect(body.data.photo).toBe("http://localhost:3000/uploads/profile/profile.webp");
    });

    test("rejects a request without an authorization token", async () => {
      const { response, body } = await requestJson("/api/auth/me", "GET");
      expect(response.status).toBe(401);
      expect(body.errors).toBe("Unauthorized");
    });

    test("rejects an invalid authorization token", async () => {
      const { response, body } = await requestJson("/api/auth/me", "GET", undefined, "invalid-token");
      expect(response.status).toBe(401);
      expect(body.errors).toBe("Unauthorized");
    });

    test("rejects an expired authorization token", async () => {
      const expiredToken = jwt.sign(
        { id: "expired-user", role: "employee" },
        process.env.JWT_SECRET!,
        { expiresIn: -1 },
      );
      const { response, body } = await requestJson("/api/auth/me", "GET", undefined, expiredToken);
      expect(response.status).toBe(401);
      expect(body.errors).toBe("Unauthorized");
    });

    test("rejects a profile request for an inactive user", async () => {
      const { token } = await createUserAndLogin();
      const id = verifyToken(token).id;
      await db.update(users).set({ is_active: false }).where(sql`id = ${id}`);

      const { response, body } = await requestJson("/api/auth/me", "GET", undefined, token);
      expect(response.status).toBe(403);
      expect(body.errors).toBe("User account is inactive");
    });
  });
});
