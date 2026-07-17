import { cn } from "@/lib/utils/cn";

type BadgeTone = "primary" | "neutral" | "success" | "warning" | "risk" | "data" | "brand";

const tones: Record<BadgeTone, string> = {
  primary: "badge-tone-primary",
  neutral: "badge-tone-neutral",
  success: "badge-tone-success",
  warning: "badge-tone-warning",
  risk: "badge-tone-risk",
  data: "badge-tone-data",
  brand: "badge-tone-brand",
};

export function Badge({
  children,
  className,
  tone = "neutral",
}: {
  children: React.ReactNode;
  className?: string;
  tone?: BadgeTone;
}) {
  return (
    <span className={cn("badge-pill", tones[tone], className)}>
      {children}
    </span>
  );
}

export type MarketBadgeTone = "neutral" | "success" | "warning" | "risk" | "info";

export function MarketBadge({
  children,
  className,
  tone = "neutral",
}: {
  children: React.ReactNode;
  className?: string;
  tone?: MarketBadgeTone;
}) {
  const marketTones: Record<MarketBadgeTone, string> = {
    neutral: "bg-slate-700/80 text-white",
    success: "bg-emerald-500/80 text-white",
    warning: "bg-amber-500/80 text-white",
    risk: "bg-rose-500/80 text-white",
    info: "bg-sky-500/80 text-white",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full px-2.5 py-1 text-xxs font-medium uppercase tracking-widest shadow-sm",
        marketTones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

