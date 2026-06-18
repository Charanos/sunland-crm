"use client";

import Link from "next/link";
import { IconArrowRight, IconChartLine, IconTrendingUp } from "@tabler/icons-react";
import { cn } from "@/lib/utils/cn";

export default function GrowthWidget({ entityId = "group" }: { entityId?: string }) {
  const isComm = entityId === "commercial";
  const isRes = entityId === "residential";

  const data = [
    { label: "Revenue Target", value: isComm ? "82%" : isRes ? "91%" : "88%", target: "KES 50M", color: "bg-emerald-500" },
    { label: "Leasing Pipeline", value: isComm ? "65%" : isRes ? "78%" : "72%", target: "120 Units", color: "bg-blue-500" },
    { label: "Client Retention", value: isComm ? "94%" : isRes ? "96%" : "95%", target: "95% SLA", color: "bg-indigo-500" },
    { label: "Market Share", value: isComm ? "42%" : isRes ? "58%" : "48%", target: "50% Lead", color: "bg-amber-500" },
  ];

  return (
    <div className="flex flex-col h-full animate-fade-in-up">
      <div className="flex items-center gap-3 mb-6">
        <div className="size-10 rounded-[12px] bg-[#fcf0e4] flex items-center justify-center text-[#c96f45]">
          <IconTrendingUp size={20} stroke={2} />
        </div>
        <div>
          <h3 className="text-[16px] text-slate-800 font-medium tracking-wide">Growth Metrics</h3>
          <p className="text-[12px] text-slate-500 font-medium mt-0.5">Quarterly Objectives</p>
        </div>
      </div>

      <div className="space-y-5 flex-1 mt-2">
        {data.map((item, idx) => (
          <div key={item.label} className="animate-fade-in-up" style={{ animationDelay: `${idx * 100}ms` }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[12.5px] font-medium text-slate-700">{item.label}</span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-wider font-medium text-slate-400 border border-slate-100 px-1.5 rounded bg-slate-50">{item.target}</span>
                <span className="text-[12.5px] font-mono font-medium text-slate-900">{item.value}</span>
              </div>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all duration-1000 ease-out", item.color)}
                style={{ width: item.value }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 pt-4 border-t border-slate-100">
        <Link href="/admin/reports" className="block w-full">
          <button className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-slate-50 hover:bg-[#151936] hover:text-white text-slate-700 border border-slate-200 hover:border-[#151936] transition-all group">
            <span className="text-[13px] font-medium flex items-center gap-2">
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
