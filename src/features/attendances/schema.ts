import { pgTable, serial, varchar, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { users } from "../user/schema";

export const attendanceStatusEnum = pgEnum('attendance_status', ['Hadir', 'Terlambat', 'Tidak Hadir', 'Sakit', 'Cuti', 'Dinas']);

export const attendances = pgTable('attendances', {
  id: serial('id').primaryKey(),
  user_id: varchar('user_id', { length: 255 }).references(() => users.id).notNull(),
  check_in_time: timestamp('check_in_time').notNull(),
  check_out_time: timestamp('check_out_time'),
  check_in_photo: varchar('check_in_photo', { length: 255 }).notNull(),
  status: attendanceStatusEnum('status').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
  deleted_at: timestamp('deleted_at'),
});
