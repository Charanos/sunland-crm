"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  IconMessageCircle,
  IconX,
  IconSend,
  IconSearch,
  IconDotsVertical,
  IconPhoneCall,
  IconVideo,
  IconHash,
  IconChecks
} from "@tabler/icons-react";
import { Avatar } from "@/components/ui/avatar";
import { useUIStore } from "@/store/ui";
import { cn } from "@/lib/utils/cn";
import { usePathname } from "next/navigation";

import { MOCK_DMS, MOCK_CHANNELS } from "@/data/messaging";

// Mock Data
const TABS = ["Direct", "Channels", "Alerts"];

const MOCK_MESSAGES = [
  { id: "m1", sender: "Amina Hassan", text: "Hey! Did you check the new maintenance log for Westlands Tower?", time: "10:24 AM", isMe: false },
  { id: "m2", sender: "You", text: "Just looking at it now. The plumbing issue on 4B right?", time: "10:26 AM", isMe: true },
  { id: "m3", sender: "Amina Hassan", text: "Yes exactly. I've assigned the contractor for ticket #421. Should be fixed by tomorrow.", time: "10:28 AM", isMe: false },
];

export function GlobalChatWidget() {
  const pathname = usePathname();
  const isMessagesPage = pathname?.endsWith("/messages");

  const { chatOpen, toggleChat, closeChat, selectedChatDMId: activeChatId, setSelectedChatDMId: setActiveChatId } = useUIStore();
  const [activeTab, setActiveTab] = useState("Direct");
  const [inputText, setInputText] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const fabRef = useRef<HTMLButtonElement>(null);

  if (isMessagesPage) return null;

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

  // Scroll to bottom when opening a chat
  useEffect(() => {
    if (activeChatId && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [activeChatId, chatOpen]);

  // FAB Spring
  const fabSpring = { type: "spring", stiffness: 300, damping: 25 } as const;

  // Panel Spring
  const panelSpring = { type: "spring", stiffness: 350, damping: 30 } as const;

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
                    <IconX size={20} className="rotate-45" /> {/* Use as back button conceptually */}
                  </button>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Avatar src={MOCK_DMS.find(d => d.id === activeChatId)?.avatarUrl} fallback="A" className="size-8 border border-white/20" />
                      <div className="absolute bottom-0 right-0 size-2.5 rounded-full bg-emerald-400 border-2 border-[#151936]"></div>
                    </div>
                    <div>
                      <h4 className="font-medium leading-none mb-1 text-caption">{MOCK_DMS.find(d => d.id === activeChatId)?.name}</h4>
                      <p className="text-tiny text-white/60 leading-none">Online</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <h3 className="font-medium tracking-tight text-caption">Internal Comms</h3>
                  <p className="text-tiny text-white/60">3 unread messages</p>
                </div>
              )}

              <div className="flex items-center gap-2">
                {activeChatId ? (
                  <>
                    <button className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"><IconPhoneCall size={18} /></button>
                    <button className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"><IconVideo size={18} /></button>
                  </>
                ) : (
                  <>
                    <button className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"><IconSearch size={18} /></button>
                  </>
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
                  <div className="text-center mb-2">
                    <span className="text-slate-400 bg-slate-200/50 px-3 py-1 rounded-full label-caps">Today</span>
                  </div>

                  {MOCK_MESSAGES.map((msg) => (
                    <div key={msg.id} className={cn("flex max-w-[85%]", msg.isMe ? "self-end" : "self-start")}>
                      {!msg.isMe && (
                        <Avatar src={MOCK_DMS[0].avatarUrl} fallback="A" className="size-6 mr-2 mt-auto shrink-0" />
                      )}
                      <div className={cn(
                        "p-2.5 rounded-2xl text-caption shadow-sm leading-relaxed",
                        msg.isMe
                          ? "bg-[#151936] text-white rounded-br-sm"
                          : "bg-white border border-slate-100 text-slate-800 rounded-bl-sm"
                      )}>
                        {msg.text}
                        <div className={cn(
                          "flex items-center justify-end gap-1 mt-1 text-[10px] font-mono",
                          msg.isMe ? "text-white/50" : "text-slate-400"
                        )}>
                          {msg.time}
                          {msg.isMe && <IconChecks size={12} className="text-[#f3df27]" />}
                        </div>
                      </div>
                    </div>
                  ))}
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
                        if (e.key === 'Enter' && inputText.trim()) {
                          setInputText('');
                          // In real app: send message
                        }
                      }}
                    />
                    <button
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
                  {activeTab === "Direct" && MOCK_DMS.map((dm) => (
                    <button
                      key={dm.id}
                      onClick={() => setActiveChatId(dm.id)}
                      className="w-full p-2.5 flex items-center gap-3 hover:bg-slate-50 rounded-xl transition-all hover:shadow-sm border border-transparent hover:border-slate-100 text-left group"
                    >
                      <div className="relative shrink-0">
                        <Avatar src={dm.avatarUrl} fallback={dm.name[0]} className="size-10 border border-slate-100 shadow-sm" />
                        {dm.online && (
                          <div className="absolute bottom-0 right-0 size-3 rounded-full bg-emerald-500 border-2 border-white"></div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center mb-0.5">
                          <h4 className="font-medium text-slate-800 truncate group-hover:text-[#151936] text-caption">{dm.name}</h4>
                          <span className="text-[10px] font-mono text-slate-400">{dm.lastMessageTime}</span>
                        </div>
                        <p className="text-tiny text-slate-500 truncate pr-4">{dm.lastMessage}</p>
                      </div>
                      {dm.unread > 0 && (
                        <div className="shrink-0 size-[18px] rounded-full bg-[#f3df27] flex items-center justify-center text-[10px] font-medium text-[#151936]">
                          {dm.unread}
                        </div>
                      )}
                    </button>
                  ))}

                  {activeTab === "Channels" && MOCK_CHANNELS.map((ch) => (
                    <button
                      key={ch.id}
                      className="w-full p-2.5 flex items-center gap-3 hover:bg-slate-50 rounded-xl transition-all hover:shadow-sm border border-transparent hover:border-slate-100 text-left group"
                    >
                      <div className="size-10 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center shrink-0 border border-slate-200">
                        <IconHash size={18} stroke={2} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-slate-800 truncate group-hover:text-[#151936] text-caption">{ch.name}</h4>
                        <p className="text-tiny text-slate-500 truncate">Latest update in channel...</p>
                      </div>
                      {ch.unread > 0 && (
                        <div className="shrink-0 size-[18px] rounded-full bg-[#f3df27] flex items-center justify-center text-[10px] font-medium text-[#151936]">
                          {ch.unread}
                        </div>
                      )}
                    </button>
                  ))}
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
        {!chatOpen && (
          <div className="absolute top-0 right-0 size-4 bg-[#f3df27] rounded-full border-2 border-[#151936] flex items-center justify-center">
            <span className="text-sm  font-medium text-[#151936]">3</span>
          </div>
        )}
      </motion.button>
    </>
  );
}
