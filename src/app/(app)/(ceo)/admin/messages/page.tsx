"use client";

import { useState } from "react";
import { IconMessageCircle, IconHash, IconSearch, IconPhoneCall, IconVideo, IconDotsVertical, IconSend, IconChecks } from "@tabler/icons-react";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils/cn";

// Mock Data
const MOCK_DMS = [
  { id: "dm1", name: "Amina Hassan", role: "Property Manager", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=faces", lastMessage: "I've assigned the contractor for ticket #421.", unread: 2, online: true },
  { id: "dm2", name: "James Mutua", role: "Head of BD", avatar: "https://images.unsplash.com/photo-1506277886164-e25aa3f4ef7f?w=100&h=100&fit=crop&crop=faces", lastMessage: "Can we review the Muthaiga lease?", unread: 0, online: true },
  { id: "dm3", name: "Grace Omondi", role: "Finance Officer", avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=100&h=100&fit=crop&crop=faces", lastMessage: "Payment for KES 150k received.", unread: 0, online: false },
];

const MOCK_MESSAGES = [
  { id: "m1", sender: "Amina Hassan", text: "Hey! Did you check the new maintenance log for Westlands Tower?", time: "10:24 AM", isMe: false },
  { id: "m2", sender: "You", text: "Just looking at it now. The plumbing issue on 4B right?", time: "10:26 AM", isMe: true },
  { id: "m3", sender: "Amina Hassan", text: "Yes exactly. I've assigned the contractor for ticket #421. Should be fixed by tomorrow.", time: "10:28 AM", isMe: false },
];

export default function MessagesPage() {
  const [activeChatId, setActiveChatId] = useState<string>("dm1");
  const [inputText, setInputText] = useState("");

  const activeChat = MOCK_DMS.find(d => d.id === activeChatId) || MOCK_DMS[0];

  return (
    <div className="flex flex-col h-[calc(100vh-140px)]">
      <div className="mb-6">
        <h1 className="text-3xl font-normal font-serif tracking-tight text-slate-900">Internal Communications</h1>
        <p className="text-slate-500 mt-1">Direct messages and team channels.</p>
      </div>

      <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex">
        {/* Sidebar */}
        <div className="w-[320px] border-r border-slate-100 flex flex-col shrink-0">
          <div className="p-4 border-b border-slate-100">
            <div className="relative">
              <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="Search messages..."
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-base focus:outline-none focus:border-[#151936]/30 transition-colors"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-3">
            <h4 className="text-slate-400 mb-2 px-3 label-caps">Direct Messages</h4>
            <div className="space-y-1">
              {MOCK_DMS.map((dm) => (
                <button
                  key={dm.id}
                  onClick={() => setActiveChatId(dm.id)}
                  className={cn(
                    "w-full p-3 flex items-center gap-3 rounded-xl transition-colors text-left group",
                    activeChatId === dm.id ? "bg-slate-100" : "hover:bg-slate-50"
                  )}
                >
                  <div className="relative shrink-0">
                    <Avatar src={dm.avatar} fallback={dm.name[0]} className="size-10 border border-slate-200" />
                    {dm.online && (
                      <div className="absolute bottom-0 right-0 size-3 rounded-full bg-emerald-500 border-2 border-white"></div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-0.5">
                      <h4 className={cn("text-[14px] font-medium truncate transition-colors", activeChatId === dm.id ? "text-[#151936]" : "text-slate-700")}>{dm.name}</h4>
                      <span className="text-sm text-slate-400">10:28</span>
                    </div>
                    <p className={cn("text-base truncate pr-2", activeChatId === dm.id ? "text-slate-600" : "text-slate-500")}>{dm.lastMessage}</p>
                  </div>
                  {dm.unread > 0 && activeChatId !== dm.id && (
                    <div className="shrink-0 size-5 rounded-full bg-[#f3df27] flex items-center justify-center text-sm  font-medium text-[#151936]">
                      {dm.unread}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col bg-slate-50/50">
          {/* Header */}
          <div className="h-[72px] px-6 border-b border-slate-100 bg-white flex items-center justify-between shrink-0">
            <div className="flex items-center gap-4">
              <Avatar src={activeChat.avatar} fallback={activeChat.name[0]} className="size-12 border border-slate-200" />
              <div>
                <h3 className="font-medium text-slate-900 text-lg">{activeChat.name}</h3>
                <p className="text-base text-emerald-600 flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-emerald-500"></span> Online
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button className="p-2 text-slate-400 hover:text-[#151936] hover:bg-slate-100 rounded-lg transition-colors"><IconPhoneCall size={20} /></button>
              <button className="p-2 text-slate-400 hover:text-[#151936] hover:bg-slate-100 rounded-lg transition-colors"><IconVideo size={20} /></button>
              <button className="p-2 text-slate-400 hover:text-[#151936] hover:bg-slate-100 rounded-lg transition-colors ml-2"><IconDotsVertical size={20} /></button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 custom-scrollbar">
            <div className="text-center my-4">
              <span className="text-sm font-medium text-slate-500 bg-slate-200/50 px-4 py-1.5 rounded-full">Today, June 18th</span>
            </div>

            {MOCK_MESSAGES.map((msg) => (
              <div key={msg.id} className={cn("flex max-w-[70%]", msg.isMe ? "self-end" : "self-start")}>
                {!msg.isMe && (
                  <Avatar src={activeChat.avatar} fallback="A" className="size-8 mr-3 mt-auto shrink-0" />
                )}
                <div className={cn(
                  "p-4 rounded-[20px] text-[14px] shadow-sm leading-relaxed",
                  msg.isMe
                    ? "bg-[#151936] text-white rounded-br-sm"
                    : "bg-white border border-slate-100 text-slate-800 rounded-bl-sm"
                )}>
                  {msg.text}
                  <div className={cn(
                    "flex items-center justify-end gap-1 mt-2 text-[11px]",
                    msg.isMe ? "text-white/50" : "text-slate-400"
                  )}>
                    {msg.time}
                    {msg.isMe && <IconChecks size={16} className="text-[#f3df27]" />}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Input Area */}
          <div className="p-4 bg-white border-t border-slate-100 shrink-0">
            <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-2xl p-2 pr-3 focus-within:border-[#151936]/40 transition-colors shadow-inner">
              <input
                type="text"
                placeholder={`Message ${activeChat.name}...`}
                className="flex-1 bg-transparent px-3 py-2 text-slate-800 focus:outline-none placeholder:text-slate-400 body-md"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
              />
              <button
                className={cn(
                  "size-10 rounded-xl flex items-center justify-center transition-colors shadow-sm",
                  inputText.trim() ? "bg-[#f3df27] text-[#151936] hover:bg-[#e6d220]" : "bg-slate-200 text-slate-400"
                )}
              >
                <IconSend size={20} className={inputText.trim() ? "translate-x-[-1px] translate-y-[1px]" : ""} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
