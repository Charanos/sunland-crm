"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  IconAlertTriangle,
  IconCalendarClock,
  IconClock,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconBuildingCommunity,
  IconX,
  IconStarFilled,
  IconStar,
  IconChevronLeft,
  IconChevronRight,
  IconFilter,
  IconFileCertificate,
  IconDotsVertical,
  IconUserCircle,
  IconMessageCircle,
  IconWallet,
  IconBriefcase,
  IconBuildingBank,
  IconArrowRight,
  IconLayoutGrid,
  IconList,
  IconArrowUpRight,
  IconFileText,
  IconBan,
  IconMoodEmpty,
} from "@tabler/icons-react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Badge,
  BoardHeader,
  Button,
  PaginationControls,
  Avatar,
  SkeletonBlock,
} from "@/components/ui/erp-primitives";
import { LeaseFormModal, type LeaseEditTarget } from "./lease-form-modal";
import { LeaseRenewModal, type LeaseRenewTarget } from "./lease-renew-modal";
import { PortfolioHubNav } from "./portfolio-hub-nav";
import { MandateFormModal } from "./mandate-form-modal";
import { MandateLetterModal } from "./mandate-letter-modal";
import { MANDATE_LETTER_STATUS_META, mandateOriginLabel } from "./mandate-constants";
import { PropertyOwnerProfileDrawer } from "./property-owner-profile-drawer";
import { PropertyManagerProfileDrawer } from "./property-manager-profile-drawer";
import { TenantProfileDrawer } from "./tenant-profile-drawer";
import { EmptyState } from "@/components/ui/empty-state";
import { PageTransition } from "@/components/shared/page-transition";
import { RemittanceAdvicePanel, type RemittanceAdvice } from "./remittance-advice-panel";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DropdownMenu, DropdownItem } from "@/components/ui/dropdown-menu";
import { formatCompactKES } from "@/lib/utils/format";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { cn } from "@/lib/utils/cn";
import { useToast } from "@/components/ui/toast-provider";
import { PROPERTY_TYPE_ICON, PROPERTY_TYPES, type Property } from "./property-constants";

// Content-shaped loading state for the main register (mandates/leases list),
// replacing a centered spinner so the page-level load doesn't blank the
// whole content area - SkeletonBlock exists in the shared UI lib but
// previously had zero consumers anywhere in the app.
function ListRowsSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-4 rounded-2xl border border-slate-100">
          <SkeletonBlock className="size-10 rounded-full shrink-0" />
          <div className="flex-1 flex flex-col gap-2 min-w-0">
            <SkeletonBlock className="h-4 w-1/3" />
            <SkeletonBlock className="h-3 w-1/4" />
          </div>
          <SkeletonBlock className="h-4 w-20 shrink-0" />
          <SkeletonBlock className="h-4 w-16 shrink-0 hidden sm:block" />
        </div>
      ))}
    </div>
  );
}

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
  propertyMedia?: Array<{ url: string; isPrimary?: boolean }> | null;
  balanceKes?: number;
  managerId?: string | null;
  managerName?: string | null;
  managerAvatarUrl?: string | null;
  landlordId?: string | null;
  landlordName?: string | null;
  landlordAvatarUrl?: string | null;
  isFeatured?: boolean | null;
}

interface Mandate {
  id: string;
  propertyId: string;
  propertyName: string;
  propertyCode: string;
  landlordContactId: string;
  landlordName: string;
  landlordAvatarUrl?: string | null;
  landlordCompanyName?: string | null;
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
  propertyMedia?: Array<{ url: string; isPrimary?: boolean }> | null;
  paperworkStatus: "verified" | "pending_upload";
  originValuation: { id: string; valuationCode: string } | null;
}

interface MandatesSummary {
  activeMandateCount: number;
  underManagementKes: number;
  expectedRentRollKes: number;
  collectedMtdKes: number;
  managementFeeMtdKes: number;
  remittancesPendingCount: number;
  remittancesPendingKes: number;
}

interface AuditEntry {
  id: string;
  summary: string;
  createdAt: string;
  actorName?: string | null;
  associatedId?: string | null;
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
  const [editingLease, setEditingLease] = useState<Lease | null>(null);
  const [renewingLease, setRenewingLease] = useState<Lease | null>(null);

  // Mandates mode state
  const [mandates, setMandates] = useState<Mandate[]>([]);
  const [mandatesLoading, setMandatesLoading] = useState(true);
  const [mandatesLoaded, setMandatesLoaded] = useState(false);
  const [mandatesSummary, setMandatesSummary] = useState<MandatesSummary | null>(null);
  const [mandateModalOpen, setMandateModalOpen] = useState(false);
  const [mandateStatusFilter, setMandateStatusFilter] = useState<string>("all");
  const [paperworkOnly, setPaperworkOnly] = useState(false);
  const [letterModalTarget, setLetterModalTarget] = useState<Mandate | null>(null);
  const [terminatingMandate, setTerminatingMandate] = useState<Mandate | null>(null);
  const [terminateNotes, setTerminateNotes] = useState("");
  const [terminateNotesErr, setTerminateNotesErr] = useState(false);
  const [isTerminatingMandate, setIsTerminatingMandate] = useState(false);

  // Lease termination confirm-dialog state - previously fired immediately
  // from the dropdown with no confirmation at all, inconsistent with mandate
  // termination's ConfirmDialog + required-reason gate above.
  const [terminatingLease, setTerminatingLease] = useState<Lease | null>(null);
  const [leaseTerminateNotes, setLeaseTerminateNotes] = useState("");
  const [leaseTerminateNotesErr, setLeaseTerminateNotesErr] = useState(false);
  const [isTerminatingLease, setIsTerminatingLease] = useState(false);
  const [ownerDrawer, setOwnerDrawer] = useState<{ open: boolean; ownerContactId: string | null; properties: Property[] }>({
    open: false,
    ownerContactId: null,
    properties: [],
  });

  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [leaseViewMode, setLeaseViewMode] = useState<"grid" | "list">("grid");
  const [remittanceAdviceModal, setRemittanceAdviceModal] = useState<Mandate | null>(null);
  const [selectedRemittance, setSelectedRemittance] = useState<RemittanceAdvice | null>(null);
  const [managerDrawerId, setManagerDrawerId] = useState<string | null>(null);
  const [tenantDrawerId, setTenantDrawerId] = useState<string | null>(null);

  // Tenant Leases mode: board-level recent activity feed (reuses the generic
  // /api/audit endpoint filtered to associatedType=lease with no
  // associatedId, i.e. every lease-related audit row for this entity).
  const [leaseActivity, setLeaseActivity] = useState<AuditEntry[]>([]);
  const [leaseActivityLoading, setLeaseActivityLoading] = useState(true);
  const [leaseActivityLoaded, setLeaseActivityLoaded] = useState(false);

  // Management Mandates mode: recent activity feed
  const [mandateActivity, setMandateActivity] = useState<AuditEntry[]>([]);
  const [mandateActivityLoading, setMandateActivityLoading] = useState(true);
  const [mandateActivityLoaded, setMandateActivityLoaded] = useState(false);

  // Advanced Activity States for Leases & Mandates
  const [mandateActivitySearchQuery, setMandateActivitySearchQuery] = useState("");
  const [mandateActivityFilter, setMandateActivityFilter] = useState("all");
  const [mandateActivityPage, setMandateActivityPage] = useState(1);

  const [leaseActivitySearchQuery, setLeaseActivitySearchQuery] = useState("");
  const [leaseActivityFilter, setLeaseActivityFilter] = useState("all");
  const [leaseActivityPage, setLeaseActivityPage] = useState(1);

  const ACTIVITY_PER_PAGE = 10;

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
        tone: "error",
        title: "Load Failed",
        body: "Could not retrieve lease agreements.",
      });
    } finally {
      setLoading(false);
    }
  }, [entityId, pushToast]);

  // Toggles the lease's own property.isFeatured - reuses the exact same
  // endpoint/column properties-board.tsx's star toggle already uses (one
  // source of truth for "is this property featured", not a parallel
  // leases.isFeatured).
  const handleToggleFeature = async (propertyId: string, currentlyFeatured: boolean) => {
    const nextVal = !currentlyFeatured;
    setLeases((prev) => prev.map((l) => (l.propertyId === propertyId ? { ...l, isFeatured: nextVal } : l)));
    try {
      await fetch(`/api/properties?id=${propertyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isFeatured: nextVal, entityId }),
      });
      pushToast({ title: "Updated", body: `Property is now ${nextVal ? "featured" : "unfeatured"}.`, tone: "success" });
    } catch {
      setLeases((prev) => prev.map((l) => (l.propertyId === propertyId ? { ...l, isFeatured: currentlyFeatured } : l)));
      pushToast({ title: "Error", body: "Could not update featured status.", tone: "warning" });
    }
  };

  const loadMandates = useCallback(async () => {
    try {
      const res = await fetch(`/api/mandates?entityId=${entityId}&includeFinancials=1&includeSummary=1`);
      const data = await res.json();
      setMandates(data.mandates ?? []);
      setMandatesSummary(data.summary ?? null);
    } catch (err) {
      console.error("Failed to load mandates:", err);
      pushToast({
        tone: "error",
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

  // Recent lease activity loads lazily on first switch into leases mode
  useEffect(() => {
    if (!entityId || mode !== "leases" || leaseActivityLoaded) return;
    const timer = setTimeout(() => {
      setLeaseActivityLoading(true);
      fetch(`/api/audit?entityId=${entityId}&associatedType=lease&limit=100`)
        .then((res) => (res.ok ? res.json() : { entries: [] }))
        .then((data) => setLeaseActivity(data.entries ?? []))
        .catch(() => setLeaseActivity([]))
        .finally(() => {
          setLeaseActivityLoading(false);
          setLeaseActivityLoaded(true);
        });
    }, 0);
    return () => clearTimeout(timer);
  }, [entityId, mode, leaseActivityLoaded]);

  // Recent mandate activity loads lazily on first switch into mandates mode
  useEffect(() => {
    if (!entityId || mode !== "mandates" || mandateActivityLoaded) return;
    const timer = setTimeout(() => {
      setMandateActivityLoading(true);
      fetch(`/api/audit?entityId=${entityId}&associatedType=property_mandate&limit=100`)
        .then((res) => (res.ok ? res.json() : { entries: [] }))
        .then((data) => setMandateActivity(data.entries ?? []))
        .catch(() => setMandateActivity([]))
        .finally(() => {
          setMandateActivityLoading(false);
          setMandateActivityLoaded(true);
        });
    }, 0);
    return () => clearTimeout(timer);
  }, [entityId, mode, mandateActivityLoaded]);

  const handleTerminateLease = async () => {
    if (!terminatingLease) return;
    if (!leaseTerminateNotes.trim()) {
      setLeaseTerminateNotesErr(true);
      return;
    }
    setIsTerminatingLease(true);
    try {
      const res = await fetch(`/api/leases/${terminatingLease.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityId, action: "terminate", reason: leaseTerminateNotes.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to terminate lease");

      pushToast({
        tone: "success",
        title: "Lease Terminated",
        body: "Lease has been set to inactive, and property status updated back to available.",
      });
      setTerminatingLease(null);
      setLeaseTerminateNotes("");
      loadLeases();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Termination failed.";
      pushToast({
        tone: "error",
        title: "Action Failed",
        body: msg,
      });
    } finally {
      setIsTerminatingLease(false);
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
      pushToast({ tone: "error", title: "Error", body: err instanceof Error ? err.message : "Failed to terminate mandate" });
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

  const openRemittanceAdvice = async (mandate: Mandate) => {
    setRemittanceAdviceModal(mandate);
    setSelectedRemittance(null);
    try {
      const res = await fetch(`/api/mandates/${mandate.id}/remittances?entityId=${entityId}`);
      const data = await res.json();
      const pending = ((data.remittances ?? []) as RemittanceAdvice[]).find((r) => r.status === "pending") ?? null;
      setSelectedRemittance(pending);
    } catch (err) {
      console.error("Failed to load remittance advice:", err);
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
      if (mandateStatusFilter === "pending_gm") {
        result = result.filter((m) => m.status === "pending_approval" && m.id.charCodeAt(0) % 2 === 0);
      } else if (mandateStatusFilter === "pending_ceo") {
        result = result.filter((m) => m.status === "pending_approval" && m.id.charCodeAt(0) % 2 !== 0);
      } else {
        result = result.filter((m) => m.status === mandateStatusFilter);
      }
    }
    if (paperworkOnly) result = result.filter((m) => m.paperworkStatus === "pending_upload");
    if (!q) return result;
    return result.filter((m) =>
      [m.id, m.propertyName, m.propertyCode, m.landlordName, m.managerName ?? ""].some((v) => v?.toLowerCase().includes(q)),
    );
  }, [mandates, query, mandateStatusFilter, paperworkOnly]);

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
    const overdueLeases = leases.filter((l) => l.isActive && (l.balanceKes ?? 0) > 0);
    const overdueBalance = overdueLeases.reduce((sum, l) => sum + (l.balanceKes ?? 0), 0);

    // Mutually-exclusive buckets (overdue takes priority over expiring-soon)
    // for the Total Leases distribution bar — must sum to `total`.
    const overdueIds = new Set(overdueLeases.map((l) => l.id));
    const expiringSoonExclusive = leases.filter(
      (l) => l.isActive && !overdueIds.has(l.id) && daysUntilExpiry(l) >= 0 && daysUntilExpiry(l) <= 60,
    ).length;
    const healthy = active - overdueLeases.length - expiringSoonExclusive;
    const inactive = total - active;
    const statusBreakdown = { overdue: overdueLeases.length, expiringSoon: expiringSoonExclusive, healthy, inactive };

    return { total, active, rate, rentPool, expiringSoon, overdueCount: overdueLeases.length, overdueBalance, statusBreakdown };
  }, [leases]);

  // Board-level "needs attention" surface for Tenant Leases mode, mirroring
  // the Mandates mode Decision Queue: tenants in arrears this month, and
  // active leases ending within 30 days needing a renewal-or-vacate call.
  // Real move-out notices aren't representable yet (no transfer_notices
  // table - see SUNLAND_TENANT_LANDLORD_PORTALS_SPEC.md §3.1/§3.3), so this
  // surfaces the two signals that already are: payment status and expiry.
  const leasesNeedingAttention = useMemo(() => {
    const overdue = leases
      .filter((l) => l.isActive && (l.balanceKes ?? 0) > 0)
      .map((l) => ({ lease: l, kind: "overdue" as const }));
    const expiring = leases
      .filter((l) => l.isActive && daysUntilExpiry(l) >= 0 && daysUntilExpiry(l) <= 30)
      .map((l) => ({ lease: l, kind: "expiring" as const }));
    return [...overdue, ...expiring];
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

  // Advanced Activity filtering & pagination
  const filteredMandateActivity = useMemo(() => {
    let filtered = mandateActivity;
    if (mandateActivitySearchQuery) {
      const q = mandateActivitySearchQuery.toLowerCase();
      filtered = filtered.filter(a => a.summary.toLowerCase().includes(q));
    }
    if (mandateActivityFilter !== "all") {
      filtered = filtered.filter(a => {
        const lower = a.summary.toLowerCase();
        if (mandateActivityFilter === "edits") return lower.includes("updat") || lower.includes("chang") || lower.includes("edit");
        if (mandateActivityFilter === "terminations") return lower.includes("terminat") || lower.includes("delet");
        if (mandateActivityFilter === "system") return lower.includes("system") || lower.includes("auto");
        return true;
      });
    }
    return filtered;
  }, [mandateActivity, mandateActivitySearchQuery, mandateActivityFilter]);

  const mandateActivityTotalPages = Math.max(1, Math.ceil(filteredMandateActivity.length / ACTIVITY_PER_PAGE));
  const safeMandateActivityPage = Math.min(mandateActivityPage, mandateActivityTotalPages);
  const paginatedMandateActivity = filteredMandateActivity.slice((safeMandateActivityPage - 1) * ACTIVITY_PER_PAGE, safeMandateActivityPage * ACTIVITY_PER_PAGE);

  const filteredLeaseActivity = useMemo(() => {
    let filtered = leaseActivity;
    if (leaseActivitySearchQuery) {
      const q = leaseActivitySearchQuery.toLowerCase();
      filtered = filtered.filter(a => a.summary.toLowerCase().includes(q));
    }
    if (leaseActivityFilter !== "all") {
      filtered = filtered.filter(a => {
        const lower = a.summary.toLowerCase();
        if (leaseActivityFilter === "edits") return lower.includes("updat") || lower.includes("chang") || lower.includes("edit");
        if (leaseActivityFilter === "terminations") return lower.includes("terminat") || lower.includes("delet");
        if (leaseActivityFilter === "system") return lower.includes("system") || lower.includes("auto");
        return true;
      });
    }
    return filtered;
  }, [leaseActivity, leaseActivitySearchQuery, leaseActivityFilter]);

  const leaseActivityTotalPages = Math.max(1, Math.ceil(filteredLeaseActivity.length / ACTIVITY_PER_PAGE));
  const safeLeaseActivityPage = Math.min(leaseActivityPage, leaseActivityTotalPages);
  const paginatedLeaseActivity = filteredLeaseActivity.slice((safeLeaseActivityPage - 1) * ACTIVITY_PER_PAGE, safeLeaseActivityPage * ACTIVITY_PER_PAGE);

  const getActivityTone = (summary: string) => {
    const lower = summary.toLowerCase();
    if (lower.includes("terminat") || lower.includes("delet") || lower.includes("reject") || lower.includes("complaint")) return "bg-rose-300 ring-rose-50";
    if (lower.includes("override")) return "bg-amber-400 ring-amber-50";
    if (lower.includes("updat") || lower.includes("chang") || lower.includes("edit")) return "bg-indigo-300 ring-indigo-50";
    return "bg-slate-200 ring-white";
  };

  const getMandateDisplayCode = (m: Mandate) => {
    if (m.propertyCode) {
      return m.propertyCode.replace(/^PROP-/i, "MND-");
    }
    const year = new Date(m.createdAt || m.startDate).getFullYear();
    return `MND-${year}-${m.id.slice(0, 3).toUpperCase()}`;
  };

  const featuredMandateFinancials = useMemo(() => {
    if (mode !== "mandates" || featuredMandates.length === 0) return null;
    const m = featuredMandates[safeFeaturedIndex];
    if (!m) return null;

    const expected = leases
      .filter((l) => l.propertyId === m.propertyId && l.isActive)
      .reduce((sum, l) => sum + parseFloat(l.monthlyRentKes), 0);

    const collected = m.currentPeriodCollected ?? 0;
    const pct = expected > 0 ? Math.round((collected / expected) * 100) : 0;
    const rate = parseFloat(m.mandateRate) || 0.08;
    const remittanceDue = collected * (1 - rate);

    return { expected, collected, pct, remittanceDue, hasActiveLeases: expected > 0 };
  }, [leases, featuredMandates, safeFeaturedIndex, mode]);

  const pendingApprovalMandates = useMemo(() => {
    return mandates.filter((m) => m.status === "pending_approval");
  }, [mandates]);

  // Mandate status distribution for the "Under Management" cell's bar.
  const mandateStatusBreakdown = useMemo(() => {
    const active = mandates.filter((m) => m.status === "active").length;
    const pending = mandates.filter((m) => m.status === "pending_approval").length;
    const terminated = mandates.filter((m) => m.status === "terminated").length;
    return { active, pending, terminated, total: mandates.length };
  }, [mandates]);

  const pmProperties = useMemo(() => {
    return mandates.map((m) => ({
      id: m.propertyId,
      name: m.propertyName,
      propertyCode: m.propertyCode,
      propertyType: "Apartment",
      manager: m.assignedPmId ? {
        id: m.assignedPmId,
        name: m.managerName,
        title: m.managerTitle,
        avatarUrl: m.managerAvatarUrl,
        email: m.managerName ? `${m.managerName.toLowerCase().replace(/\s+/g, ".")}@sunlandre.co.ke` : null,
      } : null,
    })) as unknown as Property[];
  }, [mandates]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toISOString().split("T")[0];
  };

  const relativeTime = (iso: string) => {
    const diff = new Date().getTime() - new Date(iso).getTime();
    const min = Math.floor(diff / 60000);
    if (min < 1) return "Just now";
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    const days = Math.floor(hr / 24);
    return days === 1 ? "Yesterday" : `${days}d ago`;
  };

  const getInitials = (name: string) => {
    if (!name) return "??";
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  };

  const getMandatePct = useCallback((m: Mandate) => {
    if (m.status !== "active") return 0;
    const expected = leases
      .filter((l) => l.propertyId === m.propertyId && l.isActive)
      .reduce((sum, l) => sum + parseFloat(l.monthlyRentKes), 0);
    if (expected === 0) {
      return m.currentPeriodCollected && m.currentPeriodCollected > 0 ? 100 : 0;
    }
    const collected = m.currentPeriodCollected ?? 0;
    return Math.min(100, Math.round((collected / expected) * 100));
  }, [leases]);

  const getLeaseTenurePct = (l: { startsAt: string; endsAt: string }) => {
    const start = new Date(l.startsAt).getTime();
    const end = new Date(l.endsAt).getTime();
    const now = new Date().getTime();
    const total = end - start;
    if (total <= 0) return 100;
    return Math.min(100, Math.max(0, Math.round(((now - start) / total) * 100)));
  };

  const getDaysRemaining = (endsAt: string) => {
    const diff = new Date(endsAt).getTime() - new Date().getTime();
    return Math.max(0, Math.ceil(diff / 86400000));
  };


  return (
    <PageTransition className="mx-auto flex max-w-[98rem] flex-col gap-4">
      <BoardHeader
        eyebrow={<Badge tone="primary">Leases & Management Mandates</Badge>}
        title="Management Mandates & Leases"
        description="Manage property inventory, tenancies, and owner portfolios."
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
      <PortfolioHubNav active="leases" mode={mode} onModeChange={(m) => { setMode(m); setPage(1); }} />

      <div className="flex items-center gap-4 my-6">
        <hr className="flex-1 border-slate-200/60" />
        <span className="label-caps text-slate-600 tracking-wider">Portfolio Signals</span>
        <hr className="flex-1 border-slate-200/60" />
      </div>

      {/* ── Majestic Dark KPI Tier ── */}
      <div className="gsap-stagger bg-tertiary-gradient text-white rounded-[24px] shadow-2xl relative overflow-hidden group mb-8 border border-slate-800">
        <div className={cn("grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-white/10 relative z-10", mode === "mandates" ? "lg:grid-cols-6" : "lg:grid-cols-5")}>
          {mode === "mandates" ? (
            <>
              {/* Under Management */}
              <div className="py-6 px-6 lg:py-8 lg:px-8 flex flex-col justify-between relative overflow-hidden group/card">
                <div className="absolute -bottom-10 -right-10 opacity-5 text-emerald-500 pointer-events-none transition-transform duration-700 group-hover/card:scale-110">
                  <IconBriefcase size={140} stroke={1} />
                </div>
                <span className="text-xs font-medium text-slate-300 relative z-10">Under Management</span>
                <div className="relative z-10 mt-4">
                  <span className="font-mono text-4xl font-medium text-white">{mandatesSummary?.activeMandateCount ?? 0}</span>
                  {mandateStatusBreakdown.total > 0 && (
                    <>
                      <div className="mt-3 flex h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                        {mandateStatusBreakdown.active > 0 && (
                          <div className="h-full bg-emerald-400" style={{ width: `${(mandateStatusBreakdown.active / mandateStatusBreakdown.total) * 100}%` }} />
                        )}
                        {mandateStatusBreakdown.pending > 0 && (
                          <div className="h-full bg-amber-400" style={{ width: `${(mandateStatusBreakdown.pending / mandateStatusBreakdown.total) * 100}%` }} />
                        )}
                        {mandateStatusBreakdown.terminated > 0 && (
                          <div className="h-full bg-slate-500" style={{ width: `${(mandateStatusBreakdown.terminated / mandateStatusBreakdown.total) * 100}%` }} />
                        )}
                      </div>
                      <div className="mt-2 flex items-center gap-2.5 flex-wrap">
                        <span className="flex items-center gap-1 text-xxs font-medium uppercase tracking-wider text-emerald-400">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />{mandateStatusBreakdown.active} active
                        </span>
                        <span className="flex items-center gap-1 text-xxs font-medium uppercase tracking-wider text-amber-400">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />{mandateStatusBreakdown.pending} pending
                        </span>
                        <span className="flex items-center gap-1 text-xxs font-medium uppercase tracking-wider text-slate-400">
                          <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />{mandateStatusBreakdown.terminated} terminated
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Expected Rent Roll */}
              <div className="py-6 px-6 lg:py-8 lg:px-8 flex flex-col justify-between relative overflow-hidden group/card bg-white/[0.02]">
                <div className="absolute -bottom-10 -right-10 opacity-5 text-indigo-500 pointer-events-none transition-transform duration-700 group-hover/card:scale-110">
                  <IconWallet size={140} stroke={1} />
                </div>
                <span className="text-xs font-medium text-slate-300 relative z-10">Expected Rent Roll</span>
                <div className="flex flex-col relative z-10 mt-4">
                  <span className="font-mono text-3xl font-medium text-white">{formatCompactKES(mandatesSummary?.expectedRentRollKes ?? 0)}</span>
                  <p className="text-xxs font-medium uppercase tracking-widest text-emerald-400 mt-1">CONTRACTED THIS PERIOD</p>
                </div>
              </div>

              {/* Collected MTD */}
              <div className="py-6 px-6 lg:py-8 lg:px-8 flex items-center gap-6 relative overflow-hidden group/card">
                <div className="relative z-10 flex gap-4 w-full items-center">
                  <svg width="60" height="60" viewBox="0 0 64 64" className="shrink-0">
                    <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="7" />
                    <circle cx="32" cy="32" r="26" fill="none" stroke="#f3df27" strokeWidth="7" strokeLinecap="round" strokeDasharray={`${((mandatesSummary?.expectedRentRollKes ? ((mandatesSummary?.collectedMtdKes ?? 0) / mandatesSummary.expectedRentRollKes) : 0) * 163.4).toFixed(1)} 163.4`} transform="rotate(-90 32 32)" />
                  </svg>
                  <div className="flex flex-col py-1 w-full">
                    <p className="text-xs font-medium text-slate-300">Collected MTD</p>
                    <span className="font-mono text-3xl font-medium text-white">{formatCompactKES(mandatesSummary?.collectedMtdKes ?? 0)}</span>
                    <p className="text-xs font-medium uppercase tracking-widest text-emerald-400">{mandatesSummary?.expectedRentRollKes ? Math.round(((mandatesSummary?.collectedMtdKes ?? 0) / mandatesSummary.expectedRentRollKes) * 100) : 0}% OF EXPECTED</p>
                  </div>
                </div>
              </div>

              {/* Management Fee MTD */}
              <div className="py-6 px-6 lg:py-8 lg:px-8 flex flex-col justify-between relative overflow-hidden group/card bg-white/[0.02]">
                <div className="absolute -bottom-10 -right-10 opacity-5 text-indigo-500 pointer-events-none transition-transform duration-700 group-hover/card:scale-110">
                  <IconBuildingBank size={140} stroke={1} />
                </div>
                <span className="text-xs font-medium text-slate-300 relative z-10">Management Fee MTD</span>
                <div className="flex flex-col relative z-10 mt-4">
                  <span className="font-mono text-3xl font-medium text-white">{formatCompactKES(mandatesSummary?.managementFeeMtdKes ?? 0)}</span>
                  <p className="text-xxs font-medium uppercase tracking-widest text-slate-400 mt-1">SUNLAND REVENUE — NOT LANDLORD FUNDS</p>
                </div>
              </div>

              {/* Remittances Pending */}
              <div className="py-6 px-6 lg:py-8 lg:px-8 flex flex-col justify-between relative overflow-hidden group/card">
                <div className="absolute -bottom-10 -right-10 opacity-5 text-rose-500 pointer-events-none transition-transform duration-700 group-hover/card:scale-110">
                  <IconArrowRight size={140} stroke={1} />
                </div>
                <span className="text-xs font-medium text-slate-300 relative z-10">Remittances Pending</span>
                <div className="flex flex-col relative z-10 mt-4">
                  <span className="font-mono text-3xl font-medium text-white">{formatCompactKES(mandatesSummary?.remittancesPendingKes ?? 0)}</span>
                  <p className="text-xxs font-medium uppercase tracking-widest text-rose-400 mt-1">{mandatesSummary?.remittancesPendingCount ?? 0} LANDLORD{(mandatesSummary?.remittancesPendingCount !== 1) ? "S" : ""} AWAITING TRANSFER</p>
                </div>
              </div>

              {/* Letter Pending Upload */}
              <div className="py-6 px-6 lg:py-8 lg:px-8 flex flex-col justify-between relative overflow-hidden group/card bg-white/[0.02]">
                <div className="absolute -bottom-10 -right-10 opacity-5 text-amber-500 pointer-events-none transition-transform duration-700 group-hover/card:scale-110">
                  <IconFileText size={140} stroke={1} />
                </div>
                <span className="text-xs font-medium text-slate-300 relative z-10">Letter Pending Upload</span>
                <div className="flex flex-col relative z-10 mt-4">
                  <span className="font-mono text-4xl font-medium text-white">{mandates.filter((m) => m.paperworkStatus === "pending_upload").length}</span>
                  <p className="text-xxs font-medium uppercase tracking-widest text-amber-400 mt-1">MANDATE LETTER NOT ON FILE</p>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Total Leases */}
              <div className="py-6 px-6 lg:py-8 lg:px-8 flex flex-col justify-between relative overflow-hidden group/card">
                <div className="absolute -bottom-10 -right-10 opacity-5 text-emerald-500 pointer-events-none transition-transform duration-700 group-hover/card:scale-110">
                  <IconFileText size={140} stroke={1} />
                </div>
                <span className="text-xs font-medium text-slate-300 relative z-10">Total Leases</span>
                <div className="relative z-10 mt-4">
                  <span className="font-mono text-4xl font-medium text-white">{kpis.total}</span>
                  {kpis.total > 0 && (
                    <>
                      <div className="mt-3 flex h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                        {kpis.statusBreakdown.overdue > 0 && (
                          <div className="h-full bg-rose-400" style={{ width: `${(kpis.statusBreakdown.overdue / kpis.total) * 100}%` }} />
                        )}
                        {kpis.statusBreakdown.expiringSoon > 0 && (
                          <div className="h-full bg-amber-400" style={{ width: `${(kpis.statusBreakdown.expiringSoon / kpis.total) * 100}%` }} />
                        )}
                        {kpis.statusBreakdown.healthy > 0 && (
                          <div className="h-full bg-emerald-400" style={{ width: `${(kpis.statusBreakdown.healthy / kpis.total) * 100}%` }} />
                        )}
                        {kpis.statusBreakdown.inactive > 0 && (
                          <div className="h-full bg-slate-500" style={{ width: `${(kpis.statusBreakdown.inactive / kpis.total) * 100}%` }} />
                        )}
                      </div>
                      <div className="mt-2 flex items-center gap-2.5 flex-wrap">
                        <span className="flex items-center gap-1 text-xxs font-medium uppercase tracking-wider text-rose-400">
                          <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />{kpis.statusBreakdown.overdue} overdue
                        </span>
                        <span className="flex items-center gap-1 text-xxs font-medium uppercase tracking-wider text-amber-400">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />{kpis.statusBreakdown.expiringSoon} expiring
                        </span>
                        <span className="flex items-center gap-1 text-xxs font-medium uppercase tracking-wider text-emerald-400">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />{kpis.statusBreakdown.healthy} healthy
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Active Tenancies */}
              <div className="py-6 px-6 lg:py-8 lg:px-8 flex flex-col justify-between relative overflow-hidden group/card bg-white/[0.02]">
                <div className="absolute -bottom-10 -right-10 opacity-5 text-indigo-500 pointer-events-none transition-transform duration-700 group-hover/card:scale-110">
                  <IconUserCircle size={140} stroke={1} />
                </div>
                <span className="text-xs font-medium text-slate-300 relative z-10">Active Tenancies</span>
                <div className="flex flex-col relative z-10 mt-4">
                  <span className="font-mono text-4xl font-medium text-white">{kpis.active}</span>
                  <p className="text-xs font-medium uppercase tracking-widest text-emerald-400 mt-1">{kpis.rate.toFixed(1)}% OF PORTFOLIO</p>
                </div>
              </div>

              {/* Occupancy Rate — radial gauge */}
              <div className="py-6 px-6 lg:py-8 lg:px-8 flex items-center gap-6 relative overflow-hidden group/card">
                <div className="relative z-10 flex gap-4 w-full items-center">
                  <svg width="60" height="60" viewBox="0 0 64 64" className="shrink-0">
                    <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="7" />
                    <circle cx="32" cy="32" r="26" fill="none" stroke="#f3df27" strokeWidth="7" strokeLinecap="round" strokeDasharray={`${((kpis.rate / 100) * 163.4).toFixed(1)} 163.4`} transform="rotate(-90 32 32)" />
                  </svg>
                  <div className="flex flex-col py-1 w-full">
                    <p className="text-xs font-medium text-slate-300">Occupancy Rate</p>
                    <span className="font-mono text-3xl font-medium text-white">{kpis.rate.toFixed(0)}%</span>
                    <p className="text-xs font-medium uppercase tracking-widest text-emerald-400">{kpis.active} OF {kpis.total} LEASES</p>
                  </div>
                </div>
              </div>

              {/* Monthly Rent Pool */}
              <div className="py-6 px-6 lg:py-8 lg:px-8 flex flex-col justify-between relative overflow-hidden group/card bg-white/[0.02]">
                <div className="absolute -bottom-10 -right-10 opacity-5 text-indigo-500 pointer-events-none transition-transform duration-700 group-hover/card:scale-110">
                  <IconWallet size={140} stroke={1} />
                </div>
                <span className="text-xs font-medium text-slate-300 relative z-10">Monthly Rent Pool</span>
                <div className="flex flex-col relative z-10 mt-4">
                  <span className="font-mono text-3xl font-medium text-white">{formatCompactKES(kpis.rentPool)}</span>
                  <p className="text-xs font-medium uppercase tracking-widest text-slate-400 mt-1">CONTRACTED — ACTIVE ONLY</p>
                </div>
              </div>

              {/* Overdue Balance */}
              <div className="py-6 px-6 lg:py-8 lg:px-8 flex flex-col justify-between relative overflow-hidden group/card">
                <div className="absolute -bottom-10 -right-10 opacity-5 text-rose-500 pointer-events-none transition-transform duration-700 group-hover/card:scale-110">
                  <IconAlertTriangle size={140} stroke={1} />
                </div>
                <span className="text-xs font-medium text-slate-300 relative z-10">Overdue Balance</span>
                <div className="flex flex-col relative z-10 mt-4">
                  <span className="font-mono text-3xl font-medium text-white">{formatCompactKES(kpis.overdueBalance)}</span>
                  <p className="text-xs font-medium uppercase tracking-widest text-rose-400 mt-1">{kpis.overdueCount} TENANT{kpis.overdueCount === 1 ? "" : "S"} IN ARREARS</p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {
        mode === "leases" && kpis.expiringSoon > 0 && (
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
        )
      }

      <div className="flex items-center gap-4 my-6">
        <hr className="flex-1 border-slate-200/60" />
        <span className="label-caps text-slate-600 tracking-wider">Featured & Highlights</span>
        <hr className="flex-1 border-slate-200/60" />
      </div>

      {/* ── Flagship Highlight ── */}
      {featuredItems.length > 0 && (
        <div className="gsap-stagger mb-8 relative">
          <div className="bg-white border border-slate-100 rounded-[32px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden flex flex-col lg:flex-row group transition-all duration-500 hover:shadow-[0_16px_40px_rgb(0,0,0,0.06)] relative z-10">
            {/* Left side Image with Gradient overlay */}
            <div className="lg:w-[35%] shrink-0 relative min-h-[320px] lg:min-h-0 bg-slate-50">
              <div className="absolute top-5 left-5 z-20">
                <span className="bg-[#151936] flex items-center gap-1.5 text-[#f3df27] px-2.5 py-1 rounded-lg text-xs font-medium uppercase tracking-wider shadow-sm">
                  <IconStarFilled size={12} className="text-[#f3df27] shrink-0" /> {mode === "mandates" ? "Flagship Mandate" : "Newest Active Lease"}
                </span>
              </div>

              {(mode === "mandates" ? featuredMandates[safeFeaturedIndex].propertyMedia?.[0]?.url : latestLeases[safeFeaturedIndex].propertyMedia?.[0]?.url) ? (
                <Image
                  src={(mode === "mandates" ? featuredMandates[safeFeaturedIndex].propertyMedia![0].url : latestLeases[safeFeaturedIndex].propertyMedia![0].url)}
                  alt={mode === "mandates" ? featuredMandates[safeFeaturedIndex].propertyName : latestLeases[safeFeaturedIndex].propertyName}
                  fill
                  sizes="(max-width: 1024px) 100vw, 35vw"
                  className="object-cover transition-transform duration-1000 group-hover:scale-105"
                  priority
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-900 to-emerald-950 flex items-center justify-center">
                  <IconBuildingCommunity size={64} className="text-emerald-800/50" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/20 to-transparent" />

              {/* Image Overlay Data */}
              <div className="absolute bottom-6 left-6 right-6">
                <p className="mono-data text-xs text-slate-300 font-mono mb-1">
                  {mode === "mandates" ? getMandateDisplayCode(featuredMandates[safeFeaturedIndex]) : latestLeases[safeFeaturedIndex].propertyCode}
                </p>
                <h3 className="text-2xl font-serif text-white font-medium">
                  {mode === "mandates" ? featuredMandates[safeFeaturedIndex].propertyName : latestLeases[safeFeaturedIndex].propertyName}
                </h3>
              </div>
            </div>

            {/* Right Side Info */}
            <div className="flex-1 p-8 lg:p-10 flex flex-col justify-center relative bg-white overflow-hidden">
              <div className="absolute -top-32 -right-32 opacity-[0.02] text-[#151936] pointer-events-none">
                {mode === "mandates" ? <IconBriefcase size={400} stroke={0.5} /> : <IconFileCertificate size={400} stroke={0.5} />}
              </div>

              {mode === "mandates" && featuredMandateFinancials ? (
                <div className="relative z-10 flex flex-col h-full justify-between">
                  {/* Status & Management Fee Row */}
                  <div className="flex items-center gap-3">
                    <Badge tone="success">Active</Badge>
                    <span className="text-xs text-slate-600 font-mono tracking-wider uppercase">
                      {(parseFloat(featuredMandates[safeFeaturedIndex].mandateRate) * 100).toFixed(1)}% Management Fee
                    </span>
                  </div>

                  {/* Progress Bar (Collected vs Expected) */}
                  <div className="my-8">
                    {featuredMandateFinancials.hasActiveLeases ? (
                      <>
                        <div className="flex items-center justify-between text-xs text-slate-600 font-mono tracking-wider mb-2">
                          <span>JUNE COLLECTION — COLLECTED VS EXPECTED</span>
                          <span className="font-medium text-slate-900">{featuredMandateFinancials.pct}%</span>
                        </div>
                        <div className="h-2 bg-slate-200/60 rounded-full overflow-hidden w-full">
                          <div
                            style={{ width: `${featuredMandateFinancials.pct}%` }}
                            className={cn(
                              "h-full rounded-full transition-all duration-500",
                              featuredMandateFinancials.pct >= 100
                                ? "bg-emerald-500"
                                : featuredMandateFinancials.pct >= 80
                                  ? "bg-emerald-400"
                                  : featuredMandateFinancials.pct >= 50
                                    ? "bg-amber-400"
                                    : featuredMandateFinancials.pct > 0
                                      ? "bg-red-400"
                                      : "bg-transparent"
                            )}
                          />
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-sm font-medium text-slate-800 font-mono">
                            {formatCompactKES(featuredMandateFinancials.collected)} collected
                          </span>
                          <span className="text-sm text-slate-600 font-mono">
                            of {formatCompactKES(featuredMandateFinancials.expected)} expected
                          </span>
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center justify-between text-xs text-slate-600 font-mono tracking-wider">
                        <span>JUNE COLLECTION — COLLECTED VS EXPECTED</span>
                        <span className="font-medium text-slate-500">No active leases</span>
                      </div>
                    )}
                  </div>

                  {/* Landlord & Manager Avatars Row (Interactive Buttons) */}
                  <div className="flex flex-wrap items-center gap-6 mb-6">
                    {/* Landlord */}
                    <button
                      type="button"
                      onClick={() => openLandlordProfile(featuredMandates[safeFeaturedIndex])}
                      className="flex items-center gap-3 hover:bg-slate-50 transition-colors p-1.5 rounded-2xl text-left border border-transparent hover:border-slate-100/80 group/avatar shrink-0"
                    >
                      <Avatar
                        src={featuredMandates[safeFeaturedIndex].landlordAvatarUrl || undefined}
                        fallback={getInitials(featuredMandates[safeFeaturedIndex].landlordName)}
                        className="size-10 bg-slate-100 text-slate-700 text-xs font-medium border border-slate-200"
                      />
                      <div>
                        <p className="text-sm font-medium text-slate-800 leading-tight group-hover/avatar:text-[#151936] transition-colors">
                          {featuredMandates[safeFeaturedIndex].landlordName}
                        </p>
                        <p className="text-xs text-slate-600 tracking-wider font-mono uppercase mt-0.5">
                          Landlord
                        </p>
                      </div>
                    </button>

                    {/* Manager */}
                    {featuredMandates[safeFeaturedIndex].managerName ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (featuredMandates[safeFeaturedIndex].assignedPmId) {
                            setManagerDrawerId(featuredMandates[safeFeaturedIndex].assignedPmId);
                          }
                        }}
                        className="flex items-center gap-3 hover:bg-slate-50 transition-colors p-1.5 rounded-2xl text-left border border-transparent hover:border-slate-100/80 group/avatar shrink-0"
                      >
                        <Avatar
                          src={featuredMandates[safeFeaturedIndex].managerAvatarUrl || undefined}
                          fallback={getInitials(featuredMandates[safeFeaturedIndex].managerName || "Unassigned")}
                          className="size-10 bg-slate-100 text-slate-700 text-xs font-medium border border-slate-200"
                        />
                        <div>
                          <p className="text-sm font-medium text-slate-800 leading-tight group-hover/avatar:text-[#151936] transition-colors">
                            {featuredMandates[safeFeaturedIndex].managerName}
                          </p>
                          <p className="text-xs text-slate-600 tracking-wider font-mono uppercase mt-0.5">
                            Property Manager
                          </p>
                        </div>
                      </button>
                    ) : (
                      <div className="flex items-center gap-3 p-1.5 shrink-0">
                        <Avatar
                          fallback="??"
                          className="size-10 bg-slate-100 text-slate-300 text-xs font-medium border border-slate-200"
                        />
                        <div>
                          <p className="text-sm font-medium text-slate-600 leading-tight">
                            Unassigned
                          </p>
                          <p className="text-xs text-slate-600 tracking-wider font-mono uppercase mt-0.5">
                            Property Manager
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Remittance & Action Buttons Row */}
                  <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pt-6 border-t border-slate-100">
                    <div>
                      <p className="text-xs text-slate-600 font-mono tracking-wider uppercase mb-1">
                        Remittance Due to Landlord
                      </p>
                      <p className="text-3xl font-medium text-slate-900 font-mono">
                        {formatCompactKES(featuredMandateFinancials.remittanceDue)}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      {featuredItems.length > 1 && (
                        <div className="flex items-center gap-1.5 mr-2">
                          <button onClick={() => setFeaturedIndex((i) => (i === 0 ? featuredItems.length - 1 : i - 1))} className="size-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors">
                            <IconChevronLeft size={16} />
                          </button>
                          <button onClick={() => setFeaturedIndex((i) => (i === featuredItems.length - 1 ? 0 : i + 1))} className="size-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors">
                            <IconChevronRight size={16} />
                          </button>
                        </div>
                      )}
                      <Button
                        onClick={() => openRemittanceAdvice(featuredMandates[safeFeaturedIndex])}
                        className="bg-[#151936] text-white hover:bg-opacity-90 transition rounded-xl px-4 h-9 text-sm font-medium flex items-center gap-1.5"
                      >
                        <IconFileText size={16} /> Remittance Advice
                      </Button>
                      <Link href={`/admin/mandates/${featuredMandates[safeFeaturedIndex].id}`}>
                        <Button className="bg-[#122a20] text-white hover:bg-opacity-90 transition rounded-xl px-4 h-9 text-sm font-medium flex items-center gap-1.5">
                          <IconArrowUpRight size={16} /> Open Mandate File
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              ) : latestLeases.length > 0 ? (() => {
                const fl = latestLeases[safeFeaturedIndex];
                const tenurePct = getLeaseTenurePct(fl);
                const daysLeft = getDaysRemaining(fl.endsAt);
                const tenurePctColor = tenurePct <= 50 ? "bg-emerald-400" : tenurePct <= 75 ? "bg-amber-400" : tenurePct <= 90 ? "bg-orange-400" : "bg-red-400";
                const tenurePctTextColor = tenurePct <= 50 ? "text-emerald-600" : tenurePct <= 75 ? "text-amber-600" : "text-red-500";
                return (
                  <div className="relative z-10 flex flex-col h-full justify-between">
                    {/* Status row */}
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs text-slate-600 font-mono tracking-wider uppercase">
                        {fl.propertyName}
                      </span>
                      <span className="border border-emerald-500/25 bg-emerald-500/10 text-emerald-600 text-xs px-2.5 py-0.5 rounded-full font-medium tracking-wider uppercase shrink-0">
                        Active
                      </span>
                    </div>

                    {/* Key metrics grid */}
                    <div className="grid grid-cols-2 gap-6 my-6">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-widest text-slate-500 mb-1">Monthly Rent</p>
                        <p className="font-mono text-2xl text-slate-900 tracking-tight font-medium">{formatCompactKES(parseFloat(fl.monthlyRentKes))}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium uppercase tracking-widest text-slate-500 mb-1">Security Deposit</p>
                        <p className="font-mono text-2xl text-slate-700 tracking-tight font-medium">{fl.depositKes ? formatCompactKES(parseFloat(fl.depositKes)) : "—"}</p>
                      </div>
                    </div>

                    {/* Tenure progress bar */}
                    <div className="mb-6">
                      <div className="flex items-center justify-between text-xs text-slate-500 font-mono tracking-wider mb-2">
                        <span>LEASE TENURE — {tenurePct}% ELAPSED</span>
                        <span className={tenurePctTextColor + " font-medium"}>{daysLeft}d remaining</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden w-full">
                        <div
                          style={{ width: `${tenurePct}%` }}
                          className={tenurePctColor + " h-full rounded-full transition-all duration-500"}
                        />
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-slate-600 font-mono">{formatDate(fl.startsAt)}</span>
                        <span className="text-xs text-slate-600 font-mono">{formatDate(fl.endsAt)}</span>
                      </div>
                    </div>

                    {/* Tenant & Manager Avatars Row (Interactive Buttons) - mirrors Mandates mode's Landlord & Manager row exactly */}
                    <div className="flex flex-wrap items-center gap-6 mb-6">
                      <button
                        type="button"
                        onClick={() => setTenantDrawerId(fl.tenantContactId)}
                        className="flex items-center gap-3 hover:bg-slate-50 transition-colors p-1.5 rounded-2xl text-left border border-transparent hover:border-slate-100/80 group/avatar shrink-0"
                      >
                        <Avatar
                          src={fl.tenantAvatarUrl || undefined}
                          fallback={getInitials(fl.tenantName)}
                          className="size-10 bg-slate-100 text-slate-700 text-xs font-medium border border-slate-200"
                        />
                        <div>
                          <p className="text-sm font-medium text-slate-800 leading-tight group-hover/avatar:text-[#151936] transition-colors">
                            {fl.tenantName}
                          </p>
                          <p className="text-xs text-slate-600 tracking-wider font-mono uppercase mt-0.5">
                            Tenant
                          </p>
                        </div>
                      </button>

                      {fl.managerName ? (
                        <button
                          type="button"
                          onClick={() => {
                            if (fl.managerId) setManagerDrawerId(fl.managerId);
                          }}
                          className="flex items-center gap-3 hover:bg-slate-50 transition-colors p-1.5 rounded-2xl text-left border border-transparent hover:border-slate-100/80 group/avatar shrink-0"
                        >
                          <Avatar
                            src={fl.managerAvatarUrl || undefined}
                            fallback={getInitials(fl.managerName)}
                            className="size-10 bg-slate-100 text-slate-700 text-xs font-medium border border-slate-200"
                          />
                          <div>
                            <p className="text-sm font-medium text-slate-800 leading-tight group-hover/avatar:text-[#151936] transition-colors">
                              {fl.managerName}
                            </p>
                            <p className="text-xs text-slate-600 tracking-wider font-mono uppercase mt-0.5">
                              Property Manager
                            </p>
                          </div>
                        </button>
                      ) : (
                        <div className="flex items-center gap-3 p-1.5 shrink-0">
                          <Avatar
                            fallback="??"
                            className="size-10 bg-slate-100 text-slate-300 text-xs font-medium border border-slate-200"
                          />
                          <div>
                            <p className="text-sm font-medium text-slate-600 leading-tight">
                              Unassigned
                            </p>
                            <p className="text-xs text-slate-600 tracking-wider font-mono uppercase mt-0.5">
                              Property Manager
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Action row */}
                    <div className="flex items-center justify-between border-t border-slate-100 pt-4">
                      <p className="text-xs text-slate-500 font-mono">{fl.propertyCode}</p>
                      <div className="flex items-center gap-3">
                        {featuredItems.length > 1 && (
                          <div className="flex items-center gap-1.5 mr-2">
                            <button onClick={() => setFeaturedIndex((i) => (i === 0 ? featuredItems.length - 1 : i - 1))} className="size-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors">
                              <IconChevronLeft size={16} />
                            </button>
                            <button onClick={() => setFeaturedIndex((i) => (i === featuredItems.length - 1 ? 0 : i + 1))} className="size-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors">
                              <IconChevronRight size={16} />
                            </button>
                          </div>
                        )}
                        <Link href={`/admin/leases/${fl.id}`}>
                          <Button className="bg-[#151936] text-white hover:bg-[#151936]/90 px-4 h-9 rounded-xl font-medium flex items-center gap-1.5">
                            View <IconArrowRight size={16} />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })() : (
                <div className="relative z-10 flex items-center justify-center h-full">
                  <p className="text-slate-600 text-sm">No active leases found.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Decision Queue for Pending Mandates ── */}
      {mode === "mandates" && pendingApprovalMandates.length > 0 && (
        <div className="gsap-stagger mb-8 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pendingApprovalMandates.map((m, idx) => (
              <div
                key={m.id}
                className="border border-amber-200 bg-amber-500/[0.04] rounded-2xl p-4 flex items-center justify-between gap-4 shadow-sm hover:shadow-md transition-all duration-300"
              >
                <div className="flex items-center gap-3">
                  <div className="bg-amber-100 text-amber-700 size-9 rounded-xl flex items-center justify-center shrink-0 shadow-xs">
                    <IconFileCertificate size={18} />
                  </div>
                  <div>
                    <h5 className="text-sm font-medium text-slate-800">
                      {idx % 2 === 0 ? "Pending GM step" : "Awaiting your decision"} — {m.propertyName}
                    </h5>
                    <p className="text-xs text-slate-600 mt-1 font-mono tracking-wider">
                      {getMandateDisplayCode(m)} · {m.landlordName} · {(parseFloat(m.mandateRate) * 100).toFixed(1)}%
                    </p>
                  </div>
                </div>
                <Link href={`/admin/mandates/${m.id}`}>
                  <Button
                    size="sm"
                    className={cn(
                      "font-medium text-xs rounded-xl px-4 py-1.5 shadow-sm whitespace-nowrap",
                      idx % 2 === 0
                        ? "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-xs"
                        : "bg-[#151936] text-white hover:bg-opacity-90"
                    )}
                  >
                    {idx % 2 === 0 ? "Decide Directly" : "Review"}
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Needs Attention: overdue balances + leases ending soon ── */}
      {mode === "leases" && leasesNeedingAttention.length > 0 && (
        <div className="gsap-stagger mb-8 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {leasesNeedingAttention.map(({ lease: l, kind }) => {
              const overdue = kind === "overdue";
              const daysLeft = getDaysRemaining(l.endsAt);
              return (
                <div
                  key={`${kind}-${l.id}`}
                  className={cn(
                    "border rounded-2xl p-4 flex items-center justify-between gap-4 shadow-sm hover:shadow-md transition-all duration-300",
                    overdue ? "border-rose-200 bg-rose-500/[0.04]" : "border-amber-200 bg-amber-500/[0.04]"
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={cn(
                      "size-9 rounded-xl flex items-center justify-center shrink-0 shadow-xs",
                      overdue ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"
                    )}>
                      {overdue ? <IconAlertTriangle size={18} /> : <IconCalendarClock size={18} />}
                    </div>
                    <div className="min-w-0">
                      <h5 className="text-sm font-medium text-slate-800 truncate">
                        {overdue ? `Overdue: ${l.tenantName}` : `Ending soon: ${l.tenantName}`} — {l.propertyName}
                      </h5>
                      <p className="text-xs text-slate-600 mt-1 font-mono tracking-wider">
                        {overdue
                          ? `${formatCompactKES(l.balanceKes ?? 0)} outstanding this month`
                          : `${daysLeft}d remaining · renewal decision needed`}
                      </p>
                    </div>
                  </div>
                  <Link href={`/admin/leases/${l.id}`}>
                    <Button
                      size="sm"
                      className={cn(
                        "font-medium text-xs rounded-xl px-4 py-1.5 shadow-sm whitespace-nowrap",
                        overdue ? "bg-[#151936] text-white hover:bg-opacity-90" : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-xs"
                      )}
                    >
                      {overdue ? "Follow Up" : "Review Lease"}
                    </Button>
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex items-center gap-4 my-6">
        <hr className="flex-1 border-slate-200/60" />
        <span className="label-caps text-slate-600 tracking-wider">
          {mode === "mandates" ? "Mandate Register" : "Lease Inventory"}
        </span>
        <hr className="flex-1 border-slate-200/60" />
      </div>

      <div className="bg-transparent lg:bg-white/70 border-transparent lg:border-slate-100 p-0 lg:p-8 rounded-none lg:rounded-[24px] shadow-none lg:shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col">
        {mode === "mandates" ? (
          <div className="flex flex-col">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 lg:pb-5 mb-4 lg:mb-5">
              <div className="w-full md:w-auto md:flex-1 max-w-md">
                <div className="relative flex items-center group w-full">
                  <IconSearch
                    size={16}
                    className="absolute left-3.5 text-slate-600 group-focus-within:text-[#151936] transition-colors"
                  />
                  <input
                    value={query}
                    onChange={(e) => { setQuery(e.target.value); setPage(1); }}
                    placeholder="Search landlord, property, ref..."
                    className="w-full bg-slate-50 border border-slate-200/60 rounded-xl pl-10 pr-4 py-2.5 body-sm text-slate-900 outline-none placeholder:text-slate-600 focus:bg-white focus:ring-2 focus:ring-[#151936]/10 focus:border-[#151936]/30 transition-all shadow-sm"
                  />
                  {query && (
                    <button onClick={() => setQuery("")} className="absolute right-3 text-slate-300 hover:text-slate-600 transition-colors">
                      <IconX size={14} />
                    </button>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex bg-slate-100 p-1 rounded-xl shrink-0 overflow-x-auto custom-scrollbar">
                  {[
                    { key: "all", label: "All", count: mandates.length },
                    { key: "active", label: "Active", count: mandates.filter((m) => m.status === "active").length },
                    { key: "pending_gm", label: "Pending GM", count: mandates.filter((m) => m.status === "pending_approval" && m.id.charCodeAt(0) % 2 === 0).length },
                    { key: "pending_ceo", label: "Pending CEO", count: mandates.filter((m) => m.status === "pending_approval" && m.id.charCodeAt(0) % 2 !== 0).length },
                    { key: "draft", label: "Draft", count: mandates.filter((m) => m.status === "draft").length },
                    { key: "terminated", label: "Terminated", count: mandates.filter((m) => m.status === "terminated").length },
                  ].map((pill) => (
                    <button
                      key={pill.key}
                      onClick={() => { setMandateStatusFilter(pill.key); setPage(1); }}
                      className={cn(
                        "px-3 py-1.5 text-xs rounded-lg transition-colors whitespace-nowrap font-medium flex items-center gap-1.5",
                        mandateStatusFilter === pill.key ? "bg-[#151936] text-white shadow-sm font-medium" : "text-slate-600 hover:text-slate-700"
                      )}
                    >
                      {pill.label} <span className={cn("text-xxs font-mono px-1 py-0.2 rounded bg-slate-200/80 text-slate-600", mandateStatusFilter === pill.key && "bg-white/20 text-white")}>{pill.count}</span>
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => { setPaperworkOnly((v) => !v); setPage(1); }}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium border transition-colors shrink-0 whitespace-nowrap",
                    paperworkOnly ? "bg-amber-50 border-amber-200 text-amber-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  )}
                >
                  <IconFileText size={13} /> Letter pending only
                </button>

                <div className="hidden md:flex bg-slate-100 p-1 rounded-xl shrink-0">
                  <button
                    onClick={() => setViewMode("grid")}
                    className={cn(
                      "p-1.5 rounded-lg transition-colors",
                      viewMode === "grid" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-700"
                    )}
                    aria-label="Grid view"
                  >
                    <IconLayoutGrid size={16} />
                  </button>
                  <button
                    onClick={() => setViewMode("list")}
                    className={cn(
                      "p-1.5 rounded-lg transition-colors",
                      viewMode === "list" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-700"
                    )}
                    aria-label="List view"
                  >
                    <IconList size={16} />
                  </button>
                </div>
              </div>
            </div>

            {mandatesLoading ? (
              <ListRowsSkeleton />
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
                            <p className="label-caps text-slate-600 mb-1 block">Landlord</p>
                            <span className="body-md text-slate-900 font-medium">{m.landlordName}</span>
                          </div>
                          <Badge tone={MANDATE_STATUS_TONE[m.status]}>{MANDATE_STATUS_LABEL[m.status]}</Badge>
                        </div>

                        <div className="space-y-2 border-t border-slate-50 pt-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <p className="label-caps text-slate-600 mb-1">Property</p>
                              <div className="flex items-center gap-1.5 text-slate-700">
                                <PropIcon size={16} className="text-slate-600" />
                                <span className="body-sm font-medium text-slate-700 truncate block max-w-[140px]">{m.propertyName}</span>
                              </div>
                            </div>
                            <div>
                              <p className="label-caps text-slate-600 mb-1">Rate</p>
                              <span className="body-sm text-slate-800 block font-mono">{(parseFloat(m.mandateRate) * 100).toFixed(1)}%</span>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3 pt-1">
                            <div>
                              <p className="label-caps text-slate-600 mb-1">Manager</p>
                              <span className="body-sm text-slate-700 block truncate">{m.managerName ?? "Unassigned"}</span>
                            </div>
                            <div>
                              <p className="label-caps text-slate-600 mb-1">Remittance</p>
                              {m.pendingRemittanceId ? <Badge tone="warning">Pending</Badge> : <span className="body-sm text-slate-600">-</span>}
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3 pt-1">
                            <div>
                              <p className="label-caps text-slate-600 mb-1">Paperwork</p>
                              <Badge tone={MANDATE_LETTER_STATUS_META[m.paperworkStatus].tone}>{MANDATE_LETTER_STATUS_META[m.paperworkStatus].label}</Badge>
                            </div>
                            <div>
                              <p className="label-caps text-slate-600 mb-1">Origin</p>
                              <span className="body-sm text-slate-600 truncate block">{mandateOriginLabel(m.originValuation).label}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-50 mt-1" onClick={(e) => e.stopPropagation()}>
                          <span className="mono-data text-xs text-slate-600">{m.id.slice(0, 8).toUpperCase()}</span>
                          <div className="flex items-center gap-2">
                            {m.paperworkStatus === "pending_upload" ? (
                              <button
                                type="button"
                                onClick={() => setLetterModalTarget(m)}
                                className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs text-amber-700 hover:bg-amber-100 transition-colors"
                              >
                                <IconFileText size={12} /> Attach Letter
                              </button>
                            ) : m.status === "pending_approval" ? (
                              <Link href="/admin/approvals" className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-200 transition-colors">
                                Review
                              </Link>
                            ) : null}
                          <DropdownMenu label="Mandate actions" align="right" trigger={
                            <span className="size-8 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-600 hover:text-slate-700 hover:bg-slate-100 transition-colors">
                              <IconDotsVertical size={16} />
                            </span>
                          }>
                            <DropdownItem icon={IconUserCircle} onClick={() => openLandlordProfile(m)}>Landlord Profile</DropdownItem>
                            <Link href="/admin/messages"><DropdownItem icon={IconMessageCircle}>Message Manager</DropdownItem></Link>
                            {m.status === "active" && (
                              <DropdownItem icon={IconFileText} onClick={() => openRemittanceAdvice(m)}>Remittance Advice</DropdownItem>
                            )}
                            {(m.status === "active" || m.status === "pending_approval") && (
                              <DropdownItem icon={IconBan} variant="danger" onClick={() => setTerminatingMandate(m)}>Terminate Mandate</DropdownItem>
                            )}
                          </DropdownMenu>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop View */}
                {viewMode === "grid" ? (
                  <div className="hidden lg:grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {visibleMandates.map((m) => {
                      const pct = getMandatePct(m);
                      const rate = parseFloat(m.mandateRate) || 0.08;
                      const collected = m.currentPeriodCollected ?? 0;
                      const remittanceDue = collected * (1 - rate);
                      const remittanceDisplay = m.status === "active" && collected > 0 ? formatCompactKES(remittanceDue) : "—";
                      const statusLabel = m.status === "pending_approval"
                        ? (m.id.charCodeAt(0) % 2 === 0 ? "PENDING GM" : "PENDING CEO")
                        : (MANDATE_STATUS_LABEL[m.status] ?? m.status).toUpperCase();
                      const pmInitials = m.managerName ? getInitials(m.managerName) : "??";
                      const pctColor = pct >= 100 ? "bg-emerald-500" : pct >= 80 ? "bg-emerald-400" : pct >= 50 ? "bg-amber-400" : pct > 0 ? "bg-red-400" : "bg-transparent";
                      const pctTextColor = pct >= 100 ? "text-emerald-600" : pct >= 80 ? "text-emerald-500" : pct >= 50 ? "text-amber-500" : pct > 0 ? "text-red-500" : "text-slate-600";

                      return (
                        <div
                          key={m.id}
                          onClick={() => router.push(`/admin/mandates/${m.id}`)}
                          className="bg-white border border-slate-200/60 rounded-[24px] p-5 shadow-[0_4px_20px_rgb(0,0,0,0.03)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] hover:border-slate-300/60 transition-all duration-300 flex flex-col cursor-pointer group relative"
                        >
                          {/* Header: Identity & Status */}
                          <div className="flex items-start justify-between gap-4 mb-4">
                            <div className="flex items-center gap-3 min-w-0">
                              {m.propertyMedia?.[0]?.url ? (
                                <div className="size-12 rounded-[14px] overflow-hidden shrink-0 shadow-sm relative">
                                  <Image src={m.propertyMedia[0].url} alt={m.propertyName} fill className="object-cover" sizes="48px" />
                                </div>
                              ) : (
                                <div className="size-12 rounded-[14px] bg-slate-50 border border-slate-100 shrink-0 flex items-center justify-center text-slate-300 shadow-sm">
                                  <IconBuildingCommunity size={20} stroke={1.5} />
                                </div>
                              )}
                              <div className="flex flex-col min-w-0">
                                <h4 className="text-sm font-medium text-slate-800 leading-tight truncate">{m.propertyName}</h4>
                                <span className="text-xs font-mono text-slate-500 mt-0.5 tracking-wider uppercase">{getMandateDisplayCode(m)}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge tone={m.status === "active" ? "success" : m.status === "pending_approval" ? "warning" : "neutral"}>
                                {statusLabel}
                              </Badge>
                              <Badge tone={MANDATE_LETTER_STATUS_META[m.paperworkStatus].tone}>{MANDATE_LETTER_STATUS_META[m.paperworkStatus].label}</Badge>
                            </div>
                          </div>

                          {/* Actors Info */}
                          <div className="flex items-center gap-2.5 mb-4 bg-slate-50/50 p-2.5 rounded-xl border border-slate-100/50">
                            <Avatar src={m.landlordAvatarUrl || undefined} fallback={getInitials(m.landlordName)} className="size-7 text-xs bg-white text-slate-700 border border-slate-200 shrink-0 shadow-sm" />
                            <div className="flex flex-col min-w-0 flex-1">
                              <span className="text-sm font-medium text-slate-700 truncate">{m.landlordName}</span>
                              <span className="text-xs text-slate-400 truncate">Landlord Account</span>
                            </div>
                            {m.managerName && (
                              <>
                                <div className="w-px h-6 bg-slate-200 mx-1" />
                                <Avatar src={m.managerAvatarUrl || undefined} fallback={pmInitials} className="size-7 text-xs bg-[#151936] text-white border border-[#151936]/20 shrink-0 shadow-sm" />
                              </>
                            )}
                          </div>

                          {/* Data Viz: Collection MTD */}
                          <div className="flex flex-col gap-1.5 mb-4">
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-slate-500 font-mono tracking-wider uppercase">Collection MTD</span>
                              <span className={cn("text-xs font-mono font-medium", pctTextColor)}>{pct}% Collected</span>
                            </div>
                            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                              <div style={{ width: `${pct}%` }} className={cn("h-full rounded-full transition-all duration-500", pctColor)} />
                            </div>
                            <div className="flex items-center justify-between mt-0.5">
                              <span className="text-xs text-slate-400 font-mono">01 {new Date().toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })}</span>
                              <span className="text-xs text-slate-400 font-mono">31 {new Date().toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })}</span>
                            </div>
                          </div>

                          {/* Financials Footer */}
                          <div className="mt-auto pt-4 border-t border-slate-100/80 flex items-end justify-between gap-4">
                            <div className="flex flex-col gap-0.5">
                              <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">Management Fee</span>
                              <div className="flex items-baseline gap-1">
                                <span className="font-mono text-md font-medium text-slate-800">{(parseFloat(m.mandateRate) * 100).toFixed(1)}%</span>
                              </div>
                            </div>

                            <div className="flex flex-col items-end gap-0.5 text-right">
                              <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">Remittance Due</span>
                              <span className={cn("font-mono text-sm font-medium", m.status === "active" && collected > 0 ? "text-emerald-600" : "text-slate-500")}>
                                {remittanceDisplay}
                              </span>
                              <span className="text-xxs text-slate-400 mt-0.5">{mandateOriginLabel(m.originValuation).label}</span>
                            </div>

                            <div className="absolute top-4 right-4 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                              {m.paperworkStatus === "pending_upload" ? (
                                <button
                                  type="button"
                                  onClick={() => setLetterModalTarget(m)}
                                  className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2 py-1 text-xxs text-amber-700 hover:bg-amber-100 transition-colors"
                                >
                                  <IconFileText size={11} /> Attach Letter
                                </button>
                              ) : m.status === "pending_approval" ? (
                                <Link href="/admin/approvals" className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-xxs text-slate-600 hover:bg-slate-200 transition-colors">
                                  Review
                                </Link>
                              ) : null}
                              <DropdownMenu label="Mandate actions" align="right" trigger={
                                <span className="size-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-700 hover:bg-slate-50 shadow-xs transition-colors">
                                  <IconDotsVertical size={14} />
                                </span>
                              }>
                                <DropdownItem icon={IconUserCircle} onClick={() => openLandlordProfile(m)}>Landlord Profile</DropdownItem>
                                <Link href="/admin/messages"><DropdownItem icon={IconMessageCircle}>Message Manager</DropdownItem></Link>
                                {m.status === "active" && (
                                  <DropdownItem icon={IconFileText} onClick={() => openRemittanceAdvice(m)}>Remittance Advice</DropdownItem>
                                )}
                                {(m.status === "active" || m.status === "pending_approval") && (
                                  <DropdownItem icon={IconBan} variant="danger" onClick={() => setTerminatingMandate(m)}>Terminate Mandate</DropdownItem>
                                )}
                              </DropdownMenu>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="hidden lg:block overflow-x-auto">
                    <table className="w-full min-w-[900px] text-left text-body-regular">
                      <thead>
                        <tr className="border-b border-slate-100 label-caps text-slate-600">
                          <th className="px-3 py-3">Landlord</th>
                          <th className="px-3 py-3">Property</th>
                          <th className="px-3 py-3">Manager</th>
                          <th className="px-3 py-3">Paperwork</th>
                          <th className="px-3 py-3">Origin</th>
                          <th className="px-3 py-3">Rate</th>
                          <th className="px-3 py-3">Collection</th>
                          <th className="px-3 py-3 text-right">Remittance</th>
                          <th className="px-3 py-3 text-center">Status</th>
                          <th className="px-3 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {visibleMandates.map((m) => {
                          const pct = getMandatePct(m);
                          const rate = parseFloat(m.mandateRate) || 0.08;
                          const collected = m.currentPeriodCollected ?? 0;
                          const remittanceDue = collected * (1 - rate);
                          const remittanceDisplay = m.status === "active" && collected > 0 ? formatCompactKES(remittanceDue) : "—";
                          const statusLabel = m.status === "pending_approval"
                            ? (m.id.charCodeAt(0) % 2 === 0 ? "PENDING GM" : "PENDING CEO")
                            : (MANDATE_STATUS_LABEL[m.status] ?? m.status).toUpperCase();

                          return (
                            <tr key={m.id} onClick={() => router.push(`/admin/mandates/${m.id}`)} className="transition-colors hover:bg-slate-50/40 group cursor-pointer">
                              {/* Landlord Column */}
                              <td className="px-3 py-4">
                                <div className="flex items-center gap-3">
                                  <Avatar
                                    src={m.landlordAvatarUrl || undefined}
                                    fallback={getInitials(m.landlordName)}
                                    className="size-9 bg-slate-50 text-slate-700 text-xs font-medium border border-slate-100 shrink-0"
                                  />
                                  <div>
                                    <p className="body-md text-slate-800 font-medium">{m.landlordName}</p>
                                    <p className="text-xs text-slate-600 font-mono tracking-wider uppercase mt-0.5">{(m.landlordCompanyName || "Individual Landlord").toUpperCase()}</p>
                                  </div>
                                </div>
                              </td>

                              {/* Property Column */}
                              <td className="px-3 py-4">
                                <div className="flex items-center gap-2.5">
                                  <div className="size-8 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-600 shrink-0 overflow-hidden relative">
                                    {m.propertyMedia?.[0]?.url ? (
                                      <Image
                                        src={m.propertyMedia[0].url}
                                        alt={m.propertyName}
                                        fill
                                        sizes="32px"
                                        className="object-cover"
                                      />
                                    ) : (
                                      <IconBuildingCommunity size={14} stroke={1.5} />
                                    )}
                                  </div>
                                  <div>
                                    <p className="body-md text-slate-800 font-medium">{m.propertyName}</p>
                                    <p className="mono-data text-xs text-slate-600 font-mono tracking-wide mt-0.5">{getMandateDisplayCode(m)}</p>
                                  </div>
                                </div>
                              </td>

                              {/* Manager Column */}
                              <td className="px-3 py-4">
                                <div className="flex items-center gap-2.5">
                                  {m.managerName ? (
                                    <>
                                      <Avatar
                                        src={m.managerAvatarUrl || undefined}
                                        fallback={getInitials(m.managerName)}
                                        className="size-6 text-xs bg-slate-100 text-slate-700 border border-slate-200/80 shrink-0"
                                      />
                                      <span className="body-sm text-slate-700 font-medium">{m.managerName}</span>
                                    </>
                                  ) : (
                                    <span className="text-slate-600 italic text-xs">Unassigned</span>
                                  )}
                                </div>
                              </td>

                              {/* Paperwork Column */}
                              <td className="px-3 py-4">
                                <Badge tone={MANDATE_LETTER_STATUS_META[m.paperworkStatus].tone}>{MANDATE_LETTER_STATUS_META[m.paperworkStatus].label}</Badge>
                              </td>

                              {/* Origin Column */}
                              <td className="px-3 py-4">
                                {(() => {
                                  const origin = mandateOriginLabel(m.originValuation);
                                  return origin.href ? (
                                    <Link href={origin.href} onClick={(e) => e.stopPropagation()} className="text-xs text-[#151936] hover:underline">
                                      {origin.label}
                                    </Link>
                                  ) : (
                                    <span className="text-xs text-slate-400">{origin.label}</span>
                                  );
                                })()}
                              </td>

                              {/* Rate Column */}
                              <td className="px-3 py-4 text-sm font-mono font-medium text-slate-700">{(parseFloat(m.mandateRate) * 100).toFixed(1)}%</td>

                              {/* Collection Column (Progress bar) */}
                              <td className="px-3 py-4">
                                <div className="w-40">
                                  <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                      style={{ width: `${pct}%` }}
                                      className={cn(
                                        "h-full rounded-full transition-all",
                                        pct >= 100 ? "bg-emerald-500" : pct > 0 ? "bg-amber-500" : "bg-transparent"
                                      )}
                                    />
                                  </div>
                                  <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-600 font-mono">
                                    <span>{pct}%</span>
                                    <span>·</span>
                                    <span>{m.status === "active" ? formatCompactKES(m.currentPeriodCollected ?? 0) : "KES 0"}</span>
                                  </div>
                                </div>
                              </td>

                              {/* Remittance Column */}
                              <td className="px-3 py-4 text-right mono-amount text-slate-900">
                                {remittanceDisplay}
                              </td>

                              {/* Status Column */}
                              <td className="px-3 py-4 text-center">
                                <Badge tone={m.status === "active" ? "success" : m.status === "pending_approval" ? "warning" : "neutral"}>
                                  {statusLabel}
                                </Badge>
                              </td>

                              {/* Actions Column */}
                              <td className="px-3 py-4" onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center justify-end gap-1.5">
                                  {m.paperworkStatus === "pending_upload" ? (
                                    <button
                                      type="button"
                                      onClick={() => setLetterModalTarget(m)}
                                      className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2.5 py-1 text-xs text-amber-700 hover:bg-amber-100 transition-colors"
                                    >
                                      <IconFileText size={12} /> Attach Letter
                                    </button>
                                  ) : m.status === "pending_approval" ? (
                                    <Link href="/admin/approvals" className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-200 transition-colors">
                                      Review
                                    </Link>
                                  ) : null}
                                  <DropdownMenu label="Mandate actions" align="right" trigger={
                                    <span className="size-8 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-600 hover:text-slate-700 hover:bg-slate-100 transition-colors opacity-0 group-hover:opacity-100">
                                      <IconDotsVertical size={16} />
                                    </span>
                                  }>
                                    <DropdownItem icon={IconUserCircle} onClick={() => openLandlordProfile(m)}>Landlord Profile</DropdownItem>
                                    <Link href="/admin/messages"><DropdownItem icon={IconMessageCircle}>Message Manager</DropdownItem></Link>
                                    {m.status === "active" && (
                                      <DropdownItem icon={IconFileText} onClick={() => openRemittanceAdvice(m)}>Remittance Advice</DropdownItem>
                                    )}
                                    {(m.status === "active" || m.status === "pending_approval") && (
                                      <DropdownItem icon={IconBan} variant="danger" onClick={() => setTerminatingMandate(m)}>Terminate Mandate</DropdownItem>
                                    )}
                                  </DropdownMenu>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

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
          <div className="flex flex-col">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 lg:pb-5 mb-4 lg:mb-5">
              <div className="w-full md:w-auto md:flex-1 max-w-md">
                <div className="relative flex items-center group w-full">
                  <IconSearch
                    size={16}
                    className="absolute left-3.5 text-slate-600 group-focus-within:text-[#151936] transition-colors"
                  />
                  <input
                    value={query}
                    onChange={(e) => { setQuery(e.target.value); setPage(1); }}
                    placeholder="Search leases by tenant, property, or code..."
                    className="w-full bg-slate-50 border border-slate-200/60 rounded-xl pl-10 pr-4 py-2.5 body-sm text-slate-900 outline-none placeholder:text-slate-600 focus:bg-white focus:ring-2 focus:ring-[#151936]/10 focus:border-[#151936]/30 transition-all shadow-sm"
                  />
                  {query && (
                    <button onClick={() => setQuery("")} className="absolute right-3 text-slate-300 hover:text-slate-600 transition-colors">
                      <IconX size={14} />
                    </button>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3 overflow-x-auto custom-scrollbar pb-2 md:pb-0 -mx-4 px-4 md:mx-0 md:px-0">
                <div className="flex bg-slate-100 p-1 rounded-xl shrink-0">
                  {([
                    { key: "all", label: "All", count: leases.length },
                    { key: "active", label: "Active", count: leases.filter((l) => l.isActive).length },
                    { key: "terminated", label: "Terminated", count: leases.filter((l) => !l.isActive).length },
                  ] as const).map((pill) => (
                    <button
                      key={pill.key}
                      onClick={() => { setStatusFilter(pill.key); setPage(1); }}
                      className={cn(
                        "px-3 py-1.5 text-xs rounded-lg transition-colors whitespace-nowrap font-medium flex items-center gap-1.5",
                        statusFilter === pill.key ? "bg-[#151936] text-white shadow-sm font-medium" : "text-slate-600 hover:text-slate-700"
                      )}
                    >
                      {pill.label} <span className={cn("text-xxs font-mono px-1 py-0.2 rounded bg-slate-200/80 text-slate-600", statusFilter === pill.key && "bg-white/20 text-white")}>{pill.count}</span>
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setFiltersOpen(!filtersOpen)}
                  className={cn(
                    "inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 body-sm rounded-xl transition-colors border shadow-sm shrink-0",
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
                <div className="hidden md:flex bg-slate-100 p-1 rounded-xl shrink-0">
                  <button
                    onClick={() => setLeaseViewMode("grid")}
                    className={cn(
                      "p-1.5 rounded-lg transition-colors",
                      leaseViewMode === "grid" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-700"
                    )}
                    aria-label="Grid view"
                  >
                    <IconLayoutGrid size={16} />
                  </button>
                  <button
                    onClick={() => setLeaseViewMode("list")}
                    className={cn(
                      "p-1.5 rounded-lg transition-colors",
                      leaseViewMode === "list" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-700"
                    )}
                    aria-label="List view"
                  >
                    <IconList size={16} />
                  </button>
                </div>
              </div>
            </div>

            {/* Advanced Filters Panel */}
            {filtersOpen && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-2xl border border-slate-100 bg-slate-50/60 p-4 mb-6">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="prop-type-filter" className="label-caps text-slate-600">
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
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="expiry-filter" className="label-caps text-slate-600">
                    Expiry window
                  </label>
                  <select
                    id="expiry-filter"
                    value={expiryFilter}
                    onChange={(e) => { setExpiryFilter(e.target.value as "all" | "30" | "60" | "90"); setPage(1); }}
                    className="bg-white border border-slate-200 rounded-xl px-3 py-2 body-sm outline-none focus:ring-2 focus:ring-[#151936]/10 focus:border-[#151936]/30"
                  >
                    <option value="all">Any duration</option>
                    <option value="30">Expiring in 30 days</option>
                    <option value="60">Expiring in 60 days</option>
                    <option value="90">Expiring in 90 days</option>
                  </select>
                </div>
                {hasActiveFilters && (
                  <div className="sm:col-span-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => { setStatusFilter("all"); setTypeFilter("all"); setExpiryFilter("all"); setPage(1); }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 body-sm text-slate-500 hover:text-rose-600 transition-colors"
                    >
                      <IconX size={14} /> Clear All Filters
                    </button>
                  </div>
                )}
              </div>
            )}

            {loading ? (
              <ListRowsSkeleton />
            ) : filtered.length === 0 ? (
              <EmptyState
                icon={IconFileText}
                title="No lease records found"
                description="Verify active filter criteria or register a new lease for a vacant property unit."
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
                        onClick={() => router.push(`/admin/leases/${l.id}`)}
                        className="p-5 bg-white border border-slate-100 rounded-2xl shadow-[0_2px_12px_rgb(0,0,0,0.04)] hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 flex flex-col gap-4 cursor-pointer"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <Avatar
                              src={l.tenantAvatarUrl || undefined}
                              fallback={getInitials(l.tenantName)}
                              className="size-9 bg-slate-50 text-slate-700 text-xs font-medium border border-slate-100 shrink-0"
                            />
                            <div>
                              <p className="body-md text-slate-800 font-medium">{l.tenantName}</p>
                              <span className="mono-data text-xs text-slate-600">{l.id.slice(0, 8).toUpperCase()}</span>
                            </div>
                          </div>
                          <Badge tone={l.isActive ? "success" : "neutral"}>
                            {l.isActive ? "Active" : "Terminated"}
                          </Badge>
                        </div>

                        <div className="space-y-2 border-t border-slate-50 pt-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <p className="label-caps text-slate-600 mb-1">Property</p>
                              <div className="flex items-center gap-1.5 text-slate-700">
                                <PropIcon size={16} className="text-slate-600" />
                                <span className="body-sm font-medium text-slate-700 truncate block max-w-[140px]">
                                  {l.propertyName}
                                </span>
                              </div>
                            </div>
                            <div>
                              <p className="label-caps text-slate-600 mb-1">Rates</p>
                              <span className="body-sm text-slate-800 block font-mono">
                                {formatCompactKES(parseFloat(l.monthlyRentKes))}/mo
                              </span>
                            </div>
                          </div>
                          <div className="pt-1">
                            <p className="label-caps text-slate-600 mb-1">Balance</p>
                            {(l.balanceKes ?? 0) > 0 ? (
                              <span className="body-sm font-mono text-rose-600 block">{formatCompactKES(l.balanceKes ?? 0)} overdue</span>
                            ) : (
                              <span className="text-xs font-medium text-emerald-600 uppercase tracking-wider">Current</span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-50 mt-1" onClick={(e) => e.stopPropagation()}>
                          <span className="mono-data text-xs text-slate-600 flex flex-col">
                            <span>{formatDate(l.startsAt)}</span>
                            <span className="text-xs text-slate-500 font-mono">to {formatDate(l.endsAt)}</span>
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleToggleFeature(l.propertyId, !!l.isFeatured)}
                              aria-label={l.isFeatured ? "Remove from featured" : "Add to featured"}
                              aria-pressed={!!l.isFeatured}
                              className={cn(
                                "size-8 rounded-lg flex items-center justify-center transition-colors",
                                l.isFeatured ? "bg-amber-400 text-[#151936]" : "bg-slate-50 border border-slate-100 text-slate-400 hover:text-amber-500 hover:bg-amber-50"
                              )}
                            >
                              {l.isFeatured ? <IconStarFilled size={14} /> : <IconStar size={14} />}
                            </button>
                            <DropdownMenu label="Lease actions" align="right" trigger={
                              <span className="size-8 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-600 hover:text-slate-700 hover:bg-slate-100 transition-colors">
                                <IconDotsVertical size={16} />
                              </span>
                            }>
                              <DropdownItem icon={IconUserCircle} onClick={() => setTenantDrawerId(l.tenantContactId)}>Tenant Profile</DropdownItem>
                              <Link href="/admin/messages"><DropdownItem icon={IconMessageCircle}>Message Manager</DropdownItem></Link>
                              <Link href={`/admin/leases/${l.id}`}><DropdownItem icon={IconFileText}>View Lease File</DropdownItem></Link>
                              {l.isActive && (
                                <DropdownItem icon={IconRefresh} onClick={() => setRenewingLease(l)}>Renew Lease</DropdownItem>
                              )}
                              <DropdownItem icon={IconCalendarClock} onClick={() => setEditingLease(l)}>Edit Lease</DropdownItem>
                              {l.isActive && (
                                <DropdownItem icon={IconBan} variant="danger" onClick={() => setTerminatingLease(l)}>Terminate Lease</DropdownItem>
                              )}
                            </DropdownMenu>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop: grid or list */}
                {leaseViewMode === "grid" ? (
                  <div className="hidden lg:grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {visible.map((l) => {
                      const tenurePct = getLeaseTenurePct(l);
                      const daysLeft = getDaysRemaining(l.endsAt);
                      const tenurePctColor = !l.isActive ? "bg-slate-300" : tenurePct <= 50 ? "bg-emerald-500" : tenurePct <= 75 ? "bg-amber-400" : tenurePct <= 90 ? "bg-orange-400" : "bg-red-400";
                      const tenurePctTextColor = !l.isActive ? "text-slate-600" : tenurePct <= 50 ? "text-emerald-600" : tenurePct <= 75 ? "text-amber-500" : "text-red-500";
                      return (
                        <div
                          key={l.id}
                          onClick={() => router.push(`/admin/leases/${l.id}`)}
                          className="bg-white border border-slate-200/60 rounded-[24px] p-5 shadow-[0_4px_20px_rgb(0,0,0,0.03)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] hover:border-slate-300/60 transition-all duration-300 flex flex-col cursor-pointer group relative"
                        >
                          {/* Header: Identity & Status */}
                          <div className="flex items-start justify-between gap-4 mb-4">
                            <div className="flex items-center gap-3 min-w-0">
                              {l.propertyMedia?.[0]?.url ? (
                                <div className="size-12 rounded-[14px] overflow-hidden shrink-0 shadow-sm relative">
                                  <Image src={l.propertyMedia[0].url} alt={l.propertyName} fill className="object-cover" sizes="48px" />
                                </div>
                              ) : (
                                <div className="size-12 rounded-[14px] bg-slate-50 border border-slate-100 shrink-0 flex items-center justify-center text-slate-300 shadow-sm">
                                  <IconBuildingCommunity size={20} stroke={1.5} />
                                </div>
                              )}
                              <div className="flex flex-col min-w-0">
                                <h4 className="text-sm font-medium text-slate-800 leading-tight truncate">{l.propertyName}</h4>
                                <span className="text-xs font-mono text-slate-400 mt-0.5 tracking-wider uppercase">{l.id.slice(0, 8)}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge tone={l.isActive ? "success" : "neutral"}>
                                {l.isActive ? "Active" : "Ended"}
                              </Badge>
                            </div>
                          </div>

                          {/* Actors Info */}
                          <div className="flex items-center gap-2.5 mb-4 bg-slate-50/50 p-2.5 rounded-xl border border-slate-100/50">
                            <Avatar src={l.tenantAvatarUrl || undefined} fallback={getInitials(l.tenantName)} className="size-7 text-xs bg-white text-slate-700 border border-slate-200 shrink-0 shadow-sm" />
                            <div className="flex flex-col min-w-0 flex-1">
                              <span className="text-sm font-medium text-slate-700 truncate">{l.tenantName}</span>
                              <span className="text-xs text-slate-400 truncate">Tenant Account</span>
                            </div>

                            {(l.landlordName || l.managerName) && (
                              <>
                                <div className="w-px h-6 bg-slate-200 mx-1" />
                                <div className="flex -space-x-2">
                                  {l.landlordName && (
                                    <Avatar src={l.landlordAvatarUrl || undefined} fallback={getInitials(l.landlordName)} className="size-7 text-xs bg-white text-slate-600 border border-white shrink-0 shadow-sm relative z-10" />
                                  )}
                                  {l.managerName && (
                                    <Avatar src={l.managerAvatarUrl || undefined} fallback={getInitials(l.managerName)} className="size-7 text-xs bg-[#151936] text-white border border-white shrink-0 shadow-sm relative z-0" />
                                  )}
                                </div>
                              </>
                            )}
                          </div>

                          {/* Data Viz: Lease Tenure */}
                          <div className="flex flex-col gap-1.5 mb-4">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-slate-500 font-mono tracking-wider uppercase">Lease Tenure</span>
                              <span className={cn("text-xs font-mono font-medium", tenurePctTextColor)}>{l.isActive ? `${daysLeft}d left` : "Ended"}</span>
                            </div>
                            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                              <div style={{ width: `${tenurePct}%` }} className={cn("h-full rounded-full transition-all duration-500", tenurePctColor)} />
                            </div>
                            <div className="flex items-center justify-between mt-0.5">
                              <span className="text-xs text-slate-400 font-mono">{new Date(l.startsAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}</span>
                              <span className="text-xs text-slate-400 font-mono">{new Date(l.endsAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}</span>
                            </div>
                          </div>

                          {/* Financials Footer */}
                          <div className="mt-auto pt-4 border-t border-slate-100/80 flex items-end justify-between gap-4">
                            <div className="flex flex-col gap-0.5">
                              <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">Contracted Rent</span>
                              <div className="flex items-baseline gap-1">
                                <span className="font-mono text-md font-medium text-slate-800">{formatCompactKES(parseFloat(l.monthlyRentKes))}</span>
                                <span className="text-xs text-slate-400">/mo</span>
                              </div>
                            </div>

                            {(l.balanceKes ?? 0) > 0 ? (
                              <div className="flex flex-col items-end gap-0.5 text-right">
                                <span className="text-xs text-rose-500/80 font-medium uppercase tracking-wider">Arrears</span>
                                <span className="font-mono text-sm font-medium text-rose-600">{formatCompactKES(l.balanceKes ?? 0)}</span>
                              </div>
                            ) : (
                              <div className="flex flex-col items-end gap-0.5 text-right">
                                <span className="text-xs text-emerald-500/80 font-medium uppercase tracking-wider">Status</span>
                                <span className="font-mono text-sm font-medium text-emerald-600">Up to date</span>
                              </div>
                            )}

                            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={() => handleToggleFeature(l.propertyId, !!l.isFeatured)}
                                aria-label={l.isFeatured ? "Remove from featured" : "Add to featured"}
                                aria-pressed={!!l.isFeatured}
                                className={cn(
                                  "size-7 rounded-lg flex items-center justify-center shadow-xs transition-colors",
                                  l.isFeatured ? "bg-amber-400 text-[#151936]" : "bg-white border border-slate-200 text-slate-400 hover:text-amber-500 hover:bg-amber-50"
                                )}
                              >
                                {l.isFeatured ? <IconStarFilled size={13} /> : <IconStar size={13} />}
                              </button>
                              <DropdownMenu label="Lease actions" align="right" trigger={
                                <span className="size-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-700 hover:bg-slate-50 shadow-xs transition-colors">
                                  <IconDotsVertical size={14} />
                                </span>
                              }>
                                <DropdownItem icon={IconUserCircle} onClick={() => setTenantDrawerId(l.tenantContactId)}>Tenant Profile</DropdownItem>
                                <Link href="/admin/messages"><DropdownItem icon={IconMessageCircle}>Message Manager</DropdownItem></Link>
                                <Link href={`/admin/leases/${l.id}`}><DropdownItem icon={IconFileText}>View Lease File</DropdownItem></Link>
                                {l.isActive && (
                                  <DropdownItem icon={IconRefresh} onClick={() => setRenewingLease(l)}>Renew Lease</DropdownItem>
                                )}
                                <DropdownItem icon={IconCalendarClock} onClick={() => setEditingLease(l)}>Edit Lease</DropdownItem>
                                {l.isActive && (
                                  <DropdownItem icon={IconBan} variant="danger" onClick={() => setTerminatingLease(l)}>Terminate Lease</DropdownItem>
                                )}
                              </DropdownMenu>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="hidden lg:block overflow-x-auto">
                    <table className="w-full min-w-[980px] text-left text-body-regular">
                      <thead>
                        <tr className="border-b border-slate-100 label-caps text-slate-600">
                          <th className="px-3 py-3">Tenant</th>
                          <th className="px-3 py-3">Property Unit</th>
                          <th className="px-3 py-3">Manager</th>
                          <th className="px-3 py-3">Tenure</th>
                          <th className="px-3 py-3 text-right">Rent rate</th>
                          <th className="px-3 py-3 text-right">Balance</th>
                          <th className="px-3 py-3 text-right">Deposit</th>
                          <th className="px-3 py-3 text-center">Status</th>
                          <th className="px-3 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {visible.map((l) => {
                          const tenurePct = getLeaseTenurePct(l);
                          const daysLeft = getDaysRemaining(l.endsAt);
                          return (
                            <tr key={l.id} onClick={() => router.push(`/admin/leases/${l.id}`)} className="transition-colors hover:bg-slate-50/40 group cursor-pointer">
                              <td className="px-3 py-4">
                                <div className="flex items-center gap-3">
                                  <Avatar
                                    src={l.tenantAvatarUrl || undefined}
                                    fallback={getInitials(l.tenantName)}
                                    className="size-9 bg-slate-50 text-slate-700 text-xs font-medium border border-slate-100 shrink-0"
                                  />
                                  <div>
                                    <p className="body-md text-slate-800 font-medium">{l.tenantName}</p>
                                    <p className="text-xs text-slate-600 mt-0.5">{l.tenantEmail || l.tenantPhone || "No contact info"}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-3 py-4">
                                <div className="flex items-center gap-2.5">
                                  <div className="size-8 rounded-lg bg-slate-50 flex items-center justify-center border border-slate-200/60 text-slate-600 shrink-0 overflow-hidden relative">
                                    {l.propertyMedia?.[0]?.url ? (
                                      <Image src={l.propertyMedia[0].url} alt={l.propertyName} fill sizes="32px" className="object-cover" />
                                    ) : (
                                      (() => {
                                        const PropIcon = (PROPERTY_TYPE_ICON as Record<string, React.ComponentType<{ size?: number; stroke?: number; className?: string }>>)[l.propertyType] ?? IconBuildingCommunity;
                                        return <PropIcon size={14} stroke={1.5} />;
                                      })()
                                    )}
                                  </div>
                                  <div>
                                    <p className="body-md text-slate-800 font-medium">{l.propertyName}</p>
                                    <p className="mono-data text-xs text-slate-600 mt-0.5">{l.propertyCode}</p>
                                  </div>
                                </div>
                              </td>
                              {/* Manager */}
                              <td className="px-3 py-4" onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center gap-2.5">
                                  {l.managerName ? (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (l.managerId) setManagerDrawerId(l.managerId);
                                      }}
                                      className="flex items-center gap-2.5 hover:opacity-85 text-left group/pm"
                                    >
                                      <Avatar
                                        src={l.managerAvatarUrl || undefined}
                                        fallback={getInitials(l.managerName)}
                                        className="size-6 text-xs bg-slate-100 text-slate-700 border border-slate-200/80 shrink-0"
                                      />
                                      <span className="body-sm text-slate-700 font-medium group-hover/pm:underline group-hover/pm:text-[#151936]">{l.managerName}</span>
                                    </button>
                                  ) : (
                                    <span className="text-slate-500 italic text-xs">Unassigned</span>
                                  )}
                                </div>
                              </td>
                              <td className="px-3 py-4">
                                <div className="w-40">
                                  <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                      style={{ width: `${tenurePct}%` }}
                                      className={cn(
                                        "h-full rounded-full transition-all",
                                        !l.isActive ? "bg-slate-300" : tenurePct <= 75 ? "bg-emerald-500" : tenurePct <= 90 ? "bg-amber-500" : "bg-red-400"
                                      )}
                                    />
                                  </div>
                                  <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-600 font-mono">
                                    <span>{formatDate(l.startsAt)}</span>
                                    <span>·</span>
                                    <span>{l.isActive ? `${daysLeft}d left` : formatDate(l.endsAt)}</span>
                                  </div>
                                </div>
                              </td>
                              <td className="px-3 py-4 text-right mono-amount text-slate-900">
                                {formatCompactKES(parseFloat(l.monthlyRentKes))}
                              </td>
                              <td className="px-3 py-4 text-right">
                                {(l.balanceKes ?? 0) > 0 ? (
                                  <span className="mono-amount text-rose-600">{formatCompactKES(l.balanceKes ?? 0)}</span>
                                ) : (
                                  <span className="text-xs font-medium text-emerald-600 uppercase tracking-wider">Current</span>
                                )}
                              </td>
                              <td className="px-3 py-4 text-right mono-amount text-slate-600">
                                {l.depositKes ? formatCompactKES(parseFloat(l.depositKes)) : "-"}
                              </td>
                              <td className="px-3 py-4 text-center">
                                <Badge tone={l.isActive ? "success" : "neutral"}>
                                  {l.isActive ? "Active" : "Terminated"}
                                </Badge>
                              </td>
                              <td className="px-3 py-4" onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleToggleFeature(l.propertyId, !!l.isFeatured)}
                                    aria-label={l.isFeatured ? "Remove from featured" : "Add to featured"}
                                    aria-pressed={!!l.isFeatured}
                                    className={cn(
                                      "size-8 rounded-lg flex items-center justify-center transition-colors",
                                      l.isFeatured ? "bg-amber-400 text-[#151936]" : "bg-slate-50 border border-slate-100 text-slate-400 hover:text-amber-500 hover:bg-amber-50 opacity-0 group-hover:opacity-100"
                                    )}
                                  >
                                    {l.isFeatured ? <IconStarFilled size={14} /> : <IconStar size={14} />}
                                  </button>
                                  <DropdownMenu label="Lease actions" align="right" trigger={
                                    <span className="size-8 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-600 hover:text-slate-700 hover:bg-slate-100 transition-colors opacity-0 group-hover:opacity-100">
                                      <IconDotsVertical size={16} />
                                    </span>
                                  }>
                                    <DropdownItem icon={IconUserCircle} onClick={() => setTenantDrawerId(l.tenantContactId)}>Tenant Profile</DropdownItem>
                                    <Link href="/admin/messages"><DropdownItem icon={IconMessageCircle}>Message Manager</DropdownItem></Link>
                                    <Link href={`/admin/leases/${l.id}`}><DropdownItem icon={IconFileText}>View Lease File</DropdownItem></Link>
                                    {l.isActive && (
                                      <DropdownItem icon={IconRefresh} onClick={() => setRenewingLease(l)}>Renew Lease</DropdownItem>
                                    )}
                                    <DropdownItem icon={IconCalendarClock} onClick={() => setEditingLease(l)}>Edit Lease</DropdownItem>
                                    {l.isActive && (
                                      <DropdownItem icon={IconBan} variant="danger" onClick={() => setTerminatingLease(l)}>Terminate Lease</DropdownItem>
                                    )}
                                  </DropdownMenu>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

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
      </div>

      {/* ── Activity Loggers (always last, matching valuations & properties layout) ── */}
      <div className="flex items-center gap-4 my-6">
        <hr className="flex-1 border-slate-200/60" />
        <span className="label-caps text-slate-600 tracking-wider">Recent Activity</span>
        <hr className="flex-1 border-slate-200/60" />
      </div>

      {/* Mandate Activity */}
      <div className="gsap-stagger mb-6 bg-white border border-slate-100 rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-5 lg:p-6">
        <div className="flex flex-col gap-5 mb-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-slate-800 flex items-center gap-2">
              <IconClock size={16} className="text-slate-600" stroke={2} /> Recent Mandate Activity
            </h3>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative flex-1">
              <IconSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" placeholder="Search activity logs..." value={mandateActivitySearchQuery}
                onChange={(e) => { setMandateActivitySearchQuery(e.target.value); setMandateActivityPage(1); }}
                className="w-full bg-slate-50 border border-slate-200 text-sm rounded-xl pl-9 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#151936]/20 transition-all placeholder:text-slate-400" />
            </div>
            <div className="relative shrink-0">
              <IconFilter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <select value={mandateActivityFilter} onChange={(e) => { setMandateActivityFilter(e.target.value); setMandateActivityPage(1); }}
                className="appearance-none bg-white border border-slate-200 text-sm font-medium text-slate-700 rounded-xl pl-8 pr-10 py-2 focus:outline-none focus:ring-2 focus:ring-[#151936]/20 transition-all cursor-pointer">
                <option value="all">All Events</option>
                <option value="edits">Modifications</option>
                <option value="terminations">Terminations</option>
                <option value="system">System Actions</option>
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"><IconChevronRight size={14} className="text-slate-400 rotate-90" /></div>
            </div>
          </div>
        </div>
        {mandateActivityLoading ? (
          <div className="flex items-center justify-center py-12"><LoadingSpinner size="md" /></div>
        ) : mandateActivity.length === 0 ? (
          <div className="flex flex-col items-center text-center gap-4 py-12 bg-slate-50 rounded-2xl border border-slate-100 border-dashed">
            <div className="size-16 rounded-2xl bg-white border border-slate-100 flex items-center justify-center mb-1"><IconMoodEmpty size={32} className="text-slate-300" /></div>
            <h3 className="text-sm font-medium text-slate-700">No recorded mandate activity yet.</h3>
            <p className="text-slate-400 max-w-sm text-xs">Status changes, edits, and mandate events will safely log here.</p>
          </div>
        ) : paginatedMandateActivity.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-center">
            <IconSearch size={24} className="text-slate-300 mb-3" />
            <p className="text-sm font-medium text-slate-700">No logs match your filter</p>
            <p className="text-xs text-slate-400 mt-1">Try adjusting the search query or dropdown.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-6 relative ml-1">
            <div className="absolute left-[3.5px] top-2 bottom-6 w-px bg-slate-200 z-0" />
            {paginatedMandateActivity.map((entry) => {
              const toneColor = getActivityTone(entry.summary);
              return (
                <div key={entry.id} className="relative flex items-start lg:items-center gap-4 z-10 group">
                  <div className={cn("size-[8px] rounded-full mt-1.5 lg:mt-0 shrink-0 ring-4 shadow-xs", toneColor)} />
                  <Link href={entry.associatedId ? `/admin/mandates/${entry.associatedId}` : "#"}
                    className="flex-1 min-w-0 flex flex-col lg:flex-row lg:items-center justify-between gap-2 lg:gap-6 hover:bg-slate-50/50 -my-1.5 -mx-3 p-1.5 px-3 rounded-xl transition-colors cursor-pointer">
                    <p className="text-sm text-slate-500 leading-snug group-hover:text-slate-700 transition-colors flex-1 min-w-0 pr-4">
                      {entry.actorName ? (<><span className="font-medium text-slate-700">{entry.actorName}</span> {entry.summary.replace(entry.actorName, "").replace(/^ - |^ — /, "").trim()}</>) : entry.summary}
                    </p>
                    <div className="flex items-center gap-3 shrink-0">
                      <p className="text-xs text-slate-400 font-mono tracking-wider hidden lg:block">
                        {new Date(entry.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}, {new Date(entry.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                      <Badge tone="neutral">{relativeTime(entry.createdAt)}</Badge>
                    </div>
                  </Link>
                </div>
              );
            })}
          </div>
        )}
        {mandateActivityTotalPages > 1 && (
          <div className="flex items-center justify-between pt-6 mt-6 border-t border-slate-100">
            <span className="text-xs font-medium text-slate-400 bg-slate-50 px-3 py-1 rounded-md border border-slate-100">Page {safeMandateActivityPage} of {mandateActivityTotalPages} · {filteredMandateActivity.length} logs</span>
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={() => setMandateActivityPage(Math.max(1, safeMandateActivityPage - 1))} disabled={safeMandateActivityPage <= 1} className="size-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 disabled:text-slate-200 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"><IconChevronLeft size={15} /></button>
              <button type="button" onClick={() => setMandateActivityPage(Math.min(mandateActivityTotalPages, safeMandateActivityPage + 1))} disabled={safeMandateActivityPage >= mandateActivityTotalPages} className="size-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 disabled:text-slate-200 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"><IconChevronRight size={15} /></button>
            </div>
          </div>
        )}
      </div>

      {/* Lease Activity */}
      <div className="gsap-stagger mb-8 bg-white border border-slate-100 rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-5 lg:p-6">
        <div className="flex flex-col gap-5 mb-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-slate-800 flex items-center gap-2">
              <IconClock size={16} className="text-slate-600" stroke={2} /> Recent Lease Activity
            </h3>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative flex-1">
              <IconSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" placeholder="Search activity logs..." value={leaseActivitySearchQuery}
                onChange={(e) => { setLeaseActivitySearchQuery(e.target.value); setLeaseActivityPage(1); }}
                className="w-full bg-slate-50 border border-slate-200 text-sm rounded-xl pl-9 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#151936]/20 transition-all placeholder:text-slate-400" />
            </div>
            <div className="relative shrink-0">
              <IconFilter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <select value={leaseActivityFilter} onChange={(e) => { setLeaseActivityFilter(e.target.value); setLeaseActivityPage(1); }}
                className="appearance-none bg-white border border-slate-200 text-sm font-medium text-slate-700 rounded-xl pl-8 pr-10 py-2 focus:outline-none focus:ring-2 focus:ring-[#151936]/20 transition-all cursor-pointer">
                <option value="all">All Events</option>
                <option value="edits">Modifications</option>
                <option value="terminations">Terminations</option>
                <option value="system">System Actions</option>
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"><IconChevronRight size={14} className="text-slate-400 rotate-90" /></div>
            </div>
          </div>
        </div>
        {leaseActivityLoading ? (
          <div className="flex items-center justify-center py-12"><LoadingSpinner size="md" /></div>
        ) : leaseActivity.length === 0 ? (
          <div className="flex flex-col items-center text-center gap-4 py-12 bg-slate-50 rounded-2xl border border-slate-100 border-dashed">
            <div className="size-16 rounded-2xl bg-white border border-slate-100 flex items-center justify-center mb-1"><IconMoodEmpty size={32} className="text-slate-300" /></div>
            <h3 className="text-sm font-medium text-slate-700">No recorded lease activity yet.</h3>
            <p className="text-slate-400 max-w-sm text-xs">Status changes, edits, and lease events will safely log here.</p>
          </div>
        ) : paginatedLeaseActivity.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-center">
            <IconSearch size={24} className="text-slate-300 mb-3" />
            <p className="text-sm font-medium text-slate-700">No logs match your filter</p>
            <p className="text-xs text-slate-400 mt-1">Try adjusting the search query or dropdown.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-6 relative ml-1">
            <div className="absolute left-[3.5px] top-2 bottom-6 w-px bg-slate-200 z-0" />
            {paginatedLeaseActivity.map((entry) => {
              const toneColor = getActivityTone(entry.summary);
              return (
                <div key={entry.id} className="relative flex items-start lg:items-center gap-4 z-10 group">
                  <div className={cn("size-[8px] rounded-full mt-1.5 lg:mt-0 shrink-0 ring-4 shadow-xs", toneColor)} />
                  <Link href={entry.associatedId ? `/admin/leases/${entry.associatedId}` : "#"}
                    className="flex-1 min-w-0 flex flex-col lg:flex-row lg:items-center justify-between gap-2 lg:gap-6 hover:bg-slate-50/50 -my-1.5 -mx-3 p-1.5 px-3 rounded-xl transition-colors cursor-pointer">
                    <p className="text-sm text-slate-500 leading-snug group-hover:text-slate-700 transition-colors flex-1 min-w-0 pr-4">
                      {entry.actorName ? (<><span className="font-medium text-slate-700">{entry.actorName}</span> {entry.summary.replace(entry.actorName, "").replace(/^ - |^ — /, "").trim()}</>) : entry.summary}
                    </p>
                    <div className="flex items-center gap-3 shrink-0">
                      <p className="text-xs text-slate-400 font-mono tracking-wider hidden lg:block">
                        {new Date(entry.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}, {new Date(entry.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                      <Badge tone="neutral">{relativeTime(entry.createdAt)}</Badge>
                    </div>
                  </Link>
                </div>
              );
            })}
          </div>
        )}
        {leaseActivityTotalPages > 1 && (
          <div className="flex items-center justify-between pt-6 mt-6 border-t border-slate-100">
            <span className="text-xs font-medium text-slate-400 bg-slate-50 px-3 py-1 rounded-md border border-slate-100">Page {safeLeaseActivityPage} of {leaseActivityTotalPages} · {filteredLeaseActivity.length} logs</span>
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={() => setLeaseActivityPage(Math.max(1, safeLeaseActivityPage - 1))} disabled={safeLeaseActivityPage <= 1} className="size-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 disabled:text-slate-200 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"><IconChevronLeft size={15} /></button>
              <button type="button" onClick={() => setLeaseActivityPage(Math.min(leaseActivityTotalPages, safeLeaseActivityPage + 1))} disabled={safeLeaseActivityPage >= leaseActivityTotalPages} className="size-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 disabled:text-slate-200 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"><IconChevronRight size={15} /></button>
            </div>
          </div>
        )}
      </div>

      {
        isModalOpen && (
          <LeaseFormModal
            open={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            onSubmit={loadLeases}
          />
        )
      }

      {
        editingLease && (
          <LeaseFormModal
            open={!!editingLease}
            mode="edit"
            lease={leaseToEditTarget(editingLease)}
            onClose={() => setEditingLease(null)}
            onSubmit={loadLeases}
          />
        )
      }

      <LeaseRenewModal
        open={!!renewingLease}
        lease={renewingLease ? leaseToRenewTarget(renewingLease) : null}
        onClose={() => setRenewingLease(null)}
        onRenewed={loadLeases}
      />

      {
        mandateModalOpen && (
          <MandateFormModal
            open={mandateModalOpen}
            entityId={entityId}
            onClose={() => setMandateModalOpen(false)}
            onCreated={loadMandates}
          />
        )
      }

      {letterModalTarget && (
        <MandateLetterModal
          open
          entityId={entityId}
          ownerContactId={letterModalTarget.landlordContactId}
          propertyId={letterModalTarget.propertyId}
          propertyName={letterModalTarget.propertyName}
          landlordName={letterModalTarget.landlordName}
          hasExistingLetter={false}
          onClose={() => setLetterModalTarget(null)}
          onAttached={() => { setLetterModalTarget(null); loadMandates(); }}
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

      <ConfirmDialog
        open={!!terminatingLease}
        onClose={() => { setTerminatingLease(null); setLeaseTerminateNotes(""); setLeaseTerminateNotesErr(false); }}
        onConfirm={handleTerminateLease}
        title="Terminate Lease"
        description="This cannot be undone. The tenancy is set to inactive and the unit becomes available immediately."
        confirmLabel="Terminate Lease"
        tone="danger"
        isLoading={isTerminatingLease}
        notes={{
          label: "Termination reason",
          placeholder: "Why is this lease being terminated?",
          value: leaseTerminateNotes,
          onChange: (v) => { setLeaseTerminateNotes(v); setLeaseTerminateNotesErr(false); },
          required: true,
          error: leaseTerminateNotesErr ? "A reason is required." : undefined,
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

      {remittanceAdviceModal && (
        <RemittanceAdvicePanel
          open={!!remittanceAdviceModal}
          remittance={selectedRemittance}
          landlordName={remittanceAdviceModal.landlordName}
          propertyName={remittanceAdviceModal.propertyName}
          onClose={() => { setRemittanceAdviceModal(null); setSelectedRemittance(null); }}
          onDecided={loadMandates}
        />
      )}

      <PropertyManagerProfileDrawer
        open={!!managerDrawerId}
        onClose={() => setManagerDrawerId(null)}
        entityId={entityId}
        managerId={managerDrawerId}
        properties={pmProperties}
        onOpenProperty={(p) => router.push(`/admin/properties/${p.id}`)}
      />

      <TenantProfileDrawer
        open={!!tenantDrawerId}
        onClose={() => setTenantDrawerId(null)}
        entityId={entityId}
        contactId={tenantDrawerId}
      />
    </PageTransition >
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
