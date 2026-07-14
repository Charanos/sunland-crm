"use client";

import { useEffect, useState, useMemo, type ComponentType } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  IconAlertTriangle,
  IconCalendarEvent,
  IconChevronLeft,
  IconClock,
  IconEdit,
  IconFileText,
  IconHistory,
  IconMail,
  IconMapPin,
  IconPhone,
  IconRefresh,
  IconShield,
  IconTrash,
  IconUser,
  IconBuildingCommunity,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast-provider";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { formatCompactKES } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { PROPERTY_TYPE_ICON } from "./property-constants";
import { LeaseFormModal, type LeaseEditTarget } from "./lease-form-modal";
import { LeaseRenewModal, type LeaseRenewTarget } from "./lease-renew-modal";
import { LeaseDocumentModal } from "./lease-document-modal";

interface LeaseDocument {
  id: string;
  title: string;
  fileUrl: string;
  type: string;
  createdAt: string;
}

const LEASE_DOCUMENT_TYPE_LABEL: Record<string, string> = {
  lease_agreement: "Lease Agreement",
  identification: "Tenant ID",
  rent_receipt: "Rent Receipt",
  statement: "Statement",
};

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
  propertyLocation?: string;
  tenantName: string;
  tenantEmail: string | null;
  tenantPhone: string | null;
}

interface AuditEntry {
  id: string;
  summary: string;
  createdAt: string;
}

function leaseTermLabel(lease: Lease): string {
  if (!lease.isActive) return "-";
  const days = Math.ceil((new Date(lease.endsAt).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return "Overdue";
  if (days === 0) return "Ends today";
  return `${days} days`;
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

type TabKey = "overview" | "documents" | "activity";

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

  const [leaseDocuments, setLeaseDocuments] = useState<LeaseDocument[] | null>(null);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [documentsLoaded, setDocumentsLoaded] = useState(false);
  const [uploadDocOpen, setUploadDocOpen] = useState(false);

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

  const refetchLeaseDocuments = () => {
    fetch(`/api/documents?entityId=${entityId || ""}&leaseId=${leaseId}`)
      .then((res) => (res.ok ? res.json() : { documents: [] }))
      .then((data) => setLeaseDocuments(data.documents ?? []))
      .catch((err) => console.error("Failed to refresh lease documents:", err));
  };

  const tabs = useMemo(() => {
    return [
      { key: "overview", label: "Overview", icon: IconBuildingCommunity },
      { key: "documents", label: "Documents", icon: IconFileText },
      { key: "activity", label: "Activity", icon: IconHistory },
    ] as { key: TabKey; label: string; icon: ComponentType<{ size?: number; className?: string }> }[];
  }, []);

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <LoadingSpinner size="lg" />
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
      pushToast({ tone: "warning", title: "Error", body: e instanceof Error ? e.message : "Failed to terminate" });
    } finally {
      setIsDeleting(false);
    }
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
    <div className="mx-auto flex max-w-[98rem] flex-col gap-6 pb-12">
      {/* ── Breadcrumb ── */}
      <div className="flex items-center gap-2 mb-2">
        <Link href="/admin/leases" className="text-slate-400 hover:text-slate-600 transition-colors" aria-label="Back to Leases">
          <IconChevronLeft size={20} stroke={2} />
        </Link>
        <Link href="/" className="text-desc-secondary hover:text-slate-800">
          Dashboard
        </Link>
        <span className="text-slate-300">/</span>
        <Link href="/admin/leases" className="text-desc-secondary hover:text-slate-800">
          Leases
        </Link>
        <span className="text-slate-300">/</span>
        <span className="text-meta-muted-strong font-mono">{lease.id.split("-")[0].toUpperCase()}</span>
      </div>

      {/* ── Majestic Header ── */}
      <div className="bg-tertiary-gradient   text-white rounded-[24px] shadow-2xl relative overflow-hidden group border border-[#151936] p-8 lg:p-10 mb-2">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-transparent to-transparent pointer-events-none" />
        <div className="absolute right-0 bottom-0 size-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-indigo-500/20 transition-colors duration-700" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-end justify-between gap-8">
          <div className="flex flex-col gap-5">
            <div className="flex items-center gap-3 flex-wrap">
              <span className={cn(
                "inline-flex items-center gap-2 rounded-full border px-4 py-1 text-xs  uppercase tracking-wider",
                lease.isActive ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" : "border-slate-500/30 bg-slate-500/10 text-slate-400"
              )}>
                <span className={cn("size-2 rounded-full shadow-sm", lease.isActive ? "bg-emerald-400 shadow-emerald-400/50" : "bg-slate-400")} aria-hidden="true" />
                {lease.isActive ? "Active Tenancy" : "Terminated"}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1 text-xs uppercase tracking-wider text-slate-300 backdrop-blur-sm">
                <PropIcon size={14} aria-hidden="true" />
                {lease.propertyType}
              </span>
            </div>

            <h1 className="text-4xl lg:text-5xl font-serif tracking-tight text-white drop-shadow-sm">{lease.propertyName}</h1>

            <div className="flex items-center gap-3 text-slate-400 mt-1">
              <span className="flex items-center gap-1.5 font-medium"><IconMapPin size={16} /> {lease.propertyLocation || "Sunland Managed Location"}</span>
              <span className="text-slate-600">|</span>
              <span className="font-mono text-slate-300 bg-white/5 px-2 py-0.5 rounded text-sm">UNIT {lease.propertyCode}</span>
            </div>
          </div>

          {canManage && lease.isActive && (
            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setEditModalOpen(true)}
                className="inline-flex items-center gap-2 px-6 py-1.5 text-sm rounded-xl bg-white/5 border border-white/10 text-slate-200 hover:bg-white/10 hover:border-white/20 transition-all font-medium shadow-sm backdrop-blur-sm"
              >
                <IconEdit size={14} /> Edit
              </button>
              <button
                type="button"
                onClick={() => setRenewModalOpen(true)}
                className="inline-flex items-center gap-2 px-6 py-1.5 text-sm rounded-xl bg-white/5 border border-white/10 text-slate-200 hover:bg-white/10 hover:border-white/20 transition-all font-medium shadow-sm backdrop-blur-sm"
              >
                <IconRefresh size={14} /> Renew
              </button>
              <button
                type="button"
                onClick={() => setDeleteConfirmOpen(true)}
                className="inline-flex items-center gap-2 px-6 py-1.5 text-sm rounded-xl bg-white/5 border border-white/10 text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/30 hover:text-rose-300 transition-all font-medium shadow-sm backdrop-blur-sm"
              >
                <IconTrash size={14} /> Terminate Lease
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Main: tabbed content + persistent context rail ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 flex flex-col gap-4">
          <div role="tablist" aria-label="Lease sections" className="inline-flex bg-slate-100 p-1.5 rounded-[14px] flex-wrap gap-1 self-start shadow-inner border border-slate-200/60">
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
                  "body-sm px-4 py-2 rounded-[10px] transition-all flex items-center gap-2 font-medium",
                  activeTab === tab.key ? "bg-white text-slate-900 shadow-sm border border-slate-200/50" : "text-slate-400 hover:text-slate-800 hover:bg-slate-50"
                )}
              >
                <tab.icon size={16} aria-hidden="true" />
                {tab.label}
              </button>
            ))}
          </div>

          <div id={`panel-${activeTab}`} role="tabpanel" aria-labelledby={`tab-${activeTab}`} className="mt-2">
            {activeTab === "overview" && (
              <div className="space-y-6">
                <Card className="bg-white border border-slate-100 rounded-[24px] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_16px_40px_rgb(0,0,0,0.06)] transition-all">
                  <div className="flex items-center justify-between mb-5">
                    <h3 className="text-lg font-serif text-slate-900">Financial Terms</h3>
                    <div className="size-10 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shadow-sm">
                      <IconShield size={18} stroke={1.5} />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="flex flex-col gap-2 p-5 rounded-2xl bg-slate-50 border border-slate-100 hover:border-slate-200 transition-colors">
                      <p className="label-caps text-slate-400 flex items-center gap-1.5">
                        <IconCalendarEvent size={14} /> Monthly Rent
                      </p>
                      <p className="mono-amount headline-md text-slate-900">{formatCompactKES(parseFloat(lease.monthlyRentKes))}</p>
                    </div>
                    <div className="flex flex-col gap-2 p-5 rounded-2xl bg-indigo-50/50 border border-indigo-100/50 hover:border-indigo-200/60 transition-colors">
                      <p className="label-caps text-indigo-400 flex items-center gap-1.5">
                        <IconShield size={14} /> Deposit Held
                      </p>
                      <p className="mono-amount headline-md text-indigo-900">{lease.depositKes ? formatCompactKES(parseFloat(lease.depositKes)) : "-"}</p>
                    </div>
                    <div className="flex flex-col gap-2 p-5 rounded-2xl bg-slate-50 border border-slate-100 hover:border-slate-200 transition-colors">
                      <p className="label-caps text-slate-400 flex items-center gap-1.5">
                        <IconClock size={14} /> {lease.isActive ? "Term Remaining" : "Term Ended"}
                      </p>
                      <p className="mono-amount headline-md text-slate-900">{leaseTermLabel(lease)}</p>
                    </div>
                  </div>
                  <p className="body-sm text-slate-400 mt-4">Deposit is held as a refundable liability against the tenant, not recognized as income.</p>
                </Card>
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
                  <Card className="bg-white border border-slate-100 rounded-[24px] p-16 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col items-center text-center gap-4">
                    <div className="size-20 rounded-3xl bg-slate-50 border border-slate-100 flex items-center justify-center mb-2">
                      <IconFileText size={40} stroke={1.5} className="text-slate-300" aria-hidden="true" />
                    </div>
                    <h3 className="text-xl font-serif text-slate-900">No attached documents</h3>
                    <p className="text-slate-400 max-w-sm text-sm">Lease agreements, ID copies, and references will appear here once attached.</p>
                  </Card>
                ) : (
                  <Card className="bg-white border border-slate-100 rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
                    <div className="divide-y divide-slate-100">
                      {leaseDocuments.map((doc) => (
                        <a
                          key={doc.id}
                          href={doc.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50/60 transition-colors"
                        >
                          <div className="size-9 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
                            <IconFileText size={16} className="text-slate-400" />
                          </div>
                          <span className="text-body-primary text-slate-800 truncate flex-1">{doc.title}</span>
                          <span className="label-caps text-slate-400 shrink-0">{LEASE_DOCUMENT_TYPE_LABEL[doc.type] ?? doc.type}</span>
                        </a>
                      ))}
                    </div>
                  </Card>
                )}
              </div>
            )}

            {activeTab === "activity" && (
              <Card className="bg-white border border-slate-100 rounded-[24px] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-lg font-serif text-slate-900">Audit Log</h3>
                  <div className="size-10 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400">
                    <IconHistory size={20} stroke={1.5} />
                  </div>
                </div>
                {activityLoading ? (
                  <div className="flex justify-center py-12">
                    <LoadingSpinner size="md" />
                  </div>
                ) : !activityLog || activityLog.length === 0 ? (
                  <p className="text-slate-400 text-center py-12 text-sm bg-slate-50 rounded-2xl border border-slate-100 border-dashed">No recorded activity yet.</p>
                ) : (
                  <div className="space-y-0 pl-2">
                    {activityLog.map((entry, i) => (
                      <div key={entry.id} className="flex gap-4 relative py-4">
                        {i < activityLog.length - 1 && (
                          <div className="absolute left-[9px] top-[36px] bottom-0 w-0.5 bg-slate-100 rounded-full" />
                        )}
                        <div className="size-[20px] rounded-full border-[3px] border-slate-200 bg-white shrink-0 mt-0.5 z-10 shadow-sm" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800 leading-snug">{entry.summary}</p>
                          <p className="text-xs  uppercase tracking-wider text-slate-400 mt-1.5 flex items-center gap-1.5">
                            <IconClock size={14} stroke={2} />
                            {relativeTime(entry.createdAt)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )}
          </div>
        </div>

        {/* Context rail */}
        <div className="flex flex-col gap-6 mt-1 lg:mt-0">
          <Card className="bg-white border border-slate-100 rounded-[24px] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_16px_40px_rgb(0,0,0,0.06)] transition-all">
            <h3 className="label-caps text-slate-400 mb-4 flex items-center gap-2">
              <IconUser size={14} /> Principal Tenant
            </h3>
            <div className="flex items-center gap-4">
              <div className="size-14 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 border border-slate-200/60 flex items-center justify-center text-slate-700 text-lg font-medium shrink-0 shadow-inner">
                {getInitials(lease.tenantName)}
              </div>
              <div className="flex flex-col min-w-0">
                <p className="text-lg font-serif text-slate-900 truncate mb-1">{lease.tenantName}</p>
                <div className="flex flex-col gap-1.5">
                  {lease.tenantPhone && (
                    <a href={`tel:${lease.tenantPhone}`} className="text-sm text-slate-400 hover:text-slate-900 flex items-center gap-2 transition-colors">
                      <IconPhone size={14} className="shrink-0" />
                      <span className="truncate">{lease.tenantPhone}</span>
                    </a>
                  )}
                  {lease.tenantEmail && (
                    <a href={`mailto:${lease.tenantEmail}`} className="text-sm text-slate-400 hover:text-slate-900 flex items-center gap-2 transition-colors">
                      <IconMail size={14} className="shrink-0" />
                      <span className="truncate">{lease.tenantEmail}</span>
                    </a>
                  )}
                </div>
              </div>
            </div>
            <div className="mt-8 pt-6 border-t border-slate-100">
              <Link href={`/admin/contacts/${lease.tenantContactId}`} className="text-sm  text-[#151936] flex items-center justify-center gap-2 hover:text-[#151936] bg-slate-50 border border-slate-100 rounded-xl py-3 transition-colors hover:bg-slate-100">
                <IconUser size={16} /> View Full Profile
              </Link>
            </div>
          </Card>

          <Card className="bg-white border border-slate-100 rounded-[24px] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_16px_40px_rgb(0,0,0,0.06)] transition-all flex flex-col gap-4">
            <h3 className="label-caps text-slate-400 flex items-center gap-2">
              <IconCalendarEvent size={14} /> Lease Timeline
            </h3>
            <div className="flex items-center justify-between p-5 bg-slate-50 rounded-xl border border-slate-100 relative overflow-hidden">
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-400 rounded-l-xl" />
              <div className="flex flex-col gap-1.5">
                <span className="label-caps text-slate-400">Commencement</span>
                <span className="font-mono text-base text-slate-900">{new Date(lease.startsAt).toLocaleDateString()}</span>
              </div>
              <div className="size-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 shadow-sm">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg>
              </div>
              <div className="flex flex-col gap-1.5 text-right relative z-10">
                <span className="label-caps text-slate-400">Expiration</span>
                <span className="font-mono text-base text-slate-900">{new Date(lease.endsAt).toLocaleDateString()}</span>
              </div>
            </div>
          </Card>

          <Card className="bg-white border border-slate-100 rounded-[24px] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_16px_40px_rgb(0,0,0,0.06)] transition-all flex flex-col gap-4">
            <h3 className="label-caps text-slate-400 flex items-center gap-2">
              <IconBuildingCommunity size={14} /> Property Unit
            </h3>
            <div className="flex items-center gap-4">
              <div className="size-14 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 shadow-sm flex items-center justify-center shrink-0">
                <PropIcon size={24} className="text-slate-400" stroke={1.5} />
              </div>
              <div className="min-w-0">
                <p className="text-base  text-slate-900 truncate">{lease.propertyName}</p>
                <p className="text-xs font-mono text-slate-400 mt-1.5 bg-slate-100 px-2 py-0.5 rounded inline-block">UNIT {lease.propertyCode}</p>
              </div>
            </div>
            <Link href={`/admin/properties/${lease.propertyId}`} className="text-sm  text-[#151936] flex items-center justify-center gap-2 hover:text-[#151936] bg-slate-50 border border-slate-100 rounded-xl py-3 transition-colors hover:bg-slate-100 mt-2">
              <IconBuildingCommunity size={16} /> Go to Property Profile
            </Link>
          </Card>
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
    </div>
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
