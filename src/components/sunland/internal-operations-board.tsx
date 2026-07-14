"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  IconCalendarEvent,
  IconClock,
  IconUsers,
  IconVideo,
  IconBriefcase,
  IconGavel,
  IconTool,
  IconPlus,
  IconChevronLeft,
  IconChevronRight,
  IconMapPin,
  IconTrash,
  IconCheck,
  IconX,
  IconArrowsMaximize
} from "@tabler/icons-react";
import { useToast } from "@/components/ui/toast-provider";
import { BoardPanel } from "@/components/ui/erp-primitives";
import { EventFormModal } from "./event-form-modal";
import { ProjectDetailModal } from "./project-detail-modal";
import { CalendarModal } from "@/components/ui/calendar-modal";
import { cn } from "@/lib/utils/cn";

// Matches the real /api/scheduling/events response shape (calendar_events
// table) - startsAt/endsAt are full ISO timestamps, not separate date/time
// strings, and attendees is a list, not a headcount.
interface Event {
  id: string;
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string;
  type: "internal" | "external" | "legal" | "maintenance";
  location: string | null;
  attendees: Array<{ name: string; email?: string; userId?: string }>;
  outcome: "pending" | "completed" | "deferred" | "cancelled" | "no_show";
  needsDisposition: boolean;
}

interface Project {
  id: string;
  title: string;
  description: string | null;
  department: "sales" | "ops" | "legal" | "finance" | "hr" | "front_office";
  status: "planning" | "in_progress" | "awaiting_review" | "on_hold" | "completed";
  progressPercent: number | null;
  assigneeIds: string[];
  dueDate: string | null;
}

const PROJECT_DEPARTMENT_STYLES: Record<Project["department"], { dot: string; ring: string; bar: string; badge: string }> = {
  sales: { dot: "bg-teal-500 shadow-[0_0_8px_rgba(20,184,166,0.6)]", ring: "border-teal-200 text-teal-600", bar: "bg-teal-500", badge: "text-teal-700 bg-teal-50 border-teal-100" },
  legal: { dot: "bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.6)]", ring: "border-indigo-200 text-indigo-600", bar: "bg-indigo-500", badge: "text-indigo-700 bg-indigo-50 border-indigo-100" },
  ops: { dot: "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]", ring: "border-amber-200 text-amber-600", bar: "bg-amber-500", badge: "text-amber-700 bg-amber-50 border-amber-100" },
  finance: { dot: "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]", ring: "border-emerald-200 text-emerald-600", bar: "bg-emerald-500", badge: "text-emerald-700 bg-emerald-50 border-emerald-100" },
  hr: { dot: "bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.6)]", ring: "border-purple-200 text-purple-600", bar: "bg-purple-500", badge: "text-purple-700 bg-purple-50 border-purple-100" },
  front_office: { dot: "bg-sky-500 shadow-[0_0_8px_rgba(14,165,233,0.6)]", ring: "border-sky-200 text-sky-600", bar: "bg-sky-500", badge: "text-sky-700 bg-sky-50 border-sky-100" },
};

const PROJECT_STATUS_LABEL: Record<Project["status"], string> = {
  planning: "Planning",
  in_progress: "In Progress",
  awaiting_review: "Awaiting Review",
  on_hold: "On Hold",
  completed: "Completed",
};

function formatEventTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" });
}

function isSameCalendarDay(iso: string, year: number, month: number, day: number): boolean {
  const d = new Date(iso);
  return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
}

export function InternalOperationsBoard({
  entityId = "group",
  departmentStats = { sales: 0, ops: 0, legal: 0 },
}: {
  entityId?: string;
  // The parent (dashboard-overview.tsx) already fetches the full
  // /api/dashboard/overview payload on mount - receiving this as a prop
  // avoids a second, redundant full-dashboard-aggregation round-trip just
  // to read one field off it.
  departmentStats?: { sales: number; ops: number; legal: number };
}) {
  const { pushToast } = useToast();

  // Real calendar state
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [eventForEdit, setEventForEdit] = useState<Event | null>(null);
  const [calendarModalOpen, setCalendarModalOpen] = useState(false);

  const [events, setEvents] = useState<Event[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  const loadEvents = useCallback(() => {
    // scope=all: this is an org-wide executive view, not "my calendar" - the
    // default "mine" scope would hide every event organized by someone else.
    fetch(`/api/scheduling/events?entityId=${entityId}&scope=all`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.events)) setEvents(data.events);
      })
      .catch((e) => console.error(e));
  }, [entityId]);

  useEffect(() => {
    loadEvents();

    fetch(`/api/operations/projects?entityId=${entityId}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.projects)) setProjects(data.projects);
      })
      .catch((e) => console.error(e));
  }, [entityId, loadEvents]);

  // Calendar logic
  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));

  const daysInMonth = getDaysInMonth(currentDate.getFullYear(), currentDate.getMonth());
  const firstDay = getFirstDayOfMonth(currentDate.getFullYear(), currentDate.getMonth());

  const calendarDays = useMemo(() => {
    const days = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);
    return days;
  }, [daysInMonth, firstDay]);

  const selectedDateEvents = events
    .filter((e) =>
      isSameCalendarDay(e.startsAt, selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate()),
    )
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());

  const hasEvents = (day: number) =>
    events.some((e) => isSameCalendarDay(e.startsAt, currentDate.getFullYear(), currentDate.getMonth(), day));

  // "30m"/"1h"/"1.5h"/"2h"/"3h"/"4h"/"All Day" from EventFormModal's duration
  // select, converted to minutes to compute endsAt from the chosen startsAt.
  function parseDurationMinutes(duration: string): number {
    if (duration === "All Day") return 24 * 60;
    const match = duration.match(/^([\d.]+)(m|h)$/);
    if (!match) return 60;
    const value = parseFloat(match[1]);
    return match[2] === "h" ? value * 60 : value;
  }

  // Inverse of parseDurationMinutes - snaps an event's real startsAt/endsAt
  // gap to the closest option in the duration select, so editing an event
  // pre-fills its actual length instead of silently defaulting to 1h and
  // truncating/extending it on save if the user doesn't touch the field.
  const DURATION_OPTIONS_MINUTES: Array<[string, number]> = [
    ["30m", 30], ["1h", 60], ["1.5h", 90], ["2h", 120], ["3h", 180], ["4h", 240], ["All Day", 24 * 60],
  ];
  function computeDurationLabel(startsAt: string, endsAt: string): string {
    const actualMinutes = (new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 60_000;
    if (!Number.isFinite(actualMinutes) || actualMinutes <= 0) return "1h";
    const [closest] = DURATION_OPTIONS_MINUTES.reduce((best, option) =>
      Math.abs(option[1] - actualMinutes) < Math.abs(best[1] - actualMinutes) ? option : best,
    );
    return closest;
  }

  const handleCreateEvent = async (data: { title: string; date: string; time: string; duration: string; type: string; description: string }) => {
    try {
      const startsAt = new Date(`${data.date}T${data.time}:00`);
      const endsAt = new Date(startsAt.getTime() + parseDurationMinutes(data.duration) * 60_000);

      const res = await fetch("/api/scheduling/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityId,
          title: data.title,
          description: data.description || undefined,
          type: data.type,
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
          location: "TBD", // Modal can be expanded later
          attendees: [],
        }),
      });
      if (!res.ok) throw new Error("Failed to schedule event");

      const { event: newEvent } = await res.json();
      setEvents((prev) => [...prev, newEvent]);
      setSelectedDate(startsAt);
      pushToast({ tone: "success", title: "Event Scheduled", body: `"${data.title}" has been added to your itinerary.` });
      return true;
    } catch {
      pushToast({ tone: "warning", title: "Error", body: "Could not schedule event." });
      return false;
    }
  };

  const handleEditEvent = async (eventId: string, data: { title: string; date: string; time: string; duration: string; type: string; description: string }) => {
    try {
      const startsAt = new Date(`${data.date}T${data.time}:00`);
      const endsAt = new Date(startsAt.getTime() + parseDurationMinutes(data.duration) * 60_000);

      const res = await fetch(`/api/scheduling/events?id=${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityId,
          title: data.title,
          description: data.description || undefined,
          type: data.type,
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
        }),
      });
      if (!res.ok) throw new Error("Failed to update event");

      const { event: updatedEvent } = await res.json();
      setEvents((prev) => prev.map((e) => e.id === eventId ? updatedEvent : e));
      setSelectedDate(startsAt);
      setEventForEdit(null);
      pushToast({ tone: "success", title: "Event Updated", body: `"${data.title}" has been updated.` });
      return true;
    } catch {
      pushToast({ tone: "warning", title: "Error", body: "Could not update event." });
      return false;
    }
  };

  const handleSetOutcome = async (eventId: string, outcome: "completed" | "cancelled") => {
    try {
      // Outcome is a dedicated action, not a generic field update - updateCalendarEventSchema
      // has no `outcome` field, so PATCHing the update endpoint silently strips it (Zod
      // drops unrecognized keys) and the DB row never changes. This is the real endpoint.
      const res = await fetch(`/api/scheduling/events/${eventId}/outcome`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outcome })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed to mark event as ${outcome}`);
      setEvents((prev) => prev.map((e) => e.id === eventId ? { ...e, outcome, needsDisposition: false } : e));
      pushToast({ tone: "success", title: "Event Updated", body: `Event marked as ${outcome}.` });
    } catch (err) {
      const message = err instanceof Error ? err.message : `Could not mark event as ${outcome}.`;
      pushToast({ tone: "warning", title: "Error", body: message });
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!confirm("Are you sure you want to cancel this event?")) return;
    try {
      const res = await fetch(`/api/scheduling/events?id=${eventId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete event");
      setEvents((prev) => prev.filter((e) => e.id !== eventId));
      pushToast({ tone: "success", title: "Event Cancelled", body: "The event has been removed from your itinerary." });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not delete event.";
      pushToast({ tone: "warning", title: "Error", body: message });
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    if (!confirm("Are you sure you want to delete this project?")) return;
    try {
      const res = await fetch(`/api/operations/projects/${projectId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete project");
      setProjects((prev) => prev.filter((p) => p.id !== projectId));
      pushToast({ tone: "success", title: "Project Deleted", body: "The project has been removed." });
    } catch (err) {
      // Surfaces deleteProject's ConflictError message ("Cannot delete
      // project with N linked calendar event(s)...") instead of a generic toast.
      const message = err instanceof Error ? err.message : "Could not delete project.";
      pushToast({ tone: "warning", title: "Error", body: message });
    }
  };

  const TYPE_STYLES = {
    internal: { bg: "bg-emerald-50", text: "text-emerald-700", icon: IconVideo, accent: "bg-emerald-500", iconColor: "text-emerald-500" },
    external: { bg: "bg-sky-50", text: "text-sky-700", icon: IconMapPin, accent: "bg-sky-500", iconColor: "text-sky-500" },
    legal: { bg: "bg-indigo-50", text: "text-indigo-700", icon: IconGavel, accent: "bg-indigo-500", iconColor: "text-indigo-500" },
    maintenance: { bg: "bg-amber-50", text: "text-amber-700", icon: IconTool, accent: "bg-amber-500", iconColor: "text-amber-500" },
  };

  const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="w-full my-12 md:my-16">
      {/* ── Section Header ── */}
      <div className="py-6 border-t border-slate-200/60 flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-2">
        <div>
          <h2 className="title-serif flex items-center gap-3">
            Internal Structure & Scheduler
          </h2>
          <p className="text-meta-muted tracking-wide mt-1">High-level operations breakdown and executive itinerary.</p>
        </div>

        <button
          onClick={() => setEventModalOpen(true)}
          className="group flex items-center gap-2 bg-tertiary-gradient text-white px-5 py-2.5 rounded-xl text-sm shadow-sm hover:shadow hover:opacity-95 transition-all"
        >
          <IconPlus size={18} stroke={2} className="group-hover:scale-110 transition-transform" />
          <span>Schedule Event</span>
        </button>
      </div>

      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch w-full">

        {/* ── Firm Operations (Left) ── */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          {/* Department Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Link href="/admin/pipeline" className="group">
              <div className="bg-gradient-to-br from-white to-teal-50/30 p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md hover:border-slate-300 hover:to-teal-50/60 transition-all relative overflow-hidden flex flex-col justify-between h-[155px] cursor-pointer">
                <IconBriefcase size={120} stroke={1} className="absolute -right-4 -bottom-4 text-teal-600 opacity-[0.03] group-hover:scale-110 group-hover:opacity-[0.06] transition-all duration-500 pointer-events-none" />
                <div className="absolute -right-4 -top-4 size-20 bg-teal-50/50 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="flex items-center justify-between relative z-10">
                  <div className="flex items-center gap-2">
                    <div className="size-9 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-700 shadow-sm">
                      <IconBriefcase size={18} stroke={1.5} />
                    </div>
                    <span className="text-sm font-medium text-slate-700">Sales</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-white border border-teal-100 px-2 py-1 rounded-lg text-xs text-teal-700 shadow-sm">
                    <span className="size-1.5 rounded-full bg-teal-500 animate-pulse shadow-[0_0_8px_rgba(20,184,166,0.8)]" />
                    <span className="label-caps">Active</span>
                  </div>
                </div>
                <div className="mt-auto flex items-end justify-between relative z-10">
                  <div>
                    <h3 className="text-4xl font-mono font-medium text-slate-900">{departmentStats.sales}</h3>
                    <p className="text-desc-secondary mt-1">Active Pipeline</p>
                  </div>
                  <div className="text-right">
                    <p className="text-teal-600 mono-data bg-teal-50/80 px-2 py-1 rounded-md border border-teal-100">Deals</p>
                  </div>
                </div>
              </div>
            </Link>

            <Link href="/admin/maintenance" className="group">
              <div className="bg-gradient-to-br from-white to-amber-50/30 p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md hover:border-slate-300 hover:to-amber-50/60 transition-all relative overflow-hidden flex flex-col justify-between h-[155px] cursor-pointer">
                <IconUsers size={120} stroke={1} className="absolute -right-4 -bottom-4 text-amber-600 opacity-[0.03] group-hover:scale-110 group-hover:opacity-[0.06] transition-all duration-500 pointer-events-none" />
                <div className="absolute -right-4 -top-4 size-20 bg-amber-50/50 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="flex items-center justify-between relative z-10">
                  <div className="flex items-center gap-2">
                    <div className="size-9 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-700 shadow-sm">
                      <IconUsers size={18} stroke={1.5} />
                    </div>
                    <span className="text-sm font-medium text-slate-700">Ops</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-white border border-amber-100 px-2 py-1 rounded-lg text-xs text-amber-700 shadow-sm">
                    <span className="size-1.5 rounded-full bg-amber-500 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.8)]" />
                    <span className="label-caps">Capacity</span>
                  </div>
                </div>
                <div className="mt-auto flex items-end justify-between relative z-10">
                  <div>
                    <h3 className="text-4xl font-mono font-medium text-slate-900">{departmentStats.ops}</h3>
                    <p className="text-desc-secondary mt-1">Open Maintenance</p>
                  </div>
                  <div className="text-right">
                    <p className="text-amber-600 mono-data bg-amber-50/80 px-2 py-1 rounded-md border border-amber-100">Active</p>
                  </div>
                </div>
              </div>
            </Link>

            <Link href="/admin/leases" className="group">
              <div className="bg-gradient-to-br from-white to-indigo-50/30 p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md hover:border-slate-300 hover:to-indigo-50/60 transition-all relative overflow-hidden flex flex-col justify-between h-[155px] cursor-pointer">
                <IconGavel size={120} stroke={1} className="absolute -right-4 -bottom-4 text-indigo-600 opacity-[0.03] group-hover:scale-110 group-hover:opacity-[0.06] transition-all duration-500 pointer-events-none" />
                <div className="absolute -right-4 -top-4 size-20 bg-indigo-50/50 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="flex items-center justify-between relative z-10">
                  <div className="flex items-center gap-2">
                    <div className="size-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700 shadow-sm">
                      <IconGavel size={18} stroke={1.5} />
                    </div>
                    <span className="text-sm font-medium text-slate-700">Legal</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-white border border-slate-200 px-2 py-1 rounded-lg text-xs text-slate-400 shadow-sm">
                    <span className="label-caps">Processing</span>
                  </div>
                </div>
                <div className="mt-auto flex items-end justify-between relative z-10">
                  <div>
                    <h3 className="text-4xl font-mono font-medium text-slate-900">{departmentStats.legal}</h3>
                    <p className="text-desc-secondary mt-1">Active Leases</p>
                  </div>
                  <div className="text-right">
                    <p className="text-indigo-600 mono-data bg-indigo-50/80 px-2 py-1 rounded-md border border-indigo-100">Pending</p>
                  </div>
                </div>
              </div>
            </Link>
          </div>

          {/* Active Workflows Timeline */}
          <BoardPanel className="flex flex-1 flex-col py-4 px-6">
            <div className="flex items-center justify-between mb-6 border-b border-slate-200/60 pb-4">
              <h3 className="text-title-secondary text-slate-900 flex items-center gap-2">
                Cross-Department Operations
              </h3>
              <Link
                href="/admin/projects"
                className="text-meta-muted-strong hover:text-slate-800 transition-colors bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm hover:shadow"
              >
                View All Projects
              </Link>
            </div>

            <div className="space-y-6 flex-1 overflow-y-auto custom-scrollbar pr-2 pb-2">
              {projects.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[180px] text-center bg-white rounded-xl border border-slate-200 border-dashed">
                  <div className="size-12 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 mb-3 border border-slate-100">
                    <IconBriefcase size={22} stroke={1.5} />
                  </div>
                  <p className="text-body-primary text-slate-600">No active projects yet.</p>
                  <p className="text-meta-muted mt-1">Create one from the Projects page to track it here.</p>
                </div>
              ) : (
                projects.slice(0, 3).map((project, i) => {
                  const style = PROJECT_DEPARTMENT_STYLES[project.department];
                  const isLast = i === Math.min(projects.length, 3) - 1;
                  return (
                    <div key={project.id} className="flex gap-4 relative group cursor-pointer" onClick={() => setSelectedProject(project)}>
                      {!isLast && (
                        <div className={cn("absolute left-[15px] top-[32px] bottom-[-24px] w-px bg-slate-200 transition-colors group-hover:bg-slate-300")} />
                      )}
                      <div className={cn("size-8 rounded-full bg-white border flex items-center justify-center shrink-0 z-10 shadow-sm group-hover:scale-110 transition-transform", style.ring)}>
                        <div className={cn("size-2.5 rounded-full", style.dot)} />
                      </div>
                      <div className="flex-1 bg-white hover:bg-slate-50 p-4 rounded-xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h4 className="text-body-primary text-slate-900">{project.title}</h4>
                            {project.description && (
                              <p className="text-body-regular text-slate-400 mt-1">{project.description}</p>
                            )}
                          </div>
                          <span className="bg-slate-50 border border-slate-200 text-slate-600 px-2.5 py-1 rounded-md shadow-sm label-caps capitalize">
                            {project.department.replace("_", " ")}
                          </span>
                        </div>

                        {project.status === "in_progress" && project.progressPercent !== null ? (
                          <div className="flex items-center gap-4 mt-4 bg-slate-50/50 p-3 rounded-lg border border-slate-100">
                            <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                              <div className={cn("h-full rounded-full", style.bar)} style={{ width: `${project.progressPercent}%` }} />
                            </div>
                            <span className={cn("mono-data whitespace-nowrap px-2 py-0.5 rounded border", style.badge)}>
                              {project.progressPercent}% Complete
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between mt-4 bg-slate-50/50 p-3 rounded-lg border border-slate-100">
                            {project.dueDate ? (
                              <span className="text-meta-muted-strong flex items-center gap-1.5">
                                <IconClock size={16} stroke={2} className="text-slate-400" />
                                {new Date(project.dueDate).toLocaleDateString("en-KE", { month: "long", day: "numeric", year: "numeric" })}
                              </span>
                            ) : (
                              <span className="text-meta-muted-strong">{project.assigneeIds.length} assignee{project.assigneeIds.length === 1 ? "" : "s"}</span>
                            )}
                            <span className={cn("mono-data px-2.5 py-1 rounded-md border", style.badge)}>
                              {PROJECT_STATUS_LABEL[project.status]}
                            </span>
                          </div>
                        )}
                        <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                          <Link href={`/admin/projects`} className="p-1.5 bg-white border border-slate-200 rounded-md text-slate-400 hover:text-slate-800 hover:bg-slate-50 shadow-sm transition-colors" title="Edit">
                            <IconBriefcase size={16} />
                          </Link>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteProject(project.id); }}
                            className="p-1.5 bg-rose-50 border border-rose-200 rounded-md text-rose-500 hover:text-rose-700 hover:bg-white shadow-sm transition-colors"
                            title="Delete"
                          >
                            <IconTrash size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </BoardPanel>
        </div>

        {/* ── Executive Scheduler (Right) ── */}
        <BoardPanel className="lg:col-span-5 flex flex-col p-6 sm:p-8 bg-white border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-[24px]">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6 pb-4 border-b border-slate-100/60">
            <h3 className="text-title-primary text-slate-900 flex items-center gap-3">
              <div className="size-8 rounded-[10px] bg-slate-50 text-slate-600 flex items-center justify-center border border-slate-200/60 shadow-sm">
                <IconCalendarEvent size={18} stroke={1.5} />
              </div>
              Executive Scheduler
            </h3>
            <div className="flex items-center gap-2 flex-wrap">
              <Link
                href="/admin/events"
                className="body-sm text-slate-400 hover:text-slate-900 transition-colors bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm hover:shadow"
              >
                View All
              </Link>
              <button
                onClick={() => setCalendarModalOpen(true)}
                className="text-slate-400 hover:text-slate-900 bg-white p-1.5 rounded-lg border border-slate-200 shadow-sm hover:shadow transition-all"
                title="Expand"
              >
                <IconArrowsMaximize size={16} stroke={2} />
              </button>
              <div className="flex items-center gap-1 bg-slate-50 rounded-lg border border-slate-200 p-1 shadow-sm">
                <button onClick={prevMonth} className="text-slate-400 hover:text-slate-900 hover:bg-white p-1 rounded-md transition-all">
                  <IconChevronLeft size={16} stroke={2} />
                </button>
                <span className="body-sm text-slate-800 w-24 sm:w-32 text-center truncate font-medium">
                  {currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                </span>
                <button onClick={nextMonth} className="text-slate-400 hover:text-slate-900 hover:bg-white p-1 rounded-md transition-all">
                  <IconChevronRight size={16} stroke={2} />
                </button>
              </div>
            </div>
          </div>

          {/* Real Calendar Grid */}
          <div className="grid grid-cols-7 gap-2 sm:gap-3 mb-8">
            {daysOfWeek.map(d => (
              <div key={d} className="text-center text-slate-400 mb-2 label-caps font-medium tracking-wider">{d}</div>
            ))}
            {calendarDays.map((day, i) => {
              const isSelected = day &&
                selectedDate.getDate() === day &&
                selectedDate.getMonth() === currentDate.getMonth() &&
                selectedDate.getFullYear() === currentDate.getFullYear();

              const dayEvents = day ? events.filter((e) => isSameCalendarDay(e.startsAt, currentDate.getFullYear(), currentDate.getMonth(), day)) : [];
              const isToday = day &&
                new Date().getDate() === day &&
                new Date().getMonth() === currentDate.getMonth() &&
                new Date().getFullYear() === currentDate.getFullYear();

              return (
                <button
                  key={i}
                  onClick={() => day && setSelectedDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), day, 12))}
                  disabled={!day}
                  className={cn(
                    "h-10 sm:h-12 w-full flex flex-col items-center justify-center text-[15px] rounded-xl sm:rounded-[14px] transition-all relative outline-none group",
                    !day ? "text-transparent pointer-events-none" : "hover:-translate-y-0.5",
                    isSelected
                      ? "bg-slate-900 text-white shadow-md font-medium"
                      : isToday
                        ? "bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200/50"
                        : "bg-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-transparent hover:border-slate-100"
                  )}
                >
                  <span className={cn("relative z-10 leading-none", dayEvents.length > 0 ? "mb-1.5" : "")}>{day}</span>

                  {/* Event Indicators */}
                  {dayEvents.length > 0 && (
                    <div className="absolute bottom-1.5 flex gap-1 justify-center items-center z-10 w-full px-1">
                      {dayEvents.slice(0, 3).map((evt, idx) => {
                        let dotColor = "bg-emerald-500";
                        if (evt.type === "external") dotColor = "bg-sky-500";
                        else if (evt.type === "legal") dotColor = "bg-indigo-500";
                        else if (evt.type === "maintenance") dotColor = "bg-amber-500";

                        if (isSelected) {
                          dotColor = "bg-white/80";
                        }
                        return (
                          <div key={idx} className={cn("size-1.5 rounded-full shadow-sm", dotColor)} />
                        );
                      })}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Selected Date Itinerary */}
          <div className="flex-1 flex flex-col mt-4">
            <h4 className="text-title-secondary text-slate-800 mb-6 flex justify-between items-center px-1">
              <span>
                {selectedDate.toDateString() === new Date().toDateString()
                  ? 'Today\'s Itinerary'
                  : selectedDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </span>
              <span className="text-desc-secondary bg-slate-50 border border-slate-200/60 rounded-lg px-2.5 py-1 shadow-sm">{selectedDateEvents.length} events</span>
            </h4>

            <div className="flex-1 space-y-4 overflow-y-auto pr-2 custom-scrollbar">
              {selectedDateEvents.slice(0, 3).map((evt) => {
                const style = TYPE_STYLES[evt.type];
                const [timePart, periodPart] = new Date(evt.startsAt)
                  .toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
                  .split(" ");
                return (
                  <div key={evt.id} className="p-5 rounded-[20px] bg-white border border-slate-100 flex gap-5 relative overflow-hidden group shadow-[0_2px_10px_rgba(0,0,0,0.02)] hover:shadow-md hover:-translate-y-0.5 transition-all">
                    <div className={cn("absolute left-0 top-0 bottom-0 w-1", style.accent)} />
                    <div className={cn("flex flex-col items-center justify-center shrink-0 pr-5 border-r border-slate-100/80 min-w-[70px]", style.text)}>
                      <span className="mono-stat text-[22px] leading-none mb-1">{timePart}</span>
                      <span className="label-caps opacity-70">{periodPart ?? ""}</span>
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                      <h5 className="text-body-primary text-slate-900 truncate mb-1.5">{evt.title}</h5>
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5 body-sm text-slate-400">
                          <IconClock size={14} className={style.iconColor} />
                          <span>{formatEventTime(evt.endsAt)}</span>
                        </div>
                        <span className="text-slate-300">•</span>
                        <div className="flex items-center gap-1.5 body-sm text-slate-400">
                          <style.icon size={14} className={style.iconColor} />
                          <span className="capitalize">{evt.type}</span>
                        </div>
                        {evt.needsDisposition && (
                          <span className="ml-auto bg-rose-50 text-rose-600 border border-rose-100/60 px-2 py-0.5 rounded-md label-caps shrink-0 shadow-sm">
                            Needs disposition
                          </span>
                        )}
                      </div>
                      <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                        {evt.needsDisposition && (
                          <>
                            <button
                              onClick={() => handleSetOutcome(evt.id, "completed")}
                              className="p-1.5 bg-emerald-50 border border-emerald-200 rounded text-emerald-600 hover:text-emerald-700 hover:bg-emerald-100 shadow-sm transition-colors"
                              title="Mark Completed"
                            >
                              <IconCheck size={14} />
                            </button>
                            <button
                              onClick={() => handleSetOutcome(evt.id, "cancelled")}
                              className="p-1.5 bg-rose-50 border border-rose-200 rounded text-rose-600 hover:text-rose-700 hover:bg-rose-100 shadow-sm transition-colors"
                              title="Cancel Event"
                            >
                              <IconX size={14} />
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => setEventForEdit(evt)}
                          className="p-1.5 bg-slate-50 border border-slate-200 rounded text-slate-400 hover:text-slate-800 hover:bg-white shadow-sm transition-colors"
                          title="Edit"
                        >
                          <IconCalendarEvent size={14} />
                        </button>
                        <button
                          onClick={() => handleDeleteEvent(evt.id)}
                          className="p-1.5 bg-rose-50 border border-rose-200 rounded text-rose-500 hover:text-rose-700 hover:bg-white shadow-sm transition-colors"
                          title="Delete"
                        >
                          <IconTrash size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {selectedDateEvents.length > 3 && (
                <div className="text-center pt-2">
                  <Link href="/admin/events" className="text-meta-muted-strong hover:text-slate-800 transition-colors">
                    + {selectedDateEvents.length - 3} more events today
                  </Link>
                </div>
              )}

              {selectedDateEvents.length === 0 && (
                <div className="flex flex-col items-center justify-center h-[140px] text-center bg-white rounded-xl border border-slate-200 border-dashed">
                  <div className="size-12 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 mb-3 border border-slate-100">
                    <IconCalendarEvent size={24} stroke={1.5} />
                  </div>
                  <p className="text-body-primary text-slate-600">No events scheduled.</p>
                  <p className="text-meta-muted mt-1">Take a break or schedule a new event.</p>
                </div>
              )}
            </div>
          </div>

        </BoardPanel>
      </section>

      <EventFormModal
        open={eventModalOpen}
        onClose={() => setEventModalOpen(false)}
        onSubmit={handleCreateEvent}
      />
      {eventForEdit && (
        <EventFormModal
          open={true}
          mode="edit"
          initialData={{
            title: eventForEdit.title,
            description: eventForEdit.description || "",
            type: eventForEdit.type,
            date: eventForEdit.startsAt.split("T")[0],
            time: new Date(eventForEdit.startsAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
            duration: computeDurationLabel(eventForEdit.startsAt, eventForEdit.endsAt),
          }}
          onClose={() => setEventForEdit(null)}
          onSubmit={(data) => handleEditEvent(eventForEdit.id, data)}
        />
      )}
      <ProjectDetailModal
        project={selectedProject}
        open={selectedProject !== null}
        onClose={() => setSelectedProject(null)}
      />
      <CalendarModal
        open={calendarModalOpen}
        onClose={() => { setCalendarModalOpen(false); loadEvents(); }}
        entityId={entityId}
      />
    </div>
  );
}
