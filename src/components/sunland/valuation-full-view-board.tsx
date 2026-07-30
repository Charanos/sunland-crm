"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  IconAlertTriangle,
  IconArrowUpRight,
  IconBuildingCommunity,
  IconCalendarEvent,
  IconCheck,
  IconChevronRight,
  IconChevronLeft,
  IconDotsVertical,
  IconFileCertificate,
  IconFileText,
  IconFileTypePdf,
  IconHistory,
  IconMail,
  IconMapPin,
  IconMessageCircle,
  IconPhone,
  IconSend,
  IconShieldCheck,
  IconShieldHalf,
  IconUpload,
  IconUserCog,
  IconX,
} from "@tabler/icons-react";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast-provider";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { formatCompactKES, formatKES } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { PropertyOwnerProfileDrawer } from "./property-owner-profile-drawer";
import { PropertyManagerProfileDrawer } from "./property-manager-profile-drawer";
import { type Property } from "./property-constants";
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
import { Badge } from "@/components/ui/erp-primitives";

const VALUATION_COVER_POOL = [
  "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1200&q=80",
  "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1200&q=80",
  "https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=1200&q=80",
  "https://images.unsplash.com/photo-1605276374104-dee2a0ed3cd6?w=1200&q=80",
  "https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=1200&q=80",
  "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=1200&q=80",
  "https://images.unsplash.com/photo-1523217582562-09d0def993a6?w=1200&q=80",
  "https://images.unsplash.com/photo-1469022563428-aa54fca6bce1?w=1200&q=80",
];
import { ValuationFormModal, type ValuationEditTarget } from "./valuation-form-modal";
import { ValuationSubmitModal, type ValuationSubmitTarget } from "./valuation-complete-modal";
import { ValuationDocumentModal } from "./valuation-document-modal";

type VitalTone = "emerald" | "amber" | "rose" | "neutral";

interface Vital {
  label: string;
  value: string;
  sub?: string;
  icon: React.ComponentType<{ size?: number; className?: string; stroke?: number }>;
  tone: VitalTone;
  hasBar?: boolean;
  barRatio?: number;
  onClick?: () => void;
}

const VITAL_TONE_BG: Record<VitalTone, string> = {
  emerald: "bg-gradient-to-br from-white to-[#ecfdf5]/30 border-slate-200/80 hover:to-[#ecfdf5]/55",
  amber: "bg-gradient-to-br from-white to-[#fffbeb]/45 border-slate-200/80 hover:to-[#fffbeb]/70",
  rose: "bg-gradient-to-br from-white to-[#fff1f2]/30 border-slate-200/80 hover:to-[#fff1f2]/55",
  neutral: "bg-gradient-to-br from-white to-slate-50/40 border-slate-200/80 hover:to-slate-50/60",
};

const VITAL_TONE_ICON: Record<VitalTone, string> = {
  emerald: "text-emerald-500",
  amber: "text-amber-500",
  rose: "text-rose-500",
  neutral: "text-slate-400",
};

const VITAL_TONE_BAR: Record<VitalTone, string> = {
  emerald: "bg-emerald-500",
  amber: "bg-amber-500",
  rose: "bg-rose-500",
  neutral: "bg-slate-900",
};

const VITAL_TONE_ARTWORK: Record<VitalTone, string> = {
  emerald: "text-[#047857]",
  amber: "text-[#b45309]",
  rose: "text-[#be123c]",
  neutral: "text-slate-500",
};

interface Comparable {
  name: string;
  pricePerSqft: number;
  adjustmentPct: number;
  adjustedValueKes: number;
}

interface ValuationDetail {
  id: string;
  entityId: string;
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
  comparables: Comparable[] | null;
  siteVisitAt: string | null;
  completedAt: string | null;
  validUntil: string | null;
  reportUrl: string | null;
  notes: string | null;
  stageEnteredAt: string;
  resultingMandateId: string | null;
  createdAt: string;
  propertyName: string | null;
  propertyCode: string | null;
  propertyLocation: string | null;
  propertyMedia: Array<{ url: string; alt?: string; isPrimary?: boolean }> | null;
  landlordName: string | null;
  landlordEmail: string | null;
  landlordPhone: string | null;
  landlordVerifiedAt: string | null;
  landlordAvatarUrl: string | null;
  managerName: string | null;
  valuersEntityName: string | null;
  valuerName: string | null;
  valuerEmail: string | null;
}

interface AuditEntry {
  id: string;
  summary: string;
  createdAt: string;
}

interface DocumentRow {
  id: string;
  title: string;
  type: string;
  fileUrl: string;
  createdAt: string;
}

type TabKey = "overview" | "comparables" | "methodology" | "documents" | "activity";

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

const DOC_TYPE_ICON: Record<string, typeof IconFileTypePdf> = {
  valuation_report: IconFileTypePdf,
  offer_letter: IconFileTypePdf,
  identification: IconFileText,
};

export function ValuationFullViewBoard({
  entityId,
  valuationId,
  canManage = true,
}: {
  entityId: string | null;
  valuationId: string;
  canManage?: boolean;
}) {
  const router = useRouter();
  const { pushToast } = useToast();

  const [valuation, setValuation] = useState<ValuationDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshCount, setRefreshCount] = useState(0);

  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [menuOpen, setMenuOpen] = useState(false);

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [submitModalOpen, setSubmitModalOpen] = useState(false);
  const [docModalOpen, setDocModalOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [signConfirmOpen, setSignConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSigning, setIsSigning] = useState(false);

  const [activityLog, setActivityLog] = useState<AuditEntry[] | null>(null);
  const [activityLoading, setActivityLoading] = useState(false);
  const [documents, setDocuments] = useState<DocumentRow[] | null>(null);
  const [documentsLoading, setDocumentsLoading] = useState(false);

  const [ownerContactId, setOwnerContactId] = useState<string | null>(null);
  const [managerUserId, setManagerUserId] = useState<string | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);

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

  useEffect(() => {
    let active = true;
    const fetchValuation = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/valuations/${valuationId}?entityId=${entityId || ""}`);
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        const data = await res.json();
        if (!active) return;
        if (data.valuation) {
          setValuation(data.valuation);
        } else {
          setError("This valuation couldn't be found.");
        }
      } catch (err) {
        if (!active) return;
        console.error("Failed to load valuation:", err);
        setError("Couldn't load this valuation. Check your connection and try again.");
      } finally {
        if (active) setIsLoading(false);
      }
    };
    fetchValuation();
    return () => { active = false; };
  }, [valuationId, entityId, refreshCount]);

  useEffect(() => {
    if (activeTab !== "activity" || !entityId) return;
    let active = true;
    Promise.resolve().then(() => setActivityLoading(true));
    fetch(`/api/audit?entityId=${entityId}&associatedType=valuation&associatedId=${valuationId}&limit=15`)
      .then((res) => (res.ok ? res.json() : { entries: [] }))
      .then((data) => { if (active) setActivityLog(Array.isArray(data.entries) ? data.entries : []); })
      .catch(() => { if (active) setActivityLog([]); })
      .finally(() => { if (active) setActivityLoading(false); });
    return () => { active = false; };
  }, [activeTab, entityId, valuationId, refreshCount]);

  useEffect(() => {
    if (activeTab !== "documents" || !entityId) return;
    let active = true;
    Promise.resolve().then(() => setDocumentsLoading(true));
    fetch(`/api/documents?entityId=${entityId}&valuationId=${valuationId}`)
      .then((res) => (res.ok ? res.json() : { documents: [] }))
      .then((data) => { if (active) setDocuments(Array.isArray(data.documents) ? data.documents : []); })
      .catch(() => { if (active) setDocuments([]); })
      .finally(() => { if (active) setDocumentsLoading(false); });
    return () => { active = false; };
  }, [activeTab, entityId, valuationId, refreshCount]);

  const score = useMemo(() => {
    if (!valuation) return null;
    if (STAGE_ORDER.indexOf(valuation.stage) < STAGE_ORDER.indexOf("valued") || valuation.stage === "declined") return null;
    if (!valuation.marketValueKes || !valuation.proposedFeeRate) return null;
    return scoreForValuation({
      proposedFeeRatePct: Number(valuation.proposedFeeRate) * 100,
      marketValueKes: Number(valuation.marketValueKes),
      landlordVerified: !!valuation.landlordVerifiedAt,
      ageDays: daysSince(valuation.stageEnteredAt),
    });
  }, [valuation]);

  const isPortfolio = !!valuation?.propertyId;
  const subjectName = isPortfolio ? valuation?.propertyName ?? "Portfolio property" : valuation?.externalPropertyName ?? "Unknown subject";
  const subjectLocation = isPortfolio ? valuation?.propertyLocation ?? "-" : valuation?.externalLocation ?? "-";
  const heroImg = valuation?.propertyMedia?.find((m) => m.isPrimary)?.url ?? valuation?.propertyMedia?.[0]?.url ?? null;
  const fallbackCoverImg = useMemo(() => {
    if (!valuation?.id) return VALUATION_COVER_POOL[0];
    const hash = parseInt(valuation.id.replace(/-/g, "").slice(-4), 16);
    return VALUATION_COVER_POOL[hash % VALUATION_COVER_POOL.length];
  }, [valuation?.id]);
  const displayCoverImg = heroImg ?? fallbackCoverImg;

  const cfg = valuation ? STAGE_META[valuation.stage] ?? STAGE_META.requested : STAGE_META.requested;
  const valuerDisplayName = valuation?.externalValuerName ?? valuation?.valuerName ?? (valuation?.valuersEntityName ?? "Sunland Valuers Ltd");
  const estAnnualRevenue = valuation?.marketValueKes && valuation?.proposedFeeRate
    ? Number(valuation.marketValueKes) * Number(valuation.proposedFeeRate)
    : null;

  const vitals: Vital[] = useMemo(() => {
    if (!valuation) return [];
    const scoreTone: VitalTone = score ? (score.grade === "A" || score.grade === "B" ? "emerald" : "amber") : "neutral";
    return [
      {
        label: "Assessed Market Value",
        value: valuation.marketValueKes ? formatCompactKES(Number(valuation.marketValueKes)) : "—",
        sub: score ? `Grade ${score.grade} · ${score.label}` : "Pending valuation assessment",
        icon: IconArrowUpRight,
        tone: scoreTone,
        hasBar: !!score,
        barRatio: score ? score.score / 100 : undefined
      },
      {
        label: "Proposed Fee Rate",
        value: valuation.proposedFeeRate ? `${(Number(valuation.proposedFeeRate) * 100).toFixed(1)}%` : "—",
        sub: estAnnualRevenue ? `${formatCompactKES(estAnnualRevenue)}/yr est. annual` : "Set upon submission",
        icon: IconFileCertificate,
        tone: valuation.proposedFeeRate ? "amber" : "neutral",
      },
      {
        label: "Prospective Landlord",
        value: valuation.landlordName ?? "Unassigned",
        sub: valuation.landlordVerifiedAt ? "Verified Landlord ✓" : "Landlord Unverified",
        icon: IconShieldCheck,
        tone: valuation.landlordVerifiedAt ? "emerald" : "neutral",
        onClick: () => { if (valuation.landlordContactId) setOwnerContactId(valuation.landlordContactId); },
      },
      {
        label: "Assigned Property Manager",
        value: valuation.managerName ?? "Unassigned",
        sub: "Sunland Property Manager",
        icon: IconUserCog,
        tone: "neutral",
        onClick: () => { if (valuation.assignedManagerId) setManagerUserId(valuation.assignedManagerId); },
      },
    ];
  }, [valuation, score, estAnnualRevenue]);

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error && !valuation) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
        <IconAlertTriangle size={32} className="text-rose-400" aria-hidden="true" />
        <p className="text-title-primary">{error}</p>
      </div>
    );
  }

  if (!valuation) {
    return <div className="p-8 text-center text-desc-secondary">Valuation not found.</div>;
  }

  const refresh = () => setRefreshCount((c) => c + 1);

  const transitionStage = async (toStage: ValuationStage) => {
    if (!canMoveToStage(valuation.stage, toStage)) return;
    try {
      const res = await fetch(`/api/valuations/${valuation.id}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityId, stage: toStage }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to move stage");
      pushToast({ tone: toStage === "declined" ? "info" : "success", title: `${valuation.valuationCode} → ${STAGE_META[toStage].label}`, body: "" });
      refresh();
    } catch (err) {
      pushToast({ tone: "warning", title: "Error", body: err instanceof Error ? err.message : "Failed to move stage" });
    }
  };

  const handleSignMandate = async () => {
    setIsSigning(true);
    try {
      const res = await fetch(`/api/valuations/${valuation.id}/sign-mandate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to sign mandate");
      pushToast({ tone: "success", title: "Mandate Created", body: `${valuation.valuationCode} is now a real management mandate.` });
      refresh();
    } catch (err) {
      pushToast({ tone: "warning", title: "Error", body: err instanceof Error ? err.message : "Failed to sign mandate" });
    } finally {
      setIsSigning(false);
      setSignConfirmOpen(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/valuations/${valuation.id}?entityId=${entityId || ""}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Failed to delete");
      }
      pushToast({ tone: "success", title: "Deleted", body: "Prospect removed." });
      router.push("/admin/valuations");
    } catch (e: unknown) {
      pushToast({ tone: "warning", title: "Error", body: e instanceof Error ? e.message : "Failed to delete" });
      setIsDeleting(false);
      setDeleteConfirmOpen(false);
    }
  };

  // Stage-appropriate primary action, mirroring the design's per-stage footer button.
  let primary: { label: string; icon: typeof IconSend; onClick: () => void } | null = null;
  if (valuation.stage === "requested") primary = { label: "Confirm Site Visit", icon: IconCalendarEvent, onClick: () => transitionStage("site_visit") };
  else if (valuation.stage === "site_visit") primary = { label: "Submit Valuation", icon: IconFileCertificate, onClick: () => setSubmitModalOpen(true) };
  else if (valuation.stage === "valued") primary = { label: "Send Offer Letter", icon: IconSend, onClick: () => transitionStage("offer_sent") };
  else if (valuation.stage === "offer_sent") primary = { label: "Record Acceptance", icon: IconShieldCheck, onClick: () => transitionStage("accepted") };
  else if (valuation.stage === "accepted") primary = { label: "Create Mandate", icon: IconFileCertificate, onClick: () => setSignConfirmOpen(true) };
  else if (valuation.stage === "declined") primary = { label: "Re-open Prospect", icon: IconChevronRight, onClick: () => transitionStage("valued") };

  const editTarget: ValuationEditTarget = {
    id: valuation.id,
    valuationCode: valuation.valuationCode,
    propertyId: valuation.propertyId,
    externalPropertyName: valuation.externalPropertyName,
    externalLocation: valuation.externalLocation,
    landlordContactId: valuation.landlordContactId,
    assignedManagerId: valuation.assignedManagerId,
    valuerId: valuation.valuerId,
    externalValuerName: valuation.externalValuerName,
    isLand: valuation.isLand,
    siteVisitAt: valuation.siteVisitAt,
    notes: valuation.notes,
  };

  const submitTarget: ValuationSubmitTarget = {
    id: valuation.id,
    valuationCode: valuation.valuationCode,
    marketValueKes: valuation.marketValueKes,
    proposedFeeRate: valuation.proposedFeeRate,
    methodology: valuation.methodology,
  };

  const tabs: Array<{ key: TabKey; label: string; icon: typeof IconFileText }> = [
    { key: "overview", label: "Overview", icon: IconBuildingCommunity },
    { key: "comparables", label: "Comparables", icon: IconArrowUpRight },
    { key: "methodology", label: "Methodology", icon: IconFileText },
    { key: "documents", label: "Documents", icon: IconFileTypePdf },
    { key: "activity", label: "Activity", icon: IconHistory },
  ];

  return (
    <div className="mx-auto flex max-w-[98rem] flex-col gap-6 pb-12">
      {/* ── Standardized Executive Page Header Toolbar ── */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 px-1 mt-2 animate-fade-in-up">
        <div className="flex flex-col gap-2 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={() => router.push("/admin/valuations")}
              aria-label="Back to valuations board"
              className="size-8 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors flex items-center justify-center shrink-0 shadow-2xs"
            >
              <IconChevronLeft size={16} />
            </button>
            <h1 className="title-serif text-[#151936] text-2xl lg:text-3xl font-normal leading-tight truncate">
              {subjectName}
            </h1>
            <Badge tone={stageTone(valuation.stage)}>
              {cfg.label}
            </Badge>
          </div>
          <div className="flex items-center gap-3 text-slate-500 text-xs min-w-0 font-medium">
            <span className="flex items-center gap-1.5 min-w-0 text-slate-600">
              <IconMapPin size={15} className="shrink-0 text-slate-500" aria-hidden="true" />
              <span className="truncate">{subjectLocation}</span>
            </span>
            <span className="text-slate-200 shrink-0">|</span>
            <span className="font-mono text-slate-500 shrink-0 uppercase tracking-wider">
              VALUATION {valuation.valuationCode}
            </span>
            <span className="text-slate-200 shrink-0">|</span>
            <span className="shrink-0 text-slate-500">
              {valuation.isLand ? "Land Subject" : "Built Property"}
            </span>
          </div>
        </div>

        {/* CTA Actions aligned to the right */}
        {canManage && (
          <div className="flex items-center gap-2.5 shrink-0 flex-wrap mt-1 sm:mt-0">
            {primary && (
              <button
                type="button"
                onClick={primary.onClick}
                className="bg-[#151936] text-[#f3df27] hover:bg-[#1a1f42] border border-white/20 font-medium text-xs sm:text-sm rounded-xl px-4 py-2 shadow-md transition-colors flex items-center gap-2"
              >
                <primary.icon size={15} /> {primary.label}
              </button>
            )}
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                aria-label="More actions"
                className="size-[38px] inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors shadow-2xs"
              >
                <IconDotsVertical size={16} />
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-[44px] z-30 w-52 bg-white border border-slate-200/90 rounded-2xl shadow-xl p-1.5 animate-in fade-in zoom-in-95">
                  <button
                    onClick={() => { setEditModalOpen(true); setMenuOpen(false); }}
                    className="w-full text-left flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <IconUserCog size={15} className="text-slate-400" /> Edit prospect details
                  </button>
                  <button
                    onClick={() => { setDocModalOpen(true); setMenuOpen(false); }}
                    className="w-full text-left flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <IconUpload size={15} className="text-slate-400" /> Attach document
                  </button>
                  {valuation.stage !== "mandate_signed" && valuation.stage !== "declined" && (
                    <button
                      onClick={() => { transitionStage("declined"); setMenuOpen(false); }}
                      className="w-full text-left flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors"
                    >
                      <IconX size={15} /> Decline prospect
                    </button>
                  )}
                  <div className="h-px bg-slate-100 my-1" />
                  <button
                    onClick={() => { setDeleteConfirmOpen(true); setMenuOpen(false); }}
                    className="w-full text-left flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors"
                  >
                    <IconX size={15} /> Delete prospect
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Standardized High-Contrast Photo Hero Banner ── */}
      <div className="relative rounded-[28px] overflow-hidden h-[260px] sm:h-[300px] bg-[#151936] flex flex-col shadow-md animate-fade-in-up border border-slate-200/80">
        {displayCoverImg ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={displayCoverImg} alt={subjectName} className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#151936] via-[#1e2336] to-[#0c1f24]" />
        )}
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(15,23,42,0.15) 0%, rgba(15,23,42,0.85) 100%)" }} />

        {/* High contrast text overlay on bottom left */}
        <div className="relative z-10 p-6 mt-auto flex items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="font-mono text-xs font-medium text-amber-300 bg-black/40 backdrop-blur-md border border-white/20 px-2.5 py-0.5 rounded-md">
                {valuation.valuationCode}
              </span>
              <span className="text-xs font-medium text-white/90 bg-black/40 backdrop-blur-md border border-white/20 px-2.5 py-0.5 rounded-md flex items-center gap-1">
                <IconMapPin size={13} className="text-amber-400" /> {subjectLocation}
              </span>
            </div>
            <h2 className="title-serif text-white text-2xl sm:text-3xl font-normal drop-shadow-md">
              {subjectName}
            </h2>
          </div>
        </div>
      </div>

      {/* ── Executive Stage Pipeline & Velocity Timeline ── */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-2xs hover:shadow-xs transition-all duration-300">
        {/* Top Velocity & SLA Summary Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 mb-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <span className="size-9 rounded-xl bg-[#151936] text-[#f3df27] flex items-center justify-center shrink-0 shadow-2xs">
              <IconHistory size={18} />
            </span>
            <div>
              <h3 className="text-sm font-medium text-slate-900 leading-tight">Pipeline Stage & Velocity Tracker</h3>
              <p className="text-xxs font-mono font-medium text-slate-500 uppercase tracking-wider mt-0.5">
                Stage progression, velocity SLA & transition history
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {valuation.stage !== "declined" ? (
              <>
                <Badge tone="neutral" className="font-mono text-xs">
                  {daysSince(valuation.stageEnteredAt)}d in current stage
                </Badge>
                {daysSince(valuation.stageEnteredAt) > 21 ? (
                  <Badge tone="warning" className="font-mono text-xs flex items-center gap-1">
                    <IconAlertTriangle size={13} /> SLA Warning (&gt;21d)
                  </Badge>
                ) : (
                  <Badge tone="success" className="font-mono text-xs flex items-center gap-1">
                    ⚡ Velocity On Track
                  </Badge>
                )}
              </>
            ) : (
              <Badge tone="risk" className="font-mono text-xs">
                Prospect Declined
              </Badge>
            )}
          </div>
        </div>

        {/* Visual Timeline Nodes */}
        {valuation.stage === "declined" ? (
          <div className="bg-rose-50/60 border border-rose-200/80 rounded-xl p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="size-8 rounded-full bg-rose-500 text-white flex items-center justify-center shrink-0">
                <IconX size={16} />
              </span>
              <div>
                <p className="text-xs font-medium text-rose-900">Prospect Marked as Declined</p>
                <p className="text-xxs text-rose-700 font-mono mt-0.5">
                  Declined {daysSince(valuation.stageEnteredAt)} days ago. Re-open at any time to resume valuation pipeline.
                </p>
              </div>
            </div>
            {canManage && (
              <button
                type="button"
                onClick={() => transitionStage("valued")}
                className="bg-white border border-rose-200 text-rose-700 hover:bg-rose-100 font-medium text-xs rounded-xl px-3.5 py-1.5 transition-colors shrink-0 shadow-2xs"
              >
                Re-open Prospect
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex items-center w-full px-1">
              {STAGE_ORDER.map((s, i) => {
                const curIdx = STAGE_ORDER.indexOf(valuation.stage);
                const isPast = i < curIdx;
                const isCurrent = s === valuation.stage;
                const isLast = i === STAGE_ORDER.length - 1;

                return (
                  <div key={s} className="flex items-center flex-1 min-w-0 group relative">
                    {/* Node Circle */}
                    <div className="flex flex-col items-center relative z-10 shrink-0">
                      {isPast ? (
                        <span className="size-7 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-2xs border-2 border-white">
                          <IconCheck size={14} />
                        </span>
                      ) : isCurrent ? (
                        <span className="size-8 rounded-full bg-[#151936] text-[#f3df27] font-mono text-xs font-medium flex items-center justify-center shadow-md ring-4 ring-[#151936]/15 border-2 border-[#f3df27] animate-pulse">
                          {i + 1}
                        </span>
                      ) : (
                        <span className="size-6 rounded-full bg-slate-100 border border-slate-300 text-slate-400 font-mono text-[10px] flex items-center justify-center">
                          {i + 1}
                        </span>
                      )}
                    </div>

                    {/* Line Segment */}
                    {!isLast && (
                      <div
                        className={cn(
                          "h-1 flex-1 mx-1.5 rounded-full transition-colors",
                          i < curIdx ? "bg-emerald-500" : "bg-slate-200/80"
                        )}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Stage Labels Row */}
            <div className="grid grid-cols-6 gap-1 w-full pt-1 text-center">
              {STAGE_ORDER.map((s, i) => {
                const isCurrent = s === valuation.stage;
                const isPast = i < STAGE_ORDER.indexOf(valuation.stage);
                return (
                  <div key={s} className="flex flex-col items-center">
                    <span
                      className={cn(
                        "text-[11px] font-medium truncate w-full px-1",
                        isCurrent
                          ? "text-[#151936] font-medium"
                          : isPast
                            ? "text-slate-700 font-medium"
                            : "text-slate-400"
                      )}
                    >
                      {STAGE_META[s].label}
                    </span>
                    {isCurrent && (
                      <Badge tone="warning" className="mt-1">
                        ACTIVE
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Vitals ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {vitals.map((v) => (
          <div
            key={v.label}
            onClick={v.onClick}
            className={cn(
              "relative overflow-hidden rounded-2xl border p-5 flex flex-col justify-between group/vital shadow-sm hover:shadow-md hover:border-slate-300 transition-all duration-300 h-[140px]",
              v.onClick && "cursor-pointer",
              VITAL_TONE_BG[v.tone]
            )}
          >
            <v.icon
              size={140}
              stroke={1}
              className={cn(
                "absolute -right-6 -bottom-6 opacity-[0.03] group-hover/vital:scale-110 group-hover/vital:opacity-[0.05] transition-all duration-500 pointer-events-none",
                VITAL_TONE_ARTWORK[v.tone]
              )}
              aria-hidden="true"
            />
            <div className="flex items-start justify-between relative z-10">
              <div className="flex flex-col gap-1 max-w-[calc(100%-12px)]">
                <span className="text-xs text-slate-400 flex items-center gap-1.5 font-medium">
                  <v.icon size={13} className={VITAL_TONE_ICON[v.tone]} aria-hidden="true" />
                  {v.label}
                </span>
                <span className="font-mono font-medium text-slate-900 mt-1 text-2xl truncate leading-none">
                  {v.value}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between mt-auto pt-3 relative z-10">
              <div className="flex items-center gap-2">
                {v.hasBar ? (
                  <div className="flex flex-col gap-1.5 w-full min-w-[100px]">
                    <div className="h-1.5 rounded-full bg-slate-200/40 overflow-hidden">
                      <div className={cn("h-full rounded-full", VITAL_TONE_BAR[v.tone])} style={{ width: `${Math.min(100, Math.round((v.barRatio ?? 0) * 100))}%` }} />
                    </div>
                    {v.sub && <span className="text-xs text-slate-500 font-medium">{v.sub}</span>}
                  </div>
                ) : (
                  v.sub && (
                    <span className="mono-data text-xs flex font-medium items-center px-1.5 py-0.5 rounded-md bg-slate-50 text-slate-600">
                      {v.sub}
                    </span>
                  )
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Action band ── */}
      {valuation.stage === "valued" && (
        <div className="rounded-2xl p-4 flex items-center justify-between gap-4 border border-amber-200 bg-amber-500/[0.04] shadow-sm animate-fade-in-up">
          <div className="flex items-start gap-3 min-w-0">
            <span className="size-9 rounded-xl bg-amber-100/80 text-amber-700 flex items-center justify-center shrink-0"><IconFileCertificate size={18} /></span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-950">Valuation ready - awaiting your offer decision</p>
              <p className="text-xs text-slate-500 mt-0.5">{valuation.managerName ?? "The assigned manager"} completed the site visit; valued at {valuation.marketValueKes ? formatCompactKES(Number(valuation.marketValueKes)) : "—"}.</p>
            </div>
          </div>
          <button type="button" onClick={() => transitionStage("offer_sent")} className="rounded-xl px-4 py-1.5 text-xxs font-medium whitespace-nowrap bg-[#f3df27] text-[#151936] hover:bg-[#e6d220] shadow-sm">
            Send Offer Letter
          </button>
        </div>
      )}

      {/* ── Tabs + rail ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        <div className="min-w-0 flex flex-col gap-4">
          <div role="tablist" aria-label="Valuation sections" className="flex bg-white border border-slate-100 p-1.5 rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.02)] gap-1 overflow-x-auto">
            {tabs.map((t) => (
              <button
                key={t.key}
                role="tab"
                aria-selected={activeTab === t.key}
                onClick={() => setActiveTab(t.key)}
                className={cn(
                  "px-4 py-1.5 rounded-xl transition-all duration-300 flex items-center gap-2 shrink-0 whitespace-nowrap font-medium text-sm",
                  activeTab === t.key ? "bg-[#151936] text-white shadow-md" : "text-slate-500 hover:text-slate-900 hover:bg-slate-50",
                )}
              >
                <t.icon size={12} /> {t.label}
              </button>
            ))}
          </div>

          {activeTab === "overview" && (
            <>
              <Card className="bg-white border border-slate-100 rounded-[24px] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                <h3 className="text-sm font-medium text-slate-900 mb-4">Property Particulars</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  <div className="border border-slate-100 bg-slate-50 rounded-2xl p-4">
                    <p className="label-caps text-slate-400 mb-1">Subject Type</p>
                    <p className="text-body-primary text-slate-900">{valuation.isLand ? "Land" : "Built Property"}</p>
                  </div>
                  <div className="border border-slate-100 bg-slate-50 rounded-2xl p-4">
                    <p className="label-caps text-slate-400 mb-1">Location</p>
                    <p className="text-body-primary text-slate-900">{subjectLocation}</p>
                  </div>
                  <div className="border border-slate-100 bg-slate-50 rounded-2xl p-4">
                    <p className="label-caps text-slate-400 mb-1">Requested</p>
                    <p className="text-body-primary text-slate-900">{fmtDate(valuation.createdAt)}</p>
                  </div>
                </div>
              </Card>
              <Card className="bg-white border border-slate-100 rounded-[24px] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                <h3 className="text-sm font-medium text-slate-900 mb-3">Notes</h3>
                <p className="text-body-regular text-slate-600 whitespace-pre-line">{valuation.notes || "No notes recorded."}</p>
              </Card>
            </>
          )}

          {activeTab === "comparables" && (
            <Card className="bg-white border border-slate-100 rounded-[24px] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
              <h3 className="text-sm font-medium text-slate-900 mb-1">Comparable Evidence</h3>
              <p className="text-desc-secondary mb-4">Entered by the valuer when the valuation was submitted.</p>
              {!valuation.comparables || valuation.comparables.length === 0 ? (
                <p className="text-slate-400 text-center py-10 text-sm bg-slate-50 rounded-2xl border border-dashed border-slate-200">No comparable evidence recorded.</p>
              ) : (
                <div className="overflow-x-auto">
                  <div className="min-w-[480px]">
                    <div className="grid grid-cols-[1.4fr_0.9fr_0.9fr_0.9fr] gap-2 px-3 py-2 bg-slate-50 border border-slate-100 rounded-t-xl">
                      <span className="label-caps text-slate-400">Comparable</span>
                      <span className="label-caps text-slate-400 text-right">KES/sqft</span>
                      <span className="label-caps text-slate-400 text-right">Adj.</span>
                      <span className="label-caps text-slate-400 text-right">Adj. Value</span>
                    </div>
                    {valuation.comparables.map((c, i) => (
                      <div key={i} className="grid grid-cols-[1.4fr_0.9fr_0.9fr_0.9fr] gap-2 px-3 py-2.5 border-x border-b border-slate-50 items-center">
                        <span className="text-sm text-slate-700 truncate">{c.name}</span>
                        <span className="font-mono text-xs text-slate-500 text-right">{formatKES(c.pricePerSqft)}</span>
                        <span className={cn("font-mono text-xs text-right", c.adjustmentPct > 0 ? "text-emerald-600" : c.adjustmentPct < 0 ? "text-rose-600" : "text-slate-400")}>
                          {c.adjustmentPct > 0 ? "+" : ""}{c.adjustmentPct}%
                        </span>
                        <span className="font-mono text-xs text-slate-900 text-right">{formatCompactKES(c.adjustedValueKes)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          )}

          {activeTab === "methodology" && (
            <Card className="bg-white border border-slate-100 rounded-[24px] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
              <h3 className="text-sm font-medium text-slate-900 mb-3">Methodology &amp; Assumptions</h3>
              <p className="text-body-regular text-slate-600 whitespace-pre-line leading-relaxed">{valuation.methodology || "Not yet recorded - captured when the valuation is submitted."}</p>
            </Card>
          )}

          {activeTab === "documents" && (
            <Card className="bg-white border border-slate-100 rounded-[24px] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-slate-900">Documents</h3>
                <button onClick={() => setDocModalOpen(true)} className="inline-flex items-center gap-1.5 text-xs font-medium border border-slate-200 rounded-xl px-3 py-1.5 hover:border-[#f3df27] hover:bg-[#fffdf0] transition-colors">
                  <IconUpload size={13} /> Attach
                </button>
              </div>
              {documentsLoading ? (
                <div className="flex justify-center py-10"><LoadingSpinner size="md" /></div>
              ) : !documents || documents.length === 0 ? (
                <p className="text-slate-400 text-center py-10 text-sm bg-slate-50 rounded-2xl border border-dashed border-slate-200">No documents attached yet.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {documents.map((d) => {
                    const Icon = DOC_TYPE_ICON[d.type] ?? IconFileText;
                    return (
                      <a key={d.id} href={d.fileUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2.5 bg-slate-50 border border-slate-100 rounded-xl px-3.5 py-2.5 hover:bg-slate-100/70 transition-colors">
                        <Icon size={18} className="text-[#122a20] shrink-0" />
                        <span className="flex-1 text-sm text-slate-800 truncate">{d.title}</span>
                        <span className="text-ms text-slate-400 font-mono">{fmtDate(d.createdAt)}</span>
                      </a>
                    );
                  })}
                </div>
              )}
            </Card>
          )}

          {activeTab === "activity" && (
            <Card className="bg-white border border-slate-100 rounded-[24px] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
              <h3 className="text-sm font-medium text-slate-900 mb-4">Activity Log</h3>
              {activityLoading ? (
                <div className="flex justify-center py-10"><LoadingSpinner size="md" /></div>
              ) : !activityLog || activityLog.length === 0 ? (
                <p className="text-slate-400 text-center py-10 text-sm bg-slate-50 rounded-2xl border border-dashed border-slate-200">No recorded activity yet.</p>
              ) : (
                <div className="space-y-0 pl-2">
                  {activityLog.map((entry, i) => (
                    <div key={entry.id} className="flex gap-4 relative py-3.5">
                      {i < activityLog.length - 1 && <div className="absolute left-[9px] top-[32px] bottom-0 w-0.5 bg-slate-100 rounded-full" />}
                      <div className="size-[18px] rounded-full border-[3px] border-slate-200 bg-white shrink-0 mt-0.5 z-10" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 leading-snug">{entry.summary}</p>
                        <p className="text-xs text-slate-400 mt-1 font-mono">{relativeTime(entry.createdAt)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}
        </div>

        {/* ── Rail ── */}
        <div className="flex flex-col gap-3.5">
          {/* Landlord card */}
          <Card className="bg-white border border-slate-100 rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
            {valuation.landlordName ? (
              <>
                <div className="relative h-[150px]">
                  {valuation.landlordAvatarUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={valuation.landlordAvatarUrl} alt={valuation.landlordName} className="absolute inset-0 w-full h-full object-cover" />
                  ) : (
                    <div className="absolute inset-0 bg-slate-100" />
                  )}
                  <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(21,25,54,0.3) 0%, rgba(21,25,54,0) 40%, rgba(21,25,54,0.5) 100%)" }} />
                  <div className="absolute top-3.5 left-0 right-0 text-center">
                    <p className="text-white text-base font-medium" style={{ textShadow: "0 2px 12px rgba(21,25,54,0.4)" }}>{valuation.landlordName}</p>
                    <p className="mt-0.5 inline-flex items-center gap-1.5 text-xs text-white/90">
                      {valuation.landlordVerifiedAt ? <><IconShieldCheck size={12} /> Verified landlord</> : <><IconShieldHalf size={12} /> Unverified - confirm before offer</>}
                    </p>
                  </div>
                </div>
                <div className="p-3.5 flex flex-col gap-1.5">
                  {valuation.landlordPhone && (
                    <div className="flex items-center justify-between"><span className="text-xs text-slate-500 flex items-center gap-1.5"><IconPhone size={12} /> Phone</span><span className="font-mono text-xs text-slate-900">{valuation.landlordPhone}</span></div>
                  )}
                  {valuation.landlordEmail && (
                    <div className="flex items-center justify-between"><span className="text-xs text-slate-500 flex items-center gap-1.5"><IconMail size={12} /> Email</span><span className="font-mono text-xs text-slate-900 truncate max-w-[140px]">{valuation.landlordEmail}</span></div>
                  )}
                  {valuation.landlordContactId && (
                    <Link href={`/admin/contacts/${valuation.landlordContactId}`} className="mt-1.5 text-xs text-center text-[#151936] flex items-center justify-center gap-1.5 bg-slate-50 border border-slate-100 rounded-xl py-2 hover:bg-slate-100 transition-colors">
                      <IconMessageCircle size={13} /> Landlord Profile
                    </Link>
                  )}
                </div>
              </>
            ) : (
              <div className="p-5 text-center text-desc-secondary">No landlord on record.</div>
            )}
          </Card>

          {/* Property Manager card */}
          <Card className="bg-white border border-slate-100 rounded-[24px] p-4 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
            <div className="flex items-center gap-2.5">
              <span className="size-11 rounded-full bg-[#151936] text-[#f3df27] flex items-center justify-center font-mono text-sm shrink-0">
                {valuation.managerName ? valuation.managerName.split(" ").map((w) => w[0]).slice(0, 2).join("") : "?"}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">{valuation.managerName ?? "Unassigned"}</p>
                <p className="label-caps text-slate-400">Property Manager</p>
              </div>
            </div>
          </Card>

          {/* Valuer card */}
          <Card className="bg-white border border-slate-100 rounded-[24px] p-4 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
            <p className="text-xs font-mono font-medium uppercase tracking-wider text-slate-500 mb-2.5">Valuer</p>
            <div className="flex items-center gap-2.5">
              <span className="size-9 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-[#122a20] shrink-0"><IconShieldHalf size={17} /></span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">{valuerDisplayName}</p>
                <p className="text-xs text-slate-400">{valuation.externalValuerName ? "Independent firm" : "Sunland Valuers Ltd - internal"}</p>
              </div>
            </div>
          </Card>

          {/* Convert preview */}
          {valuation.stage === "mandate_signed" && valuation.resultingMandateId ? (
            <button onClick={() => router.push(`/admin/mandates/${valuation.resultingMandateId}`)} className="bg-tertiary-gradient rounded-[24px] shadow-xl p-5 text-left hover:opacity-95 transition-opacity">
              <p className="text-xs text-white/60 mb-1">Converted to</p>
              <p className="mono-data text-lg text-white mb-3">Management Mandate</p>
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#f3df27]">
                Open Mandate File <IconArrowUpRight size={13} />
              </span>
            </button>
          ) : (
            <div className="bg-tertiary-gradient rounded-[24px] shadow-xl p-5">
              <p className="text-xs text-white/60 mb-1">If accepted, becomes</p>
              <p className="mono-data text-lg text-white mb-3">Management Mandate</p>
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between text-xs"><span className="text-white/60">Fee</span><span className="font-mono text-[#f3df27]">{valuation.proposedFeeRate ? `${(Number(valuation.proposedFeeRate) * 100).toFixed(1)}%` : "—"}</span></div>
                <div className="flex justify-between text-xs"><span className="text-white/60">Est. annual revenue</span><span className="font-mono text-white">{estAnnualRevenue ? formatCompactKES(estAnnualRevenue) : "—"}</span></div>
              </div>
            </div>
          )}
        </div>
      </div>

      <ValuationFormModal
        open={editModalOpen}
        entityId={entityId}
        mode="edit"
        valuation={editTarget}
        onClose={() => setEditModalOpen(false)}
        onSubmit={refresh}
      />

      <ValuationSubmitModal
        open={submitModalOpen}
        entityId={entityId}
        valuation={submitTarget}
        onClose={() => setSubmitModalOpen(false)}
        onSubmitted={refresh}
      />

      <ValuationDocumentModal
        open={docModalOpen}
        entityId={entityId}
        valuationId={valuation.id}
        valuationLabel={`${subjectName} (${valuation.valuationCode})`}
        onClose={() => setDocModalOpen(false)}
        onAttached={refresh}
      />

      <ConfirmDialog
        open={signConfirmOpen}
        onClose={() => setSignConfirmOpen(false)}
        onConfirm={handleSignMandate}
        title="Sign Management Mandate"
        description="This creates a real management mandate from this prospect - if it's an external subject, a new portfolio property is created too. This cannot be undone."
        confirmLabel="Sign Mandate"
        tone="info"
        isLoading={isSigning}
      />

      <ConfirmDialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleDelete}
        title="Delete Valuation"
        description="This permanently removes the prospect and its recorded values. The deletion itself stays on the audit trail."
        confirmLabel="Delete Valuation"
        tone="danger"
        isLoading={isDeleting}
      />

      <PropertyOwnerProfileDrawer
        open={!!ownerContactId}
        onClose={() => setOwnerContactId(null)}
        entityId={entityId || "group"}
        ownerContactId={ownerContactId}
        properties={properties}
        onOpenProperty={() => { }}
      />

      <PropertyManagerProfileDrawer
        open={!!managerUserId}
        onClose={() => setManagerUserId(null)}
        entityId={entityId || "group"}
        managerId={managerUserId}
        properties={properties}
        onOpenProperty={() => { }}
      />
    </div>
  );
}
