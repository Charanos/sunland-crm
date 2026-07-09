"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  IconChartPie,
  IconMapPin
} from "@tabler/icons-react";
import Link from "next/link";
import {
  Badge,
  BoardHeader,
  Button,
  PaginationControls,
  ConfirmDialog,
  DropdownMenu,
  DropdownItem
} from "@/components/ui/erp-primitives";
import { PropertyFormModal } from "./property-form-modal";
import { PropertyDetailDrawer } from "./property-detail-drawer";
import { EmptyState } from "@/components/ui/empty-state";
import { PageTransition } from "@/components/shared/page-transition";
import { formatCompactKES } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { useToast } from "@/components/ui/toast-provider";

type Property = {
  id: string;
  propertyCode: string;
  name: string;
  propertyType: string;
  listingType: string;
  status: "available" | "occupied" | "under_offer" | "off_market" | "maintenance";
  location: string;
  ownerContactId: string | null;
  askingPriceKes: string | null;
  monthlyRentKes: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  sizeSqft: number | null;
  isFeatured: boolean;
};

type SortConfig = {
  key: keyof Property;
  direction: "asc" | "desc";
} | null;

export function PropertiesBoard({ entityId }: { entityId: string }) {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [sortConfig, setSortConfig] = useState<SortConfig>(null);
  const [filterStatus, setFilterStatus] = useState<string>("All");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);

  const [editProperty, setEditProperty] = useState<Property | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [featuredIndex, setFeaturedIndex] = useState(0);

  const { pushToast } = useToast();
  const rowsPerPage = 8;

  const loadProperties = useCallback(async () => {
    Promise.resolve().then(() => setLoading(true));
    try {
      const res = await fetch(`/api/properties?entityId=${entityId}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setProperties(data.properties ?? []);
    } catch (err) {
      console.error("Failed to load properties:", err);
    } finally {
      setLoading(false);
    }
  }, [entityId]);

  useEffect(() => {
    let active = true;
    if (entityId) {
      const fetchInitial = async () => {
        if (active) await loadProperties();
      };
      fetchInitial();
    }
    return () => {
      active = false;
    };
  }, [entityId, loadProperties]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return properties.filter((p) => {
      const matchStatus = filterStatus === "All" || p.status.replace(/_/g, " ") === filterStatus.toLowerCase();
      const matchSearch = !q || [p.name, p.propertyCode, p.location, p.propertyType].some((v) =>
        v?.toLowerCase().includes(q)
      );
      return matchStatus && matchSearch;
    });
  }, [properties, query, filterStatus]);

  const sorted = useMemo(() => {
    const sortable = [...filtered];
    if (sortConfig !== null) {
      sortable.sort((a, b) => {
        const aValue = a[sortConfig.key] ?? "";
        const bValue = b[sortConfig.key] ?? "";

        if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }
    return sortable;
  }, [filtered, sortConfig]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / rowsPerPage));
  const visible = sorted.slice((page - 1) * rowsPerPage, page * rowsPerPage);

  const requestSort = (key: keyof Property) => {
    let direction: "asc" | "desc" = "asc";
    if (sortConfig && sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const kpis = useMemo(() => {
    const total = properties.length;
    const occupied = properties.filter((p) => p.status === "occupied").length;
    const rate = total > 0 ? (occupied / total) * 100 : 0;
    const rentPool = properties
      .filter((p) => p.monthlyRentKes)
      .reduce((sum, p) => sum + parseFloat(p.monthlyRentKes!), 0);

    return { total, occupied, rate, rentPool };
  }, [properties]);

  const featuredProperties = useMemo(() => {
    return properties
      .filter((p) => p.status === "available" && p.isFeatured)
      .sort((a, b) => parseFloat(b.askingPriceKes || "0") - parseFloat(a.askingPriceKes || "0"));
  }, [properties]);

  const handleDelete = async () => {
    if (!deleteConfirmId) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/properties?id=${deleteConfirmId}&entityId=${entityId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete property");

      const name = properties.find((p) => p.id === deleteConfirmId)?.name;
      pushToast({ tone: "success", title: "Property Deleted", body: `${name} was successfully removed.` });
      loadProperties();
    } catch (err) {
      console.error(err);
      pushToast({ tone: "warning", title: "Deletion Failed", body: "Could not remove the property." });
    } finally {
      setIsDeleting(false);
      setDeleteConfirmId(null);
    }
  };

  const handleToggleFeature = async (id: string, currentlyFeatured: boolean) => {
    try {
      const res = await fetch(`/api/properties?id=${id}&entityId=${entityId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityId, isFeatured: !currentlyFeatured }),
      });
      if (!res.ok) throw new Error("Failed to update feature status");
      
      loadProperties();
      pushToast({ tone: "success", title: "Property Updated", body: `Property is ${!currentlyFeatured ? 'now featured' : 'no longer featured'}.` });
    } catch (err) {
      console.error(err);
      pushToast({ tone: "warning", title: "Update Failed", body: "Could not change the featured status." });
    }
  };

  return (
    <PageTransition className="mx-auto flex max-w-[98rem] flex-col gap-5">
      <BoardHeader
        eyebrow={<Badge tone="primary">Estate Portfolio</Badge>}
        title="Properties & Inventory"
        description="Track managed residential and commercial properties, tenant occupancy states, and owner portfolios."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={loadProperties}>
              <IconRefresh size={14} /> Refresh
            </Button>
            <Button size="sm" onClick={() => { setEditProperty(null); setIsModalOpen(true); }}>
              <IconPlus size={14} /> Register Property
            </Button>
          </div>
        }
      />

      {/* ── Portfolio Control Hub Navigator ── */}
      <div className="flex items-center justify-between flex-wrap gap-4 bg-white border border-slate-100 p-4 rounded-[20px] shadow-sm">
        <div className="flex items-center gap-2">
          <div className="size-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
            <IconBuildingCommunity size={16} />
          </div>
          <div>
            <h3 className="text-title-primary">Portfolio Control Hub</h3>
            <p className="body-sm text-slate-400 mt-1">Navigate across property inventory and advisory segments.</p>
          </div>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-xl flex-wrap gap-1">
          <Link
            href="/admin/properties"
            className="body-sm px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 bg-[#151936] text-white shadow-sm"
          >
            <span>Properties</span>
            <span className="bg-[#f3df27] text-[#151936] px-1.5 py-0.2 rounded-full text-meta-muted-strong">Inventory</span>
          </Link>
          <Link
            href="/admin/valuations"
            className="body-sm px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 text-slate-500 hover:text-slate-900 hover:bg-white/45"
          >
            <span>Valuations</span>
          </Link>
        </div>
      </div>

      <div className="flex items-center gap-4 mt-2">
        <hr className="flex-1 border-slate-200/60" />
        <span className="label-caps text-slate-400 tracking-wider">Analytics & Command</span>
        <hr className="flex-1 border-slate-200/60" />
      </div>

      {/* ── Dense, High-Contrast Dark KPI Tier ── */}
      <div className="bg-tertiary-gradient border border-[#122a20]/80 p-1.5 rounded-[24px] shadow-xl relative overflow-hidden group">
        <div className="absolute right-0 top-0 size-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-emerald-500/20 transition-colors duration-700 -z-10" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-white/10">

          <div className="p-5 sm:p-6 flex flex-col justify-between">
            <div className="flex items-center gap-3 mb-4">
              <div className="size-8 rounded-xl bg-white/5 flex items-center justify-center text-slate-300 border border-white/10 shadow-sm">
                <IconBuildingCommunity size={16} />
              </div>
              <span className="body-sm text-slate-400">Total Units</span>
            </div>
            <div>
              <span className="mono-stat text-white text-[32px] leading-none tracking-tight">{kpis.total}</span>
            </div>
          </div>

          <div className="p-5 sm:p-6 flex flex-col justify-between">
            <div className="flex items-center gap-3 mb-4">
              <div className="size-8 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 border border-emerald-500/20 shadow-sm">
                <IconCheck size={16} />
              </div>
              <span className="body-sm text-slate-400">Occupied Units</span>
            </div>
            <div>
              <span className="mono-stat text-white text-[32px] leading-none tracking-tight">{kpis.occupied}</span>
            </div>
          </div>

          <div className="p-5 sm:p-6 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="size-8 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 border border-amber-500/20 shadow-sm">
                  <IconTrendingUp size={16} />
                </div>
                <span className="body-sm text-slate-400">Occupancy Rate</span>
              </div>
              <span className="mono-stat text-white text-lg">{kpis.rate.toFixed(1)}%</span>
            </div>
            <div className="mt-auto h-2 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-amber-400 transition-all duration-1000"
                style={{ width: `${Math.max(0, Math.min(kpis.rate, 100))}%` }}
              />
            </div>
          </div>

          <div className="p-5 sm:p-6 flex flex-col justify-between">
            <div className="flex items-center gap-3 mb-4">
              <div className="size-8 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 border border-indigo-500/20 shadow-sm">
                <IconClock size={16} />
              </div>
              <span className="body-sm text-slate-400">Monthly Rent Pool</span>
            </div>
            <div>
              <span className="mono-stat text-white text-[32px] leading-none tracking-tight">{formatCompactKES(kpis.rentPool)}</span>
            </div>
          </div>

        </div>
      </div>



      {/* ── Market Highlights Tier ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Featured Properties Carousel */}
        <div className="lg:col-span-2 bg-white border border-slate-100 rounded-[24px] shadow-sm p-6 flex flex-col relative overflow-hidden">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-title-primary flex items-center gap-2">
              <IconStar size={18} className="text-amber-400" /> Featured Listings
            </h3>
            {featuredProperties.length > 1 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setFeaturedIndex((i) => (i === 0 ? featuredProperties.length - 1 : i - 1))}
                  className="size-7 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-900 transition-colors"
                >
                  <IconChevronLeft size={14} />
                </button>
                <span className="text-xs font-medium text-slate-400">{featuredIndex + 1} / {featuredProperties.length}</span>
                <button
                  onClick={() => setFeaturedIndex((i) => (i === featuredProperties.length - 1 ? 0 : i + 1))}
                  className="size-7 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-900 transition-colors"
                >
                  <IconChevronRight size={14} />
                </button>
              </div>
            )}
          </div>

          {featuredProperties.length > 0 ? (
            <div className="flex items-center gap-6 animate-fade-in-up" key={featuredIndex}>
              <div className="w-1/3 aspect-[4/3] rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden relative">
                {/* Fallback pattern for featured image */}
                <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:16px_16px]"></div>
                <IconBuildingCommunity size={48} className="text-slate-300" stroke={1} />
              </div>
              <div className="flex-1 space-y-3">
                <div>
                  <Badge tone="success" className="mb-2">Available Now</Badge>
                  <h4 className="text-xl font-medium text-slate-900">{featuredProperties[featuredIndex].name}</h4>
                  <p className="body-sm text-slate-500 flex items-center gap-1.5 mt-1">
                    <IconMapPin size={14} /> {featuredProperties[featuredIndex].location}
                  </p>
                </div>
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <div>
                    <p className="label-caps text-slate-400 mb-1">Asking Price</p>
                    <p className="mono-stat text-slate-900 text-2xl tracking-tight">
                      {formatCompactKES(parseFloat(featuredProperties[featuredIndex].askingPriceKes!))}
                    </p>
                  </div>
                  <Button size="sm" onClick={() => setSelectedProperty(featuredProperties[featuredIndex])}>View Details</Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center text-slate-400">
              <IconStar size={32} className="mb-2 opacity-50" />
              <p className="body-sm">No featured listings currently available.</p>
            </div>
          )}
        </div>

        {/* Portfolio Distribution CSS Chart */}
        <div className="bg-white border border-slate-100 rounded-[24px] shadow-sm p-6 flex flex-col">
          <h3 className="text-title-primary flex items-center gap-2 mb-6">
            <IconChartPie size={18} className="text-indigo-400" /> Portfolio Mix
          </h3>
          <div className="flex-1 flex flex-col justify-center">
            <div className="w-full flex h-8 rounded-full overflow-hidden gap-0.5">
              <div className="bg-emerald-500 h-full transition-all duration-1000" style={{ width: `${Math.max(10, kpis.rate)}%` }} />
              <div className="bg-amber-400 h-full transition-all duration-1000" style={{ width: `${Math.max(10, properties.filter(p => p.status === 'under_offer').length / Math.max(1, properties.length) * 100)}%` }} />
              <div className="bg-slate-200 h-full flex-1 transition-all duration-1000" />
            </div>
            <div className="mt-6 space-y-3">
              <div className="flex items-center justify-between body-sm">
                <div className="flex items-center gap-2"><div className="size-2.5 rounded-full bg-emerald-500"></div><span className="text-slate-600">Occupied</span></div>
                <span className="mono-stat text-slate-900">{kpis.occupied}</span>
              </div>
              <div className="flex items-center justify-between body-sm">
                <div className="flex items-center gap-2"><div className="size-2.5 rounded-full bg-amber-400"></div><span className="text-slate-600">Under Offer</span></div>
                <span className="mono-stat text-slate-900">{properties.filter(p => p.status === 'under_offer').length}</span>
              </div>
              <div className="flex items-center justify-between body-sm">
                <div className="flex items-center gap-2"><div className="size-2.5 rounded-full bg-slate-200"></div><span className="text-slate-600">Available</span></div>
                <span className="mono-stat text-slate-900">{properties.filter(p => p.status === 'available').length}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 mt-4">
        <hr className="flex-1 border-slate-200/60" />
        <span className="label-caps text-slate-400 tracking-wider">Inventory Data</span>
        <hr className="flex-1 border-slate-200/60" />
      </div>

      {/* ── Data Tier: Properties Board ── */}
      <div className="bg-white border border-slate-100 p-6 sm:p-8 rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-5 mb-5">
          <div className="flex-1 min-w-[250px] max-w-md">
            <div className="relative flex items-center group">
              <IconSearch size={16} className="absolute left-3.5 text-slate-400 group-focus-within:text-[#151936] transition-colors" />
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="Search properties by name, code, or location…"
                className="w-full bg-slate-50 border border-slate-200/60 rounded-xl pl-10 pr-4 py-2.5 body-sm text-slate-900 outline-none placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-[#151936]/10 focus:border-[#151936]/30 transition-all shadow-sm"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex bg-slate-100 p-1 rounded-xl">
              {["All", "Available", "Occupied", "Under Offer"].map((status) => (
                <button
                  key={status}
                  onClick={() => {
                    setFilterStatus(status);
                    setPage(1);
                  }}
                  className={cn(
                    "px-3 py-1.5 body-sm font-medium rounded-lg transition-colors",
                    filterStatus === status ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                  )}
                >
                  {status}
                </button>
              ))}
            </div>
            <button className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 body-sm rounded-xl transition-colors border border-slate-200/60 shadow-sm hidden sm:flex">
              <IconFilter size={16} className="text-slate-400" /> Advanced
            </button>
          </div>
        </div>

        {loading ? (
          <div className="space-y-4 py-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 py-3 border-b border-slate-50">
                <div className="h-5 w-20 bg-slate-100 animate-pulse rounded"></div>
                <div className="h-5 w-48 bg-slate-100 animate-pulse rounded"></div>
                <div className="h-5 w-24 bg-slate-100 animate-pulse rounded"></div>
                <div className="h-5 w-32 bg-slate-100 animate-pulse rounded"></div>
                <div className="h-5 w-24 bg-slate-100 animate-pulse rounded ml-auto"></div>
              </div>
            ))}
          </div>
        ) : properties.length === 0 ? (
          <div className="py-12">
            <EmptyState
              icon={IconBuildingCommunity}
              title="No properties registered"
              description="Register the first property unit in the portfolio. Ensure you have onboarded the landlord contact beforehand."
              action="Register Property"
              onClick={() => { setEditProperty(null); setIsModalOpen(true); }}
            />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="overflow-x-auto custom-scrollbar pb-2">
              <table className="w-full min-w-[850px] text-left">
                <thead>
                  <tr className="border-b border-slate-100 label-caps text-slate-500 bg-slate-50/50">
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
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Location</th>
                    <th
                      className="px-4 py-3 text-right cursor-pointer hover:text-slate-800 transition-colors group"
                      onClick={() => requestSort("monthlyRentKes")}
                    >
                      <div className="flex items-center justify-end gap-1.5">
                        Rent rate
                        {sortConfig?.key === "monthlyRentKes" ? (
                          sortConfig.direction === "asc" ? <IconSortAscending size={14} /> : <IconSortDescending size={14} />
                        ) : (
                          <IconArrowsSort size={14} className="opacity-0 group-hover:opacity-100 text-slate-400" />
                        )}
                      </div>
                    </th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visible.map((p) => (
                    <tr
                      key={p.id}
                      className="transition-colors hover:bg-slate-50/80 group cursor-pointer"
                      onClick={() => setSelectedProperty(p)}
                    >
                      <td className="px-4 py-4 mono-data text-slate-500 group-hover:text-slate-900 transition-colors">{p.propertyCode}</td>
                      <td className="px-4 py-4 text-title-primary">{p.name}</td>
                      <td className="px-4 py-4 body-sm text-slate-600">{p.propertyType}</td>
                      <td className="px-4 py-4 body-sm text-slate-600">{p.location}</td>
                      <td className="px-4 py-4 text-right mono-amount text-slate-900">
                        {p.monthlyRentKes ? formatCompactKES(parseFloat(p.monthlyRentKes)) : "—"}
                      </td>
                      <td className="px-4 py-4 text-center">
                        <Badge tone={p.status === "occupied" ? "success" : p.status === "maintenance" ? "warning" : "neutral"}>
                          {p.status.replace(/_/g, " ")}
                        </Badge>
                      </td>
                      <td className="px-4 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu
                          label="Row Actions"
                          trigger={
                            <button
                              className="p-1.5 rounded-md text-slate-400 hover:bg-white hover:shadow-sm hover:text-slate-900 transition-all border border-transparent hover:border-slate-200"
                              aria-label="Row actions"
                            >
                              <IconDotsVertical size={16} />
                            </button>
                          }
                          align="right"
                        >
                          <DropdownItem
                            onClick={() => {
                              setEditProperty(p);
                              setIsModalOpen(true);
                            }}
                          >
                            Edit Property
                          </DropdownItem>
                          <DropdownItem
                            onClick={() => handleToggleFeature(p.id, p.isFeatured)}
                          >
                            {p.isFeatured ? "Unfeature Property" : "Feature Property"}
                          </DropdownItem>
                          <DropdownItem
                            onClick={() => {
                              setDeleteConfirmId(p.id);
                            }}
                          >
                            Delete
                          </DropdownItem>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="border-t border-slate-100 pt-5">
              <PaginationControls
                currentPage={page}
                totalPages={totalPages}
                onPageChange={setPage}
                label={`${filtered.length} property records`}
              />
            </div>
          </div>
        )}
      </div>

      {isModalOpen && (
        <PropertyFormModal
          open={isModalOpen}
          initialData={editProperty}
          mode={editProperty ? "edit" : "create"}
          onClose={() => { setIsModalOpen(false); setEditProperty(null); }}
          onSubmit={() => {
            setIsModalOpen(false);
            setEditProperty(null);
            loadProperties();
          }}
        />
      )}

      {selectedProperty && (
        <PropertyDetailDrawer
          open={!!selectedProperty}
          property={{
            id: selectedProperty.id,
            name: selectedProperty.name,
            location: selectedProperty.location,
            type: selectedProperty.propertyType,
            status: selectedProperty.status === "occupied" ? "Occupied" :
              selectedProperty.status === "under_offer" ? "Under Offer" :
                "Available",
            roi: "8.5%", // Hardcoded as per mock data
            price: selectedProperty.askingPriceKes ? formatCompactKES(parseFloat(selectedProperty.askingPriceKes)) : "N/A",
            imageUrl: null,
          }}
          onClose={() => setSelectedProperty(null)}
          onEdit={(id) => {
            setSelectedProperty(null);
            setEditProperty(properties.find(p => p.id === id) || null);
            setIsModalOpen(true);
          }}
          onDelete={(id) => {
            setSelectedProperty(null);
            setDeleteConfirmId(id);
          }}
        />
      )}

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
