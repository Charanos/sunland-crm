"use client";

import {
  IconFileAnalytics,
  IconFolderOpen,
  IconReportAnalytics,
  IconClipboardCheck,
  IconAlertTriangle,
  IconLifebuoy,
  IconDatabase,
} from "@tabler/icons-react";
import Link from "next/link";
import {
  Badge,
  BoardHeader,
  BoardPanel,
  Button,
} from "@/components/ui/erp-primitives";
import { EmptyState } from "@/components/ui/empty-state";
import { PageTransition } from "@/components/shared/page-transition";
import { FinanceQrProof } from "@/components/finance/finance-qr-proof";
import { cn } from "@/lib/utils/cn";
import { useState } from "react";

const TABS = [
  { id: "all", label: "All Reports" },
  { id: "by-department", label: "By Department" },
  { id: "verify", label: "Verify Document" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const DEPARTMENT_GROUPS = [
  {
    id: "finance",
    label: "Finance",
    description: "Balance sheets, cash flow statements, mandate statements, payroll reports, trial balances.",
    reportCount: 0,
    primaryColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  {
    id: "hr",
    label: "Human Resources",
    description: "Employment records exports, leave history, payroll summaries.",
    reportCount: 0,
    primaryColor: "bg-blue-50 text-blue-700 border-blue-200",
  },
  {
    id: "bd",
    label: "Business Development",
    description: "Pipeline performance, commission summaries, lead conversion reports.",
    reportCount: 0,
    primaryColor: "bg-violet-50 text-violet-700 border-violet-200",
  },
  {
    id: "front-office",
    label: "Front Office",
    description: "Visitor logs, vehicle usage, maintenance resolution exports.",
    reportCount: 0,
    primaryColor: "bg-amber-50 text-amber-700 border-amber-200",
  },
];

export function ReportsCenterBoard() {
  const [activeTab, setActiveTab] = useState<TabId>("all");

  return (
    <PageTransition className="mx-auto flex max-w-[98rem] flex-col gap-4">
      <BoardHeader
        eyebrow={<Badge tone="data">Reports Center</Badge>}
        title="Reports Center"
        description="The executive library of all generated reports across every department. Reports are generated from within each department's own module — this page aggregates and verifies them."
        actions={
          <Button variant="secondary" size="sm" onClick={() => window.location.href = "/fin/reports/generate"}>
            <IconReportAnalytics size={14} />
            Generate Report (Finance)
          </Button>
        }
      />

      {/* ── Oversight Control Hub Navigator & Tabs ── */}
      <div className="bg-white border border-slate-100 rounded-[20px] shadow-sm overflow-hidden">
        {/* Top Navigator */}
        <div className="flex items-center justify-between flex-wrap gap-4 p-4">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center">
              <IconClipboardCheck size={16} />
            </div>
            <div>
              <h3 className="text-base font-medium text-slate-800 leading-none">Oversight Control Hub</h3>
              <p className="text-sm text-slate-400 mt-1">Cross-department audits and system management.</p>
            </div>
          </div>

          <div className="flex bg-slate-100 p-1 rounded-xl flex-wrap gap-1">
            <Link
              href="/admin/approvals"
              className="body-sm px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 text-slate-500 hover:text-slate-900 hover:bg-white/45"
            >
              <span>Approvals</span>
              <span className="bg-slate-200 text-slate-600 px-1.5 py-0.2 rounded-full text-meta-muted-strong">Queue</span>
            </Link>
            <Link
              href="/admin/hr/complaints"
              className="body-sm px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 text-slate-500 hover:text-slate-900 hover:bg-white/45"
            >
              <span>Complaints</span>
            </Link>
            <Link
              href="/admin/support"
              className="body-sm px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 text-slate-500 hover:text-slate-900 hover:bg-white/45"
            >
              <span>Support Tickets</span>
            </Link>
            <Link
              href="/admin/reports"
              className="body-sm px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 bg-[#151936] text-white shadow-sm"
            >
              <span>Reports Center</span>
            </Link>
            <Link
              href="/admin/system"
              className="body-sm px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 text-slate-500 hover:text-slate-900 hover:bg-white/45"
            >
              <span>System & Roles</span>
            </Link>
          </div>
        </div>

        {/* Bottom Tab Strip */}
        <div className="border-t border-slate-100 bg-slate-50/50 p-2 px-4 flex items-center gap-1 overflow-x-auto [scrollbar-width:none]">
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider mr-2">View:</span>
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-1.5 text-sm transition-all duration-200 font-medium",
                  isActive
                    ? "bg-[#151936] text-white shadow-sm"
                    : "text-slate-500 hover:bg-slate-200/50 hover:text-slate-800",
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* All Reports */}
      {activeTab === "all" && (
        <BoardPanel className="gsap-stagger space-y-4">
          <div>
            <h2 className="text-heading-primary">All Reports</h2>
            <p className="mt-0.5 text-slate-500 text-base">
              Newest first, across all departments. Generated from Finance, HR, and other modules.
            </p>
          </div>
          <EmptyState
            icon={IconFolderOpen}
            title="No reports generated yet"
            description="Reports will appear here once Finance generates balance sheets, mandate statements, or payroll reports. The Finance module's report generation pipeline (P5) populates this library."
            action="Go to Finance Reports"
          />
        </BoardPanel>
      )}

      {/* By Department */}
      {activeTab === "by-department" && (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            {DEPARTMENT_GROUPS.map((dept) => (
              <BoardPanel key={dept.id} className="gsap-stagger space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-heading-primary">{dept.label}</h3>
                      <span className={cn("rounded-full border px-2 py-0.5 text-sm", dept.primaryColor)}>
                        {dept.reportCount} reports
                      </span>
                    </div>
                    <p className="mt-1 text-slate-500 text-base">{dept.description}</p>
                  </div>
                </div>
                <EmptyState
                  icon={IconFileAnalytics}
                  title={`No ${dept.label} reports yet`}
                  description="Reports generated in this department will appear here automatically."
                  action="Go to Department"
                />
              </BoardPanel>
            ))}
          </div>
        </div>
      )}

      {/* Verify */}
      {activeTab === "verify" && (
        <div className="space-y-4">
          <BoardPanel className="gsap-stagger space-y-3">
            <div>
              <h2 className="text-heading-primary">Document Verification</h2>
              <p className="mt-0.5 text-slate-500 text-base">
                Verify the authenticity of a QR-signed Sunland document. The same verification service Finance uses — exposed here for executive convenience.
              </p>
            </div>
          </BoardPanel>
          <FinanceQrProof
            artifactRef="VERIFY-EXEC"
            artifactType="Executive Verification Receipt"
            entityName="Sunland Group"
            generatedAt="2026-06-22"
            token="sunland_verify_exec_demo_6f2a90"
          />
        </div>
      )}
    </PageTransition>
  );
}
