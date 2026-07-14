import { index, integer, numeric, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { entities, timestamps, users } from "@/db/schema/platform";
import { contacts } from "@/db/schema/crm";
import { properties } from "@/db/schema/properties";

// draft: being configured, not yet submitted. pending_approval: submitted,
// awaiting GM/CEO sign-off (mandate activation never auto-approves - spec
// table always requires at least GM). active: signed off, live. terminated:
// ended (either by decision after activation, or withdrawn pre-approval).
export const mandateStatus = pgEnum("mandate_status", [
  "draft",
  "pending_approval",
  "active",
  "terminated",
]);

export const propertyMandates = pgTable(
  "property_mandates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    entityId: uuid("entity_id").references(() => entities.id).notNull(),
    propertyId: uuid("property_id").references(() => properties.id).notNull(),
    landlordContactId: uuid("landlord_contact_id").references(() => contacts.id).notNull(),
    // Assignment, not ownership - the mandate stays landlord/property owned;
    // this just routes day-to-day management to one Property Manager user.
    assignedPmId: uuid("assigned_pm_id").references(() => users.id),
    mandateRate: numeric("mandate_rate", { precision: 5, scale: 4 }).default("0.1000").notNull(),
    // Required by the service layer whenever mandateRate differs from the
    // configured default - a non-standard fee needs a recorded reason.
    rateJustification: text("rate_justification"),
    unitCount: integer("unit_count").default(1).notNull(),
    startDate: timestamp("start_date", { withTimezone: true }).notNull(),
    endDate: timestamp("end_date", { withTimezone: true }),
    status: mandateStatus("status").default("draft").notNull(),
    ...timestamps,
  },
  (table) => ({
    propertyIdx: index("property_mandates_property_idx").on(table.propertyId),
    entityIdx: index("property_mandates_entity_idx").on(table.entityId),
    statusIdx: index("property_mandates_status_idx").on(table.status),
    assignedPmIdx: index("property_mandates_assigned_pm_idx").on(table.assignedPmId),
    // A property can only have one mandate in flight (pending or active) at a
    // time - enforced here rather than only in the service layer, since this
    // is the kind of invariant a race condition could otherwise slip past.
    activePerPropertyIdx: uniqueIndex("property_mandates_active_unique_idx")
      .on(table.propertyId)
      .where(sql`${table.status} in ('pending_approval', 'active')`),
  }),
);
