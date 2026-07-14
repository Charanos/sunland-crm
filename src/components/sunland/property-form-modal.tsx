"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { CldUploadButton } from "next-cloudinary";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useToast } from "@/components/ui/toast-provider";
import { useUIStore } from "@/store/ui";
import { cn } from "@/lib/utils/cn";
import { IconPlus, IconTrash, IconPhotoUp, IconFileText, IconExternalLink, IconBuildingSkyscraper } from "@tabler/icons-react";

type MediaEntry = { url: string; alt?: string };
type UnitBreakdownEntry = { unitType: string; count: number; monthlyRentKes: string };
type LandlordDocument = { id: string; type: string; title: string; fileUrl: string; createdAt: string };

const LANDLORD_DOCUMENT_TYPES = [
  { value: "title_deed", label: "Title Deed" },
  { value: "identification", label: "Landlord ID / Passport" },
  { value: "mandate_letter", label: "Mandate Letter" },
  { value: "statement", label: "Statement" },
];

export interface PropertyFormData {
  id?: string;
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
  landAreaSqft: number | null;
  yearBuilt: number | null;
  parkingSpaces: number | null;
  amenities: string[];
  description: string;
  media: MediaEntry[];
  unitBreakdown: UnitBreakdownEntry[];
}

import { AMENITIES_LIST } from "./property-constants";

const PROPERTY_TYPES = ["Apartment", "Commercial", "House", "Land", "Villa"];

// Property types that plausibly consist of multiple sub-units rather than a
// single dwelling - these trigger the unit-breakdown editor instead of a flat
// bedrooms/bathrooms count, since "3 bedrooms" doesn't describe an apartment
// block with a mix of bedsitters and 1BRs.
const MULTI_UNIT_TYPES = ["Apartment", "Commercial"];

const UNIT_TYPE_OPTIONS = [
  "Bedsitter",
  "Single Room",
  "One Bedroom",
  "Two Bedroom",
  "Three Bedroom",
  "Studio",
  "Penthouse",
  "Shop / Retail Unit",
  "Office Unit",
  "Other",
];

// Cloudinary is a declared dependency but not yet configured (cloud name +
// upload preset are empty in .env.local) - the upload button only renders
// once real credentials exist; a manual URL field is always available so
// image capture never hard-depends on that configuration landing.
const CLOUDINARY_CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
const CLOUDINARY_CONFIGURED = Boolean(CLOUDINARY_CLOUD_NAME && CLOUDINARY_UPLOAD_PRESET);

export interface PropertySubmitData {
  id: string;
  name: string;
  location: string;
  type: string;
  status: "Available" | "Sold" | "Under Offer" | "Occupied";
  price: string;
  roi?: string;
  imageUrl: string | null;
  propertyCode?: string;
  ownerContactId?: string | null;
  monthlyRentKes?: string | null;
  askingPriceKes?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  sizeSqft?: number | null;
}

export function PropertyFormModal({
  open,
  onClose,
  onSubmit,
  initialData,
  mode = "create",
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: PropertySubmitData) => void;
  initialData?: Record<string, unknown> | null;
  mode?: "create" | "edit";
}) {
  const { pushToast } = useToast();
  const { activeEntityId } = useUIStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof PropertyFormData, string>>>({});
  const [landlords, setLandlords] = useState<{ id: string; name: string }[]>([]);
  const [manualImageUrl, setManualImageUrl] = useState("");

  const [form, setForm] = useState<PropertyFormData>({
    id: initialData?.id as string | undefined,
    propertyCode: (initialData?.propertyCode as string | undefined) ?? "",
    name: (initialData?.name as string | undefined) ?? "",
    propertyType: (initialData?.propertyType as string | undefined) ?? (initialData?.type as string | undefined) ?? "Apartment",
    listingType: (initialData?.listingType as "Rent" | "Sale" | undefined) ?? "Rent",
    location: (initialData?.location as string | undefined) ?? "",
    ownerContactId: (initialData?.ownerContactId as string | undefined) ?? "",
    monthlyRentKes: (initialData?.monthlyRentKes as string | undefined) ?? (initialData?.listingType === "Rent" || !initialData?.listingType ? (initialData?.price as string | undefined) : "") ?? "",
    askingPriceKes: (initialData?.askingPriceKes as string | undefined) ?? (initialData?.listingType === "Sale" ? (initialData?.price as string | undefined) : "") ?? "",
    bedrooms: (initialData?.bedrooms as number | undefined) ?? null,
    bathrooms: (initialData?.bathrooms as number | undefined) ?? null,
    sizeSqft: (initialData?.sizeSqft as number | undefined) ?? null,
    landAreaSqft: (initialData?.landAreaSqft as number | undefined) ?? null,
    yearBuilt: (initialData?.yearBuilt as number | undefined) ?? null,
    parkingSpaces: (initialData?.parkingSpaces as number | undefined) ?? null,
    amenities: (initialData?.amenities as string[] | undefined) ?? [],
    description: (initialData?.description as string | undefined) ?? "",
    media: (initialData?.media as MediaEntry[] | undefined) ?? [],
    unitBreakdown: (initialData?.unitBreakdown as UnitBreakdownEntry[] | undefined) ?? [],
  });

  const isMultiUnit = MULTI_UNIT_TYPES.includes(form.propertyType);

  // Load landlords list for dropdown
  useEffect(() => {
    if (!open || !activeEntityId) return;
    const fetchLandlords = async () => {
      try {
        const res = await fetch(`/api/contacts?entityId=${activeEntityId}&type=landlord`);
        const data = await res.json();
        if (data.contacts) {
          setLandlords(data.contacts.map((c: { id: string; displayName: string }) => ({ id: c.id, name: c.displayName })));
        }
      } catch (err) {
        console.error("Failed to load landlords:", err);
      }
    };
    fetchLandlords();
  }, [open, activeEntityId]);

  // Landlord documents (title deeds, ID) - scoped to the selected owner
  // contact via the existing documents API, not tied to this specific
  // property, since the same landlord's title deed/ID is reused across
  // every property they own.
  const [landlordDocuments, setLandlordDocuments] = useState<LandlordDocument[]>([]);
  const [docTitle, setDocTitle] = useState("");
  const [docType, setDocType] = useState(LANDLORD_DOCUMENT_TYPES[0].value);
  const [docUrl, setDocUrl] = useState("");
  const [isAddingDoc, setIsAddingDoc] = useState(false);

  const fetchLandlordDocuments = async (ownerContactId: string) => {
    const res = await fetch(`/api/documents?entityId=${activeEntityId}&ownerContactId=${ownerContactId}`);
    const data = await res.json();
    return data.documents ?? [];
  };

  useEffect(() => {
    // The documents section only renders when an owner is selected, so
    // stale state while unselected is never shown - no need to clear it.
    if (!open || !activeEntityId || !form.ownerContactId) return;
    const load = async () => {
      try {
        setLandlordDocuments(await fetchLandlordDocuments(form.ownerContactId));
      } catch (err) {
        console.error("Failed to load landlord documents:", err);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activeEntityId, form.ownerContactId]);

  const addLandlordDocument = async () => {
    if (!docTitle.trim() || !docUrl.trim() || !form.ownerContactId) return;
    setIsAddingDoc(true);
    try {
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityId: activeEntityId,
          type: docType,
          title: docTitle.trim(),
          fileUrl: docUrl.trim(),
          ownerContactId: form.ownerContactId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to attach document");
      setDocTitle("");
      setDocUrl("");
      setLandlordDocuments(await fetchLandlordDocuments(form.ownerContactId));
      pushToast({ tone: "success", title: "Document Attached", body: `${docTitle} has been catalogued for this landlord.` });
    } catch (err) {
      pushToast({ tone: "warning", title: "Failed to attach document", body: err instanceof Error ? err.message : "Could not attach document." });
    } finally {
      setIsAddingDoc(false);
    }
  };

  const updateField = <K extends keyof PropertyFormData>(
    field: K,
    value: PropertyFormData[K]
  ) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  // ─── Amenities ───────────────────────────────────────────────────────
  const toggleAmenity = (amenity: string) => {
    setForm((prev) => {
      const current = prev.amenities || [];
      if (current.includes(amenity)) {
        return { ...prev, amenities: current.filter((a) => a !== amenity) };
      }
      return { ...prev, amenities: [...current, amenity] };
    });
  };

  // ─── Unit breakdown editor (multi-unit property types) ─────────────────
  const addUnitRow = () => {
    updateField("unitBreakdown", [...form.unitBreakdown, { unitType: UNIT_TYPE_OPTIONS[0], count: 1, monthlyRentKes: "" }]);
  };
  const updateUnitRow = (index: number, patch: Partial<UnitBreakdownEntry>) => {
    updateField("unitBreakdown", form.unitBreakdown.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };
  const removeUnitRow = (index: number) => {
    updateField("unitBreakdown", form.unitBreakdown.filter((_, i) => i !== index));
  };
  const totalUnits = form.unitBreakdown.reduce((sum, row) => sum + (row.count || 0), 0);

  // ─── Media ────────────────────────────────────────────────────────────
  const addImageUrl = () => {
    if (!manualImageUrl.trim()) return;
    updateField("media", [...form.media, { url: manualImageUrl.trim() }]);
    setManualImageUrl("");
  };
  const removeImage = (index: number) => {
    updateField("media", form.media.filter((_, i) => i !== index));
  };

  // Auto-compute total rent from unit mix if it's a multi-unit property
  const computedTotalRent = form.unitBreakdown.reduce((sum, row) => {
    const count = parseInt(row.count?.toString() || "0", 10) || 0;
    const rent = parseFloat(row.monthlyRentKes?.toString() || "0") || 0;
    return sum + (count * rent);
  }, 0);

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof PropertyFormData, string>> = {};
    if (!form.name.trim()) newErrors.name = "Property name is required";
    if (!form.location.trim()) newErrors.location = "Location is required";
    if (form.listingType === "Rent") {
      if (isMultiUnit && computedTotalRent === 0) {
        newErrors.monthlyRentKes = "Add units with rent to compute total";
      } else if (!isMultiUnit && !form.monthlyRentKes.trim()) {
        newErrors.monthlyRentKes = "Monthly Rent is required";
      }
    }
    if (form.listingType === "Sale") {
      if (isMultiUnit && computedTotalRent === 0) {
        newErrors.askingPriceKes = "Add units with price to compute total";
      } else if (!isMultiUnit && !form.askingPriceKes.trim()) {
        newErrors.askingPriceKes = "Asking Price is required";
      }
    }
    // Backend's validateUnitBreakdown rejects any row with count < 1 - catch
    // it here so the error is attributable to the offending row instead of a
    // generic "Failed to save" toast after a round-trip.
    if (isMultiUnit && form.unitBreakdown.some((row) => !row.count || row.count < 1)) {
      newErrors.unitBreakdown = "Every unit row needs at least 1 unit";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setIsSubmitting(true);

    try {
      // Editing must PATCH the existing record - previously this always
      // POSTed regardless of mode, silently creating a duplicate property
      // on every edit while a separate parent-level PATCH updated the
      // original. Fixed: one request, the right verb.
      const isEdit = mode === "edit" && !!form.id;
      const body = {
        entityId: activeEntityId,
        propertyCode: form.propertyCode,
        name: form.name,
        propertyType: form.propertyType,
        listingType: form.listingType,
        location: form.location,
        ownerContactId: form.ownerContactId || null,
        monthlyRentKes: form.listingType === "Rent" ? (isMultiUnit ? computedTotalRent.toString() : form.monthlyRentKes) : null,
        askingPriceKes: form.listingType === "Sale" ? (isMultiUnit ? computedTotalRent.toString() : form.askingPriceKes) : null,
        bedrooms: isMultiUnit ? null : form.bedrooms,
        bathrooms: isMultiUnit ? null : form.bathrooms,
        sizeSqft: form.sizeSqft,
        landAreaSqft: form.landAreaSqft,
        yearBuilt: form.yearBuilt,
        parkingSpaces: form.parkingSpaces,
        amenities: form.amenities,
        description: form.description.trim() || null,
        media: form.media,
        // Empty per-unit rent is coerced to undefined rather than sent as a
        // literal "" - consistent with how the top-level rent/price fields
        // use null for "not applicable" instead of an empty string.
        unitBreakdown: isMultiUnit
          ? form.unitBreakdown.map((row) => ({
            ...row,
            monthlyRentKes: row.monthlyRentKes?.trim() ? row.monthlyRentKes : undefined,
          }))
          : [],
      };

      const res = await fetch(isEdit ? `/api/properties?id=${form.id}` : "/api/properties", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save property");

      const ret = data.property;
      onSubmit({
        id: ret.id,
        name: ret.name,
        location: ret.location,
        type: ret.propertyType,
        status: ret.status === "occupied" ? "Occupied" : "Available",
        price: ret.monthlyRentKes || ret.askingPriceKes || "0",
        roi: "",
        imageUrl: ret.media?.[0]?.url ?? null,
        propertyCode: ret.propertyCode,
        ownerContactId: ret.ownerContactId,
        monthlyRentKes: ret.monthlyRentKes,
        askingPriceKes: ret.askingPriceKes,
        bedrooms: ret.bedrooms,
        bathrooms: ret.bathrooms,
        sizeSqft: ret.sizeSqft,
      });
      pushToast({
        tone: "success",
        title: mode === "create" ? "Property Created" : "Property Updated",
        body: `${form.name} has been ${mode === "create" ? "enrolled" : "updated"} successfully.`,
      });
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "An unexpected error occurred";
      pushToast({
        tone: "warning",
        title: "Failed to save",
        body: message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const displayRent = isMultiUnit ? computedTotalRent.toString() : (form.listingType === "Rent" ? form.monthlyRentKes : form.askingPriceKes);

  return (
    <Modal
      open={open}
      onClose={isSubmitting ? () => { } : onClose}
      title={mode === "create" ? "Register Property Portfolio" : "Edit Property"}
      description={mode === "create" ? "Add a new managed property linked to an owner contact" : "Update property details"}
      size="xl"
    >
      <div className="space-y-6">
        {/* Section 1: Core Details */}
        <div className="bg-slate-50/50 rounded-xl p-5 border border-slate-100 space-y-4">
          <h3 className="text-title-primary border-b border-slate-200 pb-2 mb-4">Core Details</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="label-caps text-slate-400 mb-1.5 block">Property ID</label>
              <div className="flex h-10 items-center px-3 rounded-lg border border-slate-200 bg-slate-100/50 text-slate-400 mono-data shadow-sm">
                {mode === "create" ? "Auto-generated" : form.propertyCode}
              </div>
            </div>
            <div className="sm:col-span-2">
              <label className="label-caps text-slate-400 mb-1.5 block">Property Name</label>
              <input
                className={cn(
                  "w-full h-10 rounded-lg border bg-white px-3 text-body-primary placeholder:text-slate-400 focus:outline-none focus:border-[#151936]/40 transition-colors shadow-sm",
                  errors.name ? "border-red-300 bg-red-50/30" : "border-slate-200"
                )}
                placeholder="e.g. Park View Apartment 4B"
                value={form.name}
                onChange={(e) => updateField("name", e.target.value)}
              />
              {errors.name && <p className="text-meta-muted-strong text-red-500 mt-1">{errors.name}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label-caps text-slate-400 mb-1.5 block">Location</label>
              <input
                className={cn(
                  "w-full h-10 rounded-lg border bg-white px-3 text-body-primary placeholder:text-slate-400 focus:outline-none focus:border-[#151936]/40 transition-colors shadow-sm",
                  errors.location ? "border-red-300 bg-red-50/30" : "border-slate-200"
                )}
                placeholder="e.g. Westlands, Nairobi"
                value={form.location}
                onChange={(e) => updateField("location", e.target.value)}
              />
              {errors.location && <p className="text-meta-muted-strong text-red-500 mt-1">{errors.location}</p>}
            </div>
            <div>
              <label className="label-caps text-slate-400 mb-1.5 block">Property Type</label>
              <select
                className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-body-primary focus:outline-none focus:border-[#151936]/40 transition-colors shadow-sm"
                value={form.propertyType}
                onChange={(e) => updateField("propertyType", e.target.value)}
              >
                {PROPERTY_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="label-caps text-slate-400 mb-1.5 block">Description</label>
            <textarea
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-body-primary resize-none h-20 placeholder:text-slate-400 focus:outline-none focus:border-[#151936]/40 transition-colors shadow-sm"
              placeholder="Short marketing/context blurb shown on the property's full view…"
              value={form.description}
              onChange={(e) => updateField("description", e.target.value)}
            />
          </div>
        </div>

        {/* Section 2: Ownership & Legal */}
        <div className="bg-slate-50/50 rounded-xl p-5 border border-slate-100 space-y-4">
          <h3 className="text-title-primary border-b border-slate-200 pb-2 mb-4">Ownership & Legal</h3>
          <div>
            <label className="label-caps text-slate-400 mb-1.5 block">Portfolio Owner (Landlord)</label>
            <select
              className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-body-primary focus:outline-none focus:border-[#151936]/40 transition-colors shadow-sm"
              value={form.ownerContactId}
              onChange={(e) => updateField("ownerContactId", e.target.value)}
            >
              <option value="">-- No Owner Assigned / Direct Inventory --</option>
              {landlords.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>

          {form.ownerContactId && (
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm mt-4">
              <label className="text-desc-secondary block mb-1">Landlord Documents</label>
              <p className="text-meta-muted mb-4">Title deed, identification, and mandate paperwork for this landlord.</p>

              {landlordDocuments.length > 0 && (
                <div className="space-y-2 mb-4">
                  {landlordDocuments.map((doc) => (
                    <a
                      key={doc.id}
                      href={doc.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-slate-50 border border-slate-100 hover:border-slate-200 hover:bg-slate-100/50 transition-colors group"
                    >
                      <div className="size-8 rounded-md bg-white border border-slate-200 flex items-center justify-center shrink-0">
                        <IconFileText size={16} className="text-slate-400" />
                      </div>
                      <span className="text-body-primary truncate flex-1">{doc.title}</span>
                      <span className="text-meta-muted shrink-0 bg-white px-2 py-0.5 rounded-md border border-slate-100">
                        {LANDLORD_DOCUMENT_TYPES.find((t) => t.value === doc.type)?.label ?? doc.type}
                      </span>
                      <IconExternalLink size={14} className="text-slate-300 group-hover:text-slate-400 transition-colors shrink-0" />
                    </a>
                  ))}
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                <input
                  className="flex-1 w-full h-10 rounded-lg border border-slate-200 bg-slate-50 px-3 text-body-primary placeholder:text-slate-400 focus:outline-none focus:border-[#151936]/40 transition-colors"
                  placeholder="Document title"
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                />
                <select
                  className="w-full sm:w-[180px] h-10 rounded-lg border border-slate-200 bg-slate-50 px-3 text-body-primary focus:outline-none focus:border-[#151936]/40 transition-colors shrink-0"
                  value={docType}
                  onChange={(e) => setDocType(e.target.value)}
                >
                  {LANDLORD_DOCUMENT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
                <input
                  className="flex-1 w-full h-10 rounded-lg border border-slate-200 bg-slate-50 px-3 text-body-primary placeholder:text-slate-400 focus:outline-none focus:border-[#151936]/40 transition-colors"
                  placeholder="Document URL"
                  value={docUrl}
                  onChange={(e) => setDocUrl(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addLandlordDocument(); } }}
                />
                <button
                  type="button"
                  onClick={addLandlordDocument}
                  disabled={isAddingDoc || !docTitle.trim() || !docUrl.trim()}
                  className="w-full sm:w-auto h-10 flex items-center justify-center gap-1.5 text-body-primary text-slate-700 bg-white border border-slate-200 px-4 rounded-lg shadow-sm hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                >
                  {isAddingDoc ? <LoadingSpinner size="sm" /> : <><IconPlus size={16} /> Attach</>}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Section 3: Financials & Listing */}
        <div className="bg-slate-50/50 rounded-xl p-5 border border-slate-100 space-y-4">
          <h3 className="text-title-primary border-b border-slate-200 pb-2 mb-4">Financials & Listing</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="label-caps text-slate-400 mb-1.5 block">Listing Type</label>
              <select
                className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-body-primary focus:outline-none focus:border-[#151936]/40 transition-colors shadow-sm"
                value={form.listingType}
                onChange={(e) => updateField("listingType", e.target.value as "Rent" | "Sale")}
              >
                <option value="Rent">Rent</option>
                <option value="Sale">Sale</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              {form.listingType === "Rent" ? (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="label-caps text-slate-400">
                      {isMultiUnit ? "Expected Total Monthly Rent (KES)" : "Monthly Rent (KES)"}
                    </label>
                    {isMultiUnit && (
                      <span className="text-meta-muted italic">Auto-computed from unit mix</span>
                    )}
                  </div>
                  <input
                    className={cn(
                      "w-full h-10 rounded-lg border bg-white px-3 mono-data placeholder:text-slate-400 focus:outline-none focus:border-[#151936]/40 transition-colors shadow-sm",
                      errors.monthlyRentKes ? "border-red-300 bg-red-50/30" : "border-slate-200",
                      isMultiUnit ? "bg-slate-100/50 text-slate-400 cursor-not-allowed" : ""
                    )}
                    placeholder="e.g. 85000"
                    value={displayRent}
                    disabled={isMultiUnit}
                    onChange={(e) => updateField("monthlyRentKes", e.target.value)}
                  />
                  {errors.monthlyRentKes && <p className="text-meta-muted-strong text-red-500 mt-1">{errors.monthlyRentKes}</p>}
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="label-caps text-slate-400">
                      {isMultiUnit ? "Expected Total Asking Price (KES)" : "Asking Price (KES)"}
                    </label>
                    {isMultiUnit && (
                      <span className="text-meta-muted italic">Auto-computed from unit mix</span>
                    )}
                  </div>
                  <input
                    className={cn(
                      "w-full h-10 rounded-lg border bg-white px-3 mono-data placeholder:text-slate-400 focus:outline-none focus:border-[#151936]/40 transition-colors shadow-sm",
                      errors.askingPriceKes ? "border-red-300 bg-red-50/30" : "border-slate-200",
                      isMultiUnit ? "bg-slate-100/50 text-slate-400 cursor-not-allowed" : ""
                    )}
                    placeholder="e.g. 15000000"
                    value={displayRent}
                    disabled={isMultiUnit}
                    onChange={(e) => updateField("askingPriceKes", e.target.value)}
                  />
                  {errors.askingPriceKes && <p className="text-meta-muted-strong text-red-500 mt-1">{errors.askingPriceKes}</p>}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Section 4: Property Specs */}
        <div className="bg-slate-50/50 rounded-xl p-5 border border-slate-100 space-y-4">
          <h3 className="text-title-primary border-b border-slate-200 pb-2 mb-4">Property Specs</h3>
          {isMultiUnit ? (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <label className="label-caps text-slate-400 block">Unit Mix</label>
                  <p className="text-meta-muted mt-1">
                    Capture each unit type this property is made up of. Total: <span className="mono-amount text-slate-600 px-1 py-0.5 bg-slate-200/50 rounded">{totalUnits}</span> unit{totalUnits === 1 ? "" : "s"}.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addUnitRow}
                  className="flex items-center gap-1.5 text-body-primary text-[#151936] bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-sm hover:bg-slate-50 transition-colors shrink-0"
                >
                  <IconPlus size={16} stroke={2} /> Add Unit Type
                </button>
              </div>

              {form.unitBreakdown.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-200 rounded-xl bg-white text-center">
                  <div className="size-10 rounded-full bg-slate-50 flex items-center justify-center mb-2 border border-slate-100">
                    <IconBuildingSkyscraper size={20} className="text-slate-400" />
                  </div>
                  <p className="text-body-regular text-slate-400">No unit types added yet.</p>
                  <p className="text-meta-muted mt-1">Click &quot;Add Unit Type&quot; to break down this property.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {form.unitBreakdown.map((row, index) => (
                    <div key={index} className="grid grid-cols-[1fr_90px_140px_40px] gap-3 items-center bg-white p-2 rounded-lg border border-slate-200 shadow-sm">
                      <select
                        className="h-10 rounded-lg border border-slate-100 bg-slate-50 px-3 text-body-primary focus:outline-none focus:border-[#151936]/40 transition-colors"
                        value={row.unitType}
                        onChange={(e) => updateUnitRow(index, { unitType: e.target.value })}
                      >
                        {UNIT_TYPE_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min={1}
                        className="h-10 rounded-lg border border-slate-100 bg-slate-50 px-3 mono-data focus:outline-none focus:border-[#151936]/40 transition-colors"
                        placeholder="Count"
                        value={row.count}
                        onChange={(e) => updateUnitRow(index, { count: e.target.value ? parseInt(e.target.value) : 0 })}
                      />
                      <input
                        type="number"
                        className="h-10 rounded-lg border border-slate-100 bg-slate-50 px-3 mono-data placeholder:text-slate-400 focus:outline-none focus:border-[#151936]/40 transition-colors"
                        placeholder="Rent/unit"
                        value={row.monthlyRentKes}
                        onChange={(e) => updateUnitRow(index, { monthlyRentKes: e.target.value })}
                      />
                      <button
                        type="button"
                        onClick={() => removeUnitRow(index)}
                        className="size-10 flex items-center justify-center rounded-lg text-rose-500 hover:bg-rose-50 transition-colors"
                        aria-label="Remove unit type"
                      >
                        <IconTrash size={18} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {errors.unitBreakdown && (
                <p className="text-meta-muted-strong text-red-500 mt-2">{errors.unitBreakdown}</p>
              )}

              <div className="mt-6 pt-4 border-t border-slate-200">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <label className="label-caps text-slate-400 mb-1.5 block">Total Size (SqFt)</label>
                    <input
                      type="number"
                      className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 mono-data focus:outline-none focus:border-[#151936]/40 transition-colors shadow-sm"
                      placeholder="e.g. 12000"
                      value={form.sizeSqft ?? ""}
                      onChange={(e) => updateField("sizeSqft", e.target.value ? parseInt(e.target.value) : null)}
                    />
                  </div>
                  <div>
                    <label className="label-caps text-slate-400 mb-1.5 block">Land Area (SqFt)</label>
                    <input
                      type="number"
                      className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 mono-data focus:outline-none focus:border-[#151936]/40 transition-colors shadow-sm"
                      placeholder="e.g. 5000"
                      value={form.landAreaSqft ?? ""}
                      onChange={(e) => updateField("landAreaSqft", e.target.value ? parseInt(e.target.value) : null)}
                    />
                  </div>
                  <div>
                    <label className="label-caps text-slate-400 mb-1.5 block">Year Built</label>
                    <input
                      type="number"
                      className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 mono-data focus:outline-none focus:border-[#151936]/40 transition-colors shadow-sm"
                      placeholder="e.g. 2018"
                      value={form.yearBuilt ?? ""}
                      onChange={(e) => updateField("yearBuilt", e.target.value ? parseInt(e.target.value) : null)}
                    />
                  </div>
                  <div>
                    <label className="label-caps text-slate-400 mb-1.5 block">Parking Spaces</label>
                    <input
                      type="number"
                      className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 mono-data focus:outline-none focus:border-[#151936]/40 transition-colors shadow-sm"
                      placeholder="e.g. 20"
                      value={form.parkingSpaces ?? ""}
                      onChange={(e) => updateField("parkingSpaces", e.target.value ? parseInt(e.target.value) : null)}
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <label className="label-caps text-slate-400 mb-1.5 block">Bedrooms</label>
                <input
                  type="number"
                  className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 mono-data focus:outline-none focus:border-[#151936]/40 transition-colors shadow-sm"
                  placeholder="e.g. 3"
                  value={form.bedrooms ?? ""}
                  onChange={(e) => updateField("bedrooms", e.target.value ? parseInt(e.target.value) : null)}
                />
              </div>
              <div>
                <label className="label-caps text-slate-400 mb-1.5 block">Bathrooms</label>
                <input
                  type="number"
                  className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 mono-data focus:outline-none focus:border-[#151936]/40 transition-colors shadow-sm"
                  placeholder="e.g. 2"
                  value={form.bathrooms ?? ""}
                  onChange={(e) => updateField("bathrooms", e.target.value ? parseInt(e.target.value) : null)}
                />
              </div>
              <div>
                <label className="label-caps text-slate-400 mb-1.5 block">Size (SqFt)</label>
                <input
                  type="number"
                  className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 mono-data focus:outline-none focus:border-[#151936]/40 transition-colors shadow-sm"
                  placeholder="e.g. 1500"
                  value={form.sizeSqft ?? ""}
                  onChange={(e) => updateField("sizeSqft", e.target.value ? parseInt(e.target.value) : null)}
                />
              </div>
              <div>
                <label className="label-caps text-slate-400 mb-1.5 block">Land Area (SqFt)</label>
                <input
                  type="number"
                  className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 mono-data focus:outline-none focus:border-[#151936]/40 transition-colors shadow-sm"
                  placeholder="e.g. 5000"
                  value={form.landAreaSqft ?? ""}
                  onChange={(e) => updateField("landAreaSqft", e.target.value ? parseInt(e.target.value) : null)}
                />
              </div>
              <div>
                <label className="label-caps text-slate-400 mb-1.5 block">Year Built</label>
                <input
                  type="number"
                  className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 mono-data focus:outline-none focus:border-[#151936]/40 transition-colors shadow-sm"
                  placeholder="e.g. 2018"
                  value={form.yearBuilt ?? ""}
                  onChange={(e) => updateField("yearBuilt", e.target.value ? parseInt(e.target.value) : null)}
                />
              </div>
              <div>
                <label className="label-caps text-slate-400 mb-1.5 block">Parking Spaces</label>
                <input
                  type="number"
                  className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 mono-data focus:outline-none focus:border-[#151936]/40 transition-colors shadow-sm"
                  placeholder="e.g. 2"
                  value={form.parkingSpaces ?? ""}
                  onChange={(e) => updateField("parkingSpaces", e.target.value ? parseInt(e.target.value) : null)}
                />
              </div>
            </div>
          )}

          {/* Amenities Selector */}
          <div className="mt-6 pt-4 border-t border-slate-200">
            <label className="label-caps text-slate-400 mb-2 block">Amenities & Features</label>
            <div className="flex flex-wrap gap-2">
              {AMENITIES_LIST.map((amenity) => {
                const isSelected = form.amenities.includes(amenity);
                return (
                  <button
                    key={amenity}
                    type="button"
                    onClick={() => toggleAmenity(amenity)}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-sm border transition-colors",
                      isSelected
                        ? "bg-[#151936] border-[#151936] text-white"
                        : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                    )}
                  >
                    {amenity}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Section 5: Media */}
        <div className="bg-slate-50/50 rounded-xl p-5 border border-slate-100 space-y-4">
          <h3 className="text-title-primary border-b border-slate-200 pb-2 mb-4">Media Gallery</h3>
          <label className="label-caps text-slate-400 mb-1.5 block">Photos</label>

          {form.media.length > 0 ? (
            <div className="flex flex-wrap gap-3 mb-4">
              {form.media.map((m, index) => (
                <div key={index} className="relative size-24 rounded-xl overflow-hidden border border-slate-200 group shadow-sm bg-white">
                  <Image src={m.url} alt={m.alt ?? form.name} fill sizes="96px" className="object-cover" />
                  <button
                    type="button"
                    onClick={() => removeImage(index)}
                    className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white backdrop-blur-[1px]"
                    aria-label="Remove image"
                  >
                    <IconTrash size={20} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-200 rounded-xl bg-white text-center mb-4">
              <div className="size-10 rounded-full bg-slate-50 flex items-center justify-center mb-2 border border-slate-100">
                <IconPhotoUp size={20} className="text-slate-400" />
              </div>
              <p className="text-body-regular text-slate-400">No photos added yet.</p>
              <p className="text-meta-muted mt-1">Upload images to showcase the property.</p>
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center gap-3">
            <input
              className="flex-1 w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-body-primary placeholder:text-slate-400 focus:outline-none focus:border-[#151936]/40 transition-colors shadow-sm"
              placeholder="Paste an image URL…"
              value={manualImageUrl}
              onChange={(e) => setManualImageUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addImageUrl(); } }}
            />
            <button
              type="button"
              onClick={addImageUrl}
              className="w-full sm:w-auto shrink-0 flex items-center justify-center gap-2 text-body-primary text-slate-700 bg-white border border-slate-200 h-10 px-4 rounded-lg shadow-sm hover:bg-slate-50 transition-colors"
            >
              <IconPlus size={16} /> Add URL
            </button>
            {CLOUDINARY_CONFIGURED ? (
              <CldUploadButton
                uploadPreset={CLOUDINARY_UPLOAD_PRESET}
                onSuccess={(results) => {
                  const info = results.info;
                  if (info && typeof info === "object" && "secure_url" in info) {
                    updateField("media", [...form.media, { url: info.secure_url as string }]);
                  }
                }}
                className="w-full sm:w-auto shrink-0 flex items-center justify-center gap-2 text-body-primary text-[#151936] bg-[#f3df27] h-10 px-4 rounded-lg shadow-sm hover:bg-[#e6d220] transition-colors"
              >
                <IconPhotoUp size={16} /> Upload
              </CldUploadButton>
            ) : (
              <span
                title="Cloudinary isn't configured yet (NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME / NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET) - paste an image URL instead."
                className="w-full sm:w-auto shrink-0 flex items-center justify-center gap-2 text-body-primary text-slate-400 bg-slate-50 border border-slate-200 h-10 px-4 rounded-lg cursor-not-allowed"
              >
                <IconPhotoUp size={16} /> Upload
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-6 border-t border-slate-200">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <LoadingSpinner size="sm" />
                <span className="ml-2">{mode === "create" ? "Enrolling…" : "Saving…"}</span>
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
