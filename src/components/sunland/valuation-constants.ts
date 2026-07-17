// Shared display metadata + pure business logic for the Valuations module
// (new-mandate acquisition pipeline, repurposed 2026-07-17) - used by the
// register board, both modals, and the full-view page, so everything reads
// the same vocabulary rather than drifting independently. Deliberately has
// zero server-only imports (no `db`, no `crypto`) so it's safe to import
// from client components too - src/lib/services/valuations.ts re-exports
// canMoveToStage/scoreForValuation/daysSince from here rather than each
// defining its own copy.

export type ValuationStage =
  | "requested"
  | "site_visit"
  | "valued"
  | "offer_sent"
  | "accepted"
  | "mandate_signed"
  | "declined";

export const STAGE_ORDER: ValuationStage[] = [
  "requested",
  "site_visit",
  "valued",
  "offer_sent",
  "accepted",
  "mandate_signed",
];

// WIP limits for the Acquisition Focus Board (kanban). 0 means "no limit" -
// requested/accepted/mandate_signed are entry/exit stages a team shouldn't
// be capacity-gated on; site_visit/valued/offer_sent are the stages where a
// property manager or Front Office is doing hands-on work and can only
// realistically carry so many at once. Reasonable fixed defaults, not
// sourced from a settings table - no such per-stage-capacity concept exists
// elsewhere in this app to hook into.
export const STAGE_WIP_LIMITS: Record<ValuationStage, number> = {
  requested: 0,
  site_visit: 4,
  valued: 5,
  offer_sent: 4,
  accepted: 0,
  mandate_signed: 0,
  declined: 0,
};

export const STAGE_META: Record<ValuationStage, { label: string; pill: string; dot: string }> = {
  requested: { label: "Requested", pill: "bg-slate-100 text-slate-600 border-slate-200", dot: "bg-slate-400" },
  site_visit: { label: "Site Visit", pill: "bg-slate-100 text-slate-600 border-slate-200", dot: "bg-slate-500" },
  valued: { label: "Valued", pill: "bg-[#eef2f6] text-[#151936] border-[#cbd5e1]", dot: "bg-[#151936]" },
  offer_sent: { label: "Offer Sent", pill: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500" },
  accepted: { label: "Accepted", pill: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  mandate_signed: { label: "Mandate Signed", pill: "bg-[#122a20]/10 text-[#122a20] border-[#122a20]/30", dot: "bg-[#122a20]" },
  declined: { label: "Declined", pill: "bg-rose-50 text-rose-700 border-rose-200", dot: "bg-rose-500" },
};

export type BadgeTone = "primary" | "neutral" | "success" | "warning" | "risk" | "data" | "brand";

export function stageTone(stage: ValuationStage): BadgeTone {
  switch (stage) {
    case "requested":
    case "site_visit":
      return "neutral";
    case "valued":
      return "brand";
    case "offer_sent":
      return "warning";
    case "accepted":
      return "success";
    case "mandate_signed":
      return "primary";
    case "declined":
      return "risk";
    default:
      return "neutral";
  }
}

/**
 * Server-enforced (src/lib/services/valuations.ts calls this exact function)
 * stage adjacency rule: one step forward or back only, "declined" reachable
 * from any non-terminal stage, and a declined prospect can only be reopened
 * to "valued" or "requested". Imported client-side too (kanban drag preview,
 * disabling invalid drop targets) - the real guard is always the server's,
 * this just keeps the UI from suggesting moves the API would reject anyway.
 */
export function canMoveToStage(from: ValuationStage, to: ValuationStage): boolean {
  if (from === to) return false;
  if (to === "declined") return from !== "mandate_signed";
  if (from === "declined") return to === "valued" || to === "requested";
  const fi = STAGE_ORDER.indexOf(from);
  const ti = STAGE_ORDER.indexOf(to);
  if (fi < 0 || ti < 0) return false;
  return Math.abs(ti - fi) === 1;
}

export function daysSince(date: Date | string): number {
  const d = typeof date === "string" ? new Date(date) : date;
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86_400_000));
}

/**
 * Deterministic 0-100 acquisition-fit score (A-D grade): weighted sum of
 * proposed fee rate, assessed value, landlord-verification status, and
 * freshness (days stuck in the current stage). Same function used by the
 * kanban/grid/list cards and the detail-page hero - never reimplemented
 * per surface.
 */
export function scoreForValuation(input: {
  proposedFeeRatePct: number; // e.g. 8.0 for 8%
  marketValueKes: number;
  landlordVerified: boolean;
  ageDays: number;
}): { score: number; grade: "A" | "B" | "C" | "D"; color: string; label: string } {
  const feeScore = Math.min(35, (input.proposedFeeRatePct / 10) * 35);
  const valScore = Math.min(25, (input.marketValueKes / 90_000_000) * 25);
  const verifiedScore = input.landlordVerified ? 20 : 9;
  const freshScore = Math.max(0, 20 - Math.min(20, input.ageDays / 8));
  const score = Math.round(feeScore + valScore + verifiedScore + freshScore);
  const grade = score >= 80 ? "A" : score >= 66 ? "B" : score >= 52 ? "C" : "D";
  const color = score >= 80 ? "#047857" : score >= 66 ? "#122a20" : score >= 52 ? "#b45309" : "#be123c";
  const label = score >= 80 ? "Strong fit" : score >= 66 ? "Good fit" : score >= 52 ? "Moderate" : "Marginal";
  return { score, grade, color, label };
}

export function fmtDate(iso: string | Date | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" });
}

export function fmtDateTime(iso: string | Date | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("en-KE", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function toDatetimeLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
