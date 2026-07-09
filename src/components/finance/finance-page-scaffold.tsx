"use client";

import { useMemo, useState } from "react";
import {
  IconChevronDown,
  IconDotsVertical,
  IconEye,
  IconFileExport,
  IconFilter,
  IconPlus,
  IconSearch,
} from "@tabler/icons-react";
import {
  financeSectionById,
  financeTabScaffold,
  type FinanceSectionId,
  type FinanceTableRow,
} from "@/components/finance/finance-config";
import { FinanceModuleNav } from "@/components/finance/finance-module-nav";
import { FinanceQrProof } from "@/components/finance/finance-qr-proof";
import { useUIStore } from "@/store/ui";
import {
  Badge,
  BoardHeader,
  BoardPanel,
  Button,
  KpiCard,
  PaginationControls,
} from "@/components/ui/erp-primitives";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCompactKES } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

const statusTone: Record<FinanceTableRow["status"], "success" | "warning" | "risk" | "data" | "neutral"> = {
  Posted: "success",
  Pending: "warning",
  Approved: "success",
  Overdue: "risk",
  Draft: "data",
  Returned: "risk",
  Credited: "success",
  Vacant: "warning",
};

const tabActionLabels: Record<string, string> = {
  "journal-entries": "New Journal",
  "chart-of-accounts": "New Account",
  collections: "Log Collection",
  "pending-approval": "Review Queue",
  active: "New Mandate",
  runs: "New Payroll Run",
  payables: "Record Payment",
  receivables: "Record Receipt",
  deposited: "Log Cheque",
  rules: "New Rule",
  generate: "Generate Report",
};

function entityLabel(entityId: string) {
  const labels: Record<string, string> = {
    group: "Sunland Group",
    commercial: "Sunland Commercial",
    residential: "Sunland Residential",
    valuers: "Sunland Valuers Ltd",
  };

  return labels[entityId] ?? entityId;
}

function tabDescription(sectionId: FinanceSectionId, tabId: string) {
  const descriptions: Record<string, string> = {
    "ledger:journal-entries":
      "Foundation tab for balanced double-entry postings. Real CRUD will attach here after approval infrastructure and schema are in place.",
    "ledger:chart-of-accounts":
      "Account tree grouped by assets, liabilities, equity, revenue, and expenses with balances derived from journal lines.",
    "ledger:trial-balance":
      "Read-only as-of statement proving debit and credit totals remain in balance.",
    "ledger:balance-sheet":
      "Statement layout for assets, liabilities, and equity at a selected date.",
    "ledger:cash-flow":
      "Statement layout for operating, investing, and financing cash movement.",
    "rentals:collections":
      "Collections book for expected rent, collected rent, and reconciliation status.",
    "rentals:deficits":
      "Filtered view of rental ledger rows where the generated deficit is above zero.",
    "rentals:vacancies":
      "Vacant unit tracking and escalation handoff to the relevant property manager.",
    "rentals:defaulters":
      "Tenant arrears aging, payment plans, and collection escalation queue.",
    "mandates:active":
      "Active mandate book with collections, fee computation, and remittance readiness.",
    "mandates:pending-approval":
      "Inline approval surface for GM and CEO decisions, backed by shared approval requests.",
    "mandates:draft":
      "Editable mandate terms before activation or approval routing.",
    "mandates:terminated":
      "Closed mandate history retained for audit and reporting.",
    "payroll:runs":
      "Payroll run lifecycle from HR-fed draft to GM-approved disbursement.",
    "payroll:payslips":
      "Payslip preview and PDF handoff for generated employee statements.",
    "payroll:remittances":
      "KRA, NSSF, SHIF, and Affordable Housing statutory remittance schedule.",
    "ap-ar:payables":
      "Vendor and contractor obligations with payment recording hooks into the ledger.",
    "ap-ar:receivables":
      "Client fee receivables only. Tenant arrears remain in Rentals > Defaulters.",
    "cheques:deposited":
      "Deposited cheques have no ledger impact until marked credited.",
    "cheques:credited":
      "Credited cheque history, where journal entries have been posted.",
    "cheques:returned":
      "Returned cheque reasons and debtor follow-up status.",
    "fees:rules":
      "Configurable service fee rules for revenue recognition.",
    "fees:charges":
      "Logged service fee charges linked back to their originating record.",
    "commissions:deals":
      "Agent sales and letting commissions tracking closed deals, gross values, agent percentages, and withholding tax deductions.",
    "commissions:wht-filings":
      "Withholding Tax filings submitted to the Kenya Revenue Authority (KRA) for compliance validation.",
    "commissions:levy":
      "Monthly Affordable Housing Levy payroll statistics, remitted at 3.0% (1.5% employer and 1.5% employee shares).",
    "reports:generate":
      "Report generation form target for balance sheet, cash flow, mandate, payroll, and trial balance outputs.",
    "reports:library":
      "Canonical history of generated PDFs and verification tokens.",
    "reports:verify":
      "QR token verification panel for generated finance reports.",
  };

  return descriptions[`${sectionId}:${tabId}`] ?? financeSectionById[sectionId].description;
}

function isStatementTab(sectionId: FinanceSectionId, tabId: string) {
  return sectionId === "ledger" && ["trial-balance", "balance-sheet", "cash-flow"].includes(tabId);
}

function StatementPreview({ tabId }: { tabId: string }) {
  const sections =
    tabId === "cash-flow"
      ? [
        ["Operating Activities", "Profit after tax", "KES 1.8M"],
        ["Investing Activities", "Property improvements", "KES -620K"],
        ["Financing Activities", "Owner distributions", "KES -240K"],
      ]
      : tabId === "balance-sheet"
        ? [
          ["Assets", "Cash and receivables", "KES 14.2M"],
          ["Liabilities", "Landlord payables and AP", "KES 6.8M"],
          ["Equity", "Retained earnings", "KES 7.4M"],
        ]
        : [
          ["Debit Balances", "Assets and expenses", "KES 18.4M"],
          ["Credit Balances", "Liabilities, equity, revenue", "KES 18.4M"],
          ["Variance", "Debit minus credit", "KES 0"],
        ];

  return (
    <BoardPanel className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="title-serif font-normal text-slate-900">
            Statement Preview
          </h2>
          <p className="mt-1 text-slate-500 text-base">
            Document-style layout scaffold for the computed finance statement.
          </p>
        </div>
        <Button variant="secondary" size="sm">
          <IconFileExport size={14} />
          Route to Reports
        </Button>
      </div>
      <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-5">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4">
          <div>
            <p className="label-caps text-slate-400">Sunland ERP Finance</p>
            <p className="mt-1 text-base text-slate-600">As of June 21, 2026</p>
          </div>
          <Badge tone="data">Draft Scaffold</Badge>
        </div>
        <div className="space-y-3">
          {sections.map(([group, label, value]) => (
            <div key={group} className="grid gap-2 border-b border-slate-200/70 py-3 last:border-0 md:grid-cols-[180px_1fr_auto]">
              <p className="text-base font-medium text-[#151936]">{group}</p>
              <p className="text-base text-slate-600">{label}</p>
              <p className="text-slate-900 mono-data">{value}</p>
            </div>
          ))}
        </div>
      </div>
    </BoardPanel>
  );
}

export function FinancePageScaffold({
  sectionId,
  tabId,
}: {
  sectionId: FinanceSectionId;
  tabId: string;
}) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const { activeEntityId } = useUIStore();
  const section = financeSectionById[sectionId];
  const tab = section.tabs.find((item) => item.id === tabId);
  const scaffold = financeTabScaffold[sectionId];
  const rowsPerPage = 5;

  const filteredRows = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return scaffold.rows;

    return scaffold.rows.filter((row) =>
      [row.ref, row.subject, row.detail, row.status, row.date].some((value) =>
        String(value).toLowerCase().includes(normalized),
      ),
    );
  }, [query, scaffold.rows]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / rowsPerPage));
  const visibleRows = filteredRows.slice((page - 1) * rowsPerPage, page * rowsPerPage);
  const actionLabel = tabActionLabels[tabId] ?? "Create";
  const description = tabDescription(sectionId, tabId);

  return (
    <div className="mx-auto flex max-w-[98rem] flex-col gap-4 animate-fade-in">
      <BoardHeader
        eyebrow={<Badge tone="primary">Finance Operations</Badge>}
        meta={
          <span className="hidden text-base text-slate-400 md:inline">
            Entity: <span className="font-mono text-slate-600">{entityLabel(activeEntityId)}</span>
          </span>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex h-9 min-w-[220px] items-center gap-2 rounded-lg border border-slate-200 bg-white px-3">
              <IconSearch size={14} className="text-slate-400" />
              <input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(1);
                }}
                placeholder={`Search ${section.label.toLowerCase()}`}
                className="w-full bg-transparent text-slate-700 outline-none placeholder:text-slate-400 text-base"
              />
            </div>
            <Button variant="secondary" size="sm">
              <IconFilter size={14} />
              Filters
            </Button>
            <Button size="sm">
              <IconPlus size={14} />
              {actionLabel}
            </Button>
          </div>
        }
        title={tab ? `${section.title} / ${tab.label}` : section.title}
        description={description}
      />

      <FinanceModuleNav />

      {sectionId === "reports" && (
        <FinanceQrProof
          artifactRef={tabId === "verify" ? "VERIFY-DEMO" : tabId === "library" ? "RPT-208" : "DRAFT-RPT"}
          artifactType={tabId === "verify" ? "Token Verification Receipt" : tabId === "library" ? "Balance Sheet Snapshot" : "Generated Report Draft"}
          entityName={entityLabel(activeEntityId)}
          generatedAt="2026-06-22"
          token={tabId === "verify" ? "sunland_verify_demo_6f2a90" : "sunland_sheet_bs_394a8f"}
          amount={tabId === "library" ? 14200000 : undefined}
        />
      )}

      <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4" aria-label="Finance key metrics">
        {scaffold.metrics.map((metric) => (
          <KpiCard
            key={metric.label}
            icon={metric.icon}
            label={metric.label}
            value={metric.value}
            trend={metric.trend}
            tone={metric.tone}
            progress={metric.progress}
          />
        ))}
      </section>

      {isStatementTab(sectionId, tabId) ? (
        <StatementPreview tabId={tabId} />
      ) : (
        <BoardPanel className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-heading-primary">
                {tab?.label ?? section.label} Work Queue
              </h2>
              <p className="mt-1 text-slate-500 text-base">
                Production table scaffold with drawer row targets and 5-row pagination boundary.
              </p>
            </div>
            <Button variant="secondary" size="sm">
              <IconChevronDown size={14} />
              Export
            </Button>
          </div>

          {visibleRows.length > 0 ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-body-regular">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 label-caps">
                      {scaffold.columns.map((column) => (
                        <th key={column} className={cn("px-2 py-2.5", column === "Amount" && "text-right")}>
                          {column}
                        </th>
                      ))}
                      <th className="px-2 py-2.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {visibleRows.map((row) => (
                      <tr key={row.ref} className="transition-colors hover:bg-slate-50/80">
                        <td className="px-2 py-3 text-slate-900 mono-data">
                          {row.ref}
                        </td>
                        <td className="px-2 py-3">
                          <p className="text-title-primary">{row.subject}</p>
                          <p className="mt-0.5 text-base text-slate-500">{row.detail}</p>
                        </td>
                        <td className="px-2 py-3 text-right text-slate-900 mono-data">
                          {formatCompactKES(row.amount)}
                        </td>
                        <td className="px-2 py-3">
                          <Badge tone={statusTone[row.status]}>{row.status}</Badge>
                        </td>
                        <td className="px-2 py-3 text-slate-500 mono-data">
                          {row.date}
                        </td>
                        <td className="px-2 py-3 text-right">
                          <button
                            type="button"
                            aria-label={`Open ${row.ref}`}
                            className="inline-flex size-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                          >
                            <IconDotsVertical size={15} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <PaginationControls
                currentPage={page}
                totalPages={totalPages}
                onPageChange={setPage}
                label={`${filteredRows.length} records scoped to ${entityLabel(activeEntityId)}`}
              />
            </>
          ) : (
            <EmptyState
              icon={IconEye}
              title="No matching finance records"
              description="Clear the search term or adjust filters to view this queue."
              action="Adjust Search"
            />
          )}
        </BoardPanel>
      )}
    </div>
  );
}
