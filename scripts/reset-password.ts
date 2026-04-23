// One-off admin tool: reset a user's password by email.
// Usage: DATABASE_URL=... tsx scripts/reset-password.ts <email> <new-password>
// Example: ! DATABASE_URL=... tsx scripts/reset-password.ts fhv@neurogan.com "NewPass1!abc"

import { db } from "../server/db";
import * as schema from "@shared/schema";
import { hashPassword } from "../server/auth/password";
import { eq } from "drizzle-orm";

async function main() {
  const [email, newPassword] = process.argv.slice(2);

  if (!email || !newPassword) {
    console.error("Usage: tsx scripts/reset-password.ts <email> <new-password>");
    process.exit(1);
  }

  const user = await db
    .select({ id: schema.users.id, email: schema.users.email, status: schema.users.status })
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .then((r) => r[0]);

  if (!user) {
    console.error(`No user found with email: ${email}`);
    process.exit(1);
  }

  if (user.status !== "ACTIVE") {
    console.error(`User ${email} is ${user.status} — cannot reset password.`);
    process.exit(1);
  }

  const hash = await hashPassword(newPassword);

  await db
    .update(schema.users)
    .set({ passwordHash: hash, failedLoginAttempts: 0, lockedUntil: null })
    .where(eq(schema.users.id, user.id));

  console.log(`Password reset for ${email}. Failed-login counter cleared.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
