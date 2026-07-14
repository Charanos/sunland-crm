"use client";

import { useEffect, useState } from "react";
import { IconCheck } from "@tabler/icons-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useToast } from "@/components/ui/toast-provider";

export interface ValuationCompleteTarget {
  id: string;
  valuationCode: string;
  marketValueKes: string | null;
  forcedSaleValueKes: string | null;
  insuranceValueKes: string | null;
  validUntil: string | null;
  reportUrl: string | null;
}

const EMPTY_FORM = {
  marketValueKes: "",
  forcedSaleValueKes: "",
  insuranceValueKes: "",
  validUntil: "",
  reportUrl: "",
};

export function ValuationCompleteModal({
  open,
  entityId,
  valuation,
  onClose,
  onCompleted,
}: {
  open: boolean;
  entityId: string | null;
  valuation: ValuationCompleteTarget | null;
  onClose: () => void;
  onCompleted: () => void;
}) {
  const { pushToast } = useToast();
  const [form, setForm] = useState(EMPTY_FORM);
  const [isCompleting, setIsCompleting] = useState(false);

  useEffect(() => {
    if (!open || !valuation) return;
    Promise.resolve().then(() => {
      setForm({
        marketValueKes: valuation.marketValueKes ?? "",
        forcedSaleValueKes: valuation.forcedSaleValueKes ?? "",
        insuranceValueKes: valuation.insuranceValueKes ?? "",
        validUntil: valuation.validUntil ? valuation.validUntil.slice(0, 10) : "",
        reportUrl: valuation.reportUrl ?? "",
      });
    });
  }, [open, valuation]);

  if (!valuation) return null;

  const handleComplete = async () => {
    if (!form.marketValueKes.trim()) {
      pushToast({ tone: "warning", title: "Market value required", body: "Record the appraised market value to complete." });
      return;
    }
    setIsCompleting(true);
    try {
      const res = await fetch(`/api/valuations/${valuation.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityId,
          status: "completed",
          marketValueKes: form.marketValueKes.trim(),
          forcedSaleValueKes: form.forcedSaleValueKes.trim() || null,
          insuranceValueKes: form.insuranceValueKes.trim() || null,
          validUntil: form.validUntil ? new Date(form.validUntil).toISOString() : null,
          reportUrl: form.reportUrl.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to complete valuation");

      pushToast({ tone: "success", title: "Valuation Updated", body: `${valuation.valuationCode} completed and report values recorded.` });
      onCompleted();
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to complete valuation";
      pushToast({ tone: "warning", title: "Error", body: message });
    } finally {
      setIsCompleting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => !isCompleting && onClose()}
      title={`Complete ${valuation.valuationCode}`}
      description="Record the appraised values and deliver the report"
      size="md"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="label-caps text-slate-400 mb-1.5 block">Open Market Value (KES) <span className="text-rose-500">*</span></label>
            <input
              type="number"
              className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 mono-data placeholder:text-slate-400 focus:outline-none focus:border-[#151936]/40 transition-colors shadow-sm"
              placeholder="e.g. 48500000"
              value={form.marketValueKes}
              onChange={(e) => setForm((f) => ({ ...f, marketValueKes: e.target.value }))}
            />
          </div>
          <div>
            <label className="label-caps text-slate-400 mb-1.5 block">Forced Sale Value (KES)</label>
            <input
              type="number"
              className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 mono-data placeholder:text-slate-400 focus:outline-none focus:border-[#151936]/40 transition-colors shadow-sm"
              placeholder="Typically ~80% of OMV"
              value={form.forcedSaleValueKes}
              onChange={(e) => setForm((f) => ({ ...f, forcedSaleValueKes: e.target.value }))}
            />
          </div>
          <div>
            <label className="label-caps text-slate-400 mb-1.5 block">Insurance Value (KES)</label>
            <input
              type="number"
              className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 mono-data placeholder:text-slate-400 focus:outline-none focus:border-[#151936]/40 transition-colors shadow-sm"
              placeholder="Reinstatement cost"
              value={form.insuranceValueKes}
              onChange={(e) => setForm((f) => ({ ...f, insuranceValueKes: e.target.value }))}
            />
          </div>
          <div>
            <label className="label-caps text-slate-400 mb-1.5 block">Valid Until</label>
            <input
              type="date"
              className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 mono-data text-slate-800 focus:outline-none focus:border-[#151936]/40 transition-colors shadow-sm"
              value={form.validUntil}
              onChange={(e) => setForm((f) => ({ ...f, validUntil: e.target.value }))}
            />
            <p className="text-meta-muted mt-1">Defaults to 6 months if left blank.</p>
          </div>
          <div>
            <label className="label-caps text-slate-400 mb-1.5 block">Report URL</label>
            <input
              className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-body-primary placeholder:text-slate-400 focus:outline-none focus:border-[#151936]/40 transition-colors shadow-sm"
              placeholder="Link to the delivered report"
              value={form.reportUrl}
              onChange={(e) => setForm((f) => ({ ...f, reportUrl: e.target.value }))}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
          <Button variant="secondary" onClick={onClose} disabled={isCompleting}>Cancel</Button>
          <Button onClick={handleComplete} disabled={isCompleting}>
            {isCompleting ? (
              <><LoadingSpinner size="sm" /><span className="ml-2">Completing…</span></>
            ) : (
              <><IconCheck size={14} /> Complete Valuation</>
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
