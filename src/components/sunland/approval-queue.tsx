/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useState } from "react";
import { BoardPanel, Button, LoadingSpinner, useToast } from "@/components/ui/erp-primitives";
import { IconCheck, IconX, IconInbox, IconFileText } from "@tabler/icons-react";
import { formatKES } from "@/lib/utils/format";
import { Modal } from "@/components/ui/modal";

export interface ApprovalRequest {
  id: string;
  requiredApproverRole: string;
  entityId: string;
  requestedByName: string;
  amountKes: string;
  decisionNotes?: string;
  requestType: string;
  relatedTable?: string;
  relatedId?: string;
  requestedAt: string;
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
      <BoardPanel className="flex flex-col gap-4 h-full">
        <div className="flex items-center justify-between">
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
                className="group bg-white border border-slate-200/60 rounded-[18px] p-5 shadow-[0_2px_10px_rgba(0,0,0,0.02)] hover:shadow-md hover:border-slate-300 hover:-translate-y-[1px] transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-5 cursor-pointer"
              >
                <div className="flex flex-col gap-3 w-full">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="label-caps px-2 py-0.5 rounded-md border bg-slate-50 text-slate-600 border-slate-200 shadow-sm">
                      {req.requestType ? req.requestType.replace(/_/g, " ") : "GENERAL"}
                    </span>
                    <span className="text-meta-muted">ID: <span className="mono-data">{req.id.split("-")[0]}</span></span>
                    <span className="text-slate-300 mx-1 hidden sm:inline">•</span>
                    <span className="text-meta-muted body-sm hidden sm:inline">{new Date(req.requestedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                  </div>

                  <div className="flex items-center flex-wrap gap-x-8 gap-y-3">
                    <div className="flex flex-col">
                      <span className="text-meta-muted-strong text-xs uppercase tracking-wider mb-0.5">Entity</span>
                      <span className="text-body-primary font-medium">{req.entityId === "group" ? "Sunland Group" : req.entityId.toUpperCase()}</span>
                    </div>
                    <div className="w-px h-8 bg-slate-100 hidden sm:block"></div>
                    <div className="flex flex-col">
                      <span className="text-meta-muted-strong text-xs uppercase tracking-wider mb-0.5">Requested By</span>
                      <span className="text-body-primary font-medium">{req.requestedByName || "System"}</span>
                    </div>
                    <div className="w-px h-8 bg-slate-100 hidden sm:block"></div>
                    <div className="flex flex-col">
                      <span className="text-meta-muted-strong text-xs uppercase tracking-wider mb-0.5">Amount</span>
                      <span className="mono-amount text-slate-900 text-lg leading-none">{formatKES(parseFloat(req.amountKes) || 0)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 shrink-0 justify-end mt-4 sm:mt-0 pt-4 sm:pt-0 border-t sm:border-t-0 border-slate-100 w-full sm:w-auto">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="flex-1 sm:flex-none hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 transition-colors shadow-sm"
                    disabled={actioningId === req.id}
                    onClick={(e) => { e.stopPropagation(); handleDecision(req.id, "rejected"); }}
                  >
                    <IconX size={16} /> <span className="hidden sm:inline ml-1.5">Reject</span>
                  </Button>
                  <Button
                    size="sm"
                    disabled={actioningId === req.id}
                    onClick={(e) => { e.stopPropagation(); handleDecision(req.id, "approved"); }}
                    className="flex-1 sm:flex-none bg-[#f3df27] text-[#151936] hover:bg-[#e6d220] transition-colors border-0 shadow-sm"
                  >
                    <IconCheck size={16} className="mr-1.5" /> Approve
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
                <p className="text-meta-muted">Submitted on {new Date(selectedRequest.requestedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-meta-muted-strong block mb-1 text-xs uppercase tracking-wider">Entity</span>
                <span className="text-body-primary font-medium">{selectedRequest.entityId === "group" ? "Sunland Group" : selectedRequest.entityId.toUpperCase()}</span>
              </div>
              <div>
                <span className="text-meta-muted-strong block mb-1 text-xs uppercase tracking-wider">Approver Role</span>
                <span className="label-caps px-2 py-0.5 rounded border bg-slate-50">{selectedRequest.requiredApproverRole}</span>
              </div>
              <div>
                <span className="text-meta-muted-strong block mb-1 text-xs uppercase tracking-wider">Amount</span>
                <span className="mono-amount text-slate-900 text-lg">{formatKES(parseFloat(selectedRequest.amountKes) || 0)}</span>
              </div>
              <div>
                <span className="text-meta-muted-strong block mb-1 text-xs uppercase tracking-wider">Requested By</span>
                <span className="text-body-primary">{selectedRequest.requestedByName || "System"}</span>
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
