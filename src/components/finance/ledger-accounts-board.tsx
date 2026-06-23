"use client";

import { useState, useMemo, useEffect } from "react";
import {
  IconSearch,
  IconPlus,
  IconFilter,
  IconArrowBackUp,
  IconScale,
  IconFileExport,
  IconTrash,
  IconEye,
  IconInfoCircle,
  IconShieldCheck,
  IconAdjustments,
  IconCalendarStats
} from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast-provider";
import { cn } from "@/lib/utils/cn";
import { useUIStore } from "@/store/ui";
import { FinanceModuleNav } from "@/components/finance/finance-module-nav";
import { Modal } from "@/components/ui/modal";
import { Drawer } from "@/components/ui/drawer";
import { BoardHeader, BoardPanel, Button, PaginationControls } from "@/components/ui/erp-primitives";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Legend
} from "recharts";

// ─── Interfaces ──────────────────────────────────────────────────────────────

interface JournalLine {
  account: string;
  type: "debit" | "credit";
  amount: number;
}

interface ActivityLog {
  time: string;
  user: string;
  action: string;
}

interface JournalEntry {
  id: string;
  date: string;
  memo: string;
  debit: number;
  credit: number;
  status: "Posted" | "Voided";
  user: string;
  lines: JournalLine[];
  logs: ActivityLog[];
}

interface Account {
  id: string;
  name: string;
  type: "Asset" | "Liability" | "Equity" | "Revenue" | "Expense";
  balance: number;
}

// ─── Initial Data Registry ───────────────────────────────────────────────────

const INITIAL_CHART_OF_ACCOUNTS: Account[] = [
  { id: "1001", name: "NCBA Operating Account", type: "Asset", balance: 48500000 },
  { id: "1200", name: "Accounts Receivable", type: "Asset", balance: 6400000 },
  { id: "2100", name: "Rent Payable to Landlords", type: "Liability", balance: 22400000 },
  { id: "3000", name: "Retained Earnings", type: "Equity", balance: 28380000 },
  { id: "4001", name: "Management Fee Income", type: "Revenue", balance: 3200000 },
  { id: "4002", name: "Lease Execution Fees", type: "Revenue", balance: 850000 },
  { id: "5001", name: "Office Petty Cash", type: "Expense", balance: 120000 },
  { id: "5100", name: "Staff Travel Expense", type: "Expense", balance: 10000 },
];

const INITIAL_JOURNALS: JournalEntry[] = [
  {
    id: "JE-1042",
    date: "2026-06-21",
    memo: "Rent Collection & Management Fee Allocation - Unit 4B Runda",
    debit: 150000,
    credit: 150000,
    status: "Posted",
    user: "J. Mutua",
    lines: [
      { account: "NCBA Operating Account", type: "debit", amount: 150000 },
      { account: "Rent Payable to Landlords", type: "credit", amount: 135000 },
      { account: "Management Fee Income", type: "credit", amount: 15000 },
    ],
    logs: [
      { time: "10:14 AM", user: "J. Mutua", action: "Posted entry via Rentals Module" }
    ]
  },
  {
    id: "JE-1041",
    date: "2026-06-20",
    memo: "Office Petty Cash Replenishment",
    debit: 50000,
    credit: 50000,
    status: "Posted",
    user: "P. Omondi",
    lines: [
      { account: "Office Petty Cash", type: "debit", amount: 50000 },
      { account: "NCBA Operating Account", type: "credit", amount: 50000 },
    ],
    logs: [
      { time: "09:00 AM", user: "P. Omondi", action: "Created and posted entry" }
    ]
  },
  {
    id: "JE-1040",
    date: "2026-06-19",
    memo: "Duplicate posting reversal",
    debit: 200000,
    credit: 200000,
    status: "Voided",
    user: "J. Mutua",
    lines: [
      { account: "Accounts Receivable", type: "debit", amount: 200000 },
      { account: "Management Fee Income", type: "credit", amount: 200000 },
    ],
    logs: [
      { time: "08:15 AM", user: "Finance Head", action: "Voided entry. Reason: Reversing duplicate." },
      { time: "08:10 AM", user: "J. Mutua", action: "Posted entry" }
    ]
  }
];

const ROWS_PER_PAGE = 8;

export function LedgerAccountsBoard({ tabId = "journal-entries" }: { tabId: string; entityId?: string }) {
  const { activeEntityId } = useUIStore();
  const { pushToast } = useToast();
  const [mounted, setMounted] = useState(false);

  // Sync route param tabId to localized active tab segment
  const activeTab = tabId;

  // Search & Pagination state
  const [searchQuery, setSearchQuery] = useState("");
  const [coaSearchQuery, setCoaSearchQuery] = useState("");
  const [coaTypeFilter, setCoaTypeFilter] = useState<string>("All");
  const [selectedCoaAccount, setSelectedCoaAccount] = useState<Account | null>(null);
  const [page, setPage] = useState(1);

  // Data States
  const [journals, setJournals] = useState<JournalEntry[]>(INITIAL_JOURNALS);
  const [coa, setCoa] = useState<Account[]>(INITIAL_CHART_OF_ACCOUNTS);

  // Modals & Drawer states
  const [isNewJournalOpen, setIsNewJournalOpen] = useState(false);
  const [isNewAccountOpen, setIsNewAccountOpen] = useState(false);
  const [selectedJournal, setSelectedJournal] = useState<JournalEntry | null>(null);
  const [voidConfirmId, setVoidConfirmId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State - New Journal
  const [newJournalMemo, setNewJournalMemo] = useState("");
  const [newJournalLines, setNewJournalLines] = useState([
    { id: "1", account: "", debit: "", credit: "", memo: "" },
    { id: "2", account: "", debit: "", credit: "", memo: "" }
  ]);

  // Form State - New Account
  const [newAccId, setNewAccId] = useState("");
  const [newAccName, setNewAccName] = useState("");
  const [newAccType, setNewAccType] = useState<Account["type"]>("Asset");
  const [newAccBalance, setNewAccBalance] = useState("");

  // --- Enhanced Ledger Statement States ---
  const [auditSeal, setAuditSeal] = useState<{
    sealed: boolean;
    hash: string;
    timestamp: string;
    auditor: string;
  } | null>(null);

  const [reconciliationAccount, setReconciliationAccount] = useState<Account | null>(null);
  const [bankStatementBalance, setBankStatementBalance] = useState<string>("");
  const [reconNotes, setReconNotes] = useState<string>("");
  const [matchedTxIds, setMatchedTxIds] = useState<string[]>([]);
  const [reconciliationHistory, setReconciliationHistory] = useState<Record<string, Array<{
    date: string;
    statementBalance: number;
    ledgerBalance: number;
    variance: number;
    notes: string;
    matchedCount: number;
  }>>>({});

  const [cashFlowLines, setCashFlowLines] = useState([
    { id: "cf1", name: "Management Fee Collections", amount: 3200000, category: "Operating" as "Operating" | "Investing" | "Financing" },
    { id: "cf2", name: "Lease Execution Collections", amount: 850000, category: "Operating" as "Operating" | "Investing" | "Financing" },
    { id: "cf3", name: "Office Petty Cash Disbursements", amount: -120000, category: "Operating" as "Operating" | "Investing" | "Financing" },
    { id: "cf4", name: "Staff Travel Disbursements", amount: -10000, category: "Operating" as "Operating" | "Investing" | "Financing" },
    { id: "cf5", name: "Landlord Remittance Disbursements", amount: -22400000, category: "Financing" as "Operating" | "Investing" | "Financing" },
    { id: "cf6", name: "Capital Equipment Purchases", amount: 0, category: "Investing" as "Operating" | "Investing" | "Financing" }
  ]);

  const [reclassLine, setReclassLine] = useState<{
    id: string;
    name: string;
    amount: number;
    category: "Operating" | "Investing" | "Financing";
  } | null>(null);

  const [forecastHorizon, setForecastHorizon] = useState<30 | 60 | 90>(30);
  const [expectedMonthlyCollections, setExpectedMonthlyCollections] = useState<number>(4500000);
  const [expectedMonthlyExpenses, setExpectedMonthlyExpenses] = useState<number>(1800000);

  // --- Enhanced Statement Handlers ---
  const handleSealLedger = () => {
    const timestamp = new Date().toLocaleString();
    const mockHash = "SHA256-" + Math.random().toString(36).substring(2, 10).toUpperCase() + Math.random().toString(36).substring(2, 10).toUpperCase();
    setAuditSeal({
      sealed: true,
      hash: mockHash,
      timestamp,
      auditor: "F. Officer (Audit Signoff)"
    });
    pushToast({
      tone: "success",
      title: "Ledger Sealed & Verified",
      body: `Cryptographic audit stamp registered: ${mockHash.substring(0, 14)}...`
    });
  };

  const handlePostAdjustingShortcut = () => {
    setNewJournalMemo("Adjusting Entry: Month-End Accruals & Prepaid Adjustments");
    setNewJournalLines([
      { id: "1", account: "Accounts Receivable", debit: "185000", credit: "", memo: "Accrued commission income" },
      { id: "2", account: "Management Fee Income", debit: "", credit: "185000", memo: "Accrued fee recognition" }
    ]);
    setIsNewJournalOpen(true);
    pushToast({
      tone: "info",
      title: "Adjusting Entry Form Pre-filled",
      body: "Manual journal modal opened with standard adjusting template."
    });
  };

  const handleSaveReconciliation = () => {
    if (!reconciliationAccount) return;
    const stmtBal = parseFloat(bankStatementBalance) || 0;
    const variance = stmtBal - reconciliationAccount.balance;
    const record = {
      date: new Date().toLocaleString(),
      statementBalance: stmtBal,
      ledgerBalance: reconciliationAccount.balance,
      variance,
      notes: reconNotes || "No notes written.",
      matchedCount: matchedTxIds.length
    };

    setReconciliationHistory(prev => ({
      ...prev,
      [reconciliationAccount.id]: [record, ...(prev[reconciliationAccount.id] || [])]
    }));

    pushToast({
      tone: "success",
      title: "Reconciliation Complete",
      body: `Audit log recorded for account ${reconciliationAccount.id} with variance KES ${variance.toLocaleString()}.`
    });

    setReconciliationAccount(null);
    setBankStatementBalance("");
    setReconNotes("");
    setMatchedTxIds([]);
  };

  const handleReclassifyLine = (newCategory: "Operating" | "Investing" | "Financing") => {
    if (!reclassLine) return;
    setCashFlowLines(prev =>
      prev.map(line =>
        line.id === reclassLine.id ? { ...line, category: newCategory } : line
      )
    );
    setReclassLine(null);
    pushToast({
      tone: "success",
      title: "Cash Movement Reclassified",
      body: `"${reclassLine.name}" moved to ${newCategory} activities.`
    });
  };

  useEffect(() => {
    const handle = setTimeout(() => {
      setMounted(true);
    }, 0);
    return () => clearTimeout(handle);
  }, []);

  // Recalculate context filter (Group vs Commercial Ledger)
  const entityLabel = activeEntityId === "commercial" ? "Commercial Ledger" : "Consolidated Ledger";

  // Filter Chart of Accounts
  const filteredCoa = useMemo(() => {
    return coa.filter(acc => {
      const matchesSearch = acc.id.toLowerCase().includes(coaSearchQuery.toLowerCase()) ||
        acc.name.toLowerCase().includes(coaSearchQuery.toLowerCase());
      const matchesType = coaTypeFilter === "All" || acc.type === coaTypeFilter;
      return matchesSearch && matchesType;
    });
  }, [coa, coaSearchQuery, coaTypeFilter]);

  // Aggregate Category Totals for Chart of Accounts KPI
  const coaCategoryTotals = useMemo(() => {
    const totals = {
      Asset: { count: 0, balance: 0 },
      Liability: { count: 0, balance: 0 },
      Equity: { count: 0, balance: 0 },
      Revenue: { count: 0, balance: 0 },
      Expense: { count: 0, balance: 0 },
    };
    coa.forEach(acc => {
      if (totals[acc.type]) {
        totals[acc.type].count += 1;
        totals[acc.type].balance += acc.balance;
      }
    });
    return totals;
  }, [coa]);

  // Chart Data points for Chart of Accounts Pie Chart
  const coaChartData = useMemo(() => {
    return [
      { name: "Assets", value: Math.abs(coaCategoryTotals.Asset.balance), color: "#151936" },
      { name: "Liabilities", value: Math.abs(coaCategoryTotals.Liability.balance), color: "#c96f45" },
      { name: "Equity", value: Math.abs(coaCategoryTotals.Equity.balance), color: "#5a7c9f" },
      { name: "Revenue", value: Math.abs(coaCategoryTotals.Revenue.balance), color: "#48954b" },
      { name: "Expenses", value: Math.abs(coaCategoryTotals.Expense.balance), color: "#8b5cf6" },
    ].filter(item => item.value > 0);
  }, [coaCategoryTotals]);

  // Trial Balance Calculations & BarChart data
  const trialBalanceData = useMemo(() => {
    let totalDr = 0;
    let totalCr = 0;
    const categoryRows = [
      { name: "Assets", Debit: 0, Credit: 0 },
      { name: "Liabilities", Debit: 0, Credit: 0 },
      { name: "Equity", Debit: 0, Credit: 0 },
      { name: "Revenues", Debit: 0, Credit: 0 },
      { name: "Expenses", Debit: 0, Credit: 0 },
    ];

    coa.forEach(account => {
      const isDebitAcc = account.type === "Asset" || account.type === "Expense";
      const drAmt = isDebitAcc ? Math.max(0, account.balance) : (account.balance < 0 ? Math.abs(account.balance) : 0);
      const crAmt = !isDebitAcc ? Math.max(0, account.balance) : (account.balance < 0 ? Math.abs(account.balance) : 0);
      totalDr += drAmt;
      totalCr += crAmt;

      const targetType = account.type === "Revenue" ? "Revenues" : account.type + "s";
      const catRow = categoryRows.find(r => r.name === targetType || (account.type === "Equity" && r.name === "Equity"));
      if (catRow) {
        catRow.Debit += drAmt;
        catRow.Credit += crAmt;
      }
    });

    return { totalDr, totalCr, categoryRows };
  }, [coa]);

  // Balance Sheet Calculations & PieChart data
  const balanceSheetData = useMemo(() => {
    const assets = coa.filter(a => a.type === "Asset").reduce((s, a) => s + a.balance, 0);
    const liabilities = coa.filter(a => a.type === "Liability").reduce((s, a) => s + a.balance, 0);
    const equity = coa.filter(a => a.type === "Equity").reduce((s, a) => s + a.balance, 0);

    // Breakdown for Assets distribution chart
    const assetBreakdown = coa.filter(a => a.type === "Asset" && a.balance > 0).map(a => ({
      name: a.name,
      value: a.balance
    }));

    // Breakdown for Liabilities vs Equity composition chart
    const composition = [
      { name: "Total Liabilities", value: liabilities, color: "#c96f45" },
      { name: "Total Equity", value: equity, color: "#5a7c9f" }
    ];

    return { assets, liabilities, equity, liabilitiesEquity: liabilities + equity, assetBreakdown, composition };
  }, [coa]);

  // Cash Flow Calculations & BarChart data
  const cashFlowData = useMemo(() => {
    const operating = cashFlowLines.filter(l => l.category === "Operating").reduce((sum, l) => sum + l.amount, 0);
    const investing = cashFlowLines.filter(l => l.category === "Investing").reduce((sum, l) => sum + l.amount, 0);
    const financing = cashFlowLines.filter(l => l.category === "Financing").reduce((sum, l) => sum + l.amount, 0);
    const totalCash = operating + investing + financing;

    const chartPoints = [
      { name: "Operating Activities", amount: operating, fill: "#48954b" },
      { name: "Investing Activities", amount: investing, fill: "#5a7c9f" },
      { name: "Financing Activities", amount: financing, fill: "#c96f45" }
    ];

    return { operating, investing, financing, totalCash, chartPoints };
  }, [cashFlowLines]);

  const forecastData = useMemo(() => {
    const data = [];
    const startingCash = cashFlowData.totalCash;
    const netWeekly = (expectedMonthlyCollections - expectedMonthlyExpenses) / 4;
    const numWeeks = forecastHorizon === 30 ? 4 : forecastHorizon === 60 ? 8 : 12;

    for (let i = 0; i <= numWeeks; i++) {
      data.push({
        week: i === 0 ? "Start" : `Wk ${i}`,
        "Projected Cash": startingCash + netWeekly * i
      });
    }
    return data;
  }, [cashFlowData.totalCash, expectedMonthlyCollections, expectedMonthlyExpenses, forecastHorizon]);

  // Account Posting History for detailed view drawer
  const selectedAccountTransactions = useMemo(() => {
    if (!selectedCoaAccount) return [];
    return journals.filter(j =>
      j.lines.some(l => l.account === selectedCoaAccount.name)
    );
  }, [journals, selectedCoaAccount]);

  // Filter journals based on search
  const filteredJournals = useMemo(() => {
    return journals.filter(j =>
      j.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      j.memo.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [journals, searchQuery]);

  const paginatedJournals = useMemo(() => {
    return filteredJournals.slice((page - 1) * ROWS_PER_PAGE, page * ROWS_PER_PAGE);
  }, [filteredJournals, page]);

  // Double-Entry Calculations for posting modal
  const totalDebits = useMemo(() => {
    return newJournalLines.reduce((sum, line) => sum + (parseFloat(line.debit) || 0), 0);
  }, [newJournalLines]);

  const totalCredits = useMemo(() => {
    return newJournalLines.reduce((sum, line) => sum + (parseFloat(line.credit) || 0), 0);
  }, [newJournalLines]);

  const variance = totalDebits - totalCredits;
  const isBalanced = variance === 0 && totalDebits > 0;

  // Post Journal Handler
  const handlePostJournal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isBalanced) {
      pushToast({ tone: "error", title: "Unbalanced Entry", body: "Total debits must match total credits before posting." });
      return;
    }

    setIsSubmitting(true);
    // Simulate server roundtrip for professional feel
    await new Promise((resolve) => setTimeout(resolve, 600));

    const nextJeId = `JE-${1000 + journals.length + 43}`;
    const newEntry: JournalEntry = {
      id: nextJeId,
      date: new Date().toISOString().split("T")[0],
      memo: newJournalMemo || "Manual Journal Posting",
      debit: totalDebits,
      credit: totalCredits,
      status: "Posted",
      user: "F. Officer",
      lines: newJournalLines
        .filter(l => l.account && (l.debit || l.credit))
        .map(l => ({
          account: l.account,
          type: l.debit ? "debit" : "credit",
          amount: parseFloat(l.debit || l.credit) || 0
        })),
      logs: [{ time: new Date().toLocaleTimeString(), user: "F. Officer", action: "Posted entry to general ledger" }]
    };

    // Commit journal and update account balances reactively
    setJournals(prev => [newEntry, ...prev]);

    setCoa(prevCoa => {
      return prevCoa.map(acc => {
        let balanceChange = 0;
        newEntry.lines.forEach(line => {
          if (line.account === acc.name) {
            const isDebit = line.type === "debit";
            if (acc.type === "Asset" || acc.type === "Expense") {
              balanceChange += isDebit ? line.amount : -line.amount;
            } else {
              balanceChange += isDebit ? -line.amount : line.amount;
            }
          }
        });
        return { ...acc, balance: acc.balance + balanceChange };
      });
    });

    setIsNewJournalOpen(false);
    setNewJournalMemo("");
    setNewJournalLines([
      { id: "1", account: "", debit: "", credit: "", memo: "" },
      { id: "2", account: "", debit: "", credit: "", memo: "" }
    ]);
    setIsSubmitting(false);

    pushToast({
      tone: "success",
      title: "Journal Posted",
      body: `Entry ${nextJeId} has been successfully committed to the ledger.`
    });
  };

  // Void Journal Handler
  const handleVoidEntry = () => {
    if (!voidConfirmId) return;
    const entryToVoid = journals.find(j => j.id === voidConfirmId);
    if (!entryToVoid || entryToVoid.status === "Voided") return;

    setJournals(prev =>
      prev.map(j => (j.id === voidConfirmId ? { ...j, status: "Voided" } : j))
    );

    // Revert account balances
    setCoa(prevCoa => {
      return prevCoa.map(acc => {
        let balanceChange = 0;
        entryToVoid.lines.forEach(line => {
          if (line.account === acc.name) {
            const isDebit = line.type === "debit";
            // Since we are reversing: subtract what was added, add what was subtracted
            if (acc.type === "Asset" || acc.type === "Expense") {
              balanceChange += isDebit ? -line.amount : line.amount;
            } else {
              balanceChange += isDebit ? line.amount : -line.amount;
            }
          }
        });
        return { ...acc, balance: acc.balance + balanceChange };
      });
    });

    setVoidConfirmId(null);
    setSelectedJournal(null);

    pushToast({
      tone: "info",
      title: "Entry Voided",
      body: `Reversing lines for ${voidConfirmId} have been posted to ledger.`
    });
  };

  // Create Account Handler
  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccId || !newAccName) {
      pushToast({ tone: "error", title: "Validation Error", body: "Please enter a valid account code and name." });
      return;
    }

    setIsSubmitting(true);
    // Simulate server roundtrip for professional feel
    await new Promise((resolve) => setTimeout(resolve, 500));

    const startingBalance = parseFloat(newAccBalance) || 0;
    const newAccount: Account = {
      id: newAccId,
      name: newAccName,
      type: newAccType,
      balance: startingBalance
    };

    setCoa(prev => [...prev, newAccount]);
    setIsNewAccountOpen(false);
    setNewAccId("");
    setNewAccName("");
    setNewAccBalance("");
    setIsSubmitting(false);

    pushToast({
      tone: "success",
      title: "Account Created",
      body: `Account ${newAccId} - ${newAccName} added to chart of accounts.`
    });
  };

  // Tab dynamic UI details helper
  const renderTabDescription = () => {
    switch (activeTab) {
      case "chart-of-accounts":
        return "Classified registry of accounts grouped by balance sheet and income statement categories.";
      case "trial-balance":
        return "Snapshot proving general ledger debits and credits remain in perfect equilibrium.";
      case "balance-sheet":
        return "Statement of consolidated financial position showcasing assets, liabilities, and equity.";
      case "cash-flow":
        return "Direct-method operating liquidity tracker detailing operating, investing, and financing cash flows.";
      default:
        return "Foundation tab for balanced double-entry transactional postings.";
    }
  };

  // Render Skeletons during hydration
  if (!mounted) return <div className="h-screen w-full skeleton-shimmer bg-slate-50" />;

  return (
    <div className="mx-auto flex max-w-[98rem] flex-col gap-4 animate-fade-in pb-12">

      {/* ── 1. Header & Actions ──────────────────────────────────────────────── */}
      <BoardHeader
        eyebrow={<Badge tone="primary">Core Accounting</Badge>}
        meta={
          <span className="hidden text-base text-slate-400 md:inline">
            Active: <span className="font-mono text-slate-600">{entityLabel}</span>
          </span>
        }
        title="General Ledger Control"
        description="Oversee double-entry postings, snap statement balances, and coordinate statutory reconciliation reviews."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {activeTab === "journal-entries" && (
              <div className="flex h-9 min-w-[240px] items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 shadow-sm focus-within:border-[#151936] transition-colors">
                <IconSearch size={14} className="text-slate-400" />
                <input
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                  placeholder="Search journals memo or ID..."
                  className="w-full bg-transparent text-slate-700 outline-none placeholder:text-slate-400 text-base"
                />
              </div>
            )}
            {activeTab === "chart-of-accounts" && (
              <div className="flex h-9 min-w-[240px] items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 shadow-sm focus-within:border-[#151936] transition-colors">
                <IconSearch size={14} className="text-slate-400" />
                <input
                  value={coaSearchQuery}
                  onChange={(e) => setCoaSearchQuery(e.target.value)}
                  placeholder="Search account code or name..."
                  className="w-full bg-transparent text-slate-700 outline-none placeholder:text-slate-400 text-base"
                />
              </div>
            )}
            <Button variant="secondary" size="sm" className="bg-white border-slate-200 shadow-sm">
              <IconFilter size={14} /> Filters
            </Button>

            {activeTab === "journal-entries" && (
              <Button size="sm" onClick={() => setIsNewJournalOpen(true)} className="bg-[#f3df27] text-[#151936] hover:bg-[#e6d220] shadow-sm">
                <IconPlus size={14} stroke={2.5} /> New Journal Entry
              </Button>
            )}
            {activeTab === "chart-of-accounts" && (
              <Button size="sm" onClick={() => setIsNewAccountOpen(true)} className="bg-[#f3df27] text-[#151936] hover:bg-[#e6d220] shadow-sm">
                <IconPlus size={14} stroke={2.5} /> Add Ledger Account
              </Button>
            )}
          </div>
        }
      />

      {/* ── 2. Sibling Concern Navigation ────────────────────────────────────── */}
      <FinanceModuleNav />

      {/* ── 3. Main Tab Panel ────────────────────────────────────────────────── */}
      <div className="pt-2 my-2 animate-fade-in-up">
        <h2 className="title-serif text-slate-900 font-normal capitalize">
          {activeTab.replace(/-/g, " ")} Panel
        </h2>
        <p className="text-desc-secondary mt-1">
          {renderTabDescription()}
        </p>
      </div>

      <BoardPanel className="p-0 overflow-hidden shadow-sm border-slate-200 animate-fade-in-up">

        {/* TAB 1: Journal Entries */}
        {activeTab === "journal-entries" && (
          <>
            {/* Associated Property Accounts Activity */}
            <div className="p-6 bg-slate-50/40 border-b border-slate-100 animate-fade-in">
              <div className="mb-4">
                <h4 className="text-base font-medium uppercase tracking-wider text-slate-450">Featured Active Ledger Units</h4>
                <p className="mt-0.5 text-desc-secondary">Real property profiles linked to recent general ledger postings.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                {/* Property Card 1 */}
                <div className="flex flex-col rounded-xl border border-slate-200/60 bg-white overflow-hidden shadow-sm hover:shadow-md transition duration-200 group">
                  <div className="relative h-28 w-full overflow-hidden">
                    <img
                      src="https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=600&q=80"
                      alt="Unit 4B Runda"
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                    <span className="absolute bottom-2 left-2 text-sm  font-mono text-white/90 font-medium bg-black/40 backdrop-blur-sm px-2 py-0.5 rounded">
                      Runda Estate • Unit 4B
                    </span>
                  </div>
                  <div className="p-3 flex flex-col flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-title-primary">Rent Collection & Mgt Fee</span>
                      <span className="text-sm font-mono font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100/80">
                        KES 150,000
                      </span>
                    </div>
                    <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                      NCBA Operating Account debit balanced against Rent Payable (90%) and Management Fee Income (10%).
                    </p>
                    <div className="mt-auto pt-2 border-t border-slate-100 flex items-center justify-between text-sm  text-slate-400 font-medium">
                      <span>Ref: JE-1042</span>
                      <span className="text-desc-secondary">Last Post: Today</span>
                    </div>
                  </div>
                </div>

                {/* Property Card 2 */}
                <div className="flex flex-col rounded-xl border border-slate-200/60 bg-white overflow-hidden shadow-sm hover:shadow-md transition duration-200 group">
                  <div className="relative h-28 w-full overflow-hidden">
                    <img
                      src="https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=600&q=80"
                      alt="Office petty cash"
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                    <span className="absolute bottom-2 left-2 text-sm  font-mono text-white/90 font-medium bg-black/40 backdrop-blur-sm px-2 py-0.5 rounded">
                      Commercial • Head Office
                    </span>
                  </div>
                  <div className="p-3 flex flex-col flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-title-primary">Petty Cash Replenishment</span>
                      <span className="bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200/60 text-body-primary">
                        KES 50,000
                      </span>
                    </div>
                    <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                      Replenishing petty cash drawers from the NCBA Operating Account. Auto-logged for office administrative overhead.
                    </p>
                    <div className="mt-auto pt-2 border-t border-slate-100 flex items-center justify-between text-sm  text-slate-400 font-medium">
                      <span>Ref: JE-1041</span>
                      <span className="text-desc-secondary">Last Post: Yesterday</span>
                    </div>
                  </div>
                </div>

                {/* Property Card 3 */}
                <div className="flex flex-col rounded-xl border border-slate-200/60 bg-white overflow-hidden shadow-sm hover:shadow-md transition duration-200 group">
                  <div className="relative h-28 w-full overflow-hidden">
                    <img
                      src="https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=600&q=80"
                      alt="Reversals & Voids"
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                    <span className="absolute bottom-2 left-2 text-sm  font-mono text-white/90 font-medium bg-black/40 backdrop-blur-sm px-2 py-0.5 rounded">
                      Audits • Reconciliation
                    </span>
                  </div>
                  <div className="p-3 flex flex-col flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-title-primary">Duplicate Accrual Void</span>
                      <span className="text-sm font-mono font-medium text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100/80">
                        KES 200,000
                      </span>
                    </div>
                    <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                      Voided duplicate rental booking to restore Accounts Receivable and Management Fee accounts back to target values.
                    </p>
                    <div className="mt-auto pt-2 border-t border-slate-100 flex items-center justify-between text-sm  text-slate-400 font-medium">
                      <span>Ref: JE-1040</span>
                      <span className="text-rose-600 font-medium">Status: Voided</span>
                    </div>
                  </div>
                </div>

              </div>
            </div>

            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-white">
              <div>
                <h3 className="text-title-primary">Ledger Postings Registry</h3>
                <p className="mt-0.5 text-sm  text-slate-400">Double-entry audit records. Posted accounts are closed and immutable.</p>
              </div>
              <Button variant="secondary" size="sm" className="h-8 text-base bg-slate-50 border-slate-200 shadow-sm">
                <IconFileExport size={13} /> Export Ledger
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm  text-slate-650">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-100 text-slate-400 label-caps">
                    <th className="px-5 py-3 w-[120px]">Date</th>
                    <th className="px-5 py-3 w-[120px]">Reference</th>
                    <th className="px-5 py-3">Memo Details</th>
                    <th className="px-5 py-3 text-right">Debit (KES)</th>
                    <th className="px-5 py-3 text-right">Credit (KES)</th>
                    <th className="px-5 py-3">Accountant</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3 text-right w-[60px]"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/80 bg-white">
                  {paginatedJournals.length > 0 ? paginatedJournals.map((row) => (
                    <tr key={row.id} className="transition-colors hover:bg-slate-50/80 group">
                      <td className="px-5 py-3.5 text-slate-450 mono-data">{row.date}</td>
                      <td className="px-5 py-3.5 text-[#151936] mono-data">{row.id}</td>
                      <td className="px-5 py-3.5 text-base text-slate-700 font-medium">{row.memo}</td>
                      <td className="px-5 py-3.5 text-right text-slate-750 mono-data">
                        {row.debit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-5 py-3.5 text-right text-slate-750 mono-data">
                        {row.credit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-5 py-3.5 text-desc-secondary">{row.user}</td>
                      <td className="px-5 py-3.5">
                        <Badge tone={row.status === "Posted" ? "success" : "neutral"} className="py-0.5 px-2 font-medium">
                          {row.status}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <button
                          onClick={() => setSelectedJournal(row)}
                          className="inline-flex size-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-900"
                        >
                          <IconEye size={16} />
                        </button>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={8} className="py-16 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <IconScale size={32} className="text-slate-300" />
                          <p className="text-base font-medium text-slate-655">No ledger entries detected</p>
                          <p className="text-sm text-slate-400 font-medium">Adjust your search parameter or create a new journal post.</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="p-4 border-t border-slate-100 bg-white">
              <PaginationControls
                currentPage={page}
                totalPages={Math.max(1, Math.ceil(filteredJournals.length / ROWS_PER_PAGE))}
                onPageChange={setPage}
                label={`${filteredJournals.length} ledger lines`}
              />
            </div>
          </>
        )}

        {/* TAB 2: Chart of Accounts */}
        {activeTab === "chart-of-accounts" && (
          <>
            {/* Visual KPI & Chart Summary Row */}
            <div className="p-6 bg-slate-50/40 border-b border-slate-100 animate-fade-in">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

                {/* KPI Cards Grid */}
                <div className="lg:col-span-8 grid grid-cols-2 sm:grid-cols-5 gap-3">

                  {/* Asset Card */}
                  <div className="bg-white border border-slate-200/70 p-4 rounded-xl shadow-sm flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="size-2 rounded-full bg-[#151936]" />
                        <span className="text-slate-400 label-caps">Assets</span>
                      </div>
                      <p className="text-sm text-slate-450 font-medium mt-0.5">{coaCategoryTotals.Asset.count} accounts</p>
                    </div>
                    <p className="mt-4 text-slate-800 mono-data">
                      {coaCategoryTotals.Asset.balance.toLocaleString(undefined, { maximumFractionDigits: 0 })} KES
                    </p>
                  </div>

                  {/* Liability Card */}
                  <div className="bg-white border border-slate-200/70 p-4 rounded-xl shadow-sm flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="size-2 rounded-full bg-[#c96f45]" />
                        <span className="text-slate-400 label-caps">Liabilities</span>
                      </div>
                      <p className="text-sm text-slate-450 font-medium mt-0.5">{coaCategoryTotals.Liability.count} accounts</p>
                    </div>
                    <p className="mt-4 text-slate-800 mono-data">
                      {coaCategoryTotals.Liability.balance.toLocaleString(undefined, { maximumFractionDigits: 0 })} KES
                    </p>
                  </div>

                  {/* Equity Card */}
                  <div className="bg-white border border-slate-200/70 p-4 rounded-xl shadow-sm flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="size-2 rounded-full bg-[#5a7c9f]" />
                        <span className="text-slate-400 label-caps">Equity</span>
                      </div>
                      <p className="text-sm text-slate-450 font-medium mt-0.5">{coaCategoryTotals.Equity.count} accounts</p>
                    </div>
                    <p className="mt-4 text-slate-800 mono-data">
                      {coaCategoryTotals.Equity.balance.toLocaleString(undefined, { maximumFractionDigits: 0 })} KES
                    </p>
                  </div>

                  {/* Revenue Card */}
                  <div className="bg-white border border-slate-200/70 p-4 rounded-xl shadow-sm flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="size-2 rounded-full bg-[#48954b]" />
                        <span className="text-slate-400 label-caps">Revenues</span>
                      </div>
                      <p className="text-sm text-slate-450 font-medium mt-0.5">{coaCategoryTotals.Revenue.count} accounts</p>
                    </div>
                    <p className="mt-4 text-slate-800 mono-data">
                      {coaCategoryTotals.Revenue.balance.toLocaleString(undefined, { maximumFractionDigits: 0 })} KES
                    </p>
                  </div>

                  {/* Expense Card */}
                  <div className="bg-white border border-slate-200/70 p-4 rounded-xl shadow-sm flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="size-2 rounded-full bg-[#8b5cf6]" />
                        <span className="text-slate-400 label-caps">Expenses</span>
                      </div>
                      <p className="text-sm text-slate-450 font-medium mt-0.5">{coaCategoryTotals.Expense.count} accounts</p>
                    </div>
                    <p className="mt-4 text-slate-800 mono-data">
                      {coaCategoryTotals.Expense.balance.toLocaleString(undefined, { maximumFractionDigits: 0 })} KES
                    </p>
                  </div>

                </div>

                {/* Donut Chart Summary */}
                <div className="lg:col-span-4 bg-white border border-slate-200/70 p-4 rounded-xl shadow-sm flex items-center justify-between">
                  <div className="w-[55%] h-[120px] relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={coaChartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={36}
                          outerRadius={50}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {coaChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: unknown) => [`KES ${(value as number).toLocaleString()}`, "Balance"]} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="w-[45%] space-y-1 pl-2 text-desc-secondary">
                    <h5 className="text-slate-400 mb-1.5 label-caps">Balance Mix</h5>
                    {coaChartData.map((entry) => (
                      <div key={entry.name} className="flex items-center gap-1.5">
                        <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                        <span className="truncate">{entry.name}</span>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-b border-slate-100 bg-white">
              <div className="flex flex-wrap gap-1">
                {["All", "Asset", "Liability", "Equity", "Revenue", "Expense"].map((type) => (
                  <button
                    key={type}
                    onClick={() => setCoaTypeFilter(type)}
                    className={cn(
                      "px-3.5 py-1.5 text-sm  font-medium rounded-lg transition-all",
                      coaTypeFilter === type
                        ? "bg-[#151936] text-white shadow-sm"
                        : "bg-white text-slate-500 border border-slate-200 hover:bg-slate-55"
                    )}
                  >
                    {type === "All" ? "All Classifications" : type}
                  </button>
                ))}
              </div>
              <span className="text-sm  font-mono text-slate-400">
                Showing {filteredCoa.length} of {coa.length} accounts
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm  text-slate-650">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-100 text-slate-400 label-caps">
                    <th className="px-5 py-3 w-[150px]">Account Code</th>
                    <th className="px-5 py-3">Account Title Name</th>
                    <th className="px-5 py-3 w-[180px]">Classification Type</th>
                    <th className="px-5 py-3 text-right w-[200px]">Current Balance (KES)</th>
                    <th className="px-5 py-3 text-right w-[60px]"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/80 bg-white">
                  {filteredCoa.map((account) => (
                    <tr
                      key={account.id}
                      className="transition-colors hover:bg-slate-50/80 cursor-pointer group"
                      onClick={() => setSelectedCoaAccount(account)}
                    >
                      <td className="px-5 py-3.5 text-[#151936] mono-data">{account.id}</td>
                      <td className="px-5 py-3.5 text-base text-slate-700 font-medium">{account.name}</td>
                      <td className="px-5 py-3.5">
                        <Badge
                          tone={
                            account.type === "Asset" ? "primary" :
                              account.type === "Liability" ? "warning" :
                                account.type === "Equity" ? "neutral" :
                                  account.type === "Revenue" ? "success" : "data"
                          }
                          className="py-0.5 px-2 font-medium"
                        >
                          {account.type}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5 text-right text-slate-755 mono-data">
                        {account.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <button
                          onClick={(e) => { e.stopPropagation(); setSelectedCoaAccount(account); }}
                          className="inline-flex size-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-900"
                        >
                          <IconEye size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* TAB 3: Trial Balance */}
        {activeTab === "trial-balance" && (
          <>
            <div className="flex flex-wrap items-center justify-between p-5 border-b border-slate-100 bg-white gap-3">
              <div>
                <h3 className="text-title-primary">Equilibrium Snapshot</h3>
                <p className="mt-0.5 text-sm  text-slate-400">Verifying debit/credit ledger equality as of current transactional block.</p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={handleSealLedger}
                  size="sm"
                  className={cn(
                    "h-8 text-base shadow-sm transition-all",
                    auditSeal?.sealed
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                      : "bg-[#151936] text-white hover:bg-slate-800"
                  )}
                >
                  <IconShieldCheck size={14} className="mr-1.5" />
                  {auditSeal?.sealed ? "Reseal Ledger" : "Seal & Verify Ledger"}
                </Button>
                <Button
                  onClick={handlePostAdjustingShortcut}
                  variant="secondary"
                  size="sm"
                  className="h-8 text-base bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 shadow-sm"
                >
                  <IconAdjustments size={14} className="mr-1.5" />
                  Post Adjusting Entry
                </Button>
                <Button variant="secondary" size="sm" className="h-8 text-base bg-slate-50 border-slate-200 shadow-sm">
                  <IconFileExport size={13} /> Export Statement
                </Button>
              </div>
            </div>

            {auditSeal && (
              <div className="mx-6 mt-4 p-4 rounded-xl border border-emerald-100 bg-emerald-50/45 flex flex-wrap items-center justify-between gap-3 text-emerald-850 animate-fade-in text-sm">
                <div className="flex items-center gap-3">
                  <div className="size-9 rounded-lg bg-emerald-100/80 flex items-center justify-center text-emerald-700">
                    <IconShieldCheck size={20} />
                  </div>
                  <div>
                    <p className="font-medium text-emerald-900">Ledger Sealed & Verified</p>
                    <p className="text-emerald-700/85 mt-0.5">Audited by {auditSeal.auditor} on {auditSeal.timestamp}</p>
                  </div>
                </div>
                <div className="font-mono text-sm bg-white border border-emerald-100 px-3 py-1.5 rounded-lg shadow-sm">
                  <span className="text-slate-405">HASH:</span> {auditSeal.hash}
                </div>
              </div>
            )}

            {/* Trial Balance Visual Chart */}
            <div className="p-6 bg-slate-50/40 border-b border-slate-100 animate-fade-in">
              <div className="bg-white border border-slate-200/70 p-5 rounded-xl shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h4 className="text-title-primary">Visual Equilibrium Breakdown</h4>
                    <p className="text-sm text-slate-450 font-medium mt-0.5">Asset & Expense debits balancing against Liability, Equity & Revenue credits.</p>
                  </div>
                  <Badge tone={Math.abs(trialBalanceData.totalDr - trialBalanceData.totalCr) < 0.01 ? "success" : "risk"}>
                    {Math.abs(trialBalanceData.totalDr - trialBalanceData.totalCr) < 0.01 ? "Balanced" : "Variance Detected"}
                  </Badge>
                </div>
                <div className="h-64 w-full text-sm ">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={trialBalanceData.categoryRows}
                      margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
                    >
                      <XAxis dataKey="name" tickLine={false} axisLine={false} stroke="#94a3b8" />
                      <YAxis tickLine={false} axisLine={false} stroke="#94a3b8" tickFormatter={(v) => `${(v / 1e6).toFixed(1)}M`} />
                      <Tooltip formatter={(value: unknown) => [`KES ${(value as number).toLocaleString()}`, ""]} />
                      <Legend />
                      <Bar dataKey="Debit" fill="#151936" radius={[4, 4, 0, 0]} maxBarSize={32} />
                      <Bar dataKey="Credit" fill="#c96f45" radius={[4, 4, 0, 0]} maxBarSize={32} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm  text-slate-650">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-100 text-slate-400 label-caps">
                    <th className="px-5 py-3 w-[150px]">Code</th>
                    <th className="px-5 py-3">Account Name</th>
                    <th className="px-5 py-3 text-right w-[200px]">Debits (KES)</th>
                    <th className="px-5 py-3 text-right w-[200px]">Credits (KES)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {coa.map((account) => {
                    const isDebitAcc = account.type === "Asset" || account.type === "Expense";
                    const drAmt = isDebitAcc ? Math.max(0, account.balance) : (account.balance < 0 ? Math.abs(account.balance) : 0);
                    const crAmt = !isDebitAcc ? Math.max(0, account.balance) : (account.balance < 0 ? Math.abs(account.balance) : 0);

                    return (
                      <tr key={account.id} className="transition-colors hover:bg-slate-50/80">
                        <td className="px-5 py-3 text-slate-500 mono-data">{account.id}</td>
                        <td className="px-5 py-3 text-slate-700 font-medium text-base">{account.name}</td>
                        <td className="px-5 py-3 text-right text-slate-700 mono-data">
                          {drAmt > 0 ? drAmt.toLocaleString(undefined, { minimumFractionDigits: 2 }) : "-"}
                        </td>
                        <td className="px-5 py-3 text-right text-slate-700 mono-data">
                          {crAmt > 0 ? crAmt.toLocaleString(undefined, { minimumFractionDigits: 2 }) : "-"}
                        </td>
                      </tr>
                    );
                  })}

                  {/* Totals Summary */}
                  {(() => {
                    const drSum = coa.reduce((sum, account) => {
                      const isDebitAcc = account.type === "Asset" || account.type === "Expense";
                      return sum + (isDebitAcc ? Math.max(0, account.balance) : (account.balance < 0 ? Math.abs(account.balance) : 0));
                    }, 0);

                    const crSum = coa.reduce((sum, account) => {
                      const isDebitAcc = account.type === "Asset" || account.type === "Expense";
                      return sum + (!isDebitAcc ? Math.max(0, account.balance) : (account.balance < 0 ? Math.abs(account.balance) : 0));
                    }, 0);

                    const tbVariance = drSum - crSum;
                    const isTbBalanced = Math.abs(tbVariance) < 0.01;

                    return (
                      <>
                        <tr className="bg-slate-50/70 border-t-2 border-slate-200 font-medium">
                          <td colSpan={2} className="px-5 py-4 text-base text-slate-655 font-medium">Consolidated Ledger Summary</td>
                          <td className="px-5 py-4 text-right text-slate-900 mono-data">
                            {drSum.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-5 py-4 text-right text-slate-900 mono-data">
                            {crSum.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                        {!isTbBalanced && (
                          <tr className="bg-rose-50 text-rose-800 font-medium">
                            <td colSpan={4} className="px-5 py-3 font-medium text-center text-sm">
                              ⚠️ Out of Balance Variance detected: KES {tbVariance.toLocaleString(undefined, { minimumFractionDigits: 2 })}. Review manual postings.
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })()}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* TAB 4: Balance Sheet */}
        {activeTab === "balance-sheet" && (
          <>
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-white">
              <div>
                <h3 className="text-title-primary">Statement of Financial Position</h3>
                <p className="mt-0.5 text-sm  text-slate-400">Statement layout for active assets, liabilities, and shareholder equity.</p>
              </div>
              <Button variant="secondary" size="sm" className="h-8 text-base bg-slate-50 border-slate-200 shadow-sm">
                <IconFileExport size={13} /> Export Statement
              </Button>
            </div>

            <div className="p-6 bg-slate-50/30 animate-fade-in">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 max-w-[95rem] mx-auto items-start">

                {/* Left Column: Statement Document */}
                <div className="lg:col-span-8 bg-white border border-slate-150 rounded-2xl shadow-sm overflow-hidden p-6 space-y-6">

                  {/* Header block */}
                  <div className="border-b border-slate-100 pb-4 text-center">
                    <h4 className="title-serif text-slate-900 font-normal">Sunland Real Estate Group</h4>
                    <p className="text-slate-400 font-mono mt-1 label-caps">Statement of Financial Position</p>
                    <p className="text-desc-secondary mt-0.5">As of June 21, 2026</p>
                  </div>

                  {/* Assets Section */}
                  <div className="space-y-2">
                    <h5 className="text-slate-400 border-b border-slate-100 pb-1 label-caps">1. Assets & Reserves</h5>
                    <div className="space-y-1 pl-3">
                      {coa.filter(a => a.type === "Asset").map(account => (
                        <div
                          key={account.id}
                          onClick={() => {
                            setReconciliationAccount(account);
                            setBankStatementBalance(account.balance.toString());
                            setReconNotes("");
                            setMatchedTxIds([]);
                          }}
                          className="flex justify-between items-center text-base text-slate-650 font-medium hover:bg-slate-50 p-2 rounded-xl cursor-pointer border border-transparent hover:border-slate-100/60 transition-all duration-200 group"
                        >
                          <span className="group-hover:text-[#151936] transition-colors flex items-center gap-2">
                            <span>{account.name}</span>
                            <span className="text-sm  bg-slate-100 text-slate-450 px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">Reconcile</span>
                          </span>
                          <span className="font-mono text-slate-800">{account.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </div>
                      ))}
                      {/* Sum of Assets */}
                      {(() => {
                        const totalAssets = coa.filter(a => a.type === "Asset").reduce((s, a) => s + a.balance, 0);
                        return (
                          <div className="flex justify-between border-t border-slate-100 pt-2 px-2 text-title-primary">
                            <span>Total Assets</span>
                            <span className="font-mono text-[#1b431e] body-md">{totalAssets.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Liabilities Section */}
                  <div className="space-y-2">
                    <h5 className="text-slate-400 border-b border-slate-100 pb-1 label-caps">2. Operating Liabilities</h5>
                    <div className="space-y-1 pl-3">
                      {coa.filter(a => a.type === "Liability").map(account => (
                        <div
                          key={account.id}
                          onClick={() => {
                            setReconciliationAccount(account);
                            setBankStatementBalance(account.balance.toString());
                            setReconNotes("");
                            setMatchedTxIds([]);
                          }}
                          className="flex justify-between items-center text-base text-slate-650 font-medium hover:bg-slate-50 p-2 rounded-xl cursor-pointer border border-transparent hover:border-slate-100/60 transition-all duration-200 group"
                        >
                          <span className="group-hover:text-[#151936] transition-colors flex items-center gap-2">
                            <span>{account.name}</span>
                            <span className="text-sm  bg-slate-100 text-slate-450 px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">Reconcile</span>
                          </span>
                          <span className="font-mono text-slate-800">{account.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </div>
                      ))}
                      {/* Sum of Liabilities */}
                      {(() => {
                        const totalLiab = coa.filter(a => a.type === "Liability").reduce((s, a) => s + a.balance, 0);
                        return (
                          <div className="flex justify-between border-t border-slate-100 pt-2 px-2 text-title-primary">
                            <span>Total Liabilities</span>
                            <span className="font-mono text-slate-800 body-md">{totalLiab.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Equity Section */}
                  <div className="space-y-2">
                    <h5 className="text-slate-400 border-b border-slate-100 pb-1 label-caps">3. Capital & Shareholder Equity</h5>
                    <div className="space-y-1 pl-3">
                      {coa.filter(a => a.type === "Equity").map(account => (
                        <div
                          key={account.id}
                          onClick={() => {
                            setReconciliationAccount(account);
                            setBankStatementBalance(account.balance.toString());
                            setReconNotes("");
                            setMatchedTxIds([]);
                          }}
                          className="flex justify-between items-center text-base text-slate-650 font-medium hover:bg-slate-50 p-2 rounded-xl cursor-pointer border border-transparent hover:border-slate-100/60 transition-all duration-200 group"
                        >
                          <span className="group-hover:text-[#151936] transition-colors flex items-center gap-2">
                            <span>{account.name}</span>
                            <span className="text-sm  bg-slate-100 text-slate-450 px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">Reconcile</span>
                          </span>
                          <span className="font-mono text-slate-800">{account.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </div>
                      ))}
                      {/* Sum of Equity */}
                      {(() => {
                        const totalEquity = coa.filter(a => a.type === "Equity").reduce((s, a) => s + a.balance, 0);
                        return (
                          <div className="flex justify-between border-t border-slate-100 pt-2 px-2 text-title-primary">
                            <span>Total Shareholder Equity</span>
                            <span className="font-mono text-slate-800 body-md">{totalEquity.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Statement Verification Audit Footer */}
                  {(() => {
                    const assetsVal = coa.filter(a => a.type === "Asset").reduce((s, a) => s + a.balance, 0);
                    const liabVal = coa.filter(a => a.type === "Liability").reduce((s, a) => s + a.balance, 0);
                    const equityVal = coa.filter(a => a.type === "Equity").reduce((s, a) => s + a.balance, 0);
                    const liabEquityVal = liabVal + equityVal;
                    const isSheetBalanced = assetsVal === liabEquityVal;

                    return (
                      <div className={cn(
                        "p-3.5 rounded-xl border flex items-center justify-between text-sm font-medium",
                        isSheetBalanced ? "bg-emerald-50 border-emerald-100 text-emerald-800" : "bg-rose-50 border-rose-100 text-rose-800"
                      )}>
                        <span className="flex items-center gap-1.5 font-medium">
                          <IconInfoCircle size={15} />
                          {isSheetBalanced
                            ? "Accounting Equation holds in perfect balance: Assets = Liabilities + Equity."
                            : "Accounting Equation variance detected. Ledger review required."
                          }
                        </span>
                        <span className="font-mono">
                          {assetsVal.toLocaleString()} vs {liabEquityVal.toLocaleString()}
                        </span>
                      </div>
                    );
                  })()}

                </div>

                {/* Right Column: Statement Visualizations */}
                <div className="lg:col-span-4 space-y-4">

                  {/* Donut Chart: Asset reserve mix */}
                  <div className="bg-white border border-slate-200/70 p-5 rounded-2xl shadow-sm space-y-4">
                    <h5 className="text-title-primary uppercase tracking-wider">Asset Reserve Mix</h5>
                    <div className="h-44 w-full text-sm">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={balanceSheetData.assetBreakdown}
                            cx="50%"
                            cy="50%"
                            innerRadius={30}
                            outerRadius={45}
                            paddingAngle={3}
                            dataKey="value"
                          >
                            {balanceSheetData.assetBreakdown.map((entry, idx) => (
                              <Cell key={`cell-${idx}`} fill={idx === 0 ? "#151936" : "#5a7c9f"} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value: unknown) => [`KES ${(value as number).toLocaleString()}`, ""]} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="text-sm font-medium text-slate-550 space-y-1.5 pt-2 border-t border-slate-100/60">
                      {balanceSheetData.assetBreakdown.map((item, idx) => (
                        <div key={item.name} className="flex justify-between items-center">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: idx === 0 ? "#151936" : "#5a7c9f" }} />
                            <span className="truncate text-slate-600">{item.name}</span>
                          </div>
                          <span className="font-mono text-slate-800 font-medium shrink-0">
                            {balanceSheetData.assets > 0 ? ((item.value / balanceSheetData.assets) * 100).toFixed(0) : 0}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Donut Chart: Funding structure mix */}
                  <div className="bg-white border border-slate-200/70 p-5 rounded-2xl shadow-sm space-y-4">
                    <h5 className="text-title-primary uppercase tracking-wider">Funding Composition</h5>
                    <div className="h-44 w-full text-sm">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={balanceSheetData.composition}
                            cx="50%"
                            cy="50%"
                            innerRadius={30}
                            outerRadius={45}
                            paddingAngle={3}
                            dataKey="value"
                          >
                            {balanceSheetData.composition.map((entry, idx) => (
                              <Cell key={`cell-${idx}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value: unknown) => [`KES ${(value as number).toLocaleString()}`, ""]} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="text-sm font-medium text-slate-550 space-y-1.5 pt-2 border-t border-slate-100/60">
                      {balanceSheetData.composition.map((item) => (
                        <div key={item.name} className="flex justify-between items-center">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                            <span className="truncate text-slate-600">{item.name}</span>
                          </div>
                          <span className="font-mono text-slate-805 font-medium shrink-0">
                            {balanceSheetData.liabilitiesEquity > 0 ? ((item.value / balanceSheetData.liabilitiesEquity) * 100).toFixed(0) : 0}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>

              </div>
            </div>
          </>
        )}

        {/* TAB 5: Cash Flow */}
        {activeTab === "cash-flow" && (
          <>
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-white">
              <div>
                <h3 className="text-title-primary">Statement of Cash Flows</h3>
                <p className="mt-0.5 text-sm  text-slate-400">Direct operational movements across bank accounts and petty cash reserves.</p>
              </div>
              <Button variant="secondary" size="sm" className="h-8 text-base bg-slate-50 border-slate-200 shadow-sm">
                <IconFileExport size={13} /> Export Statement
              </Button>
            </div>

            <div className="p-6 bg-slate-50/30 animate-fade-in">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 max-w-[95rem] mx-auto items-start">

                {/* Left Column: Statement Document */}
                <div className="lg:col-span-8 bg-white border border-slate-150 rounded-2xl shadow-sm overflow-hidden p-6 space-y-6">

                  {/* Header block */}
                  <div className="border-b border-slate-100 pb-4 text-center">
                    <h4 className="title-serif text-slate-900 font-normal">Sunland Real Estate Group</h4>
                    <p className="text-slate-400 font-mono mt-1 label-caps">Statement of Cash Flows</p>
                    <p className="text-desc-secondary mt-0.5">Period ended June 21, 2026</p>
                  </div>

                  {/* Operating Cash flow */}
                  <div className="space-y-2">
                    <h5 className="text-slate-400 border-b border-slate-100 pb-1 label-caps">1. Cash flows from Operating Activities</h5>
                    <div className="space-y-1.5 pl-3">
                      {cashFlowLines.filter(l => l.category === "Operating").map(line => (
                        <div
                          key={line.id}
                          onClick={() => setReclassLine(line)}
                          className="flex justify-between items-center text-base text-slate-650 font-medium hover:bg-slate-50 p-2 rounded-xl cursor-pointer border border-transparent hover:border-slate-100/60 transition-all group animate-fade-in"
                        >
                          <span className="group-hover:text-blue-600 transition-colors flex items-center gap-2">
                            <span>{line.name}</span>
                            <span className="bg-slate-100 text-slate-450 px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity text-sm">Reclassify</span>
                          </span>
                          <span className={cn("font-mono text-slate-800")}>
                            {line.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      ))}
                      <div className="flex justify-between border-t border-slate-100 pt-2 px-2 text-title-primary">
                        <span>Net Cash generated by Operating Activities</span>
                        <span className="font-mono text-emerald-700 body-md">
                          {cashFlowData.operating.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Investing Cash flow */}
                  <div className="space-y-2">
                    <h5 className="text-slate-400 border-b border-slate-100 pb-1 label-caps">2. Cash flows from Investing Activities</h5>
                    <div className="space-y-1.5 pl-3">
                      {cashFlowLines.filter(l => l.category === "Investing").length > 0 ? (
                        cashFlowLines.filter(l => l.category === "Investing").map(line => (
                          <div
                            key={line.id}
                            onClick={() => setReclassLine(line)}
                            className="flex justify-between items-center text-base text-slate-650 font-medium hover:bg-slate-50 p-2 rounded-xl cursor-pointer border border-transparent hover:border-slate-100/60 transition-all group animate-fade-in"
                          >
                            <span className="group-hover:text-blue-600 transition-colors flex items-center gap-2">
                              <span>{line.name}</span>
                              <span className="bg-slate-100 text-slate-450 px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity text-sm">Reclassify</span>
                            </span>
                            <span className={cn("font-mono text-slate-800")}>
                              {line.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm  text-slate-400 py-1 pl-2">No investing movements recorded.</p>
                      )}
                      <div className="flex justify-between border-t border-slate-100 pt-2 px-2 text-title-primary">
                        <span>Net Cash used in Investing Activities</span>
                        <span className="font-mono text-slate-650 body-md">
                          {cashFlowData.investing.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Financing Cash flow */}
                  <div className="space-y-2">
                    <h5 className="text-slate-400 border-b border-slate-100 pb-1 label-caps">3. Cash flows from Financing Activities</h5>
                    <div className="space-y-1.5 pl-3">
                      {cashFlowLines.filter(l => l.category === "Financing").map(line => (
                        <div
                          key={line.id}
                          onClick={() => setReclassLine(line)}
                          className="flex justify-between items-center text-base text-slate-650 font-medium hover:bg-slate-50 p-2 rounded-xl cursor-pointer border border-transparent hover:border-slate-100/60 transition-all group animate-fade-in"
                        >
                          <span className="group-hover:text-blue-600 transition-colors flex items-center gap-2">
                            <span>{line.name}</span>
                            <span className="bg-slate-100 text-slate-450 px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity text-sm">Reclassify</span>
                          </span>
                          <span className={cn("font-mono text-slate-800")}>
                            {line.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      ))}
                      <div className="flex justify-between border-t border-slate-100 pt-2 px-2 text-title-primary">
                        <span>Net Cash used in Financing Activities</span>
                        <span className="font-mono text-rose-700 body-md">
                          {cashFlowData.financing.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Summary Position Reconciliations */}
                  <div className="border-t border-slate-200 pt-4">
                    <div className="flex justify-between text-base  text-[#151936] font-medium px-2">
                      <span>Net Cash Position (Bank Accounts)</span>
                      <span className="font-mono font-medium text-lg">
                        {cashFlowData.totalCash.toLocaleString(undefined, { minimumFractionDigits: 2 })} KES
                      </span>
                    </div>
                  </div>

                </div>

                {/* Right Column: Statement Visualizations */}
                <div className="lg:col-span-4 space-y-4">
                  <div className="bg-white border border-slate-200/70 p-5 rounded-2xl shadow-sm space-y-4">
                    <h5 className="text-title-primary uppercase tracking-wider">Cash Movements</h5>
                    <div className="h-52 w-full text-sm ">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={cashFlowData.chartPoints}
                          layout="vertical"
                          margin={{ top: 10, right: 10, left: -10, bottom: 5 }}
                        >
                          <XAxis type="number" tickLine={false} axisLine={false} stroke="#94a3b8" tickFormatter={(v) => `${(v / 1e6).toFixed(1)}M`} />
                          <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} stroke="#94a3b8" width={110} />
                          <Tooltip formatter={(value: unknown) => [`KES ${(value as number).toLocaleString()}`, "Amount"]} />
                          <Bar dataKey="amount" radius={[0, 4, 4, 0]} maxBarSize={22}>
                            {cashFlowData.chartPoints.map((entry, idx) => (
                              <Cell key={`cell-${idx}`} fill={entry.fill} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <p className="text-sm text-slate-450 leading-relaxed font-medium">
                      Direct cash inflows and outflows tracking liquidity reserves. Green represents net operational inflows; red indicates financing landlord outflows.
                    </p>
                  </div>

                  {/* Cash Flow Forecaster Tool */}
                  <div className="bg-white border border-slate-200/70 p-5 rounded-2xl shadow-sm space-y-4 animate-scale-in">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div>
                        <h5 className="text-title-primary uppercase tracking-wider flex items-center gap-1.5">
                          <IconCalendarStats size={15} className="text-slate-400" />
                          Cash Flow Forecaster
                        </h5>
                        <p className="text-sm  text-slate-400 font-medium mt-0.5">Project liquidity curves based on collections expectation.</p>
                      </div>
                      <select
                        value={forecastHorizon}
                        onChange={(e) => setForecastHorizon(parseInt(e.target.value) as 30 | 60 | 90)}
                        className="text-sm border border-slate-200 rounded-lg p-1 font-medium bg-white"
                      >
                        <option value={30}>30 Days</option>
                        <option value={60}>60 Days</option>
                        <option value={90}>90 Days</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm ">
                      <div className="grid gap-1">
                        <label className="text-desc-secondary">Est. Monthly Receipts</label>
                        <input
                          type="number"
                          value={expectedMonthlyCollections || ""}
                          onChange={(e) => setExpectedMonthlyCollections(parseFloat(e.target.value) || 0)}
                          className="border border-slate-200 rounded-lg p-1.5 font-mono text-sm font-medium focus:border-slate-400 outline-none"
                        />
                      </div>
                      <div className="grid gap-1">
                        <label className="text-desc-secondary">Est. Monthly Outlays</label>
                        <input
                          type="number"
                          value={expectedMonthlyExpenses || ""}
                          onChange={(e) => setExpectedMonthlyExpenses(parseFloat(e.target.value) || 0)}
                          className="border border-slate-200 rounded-lg p-1.5 font-mono text-sm font-medium focus:border-slate-400 outline-none"
                        />
                      </div>
                    </div>

                    <div className="h-40 w-full text-sm  pt-1">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={forecastData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                          <XAxis dataKey="week" tickLine={false} axisLine={false} stroke="#94a3b8" />
                          <YAxis tickLine={false} axisLine={false} stroke="#94a3b8" tickFormatter={(v) => `${(v / 1e6).toFixed(1)}M`} />
                          <Tooltip formatter={(value: unknown) => [`KES ${(value as number).toLocaleString()}`, "Projected Cash"]} />
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <Line type="monotone" dataKey="Projected Cash" stroke="#151936" strokeWidth={2} dot={{ r: 2 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                </div>

              </div>
            </div>
          </>
        )}

      </BoardPanel>

      {/* ── 5. New Journal Entry Modal (Double-Entry Enforced) ─────────────── */}
      <Modal
        open={isNewJournalOpen}
        onClose={() => { if (!isSubmitting) setIsNewJournalOpen(false); }}
        title="Post New Journal Entry"
        description="Verify lines and post manual entries. Total debits must equal total credits."
        size="lg"
      >
        <form onSubmit={handlePostJournal} className="space-y-4">
          <div className="grid gap-2">
            <label className="text-base font-medium text-slate-700">Memo / Description</label>
            <input
              type="text"
              required
              disabled={isSubmitting}
              placeholder="e.g. Accrued Office Rent Accrual"
              value={newJournalMemo}
              onChange={(e) => setNewJournalMemo(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 outline-none focus:border-slate-400 transition-colors disabled:bg-slate-50 disabled:text-slate-400 text-body-primary"
            />
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <label className="text-base font-medium text-slate-700">Ledger Posting Lines</label>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setNewJournalLines([...newJournalLines, { id: Date.now().toString(), account: "", debit: "", credit: "", memo: "" }])}
                className="text-sm  font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1 font-medium disabled:opacity-50"
              >
                <IconPlus size={13} /> Add Line
              </button>
            </div>

            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
              {newJournalLines.map((line, idx) => (
                <div key={line.id} className="flex gap-2.5 items-center">
                  <div className="w-[45%]">
                    <select
                      value={line.account}
                      disabled={isSubmitting}
                      onChange={(e) => {
                        const copy = [...newJournalLines];
                        copy[idx].account = e.target.value;
                        setNewJournalLines(copy);
                      }}
                      className="w-full border border-slate-200 rounded-xl px-2.5 py-2 outline-none bg-white disabled:bg-slate-50 text-body-primary"
                      required
                    >
                      <option value="">Select Ledger Account...</option>
                      {coa.map((acc) => (
                        <option key={acc.id} value={acc.name}>
                          {acc.id} - {acc.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="w-[25%]">
                    <input
                      type="number"
                      placeholder="Debit"
                      value={line.debit}
                      disabled={!!line.credit || isSubmitting}
                      onChange={(e) => {
                        const copy = [...newJournalLines];
                        copy[idx].debit = e.target.value;
                        setNewJournalLines(copy);
                      }}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 outline-none font-mono font-medium disabled:bg-slate-50 text-sm"
                    />
                  </div>

                  <div className="w-[25%]">
                    <input
                      type="number"
                      placeholder="Credit"
                      value={line.credit}
                      disabled={!!line.debit || isSubmitting}
                      onChange={(e) => {
                        const copy = [...newJournalLines];
                        copy[idx].credit = e.target.value;
                        setNewJournalLines(copy);
                      }}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 outline-none font-mono font-medium disabled:bg-slate-50 text-sm"
                    />
                  </div>

                  {newJournalLines.length > 2 && (
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => setNewJournalLines(newJournalLines.filter((l) => l.id !== line.id))}
                      className="text-red-500 hover:text-red-700 shrink-0 disabled:opacity-50"
                    >
                      <IconTrash size={15} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Validation Status Indicator */}
          <div className={cn(
            "p-3 rounded-xl border flex items-center justify-between text-sm  font-medium",
            isBalanced ? "bg-emerald-50 border-emerald-100 text-emerald-800" : "bg-rose-50 border-rose-100 text-rose-800"
          )}>
            <div className="flex items-center gap-1.5">
              <IconInfoCircle size={15} />
              <span>
                {isBalanced
                  ? "Ledger posting balances are in perfect equilibrium."
                  : `Lines are unbalanced. Difference: KES ${Math.abs(variance).toLocaleString()}`
                }
              </span>
            </div>
            <div className="font-mono">
              Dr: {totalDebits.toLocaleString()} | Cr: {totalCredits.toLocaleString()}
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-3">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => setIsNewJournalOpen(false)}
              className="px-4 py-2 border border-slate-200 rounded-xl text-slate-650 hover:bg-slate-50 transition-colors font-medium disabled:opacity-50 text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isBalanced || isSubmitting}
              className="px-4 py-2 bg-[#151936] text-white rounded-xl hover:bg-slate-800 disabled:opacity-50 transition-colors font-medium text-sm"
            >
              {isSubmitting ? "Posting..." : "Post Entry"}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── 6. New Account Modal ────────────────────────────────────────────── */}
      <Modal
        open={isNewAccountOpen}
        onClose={() => { if (!isSubmitting) setIsNewAccountOpen(false); }}
        title="Add Ledger Account"
        description="Configure account codes and classifications under the global chart of accounts."
        size="md"
      >
        <form onSubmit={handleCreateAccount} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <label className="text-base font-medium text-slate-700">Account Code</label>
              <input
                type="text"
                required
                placeholder="e.g. 1100"
                value={newAccId}
                onChange={(e) => setNewAccId(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 outline-none focus:border-slate-400 text-body-primary"
              />
            </div>
            <div className="grid gap-1.5">
              <label className="text-base font-medium text-slate-700">Classification</label>
              <select
                value={newAccType}
                onChange={(e) => setNewAccType(e.target.value as Account["type"])}
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 outline-none bg-white text-body-primary"
              >
                <option value="Asset">Asset</option>
                <option value="Liability">Liability</option>
                <option value="Equity">Equity</option>
                <option value="Revenue">Revenue</option>
                <option value="Expense">Expense</option>
              </select>
            </div>
          </div>

          <div className="grid gap-1.5">
            <label className="text-base font-medium text-slate-700">Account Title Name</label>
            <input
              type="text"
              required
              placeholder="e.g. NCBA Savings Reserve Account"
              value={newAccName}
              onChange={(e) => setNewAccName(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 outline-none focus:border-slate-400 text-body-primary"
            />
          </div>

          <div className="grid gap-1.5">
            <label className="text-base font-medium text-slate-700">Starting Balance (KES)</label>
            <input
              type="number"
              placeholder="0.00"
              value={newAccBalance}
              onChange={(e) => setNewAccBalance(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 outline-none focus:border-slate-400 text-body-primary"
            />
          </div>

          <div className="flex gap-2 justify-end pt-3">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => setIsNewAccountOpen(false)}
              className="px-4 py-2 border border-slate-200 rounded-xl text-slate-655 hover:bg-slate-50 transition-colors font-medium disabled:opacity-50 text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-[#151936] text-white rounded-xl hover:bg-slate-800 transition-colors font-medium disabled:opacity-50 text-sm"
            >
              {isSubmitting ? "Creating..." : "Create Account"}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── 7. Journal Detail Drawer ─────────────────────────────────────────── */}
      <Drawer
        open={Boolean(selectedJournal)}
        onClose={() => setSelectedJournal(null)}
        title={`Journal Entry: ${selectedJournal?.id ?? ""}`}
        width="28rem"
        footer={
          selectedJournal?.status === "Posted" && (
            <Button
              onClick={() => setVoidConfirmId(selectedJournal.id)}
              variant="secondary"
              className="w-full bg-white border-slate-200 text-rose-600 hover:bg-rose-50 hover:border-rose-200 shadow-sm"
            >
              <IconArrowBackUp size={16} className="mr-1.5" /> Void Ledger Entry
            </Button>
          )
        }
      >
        {selectedJournal && (
          <div className="space-y-6 text-slate-700 text-sm">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <div>
                <p className="text-desc-secondary">
                  {selectedJournal.date} • Entered by {selectedJournal.user}
                </p>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <h4 className="text-slate-400 mb-2 label-caps">Master Memo Description</h4>
                <p className="body-md text-slate-800 font-medium bg-slate-50 p-3 rounded-lg border border-slate-100 leading-snug">
                  {selectedJournal.memo}
                </p>
              </div>

              <div>
                <h4 className="text-slate-400 mb-2 label-caps">Ledger Split Lines</h4>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-base">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 label-caps">
                      <tr>
                        <th className="px-3 py-2 w-[60%]">Account</th>
                        <th className="px-3 py-2 text-right">Debit</th>
                        <th className="px-3 py-2 text-right">Credit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedJournal.lines.map((line, i) => (
                        <tr key={i} className="bg-white">
                          <td className="px-3 py-2.5 font-medium text-slate-700">{line.account}</td>
                          <td className="px-3 py-2.5 text-right font-mono text-slate-800">
                            {line.type === "debit" ? line.amount.toLocaleString(undefined, { minimumFractionDigits: 2 }) : "-"}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono text-slate-800">
                            {line.type === "credit" ? line.amount.toLocaleString(undefined, { minimumFractionDigits: 2 }) : "-"}
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-slate-50/80 border-t-2 border-slate-200 font-medium">
                        <td className="px-3 py-2.5 text-slate-600">Total Posted Balance</td>
                        <td className="px-3 py-2.5 text-right font-mono text-emerald-700">
                          {selectedJournal.debit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-emerald-700">
                          {selectedJournal.credit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <h4 className="text-slate-400 mb-3 label-caps">Audit Activity Log</h4>
                <div className="space-y-4 border-l-2 border-slate-100 ml-2 pl-4">
                  {selectedJournal.logs.map((log, i) => (
                    <div key={i} className="relative">
                      <div className="absolute -left-[21px] top-1 size-2.5 rounded-full bg-slate-350 ring-4 ring-white" />
                      <p className="text-slate-700 font-medium leading-snug text-base">{log.action}</p>
                      <p className="text-sm text-slate-400 mt-0.5">{log.time} • {log.user}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </Drawer>


      {/* ── 8. Void Confirmation Dialog ──────────────────────────────────────── */}
      <ConfirmDialog
        open={!!voidConfirmId}
        onClose={() => setVoidConfirmId(null)}
        onConfirm={handleVoidEntry}
        title="Void Ledger Transaction"
        description="Are you sure you want to void this entry? This action will write a reversing journal transaction directly to the general ledger, restoring previous account balances. This cannot be undone."
        confirmLabel="Void Ledger Entry"
        tone="danger"
      />

      {/* ── 9. Chart of Accounts Detail Drawer ───────────────────────────────── */}
      {selectedCoaAccount && (
        <Drawer
          open={!!selectedCoaAccount}
          onClose={() => setSelectedCoaAccount(null)}
          title={`Account Details: ${selectedCoaAccount.id}`}
          width="32rem"
        >
          <div className="space-y-6">

            {/* Account Info Card */}
            <div className="bg-slate-50 border border-slate-200/70 p-4 rounded-xl shadow-sm">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="text-slate-400 label-caps">Account Title</h4>
                  <p className="mt-1 text-title-primary">{selectedCoaAccount.name}</p>
                </div>
                <Badge
                  tone={
                    selectedCoaAccount.type === "Asset" ? "primary" :
                      selectedCoaAccount.type === "Liability" ? "warning" :
                        selectedCoaAccount.type === "Equity" ? "neutral" :
                          selectedCoaAccount.type === "Revenue" ? "success" : "data"
                  }
                  className="py-0.5 px-2 font-medium"
                >
                  {selectedCoaAccount.type}
                </Badge>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-200/50 flex justify-between items-center">
                <span className="text-desc-secondary">Current Balance</span>
                <span className="text-slate-805 mono-data">
                  {selectedCoaAccount.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })} KES
                </span>
              </div>
            </div>

            {/* General Ledger Postings */}
            <div>
              <h4 className="text-slate-400 mb-2.5 label-caps">General Ledger Postings ({selectedAccountTransactions.length})</h4>
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                {selectedAccountTransactions.length > 0 ? (
                  <table className="w-full text-left text-base">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 label-caps">
                      <tr>
                        <th className="px-3 py-2 w-[110px]">Date/Ref</th>
                        <th className="px-3 py-2">Details</th>
                        <th className="px-3 py-2 text-right">Debit</th>
                        <th className="px-3 py-2 text-right">Credit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100/80 bg-white">
                      {selectedAccountTransactions.map((tx) => {
                        const matchedLines = tx.lines.filter(l => l.account === selectedCoaAccount.name);
                        return matchedLines.map((line, idx) => (
                          <tr key={`${tx.id}-${idx}`} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-3 py-2.5">
                              <p className="font-mono text-sm text-slate-400">{tx.date}</p>
                              <p className="text-[#151936] mt-0.5 mono-data">{tx.id}</p>
                            </td>
                            <td className="px-3 py-2.5">
                              <p className="text-base text-slate-700 truncate max-w-[140px]" title={tx.memo}>{tx.memo}</p>
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono text-slate-750 font-medium">
                              {line.type === "debit" ? line.amount.toLocaleString(undefined, { minimumFractionDigits: 2 }) : "-"}
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono text-slate-750 font-medium">
                              {line.type === "credit" ? line.amount.toLocaleString(undefined, { minimumFractionDigits: 2 }) : "-"}
                            </td>
                          </tr>
                        ));
                      })}
                    </tbody>
                  </table>
                ) : (
                  <div className="py-8 text-center text-base text-slate-450 bg-white flex flex-col items-center gap-1.5">
                    <IconScale size={20} className="text-slate-300" />
                    <span>No ledger postings found for this account</span>
                  </div>
                )}
              </div>
            </div>

            {/* Audit Trail Logs */}
            <div>
              <h4 className="text-slate-400 mb-3 label-caps">Audit Activity Log</h4>
              <div className="space-y-4 border-l-2 border-slate-100 ml-2 pl-4">
                <div className="relative">
                  <div className="absolute -left-[21px] top-1 size-2.5 rounded-full bg-slate-300 ring-4 ring-white" />
                  <p className="text-slate-700 font-medium leading-snug text-base">Account verified in General Ledger audit</p>
                  <p className="text-sm text-slate-400 mt-0.5">Today • System Automator</p>
                </div>
                <div className="relative">
                  <div className="absolute -left-[21px] top-1 size-2.5 rounded-full bg-slate-200 ring-4 ring-white" />
                  <p className="text-slate-700 font-medium leading-snug text-base">Account initialization completed</p>
                  <p className="text-sm text-slate-400 mt-0.5">2026-06-01 • Finance Manager</p>
                </div>
              </div>
            </div>

          </div>
        </Drawer>
      )}

      {/* ── 10. Account Reconciliation Drawer ───────────────────────────────── */}
      {reconciliationAccount && (
        <Drawer
          open={!!reconciliationAccount}
          onClose={() => setReconciliationAccount(null)}
          title={`Account Reconciliation: ${reconciliationAccount.name}`}
          width="32rem"
        >
          <div className="space-y-6">
            {/* Summary block */}
            <div className="bg-slate-50 border border-slate-200/70 p-4 rounded-xl shadow-sm space-y-2">
              <div className="flex justify-between items-center text-base">
                <span className="text-desc-secondary">Ledger Book Balance</span>
                <span className="font-mono font-medium text-slate-800">
                  {reconciliationAccount.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })} KES
                </span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-slate-200/50 text-base">
                <span className="text-slate-550 font-medium">Bank/Statement Balance</span>
                <span className="font-mono font-medium text-[#151936]">
                  {(parseFloat(bankStatementBalance) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} KES
                </span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-slate-200/50 font-medium text-base">
                <span className="text-slate-600 font-medium">Variance Detected</span>
                <span className={cn(
                  "font-mono text-base font-medium",
                  (parseFloat(bankStatementBalance) || 0) - reconciliationAccount.balance === 0
                    ? "text-emerald-600"
                    : "text-rose-600"
                )}>
                  {((parseFloat(bankStatementBalance) || 0) - reconciliationAccount.balance).toLocaleString(undefined, { minimumFractionDigits: 2 })} KES
                </span>
              </div>
            </div>

            {/* Reconciliation Fields Form */}
            <div className="space-y-4">
              <div className="grid gap-1.5">
                <label className="text-slate-500 label-caps">Bank Statement Ending Balance</label>
                <div className="relative">
                  <input
                    type="number"
                    value={bankStatementBalance}
                    onChange={(e) => setBankStatementBalance(e.target.value)}
                    placeholder="Enter statement balance"
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 outline-none focus:border-slate-400 transition-colors text-body-primary"
                  />
                  <span className="absolute right-3 top-3 text-sm text-slate-400 font-medium font-mono">KES</span>
                </div>
              </div>

              {/* Transactions Match list */}
              <div>
                <label className="text-slate-500 block mb-2 label-caps">Match Statement Postings</label>
                <div className="border border-slate-150 rounded-xl overflow-hidden shadow-sm max-h-48 overflow-y-auto divide-y divide-slate-100 bg-white">
                  {journals.filter(j => j.status === "Posted" && j.lines.some(l => l.account === reconciliationAccount.name)).length > 0 ? (
                    journals.filter(j => j.status === "Posted" && j.lines.some(l => l.account === reconciliationAccount.name)).map(tx => {
                      const matchedLine = tx.lines.find(l => l.account === reconciliationAccount.name);
                      const isMatched = matchedTxIds.includes(tx.id);
                      return (
                        <div
                          key={tx.id}
                          onClick={() => {
                            setMatchedTxIds(prev =>
                              isMatched ? prev.filter(id => id !== tx.id) : [...prev, tx.id]
                            );
                          }}
                          className={cn(
                            "flex items-center justify-between p-3 cursor-pointer hover:bg-slate-50/50 transition-colors text-sm",
                            isMatched && "bg-slate-50/80"
                          )}
                        >
                          <div className="flex items-center gap-2.5">
                            <input
                              type="checkbox"
                              checked={isMatched}
                              onChange={() => { }} // Handled by outer div onClick
                              className="rounded border-slate-300 text-[#151936] focus:ring-[#151936]"
                            />
                            <div>
                              <p className="font-medium text-slate-700">{tx.memo}</p>
                              <p className="text-sm  text-slate-400 font-mono mt-0.5">{tx.id} • {tx.date}</p>
                            </div>
                          </div>
                          <span className="font-mono text-slate-750 font-medium">
                            {matchedLine ? (matchedLine.type === "debit" ? "+" : "-") : ""}
                            {matchedLine?.amount.toLocaleString()}
                          </span>
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-4 text-center text-slate-450 text-sm">No ledger postings to match.</div>
                  )}
                </div>
              </div>

              {/* Reconciliation Notes */}
              <div className="grid gap-1.5">
                <label className="text-slate-500 label-caps">Audit & Reconciliation Notes</label>
                <textarea
                  rows={3}
                  value={reconNotes}
                  onChange={(e) => setReconNotes(e.target.value)}
                  placeholder="Describe matching variances, timing differences, etc."
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 outline-none focus:border-slate-400 transition-colors text-body-primary"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setReconciliationAccount(null)}
                className="px-4 py-2 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors text-body-regular"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleSaveReconciliation}
                className="px-4 py-2 bg-[#151936] hover:bg-slate-800 text-white rounded-xl transition-colors font-medium text-sm"
              >
                Record Reconciliation Audit
              </button>
            </div>

            {/* Reconciliation History List */}
            <div>
              <h4 className="text-slate-400 mb-2.5 label-caps">Reconciliation Logs</h4>
              <div className="space-y-2.5 max-h-48 overflow-y-auto pl-1">
                {reconciliationHistory[reconciliationAccount.id]?.length > 0 ? (
                  reconciliationHistory[reconciliationAccount.id].map((h, i) => (
                    <div key={i} className="border border-slate-150 p-3 rounded-xl bg-white space-y-1.5 shadow-sm text-base">
                      <div className="flex justify-between items-center text-sm  text-slate-400 font-mono">
                        <span>{h.date}</span>
                        <span className="bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-sans font-medium">Reconciled</span>
                      </div>
                      <p className="text-slate-700 font-medium">{h.notes}</p>
                      <div className="grid grid-cols-3 gap-1 pt-1.5 border-t border-slate-100 font-mono text-sm text-slate-505">
                        <div>
                          <p className="uppercase font-sans text-slate-400 font-medium text-sm">Bank Bal</p>
                          <p className="text-slate-750 font-medium">{h.statementBalance.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="uppercase font-sans text-slate-400 font-medium text-sm">Ledger Bal</p>
                          <p className="text-slate-750 font-medium">{h.ledgerBalance.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="uppercase font-sans text-slate-400 font-medium text-sm">Variance</p>
                          <p className={cn("font-medium", h.variance === 0 ? "text-emerald-600" : "text-rose-600")}>
                            {h.variance.toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-base text-slate-400 py-3 pl-2 font-medium">No past reconciliation events registered.</div>
                )}
              </div>
            </div>
          </div>
        </Drawer>
      )}

      {/* ── 11. Cash Flow Reclassification Drawer ───────────────────────────────── */}
      {reclassLine && (
        <Drawer
          open={!!reclassLine}
          onClose={() => setReclassLine(null)}
          title="Reclassify Cash Movement"
          width="26rem"
        >
          <div className="space-y-6">
            <div className="bg-slate-50 border border-slate-200/70 p-4 rounded-xl shadow-sm">
              <span className="text-slate-400 label-caps">Line Item Title</span>
              <p className="font-medium text-slate-808 mt-1 body-md">{reclassLine.name}</p>
              <div className="mt-3 pt-3 border-t border-slate-200/50 flex justify-between items-center">
                <span className="text-desc-secondary">Transaction Amount</span>
                <span className="text-body-primary">
                  {reclassLine.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} KES
                </span>
              </div>
              <div className="mt-2 flex justify-between items-center">
                <span className="text-sm  text-slate-505 font-medium">Current Category</span>
                <Badge tone="data" className="font-medium">{reclassLine.category}</Badge>
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-slate-550 block label-caps">Assign Cash Flow Activity Category</label>
              <div className="grid gap-2">
                {(["Operating", "Investing", "Financing"] as const).map((cat) => {
                  const isCurrent = reclassLine.category === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => handleReclassifyLine(cat)}
                      className={cn(
                        "w-full flex items-center justify-between p-3.5 border rounded-xl text-left transition-all duration-200",
                        isCurrent
                          ? "border-[#151936] bg-[#151936]/5 text-[#151936]"
                          : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/50 text-slate-700"
                      )}
                    >
                      <div>
                        <p className="text-sm  font-medium">{cat} Activities</p>
                        <p className="text-sm text-slate-400 mt-0.5">
                          {cat === "Operating" && "Direct cash flows related to core business revenue and expense."}
                          {cat === "Investing" && "Cash transactions for purchasing capital assets or long-term investments."}
                          {cat === "Financing" && "Capital structure cash flows like debt, equity, and landlord distribution."}
                        </p>
                      </div>
                      {isCurrent && (
                        <span className="font-mono label-caps">Active</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setReclassLine(null)}
                className="px-4 py-2 border border-slate-205 rounded-xl hover:bg-slate-50 transition-colors w-full text-body-regular"
              >
                Cancel
              </button>
            </div>
          </div>
        </Drawer>
      )}
    </div>
  );
}
