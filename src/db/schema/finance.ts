import {
  index,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { entities, timestamps, users } from "@/db/schema/platform";
import { contacts } from "@/db/schema/crm";
import { leases, properties } from "@/db/schema/properties";

export const transactionType = pgEnum("transaction_type", [
  "rent",
  "commission",
  "valuation_fee",
  "expense",
  "deposit",
  "other",
]);

// NOTE (P1 will supersede this): this is today's flat cash-movement log, kept
// as-is for P0. Per SUNLAND_FINANCE_LEDGER_ARCHITECTURE.md it will be demoted
// to a raw receipt/bank-feed staging table once the real double-entry ledger
// (accounts/journal_entries/journal_lines) lands.
export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    entityId: uuid("entity_id").references(() => entities.id).notNull(),
    type: transactionType("type").notNull(),
    contactId: uuid("contact_id").references(() => contacts.id),
    propertyId: uuid("property_id").references(() => properties.id),
    leaseId: uuid("lease_id").references(() => leases.id),
    amountKes: numeric("amount_kes", { precision: 14, scale: 2 }).notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    recordedById: uuid("recorded_by_id").references(() => users.id),
    notes: text("notes"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    ...timestamps,
  },
  (table) => ({
    typeIdx: index("transactions_type_idx").on(table.type),
    entityIdx: index("transactions_entity_idx").on(table.entityId),
    occurredAtIdx: index("transactions_occurred_at_idx").on(table.occurredAt),
  }),
);
