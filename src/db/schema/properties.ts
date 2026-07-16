import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { entities, timestamps } from "@/db/schema/platform";
import { contacts } from "@/db/schema/crm";

export const propertyStatus = pgEnum("property_status", [
  "available",
  "occupied",
  "under_offer",
  "off_market",
  "maintenance",
]);

export const maintenancePriority = pgEnum("maintenance_priority", [
  "low",
  "normal",
  "high",
  "critical",
]);

export const maintenanceStatus = pgEnum("maintenance_status", [
  "open",
  "assigned",
  "in_progress",
  "resolved",
  "closed",
]);

export const unitStatus = pgEnum("unit_status", [
  "vacant",
  "occupied",
  "reserved",
  "maintenance",
]);

export const properties = pgTable(
  "properties",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    entityId: uuid("entity_id").references(() => entities.id).notNull(),
    propertyCode: text("property_code").notNull(),
    name: text("name").notNull(),
    propertyType: text("property_type").notNull(),
    listingType: text("listing_type").notNull(),
    status: propertyStatus("status").default("available").notNull(),
    location: text("location").notNull(),
    ownerContactId: uuid("owner_contact_id").references(() => contacts.id),
    askingPriceKes: numeric("asking_price_kes", { precision: 14, scale: 2 }),
    monthlyRentKes: numeric("monthly_rent_kes", { precision: 14, scale: 2 }),
    bedrooms: integer("bedrooms"),
    bathrooms: integer("bathrooms"),
    sizeSqft: integer("size_sqft"),
    landAreaSqft: integer("land_area_sqft"),
    yearBuilt: integer("year_built"),
    parkingSpaces: integer("parking_spaces"),
    amenities: jsonb("amenities").$type<string[]>().default([]),
    // Marketing/context blurb rendered on the property full view - the board
    // was already designed to show it; the column just didn't exist yet.
    description: text("description"),
    media: jsonb("media").$type<Array<{ url: string; alt?: string; isPrimary?: boolean }>>().default([]),
    // For multi-unit properties (apartment blocks, hostels): the mix of unit
    // types making up the property - e.g. 10 bedsitters + 6 one-bedrooms.
    // A jsonb array rather than a relational `units` table: the master doc
    // flags a real `units` table as a future item once per-unit tracking
    // (individual occupancy/lease-per-unit) is needed; a flat breakdown is
    // sufficient and correct for "what does this property consist of" today.
    unitBreakdown: jsonb("unit_breakdown")
      .$type<Array<{ unitType: string; count: number; monthlyRentKes?: string }>>()
      .default([]),
    isFeatured: boolean("is_featured").default(false).notNull(),
    ...timestamps,
  },
  (table) => ({
    propertyCodeIdx: uniqueIndex("properties_property_code_idx").on(
      table.propertyCode,
    ),
    statusIdx: index("properties_status_idx").on(table.status),
    entityIdx: index("properties_entity_idx").on(table.entityId),
  }),
);

export const leases = pgTable(
  "leases",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    entityId: uuid("entity_id").references(() => entities.id).notNull(),
    propertyId: uuid("property_id").references(() => properties.id).notNull(),
    tenantContactId: uuid("tenant_contact_id").references(() => contacts.id).notNull(),
    // Nullable - single-unit properties don't need an explicit unit
    // assignment; multi-unit properties can tie a lease to one specific
    // property_units row so the Units & Tenants tab can show which real
    // unit each tenant occupies instead of a synthetic, unaddressable slot.
    unitId: uuid("unit_id").references((): AnyPgColumn => propertyUnits.id),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    monthlyRentKes: numeric("monthly_rent_kes", { precision: 14, scale: 2 }).notNull(),
    depositKes: numeric("deposit_kes", { precision: 14, scale: 2 }),
    isActive: boolean("is_active").default(true).notNull(),
    // Free-text notes about this specific tenancy - editable via the lease
    // edit flow, shown on the tenant lease detail page's Overview tab
    // instead of any invented descriptive text.
    notes: text("notes"),
    ...timestamps,
  },
  (table) => ({
    propertyIdx: index("leases_property_idx").on(table.propertyId),
    entityIdx: index("leases_entity_idx").on(table.entityId),
    expiryIdx: index("leases_expiry_idx").on(table.endsAt),
    unitIdx: index("leases_unit_idx").on(table.unitId),
  }),
);

export const propertyUnits = pgTable(
  "property_units",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    entityId: uuid("entity_id").references(() => entities.id).notNull(),
    propertyId: uuid("property_id").references(() => properties.id).notNull(),
    unitLabel: text("unit_label").notNull(),
    // Matches unitBreakdown's unitType vocabulary (e.g. "Bedsitter", "1 Bedroom").
    unitType: text("unit_type"),
    monthlyRentKes: numeric("monthly_rent_kes", { precision: 14, scale: 2 }),
    status: unitStatus("status").default("vacant").notNull(),
    // Kept in sync by createLease/terminateLease when a lease carries a
    // unitId - not the sole source of truth for "occupied" (a unit can be
    // reserved/under maintenance with no active lease), but always cleared
    // back to null when its lease ends.
    currentLeaseId: uuid("current_lease_id").references((): AnyPgColumn => leases.id),
    notes: text("notes"),
    ...timestamps,
  },
  (table) => ({
    propertyIdx: index("property_units_property_idx").on(table.propertyId),
    entityIdx: index("property_units_entity_idx").on(table.entityId),
  }),
);

export const maintenanceRequests = pgTable(
  "maintenance_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    entityId: uuid("entity_id").references(() => entities.id).notNull(),
    propertyId: uuid("property_id").references(() => properties.id).notNull(),
    reportedByContactId: uuid("reported_by_contact_id").references(() => contacts.id),
    assignedContractorId: uuid("assigned_contractor_id").references(() => contacts.id),
    title: text("title").notNull(),
    description: text("description").notNull(),
    priority: maintenancePriority("priority").default("normal").notNull(),
    status: maintenanceStatus("status").default("open").notNull(),
    dueAt: timestamp("due_at", { withTimezone: true }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => ({
    statusIdx: index("maintenance_status_idx").on(table.status),
    entityIdx: index("maintenance_entity_idx").on(table.entityId),
    priorityIdx: index("maintenance_priority_idx").on(table.priority),
  }),
);
