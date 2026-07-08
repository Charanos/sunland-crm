import type { UserRole } from "@/types";

/**
 * Permission catalog — P0 scope only. Keys follow `<module>.<resource>.<action>`
 * (backend master §3.1). Grounded in the modules that have a real data model
 * today (finance/approvals on approval_requests, properties/leases/maintenance,
 * crm contacts/leads, identity users/roles). HR/BD/Front/Ops get real module
 * permissions once their own phase builds their tables — see master doc §7;
 * inventing keys for tables that don't exist yet would just be code that lies.
 */
export type PermissionDefinition = {
  key: string;
  module: string;
  resource: string;
  action: string;
  description: string;
};

function perm(key: string, description: string): PermissionDefinition {
  const [module, resource, action] = key.split(".");
  return { key, module, resource, action, description };
}

export const PERMISSION_CATALOG: PermissionDefinition[] = [
  // Identity / access
  perm("identity.user.read", "View staff user accounts"),
  perm("identity.user.write", "Create/deactivate/reassign staff user accounts"),
  perm("identity.role.read", "View roles and the permission catalog"),
  perm("identity.role.write", "Grant/revoke roles, edit role-permission mappings (CEO-only in practice)"),
  perm("identity.session.read", "List active sessions"),
  perm("identity.session.revoke", "Revoke a session"),

  // Settings (thresholds/fees as data — never hardcoded)
  perm("settings.entity.read", "View entity settings/thresholds"),
  perm("settings.entity.write", "Edit entity settings/thresholds"),

  // Audit
  perm("audit.log.read", "View the audit log"),

  // CRM
  perm("crm.contact.read", "View contacts (landlords/tenants/buyers/etc.)"),
  perm("crm.contact.write", "Create/edit contacts"),
  perm("crm.lead.read", "View pipeline leads"),
  perm("crm.lead.write", "Create/edit/progress pipeline leads"),

  // Properties
  perm("properties.property.read", "View properties"),
  perm("properties.property.write", "Create/edit properties"),
  perm("properties.lease.read", "View leases"),
  perm("properties.lease.write", "Create/edit leases"),
  perm("properties.maintenance.read", "View maintenance requests"),
  perm("properties.maintenance.write", "Create/edit/resolve maintenance requests"),

  // Finance (today's flat transactions table + the approvals engine)
  perm("finance.transaction.read", "View recorded transactions"),
  perm("finance.transaction.write", "Record a transaction"),
  perm("finance.approval.read", "View approval requests"),
  perm("finance.approval.create", "Raise an approval request"),
  perm("finance.approval.decide", "Approve or reject an approval request"),
];

const permissionKeys = PERMISSION_CATALOG.map((p) => p.key);

/** All permission keys belonging to a module — used for broad role grants. */
function keysFor(module: string): string[] {
  return permissionKeys.filter((key) => key.startsWith(`${module}.`));
}

/** All permission keys ending in `.read` — the read-everywhere auditor shape. */
function allReadKeys(): string[] {
  return permissionKeys.filter((key) => key.endsWith(".read"));
}

export type SystemRoleDefinition = {
  slug: UserRole;
  name: string;
  scopeType: "global" | "entity" | "self";
  permissions: string[];
};

// Only the 16 real roles get seeded permission sets. The 7 prototype aliases
// (bd_head, agent, property_manager, accounts_manager, accounts_officer,
// hr_manager, auditor) stay in the user_role enum for migration compatibility
// but are deliberately granted nothing here — retiring them is a later cleanup,
// not a P0 concern.
export const SYSTEM_ROLES: SystemRoleDefinition[] = [
  {
    slug: "ceo",
    name: "Chief Executive Officer",
    scopeType: "global",
    // Super-admin = every permission, seeded as real rows — not a code bypass.
    permissions: permissionKeys,
  },
  {
    slug: "general_manager",
    name: "General Manager",
    scopeType: "global",
    // Everything except CEO-only System Administration (role/permission editing).
    permissions: permissionKeys.filter((key) => key !== "identity.role.write"),
  },
  {
    slug: "finance_head",
    name: "Head of Finance",
    // Global, not entity-scoped: a department head oversees their function
    // company-wide, unlike an officer tied to one operating entity's
    // day-to-day (mirrors the seed data's own choice of primaryEntityId=group
    // for every department head vs. a specific entity for officers).
    scopeType: "global",
    permissions: [
      ...keysFor("finance"),
      "properties.property.read",
      "properties.lease.read",
      "properties.maintenance.read",
      "settings.entity.read",
      "audit.log.read",
    ],
  },
  {
    slug: "finance_officer",
    name: "Finance Officer",
    scopeType: "entity",
    permissions: [
      "finance.transaction.read",
      "finance.transaction.write",
      "finance.approval.read",
      "finance.approval.create",
      "properties.property.read",
      "properties.lease.read",
    ],
  },
  {
    slug: "rentals_mandates_officer",
    name: "Rentals & Mandates Officer",
    scopeType: "entity",
    permissions: [
      "properties.lease.read",
      "properties.lease.write",
      "properties.property.read",
      "finance.transaction.read",
    ],
  },
  {
    slug: "payroll_officer",
    name: "Payroll Officer",
    scopeType: "entity",
    permissions: ["finance.transaction.read"],
  },
  {
    slug: "hr_head",
    name: "Head of HR",
    scopeType: "global",
    permissions: ["identity.user.read", "settings.entity.read"],
  },
  {
    slug: "hr_officer",
    name: "HR Officer",
    scopeType: "entity",
    permissions: ["identity.user.read"],
  },
  {
    slug: "line_manager",
    name: "Line Manager",
    scopeType: "entity",
    permissions: [
      ...keysFor("crm"),
      "properties.property.read",
      "properties.lease.read",
    ],
  },
  {
    slug: "bd_agent",
    name: "Business Development Agent",
    scopeType: "entity",
    permissions: [...keysFor("crm"), "properties.property.read"],
  },
  {
    slug: "front_office_head",
    name: "Front Office Head",
    scopeType: "global",
    permissions: [
      "crm.contact.read",
      "properties.property.read",
      "properties.maintenance.read",
      "properties.maintenance.write",
    ],
  },
  {
    slug: "front_office_admin",
    name: "Front Office Admin",
    scopeType: "entity",
    permissions: ["properties.maintenance.read"],
  },
  {
    slug: "driver",
    name: "Driver",
    scopeType: "self",
    permissions: [],
  },
  {
    slug: "operations_lead",
    name: "Operations Lead",
    scopeType: "entity",
    permissions: [
      "properties.property.read",
      "properties.property.write",
      "properties.lease.read",
      "properties.maintenance.read",
      "properties.maintenance.write",
    ],
  },
  {
    slug: "valuer",
    name: "Valuer",
    scopeType: "entity",
    permissions: ["properties.property.read", "finance.transaction.read"],
  },
  {
    slug: "auditor_compliance",
    name: "Auditor / Compliance",
    scopeType: "global",
    // Read-everywhere, write-nothing.
    permissions: allReadKeys(),
  },
];
