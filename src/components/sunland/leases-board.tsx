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

      {/* ── Property Operations Hub Navigator ── */}
      <div className="flex items-center justify-between flex-wrap gap-4 bg-white border border-slate-100 p-4 rounded-[20px] shadow-sm">
        <div className="flex items-center gap-2">
          <div className="size-8 rounded-lg bg-indigo-50 text-indigo-650 flex items-center justify-center">
            <IconClipboardList size={16} />
          </div>
          <div>
            <h3 className="text-base font-medium text-slate-800 leading-none">Property Operations Hub</h3>
            <p className="text-sm text-slate-400 mt-1">Manage tenancies and maintenance requests.</p>
          </div>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-xl flex-wrap gap-1">
          <Link
            href="/admin/leases"
            className="body-sm px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 bg-[#151936] text-white shadow-sm"
          >
            <span>Leases</span>
            <span className="bg-[#f3df27] text-[#151936] px-1.5 py-0.2 rounded-full text-meta-muted-strong">Active</span>
          </Link>
          <Link
            href="/admin/maintenance"
            className="body-sm px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 text-slate-500 hover:text-slate-900 hover:bg-white/45"
          >
            <span>Maintenance</span>
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
      <BoardPanel className="gsap-stagger space-y-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex h-9 flex-1 min-w-[200px] items-center gap-2 rounded-lg border border-slate-200 bg-white px-3">
            <IconSearch size={14} className="text-slate-400" />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search lease IDs or references…"
              className="w-full bg-transparent text-slate-700 outline-none placeholder:text-slate-400 text-base"
            />
          </div>
          <Button variant="secondary" size="sm">
            <IconFilter size={14} /> Filter
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
            <div className="overflow-x-auto">
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
