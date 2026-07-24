import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { notificationPrefs, notifications } from "@/db/schema";
import { authorize } from "@/lib/authz/can";
import { DomainValidationError, NotFoundError } from "@/lib/authz/errors";
import { resolveEntityId } from "@/lib/services/entity";
import { publishToChannel } from "@/lib/realtime/ably";
import type { CallerContext } from "@/lib/services/types";
import { parseInput } from "@/lib/validation/parse";
import { updateNotificationPrefsSchema } from "@/lib/validation/identity";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// The routing-matrix categories (Account console → Notifications → Routing).
// A notification's dotted `type` prefix maps to one of these; anything
// unrecognized falls through to "system".
export const NOTIFICATION_CATEGORIES = ["viewing", "remittance", "maintenance", "approval", "renewal", "system"] as const;
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

// Maintenance in-app alerts are non-negotiable (critical repairs) - the UI
// locks this and the gate below always honours it, matching the design.
const FORCE_IN_APP: Record<string, boolean> = { maintenance: true };

export function categoryForType(type: string): NotificationCategory {
  const prefix = (type.split(".")[0] ?? "").toLowerCase();
  const alias: Record<string, NotificationCategory> = {
    viewing: "viewing",
    remittance: "remittance",
    finance: "remittance",
    maintenance: "maintenance",
    approval: "approval",
    approvals: "approval",
    renewal: "renewal",
    lease: "renewal",
    system: "system",
    security: "system",
    manual: "system",
  };
  return alias[prefix] ?? "system";
}

export type CreateNotificationInput = {
  userId: string;
  entityId: string | null;
  type: string;
  title: string;
  body: string;
  associatedType?: string;
  associatedId?: string;
  href?: string;
  // Set by explicit human-initiated sends (sendManualNotification) so a
  // deliberate "notify this person" action isn't silently dropped by their
  // category mute - the automated fan-out path leaves this false.
  bypassPrefs?: boolean;
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
  // Real routing: respect the recipient's stored in-app preference for this
  // category. No stored row = deliver (default on). A force-on category
  // (maintenance) always delivers regardless of the stored value.
  const category = categoryForType(input.type);
  if (!input.bypassPrefs && !FORCE_IN_APP[category]) {
    const [pref] = await tx
      .select({ inApp: notificationPrefs.inApp })
      .from(notificationPrefs)
      .where(and(eq(notificationPrefs.userId, input.userId), eq(notificationPrefs.category, category)))
      .limit(1);
    if (pref && pref.inApp === false) {
      // The recipient has muted in-app alerts for this category - honour it.
      return null;
    }
  }

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

/**
 * Route-level entry point for an admin manually triggering a notification -
 * unlike createNotification (always an internal side-effect of another
 * service's own transaction), this is the "compose and send" path a Leases &
 * Mandates detail page's "Notify Property Manager" action calls directly.
 * Recipient must be a real users.id (staff) - contacts (landlords/tenants)
 * have no login/notification concept yet (see
 * docs/SUNLAND_TENANT_LANDLORD_PORTALS_SPEC.md, external identity is a
 * tracked future phase, not built here).
 */
export async function sendManualNotification(
  ctx: CallerContext,
  input: {
    userId: string;
    title: string;
    body: string;
    associatedType?: string;
    associatedId?: string;
    href?: string;
  },
) {
  if (!ctx.entityId) throw new DomainValidationError("entityId is required");
  const entityId = await resolveEntityId(ctx.entityId);
  await authorize(ctx, "properties.lease.write", entityId);

  if (!input.title.trim() || !input.body.trim()) {
    throw new DomainValidationError("A notification needs both a title and a message.");
  }

  return db.transaction((tx) =>
    createNotification(tx, {
      userId: input.userId,
      entityId,
      type: "manual.notify",
      title: input.title.trim(),
      body: input.body.trim(),
      associatedType: input.associatedType,
      associatedId: input.associatedId,
      href: input.href,
      bypassPrefs: true,
    }),
  );
}

// ─── Notification routing preferences (Account console → Notifications) ──────

const DEFAULT_PREF_MATRIX: Record<NotificationCategory, { inApp: boolean; email: boolean; sms: boolean }> = {
  viewing: { inApp: true, email: false, sms: false },
  remittance: { inApp: true, email: true, sms: false },
  maintenance: { inApp: true, email: true, sms: true },
  approval: { inApp: true, email: true, sms: false },
  renewal: { inApp: true, email: false, sms: false },
  system: { inApp: true, email: false, sms: false },
};

/** The caller's own routing matrix, defaults filled in for any unset category. */
export async function getNotificationPrefs(ctx: CallerContext) {
  const rows = await db
    .select({ category: notificationPrefs.category, inApp: notificationPrefs.inApp, email: notificationPrefs.email, sms: notificationPrefs.sms })
    .from(notificationPrefs)
    .where(eq(notificationPrefs.userId, ctx.user.id));
  const byCat = new Map(rows.map((r) => [r.category, r]));
  return NOTIFICATION_CATEGORIES.map((category) => {
    const stored = byCat.get(category);
    const def = DEFAULT_PREF_MATRIX[category];
    return {
      category,
      inApp: stored?.inApp ?? def.inApp,
      email: stored?.email ?? def.email,
      sms: stored?.sms ?? def.sms,
    };
  });
}

/** Upsert the caller's own routing matrix. Maintenance in-app is always forced on. */
export async function updateNotificationPrefs(ctx: CallerContext, rawInput: unknown) {
  const input = parseInput(updateNotificationPrefsSchema, rawInput);
  const userId = ctx.user.id;

  await db.transaction(async (tx) => {
    for (const row of input.rows) {
      const inApp = FORCE_IN_APP[row.category] ? true : row.inApp;
      const [existing] = await tx
        .select({ id: notificationPrefs.id })
        .from(notificationPrefs)
        .where(and(eq(notificationPrefs.userId, userId), eq(notificationPrefs.category, row.category)))
        .limit(1);
      if (existing) {
        await tx
          .update(notificationPrefs)
          .set({ inApp, email: row.email, sms: row.sms, updatedAt: new Date() })
          .where(eq(notificationPrefs.id, existing.id));
      } else {
        await tx.insert(notificationPrefs).values({ userId, category: row.category, inApp, email: row.email, sms: row.sms });
      }
    }
  });

  return getNotificationPrefs(ctx);
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
