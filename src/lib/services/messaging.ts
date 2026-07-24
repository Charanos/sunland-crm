import { and, desc, eq, inArray, lt } from "drizzle-orm";
import { db } from "@/db";
import { conversationParticipants, conversations, messages, users } from "@/db/schema";
import { DomainValidationError, NotFoundError } from "@/lib/authz/errors";
import { publishToChannel } from "@/lib/realtime/ably";
import { resolveEntityId } from "@/lib/services/entity";
import { roleTierFor } from "@/components/sunland/account-constants";
import type { CallerContext } from "@/lib/services/types";
import { createChannelSchema, getOrCreateDmSchema, sendMessageSchema } from "@/lib/validation/messaging";
import { parseInput } from "@/lib/validation/parse";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Resolves presentation role tiers to real active users. Shared by the system
 * feed producers so "who sees the Ledger feed" is expressed once. Fetch then
 * reduce in JS - roleTierFor collapses the 24-value user_role enum and can't
 * be expressed as a SQL predicate without duplicating the mapping.
 */
export async function resolveUserIdsByTiers(tx: Tx, tiers: string[]): Promise<string[]> {
  const rows = await tx.select({ id: users.id, role: users.role, isActive: users.isActive }).from(users);
  return rows.filter((u) => u.isActive && tiers.includes(roleTierFor(u.role))).map((u) => u.id);
}

/** Access control for messaging is participancy, not a permission - never confirms existence to a non-participant. */
async function assertParticipant(conversationId: string, userId: string) {
  const [participant] = await db
    .select()
    .from(conversationParticipants)
    .where(
      and(eq(conversationParticipants.conversationId, conversationId), eq(conversationParticipants.userId, userId)),
    )
    .limit(1);
  if (!participant) throw new NotFoundError("Conversation not found");
  return participant;
}

export async function listConversations(ctx: CallerContext, filters: { type?: "dm" | "channel" } = {}) {
  const myParticipations = await db
    .select()
    .from(conversationParticipants)
    .where(eq(conversationParticipants.userId, ctx.user.id));
  if (myParticipations.length === 0) return [];

  const conversationIds = myParticipations.map((p) => p.conversationId);
  const conditions = [inArray(conversations.id, conversationIds)];
  if (filters.type) conditions.push(eq(conversations.type, filters.type));

  const [convoRows, allMessages, allParticipants] = await Promise.all([
    db.select().from(conversations).where(and(...conditions)),
    db.select().from(messages).where(inArray(messages.conversationId, conversationIds)),
    db.select().from(conversationParticipants).where(inArray(conversationParticipants.conversationId, conversationIds)),
  ]);

  const otherUserIds = Array.from(
    new Set(allParticipants.filter((p) => p.userId !== ctx.user.id).map((p) => p.userId)),
  );
  const otherUsers = otherUserIds.length
    ? await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        title: users.title,
        avatarUrl: users.avatarUrl,
        phone: users.phone,
      })
      .from(users)
      .where(inArray(users.id, otherUserIds))
    : [];

  return convoRows
    .map((convo) => {
      const myParticipant = myParticipations.find((p) => p.conversationId === convo.id)!;
      const convoMessages = allMessages.filter((m) => m.conversationId === convo.id);
      const unreadCount = convoMessages.filter(
        (m) => !myParticipant.lastReadAt || m.createdAt > myParticipant.lastReadAt,
      ).length;
      const lastMessage = [...convoMessages].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0] ?? null;

      let otherParticipant = null;
      if (convo.type === "dm") {
        const otherRow = allParticipants.find((p) => p.conversationId === convo.id && p.userId !== ctx.user.id);
        otherParticipant = otherRow ? (otherUsers.find((u) => u.id === otherRow.userId) ?? null) : null;
      }

      return {
        id: convo.id,
        type: convo.type,
        name: convo.type === "dm" ? (otherParticipant?.name ?? null) : convo.name,
        description: convo.description,
        otherParticipant,
        unreadCount,
        lastMessageAt: lastMessage?.createdAt ?? null,
        lastMessagePreview: lastMessage?.content ?? null,
        // Drives the inbox row's "You:" prefix without a second query.
        lastMessageSenderId: lastMessage?.senderId ?? null,
        // Powers the row's category badge + mono record code and the thread
        // header's linked-record strip.
        linkedRecordType: convo.linkedRecordType,
        linkedRecordId: convo.linkedRecordId,
        linkedRecordCode: convo.linkedRecordCode,
        archivedAt: myParticipant.archivedAt ?? null,
      };
    })
    .sort((a, b) => (b.lastMessageAt?.getTime() ?? 0) - (a.lastMessageAt?.getTime() ?? 0));
}

/** Per-user archive - hides the thread from your inbox only, never anyone else's. */
export async function setConversationArchived(ctx: CallerContext, conversationId: string, archived: boolean) {
  const participant = await assertParticipant(conversationId, ctx.user.id);
  await db
    .update(conversationParticipants)
    .set({ archivedAt: archived ? new Date() : null })
    .where(eq(conversationParticipants.id, participant.id));

  return { archived };
}

/**
 * Appends to a real system feed (Ledger, Compliance Register, Maintenance
 * Desk...). Called by the services that own the underlying events - a system
 * thread is never invented for display, it exists because something actually
 * happened in the ERP.
 *
 * `senderId` is the user whose action produced the event: messages.sender_id
 * is NOT NULL and a real actor is more honest (and more useful in an audit)
 * than a synthetic "system" user row.
 */
export async function appendSystemMessage(
  tx: Tx,
  actorId: string,
  input: {
    entityId: string;
    feedName: string;
    content: string;
    recipientUserIds: string[];
    linkedRecordType?: string;
    linkedRecordId?: string;
    linkedRecordCode?: string;
  },
) {
  const [existing] = await tx
    .select()
    .from(conversations)
    .where(
      and(
        eq(conversations.entityId, input.entityId),
        eq(conversations.type, "system"),
        eq(conversations.name, input.feedName),
      ),
    )
    .limit(1);

  let convo = existing;
  if (!convo) {
    [convo] = await tx
      .insert(conversations)
      .values({
        entityId: input.entityId,
        type: "system",
        name: input.feedName,
        createdById: actorId,
        linkedRecordType: input.linkedRecordType ?? null,
        linkedRecordId: input.linkedRecordId ?? null,
        linkedRecordCode: input.linkedRecordCode ?? null,
      })
      .returning();
  } else {
    // The feed's linked record tracks its most recent item, which is what the
    // inbox row's code column shows.
    await tx
      .update(conversations)
      .set({
        linkedRecordType: input.linkedRecordType ?? convo.linkedRecordType,
        linkedRecordId: input.linkedRecordId ?? convo.linkedRecordId,
        linkedRecordCode: input.linkedRecordCode ?? convo.linkedRecordCode,
        updatedAt: new Date(),
      })
      .where(eq(conversations.id, convo.id));
  }

  // Subscribe any recipient who isn't already on the feed.
  const existingParticipants = await tx
    .select({ userId: conversationParticipants.userId })
    .from(conversationParticipants)
    .where(eq(conversationParticipants.conversationId, convo.id));
  const known = new Set(existingParticipants.map((p) => p.userId));
  const toAdd = Array.from(new Set(input.recipientUserIds)).filter((id) => !known.has(id));
  if (toAdd.length > 0) {
    await tx
      .insert(conversationParticipants)
      .values(toAdd.map((userId) => ({ conversationId: convo.id, userId })));
  }

  const [message] = await tx
    .insert(messages)
    .values({ conversationId: convo.id, senderId: actorId, content: input.content, type: "system" })
    .returning();

  try {
    await publishToChannel(`conversation-${convo.id}`, "message", message);
  } catch {
    // Realtime delivery is a convenience - the row is already committed.
  }

  return { conversationId: convo.id, message };
}

/** Finds the existing 2-person dm between these users, or creates one - avoids duplicate DM threads. */
export async function getOrCreateDm(ctx: CallerContext, rawInput: unknown) {
  const input = parseInput(getOrCreateDmSchema, rawInput);
  const entityId = await resolveEntityId(input.entityId);

  if (input.otherUserId === ctx.user.id) {
    throw new DomainValidationError("Cannot start a DM with yourself");
  }

  const myDms = await db
    .select({ conversationId: conversationParticipants.conversationId })
    .from(conversationParticipants)
    .innerJoin(conversations, eq(conversations.id, conversationParticipants.conversationId))
    .where(and(eq(conversationParticipants.userId, ctx.user.id), eq(conversations.type, "dm")));

  for (const { conversationId } of myDms) {
    const participants = await db
      .select()
      .from(conversationParticipants)
      .where(eq(conversationParticipants.conversationId, conversationId));
    if (participants.length === 2 && participants.some((p) => p.userId === input.otherUserId)) {
      const [existing] = await db.select().from(conversations).where(eq(conversations.id, conversationId)).limit(1);
      if (existing) return existing;
    }
  }

  return db.transaction(async (tx) => {
    const [convo] = await tx
      .insert(conversations)
      .values({ entityId, type: "dm", createdById: ctx.user.id })
      .returning();

    await tx.insert(conversationParticipants).values([
      { conversationId: convo.id, userId: ctx.user.id },
      { conversationId: convo.id, userId: input.otherUserId },
    ]);

    return convo;
  });
}

export async function createChannel(ctx: CallerContext, rawInput: unknown) {
  const input = parseInput(createChannelSchema, rawInput);
  const entityId = await resolveEntityId(input.entityId);

  return db.transaction(async (tx) => {
    const [convo] = await tx
      .insert(conversations)
      .values({
        entityId,
        type: "channel",
        name: input.name,
        description: input.description ?? null,
        createdById: ctx.user.id,
      })
      .returning();

    const participantIds = Array.from(new Set([ctx.user.id, ...input.participantUserIds]));
    await tx
      .insert(conversationParticipants)
      .values(participantIds.map((userId) => ({ conversationId: convo.id, userId })));

    return convo;
  });
}

export async function listMessages(
  ctx: CallerContext,
  conversationId: string,
  filters: { before?: string; limit?: number } = {},
) {
  await assertParticipant(conversationId, ctx.user.id);

  const limit = Math.min(filters.limit ?? 50, 100);
  const conditions = [eq(messages.conversationId, conversationId)];
  if (filters.before) conditions.push(lt(messages.createdAt, new Date(filters.before)));

  // Most recent `limit` messages before the cursor, then flipped back to
  // chronological order - not a plain ascending scan, which would return the
  // *oldest* messages before the cursor instead of the ones nearest it.
  const rows = await db
    .select()
    .from(messages)
    .where(and(...conditions))
    .orderBy(desc(messages.createdAt))
    .limit(limit);

  return rows.reverse();
}

export async function sendMessage(ctx: CallerContext, conversationId: string, rawInput: unknown) {
  const input = parseInput(sendMessageSchema, rawInput);
  await assertParticipant(conversationId, ctx.user.id);

  return db.transaction(async (tx) => {
    const [message] = await tx
      .insert(messages)
      .values({ conversationId, senderId: ctx.user.id, content: input.content })
      .returning();

    await tx.update(conversations).set({ updatedAt: new Date() }).where(eq(conversations.id, conversationId));

    try {
      await publishToChannel(`conversation-${conversationId}`, "message", message);
    } catch {
      // Realtime delivery is a convenience - the row is already committed.
    }

    return message;
  });
}

export async function markConversationRead(ctx: CallerContext, conversationId: string) {
  const participant = await assertParticipant(conversationId, ctx.user.id);
  await db
    .update(conversationParticipants)
    .set({ lastReadAt: new Date() })
    .where(eq(conversationParticipants.id, participant.id));

  return { success: true };
}
