"use client";

import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast-provider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { IconBuildingCommunity, IconChevronDown, IconInfoCircle, IconTool } from "@tabler/icons-react";
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
    "inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-medium cursor-pointer transition-all duration-200 border shadow-2xs",
    active
      ? "bg-[#151936] text-white border-[#151936] shadow-xs"
      : "bg-slate-50/70 text-slate-700 border-slate-200/80 hover:bg-slate-100 hover:border-slate-300"
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

  const selectedProperty = useMemo(
    () => propertyOptions.find((p) => p.id === selectedPropertyId),
    [propertyOptions, selectedPropertyId]
  );

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
      return `Enter an estimate — up to KES ${autoApproveCeiling.toLocaleString()} auto-approves under PM authority; up to KES ${ceoThreshold.toLocaleString()} routes to GM approval; above that routes to CEO.`;
    }
    const tier = costApprovalTierFor({ costKes: estimate, maintenanceAuthorityKes: authorityByPropertyId.get(selectedPropertyId) ?? null, gmThresholdKes: gmThreshold, ceoThresholdKes: ceoThreshold });
    if (tier === "auto") return `Routing: auto-approved (≤ KES ${autoApproveCeiling.toLocaleString()} PM authority). Crew can be scheduled immediately; cost posts to the mandate ledger.`;
    if (tier === "gm") return `Routing: GM approval required (KES ${autoApproveCeiling.toLocaleString()}–${ceoThreshold.toLocaleString()}). Crew mobilization waits on decision.`;
    return `Routing: CEO approval queue (above KES ${ceoThreshold.toLocaleString()}) via the approval engine, dual sign-off. Flagged in Needs Attention.`;
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
      title={title ?? "New Work Order"}
      description={propertyName ?? "Log a work order for field operations, repairs, or scheduled compliance."}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Issue Title Input */}
        <div>
          <label className="text-xs font-medium text-slate-700 uppercase tracking-wider font-mono mb-1.5 block">
            Work Order Title <span className="text-rose-500">*</span>
          </label>
          <input
            required
            type="text"
            placeholder="e.g. Water heater failure, Apt 3C"
            value={issueTitle}
            onChange={(e) => { setIssueTitle(e.target.value); setTitleErr(false); }}
            className="w-full h-10 rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 text-xs text-slate-900 font-medium outline-none placeholder:text-slate-400 focus:bg-white focus:border-[#151936]/40 transition-all shadow-2xs"
          />
          {titleErr && <p className="text-xs font-mono text-rose-600 mt-1">Please enter an issue title to continue.</p>}
        </div>

        {/* Executive Property Selector Container */}
        {!propertyId && (
          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <label className="font-mono text-xs font-medium uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <IconBuildingCommunity size={15} className="text-slate-500" />
                Target Property <span className="text-rose-500">*</span>
              </label>
              {selectedProperty?.propertyCode && (
                <Badge tone="data">{selectedProperty.propertyCode}</Badge>
              )}
            </div>

            <div className="relative">
              <select
                required
                value={selectedPropertyId}
                onChange={(e) => setSelectedPropertyId(e.target.value)}
                className="w-full h-11 rounded-xl border border-slate-200/90 bg-white px-3.5 text-xs font-medium text-slate-900 outline-none focus:border-[#151936] focus:ring-1 focus:ring-[#151936] transition-all shadow-2xs appearance-none cursor-pointer"
              >
                <option value="" disabled>Select target property from portfolio...</option>
                {propertyOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.propertyCode ? `(${p.propertyCode})` : ""}
                  </option>
                ))}
              </select>
              <IconChevronDown size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>
        )}

        {/* Works Category */}
        <div>
          <label className="text-xs font-medium text-slate-700 uppercase tracking-wider font-mono mb-1.5 block">
            Works Category
          </label>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Category">
            {CATEGORY_OPTIONS.map((c) => (
              <button key={c} type="button" onClick={() => setCategory(c)} className={pillClass(category === c)}>
                <IconTool size={14} className={category === c ? "text-white" : "text-slate-500"} />
                {CATEGORY_META[c].label}
              </button>
            ))}
          </div>
        </div>

        {/* Severity / Priority */}
        <div>
          <label className="text-xs font-medium text-slate-700 uppercase tracking-wider font-mono mb-1.5 block">
            Priority & SLA Severity
          </label>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Severity">
            {SEVERITY_OPTIONS.map((s) => (
              <button key={s} type="button" onClick={() => setSeverity(s)} className={pillClass(severity === s)}>
                {PRIORITY_META[s].label}
              </button>
            ))}
          </div>
        </div>

        {/* Estimated Cost (KES) */}
        <div>
          <label className="text-xs font-medium text-slate-700 uppercase tracking-wider font-mono mb-1.5 block">
            Cost Estimate (KES)
          </label>
          <input
            type="text"
            inputMode="numeric"
            placeholder="e.g. 15,000"
            value={estimateInput}
            onChange={(e) => setEstimateInput(e.target.value)}
            className="w-full h-10 rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 font-mono text-xs font-medium text-slate-900 outline-none placeholder:text-slate-400 focus:bg-white focus:border-[#151936]/40 transition-all shadow-2xs"
          />
        </div>

        {/* Routing Callout Alert Card */}
        <div className="bg-gradient-to-br from-slate-50 to-white border border-slate-200/80 rounded-2xl p-3.5 flex items-start gap-3 shadow-2xs">
          <div className="size-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0 border border-slate-200/60 shadow-2xs mt-0.5">
            <IconInfoCircle size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-mono font-medium text-slate-800 leading-relaxed">{routeNote}</p>
          </div>
        </div>

        {/* Detailed Description */}
        <div>
          <label className="text-xs font-medium text-slate-700 uppercase tracking-wider font-mono mb-1.5 block">
            Detailed Description (Optional)
          </label>
          <textarea
            rows={3}
            placeholder="Describe the nature of the maintenance requirement, specific unit location, and any urgent circumstances..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs text-slate-900 font-medium outline-none placeholder:text-slate-400 focus:bg-white focus:border-[#151936]/40 transition-all shadow-2xs resize-none"
          />
        </div>

        {/* Modal Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200/80">
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting} className="rounded-xl">
            Cancel
          </Button>
          <Button type="submit" disabled={submitting} className="rounded-xl bg-[#151936] text-white hover:bg-[#1f254e]">
            {submitting ? "Creating..." : "Create Work Order"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
