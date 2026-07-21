import { and, eq, gte, lte } from "drizzle-orm";
import { db } from "@/db";
import { calendarEvents } from "@/db/schema";
import { authorize } from "@/lib/authz/can";
import { writeAudit } from "@/lib/authz/audit";
import { DomainValidationError, NotFoundError } from "@/lib/authz/errors";
import { resolveEntityId } from "@/lib/services/entity";
import type { CallerContext } from "@/lib/services/types";
import {
  createCalendarEventSchema,
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
