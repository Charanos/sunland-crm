"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  IconMessageCircle,
  IconX,
  IconSend,
  IconSearch,
  IconHash,
  IconChecks
} from "@tabler/icons-react";
import { Avatar } from "@/components/ui/avatar";
import { useUIStore } from "@/store/ui";
import { cn } from "@/lib/utils/cn";
import { usePathname } from "next/navigation";
import { useAblyChannel } from "@/hooks/use-ably-channel";

const TABS = ["Direct", "Channels"];

interface Conversation {
  id: string;
  type: "dm" | "channel";
  name: string | null;
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
  createdAt: string;
}

interface UserOption {
  id: string;
  name: string;
  avatarUrl: string | null;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-KE", { hour: "numeric", minute: "2-digit" });
}

export function GlobalChatWidget({ entityId = "group" }: { entityId?: string }) {
  const pathname = usePathname();
  const isMessagesPage = pathname?.endsWith("/messages");

  const { chatOpen, toggleChat, closeChat, selectedChatDMId: activeChatId, setSelectedChatDMId: setActiveChatId } = useUIStore();
  const [activeTab, setActiveTab] = useState("Direct");
  const [inputText, setInputText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const fabRef = useRef<HTMLButtonElement>(null);

  const userInfo = useCallback((id: string) => users.find((u) => u.id === id), [users]);

  const loadConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/messaging/conversations");
      const data = await res.json();
      if (Array.isArray(data.conversations)) setConversations(data.conversations);
    } catch {
      // Widget stays empty rather than erroring loudly — Messages page is the source of truth.
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(() => {
      fetch("/api/auth/me").then((r) => r.json()).then((d) => { if (d?.user) setCurrentUserId(d.user.id); }).catch(() => {});
      fetch(`/api/identity/users?entityId=${entityId}`).then((r) => r.json()).then((d) => { if (Array.isArray(d.users)) setUsers(d.users); }).catch(() => {});
      loadConversations();
    });
  }, [loadConversations, entityId]);

  useEffect(() => {
    if (chatOpen) Promise.resolve().then(() => loadConversations());
  }, [chatOpen, loadConversations]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!chatOpen) return;
      if (
        panelRef.current &&
        !panelRef.current.contains(event.target as Node) &&
        fabRef.current &&
        !fabRef.current.contains(event.target as Node)
      ) {
        closeChat();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [chatOpen, closeChat]);

  // Load thread + mark read whenever the active conversation changes.
  useEffect(() => {
    if (!activeChatId) {
      Promise.resolve().then(() => setMessages([]));
      return;
    }
    fetch(`/api/messaging/conversations/${activeChatId}/messages`)
      .then((r) => r.json())
      .then((d) => setMessages(Array.isArray(d.messages) ? d.messages : []))
      .catch(() => {});
    fetch(`/api/messaging/conversations/${activeChatId}/read`, { method: "POST" }).catch(() => {});
  }, [activeChatId]);

  useAblyChannel<Message>(
    activeChatId ? `conversation-${activeChatId}` : null,
    "message",
    (data) => {
      setMessages((prev) => (prev.some((m) => m.id === data.id) ? prev : [...prev, data]));
    },
  );

  // Scroll to bottom on new messages / opening a chat
  useEffect(() => {
    if (activeChatId && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [activeChatId, chatOpen, messages.length]);

  const handleSend = async () => {
    if (!inputText.trim() || !activeChatId || isSending) return;
    const content = inputText.trim();
    setInputText("");
    setIsSending(true);
    try {
      const res = await fetch(`/api/messaging/conversations/${activeChatId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const data = await res.json();
      if (res.ok && data.message) {
        setMessages((prev) => (prev.some((m) => m.id === data.message.id) ? prev : [...prev, data.message]));
      }
    } catch {
      // Left in the input-cleared state — a full retry affordance isn't worth the space in this compact widget.
    } finally {
      setIsSending(false);
    }
  };

  const activeConvo = conversations.find((c) => c.id === activeChatId) ?? null;
  const activeName = activeConvo?.type === "channel" ? activeConvo.name : activeConvo?.otherParticipant?.name;
  const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0);
  const dms = conversations.filter((c) => c.type === "dm");
  const channels = conversations.filter((c) => c.type === "channel");

  const panelSpring = { type: "spring", stiffness: 350, damping: 30 } as const;

  if (isMessagesPage) return null;

  return (
    <>
      <AnimatePresence>
        {chatOpen && (
          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={panelSpring}
            className="fixed bottom-[100px] right-4 md:right-6 z-[100] w-[340px] md:w-[360px] h-[500px] md:h-[550px] bg-white rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.12)] border border-slate-200 overflow-hidden flex flex-col"
          >
            {/* ── Chat Header ── */}
            <div className="bg-[#151936] text-white p-4 flex items-center justify-between shrink-0">
              {activeChatId ? (
                <div className="flex items-center gap-3">
                  <button onClick={() => setActiveChatId(null)} className="text-white/70 hover:text-white transition-colors">
                    <IconX size={20} className="rotate-45" />
                  </button>
                  <div className="flex items-center gap-2">
                    <Avatar
                      src={activeConvo?.type === "dm" && activeConvo.otherParticipant ? userInfo(activeConvo.otherParticipant.id)?.avatarUrl ?? undefined : undefined}
                      fallback={(activeName ?? "?").slice(0, 1)}
                      className="size-8 border border-white/20"
                    />
                    <div>
                      <h4 className="font-medium leading-none mb-1 text-caption">{activeName ?? "Conversation"}</h4>
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <h3 className="font-medium tracking-tight text-caption">Internal Comms</h3>
                  <p className="text-tiny text-white/60">{totalUnread > 0 ? `${totalUnread} unread message${totalUnread === 1 ? "" : "s"}` : "All caught up"}</p>
                </div>
              )}

              <div className="flex items-center gap-2">
                {!activeChatId && (
                  <button className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"><IconSearch size={18} /></button>
                )}
                <button onClick={closeChat} className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors ml-1">
                  <IconX size={18} />
                </button>
              </div>
            </div>

            {/* ── Main View (List or Active Chat) ── */}
            {activeChatId ? (
              // ── Active Chat View ──
              <div className="flex-1 flex flex-col bg-slate-50 overflow-hidden">
                <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 custom-scrollbar">
                  {messages.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center text-slate-400 text-caption">No messages yet — say hello.</div>
                  ) : (
                    messages.map((msg) => {
                      const isMe = msg.senderId === currentUserId;
                      const sender = userInfo(msg.senderId);
                      return (
                        <div key={msg.id} className={cn("flex max-w-[85%]", isMe ? "self-end" : "self-start")}>
                          {!isMe && (
                            <Avatar src={sender?.avatarUrl ?? undefined} fallback={(sender?.name ?? "?").slice(0, 1)} className="size-6 mr-2 mt-auto shrink-0" />
                          )}
                          <div className={cn(
                            "p-2.5 rounded-2xl text-caption shadow-sm leading-relaxed",
                            isMe
                              ? "bg-[#151936] text-white rounded-br-sm"
                              : "bg-white border border-slate-100 text-slate-800 rounded-bl-sm"
                          )}>
                            {msg.content}
                            <div className={cn(
                              "flex items-center justify-end gap-1 mt-1 text-[10px] font-mono",
                              isMe ? "text-white/50" : "text-slate-400"
                            )}>
                              {formatTime(msg.createdAt)}
                              {isMe && <IconChecks size={12} className="text-[#f3df27]" />}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Message Input */}
                <div className="p-3 bg-white border-t border-slate-200 shrink-0">
                  <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl p-1.5 pr-2 focus-within:border-[#151936]/40 transition-colors">
                    <input
                      type="text"
                      placeholder="Type a message..."
                      className="flex-1 bg-transparent px-2 text-base text-slate-800 focus:outline-none placeholder:text-slate-400"
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && inputText.trim()) handleSend();
                      }}
                    />
                    <button
                      onClick={handleSend}
                      disabled={!inputText.trim() || isSending}
                      className={cn(
                        "size-8 rounded-lg flex items-center justify-center transition-colors",
                        inputText.trim() ? "bg-[#f3df27] text-[#151936]" : "bg-slate-200 text-slate-400"
                      )}
                    >
                      <IconSend size={16} className={inputText.trim() ? "translate-x-[-1px] translate-y-[1px]" : ""} />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              // ── Threads List View ──
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Tabs */}
                <div className="flex px-4 pt-3 border-b border-slate-100 shrink-0">
                  {TABS.map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={cn(
                        "px-4 py-2 text-caption font-medium border-b-2 transition-colors",
                        activeTab === tab
                          ? "border-[#151936] text-[#151936]"
                          : "border-transparent text-slate-500 hover:text-slate-800"
                      )}
                    >
                      {tab}
                    </button>
                  ))}
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                  {activeTab === "Direct" && (dms.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-slate-400 text-caption px-6 text-center">No direct messages yet — start one from the Messages page.</div>
                  ) : dms.map((dm) => {
                    const other = dm.otherParticipant;
                    const info = other ? userInfo(other.id) : undefined;
                    return (
                      <button
                        key={dm.id}
                        onClick={() => setActiveChatId(dm.id)}
                        className="w-full p-2.5 flex items-center gap-3 hover:bg-slate-50 rounded-xl transition-all hover:shadow-sm border border-transparent hover:border-slate-100 text-left group"
                      >
                        <Avatar src={info?.avatarUrl ?? undefined} fallback={(other?.name ?? "?").slice(0, 1)} className="size-10 border border-slate-100 shadow-sm shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-center mb-0.5">
                            <h4 className="font-medium text-slate-800 truncate group-hover:text-[#151936] text-caption">{other?.name ?? "Unknown"}</h4>
                            {dm.lastMessageAt && <span className="text-[10px] font-mono text-slate-400">{formatTime(dm.lastMessageAt)}</span>}
                          </div>
                          <p className="text-tiny text-slate-500 truncate pr-4">{dm.lastMessagePreview ?? "No messages yet"}</p>
                        </div>
                        {dm.unreadCount > 0 && (
                          <div className="shrink-0 size-[18px] rounded-full bg-[#f3df27] flex items-center justify-center text-[10px] font-medium text-[#151936]">
                            {dm.unreadCount}
                          </div>
                        )}
                      </button>
                    );
                  }))}

                  {activeTab === "Channels" && (channels.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-slate-400 text-caption px-6 text-center">No channels yet — create one from the Messages page.</div>
                  ) : channels.map((ch) => (
                    <button
                      key={ch.id}
                      onClick={() => setActiveChatId(ch.id)}
                      className="w-full p-2.5 flex items-center gap-3 hover:bg-slate-50 rounded-xl transition-all hover:shadow-sm border border-transparent hover:border-slate-100 text-left group"
                    >
                      <div className="size-10 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center shrink-0 border border-slate-200">
                        <IconHash size={18} stroke={2} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-slate-800 truncate group-hover:text-[#151936] text-caption">{ch.name}</h4>
                        <p className="text-tiny text-slate-500 truncate">{ch.lastMessagePreview ?? "No messages yet"}</p>
                      </div>
                      {ch.unreadCount > 0 && (
                        <div className="shrink-0 size-[18px] rounded-full bg-[#f3df27] flex items-center justify-center text-[10px] font-medium text-[#151936]">
                          {ch.unreadCount}
                        </div>
                      )}
                    </button>
                  )))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── FAB ── */}
      <motion.button
        ref={fabRef}
        onClick={toggleChat}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.94 }}
        className={cn(
          "fixed bottom-[90px] md:bottom-6 right-4 md:right-6 z-40 size-14 rounded-full bg-[#151936] text-white shadow-[0_8px_30px_rgba(21,25,54,0.3)] flex items-center justify-center border border-white/10 transition-[z-index]",
          chatOpen && "z-[101]"
        )}
      >
        <AnimatePresence mode="wait">
          {chatOpen ? (
            <motion.div
              key="close"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <IconX size={24} stroke={2} />
            </motion.div>
          ) : (
            <motion.div
              key="chat"
              initial={{ rotate: 90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -90, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <IconMessageCircle size={26} stroke={1.5} className="mt-[2px]" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Unread Badge */}
        {!chatOpen && totalUnread > 0 && (
          <div className="absolute top-0 right-0 size-4 bg-[#f3df27] rounded-full border-2 border-[#151936] flex items-center justify-center">
            <span className="text-sm font-medium text-[#151936]">{totalUnread > 9 ? "9+" : totalUnread}</span>
          </div>
        )}
      </motion.button>
    </>
  );
}
