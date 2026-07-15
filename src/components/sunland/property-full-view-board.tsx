"use client";


import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  IconAlertTriangle,
  IconBolt,
  IconBuildingSkyscraper,
  IconCalendarEvent,
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
} from "@tabler/icons-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DropdownMenu, DropdownItem } from "@/components/ui/erp-primitives";
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
      (m) => m.priority === "critical" && m.status !== "resolved" && m.status !== "closed"
    );
    list.push({ key: "maintenance", label: "Maintenance", icon: IconClipboardList, dot: openCritical });
    list.push({ key: "activity", label: "Activity", icon: IconHistory });
    return list;
  }, [property, canViewFinance]);

  const mandateLetterDoc = property?.documents?.find((d) => d.type === "mandate_letter");

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
      (m) => m.priority === "critical" && m.status !== "resolved" && m.status !== "closed"
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
        body: JSON.stringify({ action: "terminate", reason: terminateNotes.trim() }),
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
      <div className="flex flex-col gap-5 animate-fade-in-up stagger-1">
        {/* Command Header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 px-1">
          <div className="flex flex-col gap-2.5 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-3xl lg:text-4xl font-serif tracking-tight text-slate-950 truncate">{property.name}</h1>
              {canManage ? (
                <DropdownMenu
                  label="Change status"
                  align="left"
                  trigger={
                    <div role="button" className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wider shadow-sm transition-colors hover:opacity-80 cursor-pointer", statusConfig.pill)}>
                      <span className={cn("size-1.5 rounded-full", statusConfig.dot)} aria-hidden="true" />
                      {statusConfig.label}
                      <IconChevronDown size={14} className="opacity-70 ml-0.5" aria-hidden="true" />
                    </div>
                  }
                >
                  {STATUS_ORDER.map((s) => (
                    <DropdownItem
                      key={s}
                      onClick={() => handleStatusChange(s)}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className={cn("size-2 rounded-full", STATUS_CONFIG[s].dot)} aria-hidden="true" />
                        <span className="uppercase text-xs font-bold tracking-wider text-slate-700">{STATUS_CONFIG[s].label}</span>
                      </div>
                    </DropdownItem>
                  ))}
                </DropdownMenu>
              ) : (
                <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wider", statusConfig.pill)}>
                  <span className={cn("size-1.5 rounded-full", statusConfig.dot)} aria-hidden="true" />
                  {statusConfig.label}
                </span>
              )}
              {property.isFeatured && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/60 bg-amber-500/15 px-3 py-0.5 label-caps text-amber-700">
                  <IconStarFilled size={11} aria-hidden="true" /> Featured
                </span>
              )}
            </div>

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
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap mt-1 sm:mt-0">
            {canManage && actionItems[0]?.primary && (
              <button
                type="button"
                onClick={actionItems[0].onClick}
                className="bg-[#f3df27] text-[#151936] hover:bg-[#e6d220] font-medium text-sm rounded-full px-4 py-2 shadow-[0_2px_10px_rgb(243,223,39,0.3)] transition-all hover:shadow-[0_4px_14px_rgb(243,223,39,0.4)] flex items-center gap-1.5 border border-amber-300/40"
              >
                <IconFileCertificate size={15} /> Review Mandate
              </button>
            )}
            {canManage && canLogMaintenance && (
              <button
                type="button"
                onClick={() => setReportIssueOpen(true)}
                className="bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 border border-slate-200/80 font-medium text-sm rounded-full px-4 py-2 shadow-xs transition-colors flex items-center gap-1.5"
              >
                <IconTool size={14} /> Report Issue
              </button>
            )}
            {canManage && (
              <button
                type="button"
                onClick={() => setEditModalOpen(true)}
                className="bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 border border-slate-200/80 font-medium text-sm rounded-full px-4 py-2 shadow-xs transition-colors flex items-center gap-1.5"
              >
                <IconEdit size={14} /> Edit
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

        {/* ── Bento hero: media + vitals ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-4 lg:gap-5 items-start mt-1">
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => mediaList.length > 0 && setLightboxOpen(true)}
              disabled={mediaList.length === 0}
              aria-label="Open photo gallery"
              className="group relative rounded-[24px] lg:rounded-[32px] overflow-hidden min-h-[280px] lg:min-h-[380px] flex-1 text-left shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all duration-500 hover:shadow-[0_20px_40px_rgb(0,0,0,0.12)] disabled:cursor-default disabled:hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] bg-slate-100/50"
            >
              {primaryImage ? (
                <Image src={primaryImage} alt={mediaList[activeMediaIndex]?.alt ?? property.name} fill sizes="(max-width: 1024px) 100vw, 60vw" className="object-cover transition-transform duration-700 group-hover:scale-105" />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-50">
                  <TypeIcon size={48} className="text-slate-300" />
                </div>
              )}

              {/* Elegant Hover Overlay */}
              {mediaList.length > 0 && (
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-500 flex items-center justify-center">
                  <span className="opacity-0 group-hover:opacity-100 transition-all duration-500 transform translate-y-4 group-hover:translate-y-0 bg-white/95 backdrop-blur-md text-[#151936] font-medium px-5 py-2.5 rounded-full shadow-lg flex items-center gap-2 text-sm border border-white/20">
                    <IconPhoto size={16} aria-hidden="true" /> View {mediaList.length} photos
                  </span>
                </div>
              )}
            </button>

            {/* Deconstructed thumbnail slider */}
            {mediaList.length > 1 && (
              <div className="flex gap-2.5 overflow-x-auto pb-1 mt-1" style={scrollHiddenStyle}>
                {mediaList.map((media, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => setActiveMediaIndex(index)}
                    className={cn(
                      "relative size-[72px] rounded-2xl overflow-hidden border-2 shrink-0 transition-all duration-300",
                      activeMediaIndex === index ? "border-slate-800 scale-95 shadow-sm" : "border-slate-200/60 opacity-70 hover:opacity-100 hover:scale-95"
                    )}
                  >
                    <Image src={media.url} alt={media.alt || `Property photo ${index + 1}`} fill sizes="72px" className="object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3 animate-fade-in-up stagger-2">
            <div className="flex flex-col">
              <div className="flex items-center justify-between mb-3.5 px-1">
                <p className="text-sm font-medium text-slate-800">Vital signs</p>
                <span className="label-caps text-slate-400">{isForSale ? "Pipeline" : formatPropertyDate(new Date().toISOString()).split(" ").slice(1).join(" ")}</span>
              </div>
              <div className="grid grid-cols-2 gap-3.5">
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
                        <span className="text-desc-secondary flex items-center gap-1.5 font-medium">
                          <v.icon size={13} className={VITAL_TONE_ICON[v.tone]} aria-hidden="true" />
                          {v.label}
                        </span>
                        <span className="font-mono font-medium text-slate-900 mt-1 text-3xl truncate leading-none">
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
                            <span className={cn(
                              "mono-data text-xs flex font-medium items-center px-1.5 py-0.5 rounded-md",
                              v.tone === "rose" ? "bg-rose-50 text-rose-700" : "bg-slate-50 text-slate-600"
                            )}>
                              {v.sub}
                            </span>
                          )
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {specLine && (
                <div className="mt-3.5 rounded-[16px] lg:rounded-[20px] bg-slate-50/80 border border-slate-100 px-4 py-3 shadow-[0_2px_10px_rgb(0,0,0,0.02)]">
                  <p className="mono-data text-slate-500 flex items-center justify-center gap-2 font-medium">
                    <IconRuler size={14} className="text-slate-400 shrink-0" aria-hidden="true" />
                    {specLine}
                  </p>
                </div>
              )}
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
          <div
            role="tablist"
            aria-label="Property sections"
            className={cn("flex bg-white border border-slate-100 p-1.5 rounded-[16px] shadow-[0_2px_10px_rgb(0,0,0,0.02)] gap-1 overflow-x-auto flex-nowrap mb-6", SCROLL_HIDDEN_CLASS)}
            style={scrollHiddenStyle}
          >
            {tabs.map((tab) => (
              <button
                key={tab.key}
                role="tab"
                id={`tab-${tab.key}`}
                aria-selected={activeTab === tab.key}
                aria-controls={`panel-${tab.key}`}
                tabIndex={activeTab === tab.key ? 0 : -1}
                onClick={() => setActiveTab(tab.key)}
                onKeyDown={(e) => {
                  if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
                  const idx = tabs.findIndex((t) => t.key === activeTab);
                  const next = e.key === "ArrowRight" ? (idx + 1) % tabs.length : (idx - 1 + tabs.length) % tabs.length;
                  setActiveTab(tabs[next].key);
                }}
                className={cn(
                  "body-sm px-4 py-2 rounded-xl transition-all duration-300 flex items-center gap-2 shrink-0 whitespace-nowrap font-medium",
                  activeTab === tab.key ? "bg-[#151936] text-white shadow-md" : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                )}
              >
                <tab.icon size={15} aria-hidden="true" />
                {tab.label}
                {tab.dot && <span className="size-1.5 rounded-full bg-rose-500 shrink-0" aria-hidden="true" />}
              </button>
            ))}
          </div>

          <div id={`panel-${activeTab}`} role="tabpanel" aria-labelledby={`tab-${activeTab}`}>
            {activeTab === "overview" && (
              <OverviewPanel
                property={property}
                handlers={{
                  canManage,
                  canViewFinance,
                  canDecideMandate,
                  canOverrideMandate,
                  mandateLetterDoc,
                  onVerifyLandlord: () => setVerifyLandlordOpen(true),
                  onAssignManager: () => setAssignManagerOpen(true),
                  onMandateLetter: () => setMandateLetterOpen(true),
                  onDecision: () => setDecisionDrawerOpen(true),
                  onOverride: () => setOverrideModalOpen(true),
                  onTerminate: () => setTerminateMandateOpen(true),
                  onCreateMandate: () => setCreateMandateOpen(true),
                }}
              />
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

        {/* Context rail */}
        <div className="flex flex-col gap-5 pt-[68px]">
          {actionItems.length > 0 && (
            <Card className="bg-white border border-slate-100 rounded-[24px] p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-title-primary">Needs your attention</h3>
                <span className="min-w-[24px] h-[24px] px-1.5 rounded-full bg-rose-500 text-white flex items-center justify-center mono-data text-xs shadow-sm">
                  {actionItems.length}
                </span>
              </div>
              <div className="flex flex-col gap-2.5">
                {actionItems.map((item) => {
                  const t = ACTION_TONE_CLASSES[item.tone];
                  return (
                    <div key={item.key} className={cn("flex items-center justify-between gap-3 rounded-2xl border px-3.5 py-3 shadow-sm transition-all hover:shadow-[0_4px_12px_rgb(0,0,0,0.04)]", t.card)}>
                      <div className="min-w-0">
                        <p className="body-sm text-slate-900 font-medium truncate">{item.title}</p>
                        <p className="label-caps text-slate-500 mt-0.5 truncate">{item.meta}</p>
                      </div>
                      <button type="button" onClick={item.onClick} className={cn("shrink-0 rounded-xl px-3 py-1.5 label-caps transition-colors shadow-sm", t.cta)}>
                        {item.cta}
                      </button>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          <Card className="bg-white border border-slate-100 rounded-[24px] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-title-primary flex items-center gap-2">
                <IconShieldCheck size={18} className="text-slate-400" />
                Ownership
              </h3>
              {property.owner?.verifiedAt && (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300/60 bg-emerald-500/15 px-2.5 py-0.5 label-caps text-emerald-700">
                  <IconShieldCheck size={12} aria-hidden="true" /> Verified
                </span>
              )}
            </div>
            {property.owner ? (
              <div className="flex flex-col gap-4">
                <div className="flex items-start gap-4">
                  <div className="size-12 rounded-full bg-slate-50 border border-slate-200 shadow-sm flex items-center justify-center text-slate-600 mono-data shrink-0">
                    {property.owner.name?.slice(0, 2).toUpperCase() || "??"}
                  </div>
                  <div className="flex flex-col gap-1.5 min-w-0 pt-0.5">
                    <p className="body-sm font-medium text-slate-900 truncate">{property.owner.name || "Unknown"}</p>
                    {property.owner.phone && (
                      <a href={`tel:${property.owner.phone}`} className="body-sm text-slate-500 hover:text-[#122a20] flex items-center gap-2 transition-colors">
                        <IconPhone size={14} className="shrink-0" aria-hidden="true" />
                        <span className="truncate">{property.owner.phone}</span>
                      </a>
                    )}
                    {property.owner.email && (
                      <a href={`mailto:${property.owner.email}`} className="body-sm text-slate-500 hover:text-[#122a20] flex items-center gap-2 transition-colors">
                        <IconMail size={14} className="shrink-0" aria-hidden="true" />
                        <span className="truncate">{property.owner.email}</span>
                      </a>
                    )}
                  </div>
                </div>
                {canManage && (
                  <button
                    type="button"
                    onClick={() => setVerifyLandlordOpen(true)}
                    className="mt-1 inline-flex items-center justify-center gap-1.5 w-full rounded-xl bg-white border border-slate-200 px-4 py-2 label-caps text-slate-700 hover:bg-slate-50 hover:text-[#122a20] transition-colors shadow-sm"
                  >
                    <IconShieldCheck size={14} aria-hidden="true" />
                    {property.owner.verifiedAt ? "Re-confirm landlord" : "Confirm landlord"}
                  </button>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center text-center gap-2 py-4">
                <IconMoodEmpty size={24} className="text-slate-300" />
                <p className="body-sm text-slate-500">No owner assigned.</p>
              </div>
            )}
          </Card>

          <Card className="bg-white border border-slate-100 rounded-[24px] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col gap-3">
            <h3 className="text-title-primary mb-1">Quick Facts</h3>
            <FactRow label="Property code" value={<span className="mono-data text-slate-700 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-md">{property.propertyCode}</span>} />
            <FactRow label="Registered" value={<span className="mono-data">{formatPropertyDate(property.createdAt)}</span>} />
            <FactRow label="Last updated" value={<span className="mono-data">{formatPropertyDate(property.updatedAt)}</span>} />
            {property.unitBreakdown && property.unitBreakdown.length > 0 && (
              <FactRow label="Units" value={<span className="mono-stat">{property.unitBreakdown.reduce((sum, u) => sum + u.count, 0)}</span>} />
            )}
          </Card>

          <Card className="bg-white border border-slate-100 rounded-[24px] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-title-primary">Latest Activity</h3>
              <button type="button" onClick={() => setActiveTab("activity")} className="label-caps text-slate-400 hover:text-slate-900 transition-colors">
                View all
              </button>
            </div>
            {activityLoading ? (
              <div className="flex items-center justify-center py-4">
                <LoadingSpinner size="sm" />
              </div>
            ) : activityLog && activityLog.length > 0 ? (
              <div className="flex flex-col gap-3">
                {activityLog.slice(0, 3).map((entry) => {
                  const actionParts = entry.action.split(".");
                  const readableAction = actionParts[actionParts.length - 1].replace(/_/g, " ");
                  return (
                    <div key={entry.id} className="flex items-start gap-2.5">
                      <span className={cn("size-2 rounded-full shrink-0 mt-1", activityTone(entry.action))} aria-hidden="true" />
                      <div className="min-w-0">
                        <p className="text-body-regular text-slate-600 leading-snug">
                          <span className="text-slate-900 font-medium">{entry.actorName}</span> performed {readableAction}
                        </p>
                        <p className="text-meta-muted mono-data mt-0.5">{formatPropertyDate(entry.occurredAt)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-desc-secondary">No activity recorded yet.</p>
            )}
          </Card>
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
  const openMaint = (property.maintenanceRequests ?? []).filter((m) => ["open", "assigned", "in_progress"].includes(m.status));
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
  const c = MANDATE_STATUS_CONFIG[status];
  // The rail card has the extra approver-role data the compact board badge
  // doesn't, so it earns the more precise "Pending GM"/"Pending CEO" label.
  const label =
    status === "pending_approval" && pendingApproverRole
      ? `Pending ${pendingApproverRole.toUpperCase()}`
      : c.label;
  return <span className={`rounded-full border px-2.5 py-0.5 label-caps ${c.pill}`}>{label}</span>;
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

type OverviewHandlers = {
  canManage: boolean;
  canViewFinance: boolean;
  canDecideMandate: boolean;
  canOverrideMandate: boolean;
  mandateLetterDoc?: { url?: string };
  onVerifyLandlord: () => void;
  onAssignManager: () => void;
  onMandateLetter: () => void;
  onDecision: () => void;
  onOverride: () => void;
  onTerminate: () => void;
  onCreateMandate: () => void;
};

function OverviewPanel({ property, handlers }: { property: PropertyDetail; handlers: OverviewHandlers }) {
  const isForSale = property.listingType === "sale";
  const numberBlocks = isForSale
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

  return (
    <div className="flex flex-col gap-4">
      {/* ── Top Metric Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {numberBlocks.map((b) => (
          <MetricTile key={b.label} icon={b.icon} label={b.label} value={b.value} />
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 items-start">
        {/* ── Left Column: Description & Units ── */}
        <div className="flex flex-col gap-4 xl:col-span-2">
          {property.description && (
            <Card className="bg-white border border-slate-100 rounded-[24px] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
              <h3 className="text-title-primary mb-4">Description</h3>
              <p className="text-body-regular text-slate-600 whitespace-pre-line">{property.description}</p>
            </Card>
          )}

          {property.unitBreakdown && property.unitBreakdown.length > 0 ? (
            <Card className="bg-white border border-slate-100 rounded-[24px] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
              <h3 className="text-title-primary mb-5">Unit Breakdown</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {property.unitBreakdown.map((unit, idx) => (
                  <div key={idx} className="flex flex-col p-4 rounded-[16px] bg-slate-50/80 border border-slate-100 transition-colors hover:bg-white hover:shadow-sm hover:border-slate-200">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="size-9 rounded-xl bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-700 mono-data">
                        {unit.count}x
                      </div>
                      <span className="body-sm text-slate-900 font-medium">{unit.unitType}</span>
                    </div>
                    {unit.monthlyRentKes && (
                      <span className="mono-amount text-slate-500 mt-1">{formatCompactKES(parseFloat(unit.monthlyRentKes))}/mo expected</span>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          ) : (
            !property.description && (
              <EmptyPanel
                icon={IconBuildingSkyscraper}
                title="No additional details yet"
                description="Add a description or a unit breakdown from the Edit form to flesh out this property's overview."
              />
            )
          )}
        </div>

        {/* ── Right Column: Mandate ── */}
        <div className="flex flex-col gap-4">
          <Card className="bg-white border border-slate-100 rounded-[24px] overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col p-6">
            {/* Mandate Section */}
            {handlers.canViewFinance && property.mandate ? (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-title-primary flex items-center gap-2">
                    <IconFileCertificate size={18} className="text-slate-400" />
                    Mandate
                  </h3>
                  <MandateStatusPill status={property.mandate.status} pendingApproverRole={property.mandate.pendingApproverRole} />
                </div>
                <p className="body-sm text-slate-500 mb-5 leading-relaxed">
                  <strong className="text-slate-700 font-medium">{(property.mandate.mandateRate * 100).toFixed(0)}% fee</strong> · started{" "}
                  {formatPropertyDate(property.mandate.startDate)} · Ref <span className="mono-data bg-slate-100 px-1.5 py-0.5 rounded">{property.mandate.id.slice(0, 8).toUpperCase()}</span>
                </p>

                <div className="flex flex-col gap-2.5 mb-5">
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-white p-3 shadow-sm hover:border-slate-200 transition-colors">
                    {property.mandate.manager?.name ? (
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="size-9 rounded-full bg-emerald-700 text-white flex items-center justify-center label-caps shrink-0 shadow-sm">
                          {property.mandate.manager.name.slice(0, 2).toUpperCase()}
                        </span>
                        <span className="min-w-0">
                          <span className="block body-sm font-medium text-slate-900 truncate">{property.mandate.manager.name}</span>
                          <span className="block label-caps text-slate-400 mt-0.5">Manager</span>
                        </span>
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-2 body-sm text-slate-400 min-w-0">
                        <IconUserCog size={16} className="shrink-0" aria-hidden="true" />
                        <span className="truncate">No manager assigned</span>
                      </span>
                    )}
                    {handlers.canManage && (
                      <button type="button" onClick={handlers.onAssignManager} className="label-caps text-slate-400 hover:text-[#122a20] shrink-0 transition-colors">
                        {property.mandate.manager?.name ? "Reassign" : "Assign"}
                      </button>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-white p-3 shadow-sm hover:border-slate-200 transition-colors">
                    {handlers.mandateLetterDoc?.url ? (
                      <a href={handlers.mandateLetterDoc.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 min-w-0 body-sm font-medium text-slate-700 hover:text-[#122a20] transition-colors">
                        <span className="size-9 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0">
                          <IconFileText size={16} className="text-slate-500" />
                        </span>
                        <span className="truncate">Mandate letter</span>
                      </a>
                    ) : (
                      <span className="inline-flex items-center gap-2 body-sm text-amber-700 min-w-0">
                        <span className="size-9 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
                          <IconAlertTriangle size={16} className="text-amber-500" />
                        </span>
                        <span className="truncate">No letter on file</span>
                      </span>
                    )}
                    {handlers.canManage && (
                      <button type="button" onClick={handlers.onMandateLetter} className="label-caps text-slate-400 hover:text-[#122a20] shrink-0 transition-colors">
                        {handlers.mandateLetterDoc?.url ? "Replace" : "Upload"}
                      </button>
                    )}
                  </div>
                </div>

                {handlers.canManage && handlers.canDecideMandate && (
                  <div className="mb-4 rounded-[16px] border border-amber-300/60 bg-[#fffdf0] p-4 shadow-sm">
                    <p className="body-sm font-medium text-amber-900 mb-3">
                      Awaiting approval. Submitted {formatPropertyDate(property.mandate.startDate)}.
                    </p>
                    <div className="flex items-center gap-2">
                      <Button size="sm" className="flex-1 justify-center bg-[#f3df27] text-[#151936] hover:bg-[#e6d220] font-medium shadow-sm" onClick={handlers.onDecision}>
                        Approve
                      </Button>
                      <Button size="sm" variant="secondary" className="flex-1 justify-center text-rose-600 border-rose-200 hover:bg-rose-50 font-medium shadow-sm" onClick={handlers.onDecision}>
                        Reject
                      </Button>
                    </div>
                  </div>
                )}

                {handlers.canManage && handlers.canOverrideMandate && (
                  <div className="mb-4 rounded-[16px] border border-amber-300/60 bg-[#fffdf0] p-4 shadow-sm">
                    <p className="body-sm font-medium text-amber-900 mb-3">
                      Pending GM step. You may decide directly.
                    </p>
                    <Button size="sm" variant="secondary" className="w-full justify-center font-medium" onClick={handlers.onOverride}>
                      <IconBolt size={14} className="mr-1.5 text-amber-500" /> Override Decision
                    </Button>
                  </div>
                )}

                {handlers.canManage && property.mandate.status === "active" && (
                  <button type="button" onClick={handlers.onTerminate} className="mt-auto self-center label-caps text-rose-500 hover:text-rose-700 transition-colors pt-2">
                    Terminate Mandate
                  </button>
                )}
              </>
            ) : handlers.canViewFinance && !property.mandate && handlers.canManage && property.owner ? (
              <div className="flex flex-col items-center text-center gap-3 py-4">
                <div className="size-12 rounded-full bg-slate-50 flex items-center justify-center mb-1">
                  <IconFileCertificate size={24} className="text-slate-300" />
                </div>
                <h3 className="text-title-primary">No Mandate</h3>
                <p className="body-sm text-slate-500 mb-2">This property isn&apos;t under a management mandate.</p>
                <Button onClick={handlers.onCreateMandate} className="w-full justify-center bg-[#151936] text-white hover:bg-slate-800 shadow-md font-medium">
                  <IconPlus size={16} className="mr-1.5" /> Create Mandate
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center text-center gap-2 py-4">
                <IconFileCertificate size={24} className="text-slate-300" />
                <p className="body-sm text-slate-500">Mandate info unavailable.</p>
              </div>
            )}
          </Card>
        </div>
      </div>
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

  return (
    <div className="flex flex-col gap-4">
      {property.arrears && (property.arrears.status === "partial" || property.arrears.status === "defaulted") && (
        <div className="flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50/60 px-4 py-3">
          <IconAlertTriangle size={18} className="text-rose-500 shrink-0" aria-hidden="true" />
          <p className="text-body-regular text-rose-700">
            {formatCompactKES(property.arrears.amount)} in arrears · {property.arrears.daysInArrears} days
          </p>
        </div>
      )}

      {period && (
        <div className="grid grid-cols-3 gap-4">
          <MetricTile icon={IconReceipt2} label="Collected This Month" value={formatCompactKES(period.collectedAmount)} />
          <MetricTile icon={IconTrendingUp} label={`Management Fee (${((property.mandate?.mandateRate ?? 0) * 100).toFixed(0)}%)`} value={formatCompactKES(period.managementFee)} />
          <MetricTile icon={IconShieldCheck} label="Landlord Remittance" value={formatCompactKES(period.landlordRemittance)} />
        </div>
      )}

      {period && (
        <Card className="bg-white border border-slate-100 rounded-[24px] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
          <div className="flex items-baseline justify-between mb-1">
            <h3 className="text-title-primary">Remittance breakdown — current period</h3>
            <span className="label-caps text-slate-400">This month</span>
          </div>
          <p className="text-desc-secondary mb-4">Collected rent is a landlord-payable liability — only the management fee is Sunland revenue.</p>
          <RemittanceBar period={period} />
          <div className="flex flex-col mt-4">
            <RemittanceRow dotClass="bg-slate-200" label="Rent collected (landlord-payable)" value={formatCompactKES(period.collectedAmount)} />
            <RemittanceRow dotClass="bg-[#f3df27]" label="Less management fee — Sunland revenue" value={`− ${formatCompactKES(period.managementFee)}`} valueClass="text-amber-700" />
            <RemittanceRow dotClass="bg-slate-400" label="Less approved expenses" value={`− ${formatCompactKES(period.expenses)}`} valueClass="text-slate-500" />
            <RemittanceRow dotClass="bg-[#122a20]" label="Landlord remittance due" value={formatCompactKES(period.landlordRemittance)} valueClass="text-[#122a20] text-base" bold last />
          </div>
        </Card>
      )}

      {property.collections && property.collections.length > 0 ? (
        <Card className="bg-white border border-slate-100 rounded-[24px] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
          <div className="mb-6">
            <h3 className="text-title-primary">Collections - Expected vs Collected</h3>
            <p className="text-desc-secondary mt-1">Recent rental ledger periods for this property.</p>
          </div>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
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
        </Card>
      ) : (
        <EmptyPanel icon={IconTrendingUp} title="No collection history yet" description="Once rent starts being recorded against this mandate, expected-vs-collected trends will show up here." />
      )}

      <Link href="/fin/mandates" className="inline-flex items-center gap-1.5 text-body-regular text-[#122a20] hover:underline self-start">
        View mandates in Finance <IconExternalLink size={14} aria-hidden="true" />
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
  const leases = property.leases ?? [];
  if (leases.length === 0) {
    return <EmptyPanel icon={IconUsers} title="No lease on record" description="This property doesn't have an active or past lease recorded yet." />;
  }
  const totalPages = Math.max(1, Math.ceil(leases.length / LEASES_PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const pageLeases = leases.slice((safePage - 1) * LEASES_PER_PAGE, safePage * LEASES_PER_PAGE);

  return (
    <Card className="bg-white border border-slate-100 rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
      <div className="hidden sm:grid grid-cols-[1.6fr_1fr_1fr_auto_28px] gap-3 px-5 py-2.5 border-b border-slate-100 label-caps text-slate-400">
        <span>Tenant</span>
        <span>Term</span>
        <span>Status</span>
        <span className="text-right">Rent</span>
        <span />
      </div>
      <div className="divide-y divide-slate-100">
        {pageLeases.map((lease) => (
          <button
            key={lease.id}
            type="button"
            onClick={() => onOpenLease(lease)}
            className="w-full text-left grid grid-cols-1 sm:grid-cols-[1.6fr_1fr_1fr_auto_28px] gap-1.5 sm:gap-3 px-5 py-3.5 hover:bg-slate-50/60 transition-colors items-center"
          >
            <div className="min-w-0">
              <p className="text-body-primary text-slate-900 truncate">{lease.tenantName}</p>
              <div className="flex items-center gap-3 flex-wrap mt-0.5">
                {lease.tenantPhone && (
                  <span className="text-meta-muted flex items-center gap-1">
                    <IconPhone size={12} aria-hidden="true" /> {lease.tenantPhone}
                  </span>
                )}
              </div>
            </div>
            <p className="text-body-regular text-slate-600 sm:self-center">
              {formatPropertyDate(lease.startDate)} – {lease.endDate ? formatPropertyDate(lease.endDate) : "Ongoing"}
            </p>
            <div className="sm:self-center">
              <LeaseStatusPill status={lease.status} />
            </div>
            <span className="mono-amount text-slate-900 sm:self-center sm:text-right">{formatCompactKES(parseFloat(lease.monthlyRentKes))}/mo</span>
            <IconChevronRight size={15} className="hidden sm:block text-slate-300 justify-self-end" aria-hidden="true" />
          </button>
        ))}
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100">
          <span className="text-meta-muted">Page {safePage} of {totalPages} · {leases.length} leases</span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onPageChange(Math.max(1, safePage - 1))}
              disabled={safePage <= 1}
              aria-label="Previous page"
              className="size-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 disabled:text-slate-200 disabled:cursor-not-allowed hover:bg-slate-50"
            >
              <IconChevronLeft size={15} />
            </button>
            <button
              type="button"
              onClick={() => onPageChange(Math.min(totalPages, safePage + 1))}
              disabled={safePage >= totalPages}
              aria-label="Next page"
              className="size-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 disabled:text-slate-200 disabled:cursor-not-allowed hover:bg-slate-50"
            >
              <IconChevronRight size={15} />
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}

function LeaseStatusPill({ status }: { status: "active" | "expiring" | "ended" | "pending_renewal" }) {
  const config: Record<typeof status, { label: string; className: string }> = {
    active: { label: "Active", className: "bg-emerald-500/15 text-emerald-700 border-emerald-300/60" },
    expiring: { label: "Expiring soon", className: "bg-amber-500/15 text-amber-700 border-amber-300/60" },
    pending_renewal: { label: "Pending renewal", className: "bg-amber-500/15 text-amber-700 border-amber-300/60" },
    ended: { label: "Ended", className: "bg-slate-100 text-slate-400 border-slate-200" },
  };
  const c = config[status];
  return <span className={`rounded-full border px-2.5 py-0.5 label-caps ${c.className}`}>{c.label}</span>;
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
  const requests = property.maintenanceRequests ?? [];
  if (requests.length === 0) {
    return (
      <EmptyPanel
        icon={IconClipboardList}
        title="No maintenance history"
        description="Nothing has been reported against this property yet."
        action={
          canLog ? (
            <Button size="sm" onClick={onReport}>
              <IconPlus size={14} className="mr-1.5" /> Report an issue
            </Button>
          ) : undefined
        }
      />
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {canLog && (
        <Button size="sm" onClick={onReport} className="self-start">
          <IconPlus size={14} className="mr-1.5" /> Report an issue
        </Button>
      )}
      <Card className="bg-white border border-slate-100 rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
        <div className="hidden sm:grid grid-cols-[1.8fr_1fr_auto_auto] gap-3 px-5 py-2.5 border-b border-slate-100 label-caps text-slate-400">
          <span>Issue</span>
          <span>Reported</span>
          <span>Priority</span>
          <span>Status</span>
        </div>
        <div className="divide-y divide-slate-100">
          {requests.map((req) => {
            const isHotCritical = req.priority === "critical" && req.status !== "resolved" && req.status !== "closed";
            return (
              <div
                key={req.id}
                className={cn(
                  "grid grid-cols-1 sm:grid-cols-[1.8fr_1fr_auto_auto] gap-1.5 sm:gap-3 px-5 py-3.5 transition-colors",
                  isHotCritical ? "bg-rose-50/50 hover:bg-rose-50" : "hover:bg-slate-50/60"
                )}
              >
                <p className="text-body-primary text-slate-900 truncate sm:self-center flex items-center gap-1.5">
                  {isHotCritical && <IconAlertTriangle size={14} className="text-rose-500 shrink-0" aria-hidden="true" />}
                  {req.title}
                </p>
                <p className="text-body-regular text-slate-400 sm:self-center">
                  {formatPropertyDate(req.reportedAt)}
                  {req.reportedBy ? ` · ${req.reportedBy}` : ""}
                </p>
                <div className="sm:self-center">
                  <PriorityPill priority={req.priority} />
                </div>
                <div className="sm:self-center">
                  <MaintenanceStatusPill status={req.status} />
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

function PriorityPill({ priority }: { priority: string }) {
  const normalized = priority === "normal" ? "medium" : priority === "critical" ? "urgent" : priority;
  const config: Record<string, string> = {
    low: "bg-slate-100 text-slate-400 border-slate-200",
    medium: "bg-amber-500/15 text-amber-700 border-amber-300/60",
    high: "bg-rose-500/15 text-rose-700 border-rose-300/60",
    urgent: "bg-rose-500/20 text-rose-700 border-rose-400/60",
  };
  const style = config[normalized] || "bg-slate-100 text-slate-400 border-slate-200";
  return <span className={`rounded-full border px-2.5 py-0.5 label-caps ${style}`}>{normalized}</span>;
}

function MaintenanceStatusPill({ status }: { status: "open" | "assigned" | "in_progress" | "resolved" | "closed" }) {
  const config: Record<typeof status, { label: string; className: string }> = {
    open: { label: "Open", className: "bg-amber-500/15 text-amber-700 border-amber-300/60" },
    // Reuses the brand navy token at low opacity rather than introducing a new hue
    // (the previous draft used `sky`, which isn't in the Terrain Identity palette).
    assigned: { label: "Assigned", className: "bg-[#151936]/10 text-[#151936] border-[#151936]/20" },
    in_progress: { label: "In progress", className: "bg-slate-100 text-slate-600 border-slate-200" },
    resolved: { label: "Resolved", className: "bg-emerald-500/15 text-emerald-700 border-emerald-300/60" },
    closed: { label: "Closed", className: "bg-slate-50 text-slate-400 border-slate-200" },
  };
  const c = config[status];
  return <span className={`rounded-full border px-2.5 py-0.5 label-caps ${c.className}`}>{c.label}</span>;
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
  return (
    <div className="flex flex-col gap-4">
      {documents && documents.length > 0 && (
        <Card className="bg-white border border-slate-100 rounded-[24px] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
          <h3 className="text-title-primary mb-4">Documents</h3>
          <div className="flex flex-col gap-2">
            {documents.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-2.5 min-w-0">
                  <IconFileText size={16} className="text-slate-400 shrink-0" aria-hidden="true" />
                  <span className="text-body-regular text-slate-800 truncate">{doc.name}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <DocumentStatusPill status={doc.status} />
                  {doc.url && (
                    <a href={doc.url} target="_blank" rel="noreferrer" aria-label={`Open ${doc.name}`} className="text-slate-400 hover:text-[#122a20]">
                      <IconExternalLink size={15} />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <LoadingSpinner size="lg" />
        </div>
      ) : !entries || entries.length === 0 ? (
        <EmptyPanel icon={IconMoodEmpty} title="No activity yet" description="Status changes, edits, and mandate events for this property will show up here." />
      ) : (
        <Card className="bg-white border border-slate-100 rounded-[24px] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
          <ul className="flex flex-col">
            {entries.map((entry, i) => (
              <li key={entry.id} className={cn("flex gap-3 pb-4", i !== entries.length - 1 && "border-b border-slate-100 mb-4")}>
                <div className="flex flex-col items-center pt-1">
                  <span className={cn("size-2 rounded-full", activityTone(entry.action))} aria-hidden="true" />
                  {i !== entries.length - 1 && <span className="w-px flex-1 bg-slate-100 mt-1" aria-hidden="true" />}
                </div>
                <div className="flex flex-col gap-0.5 pb-1">
                  <p className="text-body-regular text-slate-700">
                    <span className="text-slate-900">{entry.actorName}</span> {entry.action}
                  </p>
                  <p className="text-meta-muted mono-data">{formatPropertyDate(entry.occurredAt)}</p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function DocumentStatusPill({ status }: { status: "draft" | "awaiting_signature" | "signed" }) {
  const config: Record<typeof status, { label: string; className: string }> = {
    draft: { label: "Draft", className: "bg-slate-100 text-slate-400 border-slate-200" },
    awaiting_signature: { label: "Awaiting signature", className: "bg-amber-500/15 text-amber-700 border-amber-300/60" },
    signed: { label: "Signed", className: "bg-emerald-500/15 text-emerald-700 border-emerald-300/60" },
  };
  const c = config[status];
  return <span className={`rounded-full border px-2.5 py-0.5 label-caps ${c.className}`}>{c.label}</span>;
}

function MetricTile({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ size?: number; stroke?: number; className?: string }>;
  label: string;
  value: string | number;
}) {
  return (
    <Card className="bg-white border border-slate-100 rounded-[24px] p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_16px_40px_rgb(0,0,0,0.06)] transition-all">
      <div className="flex items-center gap-3 mb-2">
        <div className="size-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-600">
          <Icon size={20} stroke={1.5} />
        </div>
        <p className="label-caps text-slate-400">{label}</p>
      </div>
      <p className="mono-stat headline-md text-slate-900 mt-2">{value}</p>
    </Card>
  );
}
