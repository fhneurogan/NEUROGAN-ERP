import { describe, it, expect, beforeEach } from "vitest";
import { storage } from "../storage";
import { db } from "../db";
import * as schema from "@shared/schema";
import { eq } from "drizzle-orm";
import { hashPassword } from "../auth/password";

const dbUrl = process.env.DATABASE_URL;
const describeIfDb = dbUrl ? describe : describe.skip;

describeIfDb("addLabTestResult OOS hook", () => {
  let qaUser: schema.User;
  let lotId: string;
  let coaId: string;

  beforeEach(async () => {
    [qaUser] = await db.insert(schema.users).values({
      email: `qa-${Date.now()}@test.local`,
      fullName: "QA User",
      passwordHash: await hashPassword("Test1234!Password"),
      status: "ACTIVE",
    }).returning();
    const [product] = await db.insert(schema.products).values({ sku: `P-${Date.now()}`, name: "P" }).returning();
    const [lot] = await db.insert(schema.lots).values({
      productId: product.id, lotNumber: `LOT-${Date.now()}`, quarantineStatus: "PENDING_QC",
    }).returning();
    lotId = lot.id;
    const [coa] = await db.insert(schema.coaDocuments).values({ lotId }).returning();
    coaId = coa.id;
  });

  it("pass=true does NOT create an investigation", async () => {
    await db.transaction((tx) => storage.addLabTestResult(coaId, {
      analyteName: "moisture", resultValue: "5", specMin: "0", specMax: "10", pass: true,
    } as any, qaUser.id, tx));
    const invs = await db.select().from(schema.oosInvestigations).where(eq(schema.oosInvestigations.coaDocumentId, coaId));
    expect(invs).toHaveLength(0);
  });

  it("pass=false creates an investigation and flips lot to ON_HOLD", async () => {
    await db.transaction((tx) => storage.addLabTestResult(coaId, {
      analyteName: "potency", resultValue: "85", specMin: "90", specMax: "110", pass: false,
    } as any, qaUser.id, tx));
    const invs = await db.select().from(schema.oosInvestigations).where(eq(schema.oosInvestigations.coaDocumentId, coaId));
    expect(invs).toHaveLength(1);
    const [lot] = await db.select().from(schema.lots).where(eq(schema.lots.id, lotId));
    expect(lot.quarantineStatus).toBe("ON_HOLD");
  });

  it("second pass=false on same COA attaches to existing investigation", async () => {
    await db.transaction((tx) => storage.addLabTestResult(coaId, {
      analyteName: "potency", resultValue: "85", specMin: "90", specMax: "110", pass: false,
    } as any, qaUser.id, tx));
    await db.transaction((tx) => storage.addLabTestResult(coaId, {
      analyteName: "microbial", resultValue: "1500", specMin: "0", specMax: "1000", pass: false,
    } as any, qaUser.id, tx));
    const invs = await db.select().from(schema.oosInvestigations).where(eq(schema.oosInvestigations.coaDocumentId, coaId));
    expect(invs).toHaveLength(1);
    const junction = await db.select().from(schema.oosInvestigationTestResults).where(eq(schema.oosInvestigationTestResults.investigationId, invs[0].id));
    expect(junction).toHaveLength(2);
  });

  it("REJECTED lot is NOT flipped back to ON_HOLD by a failing test", async () => {
    await db.update(schema.lots).set({ quarantineStatus: "REJECTED" }).where(eq(schema.lots.id, lotId));
    await db.transaction((tx) => storage.addLabTestResult(coaId, {
      analyteName: "potency", resultValue: "85", specMin: "90", specMax: "110", pass: false,
    } as any, qaUser.id, tx));
    const [lot] = await db.select().from(schema.lots).where(eq(schema.lots.id, lotId));
    expect(lot.quarantineStatus).toBe("REJECTED");
  });
});
