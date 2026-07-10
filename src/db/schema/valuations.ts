import {
  boolean,
  index,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { entities, timestamps, users } from "@/db/schema/platform";
import { contacts } from "@/db/schema/crm";
import { properties } from "@/db/schema/properties";

// Valuation instruction lifecycle — a chargeable professional-service
// workflow, not a property attribute: requested by a client, scheduled for a
// site visit, inspected, drafted, and delivered as a report with a fee.
export const valuationStatus = pgEnum("valuation_status", [
  "requested",
  "scheduled",
  "in_progress",
  "report_draft",
  "completed",
  "cancelled",
]);

export const valuationType = pgEnum("valuation_type", [
  "market",
  "mortgage_security",
  "insurance",
  "rental_assessment",
  "land",
]);

export const valuations = pgTable(
  "valuations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    entityId: uuid("entity_id").references(() => entities.id).notNull(),
    valuationCode: text("valuation_code").notNull(),
    // Either a portfolio property or an external (off-portfolio) subject —
    // valuation is a service line, so instructions routinely arrive for
    // properties Sunland doesn't manage. Exactly one of the two is required,
    // enforced in the service layer.
    propertyId: uuid("property_id").references(() => properties.id),
    externalPropertyName: text("external_property_name"),
    externalLocation: text("external_location"),
    clientContactId: uuid("client_contact_id").references(() => contacts.id),
    valuerId: uuid("valuer_id").references(() => users.id),
    type: valuationType("type").default("market").notNull(),
    purpose: text("purpose"),
    status: valuationStatus("status").default("requested").notNull(),
    marketValueKes: numeric("market_value_kes", { precision: 16, scale: 2 }),
    forcedSaleValueKes: numeric("forced_sale_value_kes", { precision: 16, scale: 2 }),
    insuranceValueKes: numeric("insurance_value_kes", { precision: 16, scale: 2 }),
    feeKes: numeric("fee_kes", { precision: 14, scale: 2 }),
    feePaid: boolean("fee_paid").default(false).notNull(),
    siteVisitAt: timestamp("site_visit_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    // Valuation reports carry a shelf life (typically 6–12 months) after
    // which lenders/insurers require a fresh instruction.
    validUntil: timestamp("valid_until", { withTimezone: true }),
    reportUrl: text("report_url"),
    notes: text("notes"),
    ...timestamps,
  },
  (table) => ({
    codeIdx: uniqueIndex("valuations_code_idx").on(table.valuationCode),
    entityIdx: index("valuations_entity_idx").on(table.entityId),
    statusIdx: index("valuations_status_idx").on(table.status),
    propertyIdx: index("valuations_property_idx").on(table.propertyId),
  }),
);
