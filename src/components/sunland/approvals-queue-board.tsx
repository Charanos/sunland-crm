"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  IconAlertTriangle,
  IconCheck,
  IconChecklist,
  IconClock,
  IconFilter,
  IconRefresh,
  IconSearch,
  IconX,
  IconClipboardCheck,
  IconLifebuoy,
  IconReportAnalytics,
  IconDatabase,
} from "@tabler/icons-react";
import Link from "next/link";
import {
  Badge,
  BoardHeader,
  BoardPanel,
  Button,
  KpiCard,
  PaginationControls,
} from "@/components/ui/erp-primitives";
import { EmptyState } from "@/components/ui/empty-state";
import { PageTransition } from "@/components/shared/page-transition";
import { useToast } from "@/components/ui/toast-provider";
import { formatCompactKES } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

// ─── Types ────────────────────────────────────────────────────────────────────

type ApprovalRequest = {
  id: string;
  entityId: string;
  requestType: string;
  relatedTable: string | null;
  relatedId: string | null;
  requestedById: string;
  requestedByName: string;
  requestedAt: string;
  amountKes: string | null;
  requiredApproverRole: string;
  status: string;
  decisionNotes: string | null;
};

// ─── Tab config ───────────────────────────────────────────────────────────────

const TABS = [
  { id: "pending", label: "Pending", statusParam: "pending" },
  { id: "escalated", label: "Escalated", statusParam: "escalated" },
  { id: "resolved", label: "Resolved", statusParam: "decided" },
] as const;

type TabId = (typeof TABS)[number]["id"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function requestTypeTone(type: string): "warning" | "data" | "risk" | "neutral" | "success" {
  if (type.includes("mandate")) return "data";
  if (type.includes("cheque")) return "warning";
  if (type.includes("payroll")) return "success";
  return "neutral";
}

function statusTone(status: string): "warning" | "success" | "risk" | "neutral" | "data" {
  if (status === "pending") return "warning";
  if (status === "approved") return "success";
  if (status === "rejected") return "risk";
  if (status === "escalated") return "data";
  return "neutral";
}

function formatAge(dateStr: string): string {
  const now = new Date();
  const then = new Date(dateStr);
  const diffMs = now.getTime() - then.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays > 0) return `${diffDays}d ago`;
  if (diffHours > 0) return `${diffHours}h ago`;
  return "Just now";
}

// ─── Approve / Reject confirm dialog ──────────────────────────────────────────

function DecisionDialog({
  request,
  decision,
  onClose,
  onSuccess,
}: {
  request: ApprovalRequest;
  decision: "approved" | "rejected";
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { pushToast } = useToast();
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const isReject = decision === "rejected";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReject && !notes.trim()) {
      setError("Rejection notes are required.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/finance/approvals/decide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: request.id, status: decision, decisionNotes: notes || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Decision failed");
      pushToast({
        tone: decision === "approved" ? "success" : "error",
        title: decision === "approved" ? "Request Approved" : "Request Rejected",
        body: `${request.requestType.replace(/_/g, " ")} has been ${decision}.`,
      });
      onSuccess();
      onClose();
    } catch (err) {
      const error = err as Error;
      setError(error.message);
      pushToast({ tone: "error", title: "Action Failed", body: error.message || "Could not complete the action." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-heading-primary">
              {isReject ? "Reject Request" : "Approve Request"}
            </h2>
            <p className="mt-0.5 text-slate-500 text-base">
              {request.requestType.replace(/_/g, " ")} — {request.requestedByName}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 transition-colors"
            aria-label="Close"
          >
            <IconX size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-rose-50 border border-rose-200 px-3 py-2.5">
              <IconAlertTriangle size={15} className="text-rose-500 mt-0.5 shrink-0" />
              <p className="text-base text-rose-700">{error}</p>
            </div>
          )}

          {request.amountKes && (
            <div className="rounded-lg bg-slate-50 border border-slate-100 px-4 py-3">
              <p className="label-caps text-slate-400">Amount</p>
              <p className="mt-1 mono-data text-slate-900 text-lg">
                {formatCompactKES(parseFloat(request.amountKes))}
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="decision-notes" className="label-caps text-slate-500">
              {isReject ? "Rejection Notes (required)" : "Decision Notes (optional)"}
            </label>
            <textarea
              id="decision-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder={isReject ? "Reason for rejection…" : "Optional notes for the requester…"}
              className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-800 outline-none focus:border-[#151936] focus:bg-white transition-colors text-base"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-1">
            <Button type="button" variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
            <Button
              type="submit"
              size="sm"
              disabled={loading}
              className={isReject ? "bg-rose-600 hover:bg-rose-700 text-white" : ""}
            >
              {loading ? "Saving…" : isReject ? "Reject" : "Approve"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Approvals Table ──────────────────────────────────────────────────────────

function ApprovalsTable({
  requests,
  showDecisionButtons,
  onRefresh,
}: {
  requests: ApprovalRequest[];
  showDecisionButtons: boolean;
  onRefresh: () => void;
}) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [decisionModal, setDecisionModal] = useState<{
    request: ApprovalRequest;
    decision: "approved" | "rejected";
  } | null>(null);
  const rowsPerPage = 8;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return requests;
    return requests.filter((r) =>
      [r.requestType, r.requestedByName, r.requiredApproverRole, r.status].some((v) =>
        v?.toLowerCase().includes(q),
      ),
    );
  }, [requests, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const visible = filtered.slice((page - 1) * rowsPerPage, page * rowsPerPage);

  if (requests.length === 0) {
    return (
      <EmptyState
        icon={IconChecklist}
        title="No approvals in this queue"
        description="Nothing pending. All decisions are up to date."
        action="Refresh"
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="flex h-9 flex-1 min-w-[200px] items-center gap-2 rounded-lg border border-slate-200 bg-white px-3">
          <IconSearch size={14} className="text-slate-400" />
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(1); }}
            placeholder="Search approvals…"
            className="w-full bg-transparent text-slate-700 outline-none placeholder:text-slate-400 text-base"
          />
        </div>
        <Button variant="secondary" size="sm">
          <IconFilter size={14} /> Filter
        </Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px] text-left text-body-regular">
          <thead>
            <tr className="border-b border-slate-100 label-caps text-slate-400">
              <th className="px-2 py-2.5">Type</th>
              <th className="px-2 py-2.5">Requested By</th>
              <th className="px-2 py-2.5">Requires</th>
              <th className="px-2 py-2.5 text-right">Amount</th>
              <th className="px-2 py-2.5">Status</th>
              <th className="px-2 py-2.5">Age</th>
              {showDecisionButtons && <th className="px-2 py-2.5 text-right">Action</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visible.map((req) => (
              <tr key={req.id} className="transition-colors hover:bg-slate-50/80">
                <td className="px-2 py-3">
                  <Badge tone={requestTypeTone(req.requestType)}>
                    {req.requestType.replace(/_/g, " ")}
                  </Badge>
                </td>
                <td className="px-2 py-3 text-title-primary">{req.requestedByName}</td>
                <td className="px-2 py-3 text-slate-600 text-base">
                  {req.requiredApproverRole.replace(/_/g, " ")}
                </td>
                <td className="px-2 py-3 text-right mono-data text-slate-900">
                  {req.amountKes ? formatCompactKES(parseFloat(req.amountKes)) : "—"}
                </td>
                <td className="px-2 py-3">
                  <Badge tone={statusTone(req.status)}>{req.status}</Badge>
                </td>
                <td className="px-2 py-3 text-slate-500 text-base whitespace-nowrap">
                  {formatAge(req.requestedAt)}
                </td>
                {showDecisionButtons && (
                  <td className="px-2 py-3 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setDecisionModal({ request: req, decision: "approved" })}
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-base text-emerald-700 hover:bg-emerald-100 transition-colors"
                        aria-label={`Approve ${req.requestType}`}
                      >
                        <IconCheck size={13} /> Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => setDecisionModal({ request: req, decision: "rejected" })}
                        className="inline-flex items-center gap-1 rounded-lg bg-rose-50 px-2.5 py-1 text-base text-rose-700 hover:bg-rose-100 transition-colors"
                        aria-label={`Reject ${req.requestType}`}
                      >
                        <IconX size={13} /> Reject
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <PaginationControls
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
        label={`${filtered.length} approval requests`}
      />

      {decisionModal && (
        <DecisionDialog
          request={decisionModal.request}
          decision={decisionModal.decision}
          onClose={() => setDecisionModal(null)}
          onSuccess={onRefresh}
        />
      )}
    </div>
  );
}

// ─── Main Board ───────────────────────────────────────────────────────────────

export function ApprovalsQueueBoard() {
  const [activeTab, setActiveTab] = useState<TabId>("pending");
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const loadRequests = useCallback(async (statusParam: string) => {
    Promise.resolve().then(() => setLoading(true));
    try {
      const res = await fetch(`/api/finance/approvals?status=${statusParam}`);
      const data = await res.json();
      setRequests(data.requests ?? []);
    } catch (err) {
      console.error("Failed to load approvals:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const currentTab = TABS.find((t) => t.id === activeTab)!;

  useEffect(() => {
    Promise.resolve().then(() => {
      loadRequests(currentTab.statusParam);
    });
  }, [activeTab, loadRequests, currentTab.statusParam]);

  const pendingCount = requests.filter((r) => r.status === "pending").length;
  const totalAmount = requests
    .filter((r) => r.amountKes)
    .reduce((sum, r) => sum + parseFloat(r.amountKes!), 0);

  return (
    <PageTransition className="mx-auto flex max-w-[98rem] flex-col gap-4">
      <BoardHeader
        eyebrow={<Badge tone="warning">Approvals Queue</Badge>}
        title="Approvals"
        description="Cross-department approval requests routed to GM and CEO. One row per request — decisions are final and audited."
        actions={
          <Button variant="secondary" size="sm" onClick={() => loadRequests(currentTab.statusParam)}>
            <IconRefresh size={14} /> Refresh
          </Button>
        }
      />

      {/* ── Oversight Control Hub Navigator & Tabs ── */}
      <div className="bg-white border border-slate-100 rounded-[20px] shadow-sm overflow-hidden">
        {/* Top Navigator */}
        <div className="flex items-center justify-between flex-wrap gap-4 p-4">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center">
              <IconClipboardCheck size={16} />
            </div>
            <div>
              <h3 className="text-base font-medium text-slate-800 leading-none">Oversight Control Hub</h3>
              <p className="text-sm text-slate-400 mt-1">Cross-department audits and system management.</p>
            </div>
          </div>

          <div className="flex bg-slate-100 p-1 rounded-xl flex-wrap gap-1">
            <Link
              href="/admin/approvals"
              className="body-sm px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 bg-[#151936] text-white shadow-sm"
            >
              <span>Approvals</span>
              <span className="bg-[#f3df27] text-[#151936] px-1.5 py-0.2 rounded-full text-meta-muted-strong">Queue</span>
            </Link>
            <Link
              href="/admin/hr/complaints"
              className="body-sm px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 text-slate-500 hover:text-slate-900 hover:bg-white/45"
            >
              <span>Complaints</span>
            </Link>
            <Link
              href="/admin/support"
              className="body-sm px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 text-slate-500 hover:text-slate-900 hover:bg-white/45"
            >
              <span>Support Tickets</span>
            </Link>
            <Link
              href="/admin/reports"
              className="body-sm px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 text-slate-500 hover:text-slate-900 hover:bg-white/45"
            >
              <span>Reports Center</span>
            </Link>
            <Link
              href="/admin/system"
              className="body-sm px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 text-slate-500 hover:text-slate-900 hover:bg-white/45"
            >
              <span>System & Roles</span>
            </Link>
          </div>
        </div>

        {/* Bottom Tab Strip */}
        <div className="border-t border-slate-100 bg-slate-50/50 p-2 px-4 flex items-center gap-1 overflow-x-auto [scrollbar-width:none]">
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider mr-2">View:</span>
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-1.5 text-sm transition-all duration-200 font-medium",
                  isActive
                    ? "bg-[#151936] text-white shadow-sm"
                    : "text-slate-500 hover:bg-slate-200/50 hover:text-slate-800",
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* KPI strip */}
      <div className="gsap-stagger grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard
          icon={IconChecklist}
          label="Pending"
          value={String(pendingCount)}
          tone="warning"
        />
        <KpiCard
          icon={IconClock}
          label="Total Value Pending"
          value={totalAmount > 0 ? formatCompactKES(totalAmount) : "—"}
          tone="data"
        />
        <KpiCard
          icon={IconAlertTriangle}
          label="Past 72h SLA"
          value="0"
          tone="success"
        />
        <KpiCard
          icon={IconCheck}
          label="Resolved (all time)"
          value="—"
          tone="neutral"
        />
      </div>



      {/* Content */}
      <BoardPanel className="gsap-stagger space-y-4">
        <div>
          <h2 className="text-heading-primary">
            {currentTab.label} Approvals
          </h2>
          <p className="mt-0.5 text-slate-500 text-base">
            {activeTab === "pending" && "Items awaiting a decision at your step. Approve or reject inline."}
            {activeTab === "escalated" && "Items you have escalated upward. Track their progress here."}
            {activeTab === "resolved" && "Full historical record of approved and rejected requests."}
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400 text-base">
            Loading approvals…
          </div>
        ) : (
          <ApprovalsTable
            requests={requests}
            showDecisionButtons={activeTab === "pending"}
            onRefresh={() => loadRequests(currentTab.statusParam)}
          />
        )}
      </BoardPanel>
    </PageTransition>
  );
}
