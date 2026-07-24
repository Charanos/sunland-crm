import { and, eq, gte, lte } from "drizzle-orm";
import { db } from "@/db";
import { calendarEvents, projects, users } from "@/db/schema";
import { authorize } from "@/lib/authz/can";
import { writeAudit } from "@/lib/authz/audit";
import { DomainValidationError, NotFoundError } from "@/lib/authz/errors";
import { resolveEntityId } from "@/lib/services/entity";
import { createNotification } from "@/lib/services/notifications";
import { roleTierFor } from "@/components/sunland/account-constants";
import type { CallerContext } from "@/lib/services/types";
import {
  createCalendarEventSchema,
  notifyEventSchema,
  setEventOutcomeSchema,
  updateCalendarEventSchema,
} from "@/lib/validation/scheduling";
import { parseInput } from "@/lib/validation/parse";

type AttendeeEntry = { name: string; email?: string; userId?: string };
type CalendarEventRow = typeof calendarEvents.$inferSelect;

/**
 * No cron/background-job infrastructure exists in this codebase, and "did it
 * actually happen vs. no-show" can't be inferred automatically anyway - so
 * "archived once the day passes" is this computed flag, not a scheduled
 * write. The Events page uses it to surface/filter events whose day has
 * passed without a resolved outcome (HR spec-adjacent principle: derive,
 * don't store, anything that would otherwise drift out of sync with the clock).
 */
function withDisposition<T extends CalendarEventRow>(event: T): T & { needsDisposition: boolean } {
  return { ...event, needsDisposition: event.outcome === "pending" && event.endsAt < new Date() };
}

/**
 * Self-scoped "my calendar" (organizer or attendee) needs no permission at
 * all - the same pattern as sessions self-management. `scope: "all"` (org-wide
 * visibility) requires scheduling.event.read, granted to department heads.
 */
export async function listCalendarEvents(
  ctx: CallerContext,
  filters: {
    entityId?: string;
    startDate?: string;
    endDate?: string;
    scope?: "mine" | "all";
    type?: string;
    contactId?: string;
    leadId?: string;
  } = {},
) {
  const rawEntityId = filters.entityId ?? ctx.entityId;
  if (!rawEntityId) throw new DomainValidationError("entityId is required");
  const entityId = await resolveEntityId(rawEntityId);

  const wantsAll = filters.scope === "all";
  if (wantsAll) {
    await authorize(ctx, "scheduling.event.read", entityId);
  }

  const conditions = [eq(calendarEvents.entityId, entityId)];
  if (filters.startDate) conditions.push(gte(calendarEvents.startsAt, new Date(filters.startDate)));
  if (filters.endDate) conditions.push(lte(calendarEvents.startsAt, new Date(filters.endDate)));
  if (filters.type) conditions.push(eq(calendarEvents.type, filters.type as (typeof calendarEvents.type.enumValues)[number]));
  if (filters.contactId) conditions.push(eq(calendarEvents.contactId, filters.contactId));
  if (filters.leadId) conditions.push(eq(calendarEvents.leadId, filters.leadId));

  const rows = await db.select().from(calendarEvents).where(and(...conditions)).orderBy(calendarEvents.startsAt);
  const scoped = wantsAll
    ? rows
    : rows.filter((event) => {
      if (event.organizerId === ctx.user.id) return true;
      const attendees = (event.attendees as AttendeeEntry[] | null) ?? [];
      return attendees.some((a) => a.userId === ctx.user.id);
    });

  return scoped.map(withDisposition);
}

export async function createCalendarEvent(ctx: CallerContext, rawInput: unknown) {
  const input = parseInput(createCalendarEventSchema, rawInput);
  const entityId = await resolveEntityId(input.entityId);
  // No permission gate - scheduling your own event is always allowed;
  // org-wide visibility is what's gated, not the ability to create one.

  if (new Date(input.endsAt) <= new Date(input.startsAt)) {
    throw new DomainValidationError("endsAt must be after startsAt");
  }

  return db.transaction(async (tx) => {
    const [event] = await tx
      .insert(calendarEvents)
      .values({
        entityId,
        title: input.title,
        description: input.description ?? null,
        type: input.type,
        startsAt: new Date(input.startsAt),
        endsAt: new Date(input.endsAt),
        location: input.location ?? null,
        organizerId: ctx.user.id,
        attendees: input.attendees ?? [],
        projectId: input.projectId ?? null,
        contactId: input.contactId ?? null,
        leadId: input.leadId ?? null,
        isCritical: input.isCritical ?? false,
        notifyRoleTiers: input.notifyRoleTiers ?? [],
      })
      .returning();

    await writeAudit(tx, ctx, {
      action: "scheduling.event.create",
      associatedType: "calendar_event",
      associatedId: event.id,
      summary: `${ctx.user.name} scheduled "${event.title}"`,
      entityId,
      after: event,
    });

    return withDisposition(event);
  });
}

async function assertCanModify(ctx: CallerContext, event: CalendarEventRow) {
  if (event.organizerId === ctx.user.id) return;
  await authorize(ctx, "scheduling.event.write", event.entityId);
}

export async function updateCalendarEvent(ctx: CallerContext, eventId: string, rawInput: unknown) {
  const input = parseInput(updateCalendarEventSchema, rawInput);
  const [existing] = await db.select().from(calendarEvents).where(eq(calendarEvents.id, eventId)).limit(1);
  if (!existing) throw new NotFoundError("Calendar event not found");
  await assertCanModify(ctx, existing);

  const nextStartsAt = input.startsAt !== undefined ? new Date(input.startsAt) : existing.startsAt;
  const nextEndsAt = input.endsAt !== undefined ? new Date(input.endsAt) : existing.endsAt;
  if (nextEndsAt <= nextStartsAt) {
    throw new DomainValidationError("endsAt must be after startsAt");
  }

  // Explicitly whitelisted, not a spread of raw input - see updateProperty's
  // fix for exactly why (an unresolved entityId or unexpected field silently
  // landing in .set() breaks the write in a way that's hard to trace back).
  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(calendarEvents)
      .set({
        title: input.title ?? existing.title,
        description: input.description !== undefined ? input.description : existing.description,
        type: input.type ?? existing.type,
        startsAt: nextStartsAt,
        endsAt: nextEndsAt,
        location: input.location !== undefined ? input.location : existing.location,
        attendees: input.attendees ?? existing.attendees,
        projectId: input.projectId !== undefined ? input.projectId : existing.projectId,
        contactId: input.contactId !== undefined ? input.contactId : existing.contactId,
        leadId: input.leadId !== undefined ? input.leadId : existing.leadId,
        isCritical: input.isCritical !== undefined ? input.isCritical : existing.isCritical,
        notifyRoleTiers: input.notifyRoleTiers ?? existing.notifyRoleTiers,
        updatedAt: new Date(),
      })
      .where(eq(calendarEvents.id, eventId))
      .returning();

    await writeAudit(tx, ctx, {
      action: "scheduling.event.update",
      associatedType: "calendar_event",
      associatedId: eventId,
      summary: `${ctx.user.name} updated "${updated.title}"`,
      entityId: existing.entityId,
      before: existing,
      after: updated,
    });

    return withDisposition(updated);
  });
}

/** Resolves an event's post-event disposition - organizer or scheduling.event.write, same gate as updateCalendarEvent. */
export async function setEventOutcome(ctx: CallerContext, eventId: string, rawInput: unknown) {
  const input = parseInput(setEventOutcomeSchema, rawInput);
  const [existing] = await db.select().from(calendarEvents).where(eq(calendarEvents.id, eventId)).limit(1);
  if (!existing) throw new NotFoundError("Calendar event not found");
  await assertCanModify(ctx, existing);

  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(calendarEvents)
      .set({ outcome: input.outcome, updatedAt: new Date() })
      .where(eq(calendarEvents.id, eventId))
      .returning();

    await writeAudit(tx, ctx, {
      action: "scheduling.event.set_outcome",
      associatedType: "calendar_event",
      associatedId: eventId,
      summary: `${ctx.user.name} marked "${updated.title}" as ${input.outcome}`,
      entityId: existing.entityId,
      before: { outcome: existing.outcome },
      after: { outcome: updated.outcome },
    });

    return withDisposition(updated);
  });
}

/**
 * Resolves the event's selected role tiers to real people and writes real
 * in-app notifications (which the existing Ably publish inside
 * createNotification delivers live to the nav bell and the console inbox).
 *
 * SMS is deliberately NOT faked here: no provider is configured anywhere in
 * this codebase, so the UI labels SMS as pending-provider rather than
 * reporting a send that never happened - same honesty rule the M-Pesa paybill
 * scaffold follows (ADR H4).
 */
export async function notifyEventRoleTiers(ctx: CallerContext, eventId: string, rawInput: unknown = {}) {
  const input = parseInput(notifyEventSchema, rawInput);
  const [event] = await db.select().from(calendarEvents).where(eq(calendarEvents.id, eventId)).limit(1);
  if (!event) throw new NotFoundError("Calendar event not found");
  await assertCanModify(ctx, event);

  const tiers = (event.notifyRoleTiers ?? []) as string[];
  if (tiers.length === 0) {
    throw new DomainValidationError("This event has no notify roles selected");
  }

  // Fetch then reduce in JS - roleTierFor collapses the 24-value user_role
  // enum into the 6 presentation tiers the picker exposes, so this mapping
  // can't be expressed as a SQL predicate without duplicating it.
  const allUsers = await db
    .select({ id: users.id, name: users.name, role: users.role, isActive: users.isActive })
    .from(users);
  const recipients = allUsers.filter(
    (u) => u.isActive && u.id !== ctx.user.id && tiers.includes(roleTierFor(u.role)),
  );

  const when = event.startsAt.toISOString();
  const body = input.note?.trim()
    ? input.note.trim()
    : `${event.title} — ${when}${event.location ? ` · ${event.location}` : ""}`;

  return db.transaction(async (tx) => {
    let delivered = 0;
    for (const recipient of recipients) {
      const created = await createNotification(tx, {
        userId: recipient.id,
        entityId: event.entityId,
        type: event.isCritical ? "scheduling.event.critical" : "scheduling.event.reminder",
        title: event.isCritical ? `Critical: ${event.title}` : `Scheduled: ${event.title}`,
        body,
        associatedType: "calendar_event",
        associatedId: event.id,
        href: `/admin/scheduler?mode=events`,
      });
      // createNotification returns null when the recipient has muted this
      // category - a real suppression, so it must not count as delivered.
      if (created) delivered += 1;
    }

    await writeAudit(tx, ctx, {
      action: "scheduling.event.notify",
      associatedType: "calendar_event",
      associatedId: event.id,
      summary: `${ctx.user.name} notified ${tiers.join(", ")} about "${event.title}" (${delivered} delivered)`,
      entityId: event.entityId,
      after: { tiers, matched: recipients.length, delivered },
    });

    return { tiers, matched: recipients.length, delivered, smsPending: true };
  });
}

/**
 * Small aggregate behind the scheduler's Operations Pulse hero. `scope`
 * mirrors listCalendarEvents: "personal" is the caller's own agenda,
 * "org" is entity-wide and needs scheduling.event.read.
 */
export async function getSchedulerPulse(
  ctx: CallerContext,
  filters: { entityId?: string; scope?: "personal" | "org" } = {},
) {
  const rawEntityId = filters.entityId ?? ctx.entityId;
  if (!rawEntityId) throw new DomainValidationError("entityId is required");
  const entityId = await resolveEntityId(rawEntityId);

  const events = await listCalendarEvents(ctx, {
    entityId,
    scope: filters.scope === "org" ? "all" : "mine",
  });

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(startOfToday.getTime() + 86_400_000);
  const endOfWeek = new Date(startOfToday.getTime() + 7 * 86_400_000);

  const todayCount = events.filter((e) => e.startsAt >= startOfToday && e.startsAt < endOfToday).length;
  const weekCount = events.filter((e) => e.startsAt >= startOfToday && e.startsAt < endOfWeek).length;
  const needsDisposition = events.filter((e) => e.needsDisposition).length;
  const criticalCount = events.filter((e) => e.isCritical && e.startsAt >= now).length;

  const upcoming = events
    .filter((e) => e.startsAt >= now && e.outcome === "pending")
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  const next = upcoming[0] ?? null;

  // Projects are a shared cross-department artifact (no "mine" split in
  // operations.ts), so the at-risk count is entity-wide in both scopes.
  const projectRows = await db.select().from(projects).where(eq(projects.entityId, entityId));
  const atRiskProjects = projectRows.filter((p) => p.atRisk && p.status !== "completed").length;

  return {
    scope: filters.scope === "org" ? "org" : "personal",
    todayCount,
    weekCount,
    needsDisposition,
    criticalCount,
    atRiskProjects,
    nextEvent: next
      ? {
        id: next.id,
        title: next.title,
        startsAt: next.startsAt.toISOString(),
        endsAt: next.endsAt.toISOString(),
        type: next.type,
        location: next.location,
        isCritical: next.isCritical,
        attendees: next.attendees ?? [],
      }
      : null,
  };
}

export async function deleteCalendarEvent(ctx: CallerContext, eventId: string) {
  const [existing] = await db.select().from(calendarEvents).where(eq(calendarEvents.id, eventId)).limit(1);
  if (!existing) throw new NotFoundError("Calendar event not found");
  await assertCanModify(ctx, existing);

  return db.transaction(async (tx) => {
    await tx.delete(calendarEvents).where(eq(calendarEvents.id, eventId));

    await writeAudit(tx, ctx, {
      action: "scheduling.event.delete",
      associatedType: "calendar_event",
      associatedId: eventId,
      summary: `${ctx.user.name} cancelled "${existing.title}"`,
      entityId: existing.entityId,
      before: existing,
    });

    return { deleted: true };
  });
}
