import { randomBytes } from "crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { properties, valuations } from "@/db/schema";
import { authorize } from "@/lib/authz/can";
import { writeAudit } from "@/lib/authz/audit";
import { DomainValidationError, NotFoundError } from "@/lib/authz/errors";
import { resolveEntityId } from "@/lib/services/entity";
import type { CallerContext } from "@/lib/services/types";
import { createValuationSchema, updateValuationSchema } from "@/lib/validation/valuations";
import { parseInput } from "@/lib/validation/parse";

// Valuations reuse the properties.property.* permission keys deliberately —
// they're the same portfolio domain and every role that manages properties
// manages valuation instructions. Dedicated properties.valuation.* keys would
// require a permission re-seed against the already-seeded dev DB (and a
// production rollout); that split is deferred until the standalone valuer
// portal is built. Recorded here so it reads as a decision, not an oversight.

function generateValuationCode(): string {
  const date = new Date();
  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const hash = randomBytes(2).toString("hex").toUpperCase();
  return `VAL-${yy}${mm}-${hash}`;
}

function toDateOrNull(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new DomainValidationError("Invalid date value");
  }
  return parsed;
}

export async function listValuations(ctx: CallerContext) {
  if (!ctx.entityId) throw new DomainValidationError("entityId is required");
  const entityId = await resolveEntityId(ctx.entityId);
  await authorize(ctx, "properties.property.read", entityId);

  return db.select().from(valuations).where(eq(valuations.entityId, entityId));
}

export async function createValuation(ctx: CallerContext, rawInput: unknown) {
  const input = parseInput(createValuationSchema, rawInput);
  const entityId = await resolveEntityId(input.entityId);
  await authorize(ctx, "properties.property.write", entityId);

  if (!input.propertyId && !input.externalPropertyName) {
    throw new DomainValidationError(
      "A valuation needs a subject — pick a portfolio property or name an external one.",
    );
  }

  if (input.propertyId) {
    const [subject] = await db
      .select({ id: properties.id })
      .from(properties)
      .where(and(eq(properties.id, input.propertyId), eq(properties.entityId, entityId)));
    if (!subject) throw new NotFoundError("Subject property not found");
  }

  const siteVisitAt = toDateOrNull(input.siteVisitAt);

  return db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(valuations)
      .values({
        entityId,
        valuationCode: generateValuationCode(),
        propertyId: input.propertyId ?? null,
        externalPropertyName: input.propertyId ? null : (input.externalPropertyName ?? null),
        externalLocation: input.propertyId ? null : (input.externalLocation ?? null),
        clientContactId: input.clientContactId ?? null,
        valuerId: input.valuerId ?? null,
        type: input.type,
        purpose: input.purpose ?? null,
        feeKes: input.feeKes ?? null,
        siteVisitAt,
        // A booked site visit means the instruction is already past "requested".
        status: siteVisitAt ? "scheduled" : "requested",
        notes: input.notes ?? null,
      })
      .returning();

    await writeAudit(tx, ctx, {
      action: "properties.valuation.create",
      associatedType: "valuation",
      associatedId: inserted.id,
      summary: `Opened valuation instruction ${inserted.valuationCode}`,
      entityId,
      before: null,
      after: inserted,
    });

    return inserted;
  });
}

export async function updateValuation(ctx: CallerContext, valuationId: string, rawInput: unknown) {
  const input = parseInput(updateValuationSchema, rawInput);
  if (!ctx.entityId) throw new DomainValidationError("entityId is required");
  const entityId = await resolveEntityId(ctx.entityId);
  await authorize(ctx, "properties.property.write", entityId);

  const [existing] = await db
    .select()
    .from(valuations)
    .where(and(eq(valuations.id, valuationId), eq(valuations.entityId, entityId)));
  if (!existing) throw new NotFoundError("Valuation not found");

  const isCompleting = input.status === "completed" && existing.status !== "completed";
  if (isCompleting && !input.marketValueKes && !existing.marketValueKes) {
    throw new DomainValidationError(
      "Record the appraised market value before marking a valuation completed.",
    );
  }

  // Explicit whitelist, same rationale as updateProperty — the route forwards
  // the raw body, which carries the entityId scoping slug that must never be
  // spread into a .set().
  const updatable: Partial<typeof valuations.$inferInsert> = {};
  if (input.propertyId !== undefined) updatable.propertyId = input.propertyId;
  if (input.externalPropertyName !== undefined) updatable.externalPropertyName = input.externalPropertyName;
  if (input.externalLocation !== undefined) updatable.externalLocation = input.externalLocation;
  if (input.clientContactId !== undefined) updatable.clientContactId = input.clientContactId;
  if (input.valuerId !== undefined) updatable.valuerId = input.valuerId;
  if (input.type !== undefined) updatable.type = input.type;
  if (input.purpose !== undefined) updatable.purpose = input.purpose;
  if (input.status !== undefined) updatable.status = input.status;
  if (input.marketValueKes !== undefined) updatable.marketValueKes = input.marketValueKes;
  if (input.forcedSaleValueKes !== undefined) updatable.forcedSaleValueKes = input.forcedSaleValueKes;
  if (input.insuranceValueKes !== undefined) updatable.insuranceValueKes = input.insuranceValueKes;
  if (input.feeKes !== undefined) updatable.feeKes = input.feeKes;
  if (input.feePaid !== undefined) updatable.feePaid = input.feePaid;
  if (input.siteVisitAt !== undefined) updatable.siteVisitAt = toDateOrNull(input.siteVisitAt);
  if (input.validUntil !== undefined) updatable.validUntil = toDateOrNull(input.validUntil);
  if (input.reportUrl !== undefined) updatable.reportUrl = input.reportUrl;
  if (input.notes !== undefined) updatable.notes = input.notes;

  if (isCompleting) {
    updatable.completedAt = new Date();
    if (input.validUntil === undefined && !existing.validUntil) {
      // Standard shelf life — lenders/insurers treat reports older than six
      // months as stale unless the instruction says otherwise.
      const validUntil = new Date();
      validUntil.setMonth(validUntil.getMonth() + 6);
      updatable.validUntil = validUntil;
    }
  }

  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(valuations)
      .set({ ...updatable, updatedAt: new Date() })
      .where(and(eq(valuations.id, valuationId), eq(valuations.entityId, entityId)))
      .returning();

    await writeAudit(tx, ctx, {
      action: "properties.valuation.update",
      associatedType: "valuation",
      associatedId: valuationId,
      summary: isCompleting
        ? `Completed valuation ${existing.valuationCode}`
        : `Updated valuation ${existing.valuationCode}`,
      entityId,
      before: existing,
      after: updated,
    });

    return updated;
  });
}

export async function deleteValuation(ctx: CallerContext, valuationId: string) {
  if (!ctx.entityId) throw new DomainValidationError("entityId is required");
  const entityId = await resolveEntityId(ctx.entityId);
  await authorize(ctx, "properties.property.write", entityId);

  const [existing] = await db
    .select()
    .from(valuations)
    .where(and(eq(valuations.id, valuationId), eq(valuations.entityId, entityId)));
  if (!existing) throw new NotFoundError("Valuation not found");

  return db.transaction(async (tx) => {
    await tx.delete(valuations).where(eq(valuations.id, valuationId));

    await writeAudit(tx, ctx, {
      action: "properties.valuation.delete",
      associatedType: "valuation",
      associatedId: valuationId,
      summary: `Deleted valuation ${existing.valuationCode}`,
      entityId,
      before: existing,
      after: null,
    });

    return { success: true };
  });
}
