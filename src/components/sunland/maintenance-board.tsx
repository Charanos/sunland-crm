"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  IconArrowUpRight,
  IconBan,
  IconBuildingCommunity,
  IconCalendarPlus,
  IconCheck,
  IconDroplet,
  IconFileDescription,
  IconFileInvoice,
  IconMoodEmpty,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconShieldX,
  IconTool,
} from "@tabler/icons-react";
import { Badge, BoardHeader, Button, ConfirmDialog, Drawer, SkeletonBlock } from "@/components/ui/erp-primitives";
import { PageTransition } from "@/components/shared/page-transition";
import { useToast } from "@/components/ui/toast-provider";
import { cn } from "@/lib/utils/cn";
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

// KPI-tier "Works mix" segment colors - brighter than CATEGORY_META's badge
// colors (which are tuned for a white background), matching the design's own
// distinct palette for the dark strip.
const MIX_COLORS: Record<MaintenanceCategory, string> = { reactive: "#f3df27", planned: "#6ee7b7", compliance: "#fda4af" };

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
  const meta = SLA_STATE_META[display];
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

  const attentionItems = useMemo(() => {
    type Item = { id: string; tone: "rose" | "amber"; icon: typeof IconShieldX; title: string; meta: string; ctaLabel: string };
    const items: Item[] = [];
    const now = Date.now();

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
        meta: `${criticalActive.propertyName} · ${STATUS_META[criticalActive.status].label}`,
        ctaLabel: "Track",
      });
    }

    const awaitingApproval = requests
      .filter((r) => r.status === "awaiting_approval")
      .sort((a, b) => parseFloat(b.estimatedCostKes || "0") - parseFloat(a.estimatedCostKes || "0"))[0];
    if (awaitingApproval) {
      items.push({
        id: awaitingApproval.id, tone: "amber", icon: IconFileInvoice,
        title: `${awaitingApproval.title} awaiting approval`,
        meta: `${awaitingApproval.propertyName} · ${fmtKes(awaitingApproval.estimatedCostKes)}`,
        ctaLabel: "Review",
      });
    }

    return items.slice(0, 3);
  }, [requests]);

  const filterCounts = useMemo(() => ({
    all: requests.length,
    urgent: requests.filter((r) => r.priority !== "routine").length,
    awaiting_approval: requests.filter((r) => r.status === "awaiting_approval").length,
    in_progress: requests.filter((r) => r.status === "in_progress").length,
    scheduled: requests.filter((r) => r.status === "scheduled").length,
    done: requests.filter((r) => r.status === "done").length,
  }), [requests]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return requests
      .filter((r) => filter === "all" ? true : filter === "urgent" ? r.priority !== "routine" : r.status === filter)
      .filter((r) => !q || [r.title, r.propertyName, r.propertyCode, r.assignedContractorName].some((s) => s?.toLowerCase().includes(q)))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [requests, filter, query]);

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
    const now = Date.now();
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
          dotClass: linked ? PRIORITY_META[linked.priority].rail : "bg-slate-300",
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
        <span className="label-caps text-slate-400 tracking-wider">Works Signals</span>
        <hr className="flex-1 border-slate-200/60" />
      </div>

      {/* ── Works Signals KPI tier ── */}
      <div className="gsap-stagger bg-tertiary-gradient border border-[#122a20]/80 p-1.5 rounded-[24px] shadow-xl relative overflow-hidden group">
        <div className="absolute right-0 top-0 size-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-emerald-500/20 transition-colors duration-700 -z-10" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-white/10">
          {/* Open Work Orders */}
          <div className="p-5 sm:p-6 flex flex-col justify-between relative overflow-hidden">
            <IconTool size={140} stroke={1} className="absolute -right-6 -bottom-6 opacity-[0.05] pointer-events-none" />
            <span className="text-xs font-medium text-slate-300 relative z-10">Open Work Orders</span>
            <div className="relative z-10 flex items-end justify-between gap-2 mt-4">
              <span className="font-mono text-[32px] font-medium text-white leading-none">{kpis.open.length}</span>
              <span className="text-[10.5px] font-medium uppercase tracking-wider text-rose-300">{kpis.urgent.length} urgent</span>
            </div>
          </div>

          {/* SLA Compliance ring gauge */}
          <div className="p-5 sm:p-6 flex items-center gap-4">
            <svg width="62" height="62" viewBox="0 0 64 64" className="shrink-0">
              <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="7" />
              <circle cx="32" cy="32" r="26" fill="none" stroke="#f3df27" strokeWidth="7" strokeLinecap="round" strokeDasharray={`${((kpis.slaCompliancePct / 100) * 163.4).toFixed(1)} 163.4`} transform="rotate(-90 32 32)" />
            </svg>
            <div>
              <p className="text-xs font-medium text-slate-300 mb-1">SLA Compliance</p>
              <span className="font-mono text-[27px] font-medium text-white leading-none">{kpis.slaCompliancePct}%</span>
              <p className="text-[10.5px] font-medium uppercase tracking-wider text-emerald-300 mt-1.5">
                {kpis.avgResponseHours != null ? `avg resolve ${kpis.avgResponseHours < 1 ? "<1h" : kpis.avgResponseHours.toFixed(1) + "h"}` : "no closed orders yet"}
              </p>
            </div>
          </div>

          {/* Works mix */}
          <div className="p-5 sm:p-6 flex flex-col gap-3 justify-center">
            <p className="text-xs font-medium text-slate-300">Works mix</p>
            <div className="flex h-[9px] rounded-full overflow-hidden gap-0.5" aria-hidden="true">
              {kpis.mix.filter((m) => m.count > 0).map((m) => (
                <div key={m.cat} style={{ background: MIX_COLORS[m.cat], width: `${(m.count / kpis.mixTotal) * 100}%` }} />
              ))}
            </div>
            <div className="flex flex-wrap gap-x-3.5 gap-y-1.5">
              {kpis.mix.map((m) => (
                <span key={m.cat} className="inline-flex items-center gap-1.5 text-[10.5px] font-medium uppercase tracking-wider text-white/50">
                  <span className="size-2 rounded-full inline-block" style={{ background: MIX_COLORS[m.cat] }} />
                  {CATEGORY_META[m.cat].label} · <span className="font-mono">{m.count}</span>
                </span>
              ))}
            </div>
          </div>

          {/* Month Works Spend */}
          <div className="p-5 sm:p-6 flex flex-col justify-between relative overflow-hidden">
            <IconFileInvoice size={140} stroke={1} className="absolute -right-6 -bottom-6 opacity-[0.05] pointer-events-none" style={{ color: "#f3df27" }} />
            <span className="text-xs font-medium text-slate-300 relative z-10">{kpis.monthLabel} Works Spend</span>
            <div className="relative z-10 mt-4">
              <span className="font-mono text-[32px] font-medium text-white leading-none">{kpis.spendTotal >= 1000 ? `KES ${(kpis.spendTotal / 1000).toFixed(0)}K` : fmtKes(kpis.spendTotal)}</span>
              <p className="text-[10.5px] font-medium uppercase tracking-wider text-white/40 mt-2">nets against landlord remittances</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Needs Attention ── */}
      {attentionItems.length > 0 && (
        <>
          <div className="flex items-center gap-4 mt-2">
            <hr className="flex-1 border-slate-200/60" />
            <span className="label-caps text-slate-400 tracking-wider">Needs Attention</span>
            <hr className="flex-1 border-slate-200/60" />
          </div>
          <div className="flex flex-wrap gap-2.5">
            {attentionItems.map((item) => (
              <div
                key={item.id}
                className={cn(
                  "flex items-center gap-3 rounded-2xl p-3.5 flex-1 min-w-[280px] border shadow-sm",
                  item.tone === "rose" ? "bg-rose-50/60 border-rose-200/70" : "bg-amber-50/60 border-amber-200/70",
                )}
              >
                <span className={cn("size-8.5 rounded-full flex items-center justify-center shrink-0", item.tone === "rose" ? "bg-rose-500/10 text-rose-600" : "bg-amber-500/[0.14] text-amber-700")}>
                  <item.icon size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-slate-900 truncate">{item.title}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5 truncate">{item.meta}</p>
                </div>
                <button
                  type="button"
                  onClick={() => openDrawer(item.id)}
                  className="shrink-0 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  {item.ctaLabel}
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="flex items-center gap-4 mt-2">
        <hr className="flex-1 border-slate-200/60" />
        <span className="label-caps text-slate-400 tracking-wider">Work Order Queue</span>
        <hr className="flex-1 border-slate-200/60" />
      </div>

      {/* ── Queue + Rail ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_330px] gap-4 items-start">
        <div className="min-w-0">
          {/* Filters */}
          <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
            <div className="inline-flex gap-1 bg-white border border-slate-100 rounded-2xl p-1 flex-wrap">
              {FILTERS.map((f) => {
                const count = filterCounts[f.id as keyof typeof filterCounts];
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFilter(f.id)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition-colors",
                      filter === f.id ? "bg-[#151936] text-white" : "text-slate-500 hover:text-slate-800",
                    )}
                  >
                    {f.label}
                    <span className="font-mono text-[10.5px] opacity-70">{count}</span>
                  </button>
                );
              })}
            </div>
            <div className="relative flex items-center group">
              <IconSearch size={15} className="absolute left-3 text-slate-400 group-focus-within:text-[#151936] transition-colors" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search ref, property, issue…"
                className="bg-white border border-slate-200 rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-slate-900 outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-[#151936]/10 focus:border-[#151936]/30 transition-all shadow-sm min-w-[220px]"
              />
            </div>
          </div>

          {/* Rows */}
          {loading ? (
            <WorkOrderRowsSkeleton />
          ) : requests.length === 0 ? (
            <div className="border border-dashed border-slate-200 rounded-2xl p-12 text-center flex flex-col items-center gap-3">
              <div className="size-14 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-300">
                <IconTool size={26} />
              </div>
              <h3 className="text-title-primary">No work orders yet</h3>
              <p className="text-desc-secondary max-w-sm">Reported issues and planned works will appear here as a real-time queue.</p>
              <Button size="sm" onClick={() => setNewOpen(true)} className="mt-1">
                <IconPlus size={14} /> New Work Order
              </Button>
            </div>
          ) : visible.length === 0 ? (
            <div className="border-[1.5px] border-dashed border-slate-200 rounded-2xl p-8 text-center text-sm text-slate-400">No work orders match this view.</div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {visible.map((r) => {
                const sla = slaLineFor(r, slaHours[r.priority]);
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => openDrawer(r.id)}
                    className="flex items-center gap-3.5 w-full text-left bg-white border border-slate-100 rounded-[18px] p-3.5 shadow-[0_4px_14px_rgba(0,0,0,0.03)] hover:shadow-[0_12px_30px_rgba(0,0,0,0.08)] transition-shadow"
                  >
                    <span className={cn("w-1 self-stretch rounded-full shrink-0", PRIORITY_META[r.priority].rail)} />
                    <div className="size-16 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-300 shrink-0">
                      <IconTool size={22} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-[11px] text-slate-400">{r.propertyCode}</span>
                        <span className={cn(PILL, CATEGORY_META[r.category].pill)}>{CATEGORY_META[r.category].label}</span>
                        <span className={cn(PILL, PRIORITY_META[r.priority].pill)}>{PRIORITY_META[r.priority].label}</span>
                      </div>
                      <p className="text-sm font-medium text-slate-900 mt-1 truncate">{r.title}</p>
                      <p className="text-xs text-slate-400 mt-0.5 truncate">{r.propertyName} · {r.assignedContractorName ?? "Unassigned"}</p>
                    </div>
                    <div className="shrink-0 flex flex-col items-end gap-1.5">
                      <span className={cn(PILL, STATUS_META[r.status].pill)}>
                        <span className={cn("size-1.5 rounded-full", STATUS_META[r.status].dot)} />
                        {STATUS_META[r.status].label}
                      </span>
                      <span className="font-mono text-xs text-[#122a20]">{fmtKes(r.actualCostKes ?? r.estimatedCostKes)}</span>
                      <span className="text-[10.5px] font-mono font-medium" style={{ color: sla.color }}>{sla.text}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Rail ── */}
        <div className="flex flex-col gap-3.5 lg:sticky lg:top-4">
          <div className="bg-white border border-slate-100 rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-4.5">
            <p className="text-sm font-medium text-slate-800 mb-3">Crew & Vendors</p>
            {crew.length === 0 ? (
              <p className="text-xs text-slate-400">No contractors on file yet.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {crew.map((c) => (
                  <div key={c.id} className="flex items-center gap-2.5 bg-slate-50/70 border border-slate-100 rounded-xl px-3 py-2">
                    <span className="size-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 shrink-0">
                      <IconTool size={14} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-slate-900 truncate">{c.displayName}</p>
                      <p className="text-[10.5px] text-slate-400 truncate">{c.metadata?.specialty ?? "General"}</p>
                    </div>
                    <span className={cn(PILL, c.tone === "emerald" ? "bg-emerald-500/[0.12] text-emerald-700" : c.tone === "amber" ? "bg-amber-500/[0.14] text-amber-700" : "bg-slate-100 text-slate-500")}>
                      {c.load}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white border border-slate-100 rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-4.5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-slate-800">Scheduled Visits</p>
              <Link href="/admin/events" className="text-[11.5px] font-medium text-[#122a20] hover:underline inline-flex items-center gap-1">
                Scheduler <IconArrowUpRight size={12} />
              </Link>
            </div>
            {scheduledVisits.length === 0 ? (
              <p className="text-xs text-slate-400">No visits scheduled yet.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {scheduledVisits.map((v) => (
                  <button key={v.id} type="button" onClick={v.onOpen} className="flex items-center gap-2.5 bg-slate-50/70 border border-slate-100 rounded-xl px-3 py-2 text-left w-full hover:bg-slate-100/70 transition-colors">
                    <span className="w-8.5 text-center shrink-0">
                      <span className="block font-mono text-[10px] text-slate-400">{v.day}</span>
                      <span className="block font-mono text-[9.5px] text-slate-300">{v.time}</span>
                    </span>
                    <span className={cn("size-2 rounded-full shrink-0", v.dotClass)} />
                    <span className="text-[11.5px] font-medium text-slate-700 truncate flex-1 min-w-0">{v.what}</span>
                  </button>
                ))}
              </div>
            )}
            <p className="text-[11px] text-slate-400 leading-relaxed mt-2.5">Scheduling a work-order visit auto-creates the Scheduler event; closing the order closes the event.</p>
          </div>

          <div className="bg-white border border-slate-100 rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-4.5">
            <p className="text-sm font-medium text-slate-800 mb-3">{kpis.monthLabel} Spend by Property</p>
            {spendByProperty.length === 0 ? (
              <p className="text-xs text-slate-400">No spend recorded this month.</p>
            ) : (
              <div className="flex flex-col gap-2.5">
                {spendByProperty.map((sp) => (
                  <div key={sp.name}>
                    <div className="flex justify-between mb-1">
                      <span className="text-[11.5px] font-medium text-slate-700 truncate">{sp.name}</span>
                      <span className="font-mono text-[11px] text-slate-500 shrink-0">{fmtKes(sp.amt)}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${sp.pct}%`, background: "linear-gradient(90deg,#f3df27,#151936)" }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
            <p className="text-[11px] text-slate-400 leading-relaxed mt-2.5">Approved costs post to the mandate ledger and net against the next remittance advice.</p>
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
      <Drawer open={!!selectedId} onClose={closeDrawer} title={drawerRequest?.title ?? "Work Order"} width="34rem">
        {detailLoading || !detail ? (
          <div className="flex flex-col gap-4">
            <SkeletonBlock className="h-36 w-[calc(100%+2.5rem)] rounded-none -mt-5 -mx-5" />
            <div className="px-5 flex flex-col gap-4">
              <SkeletonBlock className="h-4 w-1/2" />
              <SkeletonBlock className="h-24 w-full rounded-2xl" />
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-5 -mt-5 -mx-5">
            {/* Hero */}
            <div className="relative h-36 overflow-hidden shrink-0">
              {detail.propertyMedia?.[0]?.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={detail.propertyMedia[0].url} alt="" className="absolute inset-0 size-full object-cover" />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-[#122a20] to-[#1e1b4b]" />
              )}
              <div className="absolute inset-0 bg-gradient-to-b from-[#0a0d1c]/35 to-[#0a0d1c]/85" />
              <div className="relative h-full flex flex-col justify-end p-5">
                <div className="flex items-center gap-1.5 mb-auto">
                  <span className={cn(PILL, "bg-white/[0.18] text-white")}>{PRIORITY_META[detail.priority].label}</span>
                  <span className={cn(PILL, "bg-[#f3df27]/90 text-[#151936]")}>{STATUS_META[detail.status].label}</span>
                </div>
                <p className="font-mono text-[11px] text-white/70">{detail.propertyCode} · {CATEGORY_META[detail.category].label}</p>
                <p className="font-serif text-xl text-white mt-0.5 leading-tight">{detail.title}</p>
              </div>
            </div>

            <div className="flex flex-col gap-5 px-5">
              {/* Fact cells */}
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { label: "Property / unit", value: `${detail.propertyName} · ${detail.propertyLocation}` },
                  { label: "Assigned to", value: detail.assignedContractorName ?? "Unassigned" },
                  { label: "Reported by", value: detail.reportedByName ?? "—" },
                  { label: "Opened", value: fmtDate(detail.createdAt) },
                  { label: "Next visit", value: detail.scheduledVisit ? fmtDateTime(detail.scheduledVisit.startsAt) : "Not scheduled" },
                  { label: "SLA", value: slaLineFor(detail, slaTarget).text },
                ].map((kv) => (
                  <div key={kv.label} className="bg-slate-50/70 border border-slate-100 rounded-xl px-3 py-2.5 min-w-0">
                    <p className="text-[10.5px] text-slate-400 mb-0.5">{kv.label}</p>
                    <p className="text-xs font-medium text-slate-900 truncate">{kv.value}</p>
                  </div>
                ))}
              </div>

              {/* Cost & Approval */}
              <div className="bg-slate-50/70 border border-slate-100 rounded-2xl p-4">
                <p className="text-xs font-medium text-slate-800 mb-2">Cost & Approval</p>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-slate-500">Estimate</span>
                  <span className="font-mono font-medium text-slate-900">{fmtKes(detail.estimatedCostKes)}</span>
                </div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-slate-500">Approved by</span>
                  <span className="font-medium text-slate-900">
                    {detail.pendingApproval ? `Pending — ${detail.pendingApproval.requiredApproverRole.toUpperCase()} decision` : detail.actualCostKes ? "Auto / on file" : "—"}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Posts to</span>
                  <Link href="/admin/leases?mode=mandates" className="font-medium text-[#122a20] hover:underline inline-flex items-center gap-1">
                    Mandate ledger <IconArrowUpRight size={11} />
                  </Link>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed mt-2.5">
                  {(() => {
                    const cost = detail.actualCostKes ?? detail.estimatedCostKes;
                    const costNum = cost ? parseFloat(cost) : 0;
                    const ceiling = detail.maintenanceAuthorityKes ?? 25000;
                    if (costNum <= ceiling) return `Within the PM's KES ${ceiling.toLocaleString()} self-approval authority — auto-approved and logged.`;
                    if (detail.pendingApproval?.requiredApproverRole === "ceo") return "Above the CEO threshold: routed to the CEO approval queue (approval engine, dual sign-off).";
                    return `Above PM authority: requires GM sign-off before crew mobilization.`;
                  })()}
                </p>
              </div>

              {/* Linked Records */}
              <div>
                <p className="text-xs font-medium text-slate-800 mb-2">Linked Records</p>
                <div className="flex flex-col gap-1.5">
                  <Link href={`/admin/properties/${detail.propertyId}`} className="flex items-center gap-2.5 bg-slate-50/70 border border-slate-100 rounded-xl px-3 py-2 hover:bg-slate-100/70 transition-colors">
                    <span className="size-7.5 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-[#151936] shrink-0"><IconBuildingCommunity size={14} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-medium text-slate-900 truncate">Property file</span>
                      <span className="block text-[10.5px] text-slate-400 truncate">{detail.propertyName}</span>
                    </span>
                    <IconArrowUpRight size={13} className="text-slate-300 shrink-0" />
                  </Link>
                  {detail.maintenanceAuthorityKes != null && (
                    <Link href="/admin/leases?mode=mandates" className="flex items-center gap-2.5 bg-slate-50/70 border border-slate-100 rounded-xl px-3 py-2 hover:bg-slate-100/70 transition-colors">
                      <span className="size-7.5 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-[#151936] shrink-0"><IconFileDescription size={14} /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-medium text-slate-900 truncate">Mandate & remittance</span>
                        <span className="block text-[10.5px] text-slate-400 truncate">Costs net against next advice</span>
                      </span>
                      <IconArrowUpRight size={13} className="text-slate-300 shrink-0" />
                    </Link>
                  )}
                  {detail.scheduledVisit && (
                    <Link href="/admin/events" className="flex items-center gap-2.5 bg-slate-50/70 border border-slate-100 rounded-xl px-3 py-2 hover:bg-slate-100/70 transition-colors">
                      <span className="size-7.5 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-[#151936] shrink-0"><IconTool size={14} /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-medium text-slate-900 truncate">Scheduler event</span>
                        <span className="block text-[10.5px] text-slate-400 truncate">{fmtDateTime(detail.scheduledVisit.startsAt)}</span>
                      </span>
                      <IconArrowUpRight size={13} className="text-slate-300 shrink-0" />
                    </Link>
                  )}
                </div>
              </div>

              {/* Timeline (activity log) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-slate-800">Timeline</p>
                </div>
                <div className="relative">
                  <input
                    value={activityQuery}
                    onChange={(e) => setActivityQuery(e.target.value)}
                    placeholder="Search activity…"
                    className="w-full bg-slate-50 border border-slate-200 text-xs rounded-lg pl-8 pr-3 py-2 mb-3 focus:outline-none focus:ring-2 focus:ring-[#151936]/10 placeholder:text-slate-400"
                  />
                  <IconSearch size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 -mt-[6px] text-slate-400" />
                </div>
                {activityLoading ? (
                  <div className="flex justify-center py-6"><SkeletonBlock className="h-4 w-1/2" /></div>
                ) : filteredActivity.length === 0 ? (
                  <div className="flex flex-col items-center py-8 text-center gap-2">
                    <IconMoodEmpty size={22} className="text-slate-300" />
                    <p className="text-xs text-slate-400">No activity recorded yet.</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3 relative ml-0.5">
                    <div className="absolute left-[3px] top-1.5 bottom-4 w-px bg-slate-100 z-0" />
                    {filteredActivity.map((entry) => (
                      <div key={entry.id} className="relative flex items-start gap-3 z-10">
                        <span className={cn("size-[7px] rounded-full mt-1.5 shrink-0 ring-4", activityTone(entry.summary))} />
                        <div className="flex-1 min-w-0 flex items-center justify-between gap-2 bg-slate-50/50 rounded-lg px-2.5 py-1.5">
                          <p className="text-xs text-slate-600 leading-snug min-w-0">
                            {entry.actorName && <span className="font-medium text-slate-800">{entry.actorName} </span>}
                            {entry.summary.replace(entry.actorName ?? "", "").replace(/^ - |^ — /, "").trim()}
                          </p>
                          <Badge tone="neutral" className="shrink-0 whitespace-nowrap">{relativeTime(entry.createdAt)}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Move to */}
              <div>
                <p className="text-xs font-medium text-slate-800 mb-2">Move to</p>
                <div className="flex flex-wrap gap-1.5">
                  {(["reported", "awaiting_approval", "scheduled", "in_progress", "done"] as MaintenanceStatus[]).map((k) => {
                    const active = detail.status === k;
                    return (
                      <button
                        key={k}
                        type="button"
                        onClick={() => handleStepperClick(detail.id, detail.status, k)}
                        className={cn(
                          "inline-flex items-center rounded-full px-3 py-1.5 text-xs font-medium border transition-colors",
                          active ? "bg-[#151936] text-white border-[#151936]" : "bg-white text-slate-600 border-slate-200 hover:border-slate-300",
                        )}
                      >
                        {STATUS_META[k].label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {scheduleOpen && (
                <div className="bg-amber-50/60 border border-amber-200/70 rounded-2xl p-4 flex flex-col gap-3">
                  <p className="text-xs font-medium text-slate-800">{detail.scheduledVisit ? "Reschedule visit" : "Schedule visit"}</p>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-[10.5px] text-slate-400 block mb-1">Starts</label>
                      <input type="datetime-local" value={scheduleStart} onChange={(e) => setScheduleStart(e.target.value)} className="w-full h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs focus:outline-none focus:border-[#151936]/40" />
                    </div>
                    <div>
                      <label className="text-[10.5px] text-slate-400 block mb-1">Ends</label>
                      <input type="datetime-local" value={scheduleEnd} onChange={(e) => setScheduleEnd(e.target.value)} className="w-full h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs focus:outline-none focus:border-[#151936]/40" />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="secondary" size="sm" onClick={() => setScheduleOpen(false)}>Cancel</Button>
                    <Button size="sm" onClick={submitSchedule} disabled={isScheduling || !scheduleStart || !scheduleEnd}>
                      {isScheduling ? "Saving..." : "Confirm"}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Footer actions */}
            <div className="sticky bottom-0 bg-white border-t border-slate-100 px-5 py-3.5 flex items-center justify-between gap-2 flex-wrap">
              <Button variant="secondary" size="sm" onClick={() => setScheduleOpen((v) => !v)} disabled={detail.status === "done"}>
                <IconCalendarPlus size={14} /> {detail.scheduledVisit ? "Reschedule Visit" : "Schedule Visit"}
              </Button>
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" className="text-rose-600 hover:bg-rose-50 hover:border-rose-200" onClick={() => setCancelConfirmId(detail.id)}>
                  <IconBan size={14} /> Cancel Order
                </Button>
                <Button size="sm" onClick={handleComplete} disabled={detail.status === "done" || isCompleting}>
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
