"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  IconPhoneOff,
  IconVideo,
  IconPlus,
  IconMessageCircle,
  IconArrowLeft,
  IconX,
  IconBell,
  IconBellOff,
  IconTrash,
  IconMicrophone,
  IconMicrophoneOff,
  IconVolume,
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

function formatDuration(sec: number): string {
  const mins = Math.floor(sec / 60);
  const secs = sec % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

// ── Message Bubble ─────────────────────────────────────────────────────────────

interface MessageBubbleProps {
  msg: Message;
  showAvatar: boolean;
  showTimestamp: boolean;
}

function MessageBubble({ msg, showAvatar, showTimestamp }: MessageBubbleProps) {
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
            className="size-7 shadow-xs border border-slate-100"
          />
        )}
      </div>

      <div
        className={cn(
          "flex flex-col gap-0.5 max-w-[68%]",
          msg.isMe ? "items-end" : "items-start"
        )}
      >
        {showAvatar && !msg.isMe && (
          <span className="text-meta-muted-strong ml-1 font-medium">
            {msg.senderName}
          </span>
        )}

        <div
          className={cn(
            "px-4 py-2 rounded-2xl text-body-primary leading-relaxed",
            msg.isMe
              ? "bg-[#151936] text-white rounded-br-sm shadow-[0_2px_8px_rgba(21,25,54,0.1)] font-normal"
              : "bg-white border border-slate-100 text-slate-800 rounded-bl-sm shadow-[0_1px_3px_rgba(0,0,0,0.01)] font-normal"
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
            <span className="font-mono text-meta-muted font-medium">
              {formatMessageTime(msg.sentAt)}
            </span>
            {msg.isMe &&
              (msg.readAt ? (
                <IconCheckFilled size={11} className="text-emerald-500" />
              ) : msg.deliveredAt ? (
                <IconCheckFilled size={11} className="text-slate-350" />
              ) : (
                <IconCheck size={11} className="text-slate-350" />
              ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ── Typing Indicator ──────────────────────────────────────────────────────────

function TypingIndicator({ name }: { name: string }) {
  return (
    <div className="flex items-end gap-2.5 mt-3">
      <div className="size-7 shrink-0" />
      <div className="flex flex-col items-start gap-1">
        <span className="text-meta-muted font-medium ml-1">
          {name} is typing
        </span>
        <div className="bg-white border border-slate-100 shadow-[0_1px_3px_rgba(0,0,0,0.01)] rounded-2xl rounded-bl-sm px-4 py-2.5 flex items-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="size-1.5 rounded-full bg-slate-350 animate-bounce"
              style={{
                animationDelay: `${i * 0.15}s`,
                animationDuration: "1.2s",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── DM Conversation Item ───────────────────────────────────────────────────────

interface ConversationItemProps {
  dm: DmContact;
  active: boolean;
  onClick: () => void;
}

function ConversationItem({ dm, active, onClick }: ConversationItemProps) {
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
          className="size-10 shadow-xs border border-slate-100"
        />
        {dm.unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-[#151936] text-[10px] font-mono text-white font-medium ring-2 ring-white">
            {dm.unread}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1 mb-0.5">
          <p
            className={cn(
              "text-title-primary truncate font-medium transition-colors",
              dm.unread > 0 || active ? "text-slate-900" : "text-slate-700"
            )}
          >
            {dm.name}
          </p>
          <span className="font-mono text-meta-muted font-medium shrink-0">
            {dm.lastMessageTime}
          </span>
        </div>
        <p
          className={cn(
            "text-meta-muted truncate font-normal",
            dm.unread > 0 ? "text-desc-secondary font-medium" : "text-meta-muted"
          )}
        >
          {dm.lastMessage}
        </p>
      </div>
    </button>
  );
}

// ── Channel Item ──────────────────────────────────────────────────────────────

interface ChannelItemProps {
  channel: Channel;
  active: boolean;
  onClick: () => void;
}

function ChannelItem({ channel, active, onClick }: ChannelItemProps) {
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
      {active && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 h-8 w-[3px] rounded-r-full bg-[#151936]" />
      )}

      {/* Channel icon */}
      <div
        className={cn(
          "size-9 shrink-0 rounded-xl flex items-center justify-center transition-all duration-200 border",
          active
            ? "bg-[#151936] text-[#f3df27] border-[#151936] shadow-xs"
            : "bg-slate-100 text-slate-500 border-slate-150"
        )}
      >
        <IconHash size={15} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1 mb-0.5">
          <p
            className={cn(
              "text-title-primary truncate font-medium",
              active ? "text-slate-900" : "text-slate-700"
            )}
          >
            #{channel.name}
          </p>
          {channel.unread > 0 && (
            <span className="flex size-4 items-center justify-center rounded-full bg-[#151936] text-[10px] font-mono text-white font-medium shrink-0">
              {channel.unread}
            </span>
          )}
        </div>
        <p className="text-meta-muted font-mono font-medium">
          {channel.memberCount} members · {channel.lastActivity}
        </p>
      </div>
    </button>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

interface AttachedFile {
  name: string;
  size: string;
  type: string;
  url: string;
}

interface ActiveCall {
  name: string;
  avatarUrl: string;
  type: "voice" | "video";
  status: "ringing" | "connected";
  duration: number;
}

export function MessagesPageContent() {
  const { selectedChatDMId, setSelectedChatDMId } = useUIStore();
  const { pushToast } = useToast();

  // Local Lists for extensibility
  const [dmsList, setDmsList] = useState<DmContact[]>(MOCK_DMS);
  const [channelsList, setChannelsList] = useState<Channel[]>(MOCK_CHANNELS);

  const [mode, setMode] = useState<"dm" | "channel">("dm");
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
  const [mobileShowChat, setMobileShowChat] = useState(false);

  // Functionality overlays and drawers
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  const [isCallMuted, setIsCallMuted] = useState(false);
  const [isCallSpeaker, setIsCallSpeaker] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showMoreDropdown, setShowMoreDropdown] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [attachedFile, setAttachedFile] = useState<AttachedFile | null>(null);

  // New conversation/channel modals
  const [newChatModal, setNewChatModal] = useState<"dm" | "channel" | null>(null);
  const [newDmTargetId, setNewDmTargetId] = useState("");
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelDesc, setNewChannelDesc] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Scroll active chat to view on load or message change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversations, activeDmId, activeChannelId, mode]);

  // Sync selected DM from App State
  useEffect(() => {
    if (selectedChatDMId) {
      const timer = setTimeout(() => {
        setActiveDmId(selectedChatDMId);
        setMode("dm");
        setMobileShowChat(true); // Open details panel on mobile if preset
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [selectedChatDMId]);

  // Retrieve current active record safe helper
  const activeDm = useMemo(
    () => dmsList.find((d) => d.id === activeDmId) || dmsList[0],
    [dmsList, activeDmId]
  );
  const activeChannel = useMemo(
    () => channelsList.find((c) => c.id === activeChannelId) || channelsList[0],
    [channelsList, activeChannelId]
  );

  const activeId = mode === "dm" ? activeDm.id : activeChannel.id;
  const currentMessages = useMemo(
    () => conversations[activeId] ?? [],
    [conversations, activeId]
  );

  // Filters based on query
  const filteredDms = useMemo(
    () =>
      dmsList.filter(
        (d) =>
          d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          d.lastMessage.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    [searchQuery, dmsList]
  );

  const filteredChannels = useMemo(
    () =>
      channelsList.filter(
        (c) =>
          c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.description.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    [searchQuery, channelsList]
  );

  // Outbound Calls Simulated Functionality
  const startCall = (type: "voice" | "video") => {
    setActiveCall({
      name: activeDm.name,
      avatarUrl: activeDm.avatarUrl,
      type,
      status: "ringing",
      duration: 0,
    });
    pushToast({
      tone: "info",
      title: "Calling",
      body: `Connecting outbound ${type} call to ${activeDm.name}...`,
    });
  };

  const handleHangUp = () => {
    setActiveCall(null);
    setIsCallMuted(false);
    setIsCallSpeaker(false);
    pushToast({
      tone: "info",
      title: "Call Ended",
      body: "Disconnected.",
    });
  };

  // Calling Ringing & Connected Timer Trigger
  useEffect(() => {
    let callTimer: NodeJS.Timeout;
    if (activeCall) {
      if (activeCall.status === "ringing") {
        callTimer = setTimeout(() => {
          setActiveCall((prev) => (prev ? { ...prev, status: "connected" } : null));
        }, 1800);
      } else if (activeCall.status === "connected") {
        callTimer = setInterval(() => {
          setActiveCall((prev) => (prev ? { ...prev, duration: prev.duration + 1 } : null));
        }, 1000);
      }
    }
    return () => {
      clearTimeout(callTimer);
      clearInterval(callTimer);
    };
  }, [activeCall?.status]);

  // Handle local file uploads preview
  const handleFileClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setAttachedFile({
      name: file.name,
      size: (file.size / 1024).toFixed(1) + " KB",
      type: file.type,
      url,
    });
  };

  // Dropdown More options commands
  const handleClearHistory = () => {
    setConversations((prev) => ({
      ...prev,
      [activeId]: [],
    }));
    setShowMoreDropdown(false);
    pushToast({
      tone: "info",
      title: "History Cleared",
      body: "All messages deleted successfully.",
    });
  };

  const handleToggleMute = () => {
    setIsMuted((prev) => !prev);
    setShowMoreDropdown(false);
    pushToast({
      tone: "info",
      title: isMuted ? "Unmuted" : "Muted",
      body: isMuted ? "Notifications unmuted." : "Notifications silenced.",
    });
  };

  // Dialog Creation submits
  const handleCreateChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (newChatModal === "dm") {
      if (!newDmTargetId) return;
      setActiveDmId(newDmTargetId);
      setMode("dm");
      setMobileShowChat(true);
      setNewChatModal(null);
      setNewDmTargetId("");
      pushToast({
        tone: "success",
        title: "Chat Opened",
        body: `Selected existing contact conversation.`,
      });
    } else {
      if (!newChannelName.trim()) return;
      const chanId = `c-${Date.now()}`;
      const newChan: Channel = {
        id: chanId,
        name: newChannelName.trim().toLowerCase().replace(/\s+/g, "-"),
        description: newChannelDesc.trim() || "Operations team communication channel.",
        memberCount: 1,
        unread: 0,
        lastActivity: "Just now",
      };
      setChannelsList((prev) => [...prev, newChan]);
      setActiveChannelId(chanId);
      setMode("channel");
      setMobileShowChat(true);
      setNewChatModal(null);
      setNewChannelName("");
      setNewChannelDesc("");
      pushToast({
        tone: "success",
        title: "Channel Created",
        body: `Successfully created and joined #${newChan.name}.`,
      });
    }
  };

  // Message Send actions
  const handleSend = useCallback(() => {
    const content = messageText.trim();
    if (!content && !attachedFile) return;

    const currentId = mode === "dm" ? activeDmId : activeChannelId;

    const newMsg: Message = {
      id: `m-${new Date().getTime()}`,
      conversationId: currentId,
      senderId: "me",
      senderName: "You",
      senderAvatarUrl: "",
      content: content || `Shared file: ${attachedFile?.name}`,
      sentAt: new Date().toISOString(),
      isMe: true,
      type: "text",
    };

    setConversations((prev) => ({
      ...prev,
      [currentId]: [...(prev[currentId] ?? []), newMsg],
    }));

    setMessageText("");
    setAttachedFile(null);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 0);

    // Simulate smart agent replies
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      const reply: Message = {
        id: `m-r-${new Date().getTime()}`,
        conversationId: currentId,
        senderId: mode === "dm" ? activeDmId : "system",
        senderName: mode === "dm" ? activeDm.name : "System Log",
        senderAvatarUrl: mode === "dm" ? activeDm.avatarUrl : "",
        content: mode === "dm"
          ? "I've reviewed the request. I will process the adjustments on the ERP mandate ledger and notify you shortly."
          : `System verified operations update. Status marked on general database.`,
        sentAt: new Date().toISOString(),
        isMe: false,
        type: "text",
      };
      setConversations((prev) => ({
        ...prev,
        [currentId]: [...(prev[currentId] ?? []), reply],
      }));

      pushToast({
        tone: "info",
        title: `Reply received`,
        body: reply.content,
      });
    }, 2000);
  }, [messageText, activeDmId, activeChannelId, mode, activeDm, attachedFile, pushToast]);

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

  const totalUnread = useMemo(
    () =>
      dmsList.reduce((sum, dm) => sum + dm.unread, 0) +
      channelsList.reduce((sum, ch) => sum + ch.unread, 0),
    [dmsList, channelsList]
  );

  const dmUnread = useMemo(() => dmsList.reduce((sum, dm) => sum + dm.unread, 0), [dmsList]);
  const channelUnread = useMemo(() => channelsList.reduce((sum, ch) => sum + ch.unread, 0), [channelsList]);

  return (
    <div className="mx-auto max-w-[98rem] w-full px-4 md:px-6 animate-fade-in relative">
      <div className="flex h-[calc(100vh-140px)] min-h-[550px] rounded-2xl bg-white shadow-[0_4px_24px_rgba(0,0,0,0.04)] overflow-hidden">

        {/* ── Simulated Call overlay screen ── */}
        <AnimatePresence>
          {activeCall && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-[#070b19]/96 backdrop-blur-md z-50 flex flex-col items-center justify-center text-white"
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ type: "spring", damping: 25, stiffness: 350 }}
                className="flex flex-col items-center max-w-sm w-full px-6 text-center"
              >
                <div className="relative mb-8">
                  <div className="absolute inset-0 rounded-full bg-[#f3df27]/10 animate-ping" style={{ animationDuration: '3s' }} />
                  <div className="absolute inset-0 rounded-full bg-[#f3df27]/5 animate-pulse" style={{ animationDuration: '2s' }} />
                  <Avatar
                    src={activeCall.avatarUrl}
                    fallback={activeCall.name.split(" ").map((n) => n[0]).join("")}
                    className="size-24 border-2 border-[#f3df27] shadow-xl relative z-10"
                  />
                </div>

                <h2 className="title-serif text-2xl font-normal text-white mb-2">{activeCall.name}</h2>
                <p className="font-mono text-meta-muted text-slate-400 uppercase tracking-widest mb-10">
                  {activeCall.status === "ringing" ? "Ringing..." : `Connected · ${formatDuration(activeCall.duration)}`}
                </p>

                <div className="flex items-center gap-6">
                  <button
                    type="button"
                    onClick={() => setIsCallMuted(!isCallMuted)}
                    className={cn(
                      "size-12 rounded-xl flex items-center justify-center border transition-all",
                      isCallMuted
                        ? "bg-[#f3df27]/20 border-[#f3df27]/30 text-[#f3df27]"
                        : "bg-white/5 border-white/10 text-slate-350 hover:bg-white/10"
                    )}
                    aria-label={isCallMuted ? "Unmute" : "Mute"}
                  >
                    {isCallMuted ? <IconMicrophoneOff size={20} /> : <IconMicrophone size={20} />}
                  </button>

                  <button
                    type="button"
                    onClick={handleHangUp}
                    className="size-14 rounded-2xl bg-rose-500 hover:bg-rose-600 text-white flex items-center justify-center shadow-lg hover:scale-105 transition-all"
                    aria-label="Hang up"
                  >
                    <IconPhoneOff size={24} />
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsCallSpeaker(!isCallSpeaker)}
                    className={cn(
                      "size-12 rounded-xl flex items-center justify-center border transition-all",
                      isCallSpeaker
                        ? "bg-[#f3df27]/20 border-[#f3df27]/30 text-[#f3df27]"
                        : "bg-white/5 border-white/10 text-slate-350 hover:bg-white/10"
                    )}
                    aria-label="Speaker"
                  >
                    {isCallSpeaker ? <IconVolume size={20} /> : <IconVolume size={20} />}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Left Sidebar (List View) ── */}
        <aside
          className={cn(
            "w-full md:w-80 shrink-0 flex flex-col bg-slate-50/15 transition-all duration-300 shadow-[inset_-1px_0_0_rgba(0,0,0,0.03)]",
            mobileShowChat ? "hidden md:flex" : "flex"
          )}
        >
          {/* Header Row: Search Input & Add Button side-by-side */}
          <div className="px-4 pt-4 pb-2 flex items-center gap-2">
            <div className="relative flex-1 flex items-center bg-slate-100/50 hover:bg-slate-100 focus-within:bg-white focus-within:ring-2 focus-within:ring-[#151936]/5 rounded-xl transition-all">
              <IconSearch
                size={14}
                className="absolute left-3.5 text-slate-400 pointer-events-none"
              />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-9 bg-transparent pl-10 pr-9 text-caption text-slate-800 placeholder:text-slate-400 focus:outline-none transition-all font-normal"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 p-0.5 rounded-full text-slate-400 hover:text-slate-650 transition-colors"
                  aria-label="Clear search"
                >
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

          {/* Mode Tabs: Structured like the Finance Dashboard Tab Nav */}
          <div className="flex items-center gap-4 px-4 py-4 border-b border-slate-100">
            <button
              type="button"
              onClick={() => setMode("dm")}
              className={cn(
                "px-3 py-1 text-caption rounded-lg transition-all duration-200 font-medium relative",
                mode === "dm"
                  ? "bg-[#151936] text-white shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              )}
            >
              Direct
              {dmUnread > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 text-tiny font-mono rounded-full bg-[#f3df27] text-[#151936] font-medium">
                  {dmUnread}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setMode("channel")}
              className={cn(
                "px-3 py-1 text-caption rounded-lg transition-all duration-200 font-medium relative",
                mode === "channel"
                  ? "bg-[#151936] text-white shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              )}
            >
              Channels
              {channelUnread > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 text-tiny font-mono rounded-full bg-[#f3df27] text-[#151936] font-medium">
                  {channelUnread}
                </span>
              )}
            </button>
          </div>

          {/* Conversation list container with layout animations */}
          <motion.div
            layout
            className="flex-1 overflow-y-auto p-2.5 space-y-0.5 [scrollbar-width:thin]"
          >
            {mode === "dm" ? (
              filteredDms.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center select-none">
                  <div className="size-10 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
                    <IconMessageCircle size={18} className="text-slate-350" />
                  </div>
                  <p className="text-caption text-slate-400 font-medium">No chats found</p>
                </div>
              ) : (
                filteredDms.map((dm) => (
                  <motion.div key={dm.id} layout="position">
                    <ConversationItem
                      dm={dm}
                      active={activeDmId === dm.id}
                      onClick={() => {
                        setActiveDmId(dm.id);
                        setSelectedChatDMId(dm.id, false); // sync store state silently without floating chat
                        setMobileShowChat(true);
                      }}
                    />
                  </motion.div>
                ))
              )
            ) : filteredChannels.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center select-none">
                <div className="size-10 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
                  <IconHash size={18} className="text-slate-355" />
                </div>
                <p className="text-caption text-slate-400 font-medium">No channels found</p>
              </div>
            ) : (
              filteredChannels.map((channel) => (
                <motion.div key={channel.id} layout="position">
                  <ChannelItem
                    channel={channel}
                    active={activeChannelId === channel.id}
                    onClick={() => {
                      setActiveChannelId(channel.id);
                      setMobileShowChat(true);
                    }}
                  />
                </motion.div>
              ))
            )}
          </motion.div>
        </aside>

        {/* ── Right Chat Area (Details View) ── */}
        <div
          className={cn(
            "flex flex-1 flex-col min-w-0 bg-white transition-all duration-300",
            mobileShowChat ? "flex" : "hidden md:flex"
          )}
        >
          {/* Header section (borderless) */}
          <div className="flex items-center justify-between px-6 py-4 bg-white shrink-0 relative z-10 shadow-[0_1px_0_rgba(0,0,0,0.01)]">
            <div className="flex items-center gap-3.5 min-w-0">
              {/* Responsive Back Arrow */}
              <button
                type="button"
                onClick={() => setMobileShowChat(false)}
                className="md:hidden p-1.5 -ml-1 rounded-xl hover:bg-slate-100 text-slate-500 transition-colors"
                aria-label="Back to messages list"
              >
                <IconArrowLeft size={18} />
              </button>

              {mode === "dm" ? (
                <>
                  <Avatar
                    src={activeDm.avatarUrl}
                    fallback={activeDm.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                    status={activeDm.online ? "online" : undefined}
                    className="size-10 shadow-xs border border-slate-100"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-title-primary leading-tight font-medium truncate">
                        {activeDm.name}
                      </p>
                      {isMuted && <IconBellOff size={11} className="text-slate-400" />}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span
                        className={cn(
                          "size-1.5 rounded-full",
                          activeDm.online ? "bg-emerald-400" : "bg-slate-300"
                        )}
                      />
                      <p className="text-meta-muted font-medium truncate">
                        {activeDm.role} · {activeDm.online ? "Active now" : "Offline"}
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="size-10 rounded-xl bg-[#151936] flex items-center justify-center shadow-xs border border-[#151936]">
                    <IconHash size={18} className="text-[#f3df27]" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-title-primary leading-tight font-medium truncate">
                        #{activeChannel.name}
                      </p>
                      {isMuted && <IconBellOff size={11} className="text-slate-400" />}
                    </div>
                    <p className="text-meta-muted mt-0.5 font-medium truncate">
                      <span className="font-mono">{activeChannel.memberCount}</span> members · {activeChannel.description}
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* Header calling & options actions */}
            <div className="flex items-center gap-1.5 relative">
              {mode === "dm" && (
                <>
                  <button
                    type="button"
                    onClick={() => startCall("voice")}
                    aria-label="Voice Call"
                    className="flex size-9 items-center justify-center rounded-xl text-slate-500 border border-slate-200/60 bg-white hover:bg-slate-50 hover:text-slate-800 transition-all shadow-xs"
                  >
                    <IconPhone size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => startCall("video")}
                    aria-label="Video Call"
                    className="flex size-9 items-center justify-center rounded-xl text-slate-500 border border-slate-200/60 bg-white hover:bg-slate-50 hover:text-slate-800 transition-all shadow-xs"
                  >
                    <IconVideo size={15} />
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={() => setShowMoreDropdown(!showMoreDropdown)}
                aria-label="More Options"
                className="flex size-9 items-center justify-center rounded-xl text-slate-500 border border-slate-200/60 bg-white hover:bg-slate-50 hover:text-slate-800 transition-all shadow-xs"
              >
                <IconDotsVertical size={15} />
              </button>

              {/* Options dropdown menu */}
              <AnimatePresence>
                {showMoreDropdown && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -5 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -5 }}
                    transition={{ duration: 0.12 }}
                    className="absolute right-0 top-11 w-44 rounded-xl border border-slate-100 bg-white p-1.5 shadow-xl z-30"
                  >
                    <button
                      type="button"
                      onClick={handleToggleMute}
                      className="text-body-primary flex items-center gap-2 w-full px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors font-medium text-left"
                    >
                      {isMuted ? <IconBell size={14} /> : <IconBellOff size={14} />}
                      {isMuted ? "Unmute Alerts" : "Mute Alerts"}
                    </button>
                    <button
                      type="button"
                      onClick={handleClearHistory}
                      className="text-body-primary text-red-600 flex items-center gap-2 w-full px-3 py-2 rounded-lg hover:bg-red-50 transition-colors font-medium text-left"
                    >
                      <IconTrash size={14} />
                      Clear History
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Messages feed */}
          <div className="flex-1 overflow-y-auto px-6 py-5 bg-[#fcfcfc] [scrollbar-width:thin]">
            {groupedMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center select-none">
                <div className="size-16 rounded-2xl bg-white border border-slate-100 flex items-center justify-center mb-4 shadow-xs">
                  <IconMessageCircle size={28} className="text-slate-200" />
                </div>
                <p className="text-body-primary font-medium">No messages yet</p>
                <p className="text-meta-muted mt-1 font-medium">
                  Send a message below to start the conversation.
                </p>
              </div>
            ) : (
              <motion.div layout="position">
                {groupedMessages.map(
                  ({ msg, showAvatar, showTimestamp, showDayLabel }) => (
                    <div key={msg.id}>
                      {showDayLabel && (
                        <div className="flex items-center gap-3 my-5 select-none">
                          <div className="flex-1 h-px bg-slate-100/50" />
                          <span className="text-meta-muted px-3 py-1 rounded-full bg-white border border-slate-100 font-medium shadow-[0_1px_2px_rgba(0,0,0,0.01)]">
                            {formatDayLabel(msg.sentAt)}
                          </span>
                          <div className="flex-1 h-px bg-slate-100/50" />
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
              </motion.div>
            )}

            {isTyping && <TypingIndicator name={mode === "dm" ? activeDm.name : "System Log"} />}
            <div ref={messagesEndRef} />
          </div>

          {/* Attachments preview banner */}
          {attachedFile && (
            <div className="px-5 py-2 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3 animate-fade-in shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                {attachedFile.type.startsWith("image/") ? (
                  <img
                    src={attachedFile.url}
                    alt="Upload preview"
                    className="size-9 rounded-lg object-cover border border-slate-200 shadow-xs"
                  />
                ) : (
                  <div className="size-9 rounded-lg bg-slate-200 text-slate-500 flex items-center justify-center text-tiny font-mono font-medium shrink-0 border border-slate-250">
                    FILE
                  </div>
                )}
                <div className="min-w-0 text-left">
                  <p className="text-body-primary truncate font-medium">{attachedFile.name}</p>
                  <p className="text-meta-muted font-mono font-medium">{attachedFile.size}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAttachedFile(null)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-655 hover:bg-slate-200/50 transition-colors"
                aria-label="Remove attachment"
              >
                <IconX size={14} />
              </button>
            </div>
          )}

          {/* Text input area (borderless container with organic input) */}
          <div className="shrink-0 px-5 py-3.5 bg-white relative">

            {/* Emoji popover drawer */}
            <AnimatePresence>
              {showEmojiPicker && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 5 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 5 }}
                  transition={{ duration: 0.12 }}
                  className="absolute bottom-16 right-6 bg-white border border-slate-200/80 rounded-2xl shadow-xl p-3 z-40 max-w-[240px]"
                >
                  <div className="grid grid-cols-6 gap-1.5 text-lg">
                    {["😀", "😂", "😍", "👍", "🎉", "🔥", "🚀", "❤️", "🙌", "✨", "👀", "💡", "👏", "✔️", "❌", "🌟", "⭐", "📅"].map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => {
                          setMessageText((prev) => prev + emoji);
                          setShowEmojiPicker(false);
                          inputRef.current?.focus();
                        }}
                        className="size-8 rounded-lg flex items-center justify-center hover:bg-slate-100 transition-colors"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div
              className={cn(
                "flex items-end gap-2.5 rounded-2xl px-4 py-2.5 bg-slate-100/50 hover:bg-slate-100/80",
                "focus-within:bg-white focus-within:ring-2 focus-within:ring-[#151936]/5 transition-all duration-200"
              )}
            >
              {/* Attach File Button */}
              <button
                type="button"
                onClick={handleFileClick}
                aria-label="Attach file"
                className="shrink-0 mb-0.5 flex size-8 items-center justify-center rounded-xl bg-white text-slate-400 hover:text-slate-655 hover:bg-slate-50 transition-all border border-slate-150"
              >
                <IconPaperclip size={15} />
              </button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
              />

              {/* Textarea field */}
              <textarea
                ref={inputRef}
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Message ${mode === "dm" ? activeDm.name : "#" + activeChannel.name}…`}
                rows={1}
                className="flex-1 resize-none bg-transparent text-body-primary placeholder:text-slate-400 focus:outline-none max-h-32 pt-0.5 leading-relaxed font-normal"
              />

              {/* Input right hand controls */}
              <div className="flex items-center gap-1 shrink-0 mb-0.5">
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  aria-label="Emoji picker"
                  className={cn(
                    "flex size-8 items-center justify-center rounded-xl transition-colors",
                    showEmojiPicker ? "bg-slate-200 text-slate-700" : "text-slate-400 hover:text-[#151936] hover:bg-slate-50"
                  )}
                >
                  <IconMoodSmile size={16} />
                </button>

                {/* Send button */}
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={!messageText.trim() && !attachedFile}
                  aria-label="Send message"
                  className={cn(
                    "flex size-9 items-center justify-center rounded-xl transition-all duration-200",
                    messageText.trim() || attachedFile
                      ? "bg-[#f3df27] text-[#151936] hover:bg-[#e6d220] shadow-xs animate-pulse-once"
                      : "bg-slate-100 text-slate-350 cursor-not-allowed border border-slate-150"
                  )}
                >
                  <IconSend size={15} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Dialog Create Chat/Channel popup (refined light modal) ── */}
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
                {/* Modal Header (Clean Light Design) */}
                <div className="p-6 pb-4 flex items-center justify-between border-b border-slate-50">
                  <h3 className="text-heading-primary">
                    {newChatModal === "dm" ? "New Direct Message" : "Create New Channel"}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setNewChatModal(null)}
                    className="p-1 rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-700 transition-all"
                    aria-label="Close modal"
                  >
                    <IconX size={16} />
                  </button>
                </div>

                {/* Form fields */}
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
                        {dmsList.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} · {c.role}
                          </option>
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
                          rows={2.5}
                          className="w-full p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 text-body-primary placeholder:text-slate-400 focus:outline-none focus:border-[#151936] focus:bg-white transition-all resize-none font-normal"
                        />
                      </div>
                    </>
                  )}

                  <div className="flex justify-end gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setNewChatModal(null)}
                      className="h-10 px-4 rounded-xl border border-slate-200 text-desc-secondary hover:bg-slate-50 transition-all font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="h-10 px-5 rounded-xl bg-[#f3df27] text-[#151936] hover:bg-[#e6d220] transition-all font-medium shadow-xs"
                    >
                      Create
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