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
  IconArrowUpRight,
  IconFileText,
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
import { EmptyState } from "@/components/ui/empty-state";
import { PageTransition } from "@/components/shared/page-transition";
import { formatCompactKES } from "@/lib/utils/format";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { cn } from "@/lib/utils/cn";
import { useToast } from "@/components/ui/toast-provider";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
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

  // Termination confirmation state
  const [terminateConfirmId, setTerminateConfirmId] = useState<string | null>(null);
  const [isTerminating, setIsTerminating] = useState(false);

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

  // Handle lease termination
  const handleTerminate = async () => {
    if (!terminateConfirmId) return;
    setIsTerminating(true);
    try {
      const res = await fetch(`/api/leases/${terminateConfirmId}`, {
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
      setTerminateConfirmId(null);
      loadLeases();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Termination failed.";
      pushToast({
        tone: "warning",
        title: "Action Failed",
        body: msg,
      });
    } finally {
      setIsTerminating(false);
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
  const visible = filtered.slice((page - 1) * rowsPerPage, page * rowsPerPage);

  const kpis = useMemo(() => {
    const active = leases.filter((l) => l.isActive).length;
    const terminated = leases.filter((l) => !l.isActive).length;
    const deposits = leases
      .filter((l) => l.isActive && l.depositKes)
      .reduce((sum, l) => sum + parseFloat(l.depositKes!), 0);

    return { active, terminated, deposits };
  }, [leases]);

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
    <PageTransition className="mx-auto flex max-w-[98rem] flex-col gap-5">
      <BoardHeader
        eyebrow={<Badge tone="data">Lease Agreements</Badge>}
        title="Tenancies & Leases"
        description="Onboard new tenants, authorize active occupancy contracts, verify deposits held, and download executed leases."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={loadLeases} className="h-9">
              <IconRefresh size={14} /> Refresh
            </Button>
            <Button size="sm" onClick={() => setIsModalOpen(true)} className="h-9">
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

      {/* KPI strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Active Tenancies */}
        <div className="bg-white border border-slate-100 p-5 rounded-[24px] shadow-[0_8px_30px_rgba(0,0,0,0.04)] hover:shadow-[0_16px_40px_rgba(0,0,0,0.06)] transition-all duration-300 flex items-center justify-between group">
          <div className="space-y-1">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-400">Active Tenancies</span>
            <div className="flex items-baseline gap-2">
              <span className="mono-stat text-3xl text-slate-900">{kpis.active}</span>
              <span className="text-xs text-emerald-500 font-medium">Currently live</span>
            </div>
          </div>
          <div className="size-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 shadow-sm group-hover:scale-105 transition-transform duration-300">
            <IconCheck size={22} />
          </div>
        </div>

        {/* Deposits Held */}
        <div className="bg-white border border-slate-100 p-5 rounded-[24px] shadow-[0_8px_30px_rgba(0,0,0,0.04)] hover:shadow-[0_16px_40px_rgba(0,0,0,0.06)] transition-all duration-300 flex items-center justify-between group">
          <div className="space-y-1">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-400">Deposits Held</span>
            <div className="flex items-baseline gap-2">
              <span className="mono-stat text-2xl text-slate-900">{formatCompactKES(kpis.deposits)}</span>
              <span className="text-xs text-indigo-500 font-medium">Escrowed</span>
            </div>
          </div>
          <div className="size-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100 shadow-sm group-hover:scale-105 transition-transform duration-300">
            <IconShield size={22} />
          </div>
        </div>

        {/* Total Registered */}
        <div className="bg-white border border-slate-100 p-5 rounded-[24px] shadow-[0_8px_30px_rgba(0,0,0,0.04)] hover:shadow-[0_16px_40px_rgba(0,0,0,0.06)] transition-all duration-300 flex items-center justify-between group">
          <div className="space-y-1">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-400">Total Leases</span>
            <div className="flex items-baseline gap-2">
              <span className="mono-stat text-3xl text-slate-900">{leases.length}</span>
              <span className="text-xs text-slate-400 font-medium">All historical</span>
            </div>
          </div>
          <div className="size-12 rounded-2xl bg-slate-50 text-slate-600 flex items-center justify-center border border-slate-200 shadow-sm group-hover:scale-105 transition-transform duration-300">
            <IconCalendar size={22} />
          </div>
        </div>
      </div>

      {/* Leases List Panel (Discard card shell wrapper on mobile - Rule 10) */}
      <BoardPanel className="gsap-stagger space-y-4 bg-transparent lg:bg-white border-transparent lg:border-slate-100 p-0 lg:p-6 shadow-none lg:shadow-sm">
        
        {/* Search & Filter pills */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          <div className="flex-1 flex h-11 items-center gap-2 rounded-2xl border border-slate-200/60 bg-white px-3.5 shadow-sm focus-within:ring-2 focus-within:ring-[#151936]/5 focus-within:border-[#151936]/20 transition-all">
            <IconSearch size={18} className="text-slate-400 shrink-0" />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search leases by tenant, property, or code..."
              className="w-full bg-transparent text-slate-700 outline-none placeholder:text-slate-400 text-sm py-1 font-normal"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="text-slate-400 hover:text-slate-600 p-0.5"
              >
                <IconX size={16} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto py-1 no-scrollbar shrink-0">
            {(["all", "active", "terminated"] as const).map((status) => (
              <button
                key={status}
                onClick={() => {
                  setStatusFilter(status);
                  setPage(1);
                }}
                className={cn(
                  "px-4 py-2 text-xs font-medium uppercase tracking-wider rounded-xl border transition-all shrink-0",
                  statusFilter === status
                    ? "bg-[#151936] text-white border-transparent shadow-sm"
                    : "bg-white text-slate-500 border-slate-100 hover:bg-slate-50/50 hover:text-slate-800"
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
            {/* Mobile/Tablet Card Grid (hidden on desktop - Rule 9) */}
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
                      <span className="mono-data text-xs text-slate-400">
                        {formatDate(l.startsAt)} to {formatDate(l.endsAt)}
                      </span>
                      {l.isActive && (
                        <Button
                          variant="secondary"
                          size="sm"
                          className="h-8 text-red-500 hover:text-red-700 hover:bg-red-50/50 border-red-100 hover:border-red-200"
                          onClick={() => setTerminateConfirmId(l.id)}
                        >
                          Terminate
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Table wrapper: hidden on mobile, visible on desktop (Rule 9) */}
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

                        {/* Tenant profile details */}
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

                        {/* Property joined unit details */}
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

                        {/* Financial stats */}
                        <td className="px-3 py-4 text-right mono-stat text-slate-900 font-medium">
                          {formatCompactKES(parseFloat(l.monthlyRentKes))}
                        </td>
                        <td className="px-3 py-4 text-right mono-stat text-slate-500">
                          {l.depositKes ? formatCompactKES(parseFloat(l.depositKes)) : "—"}
                        </td>

                        {/* Status badge */}
                        <td className="px-3 py-4 text-center">
                          <Badge tone={l.isActive ? "success" : "neutral"}>
                            {l.isActive ? "Active" : "Terminated"}
                          </Badge>
                        </td>

                        {/* Row action */}
                        <td className="px-3 py-4 text-right">
                          {l.isActive ? (
                            <Button
                              variant="secondary"
                              size="sm"
                              className="text-red-500 hover:text-red-700 hover:bg-red-50/50 border-red-100 hover:border-red-200 h-8 font-medium"
                              onClick={() => setTerminateConfirmId(l.id)}
                            >
                              Terminate
                            </Button>
                          ) : (
                            <span className="text-xs text-slate-400 italic">Historical</span>
                          )}
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

      {/* Confirm dialog wrapper for lease termination */}
      {terminateConfirmId && (
        <ConfirmDialog
          open={!!terminateConfirmId}
          title="Terminate Lease Agreement"
          description="Are you sure you want to terminate this tenancy lease? This sets the lease status to inactive and changes the property occupancy status back to available immediately."
          confirmLabel="Terminate Lease"
          cancelLabel="Keep Active"
          tone="warning"
          isLoading={isTerminating}
          onClose={() => setTerminateConfirmId(null)}
          onConfirm={handleTerminate}
        />
      )}

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
