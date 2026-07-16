"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast-provider";

export interface EditableUnit {
  id: string;
  unitLabel: string;
  unitType: string | null;
  monthlyRentKes: string | null;
  status: "vacant" | "occupied" | "reserved" | "maintenance";
  notes: string | null;
}

export function UnitFormModal({
  open,
  entityId,
  propertyId,
  unit,
  onClose,
  onSaved,
}: {
  open: boolean;
  entityId: string | null;
  propertyId: string;
  /** Present when editing an existing unit; omit to create a new one. */
  unit?: EditableUnit | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { pushToast } = useToast();
  const isEdit = !!unit;
  const [unitLabel, setUnitLabel] = useState("");
  const [unitType, setUnitType] = useState("");
  const [monthlyRentKes, setMonthlyRentKes] = useState("");
  const [status, setStatus] = useState<EditableUnit["status"]>("vacant");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    Promise.resolve().then(() => {
      setUnitLabel(unit?.unitLabel ?? "");
      setUnitType(unit?.unitType ?? "");
      setMonthlyRentKes(unit?.monthlyRentKes ?? "");
      setStatus(unit?.status ?? "vacant");
      setNotes(unit?.notes ?? "");
    });
  }, [open, unit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unitLabel.trim()) {
      pushToast({ tone: "warning", title: "Unit label required" });
      return;
    }
    setSubmitting(true);
    try {
      const body = {
        entityId,
        unitLabel: unitLabel.trim(),
        unitType: unitType.trim() || null,
        monthlyRentKes: monthlyRentKes.trim() || null,
        notes: notes.trim() || null,
        ...(isEdit ? { status } : {}),
      };
      const res = isEdit
        ? await fetch(`/api/property-units/${unit!.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
        : await fetch(`/api/properties/${propertyId}/units`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Failed to save unit");

      pushToast({ tone: "success", title: isEdit ? "Unit updated" : "Unit added" });
      onSaved();
      onClose();
    } catch (err) {
      pushToast({ tone: "warning", title: "Error", body: err instanceof Error ? err.message : "Could not save this unit." });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={submitting ? () => { } : onClose}
      title={isEdit ? "Edit Unit" : "Add Unit"}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label-caps text-slate-400 mb-1.5 block">Unit Label</label>
            <input
              required
              value={unitLabel}
              onChange={(e) => setUnitLabel(e.target.value)}
              placeholder="e.g. Unit 4B"
              className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-body-primary focus:outline-none focus:border-[#151936]/40 transition-colors shadow-sm"
            />
          </div>
          <div>
            <label className="label-caps text-slate-400 mb-1.5 block">Unit Type</label>
            <input
              value={unitType}
              onChange={(e) => setUnitType(e.target.value)}
              placeholder="e.g. 2 Bedroom"
              className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-body-primary focus:outline-none focus:border-[#151936]/40 transition-colors shadow-sm"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label-caps text-slate-400 mb-1.5 block">Monthly Rent (KES)</label>
            <input
              type="number"
              min="0"
              step="500"
              value={monthlyRentKes}
              onChange={(e) => setMonthlyRentKes(e.target.value)}
              className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 mono-data focus:outline-none focus:border-[#151936]/40 transition-colors shadow-sm"
            />
          </div>
          {isEdit && (
            <div>
              <label className="label-caps text-slate-400 mb-1.5 block">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as EditableUnit["status"])}
                disabled={unit?.status === "occupied"}
                className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-body-primary focus:outline-none focus:border-[#151936]/40 transition-colors shadow-sm appearance-none disabled:bg-slate-50 disabled:text-slate-400"
              >
                <option value="vacant">Vacant</option>
                <option value="occupied" disabled>Occupied (assign a lease instead)</option>
                <option value="reserved">Reserved</option>
                <option value="maintenance">Maintenance</option>
              </select>
            </div>
          )}
        </div>
        <div>
          <label className="label-caps text-slate-400 mb-1.5 block">Notes (optional)</label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-body-primary focus:outline-none focus:border-[#151936]/40 transition-colors shadow-sm resize-none"
          />
        </div>
        <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving..." : isEdit ? "Save Unit" : "Add Unit"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
