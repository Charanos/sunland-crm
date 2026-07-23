"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  IconAlertTriangle,
  IconUserCog,
  IconBuildingCommunity,
  IconShieldCheck,
  IconUserCheck,
  IconBuildingBank,
} from "@tabler/icons-react";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast-provider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/erp-primitives";

interface ManagerOption {
  id: string;
  name: string;
  title: string | null;
}

interface PropertyOption {
  id: string;
  name: string;
  propertyCode: string;
  mandateStatus: string | null;
  unitBreakdown: Array<{ unitType: string; count: number }> | null;
  owner: { name: string | null; verifiedAt: string | null } | null;
  media?: Array<{ url: string }>;
}

interface EditableMandateTerms {
  id: string;
  maintenanceAuthorityKes: string | null;
  renewalType: string | null;
  noticePeriodDays: number | null;
  scopeDescription: string | null;
}

interface MandateFormModalProps {
  open: boolean;
  entityId: string | null;
  propertyId?: string;
  propertyName?: string;
  landlordName?: string;
  landlordVerified?: boolean;
  defaultUnitCount?: number;
  editMandate?: EditableMandateTerms | null;
  onClose: () => void;
  onCreated: () => void;
}

const DEFAULT_RATE_PERCENT = 10;
const RENEWAL_TYPE_OPTIONS = [
  { value: "automatic", label: "Automatic Renewal" },
  { value: "manual", label: "Manual Renewal Required" },
  { value: "negotiated", label: "Negotiated Terms Upon Expiry" },
];

export function MandateFormModal({
  open,
  entityId,
  propertyId,
  propertyName,
  landlordName,
  landlordVerified = false,
  defaultUnitCount = 1,
  editMandate = null,
  onClose,
  onCreated,
}: MandateFormModalProps) {
  const { pushToast } = useToast();
  const isEditingTerms = !!editMandate;
  const [ratePercent, setRatePercent] = useState(String(DEFAULT_RATE_PERCENT));
  const [rateJustification, setRateJustification] = useState("");
  const [unitCount, setUnitCount] = useState(String(Math.max(1, defaultUnitCount)));
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState("");
  const [assignedPmId, setAssignedPmId] = useState("");
  const [managers, setManagers] = useState<ManagerOption[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const [maintenanceAuthorityKes, setMaintenanceAuthorityKes] = useState("");
  const [renewalType, setRenewalType] = useState("");
  const [noticePeriodDays, setNoticePeriodDays] = useState("");
  const [scopeDescription, setScopeDescription] = useState("");

  useEffect(() => {
    if (!open) return;
    Promise.resolve().then(() => {
      setMaintenanceAuthorityKes(editMandate?.maintenanceAuthorityKes ?? "");
      setRenewalType(editMandate?.renewalType ?? "");
      setNoticePeriodDays(editMandate?.noticePeriodDays != null ? String(editMandate.noticePeriodDays) : "");
      setScopeDescription(editMandate?.scopeDescription ?? "");
    });
  }, [open, editMandate]);

  const [propertyOptions, setPropertyOptions] = useState<PropertyOption[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState(propertyId ?? "");

  useEffect(() => {
    Promise.resolve().then(() => setSelectedPropertyId(propertyId ?? ""));
  }, [propertyId, open]);

  useEffect(() => {
    if (!open || !entityId) return;
    let active = true;
    fetch(`/api/identity/users?entityId=${entityId}&role=property_manager`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active || !data) return;
        setManagers(data.users ?? []);
      })
      .catch(() => {
        if (active) setManagers([]);
      });
    return () => {
      active = false;
    };
  }, [open, entityId]);

  useEffect(() => {
    if (!open || !entityId || propertyId) return;
    let active = true;
    fetch(`/api/properties?entityId=${entityId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active || !data) return;
        const eligible = (data.properties ?? []).filter(
          (p: PropertyOption) => p.mandateStatus !== "pending_approval" && p.mandateStatus !== "active",
        );
        setPropertyOptions(eligible);
      })
      .catch(() => {
        if (active) setPropertyOptions([]);
      });
    return () => {
      active = false;
    };
  }, [open, entityId, propertyId]);

  const selectedProperty = propertyOptions.find((p) => p.id === selectedPropertyId);
  const resolvedPropertyName = propertyId ? propertyName : selectedProperty?.name;
  const resolvedLandlordName = propertyId ? landlordName : selectedProperty?.owner?.name ?? undefined;
  const resolvedLandlordVerified = propertyId ? landlordVerified : Boolean(selectedProperty?.owner?.verifiedAt);

  useEffect(() => {
    if (propertyId || !selectedProperty) return;
    Promise.resolve().then(() => {
      const breakdownCount = (selectedProperty.unitBreakdown ?? []).reduce((sum, u) => sum + (u.count ?? 0), 0);
      setUnitCount(String(Math.max(1, breakdownCount)));
    });
  }, [propertyId, selectedProperty]);

  const rateValue = parseFloat(ratePercent);
  const parsedUnits = parseInt(unitCount, 10) || 1;
  const rateDiffersFromDefault = Number.isFinite(rateValue) && Math.abs(rateValue - DEFAULT_RATE_PERCENT) > 0.01;
  const requiresCeoApproval = parsedUnits > 10;

  const handleSubmitTerms = async () => {
    if (!editMandate) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/mandates/${editMandate.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_terms",
          entityId,
          maintenanceAuthorityKes: maintenanceAuthorityKes.trim() || null,
          renewalType: renewalType || null,
          noticePeriodDays: noticePeriodDays.trim() ? parseInt(noticePeriodDays, 10) : null,
          scopeDescription: scopeDescription.trim() || null,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Failed to update mandate terms");

      pushToast({ tone: "success", title: "Mandate terms updated" });
      onCreated();
      onClose();
    } catch (err) {
      console.error(err);
      pushToast({ tone: "warning", title: "Error", body: err instanceof Error ? err.message : "Could not update mandate terms." });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isEditingTerms) {
      await handleSubmitTerms();
      return;
    }
    if (!selectedPropertyId) {
      pushToast({ tone: "warning", title: "Select a property", body: "Choose which property this mandate covers." });
      return;
    }
    if (!Number.isFinite(rateValue) || rateValue <= 0 || rateValue > 100) {
      pushToast({ tone: "warning", title: "Invalid rate", body: "Enter a management fee rate between 0 and 100%." });
      return;
    }
    if (rateDiffersFromDefault && !rateJustification.trim()) {
      pushToast({ tone: "warning", title: "Justification required", body: "Explain why this rate differs from the standard 10%." });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/mandates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityId,
          propertyId: selectedPropertyId,
          mandateRate: (rateValue / 100).toFixed(4),
          rateJustification: rateDiffersFromDefault ? rateJustification.trim() : undefined,
          unitCount: parsedUnits,
          startDate: new Date(startDate).toISOString(),
          endDate: endDate ? new Date(endDate).toISOString() : null,
          assignedPmId: assignedPmId || null,
          maintenanceAuthorityKes: maintenanceAuthorityKes.trim() || null,
          renewalType: renewalType || null,
          noticePeriodDays: noticePeriodDays.trim() ? parseInt(noticePeriodDays, 10) : null,
          scopeDescription: scopeDescription.trim() || null,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error ?? "Failed to submit mandate");
      }

      const requiredApproverRole = data?.mandate?.requiredApproverRole as "gm" | "ceo" | null | undefined;
      if (!requiredApproverRole) {
        pushToast({ tone: "success", title: "Mandate activated", body: "Created and activated immediately under your authority." });
      } else {
        const approverLabel = requiredApproverRole === "ceo" ? "CEO" : "GM";
        pushToast({
          tone: "success",
          title: "Mandate submitted",
          body: `Awaiting ${approverLabel} approval before it goes active.`,
        });
      }
      onCreated();
      onClose();
    } catch (err) {
      console.error(err);
      pushToast({ tone: "warning", title: "Error", body: err instanceof Error ? err.message : "Could not submit the mandate." });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={submitting ? () => { } : onClose}
      title={isEditingTerms ? "Edit Mandate Terms" : "Create Management Mandate"}
      description={
        isEditingTerms
          ? "Descriptive terms only — rate, dates, and manager assignment are edited under separate authorization."
          : "Configure property management agreement terms and governance routing."
      }
      size="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5 py-1">

        {/* ── SECTION 1: Property Selection & Identity Deck ── */}
        {!isEditingTerms && !propertyId && (
          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <label className="font-mono text-xxs font-medium uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <IconBuildingCommunity size={14} className="text-slate-400" />
                Target Property
              </label>
              {selectedProperty && (
                <span className="font-mono text-xxs bg-slate-200/60 text-slate-700 px-2 py-0.5 rounded-full font-medium">
                  {selectedProperty.propertyCode}
                </span>
              )}
            </div>

            <select
              required
              value={selectedPropertyId}
              onChange={(e) => setSelectedPropertyId(e.target.value)}
              className="w-full h-11 rounded-xl border border-slate-200/90 bg-white px-3.5 text-xs font-medium text-slate-900 focus:outline-none focus:border-[#151936] focus:ring-1 focus:ring-[#151936] transition-all shadow-2xs"
            >
              <option value="">Select an available property...</option>
              {propertyOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.propertyCode}){p.owner?.name ? ` — ${p.owner.name}` : ""}
                </option>
              ))}
            </select>

            {/* Selected Property Preview Banner */}
            {selectedProperty && (
              <div className="flex items-center justify-between p-3 rounded-xl bg-white border border-slate-200/80 shadow-2xs mt-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="size-10 rounded-lg bg-slate-100 border border-slate-200/80 flex items-center justify-center shrink-0 text-slate-500 overflow-hidden relative">
                    {selectedProperty.media?.[0]?.url ? (
                      <Image src={selectedProperty.media[0].url} alt={selectedProperty.name} fill className="object-cover" />
                    ) : (
                      <IconBuildingCommunity size={18} />
                    )}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <p className="text-xs font-medium text-slate-900 truncate">{selectedProperty.name}</p>
                    <p className="text-xxs text-slate-500 truncate mt-0.5">
                      Landlord: <span className="font-medium text-slate-700">{selectedProperty.owner?.name ?? "Unassigned"}</span>
                    </p>
                  </div>
                </div>

                <Badge tone={selectedProperty.owner?.verifiedAt ? "success" : "warning"} className="text-xxs shrink-0">
                  {selectedProperty.owner?.verifiedAt ? <IconUserCheck size={12} /> : <IconAlertTriangle size={12} />}
                  {selectedProperty.owner?.verifiedAt ? "Verified Owner" : "Pending Verification"}
                </Badge>
              </div>
            )}
          </div>
        )}

        {/* Property Identity Header when pre-selected */}
        {resolvedPropertyName && (
          <div className="flex items-center justify-between p-4 rounded-2xl border border-slate-200/80 bg-slate-50/50 shadow-2xs">
            <div className="flex items-center gap-3 min-w-0">
              <div className="size-10 rounded-xl bg-[#151936] text-white flex items-center justify-center font-mono text-xs font-medium shrink-0 shadow-2xs">
                {resolvedPropertyName.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex flex-col min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">{resolvedPropertyName}</p>
                <p className="text-xs text-slate-500 truncate mt-0.5">
                  Landlord: <span className="font-medium text-slate-700">{resolvedLandlordName ?? "Direct Owner"}</span>
                </p>
              </div>
            </div>
            <Badge tone={resolvedLandlordVerified ? "success" : "warning"} className="text-xxs shrink-0">
              {resolvedLandlordVerified ? "Verified Landlord" : "Unverified Landlord"}
            </Badge>
          </div>
        )}

        {/* Landlord Unverified Warning Banner */}
        {!isEditingTerms && selectedPropertyId && !resolvedLandlordVerified && (
          <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/60 p-3.5 text-xs text-amber-800 leading-relaxed shadow-2xs">
            <IconAlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
            <p>
              <span className="font-medium">{resolvedLandlordName ?? "This landlord"}</span> has not completed identity verification. You may submit this mandate, but verification is strongly recommended prior to disbursement.
            </p>
          </div>
        )}

        {/* ── SECTION 2: Core Mandate Terms & Live Calculator ── */}
        {!isEditingTerms && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="font-mono text-xxs font-medium uppercase tracking-wider text-slate-500 block mb-1.5">
                  Management Fee Rate (%)
                </label>
                <div className="relative">
                  <input
                    required
                    type="number"
                    min="0.1"
                    max="100"
                    step="0.1"
                    value={ratePercent}
                    onChange={(e) => setRatePercent(e.target.value)}
                    className="w-full h-11 rounded-xl border border-slate-200/90 bg-white px-3.5 pr-8 font-mono text-xs font-medium text-slate-900 focus:outline-none focus:border-[#151936] focus:ring-1 focus:ring-[#151936] transition-all shadow-2xs"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono text-slate-400 font-medium">%</span>
                </div>
              </div>

              <div>
                <label className="font-mono text-xxs font-medium uppercase tracking-wider text-slate-500 block mb-1.5">
                  Contracted Units Count
                </label>
                <input
                  required
                  type="number"
                  min="1"
                  step="1"
                  value={unitCount}
                  onChange={(e) => setUnitCount(e.target.value)}
                  className="w-full h-11 rounded-xl border border-slate-200/90 bg-white px-3.5 font-mono text-xs font-medium text-slate-900 focus:outline-none focus:border-[#151936] focus:ring-1 focus:ring-[#151936] transition-all shadow-2xs"
                />
              </div>
            </div>

            {/* Live Fee & Governance Tier Preview Bar */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <IconBuildingBank size={16} className="text-[#151936] shrink-0" />
                <span className="text-slate-600 font-medium">Configured Commission:</span>
                <span className="font-mono font-medium text-slate-900">{rateValue.toFixed(1)}%</span>
              </div>
              <Badge tone={requiresCeoApproval ? "warning" : "primary"} className="text-xxs font-mono">
                {requiresCeoApproval ? "Requires GM + CEO Approval (>10 Units)" : "Requires GM Sign-off"}
              </Badge>
            </div>

            {/* Rate Justification Field */}
            {rateDiffersFromDefault && (
              <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/40 space-y-1.5">
                <label className="font-mono text-xxs font-medium uppercase tracking-wider text-amber-800 block">
                  Rate Justification Required (Standard is 10.0%)
                </label>
                <textarea
                  required
                  rows={2}
                  placeholder="Explain why this mandate uses a non-standard rate..."
                  value={rateJustification}
                  onChange={(e) => setRateJustification(e.target.value)}
                  className="w-full rounded-lg border border-amber-200 bg-white p-2.5 text-xs text-slate-900 focus:outline-none focus:border-amber-500 transition-colors shadow-2xs resize-none"
                />
              </div>
            )}

            {/* Mandate Duration Dates */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="font-mono text-xxs font-medium uppercase tracking-wider text-slate-500 block mb-1.5">
                  Commencement Date
                </label>
                <input
                  required
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full h-11 rounded-xl border border-slate-200/90 bg-white px-3.5 text-xs text-slate-900 focus:outline-none focus:border-[#151936] focus:ring-1 focus:ring-[#151936] transition-all shadow-2xs"
                />
              </div>

              <div>
                <label className="font-mono text-xxs font-medium uppercase tracking-wider text-slate-500 block mb-1.5">
                  Expiry Date (Optional)
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full h-11 rounded-xl border border-slate-200/90 bg-white px-3.5 text-xs text-slate-900 focus:outline-none focus:border-[#151936] focus:ring-1 focus:ring-[#151936] transition-all shadow-2xs"
                />
              </div>
            </div>

            {/* Manager Assignment */}
            <div>
              <label className="font-mono text-xxs font-medium uppercase tracking-wider text-slate-500 block mb-1.5">
                Assigned Property Manager (Optional)
              </label>
              <div className="relative">
                <IconUserCog size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <select
                  value={assignedPmId}
                  onChange={(e) => setAssignedPmId(e.target.value)}
                  className="w-full h-11 rounded-xl border border-slate-200/90 bg-white pl-10 pr-3.5 text-xs font-medium text-slate-900 focus:outline-none focus:border-[#151936] focus:ring-1 focus:ring-[#151936] transition-all shadow-2xs appearance-none"
                >
                  <option value="">Unassigned (Desk Pool)</option>
                  {managers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}{m.title ? ` · ${m.title}` : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* ── SECTION 3: Additional Operational Terms ── */}
        <div className="pt-4 border-t border-slate-100 space-y-4">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xxs font-medium uppercase tracking-wider text-slate-500">
              Operational Scope & Authority Terms
            </span>
            <span className="text-xxs text-slate-400 font-medium">Optional Parameters</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="font-mono text-xxs font-medium uppercase tracking-wider text-slate-500 block mb-1.5">
                Maintenance Limit Authority (KES)
              </label>
              <input
                type="number"
                min="0"
                step="1000"
                placeholder="e.g. 100,000"
                value={maintenanceAuthorityKes}
                onChange={(e) => setMaintenanceAuthorityKes(e.target.value)}
                className="w-full h-11 rounded-xl border border-slate-200/90 bg-white px-3.5 font-mono text-xs font-medium text-slate-900 focus:outline-none focus:border-[#151936] focus:ring-1 focus:ring-[#151936] transition-all shadow-2xs"
              />
            </div>

            <div>
              <label className="font-mono text-xxs font-medium uppercase tracking-wider text-slate-500 block mb-1.5">
                Notice Period (Days)
              </label>
              <input
                type="number"
                min="0"
                step="1"
                placeholder="e.g. 90"
                value={noticePeriodDays}
                onChange={(e) => setNoticePeriodDays(e.target.value)}
                className="w-full h-11 rounded-xl border border-slate-200/90 bg-white px-3.5 font-mono text-xs font-medium text-slate-900 focus:outline-none focus:border-[#151936] focus:ring-1 focus:ring-[#151936] transition-all shadow-2xs"
              />
            </div>
          </div>

          <div>
            <label className="font-mono text-xxs font-medium uppercase tracking-wider text-slate-500 block mb-1.5">
              Renewal Structure
            </label>
            <select
              value={renewalType}
              onChange={(e) => setRenewalType(e.target.value)}
              className="w-full h-11 rounded-xl border border-slate-200/90 bg-white px-3.5 text-xs font-medium text-slate-900 focus:outline-none focus:border-[#151936] focus:ring-1 focus:ring-[#151936] transition-all shadow-2xs appearance-none"
            >
              <option value="">Not yet configured</option>
              {RENEWAL_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="font-mono text-xxs font-medium uppercase tracking-wider text-slate-500 block mb-1.5">
              Scope of Management Description
            </label>
            <textarea
              rows={3}
              placeholder="Describe what Sunland is authorized to manage under this mandate..."
              value={scopeDescription}
              onChange={(e) => setScopeDescription(e.target.value)}
              className="w-full rounded-xl border border-slate-200/90 bg-white p-3 text-xs text-slate-900 focus:outline-none focus:border-[#151936] focus:ring-1 focus:ring-[#151936] transition-all shadow-2xs resize-none"
            />
          </div>
        </div>

        {/* Corporate Governance Footer Banner */}
        {!isEditingTerms && (
          <div className="flex items-start gap-2.5 rounded-xl border border-emerald-200/80 bg-emerald-50/50 p-3.5 text-xs text-emerald-800 leading-relaxed shadow-2xs">
            <IconShieldCheck size={16} className="text-emerald-700 shrink-0 mt-0.5" />
            <p>
              <span className="font-medium text-emerald-900">Executive Self-Authorization:</span> Mandates submitted under Chief Executive Officer / Main Admin authority activate immediately upon submission with <span className="font-medium text-emerald-900">0 escalation required</span> (ADR 014 §14.2). Non-executive submissions route automatically for GM/CEO approval.
            </p>
          </div>
        )}

        {/* Modal Controls */}
        <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting} className="rounded-xl text-xs px-4 py-2 font-medium">
            Cancel
          </Button>
          <Button type="submit" disabled={submitting} className="bg-[#151936] text-white hover:bg-slate-800 rounded-xl text-xs px-5 py-2 font-medium shadow-2xs">
            {submitting ? "Submitting..." : isEditingTerms ? "Save Terms" : "Submit Mandate"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

