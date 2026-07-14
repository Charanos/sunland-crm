"use client";

import { useState } from "react";
import { IconFileText, IconExternalLink } from "@tabler/icons-react";
import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast-provider";
import { formatCompactKES } from "@/lib/utils/format";
import { formatPropertyDate } from "./property-constants";

interface MandateDecisionDrawerProps {
  open: boolean;
  propertyName: string;
  landlordName: string;
  approvalRequestId: string;
  mandateRate: number;
  expectedMonthlyKes: number;
  unitTotal: string;
  submittedBy?: string | null;
  submittedAt?: string | null;
  requiredApproverRole: "gm" | "ceo" | "department_head";
  viewerRole: "gm" | "ceo";
  mandateLetterUrl?: string | null;
  mandateLetterName?: string | null;
  onClose: () => void;
  onDecided: () => void;
}

export function MandateDecisionDrawer({
  open,
  propertyName,
  landlordName,
  approvalRequestId,
  mandateRate,
  expectedMonthlyKes,
  unitTotal,
  submittedBy,
  submittedAt,
  requiredApproverRole,
  viewerRole,
  mandateLetterUrl,
  mandateLetterName,
  onClose,
  onDecided,
}: MandateDecisionDrawerProps) {
  const { pushToast } = useToast();
  const [notes, setNotes] = useState("");
  const [notesErr, setNotesErr] = useState(false);
  const [pending, setPending] = useState<"approve" | "reject" | null>(null);

  const submit = async (status: "approved" | "rejected") => {
    if (pending) return;
    if (status === "rejected" && !notes.trim()) {
      setNotesErr(true);
      return;
    }
    setPending(status === "approved" ? "approve" : "reject");
    try {
      const res = await fetch("/api/finance/approvals/decide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: approvalRequestId, status, decisionNotes: notes.trim() || undefined }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Failed to record the decision");
      pushToast({
        tone: "success",
        title: status === "approved" ? "Mandate activated" : "Mandate rejected",
        body: status === "approved" ? "Collections start against this mandate immediately." : "Returned to draft.",
      });
      setNotes("");
      onDecided();
      onClose();
    } catch (err) {
      pushToast({ tone: "warning", title: "Error", body: err instanceof Error ? err.message : "Could not record the decision." });
    } finally {
      setPending(null);
    }
  };

  const approvalRoute =
    requiredApproverRole === "ceo" && viewerRole === "ceo"
      ? "GM → CEO (you)"
      : requiredApproverRole === "gm"
        ? "GM (pending) → CEO"
        : "GM → CEO";

  return (
    <Drawer open={open} onClose={onClose} title="Review Mandate" width="28rem">
      <div className="flex flex-col gap-5">
        <p className="text-desc-secondary -mt-2">{propertyName} · {landlordName}</p>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-slate-100 bg-slate-50 px-3.5 py-3">
            <p className="label-caps text-slate-400 mb-1">Rate</p>
            <p className="mono-stat text-slate-900 text-lg">{(mandateRate * 100).toFixed(1)}%</p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50 px-3.5 py-3">
            <p className="label-caps text-slate-400 mb-1">Expected / mo</p>
            <p className="mono-stat text-slate-900 text-lg">{formatCompactKES(expectedMonthlyKes)}</p>
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          <FactRow label="Landlord" value={landlordName} />
          {submittedBy && <FactRow label="Submitted by" value={submittedBy} />}
          {submittedAt && <FactRow label="Submitted" value={formatPropertyDate(submittedAt)} mono />}
          <FactRow label="Units under mandate" value={unitTotal} mono />
          <FactRow label="Approval route" value={approvalRoute} />
        </div>

        {mandateLetterUrl ? (
          <a
            href={mandateLetterUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2.5 rounded-xl border border-slate-100 bg-slate-50 px-3.5 py-2.5 text-body-regular text-slate-700 hover:text-[#122a20]"
          >
            <IconFileText size={17} className="shrink-0" aria-hidden="true" />
            <span className="flex-1 truncate">{mandateLetterName ?? "Mandate letter"}</span>
            <IconExternalLink size={13} className="shrink-0" aria-hidden="true" />
          </a>
        ) : (
          <p className="text-body-regular text-slate-400 rounded-xl border border-slate-100 bg-slate-50 px-3.5 py-2.5">
            No mandate letter on file — attach one before or after activation.
          </p>
        )}

        <div>
          <label htmlFor="decision-notes" className="block label-caps text-slate-400 mb-1.5">
            Decision notes{requiredApproverRole && " (required to reject)"}
          </label>
          <textarea
            id="decision-notes"
            rows={3}
            value={notes}
            onChange={(e) => { setNotes(e.target.value); setNotesErr(false); }}
            placeholder="Context for the approval record…"
            className="w-full px-3.5 py-2.5 text-slate-800 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-[#151936]/40 focus:ring-1 focus:ring-[#151936]/10 transition-colors shadow-sm resize-y"
          />
          {notesErr && <p className="body-sm text-rose-600 mt-1.5">Rejection notes are mandatory — they go back to the submitter.</p>}
        </div>

        <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
          <Button className="flex-1 justify-center bg-[#f3df27] text-[#151936] hover:bg-[#e6d220]" onClick={() => submit("approved")} disabled={!!pending}>
            {pending === "approve" ? "Approving…" : "Approve & Activate"}
          </Button>
          <Button variant="secondary" className="flex-1 justify-center text-rose-600 border-rose-200 hover:bg-rose-50" onClick={() => submit("rejected")} disabled={!!pending}>
            {pending === "reject" ? "Rejecting…" : "Reject"}
          </Button>
        </div>
      </div>
    </Drawer>
  );
}

function FactRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-desc-secondary shrink-0">{label}</span>
      <span className={mono ? "mono-data text-slate-700 text-right truncate" : "text-body-regular text-slate-700 text-right truncate"}>{value}</span>
    </div>
  );
}
