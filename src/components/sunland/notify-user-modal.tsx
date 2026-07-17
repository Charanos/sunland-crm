"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast-provider";

export function NotifyUserModal({
  open,
  entityId,
  userId,
  recipientName,
  associatedType,
  associatedId,
  href,
  onClose,
}: {
  open: boolean;
  entityId: string | null;
  /** The users.id to notify - contacts (landlords/tenants) can't be targeted yet. */
  userId: string;
  recipientName: string;
  associatedType?: string;
  associatedId?: string;
  href?: string;
  onClose: () => void;
}) {
  const { pushToast } = useToast();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityId, userId, title: title.trim(), body: body.trim(), associatedType, associatedId, href }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Failed to send notification");

      pushToast({ tone: "success", title: "Notification sent", body: `${recipientName} will see this in their notification centre.` });
      setTitle("");
      setBody("");
      onClose();
    } catch (err) {
      pushToast({ tone: "error", title: "Error", body: err instanceof Error ? err.message : "Could not send this notification." });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={submitting ? () => { } : onClose}
      title={`Notify ${recipientName}`}
      description="Sends a real, in-app notification to their notification centre."
      size="sm"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label-caps text-slate-400 mb-1.5 block">Title</label>
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Please review this mandate"
            className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-body-primary focus:outline-none focus:border-[#151936]/40 transition-colors shadow-sm"
          />
        </div>
        <div>
          <label className="label-caps text-slate-400 mb-1.5 block">Message</label>
          <textarea
            required
            rows={3}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="What do they need to know or do?"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-body-primary focus:outline-none focus:border-[#151936]/40 transition-colors shadow-sm resize-none"
          />
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting || !title.trim() || !body.trim()}>
            {submitting ? "Sending..." : "Send Notification"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
