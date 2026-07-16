/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { BoardPanel, Button, LoadingSpinner, useToast } from "@/components/ui/erp-primitives";
import { IconCheck, IconX, IconInbox, IconFileText } from "@tabler/icons-react";
import { formatKES } from "@/lib/utils/format";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

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
      <div className="flex flex-col gap-6 w-full border-t border-slate-200/60 py-4 my-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="size-12 rounded-[16px] bg-white border border-slate-100 shadow-sm flex items-center justify-center text-slate-700 relative overflow-hidden group-hover:shadow-md transition-all">
              <div className="absolute inset-0 bg-slate-50/50 opacity-0 group-hover:opacity-100 transition-opacity" />
              <IconInbox size={24} stroke={1.5} className="relative z-10" />
            </div>
            <div>
              <h2 className="text-title-secondary flex items-center gap-2">
                Pending Approvals Queue
              </h2>
              <p className="text-meta-muted mt-1">Awaiting executive sign-off</p>
            </div>
          </div>
          {requests.length > 0 && (
            <Link
              href="/admin/finance/approvals"
              className="flex items-center px-4 py-2 font-medium text-xs uppercase tracking-wide rounded-lg bg-white border border-slate-200 text-slate-600 shadow-sm hover:shadow hover:text-slate-900 transition-all"
            >
              View Queue <span className="mx-1 font-mono">({requests.length})</span>
            </Link>
          )}
        </div>

        {requests.length > 0 ? (
          <div className="flex flex-col gap-4">
            {requests.slice(0, 3).map((req) => (
              <div
                key={req.id}
                onClick={() => setSelectedRequest(req)}
                className="group relative bg-white border border-slate-100 rounded-[20px] p-5 shadow-[0_2px_12px_rgba(0,0,0,0.02)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] hover:-translate-y-0.5 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-6 cursor-pointer"
              >
                <div className="flex flex-col gap-4 w-full">
                  <div className="flex items-center gap-3 mb-1">
                    <Badge tone="neutral" className="px-2 py-0.5 text-[10px] tracking-widest uppercase shadow-sm">
                      {req.requestType ? req.requestType.replace(/_/g, " ") : "GENERAL"}
                    </Badge>
                    <span className="text-meta-muted text-xs">ID: <span className="mono-data ml-1">{req.id.split("-")[0]}</span></span>
                    <span className="text-slate-300 mx-1 hidden sm:inline">•</span>
                    <span className="text-meta-muted text-xs font-medium hidden sm:inline">{new Date(req.requestedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                  </div>

                  <div className="flex items-center flex-wrap gap-x-12 gap-y-5">
                    <div className="flex flex-col min-w-[140px]">
                      <span className="label-caps text-slate-400 mb-1.5">Entity</span>
                      <span className="text-sm font-medium text-slate-800 tracking-tight">{req.entityId === "group" ? "Sunland Group" : req.entityId.toUpperCase()}</span>
                    </div>

                    <div className="flex flex-col min-w-[140px]">
                      <span className="label-caps text-slate-400 mb-1.5">Requested By</span>
                      <div className="flex items-center gap-2.5">
                        <Image src={`https://i.pravatar.cc/150?u=${req.requestedByName}`} alt="Avatar" width={24} height={24} className="size-6 rounded-full object-cover ring-2 ring-white shadow-sm" />
                        <span className="text-sm font-medium text-slate-800 tracking-tight">{req.requestedByName || "System"}</span>
                      </div>
                    </div>

                    <div className="flex flex-col">
                      <span className="label-caps text-slate-400 mb-1">Amount</span>
                      <span className="mono-amount text-slate-900 text-xl font-medium leading-none">{formatKES(parseFloat(req.amountKes) || 0)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0 justify-end mt-4 sm:mt-0 pt-4 sm:pt-0 border-t sm:border-t-0 border-slate-100 w-full sm:w-auto">
                  <button
                    disabled={actioningId === req.id}
                    onClick={(e) => { e.stopPropagation(); handleDecision(req.id, "rejected"); }}
                    className="flex-1 sm:flex-none flex items-center justify-center h-9 px-4 rounded-lg bg-white text-slate-600 border border-slate-200 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 transition-all shadow-sm font-medium text-sm"
                  >
                    <IconX size={16} /> <span className="hidden sm:inline ml-1.5">Reject</span>
                  </button>
                  <button
                    disabled={actioningId === req.id}
                    onClick={(e) => { e.stopPropagation(); handleDecision(req.id, "approved"); }}
                    className="flex-1 sm:flex-none flex items-center justify-center h-9 px-5 rounded-lg bg-[#f3df27] text-[#151936] hover:bg-[#e6d220] transition-all border border-[#f3df27] hover:border-[#e6d220] shadow-sm font-medium text-sm"
                  >
                    <IconCheck size={16} className="mr-1.5" /> Approve
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center py-12 text-center bg-white/50 rounded-[24px] border border-slate-100 border-dashed">
            <div className="size-16 rounded-[18px] bg-slate-50 border border-slate-100 flex items-center justify-center mb-4 shadow-sm">
              <IconInbox size={28} stroke={1.5} className="text-slate-400" />
            </div>
            <p className="text-body-primary font-medium text-slate-700">Queue is clear</p>
            <p className="text-meta-muted mt-1.5 max-w-sm">No pending sign-offs required at this time. Great job staying on top of approvals!</p>
          </div>
        )}
      </div>

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
