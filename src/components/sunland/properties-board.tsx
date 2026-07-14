"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  IconBuildingCommunity,
  IconCash,
  IconFilter,
  IconPlus,
  IconRefresh,
  IconSearch,
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
  IconRuler,
  IconEye,
  IconLayoutGrid,
  IconList,
  IconUsers,
} from "@tabler/icons-react";
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
import { PropertyOwnerProfileDrawer } from "./property-owner-profile-drawer";
import { PropertyManagerProfileDrawer } from "./property-manager-profile-drawer";
import { PortfolioHubNav } from "./portfolio-hub-nav";
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

function isSale(property: Property): boolean {
  return property.listingType?.toLowerCase() === "sale";
}

function priceDisplay(property: Property): string {
  if (isSale(property)) {
    return property.askingPriceKes ? formatCompactKES(parseFloat(property.askingPriceKes)) : "On Request";
  }
  return property.monthlyRentKes ? `${formatCompactKES(parseFloat(property.monthlyRentKes))}/mo` : "On Request";
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

function ownerInitials(property: Property): string {
  const name = property.owner?.name || property.ownerName;
  if (!name) return "-";
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2 ? (parts[0][0] + parts[1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
}

function managerInitials(name?: string | null): string {
  if (!name) return "-";
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2 ? (parts[0][0] + parts[1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
}

/** Status badge pill - always dark/black text regardless of background for legibility */
function StatusPill({ status }: { status: PropertyStatus }) {
  const sc = STATUS_CONFIG[status] || STATUS_CONFIG.available;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium tracking-wide text-slate-900",
        sc.pill
      )}
    >
      <span className={cn("size-1.5 rounded-full shrink-0", sc.dot)} />
      {sc.label}
    </span>
  );
}

/** Spec chip with icon */
function SpecChip({ icon: Icon, value }: { icon: React.ElementType; value: string }) {
  return (
    <span className="inline-flex items-center gap-1 bg-slate-50 border border-slate-100 rounded-lg px-2 py-1 label-caps text-slate-500">
      <Icon size={11} stroke={1.8} className="text-slate-400 shrink-0" />
      {value}
    </span>
  );
}

/** Image-forward grid card - production-grade property portfolio design */
function PropertyGridCard({
  property,
  canManage,
  onOpen,
  onOwnerClick,
  onManagerClick,
  onToggleFeature,
}: {
  property: Property;
  canManage: boolean;
  onOpen: () => void;
  onOwnerClick: () => void;
  onManagerClick: () => void;
  onToggleFeature: () => void;
}) {
  const ownerName = property.owner?.name || property.ownerName;
  const imgUrl = primaryImageUrl(property);
  const isLand = property.propertyType === "Land";

  // Build icon-driven spec chips
  const specItems: { icon: React.ElementType; value: string }[] = [];
  const unitTotal = property.unitBreakdown?.reduce((sum, u) => sum + u.count, 0);
  if (unitTotal) specItems.push({ icon: IconBuildingCommunity, value: `${unitTotal} units` });
  if (!isLand && property.bedrooms != null) specItems.push({ icon: IconBed, value: `${property.bedrooms} beds` });
  if (property.sizeSqft != null) specItems.push({ icon: IconRuler, value: `${property.sizeSqft.toLocaleString()} sqft` });
  if (property.landAreaSqft != null) specItems.push({ icon: IconRuler, value: `${(property.landAreaSqft / 43560).toFixed(2)} ac` });
  const visibleSpecs = specItems.slice(0, 3);

  return (
    <div
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); }
      }}
      aria-label={`Open ${property.name}`}
      className="group bg-white border border-slate-100 rounded-[22px] shadow-[0_4px_20px_rgb(0,0,0,0.04)] overflow-hidden flex flex-col cursor-pointer transition-all duration-300 hover:shadow-[0_12px_40px_rgb(0,0,0,0.10)] hover:-translate-y-1"
    >
      {/* ── Image Panel ── */}
      <div className="relative h-[180px] bg-slate-100 shrink-0 overflow-hidden">
        {imgUrl ? (
          <Image
            src={imgUrl}
            alt={property.name}
            fill
            sizes="320px"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-slate-100 to-slate-50 flex items-center justify-center">
            <PropertyTypeIcon type={property.propertyType} size={40} className="text-slate-200" />
          </div>
        )}
        {/* Dark scrim from bottom */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent pointer-events-none" />

        {/* Top-left: listing type chip */}
        <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 bg-[#151936]/70 backdrop-blur-md rounded-lg px-2.5 py-1 text-xs font-medium uppercase tracking-widest text-white shadow-sm">
          {LISTING_TYPE_LABEL[property.listingType as keyof typeof LISTING_TYPE_LABEL] || property.listingType}
        </span>

        {/* Top-right: feature star */}
        {canManage && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onToggleFeature(); }}
            aria-label={property.isFeatured ? "Remove from featured" : "Add to featured"}
            aria-pressed={!!property.isFeatured}
            className={cn(
              "absolute top-3 right-3 size-8 rounded-full flex items-center justify-center transition-all duration-200 backdrop-blur-md shadow-sm",
              property.isFeatured
                ? "bg-amber-400/95 text-[#151936] shadow-amber-300/50 shadow-md"
                : "bg-black/30 text-white hover:bg-amber-400 hover:text-[#151936]"
            )}
          >
            {property.isFeatured ? <IconStarFilled size={14} /> : <IconStar size={14} />}
          </button>
        )}

        {/* Bottom-left: price */}
        <div className="absolute bottom-3 left-3">
          <p className="text-white font-mono font-medium text-base leading-none drop-shadow-sm">{priceDisplay(property)}</p>
          <p className="text-white/70 text-xs mt-0.5">
            {isSale(property) ? "asking" : "per month"}
          </p>
        </div>

        {/* Bottom-right: status pill */}
        <div className="absolute bottom-3 right-3">
          <StatusPill status={property.status} />
        </div>
      </div>

      {/* ── Info Panel ── */}
      <div className="p-4 flex flex-col gap-2.5 flex-1">
        {/* Property name + code */}
        <div>
          <div className="flex items-start justify-between gap-2 mb-0.5">
            <p className="body-sm text-slate-900 leading-snug line-clamp-1 flex-1">{property.name}</p>
            <span className="mono-data text-slate-300 text-xs shrink-0 mt-px">{property.propertyCode}</span>
          </div>
          <p className="text-xs text-slate-400 flex items-center gap-1">
            <IconMapPin size={11} stroke={2} className="shrink-0" />
            <span className="truncate">{property.location}</span>
          </p>
        </div>

        {/* Spec chips */}
        {visibleSpecs.length > 0 && (
          <div className="flex gap-1.5 flex-wrap">
            {visibleSpecs.map((spec, i) => (
              <SpecChip key={i} icon={spec.icon} value={spec.value} />
            ))}
            {(property.amenities?.length ?? 0) > 0 && (
              <span className="inline-flex items-center gap-1 bg-emerald-50 border border-emerald-100 rounded-lg px-2 py-1 label-caps text-emerald-700">
                +{property.amenities!.length} amenities
              </span>
            )}
          </div>
        )}

        {/* Footer: owner + manager + property type icon */}
        <div className="mt-auto pt-2.5 border-t border-slate-50 flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            {ownerName ? (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onOwnerClick(); }}
                aria-label={`View owner ${ownerName}`}
                className="inline-flex items-center gap-2 rounded-full hover:bg-slate-50 transition-colors pr-1 py-0.5 min-w-0"
              >
                <span className="size-6 rounded-full bg-[#151936] text-[#f3df27] flex items-center justify-center text-xs font-medium shrink-0">
                  {ownerInitials(property)}
                </span>
                <span className="text-xs text-slate-500 truncate max-w-[100px]">{ownerName}</span>
              </button>
            ) : (
              <span className="text-xs text-slate-300 italic">No owner</span>
            )}
            <div className="size-7 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-300 shrink-0">
              <PropertyTypeIcon type={property.propertyType} size={14} />
            </div>
          </div>
          {property.manager?.name ? (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onManagerClick(); }}
              aria-label={`View manager ${property.manager.name}`}
              className="inline-flex items-center gap-2 rounded-full hover:bg-slate-50 transition-colors pr-1 py-0.5 min-w-0 self-start"
            >
              <span className="size-6 rounded-full bg-emerald-700 text-white flex items-center justify-center text-xs font-medium shrink-0">
                {managerInitials(property.manager.name)}
              </span>
              <span className="text-xs text-slate-500 truncate max-w-[100px]">{property.manager.name}</span>
            </button>
          ) : (
            <span className="text-xs text-slate-300 italic">No manager assigned</span>
          )}
        </div>
      </div>
    </div>
  );
}


export function PropertiesBoard({
  entityId,
  canManage = true,
}: {
  entityId: string;
  canManage?: boolean;
}) {
  const { pushToast } = useToast();
  const searchParams = useSearchParams();
  const router = useRouter();

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
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [ownerDrawerId, setOwnerDrawerId] = useState<string | null>(null);
  const [managerDrawerId, setManagerDrawerId] = useState<string | null>(null);

  // Initialize modal state from search params
  useEffect(() => {
    if (searchParams.get("create") === "true") {
      setIsCreateOpen(true);
      // Clean up the URL so it doesn't re-trigger on refresh
      router.replace("/admin/properties", { scroll: false });
    }
  }, [searchParams, router]);

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

  // useEffect calling loadProperties is correct pattern per React docs - loading
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
        pushToast({ title: "Couldn't update status", body: "Change was reverted - try again.", tone: "warning" });
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

      <PortfolioHubNav active="properties" />


      <div className="flex items-center gap-4 my-6">
        <hr className="flex-1 border-slate-200/60" />
        <span className="label-caps text-slate-400 tracking-wider">Portfolio Signals</span>
        <hr className="flex-1 border-slate-200/60" />
      </div>

      {/* ── Dense, High-Contrast Dark KPI Tier - driven fully from STATUS_CONFIG ── */}
      <div className="gsap-stagger bg-tertiary-gradient border border-[#122a20]/80 p-1.5 rounded-[24px] shadow-xl relative overflow-hidden group">
        <div className="absolute right-0 top-0 size-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-emerald-500/20 transition-colors duration-700" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-white/10">
          {/* Total */}
          <div className="py-6 px-6 lg:py-8 lg:px-8 flex flex-col justify-between h-[150px] relative overflow-hidden group/card">
            <div className="absolute -bottom-16 -right-12 opacity-5 text-emerald-500 pointer-events-none transition-transform duration-700 group-hover/card:scale-110">
              <IconBuildingCommunity size={180} stroke={1} />
            </div>

            <span className="text-xs font-medium text-slate-400 relative z-10">Total Properties</span>
            <div className="flex items-end justify-between gap-3 relative z-10">
              <span className="font-mono text-4xl font-medium text-white">{kpis.total}</span>
              <div className="text-right mb-0.5">
                <span className="text-xs font-medium uppercase tracking-widest text-emerald-400">{kpis.available} AVAILABLE</span>
              </div>
            </div>
          </div>

          {/* Occupancy - SVG ring gauge, matches design spec exactly */}
          <div className="py-6 px-6 lg:py-8 lg:px-8 flex items-center gap-6 h-[150px]">
            <svg width="60" height="60" viewBox="0 0 64 64" role="img" aria-label={`Occupancy ${kpis.rate.toFixed(0)}%`} className="shrink-0">
              <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="7" />
              <circle
                cx="32" cy="32" r="26" fill="none" stroke="#f3df27" strokeWidth="7" strokeLinecap="round"
                strokeDasharray={`${((kpis.rate / 100) * 163.4).toFixed(1)} 163.4`}
                transform="rotate(-90 32 32)"
              />
            </svg>
            <div className="flex flex-col justify-between h-full py-1">
              <p className="text-xs font-medium text-slate-400">Occupancy</p>
              <span className="font-mono text-4xl font-medium text-white">{kpis.rate.toFixed(0)}%</span>
              <p className="text-xs font-medium uppercase tracking-widest text-emerald-400">{kpis.occupied} occupied</p>
            </div>
          </div>

          {/* Portfolio mix - segment bar + legend, all 5 STATUS_ORDER segments */}
          <div className="py-6 px-6 lg:py-8 lg:px-8 flex flex-col justify-between h-[150px]">
            <span className="text-xs font-medium text-slate-400">Portfolio mix</span>
            {/* Full status segment bar - all 5 segments from STATUS_ORDER */}
            <div className="flex h-2 w-full overflow-hidden rounded-full gap-0.5 my-auto">
              {portfolioMix.map(({ status, pct, config }) =>
                statusCounts[status] > 0 ? (
                  <div
                    key={status}
                    className={cn("h-full transition-all duration-1000", config.dot.replace("bg-", "bg-"))}
                    style={{ width: `${pct}%` }}
                    title={`${config.label}: ${statusCounts[status]}`}
                  />
                ) : null
              )}
            </div>
            <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 mt-auto">
              {portfolioMix.slice(0, 4).map(({ status, count, config }) => (
                <div key={status} className="flex items-center gap-1.5">
                  <span className={cn("size-1.5 rounded-full inline-block", config.dot)} />
                  <span className="text-xs font-medium uppercase tracking-wider text-slate-400">{config.label} · <span className="mono-data">{count}</span></span>
                </div>
              ))}
            </div>
          </div>

          {/* Rent pool */}
          <div className="py-6 px-6 lg:py-8 lg:px-8 flex flex-col justify-between h-[150px] relative overflow-hidden group/card">
            <div className="absolute -bottom-12 -right-8 opacity-[0.02] text-white pointer-events-none transition-transform duration-700 group-hover/card:scale-110">
              <IconCash size={180} stroke={1} />
            </div>

            <span className="text-xs font-medium text-slate-400 relative z-10">Monthly Rent Pool</span>
            <div className="relative z-10">
              <span className="font-mono text-4xl text-white">
                KES {formatCompactKES(kpis.rentPool).replace('KES ', '')}
              </span>
              <p className="text-xs font-medium uppercase tracking-widest text-slate-400 mt-2">Contracted · occupied only</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 my-6">
        <hr className="flex-1 border-slate-200/60" />
        <span className="label-caps text-slate-400 tracking-wider">Featured & Mix</span>
        <hr className="flex-1 border-slate-200/60" />
      </div>

      {/* ── Market Highlights Tier ── */}
      <div className="gsap-stagger grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Featured Properties Carousel */}
        <div className="lg:col-span-2 bg-white border border-slate-100 rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_16px_40px_rgb(0,0,0,0.06)] transition-all duration-500 flex flex-col overflow-hidden relative">
          {featuredProperties.length > 0 ? (
            <div className="flex flex-col sm:flex-row flex-1 min-h-0" key={safeFeaturedIndex}>
              {/* ── Image panel — full width on mobile, half on sm+ ── */}
              <div className="relative h-56 sm:h-auto sm:w-1/2 shrink-0 overflow-hidden">
                <div className="absolute top-4 left-4 z-20">
                  <span className="bg-[#f3df27] px-2.5 py-1 rounded-xl inline-flex items-center gap-1.5 text-[#151936] text-xs font-medium shadow-md">
                    <IconStarFilled size={13} /> Featured
                  </span>
                </div>
                {primaryImageUrl(featuredProperties[safeFeaturedIndex]) ? (
                  <Image
                    src={primaryImageUrl(featuredProperties[safeFeaturedIndex])!}
                    alt={featuredProperties[safeFeaturedIndex].name}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 800px"
                    className="object-cover transition-transform duration-700 hover:scale-105"
                    priority
                  />
                ) : (
                  <div className="absolute inset-0 bg-slate-50 flex items-center justify-center">
                    <div className="absolute inset-0 opacity-[0.04] bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:16px_16px]" />
                    <PropertyTypeIcon type={featuredProperties[safeFeaturedIndex].propertyType} size={52} className="text-slate-300" />
                  </div>
                )}
                {/* Gradient scrim for mobile readability */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent sm:hidden pointer-events-none" />
                {/* Status chip */}
                <div className="absolute bottom-4 left-4">
                  <span className={cn(
                    "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium backdrop-blur-sm",
                    STATUS_CONFIG[featuredProperties[safeFeaturedIndex].status].pill
                  )}>
                    <span className={cn("size-1.5 rounded-full", STATUS_CONFIG[featuredProperties[safeFeaturedIndex].status].dot)} />
                    {STATUS_CONFIG[featuredProperties[safeFeaturedIndex].status].label}
                  </span>
                </div>
              </div>

              {/* ── Info panel ── */}
              <div className="flex-1 flex flex-col px-4 pb-5 pt-4 sm:px-6 sm:pb-6 sm:pt-5 min-w-0 overflow-y-auto">
                {/* Code + carousel nav */}
                <div className="flex items-center justify-between mb-3">
                  <span className="label-caps text-slate-500">
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
                      <span className="label-caps text-slate-600 tabular-nums">{safeFeaturedIndex + 1}&thinsp;/&thinsp;{featuredProperties.length}</span>
                      <button
                        onClick={() => setFeaturedIndex((i) => (i === featuredProperties.length - 1 ? 0 : i + 1))}
                        className="size-7 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                      >
                        <IconChevronRight size={14} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Listing type + name + location */}
                <div className="mb-4">
                  <span className="inline-flex bg-slate-50 border border-slate-200/60 rounded-full px-3 py-0.5 label-caps text-slate-500 mb-2">
                    {LISTING_TYPE_LABEL[featuredProperties[safeFeaturedIndex].listingType as keyof typeof LISTING_TYPE_LABEL]
                      ?? (isSale(featuredProperties[safeFeaturedIndex]) ? "For Sale" : "To Let")}
                  </span>
                  <h4 className="text-xl sm:text-2xl lg:text-3xl font-medium text-slate-900 leading-snug tracking-tight mb-1.5">
                    {featuredProperties[safeFeaturedIndex].name}
                  </h4>
                  <p className="body-sm text-slate-500 flex items-center gap-1.5">
                    <IconMapPin size={14} stroke={1.5} />
                    {featuredProperties[safeFeaturedIndex].location}
                  </p>
                </div>

                {/* Spec chips row */}
                {(featuredProperties[safeFeaturedIndex].bedrooms != null ||
                  featuredProperties[safeFeaturedIndex].bathrooms != null ||
                  featuredProperties[safeFeaturedIndex].sizeSqft != null ||
                  featuredProperties[safeFeaturedIndex].landAreaSqft != null ||
                  featuredProperties[safeFeaturedIndex].parkingSpaces != null) && (
                    <div className="flex items-center gap-2 mb-4 flex-wrap">
                      {featuredProperties[safeFeaturedIndex].bedrooms != null && (
                        <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-100 rounded-xl px-2.5 py-1 text-slate-600">
                          <IconBed size={14} stroke={1.5} className="text-slate-400" />
                          <span className="body-sm font-medium">{featuredProperties[safeFeaturedIndex].bedrooms} beds</span>
                        </div>
                      )}
                      {featuredProperties[safeFeaturedIndex].bathrooms != null && (
                        <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-100 rounded-xl px-2.5 py-1 text-slate-600">
                          <IconRuler size={14} stroke={1.5} className="text-slate-400" />
                          <span className="body-sm font-medium">{featuredProperties[safeFeaturedIndex].bathrooms} baths</span>
                        </div>
                      )}
                      {featuredProperties[safeFeaturedIndex].sizeSqft != null && (
                        <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-100 rounded-xl px-2.5 py-1 text-slate-600">
                          <IconRuler size={14} stroke={1.5} className="text-slate-400" />
                          <span className="body-sm font-medium">{featuredProperties[safeFeaturedIndex].sizeSqft?.toLocaleString()} sqft</span>
                        </div>
                      )}
                      {featuredProperties[safeFeaturedIndex].landAreaSqft != null && (
                        <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-100 rounded-xl px-2.5 py-1 text-slate-600">
                          <IconRuler size={14} stroke={1.5} className="text-slate-400" />
                          <span className="body-sm font-medium">{featuredProperties[safeFeaturedIndex].landAreaSqft?.toLocaleString()} plot sqft</span>
                        </div>
                      )}
                      {featuredProperties[safeFeaturedIndex].parkingSpaces != null && (
                        <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-100 rounded-xl px-2.5 py-1 text-slate-600">
                          <IconBuildingCommunity size={14} stroke={1.5} className="text-slate-400" />
                          <span className="body-sm font-medium">{featuredProperties[safeFeaturedIndex].parkingSpaces} parking</span>
                        </div>
                      )}
                    </div>
                  )}

                {/* ── Individual amenity tags — unique to featured panel ── */}
                {(featuredProperties[safeFeaturedIndex].amenities?.length ?? 0) > 0 && (
                  <div className="mb-4">
                    <p className="label-caps text-slate-400 mb-2">Amenities & Features</p>
                    <div className="flex flex-wrap gap-1.5">
                      {featuredProperties[safeFeaturedIndex].amenities!.map((amenity) => (
                        <span
                          key={amenity}
                          className="inline-flex items-center bg-emerald-50 border border-emerald-100/80 text-emerald-800 rounded-full px-2.5 py-0.5 text-xs font-medium leading-none"
                        >
                          {amenity}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Landlord & Manager mini-cards */}
                <div className="grid grid-cols-2 gap-2.5 sm:gap-4 mb-4">
                  {(featuredProperties[safeFeaturedIndex].owner?.name || featuredProperties[safeFeaturedIndex].ownerName) && (
                    <button
                      type="button"
                      onClick={() => {
                        const contactId = featuredProperties[safeFeaturedIndex].ownerContactId;
                        if (contactId) setOwnerDrawerId(contactId);
                      }}
                      className="flex items-center gap-2.5 bg-slate-50 border border-slate-100 rounded-[16px] px-3 py-2 text-left hover:bg-white hover:border-slate-200 transition-colors shadow-sm min-w-0"
                    >
                      <span className="size-8 rounded-full bg-[#151936] text-[#f3df27] flex items-center justify-center text-xs font-medium shrink-0">
                        {ownerInitials(featuredProperties[safeFeaturedIndex])}
                      </span>
                      <span className="min-w-0">
                        <span className="block body-sm text-slate-900 truncate">
                          {featuredProperties[safeFeaturedIndex].owner?.name || featuredProperties[safeFeaturedIndex].ownerName}
                        </span>
                        <span className="block label-caps text-slate-400">Landlord</span>
                      </span>
                    </button>
                  )}
                  {/* Property Manager Card */}
                  {featuredProperties[safeFeaturedIndex].manager?.name ? (
                    <button
                      type="button"
                      onClick={() => {
                        const managerId = featuredProperties[safeFeaturedIndex].manager?.id;
                        if (managerId) setManagerDrawerId(managerId);
                      }}
                      className="flex items-center gap-2.5 bg-slate-50 border border-slate-100 rounded-[16px] px-3 py-2 text-left hover:bg-white hover:border-slate-200 transition-colors shadow-sm min-w-0"
                    >
                      <span className="size-8 rounded-full bg-emerald-700 text-white flex items-center justify-center text-xs font-medium shrink-0">
                        {managerInitials(featuredProperties[safeFeaturedIndex].manager?.name)}
                      </span>
                      <span className="min-w-0">
                        <span className="block body-sm text-slate-900 truncate">
                          {featuredProperties[safeFeaturedIndex].manager?.name}
                        </span>
                        <span className="block label-caps text-slate-400">Property Manager</span>
                      </span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-2.5 bg-slate-50 border border-dashed border-slate-200 rounded-[16px] px-3 py-2 min-w-0">
                      <span className="size-8 rounded-full bg-slate-100 text-slate-300 flex items-center justify-center shrink-0">
                        <IconUsers size={14} />
                      </span>
                      <span className="min-w-0">
                        <span className="block body-sm text-slate-400 truncate">Unassigned</span>
                        <span className="block label-caps text-slate-300">Property Manager</span>
                      </span>
                    </div>
                  )}
                </div>

                {/* Price + CTA */}
                <div className="mt-auto pt-4 border-t border-slate-100 flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <p className="label-caps text-slate-400 mb-1">{featuredPriceDisplay(featuredProperties[safeFeaturedIndex]).label}</p>
                    <p className="font-mono text-slate-900 text-2xl sm:text-3xl font-medium tracking-tight leading-none">
                      {featuredPriceDisplay(featuredProperties[safeFeaturedIndex]).value}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setDrawerProperty(featuredProperties[safeFeaturedIndex])}
                      className="rounded-xl"
                    >
                      Quick View
                    </Button>
                    <a
                      href={`/admin/properties/${featuredProperties[safeFeaturedIndex].id}`}
                      className="inline-flex items-center justify-center bg-[#151936] text-white hover:bg-[#151936]/90 transition-colors px-4 sm:px-6 py-2 rounded-xl shadow-sm body-sm font-medium whitespace-nowrap"
                    >
                      <IconEye size={15} className="mr-1.5" /> View
                    </a>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-14 text-center text-slate-400 flex-1">
              <div className="size-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center mb-3">
                <IconStar size={24} className="opacity-40" />
              </div>
              <p className="body-sm text-slate-400">No featured listings currently.</p>
              <p className="label-caps text-slate-300 mt-1">Star a property to feature it here.</p>
            </div>
          )}
        </div>

        {/* Portfolio Mix - fully driven by STATUS_CONFIG + type breakdown */}
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
                placeholder="Search name, code, location, owner…"
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
                  statusFilter === "all" ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-700"
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
                      : "text-slate-400 hover:text-slate-700"
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
            <div className="hidden sm:flex bg-slate-100 p-1 rounded-xl gap-0.5 shrink-0 sm:ml-auto" role="group" aria-label="View mode">
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                aria-label="Grid view"
                aria-pressed={viewMode === "grid"}
                className={cn(
                  "size-8 rounded-lg flex items-center justify-center transition-colors",
                  viewMode === "grid" ? "bg-[#151936] text-white" : "text-slate-400 hover:text-slate-800"
                )}
              >
                <IconLayoutGrid size={15} />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("list")}
                aria-label="List view"
                aria-pressed={viewMode === "list"}
                className={cn(
                  "size-8 rounded-lg flex items-center justify-center transition-colors",
                  viewMode === "list" ? "bg-[#151936] text-white" : "text-slate-400 hover:text-slate-800"
                )}
              >
                <IconList size={15} />
              </button>
            </div>
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
                  className="inline-flex items-center gap-1 px-3 py-1.5 body-sm text-slate-400 hover:text-rose-600 transition-colors"
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
            {/* Mobile/Tablet: single-column stacked cards - matches the mobile decard pattern used by every other board's table (maintenance/valuations) */}
            <div className="flex flex-col gap-4 lg:hidden">
              {visible.map((p) => (
                <PropertyGridCard
                  key={p.id}
                  property={p}
                  canManage={canManage}
                  onOpen={() => setDrawerProperty(p)}
                  onOwnerClick={() => p.ownerContactId && setOwnerDrawerId(p.ownerContactId)}
                  onManagerClick={() => p.manager?.id && setManagerDrawerId(p.manager.id)}
                  onToggleFeature={() => handleToggleFeature(p.id, !!p.isFeatured)}
                />
              ))}
            </div>

            {/* Desktop: obeys the grid/list toggle */}
            {viewMode === "grid" ? (
              <div className="hidden lg:grid lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {visible.map((p) => (
                  <PropertyGridCard
                    key={p.id}
                    property={p}
                    canManage={canManage}
                    onOpen={() => setDrawerProperty(p)}
                    onOwnerClick={() => p.ownerContactId && setOwnerDrawerId(p.ownerContactId)}
                    onManagerClick={() => p.manager?.id && setManagerDrawerId(p.manager.id)}
                    onToggleFeature={() => handleToggleFeature(p.id, !!p.isFeatured)}
                  />
                ))}
              </div>
            ) : (
              <div className="hidden lg:block overflow-x-auto custom-scrollbar pb-2 -mx-8 px-8">
                <table className="w-full min-w-[900px] text-left border-separate border-spacing-0">
                  <thead>
                    <tr className="label-caps text-slate-400">
                      {/* Featured */}
                      <th className="pl-0 pr-2 py-3 w-9" />
                      {/* Thumbnail + Name */}
                      <th
                        className="px-3 py-3 cursor-pointer hover:text-slate-700 transition-colors group"
                        onClick={() => requestSort("name")}
                      >
                        <div className="flex items-center gap-1.5">
                          Property
                          {sortConfig?.key === "name" ? (
                            sortConfig.direction === "asc" ? <IconSortAscending size={13} /> : <IconSortDescending size={13} />
                          ) : (
                            <IconArrowsSort size={13} className="opacity-0 group-hover:opacity-60" />
                          )}
                        </div>
                      </th>
                      {/* Type */}
                      <th className="px-3 py-3 hidden xl:table-cell">Type</th>
                      {/* Specs */}
                      <th className="px-3 py-3 hidden xl:table-cell">Specs</th>
                      {/* Location */}
                      <th className="px-3 py-3">Location</th>
                      {/* Price */}
                      <th
                        className="px-3 py-3 text-right cursor-pointer hover:text-slate-700 transition-colors group"
                        onClick={() => requestSort("monthlyRentKes")}
                      >
                        <div className="flex items-center justify-end gap-1.5">
                          Price
                          {sortConfig?.key === "monthlyRentKes" ? (
                            sortConfig.direction === "asc" ? <IconSortAscending size={13} /> : <IconSortDescending size={13} />
                          ) : (
                            <IconArrowsSort size={13} className="opacity-0 group-hover:opacity-60" />
                          )}
                        </div>
                      </th>
                      {/* Mandate */}
                      <th className="px-3 py-3 text-center">Mandate</th>
                      {/* Status */}
                      <th className="px-3 py-3 text-center">Status</th>
                      {/* Actions */}
                      {canManage && <th className="px-3 py-3 text-right w-12" />}
                    </tr>
                    {/* Thin divider under header */}
                    <tr aria-hidden="true">
                      <td colSpan={canManage ? 9 : 8} className="p-0">
                        <div className="h-px bg-slate-100" />
                      </td>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((p, rowIdx) => {
                      const rowSpecs: { icon: React.ElementType; value: string }[] = [];
                      const unitTotal = p.unitBreakdown?.reduce((s, u) => s + u.count, 0);
                      if (unitTotal) rowSpecs.push({ icon: IconBuildingCommunity, value: `${unitTotal} units` });
                      if (p.bedrooms != null) rowSpecs.push({ icon: IconBed, value: `${p.bedrooms} bd` });
                      if (p.sizeSqft != null) rowSpecs.push({ icon: IconRuler, value: `${p.sizeSqft.toLocaleString()} sqft` });
                      if (p.landAreaSqft != null) rowSpecs.push({ icon: IconRuler, value: `${(p.landAreaSqft / 43560).toFixed(2)} ac` });

                      const priceVal = isSale(p)
                        ? p.askingPriceKes ? formatCompactKES(parseFloat(p.askingPriceKes)) : "—"
                        : p.monthlyRentKes ? formatCompactKES(parseFloat(p.monthlyRentKes)) : "—";
                      const priceLabel = isSale(p) ? "Asking" : "/mo";

                      return (
                        <tr
                          key={p.id}
                          className={cn(
                            "group cursor-pointer transition-all duration-150",
                            rowIdx % 2 === 0 ? "bg-white" : "bg-slate-50/40",
                            "hover:bg-slate-50 hover:shadow-[inset_3px_0_0_0_#151936]"
                          )}
                          onClick={() => setDrawerProperty(p)}
                        >
                          {/* Star */}
                          <td className="pl-0 pr-2 py-3.5 w-9" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              disabled={!canManage}
                              onClick={() => handleToggleFeature(p.id, !!p.isFeatured)}
                              aria-label={p.isFeatured ? "Remove from featured" : "Add to featured"}
                              aria-pressed={!!p.isFeatured}
                              className={cn(
                                "flex size-7 items-center justify-center rounded-lg transition-all",
                                p.isFeatured
                                  ? "text-amber-400"
                                  : "text-slate-200 opacity-0 group-hover:opacity-100 hover:text-amber-400",
                                !canManage && "cursor-default"
                              )}
                            >
                              {p.isFeatured ? <IconStarFilled size={15} /> : <IconStar size={15} />}
                            </button>
                          </td>

                          {/* Property: thumbnail + name + owner */}
                          <td className="px-3 py-3.5 min-w-[220px]">
                            <div className="flex items-center gap-3">
                              <div className="relative size-11 shrink-0 rounded-xl overflow-hidden bg-slate-100 border border-slate-100">
                                {primaryImageUrl(p) ? (
                                  <Image src={primaryImageUrl(p)!} alt={p.name} fill sizes="44px" className="object-cover" />
                                ) : (
                                  <div className="absolute inset-0 flex items-center justify-center">
                                    <PropertyTypeIcon type={p.propertyType} size={20} className="text-slate-300" />
                                  </div>
                                )}
                              </div>
                              <div className="flex flex-col min-w-0">
                                <span className="body-sm text-slate-900 truncate leading-snug">{p.name}</span>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className="mono-data text-slate-300 text-xs">{p.propertyCode}</span>
                                  {(p.owner?.name || p.ownerName) && (
                                    <>
                                      <span className="text-slate-200">·</span>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (p.ownerContactId) setOwnerDrawerId(p.ownerContactId);
                                        }}
                                        className="text-xs text-slate-400 hover:text-[#151936] hover:underline truncate max-w-[120px]"
                                      >
                                        {p.owner?.name || p.ownerName}
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Type + listing */}
                          <td className="px-3 py-3.5 hidden xl:table-cell">
                            <div className="flex items-center gap-2">
                              <div className="size-7 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                                <PropertyTypeIcon type={p.propertyType} size={14} />
                              </div>
                              <div>
                                <p className="text-xs text-slate-700 leading-none">{p.propertyType}</p>
                                <p className={cn("label-caps mt-0.5", isSale(p) ? "text-indigo-400" : "text-slate-400")}>
                                  {LISTING_TYPE_LABEL[p.listingType as keyof typeof LISTING_TYPE_LABEL] ?? (isSale(p) ? "For Sale" : "To Let")}
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* Specs */}
                          <td className="px-3 py-3.5 hidden xl:table-cell">
                            {rowSpecs.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {rowSpecs.slice(0, 2).map((s, i) => (
                                  <span key={i} className="inline-flex items-center gap-1 bg-slate-50 border border-slate-100 rounded-md px-1.5 py-0.5 label-caps text-slate-400">
                                    <s.icon size={10} stroke={2} />
                                    {s.value}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-slate-200 text-sm">-</span>
                            )}
                          </td>

                          {/* Location + amenities */}
                          <td className="px-3 py-3.5 min-w-[140px]">
                            <p className="text-xs text-slate-600 leading-none">{p.location}</p>
                            {(p.amenities?.length ?? 0) > 0 && (
                              <span className="inline-flex items-center gap-1 mt-1 text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded-md label-caps">
                                +{p.amenities?.length} amenities
                              </span>
                            )}
                          </td>

                          {/* Price */}
                          <td className="px-3 py-3.5 text-right">
                            <p className="mono-amount text-slate-900 text-sm leading-none">{priceVal}</p>
                            <p className="label-caps text-slate-300 mt-0.5 text-right">{priceLabel}</p>
                          </td>

                          {/* Mandate + manager */}
                          <td className="px-3 py-3.5 text-center">
                            {p.mandateStatus ? (
                              <div className="flex flex-col items-center gap-1">
                                <span className={cn(
                                  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium text-slate-900",
                                  MANDATE_STATUS_CONFIG[p.mandateStatus].pill
                                )}>
                                  <span className={cn("size-1.5 rounded-full shrink-0", MANDATE_STATUS_CONFIG[p.mandateStatus].dot)} />
                                  {MANDATE_STATUS_CONFIG[p.mandateStatus].label}
                                </span>
                                {p.manager?.name ? (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (p.manager?.id) setManagerDrawerId(p.manager.id);
                                    }}
                                    className="text-xs text-slate-400 hover:text-[#151936] hover:underline truncate max-w-[110px]"
                                  >
                                    {p.manager.name}
                                  </button>
                                ) : (
                                  <span className="text-xs text-slate-200">Unassigned</span>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-200 text-sm">-</span>
                            )}
                          </td>

                          {/* Status */}
                          <td className="px-3 py-3.5 text-center">
                            <StatusPill status={p.status} />
                          </td>

                          {/* Actions */}
                          {canManage && (
                            <td className="px-3 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                              <DropdownMenu
                                label="Row Actions"
                                trigger={
                                  <div
                                    className="inline-flex p-1.5 rounded-lg text-slate-300 hover:bg-slate-100 hover:text-slate-900 transition-all opacity-0 group-hover:opacity-100"
                                    aria-label="Row actions"
                                  >
                                    <IconDotsVertical size={15} />
                                  </div>
                                }
                                align="right"
                              >
                                <DropdownItem icon={IconEye} onClick={() => setDrawerProperty(p)}>
                                  Quick View
                                </DropdownItem>
                                <DropdownItem icon={IconEdit} onClick={() => setEditingProperty(p)}>
                                  Edit Property
                                </DropdownItem>
                                <DropdownItem
                                  icon={p.isFeatured ? IconStarFilled : IconStar}
                                  onClick={() => handleToggleFeature(p.id, !!p.isFeatured)}
                                >
                                  {p.isFeatured ? "Remove from Featured" : "Add to Featured"}
                                </DropdownItem>
                                <DropdownItem icon={IconTrash} variant="danger" onClick={() => setDeleteConfirmId(p.id)}>
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
            )}

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

      <PropertyOwnerProfileDrawer
        open={!!ownerDrawerId}
        onClose={() => setOwnerDrawerId(null)}
        entityId={entityId}
        ownerContactId={ownerDrawerId}
        properties={properties}
        onOpenProperty={(p) => setDrawerProperty(p)}
      />

      <PropertyManagerProfileDrawer
        open={!!managerDrawerId}
        onClose={() => setManagerDrawerId(null)}
        entityId={entityId}
        managerId={managerDrawerId}
        properties={properties}
        onOpenProperty={(p) => setDrawerProperty(p)}
      />
    </PageTransition>
  );
}
