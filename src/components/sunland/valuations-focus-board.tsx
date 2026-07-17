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
  IconTelescope,
  IconBuildingCommunity,
} from "@tabler/icons-react";
import Image from "next/image";
import { Avatar, Badge } from "@/components/ui/erp-primitives";
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

// Focus-board drag/drop deliberately does not allow dropping into "declined"
// (matches the design exactly) - declining happens via the bulk-action bar
// or the register page/detail page instead, since a drag slip here would be
// too easy to trigger by accident in a dense multi-column layout.
function canDropInFocusBoard(from: ValuationStage, to: ValuationStage): boolean {
  if (to === "declined") return false;
  return canMoveToStage(from, to);
}

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

  const load = useCallback(async () => {
    Promise.resolve().then(() => setLoading(true));
    try {
      const res = await fetch(`/api/valuations?entityId=${entityId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load valuations");
      setValuations(data.valuations ?? []);
    } catch (err) {
      pushToast({ tone: "error", title: "Error", body: err instanceof Error ? err.message : "Failed to load valuations" });
    } finally {
      setLoading(false);
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
    setValuations((prev) => prev.map((x) => (x.id === v.id ? { ...x, stage: toStage } : x)));
    const ok = await transitionOne(v, toStage);
    if (ok) {
      pushToast({ tone: "success", title: `${subjectOf(v).name} → ${STAGE_META[toStage].label}`, body: `${v.managerName ?? "The manager"} and Front Office notified.` });
      load();
    } else {
      pushToast({ tone: "error", title: "Error", body: "Failed to move stage" });
      load();
    }
  };

  const bulkAdvance = async () => {
    const ids = Object.keys(selected).filter((k) => selected[k]);
    const targets = ids
      .map((id) => valuations.find((v) => v.id === id))
      .filter((v): v is Valuation => !!v && STAGE_ORDER.indexOf(v.stage) >= 0 && STAGE_ORDER.indexOf(v.stage) < STAGE_ORDER.length - 1);
    if (targets.length === 0) { clearSelection(); return; }
    setBulkBusy(true);
    try {
      await Promise.all(targets.map((v) => transitionOne(v, STAGE_ORDER[STAGE_ORDER.indexOf(v.stage) + 1])));
      pushToast({ tone: "success", title: `${targets.length} prospect${targets.length === 1 ? "" : "s"} advanced`, body: "Assigned managers and Front Office notified." });
      clearSelection();
      load();
    } finally {
      setBulkBusy(false);
    }
  };

  const bulkDecline = async () => {
    const ids = Object.keys(selected).filter((k) => selected[k]);
    const targets = ids.map((id) => valuations.find((v) => v.id === id)).filter((v): v is Valuation => !!v && canMoveToStage(v.stage, "declined"));
    if (targets.length === 0) { clearSelection(); return; }
    setBulkBusy(true);
    try {
      await Promise.all(targets.map((v) => transitionOne(v, "declined")));
      pushToast({ tone: "info", title: `${targets.length} prospect${targets.length === 1 ? "" : "s"} declined`, body: "Marked as not proceeding." });
      clearSelection();
      load();
    } finally {
      setBulkBusy(false);
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
    const ok = await transitionOne(peek, peekNext);
    if (ok) {
      pushToast({ tone: "success", title: `${peekSubject?.name} → ${STAGE_META[peekNext].label}`, body: `${peek.managerName ?? "The manager"} and Front Office notified.` });
      setPeekId(null);
      load();
    } else {
      pushToast({ tone: "error", title: "Error", body: "Failed to advance stage" });
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
          "bg-white border rounded-2xl overflow-hidden hover:shadow-[0_8px_20px_rgb(0,0,0,0.05)] cursor-grab transition-all flex flex-col gap-0 text-left",
          sel ? "border-[#151936] ring-1 ring-[#151936]" : dragId === v.id ? "border-[#f3df27] opacity-50" : "border-slate-100 hover:border-slate-200",
        )}
      >
        {/* Property Image Banner */}
        <div className="relative h-24 w-full bg-[#0d211a] overflow-hidden shrink-0">
          <Image
            src={firstImage}
            alt={subject.name}
            fill
            sizes="180px"
            className="object-cover transition-transform duration-500 hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent" />

          {/* Selection Checkbox and Icon */}
          <div className="absolute top-2 left-2 flex items-center gap-1.5 z-10">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); toggleSelect(v.id); }}
              aria-label="Select prospect"
              aria-checked={sel}
              role="checkbox"
              className={cn(
                "shrink-0 size-[18px] rounded-md flex items-center justify-center border border-white/60 shadow-sm transition-all",
                sel ? "bg-[#151936] border-[#151936] text-white" : "bg-white/80 backdrop-blur-xs border-slate-300",
              )}
            >
              {sel && <IconCheck size={11} />}
            </button>
            <div className={cn("size-6 rounded-md flex items-center justify-center bg-[#151936]/80 text-white backdrop-blur-xs shadow-xs border border-slate-700/20")}>
              {v.propertyId ? <IconBuildingCommunity size={12} /> : <IconExternalLink size={12} />}
            </div>
            {isStalled && (
              <span className="bg-rose-500 text-white text-[9px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded shadow-sm">
                Stalled
              </span>
            )}
          </div>

          {score && (
            <span className="absolute top-2 right-2 bg-white/95 text-slate-800 rounded px-1.5 py-0.5 text-[9px] font-mono font-medium shadow-xs border border-slate-150" title="Acquisition Fit Score">
              <span style={{ color: score.color }} className="font-medium mr-0.5">{score.grade}</span> {score.score}
            </span>
          )}

          {v.managerName && (
            <span className="absolute bottom-2 right-2 size-6 rounded-full bg-[#151936] text-[#f3df27] text-[10px] font-mono font-medium flex items-center justify-center border border-white shadow-xs" title={`Assigned PM: ${v.managerName}`}>
              {mgrInitials(v.managerName)}
            </span>
          )}
        </div>

        {/* Card Body */}
        <div className="p-3 flex flex-col flex-1 text-left">
          <button type="button" onClick={() => setPeekId(v.id)} className="w-full text-left focus:outline-none">
            <p className="text-xs font-medium text-slate-900 truncate leading-snug">{subject.name}</p>
            <p className="text-[10px] text-slate-500 truncate mt-1 flex items-center gap-0.5"><IconMapPin size={10} /> {subject.location}</p>
          </button>

          {/* Landlord Row */}
          <div className="flex items-center gap-1.5 mt-2.5">
            <Avatar
              src={v.landlordAvatarUrl ?? undefined}
              fallback={v.landlordName ? v.landlordName.slice(0, 1) : "?"}
              className="size-5 bg-slate-100 border border-slate-200 text-slate-700 text-[10px] font-medium shrink-0"
            />
            <span className="text-xs text-slate-500 font-medium truncate">{v.landlordName ?? "No landlord"}</span>
          </div>

          <div className="h-px bg-slate-100/80 my-2" />

          <div className="flex items-center justify-between mt-auto">
            <span className="font-mono text-xs text-[#122a20] font-medium">{v.marketValueKes ? formatCompactKES(Number(v.marketValueKes)) : "—"}</span>
            <Badge tone={isStalled ? "risk" : "neutral"} className="font-mono text-xs px-1.5 py-0.5 shrink-0 flex items-center gap-0.5">
              <IconClock size={10} /> {age}d
            </Badge>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-[#eef1ea]">
      {/* ── Focus toolbar ── */}
      <div className="shrink-0 bg-[#151936] text-white px-6 py-3.5 flex items-center gap-4 flex-wrap shadow-lg z-20">
        <button onClick={() => router.push("/admin/valuations")} className="flex items-center gap-1.5 text-white/70 hover:text-white text-sm font-medium transition-colors">
          <IconArrowLeft size={16} /> Valuations
        </button>
        <div className="w-px h-[22px] bg-white/15" />
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="size-8 rounded-lg bg-[#f3df27]/15 text-[#f3df27] flex items-center justify-center shrink-0">
            <IconBriefcase size={16} />
          </span>
          <div className="min-w-0">
            <p className="title-serif text-white text-lg leading-tight">Acquisition Focus Board</p>
            <p className="text-xs font-medium uppercase tracking-wide text-white/50">{valuations.length} prospects · {formatCompactKES(totalValue)} in pipeline</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 ml-auto flex-wrap">
          <div className="relative">
            <IconSearch size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/50" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search prospects…"
              className="w-[170px] bg-white/10 border border-white/[0.18] rounded-lg pl-8 pr-2.5 py-2 text-xs text-white placeholder:text-white/50 outline-none focus:bg-white/[0.16] focus:border-[#f3df27]/50 transition-colors"
            />
          </div>
          <select
            value={mgrFilter}
            onChange={(e) => setMgrFilter(e.target.value)}
            aria-label="Filter by manager"
            className="bg-white/10 border border-white/[0.18] rounded-lg px-2.5 py-2 text-xs text-white outline-none cursor-pointer"
          >
            <option value="all" className="text-[#151936]">All managers</option>
            {managerOptions.map((m) => <option key={m} value={m} className="text-[#151936]">{m}</option>)}
          </select>
          <button
            onClick={() => setSwimlaneOn((v) => !v)}
            aria-pressed={swimlaneOn}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors",
              swimlaneOn ? "bg-[#f3df27] text-[#151936]" : "bg-white/10 text-white border border-white/[0.18]",
            )}
          >
            <IconLayoutRows size={15} /> Swimlanes
          </button>
        </div>
      </div>

      {/* ── Bulk action bar ── */}
      {selCount > 0 && (
        <div className="shrink-0 bg-[#122a20] text-white px-6 py-2.5 flex items-center gap-3.5 flex-wrap z-10">
          <span className="text-xs font-medium">{selCount} selected</span>
          <span className="font-mono text-xs text-white/60">{formatCompactKES(selValue)}</span>
          <div className="flex gap-2 ml-auto flex-wrap">
            <button disabled={bulkBusy} onClick={bulkAdvance} className="inline-flex items-center gap-1.5 bg-white/[0.14] border border-white/25 rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-white/[0.22] disabled:opacity-50 transition-colors">
              <IconArrowRight size={14} /> Advance stage
            </button>
            <button disabled={bulkBusy} onClick={() => setReassignOpen(true)} className="inline-flex items-center gap-1.5 bg-white/[0.14] border border-white/25 rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-white/[0.22] disabled:opacity-50 transition-colors">
              <IconUserCog size={14} /> Reassign
            </button>
            <button disabled={bulkBusy} onClick={bulkDecline} className="inline-flex items-center gap-1.5 bg-rose-500/20 border border-rose-500/40 text-rose-200 rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-rose-500/30 disabled:opacity-50 transition-colors">
              <IconX size={14} /> Decline
            </button>
            <button onClick={clearSelection} aria-label="Clear selection" className="size-[30px] rounded-lg text-white/70 hover:bg-white/[0.12] hover:text-white transition-colors flex items-center justify-center">
              <IconX size={15} />
            </button>
          </div>
        </div>
      )}

      {/* ── Board ── */}
      <div className="flex-1 overflow-auto px-6 py-4.5">
        {loading ? (
          <div className="flex justify-center py-20"><LoadingSpinner size="lg" /></div>
        ) : (
          <div className="grid grid-flow-col auto-cols-[290px] gap-4 items-start min-h-full">
            {columns.map(({ stage, cards, total, overWip, wip }) => {
              const cfg = STAGE_META[stage];
              const dragged = dragId ? valuations.find((v) => v.id === dragId) : null;
              const canDrop = dragged ? canDropInFocusBoard(dragged.stage, stage) : false;
              const isOver = dragOverStage === stage && canDrop;
              const groups = swimlanes ? swimlanes.map((name) => ({ name, cards: cards.filter((v) => (v.managerName ?? "Unassigned") === name) })).filter((g) => g.cards.length > 0) : null;
              return (
                <div
                  key={stage}
                  className="flex flex-col gap-3"
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
                  <div className={cn("sticky top-0 z-[2] bg-white border rounded-2xl p-3.5 shadow-sm transition-colors", isOver ? "border-[#151936]" : "border-slate-100")}>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="flex items-center gap-2 text-xs font-medium text-slate-900">
                        <span className={cn("size-2 rounded-full", cfg.dot)} /> {cfg.label}
                      </span>
                      <span className={cn("font-mono text-xs rounded-full px-2 py-0.5", overWip ? "bg-rose-500/10 text-rose-700" : "bg-slate-100 text-slate-600")}>
                        {cards.length}{wip > 0 && <span className="opacity-60"> / {wip}</span>}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs uppercase tracking-wide text-slate-400">Total value</span>
                      <span className="font-mono text-xs text-[#122a20]">{formatCompactKES(total)}</span>
                    </div>
                    {overWip && <p className="mt-1.5 text-xs font-medium uppercase tracking-wide text-rose-700">⚠ Over WIP limit</p>}
                  </div>

                  <div className={cn(
                    "flex flex-col gap-2.5 rounded-2xl p-1 transition-all",
                    isOver ? "bg-slate-100 ring-2 ring-slate-300 ring-inset" : dragged && canDrop ? "ring-1 ring-slate-200 ring-inset" : "",
                  )} style={{ minHeight: dragged && canDrop ? 70 : 8 }}>
                    {groups ? (
                      groups.map((g) => (
                        <div key={g.name} className="flex flex-col gap-2">
                          <p className="text-xs font-medium uppercase tracking-wide text-slate-400 px-1">{g.name}</p>
                          {g.cards.map(renderCard)}
                        </div>
                      ))
                    ) : (
                      cards.map(renderCard)
                    )}
                    {cards.length === 0 && dragged && canDrop && (
                      <div className="flex items-center justify-center h-14 border-[1.5px] border-dashed border-slate-300 rounded-xl text-xs font-medium text-slate-400">
                        Drop to move here
                      </div>
                    )}
                    {cards.length === 0 && !(dragged && canDrop) && (
                      <div className="p-4.5 text-center text-xs text-slate-300 border-[1.5px] border-dashed border-slate-200 rounded-xl">No prospects</div>
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
        <div className="fixed inset-0 z-40">
          <button aria-label="Close" onClick={() => setPeekId(null)} className="absolute inset-0 w-full h-full bg-[#151936]/35 backdrop-blur-[2px]" />
          <div role="dialog" aria-label="Prospect quick view" className="absolute top-0 right-0 bottom-0 w-full sm:w-[400px] bg-white shadow-2xl flex flex-col animate-fade-in-up">
            <div className="relative h-[160px] shrink-0 overflow-hidden">
              {peekImg ? (
                <Image src={peekImg} alt={peekSubject?.name ?? "Prospect banner"} fill sizes="400px" className="object-cover" />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-[#151936] to-[#0c1f24]" />
              )}
              <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(21,25,54,0.1) 0%, rgba(21,25,54,0.7) 100%)" }} />
              <button onClick={() => setPeekId(null)} aria-label="Close" className="absolute top-3 right-3 size-8 rounded-lg bg-white/90 text-[#151936] flex items-center justify-center hover:bg-white transition-colors z-10">
                <IconX size={16} />
              </button>
              <div className="absolute top-3 left-4 z-10">
                <Badge tone={stageTone(peek.stage)} className="bg-white/95 text-slate-800 border-none shadow-xs">
                  {STAGE_META[peek.stage].label}
                </Badge>
              </div>
              <div className="absolute left-4 right-4 bottom-3">
                <p className="font-mono text-xs text-white/70">{peek.valuationCode}</p>
                <p className="title-serif text-white text-xl leading-tight mt-0.5">{peekSubject?.name}</p>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-3.5">
              <div className="flex gap-2.5">
                <div className="flex-1 border border-slate-100 bg-slate-50 rounded-2xl p-3">
                  <p className="label-caps text-slate-400 mb-1">Assessed</p>
                  <p className="mono-amount text-lg text-slate-900">{peek.marketValueKes ? formatCompactKES(Number(peek.marketValueKes)) : "—"}</p>
                </div>
                <div className="flex-1 border border-slate-100 bg-slate-50 rounded-2xl p-3">
                  <p className="label-caps text-slate-400 mb-1">Fit score</p>
                  <p className="mono-amount text-lg" style={{ color: peekScore?.color ?? "#94a3b8" }}>{peekScore ? `${peekScore.grade} · ${peekScore.score}` : "—"}</p>
                </div>
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {peek.landlordPhone && (
                  <a href={`tel:${peek.landlordPhone}`} className="inline-flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors">
                    <IconPhone size={14} /> Call
                  </a>
                )}
                {peek.landlordEmail && (
                  <a href={`mailto:${peek.landlordEmail}`} className="inline-flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors">
                    <IconMail size={14} /> Email
                  </a>
                )}
                <button onClick={() => setDocModalTarget(peek)} className="inline-flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors">
                  <IconPaperclip size={14} /> Attach
                </button>
              </div>
              <div role="tablist" className="flex bg-slate-100 p-1 rounded-xl gap-0.5">
                {(["details", "activity"] as const).map((t) => (
                  <button key={t} role="tab" onClick={() => setPeekTab(t)} className={cn("flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors capitalize", peekTab === t ? "bg-white text-slate-900 shadow-sm" : "text-slate-500")}>
                    {t}
                  </button>
                ))}
              </div>
              {peekTab === "details" ? (
                <div className="flex flex-col gap-1.5">
                  {[
                    { icon: IconUser, label: "Landlord", value: peek.landlordName ?? "—" },
                    { icon: IconBriefcase, label: "Manager", value: peek.managerName ?? "Unassigned" },
                    { icon: IconAward, label: "Valuer", value: valuerLabel(peek) },
                    { icon: IconPercentage, label: "Proposed fee", value: peek.proposedFeeRate ? `${(Number(peek.proposedFeeRate) * 100).toFixed(1)}%` : "—" },
                    { icon: IconBuilding, label: "Type", value: peek.isLand ? "Land" : "Built property" },
                    { icon: IconClock, label: "Age in stage", value: `${daysSince(peek.stageEnteredAt)} days` },
                  ].map((row) => (
                    <div key={row.label} className="flex items-center gap-2.5 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2">
                      <span className="size-[30px] rounded-lg bg-white border border-slate-100 flex items-center justify-center text-[#151936] shrink-0"><row.icon size={14} /></span>
                      <span className="flex-1 text-xs text-slate-500">{row.label}</span>
                      <span className="text-xs font-medium text-slate-900 truncate max-w-[140px]">{row.value}</span>
                    </div>
                  ))}
                </div>
              ) : peekActivityLoading ? (
                <div className="flex justify-center py-8"><LoadingSpinner size="md" /></div>
              ) : !peekActivity || peekActivity.length === 0 ? (
                <p className="text-slate-400 text-center py-8 text-sm">No recorded activity yet.</p>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {peekActivity.map((a) => (
                    <div key={a.id} className="flex gap-2.5">
                      <span className="size-[7px] rounded-full bg-slate-300 shrink-0 mt-1.5" />
                      <div>
                        <p className="text-xs text-slate-600">{a.summary}</p>
                        <p className="text-xs font-mono text-slate-400 mt-0.5">{new Date(a.createdAt).toLocaleString("en-KE")}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="shrink-0 p-4 border-t border-slate-100 flex gap-2.5">
              <button onClick={advanceFromPeek} disabled={!peekNext} className="flex-1 inline-flex items-center justify-center gap-1.5 bg-[#151936] text-white rounded-xl py-2.5 text-sm font-medium hover:bg-[#1d2347] disabled:opacity-50 transition-colors">
                <IconArrowRight size={15} /> {peekNext ? `Advance to ${STAGE_META[peekNext].label}` : "Final stage"}
              </button>
              <button onClick={() => router.push(`/admin/valuations/${peek.id}`)} className="inline-flex items-center justify-center gap-1.5 bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
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
        onReassigned={() => { setReassignOpen(false); clearSelection(); load(); }}
      />
    </div>
  );
}
