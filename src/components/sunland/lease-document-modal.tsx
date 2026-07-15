"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast-provider";
import { Button } from "@/components/ui/button";

const LEASE_DOCUMENT_TYPES = [
  { value: "lease_agreement", label: "Lease Agreement" },
  { value: "identification", label: "Tenant ID / Passport" },
  { value: "rent_receipt", label: "Rent Receipt" },
  { value: "statement", label: "Statement" },
] as const;

interface LeaseDocumentModalProps {
  open: boolean;
  entityId: string | null;
  leaseId: string;
  propertyId: string;
  leaseLabel: string;
  onClose: () => void;
  onAttached: () => void;
}

export function LeaseDocumentModal({
  open,
  entityId,
  leaseId,
  propertyId,
  leaseLabel,
  onClose,
  onAttached,
}: LeaseDocumentModalProps) {
  const { pushToast } = useToast();
  const [title, setTitle] = useState("");
  const [type, setType] = useState<(typeof LEASE_DOCUMENT_TYPES)[number]["value"]>("lease_agreement");
  const [url, setUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !url.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityId,
          type,
          title: title.trim(),
          fileUrl: url.trim(),
          leaseId,
          propertyId,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Failed to attach document");

      pushToast({ tone: "success", title: "Document attached", body: `Saved against ${leaseLabel}.` });
      onAttached();
      onClose();
      setTitle("");
      setUrl("");
    } catch (err) {
      pushToast({ tone: "warning", title: "Error", body: err instanceof Error ? err.message : "Could not attach document." });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={submitting ? () => { } : onClose}
      title="Upload Document"
      description={leaseLabel}
      size="sm"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label-caps text-slate-400 mb-1.5 block">Document Title</label>
          <input
            required
            type="text"
            placeholder="e.g. Signed Lease Agreement"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-body-primary focus:outline-none focus:border-[#151936]/40 transition-colors shadow-sm"
          />
        </div>
        <div>
          <label className="label-caps text-slate-400 mb-1.5 block">Document Type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as typeof type)}
            className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-body-primary focus:outline-none focus:border-[#151936]/40 transition-colors shadow-sm"
          >
            {LEASE_DOCUMENT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label-caps text-slate-400 mb-1.5 block">Document URL</label>
          <input
            required
            type="url"
            placeholder="https://…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-body-primary focus:outline-none focus:border-[#151936]/40 transition-colors shadow-sm"
          />
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting || !title.trim() || !url.trim()}>
            {submitting ? "Saving..." : "Attach Document"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
