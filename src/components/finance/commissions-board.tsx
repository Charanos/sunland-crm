"use client";

import { useState, useMemo, useEffect, useSyncExternalStore } from "react";
import {
  IconSearch,
  IconCoins,
  IconClock,
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
  IconFilter,
  IconCalendar,
  IconAlertCircle,
  IconBookmark,
  IconArrowRight
} from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast-provider";
import { Modal } from "@/components/ui/modal";
import { Drawer } from "@/components/ui/drawer";
import { FinanceModuleNav } from "@/components/finance/finance-module-nav";
import { BoardHeader, BoardPanel, Button, PaginationControls } from "@/components/ui/erp-primitives";
import { cn } from "@/lib/utils/cn";
import { formatCompactKES } from "@/lib/utils/format";
import { useUIStore } from "@/store/ui";

// ─── Interfaces ──────────────────────────────────────────────────────────────

interface AgentDeal {
  id: string;
  dealCode: string;
  propertyName: string;
  agentName: string;
  agentPin: string;
  serviceCategory: "Property Management" | "Property Sales & Letting" | "Project Management" | "Feasibility Studies" | "Property Valuation";
  dealValue: number;
  commissionRate: number; // e.g. 3 for 3%
  grossPayout: number;
  whtAmount: number; // 10% Withholding Tax
  netPayout: number;
  status: "Draft" | "Pending" | "Approved" | "Disbursed";
  date: string;
  justificationNotes?: string;
  activityLog: string[];
}

interface WhtFiling {
  id: string;
  filingCode: string;
  period: string;
  accruedWht: number;
  remittanceRef?: string;
  paymentDate?: string;
  status: "Draft" | "Submitted";
  activityLog: string[];
}

interface LevyEmployeeDeduction {
  employeeName: string;
  kraPin: string;
  grossPay: number;
  employeeShare: number;
  employerShare: number;
  totalContribution: number;
}

interface LevyRecord {
  id: string;
  levyCode: string;
  period: string;
  grossPayroll: number;
  employeeShare: number;
  employerShare: number;
  totalLevy: number;
  status: "Draft" | "Remitted";
  paymentRef?: string;
  paymentDate?: string;
  employees?: LevyEmployeeDeduction[];
  activityLog: string[];
}

// ─── Initial Mock Data ────────────────────────────────────────────────────────

const INITIAL_DEALS: AgentDeal[] = [
  {
    id: "deal-01",
    dealCode: "DEAL-1004",
    propertyName: "Westpoint Commercial Block Sale",
    agentName: "Sarah Wambui",
    agentPin: "A018273645N",
    serviceCategory: "Property Sales & Letting",
    dealValue: 85000000,
    commissionRate: 3.0,
    grossPayout: 2550000,
    whtAmount: 255000,
    netPayout: 2295000,
    status: "Approved",
    date: "2026-06-20",
    activityLog: [
      "Deal registered on pipeline close by Sarah Wambui · 2026-06-20",
      "Commission rate verified at standard 3.0% Sales rate",
      "Approved and verified for payroll disbursement by Finance Head Dennis Munge · 2026-06-21"
    ]
  },
  {
    id: "deal-02",
    dealCode: "DEAL-1003",
    propertyName: "Kilimani Warehouse letting lease",
    agentName: "James Mwangi",
    agentPin: "A039485761K",
    serviceCategory: "Property Sales & Letting",
    dealValue: 1200000,
    commissionRate: 10.0,
    grossPayout: 120000,
    whtAmount: 12000,
    netPayout: 108000,
    status: "Approved",
    date: "2026-06-18",
    activityLog: [
      "Lease finalized and checked by James Mwangi · 2026-06-18",
      "Standard 10.0% Lettings commission mapped",
      "Approved by Finance Head Dennis Munge · 2026-06-19"
    ]
  },
  {
    id: "deal-03",
    dealCode: "DEAL-1002",
    propertyName: "Nakuru Villas Appraisal",
    agentName: "Grace Nyambura",
    agentPin: "A072819304P",
    serviceCategory: "Property Valuation",
    dealValue: 45000000,
    commissionRate: 2.5, // Standard is 2.0%
    grossPayout: 1125000,
    whtAmount: 112500,
    netPayout: 1012500,
    status: "Pending",
    date: "2026-06-15",
    justificationNotes: "Appraisal rate elevated to 2.5% due to premium field survey costs and Nakuru municipal access challenges approved in core mandate.",
    activityLog: [
      "Valuation report completed by Grace Nyambura · 2026-06-15",
      "Rate deviation detected: 2.5% vs standard 2.0% for Valuations. Justification noted.",
      "Awaiting CEO Paul Amos override/sign-off due to policy threshold deviation."
    ]
  },
  {
    id: "deal-04",
    dealCode: "DEAL-1001",
    propertyName: "Riverside Development Study",
    agentName: "Albert Omondi",
    agentPin: "A058192038Q",
    serviceCategory: "Feasibility Studies",
    dealValue: 3500000,
    commissionRate: 5.0,
    grossPayout: 175000,
    whtAmount: 17500,
    netPayout: 157500,
    status: "Draft",
    date: "2026-06-11",
    activityLog: [
      "Feasibility survey draft completed by Albert Omondi · 2026-06-11",
      "Auto-saved as draft payout request"
    ]
  }
];

const INITIAL_WHT: WhtFiling[] = [
  {
    id: "wht-01",
    filingCode: "WHT-2026-06",
    period: "June 2026",
    accruedWht: 379500,
    status: "Draft",
    activityLog: ["Aggrued from approved agent deals in June period · 2026-06-20"]
  },
  {
    id: "wht-02",
    filingCode: "WHT-2026-05",
    period: "May 2026",
    accruedWht: 290000,
    remittanceRef: "KRA-WHT-202605-882B",
    paymentDate: "2026-06-10",
    status: "Submitted",
    activityLog: [
      "Accrued from approved agent deals in May period · 2026-05-28",
      "Filing submitted to KRA portal and NCBA bank remittance cleared · 2026-06-10"
    ]
  }
];

const INITIAL_LEVIES: LevyRecord[] = [
  {
    id: "levy-01",
    levyCode: "AHL-2026-06",
    period: "June 2026",
    grossPayroll: 2800000,
    employeeShare: 42000,
    employerShare: 42000,
    totalLevy: 84000,
    status: "Draft",
    employees: [
      { employeeName: "Paul Amos", kraPin: "A001029384C", grossPay: 500000, employeeShare: 7500, employerShare: 7500, totalContribution: 15000 },
      { employeeName: "Dennis Munge", kraPin: "A008273645N", grossPay: 300000, employeeShare: 4500, employerShare: 4500, totalContribution: 9000 },
      { employeeName: "Cody Fisher", kraPin: "A002938475L", grossPay: 280000, employeeShare: 4200, employerShare: 4200, totalContribution: 8400 },
      { employeeName: "Sarah Wambui", kraPin: "A018273645N", grossPay: 255000, employeeShare: 3825, employerShare: 3825, totalContribution: 7650 },
      { employeeName: "James Mwangi", kraPin: "A039485761K", grossPay: 120000, employeeShare: 1800, employerShare: 1800, totalContribution: 3600 }
    ],
    activityLog: ["Imported from payroll run PAY-2026-06 · 2026-06-20"]
  },
  {
    id: "levy-02",
    levyCode: "AHL-2026-05",
    period: "May 2026",
    grossPayroll: 2710000,
    employeeShare: 40650,
    employerShare: 40650,
    totalLevy: 81300,
    status: "Remitted",
    paymentRef: "TX-AHL-55928-KRA",
    paymentDate: "2026-06-15",
    employees: [
      { employeeName: "Paul Amos", kraPin: "A001029384C", grossPay: 500000, employeeShare: 7500, employerShare: 7500, totalContribution: 15000 },
      { employeeName: "Dennis Munge", kraPin: "A008273645N", grossPay: 280000, employeeShare: 4200, employerShare: 4200, totalContribution: 8400 },
      { employeeName: "Cody Fisher", kraPin: "A002938475L", grossPay: 280000, employeeShare: 4200, employerShare: 4200, totalContribution: 8400 },
      { employeeName: "Sarah Wambui", kraPin: "A018273645N", grossPay: 230000, employeeShare: 3450, employerShare: 3450, totalContribution: 6900 }
    ],
    activityLog: ["Imported from payroll run PAY-2026-05 · 2026-05-28", "Remitted to KRA Affordable Housing Fund · 2026-06-15"]
  }
];

const ROWS_PER_PAGE = 5;

// Standard rates mapping
const SERVICE_STANDARD_RATES: Record<AgentDeal["serviceCategory"], number> = {
  "Property Management": 10.0,
  "Property Sales & Letting": 3.0,
  "Project Management": 5.0,
  "Feasibility Studies": 5.0,
  "Property Valuation": 2.0
};

const AGENT_PINS: Record<string, string> = {
  "Sarah Wambui": "A018273645N",
  "James Mwangi": "A039485761K",
  "Grace Nyambura": "A072819304P",
  "Albert Omondi": "A058192038Q"
};

const downloadCsv = (filename: string, csvContent: string) => {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export function CommissionsBoard({ tabId = "deals" }: { tabId: string }) {
  const { pushToast } = useToast();
  const activeEntityId = useUIStore((state) => state.activeEntityId);
  const mounted = useSyncExternalStore(
    () => () => { },
    () => true,
    () => false,
  );
  const [currentRole, setCurrentRole] = useState<string>("ceo");

  // Search & pagination state
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);

  // Data states
  const [deals, setDeals] = useState<AgentDeal[]>(INITIAL_DEALS);
  const [whtFilings, setWhtFilings] = useState<WhtFiling[]>(INITIAL_WHT);
  const [levies, setLevies] = useState<LevyRecord[]>(INITIAL_LEVIES);

  const getDealsForPeriod = (period: string) => {
    const parts = period.split(" ");
    if (parts.length < 2) return [];
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const monthNum = String(monthNames.indexOf(parts[0]) + 1).padStart(2, "0");
    const year = parts[1];
    const prefix = `${year}-${monthNum}`;
    return deals.filter((d) => d.date.startsWith(prefix) && (d.status === "Approved" || d.status === "Disbursed"));
  };

  // Modals & drawers state
  const [selectedDeal, setSelectedDeal] = useState<AgentDeal | null>(null);
  const [selectedWht, setSelectedWht] = useState<WhtFiling | null>(null);
  const [selectedLevy, setSelectedLevy] = useState<LevyRecord | null>(null);
  const [showNewDealModal, setShowNewDealModal] = useState(false);
  const [showPayWhtModal, setShowPayWhtModal] = useState(false);
  const [showPayLevyModal, setShowPayLevyModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State - Register Deal
  const [newPropName, setNewPropName] = useState("");
  const [newAgentName, setNewAgentName] = useState("Sarah Wambui");
  const [newCategory, setNewCategory] = useState<AgentDeal["serviceCategory"]>("Property Sales & Letting");
  const [newDealValue, setNewDealValue] = useState(5000000);
  const [newCommRate, setNewCommRate] = useState(3.0);
  const [newJustification, setNewJustification] = useState("");

  // Form State - Pay WHT / Levy
  const [payRef, setPayRef] = useState("");

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.user?.role) {
          setCurrentRole(data.user.role);
        }
      })
      .catch(() => { });
  }, []);

  const formatMoney = (val: number) => formatCompactKES(val);
  const isGMorCEO = currentRole === "ceo" || currentRole === "general_manager";
  const isCEO = currentRole === "ceo";

  // Watch category to reset standard rate
  const handleCategoryChange = (cat: AgentDeal["serviceCategory"]) => {
    setNewCategory(cat);
    setNewCommRate(SERVICE_STANDARD_RATES[cat]);
    setNewJustification("");
  };

  const isRateDeviating = useMemo(() => {
    return newCommRate !== SERVICE_STANDARD_RATES[newCategory];
  }, [newCommRate, newCategory]);

  // --- Handlers ---
  const handleRegisterDeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isRateDeviating && !newJustification.trim()) {
      pushToast({
        tone: "error",
        title: "Justification Required",
        body: `A rate of ${newCommRate}% deviates from the standard ${SERVICE_STANDARD_RATES[newCategory]}% rate for ${newCategory}. You must supply a justification note.`
      });
      return;
    }

    setIsSubmitting(true);
    await new Promise((resolve) => setTimeout(resolve, 800));

    const gross = (newDealValue * newCommRate) / 100;
    const wht = gross * 0.10; // 10% Withholding Tax
    const net = gross - wht;

    const newDeal: AgentDeal = {
      id: `deal-${Date.now()}`,
      dealCode: `DEAL-100${deals.length + 1}`,
      propertyName: newPropName,
      agentName: newAgentName,
      agentPin: AGENT_PINS[newAgentName] || "A000000000X",
      serviceCategory: newCategory,
      dealValue: newDealValue,
      commissionRate: newCommRate,
      grossPayout: gross,
      whtAmount: wht,
      netPayout: net,
      status: isRateDeviating ? "Pending" : "Approved",
      date: new Date().toISOString().split("T")[0],
      justificationNotes: isRateDeviating ? newJustification : undefined,
      activityLog: [
        `Deal registered by Finance Officer · ${new Date().toISOString().split("T")[0]}`,
        isRateDeviating
          ? `Rate deviation detected: ${newCommRate}% vs standard ${SERVICE_STANDARD_RATES[newCategory]}%. Routed to CEO validation.`
          : `Standard commission of ${newCommRate}% approved automatically.`
      ]
    };

    setDeals([newDeal, ...deals]);
    setShowNewDealModal(false);
    setIsSubmitting(false);

    // Reset Form
    setNewPropName("");
    setNewDealValue(5000000);
    setNewCategory("Property Sales & Letting");
    setNewCommRate(3.0);
    setNewJustification("");

    pushToast({
      tone: isRateDeviating ? "warning" : "success",
      title: isRateDeviating ? "CEO Validation Gated" : "Deal Commission Accrued",
      body: isRateDeviating
        ? `Deal ${newDeal.dealCode} registered. Payout rates deviation requires CEO override.`
        : `Deal ${newDeal.dealCode} registered. Commission payout of ${formatMoney(gross)} accrued.`
    });
  };

  const handleApproveDeal = (deal: AgentDeal) => {
    setDeals((prev) =>
      prev.map((d) => {
        if (d.id === deal.id) {
          return {
            ...d,
            status: "Approved",
            activityLog: [`Commission rate verified and approved by CEO Paul Amos · ${new Date().toISOString().split("T")[0]}`, ...d.activityLog]
          };
        }
        return d;
      })
    );
    setSelectedDeal(null);
    pushToast({
      tone: "success",
      title: "Deal Approved",
      body: `Commission payout authorized for deal ${deal.dealCode}.`
    });
  };

  const handlePayWhtSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWht || !payRef.trim()) return;

    setIsSubmitting(true);
    await new Promise((resolve) => setTimeout(resolve, 800));

    const todayStr = new Date().toISOString().split("T")[0];

    setWhtFilings((prev) =>
      prev.map((w) => {
        if (w.id === selectedWht.id) {
          return {
            ...w,
            status: "Submitted",
            remittanceRef: payRef,
            paymentDate: todayStr,
            activityLog: [`WHT Filing remitted to KRA portal. Ref: ${payRef} · ${todayStr}`, ...w.activityLog]
          };
        }
        return w;
      })
    );

    setShowPayWhtModal(false);
    setPayRef("");
    setIsSubmitting(false);
    setSelectedWht(null);

    pushToast({
      tone: "success",
      title: "WHT Remitted",
      body: `Withholding Tax return successfully filed with KRA.`
    });
  };

  const handlePayLevySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLevy || !payRef.trim()) return;

    setIsSubmitting(true);
    await new Promise((resolve) => setTimeout(resolve, 800));

    const todayStr = new Date().toISOString().split("T")[0];

    setLevies((prev) =>
      prev.map((l) => {
        if (l.id === selectedLevy.id) {
          return {
            ...l,
            status: "Remitted",
            paymentRef: payRef,
            paymentDate: todayStr,
            activityLog: [`AHL Statutory remittance sent. Ref: ${payRef} · ${todayStr}`, ...l.activityLog]
          };
        }
        return l;
      })
    );

    setShowPayLevyModal(false);
    setPayRef("");
    setIsSubmitting(false);
    setSelectedLevy(null);

    pushToast({
      tone: "success",
      title: "Housing Levy Remitted",
      body: `3.0% AHL statutory payout verified and posted.`
    });
  };

  // --- Computations ---
  const aggregates = useMemo(() => {
    const totalCount = deals.length;
    const pendingCount = deals.filter((d) => d.status === "Pending").length;
    const totalWht = whtFilings.filter((w) => w.status === "Draft").reduce((sum, w) => sum + w.accruedWht, 0);
    const totalComm = deals.filter((d) => d.status === "Approved" || d.status === "Disbursed").reduce((sum, d) => sum + d.grossPayout, 0);

    return {
      totalCount,
      pendingCount,
      totalWht,
      totalComm
    };
  }, [deals, whtFilings]);

  const filteredRows = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (tabId === "deals") {
      return deals.filter(
        (d) =>
          d.dealCode.toLowerCase().includes(q) ||
          d.propertyName.toLowerCase().includes(q) ||
          d.agentName.toLowerCase().includes(q) ||
          d.serviceCategory.toLowerCase().includes(q) ||
          d.status.toLowerCase().includes(q)
      );
    } else if (tabId === "wht-filings") {
      return whtFilings.filter(
        (w) =>
          w.filingCode.toLowerCase().includes(q) ||
          w.period.toLowerCase().includes(q) ||
          w.status.toLowerCase().includes(q)
      );
    } else {
      return levies.filter(
        (l) =>
          l.levyCode.toLowerCase().includes(q) ||
          l.period.toLowerCase().includes(q) ||
          l.status.toLowerCase().includes(q)
      );
    }
  }, [deals, whtFilings, levies, tabId, searchQuery]);

  const paginatedRows = useMemo(() => {
    return filteredRows.slice((page - 1) * ROWS_PER_PAGE, page * ROWS_PER_PAGE);
  }, [filteredRows, page]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / ROWS_PER_PAGE));

  if (!mounted) return <div className="h-screen w-full skeleton-shimmer bg-slate-50" />;

  return (
    <div className="mx-auto flex max-w-[98rem] flex-col gap-4 animate-fade-in pb-12">
      <BoardHeader
        title="Commissions & Statutory Withholding Tax (WHT)"
        description="Verify agent closed deal commission structures, log withholding tax filings, and track statutory Affordable Housing Levy compliance."
      />

      <FinanceModuleNav />

      {/* ── Hero & KPI Cards Section ────────────────────────────────────────── */}
      <section className="grid grid-cols-1 xl:grid-cols-[1.15fr_0.85fr] gap-4">
        {/* Left Column: Compact Hero Card */}
        <div className="relative min-h-[220px] xl:min-h-auto overflow-hidden rounded-2xl border border-white/[0.06] bg-tertiary-gradient p-6 text-white shadow-xl flex flex-col justify-between">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.1),transparent_60%)]" />
          {/* Subtle background image */}
          <div
            className="absolute inset-0 opacity-[0.05] mix-blend-overlay bg-cover bg-center"
            style={{ backgroundImage: `url(https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?q=80&w=2564&auto=format&fit=crop)` }}
          />
          <div className="absolute -top-24 -left-24 h-48 w-48 rounded-full bg-teal-500/10 blur-2xl" />

          <div className="relative z-10 space-y-4">
            <div className="flex items-center gap-3">
              <Badge tone="primary" className="bg-teal-500/20 text-teal-200 border-teal-500/30 px-3 py-1 shadow-sm backdrop-blur-md">
                Sunland Operations
              </Badge>
              <span className="text-sm font-normal tracking-widest uppercase text-slate-400/80">Commissions & WHT</span>
            </div>
            <div>
              <h2 className="title-serif text-4xl font-normal leading-tight tracking-tight text-white mb-2">
                Agent Commissions Ledger
              </h2>
              <p className="text-base leading-relaxed text-slate-300/85 font-light max-w-lg">
                Track agent commission payouts from closed sales and letting agreements, log KRA withholding tax (10% WHT) filings, and audit statutory Affordable Housing Levy compliance.
              </p>
            </div>
          </div>

          <div className="relative z-10 pt-4 flex items-center justify-between border-t border-white/10 mt-4">
            <div className="flex items-center gap-2">
              <span className="body-sm font-normal text-slate-400">Ledger Status:</span>
              <Badge tone="success" className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">Active & Audited</Badge>
            </div>
            <span className="font-mono text-sm text-slate-400">Updated: Today</span>
          </div>
        </div>

        {/* Right Column: 2x2 KPI Grid */}
        <div className="grid grid-cols-2 gap-3">
          <BoardPanel className="p-4 flex flex-col justify-between h-[120px] relative overflow-hidden group transition-all duration-300 hover:shadow-md hover:border-emerald-250 bg-gradient-to-b from-white to-emerald-50/10">
            <div className="flex items-center gap-2 text-slate-500">
              <IconCoins size={15} className="text-emerald-500" />
              <span className="body-sm font-medium uppercase tracking-wider">Closed Deals</span>
            </div>
            <div className="mt-auto">
              <span className="text-2xl leading-none text-value-mono">
                {aggregates.totalCount} Deals
              </span>
              <p className="body-sm text-slate-400 mt-1">Sourced MTD</p>
            </div>
          </BoardPanel>

          <BoardPanel className="p-4 flex flex-col justify-between h-[120px] relative overflow-hidden group transition-all duration-300 hover:shadow-md hover:border-amber-250 bg-gradient-to-b from-white to-amber-50/10">
            <div className="flex items-center gap-2 text-slate-500">
              <IconReceipt2 size={15} className="text-amber-500" />
              <span className="body-sm font-medium uppercase tracking-wider">Accrued WHT</span>
            </div>
            <div className="mt-auto">
              <span className="text-2xl leading-none text-value-mono">
                {formatMoney(aggregates.totalWht)}
              </span>
              <p className="body-sm text-slate-400 mt-1">Due July 9</p>
            </div>
          </BoardPanel>

          <BoardPanel className="p-4 flex flex-col justify-between h-[120px] relative overflow-hidden group transition-all duration-300 hover:shadow-md hover:border-indigo-250 bg-gradient-to-b from-white to-indigo-50/10">
            <div className="flex items-center gap-2 text-slate-500">
              <IconTimeline size={15} className="text-indigo-500" />
              <span className="body-sm font-medium uppercase tracking-wider">AHL Compliance</span>
            </div>
            <div className="mt-auto">
              <span className="text-2xl leading-none text-value-mono">
                98.5%
              </span>
              <p className="body-sm text-slate-400 mt-1">100% Remitted</p>
            </div>
          </BoardPanel>

          <BoardPanel className="p-4 flex flex-col justify-between h-[120px] relative overflow-hidden group transition-all duration-300 hover:shadow-md hover:border-teal-250 bg-gradient-to-b from-white to-teal-50/10">
            <div className="flex items-center gap-2 text-slate-500">
              <IconCoins size={15} className="text-teal-600" />
              <span className="body-sm font-medium uppercase tracking-wider">Total Commissions</span>
            </div>
            <div className="mt-auto">
              <span className="text-2xl font-mono font-medium tracking-tight text-[#151936] leading-none">
                {formatMoney(aggregates.totalComm)}
              </span>
              <p className="body-sm text-slate-400 mt-1">Paid/Approved</p>
            </div>
          </BoardPanel>
        </div>
      </section>

      {/* ── Main Workspace ────────────────────────────────────────────────── */}
      <BoardPanel className="mt-2">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4 mb-4">
          <div>
            <h3 className="title-serif text-xl font-normal text-slate-900">
              {tabId === "deals" ? "Closed Deal Register" : tabId === "wht-filings" ? "Withholding Tax Returns (KRA)" : "Affordable Housing Levy Ledger"}
            </h3>
            <p className="text-sm text-slate-450 mt-1 font-medium">
              {tabId === "deals"
                ? "Validate payouts for property sales, management, valuation, project and feasibility contracts."
                : tabId === "wht-filings"
                  ? "Track 10% Withholding Tax remittances to the Kenya Revenue Authority."
                  : "Monitor the 3.0% Affordable Housing Levy payroll integrations."}
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
                placeholder="Search ledger..."
                className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400 font-sans"
              />
            </div>
            <Button variant="secondary" size="sm">
              <IconFilter size={14} />
              Filters
            </Button>
            {tabId === "deals" && (
              <Button size="sm" onClick={() => setShowNewDealModal(true)}>
                <IconPlus size={14} />
                Register Deal Payout
              </Button>
            )}
          </div>
        </div>

        {paginatedRows.length > 0 ? (
          <div>
            {/* ── Deals Tab: Custom Dossier Grid ── */}
            {tabId === "deals" && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                {paginatedRows.map((row) => {
                  const deal = row as AgentDeal;
                  return (
                    <div
                      key={deal.id}
                      onClick={() => setSelectedDeal(deal)}
                      className={cn(
                        "relative flex flex-col justify-between overflow-hidden rounded-xl border p-5 shadow-sm transition-all duration-300 cursor-pointer hover:shadow-md bg-white hover:border-[#151936]/30",
                        deal.status === "Pending" ? "border-amber-200 bg-amber-50/5" : "border-slate-200"
                      )}
                    >
                      {/* Top Bar */}
                      <div className="flex justify-between items-start mb-3">
                        <span className="font-mono text-sm text-slate-400">{deal.dealCode}</span>
                        <Badge
                          tone={
                            deal.status === "Approved"
                              ? "success"
                              : deal.status === "Pending"
                                ? "warning"
                                : deal.status === "Disbursed"
                                  ? "primary"
                                  : "neutral"
                          }
                        >
                          {deal.status}
                        </Badge>
                      </div>

                      {/* Header Details */}
                      <div className="space-y-1 mb-4">
                        <h4 className="body-md font-medium text-slate-900 leading-snug truncate">
                          {deal.propertyName}
                        </h4>
                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                          <IconUser size={13} className="text-slate-405" />
                          <span>{deal.agentName}</span>
                          <span className="text-slate-300">•</span>
                          <span>{deal.serviceCategory}</span>
                        </div>
                      </div>

                      {/* Valuation Value & Comm rate */}
                      <div className="flex justify-between items-center bg-slate-50 rounded-lg p-2.5 mb-4 text-xs font-mono">
                        <div>
                          <p className="body-sm text-slate-400 uppercase">Deal Value</p>
                          <p className="text-slate-800 font-medium">{formatMoney(deal.dealValue)}</p>
                        </div>
                        <div className="text-right">
                          <p className="body-sm text-slate-400 uppercase">Rate</p>
                          <p className="text-teal-700 font-medium">{deal.commissionRate.toFixed(1)}%</p>
                        </div>
                      </div>

                      {/* Divider */}
                      <div className="border-t border-slate-100 my-2 pt-2.5 flex justify-between items-baseline">
                        <div>
                          <span className="body-sm text-slate-400 uppercase">Net Payout (90%)</span>
                          <p className="font-mono text-lg font-medium text-[#151936] mt-0.5">
                            {formatMoney(deal.netPayout)}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="body-sm text-slate-400 uppercase">WHT (10%): </span>
                          <span className="font-mono text-xs text-rose-600 font-medium">-{formatMoney(deal.whtAmount)}</span>
                        </div>
                      </div>

                      {/* Warning if pending rate deviation */}
                      {deal.status === "Pending" && (
                        <div className="mt-3 rounded bg-amber-50 p-2 text-sm text-amber-800 flex items-center gap-1.5 font-sans">
                          <IconAlertCircle size={14} className="shrink-0 text-amber-600" />
                          <span className="truncate">Rate deviates from standard. Gated for CEO.</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── WHT Filings Tab: Custom Certificate Sheets ── */}
            {tabId === "wht-filings" && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                {paginatedRows.map((row) => {
                  const wht = row as WhtFiling;
                  return (
                    <div
                      key={wht.id}
                      onClick={() => setSelectedWht(wht)}
                      className={cn(
                        "relative flex flex-col justify-between overflow-hidden rounded-xl border border-slate-200 p-5 shadow-sm transition-all duration-300 cursor-pointer hover:shadow-md bg-white hover:border-[#151936]/30",
                        wht.status === "Submitted" ? "bg-gradient-to-b from-white to-emerald-50/5" : ""
                      )}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <span className="font-mono text-sm text-slate-400">{wht.filingCode}</span>
                        <Badge tone={wht.status === "Submitted" ? "success" : "neutral"}>
                          {wht.status}
                        </Badge>
                      </div>

                      <div className="my-3 font-sans">
                        <span className="body-sm text-slate-400 uppercase tracking-widest block mb-0.5">Tax Period</span>
                        <h4 className="text-heading-primary">{wht.period}</h4>
                      </div>

                      <div className="border-t border-b border-slate-100 py-3 my-3">
                        <span className="body-sm text-slate-400 uppercase tracking-wider font-mono">10% WHT Return Accrued</span>
                        <p className="font-mono text-3xl font-normal text-slate-900 leading-none mt-1">
                          {formatMoney(wht.accruedWht)}
                        </p>
                      </div>

                      <div className="flex justify-between items-center text-xs mt-2">
                        {wht.status === "Submitted" ? (
                          <>
                            <div className="space-y-0.5">
                              <p className="body-sm text-slate-400 uppercase">KRA Ack Ref</p>
                              <p className="font-mono text-slate-700 truncate max-w-[130px]">{wht.remittanceRef}</p>
                            </div>
                            <span className="text-sm text-emerald-600 font-medium">Cleared</span>
                          </>
                        ) : (
                          <>
                            <span className="text-slate-400 italic">Remittance Pending</span>
                            <Button size="sm" onClick={(e) => { e.stopPropagation(); setSelectedWht(wht); setShowPayWhtModal(true); }} className="bg-[#151936] text-white">
                              File Return
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── Housing Levy Tab: Compliance Thermometers ── */}
            {tabId === "levy" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                {paginatedRows.map((row) => {
                  const levy = row as LevyRecord;
                  const isRemitted = levy.status === "Remitted";
                  const fillPercentage = isRemitted ? 100 : 0;
                  return (
                    <div
                      key={levy.id}
                      onClick={() => setSelectedLevy(levy)}
                      className="border border-slate-200 rounded-xl p-5 shadow-sm bg-white hover:shadow-md transition-all duration-300 cursor-pointer flex flex-col md:flex-row justify-between gap-6"
                    >
                      {/* Details Area */}
                      <div className="flex-1 space-y-4">
                        <div className="flex justify-between items-start">
                          <div className="space-y-0.5">
                            <span className="font-mono text-sm text-slate-400">{levy.levyCode}</span>
                            <h4 className="text-heading-primary">{levy.period}</h4>
                          </div>
                          <Badge tone={isRemitted ? "success" : "neutral"}>{levy.status}</Badge>
                        </div>

                        <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 rounded-lg p-3">
                          <div>
                            <p className="body-sm text-slate-400 uppercase mb-0.5">Gross Payroll</p>
                            <p className="font-mono font-medium text-slate-750">{formatMoney(levy.grossPayroll)}</p>
                          </div>
                          <div>
                            <p className="body-sm text-slate-400 uppercase mb-0.5">remitted 3.0%</p>
                            <p className="font-mono font-medium text-slate-800">{formatMoney(levy.totalLevy)}</p>
                          </div>
                          <div>
                            <p className="body-sm text-slate-400 uppercase mb-0.5">Employee (1.5%)</p>
                            <p className="font-mono text-slate-600">{formatMoney(levy.employeeShare)}</p>
                          </div>
                          <div>
                            <p className="body-sm text-slate-400 uppercase mb-0.5">Employer (1.5%)</p>
                            <p className="font-mono text-slate-600">{formatMoney(levy.employerShare)}</p>
                          </div>
                        </div>

                        {levy.status === "Draft" ? (
                          <Button size="sm" onClick={(e) => { e.stopPropagation(); setSelectedLevy(levy); setShowPayLevyModal(true); }} className="w-full bg-[#151936] text-white">
                            Settle Levy Return
                          </Button>
                        ) : (
                          <div className="text-xs text-slate-450 font-mono">
                            <span className="body-sm text-slate-400 uppercase block mb-0.5">Bank Ref</span>
                            <span className="text-slate-700">{levy.paymentRef} · {levy.paymentDate}</span>
                          </div>
                        )}
                      </div>

                      {/* Thermometer Area */}
                      <div className="w-[80px] shrink-0 flex flex-col items-center justify-between border-l border-slate-100 pl-4">
                        <p className="body-sm text-slate-400 uppercase text-center font-medium tracking-wide">Filing State</p>

                        {/* Thermometer Visual representation */}
                        <div className="relative w-7 h-28 bg-slate-100 rounded-full border border-slate-200/50 flex flex-col justify-end p-0.5 overflow-hidden my-2">
                          <div
                            style={{ height: `${fillPercentage}%` }}
                            className={cn(
                              "w-full rounded-full transition-all duration-1000",
                              isRemitted ? "bg-gradient-to-t from-emerald-500 to-teal-400" : "bg-transparent"
                            )}
                          />
                          {/* Pulsing indicator if filled */}
                          {isRemitted && (
                            <div className="absolute top-2 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-white rounded-full animate-ping" />
                          )}
                        </div>

                        <span className="text-body-primary">
                          {isRemitted ? "100%" : "0%"} Filed
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

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
              <h4 className="text-body-primary">No records found</h4>
              <p className="text-sm text-slate-455 leading-relaxed font-sans">
                Adjust the active search term or filter rules to locate specific ledger items.
              </p>
            </div>
          </div>
        )}
      </BoardPanel>

      {/* ── Drawer: Closed Deal Details ──────────────────────────────────── */}
      <Drawer
        open={Boolean(selectedDeal)}
        onClose={() => setSelectedDeal(null)}
        title={`Deal Dossier: ${selectedDeal?.dealCode ?? ""}`}
        width="34rem"
        footer={
          selectedDeal && (
            <div className="flex gap-2 w-full">
              <Button onClick={() => setSelectedDeal(null)} variant="secondary" className="flex-1">
                Close Panel
              </Button>
              {selectedDeal.status === "Pending" && isCEO && (
                <Button onClick={() => handleApproveDeal(selectedDeal)} className="flex-1 bg-[#151936] text-white">
                  Approve Commission Payout
                </Button>
              )}
            </div>
          )
        }
      >
        {selectedDeal && (
          <div className="space-y-6 text-slate-700 text-sm">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="size-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-500 border border-slate-100/50">
                <IconCoins size={20} />
              </div>
              <div>
                <h4 className="body-md font-medium text-slate-900 leading-snug">{selectedDeal.propertyName}</h4>
                <p className="body-sm text-slate-400 mt-0.5">{selectedDeal.dealCode} · Status: {selectedDeal.status}</p>
              </div>
            </div>

            <div className="space-y-5 font-sans">
              {/* Simulated Commission Payout Voucher */}
              <div className="relative border border-[#0f172a]/15 bg-gradient-to-r from-emerald-50/70 via-slate-50/50 to-emerald-50/50 p-6 rounded-2xl flex flex-col justify-between overflow-hidden shadow-[inset_0_1px_3px_rgba(255,255,255,0.8),0_4px_12px_rgba(0,0,0,0.02)] select-none font-mono">
                <div className="absolute right-8 top-5 select-none pointer-events-none opacity-[0.15] origin-center -rotate-12 border-2 border-dashed border-current px-3 py-1.5 text-lg font-black tracking-widest rounded text-[#151936]">
                  {selectedDeal.status.toUpperCase()}
                </div>

                <div className="flex justify-between items-start body-sm text-slate-450 border-b border-slate-200/50 pb-2">
                  <span className="font-sans font-medium text-slate-600">SUNLAND AGENT COMMISSION PAYOUT VOUCHER</span>
                  <span>REF: {selectedDeal.dealCode}</span>
                </div>

                <div className="my-4">
                  <p className="body-sm text-slate-400 uppercase tracking-wider font-mono font-medium">Net Agent Payout</p>
                  <p className="font-mono text-4xl font-normal text-slate-900 leading-none mt-1">
                    {formatMoney(selectedDeal.netPayout)}
                  </p>
                  <p className="body-sm text-slate-500 font-mono mt-1">Accrued from Gross: {formatMoney(selectedDeal.grossPayout)}</p>
                </div>

                <div className="space-y-2 border-t border-slate-200/50 pt-3 body-sm text-slate-550 font-sans">
                  <div className="flex justify-between">
                    <span>Agent Name</span>
                    <span className="font-mono font-medium text-slate-800">{selectedDeal.agentName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Core Service Category</span>
                    <span className="font-mono font-medium text-slate-700">{selectedDeal.serviceCategory}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Deal Value Base</span>
                    <span className="font-mono font-medium text-slate-750">{formatMoney(selectedDeal.dealValue)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Commission Rate</span>
                    <span className="font-mono font-medium text-slate-700">{selectedDeal.commissionRate.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-100 pt-2 text-[#b91c1c]">
                    <span>Withholding Tax (10% WHT)</span>
                    <span className="font-mono font-medium">-{formatMoney(selectedDeal.whtAmount)}</span>
                  </div>
                </div>
              </div>

              {/* Justification Warning for Devs */}
              {selectedDeal.justificationNotes && (
                <div className="rounded-xl border border-amber-250 bg-amber-50/40 p-4 body-sm leading-relaxed text-amber-800 space-y-1 bg-amber-50/20">
                  <div className="flex items-center gap-1.5">
                    <IconShieldCheck size={16} className="text-amber-600" />
                    <span className="font-medium text-amber-900">Commission Rate Deviation Justification</span>
                  </div>
                  <p className="text-amber-700 font-mono body-sm leading-relaxed bg-white/70 p-2.5 rounded border border-amber-200/50">
                    &quot;{selectedDeal.justificationNotes}&quot;
                  </p>
                </div>
              )}

              {/* Action checklist status */}
              <div className="space-y-2">
                <span className="body-sm text-slate-450 uppercase tracking-wider font-medium">Clearance Milestones</span>
                <div className="rounded-xl border border-slate-100 p-4 space-y-2.5 bg-slate-50/20 text-slate-600">
                  <div className="flex items-center gap-2 body-sm">
                    <IconCheck size={16} className="text-emerald-500 shrink-0" />
                    <span>Property core sales/lease contract finalized</span>
                  </div>
                  <div className="flex items-center gap-2 body-sm">
                    <IconCheck size={16} className="text-emerald-500 shrink-0" />
                    <span>Agent commission accrued at {selectedDeal.commissionRate.toFixed(1)}%</span>
                  </div>
                  <div className="flex items-center gap-2 body-sm">
                    <IconCheck size={16} className="text-emerald-500 shrink-0" />
                    <span>10% WHT deduction calculated and committed to filings ledger</span>
                  </div>
                  <div className="flex items-center gap-2 body-sm">
                    {selectedDeal.status === "Approved" || selectedDeal.status === "Disbursed" ? (
                      <IconCheck size={16} className="text-emerald-500 shrink-0" />
                    ) : (
                      <IconClock size={16} className="text-amber-500 shrink-0" />
                    )}
                    <span>Manager payout authorization status: <strong className="font-medium">{selectedDeal.status}</strong></span>
                  </div>
                </div>
              </div>

              {/* Process timeline log */}
              <div className="pt-2 border-t border-slate-100">
                <span className="body-sm text-slate-400 uppercase tracking-wider font-medium font-sans">Deal Filing Logs</span>
                <div className="mt-2 space-y-2 font-mono body-sm">
                  {selectedDeal.activityLog.map((log, idx) => (
                    <div key={idx} className="flex gap-2 text-slate-500 leading-normal">
                      <span className="size-1.5 rounded-full bg-slate-350 shrink-0 mt-1.5" />
                      <p>{log}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </Drawer>

      {/* ── Drawer: WHT Filing Details ────────────────────────────────────── */}
      <Drawer
        open={Boolean(selectedWht && !showPayWhtModal)}
        onClose={() => setSelectedWht(null)}
        title="KRA Withholding Tax Filing"
        width="34rem"
      >
        {selectedWht && (
          <div className="space-y-6 text-slate-700 text-sm font-sans">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="size-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-550 border border-slate-100/50">
                <IconReceipt2 size={20} />
              </div>
              <div>
                <h4 className="body-md font-medium text-slate-900 leading-snug">KRA WHT Return Summary</h4>
                <p className="body-sm text-slate-400 mt-0.5">{selectedWht.filingCode} · Period: {selectedWht.period}</p>
              </div>
            </div>

            <div className="space-y-5">
              <div className="relative border border-[#0f172a]/15 bg-gradient-to-r from-emerald-50/50 via-slate-50/50 to-indigo-50/50 p-6 rounded-2xl flex flex-col justify-between overflow-hidden shadow-[inset_0_1px_3px_rgba(255,255,255,0.8),0_4px_12px_rgba(0,0,0,0.02)] select-none font-mono">
                <div className="absolute right-8 top-5 select-none pointer-events-none opacity-[0.1] origin-center -rotate-12 border-2 border-dashed border-current px-3 py-1.5 text-lg font-black tracking-widest rounded text-slate-800">
                  {selectedWht.status.toUpperCase()}
                </div>

                <div className="flex justify-between items-start body-sm text-slate-450 border-b border-slate-200/50 pb-2">
                  <span className="font-sans font-medium text-slate-650">SUNLAND WITHHOLDING TAX RETURN (FORM KRA-WHT)</span>
                  <span>REF: {selectedWht.filingCode}</span>
                </div>

                <div className="my-3">
                  <p className="body-sm text-slate-450 uppercase tracking-wider font-mono">Total WHT Liability</p>
                  <p className="font-mono text-4xl font-normal text-slate-900 leading-none mt-1">
                    {formatMoney(selectedWht.accruedWht)}
                  </p>
                </div>

                <div className="space-y-2 border-t border-slate-200/50 pt-3 body-sm text-slate-550 font-sans">
                  <div className="flex justify-between">
                    <span>Tax Period</span>
                    <span className="font-mono font-medium text-slate-700">{selectedWht.period}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Rate Applied</span>
                    <span className="font-mono font-medium text-slate-800">10.0% standard agent WHT</span>
                  </div>
                  {selectedWht.status === "Submitted" && (
                    <>
                      <div className="flex justify-between border-t border-slate-100 pt-2 mt-1">
                        <span>KRA Portal Receipt Ref</span>
                        <span className="font-mono font-medium text-slate-800">{selectedWht.remittanceRef}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Filing Confirmation Date</span>
                        <span className="font-mono font-medium text-slate-700">{selectedWht.paymentDate}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Detailed WHT Schedule of Agents included */}
              <div className="space-y-2">
                <span className="body-sm text-slate-450 uppercase tracking-wider font-medium font-sans">Filing Schedule Details</span>
                <div className="rounded-xl border border-slate-200/60 overflow-hidden bg-slate-50/20">
                  <table className="w-full border-collapse text-left text-sm text-slate-700">
                    <thead className="bg-slate-50 border-b border-slate-100 text-desc-secondary">
                      <tr>
                        <th className="px-4 py-2 font-mono body-sm">Agent Name / PIN</th>
                        <th className="px-4 py-2 text-right font-mono body-sm">Gross Commission</th>
                        <th className="px-4 py-2 text-right font-mono body-sm">WHT (10%)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-sans">
                      {getDealsForPeriod(selectedWht.period).map((deal) => (
                        <tr key={deal.id}>
                          <td className="px-4 py-2">
                            <p className="font-medium text-slate-900 leading-none">{deal.agentName}</p>
                            <span className="text-xs text-slate-400 font-mono tracking-tight">{deal.agentPin}</span>
                          </td>
                          <td className="px-4 py-2 text-right font-mono text-slate-700">{formatMoney(deal.grossPayout)}</td>
                          <td className="px-4 py-2 text-right font-mono text-rose-600 font-medium">-{formatMoney(deal.whtAmount)}</td>
                        </tr>
                      ))}
                      {getDealsForPeriod(selectedWht.period).length === 0 && (
                        <tr>
                          <td colSpan={3} className="px-4 py-6 text-center text-slate-400 italic">No approved deals in this period.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* CSV Export Trigger */}
              <div className="pt-1">
                <Button
                  variant="secondary"
                  onClick={() => {
                    const dealsForPeriod = getDealsForPeriod(selectedWht.period);
                    const csvHeader = "Payer PIN,Agent PIN,Agent Name,Core Service Category,Gross Payout,Withholding Tax (10%),Net Payout,Filing Period\n";
                    const csvRows = dealsForPeriod
                      .map((d) => `A010293847C,${d.agentPin},${d.agentName},${d.serviceCategory},${d.grossPayout.toFixed(2)},${d.whtAmount.toFixed(2)},${d.netPayout.toFixed(2)},${selectedWht.period}`)
                      .join("\n");
                    downloadCsv(`KRA-WHT-Return-${selectedWht.filingCode}.csv`, csvHeader + csvRows);
                    pushToast({
                      tone: "success",
                      title: "iTax CSV Template Exported",
                      body: `WHT Return template file exported with ${dealsForPeriod.length} records. Ready for upload.`
                    });
                  }}
                  className="w-full justify-center flex items-center gap-1.5"
                  disabled={getDealsForPeriod(selectedWht.period).length === 0}
                >
                  <IconFileExport size={16} />
                  Export KRA iTax WHT CSV
                </Button>
              </div>

              {/* Logs */}
              <div className="pt-2 border-t border-slate-100 font-sans">
                <span className="body-sm text-slate-400 uppercase tracking-wider font-medium">Activity Logs</span>
                <div className="mt-2 space-y-2 font-mono body-sm">
                  {selectedWht.activityLog.map((log, idx) => (
                    <div key={idx} className="flex gap-2 text-slate-500 leading-normal">
                      <span className="size-1.5 rounded-full bg-slate-350 shrink-0 mt-1.5" />
                      <p>{log}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </Drawer>

      {/* ── Drawer: Levy Details ──────────────────────────────────────────── */}
      <Drawer
        open={Boolean(selectedLevy && !showPayLevyModal)}
        onClose={() => setSelectedLevy(null)}
        title="Affordable Housing Levy Return"
        width="34rem"
      >
        {selectedLevy && (
          <div className="space-y-6 text-slate-700 text-sm font-sans">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="size-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-550 border border-slate-100/50">
                <IconReceipt2 size={20} />
              </div>
              <div>
                <h4 className="body-md font-medium text-slate-900 leading-snug">Housing Levy Statement</h4>
                <p className="body-sm text-slate-400 mt-0.5">{selectedLevy.levyCode} · Filing Period: {selectedLevy.period}</p>
              </div>
            </div>

            <div className="space-y-5">
              <div className="relative border border-[#0f172a]/15 bg-gradient-to-r from-emerald-50/50 via-slate-50/50 to-indigo-50/50 p-6 rounded-2xl flex flex-col justify-between overflow-hidden shadow-[inset_0_1px_3px_rgba(255,255,255,0.8),0_4px_12px_rgba(0,0,0,0.02)] select-none font-mono">
                <div className="absolute right-8 top-5 select-none pointer-events-none opacity-[0.1] origin-center -rotate-12 border-2 border-dashed border-current px-3 py-1.5 text-lg font-black tracking-widest rounded">
                  {selectedLevy.status.toUpperCase()}
                </div>

                <div className="flex justify-between items-start body-sm text-slate-450 border-b border-slate-200/50 pb-2">
                  <span className="font-sans font-medium text-slate-650">SUNLAND HOUSING LEVY RETURN (FORM KRA-AHL)</span>
                  <span>REF: {selectedLevy.levyCode}</span>
                </div>

                <div className="my-3">
                  <p className="body-sm text-slate-450 uppercase tracking-wider font-mono">Accrued 3.0% Contribution</p>
                  <p className="font-mono text-4xl font-normal text-slate-900 leading-none mt-1">
                    {formatMoney(selectedLevy.totalLevy)}
                  </p>
                </div>

                <div className="space-y-2 border-t border-slate-200/50 pt-3 body-sm text-slate-550 font-sans">
                  <div className="flex justify-between">
                    <span>Filing Month Period</span>
                    <span className="font-mono font-medium text-slate-700">{selectedLevy.period}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Gross Payroll Sourced</span>
                    <span className="font-mono font-medium text-slate-800">{formatMoney(selectedLevy.grossPayroll)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Employer Share (1.5%)</span>
                    <span className="font-mono text-slate-700">{formatMoney(selectedLevy.employerShare)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Employee Deductions (1.5%)</span>
                    <span className="font-mono text-slate-700">{formatMoney(selectedLevy.employeeShare)}</span>
                  </div>
                  {selectedLevy.status === "Remitted" && (
                    <>
                      <div className="flex justify-between border-t border-slate-100 pt-2 mt-1">
                        <span>Cleared Payment Ref</span>
                        <span className="font-mono font-medium text-slate-850">{selectedLevy.paymentRef}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Payment Confirmation Date</span>
                        <span className="font-mono font-medium text-slate-700">{selectedLevy.paymentDate}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Detailed AHL Contribution Schedule */}
              <div className="space-y-2">
                <span className="body-sm text-slate-450 uppercase tracking-wider font-medium font-sans">Employee AHL Schedule</span>
                <div className="rounded-xl border border-slate-200/60 overflow-hidden bg-slate-50/20">
                  <table className="w-full border-collapse text-left text-sm text-slate-700">
                    <thead className="bg-slate-50 border-b border-slate-100 text-desc-secondary">
                      <tr>
                        <th className="px-4 py-2 font-mono body-sm">Employee Name / PIN</th>
                        <th className="px-4 py-2 text-right font-mono body-sm">Gross Salary</th>
                        <th className="px-4 py-2 text-right font-mono body-sm">Employee (1.5%)</th>
                        <th className="px-4 py-2 text-right font-mono body-sm">Employer (1.5%)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-sans">
                      {selectedLevy.employees?.map((emp, idx) => (
                        <tr key={idx}>
                          <td className="px-4 py-2">
                            <p className="font-medium text-slate-900 leading-none">{emp.employeeName}</p>
                            <span className="text-xs text-slate-400 font-mono tracking-tight">{emp.kraPin}</span>
                          </td>
                          <td className="px-4 py-2 text-right font-mono text-slate-700">{formatMoney(emp.grossPay)}</td>
                          <td className="px-4 py-2 text-right font-mono text-slate-600">{formatMoney(emp.employeeShare)}</td>
                          <td className="px-4 py-2 text-right font-mono text-slate-600">{formatMoney(emp.employerShare)}</td>
                        </tr>
                      ))}
                      {(!selectedLevy.employees || selectedLevy.employees.length === 0) && (
                        <tr>
                          <td colSpan={4} className="px-4 py-6 text-center text-slate-400 italic">No employee data imported for this period.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* CSV Export Trigger */}
              <div className="pt-1">
                <Button
                  variant="secondary"
                  onClick={() => {
                    const csvHeader = "Employee PIN,Employee Name,Gross Pay,Employee AHL Share (1.5%),Employer AHL Share (1.5%),Total AHL Contribution (3.0%),Filing Month\n";
                    const csvRows = (selectedLevy.employees || [])
                      .map((emp) => `${emp.kraPin},${emp.employeeName},${emp.grossPay.toFixed(2)},${emp.employeeShare.toFixed(2)},${emp.employerShare.toFixed(2)},${emp.totalContribution.toFixed(2)},${selectedLevy.period}`)
                      .join("\n");
                    downloadCsv(`KRA-AHL-Return-${selectedLevy.levyCode}.csv`, csvHeader + csvRows);
                    pushToast({
                      tone: "success",
                      title: "AHL Upload CSV Exported",
                      body: `AHL Return template file exported with ${(selectedLevy.employees || []).length} records.`
                    });
                  }}
                  className="w-full justify-center flex items-center gap-1.5"
                  disabled={!selectedLevy.employees || selectedLevy.employees.length === 0}
                >
                  <IconFileExport size={16} />
                  Export iTax AHL CSV
                </Button>
              </div>

              {/* Logs */}
              <div className="pt-2 border-t border-slate-100 font-sans">
                <span className="body-sm text-slate-400 uppercase tracking-wider font-medium">Activity Logs</span>
                <div className="mt-2 space-y-2 font-mono body-sm">
                  {selectedLevy.activityLog.map((log, idx) => (
                    <div key={idx} className="flex gap-2 text-slate-500 leading-normal">
                      <span className="size-1.5 rounded-full bg-slate-350 shrink-0 mt-1.5" />
                      <p>{log}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </Drawer>

      {/* ── Modal: Register Deal ──────────────────────────────────────────── */}
      <Modal open={showNewDealModal} onClose={() => setShowNewDealModal(false)} title="Register Deal Commission Payout" size="md">
        <form onSubmit={handleRegisterDeal} className="space-y-4 text-sm text-slate-750">
          <div className="rounded-xl bg-[#0c1f24]/5 border border-slate-200/50 p-4 font-sans text-slate-800">
            <h4 className="body-md font-medium text-slate-900 mb-1 flex items-center gap-1.5">
              <IconShieldCheck size={16} className="text-[#151936]" />
              Agent Commission Registration
            </h4>
            <p className="body-sm leading-relaxed opacity-95">
              Log sales and letting agency closures. Commissions are subjected to a statutory 10% Withholding Tax (WHT) deduction before disbursement checks.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="agentName" className="block body-sm font-medium text-slate-450 uppercase tracking-wider mb-2">Agent Name</label>
              <select
                id="agentName"
                value={newAgentName}
                onChange={(e) => setNewAgentName(e.target.value)}
                className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-850 outline-none focus:border-indigo-400 font-sans"
              >
                <option value="Sarah Wambui">Sarah Wambui (Sales Lead)</option>
                <option value="James Mwangi">James Mwangi (Lettings Lead)</option>
                <option value="Grace Nyambura">Grace Nyambura (Valuer)</option>
                <option value="Albert Omondi">Albert Omondi (Feasibility Specialist)</option>
              </select>
            </div>

            <div>
              <label htmlFor="serviceCategory" className="block body-sm font-medium text-slate-450 uppercase tracking-wider mb-2">Core Service Category</label>
              <select
                id="serviceCategory"
                value={newCategory}
                onChange={(e) => handleCategoryChange(e.target.value as AgentDeal["serviceCategory"])}
                className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-850 outline-none focus:border-indigo-400 font-sans"
              >
                <option value="Property Sales & Letting">Property Sales & Letting (Agency)</option>
                <option value="Property Management">Property Management (Rentals/Service fees)</option>
                <option value="Property Valuation">Property Valuation (Appraisals)</option>
                <option value="Feasibility Studies">Feasibility Studies (Market analysis)</option>
                <option value="Project Management">Project Management (Construction supervising)</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="propertyName" className="block body-sm font-medium text-slate-450 uppercase tracking-wider mb-2">Deal / Property Subject</label>
            <input
              id="propertyName"
              required
              value={newPropName}
              onChange={(e) => setNewPropName(e.target.value)}
              placeholder="e.g. Westpoint Block Sale, Nakuru Appraisal"
              className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-indigo-400 font-sans"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="dealValue" className="block body-sm font-medium text-slate-450 uppercase tracking-wider mb-2">Deal Value Base (KES)</label>
              <input
                id="dealValue"
                required
                type="number"
                value={newDealValue}
                onChange={(e) => setNewDealValue(Number(e.target.value))}
                placeholder="e.g. 5000000"
                className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-indigo-400 font-mono"
              />
            </div>

            <div>
              <label htmlFor="commissionRate" className="block body-sm font-medium text-slate-450 uppercase tracking-wider mb-2">Commission Rate (%)</label>
              <div className="relative">
                <input
                  id="commissionRate"
                  required
                  type="number"
                  step="0.1"
                  value={newCommRate}
                  onChange={(e) => setNewCommRate(Number(e.target.value))}
                  className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-indigo-400 font-mono"
                />
                <span className="absolute right-3 top-2.5 text-meta-muted font-sans">
                  Std: {SERVICE_STANDARD_RATES[newCategory]}%
                </span>
              </div>
            </div>
          </div>

          {/* Justification note field if rate deviates */}
          {isRateDeviating && (
            <div className="space-y-2 animate-fade-in">
              <label htmlFor="justification" className="block body-sm font-medium text-rose-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                <IconAlertCircle size={14} />
                Deviation Justification Note Required
              </label>
              <textarea
                id="justification"
                required
                rows={2}
                value={newJustification}
                onChange={(e) => setNewJustification(e.target.value)}
                placeholder="e.g. Client negotiated custom rate tier or agent travel allowances consolidated into commission rate."
                className="w-full rounded-lg border border-rose-200 bg-white p-3 text-sm text-slate-850 outline-none focus:border-rose-400 font-mono leading-relaxed"
              />
            </div>
          )}

          <div className="flex gap-2.5 justify-end pt-3 border-t border-slate-100">
            <Button onClick={() => setShowNewDealModal(false)} variant="secondary" disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="bg-[#151936] text-white">
              {isSubmitting ? "Accruing Deal..." : "Register Deal"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── Modal: Settle WHT ────────────────────────────────────────────── */}
      <Modal open={showPayWhtModal} onClose={() => setShowPayWhtModal(false)} title="File KRA Withholding Tax Return" size="sm">
        <form onSubmit={handlePayWhtSubmit} className="space-y-4 text-sm text-slate-700">
          <div className="rounded-xl bg-[#151936]/5 border border-slate-200/50 p-4 font-sans text-slate-800">
            <p className="body-sm leading-relaxed opacity-95">
              Confirm submission of WHT filings to KRA portal. Requires payment reference from KRA receipt acknowledgment.
            </p>
          </div>

          <div>
            <label htmlFor="payRef" className="block body-sm font-medium text-slate-450 uppercase tracking-wider mb-2">KRA Payment Reference</label>
            <input
              id="payRef"
              required
              value={payRef}
              onChange={(e) => setPayRef(e.target.value)}
              placeholder="e.g. KRA-WHT-202606-1234"
              className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-850 outline-none focus:border-indigo-400 font-mono"
            />
          </div>

          <div className="flex gap-2.5 justify-end pt-3 border-t border-slate-100">
            <Button onClick={() => setShowPayWhtModal(false)} variant="secondary" disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !payRef.trim()} className="bg-[#151936] text-white">
              {isSubmitting ? "Submitting Filing..." : "Confirm Return Filed"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── Modal: Settle Housing Levy ────────────────────────────────────── */}
      <Modal open={showPayLevyModal} onClose={() => setShowPayLevyModal(false)} title="Remit Statutory Housing Levy" size="sm">
        <form onSubmit={handlePayLevySubmit} className="space-y-4 text-sm text-slate-700">
          <div className="rounded-xl bg-[#151936]/5 border border-slate-200/50 p-4 font-sans text-slate-800">
            <p className="body-sm leading-relaxed opacity-95">
              Confirm 3.0% Affordable Housing Levy statutory remittance dispatch. Sourced directly from monthly payroll aggregates.
            </p>
          </div>

          <div>
            <label htmlFor="levyRef" className="block body-sm font-medium text-slate-450 uppercase tracking-wider mb-2">Bank Remittance Ref / receipt</label>
            <input
              id="levyRef"
              required
              value={payRef}
              onChange={(e) => setPayRef(e.target.value)}
              placeholder="e.g. TX-AHL-202606-NCBA"
              className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-850 outline-none focus:border-indigo-400 font-mono"
            />
          </div>

          <div className="flex gap-2.5 justify-end pt-3 border-t border-slate-100">
            <Button onClick={() => setShowPayLevyModal(false)} variant="secondary" disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !payRef.trim()} className="bg-[#151936] text-white">
              {isSubmitting ? "Settle Remittance..." : "Settle Remittance"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
