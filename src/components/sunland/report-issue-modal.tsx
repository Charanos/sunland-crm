"use client";

import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import {
  CATEGORY_META,
  PRIORITY_META,
  costApprovalTierFor,
  type MaintenanceCategory,
  type MaintenancePriority,
} from "./maintenance-constants";

interface PropertyOption {
  id: string;
  name: string;
  propertyCode: string;
}

interface ReportIssueModalProps {
  open: boolean;
  entityId: string | null;
  /** Pre-set when opened from a specific property's page; omit to show a property picker (board-level "New Work Order"). */
  propertyId?: string;
  propertyName?: string;
  /** Defaults to "Report Maintenance Issue" - pass "New Work Order" from the board-level entry point. */
  title?: string;
  onClose: () => void;
  onCreated: () => void;
}

const CATEGORY_OPTIONS: MaintenanceCategory[] = ["reactive", "planned", "compliance"];
const SEVERITY_OPTIONS: MaintenancePriority[] = ["routine", "urgent", "critical"];

function pillClass(active: boolean) {
  return cn(
    "inline-flex items-center rounded-full px-3.5 py-1.5 text-xs font-medium cursor-pointer transition-colors border",
    active ? "bg-[#151936] text-white border-[#151936]" : "bg-white text-slate-600 border-slate-200 hover:border-slate-300",
  );
}

export function ReportIssueModal({ open, entityId, propertyId, propertyName, title, onClose, onCreated }: ReportIssueModalProps) {
  const { pushToast } = useToast();
  const [selectedPropertyId, setSelectedPropertyId] = useState(propertyId ?? "");
  const [issueTitle, setIssueTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<MaintenanceCategory>("reactive");
  const [severity, setSeverity] = useState<MaintenancePriority>("routine");
  const [estimateInput, setEstimateInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [titleErr, setTitleErr] = useState(false);

  const [propertyOptions, setPropertyOptions] = useState<PropertyOption[]>([]);
  const [authorityByPropertyId, setAuthorityByPropertyId] = useState<Map<string, number | null>>(new Map());
  const [gmThreshold, setGmThreshold] = useState(25000);
  const [ceoThreshold, setCeoThreshold] = useState(100000);

  useEffect(() => {
    Promise.resolve().then(() => {
      setSelectedPropertyId(propertyId ?? "");
      setTitleErr(false);
    });
  }, [propertyId, open]);

  useEffect(() => {
    if (!open || !entityId) return;
    if (!propertyId) {
      fetch(`/api/properties?entityId=${entityId}`)
        .then((res) => res.json())
        .then((data) => setPropertyOptions(data.properties ?? []))
        .catch(() => setPropertyOptions([]));
    }
    // Real routing-preview inputs, never hardcoded: each property's own
    // mandate.maintenanceAuthorityKes (auto-approve ceiling), and the real
    // settings-backed GM/CEO thresholds costApprovalTierFor is evaluated against.
    fetch(`/api/mandates?entityId=${entityId}`)
      .then((res) => res.json())
      .then((data) => {
        const rows: Array<{ propertyId: string; maintenanceAuthorityKes: string | null }> = Array.isArray(data.mandates) ? data.mandates : [];
        setAuthorityByPropertyId(new Map(rows.map((m) => [m.propertyId, m.maintenanceAuthorityKes ? parseFloat(m.maintenanceAuthorityKes) : null])));
      })
      .catch(() => setAuthorityByPropertyId(new Map()));
    fetch(`/api/settings?entityId=${entityId}`)
      .then((res) => res.json())
      .then((data) => {
        const rows: Array<{ key: string; value: unknown }> = Array.isArray(data.settings) ? data.settings : [];
        const gm = rows.find((r) => r.key === "maintenance_cost_gm_threshold_kes");
        const ceo = rows.find((r) => r.key === "maintenance_cost_ceo_threshold_kes");
        if (gm && typeof gm.value === "number") setGmThreshold(gm.value);
        if (ceo && typeof ceo.value === "number") setCeoThreshold(ceo.value);
      })
      .catch(() => {});
  }, [open, entityId, propertyId]);

  const autoApproveCeiling = useMemo(() => {
    const authority = authorityByPropertyId.get(selectedPropertyId);
    return authority ?? gmThreshold;
  }, [authorityByPropertyId, selectedPropertyId, gmThreshold]);

  const estimate = useMemo(() => parseInt(estimateInput.replace(/[^0-9]/g, ""), 10) || 0, [estimateInput]);

  const routeNote = useMemo(() => {
    if (estimate === 0) {
      return `Enter an estimate — up to KES ${autoApproveCeiling.toLocaleString()} auto-approves under PM authority; up to KES ${ceoThreshold.toLocaleString()} routes to GM approval; above that goes to the CEO approval queue.`;
    }
    const tier = costApprovalTierFor({ costKes: estimate, maintenanceAuthorityKes: authorityByPropertyId.get(selectedPropertyId) ?? null, gmThresholdKes: gmThreshold, ceoThresholdKes: ceoThreshold });
    if (tier === "auto") return `Routing: auto-approved (≤ KES ${autoApproveCeiling.toLocaleString()} PM authority). Crew can be scheduled immediately; cost posts to the mandate ledger.`;
    if (tier === "gm") return `Routing: GM approval required (KES ${autoApproveCeiling.toLocaleString()}–${ceoThreshold.toLocaleString()}). Crew mobilization waits on that decision.`;
    return `Routing: CEO approval queue (above KES ${ceoThreshold.toLocaleString()}) via the approval engine, dual sign-off. Flagged in the Needs Attention band.`;
  }, [estimate, autoApproveCeiling, authorityByPropertyId, selectedPropertyId, gmThreshold, ceoThreshold]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPropertyId || !issueTitle.trim()) {
      setTitleErr(!issueTitle.trim());
      if (!selectedPropertyId) pushToast({ tone: "warning", title: "Missing fields", body: "Please select a property." });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/maintenance-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityId,
          propertyId: selectedPropertyId,
          title: issueTitle.trim(),
          description: description.trim() || issueTitle.trim(),
          priority: severity,
          category,
          estimatedCostKes: estimate > 0 ? estimate : undefined,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error ?? "Failed to report issue");
      }

      pushToast({
        tone: "success",
        title: "Work order created",
        body: `${issueTitle.trim()} — ${estimate > gmThreshold ? "sent for approval." : "logged and ready to schedule."}`,
      });
      setIssueTitle("");
      setDescription("");
      setCategory("reactive");
      setSeverity("routine");
      setEstimateInput("");
      onCreated();
      onClose();
    } catch (err) {
      console.error(err);
      pushToast({ tone: "warning", title: "Error", body: err instanceof Error ? err.message : "Could not save the maintenance request." });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={submitting ? () => { } : onClose}
      title={title ?? "Report Maintenance Issue"}
      description={propertyName}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label-caps text-slate-400 mb-1.5 block">Issue — required</label>
          <input
            required
            type="text"
            placeholder="e.g. Water heater failure, Apt 3C"
            value={issueTitle}
            onChange={(e) => { setIssueTitle(e.target.value); setTitleErr(false); }}
            className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-body-primary focus:outline-none focus:border-[#151936]/40 transition-colors shadow-sm"
          />
          {titleErr && <p className="text-xs text-rose-600 mt-1">Describe the issue to continue.</p>}
        </div>

        {!propertyId && (
          <div>
            <label className="label-caps text-slate-400 mb-1.5 block">Property</label>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Property">
              {propertyOptions.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedPropertyId(p.id)}
                  className={pillClass(selectedPropertyId === p.id)}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className="label-caps text-slate-400 mb-1.5 block">Category</label>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Category">
            {CATEGORY_OPTIONS.map((c) => (
              <button key={c} type="button" onClick={() => setCategory(c)} className={pillClass(category === c)}>
                {CATEGORY_META[c].label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label-caps text-slate-400 mb-1.5 block">Severity</label>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Severity">
            {SEVERITY_OPTIONS.map((s) => (
              <button key={s} type="button" onClick={() => setSeverity(s)} className={pillClass(severity === s)}>
                {PRIORITY_META[s].label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label-caps text-slate-400 mb-1.5 block">Cost estimate (KES)</label>
          <input
            type="text"
            inputMode="numeric"
            placeholder="15,000"
            value={estimateInput}
            onChange={(e) => setEstimateInput(e.target.value)}
            className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 mono-data text-body-primary focus:outline-none focus:border-[#151936]/40 transition-colors shadow-sm"
          />
        </div>

        <p className="text-xs text-slate-400 leading-relaxed">{routeNote}</p>

        <div>
          <label className="label-caps text-slate-400 mb-1.5 block">Detailed description (optional)</label>
          <textarea
            rows={3}
            placeholder="Describe the nature of the maintenance requirement, locations, and any urgent circumstances..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-body-primary focus:outline-none focus:border-[#151936]/40 transition-colors shadow-sm resize-none"
          />
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Creating..." : "Create Work Order"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
