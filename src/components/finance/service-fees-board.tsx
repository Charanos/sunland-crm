"use client";

import { useState, useMemo, useEffect } from "react";
import {
  IconSearch,
  IconPlus,
  IconFilter,
  IconChevronDown,
  IconCashBanknote,
  IconReceipt,
  IconClipboardCheck,
  IconDotsVertical,
  IconSettings,
  IconCheck,
  IconInfoCircle,
  IconBookUpload,
  IconBuilding
} from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast-provider";
import { Modal } from "@/components/ui/modal";
import { Drawer } from "@/components/ui/drawer";
import { FinanceModuleNav } from "@/components/finance/finance-module-nav";
import { BoardHeader, BoardPanel, Button, PaginationControls } from "@/components/ui/erp-primitives";
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

interface FeeRule {
  id: string;
  ruleCode: string;
  name: string;
  scope: string; // e.g. "Tenants", "Landlords", "Sales clients"
  type: "Percentage" | "Flat Rate";
  value: number; // e.g. 10 for 10%, or 5000 for KES 5000
  frequency: "Per Occurrence" | "Monthly" | "Annual";
  status: "Active" | "Draft";
}

interface FeeCharge {
  id: string;
  chargeCode: string;
  description: string;
  targetName: string; // tenant or landlord name
  propertyName: string;
  amount: number;
  status: "Posted" | "Pending";
  date: string;
  ruleLinked?: string;
  ledgerJournal?: string;
}

// ─── Initial Mock Data ────────────────────────────────────────────────────────

const INITIAL_RULES: FeeRule[] = [
  { id: "ru1", ruleCode: "FEE-R-01", name: "Letting Commission Fee", scope: "Landlords", type: "Percentage", value: 10, frequency: "Per Occurrence", status: "Active" },
  { id: "ru2", ruleCode: "FEE-R-02", name: "Late Rent Fine", scope: "Tenants", type: "Flat Rate", value: 12000, frequency: "Per Occurrence", status: "Active" },
  { id: "ru3", ruleCode: "FEE-R-03", name: "Lease Execution Charge", scope: "Tenants", type: "Flat Rate", value: 15000, frequency: "Per Occurrence", status: "Active" },
  { id: "ru4", ruleCode: "FEE-R-04", name: "Commercial Sale Commission", scope: "Sales clients", type: "Percentage", value: 5, frequency: "Per Occurrence", status: "Active" },
  { id: "ru5", ruleCode: "FEE-R-05", name: "Annual Valuation Retainer", scope: "Valuers clients", type: "Flat Rate", value: 85000, frequency: "Annual", status: "Draft" }
];

const INITIAL_CHARGES: FeeCharge[] = [
  { id: "ch1", chargeCode: "FEE-C-88", description: "Late Rent Fine - Apt 4B Westpoint", targetName: "Mary Wanjiku", propertyName: "Westpoint Apartments", amount: 12000, status: "Pending", date: "2026-06-20", ruleLinked: "Late Rent Fine" },
  { id: "ch2", chargeCode: "FEE-C-87", description: "Commercial Valuation - Kilimani Plaza", targetName: "Quick Logistics Ltd", propertyName: "Kilimani Business Center", amount: 185000, status: "Posted", date: "2026-06-18", ruleLinked: "Annual Valuation Retainer", ledgerJournal: "JE-1039" },
  { id: "ch3", chargeCode: "FEE-C-86", description: "Letting Commission - Runda Grove Villa", targetName: "Jacob Jones", propertyName: "Runda Grove Villa", amount: 213000, status: "Posted", date: "2026-06-10", ruleLinked: "Letting Commission Fee", ledgerJournal: "JE-1035" },
  { id: "ch4", chargeCode: "FEE-C-85", description: "Late Rent Fine - Unit C7 Riverside", targetName: "Global Trade Inc", propertyName: "Riverside Residences", amount: 12000, status: "Pending", date: "2026-06-05", ruleLinked: "Late Rent Fine" },
  { id: "ch5", chargeCode: "FEE-C-84", description: "Lease Preparation Fee - Gigiri Heights", targetName: "Dr. Arthur Morgan", propertyName: "Gigiri Heights", amount: 15000, status: "Pending", date: "2026-06-02", ruleLinked: "Lease Execution Charge" },
  { id: "ch6", chargeCode: "FEE-C-80", description: "Asset Valuation - Mombasa Depot", targetName: "Philip Omondi", propertyName: "Mombasa Gateway Complex", amount: 95000, status: "Posted", date: "2026-05-15", ruleLinked: "Annual Valuation Retainer", ledgerJournal: "JE-0982" }
];

const INITIAL_CHART_DATA = [
  { month: "Jan", Letting: 250000, Valuation: 185000, LateFee: 36000 },
  { month: "Feb", Letting: 190000, Valuation: 95000, LateFee: 48000 },
  { month: "Mar", Letting: 380000, Valuation: 280000, LateFee: 24000 },
  { month: "Apr", Letting: 290000, Valuation: 185000, LateFee: 60000 },
  { month: "May", Letting: 410000, Valuation: 95000, LateFee: 12000 },
  { month: "Jun", Letting: 213000, Valuation: 185000, LateFee: 39000 }
];

const ROWS_PER_PAGE = 5;

export function ServiceFeesBoard({ tabId = "rules" }: { tabId: string }) {
  const { pushToast } = useToast();
  const [mounted, setMounted] = useState(false);

  // Sync tab active segment
  const activeTab = tabId;

  // Search & pagination state
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);

  // Core Data States
  const [rules, setRules] = useState<FeeRule[]>(INITIAL_RULES);
  const [charges, setCharges] = useState<FeeCharge[]>(INITIAL_CHARGES);
  const [chartData, setChartData] = useState(INITIAL_CHART_DATA);

  // Modals & drawers state
  const [selectedCharge, setSelectedCharge] = useState<FeeCharge | null>(null);
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [postCharge, setPostCharge] = useState<FeeCharge | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State - Create Rule
  const [ruleName, setRuleName] = useState("");
  const [ruleScope, setRuleScope] = useState("Tenants");
  const [ruleType, setRuleType] = useState<FeeRule["type"]>("Percentage");
  const [ruleValue, setRuleValue] = useState("");
  const [ruleFrequency, setRuleFrequency] = useState<FeeRule["frequency"]>("Per Occurrence");

  useEffect(() => {
    const h = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(h);
  }, []);

  // --- Handlers ---

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleName || !ruleValue || parseFloat(ruleValue) <= 0) {
      pushToast({ tone: "error", title: "Validation Error", body: "Please fill in all rule specifications." });
      return;
    }

    setIsSubmitting(true);
    await new Promise(resolve => setTimeout(resolve, 500));

    const nextCode = `FEE-R-${10 + rules.length + 1}`;
    const newRule: FeeRule = {
      id: `rule-${Date.now()}`,
      ruleCode: nextCode,
      name: ruleName,
      scope: ruleScope,
      type: ruleType,
      value: parseFloat(ruleValue),
      frequency: ruleFrequency,
      status: "Active"
    };

    setRules(prev => [newRule, ...prev]);
    setIsRuleModalOpen(false);
    setRuleName("");
    setRuleValue("");
    setIsSubmitting(false);

    pushToast({
      tone: "success",
      title: "Fee Rule Configured",
      body: `Rule ${nextCode} - ${ruleName} is now active.`
    });
  };

  const handlePostToLedger = async () => {
    if (!postCharge) return;
    setIsSubmitting(true);
    // Simulate double-entry posting calculations
    await new Promise(resolve => setTimeout(resolve, 600));

    const mockJournal = `JE-${1000 + Math.floor(Math.random() * 50)}`;

    setCharges(prev =>
      prev.map(c => {
        if (c.id === postCharge.id) {
          return {
            ...c,
            status: "Posted",
            ledgerJournal: mockJournal
          };
        }
        return c;
      })
    );

    // Update June chart category details reactively
    const category = postCharge.description.includes("Late") ? "LateFee" : "Letting";
    setChartData(prev =>
      prev.map(c => (c.month === "Jun" ? { ...c, [category]: c[category] + postCharge.amount } : c))
    );

    setPostCharge(null);
    setIsSubmitting(false);

    pushToast({
      tone: "success",
      title: "Posted to General Ledger",
      body: `Journal ${mockJournal} committed. DR Accounts Receivable / CR Service Fee Income of KES ${postCharge.amount.toLocaleString()}.`
    });
  };

  // --- Calculations ---

  const metrics = useMemo(() => {
    const activeRulesCount = rules.filter(r => r.status === "Active").length;
    const totalFeesGenerated = charges.reduce((sum, c) => sum + c.amount, 0);
    const postedFees = charges.filter(c => c.status === "Posted").reduce((sum, c) => sum + c.amount, 0);
    const pendingPosting = charges.filter(c => c.status === "Pending").reduce((sum, c) => sum + c.amount, 0);
    const pendingCount = charges.filter(c => c.status === "Pending").length;

    return {
      activeRules: activeRulesCount,
      generated: totalFeesGenerated,
      posted: postedFees,
      pending: pendingPosting,
      pendingCount
    };
  }, [rules, charges]);

  // Scoped lists based on current tab segment
  const filteredRows = useMemo(() => {
    if (activeTab === "rules") {
      return rules.filter(r =>
        r.ruleCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.scope.toLowerCase().includes(searchQuery.toLowerCase())
      );
    } else {
      return charges.filter(c =>
        c.chargeCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.targetName.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
  }, [rules, charges, activeTab, searchQuery]);

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
        title="Service Fees Control"
        description="Configure automated letting commission rules, audit late rent penalty logs, and post statutory valuation bills to the double-entry general ledger."
        meta={
          <span className="hidden text-base text-slate-400 md:inline">
            Active Concern: <span className="font-mono text-slate-600">Company Revenue streams</span>
          </span>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex h-9 min-w-[240px] items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 shadow-sm focus-within:border-[#151936] transition-colors">
              <IconSearch size={14} className="text-slate-400" />
              <input
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                placeholder={activeTab === "rules" ? "Search fee rules..." : "Search charge logs..."}
                className="w-full bg-transparent text-slate-700 outline-none placeholder:text-slate-400 text-base"
              />
            </div>
            <Button variant="secondary" size="sm" className="bg-white border-slate-200 shadow-sm">
              <IconFilter size={14} /> Filters
            </Button>
            {activeTab === "rules" ? (
              <Button
                size="sm"
                onClick={() => setIsRuleModalOpen(true)}
                className="bg-[#f3df27] text-[#151936] hover:bg-[#e6d220] shadow-sm"
              >
                <IconPlus size={14} stroke={2.5} /> Create Fee Rule
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => setPostCharge(charges.find(c => c.status === "Pending") || null)}
                className="bg-[#151936] text-white hover:bg-slate-800 shadow-sm"
              >
                <IconBookUpload size={14} /> Quick Ledger Post
              </Button>
            )}
          </div>
        }
      />

      {/* ── 2. Navigation Pill Selector ──────────────────────────────────────── */}
      <FinanceModuleNav />

      {/* ── 3. KPI Segment Cards ─────────────────────────────────────────────── */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4" aria-label="Fees key metrics">
        <BoardPanel className="p-5 flex flex-col justify-between h-[135px] relative overflow-hidden group transition-all duration-300 hover:shadow-md hover:-translate-y-1 hover:border-indigo-200 bg-gradient-to-b from-white to-indigo-50/10">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity translate-x-4 -translate-y-4">
            <IconSettings size={100} stroke={1} />
          </div>
          <div className="flex items-center gap-3 relative z-10">
            <div className="size-8 rounded-xl bg-gradient-to-br from-indigo-50 to-indigo-100/50 text-indigo-600 flex items-center justify-center shadow-sm border border-indigo-200/50">
              <IconSettings size={16} stroke={2.5} />
            </div>
            <span className="text-slate-400 label-caps">Active Rules</span>
          </div>
          <div className="flex flex-col mt-auto relative z-10">
            <span className="font-mono font-normal tracking-tight text-[#151936] text-3xl">
              {metrics.activeRules} <span className="text-slate-400 text-xl">Rules</span>
            </span>
            <span className="mt-1 text-desc-secondary">Billing logic profiles</span>
          </div>
        </BoardPanel>

        <BoardPanel className="p-5 flex flex-col justify-between h-[135px] relative overflow-hidden group transition-all duration-300 hover:shadow-md hover:-translate-y-1 hover:border-emerald-200 bg-gradient-to-b from-white to-emerald-50/10">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity translate-x-4 -translate-y-4">
            <IconCashBanknote size={100} stroke={1} />
          </div>
          <div className="flex items-center gap-3 relative z-10">
            <div className="size-8 rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100/50 text-emerald-600 flex items-center justify-center shadow-sm border border-emerald-200/50">
              <IconCashBanknote size={16} stroke={2.5} />
            </div>
            <span className="text-slate-400 label-caps">Total Fees Earned</span>
          </div>
          <div className="flex flex-col mt-auto relative z-10">
            <span className="font-mono font-normal tracking-tight text-emerald-700 text-3xl">
              KES {metrics.generated.toLocaleString()}
            </span>
            <span className="mt-1 text-desc-secondary">Accumulated income</span>
          </div>
        </BoardPanel>

        <BoardPanel className="p-5 flex flex-col justify-between h-[135px] relative overflow-hidden group transition-all duration-300 hover:shadow-md hover:-translate-y-1 hover:border-emerald-200 bg-gradient-to-b from-white to-emerald-50/10">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity translate-x-4 -translate-y-4">
            <IconClipboardCheck size={100} stroke={1} />
          </div>
          <div className="flex items-center gap-3 relative z-10">
            <div className="size-8 rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100/50 text-emerald-600 flex items-center justify-center shadow-sm border border-emerald-200/50">
              <IconClipboardCheck size={16} stroke={2.5} />
            </div>
            <span className="text-slate-400 label-caps">Posted to Ledger</span>
          </div>
          <div className="flex flex-col mt-auto relative z-10">
            <span className="font-mono font-normal tracking-tight text-emerald-700 text-3xl">
              KES {metrics.posted.toLocaleString()}
            </span>
            <span className="font-medium text-emerald-700 mt-1 text-sm">Reconciled lines</span>
          </div>
        </BoardPanel>

        <BoardPanel className="p-5 flex flex-col justify-between h-[135px] relative overflow-hidden group transition-all duration-300 hover:shadow-md hover:-translate-y-1 hover:border-amber-200 bg-gradient-to-b from-white to-amber-50/10">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity translate-x-4 -translate-y-4">
            <IconReceipt size={100} stroke={1} />
          </div>
          <div className="flex items-center gap-3 relative z-10">
            <div className="size-8 rounded-xl bg-gradient-to-br from-amber-50 to-amber-100/50 text-amber-600 flex items-center justify-center shadow-sm border border-amber-200/50">
              <IconReceipt size={16} stroke={2.5} />
            </div>
            <span className="text-slate-400 label-caps">Awaiting Ledger Posting</span>
          </div>
          <div className="flex flex-col mt-auto relative z-10">
            <span className="font-mono font-normal tracking-tight text-amber-700 text-3xl">
              KES {metrics.pending.toLocaleString()}
            </span>
            <span className="font-medium text-amber-700 mt-1 text-sm">{metrics.pendingCount} charges queue</span>
          </div>
        </BoardPanel>
      </section>

      {/* ── 4. Service Fees Breakdown Recharts Stacked Chart ────────────────── */}
      <BoardPanel className="p-5 shadow-sm border-slate-200">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-sans text-heading-primary">Monthly Fee Earnings Categories</h3>
            <p className="text-base text-slate-400 font-sans">Revenue generated grouped by letting fee, valuation, and late penalties.</p>
          </div>
          <div className="flex items-center gap-4 font-medium text-sm">
            <span className="flex items-center gap-1.5 text-emerald-600">
              <span className="size-2 rounded-full bg-emerald-600" /> Letting Comm.
            </span>
            <span className="flex items-center gap-1.5 text-indigo-600">
              <span className="size-2 rounded-full bg-indigo-600" /> Valuations
            </span>
            <span className="flex items-center gap-1.5 text-amber-600">
              <span className="size-2 rounded-full bg-amber-600" /> Late Fees
            </span>
          </div>
        </div>
        <div className="h-[230px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis
                stroke="#94a3b8"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`}
              />
              <Tooltip
                contentStyle={{ background: "#151936", border: "none", borderRadius: "12px", color: "#fff" }}
                formatter={(value: unknown) => [`KES ${parseInt(value as string).toLocaleString()}`, ""]}
              />
              <Bar dataKey="Letting" stackId="a" fill="#10b981" maxBarSize={28} />
              <Bar dataKey="Valuation" stackId="a" fill="#6366f1" maxBarSize={28} />
              <Bar dataKey="LateFee" stackId="a" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </BoardPanel>

      {/* ── 5. Segment Content Title & Queue ─────────────────────────────────── */}
      <div className="pt-2 my-2 animate-fade-in-up">
        <h2 className="title-serif text-slate-900 font-normal capitalize">
          {activeTab.replace(/-/g, " ")} Panel
        </h2>
        <p className="text-desc-secondary mt-1">
          {activeTab === "rules" && "Registry of configurable service fee logic determining letting commission, late penalties, and sales commission parameters."}
          {activeTab === "charges" && "Audit registry of generated billing charges. Click Post on any line to audit ledger entry impacts."}
        </p>
      </div>

      <BoardPanel className="p-0 overflow-hidden shadow-sm border-slate-200 animate-fade-in-up">
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-white">
          <div>
            <h3 className="text-title-primary">
              {activeTab === "rules" ? "Billing Logic Registry" : "Service Charges Queue"}
            </h3>
            <p className="mt-0.5 text-sm  text-slate-400">
              {activeTab === "rules"
                ? "Manage flat or percentage commission rules applicable across property portfolios."
                : "Audited charges await ledger postings. Verify ledger codes before posting."}
            </p>
          </div>
          <Button variant="secondary" size="sm" className="bg-white border-slate-200">
            <IconChevronDown size={14} /> Export List
          </Button>
        </div>

        {paginatedRows.length > 0 ? (
          <>
            <div className="overflow-x-auto bg-white">
              {activeTab === "rules" ? (
                /* Rules Table */
                <table className="w-full min-w-[760px] text-left text-body-regular">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 label-caps">
                      <th className="px-5 py-3">Rule Code</th>
                      <th className="px-5 py-3">Rule Name</th>
                      <th className="px-5 py-3">Scope / target</th>
                      <th className="px-5 py-3">Billing frequency</th>
                      <th className="px-5 py-3 text-right">Value / structure</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(paginatedRows as FeeRule[]).map((r) => (
                      <tr key={r.id} className="transition-colors hover:bg-slate-50/50">
                        <td className="px-5 py-3.5 text-slate-900 mono-data">
                          {r.ruleCode}
                        </td>
                        <td className="px-5 py-3.5">
                          <p className="text-title-primary">{r.name}</p>
                        </td>
                        <td className="px-5 py-3.5 text-slate-600 text-base">
                          {r.scope}
                        </td>
                        <td className="px-5 py-3.5 text-slate-600 text-base">
                          {r.frequency}
                        </td>
                        <td className="px-5 py-3.5 text-right text-slate-800 mono-data">
                          {r.type === "Percentage" ? `${r.value}% commission` : `KES ${r.value.toLocaleString()} flat`}
                        </td>
                        <td className="px-5 py-3.5">
                          <Badge tone={r.status === "Active" ? "success" : "data"}>{r.status}</Badge>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <button
                            type="button"
                            className="inline-flex size-7 items-center justify-center rounded-lg text-slate-450 hover:bg-slate-100 hover:text-slate-700 transition"
                          >
                            <IconDotsVertical size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                /* Charges Table */
                <table className="w-full min-w-[760px] text-left text-body-regular">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 label-caps">
                      <th className="px-5 py-3">Charge Code</th>
                      <th className="px-5 py-3">Description / Property</th>
                      <th className="px-5 py-3">Account / client</th>
                      <th className="px-5 py-3 text-right">Amount</th>
                      <th className="px-5 py-3">Date</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3">Ledger Posting</th>
                      <th className="px-5 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(paginatedRows as FeeCharge[]).map((c) => (
                      <tr
                        key={c.id}
                        onClick={() => setSelectedCharge(c)}
                        className="transition-colors hover:bg-slate-50/80 cursor-pointer"
                      >
                        <td className="px-5 py-3.5 text-slate-900 mono-data">
                          {c.chargeCode}
                        </td>
                        <td className="px-5 py-3.5">
                          <p className="text-title-primary leading-snug">{c.description}</p>
                          <p className="text-sm text-slate-400 mt-0.5 flex items-center gap-1">
                            <IconBuilding size={12} /> {c.propertyName}
                          </p>
                        </td>
                        <td className="px-5 py-3.5 text-slate-850 text-base">
                          {c.targetName}
                        </td>
                        <td className="px-5 py-3.5 text-right text-slate-900 mono-data">
                          KES {c.amount.toLocaleString()}
                        </td>
                        <td className="px-5 py-3.5 font-mono text-sm text-slate-400">
                          {c.date}
                        </td>
                        <td className="px-5 py-3.5">
                          <Badge tone={c.status === "Posted" ? "success" : "warning"}>{c.status}</Badge>
                        </td>
                        <td className="px-5 py-3.5 font-mono text-sm ">
                          {c.ledgerJournal ? (
                            <span className="text-slate-800 font-medium bg-slate-50 border border-slate-200/60 px-1.5 py-0.5 rounded">
                              {c.ledgerJournal}
                            </span>
                          ) : (
                            <span className="text-amber-600 font-medium">Awaiting post</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            {c.status === "Pending" && (
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => setPostCharge(c)}
                                className="text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-200/50 flex items-center gap-1 font-medium"
                              >
                                <IconBookUpload size={12} /> Post to GL
                              </Button>
                            )}
                            <button
                              type="button"
                              onClick={() => setSelectedCharge(c)}
                              className="inline-flex size-7 items-center justify-center rounded-lg text-slate-450 hover:bg-slate-100 hover:text-slate-700 transition"
                            >
                              <IconDotsVertical size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <PaginationControls
              currentPage={page}
              totalPages={totalPages}
              onPageChange={setPage}
              label={`Showing ${filteredRows.length} records`}
            />
          </>
        ) : (
          <div className="p-12 text-center bg-white">
            <p className="text-sm  text-slate-450 font-medium">No fee records found in this view.</p>
          </div>
        )}
      </BoardPanel>

      {/* ── 6. Modals & Drawers ──────────────────────────────────────────────── */}

      {/* MODAL: Create Fee Rule */}
      <Modal
        open={isRuleModalOpen}
        onClose={() => setIsRuleModalOpen(false)}
        title="Configure Billing Fee Rule"
        description="Establish new commercial logic parameters for service collections."
      >
        <form onSubmit={handleCreateRule} className="space-y-4">
          <div>
            <label className="uppercase tracking-wider block mb-1 text-desc-secondary">Rule/Commission Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Sales Agent Commission Split"
              value={ruleName}
              onChange={(e) => setRuleName(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-base focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="uppercase tracking-wider block mb-1 text-desc-secondary">Target Scope</label>
              <select
                value={ruleScope}
                onChange={(e) => setRuleScope(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-base text-slate-700 focus:outline-none"
              >
                <option value="Tenants">Tenants</option>
                <option value="Landlords">Landlords</option>
                <option value="Sales clients">Sales Clients</option>
                <option value="Valuers clients">Valuers Clients</option>
              </select>
            </div>
            <div>
              <label className="uppercase tracking-wider block mb-1 text-desc-secondary">Billing Frequency</label>
              <select
                value={ruleFrequency}
                onChange={(e) => setRuleFrequency(e.target.value as FeeRule["frequency"])}
                className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-base text-slate-700 focus:outline-none"
              >
                <option value="Per Occurrence">Per Occurrence</option>
                <option value="Monthly">Monthly</option>
                <option value="Annual">Annual</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="uppercase tracking-wider block mb-1 text-desc-secondary">Billing Method</label>
              <select
                value={ruleType}
                onChange={(e) => setRuleType(e.target.value as FeeRule["type"])}
                className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-base text-slate-700 focus:outline-none"
              >
                <option value="Percentage">Percentage of value (%)</option>
                <option value="Flat Rate">Flat Rate (KES)</option>
              </select>
            </div>
            <div>
              <label className="uppercase tracking-wider block mb-1 text-desc-secondary">
                {ruleType === "Percentage" ? "Percentage Rate (%)" : "Flat Rate (KES)"}
              </label>
              <input
                type="number"
                required
                placeholder={ruleType === "Percentage" ? "10" : "5000"}
                value={ruleValue}
                onChange={(e) => setRuleValue(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white p-2.5 focus:outline-none mono-data"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2.5 pt-4">
            <Button type="button" variant="secondary" onClick={() => setIsRuleModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="bg-[#f3df27] text-[#151936] hover:bg-[#e6d220]">
              {isSubmitting ? "Activating..." : "Deploy Billing Rule"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: Post Charge to General Ledger */}
      {postCharge && (
        <Modal
          open={!!postCharge}
          onClose={() => setPostCharge(null)}
          title="Commit Charge to General Ledger"
          description="Record a double-entry ledger posting transaction for this service charge."
        >
          <div className="space-y-4">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60 space-y-2.5 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400 font-medium">Charge Reference:</span>
                <span className="text-value-mono">{postCharge.chargeCode}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-medium">Fee Description:</span>
                <span className="font-medium text-slate-900">{postCharge.description}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-medium">Account Total:</span>
                <span className="text-value-mono">KES {postCharge.amount.toLocaleString()}</span>
              </div>
            </div>

            {/* Simulated journal lines preview */}
            <div>
              <p className="text-slate-400 font-normal mb-2 label-caps">Double-Entry Journal Accrual lines</p>
              <div className="border border-slate-200 rounded-lg overflow-hidden font-mono bg-white text-sm">
                <div className="grid grid-cols-[180px_1fr_80px_80px] bg-slate-50 p-2 font-sans border-b border-slate-200 text-desc-secondary">
                  <span>Account</span>
                  <span>Memo</span>
                  <span className="text-right">Debit</span>
                  <span className="text-right">Credit</span>
                </div>
                <div className="grid grid-cols-[180px_1fr_80px_80px] p-2 border-b border-slate-100">
                  <span className="text-slate-800">1200 - Accounts Receivable</span>
                  <span className="text-slate-550">Fee accrual: {postCharge.chargeCode}</span>
                  <span className="text-right text-slate-900">{postCharge.amount.toLocaleString()}</span>
                  <span className="text-right text-slate-350">-</span>
                </div>
                <div className="grid grid-cols-[180px_1fr_80px_80px] p-2">
                  <span className="text-slate-800">4001 - Management Fee Income</span>
                  <span className="text-slate-550">Accrued fee earnings</span>
                  <span className="text-right text-slate-350">-</span>
                  <span className="text-right text-emerald-700">{postCharge.amount.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-4">
              <Button type="button" variant="secondary" onClick={() => setPostCharge(null)}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handlePostToLedger}
                disabled={isSubmitting}
                className="bg-[#151936] text-white hover:bg-slate-800"
              >
                {isSubmitting ? "Accruing..." : "Post General Ledger Lines"}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* DRAWER: Charge Audit Info */}
      <Drawer
        open={!!selectedCharge}
        onClose={() => setSelectedCharge(null)}
        title="Service Charge Audit Panel"
        width="32rem"
        footer={
          selectedCharge && (
            <div className="flex items-center justify-between w-full">
              <span className="text-base text-slate-400">Ref: {selectedCharge.chargeCode}</span>
              <div className="flex items-center gap-1.5">
                {selectedCharge.status === "Pending" && (
                  <Button
                    size="sm"
                    onClick={() => {
                      const c = selectedCharge;
                      setSelectedCharge(null);
                      setPostCharge(c);
                    }}
                    className="bg-[#f3df27] text-[#151936] hover:bg-[#e6d220] shadow-xs"
                  >
                    Post to Ledger
                  </Button>
                )}
                <Button variant="secondary" size="sm" onClick={() => setSelectedCharge(null)}>
                  Close
                </Button>
              </div>
            </div>
          )
        }
      >
        {selectedCharge && (
          <div className="space-y-6">

            {/* Charge Profile */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h4 className="font-medium text-slate-800 leading-snug text-label">{selectedCharge.description}</h4>
              <p className="text-sm  text-slate-400 mt-1 flex items-center gap-1">
                <IconBuilding size={12} /> {selectedCharge.propertyName}
              </p>

              <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 text-sm">
                <div className="flex justify-between py-1 border-b border-slate-100/60">
                  <span className="text-slate-400">Accrued Amount:</span>
                  <span className="text-value-mono">KES {selectedCharge.amount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100/60">
                  <span className="text-slate-400">Charge Date:</span>
                  <span className="text-value-mono">{selectedCharge.date}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100/60">
                  <span className="text-slate-400">Originating Rule:</span>
                  <span className="font-medium text-slate-900">{selectedCharge.ruleLinked || "Manual custom fee"}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100/60">
                  <span className="text-slate-400">Client / Target Name:</span>
                  <span className="font-medium text-slate-900">{selectedCharge.targetName}</span>
                </div>
              </div>
            </div>

            {/* Posting Status */}
            {selectedCharge.ledgerJournal ? (
              <div className="rounded-xl border border-indigo-150 bg-indigo-50/10 p-3.5 text-slate-700 space-y-1.5 text-sm">
                <p className="font-normal text-indigo-700 flex items-center gap-1 leading-none label-caps">
                  <IconCheck size={12} stroke={3} /> ACCRUED & POSTED TO LEDGER
                </p>
                <div className="flex justify-between pt-1 text-sm">
                  <span className="text-slate-400 font-medium">Double-Entry Journal:</span>
                  <span className="font-mono font-normal text-indigo-700 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded">
                    {selectedCharge.ledgerJournal}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400 font-medium">Mapped Accounts:</span>
                  <span className="font-medium text-slate-800">DR 1200 Receivables / CR 4001 Revenues</span>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/40 p-4 text-center text-slate-400 font-medium text-sm">
                This charge has not been committed to the general ledger yet. Accounts receivable balances remain un-adjusted.
              </div>
            )}

            {/* Auditing Context info */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-250/60 text-slate-650 flex items-start gap-2 text-sm">
              <IconInfoCircle size={15} className="shrink-0 text-slate-400 mt-0.5" />
              <span>Service fee charges are generated based on system events (e.g. lease execution, rent overdue triggers) and must be posted to the double-entry books during the monthly close process.</span>
            </div>

          </div>
        )}
      </Drawer>
    </div>
  );
}
