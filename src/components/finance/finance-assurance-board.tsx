"use client";

import { useState, useMemo, useEffect } from "react";
import {
  IconSearch,
  IconCoins,
  IconClock,
  IconBuilding,
  IconCheck,
  IconArrowUpRight,
  IconTimeline,
  IconTransfer,
  IconPlus,
  IconDotsVertical,
  IconEye,
  IconFileExport,
  IconFilter,
  IconQrcode,
  IconShieldCheck,
  IconTerminal2,
  IconFolder,
  IconDownload,
  IconTrash,
  IconAlertTriangle,
  IconCircleX
} from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast-provider";
import { Modal } from "@/components/ui/modal";
import { Drawer } from "@/components/ui/drawer";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FinanceModuleNav } from "@/components/finance/finance-module-nav";
import { FinanceQrProof } from "@/components/finance/finance-qr-proof";
import { BoardHeader, BoardPanel, Button, PaginationControls } from "@/components/ui/erp-primitives";
import { cn } from "@/lib/utils/cn";
import { formatCompactKES } from "@/lib/utils/format";
import { useUIStore } from "@/store/ui";

// ─── Interfaces ──────────────────────────────────────────────────────────────

interface GeneratedReport {
  id: string;
  reportCode: string;
  reportType: "Balance Sheet" | "Cash Flow Statement" | "Trial Balance Validation" | "Property Mandates Summary" | "Payroll Outlay Summary";
  entityName: string;
  period: string;
  hash: string;
  fileSize: string;
  linesCount: number;
  generatedBy: string;
  generatedAt: string;
  metrics: { label: string; value: number }[];
  activityLog: string[];
}

// ─── Initial Mock Data ────────────────────────────────────────────────────────

const INITIAL_REPORTS: GeneratedReport[] = [
  {
    id: "rpt-01",
    reportCode: "RPT-208",
    reportType: "Balance Sheet",
    entityName: "Sunland Group",
    period: "June 2026",
    hash: "sunland_sheet_bs_394a8f",
    fileSize: "4.2 KB",
    linesCount: 42,
    generatedBy: "Dennis Munge",
    generatedAt: "2026-06-20",
    metrics: [
      { label: "Assets", value: 14200000 },
      { label: "Liabilities", value: 6800000 },
      { label: "Equity", value: 7400000 }
    ],
    activityLog: [
      "Ledger balances verified · 2026-06-20",
      "Cryptographic signature applied by Finance Head Dennis Munge",
      "QR token registered under SHA-256 394a8f"
    ]
  },
  {
    id: "rpt-02",
    reportCode: "RPT-207",
    reportType: "Property Mandates Summary",
    entityName: "Sunland Commercial",
    period: "June 2026",
    hash: "sunland_mandate_rpt_88e02d",
    fileSize: "5.8 KB",
    linesCount: 88,
    generatedBy: "Grace Mutua",
    generatedAt: "2026-06-19",
    metrics: [
      { label: "Active Mandates", value: 28 },
      { label: "Gross Collectible", value: 9800000 },
      { label: "Management Fees", value: 840000 }
    ],
    activityLog: [
      "Mandates performance compiled · 2026-06-19",
      "Approved for publishing by GM Grace Mutua",
      "QR token registered under SHA-256 88e02d"
    ]
  },
  {
    id: "rpt-03",
    reportCode: "RPT-206",
    reportType: "Payroll Outlay Summary",
    entityName: "Sunland Group",
    period: "June 2026",
    hash: "sunland_payroll_rpt_22fa1b",
    fileSize: "3.1 KB",
    linesCount: 36,
    generatedBy: "Cody Fisher",
    generatedAt: "2026-06-18",
    metrics: [
      { label: "Total Gross Pay", value: 2800000 },
      { label: "Deductions Accrued", value: 820000 },
      { label: "Net Disbursed", value: 1980000 }
    ],
    activityLog: [
      "Payroll audit sheet reconciled · 2026-06-18",
      "Signed by HR Head Cody Fisher",
      "QR token registered under SHA-256 22fa1b"
    ]
  }
];

const ROWS_PER_PAGE = 5;

export function FinanceAssuranceBoard({ tabId = "generate" }: { tabId: string }) {
  const { pushToast } = useToast();
  const activeEntityId = useUIStore((state) => state.activeEntityId);
  const [mounted, setMounted] = useState(false);
  const [currentRole, setCurrentRole] = useState<string>("ceo");

  // State: Database
  const [reports, setReports] = useState<GeneratedReport[]>(INITIAL_REPORTS);

  // Form State: Generate
  const [reportType, setReportType] = useState<GeneratedReport["reportType"]>("Balance Sheet");
  const [entityTarget, setEntityTarget] = useState("Sunland Group");
  const [dateRangeStart, setDateRangeStart] = useState("2026-06-01");
  const [dateRangeEnd, setDateRangeEnd] = useState("2026-06-30");

  // Compiler Console simulation
  const [compilerLines, setCompilerLines] = useState<string[]>([]);
  const [isCompiling, setIsCompiling] = useState(false);
  const [compilationSuccess, setCompilationSuccess] = useState(false);
  const [compiledToken, setCompiledToken] = useState("");

  // Search & Pagination: Library
  const [libraryQuery, setLibraryQuery] = useState("");
  const [page, setPage] = useState(1);

  // Verification tab state
  const [verificationInput, setVerificationInput] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<GeneratedReport | "Tampered" | null>(null);

  // Selected state for details
  const [selectedReport, setSelectedReport] = useState<GeneratedReport | null>(null);

  useEffect(() => {
    setMounted(true);
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.user?.role) {
          setCurrentRole(data.user.role);
        }
      })
      .catch(() => {});
  }, []);

  const formatMoney = (val: number) => formatCompactKES(val);

  // Simulate compiler log sequence
  const handleInitiateBuild = async () => {
    setIsCompiling(true);
    setCompilationSuccess(false);
    setCompilerLines([]);

    const steps = [
      `> Initializing Sunland ledger compiler v2.4.1...`,
      `> Scoping ledger line records for "${entityTarget}" from ${dateRangeStart} to ${dateRangeEnd}...`,
      `> Checking double-entry balance alignment...`,
      `> Verifying signing key authority for Head of Finance Dennis Munge...`,
      `> Hashing payload using SHA-256 algorithm...`,
      `> Binding QR proof verification token...`
    ];

    for (let i = 0; i < steps.length; i++) {
      await new Promise((resolve) => setTimeout(resolve, 400));
      setCompilerLines((prev) => [...prev, steps[i]]);
    }

    const randomHash = `sunland_gen_${Math.random().toString(16).substring(2, 8)}`;
    await new Promise((resolve) => setTimeout(resolve, 500));
    setCompilerLines((prev) => [...prev, `> Output token: ${randomHash}`, `> COMPILATION SUCCESSFUL. PDF exported to vault.`]);
    setCompiledToken(randomHash);
    setCompilationSuccess(true);
    setIsCompiling(false);

    // Save report to database list
    const newReport: GeneratedReport = {
      id: `rpt-${Date.now()}`,
      reportCode: `RPT-${reports.length + 209}`,
      reportType,
      entityName: entityTarget,
      period: "June 2026",
      hash: randomHash,
      fileSize: "4.5 KB",
      linesCount: 38,
      generatedBy: "Dennis Munge",
      generatedAt: new Date().toISOString().split("T")[0],
      metrics:
        reportType === "Balance Sheet"
          ? [
              { label: "Assets", value: 14200000 },
              { label: "Liabilities", value: 6800000 },
              { label: "Equity", value: 7400000 }
            ]
          : reportType === "Payroll Outlay Summary"
          ? [
              { label: "Total Gross Pay", value: 2800000 },
              { label: "Deductions Accrued", value: 820000 },
              { label: "Net Disbursed", value: 1980000 }
            ]
          : [
              { label: "Debit Balances", value: 18400000 },
              { label: "Credit Balances", value: 18400000 },
              { label: "Variance", value: 0 }
            ],
      activityLog: [
        `Ledger metrics compiled for period · ${new Date().toISOString().split("T")[0]}`,
        `Cryptographic signature key verified for Dennis Munge`,
        `QR token registered under SHA-256 ${randomHash.replace("sunland_gen_", "")}`
      ]
    };

    setReports([newReport, ...reports]);

    pushToast({
      tone: "success",
      title: "Assurance Report Generated",
      body: `Cryptographic verification code ${newReport.hash} added to vault archive.`
    });
  };

  // Verify tab handle
  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verificationInput.trim()) return;

    setIsVerifying(true);
    setVerificationResult(null);

    await new Promise((resolve) => setTimeout(resolve, 900));

    const matched = reports.find((r) => r.hash.toLowerCase() === verificationInput.toLowerCase().trim());

    if (matched) {
      setVerificationResult(matched);
      pushToast({
        tone: "success",
        title: "Integrity Verified Genuine",
        body: `Report matched. Cryptographic hash certified authentic.`
      });
    } else {
      setVerificationResult("Tampered");
      pushToast({
        tone: "error",
        title: "Integrity Breach Flagged",
        body: `No matching record found in Central Audit Vault registry.`
      });
    }

    setIsVerifying(false);
  };

  // Filtered Library
  const filteredLibrary = useMemo(() => {
    const q = libraryQuery.toLowerCase().trim();
    return reports.filter(
      (r) =>
        r.reportType.toLowerCase().includes(q) ||
        r.entityName.toLowerCase().includes(q) ||
        r.hash.toLowerCase().includes(q) ||
        r.reportCode.toLowerCase().includes(q)
    );
  }, [reports, libraryQuery]);

  const paginatedLibrary = useMemo(() => {
    return filteredLibrary.slice((page - 1) * ROWS_PER_PAGE, page * ROWS_PER_PAGE);
  }, [filteredLibrary, page]);

  const totalPages = Math.max(1, Math.ceil(filteredLibrary.length / ROWS_PER_PAGE));

  if (!mounted) return <div className="h-screen w-full skeleton-shimmer bg-slate-50" />;

  return (
    <div className="mx-auto flex max-w-[98rem] flex-col gap-4 animate-fade-in pb-12">
      <BoardHeader
        title="Assurance & Audit Center"
        description="Filing double-entry report artifacts, cryptographically signing ledger state, and validating QR-verified prints."
      />

      <FinanceModuleNav />

      {/* ── Tab Layouts: Render dynamically based on TabId ───────────────── */}

      {/* TABS 1: GENERATE REPORT (Compiler Desk Workspace) */}
      {tabId === "generate" && (
        <section className="grid grid-cols-1 xl:grid-cols-[1.15fr_0.85fr] gap-5 items-stretch">
          {/* Form drafting workspace */}
          <BoardPanel className="flex flex-col justify-between p-6 h-full border-slate-200">
            <div className="space-y-6">
              <div>
                <h3 className="title-serif font-normal text-slate-900">Assurance Drafting Desk</h3>
                <p className="text-slate-500 font-medium tracking-wide mt-1 text-base">
                  Select parameters to construct a cryptographically signed financial statement.
                </p>
              </div>

              {/* Scope selectors */}
              <div className="space-y-4 font-sans text-sm">
                <div>
                  <span className="block text-slate-450 mb-2.5 label-caps">
                    Report Statement Type
                  </span>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {[
                      "Balance Sheet",
                      "Cash Flow Statement",
                      "Trial Balance Validation",
                      "Property Mandates Summary",
                      "Payroll Outlay Summary"
                    ].map((type) => {
                      const isActive = reportType === type;
                      return (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setReportType(type as GeneratedReport["reportType"])}
                          className={cn(
                            "flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all duration-300",
                            isActive
                              ? "border-slate-800 bg-slate-50 text-slate-900 shadow-sm"
                              : "border-slate-100 bg-white text-slate-500 hover:border-slate-200 hover:text-slate-700"
                          )}
                        >
                          <span
                            className={cn(
                              "size-2 rounded-full",
                              isActive ? "bg-[#f3df27]" : "bg-slate-200"
                            )}
                          />
                          <span className="font-medium text-base">{type}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div>
                    <label htmlFor="entityScope" className="block text-slate-450 mb-2 label-caps">Scope Entity Context</label>
                    <select
                      id="entityScope"
                      value={entityTarget}
                      onChange={(e) => setEntityTarget(e.target.value)}
                      className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-slate-800 outline-none focus:border-indigo-400 font-sans text-base"
                    >
                      <option value="Sunland Group">Sunland Group (Consolidated)</option>
                      <option value="Sunland Commercial">Sunland Commercial</option>
                      <option value="Sunland Residential">Sunland Residential</option>
                      <option value="Sunland Valuers Ltd">Sunland Valuers Ltd</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label htmlFor="startD" className="block text-slate-450 mb-2 label-caps">Filing Start</label>
                      <input
                        id="startD"
                        type="date"
                        value={dateRangeStart}
                        onChange={(e) => setDateRangeStart(e.target.value)}
                        className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-slate-800 outline-none focus:border-indigo-400 mono-data"
                      />
                    </div>
                    <div>
                      <label htmlFor="endD" className="block text-slate-450 mb-2 label-caps">Filing End</label>
                      <input
                        id="endD"
                        type="date"
                        value={dateRangeEnd}
                        onChange={(e) => setDateRangeEnd(e.target.value)}
                        className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-slate-800 outline-none focus:border-indigo-400 mono-data"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-slate-100 mt-6 flex justify-end">
              <Button
                onClick={handleInitiateBuild}
                disabled={isCompiling}
                className="bg-[#151936] text-white hover:bg-slate-800 h-10 px-5 shadow-sm font-sans"
              >
                {isCompiling ? "Compiling Ledger state..." : "Initiate Cryptographic Build"}
              </Button>
            </div>
          </BoardPanel>

          {/* Terminal Console compilation screen */}
          <div className="relative rounded-2xl bg-slate-950 border border-slate-900 shadow-2xl p-6 flex flex-col justify-between h-[380px] xl:h-auto select-none text-sm">
            <div className="absolute top-0 right-0 p-8 opacity-5">
              <IconTerminal2 size={120} className="text-emerald-400" />
            </div>

            <div className="flex items-center gap-2 border-b border-slate-900 pb-3 text-slate-500 font-mono">
              <span className="size-2.5 rounded-full bg-red-500/80" />
              <span className="size-2.5 rounded-full bg-yellow-500/80" />
              <span className="size-2.5 rounded-full bg-green-500/80" />
              <span className="ml-2">console@sunland-assurance:~</span>
            </div>

            <div className="flex-1 font-mono leading-relaxed text-emerald-400 overflow-y-auto mt-4 space-y-1.5 custom-scrollbar select-text selection:bg-emerald-950 text-sm">
              {compilerLines.length === 0 ? (
                <div className="text-slate-600 flex flex-col items-center justify-center h-full text-center p-4">
                  <IconTerminal2 size={32} className="mb-2 opacity-50" />
                  <p>Compiler Idle</p>
                  <p className="mt-1 text-sm">Awaiting build request parameters from drafting desk.</p>
                </div>
              ) : (
                compilerLines.map((line, idx) => (
                  <p key={idx} className={cn(line.startsWith("> COMPILE") ? "text-emerald-300 font-medium" : "text-emerald-500")}>
                    {line}
                  </p>
                ))
              )}
            </div>

            {compilationSuccess && (
              <div className="bg-emerald-950/20 border border-emerald-900/50 p-4 rounded-xl mt-4 flex items-center justify-between font-mono leading-none text-sm">
                <div>
                  <p className="text-emerald-300 font-medium flex items-center gap-1.5">
                    <IconShieldCheck size={14} />
                    Verified Genuine Artifact
                  </p>
                  <p className="text-slate-500 mt-1.5 label-caps">TOKEN: {compiledToken}</p>
                </div>
                <Badge tone="success" className="h-5 px-2">SIGNED</Badge>
              </div>
            )}
          </div>
        </section>
      )}

      {/* TABS 2: AUDIT LIBRARY VAULT (Dossiers Grid Layout) */}
      {tabId === "library" && (
        <div className="space-y-4">
          {/* Dossiers Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {paginatedLibrary.map((report) => (
              <div
                key={report.id}
                onClick={() => setSelectedReport(report)}
                className="relative rounded-2xl border border-slate-100 bg-white p-5 shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer group flex flex-col justify-between min-h-[175px] hover:-translate-y-0.5"
              >
                {/* Folder Top Tab Visual styling */}
                <div className="absolute top-[-7px] left-5 w-24 h-2 bg-slate-50 border-t border-x border-slate-150 rounded-t-md group-hover:bg-slate-100 transition-colors" />

                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="size-10 rounded-xl bg-slate-50 group-hover:bg-slate-100 border border-slate-100 flex items-center justify-center text-slate-500 transition-colors">
                      <IconFolder size={20} />
                    </div>
                    <Badge tone="success" className="tracking-wide uppercase px-2 font-mono h-5 text-sm">Verified</Badge>
                  </div>

                  <div>
                    <h4 className="title-serif font-normal text-slate-900 group-hover:text-indigo-900 transition-colors leading-snug text-xl">
                      {report.reportType}
                    </h4>
                    <p className="text-slate-450 font-medium tracking-wide mt-1 text-sm">
                      {report.entityName} · {report.period}
                    </p>
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-3 mt-4 flex justify-between items-center text-slate-400 font-mono text-sm">
                  <span className="truncate max-w-[160px]" title={report.hash}>{report.hash}</span>
                  <div className="flex gap-2.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        pushToast({
                          tone: "success",
                          title: "PDF Download Initiated",
                          body: `Document ${report.reportCode} (${report.reportType}) has been saved to your workspace download folder.`
                        });
                      }}
                      className="text-slate-400 hover:text-slate-800 transition"
                      title="Download PDF"
                    >
                      <IconDownload size={15} />
                    </button>
                    <span className="text-slate-300">|</span>
                    <span>{report.fileSize}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Empty / Pagination boundary */}
          {filteredLibrary.length === 0 ? (
            <div className="py-12 border border-slate-100 bg-white rounded-2xl text-center">
              <div className="text-center max-w-sm mx-auto space-y-3">
                <div className="size-12 rounded-2xl bg-slate-50 text-slate-400 flex items-center justify-center mx-auto border border-slate-100 shadow-sm">
                  <IconFolder size={20} />
                </div>
                <h4 className="text-sm font-medium text-slate-800 font-sans">Audit Vault Empty</h4>
                <p className="text-slate-450 leading-relaxed font-sans text-base">
                  No generated statements are cataloged under this entity namespace. Switch to Generate to compile files.
                </p>
              </div>
            </div>
          ) : (
            <PaginationControls
              currentPage={page}
              totalPages={totalPages}
              onPageChange={setPage}
              label={`${filteredLibrary.length} statements cataloged in central vault`}
            />
          )}
        </div>
      )}

      {/* TABS 3: CRYPTOGRAPHIC DECRYPTOR (Scanning verify console) */}
      {tabId === "verify" && (
        <section className="grid grid-cols-1 xl:grid-cols-[1fr_1.15fr] gap-5 items-stretch">
          {/* Scanner portal input */}
          <BoardPanel className="p-6 border-slate-200 flex flex-col justify-between h-full">
            <div className="space-y-6">
              <div>
                <h3 className="title-serif font-normal text-slate-900">Cryptographic authenticator</h3>
                <p className="text-slate-500 font-medium tracking-wide mt-1 text-base">
                  Validate the integrity hash of a printed statement against central registers.
                </p>
              </div>

              <form onSubmit={handleVerifySubmit} className="space-y-4 font-sans text-sm">
                <div>
                  <label htmlFor="tokenVerify" className="block text-slate-450 mb-2 label-caps">Input Cryptographic Token Hash</label>
                  <div className="relative flex h-10 items-center rounded-lg border border-slate-200 bg-white px-3 focus-within:border-indigo-400">
                    <input
                      id="tokenVerify"
                      required
                      value={verificationInput}
                      onChange={(e) => setVerificationInput(e.target.value)}
                      placeholder="e.g. sunland_sheet_bs_394a8f"
                      className="w-full bg-transparent text-slate-700 outline-none placeholder:text-slate-400 mono-data"
                    />
                    <IconQrcode size={16} className="text-slate-400 ml-2" />
                  </div>
                </div>

                <div>
                  <span className="block text-slate-450 mb-2 label-caps">Or select from Audit Vault Archive</span>
                  <div className="flex flex-wrap gap-2">
                    {reports.slice(0, 3).map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setVerificationInput(r.hash)}
                        className="bg-slate-50 border border-slate-100 hover:bg-slate-100 text-slate-650 px-3 py-1.5 rounded-lg font-mono transition text-sm"
                      >
                        {r.hash.split("_")[2] ?? r.hash}
                      </button>
                    ))}
                  </div>
                </div>
              </form>
            </div>

            <div className="pt-6 border-t border-slate-100 mt-6 flex justify-end gap-2">
              {verificationInput && (
                <Button
                  onClick={() => setVerificationInput("")}
                  variant="secondary"
                  className="h-10 px-4 font-sans"
                >
                  Clear Hash
                </Button>
              )}
              <Button
                onClick={handleVerifySubmit}
                disabled={isVerifying || !verificationInput.trim()}
                className="bg-[#151936] text-white hover:bg-slate-800 h-10 px-5 shadow-sm font-sans"
              >
                {isVerifying ? "Decrypting signatures..." : "Decrypt & Verify Signature"}
              </Button>
            </div>
          </BoardPanel>

          {/* Verification scan result display */}
          <div className="relative rounded-2xl bg-white border border-slate-100 shadow-sm p-6 flex flex-col justify-between min-h-[380px] xl:h-auto select-none text-sm">
            {isVerifying ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-4">
                <div className="relative size-24 rounded-2xl border border-slate-200 flex items-center justify-center bg-slate-50/50 overflow-hidden shadow-sm">
                  {/* Glowing Laser scanning animation */}
                  <div className="absolute top-0 left-0 w-full h-[3px] bg-emerald-500 shadow-[0_0_12px_#10b981] animate-scan" />
                  <IconQrcode size={48} className="text-slate-400 opacity-60" />
                </div>
                <div>
                  <h4 className="text-sm font-medium text-slate-800 font-sans">Decrypting Hash Credentials</h4>
                  <p className="text-slate-550 mt-1 font-sans text-sm">Comparing SHA-256 signatures against secure database ledger arrays...</p>
                </div>
              </div>
            ) : verificationResult === null ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-slate-400 font-sans">
                <IconShieldCheck size={36} className="mb-2 opacity-50 text-indigo-400" />
                <p className="font-medium text-slate-700">Verification Terminal Standby</p>
                <p className="mt-1.5 max-w-xs leading-relaxed text-sm">
                  Enter a validation token ID above and run authentication to check statement genuine ledger status.
                </p>
              </div>
            ) : verificationResult === "Tampered" ? (
              <div className="flex-1 flex flex-col justify-between space-y-6">
                <div className="rounded-xl border border-rose-200 bg-rose-50/30 p-4 leading-relaxed text-rose-800 flex gap-2.5 items-start font-sans body-sm">
                  <IconCircleX size={20} className="shrink-0 text-rose-600 mt-0.5 animate-pulse" />
                  <div>
                    <span className="font-medium text-rose-900 text-sm">INTEGRITY BREACH FLAGGED</span>
                    <p className="mt-1 text-rose-700/90 leading-relaxed font-sans text-sm">
                      This token hash could not be located in the central audit registry list. This document is not certified genuine and may represent tampered figures.
                    </p>
                  </div>
                </div>

                <div className="rounded-xl bg-slate-50 border border-slate-100 p-5 space-y-3 flex-1 flex flex-col justify-center text-center text-slate-400">
                  <IconAlertTriangle size={24} className="mx-auto opacity-40 text-amber-500" />
                  <p className="text-slate-700 font-medium font-sans body-sm">Audit Checksum Failure</p>
                  <p className="leading-normal font-sans text-sm">
                    The SHA-256 key mismatch suggests the statement is either fabricated or manually edited outside standard ERP ledger channels.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col justify-between h-full space-y-6 animate-fade-in">
                {/* Genuine Authenticity Certificate */}
                <div className="rounded-xl border border-emerald-250 bg-emerald-50/30 p-4 leading-relaxed text-emerald-800 flex gap-2.5 items-start font-sans body-sm">
                  <IconShieldCheck size={20} className="shrink-0 text-emerald-600 mt-0.5" />
                  <div>
                    <span className="font-medium text-emerald-900 text-sm">VERIFIED GENUINE DOCUMENT</span>
                    <p className="mt-1 text-emerald-700/90 font-sans text-sm">
                      This report statement is certified authentic. It matches identical double-entry ledger lines recorded in the central database.
                    </p>
                  </div>
                </div>

                {/* Certified Summary layout */}
                <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-5 space-y-4 flex-1">
                  <div className="border-b border-slate-200/60 pb-3 flex justify-between items-start font-mono">
                    <div>
                      <p className="font-sans font-medium text-slate-800">SUNLAND AUDIT REGISTRY STATEMENT</p>
                      <p className="text-slate-400 mt-1 uppercase font-sans text-sm">Certified Copy Registry Code: {verificationResult.reportCode}</p>
                    </div>
                    <Badge tone="success" className="h-5">CERTIFIED</Badge>
                  </div>

                  <div className="space-y-2.5 font-sans body-sm">
                    <div className="flex justify-between items-center text-slate-700">
                      <span>Statement Title</span>
                      <span className="font-medium text-slate-800">{verificationResult.reportType}</span>
                    </div>
                    <div className="flex justify-between items-center text-slate-700">
                      <span>Filing Entity Context</span>
                      <span className="font-medium text-slate-800">{verificationResult.entityName}</span>
                    </div>
                    <div className="flex justify-between items-center text-slate-700">
                      <span>Export Period Date</span>
                      <span className="font-mono text-slate-700">{verificationResult.generatedAt}</span>
                    </div>
                    <div className="h-px bg-slate-200/60 my-1" />
                    {/* Render specific certified metrics totals */}
                    {verificationResult.metrics.map((m) => (
                      <div key={m.label} className="flex justify-between items-center font-medium text-slate-900">
                        <span>Certified Total: {m.label}</span>
                        <span className="font-mono">{m.label.toLowerCase().includes("count") || m.label.toLowerCase().includes("mandates") ? m.value : formatMoney(m.value)}</span>
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-slate-200/60 pt-3 mt-1 flex items-center justify-between text-slate-450 font-mono text-sm">
                    <span className="truncate max-w-[170px]" title={verificationResult.hash}>SHA-HASH: {verificationResult.hash}</span>
                    <span className="font-sans">Signed: {verificationResult.generatedBy}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── Drawer: Library Report Preview & QR proof ────────────────────── */}
      <Drawer
        open={Boolean(selectedReport)}
        onClose={() => setSelectedReport(null)}
        title="Report Statement Dossier"
        width="34rem"
        footer={
          selectedReport && (
            <div className="flex gap-2 w-full">
              <Button onClick={() => setSelectedReport(null)} variant="secondary" className="flex-1">
                Close Dossier
              </Button>
              <Button
                onClick={() => {
                  pushToast({
                    tone: "success",
                    title: "PDF Saved",
                    body: `Statement ${selectedReport.reportCode} PDF exported to disk.`
                  });
                  setSelectedReport(null);
                }}
                className="flex-1 bg-[#151936] text-white"
              >
                Download PDF Copy
              </Button>
            </div>
          )
        }
      >
        {selectedReport && (
          <div className="space-y-6 text-slate-700 text-sm">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4 font-sans">
              <div className="size-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-500 border border-slate-100/50">
                <IconFolder size={20} />
              </div>
              <div>
                <h4 className="font-medium text-slate-900 leading-snug body-md">{selectedReport.reportType}</h4>
                <p className="text-slate-400 mt-0.5 text-sm">{selectedReport.reportCode} · Scope: {selectedReport.entityName}</p>
              </div>
            </div>

            <div className="space-y-5">
              {/* Document Outline Visual */}
              <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-5 space-y-4">
                <div className="border-b border-slate-200 pb-3 flex justify-between items-start font-mono">
                  <div>
                    <p className="font-sans font-medium text-slate-800">SUNLAND STATEMENT TRANSCRIPT</p>
                    <p className="text-slate-400 mt-1 uppercase font-sans text-sm">Vault Code: {selectedReport.reportCode}</p>
                  </div>
                  <Badge tone="success" className="h-5">VERIFIED</Badge>
                </div>

                <div className="space-y-2 font-sans body-sm">
                  <div className="flex justify-between items-center">
                    <span>Filing Context</span>
                    <span className="font-medium text-slate-800">{selectedReport.entityName}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Target Month Period</span>
                    <span className="font-medium text-slate-800">{selectedReport.period}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Filing Date</span>
                    <span className="font-mono text-slate-700">{selectedReport.generatedAt}</span>
                  </div>
                  <div className="h-px bg-slate-200 my-1" />
                  {selectedReport.metrics.map((m) => (
                    <div key={m.label} className="flex justify-between items-center font-medium text-slate-900">
                      <span>Certified: {m.label}</span>
                      <span className="font-mono">{m.label.toLowerCase().includes("count") || m.label.toLowerCase().includes("mandates") ? m.value : formatMoney(m.value)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Cryptographic QR Mark */}
              <FinanceQrProof
                artifactRef={selectedReport.reportCode}
                artifactType={selectedReport.reportType}
                entityName={selectedReport.entityName}
                generatedAt={selectedReport.generatedAt}
                token={selectedReport.hash}
                amount={selectedReport.metrics.find((m) => m.label === "Assets" || m.label === "Gross Collectible" || m.label === "Net Disbursed")?.value}
              />

              {/* Audit history */}
              <div className="pt-2 border-t border-slate-100 font-sans">
                <span className="text-slate-400 label-caps">Audit logs</span>
                <div className="mt-2 space-y-2">
                  {selectedReport.activityLog.map((log, idx) => (
                    <div key={idx} className="flex gap-2 text-slate-500 leading-normal font-sans">
                      <span className="size-1.5 rounded-full bg-slate-350 shrink-0 mt-1.5" />
                      <p className="text-sm">{log}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
