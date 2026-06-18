"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils/cn";

interface RadialProgressProps {
  percentage: number;
  valueLabel: string;
  subtitle: string;
  onClick?: () => void;
}

export default function RadialProgress({
  percentage = 93,
  valueLabel = "12,430",
  subtitle = "monthly added properties",
  onClick,
}: RadialProgressProps) {
  const [offset, setOffset] = useState(0);
  const [displayValue, setDisplayValue] = useState(0);
  const radius = 45;
  const strokeWidth = 6;
  const circumference = 2 * Math.PI * radius;

  useEffect(() => {
    // Animation delay for page entrance
    const timer = setTimeout(() => {
      const progressOffset = circumference - (percentage / 100) * circumference;
      setOffset(progressOffset);

      // Count up animation
      let start = 0;
      const end = percentage;
      const duration = 1000;
      const increment = end / (duration / 16);
      
      const counter = setInterval(() => {
        start += increment;
        if (start >= end) {
          setDisplayValue(end);
          clearInterval(counter);
        } else {
          setDisplayValue(Math.floor(start));
        }
      }, 16);
    }, 100);
    return () => clearTimeout(timer);
  }, [percentage, circumference]);

  return (
    <div 
      className={cn(
        "flex flex-col items-center justify-center p-1.5 transition-transform",
        onClick && "cursor-pointer hover:scale-105"
      )}
      onClick={onClick}
      role={onClick ? "button" : "presentation"}
      aria-label={`${percentage}% ${subtitle}`}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (onClick && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick();
        }
      }}
    >
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
        <div className="absolute inset-0 flex flex-col items-center justify-center animate-fade-in">
          <span style={{ fontSize: "20px" }} className="font-mono font-medium text-slate-800">{displayValue}%</span>
          <span style={{ fontSize: "10px" }} className="text-slate-400 uppercase tracking-widest mt-0.5">achieved</span>
        </div>
      </div>
      <div className="mt-4 text-center animate-fade-in-up stagger-2">
        <p style={{ fontSize: "24px" }} className="font-mono font-medium text-slate-800 leading-none">{valueLabel}</p>
        <p style={{ fontSize: "11px" }} className="text-slate-400 font-medium uppercase tracking-wider mt-2.5 leading-snug max-w-[140px] mx-auto">{subtitle}</p>
      </div>
    </div>
  );
}
