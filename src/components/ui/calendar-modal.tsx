"use client";

import { useState } from "react";
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
} from "date-fns";
import {
  IconChevronLeft,
  IconChevronRight,
  IconPlus,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import { useCalendarStore, CalendarEvent } from "@/store/calendar";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { cn } from "@/lib/utils/cn";

export function CalendarModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isAdding, setIsAdding] = useState(false);
  const [newEvent, setNewEvent] = useState<Partial<CalendarEvent>>({
    title: "",
    time: "",
    type: "meeting",
    description: "",
  });

  const { events, addEvent, deleteEvent } = useCalendarStore();

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
        <div key={i} className="text-center font-medium text-sm text-[var(--on-surface-dim)] mb-2">
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
        const dateString = format(day, "yyyy-MM-dd");
        const dayEvents = events.filter((e) => e.date === dateString);

        days.push(
          <div
            key={day.toISOString()}
            className={cn(
              "p-2 border border-transparent flex flex-col items-center justify-center cursor-pointer transition rounded-lg h-10 w-10 mx-auto",
              !isSameMonth(day, monthStart)
                ? "text-[var(--on-surface-dim)] opacity-50"
                : isSameDay(day, selectedDate)
                  ? "bg-[var(--primary)] text-[var(--on-primary)] shadow-md"
                  : "text-[var(--on-surface)] hover:bg-[var(--surface-muted)]",
              isSameDay(day, new Date()) && !isSameDay(day, selectedDate) && "border-[var(--primary)]"
            )}
            onClick={() => {
              setSelectedDate(cloneDay);
              setIsAdding(false);
            }}
          >
            <span className="text-sm">{formattedDate}</span>
            {dayEvents.length > 0 && (
              <div className="flex gap-0.5 mt-0.5">
                {dayEvents.slice(0, 3).map((_, idx) => (
                  <span
                    key={idx}
                    className={cn(
                      "w-1 h-1 rounded-full",
                      isSameDay(day, selectedDate) ? "bg-[var(--on-primary)]" : "bg-[var(--primary)]"
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
        <div className="grid grid-cols-7 gap-1 mb-1" key={day.toISOString()}>
          {days}
        </div>
      );
      days = [];
    }
    return <div>{rows}</div>;
  };

  const selectedDateString = format(selectedDate, "yyyy-MM-dd");
  const selectedEvents = events.filter((e) => e.date === selectedDateString);

  const handleAddEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEvent.title) return;
    addEvent({
      ...newEvent,
      title: newEvent.title,
      date: selectedDateString,
      type: newEvent.type as any,
    });
    setNewEvent({ title: "", time: "", type: "meeting", description: "" });
    setIsAdding(false);
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
        <div className="md:w-1/2 flex flex-col bg-[var(--surface-muted)] rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-lg">
              {format(selectedDate, "MMM d, yyyy")}
            </h3>
            {!isAdding && (
              <Button size="sm" onClick={() => setIsAdding(true)}>
                <IconPlus size={16} className="mr-1" /> Add
              </Button>
            )}
          </div>

          {isAdding ? (
            <form onSubmit={handleAddEvent} className="flex flex-col gap-3 flex-1 bg-white p-3 rounded-lg border border-[var(--outline)]">
              <div className="flex justify-between items-center mb-2">
                <span className="font-medium text-sm">New Event</span>
                <IconButton size="sm" onClick={() => setIsAdding(false)}>
                  <IconX size={14} />
                </IconButton>
              </div>
              <input
                autoFocus
                className="w-full text-sm p-2 rounded-md border border-[var(--outline)]"
                placeholder="Event title"
                value={newEvent.title}
                onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                required
              />
              <div className="flex gap-2">
                <input
                  type="time"
                  className="flex-1 text-sm p-2 rounded-md border border-[var(--outline)]"
                  value={newEvent.time}
                  onChange={(e) => setNewEvent({ ...newEvent, time: e.target.value })}
                />
                <select
                  className="flex-1 text-sm p-2 rounded-md border border-[var(--outline)]"
                  value={newEvent.type}
                  onChange={(e) => setNewEvent({ ...newEvent, type: e.target.value as any })}
                >
                  <option value="meeting">Meeting</option>
                  <option value="viewing">Viewing</option>
                  <option value="deadline">Deadline</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <textarea
                className="w-full text-sm p-2 rounded-md border border-[var(--outline)] min-h-[80px]"
                placeholder="Description (optional)"
                value={newEvent.description}
                onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
              />
              <Button type="submit" className="mt-2 w-full">Save Event</Button>
            </form>
          ) : (
            <div className="flex-1 overflow-y-auto pr-2">
              {selectedEvents.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-[var(--on-surface-dim)] py-8">
                  <p className="text-sm">No events for this date</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedEvents.map((ev) => (
                    <div key={ev.id} className="bg-white p-3 rounded-lg border border-[var(--outline)] shadow-sm group">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              "w-2 h-2 rounded-full",
                              ev.type === "meeting" ? "bg-blue-500" :
                                ev.type === "viewing" ? "bg-[var(--primary)]" :
                                  ev.type === "deadline" ? "bg-[var(--error)]" : "bg-gray-400"
                            )} />
                            <h4 className="font-medium text-sm">{ev.title}</h4>
                          </div>
                          {ev.time && <p className="text-sm text-[var(--on-surface-dim)] mt-1">{ev.time}</p>}
                          {ev.description && <p className="text-sm text-[var(--on-surface-dim)] mt-2">{ev.description}</p>}
                        </div>
                        <IconButton size="sm" className="opacity-0 group-hover:opacity-100 text-[var(--error)] transition" onClick={() => deleteEvent(ev.id)}>
                          <IconTrash size={16} />
                        </IconButton>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
