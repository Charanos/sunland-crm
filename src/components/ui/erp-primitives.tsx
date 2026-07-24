import Link from "next/link";
import type { HTMLAttributes, ReactNode } from "react";
import type { Icon } from "@tabler/icons-react";
import { IconArrowUpRight, IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { cn } from "@/lib/utils/cn";

export function BoardHeader({
  eyebrow,
  title,
  description,
  meta,
  actions,
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <section
      aria-label="Board header"
      className={cn(
        "flex flex-col gap-1 border-b border-slate-200/60 pb-3 animate-fade-in-up",
        className,
      )}
    >
      {(eyebrow || meta || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            {eyebrow}
            {meta}
          </div>
          {actions}
        </div>
      )}
      <h1 className="title-serif mt-2 text-slate-900">{title}</h1>
      {description && (
        <p className="mt-1 max-w-3xl text-base leading-relaxed text-slate-400">
          {description}
        </p>
      )}
    </section>
  );
}

export function BoardPanel({
  children,
  className,
  as: Component = "section",
  ...props
}: {
  children: ReactNode;
  className?: string;
  as?: "section" | "div";
} & HTMLAttributes<HTMLElement>) {
  return (
    <Component
      className={cn(
        "py-6",
        "rounded-lg",
        className,
      )}
      {...props}
    >
      {children}
    </Component>
  );
}

export function KpiCard({
  href,
  icon: IconComponent,
  label,
  value,
  trend,
  tone = "neutral",
  progress = 0,
  className,
}: {
  href?: string;
  icon: Icon;
  label: string;
  value: ReactNode;
  trend?: ReactNode;
  tone?: "brand" | "success" | "warning" | "data" | "neutral";
  progress?: number;
  className?: string;
}) {
  const tones = {
    brand: {
      card: "bg-[#f8eb62]",
      icon: "bg-[#151936] text-white",
      text: "text-[#151936]",
      track: "bg-[#e6d220]",
      bar: "bg-[#151936]",
    },
    success: {
      card: "bg-[#e6f4ea]",
      icon: "bg-[#1b431e] text-white",
      text: "text-[#1b431e]",
      track: "bg-[#c6e0c7]",
      bar: "bg-emerald-600",
    },
    warning: {
      card: "bg-[#fcf0e4]",
      icon: "bg-[#5e2b17] text-white",
      text: "text-[#5e2b17]",
      track: "bg-[#f2d8c9]",
      bar: "bg-amber-600",
    },
    data: {
      card: "bg-[#eef2f6]",
      icon: "bg-[#24354a] text-white",
      text: "text-[#24354a]",
      track: "bg-[#d2dde8]",
      bar: "bg-[#5a7c9f]",
    },
    neutral: {
      card: "bg-white",
      icon: "bg-[#151936] text-white",
      text: "text-[#151936]",
      track: "bg-slate-100",
      bar: "bg-[#151936]",
    },
  }[tone];

  const content = (
    <div
      className={cn(
        "group relative flex h-[155px] cursor-pointer flex-col justify-between overflow-hidden rounded-lg p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md",
        tones.card,
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <div className={cn("flex size-[22px] items-center justify-center rounded-full", tones.icon)}>
          <IconComponent size={13} stroke={2.5} />
        </div>
        <span className={cn("text-base font-normal tracking-wide", tones.text)}>{label}</span>
        {href && (
          <IconArrowUpRight
            size={12}
            className={cn("ml-auto opacity-0 transition-opacity group-hover:opacity-100", tones.text)}
          />
        )}
      </div>
      <div className="mb-3 mt-auto flex items-end justify-between">
        <span className={cn("font-mono text-[32px] font-medium leading-none tracking-normal", tones.text)}>
          {value}
        </span>
        {trend && <span className={cn("mb-0.5 text-sm font-medium", tones.text)}>{trend}</span>}
      </div>
      <div className={cn("h-[4px] w-full overflow-hidden rounded-full", tones.track)}>
        <div
          className={cn("h-full rounded-full transition-all duration-1000", tones.bar)}
          style={{ width: `${Math.max(0, Math.min(progress, 100))}%` }}
        />
      </div>
    </div>
  );

  if (!href) {
    return content;
  }

  return (
    <Link href={href} className="animate-fade-in-up">
      {content}
    </Link>
  );
}

export function PaginationControls({
  currentPage,
  totalPages,
  onPageChange,
  label,
  totalItems,
  pageSize,
  itemLabel = "items",
  className,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  label?: ReactNode;
  totalItems?: number;
  pageSize?: number;
  itemLabel?: string;
  className?: string;
}) {
  if (totalPages <= 1) return null;

  const startItem = pageSize ? (currentPage - 1) * pageSize + 1 : null;
  const endItem = pageSize && totalItems ? Math.min(currentPage * pageSize, totalItems) : null;

  return (
    <div
      className={cn(
        "bg-white border border-slate-200/80 rounded-2xl p-3 shadow-[0_2px_15px_rgb(0,0,0,0.02)] flex flex-col sm:flex-row items-center justify-between gap-3 mt-3",
        className
      )}
    >
      <div className="text-xs font-mono text-slate-600 font-medium">
        {label ? (
          label
        ) : startItem && endItem && totalItems ? (
          <>
            Showing <span className="text-slate-900 font-medium">{startItem}</span>–
            <span className="text-slate-900 font-medium">{endItem}</span> of{" "}
            <span className="text-slate-900 font-medium">{totalItems}</span> {itemLabel}
          </>
        ) : (
          <>
            Page <span className="text-slate-900 font-medium">{currentPage}</span> of{" "}
            <span className="text-slate-900 font-medium">{totalPages}</span>
          </>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          aria-label="Previous page"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          className="h-8 px-3 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-2xs flex items-center gap-1 cursor-pointer"
        >
          <IconChevronLeft size={14} /> Prev
        </button>

        <div className="flex items-center gap-1 px-1">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((pg) => (
            <button
              key={pg}
              type="button"
              onClick={() => onPageChange(pg)}
              className={cn(
                "size-8 rounded-xl text-xs font-mono font-medium transition-all cursor-pointer",
                pg === currentPage
                  ? "bg-[#151936] text-white shadow-2xs"
                  : "text-slate-600 hover:bg-slate-100"
              )}
            >
              {pg}
            </button>
          ))}
        </div>

        <button
          type="button"
          aria-label="Next page"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          className="h-8 px-3 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-2xs flex items-center gap-1 cursor-pointer"
        >
          Next <IconChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}

// ─── Unified Basic UI/UX Component Exports ────────────────────────────────────
export { Avatar } from "./avatar";
export { Badge, MarketBadge } from "./badge";
export { Button } from "./button";
export { CalendarModal } from "./calendar-modal";
export { Card } from "./card";
export { ConfirmDialog } from "./confirm-dialog";
export { Drawer } from "./drawer";
export { DropdownMenu, DropdownItem } from "./dropdown-menu";
export { EmptyState } from "./empty-state";
export { IconButton } from "./icon-button";
export { LoadingSpinner } from "./loading-spinner";
export { Modal } from "./modal";
export { SkeletonBlock } from "./skeleton-block";
export { ToastProvider, useToast } from "./toast-provider";

// ─── Unified Layout and Widget Component Exports ──────────────────────────────
export { GlobalChatWidget } from "../layout/global-chat-widget";
export { SunlandNav } from "../layout/sunland-nav";
export { TopNav } from "../layout/top-nav";
export { MobileBottomNav, MobileNavigationDrawer } from "../layout/mobile-nav";

export function ProfileDrawerRow({
  icon: IconComponent,
  label,
  value,
  mono = false,
  valueClass,
}: {
  icon: React.ComponentType<{ size?: number; className?: string; stroke?: number }>;
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center gap-3 bg-white border border-slate-100 rounded-2xl p-3 px-4 shadow-[0_2px_10px_rgb(0,0,0,0.02)]">
      <span className="size-9 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 shrink-0">
        <IconComponent size={16} stroke={1.5} />
      </span>
      <span className="flex-1 body-sm text-slate-400">{label}</span>
      <span className={cn("body-sm font-medium", mono && "mono-data", valueClass || "text-slate-900")}>
        {value}
      </span>
    </div>
  );
}

