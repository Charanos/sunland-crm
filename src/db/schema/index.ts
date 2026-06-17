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

export const userRole = pgEnum("user_role", [
  "ceo",
  "general_manager",
  "bd_head",
  "agent",
  "property_manager",
  "accounts_manager",
  "accounts_officer",
  "hr_manager",
  "auditor",
]);

export const contactType = pgEnum("contact_type", [
  "landlord",
  "tenant",
  "buyer",
  "seller",
  "contractor",
  "company",
  "other",
]);

export const propertyStatus = pgEnum("property_status", [
  "available",
  "occupied",
  "under_offer",
  "off_market",
  "maintenance",
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

export const transactionType = pgEnum("transaction_type", [
  "rent",
  "commission",
  "valuation_fee",
  "expense",
  "deposit",
  "other",
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

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
};

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    name: text("name").notNull(),
    role: userRole("role").notNull(),
    title: text("title"),
    isActive: boolean("is_active").default(true).notNull(),
    lastSignedInAt: timestamp("last_signed_in_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => ({
    emailIdx: uniqueIndex("users_email_idx").on(table.email),
    roleIdx: index("users_role_idx").on(table.role),
  }),
);

export const contacts = pgTable(
  "contacts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    type: contactType("type").notNull(),
    displayName: text("display_name").notNull(),
    companyName: text("company_name"),
    email: text("email"),
    phone: text("phone"),
    source: text("source"),
    assignedToId: uuid("assigned_to_id").references(() => users.id),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    ...timestamps,
  },
  (table) => ({
    displayNameIdx: index("contacts_display_name_idx").on(table.displayName),
    assignedToIdx: index("contacts_assigned_to_idx").on(table.assignedToId),
  }),
);

export const properties = pgTable(
  "properties",
  {
    id: uuid("id").defaultRandom().primaryKey(),
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
  }),
);

export const leads = pgTable(
  "leads",
  {
    id: uuid("id").defaultRandom().primaryKey(),
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
    assignedToIdx: index("leads_assigned_to_idx").on(table.assignedToId),
  }),
);

export const leases = pgTable(
  "leases",
  {
    id: uuid("id").defaultRandom().primaryKey(),
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
    expiryIdx: index("leases_expiry_idx").on(table.endsAt),
  }),
);

export const maintenanceRequests = pgTable(
  "maintenance_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
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
    priorityIdx: index("maintenance_priority_idx").on(table.priority),
  }),
);

export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
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
    occurredAtIdx: index("transactions_occurred_at_idx").on(table.occurredAt),
  }),
);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").references(() => users.id).notNull(),
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    entityType: text("entity_type"),
    entityId: uuid("entity_id"),
    href: text("href"),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userReadIdx: index("notifications_user_read_idx").on(
      table.userId,
      table.readAt,
    ),
  }),
);

export const activityLogs = pgTable(
  "activity_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actorId: uuid("actor_id").references(() => users.id),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    action: text("action").notNull(),
    summary: text("summary").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    entityIdx: index("activity_logs_entity_idx").on(
      table.entityType,
      table.entityId,
    ),
  }),
);
