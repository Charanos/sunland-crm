"use client";

import { useState, useMemo, useEffect } from "react";
import {
  IconSearch,
  IconPlus,
  IconFilter,
  IconChevronDown,
  IconClipboardCheck,
  IconCoins,
  IconScale,
  IconReportMoney,
  IconUser,
  IconDotsVertical,
  IconBuilding,
  IconCheck,
  IconInfoCircle,
  IconReceipt,
  IconPrinter
} from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast-provider";
import { cn } from "@/lib/utils/cn";
import { Modal } from "@/components/ui/modal";
import { Drawer } from "@/components/ui/drawer";
import { FinanceModuleNav } from "@/components/finance/finance-module-nav";
import { BoardHeader, BoardPanel, Button, PaginationControls } from "@/components/ui/erp-primitives";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip
} from "recharts";

// ─── Interfaces ──────────────────────────────────────────────────────────────

interface MandateExpense {
  id: string;
  date: string;
  description: string;
  category: "Maintenance" | "Utility" | "Legal" | "Other";
  amount: number;
}

interface MandateContract {
  id: string;
  mandateCode: string;
  propertyName: string;
  landlordName: string;
  landlordEmail: string;
  landlordPhone: string;
  unitsCount: number;
  feeRate: number; // e.g. 10 for 10%
  expectedRent: number;
  collectedRent: number;
  expenses: MandateExpense[];
  status: "Approved" | "Pending" | "Draft" | "Terminated";
  startDate: string;
  approvalHash?: string;
  approvalUser?: string;
  approvalDate?: string;
}

// ─── Initial Mock Data ────────────────────────────────────────────────────────

const INITIAL_MANDATES: MandateContract[] = [
  {
    id: "m1",
    mandateCode: "MAN-1027",
    propertyName: "Hurlingham Court Block B",
    landlordName: "Jacob Jones",
    landlordEmail: "jacob.jones@hotmail.com",
    landlordPhone: "+254 722 990 112",
    unitsCount: 8,
    feeRate: 8,
    expectedRent: 4800000,
    collectedRent: 4500000,
    expenses: [
      { id: "e1", date: "2026-06-08", description: "Lift lift cable lubrication", category: "Maintenance", amount: 45000 }
    ],
    status: "Approved",
    startDate: "2026-06-01",
    approvalHash: "SHA256-D1B3E4",
    approvalUser: "P. Amos (CEO)",
    approvalDate: "2026-06-01 09:12 AM"
  },
  {
    id: "m2",
    mandateCode: "MAN-1028",
    propertyName: "Nakuru Greens Villas",
    landlordName: "Amina Wanjiku",
    landlordEmail: "amina.wanjiku@outlook.com",
    landlordPhone: "+254 733 112 445",
    unitsCount: 12,
    feeRate: 10,
    expectedRent: 6200000,
    collectedRent: 4200000,
    expenses: [],
    status: "Pending",
    startDate: "2026-06-15"
  },
  {
    id: "m3",
    mandateCode: "MAN-1026",
    propertyName: "Riverside Executive Annex",
    landlordName: "Dr. Arthur Morgan",
    landlordEmail: "arthur.morgan@van-der-linde.org",
    landlordPhone: "+254 711 005 889",
    unitsCount: 4,
    feeRate: 7,
    expectedRent: 1200000,
    collectedRent: 1200000,
    expenses: [
      { id: "e2", date: "2026-05-28", description: "CCTV network repair", category: "Maintenance", amount: 76000 }
    ],
    status: "Pending",
    startDate: "2026-05-28"
  },
  {
    id: "m4",
    mandateCode: "MAN-1025",
    propertyName: "Valuers Commercial Block",
    landlordName: "Esther Howard",
    landlordEmail: "esther.howard@gmail.com",
    landlordPhone: "+254 702 334 556",
    unitsCount: 6,
    feeRate: 5,
    expectedRent: 800000,
    collectedRent: 0,
    expenses: [],
    status: "Draft",
    startDate: "2026-05-18"
  },
  {
    id: "m5",
    mandateCode: "MAN-1024",
    propertyName: "Runda Executive Residency",
    landlordName: "Dennis Munge",
    landlordEmail: "dennis.munge@sunlandre.co.ke",
    landlordPhone: "+254 722 888 777",
    unitsCount: 5,
    feeRate: 10,
    expectedRent: 2000000,
    collectedRent: 2000000,
    expenses: [],
    status: "Approved",
    startDate: "2026-04-01",
    approvalHash: "SHA256-R8T5Y9",
    approvalUser: "P. Amos (CEO)",
    approvalDate: "2026-04-01 08:30 AM"
  },
  {
    id: "m6",
    mandateCode: "MAN-1020",
    propertyName: "Mombasa Gateway Complex",
    landlordName: "Philip Omondi",
    landlordEmail: "philip.omondi@mombasa-ports.co.ke",
    landlordPhone: "+254 734 567 890",
    unitsCount: 20,
    feeRate: 12,
    expectedRent: 7500000,
    collectedRent: 7500000,
    expenses: [],
    status: "Terminated",
    startDate: "2025-01-01"
  }
];

const ROWS_PER_PAGE = 5;

export function PropertyMandatesBoard({ tabId = "active" }: { tabId: string }) {
  const { pushToast } = useToast();
  const [mounted, setMounted] = useState(false);

  // Sync tab active segment
  const activeTab = tabId;

  // Search & pagination state
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);

  // Data states
  const [mandates, setMandates] = useState<MandateContract[]>(INITIAL_MANDATES);

  // Modals & drawers state
  const [selectedMandate, setSelectedMandate] = useState<MandateContract | null>(null);
  const [approveMandate, setApproveMandate] = useState<MandateContract | null>(null);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State - Record Expense
  const [expMandateId, setExpMandateId] = useState("");
  const [expDescription, setExpDescription] = useState("");
  const [expCategory, setExpCategory] = useState<MandateExpense["category"]>("Maintenance");
  const [expAmount, setExpAmount] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(t);
  }, []);

  const openExpenseModalFor = (mandateId: string) => {
    setExpMandateId(mandateId);
    setIsExpenseModalOpen(true);
  };

  // --- Handlers ---

  const handleApproveMandate = async () => {
    if (!approveMandate) return;
    setIsSubmitting(true);
    // Simulate CEO signing verification delay
    await new Promise(resolve => setTimeout(resolve, 800));

    const mockHash = "SHA256-M" + Math.random().toString(36).substring(2, 7).toUpperCase();
    const stampDate = new Date().toLocaleString();

    setMandates(prev =>
      prev.map(m => {
        if (m.id === approveMandate.id) {
          return {
            ...m,
            status: "Approved",
            approvalHash: mockHash,
            approvalUser: "P. Amos (CEO)",
            approvalDate: stampDate
          };
        }
        return m;
      })
    );

    setApproveMandate(null);
    setIsSubmitting(false);

    pushToast({
      tone: "success",
      title: "Mandate Terms Approved",
      body: `CEO Signature Registered. Cryptographic key: ${mockHash}. Contract is now Active.`
    });
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expMandateId || !expDescription || !expAmount || parseFloat(expAmount) <= 0) {
      pushToast({ tone: "error", title: "Validation Error", body: "Please fill in all expense details." });
      return;
    }

    setIsSubmitting(true);
    await new Promise(resolve => setTimeout(resolve, 500));

    const amountNum = parseFloat(expAmount);
    const newExp: MandateExpense = {
      id: `exp-${Date.now()}`,
      date: new Date().toISOString().split("T")[0],
      description: expDescription,
      category: expCategory,
      amount: amountNum
    };

    setMandates(prev =>
      prev.map(m => {
        if (m.id === expMandateId) {
          return {
            ...m,
            expenses: [newExp, ...m.expenses]
          };
        }
        return m;
      })
    );

    // If drawer is open on the active mandate, update the selection details reactively
    if (selectedMandate && selectedMandate.id === expMandateId) {
      setSelectedMandate(prev => {
        if (!prev) return null;
        return {
          ...prev,
          expenses: [newExp, ...prev.expenses]
        };
      });
    }

    setIsExpenseModalOpen(false);
    setExpMandateId("");
    setExpDescription("");
    setExpAmount("");
    setIsSubmitting(false);

    pushToast({
      tone: "success",
      title: "Contract Expense Recorded",
      body: `KES ${amountNum.toLocaleString()} debited to Landlord Remittance split.`
    });
  };

  const handlePrintStatement = (mandateCode: string) => {
    pushToast({
      tone: "info",
      title: "Export Statement Generated",
      body: `PDF Landlord Ledger Statement compiled for mandate: ${mandateCode}. Sent to printer.`
    });
  };

  // --- Calculations ---

  const financialSplitTotals = useMemo(() => {
    let totalCollected = 0;
    let totalMgtFees = 0;
    let totalExpenses = 0;

    mandates.forEach(m => {
      if (m.status === "Approved") {
        totalCollected += m.collectedRent;
        const fees = m.collectedRent * (m.feeRate / 100);
        totalMgtFees += fees;
        const exps = m.expenses.reduce((s, e) => s + e.amount, 0);
        totalExpenses += exps;
      }
    });

    const netPayout = totalCollected - totalMgtFees - totalExpenses;

    return {
      collected: totalCollected,
      fees: totalMgtFees,
      expenses: totalExpenses,
      payout: netPayout,
      chartData: [
        { name: "Landlord Net Payout", value: netPayout, color: "#10b981" },
        { name: "Management Fees", value: totalMgtFees, color: "#6366f1" },
        { name: "Operating Expenses", value: totalExpenses, color: "#f59e0b" }
      ].filter(d => d.value > 0)
    };
  }, [mandates]);

  const metrics = useMemo(() => {
    const activeCount = mandates.filter(m => m.status === "Approved").length;
    const pendingCount = mandates.filter(m => m.status === "Pending").length;

    // Average fee rate of active mandates
    const activeMandates = mandates.filter(m => m.status === "Approved");
    const avgFee = activeMandates.length > 0
      ? activeMandates.reduce((sum, m) => sum + m.feeRate, 0) / activeMandates.length
      : 8.5;

    return {
      active: activeCount,
      pending: pendingCount,
      avgFee: avgFee.toFixed(1) + "%",
      fees: financialSplitTotals.fees,
      payoutQueue: financialSplitTotals.payout
    };
  }, [mandates, financialSplitTotals]);

  // Scoped lists based on current active tab
  const filteredRows = useMemo(() => {
    return mandates.filter(m => {
      // Tab-specific filters
      if (activeTab === "active" && m.status !== "Approved") return false;
      if (activeTab === "pending-approval" && m.status !== "Pending") return false;
      if (activeTab === "draft" && m.status !== "Draft") return false;
      if (activeTab === "terminated" && m.status !== "Terminated") return false;

      // Search match
      const matchesSearch =
        m.mandateCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.propertyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.landlordName.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesSearch;
    });
  }, [mandates, activeTab, searchQuery]);

  const paginatedRows = useMemo(() => {
    return filteredRows.slice((page - 1) * ROWS_PER_PAGE, page * ROWS_PER_PAGE);
  }, [filteredRows, page]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / ROWS_PER_PAGE));

  if (!mounted) return <div className="h-screen w-full skeleton-shimmer bg-slate-50" />;

  return (
    <div className="mx-auto flex max-w-[98rem] flex-col gap-4 animate-fade-in pb-12">

      {/* ── 1. Header & Actions ──────────────────────────────────────────────── */}
      <BoardHeader
        eyebrow={<Badge tone="primary">Property Revenue</Badge>}
        title="Landlord Mandates Control"
        description="Verify property management agreements, negotiate contract splits, log utility deductions, and approve payout remittance schedules."
        meta={
          <span className="hidden text-base text-slate-400 md:inline">
            Active Concern: <span className="font-mono text-slate-600">Landlord Remittance splits</span>
          </span>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex h-9 min-w-[240px] items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 shadow-sm focus-within:border-[#151936] transition-colors">
              <IconSearch size={14} className="text-slate-400" />
              <input
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                placeholder="Search contract code, property, landlord..."
                className="w-full bg-transparent text-slate-700 outline-none placeholder:text-slate-400 text-base"
              />
            </div>
            <Button variant="secondary" size="sm" className="bg-white border-slate-200 shadow-sm">
              <IconFilter size={14} /> Filters
            </Button>
            <Button
              size="sm"
              onClick={() => openExpenseModalFor("")}
              className="bg-[#f3df27] text-[#151936] hover:bg-[#e6d220] shadow-sm"
            >
              <IconPlus size={14} stroke={2.5} /> Record Contract Expense
            </Button>
          </div>
        }
      />

      {/* ── 2. Navigation Pill Selector ──────────────────────────────────────── */}
      <FinanceModuleNav />

      {/* ── 3. KPI Segment Cards ─────────────────────────────────────────────── */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4" aria-label="Mandates key metrics">
        {/* KPI 1 */}
        <BoardPanel className="p-5 flex flex-col justify-between h-[135px] relative overflow-hidden group transition-all duration-300 hover:shadow-md hover:-translate-y-1 hover:border-emerald-200 bg-gradient-to-b from-white to-emerald-50/10">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity translate-x-4 -translate-y-4">
            <IconBuilding size={100} stroke={1} />
          </div>
          <div className="flex items-center gap-3 relative z-10">
            <div className="size-8 rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100/50 text-emerald-600 flex items-center justify-center shadow-sm border border-emerald-200/50">
              <IconBuilding size={16} stroke={2.5} />
            </div>
            <span className="text-slate-500 label-caps">Active Mandates</span>
          </div>
          <div className="flex flex-col mt-auto relative z-10">
            <span className="font-mono font-normal tracking-tight text-[#151936] text-3xl">
              {metrics.active} <span className="text-slate-400 text-xl">Contracts</span>
            </span>
            <span className="mt-1 text-desc-secondary">Currently active</span>
          </div>
        </BoardPanel>

        {/* KPI 2 */}
        <BoardPanel className="p-5 flex flex-col justify-between h-[135px] relative overflow-hidden group transition-all duration-300 hover:shadow-md hover:-translate-y-1 hover:border-indigo-200 bg-gradient-to-b from-white to-indigo-50/10">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity translate-x-4 -translate-y-4">
            <IconCoins size={100} stroke={1} />
          </div>
          <div className="flex items-center gap-3 relative z-10">
            <div className="size-8 rounded-xl bg-gradient-to-br from-indigo-50 to-indigo-100/50 text-indigo-600 flex items-center justify-center shadow-sm border border-indigo-200/50">
              <IconCoins size={16} stroke={2.5} />
            </div>
            <span className="text-slate-500 label-caps">Management Fees</span>
          </div>
          <div className="flex flex-col mt-auto relative z-10">
            <span className="font-mono font-normal tracking-tight text-indigo-700 text-3xl">
              KES {metrics.fees.toLocaleString()}
            </span>
            <span className="mt-1 text-desc-secondary">Avg Rate: {metrics.avgFee}</span>
          </div>
        </BoardPanel>

        {/* KPI 3 */}
        <BoardPanel className="p-5 flex flex-col justify-between h-[135px] relative overflow-hidden group transition-all duration-300 hover:shadow-md hover:-translate-y-1 hover:border-emerald-200 bg-gradient-to-b from-white to-emerald-50/10">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity translate-x-4 -translate-y-4">
            <IconReportMoney size={100} stroke={1} />
          </div>
          <div className="flex items-center gap-3 relative z-10">
            <div className="size-8 rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100/50 text-emerald-600 flex items-center justify-center shadow-sm border border-emerald-200/50">
              <IconReportMoney size={16} stroke={2.5} />
            </div>
            <span className="text-slate-500 label-caps">Remittance Payout</span>
          </div>
          <div className="flex flex-col mt-auto relative z-10">
            <span className="font-mono font-normal tracking-tight text-emerald-700 text-3xl">
              KES {metrics.payoutQueue.toLocaleString()}
            </span>
            <span className="mt-1 text-desc-secondary">Net split total</span>
          </div>
        </BoardPanel>

        {/* KPI 4 */}
        <BoardPanel className="p-5 flex flex-col justify-between h-[135px] relative overflow-hidden group transition-all duration-300 hover:shadow-md hover:-translate-y-1 hover:border-amber-200 bg-gradient-to-b from-white to-amber-50/10">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity translate-x-4 -translate-y-4">
            <IconScale size={100} stroke={1} />
          </div>
          <div className="flex items-center gap-3 relative z-10">
            <div className="size-8 rounded-xl bg-gradient-to-br from-amber-50 to-amber-100/50 text-amber-600 flex items-center justify-center shadow-sm border border-amber-200/50">
              <IconScale size={16} stroke={2.5} />
            </div>
            <span className="text-slate-500 label-caps">Pending Payout</span>
          </div>
          <div className="flex flex-col mt-auto relative z-10">
            <span className="font-mono font-normal tracking-tight text-amber-700 text-3xl">
              {metrics.pending} <span className="text-amber-700/70 text-xl">Contracts</span>
            </span>
            <span className="mt-1 text-desc-secondary">Awaiting CEO approval</span>
          </div>
        </BoardPanel>
      </section>

      {/* ── 4. Mandate Financial Payout Donut ────────────────────────────────── */}
      <BoardPanel className="p-6 shadow-sm border-slate-200 relative overflow-hidden transition-all duration-300 hover:border-slate-300 group">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_300px] gap-8 items-center">
          <div>
            <h3 className="font-normal tracking-tight text-slate-900 text-xl">Contract Financial Payout Split</h3>
            <p className="mt-1 leading-relaxed text-desc-secondary">Summary of how collected rent is split between company management fees, utility/maintenance deductions, and net landlord disbursements.</p>
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="rounded-xl border border-slate-200/60 bg-gradient-to-b from-slate-50/80 to-white p-4 transition-all hover:shadow-sm hover:-translate-y-0.5 hover:border-slate-300">
                <span className="text-slate-500 label-caps">Total Collected Rent</span>
                <p className="tracking-tight text-slate-900 mt-2 mono-stat">KES {financialSplitTotals.collected.toLocaleString()}</p>
              </div>
              <div className="rounded-xl border border-indigo-200/60 bg-gradient-to-b from-indigo-50/80 to-white p-4 transition-all hover:shadow-sm hover:-translate-y-0.5 hover:border-indigo-300">
                <span className="text-indigo-700 label-caps">Accrued Mgmt Fees</span>
                <p className="tracking-tight text-indigo-700 mt-2 mono-stat">KES {financialSplitTotals.fees.toLocaleString()}</p>
              </div>
              <div className="rounded-xl border border-amber-200/60 bg-gradient-to-b from-amber-50/80 to-white p-4 transition-all hover:shadow-sm hover:-translate-y-0.5 hover:border-amber-300">
                <span className="text-amber-700 label-caps">Utility/Legal Deductions</span>
                <p className="tracking-tight text-amber-700 mt-2 mono-stat">KES {financialSplitTotals.expenses.toLocaleString()}</p>
              </div>
            </div>
          </div>

          <div className="h-[180px] w-full relative flex items-center justify-center">
            {financialSplitTotals.chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={financialSplitTotals.chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {financialSplitTotals.chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: unknown) => `KES ${parseInt(value as string).toLocaleString()}`} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <span className="text-slate-400 font-medium text-sm">No approved collection data</span>
            )}
            <div className="absolute flex flex-col items-center">
              <span className="text-sm  text-slate-400 uppercase font-medium">Net Payout</span>
              <span className="font-mono font-normal text-slate-800 mt-0.5 body-md">
                KES {(financialSplitTotals.payout / 1000000).toFixed(1)}M
              </span>
            </div>
          </div>
        </div>
      </BoardPanel>

      {/* ── 5. Segment Content Title & Queue ─────────────────────────────────── */}
      <div className="pt-2 my-2 animate-fade-in-up">
        <h2 className="title-serif text-slate-900 font-normal capitalize">
          {activeTab.replace(/-/g, " ")} Contracts Panel
        </h2>
        <p className="text-desc-secondary mt-1">
          {activeTab === "active" && "Registry of active landlord management mandates showing collections, fee splits, and remittance balances."}
          {activeTab === "pending-approval" && "Contracts awaiting CEO verification signatures and cryptographic signoff audits."}
          {activeTab === "draft" && "Terms and parameters for draft contracts currently under negotiation."}
          {activeTab === "terminated" && "Historic mandate database preserved for audits and statutory compliance reports."}
        </p>
      </div>

      <BoardPanel className="p-0 overflow-hidden shadow-sm border-slate-200 animate-fade-in-up">
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-white">
          <div>
            <h3 className="text-title-primary">Landlord Contracts Queue</h3>
            <p className="mt-0.5 text-sm  text-slate-400">Click any row to reveal contract units, split parameters, and payout schedules.</p>
          </div>
          <Button variant="secondary" size="sm" className="bg-white border-slate-200">
            <IconChevronDown size={14} /> Export Queue
          </Button>
        </div>

        {paginatedRows.length > 0 ? (
          <>
            <div className="overflow-x-auto bg-white">
              <table className="w-full min-w-[760px] text-left text-body-regular">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 label-caps">
                    <th className="px-5 py-3">Contract Code</th>
                    <th className="px-5 py-3">Property / Units</th>
                    <th className="px-5 py-3">Landlord</th>
                    <th className="px-5 py-3 text-right">Fee Rate</th>
                    {activeTab !== "draft" && <th className="px-5 py-3 text-right">Collected Rent</th>}
                    {activeTab !== "draft" && <th className="px-5 py-3 text-right">Deductions</th>}
                    {activeTab !== "draft" && <th className="px-5 py-3 text-right">Landlord Share</th>}
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedRows.map((row) => {
                    const companyShare = row.collectedRent * (row.feeRate / 100);
                    const deductions = row.expenses.reduce((s, e) => s + e.amount, 0);
                    const landlordShare = Math.max(0, row.collectedRent - companyShare - deductions);

                    return (
                      <tr
                        key={row.id}
                        onClick={() => setSelectedMandate(row)}
                        className="transition-colors hover:bg-slate-50/80 cursor-pointer"
                      >
                        <td className="px-5 py-3.5 text-slate-900 mono-data">
                          {row.mandateCode}
                        </td>
                        <td className="px-5 py-3.5">
                          <p className="text-title-primary leading-snug">{row.propertyName}</p>
                          <p className="text-sm text-slate-400 mt-0.5">{row.unitsCount} active units assigned</p>
                        </td>
                        <td className="px-5 py-3.5">
                          <p className="text-title-primary">{row.landlordName}</p>
                          <span className="text-sm text-slate-400 font-mono">Started: {row.startDate}</span>
                        </td>
                        <td className="px-5 py-3.5 text-right text-slate-800 mono-data">
                          {row.feeRate}%
                        </td>
                        {activeTab !== "draft" && (
                          <td className="px-5 py-3.5 text-right text-slate-900 mono-data">
                            KES {row.collectedRent.toLocaleString()}
                          </td>
                        )}
                        {activeTab !== "draft" && (
                          <td className={cn(
                            "px-5 py-3.5 text-right font-mono text-sm font-medium",
                            deductions > 0 ? "text-amber-700 bg-amber-50/30" : "text-slate-400"
                          )}>
                            {deductions > 0 ? `KES ${deductions.toLocaleString()}` : "—"}
                          </td>
                        )}
                        {activeTab !== "draft" && (
                          <td className="px-5 py-3.5 text-right text-emerald-700 bg-emerald-50/40 mono-data">
                            KES {landlordShare.toLocaleString()}
                          </td>
                        )}
                        <td className="px-5 py-3.5">
                          <Badge
                            tone={
                              row.status === "Approved" ? "success" :
                                row.status === "Pending" ? "warning" :
                                  row.status === "Draft" ? "data" : "neutral"
                            }
                          >
                            {row.status === "Approved" ? "Active" : row.status}
                          </Badge>
                        </td>
                        <td className="px-5 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            {row.status === "Pending" && (
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => setApproveMandate(row)}
                                className="text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-200/50 flex items-center gap-1 font-medium"
                              >
                                <IconClipboardCheck size={12} /> Sign & Approve
                              </Button>
                            )}
                            {row.status === "Approved" && (
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => openExpenseModalFor(row.id)}
                                className="text-amber-700 bg-amber-50 hover:bg-amber-100 border-amber-200/50 flex items-center gap-1 font-medium"
                              >
                                <IconReceipt size={12} /> Log Exp
                              </Button>
                            )}
                            <button
                              type="button"
                              onClick={() => setSelectedMandate(row)}
                              className="inline-flex size-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
                            >
                              <IconDotsVertical size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <PaginationControls
              currentPage={page}
              totalPages={totalPages}
              onPageChange={setPage}
              label={`Showing ${filteredRows.length} mandates records`}
            />
          </>
        ) : (
          <div className="p-12 text-center bg-white">
            <p className="text-sm  text-slate-450 font-medium">No contracts match the filters or selection criteria.</p>
          </div>
        )}
      </BoardPanel>

      {/* ── 6. Modals & Drawers ──────────────────────────────────────────────── */}

      {/* MODAL: Record Mandate Expense */}
      <Modal
        open={isExpenseModalOpen}
        onClose={() => setIsExpenseModalOpen(false)}
        title="Record Contract Expense"
        description="Debit property-related maintenance, legal, or utility charges directly against the landlord payout split."
      >
        <form onSubmit={handleAddExpense} className="space-y-4">
          <div>
            <label className="uppercase tracking-wider block mb-1 text-desc-secondary">Select Active Mandate</label>
            <select
              value={expMandateId}
              onChange={(e) => setExpMandateId(e.target.value)}
              required
              className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-base text-slate-700 focus:outline-none"
            >
              <option value="">-- Choose Contract --</option>
              {mandates.filter(m => m.status === "Approved").map((m) => (
                <option key={m.id} value={m.id}>
                  {m.mandateCode} - {m.propertyName} (Landlord: {m.landlordName})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="uppercase tracking-wider block mb-1 text-desc-secondary">Expense Description</label>
            <input
              type="text"
              required
              placeholder="e.g. Lift backup battery replacement"
              value={expDescription}
              onChange={(e) => setExpDescription(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-base focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="uppercase tracking-wider block mb-1 text-desc-secondary">Expense Amount (KES)</label>
              <input
                type="number"
                required
                placeholder="45000"
                value={expAmount}
                onChange={(e) => setExpAmount(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white p-2.5 focus:outline-none mono-data"
              />
            </div>
            <div>
              <label className="uppercase tracking-wider block mb-1 text-desc-secondary">Deduction Category</label>
              <select
                value={expCategory}
                onChange={(e) => setExpCategory(e.target.value as MandateExpense["category"])}
                className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-base text-slate-700 focus:outline-none"
              >
                <option value="Maintenance">Maintenance</option>
                <option value="Utility">Utility</option>
                <option value="Legal">Legal</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2.5 pt-4">
            <Button type="button" variant="secondary" onClick={() => setIsExpenseModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="bg-[#f3df27] text-[#151936] hover:bg-[#e6d220]">
              {isSubmitting ? "Logging..." : "Record Expense"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* CONFIRMATION: Sign & Approve Mandate */}
      {approveMandate && (
        <Modal
          open={!!approveMandate}
          onClose={() => setApproveMandate(null)}
          title="Approve Landlord Management Mandate"
          description="Verify splits, landlord details, and terms. Approving generates a cryptographic stamp signature."
        >
          <div className="space-y-4">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60 text-slate-700 space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Contract Reference:</span>
                <span className="text-value-mono">{approveMandate.mandateCode}</span>
              </div>
              <div className="flex justify-between">
                <span>Property Details:</span>
                <span className="font-medium text-slate-900">{approveMandate.propertyName}</span>
              </div>
              <div className="flex justify-between">
                <span>Landlord Owner:</span>
                <span className="font-medium text-slate-900">{approveMandate.landlordName}</span>
              </div>
              <div className="flex justify-between">
                <span>Negotiated Split:</span>
                <span className="font-medium text-slate-900">
                  {approveMandate.feeRate}% Management Fee / {100 - approveMandate.feeRate}% Landlord Payout
                </span>
              </div>
              <div className="flex justify-between">
                <span>Units Assigned:</span>
                <span className="font-medium text-slate-900">{approveMandate.unitsCount} units</span>
              </div>
            </div>

            <div className="flex items-start gap-2 bg-indigo-50/50 p-3 rounded-lg border border-indigo-100 text-indigo-850 text-sm">
              <IconInfoCircle size={14} className="shrink-0 mt-0.5" />
              <span>Confirming registers this contract as ACTIVE in the General Ledger. All rent collections will automatically split based on these terms.</span>
            </div>

            <div className="flex justify-end gap-2.5 pt-4">
              <Button type="button" variant="secondary" onClick={() => setApproveMandate(null)}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleApproveMandate}
                disabled={isSubmitting}
                className="bg-[#151936] text-white hover:bg-slate-800"
              >
                {isSubmitting ? "Generating Signature..." : "Sign & Activate Mandate"}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* DRAWER: Mandate Contract Details */}
      <Drawer
        open={!!selectedMandate}
        onClose={() => setSelectedMandate(null)}
        title="Mandate Contract Details"
        width="34rem"
        footer={
          selectedMandate && (
            <div className="flex items-center justify-between w-full">
              <span className="text-base text-slate-400">Ref: {selectedMandate.mandateCode}</span>
              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => handlePrintStatement(selectedMandate.mandateCode)}
                  className="flex items-center gap-1 bg-white shadow-sm border-slate-200"
                >
                  <IconPrinter size={13} /> Statement
                </Button>
                {selectedMandate.status === "Approved" && (
                  <Button
                    size="sm"
                    onClick={() => {
                      const id = selectedMandate.id;
                      setSelectedMandate(null);
                      openExpenseModalFor(id);
                    }}
                    className="bg-[#f3df27] text-[#151936] hover:bg-[#e6d220] shadow-xs"
                  >
                    Log Expense
                  </Button>
                )}
                <Button variant="secondary" size="sm" onClick={() => setSelectedMandate(null)}>
                  Close
                </Button>
              </div>
            </div>
          )
        }
      >
        {selectedMandate && (
          <div className="space-y-6">

            {/* Split statistics */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h4 className="font-medium text-slate-800 mb-2 leading-tight text-label">{selectedMandate.propertyName}</h4>
              <p className="text-slate-500 uppercase tracking-wide mono-data">Owner: {selectedMandate.landlordName}</p>

              <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 text-sm">
                <div className="flex justify-between py-1 border-b border-slate-100/60">
                  <span className="text-slate-400">Negotiated Rate:</span>
                  <span className="font-medium text-slate-900">{selectedMandate.feeRate}% fee</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100/60">
                  <span className="text-slate-400">Units Count:</span>
                  <span className="font-medium text-slate-900">{selectedMandate.unitsCount} assigned</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100/60">
                  <span className="text-slate-400">Total Collected:</span>
                  <span className="text-value-mono">KES {selectedMandate.collectedRent.toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100/60">
                  <span className="text-slate-400">Statutory Deductions:</span>
                  <span className="font-mono font-medium text-amber-700">
                    KES {selectedMandate.expenses.reduce((s, e) => s + e.amount, 0).toLocaleString()}
                  </span>
                </div>
              </div>

              {selectedMandate.status === "Approved" && (
                <div className="mt-4 bg-emerald-50/50 p-3 rounded-lg border border-emerald-150 flex items-center justify-between text-sm">
                  <span className="text-slate-600 font-medium">Net Remittance Payout Due:</span>
                  <span className="font-mono font-normal text-emerald-700 text-sm ">
                    KES {(
                      selectedMandate.collectedRent -
                      (selectedMandate.collectedRent * (selectedMandate.feeRate / 100)) -
                      selectedMandate.expenses.reduce((s, e) => s + e.amount, 0)
                    ).toLocaleString()}
                  </span>
                </div>
              )}
            </div>

            {/* Verification Signoff Stamp */}
            {selectedMandate.approvalHash ? (
              <div className="rounded-xl border border-indigo-150 bg-indigo-50/10 p-3.5 text-slate-700 space-y-1.5 text-sm">
                <p className="font-normal text-indigo-700 flex items-center gap-1 leading-none label-caps">
                  <IconCheck size={12} stroke={3} /> CEO SIGNATURE REGISTERED
                </p>
                <div className="flex justify-between pt-1 text-sm">
                  <span className="text-slate-400 font-medium">Authorized By:</span>
                  <span className="font-medium text-slate-800">{selectedMandate.approvalUser}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400 font-medium">Verification Token:</span>
                  <span className="font-mono font-medium text-slate-850 bg-slate-100 px-1 rounded">{selectedMandate.approvalHash}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400 font-medium">Signoff Timestamp:</span>
                  <span className="text-slate-850 font-medium">{selectedMandate.approvalDate}</span>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/40 p-4 text-center text-slate-400 font-medium text-sm">
                Contract awaits CEO signoff verification before active disbursements can execute.
              </div>
            )}

            {/* Landlord Contact Info */}
            <div className="border border-slate-150 rounded-xl p-4 bg-slate-50/50">
              <p className="text-slate-400 mb-3 label-caps">Owner Contact Profile</p>
              <div className="flex items-center justify-between text-slate-700 text-sm">
                <div className="flex items-center gap-2">
                  <IconUser size={14} className="text-slate-400" />
                  <span className="font-medium text-slate-800">{selectedMandate.landlordName}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm text-slate-500">{selectedMandate.landlordPhone}</span>
                  <span className="text-slate-500">{selectedMandate.landlordEmail}</span>
                </div>
              </div>
            </div>

            {/* Expense logs list */}
            <div>
              <p className="text-slate-400 mb-3 label-caps">Contract Expenses Deductions</p>
              {selectedMandate.expenses.length > 0 ? (
                <div className="space-y-2">
                  {selectedMandate.expenses.map((exp) => (
                    <div key={exp.id} className="flex items-center justify-between border border-slate-100 bg-white rounded-lg p-3 shadow-xs">
                      <div>
                        <p className="text-title-primary">{exp.description}</p>
                        <p className="text-sm text-slate-450 mt-0.5">Category: {exp.category}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-amber-700 leading-none mono-data">KES {exp.amount.toLocaleString()}</p>
                        <span className="text-sm  text-slate-400 font-mono mt-1 block">{exp.date}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 border border-slate-100 border-dashed rounded-lg bg-slate-50/50">
                  <p className="text-slate-400 font-medium text-sm">No expenses charged to this mandate ledger.</p>
                </div>
              )}
            </div>

          </div>
        )}
      </Drawer>
    </div>
  );
}
