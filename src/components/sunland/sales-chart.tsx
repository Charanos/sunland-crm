"use client";

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from "recharts";
import { formatCompactKES } from "@/lib/utils/format";

interface ChartDataPoint {
  day: string;
  Revenue: number;
  Sales: number;
  Visitors: number;
}

export default function SalesChart({ data }: { data: ChartDataPoint[] }) {
  // Custom tooltip component matching glassmorphism light aesthetics
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="rounded-xl border border-slate-100 bg-white/95 p-3.5 shadow-[0_10px_30px_rgba(0,0,0,0.08)] backdrop-blur-md">
          <p className="text-[12px] font-medium text-slate-400 uppercase tracking-wider mb-2">{label}</p>
          <div className="space-y-1.5 text-sm font-medium">
            <p className="text-[var(--tertiary)] flex items-center justify-between gap-4">
              <span>Revenue:</span>
              <span className="font-mono text-slate-800">{formatCompactKES(payload[0].value)}</span>
            </p>
            <p className="text-[#8884d8] flex items-center justify-between gap-4">
              <span>Sales:</span>
              <span className="font-mono text-slate-800">{payload[1].value} units</span>
            </p>
            <p className="text-[#82ca9d] flex items-center justify-between gap-4">
              <span>Visitors:</span>
              <span className="font-mono text-slate-800">{payload[2].value} clients</span>
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="h-72 w-full text-[12px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
          barGap={6}
        >
          <XAxis
            dataKey="day"
            stroke="#94a3b8"
            tickLine={false}
            axisLine={false}
            dy={8}
            className="font-medium"
          />
          <YAxis
            stroke="#94a3b8"
            tickLine={false}
            axisLine={false}
            dx={-4}
            className="font-mono"
            tickFormatter={(value) => formatCompactKES(value)}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(0,0,0,0.02)" }} />
          <Legend
            verticalAlign="top"
            align="right"
            height={36}
            iconSize={8}
            iconType="circle"
            formatter={(value) => <span className="text-slate-500 font-medium text-sm">{value}</span>}
          />
          <Bar
            dataKey="Revenue"
            fill="var(--tertiary)"
            radius={[4, 4, 0, 0]}
            maxBarSize={16}
          />
          <Bar
            dataKey="Sales"
            fill="#a78bfa"
            radius={[4, 4, 0, 0]}
            maxBarSize={16}
          />
          <Bar
            dataKey="Visitors"
            fill="#338f70"
            radius={[4, 4, 0, 0]}
            maxBarSize={16}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
