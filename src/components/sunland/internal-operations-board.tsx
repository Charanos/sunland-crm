"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
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
  IconMapPin
} from "@tabler/icons-react";
import { useToast } from "@/components/ui/toast-provider";
import { BoardPanel } from "@/components/ui/erp-primitives";
import { EventFormModal } from "./event-form-modal";
import { cn } from "@/lib/utils/cn";

interface Event {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  duration: string;
  type: "internal" | "external" | "legal" | "maintenance";
  location: string;
  attendees: number;
}

export function InternalOperationsBoard() {
  const { pushToast } = useToast();

  // Real calendar state
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [eventModalOpen, setEventModalOpen] = useState(false);

  // Default events mapped to current month for demonstration
  const [events, setEvents] = useState<Event[]>([
    {
      id: "e1",
      title: "Executive Board Review",
      date: new Date().toISOString().split("T")[0],
      time: "09:00 AM",
      duration: "1.5h",
      type: "internal",
      location: "Boardroom A",
      attendees: 6,
    },
    {
      id: "e2",
      title: "HNW Viewing - Runda Villa",
      date: new Date().toISOString().split("T")[0],
      time: "01:30 PM",
      duration: "2h",
      type: "external",
      location: "Westlands",
      attendees: 3,
    },
    {
      id: "e3",
      title: "Escrow Signing - Tower 4B",
      date: new Date().toISOString().split("T")[0],
      time: "04:00 PM",
      duration: "1h",
      type: "legal",
      location: "Zoom",
      attendees: 4,
    },
  ]);

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

  const selectedDateStr = selectedDate.toISOString().split("T")[0];
  const selectedDateEvents = events.filter(e => e.date === selectedDateStr).sort((a, b) => a.time.localeCompare(b.time));

  const hasEvents = (day: number) => {
    const dateStr = new Date(currentDate.getFullYear(), currentDate.getMonth(), day, 12).toISOString().split("T")[0];
    return events.some(e => e.date === dateStr);
  };

  const handleCreateEvent = (data: { title: string; date: string; time: string; duration: string; type: string }) => {
    const newEvent: Event = {
      id: `e${Date.now()}`,
      title: data.title,
      date: data.date,
      time: data.time,
      duration: data.duration,
      type: data.type as Event["type"],
      location: "TBD",
      attendees: 1,
    };
    setEvents((prev) => [...prev, newEvent]);
    setSelectedDate(new Date(data.date + "T12:00:00"));
    pushToast({ tone: "success", title: "Event Scheduled", body: `"${data.title}" has been added to your itinerary.` });
  };

  const TYPE_STYLES = {
    internal: { bg: "bg-teal-50/50 border-teal-200", text: "text-teal-900", icon: IconVideo, accent: "bg-teal-500", iconColor: "text-teal-600" },
    external: { bg: "bg-sky-50/50 border-sky-200", text: "text-sky-900", icon: IconMapPin, accent: "bg-sky-500", iconColor: "text-sky-600" },
    legal: { bg: "bg-indigo-50/50 border-indigo-200", text: "text-indigo-900", icon: IconGavel, accent: "bg-indigo-500", iconColor: "text-indigo-600" },
    maintenance: { bg: "bg-amber-50/50 border-amber-200", text: "text-amber-900", icon: IconTool, accent: "bg-amber-500", iconColor: "text-amber-600" },
  };

  const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="w-full my-12 md:my-16">
      {/* ── Section Header ── */}
      <div className="py-6 border-t border-slate-200/60 flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-2">
        <div>
          <h2 className="title-serif text-slate-900 text-[22px]">Internal Structure & Scheduler</h2>
          <p className="text-base text-slate-500 tracking-wide mt-1">High-level operations breakdown and executive itinerary.</p>
        </div>

        <button
          onClick={() => setEventModalOpen(true)}
          className="flex items-center gap-2 bg-[#f3df27] text-[#151936] px-4 py-2 rounded-lg text-base shadow-sm hover:bg-[#e6d220] transition-colors"
        >
          <IconPlus size={16} stroke={2} />
          <span>Schedule Event</span>
        </button>
      </div>

      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch w-full">

        {/* ── Firm Operations (Left) ── */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          {/* Department Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Link href="/admin/pipeline" className="group">
              <div className="bg-white p-4 rounded-[20px] border border-slate-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] hover:shadow-md transition-all relative overflow-hidden flex flex-col justify-between h-[130px] cursor-pointer">
                <div className="absolute -right-4 -top-4 size-20 bg-teal-50/50 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="size-8 rounded-lg bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-700">
                      <IconBriefcase size={16} stroke={1.5} />
                    </div>
                    <span className="text-sm text-slate-500 uppercase tracking-widest">Sales</span>
                  </div>
                  <div className="flex items-center gap-1 bg-teal-50 px-1.5 py-0.5 rounded text-sm  text-teal-700">
                    <span className="size-1.5 rounded-full bg-teal-500 animate-pulse" /> Active
                  </div>
                </div>
                <div className="mt-auto flex items-end justify-between">
                  <div>
                    <h3 className="text-[32px] font-mono text-slate-800 leading-none tracking-tight">24</h3>
                    <p className="text-sm text-slate-400 mt-1">Licensed Brokers</p>
                  </div>
                  <div className="text-right">
                    <p className="text-base font-mono text-teal-600">+3 this Q</p>
                  </div>
                </div>
              </div>
            </Link>

            <Link href="/admin/maintenance" className="group">
              <div className="bg-white p-4 rounded-[20px] border border-slate-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] hover:shadow-md transition-all relative overflow-hidden flex flex-col justify-between h-[130px] cursor-pointer">
                <div className="absolute -right-4 -top-4 size-20 bg-amber-50/50 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="size-8 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-700">
                      <IconUsers size={16} stroke={1.5} />
                    </div>
                    <span className="text-sm text-slate-500 uppercase tracking-widest">Ops</span>
                  </div>
                  <div className="flex items-center gap-1 bg-amber-50 px-1.5 py-0.5 rounded text-sm  text-amber-700">
                    <span className="size-1.5 rounded-full bg-amber-500 animate-pulse" /> At Capacity
                  </div>
                </div>
                <div className="mt-auto flex items-end justify-between">
                  <div>
                    <h3 className="text-[32px] font-mono text-slate-800 leading-none tracking-tight">18</h3>
                    <p className="text-sm text-slate-400 mt-1">Property Managers</p>
                  </div>
                  <div className="text-right">
                    <p className="text-base font-mono text-amber-600">420 Units</p>
                  </div>
                </div>
              </div>
            </Link>

            <Link href="/admin/leases" className="group">
              <div className="bg-white p-4 rounded-[20px] border border-slate-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] hover:shadow-md transition-all relative overflow-hidden flex flex-col justify-between h-[130px] cursor-pointer">
                <div className="absolute -right-4 -top-4 size-20 bg-indigo-50/50 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="size-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700">
                      <IconGavel size={16} stroke={1.5} />
                    </div>
                    <span className="text-sm text-slate-500 uppercase tracking-widest">Legal</span>
                  </div>
                  <div className="flex items-center gap-1 bg-slate-50 px-1.5 py-0.5 rounded text-sm  text-slate-500">
                    Processing
                  </div>
                </div>
                <div className="mt-auto flex items-end justify-between">
                  <div>
                    <h3 className="text-[32px] font-mono text-slate-800 leading-none tracking-tight">6</h3>
                    <p className="text-sm text-slate-400 mt-1">Escrow Officers</p>
                  </div>
                  <div className="text-right">
                    <p className="text-base font-mono text-indigo-600">14 Pending</p>
                  </div>
                </div>
              </div>
            </Link>
          </div>

          {/* Active Workflows Timeline */}
          <BoardPanel className="flex flex-1 flex-col">
            <div className="flex items-center justify-between mb-6 border-b border-slate-50 pb-4">
              <h3 className="text-[16px] text-slate-900 tracking-tight">Cross-Department Operations</h3>
              <button className="text-sm text-slate-500 hover:text-slate-800 transition-colors bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">View All Projects</button>
            </div>

            <div className="space-y-5 flex-1 overflow-y-auto custom-scrollbar pr-2">

              {/* Timeline Item 1 */}
              <div className="flex gap-4 relative group">
                <div className="absolute left-[15px] top-[32px] bottom-[-20px] w-px bg-slate-100 group-hover:bg-teal-100 transition-colors" />
                <div className="size-8 rounded-full bg-teal-50 border border-teal-100 flex items-center justify-center shrink-0 z-10 text-teal-600 shadow-sm">
                  <div className="size-2.5 rounded-full bg-teal-500" />
                </div>
                <div className="flex-1 bg-slate-50/50 hover:bg-slate-50 p-3.5 rounded-xl border border-slate-100 transition-colors">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="text-[14px] text-slate-800">Q3 Broker Recruitment Drive</h4>
                      <p className="text-base text-slate-500 mt-0.5">Interviewing 12 candidates for the commercial sector.</p>
                    </div>
                    <span className="text-sm  bg-white border border-slate-200 text-slate-500 px-2 py-0.5 rounded shadow-sm uppercase tracking-wider">Sales</span>
                  </div>

                  <div className="flex items-center gap-4 mt-3">
                    <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-teal-500 rounded-full w-[60%]" />
                    </div>
                    <span className="text-sm text-teal-600 whitespace-nowrap">60% Complete</span>
                  </div>
                </div>
              </div>

              {/* Timeline Item 2 */}
              <div className="flex gap-4 relative group">
                <div className="absolute left-[15px] top-[32px] bottom-[-20px] w-px bg-slate-100 group-hover:bg-indigo-100 transition-colors" />
                <div className="size-8 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0 z-10 text-indigo-600 shadow-sm">
                  <div className="size-2.5 rounded-full bg-indigo-500" />
                </div>
                <div className="flex-1 bg-slate-50/50 hover:bg-slate-50 p-3.5 rounded-xl border border-slate-100 transition-colors">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="text-[14px] text-slate-800">Escrow Clearance: Muthaiga Estate</h4>
                      <p className="text-base text-slate-500 mt-0.5">Finalizing deed transfers and tax documentation.</p>
                    </div>
                    <span className="text-sm  bg-white border border-slate-200 text-slate-500 px-2 py-0.5 rounded shadow-sm uppercase tracking-wider">Legal</span>
                  </div>

                  <div className="flex items-center justify-between mt-3">
                    <div className="flex -space-x-2">
                      <Image width={24} height={24} src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=32&h=32&fit=crop&crop=face" alt="Assignee" className="size-6 rounded-full border-2 border-white bg-slate-100" />
                      <Image width={24} height={24} src="https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=32&h=32&fit=crop&crop=face" alt="Assignee" className="size-6 rounded-full border-2 border-white bg-slate-100" />
                      <div className="size-6 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-xs  text-slate-500">+1</div>
                    </div>
                    <span className="text-sm text-indigo-600 px-2.5 py-1 bg-indigo-50 rounded-md">Awaiting Signature</span>
                  </div>
                </div>
              </div>

              {/* Timeline Item 3 */}
              <div className="flex gap-4 relative group">
                <div className="size-8 rounded-full bg-amber-50 border border-amber-100 flex items-center justify-center shrink-0 z-10 text-amber-600 shadow-sm">
                  <div className="size-2.5 rounded-full bg-amber-500" />
                </div>
                <div className="flex-1 bg-slate-50/50 hover:bg-slate-50 p-3.5 rounded-xl border border-slate-100 transition-colors">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="text-[14px] text-slate-800">Routine Safety Audits</h4>
                      <p className="text-base text-slate-500 mt-0.5">Inspecting 4 multi-family complexes in Westlands.</p>
                    </div>
                    <span className="text-sm  bg-white border border-slate-200 text-slate-500 px-2 py-0.5 rounded shadow-sm uppercase tracking-wider">Ops</span>
                  </div>

                  <div className="flex items-center justify-between mt-3">
                    <span className="text-sm text-slate-500 flex items-center gap-1.5"><IconClock size={12} stroke={2} /> June 19, 2026</span>
                    <span className="text-sm text-amber-600 px-2.5 py-1 bg-amber-50 rounded-md">Scheduled</span>
                  </div>
                </div>
              </div>

            </div>
          </BoardPanel>
        </div>

        {/* ── Executive Scheduler (Right) ── */}
        <BoardPanel className="lg:col-span-5 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-[16px] text-slate-900 tracking-tight">Executive Scheduler</h3>
            <div className="flex items-center gap-3">
              <button onClick={prevMonth} className="text-slate-400 hover:text-slate-800 transition-colors">
                <IconChevronLeft size={18} stroke={2} />
              </button>
              <span className="text-base text-slate-700 w-24 text-center">
                {currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
              </span>
              <button onClick={nextMonth} className="text-slate-400 hover:text-slate-800 transition-colors">
                <IconChevronRight size={18} stroke={2} />
              </button>
            </div>
          </div>

          {/* Real Calendar Grid */}
          <div className="grid grid-cols-7 gap-1 mb-6">
            {daysOfWeek.map(d => (
              <div key={d} className="text-center text-sm  uppercase tracking-widest text-slate-400 mb-2">{d}</div>
            ))}
            {calendarDays.map((day, i) => {
              const isSelected = day &&
                selectedDate.getDate() === day &&
                selectedDate.getMonth() === currentDate.getMonth() &&
                selectedDate.getFullYear() === currentDate.getFullYear();

              const hasEvt = day && hasEvents(day);
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
                    "h-[34px] flex items-center justify-center text-base rounded-lg transition-all",
                    !day ? "text-transparent pointer-events-none" : "",
                    isSelected
                      ? "bg-[#151936] text-white shadow-sm"
                      : isToday
                        ? "bg-slate-100 text-slate-900"
                        : "text-slate-600 hover:bg-slate-50"
                  )}
                >
                  {day}
                  {/* Event Indicators */}
                  {hasEvt && !isSelected && (
                    <div className="absolute bottom-1 flex gap-[2px]">
                      <div className="size-1 rounded-full bg-orange-400" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Selected Date Itinerary */}
          <div className="flex-1 flex flex-col">
            <h4 className="text-base text-slate-800 mb-4 pb-2 border-b border-slate-100 flex justify-between items-center">
              <span>
                {selectedDate.toDateString() === new Date().toDateString()
                  ? 'Today\'s Itinerary'
                  : selectedDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </span>
              <span className="text-sm text-slate-400">{selectedDateEvents.length} events</span>
            </h4>

            <div className="flex-1 space-y-3 overflow-y-auto pr-2 custom-scrollbar">
              {selectedDateEvents.map((evt) => {
                const style = TYPE_STYLES[evt.type];
                return (
                  <div key={evt.id} className={cn("p-3.5 rounded-[14px] border flex gap-3.5 relative overflow-hidden group shadow-sm hover:shadow-md transition-all", style.bg)}>
                    <div className={cn("absolute left-0 top-0 bottom-0 w-[4px]", style.accent)} />
                    <div className={cn("flex flex-col items-center justify-center shrink-0 pr-3 border-r border-black/5 min-w-[55px]", style.text)}>
                      <span className="text-base font-mono leading-none mb-1">{evt.time.split(' ')[0]}</span>
                      <span className="text-xs  uppercase tracking-widest opacity-70">{evt.time.split(' ')[1] || "EAT"}</span>
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                      <h5 className={cn("text-[14px] tracking-tight truncate leading-snug", style.text)}>{evt.title}</h5>
                      <div className={cn("flex items-center gap-3 mt-1.5 opacity-80", style.text)}>
                        <div className="flex items-center gap-1">
                          <IconClock size={13} stroke={2.5} className={style.iconColor} />
                          <span className="text-[11px]">{evt.duration}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <style.icon size={13} stroke={2.5} className={style.iconColor} />
                          <span className="text-sm capitalize">{evt.type}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {selectedDateEvents.length === 0 && (
                <div className="flex flex-col items-center justify-center h-[120px] text-center">
                  <div className="size-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 mb-2">
                    <IconCalendarEvent size={20} stroke={1.5} />
                  </div>
                  <p className="text-[12.5px] text-slate-500">No events scheduled.</p>
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
    </div>
  );
}
