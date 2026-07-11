"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useToast } from "@/components/ui/toast-provider";
import { useUIStore } from "@/store/ui";
import { cn } from "@/lib/utils/cn";

export interface LeaseFormData {
  propertyId: string;
  tenantContactId: string;
  startsAt: string;
  endsAt: string;
  monthlyRentKes: string;
  depositKes: string;
}

export interface LeaseEditTarget {
  id: string;
  propertyName: string;
  tenantName: string;
  startsAt: string;
  endsAt: string;
  monthlyRentKes: string;
  depositKes: string | null;
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
}: {
  open: boolean;
  mode?: "create" | "edit";
  /** Required when mode="edit" — the lease being edited. */
  lease?: LeaseEditTarget | null;
  onClose: () => void;
  onSubmit: () => void;
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
  });

  // Populate the form from the lease being edited, or reset for a fresh create.
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
        });
      } else {
        setForm({ propertyId: "", tenantContactId: "", startsAt: "", endsAt: "", monthlyRentKes: "", depositKes: "" });
      }
      setErrors({});
    });
  }, [open, isEdit, lease]);

  // Load available properties & tenants — only needed for create mode, since
  // edit mode keeps the property/tenant fixed (reassigning either is a new
  // lease or a renewal, not an edit — see updateLease's whitelist).
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
  }, [open, activeEntityId, isEdit]);

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
            }),
          })
        : await fetch("/api/leases", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              entityId: activeEntityId,
              propertyId: form.propertyId,
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

  return (
    <Modal
      open={open}
      onClose={isSubmitting ? () => { } : onClose}
      title={isEdit ? "Edit Lease Terms" : "Register Lease Agreement"}
      description={isEdit ? "Adjust the term dates, rent, or deposit for this lease." : "Create a legal lease agreement binding a tenant contact to a property unit."}
      size="xl"
    >
      <div className="space-y-6">
        {/* Section 1: Parties Involved */}
        <div className="bg-slate-50/50 rounded-xl p-5 border border-slate-100 space-y-4">
          <h3 className="text-title-primary border-b border-slate-200 pb-2 mb-4">Contracting Parties</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label-caps text-slate-500 mb-1.5 block">Property Unit</label>
              {isEdit ? (
                <p className="h-10 flex items-center px-3 rounded-lg border border-slate-200 bg-slate-100 text-body-primary text-slate-600">
                  {lease!.propertyName}
                </p>
              ) : (
                <select
                  className={cn(
                    "w-full h-10 rounded-lg border bg-white px-3 text-body-primary focus:outline-none focus:border-[#151936]/40 transition-colors shadow-sm",
                    errors.propertyId ? "border-red-300 bg-red-50/30 text-red-800" : "border-slate-200"
                  )}
                  value={form.propertyId}
                  onChange={(e) => updateField("propertyId", e.target.value)}
                >
                  <option value="">-- Choose Unit --</option>
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              )}
              {errors.propertyId && <p className="text-meta-muted-strong text-red-500 mt-1">{errors.propertyId}</p>}
            </div>

            <div>
              <label className="label-caps text-slate-500 mb-1.5 block">Tenant Contact</label>
              {isEdit ? (
                <p className="h-10 flex items-center px-3 rounded-lg border border-slate-200 bg-slate-100 text-body-primary text-slate-600">
                  {lease!.tenantName}
                </p>
              ) : (
                <select
                  className={cn(
                    "w-full h-10 rounded-lg border bg-white px-3 text-body-primary focus:outline-none focus:border-[#151936]/40 transition-colors shadow-sm",
                    errors.tenantContactId ? "border-red-300 bg-red-50/30 text-red-800" : "border-slate-200"
                  )}
                  value={form.tenantContactId}
                  onChange={(e) => updateField("tenantContactId", e.target.value)}
                >
                  <option value="">-- Choose Tenant --</option>
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              )}
              {errors.tenantContactId && <p className="text-meta-muted-strong text-red-500 mt-1">{errors.tenantContactId}</p>}
            </div>
          </div>
        </div>

        {/* Section 2: Duration */}
        <div className="bg-slate-50/50 rounded-xl p-5 border border-slate-100 space-y-4">
          <h3 className="text-title-primary border-b border-slate-200 pb-2 mb-4">Lease Duration</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label-caps text-slate-500 mb-1.5 block">Lease Starts</label>
              <input
                type="date"
                className={cn(
                  "w-full h-10 rounded-lg border bg-white px-3 text-body-primary focus:outline-none focus:border-[#151936]/40 transition-colors shadow-sm",
                  errors.startsAt ? "border-red-300 bg-red-50/30 text-red-800" : "border-slate-200"
                )}
                value={form.startsAt}
                onChange={(e) => updateField("startsAt", e.target.value)}
              />
              {errors.startsAt && <p className="text-meta-muted-strong text-red-500 mt-1">{errors.startsAt}</p>}
            </div>
            <div>
              <label className="label-caps text-slate-500 mb-1.5 block">Lease Ends</label>
              <input
                type="date"
                className={cn(
                  "w-full h-10 rounded-lg border bg-white px-3 text-body-primary focus:outline-none focus:border-[#151936]/40 transition-colors shadow-sm",
                  errors.endsAt ? "border-red-300 bg-red-50/30 text-red-800" : "border-slate-200"
                )}
                value={form.endsAt}
                onChange={(e) => updateField("endsAt", e.target.value)}
              />
              {errors.endsAt && <p className="text-meta-muted-strong text-red-500 mt-1">{errors.endsAt}</p>}
            </div>
          </div>
        </div>

        {/* Section 3: Financial Terms */}
        <div className="bg-slate-50/50 rounded-xl p-5 border border-slate-100 space-y-4">
          <h3 className="text-title-primary border-b border-slate-200 pb-2 mb-4">Financial Terms</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label-caps text-slate-500 mb-1.5 block">Rent Rate (KES / month)</label>
              <input
                className={cn(
                  "w-full h-10 rounded-lg border bg-white px-3 mono-data placeholder:text-slate-400 focus:outline-none focus:border-[#151936]/40 transition-colors shadow-sm",
                  errors.monthlyRentKes ? "border-red-300 bg-red-50/30 text-red-800" : "border-slate-200"
                )}
                placeholder="e.g. 85000"
                value={form.monthlyRentKes}
                onChange={(e) => updateField("monthlyRentKes", e.target.value)}
              />
              {errors.monthlyRentKes && <p className="text-meta-muted-strong text-red-500 mt-1">{errors.monthlyRentKes}</p>}
            </div>
            <div>
              <label className="label-caps text-slate-500 mb-1.5 block">Security Deposit Held (KES)</label>
              <input
                className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 mono-data placeholder:text-slate-400 focus:outline-none focus:border-[#151936]/40 transition-colors shadow-sm"
                placeholder="e.g. 170000"
                value={form.depositKes}
                onChange={(e) => updateField("depositKes", e.target.value)}
              />
            </div>
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
                <span className="ml-2">{isEdit ? "Saving…" : "Executing…"}</span>
              </>
            ) : isEdit ? (
              "Save Changes"
            ) : (
              "Finalize Lease"
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
