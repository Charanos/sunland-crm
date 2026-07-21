import {
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { entities, timestamps, users } from "@/db/schema/platform";
import { properties } from "@/db/schema/properties";

export const contactType = pgEnum("contact_type", [
  "landlord",
  "tenant",
  "buyer",
  "seller",
  "contractor",
  "company",
  "other",
]);

export const pipelineStage = pgEnum("pipeline_stage", [
  "inquiry",
  "qualification",
  "viewing",
  "offer",
  "negotiation",
  "closed_won",
  "closed_lost",
]);

// Sales Pipeline design's own 3-tier deal-priority selector (Sales Pipeline
// board precision rebuild) - column name deliberately not "severity" (that
// vocabulary is maintenance's), matching the design's "Priority" label.
export const pipelineLeadPriority = pgEnum("pipeline_lead_priority", [
  "low",
  "medium",
  "high",
]);

export const contacts = pgTable(
  "contacts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    entityId: uuid("entity_id").references(() => entities.id).notNull(),
    type: contactType("type").notNull(),
    displayName: text("display_name").notNull(),
    companyName: text("company_name"),
    email: text("email"),
    phone: text("phone"),
    avatarUrl: text("avatar_url"),
    source: text("source"),
    assignedToId: uuid("assigned_to_id").references(() => users.id),
    // National ID/passport number - ADR 014 §14.4, generic to any contact
    // (not landlord-specific), backing the "Confirm Landlord" verification
    // action.
    idNumber: text("id_number"),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    verifiedById: uuid("verified_by_id").references(() => users.id),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    ...timestamps,
  },
  (table) => ({
    displayNameIdx: index("contacts_display_name_idx").on(table.displayName),
    entityIdx: index("contacts_entity_idx").on(table.entityId),
    assignedToIdx: index("contacts_assigned_to_idx").on(table.assignedToId),
  }),
);

export const leads = pgTable(
  "leads",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    entityId: uuid("entity_id").references(() => entities.id).notNull(),
    title: text("title").notNull(),
    stage: pipelineStage("stage").default("inquiry").notNull(),
    priority: pipelineLeadPriority("priority").default("medium").notNull(),
    contactId: uuid("contact_id").references(() => contacts.id),
    propertyId: uuid("property_id").references(() => properties.id),
    assignedToId: uuid("assigned_to_id").references(() => users.id),
    expectedValueKes: numeric("expected_value_kes", { precision: 14, scale: 2 }),
    probability: integer("probability").default(10).notNull(),
    nextActionAt: timestamp("next_action_at", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    lostReason: text("lost_reason"),
    // Single-blob "requirements summary" captured at creation - distinct
    // from lead_notes below, which is the real, timestamped, multi-entry
    // interaction log the Sales Pipeline design's Activity feed needs.
    notes: text("notes"),
    source: text("source"),
    ...timestamps,
  },
  (table) => ({
    stageIdx: index("leads_stage_idx").on(table.stage),
    entityIdx: index("leads_entity_idx").on(table.entityId),
    assignedToIdx: index("leads_assigned_to_idx").on(table.assignedToId),
  }),
);

// Real, persisted, multi-entry interaction log for a lead - the Sales
// Pipeline design's Activity feed needs distinct timestamped entries, not a
// single editable text blob (that's leads.notes above, a different concept).
// A dedicated table rather than a jsonb array on leads (unlike e.g.
// calendar_events.attendees) since this merges with the audit-log-backed
// system timeline and benefits from its own real createdAt/authorId columns.
export const leadNotes = pgTable(
  "lead_notes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    entityId: uuid("entity_id").references(() => entities.id).notNull(),
    leadId: uuid("lead_id").references(() => leads.id).notNull(),
    authorId: uuid("author_id").references(() => users.id).notNull(),
    text: text("text").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    leadIdx: index("lead_notes_lead_idx").on(table.leadId),
    entityIdx: index("lead_notes_entity_idx").on(table.entityId),
  }),
);
