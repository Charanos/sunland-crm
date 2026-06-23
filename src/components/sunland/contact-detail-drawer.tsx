"use client";

import { useEffect, useState } from "react";
import {
  IconX,
  IconMessageCircle,
  IconPhoneCall,
  IconMail,
  IconEdit,
  IconClock,
  IconBuilding,
  IconReceipt2,
  IconLink,
  IconCalendarEvent,
  IconPlus,
  IconTrash,
  IconActivity,
  IconTrendingUp
} from "@tabler/icons-react";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils/cn";
import { useUIStore } from "@/store/ui";
import { Drawer } from "@/components/ui/drawer";
import { formatKES } from "@/lib/utils/format";
import { Contact, ContactInteractionLog, TYPE_LABELS, TYPE_COLORS, STATUS_LABELS, STATUS_COLORS } from "./contacts-board";
import { motion, AnimatePresence } from "framer-motion";

interface ContactDetailDrawerProps {
  contactId: string | null;
  onClose: () => void;
  contactData?: Contact;
  onUpdateContact?: (updated: Contact) => void;
}

export function ContactDetailDrawer({
  contactId,
  onClose,
  contactData,
  onUpdateContact
}: ContactDetailDrawerProps) {
  const { openChat } = useUIStore();
  const [newNote, setNewNote] = useState("");
  const [timeline, setTimeline] = useState<ContactInteractionLog[]>([]);

  // Update internal timeline whenever contactData changes
  useEffect(() => {
    if (contactData) {
      setTimeline(contactData.timeline || []);
    }
  }, [contactData]);

  if (!contactData) return null;

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;

    const newLog: ContactInteractionLog = {
      id: `log-${Date.now()}`,
      date: new Date().toISOString().split("T")[0] + " " + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      type: "message",
      summary: "Admin Note Added",
      details: newNote.trim()
    };

    const updatedTimeline = [newLog, ...timeline];
    setTimeline(updatedTimeline);
    setNewNote("");

    if (onUpdateContact) {
      onUpdateContact({
        ...contactData,
        timeline: updatedTimeline
      });
    }
  };

  const getLogIcon = (type: ContactInteractionLog["type"]) => {
    switch (type) {
      case "call": return <IconPhoneCall size={14} className="text-blue-500" />;
      case "email": return <IconMail size={14} className="text-purple-500" />;
      case "meeting": return <IconCalendarEvent size={14} className="text-amber-500" />;
      case "message": return <IconMessageCircle size={14} className="text-emerald-500" />;
      default: return <IconActivity size={14} className="text-slate-500" />;
    }
  };

  return (
    <Drawer
      open={!!contactId}
      onClose={onClose}
      title="Contact Profile Card"
      width="30rem" // 480px is 30rem
      footer={
        <div className="flex items-center gap-3">
          <button
            onClick={openChat}
            className="flex-1 flex items-center justify-center gap-2 py-2 bg-[#151936] text-white hover:bg-[#1f2552] rounded-xl text-base font-medium transition-colors shadow-sm"
          >
            <IconMessageCircle size={16} />
            <span>Send Message</span>
          </button>
          <a
            href={`tel:${contactData.phone}`}
            className="flex-1 flex items-center justify-center gap-2 py-2 border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-base font-medium transition-colors"
          >
            <IconPhoneCall size={16} />
            <span>Call Contact</span>
          </a>
        </div>
      }
    >
      <div className="space-y-6">

        {/* Profile Card Header */}
        <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-5 flex flex-col items-center text-center">
          <div className="relative mb-3">
            <Avatar
              src={contactData.avatar}
              fallback={contactData.name[0]}
              className="size-20 border-4 border-white shadow-md"
            />
            <span className={cn(
              "absolute bottom-0 right-0 size-4 rounded-full border-2 border-white",
              contactData.status === "active" ? "bg-emerald-500" : contactData.status === "inactive" ? "bg-slate-400" : "bg-red-500"
            )} />
          </div>

          <h3 className="font-medium text-slate-900 leading-snug text-xl">
            {contactData.name}
          </h3>
          <p className="text-base text-slate-400 font-medium mt-0.5 capitalize">
            Assigned Agent: {contactData.assignedAgent || "Unassigned"}
          </p>

          <div className="flex items-center gap-2 mt-3 flex-wrap justify-center">
            <span className={cn("px-2.5 py-0.5 text-sm font-medium rounded-full border", TYPE_COLORS[contactData.type])}>
              {TYPE_LABELS[contactData.type]}
            </span>
            <span className={cn("px-2.5 py-0.5 text-sm font-medium rounded-full border capitalize", STATUS_COLORS[contactData.status])}>
              {STATUS_LABELS[contactData.status]}
            </span>
          </div>

          <div className="w-full border-t border-slate-100 mt-4 pt-4 grid grid-cols-2 gap-2 text-left text-slate-600 text-base">
            <a href={`mailto:${contactData.email}`} className="flex items-center gap-2 hover:text-[#151936] transition-colors truncate">
              <IconMail size={14} className="text-slate-400 shrink-0" />
              <span className="truncate">{contactData.email}</span>
            </a>
            <a href={`tel:${contactData.phone}`} className="flex items-center gap-2 hover:text-[#151936] transition-colors truncate justify-end">
              <IconPhoneCall size={14} className="text-slate-400 shrink-0" />
              <span>{contactData.phone}</span>
            </a>
          </div>
        </div>

        {/* Financial Metrics */}
        <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
          <p className="text-slate-400 mb-3 label-caps">Financial Overview</p>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-emerald-50/40 border border-emerald-100 rounded-xl">
              <span className="text-sm font-medium text-emerald-700 block mb-1">Total Paid (KES)</span>
              <span className="text-emerald-800 tracking-tight leading-none mono-stat">
                {formatKES(contactData.financials.paid)}
              </span>
            </div>
            <div className={cn(
              "p-3 rounded-xl border",
              contactData.financials.arrears > 0 ? "bg-rose-50/40 border-rose-100" : "bg-slate-50/50 border-slate-100"
            )}>
              <span className={cn("text-sm font-medium block mb-1", contactData.financials.arrears > 0 ? "text-rose-700" : "text-slate-500")}>Arrears (KES)</span>
              <span className={cn("text-[18px] font-medium font-mono tracking-tight leading-none", contactData.financials.arrears > 0 ? "text-rose-800" : "text-slate-700")}>
                {formatKES(contactData.financials.arrears)}
              </span>
            </div>
          </div>
          <div className="mt-3 bg-slate-50 border border-slate-100 rounded-xl p-3 flex justify-between items-center body-sm">
            <span className="text-slate-500 font-medium">Estimated Portfolio Value</span>
            <span className="font-mono font-medium text-slate-800">
              {formatKES(contactData.financials.portfolioValue || 0)}
            </span>
          </div>
        </div>

        {/* Property Associations */}
        <div className="space-y-3">
          <p className="text-slate-400 label-caps">Associated Properties</p>
          {contactData.associatedProperties.length > 0 ? (
            <div className="grid grid-cols-1 gap-2">
              {contactData.associatedProperties.map((prop) => (
                <div key={prop.id} className="flex items-center justify-between p-3.5 bg-white border border-slate-100 rounded-xl shadow-sm hover:border-slate-200 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                      <IconBuilding size={16} />
                    </div>
                    <div>
                      <p className="text-base font-medium text-slate-800 leading-snug">{prop.name}</p>
                      <p className="text-sm text-slate-400 capitalize">{prop.role || TYPE_LABELS[contactData.type]}</p>
                    </div>
                  </div>
                  <IconLink size={14} className="text-slate-300" />
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl text-center">
              <p className="text-base text-slate-400 font-medium">No associated properties found.</p>
            </div>
          )}
        </div>

        {/* Engagement Timeline */}
        <div className="space-y-4">
          <p className="text-slate-400 label-caps">Engagement Timeline</p>

          {/* Quick Note Form */}
          <form onSubmit={handleAddNote} className="flex gap-2">
            <input
              type="text"
              placeholder="Add contact note or interaction log..."
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-[#151936]/40 focus:ring-1 focus:ring-[#151936]/10 text-base"
            />
            <button
              type="submit"
              className="px-4 bg-[#f3df27] text-[#151936] hover:bg-[#e6d220] rounded-xl font-medium transition-colors text-base"
            >
              Log
            </button>
          </form>

          {/* Timeline List */}
          <div className="relative pl-3 space-y-4 pt-2">
            <div className="absolute top-2 bottom-2 left-[19px] w-[1px] bg-slate-100" />

            <AnimatePresence initial={false}>
              {timeline.map((log) => (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  className="relative flex gap-4"
                >
                  <div className="size-[14px] rounded-full bg-white border-[3px] border-[#151936] shadow-sm z-10 shrink-0 mt-1" />
                  <div className="flex-1 bg-slate-50/50 border border-slate-100 rounded-xl p-3">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-1.5 text-base font-medium text-slate-800">
                        {getLogIcon(log.type)}
                        <span>{log.summary}</span>
                      </div>
                      <span className="text-sm  text-slate-400 font-mono">{log.date}</span>
                    </div>
                    {log.details && (
                      <p className="text-base text-slate-500 leading-relaxed mt-1">
                        {log.details}
                      </p>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>

        {/* Meta Info */}
        <div className="border-t border-slate-100 pt-4 grid grid-cols-2 gap-4 text-slate-400 label-caps">
          <div>
            <span>Created Date:</span>
            <span className="block text-slate-600 normal-case mt-0.5 mono-data">
              {contactData.createdDate}
            </span>
          </div>
          <div>
            <span>Lead Source:</span>
            <span className="block text-slate-600 capitalize mt-0.5 text-base">
              {contactData.source.replace("_", " ")}
            </span>
          </div>
        </div>

      </div>
    </Drawer>
  );
}
