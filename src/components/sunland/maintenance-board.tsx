"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  IconArrowUpRight,
  IconBan,
  IconBuildingBank,
  IconBuildingCommunity,
  IconCalendarPlus,
  IconChevronLeft,
  IconChevronRight,
  IconCheck,
  IconDroplet,
  IconFileDescription,
  IconFileInvoice,
  IconMoodEmpty,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconShieldCheck,
  IconShieldX,
  IconTool,
} from "@tabler/icons-react";
import { BoardHeader, Button, ConfirmDialog, Drawer, PaginationControls, SkeletonBlock } from "@/components/ui/erp-primitives";
import { Badge } from "@/components/ui/badge";
import { PageTransition } from "@/components/shared/page-transition";
import { useToast } from "@/components/ui/toast-provider";
import { cn } from "@/lib/utils/cn";
import { formatCompactKES } from "@/lib/utils/format";
import { ReportIssueModal } from "./report-issue-modal";
import { PortfolioHubNav } from "./portfolio-hub-nav";
import {
  CATEGORY_META,
  PRIORITY_META,
  STATUS_META,
  SLA_STATE_META,
  slaDisplayStateFor,
  slaStateFor,
  type MaintenanceCategory,
  type MaintenancePriority,
  type MaintenanceStatus,
} from "./maintenance-constants";

// ── Types (mirror the real /api/maintenance-requests response shape) ──────────

interface MaintenanceRequestRow {
  id: string;
  entityId: string;
  propertyId: string;
  propertyName: string;
  propertyCode: string;
  title: string;
  description: string;
  priority: MaintenancePriority;
  status: MaintenanceStatus;
  category: MaintenanceCategory;
  dueAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  reportedByContactId: string | null;
  reportedByName: string | null;
  assignedContractorId: string | null;
  assignedContractorName: string | null;
  estimatedCostKes: string | null;
  actualCostKes: string | null;
}

interface ContractorOption {
  id: string;
  displayName: string;
  phone: string | null;
  email: string | null;
  metadata?: { specialty?: string } | null;
}

interface CalendarEventRow {
  id: string;
  title: string;
  type: string;
  startsAt: string;
  endsAt: string;
  maintenanceRequestId: string | null;
  outcome: string;
}

interface ActivityEntry {
  id: string;
  actorName: string;
  action: string;
  summary: string;
  createdAt: string;
}

interface MaintenanceDetail extends MaintenanceRequestRow {
  propertyLocation: string;
  propertyMedia: Array<{ url: string; alt?: string; isPrimary?: boolean }> | null;
  reportedByPhone: string | null;
  assignedContractorPhone: string | null;
  assignedContractorEmail: string | null;
  contractorSpecialty: string | null;
  maintenanceAuthorityKes: number | null;
  propertyManagerName: string | null;
  pendingApproval: { id: string; requiredApproverRole: string; amountKes: string } | null;
  scheduledVisit: { id: string; startsAt: string; endsAt: string; outcome: string } | null;
  sla: { state: "ok" | "at_risk" | "breached"; hoursElapsed: number; hoursRemaining: number; targetHours: number };
}

// ── Display constants ───────────────────────────────────────────────────────

const FILTERS: Array<{ id: "all" | "urgent" | MaintenanceStatus; label: string }> = [
  { id: "all", label: "All" },
  { id: "urgent", label: "Urgent & Critical" },
  { id: "awaiting_approval", label: "Awaiting Approval" },
  { id: "in_progress", label: "In Progress" },
  { id: "scheduled", label: "Scheduled" },
  { id: "done", label: "Completed" },
];

const PILL = "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-medium";

const DEFAULT_SLA_HOURS: Record<MaintenancePriority, number> = { routine: 72, urgent: 24, critical: 6 };

function fmtKes(v: string | number | null | undefined): string {
  const n = typeof v === "string" ? parseFloat(v) : v;
  if (!n || Number.isNaN(n)) return "—";
  return `KES ${n.toLocaleString()}`;
}
function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" });
}
function fmtDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.toLocaleDateString("en-KE", { day: "numeric", month: "short" })} · ${d.toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" })}`;
}
function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "Just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  return days === 1 ? "Yesterday" : `${days}d ago`;
}
function dayLabel(iso: string): string {
  const d = new Date(new Date(iso).toDateString());
  const today = new Date(new Date().toDateString());
  const diffDays = Math.round((d.getTime() - today.getTime()) / 86_400_000);
  if (diffDays === 0) return "TODAY";
  if (diffDays === 1) return "TOMORROW";
  return d.toLocaleDateString("en-KE", { weekday: "short" }).toUpperCase();
}

function slaLineFor(r: { createdAt: string; resolvedAt: string | null; status: MaintenanceStatus }, targetHours: number): { text: string; color: string } {
  const sla = slaStateFor({ createdAt: r.createdAt, resolvedAt: r.resolvedAt, targetHours });
  const display = slaDisplayStateFor(r.status, sla.state);
  const meta = SLA_STATE_META[display] ?? SLA_STATE_META.ok;
  if (display === "done") {
    const days = Math.max(0, Math.round(sla.hoursElapsed / 24));
    return { text: `Closed in ${days} day${days === 1 ? "" : "s"}`, color: meta.color };
  }
  if (display === "breached") return { text: `SLA ${targetHours}h · breached`, color: meta.color };
  const hoursIn = Math.max(0, sla.hoursElapsed);
  return { text: `SLA ${targetHours}h · ${hoursIn < 1 ? "<1h" : hoursIn.toFixed(1) + "h"} in`, color: meta.color };
}

// Content-shaped loading state for the queue, replacing a centered spinner -
// same "replace the spinner" precedent leases-board.tsx's ListRowsSkeleton established.
function WorkOrderRowsSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-2.5">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3.5 rounded-[18px] border border-slate-100 bg-white p-3.5">
          <SkeletonBlock className="w-1 self-stretch rounded-full shrink-0" />
          <SkeletonBlock className="size-16 rounded-2xl shrink-0" />
          <div className="flex-1 flex flex-col gap-2 min-w-0">
            <SkeletonBlock className="h-3.5 w-1/4" />
            <SkeletonBlock className="h-4 w-1/2" />
          </div>
          <SkeletonBlock className="h-6 w-20 shrink-0 rounded-full" />
        </div>
      ))}
    </div>
  );
}

// ── Board ──────────────────────────────────────────────────────────────────────

export function MaintenanceBoard({ entityId = "group" }: { entityId?: string }) {
  const { pushToast } = useToast();

  const [requests, setRequests] = useState<MaintenanceRequestRow[]>([]);
  const [contractors, setContractors] = useState<ContractorOption[]>([]);
  const [events, setEvents] = useState<CalendarEventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [slaHours, setSlaHours] = useState<Record<MaintenancePriority, number>>(DEFAULT_SLA_HOURS);

  const [filter, setFilter] = useState<"all" | "urgent" | MaintenanceStatus>("all");
  const [query, setQuery] = useState("");
  const [newOpen, setNewOpen] = useState(false);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<MaintenanceDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityQuery, setActivityQuery] = useState("");

  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleStart, setScheduleStart] = useState("");
  const [scheduleEnd, setScheduleEnd] = useState("");
  const [isScheduling, setIsScheduling] = useState(false);
  const [cancelConfirmId, setCancelConfirmId] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);

  const loadRequests = useCallback(async () => {
    Promise.resolve().then(() => setLoading(true));
    try {
      const res = await fetch(`/api/maintenance-requests?entityId=${entityId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load work orders");
      setRequests(data.maintenanceRequests ?? []);
    } catch (err) {
      pushToast({ tone: "warning", title: "Error", body: err instanceof Error ? err.message : "Failed to load work orders" });
    } finally {
      setLoading(false);
    }
  }, [entityId, pushToast]);

  useEffect(() => {
    Promise.resolve().then(() => {
      loadRequests();
      fetch(`/api/contacts?entityId=${entityId}&type=contractor`)
        .then((r) => r.json())
        .then((d) => setContractors(Array.isArray(d.contacts) ? d.contacts : []))
        .catch(() => { });
      fetch(`/api/scheduling/events?entityId=${entityId}&scope=all`)
        .then((r) => r.json())
        .then((d) => setEvents(Array.isArray(d.events) ? d.events : []))
        .catch(() => { });
    });
  }, [loadRequests, entityId]);

  // Real SLA hour targets (settings-backed) rather than hardcoded.
  useEffect(() => {
    if (!entityId) return;
    fetch(`/api/settings?entityId=${entityId}`)
      .then((r) => r.json())
      .then((d) => {
        const rows: Array<{ key: string; value: unknown }> = Array.isArray(d.settings) ? d.settings : [];
        const next = { ...DEFAULT_SLA_HOURS };
        for (const p of ["routine", "urgent", "critical"] as const) {
          const row = rows.find((r) => r.key === `maintenance_sla_hours_${p}`);
          if (row && typeof row.value === "number") next[p] = row.value;
        }
        setSlaHours(next);
      })
      .catch(() => { });
  }, [entityId]);

  // ── Derived analytics (real - never fabricated) ────────────────────────────

  const kpis = useMemo(() => {
    const open = requests.filter((r) => r.status !== "done");
    const urgent = open.filter((r) => r.priority !== "routine");
    const slaStates = requests.map((r) => slaStateFor({ createdAt: r.createdAt, resolvedAt: r.resolvedAt, targetHours: slaHours[r.priority] }).state);
    const slaCompliancePct = slaStates.length > 0 ? Math.round((slaStates.filter((s) => s !== "breached").length / slaStates.length) * 100) : 100;

    const resolved = requests.filter((r) => r.status === "done" && r.resolvedAt);
    const avgResponseHours = resolved.length > 0
      ? resolved.reduce((sum, r) => sum + (new Date(r.resolvedAt!).getTime() - new Date(r.createdAt).getTime()) / 3_600_000, 0) / resolved.length
      : null;

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthRequests = requests.filter((r) => new Date(r.createdAt) >= monthStart);
    const spendTotal = monthRequests.reduce((sum, r) => sum + (r.actualCostKes ? parseFloat(r.actualCostKes) : r.estimatedCostKes ? parseFloat(r.estimatedCostKes) : 0), 0);
    const monthLabel = now.toLocaleDateString("en-KE", { month: "long" });

    const mix = (["reactive", "planned", "compliance"] as const).map((cat) => ({ cat, count: requests.filter((r) => r.category === cat).length }));
    const mixTotal = mix.reduce((a, m) => a + m.count, 0) || 1;

    return { open, urgent, slaCompliancePct, avgResponseHours, spendTotal, monthLabel, mix, mixTotal };
  }, [requests, slaHours]);

  const [nowMs] = useState(() => Date.now());

  const attentionItems = useMemo(() => {
    type Item = { id: string; tone: "rose" | "amber"; icon: typeof IconShieldX; title: string; meta: string; ctaLabel: string };
    const items: Item[] = [];
    const now = nowMs;

    const complianceSoon = requests
      .filter((r) => r.category === "compliance" && r.status !== "done" && r.dueAt)
      .filter((r) => {
        const diff = new Date(r.dueAt!).getTime() - now;
        return diff >= 0 && diff <= 7 * 86_400_000;
      })
      .sort((a, b) => new Date(a.dueAt!).getTime() - new Date(b.dueAt!).getTime())[0];
    if (complianceSoon) {
      const days = Math.max(0, Math.round((new Date(complianceSoon.dueAt!).getTime() - now) / 86_400_000));
      items.push({
        id: complianceSoon.id, tone: "rose", icon: IconShieldX,
        title: `${complianceSoon.title} — due in ${days} day${days === 1 ? "" : "s"}`,
        meta: `${complianceSoon.propertyName} · ${fmtKes(complianceSoon.estimatedCostKes)} awaiting decision`,
        ctaLabel: "Review",
      });
    }

    const criticalActive = requests.find((r) => r.priority === "critical" && (r.status === "in_progress" || r.status === "scheduled"));
    if (criticalActive) {
      items.push({
        id: criticalActive.id, tone: "rose", icon: IconDroplet,
        title: `Urgent: ${criticalActive.title}`,
        meta: `${criticalActive.propertyName} · ${(STATUS_META[criticalActive.status] ?? STATUS_META.reported).label}`,
        ctaLabel: "Track",
      });
    }

    const awaitingApproval = requests
      .filter((r) => r.status === "awaiting_approval")
      .sort((a, b) => parseFloat(b.estimatedCostKes || "0") - parseFloat(a.estimatedCostKes || "0"))[0];
    if (awaitingApproval) {
      items.push({
        id: awaitingApproval.id,
        tone: "amber",
        icon: IconFileInvoice,
        title: `${awaitingApproval.title} awaiting approval`,
        meta: `${awaitingApproval.propertyName} · ${fmtKes(awaitingApproval.estimatedCostKes)}`,
        ctaLabel: "Review",
      });
    }

    const unique = items.filter((item, index, self) => index === self.findIndex((t) => t.id === item.id));
    return unique.slice(0, 3);
  }, [requests, nowMs]);

  const filterCounts = useMemo(() => ({
    all: requests.length,
    urgent: requests.filter((r) => r.priority !== "routine").length,
    awaiting_approval: requests.filter((r) => r.status === "awaiting_approval").length,
    in_progress: requests.filter((r) => r.status === "in_progress").length,
    scheduled: requests.filter((r) => r.status === "scheduled").length,
    done: requests.filter((r) => r.status === "done").length,
  }), [requests]);

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return requests
      .filter((r) => filter === "all" ? true : filter === "urgent" ? r.priority !== "routine" : r.status === filter)
      .filter((r) => !q || [r.title, r.propertyName, r.propertyCode, r.assignedContractorName].some((s) => s?.toLowerCase().includes(q)))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [requests, filter, query]);

  const totalPages = useMemo(() => Math.ceil(visible.length / pageSize) || 1, [visible.length, pageSize]);

  const pagedVisible = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return visible.slice(start, start + pageSize);
  }, [visible, currentPage, pageSize]);

  const crew = useMemo(() => {
    return contractors
      .map((c) => {
        const activeCount = requests.filter((r) => r.assignedContractorId === c.id && (r.status === "scheduled" || r.status === "in_progress")).length;
        const quoting = requests.some((r) => r.assignedContractorId === c.id && r.status === "awaiting_approval");
        const load = activeCount > 0 ? `${activeCount} active` : quoting ? "Quoting" : "Available";
        const tone: "amber" | "slate" | "emerald" = activeCount > 0 ? "amber" : quoting ? "slate" : "emerald";
        return { ...c, load, tone, activeCount };
      })
      .sort((a, b) => b.activeCount - a.activeCount)
      .slice(0, 6);
  }, [contractors, requests]);

  const scheduledVisits = useMemo(() => {
    const now = nowMs;
    return events
      .filter((e) => e.type === "maintenance" && e.maintenanceRequestId && new Date(e.startsAt).getTime() >= now)
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
      .slice(0, 4)
      .map((e) => {
        const linked = requests.find((r) => r.id === e.maintenanceRequestId);
        return {
          id: e.id,
          day: dayLabel(e.startsAt),
          time: new Date(e.startsAt).toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" }),
          what: linked ? `${linked.title} — ${linked.propertyName}` : e.title,
          dotClass: linked ? (PRIORITY_META[linked.priority] ?? PRIORITY_META.routine).rail : "bg-slate-300",
          onOpen: () => linked && openDrawer(linked.id),
        };
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, requests]);

  const spendByProperty = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const byId = new Map<string, { name: string; amt: number }>();
    for (const r of requests) {
      if (new Date(r.createdAt) < monthStart) continue;
      const cost = r.actualCostKes ? parseFloat(r.actualCostKes) : r.estimatedCostKes ? parseFloat(r.estimatedCostKes) : 0;
      if (cost <= 0) continue;
      const prev = byId.get(r.propertyId) ?? { name: r.propertyName, amt: 0 };
      prev.amt += cost;
      byId.set(r.propertyId, prev);
    }
    const rows = Array.from(byId.values()).sort((a, b) => b.amt - a.amt).slice(0, 5);
    const max = rows[0]?.amt ?? 1;
    return rows.map((r) => ({ ...r, pct: (r.amt / max) * 100 }));
  }, [requests]);

  // ── Drawer / detail ──────────────────────────────────────────────────────

  const openDrawer = useCallback((id: string) => {
    setSelectedId(id);
    setDetail(null);
    setDetailLoading(true);
    setScheduleOpen(false);
    fetch(`/api/maintenance-requests/${id}?entityId=${entityId}`)
      .then((r) => r.json())
      .then((d) => setDetail(d.maintenanceRequest ?? null))
      .catch(() => setDetail(null))
      .finally(() => setDetailLoading(false));

    setActivity([]);
    setActivityQuery("");
    setActivityLoading(true);
    fetch(`/api/audit?entityId=${entityId}&associatedType=maintenance_request&associatedId=${id}&limit=20`)
      .then((r) => r.json())
      .then((d) => setActivity(Array.isArray(d.entries) ? d.entries : []))
      .catch(() => setActivity([]))
      .finally(() => setActivityLoading(false));
  }, [entityId]);

  const closeDrawer = () => { setSelectedId(null); setDetail(null); setScheduleOpen(false); };

  const moveStatus = async (id: string, status: MaintenanceStatus) => {
    try {
      const res = await fetch(`/api/maintenance-requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update status");
      pushToast({ tone: "success", title: "Updated", body: `Moved to ${STATUS_META[status].label}.` });
      loadRequests();
      if (selectedId === id) openDrawer(id);
    } catch (err) {
      pushToast({ tone: "warning", title: "Error", body: err instanceof Error ? err.message : "Failed to update status" });
    }
  };

  const handleStepperClick = (id: string, current: MaintenanceStatus, target: MaintenanceStatus) => {
    if (target === current) return;
    if (target === "scheduled") { if (current === "reported") setScheduleOpen(true); return; }
    if (target === "in_progress" && (current === "reported" || current === "scheduled")) { moveStatus(id, "in_progress"); return; }
    if (target === "done" && current !== "done") { moveStatus(id, "done"); return; }
  };

  const submitSchedule = async () => {
    if (!selectedId || !scheduleStart || !scheduleEnd) return;
    setIsScheduling(true);
    try {
      const res = await fetch(`/api/maintenance-requests/${selectedId}/schedule-visit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityId, startsAt: new Date(scheduleStart).toISOString(), endsAt: new Date(scheduleEnd).toISOString() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to schedule visit");
      pushToast({ tone: "success", title: "Scheduler event created", body: "Visit booked — crew notified." });
      setScheduleOpen(false);
      setScheduleStart("");
      setScheduleEnd("");
      loadRequests();
      openDrawer(selectedId);
      fetch(`/api/scheduling/events?entityId=${entityId}&scope=all`).then((r) => r.json()).then((d) => setEvents(Array.isArray(d.events) ? d.events : [])).catch(() => { });
    } catch (err) {
      pushToast({ tone: "warning", title: "Error", body: err instanceof Error ? err.message : "Failed to schedule visit" });
    } finally {
      setIsScheduling(false);
    }
  };

  const handleCancel = async () => {
    if (!cancelConfirmId) return;
    setIsCancelling(true);
    try {
      const res = await fetch(`/api/maintenance-requests/${cancelConfirmId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to cancel work order");
      pushToast({ tone: "success", title: "Work order cancelled", body: "Removed from the queue." });
      loadRequests();
      if (selectedId === cancelConfirmId) closeDrawer();
    } catch (err) {
      pushToast({ tone: "warning", title: "Error", body: err instanceof Error ? err.message : "Failed to cancel work order" });
    } finally {
      setIsCancelling(false);
      setCancelConfirmId(null);
    }
  };

  const handleComplete = async () => {
    if (!selectedId) return;
    setIsCompleting(true);
    await moveStatus(selectedId, "done");
    setIsCompleting(false);
  };

  const filteredActivity = useMemo(() => {
    const q = activityQuery.trim().toLowerCase();
    if (!q) return activity;
    return activity.filter((a) => a.summary.toLowerCase().includes(q) || a.actorName?.toLowerCase().includes(q));
  }, [activity, activityQuery]);

  const activityTone = (summary: string) => {
    const lower = summary.toLowerCase();
    if (lower.includes("delet") || lower.includes("cancel")) return "bg-rose-300 ring-rose-50";
    if (lower.includes("approv") || lower.includes("complet")) return "bg-emerald-300 ring-emerald-50";
    if (lower.includes("updat") || lower.includes("mov") || lower.includes("schedul")) return "bg-indigo-300 ring-indigo-50";
    return "bg-slate-200 ring-white";
  };

  // ── Render ───────────────────────────────────────────────────────────────

  const drawerRequest = requests.find((r) => r.id === selectedId);
  const slaTarget = detail ? slaHours[detail.priority] : 72;

  return (
    <PageTransition className="mx-auto flex max-w-[98rem] flex-col gap-5">
      <BoardHeader
        eyebrow={<Badge tone="primary">Estate Portfolio</Badge>}
        title="Maintenance & Works"
        description="Every work order across the managed stock — tenant-reported repairs, planned preventive works and capital projects. Costs post to the mandate ledger and net against the landlord's remittance; visits sync to the Scheduler."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={loadRequests}>
              <IconRefresh size={14} /> Refresh
            </Button>
            <Button size="sm" onClick={() => setNewOpen(true)}>
              <IconPlus size={14} /> New Work Order
            </Button>
          </div>
        }
      />
      <PortfolioHubNav active="maintenance" />

      <div className="flex items-center gap-4 mt-2">
        <hr className="flex-1 border-slate-200/60" />
        <span className="label-caps text-slate-600 tracking-wider">Works Signals</span>
        <hr className="flex-1 border-slate-200/60" />
      </div>

      {/* ── Executive 4-Card Dark KPI Tier ── */}
      <div className="gsap-stagger bg-tertiary-gradient text-white rounded-[28px] shadow-2xl relative overflow-hidden group mb-6 border border-slate-800/80">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-white/10 relative z-10">

          {/* Card 1: Active Work Orders */}
          <div className="py-6 px-6 lg:py-7 lg:px-7 flex flex-col justify-between relative overflow-hidden group/card">
            <div className="absolute -bottom-10 -right-10 opacity-5 text-amber-400 pointer-events-none transition-transform duration-700 group-hover/card:scale-110">
              <IconTool size={140} stroke={1} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-medium text-slate-300 uppercase tracking-wider">Active Work Orders</span>
              <Badge tone={kpis.urgent.length > 0 ? "risk" : "success"}>
                {kpis.urgent.length > 0 ? `${kpis.urgent.length} URGENT / CRITICAL` : "QUEUE CLEAR"}
              </Badge>
            </div>
            <div className="relative z-10 mt-4">
              <span className="font-mono text-3xl font-medium text-white">{kpis.open.length} <span className="text-xs font-mono text-slate-400 font-normal">Orders</span></span>
              <p className="text-xs text-slate-400 font-mono mt-2 flex items-center gap-2">
                <span className="inline-flex items-center gap-1 text-amber-300">
                  <span className="size-1.5 rounded-full bg-amber-400" />
                  {kpis.open.filter((r) => r.status === "in_progress").length} in progress
                </span>
                <span>·</span>
                <span className="inline-flex items-center gap-1 text-slate-300">
                  {kpis.open.filter((r) => r.status === "awaiting_approval").length} pending sign-off
                </span>
              </p>
            </div>
          </div>

          {/* Card 2: SLA Response & Compliance Rate */}
          <div className="py-6 px-6 lg:py-7 lg:px-7 flex flex-col justify-between relative overflow-hidden group/card">
            <div className="absolute -bottom-10 -right-10 opacity-5 text-emerald-400 pointer-events-none transition-transform duration-700 group-hover/card:scale-110">
              <IconShieldCheck size={140} stroke={1} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-medium text-slate-300 uppercase tracking-wider">SLA Compliance Rate</span>
              <Badge tone={kpis.slaCompliancePct >= 90 ? "success" : kpis.slaCompliancePct >= 75 ? "warning" : "risk"}>
                {kpis.slaCompliancePct >= 90 ? "OPTIMAL" : kpis.slaCompliancePct >= 75 ? "AT RISK" : "CRITICAL"}
              </Badge>
            </div>
            <div className="relative z-10 mt-4">
              <span className="font-mono text-3xl font-medium text-emerald-400">{kpis.slaCompliancePct}%</span>
              <div className="mt-3 flex h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                <div className="h-full bg-emerald-400 transition-all duration-500" style={{ width: `${kpis.slaCompliancePct}%` }} />
              </div>
              <p className="text-xxs text-slate-300 font-mono mt-2">
                {kpis.avgResponseHours != null ? `Avg resolution: ${kpis.avgResponseHours < 1 ? "<1h" : kpis.avgResponseHours.toFixed(1) + "h"}` : "No resolved orders yet"}
              </p>
            </div>
          </div>

          {/* Card 3: Monthly Maintenance Spend */}
          <div className="py-6 px-6 lg:py-7 lg:px-7 flex flex-col justify-between relative overflow-hidden group/card">
            <div className="absolute -bottom-10 -right-10 opacity-5 text-indigo-400 pointer-events-none transition-transform duration-700 group-hover/card:scale-110">
              <IconBuildingBank size={140} stroke={1} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-medium text-slate-300 uppercase tracking-wider">{kpis.monthLabel} Spend</span>
              <Badge tone="neutral">FINANCIAL MTD</Badge>
            </div>
            <div className="relative z-10 mt-4">
              <span className="font-mono text-3xl font-medium text-white">{formatCompactKES(kpis.spendTotal)}</span>
              <p className="text-xxs text-slate-300 font-mono mt-2">
                Nets directly against monthly landlord remittances
              </p>
            </div>
          </div>

          {/* Card 4: Works Category Mix */}
          <div className="py-6 px-6 lg:py-7 lg:px-7 flex flex-col justify-between relative overflow-hidden group/card">
            <div className="absolute -bottom-10 -right-10 opacity-5 text-rose-400 pointer-events-none transition-transform duration-700 group-hover/card:scale-110">
              <IconTool size={140} stroke={1} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-medium text-slate-300 uppercase tracking-wider">Works Category Mix</span>
              <Badge tone="primary">CATEGORIES</Badge>
            </div>
            <div className="relative z-10 mt-4 flex flex-col gap-2.5">
              <div className="flex h-2 rounded-full overflow-hidden gap-0.5 bg-white/10">
                {kpis.mix.filter((m) => m.count > 0).map((m) => (
                  <div
                    key={m.cat}
                    style={{
                      background: m.cat === "reactive" ? "#f59e0b" : m.cat === "planned" ? "#10b981" : "#f43f5e",
                      width: `${(m.count / kpis.mixTotal) * 100}%`,
                    }}
                  />
                ))}
              </div>
              <div className="flex items-center justify-between text-xs font-mono text-slate-300">
                {kpis.mix.map((m) => (
                  <span key={m.cat} className="flex items-center gap-1">
                    <span
                      className="size-2 rounded-full"
                      style={{ background: m.cat === "reactive" ? "#f59e0b" : m.cat === "planned" ? "#10b981" : "#f43f5e" }}
                    />
                    {CATEGORY_META[m.cat].label}: <span className="font-medium text-white">{m.count}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* ── Needs Attention Executive Banners (2-Column Grid) ── */}
      {attentionItems.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 mt-1">
          {attentionItems.map((item, idx) => (
            <div
              key={`${item.id}-${idx}`}
              className={cn(
                "rounded-[22px] p-4 flex items-center justify-between gap-3.5 shadow-2xs hover:shadow-xs transition-all duration-300 border group",
                item.tone === "rose"
                  ? "bg-gradient-to-r from-rose-50/90 via-white to-rose-50/20 border-rose-200/90 hover:border-rose-300"
                  : "bg-gradient-to-r from-amber-50/90 via-white to-amber-50/20 border-amber-200/90 hover:border-amber-300"
              )}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={cn(
                    "size-10 rounded-xl flex items-center justify-center shrink-0 border shadow-2xs",
                    item.tone === "rose"
                      ? "bg-rose-100/80 text-rose-700 border-rose-200/60"
                      : "bg-amber-100/80 text-amber-700 border-amber-200/60"
                  )}
                >
                  <item.icon size={18} />
                </div>
                <div className="min-w-0 flex flex-col justify-center">
                  <div className="flex items-center gap-2 min-w-0">
                    <p className="text-xs font-medium text-slate-900 leading-snug truncate">{item.title}</p>
                    <Badge tone={item.tone === "rose" ? "risk" : "warning"} className="shrink-0 text-[10px]">
                      ACTION REQUIRED
                    </Badge>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 font-mono truncate">{item.meta}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => openDrawer(item.id)}
                className="bg-white hover:bg-slate-50 text-slate-900 border border-slate-200/90 rounded-xl px-3.5 py-1.5 text-xs font-medium transition-all shadow-2xs hover:shadow-xs shrink-0 flex items-center gap-1.5 cursor-pointer"
              >
                {item.ctaLabel} <IconArrowUpRight size={13} className="text-slate-400 group-hover:text-slate-900 transition-colors" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Work Order Queue Section Header ── */}
      <div className="flex items-center justify-between gap-4 mt-6 mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-medium text-slate-900">Work Order Queue</h3>
          <Badge tone="data">{requests.length} RECORDS</Badge>
        </div>
        <button
          type="button"
          onClick={() => setNewOpen(true)}
          className="bg-[#151936] text-white hover:bg-[#1f254e] font-medium text-xs rounded-xl px-3.5 py-2 shadow-2xs transition-all flex items-center gap-1.5 shrink-0"
        >
          <IconPlus size={14} /> New Work Order
        </button>
      </div>

      {/* ── Queue + Rail Layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-5 items-start">
        <div className="min-w-0 flex flex-col gap-4">
          {/* Filters & Search Toolbar */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-3 shadow-[0_2px_15px_rgb(0,0,0,0.02)] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
              {FILTERS.map((f) => {
                const count = filterCounts[f.id as keyof typeof filterCounts];
                const isActive = filter === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => { setFilter(f.id); setCurrentPage(1); }}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-all shrink-0",
                      isActive
                        ? "bg-[#151936] text-white shadow-2xs"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                    )}
                  >
                    {f.label}
                    <span className={cn("font-mono text-[10.5px] px-1.5 py-0.5 rounded-md", isActive ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500")}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="relative flex items-center shrink-0 min-w-[220px]">
              <IconSearch size={15} className="absolute left-3 text-slate-600 pointer-events-none" />
              <input
                value={query}
                onChange={(e) => { setQuery(e.target.value); setCurrentPage(1); }}
                placeholder="Search work orders..."
                className="w-full h-9 rounded-xl border border-slate-200 bg-slate-50/50 pl-9 pr-3 text-xs font-medium text-slate-900 outline-none placeholder:text-slate-600 focus:bg-white focus:border-[#151936]/40 transition-all shadow-2xs"
              />
            </div>
          </div>

          {/* Work Orders List */}
          {loading ? (
            <WorkOrderRowsSkeleton />
          ) : requests.length === 0 ? (
            <div className="bg-white border border-slate-200/80 rounded-[24px] p-12 text-center flex flex-col items-center gap-3 shadow-[0_2px_15px_rgb(0,0,0,0.02)]">
              <div className="size-14 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400">
                <IconTool size={26} />
              </div>
              <h3 className="text-sm font-medium text-slate-900">No work orders yet</h3>
              <p className="text-xs text-slate-600 max-w-sm font-medium">Reported issues and planned maintenance tasks will appear here in real time.</p>
              <Button size="sm" onClick={() => setNewOpen(true)} className="mt-1 rounded-xl">
                <IconPlus size={14} /> New Work Order
              </Button>
            </div>
          ) : visible.length === 0 ? (
            <div className="bg-white border border-slate-200/80 rounded-2xl p-10 text-center text-xs font-mono text-slate-600">
              No work orders match this filter or search query.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {pagedVisible.map((r) => {
                const sla = slaLineFor(r, slaHours[r.priority]);
                const isUrgentOrCritical = r.priority !== "routine";
                const isDone = r.status === "done";
                const isInProgress = r.status === "in_progress";
                const isAwaiting = r.status === "awaiting_approval";

                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => openDrawer(r.id)}
                    className="flex items-center gap-3.5 w-full text-left bg-white border border-slate-200/80 rounded-2xl p-4 shadow-[0_2px_15px_rgb(0,0,0,0.02)] hover:shadow-[0_8px_25px_rgb(0,0,0,0.06)] hover:border-slate-300 transition-all duration-300 group cursor-pointer"
                  >
                    <span className={cn("w-1 self-stretch rounded-full shrink-0", (PRIORITY_META[r.priority] ?? PRIORITY_META.routine).rail)} />
                    <div className="size-12 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-center text-slate-600 shrink-0 shadow-2xs">
                      <IconTool size={20} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs text-slate-600 font-medium">{r.propertyCode}</span>
                        <Badge tone="neutral">{(CATEGORY_META[r.category] ?? CATEGORY_META.reactive).label}</Badge>
                        <Badge tone={isUrgentOrCritical ? "risk" : "neutral"}>
                          {(PRIORITY_META[r.priority] ?? PRIORITY_META.routine).label}
                        </Badge>
                      </div>
                      <p className="text-xs font-medium text-slate-900 mt-1 truncate leading-snug group-hover:text-amber-800 transition-colors">
                        {r.title}
                      </p>
                      <p className="text-xs text-slate-600 mt-0.5 truncate font-medium">
                        {r.propertyName} · {r.assignedContractorName ?? "Unassigned Vendor"}
                      </p>
                    </div>
                    <div className="shrink-0 flex flex-col items-end gap-1">
                      <Badge tone={isDone ? "success" : isInProgress ? "primary" : isAwaiting ? "warning" : "neutral"}>
                        {(STATUS_META[r.status] ?? STATUS_META.reported).label}
                      </Badge>
                      <span className="font-mono text-xs font-medium text-[#151936] mt-0.5">{fmtKes(r.actualCostKes ?? r.estimatedCostKes)}</span>
                      <span className="text-xs font-mono font-medium" style={{ color: sla.color }}>{sla.text}</span>
                    </div>
                  </button>
                );
              })}

              {/* Executive Mobile-Responsive Shared Pagination ERP Primitive */}
              <PaginationControls
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={visible.length}
                pageSize={pageSize}
                itemLabel="work orders"
                onPageChange={setCurrentPage}
              />
            </div>
          )}
        </div>

        {/* ── Side Rail Cards ── */}
        <div className="flex flex-col gap-4 lg:sticky lg:top-4">
          {/* Card 1: Crew & Vendors */}
          <div className=" flex flex-col gap-3.5">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-medium text-slate-900 uppercase tracking-wider font-mono">Crew & Vendors</h4>
              <Badge tone="neutral">{contractors.length} ON FILE</Badge>
            </div>
            {crew.length === 0 ? (
              <p className="text-xs text-slate-600 font-mono">No contractors on file yet.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {crew.map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-3 bg-slate-50/70 hover:bg-slate-100/70 border border-slate-200/60 rounded-2xl p-3 transition-colors">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="size-8 rounded-xl bg-white border border-slate-200/80 flex items-center justify-center text-slate-600 shrink-0 shadow-2xs">
                        <IconTool size={14} />
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-slate-900 truncate">{c.displayName}</p>
                        <p className="text-xs text-slate-600 font-mono truncate">{c.metadata?.specialty ?? "General Repairs"}</p>
                      </div>
                    </div>
                    <Badge tone={c.tone === "emerald" ? "success" : c.tone === "amber" ? "warning" : "neutral"}>
                      {c.load}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Card 2: Scheduled Visits */}
          <div className="bg-white border border-slate-200/80 rounded-[24px] shadow-[0_2px_15px_rgb(0,0,0,0.02)] p-5 flex flex-col gap-3.5">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-medium text-slate-900 uppercase tracking-wider font-mono">Scheduled Visits</h4>
              <Link href="/admin/events" className="text-xs font-medium text-[#151936] hover:underline flex items-center gap-1 font-mono">
                Scheduler <IconArrowUpRight size={13} />
              </Link>
            </div>
            {scheduledVisits.length === 0 ? (
              <p className="text-xs text-slate-600 font-mono">No site visits scheduled yet.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {scheduledVisits.map((v) => (
                  <button key={v.id} type="button" onClick={v.onOpen} className="flex items-center gap-2.5 bg-slate-50/70 border border-slate-200/60 rounded-2xl p-3 text-left w-full hover:bg-slate-100/70 transition-colors">
                    <div className="shrink-0 text-center bg-tertiary-gradient border border-slate-200/80 rounded-xl px-2 py-1 shadow-2xs">
                      <span className="block font-mono text-xxs text-slate-300 font-medium">{v.day}</span>
                      <span className="block font-mono text-xl text-slate-200">{v.time}</span>
                    </div>
                    <span className={cn("size-2 rounded-full shrink-0", v.dotClass)} />
                    <span className="text-xs font-medium text-slate-800 truncate flex-1 min-w-0">{v.what}</span>
                  </button>
                ))}
              </div>
            )}
            <p className="text-xs text-slate-600 font-mono leading-relaxed mt-1">
              Scheduling a visit auto-syncs with the Scheduler. Closing work orders marks visits complete.
            </p>
          </div>

          {/* Card 3: Spend by Property */}
          <div className="bg-white border border-slate-200/80 rounded-[24px] shadow-[0_2px_15px_rgb(0,0,0,0.02)] p-5 flex flex-col gap-3.5">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-medium text-slate-900 uppercase tracking-wider font-mono">{kpis.monthLabel} Spend</h4>
              <Badge tone="neutral">REMITTANCE NET</Badge>
            </div>
            {spendByProperty.length === 0 ? (
              <p className="text-xs text-slate-600 font-mono">No spend recorded this month.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {spendByProperty.map((sp) => (
                  <div key={sp.name} className="flex flex-col gap-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-medium text-slate-800 truncate">{sp.name}</span>
                      <span className="font-mono text-xs font-medium text-[#151936] shrink-0">{fmtKes(sp.amt)}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full rounded-full bg-[#151936]" style={{ width: `${sp.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-slate-600 font-mono leading-relaxed mt-1">
              Approved costs post to mandate ledgers and net against landlord remittances.
            </p>
          </div>
        </div>
      </div>

      <ReportIssueModal open={newOpen} entityId={entityId} title="New Work Order" onClose={() => setNewOpen(false)} onCreated={loadRequests} />

      <ConfirmDialog
        open={!!cancelConfirmId}
        onClose={() => setCancelConfirmId(null)}
        onConfirm={handleCancel}
        title="Cancel Work Order"
        description="This removes the work order from the queue. Any linked Scheduler visit will be marked cancelled. This action cannot be undone."
        confirmLabel="Cancel Order"
        tone="danger"
        isLoading={isCancelling}
      />

      {/* ── Work Order drawer ── */}
      <Drawer open={!!selectedId} onClose={closeDrawer} title={drawerRequest?.title ?? "Work Order Detail"} width="36rem">
        {detailLoading || !detail ? (
          <div className="flex flex-col gap-4">
            <SkeletonBlock className="h-40 w-[calc(100%+2.5rem)] rounded-none -mt-5 -mx-5" />
            <div className="px-5 flex flex-col gap-4">
              <SkeletonBlock className="h-4 w-1/2" />
              <SkeletonBlock className="h-28 w-full rounded-2xl" />
              <SkeletonBlock className="h-32 w-full rounded-2xl" />
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-5 -mt-5 -mx-5 pb-4">
            {/* Hero Header Banner */}
            <div className="relative h-40 overflow-hidden shrink-0">
              {detail.propertyMedia?.[0]?.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={detail.propertyMedia[0].url} alt={detail.title} className="absolute inset-0 size-full object-cover" />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-[#122a20] via-[#151936] to-[#1e1b4b]" />
              )}
              <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/50 to-[#0a0d1c]/90" />
              <div className="relative h-full flex flex-col justify-end p-5">
                <div className="flex items-center gap-2 mb-auto pt-1">
                  <span className="font-mono text-xs text-white/80 font-medium px-2.5 py-1 rounded-md bg-white/15 backdrop-blur-md border border-white/20">
                    {detail.propertyCode}
                  </span>
                  <Badge tone={detail.priority === "critical" ? "risk" : detail.priority === "urgent" ? "warning" : "neutral"}>
                    {(PRIORITY_META[detail.priority] ?? PRIORITY_META.routine).label}
                  </Badge>
                  <Badge tone={detail.status === "done" ? "success" : detail.status === "in_progress" ? "primary" : detail.status === "awaiting_approval" ? "warning" : "neutral"}>
                    {(STATUS_META[detail.status] ?? STATUS_META.reported).label}
                  </Badge>
                </div>
                <p className="font-mono text-xs text-amber-300 font-medium">
                  {(CATEGORY_META[detail.category] ?? CATEGORY_META.reactive).label} Works
                </p>
                <h3 className="text-lg font-medium text-white mt-0.5 leading-snug truncate">{detail.title}</h3>
              </div>
            </div>

            <div className="flex flex-col gap-5 px-5">
              {/* Fact cells Grid */}
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { label: "Property / Unit", value: `${detail.propertyName} · ${detail.propertyLocation}` },
                  { label: "Assigned Vendor", value: detail.assignedContractorName ?? "Unassigned" },
                  { label: "Reported By", value: detail.reportedByName ?? "—" },
                  { label: "Opened Date", value: fmtDate(detail.createdAt) },
                  { label: "Scheduled Visit", value: detail.scheduledVisit ? fmtDateTime(detail.scheduledVisit.startsAt) : "Not scheduled" },
                  { label: "SLA Status", value: slaLineFor(detail, slaTarget).text },
                ].map((kv) => (
                  <div key={kv.label} className="bg-slate-50/80 border border-slate-200/70 rounded-2xl p-3 min-w-0 shadow-2xs">
                    <p className="text-[10px] font-mono font-medium text-slate-500 uppercase tracking-wider mb-1">{kv.label}</p>
                    <p className="text-xs font-medium text-slate-900 truncate">{kv.value}</p>
                  </div>
                ))}
              </div>

              {/* Cost & Approval Card */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-medium text-slate-900 uppercase tracking-wider font-mono">Cost & Financial Approval</h4>
                  <Badge tone="neutral">FINANCIAL LEDGER</Badge>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-slate-50/70 border border-slate-200/60 rounded-xl p-3">
                    <span className="text-slate-500 font-mono block text-[10.5px] mb-0.5">Estimated Cost</span>
                    <span className="font-mono text-sm font-medium text-[#151936]">{fmtKes(detail.estimatedCostKes)}</span>
                  </div>

                  <div className="bg-slate-50/70 border border-slate-200/60 rounded-xl p-3">
                    <span className="text-slate-500 font-mono block text-[10.5px] mb-0.5">Approval Status</span>
                    <span className="font-medium text-slate-900 truncate block">
                      {detail.pendingApproval
                        ? `Pending ${detail.pendingApproval.requiredApproverRole.toUpperCase()}`
                        : detail.actualCostKes
                          ? "Approved & Auto-Logged"
                          : "PM Self-Approval"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-slate-500 font-mono">Ledger Posting:</span>
                  <Link href="/admin/leases?mode=mandates" className="font-medium text-[#151936] hover:underline inline-flex items-center gap-1 font-mono">
                    Mandate ledger <IconArrowUpRight size={12} />
                  </Link>
                </div>

                <div className="bg-gradient-to-r from-slate-50 to-white border border-slate-200/70 rounded-xl p-3 text-xs text-slate-700 font-mono leading-relaxed shadow-2xs">
                  {(() => {
                    const cost = detail.actualCostKes ?? detail.estimatedCostKes;
                    const costNum = cost ? parseFloat(cost) : 0;
                    const ceiling = detail.maintenanceAuthorityKes ?? 25000;
                    if (costNum <= ceiling) return `Within PM KES ${ceiling.toLocaleString()} self-approval ceiling — auto-approved and posted.`;
                    if (detail.pendingApproval?.requiredApproverRole === "ceo") return "Above CEO threshold: queued for dual CEO sign-off approval.";
                    return `Above PM authority ceiling: requires GM sign-off prior to mobilization.`;
                  })()}
                </div>
              </div>

              {/* Linked Records */}
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-slate-900 uppercase tracking-wider font-mono">Linked Operations Records</h4>
                <div className="flex flex-col gap-2">
                  <Link href={`/admin/properties/${detail.propertyId}`} className="flex items-center justify-between bg-slate-50/80 hover:bg-slate-100/80 border border-slate-200/80 rounded-2xl p-3 transition-all shadow-2xs group">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="size-9 rounded-xl bg-white border border-slate-200/80 flex items-center justify-center text-slate-700 shrink-0 shadow-2xs">
                        <IconBuildingCommunity size={16} />
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-slate-900 group-hover:text-amber-800 transition-colors truncate">Property File</p>
                        <p className="text-xs text-slate-500 font-mono truncate">{detail.propertyName}</p>
                      </div>
                    </div>
                    <IconArrowUpRight size={14} className="text-slate-400 group-hover:text-slate-900 transition-colors shrink-0" />
                  </Link>

                  {detail.maintenanceAuthorityKes != null && (
                    <Link href="/admin/leases?mode=mandates" className="flex items-center justify-between bg-slate-50/80 hover:bg-slate-100/80 border border-slate-200/80 rounded-2xl p-3 transition-all shadow-2xs group">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="size-9 rounded-xl bg-white border border-slate-200/80 flex items-center justify-center text-slate-700 shrink-0 shadow-2xs">
                          <IconFileDescription size={16} />
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-slate-900 group-hover:text-amber-800 transition-colors truncate">Mandate & Remittance File</p>
                          <p className="text-xs text-slate-500 font-mono truncate">Net expenses deducted on advice generation</p>
                        </div>
                      </div>
                      <IconArrowUpRight size={14} className="text-slate-400 group-hover:text-slate-900 transition-colors shrink-0" />
                    </Link>
                  )}

                  {detail.scheduledVisit && (
                    <Link href="/admin/events" className="flex items-center justify-between bg-slate-50/80 hover:bg-slate-100/80 border border-slate-200/80 rounded-2xl p-3 transition-all shadow-2xs group">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="size-9 rounded-xl bg-white border border-slate-200/80 flex items-center justify-center text-slate-700 shrink-0 shadow-2xs">
                          <IconTool size={16} />
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-slate-900 group-hover:text-amber-800 transition-colors truncate">Scheduler Visit Event</p>
                          <p className="text-xs text-slate-500 font-mono truncate">{fmtDateTime(detail.scheduledVisit.startsAt)}</p>
                        </div>
                      </div>
                      <IconArrowUpRight size={14} className="text-slate-400 group-hover:text-slate-900 transition-colors shrink-0" />
                    </Link>
                  )}
                </div>
              </div>

              {/* Timeline (activity log) */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-medium text-slate-900 uppercase tracking-wider font-mono">Audit Timeline & Activity Log</h4>
                  <Badge tone="neutral" className="font-mono">{filteredActivity.length} EVENTS</Badge>
                </div>

                <div className="relative">
                  <input
                    value={activityQuery}
                    onChange={(e) => setActivityQuery(e.target.value)}
                    placeholder="Search activity log..."
                    className="w-full h-9 bg-slate-50/60 border border-slate-200/80 text-xs rounded-xl pl-9 pr-3 font-medium text-slate-900 outline-none placeholder:text-slate-400 focus:bg-white focus:border-[#151936]/40 transition-all shadow-2xs"
                  />
                  <IconSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>

                {activityLoading ? (
                  <div className="flex justify-center py-6"><SkeletonBlock className="h-4 w-1/2" /></div>
                ) : filteredActivity.length === 0 ? (
                  <div className="flex flex-col items-center py-8 text-center gap-2 bg-slate-50/50 border border-slate-200/60 rounded-2xl">
                    <IconMoodEmpty size={22} className="text-slate-400" />
                    <p className="text-xs text-slate-500 font-mono font-medium">No activity log entries found.</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2.5 relative ml-1">
                    <div className="absolute left-[3px] top-1.5 bottom-4 w-px bg-slate-200 z-0" />
                    {filteredActivity.map((entry) => (
                      <div key={entry.id} className="relative flex items-start gap-3 z-10">
                        <span className={cn("size-2 rounded-full mt-1.5 shrink-0 ring-4 ring-white", activityTone(entry.summary))} />
                        <div className="flex-1 min-w-0 flex items-center justify-between gap-2 bg-slate-50/70 border border-slate-200/60 rounded-xl px-3 py-2">
                          <p className="text-xs text-slate-700 leading-snug min-w-0">
                            {entry.actorName && <span className="font-medium text-slate-900">{entry.actorName} </span>}
                            {entry.summary.replace(entry.actorName ?? "", "").replace(/^ - |^ — /, "").trim()}
                          </p>
                          <span className="text-[10px] font-mono font-medium text-slate-400 shrink-0 whitespace-nowrap">
                            {relativeTime(entry.createdAt)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Move Work Order Status */}
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-slate-900 uppercase tracking-wider font-mono">Move Work Order Status</h4>
                <div className="flex flex-wrap gap-2">
                  {(["reported", "awaiting_approval", "scheduled", "in_progress", "done"] as MaintenanceStatus[]).map((k) => {
                    const active = detail.status === k;
                    return (
                      <button
                        key={k}
                        type="button"
                        onClick={() => handleStepperClick(detail.id, detail.status, k)}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-medium transition-all duration-200 border cursor-pointer shadow-2xs",
                          active
                            ? "bg-[#151936] text-white border-[#151936] shadow-xs"
                            : "bg-slate-50/70 text-slate-700 border-slate-200/80 hover:bg-slate-100 hover:border-slate-300"
                        )}
                      >
                        <span className={cn("size-1.5 rounded-full", (STATUS_META[k] ?? STATUS_META.reported).dot)} />
                        {(STATUS_META[k] ?? STATUS_META.reported).label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Schedule Visit Modal Form inside Drawer */}
              {scheduleOpen && (
                <div className="bg-gradient-to-br from-amber-50/80 via-white to-amber-50/40 border border-amber-200/80 rounded-2xl p-4 flex flex-col gap-3 shadow-2xs">
                  <div className="flex items-center gap-2">
                    <IconCalendarPlus size={16} className="text-amber-700" />
                    <p className="text-xs font-medium text-slate-900">
                      {detail.scheduledVisit ? "Reschedule Site Visit" : "Schedule Site Visit"}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-mono font-medium uppercase tracking-wider text-slate-600 block mb-1">
                        Start Time
                      </label>
                      <input
                        type="datetime-local"
                        value={scheduleStart}
                        onChange={(e) => setScheduleStart(e.target.value)}
                        className="w-full h-9 rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-900 outline-none focus:border-[#151936] transition-all shadow-2xs"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-mono font-medium uppercase tracking-wider text-slate-600 block mb-1">
                        End Time
                      </label>
                      <input
                        type="datetime-local"
                        value={scheduleEnd}
                        onChange={(e) => setScheduleEnd(e.target.value)}
                        className="w-full h-9 rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-900 outline-none focus:border-[#151936] transition-all shadow-2xs"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <Button variant="secondary" size="sm" onClick={() => setScheduleOpen(false)} className="rounded-xl">
                      Cancel
                    </Button>
                    <Button size="sm" onClick={submitSchedule} disabled={isScheduling || !scheduleStart || !scheduleEnd} className="rounded-xl bg-[#151936] text-white hover:bg-[#1f254e]">
                      {isScheduling ? "Saving..." : "Confirm Schedule"}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Sticky Bottom Actions Bar */}
            <div className="sticky bottom-0 bg-white/95 backdrop-blur-md border-t border-slate-200/80 px-5 py-3.5 flex items-center justify-between gap-3 flex-wrap mt-3">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setScheduleOpen((v) => !v)}
                disabled={detail.status === "done"}
                className="rounded-xl border-slate-200/90 text-slate-800 hover:bg-slate-50"
              >
                <IconCalendarPlus size={14} /> {detail.scheduledVisit ? "Reschedule Visit" : "Schedule Visit"}
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  className="rounded-xl text-rose-600 hover:bg-rose-50 border-rose-200/90"
                  onClick={() => setCancelConfirmId(detail.id)}
                >
                  <IconBan size={14} /> Cancel Order
                </Button>

                <Button
                  size="sm"
                  onClick={handleComplete}
                  disabled={detail.status === "done" || isCompleting}
                  className="rounded-xl bg-[#151936] text-white hover:bg-[#1f254e]"
                >
                  <IconCheck size={14} /> {isCompleting ? "Saving..." : "Mark Complete"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </Drawer>
    </PageTransition>
  );
}
