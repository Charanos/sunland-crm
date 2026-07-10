"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  IconBuildingCommunity,
  IconCheck,
  IconClock,
  IconFilter,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconTrendingUp,
  IconDotsVertical,
  IconSortAscending,
  IconSortDescending,
  IconArrowsSort,
  IconChevronRight,
  IconChevronLeft,
  IconStar,
  IconStarFilled,
  IconChartBar,
  IconMapPin,
  IconEdit,
  IconTrash,
  IconX,
  IconBed,
  IconBath,
  IconRuler,
  IconEye,
} from "@tabler/icons-react";
import Link from "next/link";
import Image from "next/image";
import {
  Badge,
  BoardHeader,
  Button,
  PaginationControls,
  ConfirmDialog,
  DropdownMenu,
  DropdownItem,
} from "@/components/ui/erp-primitives";
import { useToast } from "@/components/ui/toast-provider";
import { PropertyFormModal } from "./property-form-modal";
import { PropertyDetailDrawer } from "./property-detail-drawer";
import { EmptyState } from "@/components/ui/empty-state";
import { PageTransition } from "@/components/shared/page-transition";
import { formatCompactKES } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import {
  LISTING_TYPE_LABEL,
  MANDATE_STATUS_CONFIG,
  PROPERTY_TYPES,
  PROPERTY_TYPE_ICON,
  STATUS_CONFIG,
  STATUS_ORDER,
  ownerDisplayName,
  type ListingType,
  type Property,
  type PropertyStatus,
} from "./property-constants";

type StatusFilter = "all" | PropertyStatus;
type TypeFilter = "all" | string;
type ListingFilter = "all" | ListingType;
type SortConfig = { key: keyof Property; direction: "asc" | "desc" } | null;

const ROWS_PER_PAGE = 8;

function primaryImageUrl(property: Property): string | null {
  if (!property.media || property.media.length === 0) return null;
  return property.media.find((m) => m.isPrimary)?.url ?? property.media[0].url;
}

function featuredPriceDisplay(property: Property): { label: string; value: string } {
  if (property.askingPriceKes) {
    return { label: "Asking Price", value: formatCompactKES(parseFloat(property.askingPriceKes)) };
  }
  if (property.monthlyRentKes) {
    return { label: "Monthly Rent", value: `${formatCompactKES(parseFloat(property.monthlyRentKes))}/mo` };
  }
  return { label: "Price", value: "On Request" };
}

/** Icon look-up that gracefully falls back to the generic building icon */
function PropertyTypeIcon({ type, size = 16, className }: { type: string; size?: number; className?: string }) {
  const Icon = (PROPERTY_TYPE_ICON as Record<string, React.ElementType>)[type] ?? IconBuildingCommunity;
  return <Icon size={size} stroke={1.5} className={className} />;
}

export function PropertiesBoard({
  entityId,
  canManage = true,
}: {
  entityId: string;
  canManage?: boolean;
}) {
  const { pushToast } = useToast();

  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [listingFilter, setListingFilter] = useState<ListingFilter>("all");
  const [sortConfig, setSortConfig] = useState<SortConfig>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);
  const [drawerProperty, setDrawerProperty] = useState<Property | null>(null);

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [featuredIndex, setFeaturedIndex] = useState(0);

  const requestIdRef = useRef(0);

  const loadProperties = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    try {
      const res = await fetch(`/api/properties?entityId=${entityId}`);
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const data = await res.json();
      if (requestIdRef.current !== requestId) return;
      setProperties(data.properties ?? []);
    } catch (err) {
      if (requestIdRef.current !== requestId) return;
      console.error("Failed to load properties:", err);
      pushToast({ title: "Couldn't load properties", body: "Check your connection and try again.", tone: "warning" });
    } finally {
      if (requestIdRef.current === requestId) setLoading(false);
    }
  }, [entityId, pushToast]);

  // useEffect calling loadProperties is correct pattern per React docs — loading
  // state lives inside the async fn so no synchronous setState inside the effect.
  useEffect(() => {
    if (!entityId) return;
    const timeoutId = setTimeout(() => {
      loadProperties();
    }, 0);
    return () => clearTimeout(timeoutId);
  }, [entityId, loadProperties]);

  // ── Derived state ──

  const statusCounts = useMemo(() => {
    const counts: Record<PropertyStatus, number> = {
      available: 0,
      occupied: 0,
      under_offer: 0,
      maintenance: 0,
      off_market: 0,
    };
    for (const p of properties) counts[p.status] = (counts[p.status] ?? 0) + 1;
    return counts;
  }, [properties]);

  const kpis = useMemo(() => {
    const total = properties.length;
    const occupied = statusCounts.occupied;
    const available = statusCounts.available;
    const rate = total > 0 ? (occupied / total) * 100 : 0;
    const rentPool = properties
      .filter((p) => p.status === "occupied" && p.monthlyRentKes)
      .reduce((sum, p) => sum + parseFloat(p.monthlyRentKes!), 0);
    return { total, occupied, available, rate, rentPool };
  }, [properties, statusCounts]);

  const featuredProperties = useMemo(() => properties.filter((p) => p.isFeatured), [properties]);

  // Clamp featured carousel index without calling setState synchronously in render
  const safeFeaturedIndex =
    featuredProperties.length === 0 ? 0 : Math.min(featuredIndex, featuredProperties.length - 1);

  // Portfolio mix (all 5 status segments driven from STATUS_CONFIG)
  const portfolioMix = useMemo(
    () =>
      STATUS_ORDER.map((status) => ({
        status,
        count: statusCounts[status],
        config: STATUS_CONFIG[status],
        pct: properties.length > 0 ? (statusCounts[status] / properties.length) * 100 : 0,
      })),
    [statusCounts, properties.length]
  );

  // Type mix for secondary breakdown
  const typeMix = useMemo(
    () =>
      PROPERTY_TYPES.map((type) => ({
        type,
        count: properties.filter((p) => p.propertyType === type).length,
      })).filter((t) => t.count > 0),
    [properties]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return properties.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (typeFilter !== "all" && p.propertyType !== typeFilter) return false;
      if (listingFilter !== "all" && p.listingType !== listingFilter) return false;
      if (!q) return true;
      return [p.name, p.propertyCode, p.location, p.propertyType, ownerDisplayName(p)].some(
        (v) => v?.toLowerCase().includes(q)
      );
    });
  }, [properties, query, statusFilter, typeFilter, listingFilter]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    if (sortConfig !== null) {
      arr.sort((a, b) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];
        if (sortConfig.key === "monthlyRentKes") {
          const aNum = parseFloat((aVal as string) || "0");
          const bNum = parseFloat((bVal as string) || "0");
          return sortConfig.direction === "asc" ? aNum - bNum : bNum - aNum;
        }
        const aStr = String(aVal || "");
        const bStr = String(bVal || "");
        if (aStr < bStr) return sortConfig.direction === "asc" ? -1 : 1;
        if (aStr > bStr) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    } else {
      arr.sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime());
    }
    return arr;
  }, [filtered, sortConfig]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / ROWS_PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const visible = sorted.slice((safePage - 1) * ROWS_PER_PAGE, safePage * ROWS_PER_PAGE);

  const activeFilterCount = [typeFilter !== "all", listingFilter !== "all"].filter(Boolean).length;
  const hasActiveFilters = query.trim() !== "" || typeFilter !== "all" || listingFilter !== "all";

  // ── Mutations ──

  const requestSort = (key: keyof Property) => {
    let direction: "asc" | "desc" = "asc";
    if (sortConfig && sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const handleStatusChange = useCallback(
    async (id: string, status: PropertyStatus) => {
      let previousStatus: PropertyStatus | undefined;
      setProperties((prev) =>
        prev.map((p) => {
          if (p.id === id) {
            previousStatus = p.status;
            return { ...p, status };
          }
          return p;
        })
      );
      try {
        const res = await fetch(`/api/properties?id=${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status, entityId }),
        });
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        pushToast({ title: "Status updated", body: STATUS_CONFIG[status].label, tone: "success" });
      } catch (err) {
        console.error("Failed to update property status:", err);
        if (previousStatus) {
          const reverted = previousStatus;
          setProperties((prev) => prev.map((p) => (p.id === id ? { ...p, status: reverted } : p)));
        }
        pushToast({ title: "Couldn't update status", body: "Change was reverted — try again.", tone: "warning" });
      }
    },
    [pushToast, entityId]
  );

  const handleToggleFeature = async (id: string, currentlyFeatured: boolean) => {
    const nextVal = !currentlyFeatured;
    setProperties((prev) => prev.map((p) => (p.id === id ? { ...p, isFeatured: nextVal } : p)));
    if (drawerProperty?.id === id) {
      setDrawerProperty((prev) => (prev ? { ...prev, isFeatured: nextVal } : null));
    }
    try {
      await fetch(`/api/properties?id=${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isFeatured: nextVal, entityId }),
      });
      pushToast({
        title: "Updated",
        body: `Property is now ${nextVal ? "featured" : "unfeatured"}.`,
        tone: "success",
      });
    } catch {
      setProperties((prev) => prev.map((p) => (p.id === id ? { ...p, isFeatured: currentlyFeatured } : p)));
      pushToast({ title: "Error", body: "Could not update featured status.", tone: "warning" });
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmId) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/properties?id=${deleteConfirmId}&entityId=${entityId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete property");
      setProperties((prev) => prev.filter((p) => p.id !== deleteConfirmId));
      pushToast({ title: "Deleted", body: "Property successfully removed from portfolio.", tone: "success" });
      if (drawerProperty?.id === deleteConfirmId) setDrawerProperty(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Could not delete property.";
      pushToast({ title: "Error", body: msg, tone: "warning" });
    } finally {
      setIsDeleting(false);
      setDeleteConfirmId(null);
    }
  };

  const handleCreateSuccess = useCallback(() => {
    setIsCreateOpen(false);
    pushToast({ title: "Property registered", tone: "success", body: "" });
    loadProperties();
  }, [loadProperties, pushToast]);

  const handleEditSuccess = useCallback(() => {
    setEditingProperty(null);
    pushToast({ title: "Property updated", tone: "success", body: "" });
    loadProperties();
  }, [loadProperties, pushToast]);

  return (
    <PageTransition className="mx-auto flex max-w-[98rem] flex-col gap-4">
      <BoardHeader
        eyebrow={<Badge tone="primary">Estate Portfolio</Badge>}
        title="Properties & Inventory"
        description="Track managed residential and commercial properties, tenant occupancy states, and owner portfolios."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={loadProperties} disabled={loading}>
              <IconRefresh size={14} className={loading ? "animate-spin" : undefined} /> Refresh
            </Button>
            {canManage && (
              <Button size="sm" onClick={() => setIsCreateOpen(true)}>
                <IconPlus size={14} /> Register Property
              </Button>
            )}
          </div>
        }
      />

      {/* ── Property Portfolio Hub Navigator ── */}
      <div className="flex items-center justify-between flex-wrap gap-4 bg-white border border-slate-100 p-4 rounded-[20px] shadow-sm">
        <div className="flex items-center gap-2">
          <div className="size-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
            <IconBuildingCommunity size={20} />
          </div>
          <div>
            <h3 className="text-title-primary">Property Portfolio Hub</h3>
            <p className="text-desc-secondary mt-1">Manage property inventory, tenancies, maintenance requests, and valuations.</p>
          </div>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-xl flex-wrap gap-1">
          <Link
            href="/admin/properties"
            className="body-sm px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 bg-[#151936] text-white shadow-sm"
          >
            <span>Properties</span>
          </Link>
          <Link
            href="/admin/leases"
            className="body-sm px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 text-slate-500 hover:text-slate-900 hover:bg-white/45"
          >
            <span>Leases</span>
          </Link>
          <Link
            href="/admin/maintenance"
            className="body-sm px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 text-slate-500 hover:text-slate-900 hover:bg-white/45"
          >
            <span>Maintenance</span>
          </Link>
          <Link
            href="/admin/valuations"
            className="body-sm px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 text-slate-500 hover:text-slate-900 hover:bg-white/45"
          >
            <span>Valuations</span>
          </Link>
        </div>
      </div>

      <div className="flex items-center gap-4 my-6">
        <hr className="flex-1 border-slate-200/60" />
        <span className="label-caps text-slate-400 tracking-wider">Analytics & Command</span>
        <hr className="flex-1 border-slate-200/60" />
      </div>

      {/* ── Dense, High-Contrast Dark KPI Tier — driven fully from STATUS_CONFIG ── */}
      <div className="gsap-stagger bg-tertiary-gradient border border-[#122a20]/80 p-1.5 rounded-[24px] shadow-xl relative overflow-hidden group">
        <div className="absolute right-0 top-0 size-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-emerald-500/20 transition-colors duration-700" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-white/10">
          {/* Total */}
          <div className="p-6 lg:p-8 flex flex-col justify-center gap-5">
            <div className="flex items-center gap-3">
              <div className="size-9 rounded-xl bg-white/5 flex items-center justify-center text-slate-300 border border-white/10 shadow-sm">
                <IconBuildingCommunity size={18} />
              </div>
              <span className="text-sm font-medium text-slate-400">Total Units</span>
            </div>
            <div className="flex items-end justify-between gap-3">
              <span className="font-mono font-normal mt-1 text-4xl text-white">{kpis.total}</span>
              <div className="text-right mb-1">
                <span className="text-xs font-medium uppercase tracking-wider text-emerald-400">{kpis.available} AVAILABLE</span>
              </div>
            </div>
          </div>

          {/* Occupied — using STATUS_CONFIG for color consistency */}
          <div className="p-6 lg:p-8 flex flex-col justify-center gap-5">
            <div className="flex items-center gap-3">
              <div
                className="size-9 rounded-xl flex items-center justify-center border shadow-sm"
                style={{ background: "rgba(16,185,129,0.12)", borderColor: "rgba(16,185,129,0.2)", color: "#34d399" }}
              >
                <IconCheck size={18} />
              </div>
              <span className="text-sm font-medium text-slate-400">{STATUS_CONFIG.occupied.label}</span>
            </div>
            <div className="flex items-end justify-between gap-3">
              <span className="font-mono font-normal mt-1 text-4xl text-white">{kpis.occupied}</span>
              <span className="text-xs font-medium uppercase tracking-wider text-emerald-400 mb-1">{kpis.rate.toFixed(0)}% RATE</span>
            </div>
          </div>

          {/* Occupancy progress */}
          <div className="p-6 lg:p-8 flex flex-col justify-center gap-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-9 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 border border-amber-500/20 shadow-sm">
                  <IconTrendingUp size={18} />
                </div>
                <span className="text-sm font-medium text-slate-400">Occupancy Rate</span>
              </div>
              <span className="font-mono font-normal mt-1 text-3xl text-white">{kpis.rate.toFixed(1)}%</span>
            </div>
            {/* Full status segment bar — all 5 segments from STATUS_ORDER */}
            <div className="flex h-2.5 w-full overflow-hidden rounded-full gap-0.5 mt-1">
              {portfolioMix.map(({ status, pct, config }) =>
                statusCounts[status] > 0 ? (
                  <div
                    key={status}
                    className={cn("h-full transition-all duration-1000 text-xs", config.dot.replace("bg-", "bg-"))}
                    style={{ width: `${pct}%` }}
                    title={`${config.label}: ${statusCounts[status]}`}
                  />
                ) : null
              )}
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
              {portfolioMix.slice(0, 3).map(({ status, count, config }) => (
                <div key={status} className="flex items-center gap-1">
                  <span className={cn("size-1.5 rounded-full inline-block", config.dot)} />
                  <span className="text-xs uppercase text-slate-400">{config.label}: {count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Rent pool */}
          <div className="p-6 lg:p-8 flex flex-col justify-center gap-5">
            <div className="flex items-center gap-3">
              <div className="size-9 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 border border-indigo-500/20 shadow-sm">
                <IconClock size={18} />
              </div>
              <span className="text-sm font-medium text-slate-400">Monthly Rent Pool</span>
            </div>
            <div>
              <span className="font-mono font-normal mt-1 text-4xl text-white">
                {formatCompactKES(kpis.rentPool)}
              </span>
              <p className="text-xs uppercase text-slate-400 mt-2">Contracted — occupied only</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Market Highlights Tier ── */}
      <div className="gsap-stagger grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Featured Properties Carousel */}
        <div className="lg:col-span-2 bg-white border border-slate-100 rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_16px_40px_rgb(0,0,0,0.06)] transition-all duration-500 flex flex-col overflow-hidden relative">

          {featuredProperties.length > 0 ? (
            <div className="flex gap-0 flex-1 min-h-0" key={safeFeaturedIndex}>
              {/* Image panel */}
              <div className="relative w-2/5 shrink-0 overflow-hidden">
                <div className="absolute top-6 left-6 z-20">
                  <span className="bg-[#f3df27] px-2.5 py-1 rounded-lg inline-flex items-center gap-1.5 text-[#151936] text-xs font-medium shadow-sm">
                    <IconStarFilled size={12} /> Featured Listings
                  </span>
                </div>
                {primaryImageUrl(featuredProperties[safeFeaturedIndex]) ? (
                  <Image
                    src={primaryImageUrl(featuredProperties[safeFeaturedIndex])!}
                    alt={featuredProperties[safeFeaturedIndex].name}
                    fill
                    sizes="300px"
                    className="object-cover transition-transform duration-700 hover:scale-105"
                    priority
                  />
                ) : (
                  <div className="absolute inset-0 bg-slate-50 flex items-center justify-center">
                    <div className="absolute inset-0 opacity-[0.04] bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:16px_16px]" />
                    <PropertyTypeIcon type={featuredProperties[safeFeaturedIndex].propertyType} size={52} className="text-slate-300" />
                  </div>
                )}
                {/* Status chip over image */}
                <div className="absolute bottom-3 left-3">
                  <span className={cn(
                    "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border label-caps backdrop-blur-sm",
                    STATUS_CONFIG[featuredProperties[safeFeaturedIndex].status].pill
                  )}>
                    <span className={cn("size-1.5 rounded-full", STATUS_CONFIG[featuredProperties[safeFeaturedIndex].status].dot)} />
                    {STATUS_CONFIG[featuredProperties[safeFeaturedIndex].status].label}
                  </span>
                </div>
              </div>

              {/* Info panel */}
              <div className="flex-1 flex flex-col px-6 pb-6 pt-5 min-w-0">
                <div className="flex items-center justify-between mb-4">
                  <span className="label-caps text-slate-400">
                    {featuredProperties[safeFeaturedIndex].propertyCode}
                  </span>
                  {featuredProperties.length > 1 && (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setFeaturedIndex((i) => (i === 0 ? featuredProperties.length - 1 : i - 1))}
                        className="size-7 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                      >
                        <IconChevronLeft size={14} />
                      </button>
                      <span className="label-caps text-slate-400 tabular-nums">{safeFeaturedIndex + 1}&thinsp;/&thinsp;{featuredProperties.length}</span>
                      <button
                        onClick={() => setFeaturedIndex((i) => (i === featuredProperties.length - 1 ? 0 : i + 1))}
                        className="size-7 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                      >
                        <IconChevronRight size={14} />
                      </button>
                    </div>
                  )}
                </div>
                {/* Listing type + name */}
                <div className="mb-4">
                  <Badge
                    tone={featuredProperties[safeFeaturedIndex].listingType === "sale" ? "primary" : "neutral"}
                    className="mb-2"
                  >
                    {LISTING_TYPE_LABEL[featuredProperties[safeFeaturedIndex].listingType]}
                  </Badge>
                  <h4 className="text-title-primary leading-snug">{featuredProperties[safeFeaturedIndex].name}</h4>
                  <p className="body-sm text-slate-400 flex items-center gap-1 mt-1">
                    <IconMapPin size={13} stroke={1.5} />
                    {featuredProperties[safeFeaturedIndex].location}
                  </p>
                </div>

                {/* Specs row — only shown if any data present */}
                {(featuredProperties[safeFeaturedIndex].bedrooms != null ||
                  featuredProperties[safeFeaturedIndex].bathrooms != null ||
                  featuredProperties[safeFeaturedIndex].sizeSqft != null) && (
                    <div className="flex items-center gap-4 mb-4 flex-wrap">
                      {featuredProperties[safeFeaturedIndex].bedrooms != null && (
                        <div className="flex items-center gap-1.5 text-slate-500">
                          <IconBed size={14} stroke={1.5} className="text-slate-400" />
                          <span className="body-sm">{featuredProperties[safeFeaturedIndex].bedrooms} bed</span>
                        </div>
                      )}
                      {featuredProperties[safeFeaturedIndex].bathrooms != null && (
                        <div className="flex items-center gap-1.5 text-slate-500">
                          <IconBath size={14} stroke={1.5} className="text-slate-400" />
                          <span className="body-sm">{featuredProperties[safeFeaturedIndex].bathrooms} bath</span>
                        </div>
                      )}
                      {featuredProperties[safeFeaturedIndex].sizeSqft != null && (
                        <div className="flex items-center gap-1.5 text-slate-500">
                          <IconRuler size={14} stroke={1.5} className="text-slate-400" />
                          <span className="body-sm">{featuredProperties[safeFeaturedIndex].sizeSqft?.toLocaleString()} sqft</span>
                        </div>
                      )}
                    </div>
                  )}

                {/* Price + type + CTA */}
                <div className="mt-auto pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
                  <div>
                    <p className="label-caps text-slate-400 mb-0.5">{featuredPriceDisplay(featuredProperties[safeFeaturedIndex]).label}</p>
                    <p className="mono-stat text-slate-900 text-xl tracking-tight">
                      {featuredPriceDisplay(featuredProperties[safeFeaturedIndex]).value}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex items-center gap-1.5 text-slate-400 mr-1">
                      <PropertyTypeIcon type={featuredProperties[safeFeaturedIndex].propertyType} size={13} />
                      <span className="label-caps">{featuredProperties[safeFeaturedIndex].propertyType}</span>
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setDrawerProperty(featuredProperties[safeFeaturedIndex])}
                    >
                      Details
                    </Button>
                    <Button
                      size="sm"
                      className="bg-[#151936] text-white hover:bg-[#151936]/90"
                      onClick={() => setDrawerProperty(featuredProperties[safeFeaturedIndex])}
                    >
                      <IconEye size={14} /> View
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-14 text-center text-slate-400 flex-1">
              <div className="size-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center mb-3">
                <IconStar size={24} className="opacity-40" />
              </div>
              <p className="body-sm text-slate-500">No featured listings currently.</p>
              <p className="label-caps text-slate-300 mt-1">Star a property row to feature it here.</p>
            </div>
          )}
        </div>

        {/* Portfolio Mix — fully driven by STATUS_CONFIG + type breakdown */}
        <div className="bg-white border border-slate-100 rounded-[24px] shadow-sm p-4 sm:p-6 flex flex-col">
          <h3 className="text-base font-medium text-slate-900 flex items-center gap-2 mb-6">
            <IconChartBar size={18} className="text-indigo-500" /> Portfolio Mix
          </h3>

          {/* Segmented status bar using STATUS_CONFIG colors */}
          <div className="flex h-3 w-full overflow-hidden rounded-full gap-0.5 mb-6">
            {portfolioMix.map(({ status, pct, config }) =>
              statusCounts[status] > 0 ? (
                <div
                  key={status}
                  className={cn("h-full transition-all duration-1000", config.dot)}
                  style={{ width: `${pct}%` }}
                />
              ) : null
            )}
            {properties.length === 0 && <div className="h-full flex-1 bg-slate-100 rounded-full" />}
          </div>

          {/* All 5 status rows from STATUS_CONFIG */}
          <div className="space-y-3 mb-6">
            {portfolioMix.map(({ status, count, config, pct }) => (
              <div key={status} className="flex items-center gap-3">
                <span className={cn("size-2.5 rounded-full shrink-0", config.dot)} />
                <span className="text-sm font-medium text-slate-600 flex-1">{config.label}</span>
                <div className="flex items-center gap-3">
                  <div className="h-1.5 w-20 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all duration-700", config.dot)}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="mono-stat text-slate-800 w-6 text-right text-sm">{count}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Property type breakdown */}
          {typeMix.length > 0 && (
            <>
              <div className="border-t border-slate-100 pt-5 mt-auto">
                <p className="text-xs  font-medium uppercase tracking-widest text-slate-400 mb-4">By Property Type</p>
                <div className="space-y-2.5">
                  {typeMix.map(({ type, count }) => (
                    <div key={type} className="flex items-center gap-3">
                      <div className="size-6 rounded-md bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                        <PropertyTypeIcon type={type} size={14} />
                      </div>
                      <span className="text-sm text-slate-600 flex-1">{type}</span>
                      <span className="mono-stat text-slate-800 text-sm">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4 my-6">
        <hr className="flex-1 border-slate-200/60" />
        <span className="label-caps text-slate-400 tracking-wider">Inventory Data</span>
        <hr className="flex-1 border-slate-200/60" />
      </div>

      {/* ── Data Tier: Properties Table ── */}
      <div className="bg-transparent lg:bg-white border-transparent lg:border-slate-100 p-0 lg:p-8 rounded-none lg:rounded-[24px] shadow-none lg:shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b-0 lg:border-b border-slate-100 pb-2 lg:pb-5 mb-4 lg:mb-5">
          <div className="w-full md:w-auto md:flex-1 max-w-md">
            <div className="relative flex items-center group w-full">
              <IconSearch
                size={16}
                className="absolute left-3.5 text-slate-400 group-focus-within:text-[#151936] transition-colors"
              />
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="Search by name, code, location…"
                className="w-full bg-slate-50 lg:bg-slate-50 border border-slate-200/60 rounded-xl pl-10 pr-4 py-2.5 body-sm text-slate-900 outline-none placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-[#151936]/10 focus:border-[#151936]/30 transition-all shadow-sm"
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  className="absolute right-3 text-slate-300 hover:text-slate-600 transition-colors"
                >
                  <IconX size={14} />
                </button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-2 md:pb-0 -mx-4 px-4 md:mx-0 md:px-0">
            <div className="flex bg-slate-100 p-1 rounded-xl shrink-0">
              <button
                onClick={() => { setStatusFilter("all"); setPage(1); }}
                className={cn(
                  "px-3 py-1.5 body-sm rounded-lg transition-colors",
                  statusFilter === "all" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                )}
              >
                All
              </button>
              {STATUS_ORDER.map((status) => (
                <button
                  key={status}
                  onClick={() => { setStatusFilter(status); setPage(1); }}
                  className={cn(
                    "px-3 py-1.5 body-sm rounded-lg transition-colors flex items-center gap-1.5",
                    statusFilter === status
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  )}
                >
                  <span className={cn("size-1.5 rounded-full", STATUS_CONFIG[status].dot)} />
                  {STATUS_CONFIG[status].label}
                </button>
              ))}
            </div>
            <button
              onClick={() => setFiltersOpen(!filtersOpen)}
              className={cn(
                "inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 body-sm rounded-xl transition-colors border shadow-sm",
                filtersOpen
                  ? "bg-[#151936] text-white border-[#151936]"
                  : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200/60"
              )}
            >
              <IconFilter size={15} />
              Advanced
              {activeFilterCount > 0 && (
                <span className="inline-flex size-4 items-center justify-center rounded-full bg-amber-400 text-[#151936] mono-data">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Advanced Filters Panel */}
        {filtersOpen && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-2xl border border-slate-100 bg-slate-50/60 p-4 mb-6">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="prop-type-filter" className="label-caps text-slate-400">
                Property type
              </label>
              <select
                id="prop-type-filter"
                value={typeFilter}
                onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
                className="bg-white border border-slate-200 rounded-xl px-3 py-2 body-sm outline-none focus:ring-2 focus:ring-[#151936]/10 focus:border-[#151936]/30"
              >
                <option value="all">All types</option>
                {PROPERTY_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="prop-listing-filter" className="label-caps text-slate-400">
                Listing type
              </label>
              <select
                id="prop-listing-filter"
                value={listingFilter}
                onChange={(e) => { setListingFilter(e.target.value as ListingFilter); setPage(1); }}
                className="bg-white border border-slate-200 rounded-xl px-3 py-2 body-sm outline-none focus:ring-2 focus:ring-[#151936]/10 focus:border-[#151936]/30"
              >
                <option value="all">For sale &amp; to let</option>
                <option value="sale">For sale</option>
                <option value="let">To let</option>
              </select>
            </div>
            {hasActiveFilters && (
              <div className="sm:col-span-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => { setQuery(""); setStatusFilter("all"); setTypeFilter("all"); setListingFilter("all"); setPage(1); }}
                  className="inline-flex items-center gap-1 px-3 py-1.5 body-sm text-slate-500 hover:text-rose-600 transition-colors"
                >
                  <IconX size={14} /> Clear All Filters
                </button>
              </div>
            )}
          </div>
        )}

        {loading ? (
          <div className="space-y-4 py-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 py-3 border-b border-slate-50">
                <div className="h-5 w-20 bg-slate-100 animate-pulse rounded" />
                <div className="h-5 w-48 bg-slate-100 animate-pulse rounded" />
                <div className="h-5 w-24 bg-slate-100 animate-pulse rounded" />
                <div className="h-5 w-32 bg-slate-100 animate-pulse rounded" />
                <div className="h-5 w-24 bg-slate-100 animate-pulse rounded ml-auto" />
              </div>
            ))}
          </div>
        ) : properties.length === 0 ? (
          <div className="py-12">
            <EmptyState
              icon={IconBuildingCommunity}
              title="No properties registered"
              description="Register the first property unit in the portfolio. Ensure you have onboarded the landlord contact beforehand."
              action={canManage ? "Register Property" : ""}
              onClick={canManage ? () => setIsCreateOpen(true) : undefined}
            />
          </div>
        ) : sorted.length === 0 ? (
          <div className="py-12 flex flex-col items-center gap-3 text-center">
            <IconSearch size={32} className="text-slate-300" aria-hidden="true" />
            <p className="text-title-primary">No properties match your filters</p>
            <p className="text-desc-secondary max-w-sm">
              Try a different search term or clear filters to see the full portfolio.
            </p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => { setQuery(""); setStatusFilter("all"); setTypeFilter("all"); setListingFilter("all"); }}
            >
              Clear filters
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Mobile/Tablet Card Grid (hidden on desktop) */}
            <div className="block lg:hidden space-y-4">
              {visible.map((p) => {
                const sc = STATUS_CONFIG[p.status] || STATUS_CONFIG.available;
                return (
                  <div
                    key={p.id}
                    onClick={() => setDrawerProperty(p)}
                    className="p-5 bg-white border border-slate-100 rounded-2xl shadow-sm hover:shadow-md transition-all flex flex-col gap-4 relative cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="relative size-12 shrink-0 rounded-xl overflow-hidden bg-slate-50 border border-slate-200 flex items-center justify-center">
                          {primaryImageUrl(p) ? (
                            <Image
                              src={primaryImageUrl(p)!}
                              alt={p.name}
                              fill
                              sizes="48px"
                              className="object-cover"
                            />
                          ) : (
                            <PropertyTypeIcon
                              type={p.propertyType}
                              size={22}
                              className="text-slate-400"
                            />
                          )}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-title-primary leading-snug truncate">{p.name}</h4>
                          <span className="mono-data text-slate-400 text-xs">{p.propertyCode}</span>
                        </div>
                      </div>

                      {/* Featured button */}
                      <button
                        type="button"
                        disabled={!canManage}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleFeature(p.id, !!p.isFeatured);
                        }}
                        className={cn(
                          "size-8 rounded-lg flex items-center justify-center border border-slate-100 bg-slate-50/50 text-slate-350 hover:text-amber-400",
                          p.isFeatured && "text-amber-400 border-amber-100 bg-amber-50"
                        )}
                      >
                        {p.isFeatured ? <IconStarFilled size={15} /> : <IconStar size={15} />}
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-y-3 gap-x-2 text-xs border-t border-slate-50 pt-3">
                      <div>
                        <p className="label-caps text-slate-400 mb-0.5">Type &amp; Mandate</p>
                        <span className="body-sm text-slate-700">{p.propertyType} ({LISTING_TYPE_LABEL[p.listingType as keyof typeof LISTING_TYPE_LABEL] || p.listingType})</span>
                      </div>
                      <div>
                        <p className="label-caps text-slate-400 mb-0.5">Location</p>
                        <span className="body-sm text-slate-700 truncate block">{p.location}</span>
                      </div>
                      <div>
                        <p className="label-caps text-slate-400 mb-0.5">Rent / Price</p>
                        <span className="mono-amount text-slate-900 text-sm">
                          {p.listingType === "sale"
                            ? p.askingPriceKes
                              ? formatCompactKES(parseFloat(p.askingPriceKes))
                              : "—"
                            : p.monthlyRentKes
                              ? formatCompactKES(parseFloat(p.monthlyRentKes))
                              : "—"}
                        </span>
                      </div>
                      <div>
                        <p className="label-caps text-slate-400 mb-0.5">Status</p>
                        <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs uppercase tracking-wider font-medium", sc.pill)}>
                          <span className={cn("size-1 rounded-full", sc.dot)} />
                          {sc.label}
                        </span>
                      </div>
                      {p.mandateStatus && (
                        <div>
                          <p className="label-caps text-slate-400 mb-0.5">Mandate</p>
                          <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs uppercase tracking-wider font-medium", MANDATE_STATUS_CONFIG[p.mandateStatus].pill)}>
                            <span className={cn("size-1 rounded-full", MANDATE_STATUS_CONFIG[p.mandateStatus].dot)} />
                            {MANDATE_STATUS_CONFIG[p.mandateStatus].label}
                          </span>
                        </div>
                      )}
                    </div>

                    {canManage && (
                      <div className="flex items-center justify-end gap-2 border-t border-slate-50 pt-3" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setEditingProperty(p)}
                        >
                          <IconEdit size={13} className="mr-1" /> Edit
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          className="text-rose-650 hover:bg-rose-50 hover:text-rose-700 border-rose-100"
                          onClick={() => setDeleteConfirmId(p.id)}
                        >
                          <IconTrash size={13} className="mr-1" /> Delete
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Table wrapper: hidden on mobile, visible on desktop */}
            <div className="hidden lg:block overflow-x-auto custom-scrollbar pb-2">
              <table className="w-full min-w-[850px] text-left" style={{ overflowX: "auto" }}>
                <thead>
                  <tr className="border-b border-slate-100 label-caps text-slate-500 bg-slate-50/50">
                    <th className="pl-4 pr-1 py-3 w-8">
                      <span className="sr-only">Featured</span>
                    </th>
                    <th
                      className="px-4 py-3 cursor-pointer hover:text-slate-800 transition-colors group"
                      onClick={() => requestSort("propertyCode")}
                    >
                      <div className="flex items-center gap-1.5">
                        Code
                        {sortConfig?.key === "propertyCode" ? (
                          sortConfig.direction === "asc" ? <IconSortAscending size={14} /> : <IconSortDescending size={14} />
                        ) : (
                          <IconArrowsSort size={14} className="opacity-0 group-hover:opacity-100 text-slate-400" />
                        )}
                      </div>
                    </th>
                    <th
                      className="px-4 py-3 cursor-pointer hover:text-slate-800 transition-colors group"
                      onClick={() => requestSort("name")}
                    >
                      <div className="flex items-center gap-1.5">
                        Name
                        {sortConfig?.key === "name" ? (
                          sortConfig.direction === "asc" ? <IconSortAscending size={14} /> : <IconSortDescending size={14} />
                        ) : (
                          <IconArrowsSort size={14} className="opacity-0 group-hover:opacity-100 text-slate-400" />
                        )}
                      </div>
                    </th>
                    <th className="px-4 py-3 hidden lg:table-cell">Type</th>
                    <th className="px-4 py-3">Location</th>
                    <th
                      className="px-4 py-3 text-right cursor-pointer hover:text-slate-800 transition-colors group"
                      onClick={() => requestSort("monthlyRentKes")}
                    >
                      <div className="flex items-center justify-end gap-1.5">
                        Rent / Price
                        {sortConfig?.key === "monthlyRentKes" ? (
                          sortConfig.direction === "asc" ? <IconSortAscending size={14} /> : <IconSortDescending size={14} />
                        ) : (
                          <IconArrowsSort size={14} className="opacity-0 group-hover:opacity-100 text-slate-400" />
                        )}
                      </div>
                    </th>
                    <th className="px-4 py-3 text-center">Status</th>
                    {canManage && <th className="px-4 py-3 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visible.map((p) => {
                    const sc = STATUS_CONFIG[p.status];
                    return (
                      <tr
                        key={p.id}
                        className="transition-colors hover:bg-slate-50/80 group cursor-pointer"
                        onClick={() => setDrawerProperty(p)}
                      >
                        {/* Star / Featured */}
                        <td className="pl-4 pr-1 py-4" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            disabled={!canManage}
                            onClick={() => handleToggleFeature(p.id, !!p.isFeatured)}
                            aria-label={p.isFeatured ? "Remove from featured" : "Add to featured"}
                            aria-pressed={!!p.isFeatured}
                            className={cn(
                              "flex size-7 items-center justify-center rounded-lg transition-all",
                              p.isFeatured
                                ? "text-amber-400 hover:text-amber-500"
                                : "text-slate-300 opacity-0 group-hover:opacity-100 hover:text-amber-400",
                              !canManage && "cursor-default hover:text-slate-300"
                            )}
                          >
                            {p.isFeatured ? <IconStarFilled size={16} /> : <IconStar size={16} />}
                          </button>
                        </td>

                        {/* Code */}
                        <td className="px-4 py-4 mono-data text-slate-500 group-hover:text-slate-900 transition-colors">
                          {p.propertyCode}
                        </td>

                        {/* Name + thumbnail */}
                        <td className="px-4 py-4 text-title-primary">
                          <div className="flex items-center gap-3">
                            {/* Thumbnail: photo if present, otherwise PROPERTY_TYPE_ICON */}
                            <div className="relative size-9 shrink-0 rounded-lg overflow-hidden bg-slate-50 border border-slate-200 flex items-center justify-center">
                              {primaryImageUrl(p) ? (
                                <Image
                                  src={primaryImageUrl(p)!}
                                  alt={p.name}
                                  fill
                                  sizes="36px"
                                  className="object-cover"
                                />
                              ) : (
                                <PropertyTypeIcon
                                  type={p.propertyType}
                                  size={18}
                                  className="text-slate-400"
                                />
                              )}
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="truncate">{p.name}</span>
                              <span className="text-meta-muted lg:hidden">{p.propertyType}</span>
                            </div>
                          </div>
                        </td>

                        {/* Type (hidden below lg) */}
                        <td className="px-4 py-4 hidden lg:table-cell">
                          <div className="flex items-center gap-2">
                            <div className="size-6 rounded-md bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                              <PropertyTypeIcon type={p.propertyType} size={13} />
                            </div>
                            <div className="flex flex-col gap-0.5">
                              <span className="body-sm text-slate-700">{p.propertyType}</span>
                              <span className={cn("label-caps", p.listingType === "sale" ? "text-indigo-500" : "text-slate-400")}>
                                {LISTING_TYPE_LABEL[p.listingType]}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Location */}
                        <td className="px-4 py-4 body-sm text-slate-600">{p.location}</td>

                        {/* Price */}
                        <td className="px-4 py-4 text-right mono-amount text-slate-900">
                          {p.listingType === "sale"
                            ? p.askingPriceKes
                              ? formatCompactKES(parseFloat(p.askingPriceKes))
                              : "—"
                            : p.monthlyRentKes
                              ? formatCompactKES(parseFloat(p.monthlyRentKes))
                              : "—"}
                        </td>

                        {/* Status badge */}
                        <td className="px-4 py-4 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <span
                              className={cn(
                                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 label-caps",
                                sc.pill
                              )}
                            >
                              <span className={cn("size-1.5 rounded-full", sc.dot)} aria-hidden="true" />
                              {sc.label}
                            </span>
                            {p.mandateStatus && (
                              <span
                                className={cn(
                                  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 label-caps text-[10px]",
                                  MANDATE_STATUS_CONFIG[p.mandateStatus].pill
                                )}
                              >
                                <span className={cn("size-1 rounded-full", MANDATE_STATUS_CONFIG[p.mandateStatus].dot)} aria-hidden="true" />
                                {MANDATE_STATUS_CONFIG[p.mandateStatus].label}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Actions dropdown — rendered outside overflow so it isn't clipped */}
                        {canManage && (
                          <td
                            className="px-4 py-4 text-right relative"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <DropdownMenu
                              label="Row Actions"
                              trigger={
                                <div
                                  className="inline-flex p-1.5 rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-900 transition-all border border-transparent hover:border-slate-200"
                                  aria-label="Row actions"
                                >
                                  <IconDotsVertical size={16} />
                                </div>
                              }
                              align="right"
                            >
                              <DropdownItem
                                icon={IconEdit}
                                onClick={() => setEditingProperty(p)}
                              >
                                Edit Property
                              </DropdownItem>
                              <DropdownItem
                                icon={p.isFeatured ? IconStarFilled : IconStar}
                                onClick={() => handleToggleFeature(p.id, !!p.isFeatured)}
                              >
                                {p.isFeatured ? "Remove from Featured" : "Add to Featured"}
                              </DropdownItem>
                              <DropdownItem
                                icon={IconTrash}
                                variant="danger"
                                onClick={() => setDeleteConfirmId(p.id)}
                              >
                                Delete Property
                              </DropdownItem>
                            </DropdownMenu>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="border-t border-slate-100 pt-5">
              <PaginationControls
                currentPage={safePage}
                totalPages={totalPages}
                onPageChange={setPage}
                label={`${sorted.length} of ${properties.length} property records`}
              />
            </div>
          </div>
        )}
      </div>

      {isCreateOpen && (
        <PropertyFormModal open={isCreateOpen} onClose={() => setIsCreateOpen(false)} onSubmit={handleCreateSuccess} />
      )}

      {editingProperty && (
        <PropertyFormModal
          open={!!editingProperty}
          mode="edit"
          initialData={editingProperty as unknown as Record<string, unknown>}
          onClose={() => setEditingProperty(null)}
          onSubmit={handleEditSuccess}
        />
      )}

      <PropertyDetailDrawer
        property={drawerProperty}
        open={!!drawerProperty}
        entityId={entityId}
        onClose={() => setDrawerProperty(null)}
        canManage={canManage}
        onEdit={(p) => {
          setDrawerProperty(null);
          setEditingProperty(p);
        }}
        onDelete={(id) => {
          setDrawerProperty(null);
          setDeleteConfirmId(id);
        }}
        onStatusChange={handleStatusChange}
        onToggleFeature={handleToggleFeature}
      />

      <ConfirmDialog
        open={!!deleteConfirmId}
        title="Delete Property"
        description="Are you sure you want to completely remove this property? This action is permanent and cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        tone="danger"
        isLoading={isDeleting}
        onConfirm={handleDelete}
        onClose={() => setDeleteConfirmId(null)}
      />
    </PageTransition>
  );
}
