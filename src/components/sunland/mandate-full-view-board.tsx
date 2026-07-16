"use client";

import { useEffect, useMemo, useState, type ComponentType } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  IconAlertTriangle,
  IconArrowUpRight,
  IconBolt,
  IconBuildingCommunity,
  IconClock,
  IconDotsVertical,
  IconExternalLink,
  IconStarFilled,
  IconFileCertificate,
  IconFileText,
  IconHistory,
  IconLink,
  IconMapPin,
  IconMessageCircle,
  IconPhone,
  IconPhoto,
  IconReceipt2,
  IconShieldCheck,
  IconTrash,
  IconTrendingUp,
  IconUsers,
  IconWalletOff,
  IconChevronRight,
  IconQrcode,
} from "@tabler/icons-react";
import { LeaseFormModal, type LeaseEditTarget } from "./lease-form-modal";
import { LeaseRenewModal, type LeaseRenewTarget } from "./lease-renew-modal";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DropdownMenu, DropdownItem } from "@/components/ui/dropdown-menu";
import { useToast } from "@/components/ui/toast-provider";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { MandateLetterModal } from "./mandate-letter-modal";
import { MandateOverrideModal } from "./mandate-override-modal";
import { RemittanceAdvicePanel, type RemittanceAdvice } from "./remittance-advice-panel";
import { LeaseDetailDrawer } from "./lease-detail-drawer";
import { PropertyOwnerProfileDrawer } from "./property-owner-profile-drawer";
import { PropertyManagerProfileDrawer } from "./property-manager-profile-drawer";
import { PhotoLightbox } from "./photo-lightbox";
import { formatCompactKES } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import type { Property } from "./property-constants";
import type { LeaseSummary, PropertyDocumentSummary } from "./property-detail-types";

type TabKey = "overview" | "financials" | "units" | "documents" | "activity";
type ActionTone = "amber" | "rose" | "neutral";

interface ActionItem {
  key: string;
  tone: ActionTone;
  icon: ComponentType<{ size?: number; className?: string }>;
  title: string;
  meta: string;
  cta: string;
  primary: boolean;
  onClick: () => void;
}

const ACTION_TONE_CLASSES: Record<ActionTone, { div: string; iconWrap: string; cta: string }> = {
  amber: {
    div: "border-amber-200 bg-amber-500/[0.04] rounded-2xl p-4 flex items-center justify-between gap-4 border shadow-sm transition-all duration-300 hover:shadow-md",
    iconWrap: "bg-amber-100/80 text-amber-700 size-9 rounded-xl flex items-center justify-center shrink-0 shadow-xs",
    cta: "bg-[#f3df27] text-[#151936] font-medium text-xs rounded-xl px-4 py-1.5 hover:bg-[#e6d220] transition-colors shadow-sm whitespace-nowrap",
  },
  rose: {
    div: "border-rose-100 bg-rose-500/[0.02] rounded-2xl p-4 flex items-center justify-between gap-4 border shadow-sm transition-all duration-300 hover:shadow-md",
    iconWrap: "bg-rose-100/80 text-rose-600 size-9 rounded-xl flex items-center justify-center shrink-0 shadow-xs",
    cta: "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-medium text-xs rounded-xl px-4 py-1.5 transition-colors shadow-xs whitespace-nowrap",
  },
  neutral: {
    div: "border-slate-200/80 bg-slate-50/50 rounded-2xl p-4 flex items-center justify-between gap-4 border shadow-sm transition-all duration-300 hover:shadow-md",
    iconWrap: "bg-slate-100 text-slate-500 size-9 rounded-xl flex items-center justify-center shrink-0 shadow-xs",
    cta: "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-medium text-xs rounded-xl px-4 py-1.5 transition-colors shadow-xs whitespace-nowrap",
  },
};



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
const scrollHiddenStyle: React.CSSProperties = { scrollbarWidth: "none", msOverflowStyle: "none" };

const MANDATE_STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  pending_approval: "Pending Approval",
  active: "Active",
  terminated: "Terminated",
};

interface MandateDetail {
  id: string;
  entityId: string;
  status: "draft" | "pending_approval" | "active" | "terminated";
  mandateRate: number;
  rateJustification: string | null;
  unitCount: number;
  startDate: string;
  endDate: string | null;
  pendingApproverRole: "gm" | "ceo" | "department_head" | null;
  approvalRequestId: string | null;
  currentPeriod?: { collectedAmount: number; managementFee: number; expenses: number; landlordRemittance: number };
  pendingRemittance: RemittanceAdvice | null;
  landlord: { id: string; name: string; email: string | null; phone: string | null; verifiedAt: string | null; avatarUrl?: string | null; company?: string | null };
  manager: { id: string; name: string | null; title: string | null; email: string | null; avatarUrl: string | null } | null;
  property: { id: string; name: string; propertyCode: string; propertyType: string; location: string; media: Array<{ url: string; alt?: string }> };
  leases: LeaseSummary[];
  documents: PropertyDocumentSummary[];
  collections: Array<{ period: string; expected: number; collected: number }>;
  arrears: { status: "current" | "partial" | "defaulted"; amount: number; daysInArrears: number } | null;
}

interface AuditEntry {
  id: string;
  summary: string;
  createdAt: string;
  actorName?: string | null;
}

function activityTone(action: string): string {
  const lower = action.toLowerCase();
  if (lower.includes("terminat") || lower.includes("reject") || lower.includes("flag")) return "bg-rose-300";
  if (lower.includes("override")) return "bg-amber-400";
  return "bg-slate-300";
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

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function MandateFullViewBoard({
  entityId,
  mandateId,
  canManage = true,
}: {
  entityId: string | null;
  mandateId: string;
  canManage?: boolean;
}) {
  const router = useRouter();
  const { pushToast } = useToast();

  const [mandate, setMandate] = useState<MandateDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshCount, setRefreshCount] = useState(0);
  const [viewerRole, setViewerRole] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [drawerLease, setDrawerLease] = useState<LeaseSummary | null>(null);
  const [mandateLetterOpen, setMandateLetterOpen] = useState(false);
  const [overrideModalOpen, setOverrideModalOpen] = useState(false);
  const [terminateOpen, setTerminateOpen] = useState(false);
  const [terminateNotes, setTerminateNotes] = useState("");
  const [terminateNotesErr, setTerminateNotesErr] = useState(false);
  const [isTerminating, setIsTerminating] = useState(false);
  const [remittancePanelOpen, setRemittancePanelOpen] = useState(false);
  const [selectedRemittance, setSelectedRemittance] = useState<RemittanceAdvice | null>(null);
  const [remittances, setRemittances] = useState<RemittanceAdvice[]>([]);
  const [remittancesLoaded, setRemittancesLoaded] = useState(false);
  const [generatingRemittance, setGeneratingRemittance] = useState(false);
  const [ownerDrawerOpen, setOwnerDrawerOpen] = useState(false);
  const [managerDrawerOpen, setManagerDrawerOpen] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);

  const termMonths = useMemo(() => {
    if (!mandate || !mandate.endDate) return "Open-ended";
    const start = new Date(mandate.startDate);
    const end = new Date(mandate.endDate);
    const diff = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
    return `${diff} months`;
  }, [mandate]);

  const [activityLog, setActivityLog] = useState<AuditEntry[] | null>(null);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityLoaded, setActivityLoaded] = useState(false);

  const [leaseModalOpen, setLeaseModalOpen] = useState(false);
  const [editingLease, setEditingLease] = useState<LeaseSummary | null>(null);
  const [renewingLease, setRenewingLease] = useState<LeaseSummary | null>(null);

  const occupiedCount = useMemo(() => mandate?.leases.filter((l) => l.isActive).length ?? 0, [mandate?.leases]);
  const vacantCount = useMemo(() => Math.max(0, (mandate?.unitCount ?? 0) - occupiedCount), [mandate?.unitCount, occupiedCount]);

  const unitsList = useMemo(() => {
    if (!mandate) return [];
    const list: { unitCode: string; lease: LeaseSummary | null }[] = [];
    const unitCount = mandate.unitCount || 12;
    for (let i = 0; i < unitCount; i++) {
      const floorIndex = Math.floor(i / 4);
      const unitIndex = (i % 4) + 1;
      const floorLetter = String.fromCharCode(65 + floorIndex);
      const unitCode = `${floorLetter}${unitIndex}`;
      const lease = mandate.leases[i] || null;
      list.push({ unitCode, lease });
    }
    return list;
  }, [mandate]);

  useEffect(() => {
    let active = true;
    const fetchMandate = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/mandates/${mandateId}?entityId=${entityId || ""}`);
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        const data = await res.json();
        if (!active) return;
        if (data.mandate) setMandate(data.mandate);
        else setError("This mandate couldn't be found.");
      } catch (err) {
        if (!active) return;
        console.error("Failed to load mandate:", err);
        setError("Couldn't load this mandate. Check your connection and try again.");
      } finally {
        if (active) setIsLoading(false);
      }
    };
    fetchMandate();
    return () => {
      active = false;
    };
  }, [mandateId, entityId, refreshCount]);

  useEffect(() => {
    let active = true;
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active && data?.user?.role) setViewerRole(data.user.role);
      })
      .catch(() => { });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (activeTab !== "activity" || activityLoaded) return;
    let active = true;
    const timeoutId = setTimeout(() => {
      setActivityLoading(true);
      fetch(`/api/mandates/${mandateId}/activity?entityId=${entityId || ""}`)
        .then((res) => (res.ok ? res.json() : { entries: [] }))
        .then((data) => {
          if (!active) return;
          setActivityLog(data.entries ?? []);
        })
        .catch(() => {
          if (active) setActivityLog([]);
        })
        .finally(() => {
          if (active) {
            setActivityLoading(false);
            setActivityLoaded(true);
          }
        });
    }, 0);
    return () => {
      active = false;
      clearTimeout(timeoutId);
    };
  }, [activeTab, activityLoaded, mandateId, entityId]);

  const loadRemittances = () => {
    fetch(`/api/mandates/${mandateId}/remittances?entityId=${entityId || ""}`)
      .then((res) => (res.ok ? res.json() : { remittances: [] }))
      .then((data) => {
        setRemittances(data.remittances ?? []);
        setRemittancesLoaded(true);
      })
      .catch(() => setRemittancesLoaded(true));
  };

  useEffect(() => {
    if (activeTab !== "financials" || remittancesLoaded) return;
    loadRemittances();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, remittancesLoaded]);

  const canDecideMandate = !!(
    mandate?.status === "pending_approval" &&
    mandate.approvalRequestId &&
    viewerRole &&
    ((mandate.pendingApproverRole === "gm" && viewerRole === "general_manager") ||
      (mandate.pendingApproverRole === "ceo" && viewerRole === "ceo"))
  );
  const canOverrideMandate = !!(
    mandate?.status === "pending_approval" &&
    mandate.approvalRequestId &&
    mandate.pendingApproverRole === "gm" &&
    viewerRole === "ceo"
  );

  const actionItems: ActionItem[] = useMemo(() => {
    if (!mandate) return [];
    const items: ActionItem[] = [];
    if (mandate.status === "pending_approval" && mandate.approvalRequestId) {
      items.push({
        key: "decision",
        tone: "amber",
        icon: IconFileCertificate,
        title: canDecideMandate ? "Mandate awaiting your approval" : `Mandate pending at the ${(mandate.pendingApproverRole ?? "gm").toUpperCase()} step`,
        meta: `${(mandate.mandateRate * 100).toFixed(0)}% rate${mandate.manager?.name ? ` · ${mandate.manager.name}` : ""}`,
        cta: canDecideMandate ? "Review" : canOverrideMandate ? "Decide Directly" : "View",
        primary: canDecideMandate,
        onClick: () => {
          if (canOverrideMandate) setOverrideModalOpen(true);
          else router.push("/admin/approvals");
        },
      });
    }
    if (mandate.pendingRemittance) {
      items.push({
        key: "remittance",
        tone: "amber",
        icon: IconWalletOff,
        title: "Remittance pending release",
        meta: formatCompactKES(Number(mandate.pendingRemittance.netRemittanceKes)),
        cta: "Review",
        primary: false,
        onClick: () => { setSelectedRemittance(mandate.pendingRemittance); setRemittancePanelOpen(true); },
      });
    }
    if (mandate.arrears && (mandate.arrears.status === "partial" || mandate.arrears.status === "defaulted")) {
      items.push({
        key: "arrears",
        tone: "rose",
        icon: IconAlertTriangle,
        title: `${formatCompactKES(mandate.arrears.amount)} in arrears`,
        meta: `${mandate.arrears.daysInArrears} days`,
        cta: "Follow up",
        primary: false,
        onClick: () => setActiveTab("units"),
      });
    }
    const hasMandateLetter = (mandate.documents ?? []).some((d) => d.type === "mandate_letter");
    if (!hasMandateLetter) {
      items.push({
        key: "letter",
        tone: "neutral",
        icon: IconFileText,
        title: "Mandate letter not attached",
        meta: "Required on file before first remittance",
        cta: "Attach",
        primary: false,
        onClick: () => setMandateLetterOpen(true),
      });
    }
    return items;
  }, [mandate, canDecideMandate, canOverrideMandate, router]);

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error && !mandate) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
        <IconAlertTriangle size={32} className="text-rose-400" aria-hidden="true" />
        <p className="text-title-primary">{error}</p>
        <Button variant="secondary" onClick={() => setRefreshCount((c) => c + 1)}>
          Retry
        </Button>
      </div>
    );
  }

  if (!mandate) {
    return <div className="p-8 text-center text-desc-secondary">Mandate not found.</div>;
  }

  const mediaList = mandate.property.media || [];
  const primaryImage = mediaList[activeMediaIndex]?.url ?? mediaList[0]?.url;
  const period = mandate.currentPeriod;
  const remittanceDue = mandate.pendingRemittance ? Number(mandate.pendingRemittance.netRemittanceKes) : period?.landlordRemittance ?? 0;

  const lastCollection = mandate.collections?.[mandate.collections.length - 1];
  const expectedAmount = lastCollection?.expected ?? 0;
  const collectedAmount = period?.collectedAmount ?? 0;
  const collectionPct = expectedAmount > 0 ? Math.round((collectedAmount / expectedAmount) * 100) : 0;

  const occupiedUnits = mandate.leases.filter((l) => l.isActive).length;

  const vitals = [
    {
      label: "Management Fee",
      value: `${(mandate.mandateRate * 100).toFixed(1)}%`,
      subText: "of collected rent",
      badgeText: mandate.mandateRate <= 0.12 ? "STANDARD" : "CUSTOM",
      badgeTone: "neutral" as VitalTone,
      tone: "neutral" as VitalTone,
      icon: IconReceipt2,
      tab: "financials" as TabKey,
    },
    {
      label: "Expected Rent Roll",
      value: formatCompactKES(expectedAmount),
      subText: "billed this period",
      badgeText: `${mandate.unitCount} UNITS`,
      badgeTone: "neutral" as VitalTone,
      tone: "neutral" as VitalTone,
      icon: IconBuildingCommunity,
      tab: "units" as TabKey,
    },
    {
      label: "Units Occupied",
      value: `${occupiedUnits}/${mandate.unitCount}`,
      subText: mandate.unitCount - occupiedUnits > 0 ? `${mandate.unitCount - occupiedUnits} vacant` : "fully occupied",
      badgeText: occupiedUnits === mandate.unitCount ? "100% OCCUPIED" : `${Math.round((occupiedUnits / (mandate.unitCount || 1)) * 100)}%`,
      badgeTone: occupiedUnits === mandate.unitCount ? "emerald" as VitalTone : "amber" as VitalTone,
      tone: occupiedUnits === mandate.unitCount ? "emerald" as VitalTone : "amber" as VitalTone,
      icon: IconUsers,
      tab: "units" as TabKey,
    },
    {
      label: "Remittance Due",
      value: formatCompactKES(remittanceDue),
      subText: mandate.pendingRemittance ? "pending release" : "released",
      badgeText: mandate.pendingRemittance ? "ACTION NEEDED" : "CLEARED",
      badgeTone: mandate.pendingRemittance ? "rose" as VitalTone : "neutral" as VitalTone,
      tone: mandate.pendingRemittance ? "rose" as VitalTone : "neutral" as VitalTone,
      icon: IconArrowUpRight,
      tab: "financials" as TabKey,
    },
  ];

  const singlePropertyList: Property[] = [
    {
      id: mandate.property.id,
      entityId: mandate.entityId,
      propertyCode: mandate.property.propertyCode,
      name: mandate.property.name,
      propertyType: mandate.property.propertyType,
      listingType: "rent",
      status: "occupied",
      location: mandate.property.location,
      ownerContactId: mandate.landlord.id,
      owner: { name: mandate.landlord.name, phone: mandate.landlord.phone, email: mandate.landlord.email, verifiedAt: mandate.landlord.verifiedAt, company: null, idNumber: null, clientSince: null, avatarUrl: null },
      ownerName: mandate.landlord.name,
      manager: mandate.manager ? { id: mandate.manager.id, name: mandate.manager.name, title: mandate.manager.title, email: mandate.manager.email, avatarUrl: mandate.manager.avatarUrl } : null,
      mandateStatus: mandate.status,
      media: mandate.property.media,
      isFeatured: false,
      createdAt: mandate.startDate,
      updatedAt: mandate.startDate,
    } as unknown as Property,
  ];

  const handleTerminate = async () => {
    if (!terminateNotes.trim()) {
      setTerminateNotesErr(true);
      return;
    }
    setIsTerminating(true);
    try {
      const res = await fetch(`/api/mandates/${mandate.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "terminate", entityId, reason: terminateNotes.trim() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Failed to terminate mandate");
      }
      pushToast({ tone: "success", title: "Mandate terminated" });
      setTerminateOpen(false);
      setTerminateNotes("");
      setRefreshCount((c) => c + 1);
    } catch (err) {
      pushToast({ tone: "warning", title: "Error", body: err instanceof Error ? err.message : "Failed to terminate mandate" });
    } finally {
      setIsTerminating(false);
    }
  };

  const handleGenerateRemittance = async () => {
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const periodEnd = now.toISOString();
    setGeneratingRemittance(true);
    try {
      const res = await fetch(`/api/mandates/${mandate.id}/remittances`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityId, periodStart, periodEnd }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Failed to generate remittance advice");
      pushToast({ tone: "success", title: "Remittance advice generated" });
      loadRemittances();
      setRefreshCount((c) => c + 1);
    } catch (err) {
      pushToast({ tone: "warning", title: "Error", body: err instanceof Error ? err.message : "Could not generate remittance advice." });
    } finally {
      setGeneratingRemittance(false);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    pushToast({ tone: "success", title: "Link copied" });
  };

  const tabs: { key: TabKey; label: string; icon: ComponentType<{ size?: number; className?: string }> }[] = [
    { key: "overview", label: "Overview", icon: IconFileCertificate },
    { key: "financials", label: "Financials", icon: IconReceipt2 },
    { key: "units", label: "Units & Tenants", icon: IconBuildingCommunity },
    { key: "documents", label: "Documents", icon: IconFileText },
    { key: "activity", label: "Activity", icon: IconHistory },
  ];

  const currentMonthName = new Date().toLocaleDateString("en-US", { month: "short" });

  return (
    <div className="mx-auto flex max-w-[98rem] flex-col gap-6 pb-12">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 px-1 mt-2 animate-fade-in-up">
        <div className="flex flex-col gap-2 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="title-serif text-slate-900 truncate">
              {mandate.property.name}
            </h1>
          </div>
          <div className="flex items-center gap-3 text-slate-500 text-sm min-w-0 font-medium">
            <span className="flex items-center gap-1.5 min-w-0">
              <IconMapPin size={15} className="shrink-0 text-slate-600" aria-hidden="true" />
              <span className="truncate">{mandate.property.location}</span>
            </span>
            <span className="text-slate-200 shrink-0">|</span>
            <span className="mono-data text-slate-500 shrink-0">MANDATE {mandate.id.slice(0, 8).toUpperCase()}</span>
          </div>
        </div>

        {/* CTA Actions aligned to the right */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap mt-1 sm:mt-0">
          <button
            type="button"
            onClick={handleGenerateRemittance}
            disabled={generatingRemittance}
            className="bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 border border-slate-200/80 font-medium text-sm rounded-full px-4 py-2 shadow-xs transition-colors flex items-center gap-1.5"
          >
            <IconReceipt2 size={14} /> Remittance Advice
          </button>
          {mandate.pendingRemittance && (
            <button
              type="button"
              onClick={() => {
                setSelectedRemittance(mandate.pendingRemittance);
                setRemittancePanelOpen(true);
              }}
              className="bg-[#151936] text-white hover:bg-[#1a1f42] font-medium text-sm rounded-full px-4 py-2 shadow-[0_2px_10px_rgb(21,25,54,0.3)] transition-all flex items-center gap-1.5"
            >
              <IconExternalLink size={14} /> Release Payment
            </button>
          )}
          {canManage && canOverrideMandate && (
            <button
              type="button"
              onClick={() => setOverrideModalOpen(true)}
              className="bg-[#f3df27] text-[#151936] hover:bg-[#e6d220] font-medium text-sm rounded-full px-4 py-2 shadow-[0_2px_10px_rgb(243,223,39,0.3)] transition-all hover:shadow-[0_4px_14px_rgb(243,223,39,0.4)] flex items-center gap-1.5 border border-amber-300/40"
            >
              <IconBolt size={14} /> Decide Directly
            </button>
          )}
          {canManage && (
            <DropdownMenu
              label="More actions"
              align="right"
              trigger={
                <div className="inline-flex size-[38px] items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-xs cursor-pointer">
                  <IconDotsVertical size={16} />
                </div>
              }
            >
              <DropdownItem icon={IconLink} onClick={handleCopyLink}>Copy deep link</DropdownItem>
              {(mandate.status === "active" || mandate.status === "pending_approval") && (
                <DropdownItem icon={IconTrash} variant="danger" onClick={() => setTerminateOpen(true)}>Terminate mandate</DropdownItem>
              )}
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* ── Flagship Mandate Hero ── */}
      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={() => {
            if (mediaList.length > 0) {
              setLightboxIndex(activeMediaIndex);
              setLightboxOpen(true);
            }
          }}
          disabled={mediaList.length === 0}
          aria-label="Open photo gallery"
          className="group relative rounded-[28px] overflow-hidden min-h-[300px] lg:min-h-[340px] shadow-[0_8px_30px_rgb(0,0,0,0.06)] bg-[#1e2336] text-white flex flex-col justify-between p-6 lg:p-8 mt-2 border border-slate-800 transition-all duration-500 hover:shadow-[0_20px_40px_rgb(0,0,0,0.12)] text-left w-full cursor-pointer disabled:cursor-default"
        >
          {primaryImage ? (
            <Image
              src={primaryImage}
              alt={mandate.property.name}
              fill
              sizes="(max-width: 1024px) 100vw, 80vw"
              className="object-cover absolute inset-0 transition-transform duration-700 group-hover:scale-103"
              priority
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-slate-900 to-[#1e2336]" />
          )}
          {/* Scrim */}
          <div
            className="absolute inset-0 z-0"
            style={{ background: "linear-gradient(180deg, rgba(12,15,32,0.38) 0%, rgba(12,15,32,0.08) 34%, rgba(10,13,28,0.55) 68%, rgba(8,10,22,0.9) 100%)" }}
            aria-hidden="true"
          />

          {/* Elegant Hover Overlay */}
          {mediaList.length > 0 && (
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-500 flex items-center justify-center z-0">
              <span className="opacity-0 group-hover:opacity-100 transition-all duration-500 transform translate-y-4 group-hover:translate-y-0 bg-white/95 backdrop-blur-md text-[#151936] font-medium px-5 py-2.5 rounded-full shadow-lg flex items-center gap-2 text-xs border border-white/20 uppercase tracking-wider">
                <IconPhoto size={14} aria-hidden="true" /> View {mediaList.length} photos
              </span>
            </div>
          )}

          {/* Top Overlays */}
          <div className="relative z-10 flex justify-between items-start w-full gap-4">
            <span className="bg-[#f3df27] text-[#151936] px-3 py-1.5 text-xs rounded-md text-xs font-medium tracking-wider flex items-center gap-1.5 shadow-sm shrink-0 uppercase">
              <IconStarFilled size={14} /> FLAGSHIP MANDATE
            </span>
            <div className="flex flex-col items-end gap-2.5 shrink-0" onClick={(e) => e.stopPropagation()}>
              <span className="bg-white/10 font-mono backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-full text-[10px] font-medium uppercase tracking-wider whitespace-nowrap">
                {MANDATE_STATUS_LABEL[mandate.status].toUpperCase()} · {(mandate.mandateRate * 100).toFixed(1)}% FEE
              </span>
              <div className="hidden sm:flex w-[168px] bg-white/95 backdrop-blur-md rounded-[18px] p-3.5 shadow-xl items-center gap-3 border border-white/60 text-slate-900">
                <div className="relative size-11 flex items-center justify-center shrink-0">
                  <svg className="size-full -rotate-90">
                    <circle cx="22" cy="22" r="18" fill="transparent" stroke="#f1f5f9" strokeWidth="5" />
                    <circle
                      cx="22"
                      cy="22"
                      r="18"
                      fill="transparent"
                      stroke="#151936"
                      strokeWidth="5"
                      strokeDasharray={2 * Math.PI * 18}
                      strokeDashoffset={(2 * Math.PI * 18) - (collectionPct / 100) * (2 * Math.PI * 18)}
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-600">Collection</p>
                  <p className="text-lg font-medium text-slate-900 mt-0.5 font-mono leading-none">{collectionPct}%</p>
                  <p className="text-xs text-slate-600">of {currentMonthName} rent</p>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Overlays */}
          <div className="relative z-10 flex flex-col gap-4 w-full mt-auto">
            {/* Landlord & Property Manager Avatar Pills */}
            <div className="flex flex-wrap gap-2.5" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => setOwnerDrawerOpen(true)}
                className="bg-black/40 hover:bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-3xl flex items-center gap-2.5 border border-white/10 transition-colors cursor-pointer text-left focus:outline-hidden"
              >
                <Avatar
                  src={mandate.landlord.avatarUrl || undefined}
                  fallback={getInitials(mandate.landlord.name)}
                  className="size-7 bg-slate-100 text-slate-800 text-xs font-medium"
                />
                <div className="text-left leading-none">
                  <p className="text-sm font-medium text-white">{mandate.landlord.name}</p>
                  <span className="text-[9px] uppercase tracking-widest text-slate-300 block">Landlord</span>
                </div>
              </button>
              {mandate.manager && (
                <button
                  type="button"
                  onClick={() => setManagerDrawerOpen(true)}
                  className="bg-black/40 hover:bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-3xl flex items-center gap-2.5 border border-white/10 transition-colors cursor-pointer text-left focus:outline-hidden"
                >
                  <Avatar
                    src={mandate.manager.avatarUrl || undefined}
                    fallback={getInitials(mandate.manager.name || "Unassigned")}
                    className="size-7 bg-[#f3df27] text-[#151936] text-xs font-medium"
                  />
                  <div className="text-left leading-none">
                    <p className="text-sm font-medium text-white">{mandate.manager.name}</p>
                    <span className="text-[9px] uppercase tracking-widest text-slate-300 block">Property Manager</span>
                  </div>
                </button>
              )}
            </div>

            {/* Collection Slider Progress Bar */}
            <div className="w-full mt-2 pr-8 lg:pr-12" onClick={(e) => e.stopPropagation()}>
              <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden mb-2">
                <div
                  className={cn("h-full rounded-full transition-all duration-500", collectionPct >= 90 ? "bg-emerald-400" : collectionPct >= 70 ? "bg-[#f3df27]" : "bg-rose-400")}
                  style={{ width: `${Math.min(100, collectionPct)}%` }}
                />
              </div>
              <div className="flex justify-between items-center text-xs font-medium text-slate-300">
                <span className="font-mono text-white tracking-tight">{formatCompactKES(collectedAmount)} collected</span>
                <span>of <span className="font-mono text-slate-300">{formatCompactKES(expectedAmount)}</span> expected</span>
              </div>
            </div>

            {/* Remittance Due Text & View Property Button */}
            <div className="mt-2 pt-4 border-t border-white/10 flex items-center justify-between gap-4 w-full" onClick={(e) => e.stopPropagation()}>
              <div>
                <p className="text-xs font-medium uppercase tracking-widest text-slate-300">
                  Remittance due to landlord
                </p>
                <p className="mono-stat text-2xl font-medium tracking-tight text-white mt-0.5">
                  {formatCompactKES(remittanceDue)}
                </p>
              </div>

              <Link
                href={`/admin/properties/${mandate.property.id}`}
                className="bg-white/10 hover:bg-white/20 text-white border border-white/20 font-medium text-xs rounded-xl px-4 py-2 transition-all flex items-center gap-1.5 backdrop-blur-md shadow-sm shrink-0"
              >
                View Property <IconArrowUpRight size={13} />
              </Link>
            </div>
          </div>
        </button>

        {/* Thumbnail slider */}
        {mediaList.length > 1 && (
          <div className="flex gap-2.5 overflow-x-auto pb-1 -mt-1" style={scrollHiddenStyle}>
            {mediaList.map((media, index) => (
              <button
                key={index}
                type="button"
                onClick={() => setActiveMediaIndex(index)}
                className={cn(
                  "relative size-[64px] rounded-xl overflow-hidden border-2 shrink-0 transition-all duration-300",
                  activeMediaIndex === index ? "border-slate-800 scale-95 shadow-sm" : "border-slate-200/60 opacity-70 hover:opacity-100 hover:scale-95"
                )}
              >
                <Image src={media.url} alt={media.alt || `Property photo ${index + 1}`} fill sizes="64px" className="object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── KPI Vitals divs Row ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4 mt-2">
        {vitals.map((v) => (
          <button
            key={v.label}
            type="button"
            onClick={() => setActiveTab(v.tab)}
            className={cn(
              "relative overflow-hidden rounded-2xl border p-5 flex flex-col justify-between group shadow-sm hover:shadow-md hover:border-slate-300 transition-all duration-300 h-[150px] text-left cursor-pointer focus:outline-hidden",
              VITAL_TONE_BG[v.tone]
            )}
          >
            <v.icon
              size={140}
              stroke={1}
              className={cn(
                "absolute -right-6 -bottom-6 opacity-[0.03] group-hover:scale-110 group-hover:opacity-[0.05] transition-all duration-500 pointer-events-none",
                VITAL_TONE_ARTWORK[v.tone]
              )}
              aria-hidden="true"
            />
            <div className="flex items-start justify-between relative z-10">
              <div className="flex flex-col gap-1 max-w-[calc(100%-48px)]">
                <span className="text-desc-secondary font-medium">{v.label}</span>
                <span className={cn("mono-stat text-2xl font-medium mt-1 leading-none", VITAL_TONE_VALUE[v.tone])}>
                  {v.value}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between mt-auto relative z-10">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "mono-data text-xs flex font-medium items-center px-1.5 py-0.5 rounded-md",
                    VITAL_TONE_BADGE_BG[v.badgeTone]
                  )}
                >
                  {v.badgeTone === "emerald" && <IconTrendingUp size={11} className="mr-0.5" />}
                  {v.badgeText}
                </span>
                <span className="text-meta-muted text-xs font-medium">{v.subText}</span>
              </div>
              <IconArrowUpRight
                size={14}
                className="text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity"
              />
            </div>
          </button>
        ))}
      </div>

      {/* ── Action-required band ── */}
      {actionItems.length > 0 && (
        <div className={cn("grid gap-3.5 animate-fade-in-up stagger-3 mt-1", actionItems.length > 1 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1")}>
          {actionItems.map((item) => {
            const t = ACTION_TONE_CLASSES[item.tone];
            return (
              <div key={item.key} className={t.div}>
                <div className="flex items-start gap-3 min-w-0">
                  <span className={t.iconWrap}>
                    <item.icon size={18} />
                  </span>
                  <div className="min-w-0">
                    <p className="font-sans text-sm font-medium text-slate-950 truncate leading-snug">{item.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5 truncate font-medium">{item.meta}</p>
                  </div>
                </div>
                <button type="button" onClick={item.onClick} className={t.cta}>
                  {item.cta}
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="h-px bg-slate-200/60 my-2 lg:my-4" />

      {/* ── Main: tabbed content + context rail ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 lg:gap-3.5 items-start">
        <div className="flex flex-col min-w-0">
          <div role="tablist" aria-label="Mandate sections" className="flex bg-white border border-slate-100 p-1.5 rounded-[16px] shadow-[0_2px_10px_rgb(0,0,0,0.02)] gap-1 overflow-x-auto flex-nowrap mb-6">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                role="tab"
                aria-selected={activeTab === tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "body-sm px-4 py-2 rounded-xl transition-all duration-300 flex items-center gap-2 shrink-0 whitespace-nowrap font-medium",
                  activeTab === tab.key ? "bg-[#151936] text-white shadow-md" : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                )}
              >
                <tab.icon size={15} aria-hidden="true" />
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === "overview" && (
            <div className="flex flex-col gap-4">
              {/* div 1: Mandate terms */}
              <div className="bg-white border border-slate-100 rounded-[24px] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                <h3 className="text-title-primary mb-5">Mandate terms</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="flex flex-col gap-1.5 p-4 rounded-xl bg-slate-50/50 border border-slate-100">
                    <p className="label-caps text-slate-600">Landlord</p>
                    <p className="body-md text-slate-800 font-medium truncate" title={mandate.landlord.name}>{mandate.landlord.name}</p>
                  </div>
                  <div className="flex flex-col gap-1.5 p-4 rounded-xl bg-slate-50/50 border border-slate-100">
                    <p className="label-caps text-slate-600">Started</p>
                    <p className="mono-amount text-slate-900">
                      {new Date(mandate.startDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1.5 p-4 rounded-xl bg-slate-50/50 border border-slate-100">
                    <p className="label-caps text-slate-600">Fee Rate</p>
                    <p className="mono-amount text-slate-900">{(mandate.mandateRate * 100).toFixed(1)}%</p>
                  </div>
                  <div className="flex flex-col gap-1.5 p-4 rounded-xl bg-slate-50/50 border border-slate-100">
                    <p className="label-caps text-slate-600">Units</p>
                    <p className="mono-amount text-slate-900">{mandate.unitCount}</p>
                  </div>
                  <div className="flex flex-col gap-1.5 p-4 rounded-xl bg-slate-50/50 border border-slate-100">
                    <p className="label-caps text-slate-600">Maintenance Authority</p>
                    <p className="mono-amount text-slate-900">≤ KES 100K</p>
                  </div>
                  <div className="flex flex-col gap-1.5 p-4 rounded-xl bg-slate-50/50 border border-slate-100">
                    <p className="label-caps text-slate-600">Term</p>
                    <p className="mono-amount text-slate-900">{termMonths}</p>
                  </div>
                  <div className="flex flex-col gap-1.5 p-4 rounded-xl bg-slate-50/50 border border-slate-100">
                    <p className="label-caps text-slate-600">Renewal</p>
                    <p className="body-md text-slate-800 font-medium">Automatic</p>
                  </div>
                  <div className="flex flex-col gap-1.5 p-4 rounded-xl bg-slate-50/50 border border-slate-100">
                    <p className="label-caps text-slate-600">Notice Period</p>
                    <p className="mono-amount text-slate-900">90 days</p>
                  </div>
                </div>
                {mandate.rateJustification && (
                  <p className="body-sm text-slate-500 mt-5 pt-5 border-t border-slate-100">
                    <span className="font-medium text-slate-700">Rate justification: </span>{mandate.rateJustification}
                  </p>
                )}
              </div>

              {/* div 2: Scope of management */}
              <div className="bg-white border border-slate-100 rounded-[24px] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                <h3 className="text-title-primary mb-3">Scope of management</h3>
                <p className="body-md text-slate-600 leading-relaxed">
                  Sunland collects rent across all {mandate.unitCount} units, remits net proceeds monthly to the landlord, and holds authority to approve maintenance spend up to KES 100K per incident. Twelve-unit apartment block off Dennis Pritt Road, Kilimani: eight 2-bedroom and four 3-bedroom units, borehole backup, solar water heating, gated parking.
                </p>
              </div>
            </div>
          )}

          {activeTab === "financials" && (
            <div className="flex flex-col gap-4">
              {mandate.arrears && (mandate.arrears.status === "partial" || mandate.arrears.status === "defaulted") && (
                <div className="flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50/60 px-4 py-3">
                  <IconAlertTriangle size={18} className="text-rose-500 shrink-0" aria-hidden="true" />
                  <p className="text-body-regular text-rose-700">{formatCompactKES(mandate.arrears.amount)} in arrears · {mandate.arrears.daysInArrears} days</p>
                </div>
              )}

              {period && (
                <div className="bg-white border border-slate-100 rounded-[32px] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-title-primary">Remittance breakdown — current period</h3>
                    <span className="text-xs uppercase font-mono text-slate-500 font-medium">
                      {currentMonthName}
                    </span>
                  </div>
                  <p className="text-desc-secondary mb-5">Collected rent is a landlord-payable liability — only the management fee is Sunland revenue.</p>

                  {/* Segmented Horizontal Progress Bar */}
                  <div className="h-4 w-full rounded-full overflow-hidden flex bg-slate-100" aria-hidden="true">
                    <div className="h-full bg-[#122a20]" style={{ width: `${(period.landlordRemittance / (period.collectedAmount || 1)) * 100}%` }} />
                    <div className="h-full bg-slate-400" style={{ width: `${(period.expenses / (period.collectedAmount || 1)) * 100}%` }} />
                    <div className="h-full bg-[#f3df27]" style={{ width: `${(period.managementFee / (period.collectedAmount || 1)) * 100}%` }} />
                  </div>

                  <div className="flex flex-col mt-6 gap-1">
                    <div className="flex items-center justify-between py-3 border-b border-slate-100/50">
                      <div className="flex items-center gap-2">
                        <span className="size-2.5 rounded-full bg-slate-300" />
                        <span className="text-xs text-slate-600 font-medium uppercase tracking-wide">Rent collected (landlord-payable)</span>
                      </div>
                      <span className="mono-stat text-sm font-normal text-slate-900">{formatCompactKES(period.collectedAmount)}</span>
                    </div>
                    <div className="flex items-center justify-between py-3 border-b border-slate-100/50">
                      <div className="flex items-center gap-2">
                        <span className="size-2.5 rounded-full bg-[#f3df27]" />
                        <span className="text-xs text-slate-600 font-medium uppercase tracking-wide">Less management fee — Sunland revenue</span>
                      </div>
                      <span className="mono-stat text-sm font-normal text-[#b49818]">- {formatCompactKES(period.managementFee)}</span>
                    </div>
                    <div className="flex items-center justify-between py-3 border-b border-slate-100/50">
                      <div className="flex items-center gap-2">
                        <span className="size-2.5 rounded-full bg-slate-400" />
                        <span className="text-xs text-slate-600 font-medium uppercase tracking-wide">Less approved expenses</span>
                      </div>
                      <span className="mono-stat text-sm font-normal text-slate-500">- {formatCompactKES(period.expenses)}</span>
                    </div>
                    <div className="flex items-center justify-between py-3">
                      <div className="flex items-center gap-2">
                        <span className="size-2.5 rounded-full bg-[#122a20]" />
                        <span className="text-xs text-slate-800 font-normal uppercase tracking-wide">Landlord remittance due</span>
                      </div>
                      <span className="mono-stat text-lg font-medium text-[#122a20]">{formatCompactKES(period.landlordRemittance)}</span>
                    </div>
                  </div>
                </div>
              )}

              {mandate.collections.length > 0 && (
                <div className="bg-white border border-slate-100 rounded-[32px] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                  <h3 className="text-title-primary">Collections — Expected vs Collected</h3>
                  <p className="text-desc-secondary mb-6">Six-month rolling ledger for this mandate.</p>
                  <div className="h-[260px] w-full">
                    <ResponsiveContainer width="100%" height="100%" minHeight={0} minWidth={0}>
                      <AreaChart data={mandate.collections} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorCollectedMandate" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#122a20" stopOpacity={0.25} />
                            <stop offset="95%" stopColor="#122a20" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="period" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 11 }} dy={10} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 11 }} tickFormatter={(v) => formatCompactKES(v)} dx={-10} />
                        <Tooltip formatter={(v) => formatCompactKES(Number(v))} />
                        <Area type="monotone" dataKey="expected" name="Expected" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="4 4" fill="transparent" />
                        <Area type="monotone" dataKey="collected" name="Collected" stroke="#122a20" strokeWidth={2.5} fillOpacity={1} fill="url(#colorCollectedMandate)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Custom Area Chart Legend */}
                  <div className="flex items-center gap-4 text-xs mt-4 pl-2">
                    <span className="flex items-center gap-1.5 font-medium text-slate-600">
                      <span className="h-0.5 w-3 bg-[#122a20] rounded-full" /> Collected
                    </span>
                    <span className="flex items-center gap-1.5 font-medium text-slate-500">
                      <span className="h-0.5 w-3 border-t border-dashed border-slate-400" /> Expected
                    </span>
                  </div>
                </div>
              )}

              <div className="bg-white border border-slate-100 rounded-[32px] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                <h3 className="text-title-primary mb-4">Remittance History</h3>
                {remittances.length === 0 ? (
                  <p className="text-slate-600 text-center py-8 text-sm bg-slate-50 rounded-2xl border border-slate-100 border-dashed">No remittance advices generated yet.</p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {remittances.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => { setSelectedRemittance(r); setRemittancePanelOpen(true); }}
                        className="flex items-center justify-between w-full py-3.5 hover:bg-slate-50/60 transition-colors text-left px-2 -mx-2 rounded-lg"
                      >
                        <div>
                          <p className="body-sm text-slate-800 font-medium">
                            {new Date(r.periodStart).toLocaleDateString("en-KE", { month: "short", year: "numeric" })}
                          </p>
                          <p className="text-xs text-slate-600 mt-0.5 capitalize">{r.status}</p>
                        </div>
                        <span className="mono-stat text-slate-900">{formatCompactKES(Number(r.netRemittanceKes))}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "units" && (
            <div className="bg-white border border-slate-100 rounded-[32px] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col gap-4">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-title-primary">Units under this mandate</h3>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-slate-500 font-medium">
                    {occupiedCount} occupied · {vacantCount} vacant
                  </span>
                  {canManage && (
                    <button
                      type="button"
                      onClick={() => setLeaseModalOpen(true)}
                      className="bg-[#151936] text-white hover:bg-[#1f254e] text-xs font-medium rounded-xl px-4 py-2 shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      + New Lease
                    </button>
                  )}
                </div>
              </div>

              <div className="flex flex-col">
                {/* Table Header Row */}
                <div className="grid grid-cols-[80px_1.2fr_1fr_120px_120px_40px] items-center px-4 py-2.5 bg-slate-50/50 rounded-xl text-[10px] font-medium uppercase tracking-wider text-slate-500 mb-2 border border-slate-100/60">
                  <div>Unit</div>
                  <div>Tenant</div>
                  <div>Lease Term</div>
                  <div>Rent</div>
                  <div>Status</div>
                  <div />
                </div>

                {/* Table Data Rows */}
                {unitsList.length === 0 ? (
                  <div className="p-10 text-center text-slate-500 text-sm">No units recorded for this property yet.</div>
                ) : (
                  <div className="flex flex-col gap-0.5">
                    {unitsList.map(({ unitCode, lease }) => {
                      if (lease) {
                        const startStr = new Date(lease.startDate).toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" });
                        const endStr = lease.endDate ? new Date(lease.endDate).toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" }) : "Open-ended";
                        const leaseTermLabel = `${startStr} – ${endStr}`;
                        return (
                          <button
                            key={lease.id}
                            type="button"
                            onClick={() => setDrawerLease(lease)}
                            className="grid grid-cols-[80px_1.2fr_1fr_120px_120px_40px] items-center py-3 px-4 hover:bg-slate-50/60 rounded-2xl transition-colors text-left w-full text-sm group cursor-pointer border border-transparent"
                          >
                            <span className="font-mono font-normal text-slate-900">{unitCode}</span>
                            <span className="flex items-center gap-2.5 min-w-0">
                              <Avatar
                                src={lease.tenantAvatarUrl || undefined}
                                fallback={getInitials(lease.tenantName)}
                                className="size-7 bg-slate-100 text-slate-800 text-xs font-normal shrink-0"
                              />
                              <span className="text-slate-800 font-medium truncate">{lease.tenantName}</span>
                            </span>
                            <span className="text-slate-500 text-xs truncate pr-2">{leaseTermLabel}</span>
                            <span className="font-mono text-slate-600">{formatCompactKES(parseFloat(lease.monthlyRentKes))}/mo</span>
                            <div>
                              <span className={cn(
                                "px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider rounded-full shadow-xs inline-block",
                                lease.status === "active" ? "bg-emerald-50 text-emerald-700 border border-emerald-100" :
                                  lease.status === "expiring" ? "bg-rose-50 text-rose-700 border border-rose-100" :
                                    "bg-slate-100 text-slate-700 border border-slate-200"
                              )}>
                                {lease.status === "active" ? "ACTIVE" : lease.status === "expiring" ? "EXPIRING" : lease.status.toUpperCase()}
                              </span>
                            </div>
                            <div className="flex justify-end text-slate-300 group-hover:text-slate-600 transition-colors">
                              <IconChevronRight size={16} />
                            </div>
                          </button>
                        );
                      } else {
                        return (
                          <div
                            key={unitCode}
                            className="grid grid-cols-[80px_1.2fr_1fr_120px_120px_40px] items-center py-3 px-4 rounded-2xl text-sm w-full text-slate-400 border border-transparent"
                          >
                            <span className="font-mono font-normal text-slate-400">{unitCode}</span>
                            <span className="flex items-center gap-2.5">
                              <span className="size-7 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 border border-slate-100 font-mono text-[10px] font-normal shrink-0">—</span>
                              <span className="text-slate-400 font-medium">—</span>
                            </span>
                            <span className="text-slate-400 text-xs">—</span>
                            <span className="font-mono text-slate-400">KES 95K/mo</span>
                            <div>
                              <span className="px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider bg-slate-50 text-slate-500 border border-slate-100/60 rounded-full shadow-xs inline-block">
                                VACANT
                              </span>
                            </div>
                            <div />
                          </div>
                        );
                      }
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "documents" && (() => {
            const mandateLetterDoc = mandate.documents.find((d) => d.type === "mandate_letter");
            const otherDocs = mandate.documents.filter((d) => d.type !== "mandate_letter");
            return (
              <div className="flex flex-col gap-4">
                {/* Mandate Letter Card */}
                <div className="bg-white border border-slate-100 rounded-[24px] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                  <span className="text-xs font-medium uppercase tracking-wider text-slate-400 mb-1.5 font-mono block">Mandate Letter</span>
                  <p className="text-desc-secondary mb-5">The signed instrument authorizing Sunland to collect rent and manage this property on {mandate.landlord.name}&apos;s behalf.</p>

                  {mandateLetterDoc ? (
                    <div className="flex items-center justify-between gap-6">
                      <div className="flex-1 bg-slate-50/50 border border-slate-100/60 rounded-2xl p-4 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="size-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 shadow-xs shrink-0">
                            <IconFileText size={18} className="text-slate-600" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-normal text-slate-800 truncate">{mandateLetterDoc.name}</p>
                            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5 font-mono">
                              1.4 MB · signed 09 Jul 2026
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <a
                            href={mandateLetterDoc.url || "#"}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[#122a20] hover:underline text-xs font-normal px-3 py-1.5 hover:bg-slate-100/50 rounded-lg transition-colors"
                          >
                            Open
                          </a>
                          {canManage && (
                            <button
                              type="button"
                              onClick={() => setMandateLetterOpen(true)}
                              className="text-slate-500 hover:text-slate-700 text-xs font-medium px-3 py-1.5 hover:bg-slate-100/50 rounded-lg transition-colors cursor-pointer"
                            >
                              Replace
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Scan Live QR Block */}
                      <div className="flex flex-col items-center gap-2 shrink-0">
                        <div className="size-16 flex items-center justify-center">
                          <IconQrcode size={44} className="text-slate-800" stroke={1.5} />
                        </div>
                        <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wide text-center leading-tight">Scan to view live copy</span>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-slate-50/50 border border-slate-200 border-dashed rounded-2xl p-6 text-center flex flex-col items-center gap-3">
                      <IconFileText size={32} className="text-slate-400" />
                      <div>
                        <p className="text-sm font-normal text-slate-700">No mandate letter attached</p>
                        <p className="text-xs text-slate-500 mt-1">Upload the signed instrument authorizing Sunland to manage this property.</p>
                      </div>
                      {canManage && (
                        <button
                          type="button"
                          onClick={() => setMandateLetterOpen(true)}
                          className="bg-[#151936] text-white hover:bg-[#1f254e] text-xs font-medium rounded-xl px-4 py-2 shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                          + Upload Letter
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Other Documents Card */}
                <div className="bg-white border border-slate-100 rounded-[24px] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                  <h3 className="text-title-primary mb-5">Other documents</h3>
                  {otherDocs.length === 0 ? (
                    <p className="text-slate-500 text-center py-10 text-xs bg-slate-50 rounded-2xl border border-slate-100 border-dashed">No other documents attached yet.</p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {otherDocs.map((doc) => {
                        const isSigned = doc.status === "signed" || (doc.type && ["mandate_letter", "lease_agreement", "offer_letter"].includes(doc.type));
                        const statusLabel = doc.status === "signed" ? "SIGNED" : doc.status === "awaiting_signature" ? "AWAITING SIGNATURE" : "FILED";
                        const sizeLabel = "1.2 MB";
                        return (
                          <div key={doc.id} className="flex items-center justify-between p-3.5 px-4 bg-slate-50/50 border border-slate-100/60 hover:bg-slate-50 rounded-2xl transition-colors w-full group">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="size-8 rounded-lg bg-white border border-slate-100 flex items-center justify-center text-slate-400 shadow-xs shrink-0">
                                <IconFileText size={15} className="text-slate-500" />
                              </div>
                              <div className="min-w-0">
                                <a href={doc.url || "#"} target="_blank" rel="noreferrer" className="text-sm font-medium text-slate-700 hover:text-slate-900 hover:underline truncate block">
                                  {doc.name}
                                </a>
                                <p className="text-xs text-slate-400 mt-0.5 font-mono">{sizeLabel} · {doc.status === "signed" ? "signed" : "filed"}</p>
                              </div>
                            </div>
                            <div>
                              <span className={cn(
                                "px-2.5 py-1 text-xs font-medium uppercase tracking-wider rounded-full shadow-xs inline-block",
                                isSigned ? "bg-emerald-50 text-emerald-700 border border-emerald-100/80" : "bg-slate-100 text-slate-500 border border-slate-200/60"
                              )}>
                                {statusLabel}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {activeTab === "activity" && (
            <div className="bg-white border border-slate-100 rounded-[24px] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
              <h3 className="text-sm font-medium text-slate-800 mb-6">Activity log</h3>
              {activityLoading ? (
                <div className="flex justify-center py-12"><LoadingSpinner size="md" /></div>
              ) : !activityLog || activityLog.length === 0 ? (
                <p className="text-slate-600 text-center py-12 text-sm bg-slate-50 rounded-2xl border border-slate-100 border-dashed">No recorded activity yet.</p>
              ) : (
                <div className="flex flex-col gap-6 relative ml-1">
                  <div className="absolute left-[3.5px] top-2 bottom-6 w-px bg-slate-200 z-0" />
                  {activityLog.map((entry) => {
                    const toneBase = activityTone(entry.summary);
                    const isAlert = toneBase.includes("rose") || toneBase.includes("amber");
                    const toneColor = isAlert ? "bg-rose-300 ring-rose-50" : "bg-slate-200 ring-white";
                    
                    return (
                      <div key={entry.id} className="relative flex items-start gap-4 z-10">
                        <div className={cn("size-[8px] rounded-full mt-1.5 shrink-0 ring-4 shadow-xs", toneColor)} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-500 leading-snug">
                            {entry.actorName ? (
                              <>
                                <span className="font-medium text-slate-700">{entry.actorName}</span> {entry.summary.replace(entry.actorName, "").replace(/^ - |^ — /, "").trim()}
                              </>
                            ) : (
                              entry.summary
                            )}
                          </p>
                          <p className="text-xs text-slate-400 font-mono mt-1 tracking-wider">
                            {new Date(entry.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}, {new Date(entry.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Context rail */}
        <div className="flex flex-col gap-4">
          {/* Landlord div */}
          <div className="bg-white border border-slate-100 rounded-[32px] overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
            <div className="relative h-56 w-full flex flex-col justify-between p-5 text-center">
              {mandate.landlord.avatarUrl ? (
                <Image
                  src={mandate.landlord.avatarUrl}
                  alt={mandate.landlord.name}
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-[#1e2336] to-[#0f132b]" />
              )}
              <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/15 to-black/60 z-0" />

              {/* Name and subtitle at the top */}
              <div className="relative z-10 mt-2">
                <h4 className="text-2xl font-serif text-white tracking-tight">{mandate.landlord.name}</h4>
                <span className="text-xs text-slate-200/90 flex items-center justify-center gap-1 mt-1 font-medium">
                  <IconShieldCheck size={14} className="text-emerald-400" /> Verified landlord
                </span>
              </div>

              {/* Buttons at the bottom */}
              <div className="relative z-10 flex justify-center gap-3 mb-1">
                <button
                  type="button"
                  onClick={() => router.push('/admin/messaging')}
                  className="size-9 rounded-full bg-white hover:bg-slate-50 text-slate-900 shadow-md flex items-center justify-center transition-all cursor-pointer border border-slate-100"
                  title="Message"
                >
                  <IconMessageCircle size={16} />
                </button>
                {mandate.landlord.phone && (
                  <a
                    href={`tel:${mandate.landlord.phone}`}
                    className="h-9 px-4 rounded-full bg-[#151936] hover:bg-[#1f254e] text-white flex items-center gap-1.5 text-sm font-medium shadow-md transition-all cursor-pointer"
                    title="Call"
                  >
                    <IconPhone size={13} /> Call
                  </a>
                )}
              </div>
            </div>

            <div className="p-5 flex flex-col gap-2.5 bg-slate-50/30">
              {/* Phone */}
              <div className="flex items-center justify-between p-1.5 bg-white border border-slate-100/80 rounded-full shadow-xs">
                <div className="flex items-center min-w-0">
                  <span className="size-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-600 shrink-0 border border-slate-100/50">
                    <IconPhone size={14} />
                  </span>
                  <span className="text-xs font-medium text-slate-600 ml-2.5">Phone</span>
                </div>
                <span className="text-xs font-mono font-medium text-slate-700 pr-3 truncate">{mandate.landlord.phone || "—"}</span>
              </div>

              {/* Mail */}
              <div className="flex items-center justify-between p-1.5 bg-white border border-slate-100/80 rounded-full shadow-xs">
                <div className="flex items-center min-w-0">
                  <span className="size-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-600 shrink-0 border border-slate-100/50">
                    <IconExternalLink size={14} />
                  </span>
                  <span className="text-xs font-medium text-slate-600 ml-2.5">Mail</span>
                </div>
                <span className="text-xs font-mono font-medium text-slate-700 pr-3 truncate max-w-[160px]" title={mandate.landlord.email || ""}>
                  {mandate.landlord.email || "—"}
                </span>
              </div>

              {/* Entity */}
              <div className="flex items-center justify-between p-1.5 bg-white border border-slate-100/80 rounded-full shadow-xs">
                <div className="flex items-center min-w-0">
                  <span className="size-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-600 shrink-0 border border-slate-100/50">
                    <IconBuildingCommunity size={14} />
                  </span>
                  <span className="text-xs font-medium text-slate-600 ml-2.5">Entity</span>
                </div>
                <span className="text-xs font-medium text-slate-700 pr-3 truncate max-w-[160px]">
                  {mandate.landlord.company || "Zawadi Estates Ltd"}
                </span>
              </div>

              {/* Properties */}
              <div className="flex items-center justify-between p-1.5 bg-white border border-slate-100/80 rounded-full shadow-xs">
                <div className="flex items-center min-w-0">
                  <span className="size-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-600 shrink-0 border border-slate-100/50">
                    <IconMapPin size={14} />
                  </span>
                  <span className="text-xs font-medium text-slate-600 ml-2.5">Properties</span>
                </div>
                <span className="text-xs font-medium text-slate-700 pr-3">3 under mandate</span>
              </div>

              <Link
                href={`/admin/contacts/${mandate.landlord.id}`}
                className="mt-1.5 inline-flex items-center justify-center gap-2 w-full rounded-full bg-white border border-slate-200/80 py-2.5 label-caps text-slate-700 hover:bg-slate-50 transition-colors text-xs font-medium shadow-xs"
              >
                View Full Profile
              </Link>
            </div>
          </div>

          {/* Property Manager div */}
          <div className="bg-white border border-slate-100 rounded-[32px] p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="size-12 rounded-full flex items-center justify-center bg-[#0f132b] text-[#f3df27] font-normal text-sm shrink-0 shadow-xs">
                  {getInitials(mandate.manager?.name || "Unassigned")}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium text-slate-800 leading-snug">{mandate.manager?.name || "Unassigned"}</h4>
                  <p className="label-caps text-slate-600 mt-0.5">{mandate.manager?.title || "Property Manager"}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => router.push('/admin/messaging')}
                className="size-10 rounded-full bg-white hover:bg-slate-50 border border-slate-200/80 flex items-center justify-center text-slate-600 shadow-xs transition-colors"
                title="Message"
              >
                <IconMessageCircle size={16} />
              </button>
            </div>

            <div className="flex flex-col gap-2.5 border-t border-slate-100 pt-4">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-600 font-medium">Portfolio</span>
                <span className="font-mono font-medium text-slate-800">6 properties</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-600 font-medium">On-time collection</span>
                <span className="font-mono font-medium text-emerald-600">94%</span>
              </div>
            </div>
          </div>

          {/* Property Command Center div */}
          <div className="bg-white border border-slate-100 rounded-[32px] overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative">
            <div className="relative h-32 w-full bg-slate-100 flex items-end p-4">
              {primaryImage ? (
                <Image src={primaryImage} alt="" fill className="object-cover" />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-slate-200 to-slate-100" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
              <p className="relative font-serif text-sm font-medium text-white z-10 truncate leading-tight">
                {mandate.property.name}
              </p>
            </div>
            <div className="p-4 px-5 flex items-center justify-between gap-3 text-xs bg-white border-t border-slate-50">
              <span className="text-slate-500 font-mono font-medium">
                {mandate.property.propertyCode} · {mandate.property.location}
              </span>
              <Link
                href={`/admin/properties/${mandate.property.id}`}
                className="text-[#122a20] font-medium hover:underline flex items-center gap-1 shrink-0"
              >
                Command center ↗
              </Link>
            </div>
          </div>

          {/* Portals div */}
          <div className="bg-white border border-slate-100 rounded-[32px] p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col gap-4">
            <h4 className="text-base font-medium text-slate-800">Portals</h4>
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 text-slate-600 font-medium">
                  <IconUsers size={15} className="text-slate-400" /> Landlord dashboard
                </span>
                <span className="text-emerald-600 font-medium font-mono tracking-wide">ACTIVE</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 text-slate-600 font-medium">
                  <IconBuildingCommunity size={15} className="text-slate-400" /> Tenant portals
                </span>
                <span className="text-emerald-600 font-medium font-mono tracking-wide">
                  {mandate.leases.filter((l) => l.isActive).length} / {mandate.unitCount} ACTIVE
                </span>
              </div>
            </div>
            <p className="text-xs text-slate-400/90 leading-relaxed pt-2 border-t border-slate-50">
              Landlords see remittance history and documents; tenants log complaints and view their contract from their own portal.
            </p>
          </div>

          {/* Quick Facts div */}
          <div className="bg-white border border-slate-100 rounded-[32px] p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col gap-4">
            <h4 className="text-base font-medium text-slate-800">Quick Facts</h4>
            <div className="flex flex-col gap-3 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-600 font-medium">Mandate ref</span>
                <span className="font-mono font-medium text-slate-800">MND-{new Date(mandate.startDate).getFullYear()}-{mandate.id.slice(0, 3).toUpperCase()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600 font-medium">Signed</span>
                <span className="font-mono font-medium text-slate-800">
                  {new Date(mandate.startDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600 font-medium">Property code</span>
                <span className="font-mono font-medium text-slate-800">{mandate.property.propertyCode}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600 font-medium">Next remittance</span>
                <span className="font-mono font-medium text-slate-800">
                  {new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Overlays ── */}
      <LeaseDetailDrawer
        lease={drawerLease ? {
          id: drawerLease.id,
          startsAt: drawerLease.startDate,
          endsAt: drawerLease.endDate ?? "",
          monthlyRentKes: drawerLease.monthlyRentKes,
          depositKes: drawerLease.depositKes,
          isActive: drawerLease.isActive,
          propertyId: mandate.property.id,
          tenantContactId: drawerLease.tenantContactId,
          propertyName: mandate.property.name,
          propertyCode: mandate.property.propertyCode,
          propertyType: mandate.property.propertyType,
          propertyLocation: mandate.property.location,
          tenantName: drawerLease.tenantName,
          tenantEmail: drawerLease.tenantEmail ?? null,
          tenantPhone: drawerLease.tenantPhone ?? null,
        } : null}
        open={!!drawerLease}
        entityId={entityId ?? undefined}
        onClose={() => setDrawerLease(null)}
        canManage={canManage}
        onTerminate={() => setRefreshCount((c) => c + 1)}
        onEdit={() => { setEditingLease(drawerLease); setDrawerLease(null); }}
        onRenew={() => { setRenewingLease(drawerLease); setDrawerLease(null); }}
      />

      <LeaseFormModal
        open={leaseModalOpen}
        defaultPropertyId={mandate.property.id}
        defaultPropertyName={mandate.property.name}
        onClose={() => setLeaseModalOpen(false)}
        onSubmit={() => {
          setLeaseModalOpen(false);
          setRefreshCount((c) => c + 1);
        }}
      />

      {editingLease && (
        <LeaseFormModal
          open={!!editingLease}
          mode="edit"
          lease={leaseSummaryToEditTarget(editingLease, mandate.property)}
          onClose={() => setEditingLease(null)}
          onSubmit={() => {
            setEditingLease(null);
            setRefreshCount((c) => c + 1);
          }}
        />
      )}

      {renewingLease && (
        <LeaseRenewModal
          open={!!renewingLease}
          lease={leaseSummaryToRenewTarget(renewingLease, mandate.property)}
          onClose={() => setRenewingLease(null)}
          onRenewed={() => {
            setRenewingLease(null);
            setRefreshCount((c) => c + 1);
          }}
        />
      )}

      <MandateLetterModal
        open={mandateLetterOpen}
        entityId={entityId}
        ownerContactId={mandate.landlord.id}
        propertyName={mandate.property.name}
        landlordName={mandate.landlord.name}
        hasExistingLetter={mandate.documents.some((d) => d.type === "mandate_letter")}
        onClose={() => setMandateLetterOpen(false)}
        onAttached={() => setRefreshCount((c) => c + 1)}
      />

      {mandate.approvalRequestId && (
        <MandateOverrideModal
          open={overrideModalOpen}
          approvalRequestId={mandate.approvalRequestId}
          gmName={mandate.manager?.name}
          onClose={() => setOverrideModalOpen(false)}
          onDecided={() => setRefreshCount((c) => c + 1)}
        />
      )}

      <RemittanceAdvicePanel
        open={remittancePanelOpen}
        remittance={selectedRemittance}
        landlordName={mandate.landlord.name}
        propertyName={mandate.property.name}
        onClose={() => setRemittancePanelOpen(false)}
        onDecided={() => { loadRemittances(); setRefreshCount((c) => c + 1); }}
      />

      <ConfirmDialog
        open={terminateOpen}
        onClose={() => { setTerminateOpen(false); setTerminateNotes(""); setTerminateNotesErr(false); }}
        onConfirm={handleTerminate}
        title="Terminate Mandate"
        description="This cannot be undone. Rent collection under this mandate stops, and the final landlord remittance is queued for review."
        confirmLabel="Terminate Mandate"
        tone="danger"
        isLoading={isTerminating}
        notes={{
          label: "Termination reason",
          placeholder: "Why is this mandate being terminated?",
          value: terminateNotes,
          onChange: (v) => { setTerminateNotes(v); setTerminateNotesErr(false); },
          required: true,
          error: terminateNotesErr ? "A reason is required." : undefined,
        }}
      />

      <PropertyOwnerProfileDrawer
        open={ownerDrawerOpen}
        onClose={() => setOwnerDrawerOpen(false)}
        entityId={entityId ?? ""}
        ownerContactId={mandate.landlord.id}
        properties={singlePropertyList}
        onOpenProperty={(p) => { setOwnerDrawerOpen(false); router.push(`/admin/properties/${p.id}`); }}
      />

      <PropertyManagerProfileDrawer
        open={managerDrawerOpen}
        onClose={() => setManagerDrawerOpen(false)}
        entityId={entityId ?? ""}
        managerId={mandate.manager?.id ?? null}
        properties={singlePropertyList}
        onOpenProperty={(p) => { setManagerDrawerOpen(false); router.push(`/admin/properties/${p.id}`); }}
      />

      <PhotoLightbox
        open={lightboxOpen}
        media={mediaList}
        index={lightboxIndex}
        onIndexChange={setLightboxIndex}
        onClose={() => setLightboxOpen(false)}
      />
    </div>
  );
}

interface MandatePropertyShape {
  id: string;
  name: string;
  propertyCode: string;
  propertyType: string;
  location: string;
}

function leaseSummaryToEditTarget(l: LeaseSummary, property: MandatePropertyShape): LeaseEditTarget {
  return {
    id: l.id,
    propertyName: property.name,
    tenantName: l.tenantName,
    startsAt: l.startDate,
    endsAt: l.endDate ?? "",
    monthlyRentKes: l.monthlyRentKes,
    depositKes: l.depositKes,
  };
}

function leaseSummaryToRenewTarget(l: LeaseSummary, property: MandatePropertyShape): LeaseRenewTarget {
  return {
    id: l.id,
    propertyName: property.name,
    tenantName: l.tenantName,
    endsAt: l.endDate ?? "",
    monthlyRentKes: l.monthlyRentKes,
    depositKes: l.depositKes,
  };
}
