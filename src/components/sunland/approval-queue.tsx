/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useState } from "react";
import { BoardPanel, Button, LoadingSpinner, useToast } from "@/components/ui/erp-primitives";
import { IconCheck, IconX, IconInbox, IconFileText } from "@tabler/icons-react";
import { formatKES } from "@/lib/utils/format";
import { Modal } from "@/components/ui/modal";

export interface ApprovalRequest {
  id: string;
  targetRole: string;
  entityId: string;
  requestedBy: string;
  amountKes: string;
  decisionNotes?: string;
  requestType: string;
  payload?: Record<string, unknown>;
  createdAt: string;
}

export function ApprovalQueue({ onActionComplete }: { onActionComplete?: () => void }) {
  const { pushToast } = useToast();
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<ApprovalRequest | null>(null);

  const fetchApprovals = async () => {
    try {
      const res = await fetch("/api/finance/approvals?status=pending");
      if (!res.ok) throw new Error("Failed to fetch approvals");
      const data = await res.json();
      setRequests(data.requests || []);
    } catch (err: unknown) {
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
      onActionComplete?.();
      if (selectedRequest?.id === requestId) setSelectedRequest(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not complete the action.";
      pushToast({
        tone: "error",
        title: "Action Failed",
        body: message,
      });
    } finally {
      setActioningId(null);
    }
  };

  if (isLoading) {
    return (
      <BoardPanel className="flex items-center justify-center p-6 min-h-[220px]">
        <LoadingSpinner className="text-[#151936] size-6" />
      </BoardPanel>
    );
  }

  return (
    <>
      <BoardPanel className="flex flex-col gap-4 min-h-[220px] p-0 sm:p-6 bg-transparent sm:bg-slate-50/30 border-0 sm:border sm:border-slate-100 shadow-none sm:shadow-sm rounded-none sm:rounded-lg">
        <div className="flex items-center justify-between border-b border-slate-200/60 pb-4">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-700">
              <IconInbox size={20} />
            </div>
            <div>
              <h2 className="text-title-primary flex items-center gap-2">
                Pending Approvals Queue
              </h2>
              <p className="text-meta-muted mt-0.5">Awaiting executive sign-off</p>
            </div>
          </div>
          {requests.length > 0 && (
            <div className="flex items-center px-2.5 py-1 rounded-md bg-amber-100/50 border border-amber-200 text-amber-800">
              <span className="label-caps">{requests.length} PENDING</span>
            </div>
          )}
        </div>

        {requests.length > 0 ? (
          <div className="flex flex-col gap-3 max-h-[360px] overflow-y-auto pr-2 scrollbar-thin">
            {requests.map((req) => (
              <div
                key={req.id}
                onClick={() => setSelectedRequest(req)}
                className="group bg-white border border-slate-200/80 rounded-xl p-4 shadow-sm hover:shadow-md hover:border-slate-300 transition-all flex flex-col sm:flex-row sm:items-start justify-between gap-4 cursor-pointer"
              >
                <div className="flex flex-col gap-3 w-full">
                  <div className="flex items-center gap-2">
                    <span className="label-caps px-2 py-1 rounded border bg-slate-50 text-slate-600 border-slate-200">
                      {req.targetRole ? req.targetRole.replace("_", " ") : "GENERAL"}
                    </span>
                    <span className="text-meta-muted">ID: <span className="mono-data">{req.id.split("-")[0]}</span></span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 bg-slate-50/50 p-3 rounded-lg border border-slate-100">
                    <div className="flex flex-col gap-1">
                      <span className="text-meta-muted-strong">Entity</span>
                      <span className="text-body-primary capitalize">{req.entityId}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-meta-muted-strong">Requested By</span>
                      <span className="text-body-primary">{req.requestedBy}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-100 pt-3 mt-1">
                    <div className="flex flex-col">
                      <span className="text-meta-muted">Amount</span>
                      <span className="mono-amount text-slate-900">{formatKES(parseFloat(req.amountKes) || 0)}</span>
                    </div>
                    {req.decisionNotes && (
                      <p className="text-body-regular text-slate-500 italic max-w-[200px] truncate text-right" title={req.decisionNotes}>
                        {req.decisionNotes}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex sm:flex-col items-center gap-2 shrink-0 sm:mt-10 sm:min-w-[110px]">
                  <Button
                    size="sm"
                    disabled={actioningId === req.id}
                    onClick={(e) => { e.stopPropagation(); handleDecision(req.id, "approved"); }}
                    className="w-full bg-[#f3df27] text-[#151936] hover:bg-[#e6d220] transition-colors border-0"
                  >
                    <IconCheck size={16} className="mr-1.5" /> Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="w-full hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 transition-colors"
                    disabled={actioningId === req.id}
                    onClick={(e) => { e.stopPropagation(); handleDecision(req.id, "rejected"); }}
                  >
                    <IconX size={16} className="mr-1.5" /> Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center py-10 text-center">
            <div className="size-16 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center mb-3">
              <IconInbox size={28} className="text-slate-300" />
            </div>
            <p className="text-body-primary text-slate-600">Clear queue</p>
            <p className="text-meta-muted mt-1">No pending sign-offs required at this time.</p>
          </div>
        )}
      </BoardPanel>

      <Modal
        open={!!selectedRequest}
        onClose={() => setSelectedRequest(null)}
        title="Approval Request Details"
        description="Review request before final sign-off"
        size="md"
      >
        {selectedRequest && (
          <div className="space-y-6">
            <div className="flex items-center gap-4 border-b border-slate-100 pb-4">
              <div className="size-12 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-600">
                <IconFileText size={24} />
              </div>
              <div>
                <h3 className="text-title-primary">Request {selectedRequest.id.split("-")[0]}</h3>
                <p className="text-meta-muted">Submitted on {new Date().toLocaleDateString()}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-y-6 gap-x-4">
              <div>
                <label className="label-caps text-slate-400 block mb-1">Target Role</label>
                <div className="text-body-primary">{selectedRequest.targetRole ? selectedRequest.targetRole.replace("_", " ") : "GENERAL"}</div>
              </div>
              <div>
                <label className="label-caps text-slate-400 block mb-1">Entity ID</label>
                <div className="text-body-primary capitalize">{selectedRequest.entityId}</div>
              </div>
              <div>
                <label className="label-caps text-slate-400 block mb-1">Requested By</label>
                <div className="text-body-primary">{selectedRequest.requestedBy}</div>
              </div>
              <div>
                <label className="label-caps text-slate-400 block mb-1">Amount</label>
                <div className="mono-amount text-lg">{formatKES(parseFloat(selectedRequest.amountKes) || 0)}</div>
              </div>
              {selectedRequest.decisionNotes && (
                <div className="col-span-2">
                  <label className="label-caps text-slate-400 block mb-1">Decision Notes</label>
                  <div className="bg-slate-50 rounded-lg p-3 text-body-regular border border-slate-100">
                    {selectedRequest.decisionNotes}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-4 border-t border-slate-100">
              <Button
                disabled={actioningId === selectedRequest.id}
                onClick={() => handleDecision(selectedRequest.id, "approved")}
                className="flex-1 bg-[#f3df27] text-[#151936] hover:bg-[#e6d220] transition-colors border-0 h-11 text-base"
              >
                <IconCheck size={18} className="mr-2" /> Approve Request
              </Button>
              <Button
                variant="secondary"
                disabled={actioningId === selectedRequest.id}
                onClick={() => handleDecision(selectedRequest.id, "rejected")}
                className="flex-1 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 transition-colors h-11 text-base"
              >
                <IconX size={18} className="mr-2" /> Reject Request
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
