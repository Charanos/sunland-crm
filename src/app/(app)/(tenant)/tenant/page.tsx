"use client";

import {
  IconAlertCircle,
  IconCalendar,
  IconCheck,
  IconClock,
  IconCurrencyDollar,
  IconHome,
  IconTool,
} from "@tabler/icons-react";
import { BoardPanel, KpiCard, Badge } from "@/components/ui/erp-primitives";
import { formatCompactKES } from "@/lib/utils/format";
import { PageTransition } from "@/components/shared/page-transition";

// Mock scaffold — will connect to /api/tenant/* once P2 rental_ledger + P7 external identity land
const MOCK_TENANT = {
  unit: "Unit 4B, Park View Apartments, Westlands",
  balance: 0,
  nextDueDate: "2026-08-01",
  nextDueAmount: 85000,
  depositHeld: 170000,
  status: "current" as const,
  leaseEnd: "2026-12-31",
  openComplaints: 2,
};

const MOCK_RECENT_PAYMENTS = [
  { id: "1", month: "July 2026", amount: 85000, status: "confirmed", date: "2026-07-02" },
  { id: "2", month: "June 2026", amount: 85000, status: "confirmed", date: "2026-06-03" },
  { id: "3", month: "May 2026", amount: 85000, status: "confirmed", date: "2026-05-01" },
];

const STATUS_LABEL: Record<"current" | "arrears" | "overdue", string> = {
  current: "Rent Current",
  arrears: "In Arrears",
  overdue: "Overdue",
};

export default function TenantOverviewPage() {
  const t = MOCK_TENANT;

  return (
    <PageTransition className="mx-auto max-w-2xl space-y-5">
      {/* Welcome */}
      <div className="rounded-2xl bg-[#151936] px-5 py-5 text-white">
        <p className="label-caps text-white/40">Sunland ERP — Tenant Portal</p>
        <h1 className="mt-1 text-xl text-white" style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 500 }}>
          Welcome back
        </h1>
        <p className="mt-1 text-white/60 text-base">{t.unit}</p>
      </div>

      {/* Rent status card */}
      <div className="gsap-stagger rounded-2xl border px-5 py-4 bg-emerald-50 border-emerald-200">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              {t.status === "current"
                ? <IconCheck size={16} className="text-emerald-600" />
                : <IconAlertCircle size={16} className="text-rose-600" />
              }
              <p className={`text-base ${t.status === "current" ? "text-emerald-800" : "text-rose-800"}`}>
                {STATUS_LABEL[t.status]}
              </p>
            </div>
            <p className={`mt-1 text-sm ${t.status === "current" ? "text-emerald-600" : "text-rose-600"}`}>
              Balance: {t.balance === 0 ? "KES 0 — Fully Paid" : formatCompactKES(t.balance)}
            </p>
          </div>
          <div className="text-right">
            <p className="label-caps text-slate-400">Next Due</p>
            <p className="text-base text-slate-800">{t.nextDueDate}</p>
            <p className="mono-data text-slate-900">{formatCompactKES(t.nextDueAmount)}</p>
          </div>
        </div>
      </div>

      {/* KPI strip */}
      <div className="gsap-stagger grid grid-cols-2 gap-3">
        <KpiCard
          icon={IconCalendar}
          label="Lease Ends"
          value={t.leaseEnd}
          tone="neutral"
        />
        <KpiCard
          icon={IconCurrencyDollar}
          label="Deposit Held"
          value={formatCompactKES(t.depositHeld)}
          tone="data"
        />
        <KpiCard
          icon={IconTool}
          label="Open Complaints"
          value={String(t.openComplaints)}
          tone={t.openComplaints > 0 ? "warning" : "neutral"}
        />
        <KpiCard
          icon={IconHome}
          label="Payments This Year"
          value="7"
          tone="success"
        />
      </div>

      {/* Recent payments */}
      <BoardPanel className="gsap-stagger space-y-4">
        <div>
          <h2 className="text-heading-primary">Recent Payments</h2>
          <p className="mt-0.5 text-slate-500 text-base">Your confirmed rent payment history.</p>
        </div>
        <div className="divide-y divide-slate-100">
          {MOCK_RECENT_PAYMENTS.map((payment) => (
            <div key={payment.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
              <div>
                <p className="text-title-primary">{payment.month}</p>
                <p className="text-slate-400 text-base flex items-center gap-1">
                  <IconClock size={12} />
                  {payment.date}
                </p>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="mono-data text-slate-900">{formatCompactKES(payment.amount)}</span>
                <Badge tone="success">Confirmed</Badge>
              </div>
            </div>
          ))}
        </div>
      </BoardPanel>

      {/* Actions */}
      <div className="gsap-stagger grid grid-cols-2 gap-3">
        <a
          href="/tenant/payments"
          className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-700 hover:border-slate-300 hover:bg-slate-50 transition-colors"
        >
          <IconCurrencyDollar size={18} className="text-slate-400" />
          <span className="text-base">Pay Rent</span>
        </a>
        <a
          href="/tenant/maintenance"
          className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-700 hover:border-slate-300 hover:bg-slate-50 transition-colors"
        >
          <IconTool size={18} className="text-slate-400" />
          <span className="text-base">Log Issue</span>
        </a>
      </div>
    </PageTransition>
  );
}
