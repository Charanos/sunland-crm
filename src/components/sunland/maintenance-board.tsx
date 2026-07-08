"use client";

import {
  IconTool,
  IconClipboardList,
} from "@tabler/icons-react";
import Link from "next/link";
import {
  Badge,
  BoardHeader,
  BoardPanel,
} from "@/components/ui/erp-primitives";
import { EmptyState } from "@/components/ui/empty-state";
import { PageTransition } from "@/components/shared/page-transition";

export function MaintenanceBoard() {
  return (
    <PageTransition className="mx-auto flex max-w-[98rem] flex-col gap-4">
      <BoardHeader
        eyebrow={<Badge tone="data">Operations</Badge>}
        title="Maintenance"
        description="Prioritize maintenance issues by property, contractor, urgency, age, and resolution status."
      />

      {/* ── Operations Control Hub Navigator ── */}
      <div className="flex items-center justify-between flex-wrap gap-4 bg-white border border-slate-100 p-4 rounded-[20px] shadow-sm">
        <div className="flex items-center gap-2">
          <div className="size-8 rounded-lg bg-indigo-50 text-indigo-650 flex items-center justify-center">
            <IconClipboardList size={16} />
          </div>
          <div>
            <h3 className="text-base font-medium text-slate-800 leading-none">Operations Control Hub</h3>
            <p className="text-sm text-slate-400 mt-1">Navigate across property CRM ops segments.</p>
          </div>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-xl flex-wrap gap-1">
          <Link
            href="/admin/contacts"
            className="px-3.5 py-1.5 text-sm font-medium rounded-lg transition-all flex items-center gap-1.5 text-slate-500 hover:text-slate-900 hover:bg-white/45"
          >
            <span>Contacts</span>
            <span className="bg-slate-200 text-slate-600 px-1.5 py-0.2 rounded-full font-medium text-sm">CRM</span>
          </Link>
          <Link
            href="/admin/pipeline"
            className="px-3.5 py-1.5 text-sm font-medium rounded-lg transition-all flex items-center gap-1.5 text-slate-500 hover:text-slate-900 hover:bg-white/45"
          >
            <span>Deals Pipeline</span>
            <span className="bg-slate-200 text-slate-600 px-1.5 py-0.2 rounded-full font-medium text-sm">Active</span>
          </Link>
          <Link
            href="/admin/leases"
            className="px-3.5 py-1.5 text-sm font-medium rounded-lg transition-all flex items-center gap-1.5 text-slate-500 hover:text-slate-900 hover:bg-white/45"
          >
            <span>Leases</span>
            <span className="bg-slate-200 text-slate-600 px-1.5 py-0.2 rounded-full font-medium text-sm">Tenancies</span>
          </Link>
          <Link
            href="/admin/maintenance"
            className="px-3.5 py-1.5 text-sm font-medium rounded-lg transition-all flex items-center gap-1.5 bg-[#151936] text-white shadow-sm"
          >
            <span>Maintenance</span>
            <span className="bg-[#f3df27] text-[#151936] px-1.5 py-0.2 rounded-full font-medium text-sm">Tickets</span>
          </Link>
        </div>
      </div>

      <BoardPanel className="p-12">
        <EmptyState
          icon={IconTool}
          title="No maintenance queue"
          description="Open maintenance requests will appear here with their current assignment and risk level."
          action="Log request"
        />
      </BoardPanel>
    </PageTransition>
  );
}
