"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  formatDistanceToNowStrict,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
  addYears,
  subYears,
} from "date-fns";
import {
  IconBell,
  IconBuildingCommunity,
  IconCalendar,
  IconCalendarDollar,
  IconChartBar,
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconCircleCheckFilled,
  IconClock,
  IconFileAnalytics,
  IconMenu2,
  IconPlus,
  IconSearch,
  IconSettings,
  IconTool,
  IconTrash,
  IconUsersGroup,
  IconX,
  IconUser,
  IconLogout,
  IconShieldLock,
  type Icon,
  IconChevronDown,
  IconInfoCircle,
  IconAlertTriangle,
} from "@tabler/icons-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownItem } from "@/components/ui/dropdown-menu";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { cn } from "@/lib/utils/cn";
import { useUIStore, type ModalType } from "@/store/ui";
import { getEntityById } from "@/data/entities";
import { getActiveNavItem, navSections } from "@/components/layout/nav-model";
import { CommandPalette } from "./command-palette";

// ─── Types ────────────────────────────────────────────────────────────────────

type NotificationTone = "info" | "success" | "warning";

interface Notification {
  id: string;
  tone: NotificationTone;
  title: string;
  body: string;
  time: string;
  read: boolean;
}

// Matches the real /api/notifications response shape (notifications table) -
// `type` is a free-text dotted string ("approval.pending", "complaint.assigned",
// "manual.notify", etc.), not a closed enum.
interface ApiNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  href: string | null;
  createdAt: string;
  readAt: string | null;
}

function toneForType(type: string): NotificationTone {
  const prefix = type.split(".")[0];
  if (prefix === "approval" || prefix === "complaint") return "warning";
  return "info";
}

function mapApiNotification(n: ApiNotification): Notification {
  return {
    id: n.id,
    tone: toneForType(n.type),
    title: n.title,
    body: n.body,
    time: formatDistanceToNowStrict(new Date(n.createdAt), { addSuffix: true }),
    read: n.readAt !== null,
  };
}

interface QuickAction {
  icon: Icon;
  label: string;
  shortcut?: string;
  href?: string;
  action?: ModalType;
}

// ─── Mock data ────────────────────────────────────────────────────────────────

const QUICK_ACTIONS: QuickAction[] = [
  { icon: IconBuildingCommunity, label: "New Property", shortcut: "P", action: "create-property" },
  { icon: IconUsersGroup, label: "New Contact", shortcut: "C", href: "/admin/contacts" },
  { icon: IconChartBar, label: "New Lead", shortcut: "L", href: "/admin/pipeline" },
  { icon: IconCalendarDollar, label: "New Lease", shortcut: "E", href: "/admin/leases" },
  { icon: IconTool, label: "Maintenance", shortcut: "M", href: "/admin/maintenance" },
  { icon: IconFileAnalytics, label: "New Report", shortcut: "R", href: "/admin/reports" },
];

interface ApiEvent {
  id: string;
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string;
  type: "internal" | "external" | "legal" | "maintenance";
  location: string | null;
}

const EVENT_COLORS: Record<ApiEvent["type"], string> = {
  internal: "bg-[var(--primary)] shadow-[0_0_8px_rgba(14,165,233,0.6)]",
  external: "bg-[var(--success)] shadow-[0_0_8px_rgba(16,185,129,0.6)]",
  legal: "bg-[var(--warning)] shadow-[0_0_8px_rgba(245,158,11,0.6)]",
  maintenance: "bg-[var(--error)] shadow-[0_0_8px_rgba(243,62,98,0.6)]",
};

const EVENT_BADGE_TONE: Record<ApiEvent["type"], "primary" | "success" | "warning" | "risk"> = {
  internal: "primary",
  external: "success",
  legal: "warning",
  maintenance: "risk",
};

// ─── Hook: panel (click-outside + escape) ─────────────────────────────────────

function usePanel(ref: React.RefObject<HTMLElement | null>) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    function onPointer(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, ref, close]);

  return { open, setOpen, close };
}

// ─── Animation variants ────────────────────────────────────────────────────────

const panelVariants = {
  hidden: { opacity: 0, y: -6, scale: 0.97 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.18, ease: [0.16, 1, 0.3, 1] as const } },
  exit: { opacity: 0, y: -4, scale: 0.97, transition: { duration: 0.13 } },
};

// ─── Tone colours ──────────────────────────────────────────────────────────────

const toneConfig: Record<
  NotificationTone,
  { icon: Icon; bg: string; badgeTone: "primary" | "warning" | "success" }
> = {
  info: {
    icon: IconInfoCircle,
    bg: "bg-blue-50/80 text-blue-600 border-blue-100/50 shadow-sm",
    badgeTone: "primary",
  },
  warning: {
    icon: IconAlertTriangle,
    bg: "bg-amber-50/80 text-amber-600 border-amber-100/50 shadow-sm",
    badgeTone: "warning",
  },
  success: {
    icon: IconCircleCheckFilled,
    bg: "bg-emerald-50/80 text-emerald-600 border-emerald-100/50 shadow-sm",
    badgeTone: "success",
  },
};

// ─── Shared panel shell ────────────────────────────────────────────────────────
// backdrop-blur only works visually when bg has real transparency.
// Using bg-white with strong shadow gives a crisp, premium feel without blur artefacts.

function PanelShell({
  children,
  align = "right",
  width = "w-80",
  className,
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  width?: string;
  className?: string;
}) {
  return (
    <motion.div
      variants={panelVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className={cn(
        "absolute top-full z-50 mt-2 overflow-hidden",
        "rounded-2xl border border-slate-200/70 bg-white",
        "shadow-[0_8px_32px_rgba(0,0,0,0.10),0_2px_8px_rgba(0,0,0,0.06),0_0_0_1px_rgba(0,0,0,0.02)]",
        align === "right" ? "right-0" : "left-0",
        width,
        className,
      )}
    >
      {children}
    </motion.div>
  );
}

// ─── Top-bar icon button ──────────────────────────────────────────────────────

function NavActionBtn({
  label,
  children,
  active,
  badge,
  onClick,
}: {
  label: string;
  children: React.ReactNode;
  active?: boolean;
  badge?: number;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        "focus-ring relative flex size-9 items-center justify-center rounded-xl transition-colors",
        active
          ? "bg-slate-100 text-slate-800"
          : "text-slate-400 hover:bg-slate-100/80 hover:text-slate-700",
      )}
    >
      {children}
      {badge != null && badge > 0 && (
        <span className="absolute right-1.5 top-1.5 size-[6px] rounded-full bg-red-500 ring-[1.5px] ring-white" />
      )}
    </button>
  );
}

// ─── Notifications panel ───────────────────────────────────────────────────────

function NotificationsPanel({
  onClose,
  items,
  loading,
  onMarkRead,
  onMarkAllRead,
}: {
  onClose: () => void;
  items: Notification[];
  loading: boolean;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
}) {
  const pathname = usePathname();
  const portalPrefix = pathname.startsWith("/fin") ? "/fin" : "/admin";
  const unread = items.filter((n) => !n.read).length;

  return (
    <PanelShell width="w-96">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100/60 px-5 py-4">
        <div className="flex items-center gap-2.5">
          <span className="text-sm font-medium text-slate-800">Notifications</span>
          {unread > 0 && (
            <Badge tone="risk" className="px-2 py-0.5 text-xs font-medium tracking-wide">
              {unread} New
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {unread > 0 && (
            <button
              type="button"
              onClick={onMarkAllRead}
              className="text-xs font-medium text-slate-400 transition-colors hover:text-slate-700 flex items-center gap-1"
            >
              <IconCheck size={12} stroke={2} />
              Mark all read
            </button>
          )}
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex size-6 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100"
          >
            <IconX size={14} stroke={2} aria-hidden />
          </button>
        </div>
      </div>

      {/* List */}
      <div className="max-h-[22rem] overflow-y-auto p-2 space-y-1 [scrollbar-width:thin]">
        {loading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner size="md" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400">
            <IconCircleCheckFilled size={32} className="mb-3 text-slate-200" aria-hidden />
            <p className="text-sm font-medium text-slate-500">You&apos;re all caught up</p>
          </div>
        ) : (
          items.map((n) => {
            const toneData = toneConfig[n.tone];
            const IconComponent = toneData.icon;
            return (
              <button
                key={n.id}
                type="button"
                onClick={() => onMarkRead(n.id)}
                className={cn(
                  "group relative flex w-full gap-3 rounded-xl p-3 text-left transition-all border border-transparent",
                  !n.read
                    ? "bg-slate-50/70 border-slate-100/50 hover:bg-slate-50"
                    : "hover:bg-slate-50/60"
                )}
              >
                {/* Left Icon with pulsating unread dot */}
                <div className="relative shrink-0 mt-0.5">
                  <span className={cn(
                    "flex size-8 items-center justify-center rounded-[10px] border transition-all",
                    toneData.bg
                  )}>
                    <IconComponent size={14} stroke={2} aria-hidden />
                  </span>
                  {!n.read && (
                    <span className="absolute -top-1 -right-1 flex size-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full size-2 bg-blue-500 border border-white"></span>
                    </span>
                  )}
                </div>

                {/* Body Details */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className={cn(
                      "text-sm transition-colors group-hover:text-slate-900 leading-snug",
                      !n.read ? "text-slate-800 font-medium" : "text-slate-600 font-medium"
                    )}>
                      {n.title}
                    </p>
                    <span className="text-xs font-mono font-medium text-slate-400 shrink-0 mt-0.5">
                      {n.time}
                    </span>
                  </div>
                  <p className="text-xs mt-1 text-slate-500 line-clamp-2 leading-relaxed">
                    {n.body}
                  </p>
                </div>

                {/* Inline Mark as Read Action on Hover */}
                {!n.read && (
                  <div className="absolute right-3 bottom-2.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-xxs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded border border-blue-100 transition-colors">
                      Mark read
                    </span>
                  </div>
                )}
              </button>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-slate-100/60 p-2">
        <Link
          href={`${portalPrefix}/notifications`}
          onClick={onClose}
          className="flex items-center justify-center w-full gap-1.5 rounded-xl bg-slate-50/50 py-2.5 text-xs font-medium text-[var(--sidebar)] transition-colors hover:bg-slate-50 hover:text-slate-900"
        >
          View all notifications
          <IconChevronRight size={14} stroke={2} aria-hidden />
        </Link>
      </div>
    </PanelShell>
  );
}

// ─── Quick create panel ───────────────────────────────────────────────────────

function QuickCreatePanel({ onClose }: { onClose: () => void }) {
  return (
    <PanelShell width="w-64" align="right">
      <div className="border-b border-slate-100/60 px-5 py-4">
        <p className="text-sm font-medium text-slate-800">Quick Create</p>
        <p className="text-xs text-slate-400 mt-0.5">Start something new</p>
      </div>
      <div className="p-2 space-y-0.5">
        {QUICK_ACTIONS.map((action) => {
          const content = (
            <>
              <span className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-white border border-slate-100 text-slate-500 shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition-all group-hover:border-slate-200 group-hover:text-slate-800 group-hover:shadow-sm">
                <action.icon size={14} stroke={2} aria-hidden />
              </span>
              <span className="text-sm font-medium flex-1 text-slate-600 text-left transition-colors group-hover:text-slate-900">{action.label}</span>
              {action.shortcut && (
                <kbd className="text-xxs select-none rounded-[6px] border border-slate-200/80 bg-white px-1.5 py-0.5 font-mono font-medium text-slate-400 shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition-colors group-hover:border-slate-300 group-hover:text-slate-500">
                  ⌘{action.shortcut}
                </kbd>
              )}
            </>
          );
          const className = "group flex w-full items-center gap-3 rounded-xl px-2.5 py-2 transition-all hover:bg-slate-50/80";

          if (action.action) {
            return (
              <button
                key={action.label}
                onClick={() => {
                  useUIStore.getState().openModal(action.action!);
                  onClose();
                }}
                className={className}
              >
                {content}
              </button>
            );
          }

          return (
            <Link
              key={action.href}
              href={action.href!}
              onClick={onClose}
              className={className}
            >
              {content}
            </Link>
          );
        })}
      </div>
    </PanelShell>
  );
}

// ─── Calendar panel ───────────────────────────────────────────────────────────

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

function CalendarPanel({ onClose }: { onClose: () => void }) {
  const [events, setEvents] = useState<ApiEvent[]>([]);
  const [month, setMonth] = useState(new Date());
  const [viewMode, setViewMode] = useState<"monthly" | "yearly">("monthly");
  const [selected, setSelected] = useState(new Date());
  const [isAdding, setIsAdding] = useState(false);
  const [form, setForm] = useState<Partial<{ title: string; time: string; type: ApiEvent["type"]; description: string }>>({ title: "", time: "", type: "internal", description: "" });

  const loadEvents = useCallback(() => {
    fetch("/api/scheduling/events?entityId=group&scope=all")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.events)) setEvents(data.events);
      })
      .catch((e) => console.error(e));
  }, []);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const selectedStr = format(selected, "yyyy-MM-dd");
  const dayEvents = events.filter((e) => {
    const d = new Date(e.startsAt);
    return d.getFullYear() === selected.getFullYear() && d.getMonth() === selected.getMonth() && d.getDate() === selected.getDate();
  }).sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());

  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  // Build calendar grid
  const cells: Date[] = [];
  let cursor = calStart;
  while (cursor <= calEnd) { cells.push(cursor); cursor = addDays(cursor, 1); }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title?.trim() || !form.time || !form.type) return;

    const startsAt = new Date(`${selectedStr}T${form.time}:00`);
    const endsAt = new Date(startsAt.getTime() + 60 * 60_000); // Default 1 hour

    try {
      const res = await fetch("/api/scheduling/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityId: "group",
          title: form.title,
          description: form.description || undefined,
          type: form.type,
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
          location: "TBD",
          attendees: [],
        }),
      });
      if (!res.ok) throw new Error("Failed to schedule event");
      const { event } = await res.json();
      setEvents((prev) => [...prev, event]);
      setForm({ title: "", time: "", type: "internal", description: "" });
      setIsAdding(false);
    } catch (err) {
      console.error(err);
    }
  }

  async function deleteEvent(id: string) {
    try {
      await fetch(`/api/scheduling/events?id=${id}`, { method: "DELETE" });
      setEvents((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <PanelShell width="w-[44rem]" align="right" className="overflow-hidden !rounded-[24px]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100/60 bg-white px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex size-8 items-center justify-center rounded-xl bg-slate-50 text-slate-500 shadow-sm ring-1 ring-slate-200/50">
            <IconCalendar size={16} aria-hidden />
          </div>
          <span className="text-lg font-normal text-slate-800 tracking-tight">Calendar</span>
        </div>
        <button
          type="button"
          aria-label="Close calendar"
          onClick={onClose}
          className="flex size-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
        >
          <IconX size={18} aria-hidden />
        </button>
      </div>

      <div className="flex h-[420px]">
        {/* Left - mini calendar */}
        <div className="w-[55%] border-r border-slate-100/60 bg-white px-6 py-5 flex flex-col">
          {/* Month nav */}
          <div className="mb-6 flex items-center justify-between px-2">
            <button
              type="button"
              aria-label="Previous"
              onClick={() => setMonth(viewMode === "monthly" ? subMonths(month, 1) : subYears(month, 1))}
              className="flex size-8 items-center justify-center rounded-full text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-800"
            >
              <IconChevronLeft size={18} aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => setViewMode(viewMode === "monthly" ? "yearly" : "monthly")}
              className="text-sm font-medium text-slate-800 tracking-wide hover:text-[var(--sidebar)] transition-colors px-2 py-1 rounded-md hover:bg-slate-50"
            >
              {viewMode === "monthly" ? format(month, "MMMM yyyy") : format(month, "yyyy")}
            </button>
            <button
              type="button"
              aria-label="Next"
              onClick={() => setMonth(viewMode === "monthly" ? addMonths(month, 1) : addYears(month, 1))}
              className="flex size-8 items-center justify-center rounded-full text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-800"
            >
              <IconChevronRight size={18} aria-hidden />
            </button>
          </div>

          {viewMode === "monthly" ? (
            <>
              {/* Day labels */}
              <div className="mb-4 grid grid-cols-7 gap-1">
                {WEEKDAYS.map((d) => (
                  <div key={d} className="text-center text-ms font-medium uppercase tracking-widest text-slate-400">
                    {d}
                  </div>
                ))}
              </div>

              {/* Cells */}
              <div className="grid grid-cols-7 gap-y-2 gap-x-1">
                {cells.map((day) => {
                  const dateStr = format(day, "yyyy-MM-dd");
                  const hasEvents = events.some((e) => {
                    const d = new Date(e.startsAt);
                    return d.getFullYear() === day.getFullYear() && d.getMonth() === day.getMonth() && d.getDate() === day.getDate();
                  });
                  const isSelected = isSameDay(day, selected);
                  const isToday = isSameDay(day, new Date());
                  const isCurrentM = isSameMonth(day, month);

                  return (
                    <button
                      key={dateStr}
                      type="button"
                      aria-label={format(day, "MMMM d yyyy")}
                      onClick={() => { setSelected(day); setIsAdding(false); }}
                      className={cn(
                        "relative mx-auto flex size-9 flex-col items-center justify-center rounded-full transition-all duration-200",
                        isSelected
                          ? "bg-[var(--sidebar)] text-white shadow-md shadow-slate-900/10 scale-110"
                          : isToday
                            ? "bg-slate-100/80 text-[var(--sidebar)] font-medium hover:bg-slate-200/60"
                            : isCurrentM
                              ? "text-slate-700 hover:bg-slate-50"
                              : "text-slate-300 hover:bg-slate-50",
                      )}
                    >
                      <span className={cn("text-[13px]", isSelected || isToday ? "font-medium" : "font-normal")}>
                        {format(day, "d")}
                      </span>
                      {hasEvents && (
                        <span className={cn(
                          "absolute bottom-1.5 size-[3.5px] rounded-full",
                          isSelected ? "bg-white/90" : "bg-[var(--sidebar)]/60",
                        )} />
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="grid grid-cols-3 gap-3 mt-2 flex-1 content-start">
              {Array.from({ length: 12 }).map((_, i) => {
                const m = new Date(month.getFullYear(), i, 1);
                const isCurrentMonth = isSameMonth(m, new Date());
                const isSelectedMonth = isSameMonth(m, month);
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => { setMonth(m); setViewMode("monthly"); }}
                    className={cn(
                      "flex h-[3.25rem] items-center justify-center rounded-[14px] text-[13px] transition-all",
                      isSelectedMonth
                        ? "bg-[var(--sidebar)] text-white shadow-md shadow-slate-900/10 font-medium scale-105"
                        : isCurrentMonth
                          ? "bg-slate-100 text-[var(--sidebar)] font-medium hover:bg-slate-200/60"
                          : "text-slate-600 hover:bg-slate-50"
                    )}
                  >
                    {format(m, "MMM")}
                  </button>
                );
              })}
            </div>
          )}

          {/* Today shortcut */}
          <div className="mt-auto border-t border-slate-100/60 pt-4">
            <button
              type="button"
              onClick={() => { setMonth(new Date()); setSelected(new Date()); }}
              className="flex items-center gap-2 text-[13px] font-medium text-slate-500 transition-colors hover:text-[var(--sidebar)]"
            >
              <span className="flex size-5 items-center justify-center rounded-full bg-slate-100">
                <span className="size-1.5 rounded-full bg-[var(--sidebar)]" />
              </span>
              Jump to today
            </button>
          </div>
        </div>

        {/* Right - events for selected day */}
        <div className="flex w-[45%] flex-col bg-slate-50/50 px-6 py-5">
          <div className="mb-5 flex items-start justify-between">
            <div className="flex flex-col gap-1">
              <p className="text-base font-medium text-slate-800">
                {format(selected, "EEEE, MMMM d")}
              </p>
              <p className="text-xs font-medium text-slate-400">
                {dayEvents.length === 0 ? "No events scheduled" : `${dayEvents.length} event${dayEvents.length > 1 ? "s" : ""} today`}
              </p>
            </div>
            {!isAdding && (
              <button
                type="button"
                aria-label="Add event"
                onClick={() => setIsAdding(true)}
                className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white text-[var(--sidebar)] shadow-sm ring-1 ring-slate-200/60 transition-all hover:bg-[var(--sidebar)] hover:text-white hover:ring-transparent"
              >
                <IconPlus size={18} aria-hidden />
              </button>
            )}
          </div>

          {/* Events list */}
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pb-2 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-200">
            {dayEvents.length === 0 && !isAdding ? (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <div className="flex size-14 items-center justify-center rounded-full bg-slate-100/80 text-slate-300 mb-4 ring-1 ring-slate-200/50">
                  <IconCalendar size={24} stroke={1.5} aria-hidden />
                </div>
                <p className="text-sm font-medium text-slate-600">Your day is clear</p>
                <p className="text-[13px] text-slate-400 mt-1 max-w-[180px]">Enjoy the free time or schedule a new event.</p>
              </div>
            ) : (
              dayEvents.map((ev) => {
                const timeStr = new Date(ev.startsAt).toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" });
                return (
                  <div
                    key={ev.id}
                    className="group relative flex items-start gap-3.5 bg-white my-2"
                  >
                    <span className={cn("mt-[6px] size-2.5 shrink-0 rounded-full", EVENT_COLORS[ev.type])} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] font-medium text-slate-800 leading-snug">{ev.title}</p>
                      <p className="mt-1.5 flex items-center gap-1.5 font-mono text-ms font-medium tracking-tight text-slate-400">
                        <IconClock size={13} aria-hidden />
                        {timeStr}
                      </p>
                      {ev.description && (
                        <p className="mt-2 text-[13px] leading-relaxed text-slate-500 line-clamp-2">{ev.description}</p>
                      )}
                      <div className="mt-3 flex items-center">
                        <Badge tone={EVENT_BADGE_TONE[ev.type]}>
                          {ev.type === "internal" ? "Internal Sync" : ev.type === "external" ? "Client Meeting" : ev.type === "legal" ? "Legal Deadline" : "Maintenance"}
                        </Badge>
                      </div>
                    </div>
                    <button
                      type="button"
                      aria-label="Delete event"
                      onClick={() => deleteEvent(ev.id)}
                      className="absolute right-3 top-3 flex size-7 items-center justify-center rounded-full bg-slate-50 text-slate-300 opacity-0 transition-all hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
                    >
                      <IconTrash size={14} aria-hidden />
                    </button>
                  </div>
                )
              })
            )}
          </div>

          {/* Add event form */}
          <AnimatePresence>
            {isAdding && (
              <motion.form
                initial={{ opacity: 0, scale: 0.96, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 10 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                onSubmit={handleAdd}
                className="mt-3 flex flex-col gap-3 rounded-[20px] bg-white p-5 shadow-[0_8px_30px_rgb(0,0,0,0.08)] ring-1 ring-slate-200/60"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-slate-800">Create Event</span>
                  <button type="button" onClick={() => setIsAdding(false)} className="flex size-7 items-center justify-center rounded-full bg-slate-50 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700">
                    <IconX size={14} aria-hidden />
                  </button>
                </div>

                <input
                  autoFocus
                  required
                  placeholder="Event title"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full rounded-xl border border-slate-200/80 bg-slate-50/50 px-3.5 py-2.5 text-[14px] font-medium text-slate-800 placeholder:text-slate-400 placeholder:font-normal transition-all focus:border-slate-300 focus:bg-white focus:outline-none focus:ring-4 focus:ring-slate-100/80"
                />

                <div className="flex gap-3">
                  <input
                    type="time"
                    required
                    value={form.time}
                    onChange={(e) => setForm({ ...form, time: e.target.value })}
                    className="w-full flex-1 rounded-xl border border-slate-200/80 bg-slate-50/50 px-3 py-2.5 text-[13px] font-medium text-slate-700 transition-all focus:border-slate-300 focus:bg-white focus:outline-none focus:ring-4 focus:ring-slate-100/80"
                  />
                  <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value as ApiEvent["type"] })}
                    className="w-full flex-1 rounded-xl border border-slate-200/80 bg-slate-50/50 px-3 py-2.5 text-[13px] font-medium text-slate-700 transition-all focus:border-slate-300 focus:bg-white focus:outline-none focus:ring-4 focus:ring-slate-100/80"
                  >
                    <option value="internal">Internal Sync</option>
                    <option value="external">External Meeting</option>
                    <option value="legal">Legal Deadline</option>
                    <option value="maintenance">Maintenance</option>
                  </select>
                </div>

                <textarea
                  placeholder="Notes (optional)"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2}
                  className="w-full resize-none rounded-xl border border-slate-200/80 bg-slate-50/50 px-3.5 py-2.5 text-[13px] text-slate-700 placeholder:text-slate-400 transition-all focus:border-slate-300 focus:bg-white focus:outline-none focus:ring-4 focus:ring-slate-100/80"
                />

                <div className="mt-2 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsAdding(false)}
                    className="rounded-full px-4 py-2 text-[13px] font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex items-center gap-1.5 rounded-full bg-[var(--sidebar)] px-5 py-2 text-[13px] font-medium text-white shadow-sm transition-all hover:bg-slate-800 hover:shadow"
                  >
                    <IconCheck size={14} aria-hidden />
                    Save Event
                  </button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </div>
    </PanelShell>
  );
}

// ─── Search bar ───────────────────────────────────────────────────────────────

function SearchBar() {
  const openSearch = useUIStore((s) => s.openSearch);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        openSearch();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [openSearch]);

  return (
    <button
      type="button"
      onClick={openSearch}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      className={cn(
        "group relative flex w-full max-w-[22rem] cursor-pointer items-center gap-2.5 rounded-xl px-3.5 py-1.5 text-left",
        "border transition-all duration-300",
        focused
          ? "border-slate-300 bg-white shadow-sm ring-4 ring-slate-100"
          : "border-slate-200/60 bg-slate-50/50 hover:bg-white hover:border-slate-200 hover:shadow-[0_2px_8px_rgba(0,0,0,0.04)]",
      )}
    >
      <span className="sr-only">Search clients, properties, payments</span>
      <IconSearch
        aria-hidden
        size={14}
        stroke={1.5}
        className={cn("shrink-0 transition-colors", focused ? "text-slate-600" : "text-slate-400 group-hover:text-slate-500")}
      />
      <span className={cn("text-sm flex-1 transition-colors", focused ? "text-slate-700" : "text-slate-400 group-hover:text-slate-500")}>
        Search anything...
      </span>
      <kbd
        className={cn(
          "pointer-events-none select-none rounded-[6px] border px-1.5 py-0.5 text-xxs font-medium tracking-widest transition-opacity shadow-[0_1px_1px_rgba(0,0,0,0.02)]",
          focused ? "opacity-0" : "border-slate-200 bg-white text-slate-400 group-hover:border-slate-300 group-hover:text-slate-500",
        )}
      >
        ⌘K
      </kbd>
    </button>
  );
}

// ─── Entity Badge Context ──────────────────────────────────────────────────────

function EntityBadge() {
  const activeEntityId = useUIStore((s) => s.activeEntityId);
  const activeEntity = getEntityById(activeEntityId);

  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition-all hover:bg-slate-100">
      <span className="relative flex size-2 shrink-0 items-center justify-center">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--secondary)] opacity-75" />
        <span className="relative inline-flex size-1.5 rounded-full bg-[var(--secondary)]" />
      </span>
      <span className="text-caption font-medium text-slate-700">{activeEntity.name}</span>
    </div>
  );
}

// ─── Breadcrumb ────────────────────────────────────────────────────────────────

function Breadcrumb() {
  const pathname = usePathname();
  let resolvedPathname = pathname;
  let isMandateDetail = false;
  if (pathname.includes("/mandates/") && !pathname.endsWith("/mandates")) {
    resolvedPathname = "/admin/leases";
    isMandateDetail = true;
  }

  const activeItem = getActiveNavItem(resolvedPathname);
  const activeSection = navSections.find((s) => s.items.some((i) => i.href === activeItem?.href));
  if (!activeItem) return null;
  const isFlat = activeSection && activeSection.items.length === 1;

  let dynamicLabel: string | null = null;
  if (isMandateDetail) {
    dynamicLabel = "Mandate Details";
  } else if (pathname.includes("/properties/") && !pathname.endsWith("/properties")) {
    dynamicLabel = "Property Details";
  } else if (pathname.includes("/leases/") && !pathname.endsWith("/leases")) {
    dynamicLabel = "Lease Details";
  } else if (pathname.includes("/valuations/") && !pathname.endsWith("/valuations")) {
    dynamicLabel = "Valuation Details";
  }

  return (
    <nav aria-label="Breadcrumb" className="hidden items-center gap-1.5 xl:flex">
      {activeSection && !isFlat && (
        <>
          <span className="text-sm font-medium text-slate-400">{activeSection.label}</span>
          <IconChevronRight size={12} className="text-slate-300" aria-hidden />
        </>
      )}
      {dynamicLabel ? (
        <Link
          href={activeItem.href}
          className="text-sm font-medium text-slate-400 hover:text-slate-900 transition-colors"
        >
          {activeItem.label}
        </Link>
      ) : (
        <span className="text-sm font-medium text-slate-700">{activeItem.label}</span>
      )}
      {dynamicLabel && (
        <>
          <IconChevronRight size={12} className="text-slate-300" aria-hidden />
          <span className="text-sm font-medium text-slate-700">{dynamicLabel}</span>
        </>
      )}
    </nav>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export function TopNav() {
  const { openMobileNav } = useUIStore();
  const router = useRouter();
  const pathname = usePathname();
  const portalPrefix = pathname.startsWith("/fin") ? "/fin" : "/admin";

  const [currentUser, setCurrentUser] = useState({
    name: "Paul Amos",
    role: "ceo",
    avatarUrl: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=80&h=80&fit=crop&crop=face",
  });

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data?.user) {
          setCurrentUser({
            name: data.user.name || "Paul Amos",
            role: data.user.role || "ceo",
            avatarUrl: data.user.avatarUrl || "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=80&h=80&fit=crop&crop=face",
          });
        }
      })
      .catch(() => { });
  }, []);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch { }
    window.location.href = "/login";
  };

  const notifRef = useRef<HTMLDivElement>(null);
  const createRef = useRef<HTMLDivElement>(null);
  const calendarRef = useRef<HTMLDivElement>(null);

  const notif = usePanel(notifRef);
  const create = usePanel(createRef);
  const calendar = usePanel(calendarRef);

  // Real notifications - was previously 100% hardcoded mock data with zero
  // connection to the /api/notifications endpoints that already existed.
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) setNotificationsLoading(true);
    });
    fetch("/api/notifications")
      .then((res) => (res.ok ? res.json() : { notifications: [] }))
      .then((data) => {
        if (active) setNotifications((data.notifications ?? []).map(mapApiNotification));
      })
      .catch(() => {
        if (active) setNotifications([]);
      })
      .finally(() => {
        if (active) setNotificationsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleMarkRead = (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    fetch(`/api/notifications/${id}/read`, { method: "PATCH" }).catch(() => { });
  };

  const handleMarkAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    fetch("/api/notifications/mark-all-read", { method: "POST" }).catch(() => { });
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  function closeAll() { notif.close(); create.close(); calendar.close(); }

  return (
    <header className="sticky top-0 z-20 px-4 md:sm:px-5 lg:px-6 pt-8 pb-12">

      {/* ── Desktop Bar ──────────────────────────────────────── */}
      <div className={cn(
        "hidden items-center gap-3 rounded-xl lg:flex",
        "border border-black/[0.04] bg-white px-3 py-2",
        "shadow-[0_1px_4px_rgba(0,0,0,0.04),0_4px_20px_rgba(0,0,0,0.06)]",
      )}>

        {/* Left: breadcrumb + search */}
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="hidden"><EntityBadge /></div>
          <div className="hidden h-4 w-px bg-slate-200/80" aria-hidden />
          <Breadcrumb />
          <div className="hidden h-4 w-px bg-slate-200/80 xl:block" aria-hidden />
          <SearchBar />
        </div>

        {/* Right: actions */}
        <div className="flex shrink-0 items-center gap-0.5">

          {/* Calendar */}
          <div className="relative" ref={calendarRef}>
            <NavActionBtn
              label="Open calendar"
              active={calendar.open}
              onClick={() => { calendar.setOpen((v) => !v); notif.close(); create.close(); }}
            >
              <IconCalendar size={18} stroke={1.5} aria-hidden />
            </NavActionBtn>
            <AnimatePresence>
              {calendar.open && <CalendarPanel onClose={calendar.close} />}
            </AnimatePresence>
          </div>

          {/* Quick Create */}
          <div className="relative" ref={createRef}>
            <NavActionBtn
              label="Quick create"
              active={create.open}
              onClick={() => { create.setOpen((v) => !v); notif.close(); calendar.close(); }}
            >
              <IconPlus size={18} stroke={1.8} aria-hidden />
            </NavActionBtn>
            <AnimatePresence>
              {create.open && <QuickCreatePanel onClose={create.close} />}
            </AnimatePresence>
          </div>

          {/* Settings */}
          <Link
            href={`${portalPrefix}/settings`}
            aria-label="Settings"
            onClick={closeAll}
            className="focus-ring relative flex size-9 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-slate-100/80 hover:text-slate-700"
          >
            <IconSettings size={18} stroke={1.5} aria-hidden />
          </Link>

          {/* Notifications */}
          <div className="relative" ref={notifRef}>
            <NavActionBtn
              label="Notifications"
              active={notif.open}
              badge={unreadCount}
              onClick={() => { notif.setOpen((v) => !v); create.close(); calendar.close(); }}
            >
              <IconBell size={18} stroke={1.5} aria-hidden />
            </NavActionBtn>
            <AnimatePresence>
              {notif.open && (
                <NotificationsPanel
                  onClose={notif.close}
                  items={notifications}
                  loading={notificationsLoading}
                  onMarkRead={handleMarkRead}
                  onMarkAllRead={handleMarkAllRead}
                />
              )}
            </AnimatePresence>
          </div>

          {/* Divider */}
          <div className="mx-2 h-5 w-px bg-slate-200/80" aria-hidden />

          {/* User dropdown menu - role-aware */}
          <DropdownMenu
            align="right"
            label="User menu"
            trigger={
              <div className="flex items-center gap-3 rounded-xl pl-2 pr-3 py-1.5 hover:bg-slate-100/80 transition-colors cursor-pointer select-none group/profile">
                <Avatar
                  src={currentUser.avatarUrl}
                  fallback={currentUser.name ? currentUser.name.split(" ").map((n) => n[0]).join("") : "DM"}
                  status="online"
                  className="size-9 ring-1 ring-slate-200/60 shadow-sm"
                />
                <div className="hidden flex-col items-start leading-tight xl:flex justify-center">
                  <span className="text-sm font-medium text-slate-800 transition-colors group-hover/profile:text-slate-950">{currentUser.name}</span>
                  <span className="text-xs font-medium uppercase tracking-widest text-slate-500 transition-colors group-hover/profile:text-slate-700 mt-0.5">
                    {currentUser.role.replace(/_/g, " ")}
                  </span>
                </div>
                <IconChevronDown size={14} stroke={2} className="text-slate-400 ml-1 transition-transform group-hover/profile:translate-y-px hidden xl:block" />
              </div>
            }
          >
            {/* Clean White Profile Header */}
            <div className="flex items-center gap-3.5 p-3 mb-1.5 border-b border-slate-100/80 mx-1">
              <Avatar
                src={currentUser.avatarUrl}
                fallback={currentUser.name ? currentUser.name.split(" ").map((n) => n[0]).join("") : "DM"}
                className="size-10 shadow-sm ring-1 ring-slate-200 shrink-0"
              />
              <div className="flex flex-col min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{currentUser.name}</p>
                <div className="mt-1 flex items-center">
                  <Badge tone="neutral" className="text-xs uppercase tracking-widest bg-white border-slate-200/60 shadow-sm">
                    {currentUser.role.replace(/_/g, " ")}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Menu Items */}
            <div className="pb-1 space-y-0.5">
              <DropdownItem onClick={() => window.location.href = `${portalPrefix}/profile`}>
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white border border-slate-100 text-slate-500 shadow-sm transition-all">
                  <IconUser size={14} stroke={2} aria-hidden />
                </span>
                <span className="text-sm font-medium flex-1 text-slate-600 text-left transition-colors ml-1.5">My Profile</span>
              </DropdownItem>
              <DropdownItem onClick={() => window.location.href = `${portalPrefix}/settings`}>
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white border border-slate-100 text-slate-500 shadow-sm transition-all">
                  <IconSettings size={14} stroke={2} aria-hidden />
                </span>
                <span className="text-sm font-medium flex-1 text-slate-600 text-left transition-colors ml-1.5">System Settings</span>
              </DropdownItem>
              <DropdownItem onClick={() => window.location.href = `${portalPrefix}/security`}>
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white border border-slate-100 text-slate-500 shadow-sm transition-all">
                  <IconShieldLock size={14} stroke={2} aria-hidden />
                </span>
                <span className="text-sm font-medium flex-1 text-slate-600 text-left transition-colors ml-1.5">Security & Keys</span>
              </DropdownItem>

              <div className="my-1.5 border-t border-slate-100/80 mx-2" />

              <DropdownItem onClick={handleLogout} variant="danger">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white border border-rose-100 text-rose-500 shadow-sm transition-all">
                  <IconLogout size={14} stroke={2} aria-hidden />
                </span>
                <span className="text-sm font-medium flex-1 text-rose-600 text-left transition-colors ml-1.5">Logout</span>
              </DropdownItem>
            </div>
          </DropdownMenu>
        </div>
      </div>

      {/* ── Mobile Bar ───────────────────────────────────────── */}
      <div className={cn(
        "flex items-center gap-2 rounded-2xl lg:hidden",
        "border border-black/[0.04] bg-white px-2.5 py-2",
        "shadow-[0_1px_4px_rgba(0,0,0,0.04),0_4px_20px_rgba(0,0,0,0.06)]",
      )}>
        <button
          type="button"
          aria-label="Open navigation"
          onClick={openMobileNav}
          className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[var(--sidebar)] text-white transition hover:bg-[var(--sidebar-panel)]"
        >
          <IconMenu2 aria-hidden size={18} />
        </button>

        <button
          type="button"
          onClick={() => useUIStore.getState().openSearch()}
          className="relative min-w-0 flex-1 text-left flex items-center h-9 w-full rounded-xl border border-slate-200/80 bg-slate-50/80 pl-3 pr-3 transition-all hover:bg-white focus:border-slate-300 focus:bg-white focus:outline-none"
        >
          <span className="sr-only">Search Sunland ERP</span>
          <IconSearch
            aria-hidden
            size={13}
            stroke={1.8}
            className="text-slate-400 mr-2 shrink-0"
          />
          <span className="text-caption text-slate-400">Search...</span>
        </button>

        {/* Mobile notifications - navigates to notifications page */}
        <button
          type="button"
          aria-label="Notifications"
          onClick={() => { closeAll(); router.push(`${portalPrefix}/notifications`); }}
          className="relative flex size-9 shrink-0 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-slate-100"
        >
          <IconBell size={18} stroke={1.5} aria-hidden />
          {unreadCount > 0 && (
            <span className="absolute right-1.5 top-1.5 size-[6px] rounded-full bg-red-500 ring-[1.5px] ring-white" />
          )}
        </button>

        {/* Mobile profile avatar - navigates to profile page */}
        <Link
          href={`${portalPrefix}/profile`}
          aria-label="My profile"
          className="shrink-0"
        >
          <Avatar
            src={currentUser.avatarUrl}
            fallback={currentUser.name ? currentUser.name.split(" ").map((n) => n[0]).join("") : "ME"}
            status="online"
            className="size-9"
          />
        </Link>
      </div>

      <CommandPalette />
    </header>
  );
}
