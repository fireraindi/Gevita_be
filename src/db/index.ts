import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

const queryClient = postgres(process.env.DATABASE_URL || "postgres://user:password@localhost:5432/db");
export const db = drizzle(queryClient);
