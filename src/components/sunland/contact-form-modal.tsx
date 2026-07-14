"use client";

import { useState } from "react";
import { IconX, IconUserPlus } from "@tabler/icons-react";
import { Contact, ContactType, ContactSource, ContactStatus } from "./contacts-board";

interface ContactFormModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: Partial<Contact>) => void;
  initialData?: Contact;
}

interface ContactFormData {
  name: string;
  type: string;
  source: string;
  status: string;
  email: string;
  phone: string;
  assignedAgent: string;
  associatedPropsInput: string;
  paid: number;
  arrears: number;
  portfolioValue: number;
}

const CONTACT_TYPES: { value: ContactType; label: string }[] = [
  { value: "landlord", label: "Landlord" },
  { value: "property_owner", label: "Property Owner" },
  { value: "investor", label: "Investor" },
  { value: "buyer", label: "Buyer" },
  { value: "tenant", label: "Tenant" },
  { value: "developer", label: "Developer" },
  { value: "financial_institution", label: "Financial Institution" },
  { value: "advocate", label: "Advocate" },
  { value: "contractor", label: "Contractor" },
  { value: "valuer", label: "Valuer" },
  { value: "government_agency", label: "Government Agency" },
];

const CONTACT_SOURCES: { value: ContactSource; label: string }[] = [
  { value: "referral", label: "Referral" },
  { value: "walk_in", label: "Walk-In" },
  { value: "website", label: "Website" },
  { value: "social_media", label: "Social Media" },
  { value: "cold_call", label: "Cold Call" },
  { value: "existing_client", label: "Existing Client" },
  { value: "partner", label: "Partner" },
  { value: "exhibition", label: "Exhibition" },
];

const CONTACT_STATUSES: { value: ContactStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "blacklisted", label: "Blacklisted" },
];

export function ContactFormModal({ open, onClose, onSubmit, initialData }: ContactFormModalProps) {
  if (!open) return null;

  return (
    <ContactFormModalContent
      onClose={onClose}
      onSubmit={onSubmit}
      initialData={initialData}
    />
  );
}

function ContactFormModalContent({
  onClose,
  onSubmit,
  initialData,
}: {
  onClose: () => void;
  onSubmit: (data: Partial<Contact>) => void;
  initialData?: Contact;
}) {
  const [formData, setFormData] = useState<ContactFormData>(() => {
    if (initialData) {
      return {
        name: initialData.name || "",
        type: initialData.type || "tenant",
        source: initialData.source || "website",
        status: initialData.status || "active",
        email: initialData.email || "",
        phone: initialData.phone || "",
        assignedAgent: initialData.assignedAgent || "Amina Wanjiku",
        associatedPropsInput: initialData.associatedProperties?.map(p => p.name).join(", ") || "",
        paid: initialData.financials?.paid || 0,
        arrears: initialData.financials?.arrears || 0,
        portfolioValue: initialData.financials?.portfolioValue || 0,
      };
    }
    return {
      name: "",
      type: "tenant",
      source: "website",
      status: "active",
      email: "",
      phone: "",
      assignedAgent: "Amina Wanjiku",
      associatedPropsInput: "",
      paid: 0,
      arrears: 0,
      portfolioValue: 0,
    };
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const props = formData.associatedPropsInput
      ? formData.associatedPropsInput.split(",").map((p: string, index: number) => ({
        id: `prop-${index}-${Date.now()}`,
        name: p.trim(),
        role: formData.type === "landlord" ? "Landlord" : "Tenant"
      }))
      : [];

    const payload: Partial<Contact> = {
      name: formData.name,
      type: formData.type as ContactType,
      source: formData.source as ContactSource,
      status: formData.status as ContactStatus,
      email: formData.email,
      phone: formData.phone,
      assignedAgent: formData.assignedAgent,
      associatedProperties: props,
      financials: {
        paid: Number(formData.paid) || 0,
        arrears: Number(formData.arrears) || 0,
        balance: (Number(formData.arrears) || 0) - (Number(formData.paid) || 0),
        portfolioValue: Number(formData.portfolioValue) || 0,
      },
      timeline: initialData?.timeline || [
        {
          id: `log-${Date.now()}`,
          date: new Date().toISOString().split("T")[0],
          type: "system",
          summary: initialData ? "Contact Edited" : "Contact Created",
          details: initialData ? "Admin updated contact details." : "Contact added to the CRM."
        }
      ]
    };

    onSubmit(payload);
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
              <IconUserPlus size={20} stroke={1.5} />
            </div>
            <div>
              <h2 className="font-medium text-slate-900 tracking-tight text-lg">
                {initialData ? "Modify Contact Profile" : "Enlist New Contact"}
              </h2>
              <p className="text-base text-slate-400 mt-0.5">Define CRM metadata, relations, and financials.</p>
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

          {/* Main info */}
          <div className="space-y-4">
            <div>
              <label className="block text-slate-400 mb-1.5 label-caps">Full Name / Organization</label>
              <input
                required
                type="text"
                placeholder="e.g. David Kimani or Prime Properties Ltd"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3.5 py-2.5 text-base bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-[#151936]/40 focus:ring-1 focus:ring-[#151936]/10 transition-colors shadow-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-400 mb-1.5 label-caps">Contact Type</label>
                <select
                  value={formData.type}
                  onChange={e => setFormData({ ...formData, type: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-base bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-[#151936]/40 focus:ring-1 focus:ring-[#151936]/10 transition-colors shadow-sm"
                >
                  {CONTACT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-slate-400 mb-1.5 label-caps">Lead Source</label>
                <select
                  value={formData.source}
                  onChange={e => setFormData({ ...formData, source: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-base bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-[#151936]/40 focus:ring-1 focus:ring-[#151936]/10 transition-colors shadow-sm"
                >
                  {CONTACT_SOURCES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-400 mb-1.5 label-caps">Status</label>
                <select
                  value={formData.status}
                  onChange={e => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-base bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-[#151936]/40 focus:ring-1 focus:ring-[#151936]/10 transition-colors shadow-sm animate-none"
                >
                  {CONTACT_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-slate-400 mb-1.5 label-caps">Assigned Agent</label>
                <select
                  value={formData.assignedAgent}
                  onChange={e => setFormData({ ...formData, assignedAgent: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-base bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-[#151936]/40 focus:ring-1 focus:ring-[#151936]/10 transition-colors shadow-sm"
                >
                  <option value="Amina Wanjiku">Amina Wanjiku</option>
                  <option value="John Mwangi">John Mwangi</option>
                  <option value="CEO">CEO / Admin</option>
                </select>
              </div>
            </div>

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

            {/* Property Associations Input */}
            <div>
              <label className="block text-slate-400 mb-1.5 label-caps">Associated Properties (Comma-separated)</label>
              <input
                type="text"
                placeholder="e.g. Karen Ridge House, Runda Grove Villa"
                value={formData.associatedPropsInput}
                onChange={e => setFormData({ ...formData, associatedPropsInput: e.target.value })}
                className="w-full px-3.5 py-2.5 text-base bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-[#151936]/40 focus:ring-1 focus:ring-[#151936]/10 transition-colors shadow-sm"
              />
            </div>

            {/* Financial Overview Inputs */}
            <div className="border-t border-slate-100 pt-4 space-y-4">
              <h4 className="text-base font-medium text-slate-800">Financial Setup (KES)</h4>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 label-caps">Total Paid</label>
                  <input
                    type="number"
                    value={formData.paid}
                    onChange={e => setFormData({ ...formData, paid: Number(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none mono-data"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 label-caps">Arrears</label>
                  <input
                    type="number"
                    value={formData.arrears}
                    onChange={e => setFormData({ ...formData, arrears: Number(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none mono-data"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 label-caps">Est. Portfolio</label>
                  <input
                    type="number"
                    value={formData.portfolioValue}
                    onChange={e => setFormData({ ...formData, portfolioValue: Number(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none mono-data"
                  />
                </div>
              </div>
            </div>

          </div>

          {/* Footer inside drawer scrolling */}
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
              {initialData ? "Save Changes" : "Create Contact"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
