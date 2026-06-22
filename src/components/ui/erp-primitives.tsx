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
        <p className="mt-1 max-w-3xl text-base leading-relaxed text-slate-500">
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
        "border border-slate-100 bg-white p-6 shadow-sm transition-all hover:shadow-md",
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
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  label: ReactNode;
}) {
  return (
    <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-3">
      <p className="text-sm font-medium text-slate-400">{label}</p>
      <div className="flex items-center gap-1">
        <button
          aria-label="Previous page"
          className="flex size-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30"
          disabled={currentPage === 1}
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        >
          <IconChevronLeft size={16} />
        </button>
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
          <button
            key={page}
            className={cn(
              "flex size-8 items-center justify-center rounded-lg text-base font-medium transition-colors",
              page === currentPage
                ? "bg-[#151936] text-white"
                : "text-slate-500 hover:bg-slate-100",
            )}
            onClick={() => onPageChange(page)}
          >
            {page}
          </button>
        ))}
        <button
          aria-label="Next page"
          className="flex size-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30"
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
        >
          <IconChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

// ─── Unified Basic UI/UX Component Exports ────────────────────────────────────
export { Avatar } from "./avatar";
export { Badge } from "./badge";
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

