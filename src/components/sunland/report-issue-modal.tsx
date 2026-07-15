"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast-provider";
import { Button } from "@/components/ui/button";

interface PropertyOption {
  id: string;
  name: string;
  propertyCode: string;
}

interface ContactOption {
  id: string;
  displayName: string;
}

interface ReportIssueModalProps {
  open: boolean;
  entityId: string | null;
  /** Pre-set when opened from a specific property's page; omit to show a property picker (board-level "Log Request"). */
  propertyId?: string;
  propertyName?: string;
  onClose: () => void;
  onCreated: () => void;
}

export function ReportIssueModal({ open, entityId, propertyId, propertyName, onClose, onCreated }: ReportIssueModalProps) {
  const { pushToast } = useToast();
  const [selectedPropertyId, setSelectedPropertyId] = useState(propertyId ?? "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("normal");
  const [contractorId, setContractorId] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [propertyOptions, setPropertyOptions] = useState<PropertyOption[]>([]);
  const [contractorOptions, setContractorOptions] = useState<ContactOption[]>([]);

  useEffect(() => {
    Promise.resolve().then(() => setSelectedPropertyId(propertyId ?? ""));
  }, [propertyId, open]);

  useEffect(() => {
    if (!open || !entityId) return;
    if (!propertyId) {
      fetch(`/api/properties?entityId=${entityId}`)
        .then((res) => res.json())
        .then((data) => setPropertyOptions(data.properties ?? []))
        .catch(() => setPropertyOptions([]));
    }
    fetch(`/api/contacts?entityId=${entityId}&type=contractor`)
      .then((res) => res.json())
      .then((data) => setContractorOptions(data.contacts ?? []))
      .catch(() => setContractorOptions([]));
  }, [open, entityId, propertyId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPropertyId || !title.trim() || !description.trim()) {
      pushToast({ tone: "warning", title: "Missing fields", body: "Please fill in all required fields." });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/maintenance-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityId,
          propertyId: selectedPropertyId,
          title: title.trim(),
          description: description.trim(),
          priority,
          assignedContractorId: contractorId || undefined,
          dueAt: dueAt ? new Date(dueAt).toISOString() : undefined,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error ?? "Failed to report issue");
      }

      pushToast({
        tone: "success",
        title: "Issue reported",
        body: `Successfully logged issue for ${propertyName ?? propertyOptions.find((p) => p.id === selectedPropertyId)?.name ?? "the property"}.`,
      });
      setTitle("");
      setDescription("");
      setPriority("normal");
      setContractorId("");
      setDueAt("");
      onCreated();
      onClose();
    } catch (err) {
      console.error(err);
      pushToast({ tone: "warning", title: "Error", body: err instanceof Error ? err.message : "Could not save the maintenance request." });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={submitting ? () => { } : onClose}
      title="Report Maintenance Issue"
      description={propertyName}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {!propertyId && (
          <div>
            <label className="label-caps text-slate-400 mb-1.5 block">Property</label>
            <select
              required
              value={selectedPropertyId}
              onChange={(e) => setSelectedPropertyId(e.target.value)}
              className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-body-primary focus:outline-none focus:border-[#151936]/40 transition-colors shadow-sm"
            >
              <option value="">Select a property...</option>
              {propertyOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.propertyCode})
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="label-caps text-slate-400 mb-1.5 block">Issue Summary / Title</label>
          <input
            required
            type="text"
            placeholder="e.g., Leaking water pipe in Bathroom B"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-body-primary focus:outline-none focus:border-[#151936]/40 transition-colors shadow-sm"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label-caps text-slate-400 mb-1.5 block">Priority Rating</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-body-primary focus:outline-none focus:border-[#151936]/40 transition-colors shadow-sm"
            >
              <option value="low">Low Priority</option>
              <option value="normal">Medium Priority</option>
              <option value="high">High Priority</option>
              <option value="critical">Urgent / Critical</option>
            </select>
          </div>
          <div>
            <label className="label-caps text-slate-400 mb-1.5 block">Due Date (optional)</label>
            <input
              type="date"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-body-primary focus:outline-none focus:border-[#151936]/40 transition-colors shadow-sm"
            />
          </div>
        </div>

        <div>
          <label className="label-caps text-slate-400 mb-1.5 block">Assign Contractor (optional)</label>
          <select
            value={contractorId}
            onChange={(e) => setContractorId(e.target.value)}
            className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-body-primary focus:outline-none focus:border-[#151936]/40 transition-colors shadow-sm"
          >
            <option value="">Unassigned</option>
            {contractorOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.displayName}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label-caps text-slate-400 mb-1.5 block">Detailed Description</label>
          <textarea
            required
            rows={4}
            placeholder="Describe the nature of the maintenance requirement, locations, and any urgent circumstances..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-body-primary focus:outline-none focus:border-[#151936]/40 transition-colors shadow-sm resize-none"
          />
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Submitting..." : "Report Issue"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
