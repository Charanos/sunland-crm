// Client-safe shared vocabulary for the Oversight Console (ADR 020). Same
// cross-imported-constants convention as maintenance-constants.ts /
// scheduler-constants.ts / account-constants.ts, so the console UI and the
// service layer can never drift on what a section, an SLA target or a job key
// means.
//
// Nothing here fabricates data: the SLA computation is a pure derivation over
// real timestamps (it reuses maintenance-constants' slaStateFor rather than
// cloning it), and the hour targets are settings-backed defaults the service
// layer overrides from real `settings` rows.

import type { Icon } from "@tabler/icons-react";
import {
  IconAlertTriangle,
  IconChecklist,
  IconDatabase,
  IconFileAnalytics,
  IconLifebuoy,
  IconMail,
  IconMessageCircle,
  IconPhone,
  IconReportAnalytics,
  IconServerBolt,
  IconWorld,
} from "@tabler/icons-react";
import { slaStateFor, type SlaState } from "./maintenance-constants";

// ── Sections + routing ───────────────────────────────────────────────────────

export type OversightSection = "approvals" | "complaints" | "tickets" | "reports" | "system";

export const OVERSIGHT_SECTIONS: OversightSection[] = ["approvals", "complaints", "tickets", "reports", "system"];

export const SECTION_META: Record<OversightSection, { label: string; icon: Icon; title: string; sub: string; divider: string }> = {
  approvals: {
    label: "Approvals",
    icon: IconChecklist,
    title: "Approvals Queue",
    sub: "Everything waiting on a decision from you, with the real authority threshold applied.",
    divider: "Awaiting decision",
  },
  complaints: {
    label: "Complaints",
    icon: IconAlertTriangle,
    title: "Complaints",
    sub: "Confidential grievance cases routed to HR, the GM, or you.",
    divider: "Case register",
  },
  tickets: {
    label: "Support",
    icon: IconLifebuoy,
    title: "Support Tickets",
    sub: "Technical difficulties staff hit with the ERP itself — the admin desk is the endpoint.",
    divider: "Ticket desk",
  },
  reports: {
    label: "Reports",
    icon: IconReportAnalytics,
    title: "Reports Center",
    sub: "Generate verifiable financial reports and manage their delivery schedules.",
    divider: "Report library",
  },
  system: {
    label: "System",
    icon: IconServerBolt,
    title: "System Administration",
    sub: "Live service health, background jobs, maintenance mode, and the organisation audit trail.",
    divider: "Platform operations",
  },
};

/**
 * Every nav-visible section keeps its own real pathname. This is load-bearing:
 * `getActiveNavItem` (nav-model.ts) matches on `pathname.startsWith(href)` and
 * pathnames drop the query string, so routing sections through
 * `/admin/oversight?section=…` would make every Oversight nav item tie on the
 * same prefix and break the sidebar highlight (the lesson of ADR 019 §19.1).
 */
const PATH_TO_SECTION: Record<string, OversightSection> = {
  "/admin/approvals": "approvals",
  "/admin/hr/complaints": "complaints",
  "/admin/support": "tickets",
  "/admin/reports": "reports",
  "/admin/system": "system",
  "/admin/oversight": "approvals",
};

const SECTION_TO_PATH: Record<OversightSection, string> = {
  approvals: "/admin/approvals",
  complaints: "/admin/hr/complaints",
  tickets: "/admin/support",
  reports: "/admin/reports",
  system: "/admin/system",
};

export function oversightSectionForPath(pathname: string): OversightSection | null {
  return PATH_TO_SECTION[pathname] ?? null;
}

/** Canonical pretty route for a section - what the console writes back to the URL. */
export function oversightRouteFor(section: OversightSection): string {
  return SECTION_TO_PATH[section] ?? "/admin/oversight";
}

// ── Approvals ────────────────────────────────────────────────────────────────

export type ApprovalStatus = "pending" | "approved" | "rejected" | "escalated";

export const APPROVAL_STATUS_META: Record<ApprovalStatus, { label: string; pill: string; dot: string }> = {
  pending: { label: "Pending", pill: "bg-[rgba(243,223,39,0.22)] text-[#151936]", dot: "bg-[#f3df27]" },
  approved: { label: "Approved", pill: "bg-[rgba(16,185,129,0.12)] text-[#047857]", dot: "bg-[#10b981]" },
  rejected: { label: "Rejected", pill: "bg-[rgba(244,63,94,0.12)] text-[#be123c]", dot: "bg-[#f43f5e]" },
  escalated: { label: "Escalated", pill: "bg-[rgba(129,140,248,0.14)] text-[#4338ca]", dot: "bg-[#818cf8]" },
};

export const APPROVER_ROLE_LABEL: Record<string, string> = {
  gm: "General Manager",
  ceo: "CEO",
  department_head: "Department Head",
};

/**
 * The settings key holding the CEO's personal sign-off threshold. Real and
 * already seeded (settings.ts DEFAULT_SETTINGS); the console reads it rather
 * than hardcoding the figure the design mocked up.
 */
export const CEO_APPROVAL_THRESHOLD_KEY = "property_petty_cash_ceo_threshold_kes";

/** Deep link for an approval's underlying record, from the real relatedTable/relatedId. */
export function approvalRecordHref(relatedTable: string, relatedId: string): string | null {
  switch (relatedTable) {
    case "property_mandates": return `/admin/leases`;
    case "maintenance_requests": return `/admin/maintenance/${relatedId}`;
    case "leases": return `/admin/leases/${relatedId}`;
    case "properties": return `/admin/properties/${relatedId}`;
    case "remittance_advices": return `/admin/leases`;
    default: return null;
  }
}

// ── Complaints ───────────────────────────────────────────────────────────────

export type ComplaintCategory = "conduct" | "harassment" | "policy" | "safety" | "other";
export type ComplaintStatus = "open" | "escalated" | "resolved";

export const COMPLAINT_CATEGORY_META: Record<ComplaintCategory, { label: string; pill: string }> = {
  conduct: { label: "Conduct", pill: "bg-[rgba(21,25,54,0.07)] text-[#151936]" },
  harassment: { label: "Harassment", pill: "bg-[rgba(244,63,94,0.1)] text-[#be123c]" },
  policy: { label: "Policy", pill: "bg-[rgba(42,111,219,0.1)] text-[#2A6FDB]" },
  safety: { label: "Safety", pill: "bg-[rgba(245,158,11,0.14)] text-[#b45309]" },
  other: { label: "Other", pill: "bg-[#f1f5f9] text-[#64748b]" },
};

export const COMPLAINT_STATUS_META: Record<ComplaintStatus, { label: string; pill: string; dot: string }> = {
  open: { label: "Open", pill: "bg-[rgba(243,223,39,0.22)] text-[#151936]", dot: "bg-[#f3df27]" },
  escalated: { label: "Escalated", pill: "bg-[rgba(244,63,94,0.1)] text-[#be123c]", dot: "bg-[#f43f5e]" },
  resolved: { label: "Resolved", pill: "bg-[rgba(16,185,129,0.12)] text-[#047857]", dot: "bg-[#10b981]" },
};

export const COMPLAINT_OWNER_LABEL: Record<string, string> = {
  hr_head: "HR Head",
  gm: "General Manager",
  ceo: "CEO",
};

// ── Support tickets ──────────────────────────────────────────────────────────

export type TicketPriority = "low" | "normal" | "high" | "critical";
export type TicketStatus = "open" | "in_progress" | "resolved" | "closed";
export type TicketChannel = "portal" | "email" | "phone" | "whatsapp";

export const TICKET_PRIORITY_META: Record<TicketPriority, { label: string; pill: string }> = {
  low: { label: "Low", pill: "bg-[#f1f5f9] text-[#64748b]" },
  normal: { label: "Normal", pill: "bg-[rgba(42,111,219,0.1)] text-[#2A6FDB]" },
  high: { label: "High", pill: "bg-[rgba(245,158,11,0.14)] text-[#b45309]" },
  critical: { label: "Critical", pill: "bg-[rgba(244,63,94,0.12)] text-[#be123c]" },
};

export const TICKET_STATUS_META: Record<TicketStatus, { label: string; pill: string; dot: string }> = {
  open: { label: "Open", pill: "bg-[rgba(243,223,39,0.22)] text-[#151936]", dot: "bg-[#f3df27]" },
  in_progress: { label: "In Progress", pill: "bg-[rgba(129,140,248,0.14)] text-[#4338ca]", dot: "bg-[#818cf8]" },
  resolved: { label: "Resolved", pill: "bg-[rgba(16,185,129,0.12)] text-[#047857]", dot: "bg-[#10b981]" },
  closed: { label: "Closed", pill: "bg-[#f1f5f9] text-[#64748b]", dot: "bg-[#94a3b8]" },
};

export const TICKET_CHANNEL_META: Record<TicketChannel, { label: string; icon: Icon }> = {
  portal: { label: "Portal", icon: IconWorld },
  email: { label: "Email", icon: IconMail },
  phone: { label: "Phone", icon: IconPhone },
  whatsapp: { label: "WhatsApp", icon: IconMessageCircle },
};

/**
 * First-response hour targets per priority. These are the fallbacks; the
 * service layer overrides them from real `settings` rows under these keys, the
 * same "thresholds as data, never hardcoded" rule the finance thresholds
 * follow (backend master §5.1).
 */
export const TICKET_SLA_SETTING_KEYS: Record<TicketPriority, string> = {
  low: "support_sla_response_hours_low",
  normal: "support_sla_response_hours_normal",
  high: "support_sla_response_hours_high",
  critical: "support_sla_response_hours_critical",
};

export const TICKET_SLA_DEFAULT_HOURS: Record<TicketPriority, number> = {
  low: 72,
  normal: 24,
  high: 8,
  critical: 2,
};

/**
 * Real first-response SLA for a ticket. Reuses maintenance-constants'
 * slaStateFor rather than duplicating the arithmetic - the computation is
 * identical (elapsed vs. a target window, frozen once the clock stops), only
 * the stopping event differs: a ticket's clock stops at its first staff
 * reply (firstRespondedAt), not at resolution.
 *
 * A ticket that was never replied to and is already closed is still measured
 * against its resolution time, so a silently-closed ticket cannot quietly
 * report "on track".
 */
export function ticketSlaFor(input: {
  priority: TicketPriority;
  createdAt: string | Date;
  firstRespondedAt: string | Date | null;
  resolvedAt: string | Date | null;
  targetHours?: number;
}): { state: SlaState; hoursElapsed: number; hoursRemaining: number; responded: boolean } {
  const targetHours = input.targetHours ?? TICKET_SLA_DEFAULT_HOURS[input.priority];
  const stoppedAt = input.firstRespondedAt ?? input.resolvedAt;
  const sla = slaStateFor({ createdAt: input.createdAt, resolvedAt: stoppedAt, targetHours });
  return { ...sla, responded: input.firstRespondedAt != null };
}

// ── Reports ──────────────────────────────────────────────────────────────────

export type ReportCadence = "daily" | "weekly" | "monthly" | "quarterly";

export const CADENCE_LABEL: Record<ReportCadence, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
};

/**
 * Only reports the codebase can genuinely produce are listed. `generatePnLReport`
 * is real (finance/reports.ts) and writes a QR-verifiable report_exports row;
 * anything without a real generator is deliberately absent rather than shown
 * as a disabled tease.
 */
export const REPORT_CATALOG: Array<{ key: string; name: string; desc: string; icon: Icon; generator: "pnl" }> = [
  {
    key: "pnl",
    name: "Profit & Loss",
    desc: "Revenue by stream against real operating expenses for the period, verifiable by QR token.",
    icon: IconFileAnalytics,
    generator: "pnl",
  },
];

// ── System operations ────────────────────────────────────────────────────────

export const MAINTENANCE_MODE_KEY = "ops.maintenance_mode";
export const MAINTENANCE_MESSAGE_KEY = "ops.maintenance_message";

export type ServiceHealthStatus = "healthy" | "degraded" | "down" | "not_configured";

export const HEALTH_STATUS_META: Record<ServiceHealthStatus, { label: string; color: string; pill: string }> = {
  healthy: { label: "Healthy", color: "#10b981", pill: "bg-[rgba(16,185,129,0.12)] text-[#047857]" },
  degraded: { label: "Degraded", color: "#f59e0b", pill: "bg-[rgba(245,158,11,0.14)] text-[#b45309]" },
  down: { label: "Down", color: "#f43f5e", pill: "bg-[rgba(244,63,94,0.12)] text-[#be123c]" },
  not_configured: { label: "Not configured", color: "#94a3b8", pill: "bg-[#f1f5f9] text-[#64748b]" },
};

/** The services the probe actually measures. Adding a row here means writing a real check. */
export const MONITORED_SERVICES: Array<{ key: string; name: string; note: string }> = [
  { key: "database", name: "Neon Postgres", note: "Primary datastore" },
  { key: "realtime", name: "Ably Realtime", note: "Messaging & notifications" },
  { key: "cache", name: "Upstash Redis", note: "Rate limiting & cache" },
  { key: "mpesa", name: "M-Pesa Daraja", note: "Tenant payments" },
];

export type JobKey = "health_probe" | "pnl_snapshot" | "remittance_run";

/**
 * The background-job registry. Every entry maps to a real service call that
 * "Run now" genuinely executes and records in `job_runs`.
 *
 * `cadence` is deliberately the literal truth: there is no scheduler in this
 * codebase, so nothing here runs on its own and the console says so instead of
 * displaying an invented cron string.
 */
export const JOB_REGISTRY: Array<{ key: JobKey; name: string; desc: string; icon: Icon }> = [
  {
    key: "health_probe",
    name: "Service health probe",
    desc: "Measures each monitored service and records the result.",
    icon: IconServerBolt,
  },
  {
    key: "pnl_snapshot",
    name: "P&L snapshot",
    desc: "Generates a verifiable profit-and-loss export for the current month.",
    icon: IconFileAnalytics,
  },
  {
    key: "remittance_run",
    name: "Landlord remittance run",
    desc: "Drafts remittance advices for active mandates with collected rent.",
    icon: IconDatabase,
  },
];

export const NO_SCHEDULER_NOTE = "Manual — no scheduler configured";
