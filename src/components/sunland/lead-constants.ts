// Shared, zero-server-dependency Sales Pipeline helpers - same convention as
// valuation-constants.ts/maintenance-constants.ts, safe to import from client
// components. src/lib/services/leads.ts re-exports canMoveLeadStage from here
// rather than defining its own copy, so the kanban's drag-gating and the
// server's real adjacency guard can never drift apart.

export type PipelineStage =
  | "inquiry"
  | "qualification"
  | "viewing"
  | "offer"
  | "negotiation"
  | "closed_won"
  | "closed_lost";

export type PipelineLeadPriority = "low" | "medium" | "high";

// Matches the Sales Pipeline design's own stageOrder()/canMove() - closed_lost
// deliberately isn't a kanban column or a drag target; it's reached only via
// the explicit "Mark Lost" action (see canMoveLeadStage below).
export const STAGE_ORDER: PipelineStage[] = [
  "inquiry",
  "qualification",
  "viewing",
  "offer",
  "negotiation",
  "closed_won",
];

// Exact hex values lifted verbatim from the Sales Pipeline design mockup's
// stageCfg().
export const STAGE_META: Record<PipelineStage, { label: string; color: string }> = {
  inquiry: { label: "New Inquiry", color: "#64748b" },
  qualification: { label: "Qualified", color: "#2A6FDB" },
  viewing: { label: "Viewing Scheduled", color: "#151936" },
  offer: { label: "Offer Sent", color: "#b45309" },
  negotiation: { label: "Legal & Docs", color: "#7c3aed" },
  closed_won: { label: "Closed Won", color: "#047857" },
  closed_lost: { label: "Closed Lost", color: "#be123c" },
};

// Exact colors from the design's prioCfg() (rose/amber/slate).
export const PRIORITY_META: Record<PipelineLeadPriority, { label: string; pill: string; dot: string }> = {
  high: { label: "High", pill: "bg-[rgba(244,63,94,0.1)] text-[#be123c]", dot: "bg-[#be123c]" },
  medium: { label: "Med", pill: "bg-[rgba(245,158,11,0.12)] text-[#b45309]", dot: "bg-[#b45309]" },
  low: { label: "Low", pill: "bg-[#f1f5f9] text-[#64748b]", dot: "bg-[#64748b]" },
};

/**
 * Real adjacency rule (mirrors valuations' canMoveToStage precedent): a deal
 * can only advance/retreat one stage at a time through the 6-stage kanban
 * order. "Mark Lost" is a separate, explicit action outside this rule -
 * valid from any non-terminal stage, never gated by adjacency - matching the
 * design's own canMove() (which has no closed_lost branch at all, since
 * closed_lost is never a drag target).
 */
export function canMoveLeadStage(from: PipelineStage, to: PipelineStage): boolean {
  if (from === to) return false;
  const fi = STAGE_ORDER.indexOf(from);
  const ti = STAGE_ORDER.indexOf(to);
  if (fi < 0 || ti < 0) return false;
  return Math.abs(ti - fi) === 1;
}
