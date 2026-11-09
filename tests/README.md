# Gevita API tests

The API integration tests are organized into test suites covering:
- `auth.test.ts`: Authentication, login, rate limiting, and current user profile (`/api/auth/*`).
- `user.test.ts`: User management, registration, update, list, and password changes (`/api/users/*`).
- `attendance.test.ts`: Check-in, check-out, history, today status, stats, and admin management (`/api/attendances/*`).
- `leave.test.ts`: Leave applications, employee history, admin listing, detail, approve, and reject (`/api/leaves/*`).
- `job.test.ts`: Job creation and salary management (`/api/jobs/*`).

They run against a dedicated PostgreSQL database. Before testing, the shared helper applies the current TypeScript schema with `drizzle-kit push`. Every test cleans up only its own namespaced test users and dependent rows, allowing suites to run safely. Photos uploaded during tests are cleaned up automatically after each scenario.

## Requirements & Environment Variables

Set `TEST_DATABASE_URL` to a dedicated test database before running tests:
```bash
export TEST_DATABASE_URL="postgres://user:password@localhost:5432/gevita_test"
export JWT_SECRET="api-tests-only-secret"
```

The suite refuses to start if `TEST_DATABASE_URL` points to the same database as `DATABASE_URL`. Do not point `TEST_DATABASE_URL` at a development or production database.

## Running Tests & Type Checking

To run all integration tests:
```bash
bun test
```

To run a specific test suite:
```bash
bun test tests/leave.test.ts
```

To run TypeScript type checking without emitting files:
```bash
bun run typecheck
```
