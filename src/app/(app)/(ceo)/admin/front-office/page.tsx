"use client";

import Link from "next/link";
import {
  IconCar,
  IconPhone,
  IconClipboardList,
  IconMapPin,
  IconCalendar,
  IconChevronRight,
  IconClock,
  IconUsers,
  IconTrendingUp,
  IconBuildingCommunity,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils/cn";

// ── Mock data ─────────────────────────────────────────────────────────────────

const FO_STATS = [
  { label: "Petty Cash Balance", value: "KES 18,400", sub: "Current float", tone: "neutral" as const },
  { label: "Trips Logged Today", value: "14", sub: "Fleet activity", tone: "neutral" as const },
  { label: "Fleet Expenses MTD", value: "KES 76,000", sub: "vs KES 60K target", tone: "warning" as const },
  { label: "Open Client Calls", value: "7", sub: "Awaiting callback", tone: "neutral" as const },
];

const RECENT_TRIPS = [
  { vehicle: "KBZ 421X", driver: "Tom Kariuki", destination: "Westlands Tower 4B", time: "10:30 AM", status: "Completed" },
  { vehicle: "KCP 089A", driver: "Ben Otieno", destination: "Karen Ridge House", time: "11:15 AM", status: "In Transit" },
  { vehicle: "KBZ 421X", driver: "Tom Kariuki", destination: "Kilimani Heights Office", time: "2:00 PM", status: "Scheduled" },
];

const STATUS_COLORS = {
  Completed: "badge-tone-success",
  "In Transit": "badge-tone-warning",
  Scheduled: "badge-tone-neutral",
};

const FO_QUICK_LINKS = [
  { label: "Logistics & Fleet", desc: "Trip logs, fuel claims & vehicle tracking", href: "/admin/front-office/logistics", icon: IconCar },
  { label: "Client Reception", desc: "Walk-ins, call logs & visitor management", href: "/admin/contacts", icon: IconPhone },
  { label: "Daily Checklist", desc: "Front office daily operations tracker", href: "/admin/front-office/checklist", icon: IconClipboardList },
  { label: "Property Viewings", desc: "Schedule and manage property tours", href: "/admin/properties", icon: IconBuildingCommunity },
];

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function FrontOfficePage() {
  return (
    <div className="mx-auto max-w-[88rem] flex flex-col gap-6 pb-12 animate-fade-in">

      {/* ── Header ───────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="label-caps text-[var(--on-surface-dim)] mb-1">Operations</p>
          <h1 className="title-serif mt-2 text-slate-900">Front Office</h1>
          <p className="body-sm text-slate-500 mt-1">Manage daily front office operations, fleet logistics, and client reception.</p>
        </div>
        <Link href="/admin/front-office/logistics"
          className="flex items-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2.5 text-caption text-[var(--on-primary)] shadow-sm hover:brightness-95 transition-all">
          <IconCar size={15} />
          Log Trip
        </Link>
      </div>

      {/* ── KPI Stats ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {FO_STATS.map(stat => (
          <div key={stat.label} className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
            <p className="label-caps text-slate-400 mb-3">{stat.label}</p>
            <p className={cn("font-mono text-2xl leading-none mb-1", stat.tone === "warning" ? "text-amber-700" : "text-slate-900")}>{stat.value}</p>
            <p className="text-tiny text-slate-400">{stat.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Content Grid ──────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

        {/* Quick links */}
        <div className="lg:col-span-5">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
            <h2 className="headline-md text-slate-900 mb-4">Front Office Modules</h2>
            <div className="space-y-2">
              {FO_QUICK_LINKS.map(link => {
                const LinkIcon = link.icon;
                return (
                  <Link key={link.href} href={link.href} className="group flex items-center gap-3 rounded-xl border border-slate-100 p-3 hover:border-slate-200 hover:bg-slate-50/50 transition-all">
                    <div className="size-9 shrink-0 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 group-hover:bg-[var(--sidebar)] group-hover:text-white transition-all">
                      <LinkIcon size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-caption text-slate-800">{link.label}</p>
                      <p className="text-tiny text-slate-400">{link.desc}</p>
                    </div>
                    <IconChevronRight size={14} className="text-slate-300 group-hover:text-slate-500 transition-colors" />
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        {/* Fleet trips today */}
        <div className="lg:col-span-7">
          <div className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_4px_rgba(0,0,0,0.04)] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h2 className="headline-md text-slate-900">Fleet Activity — Today</h2>
              <span className="label-caps text-slate-400">{new Date().toLocaleDateString("en-KE", { weekday: "short", month: "short", day: "numeric" })}</span>
            </div>
            <div className="divide-y divide-slate-100">
              {RECENT_TRIPS.map((trip, idx) => (
                <div key={idx} className="flex items-start gap-4 px-5 py-3 hover:bg-slate-50/50 transition-colors">
                  <div className="size-9 shrink-0 rounded-full bg-[var(--sidebar)]/10 flex items-center justify-center mt-0.5">
                    <IconCar size={15} className="text-[var(--sidebar)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-caption text-slate-800">{trip.vehicle} — {trip.driver}</p>
                    <p className="text-tiny text-slate-500 mt-0.5 flex items-center gap-1">
                      <IconMapPin size={10} />
                      {trip.destination}
                    </p>
                    <p className="text-tiny text-slate-400 mt-0.5 flex items-center gap-1">
                      <IconClock size={10} />
                      {trip.time}
                    </p>
                  </div>
                  <span className={cn("badge-pill shrink-0", STATUS_COLORS[trip.status as keyof typeof STATUS_COLORS] || "badge-tone-neutral")}>
                    {trip.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Coming soon notice */}
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center">
        <div className="size-12 rounded-full bg-white border border-slate-200 flex items-center justify-center mx-auto mb-3 shadow-sm">
          <IconCar size={20} className="text-slate-400" />
        </div>
        <p className="headline-md text-slate-600">Full Front Office module in development</p>
        <p className="body-sm text-slate-400 mt-1 max-w-sm mx-auto">Live vehicle tracking, digital visitor log, petty cash reconciliation, and client reception workflow coming soon.</p>
      </div>
    </div>
  );
}
