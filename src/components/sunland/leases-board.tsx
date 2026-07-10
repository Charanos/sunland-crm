"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  IconCalendar,
  IconCheck,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconShield,
  IconBuildingCommunity,
  IconX,
  IconStarFilled,
  IconChevronLeft,
  IconChevronRight,
  IconEye,
  IconTrendingUp,
  IconClock,
} from "@tabler/icons-react";
import Link from "next/link";
import {
  Badge,
  BoardHeader,
  BoardPanel,
  Button,
  PaginationControls,
} from "@/components/ui/erp-primitives";
import { LeaseFormModal } from "./lease-form-modal";
import { LeaseDetailDrawer } from "./lease-detail-drawer";
import { EmptyState } from "@/components/ui/empty-state";
import { PageTransition } from "@/components/shared/page-transition";
import { formatCompactKES } from "@/lib/utils/format";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { cn } from "@/lib/utils/cn";
import { useToast } from "@/components/ui/toast-provider";
import { PROPERTY_TYPE_ICON } from "./property-constants";

interface Lease {
  id: string;
  startsAt: string;
  endsAt: string;
  monthlyRentKes: string;
  depositKes: string | null;
  isActive: boolean;
  propertyId: string;
  tenantContactId: string;
  propertyName: string;
  propertyCode: string;
  propertyType: string;
  tenantName: string;
  tenantEmail: string | null;
  tenantPhone: string | null;
}

export function LeasesBoard({ entityId }: { entityId: string }) {
  const { pushToast } = useToast();
  const [leases, setLeases] = useState<Lease[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "terminated">("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [drawerLease, setDrawerLease] = useState<Lease | null>(null);
  
  // Carousel state
  const [featuredIndex, setFeaturedIndex] = useState(0);

  const rowsPerPage = 8;

  const loadLeases = useCallback(async () => {
    try {
      const res = await fetch(`/api/leases?entityId=${entityId}`);
      const data = await res.json();
      setLeases(data.leases ?? []);
    } catch (err) {
      console.error("Failed to load leases:", err);
      pushToast({
        tone: "warning",
        title: "Load Failed",
        body: "Could not retrieve lease agreements.",
      });
    } finally {
      setLoading(false);
    }
  }, [entityId, pushToast]);

  useEffect(() => {
    if (!entityId) return;
    const timer = setTimeout(() => {
      loadLeases();
    }, 0);
    return () => clearTimeout(timer);
  }, [entityId, loadLeases]);

  // Handle lease termination (from drawer)
  const handleTerminate = async (id: string) => {
    try {
      const res = await fetch(`/api/leases/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to terminate lease");

      pushToast({
        tone: "success",
        title: "Lease Terminated",
        body: "Lease has been set to inactive, and property status updated back to available.",
      });
      setDrawerLease(null);
      loadLeases();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Termination failed.";
      pushToast({
        tone: "warning",
        title: "Action Failed",
        body: msg,
      });
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let result = leases;

    // Apply status filter
    if (statusFilter === "active") {
      result = result.filter((l) => l.isActive);
    } else if (statusFilter === "terminated") {
      result = result.filter((l) => !l.isActive);
    }

    if (!q) return result;

    return result.filter((l) =>
      [
        l.id,
        l.propertyName,
        l.propertyCode,
        l.tenantName,
        l.tenantEmail || "",
        l.tenantPhone || "",
      ].some((v) => v?.toLowerCase().includes(q))
    );
  }, [leases, query, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const safePage = Math.min(page, totalPages);
  const visible = filtered.slice((safePage - 1) * rowsPerPage, safePage * rowsPerPage);

  const kpis = useMemo(() => {
    const active = leases.filter((l) => l.isActive).length;
    const total = leases.length;
    const rate = total > 0 ? (active / total) * 100 : 0;
    const deposits = leases
      .filter((l) => l.isActive && l.depositKes)
      .reduce((sum, l) => sum + parseFloat(l.depositKes!), 0);
    const rentPool = leases
      .filter((l) => l.isActive && l.monthlyRentKes)
      .reduce((sum, l) => sum + parseFloat(l.monthlyRentKes), 0);

    return { total, active, rate, deposits, rentPool };
  }, [leases]);

  const latestLeases = useMemo(() => {
    // Top 5 most recent active leases for the carousel
    return [...leases]
      .filter(l => l.isActive)
      .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime())
      .slice(0, 5);
  }, [leases]);

  const safeFeaturedIndex = latestLeases.length === 0 ? 0 : Math.min(featuredIndex, latestLeases.length - 1);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toISOString().split("T")[0];
  };

  const getInitials = (name: string) => {
    if (!name) return "??";
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  };

  return (
    <PageTransition className="mx-auto flex max-w-[98rem] flex-col gap-4">
      <BoardHeader
        eyebrow={<Badge tone="data">Lease Agreements</Badge>}
        title="Tenancies & Leases"
        description="Onboard new tenants, authorize active occupancy contracts, verify deposits held, and download executed leases."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={loadLeases} disabled={loading}>
              <IconRefresh size={14} className={loading ? "animate-spin" : undefined} /> Refresh
            </Button>
            <Button size="sm" onClick={() => setIsModalOpen(true)}>
              <IconPlus size={14} /> Register Lease
            </Button>
          </div>
        }
      />

      {/* ── Property Portfolio Hub Navigator ── */}
      <div className="flex items-center justify-between flex-wrap gap-4 bg-white border border-slate-100 p-4 rounded-[20px] shadow-sm">
        <div className="flex items-center gap-2">
          <div className="size-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center border border-teal-100/50">
            <IconBuildingCommunity size={20} />
          </div>
          <div>
            <h3 className="text-title-primary text-sm font-medium">Property Portfolio Hub</h3>
            <p className="text-desc-secondary mt-0.5 text-xs">Manage property inventory, tenancies, maintenance requests, and valuations.</p>
          </div>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-xl flex-wrap gap-1">
          <Link
            href="/admin/properties"
            className="body-sm px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 text-slate-500 hover:text-slate-900 hover:bg-white/45"
          >
            <span>Properties</span>
          </Link>
          <Link
            href="/admin/leases"
            className="body-sm px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 bg-[#151936] text-white shadow-sm font-medium"
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

      {/* ── Majestic Dark KPI Tier ── */}
      <div className="gsap-stagger bg-[#151936] text-white rounded-[24px] shadow-2xl relative overflow-hidden group mb-8 border border-[#151936]">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 via-transparent to-transparent pointer-events-none" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-white/10 relative z-10">
          
          {/* Total Records */}
          <div className="p-8 flex flex-col justify-between">
            <div className="flex items-center gap-3 mb-6">
              <div className="size-8 rounded-full bg-white/5 flex items-center justify-center border border-white/10 text-slate-300">
                <IconCalendar size={14} />
              </div>
              <span className="text-xs font-medium text-slate-400 tracking-wider">Total Leases</span>
            </div>
            <div className="flex items-end justify-between">
              <span className="font-mono text-4xl font-light text-white">{kpis.total}</span>
              <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-1">ALL TIME</span>
            </div>
          </div>

          {/* Active Tenancies */}
          <div className="p-8 flex flex-col justify-between bg-white/[0.02]">
            <div className="flex items-center gap-3 mb-6">
              <div className="size-8 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 text-emerald-400">
                <IconCheck size={14} />
              </div>
              <span className="text-xs font-medium text-slate-400 tracking-wider">Active Tenancies</span>
            </div>
            <div className="flex items-end justify-between">
              <span className="font-mono text-4xl font-light text-white">{kpis.active}</span>
              <span className="text-[10px] font-semibold uppercase tracking-widest text-emerald-400 mb-1">{kpis.rate.toFixed(1)}% SHARE</span>
            </div>
          </div>

          {/* Occupancy Rate / Mix */}
          <div className="p-8 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="size-8 rounded-full bg-amber-500/10 flex items-center justify-center border border-amber-500/20 text-amber-400">
                  <IconTrendingUp size={14} />
                </div>
                <span className="text-xs font-medium text-slate-400 tracking-wider">Lease Status Mix</span>
              </div>
              <span className="font-mono text-xl text-white">{kpis.rate.toFixed(1)}%</span>
            </div>
            <div>
              <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden flex mb-3">
                <div style={{ width: `${kpis.rate}%` }} className="bg-emerald-400 h-full rounded-r-full shadow-[0_0_10px_rgba(52,211,153,0.5)]" />
              </div>
              <div className="flex items-center gap-4 text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                <span className="flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-emerald-400" /> ACTIVE: {kpis.active}</span>
                <span className="flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-slate-500" /> TERM: {kpis.total - kpis.active}</span>
              </div>
            </div>
          </div>

          {/* Rent Pool */}
          <div className="p-8 flex flex-col justify-between bg-white/[0.02]">
            <div className="flex items-center gap-3 mb-6">
              <div className="size-8 rounded-full bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 text-indigo-400">
                <IconShield size={14} />
              </div>
              <span className="text-xs font-medium text-slate-400 tracking-wider">Monthly Rent Pool</span>
            </div>
            <div>
              <span className="font-mono text-3xl font-light text-white tracking-tight">
                {formatCompactKES(kpis.rentPool)}
              </span>
              <p className="text-[10px] font-medium uppercase tracking-widest text-slate-500 mt-2">CONTRACTED — ACTIVE ONLY</p>
            </div>
          </div>

        </div>
      </div>

      {/* ── Highlighted Recent Leases ── */}
      <div className="gsap-stagger grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-3 bg-white border border-slate-100 rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_16px_40px_rgb(0,0,0,0.06)] transition-all duration-500 flex flex-col overflow-hidden">
          {/* Card header */}
          <div className="flex items-center justify-between px-6 pt-6 pb-4">
            <div className="flex items-center gap-2">
              <span className="bg-[#151936] px-2.5 py-1 rounded-lg inline-flex items-center gap-1.5 text-white text-xs font-medium shadow-sm">
                <IconStarFilled size={12} className="text-amber-400" /> Newest Active Contracts
              </span>
            </div>
            {latestLeases.length > 1 && (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setFeaturedIndex((i) => (i === 0 ? latestLeases.length - 1 : i - 1))}
                  className="size-7 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                >
                  <IconChevronLeft size={14} />
                </button>
                <span className="label-caps text-slate-400 tabular-nums">{safeFeaturedIndex + 1}&thinsp;/&thinsp;{latestLeases.length}</span>
                <button
                  onClick={() => setFeaturedIndex((i) => (i === latestLeases.length - 1 ? 0 : i + 1))}
                  className="size-7 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                >
                  <IconChevronRight size={14} />
                </button>
              </div>
            )}
          </div>

          {latestLeases.length > 0 ? (
            <div className="flex gap-0 flex-1 min-h-0" key={safeFeaturedIndex}>
              {/* Tenant abstract graphic panel */}
              <div className="relative w-1/3 shrink-0 overflow-hidden bg-slate-50 flex items-center justify-center border-r border-slate-100">
                <div className="absolute inset-0 opacity-[0.04] bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:16px_16px]" />
                <div className="text-center z-10">
                  <div className="size-20 rounded-full bg-white text-slate-700 flex items-center justify-center text-2xl font-medium border border-slate-200 shadow-sm mx-auto mb-3">
                    {getInitials(latestLeases[safeFeaturedIndex].tenantName)}
                  </div>
                  <h4 className="text-slate-800 font-medium">{latestLeases[safeFeaturedIndex].tenantName}</h4>
                  <p className="text-slate-400 text-xs mt-1">Started: {formatDate(latestLeases[safeFeaturedIndex].startsAt)}</p>
                </div>
              </div>

              {/* Info panel */}
              <div className="flex-1 flex flex-col px-6 pb-6 pt-2 min-w-0">
                <div className="mb-4">
                  <Badge tone="success" className="mb-2">Active</Badge>
                  <h4 className="text-title-primary leading-snug">{latestLeases[safeFeaturedIndex].propertyName}</h4>
                  <p className="body-sm text-slate-400 flex items-center gap-1 mt-1 font-mono text-xs">
                    Unit: {latestLeases[safeFeaturedIndex].propertyCode}
                  </p>
                </div>

                <div className="mt-auto pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
                  <div>
                    <p className="label-caps text-slate-400 mb-0.5">Expected Monthly Rent</p>
                    <p className="mono-stat text-slate-900 text-xl tracking-tight">
                      {formatCompactKES(parseFloat(latestLeases[safeFeaturedIndex].monthlyRentKes))}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setDrawerLease(latestLeases[safeFeaturedIndex])}
                    >
                      Details
                    </Button>
                    <Link href={`/admin/leases/${latestLeases[safeFeaturedIndex].id}`}>
                      <Button
                        size="sm"
                        className="bg-[#151936] text-white hover:bg-[#151936]/90"
                      >
                        <IconEye size={14} /> View
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-14 text-center text-slate-400 flex-1">
              <div className="size-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center mb-3">
                <IconStarFilled size={24} className="opacity-40" />
              </div>
              <p className="body-sm text-slate-500">No active leases currently.</p>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4 my-6">
        <hr className="flex-1 border-slate-200/60" />
        <span className="label-caps text-slate-400 tracking-wider">Inventory Data</span>
        <hr className="flex-1 border-slate-200/60" />
      </div>

      {/* ── Data Tier: Leases Table ── */}
      <BoardPanel className="gsap-stagger space-y-4 bg-transparent lg:bg-white border-transparent lg:border-slate-100 p-0 lg:p-6 shadow-none lg:shadow-sm">
        
        {/* Majestic Search & Filter */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-slate-50/50 p-2 rounded-2xl border border-slate-100">
          <div className="flex-1 flex h-12 items-center gap-3 rounded-xl bg-white px-4 shadow-sm border border-slate-200/60 focus-within:ring-2 focus-within:ring-[#151936]/10 focus-within:border-[#151936]/30 transition-all">
            <IconSearch size={18} className="text-slate-400 shrink-0" />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search leases by tenant, property, or code..."
              className="w-full bg-transparent text-slate-700 outline-none placeholder:text-slate-400 text-sm py-1 font-medium"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-full p-1 transition-colors"
              >
                <IconX size={14} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl shadow-sm border border-slate-200/60 overflow-x-auto no-scrollbar shrink-0">
            {(["all", "active", "terminated"] as const).map((status) => (
              <button
                key={status}
                onClick={() => {
                  setStatusFilter(status);
                  setPage(1);
                }}
                className={cn(
                  "px-5 py-2 text-xs font-semibold uppercase tracking-wider rounded-lg transition-all shrink-0",
                  statusFilter === status
                    ? "bg-[#151936] text-white shadow-md"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                )}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <LoadingSpinner size="lg" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={IconCalendar}
            title="No leases on record"
            description="Create the first lease agreement to assign a tenant to an available property unit."
            action="Register Lease"
            onClick={() => setIsModalOpen(true)}
          />
        ) : (
          <div className="space-y-5">
            {/* Mobile/Tablet Card Grid */}
            <div className="block lg:hidden space-y-4">
              {visible.map((l) => {
                const PropIcon = (PROPERTY_TYPE_ICON as Record<string, React.ComponentType<{ size?: number; stroke?: number; className?: string }>>)[l.propertyType] ?? IconBuildingCommunity;
                return (
                  <div
                    key={l.id}
                    className="p-5 bg-white border border-slate-100 rounded-2xl shadow-sm hover:shadow-md transition-all flex flex-col gap-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="label-caps text-slate-400 mb-0.5">Lease ID</p>
                        <span className="mono-data text-slate-900 text-xs">{l.id.slice(0, 8).toUpperCase()}</span>
                      </div>
                      <Badge tone={l.isActive ? "success" : "neutral"}>
                        {l.isActive ? "Active" : "Terminated"}
                      </Badge>
                    </div>

                    <div className="space-y-2 border-t border-slate-50 pt-3">
                      <div>
                        <p className="label-caps text-slate-400 mb-1 block">Tenant</p>
                        <div className="flex items-center gap-2.5">
                          <div className="size-8 shrink-0 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center text-xs font-medium border border-slate-200">
                            {getInitials(l.tenantName)}
                          </div>
                          <div>
                            <span className="body-md text-slate-900 block font-medium">{l.tenantName}</span>
                            <span className="text-[11px] text-slate-400 block">{l.tenantEmail || l.tenantPhone || "—"}</span>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 pt-1">
                        <div>
                          <p className="label-caps text-slate-400 mb-1">Property</p>
                          <div className="flex items-center gap-1.5 text-slate-700">
                            <PropIcon size={16} className="text-slate-400" />
                            <span className="body-sm font-medium text-slate-700 truncate block max-w-[140px]">{l.propertyName}</span>
                          </div>
                        </div>
                        <div>
                          <p className="label-caps text-slate-400 mb-1">Rates</p>
                          <span className="body-sm text-slate-800 block font-mono">
                            {formatCompactKES(parseFloat(l.monthlyRentKes))}/mo
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-50 mt-1">
                      <span className="mono-data text-xs text-slate-400 flex flex-col">
                        <span>{formatDate(l.startsAt)}</span>
                        <span className="text-[10px]">to {formatDate(l.endsAt)}</span>
                      </span>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          className="h-8"
                          onClick={() => setDrawerLease(l)}
                        >
                          Details
                        </Button>
                        <Link href={`/admin/leases/${l.id}`}>
                          <Button size="sm" className="h-8 bg-[#151936] text-white hover:bg-[#151936]/90 px-3">
                            <IconEye size={14} /> View
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full min-w-[850px] text-left text-body-regular">
                <thead>
                  <tr className="border-b border-slate-100 label-caps text-slate-400">
                    <th className="px-3 py-3">Lease ID</th>
                    <th className="px-3 py-3">Tenant</th>
                    <th className="px-3 py-3">Property Unit</th>
                    <th className="px-3 py-3">Lease Period</th>
                    <th className="px-3 py-3 text-right">Rent rate</th>
                    <th className="px-3 py-3 text-right">Deposit</th>
                    <th className="px-3 py-3 text-center">Status</th>
                    <th className="px-3 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visible.map((l) => {
                    const PropIcon = (PROPERTY_TYPE_ICON as Record<string, React.ComponentType<{ size?: number; stroke?: number; className?: string }>>)[l.propertyType] ?? IconBuildingCommunity;
                    return (
                      <tr key={l.id} className="transition-colors hover:bg-slate-50/40 group">
                        {/* ID */}
                        <td className="px-3 py-4 font-mono text-slate-500 text-xs">
                          {l.id.slice(0, 8).toUpperCase()}
                        </td>

                        {/* Tenant */}
                        <td className="px-3 py-4">
                          <div className="flex items-center gap-3">
                            <div className="size-9 shrink-0 rounded-full bg-slate-50 text-slate-700 flex items-center justify-center text-xs font-medium border border-slate-100 shadow-sm">
                              {getInitials(l.tenantName)}
                            </div>
                            <div>
                              <p className="body-md text-slate-800 font-medium">{l.tenantName}</p>
                              <p className="text-xs text-slate-400 mt-0.5">{l.tenantEmail || l.tenantPhone || "No contact info"}</p>
                            </div>
                          </div>
                        </td>

                        {/* Property */}
                        <td className="px-3 py-4">
                          <div className="flex items-center gap-2.5">
                            <div className="size-8 rounded-lg bg-slate-50 flex items-center justify-center border border-slate-200/60 text-slate-400 group-hover:text-slate-600 transition-colors">
                              <PropIcon size={16} stroke={1.5} />
                            </div>
                            <div>
                              <p className="body-md text-slate-800 font-medium">{l.propertyName}</p>
                              <p className="mono-data text-xs text-slate-400 mt-0.5">{l.propertyCode}</p>
                            </div>
                          </div>
                        </td>

                        {/* Dates */}
                        <td className="px-3 py-4">
                          <div className="space-y-0.5">
                            <span className="mono-data text-slate-700 text-xs block">{formatDate(l.startsAt)}</span>
                            <span className="mono-data text-slate-400 text-xs block">to {formatDate(l.endsAt)}</span>
                          </div>
                        </td>

                        {/* Financials */}
                        <td className="px-3 py-4 text-right mono-stat text-slate-900 font-medium">
                          {formatCompactKES(parseFloat(l.monthlyRentKes))}
                        </td>
                        <td className="px-3 py-4 text-right mono-stat text-slate-500">
                          {l.depositKes ? formatCompactKES(parseFloat(l.depositKes)) : "—"}
                        </td>

                        {/* Status */}
                        <td className="px-3 py-4 text-center">
                          <Badge tone={l.isActive ? "success" : "neutral"}>
                            {l.isActive ? "Active" : "Terminated"}
                          </Badge>
                        </td>

                        {/* Actions */}
                        <td className="px-3 py-4">
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="secondary"
                              size="sm"
                              className="h-8"
                              onClick={() => setDrawerLease(l)}
                            >
                              Details
                            </Button>
                            <Link href={`/admin/leases/${l.id}`}>
                              <Button size="sm" className="h-8 bg-[#151936] text-white hover:bg-[#151936]/90 px-3">
                                <IconEye size={14} /> View
                              </Button>
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <PaginationControls
              currentPage={page}
              totalPages={totalPages}
              onPageChange={setPage}
              label={`${filtered.length} lease records`}
            />
          </div>
        )}
      </BoardPanel>

      <LeaseDetailDrawer
        lease={drawerLease}
        open={!!drawerLease}
        entityId={entityId}
        onClose={() => setDrawerLease(null)}
        canManage={true}
        onTerminate={handleTerminate}
      />

      {isModalOpen && (
        <LeaseFormModal
          open={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSubmit={loadLeases}
        />
      )}
    </PageTransition>
  );
}
