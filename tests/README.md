# Auth API tests

The auth tests run against a dedicated PostgreSQL database. Before testing, the
suite applies the current TypeScript schema to it with `drizzle-kit push`. It
then truncates the user table (cascading to dependent rows) before every test.
Set `TEST_DATABASE_URL` to that database before running `bun test`. The test
suite refuses to start if this URL points to the same database as `DATABASE_URL`.

Create the database before running tests. Do not point `TEST_DATABASE_URL` at a
development or production database.
