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
    media: jsonb("media").$type<Array<{ url: string; alt?: string }>>().default([]),
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
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    monthlyRentKes: numeric("monthly_rent_kes", { precision: 14, scale: 2 }).notNull(),
    depositKes: numeric("deposit_kes", { precision: 14, scale: 2 }),
    isActive: boolean("is_active").default(true).notNull(),
    ...timestamps,
  },
  (table) => ({
    propertyIdx: index("leases_property_idx").on(table.propertyId),
    entityIdx: index("leases_entity_idx").on(table.entityId),
    expiryIdx: index("leases_expiry_idx").on(table.endsAt),
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
