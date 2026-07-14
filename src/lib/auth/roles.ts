import type { UserRole } from "@/types";

// ─── Universal paths accessible by ALL authenticated users regardless of role ─
// NOTE (ADR 010): Self-service is portal-local. Each portal renders its own
// profile/settings/security/notifications/messages within its own shell.
// UNIVERSAL_PATHS is kept minimal - only paths that genuinely need cross-portal
// reach (the fin portal self-service paths below). Once HR/BD/Front portals
// get their own route groups, their entries are added here too.

export const UNIVERSAL_PATHS = [
  "/admin/profile",
  "/admin/settings",
  "/admin/notifications",
  "/admin/security",
  "/admin/messages",
  // Any authenticated staff member can reach this to file a ticket, regardless
  // of portal - "admin is the main support endpoint" (the backend naturally
  // scopes non-CEO/GM callers to their own tickets via scope=mine).
  "/admin/support",
  "/fin/profile",
  "/fin/settings",
  "/fin/notifications",
  "/fin/security",
  "/fin/messages",
];

// ─── CEO-exclusive paths (absent - not greyed - for any other role) ───────────
// These are enforced in canAccess() with an early return, so nav filtering
// via canAccess(role, href) will correctly exclude them from the sidebar.

const CEO_ONLY_PATHS = [
  "/admin/system",
];

// ─── HR Complaints - absent, not greyed, for anyone outside this tier ─────────
// HR spec §6.2/§6.4: HR Head, GM, and CEO only. GM/CEO's actual visibility is
// further narrowed server-side to items escalated to them (src/lib/services/
// complaints.ts) - this is only the coarse sidebar/route gate.
const COMPLAINTS_ACCESS_ROLES: UserRole[] = ["hr_head", "general_manager", "ceo"];

// ─── Role → allowed path prefixes ─────────────────────────────────────────────

const roleAccess: Record<UserRole, string[]> = {
  // ── Executive tier ──────────────────────────────────────────────────────────
  ceo: ["/admin", "/ops", "/fin", "/hr"],
  general_manager: ["/admin", "/ops", "/fin", "/hr"],

  // Head of Strategy (ADR 013 §13.1, ADR 014 §14.3) - global-scope BD/
  // property-management department head, sits above Property Manager.
  head_of_strategy: [
    "/admin/contacts",
    "/admin/properties",
    "/admin/leases",
    "/admin/maintenance",
    "/admin/valuations",
    "/admin/projects",
    "/admin/events",
    "/admin/reports",
  ],

  // ── Finance family ──────────────────────────────────────────────────────────
  // finance_head sees the full /fin portal + cross-reads on properties/leases
  finance_head: [
    "/fin",
    "/admin/reports",
    "/admin/properties",
    "/admin/leases",
    "/admin/maintenance",
    "/admin/projects",
    "/admin/events",
  ],
  accounts_manager: [
    "/fin",
    "/admin/reports",
    "/admin/properties",
    "/admin/leases",
    "/admin/maintenance",
    "/admin/projects",
    "/admin/events",
  ],
  finance_officer: [
    "/fin/ledger",
    "/fin/rentals",
    "/fin/ap-ar",
    "/fin/cheques",
    "/fin/reports",
    "/admin/properties",
    "/admin/leases",
  ],
  accounts_officer: [
    "/fin/ledger",
    "/fin/ap-ar",
    "/fin/cheques",
    "/fin/reports",
    "/admin/properties",
    "/admin/leases",
  ],
  rentals_officer: [
    "/fin",
    "/fin/rentals",
    "/fin/mandates",
    "/admin/properties",
    "/admin/leases",
  ],
  rentals_mandates_officer: [
    "/fin",
    "/fin/rentals",
    "/fin/mandates",
    "/admin/properties",
    "/admin/leases",
  ],
  payroll_officer: ["/fin/payroll"],

  // ── HR family ───────────────────────────────────────────────────────────────
  hr_head: ["/admin/hr", "/admin/reports", "/admin/projects", "/admin/events"],
  hr_officer: ["/admin/hr"],

  // ── Business Development (now Property Managers) ────────────────────────────
  // ── Front Office ─────────────────────────────────────────────────────────────
  front_office_head: [
    "/admin/front-office",
    "/admin/contacts",
    "/admin/properties",
    "/admin/leases",
    "/admin/projects",
    "/admin/events",
  ],
  front_office_admin: ["/admin/front-office"],
  driver: ["/admin/front-office/logistics"],

  // ── Operations ───────────────────────────────────────────────────────────────
  operations_lead: [
    "/admin/properties",
    "/admin/leases",
    "/admin/maintenance",
    "/admin/projects",
    "/admin/events",
  ],
  property_manager: [
    "/admin/properties",
    "/admin/leases",
    "/admin/maintenance",
    "/admin/projects",
    "/admin/events",
  ],
  valuer: ["/admin/properties", "/admin/valuations"],

  // ── Audit / Compliance ───────────────────────────────────────────────────────
  // Auditor has broad read access but no write paths - action-level authz
  // in the service layer enforces this; the portal access here is coarse.
  auditor: ["/admin", "/ops", "/fin", "/hr"],
  auditor_compliance: ["/admin", "/ops", "/fin", "/hr"],
};

// Roles that can reach the Finance Overview landing page (/fin root exactly)
const financeOverviewRoles: UserRole[] = [
  "ceo",
  "general_manager",
  "finance_head",
  "accounts_manager",
  "finance_officer",
  "accounts_officer",
  "rentals_officer",
  "rentals_mandates_officer",
  "payroll_officer",
  "auditor",
  "auditor_compliance",
];

// Roles that can reach the Executive Approvals Queue and Reports Center
const executiveOversightRoles: UserRole[] = [
  "ceo",
  "general_manager",
  "auditor_compliance",
];

export function isUniversalPath(pathname: string): boolean {
  return UNIVERSAL_PATHS.some((p) => pathname.startsWith(p));
}

export function canAccess(role: UserRole, pathname: string): boolean {
  // 1. Universal self-service paths - always accessible to any authenticated user
  if (isUniversalPath(pathname)) return true;

  // 2. CEO-only paths - explicitly absent (not greyed) for every other role.
  //    Per Executive spec §4.1 and ADR 012, System Administration is CEO-exclusive.
  if (CEO_ONLY_PATHS.some((p) => pathname.startsWith(p))) {
    return role === "ceo";
  }

  // 2b. HR Complaints - absent for anyone outside HR Head/GM/CEO (HR spec §6.2/§6.4).
  if (pathname.startsWith("/admin/hr/complaints")) {
    return COMPLAINTS_ACCESS_ROLES.includes(role);
  }

  // 3. Executive oversight paths (Approvals Queue, Reports Center)
  if (
    pathname.startsWith("/admin/approvals") ||
    pathname.startsWith("/admin/reports")
  ) {
    return executiveOversightRoles.includes(role);
  }

  // 4. Finance Overview exact-match (the /fin root is a dashboard landing page,
  //    not just a path prefix - restrict who may land there)
  if (pathname === "/fin") {
    return financeOverviewRoles.includes(role);
  }

  // 5. General prefix-based access
  return (roleAccess[role] || []).some((prefix) => pathname.startsWith(prefix));
}

export function getDefaultPortal(role: UserRole): string {
  switch (role) {
    case "ceo":
    case "general_manager":
      return "/admin";
    case "head_of_strategy":
      return "/admin/properties";
    case "finance_head":
    case "accounts_manager":
    case "finance_officer":
    case "accounts_officer":
    case "rentals_officer":
    case "rentals_mandates_officer":
    case "payroll_officer":
      return "/fin";
    case "hr_head":
    case "hr_officer":
      return "/admin/hr";
    case "operations_lead":
    case "property_manager":
      return "/admin/maintenance";
    case "front_office_head":
    case "front_office_admin":
      return "/admin/front-office";
    case "driver":
      return "/admin/front-office/logistics";
    case "valuer":
      return "/admin/valuations";
    case "auditor":
    case "auditor_compliance":
      return "/admin/reports";
    default:
      return "/admin";
  }
}
