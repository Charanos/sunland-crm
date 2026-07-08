"use client";

import {
  IconAlertTriangle,
  IconBuildingCommunity,
  IconCurrencyDollar,
  IconHome,
  IconTrendingUp,
} from "@tabler/icons-react";
import { BoardPanel, KpiCard } from "@/components/ui/erp-primitives";
import { Badge } from "@/components/ui/erp-primitives";
import { formatCompactKES } from "@/lib/utils/format";
import { PageTransition } from "@/components/shared/page-transition";

// Mock data scaffold — will connect to /api/landlord/* once P2 mandates + P7 external identity land
const MOCK_OVERVIEW = {
  thisMonthCollected: 2850000,
  managementFee: 285000,
  remittanceDue: 2565000,
  occupancyRate: 91.7,
  totalUnits: 12,
  occupiedUnits: 11,
  arrears: 45000,
  lastRemittanceDate: "2026-06-30",
};

const MOCK_PROPERTIES = [
  { id: "1", name: "Park View Apartments, Westlands", units: 6, occupied: 6, arrears: 0 },
  { id: "2", name: "Sunbird Court, Kilimani", units: 4, occupied: 3, arrears: 45000 },
  { id: "3", name: "Greenfields Townhouse, Karen", units: 2, occupied: 2, arrears: 0 },
];

export default function LandlordOverviewPage() {
  const d = MOCK_OVERVIEW;

  return (
    <PageTransition className="mx-auto max-w-5xl space-y-6">
      {/* Welcome banner */}
      <div className="rounded-2xl bg-[#151936] px-6 py-5 text-white">
        <p className="label-caps text-white/40">Sunland ERP — Landlord Portal</p>
        <h1 className="mt-1 text-2xl text-white" style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 500 }}>
          Your Portfolio Overview
        </h1>
        <p className="mt-1 text-white/60 text-base">
          June 2026 · {d.totalUnits} units under management
        </p>
      </div>

      {/* KPI strip */}
      <div className="gsap-stagger grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard
          icon={IconCurrencyDollar}
          label="This Month Collected"
          value={formatCompactKES(d.thisMonthCollected)}
          tone="success"
        />
        <KpiCard
          icon={IconTrendingUp}
          label="Remittance Due"
          value={formatCompactKES(d.remittanceDue)}
          tone="data"
        />
        <KpiCard
          icon={IconHome}
          label="Occupancy"
          value={`${d.occupancyRate.toFixed(1)}%`}
          trend={`${d.occupiedUnits}/${d.totalUnits} units`}
          tone="success"
        />
        <KpiCard
          icon={IconAlertTriangle}
          label="Arrears"
          value={d.arrears > 0 ? formatCompactKES(d.arrears) : "None"}
          tone={d.arrears > 0 ? "warning" : "neutral"}
        />
      </div>

      {/* Remittance summary card */}
      <BoardPanel className="gsap-stagger space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-heading-primary">June 2026 Remittance Summary</h2>
            <p className="mt-0.5 text-slate-500 text-base">
              Final remittance is derived from the Sunland Finance ledger — every figure is auditable.
            </p>
          </div>
          <Badge tone="warning">Pending Disbursement</Badge>
        </div>

        <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 overflow-hidden">
          {[
            { label: "Rent Collected", value: d.thisMonthCollected, positive: true },
            { label: "Management Fee (10%)", value: -d.managementFee, positive: false },
            { label: "Approved Expenses", value: 0, positive: true },
            { label: "Net Remittance Due", value: d.remittanceDue, positive: true, bold: true },
          ].map(({ label, value, bold }) => (
            <div key={label} className={cn("flex items-center justify-between px-4 py-3", bold && "bg-slate-50")}>
              <p className={cn("text-base", bold ? "text-slate-900" : "text-slate-600")}>{label}</p>
              <p className={cn("mono-data", bold ? "text-slate-900" : "text-slate-700")}>
                {value < 0 ? `− ${formatCompactKES(Math.abs(value))}` : formatCompactKES(value)}
              </p>
            </div>
          ))}
        </div>
      </BoardPanel>

      {/* Property breakdown */}
      <BoardPanel className="gsap-stagger space-y-4">
        <div>
          <h2 className="text-heading-primary">Managed Properties</h2>
          <p className="mt-0.5 text-slate-500 text-base">Occupancy and arrears status across your portfolio.</p>
        </div>
        <div className="divide-y divide-slate-100">
          {MOCK_PROPERTIES.map((property) => (
            <div key={property.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
              <div className="flex items-center gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-slate-100">
                  <IconBuildingCommunity size={17} className="text-slate-500" />
                </div>
                <div>
                  <p className="text-title-primary">{property.name}</p>
                  <p className="text-slate-400 text-base">{property.occupied}/{property.units} occupied</p>
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                {property.arrears > 0 ? (
                  <Badge tone="risk">Arrears: {formatCompactKES(property.arrears)}</Badge>
                ) : (
                  <Badge tone="success">Fully Collected</Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      </BoardPanel>
    </PageTransition>
  );
}

// ─── cn helper (local since this file doesn't import it) ──────────────────────
function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}
