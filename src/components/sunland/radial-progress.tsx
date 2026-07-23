"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils/cn";

interface RadialProgressProps {
  percentage: number;
  valueLabel?: string;
  subtitle: string;
  onClick?: () => void;
}

export default function RadialProgress({
  percentage = 93,
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
        "flex flex-col items-center justify-center p-2 transition-transform",
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
      <div className="relative size-40 group">
        <svg className="size-full -rotate-90" viewBox="0 0 100 100">
          {/* Base track */}
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="transparent"
            stroke="rgba(0,0,0,0.03)"
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
        <div className="absolute inset-0 flex flex-col items-center justify-center animate-fade-in group-hover:scale-105 transition-transform duration-300">
          <span className="text-slate-800 font-mono font-medium">{displayValue}<span className="text-body-primary text-slate-400">%</span></span>
        </div>
      </div>
      <div className="mt-5 text-center animate-fade-in-up stagger-2 w-full px-2">
        <p className="label-caps mx-auto">{subtitle}</p>
      </div>
    </div>
  );
}
