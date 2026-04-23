// One-off ops script: seed the core user accounts on a fresh or reset database.
// Safe to re-run — all inserts use ON CONFLICT DO NOTHING so existing accounts
// and passwords are never overwritten.
//
// Usage: DATABASE_URL=... tsx scripts/seed-users.ts
// Via Railway: railway run --service neurogan-erp pnpm seed:users

import { seedUsers } from "../server/seed/test/fixtures/users";

async function main() {
  console.log("Seeding users…");
  await seedUsers();
  console.log("Done. Existing accounts were not modified.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
