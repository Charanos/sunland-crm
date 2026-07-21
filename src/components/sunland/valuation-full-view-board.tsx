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
  IconMessageCircle,
  IconPhone,
  IconSend,
  IconShieldCheck,
  IconShieldHalf,
  IconTelescope,
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
        label: "Assessed Value",
        value: valuation.marketValueKes ? formatCompactKES(Number(valuation.marketValueKes)) : "—",
        sub: score ? `${score.grade} · ${score.label}` : "Not yet valued",
        icon: IconArrowUpRight,
        tone: scoreTone,
        hasBar: !!score,
        barRatio: score ? score.score / 100 : undefined
      },
      {
        label: "Proposed Fee",
        value: valuation.proposedFeeRate ? `${(Number(valuation.proposedFeeRate) * 100).toFixed(1)}%` : "—",
        sub: estAnnualRevenue ? `${formatCompactKES(estAnnualRevenue)}/yr est.` : "Set on submission",
        icon: IconFileCertificate,
        tone: valuation.proposedFeeRate ? "amber" : "neutral",
      },
      {
        label: "Valuer",
        value: valuerDisplayName,
        sub: valuation.externalValuerName ? "Independent firm" : "Sunland Valuers",
        icon: IconShieldHalf,
        tone: "neutral",
      },
      {
        label: "Site Visit",
        value: fmtDate(valuation.siteVisitAt),
        sub: valuation.completedAt ? `Valued ${fmtDate(valuation.completedAt)}` : "Pending",
        icon: IconCalendarEvent,
        tone: valuation.completedAt ? "emerald" : "neutral",
      },
    ];
  }, [valuation, score, estAnnualRevenue, valuerDisplayName]);

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

  const steps = STAGE_ORDER.map((s, i) => {
    const curIdx = STAGE_ORDER.indexOf(valuation.stage);
    const done = valuation.stage !== "declined" && i <= curIdx;
    return { key: s, label: STAGE_META[s].label, done, isLast: i === STAGE_ORDER.length - 1 };
  });

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
      {/* Sticky Command Header */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md py-4 border-b border-slate-100/80 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="flex flex-col gap-2.5">
          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
            <Link href="/admin/valuations" className="hover:text-slate-900 transition-colors flex items-center gap-1">
              <IconChevronLeft size={14} /> Valuations Board
            </Link>
            <span className="text-slate-300">/</span>
            <span className="text-slate-400 font-mono">{valuation.valuationCode}</span>
          </div>

          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3 flex-wrap min-w-0">
              <h1 className="title-serif text-slate-900 truncate text-2xl sm:text-3xl">{subjectName}</h1>
              <Badge tone={stageTone(valuation.stage)}>
                {cfg.label}
              </Badge>
            </div>

            {canManage && (
              <div className="flex items-center gap-2 shrink-0">
                {primary && (
                  <button
                    type="button"
                    onClick={primary.onClick}
                    className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium bg-[#151936] text-white hover:bg-[#1a1f42] shadow-[0_2px_10px_rgb(21,25,54,0.25)] transition-colors"
                  >
                    <primary.icon size={15} /> {primary.label}
                  </button>
                )}
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
                    <div className="absolute right-0 top-[44px] z-20 w-52 bg-white border border-slate-100 rounded-2xl shadow-xl p-1.5">
                      <button onClick={() => { setEditModalOpen(true); setMenuOpen(false); }} className="w-full text-left flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                        <IconUserCog size={15} className="text-slate-400" /> Edit prospect
                      </button>
                      {valuation.stage !== "mandate_signed" && valuation.stage !== "declined" && (
                        <button onClick={() => { transitionStage("declined"); setMenuOpen(false); }} className="w-full text-left flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-rose-600 hover:bg-rose-50">
                          <IconX size={15} /> Decline prospect
                        </button>
                      )}
                      <div className="h-px bg-slate-100 my-1" />
                      <button onClick={() => { setDeleteConfirmOpen(true); setMenuOpen(false); }} className="w-full text-left flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-rose-600 hover:bg-rose-50">
                        <IconX size={15} /> Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Image-led hero ── */}
      <div className="relative rounded-[28px] overflow-hidden min-h-[300px] lg:min-h-[340px] bg-[#1e2336] flex flex-col animate-fade-in-up">
        {heroImg ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={heroImg} alt={subjectName} className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#151936] via-[#1e2336] to-[#0c1f24]" />
        )}
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(12,15,32,0.38) 0%, rgba(12,15,32,0.08) 34%, rgba(10,13,28,0.55) 68%, rgba(8,10,22,0.9) 100%)" }} />

        <div className="relative z-10 flex items-start justify-between gap-3 p-6">
          <span className="inline-flex items-center gap-1.5 bg-[#f3df27] text-[#151936] rounded-lg px-3 py-1.5 text-xs font-medium shadow-md">
            <IconTelescope size={13} /> Acquisition Prospect
          </span>
          {!isPortfolio && (
            <span className="inline-flex items-center gap-1.5 bg-white/15 backdrop-blur-md border border-white/20 text-white rounded-lg px-3 py-1.5 text-xs font-medium">
              New Prospect
            </span>
          )}
        </div>

        {/* Floating assessed-value glass card */}
        <div className="hidden sm:block absolute top-[76px] right-6 w-[190px] bg-white/95 backdrop-blur-md rounded-2xl p-4 shadow-xl">
          <p className="label-caps text-slate-400 mb-1.5">Assessed Value</p>
          <p className="mono-amount text-2xl text-slate-900 leading-none">{valuation.marketValueKes ? formatCompactKES(Number(valuation.marketValueKes)) : "—"}</p>
          <div className="h-px bg-slate-100 my-2.5" />
          <div className="flex justify-between text-xs">
            <span className="text-slate-400">Proposed fee</span>
            <span className="font-mono text-[#122a20]">{valuation.proposedFeeRate ? `${(Number(valuation.proposedFeeRate) * 100).toFixed(1)}%` : "—"}</span>
          </div>
          <div className="flex justify-between text-xs mt-1">
            <span className="text-slate-400">Est. annual</span>
            <span className="font-mono text-slate-700">{estAnnualRevenue ? formatCompactKES(estAnnualRevenue) : "—"}</span>
          </div>
        </div>

        <div className="relative z-10 p-6 mt-auto flex flex-col gap-4">
          <div>
            <p className="font-mono text-xs text-white/60">{valuation.valuationCode} · {subjectLocation}</p>
            <p className="title-serif text-white text-3xl mt-0.5">{subjectName}</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {valuation.landlordName && (
              <button
                type="button"
                onClick={() => {
                  if (valuation.landlordContactId) setOwnerContactId(valuation.landlordContactId);
                }}
                className="bg-black/40 hover:bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-3xl flex items-center gap-2.5 border border-white/10 transition-colors"
              >
                {valuation.landlordAvatarUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={valuation.landlordAvatarUrl} alt="" className="size-7 rounded-full object-cover" />
                ) : (
                  <span className="size-7 rounded-full bg-slate-100 text-slate-800 text-xs font-medium flex items-center justify-center">{valuation.landlordName.slice(0, 1)}</span>
                )}
                <span className="text-left leading-none">
                  <span className="block text-sm font-medium text-white">{valuation.landlordName}</span>
                  <span className="block text-xs uppercase tracking-widest text-slate-300 mt-0.5">Prospective Landlord</span>
                </span>
              </button>
            )}
            {valuation.managerName && (
              <button
                type="button"
                onClick={() => {
                  if (valuation.assignedManagerId) setManagerUserId(valuation.assignedManagerId);
                }}
                className="bg-black/40 hover:bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-3xl flex items-center gap-2.5 border border-white/10 transition-colors text-left font-sans"
              >
                <span className="size-7 rounded-full bg-[#f3df27] text-[#151936] text-xs font-medium flex items-center justify-center">{valuation.managerName.split(" ").map((w) => w[0]).slice(0, 2).join("")}</span>
                <span className="text-left leading-none">
                  <span className="block text-sm font-medium text-white">{valuation.managerName}</span>
                  <span className="block text-xs uppercase tracking-widest text-slate-300 mt-0.5">Property Manager</span>
                </span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Stage stepper ── */}
      <div className="bg-white border border-slate-100 rounded-[20px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-5">
        <div className="flex items-center mb-2">
          {steps.map((s) => (
            <div key={s.key} className="flex items-center flex-1">
              <span className={cn("size-5 rounded-full flex items-center justify-center shrink-0", s.done ? "bg-[#122a20] text-white" : "bg-slate-200 text-transparent")}>
                {s.done && <IconCheck size={11} />}
              </span>
              {!s.isLast && <div className={cn("h-0.5 flex-1 mx-1", STAGE_ORDER.indexOf(valuation.stage) > STAGE_ORDER.indexOf(s.key) ? "bg-[#122a20]" : "bg-slate-200")} />}
            </div>
          ))}
        </div>
        <p className="text-sm font-medium text-[#122a20]">
          {valuation.stage === "declined" ? "Declined - prospect not proceeding" : `${cfg.label} · updated ${daysSince(valuation.stageEnteredAt)} days ago`}
        </p>
      </div>

      {/* ── Vitals ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {vitals.map((v) => (
          <div
            key={v.label}
            className={cn(
              "relative overflow-hidden rounded-2xl border p-5 flex flex-col justify-between group/vital shadow-sm hover:shadow-md hover:border-slate-300 transition-all duration-300 h-[140px]",
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
          <button type="button" onClick={() => transitionStage("offer_sent")} className="rounded-xl px-4 py-1.5 text-xs font-medium whitespace-nowrap bg-[#f3df27] text-[#151936] hover:bg-[#e6d220] shadow-sm">
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
                  "px-4 py-2 rounded-xl transition-all duration-300 flex items-center gap-2 shrink-0 whitespace-nowrap font-medium text-sm",
                  activeTab === t.key ? "bg-[#151936] text-white shadow-md" : "text-slate-500 hover:text-slate-900 hover:bg-slate-50",
                )}
              >
                <t.icon size={14} /> {t.label}
              </button>
            ))}
          </div>

          {activeTab === "overview" && (
            <>
              <Card className="bg-white border border-slate-100 rounded-[24px] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                <h3 className="title-serif text-slate-900 mb-4">Property Particulars</h3>
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
                <h3 className="title-serif text-slate-900 mb-3">Notes</h3>
                <p className="text-body-regular text-slate-600 whitespace-pre-line">{valuation.notes || "No notes recorded."}</p>
              </Card>
            </>
          )}

          {activeTab === "comparables" && (
            <Card className="bg-white border border-slate-100 rounded-[24px] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
              <h3 className="title-serif text-slate-900 mb-1">Comparable Evidence</h3>
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
              <h3 className="title-serif text-slate-900 mb-3">Methodology &amp; Assumptions</h3>
              <p className="text-body-regular text-slate-600 whitespace-pre-line leading-relaxed">{valuation.methodology || "Not yet recorded - captured when the valuation is submitted."}</p>
            </Card>
          )}

          {activeTab === "documents" && (
            <Card className="bg-white border border-slate-100 rounded-[24px] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
              <div className="flex items-center justify-between mb-4">
                <h3 className="title-serif text-slate-900">Documents</h3>
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
              <h3 className="title-serif text-slate-900 mb-4">Activity Log</h3>
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
                    <p className="title-serif text-white text-lg" style={{ textShadow: "0 2px 12px rgba(21,25,54,0.4)" }}>{valuation.landlordName}</p>
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
            <p className="title-serif text-slate-900 mb-2.5">Valuer</p>
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
