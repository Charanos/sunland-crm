// Shared, zero-server-dependency maintenance helpers - same convention as
// valuation-constants.ts/mandate-constants.ts, safe to import from client
// components. slaStateFor/costApprovalTierFor are pure derivations over real
// timestamps/numbers - nothing here is fabricated or decorative; the actual
// hour targets and KES thresholds are fetched from real `settings` rows by
// the caller (src/lib/services/maintenance.ts), never hardcoded here.
//
// STATUS_META/PRIORITY_META/CATEGORY_META colors are lifted verbatim (hex/
// rgba, no rounding to the nearest Tailwind step) from the Maintenance Board
// design (Claude Design MCP, project "Property Command Center Overhaul") -
// deliberately distinct from the generic Badge component's tone palette, and
// pill-only (no border), matching the mockup's own `pill(bg, fg)` recipe.

export type MaintenanceStatus = "reported" | "awaiting_approval" | "scheduled" | "in_progress" | "done";
// Column name stays `priority`; UI label is "Severity" per the design.
export type MaintenancePriority = "routine" | "urgent" | "critical";
export type MaintenanceCategory = "reactive" | "planned" | "compliance";

export const STATUS_META: Record<MaintenanceStatus, { label: string; pill: string; dot: string }> = {
  reported: { label: "Reported", pill: "bg-[#f1f5f9] text-[#64748b]", dot: "bg-[#94a3b8]" },
  awaiting_approval: {
    label: "Awaiting Approval",
    pill: "bg-[rgba(245,158,11,0.14)] text-[#b45309]",
    dot: "bg-[#f59e0b]",
  },
  scheduled: { label: "Scheduled", pill: "bg-[rgba(129,140,248,0.14)] text-[#4338ca]", dot: "bg-[#818cf8]" },
  in_progress: { label: "In Progress", pill: "bg-[rgba(243,223,39,0.22)] text-[#151936]", dot: "bg-[#f3df27]" },
  done: { label: "Completed", pill: "bg-[rgba(16,185,129,0.12)] text-[#047857]", dot: "bg-[#10b981]" },
};

export const PRIORITY_META: Record<MaintenancePriority, { label: string; pill: string; dot: string; rail: string }> = {
  routine: { label: "Routine", pill: "bg-[#f1f5f9] text-[#64748b]", dot: "bg-[#64748b]", rail: "bg-[#cbd5e1]" },
  urgent: {
    label: "Urgent",
    pill: "bg-[rgba(245,158,11,0.14)] text-[#b45309]",
    dot: "bg-[#b45309]",
    rail: "bg-[#f59e0b]",
  },
  critical: {
    label: "Critical",
    pill: "bg-[rgba(244,63,94,0.12)] text-[#be123c]",
    dot: "bg-[#be123c]",
    rail: "bg-[#f43f5e]",
  },
};

export const CATEGORY_META: Record<MaintenanceCategory, { label: string; pill: string }> = {
  reactive: { label: "Reactive", pill: "bg-[rgba(21,25,54,0.07)] text-[#151936]" },
  planned: { label: "Planned", pill: "bg-[rgba(16,185,129,0.12)] text-[#047857]" },
  compliance: { label: "Compliance", pill: "bg-[rgba(244,63,94,0.1)] text-[#be123c]" },
};

export type SlaState = "ok" | "at_risk" | "breached";

/**
 * Real SLA computation from actual createdAt/resolvedAt timestamps against a
 * real settings-backed hour target - "at_risk" once less than 20% of the
 * target window remains, "breached" once elapsed time exceeds it. An open
 * request compares elapsed-so-far against now(); a resolved/closed one
 * compares against its actual resolution time (frozen, not still ticking).
 */
export function slaStateFor(input: {
  createdAt: string | Date;
  resolvedAt: string | Date | null;
  targetHours: number;
}): { state: SlaState; hoursElapsed: number; hoursRemaining: number } {
  const created = typeof input.createdAt === "string" ? new Date(input.createdAt) : input.createdAt;
  const end = input.resolvedAt
    ? typeof input.resolvedAt === "string"
      ? new Date(input.resolvedAt)
      : input.resolvedAt
    : new Date();
  const hoursElapsed = Math.max(0, (end.getTime() - created.getTime()) / 3_600_000);
  const hoursRemaining = input.targetHours - hoursElapsed;
  const state: SlaState = hoursRemaining < 0 ? "breached" : hoursRemaining <= input.targetHours * 0.2 ? "at_risk" : "ok";
  return { state, hoursElapsed, hoursRemaining };
}

// Display-only 4th state: once a request is done, its SLA row-text goes
// neutral grey regardless of how fast it closed (matches the design's w5
// "Closed in 2 days" sample, which renders grey even though it beat target).
export type SlaDisplayState = SlaState | "done";

export function slaDisplayStateFor(status: MaintenanceStatus, sla: SlaState): SlaDisplayState {
  return status === "done" ? "done" : sla;
}

export const SLA_STATE_META: Record<SlaDisplayState, { label: string; color: string }> = {
  ok: { label: "On Track", color: "#047857" },
  at_risk: { label: "At Risk", color: "#b45309" },
  breached: { label: "Breached", color: "#be123c" },
  done: { label: "Closed", color: "#94a3b8" },
};

export type CostApprovalTier = "auto" | "gm" | "ceo";

/**
 * Mirrors createMandate's own threshold ladder (ADR 014 §14.2) rather than
 * inventing a separate rule: the property's own mandate maintenanceAuthorityKes
 * (if configured) is the auto-approve ceiling; above that needs GM; above the
 * (real, settings-backed) CEO threshold always needs CEO regardless of the
 * mandate's authority. The Maintenance Board design's mid-tier copy says
 * "landlord approval via portal" - no such portal exists anywhere in this
 * app, so callers should render that tier as real GM approval instead.
 */
export function costApprovalTierFor(input: {
  costKes: number;
  maintenanceAuthorityKes: number | null;
  gmThresholdKes: number;
  ceoThresholdKes: number;
}): CostApprovalTier {
  if (input.costKes > input.ceoThresholdKes) return "ceo";
  const autoApproveCeiling = input.maintenanceAuthorityKes ?? input.gmThresholdKes;
  if (input.costKes > autoApproveCeiling) return "gm";
  return "auto";
}
