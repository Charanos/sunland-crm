import {
  boolean,
  date,
  index,
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

export const userRole = pgEnum("user_role", [
  "ceo",
  "general_manager",
  "finance_head",
  "finance_officer",
  "rentals_mandates_officer",
  "payroll_officer",
  "hr_head",
  "hr_officer",
  "line_manager",
  "bd_agent",
  "front_office_head",
  "front_office_admin",
  "driver",
  "operations_lead",
  "valuer",
  "auditor_compliance",
  // Prototype aliases retained until auth/user seed data is migrated.
  "bd_head",
  "agent",
  "property_manager",
  "accounts_manager",
  "accounts_officer",
  "hr_manager",
  "auditor",
]);

export const approvalStatus = pgEnum("approval_status", [
  "pending",
  "approved",
  "rejected",
  "escalated",
]);

export const approvalApproverRole = pgEnum("approval_approver_role", [
  "gm",
  "ceo",
  "department_head",
]);

export const entitySlug = pgEnum("entity_slug", [
  "group",
  "commercial",
  "residential",
  "valuers",
]);

export const roleScopeType = pgEnum("role_scope_type", [
  "global",
  "entity",
  "self",
]);

export const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
};

export const entities = pgTable(
  "entities",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: entitySlug("slug").notNull(),
    name: text("name").notNull(),
    legalName: text("legal_name"),
    isConsolidated: boolean("is_consolidated").default(false).notNull(),
    ...timestamps,
  },
  (table) => ({
    slugIdx: uniqueIndex("entities_slug_idx").on(table.slug),
  }),
);

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    name: text("name").notNull(),
    role: userRole("role").notNull(),
    title: text("title"),
    primaryEntityId: uuid("primary_entity_id").references(() => entities.id),
    isActive: boolean("is_active").default(true).notNull(),
    lastSignedInAt: timestamp("last_signed_in_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => ({
    emailIdx: uniqueIndex("users_email_idx").on(table.email),
    roleIdx: index("users_role_idx").on(table.role),
    primaryEntityIdx: index("users_primary_entity_idx").on(table.primaryEntityId),
  }),
);

// ─── Permission-based RBAC (backend master §3.1) ───────────────────────────

export const permissions = pgTable(
  "permissions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    key: text("key").notNull(), // "finance.journal.post"
    module: text("module").notNull(), // "finance"
    resource: text("resource").notNull(), // "journal"
    action: text("action").notNull(), // "post"
    description: text("description"),
    ...timestamps,
  },
  (table) => ({
    keyIdx: uniqueIndex("permissions_key_idx").on(table.key),
    moduleIdx: index("permissions_module_idx").on(table.module),
  }),
);

export const roles = pgTable(
  "roles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: text("slug").notNull(), // "finance_head" — aligns with userRole where applicable
    name: text("name").notNull(),
    isSystem: boolean("is_system").default(false).notNull(),
    scopeType: roleScopeType("scope_type").default("entity").notNull(),
    ...timestamps,
  },
  (table) => ({
    slugIdx: uniqueIndex("roles_slug_idx").on(table.slug),
  }),
);

export const rolePermissions = pgTable(
  "role_permissions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    roleId: uuid("role_id").references(() => roles.id, { onDelete: "cascade" }).notNull(),
    permissionId: uuid("permission_id").references(() => permissions.id, { onDelete: "cascade" }).notNull(),
    ...timestamps,
  },
  (table) => ({
    roleIdx: index("role_permissions_role_idx").on(table.roleId),
    rolePermissionIdx: uniqueIndex("role_permissions_role_permission_idx").on(
      table.roleId,
      table.permissionId,
    ),
  }),
);

export const userRoles = pgTable(
  "user_roles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    roleId: uuid("role_id").references(() => roles.id, { onDelete: "cascade" }).notNull(),
    // A user can hold a role scoped to a specific entity, or entityless for global-scope roles.
    entityId: uuid("entity_id").references(() => entities.id),
    ...timestamps,
  },
  (table) => ({
    userIdx: index("user_roles_user_idx").on(table.userId),
    roleIdx: index("user_roles_role_idx").on(table.roleId),
    userRoleEntityIdx: uniqueIndex("user_roles_user_role_entity_idx").on(
      table.userId,
      table.roleId,
      table.entityId,
    ),
  }),
);

// ─── Sessions (revocation support — backend master §3.2) ──────────────────

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    // sha256 of the session JWT's jti — never store the raw token
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ip: text("ip"),
    userAgent: text("user_agent"),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => ({
    userIdx: index("sessions_user_idx").on(table.userId),
    tokenHashIdx: uniqueIndex("sessions_token_hash_idx").on(table.tokenHash),
  }),
);

// ─── Settings (thresholds/fees as data, never hardcoded — master doc §5.1) ─

export const settings = pgTable(
  "settings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    // Company-wide settings live under the "group" entity rather than NULL,
    // so uniqueness on (entityId, key) is enforceable (Postgres treats NULL
    // as distinct in unique indexes, which would silently allow duplicates).
    entityId: uuid("entity_id").references(() => entities.id).notNull(),
    key: text("key").notNull(),
    value: jsonb("value").$type<unknown>().notNull(),
    description: text("description"),
    ...timestamps,
  },
  (table) => ({
    entityKeyIdx: uniqueIndex("settings_entity_key_idx").on(table.entityId, table.key),
  }),
);

// ─── Approvals (ADR 004 — generic, shared infrastructure) ──────────────────

export const approvalRequests = pgTable(
  "approval_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    entityId: uuid("entity_id").references(() => entities.id).notNull(),
    requestType: text("request_type").notNull(),
    relatedTable: text("related_table").notNull(),
    relatedId: uuid("related_id").notNull(),
    requestedById: uuid("requested_by").references(() => users.id).notNull(),
    requestedAt: timestamp("requested_at", { withTimezone: true }).defaultNow().notNull(),
    amountKes: numeric("amount_kes", { precision: 14, scale: 2 }),
    requiredApproverRole: approvalApproverRole("required_approver_role").notNull(),
    status: approvalStatus("status").default("pending").notNull(),
    decidedById: uuid("decided_by").references(() => users.id),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    decisionNotes: text("decision_notes"),
    escalatedFromId: uuid("escalated_from").references(
      (): AnyPgColumn => approvalRequests.id,
    ),
    dueOn: date("due_on"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    ...timestamps,
  },
  (table) => ({
    entityStatusIdx: index("approval_requests_entity_status_idx").on(
      table.entityId,
      table.status,
    ),
    relatedIdx: index("approval_requests_related_idx").on(
      table.relatedTable,
      table.relatedId,
    ),
    approverStatusIdx: index("approval_requests_approver_status_idx").on(
      table.requiredApproverRole,
      table.status,
    ),
  }),
);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    entityId: uuid("entity_id").references(() => entities.id),
    userId: uuid("user_id").references(() => users.id).notNull(),
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    associatedType: text("associated_type"),
    associatedId: uuid("associated_id"),
    href: text("href"),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userReadIdx: index("notifications_user_read_idx").on(
      table.userId,
      table.readAt,
    ),
    entityIdx: index("notifications_entity_idx").on(table.entityId),
    associatedIdx: index("notifications_associated_idx").on(
      table.associatedType,
      table.associatedId,
    ),
  }),
);

// ─── Audit (activity_logs extended with structured before/after — audit A-6) ─

export const activityLogs = pgTable(
  "activity_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    entityId: uuid("entity_id").references(() => entities.id),
    actorId: uuid("actor_id").references(() => users.id),
    associatedType: text("associated_type").notNull(),
    associatedId: uuid("associated_id").notNull(),
    action: text("action").notNull(),
    summary: text("summary").notNull(),
    // Structured before/after snapshot + request correlation id, written from
    // the single service-layer audit choke point (src/lib/authz/audit.ts).
    beforeData: jsonb("before_data").$type<Record<string, unknown> | null>(),
    afterData: jsonb("after_data").$type<Record<string, unknown> | null>(),
    requestId: text("request_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    associatedIdx: index("activity_logs_associated_idx").on(
      table.associatedType,
      table.associatedId,
    ),
    entityIdx: index("activity_logs_entity_idx").on(table.entityId),
    requestIdx: index("activity_logs_request_idx").on(table.requestId),
  }),
);
