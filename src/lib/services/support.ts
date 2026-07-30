import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { supportTicketMessages, supportTickets, users } from "@/db/schema";
import { authorize } from "@/lib/authz/can";
import { writeAudit } from "@/lib/authz/audit";
import { DomainValidationError, NotFoundError } from "@/lib/authz/errors";
import { createNotification } from "@/lib/services/notifications";
import { resolveEntityId } from "@/lib/services/entity";
import type { CallerContext } from "@/lib/services/types";
import { addTicketMessageSchema, createSupportTicketSchema, updateSupportTicketSchema } from "@/lib/validation/support";
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

/** Anyone can file their own ticket - no permission gate, same self-scoped pattern as scheduling. */
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
        channel: input.channel,
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

/** Status/assignment/resolution changes are CEO/GM-only - the filer can view but not self-resolve. */
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

/**
 * The ticket's real reply thread. Visible to the filer (their own ticket) and
 * to anyone who can manage tickets - but internal notes are stripped for the
 * filer, since they are staff working context, not correspondence.
 */
export async function listTicketMessages(ctx: CallerContext, ticketId: string) {
  const [ticket] = await db.select().from(supportTickets).where(eq(supportTickets.id, ticketId)).limit(1);
  if (!ticket) throw new NotFoundError("Support ticket not found");

  const isFiler = ticket.raisedById === ctx.user.id;
  if (!isFiler) await authorize(ctx, "support.ticket.manage", ticket.entityId);

  const rows = await db
    .select({
      id: supportTicketMessages.id,
      ticketId: supportTicketMessages.ticketId,
      authorId: supportTicketMessages.authorId,
      authorName: users.name,
      body: supportTicketMessages.body,
      isInternal: supportTicketMessages.isInternal,
      createdAt: supportTicketMessages.createdAt,
    })
    .from(supportTicketMessages)
    .innerJoin(users, eq(supportTicketMessages.authorId, users.id))
    .where(eq(supportTicketMessages.ticketId, ticketId))
    .orderBy(supportTicketMessages.createdAt);

  return isFiler ? rows.filter((r) => !r.isInternal) : rows;
}

/**
 * Posts a real reply and, when it is the first staff response, stamps
 * firstRespondedAt - which is what makes the console's SLA state a genuine
 * measurement rather than an estimate.
 *
 * The filer's own messages never stop the response clock, and neither do
 * internal notes: only a substantive reply from someone else counts.
 */
export async function addTicketMessage(ctx: CallerContext, ticketId: string, rawInput: unknown) {
  const input = parseInput(addTicketMessageSchema, rawInput);
  const [ticket] = await db.select().from(supportTickets).where(eq(supportTickets.id, ticketId)).limit(1);
  if (!ticket) throw new NotFoundError("Support ticket not found");

  const isFiler = ticket.raisedById === ctx.user.id;
  if (!isFiler) await authorize(ctx, "support.ticket.manage", ticket.entityId);
  if (isFiler && input.isInternal) {
    throw new DomainValidationError("Only support staff can add internal notes");
  }

  const isFirstStaffReply = !isFiler && !input.isInternal && ticket.firstRespondedAt == null;

  return db.transaction(async (tx) => {
    const [message] = await tx
      .insert(supportTicketMessages)
      .values({
        ticketId,
        authorId: ctx.user.id,
        body: input.body.trim(),
        isInternal: input.isInternal,
      })
      .returning();

    if (isFirstStaffReply) {
      await tx
        .update(supportTickets)
        .set({
          firstRespondedAt: new Date(),
          // A ticket that has been answered is genuinely being worked, so
          // reflect that rather than leaving it sitting in "open".
          status: ticket.status === "open" ? "in_progress" : ticket.status,
          updatedAt: new Date(),
        })
        .where(eq(supportTickets.id, ticketId));
    }

    await writeAudit(tx, ctx, {
      action: "support.ticket.reply",
      associatedType: "support_ticket",
      associatedId: ticketId,
      summary: `${ctx.user.name} ${input.isInternal ? "added an internal note on" : "replied to"} "${ticket.subject}"`,
      entityId: ticket.entityId,
      after: { messageId: message.id, isInternal: input.isInternal, firstResponse: isFirstStaffReply },
    });

    // Keep the filer in the loop on real replies (never on internal notes).
    if (!input.isInternal && ticket.raisedById !== ctx.user.id) {
      await createNotification(tx, {
        userId: ticket.raisedById,
        entityId: ticket.entityId,
        type: "support_ticket.replied",
        title: "Reply on your support ticket",
        body: `${ctx.user.name}: ${input.body.trim().slice(0, 120)}`,
        associatedType: "support_ticket",
        associatedId: ticketId,
        href: `/admin/support?ticket=${ticketId}`,
      });
    }

    return message;
  });
}
