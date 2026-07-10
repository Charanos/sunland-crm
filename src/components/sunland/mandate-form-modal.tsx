"use client";

import { useState } from "react";
import { IconX, IconFileCertificate } from "@tabler/icons-react";
import { useToast } from "@/components/ui/toast-provider";
import { Button } from "@/components/ui/button";

interface MandateFormModalProps {
  open: boolean;
  entityId: string | null;
  propertyId: string;
  propertyName: string;
  landlordName: string;
  defaultUnitCount: number;
  onClose: () => void;
  onCreated: () => void;
}

const DEFAULT_RATE_PERCENT = 10;

export function MandateFormModal({
  open,
  entityId,
  propertyId,
  propertyName,
  landlordName,
  defaultUnitCount,
  onClose,
  onCreated,
}: MandateFormModalProps) {
  const { pushToast } = useToast();
  const [ratePercent, setRatePercent] = useState(String(DEFAULT_RATE_PERCENT));
  const [rateJustification, setRateJustification] = useState("");
  const [unitCount, setUnitCount] = useState(String(Math.max(1, defaultUnitCount)));
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const rateValue = parseFloat(ratePercent);
  const rateDiffersFromDefault = Number.isFinite(rateValue) && Math.abs(rateValue - DEFAULT_RATE_PERCENT) > 0.01;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!Number.isFinite(rateValue) || rateValue <= 0 || rateValue > 100) {
      pushToast({ tone: "warning", title: "Invalid rate", body: "Enter a management fee rate between 0 and 100%." });
      return;
    }
    if (rateDiffersFromDefault && !rateJustification.trim()) {
      pushToast({ tone: "warning", title: "Justification required", body: "Explain why this rate differs from the standard 10%." });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/mandates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityId,
          propertyId,
          mandateRate: (rateValue / 100).toFixed(4),
          rateJustification: rateDiffersFromDefault ? rateJustification.trim() : undefined,
          unitCount: parseInt(unitCount, 10) || 1,
          startDate: new Date(startDate).toISOString(),
          endDate: endDate ? new Date(endDate).toISOString() : null,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error ?? "Failed to submit mandate");
      }

      const requiredApproverRole = data?.mandate?.requiredApproverRole as "gm" | "ceo" | null | undefined;
      if (!requiredApproverRole) {
        // CEO/GM creating within their own authority self-approves — see
        // ADR 014 §14.2 — so it's already active, no approval to wait on.
        pushToast({ tone: "success", title: "Mandate activated", body: "Created and activated immediately under your authority." });
      } else {
        const approverLabel = requiredApproverRole === "ceo" ? "CEO" : "GM";
        pushToast({
          tone: "success",
          title: "Mandate submitted",
          body: `Awaiting ${approverLabel} approval before it goes active.`,
        });
      }
      onCreated();
      onClose();
    } catch (err) {
      console.error(err);
      pushToast({ tone: "warning", title: "Error", body: err instanceof Error ? err.message : "Could not submit the mandate." });
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

      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-[0_20px_60px_rgba(21,25,54,0.1)] overflow-hidden animate-scale-in max-h-[90vh] flex flex-col z-10">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-white flex items-center justify-center text-[#151936] border border-slate-200 shadow-sm">
              <IconFileCertificate size={20} stroke={1.5} />
            </div>
            <div>
              <h2 className="font-medium text-slate-900 tracking-tight text-lg">Create Management Mandate</h2>
              <p className="body-sm text-slate-500 mt-0.5">{propertyName} · {landlordName}</p>
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
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-500 mb-1.5 label-caps">Management Fee Rate (%)</label>
              <input
                required
                type="number"
                min="0.1"
                max="100"
                step="0.1"
                value={ratePercent}
                onChange={(e) => setRatePercent(e.target.value)}
                className="w-full px-3.5 py-2.5 text-slate-800 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-[#151936]/40 focus:ring-1 focus:ring-[#151936]/10 transition-colors shadow-sm mono-data"
              />
            </div>
            <div>
              <label className="block text-slate-500 mb-1.5 label-caps">Unit Count</label>
              <input
                required
                type="number"
                min="1"
                step="1"
                value={unitCount}
                onChange={(e) => setUnitCount(e.target.value)}
                className="w-full px-3.5 py-2.5 text-slate-800 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-[#151936]/40 focus:ring-1 focus:ring-[#151936]/10 transition-colors shadow-sm mono-data"
              />
            </div>
          </div>

          {rateDiffersFromDefault && (
            <div>
              <label className="block text-slate-500 mb-1.5 label-caps">Rate Justification</label>
              <textarea
                required
                rows={2}
                placeholder="Why does this mandate use a non-standard rate?"
                value={rateJustification}
                onChange={(e) => setRateJustification(e.target.value)}
                className="w-full px-3.5 py-2.5 text-slate-800 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-[#151936]/40 focus:ring-1 focus:ring-[#151936]/10 transition-colors shadow-sm resize-none"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-500 mb-1.5 label-caps">Start Date</label>
              <input
                required
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3.5 py-2.5 text-slate-800 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-[#151936]/40 focus:ring-1 focus:ring-[#151936]/10 transition-colors shadow-sm"
              />
            </div>
            <div>
              <label className="block text-slate-500 mb-1.5 label-caps">End Date (optional)</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3.5 py-2.5 text-slate-800 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-[#151936]/40 focus:ring-1 focus:ring-[#151936]/10 transition-colors shadow-sm"
              />
            </div>
          </div>

          <p className="body-sm text-slate-400">
            Mandate activation always requires GM sign-off; mandates covering more than 10 units, or an
            annualized collectible value above KES 5M, additionally require CEO approval.
          </p>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2 shrink-0">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" className="bg-[#151936] text-white hover:bg-[#151936]/90" disabled={submitting}>
              {submitting ? "Submitting..." : "Submit Mandate"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
