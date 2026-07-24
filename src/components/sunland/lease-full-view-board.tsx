"use client";

import { useEffect, useState, useMemo, type ComponentType } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  IconAlertTriangle,
  IconArrowUpRight,
  IconCalendarEvent,
  IconCash,
  IconChevronLeft,
  IconChevronRight,
  IconCircleCheck,
  IconClock,
  IconDotsVertical,
  IconEdit,
  IconFileText,
  IconFilter,
  IconHistory,
  IconLink,
  IconBell,
  IconMail,
  IconMapPin,
  IconMessageCircle,
  IconPhone,
  IconPhoto,
  IconRefresh,
  IconSearch,
  IconShield,
  IconTrash,
  IconUsers,
  IconBuildingCommunity,
} from "@tabler/icons-react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SkeletonBlock } from "@/components/ui/erp-primitives";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Avatar } from "@/components/ui/avatar";
import { DropdownMenu, DropdownItem } from "@/components/ui/dropdown-menu";
import { useToast } from "@/components/ui/toast-provider";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { PhotoLightbox } from "./photo-lightbox";
import { formatCompactKES, formatFileSize } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { LeaseFormModal, type LeaseEditTarget } from "./lease-form-modal";
import { LeaseRenewModal, type LeaseRenewTarget } from "./lease-renew-modal";
import { LeaseDocumentModal } from "./lease-document-modal";
import { PropertyOwnerProfileDrawer } from "./property-owner-profile-drawer";
import { PropertyManagerProfileDrawer } from "./property-manager-profile-drawer";
import { TenantProfileDrawer } from "./tenant-profile-drawer";
import { PageTransition } from "@/components/shared/page-transition";
import { NotifyUserModal } from "./notify-user-modal";

interface LeaseDocument {
  id: string;
  title: string;
  fileUrl: string;
  type: string;
  createdAt: string;
  fileSizeBytes?: number | null;
}

const LEASE_DOCUMENT_TYPE_LABEL: Record<string, string> = {
  lease_agreement: "Lease Agreement",
  identification: "Tenant ID",
  rent_receipt: "Rent Receipt",
  statement: "Statement",
};

interface PaymentEntry {
  id: string;
  type: "rent" | "commission" | "valuation_fee" | "expense" | "deposit" | "other" | "agreement_fee" | "sales_commission";
  amountKes: string;
  occurredAt: string;
  notes: string | null;
}

const PAYMENT_TYPE_LABEL: Record<PaymentEntry["type"], string> = {
  rent: "Rent",
  commission: "Commission",
  valuation_fee: "Valuation Fee",
  expense: "Expense",
  deposit: "Deposit",
  other: "Other",
  agreement_fee: "Agreement Fee",
  sales_commission: "Sales Commission",
};

interface PropertyActiveLease {
  id: string;
  tenantContactId: string;
  startsAt: string;
  endsAt: string;
  monthlyRentKes: string;
  depositKes: string | null;
  isActive: boolean;
  tenantName: string;
  tenantEmail: string | null;
  tenantPhone: string | null;
  tenantAvatarUrl?: string | null;
  unitLabel?: string | null;
  unitType?: string | null;
}

interface PropertyUnitItem {
  id: string;
  unitLabel: string;
  unitType: string;
  status: string;
  rentKes: string;
}

interface Lease {
  id: string;
  startsAt: string;
  endsAt: string;
  monthlyRentKes: string;
  depositKes: string | null;
  isActive: boolean;
  notes: string | null;
  propertyId: string;
  tenantContactId: string;
  propertyName: string;
  propertyCode: string;
  propertyType: string;
  propertyLocation?: string;
  propertyMedia?: Array<{ url: string; alt?: string }> | null;
  tenantName: string;
  tenantEmail: string | null;
  tenantPhone: string | null;
  tenantAvatarUrl?: string | null;
  balanceKes: number;
  unitLabel?: string | null;
  landlord?: { id: string; name: string; email: string | null; phone: string | null; avatarUrl?: string | null; verifiedAt?: string | null; companyName?: string | null } | null;
  manager?: { id: string; name: string | null; title: string | null; email: string | null; avatarUrl?: string | null } | null;
  propertyUnits?: PropertyUnitItem[];
  propertyActiveLeases?: PropertyActiveLease[];
  unitTypeCounts?: Record<string, number>;
  totalUnits?: number;
  occupancyPct?: number;
  totalPropertyRentPool?: number;
}

interface AuditEntry {
  id: string;
  summary: string;
  actorName?: string;
  createdAt: string;
}

type ActionTone = "amber" | "rose" | "neutral";

interface ActionItem {
  key: string;
  tone: ActionTone;
  icon: ComponentType<{ size?: number; className?: string }>;
  badgeText: string;
  badgeTone: "risk" | "warning" | "neutral";
  title: string;
  formattedAmount?: string;
  meta: string;
  primaryCta: string;
  secondaryCta?: string;
  onPrimaryClick: () => void;
  onSecondaryClick?: () => void;
}

type VitalTone = "emerald" | "amber" | "rose" | "neutral";

const VITAL_TONE_BG: Record<VitalTone, string> = {
  emerald: "bg-gradient-to-br from-white to-[#ecfdf5]/30 border-slate-200/80 hover:to-[#ecfdf5]/55",
  amber: "bg-gradient-to-br from-white to-[#fffbeb]/45 border-slate-200/80 hover:to-[#fffbeb]/70",
  rose: "bg-gradient-to-br from-white to-[#fff1f2]/30 border-slate-200/80 hover:to-[#fff1f2]/55",
  neutral: "bg-gradient-to-br from-white to-slate-50/40 border-slate-200/80 hover:to-slate-50/60",
};

const VITAL_TONE_VALUE: Record<VitalTone, string> = {
  emerald: "text-emerald-700",
  amber: "text-amber-700",
  rose: "text-rose-600",
  neutral: "text-slate-900",
};

const VITAL_TONE_ARTWORK: Record<VitalTone, string> = {
  emerald: "text-emerald-600",
  amber: "text-amber-600",
  rose: "text-rose-600",
  neutral: "text-slate-600",
};

const scrollHiddenStyle: React.CSSProperties = { scrollbarWidth: "none", msOverflowStyle: "none" };

function leaseTermLabel(lease: Lease): string {
  if (!lease.isActive) return "—";
  const days = Math.ceil((new Date(lease.endsAt).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return "Overdue";
  if (days === 0) return "Ends today";
  return `${days} days`;
}

function getLeaseTenurePct(l: { startsAt: string; endsAt: string }, now: number): number {
  const start = new Date(l.startsAt).getTime();
  const end = new Date(l.endsAt).getTime();
  const total = end - start;
  if (total <= 0) return 100;
  return Math.min(100, Math.max(0, Math.round(((now - start) / total) * 100)));
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "Just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  return days === 1 ? "Yesterday" : `${days}d ago`;
}

type TabKey = "overview" | "units" | "payments" | "documents" | "activity";

export function LeaseFullViewBoard({
  entityId,
  leaseId,
  canManage = true,
}: {
  entityId: string | null;
  leaseId: string;
  canManage?: boolean;
}) {
  const router = useRouter();
  const { pushToast } = useToast();
  const [renderTimestamp] = useState(() => Date.now());

  const [lease, setLease] = useState<Lease | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshCount, setRefreshCount] = useState(0);

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [renewModalOpen, setRenewModalOpen] = useState(false);

  const [activeTab, setActiveTab] = useState<TabKey>("overview");

  const [activityLog, setActivityLog] = useState<AuditEntry[] | null>(null);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityLoaded, setActivityLoaded] = useState(false);

  const [activitySearchQuery, setActivitySearchQuery] = useState("");
  const [activityFilter, setActivityFilter] = useState("all");
  const [activityPage, setActivityPage] = useState(1);
  const ACTIVITY_PER_PAGE = 10;

  const [leaseDocuments, setLeaseDocuments] = useState<LeaseDocument[] | null>(null);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [documentsLoaded, setDocumentsLoaded] = useState(false);
  const [uploadDocOpen, setUploadDocOpen] = useState(false);

  const [docSearchQuery, setDocSearchQuery] = useState("");
  const [docTypeFilter, setDocTypeFilter] = useState("all");
  const [docPage, setDocPage] = useState(1);
  const DOC_PER_PAGE = 10;

  const [payments, setPayments] = useState<PaymentEntry[] | null>(null);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [paymentsLoaded, setPaymentsLoaded] = useState(false);
  const [paymentSearchQuery, setPaymentSearchQuery] = useState("");
  const [paymentTypeFilter, setPaymentTypeFilter] = useState("all");
  const [paymentPage, setPaymentPage] = useState(1);
  const PAYMENT_PER_PAGE = 10;

  const [ownerProfileOpen, setOwnerProfileOpen] = useState(false);
  const [managerProfileOpen, setManagerProfileOpen] = useState(false);
  const [tenantProfileOpen, setTenantProfileOpen] = useState(false);
  const [selectedDrawerTenantId, setSelectedDrawerTenantId] = useState<string | null>(null);

  const [activeMediaIndex, setActiveMediaIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [notifyPmOpen, setNotifyPmOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  useEffect(() => {
    let active = true;
    const fetchLease = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/leases/${leaseId}?entityId=${entityId || ""}`);
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        const data = await res.json();
        if (!active) return;
        if (data.lease) {
          setLease(data.lease);
        } else {
          setError("This lease couldn't be found.");
        }
      } catch (err) {
        if (!active) return;
        console.error("Failed to load lease:", err);
        setError("Couldn't load this lease agreement. Check your connection and try again.");
      } finally {
        if (active) setIsLoading(false);
      }
    };
    fetchLease();
    return () => {
      active = false;
    };
  }, [leaseId, entityId, refreshCount]);

  useEffect(() => {
    if (activeTab !== "activity" || activityLoaded) return;
    let active = true;
    const timeoutId = setTimeout(() => {
      setActivityLoading(true);
      fetch(`/api/audit?entityId=${entityId}&associatedType=lease&associatedId=${leaseId}`)
        .then((res) => (res.ok ? res.json() : { data: [] }))
        .then((data) => {
          if (!active) return;
          setActivityLog(data.entries ?? data.data ?? []);
        })
        .catch((err) => {
          console.error("Failed to load activity log:", err);
          if (active) setActivityLog([]);
        })
        .finally(() => {
          if (active) {
            setActivityLoading(false);
            setActivityLoaded(true);
          }
        });
    }, 0);
    return () => {
      active = false;
      clearTimeout(timeoutId);
    };
  }, [activeTab, activityLoaded, leaseId, entityId]);

  useEffect(() => {
    if (activeTab !== "documents" || documentsLoaded) return;
    let active = true;
    const timeoutId = setTimeout(() => {
      setDocumentsLoading(true);
      fetch(`/api/documents?entityId=${entityId || ""}&leaseId=${leaseId}`)
        .then((res) => (res.ok ? res.json() : { documents: [] }))
        .then((data) => {
          if (!active) return;
          setLeaseDocuments(data.documents ?? []);
        })
        .catch((err) => {
          console.error("Failed to load lease documents:", err);
          if (active) setLeaseDocuments([]);
        })
        .finally(() => {
          if (active) {
            setDocumentsLoading(false);
            setDocumentsLoaded(true);
          }
        });
    }, 0);
    return () => {
      active = false;
      clearTimeout(timeoutId);
    };
  }, [activeTab, documentsLoaded, leaseId, entityId]);

  useEffect(() => {
    if (activeTab !== "payments" || paymentsLoaded) return;
    let active = true;
    const timeoutId = setTimeout(() => {
      setPaymentsLoading(true);
      fetch(`/api/finance/transactions?entityId=${entityId || ""}&leaseId=${leaseId}`)
        .then((res) => (res.ok ? res.json() : { transactions: [] }))
        .then((data) => {
          if (!active) return;
          setPayments(data.transactions ?? []);
        })
        .catch((err) => {
          console.error("Failed to load payment history:", err);
          if (active) setPayments([]);
        })
        .finally(() => {
          if (active) {
            setPaymentsLoading(false);
            setPaymentsLoaded(true);
          }
        });
    }, 0);
    return () => {
      active = false;
      clearTimeout(timeoutId);
    };
  }, [activeTab, paymentsLoaded, leaseId, entityId]);

  const refetchLeaseDocuments = () => {
    fetch(`/api/documents?entityId=${entityId || ""}&leaseId=${leaseId}`)
      .then((res) => (res.ok ? res.json() : { documents: [] }))
      .then((data) => setLeaseDocuments(data.documents ?? []))
      .catch((err) => console.error("Failed to refresh lease documents:", err));
  };

  const tabs = useMemo(() => {
    return [
      { key: "overview", label: "Overview", icon: IconBuildingCommunity },
      { key: "units", label: "Property Units & Tenancies", icon: IconUsers },
      { key: "payments", label: "Payment History", icon: IconCash },
      { key: "documents", label: "Documents", icon: IconFileText },
      { key: "activity", label: "Activity Log", icon: IconHistory },
    ] as { key: TabKey; label: string; icon: ComponentType<{ size?: number; className?: string }> }[];
  }, []);

  const filteredActivity = useMemo(() => {
    if (!activityLog) return [];
    let filtered = activityLog;
    if (activitySearchQuery) {
      const q = activitySearchQuery.toLowerCase();
      filtered = filtered.filter((a) => a.summary.toLowerCase().includes(q));
    }
    if (activityFilter !== "all") {
      filtered = filtered.filter((a) => {
        const lower = a.summary.toLowerCase();
        if (activityFilter === "edits") return lower.includes("updat") || lower.includes("chang") || lower.includes("edit");
        if (activityFilter === "terminations") return lower.includes("terminat") || lower.includes("delet");
        if (activityFilter === "system") return lower.includes("system") || lower.includes("auto");
        return true;
      });
    }
    return filtered;
  }, [activityLog, activitySearchQuery, activityFilter]);

  const activityTotalPages = Math.max(1, Math.ceil(filteredActivity.length / ACTIVITY_PER_PAGE));
  const safeActivityPage = Math.min(activityPage, activityTotalPages);
  const paginatedActivity = filteredActivity.slice((safeActivityPage - 1) * ACTIVITY_PER_PAGE, safeActivityPage * ACTIVITY_PER_PAGE);

  const filteredDocuments = useMemo(() => {
    let filtered = leaseDocuments ?? [];
    if (docSearchQuery) {
      const q = docSearchQuery.toLowerCase();
      filtered = filtered.filter((d) => d.title.toLowerCase().includes(q) || (LEASE_DOCUMENT_TYPE_LABEL[d.type] ?? d.type).toLowerCase().includes(q));
    }
    if (docTypeFilter !== "all") {
      filtered = filtered.filter((d) => d.type === docTypeFilter);
    }
    return filtered;
  }, [leaseDocuments, docSearchQuery, docTypeFilter]);

  const docTotalPages = Math.max(1, Math.ceil(filteredDocuments.length / DOC_PER_PAGE));
  const safeDocPage = Math.min(docPage, docTotalPages);
  const paginatedDocuments = filteredDocuments.slice((safeDocPage - 1) * DOC_PER_PAGE, safeDocPage * DOC_PER_PAGE);

  const filteredPayments = useMemo(() => {
    let filtered = payments ?? [];
    if (paymentSearchQuery) {
      const q = paymentSearchQuery.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          (PAYMENT_TYPE_LABEL[p.type] ?? p.type).toLowerCase().includes(q) ||
          (p.notes ?? "").toLowerCase().includes(q)
      );
    }
    if (paymentTypeFilter !== "all") {
      filtered = filtered.filter((p) => p.type === paymentTypeFilter);
    }
    return filtered;
  }, [payments, paymentSearchQuery, paymentTypeFilter]);

  const paymentTotalPages = Math.max(1, Math.ceil(filteredPayments.length / PAYMENT_PER_PAGE));
  const safePaymentPage = Math.min(paymentPage, paymentTotalPages);
  const paginatedPayments = filteredPayments.slice((safePaymentPage - 1) * PAYMENT_PER_PAGE, safePaymentPage * PAYMENT_PER_PAGE);

  const actionItems: ActionItem[] = useMemo(() => {
    if (!lease) return [];
    const items: ActionItem[] = [];
    if (lease.isActive && lease.balanceKes > 0) {
      items.push({
        key: "arrears",
        tone: "rose",
        icon: IconAlertTriangle,
        badgeText: "ACTION REQUIRED",
        badgeTone: "risk",
        title: `Outstanding Rent Arrears (${lease.unitLabel ? `Unit ${lease.unitLabel}` : lease.propertyCode})`,
        formattedAmount: formatCompactKES(lease.balanceKes),
        meta: `Tenant ${lease.tenantName} has an overdue balance of ${formatCompactKES(lease.balanceKes)}. Immediate collection notice or ledger review recommended.`,
        primaryCta: "Review Ledger",
        secondaryCta: "Issue Demand Notice",
        onPrimaryClick: () => {
          setActiveTab("payments");
          setPaymentTypeFilter("rent");
          setPaymentPage(1);
        },
        onSecondaryClick: () => {
          if (lease.manager) {
            setNotifyPmOpen(true);
          } else {
            pushToast({
              tone: "warning",
              title: "Demand Notice Queued",
              body: `Arrears notice for ${lease.tenantName} (${formatCompactKES(lease.balanceKes)}) generated.`,
            });
          }
        },
      });
    }
    const daysLeft = Math.ceil((new Date(lease.endsAt).getTime() - renderTimestamp) / 86_400_000);
    if (lease.isActive && daysLeft >= 0 && daysLeft <= 30) {
      items.push({
        key: "expiring",
        tone: "amber",
        icon: IconClock,
        badgeText: "EXPIRING SOON",
        badgeTone: "warning",
        title: `Lease Term Ending in ${daysLeft} Day${daysLeft === 1 ? "" : "s"}`,
        meta: `Contract expires on ${new Date(lease.endsAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}. Initiate renewal terms or schedule move-out inspection.`,
        primaryCta: "Renew Contract",
        secondaryCta: "View Terms",
        onPrimaryClick: () => setRenewModalOpen(true),
        onSecondaryClick: () => setActiveTab("overview"),
      });
    }
    return items;
  }, [lease, renderTimestamp, pushToast]);

  if (isLoading) {
    return (
      <div className="mx-auto flex max-w-[98rem] flex-col gap-6 pb-12">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 px-1 mt-2">
          <div className="flex flex-col gap-2">
            <SkeletonBlock className="h-8 w-72" />
            <SkeletonBlock className="h-4 w-48" />
          </div>
          <SkeletonBlock className="h-9 w-40 rounded-full" />
        </div>
        <SkeletonBlock className="rounded-[24px] min-h-[300px] lg:min-h-[340px] mt-2" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4 mt-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonBlock key={i} className="rounded-2xl h-[150px]" />
          ))}
        </div>
      </div>
    );
  }

  if (error && !lease) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
        <IconAlertTriangle size={32} className="text-rose-400" aria-hidden="true" />
        <p className="text-sm font-medium text-slate-800">{error}</p>
        <Button variant="secondary" onClick={() => setRefreshCount((c) => c + 1)}>
          Retry
        </Button>
      </div>
    );
  }

  if (!lease) {
    return <div className="p-8 text-center text-xs text-slate-400 font-mono">Lease agreement not found.</div>;
  }

  const mediaList = lease.propertyMedia || [];
  const primaryImage = mediaList[activeMediaIndex]?.url ?? mediaList[0]?.url;
  const monthlyRentNum = parseFloat(lease.monthlyRentKes);
  const depositNum = lease.depositKes ? parseFloat(lease.depositKes) : null;
  const collectedThisMonth = Math.max(0, monthlyRentNum - lease.balanceKes);
  const paymentStatusPct = monthlyRentNum > 0 ? Math.round((collectedThisMonth / monthlyRentNum) * 100) : 0;
  const paymentStatusPctDisplay = Math.min(100, paymentStatusPct);
  const daysRemaining = Math.max(0, Math.ceil((new Date(lease.endsAt).getTime() - renderTimestamp) / 86_400_000));
  const tenurePct = getLeaseTenurePct(lease, renderTimestamp);

  // Property Multi-unit statistics derived from extended getLeaseById response
  const propActiveLeases = lease.propertyActiveLeases || [];
  const unitTypeEntries = Object.entries(lease.unitTypeCounts || {});
  const totalUnits = lease.totalUnits || Math.max(1, propActiveLeases.length);
  const occupancyPct = lease.occupancyPct ?? (totalUnits > 0 ? Math.round((propActiveLeases.length / totalUnits) * 100) : 100);
  const totalPropertyRentPool = lease.totalPropertyRentPool || monthlyRentNum;

  // Recharts donut pie data for rent settled gauge
  const rechartsPieData = [
    { name: "Settled", value: paymentStatusPctDisplay, color: paymentStatusPct >= 90 ? "#10b981" : paymentStatusPct >= 70 ? "#f59e0b" : "#f43f5e" },
    { name: "Remaining", value: Math.max(0, 100 - paymentStatusPctDisplay), color: "#f1f5f9" },
  ];

  const vitals = [
    {
      label: "Unit Monthly Rent",
      value: formatCompactKES(monthlyRentNum),
      subText: "contracted rate",
      badgeText: "RENT",
      tone: "neutral" as VitalTone,
      icon: IconCalendarEvent,
      tab: "overview" as TabKey,
    },
    {
      label: "Deposit Held",
      value: depositNum ? formatCompactKES(depositNum) : "—",
      subText: "refundable liability",
      badgeText: depositNum ? "ON FILE" : "NONE",
      tone: "neutral" as VitalTone,
      icon: IconShield,
      tab: "overview" as TabKey,
    },
    {
      label: lease.balanceKes > 0 ? "Balance Due" : "Balance",
      value: formatCompactKES(lease.balanceKes),
      subText: lease.balanceKes > 0 ? "outstanding arrears" : "fully settled",
      badgeText: lease.balanceKes > 0 ? "ARREARS" : "CLEARED",
      tone: lease.balanceKes > 0 ? ("rose" as VitalTone) : ("emerald" as VitalTone),
      icon: IconAlertTriangle,
      tab: "payments" as TabKey,
    },
    {
      label: lease.isActive ? "Days Remaining" : "Term Ended",
      value: lease.isActive ? `${daysRemaining}` : "—",
      subText: lease.isActive ? (daysRemaining <= 30 ? "expiring soon" : "until expiry") : "lease terminated",
      badgeText: lease.isActive ? (daysRemaining <= 30 ? "RENEWAL DUE" : "ON TRACK") : "ENDED",
      tone: lease.isActive ? (daysRemaining <= 30 ? ("amber" as VitalTone) : ("neutral" as VitalTone)) : ("neutral" as VitalTone),
      icon: IconClock,
      tab: "overview" as TabKey,
    },
  ];

  const handleTerminate = async () => {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/leases/${lease.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityId, action: "terminate" }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Failed to terminate");
      }
      pushToast({ tone: "success", title: "Terminated", body: "Lease has been terminated." });
      setRefreshCount((c) => c + 1);
      setDeleteConfirmOpen(false);
    } catch (e: unknown) {
      pushToast({ tone: "error", title: "Error", body: e instanceof Error ? e.message : "Failed to terminate" });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    pushToast({ tone: "success", title: "Link copied" });
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
    <PageTransition className="mx-auto flex max-w-[98rem] flex-col gap-6 pb-12">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 px-1 mt-2 animate-fade-in-up">
        <div className="flex flex-col gap-2 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="title-serif text-slate-900 truncate">
              {lease.propertyName}
            </h1>
            <Badge tone={lease.isActive ? "success" : "neutral"}>
              {lease.isActive ? "ACTIVE LEASE" : "TERMINATED"}
            </Badge>
            <Badge tone="neutral">{lease.propertyCode}</Badge>
            {lease.propertyType && <Badge tone="primary">{lease.propertyType}</Badge>}
            <Badge tone="data">
              {occupancyPct}% Occupied ({propActiveLeases.length}/{totalUnits} Units)
            </Badge>
          </div>
          <div className="flex items-center gap-3 text-slate-500 text-xs min-w-0 font-medium">
            <span className="flex items-center gap-1.5 min-w-0">
              <IconMapPin size={14} className="shrink-0 text-slate-400" aria-hidden="true" />
              <span className="truncate">{lease.propertyLocation || "Sunland Managed Property"}</span>
            </span>
            <span className="text-slate-200 shrink-0">|</span>
            <span className="font-mono text-slate-500 shrink-0">
              {lease.unitLabel ? `UNIT ${lease.unitLabel}` : `LSE-${lease.id.slice(0, 8).toUpperCase()}`}
            </span>
          </div>
        </div>

        {/* CTA Actions */}
        {canManage && (
          <div className="flex items-center gap-2 shrink-0 flex-wrap mt-1 sm:mt-0">
            <button
              type="button"
              onClick={() => setEditModalOpen(true)}
              className="bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 border border-slate-200/80 font-medium text-xs rounded-xl px-3.5 py-2 shadow-2xs transition-colors flex items-center gap-1.5"
            >
              <IconEdit size={14} /> Edit Terms
            </button>
            {lease.isActive && (
              <button
                type="button"
                onClick={() => setRenewModalOpen(true)}
                className="bg-[#151936] text-white hover:bg-[#1f254e] font-medium text-xs rounded-xl px-4 py-2 shadow-sm transition-all flex items-center gap-1.5"
              >
                <IconRefresh size={14} /> Renew Lease
              </button>
            )}
            <DropdownMenu
              label="More actions"
              align="right"
              trigger={
                <div className="inline-flex size-[36px] items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-2xs cursor-pointer">
                  <IconDotsVertical size={16} />
                </div>
              }
            >
              <DropdownItem icon={IconLink} onClick={handleCopyLink}>Copy deep link</DropdownItem>
              {lease.manager && (
                <DropdownItem icon={IconBell} onClick={() => setNotifyPmOpen(true)}>Notify Property Manager</DropdownItem>
              )}
              {lease.isActive && (
                <DropdownItem icon={IconTrash} variant="danger" onClick={() => setDeleteConfirmOpen(true)}>Terminate lease</DropdownItem>
              )}
            </DropdownMenu>
          </div>
        )}
      </div>

      {/* ── Property-Centric Multi-Unit Hero Banner ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mt-2">
        <button
          type="button"
          onClick={() => {
            if (mediaList.length > 0) {
              setLightboxIndex(activeMediaIndex);
              setLightboxOpen(true);
            }
          }}
          disabled={mediaList.length === 0}
          aria-label="Open photo gallery"
          className={cn(
            "group relative rounded-[24px] overflow-hidden min-h-[320px] lg:min-h-[360px] shadow-[0_4px_25px_rgb(0,0,0,0.03)] bg-[#151936] text-white flex flex-col justify-between p-6 lg:p-8 border border-slate-800 transition-all duration-500 hover:shadow-[0_12px_35px_rgb(0,0,0,0.08)] text-left w-full cursor-pointer disabled:cursor-default",
            mediaList.length > 1 ? "lg:col-span-8" : "lg:col-span-12"
          )}
        >
          {primaryImage ? (
            <Image
              src={primaryImage}
              alt={lease.propertyName}
              fill
              sizes="(max-width: 1024px) 100vw, 80vw"
              className="object-cover absolute inset-0 transition-transform duration-700 group-hover:scale-103"
              priority
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-slate-900 to-[#151936]" />
          )}
          <div
            className="absolute inset-0 z-0"
            style={{ background: "linear-gradient(180deg, rgba(12,15,32,0.4) 0%, rgba(12,15,32,0.15) 34%, rgba(10,13,28,0.65) 68%, rgba(8,10,22,0.94) 100%)" }}
            aria-hidden="true"
          />

          {mediaList.length > 0 && (
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-500 flex items-center justify-center z-0">
              <span className="opacity-0 group-hover:opacity-100 transition-all duration-500 transform translate-y-4 group-hover:translate-y-0 bg-white/95 backdrop-blur-md text-[#151936] font-medium px-4 py-2 rounded-xl shadow-lg flex items-center gap-2 text-xs border border-white/20 uppercase tracking-wider">
                <IconPhoto size={14} aria-hidden="true" /> View {mediaList.length} photos
              </span>
            </div>
          )}

          {/* Top Overlays: Status, Unit Mix Badges & Total Rent Roll */}
          <div className="relative z-10 flex justify-between items-start w-full gap-4 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge tone={lease.isActive ? "success" : "neutral"}>
                {lease.isActive ? "ACTIVE TENANCY" : "TERMINATED"}
              </Badge>
              {unitTypeEntries.map(([type, count]) => (
                <Badge key={type} tone="data">
                  {type} <span className="font-mono font-medium ml-0.5">×{count}</span>
                </Badge>
              ))}
            </div>

            <div className="flex flex-col items-end gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
              <div className="hidden sm:flex w-fit bg-white/95 backdrop-blur-md rounded-2xl p-2.5 px-3.5 shadow-xl items-center gap-3 border border-white/60 text-slate-900">
                <div className="relative size-10 flex items-center justify-center shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={rechartsPieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={13}
                        outerRadius={19}
                        startAngle={90}
                        endAngle={-270}
                        dataKey="value"
                        stroke="none"
                      >
                        {rechartsPieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-500 font-mono">Rent Settled</p>
                  <p className="text-base font-medium text-slate-900 mt-0.5 font-mono leading-none">
                    {paymentStatusPctDisplay}%
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Overlays: Active Tenancies Avatar Strip & Property Rent Roll */}
          <div className="relative z-10 flex flex-col gap-4 w-full mt-auto">
            {/* Active Tenancies Strip */}
            <div className="flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between text-xs text-slate-300 font-mono">
                <span className="uppercase tracking-wider">Property Active Tenancies ({propActiveLeases.length})</span>
                {lease.unitLabel && (
                  <Badge tone="brand">Viewing Unit {lease.unitLabel} · {lease.tenantName}</Badge>
                )}
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {propActiveLeases.map((al) => {
                  const isCurrentLease = al.id === lease.id;
                  return (
                    <button
                      key={al.id}
                      type="button"
                      onClick={() => {
                        if (!isCurrentLease) router.push(`/admin/leases/${al.id}`);
                      }}
                      className={cn(
                        "bg-black/50 hover:bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-2xl flex items-center gap-2 border transition-all text-left",
                        isCurrentLease ? "border-amber-300 ring-2 ring-amber-300/30 bg-black/70" : "border-white/10 hover:border-white/30"
                      )}
                    >
                      <Avatar
                        src={al.tenantAvatarUrl || undefined}
                        fallback={getInitials(al.tenantName)}
                        className="size-7 bg-slate-100 text-slate-800 text-xs font-medium"
                      />
                      <div className="text-left leading-none">
                        <p className="text-xs font-medium text-white flex items-center gap-1">
                          {al.tenantName}
                          {al.unitLabel && <span className="text-amber-300 font-mono text-xs">({al.unitLabel})</span>}
                        </p>
                        <span className="text-xs text-slate-300/80 font-mono mt-0.5 block">{formatCompactKES(parseFloat(al.monthlyRentKes))}/mo</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Payment Progress Bar */}
            <div className="w-full mt-1 pr-8 lg:pr-12" onClick={(e) => e.stopPropagation()}>
              <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden mb-2">
                <div
                  className={cn("h-full rounded-full transition-all duration-500", paymentStatusPct >= 90 ? "bg-emerald-400" : paymentStatusPct >= 70 ? "bg-amber-400" : "bg-red-400")}
                  style={{ width: `${Math.min(100, paymentStatusPct)}%` }}
                />
              </div>
              <div className="flex justify-between items-center text-xs font-mono text-slate-300">
                <span>{formatCompactKES(collectedThisMonth)} collected for Unit</span>
                <span>Total Rent Roll: {formatCompactKES(totalPropertyRentPool)}/mo</span>
              </div>
            </div>

            {/* Balance line & View Property Button */}
            <div className="mt-1 pt-3 border-t border-white/10 flex items-center justify-between gap-4 w-full" onClick={(e) => e.stopPropagation()}>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-slate-300 font-mono">
                  {lease.balanceKes > 0 ? "Unit Balance due" : "Rent status"}
                </p>
                <p className={cn("font-mono font-medium text-2xl tracking-tight mt-0.5", lease.balanceKes > 0 ? "text-rose-300" : "text-white")}>
                  {lease.balanceKes > 0 ? formatCompactKES(lease.balanceKes) : "Rent Current"}
                </p>
              </div>

              <Link
                href={`/admin/properties/${lease.propertyId}`}
                className="bg-white/10 hover:bg-white/20 text-white border border-white/20 font-medium text-xs rounded-xl px-3.5 py-2 transition-all flex items-center gap-1.5 backdrop-blur-md shadow-2xs shrink-0"
              >
                View Property <IconArrowUpRight size={13} />
              </Link>
            </div>
          </div>
        </button>

        {/* Side Media Gallery Cards Column */}
        {mediaList.length > 1 && (
          <div className="lg:col-span-4 flex flex-col sm:flex-row lg:flex-col gap-4 h-full">
            {mediaList.slice(1, 3).map((media, idx) => {
              const actualIndex = idx + 1;
              const isLastVisible = idx === 1 && mediaList.length > 3;
              const remainingCount = mediaList.length - 3;

              return (
                <div
                  key={actualIndex}
                  onClick={() => {
                    setLightboxIndex(actualIndex);
                    setLightboxOpen(true);
                  }}
                  className="group/side relative rounded-[24px] overflow-hidden bg-slate-900 border border-slate-800/80 shadow-2xs flex-1 min-h-[170px] cursor-pointer hover:border-slate-400 transition-all duration-300"
                >
                  <Image
                    src={media.url}
                    alt={media.alt || `Property photo ${actualIndex + 1}`}
                    fill
                    sizes="(max-width: 1024px) 50vw, 35vw"
                    className="object-cover transition-transform duration-500 group-hover/side:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                  <div className="absolute bottom-3.5 left-3.5 right-3.5 flex items-center justify-between z-10">
                    <Badge tone="neutral">Photo {actualIndex + 1}</Badge>
                    {isLastVisible && (
                      <span className="bg-[#151936] text-white font-medium text-xs px-3 py-1 rounded-xl border border-white/20 shadow-md flex items-center gap-1.5 font-mono">
                        <IconPhoto size={13} /> +{remainingCount} more
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Thumbnail slider */}
        {mediaList.length > 1 && (
          <div className="flex gap-2.5 overflow-x-auto pb-1 -mt-1" style={scrollHiddenStyle}>
            {mediaList.map((media, index) => (
              <button
                key={index}
                type="button"
                onClick={() => setActiveMediaIndex(index)}
                className={cn(
                  "relative size-[60px] rounded-xl overflow-hidden border-2 shrink-0 transition-all duration-300",
                  activeMediaIndex === index ? "border-slate-800 scale-95 shadow-2xs" : "border-slate-200/60 opacity-70 hover:opacity-100 hover:scale-95"
                )}
              >
                <Image src={media.url} alt={media.alt || `Property photo ${index + 1}`} fill sizes="60px" className="object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── KPI Vitals Row ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4 mt-2">
        {vitals.map((v) => (
          <button
            key={v.label}
            type="button"
            onClick={() => setActiveTab(v.tab)}
            className={cn(
              "relative overflow-hidden rounded-[24px] border p-5 flex flex-col justify-between group shadow-[0_2px_15px_rgb(0,0,0,0.02)] hover:shadow-[0_12px_30px_rgba(21,25,54,0.08)] hover:border-slate-300 transition-all duration-300 h-[145px] text-left cursor-pointer focus:outline-hidden",
              VITAL_TONE_BG[v.tone]
            )}
          >
            <v.icon
              size={130}
              stroke={1}
              className={cn(
                "absolute -right-6 -bottom-6 opacity-[0.03] group-hover:scale-110 group-hover:opacity-[0.05] transition-all duration-500 pointer-events-none",
                VITAL_TONE_ARTWORK[v.tone]
              )}
              aria-hidden="true"
            />
            <div className="flex items-start justify-between relative z-10">
              <div className="flex flex-col gap-1 max-w-[calc(100%-48px)]">
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider font-mono">{v.label}</span>
                <span className={cn("font-mono font-medium text-2xl mt-1 leading-none", VITAL_TONE_VALUE[v.tone])}>
                  {v.value}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between mt-auto relative z-10">
              <div className="flex items-center gap-2">
                <Badge tone={v.tone === "rose" ? "risk" : v.tone === "amber" ? "warning" : v.tone === "emerald" ? "success" : "neutral"}>
                  {v.badgeText}
                </Badge>
                <span className="text-xs text-slate-400 font-mono">{v.subText}</span>
              </div>
              <IconArrowUpRight
                size={14}
                className="text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity"
              />
            </div>
          </button>
        ))}
      </div>

      {/* ── Action-required band ── */}
      {actionItems.length > 0 && (
        <div className={cn("grid gap-4 animate-fade-in-up mt-1", actionItems.length > 1 ? "grid-cols-1 xl:grid-cols-2" : "grid-cols-1")}>
          {actionItems.map((item) => (
            <div
              key={item.key}
              className={cn(
                "rounded-[24px] p-5 border shadow-[0_2px_15px_rgb(0,0,0,0.02)] flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all duration-300 hover:shadow-[0_8px_25px_rgb(0,0,0,0.06)]",
                item.tone === "rose"
                  ? "bg-gradient-to-r from-rose-50/90 via-white to-rose-50/30 border-rose-200/90"
                  : item.tone === "amber"
                    ? "bg-gradient-to-r from-amber-50/90 via-white to-amber-50/30 border-amber-200/90"
                    : "bg-slate-50/80 border-slate-200/80"
              )}
            >
              <div className="flex items-start gap-3.5 min-w-0">
                <div
                  className={cn(
                    "size-11 rounded-2xl flex items-center justify-center shrink-0 border shadow-2xs",
                    item.tone === "rose"
                      ? "bg-rose-100/90 text-rose-600 border-rose-200"
                      : item.tone === "amber"
                        ? "bg-amber-100/90 text-amber-700 border-amber-200"
                        : "bg-slate-100 text-slate-600 border-slate-200"
                  )}
                >
                  <item.icon size={20} />
                </div>

                <div className="flex flex-col gap-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge tone={item.badgeTone}>{item.badgeText}</Badge>
                    {item.formattedAmount && (
                      <span className="font-mono text-xs font-medium text-rose-700 bg-rose-100/60 border border-rose-200/60 px-2 py-0.5 rounded-lg">
                        {item.formattedAmount} Due
                      </span>
                    )}
                  </div>
                  <h4 className="text-sm font-medium text-slate-900 leading-tight truncate">{item.title}</h4>
                  <p className="text-xs text-slate-500 leading-normal">{item.meta}</p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 shrink-0 self-start md:self-auto">
                {item.secondaryCta && item.onSecondaryClick && (
                  <button
                    type="button"
                    onClick={item.onSecondaryClick}
                    className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/80 font-medium text-xs rounded-xl px-3.5 py-2 shadow-2xs transition-colors whitespace-nowrap"
                  >
                    {item.secondaryCta}
                  </button>
                )}
                <button
                  type="button"
                  onClick={item.onPrimaryClick}
                  className={cn(
                    "font-medium text-xs rounded-xl px-4 py-2 shadow-xs transition-colors whitespace-nowrap flex items-center gap-1.5",
                    item.tone === "rose"
                      ? "bg-rose-600 hover:bg-rose-700 text-white"
                      : item.tone === "amber"
                        ? "bg-[#151936] hover:bg-[#1f254e] text-white"
                        : "bg-[#151936] text-white"
                  )}
                >
                  {item.primaryCta} <IconArrowUpRight size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="h-px bg-slate-200/60 my-2 lg:my-4" />

      {/* ── Main: Tabbed Content + Context Rail ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 lg:gap-3.5 items-start">
        <div className="flex flex-col min-w-0">
          <div role="tablist" aria-label="Lease sections" className="flex bg-white border border-slate-200/80 p-1.5 rounded-[20px] shadow-[0_2px_15px_rgb(0,0,0,0.02)] gap-1 overflow-x-auto flex-nowrap mb-6">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                role="tab"
                id={`tab-${tab.key}`}
                aria-selected={activeTab === tab.key}
                aria-controls={`panel-${tab.key}`}
                tabIndex={activeTab === tab.key ? 0 : -1}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "px-4 py-2 rounded-xl transition-all duration-300 flex items-center gap-2 shrink-0 whitespace-nowrap text-xs font-medium",
                  activeTab === tab.key ? "bg-[#151936] text-white shadow-2xs" : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                )}
              >
                <tab.icon size={15} aria-hidden="true" />
                {tab.label}
              </button>
            ))}
          </div>

          <div id={`panel-${activeTab}`} role="tabpanel" aria-labelledby={`tab-${activeTab}`}>
            {activeTab === "overview" && (
              <div className="flex flex-col gap-5 animate-fade-in-up">
                {/* Executive Tenancy Terms & Commitment Spec Card */}
                <div className="bg-white border border-slate-200/80 rounded-[24px] p-6 shadow-[0_2px_15px_rgb(0,0,0,0.02)]">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-5 border-b border-slate-100">
                    <div>
                      <h3 className="text-base font-medium text-slate-900">Executive Tenancy Specifications</h3>
                      <p className="text-xs text-slate-500 mt-0.5 font-medium">
                        Contractual parameters and financial obligations for {lease.unitLabel ? `Unit ${lease.unitLabel}` : lease.propertyCode}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap shrink-0">
                      <Badge tone={lease.isActive ? "success" : "neutral"}>
                        {lease.isActive ? "ACTIVE LEASE" : "TERMINATED"}
                      </Badge>
                      <Badge tone="neutral">LSE-{lease.id.slice(0, 8).toUpperCase()}</Badge>
                      <Badge tone={lease.balanceKes > 0 ? "risk" : "success"}>
                        {lease.balanceKes > 0 ? `${formatCompactKES(lease.balanceKes)} ARREARS` : "RENT CURRENT"}
                      </Badge>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="flex flex-col gap-1.5 p-4 rounded-2xl bg-slate-50/70 border border-slate-100 hover:border-slate-200 transition-colors">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-500 uppercase tracking-wider font-mono">Monthly Rent</span>
                        <Badge tone="neutral">RENT</Badge>
                      </div>
                      <p className="font-mono text-xl font-medium text-slate-900 mt-1">{formatCompactKES(monthlyRentNum)}</p>
                      <span className="text-xs text-slate-400 font-mono">KES / month</span>
                    </div>

                    <div className="flex flex-col gap-1.5 p-4 rounded-2xl bg-indigo-50/40 border border-indigo-100/60 hover:border-indigo-200/80 transition-colors">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-indigo-700 uppercase tracking-wider font-mono">Security Deposit</span>
                        <Badge tone="primary">HELD ON FILE</Badge>
                      </div>
                      <p className="font-mono text-xl font-medium text-indigo-950 mt-1">{depositNum ? formatCompactKES(depositNum) : "None"}</p>
                      <span className="text-xs text-indigo-500/80 font-mono">Refundable escrow</span>
                    </div>

                    <div className="flex flex-col gap-1.5 p-4 rounded-2xl bg-slate-50/70 border border-slate-100 hover:border-slate-200 transition-colors">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-500 uppercase tracking-wider font-mono">Commencement</span>
                        <Badge tone="neutral">START DATE</Badge>
                      </div>
                      <p className="font-mono text-sm font-medium text-slate-900 mt-1">
                        {new Date(lease.startsAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </p>
                      <span className="text-xs text-slate-400 font-mono">Tenancy effective</span>
                    </div>

                    <div className="flex flex-col gap-1.5 p-4 rounded-2xl bg-slate-50/70 border border-slate-100 hover:border-slate-200 transition-colors">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-500 uppercase tracking-wider font-mono">Expiration</span>
                        <Badge tone={daysRemaining <= 30 ? "warning" : "neutral"}>EXPIRY DATE</Badge>
                      </div>
                      <p className="font-mono text-sm font-medium text-slate-900 mt-1">
                        {new Date(lease.endsAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </p>
                      <span className="text-xs text-slate-400 font-mono">{leaseTermLabel(lease)}</span>
                    </div>

                    <div className={cn(
                      "flex flex-col gap-1.5 p-4 rounded-2xl border transition-colors",
                      lease.balanceKes > 0 ? "bg-rose-50/50 border-rose-100 hover:border-rose-200" : "bg-emerald-50/40 border-emerald-100 hover:border-emerald-200"
                    )}>
                      <div className="flex items-center justify-between">
                        <span className={cn("text-xs font-medium uppercase tracking-wider font-mono", lease.balanceKes > 0 ? "text-rose-700" : "text-emerald-700")}>
                          Account Status
                        </span>
                        <Badge tone={lease.balanceKes > 0 ? "risk" : "success"}>
                          {lease.balanceKes > 0 ? "ARREARS" : "CLEARED"}
                        </Badge>
                      </div>
                      <p className={cn("font-mono text-xl font-medium mt-1", lease.balanceKes > 0 ? "text-rose-700" : "text-emerald-800")}>
                        {lease.balanceKes > 0 ? formatCompactKES(lease.balanceKes) : "Rent Current"}
                      </p>
                      <span className="text-xs text-slate-500 font-mono">Current period balance</span>
                    </div>

                    <div className="flex flex-col gap-1.5 p-4 rounded-2xl bg-slate-50/70 border border-slate-100 hover:border-slate-200 transition-colors">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-500 uppercase tracking-wider font-mono">Tenure Elapsed</span>
                        <Badge tone="neutral">{tenurePct}%</Badge>
                      </div>
                      <p className="font-mono text-sm font-medium text-slate-900 mt-1">{daysRemaining} days left</p>
                      <span className="text-xs text-slate-400 font-mono">Term progression</span>
                    </div>

                    <div className="flex flex-col gap-1.5 p-4 rounded-2xl bg-slate-50/70 border border-slate-100 hover:border-slate-200 transition-colors">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-500 uppercase tracking-wider font-mono">Billing Cycle</span>
                        <Badge tone="neutral">MONTHLY</Badge>
                      </div>
                      <p className="text-xs font-medium text-slate-900 mt-1">In advance (1st of month)</p>
                      <span className="text-xs text-slate-400 font-mono">Automated invoicing</span>
                    </div>

                    <div className="flex flex-col gap-1.5 p-4 rounded-2xl bg-slate-50/70 border border-slate-100 hover:border-slate-200 transition-colors">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-500 uppercase tracking-wider font-mono">Notice Period</span>
                        <Badge tone="neutral">30 DAYS</Badge>
                      </div>
                      <p className="text-xs font-medium text-slate-900 mt-1">Written notice required</p>
                      <span className="text-xs text-slate-400 font-mono">Standard covenant</span>
                    </div>
                  </div>

                  <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
                    <span className="flex items-center gap-1.5">
                      <IconShield size={14} className="text-indigo-600 shrink-0" />
                      Security deposits are held in a client escrow account in compliance with Sunland CRM standards.
                    </span>
                    <span className="font-mono text-slate-400 hidden sm:inline">REF: {lease.propertyCode}</span>
                  </div>
                </div>

                {/* Property Units & Co-Tenants Breakdown Card */}
                {propActiveLeases.length > 0 && (
                  <div className="bg-white border border-slate-200/80 rounded-[24px] p-6 shadow-[0_2px_15px_rgb(0,0,0,0.02)]">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
                      <div>
                        <h3 className="text-base font-medium text-slate-900">Property Units & Active Tenancies</h3>
                        <p className="text-xs text-slate-500 mt-0.5 font-medium">
                          Overview of all active unit leases in {lease.propertyName} ({propActiveLeases.length} of {totalUnits} units active)
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge tone="data">{occupancyPct}% Property Occupancy</Badge>
                        <Badge tone="neutral">TOTAL ROLL: {formatCompactKES(totalPropertyRentPool)}/mo</Badge>
                      </div>
                    </div>

                    <div className="divide-y divide-slate-100 overflow-x-auto">
                      {propActiveLeases.map((al) => {
                        const isCurrentLease = al.id === lease.id;
                        return (
                          <div
                            key={al.id}
                            className={cn(
                              "flex items-center justify-between py-3.5 px-3 rounded-2xl transition-all duration-300 min-w-[550px]",
                              isCurrentLease ? "bg-amber-50/80 border border-amber-200/80 shadow-2xs" : "hover:bg-slate-50/80"
                            )}
                          >
                            <div className="flex items-center gap-3.5">
                              <Avatar
                                src={al.tenantAvatarUrl || undefined}
                                fallback={getInitials(al.tenantName)}
                                className="size-9 text-xs bg-[#151936] text-white border border-[#151936]/20 shrink-0 shadow-2xs"
                              />
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="text-xs font-medium text-slate-900 leading-snug">{al.tenantName}</p>
                                  {isCurrentLease && <Badge tone="warning">CURRENTLY VIEWING</Badge>}
                                </div>
                                <div className="flex items-center gap-1.5 mt-1">
                                  {al.unitLabel && <Badge tone="brand">Unit {al.unitLabel}</Badge>}
                                  {al.unitType && <Badge tone="neutral">{al.unitType}</Badge>}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-5">
                              <div className="flex flex-col items-end">
                                <span className="font-mono text-xs font-medium text-[#151936]">{formatCompactKES(parseFloat(al.monthlyRentKes))}/mo</span>
                                <span className="text-xs text-slate-400 font-mono mt-0.5">
                                  {new Date(al.startsAt).getFullYear()} — {new Date(al.endsAt).getFullYear()}
                                </span>
                              </div>
                              {!isCurrentLease ? (
                                <button
                                  type="button"
                                  onClick={() => router.push(`/admin/leases/${al.id}`)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/80 text-xs font-medium transition-all shadow-2xs hover:shadow-xs"
                                >
                                  Open Lease <IconArrowUpRight size={13} />
                                </button>
                              ) : (
                                <span className="text-xs font-mono text-amber-800 font-medium px-3 py-1 bg-amber-100/90 border border-amber-200/80 rounded-xl">Active File</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Notes & Special Directives Card */}
                <div className="bg-white border border-slate-200/80 rounded-[24px] p-6 shadow-[0_2px_15px_rgb(0,0,0,0.02)]">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2.5">
                      <div className="size-9 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-center text-slate-600 shadow-2xs">
                        <IconFileText size={16} />
                      </div>
                      <div>
                        <h3 className="text-base font-medium text-slate-900">Notes & Special Directives</h3>
                        <p className="text-xs text-slate-500 font-medium">Operational instructions and special covenant terms for this tenancy</p>
                      </div>
                    </div>
                    {canManage && (
                      <button
                        type="button"
                        onClick={() => setEditModalOpen(true)}
                        className="bg-white text-slate-700 hover:bg-slate-50 border border-slate-200/80 font-medium text-xs rounded-xl px-3.5 py-1.5 shadow-2xs transition-colors flex items-center gap-1.5"
                      >
                        <IconEdit size={13} /> Edit Directives
                      </button>
                    )}
                  </div>
                  {lease.notes ? (
                    <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-100 text-sm text-slate-700 leading-relaxed font-medium whitespace-pre-wrap">
                      {lease.notes}
                    </div>
                  ) : (
                    <div className="p-6 rounded-2xl bg-slate-50/40 border border-slate-100 border-dashed flex flex-col items-center justify-center text-center gap-2">
                      <p className="text-xs text-slate-400 font-medium">No special directives or notes recorded for this tenancy yet.</p>
                      {canManage && (
                        <button
                          type="button"
                          onClick={() => setEditModalOpen(true)}
                          className="text-xs font-medium text-[#151936] hover:underline"
                        >
                          + Add Special Directives
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === "payments" && (
              <div className="flex flex-col gap-5 animate-fade-in-up">
                {/* Payment Financial Summary KPI Vitals */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white border border-slate-200/80 rounded-[20px] p-4 flex flex-col justify-between shadow-[0_2px_15px_rgb(0,0,0,0.02)]">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-500 uppercase tracking-wider font-mono">Total Settled</span>
                      <Badge tone="success">COLLECTED</Badge>
                    </div>
                    <p className="font-mono text-xl font-medium text-emerald-700 mt-2">
                      {formatCompactKES(payments?.reduce((sum, p) => sum + (p.type === "rent" ? parseFloat(p.amountKes || "0") : 0), 0) ?? 0)}
                    </p>
                    <span className="text-xs text-slate-400 font-mono mt-1">Rent collected to date</span>
                  </div>

                  <div className="bg-white border border-slate-200/80 rounded-[20px] p-4 flex flex-col justify-between shadow-[0_2px_15px_rgb(0,0,0,0.02)]">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-500 uppercase tracking-wider font-mono">Current Balance</span>
                      <Badge tone={lease.balanceKes > 0 ? "risk" : "success"}>
                        {lease.balanceKes > 0 ? "OVERDUE" : "CLEARED"}
                      </Badge>
                    </div>
                    <p className={cn("font-mono text-xl font-medium mt-2", lease.balanceKes > 0 ? "text-rose-700" : "text-slate-900")}>
                      {formatCompactKES(lease.balanceKes)}
                    </p>
                    <span className="text-xs text-slate-400 font-mono mt-1">Current period due</span>
                  </div>

                  <div className="bg-white border border-slate-200/80 rounded-[20px] p-4 flex flex-col justify-between shadow-[0_2px_15px_rgb(0,0,0,0.02)]">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-500 uppercase tracking-wider font-mono">Monthly Rate</span>
                      <Badge tone="neutral">CONTRACTED</Badge>
                    </div>
                    <p className="font-mono text-xl font-medium text-slate-900 mt-2">{formatCompactKES(monthlyRentNum)}</p>
                    <span className="text-xs text-slate-400 font-mono mt-1">Per billing cycle</span>
                  </div>

                  <div className="bg-white border border-slate-200/80 rounded-[20px] p-4 flex flex-col justify-between shadow-[0_2px_15px_rgb(0,0,0,0.02)]">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-500 uppercase tracking-wider font-mono">Ledger Entries</span>
                      <Badge tone="data">{payments?.length ?? 0} RECORDS</Badge>
                    </div>
                    <p className="font-mono text-xl font-medium text-slate-900 mt-2">{payments?.length ?? 0}</p>
                    <span className="text-xs text-slate-400 font-mono mt-1">Total transactions</span>
                  </div>
                </div>

                {/* Ledger Container */}
                <div className="bg-white border border-slate-200/80 rounded-[24px] p-6 shadow-[0_2px_15px_rgb(0,0,0,0.02)] flex flex-col gap-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                    <div>
                      <h3 className="text-base font-medium text-slate-900">Rental Ledger & Financial Transactions</h3>
                      <p className="text-xs text-slate-500 mt-0.5 font-medium">
                        Comprehensive audit of all rent payments, receipts, and deposits for {lease.unitLabel ? `Unit ${lease.unitLabel}` : lease.propertyName}
                      </p>
                    </div>

                    {canManage && (
                      <button
                        type="button"
                        onClick={() => {
                          pushToast({
                            tone: "info",
                            title: "Record Payment",
                            body: "Posting payment entry directly to ledger...",
                          });
                        }}
                        className="bg-[#151936] text-white hover:bg-[#1f254e] font-medium text-xs rounded-xl px-4 py-2 shadow-2xs transition-all flex items-center gap-1.5 shrink-0"
                      >
                        <IconCash size={15} /> Record Payment
                      </button>
                    )}
                  </div>

                  {paymentsLoading ? (
                    <div className="flex justify-center py-12"><LoadingSpinner size="md" /></div>
                  ) : !payments || payments.length === 0 ? (
                    <div className="flex flex-col items-center text-center gap-3 py-14 bg-slate-50/40 rounded-2xl border border-slate-100 border-dashed">
                      <div className="size-14 rounded-2xl bg-white border border-slate-200/80 flex items-center justify-center shadow-2xs">
                        <IconCash size={28} className="text-slate-400" />
                      </div>
                      <h4 className="text-sm font-medium text-slate-800">No payment transactions recorded</h4>
                      <p className="text-slate-400 max-w-sm text-xs font-medium">
                        Rent receipts, deposit postings, and other financial transaction records for this lease will appear here.
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* Filter Controls */}
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="relative flex-1 min-w-[220px]">
                          <IconSearch size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                          <input
                            value={paymentSearchQuery}
                            onChange={(e) => { setPaymentSearchQuery(e.target.value); setPaymentPage(1); }}
                            placeholder="Search by note, type, or reference..."
                            className="w-full h-9 rounded-xl border border-slate-200 bg-slate-50/50 pl-9 pr-3 text-xs font-medium focus:outline-none focus:bg-white focus:border-[#151936]/40 transition-all shadow-2xs placeholder:text-slate-400"
                          />
                        </div>
                        <div className="relative shrink-0">
                          <IconFilter size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                          <select
                            value={paymentTypeFilter}
                            onChange={(e) => { setPaymentTypeFilter(e.target.value); setPaymentPage(1); }}
                            className="h-9 rounded-xl border border-slate-200 bg-white pl-9 pr-8 text-xs focus:outline-none focus:border-[#151936]/40 transition-colors shadow-2xs appearance-none font-medium text-slate-700 cursor-pointer"
                          >
                            <option value="all">All Payment Types</option>
                            {Object.entries(PAYMENT_TYPE_LABEL).map(([value, label]) => (
                              <option key={value} value={value}>{label}</option>
                            ))}
                          </select>
                        </div>
                        {(paymentSearchQuery || paymentTypeFilter !== "all") && (
                          <button
                            type="button"
                            onClick={() => { setPaymentSearchQuery(""); setPaymentTypeFilter("all"); setPaymentPage(1); }}
                            className="text-xs text-slate-500 hover:text-slate-900 font-medium px-2 py-1 underline"
                          >
                            Clear filters
                          </button>
                        )}
                      </div>

                      {paginatedPayments.length === 0 ? (
                        <div className="p-12 text-center text-slate-400 text-xs font-mono bg-slate-50/40 rounded-2xl border border-slate-100">
                          No transactions match your search filter query.
                        </div>
                      ) : (
                        <div className="divide-y divide-slate-100 overflow-x-auto">
                          {paginatedPayments.map((p) => (
                            <div
                              key={p.id}
                              className="flex items-center justify-between py-3.5 px-3 -mx-3 rounded-2xl hover:bg-slate-50/80 transition-colors min-w-[550px]"
                            >
                              <div className="flex items-center gap-3.5 min-w-0">
                                <div className="size-10 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-center shrink-0 shadow-2xs text-slate-600">
                                  <IconCash size={17} />
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono text-xs font-medium text-[#151936]">
                                      TXN-{p.id.slice(0, 8).toUpperCase()}
                                    </span>
                                    <Badge tone="neutral">{PAYMENT_TYPE_LABEL[p.type]}</Badge>
                                    <Badge tone="success">CLEARED</Badge>
                                  </div>
                                  <p className="text-xs text-slate-500 mt-1 font-medium truncate">
                                    {p.notes || `Rent payment processed for ${lease.propertyName}`}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-5 shrink-0">
                                <div className="flex flex-col items-end">
                                  <span className="font-mono font-medium text-base text-[#151936]">
                                    {formatCompactKES(parseFloat(p.amountKes))}
                                  </span>
                                  <span className="text-xs font-mono text-slate-400 mt-0.5">
                                    {new Date(p.occurredAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {paymentTotalPages > 1 && (
                        <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                          <span className="text-xs font-medium text-slate-500 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100 font-mono">
                            Page {safePaymentPage} of {paymentTotalPages} · {filteredPayments.length} records
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setPaymentPage(Math.max(1, safePaymentPage - 1))}
                              disabled={safePaymentPage <= 1}
                              className="size-8 rounded-xl border border-slate-200 flex items-center justify-center text-slate-600 disabled:text-slate-200 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors shadow-2xs"
                            >
                              <IconChevronLeft size={15} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setPaymentPage(Math.min(paymentTotalPages, safePaymentPage + 1))}
                              disabled={safePaymentPage >= paymentTotalPages}
                              className="size-8 rounded-xl border border-slate-200 flex items-center justify-center text-slate-600 disabled:text-slate-200 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors shadow-2xs"
                            >
                              <IconChevronRight size={15} />
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}

            {activeTab === "units" && (
              <div className="flex flex-col gap-5 animate-fade-in-up">
                {/* Vitals summary bar */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white border border-slate-200/80 rounded-[20px] p-4 flex flex-col justify-between shadow-[0_2px_15px_rgb(0,0,0,0.02)]">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-500 uppercase tracking-wider font-mono">Total Units</span>
                      <Badge tone="data">{occupancyPct}% OCCUPIED</Badge>
                    </div>
                    <p className="font-mono text-xl font-medium text-slate-900 mt-2">{totalUnits} Units</p>
                    <span className="text-xs text-slate-400 font-mono mt-1">{lease.propertyName}</span>
                  </div>

                  <div className="bg-white border border-slate-200/80 rounded-[20px] p-4 flex flex-col justify-between shadow-[0_2px_15px_rgb(0,0,0,0.02)]">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-500 uppercase tracking-wider font-mono">Active Leases</span>
                      <Badge tone="success">TENANTS</Badge>
                    </div>
                    <p className="font-mono text-xl font-medium text-emerald-700 mt-2">{propActiveLeases.length} Active</p>
                    <span className="text-xs text-slate-400 font-mono mt-1">Occupied units</span>
                  </div>

                  <div className="bg-white border border-slate-200/80 rounded-[20px] p-4 flex flex-col justify-between shadow-[0_2px_15px_rgb(0,0,0,0.02)]">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-500 uppercase tracking-wider font-mono">Total Rent Roll</span>
                      <Badge tone="neutral">MONTHLY</Badge>
                    </div>
                    <p className="font-mono text-xl font-medium text-[#151936] mt-2">{formatCompactKES(totalPropertyRentPool)}</p>
                    <span className="text-xs text-slate-400 font-mono mt-1">Property rent pool</span>
                  </div>

                  <div className="bg-white border border-slate-200/80 rounded-[20px] p-4 flex flex-col justify-between shadow-[0_2px_15px_rgb(0,0,0,0.02)]">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-500 uppercase tracking-wider font-mono">Unit Categories</span>
                      <Badge tone="primary">MULTI-UNIT</Badge>
                    </div>
                    <p className="font-mono text-xl font-medium text-slate-900 mt-2">{unitTypeEntries.length} Types</p>
                    <span className="text-xs text-slate-400 font-mono mt-1">Layout configurations</span>
                  </div>
                </div>

                {/* Directory Table Card */}
                <div className="bg-white border border-slate-200/80 rounded-[24px] p-6 shadow-[0_2px_15px_rgb(0,0,0,0.02)] flex flex-col gap-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                    <div>
                      <h3 className="text-base font-medium text-slate-900">Property Unit & Tenancy Directory</h3>
                      <p className="text-xs text-slate-500 mt-0.5 font-medium">
                        Multi-unit occupancy roster and co-tenant lease details for {lease.propertyName}
                      </p>
                    </div>
                    <Link
                      href={`/admin/properties/${lease.propertyId}`}
                      className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/80 font-medium text-xs rounded-xl px-3.5 py-2 shadow-2xs transition-colors flex items-center gap-1.5 shrink-0 self-start sm:self-auto"
                    >
                      Manage Property <IconArrowUpRight size={13} />
                    </Link>
                  </div>

                  <div className="divide-y divide-slate-100 overflow-x-auto">
                    {propActiveLeases.map((al) => {
                      const isCurrentLease = al.id === lease.id;
                      return (
                        <div
                          key={al.id}
                          className={cn(
                            "flex items-center justify-between py-4 px-3 -mx-3 rounded-2xl transition-all duration-300 min-w-[600px]",
                            isCurrentLease ? "bg-amber-50/80 border border-amber-200/80 shadow-2xs" : "hover:bg-slate-50/80"
                          )}
                        >
                          <div className="flex items-center gap-3.5">
                            <Avatar
                              src={al.tenantAvatarUrl || undefined}
                              fallback={getInitials(al.tenantName)}
                              className="size-10 text-xs bg-[#151936] text-white border border-[#151936]/20 shrink-0 shadow-2xs"
                            />
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="text-xs font-medium text-slate-900 leading-snug">{al.tenantName}</p>
                                {isCurrentLease && <Badge tone="warning">CURRENTLY VIEWING</Badge>}
                              </div>
                              <div className="flex items-center gap-1.5 mt-1">
                                {al.unitLabel && <Badge tone="brand">Unit {al.unitLabel}</Badge>}
                                {al.unitType && <Badge tone="neutral">{al.unitType}</Badge>}
                                <span className="text-xs text-slate-400 font-mono">
                                  {al.tenantEmail || al.tenantPhone || "No contact info"}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-6 shrink-0">
                            <div className="flex flex-col items-end">
                              <span className="font-mono text-xs font-medium text-[#151936]">{formatCompactKES(parseFloat(al.monthlyRentKes))}/mo</span>
                              <span className="text-xs text-slate-400 font-mono mt-0.5">
                                {new Date(al.startsAt).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })} — {new Date(al.endsAt).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
                              </span>
                            </div>
                            {!isCurrentLease ? (
                              <button
                                type="button"
                                onClick={() => router.push(`/admin/leases/${al.id}`)}
                                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/80 text-xs font-medium transition-all shadow-2xs hover:shadow-xs"
                              >
                                Open File <IconArrowUpRight size={13} />
                              </button>
                            ) : (
                              <span className="text-xs font-mono text-amber-800 font-medium px-3.5 py-1.5 bg-amber-100/90 border border-amber-200/80 rounded-xl">
                                Active File
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {activeTab === "documents" && (
              <div className="flex flex-col gap-5 animate-fade-in-up">
                {/* Document Summary Vitals */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white border border-slate-200/80 rounded-[20px] p-4 flex flex-col justify-between shadow-[0_2px_15px_rgb(0,0,0,0.02)]">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-500 uppercase tracking-wider font-mono">Attached Files</span>
                      <Badge tone="data">SECURE VAULT</Badge>
                    </div>
                    <p className="font-mono text-xl font-medium text-slate-900 mt-2">{leaseDocuments?.length ?? 0} Documents</p>
                    <span className="text-xs text-slate-400 font-mono mt-1">Encrypted repository</span>
                  </div>

                  <div className="bg-white border border-slate-200/80 rounded-[20px] p-4 flex flex-col justify-between shadow-[0_2px_15px_rgb(0,0,0,0.02)]">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-500 uppercase tracking-wider font-mono">Lease Contract</span>
                      <Badge tone={leaseDocuments?.some(d => d.type === "lease_agreement") ? "success" : "warning"}>
                        {leaseDocuments?.some(d => d.type === "lease_agreement") ? "VERIFIED" : "MISSING"}
                      </Badge>
                    </div>
                    <p className="font-mono text-xs font-medium text-slate-900 mt-2">
                      {leaseDocuments?.some(d => d.type === "lease_agreement") ? "Contract on file" : "Needs attachment"}
                    </p>
                    <span className="text-xs text-slate-400 font-mono mt-1">Primary agreement</span>
                  </div>

                  <div className="bg-white border border-slate-200/80 rounded-[20px] p-4 flex flex-col justify-between shadow-[0_2px_15px_rgb(0,0,0,0.02)]">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-500 uppercase tracking-wider font-mono">Tenant ID Records</span>
                      <Badge tone="neutral">KYC COMPLIANT</Badge>
                    </div>
                    <p className="font-mono text-xl font-medium text-slate-900 mt-2">
                      {leaseDocuments?.filter(d => d.type === "identification").length ?? 0} ID Files
                    </p>
                    <span className="text-xs text-slate-400 font-mono mt-1">Identity documents</span>
                  </div>

                  <div className="bg-white border border-slate-200/80 rounded-[20px] p-4 flex flex-col justify-between shadow-[0_2px_15px_rgb(0,0,0,0.02)]">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-500 uppercase tracking-wider font-mono">Total Size</span>
                      <Badge tone="neutral">FILE STORAGE</Badge>
                    </div>
                    <p className="font-mono text-xl font-medium text-[#151936] mt-2">
                      {formatFileSize(leaseDocuments?.reduce((sum, d) => sum + (d.fileSizeBytes ?? 0), 0) ?? 0)}
                    </p>
                    <span className="text-xs text-slate-400 font-mono mt-1">Cloud file volume</span>
                  </div>
                </div>

                {/* Main Documents Container */}
                <div className="bg-white border border-slate-200/80 rounded-[24px] p-6 shadow-[0_2px_15px_rgb(0,0,0,0.02)] flex flex-col gap-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                    <div>
                      <h3 className="text-base font-medium text-slate-900">Document Repository</h3>
                      <p className="text-xs text-slate-500 mt-0.5 font-medium">
                        Executed lease agreements, compliance certificates, and receipt statements
                      </p>
                    </div>
                    {canManage && (
                      <button
                        type="button"
                        onClick={() => setUploadDocOpen(true)}
                        className="bg-[#151936] text-white hover:bg-[#1f254e] font-medium text-xs rounded-xl px-4 py-2 shadow-2xs transition-all flex items-center gap-1.5 shrink-0 self-start sm:self-auto"
                      >
                        <IconFileText size={15} /> Upload Document
                      </button>
                    )}
                  </div>

                  {documentsLoading ? (
                    <div className="flex justify-center py-12">
                      <LoadingSpinner size="md" />
                    </div>
                  ) : !leaseDocuments || leaseDocuments.length === 0 ? (
                    <div className="bg-slate-50/40 border border-slate-100 border-dashed rounded-2xl p-14 flex flex-col items-center text-center gap-3">
                      <div className="size-14 rounded-2xl bg-white border border-slate-200/80 flex items-center justify-center shadow-2xs text-slate-400">
                        <IconFileText size={28} />
                      </div>
                      <h4 className="text-sm font-medium text-slate-800">No attached documents</h4>
                      <p className="text-slate-400 max-w-sm text-xs font-medium">
                        Lease agreements, tenant ID copies, and rent statements attached to this file will appear here.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="relative flex-1 min-w-[220px]">
                          <IconSearch size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                          <input
                            value={docSearchQuery}
                            onChange={(e) => { setDocSearchQuery(e.target.value); setDocPage(1); }}
                            placeholder="Search by document title or type..."
                            className="w-full h-9 rounded-xl border border-slate-200 bg-slate-50/50 pl-9 pr-3 text-xs font-medium focus:outline-none focus:bg-white focus:border-[#151936]/40 transition-all shadow-2xs placeholder:text-slate-400"
                          />
                        </div>
                        <div className="relative shrink-0">
                          <IconFilter size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                          <select
                            value={docTypeFilter}
                            onChange={(e) => { setDocTypeFilter(e.target.value); setDocPage(1); }}
                            className="h-9 rounded-xl border border-slate-200 bg-white pl-9 pr-8 text-xs focus:outline-none focus:border-[#151936]/40 transition-colors shadow-2xs appearance-none font-medium text-slate-700 cursor-pointer"
                          >
                            <option value="all">All Document Types</option>
                            {Object.entries(LEASE_DOCUMENT_TYPE_LABEL).map(([value, label]) => (
                              <option key={value} value={value}>{label}</option>
                            ))}
                          </select>
                        </div>
                        {(docSearchQuery || docTypeFilter !== "all") && (
                          <button
                            type="button"
                            onClick={() => { setDocSearchQuery(""); setDocTypeFilter("all"); setDocPage(1); }}
                            className="text-xs text-slate-500 hover:text-slate-900 font-medium px-2 py-1 underline"
                          >
                            Clear filters
                          </button>
                        )}
                      </div>

                      {paginatedDocuments.length === 0 ? (
                        <div className="p-12 text-center text-slate-400 text-xs font-mono bg-slate-50/40 rounded-2xl border border-slate-100">
                          No documents match your search filter query.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {paginatedDocuments.map((doc) => {
                            const sizeLabel = formatFileSize(doc.fileSizeBytes);
                            const addedLabel = new Date(doc.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                            return (
                              <div
                                key={doc.id}
                                className="bg-slate-50/60 hover:bg-slate-50 border border-slate-200/80 rounded-2xl p-4 transition-all duration-300 flex flex-col justify-between gap-4 shadow-2xs hover:shadow-xs group"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex items-start gap-3 min-w-0">
                                    <div className="size-10 rounded-xl bg-[#151936] text-white flex items-center justify-center shrink-0 shadow-2xs">
                                      <IconFileText size={18} />
                                    </div>
                                    <div className="min-w-0">
                                      <h4 className="text-xs font-medium text-slate-900 truncate leading-snug">{doc.title}</h4>
                                      <div className="flex items-center gap-2 mt-1">
                                        <Badge tone="neutral">{LEASE_DOCUMENT_TYPE_LABEL[doc.type] ?? doc.type}</Badge>
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center justify-between pt-3 border-t border-slate-200/60 text-xs font-mono text-slate-400">
                                  <span>{[sizeLabel, `Added ${addedLabel}`].filter(Boolean).join(" · ")}</span>
                                  <a
                                    href={doc.fileUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-200/80 rounded-xl px-3 py-1.5 text-xs font-medium transition-colors shadow-2xs flex items-center gap-1.5 text-slate-900"
                                  >
                                    View File <IconArrowUpRight size={13} />
                                  </a>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {docTotalPages > 1 && (
                        <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                          <span className="text-xs font-medium text-slate-500 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100 font-mono">
                            Page {safeDocPage} of {docTotalPages} · {filteredDocuments.length} files
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setDocPage(Math.max(1, safeDocPage - 1))}
                              disabled={safeDocPage <= 1}
                              className="size-8 rounded-xl border border-slate-200 flex items-center justify-center text-slate-600 disabled:text-slate-200 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors shadow-2xs"
                            >
                              <IconChevronLeft size={15} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDocPage(Math.min(docTotalPages, safeDocPage + 1))}
                              disabled={safeDocPage >= docTotalPages}
                              className="size-8 rounded-xl border border-slate-200 flex items-center justify-center text-slate-600 disabled:text-slate-200 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors shadow-2xs"
                            >
                              <IconChevronRight size={15} />
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}

            {activeTab === "activity" && (
              <div className="flex flex-col gap-5 animate-fade-in-up">
                {/* Activity Vitals Summary */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white border border-slate-200/80 rounded-[20px] p-4 flex flex-col justify-between shadow-[0_2px_15px_rgb(0,0,0,0.02)]">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-500 uppercase tracking-wider font-mono">Logged Events</span>
                      <Badge tone="data">AUDIT TRAIL</Badge>
                    </div>
                    <p className="font-mono text-xl font-medium text-slate-900 mt-2">{activityLog?.length ?? 0} Events</p>
                    <span className="text-xs text-slate-400 font-mono mt-1">Immutable log history</span>
                  </div>

                  <div className="bg-white border border-slate-200/80 rounded-[20px] p-4 flex flex-col justify-between shadow-[0_2px_15px_rgb(0,0,0,0.02)]">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-500 uppercase tracking-wider font-mono">Modifications</span>
                      <Badge tone="neutral">EDITS</Badge>
                    </div>
                    <p className="font-mono text-xl font-medium text-slate-900 mt-2">
                      {activityLog?.filter(a => a.summary.toLowerCase().includes("updat") || a.summary.toLowerCase().includes("chang") || a.summary.toLowerCase().includes("edit")).length ?? 0}
                    </p>
                    <span className="text-xs text-slate-400 font-mono mt-1">Terms & status edits</span>
                  </div>

                  <div className="bg-white border border-slate-200/80 rounded-[20px] p-4 flex flex-col justify-between shadow-[0_2px_15px_rgb(0,0,0,0.02)]">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-500 uppercase tracking-wider font-mono">Financial Events</span>
                      <Badge tone="success">TRANSACTIONS</Badge>
                    </div>
                    <p className="font-mono text-xl font-medium text-emerald-700 mt-2">
                      {activityLog?.filter(a => a.summary.toLowerCase().includes("rent") || a.summary.toLowerCase().includes("pay") || a.summary.toLowerCase().includes("balance")).length ?? 0}
                    </p>
                    <span className="text-xs text-slate-400 font-mono mt-1">Ledger & payment logs</span>
                  </div>

                  <div className="bg-white border border-slate-200/80 rounded-[20px] p-4 flex flex-col justify-between shadow-[0_2px_15px_rgb(0,0,0,0.02)]">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-500 uppercase tracking-wider font-mono">Audit Status</span>
                      <Badge tone="success">VERIFIED</Badge>
                    </div>
                    <p className="font-mono text-xs font-medium text-[#151936] mt-2">
                      {activityLog && activityLog[0] ? relativeTime(activityLog[0].createdAt) : "No log"}
                    </p>
                    <span className="text-xs text-slate-400 font-mono mt-1">Most recent audit action</span>
                  </div>
                </div>

                {/* Audit Stream Container */}
                <div className="bg-white border border-slate-200/80 rounded-[24px] p-6 shadow-[0_2px_15px_rgb(0,0,0,0.02)] flex flex-col gap-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                    <div>
                      <h3 className="text-base font-medium text-slate-900 flex items-center gap-2">
                        Activity Log & Audit Trail
                        <Badge tone="success">VERIFIED AUDIT LOG</Badge>
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5 font-medium">
                        System-generated and user-initiated audit records for tenancy LSE-{lease.id.slice(0, 8).toUpperCase()}
                      </p>
                    </div>
                  </div>

                  {/* Search and Filters */}
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="relative flex-1 min-w-[220px]">
                      <IconSearch size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      <input
                        type="text"
                        placeholder="Search audit trail by keyword, actor, or action..."
                        value={activitySearchQuery}
                        onChange={(e) => {
                          setActivitySearchQuery(e.target.value);
                          setActivityPage(1);
                        }}
                        className="w-full h-9 rounded-xl border border-slate-200 bg-slate-50/50 pl-9 pr-3 text-xs font-medium focus:outline-none focus:bg-white focus:border-[#151936]/40 transition-all shadow-2xs placeholder:text-slate-400"
                      />
                    </div>
                    <div className="relative shrink-0">
                      <IconFilter size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      <select
                        value={activityFilter}
                        onChange={(e) => {
                          setActivityFilter(e.target.value);
                          setActivityPage(1);
                        }}
                        className="h-9 rounded-xl border border-slate-200 bg-white pl-9 pr-8 text-xs focus:outline-none focus:border-[#151936]/40 transition-colors shadow-2xs appearance-none font-medium text-slate-700 cursor-pointer"
                      >
                        <option value="all">All Event Types</option>
                        <option value="edits">Modifications & Edits</option>
                        <option value="terminations">Terminations & Delete</option>
                        <option value="system">System & Automated Logs</option>
                      </select>
                    </div>
                    {(activitySearchQuery || activityFilter !== "all") && (
                      <button
                        type="button"
                        onClick={() => { setActivitySearchQuery(""); setActivityFilter("all"); setActivityPage(1); }}
                        className="text-xs text-slate-500 hover:text-slate-900 font-medium px-2 py-1 underline"
                      >
                        Clear filters
                      </button>
                    )}
                  </div>

                  {activityLoading ? (
                    <div className="flex justify-center py-12">
                      <LoadingSpinner size="md" />
                    </div>
                  ) : !activityLog || activityLog.length === 0 ? (
                    <div className="bg-slate-50/40 border border-slate-100 border-dashed rounded-2xl p-14 flex flex-col items-center text-center gap-3">
                      <div className="size-14 rounded-2xl bg-white border border-slate-200/80 flex items-center justify-center shadow-2xs text-slate-400">
                        <IconHistory size={28} />
                      </div>
                      <h4 className="text-sm font-medium text-slate-800">No activity recorded</h4>
                      <p className="text-slate-400 max-w-sm text-xs font-medium">
                        System events and tenancy file modifications will be logged automatically here.
                      </p>
                    </div>
                  ) : paginatedActivity.length === 0 ? (
                    <div className="p-12 text-center text-slate-400 text-xs font-mono bg-slate-50/40 rounded-2xl border border-slate-100">
                      No activity logs match your filter criteria.
                    </div>
                  ) : (
                    <div className="flex flex-col gap-4 relative pl-2 my-2">
                      <div className="absolute left-[19px] top-4 bottom-6 w-0.5 bg-slate-200/80 z-0" />
                      {paginatedActivity.map((entry) => {
                        const lower = entry.summary.toLowerCase();
                        let IconComp = IconEdit;
                        let iconStyle = "bg-indigo-50 text-indigo-700 border-indigo-200/80";
                        let catLabel = "Modification";

                        if (lower.includes("rent") || lower.includes("pay") || lower.includes("kes") || lower.includes("balance") || lower.includes("deposit")) {
                          IconComp = IconCash;
                          iconStyle = "bg-emerald-50 text-emerald-700 border-emerald-200/80";
                          catLabel = "Financial";
                        } else if (lower.includes("terminat") || lower.includes("delet") || lower.includes("vacat")) {
                          IconComp = IconTrash;
                          iconStyle = "bg-rose-50 text-rose-700 border-rose-200/80";
                          catLabel = "Termination";
                        } else if (lower.includes("doc") || lower.includes("agreement") || lower.includes("upload") || lower.includes("file")) {
                          IconComp = IconFileText;
                          iconStyle = "bg-amber-50 text-amber-700 border-amber-200/80";
                          catLabel = "Document";
                        } else if (lower.includes("system") || lower.includes("auto")) {
                          IconComp = IconShield;
                          iconStyle = "bg-slate-100 text-slate-700 border-slate-200";
                          catLabel = "System";
                        }

                        const actionDetail = entry.actorName
                          ? entry.summary.replace(entry.actorName, "").replace(/^ - |^ — /, "").trim()
                          : entry.summary;

                        return (
                          <div key={entry.id} className="relative flex items-start gap-4 z-10 group">
                            <div className={cn("size-10 rounded-2xl border shadow-2xs flex items-center justify-center shrink-0 z-10 transition-transform group-hover:scale-105", iconStyle)}>
                              <IconComp size={18} />
                            </div>
                            <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-50/60 hover:bg-slate-50 border border-slate-200/80 rounded-2xl transition-all duration-300 shadow-2xs hover:shadow-xs">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  {entry.actorName ? (
                                    <span className="text-xs font-medium text-[#151936] flex items-center gap-1.5">
                                      <Avatar
                                        fallback={getInitials(entry.actorName)}
                                        className="size-5 text-[10px] bg-[#151936] text-white"
                                      />
                                      {entry.actorName}
                                    </span>
                                  ) : (
                                    <span className="text-xs font-medium text-slate-800 font-mono">System Engine</span>
                                  )}
                                  <Badge tone="neutral">{catLabel}</Badge>
                                </div>
                                <p className="text-xs text-slate-600 mt-1.5 leading-relaxed font-medium">
                                  {actionDetail}
                                </p>
                              </div>
                              <div className="flex flex-col items-start sm:items-end shrink-0 gap-1">
                                <span className="text-xs text-slate-400 font-mono">
                                  {new Date(entry.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} at {new Date(entry.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                                <Badge tone="neutral">{relativeTime(entry.createdAt)}</Badge>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {activityTotalPages > 1 && (
                    <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                      <span className="text-xs font-medium text-slate-500 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100 font-mono">
                        Page {safeActivityPage} of {activityTotalPages} · {filteredActivity.length} logs
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setActivityPage(Math.max(1, safeActivityPage - 1))}
                          disabled={safeActivityPage <= 1}
                          className="size-8 rounded-xl border border-slate-200 flex items-center justify-center text-slate-600 disabled:text-slate-200 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors shadow-2xs"
                        >
                          <IconChevronLeft size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setActivityPage(Math.min(activityTotalPages, safeActivityPage + 1))}
                          disabled={safeActivityPage >= activityTotalPages}
                          className="size-8 rounded-xl border border-slate-200 flex items-center justify-center text-slate-600 disabled:text-slate-200 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors shadow-2xs"
                        >
                          <IconChevronRight size={15} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Context rail */}
        <div className="flex flex-col gap-4">
          {/* Tenant Profile Card */}
          <div className="bg-white border border-slate-200/80 rounded-[24px] overflow-hidden shadow-[0_2px_15px_rgb(0,0,0,0.02)]">
            <div className="relative h-52 w-full flex flex-col justify-between p-5 text-center">
              {lease.tenantAvatarUrl ? (
                <Image src={lease.tenantAvatarUrl} alt={lease.tenantName} fill className="object-cover" />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-[#151936] to-[#0f132b]" />
              )}
              <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/15 to-black/60 z-0" />

              <div className="relative z-10 mt-2">
                <h4 className="text-xl font-medium text-white tracking-tight">{lease.tenantName}</h4>
                <div className="flex items-center justify-center gap-1.5 mt-1.5">
                  <Badge tone="primary">
                    {lease.unitLabel ? `Tenant · Unit ${lease.unitLabel}` : "Principal Tenant"}
                  </Badge>
                </div>
              </div>

              <div className="relative z-10 flex justify-center gap-2.5 mb-1">
                <Link
                  href="/admin/messages"
                  className="size-8 rounded-full bg-white hover:bg-slate-50 text-slate-900 shadow-md flex items-center justify-center transition-all cursor-pointer border border-slate-100"
                  title="Message"
                >
                  <IconMessageCircle size={15} />
                </Link>
                {lease.tenantPhone && (
                  <a
                    href={`tel:${lease.tenantPhone}`}
                    className="h-8 px-3.5 rounded-full bg-[#151936] hover:bg-[#1f254e] text-white flex items-center gap-1 text-xs font-medium shadow-md transition-all cursor-pointer"
                    title="Call"
                  >
                    <IconPhone size={13} /> Call
                  </a>
                )}
              </div>
            </div>

            <div className="p-4 flex flex-col gap-2 bg-slate-50/40">
              <div className="flex items-center justify-between p-1.5 bg-white border border-slate-100/80 rounded-xl shadow-2xs">
                <div className="flex items-center min-w-0">
                  <span className="size-7 rounded-lg bg-slate-50 flex items-center justify-center text-slate-600 shrink-0 border border-slate-100/50">
                    <IconPhone size={13} />
                  </span>
                  <span className="text-xs font-medium text-slate-600 ml-2">Phone</span>
                </div>
                <span className="text-xs font-mono font-medium text-slate-900 pr-2 truncate">{lease.tenantPhone || "—"}</span>
              </div>

              <div className="flex items-center justify-between p-1.5 bg-white border border-slate-100/80 rounded-xl shadow-2xs">
                <div className="flex items-center min-w-0">
                  <span className="size-7 rounded-lg bg-slate-50 flex items-center justify-center text-slate-600 shrink-0 border border-slate-100/50">
                    <IconMail size={13} />
                  </span>
                  <span className="text-xs font-medium text-slate-600 ml-2">Mail</span>
                </div>
                <span className="text-xs font-mono font-medium text-slate-900 pr-2 truncate max-w-[150px]" title={lease.tenantEmail || ""}>
                  {lease.tenantEmail || "—"}
                </span>
              </div>

              <button
                type="button"
                onClick={() => {
                  setSelectedDrawerTenantId(lease.tenantContactId);
                  setTenantProfileOpen(true);
                }}
                className="mt-1 w-full rounded-xl bg-white border border-slate-200/80 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs flex items-center justify-center gap-1.5"
              >
                View Full Profile
              </button>
            </div>
          </div>

          {/* Landlord Card */}
          {lease.landlord && (
            <div className="bg-white border border-slate-200/80 rounded-[24px] overflow-hidden shadow-[0_2px_15px_rgb(0,0,0,0.02)]">
              <div className="relative h-52 w-full flex flex-col justify-between p-5 text-center">
                {lease.landlord.avatarUrl ? (
                  <Image src={lease.landlord.avatarUrl} alt={lease.landlord.name} fill className="object-cover" />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-[#151936] to-[#0f132b]" />
                )}
                <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/15 to-black/60 z-0" />

                <div className="relative z-10 mt-2">
                  <h4 className="text-xl font-medium text-white tracking-tight">{lease.landlord.name}</h4>
                  <div className="flex items-center justify-center gap-1.5 mt-1.5">
                    {lease.landlord.verifiedAt ? (
                      <Badge tone="success">
                        <IconCircleCheck size={12} className="mr-1 inline-block" /> Verified Landlord
                      </Badge>
                    ) : (
                      <Badge tone="neutral">Landlord</Badge>
                    )}
                  </div>
                </div>

                <div className="relative z-10 flex justify-center gap-2.5 mb-1">
                  <Link
                    href="/admin/messages"
                    className="size-8 rounded-full bg-white hover:bg-slate-50 text-slate-900 shadow-md flex items-center justify-center transition-all cursor-pointer border border-slate-100"
                    title="Message"
                  >
                    <IconMessageCircle size={15} />
                  </Link>
                  {lease.landlord.phone && (
                    <a
                      href={`tel:${lease.landlord.phone}`}
                      className="h-8 px-3.5 rounded-full bg-[#151936] hover:bg-[#1f254e] text-white flex items-center gap-1 text-xs font-medium shadow-md transition-all cursor-pointer"
                      title="Call"
                    >
                      <IconPhone size={13} /> Call
                    </a>
                  )}
                </div>
              </div>

              <div className="p-4 flex flex-col gap-2 bg-slate-50/40">
                <div className="flex items-center justify-between p-1.5 bg-white border border-slate-100/80 rounded-xl shadow-2xs">
                  <div className="flex items-center min-w-0">
                    <span className="size-7 rounded-lg bg-slate-50 flex items-center justify-center text-slate-600 shrink-0 border border-slate-100/50">
                      <IconPhone size={13} />
                    </span>
                    <span className="text-xs font-medium text-slate-600 ml-2">Phone</span>
                  </div>
                  <span className="text-xs font-mono font-medium text-slate-900 pr-2 truncate">{lease.landlord.phone || "—"}</span>
                </div>

                <div className="flex items-center justify-between p-1.5 bg-white border border-slate-100/80 rounded-xl shadow-2xs">
                  <div className="flex items-center min-w-0">
                    <span className="size-7 rounded-lg bg-slate-50 flex items-center justify-center text-slate-600 shrink-0 border border-slate-100/50">
                      <IconMail size={13} />
                    </span>
                    <span className="text-xs font-medium text-slate-600 ml-2">Mail</span>
                  </div>
                  <span className="text-xs font-mono font-medium text-slate-900 pr-2 truncate max-w-[150px]" title={lease.landlord.email || ""}>
                    {lease.landlord.email || "—"}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setOwnerProfileOpen(true)}
                  className="mt-1 w-full rounded-xl bg-white border border-slate-200/80 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs flex items-center justify-center gap-1.5"
                >
                  View Full Profile
                </button>
              </div>
            </div>
          )}

          {/* Property Manager Card */}
          {lease.manager && (
            <div className="bg-white border border-slate-200/80 rounded-[24px] p-5 shadow-[0_2px_15px_rgb(0,0,0,0.02)] flex flex-col gap-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Avatar
                    src={lease.manager.avatarUrl || undefined}
                    fallback={getInitials(lease.manager.name || "Unassigned")}
                    className="size-11 text-xs bg-[#151936] text-white border border-[#151936]/20 shrink-0 shadow-2xs"
                  />
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium text-slate-900 leading-snug">{lease.manager.name || "Unassigned"}</h4>
                    <div className="flex items-center gap-1 mt-1">
                      <Badge tone="brand">Property Manager</Badge>
                    </div>
                  </div>
                </div>
                <Link
                  href="/admin/messages"
                  className="size-9 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors shadow-2xs"
                  title="Message Manager"
                >
                  <IconMessageCircle size={16} />
                </Link>
              </div>

              <button
                type="button"
                onClick={() => setManagerProfileOpen(true)}
                className="w-full rounded-xl bg-white border border-slate-200/80 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs flex items-center justify-center gap-1.5"
              >
                View Full Profile
              </button>
            </div>
          )}

          {/* Lease Timeline Card */}
          <div className="bg-white border border-slate-200/80 rounded-[24px] p-5 shadow-[0_2px_15px_rgb(0,0,0,0.02)] flex flex-col gap-4">
            <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider font-mono flex items-center gap-2">
              <IconCalendarEvent size={14} /> Lease Timeline
            </h3>
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between text-xs font-mono text-slate-600">
                <span>{tenurePct}% ELAPSED</span>
                <span>{lease.isActive ? `${daysRemaining}d remaining` : "Terminated"}</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden w-full">
                <div
                  style={{ width: `${tenurePct}%` }}
                  className={cn("h-full rounded-full transition-all duration-500", tenurePct >= 90 ? "bg-rose-500" : tenurePct >= 70 ? "bg-amber-400" : "bg-emerald-500")}
                />
              </div>
              <div className="flex items-center justify-between mt-1">
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs text-slate-400 font-mono uppercase">Commencement</span>
                  <span className="font-mono text-xs font-medium text-slate-900">{new Date(lease.startsAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                </div>
                <div className="flex flex-col gap-0.5 text-right">
                  <span className="text-xs text-slate-400 font-mono uppercase">Expiration</span>
                  <span className="font-mono text-xs font-medium text-slate-900">{new Date(lease.endsAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Facts Card */}
          <div className="bg-white border border-slate-200/80 rounded-[24px] p-5 shadow-[0_2px_15px_rgb(0,0,0,0.02)] flex flex-col gap-4">
            <h4 className="text-sm font-medium text-slate-900">Quick Reference</h4>
            <div className="flex flex-col gap-3 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Lease Ref</span>
                <span className="font-mono font-medium text-slate-900">LSE-{new Date(lease.startsAt).getFullYear()}-{lease.id.slice(0, 3).toUpperCase()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Property Code</span>
                <Badge tone="neutral">{lease.propertyCode}</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Property Type</span>
                <Badge tone="primary">{lease.propertyType}</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Next Payment Due</span>
                <span className="font-mono font-medium text-slate-900">
                  {lease.isActive
                    ? new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                    : "—"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleTerminate}
        title="Terminate Lease"
        description="Are you sure you want to terminate this lease agreement? The unit will become available immediately."
        confirmLabel="Terminate Lease"
        tone="danger"
        isLoading={isDeleting}
      />

      {editModalOpen && (
        <LeaseFormModal
          open={editModalOpen}
          mode="edit"
          lease={leaseToEditTarget(lease)}
          onClose={() => setEditModalOpen(false)}
          onSubmit={() => setRefreshCount((c) => c + 1)}
        />
      )}

      <LeaseRenewModal
        open={renewModalOpen}
        lease={leaseToRenewTarget(lease)}
        onClose={() => setRenewModalOpen(false)}
        onRenewed={(newLeaseId) => router.push(`/admin/leases/${newLeaseId}`)}
      />

      <LeaseDocumentModal
        open={uploadDocOpen}
        entityId={entityId}
        leaseId={lease.id}
        propertyId={lease.propertyId}
        leaseLabel={`${lease.propertyName} · ${lease.tenantName}`}
        onClose={() => setUploadDocOpen(false)}
        onAttached={refetchLeaseDocuments}
      />

      <TenantProfileDrawer
        open={tenantProfileOpen}
        onClose={() => {
          setTenantProfileOpen(false);
          setSelectedDrawerTenantId(null);
        }}
        entityId={entityId || ""}
        contactId={selectedDrawerTenantId || lease.tenantContactId}
      />

      {lease.landlord && (
        <PropertyOwnerProfileDrawer
          open={ownerProfileOpen}
          onClose={() => setOwnerProfileOpen(false)}
          entityId={entityId || ""}
          ownerContactId={lease.landlord.id}
          properties={[]}
          onOpenProperty={() => { }}
        />
      )}

      {lease.manager && (
        <PropertyManagerProfileDrawer
          open={managerProfileOpen}
          onClose={() => setManagerProfileOpen(false)}
          entityId={entityId || ""}
          managerId={lease.manager.id}
          properties={[]}
          onOpenProperty={() => { }}
        />
      )}

      <PhotoLightbox
        open={lightboxOpen}
        media={mediaList}
        index={lightboxIndex}
        onIndexChange={setLightboxIndex}
        onClose={() => setLightboxOpen(false)}
      />

      {lease.manager && (
        <NotifyUserModal
          open={notifyPmOpen}
          entityId={entityId}
          userId={lease.manager.id}
          recipientName={lease.manager.name || "Property Manager"}
          associatedType="lease"
          associatedId={lease.id}
          href={`/admin/leases/${lease.id}`}
          onClose={() => setNotifyPmOpen(false)}
        />
      )}
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
    notes: l.notes,
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
