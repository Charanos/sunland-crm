"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import Image from "next/image";
import type { FinancePeriod } from "@/components/finance/finance-overview-charts";
import {
  IconBuildingBank,
  IconReceipt2,
  IconReportMoney,
  IconScale,
  IconWallet,
  IconAlertTriangle,
  IconClockExclamation,
  IconShieldExclamation,
  IconFileText,
  IconPlus,
  IconRefresh,
  IconArrowUpRight,
  IconTrendingUp,
  IconTrendingDown,
  IconActivity,
  IconCreditCardPay,
  IconBuildingEstate,
  IconInfoCircle,
  IconCheck,
  IconTrash,
  IconUsersGroup,
  IconCoins,
  IconBuildingSkyscraper,
  IconArrowRight
} from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast-provider";
import { cn } from "@/lib/utils/cn";
import { formatCompactKES } from "@/lib/utils/format";
import { Modal } from "@/components/ui/modal";
import { FinanceOverviewCharts } from "./finance-overview-charts";
import { FinanceOperationsScheduler } from "./finance-operations-scheduler";
import { BoardPanel } from "@/components/ui/erp-primitives";
import { useUIStore } from "@/store/ui";

// Dynamically import heavy charts and widgets
const RevenueStreamChart = dynamic(() => import("./revenue-stream-chart"), { ssr: false });
const UnifiedMarketBoard = dynamic(() => import("@/components/sunland/unified-market-board").then(m => ({ default: m.UnifiedMarketBoard })), { ssr: false });

// ─── Data Registry (Mocked for UI Implementation) ─────────────────────────────

const INITIAL_FINANCE_METRICS = {
  group: {
    collectionRate: 94.2,
    collectionTrend: "+2.1%",
    revenueMtd: 14250000,
    revenueTrend: "+8.4%",
    netCash: 48500000,
    cashTrend: "+12.1%",
    receivables: 6400000, // Corporate receivables
    receivablesTrend: "-4.2%",
    payables: 2150000,
    payablesTrend: "+1.5%",
    pendingApprovals: 3
  },
  commercial: {
    collectionRate: 97.5,
    collectionTrend: "+1.0%",
    revenueMtd: 8400000,
    revenueTrend: "+5.2%",
    netCash: 22000000,
    cashTrend: "+8.1%",
    receivables: 3100000,
    receivablesTrend: "-1.2%",
    payables: 850000,
    payablesTrend: "-0.5%",
    pendingApprovals: 1
  }
};

interface PendingApprovalRequest {
  id: string;
  type: string;
  detail: string;
  amount: number;
  requestedBy: string;
  requestedAt: string;
  role: string;
  originTable: string;
  originId: string;
  entityId: string;
}

const INITIAL_PENDING_APPROVALS = [
  {
    id: "APP-1048",
    type: "Cheque Clearing Validation",
    detail: "High-value banker's cheque CHQ-0098 verification required",
    amount: 640000,
    requestedBy: "F. Officer",
    requestedAt: "2026-06-20",
    role: "Finance Head / GM",
    originTable: "cheques",
    originId: "CHQ-0098",
    entityId: "commercial"
  },
  {
    id: "APP-1049",
    type: "Mandate Activation Approval",
    detail: "Property mandate MDT-005 for Kilimani Heights Annex (15 units)",
    amount: 180000,
    requestedBy: "A. Wanjiku",
    requestedAt: "2026-06-21",
    role: "GM / CEO",
    originTable: "mandates",
    originId: "MDT-005",
    entityId: "group"
  },
  {
    id: "APP-1050",
    type: "Payroll Accrual Sign-off",
    detail: "June Consolidated Payroll Run PR-2026-06 disbursement approval",
    amount: 2800000,
    requestedBy: "P. Officer",
    requestedAt: "2026-06-21",
    role: "GM",
    originTable: "payroll",
    originId: "PR-2026-06",
    entityId: "group"
  },
  {
    id: "APP-1051",
    type: "Mandate Expense Authorization",
    detail: "Accrued lift repair petty cash claim for Nakuru Villas (MDT-001)",
    amount: 15000,
    requestedBy: "O. Lead",
    requestedAt: "2026-06-21",
    role: "GM",
    originTable: "expenses",
    originId: "EXP-8891",
    entityId: "group"
  }
];

const INITIAL_FINANCE_ALERTS = [
  { id: "a1", type: "danger", title: "Defaulters > 90 Days", count: 12, value: "KES 1.2M", icon: IconShieldExclamation, link: "/fin/rentals/defaulters" },
  { id: "a2", type: "warning", title: "Mandates Pending", count: 3, value: "Awaiting GM", icon: IconFileText, link: "/fin/mandates/pending-approval" },
  { id: "a3", type: "warning", title: "Uncredited Cheques", count: 5, value: "> 5 Biz Days", icon: IconClockExclamation, link: "/fin/cheques/deposited" },
  { id: "a4", type: "danger", title: "Statutory Remittances", count: 2, value: "Due in 3 Days", icon: IconAlertTriangle, link: "/fin/payroll/remittances" },
];

const INITIAL_RECENT_ACTIVITY = [
  { id: "act1", time: "10 min ago", text: "Journal Entry JE-1042 posted (Management Fees - Runda)", user: "J. Mutua", type: "ledger" },
  { id: "act2", time: "1 hour ago", text: "Cheque CHQ-88291 marked as Credited", user: "System", type: "cheque" },
  { id: "act3", time: "2 hours ago", text: "Mandate MDT-009 activated for Kilimani Heights", user: "A. Wanjiku", type: "mandate" },
  { id: "act4", time: "3 hours ago", text: "Payroll Run PR-2026-06 disbursed", user: "GM Approved", type: "payroll" },
  { id: "act5", time: "Yesterday", text: "Journal Entry JE-1041 voided by Finance Head", user: "P. Omondi", type: "ledger" },
];

const COA_ACCOUNTS = [
  { code: "1000", name: "Cash & Bank Accounts", type: "Asset" },
  { code: "1200", name: "Accounts Receivable (A/R)", type: "Asset" },
  { code: "2000", name: "Accounts Payable (A/P)", type: "Liability" },
  { code: "2100", name: "Landlord Remittance Payable", type: "Liability" },
  { code: "3000", name: "Retained Earnings", type: "Equity" },
  { code: "4000", name: "Property Management Fees", type: "Revenue" },
  { code: "4100", name: "Leasing Commissions", type: "Revenue" },
  { code: "5000", name: "Office Operating Expenses", type: "Expense" },
  { code: "5100", name: "Salaries & Wages Expense", type: "Expense" },
];

const ACTIVE_MANDATES = [
  { ref: "MDT-001", landlord: "Jeremiah Mutua", property: "Runda Grove Villa", units: 12, rate: 10, monthlyCollect: 180000, status: "Active" },
  { ref: "MDT-002", landlord: "Mary Wanjiku", property: "Westlands Tower 4B", units: 8, rate: 10, monthlyCollect: 72000, status: "Active" },
  { ref: "MDT-003", landlord: "David Omondi", property: "Kilimani Heights", units: 15, rate: 8, monthlyCollect: 120000, status: "Active" },
  { ref: "MDT-004", landlord: "Sarah Howard", property: "Karen Ridge House", units: 6, rate: 12, monthlyCollect: 90000, status: "Active" },
];

const CLOSE_CONTROLS = [
  { ref: "TB-2026-06", label: "Trial balance validation check", status: "Balanced", evidence: "KES 0 variance", tone: "success" as const },
  { ref: "BS-2026-06", label: "Balance sheet ledger snapshot", status: "Draft Review", evidence: "2026-06-21", tone: "data" as const },
  { ref: "CF-2026-06", label: "Cash flow packages statement", status: "Pending Review", evidence: "Ops team verify", tone: "warning" as const },
  { ref: "RPT-208", label: "QR report PDF export", status: "Generated", evidence: "Token: QR-8821", tone: "success" as const },
];

const MOCK_JOURNAL_POSTINGS = [
  { ref: "JE-0042", subject: "Management fee recognition", detail: "June collections batch (Consolidated)", amount: 840000, status: "Posted", date: "2026-06-20" },
  { ref: "JE-0041", subject: "Landlord payable clearing", detail: "Residential remittance cycle", amount: 4260000, status: "Posted", date: "2026-06-19" },
  { ref: "JE-0040", subject: "Statutory remittance accrual", detail: "KRA PAYE / NSSF / SHIF deductions", amount: 612000, status: "Pending", date: "2026-06-18" },
  { ref: "JE-0039", subject: "Valuation fee invoice", detail: "Sunland Valuers Ltd - client contract", amount: 185000, status: "Draft", date: "2026-06-17" },
];

const STATUS_TONE = {
  Posted: "success" as const,
  Pending: "warning" as const,
  Draft: "data" as const,
  Approved: "success" as const,
};

const MANDATE_IMAGES = {
  group: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=600&q=80",
  commercial: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=600&q=80",
};

// ─── Main Component ───────────────────────────────────────────────────────────

export function FinanceOverviewScaffold() {
  const { activeEntityId } = useUIStore();
  const [mounted, setMounted] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState(new Date());
  const [activePeriod, setActivePeriod] = useState<FinancePeriod>("6M");
  const { pushToast } = useToast();

  const PERIODS: { label: string; value: FinancePeriod }[] = [
    { label: "1M", value: "1M" },
    { label: "3M", value: "3M" },
    { label: "6M", value: "6M" },
    { label: "1Y", value: "1Y" },
  ];

  const context = activeEntityId === "commercial" ? "commercial" : activeEntityId === "residential" ? "residential" : "group";
  const metricsContext = context === "commercial" ? "commercial" : "group";

  // Shared state for live updates
  const [metrics, setMetrics] = useState(INITIAL_FINANCE_METRICS);
  const [activity, setActivity] = useState(INITIAL_RECENT_ACTIVITY);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [alerts, setAlerts] = useState(INITIAL_FINANCE_ALERTS);
  const [journalPostings, setJournalPostings] = useState(MOCK_JOURNAL_POSTINGS);

  // Pending approvals state
  const [approvals, setApprovals] = useState(INITIAL_PENDING_APPROVALS);
  const [approvalConfirm, setApprovalConfirm] = useState<{ type: "approve" | "reject"; item: PendingApprovalRequest } | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  // Cross-departmental sync state
  const [deptSync, setDeptSync] = useState({
    hr: { headcount: 36, attendance: 94.2, payrollStatus: "Pending Sign-off" },
    bd: { dealsClosed: 12, pendingCommissions: 430000, pipelineProposals: 3 },
    fo: { pettyCash: 18400, loggedTrips: 14, fleetExpenses: 76000 }
  });

  const activeApprovals = useMemo(() => {
    return approvals.filter((a) => context === "group" || a.entityId === context);
  }, [approvals, context]);

  // Modals visibility state
  const [activeModal, setActiveModal] = useState<"journal" | "cheque" | "mandate" | "payroll" | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleApproveAction = (item: PendingApprovalRequest) => {
    setApprovals((prev) => prev.filter((a) => a.id !== item.id));

    // Decrement pending approvals count in metrics
    setMetrics((prev) => {
      const activeCtx = prev[metricsContext];
      return {
        ...prev,
        [metricsContext]: {
          ...activeCtx,
          pendingApprovals: Math.max(0, activeCtx.pendingApprovals - 1)
        }
      };
    });

    // Update alerts badges based on item type
    if (item.originTable === "cheques") {
      setAlerts((prev) => prev.map((a) => a.id === "a3" ? { ...a, count: Math.max(0, a.count - 1) } : a));
      // Cheque approved -> add to cash balance
      setMetrics((prev) => {
        const activeCtx = prev[metricsContext];
        return {
          ...prev,
          [metricsContext]: {
            ...activeCtx,
            netCash: activeCtx.netCash + item.amount
          }
        };
      });
      // Add to activity log
      setActivity((prev) => [
        { id: `act-${Date.now()}`, time: "Just now", text: `Cheque ${item.originId} cleared and credited to Cash`, user: "GM Approved", type: "cheque" },
        ...prev
      ]);
    } else if (item.originTable === "mandates") {
      setAlerts((prev) => prev.map((a) => a.id === "a2" ? { ...a, count: Math.max(0, a.count - 1) } : a));
      setActivity((prev) => [
        { id: `act-${Date.now()}`, time: "Just now", text: `Mandate ${item.originId} activated (Kilimani Heights)`, user: "GM Approved", type: "mandate" },
        ...prev
      ]);
    } else if (item.originTable === "payroll") {
      setAlerts((prev) => prev.map((a) => a.id === "a4" ? { ...a, count: Math.max(0, a.count - 1) } : a));
      setActivity((prev) => [
        { id: `act-${Date.now()}`, time: "Just now", text: `Payroll Run ${item.originId} disbursed successfully`, user: "GM Approved", type: "payroll" },
        ...prev
      ]);
      setDeptSync((prev) => ({
        ...prev,
        hr: { ...prev.hr, payrollStatus: "Disbursed" }
      }));
    } else if (item.originTable === "expenses") {
      setActivity((prev) => [
        { id: `act-${Date.now()}`, time: "Just now", text: `Mandate expense of KES ${item.amount.toLocaleString()} approved`, user: "GM Approved", type: "ledger" },
        ...prev
      ]);
    }

    pushToast({
      tone: "success",
      title: "Transaction Approved",
      body: `Request ${item.id} has been signed off and recorded.`
    });
  };

  const handleRejectAction = (item: PendingApprovalRequest, reason: string) => {
    setApprovals((prev) => prev.filter((a) => a.id !== item.id));

    // Decrement pending approvals count in metrics
    setMetrics((prev) => {
      const activeCtx = prev[metricsContext];
      return {
        ...prev,
        [metricsContext]: {
          ...activeCtx,
          pendingApprovals: Math.max(0, activeCtx.pendingApprovals - 1)
        }
      };
    });

    // Update alerts badges based on item type
    if (item.originTable === "cheques") {
      setAlerts((prev) => prev.map((a) => a.id === "a3" ? { ...a, count: Math.max(0, a.count - 1) } : a));
      setActivity((prev) => [
        { id: `act-${Date.now()}`, time: "Just now", text: `Cheque ${item.originId} rejected: ${reason}`, user: "GM Declined", type: "cheque" },
        ...prev
      ]);
    } else if (item.originTable === "mandates") {
      setAlerts((prev) => prev.map((a) => a.id === "a2" ? { ...a, count: Math.max(0, a.count - 1) } : a));
      setActivity((prev) => [
        { id: `act-${Date.now()}`, time: "Just now", text: `Mandate ${item.originId} rejected: ${reason}`, user: "GM Declined", type: "mandate" },
        ...prev
      ]);
    } else if (item.originTable === "payroll") {
      setAlerts((prev) => prev.map((a) => a.id === "a4" ? { ...a, count: Math.max(0, a.count - 1) } : a));
      setActivity((prev) => [
        { id: `act-${Date.now()}`, time: "Just now", text: `Payroll Run ${item.originId} rejected: ${reason}`, user: "GM Declined", type: "payroll" },
        ...prev
      ]);
      setDeptSync((prev) => ({
        ...prev,
        hr: { ...prev.hr, payrollStatus: "Rejected" }
      }));
    } else if (item.originTable === "expenses") {
      setActivity((prev) => [
        { id: `act-${Date.now()}`, time: "Just now", text: `Mandate expense rejected: ${reason}`, user: "GM Declined", type: "ledger" },
        ...prev
      ]);
    }

    pushToast({
      tone: "warning",
      title: "Transaction Rejected",
      body: `Request ${item.id} has been rejected and returned to draft status.`
    });
  };

  // ─── Form States ────────────────────────────────────────────────────────────

  // 1. Journal Entry Modal state
  const [jeMemo, setJeMemo] = useState("");
  const [jeLines, setJeLines] = useState([
    { account: "1000", debit: 0, credit: 0, memo: "" },
    { account: "4000", debit: 0, credit: 0, memo: "" },
  ]);

  // 2. Log Cheque Modal state
  const [chqNum, setChqNum] = useState("");
  const [chqPayer, setChqPayer] = useState("");
  const [chqAmount, setChqAmount] = useState(0);
  const [chqDate, setChqDate] = useState("");

  // 3. Draft Mandate Modal state
  const [mandateLandlord, setMandateLandlord] = useState("");
  const [mandateProperty, setMandateProperty] = useState("");
  const [mandateUnits, setMandateUnits] = useState(1);
  const [mandateRate, setMandateRate] = useState(10);
  const [mandateReason, setMandateReason] = useState("");
  const [mandateStartDate, setMandateStartDate] = useState("");

  // 4. Run Payroll Modal state
  const [payrollPeriod, setPayrollPeriod] = useState("June 2026");
  const payrollSummary = useMemo(() => ({
    gross: 2800000,
    paye: 384000,
    nssf: 98000,
    shif: 76000,
    housingLevy: 42000,
    net: 2200000,
  }), []);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(t);
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await new Promise((r) => setTimeout(r, 800));
    setLastRefreshed(new Date());
    setIsRefreshing(false);
    pushToast({ tone: "success", title: "Ledger Synced", body: "Financial metrics updated to latest block." });
  };

  // ─── Modal Actions ──────────────────────────────────────────────────────────

  const resetJournalForm = () => {
    setJeMemo("");
    setJeLines([
      { account: "1000", debit: 0, credit: 0, memo: "" },
      { account: "4000", debit: 0, credit: 0, memo: "" },
    ]);
  };

  const handleJournalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const totalDebits = jeLines.reduce((acc, l) => acc + l.debit, 0);
    const totalCredits = jeLines.reduce((acc, l) => acc + l.credit, 0);

    if (totalDebits !== totalCredits) {
      pushToast({ tone: "error", title: "Unbalanced Ledger", body: "Total debits must match total credits before posting." });
      return;
    }
    if (totalDebits === 0) {
      pushToast({ tone: "error", title: "Zero Value Entry", body: "Cannot post a journal entry with zero value." });
      return;
    }

    setIsSubmitting(true);
    await new Promise((r) => setTimeout(r, 700));

    const jeId = `JE-${Math.floor(1000 + Math.random() * 9000)}`;
    const logText = `Journal Entry ${jeId} posted (${jeMemo || "Manual Post"})`;

    setActivity((prev) => [
      { id: `act-${Date.now()}`, time: "Just now", text: logText, user: "F. Officer", type: "ledger" },
      ...prev,
    ]);

    const newJe = {
      ref: jeId,
      subject: jeMemo || "General Journal Posting",
      detail: `${jeLines.length} lines posted directly to ledger`,
      amount: totalDebits,
      status: "Posted",
      date: new Date().toISOString().split("T")[0],
    };
    setJournalPostings((prev) => [newJe, ...prev]);

    setMetrics((prev) => {
      const activeCtx = prev[metricsContext];
      return {
        ...prev,
        [metricsContext]: {
          ...activeCtx,
          netCash: activeCtx.netCash + (jeLines.find(l => l.account === "1000")?.debit || 0) - (jeLines.find(l => l.account === "1000")?.credit || 0),
          revenueMtd: activeCtx.revenueMtd + (jeLines.find(l => l.account === "4000" || l.account === "4100")?.credit || 0),
        }
      };
    });

    setIsSubmitting(false);
    setActiveModal(null);
    resetJournalForm();

    pushToast({
      tone: "success",
      title: "Journal Posted",
      body: `Entry ${jeId} committed successfully.`,
    });
  };

  const handleChequeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chqNum || !chqPayer || chqAmount <= 0 || !chqDate) {
      pushToast({ tone: "error", title: "Missing Fields", body: "Please fill out all cheque information." });
      return;
    }

    setIsSubmitting(true);
    await new Promise((r) => setTimeout(r, 600));

    const isPending = chqAmount > 500000;
    const alertText = isPending ? `awaiting dual approval` : `marked as credited`;

    setActivity((prev) => [
      { id: `act-${Date.now()}`, time: "Just now", text: `Cheque CHQ-${chqNum} logged (${chqPayer}) — ${alertText}`, user: "System", type: "cheque" },
      ...prev,
    ]);

    if (isPending) {
      setAlerts((prev) => {
        const copy = [...prev];
        const mandateAlertIndex = copy.findIndex(a => a.id === "a3");
        if (mandateAlertIndex !== -1) {
          copy[mandateAlertIndex] = {
            ...copy[mandateAlertIndex],
            count: copy[mandateAlertIndex].count + 1,
            value: `KES ${formatCompactKES(chqAmount)}`,
          };
        }
        return copy;
      });

      setMetrics((prev) => {
        const activeCtx = prev[metricsContext];
        return {
          ...prev,
          [metricsContext]: {
            ...activeCtx,
            pendingApprovals: activeCtx.pendingApprovals + 1,
          }
        };
      });

      pushToast({
        tone: "warning",
        title: "Cheque Held for Approval",
        body: `Cheque CHQ-${chqNum} exceeds KES 500K threshold and has been routed for GM/CEO approval.`,
      });
    } else {
      setMetrics((prev) => {
        const activeCtx = prev[metricsContext];
        return {
          ...prev,
          [metricsContext]: {
            ...activeCtx,
            netCash: activeCtx.netCash + chqAmount,
          }
        };
      });

      pushToast({
        tone: "success",
        title: "Cheque Credited",
        body: `Cheque CHQ-${chqNum} of KES ${chqAmount.toLocaleString()} has been cleared.`,
      });
    }

    setIsSubmitting(false);
    setActiveModal(null);
    setChqNum("");
    setChqPayer("");
    setChqAmount(0);
    setChqDate("");
  };

  const handleMandateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mandateLandlord || !mandateProperty || !mandateStartDate) {
      pushToast({ tone: "error", title: "Missing Fields", body: "Please fill out the landlord and property terms." });
      return;
    }
    if (mandateRate !== 10 && !mandateReason) {
      pushToast({ tone: "error", title: "Reason Required", body: "Please justify deviating from the standard 10% mandate rate." });
      return;
    }

    setIsSubmitting(true);
    await new Promise((r) => setTimeout(r, 700));

    const mandateId = `MDT-0${Math.floor(10 + Math.random() * 90)}`;
    const isApprovalNeeded = mandateUnits > 10;
    const statusText = isApprovalNeeded ? "submitted for GM approval" : "draft created";

    setActivity((prev) => [
      { id: `act-${Date.now()}`, time: "Just now", text: `Mandate ${mandateId} ${statusText} for ${mandateProperty}`, user: "A. Wanjiku", type: "mandate" },
      ...prev,
    ]);

    if (isApprovalNeeded) {
      setAlerts((prev) => {
        const copy = [...prev];
        const alertIndex = copy.findIndex(a => a.id === "a2");
        if (alertIndex !== -1) {
          copy[alertIndex] = {
            ...copy[alertIndex],
            count: copy[alertIndex].count + 1,
          };
        }
        return copy;
      });

      setMetrics((prev) => {
        const activeCtx = prev[metricsContext];
        return {
          ...prev,
          [metricsContext]: {
            ...activeCtx,
            pendingApprovals: activeCtx.pendingApprovals + 1,
          }
        };
      });

      pushToast({
        tone: "warning",
        title: "Mandate Pending Approval",
        body: `Mandate ${mandateId} has been routed to GM queue due to high unit volume.`,
      });
    } else {
      pushToast({
        tone: "success",
        title: "Mandate Drafted",
        body: `Mandate ${mandateId} created in draft state successfully.`,
      });
    }

    setIsSubmitting(false);
    setActiveModal(null);
    setMandateLandlord("");
    setMandateProperty("");
    setMandateUnits(1);
    setMandateRate(10);
    setMandateReason("");
    setMandateStartDate("");
  };

  const handlePayrollSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    await new Promise((r) => setTimeout(r, 900));

    const runId = `PR-2026-${Math.floor(10 + Math.random() * 90)}`;

    setActivity((prev) => [
      { id: `act-${Date.now()}`, time: "Just now", text: `Payroll Run ${runId} submitted for GM approval`, user: "F. Officer", type: "payroll" },
      ...prev,
    ]);

    setMetrics((prev) => {
      const activeCtx = prev[metricsContext];
      return {
        ...prev,
        [metricsContext]: {
          ...activeCtx,
          payables: activeCtx.payables + payrollSummary.gross,
          pendingApprovals: activeCtx.pendingApprovals + 1,
        }
      };
    });

    setIsSubmitting(false);
    setActiveModal(null);

    pushToast({
      tone: "success",
      title: "Payroll Submitted",
      body: `Payroll run ${runId} submitted to GM for review.`,
    });
  };

  // Render Skeleton before hydration to match ERP spec
  if (!mounted) {
    return (
      <div className="mx-auto flex max-w-[98rem] flex-col gap-4 pb-12">
        {/* Header skeleton */}
        <div className="h-12 w-72 rounded-xl skeleton-shimmer bg-slate-100 mt-2" />
        {/* KPI cards skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-2">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="h-[145px] rounded-2xl skeleton-shimmer bg-slate-100"
              style={{ animationDelay: `${i * 0.08}s` }} />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-6 h-[380px] rounded-2xl skeleton-shimmer bg-slate-100" />
          <div className="lg:col-span-3 h-[380px] rounded-2xl skeleton-shimmer bg-slate-100" />
          <div className="lg:col-span-3 h-[380px] rounded-2xl skeleton-shimmer bg-slate-100" />
        </div>
      </div>
    );
  }

  const activeMandateImage = context === "commercial" ? MANDATE_IMAGES.commercial : MANDATE_IMAGES.group;
  const activeMandate = context === "commercial" ? ACTIVE_MANDATES[1] : ACTIVE_MANDATES[0];

  const currentMetrics = metrics[metricsContext];

  return (
    <div className="mx-auto flex max-w-[98rem] flex-col gap-4 pb-12 animate-fade-in">

      {/* ── Dynamic Command Center Header ── */}
      <section className="flex flex-col gap-4 pb-2 pt-2 animate-fade-in">
        {/* Header & Sync */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h1 className="title-serif text-slate-900">
              Finance Command Center
            </h1>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* ── Global Period Filter ── */}
            <div className="flex items-center gap-1 rounded-xl border border-slate-200/80 bg-white p-1 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
              {PERIODS.map(p => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setActivePeriod(p.value)}
                  className={`rounded-lg px-3 py-1.5 text-caption transition-all ${activePeriod === p.value
                    ? "bg-[var(--sidebar)] text-white shadow-sm"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                    }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <span className="text-slate-400 font-mono text-tiny tracking-wide hidden sm:inline">
              Synced {lastRefreshed.toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-2 hover:text-slate-900 transition-all bg-white hover:bg-slate-50 px-4 py-2 rounded-full shadow-sm hover:shadow-md border-none text-body-regular"
              title="Sync Ledger"
            >
              <IconRefresh size={14} className={cn(isRefreshing && "animate-spin")} />
              <span>Sync</span>
            </button>
          </div>
        </div>


      </section>

      {/* KPI Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-2">
        {/* Net Cash Position */}
        <Link href="/fin/ledger/cash-flow" className="animate-fade-in-up">
          <div className="relative p-5 rounded-2xl bg-tertiary-gradient h-[145px] flex flex-col justify-between overflow-hidden shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 cursor-pointer group">
            <div className="absolute top-0 right-0 p-4 opacity-10 text-white"><IconBuildingBank size={80} /></div>
            <div className="flex items-center gap-2 relative z-10">
              <div className="size-[24px] rounded-full bg-white/10 flex items-center justify-center text-white">
                <IconWallet size={13} stroke={2.5} />
              </div>
              <span className="text-xs font-medium text-slate-300 tracking-wide uppercase label-caps">Net Cash Position</span>
              <IconArrowUpRight size={13} className="ml-auto text-white opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="flex items-end justify-between mt-auto mb-1 relative z-10">
              <span className="font-medium text-white tracking-tight font-mono leading-none text-3xl">{formatCompactKES(currentMetrics.netCash)}</span>
            </div>
            <div className="flex items-center justify-between text-sm font-medium text-emerald-400 relative z-10">
              <span>Current Liquidity</span>
              <span className="flex items-center bg-emerald-400/20 px-1.5 py-0.5 rounded text-emerald-300 font-mono">{currentMetrics.cashTrend}</span>
            </div>
          </div>
        </Link>

        {/* Revenue (MTD) */}
        <Link href="/fin/ledger/journal-entries" className="animate-fade-in-up">
          <div className="relative p-5 rounded-2xl bg-[#e6f4ea] h-[145px] flex flex-col justify-between overflow-hidden shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 cursor-pointer group">
            <div className="flex items-center gap-2">
              <div className="size-[24px] rounded-full bg-[#1b431e] flex items-center justify-center text-white">
                <IconReportMoney size={13} stroke={2.5} />
              </div>
              <span className="text-xs font-medium text-[#336336] tracking-wide uppercase label-caps">Revenue (MTD)</span>
            </div>
            <div className="flex flex-col mt-auto mb-1">
              <span className="font-medium text-[#1b431e] tracking-tight font-mono leading-none text-3xl">{formatCompactKES(currentMetrics.revenueMtd)}</span>
              <span className="text-xs font-medium text-[#467846] mt-2 leading-snug">Excludes rent liabilities</span>
            </div>
          </div>
        </Link>

        {/* A/R Outstanding */}
        <Link href="/fin/ap-ar/receivables" className="animate-fade-in-up">
          <div className="relative p-5 rounded-2xl bg-[#eef2f6] h-[145px] flex flex-col justify-between overflow-hidden shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 cursor-pointer group">
            <div className="flex items-center gap-2">
              <div className="size-[24px] rounded-full bg-[#24354a] flex items-center justify-center text-white">
                <IconArrowUpRight size={13} stroke={2.5} />
              </div>
              <span className="text-xs font-medium text-[#415671] tracking-wide uppercase label-caps">A/R Outstanding</span>
            </div>
            <div className="flex flex-col mt-auto mb-1">
              <span className="font-medium text-[#24354a] tracking-tight font-mono leading-none text-3xl">{formatCompactKES(currentMetrics.receivables)}</span>
            </div>
            <div className="h-[4px] bg-[#d2dde8] rounded-full overflow-hidden w-full mt-2">
              <div className="h-full bg-[#5a7c9f] rounded-full w-[35%]" />
            </div>
          </div>
        </Link>

        {/* A/P Outstanding */}
        <Link href="/fin/ap-ar/payables" className="animate-fade-in-up">
          <div className="relative p-5 rounded-2xl bg-[#fcf0e4] h-[145px] flex flex-col justify-between overflow-hidden shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 cursor-pointer group">
            <div className="flex items-center gap-2">
              <div className="size-[24px] rounded-full bg-[#5e2b17] flex items-center justify-center text-white">
                <IconTrendingDown size={13} stroke={2.5} />
              </div>
              <span className="text-xs font-medium text-[#824429] tracking-wide uppercase label-caps">A/P Outstanding</span>
            </div>
            <div className="flex flex-col mt-auto mb-1">
              <span className="font-medium text-[#5e2b17] tracking-tight font-mono leading-none text-3xl">{formatCompactKES(currentMetrics.payables)}</span>
            </div>
            <div className="h-[4px] bg-[#f2d8c9] rounded-full overflow-hidden w-full mt-2">
              <div className="h-full bg-[#c96f45] rounded-full w-[15%]" />
            </div>
          </div>
        </Link>
      </section>

      {/* ── Data Visualization Tier ── */}
      <FinanceOverviewCharts period={activePeriod} />

      {/* ── Finance Operations & Closing Scheduler ── */}
      <FinanceOperationsScheduler
        onNewJournal={() => { resetJournalForm(); setActiveModal("journal"); }}
        onLogCheque={() => setActiveModal("cheque")}
        onDraftMandate={() => setActiveModal("mandate")}
        onRunPayroll={() => setActiveModal("payroll")}
      />

      {/* ── Split Screen: Approvals (Left) & Nav Hub (Right) ── */}
      <section className="grid grid-cols-1 xl:grid-cols-12 gap-6 mt-4">
        {/* Left Column: Pending Approvals (Col 8) */}
        <div className="xl:col-span-8 flex flex-col">
          <div className="pt-4 border-t border-slate-200/60 mb-4">
            <h2 className="title-serif text-slate-900 font-normal">Pending Approvals & Awaiting Decisions</h2>
            <p className="text-desc-secondary mt-1">
              Review and authorize pending financial transactions requiring secondary verification and sign-off.
            </p>
          </div>

          <BoardPanel className="flex-1 animate-fade-in-up">
            {activeApprovals.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-body-regular">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 label-caps">
                      <th className="pb-2.5 px-3 text-xs">Reference</th>
                      <th className="pb-2.5 px-3 text-xs">Transaction Details</th>
                      <th className="pb-2.5 px-3 text-right text-xs">Value (KES)</th>
                      <th className="pb-2.5 px-3 text-center text-xs">Required Role</th>
                      <th className="pb-2.5 px-3 text-right text-xs">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {activeApprovals.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3 px-3 text-value-mono">
                          {item.id}
                        </td>
                        <td className="py-3 px-3">
                          <p className="font-medium text-slate-800">{item.type}</p>
                          <p className="text-meta-muted mt-0.5">{item.detail}</p>
                        </td>
                        <td className="py-3 px-3 text-right text-value-mono whitespace-nowrap">
                          KES {item.amount.toLocaleString()}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <Badge tone="warning" className="py-0.5 px-2 font-medium">
                            {item.role}
                          </Badge>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setApprovalConfirm({ type: "approve", item })}
                              className="flex items-center justify-center px-3 py-1.5 bg-[#f3df27] hover:bg-[#e6d220] text-[#151936] text-sm rounded-lg shadow-sm font-medium hover:-translate-y-0.5 transition-all"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setApprovalConfirm({ type: "reject", item });
                                setRejectionReason("");
                              }}
                              className="flex items-center justify-center px-3 py-1.5 bg-white border border-slate-200 text-rose-600 hover:bg-rose-50 text-sm rounded-lg shadow-sm font-medium hover:-translate-y-0.5 transition-all"
                            >
                              Reject
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-center h-full">
                <div className="size-10 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 mb-2">
                  <IconCheck size={18} stroke={2.5} />
                </div>
                <p className="text-title-primary">All Transactions Authorized</p>
                <p className="text-sm text-slate-400 mt-0.5">No pending items await GM/CEO decision sign-off.</p>
              </div>
            )}
          </BoardPanel>
        </div>

        {/* Right Column: Quick Navigation Hub (Col 4) */}
        <div className="xl:col-span-4 flex flex-col">
          <div className="pt-4 border-t border-slate-200/60 mb-4">
            <h2 className="title-serif text-slate-900 font-normal">Dashboards Navigation</h2>
            <p className="text-desc-secondary mt-1">
              Switch to specialized financial ledgers.
            </p>
          </div>

          <div className="flex flex-col gap-3 animate-fade-in-up">
            {[
              { title: "Payables & Receivables", href: "/fin/ap-ar", desc: "Track accounts payable & receivables.", icon: IconScale, theme: "blue" },
              { title: "Cheque Clearance", href: "/fin/cheques", desc: "Manage clearance and banking delays.", icon: IconReceipt2, theme: "amber" },
              { title: "Payroll & Deductions", href: "/fin/payroll", desc: "Oversee compensations & PAYE.", icon: IconCreditCardPay, theme: "purple" },
              { title: "Commissions & WHT", href: "/fin/commissions", desc: "Reconcile agent payouts & sales fees.", icon: IconCoins, theme: "emerald" },
              { title: "General Ledger", href: "/fin/ledger", desc: "Double-entry journals & Trial Balance.", icon: IconBuildingBank, theme: "slate" },
              { title: "Rentals & Arrears", href: "/fin/rentals", desc: "Assess tenant collection rates.", icon: IconBuildingEstate, theme: "teal" },
              { title: "Mandates Ledger", href: "/fin/mandates", desc: "Manage active property commission rates.", icon: IconBuildingSkyscraper, theme: "indigo" }
            ].map((item, idx) => {
              const ItemIcon = item.icon;

              const wrapperClass = `bg-gradient-to-r from-white to-${item.theme}-50/40 border border-${item.theme}-100 hover:border-${item.theme}-300 hover:shadow-[0_4px_20px_rgb(0,0,0,0.04)]`;
              const titleHoverClass = `group-hover:text-${item.theme}-700`;

              return (
                <Link key={idx} href={item.href} className="group block">
                  <div className={cn("px-4 py-3 rounded-xl transition-all duration-300 hover:-translate-y-0.5 relative overflow-hidden flex items-center justify-between gap-4", wrapperClass)}>
                    {/* Background faint icon */}
                    <div className={`absolute -right-2 top-1/2 -translate-y-1/2 opacity-5 group-hover:opacity-10 transition-opacity text-${item.theme}-600`}>
                      <ItemIcon size={64} stroke={1} />
                    </div>

                    <div className="relative z-10 flex-1">
                      <h3 className={cn("headline-md text-slate-800 leading-snug transition-colors", titleHoverClass)}>
                        {item.title}
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5 leading-relaxed font-normal truncate">
                        {item.desc}
                      </p>
                    </div>

                    <div className="relative z-10 size-8 rounded-full bg-white shadow-sm border border-slate-100 flex items-center justify-center text-slate-400 group-hover:text-slate-700 transition-colors shrink-0 group-hover:scale-105">
                      <IconArrowRight size={14} stroke={2.5} />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Monotony Breaker: Collections & Landlord Mandates Ledger ── */}
      <div className="pt-6 border-t border-slate-200/60 my-4">
        <h2 className="title-serif text-slate-900 font-normal">Collections & Landlord Mandates Ledger</h2>
        <p className="text-desc-secondary mt-1">
          Assess collection performance and review terms of active real estate contracts.
        </p>
      </div>

      <section className="grid grid-cols-1 xl:grid-cols-12 gap-4 mt-2">
        {/* Col 1-4: Featured Active Mandate (Visual Image Card) */}
        <Card className="xl:col-span-4 h-[340px] bg-slate-900 border-none hover:shadow-md transition-all overflow-hidden relative group flex flex-col justify-between animate-fade-in-up rounded-2xl">
          <div className="absolute inset-0 z-0">
            <Image
              src={activeMandateImage}
              alt={activeMandate.property}
              fill
              sizes="(max-width: 1024px) 100vw, 400px"
              className="object-cover transition-transform duration-700 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-950/45 to-slate-950/30" />
          </div>
          <div className="absolute top-0 inset-x-0 p-4 flex items-center justify-between z-10">
            <span className="backdrop-blur-md bg-white/10 text-white border border-white/20 px-2.5 py-1 rounded-md label-caps text-xs">Featured Mandate</span>
            <Badge tone="success" className="py-0.5 px-2 font-medium">Active</Badge>
          </div>
          <div className="absolute bottom-0 inset-x-0 p-5 flex flex-col justify-end text-white z-10">
            <div>
              <p className="text-[#f3df27] tracking-tight leading-none font-mono text-2xl font-medium">KES {activeMandate.monthlyCollect.toLocaleString()}/mo</p>
              <h3 className="text-lg font-medium text-white mt-1.5 leading-snug">{activeMandate.property}</h3>
              <p className="text-sm text-slate-300 font-medium mt-0.5 uppercase tracking-wide">Landlord: {activeMandate.landlord}</p>
            </div>
            <div className="flex items-center gap-3 mt-4 pt-3 border-t border-white/10">
              <span className="px-2.5 py-0.5 rounded-full border border-blue-500/30 bg-blue-500/20 text-blue-300 label-caps text-xs">{activeMandate.units} Units</span>
              <span className="text-sm font-mono text-slate-300 font-medium">{activeMandate.rate}% Commission</span>
              <Link
                href={`/fin/mandates/active`}
                className="focus-ring ml-auto inline-flex h-8 items-center justify-center rounded-xl bg-white text-slate-900 px-4 font-medium transition hover:bg-slate-100 text-sm"
              >
                Remittance
              </Link>
            </div>
          </div>
        </Card>

        {/* Col 5-7: Collection Rate Radial Panel */}
        <Card className="xl:col-span-3 p-5 flex flex-col justify-between items-center bg-white border border-slate-100 shadow-sm hover:shadow-md transition-all animate-fade-in-up h-[340px] rounded-2xl">
          <div className="w-full">
            <h3 className="text-title-primary">Collections Health</h3>
            <p className="text-meta-muted mt-0.5 leading-relaxed">Percentage of rent collected versus expected totals.</p>
          </div>

          <div className="flex-1 flex items-center justify-center w-full">
            <div className="size-36 rounded-full border-8 border-emerald-50 relative flex items-center justify-center">
              <svg className="absolute inset-0 size-full -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-emerald-500"
                  strokeDasharray={`${currentMetrics.collectionRate}, 100`}
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3.2"
                />
              </svg>
              <div className="text-center z-10">
                <p className="text-emerald-700 tracking-tight font-mono text-2xl font-medium">{currentMetrics.collectionRate}%</p>
                <p className="mt-0.5 label-caps text-meta-muted">Rent Secured</p>
              </div>
            </div>
          </div>

          <div className="w-full text-center border-t border-slate-50 pt-3">
            <p className="text-sm font-medium text-emerald-600 inline-flex items-center justify-center gap-1">
              <IconTrendingUp size={13} /> {currentMetrics.collectionTrend} collections increase
            </p>
          </div>
        </Card>

        {/* Col 8-12: Active Mandates Table */}
        <div className="xl:col-span-5 bg-white border border-slate-100 shadow-sm rounded-2xl flex flex-col p-5 animate-fade-in-up h-[340px] justify-between">
          <div className="mb-4">
            <h2 className="text-title-primary">Active Landlord Mandates</h2>
            <p className="text-meta-muted mt-0.5">Active contracts under management for the selected entity.</p>
          </div>

          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-left text-body-regular">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 label-caps">
                  <th className="pb-2 text-xs">Property</th>
                  <th className="pb-2 text-right text-xs">Collectible MTD</th>
                  <th className="pb-2 text-center text-xs">Units</th>
                  <th className="pb-2 text-right text-xs">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ACTIVE_MANDATES.map((m) => (
                  <tr key={m.ref} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-2.5">
                      <p className="font-medium text-slate-800">{m.property}</p>
                      <p className="text-meta-muted">{m.ref}</p>
                    </td>
                    <td className="py-2.5 text-right font-mono text-slate-700 font-medium">
                      KES {m.monthlyCollect.toLocaleString()}
                    </td>
                    <td className="py-2.5 text-center text-slate-500 font-mono">{m.units}</td>
                    <td className="py-2.5 text-right">
                      <Badge tone="success" className="py-0.5 px-2 font-medium">Active</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="border-t border-slate-50 pt-3">
            <Link
              href="/fin/mandates/active"
              className="text-sm font-medium text-blue-600 hover:text-blue-800 flex items-center justify-center gap-1.5"
            >
              Manage Mandates <IconArrowUpRight size={13} />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Revenue Stream & Audit Trail ── */}
      <div className="pt-6 border-t border-slate-200/60 my-4">
        <h2 className="title-serif text-slate-900 font-normal">Revenue Streams & Audit Trail</h2>
        <p className="text-desc-secondary mt-1">
          Deep-dive into income channels and review chronological General Ledger postings.
        </p>
      </div>

      <section className="grid grid-cols-1 xl:grid-cols-12 gap-4 mt-2">
        {/* Left: Revenue by Stream Chart */}
        <div className="xl:col-span-8 bg-white border border-slate-100 shadow-sm rounded-2xl p-6 min-h-[420px] flex flex-col animate-fade-in-up">
          <div className="flex items-center justify-between mb-6 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-title-primary">Revenue Breakdown</h2>
              <p className="text-xs text-slate-450 mt-0.5 font-normal">Management fees, leasing commissions, and valuation services.</p>
            </div>
            <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-lg border border-slate-100">
              {["This Month", "Last Month", "Q3"].map((period, i) => (
                <button key={period} className={cn("text-xs px-3 py-1.5 rounded-md font-medium transition-all", i === 0 ? "bg-white shadow-sm text-slate-800" : "text-slate-500 hover:text-slate-700")}>
                  {period}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 flex items-end">
            <RevenueStreamChart entityId={context} />
          </div>
        </div>

        {/* Right: Recent Financial Activity */}
        <div className="xl:col-span-4 bg-white border border-slate-100 shadow-sm rounded-2xl flex flex-col overflow-hidden animate-fade-in-up h-[450px]">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <h2 className="text-title-primary">Recent Financial Activity</h2>
            <Badge tone="neutral" className="font-medium">{activity.length} events</Badge>
          </div>
          <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
            <div className="space-y-4">
              {activity.map((log, i) => {
                const getIconInfo = (type: string) => {
                  switch (type) {
                    case "ledger": return { icon: IconScale, color: "text-blue-600 bg-blue-50 border-blue-100" };
                    case "cheque": return { icon: IconReceipt2, color: "text-amber-600 bg-amber-50 border-amber-100" };
                    case "mandate": return { icon: IconFileText, color: "text-emerald-600 bg-emerald-50 border-emerald-100" };
                    case "payroll": return { icon: IconCreditCardPay, color: "text-purple-600 bg-purple-50 border-purple-100" };
                    default: return { icon: IconActivity, color: "text-slate-600 bg-slate-50 border-slate-100" };
                  }
                };

                const { icon: LogIcon, color } = getIconInfo(log.type);

                return (
                  <div key={log.id} className="flex gap-3.5 relative">
                    {i < activity.length - 1 && (
                      <div className="absolute left-[15px] top-[32px] bottom-[-16px] w-px bg-slate-100" />
                    )}
                    <div className={cn("size-[30px] rounded-lg border flex items-center justify-center shrink-0 z-10 shadow-sm", color)}>
                      <LogIcon size={14} stroke={2.5} />
                    </div>
                    <div className="flex-1 min-w-0 pb-1">
                      <p className="text-slate-700 leading-snug font-medium cursor-pointer hover:text-blue-600 transition-colors text-base">
                        {log.text}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-meta-muted font-mono">{log.time}</span>
                        <span className="text-xs text-slate-350">•</span>
                        <span className="text-desc-secondary">{log.user}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="p-4 border-t border-slate-100 bg-slate-50/50">
            <Link href="/fin/ledger/journal-entries" className="w-full text-center text-base font-medium text-[#151936] hover:text-blue-700 transition-colors py-2.5 bg-white rounded-xl border border-slate-200 flex items-center justify-center gap-1.5 shadow-sm hover:shadow">
              View Full Audit Log
            </Link>
          </div>
        </div>
      </section>

      {/* ── SECTION 5: General Ledger & Closing Readiness Audit ── */}
      <div className="pt-6 border-t border-slate-200/60 my-4 animate-fade-in-up">
        <h2 className="title-serif text-slate-900 font-normal">General Ledger & Closing Readiness Audit</h2>
        <p className="text-desc-secondary mt-1">
          Review balanced ledger postings, and track closing statement snappings with QR verification logs.
        </p>
      </div>

      <section className="grid grid-cols-1 xl:grid-cols-12 gap-4 mt-2 animate-fade-in-up">
        {/* Left: General Ledger Work Queue */}
        <div className="xl:col-span-7 bg-white border border-slate-100 shadow-sm rounded-2xl p-5 flex flex-col justify-between">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-title-primary">General Ledger Work Queue</h3>
              <p className="text-xs text-slate-405 mt-0.5">Most recent journal postings entered into the General Ledger.</p>
            </div>
            <button
              onClick={() => { resetJournalForm(); setActiveModal("journal"); }}
              className="flex items-center gap-1.5 text-sm font-medium text-[#151936] bg-[#f3df27] px-3 py-1.5 rounded-xl shadow-sm hover:bg-[#e6d220] transition-colors hover:-translate-y-0.5"
            >
              <IconPlus size={12} stroke={2.5} /> Add Journal
            </button>
          </div>

          <div className="flex-1 overflow-x-auto min-h-[220px]">
            <table className="w-full text-left text-slate-650 text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 label-caps">
                  <th className="pb-2 text-xs">Reference</th>
                  <th className="pb-2 text-xs">Memo Details</th>
                  <th className="pb-2 text-right text-xs">Amount</th>
                  <th className="pb-2 text-center text-xs">Status</th>
                  <th className="pb-2 text-right text-xs">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {journalPostings.slice(0, 4).map((row) => (
                  <tr key={row.ref} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-2.5 text-value-mono">{row.ref}</td>
                    <td className="py-2.5">
                      <p className="font-medium text-slate-800">{row.subject}</p>
                      <p className="text-meta-muted">{row.detail}</p>
                    </td>
                    <td className="py-2.5 text-right text-value-mono">
                      KES {row.amount.toLocaleString()}
                    </td>
                    <td className="py-2.5 text-center">
                      <Badge tone={STATUS_TONE[row.status as keyof typeof STATUS_TONE] || "data"} className="py-0.5 px-2 font-medium">
                        {row.status}
                      </Badge>
                    </td>
                    <td className="py-2.5 text-right font-mono text-meta-muted">{row.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="border-t border-slate-50 pt-3 text-center">
            <Link href="/fin/ledger/journal-entries" className="text-sm font-medium text-blue-600 hover:text-blue-800 flex items-center justify-center gap-1">
              View All Journal Postings <IconArrowUpRight size={13} />
            </Link>
          </div>
        </div>

        {/* Right: Close Readiness */}
        <div className="xl:col-span-5 bg-white border border-slate-100 shadow-sm rounded-2xl p-5 flex flex-col justify-between">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-title-primary">Close Readiness Checks</h3>
              <p className="text-meta-muted mt-0.5">Month-end control list for Finance Head verification.</p>
            </div>
            <Badge tone="primary">Audit Mode</Badge>
          </div>

          <div className="flex-1 overflow-x-auto min-h-[220px]">
            <table className="w-full text-left text-slate-650 text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 label-caps">
                  <th className="pb-2 text-xs">Control</th>
                  <th className="pb-2 text-xs">Status</th>
                  <th className="pb-2 text-right text-xs">Evidence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {CLOSE_CONTROLS.map((c) => (
                  <tr key={c.ref} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-2.5">
                      <p className="text-value-mono">{c.ref}</p>
                      <p className="text-xs text-slate-450 mt-0.5">{c.label}</p>
                    </td>
                    <td className="py-2.5">
                      <Badge tone={c.tone} className="py-0.5 px-2 font-medium">{c.status}</Badge>
                    </td>
                    <td className="py-2.5 text-right text-desc-secondary">{c.evidence}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="border-t border-slate-50 pt-3 text-center">
            <Link href="/fin/reports/generate" className="text-sm font-medium text-blue-600 hover:text-blue-800 flex items-center justify-center gap-1">
              Verify QR Statements <IconArrowUpRight size={13} />
            </Link>
          </div>
        </div>
      </section>

      {/* ── SECTION 2.7: Market Insights & Broker Standings ── */}
      <section className="w-full mt-4 animate-fade-in-up" aria-label="Market insights">
        <UnifiedMarketBoard />
      </section>

      {/* ── SECTION 4: Cross-Departmental Financial Sync ── */}
      <div className="pt-6 border-t border-slate-200/60 my-4 animate-fade-in-up">
        <h2 className="title-serif text-slate-900 font-normal">Cross-Departmental Financial Sync</h2>
        <p className="text-desc-secondary mt-1">
          Monitor operating inputs and ledger accruals flowing from human resources, business development, and front office logistics.
        </p>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2 animate-fade-in-up">
        {/* Card 1: Human Resources & Payroll Handoff */}
        <Card className="p-5 bg-white border border-slate-100 shadow-sm flex flex-col justify-between h-[180px] rounded-2xl group hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="size-8 rounded-lg bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-650 shadow-sm">
                <IconUsersGroup size={16} stroke={2.5} />
              </div>
              <span className="text-slate-500 label-caps text-xs">Human Resources</span>
            </div>
            <Badge tone="primary" className="py-0.5 px-2 font-medium">Staff Ledger</Badge>
          </div>

          <div className="space-y-1.5 my-3">
            <div className="flex justify-between text-base text-slate-650 font-medium">
              <span>Active Organization Headcount</span>
              <span className="font-mono text-slate-800">{deptSync.hr.headcount} Employees</span>
            </div>
            <div className="flex justify-between text-sm text-slate-400 font-medium">
              <span>Timesheet Check-in Status</span>
              <span className="font-mono text-emerald-600">{deptSync.hr.attendance}% Compliance</span>
            </div>
          </div>

          <div className="border-t border-slate-50 pt-2 flex items-center justify-between text-sm">
            <span className="text-slate-400 font-medium">Payroll Status:</span>
            <span className="font-mono text-purple-600 font-medium">{deptSync.hr.payrollStatus}</span>
          </div>
        </Card>

        {/* Card 2: Business Development & Commissions Pipeline */}
        <Card className="p-5 bg-white border border-slate-100 shadow-sm flex flex-col justify-between h-[180px] rounded-2xl group hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="size-8 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700 shadow-sm">
                <IconCoins size={16} stroke={2.5} />
              </div>
              <span className="text-slate-500 label-caps text-xs">Business Dev</span>
            </div>
            <Badge tone="success" className="py-0.5 px-2 font-medium">Revenue Queue</Badge>
          </div>

          <div className="space-y-1.5 my-3">
            <div className="flex justify-between text-base text-slate-650 font-medium">
              <span>Closed Real Estate Deals</span>
              <span className="font-mono text-slate-800">{deptSync.bd.dealsClosed} Wins</span>
            </div>
            <div className="flex justify-between text-sm text-slate-400 font-medium">
              <span>Pending Commission Accrual</span>
              <span className="font-mono text-slate-700 font-medium">KES {deptSync.bd.pendingCommissions.toLocaleString()}</span>
            </div>
          </div>

          <div className="border-t border-slate-50 pt-2 flex items-center justify-between text-sm">
            <span className="text-slate-400 font-medium">Pipeline Proposals:</span>
            <span className="font-mono text-slate-700 font-medium">{deptSync.bd.pipelineProposals} Pending</span>
          </div>
        </Card>

        {/* Card 3: Front Office Operations & Fleet Petty Cash */}
        <Card className="p-5 bg-white border border-slate-100 shadow-sm flex flex-col justify-between h-[180px] rounded-2xl group hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="size-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-700 shadow-sm">
                <IconWallet size={16} stroke={2.5} />
              </div>
              <span className="text-slate-500 label-caps text-xs">Front Office</span>
            </div>
            <Badge tone="data" className="py-0.5 px-2 font-medium">Operating Float</Badge>
          </div>

          <div className="space-y-1.5 my-3">
            <div className="flex justify-between text-base text-slate-650 font-medium">
              <span>Office Petty Cash Balance</span>
              <span className="font-mono text-slate-800">KES {deptSync.fo.pettyCash.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm text-slate-400 font-medium">
              <span>Active Logistics Deliveries</span>
              <span className="font-mono text-slate-700 font-medium">{deptSync.fo.loggedTrips} Trips Logged</span>
            </div>
          </div>

          <div className="border-t border-slate-50 pt-2 flex items-center justify-between text-sm">
            <span className="text-slate-400 font-medium">Fleet Fuel Expenses:</span>
            <span className="font-mono text-blue-700 font-medium">KES {deptSync.fo.fleetExpenses.toLocaleString()}</span>
          </div>
        </Card>
      </section>



      {/* ── Quick Action Modals ── */}

      {/* A. New Journal Entry Modal */}
      <Modal
        open={activeModal === "journal"}
        onClose={() => { if (!isSubmitting) setActiveModal(null); }}
        title="Post New Journal Entry"
        description="Record balanced double-entry transactional postings directly to the General Ledger."
        size="lg"
      >
        <form onSubmit={handleJournalSubmit} className="space-y-4">
          <div className="grid gap-2">
            <label className="text-body-primary">Memo / Description</label>
            <input
              type="text"
              required
              placeholder="e.g. Accrued Management Fees - Kilimani Heights"
              value={jeMemo}
              onChange={(e) => setJeMemo(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 outline-none focus:border-slate-400 text-body-primary"
            />
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <label className="text-body-primary">Ledger Posting Lines</label>
              <button
                type="button"
                onClick={() => setJeLines([...jeLines, { account: "1000", debit: 0, credit: 0, memo: "" }])}
                className="text-sm font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                <IconPlus size={13} /> Add Line
              </button>
            </div>

            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
              {jeLines.map((line, idx) => (
                <div key={idx} className="flex gap-2.5 items-center">
                  <div className="w-[30%]">
                    <select
                      value={line.account}
                      onChange={(e) => {
                        const copy = [...jeLines];
                        copy[idx].account = e.target.value;
                        setJeLines(copy);
                      }}
                      className="w-full border border-slate-200 rounded-xl px-2.5 py-2 outline-none bg-white text-body-primary"
                    >
                      {COA_ACCOUNTS.map((acc) => (
                        <option key={acc.code} value={acc.code}>
                          {acc.code} - {acc.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="w-[20%]">
                    <input
                      type="number"
                      placeholder="Debit"
                      value={line.debit || ""}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        const copy = [...jeLines];
                        copy[idx].debit = val;
                        if (val > 0) copy[idx].credit = 0;
                        setJeLines(copy);
                      }}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 outline-none font-mono font-medium text-sm"
                    />
                  </div>

                  <div className="w-[20%]">
                    <input
                      type="number"
                      placeholder="Credit"
                      value={line.credit || ""}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        const copy = [...jeLines];
                        copy[idx].credit = val;
                        if (val > 0) copy[idx].debit = 0;
                        setJeLines(copy);
                      }}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 outline-none font-mono font-medium text-sm"
                    />
                  </div>

                  <div className="w-[25%]">
                    <input
                      type="text"
                      placeholder="Line Memo"
                      value={line.memo}
                      onChange={(e) => {
                        const copy = [...jeLines];
                        copy[idx].memo = e.target.value;
                        setJeLines(copy);
                      }}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 outline-none font-medium text-sm"
                    />
                  </div>

                  {jeLines.length > 2 && (
                    <button
                      type="button"
                      onClick={() => setJeLines(jeLines.filter((_, i) => i !== idx))}
                      className="text-red-500 hover:text-red-700"
                    >
                      <IconTrash size={15} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Validation Status Indicator */}
          {(() => {
            const debits = jeLines.reduce((acc, l) => acc + l.debit, 0);
            const credits = jeLines.reduce((acc, l) => acc + l.credit, 0);
            const isBalanced = debits === credits && debits > 0;
            const diff = Math.abs(debits - credits);

            return (
              <div className={cn(
                "p-3 rounded-xl border flex items-center justify-between text-sm font-medium",
                isBalanced ? "bg-emerald-50/50 border-emerald-100 text-emerald-800" : "bg-rose-50/50 border-rose-100 text-rose-800"
              )}>
                <div className="flex items-center gap-1.5">
                  <IconInfoCircle size={15} />
                  <span>
                    {isBalanced
                      ? "Ledger Posting is balanced and ready for commit."
                      : `Lines are unbalanced. Difference: KES ${diff.toLocaleString()}`
                    }
                  </span>
                </div>
                <div className="font-mono">
                  D: {debits.toLocaleString()} | C: {credits.toLocaleString()}
                </div>
              </div>
            );
          })()}

          <div className="flex gap-2 justify-end pt-3">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => setActiveModal(null)}
              className="px-4 py-2 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors text-body-regular"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || jeLines.reduce((a, l) => a + l.debit, 0) !== jeLines.reduce((a, l) => a + l.credit, 0)}
              className="px-4 py-2 bg-[#151936] text-white rounded-xl hover:bg-slate-800 disabled:opacity-50 transition-colors font-medium text-sm"
            >
              {isSubmitting ? "Posting..." : "Commit Entry"}
            </button>
          </div>
        </form>
      </Modal>

      {/* B. Log Cheque Modal */}
      <Modal
        open={activeModal === "cheque"}
        onClose={() => { if (!isSubmitting) setActiveModal(null); }}
        title="Log Received Cheque"
        description="Verify details and log bank cheques. High values trigger dual authorization policies."
        size="md"
      >
        <form onSubmit={handleChequeSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <label className="text-slate-500 label-caps text-xs">Cheque Number</label>
              <input
                type="text"
                required
                placeholder="CHQ-88291"
                value={chqNum}
                onChange={(e) => setChqNum(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 outline-none focus:border-slate-400 transition-colors text-body-primary"
              />
            </div>
            <div className="grid gap-1.5">
              <label className="text-slate-500 label-caps text-xs">Payer Account / Landlord</label>
              <input
                type="text"
                required
                placeholder="e.g. Mary Wanjiku"
                value={chqPayer}
                onChange={(e) => setChqPayer(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 outline-none focus:border-slate-400 transition-colors text-body-primary"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <label className="text-slate-500 label-caps text-xs">Amount (KES)</label>
              <input
                type="number"
                required
                placeholder="e.g. 640000"
                value={chqAmount || ""}
                onChange={(e) => setChqAmount(parseFloat(e.target.value) || 0)}
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 outline-none focus:border-slate-400 transition-colors text-body-primary"
              />
            </div>
            <div className="grid gap-1.5">
              <label className="text-slate-500 label-caps text-xs">Deposited Date</label>
              <input
                type="date"
                required
                value={chqDate}
                onChange={(e) => setChqDate(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 outline-none focus:border-slate-400 transition-colors text-body-primary"
              />
            </div>
          </div>

          {chqAmount > 500000 && (
            <div className="p-3.5 rounded-xl border border-amber-100 bg-amber-50/50 flex gap-2.5 text-amber-800 font-medium text-sm animate-fade-in">
              <IconShieldExclamation size={18} className="shrink-0 text-amber-600" />
              <div>
                <p className="font-medium text-amber-900 mb-0.5 text-sm">Policy Control Triggered</p>
                <p className="font-normal text-slate-600 leading-relaxed text-xs">
                  {"Deposited banker's cheques exceeding KES 500,000 require co-signing by both the Finance Head and General Manager before being credited. Status will be marked as \"Pending Approval\"."}
                </p>
              </div>
            </div>
          )}

          <div className="flex gap-2 justify-end pt-3">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => setActiveModal(null)}
              className="px-4 py-2 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors text-body-regular"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-[#151936] text-white rounded-xl hover:bg-slate-800 transition-colors font-medium text-sm"
            >
              {isSubmitting ? "Logging..." : "Log Cheque"}
            </button>
          </div>
        </form>
      </Modal>

      {/* C. Draft Mandate Modal */}
      <Modal
        open={activeModal === "mandate"}
        onClose={() => { if (!isSubmitting) setActiveModal(null); }}
        title="Draft Property Management Mandate"
        description="Establish commission terms and collectibility scopes for new property portfolios."
        size="md"
      >
        <form onSubmit={handleMandateSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <label className="text-slate-500 label-caps text-xs">Landlord Account</label>
              <input
                type="text"
                required
                placeholder="e.g. Jeremiah Mutua"
                value={mandateLandlord}
                onChange={(e) => setMandateLandlord(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 outline-none focus:border-slate-400 transition-colors text-body-primary"
              />
            </div>
            <div className="grid gap-1.5">
              <label className="text-slate-500 label-caps text-xs">Property Name</label>
              <input
                type="text"
                required
                placeholder="e.g. Kilimani Heights Annex"
                value={mandateProperty}
                onChange={(e) => setMandateProperty(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 outline-none focus:border-slate-400 transition-colors text-body-primary"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="grid gap-1.5 col-span-1">
              <label className="text-slate-500 label-caps text-xs">Unit Count</label>
              <input
                type="number"
                min={1}
                required
                value={mandateUnits}
                onChange={(e) => setMandateUnits(parseInt(e.target.value) || 1)}
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 outline-none focus:border-slate-400 transition-colors text-body-primary"
              />
            </div>
            <div className="grid gap-1.5 col-span-1">
              <label className="text-slate-500 label-caps text-xs">Rate (%)</label>
              <input
                type="number"
                min={1}
                max={100}
                required
                value={mandateRate}
                onChange={(e) => setMandateRate(parseFloat(e.target.value) || 10)}
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 outline-none focus:border-slate-400 transition-colors text-body-primary"
              />
            </div>
            <div className="grid gap-1.5 col-span-1">
              <label className="text-slate-500 label-caps text-xs">Start Date</label>
              <input
                type="date"
                required
                value={mandateStartDate}
                onChange={(e) => setMandateStartDate(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 outline-none focus:border-slate-400 transition-colors text-body-primary"
              />
            </div>
          </div>

          {mandateRate !== 10 && (
            <div className="grid gap-1.5 animate-fade-in">
              <label className="text-rose-500 label-caps text-xs">Rate Deviation Justification</label>
              <textarea
                required
                rows={2}
                placeholder="Explain why the rate deviates from standard 10% commission..."
                value={mandateReason}
                onChange={(e) => setMandateReason(e.target.value)}
                className="w-full border border-rose-200 bg-rose-50/10 rounded-xl px-3.5 py-2.5 outline-none focus:border-rose-300 transition-colors text-body-primary"
              />
            </div>
          )}

          {mandateUnits > 10 && (
            <div className="p-3.5 rounded-xl border border-amber-100 bg-amber-50/50 flex gap-2.5 text-amber-800 font-medium text-sm animate-fade-in">
              <IconFileText size={18} className="shrink-0 text-amber-600" />
              <div>
                <p className="font-medium text-amber-900 mb-0.5 text-sm">High-Volume Mandate Approval</p>
                <p className="font-normal text-slate-600 leading-relaxed text-xs">
                  Management mandates covering portfolios with more than 10 units are subject to GM / CEO sign-off before tenant ledger syncing is unlocked.
                </p>
              </div>
            </div>
          )}

          <div className="flex gap-2 justify-end pt-3">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => setActiveModal(null)}
              className="px-4 py-2 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors text-body-regular"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || (mandateRate !== 10 && !mandateReason)}
              className="px-4 py-2 bg-[#151936] text-white rounded-xl hover:bg-slate-800 transition-colors font-medium text-sm"
            >
              {isSubmitting ? "Drafting..." : "Create Mandate"}
            </button>
          </div>
        </form>
      </Modal>

      {/* D. Run Payroll Modal */}
      <Modal
        open={activeModal === "payroll"}
        onClose={() => { if (!isSubmitting) setActiveModal(null); }}
        title="Execute Period Payroll Run"
        description="Verify hours submitted by HR and compile statutory obligations."
        size="md"
      >
        <form onSubmit={handlePayrollSubmit} className="space-y-4">
          <div className="grid gap-2">
            <label className="text-body-primary">Payroll Period</label>
            <select
              value={payrollPeriod}
              onChange={(e) => setPayrollPeriod(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 outline-none bg-white focus:border-slate-400 text-body-primary"
            >
              <option value="June 2026">June 2026 (Submitted by HR)</option>
              <option value="July 2026">July 2026 (Draft)</option>
            </select>
          </div>

          <div className="rounded-xl border border-slate-200 overflow-hidden bg-slate-50/50">
            <div className="p-3 bg-slate-100 border-b border-slate-200 flex justify-between items-center text-body-primary">
              <span>HR Hours Registry Handoff</span>
              <Badge tone="success">Validated</Badge>
            </div>

            <div className="p-4 space-y-3.5 text-sm text-slate-650">
              <div className="flex justify-between items-center border-b border-slate-100 pb-1.5">
                <span>Aggregated gross salary</span>
                <span className="text-value-mono">{formatCompactKES(payrollSummary.gross)}</span>
              </div>
              <div className="space-y-1.5 pl-3 border-l-2 border-slate-200">
                <div className="flex justify-between text-slate-500 text-xs">
                  <span>PAYE Income Tax (KRA)</span>
                  <span className="font-mono text-slate-700">{formatCompactKES(payrollSummary.paye)}</span>
                </div>
                <div className="flex justify-between text-slate-500 text-xs">
                  <span>NSSF Deductions</span>
                  <span className="font-mono text-slate-700">{formatCompactKES(payrollSummary.nssf)}</span>
                </div>
                <div className="flex justify-between text-slate-500 text-xs">
                  <span>SHIF Healthcare Contribution</span>
                  <span className="font-mono text-slate-700">{formatCompactKES(payrollSummary.shif)}</span>
                </div>
                <div className="flex justify-between text-slate-500 text-xs">
                  <span>Affordable Housing Levy (1.5%)</span>
                  <span className="font-mono text-slate-700">{formatCompactKES(payrollSummary.housingLevy)}</span>
                </div>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-slate-200 font-medium text-slate-800">
                <span>Net Disbursement Estimate</span>
                <span className="font-mono text-[#1b431e] text-base">{formatCompactKES(payrollSummary.net)}</span>
              </div>
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-3">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => setActiveModal(null)}
              className="px-4 py-2 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors text-body-regular"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || payrollPeriod !== "June 2026"}
              className="px-4 py-2 bg-[#151936] text-white rounded-xl hover:bg-slate-800 transition-colors font-medium text-sm"
            >
              {isSubmitting ? "Submitting Run..." : "Submit Payroll Run"}
            </button>
          </div>
        </form>
      </Modal>

      {/* E. Approval Confirm Dialog */}
      <Modal
        open={!!approvalConfirm}
        onClose={() => { if (!isSubmitting) setApprovalConfirm(null); }}
        title={approvalConfirm?.type === "approve" ? "Authorize Transaction" : "Decline Transaction"}
        description={approvalConfirm?.type === "approve"
          ? "Confirm execution of this transaction. This will commit changes directly to the General Ledger."
          : "Please specify the reason for declining this request. Rejections require formal comments for auditing."
        }
        size="md"
      >
        <div className="space-y-4">
          {approvalConfirm?.item && (
            <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 space-y-2 text-body-regular">
              <div className="flex justify-between items-center">
                <span className="font-mono text-slate-400">{approvalConfirm.item.id}</span>
                <Badge tone="warning">{approvalConfirm.item.type}</Badge>
              </div>
              <p className="text-slate-800 font-medium">{approvalConfirm.item.detail}</p>
              {approvalConfirm.item.amount > 0 && (
                <div className="flex justify-between items-center pt-2 border-t border-slate-200/60 font-medium text-slate-800">
                  <span>Transaction Value</span>
                  <span className="text-value-mono">{formatCompactKES(approvalConfirm.item.amount)}</span>
                </div>
              )}
            </div>
          )}

          {approvalConfirm?.type === "reject" && (
            <div className="grid gap-1.5">
              <label className="text-body-primary">Justification Comments</label>
              <textarea
                required
                rows={3}
                placeholder="Explain why this request is being declined..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="w-full border border-rose-200 bg-rose-50/10 rounded-xl px-3.5 py-2.5 outline-none focus:border-rose-300 transition-colors text-body-primary"
              />
            </div>
          )}

          <div className="flex gap-2 justify-end pt-3">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => setApprovalConfirm(null)}
              className="px-4 py-2 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors text-body-regular"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isSubmitting || (approvalConfirm?.type === "reject" && !rejectionReason.trim())}
              onClick={async () => {
                if (!approvalConfirm) return;
                const activeConfirm = approvalConfirm;
                setIsSubmitting(true);
                await new Promise((r) => setTimeout(r, 600));
                if (activeConfirm.type === "approve") {
                  handleApproveAction(activeConfirm.item);
                } else {
                  handleRejectAction(activeConfirm.item, rejectionReason);
                }
                setIsSubmitting(false);
                setApprovalConfirm(null);
              }}
              className={cn(
                "px-4 py-2 rounded-xl text-sm font-medium transition-colors text-white",
                approvalConfirm?.type === "approve"
                  ? "bg-[#151936] hover:bg-slate-805"
                  : "bg-rose-600 hover:bg-rose-700 disabled:opacity-50"
              )}
            >
              {isSubmitting
                ? (approvalConfirm?.type === "approve" ? "Authorizing..." : "Declining...")
                : (approvalConfirm?.type === "approve" ? "Authorize & Post" : "Confirm Decline")
              }
            </button>
          </div>
        </div>
      </Modal>

    </div>
  );
}
