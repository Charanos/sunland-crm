// Shared display metadata for the Valuations module - used by the list
// board, the create/edit and complete modals, and the full-view page, so all
// four read the same vocabulary rather than drifting independently.

export type ValuationType = "market" | "mortgage_security" | "insurance" | "rental_assessment" | "land";
export type ValuationStatus = "requested" | "scheduled" | "in_progress" | "report_draft" | "completed" | "cancelled";

export const TYPE_META: Record<ValuationType, string> = {
  market: "Open Market",
  mortgage_security: "Mortgage Security",
  insurance: "Insurance",
  rental_assessment: "Rental Assessment",
  land: "Land",
};

export const STATUS_META: Record<ValuationStatus, { label: string; tone: "neutral" | "data" | "warning" | "primary" | "success" | "risk" }> = {
  requested: { label: "Requested", tone: "neutral" },
  scheduled: { label: "Site Visit Booked", tone: "data" },
  in_progress: { label: "Inspection", tone: "warning" },
  report_draft: { label: "Report Draft", tone: "primary" },
  completed: { label: "Completed", tone: "success" },
  cancelled: { label: "Cancelled", tone: "risk" },
};

// The workflow ladder - each active stage advances to exactly one next stage;
// completion goes through the record-values modal instead of a blind advance.
export const NEXT_STAGE: Partial<Record<ValuationStatus, { status: ValuationStatus; label: string }>> = {
  requested: { status: "scheduled", label: "Mark Site Visit Booked" },
  scheduled: { status: "in_progress", label: "Begin Inspection" },
  in_progress: { status: "report_draft", label: "Move to Report Draft" },
};

export function fmtDate(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" });
}

export function toDatetimeLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
