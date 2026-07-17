"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  AreaChart,
  Area,
  PieChart,
  Pie,
  CartesianGrid,
  TooltipContentProps,
} from "recharts";
import { formatCompactKES } from "@/lib/utils/format";
import { BoardPanel } from "@/components/ui/erp-primitives";

// ── Period-aware mock data ─────────────────────────────────────────────────────

export type FinancePeriod = "1M" | "3M" | "6M" | "1Y";

const MONTHLY = [
  { label: "Jan", revenue: 8500000, expenses: 5200000, cash: 12000000 },
  { label: "Feb", revenue: 9200000, expenses: 5400000, cash: 15800000 },
  { label: "Mar", revenue: 8800000, expenses: 6100000, cash: 14500000 },
  { label: "Apr", revenue: 10500000, expenses: 5800000, cash: 19200000 },
  { label: "May", revenue: 11200000, expenses: 6300000, cash: 24100000 },
  { label: "Jun", revenue: 12500000, expenses: 6800000, cash: 29800000 },
];

const QUARTERLY = [
  { label: "Q1 '25", revenue: 24000000, expenses: 15200000, cash: 22000000 },
  { label: "Q2 '25", revenue: 27800000, expenses: 16400000, cash: 28000000 },
  { label: "Q3 '25", revenue: 31200000, expenses: 17900000, cash: 33500000 },
  { label: "Q4 '25", revenue: 36500000, expenses: 19600000, cash: 41000000 },
  { label: "Q1 '26", revenue: 29000000, expenses: 16000000, cash: 38000000 },
  { label: "Q2 '26", revenue: 33500000, expenses: 18100000, cash: 44500000 },
];

const BIANNUAL = [
  { label: "H1 '24", revenue: 44000000, expenses: 27000000, cash: 38000000 },
  { label: "H2 '24", revenue: 58000000, expenses: 33000000, cash: 56000000 },
  { label: "H1 '25", revenue: 52000000, expenses: 31600000, cash: 50000000 },
  { label: "H2 '25", revenue: 67000000, expenses: 37500000, cash: 74500000 },
  { label: "H1 '26", revenue: 62500000, expenses: 34100000, cash: 82500000 },
];

const ANNUAL = [
  { label: "2021", revenue: 82000000, expenses: 49000000, cash: 68000000 },
  { label: "2022", revenue: 97000000, expenses: 56000000, cash: 89000000 },
  { label: "2023", revenue: 118000000, expenses: 64000000, cash: 112000000 },
  { label: "2024", revenue: 102000000, expenses: 58000000, cash: 130500000 },
  { label: "2025", revenue: 119000000, expenses: 69100000, cash: 124500000 },
  { label: "2026 YTD", revenue: 62500000, expenses: 34100000, cash: 157000000 },
];

const PIE_COLORS = ["#151936", "#3f919d", "#8b5cf6", "#c96f45", "#f59e0b"];

// ── Custom Tooltips ────────────────────────────────────────────────────────────

type ChartValue = number | string | readonly (number | string)[];
type ChartName = number | string;

const RevExpTooltip = ({ active, payload, label }: Partial<TooltipContentProps<ChartValue, ChartName>>) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-xl border border-slate-100 bg-white/95 p-3 shadow-[0_10px_30px_rgba(0,0,0,0.08)] backdrop-blur-md animate-scale-in">
        <p className="label-caps text-slate-400 mb-2">{label}</p>
        <div className="space-y-1.5">
          {payload.map((entry, index) => (
            <div key={index} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <div className="size-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                <span className="text-caption text-slate-600">{entry.name}</span>
              </div>
              <span className="text-caption font-mono text-slate-900">
                {formatCompactKES(Number(entry.value))}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

const CashFlowTooltip = ({ active, payload, label }: Partial<TooltipContentProps<ChartValue, ChartName>>) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-xl border border-slate-100 bg-white/95 p-3 shadow-[0_10px_30px_rgba(0,0,0,0.08)] backdrop-blur-md animate-scale-in">
        <p className="label-caps text-slate-400 mb-1.5">{label}</p>
        <div className="flex items-center gap-2">
          <div className="size-2.5 rounded-full bg-emerald-500" />
          <span className="text-caption text-slate-600">Net Cash Position</span>
        </div>
        <p className="text-caption font-mono text-slate-900 mt-1">
          {formatCompactKES(Number(payload[0].value))}
        </p>
      </div>
    );
  }
  return null;
};

const PieTooltip = ({ active, payload }: Partial<TooltipContentProps<ChartValue, ChartName>>) => {
  if (active && payload && payload.length) {
    const dataPayload = payload[0].payload;
    const fill = dataPayload && typeof dataPayload === "object" && "fill" in dataPayload
      ? (dataPayload as { fill?: string }).fill : undefined;
    return (
      <div className="rounded-xl border border-slate-100 bg-white/95 p-3 shadow-[0_10px_30px_rgba(0,0,0,0.08)] backdrop-blur-md animate-scale-in">
        <div className="flex items-center gap-2">
          <div className="size-2.5 rounded-full" style={{ backgroundColor: fill }} />
          <span className="text-caption text-slate-600">{payload[0].name}</span>
        </div>
        <p className="text-caption font-mono text-slate-950 mt-1">
          {payload[0].value}%
        </p>
      </div>
    );
  }
  return null;
};

// ── Main Component ─────────────────────────────────────────────────────────────

interface FinanceOverviewChartsProps {
  period: FinancePeriod;
  entityId?: string;
}

export function FinanceOverviewCharts({ period, entityId = "group" }: FinanceOverviewChartsProps) {
  // Real revenue-by-stream shares (client call note item 5) - replaces the
  // former hardcoded REVENUE_DISTRIBUTION_DATA mock, whose category labels
  // ("Consultation") didn't even correspond to a real transaction type.
  const [streamShares, setStreamShares] = useState<{ name: string; value: number }[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/finance/revenue-streams?entityId=${entityId}`)
      .then((res) => res.json())
      .then((json: { totalRevenueKes: number; streams: { label: string; totalKes: number }[] }) => {
        if (cancelled) return;
        const total = json.totalRevenueKes || 0;
        const shares = json.streams
          .filter((s) => s.totalKes > 0)
          .map((s) => ({ name: s.label, value: total > 0 ? Math.round((s.totalKes / total) * 100) : 0 }));
        setStreamShares(shares);
      })
      .catch(() => {
        if (!cancelled) setStreamShares([]);
      });
    return () => {
      cancelled = true;
    };
  }, [entityId]);

  const chartData = useMemo(() => {
    switch (period) {
      case "3M": return QUARTERLY.slice(-3);
      case "6M": return MONTHLY;
      case "1Y": return QUARTERLY;
      default: return MONTHLY.slice(-1); // 1M = just current month context; use 6M granularity
    }
  }, [period]);

  // For the "1M" view we still show all monthly data for trend context but highlight current
  const displayData = period === "1M" ? MONTHLY : chartData;

  const periodLabel = {
    "1M": "Current Month",
    "3M": "Last 3 Months",
    "6M": "6-Month Trend",
    "1Y": "Annual / Quarterly",
  }[period];

  return (
    <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 mb-5 animate-fade-in-up">
      {/* Chart 1: Revenue vs Expenses (Col 6) */}
      <BoardPanel className="lg:col-span-6 flex flex-col h-[380px]">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-title-primary">Revenue vs. Expenses</h3>
            <p className="text-meta-muted mt-0.5">{periodLabel}</p>
          </div>
          <div className="flex items-center gap-4 text-tiny">
            <div className="flex items-center gap-1.5">
              <div className="size-2.5 rounded bg-[#151936]" />
              <span className="text-slate-600">Revenue</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-0.5 rounded bg-[#f59e0b]" />
              <span className="text-slate-600">Expenses</span>
            </div>
          </div>
        </div>
        <div className="flex-1 w-full min-h-0">
          <ResponsiveContainer width="100%" height="100%" minHeight={0} minWidth={0}>
            <ComposedChart data={displayData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="rgba(0,0,0,0.04)" />
              <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#94a3b8" }} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#94a3b8", fontFamily: "monospace" }} tickFormatter={formatCompactKES} />
              <Tooltip content={<RevExpTooltip />} cursor={{ fill: "rgba(0,0,0,0.02)" }} />
              <Bar dataKey="revenue" name="Revenue" fill="#151936" radius={[4, 4, 0, 0]} maxBarSize={40} animationDuration={800} />
              <Line type="monotone" dataKey="expenses" name="Expenses" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: "#fff" }} activeDot={{ r: 6, fill: "#f59e0b", stroke: "#fff" }} animationDuration={800} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </BoardPanel>

      {/* Chart 2: Cash Flow Trend (Col 3) */}
      <BoardPanel className="lg:col-span-3 flex flex-col h-[380px]">
        <div className="mb-4">
          <h3 className="text-title-primary">Net Cash Position</h3>
          <p className="text-meta-muted mt-0.5">{periodLabel} - cumulative</p>
        </div>
        <div className="flex-1 w-full min-h-0 -ml-4">
          <ResponsiveContainer width="100%" height="100%" minHeight={0} minWidth={0}>
            <AreaChart data={displayData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorCash" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#94a3b8" }} dy={10} />
              <Tooltip content={<CashFlowTooltip />} cursor={{ stroke: "rgba(16,185,129,0.2)", strokeWidth: 2, strokeDasharray: "4 4" }} />
              <Area type="monotone" dataKey="cash" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorCash)" animationDuration={800} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </BoardPanel>

      {/* Chart 3: Revenue Distribution (Col 3) */}
      <BoardPanel className="lg:col-span-3 flex flex-col h-[380px]">
        <div className="mb-4">
          <h3 className="text-title-primary">Revenue Streams</h3>
          <p className="text-meta-muted mt-0.5">This month&apos;s income breakdown</p>
        </div>
        {!streamShares ? (
          <div className="flex-1 w-full flex items-center justify-center">
            <div className="skeleton-shimmer size-40 rounded-full" />
          </div>
        ) : streamShares.length === 0 ? (
          <div className="flex-1 w-full flex items-center justify-center text-meta-muted text-center px-4">
            No revenue recorded this period.
          </div>
        ) : (
          <>
            <div className="flex-1 w-full min-h-0 relative flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%" minHeight={0} minWidth={0}>
                <PieChart>
                  <Pie
                    data={streamShares}
                    cx="50%"
                    cy="45%"
                    innerRadius={70}
                    outerRadius={85}
                    paddingAngle={4}
                    dataKey="value"
                    stroke="none"
                    animationDuration={800}
                  >
                    {streamShares.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              {/* Inner Donut Text */}
              <div className="absolute inset-0 flex flex-col items-center justify-center -mt-6 pointer-events-none">
                <span className="font-mono text-slate-900 leading-none" style={{ fontSize: "24px" }}>100%</span>
                <span className="label-caps text-slate-400 mt-1">Total</span>
              </div>
            </div>

            {/* Custom Legend */}
            <div className="grid grid-cols-2 gap-y-2 gap-x-2 mt-auto pt-4 border-t border-slate-50">
              {streamShares.map((entry, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }} />
                  <span className="text-meta-muted truncate">{entry.name}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </BoardPanel>
    </section>
  );
}
