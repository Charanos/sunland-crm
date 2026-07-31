"use client";

import { useEffect, useState } from "react";
import {
  IconCheck,
  IconPlus,
  IconTrash,
  IconReportMoney,
} from "@tabler/icons-react";
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
      title={`Submit Valuation File: ${valuation.valuationCode}`}
      description="Record the assessed market value, proposed management fee rate, and valuation methodology."
      size="lg"
    >
      <div className="space-y-6 pt-1">
        {/* Top Valuation Context Card */}
        <div className="p-4 rounded-2xl border border-slate-200/90 bg-slate-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="size-11 rounded-xl bg-white border border-slate-200/90 flex items-center justify-center shrink-0 text-[#151936] shadow-2xs">
              <IconReportMoney size={22} />
            </div>
            <div className="flex flex-col min-w-0">
              <p className="text-xs font-medium text-slate-900 truncate leading-snug">
                File: {valuation.valuationCode}
              </p>
              <p className="text-xxs text-slate-500 truncate mt-0.5 font-mono">
                Status: <span className="font-medium text-[#151936]">Awaiting Assessed Market Value & Fee Proposal</span>
              </p>
            </div>
          </div>
        </div>

        {/* Section 1: Assessed Value & Fee Rate */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 pb-1 border-b border-slate-100">
            <span className="font-mono text-xxs font-medium uppercase tracking-wider text-slate-400">
              01 · Assessed Valuation & Fee Proposal
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="font-mono text-xxs font-medium uppercase tracking-wider text-slate-500 block mb-1.5">
                Assessed Market Value (KES) *
              </label>
              <input
                type="number"
                className="w-full h-11 rounded-xl border border-slate-200/90 bg-white px-3.5 font-mono text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#151936] focus:ring-1 focus:ring-[#151936] transition-all shadow-2xs"
                placeholder="e.g. 34500000"
                value={form.marketValueKes}
                onChange={(e) => setForm((f) => ({ ...f, marketValueKes: e.target.value }))}
              />
            </div>
            <div>
              <label className="font-mono text-xxs font-medium uppercase tracking-wider text-slate-500 block mb-1.5">
                Proposed Management Fee Rate (%) *
              </label>
              <input
                type="number"
                step="0.1"
                className="w-full h-11 rounded-xl border border-slate-200/90 bg-white px-3.5 font-mono text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#151936] focus:ring-1 focus:ring-[#151936] transition-all shadow-2xs"
                placeholder="e.g. 8.0"
                value={form.proposedFeeRate}
                onChange={(e) => setForm((f) => ({ ...f, proposedFeeRate: e.target.value }))}
              />
            </div>
          </div>
        </div>

        {/* Section 2: Methodology & Approach */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 pb-1 border-b border-slate-100">
            <span className="font-mono text-xxs font-medium uppercase tracking-wider text-slate-400">
              02 · Valuation Methodology & Assumptions
            </span>
          </div>

          <div>
            <label className="font-mono text-xxs font-medium uppercase tracking-wider text-slate-500 block mb-1.5">
              Valuation Approach & Technical Notes
            </label>
            <textarea
              className="w-full rounded-xl border border-slate-200/90 bg-white p-3.5 text-xs text-slate-900 resize-none h-24 placeholder:text-slate-400 focus:outline-none focus:border-[#151936] focus:ring-1 focus:ring-[#151936] transition-all shadow-2xs"
              placeholder="Approach used (income capitalization, direct comparison…), yield/rate assumptions, condition notes…"
              value={form.methodology}
              onChange={(e) => setForm((f) => ({ ...f, methodology: e.target.value }))}
            />
          </div>
        </div>

        {/* Section 3: Comparable Evidence */}
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-1 border-b border-slate-100">
            <span className="font-mono text-xxs font-medium uppercase tracking-wider text-slate-400">
              03 · Comparable Evidence (optional)
            </span>
            <button
              type="button"
              onClick={addComparable}
              className="text-xs font-medium text-[#151936] hover:text-emerald-700 transition-colors flex items-center gap-1 bg-white border border-slate-200/90 px-2.5 py-1 rounded-lg shadow-2xs cursor-pointer"
            >
              <IconPlus size={13} /> Add Evidence Row
            </button>
          </div>

          {comparables.length > 0 && (
            <div className="space-y-2">
              {comparables.map((row, idx) => (
                <div key={idx} className="grid grid-cols-[1.6fr_1fr_0.8fr_auto] gap-2 items-center">
                  <input
                    className="h-9 rounded-xl border border-slate-200/80 bg-white px-3 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#151936] shadow-2xs"
                    placeholder="Comparable property name"
                    value={row.name}
                    onChange={(e) => updateComparable(idx, { name: e.target.value })}
                  />
                  <input
                    type="number"
                    className="h-9 rounded-xl border border-slate-200/80 bg-white px-3 font-mono text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#151936] shadow-2xs"
                    placeholder="KES/sqft"
                    value={row.pricePerSqft}
                    onChange={(e) => updateComparable(idx, { pricePerSqft: e.target.value })}
                  />
                  <input
                    type="number"
                    className="h-9 rounded-xl border border-slate-200/80 bg-white px-3 font-mono text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#151936] shadow-2xs"
                    placeholder="Adj. %"
                    value={row.adjustmentPct}
                    onChange={(e) => updateComparable(idx, { adjustmentPct: e.target.value })}
                  />
                  <button
                    type="button"
                    onClick={() => removeComparable(idx)}
                    className="text-slate-400 hover:text-rose-600 p-1.5 transition-colors cursor-pointer"
                  >
                    <IconTrash size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200/80">
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={isSubmitting}
            className="h-10 px-4 text-xs font-medium rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="bg-[#151936] text-white hover:bg-[#1f254e] transition-colors rounded-xl px-5 h-10 text-xs font-medium flex items-center gap-2 shadow-2xs cursor-pointer"
          >
            {isSubmitting ? (
              <><LoadingSpinner size="sm" /><span>Submitting Valuation…</span></>
            ) : (
              <><IconCheck size={15} /> Submit Valuation File</>
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
