"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  IconArrowLeft,
  IconArrowRight,
  IconAward,
  IconBriefcase,
  IconBuilding,
  IconCheck,
  IconClock,
  IconExternalLink,
  IconLayoutRows,
  IconMail,
  IconPaperclip,
  IconPercentage,
  IconPhone,
  IconSearch,
  IconUser,
  IconUserCog,
  IconX,
  IconMapPin,
  IconBuildingCommunity,
} from "@tabler/icons-react";
import Image from "next/image";
import { ActionLoadingOverlay, Avatar, Badge } from "@/components/ui/erp-primitives";
import { useToast } from "@/components/ui/toast-provider";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { formatCompactKES } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import {
  STAGE_META,
  STAGE_ORDER,
  STAGE_WIP_LIMITS,
  canMoveToStage,
  daysSince,
  scoreForValuation,
  type ValuationStage,
  stageTone,
} from "./valuation-constants";
import { ValuationDocumentModal } from "./valuation-document-modal";
import { ValuationReassignModal } from "./valuation-reassign-modal";

interface Valuation {
  id: string;
  valuationCode: string;
  propertyId: string | null;
  externalPropertyName: string | null;
  externalLocation: string | null;
  landlordContactId: string | null;
  assignedManagerId: string | null;
  valuerId: string | null;
  externalValuerName: string | null;
  isLand: boolean;
  stage: ValuationStage;
  marketValueKes: string | null;
  proposedFeeRate: string | null;
  stageEnteredAt: string;
  createdAt: string;
  propertyName: string | null;
  propertyLocation: string | null;
  propertyMedia?: Array<{ url: string; isPrimary?: boolean }> | null;
  landlordName: string | null;
  landlordEmail: string | null;
  landlordPhone: string | null;
  landlordVerifiedAt: string | null;
  landlordAvatarUrl: string | null;
  managerName: string | null;
  managerAvatarUrl: string | null;
  valuersEntityName: string | null;
}

interface AuditEntry {
  id: string;
  summary: string;
  createdAt: string;
}

function canDropInFocusBoard(from: ValuationStage, to: ValuationStage): boolean {
  if (to === "declined") return false;
  return canMoveToStage(from, to);
}

const FOCUS_COVER_POOL = [
  "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&q=80",
  "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&q=80",
  "https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800&q=80",
  "https://images.unsplash.com/photo-1605276374104-dee2a0ed3cd6?w=800&q=80",
  "https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=800&q=80",
  "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&q=80",
  "https://images.unsplash.com/photo-1523217582562-09d0def993a6?w=800&q=80",
  "https://images.unsplash.com/photo-1469022563428-aa54fca6bce1?w=800&q=80",
  "https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&q=80",
  "https://images.unsplash.com/photo-1486325212027-8081e485255e?w=800&q=80",
  "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&q=80",
  "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80",
];

const STAGE_BAR_ACCENT: Record<ValuationStage, string> = {
  requested: "bg-slate-400",
  site_visit: "bg-sky-500",
  valued: "bg-[#151936]",
  offer_sent: "bg-amber-500",
  accepted: "bg-emerald-500",
  mandate_signed: "bg-emerald-700",
  declined: "bg-rose-500",
};

export function ValuationsFocusBoard({ entityId = "group" }: { entityId?: string | null }) {
  const router = useRouter();
  const { pushToast } = useToast();

  const [valuations, setValuations] = useState<Valuation[]>([]);
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState("");
  const [mgrFilter, setMgrFilter] = useState("all");
  const [swimlaneOn, setSwimlaneOn] = useState(false);

  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<ValuationStage | null>(null);

  const [peekId, setPeekId] = useState<string | null>(null);
  const [peekTab, setPeekTab] = useState<"details" | "activity">("details");
  const [peekActivity, setPeekActivity] = useState<AuditEntry[] | null>(null);
  const [peekActivityLoading, setPeekActivityLoading] = useState(false);

  const [docModalTarget, setDocModalTarget] = useState<Valuation | null>(null);
  const [reassignOpen, setReassignOpen] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [actionLoading, setActionLoading] = useState<{ show: boolean; title?: string; description?: string }>({ show: false });

  const load = useCallback(async (silent = false) => {
    if (!silent) Promise.resolve().then(() => setLoading(true));
    try {
      const res = await fetch(`/api/valuations?entityId=${entityId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load valuations");
      setValuations(data.valuations ?? []);
    } catch (err) {
      pushToast({ tone: "error", title: "Error", body: err instanceof Error ? err.message : "Failed to load valuations" });
    } finally {
      if (!silent) setLoading(false);
    }
  }, [entityId, pushToast]);

  useEffect(() => { Promise.resolve().then(() => load()); }, [load]);

  useEffect(() => {
    if (peekTab !== "activity" || !peekId || !entityId) return;
    let active = true;
    Promise.resolve().then(() => setPeekActivityLoading(true));
    fetch(`/api/audit?entityId=${entityId}&associatedType=valuation&associatedId=${peekId}&limit=10`)
      .then((res) => (res.ok ? res.json() : { entries: [] }))
      .then((data) => { if (active) setPeekActivity(Array.isArray(data.entries) ? data.entries : []); })
      .catch(() => { if (active) setPeekActivity([]); })
      .finally(() => { if (active) setPeekActivityLoading(false); });
    return () => { active = false; };
  }, [peekTab, peekId, entityId]);

  const subjectOf = useCallback((v: Valuation) => ({
    name: v.propertyId ? (v.propertyName ?? "Portfolio property") : (v.externalPropertyName ?? "Unknown subject"),
    location: v.propertyId ? (v.propertyLocation ?? "-") : (v.externalLocation ?? "-"),
  }), []);

  const valuerLabel = useCallback((v: Valuation) => v.externalValuerName ?? (v.valuerId ? v.managerName : null) ?? v.valuersEntityName ?? "Sunland Valuers Ltd", []);

  const managerOptions = useMemo(() => Array.from(new Set(valuations.map((v) => v.managerName).filter((n): n is string => !!n))).sort(), [valuations]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return valuations.filter((v) => {
      if (mgrFilter !== "all" && v.managerName !== mgrFilter) return false;
      if (!q) return true;
      const subject = subjectOf(v);
      return [subject.name, subject.location, v.landlordName, v.valuationCode].some((s) => s?.toLowerCase().includes(q));
    });
  }, [valuations, query, mgrFilter, subjectOf]);

  const totalValue = useMemo(() => valuations.reduce((s, v) => s + (v.marketValueKes ? Number(v.marketValueKes) : 0), 0), [valuations]);

  const selCount = Object.values(selected).filter(Boolean).length;
  const selValue = useMemo(
    () => valuations.filter((v) => selected[v.id]).reduce((s, v) => s + (v.marketValueKes ? Number(v.marketValueKes) : 0), 0),
    [valuations, selected],
  );

  const scoreOf = useCallback((v: Valuation) => {
    if (STAGE_ORDER.indexOf(v.stage) < STAGE_ORDER.indexOf("valued") || !v.marketValueKes || !v.proposedFeeRate) return null;
    return scoreForValuation({
      proposedFeeRatePct: Number(v.proposedFeeRate) * 100,
      marketValueKes: Number(v.marketValueKes),
      landlordVerified: !!v.landlordVerifiedAt,
      ageDays: daysSince(v.stageEnteredAt),
    });
  }, []);

  const coverImageOf = useCallback((v: Valuation): string => {
    const primary = v.propertyMedia?.find((m) => m.isPrimary)?.url ?? v.propertyMedia?.[0]?.url;
    if (primary) return primary;
    const hash = parseInt(v.id.replace(/-/g, "").slice(-4), 16);
    return FOCUS_COVER_POOL[hash % FOCUS_COVER_POOL.length];
  }, []);

  const columns = useMemo(() => STAGE_ORDER.map((stage) => {
    const cards = filtered.filter((v) => v.stage === stage);
    const wip = STAGE_WIP_LIMITS[stage];
    return {
      stage,
      cards,
      total: cards.reduce((s, v) => s + (v.marketValueKes ? Number(v.marketValueKes) : 0), 0),
      overWip: wip > 0 && cards.length > wip,
      wip,
    };
  }), [filtered]);

  const swimlanes = swimlaneOn ? managerOptions.length > 0 ? [...managerOptions, "Unassigned"] : ["Unassigned"] : null;

  const toggleSelect = (id: string) => setSelected((s) => ({ ...s, [id]: !s[id] }));
  const clearSelection = () => setSelected({});

  const transitionOne = async (v: Valuation, toStage: ValuationStage) => {
    const res = await fetch(`/api/valuations/${v.id}/transition`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entityId, stage: toStage }),
    });
    return res.ok;
  };

  const handleDrop = async (v: Valuation, toStage: ValuationStage) => {
    if (!canDropInFocusBoard(v.stage, toStage)) return;
    // Optimistic UI update
    setValuations((prev) => prev.map((x) => (x.id === v.id ? { ...x, stage: toStage } : x)));
    const ok = await transitionOne(v, toStage);
    if (ok) {
      pushToast({ tone: "success", title: `${subjectOf(v).name} → ${STAGE_META[toStage].label}`, body: `${v.managerName ?? "The manager"} and Front Office notified.` });
      load(true); // Silent reload, no unmounting or screen flicker
    } else {
      pushToast({ tone: "error", title: "Error", body: "Failed to move stage" });
      load(true);
    }
  };

  const bulkAdvance = async () => {
    const ids = Object.keys(selected).filter((k) => selected[k]);
    const targets = ids
      .map((id) => valuations.find((v) => v.id === id))
      .filter((v): v is Valuation => !!v && STAGE_ORDER.indexOf(v.stage) >= 0 && STAGE_ORDER.indexOf(v.stage) < STAGE_ORDER.length - 1);
    if (targets.length === 0) { clearSelection(); return; }
    setBulkBusy(true);
    setActionLoading({ show: true, title: `Advancing ${targets.length} prospect${targets.length === 1 ? "" : "s"}…`, description: "Updating stage status and notifying team members." });
    try {
      await Promise.all(targets.map((v) => transitionOne(v, STAGE_ORDER[STAGE_ORDER.indexOf(v.stage) + 1])));
      pushToast({ tone: "success", title: `${targets.length} prospect${targets.length === 1 ? "" : "s"} advanced`, body: "Assigned managers and Front Office notified." });
      clearSelection();
      load(true);
    } finally {
      setBulkBusy(false);
      setActionLoading({ show: false });
    }
  };

  const bulkDecline = async () => {
    const ids = Object.keys(selected).filter((k) => selected[k]);
    const targets = ids.map((id) => valuations.find((v) => v.id === id)).filter((v): v is Valuation => !!v && canMoveToStage(v.stage, "declined"));
    if (targets.length === 0) { clearSelection(); return; }
    setBulkBusy(true);
    setActionLoading({ show: true, title: `Declining ${targets.length} prospect${targets.length === 1 ? "" : "s"}…`, description: "Marking selected prospects as declined." });
    try {
      await Promise.all(targets.map((v) => transitionOne(v, "declined")));
      pushToast({ tone: "info", title: `${targets.length} prospect${targets.length === 1 ? "" : "s"} declined`, body: "Marked as not proceeding." });
      clearSelection();
      load(true);
    } finally {
      setBulkBusy(false);
      setActionLoading({ show: false });
    }
  };

  const peek = peekId ? valuations.find((v) => v.id === peekId) ?? null : null;
  const peekSubject = peek ? subjectOf(peek) : null;
  const peekScore = peek ? scoreOf(peek) : null;
  const peekIdx = peek ? STAGE_ORDER.indexOf(peek.stage) : -1;
  const peekNext = peek && peekIdx >= 0 && peekIdx < STAGE_ORDER.length - 1 ? STAGE_ORDER[peekIdx + 1] : null;
  const peekImg = peek?.propertyMedia?.find((m) => m.isPrimary)?.url ?? peek?.propertyMedia?.[0]?.url ?? null;

  const advanceFromPeek = async () => {
    if (!peek || !peekNext) return;
    setActionLoading({ show: true, title: `Advancing to ${STAGE_META[peekNext].label}…`, description: "Updating stage and sending notifications." });
    try {
      const ok = await transitionOne(peek, peekNext);
      if (ok) {
        pushToast({ tone: "success", title: `${peekSubject?.name} → ${STAGE_META[peekNext].label}`, body: `${peek.managerName ?? "The manager"} and Front Office notified.` });
        setPeekId(null);
        load(true);
      } else {
        pushToast({ tone: "error", title: "Error", body: "Failed to advance stage" });
      }
    } finally {
      setActionLoading({ show: false });
    }
  };

  const mgrInitials = (name: string) => name.split(" ").map((w) => w[0]).slice(0, 2).join("");

  const renderCard = (v: Valuation) => {
    const subject = subjectOf(v);
    const score = scoreOf(v);
    const sel = !!selected[v.id];
    const age = daysSince(v.stageEnteredAt);
    const firstImage = coverImageOf(v);
    const isStalled = age > 30 && v.stage !== "accepted" && v.stage !== "mandate_signed";
    return (
      <div
        key={v.id}
        draggable={v.stage !== "mandate_signed"}
        onDragStart={() => setDragId(v.id)}
        onDragEnd={() => { setDragId(null); setDragOverStage(null); }}
        className={cn(
          "relative isolate bg-white border border-slate-200/80 rounded-2xl overflow-hidden hover:border-slate-300 hover:shadow-[0_12px_24px_rgb(0,0,0,0.06)] cursor-grab transition-all duration-300 flex flex-col gap-0 text-left group/card shadow-2xs",
          sel ? "border-[#151936] ring-2 ring-[#151936]" : dragId === v.id ? "border-[#f3df27] opacity-50 ring-2 ring-[#f3df27]" : "",
        )}
      >
        {/* Property Image Banner */}
        <div className="relative h-28 w-full bg-[#0d211a] overflow-hidden shrink-0">
          <Image
            src={firstImage}
            alt={subject.name}
            fill
            sizes="280px"
            className="object-cover transition-transform duration-500 group-hover/card:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a0d1c]/80 via-transparent to-transparent" />

          {/* Selection Checkbox and Badges */}
          <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 z-10">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); toggleSelect(v.id); }}
              aria-label="Select prospect"
              aria-checked={sel}
              role="checkbox"
              className={cn(
                "shrink-0 size-5 rounded-lg flex items-center justify-center border shadow-2xs transition-all cursor-pointer",
                sel ? "bg-[#151936] border-[#151936] text-white" : "bg-white/90 backdrop-blur-md border-slate-300 text-transparent hover:text-slate-400",
              )}
            >
              <IconCheck size={12} className={sel ? "opacity-100" : "opacity-0"} />
            </button>

            <div className="size-6 rounded-lg flex items-center justify-center bg-[#151936]/80 text-white backdrop-blur-md shadow-2xs border border-white/15">
              {v.propertyId ? <IconBuildingCommunity size={13} /> : <IconExternalLink size={13} />}
            </div>

            {isStalled && (
              <Badge tone="risk" className="text-xxs uppercase tracking-wider px-1.5 py-0.5">
                Stalled
              </Badge>
            )}
          </div>

          {score && (
            <span className="absolute top-2.5 right-2.5 bg-white/95 text-slate-900 rounded-lg px-2 py-0.5 text-xxs font-mono font-medium shadow-2xs border border-slate-200/80" title="Acquisition Fit Score">
              <span style={{ color: score.color }} className="font-medium mr-0.5">{score.grade}</span> {score.score}%
            </span>
          )}

          {v.managerName && (
            <span className="absolute bottom-2 right-2.5 size-6 rounded-full bg-[#151936] text-[#f3df27] text-xxs font-mono font-medium flex items-center justify-center border-2 border-white shadow-2xs" title={`Assigned PM: ${v.managerName}`}>
              {mgrInitials(v.managerName)}
            </span>
          )}
        </div>

        {/* Card Body */}
        <div className="p-3.5 flex flex-col flex-1 text-left gap-2.5">
          <button type="button" onClick={() => setPeekId(v.id)} className="w-full text-left focus:outline-none cursor-pointer group/title">
            <p className="text-xs font-medium text-slate-900 truncate leading-snug group-hover/title:text-[#151936] transition-colors">{subject.name}</p>
            <p className="text-caption text-slate-500 font-mono truncate mt-0.5 flex items-center gap-1">
              <IconMapPin size={11} className="text-amber-500 shrink-0" /> {subject.location}
            </p>
          </button>

          {/* Landlord Row */}
          <div className="flex items-center gap-2">
            <Avatar
              src={v.landlordAvatarUrl ?? undefined}
              fallback={v.landlordName ? v.landlordName.slice(0, 1) : "?"}
              className="size-5 bg-slate-100 border border-slate-200 text-slate-700 text-xxs font-medium shrink-0"
            />
            <span className="text-xs text-slate-600 font-medium truncate">{v.landlordName ?? "No landlord"}</span>
          </div>

          <div className="h-px bg-slate-100/90" />

          <div className="flex items-center justify-between mt-auto">
            <span className="font-mono text-xs text-[#151936] font-medium">{v.marketValueKes ? formatCompactKES(Number(v.marketValueKes)) : "—"}</span>
            <Badge tone={isStalled ? "risk" : "neutral"} className="font-mono text-xxs px-2 py-0.5 shrink-0 flex items-center gap-1">
              <IconClock size={11} /> {age}d
            </Badge>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="board-shell -mx-4 -mt-2 flex flex-col rounded-[24px] bg-slate-100 sm:-mx-6 lg:-mx-8 lg:-mb-8 overflow-hidden">
      {/* ── Completely Revamped Executive Focus Toolbar (Top Header) ── */}
      <div className="shrink-0 relative z-50 bg-tertiary-gradient text-white px-6 py-4 flex items-center justify-between gap-4 flex-wrap shadow-xl border-b border-slate-800/80">
        <div className="flex items-center gap-3.5 min-w-0">
          <button
            onClick={() => router.push("/admin/valuations")}
            className="inline-flex items-center gap-1.5 text-slate-300 hover:text-white text-xs font-mono font-medium bg-white/10 hover:bg-white/15 px-3 py-2 rounded-xl border border-white/15 transition-all shadow-2xs cursor-pointer"
          >
            <IconArrowLeft size={16} /> Valuations
          </button>

          <div className="w-px h-7 bg-white/15" />

          <div className="flex items-center gap-3 min-w-0">
            <span className="size-10 rounded-xl bg-gradient-to-br from-[#f3df27]/20 to-amber-500/10 border border-[#f3df27]/30 text-[#f3df27] flex items-center justify-center shrink-0 shadow-xs">
              <IconBriefcase size={20} />
            </span>
            <div className="min-w-0">
              <h1 className="title-serif text-white text-2xl font-normal tracking-tight leading-none">Acquisition Focus Board</h1>
              <p className="text-xxs font-mono font-medium uppercase tracking-widest text-slate-300 mt-1 flex items-center gap-2">
                <span>{valuations.length} PROSPECTS</span>
                <span>·</span>
                <span className="text-amber-300">{formatCompactKES(totalValue)} IN PIPELINE</span>
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 ml-auto flex-wrap">
          <div className="relative">
            <IconSearch size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search prospects…"
              className="w-[200px] sm:w-[220px] bg-slate-900/60 border border-white/20 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder:text-slate-400 outline-none focus:bg-slate-900/90 focus:border-[#f3df27]/60 transition-all font-mono shadow-inner"
            />
          </div>

          <select
            value={mgrFilter}
            onChange={(e) => setMgrFilter(e.target.value)}
            aria-label="Filter by manager"
            className="bg-slate-900/60 border border-white/20 text-white rounded-xl px-3 py-2 text-xs font-mono outline-none cursor-pointer hover:border-white/30 focus:border-[#f3df27]/60 transition-all"
          >
            <option value="all" className="text-[#151936]">All managers</option>
            {managerOptions.map((m) => <option key={m} value={m} className="text-[#151936]">{m}</option>)}
          </select>

          <button
            onClick={() => setSwimlaneOn((v) => !v)}
            aria-pressed={swimlaneOn}
            className={cn(
              "inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-medium font-mono transition-all shadow-2xs cursor-pointer",
              swimlaneOn ? "bg-[#f3df27] text-[#151936] font-medium shadow-md" : "bg-slate-900/60 text-slate-200 border border-white/20 hover:bg-slate-900/80",
            )}
          >
            <IconLayoutRows size={15} /> Swimlanes
          </button>
        </div>
      </div>

      {/* ── Bulk action bar ── */}
      {selCount > 0 && (
        <div className="shrink-0 relative z-40 bg-[#151936] border-b border-slate-800 text-white px-6 py-2.5 flex items-center gap-4 flex-wrap shadow-md animate-fade-in-up">
          <span className="text-xs font-mono font-medium uppercase tracking-wider text-slate-300">{selCount} SELECTED</span>
          <span className="font-mono text-xs font-medium text-[#f3df27]">{formatCompactKES(selValue)}</span>
          <div className="flex gap-2 ml-auto flex-wrap">
            <button
              disabled={bulkBusy}
              onClick={bulkAdvance}
              className="inline-flex items-center gap-1.5 bg-[#f3df27] text-[#151936] hover:bg-[#e6d220] rounded-xl px-3.5 py-1.5 text-xs font-medium disabled:opacity-50 transition-all shadow-2xs cursor-pointer"
            >
              <IconArrowRight size={14} /> Advance stage
            </button>
            <button
              disabled={bulkBusy}
              onClick={() => setReassignOpen(true)}
              className="inline-flex items-center gap-1.5 bg-white/10 border border-white/20 text-white hover:bg-white/20 rounded-xl px-3.5 py-1.5 text-xs font-medium disabled:opacity-50 transition-all shadow-2xs cursor-pointer"
            >
              <IconUserCog size={14} /> Reassign
            </button>
            <button
              disabled={bulkBusy}
              onClick={bulkDecline}
              className="inline-flex items-center gap-1.5 bg-rose-500/20 border border-rose-400/40 text-rose-200 hover:bg-rose-500/30 rounded-xl px-3.5 py-1.5 text-xs font-medium disabled:opacity-50 transition-all shadow-2xs cursor-pointer"
            >
              <IconX size={14} /> Decline
            </button>
            <button
              onClick={clearSelection}
              aria-label="Clear selection"
              className="size-8 rounded-xl text-white/70 hover:bg-white/10 hover:text-white transition-colors flex items-center justify-center cursor-pointer"
            >
              <IconX size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ── Board Columns Area (Strict Stacking Context Isolation) ── */}
      <div className="overflow-x-auto px-6 py-6 relative z-10">
        {loading ? (
          <div className="flex justify-center py-20"><LoadingSpinner size="lg" /></div>
        ) : (
          <div className="grid grid-flow-col auto-cols-[270px] sm:auto-cols-[290px] gap-4 items-start min-h-full">
            {columns.map(({ stage, cards, total, overWip, wip }) => {
              const cfg = STAGE_META[stage];
              const dragged = dragId ? valuations.find((v) => v.id === dragId) : null;
              const canDrop = dragged ? canDropInFocusBoard(dragged.stage, stage) : false;
              const isOver = dragOverStage === stage && canDrop;
              const groups = swimlanes ? swimlanes.map((name) => ({ name, cards: cards.filter((v) => (v.managerName ?? "Unassigned") === name) })).filter((g) => g.cards.length > 0) : null;
              return (
                <div
                  key={stage}
                  className="flex flex-col gap-3 relative isolate z-0"
                  onDragOver={(e) => { if (canDrop) { e.preventDefault(); if (dragOverStage !== stage) setDragOverStage(stage); } }}
                  onDragLeave={() => { if (dragOverStage === stage) setDragOverStage(null); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const id = dragId;
                    setDragId(null);
                    setDragOverStage(null);
                    const card = id ? valuations.find((v) => v.id === id) : null;
                    if (!card || card.stage === stage) return;
                    handleDrop(card, stage);
                  }}
                >
                  {/* Sticky Column Header Shell with high z-30 inside column */}
                  <div className={cn(
                    "sticky top-0 z-30 bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl p-4 shadow-2xs hover:shadow-xs transition-all duration-300 relative overflow-hidden group/stage",
                    isOver ? "border-[#151936] ring-2 ring-[#151936]/20" : "",
                  )}>
                    {/* Stage Accent Color Line */}
                    <div className={cn("absolute top-0 left-0 right-0 h-1.5", STAGE_BAR_ACCENT[stage] ?? "bg-slate-300")} />

                    <div className="flex items-center justify-between gap-2 pt-1 mb-3">
                      <span className="flex items-center gap-2 text-xs font-mono font-medium text-slate-900 uppercase tracking-wider">
                        <span className={cn("size-2.5 rounded-full shadow-2xs", cfg.dot)} /> {cfg.label}
                      </span>
                      <span className={cn(
                        "font-mono text-xxs font-medium rounded-full px-2 py-0.5 border shadow-2xs transition-colors",
                        overWip ? "bg-rose-50 text-rose-700 border-rose-200 animate-pulse" : "bg-slate-100/90 text-slate-700 border-slate-200/80"
                      )}>
                        {cards.length}{wip > 0 && <span className="opacity-60"> / {wip}</span>}
                      </span>
                    </div>

                    <div className="h-px bg-slate-100 my-2" />

                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xxs font-mono font-medium uppercase tracking-wider text-slate-500">TOTAL VALUE</span>
                      <span className="font-mono text-xs font-medium text-[#151936]">{formatCompactKES(total)}</span>
                    </div>
                    {overWip && <p className="mt-2 text-xxs font-mono font-medium uppercase tracking-wider text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-2 py-1 text-center">⚠ OVER WIP CAPACITY</p>}
                  </div>

                  {/* Column Drag Container */}
                  <div className={cn(
                    "flex flex-col gap-3 rounded-2xl p-1 transition-all relative z-10",
                    isOver ? "bg-slate-200/60 ring-2 ring-slate-400 ring-inset" : dragged && canDrop ? "ring-1 ring-slate-300 ring-inset" : "",
                  )} style={{ minHeight: dragged && canDrop ? 80 : 8 }}>
                    {groups ? (
                      groups.map((g) => (
                        <div key={g.name} className="flex flex-col gap-2.5">
                          <p className="text-xxs font-mono font-medium uppercase tracking-wider text-slate-500 px-1">{g.name}</p>
                          {g.cards.map(renderCard)}
                        </div>
                      ))
                    ) : (
                      cards.map(renderCard)
                    )}
                    {cards.length === 0 && dragged && canDrop && (
                      <div className="flex items-center justify-center h-16 border-2 border-dashed border-slate-300 rounded-2xl text-xs font-medium text-slate-500 bg-slate-50/50">
                        Drop to move here
                      </div>
                    )}
                    {cards.length === 0 && !(dragged && canDrop) && (
                      <div className="p-6 text-center text-xs font-mono text-slate-400 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">No prospects</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Quick-peek drawer ── */}
      {peek && (
        <div className="fixed inset-0 z-50">
          <button aria-label="Close" onClick={() => setPeekId(null)} className="absolute inset-0 w-full h-full bg-[#151936]/40 backdrop-blur-xs cursor-pointer" />
          <div role="dialog" aria-label="Prospect quick view" className="absolute top-0 right-0 bottom-0 w-full sm:w-[420px] bg-white shadow-2xl flex flex-col border-l border-slate-200/80 animate-fade-in-up">
            <div className="relative h-[180px] shrink-0 overflow-hidden bg-[#0d211a]">
              {peekImg ? (
                <Image src={peekImg} alt={peekSubject?.name ?? "Prospect banner"} fill sizes="420px" className="object-cover" />
              ) : (
                <div className="absolute inset-0 bg-tertiary-gradient" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-[#0a0d1c]/90 via-[#0a0d1c]/40 to-transparent" />

              <button
                onClick={() => setPeekId(null)}
                aria-label="Close"
                className="absolute top-3 right-3 size-8 rounded-xl bg-white/90 text-[#151936] flex items-center justify-center hover:bg-white transition-all shadow-md cursor-pointer z-10"
              >
                <IconX size={16} />
              </button>
              <div className="absolute top-3 left-4 z-10">
                <Badge tone={stageTone(peek.stage)}>
                  {(STAGE_META[peek.stage] ?? STAGE_META.requested).label}
                </Badge>
              </div>
              <div className="absolute left-4 right-4 bottom-3">
                <p className="font-mono text-xxs font-medium text-amber-300">{peek.valuationCode}</p>
                <h2 className="text-white text-lg font-medium leading-tight mt-0.5">{peekSubject?.name}</h2>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3 bg-slate-50/80 border border-slate-200/70 rounded-2xl p-4 shadow-2xs">
                <div>
                  <p className="text-xxs font-mono font-medium text-slate-500 uppercase tracking-wider mb-1">Assessed Value</p>
                  <p className="font-mono text-base font-medium text-[#151936]">{peek.marketValueKes ? formatCompactKES(Number(peek.marketValueKes)) : "—"}</p>
                </div>
                <div>
                  <p className="text-xxs font-mono font-medium text-slate-500 uppercase tracking-wider mb-1">Fit Score</p>
                  <p className="font-mono text-base font-medium" style={{ color: peekScore?.color ?? "#475569" }}>{peekScore ? `${peekScore.grade} · ${peekScore.score}%` : "—"}</p>
                </div>
              </div>

              <div className="flex gap-2 flex-wrap">
                {peek.landlordPhone && (
                  <a href={`tel:${peek.landlordPhone}`} className="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-200/80 rounded-xl px-3.5 py-2 text-xs font-medium text-slate-800 hover:bg-slate-100 transition-all shadow-2xs">
                    <IconPhone size={14} /> Call
                  </a>
                )}
                {peek.landlordEmail && (
                  <a href={`mailto:${peek.landlordEmail}`} className="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-200/80 rounded-xl px-3.5 py-2 text-xs font-medium text-slate-800 hover:bg-slate-100 transition-all shadow-2xs">
                    <IconMail size={14} /> Email
                  </a>
                )}
                <button onClick={() => setDocModalTarget(peek)} className="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-200/80 rounded-xl px-3.5 py-2 text-xs font-medium text-slate-800 hover:bg-slate-100 transition-all shadow-2xs cursor-pointer">
                  <IconPaperclip size={14} /> Attach
                </button>
              </div>

              <div role="tablist" className="flex bg-slate-100 p-1 rounded-xl gap-1">
                {(["details", "activity"] as const).map((t) => (
                  <button key={t} role="tab" onClick={() => setPeekTab(t)} className={cn("flex-1 rounded-lg py-1.5 text-xs font-medium transition-all capitalize cursor-pointer", peekTab === t ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500 hover:text-slate-700")}>
                    {t}
                  </button>
                ))}
              </div>

              {peekTab === "details" ? (
                <div className="flex flex-col gap-2">
                  {[
                    { icon: IconUser, label: "Landlord", value: peek.landlordName ?? "—" },
                    { icon: IconBriefcase, label: "Manager", value: peek.managerName ?? "Unassigned" },
                    { icon: IconAward, label: "Valuer", value: valuerLabel(peek) },
                    { icon: IconPercentage, label: "Proposed fee", value: peek.proposedFeeRate ? `${(Number(peek.proposedFeeRate) * 100).toFixed(1)}%` : "—" },
                    { icon: IconBuilding, label: "Type", value: peek.isLand ? "Land" : "Built property" },
                    { icon: IconClock, label: "Age in stage", value: `${daysSince(peek.stageEnteredAt)} days` },
                  ].map((row) => (
                    <div key={row.label} className="flex items-center gap-3 bg-slate-50/80 border border-slate-200/70 rounded-2xl p-3">
                      <span className="size-8 rounded-xl bg-white border border-slate-200/80 flex items-center justify-center text-slate-600 shrink-0 shadow-2xs"><row.icon size={15} /></span>
                      <span className="flex-1 text-xs text-slate-500 font-mono uppercase tracking-wider">{row.label}</span>
                      <span className="text-xs font-medium text-slate-900 truncate max-w-[150px]">{row.value}</span>
                    </div>
                  ))}
                </div>
              ) : peekActivityLoading ? (
                <div className="flex justify-center py-8"><LoadingSpinner size="md" /></div>
              ) : !peekActivity || peekActivity.length === 0 ? (
                <p className="text-slate-400 text-center py-8 text-xs font-mono">No recorded activity yet.</p>
              ) : (
                <div className="flex flex-col relative pl-2 pt-1 pb-1">
                  {peekActivity.map((a, i) => (
                    <div key={a.id} className="flex gap-4 relative py-3.5 group">
                      {i < peekActivity.length - 1 && (
                        <div className="absolute left-[13px] top-[32px] bottom-0 w-px bg-slate-100 group-hover:bg-slate-200 transition-colors" />
                      )}
                      <div className="flex flex-col items-center pt-0.5 z-10">
                        <div className="size-7 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center shadow-2xs shrink-0">
                          <span className="size-2 rounded-full bg-[#151936]" />
                        </div>
                      </div>

                      <div className="flex flex-col gap-1 min-w-0 flex-1 bg-slate-50/50 hover:bg-slate-50 border border-slate-100/60 p-3.5 rounded-2xl transition-colors">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="text-xxs font-mono font-medium text-slate-500 uppercase tracking-wider">{new Date(a.createdAt).toLocaleString("en-KE")}</span>
                        </div>
                        <p className="text-xs text-slate-900 font-medium leading-relaxed">{a.summary}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="shrink-0 p-4 border-t border-slate-200/80 flex gap-2.5 bg-slate-50/50">
              <button
                onClick={advanceFromPeek}
                disabled={!peekNext}
                className="flex-1 inline-flex items-center justify-center gap-1.5 bg-[#151936] text-white rounded-xl py-2.5 text-xs font-medium hover:bg-[#1f2547] disabled:opacity-50 transition-all shadow-2xs cursor-pointer"
              >
                <IconArrowRight size={15} /> {peekNext ? `Advance to ${STAGE_META[peekNext].label}` : "Final stage"}
              </button>
              <button
                onClick={() => router.push(`/admin/valuations/${peek.id}`)}
                className="inline-flex items-center justify-center gap-1.5 bg-white border border-slate-200/90 rounded-xl px-4 py-2.5 text-xs font-medium text-slate-800 hover:bg-slate-50 transition-all shadow-2xs cursor-pointer"
              >
                <IconExternalLink size={14} /> Full file
              </button>
            </div>
          </div>
        </div>
      )}

      {docModalTarget && (
        <ValuationDocumentModal
          open={!!docModalTarget}
          entityId={entityId}
          valuationId={docModalTarget.id}
          valuationLabel={`${subjectOf(docModalTarget).name} (${docModalTarget.valuationCode})`}
          onClose={() => setDocModalTarget(null)}
          onAttached={() => setDocModalTarget(null)}
        />
      )}

      <ValuationReassignModal
        open={reassignOpen}
        entityId={entityId}
        valuationIds={Object.keys(selected).filter((k) => selected[k])}
        onClose={() => setReassignOpen(false)}
        onReassigned={() => { setReassignOpen(false); clearSelection(); load(true); }}
      />

      <ActionLoadingOverlay
        show={actionLoading.show}
        title={actionLoading.title}
        description={actionLoading.description}
      />
    </div>
  );
}
