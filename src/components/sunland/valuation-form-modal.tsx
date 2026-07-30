"use client";

import { useEffect, useState } from "react";
import {
  IconBuildingCommunity,
  IconBuildingSkyscraper,
  IconBuildingBank,
  IconUserCheck,
  IconCalendarEvent,
  IconNotes,
  IconMapPin,
  IconPlus,
  IconShieldCheck,
  IconUserCog,
} from "@tabler/icons-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useToast } from "@/components/ui/toast-provider";
import { cn } from "@/lib/utils/cn";
import { toDatetimeLocal } from "./valuation-constants";

export interface ValuationEditTarget {
  id: string;
  valuationCode: string;
  propertyId: string | null;
  externalPropertyName: string | null;
  externalLocation: string | null;
  landlordContactId: string | null;
  assignedManagerId: string | null;
  valuerId: string | null;
  externalValuerName: string | null;
  isLand: boolean;
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
  subjectMode: "external" as "portfolio" | "external",
  propertyId: "",
  externalPropertyName: "",
  externalLocation: "",
  isLand: false,
  landlordContactId: "",
  assignedManagerId: "",
  valuerMode: "sunland" as "sunland" | "external",
  valuerId: "",
  externalValuerName: "",
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
  const [managers, setManagers] = useState<UserOption[]>([]);

  useEffect(() => {
    if (!open) return;
    Promise.resolve().then(() => {
      if (isEdit && valuation) {
        setForm({
          subjectMode: valuation.propertyId ? "portfolio" : "external",
          propertyId: valuation.propertyId ?? "",
          externalPropertyName: valuation.externalPropertyName ?? "",
          externalLocation: valuation.externalLocation ?? "",
          isLand: valuation.isLand,
          landlordContactId: valuation.landlordContactId ?? "",
          assignedManagerId: valuation.assignedManagerId ?? "",
          valuerMode: valuation.externalValuerName ? "external" : "sunland",
          valuerId: valuation.valuerId ?? "",
          externalValuerName: valuation.externalValuerName ?? "",
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
      .catch(() => { });
    fetch(`/api/contacts?entityId=${entityId}`)
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.contacts)) {
          setContacts(d.contacts.map((c: { id: string; displayName: string }) => ({ id: c.id, displayName: c.displayName })));
        }
      })
      .catch(() => { });
    fetch(`/api/identity/users?entityId=${entityId}&role=property_manager`)
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.users)) setManagers(d.users.map((u: { id: string; name: string }) => ({ id: u.id, name: u.name })));
      })
      .catch(() => { });
  }, [open, entityId]);

  const handleSubmit = async () => {
    if (form.subjectMode === "portfolio" && !form.propertyId) {
      pushToast({ tone: "warning", title: "Missing subject", body: "Pick the portfolio property being valued." });
      return;
    }
    if (form.subjectMode === "external" && !form.externalPropertyName.trim()) {
      pushToast({ tone: "warning", title: "Missing subject", body: "Name the prospect property or land being valued." });
      return;
    }
    setIsSaving(true);
    try {
      const payload = {
        entityId,
        propertyId: form.subjectMode === "portfolio" ? form.propertyId : null,
        externalPropertyName: form.subjectMode === "external" ? form.externalPropertyName.trim() : null,
        externalLocation: form.subjectMode === "external" ? (form.externalLocation.trim() || null) : null,
        isLand: form.isLand,
        landlordContactId: form.landlordContactId || null,
        assignedManagerId: form.assignedManagerId || null,
        valuerId: form.valuerMode === "sunland" ? (form.valuerId || null) : null,
        externalValuerName: form.valuerMode === "external" ? (form.externalValuerName.trim() || null) : null,
        siteVisitAt: form.siteVisitAt ? new Date(form.siteVisitAt).toISOString() : null,
        notes: form.notes.trim() || null,
      };
      // Create rejects nulls for optional fields it treats as absent - strip them.
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
        title: isEdit ? "Valuation Updated" : "Valuation Scheduled",
        body: isEdit ? `${valuation!.valuationCode} has been updated.` : `${data.valuation.valuationCode} added to the pipeline.`,
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
      title={isEdit ? `Edit Valuation File: ${valuation!.valuationCode}` : "Schedule Property Valuation"}
      description={isEdit ? "Update prospect details, assigned manager, or site visit schedule." : "Record a new prospect valuation or portfolio asset assessment into the acquisition funnel."}
      size="lg"
    >
      <div className="space-y-6 pt-1">
        {/* Top Contracting & Mode Preview Bar */}
        <div className="p-4 rounded-2xl border border-slate-200/90 bg-slate-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="size-11 rounded-xl bg-white border border-slate-200/90 flex items-center justify-center shrink-0 text-[#151936] shadow-2xs">
              <IconBuildingSkyscraper size={22} />
            </div>
            <div className="flex flex-col min-w-0">
              <p className="text-xs font-medium text-slate-900 truncate leading-snug">
                {form.subjectMode === "portfolio"
                  ? (properties.find((p) => p.id === form.propertyId)?.name || "Select Portfolio Asset")
                  : (form.externalPropertyName.trim() || "New Prospect Subject")}
              </p>
              <p className="text-xxs text-slate-600 truncate mt-0.5 font-mono">
                Location: <span className="font-medium text-slate-700">{form.subjectMode === "portfolio" ? (properties.find((p) => p.id === form.propertyId)?.location || "Portfolio") : (form.externalLocation.trim() || "Unspecified")}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="flex bg-slate-200/70 p-1 rounded-xl gap-1">
              {(["external", "portfolio"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, subjectMode: m }))}
                  className={cn(
                    "px-3 py-1 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5 cursor-pointer",
                    form.subjectMode === m ? "bg-white text-slate-900 shadow-2xs" : "text-slate-600 hover:text-slate-900",
                  )}
                >
                  {m === "external" ? (
                    <><IconPlus size={13} /> New Prospect</>
                  ) : (
                    <><IconBuildingCommunity size={13} /> Portfolio</>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Section 1: Subject Fields */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 pb-1 border-b border-slate-100">
            <span className="font-mono text-xxs font-medium uppercase tracking-wider text-slate-600">
              01 · Subject Identification
            </span>
          </div>

          {form.subjectMode === "portfolio" ? (
            <div>
              <label className="font-mono text-xxs font-medium uppercase tracking-wider text-slate-600 block mb-1.5">
                Portfolio Property Unit *
              </label>
              <select
                className="w-full h-11 rounded-xl border border-slate-200/90 bg-white px-3.5 text-xs font-medium text-slate-900 focus:outline-none focus:border-[#151936] focus:ring-1 focus:ring-[#151936] transition-all shadow-2xs"
                value={form.propertyId}
                onChange={(e) => setForm((f) => ({ ...f, propertyId: e.target.value }))}
              >
                <option value="">-- Select portfolio property --</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} · {p.location}</option>
                ))}
              </select>
            </div>
          ) : (
            <div className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-mono text-xxs font-medium uppercase tracking-wider text-slate-600 block mb-1.5">
                    Property or Land Name *
                  </label>
                  <input
                    className="w-full h-11 rounded-xl border border-slate-200/90 bg-white px-3.5 text-xs font-medium text-slate-900 placeholder:text-slate-600 focus:outline-none focus:border-[#151936] focus:ring-1 focus:ring-[#151936] transition-all shadow-2xs"
                    placeholder="e.g. Riverside Apartments, Kileleshwa"
                    value={form.externalPropertyName}
                    onChange={(e) => setForm((f) => ({ ...f, externalPropertyName: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="font-mono text-xxs font-medium uppercase tracking-wider text-slate-600 block mb-1.5">
                    Location / Submarket
                  </label>
                  <input
                    className="w-full h-11 rounded-xl border border-slate-200/90 bg-white px-3.5 text-xs font-medium text-slate-900 placeholder:text-slate-600 focus:outline-none focus:border-[#151936] focus:ring-1 focus:ring-[#151936] transition-all shadow-2xs"
                    placeholder="e.g. Kileleshwa, Nairobi"
                    value={form.externalLocation}
                    onChange={(e) => setForm((f) => ({ ...f, externalLocation: e.target.value }))}
                  />
                </div>
              </div>

              <label
                onClick={() => setForm((f) => ({ ...f, isLand: !f.isLand }))}
                className={cn(
                  "flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer shadow-2xs select-none",
                  form.isLand ? "bg-amber-50/80 border-amber-300/80" : "bg-slate-50/40 border-slate-200/80 hover:bg-slate-100/60"
                )}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className={cn("size-7 rounded-lg flex items-center justify-center shrink-0 border", form.isLand ? "bg-amber-100 border-amber-300 text-amber-800" : "bg-white border-slate-200 text-slate-600")}>
                    <IconMapPin size={15} />
                  </span>
                  <div>
                    <span className="block text-xs font-medium text-slate-900">Raw Land Parcel</span>
                    <span className="block text-xxs text-slate-600 font-mono">Subject is an unbuilt plot or undeveloped land</span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={form.isLand}
                  onChange={() => { }}
                  className="size-4 rounded border-slate-300 text-[#151936] focus:ring-[#151936]"
                />
              </label>
            </div>
          )}
        </div>

        {/* Section 2: Operational Assignment */}
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-1 border-b border-slate-100">
            <span className="font-mono text-xxs font-medium uppercase tracking-wider text-slate-600">
              02 · Stakeholder & Valuer Assignment
            </span>
            <div className="flex bg-slate-200/70 p-0.5 rounded-lg gap-0.5 text-xs">
              {(["sunland", "external"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, valuerMode: m }))}
                  className={cn(
                    "px-2.5 py-0.5 text-xxs font-medium rounded-md transition-all flex items-center gap-1 cursor-pointer",
                    form.valuerMode === m ? "bg-white text-slate-900 shadow-2xs" : "text-slate-600 hover:text-slate-900",
                  )}
                >
                  {m === "sunland" ? (
                    <><IconBuildingBank size={12} /> Sunland Valuers</>
                  ) : (
                    <><IconBuildingSkyscraper size={12} /> Independent Firm</>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="font-mono text-xxs font-medium uppercase tracking-wider text-slate-600 block mb-1.5">
                Landlord / Owner Contact
              </label>
              <select
                className="w-full h-11 rounded-xl border border-slate-200/90 bg-white px-3.5 text-xs font-medium text-slate-900 focus:outline-none focus:border-[#151936] focus:ring-1 focus:ring-[#151936] transition-all shadow-2xs"
                value={form.landlordContactId}
                onChange={(e) => setForm((f) => ({ ...f, landlordContactId: e.target.value }))}
              >
                <option value="">-- No contact on record --</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>{c.displayName}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="font-mono text-xxs font-medium uppercase tracking-wider text-slate-600 block mb-1.5">
                Assigned Property Manager
              </label>
              <select
                className="w-full h-11 rounded-xl border border-slate-200/90 bg-white px-3.5 text-xs font-medium text-slate-900 focus:outline-none focus:border-[#151936] focus:ring-1 focus:ring-[#151936] transition-all shadow-2xs"
                value={form.assignedManagerId}
                onChange={(e) => setForm((f) => ({ ...f, assignedManagerId: e.target.value }))}
              >
                <option value="">-- Unassigned --</option>
                {managers.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="font-mono text-xxs font-medium uppercase tracking-wider text-slate-600 block mb-1.5">
              Valuer Firm / Lead Valuer
            </label>
            {form.valuerMode === "sunland" ? (
              <select
                className="w-full h-11 rounded-xl border border-slate-200/90 bg-white px-3.5 text-xs font-medium text-slate-900 focus:outline-none focus:border-[#151936] focus:ring-1 focus:ring-[#151936] transition-all shadow-2xs"
                value={form.valuerId}
                onChange={(e) => setForm((f) => ({ ...f, valuerId: e.target.value }))}
              >
                <option value="">-- Sunland Valuers Ltd (default) --</option>
                {managers.map((u) => (
                  <option key={u.id} value={u.id}>{u.name} (Internal Staff)</option>
                ))}
              </select>
            ) : (
              <input
                className="w-full h-11 rounded-xl border border-slate-200/90 bg-white px-3.5 text-xs font-medium text-slate-900 placeholder:text-slate-600 focus:outline-none focus:border-[#151936] focus:ring-1 focus:ring-[#151936] transition-all shadow-2xs"
                placeholder="e.g. Knight & Kale Valuers"
                value={form.externalValuerName}
                onChange={(e) => setForm((f) => ({ ...f, externalValuerName: e.target.value }))}
              />
            )}
          </div>
        </div>

        {/* Section 3: Schedule & Notes */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 pb-1 border-b border-slate-100">
            <span className="font-mono text-xxs font-medium uppercase tracking-wider text-slate-600">
              03 · Inspection Schedule & Notes
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="font-mono text-xxs font-medium uppercase tracking-wider text-slate-600 block mb-1.5">
                Site Visit Schedule (optional)
              </label>
              <input
                type="datetime-local"
                className="w-full h-11 rounded-xl border border-slate-200/90 bg-white px-3.5 font-mono text-xs text-slate-900 focus:outline-none focus:border-[#151936] focus:ring-1 focus:ring-[#151936] transition-all shadow-2xs"
                value={form.siteVisitAt}
                onChange={(e) => setForm((f) => ({ ...f, siteVisitAt: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <label className="font-mono text-xxs font-medium uppercase tracking-wider text-slate-600 block mb-1.5">
              Assessment Notes & Access Details
            </label>
            <textarea
              className="w-full rounded-xl border border-slate-200/90 bg-white p-3.5 text-xs text-slate-900 resize-none h-20 placeholder:text-slate-600 focus:outline-none focus:border-[#151936] focus:ring-1 focus:ring-[#151936] transition-all shadow-2xs"
              placeholder="Access arrangements, how the lead came in, internal context…"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200/80">
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={isSaving}
            className="h-10 px-4 text-xs font-medium rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSaving}
            className="bg-[#151936] text-white hover:bg-[#1f254e] transition-colors rounded-xl px-5 h-10 text-xs font-medium flex items-center gap-2 shadow-2xs cursor-pointer"
          >
            {isSaving ? (
              <><LoadingSpinner size="sm" /><span>{isEdit ? "Saving Changes…" : "Scheduling Prospect…"}</span></>
            ) : (
              isEdit ? "Save Changes" : "Schedule & Assign Prospect"
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
