"use client";

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from "recharts";
import { formatCompactKES } from "@/lib/utils/format";

interface ChartDataPoint {
  name: string;
  Value: number;
}

const STREAM_DATA: Record<string, ChartDataPoint[]> = {
  group: [
    { name: "Management", Value: 5400000 },
    { name: "Letting", Value: 3200000 },
    { name: "Lease", Value: 1800000 },
    { name: "Commissions", Value: 2100000 },
    { name: "Late Fees", Value: 650000 },
    { name: "Valuation", Value: 1100000 },
  ],
  commercial: [
    { name: "Management", Value: 3200000 },
    { name: "Letting", Value: 1800000 },
    { name: "Lease", Value: 950000 },
    { name: "Commissions", Value: 1200000 },
    { name: "Late Fees", Value: 350000 },
    { name: "Valuation", Value: 900000 },
  ],
};

const BAR_COLORS = [
  "#151936", // Dark Brand Slate
  "#3f919d", // Teal Accent
  "#48954b", // Green Accent
  "#c96f45", // Orange Accent
  "#5a7c9f", // Light Slate Accent
  "#8b5cf6", // Violet Accent
];

export default function RevenueStreamChart({ entityId = "group" }: { entityId?: string }) {
  const data = STREAM_DATA[entityId] || STREAM_DATA.group;

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const dataPoint = payload[0].payload as ChartDataPoint;
      return (
        <div className="rounded-xl border border-slate-100 bg-white/95 p-3.5 shadow-[0_10px_30px_rgba(0,0,0,0.08)] backdrop-blur-md animate-scale-in">
          <p className="text-base font-medium text-slate-400 uppercase tracking-wider mb-1.5">{dataPoint.name}</p>
          <p className="text-sm  font-medium font-mono text-slate-800">
            {formatCompactKES(dataPoint.Value)} KES
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="h-80 w-full mt-2 text-base">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 10, right: 10, left: -5, bottom: 5 }}
        >
          <XAxis
            dataKey="name"
            stroke="#94a3b8"
            tickLine={false}
            axisLine={false}
            dy={8}
            className="font-medium text-slate-500"
          />
          <YAxis
            stroke="#94a3b8"
            tickLine={false}
            axisLine={false}
            dx={-4}
            className="font-mono text-slate-400"
            tickFormatter={(value) => formatCompactKES(value)}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(21,25,54,0.01)" }} />
          <Bar
            dataKey="Value"
            radius={[6, 6, 0, 0]}
            maxBarSize={45}
            animationDuration={800}
            animationEasing="ease-out"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={BAR_COLORS[index % BAR_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
