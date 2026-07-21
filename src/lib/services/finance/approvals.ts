import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { approvalRequests, maintenanceRequests, propertyMandates, transactions, users } from "@/db/schema";
import { authorize } from "@/lib/authz/can";
import { writeAudit } from "@/lib/authz/audit";
import { ConflictError, DomainValidationError, NotFoundError } from "@/lib/authz/errors";
import { createNotification } from "@/lib/services/notifications";
import { resolveEntityId } from "@/lib/services/entity";
import type { CallerContext } from "@/lib/services/types";
import {
  createApprovalRequestSchema,
  decideApprovalRequestSchema,
} from "@/lib/validation/finance";
import { parseInput } from "@/lib/validation/parse";

const REAL_STATUS_VALUES = ["pending", "approved", "rejected", "escalated"] as const;
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// approval_approver_role is a tier (gm/ceo/department_head), not a specific
// role - a request doesn't record which department it belongs to, so a
// department_head-tier request notifies every department head at once
// rather than guessing which one.
async function notifyRequiredApprovers(
  tx: Tx,
  entityId: string,
  requiredApproverRole: string,
  request: { id: string; requestType: string; amountKes: string | null },
) {
  const targetRoles =
    requiredApproverRole === "gm"
      ? (["general_manager"] as const)
      : requiredApproverRole === "ceo"
        ? (["ceo"] as const)
        : (["finance_head", "hr_head", "front_office_head"] as const);

  const recipients = await tx.select().from(users).where(inArray(users.role, targetRoles));
  for (const recipient of recipients) {
    await createNotification(tx, {
      userId: recipient.id,
      entityId,
      type: "approval.pending",
      title: "Approval request awaiting your decision",
      body: `${request.requestType.replace(/_/g, " ")}${request.amountKes ? ` - KES ${Number(request.amountKes).toLocaleString()}` : ""}`,
      associatedType: "approval_request",
      associatedId: request.id,
      href: "/admin/approvals",
    });
  }
}

/**
 * P0 reference service - the template every future module's service follows:
 * authorize (action-level) → validate (Zod) → transaction → structured audit.
 * No business logic belongs in the route handler after this.
 */

/**
 * Was previously a raw, unauthenticated inline query in the route handler
 * (no requireCallerContext, no authorize, no entity scoping, and `status as
 * any` forcing the UI's virtual "decided" tab straight into a real Postgres
 * enum column, which errors since "decided" isn't a member of
 * approval_status) - moved here to close that gap and match every other
 * service in this codebase.
 */
export async function listApprovalRequests(
  ctx: CallerContext,
  filters: { entityId?: string; status?: string } = {},
) {
  const rawEntityId = filters.entityId ?? ctx.entityId;
  if (!rawEntityId) throw new DomainValidationError("entityId is required");
  const entityId = await resolveEntityId(rawEntityId);
  await authorize(ctx, "finance.approval.read", entityId);

  const conditions = [eq(approvalRequests.entityId, entityId)];
  if (filters.status === "decided") {
    conditions.push(inArray(approvalRequests.status, ["approved", "rejected"]));
  } else if (filters.status && (REAL_STATUS_VALUES as readonly string[]).includes(filters.status)) {
    conditions.push(eq(approvalRequests.status, filters.status as (typeof REAL_STATUS_VALUES)[number]));
  }
  // Any other unrecognized status value is silently ignored rather than
  // forwarded to Postgres - never trust a client-supplied string into an
  // enum-typed column.

  return db
    .select({
      id: approvalRequests.id,
      entityId: approvalRequests.entityId,
      requestType: approvalRequests.requestType,
      relatedTable: approvalRequests.relatedTable,
      relatedId: approvalRequests.relatedId,
      requestedById: approvalRequests.requestedById,
      requestedByName: users.name,
      requestedAt: approvalRequests.requestedAt,
      amountKes: approvalRequests.amountKes,
      requiredApproverRole: approvalRequests.requiredApproverRole,
      status: approvalRequests.status,
      decisionNotes: approvalRequests.decisionNotes,
    })
    .from(approvalRequests)
    .innerJoin(users, eq(approvalRequests.requestedById, users.id))
    .where(and(...conditions))
    .orderBy(desc(approvalRequests.requestedAt));
}

export async function createApprovalRequest(ctx: CallerContext, rawInput: unknown) {
  const input = parseInput(createApprovalRequestSchema, rawInput);
  const entityId = await resolveEntityId(input.entityId);
  await authorize(ctx, "finance.approval.create", entityId);

  return db.transaction(async (tx) => {
    const [request] = await tx
      .insert(approvalRequests)
      .values({
        entityId,
        requestType: input.requestType,
        relatedTable: input.relatedTable,
        relatedId: input.relatedId,
        requestedById: ctx.user.id,
        amountKes: input.amountKes !== undefined ? input.amountKes.toString() : null,
        requiredApproverRole: input.requiredApproverRole,
        status: "pending",
      })
      .returning();

    await writeAudit(tx, ctx, {
      action: "finance.approval.create",
      associatedType: "approval_request",
      associatedId: request.id,
      summary: `${ctx.user.name} raised a ${input.requestType} approval request`,
      entityId,
      after: request,
    });

    await notifyRequiredApprovers(tx, entityId, input.requiredApproverRole, request);

    return request;
  });
}

export async function decideApprovalRequest(ctx: CallerContext, rawInput: unknown) {
  const input = parseInput(decideApprovalRequestSchema, rawInput);

  // The request's own entity is the authorization scope - never the client's
  // say-so - which is only knowable after loading it.
  const [existing] = await db
    .select()
    .from(approvalRequests)
    .where(eq(approvalRequests.id, input.requestId))
    .limit(1);
  if (!existing) throw new NotFoundError("Approval request not found");

  await authorize(ctx, "finance.approval.decide", existing.entityId);

  if (existing.status !== "pending") {
    throw new ConflictError("Approval request is already decided");
  }

  return db.transaction(async (tx) => {
    // Re-check status inside the transaction (and(id, status="pending")) to
    // close the race between the read above and this write.
    const [updated] = await tx
      .update(approvalRequests)
      .set({
        status: input.status,
        decidedById: ctx.user.id,
        decidedAt: new Date(),
        decisionNotes: input.decisionNotes ?? `Request was ${input.status} via dashboard.`,
      })
      .where(and(eq(approvalRequests.id, input.requestId), eq(approvalRequests.status, "pending")))
      .returning();

    if (!updated) throw new ConflictError("Approval request is already decided");

    // Mandate activation side-effect: a decided property_mandates request
    // flips the mandate itself, since the mandate has no independent
    // decision UI of its own - this approval *is* its decision.
    if (existing.relatedTable === "property_mandates") {
      await tx
        .update(propertyMandates)
        .set({
          status: input.status === "approved" ? "active" : "draft",
          updatedAt: new Date(),
        })
        .where(and(eq(propertyMandates.id, existing.relatedId), eq(propertyMandates.status, "pending_approval")));
    }

    // Maintenance cost side-effect (ADR 015 follow-up): stamp actualCostKes
    // on approval, same parity as submitMaintenanceCostForApproval's own
    // self-approve path stamps it immediately. Either way, clear the
    // "awaiting_approval" gate back to "reported" - the decision (approve or
    // reject) is what the request was waiting on, not a status in itself.
    if (existing.relatedTable === "maintenance_requests") {
      await tx
        .update(maintenanceRequests)
        .set({
          ...(input.status === "approved" ? { actualCostKes: existing.amountKes } : {}),
          status: "reported",
          updatedAt: new Date(),
        })
        .where(and(eq(maintenanceRequests.id, existing.relatedId), eq(maintenanceRequests.status, "awaiting_approval")));
    }

    // Disbursement side-effect on approval - will move onto the real ledger
    // posting recipe (finance ledger doc §5.3) once P1 lands; today's flat
    // transactions table is the only money-movement record that exists.
    if (input.status === "approved" && existing.amountKes) {
      await tx.insert(transactions).values({
        entityId: existing.entityId,
        type: "expense",
        amountKes: existing.amountKes,
        occurredAt: new Date(),
        recordedById: ctx.user.id,
        notes: `Disbursement approved: ${existing.requestType.toUpperCase()} - Ref: ${existing.id.substring(0, 8)}`,
        metadata: {
          approvalRequestId: existing.id,
          relatedTable: existing.relatedTable,
          relatedId: existing.relatedId,
        },
      });
    }

    const isOverride = !!input.overrideNote?.trim();

    await writeAudit(tx, ctx, {
      action: "finance.approval.decide",
      associatedType: "approval_request",
      associatedId: updated.id,
      summary: isOverride
        ? `${ctx.user.name} decided directly (override), bypassing the ${existing.requiredApproverRole.toUpperCase()} step: "${input.overrideNote!.trim()}"`
        : `${ctx.user.name} ${input.status} a ${existing.requestType} approval request`,
      entityId: existing.entityId,
      before: existing,
      after: updated,
    });

    await createNotification(tx, {
      userId: existing.requestedById,
      entityId: existing.entityId,
      type: "approval.decided",
      title: `Your request was ${input.status}`,
      body: `${existing.requestType.replace(/_/g, " ")} - ${updated.decisionNotes ?? input.status}`,
      associatedType: "approval_request",
      associatedId: updated.id,
      href: "/admin/approvals",
    });

    // Override notice: tell the tier that was bypassed, separately from the
    // requester notification above - they never got to weigh in, and the
    // copy here says "was decided", not "awaiting your decision".
    if (isOverride) {
      const bypassedRoles =
        existing.requiredApproverRole === "gm"
          ? (["general_manager"] as const)
          : existing.requiredApproverRole === "ceo"
            ? (["ceo"] as const)
            : (["finance_head", "hr_head", "front_office_head"] as const);
      const bypassed = await tx.select().from(users).where(inArray(users.role, bypassedRoles));
      for (const recipient of bypassed) {
        await createNotification(tx, {
          userId: recipient.id,
          entityId: existing.entityId,
          type: "approval.decided",
          title: "A pending request was decided directly",
          body: `${ctx.user.name} (${ctx.user.role.toUpperCase()}) bypassed your step on a ${existing.requestType.replace(/_/g, " ")} request: "${input.overrideNote!.trim()}"`,
          associatedType: "approval_request",
          associatedId: updated.id,
          href: "/admin/approvals",
        });
      }
    }

    return updated;
  });
}
