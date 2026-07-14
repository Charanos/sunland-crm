"use client";

import { useEffect, useState } from "react";
import { IconX, IconUserCog } from "@tabler/icons-react";
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

  if (!open) return null;

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
              <IconUserCog size={20} stroke={1.5} />
            </div>
            <div>
              <h2 className="font-medium text-slate-900 tracking-tight text-lg">Assign Property Manager</h2>
              <p className="body-sm text-slate-400 mt-0.5">{propertyName}</p>
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
            <label className="block text-slate-400 mb-1.5 label-caps">Property Manager</label>
            <select
              value={assignedPmId}
              onChange={(e) => setAssignedPmId(e.target.value)}
              className="w-full px-3.5 py-2.5 text-slate-800 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-[#151936]/40 focus:ring-1 focus:ring-[#151936]/10 transition-colors shadow-sm appearance-none"
            >
              <option value="">Unassigned</option>
              {managers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}{m.title ? ` · ${m.title}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2 shrink-0">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" className="bg-[#151936] text-white hover:bg-[#151936]/90" disabled={submitting}>
              {submitting ? "Saving..." : "Save"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
