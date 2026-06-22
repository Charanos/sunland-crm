"use client";

import { useState, useMemo, useEffect } from "react";
import {
  IconSearch,
  IconPlus,
  IconFilter,
  IconChevronDown,
  IconCoins,
  IconClock,
  IconAlertTriangle,
  IconHome,
  IconDotsVertical,
  IconMapPin,
  IconUser,
  IconCheck,
  IconMail,
  IconPhone
} from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast-provider";
import { cn } from "@/lib/utils/cn";
import { Modal } from "@/components/ui/modal";
import { Drawer } from "@/components/ui/drawer";
import { FinanceModuleNav } from "@/components/finance/finance-module-nav";
import { BoardHeader, BoardPanel, Button, PaginationControls } from "@/components/ui/erp-primitives";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip
} from "recharts";

// ─── Interfaces ──────────────────────────────────────────────────────────────

interface PaymentRecord {
  id: string;
  date: string;
  amount: number;
  method: "M-Pesa" | "Bank Transfer" | "Cheque" | "Cash";
  reference: string;
}

interface RentalUnit {
  id: string;
  unitCode: string;
  property: string;
  location: string;
  tenantName: string;
  expectedRent: number;
  collectedRent: number;
  deficit: number;
  arrearsAge: number; // in days
  status: "Posted" | "Overdue" | "Pending" | "Vacant";
  period: string;
  paymentPlan?: {
    installment: number;
    durationWeeks: number;
    startDate: string;
    active: boolean;
  };
  payments: PaymentRecord[];
}

// ─── Initial Mock Data ────────────────────────────────────────────────────────

const INITIAL_RENTAL_UNITS: RentalUnit[] = [
  {
    id: "r1",
    unitCode: "SL-R-018",
    property: "Westpoint Apartments, Apt 4B",
    location: "Westlands, Nairobi",
    tenantName: "Mary Wanjiku",
    expectedRent: 125000,
    collectedRent: 125000,
    deficit: 0,
    arrearsAge: 0,
    status: "Posted",
    period: "June 2026",
    payments: [
      { id: "tx1", date: "2026-06-05", amount: 125000, method: "Bank Transfer", reference: "FT-26156-NCBA" }
    ]
  },
  {
    id: "r2",
    unitCode: "SL-R-021",
    property: "Kilimani Business Center, Shop 12",
    location: "Kilimani, Nairobi",
    tenantName: "Quick Logistics Ltd",
    expectedRent: 45000,
    collectedRent: 0,
    deficit: 45000,
    arrearsAge: 45,
    status: "Overdue",
    period: "June 2026",
    payments: []
  },
  {
    id: "r3",
    unitCode: "SL-R-044",
    property: "Riverside Residences, Unit C7",
    location: "Riverside, Nairobi",
    tenantName: "Global Trade Inc",
    expectedRent: 180000,
    collectedRent: 100000,
    deficit: 80000,
    arrearsAge: 12,
    status: "Pending",
    period: "June 2026",
    payments: [
      { id: "tx2", date: "2026-06-10", amount: 100000, method: "M-Pesa", reference: "MP-RF425G-KES" }
    ]
  },
  {
    id: "r4",
    unitCode: "SL-R-050",
    property: "Syokimau Warehouses, Warehouse 3",
    location: "Syokimau, Mombasa Rd",
    tenantName: "Vacant Unit",
    expectedRent: 350000,
    collectedRent: 0,
    deficit: 0,
    arrearsAge: 0,
    status: "Vacant",
    period: "June 2026",
    payments: []
  },
  {
    id: "r5",
    unitCode: "SL-R-062",
    property: "Lavington Townhouses, House 4",
    location: "Lavington, Nairobi",
    tenantName: "Esther Howard",
    expectedRent: 250000,
    collectedRent: 250000,
    deficit: 0,
    arrearsAge: 0,
    status: "Posted",
    period: "June 2026",
    payments: [
      { id: "tx3", date: "2026-06-03", amount: 250000, method: "Bank Transfer", reference: "FT-99102-KCB" }
    ]
  },
  {
    id: "r6",
    unitCode: "SL-R-078",
    property: "Gigiri Heights, Suite 102",
    location: "Gigiri, Nairobi",
    tenantName: "Dr. Arthur Morgan",
    expectedRent: 190000,
    collectedRent: 0,
    deficit: 190000,
    arrearsAge: 95,
    status: "Overdue",
    period: "June 2026",
    payments: []
  },
  {
    id: "r7",
    unitCode: "SL-R-099",
    property: "Runda Estate, Villa 15",
    location: "Runda, Nairobi",
    tenantName: "Amina Wanjiku",
    expectedRent: 300000,
    collectedRent: 0,
    deficit: 300000,
    arrearsAge: 32,
    status: "Overdue",
    period: "June 2026",
    payments: []
  }
];

const INITIAL_HISTORIC_CHART_DATA = [
  { month: "Jan", Expected: 8500000, Collected: 8200000 },
  { month: "Feb", Expected: 8800000, Collected: 8400000 },
  { month: "Mar", Expected: 9100000, Collected: 8750000 },
  { month: "Apr", Expected: 9400000, Collected: 8900000 },
  { month: "May", Expected: 9600000, Collected: 9200000 },
  { month: "Jun", Expected: 9800000, Collected: 8960000 }
];

const ROWS_PER_PAGE = 5;

export function RentalsLedgerBoard({ tabId = "collections" }: { tabId: string }) {
  const { pushToast } = useToast();
  const [mounted, setMounted] = useState(false);

  // Sync tab active segment
  const activeTab = tabId;

  // Search, filtering, pagination states
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);

  // Core Data States
  const [units, setUnits] = useState<RentalUnit[]>(INITIAL_RENTAL_UNITS);
  const [chartData, setChartData] = useState(INITIAL_HISTORIC_CHART_DATA);

  // Drawer / Modals states
  const [selectedUnit, setSelectedUnit] = useState<RentalUnit | null>(null);
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [escalateUnit, setEscalateUnit] = useState<RentalUnit | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form States - Log Payment
  const [payUnitId, setPayUnitId] = useState("");
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState<PaymentRecord["method"]>("Bank Transfer");
  const [payRef, setPayRef] = useState("");

  // Form States - Set Arrears Payment Plan
  const [planUnitId, setPlanUnitId] = useState("");
  const [planInstallment, setPlanInstallment] = useState("");
  const [planWeeks, setPlanWeeks] = useState("6");
  const [planStartDate, setPlanStartDate] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(t);
  }, []);

  // Sync dropdown/form unit selection when selecting a row unit first
  const openPayModalFor = (unitId: string) => {
    setPayUnitId(unitId);
    const unit = units.find(u => u.id === unitId);
    if (unit) {
      setPayAmount(String(unit.deficit > 0 ? unit.deficit : unit.expectedRent));
    }
    setIsPayModalOpen(true);
  };

  const openPlanModalFor = (unitId: string) => {
    setPlanUnitId(unitId);
    const unit = units.find(u => u.id === unitId);
    if (unit) {
      setPlanInstallment(String(Math.round(unit.deficit / 6)));
    }
    setPlanStartDate(new Date().toISOString().split("T")[0]);
    setIsPlanModalOpen(true);
  };

  // --- Handlers ---

  const handleLogPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payUnitId || !payAmount || parseFloat(payAmount) <= 0) {
      pushToast({ tone: "error", title: "Validation Error", body: "Please select a unit and enter a valid amount." });
      return;
    }

    setIsSubmitting(true);
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 600));

    const amountNum = parseFloat(payAmount);

    setUnits(prev =>
      prev.map(unit => {
        if (unit.id === payUnitId) {
          const newCollected = unit.collectedRent + amountNum;
          const newDeficit = Math.max(0, unit.expectedRent - newCollected);
          const newStatus = newDeficit === 0 ? "Posted" : unit.status;

          const newTx: PaymentRecord = {
            id: `tx-${Date.now()}`,
            date: new Date().toISOString().split("T")[0],
            amount: amountNum,
            method: payMethod,
            reference: payRef || `MOCK-TXN-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
          };

          return {
            ...unit,
            collectedRent: newCollected,
            deficit: newDeficit,
            status: newStatus,
            payments: [newTx, ...unit.payments]
          };
        }
        return unit;
      })
    );

    // Update June chart collection data reactively
    setChartData(prev =>
      prev.map(c => (c.month === "Jun" ? { ...c, Collected: c.Collected + amountNum } : c))
    );

    setIsPayModalOpen(false);
    setPayUnitId("");
    setPayAmount("");
    setPayRef("");
    setIsSubmitting(false);

    pushToast({
      tone: "success",
      title: "Rent Payment Logged",
      body: `KES ${amountNum.toLocaleString()} applied to unit ledger.`
    });
  };

  const handleSetPaymentPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!planUnitId || !planInstallment) {
      pushToast({ tone: "error", title: "Validation Error", body: "Please fill in all plan parameters." });
      return;
    }

    setIsSubmitting(true);
    await new Promise(resolve => setTimeout(resolve, 500));

    const instNum = parseFloat(planInstallment);
    const durationNum = parseInt(planWeeks);

    setUnits(prev =>
      prev.map(unit => {
        if (unit.id === planUnitId) {
          return {
            ...unit,
            paymentPlan: {
              installment: instNum,
              durationWeeks: durationNum,
              startDate: planStartDate,
              active: true
            }
          };
        }
        return unit;
      })
    );

    setIsPlanModalOpen(false);
    setPlanUnitId("");
    setPlanInstallment("");
    setIsSubmitting(false);

    pushToast({
      tone: "success",
      title: "Payment Plan Activated",
      body: `Arrears plan structured at KES ${instNum.toLocaleString()} weekly for ${durationNum} weeks.`
    });
  };

  const handleEscalateLeasing = async () => {
    if (!escalateUnit) return;
    setIsSubmitting(true);
    await new Promise(resolve => setTimeout(resolve, 500));

    pushToast({
      tone: "info",
      title: "Vacancy Escalated",
      body: `Unit ${escalateUnit.unitCode} handover sent to Property Management (Esther Howard).`
    });

    setEscalateUnit(null);
    setIsSubmitting(false);
  };

  // --- Calculations ---

  const metrics = useMemo(() => {
    const totalExpected = units.reduce((sum, u) => sum + (u.status !== "Vacant" ? u.expectedRent : 0), 0);
    const totalCollected = units.reduce((sum, u) => sum + u.collectedRent, 0);
    const totalDeficits = units.reduce((sum, u) => sum + u.deficit, 0);
    const activeDefaulters = units.filter(u => u.status === "Overdue" || u.deficit > 100000).length;
    const rate = totalExpected > 0 ? (totalCollected / totalExpected) * 100 : 0;

    return {
      rate: rate.toFixed(1) + "%",
      expected: totalExpected,
      deficits: totalDeficits,
      defaulters: activeDefaulters,
      vacantCount: units.filter(u => u.status === "Vacant").length
    };
  }, [units]);

  // Scoped rows based on active segment tab
  const filteredRows = useMemo(() => {
    return units.filter(unit => {
      // Tab-specific filters
      if (activeTab === "deficits" && unit.deficit <= 0) return false;
      if (activeTab === "vacancies" && unit.status !== "Vacant") return false;
      if (activeTab === "defaulters" && unit.arrearsAge <= 30 && unit.deficit < 100000) return false;

      // Query filter
      const matchesSearch =
        unit.unitCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        unit.property.toLowerCase().includes(searchQuery.toLowerCase()) ||
        unit.tenantName.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesSearch;
    });
  }, [units, activeTab, searchQuery]);

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
        title="Rentals General Ledger"
        description="Monitor rent logs, audit tenant deficits, escalate vacancy pipelines, and negotiate payment schedules."
        meta={
          <span className="hidden text-base text-slate-400 md:inline">
            Active Concern: <span className="font-mono text-slate-600">Rentals Accounting</span>
          </span>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex h-9 min-w-[240px] items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 shadow-sm focus-within:border-[#151936] transition-colors">
              <IconSearch size={14} className="text-slate-400" />
              <input
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                placeholder="Search unit, property, or tenant..."
                className="w-full bg-transparent text-[12.5px] text-slate-700 outline-none placeholder:text-slate-400"
              />
            </div>
            <Button variant="secondary" size="sm" className="bg-white border-slate-200 shadow-sm">
              <IconFilter size={14} /> Filters
            </Button>
            <Button
              size="sm"
              onClick={() => openPayModalFor("")}
              className="bg-[#f3df27] text-[#151936] hover:bg-[#e6d220] shadow-sm"
            >
              <IconPlus size={14} stroke={2.5} /> Log Rent Payment
            </Button>
          </div>
        }
      />

      {/* ── 2. Navigation Pill Selector ──────────────────────────────────────── */}
      <FinanceModuleNav />

      {/* ── 3. KPI Segment Cards ─────────────────────────────────────────────── */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4" aria-label="Rentals key metrics">
        <BoardPanel className="p-5 flex flex-col justify-between h-[135px] relative overflow-hidden group transition-all duration-300 hover:shadow-md hover:-translate-y-1 hover:border-emerald-200 bg-gradient-to-b from-white to-emerald-50/10">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity translate-x-4 -translate-y-4">
            <IconCoins size={100} stroke={1} />
          </div>
          <div className="flex items-center gap-3 relative z-10">
            <div className="size-8 rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100/50 text-emerald-600 flex items-center justify-center shadow-sm border border-emerald-200/50">
              <IconCoins size={16} stroke={2.5} />
            </div>
            <span className="text-xs font-medium text-slate-500 uppercase tracking-widest">Collection Rate</span>
          </div>
          <div className="flex flex-col mt-auto relative z-10">
            <span className="text-[28px] font-mono font-normal tracking-tight text-[#151936]">
              {metrics.rate} <span className="text-[20px] text-emerald-600/70">+1.4% target</span>
            </span>
            <span className="text-[13px] font-medium text-slate-500 mt-1">Current period</span>
          </div>
        </BoardPanel>

        <BoardPanel className="p-5 flex flex-col justify-between h-[135px] relative overflow-hidden group transition-all duration-300 hover:shadow-md hover:-translate-y-1 hover:border-indigo-200 bg-gradient-to-b from-white to-indigo-50/10">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity translate-x-4 -translate-y-4">
            <IconHome size={100} stroke={1} />
          </div>
          <div className="flex items-center gap-3 relative z-10">
            <div className="size-8 rounded-xl bg-gradient-to-br from-indigo-50 to-indigo-100/50 text-indigo-600 flex items-center justify-center shadow-sm border border-indigo-200/50">
              <IconHome size={16} stroke={2.5} />
            </div>
            <span className="text-xs font-medium text-slate-500 uppercase tracking-widest">Expected Rent</span>
          </div>
          <div className="flex flex-col mt-auto relative z-10">
            <span className="text-[28px] font-mono font-normal tracking-tight text-indigo-700">
              KES {(metrics.expected / 1000000).toFixed(2)}M
            </span>
            <span className="text-[13px] font-medium text-slate-500 mt-1">June period</span>
          </div>
        </BoardPanel>

        <BoardPanel className="p-5 flex flex-col justify-between h-[135px] relative overflow-hidden group transition-all duration-300 hover:shadow-md hover:-translate-y-1 hover:border-amber-200 bg-gradient-to-b from-white to-amber-50/10">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity translate-x-4 -translate-y-4">
            <IconAlertTriangle size={100} stroke={1} />
          </div>
          <div className="flex items-center gap-3 relative z-10">
            <div className="size-8 rounded-xl bg-gradient-to-br from-amber-50 to-amber-100/50 text-amber-600 flex items-center justify-center shadow-sm border border-amber-200/50">
              <IconAlertTriangle size={16} stroke={2.5} />
            </div>
            <span className="text-xs font-medium text-slate-500 uppercase tracking-widest">Total Deficits</span>
          </div>
          <div className="flex flex-col mt-auto relative z-10">
            <span className="text-[28px] font-mono font-normal tracking-tight text-amber-700">
              KES {metrics.deficits.toLocaleString()}
            </span>
            <span className="text-[13px] font-medium text-amber-700 mt-1">
              {metrics.deficits > 0 ? "Action required" : "Clean ledger"}
            </span>
          </div>
        </BoardPanel>

        <BoardPanel className="p-5 flex flex-col justify-between h-[135px] relative overflow-hidden group transition-all duration-300 hover:shadow-md hover:-translate-y-1 hover:border-rose-200 bg-gradient-to-b from-white to-rose-50/10">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity translate-x-4 -translate-y-4">
            <IconClock size={100} stroke={1} />
          </div>
          <div className="flex items-center gap-3 relative z-10">
            <div className="size-8 rounded-xl bg-gradient-to-br from-rose-50 to-rose-100/50 text-rose-600 flex items-center justify-center shadow-sm border border-rose-200/50">
              <IconClock size={16} stroke={2.5} />
            </div>
            <span className="text-xs font-medium text-slate-500 uppercase tracking-widest">Vacancies / Defaulters</span>
          </div>
          <div className="flex flex-col mt-auto relative z-10">
            <span className="text-[28px] font-mono font-normal tracking-tight text-[#151936]">
              {metrics.vacantCount} <span className="text-[20px] text-slate-400">/</span> {metrics.defaulters}
            </span>
            <span className="text-[13px] font-medium text-slate-500 mt-1">Critical queues</span>
          </div>
        </BoardPanel>
      </section>

      {/* ── 4. Rent Collections Dual-Bar Recharts Chart ──────────────────────── */}
      <BoardPanel className="p-5 shadow-sm border-slate-200">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-[16px] font-medium text-slate-900">Rent Performance Trends</h3>
            <p className="text-base text-slate-500">Expected monthly rental projections compared with committed collections.</p>
          </div>
          <div className="flex items-center gap-4 text-xs font-medium">
            <span className="flex items-center gap-1.5 text-indigo-600">
              <span className="size-2 rounded-full bg-indigo-600" /> Expected
            </span>
            <span className="flex items-center gap-1.5 text-emerald-600">
              <span className="size-2 rounded-full bg-emerald-600" /> Collected
            </span>
          </div>
        </div>
        <div className="h-[240px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis
                stroke="#94a3b8"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `${(value / 1000000).toFixed(1)}M`}
              />
              <Tooltip
                contentStyle={{ background: "#151936", border: "none", borderRadius: "12px", color: "#fff" }}
                formatter={(value: unknown) => [`KES ${parseInt(value as string).toLocaleString()}`, ""]}
              />
              <Bar dataKey="Expected" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={32} />
              <Bar dataKey="Collected" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={32} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </BoardPanel>

      {/* ── 5. Segment Content Title & Queue ─────────────────────────────────── */}
      <div className="pt-2 my-2 animate-fade-in-up">
        <h2 className="title-serif text-slate-900 text-[22px] font-normal capitalize">
          {activeTab.replace(/-/g, " ")} Ledger Panel
        </h2>
        <p className="text-[12.5px] text-slate-500 font-medium tracking-wide mt-1">
          {activeTab === "collections" && "Registry detailing collections book for expected rent, collected rent, and reconciliation status."}
          {activeTab === "deficits" && "Filtered audit queue focusing on units with outstanding tenant deficit balances."}
          {activeTab === "vacancies" && "Pipeline monitoring vacant units with property manager handovers."}
          {activeTab === "defaulters" && "Arrears ledger detailing 30/60/90 day aging queues and active repayment plans."}
        </p>
      </div>

      <BoardPanel className="p-0 overflow-hidden shadow-sm border-slate-200 animate-fade-in-up">
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-white">
          <div>
            <h3 className="text-base  font-medium text-slate-900 tracking-tight">Active Accounts Queue</h3>
            <p className="mt-0.5 text-sm  text-slate-400">Click any row to reveal detailed ledger cards and historical statements.</p>
          </div>
          <Button variant="secondary" size="sm" className="bg-white border-slate-200">
            <IconChevronDown size={14} /> Export Queue
          </Button>
        </div>

        {paginatedRows.length > 0 ? (
          <>
            <div className="overflow-x-auto bg-white">
              <table className="w-full min-w-[760px] text-left text-sm  text-slate-600">
                <thead>
                  <tr className="border-b border-slate-100 text-sm font-medium uppercase tracking-wider text-slate-400">
                    <th className="px-5 py-3">Unit Code</th>
                    <th className="px-5 py-3">Property / Location</th>
                    <th className="px-5 py-3">Tenant</th>
                    {activeTab !== "vacancies" && <th className="px-5 py-3 text-right">Expected</th>}
                    {activeTab !== "vacancies" && <th className="px-5 py-3 text-right">Collected</th>}
                    {activeTab !== "vacancies" && <th className="px-5 py-3 text-right">Deficit</th>}
                    {activeTab === "defaulters" && <th className="px-5 py-3">Age</th>}
                    <th className="px-5 py-3">Status</th>
                    {activeTab === "defaulters" && <th className="px-5 py-3">Repayment Plan</th>}
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedRows.map((row) => (
                    <tr
                      key={row.id}
                      onClick={() => setSelectedUnit(row)}
                      className="transition-colors hover:bg-slate-50/80 cursor-pointer"
                    >
                      <td className="px-5 py-3.5 font-mono text-[12.5px] font-medium text-slate-900">
                        {row.unitCode}
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="text-base font-medium text-slate-800 leading-snug">{row.property}</p>
                        <p className="text-sm  text-slate-400 mt-0.5 flex items-center gap-1">
                          <IconMapPin size={12} className="text-slate-400" /> {row.location}
                        </p>
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="text-base font-medium text-slate-800">{row.tenantName}</p>
                        <span className="text-sm text-slate-400 font-medium">Period: {row.period}</span>
                      </td>
                      {activeTab !== "vacancies" && (
                        <td className="px-5 py-3.5 text-right font-mono text-[12.5px] font-medium text-slate-900">
                          KES {row.expectedRent.toLocaleString()}
                        </td>
                      )}
                      {activeTab !== "vacancies" && (
                        <td className="px-5 py-3.5 text-right font-mono text-[12.5px] font-medium text-emerald-700 bg-emerald-50/40">
                          KES {row.collectedRent.toLocaleString()}
                        </td>
                      )}
                      {activeTab !== "vacancies" && (
                        <td className={cn(
                          "px-5 py-3.5 text-right font-mono text-[12.5px] font-medium",
                          row.deficit > 0 ? "text-rose-600 bg-rose-50/30" : "text-slate-400"
                        )}>
                          {row.deficit > 0 ? `KES ${row.deficit.toLocaleString()}` : "—"}
                        </td>
                      )}
                      {activeTab === "defaulters" && (
                        <td className="px-5 py-3.5">
                          <span className={cn(
                            "px-2 py-0.5 rounded text-sm font-medium",
                            row.arrearsAge > 90 ? "bg-red-100 text-red-800" :
                              row.arrearsAge > 30 ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-800"
                          )}>
                            {row.arrearsAge} Days
                          </span>
                        </td>
                      )}
                      <td className="px-5 py-3.5">
                        <Badge
                          tone={
                            row.status === "Posted" ? "success" :
                              row.status === "Overdue" ? "risk" :
                                row.status === "Vacant" ? "warning" : "data"
                          }
                        >
                          {row.status}
                        </Badge>
                      </td>
                      {activeTab === "defaulters" && (
                        <td className="px-5 py-3.5">
                          {row.paymentPlan?.active ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 border border-emerald-200">
                              <IconCheck size={11} /> KES {row.paymentPlan.installment.toLocaleString()}/wk
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400 font-medium">None structured</span>
                          )}
                        </td>
                      )}
                      <td className="px-5 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          {row.status === "Vacant" ? (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => setEscalateUnit(row)}
                              className="text-amber-700 bg-amber-50 hover:bg-amber-100 border-amber-200/50"
                            >
                              Escalate Handover
                            </Button>
                          ) : (
                            <>
                              {row.deficit > 0 && (
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => openPayModalFor(row.id)}
                                  className="text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-200/50"
                                >
                                  Log Pay
                                </Button>
                              )}
                              {activeTab === "defaulters" && !row.paymentPlan?.active && (
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => openPlanModalFor(row.id)}
                                  className="text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border-indigo-200/50"
                                >
                                  Set Plan
                                </Button>
                              )}
                            </>
                          )}
                          <button
                            type="button"
                            onClick={() => setSelectedUnit(row)}
                            className="inline-flex size-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
                          >
                            <IconDotsVertical size={14} />
                          </button>
                        </div>
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
              label={`Showing ${filteredRows.length} rentals records`}
            />
          </>
        ) : (
          <div className="p-12 text-center bg-white">
            <p className="text-sm  text-slate-450 font-medium">No rentals matched your search or tab filter.</p>
          </div>
        )}
      </BoardPanel>

      {/* ── 6. Modals & Drawers ──────────────────────────────────────────────── */}

      {/* MODAL: Log Rent Payment */}
      <Modal
        open={isPayModalOpen}
        onClose={() => setIsPayModalOpen(false)}
        title="Log Rental Payment"
        description="Record a incoming rental credit and adjust deficits on the unit ledger."
      >
        <form onSubmit={handleLogPayment} className="space-y-4">
          <div>
            <label className="text-base font-medium text-slate-500 uppercase tracking-wider block mb-1">Select Rental Unit</label>
            <select
              value={payUnitId}
              onChange={(e) => openPayModalFor(e.target.value)}
              required
              className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-base text-slate-700 focus:outline-none focus:border-[#151936]"
            >
              <option value="">-- Choose Unit --</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.unitCode} - {u.property} (Bal: KES {u.deficit.toLocaleString()})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-base font-medium text-slate-500 uppercase tracking-wider block mb-1">Payment Amount (KES)</label>
              <input
                type="number"
                required
                placeholder="125000"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-base font-mono focus:outline-none focus:border-[#151936]"
              />
            </div>
            <div>
              <label className="text-base font-medium text-slate-500 uppercase tracking-wider block mb-1">Payment Method</label>
              <select
                value={payMethod}
                onChange={(e) => setPayMethod(e.target.value as PaymentRecord["method"])}
                className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-base text-slate-700 focus:outline-none focus:border-[#151936]"
              >
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="M-Pesa">M-Pesa</option>
                <option value="Cheque">Cheque</option>
                <option value="Cash">Cash</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-base font-medium text-slate-500 uppercase tracking-wider block mb-1">Transaction/Bank Reference</label>
            <input
              type="text"
              placeholder="e.g. MP-REF105-NBO"
              value={payRef}
              onChange={(e) => setPayRef(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-base font-mono focus:outline-none focus:border-[#151936]"
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-4">
            <Button type="button" variant="secondary" onClick={() => setIsPayModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="bg-[#f3df27] text-[#151936] hover:bg-[#e6d220]">
              {isSubmitting ? "Logging..." : "Log Credit"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: Set Payment Plan */}
      <Modal
        open={isPlanModalOpen}
        onClose={() => setIsPlanModalOpen(false)}
        title="Schedule Repayment Plan"
        description="Draft a weekly installment plan for outstanding tenant arrears."
      >
        <form onSubmit={handleSetPaymentPlan} className="space-y-4">
          <div>
            <label className="text-base font-medium text-slate-500 uppercase tracking-wider block mb-1">Defaulter Unit</label>
            <select
              value={planUnitId}
              onChange={(e) => setPlanUnitId(e.target.value)}
              required
              className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-base text-slate-700 focus:outline-none"
            >
              <option value="">-- Choose Account --</option>
              {units.filter(u => u.deficit > 0).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.unitCode} - {u.tenantName} (Arrears: KES {u.deficit.toLocaleString()})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-base font-medium text-slate-500 uppercase tracking-wider block mb-1">Weekly Installment (KES)</label>
              <input
                type="number"
                required
                value={planInstallment}
                onChange={(e) => setPlanInstallment(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-base font-mono focus:outline-none"
              />
            </div>
            <div>
              <label className="text-base font-medium text-slate-500 uppercase tracking-wider block mb-1">Plan Duration</label>
              <select
                value={planWeeks}
                onChange={(e) => setPlanWeeks(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-base text-slate-700 focus:outline-none"
              >
                <option value="4">4 Weeks (1 month)</option>
                <option value="6">6 Weeks</option>
                <option value="8">8 Weeks (2 months)</option>
                <option value="12">12 Weeks (3 months)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-base font-medium text-slate-500 uppercase tracking-wider block mb-1">Start Date</label>
            <input
              type="date"
              required
              value={planStartDate}
              onChange={(e) => setPlanStartDate(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-base focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-4">
            <Button type="button" variant="secondary" onClick={() => setIsPlanModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="bg-[#151936] text-white hover:bg-slate-800">
              {isSubmitting ? "Activating..." : "Activate Repayment Plan"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* CONFIRMATION: Vacancy Escalation */}
      <ConfirmDialog
        open={!!escalateUnit}
        onClose={() => setEscalateUnit(null)}
        onConfirm={handleEscalateLeasing}
        title="Escalate Unit Vacancy Handover?"
        description={
          escalateUnit
            ? `This will log a system request to property management for ${escalateUnit.unitCode} (${escalateUnit.property}) and initiate vacancy marketing.`
            : ""
        }
      />

      {/* DRAWER: Rental Unit Details */}
      <Drawer
        open={!!selectedUnit}
        onClose={() => setSelectedUnit(null)}
        title="Rental Account Details"
        width="32rem"
        footer={
          selectedUnit && (
            <div className="flex items-center justify-between w-full">
              <span className="text-base text-slate-400">Unit Code: {selectedUnit.unitCode}</span>
              <div className="flex items-center gap-1.5">
                {selectedUnit.deficit > 0 && (
                  <Button
                    size="sm"
                    onClick={() => {
                      const id = selectedUnit.id;
                      setSelectedUnit(null);
                      openPayModalFor(id);
                    }}
                    className="bg-[#f3df27] text-[#151936] hover:bg-[#e6d220]"
                  >
                    Log Payment
                  </Button>
                )}
                <Button variant="secondary" size="sm" onClick={() => setSelectedUnit(null)}>
                  Close
                </Button>
              </div>
            </div>
          )
        }
      >
        {selectedUnit && (
          <div className="space-y-6">

            {/* Top Property Profile */}
            <div className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-base  font-medium text-slate-900 leading-snug">{selectedUnit.property}</h4>
                  <p className="text-base text-slate-500 mt-1 flex items-center gap-1">
                    <IconMapPin size={12} /> {selectedUnit.location}
                  </p>
                </div>
                <Badge
                  tone={
                    selectedUnit.status === "Posted" ? "success" :
                      selectedUnit.status === "Overdue" ? "risk" :
                        selectedUnit.status === "Vacant" ? "warning" : "data"
                  }
                >
                  {selectedUnit.status}
                </Badge>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-3 border-t border-slate-100 pt-3">
                <div>
                  <span className="text-sm  text-slate-400 uppercase font-medium">Expected</span>
                  <p className="text-base font-mono font-medium text-slate-800 mt-0.5">KES {selectedUnit.expectedRent.toLocaleString()}</p>
                </div>
                <div>
                  <span className="text-sm  text-slate-400 uppercase font-medium">Collected</span>
                  <p className="text-base font-mono font-medium text-emerald-700 mt-0.5">KES {selectedUnit.collectedRent.toLocaleString()}</p>
                </div>
                <div>
                  <span className="text-sm  text-slate-400 uppercase font-medium">Arrears</span>
                  <p className={cn(
                    "text-base font-mono font-medium mt-0.5",
                    selectedUnit.deficit > 0 ? "text-rose-600" : "text-slate-400"
                  )}>
                    KES {selectedUnit.deficit.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            {/* Tenant details */}
            {selectedUnit.status !== "Vacant" && (
              <div className="border border-slate-150 rounded-xl p-4 bg-slate-50/50">
                <p className="text-sm text-slate-400 uppercase tracking-wider font-medium mb-3">Occupying Tenant</p>
                <div className="flex items-center gap-3">
                  <div className="size-9 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 shrink-0">
                    <IconUser size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-medium text-slate-800 leading-none mb-1">{selectedUnit.tenantName}</p>
                    <p className="text-sm text-slate-400 leading-none">Active Leaseholder</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button className="size-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-700 transition">
                      <IconPhone size={13} />
                    </button>
                    <button className="size-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-700 transition">
                      <IconMail size={13} />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Active Plan details */}
            {selectedUnit.paymentPlan?.active && (
              <div className="border border-indigo-100 rounded-xl p-4 bg-indigo-50/20">
                <p className="text-sm text-indigo-700 uppercase tracking-wider font-semibold mb-2">Active Arrears Payment Plan</p>
                <div className="flex justify-between text-xs text-slate-700 mt-1">
                  <span>Weekly Installment:</span>
                  <span className="font-mono font-medium">KES {selectedUnit.paymentPlan.installment.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs text-slate-700 mt-1">
                  <span>Duration structured:</span>
                  <span>{selectedUnit.paymentPlan.durationWeeks} Weeks</span>
                </div>
                <div className="flex justify-between text-xs text-slate-700 mt-1">
                  <span>Commenced:</span>
                  <span>{selectedUnit.paymentPlan.startDate}</span>
                </div>
              </div>
            )}

            {/* Payment History */}
            <div>
              <p className="text-sm text-slate-400 uppercase tracking-wider font-medium mb-3">Collections Receipt Ledger</p>
              {selectedUnit.payments.length > 0 ? (
                <div className="space-y-2">
                  {selectedUnit.payments.map((p) => (
                    <div key={p.id} className="flex items-center justify-between border border-slate-100 bg-white rounded-lg p-3 shadow-xs">
                      <div>
                        <p className="text-[12.5px] font-medium text-slate-800">KES {p.amount.toLocaleString()}</p>
                        <p className="text-sm text-slate-450 mt-0.5">Ref: {p.reference} ({p.method})</p>
                      </div>
                      <div className="text-right">
                        <span className="text-sm text-slate-400 font-mono">{p.date}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 border border-slate-100 border-dashed rounded-lg bg-slate-50/50">
                  <p className="text-xs text-slate-400 font-medium">No rent payments received in this cycle.</p>
                </div>
              )}
            </div>

          </div>
        )}
      </Drawer>
    </div>
  );
}
