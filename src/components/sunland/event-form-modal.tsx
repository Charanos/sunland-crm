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
      <div className="space-y-5 mt-2 px-1">
        {/* Title */}
        <div>
          <label className="label-caps text-slate-500 mb-1.5 block">Event Title</label>
          <input
            className={cn(
              "w-full h-10 rounded-lg border px-3 text-sm font-medium placeholder:text-slate-400 placeholder:font-normal focus:outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-100 transition-all shadow-[0_1px_2px_rgba(0,0,0,0.02)]",
              errors.title ? "border-red-300 bg-red-50/30" : "border-slate-200 bg-slate-50/50 hover:bg-slate-50 focus:bg-white"
            )}
            placeholder="e.g. HNW Viewing - Karen Ridge"
            value={form.title}
            onChange={(e) => updateField("title", e.target.value)}
          />
          {errors.title && <p className="text-xs text-red-500 mt-1.5">{errors.title}</p>}
        </div>

        {/* Date + Time + Duration */}
        <div>
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
            <div className="size-5 rounded-md bg-slate-100 border border-slate-200 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
            </div>
            <h4 className="label-caps text-slate-700 m-0">Schedule Details</h4>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xxs font-medium text-slate-400 uppercase tracking-widest mb-1 block">Date</label>
              <input
                type="date"
                min={new Date().toISOString().split("T")[0]}
                className={cn(
                  "w-full h-10 rounded-lg border px-3 text-sm font-medium focus:outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-100 transition-all shadow-[0_1px_2px_rgba(0,0,0,0.02)]",
                  errors.date ? "border-red-300 bg-red-50/30" : "border-slate-200 bg-slate-50/50 hover:bg-slate-50 focus:bg-white"
                )}
                value={form.date}
                onChange={(e) => updateField("date", e.target.value)}
              />
              {errors.date && <p className="text-xs text-red-500 mt-1">{errors.date}</p>}
            </div>
            <div>
              <label className="text-xxs font-medium text-slate-400 uppercase tracking-widest mb-1 block">Time</label>
              <input
                type="time"
                className={cn(
                  "w-full h-10 rounded-lg border px-3 mono-data text-sm focus:outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-100 transition-all shadow-[0_1px_2px_rgba(0,0,0,0.02)]",
                  errors.time ? "border-red-300 bg-red-50/30" : "border-slate-200 bg-slate-50/50 hover:bg-slate-50 focus:bg-white"
                )}
                value={form.time}
                onChange={(e) => updateField("time", e.target.value)}
              />
            </div>
            <div>
              <label className="text-xxs font-medium text-slate-400 uppercase tracking-widest mb-1 block">Duration</label>
              <select
                className="w-full h-10 rounded-lg border border-slate-200 bg-slate-50/50 hover:bg-slate-50 focus:bg-white px-3 text-sm font-medium focus:outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-100 transition-all shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
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
        <div>
          <label className="label-caps text-slate-500 mb-2 block">Event Classification</label>
          <div className="grid grid-cols-2 gap-2.5">
            {EVENT_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => updateField("type", t.value)}
                className={cn(
                  "px-3 py-2 rounded-lg text-xs font-medium border transition-all text-left flex items-center justify-between",
                  form.type === t.value
                    ? cn(t.color, "shadow-sm ring-1 ring-offset-1 ring-slate-100")
                    : "bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:bg-slate-50 shadow-sm"
                )}
              >
                <span>{t.label}</span>
                {form.type === t.value && <div className="size-1.5 rounded-full bg-current opacity-80" />}
              </button>
            ))}
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="label-caps text-slate-500 mb-1.5 block">Notes (optional)</label>
          <textarea
            className="w-full rounded-lg border border-slate-200 bg-slate-50/50 hover:bg-slate-50 focus:bg-white p-3 text-sm font-medium placeholder:text-slate-400 placeholder:font-normal focus:outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-100 transition-all resize-none h-20 shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
            placeholder="Add any relevant notes, agenda items, or links..."
            value={form.description}
            onChange={(e) => updateField("description", e.target.value)}
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-5 border-t border-slate-100 mt-2">
          <button
            className="h-9 px-4 rounded-lg text-sm font-medium text-slate-500 bg-white border border-slate-200 hover:bg-slate-50 hover:text-slate-700 transition-all shadow-sm"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            className="h-9 px-5 rounded-lg text-sm font-medium bg-[#151936] text-white shadow-sm hover:bg-slate-800 transition-all flex items-center justify-center min-w-[140px]"
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <LoadingSpinner className="mr-2 size-3.5" />
                Scheduling...
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
