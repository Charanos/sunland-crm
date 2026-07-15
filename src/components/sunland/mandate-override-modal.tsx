"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
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
    <Modal
      open={open}
      onClose={submitting ? () => { } : onClose}
      title="Decide Directly — CEO Override"
      description="Bypasses the pending GM approval step"
      size="sm"
    >
      <div className="space-y-4">
        <p className="text-body-regular text-slate-600 leading-relaxed">
          This mandate is awaiting <span className="font-medium text-slate-900">{gmName ?? "the General Manager"}</span>. Deciding directly
          activates it now, logs the action as an override, and notifies the GM with your reason.
        </p>
        <div>
          <label htmlFor="override-reason" className="label-caps text-slate-400 mb-1.5 block">
            Override reason — required
          </label>
          <textarea
            id="override-reason"
            rows={3}
            value={reason}
            onChange={(e) => { setReason(e.target.value); setReasonErr(false); }}
            placeholder="Why this decision can't wait for the GM step…"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-body-primary focus:outline-none focus:border-[#151936]/40 transition-colors shadow-sm resize-y"
          />
          {reasonErr && <p className="body-sm text-rose-600 mt-1.5">An override reason is mandatory — it is logged and sent to the GM.</p>}
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={submitting}>
            {submitting ? "Activating…" : "Approve & Activate (Override)"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
