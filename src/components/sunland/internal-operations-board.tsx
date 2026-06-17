"use client";

import { useState } from "react";
import { 
  IconCalendarEvent, 
  IconUsers, 
  IconBriefcase, 
  IconGavel, 
  IconChevronLeft, 
  IconChevronRight, 
  IconPlus,
  IconVideo,
  IconMapPin,
  IconClock
} from "@tabler/icons-react";
import { cn } from "@/lib/utils/cn";

export function InternalOperationsBoard() {
  const [selectedDate, setSelectedDate] = useState<number>(17); // Mock current date

  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  // Mock calendar dates for the current week/view
  const dates = Array.from({ length: 35 }).map((_, i) => {
    const dayNum = i - 2; // Offset to start month
    return dayNum > 0 && dayNum <= 30 ? dayNum : null;
  });

  const getEventsForDate = (date: number) => {
    if (date === 17) {
      return [
        { time: "09:00 AM", title: "Executive Board Review", type: "internal", duration: "1.5h", color: "bg-teal-50/50 border-teal-200", textColor: "text-teal-900", accent: "bg-teal-500", iconColor: "text-teal-600" },
        { time: "01:30 PM", title: "HNW Viewing - Runda Villa", type: "external", duration: "2h", color: "bg-sky-50/50 border-sky-200", textColor: "text-sky-900", accent: "bg-sky-500", iconColor: "text-sky-600" },
        { time: "04:00 PM", title: "Escrow Signing - Tower 4B", type: "legal", duration: "1h", color: "bg-indigo-50/50 border-indigo-200", textColor: "text-indigo-900", accent: "bg-indigo-500", iconColor: "text-indigo-600" },
      ];
    }
    if (date === 18) {
      return [
        { time: "11:00 AM", title: "Q3 Performance Sync", type: "internal", duration: "1h", color: "bg-teal-50/50 border-teal-200", textColor: "text-teal-900", accent: "bg-teal-500", iconColor: "text-teal-600" },
        { time: "02:00 PM", title: "Site Inspection: Karen", type: "maintenance", duration: "3h", color: "bg-amber-50/50 border-amber-200", textColor: "text-amber-900", accent: "bg-amber-500", iconColor: "text-amber-600" },
      ];
    }
    return [];
  };

  return (
    <div className="w-full my-12 md:my-16">
      {/* ── Section Header ── */}
      <div className="py-6 border-t border-slate-200/60 flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-2">
        <div>
          <h2 className="title-serif text-slate-900 text-[22px]">Internal Structure & Scheduler</h2>
          <p className="text-[12px] text-slate-500 font-medium tracking-wide mt-1">High-level operations breakdown and executive itinerary.</p>
        </div>
        
        <button className="flex items-center gap-2 bg-[#15464e] text-white px-4 py-2 rounded-lg text-[13px] font-medium shadow-sm hover:bg-[#0f343a] transition-colors">
          <IconPlus size={16} stroke={2} />
          <span>Schedule Event</span>
        </button>
      </div>

      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch w-full">
        
        {/* ── Firm Operations (Left) ── */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          {/* Department Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-[20px] border border-slate-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] hover:shadow-md transition-all group relative overflow-hidden flex flex-col justify-between h-[130px]">
              <div className="absolute -right-4 -top-4 size-20 bg-teal-50/50 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="size-8 rounded-lg bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-700">
                    <IconBriefcase size={16} stroke={1.5} />
                  </div>
                  <span className="text-[11px] font-medium text-slate-500 uppercase tracking-widest">Sales</span>
                </div>
                <div className="flex items-center gap-1 bg-teal-50 px-1.5 py-0.5 rounded text-[10px] text-teal-700 font-medium">
                  <span className="size-1.5 rounded-full bg-teal-500 animate-pulse" /> Active
                </div>
              </div>
              <div className="mt-auto flex items-end justify-between">
                <div>
                  <h3 className="text-[32px] font-mono font-medium text-slate-800 leading-none tracking-tight">24</h3>
                  <p className="text-[11px] text-slate-400 font-medium mt-1">Licensed Brokers</p>
                </div>
                <div className="text-right">
                  <p className="text-[12px] font-mono text-teal-600 font-medium">+3 this Q</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white p-4 rounded-[20px] border border-slate-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] hover:shadow-md transition-all group relative overflow-hidden flex flex-col justify-between h-[130px]">
              <div className="absolute -right-4 -top-4 size-20 bg-amber-50/50 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="size-8 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-700">
                    <IconUsers size={16} stroke={1.5} />
                  </div>
                  <span className="text-[11px] font-medium text-slate-500 uppercase tracking-widest">Ops</span>
                </div>
                <div className="flex items-center gap-1 bg-amber-50 px-1.5 py-0.5 rounded text-[10px] text-amber-700 font-medium">
                  <span className="size-1.5 rounded-full bg-amber-500 animate-pulse" /> At Capacity
                </div>
              </div>
              <div className="mt-auto flex items-end justify-between">
                <div>
                  <h3 className="text-[32px] font-mono font-medium text-slate-800 leading-none tracking-tight">18</h3>
                  <p className="text-[11px] text-slate-400 font-medium mt-1">Property Managers</p>
                </div>
                <div className="text-right">
                  <p className="text-[12px] font-mono text-amber-600 font-medium">420 Units</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white p-4 rounded-[20px] border border-slate-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] hover:shadow-md transition-all group relative overflow-hidden flex flex-col justify-between h-[130px]">
              <div className="absolute -right-4 -top-4 size-20 bg-indigo-50/50 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="size-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700">
                    <IconGavel size={16} stroke={1.5} />
                  </div>
                  <span className="text-[11px] font-medium text-slate-500 uppercase tracking-widest">Legal</span>
                </div>
                <div className="flex items-center gap-1 bg-slate-50 px-1.5 py-0.5 rounded text-[10px] text-slate-500 font-medium">
                  Processing
                </div>
              </div>
              <div className="mt-auto flex items-end justify-between">
                <div>
                  <h3 className="text-[32px] font-mono font-medium text-slate-800 leading-none tracking-tight">6</h3>
                  <p className="text-[11px] text-slate-400 font-medium mt-1">Escrow Officers</p>
                </div>
                <div className="text-right">
                  <p className="text-[12px] font-mono text-indigo-600 font-medium">14 Pending</p>
                </div>
              </div>
            </div>
          </div>

          {/* Active Workflows Timeline */}
          <div className="bg-white flex-1 p-6 rounded-[20px] border border-slate-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex flex-col">
            <div className="flex items-center justify-between mb-6 border-b border-slate-50 pb-4">
              <h3 className="text-[16px] font-medium text-slate-900 tracking-tight">Cross-Department Operations</h3>
              <button className="text-[11px] font-medium text-slate-500 hover:text-slate-800 transition-colors bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">View All Projects</button>
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
                      <h4 className="text-[14px] font-medium text-slate-800">Q3 Broker Recruitment Drive</h4>
                      <p className="text-[12px] text-slate-500 mt-0.5">Interviewing 12 candidates for the commercial sector.</p>
                    </div>
                    <span className="text-[10px] bg-white border border-slate-200 text-slate-500 px-2 py-0.5 rounded shadow-sm font-medium uppercase tracking-wider">Sales</span>
                  </div>
                  
                  <div className="flex items-center gap-4 mt-3">
                    <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-teal-500 rounded-full w-[60%]" />
                    </div>
                    <span className="text-[11px] text-teal-600 font-medium whitespace-nowrap">60% Complete</span>
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
                      <h4 className="text-[14px] font-medium text-slate-800">Escrow Clearance: Muthaiga Estate</h4>
                      <p className="text-[12px] text-slate-500 mt-0.5">Finalizing deed transfers and tax documentation.</p>
                    </div>
                    <span className="text-[10px] bg-white border border-slate-200 text-slate-500 px-2 py-0.5 rounded shadow-sm font-medium uppercase tracking-wider">Legal</span>
                  </div>
                  
                  <div className="flex items-center justify-between mt-3">
                    <div className="flex -space-x-2">
                      <img src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=32&h=32&fit=crop&crop=face" alt="Assignee" className="size-6 rounded-full border-2 border-white bg-slate-100" />
                      <img src="https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=32&h=32&fit=crop&crop=face" alt="Assignee" className="size-6 rounded-full border-2 border-white bg-slate-100" />
                      <div className="size-6 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-[9px] font-medium text-slate-500">+1</div>
                    </div>
                    <span className="text-[11px] text-indigo-600 font-medium px-2.5 py-1 bg-indigo-50 rounded-md">Awaiting Signature</span>
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
                      <h4 className="text-[14px] font-medium text-slate-800">Routine Safety Audits</h4>
                      <p className="text-[12px] text-slate-500 mt-0.5">Inspecting 4 multi-family complexes in Westlands.</p>
                    </div>
                    <span className="text-[10px] bg-white border border-slate-200 text-slate-500 px-2 py-0.5 rounded shadow-sm font-medium uppercase tracking-wider">Ops</span>
                  </div>
                  
                  <div className="flex items-center justify-between mt-3">
                     <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1.5"><IconClock size={12} stroke={2}/> June 19, 2026</span>
                     <span className="text-[11px] text-amber-600 font-medium px-2.5 py-1 bg-amber-50 rounded-md">Scheduled</span>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* ── Executive Scheduler (Right) ── */}
        <div className="lg:col-span-5 bg-white p-6 rounded-[20px] border border-slate-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-[16px] font-medium text-slate-900 tracking-tight">Executive Scheduler</h3>
            <div className="flex items-center gap-3">
              <button className="text-slate-400 hover:text-slate-800 transition-colors">
                <IconChevronLeft size={18} stroke={2} />
              </button>
              <span className="text-[13px] font-medium text-slate-700">June 2026</span>
              <button className="text-slate-400 hover:text-slate-800 transition-colors">
                <IconChevronRight size={18} stroke={2} />
              </button>
            </div>
          </div>

          {/* Mini Calendar Grid */}
          <div className="grid grid-cols-7 gap-1 mb-6">
            {days.map(d => (
              <div key={d} className="text-center text-[10px] font-medium uppercase tracking-widest text-slate-400 mb-2">{d}</div>
            ))}
            {dates.map((date, i) => (
              <button
                key={i}
                onClick={() => date && setSelectedDate(date)}
                disabled={!date}
                className={cn(
                  "h-[34px] flex items-center justify-center text-[13px] font-medium rounded-lg transition-all",
                  !date ? "text-transparent pointer-events-none" : "",
                  date === selectedDate 
                    ? "bg-[#15464e] text-white shadow-sm" 
                    : date === 17 
                      ? "bg-slate-100 text-slate-900" 
                      : "text-slate-600 hover:bg-slate-50"
                )}
              >
                {date}
                {/* Event Indicators */}
                {date && getEventsForDate(date).length > 0 && date !== selectedDate && (
                  <div className="absolute bottom-1 flex gap-[2px]">
                    <div className="size-1 rounded-full bg-orange-400" />
                  </div>
                )}
              </button>
            ))}
          </div>

          {/* Selected Date Itinerary */}
          <div className="flex-1 flex flex-col">
            <h4 className="text-[13px] font-medium text-slate-800 mb-4 pb-2 border-b border-slate-100 flex justify-between items-center">
              <span>{selectedDate === 17 ? 'Today\'s Itinerary' : `June ${selectedDate}, 2026`}</span>
              <span className="text-[11px] text-slate-400">{getEventsForDate(selectedDate).length} events</span>
            </h4>

            <div className="flex-1 space-y-3 overflow-y-auto pr-2 custom-scrollbar">
              {getEventsForDate(selectedDate).map((evt, i) => (
                <div key={i} className={cn("p-3.5 rounded-[14px] border flex gap-3.5 relative overflow-hidden group shadow-sm hover:shadow-md transition-all", evt.color)}>
                  <div className={cn("absolute left-0 top-0 bottom-0 w-[4px]", evt.accent)} />
                  <div className={cn("flex flex-col items-center justify-center shrink-0 pr-3 border-r border-black/5 min-w-[55px]", evt.textColor)}>
                    <span className="text-[13px] font-mono font-medium leading-none mb-1">{evt.time.split(' ')[0]}</span>
                    <span className="text-[9px] uppercase tracking-widest font-bold opacity-70">{evt.time.split(' ')[1]}</span>
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <h5 className={cn("text-[14px] font-medium tracking-tight truncate leading-snug", evt.textColor)}>{evt.title}</h5>
                    <div className={cn("flex items-center gap-3 mt-1.5 opacity-80", evt.textColor)}>
                      <div className="flex items-center gap-1">
                        <IconClock size={13} stroke={2.5} className={evt.iconColor} />
                        <span className="text-[11px] font-medium">{evt.duration}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {evt.type === 'internal' ? <IconVideo size={13} stroke={2.5} className={evt.iconColor} /> : <IconMapPin size={13} stroke={2.5} className={evt.iconColor} />}
                        <span className="text-[11px] font-medium capitalize">{evt.type}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {getEventsForDate(selectedDate).length === 0 && (
                <div className="flex flex-col items-center justify-center h-[120px] text-center">
                  <div className="size-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 mb-2">
                    <IconCalendarEvent size={20} stroke={1.5} />
                  </div>
                  <p className="text-[12.5px] text-slate-500 font-medium">No events scheduled.</p>
                </div>
              )}
            </div>
          </div>

        </div>
      </section>
    </div>
  );
}
