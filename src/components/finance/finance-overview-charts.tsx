"use client";

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
  TooltipContentProps,
} from "recharts";
import { formatCompactKES } from "@/lib/utils/format";
import { BoardPanel } from "@/components/ui/erp-primitives";

// ── Mock Data ─────────────────────────────────────────────────────────────

const REVENUE_EXPENSE_DATA = [
  { month: "Jan", revenue: 8500000, expenses: 5200000 },
  { month: "Feb", revenue: 9200000, expenses: 5400000 },
  { month: "Mar", revenue: 8800000, expenses: 6100000 },
  { month: "Apr", revenue: 10500000, expenses: 5800000 },
  { month: "May", revenue: 11200000, expenses: 6300000 },
  { month: "Jun", revenue: 12500000, expenses: 6800000 },
];

const CASH_FLOW_DATA = [
  { month: "Jan", cash: 12000000 },
  { month: "Feb", cash: 15800000 },
  { month: "Mar", cash: 14500000 },
  { month: "Apr", cash: 19200000 },
  { month: "May", cash: 24100000 },
  { month: "Jun", cash: 29800000 },
];

const REVENUE_DISTRIBUTION_DATA = [
  { name: "Property Mgmt", value: 45 },
  { name: "Letting Fees", value: 25 },
  { name: "Consultation", value: 15 },
  { name: "Valuation", value: 15 },
];

const PIE_COLORS = ["#151936", "#3f919d", "#8b5cf6", "#c96f45"];

// ── Custom Tooltips (Declared outside to prevent re-renders) ─────────────

type ChartValue = number | string | readonly (number | string)[];
type ChartName = number | string;

const RevExpTooltip = ({ active, payload, label }: Partial<TooltipContentProps<ChartValue, ChartName>>) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-xl border border-slate-100 bg-white/95 p-3 shadow-[0_10px_30px_rgba(0,0,0,0.08)] backdrop-blur-md animate-scale-in">
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">{label}</p>
        <div className="space-y-1.5">
          {payload.map((entry, index) => (
            <div key={index} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <div className="size-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                <span className="text-sm text-slate-600">{entry.name}</span>
              </div>
              <span className="text-sm font-mono font-medium text-slate-900">
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
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">{label}</p>
        <div className="flex items-center gap-2">
          <div className="size-2.5 rounded-full bg-emerald-500" />
          <span className="text-sm text-slate-600">Net Cash Position</span>
        </div>
        <p className="text-base font-mono font-medium text-slate-900 mt-1">
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
    const fill = dataPayload && typeof dataPayload === "object" && "fill" in dataPayload ? (dataPayload as { fill?: string }).fill : undefined;
    return (
      <div className="rounded-xl border border-slate-100 bg-white/95 p-3 shadow-[0_10px_30px_rgba(0,0,0,0.08)] backdrop-blur-md animate-scale-in">
        <div className="flex items-center gap-2">
          <div className="size-2.5 rounded-full" style={{ backgroundColor: fill }} />
          <span className="text-sm text-slate-600">{payload[0].name}</span>
        </div>
        <p className="text-base font-mono font-medium text-slate-950 mt-1">
          {payload[0].value}%
        </p>
      </div>
    );
  }
  return null;
};

// ── Main Component ────────────────────────────────────────────────────────

export function FinanceOverviewCharts() {
  return (
    <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 mb-5 animate-fade-in-up">
      {/* Chart 1: Revenue vs Expenses (Col 6) */}
      <BoardPanel className="lg:col-span-6 flex flex-col h-[380px]">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-title-primary">Revenue vs. Expenses</h3>
            <p className="text-xs text-slate-500 mt-0.5">6-month trend analysis</p>
          </div>
          <div className="flex items-center gap-4 text-xs font-medium">
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
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={REVENUE_EXPENSE_DATA} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#94a3b8" }} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#94a3b8", fontFamily: "monospace" }} tickFormatter={formatCompactKES} />
              <Tooltip content={<RevExpTooltip />} cursor={{ fill: "rgba(0,0,0,0.02)" }} />
              <Bar dataKey="revenue" name="Revenue" fill="#151936" radius={[4, 4, 0, 0]} maxBarSize={40} animationDuration={1000} />
              <Line type="monotone" dataKey="expenses" name="Expenses" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: "#fff" }} activeDot={{ r: 6, fill: "#f59e0b", stroke: "#fff" }} animationDuration={1000} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </BoardPanel>

      {/* Chart 2: Cash Flow Trend (Col 3) */}
      <BoardPanel className="lg:col-span-3 flex flex-col h-[380px]">
        <div className="mb-4">
          <h3 className="text-title-primary">Net Cash Position</h3>
          <p className="text-xs text-slate-500 mt-0.5">Cumulative operational liquidity</p>
        </div>
        <div className="flex-1 w-full min-h-0 -ml-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={CASH_FLOW_DATA} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorCash" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#94a3b8" }} dy={10} />
              <Tooltip content={<CashFlowTooltip />} cursor={{ stroke: "rgba(16,185,129,0.2)", strokeWidth: 2, strokeDasharray: "4 4" }} />
              <Area type="monotone" dataKey="cash" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorCash)" animationDuration={1000} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </BoardPanel>

      {/* Chart 3: Revenue Distribution (Col 3) */}
      <BoardPanel className="lg:col-span-3 flex flex-col h-[380px]">
        <div className="mb-4">
          <h3 className="text-title-primary">Revenue Streams</h3>
          <p className="text-xs text-slate-500 mt-0.5">Year-to-date income breakdown</p>
        </div>
        <div className="flex-1 w-full min-h-0 relative flex items-center justify-center">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={REVENUE_DISTRIBUTION_DATA}
                cx="50%"
                cy="45%"
                innerRadius={70}
                outerRadius={85}
                paddingAngle={4}
                dataKey="value"
                stroke="none"
                animationDuration={1000}
              >
                {REVENUE_DISTRIBUTION_DATA.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<PieTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          {/* Inner Donut Text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center -mt-6 pointer-events-none">
            <span className="text-2xl font-mono font-medium text-slate-900 leading-none">100%</span>
            <span className="label-caps text-slate-400 mt-1">Total</span>
          </div>
        </div>

        {/* Custom Legend */}
        <div className="grid grid-cols-2 gap-y-2 gap-x-2 mt-auto pt-4 border-t border-slate-50">
          {REVENUE_DISTRIBUTION_DATA.map((entry, index) => (
            <div key={index} className="flex items-center gap-2">
              <div className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[index] }} />
              <span className="text-xs text-slate-600 truncate font-medium">{entry.name}</span>
            </div>
          ))}
        </div>
      </BoardPanel>
    </section>
  );
}
