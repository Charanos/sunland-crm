"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import Link from "next/link";
import { BoardHeader } from "@/components/ui/erp-primitives";
import {
  IconBell,
  IconCashBanknote,
  IconInfoCircle,
  IconCheck,
  IconChevronRight,
  IconBellOff,
  IconLifebuoy,
  IconAlertTriangle,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils/cn";
import { useToast } from "@/components/ui/toast-provider";
import { Modal } from "@/components/ui/modal";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { PageTransition } from "@/components/shared/page-transition";

// ── Types ──────────────────────────────────────────────────────────────────────
// Matches the real /api/notifications response shape (notifications table) —
// `type` is a free-text dotted string ("complaint.assigned", "approval.pending",
// etc.), not a closed enum, so display metadata is resolved by prefix below
// rather than a fixed union.

interface SunlandNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  href: string | null;
  createdAt: string;
  readAt: string | null;
}

type NotifCategory = "complaint" | "support_ticket" | "approval" | "system";

const CATEGORY_META: Record<NotifCategory, { label: string; icon: typeof IconBell; color: string }> = {
  complaint: { label: "HR / Complaints", icon: IconAlertTriangle, color: "bg-purple-50 text-purple-600 border-purple-100" },
  support_ticket: { label: "Support Tickets", icon: IconLifebuoy, color: "bg-amber-50 text-amber-600 border-amber-100" },
  approval: { label: "Approvals", icon: IconCashBanknote, color: "bg-emerald-50 text-emerald-600 border-emerald-100" },
  system: { label: "System", icon: IconInfoCircle, color: "bg-slate-50 text-slate-500 border-slate-200" },
};

function categorize(type: string): NotifCategory {
  const prefix = type.split(".")[0];
  if (prefix === "complaint") return "complaint";
  if (prefix === "support_ticket") return "support_ticket";
  if (prefix === "approval") return "approval";
  return "system";
}

const FILTER_TABS = [
  { id: "All", label: "All" },
  { id: "Unread", label: "Unread" },
  { id: "complaint", label: "HR / Complaints" },
  { id: "support_ticket", label: "Support Tickets" },
  { id: "approval", label: "Approvals" },
  { id: "system", label: "System" },
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
  const [items, setItems] = useState<SunlandNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterTab>("All");
  const [selectedNotify, setSelectedNotify] = useState<SunlandNotification | null>(null);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const { pushToast } = useToast();

  const loadNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load notifications");
      setItems(data.notifications ?? []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load notifications";
      pushToast({ tone: "error", title: "Error", body: message });
    } finally {
      setIsLoading(false);
    }
  }, [pushToast]);

  useEffect(() => {
    Promise.resolve().then(() => loadNotifications());
  }, [loadNotifications]);

  const filtered = useMemo(() => {
    return items.filter(n => {
      if (activeFilter === "All") return true;
      if (activeFilter === "Unread") return !n.readAt;
      return categorize(n.type) === activeFilter;
    });
  }, [items, activeFilter]);

  const unreadCount = useMemo(() => items.filter(n => !n.readAt).length, [items]);

  const markAllRead = async () => {
    setIsBulkProcessing(true);
    try {
      const res = await fetch("/api/notifications/mark-all-read", { method: "POST" });
      if (!res.ok) throw new Error("Failed to mark all as read");
      setItems(prev => prev.map(n => ({ ...n, readAt: n.readAt || new Date().toISOString() })));
      pushToast({ tone: "success", title: "All Marked Read", body: "All unread notifications cleared." });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not mark all as read.";
      pushToast({ tone: "error", title: "Error", body: message });
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const markRead = async (id: string) => {
    // Optimistic — the row already exists locally, so flip it immediately and
    // let the request confirm rather than blocking the click on round-trip latency.
    setItems(prev => prev.map(n => n.id === id ? { ...n, readAt: new Date().toISOString() } : n));
    try {
      const res = await fetch(`/api/notifications/${id}/read`, { method: "PATCH" });
      if (!res.ok) throw new Error("Failed to mark notification as read");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not mark notification as read.";
      pushToast({ tone: "error", title: "Error", body: message });
      loadNotifications();
    }
  };

  const resolvePortalPath = (path?: string | null) => {
    if (!path) return undefined;
    // Map /admin links to match active portal route prefix
    if (portalPrefix === "/fin" && path.startsWith("/admin")) {
      return path.replace("/admin", "/fin");
    }
    return path;
  };

  return (
    <PageTransition className="mx-auto max-w-[98rem] flex flex-col gap-6 pb-12 px-4 md:px-6">

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
        description="Track approvals, complaint escalations, and support-ticket activity."
        actions={
          unreadCount > 0 ? (
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
          ) : undefined
        }
      />

      {/* ── Category Tabs ──────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 border-b border-slate-150 pb-3 mb-2">
        {FILTER_TABS.map(tab => {
          const count = tab.id === "Unread" ? unreadCount : tab.id === "All" ? items.length :
            items.filter(n => categorize(n.type) === tab.id).length;

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
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <LoadingSpinner size="md" />
        </div>
      ) : (
        <div className="gsap-stagger space-y-3">
          {filtered.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm flex flex-col items-center justify-center py-20 text-center">
              <div className="size-16 rounded-2xl bg-slate-50 flex items-center justify-center mb-4 border border-slate-100 shadow-inner">
                <IconBellOff size={28} className="text-slate-350" />
              </div>
              <p className="headline-md text-slate-800">Caught up completely</p>
              <p className="text-caption text-slate-400 mt-1.5">No alerts exist under the {activeFilter.toLowerCase()} criteria filter.</p>
            </div>
          ) : (
            filtered.map((n) => {
              const category = categorize(n.type);
              const meta = CATEGORY_META[category];
              const TypeIcon = meta.icon;
              const isUnread = !n.readAt;

              return (
                <div
                  key={n.id}
                  onClick={() => setSelectedNotify(n)}
                  className={cn(
                    "group relative flex items-start gap-4 rounded-xl border p-4 bg-white shadow-sm transition-all duration-350 hover:shadow-md cursor-pointer",
                    isUnread ? "border-emerald-250/90 pl-[21px]" : "border-slate-200/70"
                  )}
                >
                  {/* Unread vertical bar indicator */}
                  {isUnread && (
                    <div className="absolute left-0 top-0 bottom-0 w-[4px] rounded-l-xl bg-emerald-500" />
                  )}

                  {/* Circular Category Badge */}
                  <div className={cn("size-8 shrink-0 rounded-full flex items-center justify-center text-sm shadow-sm mt-0.5", meta.color)}>
                    <TypeIcon size={14} />
                  </div>

                  {/* Body text block */}
                  <div className="flex-1 min-w-0 pr-6 flex flex-col justify-center">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <p className={cn("text-caption truncate leading-tight", isUnread ? "text-slate-900 font-normal" : "text-slate-700")}>
                          {n.title}
                        </p>
                        {isUnread && (
                          <span className="rounded bg-emerald-50 text-emerald-700 border border-emerald-200/50 text-[9px] font-normal px-1.5 py-0.5 uppercase tracking-wide">New</span>
                        )}
                      </div>
                      <span className="text-tiny font-mono text-slate-400">{relativeTime(n.createdAt)}</span>
                    </div>
                    <p className="text-tiny text-slate-500 mt-1.5 leading-relaxed">{n.body}</p>
                    <div className="flex items-center gap-2 mt-2.5">
                      <span className="rounded bg-slate-100 text-slate-600 text-[9px] font-mono font-normal px-2 py-0.5 uppercase tracking-wider">{meta.label}</span>
                      {resolvePortalPath(n.href) && (
                        <Link
                          href={resolvePortalPath(n.href)!}
                          onClick={(e) => { e.stopPropagation(); markRead(n.id); }}
                          className="text-tiny text-slate-500 hover:text-slate-900 font-normal flex items-center gap-0.5 transition-colors ml-1"
                        >
                          Access <IconChevronRight size={10} className="mt-0.5" />
                        </Link>
                      )}
                    </div>
                  </div>

                  {/* Actions overlay panel */}
                  {isUnread && (
                    <div className="absolute right-5 top-1/2 -translate-y-1/2 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all duration-200">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); markRead(n.id); }}
                        className="flex size-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors shadow-sm"
                        title="Mark read"
                      >
                        <IconCheck size={14} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── Notification Detail Modal ───────────────────────── */}
      <Modal open={selectedNotify !== null} onClose={() => setSelectedNotify(null)} title="Notification Details">
        {selectedNotify && (
          <div className="space-y-5 pt-1 text-slate-700 text-sm">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
              <div className={cn("size-10 rounded-xl border flex items-center justify-center shadow-inner shrink-0", CATEGORY_META[categorize(selectedNotify.type)].color)}>
                {(() => {
                  const Icon = CATEGORY_META[categorize(selectedNotify.type)].icon;
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

            <div className="flex items-center justify-end pt-4 border-t border-slate-100 gap-2">
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
        )}
      </Modal>

    </PageTransition>
  );
}
