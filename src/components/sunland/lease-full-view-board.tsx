"use client";

import { useEffect, useState, useMemo, type ComponentType } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  IconAlertTriangle,
  IconArrowUpRight,
  IconBan,
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
  IconMoodEmpty,
  IconPhone,
  IconPhoto,
  IconRefresh,
  IconSearch,
  IconShield,
  IconTrash,
  IconUser,
  IconUsers,
  IconBuildingCommunity,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Badge, SkeletonBlock } from "@/components/ui/erp-primitives";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Avatar } from "@/components/ui/erp-primitives";
import { DropdownMenu, DropdownItem } from "@/components/ui/dropdown-menu";
import { useToast } from "@/components/ui/toast-provider";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { PhotoLightbox } from "./photo-lightbox";
import { formatCompactKES, formatFileSize } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { PROPERTY_TYPE_ICON } from "./property-constants";
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
  landlord?: { id: string; name: string; email: string | null; phone: string | null; avatarUrl?: string | null; verifiedAt?: string | null; companyName?: string | null } | null;
  manager?: { id: string; name: string | null; title: string | null; email: string | null; avatarUrl?: string | null } | null;
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
  title: string;
  meta: string;
  cta: string;
  onClick: () => void;
}

const ACTION_TONE_CLASSES: Record<ActionTone, { div: string; iconWrap: string; cta: string }> = {
  amber: {
    div: "border-amber-200 bg-amber-500/[0.04] rounded-2xl p-4 flex items-center justify-between gap-4 border shadow-sm transition-all duration-300 hover:shadow-md",
    iconWrap: "bg-amber-100/80 text-amber-700 size-9 rounded-xl flex items-center justify-center shrink-0 shadow-xs",
    cta: "bg-[#f3df27] text-[#151936] font-medium text-xs rounded-xl px-4 py-1.5 hover:bg-[#e6d220] transition-colors shadow-sm whitespace-nowrap",
  },
  rose: {
    div: "border-rose-100 bg-rose-500/[0.02] rounded-2xl p-4 flex items-center justify-between gap-4 border shadow-sm transition-all duration-300 hover:shadow-md",
    iconWrap: "bg-rose-100/80 text-rose-600 size-9 rounded-xl flex items-center justify-center shrink-0 shadow-xs",
    cta: "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-medium text-xs rounded-xl px-4 py-1.5 transition-colors shadow-xs whitespace-nowrap",
  },
  neutral: {
    div: "border-slate-200/80 bg-slate-50/50 rounded-2xl p-4 flex items-center justify-between gap-4 border shadow-sm transition-all duration-300 hover:shadow-md",
    iconWrap: "bg-slate-100 text-slate-500 size-9 rounded-xl flex items-center justify-center shrink-0 shadow-xs",
    cta: "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-medium text-xs rounded-xl px-4 py-1.5 transition-colors shadow-xs whitespace-nowrap",
  },
};

type VitalTone = "emerald" | "amber" | "rose" | "neutral";

const VITAL_TONE_BG: Record<VitalTone, string> = {
  emerald: "bg-gradient-to-br from-white to-[#ecfdf5]/30 border-slate-200/80 hover:to-[#ecfdf5]/55",
  amber: "bg-gradient-to-br from-white to-[#fffbeb]/45 border-slate-200/80 hover:to-[#fffbeb]/70",
  rose: "bg-gradient-to-br from-white to-[#fff1f2]/30 border-slate-200/80 hover:to-[#fff1f2]/55",
  neutral: "bg-gradient-to-br from-white to-slate-50/40 border-slate-200/80 hover:to-slate-50/60",
};
const VITAL_TONE_BADGE_BG: Record<VitalTone, string> = {
  emerald: "bg-emerald-50 text-emerald-700",
  amber: "bg-amber-50 text-amber-700",
  rose: "bg-rose-50 text-rose-700",
  neutral: "bg-slate-100 text-slate-700",
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
  if (!lease.isActive) return "-";
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

type TabKey = "overview" | "payments" | "documents" | "activity";

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

  // Advanced Activity State
  const [activitySearchQuery, setActivitySearchQuery] = useState("");
  const [activityFilter, setActivityFilter] = useState("all");
  const [activityPage, setActivityPage] = useState(1);
  const ACTIVITY_PER_PAGE = 10;

  const [leaseDocuments, setLeaseDocuments] = useState<LeaseDocument[] | null>(null);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [documentsLoaded, setDocumentsLoaded] = useState(false);
  const [uploadDocOpen, setUploadDocOpen] = useState(false);

  // Documents search/filter/pagination (mirrors Activity above)
  const [docSearchQuery, setDocSearchQuery] = useState("");
  const [docTypeFilter, setDocTypeFilter] = useState("all");
  const [docPage, setDocPage] = useState(1);
  const DOC_PER_PAGE = 10;

  // Payment History - real rent-transaction ledger for this lease, lazy-
  // loaded on first visit to the tab (same convention as activity/documents).
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

  // Lazy-load audit trail
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

  // Lazy-load documents only once the Documents tab is actually opened.
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

  // Lazy-load payment history only once the Payment History tab is opened.
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
      { key: "payments", label: "Payment History", icon: IconCash },
      { key: "documents", label: "Documents", icon: IconFileText },
      { key: "activity", label: "Activity", icon: IconHistory },
    ] as { key: TabKey; label: string; icon: ComponentType<{ size?: number; className?: string }> }[];
  }, []);

  const filteredActivity = useMemo(() => {
    if (!activityLog) return [];
    let filtered = activityLog;
    if (activitySearchQuery) {
      const q = activitySearchQuery.toLowerCase();
      filtered = filtered.filter(a => a.summary.toLowerCase().includes(q));
    }
    if (activityFilter !== "all") {
      filtered = filtered.filter(a => {
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
      filtered = filtered.filter((p) =>
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
        title: `${formatCompactKES(lease.balanceKes)} in arrears`,
        meta: "Outstanding for this month",
        cta: "Review",
        onClick: () => setActiveTab("payments"),
      });
    }
    const daysLeft = Math.ceil((new Date(lease.endsAt).getTime() - renderTimestamp) / 86_400_000);
    if (lease.isActive && daysLeft >= 0 && daysLeft <= 30) {
      items.push({
        key: "expiring",
        tone: "amber",
        icon: IconClock,
        title: "Lease expiring soon",
        meta: `${daysLeft} day${daysLeft === 1 ? "" : "s"} remaining`,
        cta: "Renew",
        onClick: () => setRenewModalOpen(true),
      });
    }
    return items;
  }, [lease, renderTimestamp]);

  const getActivityTone = (summary: string) => {
    const lower = summary.toLowerCase();
    if (lower.includes("terminat") || lower.includes("delet")) return "bg-rose-300 ring-rose-50";
    if (lower.includes("updat") || lower.includes("chang")) return "bg-indigo-300 ring-indigo-50";
    return "bg-slate-200 ring-white";
  };

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
        <SkeletonBlock className="rounded-[28px] min-h-[300px] lg:min-h-[340px] mt-2" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4 mt-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonBlock key={i} className="rounded-2xl h-[150px]" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 lg:gap-3.5 items-start">
          <div className="flex flex-col gap-4 min-w-0">
            <SkeletonBlock className="h-12 w-full rounded-[16px]" />
            <SkeletonBlock className="h-64 w-full rounded-[24px]" />
          </div>
          <div className="flex flex-col gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <SkeletonBlock key={i} className="h-40 w-full rounded-[24px]" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error && !lease) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
        <IconAlertTriangle size={32} className="text-rose-400" aria-hidden="true" />
        <p className="text-title-primary">{error}</p>
        <Button variant="secondary" onClick={() => setRefreshCount((c) => c + 1)}>
          Retry
        </Button>
      </div>
    );
  }

  if (!lease) {
    return <div className="p-8 text-center text-desc-secondary">Lease not found.</div>;
  }

  const PropIcon = (PROPERTY_TYPE_ICON as Record<string, React.ElementType>)[lease.propertyType] ?? IconBuildingCommunity;
  const mediaList = lease.propertyMedia || [];
  const primaryImage = mediaList[activeMediaIndex]?.url ?? mediaList[0]?.url;
  const monthlyRentNum = parseFloat(lease.monthlyRentKes);
  const depositNum = lease.depositKes ? parseFloat(lease.depositKes) : null;
  const collectedThisMonth = Math.max(0, monthlyRentNum - lease.balanceKes);
  const paymentStatusPct = monthlyRentNum > 0 ? Math.round((collectedThisMonth / monthlyRentNum) * 100) : 0;
  // Mirrors mandate-full-view-board.tsx's collectionPctDisplay - collectedThisMonth
  // is already floor-clamped via balanceKes server-side so this can't exceed
  // 100 today, but capping the ring/text display here too keeps both gauges
  // defensively consistent if that server-side guarantee ever changes.
  const paymentStatusPctDisplay = Math.min(100, paymentStatusPct);
  const daysRemaining = Math.max(0, Math.ceil((new Date(lease.endsAt).getTime() - renderTimestamp) / 86_400_000));
  const tenurePct = getLeaseTenurePct(lease, renderTimestamp);

  const vitals = [
    {
      label: "Monthly Rent",
      value: formatCompactKES(monthlyRentNum),
      subText: "billed monthly",
      badgeText: "RENT",
      badgeTone: "neutral" as VitalTone,
      tone: "neutral" as VitalTone,
      icon: IconCalendarEvent,
      tab: "overview" as TabKey,
    },
    {
      label: "Deposit Held",
      value: depositNum ? formatCompactKES(depositNum) : "—",
      subText: "refundable liability",
      badgeText: depositNum ? "ON FILE" : "NONE",
      badgeTone: "neutral" as VitalTone,
      tone: "neutral" as VitalTone,
      icon: IconShield,
      tab: "overview" as TabKey,
    },
    {
      label: lease.balanceKes > 0 ? "Balance Due" : "Balance",
      value: formatCompactKES(lease.balanceKes),
      subText: lease.balanceKes > 0 ? "outstanding this month" : "fully settled",
      badgeText: lease.balanceKes > 0 ? "ACTION NEEDED" : "CLEARED",
      badgeTone: lease.balanceKes > 0 ? "rose" as VitalTone : "emerald" as VitalTone,
      tone: lease.balanceKes > 0 ? "rose" as VitalTone : "emerald" as VitalTone,
      icon: IconAlertTriangle,
      tab: "payments" as TabKey,
    },
    {
      label: lease.isActive ? "Days Remaining" : "Term Ended",
      value: lease.isActive ? `${daysRemaining}` : "—",
      subText: lease.isActive ? (daysRemaining <= 30 ? "renewal window" : "until expiry") : "lease terminated",
      badgeText: lease.isActive ? (daysRemaining <= 30 ? "EXPIRING SOON" : "ON TRACK") : "ENDED",
      badgeTone: lease.isActive ? (daysRemaining <= 30 ? "amber" as VitalTone : "neutral" as VitalTone) : "neutral" as VitalTone,
      tone: lease.isActive ? (daysRemaining <= 30 ? "amber" as VitalTone : "neutral" as VitalTone) : "neutral" as VitalTone,
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
          </div>
          <div className="flex items-center gap-3 text-slate-500 text-sm min-w-0 font-medium">
            <span className="flex items-center gap-1.5 min-w-0">
              <IconMapPin size={15} className="shrink-0 text-slate-600" aria-hidden="true" />
              <span className="truncate">{lease.propertyLocation || "Sunland Managed Location"}</span>
            </span>
            <span className="text-slate-200 shrink-0">|</span>
            <span className="mono-data text-slate-500 shrink-0">LEASE {lease.id.slice(0, 8).toUpperCase()}</span>
          </div>
        </div>

        {/* CTA Actions aligned to the right */}
        {canManage && (
          <div className="flex items-center gap-2 shrink-0 flex-wrap mt-1 sm:mt-0">
            <button
              type="button"
              onClick={() => setEditModalOpen(true)}
              className="bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 border border-slate-200/80 font-medium text-sm rounded-full px-4 py-2 shadow-xs transition-colors flex items-center gap-1.5"
            >
              <IconEdit size={14} /> Edit
            </button>
            {lease.isActive && (
              <button
                type="button"
                onClick={() => setRenewModalOpen(true)}
                className="bg-[#151936] text-white hover:bg-[#1a1f42] font-medium text-sm rounded-full px-4 py-2 shadow-[0_2px_10px_rgb(21,25,54,0.3)] transition-all flex items-center gap-1.5"
              >
                <IconRefresh size={14} /> Renew
              </button>
            )}
            <DropdownMenu
              label="More actions"
              align="right"
              trigger={
                <div className="inline-flex size-[38px] items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-xs cursor-pointer">
                  <IconDotsVertical size={16} />
                </div>
              }
            >
              <DropdownItem icon={IconLink} onClick={handleCopyLink}>Copy deep link</DropdownItem>
              {lease.manager && (
                <DropdownItem icon={IconBell} onClick={() => setNotifyPmOpen(true)}>Notify Property Manager</DropdownItem>
              )}
              <DropdownItem icon={IconBell} disabled title="Available once the landlord portal launches">Notify Landlord</DropdownItem>
              <DropdownItem icon={IconBell} disabled title="Available once the tenant portal launches">Notify Tenant</DropdownItem>
              {lease.isActive && (
                <DropdownItem icon={IconTrash} variant="danger" onClick={() => setDeleteConfirmOpen(true)}>Terminate lease</DropdownItem>
              )}
            </DropdownMenu>
          </div>
        )}
      </div>

      {/* ── Image-led Lease Hero ── */}
      <div className="flex flex-col gap-3">
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
          className="group relative rounded-[28px] overflow-hidden min-h-[300px] lg:min-h-[340px] shadow-[0_8px_30px_rgb(0,0,0,0.06)] bg-[#1e2336] text-white flex flex-col justify-between p-6 lg:p-8 mt-2 border border-slate-800 transition-all duration-500 hover:shadow-[0_20px_40px_rgb(0,0,0,0.12)] text-left w-full cursor-pointer disabled:cursor-default"
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
            <div className="absolute inset-0 bg-gradient-to-br from-slate-900 to-[#1e2336]" />
          )}
          {/* Scrim */}
          <div
            className="absolute inset-0 z-0"
            style={{ background: "linear-gradient(180deg, rgba(12,15,32,0.38) 0%, rgba(12,15,32,0.08) 34%, rgba(10,13,28,0.55) 68%, rgba(8,10,22,0.9) 100%)" }}
            aria-hidden="true"
          />

          {/* Elegant Hover Overlay */}
          {mediaList.length > 0 && (
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-500 flex items-center justify-center z-0">
              <span className="opacity-0 group-hover:opacity-100 transition-all duration-500 transform translate-y-4 group-hover:translate-y-0 bg-white/95 backdrop-blur-md text-[#151936] font-medium px-5 py-2.5 rounded-full shadow-lg flex items-center gap-2 text-xs border border-white/20 uppercase tracking-wider">
                <IconPhoto size={14} aria-hidden="true" /> View {mediaList.length} photos
              </span>
            </div>
          )}

          {/* Top Overlays */}
          <div className="relative z-10 flex justify-between items-start w-full gap-4">
            <span className={cn(
              "px-3 py-1.5 rounded-md text-xs font-medium tracking-wider flex items-center gap-1.5 shadow-sm shrink-0 uppercase",
              lease.isActive ? "bg-emerald-500 text-white" : "bg-slate-600 text-white"
            )}>
              {lease.isActive ? <IconCircleCheck size={14} /> : <IconBan size={14} />}
              {lease.isActive ? "Active Tenancy" : "Terminated"}
            </span>
            <div className="flex flex-col items-end gap-2.5 shrink-0" onClick={(e) => e.stopPropagation()}>
              <span className="bg-white/10 font-mono backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-full text-xxs font-medium uppercase tracking-wider whitespace-nowrap">
                {lease.propertyType} · UNIT {lease.propertyCode}
              </span>
              <div className="hidden sm:flex w-fit bg-white/95 backdrop-blur-md rounded-[18px] p-3.5 shadow-xl items-center gap-3 border border-white/60 text-slate-900">
                <div className="relative size-11 flex items-center justify-center shrink-0">
                  <svg className="size-full -rotate-90">
                    <circle cx="22" cy="22" r="18" fill="transparent" stroke="#f1f5f9" strokeWidth="5" />
                    <circle
                      cx="22"
                      cy="22"
                      r="18"
                      fill="transparent"
                      stroke="#151936"
                      strokeWidth="5"
                      strokeDasharray={2 * Math.PI * 18}
                      strokeDashoffset={(2 * Math.PI * 18) - (paymentStatusPctDisplay / 100) * (2 * Math.PI * 18)}
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-600">Payment Status</p>
                  <p className="text-lg font-medium text-slate-900 mt-0.5 font-mono leading-none">
                    {paymentStatusPctDisplay}%{paymentStatusPct > 100 && <span className="text-emerald-600"> +over</span>}
                  </p>
                  <p className="text-xs text-slate-600">of rent this month</p>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Overlays */}
          <div className="relative z-10 flex flex-col gap-4 w-full mt-auto">
            {/* Tenant & Landlord Avatar Pills */}
            <div className="flex flex-wrap gap-2.5" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => setTenantProfileOpen(true)}
                className="bg-black/40 hover:bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-3xl flex items-center gap-2.5 border border-white/10 transition-colors cursor-pointer text-left focus:outline-hidden"
              >
                <Avatar
                  src={lease.tenantAvatarUrl || undefined}
                  fallback={getInitials(lease.tenantName)}
                  className="size-7 bg-slate-100 text-slate-800 text-xs font-medium"
                />
                <div className="text-left leading-none">
                  <p className="text-sm font-medium text-white">{lease.tenantName}</p>
                  <span className="text-xxs uppercase tracking-widest text-slate-300 block">Tenant</span>
                </div>
              </button>
              {lease.landlord && (
                <button
                  type="button"
                  onClick={() => setOwnerProfileOpen(true)}
                  className="bg-black/40 hover:bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-3xl flex items-center gap-2.5 border border-white/10 transition-colors cursor-pointer text-left focus:outline-hidden"
                >
                  <Avatar
                    src={lease.landlord.avatarUrl || undefined}
                    fallback={getInitials(lease.landlord.name)}
                    className="size-7 bg-[#f3df27] text-[#151936] text-xs font-medium"
                  />
                  <div className="text-left leading-none">
                    <p className="text-sm font-medium text-white">{lease.landlord.name}</p>
                    <span className="text-xxs uppercase tracking-widest text-slate-300 block">Landlord</span>
                  </div>
                </button>
              )}
            </div>

            {/* Payment Progress Bar */}
            <div className="w-full mt-2 pr-8 lg:pr-12" onClick={(e) => e.stopPropagation()}>
              <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden mb-2">
                <div
                  className={cn("h-full rounded-full transition-all duration-500", paymentStatusPct >= 90 ? "bg-emerald-400" : paymentStatusPct >= 70 ? "bg-[#f3df27]" : "bg-rose-400")}
                  style={{ width: `${Math.min(100, paymentStatusPct)}%` }}
                />
              </div>
              <div className="flex justify-between items-center text-xs font-medium text-slate-300">
                <span className="font-mono text-white tracking-tight">{formatCompactKES(collectedThisMonth)} collected</span>
                <span>of <span className="font-mono text-slate-300">{formatCompactKES(monthlyRentNum)}</span> expected</span>
              </div>
            </div>

            {/* Balance line & View Property Button */}
            <div className="mt-2 pt-4 border-t border-white/10 flex items-center justify-between gap-4 w-full" onClick={(e) => e.stopPropagation()}>
              <div>
                <p className="text-xs font-medium uppercase tracking-widest text-slate-300">
                  {lease.balanceKes > 0 ? "Balance due" : "Rent status"}
                </p>
                <p className={cn("font-mono font-medium text-2xl font-medium tracking-tight mt-0.5", lease.balanceKes > 0 ? "text-rose-300" : "text-white")}>
                  {lease.balanceKes > 0 ? formatCompactKES(lease.balanceKes) : "Rent Current"}
                </p>
              </div>

              <Link
                href={`/admin/properties/${lease.propertyId}`}
                className="bg-white/10 hover:bg-white/20 text-white border border-white/20 font-medium text-xs rounded-xl px-4 py-2 transition-all flex items-center gap-1.5 backdrop-blur-md shadow-sm shrink-0"
              >
                View Property <IconArrowUpRight size={13} />
              </Link>
            </div>
          </div>
        </button>

        {/* Thumbnail slider */}
        {mediaList.length > 1 && (
          <div className="flex gap-2.5 overflow-x-auto pb-1 -mt-1" style={scrollHiddenStyle}>
            {mediaList.map((media, index) => (
              <button
                key={index}
                type="button"
                onClick={() => setActiveMediaIndex(index)}
                className={cn(
                  "relative size-[64px] rounded-xl overflow-hidden border-2 shrink-0 transition-all duration-300",
                  activeMediaIndex === index ? "border-slate-800 scale-95 shadow-sm" : "border-slate-200/60 opacity-70 hover:opacity-100 hover:scale-95"
                )}
              >
                <Image src={media.url} alt={media.alt || `Property photo ${index + 1}`} fill sizes="64px" className="object-cover" />
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
              "gsap-stagger relative overflow-hidden rounded-2xl border p-5 flex flex-col justify-between group shadow-sm hover:shadow-md hover:border-slate-300 transition-all duration-300 h-[150px] text-left cursor-pointer focus:outline-hidden",
              VITAL_TONE_BG[v.tone]
            )}
          >
            <v.icon
              size={140}
              stroke={1}
              className={cn(
                "absolute -right-6 -bottom-6 opacity-[0.03] group-hover:scale-110 group-hover:opacity-[0.05] transition-all duration-500 pointer-events-none",
                VITAL_TONE_ARTWORK[v.tone]
              )}
              aria-hidden="true"
            />
            <div className="flex items-start justify-between relative z-10">
              <div className="flex flex-col gap-1 max-w-[calc(100%-48px)]">
                <span className="text-desc-secondary font-medium">{v.label}</span>
                <span className={cn("font-mono font-medium text-2xl font-medium mt-1 leading-none", VITAL_TONE_VALUE[v.tone])}>
                  {v.value}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between mt-auto relative z-10">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "mono-data text-xs flex font-medium items-center px-1.5 py-0.5 rounded-md",
                    VITAL_TONE_BADGE_BG[v.badgeTone]
                  )}
                >
                  {v.badgeText}
                </span>
                <span className="text-meta-muted text-xs font-medium">{v.subText}</span>
              </div>
              <IconArrowUpRight
                size={14}
                className="text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity"
              />
            </div>
          </button>
        ))}
      </div>

      {/* ── Action-required band ── */}
      {actionItems.length > 0 && (
        <div className={cn("grid gap-3.5 animate-fade-in-up mt-1", actionItems.length > 1 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1")}>
          {actionItems.map((item) => {
            const t = ACTION_TONE_CLASSES[item.tone];
            return (
              <div key={item.key} className={t.div}>
                <div className="flex items-start gap-3 min-w-0">
                  <span className={t.iconWrap}>
                    <item.icon size={18} />
                  </span>
                  <div className="min-w-0">
                    <p className="font-sans text-sm font-medium text-slate-950 truncate leading-snug">{item.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5 truncate font-medium">{item.meta}</p>
                  </div>
                </div>
                <button type="button" onClick={item.onClick} className={t.cta}>
                  {item.cta}
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="h-px bg-slate-200/60 my-2 lg:my-4" />

      {/* ── Main: tabbed content + persistent context rail ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 lg:gap-3.5 items-start">
        <div className="flex flex-col min-w-0">
          <div role="tablist" aria-label="Lease sections" className="flex bg-white border border-slate-100 p-1.5 rounded-[16px] shadow-[0_2px_10px_rgb(0,0,0,0.02)] gap-1 overflow-x-auto flex-nowrap mb-6">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                role="tab"
                id={`tab-${tab.key}`}
                aria-selected={activeTab === tab.key}
                aria-controls={`panel-${tab.key}`}
                tabIndex={activeTab === tab.key ? 0 : -1}
                onClick={() => setActiveTab(tab.key)}
                onKeyDown={(e) => {
                  if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
                  const idx = tabs.findIndex((t) => t.key === activeTab);
                  const next = e.key === "ArrowRight" ? (idx + 1) % tabs.length : (idx - 1 + tabs.length) % tabs.length;
                  setActiveTab(tabs[next].key);
                }}
                className={cn(
                  "body-sm px-4 py-2 rounded-xl transition-all duration-300 flex items-center gap-2 shrink-0 whitespace-nowrap font-medium",
                  activeTab === tab.key ? "bg-[#151936] text-white shadow-md" : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                )}
              >
                <tab.icon size={15} aria-hidden="true" />
                {tab.label}
              </button>
            ))}
          </div>

          <div id={`panel-${activeTab}`} role="tabpanel" aria-labelledby={`tab-${activeTab}`}>
            {activeTab === "overview" && (
              <div className="flex flex-col gap-4">
                <div className="bg-white border border-slate-100 rounded-[24px] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                  <div className="flex items-center justify-between mb-5">
                    <h3 className="text-title-primary">Financial Terms</h3>
                    <div className={cn(
                      "size-10 rounded-full border flex items-center justify-center shadow-sm",
                      lease.balanceKes > 0 ? "bg-rose-50 border-rose-100 text-rose-600" : "bg-emerald-50 border-emerald-100 text-emerald-600"
                    )}>
                      <IconShield size={18} stroke={1.5} />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="flex flex-col gap-2 p-5 rounded-2xl bg-slate-50 border border-slate-100 hover:border-slate-200 transition-colors">
                      <p className="label-caps text-slate-400 flex items-center gap-1.5">
                        <IconCalendarEvent size={14} /> Monthly Rent
                      </p>
                      <p className="mono-amount text-2xl font-medium text-slate-900">{formatCompactKES(monthlyRentNum)}</p>
                    </div>
                    <div className="flex flex-col gap-2 p-5 rounded-2xl bg-indigo-50/50 border border-indigo-100/50 hover:border-indigo-200/60 transition-colors">
                      <p className="label-caps text-indigo-400 flex items-center gap-1.5">
                        <IconShield size={14} /> Deposit Held
                      </p>
                      <p className="mono-amount text-2xl font-medium text-indigo-900">{depositNum ? formatCompactKES(depositNum) : "-"}</p>
                    </div>
                    <div className={cn(
                      "flex flex-col gap-2 p-5 rounded-2xl border transition-colors",
                      lease.balanceKes > 0 ? "bg-rose-50/50 border-rose-100/50 hover:border-rose-200/60" : "bg-slate-50 border-slate-100 hover:border-slate-200"
                    )}>
                      <p className={cn("label-caps flex items-center gap-1.5", lease.balanceKes > 0 ? "text-rose-400" : "text-slate-400")}>
                        <IconClock size={14} /> {lease.isActive ? "Term Remaining" : "Term Ended"}
                      </p>
                      <p className={cn("mono-amount text-2xl font-medium", lease.balanceKes > 0 ? "text-rose-700" : "text-slate-900")}>{leaseTermLabel(lease)}</p>
                    </div>
                  </div>
                  <p className="body-sm text-slate-400 mt-4">Deposit is held as a refundable liability against the tenant, not recognized as income.</p>
                </div>

                <div className="bg-white border border-slate-100 rounded-[24px] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-title-primary">Notes</h3>
                    {canManage && (
                      <button
                        type="button"
                        onClick={() => setEditModalOpen(true)}
                        className="text-slate-500 hover:text-slate-900 text-xs font-medium flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors"
                      >
                        <IconEdit size={13} /> Edit
                      </button>
                    )}
                  </div>
                  {lease.notes ? (
                    <p className="body-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{lease.notes}</p>
                  ) : (
                    <p className="body-sm text-slate-400 italic">No notes added for this tenancy yet.</p>
                  )}
                </div>
              </div>
            )}

            {activeTab === "payments" && (
              <div className="bg-white border border-slate-100 rounded-[24px] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col gap-4">
                <h3 className="text-title-primary">Payment History</h3>

                {paymentsLoading ? (
                  <div className="flex justify-center py-12"><LoadingSpinner size="md" /></div>
                ) : !payments || payments.length === 0 ? (
                  <div className="flex flex-col items-center text-center gap-4 py-12 bg-slate-50 rounded-2xl border border-slate-100 border-dashed">
                    <div className="size-16 rounded-2xl bg-white border border-slate-100 flex items-center justify-center mb-1">
                      <IconCash size={32} className="text-slate-300" />
                    </div>
                    <h3 className="text-sm font-medium text-slate-700">No payments recorded yet.</h3>
                    <p className="text-slate-400 max-w-sm text-xs">Rent receipts and other recorded transactions for this lease will appear here.</p>
                  </div>
                ) : (
                  <>
                    {/* Search + type filter */}
                    <div className="flex flex-wrap items-center gap-2.5">
                      <div className="relative flex-1 min-w-[200px]">
                        <IconSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        <input
                          value={paymentSearchQuery}
                          onChange={(e) => { setPaymentSearchQuery(e.target.value); setPaymentPage(1); }}
                          placeholder="Search by type or note..."
                          className="w-full h-9 rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm focus:outline-none focus:border-[#151936]/40 transition-colors shadow-sm"
                        />
                      </div>
                      <div className="relative shrink-0">
                        <IconFilter size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        <select
                          value={paymentTypeFilter}
                          onChange={(e) => { setPaymentTypeFilter(e.target.value); setPaymentPage(1); }}
                          className="h-9 rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-sm focus:outline-none focus:border-[#151936]/40 transition-colors shadow-sm appearance-none"
                        >
                          <option value="all">All types</option>
                          {Object.entries(PAYMENT_TYPE_LABEL).map(([value, label]) => (
                            <option key={value} value={value}>{label}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {paginatedPayments.length === 0 ? (
                      <div className="p-10 text-center text-slate-400 text-sm">No payments match this search/filter.</div>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {paginatedPayments.map((p) => (
                          <div key={p.id} className="flex items-center justify-between py-3.5 px-2 -mx-2 rounded-lg hover:bg-slate-50/60 transition-colors">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="size-9 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
                                <IconCash size={15} className="text-slate-400" />
                              </div>
                              <div className="min-w-0">
                                <p className="body-sm text-slate-800 font-medium">
                                  {new Date(p.occurredAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                </p>
                                <p className="text-xs text-slate-400 mt-0.5 truncate">{p.notes || "No note attached"}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <Badge tone="neutral">{PAYMENT_TYPE_LABEL[p.type]}</Badge>
                              <span className="font-mono font-medium text-slate-900">{formatCompactKES(parseFloat(p.amountKes))}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {paymentTotalPages > 1 && (
                      <div className="flex items-center justify-between pt-4 mt-1 border-t border-slate-100">
                        <span className="text-xs font-medium text-slate-400 bg-slate-50 px-3 py-1 rounded-md border border-slate-100">
                          Page {safePaymentPage} of {paymentTotalPages} <span className="mx-1">·</span> {filteredPayments.length} payments
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setPaymentPage(Math.max(1, safePaymentPage - 1))}
                            disabled={safePaymentPage <= 1}
                            className="size-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 disabled:text-slate-200 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
                          >
                            <IconChevronLeft size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setPaymentPage(Math.min(paymentTotalPages, safePaymentPage + 1))}
                            disabled={safePaymentPage >= paymentTotalPages}
                            className="size-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 disabled:text-slate-200 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
                          >
                            <IconChevronRight size={15} />
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {activeTab === "documents" && (
              <div className="flex flex-col gap-4">
                {canManage && (
                  <Button variant="secondary" onClick={() => setUploadDocOpen(true)} className="self-start">
                    <IconFileText size={14} className="mr-1.5" /> Upload Document
                  </Button>
                )}
                {documentsLoading ? (
                  <div className="flex justify-center py-12">
                    <LoadingSpinner size="md" />
                  </div>
                ) : !leaseDocuments || leaseDocuments.length === 0 ? (
                  <div className="bg-white border border-slate-100 rounded-[24px] p-16 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col items-center text-center gap-4">
                    <div className="size-20 rounded-3xl bg-slate-50 border border-slate-100 flex items-center justify-center mb-2">
                      <IconFileText size={40} stroke={1.5} className="text-slate-300" aria-hidden="true" />
                    </div>
                    <h3 className="text-xl font-serif text-slate-900">No attached documents</h3>
                    <p className="text-slate-400 max-w-sm text-sm">Lease agreements, ID copies, and references will appear here once attached.</p>
                  </div>
                ) : (
                  <div className="bg-white border border-slate-100 rounded-[24px] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col gap-4">
                    {/* Search + type filter */}
                    <div className="flex flex-wrap items-center gap-2.5">
                      <div className="relative flex-1 min-w-[200px]">
                        <IconSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        <input
                          value={docSearchQuery}
                          onChange={(e) => { setDocSearchQuery(e.target.value); setDocPage(1); }}
                          placeholder="Search documents by title or type..."
                          className="w-full h-9 rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm focus:outline-none focus:border-[#151936]/40 transition-colors shadow-sm"
                        />
                      </div>
                      <div className="relative shrink-0">
                        <IconFilter size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        <select
                          value={docTypeFilter}
                          onChange={(e) => { setDocTypeFilter(e.target.value); setDocPage(1); }}
                          className="h-9 rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-sm focus:outline-none focus:border-[#151936]/40 transition-colors shadow-sm appearance-none"
                        >
                          <option value="all">All types</option>
                          {Object.entries(LEASE_DOCUMENT_TYPE_LABEL).map(([value, label]) => (
                            <option key={value} value={value}>{label}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {paginatedDocuments.length === 0 ? (
                      <div className="p-10 text-center text-slate-400 text-sm">No documents match this search/filter.</div>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {paginatedDocuments.map((doc) => {
                          const sizeLabel = formatFileSize(doc.fileSizeBytes);
                          const addedLabel = `added ${new Date(doc.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`;
                          return (
                            <a
                              key={doc.id}
                              href={doc.fileUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-3 px-2 -mx-2 py-3.5 hover:bg-slate-50/60 transition-colors rounded-lg"
                            >
                              <div className="size-9 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
                                <IconFileText size={16} className="text-slate-400" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <span className="text-body-primary text-slate-800 truncate block">{doc.title}</span>
                                <span className="text-xs text-slate-400 font-mono">
                                  {[sizeLabel, addedLabel].filter(Boolean).join(" · ")}
                                </span>
                              </div>
                              <span className="label-caps text-slate-400 shrink-0">{LEASE_DOCUMENT_TYPE_LABEL[doc.type] ?? doc.type}</span>
                            </a>
                          );
                        })}
                      </div>
                    )}

                    {docTotalPages > 1 && (
                      <div className="flex items-center justify-between pt-4 mt-1 border-t border-slate-100">
                        <span className="text-xs font-medium text-slate-400 bg-slate-50 px-3 py-1 rounded-md border border-slate-100">
                          Page {safeDocPage} of {docTotalPages} <span className="mx-1">·</span> {filteredDocuments.length} documents
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setDocPage(Math.max(1, safeDocPage - 1))}
                            disabled={safeDocPage <= 1}
                            className="size-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 disabled:text-slate-200 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
                          >
                            <IconChevronLeft size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDocPage(Math.min(docTotalPages, safeDocPage + 1))}
                            disabled={safeDocPage >= docTotalPages}
                            className="size-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 disabled:text-slate-200 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
                          >
                            <IconChevronRight size={15} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {activeTab === "activity" && (
              <div className="bg-white border border-slate-100 rounded-[24px] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                <div className="flex flex-col gap-5 mb-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-title-primary">Activity log</h3>
                  </div>

                  {/* Advanced Search & Filter Bar */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    <div className="relative flex-1">
                      <IconSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search activity logs..."
                        value={activitySearchQuery}
                        onChange={(e) => {
                          setActivitySearchQuery(e.target.value);
                          setActivityPage(1);
                        }}
                        className="w-full bg-slate-50 border border-slate-200 text-sm rounded-xl pl-9 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#151936]/20 transition-all placeholder:text-slate-400"
                      />
                    </div>
                    <div className="relative shrink-0">
                      <IconFilter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      <select
                        value={activityFilter}
                        onChange={(e) => {
                          setActivityFilter(e.target.value);
                          setActivityPage(1);
                        }}
                        className="appearance-none bg-white border border-slate-200 text-sm font-medium text-slate-700 rounded-xl pl-8 pr-10 py-2 focus:outline-none focus:ring-2 focus:ring-[#151936]/20 transition-all cursor-pointer"
                      >
                        <option value="all">All Events</option>
                        <option value="edits">Modifications</option>
                        <option value="terminations">Terminations</option>
                        <option value="system">System Actions</option>
                      </select>
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                        <IconChevronRight size={14} className="text-slate-400 rotate-90" />
                      </div>
                    </div>
                  </div>
                </div>

                {activityLoading ? (
                  <div className="flex justify-center py-12">
                    <LoadingSpinner size="md" />
                  </div>
                ) : !activityLog || activityLog.length === 0 ? (
                  <div className="bg-white border border-slate-100 rounded-[24px] p-16 flex flex-col items-center text-center gap-4">
                    <div className="size-16 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center mb-1">
                      <IconMoodEmpty size={32} className="text-slate-300" />
                    </div>
                    <h3 className="text-xl font-serif text-slate-900">No recorded activity</h3>
                    <p className="text-slate-400 max-w-sm text-sm">Status changes, edits, and lease events will safely log here.</p>
                  </div>
                ) : paginatedActivity.length === 0 ? (
                  <div className="flex flex-col items-center py-12 text-center">
                    <IconSearch size={24} className="text-slate-300 mb-3" />
                    <p className="text-sm font-medium text-slate-700">No logs match your filter</p>
                    <p className="text-xs text-slate-400 mt-1">Try adjusting the search query or dropdown.</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-6 relative ml-1">
                    <div className="absolute left-[3.5px] top-2 bottom-6 w-px bg-slate-200 z-0" />
                    {paginatedActivity.map((entry) => {
                      const toneColor = getActivityTone(entry.summary);
                      return (
                        <div key={entry.id} className="relative flex items-start lg:items-center gap-4 z-10 group">
                          <div className={cn("size-[8px] rounded-full mt-1.5 lg:mt-0 shrink-0 ring-4 shadow-xs", toneColor)} />
                          <div className="flex-1 min-w-0 flex flex-col lg:flex-row lg:items-center justify-between gap-2 lg:gap-6 bg-slate-50/50 hover:bg-slate-100/50 -my-1.5 -mx-3 p-2 px-3 rounded-xl transition-colors">
                            <p className="text-sm text-slate-500 leading-snug group-hover:text-slate-700 transition-colors flex-1 min-w-0 pr-4">
                              {entry.actorName ? (
                                <>
                                  <span className="font-medium text-slate-700">{entry.actorName}</span> {entry.summary.replace(entry.actorName, "").replace(/^ - |^ — /, "").trim()}
                                </>
                              ) : (
                                entry.summary
                              )}
                            </p>
                            <div className="flex items-center gap-3 shrink-0">
                              <p className="text-xs text-slate-400 font-mono tracking-wider hidden lg:block">
                                {new Date(entry.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}, {new Date(entry.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                              </p>
                              <Badge tone="neutral" className="whitespace-nowrap">
                                {relativeTime(entry.createdAt)}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {activityTotalPages > 1 && (
                  <div className="flex items-center justify-between pt-6 mt-6 border-t border-slate-100">
                    <span className="text-xs font-medium text-slate-400 bg-slate-50 px-3 py-1 rounded-md border border-slate-100">
                      Page {safeActivityPage} of {activityTotalPages} <span className="mx-1">·</span> {filteredActivity.length} logs
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setActivityPage(Math.max(1, safeActivityPage - 1))}
                        disabled={safeActivityPage <= 1}
                        className="size-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 disabled:text-slate-200 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
                      >
                        <IconChevronLeft size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setActivityPage(Math.min(activityTotalPages, safeActivityPage + 1))}
                        disabled={safeActivityPage >= activityTotalPages}
                        className="size-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 disabled:text-slate-200 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
                      >
                        <IconChevronRight size={15} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Context rail */}
        <div className="flex flex-col gap-4">
          {/* Tenant div */}
          <div className="gsap-stagger bg-white border border-slate-100 rounded-[24px] overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
            <div className="relative h-56 w-full flex flex-col justify-between p-5 text-center">
              {lease.tenantAvatarUrl ? (
                <Image src={lease.tenantAvatarUrl} alt={lease.tenantName} fill className="object-cover" />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-[#1e2336] to-[#0f132b]" />
              )}
              <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/15 to-black/60 z-0" />

              <div className="relative z-10 mt-2">
                <h4 className="text-2xl font-serif text-white tracking-tight">{lease.tenantName}</h4>
                <span className="text-xs text-slate-300/80 flex items-center justify-center gap-1 mt-1 font-medium">Principal Tenant</span>
              </div>

              <div className="relative z-10 flex justify-center gap-3 mb-1">
                <Link
                  href="/admin/messages"
                  className="size-9 rounded-full bg-white hover:bg-slate-50 text-slate-900 shadow-md flex items-center justify-center transition-all cursor-pointer border border-slate-100"
                  title="Message"
                >
                  <IconMessageCircle size={16} />
                </Link>
                {lease.tenantPhone && (
                  <a
                    href={`tel:${lease.tenantPhone}`}
                    className="h-9 px-4 rounded-full bg-[#151936] hover:bg-[#1f254e] text-white flex items-center gap-1.5 text-sm font-medium shadow-md transition-all cursor-pointer"
                    title="Call"
                  >
                    <IconPhone size={13} /> Call
                  </a>
                )}
              </div>
            </div>

            <div className="p-5 flex flex-col gap-2.5 bg-slate-50/30">
              <div className="flex items-center justify-between p-1.5 bg-white border border-slate-100/80 rounded-full shadow-xs">
                <div className="flex items-center min-w-0">
                  <span className="size-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-600 shrink-0 border border-slate-100/50">
                    <IconPhone size={14} />
                  </span>
                  <span className="text-xs font-medium text-slate-600 ml-2.5">Phone</span>
                </div>
                <span className="text-xs font-mono font-medium text-slate-700 pr-3 truncate">{lease.tenantPhone || "—"}</span>
              </div>

              <div className="flex items-center justify-between p-1.5 bg-white border border-slate-100/80 rounded-full shadow-xs">
                <div className="flex items-center min-w-0">
                  <span className="size-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-600 shrink-0 border border-slate-100/50">
                    <IconMail size={14} />
                  </span>
                  <span className="text-xs font-medium text-slate-600 ml-2.5">Mail</span>
                </div>
                <span className="text-xs font-mono font-medium text-slate-700 pr-3 truncate max-w-[160px]" title={lease.tenantEmail || ""}>
                  {lease.tenantEmail || "—"}
                </span>
              </div>

              <Link
                href={`/admin/contacts/${lease.tenantContactId}`}
                className="mt-1.5 inline-flex items-center justify-center gap-2 w-full rounded-full bg-white border border-slate-200/80 py-2.5 label-caps text-slate-700 hover:bg-slate-50 transition-colors text-xs font-medium shadow-xs"
              >
                View Full Profile
              </Link>
            </div>
          </div>

          {/* Landlord div */}
          {lease.landlord && (
            <div className="gsap-stagger bg-white border border-slate-100 rounded-[24px] overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
              <div className="relative h-56 w-full flex flex-col justify-between p-5 text-center">
                {lease.landlord.avatarUrl ? (
                  <Image src={lease.landlord.avatarUrl} alt={lease.landlord.name} fill className="object-cover" />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-[#1e2336] to-[#0f132b]" />
                )}
                <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/15 to-black/60 z-0" />

                <div className="relative z-10 mt-2">
                  <h4 className="text-2xl font-serif text-white tracking-tight">{lease.landlord.name}</h4>
                  {lease.landlord.verifiedAt ? (
                    <span className="text-xs text-slate-200/90 flex items-center justify-center gap-1 mt-1 font-medium">
                      <IconCircleCheck size={14} className="text-emerald-400" /> Verified landlord
                    </span>
                  ) : (
                    <span className="text-xs text-slate-300/80 flex items-center justify-center gap-1 mt-1 font-medium">Landlord</span>
                  )}
                </div>

                <div className="relative z-10 flex justify-center gap-3 mb-1">
                  <Link
                    href="/admin/messages"
                    className="size-9 rounded-full bg-white hover:bg-slate-50 text-slate-900 shadow-md flex items-center justify-center transition-all cursor-pointer border border-slate-100"
                    title="Message"
                  >
                    <IconMessageCircle size={16} />
                  </Link>
                  {lease.landlord.phone && (
                    <a
                      href={`tel:${lease.landlord.phone}`}
                      className="h-9 px-4 rounded-full bg-[#151936] hover:bg-[#1f254e] text-white flex items-center gap-1.5 text-sm font-medium shadow-md transition-all cursor-pointer"
                      title="Call"
                    >
                      <IconPhone size={13} /> Call
                    </a>
                  )}
                </div>
              </div>

              <div className="p-5 flex flex-col gap-2.5 bg-slate-50/30">
                <div className="flex items-center justify-between p-1.5 bg-white border border-slate-100/80 rounded-full shadow-xs">
                  <div className="flex items-center min-w-0">
                    <span className="size-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-600 shrink-0 border border-slate-100/50">
                      <IconPhone size={14} />
                    </span>
                    <span className="text-xs font-medium text-slate-600 ml-2.5">Phone</span>
                  </div>
                  <span className="text-xs font-mono font-medium text-slate-700 pr-3 truncate">{lease.landlord.phone || "—"}</span>
                </div>

                <div className="flex items-center justify-between p-1.5 bg-white border border-slate-100/80 rounded-full shadow-xs">
                  <div className="flex items-center min-w-0">
                    <span className="size-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-600 shrink-0 border border-slate-100/50">
                      <IconMail size={14} />
                    </span>
                    <span className="text-xs font-medium text-slate-600 ml-2.5">Mail</span>
                  </div>
                  <span className="text-xs font-mono font-medium text-slate-700 pr-3 truncate max-w-[160px]" title={lease.landlord.email || ""}>
                    {lease.landlord.email || "—"}
                  </span>
                </div>

                {lease.landlord.companyName && (
                  <div className="flex items-center justify-between p-1.5 bg-white border border-slate-100/80 rounded-full shadow-xs">
                    <div className="flex items-center min-w-0">
                      <span className="size-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-600 shrink-0 border border-slate-100/50">
                        <IconBuildingCommunity size={14} />
                      </span>
                      <span className="text-xs font-medium text-slate-600 ml-2.5">Entity</span>
                    </div>
                    <span className="text-xs font-medium text-slate-700 pr-3 truncate max-w-[160px]">
                      {lease.landlord.companyName}
                    </span>
                  </div>
                )}

                <button
                  onClick={() => setOwnerProfileOpen(true)}
                  className="mt-1.5 w-full text-sm font-medium text-[#151936] flex items-center justify-center gap-2 hover:text-[#151936] bg-white border border-slate-200/80 rounded-full py-2.5 transition-colors hover:bg-slate-50 label-caps text-xs shadow-xs"
                >
                  View Full Profile
                </button>
              </div>
            </div>
          )}

          {/* Property Manager div */}
          {lease.manager && (
            <div className="gsap-stagger bg-white border border-slate-100 rounded-[24px] p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col gap-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="size-12 rounded-full flex items-center justify-center bg-[#0f132b] text-[#f3df27] font-normal text-sm shrink-0 shadow-xs">
                    {getInitials(lease.manager.name || "Unassigned")}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium text-slate-800 leading-snug">{lease.manager.name || "Unassigned"}</h4>
                    <p className="label-caps text-slate-600 mt-0.5">{lease.manager.title || "Property Manager"}</p>
                  </div>
                </div>
                <Link
                  href="/admin/messages"
                  className="size-10 rounded-full bg-white hover:bg-slate-50 border border-slate-200/80 flex items-center justify-center text-slate-600 shadow-xs transition-colors"
                  title="Message"
                >
                  <IconMessageCircle size={16} />
                </Link>
              </div>

              <button
                onClick={() => setManagerProfileOpen(true)}
                className="inline-flex items-center justify-center gap-2 w-full rounded-full bg-white border border-slate-200/80 py-2.5 label-caps text-slate-700 hover:bg-slate-50 transition-colors text-xs font-medium shadow-xs"
              >
                View Full Profile
              </button>
            </div>
          )}

          {/* Lease Timeline div */}
          <div className="gsap-stagger bg-white border border-slate-100 rounded-[24px] p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col gap-4">
            <h3 className="label-caps text-slate-400 flex items-center gap-2">
              <IconCalendarEvent size={14} /> Lease Timeline
            </h3>
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between text-xs font-mono tracking-wider text-slate-500">
                <span>{tenurePct}% ELAPSED</span>
                <span>{lease.isActive ? `${daysRemaining}d remaining` : "Terminated"}</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden w-full">
                <div
                  style={{ width: `${tenurePct}%` }}
                  className={cn("h-full rounded-full transition-all duration-500", tenurePct >= 90 ? "bg-rose-400" : tenurePct >= 70 ? "bg-amber-400" : "bg-emerald-400")}
                />
              </div>
              <div className="flex items-center justify-between mt-1">
                <div className="flex flex-col gap-0.5">
                  <span className="label-caps text-slate-400">Commencement</span>
                  <span className="font-mono text-sm text-slate-900">{new Date(lease.startsAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                </div>
                <div className="flex flex-col gap-0.5 text-right">
                  <span className="label-caps text-slate-400">Expiration</span>
                  <span className="font-mono text-sm text-slate-900">{new Date(lease.endsAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Property Command Center div */}
          <div className="gsap-stagger bg-white border border-slate-100 rounded-[24px] overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative">
            <div className="relative h-32 w-full bg-slate-100 flex items-end p-4">
              {primaryImage ? (
                <Image src={primaryImage} alt="" fill className="object-cover" />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-slate-200 to-slate-100 flex items-center justify-center">
                  <PropIcon size={32} className="text-slate-300" stroke={1.5} />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
              <p className="relative font-serif text-sm font-medium text-white z-10 truncate leading-tight">
                {lease.propertyName}
              </p>
            </div>
            <div className="p-4 px-5 flex items-center justify-between gap-3 text-xs bg-white border-t border-slate-50">
              <span className="text-slate-500 font-mono font-medium">
                {lease.propertyCode} · {lease.propertyLocation || "Sunland Managed Location"}
              </span>
              <Link
                href={`/admin/properties/${lease.propertyId}`}
                className="text-[#122a20] font-medium hover:underline flex items-center gap-1 shrink-0"
              >
                Command center ↗
              </Link>
            </div>
          </div>

          {/* Portals div */}
          <div className="gsap-stagger bg-white border border-slate-100 rounded-[24px] p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col gap-4">
            <h4 className="text-base font-medium text-slate-800">Portals</h4>
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 text-slate-600 font-medium">
                  <IconUser size={15} className="text-slate-400" /> Tenant portal
                </span>
                <span className={cn("font-medium font-mono tracking-wide", lease.isActive ? "text-emerald-600" : "text-slate-400")}>
                  {lease.isActive ? "ACTIVE" : "INACTIVE"}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 text-slate-600 font-medium">
                  <IconUsers size={15} className="text-slate-400" /> Landlord portal
                </span>
                <span className="text-emerald-600 font-medium font-mono tracking-wide">ACTIVE</span>
              </div>
            </div>
            <p className="text-xs text-slate-400/90 leading-relaxed pt-2 border-t border-slate-50">
              The tenant logs complaints and views this contract from their own portal; the landlord sees remittance history and documents from theirs.
            </p>
          </div>

          {/* Quick Facts div */}
          <div className="gsap-stagger bg-white border border-slate-100 rounded-[24px] p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col gap-4">
            <h4 className="text-base font-medium text-slate-800">Quick Facts</h4>
            <div className="flex flex-col gap-3 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-600 font-medium">Lease ref</span>
                <span className="font-mono font-medium text-slate-800">LSE-{new Date(lease.startsAt).getFullYear()}-{lease.id.slice(0, 3).toUpperCase()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600 font-medium">Commenced</span>
                <span className="font-mono font-medium text-slate-800">
                  {new Date(lease.startsAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600 font-medium">Property code</span>
                <span className="font-mono font-medium text-slate-800">{lease.propertyCode}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600 font-medium">Next payment due</span>
                <span className="font-mono font-medium text-slate-800">
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
        onClose={() => setTenantProfileOpen(false)}
        entityId={entityId || ""}
        contactId={lease.tenantContactId}
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
