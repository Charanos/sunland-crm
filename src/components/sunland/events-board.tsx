"use client";

import { useCallback, useEffect, useState } from "react";
import {
  IconAlertTriangle,
  IconCalendarEvent,
  IconCheck,
  IconClock,
  IconGavel,
  IconMapPin,
  IconPlus,
  IconTool,
  IconTrash,
  IconVideo,
  IconX,
} from "@tabler/icons-react";
import Link from "next/link";
import { Badge, BoardHeader, BoardPanel, Button, KpiCard } from "@/components/ui/erp-primitives";
import { EmptyState } from "@/components/ui/empty-state";
import { Modal } from "@/components/ui/modal";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { PageTransition } from "@/components/shared/page-transition";
import { useToast } from "@/components/ui/toast-provider";
import { cn } from "@/lib/utils/cn";

type EventType = "internal" | "external" | "legal" | "maintenance";
type EventOutcome = "pending" | "completed" | "deferred" | "cancelled" | "no_show";

interface CalendarEventRow {
  id: string;
  title: string;
  description: string | null;
  type: EventType;
  startsAt: string;
  endsAt: string;
  location: string | null;
  attendees: Array<{ name: string; email?: string; userId?: string }>;
  projectId: string | null;
  outcome: EventOutcome;
  needsDisposition: boolean;
}

interface ProjectOption {
  id: string;
  title: string;
}

const TYPE_META: Record<EventType, { label: string; icon: typeof IconVideo; tone: "data" | "success" | "warning" | "risk" }> = {
  internal: { label: "Internal Meeting", icon: IconVideo, tone: "data" },
  external: { label: "External / Viewing", icon: IconMapPin, tone: "success" },
  legal: { label: "Legal / Escrow", icon: IconGavel, tone: "warning" },
  maintenance: { label: "Site Inspection", icon: IconTool, tone: "risk" },
};

const OUTCOME_OPTIONS: { value: EventOutcome; label: string }[] = [
  { value: "completed", label: "Completed" },
  { value: "deferred", label: "Deferred" },
  { value: "cancelled", label: "Cancelled" },
  { value: "no_show", label: "No-show" },
];

const EMPTY_FORM = {
  title: "",
  description: "",
  type: "internal" as EventType,
  date: "",
  startTime: "09:00",
  endTime: "10:00",
  location: "",
  projectId: "",
  attendeeNames: "",
};

function groupByDay(events: CalendarEventRow[]): Array<[string, CalendarEventRow[]]> {
  const groups = new Map<string, CalendarEventRow[]>();
  for (const event of events) {
    const key = new Date(event.startsAt).toDateString();
    const list = groups.get(key) ?? [];
    list.push(event);
    groups.set(key, list);
  }
  return Array.from(groups.entries()).sort(
    (a, b) => new Date(a[1][0].startsAt).getTime() - new Date(b[1][0].startsAt).getTime(),
  );
}

export function EventsBoard({ entityId = "group" }: { entityId?: string }) {
  const { pushToast } = useToast();
  const [events, setEvents] = useState<CalendarEventRow[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<EventType | "all">("all");
  const [dispositionOnly, setDispositionOnly] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadEvents = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/scheduling/events?entityId=${entityId}&scope=all`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load events");
      setEvents(data.events ?? []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load events";
      pushToast({ tone: "error", title: "Error", body: message });
    } finally {
      setIsLoading(false);
    }
  }, [entityId, pushToast]);

  useEffect(() => {
    Promise.resolve().then(() => {
      loadEvents();
      fetch(`/api/operations/projects?entityId=${entityId}`)
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data.projects)) setProjects(data.projects);
        })
        .catch(() => { });
    });
  }, [loadEvents, entityId]);

  const openCreateModal = () => {
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.title.trim() || !form.date) {
      pushToast({ tone: "error", title: "Missing details", body: "Title and date are required." });
      return;
    }
    setIsSaving(true);
    try {
      const startsAt = new Date(`${form.date}T${form.startTime}:00`);
      const endsAt = new Date(`${form.date}T${form.endTime}:00`);
      if (endsAt <= startsAt) {
        pushToast({ tone: "error", title: "Invalid time range", body: "End time must be after start time." });
        setIsSaving(false);
        return;
      }

      const attendees = form.attendeeNames
        .split(",")
        .map((name) => name.trim())
        .filter(Boolean)
        .map((name) => ({ name }));

      const res = await fetch("/api/scheduling/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityId,
          title: form.title,
          description: form.description || undefined,
          type: form.type,
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
          location: form.location || undefined,
          attendees,
          projectId: form.projectId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to schedule event");

      pushToast({ tone: "success", title: "Event Scheduled", body: `"${form.title}" has been added.` });
      setModalOpen(false);
      loadEvents();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to schedule event";
      pushToast({ tone: "error", title: "Error", body: message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSetOutcome = async (event: CalendarEventRow, outcome: EventOutcome) => {
    setBusyId(event.id);
    try {
      const res = await fetch(`/api/scheduling/events/${event.id}/outcome`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outcome }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update outcome");
      pushToast({ tone: "success", title: "Event Resolved", body: `Marked "${event.title}" as ${outcome.replace("_", " ")}.` });
      loadEvents();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update outcome";
      pushToast({ tone: "error", title: "Error", body: message });
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (event: CalendarEventRow) => {
    setBusyId(event.id);
    try {
      const res = await fetch(`/api/scheduling/events?id=${event.id}&entityId=${entityId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete event");
      pushToast({ tone: "success", title: "Event Deleted", body: `"${event.title}" has been removed.` });
      loadEvents();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete event";
      pushToast({ tone: "error", title: "Error", body: message });
    } finally {
      setBusyId(null);
    }
  };

  const filtered = events.filter((e) => {
    if (typeFilter !== "all" && e.type !== typeFilter) return false;
    if (dispositionOnly && !e.needsDisposition) return false;
    return true;
  });
  const upcomingCount = events.filter((e) => new Date(e.startsAt) >= new Date()).length;
  const needsDispositionCount = events.filter((e) => e.needsDisposition).length;
  const grouped = groupByDay(filtered);

  return (
    <PageTransition className="mx-auto flex max-w-[98rem] flex-col gap-4">
      <BoardHeader
        eyebrow={<Badge tone="data">Operations</Badge>}
        title="Events"
        description="Every scheduled meeting, viewing, legal deadline, and inspection across the org - the full record behind the Executive Scheduler."
        actions={
          <Button size="sm" onClick={openCreateModal}>
            <IconPlus size={14} /> Schedule Event
          </Button>
        }
      />

      {/* ── Scheduling Hub Navigator ── */}
      <div className="flex items-center justify-between flex-wrap gap-4 bg-white border border-slate-100 p-4 rounded-[20px] shadow-sm">
        <div className="flex items-center gap-2">
          <div className="size-8 rounded-lg bg-indigo-50 text-indigo-650 flex items-center justify-center">
            <IconCalendarEvent size={16} />
          </div>
          <div>
            <h3 className="text-base font-medium text-slate-800 leading-none">Scheduling Hub</h3>
            <p className="text-sm text-slate-400 mt-1">Coordinate cross-department projects and calendar events.</p>
          </div>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-xl flex-wrap gap-1">
          <Link
            href="/admin/projects"
            className="body-sm px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 text-slate-400 hover:text-slate-900 hover:bg-white/45"
          >
            <span>Projects</span>
          </Link>
          <Link
            href="/admin/events"
            className="body-sm px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 bg-[#151936] text-white shadow-sm"
          >
            <span>Events</span>
            <span className="bg-[#f3df27] text-[#151936] px-1.5 py-0.2 rounded-full text-meta-muted-strong">Active</span>
          </Link>
        </div>
      </div>

      <div className="gsap-stagger grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard icon={IconCalendarEvent} label="Total Events" value={String(events.length)} tone="neutral" />
        <KpiCard icon={IconClock} label="Upcoming" value={String(upcomingCount)} tone="data" />
        <KpiCard icon={IconAlertTriangle} label="Needs Disposition" value={String(needsDispositionCount)} tone="warning" />
        <KpiCard icon={IconCheck} label="Resolved" value={String(events.filter((e) => e.outcome !== "pending").length)} tone="success" />
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => setTypeFilter("all")}
          className={cn(
            "px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all",
            typeFilter === "all" ? "bg-[#151936] text-white shadow-sm" : "bg-slate-100 text-slate-400 hover:bg-slate-200/60",
          )}
        >
          All Types
        </button>
        {(Object.keys(TYPE_META) as EventType[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTypeFilter(t)}
            className={cn(
              "px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all",
              typeFilter === t ? "bg-[#151936] text-white shadow-sm" : "bg-slate-100 text-slate-400 hover:bg-slate-200/60",
            )}
          >
            {TYPE_META[t].label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setDispositionOnly((v) => !v)}
          className={cn(
            "ml-auto px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all border",
            dispositionOnly ? "bg-rose-50 text-rose-600 border-rose-200" : "bg-white text-slate-400 border-slate-200 hover:border-slate-300",
          )}
        >
          Needs Disposition Only
        </button>
      </div>

      <BoardPanel className="p-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <LoadingSpinner size="md" />
          </div>
        ) : grouped.length === 0 ? (
          <EmptyState
            icon={IconCalendarEvent}
            title="No events found"
            description="Scheduled events across every department will appear here."
            action="Schedule Event"
            onClick={openCreateModal}
          />
        ) : (
          <div className="space-y-8">
            {grouped.map(([day, dayEvents]) => (
              <div key={day}>
                <h3 className="label-caps text-slate-400 mb-3">
                  {new Date(dayEvents[0].startsAt).toLocaleDateString("en-KE", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                </h3>
                <div className="space-y-2.5">
                  {dayEvents.map((event) => {
                    const meta = TYPE_META[event.type];
                    const project = projects.find((p) => p.id === event.projectId);
                    return (
                      <div key={event.id} className="flex items-start gap-4 rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm hover:shadow-md hover:border-slate-300 transition-all">
                        <div className="flex flex-col items-center justify-center shrink-0 w-16 pr-3 border-r border-slate-100 text-slate-700">
                          <span className="mono-data text-base">
                            {new Date(event.startsAt).toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <h4 className="text-body-primary text-slate-900 truncate">{event.title}</h4>
                              {event.description && <p className="text-body-regular text-slate-400 mt-0.5">{event.description}</p>}
                            </div>
                            <button
                              type="button"
                              onClick={() => handleDelete(event)}
                              disabled={busyId === event.id}
                              className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-colors"
                              aria-label="Delete event"
                            >
                              <IconTrash size={15} />
                            </button>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 mt-2">
                            <Badge tone={meta.tone}>{meta.label}</Badge>
                            {event.location && (
                              <span className="text-meta-muted-strong flex items-center gap-1">
                                <IconMapPin size={12} /> {event.location}
                              </span>
                            )}
                            {project && <Badge tone="neutral">{project.title}</Badge>}
                            {event.outcome !== "pending" && (
                              <Badge tone="success">{event.outcome.replace("_", " ")}</Badge>
                            )}
                          </div>
                          {event.needsDisposition && (
                            <div className="flex flex-wrap items-center gap-1.5 mt-3 bg-rose-50/50 border border-rose-100 rounded-lg p-2.5">
                              <span className="text-meta-muted-strong text-rose-600 mr-1">Resolve:</span>
                              {OUTCOME_OPTIONS.map((opt) => (
                                <button
                                  key={opt.value}
                                  type="button"
                                  onClick={() => handleSetOutcome(event, opt.value)}
                                  disabled={busyId === event.id}
                                  className="px-2.5 py-1 rounded-md text-sm font-medium bg-white border border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50 transition-colors"
                                >
                                  {opt.label}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </BoardPanel>

      <Modal
        open={modalOpen}
        onClose={() => !isSaving && setModalOpen(false)}
        title="Schedule Event"
        description="Full event details, including attendees and an optional project link"
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="label-caps text-slate-400 mb-1.5 block">Title</label>
            <input
              className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-base text-slate-800 focus:outline-none focus:border-[#151936]/40 transition-colors"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Escrow signing - Muthaiga Estate"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label-caps text-slate-400 mb-1.5 block">Date</label>
              <input
                type="date"
                className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-base text-slate-800 focus:outline-none focus:border-[#151936]/40 transition-colors"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              />
            </div>
            <div>
              <label className="label-caps text-slate-400 mb-1.5 block">Start</label>
              <input
                type="time"
                className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-base mono-data text-slate-800 focus:outline-none focus:border-[#151936]/40 transition-colors"
                value={form.startTime}
                onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
              />
            </div>
            <div>
              <label className="label-caps text-slate-400 mb-1.5 block">End</label>
              <input
                type="time"
                className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-base mono-data text-slate-800 focus:outline-none focus:border-[#151936]/40 transition-colors"
                value={form.endTime}
                onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <label className="label-caps text-slate-400 mb-1.5 block">Type</label>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(TYPE_META) as EventType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, type: t }))}
                  className={cn(
                    "px-3.5 py-1.5 rounded-lg text-sm font-medium border transition-all",
                    form.type === t ? "bg-[#151936] text-white border-[#151936]" : "bg-white text-slate-400 border-slate-200 hover:border-slate-300",
                  )}
                >
                  {TYPE_META[t].label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-caps text-slate-400 mb-1.5 block">Location</label>
              <input
                className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-base text-slate-800 focus:outline-none focus:border-[#151936]/40 transition-colors"
                value={form.location}
                onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                placeholder="Optional"
              />
            </div>
            <div>
              <label className="label-caps text-slate-400 mb-1.5 block">Linked Project</label>
              <select
                className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-base text-slate-800 focus:outline-none focus:border-[#151936]/40 transition-colors"
                value={form.projectId}
                onChange={(e) => setForm((f) => ({ ...f, projectId: e.target.value }))}
              >
                <option value="">None</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="label-caps text-slate-400 mb-1.5 block">Attendees</label>
            <input
              className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-base text-slate-800 focus:outline-none focus:border-[#151936]/40 transition-colors"
              value={form.attendeeNames}
              onChange={(e) => setForm((f) => ({ ...f, attendeeNames: e.target.value }))}
              placeholder="Comma-separated names"
            />
          </div>

          <div>
            <label className="label-caps text-slate-400 mb-1.5 block">Notes</label>
            <textarea
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-base text-slate-800 resize-none h-20 focus:outline-none focus:border-[#151936]/40 transition-colors"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Agenda items or context"
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
            <Button type="button" variant="secondary" size="sm" onClick={() => setModalOpen(false)} disabled={isSaving}>
              <IconX size={14} /> Cancel
            </Button>
            <Button type="button" size="sm" onClick={handleSubmit} disabled={isSaving}>
              {isSaving ? "Scheduling…" : "Schedule Event"}
            </Button>
          </div>
        </div>
      </Modal>
    </PageTransition>
  );
}
