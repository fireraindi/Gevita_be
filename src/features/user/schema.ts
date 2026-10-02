import { pgTable, varchar, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";

export const roleEnum = pgEnum('role', ['admin', 'employee']);

export const users = pgTable('users', {
    id: varchar('id', { length: 255 }).primaryKey(),
    name: varchar('name', { length: 100 }).notNull(),
    email: varchar('email', { length: 100 }).notNull().unique(),
    phone: varchar('phone', { length: 20 }).notNull().unique(),
    password: varchar('password', { length: 255 }).notNull(),
    position: varchar('position', { length: 100 }).notNull(),
    photo: varchar('photo', { length: 255 }).default('profile.webp'),
    role: roleEnum('role').notNull().default('employee'),
    is_active: boolean('is_active').notNull().default(true),
    created_at: timestamp('created_at').defaultNow().notNull(),
    updated_at: timestamp('updated_at').defaultNow().notNull(),
    deleted_at: timestamp('deleted_at'),
});
