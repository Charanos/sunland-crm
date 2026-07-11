"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  IconAlertTriangle,
  IconBuildingCommunity,
  IconCalendarEvent,
  IconChevronRight,
  IconClockExclamation,
  IconDotsVertical,
  IconEye,
  IconFlame,
  IconMail,
  IconMapPin,
  IconPhone,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconTool,
  IconTrash,
  IconUser,
} from "@tabler/icons-react";
import {
  Badge,
  BoardHeader,
  Button,
  ConfirmDialog,
  Drawer,
  DropdownItem,
  DropdownMenu,
  PaginationControls,
} from "@/components/ui/erp-primitives";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { PageTransition } from "@/components/shared/page-transition";
import { useToast } from "@/components/ui/toast-provider";
import { cn } from "@/lib/utils/cn";
import { ReportIssueModal } from "./report-issue-modal";
import { PortfolioHubNav } from "./portfolio-hub-nav";

// ── Types (mirror the real /api/maintenance-requests response shape) ──────────

type Priority = "low" | "normal" | "high" | "critical";
type Status = "open" | "assigned" | "in_progress" | "resolved" | "closed";

interface MaintenanceRequestRow {
  id: string;
  entityId: string;
  propertyId: string;
  propertyName: string;
  propertyCode: string;
  title: string;
  description: string;
  priority: Priority;
  status: Status;
  dueAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  reportedByContactId: string | null;
  reportedByName: string | null;
  assignedContractorId: string | null;
  assignedContractorName: string | null;
}

interface ContractorOption {
  id: string;
  displayName: string;
  phone: string | null;
  email: string | null;
}

interface ActivityEntry {
  id: string;
  actorName: string;
  action: string;
  summary: string;
  createdAt: string;
}

// ── Display metadata ───────────────────────────────────────────────────────────

const PRIORITY_META: Record<Priority, { label: string; tone: "neutral" | "warning" | "risk" }> = {
  low: { label: "Low", tone: "neutral" },
  normal: { label: "Normal", tone: "neutral" },
  high: { label: "High", tone: "warning" },
  critical: { label: "Critical", tone: "risk" },
};

const STATUS_META: Record<Status, { label: string; tone: "neutral" | "data" | "warning" | "success" | "primary" }> = {
  open: { label: "Open", tone: "warning" },
  assigned: { label: "Assigned", tone: "data" },
  in_progress: { label: "In Progress", tone: "primary" },
  resolved: { label: "Resolved", tone: "success" },
  closed: { label: "Closed", tone: "neutral" },
};

// Each active stage advances to exactly one next stage — a request never
// needs to be told which status comes next.
const NEXT_STAGE: Partial<Record<Status, { status: Status; label: string }>> = {
  open: { status: "in_progress", label: "Start Progress" },
  assigned: { status: "in_progress", label: "Start Progress" },
  in_progress: { status: "resolved", label: "Mark Resolved" },
  resolved: { status: "closed", label: "Close Request" },
};

const STATUS_FILTERS: Array<{ id: Status | "all"; label: string }> = [
  { id: "all", label: "All" },
  { id: "open", label: "Open" },
  { id: "assigned", label: "Assigned" },
  { id: "in_progress", label: "In Progress" },
  { id: "resolved", label: "Resolved" },
  { id: "closed", label: "Closed" },
];

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" });
}

function isOverdue(row: MaintenanceRequestRow): boolean {
  return !!row.dueAt && new Date(row.dueAt) < new Date() && row.status !== "resolved" && row.status !== "closed";
}

// ── Board ──────────────────────────────────────────────────────────────────────

export function MaintenanceBoard({ entityId = "group" }: { entityId?: string }) {
  const { pushToast } = useToast();

  const [requests, setRequests] = useState<MaintenanceRequestRow[]>([]);
  const [contractors, setContractors] = useState<ContractorOption[]>([]);
  const [loading, setLoading] = useState(true);

  const [statusFilter, setStatusFilter] = useState<Status | "all">("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const rowsPerPage = 8;

  const [logRequestOpen, setLogRequestOpen] = useState(false);
  const [selected, setSelected] = useState<MaintenanceRequestRow | null>(null);
  const [reassignContractorId, setReassignContractorId] = useState("");
  const [isReassigning, setIsReassigning] = useState(false);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadRequests = useCallback(async () => {
    Promise.resolve().then(() => setLoading(true));
    try {
      const res = await fetch(`/api/maintenance-requests?entityId=${entityId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load maintenance requests");
      setRequests(data.maintenanceRequests ?? []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load maintenance requests";
      pushToast({ tone: "warning", title: "Error", body: message });
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
        .catch(() => {});
    });
  }, [loadRequests, entityId]);

  const contractorName = useCallback(
    (id: string | null) => (id ? contractors.find((c) => c.id === id)?.displayName ?? "—" : "—"),
    [contractors],
  );

  // ── Derived analytics ────────────────────────────────────────────────────────

  const kpis = useMemo(() => {
    const openCount = requests.filter((r) => r.status === "open").length;
    const inProgressCount = requests.filter((r) => r.status === "in_progress").length;
    const criticalCount = requests.filter(
      (r) => r.priority === "critical" && r.status !== "resolved" && r.status !== "closed",
    ).length;
    const overdueCount = requests.filter(isOverdue).length;
    return { openCount, inProgressCount, criticalCount, overdueCount };
  }, [requests]);

  const statusCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of requests) counts.set(r.status, (counts.get(r.status) ?? 0) + 1);
    return counts;
  }, [requests]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return requests
      .filter((r) => statusFilter === "all" || r.status === statusFilter)
      .filter((r) => {
        if (!q) return true;
        return [r.title, r.propertyName, r.propertyCode, r.reportedByName, r.assignedContractorName]
          .some((s) => s?.toLowerCase().includes(q));
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [requests, statusFilter, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const visible = filtered.slice((page - 1) * rowsPerPage, page * rowsPerPage);

  // ── Mutations ────────────────────────────────────────────────────────────────

  const patchRequest = async (id: string, patch: Record<string, unknown>, successBody: string) => {
    try {
      const res = await fetch(`/api/maintenance-requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update maintenance request");
      pushToast({ tone: "success", title: "Updated", body: successBody });
      loadRequests();
      return data.maintenanceRequest as MaintenanceRequestRow;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update maintenance request";
      pushToast({ tone: "warning", title: "Error", body: message });
      return null;
    }
  };

  const openDrawer = (row: MaintenanceRequestRow) => {
    setSelected(row);
    setReassignContractorId(row.assignedContractorId ?? "");
    setActivity([]);
    setActivityLoading(true);
    fetch(`/api/audit?entityId=${row.entityId}&associatedType=maintenance_request&associatedId=${row.id}&limit=10`)
      .then((r) => r.json())
      .then((d) => setActivity(Array.isArray(d.entries) ? d.entries : []))
      .catch(() => setActivity([]))
      .finally(() => setActivityLoading(false));
  };

  const handleReassign = async () => {
    if (!selected) return;
    setIsReassigning(true);
    const updated = await patchRequest(
      selected.id,
      { assignedContractorId: reassignContractorId || null },
      reassignContractorId ? `Assigned to ${contractorName(reassignContractorId)}.` : "Contractor unassigned.",
    );
    setIsReassigning(false);
    if (updated) setSelected(updated);
  };

  const handleDelete = async () => {
    if (!deleteConfirmId) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/maintenance-requests/${deleteConfirmId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete maintenance request");
      pushToast({ tone: "success", title: "Deleted", body: "Maintenance request removed." });
      loadRequests();
      if (selected?.id === deleteConfirmId) setSelected(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete maintenance request";
      pushToast({ tone: "warning", title: "Error", body: message });
    } finally {
      setIsDeleting(false);
      setDeleteConfirmId(null);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <PageTransition className="mx-auto flex max-w-[98rem] flex-col gap-5">
      <BoardHeader
        eyebrow={<Badge tone="data">Operations</Badge>}
        title="Maintenance"
        description="Prioritize maintenance issues by property, contractor, urgency, age, and resolution status."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={loadRequests}>
              <IconRefresh size={14} /> Refresh
            </Button>
            <Button size="sm" onClick={() => setLogRequestOpen(true)}>
              <IconPlus size={14} /> Log Request
            </Button>
          </div>
        }
      />

      <PortfolioHubNav active="maintenance" />

      <div className="flex items-center gap-4 mt-2">
        <hr className="flex-1 border-slate-200/60" />
        <span className="label-caps text-slate-400 tracking-wider">Maintenance Command</span>
        <hr className="flex-1 border-slate-200/60" />
      </div>

      {/* ── Dense, High-Contrast Dark KPI Tier ── */}
      <div className="gsap-stagger bg-tertiary-gradient border border-[#122a20]/80 p-1.5 rounded-[24px] shadow-xl relative overflow-hidden group">
        <div className="absolute right-0 top-0 size-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-emerald-500/20 transition-colors duration-700 -z-10" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-white/10">
          <div className="p-5 sm:p-6 flex flex-col justify-between">
            <div className="flex items-center gap-3 mb-4">
              <div className="size-8 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 border border-amber-500/20 shadow-sm">
                <IconTool size={16} />
              </div>
              <span className="body-sm text-slate-400">Open</span>
            </div>
            <span className="mono-stat text-white text-[32px] leading-none tracking-tight">{kpis.openCount}</span>
          </div>

          <div className="p-5 sm:p-6 flex flex-col justify-between">
            <div className="flex items-center gap-3 mb-4">
              <div className="size-8 rounded-xl bg-sky-500/10 flex items-center justify-center text-sky-400 border border-sky-500/20 shadow-sm">
                <IconClockExclamation size={16} />
              </div>
              <span className="body-sm text-slate-400">In Progress</span>
            </div>
            <span className="mono-stat text-white text-[32px] leading-none tracking-tight">{kpis.inProgressCount}</span>
          </div>

          <div className="p-5 sm:p-6 flex flex-col justify-between">
            <div className="flex items-center gap-3 mb-4">
              <div className="size-8 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-400 border border-rose-500/20 shadow-sm">
                <IconFlame size={16} />
              </div>
              <span className="body-sm text-slate-400">Critical</span>
            </div>
            <span className="mono-stat text-white text-[32px] leading-none tracking-tight">{kpis.criticalCount}</span>
          </div>

          <div className="p-5 sm:p-6 flex flex-col justify-between">
            <div className="flex items-center gap-3 mb-4">
              <div className="size-8 rounded-xl bg-white/5 flex items-center justify-center text-slate-300 border border-white/10 shadow-sm">
                <IconAlertTriangle size={16} />
              </div>
              <span className="body-sm text-slate-400">Overdue</span>
            </div>
            <span className="mono-stat text-white text-[32px] leading-none tracking-tight">{kpis.overdueCount}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 mt-4">
        <hr className="flex-1 border-slate-200/60" />
        <span className="label-caps text-slate-400 tracking-wider">Request Queue</span>
        <hr className="flex-1 border-slate-200/60" />
      </div>

      {/* ── Data Tier: Request Queue ── */}
      <div className="bg-transparent lg:bg-white border-transparent lg:border-slate-100 p-0 lg:p-8 rounded-none lg:rounded-[24px] shadow-none lg:shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b-0 lg:border-b border-slate-100 pb-2 lg:pb-5 mb-4 lg:mb-5">
          <div className="w-full md:w-auto md:flex-1 max-w-md">
            <div className="relative flex items-center group w-full">
              <IconSearch size={16} className="absolute left-3.5 text-slate-400 group-focus-within:text-[#151936] transition-colors" />
              <input
                value={query}
                onChange={(e) => { setQuery(e.target.value); setPage(1); }}
                placeholder="Search by title, property, reporter, or contractor…"
                className="w-full bg-slate-50 border border-slate-200/60 rounded-xl pl-10 pr-4 py-2.5 body-sm text-slate-900 outline-none placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-[#151936]/10 focus:border-[#151936]/30 transition-all shadow-sm"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-2 md:pb-0 -mx-4 px-4 md:mx-0 md:px-0">
            <div className="flex bg-slate-100 p-1 rounded-xl shrink-0">
              {STATUS_FILTERS.map((f) => {
                const count = f.id === "all" ? requests.length : (statusCounts.get(f.id) ?? 0);
                return (
                  <button
                    key={f.id}
                    onClick={() => { setStatusFilter(f.id); setPage(1); }}
                    className={cn(
                      "px-3 py-1.5 body-sm font-medium rounded-lg transition-colors flex items-center gap-1.5",
                      statusFilter === f.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700",
                    )}
                  >
                    {f.label}
                    {count > 0 && (
                      <span
                        className={cn(
                          "text-xs font-mono px-1.5 py-0.5 rounded-full",
                          statusFilter === f.id ? "bg-[#f3df27] text-[#151936]" : "bg-slate-200/70 text-slate-500",
                        )}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <LoadingSpinner size="lg" />
          </div>
        ) : requests.length === 0 ? (
          <div className="py-12">
            <EmptyState
              icon={IconTool}
              title="No maintenance queue"
              description="Open maintenance requests will appear here with their current assignment and risk level."
              action="Log Request"
              onClick={() => setLogRequestOpen(true)}
            />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12">
            <EmptyState
              icon={IconSearch}
              title="Nothing matches"
              description="No requests match the current filter or search."
              action="Clear Filters"
              onClick={() => { setStatusFilter("all"); setQuery(""); setPage(1); }}
            />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Mobile/Tablet Card Grid */}
            <div className="block lg:hidden space-y-4">
              {visible.map((r) => {
                const priority = PRIORITY_META[r.priority];
                const status = STATUS_META[r.status];
                const overdue = isOverdue(r);
                return (
                  <div
                    key={r.id}
                    onClick={() => openDrawer(r)}
                    className="p-5 bg-white border border-slate-100 rounded-2xl shadow-sm hover:shadow-md transition-all flex flex-col gap-4 relative cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="size-11 shrink-0 rounded-xl border bg-slate-50 border-slate-200 text-slate-500 flex items-center justify-center">
                          <IconTool size={18} />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-title-primary leading-snug truncate">{r.title}</h4>
                          <span className="mono-data text-slate-400 text-xs">{r.propertyName}</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <Badge tone={status.tone}>{status.label}</Badge>
                        {overdue && <Badge tone="risk">Overdue</Badge>}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-y-3 gap-x-2 text-xs border-t border-slate-50 pt-3">
                      <div>
                        <p className="label-caps text-slate-400 mb-0.5">Priority</p>
                        <Badge tone={priority.tone}>{priority.label}</Badge>
                      </div>
                      <div>
                        <p className="label-caps text-slate-400 mb-0.5">Contractor</p>
                        <span className="body-sm text-slate-700 block truncate">{contractorName(r.assignedContractorId)}</span>
                      </div>
                      <div>
                        <p className="label-caps text-slate-400 mb-0.5">Reported</p>
                        <span className="body-sm text-slate-700 block truncate">{fmtDate(r.createdAt)}</span>
                      </div>
                      <div>
                        <p className="label-caps text-slate-400 mb-0.5">Due</p>
                        <span className="body-sm text-slate-700 block truncate">{fmtDate(r.dueAt)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table */}
            <div className="hidden lg:block overflow-x-auto custom-scrollbar pb-2">
              <table className="w-full min-w-[950px] text-left">
                <thead>
                  <tr className="border-b border-slate-100 label-caps text-slate-500 bg-slate-50/50">
                    <th className="px-4 py-3">Request</th>
                    <th className="px-4 py-3">Property</th>
                    <th className="px-4 py-3">Contractor</th>
                    <th className="px-4 py-3 text-center">Priority</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3">Due</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visible.map((r) => {
                    const priority = PRIORITY_META[r.priority];
                    const status = STATUS_META[r.status];
                    const nextStage = NEXT_STAGE[r.status];
                    const overdue = isOverdue(r);
                    return (
                      <tr
                        key={r.id}
                        className="transition-colors hover:bg-slate-50/80 group cursor-pointer"
                        onClick={() => openDrawer(r)}
                      >
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <div className="size-9 shrink-0 rounded-lg border bg-slate-50 border-slate-200 text-slate-500 flex items-center justify-center">
                              <IconTool size={16} />
                            </div>
                            <div className="min-w-0">
                              <p className="text-title-primary truncate">{r.title}</p>
                              <p className="text-meta-muted mt-0.5 truncate">Reported {fmtDate(r.createdAt)}{r.reportedByName ? ` by ${r.reportedByName}` : ""}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 body-sm text-slate-600 whitespace-nowrap">
                          <span className="flex items-center gap-1.5">
                            <IconMapPin size={12} className="text-slate-300" /> {r.propertyName}
                          </span>
                        </td>
                        <td className="px-4 py-4 body-sm text-slate-600 whitespace-nowrap">
                          <span className="flex items-center gap-1.5">
                            <IconUser size={13} className="text-slate-300" /> {contractorName(r.assignedContractorId)}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <Badge tone={priority.tone}>{priority.label}</Badge>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <Badge tone={status.tone}>{status.label}</Badge>
                            {overdue && <Badge tone="risk">Overdue</Badge>}
                          </div>
                        </td>
                        <td className="px-4 py-4 body-sm text-slate-600 whitespace-nowrap">{fmtDate(r.dueAt)}</td>
                        <td className="px-4 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu
                            label="Request actions"
                            trigger={
                              <div
                                className="p-1.5 rounded-md text-slate-400 hover:bg-white hover:shadow-sm hover:text-slate-900 transition-all border border-transparent hover:border-slate-200"
                                aria-label="Request actions"
                              >
                                <IconDotsVertical size={16} />
                              </div>
                            }
                            align="right"
                          >
                            {nextStage && (
                              <DropdownItem
                                icon={IconChevronRight}
                                onClick={() => patchRequest(r.id, { status: nextStage.status }, `"${r.title}" → ${STATUS_META[nextStage.status].label}.`)}
                              >
                                {nextStage.label}
                              </DropdownItem>
                            )}
                            <DropdownItem icon={IconEye} onClick={() => openDrawer(r)}>
                              View & Assign
                            </DropdownItem>
                            <div className="my-1 h-px bg-slate-100" />
                            <DropdownItem icon={IconTrash} variant="danger" onClick={() => setDeleteConfirmId(r.id)}>
                              Delete
                            </DropdownItem>
                          </DropdownMenu>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="border-t border-slate-100 pt-5">
              <PaginationControls
                currentPage={page}
                totalPages={totalPages}
                onPageChange={setPage}
                label={`${filtered.length} request${filtered.length === 1 ? "" : "s"}`}
              />
            </div>
          </div>
        )}
      </div>

      <ReportIssueModal
        open={logRequestOpen}
        entityId={entityId}
        onClose={() => setLogRequestOpen(false)}
        onCreated={loadRequests}
      />

      <ConfirmDialog
        open={!!deleteConfirmId}
        onClose={() => setDeleteConfirmId(null)}
        onConfirm={handleDelete}
        title="Delete Maintenance Request"
        description="Are you sure you want to delete this maintenance request? This action cannot be undone."
        confirmLabel="Delete Request"
        tone="danger"
        isLoading={isDeleting}
      />

      <Drawer open={!!selected} onClose={() => setSelected(null)} title={selected?.title ?? "Maintenance Request"} width="34rem">
        {selected && (
          <div className="flex flex-col gap-5">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge tone={STATUS_META[selected.status].tone}>{STATUS_META[selected.status].label}</Badge>
              <Badge tone={PRIORITY_META[selected.priority].tone}>{PRIORITY_META[selected.priority].label} Priority</Badge>
              {isOverdue(selected) && <Badge tone="risk">Overdue</Badge>}
            </div>

            {NEXT_STAGE[selected.status] && (
              <Button
                size="sm"
                className="self-start"
                onClick={async () => {
                  const next = NEXT_STAGE[selected.status]!;
                  const updated = await patchRequest(selected.id, { status: next.status }, `"${selected.title}" → ${STATUS_META[next.status].label}.`);
                  if (updated) setSelected(updated);
                }}
              >
                <IconChevronRight size={14} className="mr-1" /> {NEXT_STAGE[selected.status]!.label}
              </Button>
            )}

            <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4">
              <p className="label-caps text-slate-400 mb-1.5">Property</p>
              <Link href={`/admin/properties/${selected.propertyId}`} className="text-body-primary text-[#122a20] hover:underline flex items-center gap-1.5">
                <IconBuildingCommunity size={14} /> {selected.propertyName}
              </Link>
            </div>

            <div>
              <p className="label-caps text-slate-400 mb-1.5">Description</p>
              <p className="text-body-regular text-slate-700 whitespace-pre-line">{selected.description}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="label-caps text-slate-400 mb-1.5">Reported</p>
                <p className="text-body-regular text-slate-700">{fmtDate(selected.createdAt)}</p>
                {selected.reportedByName && <p className="text-meta-muted mt-0.5">by {selected.reportedByName}</p>}
              </div>
              <div>
                <p className="label-caps text-slate-400 mb-1.5">Due Date</p>
                <p className="text-body-regular text-slate-700 flex items-center gap-1.5">
                  <IconCalendarEvent size={13} className="text-slate-400" /> {fmtDate(selected.dueAt)}
                </p>
              </div>
              {selected.resolvedAt && (
                <div>
                  <p className="label-caps text-slate-400 mb-1.5">Resolved</p>
                  <p className="text-body-regular text-slate-700">{fmtDate(selected.resolvedAt)}</p>
                </div>
              )}
            </div>

            <div className="border-t border-slate-100 pt-4">
              <p className="label-caps text-slate-400 mb-2">Assign Contractor</p>
              <div className="flex items-center gap-2">
                <select
                  value={reassignContractorId}
                  onChange={(e) => setReassignContractorId(e.target.value)}
                  className="flex-1 px-3.5 py-2.5 text-slate-800 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-[#151936]/40 focus:ring-1 focus:ring-[#151936]/10 transition-colors shadow-sm"
                >
                  <option value="">Unassigned</option>
                  {contractors.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.displayName}
                    </option>
                  ))}
                </select>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleReassign}
                  disabled={isReassigning || reassignContractorId === (selected.assignedContractorId ?? "")}
                >
                  {isReassigning ? "Saving..." : "Save"}
                </Button>
              </div>
              {selected.assignedContractorId &&
                (() => {
                  const c = contractors.find((x) => x.id === selected.assignedContractorId);
                  if (!c) return null;
                  return (
                    <div className="flex items-center gap-3 mt-3 text-body-regular text-slate-500">
                      {c.phone && (
                        <a href={`tel:${c.phone}`} className="flex items-center gap-1.5 hover:text-[#122a20]">
                          <IconPhone size={13} /> {c.phone}
                        </a>
                      )}
                      {c.email && (
                        <a href={`mailto:${c.email}`} className="flex items-center gap-1.5 hover:text-[#122a20]">
                          <IconMail size={13} /> {c.email}
                        </a>
                      )}
                    </div>
                  );
                })()}
            </div>

            <div className="border-t border-slate-100 pt-4">
              <p className="label-caps text-slate-400 mb-2">Activity</p>
              {activityLoading ? (
                <div className="flex items-center justify-center py-6">
                  <LoadingSpinner size="md" />
                </div>
              ) : activity.length === 0 ? (
                <p className="text-desc-secondary">No activity recorded yet.</p>
              ) : (
                <ul className="flex flex-col">
                  {activity.map((entry, i) => (
                    <li key={entry.id} className={cn("flex gap-3 pb-3", i !== activity.length - 1 && "border-b border-slate-100 mb-3")}>
                      <div className="flex flex-col items-center pt-1">
                        <span className="size-2 rounded-full bg-slate-300" aria-hidden="true" />
                        {i !== activity.length - 1 && <span className="w-px flex-1 bg-slate-100 mt-1" aria-hidden="true" />}
                      </div>
                      <div className="flex flex-col gap-0.5 pb-1">
                        <p className="text-body-regular text-slate-700">
                          <span className="text-slate-900">{entry.actorName}</span> {entry.summary}
                        </p>
                        <p className="text-meta-muted mono-data">{fmtDate(entry.createdAt)}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <Button
              variant="secondary"
              className="self-start text-rose-600 hover:bg-rose-50 hover:border-rose-200"
              onClick={() => setDeleteConfirmId(selected.id)}
            >
              <IconTrash size={14} className="mr-1.5" /> Delete Request
            </Button>
          </div>
        )}
      </Drawer>
    </PageTransition>
  );
}
