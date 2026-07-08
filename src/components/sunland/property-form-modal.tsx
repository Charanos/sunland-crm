"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useToast } from "@/components/ui/toast-provider";
import { useUIStore } from "@/store/ui";
import { cn } from "@/lib/utils/cn";

export interface PropertyFormData {
  propertyCode: string;
  name: string;
  propertyType: string;
  listingType: "Rent" | "Sale";
  location: string;
  ownerContactId: string;
  monthlyRentKes: string;
  askingPriceKes: string;
  bedrooms: number | null;
  bathrooms: number | null;
  sizeSqft: number | null;
}

const PROPERTY_TYPES = [
  "Apartment", "Commercial", "House", "Land", "Villa",
];

export function PropertyFormModal({
  open,
  onClose,
  onSubmit,
  initialData,
  mode = "create",
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  initialData?: any;
  mode?: "create" | "edit";
}) {
  const { pushToast } = useToast();
  const { activeEntityId } = useUIStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof PropertyFormData, string>>>({});
  const [landlords, setLandlords] = useState<{ id: string; name: string }[]>([]);

  const [form, setForm] = useState<PropertyFormData>({
    propertyCode: initialData?.propertyCode ?? "",
    name: initialData?.name ?? "",
    propertyType: initialData?.propertyType ?? initialData?.type ?? "Apartment",
    listingType: initialData?.listingType ?? "Rent",
    location: initialData?.location ?? "",
    ownerContactId: initialData?.ownerContactId ?? "",
    monthlyRentKes: initialData?.monthlyRentKes ?? (initialData?.listingType === "Rent" || !initialData?.listingType ? initialData?.price : ""),
    askingPriceKes: initialData?.askingPriceKes ?? (initialData?.listingType === "Sale" ? initialData?.price : ""),
    bedrooms: initialData?.bedrooms ?? null,
    bathrooms: initialData?.bathrooms ?? null,
    sizeSqft: initialData?.sizeSqft ?? null,
  });

  // Load landlords list for dropdown
  useEffect(() => {
    if (!open || !activeEntityId) return;
    const fetchLandlords = async () => {
      try {
        const res = await fetch(`/api/contacts?entityId=${activeEntityId}&type=landlord`);
        const data = await res.json();
        if (data.contacts) {
          setLandlords(data.contacts.map((c: any) => ({ id: c.id, name: c.displayName })));
        }
      } catch (err) {
        console.error("Failed to load landlords:", err);
      }
    };
    fetchLandlords();
  }, [open, activeEntityId]);

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
    if (!form.propertyCode.trim()) newErrors.propertyCode = "Property code is required";
    if (!form.name.trim()) newErrors.name = "Property name is required";
    if (!form.location.trim()) newErrors.location = "Location is required";
    if (form.listingType === "Rent" && !form.monthlyRentKes.trim()) {
      newErrors.monthlyRentKes = "Monthly Rent is required";
    }
    if (form.listingType === "Sale" && !form.askingPriceKes.trim()) {
      newErrors.askingPriceKes = "Asking Price is required";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/properties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityId: activeEntityId,
          propertyCode: form.propertyCode,
          name: form.name,
          propertyType: form.propertyType,
          listingType: form.listingType,
          location: form.location,
          ownerContactId: form.ownerContactId || null,
          monthlyRentKes: form.listingType === "Rent" ? form.monthlyRentKes : null,
          askingPriceKes: form.listingType === "Sale" ? form.askingPriceKes : null,
          bedrooms: form.bedrooms,
          bathrooms: form.bathrooms,
          sizeSqft: form.sizeSqft,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save property");

      onSubmit(data.property);
      pushToast({
        tone: "success",
        title: mode === "create" ? "Property Created" : "Property Updated",
        body: `${form.name} has been enrolled successfully in the database.`,
      });
      onClose();
    } catch (err: any) {
      pushToast({
        tone: "warning",
        title: "Failed to save",
        body: err.message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={isSubmitting ? () => { } : onClose}
      title={mode === "create" ? "Register Property Portfolio" : "Edit Property"}
      description={mode === "create" ? "Add a new managed property linked to an owner contact" : "Update property details"}
      size="lg"
    >
      <div className="space-y-4">
        {/* Code + Name */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="label-caps text-slate-500 mb-1.5 block">Property Code</label>
            <input
              className={cn(
                "w-full rounded-lg border bg-white px-3 py-2 text-base font-mono text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#151936]/40 transition-colors",
                errors.propertyCode ? "border-red-300 bg-red-50/30" : "border-slate-200"
              )}
              placeholder="e.g. PRV-001"
              value={form.propertyCode}
              onChange={(e) => updateField("propertyCode", e.target.value)}
            />
            {errors.propertyCode && <p className="text-sm text-red-500 mt-1">{errors.propertyCode}</p>}
          </div>
          <div className="sm:col-span-2">
            <label className="label-caps text-slate-500 mb-1.5 block">Property Name</label>
            <input
              className={cn(
                "w-full rounded-lg border bg-white px-3 py-2 text-base text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#151936]/40 transition-colors",
                errors.name ? "border-red-300 bg-red-50/30" : "border-slate-200"
              )}
              placeholder="e.g. Park View Apartment 4B"
              value={form.name}
              onChange={(e) => updateField("name", e.target.value)}
            />
            {errors.name && <p className="text-sm text-red-500 mt-1">{errors.name}</p>}
          </div>
        </div>

        {/* Location + Type */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label-caps text-slate-500 mb-1.5 block">Location</label>
            <input
              className={cn(
                "w-full rounded-lg border bg-white px-3 py-2 text-base text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#151936]/40 transition-colors",
                errors.location ? "border-red-300 bg-red-50/30" : "border-slate-200"
              )}
              placeholder="e.g. Westlands, Nairobi"
              value={form.location}
              onChange={(e) => updateField("location", e.target.value)}
            />
            {errors.location && <p className="text-sm text-red-500 mt-1">{errors.location}</p>}
          </div>
          <div>
            <label className="label-caps text-slate-500 mb-1.5 block">Property Type</label>
            <select
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-base text-slate-800 focus:outline-none focus:border-[#151936]/40 transition-colors"
              value={form.propertyType}
              onChange={(e) => updateField("propertyType", e.target.value)}
            >
              {PROPERTY_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Owner Landlord Dropdown */}
        <div>
          <label className="label-caps text-slate-500 mb-1.5 block">Portfolio Owner (Landlord)</label>
          <select
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-base text-slate-800 focus:outline-none focus:border-[#151936]/40 transition-colors"
            value={form.ownerContactId}
            onChange={(e) => updateField("ownerContactId", e.target.value)}
          >
            <option value="">-- No Owner Assigned / Direct Inventory --</option>
            {landlords.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </div>

        {/* Listing Type + Financials */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="label-caps text-slate-500 mb-1.5 block">Listing Type</label>
            <select
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-base text-slate-800 focus:outline-none focus:border-[#151936]/40 transition-colors"
              value={form.listingType}
              onChange={(e) => updateField("listingType", e.target.value as any)}
            >
              <option value="Rent">Rent</option>
              <option value="Sale">Sale</option>
            </select>
          </div>

          <div className="sm:col-span-2">
            {form.listingType === "Rent" ? (
              <div>
                <label className="label-caps text-slate-500 mb-1.5 block font-mono">Monthly Rent (KES)</label>
                <input
                  className={cn(
                    "w-full rounded-lg border bg-white px-3 py-2 text-base font-mono text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#151936]/40 transition-colors",
                    errors.monthlyRentKes ? "border-red-300 bg-red-50/30" : "border-slate-200"
                  )}
                  placeholder="e.g. 85000"
                  value={form.monthlyRentKes}
                  onChange={(e) => updateField("monthlyRentKes", e.target.value)}
                />
                {errors.monthlyRentKes && <p className="text-sm text-red-500 mt-1">{errors.monthlyRentKes}</p>}
              </div>
            ) : (
              <div>
                <label className="label-caps text-slate-500 mb-1.5 block font-mono">Asking Price (KES)</label>
                <input
                  className={cn(
                    "w-full rounded-lg border bg-white px-3 py-2 text-base font-mono text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#151936]/40 transition-colors",
                    errors.askingPriceKes ? "border-red-300 bg-red-50/30" : "border-slate-200"
                  )}
                  placeholder="e.g. 15000000"
                  value={form.askingPriceKes}
                  onChange={(e) => updateField("askingPriceKes", e.target.value)}
                />
                {errors.askingPriceKes && <p className="text-sm text-red-500 mt-1">{errors.askingPriceKes}</p>}
              </div>
            )}
          </div>
        </div>

        {/* Specs: Bed, Bath, Size */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="label-caps text-slate-500 mb-1.5 block">Bedrooms</label>
            <input
              type="number"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-base text-slate-800 focus:outline-none focus:border-[#151936]/40 transition-colors"
              placeholder="e.g. 3"
              value={form.bedrooms ?? ""}
              onChange={(e) => updateField("bedrooms", e.target.value ? parseInt(e.target.value) : null)}
            />
          </div>
          <div>
            <label className="label-caps text-slate-500 mb-1.5 block">Bathrooms</label>
            <input
              type="number"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-base text-slate-800 focus:outline-none focus:border-[#151936]/40 transition-colors"
              placeholder="e.g. 2"
              value={form.bathrooms ?? ""}
              onChange={(e) => updateField("bathrooms", e.target.value ? parseInt(e.target.value) : null)}
            />
          </div>
          <div>
            <label className="label-caps text-slate-500 mb-1.5 block">Size (SqFt)</label>
            <input
              type="number"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-base text-slate-800 focus:outline-none focus:border-[#151936]/40 transition-colors"
              placeholder="e.g. 1500"
              value={form.sizeSqft ?? ""}
              onChange={(e) => updateField("sizeSqft", e.target.value ? parseInt(e.target.value) : null)}
            />
          </div>
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
                <span>Enrolling…</span>
              </>
            ) : (
              mode === "create" ? "Register Property" : "Save Changes"
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
