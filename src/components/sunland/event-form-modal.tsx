"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
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
  // Resolves to whether the save actually succeeded - the caller owns the
  // real API call and its own success/error toast, since only it knows the
  // true result. The modal must not announce success it hasn't confirmed.
  onSubmit: (data: EventFormData) => Promise<boolean>;
  initialData?: Partial<EventFormData>;
  mode?: "create" | "edit";
}) {
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
    if (!form.date) {
      newErrors.date = "Date is required";
    } else {
      const todayStr = new Date().toISOString().split("T")[0];
      if (form.date < todayStr) newErrors.date = "Cannot schedule events in the past";
    }
    if (!form.time) newErrors.time = "Time is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setIsSubmitting(true);
    const succeeded = await onSubmit(form);
    setIsSubmitting(false);
    // Only close on confirmed success - the caller already showed its own
    // success/error toast, since it's the one that knows the real result.
    if (succeeded) onClose();
  };

  return (
    <Modal
      open={open}
      onClose={isSubmitting ? () => { } : onClose}
      title={mode === "create" ? "Schedule Event" : "Edit Event"}
      description="Add a new appointment to the executive itinerary."
      size="md"
    >
      <div className="space-y-6 mt-2">
        {/* Title */}
        <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100">
          <label className="text-meta-muted-strong mb-1.5 block">Event Title</label>
          <input
            className={cn(
              "w-full h-11 rounded-lg border bg-white px-3.5 text-body-primary placeholder:text-slate-400 focus:outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-100 transition-all shadow-sm",
              errors.title ? "border-red-300 bg-red-50/30" : "border-slate-200"
            )}
            placeholder="e.g. HNW Viewing - Karen Ridge"
            value={form.title}
            onChange={(e) => updateField("title", e.target.value)}
          />
          {errors.title && <p className="text-sm text-red-500 mt-1">{errors.title}</p>}
        </div>

        {/* Date + Time + Duration */}
        <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100">
          <h4 className="text-meta-muted-strong mb-3 border-b border-slate-200 pb-2">Schedule Details</h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-body-regular text-slate-400 mb-1.5 block">Date</label>
              <input
                type="date"
                min={new Date().toISOString().split("T")[0]}
                className={cn(
                  "w-full h-11 rounded-lg border bg-white px-3 text-body-primary focus:outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-100 transition-all shadow-sm",
                  errors.date ? "border-red-300 bg-red-50/30" : "border-slate-200"
                )}
                value={form.date}
                onChange={(e) => updateField("date", e.target.value)}
              />
              {errors.date && <p className="text-xs text-red-500 mt-1">{errors.date}</p>}
            </div>
            <div>
              <label className="text-body-regular text-slate-400 mb-1.5 block">Time</label>
              <input
                type="time"
                className={cn(
                  "w-full h-11 rounded-lg border bg-white px-3 mono-data focus:outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-100 transition-all shadow-sm",
                  errors.time ? "border-red-300 bg-red-50/30" : "border-slate-200"
                )}
                value={form.time}
                onChange={(e) => updateField("time", e.target.value)}
              />
            </div>
            <div>
              <label className="text-body-regular text-slate-400 mb-1.5 block">Duration</label>
              <select
                className="w-full h-11 rounded-lg border border-slate-200 bg-white px-3 text-body-primary focus:outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-100 transition-all shadow-sm"
                value={form.duration}
                onChange={(e) => updateField("duration", e.target.value)}
              >
                {["30m", "1h", "1.5h", "2h", "3h", "4h", "All Day"].map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Type */}
        <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100">
          <label className="text-meta-muted-strong mb-2.5 block">Event Classification</label>
          <div className="grid grid-cols-2 gap-2">
            {EVENT_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => updateField("type", t.value)}
                className={cn(
                  "px-4 py-2.5 rounded-lg text-body-primary border transition-all text-left flex items-center justify-between",
                  form.type === t.value
                    ? cn(t.color, "shadow-sm ring-1 ring-offset-1 ring-slate-100")
                    : "bg-white text-slate-400 border-slate-200 hover:border-slate-300 hover:bg-slate-50/50"
                )}
              >
                <span>{t.label}</span>
                {form.type === t.value && <div className="size-2 rounded-full bg-current opacity-60" />}
              </button>
            ))}
          </div>
        </div>

        {/* Description */}
        <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100">
          <label className="text-meta-muted-strong mb-1.5 block">Notes (optional)</label>
          <textarea
            className="w-full rounded-lg border border-slate-200 bg-white p-3.5 text-body-primary placeholder:text-slate-400 focus:outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-100 transition-all resize-none h-24 shadow-sm"
            placeholder="Add any relevant notes, agenda items, or links..."
            value={form.description}
            onChange={(e) => updateField("description", e.target.value)}
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
          <button
            className="px-5 py-2.5 rounded-xl text-slate-400 bg-white border border-slate-200 hover:bg-slate-50 hover:text-slate-700 transition-all shadow-sm"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            className="px-6 py-2.5 rounded-xl bg-[#151936] text-white shadow-md hover:bg-slate-800 transition-all flex items-center gap-2"
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <LoadingSpinner size="sm" />
                <span>Scheduling…</span>
              </>
            ) : (
              mode === "create" ? "Confirm & Schedule" : "Save Changes"
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}
