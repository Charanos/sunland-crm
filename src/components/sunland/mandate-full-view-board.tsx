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
  IconMessageCircle,
  IconPhone,
  IconReceipt2,
  IconShieldCheck,
  IconTrash,
  IconWalletOff,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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

const ACTION_TONE_CLASSES: Record<ActionTone, { card: string; iconWrap: string; cta: string }> = {
  amber: {
    card: "border-amber-200 bg-amber-500/[0.04] rounded-2xl p-4 flex items-center justify-between gap-4 border shadow-sm transition-all duration-300 hover:shadow-md",
    iconWrap: "bg-amber-100/80 text-amber-700 size-9 rounded-xl flex items-center justify-center shrink-0 shadow-xs",
    cta: "bg-[#f3df27] text-[#151936] font-medium text-xs rounded-xl px-4 py-1.5 hover:bg-[#e6d220] transition-colors shadow-sm whitespace-nowrap",
  },
  rose: {
    card: "border-rose-100 bg-rose-500/[0.02] rounded-2xl p-4 flex items-center justify-between gap-4 border shadow-sm transition-all duration-300 hover:shadow-md",
    iconWrap: "bg-rose-100/80 text-rose-600 size-9 rounded-xl flex items-center justify-center shrink-0 shadow-xs",
    cta: "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-medium text-xs rounded-xl px-4 py-1.5 transition-colors shadow-xs whitespace-nowrap",
  },
  neutral: {
    card: "border-slate-200/80 bg-slate-50/50 rounded-2xl p-4 flex items-center justify-between gap-4 border shadow-sm transition-all duration-300 hover:shadow-md",
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

const MANDATE_STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  pending_approval: "Pending Approval",
  active: "Active",
  terminated: "Terminated",
};
const MANDATE_STATUS_PILL: Record<string, string> = {
  draft: "border-slate-300 bg-slate-100 text-slate-600",
  pending_approval: "border-amber-300 bg-amber-100 text-amber-700",
  active: "border-emerald-300 bg-emerald-100 text-emerald-700",
  terminated: "border-slate-300 bg-slate-100 text-slate-500",
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

  const [activityLog, setActivityLog] = useState<AuditEntry[] | null>(null);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityLoaded, setActivityLoaded] = useState(false);

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

  const pillClass = MANDATE_STATUS_PILL[mandate.status];
  const primaryImage = mandate.property.media?.[0]?.url;
  const period = mandate.currentPeriod;
  const remittanceDue = mandate.pendingRemittance ? Number(mandate.pendingRemittance.netRemittanceKes) : period?.landlordRemittance ?? 0;

  const lastCollection = mandate.collections?.[mandate.collections.length - 1];
  const expectedAmount = lastCollection?.expected ?? 0;
  const collectedAmount = period?.collectedAmount ?? 0;
  const collectionPct = expectedAmount > 0 ? Math.round((collectedAmount / expectedAmount) * 100) : 0;

  const radius = 24;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (collectionPct / 100) * circumference;

  const vitals = [
    {
      label: "Management Fee",
      value: `${(mandate.mandateRate * 100).toFixed(1)}%`,
      sub: "of collected rent",
      tone: "neutral" as VitalTone,
      icon: IconReceipt2,
      hasBar: false,
      tab: "financials" as TabKey,
    },
    {
      label: "Expected Rent Roll",
      value: formatCompactKES(expectedAmount),
      sub: `${mandate.unitCount} units billed`,
      tone: "neutral" as VitalTone,
      icon: IconBuildingCommunity,
      hasBar: false,
      tab: "units" as TabKey,
    },
    {
      label: "Collected MTD",
      value: `${collectionPct}%`,
      sub: `${formatCompactKES(collectedAmount)} of ${formatCompactKES(expectedAmount)}`,
      tone: "emerald" as VitalTone,
      icon: IconWalletOff,
      hasBar: true,
      barRatio: collectionPct / 100,
      tab: "financials" as TabKey,
    },
    {
      label: "Remittance Due",
      value: formatCompactKES(remittanceDue),
      sub: mandate.pendingRemittance ? "pending release" : "released",
      tone: mandate.pendingRemittance ? "rose" : "neutral" as VitalTone,
      icon: IconArrowUpRight,
      hasBar: false,
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
      {/* ── Command Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 px-1 mt-2">
        <div className="flex flex-col gap-2.5 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="title-serif text-3xl lg:text-4xl truncate">
              {mandate.property.name}
            </h1>
            <span className="mono-data text-slate-400 self-end mb-1">
              {mandate.id.slice(0, 8).toUpperCase()}
            </span>
            <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 label-caps", pillClass)}>
              {MANDATE_STATUS_LABEL[mandate.status]}
            </span>
          </div>
        </div>

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

      {/* ── Flagship Mandate Banner ── */}
      <div className="relative rounded-[28px] overflow-hidden min-h-[360px] shadow-[0_8px_30px_rgb(0,0,0,0.06)] bg-[#1e2336] text-white flex flex-col justify-between p-6 lg:p-8 mt-2 mb-4 border border-slate-800">
        {primaryImage ? (
          <Image
            src={primaryImage}
            alt={mandate.property.name}
            fill
            className="object-cover absolute inset-0 opacity-40 mix-blend-overlay"
            priority
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900 to-[#1e2336]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#15192b] via-transparent to-transparent opacity-90" />

        {/* Top bar overlay */}
        <div className="relative z-10 flex justify-between items-start w-full">
          <span className="bg-[#f3df27] text-[#151936] px-3.5 py-1.5 rounded-md text-xs font-medium tracking-wider flex items-center gap-1.5 shadow-sm">
            <IconStarFilled size={14} /> Flagship Mandate
          </span>
          <span className="bg-white/10 backdrop-blur-md border border-white/10 px-3.5 py-1.5 rounded-full text-xs font-medium uppercase tracking-wider">
            {mandate.status.replace("_", " ")} · {(mandate.mandateRate * 100).toFixed(1)}% Fee
          </span>
        </div>

        {/* Bottom content overlay */}
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 w-full">
          <div className="flex flex-col gap-3 max-w-xl w-full">
            <div>
              <p className="text-[11px] text-slate-300 font-mono tracking-widest uppercase mb-1">
                {mandate.id.slice(0, 8).toUpperCase()} · {mandate.property.location}
              </p>
              <h2 className="text-3xl lg:text-4xl font-serif font-normal text-white leading-tight">
                {mandate.property.name}
              </h2>
            </div>

            {/* Landlord & Property Manager Pills */}
            <div className="flex flex-wrap gap-2.5 mt-2">
              <button
                type="button"
                onClick={() => setOwnerDrawerOpen(true)}
                className="bg-black/40 hover:bg-black/60 backdrop-blur-md px-3.5 py-1.5 rounded-full flex items-center gap-2.5 border border-white/10 transition-colors cursor-pointer text-left focus:outline-hidden"
              >
                <Avatar
                  src={mandate.landlord.avatarUrl || undefined}
                  fallback={getInitials(mandate.landlord.name)}
                  className="size-7 bg-slate-100 text-slate-800 text-[10px] font-medium"
                />
                <div className="text-left leading-none">
                  <p className="text-xs font-medium text-white">{mandate.landlord.name}</p>
                  <span className="text-[9px] uppercase tracking-widest text-slate-400 mt-1 block">Landlord</span>
                </div>
              </button>
              {mandate.manager && (
                <button
                  type="button"
                  onClick={() => setManagerDrawerOpen(true)}
                  className="bg-black/40 hover:bg-black/60 backdrop-blur-md px-3.5 py-1.5 rounded-full flex items-center gap-2.5 border border-white/10 transition-colors cursor-pointer text-left focus:outline-hidden"
                >
                  <Avatar
                    src={mandate.manager.avatarUrl || undefined}
                    fallback={getInitials(mandate.manager.name || "Unassigned")}
                    className="size-7 bg-[#f3df27] text-[#151936] text-[10px] font-medium"
                  />
                  <div className="text-left leading-none">
                    <p className="text-xs font-medium text-white">{mandate.manager.name}</p>
                    <span className="text-[9px] uppercase tracking-widest text-slate-400 mt-1 block">Property Manager</span>
                  </div>
                </button>
              )}
            </div>

            {/* Dynamic Slider (Progress Bar) */}
            <div className="w-full mt-2 pr-8 lg:pr-12">
              <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden mb-2">
                <div
                  className={cn("h-full rounded-full transition-all duration-500", collectionPct >= 90 ? "bg-emerald-400" : collectionPct >= 70 ? "bg-[#f3df27]" : "bg-rose-400")}
                  style={{ width: `${Math.min(100, collectionPct)}%` }}
                />
              </div>
              <div className="flex justify-between items-center text-xs font-medium text-slate-300">
                <span className="font-mono text-white tracking-tight text-[11px]">{formatCompactKES(collectedAmount)} collected</span>
                <span className="text-[11px]">of <span className="font-mono text-slate-300">{formatCompactKES(expectedAmount)}</span> expected</span>
              </div>
            </div>

            {/* Remittance Due Text */}
            <div className="mt-2 pt-4 border-t border-white/10">
              <p className="text-[10px] font-medium uppercase tracking-widest text-slate-400">
                Remittance due to landlord
              </p>
              <p className="text-[22px] font-medium font-mono tracking-tight text-white mt-0.5">
                {formatCompactKES(remittanceDue)}
              </p>
            </div>
          </div>

          {/* Right Side: Floating Collection Card & Buttons */}
          <div className="flex flex-col items-end shrink-0 relative w-[260px]">
            {/* Collection Card */}
            <div className="bg-white text-slate-900 rounded-[20px] p-4 shadow-xl flex items-center gap-4 absolute -top-48 right-0 w-full border border-slate-100">
              <div className="relative size-12 flex items-center justify-center shrink-0">
                <svg className="size-full -rotate-90">
                  <circle cx="24" cy="24" r="20" fill="transparent" stroke="#f1f5f9" strokeWidth="5" />
                  <circle
                    cx="24"
                    cy="24"
                    r="20"
                    fill="transparent"
                    stroke="#151936"
                    strokeWidth="5"
                    strokeDasharray={2 * Math.PI * 20}
                    strokeDashoffset={(2 * Math.PI * 20) - (collectionPct / 100) * (2 * Math.PI * 20)}
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <p className="text-[9px] font-medium uppercase tracking-widest text-slate-400">Collection</p>
                  <IconArrowUpRight size={12} className="text-slate-300" />
                </div>
                <p className="text-xl font-medium text-slate-900 mt-0.5 leading-none">{collectionPct}%</p>
                <p className="text-[10px] text-slate-400 mt-1">of {currentMonthName} rent</p>
              </div>
            </div>

            {/* Banner Floating Buttons */}
            <div className="flex items-center gap-2.5 mt-8 w-full justify-end">
              <button
                type="button"
                onClick={handleGenerateRemittance}
                className="bg-transparent border border-slate-500 text-slate-300 hover:bg-white/10 hover:text-white hover:border-white/50 font-medium text-sm rounded-xl px-4 py-2 transition-all flex items-center gap-1.5 backdrop-blur-sm shadow-sm"
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
                  className="bg-[#151936] text-white hover:bg-[#1a1f42] font-medium text-sm rounded-xl px-4 py-2 shadow-lg transition-all flex items-center gap-1.5 border border-[#2c3359]"
                >
                  <IconArrowUpRight size={14} /> Release Payment
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Vitals Grid Row ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        {vitals.map((v) => (
          <button
            key={v.label}
            type="button"
            onClick={() => setActiveTab(v.tab)}
            className={cn(
              "group relative overflow-hidden bg-white border rounded-[20px] p-5 flex flex-col justify-center min-h-[110px] text-left transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md hover:border-slate-200 focus:outline-hidden cursor-pointer",
              v.tone === "rose" ? "border-rose-200 bg-rose-50/50 hover:bg-rose-50/70" : "border-slate-100 hover:bg-slate-50/30 shadow-[0_2px_10px_rgb(0,0,0,0.02)]"
            )}
          >
            <v.icon
              size={80}
              stroke={1.2}
              className={cn(
                "absolute -right-3 -bottom-3 opacity-[0.03] group-hover:scale-110 group-hover:opacity-[0.06] transition-all duration-500 pointer-events-none",
                v.tone === "rose" ? "text-rose-500" : v.tone === "emerald" ? "text-emerald-500" : "text-slate-400"
              )}
              aria-hidden="true"
            />
            <div className="relative z-10">
              <div className="flex items-center gap-1 mb-2">
                {v.tone === "rose" && <IconArrowUpRight size={12} className="text-rose-500" />}
                <p className={cn("text-[10px] uppercase tracking-widest", v.tone === "rose" ? "text-rose-500 font-medium" : "text-slate-400 font-medium")}>
                  {v.label}
                </p>
              </div>
              <p className={cn("text-2xl font-mono tracking-tight font-medium", v.tone === "rose" ? "text-rose-600" : "text-slate-900")}>
                {v.value}
              </p>
              <p className={cn("text-xs mt-0.5", v.tone === "rose" ? "text-rose-400 font-medium" : "text-slate-400")}>
                {v.sub}
              </p>
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
              <div key={item.key} className={t.card}>
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
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 lg:gap-8 items-start">
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
            <Card className="bg-white border border-slate-100 rounded-[24px] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
              <h3 className="text-title-primary mb-5">Mandate Terms</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="flex flex-col gap-1.5 p-4 rounded-xl bg-slate-50 border border-slate-100">
                  <p className="label-caps text-slate-400">Management Fee</p>
                  <p className="mono-amount text-slate-900">{(mandate.mandateRate * 100).toFixed(1)}%</p>
                </div>
                <div className="flex flex-col gap-1.5 p-4 rounded-xl bg-slate-50 border border-slate-100">
                  <p className="label-caps text-slate-400">Units Covered</p>
                  <p className="mono-amount text-slate-900">{mandate.unitCount}</p>
                </div>
                <div className="flex flex-col gap-1.5 p-4 rounded-xl bg-slate-50 border border-slate-100">
                  <p className="label-caps text-slate-400">Start Date</p>
                  <p className="mono-amount text-slate-900">{new Date(mandate.startDate).toLocaleDateString()}</p>
                </div>
                <div className="flex flex-col gap-1.5 p-4 rounded-xl bg-slate-50 border border-slate-100">
                  <p className="label-caps text-slate-400">End Date</p>
                  <p className="mono-amount text-slate-900">{mandate.endDate ? new Date(mandate.endDate).toLocaleDateString() : "Open-ended"}</p>
                </div>
              </div>
              {mandate.rateJustification && (
                <p className="body-sm text-slate-500 mt-5 pt-5 border-t border-slate-100">
                  <span className="font-medium text-slate-700">Rate justification: </span>{mandate.rateJustification}
                </p>
              )}
              <p className="body-sm text-slate-400 mt-4">
                Sunland manages day-to-day rent collection, tenant relations, and maintenance coordination for this property under this mandate, remitting collected rent to the landlord net of the management fee and approved expenses.
              </p>
            </Card>
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
                <Card className="bg-white border border-slate-100 rounded-[24px] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-title-primary">Remittance breakdown — current period</h3>
                    <Button size="sm" variant="secondary" onClick={handleGenerateRemittance} disabled={generatingRemittance}>
                      {generatingRemittance ? "Generating…" : "Generate Advice"}
                    </Button>
                  </div>
                  <p className="text-desc-secondary mb-4">Collected rent is a landlord-payable liability — only the management fee is Sunland revenue.</p>
                  <div className="flex h-3.5 w-full rounded-full overflow-hidden border border-slate-200" aria-hidden="true">
                    <div className="h-full bg-[#122a20]" style={{ width: `${Math.max(1.5, (period.landlordRemittance / (period.collectedAmount || 1)) * 100)}%` }} />
                    <div className="h-full bg-slate-400" style={{ width: `${Math.max(1.5, (period.expenses / (period.collectedAmount || 1)) * 100)}%` }} />
                    <div className="h-full bg-[#f3df27]" style={{ width: `${Math.max(1.5, (period.managementFee / (period.collectedAmount || 1)) * 100)}%` }} />
                  </div>
                  <div className="flex flex-col mt-4">
                    <div className="flex items-center justify-between py-2.5 border-b border-slate-50">
                      <span className="text-body-regular text-slate-600">Rent collected</span>
                      <span className="mono-amount text-slate-900">{formatCompactKES(period.collectedAmount)}</span>
                    </div>
                    <div className="flex items-center justify-between py-2.5 border-b border-slate-50">
                      <span className="text-body-regular text-slate-600">Less management fee</span>
                      <span className="mono-amount text-amber-700">− {formatCompactKES(period.managementFee)}</span>
                    </div>
                    <div className="flex items-center justify-between py-2.5 border-b border-slate-50">
                      <span className="text-body-regular text-slate-600">Less approved expenses</span>
                      <span className="mono-amount text-slate-500">− {formatCompactKES(period.expenses)}</span>
                    </div>
                    <div className="flex items-center justify-between py-2.5">
                      <span className="text-body-regular text-slate-600">Landlord remittance due</span>
                      <span className="mono-amount text-base font-medium text-[#122a20]">{formatCompactKES(period.landlordRemittance)}</span>
                    </div>
                  </div>
                </Card>
              )}

              {mandate.collections.length > 0 && (
                <Card className="bg-white border border-slate-100 rounded-[24px] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                  <h3 className="text-title-primary mb-6">Collections — Expected vs Collected</h3>
                  <div className="h-[260px] w-full">
                    <ResponsiveContainer width="100%" height="100%" minHeight={0} minWidth={0}>
                      <AreaChart data={mandate.collections} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorCollectedMandate" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#122a20" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#122a20" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="period" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} dy={10} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} tickFormatter={(v) => formatCompactKES(v)} dx={-10} />
                        <Tooltip formatter={(v) => formatCompactKES(Number(v))} />
                        <Area type="monotone" dataKey="expected" name="Expected" stroke="#94a3b8" strokeWidth={2} strokeDasharray="4 4" fill="transparent" />
                        <Area type="monotone" dataKey="collected" name="Collected" stroke="#122a20" strokeWidth={3} fillOpacity={1} fill="url(#colorCollectedMandate)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              )}

              <Card className="bg-white border border-slate-100 rounded-[24px] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                <h3 className="text-title-primary mb-4">Remittance History</h3>
                {remittances.length === 0 ? (
                  <p className="text-slate-400 text-center py-8 text-sm bg-slate-50 rounded-2xl border border-slate-100 border-dashed">No remittance advices generated yet.</p>
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
                          <p className="text-xs text-slate-400 mt-0.5 capitalize">{r.status}</p>
                        </div>
                        <span className="mono-stat text-slate-900">{formatCompactKES(Number(r.netRemittanceKes))}</span>
                      </button>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          )}

          {activeTab === "units" && (
            <Card className="bg-white border border-slate-100 rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
              {mandate.leases.length === 0 ? (
                <div className="p-10 text-center text-slate-400">No tenant leases recorded for this property yet.</div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {mandate.leases.map((l) => (
                    <button key={l.id} type="button" onClick={() => setDrawerLease(l)} className="flex items-center justify-between w-full px-6 py-4 hover:bg-slate-50/60 transition-colors text-left">
                      <div>
                        <p className="body-md text-slate-800 font-medium">{l.tenantName}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{l.status === "active" ? "Active tenancy" : l.status === "expiring" ? "Expiring soon" : "Ended"}</p>
                      </div>
                      <span className="mono-stat text-slate-900">{formatCompactKES(parseFloat(l.monthlyRentKes))}/mo</span>
                    </button>
                  ))}
                </div>
              )}
            </Card>
          )}

          {activeTab === "documents" && (
            <div className="flex flex-col gap-4">
              {canManage && (
                <Button variant="secondary" onClick={() => setMandateLetterOpen(true)} className="self-start">
                  <IconFileText size={14} className="mr-1.5" /> {mandate.documents.some((d) => d.type === "mandate_letter") ? "Replace" : "Upload"} Mandate Letter
                </Button>
              )}
              {mandate.documents.length === 0 ? (
                <Card className="bg-white border border-slate-100 rounded-[24px] p-16 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col items-center text-center gap-4">
                  <IconFileText size={40} stroke={1.5} className="text-slate-300" aria-hidden="true" />
                  <h3 className="text-xl font-serif text-slate-900">No documents attached</h3>
                  <p className="text-slate-400 max-w-sm text-sm">The mandate letter and other landlord paperwork will appear here once uploaded.</p>
                </Card>
              ) : (
                <Card className="bg-white border border-slate-100 rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
                  <div className="divide-y divide-slate-100">
                    {mandate.documents.map((doc) => (
                      <a key={doc.id} href={doc.url} target="_blank" rel="noreferrer" className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50/60 transition-colors">
                        <IconFileText size={16} className="text-slate-400" />
                        <span className="text-body-primary text-slate-800 truncate flex-1">{doc.name}</span>
                        <span className="label-caps text-slate-400 shrink-0">{doc.type}</span>
                      </a>
                    ))}
                  </div>
                </Card>
              )}
            </div>
          )}

          {activeTab === "activity" && (
            <Card className="bg-white border border-slate-100 rounded-[24px] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
              {activityLoading ? (
                <div className="flex justify-center py-12"><LoadingSpinner size="md" /></div>
              ) : !activityLog || activityLog.length === 0 ? (
                <p className="text-slate-400 text-center py-12 text-sm bg-slate-50 rounded-2xl border border-slate-100 border-dashed">No recorded activity yet.</p>
              ) : (
                <div className="space-y-0 pl-2">
                  {activityLog.map((entry, i) => (
                    <div key={entry.id} className="flex gap-4 relative py-4">
                      {i < activityLog.length - 1 && <div className="absolute left-[9px] top-[36px] bottom-0 w-0.5 bg-slate-100 rounded-full" />}
                      <div className={cn("size-[20px] rounded-full border-[3px] bg-white shrink-0 mt-0.5 z-10 shadow-sm", activityTone(entry.summary))} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 leading-snug">{entry.summary}</p>
                        <p className="text-xs uppercase tracking-wider text-slate-400 mt-1.5 flex items-center gap-1.5">
                          <IconClock size={14} stroke={2} />
                          {entry.actorName ? `${entry.actorName} · ` : ""}{relativeTime(entry.createdAt)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}
        </div>

        {/* Context rail */}
        <div className="flex flex-col gap-5">
          {/* Landlord Card */}
          <Card className="bg-white border border-slate-100 rounded-[24px] overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
            <div className="relative h-48 w-full bg-slate-100 flex items-end">
              {mandate.landlord.avatarUrl ? (
                <Image
                  src={mandate.landlord.avatarUrl}
                  alt={mandate.landlord.name}
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-slate-200 to-slate-100 flex items-center justify-center">
                  <IconBuildingCommunity size={36} className="text-slate-300" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/40 to-transparent" />
              <div className="relative p-4 text-white z-10 w-full flex justify-between items-end">
                <div>
                  <h4 className="text-base font-medium leading-tight">{mandate.landlord.name}</h4>
                  <span className="text-[10px] uppercase font-medium tracking-wider text-slate-300 flex items-center gap-1 mt-1">
                    <IconShieldCheck size={12} className="text-emerald-400" /> Verified Landlord
                  </span>
                </div>
                {/* Overlaid message/call buttons */}
                <div className="flex gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => router.push('/admin/messaging')}
                    className="size-8 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-md flex items-center justify-center text-white transition-colors"
                    title="Message"
                  >
                    <IconMessageCircle size={15} />
                  </button>
                  {mandate.landlord.phone && (
                    <a
                      href={`tel:${mandate.landlord.phone}`}
                      className="size-8 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-md flex items-center justify-center text-white transition-colors"
                      title="Call"
                    >
                      <IconPhone size={15} />
                    </a>
                  )}
                </div>
              </div>
            </div>

            <div className="p-5 flex flex-col gap-3">
              <div className="flex items-center justify-between text-xs py-1 border-b border-slate-50">
                <span className="text-slate-400 font-medium">Phone</span>
                <span className="text-slate-700 font-medium">{mandate.landlord.phone || "—"}</span>
              </div>
              <div className="flex items-center justify-between text-xs py-1 border-b border-slate-50">
                <span className="text-slate-400 font-medium">Mail</span>
                <span className="text-slate-700 font-medium truncate max-w-[170px]" title={mandate.landlord.email || ""}>
                  {mandate.landlord.email || "—"}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs py-1 border-b border-slate-50">
                <span className="text-slate-400 font-medium">Entity</span>
                <span className="text-slate-700 font-medium truncate max-w-[170px]">
                  {mandate.landlord.company || "Zawadi Estates Ltd"}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs py-1">
                <span className="text-slate-400 font-medium">Properties</span>
                <span className="text-slate-700 font-medium">3 under mandate</span>
              </div>
            </div>
          </Card>

          {/* Property Manager Card */}
          <Card className="bg-white border border-slate-100 rounded-[24px] p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Avatar
                  src={mandate.manager?.avatarUrl || undefined}
                  fallback={getInitials(mandate.manager?.name || "Unassigned")}
                  className="size-10 bg-slate-100 text-slate-800 text-xs font-medium"
                />
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium text-slate-800 leading-snug">{mandate.manager?.name || "Unassigned"}</h4>
                  <p className="label-caps text-slate-400 mt-0.5">{mandate.manager?.title || "Property Manager"}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => router.push('/admin/messaging')}
                className="size-8 rounded-full bg-slate-50 hover:bg-slate-100 border border-slate-100 flex items-center justify-center text-slate-600 transition-colors"
                title="Message"
              >
                <IconMessageCircle size={15} />
              </button>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-50 flex flex-col gap-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-medium">Portfolio</span>
                <span className="text-slate-700 font-medium">6 properties</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-medium">On-time collection</span>
                <span className="text-emerald-600 font-medium">94%</span>
              </div>
            </div>
          </Card>

          {/* Property Command Center Card */}
          <Card className="bg-white border border-slate-100 rounded-[24px] overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative">
            <div className="relative h-28 w-full bg-slate-100 flex items-end p-4">
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
            <div className="p-4 flex items-center justify-between gap-3 text-xs bg-white">
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
          </Card>

          {/* Portals Card */}
          <Card className="bg-white border border-slate-100 rounded-[24px] p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
            <h4 className="label-caps text-slate-800 mb-3.5">Portals</h4>
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between text-xs py-1">
                <span className="text-slate-500 font-medium flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-emerald-500" /> Landlord dashboard
                </span>
                <span className="text-emerald-600 font-medium uppercase tracking-wider text-[10px]">Active</span>
              </div>
              <div className="flex items-center justify-between text-xs py-1 border-t border-slate-50 pt-2.5">
                <span className="text-slate-500 font-medium flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-emerald-500" /> Tenant portals
                </span>
                <span className="text-emerald-600 font-medium">
                  {mandate.leases.filter((l) => l.isActive || l.status === "active" || l.status === "expiring").length} / {mandate.unitCount} Active
                </span>
              </div>
              <p className="text-[10px] text-slate-400 leading-normal mt-2">
                Landlords see remittance history and documents; tenants log complaints and view their contract from their own portal.
              </p>
            </div>
          </Card>

          {/* Quick Facts Card */}
          <Card className="bg-white border border-slate-100 rounded-[24px] p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
            <h4 className="label-caps text-slate-800 mb-2.5">Quick Facts</h4>
            <div className="flex items-center justify-between text-xs py-1 border-b border-slate-50">
              <span className="text-slate-400 font-medium">Mandate ref</span>
              <span className="mono-data text-slate-700 font-medium">{mandate.id.slice(0, 8).toUpperCase()}</span>
            </div>
            <div className="flex items-center justify-between text-xs py-1 border-b border-slate-50">
              <span className="text-slate-400 font-medium">Signed</span>
              <span className="mono-data text-slate-700 font-medium">
                {new Date(mandate.startDate).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs py-1 border-b border-slate-50">
              <span className="text-slate-400 font-medium">Property code</span>
              <span className="mono-data text-slate-700 font-medium">{mandate.property.propertyCode}</span>
            </div>
            <div className="flex items-center justify-between text-xs py-1">
              <span className="text-slate-400 font-medium">Next remittance</span>
              <span className="mono-data text-slate-700 font-medium">
                {mandate.endDate ? new Date(mandate.endDate).toLocaleDateString() : "31 Aug 2026"}
              </span>
            </div>
          </Card>
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
        onTerminate={() => { }}
        onEdit={() => { }}
        onRenew={() => { }}
      />

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
    </div>
  );
}
