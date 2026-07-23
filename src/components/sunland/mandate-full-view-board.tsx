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
  IconDotsVertical,
  IconEdit,
  IconExternalLink,
  IconStarFilled,
  IconFileCertificate,
  IconFileText,
  IconHistory,
  IconLink,
  IconBell,
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
  IconChevronLeft,
  IconQrcode,
  IconSearch,
  IconFilter,
  IconMoodEmpty,
} from "@tabler/icons-react";
import { LeaseFormModal, type LeaseEditTarget } from "./lease-form-modal";
import { UnitFormModal } from "./unit-form-modal";
import { LeaseRenewModal, type LeaseRenewTarget } from "./lease-renew-modal";
import { Badge, SkeletonBlock } from "@/components/ui/erp-primitives";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DropdownMenu, DropdownItem } from "@/components/ui/dropdown-menu";
import { useToast } from "@/components/ui/toast-provider";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { MandateFormModal } from "./mandate-form-modal";
import { MandateLetterModal } from "./mandate-letter-modal";
import { MandateOverrideModal } from "./mandate-override-modal";
import { RemittanceAdvicePanel, type RemittanceAdvice } from "./remittance-advice-panel";
import { LeaseDetailDrawer } from "./lease-detail-drawer";
import { PropertyOwnerProfileDrawer } from "./property-owner-profile-drawer";
import { PropertyManagerProfileDrawer } from "./property-manager-profile-drawer";
import { PhotoLightbox } from "./photo-lightbox";
import { PageTransition } from "@/components/shared/page-transition";
import { NotifyUserModal } from "./notify-user-modal";
import { formatCompactKES, formatFileSize } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import type { Property } from "./property-constants";
import type { LeaseSummary, PropertyDocumentSummary } from "./property-detail-types";
import { findMandateLetterDocument, mandateLetterStatus, mandateOriginLabel, MANDATE_LETTER_STATUS_META } from "./mandate-constants";

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
  maintenanceAuthorityKes: string | null;
  renewalType: string | null;
  noticePeriodDays: number | null;
  scopeDescription: string | null;
  landlord: { id: string; name: string; email: string | null; phone: string | null; verifiedAt: string | null; avatarUrl?: string | null; company?: string | null; propertiesUnderMandateCount?: number };
  manager: { id: string; name: string | null; title: string | null; email: string | null; avatarUrl: string | null; assignedPropertyCount?: number; onTimeCollectionPct?: number | null } | null;
  property: { id: string; name: string; propertyCode: string; propertyType: string; location: string; media: Array<{ url: string; alt?: string }> };
  leases: LeaseSummary[];
  documents: PropertyDocumentSummary[];
  collections: Array<{ period: string; expected: number; collected: number }>;
  arrears: { status: "current" | "partial" | "defaulted"; amount: number; daysInArrears: number } | null;
  originValuation: { id: string; valuationCode: string } | null;
}

interface AuditEntry {
  id: string;
  summary: string;
  createdAt: string;
  actorName?: string | null;
}

interface PropertyUnitRow {
  id: string;
  unitLabel: string;
  unitType: string | null;
  monthlyRentKes: string | null;
  status: "vacant" | "occupied" | "reserved" | "maintenance";
  notes: string | null;
  lease: { id: string; tenantContactId: string; tenantName: string; tenantAvatarUrl: string | null; monthlyRentKes: string; endsAt: string } | null;
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
  const [editTermsOpen, setEditTermsOpen] = useState(false);
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
  const [notifyPmOpen, setNotifyPmOpen] = useState(false);
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

  // Advanced Activity State
  const [activitySearchQuery, setActivitySearchQuery] = useState("");
  const [activityFilter, setActivityFilter] = useState("all");
  const [activityPage, setActivityPage] = useState(1);
  const ACTIVITY_PER_PAGE = 10;

  // Remittance History search/filter/pagination (mirrors Activity above)
  const [remittanceSearchQuery, setRemittanceSearchQuery] = useState("");
  const [remittanceStatusFilter, setRemittanceStatusFilter] = useState("all");
  const [remittancePage, setRemittancePage] = useState(1);
  const REMITTANCE_PER_PAGE = 10;

  // Other Documents search/filter/pagination (mirrors Activity above)
  const [docSearchQuery, setDocSearchQuery] = useState("");
  const [docStatusFilter, setDocStatusFilter] = useState("all");
  const [docPage, setDocPage] = useState(1);
  const DOC_PER_PAGE = 10;

  const [leaseModalOpen, setLeaseModalOpen] = useState(false);
  const [editingLease, setEditingLease] = useState<LeaseSummary | null>(null);
  const [renewingLease, setRenewingLease] = useState<LeaseSummary | null>(null);

  // Real property_units rows (replaces the old synthetic padded-list
  // derivation) - lazy-loaded on first visit to the Units & Tenants tab,
  // same convention as activity/remittances above.
  const [units, setUnits] = useState<PropertyUnitRow[]>([]);
  const [unitsLoading, setUnitsLoading] = useState(false);
  const [unitsLoaded, setUnitsLoaded] = useState(false);
  const [unitSearchQuery, setUnitSearchQuery] = useState("");
  const [unitStatusFilter, setUnitStatusFilter] = useState("all");
  const [unitPage, setUnitPage] = useState(1);
  const UNITS_PER_PAGE = 10;
  const [unitFormOpen, setUnitFormOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<PropertyUnitRow | null>(null);
  const [assigningUnit, setAssigningUnit] = useState<PropertyUnitRow | null>(null);
  const [generatingUnits, setGeneratingUnits] = useState(false);

  const occupiedCount = useMemo(() => units.filter((u) => u.status === "occupied").length, [units]);
  const vacantCount = useMemo(() => units.filter((u) => u.status === "vacant").length, [units]);

  const filteredUnits = useMemo(() => {
    let result = units;
    if (unitStatusFilter !== "all") result = result.filter((u) => u.status === unitStatusFilter);
    if (unitSearchQuery.trim()) {
      const q = unitSearchQuery.trim().toLowerCase();
      result = result.filter((u) =>
        u.unitLabel.toLowerCase().includes(q) ||
        (u.unitType ?? "").toLowerCase().includes(q) ||
        (u.lease?.tenantName ?? "").toLowerCase().includes(q)
      );
    }
    return result;
  }, [units, unitStatusFilter, unitSearchQuery]);
  const unitTotalPages = Math.max(1, Math.ceil(filteredUnits.length / UNITS_PER_PAGE));
  const safeUnitPage = Math.min(unitPage, unitTotalPages);
  const paginatedUnits = filteredUnits.slice((safeUnitPage - 1) * UNITS_PER_PAGE, safeUnitPage * UNITS_PER_PAGE);

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

  const loadUnits = () => {
    if (!mandate) return;
    setUnitsLoading(true);
    fetch(`/api/properties/${mandate.property.id}/units?entityId=${entityId || ""}`)
      .then((res) => (res.ok ? res.json() : { units: [] }))
      .then((data) => {
        setUnits(data.units ?? []);
        setUnitsLoaded(true);
      })
      .catch(() => setUnitsLoaded(true))
      .finally(() => setUnitsLoading(false));
  };

  useEffect(() => {
    if (activeTab !== "units" || unitsLoaded || !mandate) return;
    const timer = setTimeout(() => {
      loadUnits();
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, unitsLoaded, mandate?.property.id]);

  const handleGenerateUnits = async () => {
    if (!mandate) return;
    setGeneratingUnits(true);
    try {
      const res = await fetch(`/api/properties/${mandate.property.id}/units/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Failed to generate units");
      pushToast({ tone: "success", title: `Generated ${data.units?.length ?? 0} units` });
      loadUnits();
    } catch (err) {
      pushToast({ tone: "error", title: "Error", body: err instanceof Error ? err.message : "Could not generate units." });
    } finally {
      setGeneratingUnits(false);
    }
  };

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
    const hasMandateLetter = mandateLetterStatus(mandate.documents, mandate.property.id) === "verified";
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

  const filteredActivity = useMemo(() => {
    if (!activityLog) return [];
    let filtered = activityLog;
    if (activitySearchQuery) {
      const q = activitySearchQuery.toLowerCase();
      filtered = filtered.filter(a => a.summary.toLowerCase().includes(q));
    }
    if (activityFilter !== "all") {
      filtered = filtered.filter(a => {
        const lower = a.summary.toLowerCase();
        if (activityFilter === "edits") return lower.includes("updat") || lower.includes("chang") || lower.includes("edit");
        if (activityFilter === "terminations") return lower.includes("terminat") || lower.includes("delet");
        if (activityFilter === "system") return lower.includes("system") || lower.includes("auto");
        return true;
      });
    }
    return filtered;
  }, [activityLog, activitySearchQuery, activityFilter]);

  const activityTotalPages = Math.max(1, Math.ceil(filteredActivity.length / ACTIVITY_PER_PAGE));
  const safeActivityPage = Math.min(activityPage, activityTotalPages);
  const paginatedActivity = filteredActivity.slice((safeActivityPage - 1) * ACTIVITY_PER_PAGE, safeActivityPage * ACTIVITY_PER_PAGE);

  const filteredRemittances = useMemo(() => {
    let filtered = remittances;
    if (remittanceSearchQuery) {
      const q = remittanceSearchQuery.toLowerCase();
      filtered = filtered.filter((r) =>
        new Date(r.periodStart).toLocaleDateString("en-KE", { month: "short", year: "numeric" }).toLowerCase().includes(q) ||
        r.status.toLowerCase().includes(q)
      );
    }
    if (remittanceStatusFilter !== "all") {
      filtered = filtered.filter((r) => r.status === remittanceStatusFilter);
    }
    return filtered;
  }, [remittances, remittanceSearchQuery, remittanceStatusFilter]);

  const remittanceTotalPages = Math.max(1, Math.ceil(filteredRemittances.length / REMITTANCE_PER_PAGE));
  const safeRemittancePage = Math.min(remittancePage, remittanceTotalPages);
  const paginatedRemittances = filteredRemittances.slice((safeRemittancePage - 1) * REMITTANCE_PER_PAGE, safeRemittancePage * REMITTANCE_PER_PAGE);

  const filteredOtherDocs = useMemo(() => {
    const otherDocs = (mandate?.documents ?? []).filter((d) => d.type !== "mandate_letter");
    let filtered = otherDocs;
    if (docSearchQuery) {
      const q = docSearchQuery.toLowerCase();
      filtered = filtered.filter((d) => d.name.toLowerCase().includes(q) || (d.type ?? "").toLowerCase().includes(q));
    }
    if (docStatusFilter !== "all") {
      filtered = filtered.filter((d) => d.status === docStatusFilter);
    }
    return filtered;
  }, [mandate, docSearchQuery, docStatusFilter]);

  const docTotalPages = Math.max(1, Math.ceil(filteredOtherDocs.length / DOC_PER_PAGE));
  const safeDocPage = Math.min(docPage, docTotalPages);
  const paginatedOtherDocs = filteredOtherDocs.slice((safeDocPage - 1) * DOC_PER_PAGE, safeDocPage * DOC_PER_PAGE);

  const getActivityTone = (summary: string) => {
    const lower = summary.toLowerCase();
    if (lower.includes("terminat") || lower.includes("delet") || lower.includes("reject")) return "bg-rose-300 ring-rose-50";
    if (lower.includes("override")) return "bg-amber-400 ring-amber-50";
    if (lower.includes("updat") || lower.includes("chang")) return "bg-indigo-300 ring-indigo-50";
    return "bg-slate-200 ring-white";
  };

  if (isLoading) {
    return (
      <div className="mx-auto flex max-w-[98rem] flex-col gap-6 pb-12">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 px-1 mt-2">
          <div className="flex flex-col gap-2">
            <SkeletonBlock className="h-8 w-72" />
            <SkeletonBlock className="h-4 w-48" />
          </div>
          <SkeletonBlock className="h-9 w-40 rounded-full" />
        </div>
        <SkeletonBlock className="rounded-[28px] min-h-[300px] lg:min-h-[340px] mt-2" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4 mt-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonBlock key={i} className="rounded-2xl h-[150px]" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 lg:gap-3.5 items-start">
          <div className="flex flex-col gap-4 min-w-0">
            <SkeletonBlock className="h-12 w-full rounded-[16px]" />
            <SkeletonBlock className="h-64 w-full rounded-[24px]" />
          </div>
          <div className="flex flex-col gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <SkeletonBlock key={i} className="h-40 w-full rounded-[24px]" />
            ))}
          </div>
        </div>
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
  // Displayed/ring-stroke value is capped at 100 - an uncapped ratio (e.g.
  // from a double-counted payment) would otherwise wrap the SVG stroke
  // around again, which renders indistinguishably from an ordinary full
  // ring instead of surfacing the anomaly.
  const collectionPctDisplay = Math.min(100, collectionPct);

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
      listingType: "let",
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
      pushToast({ tone: "error", title: "Error", body: err instanceof Error ? err.message : "Failed to terminate mandate" });
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
      if (data?.remittance) {
        setSelectedRemittance(data.remittance);
        setRemittancePanelOpen(true);
      } else if (mandate.pendingRemittance) {
        setSelectedRemittance(mandate.pendingRemittance);
        setRemittancePanelOpen(true);
      }
      loadRemittances();
      setRefreshCount((c) => c + 1);
    } catch (err) {
      pushToast({ tone: "error", title: "Error", body: err instanceof Error ? err.message : "Could not generate remittance advice." });
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
    <PageTransition className="mx-auto flex max-w-[98rem] flex-col gap-6 pb-12">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 px-1 mt-2 animate-fade-in-up">
        <div className="flex flex-col gap-2 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="title-serif text-[#151936] text-2xl lg:text-3xl font-normal leading-tight truncate">
              {mandate.property.name}
            </h1>
            {(() => {
              const origin = mandateOriginLabel(mandate.originValuation);
              return origin.href ? (
                <Link href={origin.href}>
                  <Badge tone={origin.tone}>{origin.label}</Badge>
                </Link>
              ) : (
                <Badge tone={origin.tone}>{origin.label}</Badge>
              );
            })()}
          </div>
          <div className="flex items-center gap-3 text-slate-500 text-xs min-w-0 font-medium">
            <span className="flex items-center gap-1.5 min-w-0 text-slate-600">
              <IconMapPin size={15} className="shrink-0 text-slate-500" aria-hidden="true" />
              <span className="truncate">{mandate.property.location}</span>
            </span>
            <span className="text-slate-200 shrink-0">|</span>
            <span className="font-mono text-slate-500 shrink-0 uppercase tracking-wider">
              MANDATE {mandate.id.slice(0, 8).toUpperCase()}
            </span>
          </div>
        </div>

        {/* CTA Actions aligned to the right */}
        <div className="flex items-center gap-2.5 shrink-0 flex-wrap mt-1 sm:mt-0">
          <button
            type="button"
            onClick={handleGenerateRemittance}
            disabled={generatingRemittance}
            className="bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 border border-slate-200/80 font-medium text-xs rounded-xl px-4 py-2 shadow-2xs transition-colors flex items-center gap-1.5"
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
              className="bg-[#151936] text-white hover:bg-[#1a1f42] font-medium text-xs rounded-xl px-4 py-2 shadow-[0_2px_10px_rgb(21,25,54,0.3)] transition-all flex items-center gap-1.5"
            >
              <IconExternalLink size={14} /> Release Payment
            </button>
          )}
          {canManage && canOverrideMandate && (
            <button
              type="button"
              onClick={() => setOverrideModalOpen(true)}
              className="bg-tertiary-gradient text-slate-200 hover:scale-105 transition-all  font-medium text-xs rounded-xl px-4 py-2  flex items-center gap-1.5 border border-slate-200/80"
            >
              <IconBolt size={14} /> Decide Directly
            </button>
          )}
          {canManage && (
            <DropdownMenu
              label="More actions"
              align="right"
              trigger={
                <div className="inline-flex size-[36px] items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-2xs cursor-pointer">
                  <IconDotsVertical size={16} />
                </div>
              }
            >
              <DropdownItem icon={IconLink} onClick={handleCopyLink}>Copy deep link</DropdownItem>
              {mandate.manager && (
                <DropdownItem icon={IconBell} onClick={() => setNotifyPmOpen(true)}>Notify Property Manager</DropdownItem>
              )}
              <DropdownItem icon={IconBell} disabled title="Available once the landlord portal launches">Notify Landlord</DropdownItem>
              {(mandate.status === "active" || mandate.status === "pending_approval") && (
                <DropdownItem icon={IconTrash} variant="danger" onClick={() => setTerminateOpen(true)}>Terminate mandate</DropdownItem>
              )}
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* ── Flagship Mandate Hero Deck with Side Gallery ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5 items-stretch">
        {/* Main Hero Card */}
        <div
          onClick={() => {
            if (mediaList.length > 0) {
              setLightboxIndex(activeMediaIndex);
              setLightboxOpen(true);
            }
          }}
          className={cn(
            "group relative rounded-[32px] overflow-hidden min-h-[360px] lg:min-h-[410px] shadow-[0_12px_40px_rgb(0,0,0,0.06)] bg-[#0c0f20] text-white flex flex-col justify-between p-6 lg:p-8 border border-slate-800 transition-all duration-500 hover:shadow-[0_20px_50px_rgb(0,0,0,0.14)] text-left w-full",
            mediaList.length > 1 ? "lg:col-span-8" : "lg:col-span-12",
            mediaList.length > 0 ? "cursor-pointer" : "cursor-default"
          )}
        >
          {primaryImage ? (
            <Image
              src={primaryImage}
              alt={mandate.property.name}
              fill
              sizes="(max-width: 1024px) 100vw, 65vw"
              className="object-cover absolute inset-0 transition-transform duration-700 group-hover:scale-103 opacity-75"
              priority
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-[#0c0f20] via-[#151936] to-slate-900" />
          )}

          {/* Premium Gradient Scrim */}
          <div
            className="absolute inset-0 z-0 bg-gradient-to-t from-[#090d1a] via-[#090d1a]/55 to-black/35"
            aria-hidden="true"
          />

          {/* Gallery Hover Chip */}
          {mediaList.length > 0 && (
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/15 transition-colors duration-500 flex items-center justify-center z-0">
              <span className="opacity-0 group-hover:opacity-100 transition-all duration-500 transform translate-y-4 group-hover:translate-y-0 bg-white/95 backdrop-blur-md text-[#151936] font-medium px-5 py-2.5 rounded-full shadow-lg flex items-center gap-2 text-xs border border-white/20 uppercase tracking-wider">
                <IconPhoto size={14} aria-hidden="true" /> View All {mediaList.length} photos
              </span>
            </div>
          )}

          {/* Top Floating Header Controls */}
          <div className="relative z-10 flex justify-between items-start w-full gap-4">
            <span className="bg-[#f3df27] text-[#151936] px-3.5 py-1.5 rounded-full text-xxs font-mono font-medium tracking-wider flex items-center gap-1.5 shadow-sm shrink-0 uppercase">
              <IconStarFilled size={13} /> FLAGSHIP MANDATE
            </span>

            <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
              <span className="bg-black/50 font-mono backdrop-blur-md border border-white/15 px-3.5 py-1.5 rounded-full text-xxs font-medium uppercase tracking-wider text-white">
                {(MANDATE_STATUS_LABEL[mandate.status] ?? mandate.status).toUpperCase()} · {(mandate.mandateRate * 100).toFixed(1)}% FEE
              </span>
            </div>
          </div>

          {/* Middle Stakeholders Strip */}
          <div className="relative z-10 flex flex-wrap items-center gap-2.5 my-auto pt-6" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setOwnerDrawerOpen(true)}
              className="bg-black/50 hover:bg-black/70 backdrop-blur-md px-3.5 py-1.5 rounded-full flex items-center gap-2.5 border border-white/15 transition-all cursor-pointer text-left shadow-sm group/landlord"
            >
              <Avatar
                src={mandate.landlord.avatarUrl || undefined}
                fallback={getInitials(mandate.landlord.name)}
                className="size-7 bg-white text-slate-800 text-xs font-medium border border-slate-200 shadow-2xs"
              />
              <div className="text-left leading-none">
                <p className="text-xs font-medium text-white group-hover/landlord:underline">{mandate.landlord.name}</p>
                <span className="text-xxs uppercase tracking-wider text-slate-300 font-mono block mt-0.5">Landlord</span>
              </div>
            </button>

            {mandate.manager && (
              <button
                type="button"
                onClick={() => setManagerDrawerOpen(true)}
                className="bg-black/50 hover:bg-black/70 backdrop-blur-md px-3.5 py-1.5 rounded-full flex items-center gap-2.5 border border-white/15 transition-all cursor-pointer text-left shadow-sm group/pm"
              >
                <Avatar
                  src={mandate.manager.avatarUrl || undefined}
                  fallback={getInitials(mandate.manager.name || "Unassigned")}
                  className="size-7 bg-[#151936] text-white text-xs font-medium border border-white/20 shadow-2xs"
                />
                <div className="text-left leading-none">
                  <p className="text-xs font-medium text-white group-hover/pm:underline">{mandate.manager.name}</p>
                  <span className="text-xxs uppercase tracking-wider text-slate-300 font-mono block mt-0.5">Property Manager</span>
                </div>
              </button>
            )}
          </div>

          {/* Bottom Financial & Progress Deck */}
          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 items-end w-full pt-4 border-t border-white/15 mt-4">
            {/* Left Financial Headline */}
            <div className="lg:col-span-6 flex flex-col gap-1" onClick={(e) => e.stopPropagation()}>
              <span className="text-xxs font-medium uppercase tracking-wider text-slate-300 font-mono">
                Remittance Due to Landlord
              </span>
              <div className="flex items-baseline gap-3 flex-wrap">
                <span className="font-mono text-2xl lg:text-3xl font-medium tracking-tight text-white">
                  {formatCompactKES(remittanceDue)}
                </span>
                <Link
                  href={`/admin/properties/${mandate.property.id}`}
                  className="bg-white/15 hover:bg-white/25 text-white border border-white/20 font-medium text-xs rounded-xl px-3.5 py-1.5 transition-all flex items-center gap-1.5 backdrop-blur-md shadow-xs shrink-0"
                >
                  View Property <IconArrowUpRight size={13} />
                </Link>
              </div>
            </div>

            {/* Right Collection Gauge Card */}
            <div className="lg:col-span-6 flex flex-col gap-2 bg-black/40 backdrop-blur-md p-3.5 rounded-2xl border border-white/15 shadow-sm" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between text-xs">
                <span className="text-xxs font-mono uppercase tracking-wider text-slate-300">Collection MTD ({currentMonthName})</span>
                <span className="font-mono text-xs font-medium text-white">{collectionPctDisplay}% Collected</span>
              </div>
              <div className="h-2 w-full bg-white/15 rounded-full overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all duration-500", collectionPct >= 90 ? "bg-emerald-400" : collectionPct >= 50 ? "bg-[#f3df27]" : "bg-rose-400")}
                  style={{ width: `${Math.min(100, collectionPct)}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-xxs font-mono text-slate-300">
                <span>{formatCompactKES(collectedAmount)} collected</span>
                <span>Target: {formatCompactKES(expectedAmount)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Side Media Gallery Cards Column */}
        {mediaList.length > 1 && (
          <div className="lg:col-span-4 flex flex-col sm:flex-row lg:flex-col gap-4 h-full">
            {mediaList.slice(1, 3).map((media, idx) => {
              const actualIndex = idx + 1;
              const isLastVisible = idx === 1 && mediaList.length > 3;
              const remainingCount = mediaList.length - 3;

              return (
                <div
                  key={actualIndex}
                  onClick={() => {
                    setLightboxIndex(actualIndex);
                    setLightboxOpen(true);
                  }}
                  className="group/side relative rounded-[28px] overflow-hidden bg-slate-900 border border-slate-800/80 shadow-sm flex-1 min-h-[170px] cursor-pointer hover:border-slate-400 transition-all duration-300"
                >
                  {media.url ? (
                    <Image
                      src={media.url}
                      alt={media.alt || `Property photo ${actualIndex + 1}`}
                      fill
                      sizes="(max-width: 1024px) 50vw, 35vw"
                      className="object-cover transition-transform duration-500 group-hover/side:scale-105"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-slate-800 flex items-center justify-center text-slate-500">
                      <IconBuildingCommunity size={28} />
                    </div>
                  )}

                  {/* Gradient Scrim */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />

                  {/* Overlay Badges */}
                  <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between z-10">
                    <span className="text-xxs font-mono text-white/90 bg-black/50 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10 uppercase tracking-wider">
                      Photo {actualIndex + 1}
                    </span>

                    {isLastVisible && (
                      <span className="bg-[#151936] backdrop-blur-md text-[#f3df27] font-medium text-xs px-3 py-1.5 rounded-full border border-amber-300/30 shadow-md flex items-center gap-1.5">
                        <IconPhoto size={13} /> +{remainingCount} more
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
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
              "gsap-stagger relative overflow-hidden rounded-2xl border p-5 flex flex-col justify-between group shadow-sm hover:shadow-md hover:border-slate-300 transition-all duration-300 h-[150px] text-left cursor-pointer focus:outline-hidden",
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
                <span className={cn("font-mono font-medium text-2xl font-medium mt-1 leading-none", VITAL_TONE_VALUE[v.tone])}>
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
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-title-primary">Mandate terms</h3>
                  {canManage && (
                    <button
                      type="button"
                      onClick={() => setEditTermsOpen(true)}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 transition-colors"
                    >
                      <IconEdit size={14} /> Edit terms
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
                    <p className={cn("mono-amount", mandate.maintenanceAuthorityKes ? "text-slate-900" : "text-slate-400 italic")}>
                      {mandate.maintenanceAuthorityKes ? `≤ ${formatCompactKES(parseFloat(mandate.maintenanceAuthorityKes))}` : "Not yet configured"}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1.5 p-4 rounded-xl bg-slate-50/50 border border-slate-100">
                    <p className="label-caps text-slate-600">Term</p>
                    <p className="mono-amount text-slate-900">{termMonths}</p>
                  </div>
                  <div className="flex flex-col gap-1.5 p-4 rounded-xl bg-slate-50/50 border border-slate-100">
                    <p className="label-caps text-slate-600">Renewal</p>
                    <p className={cn("body-md font-medium", mandate.renewalType ? "text-slate-800" : "text-slate-400 italic")}>
                      {mandate.renewalType ? mandate.renewalType.charAt(0).toUpperCase() + mandate.renewalType.slice(1) : "Not yet configured"}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1.5 p-4 rounded-xl bg-slate-50/50 border border-slate-100">
                    <p className="label-caps text-slate-600">Notice Period</p>
                    <p className={cn("mono-amount", mandate.noticePeriodDays != null ? "text-slate-900" : "text-slate-400 italic")}>
                      {mandate.noticePeriodDays != null ? `${mandate.noticePeriodDays} days` : "Not yet configured"}
                    </p>
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
                {mandate.scopeDescription ? (
                  <p className="body-md text-slate-600 leading-relaxed">{mandate.scopeDescription}</p>
                ) : (
                  <p className="body-md text-slate-600 leading-relaxed">
                    Sunland manages rent collection and remittance for the {mandate.unitCount} unit{mandate.unitCount === 1 ? "" : "s"} at {mandate.property.name}, remitting collected rent to the landlord net of a {(mandate.mandateRate * 100).toFixed(1)}% management fee{mandate.rateJustification ? ` (${mandate.rateJustification})` : ""}.
                  </p>
                )}
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
                <div className="bg-white border border-slate-100 rounded-[24px] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
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
                      <span className="font-mono font-medium text-sm font-normal text-slate-900">{formatCompactKES(period.collectedAmount)}</span>
                    </div>
                    <div className="flex items-center justify-between py-3 border-b border-slate-100/50">
                      <div className="flex items-center gap-2">
                        <span className="size-2.5 rounded-full bg-[#f3df27]" />
                        <span className="text-xs text-slate-600 font-medium uppercase tracking-wide">Less management fee — Sunland revenue</span>
                      </div>
                      <span className="font-mono font-medium text-sm font-normal text-[#b49818]">- {formatCompactKES(period.managementFee)}</span>
                    </div>
                    <div className="flex items-center justify-between py-3 border-b border-slate-100/50">
                      <div className="flex items-center gap-2">
                        <span className="size-2.5 rounded-full bg-slate-400" />
                        <span className="text-xs text-slate-600 font-medium uppercase tracking-wide">Less approved expenses</span>
                      </div>
                      <span className="font-mono font-medium text-sm font-normal text-slate-500">- {formatCompactKES(period.expenses)}</span>
                    </div>
                    <div className="flex items-center justify-between py-3">
                      <div className="flex items-center gap-2">
                        <span className="size-2.5 rounded-full bg-[#122a20]" />
                        <span className="text-xs text-slate-800 font-normal uppercase tracking-wide">Landlord remittance due</span>
                      </div>
                      <span className="font-mono font-medium text-lg font-medium text-[#122a20]">{formatCompactKES(period.landlordRemittance)}</span>
                    </div>
                  </div>
                </div>
              )}

              {mandate.collections.length > 0 && (
                <div className="bg-white border border-slate-100 rounded-[24px] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
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

              <div className="bg-white border border-slate-100 rounded-[24px] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col gap-4">
                <h3 className="text-title-primary">Remittance History</h3>
                {remittances.length === 0 ? (
                  <p className="text-slate-600 text-center py-8 text-sm bg-slate-50 rounded-2xl border border-slate-100 border-dashed">No remittance advices generated yet.</p>
                ) : (
                  <>
                    {/* Search + status filter */}
                    <div className="flex flex-wrap items-center gap-2.5">
                      <div className="relative flex-1 min-w-[200px]">
                        <IconSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        <input
                          value={remittanceSearchQuery}
                          onChange={(e) => { setRemittanceSearchQuery(e.target.value); setRemittancePage(1); }}
                          placeholder="Search by period or status..."
                          className="w-full h-9 rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm focus:outline-none focus:border-[#151936]/40 transition-colors shadow-sm"
                        />
                      </div>
                      <div className="relative shrink-0">
                        <IconFilter size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        <select
                          value={remittanceStatusFilter}
                          onChange={(e) => { setRemittanceStatusFilter(e.target.value); setRemittancePage(1); }}
                          className="h-9 rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-sm focus:outline-none focus:border-[#151936]/40 transition-colors shadow-sm appearance-none"
                        >
                          <option value="all">All statuses</option>
                          <option value="pending">Pending</option>
                          <option value="released">Released</option>
                          <option value="flagged">Flagged</option>
                        </select>
                      </div>
                    </div>

                    {paginatedRemittances.length === 0 ? (
                      <div className="p-8 text-center text-slate-400 text-sm">No remittances match this search/filter.</div>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {paginatedRemittances.map((r) => (
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
                            <span className="font-mono font-medium text-slate-900">{formatCompactKES(Number(r.netRemittanceKes))}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Pagination Controls */}
                    {remittanceTotalPages > 1 && (
                      <div className="flex items-center justify-between pt-4 mt-1 border-t border-slate-100">
                        <span className="text-xs font-medium text-slate-400 bg-slate-50 px-3 py-1 rounded-md border border-slate-100">
                          Page {safeRemittancePage} of {remittanceTotalPages} <span className="mx-1">·</span> {filteredRemittances.length} remittances
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setRemittancePage(Math.max(1, safeRemittancePage - 1))}
                            disabled={safeRemittancePage <= 1}
                            className="size-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 disabled:text-slate-200 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
                          >
                            <IconChevronLeft size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setRemittancePage(Math.min(remittanceTotalPages, safeRemittancePage + 1))}
                            disabled={safeRemittancePage >= remittanceTotalPages}
                            className="size-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 disabled:text-slate-200 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
                          >
                            <IconChevronRight size={15} />
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {activeTab === "units" && (
            <div className="bg-white border border-slate-100 rounded-[24px] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col gap-4">
              <div className="flex flex-wrap justify-between items-center gap-3 mb-2">
                <h3 className="text-title-primary">Units under this mandate</h3>
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-xs text-slate-500 font-medium whitespace-nowrap">
                    {occupiedCount} occupied · {vacantCount} vacant
                  </span>
                  {canManage && units.length > 0 && (
                    <button
                      type="button"
                      onClick={() => { setEditingUnit(null); setUnitFormOpen(true); }}
                      className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-medium rounded-xl px-4 py-2 shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <IconEdit size={13} /> Add Unit
                    </button>
                  )}
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

              {unitsLoading ? (
                <div className="flex justify-center py-12"><LoadingSpinner size="md" /></div>
              ) : units.length === 0 ? (
                <div className="p-10 text-center flex flex-col items-center gap-3">
                  <p className="text-slate-500 text-sm">No units recorded for this property yet.</p>
                  {canManage && mandate.unitCount > 1 && (
                    <button
                      type="button"
                      onClick={handleGenerateUnits}
                      disabled={generatingUnits}
                      className="bg-[#151936] text-white hover:bg-[#1f254e] text-xs font-medium rounded-xl px-4 py-2 shadow-sm transition-all"
                    >
                      {generatingUnits ? "Generating…" : "Generate Units from Breakdown"}
                    </button>
                  )}
                </div>
              ) : (
                <>
                  {/* Search + status filter */}
                  <div className="flex flex-wrap items-center gap-2.5 mb-1">
                    <div className="relative flex-1 min-w-[200px]">
                      <IconSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      <input
                        value={unitSearchQuery}
                        onChange={(e) => { setUnitSearchQuery(e.target.value); setUnitPage(1); }}
                        placeholder="Search unit, type, or tenant..."
                        className="w-full h-9 rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm focus:outline-none focus:border-[#151936]/40 transition-colors shadow-sm"
                      />
                    </div>
                    <div className="relative shrink-0">
                      <IconFilter size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      <select
                        value={unitStatusFilter}
                        onChange={(e) => { setUnitStatusFilter(e.target.value); setUnitPage(1); }}
                        className="h-9 rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-sm focus:outline-none focus:border-[#151936]/40 transition-colors shadow-sm appearance-none"
                      >
                        <option value="all">All statuses</option>
                        <option value="vacant">Vacant</option>
                        <option value="occupied">Occupied</option>
                        <option value="reserved">Reserved</option>
                        <option value="maintenance">Maintenance</option>
                      </select>
                    </div>
                  </div>

                  {paginatedUnits.length === 0 ? (
                    <div className="p-10 text-center text-slate-400 text-sm">No units match this search/filter.</div>
                  ) : (
                    <>
                      {/* Mobile: stacked cards - a dense 6-column grid doesn't decard
                          well below sm, so it gets its own simplified layout instead
                          of relying on horizontal scroll. */}
                      <div className="flex flex-col gap-2 sm:hidden">
                        {paginatedUnits.map((unit) => (
                          <div key={unit.id} className="rounded-2xl border border-slate-100 p-4 flex flex-col gap-3">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-mono font-medium text-slate-900">{unit.unitLabel}</span>
                              <Badge
                                tone={
                                  unit.status === "occupied" ? "success" :
                                    unit.status === "reserved" ? "warning" :
                                      unit.status === "maintenance" ? "risk" :
                                        "neutral"
                                }
                              >
                                {unit.status}
                              </Badge>
                            </div>
                            {unit.lease ? (
                              <button
                                type="button"
                                onClick={() => router.push(`/admin/leases/${unit.lease!.id}`)}
                                className="flex items-center gap-2.5 min-w-0 text-left"
                              >
                                <Avatar
                                  src={unit.lease.tenantAvatarUrl || undefined}
                                  fallback={getInitials(unit.lease.tenantName)}
                                  className="size-8 bg-slate-100 text-slate-800 text-xs font-normal shrink-0"
                                />
                                <span className="text-slate-800 font-medium truncate text-sm">{unit.lease.tenantName}</span>
                              </button>
                            ) : (
                              <span className="flex items-center gap-2.5 min-w-0">
                                <span className="size-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 border border-slate-100 font-mono text-xxs font-normal shrink-0">—</span>
                                <span className="text-slate-400 font-medium text-sm">No tenant assigned</span>
                              </span>
                            )}
                            <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-50">
                              <span className="text-slate-500">{unit.unitType || "—"}</span>
                              <span className={cn("font-mono", unit.monthlyRentKes ? "text-slate-600" : "text-slate-400")}>
                                {unit.monthlyRentKes ? `${formatCompactKES(parseFloat(unit.monthlyRentKes))}/mo` : "—"}
                              </span>
                            </div>
                            {canManage && (
                              <div className="flex justify-end gap-1.5">
                                {unit.status === "vacant" && (
                                  <button
                                    type="button"
                                    onClick={() => setAssigningUnit(unit)}
                                    className="h-8 px-3 rounded-lg border border-slate-200 flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors"
                                  >
                                    <IconUsers size={13} /> Assign
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => { setEditingUnit(unit); setUnitFormOpen(true); }}
                                  className="h-8 px-3 rounded-lg border border-slate-200 flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors"
                                >
                                  <IconEdit size={13} /> Edit
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Desktop/tablet: dense grid */}
                      <div className="hidden sm:flex sm:flex-col overflow-x-auto" style={scrollHiddenStyle}>
                        <div className="grid grid-cols-[90px_1.2fr_1fr_110px_110px_80px] items-center px-4 py-2.5 bg-slate-50/50 rounded-xl text-xxs font-medium uppercase tracking-wider text-slate-500 mb-2 border border-slate-100/60 min-w-[720px]">
                          <div>Unit</div>
                          <div>Tenant</div>
                          <div>Type</div>
                          <div>Rent</div>
                          <div>Status</div>
                          <div className="text-right">Actions</div>
                        </div>

                        <div className="flex flex-col gap-0.5 min-w-[720px]">
                          {paginatedUnits.map((unit) => (
                            <div
                              key={unit.id}
                              className="grid grid-cols-[90px_1.2fr_1fr_110px_110px_80px] items-center py-3 px-4 hover:bg-slate-50/60 rounded-2xl transition-colors text-sm group"
                            >
                              <span className="font-mono font-normal text-slate-900 truncate">{unit.unitLabel}</span>
                              {unit.lease ? (
                                <button
                                  type="button"
                                  onClick={() => router.push(`/admin/leases/${unit.lease!.id}`)}
                                  className="flex items-center gap-2.5 min-w-0 text-left hover:opacity-80 transition-opacity"
                                >
                                  <Avatar
                                    src={unit.lease.tenantAvatarUrl || undefined}
                                    fallback={getInitials(unit.lease.tenantName)}
                                    className="size-7 bg-slate-100 text-slate-800 text-xs font-normal shrink-0"
                                  />
                                  <span className="text-slate-800 font-medium truncate">{unit.lease.tenantName}</span>
                                </button>
                              ) : (
                                <span className="flex items-center gap-2.5 min-w-0">
                                  <span className="size-7 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 border border-slate-100 font-mono text-xxs font-normal shrink-0">—</span>
                                  <span className="text-slate-400 font-medium">—</span>
                                </span>
                              )}
                              <span className="text-slate-500 text-xs truncate pr-2">{unit.unitType || "—"}</span>
                              <span className={cn("font-mono", unit.monthlyRentKes ? "text-slate-600" : "text-slate-400")}>
                                {unit.monthlyRentKes ? `${formatCompactKES(parseFloat(unit.monthlyRentKes))}/mo` : "—"}
                              </span>
                              <div>
                                <Badge
                                  tone={
                                    unit.status === "occupied" ? "success" :
                                      unit.status === "reserved" ? "warning" :
                                        unit.status === "maintenance" ? "risk" :
                                          "neutral"
                                  }
                                >
                                  {unit.status}
                                </Badge>
                              </div>
                              <div className="flex justify-end gap-1.5">
                                {canManage && unit.status === "vacant" && (
                                  <button
                                    type="button"
                                    onClick={() => setAssigningUnit(unit)}
                                    title="Assign tenant"
                                    className="size-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition-colors"
                                  >
                                    <IconUsers size={13} />
                                  </button>
                                )}
                                {canManage && (
                                  <button
                                    type="button"
                                    onClick={() => { setEditingUnit(unit); setUnitFormOpen(true); }}
                                    title="Edit unit"
                                    className="size-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition-colors"
                                  >
                                    <IconEdit size={13} />
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  {unitTotalPages > 1 && (
                    <div className="flex items-center justify-between pt-2">
                      <span className="text-xs text-slate-400">Page {safeUnitPage} of {unitTotalPages}</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setUnitPage((p) => Math.max(1, p - 1))}
                          disabled={safeUnitPage === 1}
                          className="size-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <IconChevronLeft size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setUnitPage((p) => Math.min(unitTotalPages, p + 1))}
                          disabled={safeUnitPage === unitTotalPages}
                          className="size-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <IconChevronRight size={14} />
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {activeTab === "documents" && (() => {
            const mandateLetterDoc = findMandateLetterDocument(mandate.documents, mandate.property.id);
            const hasAnyOtherDocs = mandate.documents.some((d) => d.type !== "mandate_letter");
            const letterStatus = mandateLetterStatus(mandate.documents, mandate.property.id);
            const letterStatusMeta = MANDATE_LETTER_STATUS_META[letterStatus];
            return (
              <div className="flex flex-col gap-4">
                {/* Mandate Letter Card */}
                <div className="bg-white border border-slate-100 rounded-[24px] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                  <div className="flex items-center justify-between gap-3 mb-1.5">
                    <span className="text-xs font-medium uppercase tracking-wider text-slate-400 font-mono block">Mandate Letter</span>
                    <Badge tone={letterStatusMeta.tone}>{letterStatusMeta.label}</Badge>
                  </div>
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
                              {[
                                formatFileSize(mandateLetterDoc.fileSizeBytes),
                                mandateLetterDoc.createdAt
                                  ? `added ${new Date(mandateLetterDoc.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`
                                  : null,
                              ].filter(Boolean).join(" · ") || "Details not on file"}
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
                        <span className="text-xxs text-slate-400 font-medium uppercase tracking-wide text-center leading-tight">Scan to view live copy</span>
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
                <div className="bg-white border border-slate-100 rounded-[24px] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col gap-4">
                  <h3 className="text-title-primary">Other documents</h3>
                  {!hasAnyOtherDocs ? (
                    <p className="text-slate-500 text-center py-10 text-xs bg-slate-50 rounded-2xl border border-slate-100 border-dashed">No other documents attached yet.</p>
                  ) : (
                    <>
                      {/* Search + status filter */}
                      <div className="flex flex-wrap items-center gap-2.5">
                        <div className="relative flex-1 min-w-[200px]">
                          <IconSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                          <input
                            value={docSearchQuery}
                            onChange={(e) => { setDocSearchQuery(e.target.value); setDocPage(1); }}
                            placeholder="Search documents by name or type..."
                            className="w-full h-9 rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm focus:outline-none focus:border-[#151936]/40 transition-colors shadow-sm"
                          />
                        </div>
                        <div className="relative shrink-0">
                          <IconFilter size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                          <select
                            value={docStatusFilter}
                            onChange={(e) => { setDocStatusFilter(e.target.value); setDocPage(1); }}
                            className="h-9 rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-sm focus:outline-none focus:border-[#151936]/40 transition-colors shadow-sm appearance-none"
                          >
                            <option value="all">All statuses</option>
                            <option value="draft">Draft</option>
                            <option value="awaiting_signature">Awaiting signature</option>
                            <option value="signed">Signed</option>
                          </select>
                        </div>
                      </div>

                      {paginatedOtherDocs.length === 0 ? (
                        <div className="p-10 text-center text-slate-400 text-sm">No documents match this search/filter.</div>
                      ) : (
                        <div className="flex flex-col gap-2">
                          {paginatedOtherDocs.map((doc) => {
                            const isSigned = doc.status === "signed" || (doc.type && ["mandate_letter", "lease_agreement", "offer_letter"].includes(doc.type));
                            const statusLabel = doc.status === "signed" ? "SIGNED" : doc.status === "awaiting_signature" ? "AWAITING SIGNATURE" : "FILED";
                            const sizeLabel = formatFileSize(doc.fileSizeBytes);
                            const addedLabel = doc.createdAt
                              ? `added ${new Date(doc.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`
                              : null;
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
                                    <p className="text-xs text-slate-400 mt-0.5 font-mono">
                                      {[sizeLabel, addedLabel].filter(Boolean).join(" · ") || "Details not on file"}
                                    </p>
                                  </div>
                                </div>
                                <div>
                                  <Badge tone={isSigned ? "success" : "neutral"}>
                                    {statusLabel}
                                  </Badge>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Pagination Controls */}
                      {docTotalPages > 1 && (
                        <div className="flex items-center justify-between pt-4 mt-1 border-t border-slate-100">
                          <span className="text-xs font-medium text-slate-400 bg-slate-50 px-3 py-1 rounded-md border border-slate-100">
                            Page {safeDocPage} of {docTotalPages} <span className="mx-1">·</span> {filteredOtherDocs.length} documents
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setDocPage(Math.max(1, safeDocPage - 1))}
                              disabled={safeDocPage <= 1}
                              className="size-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 disabled:text-slate-200 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
                            >
                              <IconChevronLeft size={15} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDocPage(Math.min(docTotalPages, safeDocPage + 1))}
                              disabled={safeDocPage >= docTotalPages}
                              className="size-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 disabled:text-slate-200 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
                            >
                              <IconChevronRight size={15} />
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })()}

          {activeTab === "activity" && (
            <div className="bg-white border border-slate-100 rounded-[24px] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
              <div className="flex flex-col gap-5 mb-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-slate-800">Activity log</h3>
                </div>

                {/* Advanced Search & Filter Bar */}
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
                      <option value="edits">Modifications</option>
                      <option value="terminations">Terminations</option>
                      <option value="system">System Actions</option>
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                      <IconChevronRight size={14} className="text-slate-400 rotate-90" />
                    </div>
                  </div>
                </div>
              </div>

              {activityLoading ? (
                <div className="flex justify-center py-12">
                  <LoadingSpinner size="md" />
                </div>
              ) : !activityLog || activityLog.length === 0 ? (
                <div className="flex flex-col items-center text-center gap-4 py-12 bg-slate-50 rounded-2xl border border-slate-100 border-dashed">
                  <div className="size-16 rounded-2xl bg-white border border-slate-100 flex items-center justify-center mb-1">
                    <IconMoodEmpty size={32} className="text-slate-300" />
                  </div>
                  <h3 className="text-sm font-medium text-slate-700">No recorded activity yet.</h3>
                  <p className="text-slate-400 max-w-sm text-xs">Status changes, edits, and mandate events will safely log here.</p>
                </div>
              ) : paginatedActivity.length === 0 ? (
                <div className="flex flex-col items-center py-12 text-center">
                  <IconSearch size={24} className="text-slate-300 mb-3" />
                  <p className="text-sm font-medium text-slate-700">No logs match your filter</p>
                  <p className="text-xs text-slate-400 mt-1">Try adjusting the search query or dropdown.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-6 relative ml-1">
                  <div className="absolute left-[3.5px] top-2 bottom-6 w-px bg-slate-200 z-0" />
                  {paginatedActivity.map((entry) => {
                    const toneColor = getActivityTone(entry.summary);
                    return (
                      <div key={entry.id} className="relative flex items-start lg:items-center gap-4 z-10 group">
                        <div className={cn("size-[8px] rounded-full mt-1.5 lg:mt-0 shrink-0 ring-4 shadow-xs", toneColor)} />
                        <div className="flex-1 min-w-0 flex flex-col lg:flex-row lg:items-center justify-between gap-2 lg:gap-6 bg-slate-50/50 hover:bg-slate-100/50 -my-1.5 -mx-3 p-2 px-3 rounded-xl transition-colors">
                          <p className="text-sm text-slate-500 leading-snug group-hover:text-slate-700 transition-colors flex-1 min-w-0 pr-4">
                            {entry.actorName ? (
                              <>
                                <span className="font-medium text-slate-700">{entry.actorName}</span> {entry.summary.replace(entry.actorName, "").replace(/^ - |^ — /, "").trim()}
                              </>
                            ) : (
                              entry.summary
                            )}
                          </p>
                          <div className="flex items-center gap-3 shrink-0">
                            <p className="text-xs text-slate-400 font-mono tracking-wider hidden lg:block">
                              {new Date(entry.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}, {new Date(entry.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                            <Badge tone="neutral" className="whitespace-nowrap">
                              {relativeTime(entry.createdAt)}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Pagination Controls */}
              {activityTotalPages > 1 && (
                <div className="flex items-center justify-between pt-6 mt-6 border-t border-slate-100">
                  <span className="text-xs font-medium text-slate-400 bg-slate-50 px-3 py-1 rounded-md border border-slate-100">
                    Page {safeActivityPage} of {activityTotalPages} <span className="mx-1">·</span> {filteredActivity.length} logs
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
          )}
        </div>

        {/* Context rail */}
        <div className="flex flex-col gap-4">
          {/* Landlord div */}
          <div className="gsap-stagger bg-white border border-slate-100 rounded-[24px] overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
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
                {mandate.landlord.verifiedAt ? (
                  <span className="text-xs text-slate-200/90 flex items-center justify-center gap-1 mt-1 font-medium">
                    <IconShieldCheck size={14} className="text-emerald-400" /> Verified landlord
                  </span>
                ) : (
                  <span className="text-xs text-slate-300/80 flex items-center justify-center gap-1 mt-1 font-medium">Landlord</span>
                )}
              </div>

              {/* Buttons at the bottom */}
              <div className="relative z-10 flex justify-center gap-3 mb-1">
                <button
                  type="button"
                  onClick={() => router.push('/admin/messages')}
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

              {/* Entity - only shown when the landlord actually has a company name on file */}
              {mandate.landlord.company && (
                <div className="flex items-center justify-between p-1.5 bg-white border border-slate-100/80 rounded-full shadow-xs">
                  <div className="flex items-center min-w-0">
                    <span className="size-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-600 shrink-0 border border-slate-100/50">
                      <IconBuildingCommunity size={14} />
                    </span>
                    <span className="text-xs font-medium text-slate-600 ml-2.5">Entity</span>
                  </div>
                  <span className="text-xs font-medium text-slate-700 pr-3 truncate max-w-[160px]">
                    {mandate.landlord.company}
                  </span>
                </div>
              )}

              {/* Properties */}
              <div className="flex items-center justify-between p-1.5 bg-white border border-slate-100/80 rounded-full shadow-xs">
                <div className="flex items-center min-w-0">
                  <span className="size-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-600 shrink-0 border border-slate-100/50">
                    <IconMapPin size={14} />
                  </span>
                  <span className="text-xs font-medium text-slate-600 ml-2.5">Properties</span>
                </div>
                <span className="text-xs font-medium text-slate-700 pr-3">
                  {mandate.landlord.propertiesUnderMandateCount ?? 0} under mandate
                </span>
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
          <div className="gsap-stagger bg-white border border-slate-100 rounded-[24px] p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col gap-4">
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
                onClick={() => router.push('/admin/messages')}
                className="size-10 rounded-full bg-white hover:bg-slate-50 border border-slate-200/80 flex items-center justify-center text-slate-600 shadow-xs transition-colors"
                title="Message"
              >
                <IconMessageCircle size={16} />
              </button>
            </div>

            {mandate.manager && (
              <>
                <div className="flex flex-col gap-2.5 border-t border-slate-100 pt-4">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-600 font-medium">Portfolio</span>
                    <span className="font-mono font-medium text-slate-800">{mandate.manager.assignedPropertyCount ?? 0} properties</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-600 font-medium">On-time collection</span>
                    <span className={cn("font-mono font-medium", mandate.manager.onTimeCollectionPct == null ? "text-slate-400" : mandate.manager.onTimeCollectionPct >= 90 ? "text-emerald-600" : mandate.manager.onTimeCollectionPct >= 70 ? "text-amber-600" : "text-rose-600")}>
                      {mandate.manager.onTimeCollectionPct == null ? "—" : `${mandate.manager.onTimeCollectionPct}%`}
                    </span>
                  </div>
                </div>
                <Link
                  href={`/admin/team/${mandate.manager.id}`}
                  className="inline-flex items-center justify-center gap-2 w-full rounded-full bg-white border border-slate-200/80 py-2.5 label-caps text-slate-700 hover:bg-slate-50 transition-colors text-xs font-medium shadow-xs"
                >
                  View Full Profile
                </Link>
              </>
            )}
          </div>

          {/* Property Command Center div */}
          <div className="gsap-stagger bg-white border border-slate-100 rounded-[24px] overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative">
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
          <div className="gsap-stagger bg-white border border-slate-100 rounded-[24px] p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col gap-4">
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
          <div className="gsap-stagger bg-white border border-slate-100 rounded-[24px] p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col gap-4">
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
          setUnitsLoaded(false);
          setRefreshCount((c) => c + 1);
        }}
      />

      {assigningUnit && (
        <LeaseFormModal
          open={!!assigningUnit}
          defaultPropertyId={mandate.property.id}
          defaultPropertyName={mandate.property.name}
          defaultUnitId={assigningUnit.id}
          onClose={() => setAssigningUnit(null)}
          onSubmit={() => {
            setAssigningUnit(null);
            setUnitsLoaded(false);
            loadUnits();
            setRefreshCount((c) => c + 1);
          }}
        />
      )}

      <UnitFormModal
        open={unitFormOpen}
        entityId={entityId}
        propertyId={mandate.property.id}
        unit={editingUnit}
        onClose={() => setUnitFormOpen(false)}
        onSaved={loadUnits}
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

      <MandateFormModal
        open={editTermsOpen}
        entityId={entityId}
        editMandate={{
          id: mandate.id,
          maintenanceAuthorityKes: mandate.maintenanceAuthorityKes,
          renewalType: mandate.renewalType,
          noticePeriodDays: mandate.noticePeriodDays,
          scopeDescription: mandate.scopeDescription,
        }}
        onClose={() => setEditTermsOpen(false)}
        onCreated={() => setRefreshCount((c) => c + 1)}
      />

      <MandateLetterModal
        open={mandateLetterOpen}
        entityId={entityId}
        ownerContactId={mandate.landlord.id}
        propertyId={mandate.property.id}
        propertyName={mandate.property.name}
        landlordName={mandate.landlord.name}
        hasExistingLetter={mandateLetterStatus(mandate.documents, mandate.property.id) === "verified"}
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

      {mandate.manager && (
        <NotifyUserModal
          open={notifyPmOpen}
          entityId={entityId}
          userId={mandate.manager.id}
          recipientName={mandate.manager.name || "Property Manager"}
          associatedType="property_mandate"
          associatedId={mandate.id}
          href={`/admin/mandates/${mandate.id}`}
          onClose={() => setNotifyPmOpen(false)}
        />
      )}
    </PageTransition>
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
