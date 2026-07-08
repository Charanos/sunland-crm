import { index, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { entities, timestamps, users } from "@/db/schema/platform";
import { projects } from "@/db/schema/operations";

export const calendarEventType = pgEnum("calendar_event_type", [
  "internal",
  "external",
  "legal",
  "maintenance",
]);

// Post-event disposition. No cron/background-job infrastructure exists in
// this codebase, and "did it actually happen vs. no-show" isn't something
// the system can infer on its own anyway — so this is resolved by an
// explicit action once the event's day has passed, not an automated job.
// The API surfaces a computed `needsDisposition` flag (startsAt < now() &&
// outcome === "pending") rather than storing that as a column, since it's
// derived and would otherwise drift out of sync with the clock.
export const calendarEventOutcome = pgEnum("calendar_event_outcome", [
  "pending",
  "completed",
  "deferred",
  "cancelled",
  "no_show",
]);

export const calendarEvents = pgTable(
  "calendar_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    entityId: uuid("entity_id").references(() => entities.id).notNull(),
    title: text("title").notNull(),
    description: text("description"),
    type: calendarEventType("type").default("internal").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    location: text("location"),
    organizerId: uuid("organizer_id").references(() => users.id).notNull(),
    // Internal users (userId set) or external contacts (name/email only, no
    // account yet — a candidate or client with nothing to link to) — a jsonb
    // array rather than a join table, same reasoning as properties.media:
    // this is "who's coming," not a queryable relational concern yet.
    attendees: jsonb("attendees").$type<Array<{ name: string; email?: string; userId?: string }>>().default([]),
    // Optional link to a cross-department Project — a milestone/deadline can
    // show up as a real calendar event without a heavier relational model.
    projectId: uuid("project_id").references(() => projects.id),
    outcome: calendarEventOutcome("outcome").default("pending").notNull(),
    ...timestamps,
  },
  (table) => ({
    entityIdx: index("calendar_events_entity_idx").on(table.entityId),
    organizerIdx: index("calendar_events_organizer_idx").on(table.organizerId),
    startsAtIdx: index("calendar_events_starts_at_idx").on(table.startsAt),
    projectIdx: index("calendar_events_project_idx").on(table.projectId),
  }),
);
