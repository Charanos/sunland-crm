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
  IconActivity,
  IconTrendingUp,
  IconAlertTriangle,
  IconCurrencyDollar,
  IconTag
} from "@tabler/icons-react";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils/cn";
import { useUIStore } from "@/store/ui";
import { Drawer } from "@/components/ui/drawer";
import { formatKES } from "@/lib/utils/format";
import { Lead, PipelineStage, STAGE_LABELS, STAGE_COLORS, getPropertyImage } from "./pipeline-board";
import { motion, AnimatePresence } from "framer-motion";

interface LeadDetailDrawerProps {
  leadId: string | null;
  onClose: () => void;
  leadData?: Lead;
  onUpdateLead?: (updated: Lead) => void;
}

export function LeadDetailDrawer({
  leadId,
  onClose,
  leadData,
  onUpdateLead
}: LeadDetailDrawerProps) {
  const { openChat } = useUIStore();
  const [newNote, setNewNote] = useState("");
  const [timeline, setTimeline] = useState<any[]>([]);

  useEffect(() => {
    if (leadData) {
      setTimeline(leadData.timeline || []);
    }
  }, [leadData]);

  if (!leadData) return null;

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;

    const newLog = {
      id: `log-${Date.now()}`,
      date: new Date().toISOString().split("T")[0] + " " + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      type: "message",
      summary: "Note Added",
      details: newNote.trim()
    };

    const updatedTimeline = [newLog, ...timeline];
    setTimeline(updatedTimeline);
    setNewNote("");

    if (onUpdateLead) {
      onUpdateLead({
        ...leadData,
        timeline: updatedTimeline
      });
    }
  };

  const getLogIcon = (type: string) => {
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
      open={!!leadId}
      onClose={onClose}
      title="Opportunity Details"
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
            href={`tel:${leadData.phone}`}
            className="flex-1 flex items-center justify-center gap-2 py-2 border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-base font-medium transition-colors"
          >
            <IconPhoneCall size={16} />
            <span>Call Lead</span>
          </a>
        </div>
      }
    >
      <div className="space-y-6">

        {/* Property Visual Cover */}
        <div className="relative h-36 w-full rounded-2xl overflow-hidden border border-slate-150 shadow-sm bg-slate-100 shrink-0">
          <img
            src={getPropertyImage(leadData.propertyInterest)}
            alt={leadData.propertyInterest}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent flex items-end p-4">
            <div>
              <p className="text-[#f3df27] label-caps">Property Interest</p>
              <h4 className="text-white text-base  font-medium leading-tight mt-0.5">{leadData.propertyInterest}</h4>
            </div>
          </div>
        </div>

        {/* Profile Header */}
        <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-5 flex flex-col items-center text-center">
          <div className="relative mb-3">
            <Avatar
              fallback={leadData.clientName[0]}
              className="size-20 border-4 border-white shadow-md text-xl bg-[#151936] text-[#f3df27] font-serif font-medium"
            />
          </div>

          <h3 className="font-medium text-slate-900 leading-snug text-xl">
            {leadData.clientName}
          </h3>
          <p className="text-base text-slate-400 font-medium mt-0.5 capitalize">
            Assigned Broker: {leadData.assignedAgent || "Unassigned"}
          </p>

          <div className="flex items-center gap-2 mt-3 flex-wrap justify-center">
            <span className={cn("px-2.5 py-0.5 text-sm font-medium rounded-full border uppercase tracking-wider", STAGE_COLORS[leadData.stage])}>
              {STAGE_LABELS[leadData.stage]}
            </span>
            <span className="px-2.5 py-0.5 text-sm font-medium rounded-full border border-slate-200 bg-white text-slate-600 capitalize">
              Source: {leadData.source}
            </span>
          </div>

          <div className="w-full border-t border-slate-100 mt-4 pt-4 grid grid-cols-2 gap-2 text-left text-slate-600 text-base">
            <a href={`mailto:${leadData.email}`} className="flex items-center gap-2 hover:text-[#151936] transition-colors truncate">
              <IconMail size={14} className="text-slate-400 shrink-0" />
              <span className="truncate">{leadData.email}</span>
            </a>
            <a href={`tel:${leadData.phone}`} className="flex items-center gap-2 hover:text-[#151936] transition-colors truncate justify-end">
              <IconPhoneCall size={14} className="text-slate-400 shrink-0" />
              <span>{leadData.phone}</span>
            </a>
          </div>
        </div>

        {/* Opportunity Metrics */}
        <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4">
          <p className="text-slate-400 leading-none label-caps">Deal Valuation</p>

          <div className="p-4 bg-amber-50/40 border border-amber-100/50 rounded-xl flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-amber-800 block mb-1">Estimated Budget</span>
              <span className="text-slate-800 tracking-tight leading-none mono-stat">
                {formatKES(leadData.budget)}
              </span>
            </div>
            <div className="size-10 rounded-full bg-white flex items-center justify-center text-amber-600 border border-amber-100 shadow-sm mono-data">
              KES
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-50 border border-slate-150 rounded-xl p-3 flex flex-col justify-center gap-1">
              <span className="text-slate-400 label-caps">Property Interest</span>
              <span className="text-base font-medium text-slate-800 truncate flex items-center gap-1.5">
                <IconBuilding size={14} className="text-slate-400 shrink-0" />
                <span className="truncate">{leadData.propertyInterest}</span>
              </span>
            </div>
            <div className="bg-slate-50 border border-slate-150 rounded-xl p-3 flex flex-col justify-center gap-1">
              <span className="text-slate-400 label-caps">Created Date</span>
              <span className="text-slate-800 flex items-center gap-1.5 mono-data">
                <IconCalendarEvent size={14} className="text-slate-400 shrink-0" />
                <span>{leadData.createdDate}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Notes log */}
        {leadData.notes && (
          <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 text-base text-slate-600 leading-relaxed">
            <p className="text-slate-400 mb-2 flex items-center gap-1 label-caps">
              <IconTag size={12} /> Specific Requirements
            </p>
            {leadData.notes}
          </div>
        )}

        {/* Engagement Timeline */}
        <div className="space-y-4">
          <p className="text-slate-400 label-caps">Engagement Timeline</p>

          {/* Quick Note Form */}
          <form onSubmit={handleAddNote} className="flex gap-2">
            <input
              type="text"
              placeholder="Add deal log or interaction update..."
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-[#151936]/40 focus:ring-1 focus:ring-[#151936]/10 text-base"
            />
            <button
              type="submit"
              className="px-4 bg-[#f3df27] text-[#151936] hover:bg-[#e6d220] rounded-xl font-medium transition-colors cursor-pointer text-base"
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

      </div>
    </Drawer>
  );
}
