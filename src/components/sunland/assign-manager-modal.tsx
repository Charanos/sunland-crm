"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast-provider";
import { Button } from "@/components/ui/button";

interface ManagerOption {
  id: string;
  name: string;
  title: string | null;
}

interface AssignManagerModalProps {
  open: boolean;
  entityId: string | null;
  mandateId: string;
  propertyName: string;
  currentManagerId?: string | null;
  onClose: () => void;
  onAssigned: () => void;
}

export function AssignManagerModal({
  open,
  entityId,
  mandateId,
  propertyName,
  currentManagerId,
  onClose,
  onAssigned,
}: AssignManagerModalProps) {
  const { pushToast } = useToast();
  const [managers, setManagers] = useState<ManagerOption[]>([]);
  const [assignedPmId, setAssignedPmId] = useState(currentManagerId ?? "");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    Promise.resolve().then(() => setAssignedPmId(currentManagerId ?? ""));
  }, [open, currentManagerId]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch(`/api/mandates/${mandateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "assign_manager",
          entityId,
          assignedPmId: assignedPmId || null,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error ?? "Failed to update the property manager");
      }
      pushToast({
        tone: "success",
        title: assignedPmId ? "Manager assigned" : "Manager unassigned",
        body: assignedPmId ? "This mandate now routes to the selected manager." : "This mandate no longer has an assigned manager.",
      });
      onAssigned();
      onClose();
    } catch (err) {
      console.error(err);
      pushToast({ tone: "warning", title: "Error", body: err instanceof Error ? err.message : "Could not update the property manager." });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={submitting ? () => { } : onClose}
      title="Assign Property Manager"
      description={propertyName}
      size="sm"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label-caps text-slate-400 mb-1.5 block">Property Manager</label>
          <select
            value={assignedPmId}
            onChange={(e) => setAssignedPmId(e.target.value)}
            className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-body-primary focus:outline-none focus:border-[#151936]/40 transition-colors shadow-sm appearance-none"
          >
            <option value="">Unassigned</option>
            {managers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}{m.title ? ` · ${m.title}` : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving..." : "Save"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
