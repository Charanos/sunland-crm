"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  IconArrowUpRight,
  IconBriefcase,
  IconBuildingCommunity,
  IconDotsVertical,
  IconFlame,
  IconLayoutKanban,
  IconList,
  IconMessageCircle,
  IconPaperclip,
  IconPlus,
  IconSearch,
  IconTrash,
  IconTrendingDown,
  IconTrendingUp,
  IconX,
} from "@tabler/icons-react";
import { Avatar, Badge, BoardHeader, Button, ConfirmDialog, DropdownItem, DropdownMenu, SkeletonBlock } from "@/components/ui/erp-primitives";
import { PageTransition } from "@/components/shared/page-transition";
import { useToast } from "@/components/ui/toast-provider";
import { useUIStore } from "@/store/ui";
import { cn } from "@/lib/utils/cn";
import { formatCompactKES, formatKES } from "@/lib/utils/format";
import { LeadDetailDrawer } from "./lead-detail-drawer";
import { LeadFormModal } from "./lead-form-modal";
import {
  PRIORITY_META,
  STAGE_META,
  STAGE_ORDER,
  canMoveLeadStage,
  type PipelineLeadPriority,
  type PipelineStage,
} from "./lead-constants";

// ── Types (mirror the real /api/leads response shape) ──────────────────────────

export interface Lead {
  id: string;
  clientName: string;
  email: string;
  phone: string;
  clientAvatarUrl: string | null;
  budget: number;
  probability: number;
  propertyId: string | null;
  propertyInterest: string;
  propertyImageUrl: string | null;
  source: string;
  stage: PipelineStage;
  priority: PipelineLeadPriority;
  assignedToId: string | null;
  assignedAgent: string;
  assignedAgentAvatarUrl: string | null;
  nextActionAt: string | null;
  createdDate: string;
  createdAt: string;
  closedAt: string | null;
  notes?: string;
  noteCount: number;
  documentCount: number;
}

interface CurrentUser {
  id: string;
  name: string;
  role: string;
}

interface AgentPerformanceRow {
  userId: string;
  name: string;
  avatarUrl: string | null;
  closedDealsCount: number;
  totalValueKes: number;
  activePipelineCount: number;
  conversionRate: number;
}

const SOURCE_OPTIONS = ["referral", "walk_in", "website", "social_media", "cold_call", "existing_client", "partner", "exhibition"];

// Content-shaped loading state for the kanban, replacing a centered spinner -
// same "replace the spinner" precedent leases-board.tsx's ListRowsSkeleton /
// maintenance-board.tsx's WorkOrderRowsSkeleton established.
function PipelineColumnsSkeleton() {
  return (
    <div className="flex gap-3.5 overflow-x-auto pb-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex-1 min-w-[262px] bg-slate-50/50 rounded-2xl p-3 flex flex-col gap-2.5">
          <SkeletonBlock className="h-8 w-full rounded-xl" />
          <SkeletonBlock className="h-40 w-full rounded-2xl" />
          <SkeletonBlock className="h-40 w-full rounded-2xl" />
        </div>
      ))}
    </div>
  );
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

// Deterministic (not random) chip color from a name, so the same agent always
// gets the same color across renders/sessions without a stored color column.
const AGENT_CHIP_COLORS = ["#7c3aed", "#2A6FDB", "#047857", "#b45309", "#be123c", "#0f766e"];
function agentColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return AGENT_CHIP_COLORS[hash % AGENT_CHIP_COLORS.length];
}

export function PipelineBoard() {
  const { pushToast } = useToast();
  const { activeEntityId } = useUIStore();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [agentPerformance, setAgentPerformance] = useState<AgentPerformanceRow[]>([]);

  const [query, setQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [mineOnly, setMineOnly] = useState(false);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | undefined>(undefined);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [rowMenuId, setRowMenuId] = useState<string | null>(null);

  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<PipelineStage | null>(null);

  const loadLeads = useCallback(async () => {
    Promise.resolve().then(() => setLoading(true));
    try {
      const res = await fetch(`/api/leads?entityId=${activeEntityId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load leads");
      setLeads((data.leads ?? []) as Lead[]);
    } catch (err) {
      pushToast({ tone: "warning", title: "Error", body: err instanceof Error ? err.message : "Failed to load leads" });
    } finally {
      setLoading(false);
    }
  }, [activeEntityId, pushToast]);

  useEffect(() => {
    Promise.resolve().then(() => {
      loadLeads();
      fetch("/api/auth/me").then((r) => r.json()).then((d) => setCurrentUser(d.user ?? null)).catch(() => { });
      fetch(`/api/crm/agent-performance?entityId=${activeEntityId}`).then((r) => r.json()).then((d) => setAgentPerformance(Array.isArray(d.agents) ? d.agents : [])).catch(() => { });
    });
  }, [loadLeads, activeEntityId]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return leads.filter((l) => {
      const matchesMine = !mineOnly || !currentUser || l.assignedToId === currentUser.id;
      const matchesSource = sourceFilter === "all" || l.source === sourceFilter;
      const matchesQuery = !q || [l.clientName, l.propertyInterest, l.email].some((s) => s.toLowerCase().includes(q));
      return matchesMine && matchesSource && matchesQuery;
    });
  }, [leads, query, sourceFilter, mineOnly, currentUser]);

  // ── Real analytics - never fabricated. Deltas only where an honest
  // month-over-month comparison exists (bucketed from real closedAt); omitted
  // (not invented) where a point-in-time count has no real prior baseline. ──
  const analytics = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const open = visible.filter((l) => l.stage !== "closed_won" && l.stage !== "closed_lost");
    const openVolume = open.reduce((a, l) => a + l.budget, 0);

    const closedInRange = (start: Date, end: Date) =>
      visible.filter((l) => (l.stage === "closed_won" || l.stage === "closed_lost") && l.closedAt && new Date(l.closedAt) >= start && new Date(l.closedAt) < end);
    const closedThisMonth = closedInRange(monthStart, now);
    const closedLastMonth = closedInRange(prevMonthStart, monthStart);

    const wonValue = (rows: Lead[]) => rows.filter((l) => l.stage === "closed_won").reduce((a, l) => a + l.budget, 0);
    const wonValueThisMonth = wonValue(closedThisMonth);
    const wonValueLastMonth = wonValue(closedLastMonth);
    const wonValueDeltaPct = wonValueLastMonth > 0 ? Math.round(((wonValueThisMonth - wonValueLastMonth) / wonValueLastMonth) * 100) : null;

    const winRateOf = (rows: Lead[]) => {
      if (rows.length === 0) return null;
      return Math.round((rows.filter((l) => l.stage === "closed_won").length / rows.length) * 100);
    };
    const winRateThisMonth = winRateOf(closedThisMonth);
    const winRateLastMonth = winRateOf(closedLastMonth);
    const winRateDeltaPts = winRateThisMonth != null && winRateLastMonth != null ? winRateThisMonth - winRateLastMonth : null;

    const allClosed = visible.filter((l) => l.stage === "closed_won" || l.stage === "closed_lost");
    const winRateAllTime = winRateOf(allClosed) ?? 0;

    const avgDaysOf = (rows: Lead[]) => {
      const won = rows.filter((l) => l.stage === "closed_won" && l.closedAt);
      if (won.length === 0) return null;
      const total = won.reduce((a, l) => a + Math.max(0, (new Date(l.closedAt!).getTime() - new Date(l.createdAt).getTime()) / 86_400_000), 0);
      return Math.round(total / won.length);
    };
    const avgDaysThisMonth = avgDaysOf(closedThisMonth);
    const avgDaysLastMonth = avgDaysOf(closedLastMonth);
    const avgDaysDelta = avgDaysThisMonth != null && avgDaysLastMonth != null ? avgDaysThisMonth - avgDaysLastMonth : null;
    const avgDaysAllTime = avgDaysOf(visible);

    return {
      openVolume,
      openCount: open.length,
      wonValueThisMonth,
      wonValueDeltaPct,
      viewings: visible.filter((l) => l.stage === "viewing").length,
      offersInPlay: visible.filter((l) => l.stage === "offer" || l.stage === "negotiation").length,
      negotiationCount: visible.filter((l) => l.stage === "negotiation").length,
      winRateAllTime,
      winRateDeltaPts,
      avgDaysAllTime,
      avgDaysDelta,
    };
  }, [visible]);

  const hotDeal = useMemo(() => {
    const open = visible.filter((l) => l.stage !== "closed_won" && l.stage !== "closed_lost");
    if (open.length === 0) return null;
    return [...open].sort((a, b) => b.budget - a.budget)[0];
  }, [visible]);

  const heroSub = useMemo(() => {
    const bits: string[] = [];
    if (analytics.negotiationCount > 0) bits.push(`${analytics.negotiationCount} deal${analytics.negotiationCount === 1 ? "" : "s"} in Legal & Docs`);
    if (analytics.offersInPlay > 0) bits.push(`${analytics.offersInPlay} offer${analytics.offersInPlay === 1 ? "" : "s"} in play`);
    const lead = bits.length > 0 ? `${bits.join("; ")}. ` : "";
    return `${lead}Win rate holding at ${analytics.winRateAllTime}%.`;
  }, [analytics]);

  // ── Mutations ────────────────────────────────────────────────────────────

  const transitionStage = async (lead: Lead, target: PipelineStage, lostReason?: string) => {
    const prevStage = lead.stage;
    setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, stage: target } : l)));
    try {
      const res = await fetch(`/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "transition", entityId: activeEntityId, stage: target, lostReason }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Failed to move opportunity");
      pushToast({ tone: "success", title: `${lead.clientName} → ${STAGE_META[target].label}`, body: `${lead.assignedAgent} notified; timeline updated.` });
    } catch (err) {
      setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, stage: prevStage } : l)));
      pushToast({ tone: "warning", title: "Could not move opportunity", body: err instanceof Error ? err.message : "Try again." });
    }
  };

  const handleDrop = (e: React.DragEvent, targetStage: PipelineStage) => {
    e.preventDefault();
    const id = dragId;
    setDragId(null);
    setDragOverStage(null);
    if (!id) return;
    const lead = leads.find((l) => l.id === id);
    if (!lead || !canMoveLeadStage(lead.stage, targetStage)) return;
    transitionStage(lead, targetStage);
  };

  const handleCreateOrUpdate = async (payload: Partial<Lead>) => {
    try {
      if (editingLead) {
        const res = await fetch(`/api/leads/${editingLead.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "update",
            entityId: activeEntityId,
            propertyId: payload.propertyId ?? null,
            assignedToId: payload.assignedToId ?? null,
            expectedValueKes: payload.budget != null ? String(payload.budget) : undefined,
            priority: payload.priority,
            notes: payload.notes ?? null,
          }),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Failed to update opportunity");
        pushToast({ tone: "success", title: "Deal updated", body: `Opportunity details saved for "${payload.clientName}".` });
        setEditingLead(undefined);
      } else {
        const res = await fetch("/api/leads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            entityId: activeEntityId,
            displayName: payload.clientName || "Unknown Client",
            email: payload.email || null,
            phone: payload.phone || null,
            propertyId: payload.propertyId ?? null,
            assignedToId: payload.assignedToId ?? null,
            expectedValueKes: payload.budget != null ? String(payload.budget) : undefined,
            priority: payload.priority,
            source: payload.source ?? "website",
            notes: payload.notes ?? null,
          }),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Failed to create opportunity");
        pushToast({ tone: "success", title: "Deal created", body: `"${payload.clientName}" opens in New Inquiry.` });
      }
      setFormOpen(false);
      loadLeads();
    } catch (err) {
      pushToast({ tone: "warning", title: "Could not save opportunity", body: err instanceof Error ? err.message : "Try again." });
    }
  };

  const confirmDeleteLead = async () => {
    if (!deleteConfirmId) return;
    const lead = leads.find((l) => l.id === deleteConfirmId);
    try {
      const res = await fetch(`/api/leads/${deleteConfirmId}?entityId=${activeEntityId}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Failed to delete opportunity");
      setLeads((prev) => prev.filter((l) => l.id !== deleteConfirmId));
      pushToast({ tone: "success", title: "Deal removed", body: `"${lead?.clientName ?? "Record"}" removed from the pipeline.` });
    } catch (err) {
      pushToast({ tone: "warning", title: "Error", body: err instanceof Error ? err.message : "Try again." });
    } finally {
      setDeleteConfirmId(null);
    }
  };

  const handleBulkStageChange = async (target: PipelineStage) => {
    const ids = [...selectedIds];
    const movable = ids.filter((id) => {
      const l = leads.find((x) => x.id === id);
      return l && canMoveLeadStage(l.stage, target);
    });
    setLeads((prev) => prev.map((l) => (movable.includes(l.id) ? { ...l, stage: target } : l)));
    setSelectedIds([]);
    try {
      await Promise.all(movable.map((id) => fetch(`/api/leads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "transition", entityId: activeEntityId, stage: target }),
      })));
      pushToast({ tone: "success", title: "Batch updated", body: `Moved ${movable.length} deal${movable.length === 1 ? "" : "s"} to "${STAGE_META[target].label}".` });
    } catch (err) {
      pushToast({ tone: "warning", title: "Some updates failed", body: err instanceof Error ? err.message : "Refresh to check current state." });
    } finally {
      loadLeads();
    }
  };

  const confirmBulkDelete = async () => {
    const ids = [...selectedIds];
    try {
      await Promise.all(ids.map((id) => fetch(`/api/leads/${id}?entityId=${activeEntityId}`, { method: "DELETE" })));
      setLeads((prev) => prev.filter((l) => !ids.includes(l.id)));
      pushToast({ tone: "success", title: "Batch deleted", body: `Removed ${ids.length} opportunit${ids.length === 1 ? "y" : "ies"}.` });
    } catch (err) {
      pushToast({ tone: "warning", title: "Some deletions failed", body: err instanceof Error ? err.message : "Refresh to check current state." });
      loadLeads();
    } finally {
      setSelectedIds([]);
      setIsBulkDeleteOpen(false);
    }
  };

  const teamStack = agentPerformance.slice(0, 3);
  const teamOverflow = Math.max(0, agentPerformance.length - teamStack.length);

  return (
    <PageTransition className="mx-auto flex max-w-[98rem] flex-col gap-5">
      <BoardHeader
        eyebrow={<Badge tone="primary">Sales & Acquisition Pipeline</Badge>}
        title="Deals Pipeline"
        description="Every enquiry, viewing, offer, and closed deal across the sales desk - from first contact to signed sale."
        actions={
          <div className="flex items-center gap-3">
            <div className="flex items-center">
              {teamStack.map((a) => (
                <span key={a.userId} className="-ml-2 first:ml-0" title={a.name}>
                  <Avatar src={a.avatarUrl ?? undefined} fallback={initialsOf(a.name)} className="size-7 border-2 border-[#f4f6f0] text-[10px]" />
                </span>
              ))}
              {teamOverflow > 0 && (
                <span className="-ml-2 size-7 rounded-full bg-[#151936] text-[#f3df27] flex items-center justify-center text-[10px] font-mono font-medium border-2 border-[#f4f6f0]">
                  +{teamOverflow}
                </span>
              )}
            </div>
            <div className="flex bg-white border border-slate-100 rounded-xl p-1 gap-1">
              <Link href="/admin/contacts" className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition-colors">
                <IconBriefcase size={14} /> Contacts
              </Link>
              <span className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium bg-[#151936] text-white">
                <IconLayoutKanban size={14} /> Pipeline
              </span>
            </div>
            <Button size="sm" onClick={() => { setEditingLead(undefined); setFormOpen(true); }}>
              <IconPlus size={14} /> New Deal
            </Button>
          </div>
        }
      />

      {/* ── Hero band ── */}
      <div className="gsap-stagger grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-3">
        <div className="relative rounded-3xl overflow-hidden min-h-[170px] flex bg-gradient-to-br from-[#0c1f24] to-[#1e1b4b]">
          <div className="relative p-6 flex flex-col justify-center gap-2 max-w-[520px]">
            <span className="self-start inline-flex items-center gap-1.5 bg-[#f3df27] rounded-lg px-2.5 py-1 text-[10.5px] font-medium uppercase tracking-wider text-[#151936]">
              <IconFlame size={12} /> {new Date().toLocaleDateString("en-KE", { month: "long" })} Pipeline Pulse
            </span>
            <p className="font-serif text-2xl text-white leading-tight">
              {formatCompactKES(analytics.openVolume)} in play across {analytics.openCount} open deal{analytics.openCount === 1 ? "" : "s"}
            </p>
            <p className="text-xs text-white/75 leading-relaxed">{heroSub}</p>
          </div>
        </div>
        {hotDeal ? (
          <button
            type="button"
            onClick={() => setSelectedLeadId(hotDeal.id)}
            className="relative rounded-3xl overflow-hidden min-h-[170px] text-left shadow-[0_14px_36px_rgba(21,25,54,0.12)] hover:brightness-105 transition-all"
          >
            {hotDeal.propertyImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={hotDeal.propertyImageUrl} alt="" className="absolute inset-0 size-full object-cover" />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-slate-700 to-slate-900" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-[#0a0d1c]/85 via-[#0a0d1c]/10 to-transparent" />
            <span className="absolute top-3 left-3 inline-flex rounded-full px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider bg-white/90 text-[#be123c]">Hot Deal</span>
            <span className="absolute left-3.5 right-3.5 bottom-3">
              <span className="block text-xs font-medium text-white truncate">{hotDeal.propertyInterest}</span>
              <span className="flex items-center justify-between mt-1">
                <span className="font-mono text-sm text-[#f3df27]">{formatCompactKES(hotDeal.budget)}</span>
                <span className="text-[10.5px] text-white/70 flex items-center gap-1">{STAGE_META[hotDeal.stage].label} <IconArrowUpRight size={11} /></span>
              </span>
            </span>
          </button>
        ) : (
          <div className="rounded-3xl min-h-[170px] border border-dashed border-slate-200 bg-white/50 flex items-center justify-center text-sm text-slate-400">No open deals yet</div>
        )}
      </div>

      {/* ── Analytics strips ── */}
      <div className="gsap-stagger grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          {
            title: "Pipeline Value",
            stats: [
              { label: "Total open volume", value: formatCompactKES(analytics.openVolume) },
              { label: "Closed won MTD", value: formatCompactKES(analytics.wonValueThisMonth), deltaPct: analytics.wonValueDeltaPct },
            ],
          },
          {
            title: "Deal Activity",
            stats: [
              { label: "Active viewings", value: String(analytics.viewings) },
              { label: "Offers in play", value: String(analytics.offersInPlay) },
            ],
          },
          {
            title: "Conversion & Speed",
            stats: [
              { label: "Avg. days to close", value: analytics.avgDaysAllTime != null ? String(analytics.avgDaysAllTime) : "—", deltaPts: analytics.avgDaysDelta, invertDelta: true },
              { label: "Win rate", value: `${analytics.winRateAllTime}%`, deltaPts: analytics.winRateDeltaPts },
            ],
          },
        ].map((panel) => (
          <div key={panel.title} className="bg-white border border-slate-100 rounded-[20px] shadow-[0_8px_30px_rgba(0,0,0,0.04)] p-4">
            <p className="text-xs font-medium text-slate-700 mb-3">{panel.title}</p>
            <div className="flex gap-2.5">
              {panel.stats.map((st) => {
                const delta = "deltaPct" in st ? st.deltaPct : "deltaPts" in st ? st.deltaPts : null;
                const isGood = delta != null && ("invertDelta" in st && st.invertDelta ? delta <= 0 : delta >= 0);
                return (
                  <div key={st.label} className="flex-1 border border-slate-50 bg-[#fafbf8] rounded-xl p-2.5 min-w-0">
                    <p className="text-[11px] text-slate-400 truncate">{st.label}</p>
                    <p className="font-mono text-lg text-slate-900 leading-none mt-1.5">{st.value}</p>
                    {delta != null ? (
                      <p className={cn("flex items-center gap-1 text-[10.5px] font-medium mt-1.5", isGood ? "text-emerald-700" : "text-rose-600")}>
                        {isGood ? <IconTrendingUp size={11} /> : <IconTrendingDown size={11} />}
                        {Math.abs(delta)}{"deltaPct" in st ? "%" : "pt"} <span className="text-slate-300 font-normal">vs last month</span>
                      </p>
                    ) : (
                      <p className="text-[10.5px] text-slate-300 mt-1.5">as of today</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* ── Queue toolbar ── */}
      <div className="flex items-center justify-between gap-3 flex-wrap mt-2">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="label-caps text-slate-400">Active Deals</span>
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button type="button" onClick={() => setViewMode("kanban")} className={cn("p-1.5 rounded-lg transition-colors", viewMode === "kanban" ? "bg-white shadow-sm text-[#151936]" : "text-slate-400 hover:text-slate-700")} aria-label="Kanban view">
              <IconLayoutKanban size={16} />
            </button>
            <button type="button" onClick={() => setViewMode("list")} className={cn("p-1.5 rounded-lg transition-colors", viewMode === "list" ? "bg-white shadow-sm text-[#151936]" : "text-slate-400 hover:text-slate-700")} aria-label="List view">
              <IconList size={16} />
            </button>
          </div>
          <button
            type="button"
            onClick={() => setMineOnly((v) => !v)}
            className={cn("inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium border transition-colors", mineOnly ? "bg-[#151936] text-white border-[#151936]" : "bg-white text-slate-600 border-slate-200 hover:border-slate-300")}
          >
            {mineOnly ? "My Deals" : "All Deals"}
          </button>
          <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-600 outline-none">
            <option value="all">All Sources</option>
            {SOURCE_OPTIONS.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
          </select>
        </div>
        <div className="relative">
          <IconSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search deals…" className="w-[200px] bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 outline-none focus:border-[#151936]/30 focus:ring-2 focus:ring-[#151936]/10 transition-all" />
        </div>
      </div>

      {loading ? (
        <PipelineColumnsSkeleton />
      ) : viewMode === "kanban" ? (
        <div className="overflow-x-auto pb-2">
          <div className="grid grid-flow-col auto-cols-[262px] gap-3.5 items-start">
            {STAGE_ORDER.map((stage) => {
              const cfg = STAGE_META[stage];
              const columnCards = visible.filter((l) => l.stage === stage);
              const dragged = dragId ? leads.find((l) => l.id === dragId) : null;
              const canDrop = dragged ? canMoveLeadStage(dragged.stage, stage) : false;
              const isOver = dragOverStage === stage && canDrop;
              return (
                <div
                  key={stage}
                  className="flex flex-col gap-2.5"
                  onDragOver={(e) => { if (canDrop) { e.preventDefault(); if (dragOverStage !== stage) setDragOverStage(stage); } }}
                  onDragLeave={() => { if (dragOverStage === stage) setDragOverStage(null); }}
                  onDrop={(e) => handleDrop(e, stage)}
                >
                  <div className={cn("flex items-center justify-between bg-white border rounded-2xl px-3.5 py-2.5 transition-colors", isOver ? "" : "border-slate-100")} style={isOver ? { borderColor: cfg.color } : undefined}>
                    <span className="flex items-center gap-2 text-sm font-medium text-slate-900">
                      <span className="size-2 rounded-full inline-block" style={{ background: cfg.color }} />
                      {cfg.label}
                      <span className="font-mono text-[11px] text-slate-400">{columnCards.length}</span>
                    </span>
                  </div>
                  <div
                    className="flex flex-col gap-2.5 rounded-2xl p-0.5 transition-all"
                    style={isOver ? { background: `${cfg.color}0f`, boxShadow: `inset 0 0 0 2px ${cfg.color}55` } : undefined}
                  >
                    {columnCards.map((lead) => {
                      const prio = PRIORITY_META[lead.priority];
                      return (
                        <div
                          key={lead.id}
                          draggable={stage !== "closed_won"}
                          onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; setDragId(lead.id); }}
                          onDragEnd={() => { setDragId(null); setDragOverStage(null); }}
                          onClick={() => setSelectedLeadId(lead.id)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedLeadId(lead.id); } }}
                          className={cn("bg-white border rounded-2xl p-3 cursor-grab shadow-[0_2px_8px_rgba(0,0,0,0.03)] hover:shadow-[0_10px_26px_rgba(0,0,0,0.07)] transition-all", dragId === lead.id ? "border-[#f3df27] opacity-50" : "border-slate-100")}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-mono text-[10.5px] text-slate-400">{lead.id.slice(0, 8).toUpperCase()}</span>
                            <span className={cn("inline-flex rounded-md px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide", prio.pill)}>{prio.label}</span>
                          </div>
                          <div className="relative h-[86px] rounded-xl overflow-hidden mb-2.5 bg-slate-100">
                            {lead.propertyImageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={lead.propertyImageUrl} alt="" className="absolute inset-0 size-full object-cover" />
                            ) : (
                              <div className="absolute inset-0 flex items-center justify-center text-slate-300"><IconBuildingCommunity size={28} /></div>
                            )}
                          </div>
                          <p className="text-sm font-medium text-slate-900 leading-snug truncate">{lead.propertyInterest}</p>
                          <p className="font-mono text-[15px] text-[#122a20] mt-1">{formatCompactKES(lead.budget)}</p>
                          <div className="flex flex-col gap-0.5 mt-2 pt-2 border-t border-slate-50">
                            <div className="flex justify-between"><span className="text-[10.5px] text-slate-300">Client</span><span className="text-[11px] text-slate-500 truncate">{lead.clientName}</span></div>
                          </div>
                          <div className="flex items-center justify-between mt-2.5">
                            <span title={lead.assignedAgent} className="size-[22px] rounded-full inline-flex items-center justify-center font-mono text-[9px] text-white" style={{ background: agentColor(lead.assignedAgent) }}>
                              {initialsOf(lead.assignedAgent)}
                            </span>
                            <span className="flex gap-2.5">
                              {lead.noteCount > 0 && <span className="inline-flex items-center gap-1 text-[10.5px] text-slate-400"><IconMessageCircle size={12} /> {lead.noteCount}</span>}
                              {lead.documentCount > 0 && <span className="inline-flex items-center gap-1 text-[10.5px] text-slate-400"><IconPaperclip size={12} /> {lead.documentCount}</span>}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                    {columnCards.length === 0 && dragged && canDrop && (
                      <div className="rounded-xl p-3.5 text-center text-[11.5px] font-medium border-[1.5px] border-dashed" style={{ color: cfg.color, borderColor: `${cfg.color}66` }}>Drop here</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="bg-white border border-slate-100 rounded-3xl shadow-sm overflow-x-auto">
          <table className="w-full text-left min-w-[900px]">
            <thead>
              <tr className="border-b border-slate-100 label-caps text-slate-400 bg-slate-50/50">
                <th className="py-3 pl-5 pr-2 w-10 text-center">
                  <input type="checkbox" className="rounded border-slate-300 size-4" onChange={() => {
                    const ids = visible.map((l) => l.id);
                    const allSelected = ids.every((id) => selectedIds.includes(id));
                    setSelectedIds(allSelected ? [] : ids);
                  }} checked={visible.length > 0 && visible.every((l) => selectedIds.includes(l.id))} />
                </th>
                <th className="py-3 px-4">Client / Deal</th>
                <th className="py-3 px-4">Stage</th>
                <th className="py-3 px-4">Priority</th>
                <th className="py-3 px-4 text-right">Value</th>
                <th className="py-3 px-4">Property</th>
                <th className="py-3 px-4">Agent</th>
                <th className="py-3 px-6 text-right w-16">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {visible.map((lead) => (
                <tr key={lead.id} className={cn("hover:bg-slate-50/60 cursor-pointer transition-colors", selectedIds.includes(lead.id) && "bg-indigo-50/20")} onClick={() => setSelectedLeadId(lead.id)}>
                  <td className="py-3.5 pl-5 pr-2 text-center" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" className="rounded border-slate-300 size-4" checked={selectedIds.includes(lead.id)} onChange={() => setSelectedIds((prev) => prev.includes(lead.id) ? prev.filter((id) => id !== lead.id) : [...prev, lead.id])} />
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2.5">
                      <Avatar src={lead.clientAvatarUrl ?? undefined} fallback={initialsOf(lead.clientName)} className="size-8" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">{lead.clientName}</p>
                        <p className="text-[11px] text-slate-400 font-mono">{lead.createdDate}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-4"><span className="text-xs font-medium" style={{ color: STAGE_META[lead.stage].color }}>{STAGE_META[lead.stage].label}</span></td>
                  <td className="py-3.5 px-4"><span className={cn("inline-flex rounded-md px-2 py-0.5 text-[10px] font-medium uppercase", PRIORITY_META[lead.priority].pill)}>{PRIORITY_META[lead.priority].label}</span></td>
                  <td className="py-3.5 px-4 text-right font-mono text-sm text-slate-800">{formatKES(lead.budget)}</td>
                  <td className="py-3.5 px-4 text-sm text-slate-600 truncate max-w-[180px]">{lead.propertyInterest}</td>
                  <td className="py-3.5 px-4 text-sm text-slate-600">{lead.assignedAgent}</td>
                  <td className="py-3.5 px-6 text-right relative" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu label="Deal actions" align="right" trigger={<div className="p-1.5 rounded-lg text-slate-400 hover:bg-white hover:shadow-sm transition-all"><IconDotsVertical size={16} /></div>}>
                      <DropdownItem onClick={() => setSelectedLeadId(lead.id)}>View Details</DropdownItem>
                      <DropdownItem onClick={() => { setEditingLead(lead); setFormOpen(true); }}>Edit Deal</DropdownItem>
                      <div className="my-1 h-px bg-slate-100" />
                      <DropdownItem icon={IconTrash} variant="danger" onClick={() => setDeleteConfirmId(lead.id)}>Delete</DropdownItem>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr><td colSpan={8} className="py-14 text-center text-sm text-slate-400">No deals match the current filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {selectedIds.length > 0 && (
        <div className="fixed bottom-6 inset-x-0 mx-auto w-full max-w-2xl bg-[#151936] text-white p-4 rounded-2xl shadow-[0_20px_50px_rgba(21,25,54,0.3)] flex items-center justify-between z-[70]">
          <div className="flex items-center gap-3">
            <span className="size-6 rounded-full bg-[#f3df27] text-[#151936] flex items-center justify-center font-mono text-xs">{selectedIds.length}</span>
            <p className="text-sm font-medium">Deals selected</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative group px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-medium rounded-xl cursor-pointer">
              <span>Set Stage ▾</span>
              <div className="absolute bottom-full right-0 mb-2 w-40 bg-white border border-slate-200 rounded-xl shadow-lg text-slate-700 py-1 hidden group-hover:block max-h-40 overflow-y-auto">
                {STAGE_ORDER.map((s) => <button key={s} onClick={() => handleBulkStageChange(s)} className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50">{STAGE_META[s].label}</button>)}
              </div>
            </div>
            <button onClick={() => setIsBulkDeleteOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-xs font-medium rounded-xl"><IconTrash size={13} /> Delete</button>
            <button onClick={() => setSelectedIds([])} className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white"><IconX size={15} /></button>
          </div>
        </div>
      )}

      <LeadFormModal
        open={formOpen}
        entityId={activeEntityId}
        onClose={() => setFormOpen(false)}
        onSubmit={handleCreateOrUpdate}
        initialData={editingLead}
      />

      <LeadDetailDrawer
        leadId={selectedLeadId}
        entityId={activeEntityId}
        onClose={() => setSelectedLeadId(null)}
        onChanged={loadLeads}
      />

      <ConfirmDialog
        open={!!deleteConfirmId}
        onClose={() => setDeleteConfirmId(null)}
        onConfirm={confirmDeleteLead}
        title="Delete Opportunity?"
        description="This permanently removes the deal, its notes, and its file attachments. This action cannot be undone."
        confirmLabel="Delete Deal"
        tone="danger"
      />

      <ConfirmDialog
        open={isBulkDeleteOpen}
        onClose={() => setIsBulkDeleteOpen(false)}
        onConfirm={confirmBulkDelete}
        title="Delete Selected Deals?"
        description={`This permanently removes the ${selectedIds.length} selected deal${selectedIds.length === 1 ? "" : "s"}. This action cannot be undone.`}
        confirmLabel="Delete Deals"
        tone="danger"
      />
    </PageTransition>
  );
}
