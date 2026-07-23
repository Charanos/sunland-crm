"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  IconBuildingCommunity,
  IconChevronLeft,
  IconChevronRight,
  IconClockExclamation,
  IconEdit,
  IconExternalLink,
  IconEye,
  IconFileCertificate,
  IconLayoutGrid,
  IconLayoutKanban,
  IconList,
  IconMaximize,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconSend,
  IconShieldCheck,
  IconTelescope,
  IconTrash,
  IconX,
  IconDotsVertical,
  IconStarFilled,
  IconStar,
  IconArrowsMove,
  IconMapPin,
  IconFilter,
  IconClock,
  IconMoodEmpty,
} from "@tabler/icons-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Badge,
  BoardHeader,
  Button,
  PaginationControls,
  ConfirmDialog,
  DropdownMenu,
  DropdownItem,
  Avatar,
} from "@/components/ui/erp-primitives";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { PageTransition } from "@/components/shared/page-transition";
import Link from "next/link";
import { formatCompactKES } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { useToast } from "@/components/ui/toast-provider";
import { ValuationFormModal } from "./valuation-form-modal";
import { type Property } from "./property-constants";
import { ValuationSubmitModal, type ValuationSubmitTarget } from "./valuation-complete-modal";
import { PortfolioHubNav } from "./portfolio-hub-nav";
import { PropertyOwnerProfileDrawer } from "./property-owner-profile-drawer";
import { PropertyManagerProfileDrawer } from "./property-manager-profile-drawer";
import {
  STAGE_META,
  STAGE_ORDER,
  canMoveToStage,
  daysSince,
  fmtDate,
  scoreForValuation,
  type ValuationStage,
  stageTone,
} from "./valuation-constants";

// ── Types (mirror the real /api/valuations response shape - listValuations
// now joins property/landlord/manager names server-side, so the board no
// longer needs its own separate properties/contacts/staff option fetches
// just to resolve display names) ──────────────────────────────────────────

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
  methodology: string | null;
  siteVisitAt: string | null;
  completedAt: string | null;
  validUntil: string | null;
  reportUrl: string | null;
  notes: string | null;
  stageEnteredAt: string;
  resultingMandateId: string | null;
  createdAt: string;
  propertyName: string | null;
  propertyLocation: string | null;
  propertyMedia: Array<{ url: string; alt?: string; isPrimary?: boolean }> | null;
  landlordName: string | null;
  landlordVerifiedAt: string | null;
  landlordAvatarUrl: string | null;
  managerName: string | null;
  managerAvatarUrl: string | null;
  isFeatured: boolean;
}

interface AuditEntry {
  id: string;
  summary: string;
  createdAt: string;
  actorName?: string | null;
  associatedId?: string | null;
}

type ViewMode = "board" | "grid" | "list";

// ── Board ──────────────────────────────────────────────────────────────────────

export function ValuationsBoard({ entityId = "group" }: { entityId?: string }) {
  const { pushToast } = useToast();
  const router = useRouter();

  const [valuations, setValuations] = useState<Valuation[]>([]);
  const [loading, setLoading] = useState(true);

  const [viewMode, setViewMode] = useState<ViewMode>("board");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const rowsPerPage = 8;

  const [formOpen, setFormOpen] = useState(false);
  const [editingValuation, setEditingValuation] = useState<Valuation | null>(null);
  const [submittingValuation, setSubmittingValuation] = useState<Valuation | null>(null);
  const [signConfirmId, setSignConfirmId] = useState<string | null>(null);
  const [isSigning, setIsSigning] = useState(false);

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<ValuationStage | null>(null);

  const [ownerContactId, setOwnerContactId] = useState<string | null>(null);
  const [managerUserId, setManagerUserId] = useState<string | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);

  const loadValuations = useCallback(async () => {
    Promise.resolve().then(() => setLoading(true));
    try {
      const res = await fetch(`/api/valuations?entityId=${entityId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load valuations");
      setValuations(data.valuations ?? []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load valuations";
      pushToast({ tone: "error", title: "Error", body: message });
    } finally {
      setLoading(false);
    }
  }, [entityId, pushToast]);

  useEffect(() => {
    Promise.resolve().then(() => loadValuations());
  }, [loadValuations]);

  // User-curated star toggle, parity with properties-board.tsx's real
  // handleToggleFeature - separate valuations.isFeatured column (not
  // properties.isFeatured) since an external/prospect valuation has no
  // property row yet to toggle.
  const [featuredCarouselIndex, setFeaturedCarouselIndex] = useState(0);
  const handleToggleFeature = async (id: string, currentlyFeatured: boolean) => {
    const nextVal = !currentlyFeatured;
    setValuations((prev) => prev.map((v) => (v.id === id ? { ...v, isFeatured: nextVal } : v)));
    try {
      const res = await fetch(`/api/valuations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityId, isFeatured: nextVal }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Failed to update featured status");
      pushToast({ tone: "success", title: "Updated", body: `Prospect is now ${nextVal ? "featured" : "unfeatured"}.` });
    } catch {
      setValuations((prev) => prev.map((v) => (v.id === id ? { ...v, isFeatured: currentlyFeatured } : v)));
      pushToast({ tone: "warning", title: "Error", body: "Could not update featured status." });
    }
  };

  useEffect(() => {
    if (!entityId) return;
    let active = true;
    fetch(`/api/properties?entityId=${entityId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active && data?.properties) setProperties(data.properties);
      })
      .catch((err) => console.error("Failed to load properties:", err));
    return () => { active = false; };
  }, [entityId]);

  // ── Valuation Activity Feed ─────────────────────────────────────────────────
  const [valuationActivity, setValuationActivity] = useState<AuditEntry[]>([]);
  const [valuationActivityLoading, setValuationActivityLoading] = useState(true);
  const [valuationActivityLoaded, setValuationActivityLoaded] = useState(false);

  const [activitySearchQuery, setActivitySearchQuery] = useState("");
  const [activityFilter, setActivityFilter] = useState("all");
  const [activityPage, setActivityPage] = useState(1);
  const ACTIVITY_PER_PAGE = 10;

  useEffect(() => {
    if (!entityId || valuationActivityLoaded) return;
    fetch(`/api/audit?entityId=${entityId}&associatedType=valuation&limit=150`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        setValuationActivity(data.entries ?? []);
        setValuationActivityLoading(false);
        setValuationActivityLoaded(true);
      })
      .catch(() => {
        setValuationActivity([]);
        setValuationActivityLoading(false);
        setValuationActivityLoaded(true);
      });
  }, [entityId, valuationActivityLoaded]);

  const subjectOf = useCallback((v: Valuation): { name: string; location: string; portfolio: boolean } => {
    if (v.propertyId) return { name: v.propertyName ?? "Portfolio property", location: v.propertyLocation ?? "-", portfolio: true };
    return { name: v.externalPropertyName ?? "Unknown subject", location: v.externalLocation ?? "-", portfolio: false };
  }, []);

  // Deterministic curated-image fallback so every valuation card always has a
  // property banner. Real propertyMedia wins; external/unlinked valuations get
  // a stable Unsplash image derived from the valuation's UUID (last 4 hex
  // chars → index into the pool), so the same prospect never flickers between
  // images across renders or sessions.
  const VALUATION_COVER_POOL = [
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
    // Stable index from last 4 hex chars of UUID
    const hash = parseInt(v.id.replace(/-/g, "").slice(-4), 16);
    return VALUATION_COVER_POOL[hash % VALUATION_COVER_POOL.length];
  }, []);

  const valuerLabel = useCallback((v: Valuation): string => {
    if (v.externalValuerName) return v.externalValuerName;
    if (v.valuerId) return v.managerName ?? "Internal valuer";
    return "Sunland Valuers Ltd";
  }, []);

  const ageDaysOf = useCallback((v: Valuation) => daysSince(v.stageEnteredAt), []);

  const scoreOf = useCallback((v: Valuation) => {
    if (STAGE_ORDER.indexOf(v.stage) < STAGE_ORDER.indexOf("valued") || v.stage === "declined" || !v.marketValueKes || !v.proposedFeeRate) return null;
    return scoreForValuation({
      proposedFeeRatePct: Number(v.proposedFeeRate) * 100,
      marketValueKes: Number(v.marketValueKes),
      landlordVerified: !!v.landlordVerifiedAt,
      ageDays: ageDaysOf(v),
    });
  }, [ageDaysOf]);

  // ── Derived analytics ────────────────────────────────────────────────────────

  const kpis = useMemo(() => {
    const active = valuations.filter((v) => v.stage !== "mandate_signed" && v.stage !== "declined");
    const awaitingDecision = valuations.filter((v) => v.stage === "valued").length;
    const pipelineValue = active.reduce((sum, v) => sum + (v.marketValueKes ? Number(v.marketValueKes) : 0), 0);
    const offersSentTotal = valuations.filter((v) => STAGE_ORDER.indexOf(v.stage) >= STAGE_ORDER.indexOf("offer_sent")).length;
    const mandatesTotal = valuations.filter((v) => v.stage === "mandate_signed").length;
    const convPct = offersSentTotal > 0 ? (mandatesTotal / offersSentTotal) * 100 : 0;
    const stalled = valuations.filter((v) => v.stage === "offer_sent" && ageDaysOf(v) > 21).length;
    return { inPipeline: active.length, awaitingDecision, pipelineValue, convPct, signedYtd: mandatesTotal, stalled };
  }, [valuations, ageDaysOf]);

  const pipelineBreakdown = useMemo(() => {
    const active = valuations.filter((v) => v.stage !== "mandate_signed" && v.stage !== "declined");
    const total = active.length;
    const setup = active.filter((v) => v.stage === "requested" || v.stage === "site_visit").length;
    const offer = active.filter((v) => v.stage === "valued" || v.stage === "offer_sent").length;
    const accepted = active.filter((v) => v.stage === "accepted").length;
    return { total, setup, offer, accepted };
  }, [valuations]);

  const scoreBasedProspect = useMemo(() => {
    const active = valuations.filter((v) => v.stage !== "mandate_signed" && v.stage !== "declined");
    if (active.length === 0) return null;
    return [...active].sort((a, b) => {
      const valA = a.marketValueKes ? Number(a.marketValueKes) : 0;
      const valB = b.marketValueKes ? Number(b.marketValueKes) : 0;
      return valB - valA;
    })[0];
  }, [valuations]);

  // Real, user-curated set wins over the auto-computed score-based pick -
  // same "augment, don't replace" rule properties-board.tsx follows for its
  // own featured carousel. Falls back to the score-based single card when
  // nobody has starred anything yet.
  const curatedFeatured = useMemo(() => {
    return valuations
      .filter((v) => v.isFeatured && v.stage !== "mandate_signed" && v.stage !== "declined")
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [valuations]);
  const safeFeaturedCarouselIndex = curatedFeatured.length === 0 ? 0 : Math.min(featuredCarouselIndex, curatedFeatured.length - 1);
  const featuredProspect = curatedFeatured.length > 0 ? curatedFeatured[safeFeaturedCarouselIndex] : scoreBasedProspect;
  const isCuratedFeatured = curatedFeatured.length > 0;

  const featuredPropertyMedia = useMemo(() => {
    if (!featuredProspect) return null;
    return featuredProspect.propertyMedia ?? null;
  }, [featuredProspect]);

  const actionItems = useMemo(() => {
    const items: Array<{ key: string; tone: "amber" | "rose"; icon: typeof IconFileCertificate; title: string; meta: string; cta: string; onClick: () => void; primary: boolean }> = [];
    const readyForOffer = valuations.find((v) => v.stage === "valued");
    if (readyForOffer) {
      items.push({
        key: "ready-offer",
        tone: "amber",
        icon: IconFileCertificate,
        title: `Valuation ready for offer decision - ${subjectOf(readyForOffer).name}`,
        meta: `${readyForOffer.valuationCode} · valued at ${formatCompactKES(Number(readyForOffer.marketValueKes))} · ${readyForOffer.managerName ?? "Unassigned"}`,
        cta: "Review & Send Offer",
        primary: true,
        onClick: () => router.push(`/admin/valuations/${readyForOffer.id}`),
      });
    }
    if (kpis.stalled > 0) {
      items.push({
        key: "stalled",
        tone: "rose",
        icon: IconClockExclamation,
        title: `${kpis.stalled} offer${kpis.stalled > 1 ? "s" : ""} stalled over 21 days`,
        meta: "No landlord response yet - consider a follow-up call",
        cta: "View stalled",
        primary: false,
        onClick: () => { setViewMode("list"); setQuery(""); },
      });
    }
    return items;
  }, [valuations, kpis.stalled, subjectOf, router]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return valuations
      .filter((v) => {
        if (!q) return true;
        const subject = subjectOf(v);
        return [v.valuationCode, subject.name, subject.location, v.landlordName, valuerLabel(v)]
          .some((s) => s?.toLowerCase().includes(q));
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [valuations, query, subjectOf, valuerLabel]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const visible = filtered.slice((page - 1) * rowsPerPage, page * rowsPerPage);

  // ── Activity filtering & pagination ─────────────────────────────────────────
  const filteredValuationActivity = useMemo(() => {
    let result = valuationActivity;
    if (activitySearchQuery) {
      const q = activitySearchQuery.toLowerCase();
      result = result.filter((e) =>
        e.summary.toLowerCase().includes(q) || e.actorName?.toLowerCase().includes(q)
      );
    }
    if (activityFilter !== "all") {
      result = result.filter((e) => {
        const lower = e.summary.toLowerCase();
        if (activityFilter === "stage_changes") return lower.includes("stage") || lower.includes("advance") || lower.includes("transition") || lower.includes("sign");
        if (activityFilter === "edits") return lower.includes("updat") || lower.includes("chang") || lower.includes("edit");
        if (activityFilter === "valuations") return lower.includes("valuat") || lower.includes("assess") || lower.includes("report");
        if (activityFilter === "system") return lower.includes("system") || lower.includes("auto");
        return true;
      });
    }
    return result;
  }, [valuationActivity, activitySearchQuery, activityFilter]);

  const activityTotalPages = Math.max(1, Math.ceil(filteredValuationActivity.length / ACTIVITY_PER_PAGE));
  const safeActivityPage = Math.min(activityPage, activityTotalPages);
  const paginatedValuationActivity = filteredValuationActivity.slice(
    (safeActivityPage - 1) * ACTIVITY_PER_PAGE,
    safeActivityPage * ACTIVITY_PER_PAGE,
  );

  const getActivityTone = (summary: string) => {
    const lower = summary.toLowerCase();
    if (lower.includes("decline") || lower.includes("delet") || lower.includes("reject")) return "bg-rose-300 ring-rose-50";
    if (lower.includes("sign") || lower.includes("mandate")) return "bg-[#f3df27] ring-amber-50";
    if (lower.includes("offer") || lower.includes("accept")) return "bg-emerald-400 ring-emerald-50";
    if (lower.includes("updat") || lower.includes("chang") || lower.includes("edit") || lower.includes("submit")) return "bg-indigo-300 ring-indigo-50";
    return "bg-slate-200 ring-white";
  };

  const relativeTime = (iso: string) => {
    const diff = new Date().getTime() - new Date(iso).getTime();
    const min = Math.floor(diff / 60000);
    if (min < 1) return "Just now";
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    const days = Math.floor(hr / 24);
    return days === 1 ? "Yesterday" : `${days}d ago`;
  };

  // ── Leaderboard + Pipeline by Manager (real aggregation over the fetched
  // list - never a hardcoded array) ────────────────────────────────────────

  const leaderboard = useMemo(() => {
    const byValuer = new Map<string, { name: string; value: number; count: number }>();
    for (const v of valuations) {
      if (v.stage !== "mandate_signed" && v.stage !== "valued" && STAGE_ORDER.indexOf(v.stage) < STAGE_ORDER.indexOf("valued")) continue;
      if (!v.marketValueKes) continue;
      const name = valuerLabel(v);
      const entry = byValuer.get(name) ?? { name, value: 0, count: 0 };
      entry.value += Number(v.marketValueKes);
      entry.count += 1;
      byValuer.set(name, entry);
    }
    return Array.from(byValuer.values())
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)
      .map((entry, idx) => ({ ...entry, rank: idx + 1 }));
  }, [valuations, valuerLabel]);

  const mgrPipeline = useMemo(() => {
    const byMgr = new Map<string, { name: string; count: number }>();
    for (const v of valuations) {
      if (v.stage === "mandate_signed" || v.stage === "declined") continue;
      const name = v.managerName ?? "Unassigned";
      const entry = byMgr.get(name) ?? { name, count: 0 };
      entry.count += 1;
      byMgr.set(name, entry);
    }
    const maxCount = Math.max(1, ...Array.from(byMgr.values()).map((e) => e.count));
    return Array.from(byMgr.values())
      .sort((a, b) => b.count - a.count)
      .map((entry) => ({ ...entry, barPct: Math.round((entry.count / maxCount) * 100) }));
  }, [valuations]);

  const completedThisMonth = useMemo(() => {
    const now = new Date();
    return valuations.filter((v) => v.stage === "mandate_signed" && new Date(v.stageEnteredAt).getMonth() === now.getMonth() && new Date(v.stageEnteredAt).getFullYear() === now.getFullYear()).length;
  }, [valuations]);

  // ── Mutations ────────────────────────────────────────────────────────────────

  const openCreate = () => { setEditingValuation(null); setFormOpen(true); };
  const openEdit = (v: Valuation) => { setEditingValuation(v); setFormOpen(true); };

  const transitionStage = async (v: Valuation, toStage: ValuationStage) => {
    if (!canMoveToStage(v.stage, toStage)) return;
    if (toStage === "valued") { setSubmittingValuation(v); return; }
    if (toStage === "mandate_signed") { setSignConfirmId(v.id); return; }

    // Optimistic update, rolled back on failure.
    setValuations((prev) => prev.map((x) => (x.id === v.id ? { ...x, stage: toStage } : x)));
    try {
      const res = await fetch(`/api/valuations/${v.id}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityId, stage: toStage }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to move stage");
      pushToast({ tone: toStage === "declined" ? "info" : "success", title: `${v.valuationCode} → ${STAGE_META[toStage].label}`, body: "" });
      loadValuations();
    } catch (err) {
      loadValuations();
      pushToast({ tone: "error", title: "Error", body: err instanceof Error ? err.message : "Failed to move stage" });
    }
  };

  const handleSignMandate = async () => {
    if (!signConfirmId) return;
    setIsSigning(true);
    try {
      const res = await fetch(`/api/valuations/${signConfirmId}/sign-mandate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to sign mandate");
      pushToast({ tone: "success", title: "Mandate Created", body: "The prospect is now a real management mandate." });
      loadValuations();
    } catch (err) {
      pushToast({ tone: "error", title: "Error", body: err instanceof Error ? err.message : "Failed to sign mandate" });
    } finally {
      setIsSigning(false);
      setSignConfirmId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmId) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/valuations/${deleteConfirmId}?entityId=${entityId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete valuation");
      pushToast({ tone: "success", title: "Valuation Deleted", body: "The prospect has been removed." });
      loadValuations();
    } catch (err) {
      pushToast({ tone: "error", title: "Error", body: err instanceof Error ? err.message : "Failed to delete valuation" });
    } finally {
      setIsDeleting(false);
      setDeleteConfirmId(null);
    }
  };

  // ── Kanban stage board data ─────────────────────────────────────────────────

  const stageColumns = useMemo(() => {
    const defs: ValuationStage[] = [...STAGE_ORDER, "declined"];
    return defs.map((stage) => ({
      stage,
      cards: filtered.filter((v) => v.stage === stage),
    }));
  }, [filtered]);

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <PageTransition className="mx-auto flex max-w-[98rem] flex-col gap-5">
      <BoardHeader
        eyebrow={<Badge tone="primary">Estate Portfolio</Badge>}
        title="Valuations & Acquisition Pipeline"
        description="From site visit to signed mandate: a property manager scouts and values a prospect, Front Office sends the landlord an offer to manage, and acceptance becomes a mandate."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={loadValuations}>
              <IconRefresh size={14} /> Refresh
            </Button>
            <Button size="sm" onClick={openCreate}>
              <IconPlus size={14} /> Schedule Valuation
            </Button>
          </div>
        }
      />

      <PortfolioHubNav active="valuations" />

      <div className="flex items-center gap-4 mt-2">
        <hr className="flex-1 border-slate-200/60" />
        <span className="label-caps text-slate-600 tracking-wider">Pipeline Signals</span>
        <hr className="flex-1 border-slate-200/60" />
      </div>

      {/* ── Tertiary-gradient KPI tier ── */}
      <div className="gsap-stagger bg-tertiary-gradient border border-[#122a20]/80 p-1.5 rounded-[24px] shadow-xl relative overflow-hidden group">
        <div className="absolute right-0 top-0 size-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-emerald-500/20 transition-colors duration-700 -z-10" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 divide-y md:divide-y-0 md:divide-x divide-white/10">
          <div className="relative p-5 sm:p-6 flex flex-col justify-between overflow-hidden">
            <IconTelescope size={96} stroke={1} className="absolute right-[-10px] bottom-[-16px] text-white/[0.05] pointer-events-none" />
            <div>
              <p className="relative body-sm text-slate-300">In Pipeline</p>
              <div className="relative mt-2">
                <span className="font-mono text-white text-4xl leading-none">{kpis.inPipeline}</span>
              </div>
            </div>
            {pipelineBreakdown.total > 0 && (
              <div className="relative mt-3">
                <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                  {pipelineBreakdown.setup > 0 && (
                    <div className="h-full bg-slate-300" style={{ width: `${(pipelineBreakdown.setup / pipelineBreakdown.total) * 100}%` }} />
                  )}
                  {pipelineBreakdown.offer > 0 && (
                    <div className="h-full bg-amber-400" style={{ width: `${(pipelineBreakdown.offer / pipelineBreakdown.total) * 100}%` }} />
                  )}
                  {pipelineBreakdown.accepted > 0 && (
                    <div className="h-full bg-emerald-400" style={{ width: `${(pipelineBreakdown.accepted / pipelineBreakdown.total) * 100}%` }} />
                  )}
                </div>
                <div className="mt-2 flex items-center gap-2 flex-wrap">
                  <span className="flex items-center gap-1 text-xxs font-medium uppercase tracking-wider text-slate-600">
                    <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />{pipelineBreakdown.setup} prospecting
                  </span>
                  <span className="flex items-center gap-1 text-xxs font-medium uppercase tracking-wider text-amber-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />{pipelineBreakdown.offer} valuation
                  </span>
                  <span className="flex items-center gap-1 text-xxs font-medium uppercase tracking-wider text-emerald-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />{pipelineBreakdown.accepted} accepted
                  </span>
                </div>
              </div>
            )}
          </div>
          <div className="p-5 sm:p-6 flex flex-col justify-between gap-3">
            <p className="body-sm text-slate-300">Prospective Value</p>
            <div>
              <span className="font-mono text-white text-4xl leading-none">{formatCompactKES(kpis.pipelineValue)}</span>
              <p className="mt-1.5 text-xxs font-medium uppercase tracking-wide text-white/40">valued, not yet mandated</p>
            </div>
          </div>
          <div className="p-5 sm:p-6 flex items-center gap-3.5">
            <svg width="56" height="56" viewBox="0 0 64 64" role="img" aria-label={`Conversion rate ${Math.round(kpis.convPct)}%`}>
              <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="7" />
              <circle
                cx="32" cy="32" r="26" fill="none" stroke="#f3df27" strokeWidth="7" strokeLinecap="round"
                strokeDasharray={`${(kpis.convPct / 100) * 163.4} 163.4`}
                transform="rotate(-90 32 32)"
              />
            </svg>
            <div>
              <p className="body-sm text-slate-300 mb-0.5">Offer→Mandate</p>
              <p className="mono-stat  text-white text-2xl leading-none">{Math.round(kpis.convPct)}%</p>
              <p className="mt-1 text-xxs font-medium uppercase tracking-wide text-emerald-300">last 12 months</p>
            </div>
          </div>
          <div className="relative p-5 sm:p-6 flex flex-col justify-between gap-3 overflow-hidden">
            <IconFileCertificate size={96} stroke={1} className="absolute right-[-10px] bottom-[-16px] text-[#f3df27]/[0.09] pointer-events-none" />
            <p className="relative body-sm text-slate-300">Mandates Signed YTD</p>
            <div className="relative">
              <span className="font-mono text-white text-4xl leading-none">{kpis.signedYtd}</span>
              <p className="mt-1.5 text-xxs font-medium uppercase tracking-wide text-slate-400">from this pipeline</p>
            </div>
          </div>
          <div className="relative p-5 sm:p-6 flex flex-col justify-between gap-3 overflow-hidden">
            <IconClockExclamation size={96} stroke={1} className="absolute right-[-10px] bottom-[-16px] text-rose-500/10 pointer-events-none" />
            <p className="relative body-sm text-slate-300">Stalled &gt; 21 days</p>
            <div className="relative">
              <span className="font-mono text-white text-4xl leading-none">{kpis.stalled}</span>
              <p className="mt-1.5 text-xxs font-medium uppercase tracking-wide text-rose-300">no landlord response</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Action-required band ── */}
      {actionItems.length > 0 && (
        <div className={cn("grid gap-3.5 animate-fade-in-up", actionItems.length > 1 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1")}>
          {actionItems.map((item) => (
            <div
              key={item.key}
              className={cn(
                "rounded-2xl p-4 flex items-center justify-between gap-4 border shadow-sm transition-all duration-300 hover:shadow-md",
                item.tone === "amber" ? "border-amber-200 bg-amber-500/[0.04]" : "border-rose-100 bg-rose-500/[0.02]",
              )}
            >
              <div className="flex items-start gap-3 min-w-0">
                <span className={cn(
                  "size-9 rounded-xl flex items-center justify-center shrink-0 shadow-xs",
                  item.tone === "amber" ? "bg-amber-100/80 text-amber-700" : "bg-rose-100/80 text-rose-600",
                )}>
                  <item.icon size={18} />
                </span>
                <div className="min-w-0">
                  <p className="font-sans text-sm font-medium text-slate-950 truncate leading-snug">{item.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5 truncate font-medium">{item.meta}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={item.onClick}
                className={cn(
                  "rounded-xl px-4 py-1.5 text-xs font-medium whitespace-nowrap transition-colors shadow-sm",
                  item.primary ? "bg-[#f3df27] text-[#151936] hover:bg-[#e6d220]" : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50",
                )}
              >
                {item.cta}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Featured & Highlights ── */}
      {featuredProspect && (
        <>
          <div className="flex items-center gap-4 my-6">
            <hr className="flex-1 border-slate-200/60" />
            <span className="label-caps text-slate-600 tracking-wider">Featured & Highlights</span>
            <hr className="flex-1 border-slate-200/60" />
          </div>

          <div className="gsap-stagger mb-8 relative">
            <div className="bg-white border border-slate-100 rounded-[32px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden flex flex-col lg:flex-row group transition-all duration-500 hover:shadow-[0_16px_40px_rgb(0,0,0,0.06)] relative z-10">

              {/* Left Side: Gradient artwork or media image */}
              <div className="lg:w-[35%] shrink-0 relative min-h-[280px] lg:min-h-0 bg-[#0d211a]">
                <div className="absolute top-5 left-5 z-20 flex items-center gap-2">
                  <span className="bg-[#151936] text-[#f3df27] flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium uppercase tracking-wider shadow-sm border border-slate-700/30">
                    <IconStarFilled size={12} className="text-[#f3df27] shrink-0" /> {isCuratedFeatured ? "Featured" : "High-Value Prospect"}
                  </span>
                </div>
                <div className="absolute top-5 right-5 z-20 flex items-center gap-2">
                  {curatedFeatured.length > 1 && (
                    <>
                      <button
                        type="button"
                        onClick={() => setFeaturedCarouselIndex((i) => (i === 0 ? curatedFeatured.length - 1 : i - 1))}
                        aria-label="Previous featured prospect"
                        className="size-7 rounded-full bg-white/15 backdrop-blur-sm text-white flex items-center justify-center hover:bg-white/25 transition-colors"
                      >
                        <IconChevronLeft size={14} />
                      </button>
                      <span className="label-caps text-white/70 tabular-nums">{safeFeaturedCarouselIndex + 1}&thinsp;/&thinsp;{curatedFeatured.length}</span>
                      <button
                        type="button"
                        onClick={() => setFeaturedCarouselIndex((i) => (i === curatedFeatured.length - 1 ? 0 : i + 1))}
                        aria-label="Next featured prospect"
                        className="size-7 rounded-full bg-white/15 backdrop-blur-sm text-white flex items-center justify-center hover:bg-white/25 transition-colors"
                      >
                        <IconChevronRight size={14} />
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => handleToggleFeature(featuredProspect.id, !!featuredProspect.isFeatured)}
                    aria-label={featuredProspect.isFeatured ? "Remove from featured" : "Add to featured"}
                    aria-pressed={!!featuredProspect.isFeatured}
                    className={cn(
                      "size-7 rounded-full backdrop-blur-sm flex items-center justify-center transition-colors",
                      featuredProspect.isFeatured ? "bg-amber-400 text-[#151936]" : "bg-white/15 text-white hover:bg-amber-400 hover:text-[#151936]"
                    )}
                  >
                    {featuredProspect.isFeatured ? <IconStarFilled size={13} /> : <IconStar size={13} />}
                  </button>
                </div>

                <Image
                  src={coverImageOf(featuredProspect)}
                  alt={subjectOf(featuredProspect).name}
                  fill
                  sizes="(max-width: 1024px) 100vw, 35vw"
                  className="object-cover transition-transform duration-1000 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/20 to-transparent" />

                {/* Overlay Data */}
                <div className="absolute bottom-6 left-6 right-6">
                  <p className="mono-data text-xs text-slate-400 font-mono mb-1">
                    {featuredProspect.valuationCode}
                  </p>
                  <h3 className="text-2xl font-serif text-white font-medium">
                    {subjectOf(featuredProspect).name}
                  </h3>
                  <p className="text-xs text-white/60 truncate mt-1">
                    {subjectOf(featuredProspect).location}
                  </p>
                </div>
              </div>

              {/* Right Side: Valuation & Fit Data */}
              <div className="flex-1 p-8 lg:p-10 flex flex-col lg:flex-row gap-8 relative bg-white overflow-hidden justify-between items-stretch">
                <div className="absolute -top-32 -right-32 opacity-[0.015] text-[#122a20] pointer-events-none">
                  <IconTelescope size={400} stroke={0.5} />
                </div>

                <div className="flex-1 flex flex-col justify-between relative z-10 gap-5">
                  <div className="flex items-center gap-3 flex-wrap">
                    <Badge tone={stageTone(featuredProspect.stage)}>
                      {(STAGE_META[featuredProspect.stage] ?? STAGE_META.requested).label}
                    </Badge>
                    {scoreOf(featuredProspect) && (
                      <span className="text-xs font-mono text-slate-600 tracking-wider uppercase font-semibold">
                        Grade {scoreOf(featuredProspect)?.grade} Fit
                      </span>
                    )}
                  </div>

                  <div>
                    {scoreOf(featuredProspect) ? (
                      <>
                        <div className="flex items-center justify-between text-xs text-slate-500 font-mono tracking-wider mb-2">
                          <span>ACQUISITION FIT SCORE</span>
                          <span className="font-medium text-slate-950">{scoreOf(featuredProspect)?.score}%</span>
                        </div>
                        <div className="h-2 bg-slate-200/60 rounded-full overflow-hidden w-full">
                          <div
                            style={{ width: `${scoreOf(featuredProspect)?.score}%` }}
                            className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                          />
                        </div>
                      </>
                    ) : (
                      <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex items-center justify-between gap-4">
                        <div>
                          <p className="text-xs text-slate-500 font-medium">ESTIMATED VALUE PENDING</p>
                          <p className="text-xs text-slate-600 mt-1">Acquisition fit score will be determined upon submission of assessed market values.</p>
                        </div>
                        <span className="text-xs font-mono text-slate-600 uppercase tracking-widest shrink-0">Stage: {featuredProspect.stage}</span>
                      </div>
                    )}
                  </div>

                  {/* Landlord and Manager Avatars */}
                  <div className="flex items-center gap-6 flex-wrap mt-2">
                    {featuredProspect.landlordName && (
                      <button
                        type="button"
                        onClick={() => {
                          if (featuredProspect.landlordContactId) setOwnerContactId(featuredProspect.landlordContactId);
                        }}
                        className="flex items-center gap-3 hover:bg-slate-50 transition-colors p-1.5 rounded-2xl text-left border border-transparent hover:border-slate-100/80 group/avatar shrink-0"
                      >
                        <Avatar
                          src={featuredProspect.landlordAvatarUrl ?? undefined}
                          fallback={featuredProspect.landlordName.slice(0, 1)}
                          className="size-10 shrink-0"
                        />
                        <div className="min-w-0">
                          <span className="block text-sm font-medium text-slate-950 group-hover/avatar:text-[#151936] transition-colors leading-tight truncate">{featuredProspect.landlordName}</span>
                          <span className="block text-xs text-slate-500 tracking-wider font-mono uppercase mt-0.5">Landlord</span>
                        </div>
                      </button>
                    )}

                    {featuredProspect.managerName && (
                      <button
                        type="button"
                        onClick={() => {
                          if (featuredProspect.assignedManagerId) setManagerUserId(featuredProspect.assignedManagerId);
                        }}
                        className="flex items-center gap-3 hover:bg-slate-50 transition-colors p-1.5 rounded-2xl text-left border border-transparent hover:border-slate-100/80 group/avatar shrink-0"
                      >
                        <Avatar
                          src={featuredProspect.managerAvatarUrl ?? undefined}
                          fallback={featuredProspect.managerName.split(" ").map((w) => w[0]).slice(0, 2).join("")}
                          className="size-10 shrink-0"
                        />
                        <div className="min-w-0">
                          <span className="block text-sm font-medium text-slate-950 group-hover/avatar:text-[#151936] transition-colors leading-tight truncate">{featuredProspect.managerName}</span>
                          <span className="block text-xs text-slate-500 tracking-wider font-mono uppercase mt-0.5">Manager</span>
                        </div>
                      </button>
                    )}
                  </div>

                  {/* Financials & Action Buttons */}
                  <div className="border-t border-slate-100 pt-4 flex items-center justify-between gap-4 flex-wrap mt-2">
                    <div className="flex flex-col">
                      <span className="text-xxs font-mono tracking-wider text-slate-600 uppercase">Prospective Market Value</span>
                      <span className="font-mono text-xl font-medium text-slate-900 mt-0.5">
                        {featuredProspect.marketValueKes ? formatCompactKES(Number(featuredProspect.marketValueKes)) : "—"}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        onClick={() => router.push(`/admin/valuations/${featuredProspect.id}`)}
                        className="h-9 px-4 text-xs font-medium rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-1.5 shadow-xs"
                      >
                        Open Valuation File <IconExternalLink size={14} />
                      </Button>

                      {featuredProspect.stage === "site_visit" && (
                        <Button
                          onClick={() => setSubmittingValuation(featuredProspect)}
                          className="bg-[#151936] text-white hover:bg-opacity-90 transition rounded-xl px-4 h-9 text-xs font-medium flex items-center gap-1.5 shadow-sm"
                        >
                          Submit Valuation <IconShieldCheck size={14} />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right-most mini column slot */}
                <div className="hidden lg:flex w-[200px] shrink-0 border-l border-slate-100 pl-8 flex-col justify-center items-center text-center">
                  <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 flex flex-col justify-center items-center w-full min-h-[140px] shadow-xs relative overflow-hidden">
                    <div className="absolute top-0 right-0 size-16 bg-[#122a20]/5 rounded-bl-full pointer-events-none" />
                    <span className="text-[10px] font-mono tracking-wider text-slate-600 uppercase">Methodology</span>
                    <span className="font-serif text-slate-800 text-sm font-semibold mt-1.5 block">
                      {featuredProspect.methodology || "Comparative Method"}
                    </span>
                    <div className="h-px bg-slate-200 w-12 my-3.5" />
                    <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest bg-white border border-slate-200 px-2 py-0.5 rounded-full">
                      {featuredProspect.isLand ? "Land Plot" : "Built Property"}
                    </span>
                  </div>
                </div>

              </div>

            </div>
          </div>
        </>
      )}

      {/* ── Pipeline board ── */}
      <div className="bg-transparent lg:bg-white border-transparent lg:border-slate-100 p-0 lg:p-6 shadow-none lg:shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-[24px] mt-1">
        <div className="flex items-center gap-2.5 flex-wrap mb-4">
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <IconSearch size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600" />
            <input
              value={query}
              onChange={(e) => { setQuery(e.target.value); setPage(1); }}
              placeholder="Search property, landlord, valuer…"
              className="w-full bg-slate-50 border border-slate-200/60 rounded-xl pl-9 pr-3 py-2 body-sm text-slate-900 outline-none placeholder:text-slate-600 focus:bg-white focus:ring-2 focus:ring-[#151936]/10 focus:border-[#151936]/30 transition-all shadow-sm"
            />
          </div>
          <div className="flex bg-slate-100 p-1 rounded-xl gap-1 ml-auto items-center">
            <button onClick={() => setViewMode("board")} className={cn("flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors", viewMode === "board" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-700")}>
              <IconLayoutKanban size={14} /> Pipeline
            </button>
            <button onClick={() => setViewMode("grid")} className={cn("flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors", viewMode === "grid" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-700")}>
              <IconLayoutGrid size={14} /> Grid
            </button>
            {viewMode === "board" && (
              <span className="hidden sm:flex items-center gap-1 px-2.5 py-1 text-xxs font-mono uppercase tracking-wider text-slate-600 select-none border-l border-slate-200/80 my-1 shrink-0">
                <IconArrowsMove size={12} className="text-slate-600 shrink-0" /> drag cards to advance
              </span>
            )}
            <button onClick={() => setViewMode("list")} className={cn("flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors", viewMode === "list" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-700")}>
              <IconList size={14} /> All Records
            </button>
          </div>
          <button
            onClick={() => router.push("/admin/valuations/kanban")}
            className="inline-flex items-center gap-1.5 bg-tertiary-gradient text-white rounded-xl px-3.5 py-2 text-xs font-medium hover:bg-[#1d2347] transition-colors shrink-0"
          >
            <IconMaximize size={14} /> Open Focus Board
          </button>
        </div>

        {loading ? (
          <div className="space-y-4 py-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-16 bg-slate-100 animate-pulse rounded-2xl" />
            ))}
          </div>
        ) : valuations.length === 0 ? (
          <div className="py-12">
            <EmptyState
              icon={IconTelescope}
              title="No prospects yet"
              description="Schedule the first valuation - portfolio properties and new prospects both qualify."
              action="Schedule Valuation"
              onClick={openCreate}
            />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12">
            <EmptyState
              icon={IconSearch}
              title="Nothing matches"
              description="No prospects match the current search."
              action="Clear Search"
              onClick={() => { setQuery(""); setPage(1); }}
            />
          </div>
        ) : viewMode === "board" ? (
          <div className="overflow-x-auto">
            <div className="grid grid-flow-col auto-cols-[230px] gap-3.5 items-start">
              {stageColumns.map(({ stage, cards }) => {
                const cfg = STAGE_META[stage];
                const draggedCard = dragId ? valuations.find((v) => v.id === dragId) : null;
                const canDrop = draggedCard ? canMoveToStage(draggedCard.stage, stage) : false;
                const isOver = dragOverStage === stage && canDrop;
                return (
                  <div
                    key={stage}
                    className="flex flex-col gap-2.5"
                    onDragOver={(e) => { if (canDrop) { e.preventDefault(); if (dragOverStage !== stage) setDragOverStage(stage); } }}
                    onDragLeave={() => { if (dragOverStage === stage) setDragOverStage(null); }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const id = dragId;
                      setDragId(null);
                      setDragOverStage(null);
                      const card = id ? valuations.find((v) => v.id === id) : null;
                      if (!card || card.stage === stage || !canMoveToStage(card.stage, stage)) return;
                      transitionStage(card, stage);
                    }}
                  >
                    <div className={cn("flex items-center justify-between gap-2 px-1 py-1 rounded-lg transition-colors", isOver && "bg-slate-100")}>
                      <span className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                        <span className={cn("size-2 rounded-full", cfg.dot)} /> {cfg.label}
                      </span>
                      <span className="text-xs font-mono text-slate-600 bg-slate-100 rounded-full px-2 py-0.5">{cards.length}</span>
                    </div>
                    <div className={cn(
                      "flex flex-col gap-2 rounded-2xl p-0.5 transition-all",
                      isOver ? "bg-slate-50 ring-2 ring-slate-300 ring-inset" : (draggedCard && canDrop ? "ring-1 ring-slate-200 ring-inset" : ""),
                    )} style={{ minHeight: draggedCard && canDrop ? 56 : 8 }}>
                      {cards.map((v) => {
                        const subject = subjectOf(v);
                        const score = scoreOf(v);
                        const firstImage = coverImageOf(v);
                        const isStalled = v.stage === "offer_sent" && ageDaysOf(v) > 21;
                        return (
                          <div
                            key={v.id}
                            draggable={stage !== "mandate_signed"}
                            onDragStart={() => setDragId(v.id)}
                            onDragEnd={() => { setDragId(null); setDragOverStage(null); }}
                            onClick={() => router.push(`/admin/valuations/${v.id}`)}
                            role="button"
                            tabIndex={0}
                            className={cn(
                              "text-left w-full bg-white border rounded-2xl overflow-hidden hover:shadow-[0_8px_20px_rgb(0,0,0,0.05)] hover:border-slate-200 transition-all cursor-grab group/card flex flex-col gap-0",
                              dragId === v.id ? "opacity-50 border-[#f3df27]" : "border-slate-100",
                            )}
                          >
                            {/* Property Media / Artwork Banner */}
                            <div className="relative h-24 w-full bg-[#0d211a] overflow-hidden shrink-0">
                              <Image
                                src={firstImage}
                                alt={subject.name}
                                fill
                                sizes="180px"
                                className="object-cover transition-transform duration-500 group-hover/card:scale-105"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent" />

                              {/* Floating Badges inside Banner */}
                              <div className="absolute top-2 left-2 flex items-center gap-1 z-10">
                                <div className={cn("size-6 rounded-md flex items-center justify-center bg-[#151936]/80 text-white backdrop-blur-xs shadow-xs border border-slate-700/20")}>
                                  {subject.portfolio ? <IconBuildingCommunity size={12} /> : <IconExternalLink size={12} />}
                                </div>
                                {isStalled && (
                                  <span className="bg-rose-50 text-white text-xxs font-medium uppercase tracking-wider px-1.5 py-0.5 rounded shadow-sm">
                                    Stalled
                                  </span>
                                )}
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); handleToggleFeature(v.id, !!v.isFeatured); }}
                                  aria-label={v.isFeatured ? "Remove from featured" : "Add to featured"}
                                  aria-pressed={!!v.isFeatured}
                                  className={cn(
                                    "size-6 rounded-md flex items-center justify-center backdrop-blur-xs shadow-xs border transition-colors",
                                    v.isFeatured ? "bg-amber-400 border-amber-300 text-[#151936]" : "bg-[#151936]/80 border-slate-700/20 text-white hover:bg-amber-400 hover:text-[#151936]"
                                  )}
                                >
                                  {v.isFeatured ? <IconStarFilled size={11} /> : <IconStar size={11} />}
                                </button>
                              </div>

                              {score && (
                                <span className="absolute top-2 right-2 bg-white/95 text-slate-800 rounded px-1.5 py-0.5 text-xxs font-mono font-medium shadow-xs border border-slate-150" title="Acquisition Fit Score">
                                  <span style={{ color: score.color }} className="font-medium mr-0.5">{score.grade}</span> {score.score}
                                </span>
                              )}

                              {v.managerName && (
                                <span className="absolute bottom-2 right-2 size-6 rounded-full bg-[#151936] text-[#f3df27] text-xxs font-mono font-medium flex items-center justify-center border border-white shadow-xs" title={`Assigned PM: ${v.managerName}`}>
                                  {v.managerName.split(" ").map((w) => w[0]).slice(0, 2).join("")}
                                </span>
                              )}
                            </div>

                            {/* Card Body */}
                            <div className="p-3 flex flex-col flex-1">
                              <p className="text-md font-medium text-slate-900 leading-snug truncate group-hover/card:text-[#151936] transition-colors">{subject.name}</p>

                              {/* Landlord Row */}
                              <div className="flex items-center gap-1.5 mt-2">
                                <Avatar
                                  src={v.landlordAvatarUrl ?? undefined}
                                  fallback={v.landlordName ? v.landlordName.slice(0, 1) : "?"}
                                  className="size-5 bg-slate-100 border border-slate-200 text-slate-700 text-[10px] font-medium shrink-0"
                                />
                                <span className="text-xs text-slate-500 font-medium truncate">{v.landlordName || "No Landlord"}</span>
                              </div>

                              <div className="h-px bg-slate-100/80 my-2" />

                              <div className="flex items-center justify-between mt-auto">
                                <span className="font-mono text-xs text-[#122a20] font-medium">{v.marketValueKes ? formatCompactKES(Number(v.marketValueKes)) : "—"}</span>
                                <Badge tone="neutral" className="font-mono text-xs px-1.5 py-0.5 shrink-0">
                                  {ageDaysOf(v)}d
                                </Badge>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      {cards.length === 0 && draggedCard && canDrop && (
                        <div className="flex items-center justify-center h-14 border-[1.5px] border-dashed border-slate-300 rounded-xl text-xs font-medium text-slate-600">
                          Drop here
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {visible.map((v) => {
              const subject = subjectOf(v);
              const cfg = STAGE_META[v.stage] ?? STAGE_META.requested;
              const score = scoreOf(v);
              const firstImage = coverImageOf(v);
              return (
                <div
                  key={v.id}
                  onClick={() => router.push(`/admin/valuations/${v.id}`)}
                  role="button"
                  tabIndex={0}
                  className="bg-white border border-slate-100 rounded-3xl overflow-hidden hover:shadow-[0_12px_30px_rgb(0,0,0,0.06)] transition-all cursor-pointer group/card flex flex-col gap-0"
                >
                  {/* Property Image Banner */}
                  <div className="relative h-36 w-full bg-[#0d211a] overflow-hidden shrink-0">
                      <Image
                        src={firstImage}
                        alt={subject.name}
                        fill
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 33vw"
                        className="object-cover transition-transform duration-500 group-hover/card:scale-105"
                      />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent" />

                    {/* Floating Badges inside Image */}
                    <div className="absolute top-3 left-3 flex items-center gap-1.5 z-10">
                      <Badge tone={stageTone(v.stage)} className="backdrop-blur-xs">
                        {cfg.label}
                      </Badge>
                    </div>

                    <div className="absolute top-3 right-3 flex items-center gap-1.5 z-10">
                      {score && (
                        <span className="bg-white/95 text-slate-800 rounded-lg px-2 py-0.5 text-xs font-mono font-medium shadow-xs border border-slate-150" title="Acquisition Fit Score">
                          <span style={{ color: score.color }} className="font-medium mr-0.5">{score.grade}</span> {score.score}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleToggleFeature(v.id, !!v.isFeatured); }}
                        aria-label={v.isFeatured ? "Remove from featured" : "Add to featured"}
                        aria-pressed={!!v.isFeatured}
                        className={cn(
                          "size-7 rounded-lg flex items-center justify-center backdrop-blur-sm shadow-xs transition-colors",
                          v.isFeatured ? "bg-amber-400 text-[#151936]" : "bg-black/30 text-white hover:bg-amber-400 hover:text-[#151936]"
                        )}
                      >
                        {v.isFeatured ? <IconStarFilled size={13} /> : <IconStar size={13} />}
                      </button>
                    </div>

                    {v.managerName && (
                      <span className="absolute bottom-3 right-3 size-8 rounded-full bg-[#151936] text-[#f3df27] text-xs font-mono font-medium flex items-center justify-center border-2 border-white shadow-md" title={`Assigned PM: ${v.managerName}`}>
                        {v.managerName.split(" ").map((w) => w[0]).slice(0, 2).join("")}
                      </span>
                    )}
                  </div>

                  {/* Info Area */}
                  <div className="p-5 flex-1 flex flex-col justify-between">
                    <div className="min-w-0 mb-4">
                      <p className="text-base font-medium text-slate-900 truncate leading-snug group-hover/card:text-[#151936] transition-colors">{subject.name}</p>
                      <p className="text-xs text-slate-500 truncate mt-1.5 flex items-center gap-1">
                        <IconMapPin size={12} className="text-slate-600 shrink-0" /> {subject.location}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 mb-4">
                      <Avatar
                        src={v.landlordAvatarUrl ?? undefined}
                        fallback={v.landlordName ? v.landlordName.slice(0, 1) : "?"}
                        className="size-6 bg-slate-100 border border-slate-200 text-slate-700 text-[10px] font-medium shrink-0"
                      />
                      <div className="min-w-0">
                        {v.landlordName ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (v.landlordContactId) setOwnerContactId(v.landlordContactId);
                            }}
                            className="block text-xs font-medium text-slate-900 hover:text-[#151936] hover:underline truncate leading-none"
                          >
                            {v.landlordName}
                          </button>
                        ) : (
                          <span className="block text-xs font-medium text-slate-600 leading-none">No Landlord</span>
                        )}
                        <span className="block text-xs text-slate-600 font-mono uppercase tracking-wider mt-0.5">Prospective Landlord</span>
                      </div>
                    </div>

                    <div className="h-px bg-slate-100 my-3" />

                    <div className="flex items-center justify-between mt-auto">
                      <span className="font-mono text-sm text-[#122a20] font-medium">{v.marketValueKes ? formatCompactKES(Number(v.marketValueKes)) : "—"}</span>
                      <Badge tone="neutral" className="font-mono text-xs px-2.5 py-1 shrink-0">
                        {ageDaysOf(v)}d
                      </Badge>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Mobile View: card-like blocks */}
            <div className="flex flex-col gap-3.5 lg:hidden">
              {visible.map((v) => {
                const subject = subjectOf(v);
                const cfg = STAGE_META[v.stage] ?? STAGE_META.requested;
                const score = scoreOf(v);
                return (
                  <div
                    key={v.id}
                    onClick={() => router.push(`/admin/valuations/${v.id}`)}
                    className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm hover:shadow-md cursor-pointer transition-all duration-200"
                  >
                    <div className="flex items-center justify-between gap-2 mb-2.5">
                      <span className="mono-data text-xs text-slate-600">{v.valuationCode}</span>
                      <Badge tone={stageTone(v.stage)}>
                        {cfg.label}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-3 mb-3">
                      <div className={cn("size-10 rounded-lg border flex items-center justify-center shrink-0", subject.portfolio ? "bg-teal-50 border-teal-100 text-teal-600" : "bg-slate-50 border-slate-200 text-slate-600")}>
                        {subject.portfolio ? <IconBuildingCommunity size={18} /> : <IconExternalLink size={18} />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-900 truncate">{subject.name}</p>
                        <p className="text-xs text-slate-500 truncate">{subject.location}</p>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleToggleFeature(v.id, !!v.isFeatured); }}
                        aria-label={v.isFeatured ? "Remove from featured" : "Add to featured"}
                        aria-pressed={!!v.isFeatured}
                        className={cn(
                          "size-8 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                          v.isFeatured ? "bg-amber-400 text-[#151936]" : "bg-slate-50 border border-slate-100 text-slate-400 hover:text-amber-500 hover:bg-amber-50"
                        )}
                      >
                        {v.isFeatured ? <IconStarFilled size={14} /> : <IconStar size={14} />}
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2 border-t border-slate-50 pt-3 text-xs">
                      <div>
                        <p className="label-caps text-slate-600 mb-0.5">Landlord</p>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (v.landlordContactId) setOwnerContactId(v.landlordContactId);
                          }}
                          className="font-medium text-slate-700 hover:text-slate-900 transition-colors truncate max-w-full text-left"
                        >
                          {v.landlordName ?? "—"}
                        </button>
                      </div>
                      <div>
                        <p className="label-caps text-slate-600 mb-0.5">Valuation Value</p>
                        <p className="font-mono font-medium text-slate-900">
                          {v.marketValueKes ? formatCompactKES(Number(v.marketValueKes)) : "—"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-slate-50 pt-2.5 mt-3">
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-slate-600">Valued by:</p>
                        <span className="text-xs text-slate-600 font-medium truncate max-w-[120px]">{valuerLabel(v)}</span>
                      </div>
                      {score && (
                        <span className="font-mono text-xs font-medium px-2 py-0.5 rounded-md" style={{ backgroundColor: `${score.color}18`, color: score.color }}>
                          Fit: {score.grade} ({score.score})
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop View: Full-column table format */}
            <div className="hidden lg:block overflow-x-auto">
              <div className="min-w-[920px]">
                <div className="grid grid-cols-[1.6fr_1.3fr_1.1fr_1fr_1fr_1fr_76px] gap-2.5 px-3.5 py-2 border-b border-slate-100">
                  <span className="label-caps text-slate-600">Property</span>
                  <span className="label-caps text-slate-600">Landlord</span>
                  <span className="label-caps text-slate-600">Valuer</span>
                  <span className="label-caps text-slate-600 text-right">Valuation</span>
                  <span className="label-caps text-slate-600">Requested</span>
                  <span className="label-caps text-slate-600 text-center">Stage</span>
                  <span />
                </div>
                {visible.map((v) => {
                  const subject = subjectOf(v);
                  const cfg = STAGE_META[v.stage] ?? STAGE_META.requested;
                  const score = scoreOf(v);
                  const firstImage = coverImageOf(v);
                  return (
                    <div
                      key={v.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => router.push(`/admin/valuations/${v.id}`)}
                      className="grid grid-cols-[1.6fr_1.3fr_1.1fr_1fr_1fr_1fr_76px] gap-2.5 px-3.5 py-2.5 border-b border-slate-50 items-center cursor-pointer hover:bg-slate-50/80"
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <span className="relative size-8 rounded-lg overflow-hidden border border-slate-200 bg-slate-50 flex items-center justify-center shrink-0">
                            <Image
                              src={firstImage}
                              alt={subject.name}
                              fill
                              sizes="32px"
                              className="object-cover"
                            />
                        </span>
                        <span className="text-xs font-medium text-slate-900 truncate">{subject.name}</span>
                      </span>
                      <span className="truncate">
                        <div className="flex items-center gap-2 min-w-0">
                          <Avatar
                            src={v.landlordAvatarUrl ?? undefined}
                            fallback={v.landlordName ? v.landlordName.slice(0, 1) : "?"}
                            className="size-6 bg-slate-100 border border-slate-200 text-slate-700 text-[10px] font-medium shrink-0"
                          />
                          {v.landlordName ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (v.landlordContactId) setOwnerContactId(v.landlordContactId);
                              }}
                              className="hover:underline text-left text-xs text-slate-600 font-medium hover:text-[#151936] transition-colors truncate"
                            >
                              {v.landlordName}
                            </button>
                          ) : (
                            <span className="text-xs text-slate-600">—</span>
                          )}
                        </div>
                      </span>
                      <span className="text-xs text-slate-600 font-medium truncate flex items-center gap-2">
                        <span className="size-5 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-[10px] text-slate-600 font-mono">
                          V
                        </span>
                        {valuerLabel(v)}
                      </span>
                      <span className="text-right">
                        <span className="block font-mono text-xs text-slate-900 font-medium">{v.marketValueKes ? formatCompactKES(Number(v.marketValueKes)) : "—"}</span>
                        {score && (
                          <span className="inline-block mt-0.5 font-mono text-xxs rounded bg-emerald-50 text-emerald-700 border border-emerald-100/50 px-1 py-0.5 leading-none">
                            {score.grade} · {score.score}%
                          </span>
                        )}
                      </span>
                      <span className="font-mono text-xs text-slate-600">{fmtDate(v.createdAt)}</span>
                      <span className="text-center">
                        <Badge tone={stageTone(v.stage)}>
                          {cfg.label}
                        </Badge>
                      </span>
                      <span onClick={(e) => e.stopPropagation()} className="flex justify-end items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleToggleFeature(v.id, !!v.isFeatured)}
                          aria-label={v.isFeatured ? "Remove from featured" : "Add to featured"}
                          aria-pressed={!!v.isFeatured}
                          className={cn(
                            "size-7 rounded-md flex items-center justify-center transition-colors",
                            v.isFeatured ? "bg-amber-400 text-[#151936]" : "text-slate-400 hover:text-amber-500 hover:bg-amber-50"
                          )}
                        >
                          {v.isFeatured ? <IconStarFilled size={13} /> : <IconStar size={13} />}
                        </button>
                        <DropdownMenu
                          label="Valuation actions"
                          trigger={<div className="p-1.5 rounded-md text-slate-600 hover:bg-white hover:shadow-sm hover:text-slate-900 transition-all border border-transparent hover:border-slate-200"><IconDotsVertical size={16} /></div>}
                          align="right"
                        >
                          {v.stage === "requested" && <DropdownItem icon={IconChevronRight} onClick={() => transitionStage(v, "site_visit")}>Confirm Site Visit</DropdownItem>}
                          {v.stage === "site_visit" && <DropdownItem icon={IconFileCertificate} onClick={() => setSubmittingValuation(v)}>Submit Valuation</DropdownItem>}
                          {v.stage === "valued" && <DropdownItem icon={IconSend} onClick={() => transitionStage(v, "offer_sent")}>Send Offer Letter</DropdownItem>}
                          {v.stage === "offer_sent" && <DropdownItem icon={IconShieldCheck} onClick={() => transitionStage(v, "accepted")}>Record Acceptance</DropdownItem>}
                          {v.stage === "accepted" && <DropdownItem icon={IconFileCertificate} onClick={() => setSignConfirmId(v.id)}>Sign Mandate</DropdownItem>}
                          {v.stage === "mandate_signed" && v.resultingMandateId && (
                            <DropdownItem icon={IconExternalLink} onClick={() => router.push(`/admin/mandates/${v.resultingMandateId}`)}>Open Mandate File</DropdownItem>
                          )}
                          <DropdownItem icon={IconEye} onClick={() => router.push(`/admin/valuations/${v.id}`)}>View Full File</DropdownItem>
                          <DropdownItem icon={IconEdit} onClick={() => openEdit(v)}>Edit Prospect</DropdownItem>
                          {v.stage !== "mandate_signed" && v.stage !== "declined" && (
                            <DropdownItem icon={IconX} onClick={() => transitionStage(v, "declined")}>Decline Prospect</DropdownItem>
                          )}
                          <div className="my-1 h-px bg-slate-100" />
                          <DropdownItem icon={IconTrash} variant="danger" onClick={() => setDeleteConfirmId(v.id)}>Delete</DropdownItem>
                        </DropdownMenu>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {viewMode !== "board" && filtered.length > 0 && (
          <div className="border-t border-slate-100 pt-5 mt-4">
            <PaginationControls
              currentPage={page}
              totalPages={totalPages}
              onPageChange={setPage}
              label={`${filtered.length} prospect${filtered.length === 1 ? "" : "s"}`}
            />
          </div>
        )}
      </div>

      <div className="flex items-center gap-4 mt-2">
        <hr className="flex-1 border-slate-200/60" />
        <span className="label-caps text-slate-600 tracking-wider">Valuer Performance</span>
        <hr className="flex-1 border-slate-200/60" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-3.5 items-start">
        <div className="bg-white border border-slate-100 rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-5">
          <p className="text-title-primary mb-3.5">Valuer Leaderboard</p>
          {leaderboard.length === 0 ? (
            <p className="text-meta-muted py-4 text-center text-xs">No valued prospects yet.</p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {leaderboard.map((l) => (
                <div key={l.name} className="flex items-center gap-2.5">
                  <span className="size-6 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center font-mono text-xs text-slate-500 shrink-0">{l.rank}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-900 truncate">{l.name}</p>
                    <p className="text-xs text-slate-600">{l.count} valued</p>
                  </div>
                  <span className="font-mono text-xs text-[#122a20]">{formatCompactKES(l.value)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="bg-white border border-slate-100 rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-5 flex flex-col">
          <p className="text-title-primary mb-3.5">Pipeline by Manager</p>
          <div className="flex flex-col gap-2.5">
            {mgrPipeline.map((m) => (
              <div key={m.name} className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-full bg-[#151936] text-[#f3df27] flex items-center justify-center font-mono text-xs shrink-0">
                  {m.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
                </span>
                <span className="flex-1 text-xs text-slate-600">{m.name}</span>
                <div className="w-[76px] h-[5px] rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full rounded-full bg-[#151936]" style={{ width: `${m.barPct}%` }} />
                </div>
                <span className="w-6 text-right font-mono text-xs text-slate-700">{m.count}</span>
              </div>
            ))}
          </div>
          <div className="mt-auto border-t border-slate-100 pt-3 flex items-center justify-between">
            <span className="text-meta-muted text-xs">Completed this month</span>
            <span className="font-mono text-xs text-[#122a20]">{completedThisMonth}</span>
          </div>
        </div>
      </div>

      {/* ── Valuation Activity Logger ─────────────────────────────────────────────────── */}
      <div className="gsap-stagger mb-8 bg-white border border-slate-100 rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-5 lg:p-6">
        <div className="flex flex-col gap-5 mb-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-slate-800 flex items-center gap-2">
              <IconClock size={16} className="text-slate-600" stroke={2} /> Recent Valuation Activity
            </h3>
          </div>

          {/* Search & Filter bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative flex-1">
              <IconSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search activity logs..."
                value={activitySearchQuery}
                onChange={(e) => {
                  setActivitySearchQuery(e.target.value);
                  setActivityPage(1);
                }}
                className="w-full bg-slate-50 border border-slate-200 text-sm rounded-xl pl-9 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#151936]/20 transition-all placeholder:text-slate-400"
              />
            </div>
            <div className="relative shrink-0">
              <IconFilter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <select
                value={activityFilter}
                onChange={(e) => {
                  setActivityFilter(e.target.value);
                  setActivityPage(1);
                }}
                className="appearance-none bg-white border border-slate-200 text-sm font-medium text-slate-700 rounded-xl pl-8 pr-10 py-2 focus:outline-none focus:ring-2 focus:ring-[#151936]/20 transition-all cursor-pointer"
              >
                <option value="all">All Events</option>
                <option value="stage_changes">Stage Changes</option>
                <option value="edits">Modifications</option>
                <option value="valuations">Valuations</option>
                <option value="system">System Actions</option>
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                <IconChevronRight size={14} className="text-slate-400 rotate-90" />
              </div>
            </div>
          </div>
        </div>

        {valuationActivityLoading ? (
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner size="md" />
          </div>
        ) : valuationActivity.length === 0 ? (
          <div className="flex flex-col items-center text-center gap-4 py-12 bg-slate-50 rounded-2xl border border-slate-100 border-dashed">
            <div className="size-16 rounded-2xl bg-white border border-slate-100 flex items-center justify-center mb-1">
              <IconMoodEmpty size={32} className="text-slate-300" />
            </div>
            <h3 className="text-sm font-medium text-slate-700">No recorded activity yet.</h3>
            <p className="text-slate-400 max-w-sm text-xs">Stage transitions, edits, valuations, and decisions will safely log here.</p>
          </div>
        ) : paginatedValuationActivity.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-center">
            <IconSearch size={24} className="text-slate-300 mb-3" />
            <p className="text-sm font-medium text-slate-700">No logs match your filter</p>
            <p className="text-xs text-slate-400 mt-1">Try adjusting the search query or dropdown.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-6 relative ml-1">
            <div className="absolute left-[3.5px] top-2 bottom-6 w-px bg-slate-200 z-0" />
            {paginatedValuationActivity.map((entry) => {
              const toneColor = getActivityTone(entry.summary);
              return (
                <div key={entry.id} className="relative flex items-start lg:items-center gap-4 z-10 group">
                  <div className={cn("size-[8px] rounded-full mt-1.5 lg:mt-0 shrink-0 ring-4 shadow-xs", toneColor)} />
                  <Link
                    href={entry.associatedId ? `/admin/valuations/${entry.associatedId}` : "#"}
                    className="flex-1 min-w-0 flex flex-col lg:flex-row lg:items-center justify-between gap-2 lg:gap-6 hover:bg-slate-50/50 -my-1.5 -mx-3 p-1.5 px-3 rounded-xl transition-colors cursor-pointer"
                  >
                    <p className="text-sm text-slate-500 leading-snug group-hover:text-slate-700 transition-colors flex-1 min-w-0 pr-4">
                      {entry.actorName ? (
                        <>
                          <span className="font-medium text-slate-700">{entry.actorName}</span>{" "}
                          {entry.summary.replace(entry.actorName, "").replace(/^ - |^ — /, "").trim()}
                        </>
                      ) : (
                        entry.summary
                      )}
                    </p>
                    <div className="flex items-center gap-3 shrink-0">
                      <p className="text-xs text-slate-400 font-mono tracking-wider hidden lg:block">
                        {new Date(entry.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })},{" "}
                        {new Date(entry.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                      <Badge tone="neutral">
                        {relativeTime(entry.createdAt)}
                      </Badge>
                    </div>
                  </Link>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination Controls */}
        {activityTotalPages > 1 && (
          <div className="flex items-center justify-between pt-6 mt-6 border-t border-slate-100">
            <span className="text-xs font-medium text-slate-400 bg-slate-50 px-3 py-1 rounded-md border border-slate-100">
              Page {safeActivityPage} of {activityTotalPages} <span className="mx-1">·</span> {filteredValuationActivity.length} logs
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setActivityPage(Math.max(1, safeActivityPage - 1))}
                disabled={safeActivityPage <= 1}
                className="size-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 disabled:text-slate-200 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
              >
                <IconChevronLeft size={15} />
              </button>
              <button
                type="button"
                onClick={() => setActivityPage(Math.min(activityTotalPages, safeActivityPage + 1))}
                disabled={safeActivityPage >= activityTotalPages}
                className="size-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 disabled:text-slate-200 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
              >
                <IconChevronRight size={15} />
              </button>
            </div>
          </div>
        )}
      </div>

      <ValuationFormModal
        open={formOpen}
        entityId={entityId}
        mode={editingValuation ? "edit" : "create"}
        valuation={editingValuation}
        onClose={() => setFormOpen(false)}
        onSubmit={loadValuations}
      />

      <ValuationSubmitModal
        open={!!submittingValuation}
        entityId={entityId}
        valuation={submittingValuation as ValuationSubmitTarget | null}
        onClose={() => setSubmittingValuation(null)}
        onSubmitted={loadValuations}
      />

      <ConfirmDialog
        open={!!signConfirmId}
        title="Sign Management Mandate"
        description="This creates a real management mandate from this prospect - if it's an external subject, a new portfolio property is created too. This cannot be undone by dragging back."
        confirmLabel="Sign Mandate"
        cancelLabel="Cancel"
        tone="info"
        isLoading={isSigning}
        onConfirm={handleSignMandate}
        onClose={() => setSignConfirmId(null)}
      />

      <ConfirmDialog
        open={!!deleteConfirmId}
        title="Delete Valuation"
        description="This permanently removes the prospect and its recorded values. The deletion itself stays on the audit trail."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        tone="danger"
        isLoading={isDeleting}
        onConfirm={handleDelete}
        onClose={() => setDeleteConfirmId(null)}
      />

      <PropertyOwnerProfileDrawer
        open={!!ownerContactId}
        onClose={() => setOwnerContactId(null)}
        entityId={entityId}
        ownerContactId={ownerContactId}
        properties={properties}
        onOpenProperty={() => { }}
      />

      <PropertyManagerProfileDrawer
        open={!!managerUserId}
        onClose={() => setManagerUserId(null)}
        entityId={entityId}
        managerId={managerUserId}
        properties={properties}
        onOpenProperty={() => { }}
      />
    </PageTransition>
  );
}
