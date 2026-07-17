import { randomBytes } from "crypto";
import { and, eq, getTableColumns } from "drizzle-orm";
import { db } from "@/db";
import { contacts, entities, properties, propertyMandates, users, valuations } from "@/db/schema";
import { authorize } from "@/lib/authz/can";
import { writeAudit } from "@/lib/authz/audit";
import { DomainValidationError, NotFoundError } from "@/lib/authz/errors";
import { createMandate } from "@/lib/services/mandates";
import { createProperty } from "@/lib/services/properties";
import { resolveEntityId } from "@/lib/services/entity";
import type { CallerContext } from "@/lib/services/types";
import {
  createValuationSchema,
  submitValuationSchema,
  updateValuationSchema,
} from "@/lib/validation/valuations";
import { parseInput } from "@/lib/validation/parse";
// Pure stage-adjacency/scoring logic lives in the client-safe constants
// module (no `db`/`crypto` imports) so client components - kanban drag
// preview, score badges - can import the exact same functions; re-exported
// here so server call sites only need to import from the service.
import { canMoveToStage, daysSince, scoreForValuation, type ValuationStage } from "@/components/sunland/valuation-constants";

export { canMoveToStage, daysSince, scoreForValuation };
export type { ValuationStage };

// Valuations reuse the properties.property.* permission keys deliberately -
// they're the same portfolio domain and every role that manages properties
// manages this acquisition pipeline. Dedicated properties.valuation.* keys
// would require a permission re-seed; that split is deferred, same decision
// as before the 2026-07-17 repurpose.

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

  return db
    .select({
      ...getTableColumns(valuations),
      propertyName: properties.name,
      propertyLocation: properties.location,
      propertyMedia: properties.media,
      landlordName: contacts.displayName,
      landlordVerifiedAt: contacts.verifiedAt,
      landlordAvatarUrl: contacts.avatarUrl,
      managerName: users.name,
      managerAvatarUrl: users.avatarUrl,
    })
    .from(valuations)
    .leftJoin(properties, eq(valuations.propertyId, properties.id))
    .leftJoin(contacts, eq(valuations.landlordContactId, contacts.id))
    .leftJoin(users, eq(valuations.assignedManagerId, users.id))
    .where(eq(valuations.entityId, entityId));
}

export async function getValuation(ctx: CallerContext, valuationId: string) {
  if (!ctx.entityId) throw new DomainValidationError("entityId is required");
  const entityId = await resolveEntityId(ctx.entityId);
  await authorize(ctx, "properties.property.read", entityId);

  const [row] = await db
    .select({
      ...getTableColumns(valuations),
      propertyName: properties.name,
      propertyCode: properties.propertyCode,
      propertyLocation: properties.location,
      propertyMedia: properties.media,
      landlordName: contacts.displayName,
      landlordEmail: contacts.email,
      landlordPhone: contacts.phone,
      landlordVerifiedAt: contacts.verifiedAt,
      landlordAvatarUrl: contacts.avatarUrl,
      managerName: users.name,
      valuersEntityName: entities.name,
    })
    .from(valuations)
    .leftJoin(properties, eq(valuations.propertyId, properties.id))
    .leftJoin(contacts, eq(valuations.landlordContactId, contacts.id))
    .leftJoin(users, eq(valuations.assignedManagerId, users.id))
    .leftJoin(entities, eq(entities.slug, "valuers"))
    .where(and(eq(valuations.id, valuationId), eq(valuations.entityId, entityId)))
    .limit(1);

  if (!row) throw new NotFoundError("Valuation not found");

  const [namedValuer] = row.valuerId
    ? await db.select({ name: users.name, email: users.email }).from(users).where(eq(users.id, row.valuerId))
    : [];

  return { ...row, valuerName: namedValuer?.name ?? null, valuerEmail: namedValuer?.email ?? null };
}

export async function createValuation(ctx: CallerContext, rawInput: unknown) {
  const input = parseInput(createValuationSchema, rawInput);
  const entityId = await resolveEntityId(input.entityId);
  await authorize(ctx, "properties.property.write", entityId);

  if (!input.propertyId && !input.externalPropertyName) {
    throw new DomainValidationError(
      "A valuation needs a subject - pick a portfolio property or name an external one.",
    );
  }

  if (input.propertyId) {
    const [subject] = await db
      .select({ id: properties.id })
      .from(properties)
      .where(and(eq(properties.id, input.propertyId), eq(properties.entityId, entityId)));
    if (!subject) throw new NotFoundError("Subject property not found");
  }

  if (input.assignedManagerId) {
    const [manager] = await db.select().from(users).where(eq(users.id, input.assignedManagerId)).limit(1);
    if (!manager) throw new NotFoundError("Property manager not found");
    if (manager.role !== "property_manager") {
      throw new DomainValidationError("Selected staff member is not a Property Manager");
    }
  }

  const siteVisitAt = toDateOrNull(input.siteVisitAt);
  const now = new Date();

  return db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(valuations)
      .values({
        entityId,
        valuationCode: generateValuationCode(),
        propertyId: input.propertyId ?? null,
        externalPropertyName: input.propertyId ? null : (input.externalPropertyName ?? null),
        externalLocation: input.propertyId ? null : (input.externalLocation ?? null),
        landlordContactId: input.landlordContactId ?? null,
        assignedManagerId: input.assignedManagerId ?? null,
        valuerId: input.valuerId ?? null,
        externalValuerName: input.valuerId ? null : (input.externalValuerName ?? null),
        isLand: input.isLand,
        // A booked site visit means the prospect is already past "requested".
        stage: siteVisitAt ? "site_visit" : "requested",
        siteVisitAt,
        stageEnteredAt: now,
        notes: input.notes ?? null,
      })
      .returning();

    await writeAudit(tx, ctx, {
      action: "properties.valuation.create",
      associatedType: "valuation",
      associatedId: inserted.id,
      summary: `${ctx.user.name} scheduled a valuation for ${inserted.externalPropertyName ?? "a portfolio property"} (${inserted.valuationCode})`,
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

  // Explicit whitelist, same rationale as updateProperty - the route forwards
  // the raw body, which carries the entityId scoping slug that must never be
  // spread into a .set(). Stage is deliberately absent - see
  // updateValuationSchema's comment.
  const updatable: Partial<typeof valuations.$inferInsert> = {};
  if (input.propertyId !== undefined) updatable.propertyId = input.propertyId;
  if (input.externalPropertyName !== undefined) updatable.externalPropertyName = input.externalPropertyName;
  if (input.externalLocation !== undefined) updatable.externalLocation = input.externalLocation;
  if (input.landlordContactId !== undefined) updatable.landlordContactId = input.landlordContactId;
  if (input.assignedManagerId !== undefined) updatable.assignedManagerId = input.assignedManagerId;
  if (input.valuerId !== undefined) updatable.valuerId = input.valuerId;
  if (input.externalValuerName !== undefined) updatable.externalValuerName = input.externalValuerName;
  if (input.isLand !== undefined) updatable.isLand = input.isLand;
  if (input.marketValueKes !== undefined) updatable.marketValueKes = input.marketValueKes;
  if (input.proposedFeeRate !== undefined) updatable.proposedFeeRate = input.proposedFeeRate;
  if (input.methodology !== undefined) updatable.methodology = input.methodology;
  if (input.siteVisitAt !== undefined) updatable.siteVisitAt = toDateOrNull(input.siteVisitAt);
  if (input.validUntil !== undefined) updatable.validUntil = toDateOrNull(input.validUntil);
  if (input.reportUrl !== undefined) updatable.reportUrl = input.reportUrl;
  if (input.notes !== undefined) updatable.notes = input.notes;

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
      summary: `${ctx.user.name} updated valuation ${existing.valuationCode}`,
      entityId,
      before: existing,
      after: updated,
    });

    return updated;
  });
}

async function loadValuationForTransition(ctx: CallerContext, valuationId: string) {
  if (!ctx.entityId) throw new DomainValidationError("entityId is required");
  const entityId = await resolveEntityId(ctx.entityId);
  await authorize(ctx, "properties.property.write", entityId);

  const [existing] = await db
    .select()
    .from(valuations)
    .where(and(eq(valuations.id, valuationId), eq(valuations.entityId, entityId)));
  if (!existing) throw new NotFoundError("Valuation not found");
  return { entityId, existing };
}

/**
 * The one function every stage-changing action funnels through (kanban
 * drag, detail-page action buttons, decline/reopen). canMoveToStage() is
 * enforced here, not left to the caller.
 */
export async function transitionValuationStage(ctx: CallerContext, valuationId: string, toStage: ValuationStage) {
  const { entityId, existing } = await loadValuationForTransition(ctx, valuationId);

  if (!canMoveToStage(existing.stage, toStage)) {
    throw new DomainValidationError(`Cannot move from "${existing.stage}" to "${toStage}" - only adjacent stages, or a decline/reopen, are allowed.`);
  }

  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(valuations)
      .set({ stage: toStage, stageEnteredAt: new Date(), updatedAt: new Date() })
      .where(eq(valuations.id, valuationId))
      .returning();

    await writeAudit(tx, ctx, {
      action: "properties.valuation.transition",
      associatedType: "valuation",
      associatedId: valuationId,
      summary: `${ctx.user.name} moved ${existing.valuationCode} from "${existing.stage}" to "${toStage}"`,
      entityId,
      before: existing,
      after: updated,
    });

    return updated;
  });
}

/**
 * The site_visit -> valued transition specifically: captures real,
 * user-entered assessed value/proposed fee/methodology/comparables in the
 * same call, matching the old ValuationCompleteModal's "capture then
 * transition" shape - never synthesized from other fields.
 */
export async function submitValuation(ctx: CallerContext, valuationId: string, rawInput: unknown) {
  const input = parseInput(submitValuationSchema, rawInput);
  const { entityId, existing } = await loadValuationForTransition(ctx, valuationId);

  if (!canMoveToStage(existing.stage, "valued")) {
    throw new DomainValidationError(`Cannot submit a valuation from stage "${existing.stage}".`);
  }

  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(valuations)
      .set({
        stage: "valued",
        stageEnteredAt: new Date(),
        marketValueKes: input.marketValueKes,
        proposedFeeRate: input.proposedFeeRate,
        methodology: input.methodology ?? null,
        comparables: input.comparables ?? null,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(valuations.id, valuationId))
      .returning();

    await writeAudit(tx, ctx, {
      action: "properties.valuation.submit",
      associatedType: "valuation",
      associatedId: valuationId,
      summary: `${ctx.user.name} submitted a valuation of KES ${Number(input.marketValueKes).toLocaleString()} for ${existing.valuationCode}`,
      entityId,
      before: existing,
      after: updated,
    });

    return updated;
  });
}

/**
 * The accepted -> mandate_signed transition. Requires current stage
 * "accepted". If this prospect is an external/off-portfolio subject
 * (propertyId null), first creates a real properties row from the external
 * fields - createMandate() has no lightweight "prospect property" concept,
 * it always requires a real properties row. Then calls the real, existing
 * createMandate() untouched (its own approval-tier/self-approval logic
 * still applies). Sets resultingMandateId so "Open Mandate File" is a real
 * deep link, not a static route. This makes "Mandate Signed" an actual
 * backend event, not a status flip.
 */
export async function signMandateFromValuation(ctx: CallerContext, valuationId: string) {
  const { existing } = await loadValuationForTransition(ctx, valuationId);

  if (existing.stage !== "accepted") {
    throw new DomainValidationError('A mandate can only be signed from the "accepted" stage.');
  }
  if (!existing.landlordContactId) {
    throw new DomainValidationError("A landlord contact is required before a mandate can be signed.");
  }
  if (!existing.proposedFeeRate) {
    throw new DomainValidationError("A proposed fee rate is required before a mandate can be signed.");
  }

  let propertyId = existing.propertyId;
  if (!propertyId) {
    if (!existing.externalPropertyName || !existing.externalLocation) {
      throw new DomainValidationError("This prospect has no property name/location on record - cannot create a mandate.");
    }
    const newProperty = await createProperty(ctx, {
      name: existing.externalPropertyName,
      propertyType: existing.isLand ? "Land" : "Residential",
      listingType: "Rental",
      location: existing.externalLocation,
      ownerContactId: existing.landlordContactId,
    });
    propertyId = newProperty.id;
  }

  const mandate = await createMandate(ctx, {
    entityId: existing.entityId,
    propertyId,
    landlordContactId: existing.landlordContactId,
    mandateRate: existing.proposedFeeRate,
    // createMandate requires a justification whenever the rate differs from
    // the entity's default - this rate came from the acquisition valuation
    // itself (assessed value + landlord negotiation), which is the real
    // justification, not a placeholder.
    rateJustification: `Rate proposed during acquisition valuation ${existing.valuationCode}, based on the assessed value and landlord negotiation.`,
    assignedPmId: existing.assignedManagerId ?? undefined,
    startDate: new Date().toISOString(),
  });

  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(valuations)
      .set({
        stage: "mandate_signed",
        stageEnteredAt: new Date(),
        propertyId,
        resultingMandateId: mandate.id,
        updatedAt: new Date(),
      })
      .where(eq(valuations.id, valuationId))
      .returning();

    await writeAudit(tx, ctx, {
      action: "properties.valuation.sign_mandate",
      associatedType: "valuation",
      associatedId: valuationId,
      summary: `${ctx.user.name} converted ${existing.valuationCode} into a management mandate`,
      entityId: existing.entityId,
      before: existing,
      after: updated,
    });

    return { ...updated, mandate };
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
