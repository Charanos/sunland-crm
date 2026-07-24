// Client-safe shared vocabulary for the Operations Scheduler and the Projects
// Board (ADR 019). Same cross-imported-constants pattern as
// mandate-constants.ts / maintenance-constants.ts / account-constants.ts, so
// the two boards can never drift on what a status or an event type means.

import type { Icon } from "@tabler/icons-react";
import {
  IconBriefcase,
  IconCalendarEvent,
  IconCash,
  IconGavel,
  IconHome,
  IconTool,
  IconUsers,
  IconVideo,
} from "@tabler/icons-react";

// ── Calendar events ──────────────────────────────────────────────────────────

export type EventType = "internal" | "external" | "legal" | "maintenance" | "viewing";

export const EVENT_TYPE_META: Record<EventType, { label: string; short: string; color: string; icon: Icon }> = {
  internal: { label: "Internal meeting", short: "Internal", color: "#151936", icon: IconVideo },
  external: { label: "External / client", short: "External", color: "#10b981", icon: IconUsers },
  legal: { label: "Legal / escrow", short: "Legal", color: "#f59e0b", icon: IconGavel },
  maintenance: { label: "Site inspection", short: "Maintenance", color: "#f43f5e", icon: IconTool },
  viewing: { label: "Property viewing", short: "Viewing", color: "#7c3aed", icon: IconHome },
};

export const EVENT_TYPE_ORDER: EventType[] = ["internal", "external", "viewing", "legal", "maintenance"];

export function eventTypeMeta(type: string) {
  return EVENT_TYPE_META[type as EventType] ?? EVENT_TYPE_META.internal;
}

// ── Project board columns ────────────────────────────────────────────────────
// The kanban's four columns are a view over (status, atRisk) - "at risk" is a
// warning on work that is still genuinely in progress, not its own lifecycle
// stage, so it lives beside `status` rather than inside the enum.

export type BoardColumn = "planned" | "progress" | "risk" | "done";

export const BOARD_COLUMN_META: Record<BoardColumn, { label: string; color: string; bar: string }> = {
  planned: { label: "Planned", color: "#94a3b8", bar: "#94a3b8" },
  progress: { label: "In Progress", color: "#122a20", bar: "#122a20" },
  risk: { label: "At Risk", color: "#f43f5e", bar: "#f43f5e" },
  done: { label: "Done", color: "#cbd5e1", bar: "#cbd5e1" },
};

export const BOARD_COLUMN_ORDER: BoardColumn[] = ["planned", "progress", "risk", "done"];

/** Which kanban column a project belongs in. At-risk wins over its underlying status. */
export function boardColumnFor(status: string, atRisk: boolean): BoardColumn {
  if (status === "completed") return "done";
  if (atRisk) return "risk";
  if (status === "planning") return "planned";
  return "progress";
}

/** The (status, atRisk) write a drag into `column` should perform. */
export function boardStateForColumn(column: BoardColumn): { status?: string; atRisk: boolean } {
  switch (column) {
    case "planned": return { status: "planning", atRisk: false };
    case "progress": return { status: "in_progress", atRisk: false };
    // Staying in_progress is the point - at-risk is a flag, not a stage.
    case "risk": return { status: "in_progress", atRisk: true };
    case "done": return { status: "completed", atRisk: false };
  }
}

// ── Project departments (the design's "category") ────────────────────────────

export const PROJECT_DEPT_META: Record<string, { label: string; chip: string; icon: Icon }> = {
  ops: { label: "Operations", chip: "bg-[rgba(21,25,54,0.07)] text-[#151936]", icon: IconBriefcase },
  finance: { label: "Finance", chip: "bg-emerald-50 text-emerald-700", icon: IconCash },
  sales: { label: "Sales", chip: "bg-amber-50 text-amber-700", icon: IconBriefcase },
  legal: { label: "Legal", chip: "bg-violet-50 text-violet-700", icon: IconGavel },
  hr: { label: "HR", chip: "bg-sky-50 text-sky-700", icon: IconUsers },
  front_office: { label: "Front Office", chip: "bg-slate-100 text-slate-600", icon: IconCalendarEvent },
};

export function deptMeta(department: string) {
  return PROJECT_DEPT_META[department] ?? PROJECT_DEPT_META.ops;
}

// ── Shared helpers ───────────────────────────────────────────────────────────

export type Milestone = { label: string; done: boolean };

export function milestoneProgress(milestones: Milestone[] | null | undefined) {
  const list = milestones ?? [];
  const done = list.filter((m) => m.done).length;
  return { done, total: list.length };
}

/** Real overlap: two events on the same calendar that genuinely collide in time. */
export function hasOverlap(
  event: { id: string; startsAt: string; endsAt: string },
  all: Array<{ id: string; startsAt: string; endsAt: string }>,
): boolean {
  const start = new Date(event.startsAt).getTime();
  const end = new Date(event.endsAt).getTime();
  return all.some((other) => {
    if (other.id === event.id) return false;
    const oStart = new Date(other.startsAt).getTime();
    const oEnd = new Date(other.endsAt).getTime();
    return start < oEnd && oStart < end;
  });
}

export const ROLE_TIER_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "superadmin", label: "Super-admin" },
  { value: "admin", label: "Admin" },
  { value: "manager", label: "Manager" },
  { value: "finance", label: "Finance" },
  { value: "agent", label: "Agent" },
  { value: "viewer", label: "Viewer" },
];

export function greetingFor(date: Date): string {
  const h = date.getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

/** Compact "in 2h 15m" / "in 3d" countdown to the next event. */
export function countdownTo(iso: string, from: Date = new Date()): string {
  const diff = new Date(iso).getTime() - from.getTime();
  if (diff <= 0) return "Now";
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `in ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `in ${hrs}h ${mins % 60}m`;
  return `in ${Math.floor(hrs / 24)}d`;
}
