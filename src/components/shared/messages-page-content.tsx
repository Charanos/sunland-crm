"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  IconSend,
  IconSearch,
  IconHash,
  IconAt,
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
  return d.toLocaleDateString("en-KE", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

// ── Message Bubble ─────────────────────────────────────────────────────────────

function MessageBubble({
  msg,
  showAvatar,
  showTimestamp,
}: {
  msg: Message;
  showAvatar: boolean;
  showTimestamp: boolean;
}) {
  if (msg.type === "system") {
    return (
      <div className="flex justify-center my-3">
        <span className="text-tiny label-caps text-slate-400 bg-slate-100 rounded-full px-3 py-1">
          {msg.content}
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-end gap-2.5 animate-fade-in-up",
        msg.isMe ? "flex-row-reverse" : "flex-row",
        showAvatar ? "mt-3" : "mt-0.5"
      )}
    >
      {/* Avatar slot — always reserves space to maintain alignment */}
      <div className="size-7 shrink-0 self-end">
        {!msg.isMe && showAvatar && (
          <Avatar
            src={msg.senderAvatarUrl}
            fallback={msg.senderName
              .split(" ")
              .map((n) => n[0])
              .join("")}
            className="size-7 shadow-sm"
          />
        )}
      </div>

      <div
        className={cn(
          "flex flex-col gap-1 max-w-[68%]",
          msg.isMe ? "items-end" : "items-start"
        )}
      >
        {showAvatar && !msg.isMe && (
          <span className="text-tiny label-caps text-slate-400 ml-1">
            {msg.senderName}
          </span>
        )}

        <div
          className={cn(
            "px-4 py-2.5 rounded-2xl text-sm leading-relaxed",
            msg.isMe
              ? "bg-[#151936] text-white rounded-br-sm shadow-[0_2px_8px_rgba(21,25,54,0.20)]"
              : "bg-white border border-slate-100 text-slate-800 rounded-bl-sm shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
          )}
        >
          {msg.content}
        </div>

        {showTimestamp && (
          <div
            className={cn(
              "flex items-center gap-1 px-1",
              msg.isMe ? "flex-row-reverse" : "flex-row"
            )}
          >
            <span className="font-mono text-tiny text-slate-400">
              {formatMessageTime(msg.sentAt)}
            </span>
            {msg.isMe &&
              (msg.readAt ? (
                <IconCheckFilled size={11} className="text-emerald-500" />
              ) : msg.deliveredAt ? (
                <IconCheckFilled size={11} className="text-slate-300" />
              ) : (
                <IconCheck size={11} className="text-slate-300" />
              ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Typing Indicator ──────────────────────────────────────────────────────────

function TypingIndicator({ name }: { name: string }) {
  return (
    <div className="flex items-end gap-2.5 mt-3 animate-fade-in-up">
      <div className="size-7 shrink-0" />
      <div className="flex flex-col items-start gap-1">
        <span className="text-tiny label-caps text-slate-400 ml-1">
          {name} is typing
        </span>
        <div className="bg-white border border-slate-100 shadow-[0_1px_3px_rgba(0,0,0,0.04)] rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="size-1.5 rounded-full bg-slate-300 animate-bounce"
              style={{
                animationDelay: `${i * 0.15}s`,
                animationDuration: "1s",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── DM Conversation Item ───────────────────────────────────────────────────────

function ConversationItem({
  dm,
  active,
  onClick,
}: {
  dm: DmContact;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex w-full items-center gap-3 px-3.5 py-2.5 rounded-xl text-left transition-all duration-200 overflow-hidden",
        active
          ? "bg-white shadow-sm border border-slate-200/80"
          : "hover:bg-white/80 hover:shadow-sm"
      )}
    >
      {/* Active accent bar */}
      {active && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 h-8 w-[3px] rounded-r-full bg-[#151936]" />
      )}

      {/* Avatar */}
      <div className="relative shrink-0">
        <Avatar
          src={dm.avatarUrl}
          fallback={dm.name
            .split(" ")
            .map((n) => n[0])
            .join("")}
          status={dm.online ? "online" : undefined}
          className="size-10 shadow-sm"
        />
        {dm.unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-[#151936] text-tiny font-mono text-white ring-2 ring-white">
            {dm.unread}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1 mb-0.5">
          <p
            className={cn(
              "text-sm truncate transition-colors",
              dm.unread > 0 || active ? "text-slate-900" : "text-slate-700"
            )}
          >
            {dm.name}
          </p>
          <span className="font-mono text-tiny text-slate-400 shrink-0">
            {dm.lastMessageTime}
          </span>
        </div>
        <p
          className={cn(
            "text-xs truncate",
            dm.unread > 0 ? "text-slate-600" : "text-slate-400"
          )}
        >
          {dm.lastMessage}
        </p>
      </div>
    </button>
  );
}

// ── Channel Item ──────────────────────────────────────────────────────────────

function ChannelItem({
  channel,
  active,
  onClick,
}: {
  channel: Channel;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex w-full items-center gap-3 px-3.5 py-2.5 rounded-xl text-left transition-all duration-200 overflow-hidden",
        active
          ? "bg-white shadow-sm border border-slate-200/80"
          : "hover:bg-white/80 hover:shadow-sm"
      )}
    >
      {active && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 h-8 w-[3px] rounded-r-full bg-[#151936]" />
      )}

      {/* Channel icon */}
      <div
        className={cn(
          "size-9 shrink-0 rounded-xl flex items-center justify-center transition-all duration-200",
          active
            ? "bg-[#151936] text-[#f3df27] shadow-sm"
            : "bg-slate-100 text-slate-500"
        )}
      >
        <IconHash size={15} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1 mb-0.5">
          <p
            className={cn(
              "text-sm truncate",
              active ? "text-slate-900" : "text-slate-700"
            )}
          >
            #{channel.name}
          </p>
          {channel.unread > 0 && (
            <span className="flex size-4 items-center justify-center rounded-full bg-[#151936] text-tiny font-mono text-white shrink-0">
              {channel.unread}
            </span>
          )}
        </div>
        <p className="text-caption text-slate-400 font-mono">
          {channel.memberCount} members · {channel.lastActivity}
        </p>
      </div>
    </button>
  );
}


// ── Main Component ─────────────────────────────────────────────────────────────

export function MessagesPageContent() {
  const { selectedChatDMId, setSelectedChatDMId } = useUIStore();
  const { pushToast } = useToast();

  const [mode, setMode] = useState<ConversationMode>("dm");
  const [activeDmId, setActiveDmId] = useState<string>(
    selectedChatDMId || MOCK_DMS[0].id
  );
  const [activeChannelId, setActiveChannelId] = useState<string>(
    MOCK_CHANNELS[0].id
  );
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
      const timer = setTimeout(() => {
        setActiveDmId(selectedChatDMId);
        setMode("dm");
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [selectedChatDMId]);

  const activeDm = MOCK_DMS.find((d) => d.id === activeDmId)!;
  const activeChannel = MOCK_CHANNELS.find((c) => c.id === activeChannelId)!;
  const currentMessages = useMemo(() => conversations[activeDmId] ?? [], [conversations, activeDmId]);

  const filteredDms = useMemo(
    () =>
      MOCK_DMS.filter(
        (d) =>
          d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          d.lastMessage.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    [searchQuery]
  );

  const handleSend = useCallback(() => {
    const content = messageText.trim();
    if (!content) return;

    const newMsg: Message = {
      id: `m-${new Date().getTime()}`,
      conversationId: activeDmId,
      senderId: "me",
      senderName: "You",
      senderAvatarUrl: "",
      content,
      sentAt: new Date().toISOString(),
      isMe: true,
      type: "text",
    };

    setConversations((prev) => ({
      ...prev,
      [activeDmId]: [...(prev[activeDmId] ?? []), newMsg],
    }));

    setMessageText("");
    setTimeout(() => {
      inputRef.current?.focus();
    }, 0);

    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      const reply: Message = {
        id: `m-r-${new Date().getTime()}`,
        conversationId: activeDmId,
        senderId: activeDmId,
        senderName: activeDm.name,
        senderAvatarUrl: activeDm.avatarUrl,
        content:
          "Understood. I will process this update on the general ledger and notify the team.",
        sentAt: new Date().toISOString(),
        isMe: false,
        type: "text",
      };
      setConversations((prev) => ({
        ...prev,
        [activeDmId]: [...(prev[activeDmId] ?? []), reply],
      }));
      pushToast({
        tone: "info",
        title: `Reply from ${activeDm.name}`,
        body: reply.content,
      });
    }, 1800);
  }, [messageText, activeDmId, activeDm, pushToast]);

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

  const totalUnread =
    MOCK_DMS.reduce((sum, dm) => sum + dm.unread, 0) +
    MOCK_CHANNELS.reduce((sum, ch) => sum + ch.unread, 0);

  const dmUnread = MOCK_DMS.reduce((sum, dm) => sum + dm.unread, 0);
  const channelUnread = MOCK_CHANNELS.reduce(
    (sum, ch) => sum + ch.unread,
    0
  );

  return (
    <div className="mx-auto max-w-[98rem] w-full px-4 md:px-6 animate-fade-in">
      <div className="flex h-[calc(100vh-140px)] min-h-[550px] rounded-2xl border border-slate-200/70 bg-white shadow-[0_4px_24px_rgba(0,0,0,0.06)] overflow-hidden">

        {/* ── Left Sidebar ─────────────────────────────────────── */}
        <aside className="w-76 shrink-0 flex flex-col border-r border-slate-100 bg-slate-50/20">

          {/* Dark satin header */}
          <div className="relative overflow-hidden shrink-0">
            {/* Gradient canvas */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#070b19] via-[#0f172a] to-[#181534]" />

            {/* Dot-grid overlay */}
            <div
              className="absolute inset-0 opacity-[0.04]"
              style={{
                backgroundImage:
                  "radial-gradient(circle, rgba(243,223,39,0.7) 1px, transparent 1px)",
                backgroundSize: "24px 24px",
              }}
            />

            {/* Ambient glow */}
            <div className="absolute -top-12 -right-12 size-40 rounded-full bg-[#f3df27]/5 blur-3xl pointer-events-none" />

            <div className="relative px-5 pt-5 pb-4">
              {/* Title row */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <h1 className="title-serif text-white text-lg leading-none">
                    Messages
                  </h1>
                  {totalUnread > 0 && (
                    <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#f3df27] text-[#151936] text-tiny font-mono px-1.5 shadow-sm">
                      {totalUnread}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  aria-label="New message"
                  className="size-8 rounded-xl border border-white/10 bg-white/8 flex items-center justify-center text-slate-400 hover:bg-white/15 hover:text-white transition-all"
                >
                  <IconPlus size={14} />
                </button>
              </div>

              {/* Search input — styled for dark context */}
              <div className="relative">
                <IconSearch
                  size={13}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
                />
                <input
                  type="search"
                  placeholder="Search conversations…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-9 rounded-xl border border-white/10 bg-white/8 pl-8 pr-3 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-[#f3df27]/25 focus:ring-1 focus:ring-[#f3df27]/10 transition-all"
                />
              </div>
            </div>
          </div>

          {/* Mode tabs — segmented pill control */}
          <div className="flex items-center gap-1 p-2.5 shrink-0 border-b border-slate-100 bg-white/60">
            <button
              type="button"
              onClick={() => setMode("dm")}
              className={cn(
                "relative flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs transition-all duration-200",
                mode === "dm"
                  ? "bg-[#151936] text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-800 hover:bg-white"
              )}
            >
              <IconAt size={13} />
              <span>Direct</span>
              {dmUnread > 0 && mode !== "dm" && (
                <span className="absolute -top-0.5 -right-0.5 flex size-3.5 items-center justify-center rounded-full bg-[#151936] text-tiny font-mono text-white">
                  {dmUnread}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setMode("channel")}
              className={cn(
                "relative flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs transition-all duration-200",
                mode === "channel"
                  ? "bg-[#151936] text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-800 hover:bg-white"
              )}
            >
              <IconHash size={13} />
              <span>Channels</span>
              {channelUnread > 0 && mode !== "channel" && (
                <span className="absolute -top-0.5 -right-0.5 flex size-3.5 items-center justify-center rounded-full bg-[#151936] text-tiny font-mono text-white">
                  {channelUnread}
                </span>
              )}
            </button>
          </div>

          {/* Conversation list */}
          <div className="flex-1 overflow-y-auto p-2.5 space-y-0.5 [scrollbar-width:thin]">
            {mode === "dm" && (
              <>
                {filteredDms.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="size-10 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
                      <IconMessageCircle size={18} className="text-slate-300" />
                    </div>
                    <p className="text-xs text-slate-400">No conversations found</p>
                  </div>
                ) : (
                  filteredDms.map((dm) => (
                    <ConversationItem
                      key={dm.id}
                      dm={dm}
                      active={activeDmId === dm.id}
                      onClick={() => { setActiveDmId(dm.id); setSelectedChatDMId(dm.id); }}
                    />
                  ))
                )}
              </>
            )}

            {mode === "channel" && (
              MOCK_CHANNELS.map((channel) => (
                <ChannelItem
                  key={channel.id}
                  channel={channel}
                  active={activeChannelId === channel.id}
                  onClick={() => setActiveChannelId(channel.id)}
                />
              ))
            )}
          </div>
        </aside>

        {/* ── Chat Area ─────────────────────────────────────────── */}
        <div className="flex flex-1 flex-col min-w-0 bg-white">

          {/* Chat header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0 bg-white relative z-10 shadow-[0_1px_0_rgba(0,0,0,0.04)]">
            <div className="flex items-center gap-3.5">
              {mode === "dm" ? (
                <>
                  <Avatar
                    src={activeDm.avatarUrl}
                    fallback={activeDm.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                    status={activeDm.online ? "online" : undefined}
                    className="size-10 shadow-sm"
                  />
                  <div>
                    <p className="text-sm text-slate-900 leading-tight">
                      {activeDm.name}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span
                        className={cn(
                          "size-1.5 rounded-full",
                          activeDm.online
                            ? "bg-emerald-400"
                            : "bg-slate-300"
                        )}
                      />
                      <p className="text-xs text-slate-400">
                        {activeDm.role} ·{" "}
                        {activeDm.online ? "Active now" : "Offline"}
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="size-10 rounded-xl bg-[#151936] flex items-center justify-center shadow-sm">
                    <IconHash size={18} className="text-[#f3df27]" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-900 leading-tight">
                      #{activeChannel.name}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      <span className="font-mono">
                        {activeChannel.memberCount}
                      </span>{" "}
                      members · {activeChannel.description}
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* Header actions */}
            <div className="flex items-center gap-1.5">
              {[
                { icon: IconPhone, label: "Voice call" },
                { icon: IconVideo, label: "Video call" },
                { icon: IconDotsVertical, label: "More options" },
              ].map(({ icon: Icon, label }) => (
                <button
                  key={label}
                  type="button"
                  aria-label={label}
                  className="flex size-9 items-center justify-center rounded-xl text-slate-400 border border-slate-100 bg-white hover:bg-slate-50 hover:text-slate-700 hover:border-slate-200 transition-all shadow-sm"
                >
                  <Icon size={15} />
                </button>
              ))}
            </div>
          </div>

          {/* Messages area */}
          <div className="flex-1 overflow-y-auto px-6 py-5 bg-slate-50/25 [scrollbar-width:thin]">
            {groupedMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center select-none">
                <div className="size-16 rounded-2xl bg-white border border-slate-100 flex items-center justify-center mb-4 shadow-sm">
                  <IconMessageCircle size={28} className="text-slate-200" />
                </div>
                <p className="text-sm text-slate-600">No messages yet</p>
                <p className="text-xs text-slate-400 mt-1">
                  Send a message below to start the conversation.
                </p>
              </div>
            ) : (
              <div>
                {groupedMessages.map(
                  ({ msg, showAvatar, showTimestamp, showDayLabel }) => (
                    <div key={msg.id}>
                      {showDayLabel && (
                        <div className="flex items-center gap-3 my-5 select-none">
                          <div className="flex-1 h-px bg-slate-100" />
                          <span className="text-tiny label-caps text-slate-400 px-3 py-1 rounded-full bg-slate-50 border border-slate-100">
                            {formatDayLabel(msg.sentAt)}
                          </span>
                          <div className="flex-1 h-px bg-slate-100" />
                        </div>
                      )}
                      <MessageBubble
                        msg={msg}
                        showAvatar={showAvatar}
                        showTimestamp={showTimestamp}
                      />
                    </div>
                  )
                )}
              </div>
            )}

            {isTyping && <TypingIndicator name={activeDm.name} />}
            <div ref={messagesEndRef} />
          </div>

          {/* Message input */}
          <div className="shrink-0 border-t border-slate-100 px-5 py-3.5 bg-white">
            <div
              className={cn(
                "flex items-end gap-2.5 rounded-2xl border px-4 py-3 transition-all duration-200",
                "border-slate-200 bg-white",
                "focus-within:border-slate-300 focus-within:shadow-[0_0_0_3px_rgba(21,25,54,0.06)]"
              )}
            >
              {/* Attach */}
              <button
                type="button"
                aria-label="Attach file"
                className="shrink-0 mb-0.5 flex size-8 items-center justify-center rounded-xl bg-slate-50 border border-slate-100 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <IconPaperclip size={15} />
              </button>

              {/* Textarea */}
              <textarea
                ref={inputRef}
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Message ${mode === "dm" ? activeDm.name : "#" + activeChannel.name
                  }…`}
                rows={1}
                className="flex-1 resize-none bg-transparent text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none max-h-32 pt-0.5 leading-relaxed"
              />

              {/* Right actions */}
              <div className="flex items-center gap-1 shrink-0 mb-0.5">
                <button
                  type="button"
                  aria-label="Emoji picker"
                  className="flex size-8 items-center justify-center rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  <IconMoodSmile size={16} />
                </button>

                {/* Send — Sunland Yellow when active */}
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={!messageText.trim()}
                  aria-label="Send message"
                  className={cn(
                    "flex size-9 items-center justify-center rounded-xl transition-all duration-200",
                    messageText.trim()
                      ? "bg-[#f3df27] text-[#151936] hover:bg-[#e6d220] shadow-sm"
                      : "bg-slate-100 text-slate-300 cursor-not-allowed"
                  )}
                >
                  <IconSend size={15} />
                </button>
              </div>
            </div>

            <p className="text-center text-tiny label-caps text-slate-400 mt-2">
              ↵ send · Shift+↵ new line
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}