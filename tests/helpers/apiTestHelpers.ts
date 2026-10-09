import { afterEach, beforeEach } from "bun:test";
import { mkdir, rm, unlink } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl) {
  throw new Error("TEST_DATABASE_URL must point to a dedicated test database before running API tests");
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

async function prepareSchema() {
  const lockDirectory = join(tmpdir(), "gevita-api-test-schema.lock");
  while (true) {
    try {
      await mkdir(lockDirectory);
      break;
    } catch (error) {
      if (typeof error !== "object" || error === null || !("code" in error) || error.code !== "EEXIST") {
        throw error;
      }
      await Bun.sleep(100);
    }
  }

  try {
    const schemaSetup = Bun.spawn(["bun", "run", "db:push"], {
      env: { ...process.env, DATABASE_URL: testDatabaseUrl },
      stdout: "inherit",
      stderr: "inherit",
    });
    if (await schemaSetup.exited !== 0) {
      throw new Error("Could not prepare the test database schema with drizzle-kit push");
    }
  } finally {
    await rm(lockDirectory, { recursive: true, force: true });
  }
}

await prepareSchema();
process.env.DATABASE_URL = testDatabaseUrl;
process.env.JWT_SECRET ??= "api-tests-only-secret";

const [
  { Elysia },
  { db },
  { and, eq, inArray, like, sql },
  { userController, protectedUserController },
  { authController },
  { attendancesController },
  { errorMiddleware },
  { users, attendances, leaves },
  jwtModule,
  { verifyToken },
] = await Promise.all([
  import("elysia"),
  import("../../src/db"),
  import("drizzle-orm"),
  import("../../src/features/user/controller"),
  import("../../src/features/auth/controller"),
  import("../../src/features/attendances/controller"),
  import("../../src/middleware/error"),
  import("../../src/db/schema"),
  import("jsonwebtoken"),
  import("../../src/helpers/token"),
]);

export const jwt = jwtModule.default;
export const testDb = db;
export const testUsers = users;
export const testAttendances = attendances;
export const testLeaves = leaves;
export const testSql = sql;
export { eq, inArray, like, verifyToken };

export const api = new Elysia()
  .use(errorMiddleware)
  .use(userController)
  .use(protectedUserController)
  .use(authController)
  .use(attendancesController);

let userSequence = 0;
const temporaryUploadsByNamespace = new Map<string, Set<string>>();

export function validUser(namespace: string, overrides: Record<string, unknown> = {}) {
  userSequence += 1;
  return {
    name: `${namespace} Test User`,
    phone: `628${String(userSequence).padStart(10, "0")}`,
    email: `${namespace}-${userSequence}@example.com`,
    password: "valid-password",
    position: "Engineer",
    role: "employee",
    ...overrides,
  };
}

export async function requestJson(path: string, method: string, body?: unknown, token?: string) {
  const headers = new Headers();
  if (body !== undefined) headers.set("content-type", "application/json");
  if (token) headers.set("authorization", `Bearer ${token}`);
  const response = await api.handle(new Request(`http://localhost${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  }));
  return { response, body: await response.json() as Record<string, any> };
}

export async function requestForm(path: string, method: string, form: FormData, token?: string) {
  const headers = new Headers();
  if (token) headers.set("authorization", `Bearer ${token}`);
  const response = await api.handle(new Request(`http://localhost${path}`, { method, headers, body: form }));
  return { response, body: await response.json() as Record<string, any> };
}

export async function registerUser(namespace: string, payload = validUser(namespace)) {
  return requestJson("/api/users", "POST", payload);
}

export async function loginUser(identifier: string, password = "valid-password") {
  return requestJson("/api/auth/login", "POST", { identifier, password });
}

export async function createUserAndLogin(namespace: string) {
  const payload = validUser(namespace);
  const registration = await registerUser(namespace, payload);
  if (registration.response.status !== 201) throw new Error("Test user registration failed");
  const login = await loginUser(payload.email, payload.password);
  if (login.response.status !== 200) throw new Error("Test user login failed");
  return { payload, token: login.body.data.token as string };
}

export function trackTestUpload(namespace: string, filepath: string) {
  const files = temporaryUploadsByNamespace.get(namespace) ?? new Set<string>();
  files.add(filepath);
  temporaryUploadsByNamespace.set(namespace, files);
}

async function clearNamespace(namespace: string) {
  const emailPattern = `${namespace}-%`;
  const namespaceUsers = await testDb.select({ id: testUsers.id, photo: testUsers.photo })
    .from(testUsers)
    .where(like(testUsers.email, emailPattern));
  const userIds = namespaceUsers.map((user) => user.id);

  const generatedFiles = new Set<string>(temporaryUploadsByNamespace.get(namespace) ?? []);
  for (const user of namespaceUsers) {
    if (user.photo && user.photo !== "profile.webp") {
      generatedFiles.add(join(process.cwd(), "uploads", "profile", user.photo));
    }
  }
  if (userIds.length) {
    const attendanceRows = await testDb.select({ checkInPhoto: testAttendances.check_in_photo })
      .from(testAttendances)
      .where(inArray(testAttendances.user_id, userIds));
    for (const row of attendanceRows) {
      generatedFiles.add(join(process.cwd(), "uploads", "checkin", row.checkInPhoto));
    }
    await testDb.delete(testAttendances).where(inArray(testAttendances.user_id, userIds));
    await testDb.delete(testLeaves).where(inArray(testLeaves.user_id, userIds));
    await testDb.delete(testUsers).where(inArray(testUsers.id, userIds));
  }

  await Promise.all([...generatedFiles].map((filepath) => unlink(filepath).catch(() => undefined)));
  temporaryUploadsByNamespace.delete(namespace);
}

export function isolateApiNamespace(namespace: string) {
  beforeEach(async () => clearNamespace(namespace));
  afterEach(async () => clearNamespace(namespace));
}
