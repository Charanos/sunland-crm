"use client";

import { useState, useMemo, useEffect } from "react";
import {
  IconSearch,
  IconCoins,
  IconClock,
  IconBuildingCommunity,
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

interface HousingUnit {
  id: string;
  unitCode: string;
  propertyName: string;
  unitNumber: string;
  sizeType: "Studio" | "1-Bedroom" | "2-Bedroom" | "3-Bedroom";
  cost: number;
  status: "Pending" | "Approved" | "Allocated";
  allotteeName?: string;
  programName: string;
  activityLog: string[];
}

interface CitizenAllocation {
  id: string;
  allocationCode: string;
  applicantName: string;
  nationalId: string;
  incomeRange: "Under KES 50k" | "KES 50k - 100k" | "KES 100k+";
  allocatedUnit: string;
  eligibilityScore: number;
  status: "Pending" | "Approved" | "Rejected";
  applicationDate: string;
  notes?: string;
  activityLog: string[];
}

interface LevyRecord {
  id: string;
  levyCode: string;
  period: string;
  grossPayroll: number;
  employeeShare: number;
  employerShare: number;
  totalLevy: number;
  paymentRef?: string;
  paymentDate?: string;
  status: "Draft" | "Remitted";
  bankAccount?: string;
  activityLog: string[];
}

// ─── Initial Mock Data ────────────────────────────────────────────────────────

const INITIAL_UNITS: HousingUnit[] = [
  {
    id: "unit-01",
    unitCode: "AHU-014",
    propertyName: "Kiambu Heights Block A",
    unitNumber: "A-304",
    sizeType: "2-Bedroom",
    cost: 3200000,
    status: "Pending",
    programName: "Kiambu affordable housing scheme",
    activityLog: ["Registered in system by Finance Officer · 2026-06-12", "Sent to CEO approval queue for program validation"]
  },
  {
    id: "unit-02",
    unitCode: "AHU-013",
    propertyName: "Pangani Affordable Phase 1",
    unitNumber: "B-102",
    sizeType: "1-Bedroom",
    cost: 2100000,
    status: "Approved",
    programName: "National Housing Programme",
    activityLog: ["Registered in system by Finance Officer · 2026-05-18", "Approved by CEO Paul Amos · 2026-05-20"]
  },
  {
    id: "unit-03",
    unitCode: "AHU-012",
    propertyName: "Pangani Affordable Phase 1",
    unitNumber: "B-103",
    sizeType: "Studio",
    cost: 1500000,
    status: "Allocated",
    allotteeName: "Grace Wambui",
    programName: "National Housing Programme",
    activityLog: ["Registered in system by Finance Officer · 2026-05-18", "Approved by CEO Paul Amos · 2026-05-20", "Allocated to Grace Wambui after eligibility confirmation · 2026-06-11"]
  }
];

const INITIAL_ALLOCATIONS: CitizenAllocation[] = [
  {
    id: "alloc-01",
    allocationCode: "AHA-008",
    applicantName: "David Ochieng",
    nationalId: "33445566",
    incomeRange: "KES 50k - 100k",
    allocatedUnit: "AHU-014 (Kiambu A-304)",
    eligibilityScore: 88,
    status: "Pending",
    applicationDate: "2026-06-10",
    activityLog: ["Application filed online by David Ochieng · 2026-06-10", "Eligibility score calculated at 88% · 2026-06-11", "Awaiting Finance Officer validation"]
  },
  {
    id: "alloc-02",
    allocationCode: "AHA-007",
    applicantName: "Grace Wambui",
    nationalId: "28475829",
    incomeRange: "Under KES 50k",
    allocatedUnit: "AHU-012 (Pangani B-103)",
    eligibilityScore: 92,
    status: "Approved",
    applicationDate: "2026-06-08",
    activityLog: ["Application filed online by Grace Wambui · 2026-06-08", "Eligibility score calculated at 92% · 2026-06-09", "Approved and unit bound by Finance Head · 2026-06-11"]
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
    bankAccount: "NCBA Operating A/C",
    activityLog: ["Imported from payroll run PAY-2026-05 · 2026-05-28", "Remitted to KRA Affordable Housing Fund · 2026-06-15"]
  }
];

const ROWS_PER_PAGE = 5;

export function AffordableHousingBoard({ tabId = "units" }: { tabId: string }) {
  const { pushToast } = useToast();
  const activeEntityId = useUIStore((state) => state.activeEntityId);
  const [mounted, setMounted] = useState(false);
  const [currentRole, setCurrentRole] = useState<string>("ceo");

  // Search & pagination state
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);

  // Data states
  const [units, setUnits] = useState<HousingUnit[]>(INITIAL_UNITS);
  const [allocations, setAllocations] = useState<CitizenAllocation[]>(INITIAL_ALLOCATIONS);
  const [levies, setLevies] = useState<LevyRecord[]>(INITIAL_LEVIES);

  // Modals & drawers state
  const [selectedUnit, setSelectedUnit] = useState<HousingUnit | null>(null);
  const [selectedAllocation, setSelectedAllocation] = useState<CitizenAllocation | null>(null);
  const [selectedLevy, setSelectedLevy] = useState<LevyRecord | null>(null);
  const [showNewUnitModal, setShowNewUnitModal] = useState(false);
  const [rejectAllocationItem, setRejectAllocationItem] = useState<CitizenAllocation | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State - Register Unit
  const [newPropName, setNewPropName] = useState("Kiambu Heights Block A");
  const [newUnitNum, setNewUnitNum] = useState("A-305");
  const [newSizeType, setNewSizeType] = useState<HousingUnit["sizeType"]>("2-Bedroom");
  const [newCost, setNewCost] = useState(3200000);
  const [newSchemeProgram, setNewSchemeProgram] = useState("Kiambu affordable housing scheme");

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
  const isCEO = currentRole === "ceo";

  // --- Handlers ---
  const handleRegisterUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    await new Promise((resolve) => setTimeout(resolve, 800));

    // Policy check: if the scheme program is new/different, it automatically gates to Awaiting CEO approval
    const isNewProgram = newSchemeProgram === "Mombasa Waterfront Programme" || newSchemeProgram === "Kisumu Palms Estate";
    const initialStatus = isNewProgram ? "Pending" : "Approved";

    const newUnit: HousingUnit = {
      id: `unit-${Date.now()}`,
      unitCode: `AHU-0${units.length + 13}`,
      propertyName: newPropName,
      unitNumber: newUnitNum,
      sizeType: newSizeType,
      cost: newCost,
      status: initialStatus,
      programName: newSchemeProgram,
      activityLog: [
        `Registered by Finance Officer · ${new Date().toISOString().split("T")[0]}`,
        isNewProgram
          ? "Sent to CEO approval queue for program participation validation"
          : "Auto-approved under active National Housing framework"
      ]
    };

    setUnits([newUnit, ...units]);
    setShowNewUnitModal(false);
    setIsSubmitting(false);

    pushToast({
      tone: isNewProgram ? "warning" : "success",
      title: isNewProgram ? "CEO Approval Required" : "Unit Registered",
      body: isNewProgram
        ? `Unit ${newUnit.unitCode} logged. Mombasa/Kisumu program participation must be authorized by CEO.`
        : `Unit ${newUnit.unitCode} has been successfully registered under active framework.`
    });
  };

  const handleApproveCEOUnit = (unit: HousingUnit) => {
    setUnits((prev) =>
      prev.map((u) => {
        if (u.id === unit.id) {
          return {
            ...u,
            status: "Approved",
            activityLog: [`CEO Program participation approved by Paul Amos · ${new Date().toISOString().split("T")[0]}`, ...u.activityLog]
          };
        }
        return u;
      })
    );
    setSelectedUnit(null);
    pushToast({
      tone: "success",
      title: "Participation Approved",
      body: `Affordable Housing scheme program verified for unit ${unit.unitCode}.`
    });
  };

  const handleApproveAllocation = (alloc: CitizenAllocation) => {
    // 1. Update allocation status
    setAllocations((prev) =>
      prev.map((a) => {
        if (a.id === alloc.id) {
          return {
            ...a,
            status: "Approved",
            activityLog: [`Eligibility confirmed & unit allocated by Finance · ${new Date().toISOString().split("T")[0]}`, ...a.activityLog]
          };
        }
        return a;
      })
    );

    // 2. Mark the corresponding unit as allocated
    const unitCodeMatch = alloc.allocatedUnit.split(" ")[0];
    setUnits((prev) =>
      prev.map((u) => {
        if (u.unitCode === unitCodeMatch) {
          return {
            ...u,
            status: "Allocated",
            allotteeName: alloc.applicantName,
            activityLog: [`Allocated to ${alloc.applicantName} under ref ${alloc.allocationCode} · ${new Date().toISOString().split("T")[0]}`, ...u.activityLog]
          };
        }
        return u;
      })
    );

    setSelectedAllocation(null);
    pushToast({
      tone: "success",
      title: "Allocation Confirmed",
      body: `Citizen application ${alloc.allocationCode} approved. Unit bound successfully.`
    });
  };

  const handleRejectAllocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectAllocationItem || !rejectReason.trim()) return;

    setIsSubmitting(true);
    await new Promise((resolve) => setTimeout(resolve, 500));

    setAllocations((prev) =>
      prev.map((a) => {
        if (a.id === rejectAllocationItem.id) {
          return {
            ...a,
            status: "Rejected",
            notes: rejectReason,
            activityLog: [`Application rejected. Reason: ${rejectReason} · ${new Date().toISOString().split("T")[0]}`, ...a.activityLog]
          };
        }
        return a;
      })
    );

    setRejectAllocationItem(null);
    setRejectReason("");
    setIsSubmitting(false);

    pushToast({
      tone: "info",
      title: "Allocation Rejected",
      body: "Applicant has been marked ineligible and unit hold released."
    });
  };

  // --- Computations ---
  const aggregates = useMemo(() => {
    const totalUnits = units.length;
    const allocatedCount = units.filter((u) => u.status === "Allocated").length;
    const pendingCEO = units.filter((u) => u.status === "Pending").length;
    const MTDLevy = levies.reduce((sum, l) => sum + l.totalLevy, 0);

    return {
      totalUnits,
      allocatedCount,
      pendingCEO,
      MTDLevy
    };
  }, [units, levies]);

  const filteredRows = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (tabId === "units") {
      return units.filter(
        (u) =>
          u.unitCode.toLowerCase().includes(q) ||
          u.propertyName.toLowerCase().includes(q) ||
          u.programName.toLowerCase().includes(q) ||
          u.status.toLowerCase().includes(q)
      );
    } else if (tabId === "allocations") {
      return allocations.filter(
        (a) =>
          a.applicantName.toLowerCase().includes(q) ||
          a.allocationCode.toLowerCase().includes(q) ||
          a.nationalId.includes(q) ||
          a.status.toLowerCase().includes(q)
      );
    } else {
      return levies.filter((l) => l.levyCode.toLowerCase().includes(q) || l.period.toLowerCase().includes(q) || l.status.toLowerCase().includes(q));
    }
  }, [units, allocations, levies, tabId, searchQuery]);

  const paginatedRows = useMemo(() => {
    return filteredRows.slice((page - 1) * ROWS_PER_PAGE, page * ROWS_PER_PAGE);
  }, [filteredRows, page]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / ROWS_PER_PAGE));

  if (!mounted) return <div className="h-screen w-full skeleton-shimmer bg-slate-50" />;

  return (
    <div className="mx-auto flex max-w-[98rem] flex-col gap-4 animate-fade-in pb-12">
      <BoardHeader
        title="Affordable Housing Control"
        description="Verify public housing scheme allocations, register eligible units, and monitor statutory Housing Levy compliance."
      />

      <FinanceModuleNav />

      {/* ── Blueprint Hero Section ────────────────────────────────────────── */}
      <section className="grid grid-cols-1 xl:grid-cols-[1.15fr_0.85fr] gap-4">
        <div className="relative min-h-[255px] overflow-hidden rounded-2xl border border-white/[0.06] bg-gradient-to-br from-[#0b1f1a] via-[#102a24] to-[#142d4c] p-8 text-white shadow-2xl">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.15),transparent_60%)]" />
          <div className="absolute -top-24 -left-24 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />
          <div className="absolute -bottom-24 -right-24 h-64 w-64 rounded-full bg-emerald-500/5 blur-3xl" />

          <div className="relative z-10 flex h-full flex-col justify-between gap-8">
            <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-8">
              <div className="max-w-xl space-y-5">
                <div className="flex items-center gap-3">
                  <Badge tone="primary" className="bg-emerald-500/20 text-emerald-200 border-emerald-500/30 px-3 py-1 shadow-sm backdrop-blur-md">
                    Sunland Commercial
                  </Badge>
                  <span className="text-[11.5px] font-normal tracking-widest uppercase text-slate-400/80">Infrastructural Schemes</span>
                </div>
                <div>
                  <h2 className="title-serif text-[38px] font-normal leading-tight tracking-tight text-white mb-3">
                    Statutory Scheme Registry
                  </h2>
                  <p className="text-[13.5px] leading-relaxed text-slate-300/80 font-light max-w-lg">
                    Monitor state-supported affordable housing project units, verify low-income applicant eligibility scoring, and track the 3.0% combined employer/employee levy returns.
                  </p>
                </div>

                <div className="pt-2 flex items-center gap-4">
                  <div className="flex -space-x-2.5">
                    <div className="size-8 rounded-full border-2 border-[#0b1f1a] bg-emerald-600 flex items-center justify-center text-[10px] font-medium text-white shadow-md transition-all hover:scale-110 cursor-pointer" title="CEO Paul Amos">PA</div>
                    <div className="size-8 rounded-full border-2 border-[#0b1f1a] bg-teal-800 flex items-center justify-center text-[10px] font-medium text-white shadow-md transition-all hover:scale-110 cursor-pointer" title=" Dennis Munge">DM</div>
                    <div className="flex size-8 items-center justify-center rounded-full border-2 border-[#0b1f1a] bg-emerald-500/20 text-[10px] font-medium text-emerald-200 backdrop-blur-md">
                      +1
                    </div>
                  </div>
                  <span className="text-[12px] font-normal text-slate-400">Compliance Trustees</span>
                </div>
              </div>

              {/* Aggregates widget */}
              <div className="flex-1 w-full lg:max-w-md shrink-0 h-full">
                <div className="relative h-full flex flex-col justify-between overflow-hidden rounded-[20px] border border-white/10 bg-white/5 backdrop-blur-2xl p-5 shadow-2xl select-none group">
                  <div className="absolute inset-0 opacity-[0.06] mix-blend-overlay bg-[url('https://images.unsplash.com/photo-1590486803833-1c5dc8ddd4c8?q=80&w=2500')] bg-cover bg-center" />
                  <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl -mr-20 -mt-20" />

                  <div className="relative z-10 flex flex-col justify-between h-full gap-6">
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-[10px] font-normal uppercase tracking-widest text-slate-400">Levy Contributions MTD</p>
                        <IconCoins size={18} className="text-emerald-450" />
                      </div>
                      <div className="flex items-baseline gap-2 mb-2">
                        <span className="font-mono text-[42px] font-normal tracking-tight text-emerald-300 drop-shadow-[0_0_12px_rgba(16,185,129,0.3)]">
                          {formatMoney(aggregates.MTDLevy)}
                        </span>
                        <span className="text-[12px] text-slate-400 font-normal uppercase tracking-widest">KES</span>
                      </div>
                    </div>

                    <div>
                      <div className="h-px w-full bg-gradient-to-r from-white/15 via-white/5 to-transparent mb-4" />
                      <div className="grid grid-cols-3 gap-2.5 w-full">
                        <div className="flex flex-col items-center bg-white/[0.02] border border-white/[0.04] p-3 rounded-[14px]">
                          <p className="text-[10px] font-normal uppercase tracking-widest text-slate-400 mb-1.5">Total Units</p>
                          <p className="font-mono text-[20px] font-medium text-white leading-none">{aggregates.totalUnits}</p>
                        </div>
                        <div className="flex flex-col items-center bg-white/[0.02] border border-white/[0.04] p-3 rounded-[14px]">
                          <p className="text-[10px] font-normal uppercase tracking-widest text-slate-400 mb-1.5">Allocated</p>
                          <p className="font-mono text-[20px] font-medium text-white leading-none">{aggregates.allocatedCount}</p>
                        </div>
                        <div className="flex flex-col items-center bg-white/[0.02] border border-white/[0.04] p-3 rounded-[14px]">
                          <p className="text-[10px] font-normal uppercase tracking-widest text-slate-400 mb-1.5">CEO holds</p>
                          <p className="font-mono text-[20px] font-medium text-amber-400 leading-none">{aggregates.pendingCEO}</p>
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
        <BoardPanel className="p-5 flex flex-col justify-between h-[135px] relative overflow-hidden group transition-all duration-300 hover:shadow-md hover:-translate-y-1 hover:border-emerald-200 bg-gradient-to-b from-white to-emerald-50/10">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity translate-x-4 -translate-y-4">
            <IconBuildingCommunity size={100} stroke={1} />
          </div>
          <div className="flex items-center gap-3 relative z-10">
            <div className="size-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
              <IconBuildingCommunity size={16} stroke={2.5} />
            </div>
            <span className="text-xs font-medium text-slate-500 uppercase tracking-widest">Registered Units</span>
          </div>
          <div className="flex flex-col mt-auto relative z-10">
            <span className="text-[28px] font-mono font-normal tracking-tight text-[#151936]">
              {aggregates.totalUnits} Units
            </span>
            <span className="text-[13px] font-medium text-slate-500 mt-1">In active schemes</span>
          </div>
        </BoardPanel>

        <BoardPanel className="p-5 flex flex-col justify-between h-[135px] relative overflow-hidden group transition-all duration-300 hover:shadow-md hover:-translate-y-1 hover:border-indigo-200 bg-gradient-to-b from-white to-indigo-50/10">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity translate-x-4 -translate-y-4">
            <IconUser size={100} stroke={1} />
          </div>
          <div className="flex items-center gap-3 relative z-10">
            <div className="size-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
              <IconUser size={16} stroke={2.5} />
            </div>
            <span className="text-xs font-medium text-slate-500 uppercase tracking-widest font-sans">Active Allocations</span>
          </div>
          <div className="flex flex-col mt-auto relative z-10">
            <span className="text-[28px] font-mono font-normal tracking-tight text-[#151936]">
              {aggregates.allocatedCount} Citizens
            </span>
            <span className="text-[13px] font-medium text-slate-500 mt-1">Units occupied/allocated</span>
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
            <span className="text-xs font-medium text-slate-500 uppercase tracking-widest">CEO Gate Holds</span>
          </div>
          <div className="flex flex-col mt-auto relative z-10">
            <span className="text-[28px] font-mono font-normal tracking-tight text-amber-700">
              {aggregates.pendingCEO} Holds
            </span>
            <span className="text-[13px] font-medium text-slate-500 mt-1">Awaiting program validation</span>
          </div>
        </BoardPanel>

        <BoardPanel className="p-5 flex flex-col justify-between h-[135px] relative overflow-hidden group transition-all duration-300 hover:shadow-md hover:-translate-y-1 hover:border-teal-200 bg-gradient-to-b from-white to-teal-50/10">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity translate-x-4 -translate-y-4">
            <IconCoins size={100} stroke={1} />
          </div>
          <div className="flex items-center gap-3 relative z-10">
            <div className="size-8 rounded-xl bg-teal-50 text-teal-650 flex items-center justify-center border border-teal-100">
              <IconCoins size={16} stroke={2.5} />
            </div>
            <span className="text-xs font-medium text-slate-500 uppercase tracking-widest">Levy Accrued MTD</span>
          </div>
          <div className="flex flex-col mt-auto relative z-10">
            <span className="text-[28px] font-mono font-normal tracking-tight text-teal-700">
              {formatMoney(levies.find((l) => l.period === "June 2026")?.totalLevy ?? 0)}
            </span>
            <span className="text-[13px] font-medium text-slate-500 mt-1">Accrued 3.0% from payroll</span>
          </div>
        </BoardPanel>
      </section>

      {/* ── Grid Board Section ────────────────────────────────────────────── */}
      <BoardPanel className="mt-2">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4 mb-4">
          <div>
            <h3 className="title-serif text-[20px] font-normal text-slate-900">
              {tabId === "units" ? "Scheme Assets Ledger" : tabId === "allocations" ? "Applicant Eligibility Control" : "Affordable Housing Levy Ledger"}
            </h3>
            <p className="text-[12.5px] text-slate-450 mt-1 font-medium">
              {tabId === "units"
                ? "Register and monitor unit portfolios in government schemes."
                : tabId === "allocations"
                ? "Manage allocations, score criteria, and process citizen claims."
                : "View payroll-sourced compliance levy details."}
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
            {tabId === "units" && (
              <Button size="sm" onClick={() => setShowNewUnitModal(true)}>
                <IconPlus size={14} />
                Register Unit
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
                    {tabId === "units" && (
                      <>
                        <th className="px-3 py-2.5">Code</th>
                        <th className="px-3 py-2.5">Site / Property</th>
                        <th className="px-3 py-2.5">Unit No.</th>
                        <th className="px-3 py-2.5">Size/Type</th>
                        <th className="px-3 py-2.5 text-right">Cost</th>
                        <th className="px-3 py-2.5">Status</th>
                      </>
                    )}
                    {tabId === "allocations" && (
                      <>
                        <th className="px-3 py-2.5">Allocation ID</th>
                        <th className="px-3 py-2.5">Applicant</th>
                        <th className="px-3 py-2.5">ID Number</th>
                        <th className="px-3 py-2.5">Allocated Unit</th>
                        <th className="px-3 py-2.5 text-right">Eligibility Score</th>
                        <th className="px-3 py-2.5">Status</th>
                      </>
                    )}
                    {tabId === "levy" && (
                      <>
                        <th className="px-3 py-2.5">Code</th>
                        <th className="px-3 py-2.5">Filing Period</th>
                        <th className="px-3 py-2.5 text-right">Gross Payroll</th>
                        <th className="px-3 py-2.5 text-right">Employer (1.5%)</th>
                        <th className="px-3 py-2.5 text-right">Employee (1.5%)</th>
                        <th className="px-3 py-2.5 text-right">Total Levy (3%)</th>
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
                        if (tabId === "units") setSelectedUnit(row as HousingUnit);
                        else if (tabId === "allocations") setSelectedAllocation(row as CitizenAllocation);
                        else setSelectedLevy(row as LevyRecord);
                      }}
                      className="transition-colors hover:bg-slate-50/80 cursor-pointer"
                    >
                      {tabId === "units" && (
                        <>
                          <td className="px-3 py-3 font-mono text-[12.5px] font-medium text-slate-900">{(row as HousingUnit).unitCode}</td>
                          <td className="px-3 py-3 text-slate-800 font-medium">{(row as HousingUnit).propertyName}</td>
                          <td className="px-3 py-3 font-mono text-[12.5px] text-slate-550">{(row as HousingUnit).unitNumber}</td>
                          <td className="px-3 py-3 text-slate-500">{(row as HousingUnit).sizeType}</td>
                          <td className="px-3 py-3 text-right font-mono text-[12.5px] font-medium text-slate-900">
                            {formatMoney((row as HousingUnit).cost)}
                          </td>
                          <td className="px-3 py-3">
                            <Badge
                              tone={
                                (row as HousingUnit).status === "Allocated"
                                  ? "success"
                                  : (row as HousingUnit).status === "Pending"
                                  ? "warning"
                                  : "primary"
                              }
                            >
                              {(row as HousingUnit).status}
                            </Badge>
                          </td>
                        </>
                      )}
                      {tabId === "allocations" && (
                        <>
                          <td className="px-3 py-3 font-mono text-[12.5px] font-medium text-slate-900 font-mono">
                            {(row as CitizenAllocation).allocationCode}
                          </td>
                          <td className="px-3 py-3 text-slate-800 font-medium">{(row as CitizenAllocation).applicantName}</td>
                          <td className="px-3 py-3 font-mono text-[12.5px] text-slate-500">{(row as CitizenAllocation).nationalId}</td>
                          <td className="px-3 py-3 text-slate-600 font-mono">{(row as CitizenAllocation).allocatedUnit}</td>
                          <td className="px-3 py-3 text-right font-mono text-[12.5px] font-medium text-slate-900">
                            {(row as CitizenAllocation).eligibilityScore}%
                          </td>
                          <td className="px-3 py-3">
                            <Badge
                              tone={
                                (row as CitizenAllocation).status === "Approved"
                                  ? "success"
                                  : (row as CitizenAllocation).status === "Pending"
                                  ? "warning"
                                  : "risk"
                              }
                            >
                              {(row as CitizenAllocation).status}
                            </Badge>
                          </td>
                        </>
                      )}
                      {tabId === "levy" && (
                        <>
                          <td className="px-3 py-3 font-mono text-[12.5px] font-medium text-slate-900 font-mono">
                            {(row as LevyRecord).levyCode}
                          </td>
                          <td className="px-3 py-3 text-slate-800 font-medium">{(row as LevyRecord).period}</td>
                          <td className="px-3 py-3 text-right font-mono text-[12.5px] text-slate-500">
                            {formatMoney((row as LevyRecord).grossPayroll)}
                          </td>
                          <td className="px-3 py-3 text-right font-mono text-[12.5px] text-slate-500">
                            {formatMoney((row as LevyRecord).employerShare)}
                          </td>
                          <td className="px-3 py-3 text-right font-mono text-[12.5px] text-slate-500">
                            {formatMoney((row as LevyRecord).employeeShare)}
                          </td>
                          <td className="px-3 py-3 text-right font-mono text-[12.5px] font-medium text-[#16623b]">
                            {formatMoney((row as LevyRecord).totalLevy)}
                          </td>
                          <td className="px-3 py-3">
                            <Badge
                              tone={(row as LevyRecord).status === "Remitted" ? "success" : "neutral"}
                            >
                              {(row as LevyRecord).status}
                            </Badge>
                          </td>
                        </>
                      )}
                      <td className="px-3 py-3 text-right font-mono">
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
              <h4 className="text-sm font-medium text-slate-800">No housing records found</h4>
              <p className="text-[12.5px] text-slate-455 leading-relaxed font-sans">
                Adjust the active search term or filter rules to locate specific scheme records.
              </p>
            </div>
          </div>
        )}
      </BoardPanel>

      {/* ── Drawer: Housing Unit details ──────────────────────────────────── */}
      <Drawer
        open={Boolean(selectedUnit)}
        onClose={() => setSelectedUnit(null)}
        title={`Housing Ledger: ${selectedUnit?.unitCode ?? ""}`}
        width="34rem"
        footer={
          selectedUnit && (
            <div className="flex gap-2 w-full">
              <Button onClick={() => setSelectedUnit(null)} variant="secondary" className="flex-1">
                Close Panel
              </Button>
              {selectedUnit.status === "Pending" && isCEO && (
                <Button onClick={() => handleApproveCEOUnit(selectedUnit)} className="flex-1 bg-[#151936] text-white">
                  Approve Program Participation
                </Button>
              )}
            </div>
          )
        }
      >
        {selectedUnit && (
          <div className="space-y-6 text-slate-700 text-xs">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="size-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-500 border border-slate-100/50">
                <IconBuildingCommunity size={20} />
              </div>
              <div>
                <h4 className="text-[14px] font-medium text-slate-900 leading-snug">{selectedUnit.propertyName}</h4>
                <p className="text-[11.5px] text-slate-400 mt-0.5">{selectedUnit.unitCode} · Status: {selectedUnit.status}</p>
              </div>
            </div>

            <div className="space-y-5">
              {/* Simulated Registration Certificate */}
              <div className="relative border border-[#0f172a]/15 bg-gradient-to-r from-emerald-50/70 via-slate-50/50 to-emerald-50/50 p-6 rounded-2xl flex flex-col justify-between overflow-hidden shadow-[inset_0_1px_3px_rgba(255,255,255,0.8),0_4px_12px_rgba(0,0,0,0.02)] select-none font-mono">
                <div className="absolute right-8 top-5 select-none pointer-events-none opacity-[0.1] origin-center -rotate-12 border-2 border-dashed border-emerald-600 px-3 py-1.5 text-[16px] font-black tracking-widest rounded text-emerald-600">
                  {selectedUnit.status.toUpperCase()}
                </div>

                <div className="flex justify-between items-start text-[10px] text-slate-450 border-b border-slate-200/50 pb-2">
                  <span className="font-sans font-medium text-slate-600">SUNLAND REAL ESTATE LEDGER CERTIFICATE</span>
                  <span>REF: {selectedUnit.unitCode}</span>
                </div>

                <div className="my-3">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider font-mono font-medium">Certified Valuation Cost</p>
                  <p className="font-mono text-[32px] font-medium text-slate-900 leading-none mt-1">
                    {formatMoney(selectedUnit.cost)}
                  </p>
                </div>

                <div className="space-y-2 border-t border-slate-200/50 pt-3 text-[11px] text-slate-550 font-sans">
                  <div className="flex justify-between">
                    <span>Program Scheme</span>
                    <span className="font-mono font-medium text-slate-700">{selectedUnit.programName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Unit Number / Door</span>
                    <span className="font-mono font-medium text-slate-750">{selectedUnit.unitNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Dimensions / Type</span>
                    <span className="font-mono font-medium text-slate-700">{selectedUnit.sizeType}</span>
                  </div>
                  {selectedUnit.allotteeName && (
                    <div className="flex justify-between">
                      <span>Bound Allottee</span>
                      <span className="font-mono font-medium text-indigo-700">{selectedUnit.allotteeName}</span>
                    </div>
                  )}
                </div>
              </div>

              {selectedUnit.status === "Pending" && (
                <div className="rounded-xl border border-amber-250 bg-amber-50/40 p-4 text-[12px] leading-relaxed text-amber-800 flex gap-2.5 items-start font-sans">
                  <IconShieldCheck size={16} className="shrink-0 mt-0.5 text-amber-600" />
                  <div>
                    <span className="font-medium text-amber-900">CEO Approval Lock Active</span>
                    <p className="mt-0.5 text-amber-700">
                      This unit resides under a new program scheme block. The ERP policy gates this unit's ledger tracking until confirmed by the CEO.
                    </p>
                  </div>
                </div>
              )}

              {/* Process timeline log */}
              <div className="pt-2 border-t border-slate-100">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">Filing Activity Logs</span>
                <div className="mt-2 space-y-2">
                  {selectedUnit.activityLog.map((log, idx) => (
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

      {/* ── Drawer: Allocation Application details ────────────────────────── */}
      <Drawer
        open={Boolean(selectedAllocation)}
        onClose={() => setSelectedAllocation(null)}
        title="Citizen Scheme Application"
        width="34rem"
        footer={
          selectedAllocation && (
            <div className="flex gap-2 w-full">
              <Button onClick={() => setSelectedAllocation(null)} variant="secondary" className="flex-1">
                Close Panel
              </Button>
              {selectedAllocation.status === "Pending" && (
                <>
                  <Button
                    onClick={() => {
                      setRejectAllocationItem(selectedAllocation);
                      setSelectedAllocation(null);
                    }}
                    variant="danger"
                    className="flex-1 text-white border-red-500 bg-red-600 hover:bg-red-700"
                  >
                    Reject Application
                  </Button>
                  <Button onClick={() => handleApproveAllocation(selectedAllocation)} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white">
                    Assign Unit
                  </Button>
                </>
              )}
            </div>
          )
        }
      >
        {selectedAllocation && (
          <div className="space-y-6 text-slate-700 text-xs">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="size-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-500 border border-slate-100/50">
                <IconUser size={20} />
              </div>
              <div>
                <h4 className="text-[14px] font-medium text-slate-900 leading-snug">{selectedAllocation.applicantName}</h4>
                <p className="text-[11.5px] text-slate-400 mt-0.5">{selectedAllocation.allocationCode} · Date: {selectedAllocation.applicationDate}</p>
              </div>
            </div>

            <div className="space-y-5">
              {/* Simulated Eligibility Card */}
              <div className="relative border border-[#0f172a]/15 bg-gradient-to-r from-teal-50/50 via-slate-50/50 to-indigo-50/50 p-6 rounded-2xl flex flex-col justify-between overflow-hidden shadow-[inset_0_1px_3px_rgba(255,255,255,0.8),0_4px_12px_rgba(0,0,0,0.02)] select-none font-mono">
                <div className="absolute right-8 top-5 select-none pointer-events-none opacity-[0.1] origin-center -rotate-12 border-2 border-dashed border-current px-3 py-1.5 text-[16px] font-black tracking-widest rounded">
                  {selectedAllocation.status.toUpperCase()}
                </div>

                <div className="flex justify-between items-start text-[10px] text-slate-450 border-b border-slate-200/50 pb-2 font-sans">
                  <span className="font-medium text-slate-650">CITIZEN SCHEME ELIGIBILITY VERIFICATION</span>
                  <span className="font-mono">SCORE: {selectedAllocation.eligibilityScore}%</span>
                </div>

                <div className="my-3 font-sans">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider font-mono">Applicant Profile</p>
                  <p className="text-[18px] font-medium text-slate-800 leading-snug mt-1">
                    {selectedAllocation.applicantName}
                  </p>
                  <p className="text-[12.5px] text-slate-500 font-mono mt-0.5">National ID: {selectedAllocation.nationalId}</p>
                </div>

                <div className="space-y-2 border-t border-slate-200/50 pt-3 text-[11px] text-slate-500 font-sans">
                  <div className="flex justify-between">
                    <span>Income Threshold Level</span>
                    <span className="font-mono font-medium text-slate-750">{selectedAllocation.incomeRange}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Requested Allocation</span>
                    <span className="font-mono font-medium text-slate-800">{selectedAllocation.allocatedUnit}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Target Verification Score</span>
                    <span className="font-mono text-emerald-650 font-medium">{selectedAllocation.eligibilityScore} / 100</span>
                  </div>
                  {selectedAllocation.notes && (
                    <div className="flex flex-col gap-1 border-t border-slate-100 pt-2 mt-1">
                      <span className="text-[10px] text-slate-400 uppercase">Rejection Justification Notes</span>
                      <p className="text-rose-700 bg-rose-50/50 p-2.5 rounded-lg font-mono text-[11.5px] leading-relaxed">{selectedAllocation.notes}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Checklist verification */}
              <div className="space-y-2 font-sans">
                <span className="text-[10px] text-slate-450 uppercase tracking-wider font-medium">Program Eligibility Criteria</span>
                <div className="rounded-xl border border-slate-100 p-4 space-y-2.5 bg-slate-50/20">
                  <div className="flex items-center gap-2 text-[12px] text-slate-650">
                    <IconCheck size={16} className="text-emerald-500 shrink-0" />
                    <span>Verified citizen national ID and registry record</span>
                  </div>
                  <div className="flex items-center gap-2 text-[12px] text-slate-650">
                    <IconCheck size={16} className="text-emerald-500 shrink-0" />
                    <span>Income verified within low-income limits</span>
                  </div>
                  <div className="flex items-center gap-2 text-[12px] text-slate-650">
                    <IconCheck size={16} className="text-emerald-500 shrink-0" />
                    <span>No active prior affordable housing allotment recorded</span>
                  </div>
                </div>
              </div>

              {/* Process timeline log */}
              <div className="pt-2 border-t border-slate-100">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">Audit History Logs</span>
                <div className="mt-2 space-y-2">
                  {selectedAllocation.activityLog.map((log, idx) => (
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

      {/* ── Drawer: Levy Record Details ────────────────────────────────────── */}
      <Drawer
        open={Boolean(selectedLevy)}
        onClose={() => setSelectedLevy(null)}
        title="Housing Levy Statement"
        width="34rem"
        footer={
          selectedLevy && (
            <div className="flex gap-2 w-full">
              <Button onClick={() => setSelectedLevy(null)} variant="secondary" className="flex-1">
                Close Panel
              </Button>
            </div>
          )
        }
      >
        {selectedLevy && (
          <div className="space-y-6 text-slate-700 text-xs">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="size-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-550 border border-slate-100/50">
                <IconReceipt2 size={20} />
              </div>
              <div>
                <h4 className="text-[14px] font-medium text-slate-900 leading-snug">Housing Levy Statement</h4>
                <p className="text-[11.5px] text-slate-400 mt-0.5">{selectedLevy.levyCode} · Filing Period: {selectedLevy.period}</p>
              </div>
            </div>

            <div className="space-y-5">
              {/* Simulated Levy Statement */}
              <div className="relative border border-[#0f172a]/15 bg-gradient-to-r from-emerald-50/50 via-slate-50/50 to-indigo-50/50 p-6 rounded-2xl flex flex-col justify-between overflow-hidden shadow-[inset_0_1px_3px_rgba(255,255,255,0.8),0_4px_12px_rgba(0,0,0,0.02)] select-none font-mono">
                <div className="absolute right-8 top-5 select-none pointer-events-none opacity-[0.1] origin-center -rotate-12 border-2 border-dashed border-current px-3 py-1.5 text-[16px] font-black tracking-widest rounded">
                  {selectedLevy.status.toUpperCase()}
                </div>

                <div className="flex justify-between items-start text-[10px] text-slate-450 border-b border-slate-200/50 pb-2">
                  <span className="font-sans font-medium text-slate-650">SUNLAND HOUSING LEVY RETURN (FORM KRA-AHL)</span>
                  <span>REF: {selectedLevy.levyCode}</span>
                </div>

                <div className="my-3">
                  <p className="text-[10px] text-slate-450 uppercase tracking-wider font-mono">Accrued 3.0% Contribution</p>
                  <p className="font-mono text-[32px] font-medium text-slate-900 leading-none mt-1">
                    {formatMoney(selectedLevy.totalLevy)}
                  </p>
                </div>

                <div className="space-y-2 border-t border-slate-200/50 pt-3 text-[11px] text-slate-550 font-sans">
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

              {/* Process timeline log */}
              <div className="pt-2 border-t border-slate-100">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">Filing Activity Logs</span>
                <div className="mt-2 space-y-2">
                  {selectedLevy.activityLog.map((log, idx) => (
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

      {/* ── Modal: Register Housing Unit ──────────────────────────────────── */}
      <Modal open={showNewUnitModal} onClose={() => setShowNewUnitModal(false)} title="Register Scheme Unit" size="md">
        <form onSubmit={handleRegisterUnit} className="space-y-5 text-xs text-slate-750">
          <div className="rounded-xl bg-emerald-50/50 border border-emerald-100/50 p-4 font-sans text-emerald-800">
            <h4 className="text-[13px] font-medium text-emerald-900 mb-1 flex items-center gap-1.5">
              <IconShieldCheck size={16} className="text-emerald-600" />
              Statutory Registry Verification
            </h4>
            <p className="text-[12px] leading-relaxed opacity-95">
              Housing asset registration registers unit codes under active schemes. Participation under new program blocks triggers a CEO approval gate.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="schemeProgram" className="block text-[11px] font-medium text-slate-450 uppercase tracking-wider mb-2">Housing Scheme Program</label>
              <select
                id="schemeProgram"
                value={newSchemeProgram}
                onChange={(e) => setNewSchemeProgram(e.target.value)}
                className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-[12.5px] text-slate-800 outline-none focus:border-indigo-400 font-sans"
              >
                <option value="Kiambu affordable housing scheme">Kiambu Scheme (Active)</option>
                <option value="National Housing Programme">National Programme (Active)</option>
                <option value="Mombasa Waterfront Programme">Mombasa Programme (New - CEO Gated)</option>
                <option value="Kisumu Palms Estate">Kisumu Palms Scheme (New - CEO Gated)</option>
              </select>
            </div>
            <div>
              <label htmlFor="propName" className="block text-[11px] font-medium text-slate-450 uppercase tracking-wider mb-2">Property Name / Site</label>
              <input
                id="propName"
                required
                value={newPropName}
                onChange={(e) => setNewPropName(e.target.value)}
                placeholder="e.g. Pangani Phase 2"
                className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-[12.5px] text-slate-800 outline-none focus:border-indigo-400 font-sans"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label htmlFor="unitNum" className="block text-[11px] font-medium text-slate-450 uppercase tracking-wider mb-2">Unit Door Code</label>
              <input
                id="unitNum"
                required
                value={newUnitNum}
                onChange={(e) => setNewUnitNum(e.target.value)}
                placeholder="e.g. B-205"
                className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-[12.5px] text-slate-800 outline-none focus:border-indigo-400 font-mono"
              />
            </div>
            <div>
              <label htmlFor="sizeType" className="block text-[11px] font-medium text-slate-455 uppercase tracking-wider mb-2">Room Layout</label>
              <select
                id="sizeType"
                value={newSizeType}
                onChange={(e) => setNewSizeType(e.target.value as HousingUnit["sizeType"])}
                className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-[12.5px] text-slate-800 outline-none focus:border-indigo-400 font-sans"
              >
                <option value="Studio">Studio</option>
                <option value="1-Bedroom">1-Bedroom</option>
                <option value="2-Bedroom">2-Bedroom</option>
                <option value="3-Bedroom">3-Bedroom</option>
              </select>
            </div>
            <div>
              <label htmlFor="costVal" className="block text-[11px] font-medium text-slate-450 uppercase tracking-wider mb-2">Valuation Cost (KES)</label>
              <input
                id="costVal"
                required
                type="number"
                value={newCost}
                onChange={(e) => setNewCost(Number(e.target.value))}
                placeholder="e.g. 2500000"
                className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-[12.5px] text-slate-800 outline-none focus:border-indigo-400 font-mono"
              />
            </div>
          </div>

          <div className="flex gap-2.5 justify-end pt-3 border-t border-slate-100">
            <Button onClick={() => setShowNewUnitModal(false)} variant="secondary" disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="bg-[#151936] text-white">
              {isSubmitting ? "Filing Unit Details..." : "Register Unit"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── Modal: Rejection Reason ──────────────────────────────────────── */}
      <Modal open={Boolean(rejectAllocationItem)} onClose={() => setRejectAllocationItem(null)} title="Allocation Rejection Justification" size="md">
        <form onSubmit={handleRejectAllocation} className="space-y-4 text-xs text-slate-700">
          <div className="rounded-xl bg-red-50/50 border border-red-100/50 p-4 font-sans text-red-800">
            <h4 className="text-[13px] font-medium text-red-900 mb-1">Mandatory Rejection Rule</h4>
            <p className="text-[12px] opacity-95">
              The statutory framework prohibits rejection of citizen scheme housing applications without providing a verified justification note, which is committed to the public audits ledger.
            </p>
          </div>

          <div>
            <label htmlFor="rejReason" className="block text-[11px] font-medium text-slate-450 uppercase tracking-wider mb-2">Rejection Reason Notes</label>
            <textarea
              id="rejReason"
              required
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g., Applicant income exceeds statutory program limits based on verified pay slip verification audits."
              className="w-full rounded-lg border border-slate-200 bg-white p-3 text-[12.5px] text-slate-800 outline-none focus:border-indigo-400 font-mono leading-relaxed"
            />
          </div>

          <div className="flex gap-2.5 justify-end pt-3 border-t border-slate-100">
            <Button onClick={() => setRejectAllocationItem(null)} variant="secondary" disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !rejectReason.trim()} className="bg-red-650 hover:bg-red-750 text-white border-red-500 bg-red-600">
              {isSubmitting ? "Recording Rejection..." : "Confirm Rejection"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
