import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { NotFoundError } from "@/lib/authz/errors";
import { publishToChannel } from "@/lib/realtime/ably";
import type { CallerContext } from "@/lib/services/types";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type CreateNotificationInput = {
  userId: string;
  entityId: string | null;
  type: string;
  title: string;
  body: string;
  associatedType?: string;
  associatedId?: string;
  href?: string;
};

/**
 * Internal helper other services call from inside their own transaction, so
 * the notification commits atomically with whatever triggered it (a ticket
 * assignment, a complaint escalation, etc.) - never a standalone mutation.
 * Ably publish is best-effort: a realtime outage must never roll back the
 * underlying business transaction that's already committed by the time this
 * runs, so failures are swallowed after the DB write succeeds.
 */
export async function createNotification(tx: Tx, input: CreateNotificationInput) {
  const [notification] = await tx
    .insert(notifications)
    .values({
      userId: input.userId,
      entityId: input.entityId,
      type: input.type,
      title: input.title,
      body: input.body,
      associatedType: input.associatedType ?? null,
      associatedId: input.associatedId ?? null,
      href: input.href ?? null,
    })
    .returning();

  try {
    await publishToChannel(`private-user-${input.userId}`, "notification", {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      href: notification.href,
      createdAt: notification.createdAt,
    });
  } catch {
    // Realtime delivery is a convenience, not a guarantee - the row is the source of truth.
  }

  return notification;
}

export async function listNotifications(ctx: CallerContext, filters: { unreadOnly?: boolean } = {}) {
  const conditions = [eq(notifications.userId, ctx.user.id)];
  if (filters.unreadOnly) conditions.push(isNull(notifications.readAt));

  return db
    .select()
    .from(notifications)
    .where(and(...conditions))
    .orderBy(desc(notifications.createdAt));
}

export async function markNotificationRead(ctx: CallerContext, notificationId: string) {
  const [existing] = await db
    .select()
    .from(notifications)
    .where(eq(notifications.id, notificationId))
    .limit(1);
  if (!existing || existing.userId !== ctx.user.id) throw new NotFoundError("Notification not found");

  const [updated] = await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(eq(notifications.id, notificationId))
    .returning();

  return updated;
}

export async function markAllNotificationsRead(ctx: CallerContext) {
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, ctx.user.id), isNull(notifications.readAt)));

  return { success: true };
}
