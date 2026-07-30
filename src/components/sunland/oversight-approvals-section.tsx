"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  IconAlertTriangle,
  IconArrowForwardUp,
  IconCheck,
  IconChecks,
  IconChevronDown,
  IconChevronUp,
  IconCircleCheck,
  IconClock,
  IconGavel,
  IconLink,
  IconX,
} from "@tabler/icons-react";
import { Button, ConfirmDialog, Modal, SkeletonBlock } from "@/components/ui/erp-primitives";
import { useToast } from "@/components/ui/toast-provider";
import { cn } from "@/lib/utils/cn";
import { formatCompactKES } from "@/lib/utils/format";
import {
  APPROVAL_STATUS_META,
  APPROVER_ROLE_LABEL,
  approvalRecordHref,
  type ApprovalStatus,
} from "./oversight-constants";
import type { OversightPulse } from "./oversight-board";

interface ApprovalRow {
  id: string;
  entityId: string;
  requestType: string;
  relatedTable: string;
  relatedId: string;
  requestedById: string;
  requestedByName: string;
  requestedAt: string;
  amountKes: string | null;
  requiredApproverRole: string;
  status: ApprovalStatus;
  decisionNotes: string | null;
}

type Filter = "pending" | "gm" | "ceo" | "decided" | "all";

function ageLabel(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days < 1) return "today";
  return days === 1 ? "1 day" : `${days} days`;
}

export function ApprovalsSection({
  entityId,
  pulse,
  onChanged,
}: {
  entityId: string;
  pulse: OversightPulse | null;
  onChanged: () => void;
}) {
  const { pushToast } = useToast();
  const [rows, setRows] = useState<ApprovalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("pending");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmBulk, setConfirmBulk] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<ApprovalRow | null>(null);
  const [delegateTarget, setDelegateTarget] = useState<ApprovalRow | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/finance/approvals?entityId=${entityId}`)
      .then((r) => r.json())
      .then((d) => setRows(Array.isArray(d.approvals) ? d.approvals : Array.isArray(d) ? d : []))
      .catch(() => pushToast({ tone: "error", title: "Couldn't load approvals", body: "Try again." }))
      .finally(() => setLoading(false));
  }, [entityId, pushToast]);

  useEffect(() => {
    Promise.resolve().then(load);
  }, [load]);

  const threshold = pulse?.approvals.thresholdKes ?? 150_000;

  const filtered = useMemo(() => {
    switch (filter) {
      case "pending": return rows.filter((r) => r.status === "pending");
      case "gm": return rows.filter((r) => r.status === "pending" && r.requiredApproverRole === "gm");
      case "ceo": return rows.filter((r) => r.status === "pending" && r.requiredApproverRole === "ceo");
      case "decided": return rows.filter((r) => r.status === "approved" || r.status === "rejected");
      default: return rows;
    }
  }, [rows, filter]);

  const counts = useMemo(() => ({
    pending: rows.filter((r) => r.status === "pending").length,
    gm: rows.filter((r) => r.status === "pending" && r.requiredApproverRole === "gm").length,
    ceo: rows.filter((r) => r.status === "pending" && r.requiredApproverRole === "ceo").length,
    decided: rows.filter((r) => r.status === "approved" || r.status === "rejected").length,
    all: rows.length,
  }), [rows]);

  const selectable = filtered.filter((r) => r.status === "pending");
  const allSelected = selectable.length > 0 && selectable.every((r) => selected.has(r.id));

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(selectable.map((r) => r.id)));
  };

  const decide = async (row: ApprovalRow, status: "approved" | "rejected", notes?: string) => {
    setBusy(true);
    try {
      const res = await fetch("/api/finance/approvals/decide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: row.id, status, decisionNotes: notes }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Decision failed");
      pushToast({
        tone: status === "approved" ? "success" : "info",
        title: status === "approved" ? "Approved" : "Rejected",
        body: `${row.requestType.replace(/_/g, " ")} · ${row.requestedByName}`,
      });
      load();
      onChanged();
    } catch (err) {
      pushToast({ tone: "error", title: "Couldn't record decision", body: err instanceof Error ? err.message : "Try again." });
    } finally {
      setBusy(false);
    }
  };

  /** Bulk approve reports per-item outcomes rather than claiming a clean sweep. */
  const bulkApprove = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/finance/approvals/bulk-decide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityId, requestIds: Array.from(selected), status: "approved" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Bulk approval failed");

      const ok = data.succeeded?.length ?? 0;
      const bad = data.failed?.length ?? 0;
      pushToast({
        tone: bad > 0 ? "warning" : "success",
        title: bad > 0 ? `${ok} approved, ${bad} could not be` : `${ok} approved`,
        body: bad > 0 ? (data.failed[0]?.reason ?? "Some items were already decided.") : "The queue has been updated.",
      });
      setSelected(new Set());
      load();
      onChanged();
    } catch (err) {
      pushToast({ tone: "error", title: "Bulk approval failed", body: err instanceof Error ? err.message : "Try again." });
    } finally {
      setBusy(false);
      setConfirmBulk(false);
    }
  };

  return (
    <div className="flex flex-col gap-3.5">
      {/* Threshold banner - the figure is the real settings-backed value */}
      <div className="flex items-center gap-3 flex-wrap bg-white border border-slate-100 border-l-[3px] border-l-[#f3df27] rounded-2xl px-4 py-3.5 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
        <span className="size-9 rounded-xl bg-[rgba(243,223,39,0.18)] text-[#151936] flex items-center justify-center shrink-0">
          <IconGavel size={19} />
        </span>
        <div className="flex-1 min-w-[200px]">
          <p className="text-sm font-medium text-slate-900">
            CEO approval threshold · <span className="font-mono font-medium">{formatCompactKES(threshold)}</span>
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            Anything above this needs your personal sign-off.{" "}
            {(pulse?.approvals.aboveThreshold ?? 0) > 0
              ? `${pulse?.approvals.aboveThreshold} item(s) in the queue exceed it.`
              : "Nothing in the queue exceeds it right now."}
          </p>
        </div>
        <Link
          href="/admin/system?section=policies"
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors shrink-0"
        >
          Adjust in Policies
        </Link>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2.5 flex-wrap">
        <div className="flex gap-1.5 flex-wrap">
          {([
            ["pending", "Pending", counts.pending],
            ["gm", "GM tier", counts.gm],
            ["ceo", "CEO tier", counts.ceo],
            ["decided", "Decided", counts.decided],
            ["all", "All", counts.all],
          ] as Array<[Filter, string, number]>).map(([key, label, count]) => (
            <button
              key={key}
              onClick={() => { setFilter(key); setSelected(new Set()); }}
              aria-pressed={filter === key}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                filter === key ? "bg-[#151936] text-white border-[#151936]" : "bg-white text-slate-500 border-slate-200 hover:border-slate-300",
              )}
            >
              {label}
              <span className={cn(
                "font-mono text-xxs rounded-full px-1.5",
                filter === key ? "bg-[#f3df27] text-[#151936]" : "bg-slate-100 text-slate-500",
              )}>{count}</span>
            </button>
          ))}
        </div>

        {selectable.length > 0 && (
          <div className="ml-auto flex items-center gap-2.5">
            <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-600 cursor-pointer">
              <input type="checkbox" checked={allSelected} onChange={toggleAll} className="size-4 rounded accent-[#151936]" />
              Select all
            </label>
            <Button size="sm" onClick={() => setConfirmBulk(true)} disabled={selected.size === 0 || busy}>
              <IconChecks size={14} /> Approve
              {selected.size > 0 && (
                <span className="ml-1 font-mono text-xxs bg-white/20 rounded-full px-1.5">{selected.size}</span>
              )}
            </Button>
          </div>
        )}
      </div>

      {/* Queue */}
      {loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonBlock key={i} className="h-24 w-full rounded-2xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2.5 py-14 text-center bg-white border border-slate-100 rounded-3xl">
          <IconCircleCheck size={30} className="text-emerald-400" />
          <p className="text-base font-medium text-slate-800">Queue clear</p>
          <p className="text-sm text-slate-400">No approvals match this filter. Nicely done.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {filtered.map((row) => {
            const meta = APPROVAL_STATUS_META[row.status] ?? APPROVAL_STATUS_META.pending;
            const amount = Number(row.amountKes ?? 0);
            const over = amount > threshold;
            const href = approvalRecordHref(row.relatedTable, row.relatedId);
            const isOpen = expanded === row.id;
            const isPending = row.status === "pending";

            return (
              <div key={row.id} className="bg-white border border-slate-100 rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.04)] overflow-hidden">
                <div className="flex items-start gap-3 p-4">
                  {isPending && (
                    <input
                      type="checkbox"
                      checked={selected.has(row.id)}
                      onChange={() => setSelected((prev) => {
                        const next = new Set(prev);
                        if (next.has(row.id)) next.delete(row.id); else next.add(row.id);
                        return next;
                      })}
                      aria-label={`Select ${row.requestType}`}
                      className="size-4 rounded accent-[#151936] mt-1 shrink-0"
                    />
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xxs text-slate-400">{row.id.slice(0, 8).toUpperCase()}</span>
                      <span className="text-xs text-slate-500 capitalize">{row.requestType.replace(/_/g, " ")}</span>
                      <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xxs font-medium", meta.pill)}>
                        <span className={cn("size-1.5 rounded-full", meta.dot)} />
                        {meta.label}
                      </span>
                      {over && isPending && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xxs font-medium uppercase tracking-wide text-amber-700">
                          <IconAlertTriangle size={9} /> Over threshold
                        </span>
                      )}
                    </div>

                    <p className="text-sm font-medium text-slate-900 mt-1.5 capitalize">
                      {row.requestType.replace(/_/g, " ")} · {APPROVER_ROLE_LABEL[row.requiredApproverRole] ?? row.requiredApproverRole}
                    </p>

                    <div className="flex items-center gap-3 mt-1.5 flex-wrap text-xs text-slate-400">
                      <span>Requested by <span className="text-slate-600">{row.requestedByName}</span></span>
                      <span className="inline-flex items-center gap-1"><IconClock size={12} /> {ageLabel(row.requestedAt)}</span>
                      {href && (
                        <Link href={href} className="inline-flex items-center gap-1 text-[#122a20] hover:underline">
                          <IconLink size={12} /> Open record
                        </Link>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="font-mono font-medium text-base text-slate-900">
                      {amount > 0 ? formatCompactKES(amount) : "—"}
                    </span>
                    <button
                      onClick={() => setExpanded(isOpen ? null : row.id)}
                      aria-expanded={isOpen}
                      className="text-slate-400 hover:text-slate-700"
                      aria-label="Toggle detail"
                    >
                      {isOpen ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
                    </button>
                  </div>
                </div>

                {isOpen && (
                  <div className="px-4 pb-3 -mt-1">
                    <div className="rounded-xl bg-[#fafbf8] border border-slate-100 px-3.5 py-3 text-xs text-slate-600 flex flex-col gap-1">
                      <p><span className="text-slate-400">Related record:</span> {row.relatedTable.replace(/_/g, " ")} · <span className="font-mono">{row.relatedId.slice(0, 8)}</span></p>
                      <p><span className="text-slate-400">Requested:</span> {new Date(row.requestedAt).toLocaleString("en-KE")}</p>
                      {row.decisionNotes && <p><span className="text-slate-400">Notes:</span> {row.decisionNotes}</p>}
                    </div>
                  </div>
                )}

                {isPending && (
                  <div className="flex items-center justify-end gap-2 border-t border-slate-50 px-4 py-2.5">
                    <button
                      onClick={() => setDelegateTarget(row)}
                      disabled={busy}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                    >
                      <IconArrowForwardUp size={14} /> Delegate
                    </button>
                    <button
                      onClick={() => setRejectTarget(row)}
                      disabled={busy}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                    >
                      <IconX size={14} /> Reject
                    </button>
                    <button
                      onClick={() => decide(row, "approved")}
                      disabled={busy}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#151936] px-3.5 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
                    >
                      <IconCheck size={14} /> Approve
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={confirmBulk}
        onClose={() => setConfirmBulk(false)}
        onConfirm={bulkApprove}
        title={`Approve ${selected.size} request${selected.size === 1 ? "" : "s"}?`}
        description="Each one is decided individually, so every downstream effect — mandate activation, maintenance cost release — still fires. Anything already decided by someone else is reported back rather than silently skipped."
        confirmLabel="Approve all selected"
        tone="info"
      />

      {rejectTarget && (
        <RejectModal
          row={rejectTarget}
          busy={busy}
          onClose={() => setRejectTarget(null)}
          onSubmit={(notes) => { decide(rejectTarget, "rejected", notes); setRejectTarget(null); }}
        />
      )}

      {delegateTarget && (
        <DelegateModal
          row={delegateTarget}
          entityId={entityId}
          onClose={() => setDelegateTarget(null)}
          onDone={() => { setDelegateTarget(null); load(); onChanged(); }}
        />
      )}
    </div>
  );
}

function RejectModal({
  row, busy, onClose, onSubmit,
}: {
  row: ApprovalRow;
  busy: boolean;
  onClose: () => void;
  onSubmit: (notes: string) => void;
}) {
  const [notes, setNotes] = useState("");
  return (
    <Modal open onClose={onClose} size="sm" title="Reject this request" description="A reason is recorded on the audit trail and shown to the requester.">
      <div className="flex flex-col gap-3">
        <div>
          <label className="label-caps text-slate-400 mb-1.5 block">Reason</label>
          <textarea
            className="w-full box-border border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 resize-none h-24 outline-none focus:border-[#151936]/40 transition-colors"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={`Why is this ${row.requestType.replace(/_/g, " ")} being rejected?`}
            autoFocus
          />
        </div>
        <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
          <Button variant="secondary" size="sm" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button size="sm" className="text-rose-600" variant="secondary" onClick={() => onSubmit(notes.trim())} disabled={busy || !notes.trim()}>
            {busy ? "Rejecting…" : "Reject request"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function DelegateModal({
  row, entityId, onClose, onDone,
}: {
  row: ApprovalRow;
  entityId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const { pushToast } = useToast();
  const [toRole, setToRole] = useState(row.requiredApproverRole === "ceo" ? "gm" : "ceo");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/finance/approvals/delegate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityId, requestId: row.id, toRole, note: note.trim() }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Delegation failed");
      pushToast({
        tone: "success",
        title: "Delegated",
        body: `${APPROVER_ROLE_LABEL[toRole] ?? toRole} now owns this decision and has been notified.`,
      });
      onDone();
    } catch (err) {
      pushToast({ tone: "error", title: "Couldn't delegate", body: err instanceof Error ? err.message : "Try again." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title="Delegate this approval"
      description="The original is closed as escalated and a fresh request is opened for the tier you choose, linked back to it."
    >
      <div className="flex flex-col gap-3">
        <div>
          <label className="label-caps text-slate-400 mb-1.5 block">Hand to</label>
          <div className="flex gap-1.5 flex-wrap">
            {(["gm", "ceo", "department_head"] as const)
              .filter((r) => r !== row.requiredApproverRole)
              .map((r) => (
                <button
                  key={r}
                  onClick={() => setToRole(r)}
                  aria-pressed={toRole === r}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                    toRole === r ? "bg-[#151936] text-white border-[#151936]" : "bg-white text-slate-600 border-slate-200 hover:border-slate-300",
                  )}
                >{APPROVER_ROLE_LABEL[r]}</button>
              ))}
          </div>
        </div>
        <div>
          <label className="label-caps text-slate-400 mb-1.5 block">Reason</label>
          <textarea
            className="w-full box-border border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 resize-none h-20 outline-none focus:border-[#151936]/40 transition-colors"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Why is this moving tier?"
          />
        </div>
        <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
          <Button variant="secondary" size="sm" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button size="sm" onClick={submit} disabled={busy || !note.trim()}>{busy ? "Delegating…" : "Delegate"}</Button>
        </div>
      </div>
    </Modal>
  );
}
