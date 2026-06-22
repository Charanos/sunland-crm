/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect */
"use client";

import { useEffect, useState } from "react";
import { BoardPanel, Button, Badge, LoadingSpinner, useToast } from "@/components/ui/erp-primitives";
import { IconCheck, IconX, IconInbox } from "@tabler/icons-react";
import { formatKES } from "@/lib/utils/format";

export function ApprovalQueue() {
  const { pushToast } = useToast();
  const [requests, setRequests] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actioningId, setActioningId] = useState<string | null>(null);

  const fetchApprovals = async () => {
    try {
      const res = await fetch("/api/finance/approvals?status=pending");
      if (!res.ok) throw new Error("Failed to fetch approvals");
      const data = await res.json();
      setRequests(data.requests || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchApprovals();
  }, []);

  const handleDecision = async (requestId: string, status: "approved" | "rejected") => {
    setActioningId(requestId);
    try {
      const res = await fetch("/api/finance/approvals/decide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId,
          status,
          decisionNotes: `Request was ${status} from overview dashboard.`,
        }),
      });

      if (!res.ok) throw new Error("Failed to update approval request");

      pushToast({
        tone: status === "approved" ? "success" : "error",
        title: status === "approved" ? "Request Approved" : "Request Rejected",
        body: `Approval request was successfully marked as ${status}.`,
      });

      fetchApprovals();
    } catch (err: any) {
      pushToast({
        tone: "error",
        title: "Action Failed",
        body: err.message || "Could not complete the action.",
      });
    } finally {
      setActioningId(null);
    }
  };

  if (isLoading) {
    return (
      <BoardPanel className="flex items-center justify-center p-6 min-h-[180px]">
        <LoadingSpinner className="text-[#151936] size-6" />
      </BoardPanel>
    );
  }

  return (
    <BoardPanel className="flex flex-col gap-4 min-h-[220px]">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <h2 className="text-label text-slate-900 font-medium flex items-center gap-2">
          <span>Pending Approvals Queue</span>
          {requests.length > 0 && (
            <Badge tone="warning" className="ml-1 text-sm">
              {requests.length} pending
            </Badge>
          )}
        </h2>
      </div>

      {requests.length > 0 ? (
        <div className="divide-y divide-slate-150 max-h-[300px] overflow-y-auto pr-1">
          {requests.map((req) => (
            <div key={req.id} className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge tone="primary" className="text-sm  uppercase font-medium">
                    {req.targetRole ? req.targetRole.replace("_", " ") : "GENERAL"}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm  text-slate-600 mb-4 bg-slate-50/50 p-3 rounded-lg border border-slate-100/50">
                  <div className="flex flex-col gap-1">
                    <span className="text-sm text-slate-400 font-medium uppercase tracking-wider">Entity</span>
                    <span className="font-medium text-slate-700 capitalize">{req.entityId}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-sm text-slate-400 font-medium uppercase tracking-wider">Requested By</span>
                    <span className="font-medium text-slate-700">{req.requestedBy}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm ">
                  Amount: <span className="font-mono font-medium text-slate-900">{formatKES(parseFloat(req.amountKes) || 0)}</span>
                </div>
                {req.decisionNotes && (
                  <p className="text-base text-slate-500 italic mt-0.5">{req.decisionNotes}</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="secondary"
                  className="hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-colors"
                  disabled={actioningId === req.id}
                  onClick={() => handleDecision(req.id, "rejected")}
                >
                  <IconX size={14} className="mr-1" /> Reject
                </Button>
                <Button
                  size="sm"
                  disabled={actioningId === req.id}
                  onClick={() => handleDecision(req.id, "approved")}
                >
                  <IconCheck size={14} className="mr-1" /> Approve
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center py-8 text-center text-slate-400">
          <IconInbox size={28} className="text-slate-300 mb-1.5" />
          <p className="text-base font-medium">Clear queue. No pending sign-offs.</p>
        </div>
      )}
    </BoardPanel>
  );
}
