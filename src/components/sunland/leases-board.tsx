"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  IconAlertTriangle,
  IconCalendar,
  IconCheck,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconShield,
  IconBuildingCommunity,
  IconX,
  IconStarFilled,
  IconChevronLeft,
  IconChevronRight,
  IconEye,
  IconTrendingUp,
  IconFilter,
  IconFileCertificate,
  IconDotsVertical,
  IconUserCircle,
  IconMessageCircle,
  IconWalletOff,
  IconTrash,
  IconWallet,
} from "@tabler/icons-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Badge,
  BoardHeader,
  Button,
  PaginationControls,
  Avatar,
} from "@/components/ui/erp-primitives";
import { LeaseFormModal, type LeaseEditTarget } from "./lease-form-modal";
import { LeaseRenewModal, type LeaseRenewTarget } from "./lease-renew-modal";
import { LeaseDetailDrawer } from "./lease-detail-drawer";
import { PortfolioHubNav } from "./portfolio-hub-nav";
import { MandateFormModal } from "./mandate-form-modal";
import { PropertyOwnerProfileDrawer } from "./property-owner-profile-drawer";
import { EmptyState } from "@/components/ui/empty-state";
import { PageTransition } from "@/components/shared/page-transition";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DropdownMenu, DropdownItem } from "@/components/ui/dropdown-menu";
import { formatCompactKES } from "@/lib/utils/format";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { cn } from "@/lib/utils/cn";
import { useToast } from "@/components/ui/toast-provider";
import { PROPERTY_TYPE_ICON, PROPERTY_TYPES, type Property } from "./property-constants";

interface Lease {
  id: string;
  startsAt: string;
  endsAt: string;
  monthlyRentKes: string;
  depositKes: string | null;
  isActive: boolean;
  propertyId: string;
  tenantContactId: string;
  propertyName: string;
  propertyCode: string;
  propertyType: string;
  tenantName: string;
  tenantEmail: string | null;
  tenantPhone: string | null;
  tenantAvatarUrl?: string | null;
}

interface Mandate {
  id: string;
  propertyId: string;
  propertyName: string;
  propertyCode: string;
  landlordContactId: string;
  landlordName: string;
  landlordAvatarUrl?: string | null;
  mandateRate: string;
  unitCount: number;
  startDate: string;
  endDate: string | null;
  status: "draft" | "pending_approval" | "active" | "terminated";
  createdAt: string;
  assignedPmId: string | null;
  managerName: string | null;
  managerTitle: string | null;
  managerAvatarUrl: string | null;
  currentPeriodCollected?: number;
  pendingRemittanceId?: string | null;
}

interface MandatesSummary {
  activeMandateCount: number;
  underManagementKes: number;
  expectedRentRollKes: number;
  collectedMtdKes: number;
  managementFeeMtdKes: number;
  remittancesPending: number;
}

const MANDATE_STATUS_TONE: Record<Mandate["status"], "success" | "warning" | "neutral"> = {
  active: "success",
  pending_approval: "warning",
  draft: "neutral",
  terminated: "neutral",
};

const MANDATE_STATUS_LABEL: Record<Mandate["status"], string> = {
  active: "Active",
  pending_approval: "Pending Approval",
  draft: "Draft",
  terminated: "Terminated",
};

export function LeasesBoard({ entityId }: { entityId: string }) {
  const router = useRouter();
  const { pushToast } = useToast();
  const [mode, setMode] = useState<"mandates" | "leases">("mandates");

  const [leases, setLeases] = useState<Lease[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "terminated">("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState("all");
  const [expiryFilter, setExpiryFilter] = useState<"all" | "30" | "60" | "90">("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [drawerLease, setDrawerLease] = useState<Lease | null>(null);
  const [editingLease, setEditingLease] = useState<Lease | null>(null);
  const [renewingLease, setRenewingLease] = useState<Lease | null>(null);

  // Mandates mode state
  const [mandates, setMandates] = useState<Mandate[]>([]);
  const [mandatesLoading, setMandatesLoading] = useState(true);
  const [mandatesLoaded, setMandatesLoaded] = useState(false);
  const [mandatesSummary, setMandatesSummary] = useState<MandatesSummary | null>(null);
  const [mandateModalOpen, setMandateModalOpen] = useState(false);
  const [mandateStatusFilter, setMandateStatusFilter] = useState<"all" | Mandate["status"]>("all");
  const [terminatingMandate, setTerminatingMandate] = useState<Mandate | null>(null);
  const [terminateNotes, setTerminateNotes] = useState("");
  const [terminateNotesErr, setTerminateNotesErr] = useState(false);
  const [isTerminatingMandate, setIsTerminatingMandate] = useState(false);
  const [ownerDrawer, setOwnerDrawer] = useState<{ open: boolean; ownerContactId: string | null; properties: Property[] }>({
    open: false,
    ownerContactId: null,
    properties: [],
  });

  // Carousel state
  const [featuredIndex, setFeaturedIndex] = useState(0);

  const rowsPerPage = 8;

  const loadLeases = useCallback(async () => {
    try {
      const res = await fetch(`/api/leases?entityId=${entityId}`);
      const data = await res.json();
      setLeases(data.leases ?? []);
    } catch (err) {
      console.error("Failed to load leases:", err);
      pushToast({
        tone: "warning",
        title: "Load Failed",
        body: "Could not retrieve lease agreements.",
      });
    } finally {
      setLoading(false);
    }
  }, [entityId, pushToast]);

  const loadMandates = useCallback(async () => {
    try {
      const res = await fetch(`/api/mandates?entityId=${entityId}&includeFinancials=1&includeSummary=1`);
      const data = await res.json();
      setMandates(data.mandates ?? []);
      setMandatesSummary(data.summary ?? null);
    } catch (err) {
      console.error("Failed to load mandates:", err);
      pushToast({
        tone: "warning",
        title: "Load Failed",
        body: "Could not retrieve management mandates.",
      });
    } finally {
      setMandatesLoading(false);
      setMandatesLoaded(true);
    }
  }, [entityId, pushToast]);

  useEffect(() => {
    if (!entityId) return;
    const timer = setTimeout(() => {
      loadLeases();
    }, 0);
    return () => clearTimeout(timer);
  }, [entityId, loadLeases]);

  // Mandates load lazily on first switch into mandates mode (default mode, so
  // effectively on mount) - mirrors the lazy-tab-load convention used across
  // the Property Command Center's tab panels.
  useEffect(() => {
    if (!entityId || mode !== "mandates" || mandatesLoaded) return;
    const timer = setTimeout(() => {
      loadMandates();
    }, 0);
    return () => clearTimeout(timer);
  }, [entityId, mode, mandatesLoaded, loadMandates]);

  // Handle lease termination (from drawer)
  const handleTerminate = async (id: string) => {
    try {
      const res = await fetch(`/api/leases/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityId, action: "terminate" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to terminate lease");

      pushToast({
        tone: "success",
        title: "Lease Terminated",
        body: "Lease has been set to inactive, and property status updated back to available.",
      });
      setDrawerLease(null);
      loadLeases();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Termination failed.";
      pushToast({
        tone: "warning",
        title: "Action Failed",
        body: msg,
      });
    }
  };

  const handleTerminateMandate = async () => {
    if (!terminatingMandate) return;
    if (!terminateNotes.trim()) {
      setTerminateNotesErr(true);
      return;
    }
    setIsTerminatingMandate(true);
    try {
      const res = await fetch(`/api/mandates/${terminatingMandate.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "terminate", entityId, reason: terminateNotes.trim() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Failed to terminate mandate");
      }
      pushToast({ tone: "success", title: "Mandate terminated" });
      setTerminatingMandate(null);
      setTerminateNotes("");
      loadMandates();
    } catch (err) {
      pushToast({ tone: "warning", title: "Error", body: err instanceof Error ? err.message : "Failed to terminate mandate" });
    } finally {
      setIsTerminatingMandate(false);
    }
  };

  const openLandlordProfile = async (mandate: Mandate) => {
    setOwnerDrawer({ open: true, ownerContactId: mandate.landlordContactId, properties: [] });
    try {
      const res = await fetch(`/api/properties?entityId=${entityId}&ownerContactId=${mandate.landlordContactId}`);
      const data = await res.json();
      setOwnerDrawer((prev) => ({ ...prev, properties: data.properties ?? [] }));
    } catch (err) {
      console.error("Failed to load landlord's properties:", err);
    }
  };

  const daysUntilExpiry = (l: Lease) => Math.ceil((new Date(l.endsAt).getTime() - new Date().getTime()) / 86_400_000);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let result = leases;

    // Apply status filter
    if (statusFilter === "active") {
      result = result.filter((l) => l.isActive);
    } else if (statusFilter === "terminated") {
      result = result.filter((l) => !l.isActive);
    }

    // Apply type filter
    if (typeFilter !== "all") {
      result = result.filter((l) => l.propertyType === typeFilter);
    }

    // Apply expiry-window filter - active leases whose end date falls within
    // the next N days (already past due doesn't count as "expiring soon").
    if (expiryFilter !== "all") {
      const windowDays = parseInt(expiryFilter, 10);
      result = result.filter((l) => l.isActive && daysUntilExpiry(l) >= 0 && daysUntilExpiry(l) <= windowDays);
    }

    if (!q) return result;

    return result.filter((l) =>
      [
        l.id,
        l.propertyName,
        l.propertyCode,
        l.tenantName,
        l.tenantEmail || "",
        l.tenantPhone || "",
      ].some((v) => v?.toLowerCase().includes(q))
    );
  }, [leases, query, statusFilter, typeFilter, expiryFilter]);

  const filteredMandates = useMemo(() => {
    const q = query.trim().toLowerCase();
    let result = mandates;
    if (mandateStatusFilter !== "all") {
      result = result.filter((m) => m.status === mandateStatusFilter);
    }
    if (!q) return result;
    return result.filter((m) =>
      [m.id, m.propertyName, m.propertyCode, m.landlordName, m.managerName ?? ""].some((v) => v?.toLowerCase().includes(q)),
    );
  }, [mandates, query, mandateStatusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const safePage = Math.min(page, totalPages);
  const visible = filtered.slice((safePage - 1) * rowsPerPage, safePage * rowsPerPage);

  const mandateTotalPages = Math.max(1, Math.ceil(filteredMandates.length / rowsPerPage));
  const mandateSafePage = Math.min(page, mandateTotalPages);
  const visibleMandates = filteredMandates.slice((mandateSafePage - 1) * rowsPerPage, mandateSafePage * rowsPerPage);

  const activeFilterCount = (statusFilter !== "all" ? 1 : 0) + (typeFilter !== "all" ? 1 : 0) + (expiryFilter !== "all" ? 1 : 0);
  const hasActiveFilters = statusFilter !== "all" || typeFilter !== "all" || expiryFilter !== "all";

  const kpis = useMemo(() => {
    const active = leases.filter((l) => l.isActive).length;
    const total = leases.length;
    const rate = total > 0 ? (active / total) * 100 : 0;
    const rentPool = leases
      .filter((l) => l.isActive && l.monthlyRentKes)
      .reduce((sum, l) => sum + parseFloat(l.monthlyRentKes), 0);
    const expiringSoon = leases.filter((l) => l.isActive && daysUntilExpiry(l) >= 0 && daysUntilExpiry(l) <= 60).length;

    return { total, active, rate, rentPool, expiringSoon };
  }, [leases]);

  const latestLeases = useMemo(() => {
    // Top 5 most recent active leases for the carousel
    return [...leases]
      .filter(l => l.isActive)
      .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime())
      .slice(0, 5);
  }, [leases]);

  const featuredMandates = useMemo(() => {
    return [...mandates]
      .filter((m) => m.status === "active")
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);
  }, [mandates]);

  const featuredItems = mode === "mandates" ? featuredMandates : latestLeases;
  const safeFeaturedIndex = featuredItems.length === 0 ? 0 : Math.min(featuredIndex, featuredItems.length - 1);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toISOString().split("T")[0];
  };

  const getInitials = (name: string) => {
    if (!name) return "??";
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  };

  return (
    <PageTransition className="mx-auto flex max-w-[98rem] flex-col gap-4">
      <BoardHeader
        eyebrow={<Badge tone="data">Leases & Management Mandates</Badge>}
        title="Leases & Management Mandates"
        description="Sunland's clients are landlords: each management mandate is the primary commercial relationship. Individual tenant leases sit underneath, for follow-up."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={mode === "mandates" ? loadMandates : loadLeases}
              disabled={mode === "mandates" ? mandatesLoading : loading}
            >
              <IconRefresh size={14} className={(mode === "mandates" ? mandatesLoading : loading) ? "animate-spin" : undefined} /> Refresh
            </Button>
            {mode === "mandates" ? (
              <Button size="sm" onClick={() => setMandateModalOpen(true)}>
                <IconPlus size={14} /> New Mandate
              </Button>
            ) : (
              <Button size="sm" onClick={() => setIsModalOpen(true)}>
                <IconPlus size={14} /> Register Lease
              </Button>
            )}
          </div>
        }
      />

      <PortfolioHubNav active="leases" />

      <div className="flex bg-slate-100 p-1 rounded-xl self-start shrink-0">
        {([
          { key: "mandates", label: "Management Mandates" },
          { key: "leases", label: "Tenant Leases" },
        ] as const).map((opt) => (
          <button
            key={opt.key}
            onClick={() => { setMode(opt.key); setPage(1); setQuery(""); }}
            className={cn(
              "px-4 py-2 body-sm rounded-lg transition-colors font-medium",
              mode === opt.key ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-700"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-4 my-6">
        <hr className="flex-1 border-slate-200/60" />
        <span className="label-caps text-slate-400 tracking-wider">Analytics & Command</span>
        <hr className="flex-1 border-slate-200/60" />
      </div>

      {/* ── Majestic Dark KPI Tier ── */}
      <div className="gsap-stagger bg-tertiary-gradient text-white rounded-[24px] shadow-2xl relative overflow-hidden group mb-8 border border-[#151936]">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 via-transparent to-transparent pointer-events-none" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-white/10 relative z-10">
          {mode === "mandates" ? (
            <>
              <div className="p-8 flex flex-col justify-between">
                <div className="flex items-center gap-3 mb-6">
                  <div className="size-8 rounded-full bg-white/5 flex items-center justify-center border border-white/10 text-slate-300">
                    <IconFileCertificate size={14} />
                  </div>
                  <span className="text-xs font-medium text-slate-400 tracking-wider">Under Management</span>
                </div>
                <div>
                  <span className="font-mono text-3xl font-light text-white tracking-tight">
                    {formatCompactKES(mandatesSummary?.underManagementKes ?? 0)}
                  </span>
                  <p className="text-[10px] font-medium uppercase tracking-widest text-slate-400 mt-2">
                    {mandatesSummary?.activeMandateCount ?? 0} ACTIVE MANDATE{mandatesSummary?.activeMandateCount === 1 ? "" : "S"}
                  </p>
                </div>
              </div>
              <div className="p-8 flex flex-col justify-between bg-white/[0.02]">
                <div className="flex items-center gap-3 mb-6">
                  <div className="size-8 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 text-emerald-400">
                    <IconCheck size={14} />
                  </div>
                  <span className="text-xs font-medium text-slate-400 tracking-wider">Expected Rent Roll</span>
                </div>
                <div>
                  <span className="font-mono text-3xl font-light text-white tracking-tight">
                    {formatCompactKES(mandatesSummary?.expectedRentRollKes ?? 0)}
                  </span>
                  <p className="text-[10px] font-medium uppercase tracking-widest text-slate-400 mt-2">MONTHLY</p>
                </div>
              </div>
              <div className="p-8 flex flex-col justify-between">
                <div className="flex items-center gap-3 mb-6">
                  <div className="size-8 rounded-full bg-amber-500/10 flex items-center justify-center border border-amber-500/20 text-amber-400">
                    <IconTrendingUp size={14} />
                  </div>
                  <span className="text-xs font-medium text-slate-400 tracking-wider">Collected MTD</span>
                </div>
                <div>
                  <span className="font-mono text-3xl font-light text-white tracking-tight">
                    {formatCompactKES(mandatesSummary?.collectedMtdKes ?? 0)}
                  </span>
                  <p className="text-[10px] font-medium uppercase tracking-widest text-slate-400 mt-2">THIS MONTH</p>
                </div>
              </div>
              <div className="p-8 flex flex-col justify-between bg-white/[0.02]">
                <div className="flex items-center gap-3 mb-6">
                  <div className="size-8 rounded-full bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 text-indigo-400">
                    <IconWallet size={14} />
                  </div>
                  <span className="text-xs font-medium text-slate-400 tracking-wider">Management Fee MTD</span>
                </div>
                <div>
                  <span className="font-mono text-3xl font-light text-white tracking-tight">
                    {formatCompactKES(mandatesSummary?.managementFeeMtdKes ?? 0)}
                  </span>
                  <p className="text-[10px] font-medium uppercase tracking-widest text-slate-400 mt-2">EARNED THIS MONTH</p>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Total Records */}
              <div className="p-8 flex flex-col justify-between">
                <div className="flex items-center gap-3 mb-6">
                  <div className="size-8 rounded-full bg-white/5 flex items-center justify-center border border-white/10 text-slate-300">
                    <IconCalendar size={14} />
                  </div>
                  <span className="text-xs font-medium text-slate-400 tracking-wider">Total Leases</span>
                </div>
                <div className="flex items-end justify-between">
                  <span className="font-mono text-4xl font-light text-white">{kpis.total}</span>
                  <span className="text-[10px] font-medium uppercase tracking-widest text-slate-400 mb-1">ALL TIME</span>
                </div>
              </div>

              {/* Active Tenancies */}
              <div className="p-8 flex flex-col justify-between bg-white/[0.02]">
                <div className="flex items-center gap-3 mb-6">
                  <div className="size-8 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 text-emerald-400">
                    <IconCheck size={14} />
                  </div>
                  <span className="text-xs font-medium text-slate-400 tracking-wider">Active Tenancies</span>
                </div>
                <div className="flex items-end justify-between">
                  <span className="font-mono text-4xl font-light text-white">{kpis.active}</span>
                  <span className="text-[10px] font-medium uppercase tracking-widest text-emerald-400 mb-1">{kpis.rate.toFixed(1)}% SHARE</span>
                </div>
              </div>

              {/* Occupancy Rate / Mix */}
              <div className="p-8 flex flex-col justify-between">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded-full bg-amber-500/10 flex items-center justify-center border border-amber-500/20 text-amber-400">
                      <IconTrendingUp size={14} />
                    </div>
                    <span className="text-xs font-medium text-slate-400 tracking-wider">Lease Status Mix</span>
                  </div>
                  <span className="font-mono text-xl text-white">{kpis.rate.toFixed(1)}%</span>
                </div>
                <div>
                  <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden flex mb-3">
                    <div style={{ width: `${kpis.rate}%` }} className="bg-emerald-400 h-full rounded-r-full shadow-[0_0_10px_rgba(52,211,153,0.5)]" />
                  </div>
                  <div className="flex items-center gap-4 text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                    <span className="flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-emerald-400" /> ACTIVE: {kpis.active}</span>
                    <span className="flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-slate-500" /> TERM: {kpis.total - kpis.active}</span>
                  </div>
                </div>
              </div>

              {/* Rent Pool */}
              <div className="p-8 flex flex-col justify-between bg-white/[0.02]">
                <div className="flex items-center gap-3 mb-6">
                  <div className="size-8 rounded-full bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 text-indigo-400">
                    <IconShield size={14} />
                  </div>
                  <span className="text-xs font-medium text-slate-400 tracking-wider">Monthly Rent Pool</span>
                </div>
                <div>
                  <span className="font-mono text-3xl font-light text-white tracking-tight">
                    {formatCompactKES(kpis.rentPool)}
                  </span>
                  <p className="text-[10px] font-medium uppercase tracking-widest text-slate-400 mt-2">CONTRACTED - ACTIVE ONLY</p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {mode === "leases" && kpis.expiringSoon > 0 && (
        <button
          type="button"
          onClick={() => { setExpiryFilter("60"); setStatusFilter("active"); setFiltersOpen(true); setPage(1); }}
          className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50/60 px-4 py-3 text-left hover:bg-amber-50 transition-colors"
        >
          <IconAlertTriangle size={18} className="text-amber-500 shrink-0" aria-hidden="true" />
          <p className="text-body-regular text-amber-700">
            {kpis.expiringSoon} lease{kpis.expiringSoon === 1 ? "" : "s"} expiring within 60 days - click to filter.
          </p>
        </button>
      )}

      {mode === "mandates" && (mandatesSummary?.remittancesPending ?? 0) > 0 && (
        <button
          type="button"
          onClick={() => setMandateStatusFilter("active")}
          className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50/60 px-4 py-3 text-left hover:bg-amber-50 transition-colors"
        >
          <IconWalletOff size={18} className="text-amber-500 shrink-0" aria-hidden="true" />
          <p className="text-body-regular text-amber-700">
            {mandatesSummary?.remittancesPending} remittance{mandatesSummary?.remittancesPending === 1 ? "" : "s"} awaiting release to landlords - open a mandate file to review.
          </p>
        </button>
      )}

      {/* ── Highlighted Recent ── */}
      <div className="gsap-stagger grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-3 bg-white border border-slate-100 rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_16px_40px_rgb(0,0,0,0.06)] transition-all duration-500 flex flex-col overflow-hidden relative">

          {featuredItems.length > 0 ? (
            mode === "mandates" ? (
              <div className="flex gap-0 flex-1 min-h-0" key={`mandate-${safeFeaturedIndex}`}>
                <div className="relative w-1/3 shrink-0 overflow-hidden bg-slate-50 flex items-center justify-center border-r border-slate-100">
                  <div className="absolute top-6 left-6 z-20">
                    <span className="bg-[#151936] px-2.5 py-1 rounded-lg inline-flex items-center gap-1.5 text-white text-xs font-medium shadow-sm">
                      <IconStarFilled size={12} className="text-amber-400" /> Recently Activated Mandates
                    </span>
                  </div>
                  <div className="absolute inset-0 opacity-[0.04] bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:16px_16px]" />
                  <div className="text-center z-10">
                    <Avatar
                      src={featuredMandates[safeFeaturedIndex].landlordAvatarUrl || undefined}
                      fallback={getInitials(featuredMandates[safeFeaturedIndex].landlordName)}
                      className="size-20 bg-white text-slate-700 text-2xl font-medium border border-slate-200 mx-auto mb-3"
                    />
                    <h4 className="text-slate-800 font-medium">{featuredMandates[safeFeaturedIndex].landlordName}</h4>
                    <p className="text-slate-400 text-xs mt-1">Since {formatDate(featuredMandates[safeFeaturedIndex].startDate)}</p>
                  </div>
                </div>

                <div className="flex-1 flex flex-col px-6 pb-6 pt-5 min-w-0">
                  <div className="flex items-center justify-end mb-4">
                    {featuredMandates.length > 1 && (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setFeaturedIndex((i) => (i === 0 ? featuredMandates.length - 1 : i - 1))}
                          className="size-7 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                        >
                          <IconChevronLeft size={14} />
                        </button>
                        <span className="label-caps text-slate-400 tabular-nums">{safeFeaturedIndex + 1}&thinsp;/&thinsp;{featuredMandates.length}</span>
                        <button
                          onClick={() => setFeaturedIndex((i) => (i === featuredMandates.length - 1 ? 0 : i + 1))}
                          className="size-7 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                        >
                          <IconChevronRight size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="mb-4">
                    <Badge tone="success" className="mb-2">Active Mandate</Badge>
                    <h4 className="text-title-primary leading-snug">{featuredMandates[safeFeaturedIndex].propertyName}</h4>
                    <p className="body-sm text-slate-400 flex items-center gap-1 mt-1 font-mono text-xs">
                      {(parseFloat(featuredMandates[safeFeaturedIndex].mandateRate) * 100).toFixed(1)}% management fee
                    </p>
                  </div>

                  <div className="mt-auto pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
                    <div>
                      <p className="label-caps text-slate-400 mb-0.5">Collected This Month</p>
                      <p className="mono-stat text-slate-900 text-xl tracking-tight">
                        {formatCompactKES(featuredMandates[safeFeaturedIndex].currentPeriodCollected ?? 0)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Link href={`/admin/mandates/${featuredMandates[safeFeaturedIndex].id}`}>
                        <Button size="sm" className="bg-[#151936] text-white hover:bg-[#151936]/90">
                          <IconEye size={14} /> Open Mandate File
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex gap-0 flex-1 min-h-0" key={`lease-${safeFeaturedIndex}`}>
                {/* Tenant abstract graphic panel */}
                <div className="relative w-1/3 shrink-0 overflow-hidden bg-slate-50 flex items-center justify-center border-r border-slate-100">
                  <div className="absolute top-6 left-6 z-20">
                    <span className="bg-[#151936] px-2.5 py-1 rounded-lg inline-flex items-center gap-1.5 text-white text-xs font-medium shadow-sm">
                      <IconStarFilled size={12} className="text-amber-400" /> Newest Active Contracts
                    </span>
                  </div>
                  <div className="absolute inset-0 opacity-[0.04] bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:16px_16px]" />
                  <div className="text-center z-10">
                    <Avatar
                      src={latestLeases[safeFeaturedIndex].tenantAvatarUrl || undefined}
                      fallback={getInitials(latestLeases[safeFeaturedIndex].tenantName)}
                      className="size-20 bg-white text-slate-700 text-2xl font-medium border border-slate-200 mx-auto mb-3"
                    />
                    <h4 className="text-slate-800 font-medium">{latestLeases[safeFeaturedIndex].tenantName}</h4>
                    <p className="text-slate-400 text-xs mt-1">Started: {formatDate(latestLeases[safeFeaturedIndex].startsAt)}</p>
                  </div>
                </div>

                {/* Info panel */}
                <div className="flex-1 flex flex-col px-6 pb-6 pt-5 min-w-0">
                  <div className="flex items-center justify-end mb-4">
                    {latestLeases.length > 1 && (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setFeaturedIndex((i) => (i === 0 ? latestLeases.length - 1 : i - 1))}
                          className="size-7 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                        >
                          <IconChevronLeft size={14} />
                        </button>
                        <span className="label-caps text-slate-400 tabular-nums">{safeFeaturedIndex + 1}&thinsp;/&thinsp;{latestLeases.length}</span>
                        <button
                          onClick={() => setFeaturedIndex((i) => (i === latestLeases.length - 1 ? 0 : i + 1))}
                          className="size-7 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                        >
                          <IconChevronRight size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="mb-4">
                    <Badge tone="success" className="mb-2">Active</Badge>
                    <h4 className="text-title-primary leading-snug">{latestLeases[safeFeaturedIndex].propertyName}</h4>
                    <p className="body-sm text-slate-400 flex items-center gap-1 mt-1 font-mono text-xs">
                      Unit: {latestLeases[safeFeaturedIndex].propertyCode}
                    </p>
                  </div>

                  <div className="mt-auto pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
                    <div>
                      <p className="label-caps text-slate-400 mb-0.5">Expected Monthly Rent</p>
                      <p className="mono-stat text-slate-900 text-xl tracking-tight">
                        {formatCompactKES(parseFloat(latestLeases[safeFeaturedIndex].monthlyRentKes))}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setDrawerLease(latestLeases[safeFeaturedIndex])}
                      >
                        Details
                      </Button>
                      <Link href={`/admin/leases/${latestLeases[safeFeaturedIndex].id}`}>
                        <Button
                          size="sm"
                          className="bg-[#151936] text-white hover:bg-[#151936]/90"
                        >
                          <IconEye size={14} /> View
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            )
          ) : (
            <div className="flex flex-col items-center justify-center py-14 text-center text-slate-400 flex-1">
              <div className="size-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center mb-3">
                <IconStarFilled size={24} className="opacity-40" />
              </div>
              <p className="body-sm text-slate-400">{mode === "mandates" ? "No active mandates currently." : "No active leases currently."}</p>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4 my-6">
        <hr className="flex-1 border-slate-200/60" />
        <span className="label-caps text-slate-400 tracking-wider">{mode === "mandates" ? "Mandate Register" : "Inventory Data"}</span>
        <hr className="flex-1 border-slate-200/60" />
      </div>

      {mode === "mandates" ? (
        /* ── Data Tier: Mandate Register ── */
        <div className="bg-transparent lg:bg-white border-transparent lg:border-slate-100 p-0 lg:p-8 rounded-none lg:rounded-[24px] shadow-none lg:shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b-0 lg:border-b border-slate-100 pb-2 lg:pb-5 mb-4 lg:mb-5">
            <div className="w-full md:w-auto md:flex-1 max-w-md">
              <div className="relative flex items-center group w-full">
                <IconSearch
                  size={16}
                  className="absolute left-3.5 text-slate-400 group-focus-within:text-[#151936] transition-colors"
                />
                <input
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setPage(1); }}
                  placeholder="Search mandates by landlord, property, or manager..."
                  className="w-full bg-slate-50 border border-slate-200/60 rounded-xl pl-10 pr-4 py-2.5 body-sm text-slate-900 outline-none placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-[#151936]/10 focus:border-[#151936]/30 transition-all shadow-sm"
                />
                {query && (
                  <button onClick={() => setQuery("")} className="absolute right-3 text-slate-300 hover:text-slate-600 transition-colors">
                    <IconX size={14} />
                  </button>
                )}
              </div>
            </div>
            <div className="flex bg-slate-100 p-1 rounded-xl shrink-0 overflow-x-auto custom-scrollbar">
              {(["all", "active", "pending_approval", "terminated"] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => { setMandateStatusFilter(status); setPage(1); }}
                  className={cn(
                    "px-3 py-1.5 body-sm rounded-lg transition-colors whitespace-nowrap",
                    mandateStatusFilter === status ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-700"
                  )}
                >
                  {status === "all" ? "All" : MANDATE_STATUS_LABEL[status]}
                </button>
              ))}
            </div>
          </div>

          {mandatesLoading ? (
            <div className="flex items-center justify-center py-16">
              <LoadingSpinner size="lg" />
            </div>
          ) : filteredMandates.length === 0 ? (
            <EmptyState
              icon={IconFileCertificate}
              title="No management mandates on record"
              description="Create the first mandate to bring a landlord's property under Sunland's management."
              action="New Mandate"
              onClick={() => setMandateModalOpen(true)}
            />
          ) : (
            <div className="space-y-5">
              {/* Mobile/Tablet Card Grid */}
              <div className="block lg:hidden space-y-4">
                {visibleMandates.map((m) => {
                  const PropIcon = IconBuildingCommunity;
                  return (
                    <div
                      key={m.id}
                      onClick={() => router.push(`/admin/mandates/${m.id}`)}
                      className="p-5 bg-white border border-slate-100 rounded-2xl shadow-sm hover:shadow-md transition-all flex flex-col gap-4 cursor-pointer"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="label-caps text-slate-400 mb-1 block">Landlord</p>
                          <span className="body-md text-slate-900 font-medium">{m.landlordName}</span>
                        </div>
                        <Badge tone={MANDATE_STATUS_TONE[m.status]}>{MANDATE_STATUS_LABEL[m.status]}</Badge>
                      </div>

                      <div className="space-y-2 border-t border-slate-50 pt-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <p className="label-caps text-slate-400 mb-1">Property</p>
                            <div className="flex items-center gap-1.5 text-slate-700">
                              <PropIcon size={16} className="text-slate-400" />
                              <span className="body-sm font-medium text-slate-700 truncate block max-w-[140px]">{m.propertyName}</span>
                            </div>
                          </div>
                          <div>
                            <p className="label-caps text-slate-400 mb-1">Rate</p>
                            <span className="body-sm text-slate-800 block font-mono">{(parseFloat(m.mandateRate) * 100).toFixed(1)}%</span>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3 pt-1">
                          <div>
                            <p className="label-caps text-slate-400 mb-1">Manager</p>
                            <span className="body-sm text-slate-700 block truncate">{m.managerName ?? "Unassigned"}</span>
                          </div>
                          <div>
                            <p className="label-caps text-slate-400 mb-1">Remittance</p>
                            {m.pendingRemittanceId ? <Badge tone="warning">Pending</Badge> : <span className="body-sm text-slate-400">-</span>}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-50 mt-1" onClick={(e) => e.stopPropagation()}>
                        <span className="mono-data text-xs text-slate-400">{m.id.slice(0, 8).toUpperCase()}</span>
                        <DropdownMenu label="Mandate actions" align="right" trigger={
                          <span className="size-8 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
                            <IconDotsVertical size={16} />
                          </span>
                        }>
                          <DropdownItem icon={IconUserCircle} onClick={() => openLandlordProfile(m)}>Landlord Profile</DropdownItem>
                          <Link href="/admin/messages"><DropdownItem icon={IconMessageCircle}>Message Manager</DropdownItem></Link>
                          {(m.status === "active" || m.status === "pending_approval") && (
                            <DropdownItem icon={IconTrash} variant="danger" onClick={() => setTerminatingMandate(m)}>Terminate Mandate</DropdownItem>
                          )}
                        </DropdownMenu>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop Table */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full min-w-[900px] text-left text-body-regular">
                  <thead>
                    <tr className="border-b border-slate-100 label-caps text-slate-400">
                      <th className="px-3 py-3">Landlord</th>
                      <th className="px-3 py-3">Property</th>
                      <th className="px-3 py-3">Manager</th>
                      <th className="px-3 py-3 text-right">Rate</th>
                      <th className="px-3 py-3 text-right">Collection (MTD)</th>
                      <th className="px-3 py-3 text-center">Remittance</th>
                      <th className="px-3 py-3 text-center">Status</th>
                      <th className="px-3 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {visibleMandates.map((m) => (
                      <tr key={m.id} onClick={() => router.push(`/admin/mandates/${m.id}`)} className="transition-colors hover:bg-slate-50/40 group cursor-pointer">
                        <td className="px-3 py-4">
                          <div className="flex items-center gap-3">
                            <Avatar
                              src={m.landlordAvatarUrl || undefined}
                              fallback={getInitials(m.landlordName)}
                              className="size-9 bg-slate-50 text-slate-700 text-xs font-medium border border-slate-100 shrink-0"
                            />
                            <p className="body-md text-slate-800 font-medium">{m.landlordName}</p>
                          </div>
                        </td>
                        <td className="px-3 py-4">
                          <div className="flex items-center gap-2.5">
                            <div className="size-8 rounded-lg bg-slate-50 flex items-center justify-center border border-slate-200/60 text-slate-400 group-hover:text-slate-600 transition-colors">
                              <IconBuildingCommunity size={16} stroke={1.5} />
                            </div>
                            <div>
                              <p className="body-md text-slate-800 font-medium">{m.propertyName}</p>
                              <p className="mono-data text-xs text-slate-400 mt-0.5">{m.propertyCode}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-4 body-sm text-slate-700">{m.managerName ?? <span className="text-slate-400">Unassigned</span>}</td>
                        <td className="px-3 py-4 text-right mono-stat text-slate-900">{(parseFloat(m.mandateRate) * 100).toFixed(1)}%</td>
                        <td className="px-3 py-4 text-right mono-stat text-slate-900 font-medium">
                          {m.status === "active" ? formatCompactKES(m.currentPeriodCollected ?? 0) : "-"}
                        </td>
                        <td className="px-3 py-4 text-center">
                          {m.pendingRemittanceId ? <Badge tone="warning">Pending</Badge> : <span className="text-slate-300">-</span>}
                        </td>
                        <td className="px-3 py-4 text-center">
                          <Badge tone={MANDATE_STATUS_TONE[m.status]}>{MANDATE_STATUS_LABEL[m.status]}</Badge>
                        </td>
                        <td className="px-3 py-4" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            <DropdownMenu label="Mandate actions" align="right" trigger={
                              <span className="size-8 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors opacity-0 group-hover:opacity-100">
                                <IconDotsVertical size={16} />
                              </span>
                            }>
                              <DropdownItem icon={IconUserCircle} onClick={() => openLandlordProfile(m)}>Landlord Profile</DropdownItem>
                              <Link href="/admin/messages"><DropdownItem icon={IconMessageCircle}>Message Manager</DropdownItem></Link>
                              {(m.status === "active" || m.status === "pending_approval") && (
                                <DropdownItem icon={IconTrash} variant="danger" onClick={() => setTerminatingMandate(m)}>Terminate Mandate</DropdownItem>
                              )}
                            </DropdownMenu>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <PaginationControls
                currentPage={mandateSafePage}
                totalPages={mandateTotalPages}
                onPageChange={setPage}
                label={`${filteredMandates.length} mandate records`}
              />
            </div>
          )}
        </div>
      ) : (
        /* ── Data Tier: Leases Table ── */
        <div className="bg-transparent lg:bg-white border-transparent lg:border-slate-100 p-0 lg:p-8 rounded-none lg:rounded-[24px] shadow-none lg:shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b-0 lg:border-b border-slate-100 pb-2 lg:pb-5 mb-4 lg:mb-5">
            <div className="w-full md:w-auto md:flex-1 max-w-md">
              <div className="relative flex items-center group w-full">
                <IconSearch
                  size={16}
                  className="absolute left-3.5 text-slate-400 group-focus-within:text-[#151936] transition-colors"
                />
                <input
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Search leases by tenant, property, or code..."
                  className="w-full bg-slate-50 lg:bg-slate-50 border border-slate-200/60 rounded-xl pl-10 pr-4 py-2.5 body-sm text-slate-900 outline-none placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-[#151936]/10 focus:border-[#151936]/30 transition-all shadow-sm"
                />
                {query && (
                  <button
                    onClick={() => setQuery("")}
                    className="absolute right-3 text-slate-300 hover:text-slate-600 transition-colors"
                  >
                    <IconX size={14} />
                  </button>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-2 md:pb-0 -mx-4 px-4 md:mx-0 md:px-0">
              <div className="flex bg-slate-100 p-1 rounded-xl shrink-0">
                {(["all", "active", "terminated"] as const).map((status) => (
                  <button
                    key={status}
                    onClick={() => {
                      setStatusFilter(status);
                      setPage(1);
                    }}
                    className={cn(
                      "px-3 py-1.5 body-sm rounded-lg transition-colors capitalize",
                      statusFilter === status
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-400 hover:text-slate-700"
                    )}
                  >
                    {status}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setFiltersOpen(!filtersOpen)}
                className={cn(
                  "inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 body-sm rounded-xl transition-colors border shadow-sm",
                  filtersOpen
                    ? "bg-[#151936] text-white border-[#151936]"
                    : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200/60"
                )}
              >
                <IconFilter size={15} />
                Advanced
                {activeFilterCount > 0 && (
                  <span className="inline-flex size-4 items-center justify-center rounded-full bg-amber-400 text-[#151936] mono-data">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Advanced Filters Panel */}
          {filtersOpen && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-2xl border border-slate-100 bg-slate-50/60 p-4 mb-6">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="prop-type-filter" className="label-caps text-slate-400">
                  Property type
                </label>
                <select
                  id="prop-type-filter"
                  value={typeFilter}
                  onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
                  className="bg-white border border-slate-200 rounded-xl px-3 py-2 body-sm outline-none focus:ring-2 focus:ring-[#151936]/10 focus:border-[#151936]/30"
                >
                  <option value="all">All types</option>
                  {PROPERTY_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="expiry-filter" className="label-caps text-slate-400">
                  Expiring within
                </label>
                <select
                  id="expiry-filter"
                  value={expiryFilter}
                  onChange={(e) => { setExpiryFilter(e.target.value as typeof expiryFilter); setPage(1); }}
                  className="bg-white border border-slate-200 rounded-xl px-3 py-2 body-sm outline-none focus:ring-2 focus:ring-[#151936]/10 focus:border-[#151936]/30"
                >
                  <option value="all">Any time</option>
                  <option value="30">30 days</option>
                  <option value="60">60 days</option>
                  <option value="90">90 days</option>
                </select>
              </div>
              {hasActiveFilters && (
                <div className="sm:col-span-2 flex justify-end mt-2">
                  <button
                    type="button"
                    onClick={() => { setQuery(""); setStatusFilter("all"); setTypeFilter("all"); setExpiryFilter("all"); setPage(1); }}
                    className="inline-flex items-center gap-1 px-3 py-1.5 body-sm text-slate-400 hover:text-rose-600 transition-colors"
                  >
                    <IconX size={14} /> Clear All Filters
                  </button>
                </div>
              )}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <LoadingSpinner size="lg" />
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={IconCalendar}
              title="No leases on record"
              description="Create the first lease agreement to assign a tenant to an available property unit."
              action="Register Lease"
              onClick={() => setIsModalOpen(true)}
            />
          ) : (
            <div className="space-y-5">
              {/* Mobile/Tablet Card Grid */}
              <div className="block lg:hidden space-y-4">
                {visible.map((l) => {
                  const PropIcon = (PROPERTY_TYPE_ICON as Record<string, React.ComponentType<{ size?: number; stroke?: number; className?: string }>>)[l.propertyType] ?? IconBuildingCommunity;
                  return (
                    <div
                      key={l.id}
                      className="p-5 bg-white border border-slate-100 rounded-2xl shadow-sm hover:shadow-md transition-all flex flex-col gap-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="label-caps text-slate-400 mb-0.5">Lease ID</p>
                          <span className="mono-data text-slate-900 text-xs">{l.id.slice(0, 8).toUpperCase()}</span>
                        </div>
                        <Badge tone={l.isActive ? "success" : "neutral"}>
                          {l.isActive ? "Active" : "Terminated"}
                        </Badge>
                      </div>

                      <div className="space-y-2 border-t border-slate-50 pt-3">
                        <div>
                          <p className="label-caps text-slate-400 mb-1 block">Tenant</p>
                          <div className="flex items-center gap-2.5">
                            <Avatar
                              src={l.tenantAvatarUrl || undefined}
                              fallback={getInitials(l.tenantName)}
                              className="size-8 bg-slate-100 text-slate-700 text-xs font-medium border border-slate-200 shrink-0"
                            />
                            <div>
                              <span className="body-md text-slate-900 block font-medium">{l.tenantName}</span>
                              <span className="text-[11px] text-slate-400 block">{l.tenantEmail || l.tenantPhone || "-"}</span>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 pt-1">
                          <div>
                            <p className="label-caps text-slate-400 mb-1">Property</p>
                            <div className="flex items-center gap-1.5 text-slate-700">
                              <PropIcon size={16} className="text-slate-400" />
                              <span className="body-sm font-medium text-slate-700 truncate block max-w-[140px]">{l.propertyName}</span>
                            </div>
                          </div>
                          <div>
                            <p className="label-caps text-slate-400 mb-1">Rates</p>
                            <span className="body-sm text-slate-800 block font-mono">
                              {formatCompactKES(parseFloat(l.monthlyRentKes))}/mo
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-50 mt-1">
                        <span className="mono-data text-xs text-slate-400 flex flex-col">
                          <span>{formatDate(l.startsAt)}</span>
                          <span className="text-[10px]">to {formatDate(l.endsAt)}</span>
                        </span>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            className="h-8"
                            onClick={() => setDrawerLease(l)}
                          >
                            Details
                          </Button>
                          <Link href={`/admin/leases/${l.id}`}>
                            <Button size="sm" className="h-8 bg-[#151936] text-white hover:bg-[#151936]/90 px-3">
                              <IconEye size={14} /> View
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop Table */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full min-w-[850px] text-left text-body-regular">
                  <thead>
                    <tr className="border-b border-slate-100 label-caps text-slate-400">
                      <th className="px-3 py-3">Lease ID</th>
                      <th className="px-3 py-3">Tenant</th>
                      <th className="px-3 py-3">Property Unit</th>
                      <th className="px-3 py-3">Lease Period</th>
                      <th className="px-3 py-3 text-right">Rent rate</th>
                      <th className="px-3 py-3 text-right">Deposit</th>
                      <th className="px-3 py-3 text-center">Status</th>
                      <th className="px-3 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {visible.map((l) => {
                      const PropIcon = (PROPERTY_TYPE_ICON as Record<string, React.ComponentType<{ size?: number; stroke?: number; className?: string }>>)[l.propertyType] ?? IconBuildingCommunity;
                      return (
                        <tr key={l.id} className="transition-colors hover:bg-slate-50/40 group">
                          {/* ID */}
                          <td className="px-3 py-4 font-mono text-slate-400 text-xs">
                            {l.id.slice(0, 8).toUpperCase()}
                          </td>

                          {/* Tenant */}
                          <td className="px-3 py-4">
                            <div className="flex items-center gap-3">
                              <Avatar
                                src={l.tenantAvatarUrl || undefined}
                                fallback={getInitials(l.tenantName)}
                                className="size-9 bg-slate-50 text-slate-700 text-xs font-medium border border-slate-100 shrink-0"
                              />
                              <div>
                                <p className="body-md text-slate-800 font-medium">{l.tenantName}</p>
                                <p className="text-xs text-slate-400 mt-0.5">{l.tenantEmail || l.tenantPhone || "No contact info"}</p>
                              </div>
                            </div>
                          </td>

                          {/* Property */}
                          <td className="px-3 py-4">
                            <div className="flex items-center gap-2.5">
                              <div className="size-8 rounded-lg bg-slate-50 flex items-center justify-center border border-slate-200/60 text-slate-400 group-hover:text-slate-600 transition-colors">
                                <PropIcon size={16} stroke={1.5} />
                              </div>
                              <div>
                                <p className="body-md text-slate-800 font-medium">{l.propertyName}</p>
                                <p className="mono-data text-xs text-slate-400 mt-0.5">{l.propertyCode}</p>
                              </div>
                            </div>
                          </td>

                          {/* Dates */}
                          <td className="px-3 py-4">
                            <div className="space-y-0.5">
                              <span className="mono-data text-slate-700 text-xs block">{formatDate(l.startsAt)}</span>
                              <span className="mono-data text-slate-400 text-xs block">to {formatDate(l.endsAt)}</span>
                            </div>
                          </td>

                          {/* Financials */}
                          <td className="px-3 py-4 text-right mono-stat text-slate-900 font-medium">
                            {formatCompactKES(parseFloat(l.monthlyRentKes))}
                          </td>
                          <td className="px-3 py-4 text-right mono-stat text-slate-400">
                            {l.depositKes ? formatCompactKES(parseFloat(l.depositKes)) : "-"}
                          </td>

                          {/* Status */}
                          <td className="px-3 py-4 text-center">
                            <Badge tone={l.isActive ? "success" : "neutral"}>
                              {l.isActive ? "Active" : "Terminated"}
                            </Badge>
                          </td>

                          {/* Actions */}
                          <td className="px-3 py-4">
                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button
                                variant="secondary"
                                size="sm"
                                className="h-8"
                                onClick={() => setDrawerLease(l)}
                              >
                                Details
                              </Button>
                              <Link href={`/admin/leases/${l.id}`}>
                                <Button size="sm" className="h-8 bg-[#151936] text-white hover:bg-[#151936]/90 px-3">
                                  <IconEye size={14} /> View
                                </Button>
                              </Link>
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
                label={`${filtered.length} lease records`}
              />
            </div>
          )}
        </div>
      )}

      <LeaseDetailDrawer
        lease={drawerLease}
        open={!!drawerLease}
        entityId={entityId}
        onClose={() => setDrawerLease(null)}
        canManage={true}
        onTerminate={handleTerminate}
        onEdit={(l) => { setDrawerLease(null); setEditingLease(l); }}
        onRenew={(l) => { setDrawerLease(null); setRenewingLease(l); }}
      />

      {isModalOpen && (
        <LeaseFormModal
          open={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSubmit={loadLeases}
        />
      )}

      {editingLease && (
        <LeaseFormModal
          open={!!editingLease}
          mode="edit"
          lease={leaseToEditTarget(editingLease)}
          onClose={() => setEditingLease(null)}
          onSubmit={loadLeases}
        />
      )}

      <LeaseRenewModal
        open={!!renewingLease}
        lease={renewingLease ? leaseToRenewTarget(renewingLease) : null}
        onClose={() => setRenewingLease(null)}
        onRenewed={loadLeases}
      />

      {mandateModalOpen && (
        <MandateFormModal
          open={mandateModalOpen}
          entityId={entityId}
          onClose={() => setMandateModalOpen(false)}
          onCreated={loadMandates}
        />
      )}

      <ConfirmDialog
        open={!!terminatingMandate}
        onClose={() => { setTerminatingMandate(null); setTerminateNotes(""); setTerminateNotesErr(false); }}
        onConfirm={handleTerminateMandate}
        title="Terminate Mandate"
        description="This cannot be undone. Rent collection under this mandate stops, and the final landlord remittance is queued for review."
        confirmLabel="Terminate Mandate"
        tone="danger"
        isLoading={isTerminatingMandate}
        notes={{
          label: "Termination reason",
          placeholder: "Why is this mandate being terminated?",
          value: terminateNotes,
          onChange: (v) => { setTerminateNotes(v); setTerminateNotesErr(false); },
          required: true,
          error: terminateNotesErr ? "A reason is required." : undefined,
        }}
      />

      <PropertyOwnerProfileDrawer
        open={ownerDrawer.open}
        onClose={() => setOwnerDrawer({ open: false, ownerContactId: null, properties: [] })}
        entityId={entityId}
        ownerContactId={ownerDrawer.ownerContactId}
        properties={ownerDrawer.properties}
        onOpenProperty={(p) => { setOwnerDrawer({ open: false, ownerContactId: null, properties: [] }); router.push(`/admin/properties/${p.id}`); }}
      />
    </PageTransition>
  );
}

function leaseToEditTarget(l: Lease): LeaseEditTarget {
  return {
    id: l.id,
    propertyName: l.propertyName,
    tenantName: l.tenantName,
    startsAt: l.startsAt,
    endsAt: l.endsAt,
    monthlyRentKes: l.monthlyRentKes,
    depositKes: l.depositKes,
  };
}

function leaseToRenewTarget(l: Lease): LeaseRenewTarget {
  return {
    id: l.id,
    propertyName: l.propertyName,
    tenantName: l.tenantName,
    endsAt: l.endsAt,
    monthlyRentKes: l.monthlyRentKes,
    depositKes: l.depositKes,
  };
}
