"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  IconAlertTriangle,
  IconArrowUpRight,
  IconBell,
  IconBuilding,
  IconCalendarEvent,
  IconCalendarOff,
  IconCalendarPlus,
  IconChartBar,
  IconCheck,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconChevronUp,
  IconClockHour4,
  IconLink,
  IconPlus,
  IconUser,
  IconX,
} from "@tabler/icons-react";
import {
  Avatar,
  Badge,
  Button,
  ConfirmDialog,
  Drawer,
  Modal,
  SkeletonBlock,
} from "@/components/ui/erp-primitives";
import { PageTransition } from "@/components/shared/page-transition";
import { useToast } from "@/components/ui/toast-provider";
import { cn } from "@/lib/utils/cn";
import {
  BOARD_COLUMN_META,
  EVENT_TYPE_ORDER,
  ROLE_TIER_OPTIONS,
  boardColumnFor,
  countdownTo,
  eventTypeMeta,
  greetingFor,
  hasOverlap,
  milestoneProgress,
  type EventType,
  type Milestone,
} from "./scheduler-constants";

// ── Types (mirror the real /api/scheduling + /api/operations shapes) ─────────

interface CalendarEventRow {
  id: string;
  title: string;
  description: string | null;
  type: string;
  startsAt: string;
  endsAt: string;
  location: string | null;
  organizerId: string;
  attendees: Array<{ name: string; email?: string; userId?: string }>;
  projectId: string | null;
  maintenanceRequestId: string | null;
  contactId: string | null;
  leadId: string | null;
  outcome: string;
  needsDisposition: boolean;
  isCritical: boolean;
  notifyRoleTiers: string[] | null;
}

interface ProjectRow {
  id: string;
  title: string;
  description: string | null;
  department: string;
  status: string;
  progressPercent: number | null;
  assigneeIds: string[] | null;
  dueDate: string | null;
  startDate: string | null;
  milestones: Milestone[] | null;
  atRisk: boolean;
  budgetKes: string | null;
  createdById: string;
}

interface StaffUser { id: string; name: string; role: string; avatarUrl: string | null }

interface SchedulerPulse {
  scope: "personal" | "org";
  todayCount: number;
  weekCount: number;
  needsDisposition: number;
  criticalCount: number;
  atRiskProjects: number;
  nextEvent: {
    id: string; title: string; startsAt: string; endsAt: string;
    type: string; location: string | null; isCritical: boolean;
    attendees: Array<{ name: string; userId?: string }>;
  } | null;
}

interface NotificationRow { id: string; type: string; title: string; body: string; createdAt: string }

type Mode = "events" | "projects";
type Scope = "personal" | "org";

// ── Date helpers ─────────────────────────────────────────────────────────────

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function startOfDay(d: Date) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function startOfWeek(d: Date) {
  const x = startOfDay(d);
  // Monday-first, matching the design's Mon…Sun strip.
  const shift = (x.getDay() + 6) % 7;
  return addDays(x, -shift);
}
function sameDay(a: Date, b: Date) { return a.toDateString() === b.toDateString(); }
function hhmm(iso: string) {
  return new Date(iso).toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit", hour12: false });
}
function longDate(d: Date) {
  return d.toLocaleDateString("en-KE", { weekday: "long", day: "numeric", month: "long" });
}
function isoDay(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function durationLabel(startsAt: string, endsAt: string) {
  const mins = Math.max(0, Math.round((new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 60000));
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  return mins % 60 === 0 ? `${h}h` : `${h}h ${mins % 60}m`;
}
function initialsOf(name: string) {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p[1]?.[0] ?? "")).toUpperCase() || "?";
}

// ── Board ────────────────────────────────────────────────────────────────────

export function PortfolioSchedulerBoard({ entityId }: { entityId: string }) {
  const { pushToast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [mode, setMode] = useState<Mode>(searchParams.get("mode") === "projects" ? "projects" : "events");
  const [scope, setScope] = useState<Scope>(searchParams.get("scope") === "org" ? "org" : "personal");

  const [events, setEvents] = useState<CalendarEventRow[]>([]);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [pulse, setPulse] = useState<SchedulerPulse | null>(null);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [weekAnchor, setWeekAnchor] = useState(() => startOfWeek(new Date()));
  const [selectedDay, setSelectedDay] = useState(() => startOfDay(new Date()));
  const [grandScale, setGrandScale] = useState<"month" | "year">("month");
  const [grandOpen, setGrandOpen] = useState(true);
  const [typeFilter, setTypeFilter] = useState<EventType | "all">("all");

  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<CalendarEventRow | null>(null);

  // ── Loading ────────────────────────────────────────────────────────────────
  const loadEvents = useCallback(async () => {
    try {
      const res = await fetch(`/api/scheduling/events?entityId=${entityId}&scope=${scope === "org" ? "all" : "mine"}`);
      const data = await res.json();
      setEvents(Array.isArray(data.events) ? data.events : []);
    } catch {
      pushToast({ tone: "error", title: "Couldn't load the calendar", body: "Try refreshing." });
    }
  }, [entityId, scope, pushToast]);

  const loadProjects = useCallback(async () => {
    try {
      const res = await fetch(`/api/operations/projects?entityId=${entityId}`);
      const data = await res.json();
      setProjects(Array.isArray(data.projects) ? data.projects : []);
    } catch { /* projects are secondary to the agenda - fail quietly */ }
  }, [entityId]);

  const loadPulse = useCallback(async () => {
    try {
      const res = await fetch(`/api/scheduling/pulse?entityId=${entityId}&scope=${scope}`);
      const data = await res.json();
      if (data.pulse) setPulse(data.pulse);
    } catch { /* hero degrades to its zero state */ }
  }, [entityId, scope]);

  useEffect(() => {
    Promise.resolve().then(async () => {
      setLoading(true);
      await Promise.allSettled([loadEvents(), loadProjects(), loadPulse()]);
      setLoading(false);
    });
  }, [loadEvents, loadProjects, loadPulse]);

  useEffect(() => {
    Promise.resolve().then(() => {
      fetch("/api/identity/users?entityId=group").then((r) => r.json()).then((d) => { if (Array.isArray(d.users)) setStaff(d.users); }).catch(() => { });
      fetch("/api/notifications").then((r) => r.json()).then((d) => {
        const rows: NotificationRow[] = Array.isArray(d.notifications) ? d.notifications : [];
        setNotifications(rows.filter((n) => n.type.startsWith("scheduling.")).slice(0, 5));
      }).catch(() => { });
    });
  }, []);

  // Deep-link the mode/scope so a shared URL lands on the same view.
  useEffect(() => {
    const params = new URLSearchParams();
    params.set("mode", mode);
    params.set("scope", scope);
    router.replace(`/admin/scheduler?${params.toString()}`, { scroll: false });
  }, [mode, scope, router]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const staffById = useMemo(() => new Map(staff.map((s) => [s.id, s])), [staff]);
  const projectById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekAnchor, i)), [weekAnchor]);

  const eventsOn = useCallback(
    (day: Date) => events.filter((e) => sameDay(new Date(e.startsAt), day)),
    [events],
  );

  const agenda = useMemo(() => {
    const rows = eventsOn(selectedDay).filter((e) => typeFilter === "all" || e.type === typeFilter);
    return rows.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  }, [eventsOn, selectedDay, typeFilter]);

  const weekSummary = useMemo(() => {
    const inWeek = events.filter((e) => {
      const d = new Date(e.startsAt);
      return d >= weekAnchor && d < addDays(weekAnchor, 7);
    });
    const max = Math.max(1, ...EVENT_TYPE_ORDER.map((t) => inWeek.filter((e) => e.type === t).length));
    return EVENT_TYPE_ORDER.map((t) => {
      const count = inWeek.filter((e) => e.type === t).length;
      return { type: t, count, pct: Math.round((count / max) * 100) };
    });
  }, [events, weekAnchor]);

  // Real upcoming-reminder preview: events inside the next 24h. There is no
  // cron in this codebase, so this is honestly labelled as a preview of what
  // would fire rather than a queue of scheduled jobs.
  const reminderQueue = useMemo(() => {
    const now = new Date();
    const horizon = new Date(now.getTime() + 86_400_000);
    return events
      .filter((e) => {
        const d = new Date(e.startsAt);
        return d >= now && d <= horizon && e.outcome === "pending";
      })
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
      .slice(0, 4);
  }, [events]);

  const monthCells = useMemo(() => {
    const anchor = selectedDay;
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const lead = (first.getDay() + 6) % 7;
    const gridStart = addDays(first, -lead);
    return Array.from({ length: 35 }, (_, i) => {
      const date = addDays(gridStart, i);
      return { date, inMonth: date.getMonth() === anchor.getMonth(), items: eventsOn(date) };
    });
  }, [selectedDay, eventsOn]);

  const drawerEvent = events.find((e) => e.id === drawerId) ?? null;

  // ── Actions ────────────────────────────────────────────────────────────────
  const shiftEvent = async (event: CalendarEventRow, days: number) => {
    try {
      const res = await fetch(`/api/scheduling/events?id=${event.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityId,
          startsAt: addDays(new Date(event.startsAt), days).toISOString(),
          endsAt: addDays(new Date(event.endsAt), days).toISOString(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed to reschedule");
      pushToast({ tone: "success", title: "Rescheduled", body: `"${event.title}" moved ${days > 0 ? "forward" : "back"} ${Math.abs(days)} day.` });
      loadEvents(); loadPulse();
    } catch (err) {
      pushToast({ tone: "error", title: "Couldn't reschedule", body: err instanceof Error ? err.message : "Try again." });
    }
  };

  const cancelEvent = async (event: CalendarEventRow) => {
    try {
      const res = await fetch(`/api/scheduling/events?id=${event.id}&entityId=${entityId}`, { method: "DELETE" });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Failed to cancel");
      pushToast({ tone: "success", title: "Event cancelled", body: `"${event.title}" was removed from the calendar.` });
      setDrawerId(null);
      loadEvents(); loadPulse();
    } catch (err) {
      pushToast({ tone: "error", title: "Couldn't cancel", body: err instanceof Error ? err.message : "Try again." });
    }
  };

  const notifyRoles = async (event: CalendarEventRow) => {
    try {
      const res = await fetch(`/api/scheduling/events/${event.id}/notify`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed to notify");
      pushToast({
        tone: "success",
        title: `Notified ${data.delivered} of ${data.matched}`,
        body: data.delivered < data.matched
          ? "Some recipients have muted this category. SMS delivery is pending a provider."
          : "In-app alerts delivered. SMS delivery is pending a provider.",
      });
    } catch (err) {
      pushToast({ tone: "error", title: "Couldn't notify", body: err instanceof Error ? err.message : "Try again." });
    }
  };

  const toggleMilestone = async (project: ProjectRow, index: number, done: boolean) => {
    setProjects((prev) => prev.map((p) => p.id === project.id
      ? { ...p, milestones: (p.milestones ?? []).map((m, i) => (i === index ? { ...m, done } : m)) }
      : p));
    try {
      const res = await fetch(`/api/operations/projects/${project.id}/milestone`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ index, done }),
      });
      if (!res.ok) throw new Error("Failed");
      loadProjects();
    } catch {
      loadProjects();
      pushToast({ tone: "warning", title: "Couldn't update milestone", body: "Try again." });
    }
  };

  const heroDate = new Date();
  const nextEvent = pulse?.nextEvent ?? null;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <PageTransition className="mx-auto flex max-w-[98rem] flex-col gap-4">
      {/* ══ Header ══ */}
      <div className="flex items-end justify-between gap-4 flex-wrap border-b border-slate-200/60 pb-3">
        <div className="flex items-baseline gap-4 flex-wrap">
          <h1 className="title-serif text-slate-900">Operations Scheduler</h1>
          <div className="flex gap-1 bg-white border border-slate-100 rounded-xl p-1 shadow-sm" role="tablist" aria-label="Scheduler mode">
            {([["events", "Events", IconCalendarEvent], ["projects", "Projects", IconChartBar]] as const).map(([key, label, Ico]) => (
              <button
                key={key}
                role="tab"
                aria-selected={mode === key}
                onClick={() => setMode(key)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors",
                  mode === key ? "bg-[#151936] text-white shadow-sm" : "text-slate-500 hover:text-slate-900",
                )}
              >
                <Ico size={14} /> {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Personal / Organization scope - real scope=mine|all on the service */}
          <div className="inline-flex items-center gap-1 bg-[#151936] p-1 rounded-xl" role="group" aria-label="Scheduler scope">
            {([["personal", "My schedule", IconUser], ["org", "Organization", IconBuilding]] as const).map(([key, label, Ico]) => (
              <button
                key={key}
                onClick={() => setScope(key)}
                aria-pressed={scope === key}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap",
                  scope === key ? "bg-white text-[#151936] shadow" : "text-white/60 hover:text-white/90",
                )}
              >
                <Ico size={14} /> {label}
              </button>
            ))}
          </div>

          <div className="hidden sm:flex items-center">
            {staff.slice(0, 4).map((s) => (
              <Avatar key={s.id} src={s.avatarUrl ?? undefined} fallback={initialsOf(s.name)} className="size-8 rounded-full -ml-2 first:ml-0 ring-2 ring-white" />
            ))}
          </div>

          <Button size="sm" onClick={() => (mode === "events" ? setNewOpen(true) : router.push("/admin/projects"))}>
            <IconPlus size={14} /> {mode === "events" ? "New Event" : "New Project"}
          </Button>
        </div>
      </div>

      {/* ══ Operations Pulse hero ══ */}
      <div
        className="gsap-stagger relative rounded-[26px] overflow-hidden shadow-[0_16px_40px_rgba(21,25,54,0.16)]"
        style={{ background: "linear-gradient(120deg,#0d1020 0%,#151936 46%,#122a20 100%)" }}
      >
        <div className="absolute inset-0 pointer-events-none bg-tertiary-gradient" />
        <div className="relative grid grid-cols-1 lg:grid-cols-[1.55fr_1fr] gap-5 p-6">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-[rgba(243,223,39,0.4)] bg-[rgba(243,223,39,0.16)] px-2.5 py-1 text-xxs font-medium uppercase tracking-[0.08em] text-[#f3df27]">
              <span className="size-1.5 rounded-full bg-emerald-400 ring-[3px] ring-emerald-400/25" />
              {greetingFor(heroDate)}
            </span>
            <p className="mt-2.5 text-3xl font-medium text-white leading-tight">{longDate(heroDate)}</p>
            <p className="mt-1 text-sm text-white/70">
              {scope === "org" ? "Organisation-wide operations" : "Your personal agenda"} ·{" "}
              {pulse ? `${pulse.todayCount} today, ${pulse.weekCount} this week` : "Loading…"}
            </p>

            <div className="mt-4 flex gap-2 flex-wrap">
              <HeroStat icon={IconCalendarEvent} value={pulse?.todayCount ?? 0} label="Today" color="#f3df27" onClick={() => { setSelectedDay(startOfDay(new Date())); setWeekAnchor(startOfWeek(new Date())); }} />
              <HeroStat icon={IconClockHour4} value={pulse?.weekCount ?? 0} label="This week" color="#a5b4fc" onClick={() => setWeekAnchor(startOfWeek(new Date()))} />
              <HeroStat icon={IconAlertTriangle} value={pulse?.needsDisposition ?? 0} label="Unresolved" color="#fda4af" onClick={() => setMode("events")} />
              <HeroStat icon={IconChartBar} value={pulse?.atRiskProjects ?? 0} label="At risk" color="#fda4af" onClick={() => setMode("projects")} />
            </div>
          </div>

          <div className="rounded-[18px] border border-white/20 bg-white/[0.09] backdrop-blur-md p-4">
            <div className="flex items-center justify-between gap-2 mb-2.5">
              <p className="text-xxs font-medium uppercase tracking-[0.12em] text-white/55">Up next</p>
              {nextEvent && (
                <span className="rounded-full bg-[rgba(243,223,39,0.18)] px-2.5 py-1 text-xxs font-medium text-[#f3df27]">
                  {countdownTo(nextEvent.startsAt)}
                </span>
              )}
            </div>
            {nextEvent ? (
              <>
                <p className="flex items-center gap-2 text-sm font-medium text-white leading-snug">
                  <span className="font-mono font-medium text-[#f3df27] shrink-0">{hhmm(nextEvent.startsAt)}</span>
                  <span className="truncate">{nextEvent.title}</span>
                </p>
                <p className="mt-1 text-xs text-white/60 truncate">
                  {eventTypeMeta(nextEvent.type).label}
                  {nextEvent.location ? ` · ${nextEvent.location}` : ""}
                </p>
                <div className="flex items-center justify-between mt-3">
                  <span className="flex items-center">
                    {(nextEvent.attendees ?? []).slice(0, 4).map((a, i) => (
                      <span key={i} className="size-6 rounded-full bg-white/20 border border-white/40 -ml-1.5 first:ml-0 flex items-center justify-center text-xxs text-white">
                        {initialsOf(a.name)}
                      </span>
                    ))}
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setDrawerId(nextEvent.id); }}
                      className="rounded-full border border-white/25 bg-white/[0.14] px-3 py-1.5 text-xs font-medium text-white hover:bg-white/25 transition-colors"
                    >Open</button>
                    <button
                      onClick={() => { setSelectedDay(startOfDay(new Date())); setWeekAnchor(startOfWeek(new Date())); }}
                      className="rounded-full bg-white/90 px-3 py-1.5 text-xs font-medium text-[#151936] hover:bg-white transition-colors"
                    >Today</button>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm text-white/70 mt-1.5">Nothing left on the calendar. You&apos;re all clear.</p>
            )}
          </div>
        </div>
      </div>

      {/* ══ Grand view ══ */}
      <div className="bg-white border border-slate-100 rounded-3xl shadow-[0_8px_30px_rgba(0,0,0,0.04)] px-5 py-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="flex items-center gap-2 text-base font-medium text-slate-800">
            {grandScale === "month"
              ? selectedDay.toLocaleDateString("en-KE", { month: "long", year: "numeric" })
              : `${heroDate.getFullYear()} planner`}
            <span className="text-xs text-slate-400">
              {grandScale === "month" ? "Click a day to load its agenda" : "Project spans across the year"}
            </span>
          </p>
          <div className="flex items-center gap-2">
            <div className="flex bg-slate-100 rounded-lg p-0.5 gap-0.5">
              {(["month", "year"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setGrandScale(s)}
                  aria-pressed={grandScale === s}
                  className={cn("rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors", grandScale === s ? "bg-white text-slate-900 shadow-sm" : "text-slate-500")}
                >{s}</button>
              ))}
            </div>
            <button
              onClick={() => setGrandOpen((v) => !v)}
              aria-expanded={grandOpen}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors"
            >
              {grandOpen ? "Hide" : "Show"} {grandOpen ? <IconChevronUp size={13} /> : <IconChevronDown size={13} />}
            </button>
          </div>
        </div>

        {grandOpen && grandScale === "month" && (
          <>
            <div className="grid grid-cols-7 gap-1.5 mt-4 mb-1">
              {DOW.map((d) => (
                <span key={d} className="text-center text-xxs font-medium uppercase tracking-wide text-slate-400 py-0.5">{d}</span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {monthCells.map(({ date, inMonth, items }) => {
                const isToday = sameDay(date, new Date());
                const isSelected = sameDay(date, selectedDay);
                return (
                  <button
                    key={date.toISOString()}
                    onClick={() => { setSelectedDay(date); setWeekAnchor(startOfWeek(date)); }}
                    aria-label={`${longDate(date)}, ${items.length} events`}
                    className={cn(
                      "relative flex flex-col items-center gap-1 rounded-xl border px-1 py-2 min-h-[62px] transition-colors",
                      isSelected ? "border-[#151936] bg-[#faf8ee]" : "border-slate-100 hover:border-slate-300",
                      !inMonth && "opacity-40",
                    )}
                  >
                    <span className={cn("text-sm font-medium", isToday ? "text-[#151936]" : "text-slate-600")}>
                      {date.getDate()}
                      {isToday && <span className="ml-0.5 inline-block size-1 rounded-full bg-[#f3df27] align-super" />}
                    </span>
                    <span className="flex gap-0.5 justify-center min-h-[5px] flex-wrap">
                      {items.slice(0, 4).map((e) => (
                        <span key={e.id} className="size-1.5 rounded-full" style={{ background: eventTypeMeta(e.type).color }} />
                      ))}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="flex gap-3.5 flex-wrap mt-3">
              {EVENT_TYPE_ORDER.map((t) => (
                <span key={t} className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                  <span className="size-2 rounded-full" style={{ background: EVENT_TYPE_META_COLOR(t) }} />
                  {eventTypeMeta(t).short}
                </span>
              ))}
            </div>
          </>
        )}

        {grandOpen && grandScale === "year" && (
          <div className="overflow-x-auto mt-4">
            <div className="min-w-[900px]">
              <div className="grid grid-cols-[190px_repeat(12,1fr)] gap-1 mb-2">
                <span className="text-xxs font-medium uppercase tracking-wide text-slate-400 self-end pb-1">
                  {heroDate.getFullYear()} · Projects
                </span>
                {MONTHS.map((m) => (
                  <span key={m} className="text-center font-mono text-xxs text-slate-400">{m}</span>
                ))}
              </div>
              {projects.length === 0 ? (
                <p className="text-sm text-slate-400 py-6 text-center">No projects to plot yet.</p>
              ) : projects.map((p) => {
                const span = yearSpan(p);
                const col = boardColumnFor(p.status, p.atRisk);
                const owner = staffById.get(p.assigneeIds?.[0] ?? p.createdById);
                return (
                  <div key={p.id} className="grid grid-cols-[190px_1fr] gap-1 items-center py-1.5 border-t border-slate-50">
                    <span className="flex items-center gap-2 min-w-0 pr-2">
                      <Avatar src={owner?.avatarUrl ?? undefined} fallback={initialsOf(owner?.name ?? "?")} className="size-6 rounded-full shrink-0" />
                      <span className="min-w-0">
                        <span className="block text-xs font-medium text-slate-900 truncate">{p.title}</span>
                        <span className="block text-xs text-slate-400 truncate">{p.department.replace(/_/g, " ")}</span>
                      </span>
                    </span>
                    <div className="relative h-6">
                      <div className="absolute inset-0 flex" aria-hidden>
                        {MONTHS.map((m) => <span key={m} className="flex-1 border-l border-dashed border-slate-100" />)}
                      </div>
                      <Link
                        href="/admin/projects"
                        className="absolute inset-y-0.5 rounded-full flex items-center overflow-hidden hover:brightness-110 transition-all"
                        style={{ left: `${span.left}%`, width: `${span.width}%`, background: BOARD_COLUMN_META[col].bar }}
                        aria-label={`Open ${p.title}`}
                      >
                        <span className="absolute inset-y-0 left-0 bg-white/25" style={{ width: `${p.progressPercent ?? 0}%` }} />
                        <span className="relative font-mono text-xxs text-white px-2 whitespace-nowrap">{p.progressPercent ?? 0}%</span>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ══ EVENTS MODE ══ */}
      {mode === "events" && (
        <>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5">
              <div className="flex bg-white border border-slate-100 rounded-xl p-0.5 shadow-sm">
                <button onClick={() => setWeekAnchor(addDays(weekAnchor, -7))} aria-label="Previous week" className="size-8 rounded-lg text-slate-500 hover:bg-slate-100 flex items-center justify-center"><IconChevronLeft size={16} /></button>
                <button onClick={() => setWeekAnchor(addDays(weekAnchor, 7))} aria-label="Next week" className="size-8 rounded-lg text-slate-500 hover:bg-slate-100 flex items-center justify-center"><IconChevronRight size={16} /></button>
              </div>
              <p className="text-base font-medium text-slate-800">
                {weekAnchor.toLocaleDateString("en-KE", { day: "numeric", month: "short" })} – {addDays(weekAnchor, 6).toLocaleDateString("en-KE", { day: "numeric", month: "short" })}
              </p>
              {!sameDay(weekAnchor, startOfWeek(new Date())) && (
                <button onClick={() => { setWeekAnchor(startOfWeek(new Date())); setSelectedDay(startOfDay(new Date())); }} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">This week</button>
              )}
            </div>
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
              <IconClockHour4 size={14} className="text-slate-400" />
              {weekSummary.reduce((s, w) => s + w.count, 0)} events this week
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
            {weekDays.map((d) => {
              const items = eventsOn(d);
              const isSel = sameDay(d, selectedDay);
              const isToday = sameDay(d, new Date());
              return (
                <button
                  key={d.toISOString()}
                  onClick={() => setSelectedDay(d)}
                  aria-pressed={isSel}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-2xl border px-2 py-3 transition-all",
                    isSel ? "border-[#151936] bg-[#151936] text-white shadow-md" : "border-slate-100 bg-white hover:shadow-md",
                  )}
                >
                  <span className={cn("text-xxs font-medium uppercase tracking-wide", isSel ? "text-white/60" : "text-slate-400")}>{DOW[(d.getDay() + 6) % 7]}</span>
                  <span className={cn("text-lg font-medium", isSel ? "text-white" : "text-slate-800")}>{d.getDate()}</span>
                  <span className="flex gap-0.5 min-h-[6px]">
                    {items.slice(0, 4).map((e) => (
                      <span key={e.id} className="size-1.5 rounded-full" style={{ background: isSel ? "rgba(255,255,255,0.7)" : eventTypeMeta(e.type).color }} />
                    ))}
                  </span>
                  {isToday && <span className={cn("text-xxs font-medium uppercase tracking-wide", isSel ? "text-[#f3df27]" : "text-amber-600")}>Today</span>}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[1.6fr_1fr] gap-4 items-start">
            {/* Agenda */}
            <div className="bg-white border border-slate-100 rounded-3xl shadow-[0_8px_30px_rgba(0,0,0,0.04)] p-5">
              <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
                <p className="text-base font-medium text-slate-900">
                  {longDate(selectedDay)} <span className="font-mono font-medium text-xs text-slate-400">{agenda.length} events</span>
                </p>
                <div className="flex gap-1.5 flex-wrap">
                  <TypeChip active={typeFilter === "all"} onClick={() => setTypeFilter("all")} label="All" />
                  {EVENT_TYPE_ORDER.map((t) => (
                    <TypeChip key={t} active={typeFilter === t} onClick={() => setTypeFilter(t)} label={eventTypeMeta(t).short} color={eventTypeMeta(t).color} />
                  ))}
                </div>
              </div>

              {loading ? (
                <div className="flex flex-col gap-3">
                  {Array.from({ length: 4 }).map((_, i) => <SkeletonBlock key={i} className="h-20 w-full rounded-2xl" />)}
                </div>
              ) : agenda.length === 0 ? (
                <div className="flex flex-col items-center gap-2.5 py-12 text-center">
                  <IconCalendarOff size={28} className="text-slate-300" />
                  <p className="text-sm font-medium text-slate-800">Nothing scheduled this day</p>
                  <button onClick={() => setNewOpen(true)} className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50">Schedule something</button>
                </div>
              ) : (
                <div className="flex flex-col">
                  {agenda.map((e, i) => {
                    const meta = eventTypeMeta(e.type);
                    const overlap = hasOverlap(e, agenda);
                    const organizer = staffById.get(e.organizerId);
                    const project = e.projectId ? projectById.get(e.projectId) : null;
                    const linkHref = e.maintenanceRequestId ? `/admin/maintenance/${e.maintenanceRequestId}` : project ? "/admin/projects" : null;
                    return (
                      <div key={e.id} className="flex gap-3">
                        <span className="w-12 shrink-0 pt-1">
                          <span className="block font-mono font-medium text-sm text-slate-700">{hhmm(e.startsAt)}</span>
                          <span className="block text-xxs text-slate-300">EAT</span>
                        </span>
                        <span className="flex flex-col items-center shrink-0 pt-1.5">
                          <span className="size-2.5 rounded-full ring-4 ring-white" style={{ background: meta.color }} />
                          {i !== agenda.length - 1 && <span className="w-px flex-1 min-h-[26px] bg-slate-100 mt-1" />}
                        </span>
                        <div className="flex-1 min-w-0 pb-3">
                          <div className={cn(
                            "flex items-start gap-3 rounded-2xl border p-3 transition-shadow hover:shadow-md",
                            e.isCritical ? "border-rose-200 bg-rose-50/40" : "border-slate-100 bg-white",
                          )}>
                            <button onClick={() => setDrawerId(e.id)} className="flex-1 min-w-0 flex items-start gap-3 text-left">
                              <Avatar src={organizer?.avatarUrl ?? undefined} fallback={initialsOf(organizer?.name ?? e.title)} className="size-9 rounded-full shrink-0" />
                              <span className="min-w-0 flex-1">
                                <span className="flex items-center gap-1.5 text-sm font-medium text-slate-900">
                                  <meta.icon size={13} style={{ color: meta.color }} />
                                  <span className="truncate">{e.title}</span>
                                </span>
                                <span className="block text-xs text-slate-400 truncate mt-0.5">
                                  {durationLabel(e.startsAt, e.endsAt)}
                                  {e.location ? ` · ${e.location}` : ""}
                                  {project ? ` · ${project.title}` : ""}
                                </span>
                                <span className="flex gap-1.5 mt-2 flex-wrap">
                                  {(e.notifyRoleTiers ?? []).slice(0, 3).map((r) => (
                                    <span key={r} className="inline-flex items-center gap-1 rounded-full bg-[rgba(21,25,54,0.05)] px-2 py-0.5 text-xxs font-medium text-[#151936]">
                                      <IconBell size={9} /> {r}
                                    </span>
                                  ))}
                                  {e.isCritical && (
                                    <span className="inline-flex rounded-full bg-rose-100 px-2 py-0.5 text-xxs font-medium uppercase tracking-wide text-rose-700">Critical</span>
                                  )}
                                  {overlap && (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xxs font-medium uppercase tracking-wide text-amber-700">
                                      <IconAlertTriangle size={9} /> Overlap
                                    </span>
                                  )}
                                  {e.needsDisposition && (
                                    <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xxs font-medium uppercase tracking-wide text-slate-600">Needs outcome</span>
                                  )}
                                </span>
                              </span>
                            </button>
                            <span className="flex gap-1.5 shrink-0">
                              {linkHref && (
                                <Link href={linkHref} aria-label="Open linked record" className="size-7 rounded-full border border-slate-200 bg-white text-[#151936] flex items-center justify-center hover:bg-slate-50"><IconLink size={13} /></Link>
                              )}
                              <button onClick={() => shiftEvent(e, 1)} aria-label="Reschedule one day later" className="size-7 rounded-full border border-slate-200 bg-white text-[#151936] flex items-center justify-center hover:bg-slate-50"><IconCalendarPlus size={13} /></button>
                              <button onClick={() => setCancelTarget(e)} aria-label="Cancel event" className="size-7 rounded-full border border-slate-200 bg-white text-rose-600 flex items-center justify-center hover:bg-rose-50"><IconX size={13} /></button>
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Rail */}
            <div className="flex flex-col gap-3.5">
              <RailCard title="This week">
                <div className="flex flex-col gap-2.5">
                  {weekSummary.map((w) => (
                    <div key={w.type} className="flex items-center gap-2.5">
                      <span className="size-2 rounded-full shrink-0" style={{ background: eventTypeMeta(w.type).color }} />
                      <span className="flex-1 text-xs text-slate-600">{eventTypeMeta(w.type).short}</span>
                      <span className="w-16 h-1.5 rounded-full bg-slate-100 overflow-hidden" aria-hidden>
                        <span className="block h-full rounded-full" style={{ width: `${w.pct}%`, background: eventTypeMeta(w.type).color }} />
                      </span>
                      <span className="w-5 text-right font-mono font-medium text-xs text-slate-700">{w.count}</span>
                    </div>
                  ))}
                </div>
              </RailCard>

              <RailCard
                title="Reminder queue"
                sub="Events inside the next 24 hours. Delivery runs when you notify — there is no scheduled job yet."
              >
                <div className="flex flex-col gap-2">
                  {reminderQueue.length === 0 ? (
                    <p className="text-xs text-slate-400">Nothing due in the next 24 hours.</p>
                  ) : reminderQueue.map((e) => (
                    <button key={e.id} onClick={() => setDrawerId(e.id)} className="flex items-center gap-2.5 rounded-xl border border-slate-100 bg-[#fafbf8] px-3 py-2 text-left hover:bg-slate-50 transition-colors">
                      <span className="rounded-md bg-white border border-slate-100 px-2 py-1 font-mono text-xxs text-slate-600 shrink-0">{countdownTo(e.startsAt)}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-medium text-slate-900 truncate">{e.title}</span>
                        <span className="block text-xs text-slate-400 truncate">{(e.notifyRoleTiers ?? []).join(", ") || "No roles selected"}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </RailCard>

              <RailCard title="Recently notified">
                <div className="flex flex-col gap-2.5">
                  {notifications.length === 0 ? (
                    <p className="text-xs text-slate-400">No scheduling alerts sent yet.</p>
                  ) : notifications.map((n) => (
                    <div key={n.id} className="flex gap-2.5 items-start">
                      <span className="size-2 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs text-slate-600 leading-snug"><span className="text-slate-900 font-medium">{n.title}</span></p>
                        <p className="font-mono text-xxs text-slate-400 mt-0.5">{new Date(n.createdAt).toLocaleString("en-KE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false })} · in-app</p>
                      </div>
                    </div>
                  ))}
                </div>
              </RailCard>
            </div>
          </div>
        </>
      )}

      {/* ══ PROJECTS MODE ══ */}
      {mode === "projects" && (
        <>
          <div className="bg-white border border-slate-100 rounded-3xl shadow-[0_8px_30px_rgba(0,0,0,0.04)] p-5">
            <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
              <p className="flex items-center gap-3 text-base font-medium text-slate-900">
                {heroDate.toLocaleDateString("en-KE", { month: "long", year: "numeric" })}
                <span className="font-mono font-medium text-xs text-slate-400">{projects.length} initiatives</span>
                <Link href="/admin/projects" className="inline-flex items-center gap-1 text-xs font-medium text-[#122a20] hover:underline">
                  Projects Board <IconArrowUpRight size={12} />
                </Link>
              </p>
              <div className="flex gap-3.5 flex-wrap">
                {(["progress", "risk", "done"] as const).map((c) => (
                  <span key={c} className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                    <span className="size-2 rounded-sm" style={{ background: BOARD_COLUMN_META[c].color }} />
                    {BOARD_COLUMN_META[c].label}
                  </span>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="flex flex-col gap-2">{Array.from({ length: 5 }).map((_, i) => <SkeletonBlock key={i} className="h-12 w-full rounded-xl" />)}</div>
            ) : projects.length === 0 ? (
              <p className="text-sm text-slate-400 py-8 text-center">No initiatives yet — create one from the Projects Board.</p>
            ) : (
              <div className="overflow-x-auto">
                <div className="min-w-[780px] relative">
                  <div className="flex ml-[236px] border-b border-slate-100 pb-1.5">
                    {MONTHS.map((m) => <span key={m} className="flex-1 font-mono text-xxs text-slate-400">{m}</span>)}
                  </div>
                  {projects.map((p) => {
                    const span = yearSpan(p);
                    const col = boardColumnFor(p.status, p.atRisk);
                    const owner = staffById.get(p.assigneeIds?.[0] ?? p.createdById);
                    return (
                      <div key={p.id} className="flex items-center py-2.5 border-b border-slate-50">
                        <Link href="/admin/projects" className="w-[236px] shrink-0 flex items-center gap-2.5 pr-3">
                          <Avatar src={owner?.avatarUrl ?? undefined} fallback={initialsOf(owner?.name ?? "?")} className="size-7 rounded-full shrink-0" />
                          <span className="min-w-0">
                            <span className="block text-xs font-medium text-slate-900 truncate">{p.title}</span>
                            <span className="block text-xs text-slate-400 truncate capitalize">{p.department.replace(/_/g, " ")}</span>
                          </span>
                        </Link>
                        <div className="flex-1 relative h-6">
                          <div className="absolute inset-0 flex" aria-hidden>
                            {MONTHS.map((m) => <span key={m} className="flex-1 border-l border-dashed border-slate-100" />)}
                          </div>
                          <div
                            className="absolute inset-y-0.5 rounded-full flex items-center overflow-hidden"
                            style={{ left: `${span.left}%`, width: `${span.width}%`, background: BOARD_COLUMN_META[col].bar }}
                          >
                            <span className="absolute inset-y-0 left-0 bg-white/25" style={{ width: `${p.progressPercent ?? 0}%` }} />
                            <span className="relative font-mono text-xxs text-white px-2 whitespace-nowrap">{p.progressPercent ?? 0}%</span>
                          </div>
                        </div>
                        <span className="w-24 text-right text-xs font-medium shrink-0" style={{ color: BOARD_COLUMN_META[col].color }}>
                          {BOARD_COLUMN_META[col].label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
            {projects.filter((p) => p.status !== "completed").slice(0, 6).map((p) => {
              const col = boardColumnFor(p.status, p.atRisk);
              const owner = staffById.get(p.assigneeIds?.[0] ?? p.createdById);
              const ms = milestoneProgress(p.milestones);
              return (
                <div key={p.id} className="bg-white border border-slate-100 rounded-[20px] shadow-[0_8px_30px_rgba(0,0,0,0.04)] p-4">
                  <div className="flex items-center justify-between mb-2.5">
                    <Badge tone={col === "risk" ? "risk" : col === "done" ? "neutral" : "success"}>{BOARD_COLUMN_META[col].label}</Badge>
                    <span className="font-mono text-xxs text-slate-400">
                      {p.startDate ? new Date(p.startDate).toLocaleDateString("en-KE", { day: "2-digit", month: "short" }) : "—"}
                      {" – "}
                      {p.dueDate ? new Date(p.dueDate).toLocaleDateString("en-KE", { day: "2-digit", month: "short" }) : "—"}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-slate-900">{p.title}</p>
                  <p className="text-xs text-slate-500 leading-relaxed mt-1 line-clamp-2">{p.description ?? "No description."}</p>

                  <div className="flex flex-col gap-1.5 my-3">
                    {(p.milestones ?? []).slice(0, 3).map((m, i) => (
                      <button key={i} onClick={() => toggleMilestone(p, i, !m.done)} className="flex items-center gap-2 text-left">
                        <span className={cn(
                          "size-4 rounded-md border flex items-center justify-center shrink-0",
                          m.done ? "bg-[#122a20] border-[#122a20] text-white" : "bg-white border-slate-300",
                        )}>{m.done && <IconCheck size={10} />}</span>
                        <span className={cn("text-xs", m.done ? "text-slate-400 line-through" : "text-slate-700")}>{m.label}</span>
                      </button>
                    ))}
                    {ms.total === 0 && <p className="text-xs text-slate-400">No milestones set.</p>}
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-50 pt-2.5">
                    <span className="flex items-center gap-2">
                      <Avatar src={owner?.avatarUrl ?? undefined} fallback={initialsOf(owner?.name ?? "?")} className="size-6 rounded-full" />
                      <span className="text-xs text-slate-500">{ms.done}/{ms.total} milestones</span>
                    </span>
                    <span className="font-mono font-medium text-xs text-[#122a20]">{p.progressPercent ?? 0}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      <p className="mt-5 text-xs text-slate-400">
        Sunland ERP · Scheduler · {scope === "org" ? "Organisation-wide view" : "Personal view"}
      </p>

      {/* ══ Event drawer ══ */}
      <EventDrawer
        event={drawerEvent}
        staffById={staffById}
        onClose={() => setDrawerId(null)}
        onShift={shiftEvent}
        onCancel={(e) => setCancelTarget(e)}
        onNotify={notifyRoles}
      />

      {/* ══ New event ══ */}
      <NewEventModal
        open={newOpen}
        entityId={entityId}
        projects={projects}
        defaultDate={isoDay(selectedDay)}
        onClose={() => setNewOpen(false)}
        onCreated={() => { setNewOpen(false); loadEvents(); loadPulse(); }}
      />

      <ConfirmDialog
        open={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        onConfirm={() => { if (cancelTarget) cancelEvent(cancelTarget); setCancelTarget(null); }}
        title="Cancel this event?"
        description={cancelTarget ? `"${cancelTarget.title}" will be removed from the calendar for everyone. This can't be undone.` : ""}
        confirmLabel="Cancel event"
        tone="danger"
      />
    </PageTransition>
  );
}

// ── Small pieces ─────────────────────────────────────────────────────────────

function EVENT_TYPE_META_COLOR(t: EventType) { return eventTypeMeta(t).color; }

/** Positions a project bar across a 12-month track from its real start/due dates. */
function yearSpan(p: { startDate: string | null; dueDate: string | null }) {
  const year = new Date().getFullYear();
  const start = p.startDate ? new Date(p.startDate) : null;
  const end = p.dueDate ? new Date(p.dueDate) : null;
  const startMonth = start && start.getFullYear() === year ? start.getMonth() : 0;
  const endMonth = end && end.getFullYear() === year ? end.getMonth() : startMonth;
  const from = Math.min(startMonth, endMonth);
  const to = Math.max(startMonth, endMonth);
  return { left: (from / 12) * 100, width: Math.max(4, ((to - from + 1) / 12) * 100) };
}

function HeroStat({ icon: Ico, value, label, color, onClick }: { icon: Icon2; value: number; label: string; color: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-2.5 rounded-xl border border-white/20 bg-white/[0.08] px-3 py-2 hover:bg-white/[0.14] hover:border-white/30 transition-colors"
    >
      <Ico size={15} style={{ color }} />
      <span className="flex flex-col items-start leading-tight">
        <span className="font-mono font-medium text-base text-white">{value}</span>
        <span className="text-xxs uppercase tracking-wide text-white/55">{label}</span>
      </span>
    </button>
  );
}
type Icon2 = typeof IconCalendarEvent;

function TypeChip({ active, onClick, label, color }: { active: boolean; onClick: () => void; label: string; color?: string }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
        active ? "bg-[#151936] text-white border-[#151936]" : "bg-white text-slate-500 border-slate-200 hover:border-slate-300",
      )}
    >
      {color && <span className="size-1.5 rounded-full" style={{ background: active ? "#f3df27" : color }} />}
      {label}
    </button>
  );
}

function RailCard({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-slate-100 rounded-3xl shadow-[0_8px_30px_rgba(0,0,0,0.04)] p-4">
      <p className="text-base font-medium text-slate-800">{title}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5 mb-3 leading-snug">{sub}</p>}
      {!sub && <div className="mb-3" />}
      {children}
    </div>
  );
}

// ── Event drawer ─────────────────────────────────────────────────────────────

function EventDrawer({
  event, staffById, onClose, onShift, onCancel, onNotify,
}: {
  event: CalendarEventRow | null;
  staffById: Map<string, StaffUser>;
  onClose: () => void;
  onShift: (e: CalendarEventRow, days: number) => void;
  onCancel: (e: CalendarEventRow) => void;
  onNotify: (e: CalendarEventRow) => void;
}) {
  if (!event) return null;
  const meta = eventTypeMeta(event.type);
  const organizer = staffById.get(event.organizerId);
  const linkHref = event.maintenanceRequestId ? `/admin/maintenance/${event.maintenanceRequestId}` : null;

  return (
    <Drawer
      open
      onClose={onClose}
      title={event.title}
      width="27rem"
      footer={
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => onCancel(event)} className="rounded-xl border border-rose-200 bg-white px-3.5 py-2.5 text-xs font-medium text-rose-600 hover:bg-rose-50">Cancel event</button>
          <button onClick={() => onNotify(event)} className="ml-auto rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50">Re-notify</button>
          <button onClick={() => onShift(event, 1)} className="rounded-xl bg-[#151936] px-4 py-2.5 text-xs font-medium text-white hover:opacity-90">Move +1 day</button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium" style={{ background: `${meta.color}14`, color: meta.color }}>
            <meta.icon size={13} /> {meta.label}
          </span>
          <span className="font-mono font-medium text-xs text-slate-600">
            {new Date(event.startsAt).toLocaleDateString("en-KE", { day: "numeric", month: "short" })} · {hhmm(event.startsAt)}–{hhmm(event.endsAt)}
          </span>
          <span className="text-xs text-slate-400">{durationLabel(event.startsAt, event.endsAt)}</span>
        </div>

        {event.isCritical && (
          <div className="flex items-start gap-2.5 rounded-2xl border border-rose-200 bg-rose-50 px-3.5 py-3">
            <IconAlertTriangle size={16} className="text-rose-600 mt-0.5 shrink-0" />
            <p className="text-xs text-rose-800 leading-relaxed">
              Flagged critical. Notified roles receive an in-app alert immediately — SMS escalation is pending a provider.
            </p>
          </div>
        )}

        <div>
          <p className="label-caps text-slate-400 mb-1.5">Details</p>
          <p className="text-sm text-slate-700 leading-relaxed">{event.description ?? "No description provided."}</p>
          {event.location && <p className="text-xs text-slate-400 mt-1.5">Location · {event.location}</p>}
          {organizer && <p className="text-xs text-slate-400 mt-0.5">Organised by {organizer.name}</p>}
        </div>

        {linkHref && (
          <Link href={linkHref} className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-[#fafbf8] px-3.5 py-3 hover:bg-slate-50 transition-colors">
            <span className="size-9 rounded-xl bg-[rgba(18,42,32,0.08)] text-[#122a20] flex items-center justify-center shrink-0"><IconLink size={17} /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-slate-900">Linked work order</span>
              <span className="block text-xs text-slate-400">Open the linked record</span>
            </span>
            <IconArrowUpRight size={15} className="text-slate-400" />
          </Link>
        )}

        <div>
          <p className="label-caps text-slate-400 mb-2">Notify roles</p>
          <div className="flex flex-col gap-1.5">
            {(event.notifyRoleTiers ?? []).length === 0 ? (
              <p className="text-xs text-slate-400">No roles selected for this event.</p>
            ) : (event.notifyRoleTiers ?? []).map((r) => (
              <div key={r} className="flex items-center gap-2.5 rounded-xl border border-slate-100 bg-[#fafbf8] px-3 py-2">
                <span className="size-2 rounded-full bg-emerald-500 shrink-0" />
                <span className="flex-1 text-sm text-slate-700 capitalize">{r}</span>
                <span className="text-xxs font-medium uppercase tracking-wide text-slate-400">In-app</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="label-caps text-slate-400 mb-2">Attendees</p>
          <div className="flex gap-2 flex-wrap">
            {(event.attendees ?? []).length === 0 ? (
              <p className="text-xs text-slate-400">No attendees recorded.</p>
            ) : (event.attendees ?? []).map((a, i) => (
              <span key={i} className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 border border-slate-100 px-2.5 py-1 text-xs text-slate-600">
                <span className="size-5 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-xxs">{initialsOf(a.name)}</span>
                {a.name}
              </span>
            ))}
          </div>
        </div>
      </div>
    </Drawer>
  );
}

// ── New event modal ──────────────────────────────────────────────────────────

function NewEventModal({
  open, entityId, projects, defaultDate, onClose, onCreated,
}: {
  open: boolean;
  entityId: string;
  projects: ProjectRow[];
  defaultDate: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { pushToast } = useToast();
  const [form, setForm] = useState({
    title: "", type: "internal" as EventType, date: defaultDate,
    start: "09:00", end: "10:00", location: "", projectId: "",
    description: "", isCritical: false,
  });
  const [tiers, setTiers] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  // Follow the day the user picked on the calendar. Deferred off the effect
  // body per the cascading-render rule (SKILL.md #1).
  useEffect(() => {
    Promise.resolve().then(() => setForm((f) => ({ ...f, date: defaultDate })));
  }, [defaultDate]);

  const submit = async () => {
    if (!form.title.trim() || !form.date) {
      pushToast({ tone: "warning", title: "Missing details", body: "A title and date are required." });
      return;
    }
    const startsAt = new Date(`${form.date}T${form.start}:00`);
    const endsAt = new Date(`${form.date}T${form.end}:00`);
    if (endsAt <= startsAt) {
      pushToast({ tone: "warning", title: "Invalid time range", body: "The end time must be after the start time." });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/scheduling/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityId,
          title: form.title.trim(),
          description: form.description || undefined,
          type: form.type,
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
          location: form.location || undefined,
          projectId: form.projectId || undefined,
          isCritical: form.isCritical,
          notifyRoleTiers: tiers,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed to schedule");
      pushToast({ tone: "success", title: "Event scheduled", body: `"${form.title.trim()}" is on the calendar.` });
      setForm((f) => ({ ...f, title: "", location: "", description: "", isCritical: false }));
      setTiers([]);
      onCreated();
    } catch (err) {
      pushToast({ tone: "error", title: "Couldn't schedule", body: err instanceof Error ? err.message : "Try again." });
    } finally {
      setBusy(false);
    }
  };

  const field = "w-full box-border border border-slate-200 rounded-lg h-10 px-3 text-sm text-slate-800 outline-none focus:border-[#151936]/40 transition-colors";

  return (
    <Modal open={open} onClose={onClose} title="Schedule an event" description="Everything here is real — notified roles receive in-app alerts immediately." size="md">
      <div className="flex flex-col gap-3.5">
        <div>
          <label className="label-caps text-slate-400 mb-1.5 block">Title</label>
          <input className={field} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Escrow signing — Muthaiga Estate" autoFocus />
        </div>

        <div>
          <label className="label-caps text-slate-400 mb-1.5 block">Type</label>
          <div className="flex gap-1.5 flex-wrap">
            {EVENT_TYPE_ORDER.map((t) => (
              <button
                key={t}
                onClick={() => setForm({ ...form, type: t })}
                aria-pressed={form.type === t}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                  form.type === t ? "bg-[#151936] text-white border-[#151936]" : "bg-white text-slate-500 border-slate-200 hover:border-slate-300",
                )}
              >{eventTypeMeta(t).short}</button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="label-caps text-slate-400 mb-1.5 block">Date</label>
            <input type="date" className={field} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </div>
          <div>
            <label className="label-caps text-slate-400 mb-1.5 block">Start</label>
            <input type="time" className={cn(field, "font-mono")} value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} />
          </div>
          <div>
            <label className="label-caps text-slate-400 mb-1.5 block">End</label>
            <input type="time" className={cn(field, "font-mono")} value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label-caps text-slate-400 mb-1.5 block">Location</label>
            <input className={field} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Optional" />
          </div>
          <div>
            <label className="label-caps text-slate-400 mb-1.5 block">Linked project</label>
            <select className={cn(field, "bg-white")} value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })}>
              <option value="">None</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="label-caps text-slate-400 mb-1.5 block">Notify roles</label>
          <div className="flex gap-1.5 flex-wrap">
            {ROLE_TIER_OPTIONS.map((r) => {
              const on = tiers.includes(r.value);
              return (
                <button
                  key={r.value}
                  onClick={() => setTiers((prev) => (on ? prev.filter((v) => v !== r.value) : [...prev, r.value]))}
                  aria-pressed={on}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                    on ? "bg-[#122a20] text-white border-[#122a20]" : "bg-white text-slate-500 border-slate-200 hover:border-slate-300",
                  )}
                >{r.label}</button>
              );
            })}
          </div>
          <p className="text-xs text-slate-400 mt-1.5">In-app alerts are delivered immediately. SMS delivery is pending a provider.</p>
        </div>

        <div>
          <label className="label-caps text-slate-400 mb-1.5 block">Notes</label>
          <textarea
            className="w-full box-border border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 resize-none h-20 outline-none focus:border-[#151936]/40 transition-colors"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Agenda items or context"
          />
        </div>

        <label className="flex items-center gap-2.5 cursor-pointer">
          <input type="checkbox" checked={form.isCritical} onChange={(e) => setForm({ ...form, isCritical: e.target.checked })} className="size-4 rounded accent-[#151936]" />
          <span className="text-sm text-slate-700">Flag as critical</span>
        </label>

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
          <Button variant="secondary" size="sm" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button size="sm" onClick={submit} disabled={busy || !form.title.trim()}>{busy ? "Scheduling…" : "Schedule event"}</Button>
        </div>
      </div>
    </Modal>
  );
}
