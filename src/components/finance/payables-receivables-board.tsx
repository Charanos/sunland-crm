"use client";

import { useState, useMemo, useEffect } from "react";
import {
  IconSearch,
  IconCoins,
  IconClock,
  IconBuilding,
  IconCheck,
  IconArrowUpRight,
  IconTrendingDown,
  IconUser,
  IconShieldCheck,
  IconReceipt2,
  IconBan,
  IconTimeline,
  IconTransfer,
  IconScale
} from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast-provider";
import { Modal } from "@/components/ui/modal";
import { Drawer } from "@/components/ui/drawer";
import { FinanceModuleNav } from "@/components/finance/finance-module-nav";
import { FinanceQrProof } from "@/components/finance/finance-qr-proof";
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
import { cn } from "@/lib/utils/cn";
import { formatCompactKES } from "@/lib/utils/format";
import { getEntityById } from "@/data/entities";
import { useUIStore } from "@/store/ui";

// ─── Interfaces ──────────────────────────────────────────────────────────────

interface BillRecord {
  id: string;
  billCode: string;
  vendorName: string;
  category: "Utilities" | "Maintenance" | "Security" | "Marketing" | "Legal" | "Other";
  amount: number;
  dueDate: string;
  status: "Pending" | "Posted";
  propertyName: string;
  description: string;
  owner: string;
  source: "Operations" | "Front Office" | "Finance" | "Mandates";
  disputed?: boolean;
  activityLog: string[];
  paidDate?: string;
  bankRef?: string;
  bankAccount?: string;
}

interface InvoiceRecord {
  id: string;
  invoiceCode: string;
  clientName: string;
  amount: number;
  dueDate: string;
  status: "Pending" | "Posted" | "Overdue";
  propertyName: string;
  description: string;
  owner: string;
  source: "Valuers" | "BD" | "Finance" | "Mandates";
  disputed?: boolean;
  activityLog: string[];
  receivedDate?: string;
  payMethod?: "M-Pesa" | "Bank Transfer" | "Cheque" | "Cash";
  bankRef?: string;
  bankAccount?: string;
}

// ─── Initial Mock Data ────────────────────────────────────────────────────────

const INITIAL_BILLS: BillRecord[] = [
  {
    id: "b1",
    billCode: "BILL-118",
    vendorName: "Apex Plumbing Services",
    category: "Maintenance",
    amount: 340000,
    dueDate: "2026-06-25",
    status: "Pending",
    propertyName: "Westpoint Apartments",
    description: "Main lift water pump replacement and line cleaning",
    owner: "Operations Lead",
    source: "Operations",
    activityLog: ["Created by Operations Lead", "Finance review queued", "Vendor W-9 and invoice matched"]
  },
  {
    id: "b2",
    billCode: "BILL-117",
    vendorName: "Sheriff Security Ltd",
    category: "Security",
    amount: 420000,
    dueDate: "2026-06-22",
    status: "Posted",
    propertyName: "Multiple Managed Sites",
    description: "Guard services for June 2026 cycle",
    owner: "Finance Officer",
    source: "Finance",
    activityLog: ["Created by Finance Officer", "Three-site allocation confirmed", "Paid and posted to AP journal"],
    paidDate: "2026-06-21",
    bankRef: "FT-99102-KCB",
    bankAccount: "NCBA Operating A/C"
  },
  {
    id: "b3",
    billCode: "BILL-116",
    vendorName: "Kenya Power & Lighting",
    category: "Utilities",
    amount: 154000,
    dueDate: "2026-06-18",
    status: "Posted",
    propertyName: "Riverside Residences",
    description: "Common area electricity monthly billing",
    owner: "Front Office Admin",
    source: "Front Office",
    activityLog: ["Utility bill received", "Meter reading matched", "Paid through M-Pesa wallet"],
    paidDate: "2026-06-16",
    bankRef: "MP-TX982A-KPLC",
    bankAccount: "NCBA Operating A/C"
  },
  {
    id: "b4",
    billCode: "BILL-115",
    vendorName: "Nairobi Water Company",
    category: "Utilities",
    amount: 68000,
    dueDate: "2026-06-29",
    status: "Pending",
    propertyName: "Kilimani Heights",
    description: "Water consumption invoice",
    owner: "Front Office Admin",
    source: "Front Office",
    disputed: true,
    activityLog: ["Invoice created", "Variance flagged against prior month", "Dispute hold opened with vendor"]
  },
  {
    id: "b5",
    billCode: "BILL-114",
    vendorName: "Corporate Cleaners Ltd",
    category: "Maintenance",
    amount: 95000,
    dueDate: "2026-06-12",
    status: "Posted",
    propertyName: "Runda Executive Annex",
    description: "Facade pressure wash",
    owner: "Operations Lead",
    source: "Operations",
    activityLog: ["Created from contractor completion note", "Site supervisor verified", "Paid and posted"],
    paidDate: "2026-06-10",
    bankRef: "FT-22910-NCBA",
    bankAccount: "NCBA Operating A/C"
  }
];

const INITIAL_INVOICES: InvoiceRecord[] = [
  {
    id: "inv1",
    invoiceCode: "INV-204",
    clientName: "Quick Logistics Ltd",
    amount: 185000,
    dueDate: "2026-06-10",
    status: "Overdue",
    propertyName: "Kilimani Business Center",
    description: "Commercial unit valuation assessment invoice",
    owner: "Valuers Desk",
    source: "Valuers",
    activityLog: ["Invoice generated by Valuers", "Client reminder sent", "Overdue escalation queued"]
  },
  {
    id: "inv2",
    invoiceCode: "INV-203",
    clientName: "Mary Wanjiku",
    amount: 95000,
    dueDate: "2026-06-30",
    status: "Pending",
    propertyName: "Westpoint Apartments",
    description: "Residential lease preparation fee",
    owner: "Rentals Officer",
    source: "BD",
    activityLog: ["Fee invoice issued", "Tenant notified", "Awaiting receipt reference"]
  },
  {
    id: "inv3",
    invoiceCode: "INV-202",
    clientName: "Global Trade Inc",
    amount: 250000,
    dueDate: "2026-06-15",
    status: "Posted",
    propertyName: "Riverside Residences",
    description: "Commercial office lease documentation charge",
    owner: "Finance Officer",
    source: "Finance",
    activityLog: ["Invoice issued", "Bank transfer matched", "Receipt posted to AR journal"],
    receivedDate: "2026-06-14",
    payMethod: "Bank Transfer",
    bankRef: "FT-66251-STANCHART",
    bankAccount: "Co-op Reserve A/C"
  },
  {
    id: "inv4",
    invoiceCode: "INV-201",
    clientName: "Dr. Arthur Morgan",
    amount: 150000,
    dueDate: "2026-06-02",
    status: "Posted",
    propertyName: "Gigiri Heights",
    description: "Consultancy valuation fee",
    owner: "Valuers Desk",
    source: "Valuers",
    activityLog: ["Valuation report delivered", "M-Pesa code verified", "Receipt posted"],
    receivedDate: "2026-06-02",
    payMethod: "M-Pesa",
    bankRef: "MP-GH382K-KES",
    bankAccount: "NCBA Operating A/C"
  },
  {
    id: "inv5",
    invoiceCode: "INV-200",
    clientName: "Dennis Munge",
    amount: 80000,
    dueDate: "2026-05-28",
    status: "Posted",
    propertyName: "Hurlingham Court",
    description: "Residential agency commission fee",
    owner: "BD Agent",
    source: "BD",
    activityLog: ["Agency fee raised", "Client payment matched", "Receipt posted"],
    receivedDate: "2026-05-27",
    payMethod: "M-Pesa",
    bankRef: "MP-DM992P-KES",
    bankAccount: "NCBA Operating A/C"
  }
];

const INITIAL_CHART_DATA = [
  { month: "Jan", Invoiced: 1200000, Bills: 950000 },
  { month: "Feb", Invoiced: 1450000, Bills: 1100000 },
  { month: "Mar", Invoiced: 1600000, Bills: 1400000 },
  { month: "Apr", Invoiced: 1950000, Bills: 1600000 },
  { month: "May", Invoiced: 1750000, Bills: 1250000 },
  { month: "Jun", Invoiced: 1100000, Bills: 1082000 }
];

const ROWS_PER_PAGE = 5;
const WORK_DATE = new Date("2026-06-22T00:00:00");
const formatMoney = (value: number) => formatCompactKES(value);
const formatDate = (value: string) =>
  new Intl.DateTimeFormat("en-KE", { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${value}T00:00:00`));
const agingDays = (date: string) =>
  Math.ceil((WORK_DATE.getTime() - new Date(`${date}T00:00:00`).getTime()) / 86_400_000);
const agingBucket = (date: string, isClosed: boolean) => {
  if (isClosed) return "Settled";
  const days = agingDays(date);
  if (days <= 0) return "Current";
  if (days <= 30) return "1-30";
  if (days <= 60) return "31-60";
  if (days <= 90) return "61-90";
  return "90+";
};
const recordRisk = (date: string, isClosed: boolean, disputed?: boolean) => {
  if (isClosed) return "Posted";
  if (disputed) return "Dispute Hold";
  const days = agingDays(date);
  if (days > 0) return "Overdue";
  if (days >= -3) return "Due Soon";
  return "Current";
};

export function PayablesReceivablesBoard({ tabId = "payables" }: { tabId: string }) {
  const { pushToast } = useToast();
  const activeEntityId = useUIStore((state) => state.activeEntityId);
  const activeEntity = getEntityById(activeEntityId);
  const [mounted, setMounted] = useState(false);

  // Sync tab active segment
  const activeTab = tabId;

  // Search & pagination state
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);

  // Data states
  const [bills, setBills] = useState<BillRecord[]>(INITIAL_BILLS);
  const [invoices, setInvoices] = useState<InvoiceRecord[]>(INITIAL_INVOICES);
  const [chartData, setChartData] = useState(INITIAL_CHART_DATA);

  // Modals & drawers state
  const [selectedBill, setSelectedBill] = useState<BillRecord | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceRecord | null>(null);
  const [payBill, setPayBill] = useState<BillRecord | null>(null);
  const [recordReceipt, setRecordReceipt] = useState<InvoiceRecord | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State - Pay Bill
  const [billPayAccount, setBillPayAccount] = useState("NCBA Operating A/C");
  const [billPayRef, setBillPayRef] = useState("");

  // Form State - Record Receipt
  const [receiptAccount, setReceiptAccount] = useState("NCBA Operating A/C");
  const [receiptMethod, setReceiptMethod] = useState<NonNullable<InvoiceRecord["payMethod"]>>("Bank Transfer");
  const [receiptRef, setReceiptRef] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(t);
  }, []);

  const openPayModalFor = (bill: BillRecord) => {
    setPayBill(bill);
    setBillPayRef("");
  };

  const openReceiptModalFor = (invoice: InvoiceRecord) => {
    setRecordReceipt(invoice);
    setReceiptRef("");
  };

  // --- Handlers ---

  const handlePayBillSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payBill || !billPayRef) return;
    setIsSubmitting(true);
    // Simulate GL payment validation
    await new Promise(resolve => setTimeout(resolve, 600));

    const todayStr = new Date().toISOString().split("T")[0];

    setBills(prev =>
      prev.map(b => {
        if (b.id === payBill.id) {
          return {
            ...b,
            status: "Posted",
            paidDate: todayStr,
            bankRef: billPayRef,
            bankAccount: billPayAccount
          };
        }
        return b;
      })
    );

    // Update June chart bills categories reactively
    setChartData(prev =>
      prev.map(c => (c.month === "Jun" ? { ...c, Bills: c.Bills + payBill.amount } : c))
    );

    setPayBill(null);
    setIsSubmitting(false);

    pushToast({
      tone: "success",
      title: "Vendor Bill Settled",
      body: `Bill ${payBill.billCode} to ${payBill.vendorName} of ${formatMoney(payBill.amount)} marked as paid via ${billPayAccount}.`
    });
  };

  const handleRecordReceiptSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recordReceipt || !receiptRef) return;
    setIsSubmitting(true);
    // Simulate double-entry receipt accrual posting
    await new Promise(resolve => setTimeout(resolve, 600));

    const todayStr = new Date().toISOString().split("T")[0];

    setInvoices(prev =>
      prev.map(inv => {
        if (inv.id === recordReceipt.id) {
          return {
            ...inv,
            status: "Posted",
            receivedDate: todayStr,
            payMethod: receiptMethod,
            bankRef: receiptRef,
            bankAccount: receiptAccount
          };
        }
        return inv;
      })
    );

    // Update June chart invoiced categories reactively
    setChartData(prev =>
      prev.map(c => (c.month === "Jun" ? { ...c, Invoiced: c.Invoiced + recordReceipt.amount } : c))
    );

    setRecordReceipt(null);
    setIsSubmitting(false);

    pushToast({
      tone: "success",
      title: "Receipt Logged Successfully",
      body: `Invoice ${recordReceipt.invoiceCode} for ${recordReceipt.clientName} of ${formatMoney(recordReceipt.amount)} confirmed via ${receiptMethod}.`
    });
  };

  const handleToggleDispute = (recordId: string, type: "bill" | "invoice") => {
    if (type === "bill") {
      let nextSelectedBill: BillRecord | null = null;
      setBills(prev =>
        prev.map(b => {
          if (b.id !== recordId) return b;
          const nextBill = {
            ...b,
            disputed: !b.disputed,
            activityLog: [
              `${!b.disputed ? "Dispute hold opened" : "Dispute hold cleared"} by Finance Control`,
              ...b.activityLog
            ]
          };
          nextSelectedBill = nextBill;
          return nextBill;
        }
        )
      );
      if (selectedBill?.id === recordId) {
        setSelectedBill(nextSelectedBill);
      }
    } else {
      let nextSelectedInvoice: InvoiceRecord | null = null;
      setInvoices(prev =>
        prev.map(inv => {
          if (inv.id !== recordId) return inv;
          const nextInvoice = {
            ...inv,
            disputed: !inv.disputed,
            activityLog: [
              `${!inv.disputed ? "Dispute hold opened" : "Dispute hold cleared"} by Finance Control`,
              ...inv.activityLog
            ]
          };
          nextSelectedInvoice = nextInvoice;
          return nextInvoice;
        }
        )
      );
      if (selectedInvoice?.id === recordId) {
        setSelectedInvoice(nextSelectedInvoice);
      }
    }

    pushToast({
      tone: "info",
      title: "Dispute State Updated",
      body: "Aging escalation has been adjusted and the record audit trail was updated."
    });
  };

  // --- Calculations ---

  const metrics = useMemo(() => {
    const unpaidBills = bills.filter(b => b.status === "Pending").reduce((sum, b) => sum + b.amount, 0);

    const unpaidInvoices = invoices.filter(inv => inv.status !== "Posted").reduce((sum, inv) => sum + inv.amount, 0);

    const netCapital = unpaidInvoices - unpaidBills;
    const overdueCount = invoices.filter(inv => inv.status === "Overdue").length;
    const disputeCount = bills.filter(b => b.disputed).length + invoices.filter(inv => inv.disputed).length;
    const dueThisWeek = [
      ...bills.filter(b => b.status === "Pending"),
      ...invoices.filter(inv => inv.status !== "Posted")
    ].filter(item => agingDays(item.dueDate) >= -7 && agingDays(item.dueDate) <= 0).length;
    const postedCash = bills.filter(b => b.status === "Posted").reduce((sum, b) => sum - b.amount, 0) +
      invoices.filter(inv => inv.status === "Posted").reduce((sum, inv) => sum + inv.amount, 0);

    return {
      payables: unpaidBills,
      receivables: unpaidInvoices,
      capital: netCapital,
      overdue: overdueCount,
      disputes: disputeCount,
      dueThisWeek,
      postedCash
    };
  }, [bills, invoices]);

  const exceptionQueue = useMemo(() => {
    const billItems = bills
      .filter(b => b.status === "Pending" && (b.disputed || agingDays(b.dueDate) >= -3))
      .map(b => ({
        id: b.id,
        ref: b.billCode,
        label: b.vendorName,
        meta: `${b.source} - ${b.propertyName}`,
        amount: b.amount,
        tone: b.disputed ? "risk" as const : "warning" as const,
        status: recordRisk(b.dueDate, false, b.disputed)
      }));
    const invoiceItems = invoices
      .filter(inv => inv.status !== "Posted" && (inv.disputed || inv.status === "Overdue" || agingDays(inv.dueDate) >= -3))
      .map(inv => ({
        id: inv.id,
        ref: inv.invoiceCode,
        label: inv.clientName,
        meta: `${inv.source} - ${inv.propertyName}`,
        amount: inv.amount,
        tone: inv.status === "Overdue" || inv.disputed ? "risk" as const : "warning" as const,
        status: recordRisk(inv.dueDate, inv.status === "Posted", inv.disputed)
      }));

    return [...invoiceItems, ...billItems].slice(0, 5);
  }, [bills, invoices]);

  // Filters and search logic
  const filteredRows = useMemo(() => {
    if (activeTab === "payables") {
      return bills.filter(b =>
        b.billCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.vendorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.propertyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    } else {
      return invoices.filter(inv =>
        inv.invoiceCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inv.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inv.propertyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inv.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
  }, [bills, invoices, activeTab, searchQuery]);

  const paginatedRows = useMemo(() => {
    return filteredRows.slice((page - 1) * ROWS_PER_PAGE, page * ROWS_PER_PAGE);
  }, [filteredRows, page]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / ROWS_PER_PAGE));

  if (!mounted) return <div className="h-screen w-full skeleton-shimmer bg-slate-50" />;

  return (
    <div className="mx-auto flex max-w-[98rem] flex-col gap-4 animate-fade-in pb-12">
      <BoardHeader
        title="Payables & Receivables Board"
        description="Verify vendor bills and client invoices, reconcile payments, and track net working capital position."
      />

      <FinanceModuleNav />

      <section className="grid grid-cols-1 xl:grid-cols-[1.15fr_0.85fr] gap-4 animate-fade-in-up">
        <div className="relative min-h-[255px] overflow-hidden rounded-2xl border border-slate-800/80 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 p-8 text-white shadow-2xl">
          {/* Subtle Institutional Grid Background Pattern */}
          <div
            className="absolute inset-0 opacity-[0.04] mix-blend-overlay"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='30' height='30' viewBox='0 0 30 30' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h30v30H0V0zm1 1h28v28H1V1z' fill='%23ffffff' fill-opacity='0.15' fill-rule='evenodd'/%3E%3C/svg%3E")`,
              backgroundSize: "30px 30px"
            }}
          />

          {/* Premium Unsplash Background with low opacity */}
          <div
            className="absolute inset-0 opacity-[0.06] mix-blend-luminosity"
            style={{
              backgroundImage: `url(https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=2564&auto=format&fit=crop)`,
              backgroundSize: "cover",
              backgroundPosition: "center"
            }}
          />

          {/* Subtle Glowing Accent */}
          <div className="absolute -top-24 -left-24 h-64 w-64 rounded-full bg-slate-500/10 blur-3xl" />
          <div className="absolute -bottom-24 -right-24 h-64 w-64 rounded-full bg-emerald-500/5 blur-3xl" />

          <div className="relative z-10 flex h-full flex-col justify-between gap-8">
            <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-8 w-full">
              {/* Left Column: Context & Title */}
              <div className="max-w-xl space-y-5">
                <div className="flex items-center gap-3">
                  <Badge tone="primary" className="bg-slate-700/60 text-slate-200 border-slate-600/50 px-3 py-1 shadow-sm backdrop-blur-md">
                    {activeEntity.name}
                  </Badge>
                  <span className="label-caps tracking-wider text-meta-muted">Treasury Control Console</span>
                </div>
                <div>
                  <h2 className="title-serif font-normal leading-tight tracking-tight text-white mb-3">
                    Treasury Settlement
                  </h2>
                  <p className="leading-relaxed text-slate-300 font-normal max-w-lg body-md">
                    Monitor vendor payables, verify external client receivables, enforce approval thresholds, and manage corporate cash postings on a dedicated, isolated sub-ledger.
                  </p>
                </div>

                <div className="pt-2 flex items-center gap-4">
                  <div className="flex -space-x-2.5">
                    <div className="size-8 rounded-full border-2 border-slate-900 bg-slate-700 flex items-center justify-center font-medium text-white shadow-md transition-all duration-300 hover:scale-125 hover:z-10 hover:translate-y-[-2px] cursor-pointer text-sm" title="Controller: John Doe">JD</div>
                    <div className="size-8 rounded-full border-2 border-slate-900 bg-slate-600 flex items-center justify-center font-medium text-white shadow-md transition-all duration-300 hover:scale-125 hover:z-10 hover:translate-y-[-2px] cursor-pointer text-sm" title="Controller: Alice M.">AM</div>
                    <div className="flex size-8 items-center justify-center rounded-full border-2 border-slate-900 bg-slate-800/80 font-medium text-slate-300 backdrop-blur-md shadow-sm transition-all duration-300 hover:scale-125 hover:z-10 hover:translate-y-[-2px] cursor-pointer text-sm">
                      +3
                    </div>
                  </div>
                  <span className="font-normal text-slate-400 body-sm">Active Controllers</span>
                </div>
              </div>

              {/* Right Column: Sleek HUD Panel */}
              <div className="w-full lg:max-w-xs shrink-0 self-stretch flex flex-col justify-center">
                <div className="relative overflow-hidden rounded-xl border border-white/10 bg-slate-950/45 p-5 shadow-2xl backdrop-blur-xl transition-all duration-500 hover:border-white/15 group">
                  {/* Subtle Grid overlay */}
                  <div className="absolute inset-0 opacity-[0.03] mix-blend-overlay bg-[url('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop')] bg-cover bg-center" />

                  <div className="relative z-10 flex flex-col gap-4">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 label-caps">Net Posted Cash Position</span>
                      <IconScale size={16} stroke={1.8} className="text-emerald-400" />
                    </div>

                    {/* Value Area */}
                    <div className="flex flex-col gap-0.5">
                      <div className={cn(
                        "text-3xl font-medium tracking-tight font-sans",
                        metrics.postedCash >= 0 ? "text-emerald-400" : "text-rose-400"
                      )}>
                        {formatCompactKES(metrics.postedCash)}
                      </div>
                      <span className="text-sm text-slate-400 font-medium tracking-wide">
                        Net balance of posted AR/AP ledger transactions
                      </span>
                    </div>

                    {/* Proportional Split Meter */}
                    {(() => {
                      const totalPR = metrics.payables + metrics.receivables || 1;
                      const payablePct = Math.round((metrics.payables / totalPR) * 100);
                      const receivablePct = 100 - payablePct;
                      return (
                        <div className="space-y-1.5 pt-1">
                          <div className="flex items-center justify-between text-slate-400 label-caps">
                            <span>Payables: {payablePct}%</span>
                            <span>Receivables: {receivablePct}%</span>
                          </div>
                          <div className="h-1 w-full rounded-full bg-slate-900/80 overflow-hidden flex border border-white/[0.02]">
                            <div style={{ width: `${payablePct}%` }} className="h-full bg-amber-500/70" />
                            <div style={{ width: `${receivablePct}%` }} className="h-full bg-indigo-500/70" />
                          </div>
                        </div>
                      );
                    })()}

                    {/* Divider */}
                    <div className="h-px bg-white/5 my-1" />

                    {/* Divider-divided bottom strip */}
                    <div className="grid grid-cols-3 divide-x divide-white/5 border border-white/5 rounded-lg bg-slate-950/20 text-center overflow-hidden">
                      <div className="py-2 px-1">
                        <div className="text-slate-400 label-caps">Due Soon</div>
                        <div className="mt-0.5 text-slate-200 font-mono text-sm font-normal">{metrics.dueThisWeek}</div>
                      </div>
                      <div className="py-2 px-1">
                        <div className="text-slate-400 label-caps">Disputes</div>
                        <div className="mt-0.5 text-slate-200 font-mono text-sm font-normal">{metrics.disputes}</div>
                      </div>
                      <div className="py-2 px-1">
                        <div className="text-slate-400 label-caps">Ledger</div>
                        <div className="mt-0.5 text-slate-200 font-mono text-sm font-normal">
                          {bills.filter(b => b.status === "Posted").length + invoices.filter(inv => inv.status === "Posted").length}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>

        <BoardPanel className="p-0 overflow-hidden flex flex-col h-full relative group shadow-lg border-slate-200">
          <div className="border-b border-slate-100/80 p-6 bg-white z-10 relative">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-medium text-slate-900 tracking-tight font-sans text-xl">Exception Run</h3>
                <p className="mt-1 text-desc-secondary">Prioritized items that need collection, settlement, or hold review.</p>
              </div>
              <Badge tone={exceptionQueue.length > 0 ? "warning" : "success"} className="shadow-sm px-3 py-1.5">{exceptionQueue.length} Active</Badge>
            </div>
          </div>
          <div className="divide-y divide-slate-100/80 flex-1 overflow-y-auto bg-slate-50/30">
            {exceptionQueue.map((item) => (
              <button
                key={`${item.ref}-${item.id}`}
                type="button"
                onClick={() => {
                  const bill = bills.find(b => b.id === item.id);
                  const invoice = invoices.find(inv => inv.id === item.id);
                  setSelectedBill(bill ?? null);
                  setSelectedInvoice(invoice ?? null);
                }}
                className="flex w-full items-center gap-4 p-5 text-left transition-all duration-300 hover:bg-white hover:shadow-[0_2px_15px_-3px_rgba(0,0,0,0.05)] hover:-translate-y-[1px] relative group/item"
              >
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500 opacity-0 group-hover/item:opacity-100 transition-opacity" />
                <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-slate-100/80 text-slate-400 group-hover/item:scale-110 group-hover/item:bg-indigo-50 group-hover/item:text-indigo-600 transition-all duration-300 shadow-sm">
                  <IconTimeline size={20} stroke={2} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2.5 mb-1">
                    <span className="text-slate-900 mono-amount">{item.ref}</span>
                    <Badge tone={item.tone} className="h-5 font-normal px-2 shadow-sm label-caps text-xs">{item.status}</Badge>
                  </div>
                  <p className="truncate font-medium text-slate-800 leading-snug body-md">{item.label}</p>
                  <p className="mt-0.5 truncate text-desc-secondary">{item.meta}</p>
                </div>
                <div className="text-right shrink-0">
                  <span className="tracking-tight text-slate-900 group-hover/item:text-indigo-700 transition-colors mono-stat">
                    {formatMoney(item.amount)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </BoardPanel>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-2">
        {/* KPI 1: Payables outstanding */}
        <BoardPanel className="p-5 flex flex-col justify-between min-h-[142px] relative overflow-hidden group transition-all duration-300 hover:shadow-md hover:-translate-y-1 hover:border-amber-250 bg-gradient-to-b from-white to-amber-50/10">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity translate-x-4 -translate-y-4">
            <IconTrendingDown size={100} stroke={1} />
          </div>
          <div className="flex items-center gap-3 relative z-10">
            <div className="size-8 rounded-xl bg-gradient-to-br from-amber-50 to-amber-100/50 text-amber-600 flex items-center justify-center shadow-sm border border-amber-200/50">
              <IconTrendingDown size={16} stroke={2.5} />
            </div>
            <span className="text-slate-400 label-caps text-xs">A/P Outstanding</span>
          </div>
          <div className="flex flex-col mt-auto relative z-10">
            <span className="font-mono font-normal tracking-tight text-[#151936] text-3xl">
              {formatMoney(metrics.payables)}
            </span>
            <span className="mt-1 text-desc-secondary">Pending vendor settlements</span>
          </div>
        </BoardPanel>

        {/* KPI 2: Receivables outstanding */}
        <BoardPanel className="p-5 flex flex-col justify-between min-h-[142px] relative overflow-hidden group transition-all duration-300 hover:shadow-md hover:-translate-y-1 hover:border-indigo-250 bg-gradient-to-b from-white to-indigo-50/10">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity translate-x-4 -translate-y-4">
            <IconArrowUpRight size={100} stroke={1} />
          </div>
          <div className="flex items-center gap-3 relative z-10">
            <div className="size-8 rounded-xl bg-gradient-to-br from-indigo-50 to-indigo-100/50 text-indigo-600 flex items-center justify-center shadow-sm border border-indigo-200/50">
              <IconArrowUpRight size={16} stroke={2.5} />
            </div>
            <span className="text-slate-400 label-caps text-xs">A/R Outstanding</span>
          </div>
          <div className="flex flex-col mt-auto relative z-10">
            <span className="font-mono font-normal tracking-tight text-[#151936] text-3xl">
              {formatMoney(metrics.receivables)}
            </span>
            <span className="mt-1 text-desc-secondary">Awaiting client receipts</span>
          </div>
        </BoardPanel>

        {/* KPI 3: Net position */}
        <BoardPanel className="p-5 flex flex-col justify-between min-h-[142px] relative overflow-hidden group transition-all duration-300 hover:shadow-md hover:-translate-y-1 hover:border-emerald-250 bg-gradient-to-b from-white to-emerald-50/10">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity translate-x-4 -translate-y-4">
            <IconCoins size={100} stroke={1} />
          </div>
          <div className="flex items-center gap-3 relative z-10">
            <div className="size-8 rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100/50 text-emerald-600 flex items-center justify-center shadow-sm border border-emerald-200/50">
              <IconCoins size={16} stroke={2.5} />
            </div>
            <span className="text-slate-400 label-caps text-xs">Net Working Capital</span>
          </div>
          <div className="flex flex-col mt-auto relative z-10">
            <span className={cn(
              "text-3xl font-mono font-normal tracking-tight",
              metrics.capital >= 0 ? "text-emerald-700" : "text-rose-600"
            )}>
              {formatMoney(metrics.capital)}
            </span>
            <span className="mt-1 text-desc-secondary">A/R balance less A/P balance</span>
          </div>
        </BoardPanel>

        {/* KPI 4: Overdue counts */}
        <BoardPanel className="p-5 flex flex-col justify-between min-h-[142px] relative overflow-hidden group transition-all duration-300 hover:shadow-md hover:-translate-y-1 hover:border-rose-250 bg-gradient-to-b from-white to-rose-50/10">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity translate-x-4 -translate-y-4">
            <IconClock size={100} stroke={1} />
          </div>
          <div className="flex items-center gap-3 relative z-10">
            <div className="size-8 rounded-xl bg-gradient-to-br from-rose-50 to-rose-100/50 text-rose-600 flex items-center justify-center shadow-sm border border-rose-200/50">
              <IconClock size={16} stroke={2.5} />
            </div>
            <span className="text-slate-400 label-caps text-xs">Overdue Risk</span>
          </div>
          <div className="flex flex-col mt-auto relative z-10">
            <span className="font-mono font-normal tracking-tight text-rose-700 text-3xl">
              {metrics.overdue} <span className="text-rose-700/65 text-lg">Invoices</span>
            </span>
            <span className="mt-1 text-desc-secondary">Overdue client receivables</span>
          </div>
        </BoardPanel>
      </section>

      {/* ── 2. Visualization Section ────────────────────────────────────────── */}
      <BoardPanel className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4 mb-4">
          <div>
            <h3 className="font-medium text-slate-900 tracking-tight body-md">Billing & Accrual Trends</h3>
            <p className="text-sm text-slate-400 mt-0.5">MTD Billing generation compared against vendor liabilities</p>
          </div>
          <div className="flex items-center gap-4 font-medium text-sm">
            <span className="flex items-center gap-1.5 text-indigo-600">
              <span className="size-2 rounded-full bg-indigo-500" /> Invoiced (A/R)
            </span>
            <span className="flex items-center gap-1.5 text-amber-500">
              <span className="size-2 rounded-full bg-amber-500" /> Bills Accrued (A/P)
            </span>
          </div>
        </div>
        <div className="h-[240px] w-full">
          <ResponsiveContainer width="100%" height="100%" minHeight={0} minWidth={0}>
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
                formatter={(value: unknown) => [formatMoney(Number(value)), ""]}
              />
              <Bar dataKey="Invoiced" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={28} />
              <Bar dataKey="Bills" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </BoardPanel>

      <div className="pt-6 border-t border-slate-200/60 my-2 animate-fade-in-up">
        <h2 className="title-serif text-slate-900 font-normal">Aging, Holds & Ledger Impact</h2>
        <p className="text-desc-secondary mt-1">
          Surface due-date exposure, dispute freezes, and the journal impact that will be created by payment or receipt actions.
        </p>
      </div>

      <section className="grid grid-cols-1 lg:grid-cols-[0.95fr_1.05fr] gap-4 animate-fade-in-up">
        <BoardPanel className="p-5 relative overflow-hidden group hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between">
            <h3 className="font-normal text-slate-900 tracking-tight headline-md">Aging Heatmap</h3>
            <Badge tone="data" className="shadow-sm">{activeTab === "payables" ? "Vendor exposure" : "Client collection"}</Badge>
          </div>
          <div className="mt-5 grid grid-cols-5 gap-3">
            {["Current", "1-30", "31-60", "61-90", "90+"].map((bucket) => {
              const bucketRows = activeTab === "payables"
                ? bills.filter(b => agingBucket(b.dueDate, b.status === "Posted") === bucket)
                : invoices.filter(inv => agingBucket(inv.dueDate, inv.status === "Posted") === bucket);
              const bucketValue = bucketRows.reduce((sum, row) => sum + row.amount, 0);
              const isRisk = bucket === "61-90" || bucket === "90+";

              return (
                <div
                  key={bucket}
                  className={cn(
                    "rounded-xl border p-4 min-h-[120px] flex flex-col transition-all duration-300 hover:-translate-y-1 hover:shadow-sm",
                    isRisk
                      ? "border-rose-200/60 bg-gradient-to-b from-rose-50/80 to-white hover:border-rose-300"
                      : bucket === "Current"
                        ? "border-emerald-200/60 bg-gradient-to-b from-emerald-50/80 to-white hover:border-emerald-300"
                        : "border-amber-200/60 bg-gradient-to-b from-amber-50/80 to-white hover:border-amber-300"
                  )}
                >
                  <p className={cn("text-sm font-medium uppercase tracking-widest", isRisk ? "text-rose-700" : "text-slate-400")}>{bucket}</p>
                  <div className="mt-auto pt-4">
                    <p className="tracking-tight text-slate-900 mono-stat">{formatMoney(bucketValue)}</p>
                    <p className="mt-1 text-desc-secondary">{bucketRows.length} records</p>
                  </div>
                </div>
              );
            })}
          </div>
        </BoardPanel>

        <BoardPanel className="p-5 relative overflow-hidden group hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-normal text-slate-900 tracking-tight headline-md">Posting Preview</h3>
              <p className="mt-1 text-desc-secondary">Finance actions create ledger entries automatically after validation.</p>
            </div>
            <div className="size-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-slate-100 group-hover:text-indigo-500 transition-colors">
              <IconTransfer size={20} />
            </div>
          </div>
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-xl border border-amber-200/60 bg-gradient-to-br from-amber-50/80 to-white p-5 transition-all duration-300 hover:shadow-sm hover:border-amber-300">
              <div className="flex items-center justify-between gap-3">
                <span className="text-amber-700 label-caps">Pay vendor bill</span>
                <div className="size-8 rounded-lg bg-amber-100/50 flex items-center justify-center text-amber-600">
                  <IconReceipt2 size={16} />
                </div>
              </div>
              <div className="mt-4 space-y-2">
                <div className="flex justify-between items-center font-medium text-sm">
                  <span className="text-amber-900">DR Expense/Payable</span>
                  <span className="font-mono text-amber-700">+ Amount</span>
                </div>
                <div className="flex justify-between items-center font-medium text-sm">
                  <span className="text-slate-600">CR Cash/Bank</span>
                  <span className="font-mono text-slate-400">- Amount</span>
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-indigo-200/60 bg-gradient-to-br from-indigo-50/80 to-white p-5 transition-all duration-300 hover:shadow-sm hover:border-indigo-300">
              <div className="flex items-center justify-between gap-3">
                <span className="text-indigo-700 label-caps">Record receipt</span>
                <div className="size-8 rounded-lg bg-indigo-100/50 flex items-center justify-center text-indigo-600">
                  <IconShieldCheck size={16} />
                </div>
              </div>
              <div className="mt-4 space-y-2">
                <div className="flex justify-between items-center font-medium text-sm">
                  <span className="text-indigo-900">DR Cash/Bank</span>
                  <span className="font-mono text-indigo-700">+ Amount</span>
                </div>
                <div className="flex justify-between items-center font-medium text-sm">
                  <span className="text-slate-600">CR Receivable/Rev</span>
                  <span className="font-mono text-slate-400">- Amount</span>
                </div>
              </div>
            </div>
          </div>
        </BoardPanel>
      </section>

      <FinanceQrProof
        artifactRef={activeTab === "payables" ? "AP-VCHR-118" : "AR-RCPT-204"}
        artifactType={activeTab === "payables" ? "Vendor Settlement Voucher" : "Client Receipt Voucher"}
        entityName={activeEntity.name}
        generatedAt="2026-06-22"
        token={activeTab === "payables" ? "sunland_ap_bill118_7c44fa" : "sunland_ar_inv204_66af21"}
        amount={activeTab === "payables" ? metrics.payables : metrics.receivables}
      />

      {/* ── 3. Segment Content Title & Queue ─────────────────────────────────── */}
      <div className="pt-2 my-2 animate-fade-in-up">
        <h2 className="title-serif text-slate-900 font-normal capitalize">
          {activeTab} Queue
        </h2>
        <p className="text-desc-secondary mt-1">
          {activeTab === "payables" && "Track incoming vendor bills, security invoices, lift contractors, and record corporate settlements."}
          {activeTab === "receivables" && "Monitor valuation consultancy invoices, lease documentation fee receipts, and customer payments."}
        </p>
      </div>

      <BoardPanel className="p-0 overflow-hidden shadow-sm border-slate-200 animate-fade-in-up">
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-white">
          <div className="flex flex-1 max-w-md items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 transition hover:bg-slate-100/50">
            <IconSearch size={14} className="text-slate-400" />
            <input
              type="text"
              placeholder={activeTab === "payables" ? "Search bills, vendors, properties..." : "Search invoices, clients, properties..."}
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
              className="w-full bg-transparent text-slate-700 placeholder-slate-400 focus:outline-none text-base"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          {activeTab === "payables" ? (
            /* Payables Table */
            <table className="w-full min-w-[760px] text-left text-body-regular">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 bg-slate-50/50 label-caps">
                  <th className="px-5 py-3">Bill Code</th>
                  <th className="px-5 py-3">Vendor</th>
                  <th className="px-5 py-3">Category</th>
                  <th className="px-5 py-3">Property</th>
                  <th className="px-5 py-3 text-right">Amount</th>
                  <th className="px-5 py-3">Due Date</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(paginatedRows as BillRecord[]).map((b) => (
                  <tr
                    key={b.id}
                    onClick={() => { setSelectedBill(b); setSelectedInvoice(null); }}
                    className="transition-colors hover:bg-slate-50/80 cursor-pointer"
                  >
                    <td className="px-5 py-3.5 text-slate-900 mono-data">{b.billCode}</td>
                    <td className="px-5 py-3.5">
                      <p className="text-title-primary leading-snug">{b.vendorName}</p>
                      <p className="text-sm text-slate-400 mt-0.5">{b.description}</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <Badge tone="data" className="h-5 text-sm ">{b.source}</Badge>
                        <Badge tone={b.disputed ? "risk" : "neutral"} className="h-5 text-sm ">
                          {b.disputed ? "Dispute hold" : b.owner}
                        </Badge>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-body-regular">
                        {b.category}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-slate-600 text-base">
                      <span className="flex items-center gap-1"><IconBuilding size={12} /> {b.propertyName}</span>
                    </td>
                    <td className="px-5 py-3.5 text-right text-slate-900 mono-data">
                      {formatMoney(b.amount)}
                    </td>
                    <td className="px-5 py-3.5 text-slate-600 text-base">
                      <span className="font-mono">{formatDate(b.dueDate)}</span>
                      <p className="mt-1 text-sm text-slate-400">{agingBucket(b.dueDate, b.status === "Posted")}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge tone={b.status === "Posted" ? "success" : b.disputed ? "risk" : "warning"}>
                        {b.status === "Posted" ? "Settled" : recordRisk(b.dueDate, false, b.disputed)}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                      {b.status === "Pending" ? (
                        <div className="flex flex-col items-end gap-1.5">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => openPayModalFor(b)}
                            disabled={Boolean(b.disputed)}
                            className="bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 py-1 px-2.5 h-7 text-sm "
                          >
                            {b.disputed ? "Held" : "Record Settlement"}
                          </Button>
                          <button
                            type="button"
                            onClick={() => handleToggleDispute(b.id, "bill")}
                            className="font-medium text-slate-400 hover:text-slate-700 text-sm"
                          >
                            {b.disputed ? "Clear hold" : "Mark disputed"}
                          </button>
                        </div>
                      ) : (
                        <div className="flex justify-end pr-2 text-emerald-600">
                          <IconCheck size={16} stroke={2.5} />
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            /* Receivables Table */
            <table className="w-full min-w-[760px] text-left text-body-regular">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 bg-slate-50/50 label-caps">
                  <th className="px-5 py-3">Invoice</th>
                  <th className="px-5 py-3">Client</th>
                  <th className="px-5 py-3">Property Link</th>
                  <th className="px-5 py-3 text-right">Amount</th>
                  <th className="px-5 py-3">Due Date</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(paginatedRows as InvoiceRecord[]).map((inv) => (
                  <tr
                    key={inv.id}
                    onClick={() => { setSelectedInvoice(inv); setSelectedBill(null); }}
                    className="transition-colors hover:bg-slate-50/80 cursor-pointer"
                  >
                    <td className="px-5 py-3.5 text-slate-900 mono-data">{inv.invoiceCode}</td>
                    <td className="px-5 py-3.5">
                      <p className="text-title-primary leading-snug">{inv.clientName}</p>
                      <p className="text-sm text-slate-400 mt-0.5">{inv.description}</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <Badge tone="data" className="h-5 text-sm ">{inv.source}</Badge>
                        <Badge tone={inv.disputed ? "risk" : "neutral"} className="h-5 text-sm ">
                          {inv.disputed ? "Dispute hold" : inv.owner}
                        </Badge>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-slate-600 text-base">
                      <span className="flex items-center gap-1"><IconBuilding size={12} /> {inv.propertyName}</span>
                    </td>
                    <td className="px-5 py-3.5 text-right text-slate-900 mono-data">
                      {formatMoney(inv.amount)}
                    </td>
                    <td className="px-5 py-3.5 text-slate-600 text-base">
                      <span className="font-mono">{formatDate(inv.dueDate)}</span>
                      <p className="mt-1 text-sm text-slate-400">{agingBucket(inv.dueDate, inv.status === "Posted")}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge
                        tone={inv.status === "Posted" ? "success" : inv.status === "Overdue" || inv.disputed ? "risk" : "warning"}
                      >
                        {inv.status === "Posted" ? "Posted" : recordRisk(inv.dueDate, false, inv.disputed)}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                      {inv.status !== "Posted" ? (
                        <div className="flex flex-col items-end gap-1.5">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => openReceiptModalFor(inv)}
                            disabled={Boolean(inv.disputed)}
                            className="bg-indigo-500/10 text-indigo-700 hover:bg-indigo-500/20 py-1 px-2.5 h-7 text-sm "
                          >
                            {inv.disputed ? "Held" : "Record Receipt"}
                          </Button>
                          <button
                            type="button"
                            onClick={() => handleToggleDispute(inv.id, "invoice")}
                            className="text-sm font-medium text-slate-400 hover:text-slate-700"
                          >
                            {inv.disputed ? "Clear hold" : "Mark disputed"}
                          </button>
                        </div>
                      ) : (
                        <div className="flex justify-end pr-2 text-emerald-600">
                          <IconCheck size={16} stroke={2.5} />
                        </div>
                      )}
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
          label={`${filteredRows.length} of ${activeTab === "payables" ? bills.length : invoices.length} records shown, ${ROWS_PER_PAGE} rows per page`}
        />
      </BoardPanel>

      {/* ── 4. Pay Bill Modal ───────────────────────────────────────────────── */}
      <Modal open={payBill !== null} onClose={() => setPayBill(null)} title="Pay Vendor Bill">
        {payBill && (
          <form onSubmit={handlePayBillSubmit} className="space-y-5 pt-1">
            <div className="relative overflow-hidden bg-gradient-to-r from-amber-500/[0.02] to-indigo-500/[0.02] border border-slate-100 p-4 rounded-xl space-y-2.5 shadow-sm">
              <div className="flex justify-between items-center body-sm">
                <span className="text-slate-400 font-normal">Bill Reference</span>
                <span className="font-mono font-medium text-slate-800 bg-slate-100 px-2 py-0.5 rounded">{payBill.billCode}</span>
              </div>
              <div className="flex justify-between items-center body-sm">
                <span className="text-slate-400 font-normal">Vendor</span>
                <span className="font-medium text-slate-800">{payBill.vendorName}</span>
              </div>
              <div className="h-px bg-slate-100 my-1" />
              <div className="flex justify-between items-center body-sm">
                <span className="text-slate-400 font-normal">Settlement Amount</span>
                <span className="font-mono font-normal text-amber-700 bg-amber-50/60 px-2.5 py-1 rounded-lg border border-amber-100/30">{formatMoney(payBill.amount)}</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-400 block label-caps">Funding Bank/Cash Account</label>
              <div className="relative rounded-lg shadow-sm">
                <select
                  value={billPayAccount}
                  onChange={(e) => setBillPayAccount(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white p-2 text-slate-700 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 transition-all font-medium appearance-none font-sans text-base"
                >
                  <option value="NCBA Operating A/C">NCBA Operating A/C (011-928-8211)</option>
                  <option value="Stanchart Reserve A/C">Stanchart Reserve A/C (012-384-9920)</option>
                  <option value="M-Pesa Utility Wallet">M-Pesa Utility Wallet (B/Pay 992091)</option>
                  <option value="Co-op Pet-Cash A/C">Co-op Petty-Cash A/C (011-821-2290)</option>
                </select>
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
                  <IconArrowUpRight size={14} className="rotate-90" />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-400 block label-caps">Transaction Ref / Cheque No.</label>
              <div className="relative rounded-lg shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <IconReceipt2 size={15} />
                </div>
                <input
                  type="text"
                  required
                  placeholder="e.g. FT-NCBA-98291"
                  value={billPayRef}
                  onChange={(e) => setBillPayRef(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-slate-700 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 transition-all mono-data"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-100">
              <Button type="button" variant="secondary" onClick={() => setPayBill(null)} className="h-9 px-4 text-base">
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting} className="h-9 px-4 bg-[#f3df27] text-[#151936] hover:bg-[#e6d220] font-medium rounded-lg shadow-sm text-base">
                {isSubmitting ? "Accruing..." : "Record Payment"}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* ── 5. Record Receipt Modal ─────────────────────────────────────────── */}
      <Modal open={recordReceipt !== null} onClose={() => setRecordReceipt(null)} title="Record Client Receipt">
        {recordReceipt && (
          <form onSubmit={handleRecordReceiptSubmit} className="space-y-5 pt-1">
            <div className="relative overflow-hidden bg-gradient-to-r from-indigo-500/[0.02] to-emerald-500/[0.02] border border-slate-100 p-4 rounded-xl space-y-2.5 shadow-sm">
              <div className="flex justify-between items-center body-sm">
                <span className="text-slate-400 font-normal">Invoice Number</span>
                <span className="font-mono font-medium text-slate-800 bg-slate-100 px-2 py-0.5 rounded">{recordReceipt.invoiceCode}</span>
              </div>
              <div className="flex justify-between items-center body-sm">
                <span className="text-slate-400 font-normal">Client</span>
                <span className="font-medium text-slate-800">{recordReceipt.clientName}</span>
              </div>
              <div className="h-px bg-slate-100 my-1" />
              <div className="flex justify-between items-center body-sm">
                <span className="text-slate-400 font-normal">Invoiced Amount</span>
                <span className="font-mono font-normal text-indigo-700 bg-indigo-50/50 px-2.5 py-1 rounded-lg border border-indigo-100/30">{formatMoney(recordReceipt.amount)}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-slate-400 block label-caps">Receipt Channel</label>
                <select
                  value={receiptMethod}
                  onChange={(e) => setReceiptMethod(e.target.value as NonNullable<InvoiceRecord["payMethod"]>)}
                  className="w-full rounded-lg border border-slate-200 bg-white p-2 text-slate-700 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 transition-all font-medium font-sans text-base"
                >
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="M-Pesa">M-Pesa Paybill</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Cash">Cash</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-slate-400 block label-caps">Target Account</label>
                <select
                  value={receiptAccount}
                  onChange={(e) => setReceiptAccount(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white p-2 text-slate-700 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 transition-all font-medium font-sans text-base"
                >
                  <option value="NCBA Operating A/C">NCBA Operating A/C</option>
                  <option value="Stanchart Reserve A/C">Stanchart Reserve A/C</option>
                  <option value="Co-op Reserve A/C">Co-op Reserve A/C</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-400 block label-caps">Payment Reference / MPESA Code</label>
              <div className="relative rounded-lg shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <IconReceipt2 size={15} />
                </div>
                <input
                  type="text"
                  required
                  placeholder="e.g. MP-RF88921-KES"
                  value={receiptRef}
                  onChange={(e) => setReceiptRef(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-slate-700 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 transition-all mono-data"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-100">
              <Button type="button" variant="secondary" onClick={() => setRecordReceipt(null)} className="h-9 px-4 text-base">
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting} className="h-9 px-4 bg-[#f3df27] text-[#151936] hover:bg-[#e6d220] font-medium rounded-lg shadow-sm text-base">
                {isSubmitting ? "Recording..." : "Record Receipt"}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* ── 6. Bill Detail Drawer ───────────────────────────────────────────── */}
      <Drawer
        open={selectedBill !== null}
        onClose={() => setSelectedBill(null)}
        title="Vendor Bill Details"
        footer={
          selectedBill && (
            <div className="flex gap-2 justify-end">
              <Button variant="secondary" onClick={() => setSelectedBill(null)} className="h-9 text-base">
                Close Panel
              </Button>
              {selectedBill.status === "Pending" && (
                <Button variant="secondary" onClick={() => handleToggleDispute(selectedBill.id, "bill")} className="h-9 text-base">
                  {selectedBill.disputed ? "Clear Hold" : "Dispute Hold"}
                </Button>
              )}
              {selectedBill.status === "Pending" && (
                <Button
                  onClick={() => { setSelectedBill(null); openPayModalFor(selectedBill); }}
                  disabled={Boolean(selectedBill.disputed)}
                  className="bg-[#f3df27] text-[#151936] hover:bg-[#e6d220] h-9 font-medium rounded-lg text-base"
                >
                  {selectedBill.disputed ? "Held" : "Pay Vendor Bill"}
                </Button>
              )}
            </div>
          )
        }
      >
        {selectedBill && (
          <div className="space-y-6 text-slate-700 text-sm">
            {/* Header context */}
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="size-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 shadow-sm border border-slate-100/50">
                <IconUser size={20} />
              </div>
              <div>
                <h4 className="font-medium text-slate-900 leading-snug body-md">{selectedBill.vendorName}</h4>
                <p className="text-slate-400 mt-0.5 text-sm">{selectedBill.billCode} · {selectedBill.category}</p>
              </div>
            </div>

            <div className="space-y-5">
              {/* Structured Financial Voucher Preview */}
              <div className="relative border border-slate-200 bg-white p-5 rounded-2xl flex flex-col justify-between shadow-sm min-h-[140px] select-none font-sans overflow-hidden">
                {/* Visual verified/paid watermark */}
                {selectedBill.status === "Posted" && (
                  <div className="absolute right-8 top-5 select-none pointer-events-none opacity-[0.15] origin-center -rotate-12 border-2 border-emerald-600 px-3 py-1 text-sm font-medium text-emerald-600 tracking-wider rounded">
                    PAID / ACCRUED
                  </div>
                )}
                {selectedBill.disputed && (
                  <div className="absolute right-8 top-5 select-none pointer-events-none opacity-[0.15] origin-center -rotate-12 border-2 border-rose-600 px-3 py-1 text-sm font-medium text-rose-600 tracking-wider rounded">
                    DISPUTED HOLD
                  </div>
                )}

                <div className="flex justify-between items-start text-slate-400 font-mono text-sm">
                  <span className="font-normal text-slate-700 tracking-wider">VENDOR BILL VOUCHER</span>
                  <span>REF: {selectedBill.billCode}</span>
                </div>

                <div className="my-2 flex justify-between items-center gap-4">
                  <div className="flex flex-col">
                    <span className="text-slate-400 font-mono label-caps">Payee / Creditor</span>
                    <span className="text-sm font-normal text-slate-800 leading-tight mt-0.5">{selectedBill.vendorName}</span>
                    <span className="mt-0.5 text-desc-secondary">{selectedBill.category} · Allocation: {selectedBill.propertyName}</span>
                  </div>
                  <div className="bg-slate-50 border border-slate-200/60 px-3.5 py-1.5 rounded-lg font-normal text-slate-800 font-mono shadow-[inset_0_1px_1.5px_rgba(0,0,0,0.03)] shrink-0 body-md">
                    {formatMoney(selectedBill.amount)}
                  </div>
                </div>

                <div className="flex justify-between items-end text-slate-400 border-t border-slate-100 pt-2 font-mono text-sm">
                  <div>
                    <span className="text-slate-400">ISSUED BY:</span>{" "}
                    <span className="text-slate-700 font-sans font-medium">{selectedBill.owner}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">DUE DATE:</span>{" "}
                    <span className="text-slate-700">{formatDate(selectedBill.dueDate)}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-slate-400 label-caps">Description</span>
                <p className="text-slate-700 leading-relaxed bg-slate-50 border border-slate-100 p-3 rounded-xl text-base">{selectedBill.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                <div>
                  <span className="text-slate-400 label-caps">Linkage Property</span>
                  <p className="mt-1 flex items-center gap-1 text-title-primary"><IconBuilding size={12} /> {selectedBill.propertyName}</p>
                </div>
                <div>
                  <span className="text-slate-400 label-caps">Payment Status</span>
                  <div className="mt-1">
                    <Badge tone={selectedBill.status === "Posted" ? "success" : selectedBill.disputed ? "risk" : "warning"} className="px-2.5 py-0.5">
                      {selectedBill.status === "Posted" ? "Settled" : recordRisk(selectedBill.dueDate, false, selectedBill.disputed)}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 pt-2 border-t border-slate-100">
                <div className="rounded-xl bg-slate-50/50 border border-slate-100/50 p-3">
                  <span className="text-slate-400 label-caps">Source</span>
                  <p className="mt-0.5 font-medium text-slate-700 text-base">{selectedBill.source}</p>
                </div>
                <div className="rounded-xl bg-slate-50/50 border border-slate-100/50 p-3">
                  <span className="text-slate-400 label-caps">Owner</span>
                  <p className="mt-0.5 font-medium text-slate-700 text-base">{selectedBill.owner}</p>
                </div>
                <div className="rounded-xl bg-slate-50/50 border border-slate-100/50 p-3">
                  <span className="text-slate-400 label-caps">Aging</span>
                  <p className="mt-0.5 text-slate-700 mono-data">{agingBucket(selectedBill.dueDate, selectedBill.status === "Posted")}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                <div>
                  <span className="text-slate-400 label-caps">Accrued Amount</span>
                  <p className="font-mono font-normal text-slate-800 mt-1 body-md">{formatMoney(selectedBill.amount)}</p>
                </div>
                <div>
                  <span className="text-slate-400 label-caps">Due Date</span>
                  <p className="text-slate-600 mt-1 mono-data">{formatDate(selectedBill.dueDate)}</p>
                </div>
              </div>

              {selectedBill.status === "Posted" && (
                <div className="p-4 bg-emerald-50/20 border border-emerald-100/40 rounded-xl space-y-2 pt-2.5">
                  <span className="text-slate-400 block label-caps">Payment Allocation Details</span>
                  <div className="grid grid-cols-2 gap-2 body-sm">
                    <div>
                      <span className="text-slate-400">Date Paid:</span>
                      <p className="font-medium text-slate-700 mt-0.5">{selectedBill.paidDate}</p>
                    </div>
                    <div>
                      <span className="text-slate-400">Source Account:</span>
                      <p className="font-medium text-slate-700 mt-0.5">{selectedBill.bankAccount}</p>
                    </div>
                    <div className="col-span-2 pt-1.5 border-t border-emerald-100/30">
                      <span className="text-slate-400">Transaction Reference:</span>
                      <p className="font-mono text-slate-800 font-normal mt-0.5">{selectedBill.bankRef}</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-2 border-t border-slate-100">
                <span className="text-slate-400 block label-caps">Activity Log</span>
                <div className="mt-3.5 space-y-3">
                  {selectedBill.activityLog.map((entry, index) => (
                    <div key={`${selectedBill.id}-${entry}`} className="flex gap-2.5">
                      <span className="mt-1.5 size-1.5 rounded-full bg-slate-400 shrink-0" />
                      <div>
                        <p className="text-slate-700 font-medium leading-normal text-base">{entry}</p>
                        <p className="font-mono text-slate-400 mt-0.5 text-sm">Step {selectedBill.activityLog.length - index}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </Drawer>

      {/* ── 7. Invoice Detail Drawer ────────────────────────────────────────── */}
      <Drawer
        open={selectedInvoice !== null}
        onClose={() => setSelectedInvoice(null)}
        title="Client Invoice Details"
        footer={
          selectedInvoice && (
            <div className="flex gap-2 justify-end">
              <Button variant="secondary" onClick={() => setSelectedInvoice(null)} className="h-9 text-base">
                Close Panel
              </Button>
              {selectedInvoice.status !== "Posted" && (
                <Button variant="secondary" onClick={() => handleToggleDispute(selectedInvoice.id, "invoice")} className="h-9 text-base">
                  {selectedInvoice.disputed ? "Clear Hold" : "Dispute Hold"}
                </Button>
              )}
              {selectedInvoice.status !== "Posted" && (
                <Button
                  onClick={() => { setSelectedInvoice(null); openReceiptModalFor(selectedInvoice); }}
                  disabled={Boolean(selectedInvoice.disputed)}
                  className="bg-[#f3df27] text-[#151936] hover:bg-[#e6d220] h-9 font-medium rounded-lg text-base"
                >
                  {selectedInvoice.disputed ? "Held" : "Record Receipt"}
                </Button>
              )}
            </div>
          )
        }
      >
        {selectedInvoice && (
          <div className="space-y-6 text-slate-700 text-sm">
            {/* Header context */}
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="size-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 shadow-sm border border-slate-100/50">
                <IconUser size={20} />
              </div>
              <div>
                <h4 className="font-medium text-slate-900 leading-snug body-md">{selectedInvoice.clientName}</h4>
                <p className="text-slate-400 mt-0.5 text-sm">{selectedInvoice.invoiceCode} · {selectedInvoice.propertyName}</p>
              </div>
            </div>

            <div className="space-y-5">
              {/* Structured Customer Invoice Replica */}
              <div className="relative border border-slate-200 bg-white p-5 rounded-2xl flex flex-col justify-between shadow-sm min-h-[140px] select-none font-sans overflow-hidden">
                {/* Visual stamp */}
                {selectedInvoice.status === "Posted" && (
                  <div className="absolute right-8 top-5 select-none pointer-events-none opacity-[0.15] origin-center -rotate-12 border-2 border-emerald-600 px-3 py-1 text-sm font-medium text-emerald-600 tracking-wider rounded">
                    PAID / SETTLED
                  </div>
                )}
                {selectedInvoice.status === "Overdue" && !selectedInvoice.disputed && (
                  <div className="absolute right-8 top-5 select-none pointer-events-none opacity-[0.15] origin-center -rotate-12 border-2 border-rose-600 px-3 py-1 text-sm font-medium text-rose-600 tracking-wider rounded">
                    OVERDUE
                  </div>
                )}
                {selectedInvoice.disputed && (
                  <div className="absolute right-8 top-5 select-none pointer-events-none opacity-[0.15] origin-center -rotate-12 border-2 border-rose-500 px-3 py-1 text-sm font-medium text-rose-500 tracking-wider rounded">
                    DISPUTE HOLD
                  </div>
                )}

                <div className="flex justify-between items-start text-slate-400 font-mono text-sm">
                  <span className="font-normal text-slate-700 tracking-wider">SUNLAND SYSTEM INVOICE</span>
                  <span>NO: {selectedInvoice.invoiceCode}</span>
                </div>

                <div className="my-2 flex justify-between items-center gap-4">
                  <div className="flex flex-col">
                    <span className="text-slate-400 font-mono label-caps">Bill to / Client</span>
                    <span className="text-sm font-normal text-slate-800 leading-tight mt-0.5">{selectedInvoice.clientName}</span>
                    <span className="mt-0.5 text-desc-secondary">Property: {selectedInvoice.propertyName}</span>
                  </div>
                  <div className="bg-slate-50 border border-slate-200/60 px-3.5 py-1.5 rounded-lg font-normal text-slate-800 font-mono shadow-[inset_0_1px_1.5px_rgba(0,0,0,0.03)] shrink-0 body-md">
                    {formatMoney(selectedInvoice.amount)}
                  </div>
                </div>

                <div className="flex justify-between items-end text-slate-400 border-t border-slate-100 pt-2 font-mono text-sm">
                  <div>
                    <span className="text-slate-400">ISSUED BY:</span>{" "}
                    <span className="text-slate-700 font-sans font-medium">{selectedInvoice.owner}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">DUE DATE:</span>{" "}
                    <span className="text-slate-700">{formatDate(selectedInvoice.dueDate)}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-slate-400 label-caps">Description</span>
                <p className="text-slate-700 leading-relaxed bg-slate-50 border border-slate-100 p-3 rounded-xl text-base">{selectedInvoice.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                <div>
                  <span className="text-slate-400 label-caps">Property Link</span>
                  <p className="mt-1 flex items-center gap-1 text-title-primary"><IconBuilding size={12} /> {selectedInvoice.propertyName}</p>
                </div>
                <div>
                  <span className="text-slate-400 label-caps">Invoice Status</span>
                  <div className="mt-1">
                    <Badge
                      tone={selectedInvoice.status === "Posted" ? "success" : selectedInvoice.status === "Overdue" || selectedInvoice.disputed ? "risk" : "warning"}
                      className="px-2.5 py-0.5"
                    >
                      {selectedInvoice.status === "Posted" ? "Posted" : recordRisk(selectedInvoice.dueDate, false, selectedInvoice.disputed)}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 pt-2 border-t border-slate-100">
                <div className="rounded-xl bg-slate-50/50 border border-slate-100/50 p-3">
                  <span className="text-slate-400 label-caps">Source</span>
                  <p className="mt-0.5 font-medium text-slate-700 text-base">{selectedInvoice.source}</p>
                </div>
                <div className="rounded-xl bg-slate-50/50 border border-slate-100/50 p-3">
                  <span className="text-slate-400 label-caps">Owner</span>
                  <p className="mt-0.5 font-medium text-slate-700 text-base">{selectedInvoice.owner}</p>
                </div>
                <div className="rounded-xl bg-slate-50/50 border border-slate-100/50 p-3">
                  <span className="text-slate-400 label-caps">Aging</span>
                  <p className="mt-0.5 text-slate-700 mono-data">{agingBucket(selectedInvoice.dueDate, selectedInvoice.status === "Posted")}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                <div>
                  <span className="text-slate-400 label-caps">Invoiced Amount</span>
                  <p className="font-mono font-normal text-slate-800 mt-1 body-md">{formatMoney(selectedInvoice.amount)}</p>
                </div>
                <div>
                  <span className="text-slate-400 label-caps">Due Date</span>
                  <p className="text-slate-600 mt-1 mono-data">{formatDate(selectedInvoice.dueDate)}</p>
                </div>
              </div>

              {selectedInvoice.status === "Posted" && (
                <div className="p-4 bg-emerald-50/20 border border-emerald-100/40 rounded-xl space-y-2 pt-2.5">
                  <span className="text-slate-400 block label-caps">Receipt Confirmation Details</span>
                  <div className="grid grid-cols-2 gap-2 body-sm">
                    <div>
                      <span className="text-slate-400">Date Received:</span>
                      <p className="font-medium text-slate-700 mt-0.5">{selectedInvoice.receivedDate}</p>
                    </div>
                    <div>
                      <span className="text-slate-400">Payment Channel:</span>
                      <p className="font-medium text-slate-700 mt-0.5">{selectedInvoice.payMethod}</p>
                    </div>
                    <div>
                      <span className="text-slate-400">Target Account:</span>
                      <p className="font-medium text-slate-700 mt-0.5">{selectedInvoice.bankAccount}</p>
                    </div>
                    <div>
                      <span className="text-slate-400">Payment Reference:</span>
                      <p className="font-mono text-slate-800 font-normal mt-0.5">{selectedInvoice.bankRef}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Individual Invoice Verification QR for Reconciled Invoices */}
              {selectedInvoice.status === "Posted" && (
                <div className="pt-1.5">
                  <FinanceQrProof
                    compact={true}
                    artifactRef={selectedInvoice.bankRef || "Awaiting Post"}
                    artifactType="Reconciled Invoice Receipt"
                    entityName={activeEntity.name}
                    generatedAt={selectedInvoice.receivedDate || "2026-06-22"}
                    token={`sunland_inv_rec_${selectedInvoice.invoiceCode.replace("INV-", "")}`}
                    amount={selectedInvoice.amount}
                  />
                </div>
              )}

              <div className="pt-2 border-t border-slate-100">
                <span className="text-slate-400 block label-caps">Activity Log</span>
                <div className="mt-3.5 space-y-3">
                  {selectedInvoice.activityLog.map((entry, index) => (
                    <div key={`${selectedInvoice.id}-${entry}`} className="flex gap-2.5">
                      <span className="mt-1.5 size-1.5 rounded-full bg-slate-400 shrink-0" />
                      <div>
                        <p className="text-slate-700 font-medium leading-normal text-base">{entry}</p>
                        <p className="font-mono text-slate-400 mt-0.5 text-sm">Step {selectedInvoice.activityLog.length - index}</p>
                      </div>
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
