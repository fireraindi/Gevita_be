import { pgTable, varchar, timestamp, date, text, pgEnum, serial } from "drizzle-orm/pg-core";
import { users } from "../user/schema";

export const leaveStatusEnum = pgEnum('leave_status', ['Pending', 'Approved', 'Rejected']);
export const categoryEnum = pgEnum("category", ["sakit", "cuti"]);

export const leaves = pgTable('leaves', {
  id: serial('id').primaryKey(),
  user_id: varchar('user_id', { length: 255 }).references(() => users.id).notNull(),
  start_date: date('start_date').notNull(),
  end_date: date('end_date').notNull(),
  reason: text('reason').notNull(),
  category: categoryEnum('category').notNull(),
  status: leaveStatusEnum('status').notNull().default('Pending'),
  image: varchar('image', { length: 255 }),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
  deleted_at: timestamp('deleted_at'),
});
