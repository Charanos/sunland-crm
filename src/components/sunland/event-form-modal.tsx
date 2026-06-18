"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useToast } from "@/components/ui/toast-provider";
import { cn } from "@/lib/utils/cn";

const EVENT_TYPES = [
  { value: "internal", label: "Internal Meeting", color: "bg-teal-50 text-teal-700 border-teal-200" },
  { value: "external", label: "Client Viewing", color: "bg-sky-50 text-sky-700 border-sky-200" },
  { value: "legal", label: "Legal / Escrow", color: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  { value: "maintenance", label: "Site Inspection", color: "bg-amber-50 text-amber-700 border-amber-200" },
];

interface EventFormData {
  title: string;
  date: string;
  time: string;
  duration: string;
  type: string;
  description: string;
}

export function EventFormModal({
  open,
  onClose,
  onSubmit,
  initialData,
  mode = "create",
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: EventFormData) => void;
  initialData?: Partial<EventFormData>;
  mode?: "create" | "edit";
}) {
  const { pushToast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof EventFormData, string>>>({});

  const [form, setForm] = useState<EventFormData>({
    title: initialData?.title ?? "",
    date: initialData?.date ?? new Date().toISOString().split("T")[0],
    time: initialData?.time ?? "09:00",
    duration: initialData?.duration ?? "1h",
    type: initialData?.type ?? "internal",
    description: initialData?.description ?? "",
  });

  const updateField = <K extends keyof EventFormData>(field: K, value: EventFormData[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof EventFormData, string>> = {};
    if (!form.title.trim()) newErrors.title = "Event title is required";
    if (!form.date) newErrors.date = "Date is required";
    if (!form.time) newErrors.time = "Time is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setIsSubmitting(true);
    await new Promise((r) => setTimeout(r, 700));
    onSubmit(form);
    pushToast({
      tone: "success",
      title: mode === "create" ? "Event Scheduled" : "Event Updated",
      body: `"${form.title}" ${mode === "create" ? "added to" : "updated on"} the calendar.`,
    });
    setIsSubmitting(false);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={isSubmitting ? () => {} : onClose}
      title={mode === "create" ? "Schedule Event" : "Edit Event"}
      description="Add to the executive calendar"
      size="md"
    >
      <div className="space-y-4">
        {/* Title */}
        <div>
          <label className="label-caps text-slate-500 mb-1.5 block">Event Title</label>
          <input
            className={cn(
              "w-full rounded-lg border bg-white px-3 py-2.5 text-[13px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#151936]/40 transition-colors",
              errors.title ? "border-red-300 bg-red-50/30" : "border-slate-200"
            )}
            placeholder="e.g. HNW Viewing - Karen Ridge"
            value={form.title}
            onChange={(e) => updateField("title", e.target.value)}
          />
          {errors.title && <p className="text-[11px] text-red-500 mt-1">{errors.title}</p>}
        </div>

        {/* Date + Time + Duration */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="label-caps text-slate-500 mb-1.5 block">Date</label>
            <input
              type="date"
              className={cn(
                "w-full rounded-lg border bg-white px-3 py-2.5 text-[13px] text-slate-800 focus:outline-none focus:border-[#151936]/40 transition-colors",
                errors.date ? "border-red-300 bg-red-50/30" : "border-slate-200"
              )}
              value={form.date}
              onChange={(e) => updateField("date", e.target.value)}
            />
          </div>
          <div>
            <label className="label-caps text-slate-500 mb-1.5 block">Time</label>
            <input
              type="time"
              className={cn(
                "w-full rounded-lg border bg-white px-3 py-2.5 text-[13px] font-mono text-slate-800 focus:outline-none focus:border-[#151936]/40 transition-colors",
                errors.time ? "border-red-300 bg-red-50/30" : "border-slate-200"
              )}
              value={form.time}
              onChange={(e) => updateField("time", e.target.value)}
            />
          </div>
          <div>
            <label className="label-caps text-slate-500 mb-1.5 block">Duration</label>
            <select
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[13px] text-slate-800 focus:outline-none focus:border-[#151936]/40 transition-colors"
              value={form.duration}
              onChange={(e) => updateField("duration", e.target.value)}
            >
              {["30m", "1h", "1.5h", "2h", "3h", "4h", "All Day"].map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Type */}
        <div>
          <label className="label-caps text-slate-500 mb-1.5 block">Event Type</label>
          <div className="flex flex-wrap gap-2">
            {EVENT_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => updateField("type", t.value)}
                className={cn(
                  "px-3.5 py-1.5 rounded-lg text-[12px] font-medium border transition-all",
                  form.type === t.value
                    ? cn(t.color, "ring-1 ring-offset-1 ring-slate-300")
                    : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="label-caps text-slate-500 mb-1.5 block">Notes (optional)</label>
          <textarea
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[13px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#151936]/40 transition-colors resize-none h-20"
            placeholder="Add any relevant notes or agenda items..."
            value={form.description}
            onChange={(e) => updateField("description", e.target.value)}
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <LoadingSpinner size="sm" />
                <span>Scheduling…</span>
              </>
            ) : (
              mode === "create" ? "Schedule Event" : "Save Changes"
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
