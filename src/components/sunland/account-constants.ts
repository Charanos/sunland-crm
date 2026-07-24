// Client-safe shared constants for the Account & System console (ADR 018).
// Imported by both the frontend (account-system-board.tsx) and the service
// layer (account-console.ts) so the role→tier mapping never drifts between
// the two - same cross-import pattern lead-constants.ts established.

export type ConsoleScope = "personal" | "org";
export type PersonalSection = "messages" | "notifications" | "preferences" | "security";
export type OrgSection = "directory" | "policies" | "system";

export const PERSONAL_SECTIONS: PersonalSection[] = ["messages", "notifications", "preferences", "security"];
export const ORG_SECTIONS: OrgSection[] = ["directory", "policies", "system"];

export type ConsoleSection = PersonalSection | OrgSection;

// ── Console routing (ADR 019) ────────────────────────────────────────────────
// Every nav-visible section owns a real pathname. This matters: the sidebar's
// `getActiveNavItem` (nav-model.ts) matches on `pathname.startsWith(href)` and
// pathnames drop the query string - so if the nav pointed at
// `/admin/account?section=…` every item would tie on `/admin/account` and
// highlighting would break. The two org sections that have no nav entry of
// their own hang off /admin/system with a ?section= param.
const PATH_TO_STATE: Record<string, { scope: ConsoleScope; section: ConsoleSection }> = {
  "/admin/messages": { scope: "personal", section: "messages" },
  "/admin/notifications": { scope: "personal", section: "notifications" },
  "/admin/settings": { scope: "personal", section: "preferences" },
  "/admin/security": { scope: "personal", section: "security" },
  "/admin/system": { scope: "org", section: "directory" },
  "/admin/account": { scope: "personal", section: "messages" },
};

const STATE_TO_PATH: Record<string, string> = {
  "personal:messages": "/admin/messages",
  "personal:notifications": "/admin/notifications",
  "personal:preferences": "/admin/settings",
  "personal:security": "/admin/security",
  "org:directory": "/admin/system",
  "org:policies": "/admin/system?section=policies",
  "org:system": "/admin/system?section=system",
};

export function consoleStateForPath(pathname: string) {
  return PATH_TO_STATE[pathname] ?? null;
}

/** Canonical pretty route for a (scope, section) pair - what the console writes back to the URL. */
export function consoleRouteFor(scope: ConsoleScope, section: ConsoleSection): string {
  return STATE_TO_PATH[`${scope}:${section}`] ?? "/admin/account";
}

// The design collapses the real 24-value user_role enum into 6 readable
// access tiers. This is presentation grouping only - the real role/permission
// system (catalog.ts) is untouched.
export type RoleTier = "superadmin" | "admin" | "manager" | "finance" | "agent" | "viewer";

export const ROLE_TIER_META: Record<RoleTier, { label: string; scope: string; color: string; order: number }> = {
  superadmin: { label: "Super-admin", scope: "Full control", color: "#151936", order: 0 },
  admin: { label: "Admin", scope: "Manage org & ops", color: "#2A6FDB", order: 1 },
  manager: { label: "Manager", scope: "Portfolio & tenants", color: "#7c3aed", order: 2 },
  finance: { label: "Finance", scope: "Ledger & remittance", color: "#10b981", order: 3 },
  agent: { label: "Agent", scope: "Listings & viewings", color: "#f59e0b", order: 4 },
  viewer: { label: "Viewer", scope: "Read-only", color: "#64748b", order: 5 },
};

export const ROLE_TIER_ORDER: RoleTier[] = ["superadmin", "admin", "manager", "finance", "agent", "viewer"];

const ROLE_TO_TIER: Record<string, RoleTier> = {
  ceo: "superadmin",
  general_manager: "admin",
  head_of_strategy: "admin",
  operations_lead: "admin",
  front_office_head: "admin",
  hr_head: "admin",
  hr_manager: "admin",
  bd_head: "admin",
  finance_head: "finance",
  finance_officer: "finance",
  accounts_manager: "finance",
  accounts_officer: "finance",
  payroll_officer: "finance",
  line_manager: "manager",
  property_manager: "manager",
  rentals_mandates_officer: "manager",
  front_office_admin: "manager",
  bd_agent: "agent",
  agent: "agent",
  valuer: "agent",
  driver: "viewer",
  auditor: "viewer",
  auditor_compliance: "viewer",
  hr_officer: "viewer",
};

export function roleTierFor(role: string): RoleTier {
  return ROLE_TO_TIER[role] ?? "viewer";
}

// Notification routing categories (mirror the service's NOTIFICATION_CATEGORIES).
export const NOTIF_CATEGORY_META: Record<string, { label: string; hint: string; icon: string; color: string }> = {
  viewing: { label: "Viewings", hint: "Bookings, confirmations, reschedules", icon: "IconEye", color: "#151936" },
  remittance: { label: "Remittances", hint: "Payout runs and landlord statements", icon: "IconCash", color: "#10b981" },
  maintenance: { label: "Maintenance", hint: "Work orders and critical repairs", icon: "IconTool", color: "#f43f5e" },
  approval: { label: "Approvals", hint: "Mandates and spend above threshold", icon: "IconFileCertificate", color: "#f59e0b" },
  renewal: { label: "Renewals", hint: "Lease expiries and escalations", icon: "IconRefresh", color: "#64748b" },
  system: { label: "System & compliance", hint: "Alerts, exports and integrations", icon: "IconServerBolt", color: "#7c3aed" },
};

// Org access-policy well-known settings keys + defaults. Stored in the real
// entity-scoped `settings` table. Only the approval threshold has a real
// enforcement point today (the approvals engine); the rest are stored and
// surfaced honestly, their enforcement flagged as future work.
export const ORG_POLICY_KEYS = {
  enforce2fa: "policy.enforce_2fa",
  sso: "policy.sso",
  ipAllowlist: "policy.ip_allowlist",
  deviceTrust: "policy.device_trust",
  dualRemit: "policy.dual_remit",
  pwdStrength: "policy.pwd_strength",
  sessionTimeout: "policy.session_timeout",
} as const;

// Org-default well-known settings keys (Preferences → Organization defaults).
export const ORG_DEFAULT_KEYS = {
  legalName: "org.legal_name",
  currency: "org.currency",
  timezone: "org.timezone",
  fiscalYearStart: "org.fiscal_year_start",
  remittanceDay: "org.remittance_day",
  seatCap: "org.seat_cap",
} as const;
