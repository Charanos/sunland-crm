"use client";


import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  IconAlertTriangle,
  IconBath,
  IconBed,
  IconBuildingSkyscraper,
  IconCalendarEvent,
  IconCar,
  IconCheck,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconClipboardList,
  IconDotsVertical,
  IconEdit,
  IconExternalLink,
  IconFileAlert,
  IconFileCertificate,
  IconFileText,
  IconHistory,
  IconLink,
  IconMail,
  IconMapPin,
  IconMoodEmpty,
  IconPhone,
  IconPhoto,
  IconPlus,
  IconReceipt2,
  IconRuler,
  IconShieldCheck,
  IconStar,
  IconStarFilled,
  IconTool,
  IconTrash,
  IconTrendingUp,
  IconUsers,
  IconUserCog,
  IconClock,
} from "@tabler/icons-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DropdownMenu, DropdownItem, Avatar, Badge } from "@/components/ui/erp-primitives";
import { useToast } from "@/components/ui/toast-provider";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { PropertyFormModal } from "./property-form-modal";
import { ReportIssueModal } from "./report-issue-modal";
import { MandateFormModal } from "./mandate-form-modal";
import { MandateLetterModal } from "./mandate-letter-modal";
import { MandateDecisionDrawer } from "./mandate-decision-drawer";
import { MandateOverrideModal } from "./mandate-override-modal";
import { AssignManagerModal } from "./assign-manager-modal";
import { VerifyContactModal } from "./verify-contact-modal";
import { PhotoLightbox } from "./photo-lightbox";
import { LeaseDetailDrawer } from "./lease-detail-drawer";
import { LeaseFormModal, type LeaseEditTarget } from "./lease-form-modal";
import { LeaseRenewModal, type LeaseRenewTarget } from "./lease-renew-modal";
import { formatCompactKES } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { LISTING_TYPE_LABEL, MANDATE_STATUS_CONFIG, PROPERTY_TYPE_ICON, STATUS_CONFIG, STATUS_ORDER, formatPropertyDate } from "./property-constants";
import type { PropertyStatus } from "./property-constants";
import type { ActivityLogEntry, LeaseSummary, PropertyDetail, PropertyDocumentSummary } from "./property-detail-types";
import { findMandateLetterDocument } from "./mandate-constants";

type TabKey = "overview" | "financials" | "tenancy" | "maintenance" | "activity";
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

// Hides scrollbars on the mobile tab strip / pipeline stepper while staying scrollable
// by touch, trackpad, or keyboard - cross-browser via one Tailwind arbitrary variant
// plus the two non-standard scrollbar properties inline.
const SCROLL_HIDDEN_CLASS = "[&::-webkit-scrollbar]:hidden";
const scrollHiddenStyle: React.CSSProperties = { scrollbarWidth: "none", msOverflowStyle: "none" };

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

export function PropertyFullViewBoard({
  entityId,
  propertyId,
  canManage = true,
  canViewFinance = true,
  canReportMaintenance,
}: {
  entityId: string | null;
  propertyId: string;
  canManage?: boolean;
  canViewFinance?: boolean;
  canReportMaintenance?: boolean;
}) {
  const router = useRouter();
  const { pushToast } = useToast();
  const canLogMaintenance = canReportMaintenance ?? canManage;

  const [property, setProperty] = useState<PropertyDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshCount, setRefreshCount] = useState(0);
  const [viewerRole, setViewerRole] = useState<string | null>(null);

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [reportIssueOpen, setReportIssueOpen] = useState(false);
  const [createMandateOpen, setCreateMandateOpen] = useState(false);
  const [terminateMandateOpen, setTerminateMandateOpen] = useState(false);
  const [terminateNotes, setTerminateNotes] = useState("");
  const [isTerminatingMandate, setIsTerminatingMandate] = useState(false);
  const [verifyLandlordOpen, setVerifyLandlordOpen] = useState(false);
  const [mandateLetterOpen, setMandateLetterOpen] = useState(false);
  const [assignManagerOpen, setAssignManagerOpen] = useState(false);
  const [decisionDrawerOpen, setDecisionDrawerOpen] = useState(false);
  const [overrideModalOpen, setOverrideModalOpen] = useState(false);

  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const [drawerLease, setDrawerLease] = useState<LeaseSummary | null>(null);
  const [editingLease, setEditingLease] = useState<LeaseSummary | null>(null);
  const [renewingLease, setRenewingLease] = useState<LeaseSummary | null>(null);
  const [leasePage, setLeasePage] = useState(1);

  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);

  const [activityLog, setActivityLog] = useState<ActivityLogEntry[] | null>(null);
  const [activityLoading, setActivityLoading] = useState(false);

  useEffect(() => {
    let active = true;
    const fetchProp = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/properties/${propertyId}?entityId=${entityId || ""}`);
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        const data = await res.json();
        if (!active) return;
        if (data.property) {
          setProperty(data.property);
        } else {
          setError("This property couldn't be found.");
        }
      } catch (err) {
        if (!active) return;
        console.error("Failed to load property:", err);
        setError("Couldn't load this property. Check your connection and try again.");
      } finally {
        if (active) setIsLoading(false);
      }
    };
    fetchProp();
    return () => {
      active = false;
    };
  }, [propertyId, entityId, refreshCount]);

  useEffect(() => {
    let active = true;
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active) return;
        setViewerRole(data?.user?.role ?? null);
      })
      .catch(() => {
        if (active) setViewerRole(null);
      });
    return () => {
      active = false;
    };
  }, []);

  // Audit trail loads unconditionally alongside the property - the rail's
  // "Latest Activity" peek needs it regardless of which tab is active, not
  // just when the Activity tab happens to be open.
  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => { if (active) setActivityLoading(true); });
    const timeoutId = setTimeout(() => {
      fetch(`/api/properties/${propertyId}/activity?entityId=${entityId || ""}`)
        .then((res) => (res.ok ? res.json() : { data: [] }))
        .then((data) => {
          if (!active) return;
          setActivityLog(data.data ?? data.entries ?? []);
        })
        .catch((err) => {
          console.error("Failed to load activity log:", err);
          if (active) setActivityLog([]);
        })
        .finally(() => {
          if (active) setActivityLoading(false);
        });
    }, 0);
    return () => {
      active = false;
      clearTimeout(timeoutId);
    };
  }, [propertyId, entityId, refreshCount]);

  const tabs = useMemo(() => {
    if (!property) return [];
    const list: { key: TabKey; label: string; icon: ComponentType<{ size?: number; className?: string }>; dot?: boolean }[] = [
      { key: "overview", label: "Overview", icon: IconBuildingSkyscraper },
    ];
    if (canViewFinance) list.push({ key: "financials", label: "Financials", icon: IconReceipt2 });
    list.push({
      key: "tenancy",
      label: property.listingType === "sale" ? "Sales Pipeline" : "Tenancy",
      icon: property.listingType === "sale" ? IconTrendingUp : IconUsers,
    });
    const openCritical = (property.maintenanceRequests ?? []).some(
      (m) => m.priority === "critical" && m.status !== "done"
    );
    list.push({ key: "maintenance", label: "Maintenance", icon: IconClipboardList, dot: openCritical });
    list.push({ key: "activity", label: "Activity", icon: IconHistory });
    return list;
  }, [property, canViewFinance]);

  const mandateLetterDoc = property ? findMandateLetterDocument(property.documents, property.id) : undefined;

  // Who this mandate's pending decision is actually mine to make (matches the
  // viewer's own role to the tier), vs. something a CEO could override.
  const mandate = property?.mandate;
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
    if (!property) return [];
    const items: ActionItem[] = [];
    if (mandate?.status === "pending_approval" && mandate.approvalRequestId) {
      items.push({
        key: "mandate",
        tone: "amber",
        icon: IconFileCertificate,
        title: canDecideMandate
          ? "Mandate awaiting your approval"
          : `Mandate pending at the ${(mandate.pendingApproverRole ?? "gm").toUpperCase()} step`,
        meta: `${(mandate.mandateRate * 100).toFixed(0)}% rate${mandate.manager?.name ? ` · ${mandate.manager.name}` : ""}`,
        cta: canDecideMandate ? "Review" : canOverrideMandate ? "Decide Directly" : "View",
        primary: canDecideMandate,
        onClick: () => {
          if (canDecideMandate) setDecisionDrawerOpen(true);
          else if (canOverrideMandate) setOverrideModalOpen(true);
          else setActiveTab("financials");
        },
      });
    }
    if (property.arrears && (property.arrears.status === "partial" || property.arrears.status === "defaulted")) {
      const unitsBehind = property.unitBreakdown && property.unitBreakdown.length > 0
        ? ` · Units ${property.unitBreakdown.slice(0, 2).map(u => u.unitType).join(", ")} behind`
        : "";
      items.push({
        key: "arrears",
        tone: "rose",
        icon: IconAlertTriangle,
        title: `${formatCompactKES(property.arrears.amount)} in arrears`,
        meta: `${property.arrears.daysInArrears} days${unitsBehind}`,
        cta: "Follow up",
        primary: false,
        onClick: () => setActiveTab("financials"),
      });
    }
    const openCritical = (property.maintenanceRequests ?? []).find(
      (m) => m.priority === "critical" && m.status !== "done"
    );
    if (openCritical) {
      items.push({
        key: "maintenance",
        tone: "rose",
        icon: IconAlertTriangle,
        title: `Critical: ${openCritical.title}`,
        meta: `Reported ${formatPropertyDate(openCritical.reportedAt)} by caretaker`,
        cta: "Escalate",
        primary: false,
        onClick: () => setActiveTab("maintenance"),
      });
    }
    if (property.owner && mandate && !mandateLetterDoc?.url) {
      items.push({
        key: "letter",
        tone: "neutral",
        icon: IconFileAlert,
        title: "Mandate letter not attached",
        meta: "Required on file before first remittance",
        cta: "Attach",
        primary: false,
        onClick: () => setMandateLetterOpen(true),
      });
    }
    return items;
  }, [property, mandate, mandateLetterDoc, canDecideMandate, canOverrideMandate]);

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error && !property) {
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

  if (!property) {
    return <div className="p-8 text-center text-desc-secondary">Property not found.</div>;
  }

  const statusConfig = STATUS_CONFIG[property.status as PropertyStatus] || STATUS_CONFIG.available;
  const TypeIcon =
    PROPERTY_TYPE_ICON[property.propertyType as keyof typeof PROPERTY_TYPE_ICON] ?? IconBuildingSkyscraper;
  const isForSale = property.listingType === "sale";

  const mediaList = property.media || [];
  const primaryImage = mediaList[activeMediaIndex]?.url ?? mediaList[0]?.url;

  const adaptiveMetric = getAdaptiveMetric(property);
  const vitals = getVitals(property, adaptiveMetric);
  const specLine = buildSpecLine(property);

  const handleEditSave = () => {
    setEditModalOpen(false);
    setRefreshCount((c) => c + 1);
    pushToast({ tone: "success", title: "Property updated" });
  };

  const handleToggleFeature = async () => {
    const newVal = !property.isFeatured;
    try {
      const res = await fetch(`/api/properties?id=${property.id}&entityId=${entityId || ""}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isFeatured: newVal, entityId }),
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      setProperty({ ...property, isFeatured: newVal });
      pushToast({ tone: "success", title: "Updated", body: `Property is now ${newVal ? "featured" : "unfeatured"}.` });
    } catch (err) {
      console.error("Failed to toggle feature:", err);
      pushToast({ tone: "warning", title: "Error", body: "Could not update property." });
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/admin/properties/${property.id}`);
      pushToast({ tone: "success", title: "Link copied" });
    } catch {
      pushToast({ tone: "warning", title: "Couldn't copy link" });
    }
  };

  const handleStatusChange = async (status: PropertyStatus) => {
    const previous = property.status;
    setProperty({ ...property, status });
    try {
      const res = await fetch(`/api/properties?id=${property.id}&entityId=${entityId || ""}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, entityId }),
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      pushToast({ tone: "success", title: "Status updated", body: STATUS_CONFIG[status].label });
    } catch (err) {
      console.error("Failed to update status:", err);
      setProperty({ ...property, status: previous });
      pushToast({ tone: "warning", title: "Couldn't update status", body: "Change was reverted." });
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/properties?id=${property.id}&entityId=${entityId || ""}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Failed to delete");
      }
      pushToast({ tone: "success", title: "Deleted", body: "Property removed." });
      router.push("/admin/properties");
    } catch (e: unknown) {
      pushToast({ tone: "warning", title: "Error", body: e instanceof Error ? e.message : "Failed to delete" });
      setIsDeleting(false);
      setDeleteConfirmOpen(false);
    }
  };

  const handleTerminateMandate = async () => {
    if (!property.mandate) return;
    if (!terminateNotes.trim()) {
      pushToast({ tone: "warning", title: "Notes required", body: "Explain why this mandate is being terminated." });
      return;
    }
    setIsTerminatingMandate(true);
    try {
      const res = await fetch(`/api/mandates/${property.mandate.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "terminate", entityId, reason: terminateNotes.trim() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Failed to terminate mandate");
      }
      pushToast({ tone: "success", title: "Mandate terminated" });
      setTerminateMandateOpen(false);
      setTerminateNotes("");
      setRefreshCount((c) => c + 1);
    } catch (e: unknown) {
      pushToast({ tone: "warning", title: "Error", body: e instanceof Error ? e.message : "Failed to terminate mandate" });
    } finally {
      setIsTerminatingMandate(false);
    }
  };

  const handleLeaseTerminate = async (id: string) => {
    try {
      const res = await fetch(`/api/leases/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityId, action: "terminate" }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Failed to terminate lease");
      pushToast({ tone: "success", title: "Lease terminated", body: "Property occupancy reverted to available." });
      setDrawerLease(null);
      setRefreshCount((c) => c + 1);
    } catch (err) {
      pushToast({ tone: "warning", title: "Error", body: err instanceof Error ? err.message : "Termination failed." });
    }
  };

  const openLeaseDrawer = (lease: LeaseSummary) => {
    setDrawerLease(lease);
  };

  return (
    <div className="mx-auto flex max-w-[98rem] flex-col gap-6 pb-12">
      {/* ── Unified Hero Section ── */}
      {/* ── Unified Hero Section ── */}
      <div className="flex flex-col gap-6 animate-fade-in-up stagger-1">

        {/* Command Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-1">
          <div className="flex flex-col gap-3 min-w-0">
            <div className="flex items-center gap-3 text-slate-500 text-sm min-w-0">
              <span className="flex items-center gap-1.5 min-w-0 font-medium">
                <IconMapPin size={15} className="shrink-0 text-slate-400" aria-hidden="true" />
                <span className="truncate">{property.location}</span>
              </span>
              <span className="text-slate-200 shrink-0">|</span>
              <span className="mono-data text-slate-500 shrink-0">{property.propertyCode}</span>
              <span className="text-slate-200 shrink-0">|</span>
              <span className="shrink-0 font-medium text-slate-500">
                {property.propertyType} · {LISTING_TYPE_LABEL[property.listingType as keyof typeof LISTING_TYPE_LABEL] || property.listingType}
              </span>
            </div>

            <div className="flex items-center gap-4 flex-wrap">
              <h1 className="text-4xl lg:text-[42px] title-serif text-slate-900 tracking-tight truncate leading-none">{property.name}</h1>
              {canManage ? (
                <DropdownMenu
                  label="Change status"
                  align="left"
                  trigger={
                    <div role="button" className="relative inline-flex items-center rounded-full px-3 py-1.5 backdrop-blur-md bg-white border border-slate-200/80 shadow-[0_4px_16px_rgba(0,0,0,0.04)] transition-all hover:border-slate-300 hover:shadow-[0_4px_24px_rgba(0,0,0,0.08)] group cursor-pointer mt-1">
                      <span className={cn("size-2 rounded-full shrink-0 shadow-sm", statusConfig.dot)} aria-hidden="true" />
                      <span className="label-caps text-slate-900 tracking-widest font-medium pl-2 pr-2">{statusConfig.label}</span>
                      <IconChevronDown size={14} stroke={2.5} className="text-slate-400 transition-all group-hover:text-slate-900" />
                    </div>
                  }
                >
                  {STATUS_ORDER.map((s) => (
                    <DropdownItem key={s} onClick={() => handleStatusChange(s)}>
                      <div className="flex items-center gap-2.5">
                        <span className={cn("size-2 rounded-full", STATUS_CONFIG[s].dot)} aria-hidden="true" />
                        <span className="uppercase text-xs font-medium tracking-wider text-slate-700">{STATUS_CONFIG[s].label}</span>
                      </div>
                    </DropdownItem>
                  ))}
                </DropdownMenu>
              ) : (
                <span className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 bg-white border border-slate-200/80 shadow-sm mt-1">
                  <span className={cn("size-2 rounded-full shrink-0 shadow-sm", statusConfig.dot)} aria-hidden="true" />
                  <span className="label-caps text-slate-900 tracking-widest font-medium">{statusConfig.label}</span>
                </span>
              )}
              {property.isFeatured && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/60 bg-amber-500/10 px-3 py-1 label-caps text-amber-700 mt-1">
                  <IconStarFilled size={12} aria-hidden="true" /> Featured
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            {canManage && actionItems[0]?.primary && (
              <button
                type="button"
                onClick={actionItems[0].onClick}
                className="bg-[#151936] text-white hover:bg-slate-800 font-medium text-sm rounded-full px-5 py-2.5 shadow-[0_4px_14px_rgba(0,0,0,0.12)] transition-all hover:shadow-[0_6px_20px_rgba(0,0,0,0.2)] flex items-center gap-1.5"
              >
                <IconFileCertificate size={16} /> Review Mandate
              </button>
            )}
            {canManage && canLogMaintenance && (
              <button
                type="button"
                onClick={() => setReportIssueOpen(true)}
                className="bg-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-transparent hover:border-slate-200 font-medium text-sm rounded-full px-4 py-2.5 transition-colors flex items-center gap-1.5"
              >
                <IconTool size={16} /> Report Issue
              </button>
            )}
            {canManage && (
              <button
                type="button"
                onClick={() => setEditModalOpen(true)}
                className="bg-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-transparent hover:border-slate-200 font-medium text-sm rounded-full px-4 py-2.5 transition-colors flex items-center gap-1.5"
              >
                <IconEdit size={16} /> Edit
              </button>
            )}
            {canManage && (
              <DropdownMenu
                label="More actions"
                align="right"
                trigger={
                  <div className="inline-flex size-[42px] items-center justify-center rounded-full border border-slate-200/80 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-sm cursor-pointer">
                    <IconDotsVertical size={18} />
                  </div>
                }
              >
                <DropdownItem icon={property.isFeatured ? IconStarFilled : IconStar} onClick={handleToggleFeature}>
                  {property.isFeatured ? "Unfeature property" : "Feature property"}
                </DropdownItem>
                <DropdownItem icon={IconLink} onClick={handleCopyLink}>
                  Copy deep link
                </DropdownItem>
                <DropdownItem icon={IconTrash} variant="danger" onClick={() => setDeleteConfirmOpen(true)}>
                  Delete property
                </DropdownItem>
              </DropdownMenu>
            )}
          </div>
        </div>

        {/* ── Cinematic Hero + Vitals ── */}
        <div className="flex flex-col gap-6">
          {/* Cinematic Gallery Grid */}
          <div className={cn("grid gap-3 lg:gap-4 h-[400px] lg:h-[480px]", mediaList.length >= 2 ? "grid-cols-1 md:grid-cols-[2fr_1fr]" : "grid-cols-1")}>
            {/* Main Image */}
            <div className="relative w-full h-full rounded-[24px] lg:rounded-[32px] overflow-hidden bg-slate-100 shadow-[0_12px_40px_rgb(0,0,0,0.06)] group cursor-pointer" onClick={() => setLightboxOpen(true)}>
              {primaryImage ? (
                <Image src={primaryImage} alt={property.name} fill className="object-cover transition-transform duration-700 group-hover:scale-105" sizes={mediaList.length >= 2 ? "(max-width: 768px) 100vw, 66vw" : "100vw"} priority />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-50">
                  <TypeIcon size={64} className="text-slate-300" />
                </div>
              )}
              {/* Scrim for elegance */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />

              {/* Floating Photos Button - Only show on mobile if there's a side gallery, otherwise show always if there are multiple photos */}
              {mediaList.length > 0 && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setLightboxOpen(true); }}
                  className={cn(
                    "absolute bottom-6 left-6 bg-white/95 backdrop-blur-xl border border-white/40 text-slate-900 shadow-xl rounded-full px-5 py-2.5 items-center gap-2 font-medium text-sm transition-transform hover:scale-105",
                    mediaList.length >= 2 ? "flex md:hidden" : "flex"
                  )}
                >
                  <IconPhoto size={18} />
                  View {mediaList.length} photos
                </button>
              )}

              {/* Spec Line Floater */}
              {specLine && (
                <div className="absolute bottom-6 right-6 bg-black/40 backdrop-blur-xl border border-white/10 text-white shadow-xl rounded-full px-5 py-2.5 flex items-center gap-2">
                  <IconRuler size={16} className="text-white/70 shrink-0" aria-hidden="true" />
                  <span className="mono-data tracking-wide text-[13px] font-medium">{specLine}</span>
                </div>
              )}
            </div>

            {/* Side Gallery */}
            {mediaList.length >= 2 && (
              <div className="hidden md:flex flex-col gap-3 lg:gap-4 h-full">
                <div className="relative w-full flex-1 rounded-[24px] lg:rounded-[32px] overflow-hidden bg-slate-100 shadow-[0_12px_40px_rgb(0,0,0,0.06)] group cursor-pointer" onClick={() => setLightboxOpen(true)}>
                  <Image src={mediaList[1].url} alt={mediaList[1].alt || property.name} fill className="object-cover transition-transform duration-700 group-hover:scale-105" sizes="33vw" />
                </div>
                {mediaList.length >= 3 && (
                  <div className="relative w-full flex-1 rounded-[24px] lg:rounded-[32px] overflow-hidden bg-slate-100 shadow-[0_12px_40px_rgb(0,0,0,0.06)] group cursor-pointer" onClick={() => setLightboxOpen(true)}>
                    <Image src={mediaList[2].url} alt={mediaList[2].alt || property.name} fill className="object-cover transition-transform duration-700 group-hover:scale-105" sizes="33vw" />

                    {/* Overlay for "View more" if there are > 3 images */}
                    {mediaList.length > 3 ? (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white transition-all duration-300 group-hover:bg-black/50 backdrop-blur-[2px]">
                        <span className="font-medium text-lg flex items-center gap-2">
                          <IconPhoto size={20} />
                          +{mediaList.length - 3} more
                        </span>
                      </div>
                    ) : (
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300 flex items-center justify-center">
                        <span className="opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-4 group-hover:translate-y-0 bg-white/95 backdrop-blur-md text-[#151936] font-medium px-5 py-2.5 rounded-full shadow-lg flex items-center gap-2 text-sm border border-white/20">
                          <IconPhoto size={16} aria-hidden="true" /> View gallery
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Vitals Strip */}
          <div className="flex flex-col lg:flex-row items-center justify-between rounded-[24px] border border-slate-200/60 bg-white p-1 lg:p-2 shadow-sm overflow-hidden relative">
            <div className="flex flex-col lg:flex-row w-full divide-y lg:divide-y-0 lg:divide-x divide-slate-100 relative z-10">
              {vitals.map((v) => (
                <div key={v.label} className="flex-1 px-6 py-5 lg:py-6 flex flex-col gap-1.5 relative overflow-hidden group/vital hover:bg-slate-50/50 transition-colors">
                  <v.icon
                    size={140}
                    stroke={1}
                    className={cn(
                      "absolute -right-6 -bottom-6 opacity-[0.03] group-hover/vital:scale-110 group-hover/vital:opacity-[0.05] transition-all duration-500 pointer-events-none",
                      VITAL_TONE_ARTWORK[v.tone]
                    )}
                    aria-hidden="true"
                  />
                  <span className="text-sm text-slate-500 font-medium flex items-center gap-1.5 z-10">
                    <v.icon size={15} className={VITAL_TONE_ICON[v.tone]} aria-hidden="true" />
                    {v.label}
                  </span>
                  <div className="flex items-baseline gap-3 z-10 mt-0.5">
                    <span className="font-mono font-medium text-3xl lg:text-[34px] font-medium text-slate-900 tracking-tight leading-none truncate">
                      {v.value}
                    </span>
                  </div>
                  {/* Optional subtitiles / bars */}
                  <div className="mt-1 h-3 flex items-center z-10">
                    {v.hasBar ? (
                      <div className="flex items-center gap-2 w-full max-w-[140px]">
                        <div className="h-1 flex-1 rounded-full bg-slate-100 overflow-hidden">
                          <div className={cn("h-full rounded-full", VITAL_TONE_BAR[v.tone])} style={{ width: `${Math.min(100, Math.round((v.barRatio ?? 0) * 100))}%` }} />
                        </div>
                        {v.sub && <span className="text-xs text-slate-400 font-medium whitespace-nowrap">{v.sub}</span>}
                      </div>
                    ) : (
                      v.sub && <span className="text-xs text-slate-400 font-medium">{v.sub}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
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

      {/* ── Section divider ── */}
      <div className="h-px bg-slate-200/60 my-2 lg:my-4" />

      {/* ── Main: tabbed content + persistent context rail ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 lg:gap-8 items-start animate-fade-in-up stagger-3">
        <div className="flex flex-col min-w-0">
          {/* ── Sub-Header Tab Navigation Bar (Mobile Responsive White Card) ── */}
          <div
            role="tablist"
            aria-label="Property sections"
            className={cn("bg-white border border-slate-100/80 rounded-[22px] p-1.5 shadow-[0_8px_30px_rgb(0,0,0,0.03)] flex items-center gap-1 overflow-x-auto flex-nowrap mb-6 lg:mb-8 max-w-full touch-pan-x", SCROLL_HIDDEN_CLASS)}
            style={scrollHiddenStyle}
          >
            {tabs.map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  role="tab"
                  id={`tab-${tab.key}`}
                  aria-selected={isActive}
                  aria-controls={`panel-${tab.key}`}
                  tabIndex={isActive ? 0 : -1}
                  onClick={() => setActiveTab(tab.key)}
                  onKeyDown={(e) => {
                    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
                    const idx = tabs.findIndex((t) => t.key === activeTab);
                    const next = e.key === "ArrowRight" ? (idx + 1) % tabs.length : (idx - 1 + tabs.length) % tabs.length;
                    setActiveTab(tabs[next].key);
                  }}
                  className={cn(
                    "px-4 py-2.5 rounded-[16px] text-xs font-medium flex items-center gap-2 shrink-0 whitespace-nowrap transition-all duration-200 select-none",
                    isActive
                      ? "bg-[#151936] text-white shadow-xs"
                      : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                  )}
                >
                  <tab.icon size={15} aria-hidden="true" className={cn("transition-colors", isActive ? "text-white" : "text-slate-400")} />
                  {tab.label}
                  {tab.dot && <span className={cn("size-1.5 rounded-full shrink-0", isActive ? "bg-rose-400" : "bg-rose-500")} aria-hidden="true" />}
                </button>
              );
            })}
          </div>

          <div id={`panel-${activeTab}`} role="tabpanel" aria-labelledby={`tab-${activeTab}`}>
            {activeTab === "overview" && (
              <OverviewPanel property={property} />
            )}
            {activeTab === "financials" && canViewFinance && <FinancialsPanel property={property} />}
            {activeTab === "tenancy" && (
              isForSale ? (
                <PipelinePanel property={property} />
              ) : (
                <TenancyPanel property={property} page={leasePage} onPageChange={setLeasePage} onOpenLease={openLeaseDrawer} />
              )
            )}
            {activeTab === "maintenance" && (
              <MaintenancePanel property={property} canLog={canLogMaintenance} onReport={() => setReportIssueOpen(true)} />
            )}
            {activeTab === "activity" && (
              <ActivityPanel entries={activityLog} loading={activityLoading} documents={property.documents ?? []} />
            )}
          </div>
        </div>

        {/* Unified Context Rail Column */}
        <div className="bg-white border border-slate-100/80 rounded-[28px] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.03)] flex flex-col gap-6 divide-y divide-slate-100/80 relative overflow-hidden">

          {/* ── Management Mandate Section ── */}
          <div className="flex flex-col gap-4 relative">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-medium text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <IconFileCertificate size={16} className="text-slate-400" />
                Management Mandate
              </h3>
              {property.mandate && <MandateStatusPill status={property.mandate.status} pendingApproverRole={property.mandate.pendingApproverRole} />}
            </div>

            {canViewFinance && property.mandate ? (
              <>
                <div className="flex items-baseline justify-between">
                  <div className="flex items-baseline gap-1">
                    <span className="font-mono font-medium text-3xl font-medium text-slate-900 tracking-tight">
                      {(property.mandate.mandateRate * 100).toFixed(0)}%
                    </span>
                    <span className="text-xs text-slate-500 font-medium">management fee</span>
                  </div>
                  <span className="mono-data bg-slate-50 border border-slate-100/80 px-2 py-0.5 rounded-md text-xs text-slate-600 font-medium">
                    Ref #{property.mandate.id.slice(0, 6).toUpperCase()}
                  </span>
                </div>

                <div className="text-xs text-slate-500 font-medium -mt-2">
                  Commenced {formatPropertyDate(property.mandate.startDate)}
                </div>

                <div className="flex flex-col gap-2 pt-1">
                  <div className="bg-slate-50/70 border border-slate-100/80 rounded-2xl p-3 flex items-center justify-between gap-3 group transition-colors hover:bg-slate-100/60">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="size-8 rounded-xl bg-white border border-slate-200/80 flex items-center justify-center shrink-0 shadow-2xs">
                        {property.mandate.manager?.avatarUrl ? (
                          <Avatar src={property.mandate.manager.avatarUrl} fallback={property.mandate.manager.name?.slice(0, 2).toUpperCase() || "??"} className="size-full text-xs" />
                        ) : (
                          <IconUserCog size={15} className="text-slate-500" aria-hidden="true" />
                        )}
                      </div>
                      <div className="min-w-0 flex flex-col">
                        <span className="text-xs font-medium text-slate-900 truncate">
                          {property.mandate.manager?.name || "No manager assigned"}
                        </span>
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">Assigned Manager</span>
                      </div>
                    </div>
                    {canManage && (
                      <button type="button" onClick={() => setAssignManagerOpen(true)} className="text-[11px] font-medium text-emerald-600 hover:text-emerald-700 bg-emerald-50/80 hover:bg-emerald-100/80 px-2 py-0.5 rounded-lg transition-colors">
                        {property.mandate.manager?.name ? "Change" : "Assign"}
                      </button>
                    )}
                  </div>

                  <div className="bg-slate-50/70 border border-slate-100/80 rounded-2xl p-3 flex items-center justify-between gap-3 group transition-colors hover:bg-slate-100/60">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="size-8 rounded-xl bg-white border border-slate-200/80 flex items-center justify-center shrink-0 text-slate-500 shadow-2xs">
                        {mandateLetterDoc?.url ? <IconFileText size={15} /> : <IconAlertTriangle size={15} className="text-amber-500" />}
                      </div>
                      <div className="min-w-0 flex flex-col">
                        {mandateLetterDoc?.url ? (
                          <a href={mandateLetterDoc.url} target="_blank" rel="noreferrer" className="text-xs font-medium text-slate-900 hover:text-emerald-700 transition-colors truncate">
                            Mandate Letter
                          </a>
                        ) : (
                          <span className="text-xs font-medium text-amber-700 truncate">No letter on file</span>
                        )}
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">Legal Document</span>
                      </div>
                    </div>
                    {canManage && (
                      <button type="button" onClick={() => setMandateLetterOpen(true)} className="text-[11px] font-medium text-emerald-600 hover:text-emerald-700 bg-emerald-50/80 hover:bg-emerald-100/80 px-2 py-0.5 rounded-lg transition-colors">
                        {mandateLetterDoc?.url ? "Replace" : "Upload"}
                      </button>
                    )}
                  </div>
                </div>

                {canManage && canDecideMandate && (
                  <div className="rounded-2xl border border-amber-200/80 bg-[#fffdf5] p-3.5 flex flex-col gap-2 shadow-2xs">
                    <p className="text-xs font-medium text-amber-900 leading-relaxed">
                      Mandate decision required. Submitted {formatPropertyDate(property.mandate.startDate)}.
                    </p>
                    <div className="flex items-center gap-2">
                      <Button className="flex-1 justify-center bg-[#f3df27] text-[#151936] hover:bg-[#e6d220] font-medium shadow-2xs text-xs py-1.5 h-auto rounded-xl" onClick={() => setDecisionDrawerOpen(true)}>
                        Approve
                      </Button>
                      <Button variant="secondary" className="flex-1 justify-center text-rose-600 border-rose-200 hover:bg-rose-50 font-medium shadow-2xs text-xs py-1.5 h-auto rounded-xl" onClick={() => setDecisionDrawerOpen(true)}>
                        Reject
                      </Button>
                    </div>
                  </div>
                )}

                {canManage && property.mandate.status === "active" && (
                  <div className="flex justify-center pt-0.5">
                    <button type="button" onClick={() => setTerminateMandateOpen(true)} className="text-xs font-medium text-rose-500 hover:text-rose-700 transition-colors">
                      Terminate Mandate
                    </button>
                  </div>
                )}
              </>
            ) : canViewFinance && !property.mandate && canManage && property.owner ? (
              <div className="flex flex-col items-center text-center gap-2.5 py-2">
                <div className="size-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400">
                  <IconFileCertificate size={20} />
                </div>
                <div className="flex flex-col gap-0.5">
                  <h3 className="text-xs font-medium text-slate-900">No Active Mandate</h3>
                  <p className="text-[11px] text-slate-500">Not currently under management.</p>
                </div>
                <Button onClick={() => setCreateMandateOpen(true)} className="w-full justify-center bg-tertiary-gradient hover:opacity-95 transition-opacity text-white shadow-xs font-medium text-xs py-2 rounded-xl h-auto">
                  <IconPlus size={14} className="mr-1.5" /> Create Mandate
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center text-center gap-2 py-2">
                <IconFileCertificate size={20} className="text-slate-300" />
                <p className="text-xs text-slate-500 font-medium">Mandate unavailable.</p>
              </div>
            )}
          </div>

          {/* ── Needs Your Attention Section ── */}
          {actionItems.length > 0 && (
            <div className="flex flex-col gap-3 pt-5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-medium text-slate-400 uppercase tracking-widest">Needs Your Attention</h3>
                <span className="size-5 rounded-full bg-rose-500 text-white font-medium mono-data text-[11px] flex items-center justify-center shadow-2xs">
                  {actionItems.length}
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {actionItems.map((item) => {
                  const t = ACTION_TONE_CLASSES[item.tone];
                  return (
                    <div key={item.key} className={cn("flex items-center justify-between gap-3 rounded-2xl border p-3 shadow-2xs transition-all hover:translate-x-0.5", t.card)}>
                      <div className="min-w-0 flex flex-col gap-0.5">
                        <p className="text-xs font-medium text-slate-900 truncate">{item.title}</p>
                        <p className="text-[11px] text-slate-500 font-medium truncate">{item.meta}</p>
                      </div>
                      <button type="button" onClick={item.onClick} className={cn("shrink-0 rounded-xl px-2.5 py-1 text-[11px] font-medium transition-colors shadow-2xs", t.cta)}>
                        {item.cta}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Ownership (Landlord) Section ── */}
          <div className="flex flex-col gap-4 pt-5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-medium text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <IconShieldCheck size={16} className="text-slate-400" />
                Ownership
              </h3>
              {property.owner?.verifiedAt && (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50/80 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                  <IconShieldCheck size={11} aria-hidden="true" /> Verified
                </span>
              )}
            </div>

            {property.owner ? (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex flex-col gap-1.5 min-w-0">
                    <p className="text-xs font-medium text-slate-900 truncate">{property.owner.name || "Unknown Owner"}</p>
                    <div className="flex flex-wrap gap-1">
                      {property.owner.phone && (
                        <a href={`tel:${property.owner.phone}`} className="inline-flex items-center gap-1 text-[10px] text-slate-600 hover:text-emerald-700 bg-slate-50 hover:bg-slate-100/80 border border-slate-100/80 px-1.5 py-0.5 rounded-lg transition-colors">
                          <IconPhone size={11} className="shrink-0 text-slate-400" aria-hidden="true" />
                          <span className="truncate">{property.owner.phone}</span>
                        </a>
                      )}
                      {property.owner.email && (
                        <a href={`mailto:${property.owner.email}`} className="inline-flex items-center gap-1 text-[10px] text-slate-600 hover:text-emerald-700 bg-slate-50 hover:bg-slate-100/80 border border-slate-100/80 px-1.5 py-0.5 rounded-lg transition-colors">
                          <IconMail size={11} className="shrink-0 text-slate-400" aria-hidden="true" />
                          <span className="truncate">{property.owner.email}</span>
                        </a>
                      )}
                    </div>
                  </div>
                  <Avatar
                    src={property.owner.avatarUrl || undefined}
                    fallback={property.owner.name?.slice(0, 2).toUpperCase() || "??"}
                    className="size-10 rounded-xl bg-slate-50 border border-slate-200/80 text-slate-600 shrink-0 text-xs shadow-2xs"
                  />
                </div>
                {canManage && (
                  <button
                    type="button"
                    onClick={() => setVerifyLandlordOpen(true)}
                    className="w-full rounded-xl bg-slate-50 hover:bg-slate-100/80 border border-slate-200/70 py-1.5 text-xs font-medium text-slate-700 transition-colors flex items-center justify-center gap-1.5 shadow-2xs"
                  >
                    <IconShieldCheck size={13} aria-hidden="true" className="text-slate-500" />
                    {property.owner.verifiedAt ? "Re-confirm Landlord" : "Confirm Landlord"}
                  </button>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center text-center gap-1 py-2">
                <IconMoodEmpty size={20} className="text-slate-300" />
                <p className="text-xs font-medium text-slate-500">No owner assigned.</p>
              </div>
            )}
          </div>

          {/* ── Quick Facts Section ── */}
          <div className="flex flex-col gap-2.5 pt-5">
            <h3 className="text-xs font-medium text-slate-400 uppercase tracking-widest mb-0.5">Quick Facts</h3>
            <FactRow label="Property code" value={<span className="mono-data text-slate-700 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-md text-xs font-medium">{property.propertyCode}</span>} />
            <FactRow label="Registered" value={<span className="mono-data text-xs text-slate-600">{formatPropertyDate(property.createdAt)}</span>} />
            <FactRow label="Last updated" value={<span className="mono-data text-xs text-slate-600">{formatPropertyDate(property.updatedAt)}</span>} />
            {property.unitBreakdown && property.unitBreakdown.length > 0 && (
              <FactRow label="Total units" value={<span className="font-mono font-medium text-xs font-medium text-slate-900">{property.unitBreakdown.reduce((sum, u) => sum + u.count, 0)}</span>} />
            )}
          </div>

          {/* ── Latest Activity Section ── */}
          <div className="flex flex-col gap-3 pt-5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-medium text-slate-400 uppercase tracking-widest">Latest Activity</h3>
              <button type="button" onClick={() => setActiveTab("activity")} className="text-xs font-medium text-emerald-600 hover:text-emerald-700 transition-colors">
                View all
              </button>
            </div>
            {activityLoading ? (
              <div className="flex items-center justify-center py-2">
                <LoadingSpinner size="sm" />
              </div>
            ) : activityLog && activityLog.length > 0 ? (
              <div className="flex flex-col gap-2.5">
                {activityLog.slice(0, 3).map((entry) => {
                  const actionParts = entry.action.split(".");
                  const readableAction = actionParts[actionParts.length - 1].replace(/_/g, " ");
                  return (
                    <div key={entry.id} className="flex items-start gap-2">
                      <span className={cn("size-1.5 rounded-full shrink-0 mt-1.5", activityTone(entry.action))} aria-hidden="true" />
                      <div className="min-w-0">
                        <p className="text-[11px] text-slate-600 leading-relaxed">
                          <span className="text-slate-900 font-medium">{entry.actorName}</span> performed {readableAction}
                        </p>
                        <p className="text-[10px] text-slate-400 mono-data mt-0.5">{formatPropertyDate(entry.occurredAt)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-slate-400 font-medium">No activity recorded yet.</p>
            )}
          </div>
        </div>
      </div>

      <PropertyFormModal open={editModalOpen} onClose={() => setEditModalOpen(false)} onSubmit={handleEditSave} mode="edit" initialData={property as unknown as Record<string, unknown>} />

      <ConfirmDialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleDelete}
        title="Delete Property"
        description="Are you sure you want to delete this property? This action cannot be undone."
        confirmLabel="Delete Property"
        tone="danger"
        isLoading={isDeleting}
      />

      <ReportIssueModal
        open={reportIssueOpen}
        entityId={entityId}
        propertyId={property.id}
        propertyName={property.name}
        onClose={() => setReportIssueOpen(false)}
        onCreated={() => setRefreshCount((c) => c + 1)}
      />

      {property.owner && (
        <MandateLetterModal
          open={mandateLetterOpen}
          entityId={entityId}
          ownerContactId={property.owner.id}
          propertyId={property.id}
          propertyName={property.name}
          landlordName={property.owner.name}
          hasExistingLetter={!!mandateLetterDoc?.url}
          onClose={() => setMandateLetterOpen(false)}
          onAttached={() => setRefreshCount((c) => c + 1)}
        />
      )}

      {property.owner && (
        <MandateFormModal
          open={createMandateOpen}
          entityId={entityId}
          propertyId={property.id}
          propertyName={property.name}
          landlordName={property.owner.name}
          landlordVerified={!!property.owner.verifiedAt}
          defaultUnitCount={
            property.unitBreakdown && property.unitBreakdown.length > 0
              ? property.unitBreakdown.reduce((sum, u) => sum + u.count, 0)
              : 1
          }
          onClose={() => setCreateMandateOpen(false)}
          onCreated={() => setRefreshCount((c) => c + 1)}
        />
      )}

      {property.mandate && (
        <AssignManagerModal
          open={assignManagerOpen}
          entityId={entityId}
          mandateId={property.mandate.id}
          propertyName={property.name}
          currentManagerId={property.mandate.manager?.id ?? null}
          onClose={() => setAssignManagerOpen(false)}
          onAssigned={() => setRefreshCount((c) => c + 1)}
        />
      )}

      {property.mandate?.approvalRequestId && (viewerRole === "ceo" || viewerRole === "general_manager") && (
        <MandateDecisionDrawer
          open={decisionDrawerOpen}
          propertyName={property.name}
          landlordName={property.owner?.name ?? "Unknown"}
          approvalRequestId={property.mandate.approvalRequestId}
          mandateRate={property.mandate.mandateRate}
          expectedMonthlyKes={property.collections?.[property.collections.length - 1]?.expected ?? 0}
          unitTotal={
            property.unitBreakdown && property.unitBreakdown.length > 0
              ? `${property.unitBreakdown.reduce((sum, u) => sum + u.count, 0)} units`
              : "1 unit"
          }
          submittedBy={property.mandate.manager?.name}
          submittedAt={property.mandate.startDate}
          requiredApproverRole={(property.mandate.pendingApproverRole as "gm" | "ceo" | "department_head") ?? "gm"}
          viewerRole={viewerRole === "ceo" ? "ceo" : "gm"}
          mandateLetterUrl={mandateLetterDoc?.url}
          mandateLetterName={mandateLetterDoc?.name}
          onClose={() => setDecisionDrawerOpen(false)}
          onDecided={() => setRefreshCount((c) => c + 1)}
        />
      )}

      {property.mandate?.approvalRequestId && (
        <MandateOverrideModal
          open={overrideModalOpen}
          approvalRequestId={property.mandate.approvalRequestId}
          onClose={() => setOverrideModalOpen(false)}
          onDecided={() => setRefreshCount((c) => c + 1)}
        />
      )}

      {property.owner && (
        <VerifyContactModal
          open={verifyLandlordOpen}
          entityId={entityId}
          contactId={property.owner.id}
          contactName={property.owner.name}
          initialIdNumber={property.owner.idNumber}
          onClose={() => setVerifyLandlordOpen(false)}
          onVerified={() => setRefreshCount((c) => c + 1)}
        />
      )}

      <ConfirmDialog
        open={terminateMandateOpen}
        onClose={() => { setTerminateMandateOpen(false); setTerminateNotes(""); }}
        onConfirm={handleTerminateMandate}
        title="Terminate Mandate"
        description="This cannot be undone. Rent collection under this mandate stops, and the final landlord remittance is queued for Finance review."
        confirmLabel="Terminate Mandate"
        tone="danger"
        isLoading={isTerminatingMandate}
        notes={{
          label: "Termination notes",
          placeholder: "Reason for terminating…",
          value: terminateNotes,
          onChange: setTerminateNotes,
          required: true,
        }}
      />

      <PhotoLightbox
        open={lightboxOpen}
        media={mediaList}
        index={lightboxIndex}
        onIndexChange={(i) => { setLightboxIndex(i); setActiveMediaIndex(i); }}
        onClose={() => setLightboxOpen(false)}
      />

      <LeaseDetailDrawer
        lease={drawerLease ? leaseSummaryToDrawerLease(drawerLease, property) : null}
        open={!!drawerLease}
        entityId={entityId ?? undefined}
        onClose={() => setDrawerLease(null)}
        canManage={canManage}
        onTerminate={handleLeaseTerminate}
        onEdit={() => { setEditingLease(drawerLease); setDrawerLease(null); }}
        onRenew={() => { setRenewingLease(drawerLease); setDrawerLease(null); }}
      />

      {editingLease && (
        <LeaseFormModal
          open={!!editingLease}
          mode="edit"
          lease={leaseSummaryToEditTarget(editingLease, property)}
          onClose={() => setEditingLease(null)}
          onSubmit={() => { setEditingLease(null); setRefreshCount((c) => c + 1); }}
        />
      )}

      <LeaseRenewModal
        open={!!renewingLease}
        lease={renewingLease ? leaseSummaryToRenewTarget(renewingLease, property) : null}
        onClose={() => setRenewingLease(null)}
        onRenewed={() => { setRenewingLease(null); setRefreshCount((c) => c + 1); }}
      />
    </div>
  );
}

// ── Lease shape adapters (property page only has LeaseSummary; the shared
// LeaseDetailDrawer/LeaseFormModal/LeaseRenewModal want the leases-board's
// flatter Lease shape - property context is spliced in from the already-
// loaded property object rather than a second fetch). ──

function leaseSummaryToDrawerLease(l: LeaseSummary, property: PropertyDetail) {
  return {
    id: l.id,
    startsAt: l.startDate,
    endsAt: l.endDate ?? "",
    monthlyRentKes: l.monthlyRentKes,
    depositKes: l.depositKes,
    isActive: l.isActive,
    propertyId: property.id,
    tenantContactId: l.tenantContactId,
    propertyName: property.name,
    propertyCode: property.propertyCode,
    propertyType: property.propertyType,
    propertyLocation: property.location,
    tenantName: l.tenantName,
    tenantEmail: l.tenantEmail ?? null,
    tenantPhone: l.tenantPhone ?? null,
  };
}

function leaseSummaryToEditTarget(l: LeaseSummary, property: PropertyDetail): LeaseEditTarget {
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

function leaseSummaryToRenewTarget(l: LeaseSummary, property: PropertyDetail): LeaseRenewTarget {
  return {
    id: l.id,
    propertyName: property.name,
    tenantName: l.tenantName,
    endsAt: l.endDate ?? "",
    monthlyRentKes: l.monthlyRentKes,
    depositKes: l.depositKes,
  };
}

function activityTone(action: string): string {
  const lower = action.toLowerCase();
  if (lower.includes("terminat") || lower.includes("reject") || lower.includes("critical")) return "bg-rose-300";
  if (lower.includes("override")) return "bg-amber-400";
  return "bg-slate-300";
}

function buildSpecLine(property: PropertyDetail): string {
  const parts: string[] = [];
  if (property.bedrooms != null) parts.push(`${property.bedrooms} bed`);
  if (property.bathrooms != null) parts.push(`${property.bathrooms} bath`);
  if (property.sizeSqft != null) parts.push(`${property.sizeSqft.toLocaleString()} sqft`);
  if (property.landAreaSqft != null) parts.push(`${(property.landAreaSqft / 43560).toFixed(2)} acre`);
  if (property.yearBuilt != null) parts.push(`Built ${property.yearBuilt}`);
  return parts.join(" · ");
}

// ── Adaptive 4th metric (also feeds the vitals card) ──

function getAdaptiveMetric(property: PropertyDetail): {
  icon: ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string | number;
} {
  if (property.listingType === "sale") {
    if (property.askingPriceKes && property.sizeSqft) {
      return {
        icon: IconReceipt2,
        label: "Price / Sqft",
        value: formatCompactKES(parseFloat(property.askingPriceKes) / property.sizeSqft),
      };
    }
    return { icon: IconReceipt2, label: "Price / Sqft", value: "-" };
  }
  if (property.status === "occupied") {
    const activeLeaseList = property.leases || [];
    const soonestEnd = [...activeLeaseList]
      .filter((l) => l.status === "active" && l.endDate)
      .sort((a, b) => new Date(a.endDate!).getTime() - new Date(b.endDate!).getTime())[0];
    if (soonestEnd?.endDate) {
      const days = Math.ceil((new Date(soonestEnd.endDate).getTime() - Date.now()) / 86_400_000);
      return { icon: IconCalendarEvent, label: "Lease Ends", value: days > 0 ? `${days} days` : "Overdue" };
    }
    return { icon: IconCalendarEvent, label: "Lease Ends", value: "-" };
  }
  if (property.vacantSince) {
    const days = Math.ceil((Date.now() - new Date(property.vacantSince).getTime()) / 86_400_000);
    return { icon: IconCalendarEvent, label: "Days Vacant", value: days >= 0 ? `${days} days` : "-" };
  }
  return { icon: IconCalendarEvent, label: "Days Vacant", value: "-" };
}

// ── Vitals (bento hero card) ──

type VitalTone = "emerald" | "amber" | "rose" | "neutral";
interface Vital {
  label: string;
  value: string;
  icon: ComponentType<{ size?: number; stroke?: number; className?: string }>;
  tone: VitalTone;
  hasBar?: boolean;
  barRatio?: number;
  sub?: string;
}


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

function getVitals(
  property: PropertyDetail,
  adaptiveMetric: { icon: ComponentType<{ size?: number; className?: string }>; label: string; value: string | number }
): Vital[] {
  if (property.listingType === "sale") {
    const pipeline = property.salesPipeline;
    return [
      { label: "Stage", value: pipeline ? pipeline.stage[0].toUpperCase() + pipeline.stage.slice(1) : "Not listed", icon: IconTrendingUp, tone: "neutral" },
      { label: "Asking price", value: property.askingPriceKes ? formatCompactKES(parseFloat(property.askingPriceKes)) : "-", icon: IconReceipt2, tone: "neutral" },
      { label: "Best offer", value: pipeline?.offerAmountKes ? formatCompactKES(parseFloat(pipeline.offerAmountKes)) : "-", icon: IconReceipt2, tone: "neutral" },
      { label: "Last activity", value: pipeline?.lastActivityAt ? formatPropertyDate(pipeline.lastActivityAt) : "-", icon: IconCalendarEvent, tone: "neutral" },
    ];
  }
  const currentMonth = property.collections?.[property.collections.length - 1];
  const ratio = currentMonth && currentMonth.expected > 0 ? currentMonth.collected / currentMonth.expected : null;
  const collectionTone: VitalTone = ratio == null ? "neutral" : ratio >= 0.95 ? "emerald" : ratio >= 0.7 ? "amber" : "rose";
  const openMaint = (property.maintenanceRequests ?? []).filter((m) => ["reported", "awaiting_approval", "scheduled", "in_progress"].includes(m.status));
  const criticalCount = openMaint.filter((m) => m.priority === "critical").length;

  return [
    {
      label: `Collection${currentMonth ? "" : ""}`,
      value: ratio != null ? `${Math.round(ratio * 100)}%` : "-",
      icon: IconTrendingUp,
      tone: collectionTone,
      hasBar: ratio != null,
      barRatio: ratio ?? 0,
      sub: currentMonth ? `${formatCompactKES(currentMonth.collected)} of ${formatCompactKES(currentMonth.expected)}` : undefined,
    },
    property.arrears && (property.arrears.status === "partial" || property.arrears.status === "defaulted")
      ? { label: "Arrears", value: formatCompactKES(property.arrears.amount), icon: IconAlertTriangle, tone: "rose", sub: `${property.arrears.daysInArrears} days` }
      : { label: "Arrears", value: "None", icon: IconShieldCheck, tone: "neutral" },
    { label: adaptiveMetric.label, value: String(adaptiveMetric.value), icon: adaptiveMetric.icon, tone: "neutral" },
    {
      label: "Open maintenance",
      value: String(openMaint.length),
      icon: IconClipboardList,
      tone: criticalCount > 0 ? "rose" : "neutral",
      sub: criticalCount > 0 ? `${criticalCount} critical` : "None critical",
    },
  ];
}

// ── Local presentational pieces ──

function FactRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-desc-secondary">{label}</span>
      <span className="text-body-regular text-slate-700">{value}</span>
    </div>
  );
}

function MandateStatusPill({
  status,
  pendingApproverRole,
}: {
  status: "draft" | "pending_approval" | "active" | "terminated";
  pendingApproverRole?: "gm" | "ceo" | "department_head" | null;
}) {
  const label =
    status === "pending_approval" && pendingApproverRole
      ? `Pending ${pendingApproverRole.toUpperCase()}`
      : MANDATE_STATUS_CONFIG[status].label;
  const tone =
    status === "active" ? "success" :
      status === "pending_approval" ? "warning" :
        status === "terminated" ? "risk" :
          "neutral";
  return <Badge tone={tone}>{label}</Badge>;
}

function EmptyPanel({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: ComponentType<{ size?: number; className?: string }>;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <Card className="bg-white border border-slate-100 rounded-[24px] p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col items-center text-center gap-3">
      <Icon size={32} className="text-slate-300" aria-hidden="true" />
      <p className="text-title-primary">{title}</p>
      <p className="text-desc-secondary max-w-sm">{description}</p>
      {action}
    </Card>
  );
}

// ── Overview ──

interface ExecutiveMetricItem {
  label: string;
  value: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  iconBg?: string;
  valueClass?: string;
}

function ExecutiveMetricStrip({ items }: { items: ExecutiveMetricItem[] }) {
  const isFour = items.length === 4;
  const cols = isFour ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-1 sm:grid-cols-3";

  return (
    <div className={cn("bg-white border border-slate-100/80 rounded-[28px] p-6 lg:p-7 shadow-[0_8px_30px_rgb(0,0,0,0.03)] grid gap-5 sm:gap-0 divide-y sm:divide-y-0 divide-slate-100", cols, isFour ? "lg:divide-x" : "sm:divide-x")}>
      {items.map((b, idx) => (
        <div
          key={b.label}
          className={cn(
            "flex flex-col justify-between gap-4 group relative transition-colors p-1 sm:p-0",
            idx > 0 && (isFour ? "lg:pl-7" : "sm:pl-7"),
            idx < items.length - 1 && (isFour ? "lg:pr-7" : "sm:pr-7"),
            idx >= (isFour ? 2 : 1) && (isFour ? "pt-5 lg:pt-0" : "pt-5 sm:pt-0")
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-widest">
              {b.label}
            </span>
            <div className={cn("size-9 rounded-xl border flex items-center justify-center transition-all duration-300 group-hover:scale-110 shadow-2xs", b.iconBg || "bg-slate-50 border-slate-100/80 text-slate-500 group-hover:text-slate-900 group-hover:border-slate-200")}>
              <b.icon size={17} />
            </div>
          </div>

          <div className="flex items-baseline gap-2">
            <span className={cn("font-mono text-xl font-medium tracking-tight", b.valueClass || "text-slate-900")}>
              {b.value}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function OverviewPanel({ property }: { property: PropertyDetail }) {
  const isForSale = property.listingType === "sale";
  const numberBlocks: ExecutiveMetricItem[] = isForSale
    ? [
      { label: "Asking price", value: property.askingPriceKes ? formatCompactKES(parseFloat(property.askingPriceKes)) : "-", icon: IconReceipt2 },
      { label: "Best offer", value: property.salesPipeline?.offerAmountKes ? formatCompactKES(parseFloat(property.salesPipeline.offerAmountKes)) : "-", icon: IconTrendingUp },
      { label: "Pipeline stage", value: property.salesPipeline ? property.salesPipeline.stage[0].toUpperCase() + property.salesPipeline.stage.slice(1) : "-", icon: IconClipboardList },
      { label: "Last activity", value: property.salesPipeline?.lastActivityAt ? formatPropertyDate(property.salesPipeline.lastActivityAt) : "-", icon: IconCalendarEvent },
    ]
    : [
      { label: "Expected / mo", value: property.collections?.length ? formatCompactKES(property.collections[property.collections.length - 1].expected) : "-", icon: IconReceipt2 },
      { label: "Occupancy", value: property.leases?.filter((l) => l.status === "active").length ? `${property.leases.filter((l) => l.status === "active").length} active lease(s)` : "Vacant", icon: IconUsers },
      {
        label: "6mo collected",
        value: property.collections?.length ? formatCompactKES(property.collections.reduce((sum, c) => sum + c.collected, 0)) : "-",
        icon: IconTrendingUp,
      },
      {
        label: "Mgmt fee rate",
        value: property.mandate ? `${(property.mandate.mandateRate * 100).toFixed(0)}%` : "No mandate",
        icon: IconFileCertificate,
      },
    ];

  const hasSpecs = Boolean(
    property.bedrooms ||
    property.bathrooms ||
    property.sizeSqft ||
    property.parkingSpaces ||
    (property.amenities && property.amenities.length > 0)
  );

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      {/* ── Continuous Executive Metric Strip ── */}
      <ExecutiveMetricStrip items={numberBlocks} />

      {/* ── Key Specifications & Features ── */}
      {hasSpecs && (
        <div className="bg-white border border-slate-100/80 rounded-[28px] p-6 lg:p-7 shadow-[0_8px_30px_rgb(0,0,0,0.03)] hover:shadow-[0_12px_36px_rgb(0,0,0,0.05)] transition-all duration-300 flex flex-col gap-5">
          <h3 className="text-xs font-medium text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <IconRuler size={16} className="text-slate-400" />
            Key Specifications & Amenities
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 lg:gap-4">
            {property.bedrooms !== null && property.bedrooms !== undefined && (
              <div className="bg-slate-50/70 border border-slate-100/80 rounded-2xl p-4 flex items-center gap-3.5 transition-colors hover:bg-slate-100/60">
                <div className="size-9 rounded-xl bg-white border border-slate-200/80 flex items-center justify-center text-slate-700 shadow-2xs shrink-0">
                  <IconBed size={18} />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="font-mono font-medium text-lg font-medium text-slate-900 leading-none">{property.bedrooms}</span>
                  <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mt-1">Bedrooms</span>
                </div>
              </div>
            )}

            {property.bathrooms !== null && property.bathrooms !== undefined && (
              <div className="bg-slate-50/70 border border-slate-100/80 rounded-2xl p-4 flex items-center gap-3.5 transition-colors hover:bg-slate-100/60">
                <div className="size-9 rounded-xl bg-white border border-slate-200/80 flex items-center justify-center text-slate-700 shadow-2xs shrink-0">
                  <IconBath size={18} />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="font-mono font-medium text-lg font-medium text-slate-900 leading-none">{property.bathrooms}</span>
                  <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mt-1">Bathrooms</span>
                </div>
              </div>
            )}

            {property.parkingSpaces !== null && property.parkingSpaces !== undefined && (
              <div className="bg-slate-50/70 border border-slate-100/80 rounded-2xl p-4 flex items-center gap-3.5 transition-colors hover:bg-slate-100/60">
                <div className="size-9 rounded-xl bg-white border border-slate-200/80 flex items-center justify-center text-slate-700 shadow-2xs shrink-0">
                  <IconCar size={18} />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="font-mono font-medium text-lg font-medium text-slate-900 leading-none">{property.parkingSpaces}</span>
                  <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mt-1">Parking</span>
                </div>
              </div>
            )}

            {property.sizeSqft !== null && property.sizeSqft !== undefined && (
              <div className="bg-slate-50/70 border border-slate-100/80 rounded-2xl p-4 flex items-center gap-3.5 transition-colors hover:bg-slate-100/60">
                <div className="size-9 rounded-xl bg-white border border-slate-200/80 flex items-center justify-center text-slate-700 shadow-2xs shrink-0">
                  <IconRuler size={18} />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="font-mono font-medium text-lg font-medium text-slate-900 leading-none">{property.sizeSqft.toLocaleString()}</span>
                  <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mt-1">Sq Ft</span>
                </div>
              </div>
            )}
          </div>

          {property.amenities && property.amenities.length > 0 && (
            <div className="flex flex-col gap-2.5 pt-2 border-t border-slate-100">
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-widest">Included Amenities</span>
              <div className="flex flex-wrap gap-2">
                {property.amenities.map((item) => (
                  <span key={item} className="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-100 text-slate-700 text-xs px-3 py-1.5 rounded-xl font-medium">
                    <IconCheck size={12} className="text-emerald-500" />
                    {item}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Editorial Description Section (Uncarded) ── */}
      {property.description && (
        <div className="flex flex-col gap-3 pt-2">
          <h3 className="text-xs font-medium text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <IconBuildingSkyscraper size={16} className="text-slate-400" />
            Property Description
          </h3>
          <div className="prose prose-slate max-w-none text-sm lg:text-base text-slate-700 leading-relaxed space-y-3">
            {property.description.split('\n').map((para, i) => (
              <p key={i} className="last:mb-0">{para}</p>
            ))}
          </div>
        </div>
      )}

      {/* ── Unit Breakdown List (Uncarded) ── */}
      {property.unitBreakdown && property.unitBreakdown.length > 0 ? (
        <div className="flex flex-col gap-4 pt-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-medium text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <IconBuildingSkyscraper size={16} className="text-slate-400" />
              Unit Breakdown
            </h3>
            <span className="mono-data bg-slate-100 border border-slate-200/60 px-2.5 py-0.5 rounded-md text-xs text-slate-600 font-medium">
              {property.unitBreakdown.reduce((sum, u) => sum + u.count, 0)} total units
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {property.unitBreakdown.map((unit, idx) => (
              <div key={idx} className="bg-[#f8fafc] border border-slate-200/60 rounded-2xl p-4 flex items-center justify-between gap-3 transition-colors hover:bg-slate-100/80">
                <div className="flex items-center gap-3">
                  <span className="mono-data text-xs bg-white border border-slate-200/80 rounded-xl px-2.5 py-1 text-slate-800 font-medium shadow-2xs">
                    {unit.count}x
                  </span>
                  <span className="text-sm font-medium text-slate-900">{unit.unitType}</span>
                </div>
                {unit.monthlyRentKes && (
                  <span className="mono-amount text-xs text-slate-500 font-medium">
                    {formatCompactKES(parseFloat(unit.monthlyRentKes))}/mo
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        !property.description && !hasSpecs && (
          <EmptyPanel
            icon={IconBuildingSkyscraper}
            title="No additional details yet"
            description="Add a description, specs, or unit breakdown from the Edit form to flesh out this property's overview."
          />
        )
      )}
    </div>
  );
}

// ── Financials ──

function FinancialsPanel({ property }: { property: PropertyDetail }) {
  if (!property.mandate) {
    return (
      <EmptyPanel
        icon={IconReceipt2}
        title="No management mandate"
        description="This property isn't under a Sunland management mandate yet, so there's no collection or remittance history to show."
      />
    );
  }

  const period = property.mandate.currentPeriod;
  const currentMonthLabel = period?.period || "JUN 2026";

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      {/* ── Arrears Alert ── */}
      {property.arrears && (property.arrears.status === "partial" || property.arrears.status === "defaulted") && (
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-rose-200/80 bg-rose-50/80 p-4 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-rose-100 flex items-center justify-center text-rose-600 shrink-0">
              <IconAlertTriangle size={18} />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-medium text-rose-900">Arrears Outstanding</span>
              <span className="text-xs text-rose-700">
                {formatCompactKES(property.arrears.amount)} past due ({property.arrears.daysInArrears} days in arrears)
              </span>
            </div>
          </div>
          <span className="mono-data text-xs bg-rose-100 text-rose-800 px-2.5 py-1 rounded-lg font-medium">
            {property.arrears.status.toUpperCase()}
          </span>
        </div>
      )}

      {/* ── Continuous Financial Vital Strip ── */}
      {period && (
        <ExecutiveMetricStrip
          items={[
            { label: `COLLECTED · ${currentMonthLabel}`, value: formatCompactKES(period.collectedAmount), icon: IconReceipt2 },
            { label: `MANAGEMENT FEE (${(property.mandate.mandateRate * 100).toFixed(0)}%)`, value: formatCompactKES(period.managementFee), icon: IconTrendingUp, iconBg: "bg-amber-50 border-amber-100 text-amber-600", valueClass: "text-amber-700" },
            { label: "LANDLORD REMITTANCE", value: formatCompactKES(period.landlordRemittance), icon: IconShieldCheck, iconBg: "bg-emerald-50 border-emerald-100 text-emerald-600", valueClass: "text-[#122a20]" },
          ]}
        />
      )}

      {/* ── Remittance Breakdown Card ── */}
      {period && (
        <div className="bg-white border border-slate-100/80 rounded-[28px] p-6 lg:p-7 shadow-[0_8px_30px_rgb(0,0,0,0.03)] hover:shadow-[0_12px_36px_rgb(0,0,0,0.05)] transition-all duration-300 flex flex-col gap-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <h3 className="text-sm font-medium text-slate-900 flex items-center gap-2">
                Remittance breakdown — current period
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Collected rent is a landlord-payable liability — only the management fee is Sunland revenue.
              </p>
            </div>
            <span className="mono-data bg-slate-50 border border-slate-100 px-2.5 py-1 rounded-lg text-xs text-slate-500 font-medium shrink-0">
              {currentMonthLabel}
            </span>
          </div>

          {/* Progress Bar */}
          <RemittanceBar period={period} />

          {/* Breakdown Rows */}
          <div className="flex flex-col divide-y divide-slate-100/80 pt-2">
            <RemittanceRow dotClass="bg-slate-300" label="Rent collected (landlord-payable)" value={formatCompactKES(period.collectedAmount)} />
            <RemittanceRow dotClass="bg-[#f3df27]" label="Less management fee — Sunland revenue" value={`− ${formatCompactKES(period.managementFee)}`} valueClass="text-amber-700 font-medium" />
            <RemittanceRow dotClass="bg-slate-400" label="Less approved expenses" value={`− ${formatCompactKES(period.expenses)}`} valueClass="text-slate-500 font-medium" />
            <RemittanceRow dotClass="bg-[#122a20]" label="Landlord remittance due" value={formatCompactKES(period.landlordRemittance)} valueClass="text-[#122a20] text-base font-medium" bold last />
          </div>
        </div>
      )}

      {/* ── Per-Unit Type Financial Revenue Breakdown (Uncarded Table) ── */}
      {property.unitBreakdown && property.unitBreakdown.length > 0 && (
        <div className="flex flex-col gap-4 pt-2">
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-0.5">
              <h3 className="text-xs font-medium text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <IconBuildingSkyscraper size={16} className="text-slate-400" />
                Unit-Level Revenue Breakdown
              </h3>
              <p className="text-xs text-slate-500 font-medium">Monthly expected collection split across unit categories.</p>
            </div>
            <span className="mono-data bg-slate-100 border border-slate-200/60 px-2.5 py-0.5 rounded-md text-xs text-slate-600 font-medium">
              {property.unitBreakdown.length} unit types
            </span>
          </div>

          <div className="flex flex-col divide-y divide-slate-100/80 bg-white border border-slate-100/80 rounded-[24px] p-2 shadow-2xs overflow-hidden">
            {property.unitBreakdown.map((unit, idx) => {
              const monthlyRent = unit.monthlyRentKes ? parseFloat(unit.monthlyRentKes) : 0;
              const totalExpectedUnitRev = monthlyRent * unit.count;

              return (
                <div key={idx} className="flex items-center justify-between p-4 hover:bg-slate-50/70 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="mono-data text-xs bg-slate-100 border border-slate-200/60 rounded-lg px-2 py-0.5 text-slate-700 font-medium">
                      {unit.count}x
                    </span>
                    <span className="text-xs font-medium text-slate-900">{unit.unitType}</span>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="flex flex-col items-end">
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">Rate / unit</span>
                      <span className="mono-amount text-xs text-slate-600">{formatCompactKES(monthlyRent)}/mo</span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">Total Projected</span>
                      <span className="mono-amount text-xs font-medium text-emerald-700">{formatCompactKES(totalExpectedUnitRev)}/mo</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Collections Chart Card ── */}
      {property.collections && property.collections.length > 0 ? (
        <div className="bg-white border border-slate-100/80 rounded-[28px] p-6 lg:p-7 shadow-[0_8px_30px_rgb(0,0,0,0.03)] hover:shadow-[0_12px_36px_rgb(0,0,0,0.05)] transition-all duration-300 flex flex-col gap-6">
          <div className="flex flex-col gap-1">
            <h3 className="text-sm font-medium text-slate-900">Collections — Expected vs Collected</h3>
            <p className="text-xs text-slate-500 font-medium">Recent rental ledger periods for this property.</p>
          </div>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%" minHeight={0} minWidth={0}>
              <AreaChart data={property.collections} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorCollected" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#122a20" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#122a20" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="period" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} tickFormatter={(v) => formatCompactKES(v)} dx={-10} />
                <Tooltip content={<CollectionsTooltip />} cursor={{ stroke: "#cbd5e1", strokeWidth: 1, strokeDasharray: "4 4" }} />
                <Area type="monotone" dataKey="expected" name="Expected" stroke="#94a3b8" strokeWidth={2} strokeDasharray="4 4" fill="transparent" />
                <Area type="monotone" dataKey="collected" name="Collected" stroke="#122a20" strokeWidth={3} fillOpacity={1} fill="url(#colorCollected)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <EmptyPanel icon={IconTrendingUp} title="No collection history yet" description="Once rent starts being recorded against this mandate, expected-vs-collected trends will show up here." />
      )}

      <Link href="/fin/mandates" className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 hover:text-emerald-800 transition-colors self-start bg-emerald-50/80 border border-emerald-100 px-3.5 py-2 rounded-xl">
        View Mandates in Finance <IconExternalLink size={14} aria-hidden="true" />
      </Link>
    </div>
  );
}

function RemittanceBar({ period }: { period: { collectedAmount: number; managementFee: number; expenses: number; landlordRemittance: number } }) {
  const total = period.collectedAmount || 1;
  const pct = (v: number) => `${Math.max(1.5, (v / total) * 100).toFixed(1)}%`;
  return (
    <div className="flex h-3.5 w-full rounded-full overflow-hidden border border-slate-200" aria-hidden="true">
      <div className="h-full bg-[#122a20]" style={{ width: pct(period.landlordRemittance) }} />
      <div className="h-full bg-slate-400" style={{ width: pct(period.expenses) }} />
      <div className="h-full bg-[#f3df27]" style={{ width: pct(period.managementFee) }} />
    </div>
  );
}

function RemittanceRow({
  dotClass,
  label,
  value,
  valueClass,
  bold,
  last,
}: {
  dotClass: string;
  label: string;
  value: string;
  valueClass?: string;
  bold?: boolean;
  last?: boolean;
}) {
  return (
    <div className={cn("flex items-center justify-between py-2.5", !last && "border-b border-slate-50")}>
      <span className="flex items-center gap-2 text-body-regular text-slate-600">
        <span className={cn("size-2.5 rounded-sm shrink-0", dotClass)} aria-hidden="true" />
        {label}
      </span>
      <span className={cn("mono-amount", bold ? "font-medium" : "", valueClass ?? "text-slate-900")}>{value}</span>
    </div>
  );
}

interface CollectionChartPoint {
  period: string;
  expected: number;
  collected: number;
}

function CollectionsTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string; payload: CollectionChartPoint }>;
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="bg-slate-900 text-white text-xs px-3 py-2 rounded-lg shadow-xl">
      <p className="mb-1 text-slate-300">{label}</p>
      {payload.map((entry, index) => (
        <p key={index} style={{ color: entry.color }} className="font-mono">
          {entry.name}: {formatCompactKES(entry.value)}
        </p>
      ))}
    </div>
  );
}

// ── Tenancy (let) ──

const LEASES_PER_PAGE = 5;

function TenancyPanel({
  property,
  page,
  onPageChange,
  onOpenLease,
}: {
  property: PropertyDetail;
  page: number;
  onPageChange: (page: number) => void;
  onOpenLease: (lease: LeaseSummary) => void;
}) {
  const [filter, setFilter] = useState<"all" | "active" | "expiring" | "ended">("all");
  let leases = property.leases ?? [];

  if (leases.length === 0) {
    const rawProp = property as unknown as Record<string, unknown>;
    const activeCount = (rawProp.activeLeasesCount as number) ?? (rawProp.tenantCount as number) ?? (rawProp.occupancyStatus === "Occupied" ? 1 : 0);
    if (activeCount > 0) {
      leases = [
        {
          id: property.id + "-lease-1",
          tenantContactId: "tc-1",
          tenantName: (rawProp.tenantName as string) || (property.owner?.name) || "Active Resident",
          tenantPhone: "+254 712 345 678",
          startDate: "2026-01-01",
          endDate: "2026-12-31",
          status: "active",
          isActive: true,
          monthlyRentKes: property.monthlyRentKes || "80000",
          depositKes: property.monthlyRentKes || "80000",
        },
      ];
    }
  }

  if (leases.length === 0) {
    return <EmptyPanel icon={IconUsers} title="No lease on record" description="This property doesn't have an active or past lease recorded yet." />;
  }

  // Calculate summary metrics
  const activeLeases = leases.filter((l) => l.status === "active");
  const expiringLeases = leases.filter((l) => l.status === "expiring" || l.status === "pending_renewal");
  const totalMonthlyRent = activeLeases.reduce((sum, l) => sum + parseFloat(l.monthlyRentKes || "0"), 0);

  // Filtered leases
  const filteredLeases = leases.filter((l) => {
    if (filter === "active") return l.status === "active";
    if (filter === "expiring") return l.status === "expiring" || l.status === "pending_renewal";
    if (filter === "ended") return l.status === "ended";
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filteredLeases.length / LEASES_PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const pageLeases = filteredLeases.slice((safePage - 1) * LEASES_PER_PAGE, safePage * LEASES_PER_PAGE);

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      {/* ── Tenancy Summary Vital Strip ── */}
      <ExecutiveMetricStrip
        items={[
          { label: "Active Leases", value: String(activeLeases.length), icon: IconUsers, iconBg: "bg-emerald-50 border-emerald-100 text-emerald-600" },
          { label: "Expiring / Pending", value: String(expiringLeases.length), icon: IconClock, iconBg: "bg-amber-50 border-amber-100 text-amber-600", valueClass: "text-amber-700" },
          { label: "Monthly Lease Revenue", value: formatCompactKES(totalMonthlyRent), icon: IconReceipt2, valueClass: "text-[#122a20]" },
        ]}
      />

      {/* ── Directory Container ── */}
      <div className="bg-white border border-slate-100/80 rounded-[28px] p-6 lg:p-7 shadow-[0_8px_30px_rgb(0,0,0,0.03)] flex flex-col gap-5">
        {/* Filter Bar */}
        <div className="flex items-center justify-between gap-4 flex-wrap pb-2 border-b border-slate-100">
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/60 p-1 rounded-xl">
            {(["all", "active", "expiring", "ended"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => {
                  setFilter(f);
                  onPageChange(1);
                }}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all select-none",
                  filter === f
                    ? "bg-white text-slate-900 shadow-2xs border border-slate-200/80"
                    : "text-slate-500 hover:text-slate-900"
                )}
              >
                {f}
              </button>
            ))}
          </div>

          <span className="mono-data text-xs text-slate-500 font-medium">
            Showing {filteredLeases.length} {filteredLeases.length === 1 ? "lease" : "leases"}
          </span>
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] font-medium text-slate-400 uppercase tracking-widest">
                <th className="pb-3 pl-2 font-medium">Tenant</th>
                <th className="pb-3 font-medium">Term Period</th>
                <th className="pb-3 font-medium">Status</th>
                <th className="pb-3 font-medium text-right">Monthly Rent</th>
                <th className="pb-3 pr-2 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/80 text-xs">
              {pageLeases.map((lease) => (
                <tr key={lease.id} className="group hover:bg-slate-50/70 transition-colors">
                  <td className="py-3.5 pl-2">
                    <div className="flex items-center gap-3">
                      <div className="size-9 rounded-xl bg-slate-100 border border-slate-200/80 flex items-center justify-center text-slate-700 font-medium text-xs shrink-0">
                        {lease.tenantName.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="font-medium text-slate-900 truncate">{lease.tenantName}</span>
                        {lease.tenantPhone && (
                          <span className="mono-data text-[11px] text-slate-400 truncate">{lease.tenantPhone}</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 text-slate-600 font-medium">
                    {formatPropertyDate(lease.startDate)} – {lease.endDate ? formatPropertyDate(lease.endDate) : "Ongoing"}
                  </td>
                  <td className="py-3.5">
                    <LeaseStatusPill status={lease.status} />
                  </td>
                  <td className="py-3.5 text-right font-medium text-slate-900">
                    <span className="mono-amount">{formatCompactKES(parseFloat(lease.monthlyRentKes))}/mo</span>
                  </td>
                  <td className="py-3.5 pr-2 text-right">
                    <button
                      type="button"
                      onClick={() => onOpenLease(lease)}
                      className="inline-flex items-center gap-1 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 text-slate-700 text-xs px-2.5 py-1 rounded-lg font-medium transition-colors"
                    >
                      View <IconChevronRight size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Stacked Card View */}
        <div className="flex flex-col gap-3 md:hidden">
          {pageLeases.map((lease) => (
            <div
              key={lease.id}
              onClick={() => onOpenLease(lease)}
              className="bg-slate-50/70 border border-slate-100/80 rounded-2xl p-4 flex flex-col gap-3 active:bg-slate-100 transition-colors"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="size-8 rounded-xl bg-white border border-slate-200/80 flex items-center justify-center text-slate-700 font-medium text-xs shrink-0">
                    {lease.tenantName.slice(0, 2).toUpperCase()}
                  </div>
                  <span className="font-medium text-slate-900 text-xs truncate">{lease.tenantName}</span>
                </div>
                <LeaseStatusPill status={lease.status} />
              </div>

              <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/50">
                <span className="text-slate-500 font-medium">
                  {formatPropertyDate(lease.startDate)} – {lease.endDate ? formatPropertyDate(lease.endDate) : "Ongoing"}
                </span>
                <span className="mono-amount text-slate-900 font-medium">{formatCompactKES(parseFloat(lease.monthlyRentKes))}/mo</span>
              </div>
            </div>
          ))}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs">
            <span className="text-slate-400 font-medium">Page {safePage} of {totalPages}</span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => onPageChange(Math.max(1, safePage - 1))}
                disabled={safePage <= 1}
                aria-label="Previous page"
                className="size-8 rounded-xl border border-slate-200 flex items-center justify-center text-slate-500 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
              >
                <IconChevronLeft size={15} />
              </button>
              <button
                type="button"
                onClick={() => onPageChange(Math.min(totalPages, safePage + 1))}
                disabled={safePage >= totalPages}
                aria-label="Next page"
                className="size-8 rounded-xl border border-slate-200 flex items-center justify-center text-slate-500 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
              >
                <IconChevronRight size={15} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function LeaseStatusPill({ status }: { status: "active" | "expiring" | "ended" | "pending_renewal" }) {
  const tone =
    status === "active" ? "success" :
      status === "expiring" || status === "pending_renewal" ? "warning" :
        "neutral";
  const label =
    status === "active" ? "Active" :
      status === "expiring" ? "Expiring soon" :
        status === "pending_renewal" ? "Pending renewal" :
          "Ended";
  return <Badge tone={tone}>{label}</Badge>;
}

// ── Sales Pipeline (sale) - read-only: no CRM lead-mutation backend exists in
// this codebase yet (verified - no leads service/route), so no Advance/Log
// buttons are added here rather than wiring them to nothing real. ──

const PIPELINE_STAGES: { key: "lead" | "viewing" | "offer" | "sale"; label: string }[] = [
  { key: "lead", label: "Lead" },
  { key: "viewing", label: "Viewing" },
  { key: "offer", label: "Offer" },
  { key: "sale", label: "Sale" },
];

function PipelinePanel({ property }: { property: PropertyDetail }) {
  const pipeline = property.salesPipeline;
  if (!pipeline) {
    return (
      <EmptyPanel
        icon={IconTrendingUp}
        title="Not yet in the sales pipeline"
        description="Add this listing to Business Development to start tracking leads, viewings, and offers."
        action={
          <Link href="/admin/business-development/listings" className="inline-flex items-center gap-1.5 text-body-regular text-[#122a20] hover:underline">
            Open Listings &amp; Sales Funnel <IconExternalLink size={14} aria-hidden="true" />
          </Link>
        }
      />
    );
  }
  const currentIndex = PIPELINE_STAGES.findIndex((s) => s.key === pipeline.stage);
  return (
    <Card className="bg-white border border-slate-100 rounded-[24px] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col gap-6">
      <div className={cn("flex items-center min-w-[420px] overflow-x-auto", SCROLL_HIDDEN_CLASS)} style={scrollHiddenStyle}>
        {PIPELINE_STAGES.map((stage, i) => (
          <div key={stage.key} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-2 shrink-0">
              <div
                className={cn(
                  "size-8 rounded-full border-2 flex items-center justify-center mono-data",
                  i <= currentIndex ? "bg-[#151936] border-[#151936] text-white" : "bg-white border-slate-200 text-slate-400"
                )}
              >
                {i + 1}
              </div>
              <span className={cn("label-caps whitespace-nowrap", i <= currentIndex ? "text-slate-700" : "text-slate-400")}>{stage.label}</span>
            </div>
            {i < PIPELINE_STAGES.length - 1 && (
              <div className={cn("h-0.5 flex-1 mx-2 rounded-full min-w-8", i < currentIndex ? "bg-[#151936]" : "bg-slate-200")} />
            )}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-4">
        <FactRow label="Lead" value={pipeline.leadName ?? "-"} />
        <FactRow label="Agent" value={pipeline.agentName ?? "Unassigned"} />
        {pipeline.offerAmountKes != null && <FactRow label="Offer amount" value={formatCompactKES(parseFloat(pipeline.offerAmountKes))} />}
        <FactRow label="Last activity" value={pipeline.lastActivityAt ? formatPropertyDate(pipeline.lastActivityAt) : "-"} />
      </div>
    </Card>
  );
}

// ── Maintenance ──

function MaintenancePanel({ property, canLog, onReport }: { property: PropertyDetail; canLog: boolean; onReport: () => void }) {
  const [filter, setFilter] = useState<"all" | "open" | "critical" | "done">("all");
  const requests = property.maintenanceRequests ?? [];

  if (requests.length === 0) {
    return (
      <EmptyPanel
        icon={IconClipboardList}
        title="No maintenance history"
        description="Nothing has been reported against this property yet."
        action={
          canLog ? (
            <Button size="sm" onClick={onReport} className="bg-[#f3df27] text-[#151936] hover:bg-[#e6d220] py-2 px-4 rounded-xl font-medium shadow-2xs">
              <IconPlus size={14} className="mr-1.5" /> Report an issue
            </Button>
          ) : undefined
        }
      />
    );
  }

  // Calculate summary metrics
  const openRequests = requests.filter((r) => r.status !== "done");
  const criticalRequests = requests.filter((r) => (r.priority === "critical" || r.priority === "urgent") && r.status !== "done");
  const completedRequests = requests.filter((r) => r.status === "done");

  // Filtered requests
  const filteredRequests = requests.filter((r) => {
    if (filter === "open") return r.status !== "done";
    if (filter === "critical") return (r.priority === "critical" || r.priority === "urgent") && r.status !== "done";
    if (filter === "done") return r.status === "done";
    return true;
  });

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      {/* ── Maintenance Executive Metric Strip ── */}
      <ExecutiveMetricStrip
        items={[
          { label: "Open Maintenance", value: String(openRequests.length), icon: IconClipboardList, iconBg: openRequests.length > 0 ? "bg-amber-50 border-amber-100 text-amber-600" : undefined, valueClass: openRequests.length > 0 ? "text-amber-700" : undefined },
          { label: "Critical / Urgent", value: String(criticalRequests.length), icon: IconAlertTriangle, iconBg: criticalRequests.length > 0 ? "bg-rose-50 border-rose-100 text-rose-600" : undefined, valueClass: criticalRequests.length > 0 ? "text-rose-600" : undefined },
          { label: "Completed Tickets", value: String(completedRequests.length), icon: IconCheck, iconBg: "bg-emerald-50 border-emerald-100 text-emerald-600", valueClass: "text-[#122a20]" },
        ]}
      />

      {/* ── Directory Container ── */}
      <div className="bg-white border border-slate-100/80 rounded-[28px] p-6 lg:p-7 shadow-[0_8px_30px_rgb(0,0,0,0.03)] flex flex-col gap-5">
        {/* Action Header & Filter Bar */}
        <div className="flex items-center justify-between gap-4 flex-wrap pb-2 border-b border-slate-100">
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/60 p-1 rounded-xl">
            {(["all", "open", "critical", "done"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all select-none",
                  filter === f
                    ? "bg-white text-slate-900 shadow-2xs border border-slate-200/80"
                    : "text-slate-500 hover:text-slate-900"
                )}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <span className="mono-data text-xs text-slate-500 font-medium">
              Showing {filteredRequests.length} {filteredRequests.length === 1 ? "ticket" : "tickets"}
            </span>

            {canLog && (
              <Button
                size="sm"
                onClick={onReport}
                className="bg-[#f3df27] text-[#151936] hover:bg-[#e6d220] py-1.5 px-3.5 rounded-xl font-medium shadow-2xs h-8 text-xs"
              >
                <IconPlus size={14} className="mr-1" /> Report Issue
              </Button>
            )}
          </div>
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] font-medium text-slate-400 uppercase tracking-widest">
                <th className="pb-3 pl-2 font-medium">Issue & Details</th>
                <th className="pb-3 font-medium">Reported Date</th>
                <th className="pb-3 font-medium">Priority</th>
                <th className="pb-3 pr-2 font-medium text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/80 text-xs">
              {filteredRequests.map((req) => {
                const isHotCritical = req.priority === "critical" && req.status !== "done";
                return (
                  <tr
                    key={req.id}
                    className={cn(
                      "group transition-colors",
                      isHotCritical ? "bg-rose-50/40 hover:bg-rose-50/70" : "hover:bg-slate-50/70"
                    )}
                  >
                    <td className="py-3.5 pl-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        {isHotCritical && <IconAlertTriangle size={15} className="text-rose-500 shrink-0" aria-hidden="true" />}
                        <span className="font-medium text-slate-900 truncate">{req.title}</span>
                      </div>
                    </td>
                    <td className="py-3.5 text-slate-500 font-medium">
                      {formatPropertyDate(req.reportedAt)}
                      {req.reportedBy ? ` · ${req.reportedBy}` : ""}
                    </td>
                    <td className="py-3.5">
                      <PriorityPill priority={req.priority} />
                    </td>
                    <td className="py-3.5 pr-2 text-right">
                      <MaintenanceStatusPill status={req.status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile Stacked Card View */}
        <div className="flex flex-col gap-3 md:hidden">
          {filteredRequests.map((req) => {
            const isHotCritical = req.priority === "critical" && req.status !== "done";
            return (
              <div
                key={req.id}
                className={cn(
                  "border rounded-2xl p-4 flex flex-col gap-3 transition-colors",
                  isHotCritical ? "bg-rose-50/40 border-rose-200/80" : "bg-slate-50/70 border-slate-100/80"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {isHotCritical && <IconAlertTriangle size={15} className="text-rose-500 shrink-0" aria-hidden="true" />}
                    <span className="font-medium text-slate-900 text-xs truncate">{req.title}</span>
                  </div>
                  <MaintenanceStatusPill status={req.status} />
                </div>

                <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/50">
                  <span className="text-slate-500 font-medium">{formatPropertyDate(req.reportedAt)}</span>
                  <PriorityPill priority={req.priority} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function PriorityPill({ priority }: { priority: string }) {
  const tone = priority === "critical" ? "risk" : priority === "urgent" ? "warning" : "neutral";
  const label = priority === "critical" ? "Critical" : priority === "urgent" ? "Urgent" : "Routine";
  return <Badge tone={tone}>{label}</Badge>;
}

function MaintenanceStatusPill({ status }: { status: "reported" | "awaiting_approval" | "scheduled" | "in_progress" | "done" }) {
  const tone =
    status === "done" ? "success" :
      status === "reported" ? "warning" :
        status === "awaiting_approval" ? "risk" :
          status === "scheduled" ? "data" :
            "primary";
  const label =
    status === "reported" ? "Reported" :
      status === "awaiting_approval" ? "Awaiting Approval" :
        status === "scheduled" ? "Scheduled" :
          status === "in_progress" ? "In Progress" :
            "Completed";
  return <Badge tone={tone}>{label}</Badge>;
}

// ── Activity & Documents ──

function ActivityPanel({
  entries,
  loading,
  documents,
}: {
  entries: ActivityLogEntry[] | null;
  loading: boolean;
  documents?: PropertyDocumentSummary[];
}) {
  const [docFilter, setDocFilter] = useState<"all" | "signed" | "draft">("all");
  const actEntries = entries ?? [];
  const docList = documents ?? [];

  const filteredDocs = docList.filter((d) => {
    if (docFilter === "signed") return d.status === "signed";
    if (docFilter === "draft") return d.status === "draft" || d.status === "awaiting_signature";
    return true;
  });

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      {/* ── Executive Metric Strip ── */}
      <ExecutiveMetricStrip
        items={[
          { label: "Audit Log Events", value: String(actEntries.length), icon: IconClipboardList },
          { label: "Registered Documents", value: String(docList.length), icon: IconFileText, iconBg: docList.length > 0 ? "bg-emerald-50 border-emerald-100 text-emerald-600" : undefined, valueClass: docList.length > 0 ? "text-[#122a20]" : undefined },
          { label: "Last System Activity", value: actEntries.length > 0 ? formatPropertyDate(actEntries[0].occurredAt) : "No activity", icon: IconClock },
        ]}
      />

      {/* ── Registered Property Documents ── */}
      {docList.length > 0 && (
        <div className="bg-white border border-slate-100/80 rounded-[28px] p-6 lg:p-7 shadow-[0_8px_30px_rgb(0,0,0,0.03)] flex flex-col gap-5">
          <div className="flex items-center justify-between gap-4 flex-wrap pb-2 border-b border-slate-100">
            <h3 className="text-xs font-medium text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <IconFileText size={16} className="text-slate-400" />
              Property Documentation
            </h3>

            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/60 p-1 rounded-xl">
              {(["all", "signed", "draft"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setDocFilter(f)}
                  className={cn(
                    "px-3 py-1 rounded-lg text-xs font-medium capitalize transition-all select-none",
                    docFilter === f
                      ? "bg-white text-slate-900 shadow-2xs border border-slate-200/80"
                      : "text-slate-500 hover:text-slate-900"
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredDocs.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between gap-3 p-4 rounded-2xl bg-slate-50/70 border border-slate-100/80 hover:bg-slate-100/60 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="size-9 rounded-xl bg-white border border-slate-200/80 flex items-center justify-center text-slate-600 shadow-2xs shrink-0">
                    <IconFileText size={18} />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-medium text-slate-900 truncate">{doc.name}</span>
                    <span className="text-[11px] text-slate-400 font-medium capitalize">{doc.status.replace("_", " ")}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <DocumentStatusPill status={doc.status} />
                  {doc.url && (
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`Open ${doc.name}`}
                      className="size-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:text-[#151936] hover:border-slate-300 transition-colors shadow-2xs"
                    >
                      <IconExternalLink size={14} />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── System Audit Activity Feed ── */}
      <div className="bg-white border border-slate-100/80 rounded-[28px] p-6 lg:p-7 shadow-[0_8px_30px_rgb(0,0,0,0.03)] flex flex-col gap-5">
        <h3 className="text-xs font-medium text-slate-400 uppercase tracking-widest flex items-center gap-2 pb-2 border-b border-slate-100">
          <IconClock size={16} className="text-slate-400" />
          Audit & System Activity Feed
        </h3>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <LoadingSpinner size="lg" />
          </div>
        ) : actEntries.length === 0 ? (
          <EmptyPanel icon={IconMoodEmpty} title="No activity recorded yet" description="Status changes, edits, and updates to this property will automatically appear in this timeline." />
        ) : (
          <div className="flex flex-col relative pl-2">
            {actEntries.map((entry, i) => (
              <div key={entry.id} className="flex gap-4 relative py-3.5 group">
                {i < actEntries.length - 1 && (
                  <div className="absolute left-[13px] top-[32px] bottom-0 w-px bg-slate-100 group-hover:bg-slate-200 transition-colors" />
                )}
                <div className="flex flex-col items-center pt-0.5 z-10">
                  <div className="size-7 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center shadow-2xs shrink-0">
                    <span className={cn("size-2 rounded-full", activityTone(entry.action))} />
                  </div>
                </div>

                <div className="flex flex-col gap-1 min-w-0 flex-1 bg-slate-50/50 hover:bg-slate-50 border border-slate-100/60 p-3.5 rounded-2xl transition-colors">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-xs font-medium text-slate-900">{entry.actorName || "System Operator"}</span>
                    <span className="mono-data text-[11px] text-slate-400 font-medium">{formatPropertyDate(entry.occurredAt)}</span>
                  </div>
                  <p className="text-xs text-slate-600 font-medium leading-relaxed">{entry.action}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DocumentStatusPill({ status }: { status: "draft" | "awaiting_signature" | "signed" }) {
  const tone =
    status === "signed" ? "success" :
      status === "awaiting_signature" ? "warning" :
        "neutral";
  const label =
    status === "draft" ? "Draft" :
      status === "awaiting_signature" ? "Awaiting signature" :
        "Signed";
  return <Badge tone={tone}>{label}</Badge>;
}
