"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  IconBell,
  IconUserPlus,
  IconCashBanknote,
  IconTool,
  IconFileText,
  IconInfoCircle,
  IconCircleCheckFilled,
  IconCheck,
  IconTrash,
  IconChevronRight,
  IconFilter,
  IconX,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils/cn";
import { useToast } from "@/components/ui/toast-provider";
import type { NotificationType, SunlandNotification } from "@/types";

// ── Mock data ─────────────────────────────────────────────────────────────────

const MOCK_NOTIFICATIONS: SunlandNotification[] = [
  { id: "n1", type: "lead", title: "New lead assigned", body: "James Kariuki is interested in Unit 4B, Westlands Tower. Pipeline stage: Inquiry.", href: "/admin/pipeline", createdAt: "2026-06-26T10:02:00Z" },
  { id: "n2", type: "payment", title: "Payment received", body: "KES 95,000 received from Esther Howard — Ref #TXN-4821. Auto-logged to A/R.", href: "/fin/ap-ar", createdAt: "2026-06-26T09:15:00Z", readAt: "2026-06-26T09:30:00Z" },
  { id: "n3", type: "lease", title: "Lease expiring soon", body: "Acacia Court Unit 12 lease expires in 14 days. Renewal required.", href: "/admin/leases", createdAt: "2026-06-26T07:00:00Z" },
  { id: "n4", type: "maintenance", title: "Maintenance ticket opened", body: "Unit 7A — Plumbing issue reported by tenant. Assigned to Contractor B.", href: "/admin/maintenance", createdAt: "2026-06-25T15:45:00Z", readAt: "2026-06-25T16:00:00Z" },
  { id: "n5", type: "payment", title: "Payroll approval pending", body: "June payroll run PR-2026-06 requires your sign-off before disbursement.", href: "/fin", createdAt: "2026-06-25T08:00:00Z" },
  { id: "n6", type: "system", title: "Platform update deployed", body: "Sunland ERP v2.4.1 — Finance module enhancements and bug fixes applied.", href: "/admin/settings", createdAt: "2026-06-24T12:00:00Z", readAt: "2026-06-24T12:30:00Z" },
  { id: "n7", type: "lead", title: "Offer submitted", body: "Grace Wanjiku made an offer on Karen Ridge House Unit 3. Review in pipeline.", href: "/admin/pipeline", createdAt: "2026-06-24T10:00:00Z" },
  { id: "n8", type: "maintenance", title: "Maintenance resolved", body: "Ticket #419 — Electrical issue at Runda Grove Villa marked as resolved.", href: "/admin/maintenance", createdAt: "2026-06-23T16:00:00Z", readAt: "2026-06-23T16:30:00Z" },
];

const TYPE_LABELS: Record<NotificationType, string> = {
  lead: "Lead",
  payment: "Finance",
  maintenance: "Maintenance",
  lease: "Lease",
  system: "System",
};

const TYPE_ICONS: Record<NotificationType, typeof IconBell> = {
  lead: IconUserPlus,
  payment: IconCashBanknote,
  maintenance: IconTool,
  lease: IconFileText,
  system: IconInfoCircle,
};

const TYPE_COLORS: Record<NotificationType, string> = {
  lead: "bg-[var(--tertiary)]/10 text-[var(--tertiary)]",
  payment: "bg-emerald-50 text-emerald-600",
  maintenance: "bg-amber-50 text-amber-600",
  lease: "bg-purple-50 text-purple-600",
  system: "bg-slate-100 text-slate-500",
};

const FILTER_TABS = ["All", "Unread", "Lead", "Finance", "Maintenance", "Lease", "System"] as const;
type FilterTab = typeof FILTER_TABS[number];

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

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const [items, setItems] = useState(MOCK_NOTIFICATIONS);
  const [activeFilter, setActiveFilter] = useState<FilterTab>("All");
  const { pushToast } = useToast();

  const filtered = useMemo(() => {
    return items.filter(n => {
      if (activeFilter === "All") return true;
      if (activeFilter === "Unread") return !n.readAt;
      const typeMap: Record<string, NotificationType> = {
        "Lead": "lead", "Finance": "payment", "Maintenance": "maintenance", "Lease": "lease", "System": "system"
      };
      return n.type === typeMap[activeFilter];
    });
  }, [items, activeFilter]);

  const unreadCount = items.filter(n => !n.readAt).length;

  const markAllRead = () => {
    setItems(prev => prev.map(n => ({ ...n, readAt: n.readAt || new Date().toISOString() })));
    pushToast({ tone: "success", title: "All marked read", body: "All notifications have been cleared." });
  };

  const markRead = (id: string) => {
    setItems(prev => prev.map(n => n.id === id ? { ...n, readAt: new Date().toISOString() } : n));
  };

  const dismiss = (id: string) => {
    setItems(prev => prev.filter(n => n.id !== id));
  };

  return (
    <div className="mx-auto max-w-[72rem] flex flex-col gap-5 pb-12 animate-fade-in">

      {/* ── Header ───────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="label-caps text-[var(--on-surface-dim)] mb-1">Notification Centre</p>
          <h1 className="headline-lg text-slate-900">
            Notifications
            {unreadCount > 0 && (
              <span className="ml-3 inline-flex size-7 items-center justify-center rounded-full bg-red-500 text-tiny text-white">
                {unreadCount}
              </span>
            )}
          </h1>
          <p className="body-sm text-slate-500 mt-1">Stay updated on leads, payments, leases, and platform events.</p>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button type="button" onClick={markAllRead}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-caption text-slate-600 shadow-sm hover:bg-slate-50 transition-colors">
              <IconCheck size={14} />
              Mark all read
            </button>
          )}
        </div>
      </div>

      {/* ── Filter Tabs ───────────────────────────────────── */}
      <div className="flex items-center gap-1 overflow-x-auto rounded-2xl border border-slate-200/80 bg-white p-1.5 shadow-[0_1px_4px_rgba(0,0,0,0.04)] [scrollbar-width:none]">
        {FILTER_TABS.map(tab => {
          const count = tab === "Unread" ? unreadCount : tab === "All" ? items.length :
            items.filter(n => {
              const typeMap: Record<string, NotificationType> = { "Lead": "lead", "Finance": "payment", "Maintenance": "maintenance", "Lease": "lease", "System": "system" };
              return n.type === typeMap[tab];
            }).length;

          return (
            <button key={tab} type="button" onClick={() => setActiveFilter(tab)}
              className={cn(
                "flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3.5 py-1.5 text-caption transition-all",
                activeFilter === tab
                  ? "bg-[var(--sidebar)] text-white shadow-sm"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
              )}>
              {tab}
              {count > 0 && (
                <span className={cn(
                  "flex size-4 items-center justify-center rounded-full text-[9px]",
                  activeFilter === tab ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                )}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Notification Feed ─────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_4px_rgba(0,0,0,0.04)] overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="size-14 rounded-full bg-emerald-50 flex items-center justify-center mb-3">
              <IconCircleCheckFilled size={28} className="text-emerald-400" />
            </div>
            <p className="headline-md text-slate-700">You&apos;re all caught up</p>
            <p className="body-sm text-slate-400 mt-1">No notifications matching this filter.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map((n, idx) => {
              const TypeIcon = TYPE_ICONS[n.type];
              const isUnread = !n.readAt;

              return (
                <div
                  key={n.id}
                  className={cn(
                    "group flex items-start gap-4 px-5 py-4 transition-colors hover:bg-slate-50/50 animate-fade-in-up",
                    isUnread && "bg-blue-50/20"
                  )}
                  style={{ animationDelay: `${idx * 0.03}s` }}
                >
                  {/* Type icon */}
                  <div className={cn("size-9 shrink-0 rounded-xl flex items-center justify-center mt-0.5", TYPE_COLORS[n.type])}>
                    <TypeIcon size={17} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className={cn("text-label leading-snug", isUnread ? "text-slate-900" : "text-slate-700")}>
                            {n.title}
                          </p>
                          {isUnread && (
                            <span className="size-2 shrink-0 rounded-full bg-[var(--tertiary)]" />
                          )}
                        </div>
                        <p className="text-caption text-slate-500 mt-0.5 leading-relaxed">{n.body}</p>
                        <div className="flex items-center gap-3 mt-1.5">
                          <span className="badge-pill badge-tone-neutral">{TYPE_LABELS[n.type]}</span>
                          <span className="text-tiny text-slate-400">{relativeTime(n.createdAt)}</span>
                          {n.href && (
                            <Link href={n.href} onClick={() => markRead(n.id)}
                              className="text-tiny text-[var(--tertiary)] flex items-center gap-0.5 hover:opacity-70 transition-opacity">
                              View <IconChevronRight size={11} />
                            </Link>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        {isUnread && (
                          <button type="button" onClick={() => markRead(n.id)} aria-label="Mark as read"
                            className="flex size-7 items-center justify-center rounded-lg text-slate-400 hover:bg-emerald-50 hover:text-emerald-500 transition-colors">
                            <IconCheck size={13} />
                          </button>
                        )}
                        <button type="button" onClick={() => dismiss(n.id)} aria-label="Dismiss"
                          className="flex size-7 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-400 transition-colors">
                          <IconX size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
