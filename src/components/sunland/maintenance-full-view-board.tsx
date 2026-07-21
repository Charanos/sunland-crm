"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  IconAlertTriangle,
  IconBuildingCommunity,
  IconCalendarClock,
  IconCalendarPlus,
  IconCash,
  IconChevronLeft,
  IconClock,
  IconDotsVertical,
  IconFileText,
  IconFlame,
  IconHistory,
  IconMapPin,
  IconMoodEmpty,
  IconPhone,
  IconSearch,
  IconTool,
  IconTrash,
  IconUser,
  IconX,
} from "@tabler/icons-react";
import { Badge } from "@/components/ui/erp-primitives";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DropdownMenu, DropdownItem } from "@/components/ui/dropdown-menu";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { PageTransition } from "@/components/shared/page-transition";
import { useToast } from "@/components/ui/toast-provider";
import { formatCompactKES } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import {
  PRIORITY_META,
  SLA_STATE_META,
  STATUS_META,
  slaStateFor,
  type MaintenancePriority,
  type MaintenanceStatus,
} from "./maintenance-constants";

interface MaintenanceDetail {
  id: string;
  entityId: string;
  propertyId: string;
  propertyName: string;
  propertyCode: string;
  propertyLocation: string;
  propertyMedia: Array<{ url: string; alt?: string; isPrimary?: boolean }> | null;
  title: string;
  description: string;
  priority: MaintenancePriority;
  status: MaintenanceStatus;
  dueAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
  reportedByContactId: string | null;
  reportedByName: string | null;
  reportedByPhone: string | null;
  assignedContractorId: string | null;
  assignedContractorName: string | null;
  assignedContractorPhone: string | null;
  assignedContractorEmail: string | null;
  contractorSpecialty: string | null;
  estimatedCostKes: number | null;
  actualCostKes: number | null;
  maintenanceAuthorityKes: number | null;
  propertyManagerName: string | null;
  pendingApproval: { id: string; requiredApproverRole: string; amountKes: string | null } | null;
  sla: { state: "ok" | "at_risk" | "breached"; hoursElapsed: number; hoursRemaining: number; targetHours: number };
}

interface AuditEntry {
  id: string;
  summary: string;
  actorName?: string | null;
  createdAt: string;
}

// Only the safe, direct bare-status transitions - "scheduled" always goes
// through the real scheduleMaintenanceVisit endpoint (Schedule Visit action)
// since it requires a real calendar_events row, not a free status jump.
const NEXT_STAGE: Partial<Record<MaintenanceStatus, { status: MaintenanceStatus; label: string }>> = {
  reported: { status: "in_progress", label: "Start Progress" },
  scheduled: { status: "in_progress", label: "Start Progress" },
  in_progress: { status: "done", label: "Mark Complete" },
};

function fmtDate(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" });
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-KE", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
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

type VitalTone = "emerald" | "amber" | "rose" | "neutral";

const VITAL_TONE_BG: Record<VitalTone, string> = {
  emerald: "bg-gradient-to-br from-white to-[#ecfdf5]/30 border-slate-200/80 hover:to-[#ecfdf5]/55",
  amber: "bg-gradient-to-br from-white to-[#fffbeb]/45 border-slate-200/80 hover:to-[#fffbeb]/70",
  rose: "bg-gradient-to-br from-white to-[#fff1f2]/30 border-slate-200/80 hover:to-[#fff1f2]/55",
  neutral: "bg-gradient-to-br from-white to-slate-50/40 border-slate-200/80 hover:to-slate-50/60",
};
const VITAL_TONE_BADGE_BG: Record<VitalTone, string> = {
  emerald: "bg-emerald-50 text-emerald-700",
  amber: "bg-amber-50 text-amber-700",
  rose: "bg-rose-50 text-rose-700",
  neutral: "bg-slate-100 text-slate-700",
};
const VITAL_TONE_VALUE: Record<VitalTone, string> = {
  emerald: "text-emerald-700",
  amber: "text-amber-700",
  rose: "text-rose-600",
  neutral: "text-slate-900",
};
const VITAL_TONE_ARTWORK: Record<VitalTone, string> = {
  emerald: "text-emerald-600",
  amber: "text-amber-600",
  rose: "text-rose-600",
  neutral: "text-slate-600",
};

export function MaintenanceFullViewBoard({ entityId, requestId }: { entityId: string; requestId: string }) {
  const { pushToast } = useToast();
  const [request, setRequest] = useState<MaintenanceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "activity">("overview");
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [contractors, setContractors] = useState<{ id: string; displayName: string }[]>([]);
  const [reassignOpen, setReassignOpen] = useState(false);
  const [reassignId, setReassignId] = useState("");
  const [costOpen, setCostOpen] = useState(false);
  const [costInput, setCostInput] = useState("");
  const [submittingCost, setSubmittingCost] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleStart, setScheduleStart] = useState("");
  const [scheduleEnd, setScheduleEnd] = useState("");
  const [isScheduling, setIsScheduling] = useState(false);
  const [activity, setActivity] = useState<AuditEntry[] | null>(null);
  const [activityLoaded, setActivityLoaded] = useState(false);
  const [activityQuery, setActivityQuery] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/maintenance-requests/${requestId}?entityId=${entityId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load maintenance request");
      setRequest(data.maintenanceRequest);
    } catch (err) {
      pushToast({ tone: "warning", title: "Error", body: err instanceof Error ? err.message : "Failed to load request." });
    } finally {
      setLoading(false);
    }
  }, [requestId, entityId, pushToast]);

  useEffect(() => {
    Promise.resolve().then(() => load());
  }, [load]);

  useEffect(() => {
    if (!entityId) return;
    fetch(`/api/contacts?entityId=${entityId}&type=contractor`)
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d.contacts)) setContractors(d.contacts); })
      .catch(() => {});
  }, [entityId]);

  useEffect(() => {
    if (activeTab !== "activity" || activityLoaded) return;
    fetch(`/api/audit?entityId=${entityId}&associatedType=maintenance_request&associatedId=${requestId}&limit=100`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => { setActivity(d.entries ?? []); setActivityLoaded(true); })
      .catch(() => { setActivity([]); setActivityLoaded(true); });
  }, [activeTab, activityLoaded, entityId, requestId]);

  const advanceStatus = async () => {
    if (!request) return;
    const next = NEXT_STAGE[request.status];
    if (!next) return;
    try {
      const res = await fetch(`/api/maintenance-requests/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next.status }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Failed to update status");
      pushToast({ tone: "success", title: "Updated", body: `Request moved to ${STATUS_META[next.status].label}.` });
      load();
    } catch (err) {
      pushToast({ tone: "warning", title: "Error", body: err instanceof Error ? err.message : "Try again." });
    }
  };

  const submitReassign = async () => {
    try {
      const res = await fetch(`/api/maintenance-requests/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedContractorId: reassignId || null }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Failed to reassign contractor");
      pushToast({ tone: "success", title: "Updated", body: "Contractor assignment saved." });
      setReassignOpen(false);
      load();
    } catch (err) {
      pushToast({ tone: "warning", title: "Error", body: err instanceof Error ? err.message : "Try again." });
    }
  };

  const submitSchedule = async () => {
    if (!scheduleStart || !scheduleEnd) return;
    setIsScheduling(true);
    try {
      const res = await fetch(`/api/maintenance-requests/${requestId}/schedule-visit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityId, startsAt: new Date(scheduleStart).toISOString(), endsAt: new Date(scheduleEnd).toISOString() }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Failed to schedule visit");
      pushToast({ tone: "success", title: "Scheduler event created", body: "Visit booked — crew and tenant notified." });
      setScheduleOpen(false);
      setScheduleStart("");
      setScheduleEnd("");
      load();
    } catch (err) {
      pushToast({ tone: "warning", title: "Error", body: err instanceof Error ? err.message : "Try again." });
    } finally {
      setIsScheduling(false);
    }
  };

  const submitCost = async () => {
    const costKes = parseFloat(costInput);
    if (!costKes || costKes <= 0) {
      pushToast({ tone: "warning", title: "Invalid amount", body: "Enter a cost greater than zero." });
      return;
    }
    setSubmittingCost(true);
    try {
      const res = await fetch(`/api/maintenance-requests/${requestId}/submit-cost`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityId, costKes }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Failed to submit cost");
      pushToast({
        tone: "success",
        title: data.selfApproved ? "Cost approved" : "Submitted for approval",
        body: data.selfApproved ? "Within authority - approved and recorded immediately." : `Routed to ${data.approvalRequest?.requiredApproverRole?.toUpperCase()} for a decision.`,
      });
      setCostOpen(false);
      setCostInput("");
      load();
    } catch (err) {
      pushToast({ tone: "warning", title: "Error", body: err instanceof Error ? err.message : "Try again." });
    } finally {
      setSubmittingCost(false);
    }
  };

  const confirmDelete = async () => {
    try {
      await fetch(`/api/maintenance-requests/${requestId}`, { method: "DELETE" });
      pushToast({ tone: "success", title: "Deleted", body: "Maintenance request removed." });
      window.location.href = "/admin/maintenance";
    } catch {
      pushToast({ tone: "warning", title: "Error", body: "Could not delete request." });
    }
  };

  if (loading || !request) {
    return (
      <div className="flex items-center justify-center py-24">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const statusMeta = STATUS_META[request.status] ?? STATUS_META.reported;
  const priorityMeta = PRIORITY_META[request.priority] ?? PRIORITY_META.routine;
  const slaMeta = SLA_STATE_META[request.sla.state] ?? SLA_STATE_META.ok;
  const heroImg = request.propertyMedia?.find((m) => m.isPrimary)?.url ?? request.propertyMedia?.[0]?.url ?? null;
  const next = NEXT_STAGE[request.status];
  const costVsAuthority = request.maintenanceAuthorityKes != null && (request.estimatedCostKes ?? request.actualCostKes)
    ? (request.actualCostKes ?? request.estimatedCostKes ?? 0) / request.maintenanceAuthorityKes
    : null;

  return (
    <PageTransition className="mx-auto flex max-w-[98rem] flex-col gap-6 pb-12">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
        <Link href="/admin/maintenance" className="hover:text-slate-900 transition-colors flex items-center gap-1">
          <IconChevronLeft size={14} /> Maintenance
        </Link>
        <span className="text-slate-300">/</span>
        <span className="text-slate-400 font-mono">{request.propertyCode}</span>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex flex-col gap-2 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="title-serif text-slate-900 truncate">{request.title}</h1>
            <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium", statusMeta.pill)}>
              <span className={cn("size-1.5 rounded-full", statusMeta.dot)} /> {statusMeta.label}
            </span>
            <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium", priorityMeta.pill)}>
              {priorityMeta.label}
            </span>
          </div>
          <div className="flex items-center gap-3 text-slate-500 text-sm min-w-0 font-medium">
            <span className="flex items-center gap-1.5 min-w-0">
              <IconMapPin size={15} className="shrink-0 text-slate-600" aria-hidden="true" />
              <Link href={`/admin/properties/${request.propertyId}`} className="truncate hover:text-slate-900 hover:underline">
                {request.propertyName}
              </Link>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {next && (
            <button
              type="button"
              onClick={advanceStatus}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium bg-[#151936] text-white hover:bg-[#1a1f42] shadow-[0_2px_10px_rgb(21,25,54,0.25)] transition-colors"
            >
              {next.label}
            </button>
          )}
          {request.status !== "done" && (
            <button
              type="button"
              onClick={() => setScheduleOpen((v) => !v)}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <IconCalendarPlus size={15} /> {request.status === "scheduled" ? "Reschedule Visit" : "Schedule Visit"}
            </button>
          )}
          <button
            type="button"
            onClick={() => setCostOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <IconCash size={15} /> Submit Cost
          </button>
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="More actions"
              className="size-[38px] inline-flex items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 transition-colors shadow-xs"
            >
              <IconDotsVertical size={16} />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-[44px] z-20 w-56 bg-white border border-slate-100 rounded-2xl shadow-xl p-1.5">
                <button onClick={() => { setReassignId(request.assignedContractorId ?? ""); setReassignOpen(true); setMenuOpen(false); }} className="w-full text-left flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                  <IconTool size={15} className="text-slate-400" /> {request.assignedContractorId ? "Reassign contractor" : "Assign contractor"}
                </button>
                <div className="h-px bg-slate-100 my-1" />
                <button onClick={() => { setDeleteOpen(true); setMenuOpen(false); }} className="w-full text-left flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-rose-600 hover:bg-rose-50">
                  <IconTrash size={15} /> Delete request
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {scheduleOpen && (
        <div className="rounded-2xl p-4 flex flex-col gap-3 border border-amber-200 bg-amber-500/[0.04] shadow-sm">
          <p className="text-sm font-medium text-slate-900">{request.status === "scheduled" ? "Reschedule visit" : "Schedule visit"}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 block mb-1">Starts</label>
              <input type="datetime-local" value={scheduleStart} onChange={(e) => setScheduleStart(e.target.value)} className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:border-[#151936]/40" />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Ends</label>
              <input type="datetime-local" value={scheduleEnd} onChange={(e) => setScheduleEnd(e.target.value)} className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:border-[#151936]/40" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setScheduleOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-white rounded-xl">Cancel</button>
            <button type="button" disabled={isScheduling || !scheduleStart || !scheduleEnd} onClick={submitSchedule} className="px-4 py-2 text-sm font-medium bg-[#151936] text-white hover:bg-[#1a1f42] rounded-xl disabled:opacity-50">
              {isScheduling ? "Saving..." : "Confirm"}
            </button>
          </div>
        </div>
      )}

      {/* Image-led hero */}
      <div className="relative rounded-[28px] overflow-hidden min-h-[220px] lg:min-h-[260px] bg-[#1e2336] flex flex-col animate-fade-in-up">
        {heroImg ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={heroImg} alt={request.propertyName} className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#151936] via-[#1e2336] to-[#0c1f24]" />
        )}
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(12,15,32,0.38) 0%, rgba(12,15,32,0.08) 34%, rgba(10,13,28,0.55) 68%, rgba(8,10,22,0.9) 100%)" }} />

        {/* Floating SLA glass card */}
        <div className="hidden sm:block absolute top-6 right-6 w-[180px] bg-white/95 backdrop-blur-md rounded-2xl p-4 shadow-xl">
          <p className="label-caps text-slate-400 mb-1.5">SLA Status</p>
          <p className="text-lg font-medium leading-none" style={{ color: slaMeta.color }}>{slaMeta.label}</p>
          <div className="h-px bg-slate-100 my-2.5" />
          <div className="flex justify-between text-xs">
            <span className="text-slate-400">Target</span>
            <span className="font-mono text-slate-700">{request.sla.targetHours}h</span>
          </div>
          <div className="flex justify-between text-xs mt-1">
            <span className="text-slate-400">Elapsed</span>
            <span className="font-mono text-slate-700">{Math.round(request.sla.hoursElapsed)}h</span>
          </div>
        </div>

        <div className="relative z-10 p-6 mt-auto flex flex-col gap-1">
          <p className="font-mono text-xs text-white/60">Reported {fmtDate(request.createdAt)}{request.reportedByName ? ` by ${request.reportedByName}` : ""}</p>
          <p className="title-serif text-white text-2xl">{request.propertyName}</p>
          <p className="text-xs text-white/60">{request.propertyLocation}</p>
        </div>
      </div>

      {/* Action band */}
      {request.pendingApproval && (
        <div className="rounded-2xl p-4 flex items-center justify-between gap-4 border border-amber-200 bg-amber-500/[0.04] shadow-sm">
          <div className="flex items-start gap-3 min-w-0">
            <span className="size-9 rounded-xl bg-amber-100/80 text-amber-700 flex items-center justify-center shrink-0"><IconClock size={18} /></span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-950">
                Awaiting {request.pendingApproval.requiredApproverRole.toUpperCase()} approval
                {request.pendingApproval.amountKes ? ` for ${formatCompactKES(parseFloat(request.pendingApproval.amountKes))}` : ""}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">Review this in the Approvals Queue to decide.</p>
            </div>
          </div>
          <Link href="/admin/approvals" className="rounded-xl px-4 py-1.5 text-xs font-medium whitespace-nowrap bg-[#f3df27] text-[#151936] hover:bg-[#e6d220] shadow-sm">
            Review
          </Link>
        </div>
      )}
      {!request.pendingApproval && request.sla.state === "breached" && request.status !== "done" && (
        <div className="rounded-2xl p-4 flex items-center gap-3 border border-rose-200 bg-rose-500/[0.04] shadow-sm">
          <span className="size-9 rounded-xl bg-rose-100/80 text-rose-700 flex items-center justify-center shrink-0"><IconFlame size={18} /></span>
          <p className="text-sm font-medium text-slate-950">SLA breached - {Math.round(request.sla.hoursElapsed)}h elapsed against a {request.sla.targetHours}h target.</p>
        </div>
      )}

      {/* Vitals */}
      <div className="gsap-stagger grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {(() => {
          const statusTone: VitalTone = request.status === "done" ? "emerald" : request.status === "awaiting_approval" ? "amber" : "neutral";
          const priorityTone: VitalTone = request.priority === "critical" ? "rose" : request.priority === "urgent" ? "amber" : "neutral";
          const slaTone: VitalTone = request.sla.state === "breached" ? "rose" : request.sla.state === "at_risk" ? "amber" : "emerald";
          const costTone: VitalTone = costVsAuthority && costVsAuthority > 1 ? "amber" : "neutral";
          const vitals: Array<{ label: string; value: string; sub?: string; icon: typeof IconTool; tone: VitalTone }> = [
            { label: "Status", value: statusMeta.label, icon: IconTool, tone: statusTone },
            { label: "Severity", value: priorityMeta.label, icon: IconAlertTriangle, tone: priorityTone },
            { label: "SLA", value: slaMeta.label, sub: `${request.sla.targetHours}h target`, icon: IconClock, tone: slaTone },
            {
              label: "Cost",
              value: request.actualCostKes != null ? formatCompactKES(request.actualCostKes) : request.estimatedCostKes != null ? formatCompactKES(request.estimatedCostKes) : "—",
              sub: request.maintenanceAuthorityKes != null ? `of ${formatCompactKES(request.maintenanceAuthorityKes)} authority` : undefined,
              icon: IconCash,
              tone: costTone,
            },
          ];
          return vitals.map((v) => (
            <div key={v.label} className={cn("relative overflow-hidden rounded-2xl border p-5 shadow-sm h-[120px] flex flex-col justify-between group", VITAL_TONE_BG[v.tone])}>
              <v.icon size={140} stroke={1} className={cn("absolute -right-6 -bottom-6 opacity-[0.03] group-hover:scale-110 group-hover:opacity-[0.05] transition-all duration-500 pointer-events-none", VITAL_TONE_ARTWORK[v.tone])} aria-hidden="true" />
              <span className="text-xs text-slate-400 font-medium relative z-10">{v.label}</span>
              <div className="relative z-10 flex flex-col gap-1.5">
                <span className={cn("font-mono font-medium text-xl leading-none", VITAL_TONE_VALUE[v.tone])}>{v.value}</span>
                {v.sub && <span className={cn("mono-data text-[10.5px] font-medium inline-flex items-center px-1.5 py-0.5 rounded-md w-fit", VITAL_TONE_BADGE_BG[v.tone])}>{v.sub}</span>}
              </div>
            </div>
          ));
        })()}
      </div>

      {/* Tabs + rail */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        <div className="min-w-0 flex flex-col gap-4">
          <div className="flex items-center gap-1 border-b border-slate-100 pb-px overflow-x-auto">
            {([{ key: "overview", label: "Overview", icon: IconFileText }, { key: "activity", label: "Activity", icon: IconHistory }] as const).map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "flex items-center gap-1.5 px-3.5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap",
                  activeTab === tab.key ? "border-[#151936] text-[#151936]" : "border-transparent text-slate-400 hover:text-slate-700"
                )}
              >
                <tab.icon size={15} /> {tab.label}
              </button>
            ))}
          </div>

          {activeTab === "overview" && (
            <div className="bg-white border border-slate-100 rounded-[24px] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col gap-4">
              <div>
                <span className="text-xs font-medium uppercase tracking-wider text-slate-400 mb-1.5 font-mono block">Description</span>
                <p className="text-desc-secondary whitespace-pre-wrap">{request.description}</p>
              </div>
              {request.dueAt && (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <IconCalendarClock size={15} className="text-slate-400" /> Due {fmtDate(request.dueAt)}
                </div>
              )}
              {request.resolvedAt && (
                <div className="flex items-center gap-2 text-sm text-emerald-700">
                  <IconTool size={15} /> Resolved {fmtDateTime(request.resolvedAt)}
                </div>
              )}
            </div>
          )}

          {activeTab === "activity" && (
            <div className="bg-white border border-slate-100 rounded-[24px] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
              {activity !== null && activity.length > 0 && (
                <div className="relative mb-5">
                  <IconSearch size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search activity logs..."
                    value={activityQuery}
                    onChange={(e) => setActivityQuery(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 text-sm rounded-xl pl-9 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#151936]/20 transition-all placeholder:text-slate-400"
                  />
                </div>
              )}
              {activity === null ? (
                <div className="flex items-center justify-center py-12"><LoadingSpinner /></div>
              ) : activity.length === 0 ? (
                <div className="flex flex-col items-center py-12 text-center gap-3">
                  <IconMoodEmpty size={28} className="text-slate-300" />
                  <p className="text-desc-secondary">No activity recorded yet.</p>
                </div>
              ) : (() => {
                const q = activityQuery.trim().toLowerCase();
                const filtered = q ? activity.filter((a) => a.summary.toLowerCase().includes(q) || a.actorName?.toLowerCase().includes(q)) : activity;
                if (filtered.length === 0) {
                  return (
                    <div className="flex flex-col items-center py-10 text-center gap-2">
                      <IconSearch size={20} className="text-slate-300" />
                      <p className="text-sm font-medium text-slate-700">No logs match your search</p>
                    </div>
                  );
                }
                const toneFor = (summary: string) => {
                  const lower = summary.toLowerCase();
                  if (lower.includes("delet") || lower.includes("cancel")) return "bg-rose-300 ring-rose-50";
                  if (lower.includes("approv") || lower.includes("complet")) return "bg-emerald-300 ring-emerald-50";
                  if (lower.includes("updat") || lower.includes("mov") || lower.includes("schedul")) return "bg-indigo-300 ring-indigo-50";
                  return "bg-slate-200 ring-white";
                };
                return (
                  <div className="flex flex-col gap-4 relative ml-1">
                    <div className="absolute left-[3.5px] top-2 bottom-6 w-px bg-slate-200 z-0" />
                    {filtered.map((entry) => (
                      <div key={entry.id} className="relative flex items-start gap-3 z-10">
                        <span className={cn("size-[8px] rounded-full mt-1.5 shrink-0 ring-4", toneFor(entry.summary))} />
                        <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-3 bg-slate-50/50 -my-1 -mx-2 p-2 rounded-xl">
                          <p className="text-sm text-slate-600 leading-snug flex-1 min-w-0">
                            {entry.actorName && <span className="font-medium text-slate-800">{entry.actorName} </span>}
                            {entry.summary.replace(entry.actorName ?? "", "").replace(/^ - |^ — /, "").trim()}
                          </p>
                          <Badge tone="neutral" className="shrink-0 whitespace-nowrap w-fit">{relativeTime(entry.createdAt)}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}
        </div>

        {/* Rail */}
        <div className="gsap-stagger flex flex-col gap-4">
          <div className="bg-white border border-slate-100 rounded-[24px] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-400 mb-3 font-mono block">Reported By</span>
            {request.reportedByName ? (
              <div className="flex items-center gap-3">
                <span className="size-10 rounded-full bg-slate-100 text-slate-700 text-sm font-medium flex items-center justify-center shrink-0"><IconUser size={16} /></span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{request.reportedByName}</p>
                  {request.reportedByPhone && <a href={`tel:${request.reportedByPhone}`} className="text-xs text-slate-500 hover:text-slate-900 flex items-center gap-1 mt-0.5"><IconPhone size={11} /> {request.reportedByPhone}</a>}
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-400">Not on file</p>
            )}
          </div>

          <div className="bg-white border border-slate-100 rounded-[24px] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium uppercase tracking-wider text-slate-400 font-mono block">Contractor</span>
              <button type="button" onClick={() => { setReassignId(request.assignedContractorId ?? ""); setReassignOpen(true); }} className="label-caps text-slate-400 hover:text-[#122a20] transition-colors">
                {request.assignedContractorId ? "Reassign" : "Assign"}
              </button>
            </div>
            {request.assignedContractorName ? (
              <div className="flex items-center gap-3">
                <span className="size-10 rounded-full bg-[#151936]/10 text-[#151936] text-sm font-medium flex items-center justify-center shrink-0"><IconTool size={16} /></span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{request.assignedContractorName}</p>
                  {request.contractorSpecialty && <p className="text-xs text-slate-500 truncate">{String(request.contractorSpecialty)}</p>}
                  {request.assignedContractorPhone && <a href={`tel:${request.assignedContractorPhone}`} className="text-xs text-slate-500 hover:text-slate-900 flex items-center gap-1 mt-0.5"><IconPhone size={11} /> {request.assignedContractorPhone}</a>}
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-400">Unassigned</p>
            )}
          </div>

          <div className="bg-white border border-slate-100 rounded-[24px] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-400 mb-3 font-mono block">Property</span>
            <div className="flex items-center gap-3">
              <span className="size-10 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center shrink-0"><IconBuildingCommunity size={16} /></span>
              <div className="min-w-0 flex-1">
                <Link href={`/admin/properties/${request.propertyId}`} className="text-sm font-medium text-slate-900 truncate hover:underline block">{request.propertyName}</Link>
                <p className="text-xs text-slate-500 truncate">{request.propertyManagerName ?? "No manager assigned"}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Reassign contractor modal */}
      {reassignOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={(e) => e.target === e.currentTarget && setReassignOpen(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-heading-primary">Assign Contractor</h2>
              <button type="button" onClick={() => setReassignOpen(false)} className="text-slate-400 hover:text-slate-700"><IconX size={16} /></button>
            </div>
            <select
              value={reassignId}
              onChange={(e) => setReassignId(e.target.value)}
              className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-body-primary focus:outline-none focus:border-[#151936]/40 mb-4"
            >
              <option value="">Unassigned</option>
              {contractors.map((c) => <option key={c.id} value={c.id}>{c.displayName}</option>)}
            </select>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setReassignOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl">Cancel</button>
              <button type="button" onClick={submitReassign} className="px-4 py-2 text-sm font-medium bg-[#151936] text-white hover:bg-[#1a1f42] rounded-xl">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Submit cost modal */}
      {costOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={(e) => e.target === e.currentTarget && setCostOpen(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-heading-primary">Submit Cost</h2>
              <button type="button" onClick={() => setCostOpen(false)} className="text-slate-400 hover:text-slate-700"><IconX size={16} /></button>
            </div>
            <p className="text-desc-secondary mb-4">
              {request.maintenanceAuthorityKes != null
                ? `Auto-approved up to KES ${request.maintenanceAuthorityKes.toLocaleString()} (this mandate's authority). Above that routes to GM or CEO based on amount.`
                : "No mandate authority configured for this property - routes to GM or CEO based on amount."}
            </p>
            <input
              type="number"
              value={costInput}
              onChange={(e) => setCostInput(e.target.value)}
              placeholder="Cost in KES"
              className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-body-primary focus:outline-none focus:border-[#151936]/40 mb-4 mono-data"
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setCostOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl">Cancel</button>
              <button type="button" disabled={submittingCost} onClick={submitCost} className="px-4 py-2 text-sm font-medium bg-[#f3df27] text-[#151936] hover:bg-[#e6d220] rounded-xl disabled:opacity-50">
                {submittingCost ? "Submitting..." : "Submit"}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={confirmDelete}
        title="Delete maintenance request?"
        description="This permanently removes the request and its activity history. This cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        tone="danger"
      />
    </PageTransition>
  );
}
