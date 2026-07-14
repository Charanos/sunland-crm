"use client";

import Link from "next/link";
import {
  IconUsers,
  IconCalendar,
  IconFileText,
  IconClock,
  IconChartBar,
  IconPlus,
  IconChevronRight,
  IconUserPlus,
  IconBuildingCommunity,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils/cn";

// ── Mock data ─────────────────────────────────────────────────────────────────

const HR_STATS = [
  { label: "Total Headcount", value: "36", sub: "+2 this month", tone: "success" as const },
  { label: "Active Attendance", value: "94.2%", sub: "Today", tone: "neutral" as const },
  { label: "Open Positions", value: "4", sub: "Actively hiring", tone: "warning" as const },
  { label: "Payroll Status", value: "Pending", sub: "June 2026", tone: "warning" as const },
];

const RECENT_HIRES = [
  { name: "Sarah Kimani", role: "Rentals Officer", dept: "Finance", date: "Jun 15, 2026" },
  { name: "David Omondi", role: "Property Manager", dept: "Operations", date: "Jun 01, 2026" },
  { name: "Faith Waweru", role: "HR Officer", dept: "Human Resources", date: "May 22, 2026" },
];

const HR_QUICK_LINKS = [
  { label: "Payroll Management", desc: "Process runs, deductions & PAYE", href: "/fin/payroll", icon: IconChartBar },
  { label: "Leave Calendar", desc: "View & approve leave requests", href: "/admin/hr/leave", icon: IconCalendar },
  { label: "Employee Records", desc: "Browse all staff profiles & contracts", href: "/admin/hr/employees", icon: IconUsers },
  { label: "HR Reports", desc: "Headcount, turnover & attendance", href: "/admin/reports", icon: IconFileText },
];

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatCard({ stat }: { stat: typeof HR_STATS[number] }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
      <p className="label-caps text-slate-400 mb-3">{stat.label}</p>
      <p className={cn("font-mono text-2xl leading-none mb-1", stat.tone === "success" ? "text-emerald-700" : stat.tone === "warning" ? "text-amber-700" : "text-slate-900")}>
        {stat.value}
      </p>
      <p className="text-tiny text-slate-400">{stat.sub}</p>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function HRPortalPage() {
  return (
    <div className="mx-auto max-w-[88rem] flex flex-col gap-6 pb-12 animate-fade-in">

      {/* ── Header ───────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="label-caps text-[var(--on-surface-dim)] mb-1">People Operations</p>
          <h1 className="title-serif mt-2 text-slate-900">HR Portal</h1>
          <p className="body-sm text-slate-400 mt-1">Manage your workforce, payroll, attendance, and HR operations.</p>
        </div>
        <button type="button"
          className="flex items-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2.5 text-caption text-[var(--on-primary)] shadow-sm hover:brightness-95 transition-all">
          <IconUserPlus size={15} />
          New Employee
        </button>
      </div>

      {/* ── KPI Stats ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {HR_STATS.map(stat => <StatCard key={stat.label} stat={stat} />)}
      </div>

      {/* ── Content Grid ──────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

        {/* Quick links */}
        <div className="lg:col-span-5">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
            <h2 className="headline-md text-slate-900 mb-4">HR Modules</h2>
            <div className="space-y-2">
              {HR_QUICK_LINKS.map(link => {
                const LinkIcon = link.icon;
                return (
                  <Link key={link.href} href={link.href} className="group flex items-center gap-3 rounded-xl border border-slate-100 p-3 hover:border-slate-200 hover:bg-slate-50/50 transition-all">
                    <div className="size-9 shrink-0 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-[var(--sidebar)] group-hover:text-white transition-all">
                      <LinkIcon size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-caption text-slate-800 group-hover:text-slate-900">{link.label}</p>
                      <p className="text-tiny text-slate-400">{link.desc}</p>
                    </div>
                    <IconChevronRight size={14} className="text-slate-300 group-hover:text-slate-400 transition-colors" />
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        {/* Recent hires */}
        <div className="lg:col-span-7">
          <div className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_4px_rgba(0,0,0,0.04)] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h2 className="headline-md text-slate-900">Recent Hires</h2>
              <span className="label-caps text-slate-400">Last 90 days</span>
            </div>
            <div className="divide-y divide-slate-100">
              {RECENT_HIRES.map((hire, idx) => (
                <div key={idx} className="flex items-center gap-4 px-5 py-3 hover:bg-slate-50/50 transition-colors">
                  <div className="size-9 shrink-0 rounded-full bg-[var(--sidebar)] flex items-center justify-center text-white text-tiny">
                    {hire.name.split(" ").map(n => n[0]).join("")}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-caption text-slate-800">{hire.name}</p>
                    <p className="text-tiny text-slate-400">{hire.role} · {hire.dept}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 text-tiny text-slate-400">
                    <IconClock size={11} />
                    {hire.date}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Coming soon notice */}
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center">
        <div className="size-12 rounded-full bg-white border border-slate-200 flex items-center justify-center mx-auto mb-3 shadow-sm">
          <IconUsers size={20} className="text-slate-400" />
        </div>
        <p className="headline-md text-slate-600">Full HR module in development</p>
        <p className="body-sm text-slate-400 mt-1 max-w-sm mx-auto">Advanced leave management, performance reviews, and employee self-service portal coming soon.</p>
      </div>
    </div>
  );
}
