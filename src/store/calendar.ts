import { create } from "zustand";

export interface CalendarEvent {
  id: string;
  title: string;
  date: string; // ISO string YYYY-MM-DD
  time?: string; // HH:mm format
  description?: string;
  type: "meeting" | "viewing" | "deadline" | "other";
}

interface CalendarState {
  events: CalendarEvent[];
  addEvent: (event: Omit<CalendarEvent, "id">) => void;
  updateEvent: (id: string, event: Partial<CalendarEvent>) => void;
  deleteEvent: (id: string) => void;
  getEventsForDate: (date: string) => CalendarEvent[];
}

export const useCalendarStore = create<CalendarState>((set, get) => ({
  events: [
    {
      id: "1",
      title: "Team Sync",
      date: new Date().toISOString().split("T")[0],
      time: "10:00",
      type: "meeting",
    },
  ],
  addEvent: (event) =>
    set((state) => ({
      events: [...state.events, { ...event, id: crypto.randomUUID() }],
    })),
  updateEvent: (id, updatedFields) =>
    set((state) => ({
      events: state.events.map((e) => (e.id === id ? { ...e, ...updatedFields } : e)),
    })),
  deleteEvent: (id) =>
    set((state) => ({
      events: state.events.filter((e) => e.id !== id),
    })),
  getEventsForDate: (date) => get().events.filter((e) => e.date === date),
}));
