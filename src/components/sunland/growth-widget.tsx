"use client";

import Link from "next/link";
import { IconArrowRight, IconChartLine, IconTrendingUp } from "@tabler/icons-react";
import { cn } from "@/lib/utils/cn";
import { formatCompactKES } from "@/lib/utils/format";

export default function GrowthWidget({
  incomeKes,
  rentPool,
  conversionRate,
  closedDealsCount,
  occupancyRate,
  occupiedProperties,
  totalProperties,
  totalPropertiesTrend,
}: {
  incomeKes: number;
  rentPool: number;
  conversionRate: number;
  closedDealsCount: number;
  occupancyRate: number;
  occupiedProperties: number;
  totalProperties: number;
  totalPropertiesTrend: number;
}) {
  const revenueAttainmentPct = rentPool > 0 ? Math.min(100, Math.round((incomeKes / rentPool) * 100)) : 0;
  const conversionPct = Math.min(100, Math.max(0, Math.round(conversionRate)));
  const occupancyPct = Math.min(100, Math.max(0, Math.round(occupancyRate)));
  const growthPct = Math.round(totalPropertiesTrend);

  // Every value here is real (from the dashboard's own getDashboardOverview
  // response) - previously all four metrics were static ternaries keyed only
  // on entityId, disconnected from any actual data.
  const data = [
    {
      label: "Revenue Attainment",
      value: `${revenueAttainmentPct}%`,
      barPercent: revenueAttainmentPct,
      target: `of ${formatCompactKES(rentPool)}`,
      gradient: "from-emerald-400 to-teal-500",
    },
    {
      label: "Lead Conversion",
      value: `${conversionPct}%`,
      barPercent: conversionPct,
      target: `${closedDealsCount} closed`,
      gradient: "from-blue-400 to-indigo-500",
    },
    {
      label: "Portfolio Occupancy",
      value: `${occupancyPct}%`,
      barPercent: occupancyPct,
      target: `${occupiedProperties}/${totalProperties}`,
      gradient: "from-indigo-400 to-purple-500",
    },
    {
      label: "Portfolio Growth (MoM)",
      value: `${growthPct >= 0 ? "+" : ""}${growthPct}%`,
      // Growth is a diverging month-over-month rate, not a 0-100% share - a
      // 50%-baseline bar visually reads "above/below flat" rather than
      // implying progress toward a ceiling.
      barPercent: Math.min(100, Math.max(0, 50 + growthPct)),
      target: `${totalProperties} properties`,
      gradient: "from-amber-400 to-orange-500",
    },
  ];

  return (
    <div className="flex flex-col h-full animate-fade-in-up">
      <div className="flex items-center gap-3 mb-6">
        <div className="size-10 rounded-[12px] bg-[#fcf0e4] flex items-center justify-center text-[#c96f45]">
          <IconTrendingUp size={20} stroke={2} />
        </div>
        <div>
          <h3 className="text-base font-medium text-slate-900 tracking-tight">Growth Metrics</h3>
          <p className="text-xs text-slate-400 font-medium label-caps tracking-wider mt-0.5">This Month, Live</p>
        </div>
      </div>

      <div className="space-y-5 flex-1 mt-2 gsap-stagger">
        {data.map((item, idx) => (
          <div key={item.label} className="animate-fade-in-up" style={{ animationDelay: `${idx * 80}ms` }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-400 label-caps tracking-wide">{item.label}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-slate-400 border border-slate-100/60 px-2 py-0.5 rounded bg-slate-50/50 shadow-sm">{item.target}</span>
                <span className="text-sm font-mono text-slate-900 font-medium mono-data">{item.value}</span>
              </div>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden shadow-inner border border-slate-200/20">
              <div
                className={cn("h-full rounded-full transition-all duration-1000 ease-out bg-gradient-to-r", item.gradient)}
                style={{ width: `${item.barPercent}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 pt-4 border-t border-slate-100">
        <Link href="/admin/reports" className="block w-full">
          <button className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-slate-50 hover:bg-[#151936] hover:text-white text-slate-700 border border-slate-200 hover:border-[#151936] transition-all duration-300 group">
            <span className="text-xs font-medium flex items-center gap-2">
              <IconChartLine size={16} className="text-slate-400 group-hover:text-white/70" />
              View Detailed Growth Report
            </span>
            <IconArrowRight size={14} className="text-slate-400 group-hover:text-white transition-transform group-hover:translate-x-1" />
          </button>
        </Link>
      </div>
    </div>
  );
}
