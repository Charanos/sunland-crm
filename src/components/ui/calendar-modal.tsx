"use client";

import { useEffect, useState } from "react";
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  isSameMonth,
  isSameDay,
  addDays,
  isBefore,
  startOfToday,
} from "date-fns";
import {
  IconChevronLeft,
  IconChevronRight,
  IconPlus,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { useToast } from "@/components/ui/toast-provider";
import { cn } from "@/lib/utils/cn";

const EVENT_COLORS: Record<string, { dot: string; border: string; text: string; bg: string }> = {
  internal: { dot: "bg-blue-500", border: "border-l-blue-500", text: "text-blue-700", bg: "bg-blue-50/50" },
  external: { dot: "bg-emerald-500", border: "border-l-emerald-500", text: "text-emerald-700", bg: "bg-emerald-50/50" },
  legal: { dot: "bg-amber-500", border: "border-l-amber-500", text: "text-amber-700", bg: "bg-amber-50/50" },
  maintenance: { dot: "bg-rose-500", border: "border-l-rose-500", text: "text-rose-700", bg: "bg-rose-50/50" },
};

// This widget's own type vocabulary (meeting/viewing/deadline/other) is more
// generic than the real calendar_events enum (internal/external/legal/
// maintenance) — mapped 1:1 to the closest real member rather than
// redesigning the quick-add form. The full Events page offers the real
// vocabulary directly.
type QuickEventType = "meeting" | "viewing" | "deadline" | "other";
const QUICK_TYPE_TO_API: Record<QuickEventType, "internal" | "external" | "legal" | "maintenance"> = {
  meeting: "internal",
  viewing: "external",
  deadline: "legal",
  other: "maintenance",
};
interface ApiCalendarEvent {
  id: string;
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string;
  type: "internal" | "external" | "legal" | "maintenance";
}

export function CalendarModal({
  open,
  onClose,
  entityId = "group",
}: {
  open: boolean;
  onClose: () => void;
  entityId?: string;
}) {
  const { pushToast } = useToast();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isAdding, setIsAdding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [events, setEvents] = useState<ApiCalendarEvent[]>([]);
  const [newEvent, setNewEvent] = useState<{ title: string; time: string; type: QuickEventType; description: string }>({
    title: "",
    time: "",
    type: "meeting",
    description: "",
  });

  useEffect(() => {
    if (!open) return;
    fetch(`/api/scheduling/events?entityId=${entityId}&scope=all`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.events)) setEvents(data.events);
      })
      .catch((e) => console.error(e));
  }, [open, entityId]);

  const renderHeader = () => {
    return (
      <div className="flex items-center justify-between mb-4">
        <IconButton onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
          <IconChevronLeft size={18} />
        </IconButton>
        <span className="font-medium text-lg">
          {format(currentMonth, "MMMM yyyy")}
        </span>
        <IconButton onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
          <IconChevronRight size={18} />
        </IconButton>
      </div>
    );
  };

  const renderDays = () => {
    const days = [];
    const startDate = startOfWeek(currentMonth, { weekStartsOn: 1 });
    for (let i = 0; i < 7; i++) {
      days.push(
        <div key={i} className="text-center label-caps text-slate-400 font-medium mb-3">
          {format(addDays(startDate, i), "EEE")}
        </div>
      );
    }
    return <div className="grid grid-cols-7">{days}</div>;
  };

  const renderCells = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

    const rows = [];
    let days = [];
    let day = startDate;
    let formattedDate = "";

    while (day <= endDate) {
      for (let i = 0; i < 7; i++) {
        formattedDate = format(day, "d");
        const cloneDay = day;
        const dayEvents = events.filter((e) => isSameDay(new Date(e.startsAt), day));
        const isToday = isSameDay(day, new Date());
        const isSelected = isSameDay(day, selectedDate);

        days.push(
          <div
            key={day.toISOString()}
            className={cn(
              "relative flex flex-col items-center justify-center cursor-pointer transition rounded-full h-9 w-9 mx-auto border",
              !isSameMonth(day, monthStart)
                ? "text-slate-300 opacity-40 border-transparent"
                : isSelected
                  ? "bg-[#122a20]/10 text-[#122a20] font-medium border-[#122a20]/30 shadow-sm"
                  : isToday
                    ? "border-slate-300 bg-slate-50 text-slate-900 font-medium"
                    : "text-slate-700 hover:bg-slate-100/70 border-transparent"
            )}
            onClick={() => {
              setSelectedDate(cloneDay);
            }}
          >
            <span className="body-md">{formattedDate}</span>
            {dayEvents.length > 0 && (
              <div className="absolute bottom-1 flex gap-0.5">
                {dayEvents.slice(0, 3).map((ev, idx) => (
                  <span
                    key={idx}
                    className={cn(
                      "w-1 h-1 rounded-full",
                      EVENT_COLORS[ev.type]?.dot || "bg-slate-400"
                    )}
                  />
                ))}
              </div>
            )}
          </div>
        );
        day = addDays(day, 1);
      }
      rows.push(
        <div className="grid grid-cols-7 gap-1 mb-2" key={day.toISOString()}>
          {days}
        </div>
      );
      days = [];
    }
    return <div>{rows}</div>;
  };

  const selectedEvents = events.filter((e) => isSameDay(new Date(e.startsAt), selectedDate));

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEvent.title.trim()) return;

    setIsSaving(true);
    try {
      const timeOfDay = newEvent.time || "09:00";
      const startsAt = new Date(`${format(selectedDate, "yyyy-MM-dd")}T${timeOfDay}:00`);
      const endsAt = new Date(startsAt.getTime() + 60 * 60_000);

      const res = await fetch("/api/scheduling/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityId,
          title: newEvent.title,
          description: newEvent.description || undefined,
          type: QUICK_TYPE_TO_API[newEvent.type],
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to schedule event");

      setEvents((prev) => [...prev, data.event]);
      setNewEvent({ title: "", time: "", type: "meeting", description: "" });
      setIsAdding(false);
      pushToast({ tone: "success", title: "Event Scheduled", body: `"${newEvent.title}" added to the calendar.` });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not schedule event.";
      pushToast({ tone: "error", title: "Error", body: message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteEvent = async (id: string) => {
    try {
      const res = await fetch(`/api/scheduling/events?id=${id}&entityId=${entityId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete event");
      setEvents((prev) => prev.filter((e) => e.id !== id));
    } catch {
      pushToast({ tone: "error", title: "Error", body: "Could not delete event." });
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Calendar & Schedule"
      className="max-w-4xl"
    >
      <div className="flex flex-col md:flex-row gap-8">
        {/* Calendar Side */}
        <div className="md:w-1/2">
          {renderHeader()}
          {renderDays()}
          {renderCells()}
        </div>

        {/* Events Side */}
        <div className="md:w-1/2 flex flex-col bg-slate-50/50 border border-slate-100 p-5 rounded-[20px]">
          <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
            <h3 className="text-title-primary">
              {format(selectedDate, "MMM d, yyyy")}
            </h3>
            {!isAdding && !isBefore(selectedDate, startOfToday()) && (
              <Button size="sm" onClick={() => setIsAdding(true)}>
                <IconPlus size={16} className="mr-1" /> Add Event
              </Button>
            )}
          </div>

          {isAdding ? (
            <form onSubmit={handleAddEvent} className="flex flex-col gap-3 flex-1 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex justify-between items-center mb-2">
                <span className="label-caps font-medium">New Event</span>
                <IconButton size="sm" onClick={() => setIsAdding(false)}>
                  <IconX size={14} />
                </IconButton>
              </div>
              <input
                autoFocus
                className="w-full text-base p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-[#122a20]/20 bg-slate-50"
                placeholder="Event title"
                value={newEvent.title}
                onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                required
              />
              <div className="flex gap-2">
                <input
                  type="time"
                  className="flex-1 text-base p-2.5 rounded-xl border border-slate-200 focus:outline-none bg-slate-50"
                  value={newEvent.time}
                  onChange={(e) => setNewEvent({ ...newEvent, time: e.target.value })}
                />
                <select
                  className="flex-1 text-base p-2.5 rounded-xl border border-slate-200 focus:outline-none bg-slate-50 cursor-pointer"
                  value={newEvent.type}
                  onChange={(e) => setNewEvent({ ...newEvent, type: e.target.value as QuickEventType })}
                >
                  <option value="meeting">Meeting</option>
                  <option value="viewing">Viewing</option>
                  <option value="deadline">Deadline</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <textarea
                className="w-full text-base p-2.5 rounded-xl border border-slate-200 focus:outline-none min-h-[90px] bg-slate-50"
                placeholder="Description (optional)"
                value={newEvent.description}
                onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
              />
              <Button type="submit" className="mt-2 w-full bg-slate-900 hover:bg-slate-800 text-white rounded-xl py-2.5" disabled={isSaving}>
                {isSaving ? "Saving…" : "Save Event"}
              </Button>
            </form>
          ) : (
            <div className="flex-1 overflow-y-auto pr-1">
              {selectedEvents.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 py-12">
                  <p className="body-md">No events scheduled for this day.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedEvents.map((ev) => {
                    const colorScheme = EVENT_COLORS[ev.type];
                    return (
                      <div
                        key={ev.id}
                        className={cn(
                          "bg-white p-3.5 rounded-xl border border-slate-100 shadow-sm flex justify-between items-start group hover:shadow-md transition-all border-l-4",
                          colorScheme?.border || "border-l-slate-400"
                        )}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={cn("w-2 h-2 rounded-full shrink-0", colorScheme?.dot || "bg-slate-400")} />
                            <h4 className="body-md text-slate-800 truncate">{ev.title}</h4>
                          </div>
                          <p className="body-sm text-slate-400 mt-1 mono-data">
                            {format(new Date(ev.startsAt), "h:mm a")}
                          </p>
                          {ev.description && <p className="body-sm text-slate-500 mt-2 bg-slate-50 p-2 rounded-lg border border-slate-100/50">{ev.description}</p>}
                        </div>
                        <IconButton size="sm" className="opacity-0 group-hover:opacity-100 text-red-500 hover:bg-red-50 hover:text-red-600 transition shrink-0 ml-2" onClick={() => handleDeleteEvent(ev.id)}>
                          <IconTrash size={16} />
                        </IconButton>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
