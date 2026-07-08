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
import { PropertyFormModal } from "./property-form-modal";
import { EmptyState } from "@/components/ui/empty-state";
import { PageTransition } from "@/components/shared/page-transition";
import { formatCompactKES } from "@/lib/utils/format";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

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
};

export function PropertiesBoard({ entityId }: { entityId: string }) {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const rowsPerPage = 8;

  const loadProperties = useCallback(async () => {
    Promise.resolve().then(() => setLoading(true));
    try {
      const res = await fetch(`/api/properties?entityId=${entityId}`);
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
      const timer = setTimeout(() => {
        if (active) loadProperties();
      }, 0);
      return () => {
        active = false;
        clearTimeout(timer);
      };
    }
  }, [entityId, loadProperties]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return properties;
    return properties.filter((p) =>
      [p.name, p.propertyCode, p.location, p.propertyType].some((v) =>
        v?.toLowerCase().includes(q)
      )
    );
  }, [properties, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const visible = filtered.slice((page - 1) * rowsPerPage, page * rowsPerPage);

  const kpis = useMemo(() => {
    const total = properties.length;
    const occupied = properties.filter((p) => p.status === "occupied").length;
    const rate = total > 0 ? (occupied / total) * 100 : 0;
    const rentPool = properties
      .filter((p) => p.monthlyRentKes)
      .reduce((sum, p) => sum + parseFloat(p.monthlyRentKes!), 0);

    return { total, occupied, rate, rentPool };
  }, [properties]);

  return (
    <PageTransition className="mx-auto flex max-w-[98rem] flex-col gap-4">
      <BoardHeader
        eyebrow={<Badge tone="primary">Estate Portfolio</Badge>}
        title="Properties & Inventory"
        description="Track managed residential and commercial properties, tenant occupancy states, and owner portfolios."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={loadProperties}>
              <IconRefresh size={14} /> Refresh
            </Button>
            <Button size="sm" onClick={() => setIsModalOpen(true)}>
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
            <h3 className="text-base font-medium text-slate-800 leading-none">Portfolio Control Hub</h3>
            <p className="text-sm text-slate-400 mt-1">Navigate across property inventory and advisory segments.</p>
          </div>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-xl flex-wrap gap-1">
          <Link
            href="/admin/properties"
            className="px-3.5 py-1.5 text-sm font-medium rounded-lg transition-all flex items-center gap-1.5 bg-[#151936] text-white shadow-sm"
          >
            <span>Properties</span>
            <span className="bg-[#f3df27] text-[#151936] px-1.5 py-0.2 rounded-full font-medium text-sm">Inventory</span>
          </Link>
          <Link
            href="/admin/valuations"
            className="px-3.5 py-1.5 text-sm font-medium rounded-lg transition-all flex items-center gap-1.5 text-slate-500 hover:text-slate-900 hover:bg-white/45"
          >
            <span>Valuations</span>
          </Link>
        </div>
      </div>

      {/* KPI strip */}
      <div className="gsap-stagger grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard
          icon={IconBuildingCommunity}
          label="Total Units"
          value={String(kpis.total)}
          tone="data"
        />
        <KpiCard
          icon={IconCheck}
          label="Occupied Units"
          value={String(kpis.occupied)}
          tone="success"
        />
        <KpiCard
          icon={IconTrendingUp}
          label="Occupancy Rate"
          value={`${kpis.rate.toFixed(1)}%`}
          tone="success"
        />
        <KpiCard
          icon={IconClock}
          label="Monthly Rent Pool"
          value={formatCompactKES(kpis.rentPool)}
          tone="warning"
        />
      </div>

      {/* Properties List */}
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
              placeholder="Search properties by name, code, or location…"
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
        ) : properties.length === 0 ? (
          <EmptyState
            icon={IconBuildingCommunity}
            title="No properties registered"
            description="Register the first property unit in the portfolio. Ensure you have onboarded the landlord contact beforehand."
            action="Register Property"
            onClick={() => setIsModalOpen(true)}
          />
        ) : (
          <div className="space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] text-left text-body-regular">
                <thead>
                  <tr className="border-b border-slate-100 label-caps text-slate-400">
                    <th className="px-2 py-2.5">Code</th>
                    <th className="px-2 py-2.5">Name</th>
                    <th className="px-2 py-2.5">Type</th>
                    <th className="px-2 py-2.5">Location</th>
                    <th className="px-2 py-2.5 text-right">Rent rate</th>
                    <th className="px-2 py-2.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visible.map((p) => (
                    <tr key={p.id} className="transition-colors hover:bg-slate-50/80">
                      <td className="px-2 py-3 font-mono text-slate-900">{p.propertyCode}</td>
                      <td className="px-2 py-3 text-title-primary">{p.name}</td>
                      <td className="px-2 py-3 text-slate-600 text-base">{p.propertyType}</td>
                      <td className="px-2 py-3 text-slate-500 text-base">{p.location}</td>
                      <td className="px-2 py-3 text-right font-mono text-slate-900">
                        {p.monthlyRentKes ? formatCompactKES(parseFloat(p.monthlyRentKes)) : "—"}
                      </td>
                      <td className="px-2 py-3 text-center">
                        <Badge tone={p.status === "occupied" ? "success" : "neutral"}>
                          {p.status.replace(/_/g, " ")}
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
              label={`${filtered.length} property records`}
            />
          </div>
        )}
      </BoardPanel>

      {isModalOpen && (
        <PropertyFormModal
          open={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSubmit={loadProperties}
        />
      )}
    </PageTransition>
  );
}
