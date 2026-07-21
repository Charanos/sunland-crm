"use client";

import { useEffect, useState } from "react";
import { IconBriefcase, IconX } from "@tabler/icons-react";
import { cn } from "@/lib/utils/cn";
import type { Lead } from "./pipeline-board";
import { PRIORITY_META, type PipelineLeadPriority } from "./lead-constants";

interface LeadFormModalProps {
  open: boolean;
  entityId: string;
  onClose: () => void;
  onSubmit: (data: Partial<Lead>) => void;
  initialData?: Lead;
}

interface LeadFormData {
  clientName: string;
  email: string;
  phone: string;
  budget: number;
  propertyId: string;
  assignedToId: string;
  priority: PipelineLeadPriority;
  notes: string;
}

const PRIORITY_OPTIONS: PipelineLeadPriority[] = ["high", "medium", "low"];

export function LeadFormModal({ open, entityId, onClose, onSubmit, initialData }: LeadFormModalProps) {
  if (!open) return null;

  return <LeadFormModalContent entityId={entityId} onClose={onClose} onSubmit={onSubmit} initialData={initialData} />;
}

function LeadFormModalContent({
  entityId,
  onClose,
  onSubmit,
  initialData,
}: {
  entityId: string;
  onClose: () => void;
  onSubmit: (data: Partial<Lead>) => void;
  initialData?: Lead;
}) {
  const isEdit = !!initialData;
  const [properties, setProperties] = useState<{ id: string; name: string }[]>([]);
  const [agents, setAgents] = useState<{ id: string; name: string }[]>([]);

  const [formData, setFormData] = useState<LeadFormData>(() =>
    initialData
      ? {
        clientName: initialData.clientName || "",
        email: initialData.email || "",
        phone: initialData.phone || "",
        budget: initialData.budget || 0,
        propertyId: initialData.propertyId || "",
        assignedToId: initialData.assignedToId || "",
        priority: initialData.priority || "medium",
        notes: initialData.notes || "",
      }
      : { clientName: "", email: "", phone: "", budget: 0, propertyId: "", assignedToId: "", priority: "medium", notes: "" },
  );

  useEffect(() => {
    if (!entityId) return;
    fetch(`/api/properties?entityId=${entityId}`)
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d.properties)) setProperties(d.properties.map((p: { id: string; name: string }) => ({ id: p.id, name: p.name }))); })
      .catch(() => { });
    fetch(`/api/identity/users?entityId=${entityId}&role=property_manager`)
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d.users)) setAgents(d.users.map((u: { id: string; name: string }) => ({ id: u.id, name: u.name }))); })
      .catch(() => { });
  }, [entityId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      propertyId: formData.propertyId || null,
      assignedToId: formData.assignedToId || null,
      budget: Number(formData.budget) || 0,
    });
  };

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center animate-fade-in">
      <button aria-label="Close form backdrop" className="absolute inset-0 size-full cursor-default bg-[#151936]/20 backdrop-blur-sm" onClick={onClose} type="button" />

      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-[0_20px_60px_rgba(21,25,54,0.1)] overflow-hidden animate-scale-in max-h-[90vh] flex flex-col">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-[rgba(243,223,39,0.18)] border border-[rgba(243,223,39,0.5)] flex items-center justify-center text-[#151936]">
              <IconBriefcase size={20} stroke={1.5} />
            </div>
            <p className="font-serif text-lg text-slate-900">{isEdit ? "Modify Deal" : "New Deal"}</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
            <IconX size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
          <div>
            <label className="block text-slate-400 mb-1.5 label-caps">Client — required</label>
            {isEdit ? (
              <p className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-100 rounded-xl text-slate-600">{formData.clientName}</p>
            ) : (
              <input required type="text" placeholder="Client or entity name" value={formData.clientName} onChange={(e) => setFormData({ ...formData, clientName: e.target.value })} className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-[#151936]/40 focus:ring-1 focus:ring-[#151936]/10 transition-colors shadow-sm" />
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-400 mb-1.5 label-caps">Phone</label>
              {isEdit ? (
                <p className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-slate-600 mono-data">{formData.phone || "-"}</p>
              ) : (
                <input type="tel" placeholder="+254 7XX XXX XXX" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-[#151936]/40 focus:ring-1 focus:ring-[#151936]/10 transition-colors shadow-sm mono-data" />
              )}
            </div>
            <div>
              <label className="block text-slate-400 mb-1.5 label-caps">Email</label>
              {isEdit ? (
                <p className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-100 rounded-xl text-slate-600 truncate">{formData.email || "-"}</p>
              ) : (
                <input type="email" placeholder="name@domain.com" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-[#151936]/40 focus:ring-1 focus:ring-[#151936]/10 transition-colors shadow-sm" />
              )}
            </div>
          </div>

          <div>
            <label className="block text-slate-400 mb-1.5 label-caps">Property / Listing</label>
            <select value={formData.propertyId} onChange={(e) => setFormData({ ...formData, propertyId: e.target.value })} className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-[#151936]/40 focus:ring-1 focus:ring-[#151936]/10 transition-colors shadow-sm">
              <option value="">None / Other</option>
              {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-400 mb-1.5 label-caps">Value (KES)</label>
              <input type="text" inputMode="numeric" placeholder="25,000,000" value={formData.budget || ""} onChange={(e) => setFormData({ ...formData, budget: Number(e.target.value.replace(/[^0-9]/g, "")) || 0 })} className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-[#151936]/40 focus:ring-1 focus:ring-[#151936]/10 transition-colors shadow-sm mono-data" />
            </div>
            <div>
              <label className="block text-slate-400 mb-1.5 label-caps">Broker</label>
              <select value={formData.assignedToId} onChange={(e) => setFormData({ ...formData, assignedToId: e.target.value })} className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-[#151936]/40 focus:ring-1 focus:ring-[#151936]/10 transition-colors shadow-sm">
                <option value="">Unassigned</option>
                {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          </div>

          <div>
            <p className="text-slate-400 mb-1.5 label-caps">Priority</p>
            <div className="flex gap-2" role="group" aria-label="Priority">
              {PRIORITY_OPTIONS.map((p) => (
                <button key={p} type="button" onClick={() => setFormData({ ...formData, priority: p })} className={cn("flex-1 rounded-xl py-2.5 text-sm font-medium transition-colors", formData.priority === p ? "bg-[#151936] text-white border border-[#151936]" : "bg-white text-slate-600 border border-slate-200")}>
                  {PRIORITY_META[p].label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-slate-400 mb-1.5 label-caps">Notes</label>
            <textarea placeholder="Client is looking for a penthouse. Needs flexible payments." rows={3} value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-[#151936]/40 focus:ring-1 focus:ring-[#151936]/10 transition-colors shadow-sm" />
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-slate-100 sticky bottom-0 bg-white">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">Cancel</button>
            <button type="submit" className="px-5 py-2 text-sm font-medium bg-gradient-to-br from-[#122a20] to-[#1e1b4b] text-white rounded-xl transition-opacity hover:opacity-90 shadow-sm">
              {initialData ? "Save Changes" : "Create Deal"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
