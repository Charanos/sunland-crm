"use client";

import { useEffect, useState } from "react";
import { IconAlertTriangle, IconUserCog } from "@tabler/icons-react";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast-provider";
import { Button } from "@/components/ui/button";

interface ManagerOption {
  id: string;
  name: string;
  title: string | null;
}

interface MandateFormModalProps {
  open: boolean;
  entityId: string | null;
  propertyId: string;
  propertyName: string;
  landlordName: string;
  landlordVerified?: boolean;
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
  landlordVerified = false,
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
  const [assignedPmId, setAssignedPmId] = useState("");
  const [managers, setManagers] = useState<ManagerOption[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !entityId) return;
    let active = true;
    fetch(`/api/identity/users?entityId=${entityId}&role=property_manager`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active || !data) return;
        setManagers(data.users ?? []);
      })
      .catch(() => {
        if (active) setManagers([]);
      });
    return () => {
      active = false;
    };
  }, [open, entityId]);

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
          assignedPmId: assignedPmId || null,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error ?? "Failed to submit mandate");
      }

      const requiredApproverRole = data?.mandate?.requiredApproverRole as "gm" | "ceo" | null | undefined;
      if (!requiredApproverRole) {
        // CEO/GM creating within their own authority self-approves - see
        // ADR 014 §14.2 - so it's already active, no approval to wait on.
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
    <Modal
      open={open}
      onClose={submitting ? () => { } : onClose}
      title="Create Management Mandate"
      description={`${propertyName} · ${landlordName}`}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {!landlordVerified && (
          <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/60 px-3.5 py-3">
            <IconAlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" aria-hidden="true" />
            <p className="body-sm text-amber-800">
              <span className="font-medium">{landlordName}</span> hasn&apos;t been identity-verified yet. You can
              still submit this mandate, but confirming the landlord first is strongly recommended before funds
              start moving under this agreement.
            </p>
          </div>
        )}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label-caps text-slate-400 mb-1.5 block">Management Fee Rate (%)</label>
            <input
              required
              type="number"
              min="0.1"
              max="100"
              step="0.1"
              value={ratePercent}
              onChange={(e) => setRatePercent(e.target.value)}
              className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 mono-data focus:outline-none focus:border-[#151936]/40 transition-colors shadow-sm"
            />
          </div>
          <div>
            <label className="label-caps text-slate-400 mb-1.5 block">Unit Count</label>
            <input
              required
              type="number"
              min="1"
              step="1"
              value={unitCount}
              onChange={(e) => setUnitCount(e.target.value)}
              className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 mono-data focus:outline-none focus:border-[#151936]/40 transition-colors shadow-sm"
            />
          </div>
        </div>

        {rateDiffersFromDefault && (
          <div>
            <label className="label-caps text-slate-400 mb-1.5 block">Rate Justification</label>
            <textarea
              required
              rows={2}
              placeholder="Why does this mandate use a non-standard rate?"
              value={rateJustification}
              onChange={(e) => setRateJustification(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-body-primary focus:outline-none focus:border-[#151936]/40 transition-colors shadow-sm resize-none"
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label-caps text-slate-400 mb-1.5 block">Start Date</label>
            <input
              required
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-body-primary focus:outline-none focus:border-[#151936]/40 transition-colors shadow-sm"
            />
          </div>
          <div>
            <label className="label-caps text-slate-400 mb-1.5 block">End Date (optional)</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-body-primary focus:outline-none focus:border-[#151936]/40 transition-colors shadow-sm"
            />
          </div>
        </div>

        <div>
          <label className="label-caps text-slate-400 mb-1.5 block">Property Manager (optional)</label>
          <div className="relative">
            <IconUserCog size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300" aria-hidden="true" />
            <select
              value={assignedPmId}
              onChange={(e) => setAssignedPmId(e.target.value)}
              className="w-full h-10 rounded-lg border border-slate-200 bg-white pl-10 pr-3 text-body-primary focus:outline-none focus:border-[#151936]/40 transition-colors shadow-sm appearance-none"
            >
              <option value="">Unassigned</option>
              {managers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}{m.title ? ` · ${m.title}` : ""}
                </option>
              ))}
            </select>
          </div>
        </div>

        <p className="body-sm text-slate-400">
          Mandate activation always requires GM sign-off; mandates covering more than 10 units, or an
          annualized collectible value above KES 5M, additionally require CEO approval.
        </p>

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Submitting..." : "Submit Mandate"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
