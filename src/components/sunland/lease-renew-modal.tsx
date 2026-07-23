"use client";

import { useEffect, useState } from "react";
import { IconRefresh, IconUserCheck, IconShieldCheck, IconBuildingBank } from "@tabler/icons-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/erp-primitives";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useToast } from "@/components/ui/toast-provider";
import { useUIStore } from "@/store/ui";
import { formatCompactKES } from "@/lib/utils/format";

export interface LeaseRenewTarget {
  id: string;
  propertyName: string;
  tenantName: string;
  endsAt: string;
  monthlyRentKes: string;
  depositKes: string | null;
}

export function LeaseRenewModal({
  open,
  lease,
  onClose,
  onRenewed,
}: {
  open: boolean;
  lease: LeaseRenewTarget | null;
  onClose: () => void;
  /** Called with the newly-created lease id - the renewed term replaces the old one. */
  onRenewed: (newLeaseId: string) => void;
}) {
  const { pushToast } = useToast();
  const { activeEntityId } = useUIStore();
  const [endsAt, setEndsAt] = useState("");
  const [monthlyRentKes, setMonthlyRentKes] = useState("");
  const [depositKes, setDepositKes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !lease) return;
    Promise.resolve().then(() => {
      const oneYearOn = new Date(lease.endsAt);
      oneYearOn.setFullYear(oneYearOn.getFullYear() + 1);
      setEndsAt(oneYearOn.toISOString().slice(0, 10));
      setMonthlyRentKes(lease.monthlyRentKes);
      setDepositKes(lease.depositKes ?? "");
    });
  }, [open, lease]);

  if (!lease) return null;

  const handleSubmit = async () => {
    if (!endsAt) {
      pushToast({ tone: "warning", title: "Missing end date", body: "Set the new lease's end date." });
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/leases/${lease.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityId: activeEntityId,
          action: "renew",
          endsAt,
          monthlyRentKes: monthlyRentKes || undefined,
          depositKes: depositKes || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to renew lease");

      pushToast({
        tone: "success",
        title: "Lease Renewed",
        body: `New term runs to ${new Date(endsAt).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}.`,
      });
      onRenewed(data.lease.id);
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to renew lease";
      pushToast({ tone: "warning", title: "Renewal failed", body: message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentRent = parseFloat(lease.monthlyRentKes) || 0;
  const newRent = parseFloat(monthlyRentKes) || 0;
  const rentDiffPct = currentRent > 0 ? (((newRent - currentRent) / currentRent) * 100).toFixed(1) : "0.0";
  const annualRentPool = newRent * 12;

  return (
    <Modal
      open={open}
      onClose={isSubmitting ? () => { } : onClose}
      title="Renew Tenancy Agreement"
      description={`Extend tenancy for ${lease.tenantName} at ${lease.propertyName}. The new term begins immediately after current expiry.`}
      size="lg"
    >
      <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="space-y-6 pt-1">
        {/* Current Tenancy Summary Card */}
        <div className="p-4 rounded-2xl border border-slate-200/90 bg-slate-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="size-11 rounded-xl bg-white border border-slate-200/90 flex items-center justify-center shrink-0 text-[#151936] shadow-2xs">
              <IconRefresh size={22} />
            </div>
            <div className="flex flex-col min-w-0">
              <p className="text-xs font-medium text-slate-900 truncate">
                {lease.propertyName}
              </p>
              <p className="text-xxs text-slate-500 truncate mt-0.5 font-mono">
                Tenant: <span className="font-medium text-slate-700">{lease.tenantName}</span> · Expiry: <span className="font-medium text-slate-700">{new Date(lease.endsAt).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}</span>
              </p>
            </div>
          </div>
          <Badge tone="primary" className="text-xxs shrink-0 font-mono">
            <IconUserCheck size={12} className="shrink-0" />
            Consecutive Term
          </Badge>
        </div>

        {/* Renewal Fields Grid */}
        <div className="space-y-4">
          <div>
            <label className="font-mono text-xxs font-medium uppercase tracking-wider text-slate-500 block mb-1.5">
              New Lease Expiry Date *
            </label>
            <input
              required
              type="date"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
              className="w-full h-11 rounded-xl border border-slate-200/90 bg-white px-3.5 font-mono text-xs font-medium text-slate-900 focus:outline-none focus:border-[#151936] focus:ring-1 focus:ring-[#151936] transition-all shadow-2xs"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="font-mono text-xxs font-medium uppercase tracking-wider text-slate-500 block mb-1.5">
                New Monthly Rent (KES) *
              </label>
              <input
                required
                type="number"
                min="0"
                step="1000"
                value={monthlyRentKes}
                onChange={(e) => setMonthlyRentKes(e.target.value)}
                className="w-full h-11 rounded-xl border border-slate-200/90 bg-white px-3.5 font-mono text-xs font-medium text-slate-900 focus:outline-none focus:border-[#151936] focus:ring-1 focus:ring-[#151936] transition-all shadow-2xs"
              />
            </div>
            <div>
              <label className="font-mono text-xxs font-medium uppercase tracking-wider text-slate-500 block mb-1.5">
                Security Deposit Held (KES)
              </label>
              <input
                type="number"
                min="0"
                step="1000"
                value={depositKes}
                onChange={(e) => setDepositKes(e.target.value)}
                className="w-full h-11 rounded-xl border border-slate-200/90 bg-white px-3.5 font-mono text-xs font-medium text-slate-900 focus:outline-none focus:border-[#151936] focus:ring-1 focus:ring-[#151936] transition-all shadow-2xs"
              />
            </div>
          </div>

          {/* Live Rate Escalation & Cashflow Card */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <IconBuildingBank size={16} className="text-[#151936] shrink-0" />
              <span className="text-slate-600 font-medium">New Annual Cashflow:</span>
              <span className="font-mono font-medium text-slate-900">{formatCompactKES(annualRentPool)}</span>
            </div>
            <Badge tone={parseFloat(rentDiffPct) > 0 ? "warning" : "neutral"} className="text-xxs font-mono shrink-0">
              {parseFloat(rentDiffPct) > 0 ? `+${rentDiffPct}% Escalation` : "Rate Maintained"}
            </Badge>
          </div>
        </div>

        {/* Compliance Footer Banner */}
        <div className="flex items-start gap-2.5 rounded-xl border border-slate-200/80 bg-slate-50 p-3.5 text-xs text-slate-600 leading-relaxed shadow-2xs">
          <IconShieldCheck size={16} className="text-[#151936] shrink-0 mt-0.5" />
          <p>
            Lease renewal creates an immediate consecutive tenancy term starting on the day following current expiry. Tenancy history and payment audit trails remain attached.
          </p>
        </div>

        {/* Modal Controls */}
        <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-xl text-xs px-4 py-2 font-medium"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting}
            className="bg-[#151936] text-white hover:bg-slate-800 rounded-xl text-xs px-5 py-2 font-medium shadow-2xs"
          >
            {isSubmitting ? (
              <div className="flex items-center gap-2">
                <LoadingSpinner size="sm" className="text-white" />
                <span>Renewing...</span>
              </div>
            ) : (
              "Renew Lease"
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

