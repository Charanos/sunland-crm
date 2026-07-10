"use client";

import { useState } from "react";
import { IconX, IconClipboardList } from "@tabler/icons-react";
import { useToast } from "@/components/ui/toast-provider";
import { Button } from "@/components/ui/button";

interface ReportIssueModalProps {
  open: boolean;
  propertyId: string;
  propertyName: string;
  onClose: () => void;
  onCreated: () => void;
}

export function ReportIssueModal({ open, propertyId, propertyName, onClose, onCreated }: ReportIssueModalProps) {
  const { pushToast } = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("normal");
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      pushToast({ tone: "warning", title: "Missing fields", body: "Please fill in all fields." });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/maintenance-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId,
          title: title.trim(),
          description: description.trim(),
          priority,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to report issue");
      }

      pushToast({ tone: "success", title: "Issue reported", body: `Successfully logged issue for ${propertyName}.` });
      setTitle("");
      setDescription("");
      setPriority("normal");
      onCreated();
      onClose();
    } catch (err) {
      console.error(err);
      pushToast({ tone: "warning", title: "Error", body: "Could not save the maintenance request." });
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

      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-[0_20px_60px_rgba(21,25,54,0.1)] overflow-hidden animate-scale-in max-h-[90vh] flex flex-col z-10">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-white flex items-center justify-center text-[#151936] border border-slate-200 shadow-sm">
              <IconClipboardList size={20} stroke={1.5} />
            </div>
            <div>
              <h2 className="font-medium text-slate-900 tracking-tight text-lg">
                Report Maintenance Issue
              </h2>
              <p className="body-sm text-slate-500 mt-0.5">{propertyName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <IconX size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
          <div>
            <label className="block text-slate-500 mb-1.5 label-caps">Issue Summary / Title</label>
            <input
              required
              type="text"
              placeholder="e.g., Leaking water pipe in Bathroom B"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 text-slate-800 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-[#151936]/40 focus:ring-1 focus:ring-[#151936]/10 transition-colors shadow-sm"
            />
          </div>

          <div>
            <label className="block text-slate-500 mb-1.5 label-caps">Priority Rating</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full px-3.5 py-2.5 text-slate-800 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-[#151936]/40 focus:ring-1 focus:ring-[#151936]/10 transition-colors shadow-sm"
            >
              <option value="low">Low Priority</option>
              <option value="normal">Medium Priority</option>
              <option value="high">High Priority</option>
              <option value="critical">Urgent / Critical</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-500 mb-1.5 label-caps">Detailed Description</label>
            <textarea
              required
              rows={4}
              placeholder="Describe the nature of the maintenance requirement, locations, and any urgent circumstances..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2.5 text-slate-800 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-[#151936]/40 focus:ring-1 focus:ring-[#151936]/10 transition-colors shadow-sm resize-none"
            />
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2 shrink-0">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-[#151936] text-white hover:bg-[#151936]/90"
              disabled={submitting}
            >
              {submitting ? "Submitting..." : "Report Issue"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
