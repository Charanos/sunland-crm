"use client";

import { cn } from "@/lib/utils/cn";

interface GrowthItem {
  id: string;
  label: string;
  value: string;
  percentage: number;
  colorClass: string;
}

const DATA_REGISTRY: Record<string, GrowthItem[]> = {
  group: [
    { id: "g1", label: "Client Reviews", value: "456 reviews", percentage: 65, colorClass: "bg-orange-500" },
    { id: "g2", label: "Properties Viewed", value: "31k+ views", percentage: 88, colorClass: "bg-indigo-500" },
    { id: "g3", label: "Properties Listed", value: "3,356 units", percentage: 76, colorClass: "bg-[var(--tertiary)]" },
    { id: "g4", label: "Active Group Members", value: "4,560 accounts", percentage: 92, colorClass: "bg-[#338f70]" },
  ],
  commercial: [
    { id: "c1", label: "Tenant Reviews", value: "142 reviews", percentage: 55, colorClass: "bg-orange-500" },
    { id: "c2", label: "Offices Viewed", value: "9.5k+ views", percentage: 72, colorClass: "bg-indigo-500" },
    { id: "c3", label: "Suites Listed", value: "1,120 units", percentage: 60, colorClass: "bg-[var(--tertiary)]" },
    { id: "c4", label: "Corporate Members", value: "1,540 accounts", percentage: 80, colorClass: "bg-[#338f70]" },
  ],
  residential: [
    { id: "r1", label: "Buyer Reviews", value: "314 reviews", percentage: 70, colorClass: "bg-orange-500" },
    { id: "r2", label: "Villas Viewed", value: "21.5k+ views", percentage: 94, colorClass: "bg-indigo-500" },
    { id: "r3", label: "Villas Listed", value: "2,236 units", percentage: 82, colorClass: "bg-[var(--tertiary)]" },
    { id: "r4", label: "Family Members", value: "3,020 accounts", percentage: 86, colorClass: "bg-[#338f70]" },
  ],
};

export default function GrowthWidget({ entityId = "group" }: { entityId?: string }) {
  const context = (entityId === "commercial" || entityId === "residential") ? entityId : "group";
  const items = DATA_REGISTRY[context];

  return (
    <div className="flex flex-col justify-between h-full">
      <div>
        <div className="flex items-center justify-between mb-8">
          <h3 className="font-medium text-slate-800 text-[16px] tracking-wide">This Year Growth</h3>
          <span className="text-[11.5px] font-mono text-slate-400 font-medium bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100/50">Annualized</span>
        </div>
        <div className="space-y-6">
          {items.map((item) => (
            <div key={item.id} className="flex flex-col">
              <div className="flex items-center justify-between text-sm font-medium text-slate-600 mb-1.5">
                <span>{item.label}</span>
                <span className="font-mono text-slate-800">{item.value}</span>
              </div>
              <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all duration-1000 ease-out", item.colorClass)}
                  style={{ width: `${item.percentage}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-8 pt-5 border-t border-slate-100/80">
        <div className="bg-[#eef2f6]/50 rounded-[12px] p-4 border border-slate-100/50">
          <h4 className="text-[12.5px] text-slate-800 font-medium mb-1.5 flex items-center justify-between">
            Growth Trajectory
            <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded font-medium">+14.2%</span>
          </h4>
          <p className="text-[11.5px] text-slate-500 leading-relaxed">
            Platform adoption is currently exceeding annualized projections. Targeted acquisition efforts on commercial listings are recommended to perfectly balance the overall portfolio trajectory.
          </p>
        </div>
        <button className="mt-3 w-full text-center text-[12px] font-medium text-[#5a7c9f] hover:text-[#24354a] transition-colors py-1">
          View Detailed Growth Report →
        </button>
      </div>
    </div>
  );
}
