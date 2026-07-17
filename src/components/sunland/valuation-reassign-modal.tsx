"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useToast } from "@/components/ui/toast-provider";

interface ManagerOption {
  id: string;
  name: string;
}

/**
 * Bulk-reassign for the Acquisition Focus Board's bulk-action bar. Applies
 * assignedManagerId to every selected valuation via real, individual PATCH
 * calls (no dedicated bulk endpoint exists - looping the same real
 * updateValuation() path every single-record edit already goes through is
 * simpler than adding a parallel bulk service function for this one action).
 */
export function ValuationReassignModal({
  open,
  entityId,
  valuationIds,
  onClose,
  onReassigned,
}: {
  open: boolean;
  entityId: string | null;
  valuationIds: string[];
  onClose: () => void;
  onReassigned: () => void;
}) {
  const { pushToast } = useToast();
  const [managers, setManagers] = useState<ManagerOption[]>([]);
  const [managerId, setManagerId] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open || !entityId) return;
    Promise.resolve().then(() => setManagerId(""));
    fetch(`/api/identity/users?entityId=${entityId}&role=property_manager`)
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d.users)) setManagers(d.users.map((u: { id: string; name: string }) => ({ id: u.id, name: u.name }))); })
      .catch(() => { });
  }, [open, entityId]);

  const handleSubmit = async () => {
    if (!managerId) {
      pushToast({ tone: "warning", title: "Pick a manager", body: "Select who these prospects should be reassigned to." });
      return;
    }
    setIsSaving(true);
    try {
      const results = await Promise.all(
        valuationIds.map((id) =>
          fetch(`/api/valuations/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ entityId, assignedManagerId: managerId }),
          }),
        ),
      );
      const failed = results.filter((r) => !r.ok).length;
      const managerName = managers.find((m) => m.id === managerId)?.name ?? "the selected manager";
      if (failed > 0) {
        pushToast({ tone: "warning", title: "Partially reassigned", body: `${valuationIds.length - failed} of ${valuationIds.length} reassigned to ${managerName}.` });
      } else {
        pushToast({ tone: "success", title: "Reassigned", body: `${valuationIds.length} prospect${valuationIds.length === 1 ? "" : "s"} reassigned to ${managerName}.` });
      }
      onReassigned();
    } catch (err) {
      pushToast({ tone: "warning", title: "Error", body: err instanceof Error ? err.message : "Failed to reassign" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => !isSaving && onClose()}
      title="Reassign Prospects"
      description={`Move ${valuationIds.length} prospect${valuationIds.length === 1 ? "" : "s"} to a different property manager`}
      size="sm"
    >
      <div className="space-y-4">
        <div>
          <label className="label-caps text-slate-400 mb-1.5 block">Property Manager</label>
          <select
            className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-body-primary focus:outline-none focus:border-[#151936]/40 transition-colors shadow-sm"
            value={managerId}
            onChange={(e) => setManagerId(e.target.value)}
          >
            <option value="">-- Select manager --</option>
            {managers.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>
        <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
          <Button variant="secondary" onClick={onClose} disabled={isSaving}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isSaving}>
            {isSaving ? (<><LoadingSpinner size="sm" /><span className="ml-2">Reassigning…</span></>) : "Reassign"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
