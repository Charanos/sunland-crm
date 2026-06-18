"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useToast } from "@/components/ui/toast-provider";
import { cn } from "@/lib/utils/cn";

interface PropertyFormData {
  name: string;
  location: string;
  type: string;
  status: "Available" | "Sold" | "Under Offer" | "Occupied";
  price: string;
  roi: string;
  imageUrl: string;
}

const PROPERTY_TYPES = [
  "Premium Estate", "Office Suite", "Luxury Villa", "Apartment",
  "Townhouse", "Executive Studio", "Office Floor", "Showroom", "Warehouse",
];

const STATUSES: PropertyFormData["status"][] = [
  "Available", "Occupied", "Under Offer", "Sold",
];

const STATUS_COLORS: Record<string, string> = {
  Available: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Occupied: "bg-blue-50 text-blue-700 border-blue-200",
  "Under Offer": "bg-amber-50 text-amber-700 border-amber-200",
  Sold: "bg-slate-100 text-slate-600 border-slate-200",
};

export function PropertyFormModal({
  open,
  onClose,
  onSubmit,
  initialData,
  mode = "create",
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: PropertyFormData) => void;
  initialData?: Partial<PropertyFormData>;
  mode?: "create" | "edit";
}) {
  const { pushToast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof PropertyFormData, string>>>({});

  const [form, setForm] = useState<PropertyFormData>({
    name: initialData?.name ?? "",
    location: initialData?.location ?? "",
    type: initialData?.type ?? PROPERTY_TYPES[0],
    status: initialData?.status ?? "Available",
    price: initialData?.price ?? "",
    roi: initialData?.roi ?? "",
    imageUrl: initialData?.imageUrl ?? "",
  });

  const updateField = <K extends keyof PropertyFormData>(
    field: K,
    value: PropertyFormData[K]
  ) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof PropertyFormData, string>> = {};
    if (!form.name.trim()) newErrors.name = "Property name is required";
    if (!form.location.trim()) newErrors.location = "Location is required";
    if (!form.price.trim()) newErrors.price = "Price is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setIsSubmitting(true);
    // Simulate API call
    await new Promise((r) => setTimeout(r, 800));
    onSubmit(form);
    pushToast({
      tone: "success",
      title: mode === "create" ? "Property Created" : "Property Updated",
      body: `${form.name} has been ${mode === "create" ? "added to" : "updated in"} the portfolio.`,
    });
    setIsSubmitting(false);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={isSubmitting ? () => {} : onClose}
      title={mode === "create" ? "Add New Property" : "Edit Property"}
      description={mode === "create" ? "Add a new listing to the portfolio" : "Update property details"}
      size="lg"
    >
      <div className="space-y-4">
        {/* Name */}
        <div>
          <label className="label-caps text-slate-500 mb-1.5 block">Property Name</label>
          <input
            className={cn(
              "w-full rounded-lg border bg-white px-3 py-2.5 text-[13px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#151936]/40 transition-colors",
              errors.name ? "border-red-300 bg-red-50/30" : "border-slate-200"
            )}
            placeholder="e.g. Runda Grove Villa"
            value={form.name}
            onChange={(e) => updateField("name", e.target.value)}
          />
          {errors.name && <p className="text-[11px] text-red-500 mt-1">{errors.name}</p>}
        </div>

        {/* Location + Type */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label-caps text-slate-500 mb-1.5 block">Location</label>
            <input
              className={cn(
                "w-full rounded-lg border bg-white px-3 py-2.5 text-[13px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#151936]/40 transition-colors",
                errors.location ? "border-red-300 bg-red-50/30" : "border-slate-200"
              )}
              placeholder="e.g. Runda, Nairobi"
              value={form.location}
              onChange={(e) => updateField("location", e.target.value)}
            />
            {errors.location && <p className="text-[11px] text-red-500 mt-1">{errors.location}</p>}
          </div>
          <div>
            <label className="label-caps text-slate-500 mb-1.5 block">Property Type</label>
            <select
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[13px] text-slate-800 focus:outline-none focus:border-[#151936]/40 transition-colors"
              value={form.type}
              onChange={(e) => updateField("type", e.target.value)}
            >
              {PROPERTY_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Price + ROI */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label-caps text-slate-500 mb-1.5 block">Price (KES)</label>
            <input
              className={cn(
                "w-full rounded-lg border bg-white px-3 py-2.5 text-[13px] font-mono text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#151936]/40 transition-colors",
                errors.price ? "border-red-300 bg-red-50/30" : "border-slate-200"
              )}
              placeholder="e.g. KES 21.3M"
              value={form.price}
              onChange={(e) => updateField("price", e.target.value)}
            />
            {errors.price && <p className="text-[11px] text-red-500 mt-1">{errors.price}</p>}
          </div>
          <div>
            <label className="label-caps text-slate-500 mb-1.5 block">ROI / Yield</label>
            <input
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[13px] font-mono text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#151936]/40 transition-colors"
              placeholder="e.g. 12.0%"
              value={form.roi}
              onChange={(e) => updateField("roi", e.target.value)}
            />
          </div>
        </div>

        {/* Status */}
        <div>
          <label className="label-caps text-slate-500 mb-1.5 block">Status</label>
          <div className="flex flex-wrap gap-2">
            {STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => updateField("status", s)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-[12px] font-medium border transition-all",
                  form.status === s
                    ? cn(STATUS_COLORS[s], "ring-1 ring-offset-1 ring-slate-300")
                    : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Image URL */}
        <div>
          <label className="label-caps text-slate-500 mb-1.5 block">Image URL</label>
          <input
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[13px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#151936]/40 transition-colors"
            placeholder="https://images.unsplash.com/..."
            value={form.imageUrl}
            onChange={(e) => updateField("imageUrl", e.target.value)}
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
                <span>{mode === "create" ? "Creating…" : "Saving…"}</span>
              </>
            ) : (
              mode === "create" ? "Create Property" : "Save Changes"
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
