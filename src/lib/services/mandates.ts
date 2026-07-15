import { and, desc, eq, gte, inArray } from "drizzle-orm";
import { db } from "@/db";
import { approvalRequests, contacts, mandateStatus, properties, propertyMandates, remittanceAdvices, transactions, users } from "@/db/schema";
import { authorize } from "@/lib/authz/can";
import { writeAudit } from "@/lib/authz/audit";
import { ConflictError, DomainValidationError, NotFoundError } from "@/lib/authz/errors";
import { createNotification } from "@/lib/services/notifications";
import { getLatestPendingRemittance } from "@/lib/services/finance/remittances";
import { getPropertyWithDetails, toISOStringSafe } from "@/lib/services/properties";
import { getGroupSettingValue } from "@/lib/services/settings";
import { resolveEntityId } from "@/lib/services/entity";
import type { CallerContext } from "@/lib/services/types";
import { assignMandateManagerSchema, createMandateSchema, terminateMandateSchema } from "@/lib/validation/mandates";
import { parseInput } from "@/lib/validation/parse";

// Mandates reuse the properties.property.* permission keys deliberately, same
// rationale recorded in valuations.ts - same portfolio domain, no dedicated
// properties.mandate.* keys until a standalone Rentals & Mandates portal
// justifies the reseed risk.

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
const MANDATE_STATUS_VALUES = mandateStatus.enumValues;

/**
 * Mirrors finance/approvals.ts's notifyRequiredApprovers rather than
 * importing it - kept local so this service stays self-contained and doesn't
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
  filters: { propertyId?: string; status?: string; includeFinancials?: boolean } = {},
) {
  if (!ctx.entityId) throw new DomainValidationError("entityId is required");
  const entityId = await resolveEntityId(ctx.entityId);
  await authorize(ctx, "properties.property.read", entityId);

  const conditions = [eq(propertyMandates.entityId, entityId)];
  if (filters.propertyId) conditions.push(eq(propertyMandates.propertyId, filters.propertyId));
  if (filters.status && (MANDATE_STATUS_VALUES as readonly string[]).includes(filters.status)) {
    conditions.push(eq(propertyMandates.status, filters.status as (typeof MANDATE_STATUS_VALUES)[number]));
  }

  const rows = await db
    .select({
      id: propertyMandates.id,
      entityId: propertyMandates.entityId,
      propertyId: propertyMandates.propertyId,
      propertyName: properties.name,
      propertyCode: properties.propertyCode,
      landlordContactId: propertyMandates.landlordContactId,
      landlordName: contacts.displayName,
      landlordAvatarUrl: contacts.avatarUrl,
      mandateRate: propertyMandates.mandateRate,
      rateJustification: propertyMandates.rateJustification,
      unitCount: propertyMandates.unitCount,
      startDate: propertyMandates.startDate,
      endDate: propertyMandates.endDate,
      status: propertyMandates.status,
      createdAt: propertyMandates.createdAt,
      assignedPmId: propertyMandates.assignedPmId,
      managerName: users.name,
      managerTitle: users.title,
      managerAvatarUrl: users.avatarUrl,
    })
    .from(propertyMandates)
    .innerJoin(properties, eq(propertyMandates.propertyId, properties.id))
    .innerJoin(contacts, eq(propertyMandates.landlordContactId, contacts.id))
    .leftJoin(users, eq(propertyMandates.assignedPmId, users.id))
    .where(and(...conditions))
    .orderBy(desc(propertyMandates.createdAt));

  if (!filters.includeFinancials || rows.length === 0) return rows;

  // Register grid's Collection/Remittance columns - one grouped read of this
  // month's rent transactions across every listed mandate's property, plus
  // each mandate's latest pending remittance, merged in JS rather than
  // N+1 per-row queries (same "fetch then reduce" convention used throughout
  // this service layer, see getPropertyWithDetails's currentPeriod calc).
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const propertyIds = rows.map((r) => r.propertyId);
  const [periodTx, pendingRemittances] = await Promise.all([
    db
      .select({ propertyId: transactions.propertyId, amountKes: transactions.amountKes })
      .from(transactions)
      .where(and(inArray(transactions.propertyId, propertyIds), eq(transactions.type, "rent"), gte(transactions.occurredAt, monthStart))),
    Promise.all(rows.map((r) => getLatestPendingRemittance(r.id))),
  ]);

  return rows.map((r, i) => ({
    ...r,
    currentPeriodCollected: periodTx
      .filter((t) => t.propertyId === r.propertyId)
      .reduce((sum, t) => sum + parseFloat(t.amountKes), 0),
    pendingRemittanceId: pendingRemittances[i]?.id ?? null,
  }));
}

/**
 * Loads one mandate by its own id (not "whichever mandate is currently
 * active on this property", which getPropertyWithDetails' embedded mandate
 * field means - a property can have terminated mandates in its history that
 * getPropertyWithDetails would never surface). Reuses getPropertyWithDetails
 * for the property/leases/documents/collections data that doesn't depend on
 * which mandate is being viewed.
 */
export async function getMandateWithDetails(ctx: CallerContext, mandateId: string) {
  const [mandateRow] = await db
    .select({
      id: propertyMandates.id,
      entityId: propertyMandates.entityId,
      propertyId: propertyMandates.propertyId,
      landlordContactId: propertyMandates.landlordContactId,
      landlordName: contacts.displayName,
      landlordEmail: contacts.email,
      landlordPhone: contacts.phone,
      landlordVerifiedAt: contacts.verifiedAt,
      mandateRate: propertyMandates.mandateRate,
      rateJustification: propertyMandates.rateJustification,
      unitCount: propertyMandates.unitCount,
      startDate: propertyMandates.startDate,
      endDate: propertyMandates.endDate,
      status: propertyMandates.status,
      assignedPmId: propertyMandates.assignedPmId,
      managerName: users.name,
      managerTitle: users.title,
      managerEmail: users.email,
      managerAvatarUrl: users.avatarUrl,
    })
    .from(propertyMandates)
    .innerJoin(contacts, eq(propertyMandates.landlordContactId, contacts.id))
    .leftJoin(users, eq(propertyMandates.assignedPmId, users.id))
    .where(eq(propertyMandates.id, mandateId))
    .limit(1);
  if (!mandateRow) throw new NotFoundError("Mandate not found");

  await authorize(ctx, "properties.property.read", mandateRow.entityId);

  const property = await getPropertyWithDetails(ctx, mandateRow.propertyId);

  let pendingApproverRole: "gm" | "ceo" | "department_head" | null = null;
  let approvalRequestId: string | null = null;
  if (mandateRow.status === "pending_approval") {
    const [pendingApproval] = await db
      .select({ id: approvalRequests.id, requiredApproverRole: approvalRequests.requiredApproverRole })
      .from(approvalRequests)
      .where(
        and(
          eq(approvalRequests.relatedTable, "property_mandates"),
          eq(approvalRequests.relatedId, mandateId),
          eq(approvalRequests.status, "pending"),
        ),
      )
      .limit(1);
    pendingApproverRole = pendingApproval?.requiredApproverRole ?? null;
    approvalRequestId = pendingApproval?.id ?? null;
  }

  const pendingRemittance = await getLatestPendingRemittance(mandateId);
  // Property.mandate is the property's currently in-flight mandate, if any -
  // only trust its currentPeriod snapshot when it actually IS this mandate;
  // a terminated mandate being viewed here has no "this month" to show.
  const currentPeriod = property.mandate?.id === mandateId ? property.mandate.currentPeriod : undefined;

  return {
    id: mandateRow.id,
    entityId: mandateRow.entityId,
    status: mandateRow.status,
    mandateRate: parseFloat(mandateRow.mandateRate),
    rateJustification: mandateRow.rateJustification,
    unitCount: mandateRow.unitCount,
    startDate: toISOStringSafe(mandateRow.startDate) || "",
    endDate: toISOStringSafe(mandateRow.endDate),
    pendingApproverRole,
    approvalRequestId,
    currentPeriod,
    pendingRemittance,
    landlord: {
      id: mandateRow.landlordContactId,
      name: mandateRow.landlordName,
      email: mandateRow.landlordEmail,
      phone: mandateRow.landlordPhone,
      verifiedAt: toISOStringSafe(mandateRow.landlordVerifiedAt),
    },
    manager: mandateRow.assignedPmId
      ? {
        id: mandateRow.assignedPmId,
        name: mandateRow.managerName,
        title: mandateRow.managerTitle,
        email: mandateRow.managerEmail,
        avatarUrl: mandateRow.managerAvatarUrl,
      }
      : null,
    property: {
      id: property.id,
      name: property.name,
      propertyCode: property.propertyCode,
      propertyType: property.propertyType,
      location: property.location,
      media: property.media,
    },
    leases: property.leases,
    documents: property.documents,
    collections: property.collections,
    arrears: property.arrears,
  };
}

/**
 * Leases Board's mode-aware KPI tier when in "Management Mandates" mode -
 * Under Management / Expected Rent Roll / Collected MTD / Management Fee MTD
 * / Remittances Pending, aggregated the same "fetch then reduce in JS" way
 * as getDashboardOverview and getPropertyWithDetails rather than SQL groupBy
 * (no groupBy usage exists anywhere else in this service layer).
 */
export async function getMandatesSummary(ctx: CallerContext) {
  if (!ctx.entityId) throw new DomainValidationError("entityId is required");
  const entityId = await resolveEntityId(ctx.entityId);
  await authorize(ctx, "properties.property.read", entityId);

  const activeMandates = await db
    .select({
      id: propertyMandates.id,
      propertyId: propertyMandates.propertyId,
      mandateRate: propertyMandates.mandateRate,
      monthlyRentKes: properties.monthlyRentKes,
    })
    .from(propertyMandates)
    .innerJoin(properties, eq(propertyMandates.propertyId, properties.id))
    .where(and(eq(propertyMandates.entityId, entityId), eq(propertyMandates.status, "active")));

  if (activeMandates.length === 0) {
    return { activeMandateCount: 0, underManagementKes: 0, expectedRentRollKes: 0, collectedMtdKes: 0, managementFeeMtdKes: 0, remittancesPending: 0 };
  }

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const propertyIds = activeMandates.map((m) => m.propertyId);

  const periodTx = await db
    .select({ propertyId: transactions.propertyId, amountKes: transactions.amountKes })
    .from(transactions)
    .where(and(inArray(transactions.propertyId, propertyIds), eq(transactions.type, "rent"), gte(transactions.occurredAt, monthStart)));

  let expectedRentRollKes = 0;
  let collectedMtdKes = 0;
  let managementFeeMtdKes = 0;
  for (const m of activeMandates) {
    const monthly = m.monthlyRentKes ? parseFloat(m.monthlyRentKes) : 0;
    expectedRentRollKes += monthly;
    const collectedThisProperty = periodTx
      .filter((t) => t.propertyId === m.propertyId)
      .reduce((sum, t) => sum + parseFloat(t.amountKes), 0);
    collectedMtdKes += collectedThisProperty;
    managementFeeMtdKes += collectedThisProperty * parseFloat(m.mandateRate);
  }

  const allMandateIds = await db
    .select({ id: propertyMandates.id })
    .from(propertyMandates)
    .where(eq(propertyMandates.entityId, entityId));
  const pendingRemittances = allMandateIds.length
    ? await db
      .select({ id: remittanceAdvices.id })
      .from(remittanceAdvices)
      .where(and(inArray(remittanceAdvices.mandateId, allMandateIds.map((m) => m.id)), eq(remittanceAdvices.status, "pending")))
    : [];

  return {
    activeMandateCount: activeMandates.length,
    underManagementKes: expectedRentRollKes * 12,
    expectedRentRollKes,
    collectedMtdKes,
    managementFeeMtdKes,
    remittancesPending: pendingRemittances.length,
  };
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
      "This property has no owner on record - set an owner before creating a mandate.",
    );
  }
  const [landlord] = await db.select().from(contacts).where(eq(contacts.id, landlordContactId));
  if (!landlord) throw new NotFoundError("Landlord contact not found");

  if (input.assignedPmId) {
    const [manager] = await db.select().from(users).where(eq(users.id, input.assignedPmId)).limit(1);
    if (!manager) throw new NotFoundError("Property manager not found");
    if (manager.role !== "property_manager") {
      throw new DomainValidationError("Selected staff member is not a Property Manager");
    }
  }

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

  // Mandate activation requires at least GM sign-off (no auto-approve tier
  // for non-executive creators); CEO sign-off is additionally required above
  // either threshold - Executive Dashboard spec §6.2 row "Mandate activation".
  // This is the *ceiling* the mandate needs to clear, not who necessarily has
  // to clear it - see the self-approval check below (ADR 014 §14.2).
  const ceoUnitThreshold = await getGroupSettingValue("mandate_activation_ceo_unit_threshold", 10);
  const ceoAnnualThreshold = await getGroupSettingValue("mandate_activation_ceo_annual_value_kes", 5000000);
  const requiredTier: "gm" | "ceo" =
    unitCount > ceoUnitThreshold || annualizedValueKes > ceoAnnualThreshold ? "ceo" : "gm";

  // An actor whose own authority already meets or exceeds the required tier
  // self-approves - the CEO never waits on anyone (nothing sits above him),
  // and a GM doesn't wait on a *different* GM for a GM-tier mandate, only
  // escalating to CEO when the mandate itself crosses the CEO threshold.
  // Everyone else (Property Manager, Head of Strategy, ...) always needs at
  // least GM sign-off. ADR 014 §14.2.
  const actorRank = ctx.user.role === "ceo" ? 3 : ctx.user.role === "general_manager" ? 2 : 1;
  const requiredTierRank = requiredTier === "ceo" ? 3 : 2;
  const selfApproves = actorRank >= requiredTierRank;

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
        assignedPmId: input.assignedPmId ?? null,
        mandateRate: mandateRate.toFixed(4),
        rateJustification: input.rateJustification?.trim() || null,
        unitCount,
        startDate,
        endDate,
        status: selfApproves ? "active" : "pending_approval",
      })
      .returning();

    if (selfApproves) {
      await writeAudit(tx, ctx, {
        action: "properties.mandate.create",
        associatedType: "property_mandate",
        associatedId: mandate.id,
        summary: `${ctx.user.name} created and self-authorized a management mandate for ${property.name} (${ctx.user.role === "ceo" ? "CEO" : "GM"} authority)`,
        entityId,
        before: null,
        after: mandate,
      });

      return { ...mandate, requiredApproverRole: null };
    }

    const [approvalRequest] = await tx
      .insert(approvalRequests)
      .values({
        entityId,
        requestType: "mandate_activation",
        relatedTable: "property_mandates",
        relatedId: mandate.id,
        requestedById: ctx.user.id,
        requiredApproverRole: requiredTier,
        status: "pending",
      })
      .returning();

    await writeAudit(tx, ctx, {
      action: "properties.mandate.create",
      associatedType: "property_mandate",
      associatedId: mandate.id,
      summary: `${ctx.user.name} submitted a management mandate for ${property.name}, awaiting ${requiredTier.toUpperCase()} approval`,
      entityId,
      before: null,
      after: mandate,
    });

    await notifyMandateApprovers(tx, entityId, requiredTier, {
      id: approvalRequest.id,
      propertyName: property.name,
    });

    return { ...mandate, requiredApproverRole: requiredTier };
  });
}

export async function terminateMandate(ctx: CallerContext, mandateId: string, rawInput: unknown) {
  const input = parseInput(terminateMandateSchema, rawInput);

  // The mandate's own entity is the authorization scope, loaded first rather
  // than trusted from client input - same reasoning as decideApprovalRequest.
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
        decisionNotes: "Withdrawn - mandate terminated before/without a decision.",
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

export async function assignMandateManager(ctx: CallerContext, mandateId: string, rawInput: unknown) {
  const input = parseInput(assignMandateManagerSchema, rawInput);

  const [existing] = await db.select().from(propertyMandates).where(eq(propertyMandates.id, mandateId)).limit(1);
  if (!existing) throw new NotFoundError("Mandate not found");

  await authorize(ctx, "properties.property.write", existing.entityId);

  if (existing.status !== "active" && existing.status !== "pending_approval") {
    throw new ConflictError("Only an active or pending mandate can have its manager reassigned.");
  }

  if (input.assignedPmId) {
    const [manager] = await db.select().from(users).where(eq(users.id, input.assignedPmId)).limit(1);
    if (!manager) throw new NotFoundError("Property manager not found");
    if (manager.role !== "property_manager") {
      throw new DomainValidationError("Selected staff member is not a Property Manager");
    }
  }

  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(propertyMandates)
      .set({ assignedPmId: input.assignedPmId, updatedAt: new Date() })
      .where(eq(propertyMandates.id, mandateId))
      .returning();

    await writeAudit(tx, ctx, {
      action: "properties.mandate.assign_manager",
      associatedType: "property_mandate",
      associatedId: mandateId,
      summary: input.assignedPmId
        ? `${ctx.user.name} assigned a property manager to the mandate`
        : `${ctx.user.name} unassigned the property manager from the mandate`,
      entityId: existing.entityId,
      before: existing,
      after: updated,
    });

    return updated;
  });
}
