import { boolean, index, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { entities, timestamps, users } from "@/db/schema/platform";

export const supportTicketCategory = pgEnum("support_ticket_category", [
  "technical",
  "access",
  "data",
  "other",
]);

export const supportTicketPriority = pgEnum("support_ticket_priority", [
  "low",
  "normal",
  "high",
  "critical",
]);

export const supportTicketStatus = pgEnum("support_ticket_status", [
  "open",
  "in_progress",
  "resolved",
  "closed",
]);

// How the ticket actually reached the desk. Captured at creation rather than
// guessed at display time - "portal" is the honest default for anything filed
// through the app itself.
export const supportTicketChannel = pgEnum("support_ticket_channel", [
  "portal",
  "email",
  "phone",
  "whatsapp",
]);

// "Admin is the main support endpoint" - any technical difficulty a staff
// member hits with the ERP itself gets filed here and surfaces on the
// CEO/GM dashboard, regardless of which portal the filer works in.
export const supportTickets = pgTable(
  "support_tickets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    entityId: uuid("entity_id").references(() => entities.id).notNull(),
    raisedById: uuid("raised_by_id").references(() => users.id).notNull(),
    category: supportTicketCategory("category").default("technical").notNull(),
    subject: text("subject").notNull(),
    description: text("description").notNull(),
    priority: supportTicketPriority("priority").default("normal").notNull(),
    status: supportTicketStatus("status").default("open").notNull(),
    assignedToId: uuid("assigned_to_id").references(() => users.id),
    channel: supportTicketChannel("channel").default("portal").notNull(),
    // Stamped by the first non-raiser reply. This is what makes the SLA
    // "responded in time?" state a real measurement rather than a guess -
    // slaStateFor() in oversight-constants.ts reads it against the priority's
    // response target, the same shape maintenance-constants.ts established.
    firstRespondedAt: timestamp("first_responded_at", { withTimezone: true }),
    resolutionNotes: text("resolution_notes"),
    resolvedById: uuid("resolved_by_id").references(() => users.id),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => ({
    entityIdx: index("support_tickets_entity_idx").on(table.entityId),
    statusIdx: index("support_tickets_status_idx").on(table.status),
    raisedByIdx: index("support_tickets_raised_by_idx").on(table.raisedById),
  }),
);

// The real reply thread behind the console's Reply action. Immutable log, so
// only createdAt - the same reasoning messages/lead_notes use.
export const supportTicketMessages = pgTable(
  "support_ticket_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ticketId: uuid("ticket_id").references(() => supportTickets.id).notNull(),
    authorId: uuid("author_id").references(() => users.id).notNull(),
    body: text("body").notNull(),
    // Internal notes are staff-only working context; they never notify the
    // raiser and never count as the first response.
    isInternal: boolean("is_internal").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    ticketCreatedIdx: index("support_ticket_messages_ticket_created_idx").on(table.ticketId, table.createdAt),
  }),
);
