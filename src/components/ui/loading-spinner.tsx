"use client";

import { cn } from "@/lib/utils/cn";

type SpinnerSize = "sm" | "md" | "lg" | "xl";

const sizes: Record<SpinnerSize, { container: string; outer: string; inner: string; stroke: number }> = {
  sm: { container: "size-4", outer: "size-4", inner: "size-1.5", stroke: 3 },
  md: { container: "size-5", outer: "size-5", inner: "size-2", stroke: 2.5 },
  lg: { container: "size-7", outer: "size-7", inner: "size-2.5", stroke: 2.5 },
  xl: { container: "size-9", outer: "size-9", inner: "size-3", stroke: 2 },
};

export function LoadingSpinner({
  size = "md",
  className,
}: {
  size?: SpinnerSize;
  className?: string;
}) {
  const s = sizes[size];

  return (
    <div
      aria-label="Loading"
      role="status"
      className={cn("relative inline-flex items-center justify-center shrink-0", s.container, className)}
    >
      {/* Outer spinning gradient ring */}
      <svg
        className={cn("animate-spin", s.outer)}
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-15"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth={s.stroke}
        />
        <path
          className="opacity-90"
          d="M12 2A10 10 0 0122 12h-2.5A7.5 7.5 0 0012 4.5V2z"
          fill="currentColor"
        />
      </svg>
      {/* Inner glowing pulse core */}
      <span className={cn("absolute rounded-full bg-current opacity-40 animate-ping", s.inner)} />
    </div>
  );
}

