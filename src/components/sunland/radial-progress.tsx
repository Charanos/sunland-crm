"use client";

import { useEffect, useState } from "react";

interface RadialProgressProps {
  percentage: number;
  valueLabel: string;
  subtitle: string;
}

export default function RadialProgress({
  percentage = 93,
  valueLabel = "12,430",
  subtitle = "monthly added properties",
}: RadialProgressProps) {
  const [offset, setOffset] = useState(0);
  const radius = 45;
  const strokeWidth = 6;
  const circumference = 2 * Math.PI * radius;

  useEffect(() => {
    // Animation delay for page entrance
    const timer = setTimeout(() => {
      const progressOffset = circumference - (percentage / 100) * circumference;
      setOffset(progressOffset);
    }, 100);
    return () => clearTimeout(timer);
  }, [percentage, circumference]);

  return (
    <div className="flex flex-col items-center justify-center p-1.5">
      <div className="relative size-36">
        <svg className="size-full -rotate-90" viewBox="0 0 100 100">
          {/* Base track */}
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="transparent"
            stroke="rgba(0,0,0,0.04)"
            strokeWidth={strokeWidth}
          />
          {/* Primary progress arc */}
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="transparent"
            stroke="var(--tertiary)"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset === 0 ? circumference : offset}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span style={{ fontSize: "20px" }} className="font-mono font-medium text-slate-800">{percentage}%</span>
          <span style={{ fontSize: "10px" }} className="text-slate-400 uppercase tracking-widest mt-0.5">achieved</span>
        </div>
      </div>
      <div className="mt-4 text-center">
        <p style={{ fontSize: "24px" }} className="font-mono font-medium text-slate-800 leading-none">{valueLabel}</p>
        <p style={{ fontSize: "11px" }} className="text-slate-400 font-medium uppercase tracking-wider mt-2.5 leading-snug max-w-[140px] mx-auto">{subtitle}</p>
      </div>
    </div>
  );
}
