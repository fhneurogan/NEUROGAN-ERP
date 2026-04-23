import "../server/db";
import { seedValidationDocuments } from "../server/seed/test/fixtures/validationDocuments";

async function main() {
  console.log("Seeding validation documents…");
  await seedValidationDocuments();
  console.log("Done.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
