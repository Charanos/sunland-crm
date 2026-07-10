"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  IconCalendar,
  IconCheck,
  IconFilter,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconShield,
  IconClipboardList,
} from "@tabler/icons-react";
import Link from "next/link";
import {
  Badge,
  BoardHeader,
  BoardPanel,
  Button,
  KpiCard,
  PaginationControls,
} from "@/components/ui/erp-primitives";
import { LeaseFormModal } from "./lease-form-modal";
import { EmptyState } from "@/components/ui/empty-state";
import { PageTransition } from "@/components/shared/page-transition";
import { formatCompactKES } from "@/lib/utils/format";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { cn } from "@/lib/utils/cn";
import { IconBuildingCommunity } from "@tabler/icons-react";

type Lease = {
  id: string;
  startsAt: string;
  endsAt: string;
  monthlyRentKes: string;
  depositKes: string | null;
  isActive: boolean;
  propertyId: string;
  tenantContactId: string;
};

export function LeasesBoard({ entityId }: { entityId: string }) {
  const [leases, setLeases] = useState<Lease[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const rowsPerPage = 8;

  const loadLeases = useCallback(async () => {
    Promise.resolve().then(() => setLoading(true));
    try {
      const res = await fetch(`/api/leases?entityId=${entityId}`);
      const data = await res.json();
      setLeases(data.leases ?? []);
    } catch (err) {
      console.error("Failed to load leases:", err);
    } finally {
      setLoading(false);
    }
  }, [entityId]);

  useEffect(() => {
    let active = true;
    if (entityId) {
      const timer = setTimeout(() => {
        if (active) loadLeases();
      }, 0);
      return () => {
        active = false;
        clearTimeout(timer);
      };
    }
  }, [entityId, loadLeases]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return leases;
    return leases.filter((l) =>
      [l.tenantContactId, l.propertyId].some((v) =>
        v?.toLowerCase().includes(q)
      )
    );
  }, [leases, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const visible = filtered.slice((page - 1) * rowsPerPage, page * rowsPerPage);

  const kpis = useMemo(() => {
    const active = leases.filter((l) => l.isActive).length;
    const deposits = leases
      .filter((l) => l.depositKes)
      .reduce((sum, l) => sum + parseFloat(l.depositKes!), 0);

    return { active, deposits };
  }, [leases]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toISOString().split("T")[0];
  };

  return (
    <PageTransition className="mx-auto flex max-w-[98rem] flex-col gap-4">
      <BoardHeader
        eyebrow={<Badge tone="data">Lease Agreements</Badge>}
        title="Tenancies & Leases"
        description="Onboard new tenants, authorize active occupancy contracts, verify deposits held, and download executed leases."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={loadLeases}>
              <IconRefresh size={14} /> Refresh
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
            className="body-sm px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 text-slate-500 hover:text-slate-900 hover:bg-white/45"
          >
            <span>Properties</span>
          </Link>
          <Link
            href="/admin/leases"
            className="body-sm px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 bg-[#151936] text-white shadow-sm"
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
      <div className="gsap-stagger grid grid-cols-2 gap-3 md:grid-cols-3">
        <KpiCard
          icon={IconCheck}
          label="Active Tenancies"
          value={String(kpis.active)}
          tone="success"
        />
        <KpiCard
          icon={IconShield}
          label="Deposits Held"
          value={formatCompactKES(kpis.deposits)}
          tone="brand"
        />
        <KpiCard
          icon={IconCalendar}
          label="Total Registered Leases"
          value={String(leases.length)}
          tone="data"
        />
      </div>

      {/* Leases List */}
      <BoardPanel className="gsap-stagger space-y-4 bg-transparent lg:bg-white border-transparent lg:border-slate-100 p-0 lg:p-6 shadow-none lg:shadow-sm hover:shadow-none lg:hover:shadow-md">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <div className="flex h-10 w-full sm:flex-1 min-w-[200px] items-center gap-2 rounded-xl border border-slate-200/60 bg-white sm:bg-slate-50 px-3 shadow-sm sm:shadow-none focus-within:bg-white focus-within:ring-2 focus-within:ring-[#151936]/10 focus-within:border-[#151936]/30 transition-all">
            <IconSearch size={16} className="text-slate-400 shrink-0" />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search lease IDs or references…"
              className="w-full bg-transparent text-slate-700 outline-none placeholder:text-slate-400 text-sm py-1"
            />
          </div>
          <Button variant="secondary" className="h-10 w-full sm:w-auto shrink-0 justify-center">
            <IconFilter size={15} /> Filter
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        ) : leases.length === 0 ? (
          <EmptyState
            icon={IconCalendar}
            title="No leases on record"
            description="Create the first lease agreement to assign a tenant to an available property unit."
            action="Register Lease"
            onClick={() => setIsModalOpen(true)}
          />
        ) : (
          <div className="space-y-4">
            {/* Mobile/Tablet Card Grid (hidden on desktop) */}
            <div className="block lg:hidden space-y-4">
              {visible.map((l) => (
                <div
                  key={l.id}
                  className="p-5 bg-white border border-slate-100 rounded-2xl shadow-sm hover:shadow-md transition-all flex flex-col gap-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="label-caps text-slate-400 mb-0.5">Lease ID</p>
                      <span className="font-mono text-slate-900 text-sm">{l.id.slice(0, 8).toUpperCase()}</span>
                    </div>
                    <Badge tone={l.isActive ? "success" : "neutral"}>
                      {l.isActive ? "Active" : "Terminated"}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs border-t border-slate-50 pt-3">
                    <div>
                      <p className="label-caps text-slate-400 mb-0.5">Duration</p>
                      <span className="body-sm text-slate-700 block">
                        {formatDate(l.startsAt)} – {formatDate(l.endsAt)}
                      </span>
                    </div>
                    <div>
                      <p className="label-caps text-slate-400 mb-0.5">Rates (Rent &amp; Deposit)</p>
                      <span className="body-sm text-slate-700 block font-mono">
                        Rent: {formatCompactKES(parseFloat(l.monthlyRentKes))}/mo
                      </span>
                      <span className="body-sm text-slate-505 block font-mono text-slate-500">
                        Dep: {l.depositKes ? formatCompactKES(parseFloat(l.depositKes)) : "—"}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Table wrapper: hidden on mobile, visible on desktop */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full min-w-[800px] text-left text-body-regular">
                <thead>
                  <tr className="border-b border-slate-100 label-caps text-slate-400">
                    <th className="px-2 py-2.5">Lease ID</th>
                    <th className="px-2 py-2.5">Start Date</th>
                    <th className="px-2 py-2.5">End Date</th>
                    <th className="px-2 py-2.5 text-right">Rent rate</th>
                    <th className="px-2 py-2.5 text-right">Deposit held</th>
                    <th className="px-2 py-2.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visible.map((l) => (
                    <tr key={l.id} className="transition-colors hover:bg-slate-50/80">
                      <td className="px-2 py-3 font-mono text-slate-900">{l.id.slice(0, 8).toUpperCase()}</td>
                      <td className="px-2 py-3 text-slate-600 text-base">{formatDate(l.startsAt)}</td>
                      <td className="px-2 py-3 text-slate-600 text-base">{formatDate(l.endsAt)}</td>
                      <td className="px-2 py-3 text-right font-mono text-slate-900">
                        {formatCompactKES(parseFloat(l.monthlyRentKes))}
                      </td>
                      <td className="px-2 py-3 text-right font-mono text-slate-900">
                        {l.depositKes ? formatCompactKES(parseFloat(l.depositKes)) : "—"}
                      </td>
                      <td className="px-2 py-3 text-center">
                        <Badge tone={l.isActive ? "success" : "neutral"}>
                          {l.isActive ? "Active" : "Terminated"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
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
