import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { storage } from "../storage";
import { db } from "../db";
import * as schema from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { hashPassword } from "../auth/password";

const dbUrl = process.env.DATABASE_URL;
const describeIfDb = dbUrl ? describe : describe.skip;

describeIfDb("OOS investigation storage", () => {
  let qaUser: schema.User;
  let lotId: string;
  let coaId: string;
  let labTestResult1: schema.LabTestResult;
  let labTestResult2: schema.LabTestResult;

  beforeAll(async () => {
    // wipe in dependency order
    await db.delete(schema.oosInvestigationTestResults);
    await db.delete(schema.oosInvestigations);
    await db.delete(schema.oosInvestigationCounter);
  });

  beforeEach(async () => {
    [qaUser] = await db.insert(schema.users).values({
      email: `qa-${Date.now()}@test.local`,
      fullName: "QA User",
      passwordHash: await hashPassword("Test1234!Password"),
      status: "ACTIVE",
    }).returning();
    await db.insert(schema.userRoles).values({ userId: qaUser.id, role: "QA" });

    const [product] = await db.insert(schema.products).values({ sku: `P-${Date.now()}`, name: "Test Product" }).returning();
    const [lot] = await db.insert(schema.lots).values({
      productId: product.id, lotNumber: `LOT-${Date.now()}`, quarantineStatus: "PENDING_QC",
    }).returning();
    lotId = lot.id;

    const [coa] = await db.insert(schema.coaDocuments).values({ lotId }).returning();
    coaId = coa.id;

    [labTestResult1] = await db.insert(schema.labTestResults).values({
      coaDocumentId: coaId, analyteName: "potency", resultValue: "85",
      specMin: "90", specMax: "110", pass: false, testedByUserId: qaUser.id,
    }).returning();
    [labTestResult2] = await db.insert(schema.labTestResults).values({
      coaDocumentId: coaId, analyteName: "microbial", resultValue: "1500",
      specMin: "0", specMax: "1000", pass: false, testedByUserId: qaUser.id,
    }).returning();
  });

  it("creates investigation with OOS-YYYY-001 number on first failure", async () => {
    const inv = await db.transaction(async (tx) => {
      return await storage.getOrCreateOpenOosInvestigation(coaId, lotId, labTestResult1.id, qaUser.id, "rid-1", "POST /test", tx);
    });
    expect(inv.status).toBe("OPEN");
    const year = new Date().getFullYear();
    expect(inv.oosNumber).toBe(`OOS-${year}-001`);
    expect(inv.coaDocumentId).toBe(coaId);
    expect(inv.lotId).toBe(lotId);
    const junction = await db.select().from(schema.oosInvestigationTestResults).where(eq(schema.oosInvestigationTestResults.investigationId, inv.id));
    expect(junction).toHaveLength(1);
    expect(junction[0].labTestResultId).toBe(labTestResult1.id);
    const audit = await db.select().from(schema.auditTrail).where(and(eq(schema.auditTrail.entityType, "oos_investigation"), eq(schema.auditTrail.entityId, inv.id), eq(schema.auditTrail.action, "OOS_OPENED")));
    expect(audit).toHaveLength(1);
  });

  it("is idempotent on same COA — returns existing, attaches second test result, no new audit", async () => {
    const inv1 = await db.transaction(async (tx) =>
      storage.getOrCreateOpenOosInvestigation(coaId, lotId, labTestResult1.id, qaUser.id, "rid-1", "POST /test", tx));
    const inv2 = await db.transaction(async (tx) =>
      storage.getOrCreateOpenOosInvestigation(coaId, lotId, labTestResult2.id, qaUser.id, "rid-2", "POST /test", tx));
    expect(inv2.id).toBe(inv1.id);
    const junction = await db.select().from(schema.oosInvestigationTestResults).where(eq(schema.oosInvestigationTestResults.investigationId, inv1.id));
    expect(junction).toHaveLength(2);
    const audit = await db.select().from(schema.auditTrail).where(and(eq(schema.auditTrail.entityType, "oos_investigation"), eq(schema.auditTrail.entityId, inv1.id), eq(schema.auditTrail.action, "OOS_OPENED")));
    expect(audit).toHaveLength(1);
  });

  it("increments counter for second investigation in the same year", async () => {
    await db.transaction(async (tx) =>
      storage.getOrCreateOpenOosInvestigation(coaId, lotId, labTestResult1.id, qaUser.id, "rid-1", "POST /test", tx));
    // Create second COA + new failing result for same lot
    const [coa2] = await db.insert(schema.coaDocuments).values({ lotId }).returning();
    const [r3] = await db.insert(schema.labTestResults).values({
      coaDocumentId: coa2.id, analyteName: "ph", resultValue: "2", specMin: "5", specMax: "9", pass: false, testedByUserId: qaUser.id,
    }).returning();
    const inv2 = await db.transaction(async (tx) =>
      storage.getOrCreateOpenOosInvestigation(coa2.id, lotId, r3.id, qaUser.id, "rid-3", "POST /test", tx));
    const year = new Date().getFullYear();
    expect(inv2.oosNumber).toBe(`OOS-${year}-002`);
  });

  it("getOosInvestigationById returns full detail", async () => {
    const inv = await db.transaction(async (tx) =>
      storage.getOrCreateOpenOosInvestigation(coaId, lotId, labTestResult1.id, qaUser.id, "rid-1", "POST /test", tx));
    const detail = await storage.getOosInvestigationById(inv.id);
    expect(detail).not.toBeNull();
    expect(detail!.id).toBe(inv.id);
    expect(detail!.lotId).toBe(lotId);
    expect(detail!.testResults).toHaveLength(1);
    expect(detail!.testResults[0].id).toBe(labTestResult1.id);
  });

  it("listOosInvestigations filters by status default OPEN", async () => {
    await db.transaction(async (tx) =>
      storage.getOrCreateOpenOosInvestigation(coaId, lotId, labTestResult1.id, qaUser.id, "rid-1", "POST /test", tx));
    const open = await storage.listOosInvestigations({ status: "OPEN" });
    expect(open.length).toBeGreaterThanOrEqual(1);
    const closed = await storage.listOosInvestigations({ status: "CLOSED" });
    expect(closed.every((i) => i.status === "CLOSED")).toBe(true);
  });
});
