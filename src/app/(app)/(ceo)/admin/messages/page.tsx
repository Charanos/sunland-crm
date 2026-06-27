"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import {
  IconSend,
  IconSearch,
  IconHash,
  IconAt,
  IconX,
  IconCircleCheckFilled,
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
      <div className="flex justify-center my-2">
        <span className="text-tiny text-slate-400 bg-slate-100 rounded-full px-3 py-1">{msg.content}</span>
      </div>
    );
  }

  return (
    <div className={cn("flex items-end gap-2.5", msg.isMe ? "flex-row-reverse" : "flex-row")}>
      {/* Avatar spacer/avatar */}
      <div className="size-7 shrink-0">
        {!msg.isMe && showAvatar && (
          <Avatar
            src={msg.senderAvatarUrl}
            fallback={msg.senderName.split(" ").map(n => n[0]).join("")}
            className="size-7"
          />
        )}
      </div>

      {/* Bubble */}
      <div className={cn("flex flex-col gap-0.5 max-w-[70%]", msg.isMe ? "items-end" : "items-start")}>
        {showAvatar && !msg.isMe && (
          <span className="text-tiny text-slate-400 ml-1">{msg.senderName}</span>
        )}
        <div className={cn(
          "px-3.5 py-2.5 rounded-2xl leading-relaxed text-caption",
          msg.isMe
            ? "bg-[var(--sidebar)] text-white rounded-br-sm"
            : "bg-white border border-slate-100 text-slate-800 shadow-[0_1px_3px_rgba(0,0,0,0.06)] rounded-bl-sm"
        )}>
          {msg.content}
        </div>
        {showTimestamp && (
          <div className={cn("flex items-center gap-1 mt-0.5", msg.isMe ? "flex-row-reverse" : "flex-row")}>
            <span className="text-tiny text-slate-400">{formatMessageTime(msg.sentAt)}</span>
            {msg.isMe && (
              msg.readAt
                ? <IconCheckFilled size={11} className="text-[var(--tertiary)]" />
                : msg.deliveredAt
                  ? <IconCheckFilled size={11} className="text-slate-300" />
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
    <div className="flex items-end gap-2.5">
      <div className="size-7 shrink-0" />
      <div className="flex flex-col items-start gap-0.5">
        <span className="text-tiny text-slate-400 ml-1">{name}</span>
        <div className="bg-white border border-slate-100 shadow-[0_1px_3px_rgba(0,0,0,0.06)] rounded-2xl rounded-bl-sm px-3.5 py-2.5 flex items-center gap-1">
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
        "flex w-full items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all",
        active ? "bg-[var(--sidebar)]/8 text-slate-900" : "hover:bg-slate-100/60 text-slate-700"
      )}>
      <div className="relative shrink-0">
        <Avatar src={dm.avatarUrl} fallback={dm.name.split(" ").map(n => n[0]).join("")}
          status={dm.online ? "online" : undefined} className="size-10" />
        {dm.unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-[var(--sidebar)] text-[9px] text-white">
            {dm.unread}
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1">
          <p className={cn("text-caption truncate", dm.unread > 0 ? "text-slate-900" : "text-slate-700")}>{dm.name}</p>
          <span className="text-tiny text-slate-400 shrink-0">{dm.lastMessageTime}</span>
        </div>
        <p className={cn("text-tiny truncate mt-0.5", dm.unread > 0 ? "text-slate-600" : "text-slate-400")}>
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
        "flex w-full items-center gap-3 px-3 py-2 rounded-xl text-left transition-all",
        active ? "bg-[var(--sidebar)]/8 text-slate-900" : "hover:bg-slate-100/60 text-slate-600"
      )}>
      <div className="size-8 shrink-0 rounded-lg bg-slate-100 flex items-center justify-center">
        <IconHash size={14} className="text-slate-500" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1">
          <p className="text-caption truncate">{channel.name}</p>
          {channel.unread > 0 && (
            <span className="flex size-4 items-center justify-center rounded-full bg-[var(--primary)] text-[9px] text-[var(--on-primary)] shrink-0">
              {channel.unread}
            </span>
          )}
        </div>
        <p className="text-tiny text-slate-400">{channel.memberCount} members · {channel.lastActivity}</p>
      </div>
    </button>
  );
}

// ── Main Messages Page ─────────────────────────────────────────────────────────

export default function MessagesPage() {
  const { selectedChatDMId } = useUIStore();

  const [mode, setMode] = useState<ConversationMode>("dm");
  const [activeDmId, setActiveDmId] = useState<string>(selectedChatDMId || MOCK_DMS[0].id);
  const [activeChannelId, setActiveChannelId] = useState<string>(MOCK_CHANNELS[0].id);
  const [searchQuery, setSearchQuery] = useState("");
  const [messageText, setMessageText] = useState("");
  const [conversations, setConversations] = useState(MOCK_MESSAGES);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversations, activeDmId]);

  // Sync with global chat widget DM selection
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

    // Simulate typing + reply after delay
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      const reply: Message = {
        id: `m-r-${Date.now()}`,
        conversationId: activeDmId,
        senderId: activeDmId,
        senderName: activeDm.name,
        senderAvatarUrl: activeDm.avatarUrl,
        content: "Got it, I'll take care of that right away.",
        sentAt: new Date().toISOString(),
        isMe: false,
        type: "text",
      };
      setConversations(prev => ({
        ...prev,
        [activeDmId]: [...(prev[activeDmId] ?? []), reply],
      }));
    }, 2500);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Group consecutive same-sender messages
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
    <div className="flex h-[calc(100vh-120px)] min-h-[500px] rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_4px_rgba(0,0,0,0.04)] overflow-hidden animate-fade-in">

      {/* ── Left Sidebar ──────────────────────────────────── */}
      <aside className="w-72 shrink-0 border-r border-slate-100 flex flex-col">
        {/* Header */}
        <div className="px-4 pt-4 pb-3 border-b border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <h1 className="headline-md text-slate-900">
              Messages
              {totalUnread > 0 && (
                <span className="ml-2 inline-flex size-5 items-center justify-center rounded-full bg-red-500 text-[9px] text-white">
                  {totalUnread}
                </span>
              )}
            </h1>
            <button type="button" className="flex size-7 items-center justify-center rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors" aria-label="New message">
              <IconPlus size={14} />
            </button>
          </div>
          {/* Search */}
          <div className="relative">
            <IconSearch size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden />
            <input
              type="search"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full h-8 rounded-xl bg-slate-100 pl-7 pr-3 text-tiny text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 transition-all"
            />
          </div>
        </div>

        {/* Mode tabs */}
        <div className="flex border-b border-slate-100">
          {(["dm", "channel"] as const).map(m => (
            <button key={m} type="button" onClick={() => setMode(m)}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-2.5 text-tiny transition-colors",
                mode === m
                  ? "border-b-2 border-[var(--sidebar)] text-[var(--sidebar)]"
                  : "text-slate-400 hover:text-slate-600"
              )}>
              {m === "dm" ? <IconAt size={13} /> : <IconHash size={13} />}
              {m === "dm" ? "Direct" : "Channels"}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-2 [scrollbar-width:thin] space-y-0.5">
          {mode === "dm" && (
            filteredDms.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-slate-400 text-center">
                <IconMessageCircle size={24} className="mb-2" />
                <p className="text-caption">No results found</p>
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
      <div className="flex flex-1 flex-col min-w-0">

        {/* Chat header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            {mode === "dm" ? (
              <>
                <Avatar src={activeDm.avatarUrl} fallback={activeDm.name.split(" ").map(n => n[0]).join("")}
                  status={activeDm.online ? "online" : undefined} className="size-9" />
                <div>
                  <p className="text-label text-slate-900">{activeDm.name}</p>
                  <p className="text-tiny text-slate-400">{activeDm.role} · {activeDm.online ? "Active now" : "Offline"}</p>
                </div>
              </>
            ) : (
              <>
                <div className="size-9 rounded-xl bg-slate-100 flex items-center justify-center">
                  <IconHash size={18} className="text-slate-500" />
                </div>
                <div>
                  <p className="text-label text-slate-900">#{activeChannel.name}</p>
                  <p className="text-tiny text-slate-400">{activeChannel.memberCount} members · {activeChannel.description}</p>
                </div>
              </>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button type="button" aria-label="Voice call" className="flex size-8 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
              <IconPhone size={16} />
            </button>
            <button type="button" aria-label="Video call" className="flex size-8 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
              <IconVideo size={16} />
            </button>
            <button type="button" aria-label="More options" className="flex size-8 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
              <IconDotsVertical size={16} />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2 bg-slate-50/30 [scrollbar-width:thin]">
          {groupedMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="size-14 rounded-full bg-white border border-slate-200 flex items-center justify-center mb-3 shadow-sm">
                <IconMessageCircle size={24} className="text-slate-300" />
              </div>
              <p className="text-label text-slate-500">No messages yet</p>
              <p className="text-caption text-slate-400 mt-0.5">Send a message to start the conversation</p>
            </div>
          ) : (
            groupedMessages.map(({ msg, showAvatar, showTimestamp, showDayLabel }) => (
              <div key={msg.id}>
                {showDayLabel && (
                  <div className="flex items-center gap-3 my-4">
                    <div className="flex-1 h-px bg-slate-200" />
                    <span className="text-tiny text-slate-400 bg-slate-50 px-2">{formatDayLabel(msg.sentAt)}</span>
                    <div className="flex-1 h-px bg-slate-200" />
                  </div>
                )}
                <MessageBubble msg={msg} showAvatar={showAvatar} showTimestamp={showTimestamp} />
              </div>
            ))
          )}

          {/* Typing indicator */}
          {isTyping && <TypingIndicator name={activeDm.name} />}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="shrink-0 border-t border-slate-100 p-3.5">
          <div className="flex items-end gap-2.5 rounded-2xl border border-slate-200 bg-white px-3 py-2 focus-within:border-slate-300 focus-within:ring-2 focus-within:ring-slate-100 transition-all">
            <button type="button" aria-label="Attach file" className="shrink-0 mb-0.5 flex size-7 items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 transition-colors">
              <IconPaperclip size={15} />
            </button>
            <textarea
              ref={inputRef}
              value={messageText}
              onChange={e => setMessageText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Message ${mode === "dm" ? activeDm.name : "#" + activeChannel.name}...`}
              rows={1}
              className="flex-1 resize-none bg-transparent text-caption text-slate-800 placeholder:text-slate-400 focus:outline-none max-h-32 [scrollbar-width:thin]"
              style={{ scrollbarWidth: "thin" }}
            />
            <div className="flex items-center gap-1 shrink-0 mb-0.5">
              <button type="button" aria-label="Emoji" className="flex size-7 items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 transition-colors">
                <IconMoodSmile size={15} />
              </button>
              <button
                type="button"
                onClick={handleSend}
                disabled={!messageText.trim()}
                aria-label="Send message"
                className={cn(
                  "flex size-8 items-center justify-center rounded-xl transition-all",
                  messageText.trim()
                    ? "bg-[var(--sidebar)] text-white hover:opacity-90 scale-100"
                    : "bg-slate-100 text-slate-300 cursor-not-allowed"
                )}>
                <IconSend size={15} />
              </button>
            </div>
          </div>
          <p className="text-center text-tiny text-slate-300 mt-1.5">↵ to send · Shift+↵ for new line</p>
        </div>
      </div>
    </div>
  );
}
