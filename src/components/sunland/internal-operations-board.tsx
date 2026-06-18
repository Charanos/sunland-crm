"use client";

import { useState } from "react";
import Link from "next/link";
import {
  IconCalendar,
  IconClock,
  IconUser,
  IconVideo,
  IconBuilding,
  IconUsers,
  IconFileCheck,
  IconTool,
  IconPlus,
  IconChevronLeft,
  IconChevronRight,
  IconCheck,
  IconDotsVertical,
  IconLink,
  IconEdit,
} from "@tabler/icons-react";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast-provider";
import { EventFormModal } from "./event-form-modal";
import { cn } from "@/lib/utils/cn";

interface Event {
  id: string;
  title: string;
  time: string;
  duration: string;
  type: "internal" | "external" | "legal" | "maintenance";
  location: string;
  attendees: number;
}

export function InternalOperationsBoard() {
  const { pushToast } = useToast();
  const [currentDate, setCurrentDate] = useState(new Date(2026, 5, 18)); // June 2026
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [events, setEvents] = useState<Event[]>([
    { id: "e1", title: "Sales Sync: Runda Project", time: "09:00", duration: "1h", type: "internal", location: "Boardroom A", attendees: 6 },
    { id: "e2", title: "Client Viewing: Westlands Tower", time: "11:30", duration: "1.5h", type: "external", location: "Westlands", attendees: 3 },
    { id: "e3", title: "Legal Review: Muthaiga Estate", time: "14:00", duration: "45m", type: "legal", location: "Zoom", attendees: 4 },
  ]);

  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };
  
  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const handleCreateEvent = (data: any) => {
    const newEvent: Event = {
      id: `e${Date.now()}`,
      title: data.title,
      time: data.time,
      duration: data.duration,
      type: data.type as Event["type"],
      location: "TBD",
      attendees: 1,
    };
    setEvents((prev) => [...prev, newEvent].sort((a, b) => a.time.localeCompare(b.time)));
  };

  const completeTask = (id: string, taskName: string) => {
    pushToast({ tone: "success", title: "Task Completed", body: `"${taskName}" marked as done.` });
    setActiveMenu(null);
  };

  const TYPE_COLORS = {
    internal: "bg-teal-50 border-teal-100 text-teal-800",
    external: "bg-sky-50 border-sky-100 text-sky-800",
    legal: "bg-indigo-50 border-indigo-100 text-indigo-800",
    maintenance: "bg-amber-50 border-amber-100 text-amber-800",
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch mt-4">
      {/* ── Left Col: Dept Actions & Timeline ── */}
      <div className="lg:col-span-4 flex flex-col gap-3">
        {/* Department Quick Actions */}
        <div className="grid grid-cols-3 gap-3">
          <Link href="/admin/pipeline" className="group">
            <div className="bg-[#15464e] rounded-[16px] p-4 text-white hover:bg-[#0f343a] transition-all cursor-pointer shadow-sm text-center border border-transparent hover:border-[#1a555f] animate-fade-in-up">
              <div className="size-10 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition-transform"><IconUsers size={20} stroke={1.5} /></div>
              <p className="text-[12px] font-medium tracking-wide">Sales Team</p>
            </div>
          </Link>
          <Link href="/admin/maintenance" className="group">
            <div className="bg-[#eef2f6] rounded-[16px] p-4 text-[#24354a] hover:bg-[#e2eaf1] transition-all cursor-pointer shadow-sm text-center border border-slate-200 animate-fade-in-up stagger-1">
              <div className="size-10 bg-white rounded-full flex items-center justify-center mx-auto mb-2 shadow-sm group-hover:scale-110 transition-transform"><IconTool size={20} stroke={1.5} /></div>
              <p className="text-[12px] font-medium tracking-wide">Operations</p>
            </div>
          </Link>
          <Link href="/admin/leases" className="group">
            <div className="bg-[#fcf0e4] rounded-[16px] p-4 text-[#5e2b17] hover:bg-[#f8e5d2] transition-all cursor-pointer shadow-sm text-center border border-[#f2d8c9] animate-fade-in-up stagger-2">
              <div className="size-10 bg-white rounded-full flex items-center justify-center mx-auto mb-2 shadow-sm group-hover:scale-110 transition-transform"><IconFileCheck size={20} stroke={1.5} /></div>
              <p className="text-[12px] font-medium tracking-wide">Legal / SLA</p>
            </div>
          </Link>
        </div>

        {/* Priority Timeline */}
        <Card className="flex-1 bg-white border border-slate-100 shadow-sm p-6 rounded-[20px] animate-fade-in-up stagger-3">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-[15px] font-medium text-slate-800">Priority Operations</h3>
            <Link href="/admin/pipeline">
              <button className="text-[12px] font-medium text-[#15464e] hover:underline">View All</button>
            </Link>
          </div>
          
          <div className="space-y-0">
            {[
              { id: "t1", title: "Finalize Karen Ridge Escrow", dept: "Legal", time: "Due Today", status: "urgent" },
              { id: "t2", title: "HVAC Inspection - Westlands Tower", dept: "Ops", time: "Tomorrow", status: "pending" },
              { id: "t3", title: "Q3 Marketing Campaign Launch", dept: "Sales", time: "In 3 Days", status: "pending" },
            ].map((task, i) => (
              <div key={task.id} className="flex gap-4 relative py-3 group">
                {i < 2 && <div className="absolute left-[11px] top-[32px] bottom-0 w-px bg-slate-100" />}
                <div className={cn("size-6 rounded-full border-2 bg-white shrink-0 mt-0.5 z-10 flex items-center justify-center", task.status === "urgent" ? "border-amber-400" : "border-slate-200")}>
                  {task.status === "urgent" && <div className="size-2 rounded-full bg-amber-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[13.5px] font-medium text-slate-800 leading-snug">{task.title}</p>
                    <div className="relative">
                      <button onClick={() => setActiveMenu(activeMenu === task.id ? null : task.id)} className="text-slate-400 hover:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity">
                        <IconDotsVertical size={16} />
                      </button>
                      {activeMenu === task.id && (
                        <div className="absolute right-0 top-full mt-1 w-36 bg-white border border-slate-200 rounded-xl shadow-lg z-20 py-1 animate-scale-in">
                          <button onClick={() => completeTask(task.id, task.title)} className="flex items-center gap-2 w-full px-3 py-2 text-[12px] text-slate-700 hover:bg-slate-50 text-left"><IconCheck size={14} /> Mark Complete</button>
                          <button onClick={() => setActiveMenu(null)} className="flex items-center gap-2 w-full px-3 py-2 text-[12px] text-slate-700 hover:bg-slate-50 text-left"><IconUser size={14} /> Reassign</button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[10px] uppercase tracking-widest font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">{task.dept}</span>
                    <span className={cn("text-[11.5px] font-medium", task.status === "urgent" ? "text-amber-600" : "text-slate-400")}>{task.time}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* ── Right Col: Executive Scheduler ── */}
      <Card className="lg:col-span-8 bg-white border border-slate-100 shadow-sm p-6 rounded-[20px] flex flex-col h-[400px] animate-fade-in-up stagger-4">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <div>
            <h3 className="text-[18px] font-medium text-slate-800">Executive Scheduler</h3>
            <p className="text-[12.5px] text-slate-500 font-medium mt-0.5 tracking-wide">Manage internal syncs and client viewings.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center bg-slate-50 rounded-lg p-1 border border-slate-100">
              <button onClick={prevMonth} className="size-7 flex items-center justify-center rounded-md hover:bg-white hover:shadow-sm transition-all text-slate-600"><IconChevronLeft size={16} /></button>
              <span className="text-[13px] font-medium text-slate-800 px-3 min-w-[120px] text-center">
                {currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
              </span>
              <button onClick={nextMonth} className="size-7 flex items-center justify-center rounded-md hover:bg-white hover:shadow-sm transition-all text-slate-600"><IconChevronRight size={16} /></button>
            </div>
            <button
              onClick={() => setEventModalOpen(true)}
              className="flex items-center gap-1.5 text-[12.5px] font-medium text-[#15464e] bg-[#e1f3f6] hover:bg-[#d1eaef] px-3.5 py-2 rounded-lg transition-colors border border-[#c3e3e8]"
            >
              <IconPlus size={14} stroke={2.5} />
              Schedule
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-3">
          {events.length > 0 ? events.map((event) => (
            <div key={event.id} className={cn("p-4 rounded-[14px] border transition-all hover:shadow-md cursor-pointer group flex flex-col sm:flex-row sm:items-center justify-between gap-4", TYPE_COLORS[event.type])}>
              <div className="flex items-start gap-4">
                <div className="flex flex-col items-center justify-center min-w-[60px] border-r border-current/10 pr-4">
                  <span className="text-[16px] font-mono font-medium leading-none mb-1">{event.time}</span>
                  <span className="text-[10px] font-medium uppercase tracking-widest opacity-70">{event.duration}</span>
                </div>
                <div>
                  <h4 className="text-[14.5px] font-medium leading-snug">{event.title}</h4>
                  <div className="flex flex-wrap items-center gap-3 mt-2 opacity-80">
                    <div className="flex items-center gap-1 text-[11.5px] font-medium"><IconBuilding size={12} /> {event.location}</div>
                    <div className="flex items-center gap-1 text-[11.5px] font-medium"><IconUsers size={12} /> {event.attendees} Attendees</div>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button className="size-8 rounded-lg bg-white/50 hover:bg-white flex items-center justify-center shadow-sm transition-colors"><IconLink size={14} /></button>
                <button className="size-8 rounded-lg bg-white/50 hover:bg-white flex items-center justify-center shadow-sm transition-colors"><IconEdit size={14} /></button>
              </div>
            </div>
          )) : (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <IconCalendar size={32} className="text-slate-300 mb-3" />
              <p className="text-[13.5px] font-medium text-slate-800">No events scheduled.</p>
              <p className="text-[12px] text-slate-500 mt-1">Your calendar is clear for this period.</p>
              <Button onClick={() => setEventModalOpen(true)} variant="secondary" className="mt-4">
                Schedule an Event
              </Button>
            </div>
          )}
        </div>
      </Card>

      <EventFormModal
        open={eventModalOpen}
        onClose={() => setEventModalOpen(false)}
        onSubmit={handleCreateEvent}
      />
    </div>
  );
}
