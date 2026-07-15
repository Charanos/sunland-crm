"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
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
    <Modal
      open={open}
      onClose={submitting ? () => { } : onClose}
      title="Confirm Landlord"
      description={contactName}
      size="sm"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label-caps text-slate-400 mb-1.5 block">National ID / Passport Number</label>
          <input
            type="text"
            placeholder="e.g., 12345678"
            value={idNumber}
            onChange={(e) => setIdNumber(e.target.value)}
            className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 mono-data focus:outline-none focus:border-[#151936]/40 transition-colors shadow-sm"
          />
        </div>
        <p className="body-sm text-slate-400">
          Confirming records this ID number against the landlord and marks their identity as verified, alongside any
          title deed or ID documents already on file.
        </p>

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Confirming..." : "Confirm Landlord"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
