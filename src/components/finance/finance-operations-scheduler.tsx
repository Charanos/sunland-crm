"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  IconCalendarEvent,
  IconClock,
  IconScale,
  IconWallet,
  IconBuildingBank,
  IconPlus,
  IconChevronLeft,
  IconChevronRight,
  IconShieldExclamation,
  IconReceipt2,
  IconTrash
} from "@tabler/icons-react";
import { useToast } from "@/components/ui/toast-provider";
import { BoardPanel } from "@/components/ui/erp-primitives";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils/cn";

interface FinanceEvent {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM AM/PM
  duration: string;
  type: "ledger" | "landlords" | "statutory" | "audit";
  location: string;
}

const TYPE_STYLES = {
  ledger: { bg: "bg-blue-50/50 border-blue-200", text: "text-blue-900", icon: IconScale, accent: "bg-blue-500", iconColor: "text-blue-600" },
  landlords: { bg: "bg-emerald-50/50 border-emerald-200", text: "text-emerald-900", icon: IconBuildingBank, accent: "bg-emerald-500", iconColor: "text-emerald-600" },
  statutory: { bg: "bg-purple-50/50 border-purple-200", text: "text-purple-900", icon: IconReceipt2, accent: "bg-purple-500", iconColor: "text-purple-600" },
  audit: { bg: "bg-amber-50/50 border-amber-200", text: "text-amber-900", icon: IconShieldExclamation, accent: "bg-amber-500", iconColor: "text-amber-600" },
};

export interface FinanceOperationsSchedulerProps {
  onNewJournal?: () => void;
  onLogCheque?: () => void;
  onDraftMandate?: () => void;
  onRunPayroll?: () => void;
}

export function FinanceOperationsScheduler({
  onNewJournal,
  onLogCheque,
  onDraftMandate,
  onRunPayroll,
}: FinanceOperationsSchedulerProps) {
  const { pushToast } = useToast();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [eventModalOpen, setEventModalOpen] = useState(false);

  // Default events mapped to current month for demonstration
  const [events, setEvents] = useState<FinanceEvent[]>([
    {
      id: "fe1",
      title: "Mid-Month Ledger Reconciliation",
      date: new Date().toISOString().split("T")[0],
      time: "09:00 AM",
      duration: "1.5h",
      type: "ledger",
      location: "Finance Room 1",
    },
    {
      id: "fe2",
      title: "Landlord Remittance Cycle Run",
      date: new Date().toISOString().split("T")[0],
      time: "11:00 AM",
      duration: "2h",
      type: "landlords",
      location: "Main Ledger Room",
    },
    {
      id: "fe3",
      title: "Statutory Return Review (KRA)",
      date: new Date().toISOString().split("T")[0],
      time: "03:00 PM",
      duration: "1h",
      type: "statutory",
      location: "Zoom Review",
    },
  ]);

  // Closing Workflows State
  const [closingWorkflows, setClosingWorkflows] = useState([
    { id: "cw1", title: "Unposted General Journals", desc: "15 journal entries require posting to the general ledger.", type: "Ledger", progress: 60, status: "In Progress" },
    { id: "cw2", title: "Suspense Account Clearance", desc: "Unallocated funds in suspense account need matching.", type: "Reconciliation", progress: 0, status: "Awaiting Sign-off" },
    { id: "cw3", title: "Bank Reconciliation - Equity", desc: "Match statement balances for equity operational account.", type: "Banking", progress: 0, status: "Scheduled" }
  ]);

  // Modal form states
  const [newTitle, setNewTitle] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");
  const [newDuration, setNewDuration] = useState("");
  const [newType, setNewType] = useState<"ledger" | "landlords" | "statutory" | "audit">("ledger");

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

  const handleCreateEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newDate || !newTime || !newDuration.trim()) {
      pushToast({ tone: "error", title: "Missing Fields", body: "Please fill out all event fields." });
      return;
    }

    if (newTitle.trim().length < 3) {
      pushToast({ tone: "error", title: "Invalid Title", body: "Event title must be at least 3 characters long." });
      return;
    }

    // Convert 24-hour browser time format to 12-hour AM/PM format
    const convert24hTo12h = (time24: string): string => {
      if (!time24) return "";
      const [hoursStr, minutesStr] = time24.split(":");
      let hours = parseInt(hoursStr, 10);
      const minutes = minutesStr;
      const ampm = hours >= 12 ? "PM" : "AM";
      hours = hours % 12;
      hours = hours ? hours : 12; // the hour '0' should be '12'
      const hoursFormatted = hours < 10 ? `0${hours}` : hours;
      return `${hoursFormatted}:${minutes} ${ampm}`;
    };

    const formattedTime = convert24hTo12h(newTime);

    const newEvent: FinanceEvent = {
      id: `fe-${Date.now()}`,
      title: newTitle.trim(),
      date: newDate,
      time: formattedTime,
      duration: newDuration.trim(),
      type: newType,
      location: "TBD Room",
    };

    setEvents((prev) => [...prev, newEvent]);
    setSelectedDate(new Date(newDate + "T12:00:00"));
    setEventModalOpen(false);

    // Reset
    setNewTitle("");
    setNewDate("");
    setNewTime("");
    setNewDuration("");
    setNewType("ledger");

    pushToast({ tone: "success", title: "Closing Event Scheduled", body: `"${newTitle}" added to itinerary.` });
  };

  const handleWorkflowAction = (id: string) => {
    const target = closingWorkflows.find(w => w.id === id);
    if (target) {
      if (target.status === "In Progress") {
        pushToast({ tone: "success", title: "Journals Posted", body: `"${target.title}" successfully posted to ledger.` });
      } else if (target.status === "Awaiting Sign-off") {
        pushToast({ tone: "success", title: "Reconciliation Approved", body: `"${target.title}" signed off.` });
      } else if (target.status === "Scheduled") {
        pushToast({ tone: "success", title: "Reconciliation Started", body: `"${target.title}" verification logged.` });
      }
    }

    setClosingWorkflows(prev => prev.map(w => {
      if (w.id === id) {
        if (w.status === "In Progress") {
          return { ...w, progress: 100, status: "Completed" };
        } else if (w.status === "Awaiting Sign-off") {
          return { ...w, progress: 100, status: "Filed" };
        } else if (w.status === "Scheduled") {
          return { ...w, progress: 100, status: "Completed" };
        }
      }
      return w;
    }));
  };

  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);
  const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="w-full my-8">
      {/* ── Section Header ── */}
      <div className="py-5 border-t border-slate-200/60 flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-2">
        <div>
          <h2 className="title-serif text-slate-900 font-normal">Financal Operations & Closing Scheduler</h2>
          <p className="text-desc-secondary mt-1">
            Itinerary, compliance check runs, and closing workflows.
          </p>
        </div>

        <button
          onClick={() => setEventModalOpen(true)}
          className="flex items-center gap-2 bg-[#f3df27] text-[#151936] px-4 py-2 rounded-xl shadow-sm hover:bg-[#e6d220] transition-colors font-medium text-base hover:-translate-y-0.5 transition-all"
        >
          <IconPlus size={15} stroke={2.5} />
          <span>Schedule Closing Event</span>
        </button>
      </div>

      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch w-full">

        {/* ── Left Column: Operations & Quick Commands (Col 3) ── */}
        <div className="lg:col-span-3 flex flex-col gap-5">
          {/* Quick Command Menu */}
          <div className="flex flex-col gap-3">
            <h3 className="text-title-primary px-1 mb-1">Quick Commands</h3>

            <button onClick={onNewJournal} className="group relative w-full flex items-center justify-between p-3.5 rounded-2xl bg-gradient-to-r from-[#151936] to-[#20254f] text-white shadow-md shadow-blue-900/20 hover:-translate-y-0.5 transition-all">
              <div className="flex items-center gap-3">
                <div className="size-8 rounded-xl bg-white/10 flex items-center justify-center">
                  <IconScale size={16} stroke={2.5} />
                </div>
                <span className="font-medium text-sm tracking-wide">New Journal Entry</span>
              </div>
              <IconChevronRight size={16} className="opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
            </button>

            <button onClick={onLogCheque} className="group w-full flex items-center justify-between p-3.5 rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-md hover:border-amber-200 transition-all">
              <div className="flex items-center gap-3">
                <div className="size-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <IconReceipt2 size={16} stroke={2.5} />
                </div>
                <span className="text-body-primary">Log Cheque</span>
              </div>
              <IconChevronRight size={16} className="text-slate-300 group-hover:text-amber-500 group-hover:translate-x-1 transition-all" />
            </button>

            <button onClick={onDraftMandate} className="group w-full flex items-center justify-between p-3.5 rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all">
              <div className="flex items-center gap-3">
                <div className="size-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <IconBuildingBank size={16} stroke={2.5} />
                </div>
                <span className="text-body-primary">Draft Mandate</span>
              </div>
              <IconChevronRight size={16} className="text-slate-300 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all" />
            </button>

            <button onClick={onRunPayroll} className="group w-full flex items-center justify-between p-3.5 rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-md hover:border-purple-200 transition-all">
              <div className="flex items-center gap-3">
                <div className="size-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                  <IconReceipt2 size={16} stroke={2.5} />
                </div>
                <span className="text-body-primary">Run Payroll</span>
              </div>
              <IconChevronRight size={16} className="text-slate-300 group-hover:text-purple-500 group-hover:translate-x-1 transition-all" />
            </button>
          </div>

          <div className="h-px bg-slate-200/60 w-full my-1" />

          {/* Department Cards Stack */}
          <div className="flex flex-col gap-4">
            <h3 className="text-title-primary px-1">Firm Operations</h3>
            <Link href="/fin/ledger/journal-entries" className="group">
              <BoardPanel className="p-4 flex flex-col justify-between h-[110px] relative overflow-hidden transition-all duration-300 hover:shadow-md hover:-translate-y-1 hover:border-blue-200 bg-gradient-to-b from-white to-blue-50/10 cursor-pointer">
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity translate-x-4 -translate-y-4">
                  <IconWallet size={80} stroke={1} />
                </div>
                <div className="flex items-center justify-between relative z-10">
                  <div className="flex items-center gap-2">
                    <div className="size-7 rounded-lg bg-gradient-to-br from-blue-50 to-blue-100/50 text-blue-600 flex items-center justify-center shadow-sm border border-blue-200/50">
                      <IconWallet size={14} stroke={2.5} />
                    </div>
                    <span className="text-slate-400 label-caps">Treasury</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-blue-50/80 px-2 py-0.5 rounded-md border border-blue-100 text-blue-700 font-normal label-caps">
                    <span className="size-1.5 rounded-full bg-blue-500 animate-pulse" /> Reconciled
                  </div>
                </div>
                <div className="flex items-end justify-between mt-auto relative z-10">
                  <h3 className="font-mono font-normal tracking-tight text-blue-700 leading-none text-2xl">6</h3>
                  <div className="text-right">
                    <p className="font-mono text-blue-600/80 label-caps">No holds</p>
                  </div>
                </div>
              </BoardPanel>
            </Link>

            <Link href="/fin/mandates/active" className="group">
              <BoardPanel className="p-4 flex flex-col justify-between h-[110px] relative overflow-hidden transition-all duration-300 hover:shadow-md hover:-translate-y-1 hover:border-emerald-200 bg-gradient-to-b from-white to-emerald-50/10 cursor-pointer">
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity translate-x-4 -translate-y-4">
                  <IconBuildingBank size={80} stroke={1} />
                </div>
                <div className="flex items-center justify-between relative z-10">
                  <div className="flex items-center gap-2">
                    <div className="size-7 rounded-lg bg-gradient-to-br from-emerald-50 to-emerald-100/50 text-emerald-600 flex items-center justify-center shadow-sm border border-emerald-200/50">
                      <IconBuildingBank size={14} stroke={2.5} />
                    </div>
                    <span className="text-slate-400 label-caps">Revenue</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-emerald-50/80 px-2 py-0.5 rounded-md border border-emerald-100 text-emerald-700 font-normal label-caps">
                    <span className="size-1.5 rounded-full bg-emerald-500" /> Active
                  </div>
                </div>
                <div className="flex items-end justify-between mt-auto relative z-10">
                  <h3 className="font-mono font-normal tracking-tight text-emerald-700 leading-none text-2xl">28</h3>
                  <div className="text-right">
                    <p className="font-mono text-emerald-600/80 label-caps">10% std</p>
                  </div>
                </div>
              </BoardPanel>
            </Link>

            <Link href="/fin/ledger/journal-entries" className="group">
              <BoardPanel className="p-4 flex flex-col justify-between h-[110px] relative overflow-hidden transition-all duration-300 hover:shadow-md hover:-translate-y-1 hover:border-purple-200 bg-gradient-to-b from-white to-purple-50/10 cursor-pointer">
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity translate-x-4 -translate-y-4">
                  <IconScale size={80} stroke={1} />
                </div>
                <div className="flex items-center justify-between relative z-10">
                  <div className="flex items-center gap-2">
                    <div className="size-7 rounded-lg bg-gradient-to-br from-purple-50 to-purple-100/50 text-purple-600 flex items-center justify-center shadow-sm border border-purple-200/50">
                      <IconScale size={14} stroke={2.5} />
                    </div>
                    <span className="text-slate-400 label-caps">Assurance</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-purple-50/80 px-2 py-0.5 rounded-md border border-purple-100 text-purple-700 font-normal label-caps">
                    Balanced
                  </div>
                </div>
                <div className="flex items-end justify-between mt-auto relative z-10">
                  <h3 className="font-mono font-normal tracking-tight text-purple-700 leading-none text-2xl">100%</h3>
                  <div className="text-right">
                    <p className="font-mono text-purple-600/80 label-caps">JE-2026 Ready</p>
                  </div>
                </div>
              </BoardPanel>
            </Link>
          </div>
        </div>

        {/* ── Middle Column: Workflows (Col 5) ── */}
        <div className="lg:col-span-5 flex flex-col">
          <BoardPanel className="flex flex-1 flex-col h-full">
            <div className="flex items-center justify-between mb-5 border-b border-slate-50 pb-3">
              <h3 className="text-title-primary">Ledger Reconciliation & Posting Queue</h3>
              <span className="text-sm text-slate-450 font-normal">Click a card to progress task</span>
            </div>

            <div className="space-y-4 flex-1 overflow-y-auto custom-scrollbar pr-1">
              {closingWorkflows.map((w, idx) => {
                const getToneStyle = (type: string) => {
                  switch (type.toLowerCase()) {
                    case "ledger": return { bg: "bg-blue-500", text: "text-blue-600", dot: "bg-blue-500", border: "group-hover:bg-blue-100" };
                    case "reconciliation": return { bg: "bg-purple-500", text: "text-purple-600", dot: "bg-purple-500", border: "group-hover:bg-purple-100" };
                    case "banking": return { bg: "bg-emerald-500", text: "text-emerald-600", dot: "bg-emerald-500", border: "group-hover:bg-emerald-100" };
                    default: return { bg: "bg-amber-500", text: "text-amber-600", dot: "bg-amber-500", border: "group-hover:bg-amber-100" };
                  }
                };

                const styles = getToneStyle(w.type);

                return (
                  <div key={w.id} className="flex gap-4 relative group cursor-pointer" onClick={() => handleWorkflowAction(w.id)}>
                    {idx < closingWorkflows.length - 1 && (
                      <div className={cn("absolute left-[15px] top-[32px] bottom-[-20px] w-px bg-slate-100 transition-colors", styles.border)} />
                    )}
                    <div className="size-8 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 z-10 shadow-sm transition-all group-hover:scale-105">
                      <div className={cn("size-2 rounded-full", w.progress === 100 ? "bg-emerald-500 animate-none" : styles.dot + " animate-pulse")} />
                    </div>
                    <div className="flex-1 bg-slate-50/50 hover:bg-slate-50 p-4 rounded-xl border border-slate-100 transition-colors">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h4 className="text-title-primary group-hover:text-blue-600 transition-colors">{w.title}</h4>
                          <p className="text-sm text-slate-400 mt-1">{w.desc}</p>
                        </div>
                        <span className="bg-white border border-slate-200 text-slate-450 px-2 py-0.5 rounded shadow-sm font-mono label-caps text-xs">{w.type}</span>
                      </div>

                      {w.progress > 0 && w.progress < 100 && (
                        <div className="flex items-center gap-4 mt-3">
                          <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className={cn("h-full rounded-full w-[80%]", styles.bg)} style={{ width: `${w.progress}%` }} />
                          </div>
                          <span className={cn("text-sm whitespace-nowrap font-mono font-medium", styles.text)}>{w.progress}% Done</span>
                        </div>
                      )}

                      {w.progress === 100 && (
                        <div className="flex items-center justify-between mt-3">
                          <span className="text-sm text-slate-400">Completed and Verified</span>
                          <span className="text-sm text-emerald-600 px-2.5 py-0.5 bg-emerald-50 rounded-md font-medium">Completed</span>
                        </div>
                      )}

                      {w.progress === 0 && (
                        <div className="flex items-center justify-between mt-3">
                          <span className="text-sm text-slate-450 font-normal">Click to sign off and file</span>
                          <span className={cn("text-sm px-2.5 py-0.5 rounded-md font-medium", w.status === "Awaiting Sign-off" ? "text-purple-600 bg-purple-50" : "text-amber-600 bg-amber-50")}>
                            {w.status}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </BoardPanel>
        </div>

        {/* ── Executive Scheduler (Right Column: Col 4) ── */}
        <BoardPanel className="lg:col-span-4 flex flex-col h-full">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-title-primary">Closing Scheduler</h3>
            <div className="flex items-center gap-2">
              <button onClick={prevMonth} className="text-slate-450 hover:text-slate-800 transition-colors">
                <IconChevronLeft size={16} stroke={2.5} />
              </button>
              <span className="text-slate-700 w-24 text-center font-medium text-base">
                {currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
              </span>
              <button onClick={nextMonth} className="text-slate-450 hover:text-slate-800 transition-colors">
                <IconChevronRight size={16} stroke={2.5} />
              </button>
            </div>
          </div>

          {/* Real Calendar Grid */}
          <div className="grid grid-cols-7 gap-1 mb-5">
            {daysOfWeek.map(d => (
              <div key={d} className="text-center text-slate-450 mb-1 label-caps">{d}</div>
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
                    "h-10 w-full flex items-center justify-center text-sm rounded-lg transition-all relative font-medium",
                    !day ? "text-transparent pointer-events-none" : "",
                    isSelected
                      ? "bg-[#151936] text-white shadow-sm font-medium"
                      : isToday
                        ? "bg-slate-100 text-slate-900"
                        : "text-slate-600 hover:bg-slate-50"
                  )}
                >
                  {day}
                  {hasEvt && !isSelected && (
                    <div className="absolute bottom-1 flex gap-[2px]">
                      <div className="size-1 rounded-full bg-amber-500" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Selected Date Itinerary */}
          <div className="flex-1 flex flex-col">
            <h4 className="text-base text-slate-850 mb-3 pb-1.5 border-b border-slate-100 flex justify-between items-center font-medium">
              <span>
                {selectedDate.toDateString() === new Date().toDateString()
                  ? "Today's Itinerary"
                  : selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
              <span className="text-sm text-slate-400 font-mono font-medium">{selectedDateEvents.length} events</span>
            </h4>

            <div className="flex-1 space-y-2.5 overflow-y-auto pr-1">
              {selectedDateEvents.map((evt) => {
                const style = TYPE_STYLES[evt.type];
                return (
                  <div key={evt.id} className={cn("p-3 rounded-[12px] border flex gap-3 relative overflow-hidden group shadow-sm transition-all bg-white hover:shadow", style.bg)}>
                    <div className={cn("absolute left-0 top-0 bottom-0 w-[3px]", style.accent)} />
                    <div className={cn("flex flex-col items-center justify-center shrink-0 pr-3 border-r border-black/5 min-w-[55px]", style.text)}>
                      <span className="leading-none mb-1 mono-data">{evt.time.split(' ')[0]}</span>
                      <span className="body-sm uppercase tracking-wider opacity-70 font-medium">{evt.time.split(' ')[1] || "EAT"}</span>
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                      <h5 className={cn("text-base tracking-tight truncate leading-snug font-medium pr-6", style.text)}>{evt.title}</h5>
                      <div className={cn("flex items-center gap-3 mt-1.5 opacity-80 text-sm", style.text)}>
                        <div className="flex items-center gap-1 font-medium">
                          <IconClock size={12} stroke={2} className={style.iconColor} />
                          <span className="font-mono">{evt.duration}</span>
                        </div>
                        <div className="flex items-center gap-1 font-medium">
                          <style.icon size={12} stroke={2} className={style.iconColor} />
                          <span>{evt.type === "landlords" ? "remittance" : evt.type}</span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEvents(prev => prev.filter(item => item.id !== evt.id));
                        pushToast({ tone: "warning", title: "Event Cancelled", body: `"${evt.title}" has been removed.` });
                      }}
                      className="absolute top-2.5 right-2.5 p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50/50 rounded-lg transition-all opacity-0 group-hover:opacity-100 z-10"
                      title="Cancel Event"
                    >
                      <IconTrash size={14} />
                    </button>
                  </div>
                );
              })}

              {selectedDateEvents.length === 0 && (
                <div className="flex flex-col items-center justify-center h-[100px] text-center">
                  <div className="size-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 mb-2">
                    <IconCalendarEvent size={16} stroke={1.5} />
                  </div>
                  <p className="text-sm text-slate-400 font-medium">No events scheduled.</p>
                </div>
              )}
            </div>
          </div>

        </BoardPanel>
      </section>

      {/* Scheduler Event Creation Modal */}
      <Modal
        open={eventModalOpen}
        onClose={() => setEventModalOpen(false)}
        title="Schedule Closing Event"
        description="Schedule a statutory run, ledger reconciliation, or audit check for a specific date."
        size="md"
      >
        <form onSubmit={handleCreateEvent} className="space-y-4">
          <div className="grid gap-1.5">
            <label className="text-base font-medium text-slate-700">Event Title</label>
            <input
              type="text"
              required
              placeholder="e.g. Q2 VAT Remittance File Audit"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 outline-none focus:border-slate-400 text-body-primary"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <label className="text-base font-medium text-slate-700">Date</label>
              <input
                type="date"
                required
                min={todayStr}
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 outline-none text-body-primary"
              />
            </div>
            <div className="grid gap-1.5">
              <label className="text-base font-medium text-slate-700">Time</label>
              <input
                type="time"
                required
                value={newTime}
                onChange={(e) => setNewTime(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 outline-none text-body-primary"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <label className="text-base font-medium text-slate-700">Duration</label>
              <input
                type="text"
                required
                placeholder="e.g. 1.5h or 45m"
                value={newDuration}
                onChange={(e) => setNewDuration(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 outline-none text-body-primary"
              />
            </div>
            <div className="grid gap-1.5">
              <label className="text-base font-medium text-slate-700">Type</label>
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value as FinanceEvent["type"])}
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 outline-none bg-white text-body-primary"
              >
                <option value="ledger">Ledger Reconciliation (Blue)</option>
                <option value="landlords">Landlord Remittance (Green)</option>
                <option value="statutory">Statutory / Payroll (Purple)</option>
                <option value="audit">Insurance / Compliance Audit (Amber)</option>
              </select>
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-3">
            <button
              type="button"
              onClick={() => setEventModalOpen(false)}
              className="px-4 py-2 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors text-body-regular"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-[#151936] text-white rounded-xl hover:bg-slate-800 transition-colors font-medium text-sm"
            >
              Schedule Event
            </button>
          </div>
        </form>
      </Modal>

    </div>
  );
}
