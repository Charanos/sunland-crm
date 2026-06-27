"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { BoardHeader } from "@/components/ui/erp-primitives";
import {
  IconBell,
  IconUserPlus,
  IconCashBanknote,
  IconTool,
  IconFileText,
  IconInfoCircle,
  IconCheck,
  IconTrash,
  IconChevronRight,
  IconCircleCheckFilled,
  IconX,
  IconBellOff,
  IconArchive,
  IconFilter,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils/cn";
import { useToast } from "@/components/ui/toast-provider";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";

// ── Types ──────────────────────────────────────────────────────────────────────

type NotificationType = "lead" | "payment" | "maintenance" | "lease" | "system";

interface SunlandNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  href?: string;
  createdAt: string;
  readAt?: string;
  metadata?: Record<string, string | number>;
}

// ── Mock data ─────────────────────────────────────────────────────────────────

const INITIAL_NOTIFICATIONS: SunlandNotification[] = [
  {
    id: "n1",
    type: "lead",
    title: "New lead assigned",
    body: "James Kariuki is interested in Unit 4B, Westlands Tower. Pipeline stage: Inquiry.",
    href: "/admin/pipeline",
    createdAt: "2026-06-26T10:02:00Z",
    metadata: { "Lead Source": "Website Inquiry", "Property Reference": "WST-4B", "Sales Executive": "Jared Omondi" }
  },
  {
    id: "n2",
    type: "payment",
    title: "Payment received",
    body: "KES 95,000 received from Esther Howard — Ref #TXN-4821. Auto-logged to A/R.",
    href: "/fin/ap-ar",
    createdAt: "2026-06-26T09:15:00Z",
    readAt: "2026-06-26T09:30:00Z",
    metadata: { "Transaction ID": "TXN-4821", "Amount": "KES 95,000", "Ledger Impact": "DR Cash / CR Accounts Receivable" }
  },
  {
    id: "n3",
    type: "lease",
    title: "Lease expiring soon",
    body: "Acacia Court Unit 12 lease expires in 14 days. Renewal required.",
    href: "/admin/leases",
    createdAt: "2026-06-26T07:00:00Z",
    metadata: { "Tenant": "Peter Ndegwa", "Unit": "Acacia Court - Apt 12", "Days to Expiry": 14 }
  },
  {
    id: "n4",
    type: "maintenance",
    title: "Maintenance ticket opened",
    body: "Unit 7A — Plumbing issue reported by tenant. Assigned to Contractor B.",
    href: "/admin/maintenance",
    createdAt: "2026-06-25T15:45:00Z",
    readAt: "2026-06-25T16:00:00Z",
    metadata: { "Issue Category": "Plumbing Leak", "Priority": "High", "Assigned Contractor": "Spencon Ltd" }
  },
  {
    id: "n5",
    type: "payment",
    title: "Payroll approval pending",
    body: "June payroll run PR-2026-06 requires your sign-off before disbursement.",
    href: "/fin/payroll",
    createdAt: "2026-06-25T08:00:00Z",
    metadata: { "Disbursement Reference": "PR-2026-06", "Total Value": "KES 1,240,000", "Pending Signatures": "CEO / GM" }
  },
  {
    id: "n6",
    type: "system",
    title: "Platform update deployed",
    body: "Sunland ERP v2.4.1 — Finance module enhancements and bug fixes applied.",
    createdAt: "2026-06-24T12:00:00Z",
    readAt: "2026-06-24T12:30:00Z",
    metadata: { "System Version": "v2.4.1", "Updates Applied": "Recharts migration, Universal access paths" }
  },
  {
    id: "n7",
    type: "lead",
    title: "Offer submitted",
    body: "Grace Wanjiku made an offer on Karen Ridge House Unit 3. Review in pipeline.",
    href: "/admin/pipeline",
    createdAt: "2026-06-24T10:00:00Z",
    metadata: { "Offer Amount": "KES 18,500,000", "Commission Rate": "3.5%", "Property ID": "KRN-03" }
  },
  {
    id: "n8",
    type: "maintenance",
    title: "Maintenance resolved",
    body: "Ticket #419 — Electrical issue at Runda Grove Villa marked as resolved.",
    href: "/admin/maintenance",
    createdAt: "2026-06-23T16:00:00Z",
    readAt: "2026-06-23T16:30:00Z",
    metadata: { "Ticket ID": "MNT-419", "Resolution Details": "Replaced fuse box breaker", "Approved Cost": "KES 8,500" }
  },
];

const TYPE_LABELS: Record<NotificationType, string> = {
  lead: "Sales / Leads",
  payment: "Core / Finance",
  maintenance: "Ops / Maint.",
  lease: "Ops / Leases",
  system: "IT / System",
};

const TYPE_ICONS: Record<NotificationType, typeof IconBell> = {
  lead: IconUserPlus,
  payment: IconCashBanknote,
  maintenance: IconTool,
  lease: IconFileText,
  system: IconInfoCircle,
};

const TYPE_COLORS: Record<NotificationType, string> = {
  lead: "bg-indigo-50 text-indigo-600 border-indigo-100",
  payment: "bg-emerald-50 text-emerald-600 border-emerald-100",
  maintenance: "bg-amber-50 text-amber-600 border-amber-100",
  lease: "bg-purple-50 text-purple-600 border-purple-100",
  system: "bg-slate-50 text-slate-500 border-slate-200",
};

const FILTER_TABS = [
  { id: "All", label: "All" },
  { id: "Unread", label: "Unread" },
  { id: "Leads", label: "Sales / Leads" },
  { id: "Finance", label: "Core / Finance" },
  { id: "Maintenance", label: "Ops / Maint." },
  { id: "Leases", label: "Ops / Leases" },
  { id: "System", label: "IT / System" },
] as const;
type FilterTab = typeof FILTER_TABS[number]["id"];

// ── Helpers ────────────────────────────────────────────────────────────────────

function relativeTime(isoStr: string): string {
  const diff = Date.now() - new Date(isoStr).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "Just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  return days === 1 ? "Yesterday" : `${days}d ago`;
}

// ── Main Shared Page ───────────────────────────────────────────────────────────

export function NotificationsPageContent({ portalPrefix = "/admin" }: { portalPrefix?: string }) {
  const [items, setItems] = useState<SunlandNotification[]>(INITIAL_NOTIFICATIONS);
  const [activeFilter, setActiveFilter] = useState<FilterTab>("All");
  const [selectedNotify, setSelectedNotify] = useState<SunlandNotification | null>(null);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const { pushToast } = useToast();

  const filtered = useMemo(() => {
    return items.filter(n => {
      if (activeFilter === "All") return true;
      if (activeFilter === "Unread") return !n.readAt;
      const typeMap: Record<string, NotificationType> = {
        "Leads": "lead",
        "Finance": "payment",
        "Maintenance": "maintenance",
        "Leases": "lease",
        "System": "system",
      };
      return n.type === typeMap[activeFilter];
    });
  }, [items, activeFilter]);

  const unreadCount = useMemo(() => items.filter(n => !n.readAt).length, [items]);

  const markAllRead = async () => {
    setIsBulkProcessing(true);
    await new Promise(r => setTimeout(r, 600));
    setItems(prev => prev.map(n => ({ ...n, readAt: n.readAt || new Date().toISOString() })));
    setIsBulkProcessing(false);
    pushToast({ tone: "success", title: "All Marked Read", body: "All unread messages successfully cleared." });
  };

  const clearAllArchived = async () => {
    setIsBulkProcessing(true);
    await new Promise(r => setTimeout(r, 800));
    setItems(prev => prev.filter(n => !n.readAt));
    setIsBulkProcessing(false);
    pushToast({ tone: "warning", title: "Archive Flushed", body: "All read/archived notifications removed." });
  };

  const markRead = (id: string) => {
    setItems(prev => prev.map(n => n.id === id ? { ...n, readAt: new Date().toISOString() } : n));
    pushToast({ tone: "success", title: "Notification Cleared", body: "Item marked as read." });
  };

  const deleteItem = (id: string) => {
    setItems(prev => prev.filter(n => n.id !== id));
    pushToast({ tone: "warning", title: "Deleted", body: "Notification deleted." });
    if (selectedNotify?.id === id) setSelectedNotify(null);
  };

  const resolvePortalPath = (path?: string) => {
    if (!path) return undefined;
    // Map /admin links to match active portal route prefix
    if (portalPrefix === "/fin" && path.startsWith("/admin")) {
      return path.replace("/admin", "/fin");
    }
    return path;
  };

  return (
    <div className="mx-auto max-w-[98rem] flex flex-col gap-6 pb-12 animate-fade-in px-4 md:px-6">

      <BoardHeader
        title={
          <span className="flex items-center gap-3">
            Notification Centre
            {unreadCount > 0 && (
              <span className="inline-flex size-6 items-center justify-center rounded-full bg-amber-500 text-white text-tiny font-mono font-medium animate-pulse shadow-sm">
                {unreadCount}
              </span>
            )}
          </span>
        }
        description="Track transactions, lead allocations, and system maintenance triggers."
        actions={
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                type="button"
                disabled={isBulkProcessing}
                onClick={markAllRead}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-caption text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-all shadow-sm disabled:opacity-50"
              >
                {isBulkProcessing ? (
                  <span className="size-3.5 rounded-full border-2 border-slate-400 border-t-transparent animate-spin" />
                ) : (
                  <IconCheck size={14} />
                )}
                Mark all read
              </button>
            )}
            {items.some(n => n.readAt) && (
              <button
                type="button"
                disabled={isBulkProcessing}
                onClick={clearAllArchived}
                className="flex items-center gap-1.5 rounded-xl border border-red-150 bg-red-50 px-4 py-2 text-caption text-red-600 hover:bg-red-100 transition-all shadow-sm disabled:opacity-50"
              >
                <IconTrash size={14} />
                Clear Read
              </button>
            )}
          </div>
        }
      />

      {/* ── Category Tabs ──────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 border-b border-slate-150 pb-3 mb-2">
        {FILTER_TABS.map(tab => {
          const count = tab.id === "Unread" ? unreadCount : tab.id === "All" ? items.length :
            items.filter(n => {
              const typeMap: Record<string, NotificationType> = {
                "Leads": "lead", "Finance": "payment", "Maintenance": "maintenance", "Leases": "lease", "System": "system"
              };
              return n.type === typeMap[tab.id];
            }).length;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveFilter(tab.id)}
              className={cn(
                "inline-flex px-4 py-2 text-caption font-medium rounded-xl transition-all items-center gap-2",
                activeFilter === tab.id
                  ? "bg-[#151936] text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              <span>{tab.label}</span>
              {count > 0 && (
                <span className={cn(
                  "flex items-center justify-center rounded-full px-1.5 py-0.5 text-tiny font-medium font-mono",
                  activeFilter === tab.id ? "bg-[#f3df27] text-[#151936]" : "bg-slate-100 text-slate-500"
                )}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Notification Feed ─────────────────────────────── */}
      <div className="space-y-3 animate-fade-in-up">
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm flex flex-col items-center justify-center py-20 text-center">
            <div className="size-16 rounded-2xl bg-slate-50 flex items-center justify-center mb-4 border border-slate-100 shadow-inner">
              <IconBellOff size={28} className="text-slate-350" />
            </div>
            <p className="headline-md text-slate-800">Caught up completely</p>
            <p className="text-caption text-slate-400 mt-1.5">No alerts exist under the {activeFilter.toLowerCase()} criteria filter.</p>
          </div>
        ) : (
          filtered.map((n, idx) => {
            const TypeIcon = TYPE_ICONS[n.type];
            const isUnread = !n.readAt;

            return (
              <div
                key={n.id}
                onClick={() => setSelectedNotify(n)}
                className={cn(
                  "group relative flex items-start gap-4 rounded-xl border p-4 bg-white shadow-sm transition-all duration-350 hover:shadow-md cursor-pointer",
                  isUnread ? "border-emerald-250/90 pl-[21px]" : "border-slate-200/70"
                )}
                style={{ animationDelay: `${idx * 0.03}s` }}
              >
                {/* Unread vertical bar indicator */}
                {isUnread && (
                  <div className="absolute left-0 top-0 bottom-0 w-[4px] rounded-l-xl bg-emerald-500" />
                )}

                {/* Circular Category Badge */}
                <div className={cn("size-8 shrink-0 rounded-full flex items-center justify-center text-sm shadow-sm mt-0.5", TYPE_COLORS[n.type])}>
                  <TypeIcon size={14} />
                </div>

                {/* Body text block */}
                <div className="flex-1 min-w-0 pr-6 flex flex-col justify-center">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <p className={cn("text-caption truncate leading-tight", isUnread ? "text-slate-900 font-semibold" : "text-slate-700")}>
                        {n.title}
                      </p>
                      {isUnread && (
                        <span className="rounded bg-emerald-50 text-emerald-700 border border-emerald-200/50 text-[9px] font-semibold px-1.5 py-0.5 uppercase tracking-wide">New</span>
                      )}
                    </div>
                    <span className="text-tiny font-mono text-slate-400">{relativeTime(n.createdAt)}</span>
                  </div>
                  <p className="text-tiny text-slate-500 mt-1.5 leading-relaxed">{n.body}</p>
                  <div className="flex items-center gap-2 mt-2.5">
                    <span className="rounded bg-slate-100 text-slate-600 text-[9px] font-mono font-semibold px-2 py-0.5 uppercase tracking-wider">{TYPE_LABELS[n.type]}</span>
                    {resolvePortalPath(n.href) && (
                      <Link
                        href={resolvePortalPath(n.href)!}
                        onClick={(e) => { e.stopPropagation(); markRead(n.id); }}
                        className="text-tiny text-slate-500 hover:text-slate-900 font-semibold flex items-center gap-0.5 transition-colors ml-1"
                      >
                        Access <IconChevronRight size={10} className="mt-0.5" />
                      </Link>
                    )}
                  </div>
                </div>

                {/* Actions overlay panel */}
                <div className="absolute right-5 top-1/2 -translate-y-1/2 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all duration-200">
                  {isUnread && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); markRead(n.id); }}
                      className="flex size-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors shadow-sm"
                      title="Mark read"
                    >
                      <IconCheck size={14} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); deleteItem(n.id); }}
                    className="flex size-8 items-center justify-center rounded-xl bg-red-50 text-red-500 hover:bg-red-100 transition-colors"
                    title="Delete alert"
                  >
                    <IconTrash size={14} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── Notification Detail Modal ───────────────────────── */}
      <Modal open={selectedNotify !== null} onClose={() => setSelectedNotify(null)} title="Notification Details">
        {selectedNotify && (
          <div className="space-y-5 pt-1 text-slate-700 text-sm">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
              <div className={cn("size-10 rounded-xl border flex items-center justify-center shadow-inner shrink-0", TYPE_COLORS[selectedNotify.type])}>
                {(() => {
                  const Icon = TYPE_ICONS[selectedNotify.type];
                  return <Icon size={18} />;
                })()}
              </div>
              <div>
                <h4 className="font-medium text-slate-900 leading-snug body-md">{selectedNotify.title}</h4>
                <p className="text-tiny text-slate-400 mt-0.5 font-mono">{relativeTime(selectedNotify.createdAt)} · {new Date(selectedNotify.createdAt).toLocaleString()}</p>
              </div>
            </div>

            <p className="text-caption text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-100">
              {selectedNotify.body}
            </p>

            {/* Embedded metadata */}
            {selectedNotify.metadata && (
              <div className="space-y-2">
                <p className="label-caps text-slate-400">Transaction Parameters</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {Object.entries(selectedNotify.metadata).map(([key, val]) => (
                    <div key={key} className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm flex flex-col gap-0.5">
                      <span className="text-[10px] text-slate-400 label-caps">{key}</span>
                      <span className="text-caption text-slate-800 font-mono font-medium truncate">{val}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => deleteItem(selectedNotify.id)}
                className="flex items-center gap-1 text-tiny text-red-500 hover:text-red-700 transition-colors"
              >
                <IconTrash size={12} />
                Delete Notification
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedNotify(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-caption text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Close
                </button>
                {resolvePortalPath(selectedNotify.href) ? (
                  <Link
                    href={resolvePortalPath(selectedNotify.href)!}
                    onClick={() => { markRead(selectedNotify.id); setSelectedNotify(null); }}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--sidebar)] text-caption text-white hover:opacity-90 shadow-sm transition-all"
                  >
                    Resolve Alert <IconChevronRight size={13} />
                  </Link>
                ) : (
                  !selectedNotify.readAt && (
                    <button
                      type="button"
                      onClick={() => { markRead(selectedNotify.id); setSelectedNotify(null); }}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 shadow-sm transition-all"
                    >
                      Mark Read <IconCheck size={13} />
                    </button>
                  )
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>

    </div>
  );
}
