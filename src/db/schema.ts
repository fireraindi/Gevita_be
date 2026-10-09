import { boolean, date, pgEnum, pgTable, serial, text, timestamp, unique, varchar } from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["admin", "employee"]);
export const leaveStatusEnum = pgEnum("leave_status", ["Pending", "Approved", "Rejected"]);
export const categoryEnum = pgEnum("category", ["sakit", "cuti"]);
export const attendanceStatusEnum = pgEnum("attendance_status", ["Hadir", "Terlambat", "Tidak Hadir", "Sakit", "Cuti", "Dinas"]);

export const users = pgTable("users", {
  id: varchar("id", { length: 255 }).primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  email: varchar("email", { length: 100 }).notNull().unique(),
  phone: varchar("phone", { length: 20 }).notNull().unique(),
  password: varchar("password", { length: 255 }).notNull(),
  position: varchar("position", { length: 100 }).notNull(),
  photo: varchar("photo", { length: 255 }).default("profile.webp"),
  role: roleEnum("role").notNull().default("employee"),
  is_active: boolean("is_active").notNull().default(true),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

export const leaves = pgTable("leaves", {
  id: serial("id").primaryKey(),
  user_id: varchar("user_id", { length: 255 }).references(() => users.id).notNull(),
  start_date: date("start_date").notNull(),
  end_date: date("end_date").notNull(),
  reason: text("reason").notNull(),
  category: categoryEnum("category").notNull(),
  status: leaveStatusEnum("status").notNull().default("Pending"),
  image: varchar("image", { length: 255 }),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
  deleted_at: timestamp("deleted_at"),
});

export const attendances = pgTable("attendances", {
  id: serial("id").primaryKey(),
  user_id: varchar("user_id", { length: 255 }).references(() => users.id).notNull(),
  date: date("date").notNull(),
  check_in_time: timestamp("check_in_time").notNull(),
  check_out_time: timestamp("check_out_time"),
  check_in_photo: varchar("check_in_photo", { length: 255 }).notNull(),
  status: attendanceStatusEnum("status").notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
  deleted_at: timestamp("deleted_at"),
}, (table) => [unique("attendances_user_id_date_unique").on(table.user_id, table.date)]);
