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
import { propertyMandates } from "@/db/schema/mandates";

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
    // Per-property collection history (property full view) filters on this.
    propertyIdx: index("transactions_property_idx").on(table.propertyId),
  }),
);

// pending: generated, awaiting release to the landlord. released: paid out.
// flagged: a discrepancy was raised - release blocked until resolved.
export const remittanceStatus = pgEnum("remittance_status", [
  "pending",
  "released",
  "flagged",
]);

// A stateful, per-period remittance record for a management mandate -
// distinct from report_exports (a write-once snapshot). Generation writes a
// matching report_exports row (same verificationToken, reportType
// "remittance_advice") so the existing /fin/reports/verify/[token] flow
// authenticates it without a parallel verification mechanism.
export const remittanceAdvices = pgTable(
  "remittance_advices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    entityId: uuid("entity_id").references(() => entities.id).notNull(),
    mandateId: uuid("mandate_id").references(() => propertyMandates.id).notNull(),
    periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
    periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
    collectedKes: numeric("collected_kes", { precision: 14, scale: 2 }).notNull(),
    managementFeeKes: numeric("management_fee_kes", { precision: 14, scale: 2 }).notNull(),
    expensesKes: numeric("expenses_kes", { precision: 14, scale: 2 }).notNull(),
    netRemittanceKes: numeric("net_remittance_kes", { precision: 14, scale: 2 }).notNull(),
    status: remittanceStatus("status").default("pending").notNull(),
    verificationToken: text("verification_token").unique().notNull(),
    generatedById: uuid("generated_by_id").references(() => users.id).notNull(),
    releasedById: uuid("released_by_id").references(() => users.id),
    releasedAt: timestamp("released_at", { withTimezone: true }),
    flagReason: text("flag_reason"),
    ...timestamps,
  },
  (table) => ({
    mandateIdx: index("remittance_advices_mandate_idx").on(table.mandateId),
    entityIdx: index("remittance_advices_entity_idx").on(table.entityId),
    statusIdx: index("remittance_advices_status_idx").on(table.status),
    tokenIdx: index("remittance_advices_token_idx").on(table.verificationToken),
  }),
);
