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
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
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
  IconClockHour4,
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
} from "@tabler/icons-react";
import { Avatar } from "@/components/ui/avatar";
import { DropdownMenu, DropdownItem } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils/cn";
import { useUIStore, type ModalType } from "@/store/ui";
import { getEntityById } from "@/data/entities";
import { getActiveNavItem, navSections } from "@/components/layout/nav-model";
import { useCalendarStore, type CalendarEvent } from "@/store/calendar";

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

interface QuickAction {
  icon: Icon;
  label: string;
  shortcut?: string;
  href?: string;
  action?: ModalType;
}

// ─── Mock data ────────────────────────────────────────────────────────────────

const INITIAL_NOTIFICATIONS: Notification[] = [
  { id: "1", tone: "info", title: "New lead assigned", body: "James Kariuki interested in Unit 4B, Westlands", time: "2 min ago", read: false },
  { id: "2", tone: "warning", title: "Lease expiring soon", body: "Acacia Court Unit 12 expires in 14 days", time: "1 hr ago", read: false },
  { id: "3", tone: "success", title: "Payment received", body: "KES 95,000 from Esther Howard - Ref #TXN-4821", time: "3 hr ago", read: true },
  { id: "4", tone: "info", title: "Maintenance request", body: "Unit 7A - Plumbing issue reported by tenant", time: "Yesterday", read: true },
];

const QUICK_ACTIONS: QuickAction[] = [
  { icon: IconBuildingCommunity, label: "New Property", shortcut: "P", action: "create-property" },
  { icon: IconUsersGroup, label: "New Contact", shortcut: "C", href: "/admin/contacts" },
  { icon: IconChartBar, label: "New Lead", shortcut: "L", href: "/admin/pipeline" },
  { icon: IconCalendarDollar, label: "New Lease", shortcut: "E", href: "/admin/leases" },
  { icon: IconTool, label: "Maintenance", shortcut: "M", href: "/admin/maintenance" },
  { icon: IconFileAnalytics, label: "New Report", shortcut: "R", href: "/admin/reports" },
];

const EVENT_COLORS: Record<CalendarEvent["type"], string> = {
  meeting: "bg-[var(--tertiary)]",
  viewing: "bg-[var(--primary)]",
  deadline: "bg-[var(--error)]",
  other: "bg-slate-400",
};

const EVENT_LABEL_COLORS: Record<CalendarEvent["type"], string> = {
  meeting: "text-[var(--tertiary)]",
  viewing: "text-[var(--warning)]",
  deadline: "text-[var(--error)]",
  other: "text-slate-400",
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

const toneRing: Record<NotificationTone, string> = {
  info: "bg-[var(--tertiary)]",
  success: "bg-[var(--success)]",
  warning: "bg-[var(--warning)]",
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

function NotificationsPanel({ onClose }: { onClose: () => void }) {
  const [items, setItems] = useState(INITIAL_NOTIFICATIONS);
  const pathname = usePathname();
  const portalPrefix = pathname.startsWith("/fin") ? "/fin" : "/admin";
  const unread = items.filter((n) => !n.read).length;

  return (
    <PanelShell width="w-[22rem]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-label text-slate-800">Notifications</span>
          {unread > 0 && (
            <span className="text-tiny flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1.5 text-white">
              {unread}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {unread > 0 && (
            <button
              type="button"
              onClick={() => setItems((p) => p.map((n) => ({ ...n, read: true })))}
              className="text-caption rounded-lg px-2 py-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            >
              Mark all read
            </button>
          )}
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex size-6 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100"
          >
            <IconX size={13} aria-hidden />
          </button>
        </div>
      </div>

      {/* List */}
      <div className="max-h-[20rem] overflow-y-auto [scrollbar-width:thin]">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-slate-400">
            <IconCircleCheckFilled size={28} className="mb-2 text-slate-200" aria-hidden />
            <p className="text-caption">You&apos;re all caught up</p>
          </div>
        ) : (
          items.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => setItems((p) => p.map((x) => x.id === n.id ? { ...x, read: true } : x))}
              className={cn(
                "flex w-[calc(100%-16px)] mx-2 gap-3 px-3 py-2.5 mb-1 rounded-xl text-left transition-all border border-transparent",
                !n.read ? "bg-slate-50/80 border-slate-100" : "hover:bg-slate-50 hover:border-slate-100",
              )}
            >
              <span className={cn("mt-[6px] size-[6px] shrink-0 rounded-full transition-opacity", toneRing[n.tone], n.read && "opacity-0")} />
              <div className="min-w-0 flex-1">
                <p className={cn("text-caption leading-snug", n.read ? "text-slate-600 font-medium" : "text-slate-900 font-medium")}>
                  {n.title}
                </p>
                <p className="text-tiny mt-0.5 text-slate-400 line-clamp-2 leading-relaxed">{n.body}</p>
                <p className="text-[10px] mt-1.5 flex items-center gap-1 text-slate-400 font-mono">
                  <IconClockHour4 size={10} aria-hidden />
                  {n.time}
                </p>
              </div>
            </button>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-slate-100 px-4 py-2.5">
        <Link
          href={`${portalPrefix}/notifications`}
          onClick={onClose}
          className="text-caption flex items-center gap-1 text-[var(--tertiary)] transition-opacity hover:opacity-70"
        >
          View all notifications
          <IconChevronRight size={13} aria-hidden />
        </Link>
      </div>
    </PanelShell>
  );
}

// ─── Quick create panel ───────────────────────────────────────────────────────

function QuickCreatePanel({ onClose }: { onClose: () => void }) {
  return (
    <PanelShell width="w-60" align="right">
      <div className="border-b border-slate-100 px-4 py-3">
        <p className="text-label text-slate-800">Quick Create</p>
        <p className="text-caption text-slate-400">Start something new</p>
      </div>
      <div className="p-1.5">
        {QUICK_ACTIONS.map((action) => {
          const content = (
            <>
              <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                <action.icon size={14} aria-hidden />
              </span>
              <span className="text-label flex-1 text-slate-700 text-left">{action.label}</span>
              {action.shortcut && (
                <kbd className="text-tiny select-none rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-slate-400">
                  ⌘{action.shortcut}
                </kbd>
              )}
            </>
          );
          const className = "flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 transition-colors hover:bg-slate-50";

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
  const { events, addEvent, deleteEvent } = useCalendarStore();
  const [month, setMonth] = useState(new Date());
  const [selected, setSelected] = useState(new Date());
  const [isAdding, setIsAdding] = useState(false);
  const [form, setForm] = useState<Partial<CalendarEvent>>({ title: "", time: "", type: "meeting", description: "" });

  const selectedStr = format(selected, "yyyy-MM-dd");
  const dayEvents = events.filter((e) => e.date === selectedStr);
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  // Build calendar grid
  const cells: Date[] = [];
  let cursor = calStart;
  while (cursor <= calEnd) { cells.push(cursor); cursor = addDays(cursor, 1); }

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title?.trim()) return;
    addEvent({ title: form.title, date: selectedStr, time: form.time, type: (form.type ?? "meeting") as CalendarEvent["type"], description: form.description });
    setForm({ title: "", time: "", type: "meeting", description: "" });
    setIsAdding(false);
  }

  return (
    <PanelShell width="w-[40rem]" align="right" className="overflow-visible">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
        <div className="flex items-center gap-2">
          <IconCalendar size={15} className="text-slate-400" aria-hidden />
          <span className="text-label text-slate-800">Schedule</span>
        </div>
        <button
          type="button"
          aria-label="Close calendar"
          onClick={onClose}
          className="flex size-6 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100"
        >
          <IconX size={13} aria-hidden />
        </button>
      </div>

      <div className="flex">
        {/* Left - mini calendar */}
        <div className="w-[56%] border-r border-slate-100 px-5 py-4">
          {/* Month nav */}
          <div className="mb-4 flex items-center justify-between">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => setMonth(subMonths(month, 1))}
              className="flex size-7 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            >
              <IconChevronLeft size={14} aria-hidden />
            </button>
            <span className="text-label text-slate-700">
              {format(month, "MMMM yyyy")}
            </span>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => setMonth(addMonths(month, 1))}
              className="flex size-7 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            >
              <IconChevronRight size={14} aria-hidden />
            </button>
          </div>

          {/* Day labels */}
          <div className="mb-2 grid grid-cols-7">
            {WEEKDAYS.map((d) => (
              <div key={d} className="text-tiny text-center font-medium uppercase tracking-wider text-slate-400">
                {d}
              </div>
            ))}
          </div>

          {/* Cells */}
          <div className="grid grid-cols-7 gap-y-1">
            {cells.map((day) => {
              const dateStr = format(day, "yyyy-MM-dd");
              const dayEvts = events.filter((e) => e.date === dateStr);
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
                    "relative mx-auto flex h-8 w-8 flex-col items-center justify-center rounded-xl transition-colors",
                    isSelected
                      ? "bg-[var(--sidebar)] text-white"
                      : isToday
                        ? "border border-[var(--sidebar)]/30 text-slate-800 hover:bg-slate-50"
                        : isCurrentM
                          ? "text-slate-700 hover:bg-slate-100"
                          : "text-slate-400 hover:bg-slate-50",
                  )}
                >
                  <span className="text-label">{format(day, "d")}</span>
                  {dayEvts.length > 0 && (
                    <span className={cn(
                      "absolute bottom-1 size-[4px] rounded-full",
                      isSelected ? "bg-white/60" : "bg-[var(--sidebar)]/40",
                    )} />
                  )}
                </button>
              );
            })}
          </div>

          {/* Today shortcut */}
          <div className="mt-4 border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={() => { setMonth(new Date()); setSelected(new Date()); }}
              className="text-caption text-[var(--tertiary)] transition-opacity hover:opacity-70"
            >
              Jump to today
            </button>
          </div>
        </div>

        {/* Right - events for selected day */}
        <div className="flex w-[44%] flex-col px-4 py-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-label text-slate-800">
                {format(selected, "EEE, MMM d")}
              </p>
              <p className="text-caption text-slate-400">
                {dayEvents.length === 0 ? "No events" : `${dayEvents.length} event${dayEvents.length > 1 ? "s" : ""}`}
              </p>
            </div>
            {!isAdding && (
              <button
                type="button"
                aria-label="Add event"
                onClick={() => setIsAdding(true)}
                className="flex size-7 items-center justify-center rounded-xl bg-[var(--sidebar)] text-white transition hover:opacity-80"
              >
                <IconPlus size={13} aria-hidden />
              </button>
            )}
          </div>

          {/* Events list */}
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto [scrollbar-width:none]">
            {dayEvents.length === 0 && !isAdding ? (
              <div className="flex flex-col items-center justify-center py-8 text-slate-300">
                <IconCalendar size={24} aria-hidden className="mb-2" />
                <p className="text-caption text-slate-400">No events scheduled</p>
              </div>
            ) : (
              dayEvents.map((ev) => (
                <div
                  key={ev.id}
                  className="group flex items-start gap-2.5 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5"
                >
                  <span className={cn("mt-[3px] size-[7px] shrink-0 rounded-full", EVENT_COLORS[ev.type])} />
                  <div className="min-w-0 flex-1">
                    <p className="text-label text-slate-800">{ev.title}</p>
                    {ev.time && (
                      <p className="text-tiny mt-0.5 flex items-center gap-1 text-slate-400">
                        <IconClockHour4 size={9} aria-hidden />
                        {ev.time}
                      </p>
                    )}
                    {ev.description && (
                      <p className="text-caption mt-1 text-slate-600">{ev.description}</p>
                    )}
                    <p className={cn("text-tiny mt-1 uppercase tracking-wide", EVENT_LABEL_COLORS[ev.type])}>
                      {ev.type}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label="Delete event"
                    onClick={() => deleteEvent(ev.id)}
                    className="flex size-5 shrink-0 items-center justify-center rounded-lg text-slate-300 opacity-0 transition-all hover:bg-red-50 hover:text-red-400 group-hover:opacity-100"
                  >
                    <IconTrash size={11} aria-hidden />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Add event form */}
          <AnimatePresence>
            {isAdding && (
              <motion.form
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                transition={{ duration: 0.15 }}
                onSubmit={handleAdd}
                className="mt-2 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-caption text-slate-700">New event</span>
                  <button type="button" onClick={() => setIsAdding(false)} className="text-slate-400 hover:text-slate-600">
                    <IconX size={13} aria-hidden />
                  </button>
                </div>

                <input
                  autoFocus
                  required
                  placeholder="Event title"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="text-label w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-slate-700 placeholder:text-slate-400 focus:border-slate-300 focus:outline-none"
                />

                <div className="flex gap-2">
                  <input
                    type="time"
                    value={form.time}
                    onChange={(e) => setForm({ ...form, time: e.target.value })}
                    className="text-caption flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-slate-700 focus:border-slate-300 focus:outline-none"
                  />
                  <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value as CalendarEvent["type"] })}
                    className="text-caption flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-slate-700 focus:border-slate-300 focus:outline-none"
                  >
                    <option value="meeting">Meeting</option>
                    <option value="viewing">Viewing</option>
                    <option value="deadline">Deadline</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <textarea
                  placeholder="Notes (optional)"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2}
                  className="text-caption w-full resize-none rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-slate-700 placeholder:text-slate-400 focus:border-slate-300 focus:outline-none"
                />

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAdding(false)}
                    className="text-caption flex-1 rounded-lg border border-slate-200 bg-white py-1.5 text-slate-600 transition-colors hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="text-caption flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[var(--sidebar)] py-1.5 text-white transition-opacity hover:opacity-80"
                  >
                    <IconCheck size={12} aria-hidden />
                    Save
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
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <label
      className={cn(
        "relative flex w-full max-w-[26rem] cursor-text items-center gap-2 rounded-xl px-3 py-[7px]",
        "border transition-all duration-200",
        focused
          ? "border-slate-300 bg-white shadow-[0_0_0_3px_rgba(49,91,232,0.07)]"
          : "border-slate-200/80 bg-slate-50/80 hover:bg-slate-100/50 hover:border-slate-200",
      )}
    >
      <span className="sr-only">Search clients, properties, payments</span>
      <IconSearch
        aria-hidden
        size={13}
        stroke={1.8}
        className={cn("shrink-0 transition-colors", focused ? "text-slate-400" : "text-slate-400")}
      />
      <input
        ref={inputRef}
        type="search"
        placeholder="Search anything..."
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="text-caption flex-1 bg-transparent text-slate-700 placeholder:text-slate-400/80 focus:outline-none"
      />
      <kbd
        className={cn(
          "text-tiny pointer-events-none select-none rounded border px-1.5 py-0.5 font-mono transition-opacity",
          focused ? "opacity-0" : "border-slate-200 bg-white text-slate-400",
        )}
      >
        ⌘K
      </kbd>
    </label>
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
          <span className="text-caption text-slate-400">{activeSection.label}</span>
          <IconChevronRight size={10} className="text-slate-300" aria-hidden />
        </>
      )}
      {dynamicLabel ? (
        <Link
          href={activeItem.href}
          className="text-caption text-slate-400 hover:text-slate-900 transition-colors"
        >
          {activeItem.label}
        </Link>
      ) : (
        <span className="text-caption text-slate-700">{activeItem.label}</span>
      )}
      {dynamicLabel && (
        <>
          <IconChevronRight size={10} className="text-slate-300" aria-hidden />
          <span className="text-caption text-slate-700 font-medium">{dynamicLabel}</span>
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

  const formatRole = (role: string) => {
    return role
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ")
      .replace("Ceo", "CEO")
      .replace("Gm", "GM");
  };

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

  const unreadCount = INITIAL_NOTIFICATIONS.filter((n) => !n.read).length;

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
              {notif.open && <NotificationsPanel onClose={notif.close} />}
            </AnimatePresence>
          </div>

          {/* Divider */}
          <div className="mx-2 h-5 w-px bg-slate-200/80" aria-hidden />

          {/* User dropdown menu - role-aware */}
          <DropdownMenu
            align="right"
            label="User menu"
            trigger={
              <div className="flex items-center gap-2 rounded-xl px-2.5 py-1.5 hover:bg-slate-50 transition cursor-pointer select-none">
                <Avatar
                  src={currentUser.avatarUrl}
                  fallback={currentUser.name ? currentUser.name.split(" ").map((n) => n[0]).join("") : "DM"}
                  status="online"
                  className="size-7 shrink-0"
                />
                <div className="hidden flex-col leading-tight xl:flex text-left">
                  <span className="text-label text-slate-800">{currentUser.name}</span>
                  <span className="text-tiny text-slate-400">{formatRole(currentUser.role)}</span>
                </div>
                <IconChevronDown size={14} className="text-slate-400 ml-1 hidden xl:block" />
              </div>
            }
          >
            <div className="px-3 py-2 border-b border-slate-100 mb-1">
              <p className="text-base font-medium text-slate-800 truncate">{currentUser.name}</p>
              <p className="text-sm  text-slate-450 truncate mt-0.5">{formatRole(currentUser.role)}</p>
            </div>
            <DropdownItem onClick={() => window.location.href = `${portalPrefix}/profile`}>
              <IconUser size={15} stroke={1.8} className="text-slate-400" />
              <span>My Profile</span>
            </DropdownItem>
            <DropdownItem onClick={() => window.location.href = `${portalPrefix}/settings`}>
              <IconSettings size={15} stroke={1.8} className="text-slate-400" />
              <span>System Settings</span>
            </DropdownItem>
            <DropdownItem onClick={() => window.location.href = `${portalPrefix}/security`}>
              <IconShieldLock size={15} stroke={1.8} className="text-slate-400" />
              <span>Security & Keys</span>
            </DropdownItem>
            <div className="my-1 border-t border-slate-100" />
            <DropdownItem onClick={handleLogout}>
              <IconLogout size={15} stroke={1.8} className="text-rose-500" />
              <span className="text-rose-600">Logout</span>
            </DropdownItem>
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

        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Search Sunland ERP</span>
          <IconSearch
            aria-hidden
            size={13}
            stroke={1.8}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="search"
            placeholder="Search..."
            className="text-caption h-9 w-full rounded-xl border border-slate-200/80 bg-slate-50/80 pl-8 pr-3 text-slate-700 placeholder:text-slate-400 focus:border-slate-300 focus:bg-white focus:outline-none transition-all"
          />
        </label>

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
    </header>
  );
}
