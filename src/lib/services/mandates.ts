import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { approvalRequests, contacts, mandateStatus, properties, propertyMandates, users } from "@/db/schema";
import { authorize } from "@/lib/authz/can";
import { writeAudit } from "@/lib/authz/audit";
import { ConflictError, DomainValidationError, NotFoundError } from "@/lib/authz/errors";
import { createNotification } from "@/lib/services/notifications";
import { getGroupSettingValue } from "@/lib/services/settings";
import { resolveEntityId } from "@/lib/services/entity";
import type { CallerContext } from "@/lib/services/types";
import { createMandateSchema, terminateMandateSchema } from "@/lib/validation/mandates";
import { parseInput } from "@/lib/validation/parse";

// Mandates reuse the properties.property.* permission keys deliberately, same
// rationale recorded in valuations.ts — same portfolio domain, no dedicated
// properties.mandate.* keys until a standalone Rentals & Mandates portal
// justifies the reseed risk.

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
const MANDATE_STATUS_VALUES = mandateStatus.enumValues;

/**
 * Mirrors finance/approvals.ts's notifyRequiredApprovers rather than
 * importing it — kept local so this service stays self-contained and doesn't
 * reach into another module's private (unexported) helper.
 */
async function notifyMandateApprovers(
  tx: Tx,
  entityId: string,
  requiredApproverRole: "gm" | "ceo",
  request: { id: string; propertyName: string },
) {
  const targetRoles = requiredApproverRole === "gm" ? (["general_manager"] as const) : (["ceo"] as const);
  const recipients = await tx.select().from(users).where(inArray(users.role, targetRoles));
  for (const recipient of recipients) {
    await createNotification(tx, {
      userId: recipient.id,
      entityId,
      type: "approval.pending",
      title: "Mandate activation awaiting your decision",
      body: `Management mandate for ${request.propertyName}`,
      associatedType: "approval_request",
      associatedId: request.id,
      href: "/admin/approvals",
    });
  }
}

export async function listMandates(
  ctx: CallerContext,
  filters: { propertyId?: string; status?: string } = {},
) {
  if (!ctx.entityId) throw new DomainValidationError("entityId is required");
  const entityId = await resolveEntityId(ctx.entityId);
  await authorize(ctx, "properties.property.read", entityId);

  const conditions = [eq(propertyMandates.entityId, entityId)];
  if (filters.propertyId) conditions.push(eq(propertyMandates.propertyId, filters.propertyId));
  if (filters.status && (MANDATE_STATUS_VALUES as readonly string[]).includes(filters.status)) {
    conditions.push(eq(propertyMandates.status, filters.status as (typeof MANDATE_STATUS_VALUES)[number]));
  }

  return db
    .select({
      id: propertyMandates.id,
      entityId: propertyMandates.entityId,
      propertyId: propertyMandates.propertyId,
      propertyName: properties.name,
      propertyCode: properties.propertyCode,
      landlordContactId: propertyMandates.landlordContactId,
      landlordName: contacts.displayName,
      mandateRate: propertyMandates.mandateRate,
      rateJustification: propertyMandates.rateJustification,
      unitCount: propertyMandates.unitCount,
      startDate: propertyMandates.startDate,
      endDate: propertyMandates.endDate,
      status: propertyMandates.status,
      createdAt: propertyMandates.createdAt,
    })
    .from(propertyMandates)
    .innerJoin(properties, eq(propertyMandates.propertyId, properties.id))
    .innerJoin(contacts, eq(propertyMandates.landlordContactId, contacts.id))
    .where(and(...conditions))
    .orderBy(desc(propertyMandates.createdAt));
}

export async function createMandate(ctx: CallerContext, rawInput: unknown) {
  const input = parseInput(createMandateSchema, rawInput);
  const entityId = await resolveEntityId(input.entityId);
  await authorize(ctx, "properties.property.write", entityId);

  const [property] = await db
    .select()
    .from(properties)
    .where(and(eq(properties.id, input.propertyId), eq(properties.entityId, entityId)));
  if (!property) throw new NotFoundError("Property not found");

  const landlordContactId = input.landlordContactId ?? property.ownerContactId;
  if (!landlordContactId) {
    throw new DomainValidationError(
      "This property has no owner on record — set an owner before creating a mandate.",
    );
  }
  const [landlord] = await db.select().from(contacts).where(eq(contacts.id, landlordContactId));
  if (!landlord) throw new NotFoundError("Landlord contact not found");

  const [existingInFlight] = await db
    .select({ id: propertyMandates.id })
    .from(propertyMandates)
    .where(
      and(
        eq(propertyMandates.propertyId, input.propertyId),
        inArray(propertyMandates.status, ["pending_approval", "active"]),
      ),
    )
    .limit(1);
  if (existingInFlight) {
    throw new ConflictError("This property already has a mandate in progress or active.");
  }

  const defaultRate = await getGroupSettingValue("mandate_default_rate", 0.1);
  const mandateRate = input.mandateRate !== undefined ? Number(input.mandateRate) : defaultRate;
  if (!Number.isFinite(mandateRate) || mandateRate <= 0 || mandateRate > 1) {
    throw new DomainValidationError("Mandate rate must be a fraction between 0 and 1 (e.g. 0.10 for 10%).");
  }
  const rateDiffersFromDefault = Math.abs(mandateRate - defaultRate) > 0.0001;
  if (rateDiffersFromDefault && !input.rateJustification?.trim()) {
    throw new DomainValidationError("A mandate rate different from the default requires a justification.");
  }

  const unitBreakdownCount = Array.isArray(property.unitBreakdown)
    ? property.unitBreakdown.reduce((sum, u) => sum + (u.count ?? 0), 0)
    : 0;
  const unitCount = input.unitCount ?? (unitBreakdownCount > 0 ? unitBreakdownCount : 1);

  const monthlyValue = property.monthlyRentKes
    ? Number(property.monthlyRentKes)
    : Array.isArray(property.unitBreakdown)
      ? property.unitBreakdown.reduce(
          (sum, u) => sum + (u.monthlyRentKes ? Number(u.monthlyRentKes) * u.count : 0),
          0,
        )
      : 0;
  const annualizedValueKes = monthlyValue * 12;

  // Mandate activation always requires at least GM sign-off (no auto-approve
  // tier); CEO sign-off is additionally required above either threshold —
  // Executive Dashboard spec §6.2 row "Mandate activation".
  const ceoUnitThreshold = await getGroupSettingValue("mandate_activation_ceo_unit_threshold", 10);
  const ceoAnnualThreshold = await getGroupSettingValue("mandate_activation_ceo_annual_value_kes", 5000000);
  const requiredApproverRole: "gm" | "ceo" =
    unitCount > ceoUnitThreshold || annualizedValueKes > ceoAnnualThreshold ? "ceo" : "gm";

  const startDate = input.startDate ? new Date(input.startDate) : new Date();
  if (Number.isNaN(startDate.getTime())) throw new DomainValidationError("Invalid start date");
  const endDate = input.endDate ? new Date(input.endDate) : null;
  if (endDate && Number.isNaN(endDate.getTime())) throw new DomainValidationError("Invalid end date");

  return db.transaction(async (tx) => {
    const [mandate] = await tx
      .insert(propertyMandates)
      .values({
        entityId,
        propertyId: input.propertyId,
        landlordContactId,
        mandateRate: mandateRate.toFixed(4),
        rateJustification: input.rateJustification?.trim() || null,
        unitCount,
        startDate,
        endDate,
        status: "pending_approval",
      })
      .returning();

    const [approvalRequest] = await tx
      .insert(approvalRequests)
      .values({
        entityId,
        requestType: "mandate_activation",
        relatedTable: "property_mandates",
        relatedId: mandate.id,
        requestedById: ctx.user.id,
        requiredApproverRole,
        status: "pending",
      })
      .returning();

    await writeAudit(tx, ctx, {
      action: "properties.mandate.create",
      associatedType: "property_mandate",
      associatedId: mandate.id,
      summary: `${ctx.user.name} submitted a management mandate for ${property.name}, awaiting ${requiredApproverRole.toUpperCase()} approval`,
      entityId,
      before: null,
      after: mandate,
    });

    await notifyMandateApprovers(tx, entityId, requiredApproverRole, {
      id: approvalRequest.id,
      propertyName: property.name,
    });

    return { ...mandate, requiredApproverRole };
  });
}

export async function terminateMandate(ctx: CallerContext, mandateId: string, rawInput: unknown) {
  const input = parseInput(terminateMandateSchema, rawInput);

  // The mandate's own entity is the authorization scope, loaded first rather
  // than trusted from client input — same reasoning as decideApprovalRequest.
  const [existing] = await db.select().from(propertyMandates).where(eq(propertyMandates.id, mandateId)).limit(1);
  if (!existing) throw new NotFoundError("Mandate not found");

  await authorize(ctx, "properties.property.write", existing.entityId);

  if (existing.status !== "active" && existing.status !== "pending_approval") {
    throw new ConflictError("Only an active or pending mandate can be terminated.");
  }

  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(propertyMandates)
      .set({ status: "terminated", endDate: new Date(), updatedAt: new Date() })
      .where(eq(propertyMandates.id, mandateId))
      .returning();

    // Close out any still-open approval request so a later decide can't act
    // on a mandate that's already been withdrawn.
    await tx
      .update(approvalRequests)
      .set({
        status: "rejected",
        decidedById: ctx.user.id,
        decidedAt: new Date(),
        decisionNotes: "Withdrawn — mandate terminated before/without a decision.",
      })
      .where(
        and(
          eq(approvalRequests.relatedTable, "property_mandates"),
          eq(approvalRequests.relatedId, mandateId),
          eq(approvalRequests.status, "pending"),
        ),
      );

    await writeAudit(tx, ctx, {
      action: "properties.mandate.terminate",
      associatedType: "property_mandate",
      associatedId: mandateId,
      summary: `${ctx.user.name} terminated the management mandate${input.reason ? `: ${input.reason}` : ""}`,
      entityId: existing.entityId,
      before: existing,
      after: updated,
    });

    return updated;
  });
}
