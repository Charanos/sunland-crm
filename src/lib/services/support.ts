import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { supportTickets, users } from "@/db/schema";
import { authorize } from "@/lib/authz/can";
import { writeAudit } from "@/lib/authz/audit";
import { DomainValidationError, NotFoundError } from "@/lib/authz/errors";
import { createNotification } from "@/lib/services/notifications";
import { resolveEntityId } from "@/lib/services/entity";
import type { CallerContext } from "@/lib/services/types";
import { createSupportTicketSchema, updateSupportTicketSchema } from "@/lib/validation/support";
import { parseInput } from "@/lib/validation/parse";

type SupportTicketRow = typeof supportTickets.$inferSelect;

async function notifyTicketManagers(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  ticket: SupportTicketRow,
) {
  const managers = await tx
    .select()
    .from(users)
    .where(inArray(users.role, ["ceo", "general_manager"]));

  for (const manager of managers) {
    await createNotification(tx, {
      userId: manager.id,
      entityId: ticket.entityId,
      type: "support_ticket.created",
      title: "New support ticket",
      body: `${ticket.subject} (${ticket.priority} priority)`,
      associatedType: "support_ticket",
      associatedId: ticket.id,
      href: `/admin/support?ticket=${ticket.id}`,
    });
  }
}

/** Anyone can file their own ticket — no permission gate, same self-scoped pattern as scheduling. */
export async function createSupportTicket(ctx: CallerContext, rawInput: unknown) {
  const input = parseInput(createSupportTicketSchema, rawInput);
  const entityId = await resolveEntityId(input.entityId);

  return db.transaction(async (tx) => {
    const [ticket] = await tx
      .insert(supportTickets)
      .values({
        entityId,
        raisedById: ctx.user.id,
        category: input.category,
        subject: input.subject,
        description: input.description,
        priority: input.priority,
      })
      .returning();

    await writeAudit(tx, ctx, {
      action: "support.ticket.create",
      associatedType: "support_ticket",
      associatedId: ticket.id,
      summary: `${ctx.user.name} filed a support ticket: "${ticket.subject}"`,
      entityId,
      after: ticket,
    });

    await notifyTicketManagers(tx, ticket);

    return ticket;
  });
}

/** `scope: "mine"` needs no permission (self-scoped); `"all"` is the literal "admin is the main support endpoint" view. */
export async function listSupportTickets(
  ctx: CallerContext,
  filters: { entityId?: string; scope?: "mine" | "all" } = {},
) {
  const rawEntityId = filters.entityId ?? ctx.entityId;
  if (!rawEntityId) return [];
  const entityId = await resolveEntityId(rawEntityId);

  if (filters.scope === "all") {
    await authorize(ctx, "support.ticket.manage", entityId);
    return db.select().from(supportTickets).where(eq(supportTickets.entityId, entityId));
  }

  return db
    .select()
    .from(supportTickets)
    .where(and(eq(supportTickets.entityId, entityId), eq(supportTickets.raisedById, ctx.user.id)));
}

export async function getSupportTicket(ctx: CallerContext, ticketId: string) {
  const [ticket] = await db.select().from(supportTickets).where(eq(supportTickets.id, ticketId)).limit(1);
  if (!ticket) throw new NotFoundError("Support ticket not found");

  if (ticket.raisedById === ctx.user.id) return ticket;
  await authorize(ctx, "support.ticket.manage", ticket.entityId);
  return ticket;
}

/** Status/assignment/resolution changes are CEO/GM-only — the filer can view but not self-resolve. */
export async function updateSupportTicket(ctx: CallerContext, ticketId: string, rawInput: unknown) {
  const input = parseInput(updateSupportTicketSchema, rawInput);
  const [existing] = await db.select().from(supportTickets).where(eq(supportTickets.id, ticketId)).limit(1);
  if (!existing) throw new NotFoundError("Support ticket not found");

  await authorize(ctx, "support.ticket.manage", existing.entityId);

  const nextStatus = input.status ?? existing.status;
  const isResolving = nextStatus === "resolved" && existing.status !== "resolved";
  if (input.status === "resolved" && !input.resolutionNotes && !existing.resolutionNotes) {
    throw new DomainValidationError("Resolution notes are required to resolve a ticket");
  }

  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(supportTickets)
      .set({
        status: nextStatus,
        priority: input.priority ?? existing.priority,
        assignedToId: input.assignedToId !== undefined ? input.assignedToId : existing.assignedToId,
        resolutionNotes: input.resolutionNotes ?? existing.resolutionNotes,
        resolvedById: isResolving ? ctx.user.id : existing.resolvedById,
        resolvedAt: isResolving ? new Date() : existing.resolvedAt,
        updatedAt: new Date(),
      })
      .where(eq(supportTickets.id, ticketId))
      .returning();

    await writeAudit(tx, ctx, {
      action: "support.ticket.update",
      associatedType: "support_ticket",
      associatedId: ticketId,
      summary: `${ctx.user.name} updated support ticket "${updated.subject}" (${updated.status})`,
      entityId: existing.entityId,
      before: existing,
      after: updated,
    });

    if (isResolving) {
      await createNotification(tx, {
        userId: existing.raisedById,
        entityId: existing.entityId,
        type: "support_ticket.resolved",
        title: "Your support ticket was resolved",
        body: updated.resolutionNotes ?? updated.subject,
        associatedType: "support_ticket",
        associatedId: updated.id,
        href: `/admin/support?ticket=${updated.id}`,
      });
    }

    return updated;
  });
}
