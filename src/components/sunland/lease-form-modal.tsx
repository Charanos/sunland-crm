"use client";

import { useEffect, useState } from "react";
import {
  IconBuildingCommunity,
  IconUserCheck,
  IconShieldCheck,
  IconFileText,
  IconBuildingBank,
  IconCalendar,
} from "@tabler/icons-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/erp-primitives";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useToast } from "@/components/ui/toast-provider";
import { useUIStore } from "@/store/ui";
import { cn } from "@/lib/utils/cn";
import { formatCompactKES } from "@/lib/utils/format";

export interface LeaseFormData {
  propertyId: string;
  tenantContactId: string;
  startsAt: string;
  endsAt: string;
  monthlyRentKes: string;
  depositKes: string;
  notes: string;
}

export interface LeaseEditTarget {
  id: string;
  propertyName: string;
  tenantName: string;
  startsAt: string;
  endsAt: string;
  monthlyRentKes: string;
  depositKes: string | null;
  notes?: string | null;
}

function toDateInput(iso: string): string {
  return iso ? iso.slice(0, 10) : "";
}

export function LeaseFormModal({
  open,
  mode = "create",
  lease,
  onClose,
  onSubmit,
  defaultPropertyId,
  defaultPropertyName,
  defaultUnitId,
}: {
  open: boolean;
  mode?: "create" | "edit";
  lease?: LeaseEditTarget | null;
  onClose: () => void;
  onSubmit: () => void;
  defaultPropertyId?: string;
  defaultPropertyName?: string;
  defaultUnitId?: string;
}) {
  const { pushToast } = useToast();
  const { activeEntityId } = useUIStore();
  const isEdit = mode === "edit" && !!lease;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof LeaseFormData, string>>>({});
  const [properties, setProperties] = useState<{ id: string; name: string; monthlyRentKes: string | null }[]>([]);
  const [tenants, setTenants] = useState<{ id: string; name: string }[]>([]);

  const [form, setForm] = useState<LeaseFormData>({
    propertyId: "",
    tenantContactId: "",
    startsAt: "",
    endsAt: "",
    monthlyRentKes: "",
    depositKes: "",
    notes: "",
  });

  useEffect(() => {
    if (!open) return;
    Promise.resolve().then(() => {
      if (isEdit && lease) {
        setForm({
          propertyId: "",
          tenantContactId: "",
          startsAt: toDateInput(lease.startsAt),
          endsAt: toDateInput(lease.endsAt),
          monthlyRentKes: lease.monthlyRentKes,
          depositKes: lease.depositKes ?? "",
          notes: lease.notes ?? "",
        });
      } else {
        setForm({
          propertyId: defaultPropertyId || "",
          tenantContactId: "",
          startsAt: "",
          endsAt: "",
          monthlyRentKes: "",
          depositKes: "",
          notes: "",
        });
      }
      setErrors({});
    });
  }, [open, isEdit, lease, defaultPropertyId]);

  useEffect(() => {
    if (!open || !activeEntityId || isEdit) return;

    const loadOptions = async () => {
      try {
        const [propRes, tenantRes] = await Promise.all([
          fetch(`/api/properties?entityId=${activeEntityId}`),
          fetch(`/api/contacts?entityId=${activeEntityId}&type=tenant`),
        ]);
        const [propData, tenantData] = await Promise.all([propRes.json(), tenantRes.json()]);

        if (propData.properties) {
          const available = propData.properties
            .filter((p: { id: string; name: string; status: string; monthlyRentKes: string | null }) => p.status === "available")
            .map((p: { id: string; name: string; monthlyRentKes: string | null }) => ({ id: p.id, name: p.name, monthlyRentKes: p.monthlyRentKes }));

          if (defaultPropertyId && defaultPropertyName && !available.some((p: { id: string }) => p.id === defaultPropertyId)) {
            available.unshift({ id: defaultPropertyId, name: defaultPropertyName, monthlyRentKes: null });
          }
          setProperties(available);
        }
        if (tenantData.contacts) {
          setTenants(tenantData.contacts.map((c: { id: string; displayName: string }) => ({ id: c.id, name: c.displayName })));
        }
      } catch (err) {
        console.error("Failed to load options:", err);
      }
    };

    loadOptions();
  }, [open, activeEntityId, isEdit, defaultPropertyId, defaultPropertyName]);

  const updateField = <K extends keyof LeaseFormData>(
    field: K,
    value: LeaseFormData[K]
  ) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "propertyId") {
        const selected = properties.find((p) => p.id === value);
        if (selected && selected.monthlyRentKes) {
          next.monthlyRentKes = selected.monthlyRentKes;
        }
      }
      return next;
    });

    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof LeaseFormData, string>> = {};
    if (!isEdit && !form.propertyId) newErrors.propertyId = "Property unit selection is required";
    if (!isEdit && !form.tenantContactId) newErrors.tenantContactId = "Tenant contact selection is required";
    if (!form.startsAt) newErrors.startsAt = "Lease start date is required";
    if (!form.endsAt) newErrors.endsAt = "Lease end date is required";
    if (!form.monthlyRentKes.trim()) newErrors.monthlyRentKes = "Monthly Rent is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setIsSubmitting(true);

    try {
      const res = isEdit
        ? await fetch(`/api/leases/${lease!.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            entityId: activeEntityId,
            action: "update",
            startsAt: form.startsAt,
            endsAt: form.endsAt,
            monthlyRentKes: form.monthlyRentKes,
            depositKes: form.depositKes || null,
            notes: form.notes || null,
          }),
        })
        : await fetch("/api/leases", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            entityId: activeEntityId,
            propertyId: form.propertyId,
            unitId: defaultUnitId || undefined,
            tenantContactId: form.tenantContactId,
            startsAt: form.startsAt,
            endsAt: form.endsAt,
            monthlyRentKes: form.monthlyRentKes,
            depositKes: form.depositKes || null,
          }),
        });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save lease agreement");

      pushToast({
        tone: "success",
        title: isEdit ? "Lease Updated" : "Lease Registered",
        body: isEdit ? "Lease terms have been updated." : "Successfully finalized lease contract. Property unit updated to occupied.",
      });
      onSubmit();
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "An unexpected error occurred";
      pushToast({
        tone: "warning",
        title: isEdit ? "Update failed" : "Execution failed",
        body: message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedProp = properties.find((p) => p.id === form.propertyId);
  const selectedTenant = tenants.find((t) => t.id === form.tenantContactId);
  const rentVal = parseFloat(form.monthlyRentKes) || 0;
  const annualRentPool = rentVal * 12;

  return (
    <Modal
      open={open}
      onClose={isSubmitting ? () => { } : onClose}
      title={isEdit ? "Edit Lease Terms" : "Register Lease Agreement"}
      description={isEdit ? "Adjust the term dates, rent, or deposit for this tenancy contract." : "Create a legal lease agreement binding a tenant contact to a property unit."}
      size="lg"
    >
      <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="space-y-6 pt-1">
        {/* Contracting Context Preview Card */}
        <div className="p-4 rounded-2xl border border-slate-200/90 bg-slate-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="size-11 rounded-xl bg-white border border-slate-200/90 flex items-center justify-center shrink-0 text-[#151936] shadow-2xs">
              <IconFileText size={22} />
            </div>
            <div className="flex flex-col min-w-0">
              <p className="text-xs font-medium text-slate-900 truncate">
                {isEdit ? lease?.propertyName : selectedProp?.name ?? (defaultPropertyName || "Select Property Unit")}
              </p>
              <p className="text-xxs text-slate-500 truncate mt-0.5 font-mono">
                Tenant: <span className="font-medium text-slate-700">{isEdit ? lease?.tenantName : selectedTenant?.name ?? "Select Tenant"}</span>
              </p>
            </div>
          </div>
          <Badge tone={isEdit ? "primary" : "success"} className="text-xxs shrink-0 font-mono">
            <IconUserCheck size={12} className="shrink-0" />
            {isEdit ? "Active Tenancy" : "New Agreement"}
          </Badge>
        </div>

        {/* Form Grid */}
        <div className="space-y-5">
          {/* Group 1: Contracting Parties */}
          {!isEdit && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="font-mono text-xxs font-medium uppercase tracking-wider text-slate-500 block mb-1.5">
                  Target Property Unit *
                </label>
                {defaultPropertyId ? (
                  <div className="w-full h-11 rounded-xl border border-slate-200/90 bg-slate-100/70 px-3.5 flex items-center text-xs font-mono font-medium text-slate-700 shadow-2xs">
                    {defaultPropertyName || "Current Property"}
                  </div>
                ) : (
                  <select
                    required
                    className={cn(
                      "w-full h-11 rounded-xl border bg-white px-3.5 font-mono text-xs font-medium text-slate-900 focus:outline-none focus:border-[#151936] focus:ring-1 focus:ring-[#151936] transition-all shadow-2xs",
                      errors.propertyId ? "border-rose-300 bg-rose-50/30 text-rose-900" : "border-slate-200/90"
                    )}
                    value={form.propertyId}
                    onChange={(e) => updateField("propertyId", e.target.value)}
                  >
                    <option value="">-- Select Property Unit --</option>
                    {properties.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                )}
                {errors.propertyId && <p className="text-xxs font-medium text-rose-600 mt-1">{errors.propertyId}</p>}
              </div>

              <div>
                <label className="font-mono text-xxs font-medium uppercase tracking-wider text-slate-500 block mb-1.5">
                  Tenant Contact *
                </label>
                <select
                  required
                  className={cn(
                    "w-full h-11 rounded-xl border bg-white px-3.5 font-mono text-xs font-medium text-slate-900 focus:outline-none focus:border-[#151936] focus:ring-1 focus:ring-[#151936] transition-all shadow-2xs",
                    errors.tenantContactId ? "border-rose-300 bg-rose-50/30 text-rose-900" : "border-slate-200/90"
                  )}
                  value={form.tenantContactId}
                  onChange={(e) => updateField("tenantContactId", e.target.value)}
                >
                  <option value="">-- Select Tenant Contact --</option>
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                {errors.tenantContactId && <p className="text-xxs font-medium text-rose-600 mt-1">{errors.tenantContactId}</p>}
              </div>
            </div>
          )}

          {/* Group 2: Duration */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="font-mono text-xxs font-medium uppercase tracking-wider text-slate-500 block mb-1.5">
                Lease Commencement Date *
              </label>
              <input
                required
                type="date"
                value={form.startsAt}
                onChange={(e) => updateField("startsAt", e.target.value)}
                className={cn(
                  "w-full h-11 rounded-xl border bg-white px-3.5 font-mono text-xs font-medium text-slate-900 focus:outline-none focus:border-[#151936] focus:ring-1 focus:ring-[#151936] transition-all shadow-2xs",
                  errors.startsAt ? "border-rose-300 bg-rose-50/30 text-rose-900" : "border-slate-200/90"
                )}
              />
              {errors.startsAt && <p className="text-xxs font-medium text-rose-600 mt-1">{errors.startsAt}</p>}
            </div>

            <div>
              <label className="font-mono text-xxs font-medium uppercase tracking-wider text-slate-500 block mb-1.5">
                Lease Expiry Date *
              </label>
              <input
                required
                type="date"
                value={form.endsAt}
                onChange={(e) => updateField("endsAt", e.target.value)}
                className={cn(
                  "w-full h-11 rounded-xl border bg-white px-3.5 font-mono text-xs font-medium text-slate-900 focus:outline-none focus:border-[#151936] focus:ring-1 focus:ring-[#151936] transition-all shadow-2xs",
                  errors.endsAt ? "border-rose-300 bg-rose-50/30 text-rose-900" : "border-slate-200/90"
                )}
              />
              {errors.endsAt && <p className="text-xxs font-medium text-rose-600 mt-1">{errors.endsAt}</p>}
            </div>
          </div>

          {/* Group 3: Financial Terms & Live Rent Calculator */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="font-mono text-xxs font-medium uppercase tracking-wider text-slate-500 block mb-1.5">
                Monthly Rent Rate (KES) *
              </label>
              <input
                required
                type="number"
                min="0"
                step="1000"
                placeholder="e.g. 85000"
                value={form.monthlyRentKes}
                onChange={(e) => updateField("monthlyRentKes", e.target.value)}
                className={cn(
                  "w-full h-11 rounded-xl border bg-white px-3.5 font-mono text-xs font-medium text-slate-900 focus:outline-none focus:border-[#151936] focus:ring-1 focus:ring-[#151936] transition-all shadow-2xs",
                  errors.monthlyRentKes ? "border-rose-300 bg-rose-50/30 text-rose-900" : "border-slate-200/90"
                )}
              />
              {errors.monthlyRentKes && <p className="text-xxs font-medium text-rose-600 mt-1">{errors.monthlyRentKes}</p>}
            </div>

            <div>
              <label className="font-mono text-xxs font-medium uppercase tracking-wider text-slate-500 block mb-1.5">
                Security Deposit Held (KES)
              </label>
              <input
                type="number"
                min="0"
                step="1000"
                placeholder="e.g. 170000"
                value={form.depositKes}
                onChange={(e) => updateField("depositKes", e.target.value)}
                className="w-full h-11 rounded-xl border border-slate-200/90 bg-white px-3.5 font-mono text-xs font-medium text-slate-900 focus:outline-none focus:border-[#151936] focus:ring-1 focus:ring-[#151936] transition-all shadow-2xs"
              />
            </div>
          </div>

          {/* Live Rent Pool Summary Card */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <IconBuildingBank size={16} className="text-[#151936] shrink-0" />
              <span className="text-slate-600 font-medium">Contracted Annual Cashflow:</span>
              <span className="font-mono font-medium text-slate-900">{formatCompactKES(annualRentPool)}</span>
            </div>
            <Badge tone="success" className="text-xxs font-mono shrink-0">
              Active Tenancy Pool
            </Badge>
          </div>

          {/* Notes (Edit mode or optional) */}
          {isEdit && (
            <div>
              <label className="font-mono text-xxs font-medium uppercase tracking-wider text-slate-500 block mb-1.5">
                Tenancy Notes (Optional)
              </label>
              <textarea
                rows={2.5}
                placeholder="Tenancy-specific notes..."
                value={form.notes}
                onChange={(e) => updateField("notes", e.target.value)}
                className="w-full rounded-xl border border-slate-200/90 bg-white p-3 text-xs text-slate-900 focus:outline-none focus:border-[#151936] focus:ring-1 focus:ring-[#151936] transition-all shadow-2xs resize-none"
              />
            </div>
          )}
        </div>

        {/* Compliance Banner */}
        <div className="flex items-start gap-2.5 rounded-xl border border-slate-200/80 bg-slate-50 p-3.5 text-xs text-slate-600 leading-relaxed shadow-2xs">
          <IconShieldCheck size={16} className="text-[#151936] shrink-0 mt-0.5" />
          <p>
            Tenancy agreements strictly comply with Kenyan Landlord & Tenant Act (Cap 301). Finalized lease agreements automatically update property status to <span className="font-medium text-slate-900">Occupied</span>.
          </p>
        </div>

        {/* Modal Controls */}
        <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-xl text-xs px-4 py-2 font-medium"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting}
            className="bg-[#151936] text-white hover:bg-slate-800 rounded-xl text-xs px-5 py-2 font-medium shadow-2xs"
          >
            {isSubmitting ? (
              <div className="flex items-center gap-2">
                <LoadingSpinner size="sm" className="text-white" />
                <span>{isEdit ? "Saving..." : "Finalizing..."}</span>
              </div>
            ) : isEdit ? (
              "Save Terms"
            ) : (
              "Finalize Lease"
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
