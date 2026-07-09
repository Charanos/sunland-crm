"use client";

import {
  IconFileAnalytics,
  IconBuildingCommunity,
} from "@tabler/icons-react";
import Link from "next/link";
import {
  Badge,
  BoardHeader,
  BoardPanel,
} from "@/components/ui/erp-primitives";
import { EmptyState } from "@/components/ui/empty-state";
import { PageTransition } from "@/components/shared/page-transition";

export function ValuationsBoard() {
  return (
    <PageTransition className="mx-auto flex max-w-[98rem] flex-col gap-4">
      <BoardHeader
        eyebrow={<Badge tone="primary">Advisory</Badge>}
        title="Valuations"
        description="Track valuation instructions, inspection dates, report preparation, delivery, fee collection, and uploads."
      />

      {/* ── Portfolio Control Hub Navigator ── */}
      <div className="flex items-center justify-between flex-wrap gap-4 bg-white border border-slate-100 p-4 rounded-[20px] shadow-sm">
        <div className="flex items-center gap-2">
          <div className="size-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
            <IconBuildingCommunity size={16} />
          </div>
          <div>
            <h3 className="text-base font-medium text-slate-800 leading-none">Portfolio Control Hub</h3>
            <p className="text-sm text-slate-400 mt-1">Navigate across property inventory and advisory segments.</p>
          </div>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-xl flex-wrap gap-1">
          <Link
            href="/admin/properties"
            className="px-3.5 py-1.5 text-body-primary rounded-lg transition-all flex items-center gap-1.5 text-slate-500 hover:text-slate-900 hover:bg-white/45"
          >
            <span>Properties</span>
            <span className="bg-slate-200 text-slate-600 px-1.5 py-0.2 rounded-full text-meta-muted-strong">Inventory</span>
          </Link>
          <Link
            href="/admin/valuations"
            className="px-3.5 py-1.5 text-body-primary rounded-lg transition-all flex items-center gap-1.5 bg-[#151936] text-white shadow-sm"
          >
            <span>Valuations</span>
          </Link>
        </div>
      </div>

      <BoardPanel className="p-12">
        <EmptyState
          icon={IconFileAnalytics}
          title="No valuations yet"
          description="Valuation work will appear here once a valuation instruction is created."
          action="Create valuation"
        />
      </BoardPanel>
    </PageTransition>
  );
}
