"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  IconArrowUpRight,
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
  IconUserCog,
  IconReportAnalytics,
} from "@tabler/icons-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ActionLoadingOverlay,
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
import { formatCompactKES, formatKES } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { useToast } from "@/components/ui/toast-provider";
import { Modal } from "@/components/ui/modal";
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
  valuerName?: string | null;
  valuerAvatarUrl?: string | null;
  isFeatured: boolean;
}

interface AuditEntry {
  id: string;
  summary: string;
  createdAt: string;
  actorName?: string | null;
  associatedId?: string | null;
}

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

const VALUER_AVATAR_POOL: Record<string, string> = {
  "David Omondi": "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&q=80",
  "Jane Wanjiru": "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=400&q=80",
  "Knight & Kale Valuers": "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=400&q=80",
  "Tysons Ltd": "https://images.unsplash.com/photo-1497366216548-37526070297c?w=400&q=80",
  "Sunland Valuers Ltd": "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=400&q=80",
  "Kevin Mbugua": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=80",
  "Unassigned": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&q=80",
};

const DEFAULT_AVATARS = [
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=80",
  "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=400&q=80",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&q=80",
  "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&q=80",
  "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=400&q=80",
];

function getAvatarForName(name: string, directUrl?: string | null): string {
  if (directUrl && directUrl.trim().length > 0) return directUrl;
  if (VALUER_AVATAR_POOL[name]) return VALUER_AVATAR_POOL[name];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const idx = Math.abs(hash) % DEFAULT_AVATARS.length;
  return DEFAULT_AVATARS[idx];
}

type ViewMode = "board" | "grid" | "list";

export function ValuationsBoard({ entityId = "group" }: { entityId?: string }) {
  const { pushToast } = useToast();
  const router = useRouter();

  const [valuations, setValuations] = useState<Valuation[]>([]);
  const [loading, setLoading] = useState(true);
  // "pipeline" (default) = still-active prospects (including "declined",
  // which can be re-opened); "archive" = converted, identified by
  // archivedAt in listValuations rather than by stage - see ADR 021 §5.
  const [registerView, setRegisterView] = useState<"pipeline" | "archive">("pipeline");

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

  // Card pagination states
  const [valuerPage, setValuerPage] = useState(1);
  const [mgrPage, setMgrPage] = useState(1);

  // Selected Valuer Modal target
  const [selectedValuer, setSelectedValuer] = useState<{
    name: string;
    avatarUrl?: string | null;
    value: number;
    count: number;
    sharePct: number;
  } | null>(null);

  const loadValuations = useCallback(async (silent = false) => {
    if (!silent) Promise.resolve().then(() => setLoading(true));
    try {
      const res = await fetch(`/api/valuations?entityId=${entityId}&view=${registerView}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load valuations");
      setValuations(data.valuations ?? []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load valuations";
      pushToast({ tone: "error", title: "Error", body: message });
    } finally {
      if (!silent) setLoading(false);
    }
  }, [entityId, registerView, pushToast]);

  useEffect(() => {
    Promise.resolve().then(() => loadValuations());
  }, [loadValuations]);

  // The kanban's columns are the active-pipeline stages only (STAGE_ORDER +
  // "declined") - every Archive row is "mandate_signed", which has no column
  // of its own, so a kanban would render as a confusing wall of empty
  // columns. Bounce back to Grid, which renders any stage, same as the
  // board-toggle button being hidden for this view just above.
  useEffect(() => {
    if (registerView === "archive" && viewMode === "board") {
      Promise.resolve().then(() => setViewMode("grid"));
    }
  }, [registerView, viewMode]);

  useEffect(() => {
    fetch(`/api/properties?entityId=${entityId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.properties) setProperties(data.properties);
      })
      .catch(() => { });
  }, [entityId]);

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

  // ── Valuer Performance + Pipeline by Manager (real aggregation over the fetched
  // list - never a hardcoded array) ────────────────────────────────────────

  const valuerPerformance = useMemo(() => {
    const byValuer = new Map<
      string,
      { name: string; value: number; count: number; avatarUrl?: string | null; valuerId?: string | null }
    >();
    for (const v of valuations) {
      if (v.stage !== "mandate_signed" && v.stage !== "valued" && STAGE_ORDER.indexOf(v.stage) < STAGE_ORDER.indexOf("valued")) continue;
      if (!v.marketValueKes) continue;
      const name = valuerLabel(v);
      const entry = byValuer.get(name) ?? {
        name,
        value: 0,
        count: 0,
        avatarUrl: v.valuerAvatarUrl,
        valuerId: v.valuerId,
      };
      entry.value += Number(v.marketValueKes);
      entry.count += 1;
      if (v.valuerAvatarUrl) entry.avatarUrl = v.valuerAvatarUrl;
      byValuer.set(name, entry);
    }
    const totalVolume = Array.from(byValuer.values()).reduce((sum, item) => sum + item.value, 0) || 1;
    return Array.from(byValuer.values())
      .sort((a, b) => b.value - a.value)
      .map((entry) => ({
        ...entry,
        sharePct: Math.round((entry.value / totalVolume) * 100),
      }));
  }, [valuations, valuerLabel]);

  const mgrPipeline = useMemo(() => {
    const byMgr = new Map<
      string,
      { name: string; count: number; avatarUrl?: string | null; managerId?: string | null }
    >();
    let totalWorkload = 0;
    for (const v of valuations) {
      if (v.stage === "mandate_signed" || v.stage === "declined") continue;
      const name = v.managerName ?? "Unassigned";
      const entry = byMgr.get(name) ?? {
        name,
        count: 0,
        avatarUrl: v.managerAvatarUrl,
        managerId: v.assignedManagerId,
      };
      entry.count += 1;
      totalWorkload += 1;
      if (v.managerAvatarUrl) entry.avatarUrl = v.managerAvatarUrl;
      byMgr.set(name, entry);
    }
    const maxCount = Math.max(1, ...Array.from(byMgr.values()).map((e) => e.count));
    const safeTotal = Math.max(1, totalWorkload);
    return Array.from(byMgr.values())
      .sort((a, b) => b.count - a.count)
      .map((entry) => ({
        ...entry,
        barPct: Math.round((entry.count / maxCount) * 100),
        sharePct: Math.round((entry.count / safeTotal) * 100),
      }));
  }, [valuations]);

  const valuerPageSize = 3;
  const valuerTotalPages = Math.max(1, Math.ceil(valuerPerformance.length / valuerPageSize));
  const safeValuerPage = Math.min(valuerPage, valuerTotalPages);
  const paginatedValuers = valuerPerformance.slice((safeValuerPage - 1) * valuerPageSize, safeValuerPage * valuerPageSize);

  const mgrPageSize = 3;
  const mgrTotalPages = Math.max(1, Math.ceil(mgrPipeline.length / mgrPageSize));
  const safeMgrPage = Math.min(mgrPage, mgrTotalPages);
  const paginatedManagers = mgrPipeline.slice((safeMgrPage - 1) * mgrPageSize, safeMgrPage * mgrPageSize);

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
      loadValuations(true);
    } catch (err) {
      loadValuations(true);
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
      loadValuations(true);
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
      loadValuations(true);
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
    <PageTransition className="board-shell mx-auto flex max-w-[98rem] flex-col gap-5">
      <BoardHeader
        eyebrow={<Badge tone="primary">Estate Portfolio</Badge>}
        title="Valuations & Acquisition Pipeline"
        description="From site visit to signed mandate: a property manager scouts and values a prospect, Front Office sends the landlord an offer to manage, and acceptance becomes a mandate."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => loadValuations()}>
              <IconRefresh size={14} /> Refresh
            </Button>
            <Button size="sm" onClick={openCreate}>
              <IconPlus size={14} /> Schedule Valuation
            </Button>
          </div>
        }
      />

      <PortfolioHubNav
        active="valuations"
        modeOptions={[{ value: "pipeline", label: "Pipeline" }, { value: "archive", label: "Archive · Converted" }]}
        mode={registerView}
        onModeChange={(v) => { setRegisterView(v as "pipeline" | "archive"); setPage(1); }}
      />

      <div className="flex items-center gap-4 mt-2">
        <hr className="flex-1 border-slate-200/60" />
        <span className="label-caps text-slate-600 tracking-wider">Pipeline Signals</span>
        <hr className="flex-1 border-slate-200/60" />
      </div>

      {/* ── Executive 4-Card Dark KPI Tier ── */}
      <div className="gsap-stagger bg-tertiary-gradient text-white rounded-[28px] shadow-2xl relative overflow-hidden group mb-6 border border-slate-800/80">
        <div className="grid grid-cols-1 sm:grid-cols-2 @board-lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-white/10 relative z-10">

          {/* Card 1: In Pipeline */}
          <div className="py-6 px-6 lg:py-7 lg:px-7 flex flex-col justify-between relative overflow-hidden group/card">
            <div className="absolute -bottom-10 -right-10 opacity-5 text-emerald-400 pointer-events-none transition-transform duration-700 group-hover/card:scale-110">
              <IconTelescope size={140} stroke={1} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xxs font-mono font-medium text-slate-300 uppercase tracking-wider">In Pipeline</span>
            </div>
            <div className="relative z-10 mt-4">
              <span className="font-mono text-3xl font-medium text-white">{kpis.inPipeline} <span className="text-xs font-mono text-slate-300 font-normal">Prospects</span></span>
              {pipelineBreakdown.total > 0 && (
                <div className="mt-3 flex flex-col gap-2">
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
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="flex items-center gap-1 text-xxs font-mono font-medium uppercase tracking-wider text-slate-300">
                      <span className="size-1.5 rounded-full bg-slate-300" />{pipelineBreakdown.setup} prospecting
                    </span>
                    <span className="flex items-center gap-1 text-xxs font-mono font-medium uppercase tracking-wider text-amber-300">
                      <span className="size-1.5 rounded-full bg-amber-400" />{pipelineBreakdown.offer} valuation
                    </span>
                    <span className="flex items-center gap-1 text-xxs font-mono font-medium uppercase tracking-wider text-emerald-300">
                      <span className="size-1.5 rounded-full bg-emerald-400" />{pipelineBreakdown.accepted} accepted
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Card 2: Prospective Value */}
          <div className="py-6 px-6 lg:py-7 lg:px-7 flex flex-col justify-between relative overflow-hidden group/card">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-medium text-slate-300 uppercase tracking-wider">Prospective Value</span>
            </div>
            <div className="relative z-10 mt-4">
              <span className="font-mono text-3xl font-medium text-white">{formatCompactKES(kpis.pipelineValue)}</span>
              <p className="text-xxs text-slate-300 font-mono mt-2 uppercase tracking-wide">
                Valued, not yet mandated
              </p>
            </div>
          </div>

          {/* Card 3: Offer to Mandate Conversion */}
          <div className="py-6 px-6 lg:py-7 lg:px-7 flex flex-col justify-between relative overflow-hidden group/card">
            <div className="flex items-center justify-between">
              <Badge tone={kpis.convPct >= 50 ? "success" : "warning"}>
                {kpis.convPct >= 50 ? "STRONG" : "NEEDS FOLLOW-UP"}
              </Badge>
            </div>
            <div className="relative z-10 mt-4 flex items-center gap-3.5">
              <svg width="48" height="48" viewBox="0 0 64 64" role="img" aria-label={`Conversion rate ${Math.round(kpis.convPct)}%`} className="shrink-0">
                <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="7" />
                <circle
                  cx="32" cy="32" r="26" fill="none" stroke="#f3df27" strokeWidth="7" strokeLinecap="round"
                  strokeDasharray={`${(kpis.convPct / 100) * 163.4} 163.4`}
                  transform="rotate(-90 32 32)"
                />
              </svg>
              <div>
                <span className="font-mono font-medium text-white text-3xl leading-none">{Math.round(kpis.convPct)}%</span>
                <p className="text-xs text-emerald-300 font-mono mt-1 uppercase tracking-wide">Last 12 Months</p>
              </div>
            </div>
          </div>

          {/* Card 4: Mandates Signed YTD */}
          <div className="py-6 px-6 lg:py-7 lg:px-7 flex flex-col justify-between relative overflow-hidden group/card">
            <div className="absolute -bottom-10 -right-10 opacity-5 text-indigo-400 pointer-events-none transition-transform duration-700 group-hover/card:scale-110">
              <IconFileCertificate size={140} stroke={1} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-medium text-slate-300 uppercase tracking-wider">Mandates Signed YTD</span>
              <Badge tone="success">CONVERTED</Badge>
            </div>
            <div className="relative z-10 mt-4">
              <span className="font-mono text-3xl font-medium text-white">{kpis.signedYtd}</span>
              <p className="text-xxs text-slate-300 font-mono mt-2 uppercase tracking-wide">From this pipeline</p>
            </div>
          </div>

        </div>
      </div>

      {/* ── Needs Attention / Action Required Banners (2-Column Grid) ── */}
      {actionItems.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 mt-1">
          {actionItems.map((item) => (
            <div
              key={item.key}
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
                    <Badge tone={item.tone === "rose" ? "risk" : "warning"} className="shrink-0 text-xxs ">
                      ACTION REQUIRED
                    </Badge>
                  </div>
                  <p className="text-xxs text-slate-500 mt-1 font-mono truncate">{item.meta}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={item.onClick}
                className="bg-white hover:bg-slate-50 text-slate-900 border border-slate-200/90 rounded-xl px-3.5 py-1.5 text-xs font-medium transition-all shadow-2xs hover:shadow-xs shrink-0 flex items-center gap-1.5 cursor-pointer"
              >
                {item.cta} <IconArrowUpRight size={13} className="text-slate-600 group-hover:text-slate-900 transition-colors" />
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
            <div className="bg-white border border-slate-200/80 rounded-[28px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden flex flex-col lg:flex-row group transition-all duration-500 hover:shadow-[0_16px_40px_rgb(0,0,0,0.06)] relative z-10">

              {/* Left Side: Property Image & Overlay */}
              <div className="lg:w-[36%] shrink-0 relative min-h-[300px] lg:min-h-0 bg-[#0d211a] overflow-hidden">
                <div className="absolute top-5 left-5 z-20 flex items-center gap-2">
                  <span className="bg-[#151936]/90 backdrop-blur-md text-[#f3df27] flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-mono font-medium uppercase tracking-wider shadow-sm border border-slate-700/40">
                    <IconStarFilled size={13} className="text-[#f3df27] shrink-0" /> {isCuratedFeatured ? "Featured Prospect" : "High-Value Prospect"}
                  </span>
                </div>

                <div className="absolute top-5 right-5 z-20 flex items-center gap-2">
                  {curatedFeatured.length > 1 && (
                    <div className="flex items-center gap-1.5 bg-black/40 backdrop-blur-md px-2 py-1 rounded-xl border border-white/10">
                      <button
                        type="button"
                        onClick={() => setFeaturedCarouselIndex((i) => (i === 0 ? curatedFeatured.length - 1 : i - 1))}
                        aria-label="Previous featured prospect"
                        className="size-6 rounded-lg text-white flex items-center justify-center hover:bg-white/20 transition-colors"
                      >
                        <IconChevronLeft size={14} />
                      </button>
                      <span className="font-mono text-xs text-white/90 font-medium px-1">{safeFeaturedCarouselIndex + 1}/{curatedFeatured.length}</span>
                      <button
                        type="button"
                        onClick={() => setFeaturedCarouselIndex((i) => (i === curatedFeatured.length - 1 ? 0 : i + 1))}
                        aria-label="Next featured prospect"
                        className="size-6 rounded-lg text-white flex items-center justify-center hover:bg-white/20 transition-colors"
                      >
                        <IconChevronRight size={14} />
                      </button>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => handleToggleFeature(featuredProspect.id, !!featuredProspect.isFeatured)}
                    aria-label={featuredProspect.isFeatured ? "Remove from featured" : "Add to featured"}
                    aria-pressed={!!featuredProspect.isFeatured}
                    className={cn(
                      "size-8 rounded-xl backdrop-blur-md flex items-center justify-center transition-all cursor-pointer shadow-2xs",
                      featuredProspect.isFeatured ? "bg-amber-400 text-[#151936]" : "bg-black/40 text-white border border-white/15 hover:bg-amber-400 hover:text-[#151936]"
                    )}
                  >
                    {featuredProspect.isFeatured ? <IconStarFilled size={14} /> : <IconStar size={14} />}
                  </button>
                </div>

                <Image
                  src={coverImageOf(featuredProspect)}
                  alt={subjectOf(featuredProspect).name}
                  fill
                  sizes="(max-width: 1024px) 100vw, 36vw"
                  className="object-cover transition-transform duration-1000 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0a0d1c] via-[#0a0d1c]/40 to-transparent" />

                {/* Overlay Data */}
                <div className="absolute bottom-6 left-6 right-6">
                  <span className="font-mono text-xs font-medium text-amber-300 px-2 py-0.5 rounded-md bg-black/40 border border-white/10 inline-block mb-1.5">
                    {featuredProspect.valuationCode}
                  </span>
                  <h3 className="text-xl font-medium text-white leading-tight">
                    {subjectOf(featuredProspect).name}
                  </h3>
                  <p className="text-xs text-white/70 truncate mt-1 flex items-center gap-1 font-mono">
                    <IconMapPin size={13} className="text-amber-400 shrink-0" />
                    {subjectOf(featuredProspect).location}
                  </p>
                </div>
              </div>

              {/* Center & Right: Valuation & Fit Data */}
              <div className="flex-1 p-6 lg:p-8 flex flex-col lg:flex-row gap-6 relative bg-white overflow-hidden justify-between items-stretch">
                <div className="absolute -top-32 -right-32 opacity-[0.015] text-[#151936] pointer-events-none">
                  <IconTelescope size={400} stroke={0.5} />
                </div>

                <div className="flex-1 flex flex-col justify-between relative z-10 gap-5">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <Badge tone={stageTone(featuredProspect.stage)}>
                      {(STAGE_META[featuredProspect.stage] ?? STAGE_META.requested).label}
                    </Badge>
                    {scoreOf(featuredProspect) && (
                      <span className="text-xs font-mono text-slate-700 tracking-wider uppercase font-medium bg-slate-100/80 px-2.5 py-1 rounded-lg border border-slate-200/60">
                        Grade {scoreOf(featuredProspect)?.grade} Fit
                      </span>
                    )}
                  </div>

                  {/* Acquisition Fit Score Progress Container */}
                  <div className="bg-slate-50/80 border border-slate-200/70 rounded-2xl p-4 shadow-2xs space-y-2">
                    {scoreOf(featuredProspect) ? (
                      <>
                        <div className="flex items-center justify-between text-xs font-mono text-slate-600 font-medium">
                          <span>ACQUISITION FIT SCORE</span>
                          <span className="font-mono text-sm font-medium text-slate-900">{scoreOf(featuredProspect)?.score}%</span>
                        </div>
                        <div className="h-2.5 bg-slate-200/80 rounded-full overflow-hidden w-full">
                          <div
                            style={{ width: `${scoreOf(featuredProspect)?.score}%` }}
                            className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                          />
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-xs text-slate-500 font-mono uppercase tracking-wider font-medium">Acquisition Fit Pending</p>
                          <p className="text-xs text-slate-600 mt-0.5">Fit score is determined upon assessed market value entry.</p>
                        </div>
                        <Badge tone="neutral" className="font-mono text-xxs shrink-0">Stage: {featuredProspect.stage}</Badge>
                      </div>
                    )}
                  </div>

                  {/* Landlord & Manager Identity Stack */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {featuredProspect.landlordName && (
                      <button
                        type="button"
                        onClick={() => {
                          if (featuredProspect.landlordContactId) setOwnerContactId(featuredProspect.landlordContactId);
                        }}
                        className="flex items-center gap-3 bg-slate-50/70 hover:bg-slate-100/80 transition-all p-2.5 rounded-2xl border border-slate-200/70 group/avatar shrink-0 text-left shadow-2xs"
                      >
                        <Avatar
                          src={featuredProspect.landlordAvatarUrl ?? undefined}
                          fallback={featuredProspect.landlordName.slice(0, 1)}
                          className="size-9 shrink-0 shadow-2xs"
                        />
                        <div className="min-w-0">
                          <span className="block text-xs font-medium text-slate-900 group-hover/avatar:text-[#151936] transition-colors truncate">{featuredProspect.landlordName}</span>
                          <span className="block text-xxs text-slate-500 tracking-wider font-mono uppercase mt-0.5">Landlord</span>
                        </div>
                      </button>
                    )}

                    {featuredProspect.managerName && (
                      <button
                        type="button"
                        onClick={() => {
                          if (featuredProspect.assignedManagerId) setManagerUserId(featuredProspect.assignedManagerId);
                        }}
                        className="flex items-center gap-3 bg-slate-50/70 hover:bg-slate-100/80 transition-all p-2.5 rounded-2xl border border-slate-200/70 group/avatar shrink-0 text-left shadow-2xs"
                      >
                        <Avatar
                          src={featuredProspect.managerAvatarUrl ?? undefined}
                          fallback={featuredProspect.managerName.split(" ").map((w) => w[0]).slice(0, 2).join("")}
                          className="size-9 shrink-0 shadow-2xs"
                        />
                        <div className="min-w-0">
                          <span className="block text-xs font-medium text-slate-900 group-hover/avatar:text-[#151936] transition-colors truncate">{featuredProspect.managerName}</span>
                          <span className="block text-xxs text-slate-500 tracking-wider font-mono uppercase mt-0.5">Manager</span>
                        </div>
                      </button>
                    )}
                  </div>

                  {/* Financials & Action Buttons */}
                  <div className="border-t border-slate-200/70 pt-4 flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex flex-col">
                      <span className="text-xxs font-mono font-medium tracking-wider text-slate-500 uppercase">Prospective Market Value</span>
                      <span className="font-mono text-2xl font-medium text-[#151936] mt-0.5">
                        {featuredProspect.marketValueKes ? formatCompactKES(Number(featuredProspect.marketValueKes)) : "—"}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        onClick={() => router.push(`/admin/valuations/${featuredProspect.id}`)}
                        className="h-10 px-4 text-xs font-medium rounded-xl border border-slate-200 text-slate-800 hover:bg-slate-50 transition-colors flex items-center gap-1.5 shadow-2xs"
                      >
                        Open Valuation File <IconExternalLink size={14} />
                      </Button>

                      {featuredProspect.stage === "site_visit" && (
                        <Button
                          onClick={() => setSubmittingValuation(featuredProspect)}
                          className="bg-[#151936] text-white hover:bg-[#1f254e] transition rounded-xl px-4 h-10 text-xs font-medium flex items-center gap-1.5 shadow-2xs"
                        >
                          Submit Valuation <IconShieldCheck size={14} />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Side: Methodology Executive Card */}
                <div className="hidden lg:flex w-[210px] shrink-0 border-l border-slate-200/70 pl-6 flex-col justify-center items-center">
                  <div className="bg-gradient-to-br from-slate-50 to-slate-100/60 border border-slate-200/80 rounded-2xl p-5 flex flex-col justify-between items-center w-full min-h-[220px] shadow-2xs relative overflow-hidden text-center">
                    <div className="absolute top-0 right-0 size-16 bg-[#151936]/5 rounded-bl-full pointer-events-none" />

                    <span className="text-xxs font-mono font-medium tracking-wider text-slate-500 uppercase">Methodology</span>

                    <div className="my-auto py-2">
                      <span className="text-xs font-medium text-slate-900 block leading-snug">
                        {featuredProspect.methodology || "Comparative Income Capitalization"}
                      </span>
                    </div>

                    <Badge tone="neutral" className="font-mono text-xxs uppercase tracking-widest shrink-0 mt-2">
                      {featuredProspect.isLand ? "Land Plot" : "Built Property"}
                    </Badge>
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
            {registerView === "pipeline" && (
              <button onClick={() => setViewMode("board")} className={cn("flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors", viewMode === "board" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-700")}>
                <IconLayoutKanban size={14} /> Pipeline
              </button>
            )}
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
          <div className="overflow-x-auto pb-4">
            <div className="grid grid-flow-col auto-cols-[270px] sm:auto-cols-[290px] gap-4 items-start">
              {stageColumns.map(({ stage, cards }) => {
                const cfg = STAGE_META[stage];
                const draggedCard = dragId ? valuations.find((v) => v.id === dragId) : null;
                const canDrop = draggedCard ? canMoveToStage(draggedCard.stage, stage) : false;
                const isOver = dragOverStage === stage && canDrop;
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
                      if (!card || card.stage === stage || !canMoveToStage(card.stage, stage)) return;
                      transitionStage(card, stage);
                    }}
                  >
                    {/* Header */}
                    <div className={cn("flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl border transition-colors bg-slate-50/70 border-slate-200/70", isOver && "bg-slate-100 border-slate-300")}>
                      <span className="flex items-center gap-2 text-xs font-mono font-medium text-slate-800 uppercase tracking-wider">
                        <span className={cn("size-2.5 rounded-full", cfg.dot)} /> {cfg.label}
                      </span>
                      <span className="text-xxs font-mono font-medium text-slate-700 bg-white border border-slate-200/80 rounded-full px-2 py-0.5 shadow-2xs">{cards.length}</span>
                    </div>

                    {/* Drag Container */}
                    <div className={cn(
                      "flex flex-col gap-3 rounded-2xl p-1 transition-all",
                      isOver ? "bg-slate-100/70 ring-2 ring-slate-300 ring-inset" : (draggedCard && canDrop ? "ring-1 ring-slate-200 ring-inset" : ""),
                    )} style={{ minHeight: draggedCard && canDrop ? 80 : 8 }}>
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
                              "text-left w-full bg-white border border-slate-200/80 rounded-2xl overflow-hidden hover:shadow-[0_8px_20px_rgb(0,0,0,0.06)] hover:border-slate-300 transition-all duration-300 cursor-grab group/card flex flex-col gap-0 shadow-2xs",
                              dragId === v.id ? "opacity-50 border-[#f3df27] ring-2 ring-[#f3df27]" : "",
                            )}
                          >
                            {/* Property Media / Artwork Banner */}
                            <div className="relative h-28 w-full bg-[#0d211a] overflow-hidden shrink-0">
                              <Image
                                src={firstImage}
                                alt={subject.name}
                                fill
                                sizes="280px"
                                className="object-cover transition-transform duration-500 group-hover/card:scale-105"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-[#0a0d1c]/80 via-transparent to-transparent" />

                              {/* Floating Badges inside Banner */}
                              <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 z-10">
                                <div className="size-6 rounded-lg flex items-center justify-center bg-[#151936]/80 text-white backdrop-blur-md shadow-2xs border border-white/15">
                                  {subject.portfolio ? <IconBuildingCommunity size={13} /> : <IconExternalLink size={13} />}
                                </div>
                                {isStalled && (
                                  <Badge tone="risk" className="text-xxs uppercase tracking-wider px-1.5 py-0.5">
                                    Stalled
                                  </Badge>
                                )}
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); handleToggleFeature(v.id, !!v.isFeatured); }}
                                  aria-label={v.isFeatured ? "Remove from featured" : "Add to featured"}
                                  aria-pressed={!!v.isFeatured}
                                  className={cn(
                                    "size-6 rounded-lg flex items-center justify-center backdrop-blur-md shadow-2xs border transition-colors cursor-pointer",
                                    v.isFeatured ? "bg-amber-400 border-amber-300 text-[#151936]" : "bg-[#151936]/80 border-white/15 text-white hover:bg-amber-400 hover:text-[#151936]"
                                  )}
                                >
                                  {v.isFeatured ? <IconStarFilled size={12} /> : <IconStar size={12} />}
                                </button>
                              </div>

                              {score && (
                                <span className="absolute top-2.5 right-2.5 bg-white/95 text-slate-900 rounded-lg px-2 py-0.5 text-xxs font-mono font-medium shadow-2xs border border-slate-200/80" title="Acquisition Fit Score">
                                  <span style={{ color: score.color }} className="font-medium mr-0.5">{score.grade}</span> {score.score}%
                                </span>
                              )}

                              {v.managerName && (
                                <Avatar
                                  src={getAvatarForName(v.managerName, v.managerAvatarUrl)}
                                  fallback={v.managerName.slice(0, 1)}
                                  className="absolute bottom-2 right-2.5 size-6 rounded-full border-2 border-white shadow-2xs shrink-0"
                                />
                              )}
                            </div>

                            {/* Card Body */}
                            <div className="p-3.5 flex flex-col flex-1 gap-2.5">
                              <p className="text-xs font-medium text-slate-900 leading-snug truncate group-hover/card:text-[#151936] transition-colors">{subject.name}</p>

                              {/* Landlord Row */}
                              <div className="flex items-center gap-2">
                                <Avatar
                                  src={getAvatarForName(v.landlordName || "Landlord", v.landlordAvatarUrl)}
                                  fallback={v.landlordName ? v.landlordName.slice(0, 1) : "?"}
                                  className="size-5 rounded-full border border-slate-200 text-slate-700 text-xxs font-medium shrink-0"
                                />
                                <span className="text-xs text-slate-600 font-medium truncate">{v.landlordName || "No Landlord"}</span>
                              </div>

                              <div className="h-px bg-slate-100/90" />

                              <div className="flex items-center justify-between mt-auto">
                                <span className="font-mono text-xs text-[#151936] font-medium">{v.marketValueKes ? formatCompactKES(Number(v.marketValueKes)) : "—"}</span>
                                <Badge tone="neutral" className="font-mono text-xxs px-2 py-0.5 shrink-0">
                                  {ageDaysOf(v)}d
                                </Badge>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      {cards.length === 0 && draggedCard && canDrop && (
                        <div className="flex items-center justify-center h-16 border-2 border-dashed border-slate-300 rounded-2xl text-xs font-medium text-slate-500 bg-slate-50/50">
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
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
                    className="bg-white border border-slate-200/80 rounded-[24px] overflow-hidden hover:shadow-[0_12px_30px_rgb(0,0,0,0.06)] hover:border-slate-300 transition-all duration-300 cursor-pointer group/card flex flex-col gap-0 shadow-2xs"
                  >
                    {/* Property Image Banner */}
                    <div className="relative h-40 w-full bg-[#0d211a] overflow-hidden shrink-0">
                      <Image
                        src={firstImage}
                        alt={subject.name}
                        fill
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 33vw"
                        className="object-cover transition-transform duration-500 group-hover/card:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#0a0d1c]/80 via-transparent to-transparent" />

                      {/* Floating Badges inside Image */}
                      <div className="absolute top-3 left-3 flex items-center gap-1.5 z-10">
                        <Badge tone={stageTone(v.stage)}>
                          {cfg.label}
                        </Badge>
                      </div>

                      <div className="absolute top-3 right-3 flex items-center gap-1.5 z-10">
                        {score && (
                          <span className="bg-white/95 text-slate-900 rounded-lg px-2 py-0.5 text-xxs font-mono font-medium shadow-2xs border border-slate-200/80" title="Acquisition Fit Score">
                            <span style={{ color: score.color }} className="font-medium mr-0.5">{score.grade}</span> {score.score}%
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleToggleFeature(v.id, !!v.isFeatured); }}
                          aria-label={v.isFeatured ? "Remove from featured" : "Add to featured"}
                          aria-pressed={!!v.isFeatured}
                          className={cn(
                            "size-8 rounded-xl flex items-center justify-center backdrop-blur-md shadow-2xs transition-colors cursor-pointer",
                            v.isFeatured ? "bg-amber-400 text-[#151936]" : "bg-black/40 text-white border border-white/15 hover:bg-amber-400 hover:text-[#151936]"
                          )}
                        >
                          {v.isFeatured ? <IconStarFilled size={14} /> : <IconStar size={14} />}
                        </button>
                      </div>

                      {v.managerName && (
                        <Avatar
                          src={getAvatarForName(v.managerName, v.managerAvatarUrl)}
                          fallback={v.managerName.slice(0, 1)}
                          className="absolute bottom-3 right-3 size-8 rounded-full border-2 border-white shadow-md shrink-0"
                        />
                      )}
                    </div>

                    {/* Info Area */}
                    <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-base font-medium text-slate-900 truncate leading-snug group-hover/card:text-[#151936] transition-colors">{subject.name}</p>
                        <p className="text-xs text-slate-500 truncate mt-1 flex items-center gap-1 font-mono">
                          <IconMapPin size={13} className="text-amber-500 shrink-0" /> {subject.location}
                        </p>
                      </div>

                      <div className="bg-slate-50/80 border border-slate-200/60 rounded-xl p-2.5 flex items-center gap-2.5">
                        <Avatar
                          src={getAvatarForName(v.landlordName || "Landlord", v.landlordAvatarUrl)}
                          fallback={v.landlordName ? v.landlordName.slice(0, 1) : "?"}
                          className="size-7 rounded-full border border-slate-200 text-slate-700 text-xxs font-medium shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          {v.landlordName ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (v.landlordContactId) setOwnerContactId(v.landlordContactId);
                              }}
                              className="block text-xs font-medium text-slate-900 hover:text-[#151936] hover:underline truncate leading-tight cursor-pointer"
                            >
                              {v.landlordName}
                            </button>
                          ) : (
                            <span className="block text-xs font-medium text-slate-600 leading-tight">No Landlord</span>
                          )}
                          <span className="block text-xxs text-slate-500 font-mono uppercase tracking-wider mt-0.5">Landlord</span>
                        </div>
                      </div>

                      <div className="border-t border-slate-100 pt-3 flex items-center justify-between mt-auto">
                        <span className="font-mono text-base text-[#151936] font-medium">{v.marketValueKes ? formatCompactKES(Number(v.marketValueKes)) : "—"}</span>
                        <Badge tone="neutral" className="font-mono text-xxs px-2.5 py-1 shrink-0">
                          {ageDaysOf(v)}d
                        </Badge>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Shared ERP Pagination */}
            {filtered.length > 0 && (
              <div className="pt-4 border-t border-slate-100">
                <PaginationControls
                  currentPage={page}
                  totalPages={totalPages}
                  totalItems={filtered.length}
                  pageSize={rowsPerPage}
                  itemLabel="records"
                  onPageChange={setPage}
                />
              </div>
            )}
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
                    className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs hover:shadow-xs cursor-pointer transition-all duration-200 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/60">{v.valuationCode}</span>
                      <Badge tone={stageTone(v.stage)}>
                        {cfg.label}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className={cn("size-10 rounded-xl border flex items-center justify-center shrink-0 shadow-2xs", subject.portfolio ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-slate-50 border-slate-200 text-slate-600")}>
                        {subject.portfolio ? <IconBuildingCommunity size={18} /> : <IconExternalLink size={18} />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-900 truncate">{subject.name}</p>
                        <p className="text-xs text-slate-500 truncate font-mono mt-0.5">{subject.location}</p>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleToggleFeature(v.id, !!v.isFeatured); }}
                        aria-label={v.isFeatured ? "Remove from featured" : "Add to featured"}
                        aria-pressed={!!v.isFeatured}
                        className={cn(
                          "size-8 rounded-xl flex items-center justify-center shrink-0 transition-colors cursor-pointer",
                          v.isFeatured ? "bg-amber-400 text-[#151936]" : "bg-slate-50 border border-slate-200 text-slate-600 hover:text-amber-500 hover:bg-amber-50"
                        )}
                      >
                        {v.isFeatured ? <IconStarFilled size={14} /> : <IconStar size={14} />}
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 text-xs">
                      <div>
                        <p className="label-caps text-slate-500 mb-0.5">Landlord</p>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (v.landlordContactId) setOwnerContactId(v.landlordContactId);
                          }}
                          className="font-medium text-slate-900 hover:underline transition-colors truncate max-w-full text-left cursor-pointer"
                        >
                          {v.landlordName ?? "—"}
                        </button>
                      </div>
                      <div>
                        <p className="label-caps text-slate-500 mb-0.5">Valuation Value</p>
                        <p className="font-mono font-medium text-[#151936]">
                          {v.marketValueKes ? formatCompactKES(Number(v.marketValueKes)) : "—"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-slate-100 pt-2.5 mt-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500">Valued by:</span>
                        <span className="text-xs text-slate-800 font-medium truncate max-w-[140px]">{valuerLabel(v)}</span>
                      </div>
                      {score && (
                        <span className="font-mono text-xs font-medium px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                          Fit: {score.grade} ({score.score}%)
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop View: Full-column table format */}
            <div className="hidden lg:block overflow-x-auto">
              <div className="min-w-[960px]">
                <div className="grid grid-cols-[1.6fr_1.3fr_1.1fr_1fr_1fr_1fr_76px] gap-3 px-4 py-3 border-b border-slate-200/80 bg-slate-50/70 rounded-t-2xl font-mono text-xxs font-medium text-slate-500 uppercase tracking-wider">
                  <span>Property</span>
                  <span>Landlord</span>
                  <span>Valuer</span>
                  <span className="text-right">Valuation</span>
                  <span>Requested</span>
                  <span className="text-center">Stage</span>
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
                      className="grid grid-cols-[1.6fr_1.3fr_1.1fr_1fr_1fr_1fr_76px] gap-3 px-4 py-3 border-b border-slate-100 items-center cursor-pointer hover:bg-slate-50/90 transition-colors"
                    >
                      <span className="flex items-center gap-2.5 min-w-0">
                        <span className="relative size-9 rounded-xl overflow-hidden border border-slate-200 bg-slate-50 flex items-center justify-center shrink-0 shadow-2xs">
                          <Image
                            src={firstImage}
                            alt={subject.name}
                            fill
                            sizes="36px"
                            className="object-cover"
                          />
                        </span>
                        <div className="min-w-0">
                          <span className="block text-xs font-medium text-slate-900 truncate leading-snug">{subject.name}</span>
                          <span className="block font-mono text-xxs text-slate-500 truncate">{v.valuationCode}</span>
                        </div>
                      </span>

                      <span className="truncate">
                        <div className="flex items-center gap-2 min-w-0">
                          <Avatar
                            src={getAvatarForName(v.landlordName || "Landlord", v.landlordAvatarUrl)}
                            fallback={v.landlordName ? v.landlordName.slice(0, 1) : "?"}
                            className="size-6 rounded-full border border-slate-200 text-slate-700 text-xxs font-medium shrink-0"
                          />
                          {v.landlordName ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (v.landlordContactId) setOwnerContactId(v.landlordContactId);
                              }}
                              className="hover:underline text-left text-xs text-slate-800 font-medium hover:text-[#151936] transition-colors truncate cursor-pointer"
                            >
                              {v.landlordName}
                            </button>
                          ) : (
                            <span className="text-xs text-slate-500">—</span>
                          )}
                        </div>
                      </span>

                      <span className="text-xs text-slate-700 font-medium truncate flex items-center gap-2">
                        <Avatar
                          src={getAvatarForName(valuerLabel(v), v.valuerAvatarUrl)}
                          fallback={valuerLabel(v).slice(0, 1)}
                          className="size-6 rounded-full border border-slate-200/80 shrink-0"
                        />
                        <span className="truncate">{valuerLabel(v)}</span>
                      </span>

                      <span className="text-right">
                        <span className="block font-mono text-xs text-[#151936] font-medium">{v.marketValueKes ? formatCompactKES(Number(v.marketValueKes)) : "—"}</span>
                        {score && (
                          <span className="inline-block mt-0.5 font-mono text-xxs rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/60 px-1.5 py-0.5 leading-none">
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
                            "size-7 rounded-lg flex items-center justify-center transition-colors cursor-pointer",
                            v.isFeatured ? "bg-amber-400 text-[#151936]" : "text-slate-600 hover:text-amber-500 hover:bg-amber-50"
                          )}
                        >
                          {v.isFeatured ? <IconStarFilled size={13} /> : <IconStar size={13} />}
                        </button>
                        <DropdownMenu
                          label="Valuation actions"
                          trigger={<div className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-all cursor-pointer"><IconDotsVertical size={16} /></div>}
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

            {/* List View Shared ERP Pagination */}
            {filtered.length > 0 && (
              <div className="pt-4 border-t border-slate-100">
                <PaginationControls
                  currentPage={page}
                  totalPages={totalPages}
                  totalItems={filtered.length}
                  pageSize={rowsPerPage}
                  itemLabel="records"
                  onPageChange={setPage}
                />
              </div>
            )}
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

      <div className="flex items-center gap-4 mt-6 mb-1">
        <hr className="flex-1 border-slate-200/60" />
        <span className="label-caps text-slate-500 tracking-widest font-mono text-xxs font-medium uppercase">
          VALUER PERFORMANCE & WORKLOAD ANALYTICS
        </span>
        <hr className="flex-1 border-slate-200/60" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
        {/* Valuer Performance Widget */}
        <div className="bg-white border border-slate-200/80 rounded-2xl shadow-2xs p-5 hover:shadow-xs transition-all duration-300 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2.5">
                <span className="size-8 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center shrink-0 shadow-2xs">
                  <IconReportAnalytics size={18} />
                </span>
                <div>
                  <h3 className="text-slate-900 text-sm font-medium leading-tight">Valuer Output & Volume</h3>
                  <p className="text-xxs font-mono font-medium text-slate-500 uppercase tracking-wider mt-0.5">
                    Portfolio volume by assigned firm or valuer
                  </p>
                </div>
              </div>
              <Badge tone="neutral" className="font-mono text-xxs px-2 py-0.5">
                VOLUME SHARE
              </Badge>
            </div>

            {valuerPerformance.length === 0 ? (
              <p className="text-slate-400 py-8 text-center text-xs font-mono">No valued prospects recorded yet.</p>
            ) : (
              <div className="flex flex-col gap-2.5">
                {paginatedValuers.map((l) => {
                  const avatarSrc = getAvatarForName(l.name, l.avatarUrl);
                  return (
                    <div
                      key={l.name}
                      onClick={() => setSelectedValuer(l)}
                      role="button"
                      tabIndex={0}
                      className="flex items-center gap-3.5 bg-slate-50/70 border border-slate-200/60 rounded-xl p-3 hover:bg-slate-100/80 hover:border-slate-300 transition-all cursor-pointer group/row shadow-2xs"
                    >
                      <Avatar
                        src={avatarSrc}
                        fallback={l.name.slice(0, 1)}
                        className="size-9 rounded-xl border border-slate-200/80 shadow-2xs shrink-0"
                      />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-medium text-slate-900 group-hover/row:text-[#151936] transition-colors truncate flex items-center gap-1.5">
                            {l.name}
                            <IconArrowUpRight size={12} className="text-slate-400 opacity-0 group-hover/row:opacity-100 transition-opacity shrink-0" />
                          </p>
                          <span className="font-mono text-xs font-medium text-[#151936] shrink-0">
                            {formatCompactKES(l.value)}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-2 mt-1.5">
                          <div className="flex-1 h-1.5 rounded-full bg-slate-200/80 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-emerald-600 transition-all duration-500"
                              style={{ width: `${Math.max(l.sharePct, 6)}%` }}
                            />
                          </div>
                          <span className="text-xxs text-slate-500 font-mono tracking-tight shrink-0">
                            {l.count} prospect{l.count === 1 ? "" : "s"} ({l.sharePct}%)
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Valuer Card Pagination */}
          {valuerPerformance.length > 0 && (
            <div className="mt-4 border-t border-slate-100 pt-3">
              <PaginationControls
                currentPage={safeValuerPage}
                totalPages={valuerTotalPages}
                totalItems={valuerPerformance.length}
                pageSize={valuerPageSize}
                itemLabel="valuers"
                onPageChange={setValuerPage}
              />
            </div>
          )}
        </div>

        {/* Pipeline by Manager Widget */}
        <div className="bg-white border border-slate-200/80 rounded-2xl shadow-2xs p-5 hover:shadow-xs transition-all duration-300 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2.5">
                <span className="size-8 rounded-xl bg-slate-100 border border-slate-200 text-[#151936] flex items-center justify-center shrink-0 shadow-2xs">
                  <IconUserCog size={18} />
                </span>
                <div>
                  <h3 className="text-slate-900 text-sm font-medium leading-tight">Property Manager Pipeline</h3>
                  <p className="text-xxs font-mono font-medium text-slate-500 uppercase tracking-wider mt-0.5">
                    Active workload & assignment distribution
                  </p>
                </div>
              </div>
              <Badge tone="neutral" className="font-mono text-xxs px-2 py-0.5">
                WORKLOAD SHARE
              </Badge>
            </div>

            {mgrPipeline.length === 0 ? (
              <p className="text-slate-400 py-8 text-center text-xs font-mono">No active workload assigned.</p>
            ) : (
              <div className="flex flex-col gap-2.5">
                {paginatedManagers.map((m) => {
                  const avatarSrc = getAvatarForName(m.name, m.avatarUrl);
                  return (
                    <div
                      key={m.name}
                      onClick={() => {
                        if (m.managerId) {
                          setManagerUserId(m.managerId);
                        } else {
                          const matchedId = valuations.find((v) => v.managerName === m.name)?.assignedManagerId;
                          if (matchedId) setManagerUserId(matchedId);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      className="flex items-center gap-3.5 bg-slate-50/70 border border-slate-200/60 rounded-xl p-3 hover:bg-slate-100/80 hover:border-slate-300 transition-all cursor-pointer group/row shadow-2xs"
                    >
                      <Avatar
                        src={avatarSrc}
                        fallback={m.name.slice(0, 1)}
                        className="size-9 rounded-xl border border-slate-200/80 shadow-2xs shrink-0"
                      />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-medium text-slate-900 group-hover/row:text-[#151936] transition-colors truncate flex items-center gap-1.5">
                            {m.name}
                            <IconArrowUpRight size={12} className="text-slate-400 opacity-0 group-hover/row:opacity-100 transition-opacity shrink-0" />
                          </span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="font-mono text-xs font-medium text-slate-900">{m.count}</span>
                            <span className="text-xxs text-slate-500 font-mono">active</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 mt-1.5">
                          <div className="flex-1 h-1.5 rounded-full bg-slate-200/80 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-[#151936] transition-all duration-500"
                              style={{ width: `${Math.max(m.barPct, 6)}%` }}
                            />
                          </div>
                          <span className="text-xxs text-slate-500 font-mono shrink-0 w-8 text-right">
                            {m.sharePct}%
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <div className="mt-4 border-t border-slate-100 pt-3.5 flex items-center justify-between">
              <span className="text-xs font-mono font-medium text-slate-500 uppercase tracking-wider">
                Mandates Signed This Month
              </span>
              <span className="font-mono text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200/80 px-2.5 py-1 rounded-lg flex items-center gap-1.5 shadow-2xs">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                {completedThisMonth} Mandate{completedThisMonth === 1 ? "" : "s"} Signed
              </span>
            </div>

            {/* PM Card Pagination */}
            {mgrPipeline.length > 0 && (
              <div className="mt-3 border-t border-slate-100 pt-2.5">
                <PaginationControls
                  currentPage={safeMgrPage}
                  totalPages={mgrTotalPages}
                  totalItems={mgrPipeline.length}
                  pageSize={mgrPageSize}
                  itemLabel="managers"
                  onPageChange={setMgrPage}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Valuation Activity Logger ── */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-2xs p-5 lg:p-6 mb-8 hover:shadow-xs transition-all duration-300">
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5">
              <span className="size-9 rounded-xl bg-sky-50 border border-sky-200/60 text-sky-700 flex items-center justify-center shrink-0 shadow-2xs">
                <IconClock size={19} />
              </span>
              <div>
                <h3 className="text-slate-900 text-sm font-medium leading-tight">Recent Valuation Activity</h3>
                <p className="text-xxs font-mono font-medium text-slate-500 uppercase tracking-wider mt-0.5">Audit log of transitions & modifications</p>
              </div>
            </div>
            <Badge tone="neutral" className="font-mono text-xxs px-2.5 py-0.5">
              {filteredValuationActivity.length} LOGGED EVENTS
            </Badge>
          </div>

          {/* Search & Filter bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative flex-1">
              <IconSearch size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search activity logs…"
                value={activitySearchQuery}
                onChange={(e) => {
                  setActivitySearchQuery(e.target.value);
                  setActivityPage(1);
                }}
                className="w-full bg-slate-50 border border-slate-200/80 text-xs rounded-xl pl-9 pr-4 py-2 focus:bg-white focus:border-[#151936] font-mono outline-none transition-all placeholder:text-slate-400"
              />
            </div>
            <div className="relative shrink-0">
              <IconFilter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              <select
                value={activityFilter}
                onChange={(e) => {
                  setActivityFilter(e.target.value);
                  setActivityPage(1);
                }}
                className="appearance-none bg-slate-50 border border-slate-200/80 text-xs font-mono text-slate-800 rounded-xl pl-8 pr-9 py-2 outline-none focus:border-[#151936] transition-all cursor-pointer"
              >
                <option value="all">All Events</option>
                <option value="stage_changes">Stage Changes</option>
                <option value="edits">Modifications</option>
                <option value="valuations">Valuations</option>
                <option value="system">System Actions</option>
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                <IconChevronRight size={14} className="rotate-90" />
              </div>
            </div>
          </div>
        </div>

        {valuationActivityLoading ? (
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner size="md" />
          </div>
        ) : valuationActivity.length === 0 ? (
          <div className="flex flex-col items-center text-center gap-3 py-12 bg-slate-50/70 rounded-2xl border border-slate-200/70 border-dashed">
            <div className="size-14 rounded-2xl bg-white border border-slate-200/80 flex items-center justify-center mb-1 shadow-2xs">
              <IconMoodEmpty size={28} className="text-slate-400" />
            </div>
            <h3 className="text-xs font-mono font-medium text-slate-700 uppercase tracking-wider">No activity recorded yet</h3>
            <p className="text-slate-500 max-w-sm text-xs">Stage transitions, edits, valuations, and decisions will safely log here.</p>
          </div>
        ) : paginatedValuationActivity.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-center">
            <IconSearch size={24} className="text-slate-300 mb-3" />
            <p className="text-xs font-mono font-medium text-slate-700 uppercase tracking-wider">No logs match your filter</p>
            <p className="text-xs text-slate-500 mt-1">Try adjusting the search query or dropdown filter.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4 relative ml-1">
            <div className="absolute left-[3.5px] top-2 bottom-6 w-px bg-slate-200 z-0" />
            {paginatedValuationActivity.map((entry) => {
              const toneColor = getActivityTone(entry.summary);
              return (
                <div key={entry.id} className="relative flex items-start lg:items-center gap-4 z-10 group">
                  <div className={cn("size-[8px] rounded-full mt-1.5 lg:mt-0 shrink-0 ring-4 shadow-xs", toneColor)} />
                  <Link
                    href={entry.associatedId ? `/admin/valuations/${entry.associatedId}` : "#"}
                    className="flex-1 min-w-0 flex flex-col lg:flex-row lg:items-center justify-between gap-2 lg:gap-6 hover:bg-slate-50/80 -my-1.5 -mx-3 p-2 px-3 rounded-xl transition-colors cursor-pointer border border-transparent hover:border-slate-200/60"
                  >
                    <p className="text-xs text-slate-600 leading-relaxed group-hover:text-slate-900 transition-colors flex-1 min-w-0 pr-4">
                      {entry.actorName ? (
                        <>
                          <span className="font-medium text-slate-900">{entry.actorName}</span>{" "}
                          {entry.summary.replace(entry.actorName, "").replace(/^ - |^ — /, "").trim()}
                        </>
                      ) : (
                        entry.summary
                      )}
                    </p>
                    <div className="flex items-center gap-3 shrink-0">
                      <p className="text-xs text-slate-500 font-mono tracking-wider hidden lg:block">
                        {new Date(entry.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })},{" "}
                        {new Date(entry.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                      <Badge tone="neutral" className="font-mono text-xxs px-2 py-0.5">
                        {relativeTime(entry.createdAt)}
                      </Badge>
                    </div>
                  </Link>
                </div>
              );
            })}
          </div>
        )}

        {/* Activity Logger Shared ERP Pagination Primitive */}
        {filteredValuationActivity.length > 0 && (
          <div className="pt-5 mt-6 border-t border-slate-100">
            <PaginationControls
              currentPage={safeActivityPage}
              totalPages={activityTotalPages}
              totalItems={filteredValuationActivity.length}
              pageSize={ACTIVITY_PER_PAGE}
              itemLabel="activity log entries"
              onPageChange={setActivityPage}
            />
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

      {/* ── Valuer Detail Modal ── */}
      {selectedValuer && (
        <Modal
          open={!!selectedValuer}
          onClose={() => setSelectedValuer(null)}
          title="Valuer Performance & Firm File"
          description="Detailed breakdown of valuation volume, portfolio contribution, and assigned prospects."
          size="lg"
        >
          <div className="space-y-6 pt-2">
            {/* Header Hero Banner */}
            <div className="flex items-center gap-4 bg-slate-50 border border-slate-200/80 rounded-2xl p-4 shadow-2xs">
              <Avatar
                src={getAvatarForName(selectedValuer.name, selectedValuer.avatarUrl)}
                fallback={selectedValuer.name.slice(0, 1)}
                className="size-14 rounded-2xl border border-slate-200/90 shadow-xs shrink-0"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-medium text-slate-900 truncate">{selectedValuer.name}</h3>
                  <Badge tone="primary" className="font-mono text-xxs uppercase tracking-wider">
                    ACCREDITED VALUER
                  </Badge>
                </div>
                <p className="text-xs text-slate-500 font-mono mt-1">
                  Valuation Firm & Independent Advisory Partner
                </p>
              </div>
              <div className="text-right shrink-0">
                <span className="block text-xxs font-mono font-medium text-slate-500 uppercase tracking-wider">Total Volume</span>
                <span className="font-mono text-lg font-medium text-[#151936] block mt-0.5">
                  {formatKES(selectedValuer.value)}
                </span>
              </div>
            </div>

            {/* Fact Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-50/80 border border-slate-200/70 rounded-2xl p-3 shadow-2xs">
                <span className="block text-xxs font-mono font-medium text-slate-500 uppercase tracking-wider">Assigned Output</span>
                <span className="font-mono text-sm font-medium text-slate-900 block mt-1">{formatCompactKES(selectedValuer.value)}</span>
              </div>
              <div className="bg-slate-50/80 border border-slate-200/70 rounded-2xl p-3 shadow-2xs">
                <span className="block text-xxs font-mono font-medium text-slate-500 uppercase tracking-wider">Volume Share</span>
                <span className="font-mono text-sm font-medium text-emerald-700 block mt-1">{selectedValuer.sharePct}%</span>
              </div>
              <div className="bg-slate-50/80 border border-slate-200/70 rounded-2xl p-3 shadow-2xs">
                <span className="block text-xxs font-mono font-medium text-slate-500 uppercase tracking-wider">Valued Prospects</span>
                <span className="font-mono text-sm font-medium text-slate-900 block mt-1">{selectedValuer.count} Properties</span>
              </div>
              <div className="bg-slate-50/80 border border-slate-200/70 rounded-2xl p-3 shadow-2xs">
                <span className="block text-xxs font-mono font-medium text-slate-500 uppercase tracking-wider">Licensing Status</span>
                <span className="font-mono text-xs font-medium text-emerald-800 block mt-1 flex items-center gap-1">
                  <span className="size-1.5 rounded-full bg-emerald-500" /> Active VRB
                </span>
              </div>
            </div>

            {/* Assigned Valuation Prospects List */}
            <div>
              <div className="flex items-center justify-between gap-2 mb-3">
                <h4 className="text-xs font-mono font-medium text-slate-700 uppercase tracking-wider">
                  Associated Valuation Prospects ({selectedValuer.count})
                </h4>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {valuations
                  .filter((v) => valuerLabel(v) === selectedValuer.name)
                  .map((v) => {
                    const subject = subjectOf(v);
                    const cfg = STAGE_META[v.stage] ?? STAGE_META.requested;
                    return (
                      <div
                        key={v.id}
                        className="flex items-center justify-between gap-3 bg-white border border-slate-200/80 rounded-xl p-3 hover:border-slate-300 transition-colors shadow-2xs"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/60">
                              {v.valuationCode}
                            </span>
                            <span className="text-xs font-medium text-slate-900 truncate">{subject.name}</span>
                          </div>
                          <p className="text-xxs text-slate-500 font-mono mt-1 truncate">{subject.location}</p>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right">
                            <span className="block font-mono text-xs font-medium text-[#151936]">
                              {v.marketValueKes ? formatCompactKES(Number(v.marketValueKes)) : "—"}
                            </span>
                            <Badge tone={stageTone(v.stage)} className="mt-0.5 text-xxs">
                              {cfg.label}
                            </Badge>
                          </div>

                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              setSelectedValuer(null);
                              router.push(`/admin/valuations/${v.id}`);
                            }}
                            className="h-8 px-2.5 text-xs"
                          >
                            Open File <IconArrowUpRight size={13} />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end pt-4 border-t border-slate-200">
              <Button variant="secondary" onClick={() => setSelectedValuer(null)}>
                Close Window
              </Button>
            </div>
          </div>
        </Modal>
      )}

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

      <ActionLoadingOverlay
        show={isSigning || isDeleting}
        title={isSigning ? "Signing Management Mandate…" : "Deleting Valuation Prospect…"}
        description="Updating database records and pipeline statistics."
      />
    </PageTransition>
  );
}
