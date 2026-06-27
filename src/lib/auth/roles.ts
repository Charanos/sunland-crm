import type { UserRole } from "@/types";

// ─── Universal paths accessible by ALL authenticated users regardless of role ─

export const UNIVERSAL_PATHS = [
  "/admin/profile",
  "/admin/settings",
  "/admin/notifications",
  "/admin/security",
  "/admin/messages",
  "/fin/profile",
  "/fin/settings",
  "/fin/notifications",
  "/fin/security",
  "/fin/messages",
];

// ─── Role → allowed path prefixes ─────────────────────────────────────────────

const roleAccess: Record<UserRole, string[]> = {
  ceo: ["/admin", "/ops", "/fin", "/hr"],
  general_manager: ["/admin", "/ops", "/fin", "/hr"],
  finance_head: ["/fin", "/admin/reports", "/admin/properties", "/admin/leases", "/admin/maintenance"],
  accounts_manager: ["/fin", "/admin/reports", "/admin/properties", "/admin/leases", "/admin/maintenance"],
  finance_officer: ["/fin/ledger", "/fin/rentals", "/fin/ap-ar", "/fin/cheques", "/fin/reports", "/admin/properties", "/admin/leases"],
  accounts_officer: ["/fin/ledger", "/fin/ap-ar", "/fin/cheques", "/fin/reports", "/admin/properties", "/admin/leases"],
  rentals_officer: ["/fin/rentals", "/fin/mandates", "/admin/properties", "/admin/leases"],
  rentals_mandates_officer: ["/fin/rentals", "/fin/mandates", "/admin/properties", "/admin/leases"],
  payroll_officer: ["/fin/payroll"],
  hr_head: ["/admin/hr", "/admin/reports"],
  hr_manager: ["/admin/hr", "/admin/reports"],
  hr_officer: ["/admin/hr"],
  line_manager: ["/admin/pipeline", "/admin/contacts", "/admin/properties", "/admin/leases"],
  bd_head: ["/admin/pipeline", "/admin/contacts", "/admin/properties", "/admin/leases"],
  agent: ["/admin/pipeline", "/admin/contacts", "/admin/properties"],
  bd_agent: ["/admin/pipeline", "/admin/contacts", "/admin/properties"],
  front_office_head: ["/admin/front-office", "/admin/contacts", "/admin/properties", "/admin/leases"],
  front_office_admin: ["/admin/front-office"],
  driver: ["/admin/front-office/logistics"],
  operations_lead: ["/admin/properties", "/admin/leases", "/admin/maintenance"],
  property_manager: ["/admin/properties", "/admin/leases", "/admin/maintenance"],
  valuer: ["/admin/properties", "/admin/valuations"],
  auditor: ["/admin", "/ops", "/fin", "/hr"],
  auditor_compliance: ["/admin", "/ops", "/fin", "/hr"],
};

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

export function isUniversalPath(pathname: string): boolean {
  return UNIVERSAL_PATHS.some((p) => pathname.startsWith(p));
}

export function canAccess(role: UserRole, pathname: string): boolean {
  // Universal self-service paths are always accessible to any authenticated user
  if (isUniversalPath(pathname)) return true;

  if (pathname === "/fin") {
    return financeOverviewRoles.includes(role);
  }

  // Allow access to sub-resources and handle base case
  return (roleAccess[role] || []).some((prefix) => pathname.startsWith(prefix));
}

export function getDefaultPortal(role: UserRole): string {
  switch (role) {
    case "ceo":
    case "general_manager":
      return "/admin";
    case "finance_head":
    case "accounts_manager":
    case "finance_officer":
    case "accounts_officer":
    case "rentals_officer":
    case "rentals_mandates_officer":
    case "payroll_officer":
      return "/fin";
    case "hr_head":
    case "hr_manager":
    case "hr_officer":
      return "/admin/hr";
    case "line_manager":
    case "bd_head":
    case "agent":
    case "bd_agent":
      return "/admin/pipeline";
    case "front_office_head":
    case "front_office_admin":
      return "/admin/front-office";
    case "driver":
      return "/admin/front-office/logistics";
    case "operations_lead":
    case "property_manager":
      return "/admin/maintenance";
    case "valuer":
      return "/admin/valuations";
    case "auditor":
    case "auditor_compliance":
      return "/admin/reports";
    default:
      return "/admin";
  }
}
