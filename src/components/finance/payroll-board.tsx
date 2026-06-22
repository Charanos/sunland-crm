"use client";

import { useState, useMemo, useEffect } from "react";
import {
  IconSearch,
  IconCoins,
  IconClock,
  IconBuildingBank,
  IconCheck,
  IconArrowUpRight,
  IconTrendingDown,
  IconUser,
  IconShieldCheck,
  IconReceipt2,
  IconTimeline,
  IconTransfer,
  IconPlus,
  IconDotsVertical,
  IconEye,
  IconFileExport,
  IconFilter
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

interface PayrollRun {
  id: string;
  runCode: string;
  period: string;
  grossPay: number;
  netPay: number;
  deductions: number;
  paye: number;
  nssf: number;
  shif: number;
  housingLevy: number;
  status: "Draft" | "Pending" | "Approved" | "Disbursed";
  departmentsBreakdown: { name: string; gross: number; count: number }[];
  activityLog: string[];
}

interface EmployeePayslip {
  id: string;
  payslipCode: string;
  employeeName: string;
  employeeRole: string;
  department: string;
  period: string;
  basicSalary: number;
  allowances: number;
  grossPay: number;
  paye: number;
  nssf: number;
  shif: number;
  housingLevy: number;
  netPay: number;
  status: "Draft" | "Approved" | "Disbursed";
  activityLog: string[];
}

interface StatutoryRemittance {
  id: string;
  remittanceCode: string;
  statutoryBody: "KRA / PAYE" | "NSSF" | "SHIF" | "Affordable Housing Fund";
  amount: number;
  dueDate: string;
  period: string;
  status: "Draft" | "Pending" | "Remitted";
  paymentRef?: string;
  paymentDate?: string;
  bankAccount?: string;
  activityLog: string[];
}

interface MockTimeLog {
  employeeName: string;
  department: string;
  hoursLogged: number;
  baseRate: number;
  computedGross: number;
}

// ─── Initial Mock Data ────────────────────────────────────────────────────────

const INITIAL_RUNS: PayrollRun[] = [
  {
    id: "run-01",
    runCode: "PAY-2026-06",
    period: "June 2026",
    grossPay: 2800000,
    netPay: 1980000,
    deductions: 820000,
    paye: 384000,
    nssf: 98000,
    shif: 140000,
    housingLevy: 198000,
    status: "Pending",
    departmentsBreakdown: [
      { name: "Management", gross: 900000, count: 2 },
      { name: "Finance", gross: 650000, count: 3 },
      { name: "HR", gross: 400000, count: 2 },
      { name: "Business Dev", gross: 550000, count: 4 },
      { name: "Front Office", gross: 300000, count: 3 }
    ],
    activityLog: [
      "Created by HR Head Cody Fisher · 2026-06-18",
      "Pushed to Finance for validation by Dennis Munge · 2026-06-19",
      "Awaiting GM disbursement authorization · 2026-06-20"
    ]
  },
  {
    id: "run-02",
    runCode: "PAY-2026-05",
    period: "May 2026",
    grossPay: 2710000,
    netPay: 1920000,
    deductions: 790000,
    paye: 370000,
    nssf: 95000,
    shif: 135000,
    housingLevy: 190000,
    status: "Disbursed",
    departmentsBreakdown: [
      { name: "Management", gross: 900000, count: 2 },
      { name: "Finance", gross: 600000, count: 3 },
      { name: "HR", gross: 400000, count: 2 },
      { name: "Business Dev", gross: 510000, count: 4 },
      { name: "Front Office", gross: 300000, count: 3 }
    ],
    activityLog: [
      "Created by HR Head Cody Fisher · 2026-05-18",
      "Pushed to Finance by Dennis Munge · 2026-05-19",
      "Approved and Disbursed by GM Grace Mutua · 2026-05-28"
    ]
  }
];

const INITIAL_PAYSLIPS: EmployeePayslip[] = [
  {
    id: "ps-01",
    payslipCode: "PS-0626-01",
    employeeName: "Paul Amos",
    employeeRole: "Chief Executive Officer",
    department: "Management",
    period: "June 2026",
    basicSalary: 400000,
    allowances: 100000,
    grossPay: 500000,
    paye: 150000,
    nssf: 2000,
    shif: 12000,
    housingLevy: 7500,
    netPay: 328500,
    status: "Approved",
    activityLog: ["Aggregated from Management timesheet", "Payslip approved in run PAY-2026-06"]
  },
  {
    id: "ps-02",
    payslipCode: "PS-0626-02",
    employeeName: "Dennis Munge",
    employeeRole: "Head of Finance",
    department: "Finance",
    period: "June 2026",
    basicSalary: 250000,
    allowances: 50000,
    grossPay: 300000,
    paye: 90000,
    nssf: 2000,
    shif: 7500,
    housingLevy: 4500,
    netPay: 196000,
    status: "Approved",
    activityLog: ["Aggregated from Finance timesheet", "Payslip approved in run PAY-2026-06"]
  },
  {
    id: "ps-03",
    payslipCode: "PS-0626-03",
    employeeName: "Cody Fisher",
    employeeRole: "Head of HR",
    department: "HR",
    period: "June 2026",
    basicSalary: 230000,
    allowances: 50000,
    grossPay: 280000,
    paye: 84000,
    nssf: 2000,
    shif: 7000,
    housingLevy: 4200,
    netPay: 182800,
    status: "Approved",
    activityLog: ["Aggregated from HR timesheet", "Payslip approved in run PAY-2026-06"]
  },
  {
    id: "ps-04",
    payslipCode: "PS-0626-04",
    employeeName: "Sharon Koech",
    employeeRole: "Front Office Lead",
    department: "Front Office",
    period: "June 2026",
    basicSalary: 100000,
    allowances: 20000,
    grossPay: 120000,
    paye: 36000,
    nssf: 2000,
    shif: 3000,
    housingLevy: 1800,
    netPay: 77200,
    status: "Approved",
    activityLog: ["Aggregated from Front Office timesheet", "Payslip approved in run PAY-2026-06"]
  },
  {
    id: "ps-05",
    payslipCode: "PS-0626-05",
    employeeName: "Jared Omondi",
    employeeRole: "Line Manager",
    department: "Business Dev",
    period: "June 2026",
    basicSalary: 200000,
    allowances: 50000,
    grossPay: 250000,
    paye: 75000,
    nssf: 2000,
    shif: 6250,
    housingLevy: 3750,
    netPay: 163000,
    status: "Approved",
    activityLog: ["Aggregated from BD timesheet", "Payslip approved in run PAY-2026-06"]
  }
];

const INITIAL_REMITTANCES: StatutoryRemittance[] = [
  {
    id: "rem-01",
    remittanceCode: "REM-PAYE-0626",
    statutoryBody: "KRA / PAYE",
    amount: 384000,
    dueDate: "2026-07-09",
    period: "June 2026",
    status: "Pending",
    activityLog: ["Accrued from payroll run PAY-2026-06", "Awaiting bank transmission reference"]
  },
  {
    id: "rem-02",
    remittanceCode: "REM-NSSF-0626",
    statutoryBody: "NSSF",
    amount: 98000,
    dueDate: "2026-07-15",
    period: "June 2026",
    status: "Draft",
    activityLog: ["Accrued from payroll run PAY-2026-06"]
  },
  {
    id: "rem-03",
    remittanceCode: "REM-SHIF-0626",
    statutoryBody: "SHIF",
    amount: 140000,
    dueDate: "2026-07-15",
    period: "June 2026",
    status: "Draft",
    activityLog: ["Accrued from payroll run PAY-2026-06"]
  },
  {
    id: "rem-04",
    remittanceCode: "REM-AHL-0626",
    statutoryBody: "Affordable Housing Fund",
    amount: 198000,
    dueDate: "2026-07-15",
    period: "June 2026",
    status: "Draft",
    activityLog: ["Accrued from payroll run PAY-2026-06"]
  }
];

const MOCK_TIME_LOGS: MockTimeLog[] = [
  { employeeName: "Paul Amos", department: "Management", hoursLogged: 160, baseRate: 3125, computedGross: 500000 },
  { employeeName: "Dennis Munge", department: "Finance", hoursLogged: 160, baseRate: 1875, computedGross: 300000 },
  { employeeName: "Cody Fisher", department: "HR", hoursLogged: 160, baseRate: 1750, computedGross: 280000 },
  { employeeName: "Sharon Koech", department: "Front Office", hoursLogged: 160, baseRate: 750, computedGross: 120000 },
  { employeeName: "Jared Omondi", department: "Business Dev", hoursLogged: 160, baseRate: 1562.5, computedGross: 250000 }
];

const ROWS_PER_PAGE = 5;

export function PayrollBoard({ tabId = "runs" }: { tabId: string }) {
  const { pushToast } = useToast();
  const activeEntityId = useUIStore((state) => state.activeEntityId);
  const [mounted, setMounted] = useState(false);
  const [currentRole, setCurrentRole] = useState<string>("ceo");

  // Search & pagination state
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);

  // Data states
  const [runs, setRuns] = useState<PayrollRun[]>(INITIAL_RUNS);
  const [payslips, setPayslips] = useState<EmployeePayslip[]>(INITIAL_PAYSLIPS);
  const [remittances, setRemittances] = useState<StatutoryRemittance[]>(INITIAL_REMITTANCES);

  // Modals & drawers state
  const [selectedRun, setSelectedRun] = useState<PayrollRun | null>(null);
  const [selectedPayslip, setSelectedPayslip] = useState<EmployeePayslip | null>(null);
  const [selectedRemittance, setSelectedRemittance] = useState<StatutoryRemittance | null>(null);
  const [showNewRunModal, setShowNewRunModal] = useState(false);
  const [showPayRemittanceModal, setShowPayRemittanceModal] = useState(false);
  const [confirmDisbursementRun, setConfirmDisbursementRun] = useState<PayrollRun | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State - New Run
  const [newRunPeriod, setNewRunPeriod] = useState("July 2026");

  // Form State - Pay Remittance
  const [remitAccount, setRemitAccount] = useState("NCBA Operating A/C");
  const [remitRef, setRemitRef] = useState("");

  // Role simulation check
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

  // Helpers
  const formatMoney = (val: number) => formatCompactKES(val);
  const formatDate = (val: string) => {
    if (!val) return "";
    return new Intl.DateTimeFormat("en-KE", { month: "short", day: "numeric", year: "numeric" }).format(new Date(val));
  };

  const isGMorCEO = currentRole === "ceo" || currentRole === "general_manager";

  // --- Handlers ---
  const handleCreateRun = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    await new Promise((resolve) => setTimeout(resolve, 800));

    const gross = MOCK_TIME_LOGS.reduce((sum, item) => sum + item.computedGross, 0);
    const housing = gross * 0.03; // Employer + employee 1.5%
    const nssfSum = MOCK_TIME_LOGS.length * 2000;
    const shifSum = gross * 0.025;
    const payeSum = gross * 0.15;
    const totalDeductions = payeSum + nssfSum + shifSum + housing;
    const net = gross - totalDeductions;

    const newRun: PayrollRun = {
      id: `run-${Date.now()}`,
      runCode: `PAY-${newRunPeriod.replace(" ", "-").toUpperCase()}`,
      period: newRunPeriod,
      grossPay: gross,
      netPay: net,
      deductions: totalDeductions,
      paye: payeSum,
      nssf: nssfSum,
      shif: shifSum,
      housingLevy: housing,
      status: "Draft",
      departmentsBreakdown: [
        { name: "Management", gross: 500000, count: 1 },
        { name: "Finance", gross: 300000, count: 1 },
        { name: "HR", gross: 280000, count: 1 },
        { name: "Business Dev", gross: 250000, count: 1 },
        { name: "Front Office", gross: 120000, count: 1 }
      ],
      activityLog: [`Created as Draft by Finance Head Dennis Munge · ${new Date().toISOString().split("T")[0]}`]
    };

    setRuns([newRun, ...runs]);

    // Automatically generate draft payslips for this run
    const generatedPayslips: EmployeePayslip[] = MOCK_TIME_LOGS.map((log, index) => {
      const basic = log.computedGross * 0.8;
      const allowance = log.computedGross * 0.2;
      const gr = log.computedGross;
      const pe = gr * 0.15;
      const ns = 2000;
      const sh = gr * 0.025;
      const hl = gr * 0.015;
      const nt = gr - (pe + ns + sh + hl);

      return {
        id: `ps-new-${index}-${Date.now()}`,
        payslipCode: `PS-${newRunPeriod.replace(" ", "").toUpperCase()}-0${index + 1}`,
        employeeName: log.employeeName,
        employeeRole: log.employeeName === "Paul Amos" ? "Chief Executive Officer" : "Officer",
        department: log.department,
        period: newRunPeriod,
        basicSalary: basic,
        allowances: allowance,
        grossPay: gr,
        paye: pe,
        nssf: ns,
        shif: sh,
        housingLevy: hl,
        netPay: nt,
        status: "Draft",
        activityLog: [`Created in draft run ${newRun.runCode}`]
      };
    });

    setPayslips([...generatedPayslips, ...payslips]);

    setShowNewRunModal(false);
    setIsSubmitting(false);

    pushToast({
      tone: "success",
      title: "Payroll Run Initiated",
      body: `Draft run ${newRun.runCode} created successfully with aggregated timesheet hours.`
    });
  };

  const handleSubmitRunForApproval = (run: PayrollRun) => {
    setRuns((prev) =>
      prev.map((r) => {
        if (r.id === run.id) {
          return {
            ...r,
            status: "Pending",
            activityLog: [`Submitted for GM disbursement approval · ${new Date().toISOString().split("T")[0]}`, ...r.activityLog]
          };
        }
        return r;
      })
    );
    setSelectedRun(null);
    pushToast({
      tone: "info",
      title: "Disbursement Routed",
      body: `Payroll run ${run.runCode} has been sent to the GM and CEO approvals queue.`
    });
  };

  const handleApproveDisbursement = async () => {
    if (!confirmDisbursementRun) return;
    setIsSubmitting(true);
    await new Promise((resolve) => setTimeout(resolve, 800));

    const todayStr = new Date().toISOString().split("T")[0];

    // Update run status
    setRuns((prev) =>
      prev.map((r) => {
        if (r.id === confirmDisbursementRun.id) {
          return {
            ...r,
            status: "Disbursed",
            activityLog: [`Approved and Disbursed by GM Grace Mutua · ${todayStr}`, ...r.activityLog]
          };
        }
        return r;
      })
    );

    // Update payslips status
    setPayslips((prev) =>
      prev.map((ps) => {
        if (ps.period === confirmDisbursementRun.period) {
          return { ...ps, status: "Disbursed" };
        }
        return ps;
      })
    );

    // Accrue statutory remittances
    const newRemittances: StatutoryRemittance[] = [
      {
        id: `rem-kra-${Date.now()}`,
        remittanceCode: `REM-PAYE-${confirmDisbursementRun.runCode.split("-")[1]}`,
        statutoryBody: "KRA / PAYE",
        amount: confirmDisbursementRun.paye,
        dueDate: "2026-07-09",
        period: confirmDisbursementRun.period,
        status: "Pending",
        activityLog: [`Accrued from run ${confirmDisbursementRun.runCode}`]
      },
      {
        id: `rem-nssf-${Date.now()}`,
        remittanceCode: `REM-NSSF-${confirmDisbursementRun.runCode.split("-")[1]}`,
        statutoryBody: "NSSF",
        amount: confirmDisbursementRun.nssf,
        dueDate: "2026-07-15",
        period: confirmDisbursementRun.period,
        status: "Draft",
        activityLog: [`Accrued from run ${confirmDisbursementRun.runCode}`]
      },
      {
        id: `rem-shif-${Date.now()}`,
        remittanceCode: `REM-SHIF-${confirmDisbursementRun.runCode.split("-")[1]}`,
        statutoryBody: "SHIF",
        amount: confirmDisbursementRun.shif,
        dueDate: "2026-07-15",
        period: confirmDisbursementRun.period,
        status: "Draft",
        activityLog: [`Accrued from run ${confirmDisbursementRun.runCode}`]
      },
      {
        id: `rem-ahl-${Date.now()}`,
        remittanceCode: `REM-AHL-${confirmDisbursementRun.runCode.split("-")[1]}`,
        statutoryBody: "Affordable Housing Fund",
        amount: confirmDisbursementRun.housingLevy,
        dueDate: "2026-07-15",
        period: confirmDisbursementRun.period,
        status: "Draft",
        activityLog: [`Accrued from run ${confirmDisbursementRun.runCode}`]
      }
    ];

    setRemittances((prev) => [...newRemittances, ...prev]);

    setConfirmDisbursementRun(null);
    setIsSubmitting(false);

    pushToast({
      tone: "success",
      title: "Disbursement Complete",
      body: `Payroll run ${confirmDisbursementRun.runCode} marked as Disbursed. Bank allocations dispatched.`
    });
  };

  const handlePayRemittanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRemittance || !remitRef) return;
    setIsSubmitting(true);
    await new Promise((resolve) => setTimeout(resolve, 600));

    const todayStr = new Date().toISOString().split("T")[0];

    setRemittances((prev) =>
      prev.map((rem) => {
        if (rem.id === selectedRemittance.id) {
          return {
            ...rem,
            status: "Remitted",
            paymentRef: remitRef,
            paymentDate: todayStr,
            bankAccount: remitAccount,
            activityLog: [`Remitted using ${remitAccount} with Ref: ${remitRef} · ${todayStr}`, ...rem.activityLog]
          };
        }
        return rem;
      })
    );

    setShowPayRemittanceModal(false);
    setIsSubmitting(false);

    pushToast({
      tone: "success",
      title: "Statutory Payment Remitted",
      body: `Statutory payment of ${formatMoney(selectedRemittance.amount)} to ${selectedRemittance.statutoryBody} verified.`
    });
  };

  // --- Computations ---
  const aggregates = useMemo(() => {
    const activeRuns = runs.filter((r) => r.status === "Pending" || r.status === "Draft").length;
    const totalGrossMTD = runs.filter((r) => r.status === "Disbursed").reduce((sum, r) => sum + r.grossPay, 0);
    const totalDeductionsMTD = runs.filter((r) => r.status === "Disbursed").reduce((sum, r) => sum + r.deductions, 0);
    const pendingRemittancesVal = remittances.filter((rem) => rem.status !== "Remitted").reduce((sum, rem) => sum + rem.amount, 0);

    return {
      activeRuns,
      grossMTD: totalGrossMTD,
      deductionsMTD: totalDeductionsMTD,
      pendingRemittances: pendingRemittancesVal
    };
  }, [runs, remittances]);

  const filteredRows = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (tabId === "runs") {
      return runs.filter((r) => r.runCode.toLowerCase().includes(q) || r.period.toLowerCase().includes(q) || r.status.toLowerCase().includes(q));
    } else if (tabId === "payslips") {
      return payslips.filter(
        (p) =>
          p.employeeName.toLowerCase().includes(q) ||
          p.payslipCode.toLowerCase().includes(q) ||
          p.department.toLowerCase().includes(q) ||
          p.period.toLowerCase().includes(q)
      );
    } else {
      return remittances.filter((rem) => rem.remittanceCode.toLowerCase().includes(q) || rem.statutoryBody.toLowerCase().includes(q) || rem.status.toLowerCase().includes(q));
    }
  }, [runs, payslips, remittances, tabId, searchQuery]);

  const paginatedRows = useMemo(() => {
    return filteredRows.slice((page - 1) * ROWS_PER_PAGE, page * ROWS_PER_PAGE);
  }, [filteredRows, page]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / ROWS_PER_PAGE));

  if (!mounted) return <div className="h-screen w-full skeleton-shimmer bg-slate-50" />;

  return (
    <div className="mx-auto flex max-w-[98rem] flex-col gap-4 animate-fade-in pb-12">
      <BoardHeader
        title="Payroll & Compliance Dashboard"
        description="Verify department payroll run aggregates, preview employee payslip vouchers, and reconcile statutory remittances."
      />

      <FinanceModuleNav />

      {/* ── Satin Hero Section ────────────────────────────────────────────── */}
      <section className="grid grid-cols-1 xl:grid-cols-[1.15fr_0.85fr] gap-4">
        <div className="relative min-h-[255px] overflow-hidden rounded-2xl border border-white/[0.06] bg-gradient-to-br from-[#0c0f24] via-[#121b36] to-[#1e1b4b] p-8 text-white shadow-2xl">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.15),transparent_60%)]" />
          <div className="absolute -top-24 -left-24 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl" />
          <div className="absolute -bottom-24 -right-24 h-64 w-64 rounded-full bg-indigo-500/5 blur-3xl" />

          <div className="relative z-10 flex h-full flex-col justify-between gap-8">
            <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-8">
              {/* Context info */}
              <div className="max-w-xl space-y-5">
                <div className="flex items-center gap-3">
                  <Badge tone="primary" className="bg-indigo-500/20 text-indigo-200 border-indigo-500/30 px-3 py-1 shadow-sm backdrop-blur-md">
                    Sunland Group
                  </Badge>
                  <span className="text-[11.5px] font-normal tracking-widest uppercase text-slate-400/80">People Operations</span>
                </div>
                <div>
                  <h2 className="title-serif text-[38px] font-normal leading-tight tracking-tight text-white mb-3">
                    Disbursement Ledger
                  </h2>
                  <p className="text-[13.5px] leading-relaxed text-slate-300/80 font-light max-w-lg">
                    Manage payroll schedules, generate individual payslip statements with automated NHIF/SHIF calculations, and route compliance returns securely.
                  </p>
                </div>

                <div className="pt-2 flex items-center gap-4">
                  <div className="flex -space-x-2.5">
                    <div className="size-8 rounded-full border-2 border-[#0c0f24] bg-indigo-600 flex items-center justify-center text-[10px] font-medium text-white shadow-md transition-all hover:scale-110 cursor-pointer" title="Cody Fisher">CF</div>
                    <div className="size-8 rounded-full border-2 border-[#0c0f24] bg-indigo-800 flex items-center justify-center text-[10px] font-medium text-white shadow-md transition-all hover:scale-110 cursor-pointer" title="Dennis Munge">DM</div>
                    <div className="flex size-8 items-center justify-center rounded-full border-2 border-[#0c0f24] bg-indigo-500/20 text-[10px] font-medium text-indigo-200 backdrop-blur-md">
                      +2
                    </div>
                  </div>
                  <span className="text-[12px] font-normal text-slate-400">Payroll Officers</span>
                </div>
              </div>

              {/* Aggregates widget */}
              <div className="flex-1 w-full lg:max-w-md shrink-0 h-full">
                <div className="relative h-full flex flex-col justify-between overflow-hidden rounded-[20px] border border-white/10 bg-white/5 backdrop-blur-2xl p-5 shadow-2xl select-none group">
                  <div className="absolute inset-0 opacity-[0.06] mix-blend-overlay bg-[url('https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?q=80&w=2500')] bg-cover bg-center" />
                  <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -mr-20 -mt-20" />

                  <div className="relative z-10 flex flex-col justify-between h-full gap-6">
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-[10px] font-normal uppercase tracking-widest text-slate-400">Total MTD Net Disbursed</p>
                        <IconCoins size={18} className="text-indigo-400" />
                      </div>
                      <div className="flex items-baseline gap-2 mb-2">
                        <span className="font-mono text-[42px] font-normal tracking-tight text-indigo-300 drop-shadow-[0_0_12px_rgba(99,102,241,0.3)]">
                          {formatMoney(runs.filter((r) => r.status === "Disbursed").reduce((sum, r) => sum + r.netPay, 0))}
                        </span>
                        <span className="text-[12px] text-slate-400 font-normal uppercase tracking-widest">KES</span>
                      </div>
                    </div>

                    <div>
                      <div className="h-px w-full bg-gradient-to-r from-white/15 via-white/5 to-transparent mb-4" />
                      <div className="grid grid-cols-3 gap-2.5 w-full">
                        <div className="flex flex-col items-center bg-white/[0.02] border border-white/[0.04] p-3 rounded-[14px]">
                          <p className="text-[10px] font-normal uppercase tracking-widest text-slate-400 mb-1.5">Draft/Pending</p>
                          <p className="font-mono text-[20px] font-medium text-white leading-none">{aggregates.activeRuns}</p>
                        </div>
                        <div className="flex flex-col items-center bg-white/[0.02] border border-white/[0.04] p-3 rounded-[14px]">
                          <p className="text-[10px] font-normal uppercase tracking-widest text-slate-400 mb-1.5">Accrued Deductions</p>
                          <p className="font-mono text-[16px] font-medium text-white leading-none truncate max-w-[80px]">{formatMoney(aggregates.deductionsMTD)}</p>
                        </div>
                        <div className="flex flex-col items-center bg-white/[0.02] border border-white/[0.04] p-3 rounded-[14px]">
                          <p className="text-[10px] font-normal uppercase tracking-widest text-slate-400 mb-1.5">Unpaid Return</p>
                          <p className="font-mono text-[16px] font-medium text-amber-400 leading-none truncate max-w-[80px]">{formatMoney(aggregates.pendingRemittances)}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── KPI Cards Row ─────────────────────────────────────────────────── */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-2">
        <BoardPanel className="p-5 flex flex-col justify-between h-[135px] relative overflow-hidden group transition-all duration-300 hover:shadow-md hover:-translate-y-1 hover:border-indigo-200 bg-gradient-to-b from-white to-indigo-50/10">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity translate-x-4 -translate-y-4">
            <IconUser size={100} stroke={1} />
          </div>
          <div className="flex items-center gap-3 relative z-10">
            <div className="size-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
              <IconUser size={16} stroke={2.5} />
            </div>
            <span className="text-xs font-medium text-slate-500 uppercase tracking-widest font-sans">Active Employees</span>
          </div>
          <div className="flex flex-col mt-auto relative z-10">
            <span className="text-[28px] font-mono font-normal tracking-tight text-[#151936]">
              {payslips.filter((p) => p.period === "June 2026").length} Staff
            </span>
            <span className="text-[13px] font-medium text-slate-500 mt-1">Timesheets reconciled</span>
          </div>
        </BoardPanel>

        <BoardPanel className="p-5 flex flex-col justify-between h-[135px] relative overflow-hidden group transition-all duration-300 hover:shadow-md hover:-translate-y-1 hover:border-amber-200 bg-gradient-to-b from-white to-amber-50/10">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity translate-x-4 -translate-y-4">
            <IconClock size={100} stroke={1} />
          </div>
          <div className="flex items-center gap-3 relative z-10">
            <div className="size-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
              <IconClock size={16} stroke={2.5} />
            </div>
            <span className="text-xs font-medium text-slate-500 uppercase tracking-widest">Pending Runs</span>
          </div>
          <div className="flex flex-col mt-auto relative z-10">
            <span className="text-[28px] font-mono font-normal tracking-tight text-amber-700">
              {runs.filter((r) => r.status === "Pending").length} Run
            </span>
            <span className="text-[13px] font-medium text-slate-500 mt-1">Awaiting GM disbursement</span>
          </div>
        </BoardPanel>

        <BoardPanel className="p-5 flex flex-col justify-between h-[135px] relative overflow-hidden group transition-all duration-300 hover:shadow-md hover:-translate-y-1 hover:border-emerald-200 bg-gradient-to-b from-white to-emerald-50/10">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity translate-x-4 -translate-y-4">
            <IconCoins size={100} stroke={1} />
          </div>
          <div className="flex items-center gap-3 relative z-10">
            <div className="size-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
              <IconCoins size={16} stroke={2.5} />
            </div>
            <span className="text-xs font-medium text-slate-500 uppercase tracking-widest">Disbursed June</span>
          </div>
          <div className="flex flex-col mt-auto relative z-10">
            <span className="text-[28px] font-mono font-normal tracking-tight text-emerald-700">
              {runs.some((r) => r.period === "June 2026" && r.status === "Disbursed") ? "Disbursed" : "Pending Approval"}
            </span>
            <span className="text-[13px] font-medium text-slate-500 mt-1">Disbursement status</span>
          </div>
        </BoardPanel>

        <BoardPanel className="p-5 flex flex-col justify-between h-[135px] relative overflow-hidden group transition-all duration-300 hover:shadow-md hover:-translate-y-1 hover:border-rose-200 bg-gradient-to-b from-white to-rose-50/10">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity translate-x-4 -translate-y-4">
            <IconBuildingBank size={100} stroke={1} />
          </div>
          <div className="flex items-center gap-3 relative z-10">
            <div className="size-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100">
              <IconBuildingBank size={16} stroke={2.5} />
            </div>
            <span className="text-xs font-medium text-slate-500 uppercase tracking-widest">Unpaid Remittance</span>
          </div>
          <div className="flex flex-col mt-auto relative z-10">
            <span className="text-[28px] font-mono font-normal tracking-tight text-rose-700">
              {formatMoney(aggregates.pendingRemittances)}
            </span>
            <span className="text-[13px] font-medium text-slate-500 mt-1">Due within 15 days</span>
          </div>
        </BoardPanel>
      </section>

      {/* ── Grid Board Section ────────────────────────────────────────────── */}
      <BoardPanel className="mt-2">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4 mb-4">
          <div>
            <h3 className="title-serif text-[20px] font-normal text-slate-900">
              {tabId === "runs" ? "Payroll Cycles" : tabId === "payslips" ? "Staff Earnings Vouchers" : "Statutory Returns Control"}
            </h3>
            <p className="text-[12.5px] text-slate-450 mt-1 font-medium">
              {tabId === "runs"
                ? "Generate runs and submit for authorization."
                : tabId === "payslips"
                ? "Query employee net salary and audit deductions."
                : "Submit statutory contributions to NSSF, KRA, and Affordable Housing."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex h-9 min-w-[200px] items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 focus-within:border-indigo-400">
              <IconSearch size={14} className="text-slate-400" />
              <input
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="Search values..."
                className="w-full bg-transparent text-[12.5px] text-slate-700 outline-none placeholder:text-slate-400 font-sans"
              />
            </div>
            <Button variant="secondary" size="sm">
              <IconFilter size={14} />
              Filters
            </Button>
            {tabId === "runs" && !isGMorCEO && (
              <Button size="sm" onClick={() => setShowNewRunModal(true)}>
                <IconPlus size={14} />
                New Payroll Run
              </Button>
            )}
          </div>
        </div>

        {paginatedRows.length > 0 ? (
          <div className="space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm text-slate-600">
                <thead>
                  <tr className="border-b border-slate-100 text-sm font-medium uppercase tracking-wider text-slate-400">
                    {tabId === "runs" && (
                      <>
                        <th className="px-3 py-2.5">Run Code</th>
                        <th className="px-3 py-2.5">Period</th>
                        <th className="px-3 py-2.5 text-right">Gross Pay</th>
                        <th className="px-3 py-2.5 text-right">Deductions</th>
                        <th className="px-3 py-2.5 text-right">Net Pay</th>
                        <th className="px-3 py-2.5">Status</th>
                      </>
                    )}
                    {tabId === "payslips" && (
                      <>
                        <th className="px-3 py-2.5">Payslip Code</th>
                        <th className="px-3 py-2.5">Employee Name</th>
                        <th className="px-3 py-2.5">Department</th>
                        <th className="px-3 py-2.5">Period</th>
                        <th className="px-3 py-2.5 text-right">Gross Pay</th>
                        <th className="px-3 py-2.5 text-right">Net Pay</th>
                        <th className="px-3 py-2.5">Status</th>
                      </>
                    )}
                    {tabId === "remittances" && (
                      <>
                        <th className="px-3 py-2.5">Code</th>
                        <th className="px-3 py-2.5">Statutory Body</th>
                        <th className="px-3 py-2.5">Period</th>
                        <th className="px-3 py-2.5 text-right">Amount</th>
                        <th className="px-3 py-2.5">Due Date</th>
                        <th className="px-3 py-2.5">Status</th>
                      </>
                    )}
                    <th className="px-3 py-2.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedRows.map((row) => (
                    <tr
                      key={row.id}
                      onClick={() => {
                        if (tabId === "runs") setSelectedRun(row as PayrollRun);
                        else if (tabId === "payslips") setSelectedPayslip(row as EmployeePayslip);
                        else setSelectedRemittance(row as StatutoryRemittance);
                      }}
                      className="transition-colors hover:bg-slate-50/80 cursor-pointer"
                    >
                      {tabId === "runs" && (
                        <>
                          <td className="px-3 py-3 font-mono text-[12.5px] font-medium text-slate-900">{(row as PayrollRun).runCode}</td>
                          <td className="px-3 py-3 text-slate-800">{(row as PayrollRun).period}</td>
                          <td className="px-3 py-3 text-right font-mono text-[12.5px] font-medium text-slate-900">
                            {formatMoney((row as PayrollRun).grossPay)}
                          </td>
                          <td className="px-3 py-3 text-right font-mono text-[12.5px] text-slate-500">
                            {formatMoney((row as PayrollRun).deductions)}
                          </td>
                          <td className="px-3 py-3 text-right font-mono text-[12.5px] font-medium text-indigo-700">
                            {formatMoney((row as PayrollRun).netPay)}
                          </td>
                          <td className="px-3 py-3">
                            <Badge
                              tone={
                                (row as PayrollRun).status === "Disbursed"
                                  ? "success"
                                  : (row as PayrollRun).status === "Pending"
                                  ? "warning"
                                  : "neutral"
                              }
                            >
                              {(row as PayrollRun).status}
                            </Badge>
                          </td>
                        </>
                      )}
                      {tabId === "payslips" && (
                        <>
                          <td className="px-3 py-3 font-mono text-[12.5px] font-medium text-slate-900">
                            {(row as EmployeePayslip).payslipCode}
                          </td>
                          <td className="px-3 py-3 text-slate-800 font-medium">{(row as EmployeePayslip).employeeName}</td>
                          <td className="px-3 py-3 text-slate-500">{(row as EmployeePayslip).department}</td>
                          <td className="px-3 py-3 text-slate-500">{(row as EmployeePayslip).period}</td>
                          <td className="px-3 py-3 text-right font-mono text-[12.5px] text-slate-500">
                            {formatMoney((row as EmployeePayslip).grossPay)}
                          </td>
                          <td className="px-3 py-3 text-right font-mono text-[12.5px] font-medium text-slate-800">
                            {formatMoney((row as EmployeePayslip).netPay)}
                          </td>
                          <td className="px-3 py-3">
                            <Badge
                              tone={
                                (row as EmployeePayslip).status === "Disbursed"
                                  ? "success"
                                  : (row as EmployeePayslip).status === "Approved"
                                  ? "primary"
                                  : "neutral"
                              }
                            >
                              {(row as EmployeePayslip).status}
                            </Badge>
                          </td>
                        </>
                      )}
                      {tabId === "remittances" && (
                        <>
                          <td className="px-3 py-3 font-mono text-[12.5px] font-medium text-slate-900">
                            {(row as StatutoryRemittance).remittanceCode}
                          </td>
                          <td className="px-3 py-3 text-slate-800 font-medium">{(row as StatutoryRemittance).statutoryBody}</td>
                          <td className="px-3 py-3 text-slate-500">{(row as StatutoryRemittance).period}</td>
                          <td className="px-3 py-3 text-right font-mono text-[12.5px] font-medium text-slate-900">
                            {formatMoney((row as StatutoryRemittance).amount)}
                          </td>
                          <td className="px-3 py-3 font-mono text-[12.5px] text-slate-500">{(row as StatutoryRemittance).dueDate}</td>
                          <td className="px-3 py-3">
                            <Badge
                              tone={
                                (row as StatutoryRemittance).status === "Remitted"
                                  ? "success"
                                  : (row as StatutoryRemittance).status === "Pending"
                                  ? "warning"
                                  : "neutral"
                              }
                            >
                              {(row as StatutoryRemittance).status}
                            </Badge>
                          </td>
                        </>
                      )}
                      <td className="px-3 py-3 text-right">
                        <button
                          type="button"
                          className="inline-flex size-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
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
              label={`${filteredRows.length} records in total`}
            />
          </div>
        ) : (
          <div className="py-12">
            <div className="text-center max-w-sm mx-auto space-y-3">
              <div className="size-12 rounded-2xl bg-slate-50 text-slate-400 flex items-center justify-center mx-auto border border-slate-100 shadow-sm">
                <IconEye size={20} />
              </div>
              <h4 className="text-sm font-medium text-slate-800">No records found</h4>
              <p className="text-[12.5px] text-slate-450 leading-relaxed">
                We couldn't find any values matching your active search queries. Try adjusting your query or filter configurations.
              </p>
            </div>
          </div>
        )}
      </BoardPanel>

      {/* ── Drawer: Payroll Run Details ────────────────────────────────────── */}
      <Drawer
        open={Boolean(selectedRun)}
        onClose={() => setSelectedRun(null)}
        title={`Payroll Cycle: ${selectedRun?.runCode ?? ""}`}
        width="34rem"
        footer={
          selectedRun && (
            <div className="flex gap-2 w-full">
              <Button onClick={() => setSelectedRun(null)} variant="secondary" className="flex-1">
                Close Panel
              </Button>
              {selectedRun.status === "Draft" && !isGMorCEO && (
                <Button onClick={() => handleSubmitRunForApproval(selectedRun)} className="flex-1 bg-[#151936] text-white">
                  Submit for Approval
                </Button>
              )}
              {selectedRun.status === "Pending" && isGMorCEO && (
                <Button
                  onClick={() => {
                    setSelectedRun(null);
                    setConfirmDisbursementRun(selectedRun);
                  }}
                  className="flex-1 bg-[#f3df27] text-[#151936] hover:bg-[#e6d220]"
                >
                  Approve & Disburse
                </Button>
              )}
            </div>
          )
        }
      >
        {selectedRun && (
          <div className="space-y-6 text-slate-700 text-xs">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="size-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-500 shadow-sm border border-slate-100/50">
                <IconCoins size={20} />
              </div>
              <div>
                <h4 className="text-[14px] font-medium text-slate-900 leading-snug">{selectedRun.period} Allocation</h4>
                <p className="text-[11.5px] text-slate-400 mt-0.5">{selectedRun.runCode} · Status: {selectedRun.status}</p>
              </div>
            </div>

            <div className="space-y-5">
              {/* Simulated Handoff Sheet */}
              <div className="relative border border-[#0f172a]/15 bg-gradient-to-r from-indigo-50/70 via-slate-50/50 to-indigo-50/50 p-5 rounded-2xl flex flex-col justify-between overflow-hidden shadow-[inset_0_1px_3px_rgba(255,255,255,0.8),0_4px_12px_rgba(0,0,0,0.02)] select-none outline outline-4 outline-white/80 outline-offset-[-5px]">
                <div className="absolute right-8 top-5 select-none pointer-events-none opacity-[0.12] origin-center -rotate-12 border-2 border-dashed border-current px-3 py-1 text-[16px] font-black tracking-widest rounded text-indigo-700">
                  {selectedRun.status.toUpperCase()}
                </div>

                <div className="flex justify-between items-start text-[11px] text-slate-400 font-mono">
                  <span className="font-medium text-slate-600">SUNLAND REAL ESTATE GROUP</span>
                  <span>RUN ID: {selectedRun.runCode}</span>
                </div>

                <div className="my-2 flex items-baseline justify-between">
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider font-mono">Gross Pay Accrual</p>
                    <p className="font-mono text-[30px] font-medium text-slate-900 leading-none mt-1">
                      {formatMoney(selectedRun.grossPay)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider font-mono">Net Salary Outflow</p>
                    <p className="font-mono text-[18px] font-medium text-indigo-700 leading-none mt-1">
                      {formatMoney(selectedRun.netPay)}
                    </p>
                  </div>
                </div>

                <div className="flex justify-between items-end text-[10px] text-slate-400 border-t border-slate-200/50 pt-2 font-mono">
                  <span>PERIOD: {selectedRun.period}</span>
                  <span>DEDUCTIONS: {formatMoney(selectedRun.deductions)}</span>
                </div>
              </div>

              {/* Department breakdown */}
              <div className="space-y-2">
                <span className="text-[10px] text-slate-450 uppercase tracking-wider font-medium">Department Allocation Breakdown</span>
                <div className="rounded-xl border border-slate-100 divide-y divide-slate-100 overflow-hidden">
                  {selectedRun.departmentsBreakdown.map((dept) => (
                    <div key={dept.name} className="flex justify-between items-center p-3 hover:bg-slate-50/50">
                      <div>
                        <p className="text-slate-800 font-medium">{dept.name}</p>
                        <p className="text-[11px] text-slate-400 font-sans">{dept.count} active employees</p>
                      </div>
                      <p className="font-mono text-[13px] font-medium text-slate-900">{formatMoney(dept.gross)}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tax items breakdown */}
              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">KRA PAYE Share</span>
                  <p className="text-slate-700 font-mono font-medium mt-1 text-[12.5px]">{formatMoney(selectedRun.paye)}</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">NSSF Deductions</span>
                  <p className="text-slate-700 font-mono font-medium mt-1 text-[12.5px]">{formatMoney(selectedRun.nssf)}</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">SHIF Contribution</span>
                  <p className="text-slate-700 font-mono font-medium mt-1 text-[12.5px]">{formatMoney(selectedRun.shif)}</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">Housing Levy (3.0% Total)</span>
                  <p className="text-slate-700 font-mono font-medium mt-1 text-[12.5px]">{formatMoney(selectedRun.housingLevy)}</p>
                </div>
              </div>

              {/* Activity Log */}
              <div className="pt-2 border-t border-slate-100">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">Process Audit Logs</span>
                <div className="mt-2 space-y-2 max-h-[140px] overflow-y-auto pr-1">
                  {selectedRun.activityLog.map((log, idx) => (
                    <div key={idx} className="flex gap-2 text-slate-500 leading-normal font-sans">
                      <span className="size-1.5 rounded-full bg-slate-350 shrink-0 mt-1.5" />
                      <p className="text-[11.5px]">{log}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </Drawer>

      {/* ── Drawer: Employee Payslip Preview ──────────────────────────────── */}
      <Drawer
        open={Boolean(selectedPayslip)}
        onClose={() => setSelectedPayslip(null)}
        title="Staff Salary Statement"
        width="34rem"
        footer={
          selectedPayslip && (
            <div className="flex gap-2 w-full">
              <Button onClick={() => setSelectedPayslip(null)} variant="secondary" className="flex-1">
                Close View
              </Button>
              <Button
                onClick={() => {
                  pushToast({
                    tone: "success",
                    title: "Payslip Statement Sent",
                    body: `Payslip email and SMS voucher dispatched to ${selectedPayslip.employeeName}.`
                  });
                  setSelectedPayslip(null);
                }}
                className="flex-1 bg-[#151936] text-white"
              >
                Resend to Employee
              </Button>
            </div>
          )
        }
      >
        {selectedPayslip && (
          <div className="space-y-6 text-slate-700 text-xs">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="size-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-500 border border-slate-100/50">
                <IconUser size={20} />
              </div>
              <div>
                <h4 className="text-[14px] font-medium text-slate-900 leading-snug">{selectedPayslip.employeeName}</h4>
                <p className="text-[11.5px] text-slate-400 mt-0.5">{selectedPayslip.employeeRole} · {selectedPayslip.department}</p>
              </div>
            </div>

            <div className="space-y-5">
              {/* Simulated Payslip Voucher */}
              <div className="relative border border-[#0f172a]/15 bg-gradient-to-r from-emerald-50/50 via-indigo-50/30 to-indigo-50/50 p-6 rounded-2xl flex flex-col justify-between overflow-hidden shadow-[inset_0_1px_3px_rgba(255,255,255,0.8),0_4px_12px_rgba(0,0,0,0.02)] select-none font-mono">
                <div className="absolute right-8 top-5 select-none pointer-events-none opacity-[0.1] origin-center -rotate-12 border-2 border-dashed border-emerald-600 px-3 py-1.5 text-[20px] font-black tracking-widest rounded text-emerald-600">
                  {selectedPayslip.status === "Disbursed" ? "PAID" : "APPROVED"}
                </div>

                <div className="flex justify-between items-start text-[10px] text-slate-400 border-b border-slate-200/50 pb-2">
                  <div>
                    <p className="font-sans font-medium text-slate-600">SUNLAND REAL ESTATE LTD</p>
                    <p className="text-[9px] font-sans text-slate-400 mt-0.5">PO Box 40100, Nairobi</p>
                  </div>
                  <div className="text-right">
                    <p>SLIP NO: {selectedPayslip.payslipCode}</p>
                    <p className="mt-0.5">PERIOD: {selectedPayslip.period}</p>
                  </div>
                </div>

                <div className="my-4 space-y-2.5">
                  <div className="flex justify-between items-center text-[12px] text-slate-800">
                    <span className="font-sans">Basic Pay Rate</span>
                    <span>{formatMoney(selectedPayslip.basicSalary)}</span>
                  </div>
                  <div className="flex justify-between items-center text-[12px] text-slate-800">
                    <span className="font-sans">House/Transport Allowances</span>
                    <span>{formatMoney(selectedPayslip.allowances)}</span>
                  </div>
                  <div className="h-px bg-slate-200/50 my-1" />
                  <div className="flex justify-between items-center text-[12px] text-slate-900 font-medium">
                    <span className="font-sans">Gross Salary Accrued</span>
                    <span>{formatMoney(selectedPayslip.grossPay)}</span>
                  </div>
                  <div className="h-px bg-slate-250 my-1" />

                  {/* Deductions segment */}
                  <div className="space-y-1 text-[11px] text-slate-500 pl-2">
                    <div className="flex justify-between">
                      <span className="font-sans">PAYE (KRA)</span>
                      <span>-{formatMoney(selectedPayslip.paye)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-sans">NSSF Contribution</span>
                      <span>-{formatMoney(selectedPayslip.nssf)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-sans">SHIF Levy</span>
                      <span>-{formatMoney(selectedPayslip.shif)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-sans">Affordable Housing Levy (1.5%)</span>
                      <span>-{formatMoney(selectedPayslip.housingLevy)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center text-[13px] text-indigo-700 font-medium border-t border-slate-300/50 pt-2">
                  <span className="font-sans">Net Salary Deposited</span>
                  <span>{formatMoney(selectedPayslip.netPay)}</span>
                </div>
              </div>

              {/* QR Code compliance notice */}
              <FinanceQrProof
                artifactRef={selectedPayslip.payslipCode}
                artifactType="Salary Statement Proof"
                entityName="Sunland Group"
                generatedAt="2026-06-22"
                token={`sunland_payslip_${selectedPayslip.payslipCode.toLowerCase()}`}
              />

              {/* Process timeline log */}
              <div className="pt-2 border-t border-slate-100">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">Audit History</span>
                <div className="mt-2 space-y-2">
                  {selectedPayslip.activityLog.map((log, idx) => (
                    <div key={idx} className="flex gap-2 text-slate-500 leading-normal font-sans">
                      <span className="size-1.5 rounded-full bg-slate-350 shrink-0 mt-1.5" />
                      <p className="text-[11.5px]">{log}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </Drawer>

      {/* ── Drawer: Statutory Remittance Details ──────────────────────────── */}
      <Drawer
        open={Boolean(selectedRemittance)}
        onClose={() => setSelectedRemittance(null)}
        title="Statutory Obligation Detail"
        width="34rem"
        footer={
          selectedRemittance && (
            <div className="flex gap-2 w-full">
              <Button onClick={() => setSelectedRemittance(null)} variant="secondary" className="flex-1">
                Close Panel
              </Button>
              {selectedRemittance.status !== "Remitted" && (
                <Button
                  onClick={() => {
                    setShowPayRemittanceModal(true);
                  }}
                  className="flex-1 bg-[#151936] text-white"
                >
                  Mark Remitted
                </Button>
              )}
            </div>
          )
        }
      >
        {selectedRemittance && (
          <div className="space-y-6 text-slate-700 text-xs">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="size-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-500 border border-slate-100/50">
                <IconBuildingBank size={20} />
              </div>
              <div>
                <h4 className="text-[14px] font-medium text-slate-900 leading-snug">{selectedRemittance.statutoryBody} Return</h4>
                <p className="text-[11.5px] text-slate-400 mt-0.5">{selectedRemittance.remittanceCode} · Period: {selectedRemittance.period}</p>
              </div>
            </div>

            <div className="space-y-5">
              {/* Simulated Return Certificate */}
              <div className="relative border border-[#0f172a]/15 bg-gradient-to-r from-amber-50/50 via-slate-50/50 to-indigo-50/50 p-6 rounded-2xl flex flex-col justify-between overflow-hidden shadow-[inset_0_1px_3px_rgba(255,255,255,0.8),0_4px_12px_rgba(0,0,0,0.02)] select-none font-mono">
                <div className="absolute right-8 top-5 select-none pointer-events-none opacity-[0.1] origin-center -rotate-12 border-2 border-dashed border-current px-3 py-1.5 text-[16px] font-black tracking-widest rounded">
                  {selectedRemittance.status.toUpperCase()}
                </div>

                <div className="flex justify-between items-start text-[10px] text-slate-450 border-b border-slate-200/50 pb-2">
                  <span className="font-sans font-medium text-slate-600">REPUBLIC OF KENYA STATUTORY RETURN</span>
                  <span>REF: {selectedRemittance.remittanceCode}</span>
                </div>

                <div className="my-3">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider font-mono">Liability Accrual</p>
                  <p className="font-mono text-[32px] font-medium text-slate-900 leading-none mt-1">
                    {formatMoney(selectedRemittance.amount)}
                  </p>
                </div>

                <div className="space-y-2 border-t border-slate-200/50 pt-3 text-[11px] text-slate-500 font-sans">
                  <div className="flex justify-between">
                    <span>Beneficiary Body</span>
                    <span className="font-mono font-medium text-slate-700">{selectedRemittance.statutoryBody}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Filing Period</span>
                    <span className="font-mono font-medium text-slate-700">{selectedRemittance.period}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Due Date Limit</span>
                    <span className="font-mono text-rose-600 font-medium">{selectedRemittance.dueDate}</span>
                  </div>
                  {selectedRemittance.status === "Remitted" && (
                    <>
                      <div className="flex justify-between">
                        <span>Payment Date</span>
                        <span className="font-mono font-medium text-slate-700">{selectedRemittance.paymentDate}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Payment Reference</span>
                        <span className="font-mono font-medium text-slate-800">{selectedRemittance.paymentRef}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Source Account</span>
                        <span className="font-mono text-slate-700">{selectedRemittance.bankAccount}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Process timeline log */}
              <div className="pt-2 border-t border-slate-100">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">Obligation Timeline</span>
                <div className="mt-2 space-y-2">
                  {selectedRemittance.activityLog.map((log, idx) => (
                    <div key={idx} className="flex gap-2 text-slate-500 leading-normal font-sans">
                      <span className="size-1.5 rounded-full bg-slate-350 shrink-0 mt-1.5" />
                      <p className="text-[11.5px]">{log}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </Drawer>

      {/* ── Modal: New Payroll Run ────────────────────────────────────────── */}
      <Modal open={showNewRunModal} onClose={() => setShowNewRunModal(false)} title="Initiate Payroll Run" size="lg">
        <form onSubmit={handleCreateRun} className="space-y-5 text-xs text-slate-700">
          <div className="rounded-xl bg-indigo-50/50 border border-indigo-100/50 p-4">
            <h4 className="text-[13px] font-medium text-indigo-900 mb-1 flex items-center gap-1.5">
              <IconShieldCheck size={16} className="text-indigo-600" />
              Accrual Generation Notice
            </h4>
            <p className="text-[12px] text-indigo-700/80 leading-relaxed font-sans">
              This process pulls active employee hours directly from HR time clocks (reconciled by the HR Liaison) and computes KRA PAYE, NSSF, SHIF, and Housing Levy automatically.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="runPeriod" className="block text-[11px] font-medium text-slate-450 uppercase tracking-wider mb-2">Target Month</label>
              <select
                id="runPeriod"
                value={newRunPeriod}
                onChange={(e) => setNewRunPeriod(e.target.value)}
                className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-[12.5px] text-slate-800 outline-none focus:border-indigo-400 font-sans"
              >
                <option value="June 2026">June 2026</option>
                <option value="July 2026">July 2026</option>
                <option value="August 2026">August 2026</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-450 uppercase tracking-wider mb-2">Accrual Mode</label>
              <div className="h-10 border border-slate-200 rounded-lg bg-slate-50 flex items-center px-3 text-[12.5px] font-medium text-slate-600">
                Aggregated Timesheet Sync
              </div>
            </div>
          </div>

          {/* Time logs preview */}
          <div className="space-y-2">
            <span className="text-[10px] text-slate-450 uppercase tracking-wider font-medium">HR Reconciled Work Hours (Read-Only)</span>
            <div className="border border-slate-100 rounded-xl overflow-hidden divide-y divide-slate-100 max-h-[200px] overflow-y-auto">
              {MOCK_TIME_LOGS.map((log) => (
                <div key={log.employeeName} className="flex justify-between items-center p-3 hover:bg-slate-50/40">
                  <div>
                    <p className="text-[12.5px] font-medium text-slate-800">{log.employeeName}</p>
                    <p className="text-[11px] text-slate-400 font-sans">{log.department} · {log.hoursLogged} hours logged</p>
                  </div>
                  <p className="font-mono text-[12.5px] font-medium text-slate-700">Gross: {formatMoney(log.computedGross)}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-2.5 justify-end pt-3 border-t border-slate-100">
            <Button onClick={() => setShowNewRunModal(false)} variant="secondary" disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="bg-[#151936] text-white">
              {isSubmitting ? "Generating Accruals..." : "Initiate Run"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── Modal: Pay Remittance ─────────────────────────────────────────── */}
      <Modal open={showPayRemittanceModal} onClose={() => setShowPayRemittanceModal(false)} title="Verify Statutory Remittance" size="md">
        <form onSubmit={handlePayRemittanceSubmit} className="space-y-5 text-xs text-slate-700">
          {selectedRemittance && (
            <>
              <div className="rounded-xl bg-amber-50/50 border border-amber-100/50 p-4">
                <h4 className="text-[13px] font-medium text-amber-900 mb-1 flex items-center gap-1.5">
                  <IconShieldCheck size={16} className="text-amber-600" />
                  Statutory Clearance
                </h4>
                <p className="text-[12px] text-amber-700/80 leading-relaxed font-sans">
                  Verify that statutory payment of <span className="font-mono font-medium">{formatMoney(selectedRemittance.amount)}</span> to the <span className="font-medium">{selectedRemittance.statutoryBody}</span> has been debited from the bank accounts before inputting the reference.
                </p>
              </div>

              <div>
                <label htmlFor="remitAcct" className="block text-[11px] font-medium text-slate-450 uppercase tracking-wider mb-2">Debited Source Account</label>
                <select
                  id="remitAcct"
                  value={remitAccount}
                  onChange={(e) => setRemitAccount(e.target.value)}
                  className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-[12.5px] text-slate-800 outline-none focus:border-indigo-400 font-sans"
                >
                  <option value="NCBA Operating A/C">NCBA Operating A/C</option>
                  <option value="Co-op Reserve A/C">Co-op Reserve A/C</option>
                </select>
              </div>

              <div>
                <label htmlFor="remitRef" className="block text-[11px] font-medium text-slate-450 uppercase tracking-wider mb-2">Payment Reference / Ticket Hash</label>
                <div className="relative flex h-10 items-center rounded-lg border border-slate-200 bg-white px-3 focus-within:border-indigo-400">
                  <input
                    id="remitRef"
                    required
                    value={remitRef}
                    onChange={(e) => setRemitRef(e.target.value)}
                    placeholder="e.g. MP-TX982A-KRA or FT-KCB-9910"
                    className="w-full bg-transparent text-[12.5px] text-slate-700 outline-none placeholder:text-slate-400 font-mono"
                  />
                  <IconTransfer size={16} className="text-slate-400 ml-2" />
                </div>
              </div>

              <div className="flex gap-2.5 justify-end pt-3 border-t border-slate-100">
                <Button onClick={() => setShowPayRemittanceModal(false)} variant="secondary" disabled={isSubmitting}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting} className="bg-[#151936] text-white">
                  {isSubmitting ? "Posting Payment..." : "Record Remittance"}
                </Button>
              </div>
            </>
          )}
        </form>
      </Modal>

      {/* ── Confirm Dialog: Approve & Disburse ────────────────────────────── */}
      <ConfirmDialog
        open={Boolean(confirmDisbursementRun)}
        title="Confirm Payroll Disbursement"
        description={`This action will finalize payroll run ${confirmDisbursementRun?.runCode} of ${formatMoney(
          confirmDisbursementRun?.netPay ?? 0
        )} and initiate the bank allocation process. It cannot be reversed.`}
        confirmLabel="Approve & Disburse"
        tone="info"
        isLoading={isSubmitting}
        onClose={() => setConfirmDisbursementRun(null)}
        onConfirm={handleApproveDisbursement}
      />
    </div>
  );
}
