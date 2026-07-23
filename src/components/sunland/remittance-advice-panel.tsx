"use client";

import { useState } from "react";
import {
  IconCash,
  IconCheck,
  IconCopy,
  IconFlag,
  IconShare,
} from "@tabler/icons-react";
import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/erp-primitives";
import { QRCodeSVG } from "qrcode.react";
import { useToast } from "@/components/ui/toast-provider";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { formatCompactKES } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

export interface RemittanceAdvice {
  id: string;
  periodStart: string;
  periodEnd: string;
  collectedKes: string;
  managementFeeKes: string;
  expensesKes: string;
  netRemittanceKes: string;
  status: "pending" | "released" | "flagged";
  verificationToken: string;
  createdAt: string;
  releasedAt: string | null;
  flagReason: string | null;
}

const STATUS_TONE: Record<RemittanceAdvice["status"], "warning" | "success" | "risk"> = {
  pending: "warning",
  released: "success",
  flagged: "risk",
};

function RemittanceRow({ dotClass, label, value, bold }: { dotClass: string; label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-slate-50 last:border-b-0">
      <span className="flex items-center gap-2 text-body-regular text-slate-600">
        <span className={cn("size-2.5 rounded-sm shrink-0", dotClass)} aria-hidden="true" />
        {label}
      </span>
      <span className={cn("mono-amount", bold ? "font-medium text-base text-slate-900" : "text-slate-900")}>{value}</span>
    </div>
  );
}

export function RemittanceAdvicePanel({
  open,
  remittance,
  landlordName,
  propertyName,
  onClose,
  onDecided,
}: {
  open: boolean;
  remittance: RemittanceAdvice | null;
  landlordName: string;
  propertyName: string;
  onClose: () => void;
  onDecided: () => void;
}) {
  const { pushToast } = useToast();
  const [flagging, setFlagging] = useState(false);
  const [flagReason, setFlagReason] = useState("");
  const [flagReasonErr, setFlagReasonErr] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  if (!remittance) {
    return (
      <Drawer open={open} onClose={onClose} title="Remittance Advice">
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
          <LoadingSpinner size="lg" className="text-[#151936]" />
          <p className="text-sm font-medium text-slate-700">Loading remittance advice…</p>
        </div>
      </Drawer>
    );
  }

  const formatDate = (d: string) => new Date(d).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" });
  const verifyUrl = typeof window !== "undefined" ? `${window.location.origin}/fin/reports/verify/${remittance.verificationToken}` : "";

  const decide = async (action: "release" | "flag") => {
    if (action === "flag" && !flagReason.trim()) {
      setFlagReasonErr(true);
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/remittances/${remittance.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason: action === "flag" ? flagReason.trim() : undefined }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? `Failed to ${action} remittance`);
      pushToast({
        tone: "success",
        title: action === "release" ? "Payment released" : "Remittance flagged",
        body: action === "release" ? `${formatCompactKES(Number(remittance.netRemittanceKes))} released to ${landlordName}.` : "Release is blocked until this is resolved.",
      });
      setFlagging(false);
      setFlagReason("");
      onDecided();
      onClose();
    } catch (err) {
      pushToast({ tone: "warning", title: "Error", body: err instanceof Error ? err.message : `Could not ${action} remittance.` });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(verifyUrl);
      pushToast({ tone: "success", title: "Verification link copied" });
    } catch {
      pushToast({ tone: "warning", title: "Could not copy link" });
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: `Remittance Advice — ${propertyName}`, url: verifyUrl });
      } catch {
        // user cancelled - not an error
      }
    } else {
      handleCopy();
    }
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Remittance Advice"
      footer={
        remittance.status === "pending" ? (
          flagging ? (
            <div className="flex w-full flex-col gap-3">
              <div>
                <label className="font-mono text-xxs uppercase tracking-wider text-slate-400 mb-1.5 block">Reason — required</label>
                <textarea
                  rows={2}
                  value={flagReason}
                  onChange={(e) => { setFlagReason(e.target.value); setFlagReasonErr(false); }}
                  placeholder="What's wrong with this remittance?"
                  className="w-full px-3.5 py-2.5 text-xs text-slate-800 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-[#151936]/40 transition-colors shadow-2xs resize-y"
                />
                {flagReasonErr && <p className="text-xs text-rose-600 mt-1.5">A reason is required to flag this remittance.</p>}
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={() => { setFlagging(false); setFlagReason(""); setFlagReasonErr(false); }} disabled={submitting}>
                  Cancel
                </Button>
                <Button variant="danger" onClick={() => decide("flag")} disabled={submitting}>
                  {submitting ? "Flagging…" : "Confirm Flag"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex w-full items-center justify-end gap-2">
              <Button variant="secondary" onClick={() => setFlagging(true)} disabled={submitting}>
                <IconFlag size={14} /> Flag Issue
              </Button>
              <Button onClick={() => decide("release")} disabled={submitting} className="bg-[#151936] text-white hover:bg-slate-800">
                <IconCheck size={14} /> {submitting ? "Releasing…" : "Release Payment"}
              </Button>
            </div>
          )
        ) : undefined
      }
    >
      <div className="flex flex-col gap-5">
        {/* Stakeholder Identity Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <p className="text-base font-medium text-[#151936]">{landlordName}</p>
            <p className="text-xs text-slate-500 font-medium mt-0.5">{propertyName}</p>
          </div>
          <Badge tone={STATUS_TONE[remittance.status]}>
            {remittance.status === "pending" ? "Pending Release" : remittance.status === "released" ? "Released" : "Flagged"}
          </Badge>
        </div>

        {/* Financial Statement Breakdown Card */}
        <div className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-5 shadow-2xs flex flex-col gap-3">
          <p className="font-mono text-xxs font-medium text-slate-400 uppercase tracking-wider">
            Period: {formatDate(remittance.periodStart)} – {formatDate(remittance.periodEnd)}
          </p>
          <div className="flex flex-col">
            <RemittanceRow dotClass="bg-slate-300" label="Rent collected" value={formatCompactKES(Number(remittance.collectedKes))} />
            <RemittanceRow dotClass="bg-[#f3df27]" label="Less management fee" value={`− ${formatCompactKES(Number(remittance.managementFeeKes))}`} />
            <RemittanceRow dotClass="bg-slate-400" label="Less approved expenses" value={`− ${formatCompactKES(Number(remittance.expensesKes))}`} />
            <RemittanceRow dotClass="bg-[#151936]" label="Net remittance due" value={formatCompactKES(Number(remittance.netRemittanceKes))} bold />
          </div>
          {remittance.status === "released" && remittance.releasedAt && (
            <p className="text-xs text-emerald-700 font-medium mt-2 bg-emerald-50 border border-emerald-200/60 rounded-xl p-2.5">
              Released {formatDate(remittance.releasedAt)}.
            </p>
          )}
          {remittance.status === "flagged" && remittance.flagReason && (
            <p className="text-xs text-rose-700 font-medium mt-2 bg-rose-50 border border-rose-200/60 rounded-xl p-2.5">
              Flagged: {remittance.flagReason}
            </p>
          )}
        </div>

        {/* Cryptographic QR Proof Deck */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs flex flex-col gap-4">
          <div className="flex items-start gap-4">
            <div className="p-2 rounded-xl bg-white border border-slate-200 shadow-2xs shrink-0">
              <QRCodeSVG
                value={verifyUrl}
                size={96}
                bgColor="#ffffff"
                fgColor="#151936"
                level="H"
                marginSize={1}
              />
            </div>
            <div className="flex flex-col gap-1 min-w-0 flex-1">
              <span className="font-mono text-xxs uppercase tracking-wider text-slate-400 font-medium">Cryptographic Audit Token</span>
              <span className="font-mono text-xs font-medium text-[#151936] bg-slate-100 border border-slate-200/80 px-2.5 py-1 rounded-lg w-fit truncate">
                {remittance.verificationToken.slice(0, 12).toUpperCase()}
              </span>
              <p className="text-xs text-slate-500 leading-relaxed mt-1">
                Scan QR code or click below to verify cryptographic proof against Sunland central ledger.
              </p>
            </div>
          </div>

          {/* Unified Action Buttons */}
          <div className="flex items-center gap-2 pt-3 border-t border-slate-100 flex-wrap">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 rounded-xl bg-white border border-slate-200/80 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
            >
              <IconCopy size={14} /> Copy Link
            </button>
            <button
              type="button"
              onClick={handleShare}
              className="inline-flex items-center gap-1.5 rounded-xl bg-white border border-slate-200/80 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
            >
              <IconShare size={14} /> Share
            </button>
            <a
              href={verifyUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 border border-slate-200/80 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200 transition-colors shadow-2xs ml-auto"
            >
              Verify Online <IconCash size={14} />
            </a>
          </div>
        </div>
      </div>
    </Drawer>
  );
}
