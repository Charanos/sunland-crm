"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  IconAlertTriangle,
  IconBuildingCommunity,
  IconCalendarEvent,
  IconCash,
  IconChevronLeft,
  IconChevronRight,
  IconClock,
  IconEdit,
  IconExternalLink,
  IconFileCheck,
  IconHistory,
  IconMail,
  IconMapPin,
  IconPhone,
  IconReceipt,
  IconTrash,
  IconUser,
  IconX,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast-provider";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { formatCompactKES } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { NEXT_STAGE, STATUS_META, TYPE_META, fmtDate } from "./valuation-constants";
import { ValuationFormModal, type ValuationEditTarget } from "./valuation-form-modal";
import { ValuationCompleteModal, type ValuationCompleteTarget } from "./valuation-complete-modal";

interface ValuationDetail {
  id: string;
  entityId: string;
  valuationCode: string;
  propertyId: string | null;
  externalPropertyName: string | null;
  externalLocation: string | null;
  clientContactId: string | null;
  valuerId: string | null;
  type: keyof typeof TYPE_META;
  purpose: string | null;
  status: keyof typeof STATUS_META;
  marketValueKes: string | null;
  forcedSaleValueKes: string | null;
  insuranceValueKes: string | null;
  feeKes: string | null;
  feePaid: boolean;
  siteVisitAt: string | null;
  completedAt: string | null;
  validUntil: string | null;
  reportUrl: string | null;
  notes: string | null;
  createdAt: string;
  propertyName: string | null;
  propertyCode: string | null;
  propertyLocation: string | null;
  clientName: string | null;
  clientEmail: string | null;
  clientPhone: string | null;
  valuerName: string | null;
  valuerEmail: string | null;
}

interface AuditEntry {
  id: string;
  summary: string;
  createdAt: string;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "Just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  return days === 1 ? "Yesterday" : `${days}d ago`;
}

function validityInfo(validUntil: string | null): { label: string; tone: "success" | "warning" | "risk" | "neutral" } {
  if (!validUntil) return { label: "No expiry set", tone: "neutral" };
  const days = Math.ceil((new Date(validUntil).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return { label: `Expired ${Math.abs(days)}d ago`, tone: "risk" };
  if (days <= 30) return { label: `Expires in ${days}d`, tone: "warning" };
  return { label: `Valid for ${days}d`, tone: "success" };
}

export function ValuationFullViewBoard({
  entityId,
  valuationId,
  canManage = true,
}: {
  entityId: string | null;
  valuationId: string;
  canManage?: boolean;
}) {
  const router = useRouter();
  const { pushToast } = useToast();

  const [valuation, setValuation] = useState<ValuationDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshCount, setRefreshCount] = useState(0);

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [completeModalOpen, setCompleteModalOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [activityLog, setActivityLog] = useState<AuditEntry[] | null>(null);
  const [activityLoading, setActivityLoading] = useState(false);

  useEffect(() => {
    let active = true;
    const fetchValuation = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/valuations/${valuationId}?entityId=${entityId || ""}`);
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        const data = await res.json();
        if (!active) return;
        if (data.valuation) {
          setValuation(data.valuation);
        } else {
          setError("This valuation couldn't be found.");
        }
      } catch (err) {
        if (!active) return;
        console.error("Failed to load valuation:", err);
        setError("Couldn't load this valuation. Check your connection and try again.");
      } finally {
        if (active) setIsLoading(false);
      }
    };
    fetchValuation();
    return () => {
      active = false;
    };
  }, [valuationId, entityId, refreshCount]);

  useEffect(() => {
    if (!entityId) return;
    let active = true;
    Promise.resolve().then(() => setActivityLoading(true));
    fetch(`/api/audit?entityId=${entityId}&associatedType=valuation&associatedId=${valuationId}&limit=10`)
      .then((res) => (res.ok ? res.json() : { entries: [] }))
      .then((data) => {
        if (!active) return;
        setActivityLog(Array.isArray(data.entries) ? data.entries : []);
      })
      .catch(() => {
        if (active) setActivityLog([]);
      })
      .finally(() => {
        if (active) setActivityLoading(false);
      });
    return () => {
      active = false;
    };
  }, [entityId, valuationId, refreshCount]);

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error && !valuation) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
        <IconAlertTriangle size={32} className="text-rose-400" aria-hidden="true" />
        <p className="text-title-primary">{error}</p>
        <Button variant="secondary" onClick={() => setRefreshCount((c) => c + 1)}>
          Retry
        </Button>
      </div>
    );
  }

  if (!valuation) {
    return <div className="p-8 text-center text-desc-secondary">Valuation not found.</div>;
  }

  const status = STATUS_META[valuation.status];
  const nextStage = NEXT_STAGE[valuation.status];
  const isPortfolio = !!valuation.propertyId;
  const subjectName = isPortfolio ? valuation.propertyName ?? "Portfolio property" : valuation.externalPropertyName ?? "Unknown subject";
  const subjectLocation = isPortfolio ? valuation.propertyLocation ?? "—" : valuation.externalLocation ?? "—";
  const validity = validityInfo(valuation.validUntil);

  const patchValuation = async (patch: Record<string, unknown>, successBody: string) => {
    try {
      const res = await fetch(`/api/valuations/${valuation.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityId, ...patch }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update valuation");
      pushToast({ tone: "success", title: "Valuation Updated", body: successBody });
      setRefreshCount((c) => c + 1);
    } catch (err) {
      pushToast({ tone: "warning", title: "Error", body: err instanceof Error ? err.message : "Failed to update valuation" });
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/valuations/${valuation.id}?entityId=${entityId || ""}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Failed to delete");
      }
      pushToast({ tone: "success", title: "Deleted", body: "Valuation instruction removed." });
      router.push("/admin/valuations");
    } catch (e: unknown) {
      pushToast({ tone: "warning", title: "Error", body: e instanceof Error ? e.message : "Failed to delete" });
      setIsDeleting(false);
      setDeleteConfirmOpen(false);
    }
  };

  const editTarget: ValuationEditTarget = {
    id: valuation.id,
    valuationCode: valuation.valuationCode,
    propertyId: valuation.propertyId,
    externalPropertyName: valuation.externalPropertyName,
    externalLocation: valuation.externalLocation,
    clientContactId: valuation.clientContactId,
    valuerId: valuation.valuerId,
    type: valuation.type,
    purpose: valuation.purpose,
    feeKes: valuation.feeKes,
    siteVisitAt: valuation.siteVisitAt,
    notes: valuation.notes,
  };

  const completeTarget: ValuationCompleteTarget = {
    id: valuation.id,
    valuationCode: valuation.valuationCode,
    marketValueKes: valuation.marketValueKes,
    forcedSaleValueKes: valuation.forcedSaleValueKes,
    insuranceValueKes: valuation.insuranceValueKes,
    validUntil: valuation.validUntil,
    reportUrl: valuation.reportUrl,
  };

  return (
    <div className="mx-auto flex max-w-[98rem] flex-col gap-6 pb-12">
      {/* ── Breadcrumb ── */}
      <div className="flex items-center gap-2">
        <Link href="/admin/valuations" className="text-slate-400 hover:text-slate-600 transition-colors" aria-label="Back to Valuations">
          <IconChevronLeft size={20} stroke={2} />
        </Link>
        <Link href="/" className="text-desc-secondary hover:text-slate-800">
          Dashboard
        </Link>
        <span className="text-slate-300">/</span>
        <Link href="/admin/valuations" className="text-desc-secondary hover:text-slate-800">
          Valuations
        </Link>
        <span className="text-slate-300">/</span>
        <span className="text-meta-muted-strong mono-data">{valuation.valuationCode}</span>
      </div>

      {/* ── Hero ── */}
      <div className="bg-tertiary-gradient text-white rounded-[24px] shadow-2xl relative overflow-hidden group border border-[#151936] p-8 lg:p-10">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-transparent to-transparent pointer-events-none" />
        <div className="absolute right-0 bottom-0 size-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-end justify-between gap-8">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3 flex-wrap">
              <span className={cn(
                "inline-flex items-center gap-2 rounded-full border px-4 py-1 text-xs uppercase tracking-wider",
                status.tone === "success" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                  : status.tone === "risk" ? "border-rose-500/30 bg-rose-500/10 text-rose-400"
                  : status.tone === "warning" ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                  : "border-white/10 bg-white/5 text-slate-300",
              )}>
                {status.label}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1 text-xs uppercase tracking-wider text-slate-300 backdrop-blur-sm">
                {TYPE_META[valuation.type]}
              </span>
              {!isPortfolio && (
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1 text-xs uppercase tracking-wider text-slate-300 backdrop-blur-sm">
                  External Subject
                </span>
              )}
            </div>

            <h1 className="text-4xl lg:text-5xl font-serif tracking-tight text-white drop-shadow-sm">{subjectName}</h1>

            <div className="flex items-center gap-3 text-slate-400">
              <span className="flex items-center gap-1.5 font-medium"><IconMapPin size={16} /> {subjectLocation}</span>
              <span className="text-slate-600">|</span>
              <span className="font-mono text-slate-300 bg-white/5 px-2 py-0.5 rounded text-sm">{valuation.valuationCode}</span>
            </div>
          </div>

          {canManage && (
            <div className="flex items-center gap-2 flex-wrap shrink-0">
              {nextStage && (
                <button
                  type="button"
                  onClick={() => patchValuation({ status: nextStage.status }, `${valuation.valuationCode} → ${STATUS_META[nextStage.status].label}.`)}
                  className="inline-flex items-center gap-2 px-5 py-1.5 text-sm rounded-xl bg-white/5 border border-white/10 text-slate-200 hover:bg-white/10 hover:border-white/20 transition-all font-medium shadow-sm backdrop-blur-sm"
                >
                  <IconChevronRight size={14} /> {nextStage.label}
                </button>
              )}
              {(valuation.status === "report_draft" || valuation.status === "in_progress") && (
                <button
                  type="button"
                  onClick={() => setCompleteModalOpen(true)}
                  className="inline-flex items-center gap-2 px-5 py-1.5 text-sm rounded-xl bg-white/5 border border-white/10 text-slate-200 hover:bg-white/10 hover:border-white/20 transition-all font-medium shadow-sm backdrop-blur-sm"
                >
                  <IconFileCheck size={14} /> Complete
                </button>
              )}
              {valuation.feeKes && (
                <button
                  type="button"
                  onClick={() => patchValuation({ feePaid: !valuation.feePaid }, valuation.feePaid ? "Fee marked outstanding." : "Fee marked collected.")}
                  className="inline-flex items-center gap-2 px-5 py-1.5 text-sm rounded-xl bg-white/5 border border-white/10 text-slate-200 hover:bg-white/10 hover:border-white/20 transition-all font-medium shadow-sm backdrop-blur-sm"
                >
                  <IconReceipt size={14} /> {valuation.feePaid ? "Mark Outstanding" : "Mark Collected"}
                </button>
              )}
              {valuation.status !== "completed" && valuation.status !== "cancelled" && (
                <button
                  type="button"
                  onClick={() => patchValuation({ status: "cancelled" }, `${valuation.valuationCode} cancelled.`)}
                  className="inline-flex items-center gap-2 px-5 py-1.5 text-sm rounded-xl bg-white/5 border border-white/10 text-slate-200 hover:bg-white/10 hover:border-white/20 transition-all font-medium shadow-sm backdrop-blur-sm"
                >
                  <IconX size={14} /> Cancel
                </button>
              )}
              <button
                type="button"
                onClick={() => setEditModalOpen(true)}
                className="inline-flex items-center gap-2 px-5 py-1.5 text-sm rounded-xl bg-white/5 border border-white/10 text-slate-200 hover:bg-white/10 hover:border-white/20 transition-all font-medium shadow-sm backdrop-blur-sm"
              >
                <IconEdit size={14} /> Edit
              </button>
              <button
                type="button"
                onClick={() => setDeleteConfirmOpen(true)}
                className="inline-flex items-center gap-2 px-5 py-1.5 text-sm rounded-xl bg-white/5 border border-white/10 text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/30 hover:text-rose-300 transition-all font-medium shadow-sm backdrop-blur-sm"
              >
                <IconTrash size={14} /> Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Main: values + fee + main content, context rail ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 flex flex-col gap-6">
          <Card className="bg-white border border-slate-100 rounded-[24px] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
            <h3 className="text-lg font-serif text-slate-900 mb-5">Appraised Values</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="flex flex-col gap-2 p-6 rounded-2xl bg-slate-50 border border-slate-100">
                <p className="label-caps text-slate-400">Open Market Value</p>
                <p className="mono-amount text-3xl text-slate-900 tracking-tight">
                  {valuation.marketValueKes ? formatCompactKES(parseFloat(valuation.marketValueKes)) : "—"}
                </p>
              </div>
              <div className="flex flex-col gap-2 p-6 rounded-2xl bg-slate-50 border border-slate-100">
                <p className="label-caps text-slate-400">Forced Sale Value</p>
                <p className="mono-amount text-3xl text-slate-900 tracking-tight">
                  {valuation.forcedSaleValueKes ? formatCompactKES(parseFloat(valuation.forcedSaleValueKes)) : "—"}
                </p>
              </div>
              <div className="flex flex-col gap-2 p-6 rounded-2xl bg-slate-50 border border-slate-100">
                <p className="label-caps text-slate-400">Insurance Value</p>
                <p className="mono-amount text-3xl text-slate-900 tracking-tight">
                  {valuation.insuranceValueKes ? formatCompactKES(parseFloat(valuation.insuranceValueKes)) : "—"}
                </p>
              </div>
            </div>
            {valuation.purpose && (
              <div className="mt-6 pt-6 border-t border-slate-100">
                <p className="label-caps text-slate-400 mb-1.5">Purpose</p>
                <p className="text-body-regular text-slate-700">{valuation.purpose}</p>
              </div>
            )}
            {valuation.notes && (
              <div className="mt-4">
                <p className="label-caps text-slate-400 mb-1.5">Notes</p>
                <p className="text-body-regular text-slate-600 whitespace-pre-line">{valuation.notes}</p>
              </div>
            )}
          </Card>

          <Card className="bg-white border border-slate-100 rounded-[24px] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-serif text-slate-900">Fee &amp; Validity</h3>
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 label-caps",
                  validity.tone === "success" ? "bg-emerald-500/15 text-emerald-700 border-emerald-300/60"
                    : validity.tone === "warning" ? "bg-amber-500/15 text-amber-700 border-amber-300/60"
                    : validity.tone === "risk" ? "bg-rose-500/15 text-rose-700 border-rose-300/60"
                    : "bg-slate-100 text-slate-600 border-slate-200",
                )}
              >
                <IconClock size={12} /> {validity.label}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-5 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="size-11 rounded-xl bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-500 shrink-0">
                  <IconCash size={20} stroke={1.5} />
                </div>
                <div>
                  <p className="mono-amount text-slate-900 text-lg">{valuation.feeKes ? formatCompactKES(parseFloat(valuation.feeKes)) : "—"}</p>
                  <p className="label-caps text-slate-400 mt-0.5">
                    Professional Fee {valuation.feeKes && (valuation.feePaid ? "· Collected" : "· Outstanding")}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-5 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="size-11 rounded-xl bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-500 shrink-0">
                  <IconCalendarEvent size={20} stroke={1.5} />
                </div>
                <div>
                  <p className="mono-data text-slate-900">{fmtDate(valuation.siteVisitAt)}</p>
                  <p className="label-caps text-slate-400 mt-0.5">Site Visit</p>
                </div>
              </div>
            </div>
            {valuation.reportUrl && (
              <a
                href={valuation.reportUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-6 inline-flex items-center gap-1.5 text-body-regular text-[#122a20] hover:underline"
              >
                <IconExternalLink size={14} /> View delivered report
              </a>
            )}
          </Card>

          <Card className="bg-white border border-slate-100 rounded-[24px] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-serif text-slate-900">Workflow Timeline</h3>
              <div className="size-10 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400">
                <IconHistory size={20} stroke={1.5} />
              </div>
            </div>
            {activityLoading ? (
              <div className="flex justify-center py-12">
                <LoadingSpinner size="md" />
              </div>
            ) : !activityLog || activityLog.length === 0 ? (
              <p className="text-slate-500 text-center py-12 text-sm bg-slate-50 rounded-2xl border border-slate-100 border-dashed">No recorded activity yet.</p>
            ) : (
              <div className="space-y-0 pl-2">
                {activityLog.map((entry, i) => (
                  <div key={entry.id} className="flex gap-4 relative py-4">
                    {i < activityLog.length - 1 && (
                      <div className="absolute left-[9px] top-[36px] bottom-0 w-0.5 bg-slate-100 rounded-full" />
                    )}
                    <div className="size-[20px] rounded-full border-[3px] border-slate-200 bg-white shrink-0 mt-0.5 z-10 shadow-sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 leading-snug">{entry.summary}</p>
                      <p className="text-xs uppercase tracking-wider text-slate-400 mt-1.5 flex items-center gap-1.5">
                        <IconClock size={14} stroke={2} />
                        {relativeTime(entry.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Context rail */}
        <div className="flex flex-col gap-6">
          <Card className="bg-white border border-slate-100 rounded-[24px] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
            <h3 className="label-caps text-slate-400 mb-4 flex items-center gap-2">
              <IconUser size={14} /> Client
            </h3>
            {valuation.clientName ? (
              <div className="flex flex-col gap-2">
                <p className="text-body-primary text-slate-900">{valuation.clientName}</p>
                {valuation.clientPhone && (
                  <a href={`tel:${valuation.clientPhone}`} className="text-body-regular text-slate-500 hover:text-[#122a20] flex items-center gap-2 transition-colors">
                    <IconPhone size={14} className="shrink-0" /> {valuation.clientPhone}
                  </a>
                )}
                {valuation.clientEmail && (
                  <a href={`mailto:${valuation.clientEmail}`} className="text-body-regular text-slate-500 hover:text-[#122a20] flex items-center gap-2 transition-colors">
                    <IconMail size={14} className="shrink-0" /> {valuation.clientEmail}
                  </a>
                )}
              </div>
            ) : (
              <p className="text-desc-secondary">No client on record.</p>
            )}
          </Card>

          <Card className="bg-white border border-slate-100 rounded-[24px] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
            <h3 className="label-caps text-slate-400 mb-4 flex items-center gap-2">
              <IconUser size={14} /> Assigned Valuer
            </h3>
            {valuation.valuerName ? (
              <div className="flex flex-col gap-2">
                <p className="text-body-primary text-slate-900">{valuation.valuerName}</p>
                {valuation.valuerEmail && (
                  <a href={`mailto:${valuation.valuerEmail}`} className="text-body-regular text-slate-500 hover:text-[#122a20] flex items-center gap-2 transition-colors">
                    <IconMail size={14} className="shrink-0" /> {valuation.valuerEmail}
                  </a>
                )}
              </div>
            ) : (
              <p className="text-desc-secondary">Unassigned.</p>
            )}
          </Card>

          {isPortfolio && valuation.propertyId && (
            <Card className="bg-white border border-slate-100 rounded-[24px] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
              <h3 className="label-caps text-slate-400 mb-4 flex items-center gap-2">
                <IconBuildingCommunity size={14} /> Portfolio Property
              </h3>
              <p className="text-body-primary text-slate-900 mb-1">{valuation.propertyName}</p>
              <p className="mono-data text-xs text-slate-500 mb-4">{valuation.propertyCode}</p>
              <Link
                href={`/admin/properties/${valuation.propertyId}`}
                className="text-sm text-[#151936] flex items-center justify-center gap-2 bg-slate-50 border border-slate-100 rounded-xl py-3 transition-colors hover:bg-slate-100"
              >
                <IconBuildingCommunity size={16} /> Go to Property Profile
              </Link>
            </Card>
          )}
        </div>
      </div>

      <ValuationFormModal
        open={editModalOpen}
        entityId={entityId}
        mode="edit"
        valuation={editTarget}
        onClose={() => setEditModalOpen(false)}
        onSubmit={() => setRefreshCount((c) => c + 1)}
      />

      <ValuationCompleteModal
        open={completeModalOpen}
        entityId={entityId}
        valuation={completeTarget}
        onClose={() => setCompleteModalOpen(false)}
        onCompleted={() => setRefreshCount((c) => c + 1)}
      />

      <ConfirmDialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleDelete}
        title="Delete Valuation"
        description="This permanently removes the valuation instruction and its recorded values. The deletion itself stays on the audit trail."
        confirmLabel="Delete Valuation"
        tone="danger"
        isLoading={isDeleting}
      />
    </div>
  );
}
