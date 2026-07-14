import { index, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
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
