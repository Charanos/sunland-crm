"use client";

import { useState } from "react";
import { IconX, IconBolt } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast-provider";

interface MandateOverrideModalProps {
  open: boolean;
  approvalRequestId: string;
  gmName?: string | null;
  onClose: () => void;
  onDecided: () => void;
}

export function MandateOverrideModal({ open, approvalRequestId, gmName, onClose, onDecided }: MandateOverrideModalProps) {
  const { pushToast } = useToast();
  const [reason, setReason] = useState("");
  const [reasonErr, setReasonErr] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const handleConfirm = async () => {
    if (submitting) return;
    if (!reason.trim()) {
      setReasonErr(true);
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/finance/approvals/decide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: approvalRequestId, status: "approved", overrideNote: reason.trim() }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Failed to override the pending decision");
      pushToast({ tone: "success", title: "Override recorded", body: "Mandate activated. The GM step has been notified with your reason." });
      setReason("");
      onDecided();
      onClose();
    } catch (err) {
      pushToast({ tone: "warning", title: "Error", body: err instanceof Error ? err.message : "Could not record the override." });
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
        <div className="px-6 py-5 border-b border-slate-100 flex items-center gap-3 bg-slate-50/50 shrink-0">
          <div className="size-10 rounded-xl bg-[#fdf9e0] flex items-center justify-center text-[#151936] border border-amber-200 shadow-sm shrink-0">
            <IconBolt size={20} stroke={1.5} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-medium text-slate-900 tracking-tight text-lg">Decide Directly — CEO Override</h2>
            <p className="body-sm text-slate-400 mt-0.5">Bypasses the pending GM approval step</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors shrink-0">
            <IconX size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
          <p className="text-body-regular text-slate-600 leading-relaxed">
            This mandate is awaiting <span className="font-medium text-slate-900">{gmName ?? "the General Manager"}</span>. Deciding directly
            activates it now, logs the action as an override, and notifies the GM with your reason.
          </p>
          <div>
            <label htmlFor="override-reason" className="block label-caps text-slate-400 mb-1.5">
              Override reason — required
            </label>
            <textarea
              id="override-reason"
              rows={3}
              value={reason}
              onChange={(e) => { setReason(e.target.value); setReasonErr(false); }}
              placeholder="Why this decision can't wait for the GM step…"
              className="w-full px-3.5 py-2.5 text-slate-800 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-[#151936]/40 focus:ring-1 focus:ring-[#151936]/10 transition-colors shadow-sm resize-y"
            />
            {reasonErr && <p className="body-sm text-rose-600 mt-1.5">An override reason is mandatory — it is logged and sent to the GM.</p>}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-2 shrink-0">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button className="bg-[#151936] text-white hover:bg-[#151936]/90" onClick={handleConfirm} disabled={submitting}>
            {submitting ? "Activating…" : "Approve & Activate (Override)"}
          </Button>
        </div>
      </div>
    </div>
  );
}
