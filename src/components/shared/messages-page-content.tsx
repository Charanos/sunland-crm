"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import {
  IconArchive,
  IconArrowLeft,
  IconArrowUpRight,
  IconBuildingCommunity,
  IconCalendarEvent,
  IconCash,
  IconFileText,
  IconLink,
  IconMessageCircle,
  IconPaperclip,
  IconPencilPlus,
  IconPhone,
  IconSearch,
  IconSend,
  IconServerBolt,
  IconSparkles,
  IconTool,
  IconX,
  type Icon,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils/cn";
import { Avatar, SkeletonBlock } from "@/components/ui/erp-primitives";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast-provider";
import { useAblyChannel } from "@/hooks/use-ably-channel";
import { usePresence } from "@/hooks/use-presence";

// ── Types ────────────────────────────────────────────────────────────────────
// Mirrors the real /api/messaging/* shapes. `linkedRecord*` and the "system"
// conversation kind are real columns (ADR 019) written by the services that
// own the underlying events - a system thread exists because a remittance
// released or a work order moved, never for display.

interface Conversation {
  id: string;
  type: "dm" | "channel" | "system";
  name: string | null;
  description: string | null;
  otherParticipant: {
    id: string;
    name: string;
    email: string;
    role: string;
    title: string | null;
    avatarUrl: string | null;
    phone: string | null;
  } | null;
  unreadCount: number;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  lastMessageSenderId: string | null;
  linkedRecordType: string | null;
  linkedRecordId: string | null;
  linkedRecordCode: string | null;
  archivedAt: string | null;
}

interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  type: "text" | "system";
  createdAt: string;
}

interface UserOption {
  id: string;
  name: string;
  role: string;
  avatarUrl: string | null;
}

interface DocumentOption {
  id: string;
  title?: string | null;
  fileName?: string | null;
  type?: string | null;
}

type Filter = "all" | "unread" | "people" | "system";

// ── Record vocabulary ────────────────────────────────────────────────────────

const CATEGORY_META: Record<string, { label: string; chip: string; tile: string; icon: Icon }> = {
  maintenance_request: { label: "Maintenance", chip: "bg-rose-50 text-rose-600", tile: "bg-rose-50 text-rose-500", icon: IconTool },
  remittance_advice: { label: "Remittance", chip: "bg-emerald-50 text-emerald-700", tile: "bg-emerald-50 text-emerald-600", icon: IconCash },
  calendar_event: { label: "Viewing", chip: "bg-slate-100 text-slate-600", tile: "bg-slate-100 text-slate-500", icon: IconCalendarEvent },
  lease: { label: "Renewal", chip: "bg-amber-50 text-amber-700", tile: "bg-amber-50 text-amber-600", icon: IconFileText },
  property: { label: "Property", chip: "bg-indigo-50 text-indigo-600", tile: "bg-indigo-50 text-indigo-500", icon: IconBuildingCommunity },
};

const SYSTEM_META = { label: "System", chip: "bg-violet-50 text-violet-700", tile: "bg-violet-50 text-violet-500", icon: IconServerBolt };

function categoryFor(convo: Conversation) {
  if (convo.linkedRecordType && CATEGORY_META[convo.linkedRecordType]) return CATEGORY_META[convo.linkedRecordType];
  if (convo.type === "system") return SYSTEM_META;
  return null;
}

/** Deep link for the thread's "Open record" action - only for record types that have a real page. */
function recordHref(type: string | null, id: string | null): string | null {
  if (!type || !id) return null;
  switch (type) {
    case "maintenance_request": return `/admin/maintenance/${id}`;
    case "lease": return `/admin/leases/${id}`;
    case "property": return `/admin/properties/${id}`;
    case "remittance_advice": return "/admin/leases";
    case "calendar_event": return "/admin/scheduler?mode=events";
    default: return null;
  }
}

/**
 * Quick replies are contextual to what the thread is actually about, and
 * sending one posts a real message - they are shortcuts, not canned
 * automation.
 */
function quickRepliesFor(type: string | null): string[] {
  switch (type) {
    case "maintenance_request": return ["Approved — proceed", "Hold — call me first", "Send me the invoice"];
    case "remittance_advice": return ["Approved — release", "Hold — I'm reviewing", "Send the statement"];
    case "lease": return ["Proceed with renewal", "Let's renegotiate", "Send me the draft"];
    case "calendar_event": return ["Confirmed", "Please reschedule", "Send the details"];
    default: return ["Thanks — noted", "Can you confirm?", "Let's jump on a call"];
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function shortTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const days = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit", hour12: false });
  }
  if (days <= 1) return "Yst";
  return `${days}d`;
}

function clockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-KE", { weekday: "long", month: "short", day: "numeric" });
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

function titleOf(convo: Conversation): string {
  return convo.name ?? convo.otherParticipant?.name ?? "Conversation";
}

// ── Component ────────────────────────────────────────────────────────────────

export function MessagesPageContent({ entityId = "group" }: { entityId?: string }) {
  const { pushToast } = useToast();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [documents, setDocuments] = useState<DocumentOption[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [mobileThread, setMobileThread] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const presentIds = usePresence(entityId, currentUserId);

  // ── Loading ────────────────────────────────────────────────────────────────
  const loadConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/messaging/conversations");
      const data = await res.json();
      setConversations(Array.isArray(data.conversations) ? data.conversations : (data ?? []));
    } catch {
      pushToast({ tone: "error", title: "Couldn't load messages", body: "Try refreshing the page." });
    } finally {
      setLoading(false);
    }
  }, [pushToast]);

  // Deferred off the effect body - calling these synchronously trips the
  // cascading-render rule (see .agents/skills/workflow-fixes/SKILL.md #1),
  // the same pattern the other boards use.
  useEffect(() => {
    Promise.resolve().then(() => {
      loadConversations();
      fetch("/api/auth/me").then((r) => r.json()).then((d) => { if (d?.user) setCurrentUserId(d.user.id); }).catch(() => { });
      fetch(`/api/identity/users?entityId=${entityId}`).then((r) => r.json()).then((d) => { if (Array.isArray(d.users)) setUsers(d.users); }).catch(() => { });
      fetch(`/api/documents?entityId=${entityId}`).then((r) => r.json()).then((d) => { if (Array.isArray(d.documents)) setDocuments(d.documents); }).catch(() => { });
    });
  }, [entityId, loadConversations]);

  const loadMessages = useCallback(async (conversationId: string) => {
    try {
      const res = await fetch(`/api/messaging/conversations/${conversationId}/messages`);
      const data = await res.json();
      setMessages(Array.isArray(data.messages) ? data.messages : (data ?? []));
      fetch(`/api/messaging/conversations/${conversationId}/read`, { method: "POST" })
        .then(() => loadConversations())
        .catch(() => { });
    } catch {
      setMessages([]);
    }
  }, [loadConversations]);

  useEffect(() => {
    if (!activeId) return;
    Promise.resolve().then(() => loadMessages(activeId));
  }, [activeId, loadMessages]);

  // Live delivery on the thread's real Ably channel.
  useAblyChannel<Message>(activeId ? `conversation-${activeId}` : null, "message", (data) => {
    setMessages((prev) => (prev.some((m) => m.id === data.id) ? prev : [...prev, data]));
    loadConversations();
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return conversations.filter((c) => {
      if (c.archivedAt) return false;
      if (filter === "unread" && c.unreadCount === 0) return false;
      if (filter === "people" && c.type === "system") return false;
      if (filter === "system" && c.type !== "system") return false;
      if (!q) return true;
      return [titleOf(c), c.lastMessagePreview ?? "", c.linkedRecordCode ?? ""]
        .some((v) => v.toLowerCase().includes(q));
    });
  }, [conversations, filter, query]);

  const active = conversations.find((c) => c.id === activeId) ?? null;
  const unreadTotal = conversations.filter((c) => !c.archivedAt).reduce((sum, c) => sum + c.unreadCount, 0);
  const unreadCount = conversations.filter((c) => !c.archivedAt && c.unreadCount > 0).length;
  const userInfo = (id: string) => users.find((u) => u.id === id);

  // ── Actions ────────────────────────────────────────────────────────────────
  const send = async (text: string) => {
    const content = text.trim();
    if (!content || !activeId || sending) return;
    setSending(true);
    setDraft("");
    try {
      const res = await fetch(`/api/messaging/conversations/${activeId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed to send");
      if (data.message) {
        setMessages((prev) => (prev.some((m) => m.id === data.message.id) ? prev : [...prev, data.message]));
      }
      loadConversations();
    } catch (err) {
      setDraft(content);
      pushToast({ tone: "error", title: "Message not sent", body: err instanceof Error ? err.message : "Try again." });
    } finally {
      setSending(false);
    }
  };

  const startDm = async (otherUserId: string) => {
    try {
      const res = await fetch("/api/messaging/conversations/dm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityId, otherUserId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed to start conversation");
      setComposeOpen(false);
      await loadConversations();
      const id = data.conversation?.id ?? data.id;
      if (id) { setActiveId(id); setMobileThread(true); }
    } catch (err) {
      pushToast({ tone: "error", title: "Couldn't start conversation", body: err instanceof Error ? err.message : "Try again." });
    }
  };

  const archive = async () => {
    if (!active) return;
    try {
      await fetch(`/api/messaging/conversations/${active.id}/archive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: true }),
      });
      pushToast({ tone: "success", title: "Conversation archived", body: `"${titleOf(active)}" is hidden from your inbox.` });
      setActiveId(null);
      setMobileThread(false);
      loadConversations();
    } catch {
      pushToast({ tone: "warning", title: "Couldn't archive", body: "Try again." });
    }
  };

  const category = active ? categoryFor(active) : null;
  const href = active ? recordHref(active.linkedRecordType, active.linkedRecordId) : null;
  const otherOnline = active?.otherParticipant ? presentIds.has(active.otherParticipant.id) : false;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3 px-1">
        <span className="label-caps text-slate-400">Messages</span>
        <span className="text-xs text-slate-400">
          <span className="font-mono font-medium text-slate-500">{unreadTotal}</span> unread ·{" "}
          <span className="font-mono font-medium text-slate-500">{conversations.filter((c) => !c.archivedAt).length}</span> conversations
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] bg-white border border-slate-100 rounded-3xl shadow-[0_8px_30px_rgba(0,0,0,0.04)] overflow-hidden min-h-[600px]">
        {/* ── Inbox pane ── */}
        <aside className={cn("border-r border-slate-100 flex flex-col min-h-0", mobileThread && "hidden lg:flex")}>
          <div className="p-4 flex flex-col gap-3 border-b border-slate-100">
            <div className="flex items-center justify-between gap-2">
              <p className="text-base font-medium text-slate-900">
                Inbox <span className="font-mono font-medium text-xs text-slate-400">{visible.length}</span>
              </p>
              <button
                onClick={() => setComposeOpen((v) => !v)}
                aria-label="New conversation"
                className="size-8 rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-800 flex items-center justify-center transition-colors"
              >
                <IconPencilPlus size={16} />
              </button>
            </div>

            <div className="relative">
              <IconSearch size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search messages…"
                className="w-full box-border bg-slate-50 border border-slate-100 rounded-xl pl-9 pr-3 py-2.5 text-sm text-slate-800 outline-none focus:bg-white focus:border-[#151936]/30 transition-colors"
              />
            </div>

            <div className="flex gap-1.5 flex-wrap">
              {([
                { key: "all", label: "All", count: 0 },
                { key: "unread", label: "Unread", count: unreadCount },
                { key: "people", label: "People", count: 0 },
                { key: "system", label: "System", count: 0 },
              ] as Array<{ key: Filter; label: string; count: number }>).map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  aria-pressed={filter === f.key}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border transition-colors",
                    filter === f.key
                      ? "bg-[#151936] text-white border-[#151936]"
                      : "bg-white text-slate-500 border-slate-200 hover:border-slate-300",
                  )}
                >
                  {f.label}
                  {f.count > 0 && (
                    <span className={cn(
                      "font-mono font-medium text-xxs rounded-full px-1.5",
                      filter === f.key ? "bg-[#f3df27] text-[#151936]" : "bg-slate-100 text-slate-500",
                    )}>{f.count}</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Compose - real DM against the identity directory */}
          <AnimatePresence>
            {composeOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="border-b border-slate-100 overflow-hidden"
              >
                <div className="p-3 flex flex-col gap-1 max-h-56 overflow-y-auto">
                  <p className="label-caps text-slate-400 px-1 pb-1">Start a conversation</p>
                  {users.filter((u) => u.id !== currentUserId).map((u) => (
                    <button
                      key={u.id}
                      onClick={() => startDm(u.id)}
                      className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-slate-50 text-left transition-colors"
                    >
                      <Avatar src={u.avatarUrl ?? undefined} fallback={initialsOf(u.name)} className="size-8 rounded-lg" />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-slate-900 truncate">{u.name}</span>
                        <span className="block text-xs text-slate-400 capitalize truncate">{u.role.replace(/_/g, " ")}</span>
                      </span>
                    </button>
                  ))}
                  {users.length <= 1 && <p className="text-xs text-slate-400 px-1 py-2">No one else to message yet.</p>}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex-1 overflow-y-auto p-2 min-h-0">
            {loading ? (
              <div className="flex flex-col gap-2 p-1">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex gap-3 p-2">
                    <SkeletonBlock className="size-10 rounded-xl shrink-0" />
                    <div className="flex-1 flex flex-col gap-2">
                      <SkeletonBlock className="h-3.5 w-1/2" />
                      <SkeletonBlock className="h-3 w-4/5" />
                    </div>
                  </div>
                ))}
              </div>
            ) : visible.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  icon={IconMessageCircle}
                  title={query ? "No conversations match" : "No conversations yet"}
                  description={query ? "Try a different search term." : "Start one with a colleague from the directory."}
                  action={query ? "Clear search" : "New conversation"}
                  onClick={() => (query ? setQuery("") : setComposeOpen(true))}
                />
              </div>
            ) : (
              visible.map((c) => {
                const meta = categoryFor(c);
                const isActive = c.id === activeId;
                const mine = c.lastMessageSenderId && c.lastMessageSenderId === currentUserId;
                const TileIcon = meta?.icon ?? IconMessageCircle;
                const online = c.otherParticipant ? presentIds.has(c.otherParticipant.id) : false;
                return (
                  <button
                    key={c.id}
                    onClick={() => { setActiveId(c.id); setMobileThread(true); }}
                    className={cn(
                      "w-full text-left flex gap-3 p-3 rounded-2xl transition-colors mb-0.5",
                      isActive ? "bg-[#faf8ee]" : "hover:bg-slate-50",
                    )}
                  >
                    <span className="relative shrink-0">
                      {c.type === "system" || !c.otherParticipant ? (
                        <span className={cn("size-10 rounded-xl flex items-center justify-center", meta?.tile ?? "bg-slate-100 text-slate-500")}>
                          <TileIcon size={18} />
                        </span>
                      ) : (
                        <Avatar src={c.otherParticipant.avatarUrl ?? undefined} fallback={initialsOf(c.otherParticipant.name)} className="size-10 rounded-xl" />
                      )}
                      {online && <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full bg-emerald-500 border-2 border-white" />}
                    </span>

                    <span className="flex-1 min-w-0">
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-slate-900 truncate">{titleOf(c)}</span>
                        <span className="font-mono text-xxs text-slate-400 shrink-0">{shortTime(c.lastMessageAt)}</span>
                      </span>
                      <span className="block text-xs text-slate-400 truncate mt-0.5">
                        {mine && <span className="text-slate-500">You: </span>}
                        {c.lastMessagePreview ?? "No messages yet"}
                      </span>
                      <span className="flex items-center gap-2 mt-1.5">
                        {meta && (
                          <span className={cn("inline-flex items-center rounded-md px-1.5 py-0.5 text-xxs font-medium", meta.chip)}>
                            {meta.label}
                          </span>
                        )}
                        {c.linkedRecordCode && (
                          <span className="font-mono text-xxs text-slate-400">{c.linkedRecordCode}</span>
                        )}
                        {c.unreadCount > 0 && (
                          <span className="ml-auto size-2 rounded-full bg-[#f3df27] shrink-0" />
                        )}
                      </span>
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* ── Thread pane ── */}
        <section className={cn("flex flex-col min-h-0", !mobileThread && "hidden lg:flex")}>
          {!active ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 p-8 text-center">
              <span className="size-12 rounded-2xl bg-slate-50 text-slate-300 flex items-center justify-center">
                <IconMessageCircle size={24} />
              </span>
              <p className="text-base font-medium text-slate-800">Select a conversation</p>
              <p className="text-sm text-slate-400">Pick a thread on the left to read and reply.</p>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-3">
                <button
                  onClick={() => setMobileThread(false)}
                  aria-label="Back to inbox"
                  className="lg:hidden size-9 rounded-xl border border-slate-200 text-slate-500 flex items-center justify-center shrink-0"
                >
                  <IconArrowLeft size={16} />
                </button>

                {active.type === "system" || !active.otherParticipant ? (
                  <span className={cn("size-10 rounded-xl flex items-center justify-center shrink-0", category?.tile ?? "bg-slate-100 text-slate-500")}>
                    {(() => { const I = category?.icon ?? IconMessageCircle; return <I size={19} />; })()}
                  </span>
                ) : (
                  <Avatar src={active.otherParticipant.avatarUrl ?? undefined} fallback={initialsOf(active.otherParticipant.name)} className="size-10 rounded-xl shrink-0" />
                )}

                <div className="flex-1 min-w-0">
                  <p className="text-base font-medium text-slate-900 truncate">{titleOf(active)}</p>
                  <p className="flex items-center gap-1.5 text-xs text-slate-400 truncate">
                    {active.otherParticipant && (
                      <span className={cn("size-1.5 rounded-full shrink-0", otherOnline ? "bg-emerald-500" : "bg-slate-300")} />
                    )}
                    <span className="truncate capitalize">
                      {active.otherParticipant
                        ? (active.otherParticipant.title || active.otherParticipant.role.replace(/_/g, " "))
                        : (active.description ?? "Automated feed")}
                    </span>
                  </p>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Honest: a device dial link off the real phone column, not a telephony stack. */}
                  {active.otherParticipant?.phone && (
                    <a
                      href={`tel:${active.otherParticipant.phone}`}
                      aria-label={`Call ${active.otherParticipant.name}`}
                      className="size-9 rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 flex items-center justify-center transition-colors"
                    >
                      <IconPhone size={16} />
                    </a>
                  )}
                  <button
                    onClick={archive}
                    aria-label="Archive conversation"
                    className="size-9 rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 flex items-center justify-center transition-colors"
                  >
                    <IconArchive size={16} />
                  </button>
                </div>
              </div>

              {/* Linked-record strip */}
              {active.linkedRecordCode && (
                <div className="px-5 py-2.5 border-b border-slate-100 bg-[#fcfcfa] flex items-center gap-3 flex-wrap">
                  <span className={cn("size-8 rounded-lg flex items-center justify-center shrink-0", category?.tile ?? "bg-slate-100 text-slate-500")}>
                    <IconLink size={15} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-xxs text-slate-400">{active.linkedRecordCode}</p>
                    <p className="text-sm text-slate-800 truncate">{active.description ?? titleOf(active)}</p>
                  </div>
                  {category && (
                    <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xxs font-medium uppercase tracking-wide", category.chip)}>
                      {category.label}
                    </span>
                  )}
                  {href && (
                    <Link
                      href={href}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      <IconArrowUpRight size={14} /> Open record
                    </Link>
                  )}
                </div>
              )}

              {/* Messages */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 min-h-0">
                {messages.length === 0 ? (
                  <p className="text-center text-sm text-slate-400 py-10">No messages in this thread yet.</p>
                ) : (
                  messages.map((m, i) => {
                    const isMe = m.senderId === currentUserId;
                    const prev = messages[i - 1];
                    const newDay = !prev || new Date(prev.createdAt).toDateString() !== new Date(m.createdAt).toDateString();
                    const sender = userInfo(m.senderId);
                    return (
                      <div key={m.id}>
                        {newDay && (
                          <div className="flex justify-center my-4">
                            <span className="text-xxs font-medium uppercase tracking-wide bg-slate-100 text-slate-500 rounded-full px-3 py-1">
                              {dayLabel(m.createdAt)}
                            </span>
                          </div>
                        )}
                        {m.type === "system" ? (
                          <div className="flex justify-center my-2">
                            <span className="text-xs text-slate-500 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 max-w-[80%] text-center">
                              {m.content}
                            </span>
                          </div>
                        ) : (
                          <motion.div
                            layout="position"
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ type: "spring", damping: 26, stiffness: 440 }}
                            className={cn("flex flex-col mb-3", isMe ? "items-end" : "items-start")}
                          >
                            {!isMe && sender && (
                              <span className="text-xs text-slate-400 mb-1 ml-1">{sender.name}</span>
                            )}
                            <div className={cn(
                              "max-w-[78%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                              isMe ? "bg-[#151936] text-white" : "bg-slate-50 border border-slate-100 text-slate-800",
                            )}>
                              {m.content}
                            </div>
                            <span className="font-mono text-xxs text-slate-400 mt-1 mx-1">{clockTime(m.createdAt)}</span>
                          </motion.div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Quick replies */}
              <div className="px-5 pt-3 flex gap-2 flex-wrap">
                {quickRepliesFor(active.linkedRecordType).map((q) => (
                  <button
                    key={q}
                    onClick={() => send(q)}
                    disabled={sending}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
                  >
                    <IconSparkles size={13} className="text-[#c9b81f]" /> {q}
                  </button>
                ))}
              </div>

              {/* Composer */}
              <div className="p-4 flex items-end gap-2.5 relative">
                <div className="relative shrink-0">
                  <button
                    onClick={() => setAttachOpen((v) => !v)}
                    aria-label="Attach a document"
                    className="size-11 rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 flex items-center justify-center transition-colors"
                  >
                    <IconPaperclip size={17} />
                  </button>
                  {attachOpen && (
                    <div className="absolute bottom-full left-0 mb-2 w-64 max-h-56 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-[0_16px_40px_rgba(0,0,0,0.12)] p-2 z-10">
                      <div className="flex items-center justify-between px-1 pb-1">
                        <p className="label-caps text-slate-400">Reference a document</p>
                        <button onClick={() => setAttachOpen(false)} aria-label="Close" className="text-slate-400 hover:text-slate-700"><IconX size={14} /></button>
                      </div>
                      {documents.length === 0 ? (
                        <p className="text-xs text-slate-400 px-1 py-2">No documents on this entity yet.</p>
                      ) : documents.slice(0, 25).map((d) => {
                        const label = d.title || d.fileName || d.type || "Document";
                        return (
                          <button
                            key={d.id}
                            onClick={() => { setDraft((v) => `${v}${v ? " " : ""}[${label}]`); setAttachOpen(false); }}
                            className="w-full text-left flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 text-sm text-slate-700 transition-colors"
                          >
                            <IconFileText size={14} className="text-slate-400 shrink-0" />
                            <span className="truncate">{label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(draft); }
                  }}
                  rows={1}
                  placeholder="Write a message…"
                  className="flex-1 box-border resize-none bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 outline-none focus:border-[#151936]/40 transition-colors max-h-32"
                />

                <button
                  onClick={() => send(draft)}
                  disabled={sending || !draft.trim()}
                  aria-label="Send message"
                  className="size-11 rounded-xl bg-[#151936] text-white flex items-center justify-center shrink-0 hover:opacity-90 disabled:opacity-40 transition-opacity"
                >
                  <IconSend size={17} />
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
