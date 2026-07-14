"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useToast } from "@/components/ui/toast-provider";
import { useUIStore } from "@/store/ui";

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
      // Default the new term to one year past the old expiry - a sensible
      // starting point the user can adjust, not a hard rule.
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

  return (
    <Modal
      open={open}
      onClose={isSubmitting ? () => { } : onClose}
      title="Renew Lease"
      description={`${lease.tenantName} - ${lease.propertyName}. The current term ends ${new Date(lease.endsAt).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}; the new term starts immediately after.`}
      size="md"
    >
      <div className="space-y-4">
        <div>
          <label className="label-caps text-slate-400 mb-1.5 block">New Lease End Date</label>
          <input
            type="date"
            className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-body-primary focus:outline-none focus:border-[#151936]/40 transition-colors shadow-sm"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label-caps text-slate-400 mb-1.5 block">Rent Rate (KES / month)</label>
            <input
              className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 mono-data focus:outline-none focus:border-[#151936]/40 transition-colors shadow-sm"
              value={monthlyRentKes}
              onChange={(e) => setMonthlyRentKes(e.target.value)}
            />
          </div>
          <div>
            <label className="label-caps text-slate-400 mb-1.5 block">Deposit Held (KES)</label>
            <input
              className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 mono-data focus:outline-none focus:border-[#151936]/40 transition-colors shadow-sm"
              value={depositKes}
              onChange={(e) => setDepositKes(e.target.value)}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <LoadingSpinner size="sm" />
                <span className="ml-2">Renewing…</span>
              </>
            ) : (
              "Renew Lease"
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
