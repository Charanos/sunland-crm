import { and, desc, eq, getTableColumns } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { approvalRequests, calendarEvents, contacts, maintenanceCategory, maintenancePriority, maintenanceRequests, maintenanceStatus, properties, propertyMandates, transactions, users } from "@/db/schema";
import { authorize } from "@/lib/authz/can";
import { writeAudit } from "@/lib/authz/audit";
import { ConflictError, DomainValidationError, NotFoundError } from "@/lib/authz/errors";
import { createApprovalRequest } from "@/lib/services/finance/approvals";
import { resolveEntityId } from "@/lib/services/entity";
import { getGroupSettingValue } from "@/lib/services/settings";
import { toISOStringSafe } from "@/lib/services/properties";
import { appendSystemMessage, resolveUserIdsByTiers } from "@/lib/services/messaging";
import type { CallerContext } from "@/lib/services/types";
import { type CostApprovalTier, costApprovalTierFor, slaStateFor } from "@/components/sunland/maintenance-constants";
import {
  createMaintenanceRequestSchema,
  scheduleMaintenanceVisitSchema,
  submitMaintenanceCostSchema,
  updateMaintenanceRequestSchema,
} from "@/lib/validation/maintenance";
import { parseInput } from "@/lib/validation/parse";

const SLA_HOURS_BY_PRIORITY: Record<string, string> = {
  critical: "maintenance_sla_hours_critical",
  urgent: "maintenance_sla_hours_urgent",
  routine: "maintenance_sla_hours_routine",
};
const SLA_HOURS_FALLBACK: Record<string, number> = { critical: 6, urgent: 24, routine: 72 };

async function getCostApprovalTier(propertyId: string, costKes: number): Promise<{
  tier: CostApprovalTier;
  maintenanceAuthorityKes: number | null;
}> {
  const [[activeMandate], gmThreshold, ceoThreshold] = await Promise.all([
    db
      .select({ maintenanceAuthorityKes: propertyMandates.maintenanceAuthorityKes })
      .from(propertyMandates)
      .where(and(eq(propertyMandates.propertyId, propertyId), eq(propertyMandates.status, "active")))
      .limit(1),
    getGroupSettingValue("maintenance_cost_gm_threshold_kes", 25000),
    getGroupSettingValue("maintenance_cost_ceo_threshold_kes", 100000),
  ]);
  const maintenanceAuthorityKes = activeMandate?.maintenanceAuthorityKes ? parseFloat(activeMandate.maintenanceAuthorityKes) : null;
  const tier = costApprovalTierFor({ costKes, maintenanceAuthorityKes, gmThresholdKes: gmThreshold, ceoThresholdKes: ceoThreshold });
  return { tier, maintenanceAuthorityKes };
}

const reporterContacts = alias(contacts, "reporter_contacts");
const contractorContacts = alias(contacts, "contractor_contacts");

export async function listMaintenanceRequests(
  ctx: CallerContext,
  filters: { status?: string; priority?: string; category?: string; propertyId?: string } = {},
) {
  if (!ctx.entityId) throw new DomainValidationError("entityId is required");
  const entityId = await resolveEntityId(ctx.entityId);
  await authorize(ctx, "properties.maintenance.read", entityId);

  const conditions = [eq(maintenanceRequests.entityId, entityId)];
  if (filters.propertyId) conditions.push(eq(maintenanceRequests.propertyId, filters.propertyId));
  if (filters.status && (maintenanceStatus.enumValues as readonly string[]).includes(filters.status)) {
    conditions.push(eq(maintenanceRequests.status, filters.status as (typeof maintenanceStatus.enumValues)[number]));
  }
  if (filters.priority && (maintenancePriority.enumValues as readonly string[]).includes(filters.priority)) {
    conditions.push(eq(maintenanceRequests.priority, filters.priority as (typeof maintenancePriority.enumValues)[number]));
  }
  if (filters.category && (maintenanceCategory.enumValues as readonly string[]).includes(filters.category)) {
    conditions.push(eq(maintenanceRequests.category, filters.category as (typeof maintenanceCategory.enumValues)[number]));
  }

  return db
    .select({
      id: maintenanceRequests.id,
      entityId: maintenanceRequests.entityId,
      propertyId: maintenanceRequests.propertyId,
      propertyName: properties.name,
      propertyCode: properties.propertyCode,
      title: maintenanceRequests.title,
      description: maintenanceRequests.description,
      priority: maintenanceRequests.priority,
      status: maintenanceRequests.status,
      category: maintenanceRequests.category,
      dueAt: maintenanceRequests.dueAt,
      resolvedAt: maintenanceRequests.resolvedAt,
      estimatedCostKes: maintenanceRequests.estimatedCostKes,
      actualCostKes: maintenanceRequests.actualCostKes,
      createdAt: maintenanceRequests.createdAt,
      updatedAt: maintenanceRequests.updatedAt,
      reportedByContactId: maintenanceRequests.reportedByContactId,
      reportedByName: reporterContacts.displayName,
      assignedContractorId: maintenanceRequests.assignedContractorId,
      assignedContractorName: contractorContacts.displayName,
    })
    .from(maintenanceRequests)
    .innerJoin(properties, eq(maintenanceRequests.propertyId, properties.id))
    .leftJoin(reporterContacts, eq(maintenanceRequests.reportedByContactId, reporterContacts.id))
    .leftJoin(contractorContacts, eq(maintenanceRequests.assignedContractorId, contractorContacts.id))
    .where(and(...conditions))
    .orderBy(desc(maintenanceRequests.createdAt));
}

/**
 * Status always starts "reported" - contractor assignment no longer implies
 * "scheduled" on its own; "scheduled" now means a real calendar visit exists
 * (see scheduleMaintenanceVisit). When a cost estimate is given, it's routed
 * through the same real cost-approval-tier ladder submitMaintenanceCostForApproval
 * uses: auto-tier stamps actualCostKes immediately, gm/ceo-tier creates a
 * real approvalRequests row and opens the request in "awaiting_approval".
 */
export async function createMaintenanceRequest(ctx: CallerContext, rawInput: unknown) {
  const input = parseInput(createMaintenanceRequestSchema, rawInput);
  const entityId = await resolveEntityId(input.entityId);
  await authorize(ctx, "properties.maintenance.write", entityId);

  const [property] = await db
    .select()
    .from(properties)
    .where(and(eq(properties.id, input.propertyId), eq(properties.entityId, entityId)))
    .limit(1);
  if (!property) throw new NotFoundError("Property not found");

  const costTier = input.estimatedCostKes !== undefined ? await getCostApprovalTier(input.propertyId, input.estimatedCostKes) : null;
  const needsApproval = costTier !== null && costTier.tier !== "auto";

  return db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(maintenanceRequests)
      .values({
        entityId,
        propertyId: input.propertyId,
        reportedByContactId: input.reportedByContactId ?? null,
        assignedContractorId: input.assignedContractorId ?? null,
        title: input.title,
        description: input.description,
        priority: input.priority,
        category: input.category,
        status: needsApproval ? "awaiting_approval" : "reported",
        dueAt: input.dueAt ? new Date(input.dueAt) : null,
        estimatedCostKes: input.estimatedCostKes !== undefined ? input.estimatedCostKes.toString() : null,
        actualCostKes: costTier?.tier === "auto" ? input.estimatedCostKes!.toString() : null,
      })
      .returning();

    await writeAudit(tx, ctx, {
      action: "properties.maintenance.create",
      associatedType: "maintenance_request",
      associatedId: inserted.id,
      summary: `Reported maintenance issue "${input.title}" on property ${property.name}`,
      entityId,
      before: null,
      after: inserted,
    });

    if (needsApproval && costTier) {
      const approval = await createApprovalRequest(ctx, {
        entityId,
        requestType: "maintenance_cost",
        relatedTable: "maintenance_requests",
        relatedId: inserted.id,
        amountKes: input.estimatedCostKes!,
        requiredApproverRole: costTier.tier === "ceo" ? "ceo" : "gm",
      });
      return { ...inserted, approvalRequest: approval };
    }

    return { ...inserted, approvalRequest: null };
  });
}

export async function updateMaintenanceRequest(ctx: CallerContext, requestId: string, rawInput: unknown) {
  const input = parseInput(updateMaintenanceRequestSchema, rawInput);

  const [existing] = await db
    .select()
    .from(maintenanceRequests)
    .where(eq(maintenanceRequests.id, requestId))
    .limit(1);
  if (!existing) throw new NotFoundError("Maintenance request not found");

  await authorize(ctx, "properties.maintenance.write", existing.entityId);

  const updatable: Partial<typeof maintenanceRequests.$inferInsert> = {};
  if (input.title !== undefined) updatable.title = input.title;
  if (input.description !== undefined) updatable.description = input.description;
  if (input.priority !== undefined) updatable.priority = input.priority;
  if (input.category !== undefined) updatable.category = input.category;
  if (input.dueAt !== undefined) updatable.dueAt = input.dueAt ? new Date(input.dueAt) : null;
  if (input.estimatedCostKes !== undefined) updatable.estimatedCostKes = input.estimatedCostKes;
  if (input.actualCostKes !== undefined) updatable.actualCostKes = input.actualCostKes;
  if (input.assignedContractorId !== undefined) updatable.assignedContractorId = input.assignedContractorId;

  if (input.status !== undefined) {
    updatable.status = input.status;
    const isClosing = input.status === "done";
    const wasClosed = existing.status === "done";
    if (isClosing && !wasClosed) {
      updatable.resolvedAt = new Date();
    } else if (!isClosing && wasClosed) {
      // Reopening clears the stale resolution timestamp.
      updatable.resolvedAt = null;
    }
  }

  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(maintenanceRequests)
      .set({ ...updatable, updatedAt: new Date() })
      .where(eq(maintenanceRequests.id, requestId))
      .returning();

    // "Closing the order closes the event" - resolve the linked Scheduler
    // visit's outcome in the same transaction as the status flip, same
    // real link scheduleMaintenanceVisit sets up.
    if (updatable.status === "done") {
      await tx
        .update(calendarEvents)
        .set({ outcome: "completed", updatedAt: new Date() })
        .where(and(eq(calendarEvents.maintenanceRequestId, requestId), eq(calendarEvents.outcome, "pending")));
    }

    await writeAudit(tx, ctx, {
      action: "properties.maintenance.update",
      associatedType: "maintenance_request",
      associatedId: requestId,
      summary: describeMaintenanceUpdate(Object.keys(updatable), existing, updated),
      entityId: existing.entityId,
      before: existing,
      after: updated,
    });

    // Real producer for the Messenger's "Maintenance Desk" system feed - only
    // on an actual status move, so the feed reflects work-order progress
    // rather than every incidental field edit (ADR 019).
    if (updatable.status && updatable.status !== existing.status) {
      const recipients = await resolveUserIdsByTiers(tx, ["superadmin", "admin", "manager"]);
      if (recipients.length > 0) {
        const code = `WO-${existing.id.slice(0, 6).toUpperCase()}`;
        await appendSystemMessage(tx, ctx.user.id, {
          entityId: existing.entityId,
          feedName: "Maintenance Desk",
          content: `${code} "${updated.title}" moved to ${MAINT_STATUS_LABELS[updated.status] ?? updated.status}.`,
          recipientUserIds: recipients,
          linkedRecordType: "maintenance_request",
          linkedRecordId: existing.id,
          linkedRecordCode: code,
        });
      }
    }

    return updated;
  });
}

const MAINT_STATUS_LABELS: Record<string, string> = {
  reported: "Reported", awaiting_approval: "Awaiting Approval", scheduled: "Scheduled", in_progress: "In Progress", done: "Completed",
};

/** Named single-field cases (status move, contractor assignment) read like a
 * real status change; anything broader falls back to a field list. */
function describeMaintenanceUpdate(
  changedKeys: string[],
  before: typeof maintenanceRequests.$inferSelect,
  after: typeof maintenanceRequests.$inferSelect,
): string {
  if (changedKeys.length === 1 && changedKeys[0] === "status") {
    return `Moved "${after.title}" from ${MAINT_STATUS_LABELS[before.status] ?? before.status} to ${MAINT_STATUS_LABELS[after.status] ?? after.status}`;
  }
  if (changedKeys.includes("assignedContractorId") && after.assignedContractorId && !before.assignedContractorId) {
    return `Assigned a contractor to "${after.title}"${changedKeys.includes("status") ? ` (status: ${MAINT_STATUS_LABELS[after.status] ?? after.status})` : ""}`;
  }
  const FIELD_LABELS: Record<string, string> = {
    title: "title", description: "description", priority: "severity", category: "category", dueAt: "due date",
    assignedContractorId: "assigned contractor", status: "status", resolvedAt: "resolution date",
    estimatedCostKes: "estimated cost", actualCostKes: "actual cost",
  };
  const labels = changedKeys.filter((k) => k !== "resolvedAt").map((k) => FIELD_LABELS[k] ?? k);
  return `Updated ${labels.length > 0 ? labels.join(", ") : "details"} for "${after.title}"`;
}

/**
 * Single-record detail aggregation for /admin/maintenance/[id] - property,
 * reporter, contractor (+ metadata.specialty), the property's active
 * mandate's real maintenanceAuthorityKes (previously pure unused
 * configuration - this is what actually reads it), any linked
 * approvalRequests row, and the real computed SLA state. Same "fetch base
 * row, batch dependent lookups, reduce in JS" shape as
 * getMandateWithDetails/getPropertyWithDetails.
 */
export async function getMaintenanceRequestWithDetails(ctx: CallerContext, requestId: string) {
  const reporterContacts = alias(contacts, "detail_reporter_contacts");
  const contractorContacts = alias(contacts, "detail_contractor_contacts");

  const [row] = await db
    .select({
      ...getTableColumns(maintenanceRequests),
      propertyName: properties.name,
      propertyCode: properties.propertyCode,
      propertyLocation: properties.location,
      propertyMedia: properties.media,
      reportedByName: reporterContacts.displayName,
      reportedByPhone: reporterContacts.phone,
      assignedContractorName: contractorContacts.displayName,
      assignedContractorPhone: contractorContacts.phone,
      assignedContractorEmail: contractorContacts.email,
      assignedContractorMetadata: contractorContacts.metadata,
    })
    .from(maintenanceRequests)
    .innerJoin(properties, eq(maintenanceRequests.propertyId, properties.id))
    .leftJoin(reporterContacts, eq(maintenanceRequests.reportedByContactId, reporterContacts.id))
    .leftJoin(contractorContacts, eq(maintenanceRequests.assignedContractorId, contractorContacts.id))
    .where(eq(maintenanceRequests.id, requestId))
    .limit(1);

  if (!row) throw new NotFoundError("Maintenance request not found");

  await authorize(ctx, "properties.maintenance.read", row.entityId);

  const [[activeMandate], [pendingApproval], slaHours, [linkedEvent]] = await Promise.all([
    db
      .select({ maintenanceAuthorityKes: propertyMandates.maintenanceAuthorityKes, assignedPmId: propertyMandates.assignedPmId, pmName: users.name })
      .from(propertyMandates)
      .leftJoin(users, eq(users.id, propertyMandates.assignedPmId))
      .where(and(eq(propertyMandates.propertyId, row.propertyId), eq(propertyMandates.status, "active")))
      .limit(1),
    db
      .select({ id: approvalRequests.id, requiredApproverRole: approvalRequests.requiredApproverRole, amountKes: approvalRequests.amountKes })
      .from(approvalRequests)
      .where(and(eq(approvalRequests.relatedTable, "maintenance_requests"), eq(approvalRequests.relatedId, requestId), eq(approvalRequests.status, "pending")))
      .limit(1),
    getGroupSettingValue(SLA_HOURS_BY_PRIORITY[row.priority], SLA_HOURS_FALLBACK[row.priority]),
    db
      .select({ id: calendarEvents.id, startsAt: calendarEvents.startsAt, endsAt: calendarEvents.endsAt, outcome: calendarEvents.outcome })
      .from(calendarEvents)
      .where(eq(calendarEvents.maintenanceRequestId, requestId))
      .orderBy(desc(calendarEvents.startsAt))
      .limit(1),
  ]);

  const sla = slaStateFor({ createdAt: row.createdAt, resolvedAt: row.resolvedAt, targetHours: slaHours });

  return {
    ...row,
    createdAt: toISOStringSafe(row.createdAt) ?? "",
    updatedAt: toISOStringSafe(row.updatedAt),
    dueAt: toISOStringSafe(row.dueAt),
    resolvedAt: toISOStringSafe(row.resolvedAt),
    estimatedCostKes: row.estimatedCostKes ? parseFloat(row.estimatedCostKes) : null,
    actualCostKes: row.actualCostKes ? parseFloat(row.actualCostKes) : null,
    contractorSpecialty: (row.assignedContractorMetadata as Record<string, unknown> | null)?.specialty ?? null,
    maintenanceAuthorityKes: activeMandate?.maintenanceAuthorityKes ? parseFloat(activeMandate.maintenanceAuthorityKes) : null,
    propertyManagerName: activeMandate?.pmName ?? null,
    pendingApproval: pendingApproval ?? null,
    scheduledVisit: linkedEvent
      ? { id: linkedEvent.id, startsAt: toISOStringSafe(linkedEvent.startsAt) ?? "", endsAt: toISOStringSafe(linkedEvent.endsAt) ?? "", outcome: linkedEvent.outcome }
      : null,
    sla: { ...sla, targetHours: slaHours },
  };
}

/**
 * Explicit action (not an implicit side-effect of updateMaintenanceRequest):
 * submit a cost for this work order. Reuses createMandate's own actor-rank
 * self-approval ladder (ADR 014 §14.2) rather than inventing a parallel one -
 * an actor whose rank already meets the required tier clears it immediately
 * and the cost is stamped as actual right away; everyone else's request goes
 * through the same real approvalRequests/decideApprovalRequest path every
 * other approval-gated action in this app already uses.
 */
export async function submitMaintenanceCostForApproval(ctx: CallerContext, requestId: string, rawInput: unknown) {
  const input = parseInput(submitMaintenanceCostSchema, rawInput);
  const entityId = await resolveEntityId(input.entityId);
  await authorize(ctx, "properties.maintenance.write", entityId);

  const [existing] = await db.select().from(maintenanceRequests).where(and(eq(maintenanceRequests.id, requestId), eq(maintenanceRequests.entityId, entityId))).limit(1);
  if (!existing) throw new NotFoundError("Maintenance request not found");

  const [existingPending] = await db
    .select({ id: approvalRequests.id })
    .from(approvalRequests)
    .where(and(eq(approvalRequests.relatedTable, "maintenance_requests"), eq(approvalRequests.relatedId, requestId), eq(approvalRequests.status, "pending")))
    .limit(1);
  if (existingPending) throw new ConflictError("A cost approval is already pending for this request.");

  const { tier } = await getCostApprovalTier(existing.propertyId, input.costKes);

  const actorRank = ctx.user.role === "ceo" ? 3 : ctx.user.role === "general_manager" ? 2 : 1;
  const requiredTierRank = tier === "ceo" ? 3 : tier === "gm" ? 2 : 0;
  const selfApproves = tier === "auto" || actorRank >= requiredTierRank;
  // Only advance the gate from "reported" - a cost bump submitted once the
  // order is already scheduled/in_progress shouldn't regress it backward.
  const shouldGateStatus = !selfApproves && existing.status === "reported";

  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(maintenanceRequests)
      .set({
        estimatedCostKes: input.costKes.toString(),
        actualCostKes: selfApproves ? input.costKes.toString() : existing.actualCostKes,
        status: shouldGateStatus ? "awaiting_approval" : existing.status,
        updatedAt: new Date(),
      })
      .where(eq(maintenanceRequests.id, requestId))
      .returning();

    if (selfApproves) {
      // Same expense-transaction recipe decideApprovalRequest uses on
      // approval - parity between the auto-approved and queue-approved path.
      await tx.insert(transactions).values({
        entityId,
        type: "expense",
        amountKes: input.costKes.toString(),
        occurredAt: new Date(),
        recordedById: ctx.user.id,
        propertyId: existing.propertyId,
        notes: `Maintenance cost approved: ${existing.title} - Ref: ${requestId.substring(0, 8)}`,
        metadata: { maintenanceRequestId: requestId, selfApproved: true },
      });

      await writeAudit(tx, ctx, {
        action: "properties.maintenance.cost_approved",
        associatedType: "maintenance_request",
        associatedId: requestId,
        summary: `${ctx.user.name} approved a KES ${input.costKes.toLocaleString()} cost for "${existing.title}" (self-approved, ${tier === "auto" ? "within authority" : `${ctx.user.role.toUpperCase()} rank`})`,
        entityId,
        before: existing,
        after: updated,
      });
      return { maintenanceRequest: updated, approvalRequest: null, selfApproved: true };
    }

    // Reached only when !selfApproves, which requires tier !== "auto" (auto
    // always self-approves above) - narrow explicitly since TS can't infer
    // that from the selfApproves boolean.
    const approval = await createApprovalRequest(ctx, {
      entityId,
      requestType: "maintenance_cost",
      relatedTable: "maintenance_requests",
      relatedId: requestId,
      amountKes: input.costKes,
      requiredApproverRole: tier === "ceo" ? "ceo" : "gm",
    });

    await writeAudit(tx, ctx, {
      action: "properties.maintenance.cost_submitted",
      associatedType: "maintenance_request",
      associatedId: requestId,
      summary: `${ctx.user.name} submitted a KES ${input.costKes.toLocaleString()} cost for "${existing.title}", awaiting ${tier.toUpperCase()} approval`,
      entityId,
      before: existing,
      after: updated,
    });

    return { maintenanceRequest: updated, approvalRequest: approval, selfApproved: false };
  });
}

/**
 * Real "Scheduler" integration (Maintenance Board design's own claim, made
 * honest): books a real calendar_events row linked back to this work order
 * via maintenanceRequestId, in the same transaction as the status flip -
 * "scheduling a visit" and "the request becoming scheduled" are one atomic
 * fact, not two writes that could drift apart. Written directly against
 * calendarEvents rather than calling createCalendarEvent/updateCalendarEvent
 * (each of which opens its own independent transaction) specifically to keep
 * that atomicity. Reschedule (a linked event already exists) updates the
 * same event in place rather than creating a second one; a first-time
 * booking is only valid from "reported" - it doesn't make sense to schedule
 * a visit for a request still awaiting a cost decision.
 */
export async function scheduleMaintenanceVisit(ctx: CallerContext, requestId: string, rawInput: unknown) {
  const input = parseInput(scheduleMaintenanceVisitSchema, rawInput);
  const entityId = await resolveEntityId(input.entityId);
  await authorize(ctx, "properties.maintenance.write", entityId);

  const [existing] = await db
    .select()
    .from(maintenanceRequests)
    .where(and(eq(maintenanceRequests.id, requestId), eq(maintenanceRequests.entityId, entityId)))
    .limit(1);
  if (!existing) throw new NotFoundError("Maintenance request not found");

  const startsAt = new Date(input.startsAt);
  const endsAt = new Date(input.endsAt);
  if (endsAt <= startsAt) throw new DomainValidationError("endsAt must be after startsAt");

  const [property] = await db.select({ name: properties.name }).from(properties).where(eq(properties.id, existing.propertyId)).limit(1);

  const [linkedEvent] = await db
    .select()
    .from(calendarEvents)
    .where(eq(calendarEvents.maintenanceRequestId, requestId))
    .orderBy(desc(calendarEvents.startsAt))
    .limit(1);

  if (!linkedEvent && existing.status !== "reported") {
    throw new ConflictError('A visit can only be scheduled while the request is "Reported".');
  }

  return db.transaction(async (tx) => {
    const eventValues = {
      title: `${existing.title} — ${property?.name ?? "Property"}`,
      type: "maintenance" as const,
      startsAt,
      endsAt,
      attendees: input.attendees ?? [],
      updatedAt: new Date(),
    };

    const [event] = linkedEvent
      ? await tx.update(calendarEvents).set(eventValues).where(eq(calendarEvents.id, linkedEvent.id)).returning()
      : await tx
        .insert(calendarEvents)
        .values({ ...eventValues, entityId, organizerId: ctx.user.id, maintenanceRequestId: requestId })
        .returning();

    await writeAudit(tx, ctx, {
      action: linkedEvent ? "scheduling.event.update" : "scheduling.event.create",
      associatedType: "calendar_event",
      associatedId: event.id,
      summary: `${ctx.user.name} ${linkedEvent ? "rescheduled" : "scheduled"} a visit for "${existing.title}"`,
      entityId,
      before: linkedEvent ?? null,
      after: event,
    });

    let updated = existing;
    if (!linkedEvent) {
      [updated] = await tx
        .update(maintenanceRequests)
        .set({ status: "scheduled", updatedAt: new Date() })
        .where(eq(maintenanceRequests.id, requestId))
        .returning();

      await writeAudit(tx, ctx, {
        action: "properties.maintenance.update",
        associatedType: "maintenance_request",
        associatedId: requestId,
        summary: `Moved "${existing.title}" from Reported to Scheduled`,
        entityId,
        before: existing,
        after: updated,
      });
    }

    return { maintenanceRequest: updated, event };
  });
}

export async function deleteMaintenanceRequest(ctx: CallerContext, requestId: string) {
  const [existing] = await db
    .select()
    .from(maintenanceRequests)
    .where(eq(maintenanceRequests.id, requestId))
    .limit(1);
  if (!existing) throw new NotFoundError("Maintenance request not found");

  await authorize(ctx, "properties.maintenance.write", existing.entityId);

  return db.transaction(async (tx) => {
    // A linked Scheduler visit can't reference a deleted work order (real FK
    // constraint) - unlink it and mark it cancelled instead of losing its
    // history, same real calendarEventOutcome the design's own cancel-order
    // action honestly maps to (no fabricated "recoverable for 30 days" grace
    // window - the mockup's copy for this has no backing anywhere in this app).
    await tx
      .update(calendarEvents)
      .set({ maintenanceRequestId: null, outcome: "cancelled", updatedAt: new Date() })
      .where(eq(calendarEvents.maintenanceRequestId, requestId));

    await tx.delete(maintenanceRequests).where(eq(maintenanceRequests.id, requestId));

    await writeAudit(tx, ctx, {
      action: "properties.maintenance.delete",
      associatedType: "maintenance_request",
      associatedId: requestId,
      summary: `Deleted maintenance request "${existing.title}"`,
      entityId: existing.entityId,
      before: existing,
      after: null,
    });

    return { success: true };
  });
}
