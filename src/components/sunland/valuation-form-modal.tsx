"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useToast } from "@/components/ui/toast-provider";
import { cn } from "@/lib/utils/cn";
import { TYPE_META, toDatetimeLocal, type ValuationType } from "./valuation-constants";

export interface ValuationEditTarget {
  id: string;
  valuationCode: string;
  propertyId: string | null;
  externalPropertyName: string | null;
  externalLocation: string | null;
  clientContactId: string | null;
  valuerId: string | null;
  type: ValuationType;
  purpose: string | null;
  feeKes: string | null;
  siteVisitAt: string | null;
  notes: string | null;
}

interface PropertyOption {
  id: string;
  name: string;
  location: string;
}

interface ContactOption {
  id: string;
  displayName: string;
}

interface UserOption {
  id: string;
  name: string;
}

const EMPTY_FORM = {
  subjectMode: "portfolio" as "portfolio" | "external",
  propertyId: "",
  externalPropertyName: "",
  externalLocation: "",
  clientContactId: "",
  valuerId: "",
  type: "market" as ValuationType,
  purpose: "",
  feeKes: "",
  siteVisitAt: "",
  notes: "",
};

export function ValuationFormModal({
  open,
  entityId,
  mode = "create",
  valuation,
  onClose,
  onSubmit,
}: {
  open: boolean;
  entityId: string | null;
  mode?: "create" | "edit";
  /** Required when mode="edit". */
  valuation?: ValuationEditTarget | null;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const { pushToast } = useToast();
  const isEdit = mode === "edit" && !!valuation;
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [properties, setProperties] = useState<PropertyOption[]>([]);
  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [staff, setStaff] = useState<UserOption[]>([]);

  useEffect(() => {
    if (!open) return;
    Promise.resolve().then(() => {
      if (isEdit && valuation) {
        setForm({
          subjectMode: valuation.propertyId ? "portfolio" : "external",
          propertyId: valuation.propertyId ?? "",
          externalPropertyName: valuation.externalPropertyName ?? "",
          externalLocation: valuation.externalLocation ?? "",
          clientContactId: valuation.clientContactId ?? "",
          valuerId: valuation.valuerId ?? "",
          type: valuation.type,
          purpose: valuation.purpose ?? "",
          feeKes: valuation.feeKes ?? "",
          siteVisitAt: toDatetimeLocal(valuation.siteVisitAt),
          notes: valuation.notes ?? "",
        });
      } else {
        setForm(EMPTY_FORM);
      }
    });
  }, [open, isEdit, valuation]);

  useEffect(() => {
    if (!open || !entityId) return;
    fetch(`/api/properties?entityId=${entityId}`)
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.properties)) {
          setProperties(d.properties.map((p: { id: string; name: string; location: string }) => ({ id: p.id, name: p.name, location: p.location })));
        }
      })
      .catch(() => {});
    fetch(`/api/contacts?entityId=${entityId}`)
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.contacts)) {
          setContacts(d.contacts.map((c: { id: string; displayName: string }) => ({ id: c.id, displayName: c.displayName })));
        }
      })
      .catch(() => {});
    fetch(`/api/identity/users?entityId=${entityId}`)
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.users)) setStaff(d.users.map((u: { id: string; name: string }) => ({ id: u.id, name: u.name })));
      })
      .catch(() => {});
  }, [open, entityId]);

  const handleSubmit = async () => {
    if (form.subjectMode === "portfolio" && !form.propertyId) {
      pushToast({ tone: "warning", title: "Missing subject", body: "Pick the portfolio property being valued." });
      return;
    }
    if (form.subjectMode === "external" && !form.externalPropertyName.trim()) {
      pushToast({ tone: "warning", title: "Missing subject", body: "Name the external property being valued." });
      return;
    }
    setIsSaving(true);
    try {
      const payload = {
        entityId,
        propertyId: form.subjectMode === "portfolio" ? form.propertyId : null,
        externalPropertyName: form.subjectMode === "external" ? form.externalPropertyName.trim() : null,
        externalLocation: form.subjectMode === "external" ? (form.externalLocation.trim() || null) : null,
        clientContactId: form.clientContactId || null,
        valuerId: form.valuerId || null,
        type: form.type,
        purpose: form.purpose.trim() || null,
        feeKes: form.feeKes.trim() || null,
        siteVisitAt: form.siteVisitAt ? new Date(form.siteVisitAt).toISOString() : null,
        notes: form.notes.trim() || null,
      };
      // Create rejects nulls for optional fields it treats as absent — strip them.
      const createPayload = Object.fromEntries(Object.entries(payload).filter(([, v]) => v !== null));

      const res = await fetch(isEdit ? `/api/valuations/${valuation!.id}` : "/api/valuations", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isEdit ? payload : createPayload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save valuation");

      pushToast({
        tone: "success",
        title: isEdit ? "Valuation Updated" : "Instruction Opened",
        body: isEdit ? `${valuation!.valuationCode} has been updated.` : `Valuation ${data.valuation.valuationCode} created.`,
      });
      onSubmit();
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save valuation";
      pushToast({ tone: "warning", title: "Error", body: message });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => !isSaving && onClose()}
      title={isEdit ? `Edit ${valuation!.valuationCode}` : "New Valuation Instruction"}
      description={isEdit ? "Update the instruction details" : "Open a chargeable valuation instruction for a portfolio or external subject"}
      size="lg"
    >
      <div className="space-y-5">
        {/* Subject */}
        <div className="bg-slate-50/50 rounded-xl p-5 border border-slate-100 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <h3 className="text-title-primary">Subject Property</h3>
            <div className="flex bg-slate-100 p-1 rounded-lg">
              {(["portfolio", "external"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, subjectMode: m }))}
                  className={cn(
                    "px-3 py-1 text-sm font-medium rounded-md transition-colors capitalize",
                    form.subjectMode === m ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700",
                  )}
                >
                  {m === "portfolio" ? "Portfolio" : "External"}
                </button>
              ))}
            </div>
          </div>

          {form.subjectMode === "portfolio" ? (
            <div>
              <label className="label-caps text-slate-500 mb-1.5 block">Portfolio Property</label>
              <select
                className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-body-primary focus:outline-none focus:border-[#151936]/40 transition-colors shadow-sm"
                value={form.propertyId}
                onChange={(e) => setForm((f) => ({ ...f, propertyId: e.target.value }))}
              >
                <option value="">-- Select property --</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} · {p.location}</option>
                ))}
              </select>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label-caps text-slate-500 mb-1.5 block">Property Name</label>
                <input
                  className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-body-primary placeholder:text-slate-400 focus:outline-none focus:border-[#151936]/40 transition-colors shadow-sm"
                  placeholder="e.g. Riverside Grove Office Park"
                  value={form.externalPropertyName}
                  onChange={(e) => setForm((f) => ({ ...f, externalPropertyName: e.target.value }))}
                />
              </div>
              <div>
                <label className="label-caps text-slate-500 mb-1.5 block">Location</label>
                <input
                  className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-body-primary placeholder:text-slate-400 focus:outline-none focus:border-[#151936]/40 transition-colors shadow-sm"
                  placeholder="e.g. Riverside Drive, Nairobi"
                  value={form.externalLocation}
                  onChange={(e) => setForm((f) => ({ ...f, externalLocation: e.target.value }))}
                />
              </div>
            </div>
          )}
        </div>

        {/* Instruction */}
        <div className="bg-slate-50/50 rounded-xl p-5 border border-slate-100 space-y-4">
          <h3 className="text-title-primary border-b border-slate-200 pb-2">Instruction Details</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label-caps text-slate-500 mb-1.5 block">Valuation Type</label>
              <select
                className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-body-primary focus:outline-none focus:border-[#151936]/40 transition-colors shadow-sm"
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as ValuationType }))}
              >
                {(Object.keys(TYPE_META) as ValuationType[]).map((t) => (
                  <option key={t} value={t}>{TYPE_META[t]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-caps text-slate-500 mb-1.5 block">Client</label>
              <select
                className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-body-primary focus:outline-none focus:border-[#151936]/40 transition-colors shadow-sm"
                value={form.clientContactId}
                onChange={(e) => setForm((f) => ({ ...f, clientContactId: e.target.value }))}
              >
                <option value="">-- No client on record --</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>{c.displayName}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-caps text-slate-500 mb-1.5 block">Assigned Valuer</label>
              <select
                className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-body-primary focus:outline-none focus:border-[#151936]/40 transition-colors shadow-sm"
                value={form.valuerId}
                onChange={(e) => setForm((f) => ({ ...f, valuerId: e.target.value }))}
              >
                <option value="">-- Unassigned --</option>
                {staff.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-caps text-slate-500 mb-1.5 block">Professional Fee (KES)</label>
              <input
                type="number"
                className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 mono-data placeholder:text-slate-400 focus:outline-none focus:border-[#151936]/40 transition-colors shadow-sm"
                placeholder="e.g. 150000"
                value={form.feeKes}
                onChange={(e) => setForm((f) => ({ ...f, feeKes: e.target.value }))}
              />
            </div>
            <div>
              <label className="label-caps text-slate-500 mb-1.5 block">Site Visit</label>
              <input
                type="datetime-local"
                className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 mono-data text-slate-800 focus:outline-none focus:border-[#151936]/40 transition-colors shadow-sm"
                value={form.siteVisitAt}
                onChange={(e) => setForm((f) => ({ ...f, siteVisitAt: e.target.value }))}
              />
            </div>
            <div>
              <label className="label-caps text-slate-500 mb-1.5 block">Purpose</label>
              <input
                className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-body-primary placeholder:text-slate-400 focus:outline-none focus:border-[#151936]/40 transition-colors shadow-sm"
                placeholder="e.g. Mortgage security for facility renewal"
                value={form.purpose}
                onChange={(e) => setForm((f) => ({ ...f, purpose: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <label className="label-caps text-slate-500 mb-1.5 block">Notes</label>
            <textarea
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-body-primary resize-none h-20 placeholder:text-slate-400 focus:outline-none focus:border-[#151936]/40 transition-colors shadow-sm"
              placeholder="Access arrangements, comparables, internal context…"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
          <Button variant="secondary" onClick={onClose} disabled={isSaving}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isSaving}>
            {isSaving ? (
              <><LoadingSpinner size="sm" /><span className="ml-2">{isEdit ? "Saving…" : "Opening…"}</span></>
            ) : (
              isEdit ? "Save Changes" : "Open Instruction"
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
