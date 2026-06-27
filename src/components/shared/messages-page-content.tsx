"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import {
  IconSend,
  IconSearch,
  IconHash,
  IconAt,
  IconX,
  IconCheck,
  IconCheckFilled,
  IconDotsVertical,
  IconPaperclip,
  IconMoodSmile,
  IconPhone,
  IconVideo,
  IconPlus,
  IconMessageCircle,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils/cn";
import { Avatar } from "@/components/ui/avatar";
import { useUIStore } from "@/store/ui";
import { useToast } from "@/components/ui/toast-provider";
import {
  MOCK_DMS,
  MOCK_CHANNELS,
  MOCK_MESSAGES,
  type DmContact,
  type Channel,
  type Message,
} from "@/data/messaging";

// ── Types ──────────────────────────────────────────────────────────────────────

type ConversationMode = "dm" | "channel";

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatMessageTime(isoStr: string): string {
  const d = new Date(isoStr);
  return d.toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" });
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

// ── Message bubble ─────────────────────────────────────────────────────────────

function MessageBubble({ msg, showAvatar, showTimestamp }: {
  msg: Message;
  showAvatar: boolean;
  showTimestamp: boolean;
}) {
  if (msg.type === "system") {
    return (
      <div className="flex justify-center my-2.5">
        <span className="text-tiny text-slate-400 bg-slate-100 rounded-full px-3 py-1 font-medium">{msg.content}</span>
      </div>
    );
  }

  return (
    <div className={cn("flex items-end gap-2.5 my-1.5 animate-fade-in-up", msg.isMe ? "flex-row-reverse" : "flex-row")}>
      <div className="size-7 shrink-0">
        {!msg.isMe && showAvatar && (
          <Avatar
            src={msg.senderAvatarUrl}
            fallback={msg.senderName.split(" ").map(n => n[0]).join("")}
            className="size-7"
          />
        )}
      </div>

      <div className={cn("flex flex-col gap-0.5 max-w-[70%]", msg.isMe ? "items-end" : "items-start")}>
        {showAvatar && !msg.isMe && (
          <span className="text-tiny text-slate-400 ml-1 mb-0.5">{msg.senderName}</span>
        )}
        <div className={cn(
          "px-4 py-2.5 rounded-2xl leading-relaxed text-caption shadow-[0_1px_2px_rgba(0,0,0,0.02)]",
          msg.isMe
            ? "bg-[var(--sidebar)] text-white rounded-br-sm"
            : "bg-white border border-slate-100 text-slate-800 rounded-bl-sm"
        )}>
          {msg.content}
        </div>
        {showTimestamp && (
          <div className={cn("flex items-center gap-1 mt-1", msg.isMe ? "flex-row-reverse" : "flex-row")}>
            <span className="text-tiny text-slate-400 font-mono">{formatMessageTime(msg.sentAt)}</span>
            {msg.isMe && (
              msg.readAt
                ? <IconCheckFilled size={11} className="text-emerald-500" />
                : msg.deliveredAt
                  ? <IconCheckFilled size={11} className="text-slate-350" />
                  : <IconCheck size={11} className="text-slate-300" />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Typing indicator ──────────────────────────────────────────────────────────

function TypingIndicator({ name }: { name: string }) {
  return (
    <div className="flex items-end gap-2.5 my-2">
      <div className="size-7 shrink-0" />
      <div className="flex flex-col items-start gap-0.5">
        <span className="text-tiny text-slate-400 ml-1 mb-0.5">{name}</span>
        <div className="bg-white border border-slate-100 shadow-[0_1px_3px_rgba(0,0,0,0.04)] rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-1">
          {[0, 1, 2].map(i => (
            <span key={i} className="size-1.5 rounded-full bg-slate-400 animate-bounce"
              style={{ animationDelay: `${i * 0.15}s`, animationDuration: "0.9s" }} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Sidebar item ──────────────────────────────────────────────────────────────

function ConversationItem({ dm, active, onClick }: { dm: DmContact; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 px-3.5 py-3 rounded-xl text-left transition-all",
        active ? "bg-slate-100 text-slate-900" : "hover:bg-slate-50/60 text-slate-650"
      )}>
      <div className="relative shrink-0">
        <Avatar src={dm.avatarUrl} fallback={dm.name.split(" ").map(n => n[0]).join("")}
          status={dm.online ? "online" : undefined} className="size-10 shadow-sm" />
        {dm.unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-[var(--sidebar)] text-[9px] font-mono text-white ring-2 ring-white animate-scale-in">
            {dm.unread}
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1">
          <p className={cn("text-caption truncate", dm.unread > 0 ? "text-slate-950 font-semibold" : "text-slate-800")}>{dm.name}</p>
          <span className="text-tiny text-slate-400 shrink-0 font-mono">{dm.lastMessageTime}</span>
        </div>
        <p className={cn("text-tiny truncate mt-0.5", dm.unread > 0 ? "text-slate-700 font-medium" : "text-slate-400")}>
          {dm.lastMessage}
        </p>
      </div>
    </button>
  );
}

function ChannelItem({ channel, active, onClick }: { channel: Channel; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 px-3.5 py-2.5 rounded-xl text-left transition-all",
        active ? "bg-slate-100 text-slate-900 font-semibold" : "hover:bg-slate-50/60 text-slate-600"
      )}>
      <div className={cn("size-8 shrink-0 rounded-lg flex items-center justify-center border",
        active ? "bg-white border-slate-200" : "bg-slate-50 border-slate-100")}>
        <IconHash size={14} className="text-slate-500" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1">
          <p className="text-caption truncate">{channel.name}</p>
          {channel.unread > 0 && (
            <span className="flex size-4 items-center justify-center rounded-full bg-[var(--sidebar)] text-[9px] font-mono text-white shrink-0">
              {channel.unread}
            </span>
          )}
        </div>
        <p className="text-tiny text-slate-400 mt-0.5">{channel.memberCount} members · {channel.lastActivity}</p>
      </div>
    </button>
  );
}

// ── Main Messages Content ─────────────────────────────────────────────────────

export function MessagesPageContent() {
  const { selectedChatDMId } = useUIStore();
  const { pushToast } = useToast();

  const [mode, setMode] = useState<ConversationMode>("dm");
  const [activeDmId, setActiveDmId] = useState<string>(selectedChatDMId || MOCK_DMS[0].id);
  const [activeChannelId, setActiveChannelId] = useState<string>(MOCK_CHANNELS[0].id);
  const [searchQuery, setSearchQuery] = useState("");
  const [messageText, setMessageText] = useState("");
  const [conversations, setConversations] = useState(MOCK_MESSAGES);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversations, activeDmId]);

  useEffect(() => {
    if (selectedChatDMId) {
      setActiveDmId(selectedChatDMId);
      setMode("dm");
    }
  }, [selectedChatDMId]);

  const activeDm = MOCK_DMS.find(d => d.id === activeDmId)!;
  const activeChannel = MOCK_CHANNELS.find(c => c.id === activeChannelId)!;
  const currentMessages = conversations[activeDmId] ?? [];

  const filteredDms = useMemo(() =>
    MOCK_DMS.filter(d => d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.lastMessage.toLowerCase().includes(searchQuery.toLowerCase())),
    [searchQuery]
  );

  const handleSend = () => {
    const content = messageText.trim();
    if (!content) return;

    const newMsg: Message = {
      id: `m-${Date.now()}`,
      conversationId: activeDmId,
      senderId: "me",
      senderName: "You",
      senderAvatarUrl: "",
      content,
      sentAt: new Date().toISOString(),
      isMe: true,
      type: "text",
    };

    setConversations(prev => ({
      ...prev,
      [activeDmId]: [...(prev[activeDmId] ?? []), newMsg],
    }));

    setMessageText("");
    inputRef.current?.focus();

    // Trigger mock typing reply
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      const reply: Message = {
        id: `m-r-${Date.now()}`,
        conversationId: activeDmId,
        senderId: activeDmId,
        senderName: activeDm.name,
        senderAvatarUrl: activeDm.avatarUrl,
        content: "Understood. I will process this update on the general ledger and notify the team.",
        sentAt: new Date().toISOString(),
        isMe: false,
        type: "text",
      };
      setConversations(prev => ({
        ...prev,
        [activeDmId]: [...(prev[activeDmId] ?? []), reply],
      }));
      pushToast({ tone: "info", title: `Reply from ${activeDm.name}`, body: reply.content });
    }, 1800);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const groupedMessages = useMemo(() => {
    return currentMessages.map((msg, idx) => {
      const prev = currentMessages[idx - 1];
      const next = currentMessages[idx + 1];
      const showAvatar = !prev || prev.senderId !== msg.senderId;
      const showTimestamp = !next || next.senderId !== msg.senderId;
      const showDayLabel = !prev || !isSameDay(prev.sentAt, msg.sentAt);
      return { msg, showAvatar, showTimestamp, showDayLabel };
    });
  }, [currentMessages]);

  const totalUnread = MOCK_DMS.reduce((sum, dm) => sum + dm.unread, 0) + MOCK_CHANNELS.reduce((sum, ch) => sum + ch.unread, 0);

  return (
    <div className="mx-auto max-w-[98rem] w-full px-4 md:px-6 animate-fade-in">
      <div className="flex h-[calc(100vh-140px)] min-h-[550px] rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">

        {/* ── Left Sidebar ──────────────────────────────────── */}
        <aside className="w-76 shrink-0 border-r border-slate-100 flex flex-col bg-slate-50/50">
          {/* Header */}
          <div className="px-5 pt-5 pb-3 border-b border-slate-100">
            <div className="flex items-center justify-between mb-3.5">
              <h1 className="headline-md font-serif text-slate-900 flex items-center gap-2">
                Messages
                {totalUnread > 0 && (
                  <span className="inline-flex size-5 items-center justify-center rounded-full bg-[var(--sidebar)] text-[9px] font-mono font-medium text-white shadow-sm">
                    {totalUnread}
                  </span>
                )}
              </h1>
              <button type="button" className="flex size-8 items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-colors shadow-sm" aria-label="New message">
                <IconPlus size={15} />
              </button>
            </div>
            {/* Search */}
            <div className="relative">
              <IconSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden />
              <input
                type="search"
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full h-9 rounded-xl border border-slate-200 bg-white pl-8.5 pr-3 text-caption text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-slate-350 focus:ring-1 focus:ring-slate-350/10 transition-all shadow-inner"
              />
            </div>
          </div>

          {/* Mode tabs */}
          <div className="px-2 py-2 flex flex-wrap gap-1.5 bg-transparent border-b border-slate-100">
            {(["dm", "channel"] as const).map(m => (
              <button key={m} type="button" onClick={() => setMode(m)}
                className={cn(
                  "flex-1 inline-flex py-1.5 text-caption font-medium rounded-lg transition-all flex items-center justify-center gap-1.5",
                  mode === m
                    ? "bg-[#151936] text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                )}>
                {m === "dm" ? <IconAt size={14} /> : <IconHash size={14} />}
                {m === "dm" ? "Direct" : "Channels"}
              </button>
            ))}
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto p-3 [scrollbar-width:thin] space-y-1 bg-white/20">
            {mode === "dm" && (
              filteredDms.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400 text-center">
                  <IconMessageCircle size={24} className="mb-2 text-slate-300" />
                  <p className="text-caption text-slate-400">No conversations</p>
                </div>
              ) : (
                filteredDms.map(dm => (
                  <ConversationItem key={dm.id} dm={dm} active={activeDmId === dm.id} onClick={() => setActiveDmId(dm.id)} />
                ))
              )
            )}
            {mode === "channel" && MOCK_CHANNELS.map(channel => (
              <ChannelItem key={channel.id} channel={channel} active={activeChannelId === channel.id} onClick={() => setActiveChannelId(channel.id)} />
            ))}
          </div>
        </aside>

        {/* ── Chat Area ─────────────────────────────────────── */}
        <div className="flex flex-1 flex-col min-w-0 bg-white">

          {/* Chat header */}
          <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-100 shrink-0 shadow-sm relative z-10 bg-white">
            <div className="flex items-center gap-3">
              {mode === "dm" ? (
                <>
                  <Avatar src={activeDm.avatarUrl} fallback={activeDm.name.split(" ").map(n => n[0]).join("")}
                    status={activeDm.online ? "online" : undefined} className="size-10 shadow-sm" />
                  <div>
                    <p className="text-label text-slate-900 font-semibold leading-tight">{activeDm.name}</p>
                    <p className="text-tiny text-slate-400 mt-1 font-medium">{activeDm.role} · {activeDm.online ? "Active now" : "Offline"}</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="size-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center shadow-inner">
                    <IconHash size={18} className="text-slate-500" />
                  </div>
                  <div>
                    <p className="text-label text-slate-900 font-semibold leading-tight">#{activeChannel.name}</p>
                    <p className="text-tiny text-slate-400 mt-1 font-medium">{activeChannel.memberCount} members · {activeChannel.description}</p>
                  </div>
                </>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <button type="button" aria-label="Voice call" className="flex size-8.5 items-center justify-center rounded-xl text-slate-400 border border-slate-100 bg-white hover:bg-slate-50 hover:text-slate-600 transition-colors shadow-sm">
                <IconPhone size={16} />
              </button>
              <button type="button" aria-label="Video call" className="flex size-8.5 items-center justify-center rounded-xl text-slate-400 border border-slate-100 bg-white hover:bg-slate-50 hover:text-slate-600 transition-colors shadow-sm">
                <IconVideo size={16} />
              </button>
              <button type="button" aria-label="More options" className="flex size-8.5 items-center justify-center rounded-xl text-slate-400 border border-slate-100 bg-white hover:bg-slate-50 hover:text-slate-600 transition-colors shadow-sm">
                <IconDotsVertical size={16} />
              </button>
            </div>
          </div>

          {/* Messages list */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-2 bg-slate-50/20 [scrollbar-width:thin]">
            {groupedMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="size-16 rounded-2xl bg-white border border-slate-150 flex items-center justify-center mb-4 shadow-sm">
                  <IconMessageCircle size={28} className="text-slate-300" />
                </div>
                <p className="text-label text-slate-700 font-medium">No messages in this chat</p>
                <p className="text-caption text-slate-400 mt-1">Send a message below to start the conversation.</p>
              </div>
            ) : (
              groupedMessages.map(({ msg, showAvatar, showTimestamp, showDayLabel }) => (
                <div key={msg.id}>
                  {showDayLabel && (
                    <div className="flex items-center gap-4 my-5 select-none">
                      <div className="flex-1 h-px bg-slate-100" />
                      <span className="text-tiny text-slate-450 bg-slate-50 border border-slate-100/50 px-3 py-1 rounded-full font-mono font-medium">{formatDayLabel(msg.sentAt)}</span>
                      <div className="flex-1 h-px bg-slate-100" />
                    </div>
                  )}
                  <MessageBubble msg={msg} showAvatar={showAvatar} showTimestamp={showTimestamp} />
                </div>
              ))
            )}

            {isTyping && <TypingIndicator name={activeDm.name} />}

            <div ref={messagesEndRef} />
          </div>

          {/* Message input bar */}
          <div className="shrink-0 border-t border-slate-100 p-4.5 bg-white">
            <div className="flex items-end gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 focus-within:border-slate-350 focus-within:ring-2 focus-within:ring-slate-100 transition-all shadow-sm">
              <button type="button" aria-label="Attach file" className="shrink-0 mb-0.5 flex size-8 items-center justify-center rounded-xl bg-slate-50 border border-slate-100 text-slate-400 hover:text-slate-600 transition-colors shadow-sm">
                <IconPaperclip size={16} />
              </button>
              <textarea
                ref={inputRef}
                value={messageText}
                onChange={e => setMessageText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Message ${mode === "dm" ? activeDm.name : "#" + activeChannel.name}...`}
                rows={1}
                className="flex-1 resize-none bg-transparent text-caption text-slate-800 placeholder:text-slate-455 focus:outline-none max-h-32 pt-1 font-medium"
              />
              <div className="flex items-center gap-1.5 shrink-0 mb-0.5">
                <button type="button" aria-label="Emoji picker" className="flex size-8 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-50 transition-colors">
                  <IconMoodSmile size={16} />
                </button>
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={!messageText.trim()}
                  aria-label="Send message"
                  className={cn(
                    "flex size-8.5 items-center justify-center rounded-xl transition-all shadow-sm",
                    messageText.trim()
                      ? "bg-[var(--sidebar)] text-white hover:opacity-90 scale-100"
                      : "bg-slate-105 text-slate-300 border border-slate-150 cursor-not-allowed"
                  )}>
                  <IconSend size={15} />
                </button>
              </div>
            </div>
            <p className="text-center text-tiny text-slate-350 mt-2 font-medium">↵ to send · Shift+↵ for new line</p>
          </div>
        </div>
      </div>
    </div>
  );
}
