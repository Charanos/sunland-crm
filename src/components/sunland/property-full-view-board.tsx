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
  IconChevronLeft,
  IconClipboardList,
  IconEdit,
  IconExternalLink,
  IconFileCertificate,
  IconFileText,
  IconHistory,
  IconMail,
  IconMapPin,
  IconMoodEmpty,
  IconPhone,
  IconPlus,
  IconReceipt2,
  IconRuler,
  IconShieldCheck,
  IconStar,
  IconStarFilled,
  IconTrash,
  IconTrendingUp,
  IconUsers,
} from "@tabler/icons-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast-provider";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { PropertyFormModal } from "./property-form-modal";
import { ReportIssueModal } from "./report-issue-modal";
import { MandateFormModal } from "./mandate-form-modal";
import { MandateLetterModal } from "./mandate-letter-modal";
import { VerifyContactModal } from "./verify-contact-modal";
import { formatCompactKES } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { LISTING_TYPE_LABEL, MANDATE_STATUS_CONFIG, PROPERTY_TYPE_ICON, STATUS_CONFIG, STATUS_ORDER, formatPropertyDate } from "./property-constants";
import type { PropertyStatus } from "./property-constants";
import type { ActivityLogEntry, PropertyDetail, PropertyDocumentSummary } from "./property-detail-types";

type TabKey = "overview" | "financials" | "tenancy" | "maintenance" | "activity";

// Hides scrollbars on the mobile tab strip / pipeline stepper while staying scrollable
// by touch, trackpad, or keyboard - cross-browser via one Tailwind arbitrary variant
// plus the two non-standard scrollbar properties inline.
const SCROLL_HIDDEN_CLASS = "[&::-webkit-scrollbar]:hidden";
const scrollHiddenStyle: React.CSSProperties = { scrollbarWidth: "none", msOverflowStyle: "none" };

// Dark-hero recast of STATUS_CONFIG's light pill tones - same semantic hue
// per status (emerald/amber/rose/slate, Terrain Identity palette), just
// legible against the majestic gradient header instead of a white card.
const STATUS_HERO_TONE: Record<PropertyStatus, string> = {
  available: "border-white/10 bg-white/5 text-slate-300",
  occupied: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  under_offer: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  maintenance: "border-rose-500/30 bg-rose-500/10 text-rose-400",
  off_market: "border-white/10 bg-white/5 text-slate-400",
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

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [reportIssueOpen, setReportIssueOpen] = useState(false);
  const [createMandateOpen, setCreateMandateOpen] = useState(false);
  const [terminateMandateOpen, setTerminateMandateOpen] = useState(false);
  const [isTerminatingMandate, setIsTerminatingMandate] = useState(false);
  const [verifyLandlordOpen, setVerifyLandlordOpen] = useState(false);
  const [mandateLetterOpen, setMandateLetterOpen] = useState(false);

  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);

  const [activityLog, setActivityLog] = useState<ActivityLogEntry[] | null>(null);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityLoaded, setActivityLoaded] = useState(false);

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

  // Lazy-load the audit trail only once the Activity tab is actually opened.
  useEffect(() => {
    if (activeTab !== "activity" || activityLoaded) return;
    let active = true;
    const timeoutId = setTimeout(() => {
      setActivityLoading(true);
      fetch(`/api/audit?resourceType=property&resourceId=${propertyId}`)
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
  }, [activeTab, activityLoaded, propertyId]);

  const tabs = useMemo(() => {
    if (!property) return [];
    const list: { key: TabKey; label: string; icon: ComponentType<{ size?: number; className?: string }> }[] = [
      { key: "overview", label: "Overview", icon: IconBuildingSkyscraper },
    ];
    if (canViewFinance) list.push({ key: "financials", label: "Financials", icon: IconReceipt2 });
    list.push({
      key: "tenancy",
      label: property.listingType === "sale" ? "Sales Pipeline" : "Tenancy",
      icon: property.listingType === "sale" ? IconTrendingUp : IconUsers,
    });
    list.push({ key: "maintenance", label: "Maintenance", icon: IconClipboardList });
    list.push({ key: "activity", label: "Activity", icon: IconHistory });
    return list;
  }, [property, canViewFinance]);

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
  const mandateLetterDoc = property.documents?.find((d) => d.type === "mandate_letter");

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
        body: JSON.stringify({ isFeatured: newVal }),
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      setProperty({ ...property, isFeatured: newVal });
      pushToast({ tone: "success", title: "Updated", body: `Property is now ${newVal ? "featured" : "unfeatured"}.` });
    } catch (err) {
      console.error("Failed to toggle feature:", err);
      pushToast({ tone: "warning", title: "Error", body: "Could not update property." });
    }
  };

  const handleStatusChange = async (status: PropertyStatus) => {
    const previous = property.status;
    setProperty({ ...property, status });
    try {
      const res = await fetch(`/api/properties/${property.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
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
    setIsTerminatingMandate(true);
    try {
      const res = await fetch(`/api/mandates/${property.mandate.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "terminate" }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Failed to terminate mandate");
      }
      pushToast({ tone: "success", title: "Mandate terminated" });
      setTerminateMandateOpen(false);
      setRefreshCount((c) => c + 1);
    } catch (e: unknown) {
      pushToast({ tone: "warning", title: "Error", body: e instanceof Error ? e.message : "Failed to terminate mandate" });
    } finally {
      setIsTerminatingMandate(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-[98rem] flex-col gap-6 pb-12">
      {/* ── Breadcrumb ── */}
      <div className="flex items-center gap-2">
        <Link href="/admin/properties" className="text-slate-400 hover:text-slate-600 transition-colors" aria-label="Back to Properties">
          <IconChevronLeft size={20} stroke={2} />
        </Link>
        <Link href="/" className="text-desc-secondary hover:text-slate-800">
          Dashboard
        </Link>
        <span className="text-slate-300">/</span>
        <Link href="/admin/properties" className="text-desc-secondary hover:text-slate-800">
          Properties
        </Link>
        <span className="text-slate-300">/</span>
        <span className="text-meta-muted-strong truncate max-w-[40vw]">{property.name}</span>
      </div>

      {/* ── Majestic Header ── */}
      <div className="bg-tertiary-gradient text-white rounded-[24px] shadow-2xl relative overflow-hidden group border border-[#151936] p-8 lg:p-10">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-transparent to-transparent pointer-events-none" />
        <div className="absolute right-0 bottom-0 size-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-indigo-500/20 transition-colors duration-700" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-end justify-between gap-8">
          <div className="flex flex-col gap-4 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <span className={cn("inline-flex items-center gap-2 rounded-full border px-4 py-1 text-xs uppercase tracking-wider", STATUS_HERO_TONE[property.status as PropertyStatus])}>
                <span className={cn("size-2 rounded-full shadow-sm", statusConfig.dot)} aria-hidden="true" />
                {canManage ? (
                  <select
                    value={property.status}
                    onChange={(e) => handleStatusChange(e.target.value as PropertyStatus)}
                    aria-label={`Change status for ${property.name}`}
                    className="appearance-none bg-transparent outline-none cursor-pointer"
                  >
                    {STATUS_ORDER.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_CONFIG[s].label}
                      </option>
                    ))}
                  </select>
                ) : (
                  statusConfig.label
                )}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1 text-xs uppercase tracking-wider text-slate-300 backdrop-blur-sm">
                <TypeIcon size={14} aria-hidden="true" />
                {property.propertyType}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1 text-xs uppercase tracking-wider text-slate-300 backdrop-blur-sm">
                {LISTING_TYPE_LABEL[property.listingType as keyof typeof LISTING_TYPE_LABEL] || property.listingType}
              </span>
              {property.isFeatured && (
                <span className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-1 text-xs uppercase tracking-wider text-amber-400">
                  <IconStarFilled size={12} aria-hidden="true" /> Featured
                </span>
              )}
            </div>

            <h1 className="text-4xl lg:text-5xl font-serif tracking-tight text-white drop-shadow-sm truncate">{property.name}</h1>

            <div className="flex items-center gap-3 text-slate-400 min-w-0">
              <span className="flex items-center gap-1.5 font-medium min-w-0">
                <IconMapPin size={16} className="shrink-0" aria-hidden="true" />
                <span className="truncate">{property.location}</span>
              </span>
              <span className="text-slate-600 shrink-0">|</span>
              <span className="font-mono text-slate-300 bg-white/5 px-2 py-0.5 rounded text-sm shrink-0">{property.propertyCode}</span>
            </div>
          </div>

          {canManage && (
            <div className="flex items-center gap-2 flex-wrap shrink-0">
              <button
                type="button"
                onClick={handleToggleFeature}
                aria-label={property.isFeatured ? "Unfeature property" : "Feature property"}
                className={cn(
                  "inline-flex items-center gap-2 px-5 py-1.5 text-sm rounded-xl border transition-all font-medium shadow-sm backdrop-blur-sm",
                  property.isFeatured
                    ? "bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20"
                    : "bg-white/5 border-white/10 text-slate-200 hover:bg-white/10 hover:border-white/20"
                )}
              >
                {property.isFeatured ? <IconStarFilled size={14} /> : <IconStar size={14} />} {property.isFeatured ? "Featured" : "Feature"}
              </button>
              {canLogMaintenance && (
                <button
                  type="button"
                  onClick={() => setReportIssueOpen(true)}
                  aria-label="Report an issue"
                  className="inline-flex items-center gap-2 px-5 py-1.5 text-sm rounded-xl bg-white/5 border border-white/10 text-slate-200 hover:bg-white/10 hover:border-white/20 transition-all font-medium shadow-sm backdrop-blur-sm"
                >
                  <IconPlus size={14} /> Report Issue
                </button>
              )}
              <button
                type="button"
                onClick={() => setEditModalOpen(true)}
                aria-label="Edit property"
                className="inline-flex items-center gap-2 px-5 py-1.5 text-sm rounded-xl bg-white/5 border border-white/10 text-slate-200 hover:bg-white/10 hover:border-white/20 transition-all font-medium shadow-sm backdrop-blur-sm"
              >
                <IconEdit size={14} /> Edit
              </button>
              <button
                type="button"
                onClick={() => setDeleteConfirmOpen(true)}
                aria-label="Delete property"
                className="inline-flex items-center gap-2 px-5 py-1.5 text-sm rounded-xl bg-white/5 border border-white/10 text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/30 hover:text-rose-300 transition-all font-medium shadow-sm backdrop-blur-sm"
              >
                <IconTrash size={14} /> Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Gallery (only when there's actually media - no fake hero for empty listings) ── */}
      {mediaList.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="relative aspect-[21/9] md:aspect-[3/1] w-full rounded-2xl overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 bg-tertiary-emerald">
            {primaryImage && (
              <Image src={primaryImage} alt={mediaList[activeMediaIndex]?.alt ?? property.name} fill sizes="100vw" className="object-cover" />
            )}
          </div>
          {mediaList.length > 1 && (
            <div className={cn("flex items-center gap-2 overflow-x-auto pb-1", SCROLL_HIDDEN_CLASS)} style={scrollHiddenStyle}>
              {mediaList.map((m, i) => (
                <button
                  key={m.url + i}
                  type="button"
                  onClick={() => setActiveMediaIndex(i)}
                  aria-label={`Show photo ${i + 1} of ${mediaList.length}`}
                  aria-pressed={i === activeMediaIndex}
                  className={cn(
                    "relative size-16 shrink-0 rounded-lg overflow-hidden border-2 transition-colors",
                    i === activeMediaIndex ? "border-[#151936]" : "border-transparent opacity-70 hover:opacity-100"
                  )}
                >
                  <Image src={m.url} alt={m.alt ?? `${property.name} photo ${i + 1}`} fill sizes="64px" className="object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Adaptive metrics row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricTile icon={IconBed} label="Bedrooms" value={property.bedrooms ?? "-"} />
        <MetricTile icon={IconBath} label="Bathrooms" value={property.bathrooms ?? "-"} />
        <MetricTile icon={IconRuler} label="Size (Sqft)" value={property.sizeSqft ? property.sizeSqft.toLocaleString() : "-"} />
        <MetricTile icon={adaptiveMetric.icon} label={adaptiveMetric.label} value={adaptiveMetric.value} />
      </div>

      {/* ── Main: tabbed content + persistent context rail ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 flex flex-col gap-4 min-w-0">
          <div
            role="tablist"
            aria-label="Property sections"
            className={cn("flex bg-slate-100 p-1 rounded-xl gap-1 overflow-x-auto flex-nowrap", SCROLL_HIDDEN_CLASS)}
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
                  "body-sm px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap",
                  activeTab === tab.key ? "bg-[#151936] text-white shadow-sm" : "text-slate-400 hover:text-slate-900 hover:bg-white/45"
                )}
              >
                <tab.icon size={14} aria-hidden="true" />
                {tab.label}
              </button>
            ))}
          </div>

          <div id={`panel-${activeTab}`} role="tabpanel" aria-labelledby={`tab-${activeTab}`}>
            {activeTab === "overview" && <OverviewPanel property={property} />}
            {activeTab === "financials" && canViewFinance && <FinancialsPanel property={property} />}
            {activeTab === "tenancy" && (isForSale ? <PipelinePanel property={property} /> : <TenancyPanel property={property} />)}
            {activeTab === "maintenance" && (
              <MaintenancePanel property={property} canLog={canLogMaintenance} onReport={() => setReportIssueOpen(true)} />
            )}
            {activeTab === "activity" && (
              <ActivityPanel entries={activityLog} loading={activityLoading} documents={property.documents ?? []} />
            )}
          </div>
        </div>

        {/* Context rail */}
        <div className="flex flex-col gap-4">
          <Card className="bg-white border border-slate-100 rounded-[24px] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-title-primary">Owner / Landlord</h3>
              {property.owner?.verifiedAt && (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300/60 bg-emerald-500/15 px-2.5 py-0.5 label-caps text-emerald-700">
                  <IconShieldCheck size={12} aria-hidden="true" /> Verified
                </span>
              )}
            </div>
            {property.owner ? (
              <div className="flex flex-col gap-3">
                <div className="flex items-start gap-3">
                  <div className="size-11 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-600 mono-data shrink-0">
                    {property.owner.name?.slice(0, 2).toUpperCase() || "??"}
                  </div>
                  <div className="flex flex-col gap-2 min-w-0">
                    <p className="text-body-primary text-slate-900 truncate">{property.owner.name || "Unknown"}</p>
                    {property.owner.phone && (
                      <a href={`tel:${property.owner.phone}`} className="text-body-regular text-slate-400 hover:text-[#122a20] flex items-center gap-2 transition-colors">
                        <IconPhone size={14} className="shrink-0" aria-hidden="true" />
                        <span className="truncate">{property.owner.phone}</span>
                      </a>
                    )}
                    {property.owner.email && (
                      <a href={`mailto:${property.owner.email}`} className="text-body-regular text-slate-400 hover:text-[#122a20] flex items-center gap-2 transition-colors">
                        <IconMail size={14} className="shrink-0" aria-hidden="true" />
                        <span className="truncate">{property.owner.email}</span>
                      </a>
                    )}
                    {property.owner.idNumber && (
                      <span className="text-body-regular text-slate-400 mono-data">ID {property.owner.idNumber}</span>
                    )}
                  </div>
                </div>
                {canManage && (
                  <button
                    type="button"
                    onClick={() => setVerifyLandlordOpen(true)}
                    className="inline-flex items-center gap-1 self-start text-body-regular text-[#122a20] hover:underline"
                  >
                    <IconShieldCheck size={13} aria-hidden="true" />
                    {property.owner.verifiedAt ? "Re-confirm landlord" : "Confirm landlord"}
                  </button>
                )}
              </div>
            ) : (
              <p className="text-desc-secondary">No owner assigned.</p>
            )}
          </Card>

          {canViewFinance && property.mandate && (
            <Card className="bg-white border border-slate-100 rounded-[24px] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-title-primary">Management Mandate</h3>
                <MandateStatusPill status={property.mandate.status} pendingApproverRole={property.mandate.pendingApproverRole} />
              </div>
              <p className="text-desc-secondary mb-3">
                {(property.mandate.mandateRate * 100).toFixed(0)}% management fee · started{" "}
                {formatPropertyDate(property.mandate.startDate)}
              </p>
              <div className="flex items-center justify-between gap-2 mb-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                {mandateLetterDoc?.url ? (
                  <a
                    href={mandateLetterDoc.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 min-w-0 text-body-regular text-slate-700 hover:text-[#122a20]"
                  >
                    <IconFileText size={14} className="shrink-0" aria-hidden="true" />
                    <span className="truncate">Mandate letter</span>
                    <IconExternalLink size={12} className="shrink-0" aria-hidden="true" />
                  </a>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-body-regular text-amber-700 min-w-0">
                    <IconAlertTriangle size={14} className="shrink-0" aria-hidden="true" />
                    <span className="truncate">No mandate letter on file</span>
                  </span>
                )}
                {canManage && (
                  <button
                    type="button"
                    onClick={() => setMandateLetterOpen(true)}
                    className="text-meta-muted-strong hover:text-[#122a20] shrink-0"
                  >
                    {mandateLetterDoc?.url ? "Replace" : "Upload"}
                  </button>
                )}
              </div>
              <div className="flex items-center gap-4">
                <button type="button" onClick={() => setActiveTab("financials")} className="inline-flex items-center gap-1 text-body-regular text-[#122a20] hover:underline">
                  View financials <IconExternalLink size={13} aria-hidden="true" />
                </button>
                {canManage && property.mandate.status === "active" && (
                  <button type="button" onClick={() => setTerminateMandateOpen(true)} className="text-body-regular text-rose-600 hover:underline">
                    Terminate
                  </button>
                )}
              </div>
            </Card>
          )}

          {canViewFinance && !property.mandate && canManage && property.owner && (
            <Card className="bg-white border border-slate-100 rounded-[24px] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
              <h3 className="text-title-primary mb-2">Management Mandate</h3>
              <p className="text-desc-secondary mb-4">This property isn&apos;t under a Sunland management mandate yet.</p>
              <Button variant="secondary" onClick={() => setCreateMandateOpen(true)} className="w-full justify-center">
                <IconFileCertificate size={16} className="mr-1.5" /> Create Mandate
              </Button>
            </Card>
          )}

          <Card className="bg-white border border-slate-100 rounded-[24px] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col gap-3">
            <h3 className="text-title-primary">Quick Facts</h3>
            <FactRow label="Property code" value={<span className="mono-data">{property.propertyCode}</span>} />
            <FactRow label="Registered" value={formatPropertyDate(property.createdAt)} />
            <FactRow label="Last updated" value={formatPropertyDate(property.updatedAt)} />
            {property.unitBreakdown && property.unitBreakdown.length > 0 && (
              <FactRow label="Units" value={property.unitBreakdown.reduce((sum, u) => sum + u.count, 0)} />
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
        onClose={() => setTerminateMandateOpen(false)}
        onConfirm={handleTerminateMandate}
        title="Terminate Mandate"
        description="Are you sure you want to terminate this management mandate? This action cannot be undone."
        confirmLabel="Terminate Mandate"
        tone="danger"
        isLoading={isTerminatingMandate}
      />
    </div>
  );
}

// ── Adaptive 4th metric ──

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

// ── Local presentational pieces ──

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

function OverviewPanel({ property }: { property: PropertyDetail }) {
  return (
    <div className="flex flex-col gap-4">
      {property.description && (
        <Card className="bg-white border border-slate-100 rounded-[24px] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
          <h3 className="text-title-primary mb-3">Description</h3>
          <p className="text-body-regular text-slate-600 whitespace-pre-line">{property.description}</p>
        </Card>
      )}
      {property.unitBreakdown && property.unitBreakdown.length > 0 ? (
        <Card className="bg-white border border-slate-100 rounded-[24px] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
          <h3 className="text-title-primary mb-4">Unit Breakdown</h3>
          <div className="space-y-3">
            {property.unitBreakdown.map((unit, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="size-8 rounded-lg bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-700 mono-data">
                    {unit.count}x
                  </div>
                  <span className="text-body-regular text-slate-800">{unit.unitType}</span>
                </div>
                {unit.monthlyRentKes && <span className="mono-amount text-slate-600">{formatCompactKES(parseFloat(unit.monthlyRentKes))}/mo</span>}
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

function TenancyPanel({ property }: { property: PropertyDetail }) {
  const leases = property.leases ?? [];
  if (leases.length === 0) {
    return <EmptyPanel icon={IconUsers} title="No lease on record" description="This property doesn't have an active or past lease recorded yet." />;
  }
  return (
    <Card className="bg-white border border-slate-100 rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
      <div className="hidden sm:grid grid-cols-[1.6fr_1fr_1fr_auto] gap-3 px-5 py-2.5 border-b border-slate-100 label-caps text-slate-400">
        <span>Tenant</span>
        <span>Term</span>
        <span>Status</span>
        <span className="text-right">Rent</span>
      </div>
      <div className="divide-y divide-slate-100">
        {leases.map((lease) => (
          <div key={lease.id} className="grid grid-cols-1 sm:grid-cols-[1.6fr_1fr_1fr_auto] gap-1.5 sm:gap-3 px-5 py-3.5 hover:bg-slate-50/60 transition-colors">
            <div className="min-w-0">
              <p className="text-body-primary text-slate-900 truncate">{lease.tenantName}</p>
              <div className="flex items-center gap-3 flex-wrap mt-0.5">
                {lease.tenantPhone && (
                  <a href={`tel:${lease.tenantPhone}`} className="text-meta-muted hover:text-[#122a20] flex items-center gap-1">
                    <IconPhone size={12} aria-hidden="true" /> {lease.tenantPhone}
                  </a>
                )}
                {lease.tenantEmail && (
                  <a href={`mailto:${lease.tenantEmail}`} className="text-meta-muted hover:text-[#122a20] flex items-center gap-1 truncate">
                    <IconMail size={12} aria-hidden="true" /> <span className="truncate">{lease.tenantEmail}</span>
                  </a>
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
          </div>
        ))}
      </div>
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

// ── Sales Pipeline (sale) ──

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
          {requests.map((req) => (
            <div key={req.id} className="grid grid-cols-1 sm:grid-cols-[1.8fr_1fr_auto_auto] gap-1.5 sm:gap-3 px-5 py-3.5 hover:bg-slate-50/60 transition-colors">
              <p className="text-body-primary text-slate-900 truncate sm:self-center">{req.title}</p>
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
          ))}
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
                  <span className="size-2 rounded-full bg-slate-300" aria-hidden="true" />
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