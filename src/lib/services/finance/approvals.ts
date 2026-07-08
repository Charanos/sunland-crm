import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { approvalRequests, transactions } from "@/db/schema";
import { authorize } from "@/lib/authz/can";
import { writeAudit } from "@/lib/authz/audit";
import { ConflictError, NotFoundError } from "@/lib/authz/errors";
import { resolveEntityId } from "@/lib/services/entity";
import type { CallerContext } from "@/lib/services/types";
import {
  createApprovalRequestSchema,
  decideApprovalRequestSchema,
} from "@/lib/validation/finance";
import { parseInput } from "@/lib/validation/parse";

/**
 * P0 reference service — the template every future module's service follows:
 * authorize (action-level) → validate (Zod) → transaction → structured audit.
 * No business logic belongs in the route handler after this.
 */
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

    return request;
  });
}

export async function decideApprovalRequest(ctx: CallerContext, rawInput: unknown) {
  const input = parseInput(decideApprovalRequestSchema, rawInput);

  // The request's own entity is the authorization scope — never the client's
  // say-so — which is only knowable after loading it.
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

    // Disbursement side-effect on approval — will move onto the real ledger
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

    await writeAudit(tx, ctx, {
      action: "finance.approval.decide",
      associatedType: "approval_request",
      associatedId: updated.id,
      summary: `${ctx.user.name} ${input.status} a ${existing.requestType} approval request`,
      entityId: existing.entityId,
      before: existing,
      after: updated,
    });

    return updated;
  });
}
