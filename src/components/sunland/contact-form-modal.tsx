"use client";

import { useEffect, useState } from "react";
import { IconUserCircle, IconX } from "@tabler/icons-react";
import { cn } from "@/lib/utils/cn";
import type { Contact } from "./contacts-board";
import { CONTACT_TYPE_OPTIONS, TYPE_META, type ContactType } from "./contact-constants";

interface ContactFormPayload {
  displayName: string;
  type: ContactType;
  companyName?: string | null;
  email?: string | null;
  phone?: string | null;
  source?: string | null;
  assignedToId?: string | null;
}

interface ContactFormModalProps {
  open: boolean;
  entityId: string;
  onClose: () => void;
  onSubmit: (data: ContactFormPayload) => void;
  initialData?: Contact;
}

export function ContactFormModal({ open, entityId, onClose, onSubmit, initialData }: ContactFormModalProps) {
  if (!open) return null;
  return <ContactFormModalContent entityId={entityId} onClose={onClose} onSubmit={onSubmit} initialData={initialData} />;
}

function ContactFormModalContent({
  entityId,
  onClose,
  onSubmit,
  initialData,
}: {
  entityId: string;
  onClose: () => void;
  onSubmit: (data: ContactFormPayload) => void;
  initialData?: Contact;
}) {
  const isEdit = !!initialData;
  const [agents, setAgents] = useState<{ id: string; name: string }[]>([]);

  const [formData, setFormData] = useState<ContactFormPayload>(() =>
    initialData
      ? {
        displayName: initialData.displayName,
        type: initialData.type,
        companyName: initialData.companyName ?? "",
        email: initialData.email ?? "",
        phone: initialData.phone ?? "",
        source: initialData.source ?? "",
        assignedToId: initialData.assignedToId ?? "",
      }
      : { displayName: "", type: "buyer", companyName: "", email: "", phone: "", source: "", assignedToId: "" },
  );

  useEffect(() => {
    if (!entityId) return;
    fetch(`/api/identity/users?entityId=${entityId}&role=property_manager`)
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d.users)) setAgents(d.users.map((u: { id: string; name: string }) => ({ id: u.id, name: u.name }))); })
      .catch(() => { });
  }, [entityId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      companyName: formData.companyName || null,
      email: formData.email || null,
      phone: formData.phone || null,
      source: formData.source || null,
      assignedToId: formData.assignedToId || null,
    });
  };

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center animate-fade-in">
      <button aria-label="Close form backdrop" className="absolute inset-0 size-full cursor-default bg-[#151936]/20 backdrop-blur-sm" onClick={onClose} type="button" />

      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-[0_20px_60px_rgba(21,25,54,0.1)] overflow-hidden animate-scale-in max-h-[90vh] flex flex-col">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-[rgba(243,223,39,0.18)] border border-[rgba(243,223,39,0.5)] flex items-center justify-center text-[#151936]">
              <IconUserCircle size={20} stroke={1.5} />
            </div>
            <p className="font-serif text-lg text-slate-900">{isEdit ? "Edit Contact" : "New Contact"}</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
            <IconX size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
          <div>
            <label className="block text-slate-400 mb-1.5 label-caps">Name — required</label>
            {isEdit ? (
              <p className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-100 rounded-xl text-slate-600">{formData.displayName}</p>
            ) : (
              <input required type="text" placeholder="Full name or company name" value={formData.displayName} onChange={(e) => setFormData({ ...formData, displayName: e.target.value })} className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-[#151936]/40 focus:ring-1 focus:ring-[#151936]/10 transition-colors shadow-sm" />
            )}
          </div>

          <div>
            <p className="text-slate-400 mb-1.5 label-caps">Type</p>
            <div className="grid grid-cols-4 gap-1.5" role="group" aria-label="Contact type">
              {CONTACT_TYPE_OPTIONS.map((t) => (
                <button key={t} type="button" onClick={() => setFormData({ ...formData, type: t })} className={cn("rounded-xl py-2 text-xs font-medium transition-colors", formData.type === t ? "bg-[#151936] text-white border border-[#151936]" : "bg-white text-slate-600 border border-slate-200")}>
                  {TYPE_META[t].label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-slate-400 mb-1.5 label-caps">Company (optional)</label>
            <input type="text" placeholder="Zawadi Estates Ltd" value={formData.companyName ?? ""} onChange={(e) => setFormData({ ...formData, companyName: e.target.value })} className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-[#151936]/40 focus:ring-1 focus:ring-[#151936]/10 transition-colors shadow-sm" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-400 mb-1.5 label-caps">Phone</label>
              {isEdit ? (
                <p className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-slate-600 mono-data">{formData.phone || "-"}</p>
              ) : (
                <input type="tel" placeholder="+254 7XX XXX XXX" value={formData.phone ?? ""} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-[#151936]/40 focus:ring-1 focus:ring-[#151936]/10 transition-colors shadow-sm mono-data" />
              )}
            </div>
            <div>
              <label className="block text-slate-400 mb-1.5 label-caps">Email</label>
              {isEdit ? (
                <p className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-100 rounded-xl text-slate-600 truncate">{formData.email || "-"}</p>
              ) : (
                <input type="email" placeholder="name@domain.com" value={formData.email ?? ""} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-[#151936]/40 focus:ring-1 focus:ring-[#151936]/10 transition-colors shadow-sm" />
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-400 mb-1.5 label-caps">Source</label>
              <input type="text" placeholder="Referral, website, walk-in…" value={formData.source ?? ""} onChange={(e) => setFormData({ ...formData, source: e.target.value })} className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-[#151936]/40 focus:ring-1 focus:ring-[#151936]/10 transition-colors shadow-sm" />
            </div>
            <div>
              <label className="block text-slate-400 mb-1.5 label-caps">Assigned to</label>
              <select value={formData.assignedToId ?? ""} onChange={(e) => setFormData({ ...formData, assignedToId: e.target.value })} className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-[#151936]/40 focus:ring-1 focus:ring-[#151936]/10 transition-colors shadow-sm">
                <option value="">Unassigned</option>
                {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-slate-100 sticky bottom-0 bg-white">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">Cancel</button>
            <button type="submit" className="px-5 py-2 text-sm font-medium bg-gradient-to-br from-[#122a20] to-[#1e1b4b] text-white rounded-xl transition-opacity hover:opacity-90 shadow-sm">
              {isEdit ? "Save Changes" : "Create Contact"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
