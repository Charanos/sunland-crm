"use client";

import { useEffect, useState } from "react";
import { IconCheck, IconPlus, IconTrash } from "@tabler/icons-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useToast } from "@/components/ui/toast-provider";

export interface ValuationSubmitTarget {
  id: string;
  valuationCode: string;
  marketValueKes: string | null;
  proposedFeeRate: string | null;
  methodology: string | null;
}

interface ComparableRow {
  name: string;
  pricePerSqft: string;
  adjustmentPct: string;
}

const EMPTY_FORM = {
  marketValueKes: "",
  proposedFeeRate: "",
  methodology: "",
};

function adjustedValue(marketValueKes: string, adjustmentPct: string): number {
  const value = parseFloat(marketValueKes) || 0;
  const adj = parseFloat(adjustmentPct) || 0;
  return Math.round(value * (1 + adj / 100));
}

/**
 * The site_visit -> valued transition: captures a real, user-entered
 * assessed value/proposed fee/methodology/comparables in one call - never
 * synthesized. Comparable evidence is optional but, if added, is entirely
 * typed in by whoever submits the valuation (this codebase has no external
 * comparable-sales data source to draw from).
 */
export function ValuationSubmitModal({
  open,
  entityId,
  valuation,
  onClose,
  onSubmitted,
}: {
  open: boolean;
  entityId: string | null;
  valuation: ValuationSubmitTarget | null;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const { pushToast } = useToast();
  const [form, setForm] = useState(EMPTY_FORM);
  const [comparables, setComparables] = useState<ComparableRow[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !valuation) return;
    Promise.resolve().then(() => {
      setForm({
        marketValueKes: valuation.marketValueKes ?? "",
        proposedFeeRate: valuation.proposedFeeRate ? (Number(valuation.proposedFeeRate) * 100).toString() : "",
        methodology: valuation.methodology ?? "",
      });
      setComparables([]);
    });
  }, [open, valuation]);

  if (!valuation) return null;

  const addComparable = () => setComparables((c) => [...c, { name: "", pricePerSqft: "", adjustmentPct: "0" }]);
  const updateComparable = (idx: number, patch: Partial<ComparableRow>) =>
    setComparables((c) => c.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
  const removeComparable = (idx: number) => setComparables((c) => c.filter((_, i) => i !== idx));

  const handleSubmit = async () => {
    if (!form.marketValueKes.trim()) {
      pushToast({ tone: "warning", title: "Assessed value required", body: "Record the assessed value to submit this valuation." });
      return;
    }
    if (!form.proposedFeeRate.trim()) {
      pushToast({ tone: "warning", title: "Proposed fee required", body: "Set the proposed management-fee rate for this prospect." });
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/valuations/${valuation.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityId,
          marketValueKes: form.marketValueKes.trim(),
          proposedFeeRate: (parseFloat(form.proposedFeeRate) / 100).toFixed(4),
          methodology: form.methodology.trim() || undefined,
          comparables: comparables
            .filter((c) => c.name.trim())
            .map((c) => ({
              name: c.name.trim(),
              pricePerSqft: parseFloat(c.pricePerSqft) || 0,
              adjustmentPct: parseFloat(c.adjustmentPct) || 0,
              adjustedValueKes: adjustedValue(form.marketValueKes, c.adjustmentPct),
            })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit valuation");

      pushToast({ tone: "success", title: "Valuation Submitted", body: `${valuation.valuationCode} valued - awaiting the offer decision.` });
      onSubmitted();
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to submit valuation";
      pushToast({ tone: "warning", title: "Error", body: message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => !isSubmitting && onClose()}
      title={`Submit Valuation - ${valuation.valuationCode}`}
      description="Record the assessed value, proposed fee, and methodology"
      size="lg"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label-caps text-slate-400 mb-1.5 block">Assessed Value (KES) <span className="text-rose-500">*</span></label>
            <input
              type="number"
              className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 mono-data placeholder:text-slate-400 focus:outline-none focus:border-[#151936]/40 transition-colors shadow-sm"
              placeholder="e.g. 34500000"
              value={form.marketValueKes}
              onChange={(e) => setForm((f) => ({ ...f, marketValueKes: e.target.value }))}
            />
          </div>
          <div>
            <label className="label-caps text-slate-400 mb-1.5 block">Proposed Management Fee (%) <span className="text-rose-500">*</span></label>
            <input
              type="number"
              step="0.1"
              className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 mono-data placeholder:text-slate-400 focus:outline-none focus:border-[#151936]/40 transition-colors shadow-sm"
              placeholder="e.g. 8.0"
              value={form.proposedFeeRate}
              onChange={(e) => setForm((f) => ({ ...f, proposedFeeRate: e.target.value }))}
            />
          </div>
        </div>
        <div>
          <label className="label-caps text-slate-400 mb-1.5 block">Methodology</label>
          <textarea
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-body-primary resize-none h-24 placeholder:text-slate-400 focus:outline-none focus:border-[#151936]/40 transition-colors shadow-sm"
            placeholder="Approach used (income capitalization, direct comparison…), yield/rate assumptions, condition notes…"
            value={form.methodology}
            onChange={(e) => setForm((f) => ({ ...f, methodology: e.target.value }))}
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="label-caps text-slate-400">Comparable Evidence (optional)</label>
            <button type="button" onClick={addComparable} className="text-xs font-medium text-[#151936] hover:underline flex items-center gap-1">
              <IconPlus size={13} /> Add comparable
            </button>
          </div>
          {comparables.length > 0 && (
            <div className="space-y-2">
              {comparables.map((row, idx) => (
                <div key={idx} className="grid grid-cols-[1.6fr_1fr_0.8fr_auto] gap-2 items-center">
                  <input
                    className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-sm placeholder:text-slate-400 focus:outline-none focus:border-[#151936]/40"
                    placeholder="Comparable name"
                    value={row.name}
                    onChange={(e) => updateComparable(idx, { name: e.target.value })}
                  />
                  <input
                    type="number"
                    className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 mono-data text-sm placeholder:text-slate-400 focus:outline-none focus:border-[#151936]/40"
                    placeholder="KES/sqft"
                    value={row.pricePerSqft}
                    onChange={(e) => updateComparable(idx, { pricePerSqft: e.target.value })}
                  />
                  <input
                    type="number"
                    className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 mono-data text-sm placeholder:text-slate-400 focus:outline-none focus:border-[#151936]/40"
                    placeholder="Adj. %"
                    value={row.adjustmentPct}
                    onChange={(e) => updateComparable(idx, { adjustmentPct: e.target.value })}
                  />
                  <button type="button" onClick={() => removeComparable(idx)} className="text-slate-400 hover:text-rose-600 p-1.5">
                    <IconTrash size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? (
              <><LoadingSpinner size="sm" /><span className="ml-2">Submitting…</span></>
            ) : (
              <><IconCheck size={14} /> Submit Valuation</>
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
