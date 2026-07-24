import { boolean, index, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { entities, timestamps, users } from "@/db/schema/platform";
import { projects } from "@/db/schema/operations";
import { maintenanceRequests } from "@/db/schema/properties";
import { contacts, leads } from "@/db/schema/crm";

export const calendarEventType = pgEnum("calendar_event_type", [
  "internal",
  "external",
  "legal",
  "maintenance",
  "viewing",
]);

// Post-event disposition. No cron/background-job infrastructure exists in
// this codebase, and "did it actually happen vs. no-show" isn't something
// the system can infer on its own anyway - so this is resolved by an
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
    // account yet - a candidate or client with nothing to link to) - a jsonb
    // array rather than a join table, same reasoning as properties.media:
    // this is "who's coming," not a queryable relational concern yet.
    attendees: jsonb("attendees").$type<Array<{ name: string; email?: string; userId?: string }>>().default([]),
    // Optional link to a cross-department Project - a milestone/deadline can
    // show up as a real calendar event without a heavier relational model.
    projectId: uuid("project_id").references(() => projects.id),
    // Real link for the Maintenance Board's "Scheduler" integration -
    // scheduleMaintenanceVisit() sets this when a work order's visit is
    // booked; closing/cancelling the request resolves this event's outcome
    // in the same transaction, so "closing the order closes the event" is
    // literally true rather than aspirational copy.
    maintenanceRequestId: uuid("maintenance_request_id").references(() => maintenanceRequests.id),
    // Real Contacts CRM linkage - a "viewing" event can point back at the
    // lead/contact it's scheduled for, same reasoning as maintenanceRequestId
    // above: "today's viewings" and "this contact's next viewing" become
    // literal relational queries instead of free-text attendee matching.
    contactId: uuid("contact_id").references(() => contacts.id),
    leadId: uuid("lead_id").references(() => leads.id),
    outcome: calendarEventOutcome("outcome").default("pending").notNull(),
    // Flags the event as needing sign-off/escalation. Drives the agenda's
    // "Critical" badge and the drawer's warning banner.
    isCritical: boolean("is_critical").default(false).notNull(),
    // Which presentation role tiers (account-constants.ts roleTierFor) get
    // notified about this event. notifyEventRoleTiers() resolves these to real
    // users and writes real in-app notifications; SMS has no provider yet and
    // is labelled as such rather than faked.
    notifyRoleTiers: jsonb("notify_role_tiers").$type<string[]>().default([]),
    ...timestamps,
  },
  (table) => ({
    entityIdx: index("calendar_events_entity_idx").on(table.entityId),
    organizerIdx: index("calendar_events_organizer_idx").on(table.organizerId),
    startsAtIdx: index("calendar_events_starts_at_idx").on(table.startsAt),
    projectIdx: index("calendar_events_project_idx").on(table.projectId),
    maintenanceRequestIdx: index("calendar_events_maintenance_request_idx").on(table.maintenanceRequestId),
    contactIdx: index("calendar_events_contact_idx").on(table.contactId),
    leadIdx: index("calendar_events_lead_idx").on(table.leadId),
  }),
);
