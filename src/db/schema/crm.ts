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
    source: text("source"),
    assignedToId: uuid("assigned_to_id").references(() => users.id),
    // National ID/passport number — ADR 014 §14.4, generic to any contact
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
    contactId: uuid("contact_id").references(() => contacts.id),
    propertyId: uuid("property_id").references(() => properties.id),
    assignedToId: uuid("assigned_to_id").references(() => users.id),
    expectedValueKes: numeric("expected_value_kes", { precision: 14, scale: 2 }),
    probability: integer("probability").default(10).notNull(),
    nextActionAt: timestamp("next_action_at", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    lostReason: text("lost_reason"),
    ...timestamps,
  },
  (table) => ({
    stageIdx: index("leads_stage_idx").on(table.stage),
    entityIdx: index("leads_entity_idx").on(table.entityId),
    assignedToIdx: index("leads_assigned_to_idx").on(table.assignedToId),
  }),
);
