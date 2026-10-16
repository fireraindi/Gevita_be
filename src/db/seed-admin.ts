import { eq, sql } from "drizzle-orm";
import { db } from "./index";
import { users } from "./schema";

const ADMIN_EMAIL = "admin@gevita.com";

export async function seedAdminUser(): Promise<void> {
  await db.transaction(async (transaction) => {
    // Prevent two application instances from seeding an admin at the same time.
    await transaction.execute(sql`select pg_advisory_xact_lock(71920416)`);

    const [existingAdmin] = await transaction.select({ id: users.id })
      .from(users)
      .where(eq(users.role, "admin"))
      .limit(1);

    if (existingAdmin) return;

    const [existingEmail] = await transaction.select({ id: users.id })
      .from(users)
      .where(eq(users.email, ADMIN_EMAIL))
      .limit(1);

    if (existingEmail) return;

    await transaction.insert(users).values({
      id: crypto.randomUUID(),
      name: "Gevita Administrator",
      email: ADMIN_EMAIL,
      phone: "6280000000001",
      password: await Bun.password.hash("admin123"),
      position: "Administrator",
      photo: "profile.webp",
      role: "admin",
      is_active: true,
      salary: 0,
      support_salary: 0,
      overtime_salary: 0,
      pocket_money: 0,
      bank: "N/A",
      account_number: "N/A",
    });
  });
}
