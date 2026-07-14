"use client";

import { useState } from "react";
import { IconX, IconShieldCheck } from "@tabler/icons-react";
import { useToast } from "@/components/ui/toast-provider";
import { Button } from "@/components/ui/button";

interface VerifyContactModalProps {
  open: boolean;
  entityId: string | null;
  contactId: string;
  contactName: string;
  initialIdNumber?: string | null;
  onClose: () => void;
  onVerified: () => void;
}

export function VerifyContactModal({
  open,
  entityId,
  contactId,
  contactName,
  initialIdNumber,
  onClose,
  onVerified,
}: VerifyContactModalProps) {
  const { pushToast } = useToast();
  const [idNumber, setIdNumber] = useState(initialIdNumber ?? "");
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch(`/api/contacts/${contactId}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityId, idNumber: idNumber.trim() || null }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Failed to confirm landlord");

      pushToast({ tone: "success", title: "Landlord confirmed", body: `${contactName}'s identity is now verified.` });
      onVerified();
      onClose();
    } catch (err) {
      pushToast({ tone: "warning", title: "Error", body: err instanceof Error ? err.message : "Could not confirm landlord." });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center animate-fade-in">
      <button
        aria-label="Close form backdrop"
        className="absolute inset-0 size-full cursor-default bg-[#151936]/20 backdrop-blur-sm"
        onClick={onClose}
        type="button"
      />

      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-[0_20px_60px_rgba(21,25,54,0.1)] overflow-hidden animate-scale-in max-h-[90vh] flex flex-col z-10">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-white flex items-center justify-center text-[#151936] border border-slate-200 shadow-sm">
              <IconShieldCheck size={20} stroke={1.5} />
            </div>
            <div>
              <h2 className="font-medium text-slate-900 tracking-tight text-lg">Confirm Landlord</h2>
              <p className="body-sm text-slate-400 mt-0.5">{contactName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <IconX size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
          <div>
            <label className="block text-slate-400 mb-1.5 label-caps">National ID / Passport Number</label>
            <input
              type="text"
              placeholder="e.g., 12345678"
              value={idNumber}
              onChange={(e) => setIdNumber(e.target.value)}
              className="w-full px-3.5 py-2.5 text-slate-800 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-[#151936]/40 focus:ring-1 focus:ring-[#151936]/10 transition-colors shadow-sm mono-data"
            />
          </div>
          <p className="body-sm text-slate-400">
            Confirming records this ID number against the landlord and marks their identity as verified, alongside any
            title deed or ID documents already on file.
          </p>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2 shrink-0">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" className="bg-[#151936] text-white hover:bg-[#151936]/90" disabled={submitting}>
              {submitting ? "Confirming..." : "Confirm Landlord"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
