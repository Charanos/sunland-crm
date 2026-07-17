"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  IconSend,
  IconSearch,
  IconHash,
  IconCheck,
  IconPlus,
  IconMessageCircle,
  IconArrowLeft,
  IconX,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils/cn";
import { Avatar } from "@/components/ui/avatar";
import { useUIStore } from "@/store/ui";
import { useToast } from "@/components/ui/toast-provider";
import { useAblyChannel } from "@/hooks/use-ably-channel";

// ── Types ──────────────────────────────────────────────────────────────────────
// Matches the real /api/messaging/* response shapes (conversations/messages
// tables) - no attachments, calling, typing-broadcast, or per-conversation
// mute exist in the schema, so this page doesn't pretend they work.

interface Conversation {
  id: string;
  type: "dm" | "channel";
  name: string | null;
  description: string | null;
  otherParticipant: { id: string; name: string; email: string; role: string } | null;
  unreadCount: number;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
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

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatMessageTime(isoStr: string): string {
  return new Date(isoStr).toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" });
}

function isSameDay(a: string, b: string): boolean {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

function formatDayLabel(isoStr: string): string {
  const d = new Date(isoStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-KE", { weekday: "long", month: "short", day: "numeric" });
}

function initials(name: string): string {
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2);
}

// ── Message Bubble ─────────────────────────────────────────────────────────────

function MessageBubble({
  msg,
  isMe,
  sender,
  showAvatar,
  showTimestamp,
}: {
  msg: Message;
  isMe: boolean;
  sender: UserOption | undefined;
  showAvatar: boolean;
  showTimestamp: boolean;
}) {
  if (msg.type === "system") {
    return (
      <div className="flex justify-center my-4">
        <span className="text-meta-muted bg-slate-100 rounded-full px-3 py-1 font-medium shadow-[0_1px_2px_rgba(0,0,0,0.01)]">
          {msg.content}
        </span>
      </div>
    );
  }

  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", damping: 25, stiffness: 450 }}
      className={cn(
        "flex items-end gap-2.5 transition-all duration-200 ease-out",
        isMe ? "flex-row-reverse" : "flex-row",
        showAvatar ? "mt-3" : "mt-0.5"
      )}
    >
      <div className="size-7 shrink-0 self-end">
        {!isMe && showAvatar && (
          <Avatar
            src={sender?.avatarUrl ?? undefined}
            fallback={initials(sender?.name ?? "?")}
            className="size-7 shadow-xs border border-slate-100"
          />
        )}
      </div>

      <div className={cn("flex flex-col gap-0.5 max-w-[68%]", isMe ? "items-end" : "items-start")}>
        {showAvatar && !isMe && (
          <span className="text-meta-muted-strong ml-1 font-medium">{sender?.name ?? "Unknown"}</span>
        )}

        <div
          className={cn(
            "px-4 py-2 rounded-2xl text-body-primary leading-relaxed",
            isMe
              ? "bg-[#151936] text-white rounded-br-sm shadow-[0_2px_8px_rgba(21,25,54,0.1)] font-normal"
              : "bg-white border border-slate-100 text-slate-800 rounded-bl-sm shadow-[0_1px_3px_rgba(0,0,0,0.01)] font-normal"
          )}
        >
          {msg.content}
        </div>

        {showTimestamp && (
          <div className={cn("flex items-center gap-1 px-1", isMe ? "flex-row-reverse" : "flex-row")}>
            <span className="font-mono text-meta-muted font-medium">{formatMessageTime(msg.createdAt)}</span>
            {isMe && <IconCheck size={11} className="text-slate-350" />}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ── Conversation List Item ─────────────────────────────────────────────────────

function ConversationItem({ convo, active, onClick }: { convo: Conversation; active: boolean; onClick: () => void }) {
  const isChannel = convo.type === "channel";
  const label = isChannel ? convo.name ?? "channel" : convo.otherParticipant?.name ?? "Unknown";

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex w-full items-center gap-3 px-3.5 py-2.5 rounded-xl text-left transition-all duration-200 overflow-hidden border border-transparent",
        active
          ? "bg-white shadow-[0_4px_12px_rgba(0,0,0,0.03)] border-slate-200/60"
          : "hover:bg-white/60 hover:shadow-[0_2px_8px_rgba(0,0,0,0.01)] hover:border-slate-100"
      )}
    >
      {active && <div className="absolute left-0 top-1/2 -translate-y-1/2 h-8 w-[3px] rounded-r-full bg-[#151936]" />}

      {isChannel ? (
        <div
          className={cn(
            "size-9 shrink-0 rounded-xl flex items-center justify-center transition-all duration-200 border",
            active ? "bg-[#151936] text-[#f3df27] border-[#151936] shadow-xs" : "bg-slate-100 text-slate-400 border-slate-150"
          )}
        >
          <IconHash size={15} />
        </div>
      ) : (
        <div className="relative shrink-0">
          <Avatar src={undefined} fallback={initials(label)} className="size-10 shadow-xs border border-slate-100" />
        </div>
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1 mb-0.5">
          <p className={cn("text-title-primary truncate font-medium transition-colors", convo.unreadCount > 0 || active ? "text-slate-900" : "text-slate-700")}>
            {isChannel ? `#${label}` : label}
          </p>
          {convo.lastMessageAt && <span className="font-mono text-meta-muted font-medium shrink-0">{formatMessageTime(convo.lastMessageAt)}</span>}
        </div>
        <p className={cn("text-meta-muted truncate font-normal", convo.unreadCount > 0 ? "text-desc-secondary font-medium" : "text-meta-muted")}>
          {convo.lastMessagePreview ?? "No messages yet"}
        </p>
      </div>

      {convo.unreadCount > 0 && (
        <span className="shrink-0 flex size-4 items-center justify-center rounded-full bg-[#151936] text-xxs font-mono text-white font-medium">
          {convo.unreadCount}
        </span>
      )}
    </button>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function MessagesPageContent({ entityId = "group" }: { entityId?: string }) {
  const { selectedChatDMId, setSelectedChatDMId } = useUIStore();
  const { pushToast } = useToast();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isLoadingConvos, setIsLoadingConvos] = useState(true);

  const [mode, setMode] = useState<"dm" | "channel">("dm");
  const [activeId, setActiveId] = useState<string | null>(selectedChatDMId);
  const [searchQuery, setSearchQuery] = useState("");
  const [messageText, setMessageText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [mobileShowChat, setMobileShowChat] = useState(false);

  const [newChatModal, setNewChatModal] = useState<"dm" | "channel" | null>(null);
  const [newDmTargetId, setNewDmTargetId] = useState("");
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelDesc, setNewChannelDesc] = useState("");
  const [newChannelParticipants, setNewChannelParticipants] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const userInfo = useCallback((id: string) => users.find((u) => u.id === id), [users]);

  const loadConversations = useCallback(async () => {
    setIsLoadingConvos(true);
    try {
      const res = await fetch("/api/messaging/conversations");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load conversations");
      setConversations(data.conversations ?? []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load conversations";
      pushToast({ tone: "error", title: "Error", body: message });
    } finally {
      setIsLoadingConvos(false);
    }
  }, [pushToast]);

  useEffect(() => {
    Promise.resolve().then(() => {
      fetch("/api/auth/me").then((r) => r.json()).then((d) => { if (d?.user) setCurrentUserId(d.user.id); }).catch(() => { });
      fetch(`/api/identity/users?entityId=${entityId}`).then((r) => r.json()).then((d) => { if (Array.isArray(d.users)) setUsers(d.users); }).catch(() => { });
      loadConversations();
    });
  }, [loadConversations, entityId]);

  // Sync selected DM from the sidebar's quick-chat / global widget hand-off.
  useEffect(() => {
    if (selectedChatDMId) {
      Promise.resolve().then(() => {
        setActiveId(selectedChatDMId);
        setMobileShowChat(true);
      });
    }
  }, [selectedChatDMId]);

  const activeConvo = useMemo(() => conversations.find((c) => c.id === activeId) ?? null, [conversations, activeId]);

  useEffect(() => {
    if (activeConvo) Promise.resolve().then(() => setMode(activeConvo.type));
  }, [activeConvo]);

  const loadMessages = useCallback(async (conversationId: string) => {
    try {
      const res = await fetch(`/api/messaging/conversations/${conversationId}/messages`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load messages");
      setMessages(data.messages ?? []);
      fetch(`/api/messaging/conversations/${conversationId}/read`, { method: "POST" }).then(() => loadConversations()).catch(() => { });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load messages";
      pushToast({ tone: "error", title: "Error", body: message });
    }
  }, [pushToast, loadConversations]);

  useEffect(() => {
    if (!activeId) {
      Promise.resolve().then(() => setMessages([]));
      return;
    }
    Promise.resolve().then(() => loadMessages(activeId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  useAblyChannel<Message>(activeId ? `conversation-${activeId}` : null, "message", (data) => {
    setMessages((prev) => (prev.some((m) => m.id === data.id) ? prev : [...prev, data]));
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const filteredConversations = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return conversations
      .filter((c) => c.type === mode)
      .filter((c) => {
        if (!q) return true;
        const label = c.type === "channel" ? c.name ?? "" : c.otherParticipant?.name ?? "";
        return label.toLowerCase().includes(q) || (c.lastMessagePreview ?? "").toLowerCase().includes(q);
      });
  }, [conversations, mode, searchQuery]);

  const dmUnread = useMemo(() => conversations.filter((c) => c.type === "dm").reduce((s, c) => s + c.unreadCount, 0), [conversations]);
  const channelUnread = useMemo(() => conversations.filter((c) => c.type === "channel").reduce((s, c) => s + c.unreadCount, 0), [conversations]);

  const handleSend = async () => {
    const content = messageText.trim();
    if (!content || !activeId || isSending) return;
    setMessageText("");
    setIsSending(true);
    try {
      const res = await fetch(`/api/messaging/conversations/${activeId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send message");
      setMessages((prev) => (prev.some((m) => m.id === data.message.id) ? prev : [...prev, data.message]));
      loadConversations();
      setTimeout(() => inputRef.current?.focus(), 0);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to send message";
      pushToast({ tone: "error", title: "Error", body: message });
      setMessageText(content);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const groupedMessages = useMemo(() => {
    return messages.map((msg, idx) => {
      const prev = messages[idx - 1];
      const next = messages[idx + 1];
      const showAvatar = !prev || prev.senderId !== msg.senderId;
      const showTimestamp = !next || next.senderId !== msg.senderId;
      const showDayLabel = !prev || !isSameDay(prev.createdAt, msg.createdAt);
      return { msg, showAvatar, showTimestamp, showDayLabel };
    });
  }, [messages]);

  const handleCreateChat = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    try {
      if (newChatModal === "dm") {
        if (!newDmTargetId) return;
        const res = await fetch("/api/messaging/conversations/dm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ entityId, otherUserId: newDmTargetId }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to start conversation");
        await loadConversations();
        setActiveId(data.conversation.id);
        setMode("dm");
        setMobileShowChat(true);
        setNewChatModal(null);
        setNewDmTargetId("");
      } else {
        if (!newChannelName.trim()) return;
        const res = await fetch("/api/messaging/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            entityId,
            name: newChannelName.trim().toLowerCase().replace(/\s+/g, "-"),
            description: newChannelDesc.trim() || undefined,
            participantUserIds: newChannelParticipants,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to create channel");
        await loadConversations();
        setActiveId(data.conversation.id);
        setMode("channel");
        setMobileShowChat(true);
        setNewChatModal(null);
        setNewChannelName("");
        setNewChannelDesc("");
        setNewChannelParticipants([]);
        pushToast({ tone: "success", title: "Channel Created", body: `#${data.conversation.name} is ready.` });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create conversation";
      pushToast({ tone: "error", title: "Error", body: message });
    } finally {
      setIsCreating(false);
    }
  };

  const dmCandidates = users.filter((u) => u.id !== currentUserId);
  const activeName = activeConvo ? (activeConvo.type === "channel" ? activeConvo.name : activeConvo.otherParticipant?.name) : null;

  return (
    <div className="mx-auto max-w-[98rem] w-full px-4 md:px-6 animate-fade-in relative">
      <div className="flex h-[calc(100vh-140px)] min-h-[550px] rounded-2xl bg-white shadow-[0_4px_24px_rgba(0,0,0,0.04)] overflow-hidden">

        {/* ── Left Sidebar (List View) ── */}
        <aside
          className={cn(
            "w-full md:w-80 shrink-0 flex flex-col bg-slate-50/15 transition-all duration-300 shadow-[inset_-1px_0_0_rgba(0,0,0,0.03)]",
            mobileShowChat ? "hidden md:flex" : "flex"
          )}
        >
          <div className="px-4 pt-4 pb-2 flex items-center gap-2">
            <div className="relative flex-1 flex items-center bg-slate-100/50 hover:bg-slate-100 focus-within:bg-white focus-within:ring-2 focus-within:ring-[#151936]/5 rounded-xl transition-all">
              <IconSearch size={14} className="absolute left-3.5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-9 bg-transparent pl-10 pr-9 text-caption text-slate-800 placeholder:text-slate-400 focus:outline-none transition-all font-normal"
              />
              {searchQuery && (
                <button type="button" onClick={() => setSearchQuery("")} className="absolute right-3 p-0.5 rounded-full text-slate-400 hover:text-slate-650 transition-colors" aria-label="Clear search">
                  <IconX size={13} />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => setNewChatModal(mode)}
              aria-label={mode === "dm" ? "New direct message" : "Create new channel"}
              className="size-9 shrink-0 rounded-xl bg-slate-100 hover:bg-slate-200/80 flex items-center justify-center text-slate-600 transition-colors"
            >
              <IconPlus size={16} />
            </button>
          </div>

          <div className="flex items-center gap-4 px-4 py-4 border-b border-slate-100">
            <button
              type="button"
              onClick={() => setMode("dm")}
              className={cn("px-3 py-1 text-caption rounded-lg transition-all duration-200 font-medium relative", mode === "dm" ? "bg-[#151936] text-white shadow-xs" : "text-slate-400 hover:text-slate-800")}
            >
              Direct
              {dmUnread > 0 && <span className="ml-1.5 px-1.5 py-0.5 text-tiny font-mono rounded-full bg-[#f3df27] text-[#151936] font-medium">{dmUnread}</span>}
            </button>
            <button
              type="button"
              onClick={() => setMode("channel")}
              className={cn("px-3 py-1 text-caption rounded-lg transition-all duration-200 font-medium relative", mode === "channel" ? "bg-[#151936] text-white shadow-xs" : "text-slate-400 hover:text-slate-800")}
            >
              Channels
              {channelUnread > 0 && <span className="ml-1.5 px-1.5 py-0.5 text-tiny font-mono rounded-full bg-[#f3df27] text-[#151936] font-medium">{channelUnread}</span>}
            </button>
          </div>

          <motion.div layout className="flex-1 overflow-y-auto p-2.5 space-y-0.5 [scrollbar-width:thin]">
            {isLoadingConvos ? (
              <div className="flex items-center justify-center py-12">
                <div className="size-5 rounded-full border-2 border-slate-300 border-t-slate-600 animate-spin" />
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center select-none">
                <div className="size-10 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
                  {mode === "dm" ? <IconMessageCircle size={18} className="text-slate-350" /> : <IconHash size={18} className="text-slate-355" />}
                </div>
                <p className="text-caption text-slate-400 font-medium">{mode === "dm" ? "No chats found" : "No channels found"}</p>
              </div>
            ) : (
              filteredConversations.map((convo) => (
                <motion.div key={convo.id} layout="position">
                  <ConversationItem
                    convo={convo}
                    active={activeId === convo.id}
                    onClick={() => {
                      setActiveId(convo.id);
                      setSelectedChatDMId(convo.id, false);
                      setMobileShowChat(true);
                    }}
                  />
                </motion.div>
              ))
            )}
          </motion.div>
        </aside>

        {/* ── Right Chat Area ── */}
        <div className={cn("flex flex-1 flex-col min-w-0 bg-white transition-all duration-300", mobileShowChat ? "flex" : "hidden md:flex")}>
          {!activeConvo ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center select-none">
              <div className="size-16 rounded-2xl bg-white border border-slate-100 flex items-center justify-center mb-4 shadow-xs">
                <IconMessageCircle size={28} className="text-slate-200" />
              </div>
              <p className="text-body-primary font-medium">Select a conversation</p>
              <p className="text-meta-muted mt-1 font-medium">Or start a new one from the sidebar.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between px-6 py-4 bg-white shrink-0 relative z-10 shadow-[0_1px_0_rgba(0,0,0,0.01)]">
                <div className="flex items-center gap-3.5 min-w-0">
                  <button type="button" onClick={() => setMobileShowChat(false)} className="md:hidden p-1.5 -ml-1 rounded-xl hover:bg-slate-100 text-slate-400 transition-colors" aria-label="Back to messages list">
                    <IconArrowLeft size={18} />
                  </button>

                  {activeConvo.type === "dm" ? (
                    <>
                      <Avatar src={undefined} fallback={initials(activeName ?? "?")} className="size-10 shadow-xs border border-slate-100" />
                      <div className="min-w-0">
                        <p className="text-title-primary leading-tight font-medium truncate">{activeName}</p>
                        <p className="text-meta-muted font-medium truncate mt-0.5">{activeConvo.otherParticipant?.role.replace("_", " ")}</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="size-10 rounded-xl bg-[#151936] flex items-center justify-center shadow-xs border border-[#151936]">
                        <IconHash size={18} className="text-[#f3df27]" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-title-primary leading-tight font-medium truncate">#{activeConvo.name}</p>
                        {activeConvo.description && <p className="text-meta-muted mt-0.5 font-medium truncate">{activeConvo.description}</p>}
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-5 bg-[#fcfcfc] [scrollbar-width:thin]">
                {groupedMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center select-none">
                    <div className="size-16 rounded-2xl bg-white border border-slate-100 flex items-center justify-center mb-4 shadow-xs">
                      <IconMessageCircle size={28} className="text-slate-200" />
                    </div>
                    <p className="text-body-primary font-medium">No messages yet</p>
                    <p className="text-meta-muted mt-1 font-medium">Send a message below to start the conversation.</p>
                  </div>
                ) : (
                  <motion.div layout="position">
                    {groupedMessages.map(({ msg, showAvatar, showTimestamp, showDayLabel }) => (
                      <div key={msg.id}>
                        {showDayLabel && (
                          <div className="flex items-center gap-3 my-5 select-none">
                            <div className="flex-1 h-px bg-slate-100/50" />
                            <span className="text-meta-muted px-3 py-1 rounded-full bg-white border border-slate-100 font-medium shadow-[0_1px_2px_rgba(0,0,0,0.01)]">{formatDayLabel(msg.createdAt)}</span>
                            <div className="flex-1 h-px bg-slate-100/50" />
                          </div>
                        )}
                        <MessageBubble msg={msg} isMe={msg.senderId === currentUserId} sender={userInfo(msg.senderId)} showAvatar={showAvatar} showTimestamp={showTimestamp} />
                      </div>
                    ))}
                  </motion.div>
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="shrink-0 px-5 py-3.5 bg-white relative">
                <div className={cn("flex items-end gap-2.5 rounded-2xl px-4 py-2.5 bg-slate-100/50 hover:bg-slate-100/80", "focus-within:bg-white focus-within:ring-2 focus-within:ring-[#151936]/5 transition-all duration-200")}>
                  <textarea
                    ref={inputRef}
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={`Message ${activeConvo.type === "dm" ? activeName : "#" + activeConvo.name}…`}
                    rows={1}
                    className="flex-1 resize-none bg-transparent text-body-primary placeholder:text-slate-400 focus:outline-none max-h-32 pt-0.5 leading-relaxed font-normal"
                  />
                  <button
                    type="button"
                    onClick={handleSend}
                    disabled={!messageText.trim() || isSending}
                    aria-label="Send message"
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-xl transition-all duration-200",
                      messageText.trim() ? "bg-[#f3df27] text-[#151936] hover:bg-[#e6d220] shadow-xs" : "bg-slate-100 text-slate-350 cursor-not-allowed border border-slate-150"
                    )}
                  >
                    <IconSend size={15} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* ── New Chat/Channel Modal ── */}
        <AnimatePresence>
          {newChatModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-[999] flex items-center justify-center p-4"
            >
              <motion.div
                initial={{ scale: 0.95, y: 10, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                exit={{ scale: 0.95, y: 10, opacity: 0 }}
                transition={{ type: "spring", damping: 25, stiffness: 400 }}
                className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden border border-slate-100"
              >
                <div className="p-6 pb-4 flex items-center justify-between border-b border-slate-50">
                  <h3 className="text-heading-primary">{newChatModal === "dm" ? "New Direct Message" : "Create New Channel"}</h3>
                  <button type="button" onClick={() => setNewChatModal(null)} className="p-1 rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-700 transition-all" aria-label="Close modal">
                    <IconX size={16} />
                  </button>
                </div>

                <form onSubmit={handleCreateChat} className="p-6 space-y-4">
                  {newChatModal === "dm" ? (
                    <div>
                      <label className="block text-meta-muted-strong uppercase tracking-wide mb-1.5 font-medium">Select Member</label>
                      <select
                        value={newDmTargetId}
                        onChange={(e) => setNewDmTargetId(e.target.value)}
                        className="w-full h-10 px-3.5 rounded-xl border border-slate-200 bg-slate-50/50 text-body-primary focus:outline-none focus:border-[#151936] focus:bg-white transition-all font-medium"
                        required
                      >
                        <option value="">Choose a team member...</option>
                        {dmCandidates.map((c) => (
                          <option key={c.id} value={c.id}>{c.name} · {c.role.replace("_", " ")}</option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <>
                      <div>
                        <label className="block text-meta-muted-strong uppercase tracking-wide mb-1.5 font-medium">Channel Name</label>
                        <input
                          type="text"
                          placeholder="e.g. ops-strategy"
                          value={newChannelName}
                          onChange={(e) => setNewChannelName(e.target.value)}
                          className="w-full h-10 px-3.5 rounded-xl border border-slate-200 bg-slate-50/50 text-body-primary placeholder:text-slate-400 focus:outline-none focus:border-[#151936] focus:bg-white transition-all font-normal"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-meta-muted-strong uppercase tracking-wide mb-1.5 font-medium">Description</label>
                        <textarea
                          placeholder="What will this channel be used for?"
                          value={newChannelDesc}
                          onChange={(e) => setNewChannelDesc(e.target.value)}
                          rows={2}
                          className="w-full p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 text-body-primary placeholder:text-slate-400 focus:outline-none focus:border-[#151936] focus:bg-white transition-all resize-none font-normal"
                        />
                      </div>
                      <div>
                        <label className="block text-meta-muted-strong uppercase tracking-wide mb-1.5 font-medium">Members</label>
                        <select
                          multiple
                          value={newChannelParticipants}
                          onChange={(e) => setNewChannelParticipants(Array.from(e.target.selectedOptions, (o) => o.value))}
                          className="w-full h-24 px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50/50 text-body-primary focus:outline-none focus:border-[#151936] focus:bg-white transition-all font-medium"
                        >
                          {dmCandidates.map((c) => (
                            <option key={c.id} value={c.id}>{c.name} · {c.role.replace("_", " ")}</option>
                          ))}
                        </select>
                      </div>
                    </>
                  )}

                  <div className="flex justify-end gap-3 pt-4">
                    <button type="button" onClick={() => setNewChatModal(null)} className="h-10 px-4 rounded-xl border border-slate-200 text-desc-secondary hover:bg-slate-50 transition-all font-medium">
                      Cancel
                    </button>
                    <button type="submit" disabled={isCreating} className="h-10 px-5 rounded-xl bg-[#f3df27] text-[#151936] hover:bg-[#e6d220] transition-all font-medium shadow-xs disabled:opacity-50">
                      {isCreating ? "Creating…" : "Create"}
                    </button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
