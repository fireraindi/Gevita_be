# Gevita API tests

The API integration tests are split into `auth.test.ts`, `user.test.ts`, and
`attendance.test.ts`. They run against a dedicated PostgreSQL database. Before
testing, the shared helper applies the current TypeScript schema with
`drizzle-kit push`. Every test cleans up only its own namespaced test users and
dependent attendance rows, so the three files can safely run concurrently.
Photos uploaded by a test are removed after that scenario.

Set `TEST_DATABASE_URL` to the dedicated database before running `bun test`.
The suite refuses to start if this URL points to the same database as
`DATABASE_URL`.

Create the database before running tests. Do not point `TEST_DATABASE_URL` at a
development or production database.
