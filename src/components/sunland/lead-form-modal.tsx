"use client";

import { useState } from "react";
import { IconX, IconTrendingUp } from "@tabler/icons-react";
import { Lead, PipelineStage, PipelineSource } from "./pipeline-board";

interface LeadFormModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: Partial<Lead>) => void;
  initialData?: Lead;
}

interface LeadFormData {
  clientName: string;
  email: string;
  phone: string;
  budget: number;
  propertyInterest: string;
  source: PipelineSource;
  stage: PipelineStage;
  assignedAgent: string;
  notes: string;
}

const STAGES: { value: PipelineStage; label: string }[] = [
  { value: "inquiry", label: "Inquiry" },
  { value: "qualification", label: "Qualification" },
  { value: "viewing", label: "Viewing" },
  { value: "offer", label: "Offer" },
  { value: "negotiation", label: "Negotiation" },
  { value: "closed_won", label: "Closed Won" },
  { value: "closed_lost", label: "Closed Lost" },
];

const SOURCES: { value: PipelineSource; label: string }[] = [
  { value: "referral", label: "Referral" },
  { value: "walk_in", label: "Walk-In" },
  { value: "website", label: "Website" },
  { value: "social_media", label: "Social Media" },
  { value: "cold_call", label: "Cold Call" },
  { value: "existing_client", label: "Existing Client" },
  { value: "partner", label: "Partner" },
  { value: "exhibition", label: "Exhibition" },
];

const PROPERTIES = [
  "Runda Grove Villa",
  "Westlands Tower 4B",
  "Karen Ridge House",
  "Upper Hill Plaza",
  "Kilimani Heights",
  "Lavington Gardens",
  "Riverside Haven",
  "Muthaiga Grand",
  "Gigiri Diplomatic",
  "None / Other"
];

export function LeadFormModal({ open, onClose, onSubmit, initialData }: LeadFormModalProps) {
  if (!open) return null;

  return (
    <LeadFormModalContent
      onClose={onClose}
      onSubmit={onSubmit}
      initialData={initialData}
    />
  );
}

function LeadFormModalContent({
  onClose,
  onSubmit,
  initialData,
}: {
  onClose: () => void;
  onSubmit: (data: Partial<Lead>) => void;
  initialData?: Lead;
}) {
  const [formData, setFormData] = useState<LeadFormData>(() => {
    if (initialData) {
      return {
        clientName: initialData.clientName || "",
        email: initialData.email || "",
        phone: initialData.phone || "",
        budget: initialData.budget || 0,
        propertyInterest: initialData.propertyInterest || "Runda Grove Villa",
        source: initialData.source || "website",
        stage: initialData.stage || "inquiry",
        assignedAgent: initialData.assignedAgent || "Amina Wanjiku",
        notes: initialData.notes || "",
      };
    }
    return {
      clientName: "",
      email: "",
      phone: "",
      budget: 0,
      propertyInterest: "Runda Grove Villa",
      source: "website",
      stage: "inquiry",
      assignedAgent: "Amina Wanjiku",
      notes: "",
    };
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      budget: Number(formData.budget) || 0,
    });
  };

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center animate-fade-in">
      <button
        aria-label="Close form backdrop"
        className="absolute inset-0 size-full cursor-default bg-[#151936]/20 backdrop-blur-sm"
        onClick={onClose}
        type="button"
      />

      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-[0_20px_60px_rgba(21,25,54,0.1)] overflow-hidden animate-scale-in max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-white flex items-center justify-center text-[#151936] border border-slate-200 shadow-sm">
              <IconTrendingUp size={20} stroke={1.5} />
            </div>
            <div>
              <h2 className="font-medium text-slate-900 tracking-tight text-lg">
                {initialData ? "Modify Deal Status" : "Log New CRM Opportunity"}
              </h2>
              <p className="text-base text-slate-400 mt-0.5">Enlist leads, budget ranges, and property links.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <IconX size={20} />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar">

          <div className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-slate-400 mb-1.5 label-caps">Client / Organization Name</label>
              <input
                required
                type="text"
                placeholder="e.g. James Mwangi or Embacassy Holdings"
                value={formData.clientName}
                onChange={e => setFormData({ ...formData, clientName: e.target.value })}
                className="w-full px-3.5 py-2.5 text-base bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-[#151936]/40 focus:ring-1 focus:ring-[#151936]/10 transition-colors shadow-sm"
              />
            </div>

            {/* Email & Phone */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-400 mb-1.5 label-caps">Email Address</label>
                <input
                  required
                  type="email"
                  placeholder="name@domain.com"
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-base bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-[#151936]/40 focus:ring-1 focus:ring-[#151936]/10 transition-colors shadow-sm"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1.5 label-caps">Phone Number</label>
                <input
                  required
                  type="tel"
                  placeholder="+254 7XX XXX XXX"
                  value={formData.phone}
                  onChange={e => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-[#151936]/40 focus:ring-1 focus:ring-[#151936]/10 transition-colors shadow-sm mono-data"
                />
              </div>
            </div>

            {/* Property Interest & Budget */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-400 mb-1.5 label-caps">Property of Interest</label>
                <select
                  value={formData.propertyInterest}
                  onChange={e => setFormData({ ...formData, propertyInterest: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-base bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-[#151936]/40 focus:ring-1 focus:ring-[#151936]/10 transition-colors shadow-sm"
                >
                  {PROPERTIES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-slate-400 mb-1.5 label-caps">Estimated Budget (KES)</label>
                <input
                  required
                  type="number"
                  placeholder="Budget KES"
                  value={formData.budget || ""}
                  onChange={e => setFormData({ ...formData, budget: Number(e.target.value) || 0 })}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-[#151936]/40 focus:ring-1 focus:ring-[#151936]/10 transition-colors shadow-sm mono-data"
                />
              </div>
            </div>

            {/* Stage & Source */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-400 mb-1.5 label-caps">Deal Stage</label>
                <select
                  value={formData.stage}
                  onChange={e => setFormData({ ...formData, stage: e.target.value as PipelineStage })}
                  className="w-full px-3.5 py-2.5 text-base bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-[#151936]/40 focus:ring-1 focus:ring-[#151936]/10 transition-colors shadow-sm"
                >
                  {STAGES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-slate-400 mb-1.5 label-caps">Lead Source</label>
                <select
                  value={formData.source}
                  onChange={e => setFormData({ ...formData, source: e.target.value as PipelineSource })}
                  className="w-full px-3.5 py-2.5 text-base bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-[#151936]/40 focus:ring-1 focus:ring-[#151936]/10 transition-colors shadow-sm"
                >
                  {SOURCES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
            </div>

            {/* Agent */}
            <div>
              <label className="block text-slate-400 mb-1.5 label-caps">Assigned Agent</label>
              <select
                value={formData.assignedAgent}
                onChange={e => setFormData({ ...formData, assignedAgent: e.target.value })}
                className="w-full px-3.5 py-2.5 text-base bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-[#151936]/40 focus:ring-1 focus:ring-[#151936]/10 transition-colors shadow-sm"
              >
                <option value="Amina Wanjiku">Amina Wanjiku (Broker)</option>
                <option value="John Mwangi">John Mwangi (Broker)</option>
                <option value="CEO">CEO / Admin</option>
              </select>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-slate-400 mb-1.5 label-caps">Notes & Specific Requests</label>
              <textarea
                placeholder="Client is looking for a penthouse. Needs flexible payments."
                rows={3}
                value={formData.notes}
                onChange={e => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-3.5 py-2.5 text-base bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-[#151936]/40 focus:ring-1 focus:ring-[#151936]/10 transition-colors shadow-sm"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="pt-4 flex justify-end gap-3 border-t border-slate-100 sticky bottom-0 bg-white">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-base font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-base font-medium bg-[#f3df27] text-[#151936] hover:bg-[#e6d220] rounded-xl transition-colors shadow-sm"
            >
              {initialData ? "Save Changes" : "Create Deal"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
