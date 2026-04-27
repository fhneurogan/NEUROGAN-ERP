import { db } from "../db";
import * as schema from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import { storage } from "../storage";
import { verifyPassword } from "../auth/password";
import { MEANING_VERB } from "../signatures/signatures";

export async function createEquipment(
  data: schema.InsertEquipmentDomain,
  userId: string,
  requestId: string,
  route: string,
): Promise<schema.Equipment> {
  return await db.transaction(async (tx) => {
    const existing = await tx
      .select()
      .from(schema.equipment)
      .where(eq(schema.equipment.assetTag, data.assetTag));
    if (existing.length > 0) {
      throw Object.assign(
        new Error("Equipment with this asset tag already exists"),
        { status: 409, code: "DUPLICATE_ASSET_TAG" },
      );
    }
    const [created] = await tx.insert(schema.equipment).values(data).returning();
    await tx.insert(schema.auditTrail).values({
      userId,
      action: "EQUIPMENT_CREATED",
      entityType: "equipment",
      entityId: created!.id,
      after: { assetTag: created!.assetTag, name: created!.name },
      requestId,
      route,
    });
    return created!;
  });
}

export async function listEquipment(): Promise<schema.Equipment[]> {
  return db.select().from(schema.equipment).orderBy(schema.equipment.assetTag);
}

export async function getEquipment(id: string): Promise<schema.Equipment | undefined> {
  const [row] = await db
    .select()
    .from(schema.equipment)
    .where(eq(schema.equipment.id, id));
  return row;
}

export async function retireEquipment(
  id: string,
  userId: string,
  requestId: string,
  route: string,
): Promise<schema.Equipment> {
  return await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(schema.equipment)
      .where(eq(schema.equipment.id, id));
    if (!existing) {
      throw Object.assign(new Error("Equipment not found"), { status: 404 });
    }
    const [updated] = await tx
      .update(schema.equipment)
      .set({ status: "RETIRED" })
      .where(eq(schema.equipment.id, id))
      .returning();
    await tx.insert(schema.auditTrail).values({
      userId,
      action: "EQUIPMENT_RETIRED",
      entityType: "equipment",
      entityId: id,
      before: { status: existing.status },
      after: { status: "RETIRED" },
      requestId,
      route,
    });
    return updated!;
  });
}

// ─── Equipment qualifications (R-03 Task 4) ────────────────────────────────
//
// IQ/OQ/PQ qualification cycles. QA-only; F-04 signature required to mark a
// row as QUALIFIED. Disqualification writes an EXPIRED row with no signature.

export interface RecordQualificationInput {
  type: "IQ" | "OQ" | "PQ";
  status: "PENDING" | "QUALIFIED" | "EXPIRED";
  validFrom?: string;
  validUntil?: string;
  documentUrl?: string;
  notes?: string;
  signaturePassword?: string;
  commentary?: string;
}

export type EquipmentQualificationRow = schema.EquipmentQualification;

export async function recordQualification(
  equipmentId: string,
  userId: string,
  data: RecordQualificationInput,
  requestId: string,
  route: string,
): Promise<EquipmentQualificationRow> {
  // Pre-flight checks (outside ceremony so we fail fast with helpful errors).
  const [existing] = await db
    .select()
    .from(schema.equipment)
    .where(eq(schema.equipment.id, equipmentId));
  if (!existing) {
    throw Object.assign(new Error("Equipment not found"), { status: 404 });
  }

  if (data.status === "QUALIFIED") {
    if (!data.validFrom || !data.validUntil) {
      throw Object.assign(
        new Error("validFrom and validUntil are required when status=QUALIFIED"),
        { status: 400, code: "VALIDITY_WINDOW_REQUIRED" },
      );
    }
    if (!data.signaturePassword) {
      throw Object.assign(
        new Error("signaturePassword required to mark equipment QUALIFIED"),
        { status: 400, code: "SIGNATURE_REQUIRED" },
      );
    }
  }

  const auditAction =
    data.status === "QUALIFIED" ? "EQUIPMENT_QUALIFIED" : "EQUIPMENT_DISQUALIFIED";

  // QUALIFIED: ceremony path. We can't use the standard performSignature
  // helper here because the equipment_qualifications CHECK constraint
  // (qualification_signed_when_qualified) requires signature_id to be NOT
  // NULL on the same INSERT as status='QUALIFIED'. performSignature inserts
  // the signature AFTER fn(tx) runs, so we'd hit the constraint. Instead we
  // inline the ceremony: verify password, then in a single transaction
  // insert signature → insert qualification (with signatureId already set)
  // → insert SIGN + EQUIPMENT_QUALIFIED audit rows.
  //
  // User-load dance mirrors performSignature() — keep in sync if that helper
  // changes its user resolution.
  if (data.status === "QUALIFIED") {
    const fullUser = await storage.getUserByEmail(
      await storage.getUserById(userId).then((u) => {
        if (!u) throw Object.assign(new Error("User not found"), { status: 404 });
        return u.email;
      }),
    );
    if (!fullUser) throw Object.assign(new Error("User not found"), { status: 404 });
    if (fullUser.lockedUntil && fullUser.lockedUntil > new Date()) {
      throw Object.assign(
        new Error("Account temporarily locked due to too many failed attempts."),
        { status: 423, code: "ACCOUNT_LOCKED" },
      );
    }
    const valid = await verifyPassword(fullUser.passwordHash, data.signaturePassword!);
    if (!valid) {
      await storage.recordFailedLogin(fullUser.id);
      throw Object.assign(new Error("Password is incorrect."), {
        status: 401,
        code: "UNAUTHENTICATED",
      });
    }
    await storage.recordSuccessfulLogin(fullUser.id);

    const signedAt = new Date();
    const titlePart = fullUser.title ? ` (${fullUser.title})` : "";
    const manifestation = {
      text: `I, ${fullUser.fullName}${titlePart}, hereby ${MEANING_VERB.EQUIPMENT_QUALIFIED} this record on ${signedAt.toISOString()}.`,
      fullName: fullUser.fullName,
      title: fullUser.title ?? null,
      meaning: "EQUIPMENT_QUALIFIED" as const,
      entityType: "equipment",
      entityId: equipmentId,
      signedAt: signedAt.toISOString(),
      snapshot: {
        type: data.type,
        status: data.status,
        validFrom: data.validFrom ?? null,
        validUntil: data.validUntil ?? null,
      },
    };

    return await db.transaction(async (tx) => {
      // 1. Signature row (must exist before qualification insert due to FK + CHECK).
      const [sigRow] = await tx
        .insert(schema.electronicSignatures)
        .values({
          userId: fullUser.id,
          meaning: "EQUIPMENT_QUALIFIED",
          entityType: "equipment",
          entityId: equipmentId,
          commentary: data.commentary ?? null,
          fullNameAtSigning: fullUser.fullName,
          titleAtSigning: fullUser.title ?? null,
          requestId,
          manifestationJson: manifestation as Record<string, unknown>,
        })
        .returning();

      // 2. Qualification row with signatureId set — satisfies the
      //    qualification_signed_when_qualified CHECK constraint.
      const [created] = await tx
        .insert(schema.equipmentQualifications)
        .values({
          equipmentId,
          type: data.type,
          status: data.status,
          validFrom: data.validFrom ?? null,
          validUntil: data.validUntil ?? null,
          signatureId: sigRow!.id,
          documentUrl: data.documentUrl ?? null,
          notes: data.notes ?? null,
        })
        .returning();

      // 3. SIGN audit row (matches what performSignature would write).
      await tx.insert(schema.auditTrail).values({
        userId: fullUser.id,
        action: "SIGN",
        entityType: "equipment",
        entityId: equipmentId,
        before: null,
        after: { qualificationId: created!.id, type: data.type, status: data.status },
        route,
        requestId,
        meta: { signatureId: sigRow!.id, meaning: "EQUIPMENT_QUALIFIED" },
      });

      // 4. Domain audit row (per AC).
      await tx.insert(schema.auditTrail).values({
        userId,
        action: auditAction,
        entityType: "equipment",
        entityId: equipmentId,
        after: {
          qualificationId: created!.id,
          type: data.type,
          status: data.status,
          validFrom: data.validFrom ?? null,
          validUntil: data.validUntil ?? null,
        },
        requestId,
        route,
      });

      return created!;
    });
  }

  // Non-QUALIFIED (PENDING / EXPIRED): no signature ceremony, plain insert.
  return await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(schema.equipmentQualifications)
      .values({
        equipmentId,
        type: data.type,
        status: data.status,
        validFrom: data.validFrom ?? null,
        validUntil: data.validUntil ?? null,
        signatureId: null,
        documentUrl: data.documentUrl ?? null,
        notes: data.notes ?? null,
      })
      .returning();
    await tx.insert(schema.auditTrail).values({
      userId,
      action: auditAction,
      entityType: "equipment",
      entityId: equipmentId,
      after: {
        qualificationId: created!.id,
        type: data.type,
        status: data.status,
        validFrom: data.validFrom ?? null,
        validUntil: data.validUntil ?? null,
      },
      requestId,
      route,
    });
    return created!;
  });
}

export async function listQualifications(
  equipmentId: string,
): Promise<EquipmentQualificationRow[]> {
  return db
    .select()
    .from(schema.equipmentQualifications)
    .where(eq(schema.equipmentQualifications.equipmentId, equipmentId))
    .orderBy(desc(schema.equipmentQualifications.createdAt));
}

// Returns the set of types currently qualified using latest-wins semantics:
// the most recent row for a given type must be status=QUALIFIED AND
// today's date must be within [validFrom, validUntil].
export async function getActiveQualifiedTypes(
  equipmentId: string,
): Promise<Set<"IQ" | "OQ" | "PQ">> {
  const rows = await db
    .select()
    .from(schema.equipmentQualifications)
    .where(eq(schema.equipmentQualifications.equipmentId, equipmentId))
    .orderBy(desc(schema.equipmentQualifications.createdAt));

  const today = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
  const seen = new Set<"IQ" | "OQ" | "PQ">();
  const active = new Set<"IQ" | "OQ" | "PQ">();

  for (const row of rows) {
    const type = row.type;
    if (seen.has(type)) continue; // latest-wins: skip older rows
    seen.add(type);
    if (
      row.status === "QUALIFIED" &&
      row.validFrom &&
      row.validUntil &&
      row.validFrom <= today &&
      today <= row.validUntil
    ) {
      active.add(type);
    }
  }
  return active;
}
