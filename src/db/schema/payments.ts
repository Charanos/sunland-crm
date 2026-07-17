import {
  index,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { entities, timestamps } from "@/db/schema/platform";
import { contacts } from "@/db/schema/crm";
import { leases } from "@/db/schema/properties";
import { transactions } from "@/db/schema/finance";

export const tenantPaymentMethod = pgEnum("tenant_payment_method", [
  "mpesa",
  "bank",
  "cash",
  "cheque",
]);

// pending: STK push sent, awaiting the tenant's PIN entry / Safaricom callback.
// confirmed: callback received with a successful ResultCode, reconciled into
// transactions. failed: STK push itself never completed (cancelled, timed
// out, insufficient funds) - distinct from a confirmed payment later reversed.
export const tenantPaymentStatus = pgEnum("tenant_payment_status", [
  "pending",
  "confirmed",
  "failed",
  "reversed",
]);

// Scaffold only (2026-07-17, client call note item 6: "Add paybills for
// payment integration, especially for tenants") - tracks STK-push lifecycle
// ahead of real Safaricom Daraja credentials existing. Shaped to match
// docs/SUNLAND_TENANT_LANDLORD_PORTALS_SPEC.md's proposed tenant_payments
// table (§3.2/§3.2a), adapted to today's real schema: reconciledTransactionId
// points at the existing flat `transactions` table (this project's current
// ledger - see finance.ts's own note that it will be superseded by a real
// double-entry ledger later) rather than the spec's future journal_entry_id,
// which depends on a journal_entries table that doesn't exist yet.
export const tenantPayments = pgTable(
  "tenant_payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    entityId: uuid("entity_id").references(() => entities.id).notNull(),
    leaseId: uuid("lease_id").references(() => leases.id).notNull(),
    tenantContactId: uuid("tenant_contact_id").references(() => contacts.id).notNull(),
    method: tenantPaymentMethod("method").notNull().default("mpesa"),
    amountKes: numeric("amount_kes", { precision: 14, scale: 2 }).notNull(),
    // The phone number STK push is sent to - captured at initiation, may
    // differ from the tenant contact's stored phone (e.g. paying on someone
    // else's line).
    phoneNumber: text("phone_number"),
    status: tenantPaymentStatus("status").default("pending").notNull(),
    // Safaricom Daraja identifiers - set at STK-push-initiation time, used to
    // match the async callback back to this row.
    checkoutRequestId: text("checkout_request_id").unique(),
    merchantRequestId: text("merchant_request_id"),
    // The M-Pesa receipt number (e.g. "QGH7XXXX1"), set only once confirmed.
    externalRef: text("external_ref"),
    // Set once a matching real ledger transaction is created - the single
    // write path into transactions, never a parallel uncounted balance.
    reconciledTransactionId: uuid("reconciled_transaction_id").references(() => transactions.id),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    failureReason: text("failure_reason"),
    ...timestamps,
  },
  (table) => ({
    entityIdx: index("tenant_payments_entity_idx").on(table.entityId),
    leaseIdx: index("tenant_payments_lease_idx").on(table.leaseId),
    tenantContactIdx: index("tenant_payments_tenant_contact_idx").on(table.tenantContactId),
    statusIdx: index("tenant_payments_status_idx").on(table.status),
    checkoutRequestIdx: index("tenant_payments_checkout_request_idx").on(table.checkoutRequestId),
  }),
);
