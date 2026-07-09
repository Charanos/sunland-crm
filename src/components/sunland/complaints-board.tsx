"use client";

import { useCallback, useEffect, useState } from "react";
import {
  IconAlertTriangle,
  IconArrowUp,
  IconCheck,
  IconEyeOff,
  IconInbox,
  IconMessageCircle,
  IconPlus,
  IconClipboardCheck,
  IconLifebuoy,
  IconReportAnalytics,
  IconDatabase,
} from "@tabler/icons-react";
import Link from "next/link";
import { Badge, BoardHeader, BoardPanel, Button, KpiCard } from "@/components/ui/erp-primitives";
import { EmptyState } from "@/components/ui/empty-state";
import { Modal } from "@/components/ui/modal";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { PageTransition } from "@/components/shared/page-transition";
import { useToast } from "@/components/ui/toast-provider";
import { cn } from "@/lib/utils/cn";

type ComplaintCategory = "conduct" | "harassment" | "policy" | "safety" | "other";
type ComplaintStatus = "open" | "escalated" | "resolved";
type ComplaintTab = "my-queue" | "escalated" | "resolved";

interface Complaint {
  id: string;
  entityId: string;
  filedById: string | null;
  isAnonymous: boolean;
  namedPersonId: string | null;
  category: ComplaintCategory;
  subject: string;
  description: string;
  status: ComplaintStatus;
  currentOwnerRole: string;
  escalatedAt: string | null;
  escalationReason: string | null;
  resolvedAt: string | null;
  resolutionSummary: string | null;
  internalNotes: Array<{ authorId: string; note: string; at: string }>;
  createdAt: string;
}

interface UserOption {
  id: string;
  name: string;
}

const CATEGORY_META: Record<ComplaintCategory, { label: string; tone: "data" | "risk" | "warning" | "neutral" }> = {
  conduct: { label: "Conduct", tone: "warning" },
  harassment: { label: "Harassment", tone: "risk" },
  policy: { label: "Policy", tone: "data" },
  safety: { label: "Safety", tone: "risk" },
  other: { label: "Other", tone: "neutral" },
};

const TABS: { id: ComplaintTab; label: string }[] = [
  { id: "my-queue", label: "My Queue" },
  { id: "escalated", label: "Escalated" },
  { id: "resolved", label: "Resolved & Closed" },
];

const EMPTY_FORM = {
  category: "other" as ComplaintCategory,
  subject: "",
  description: "",
  namedPersonId: "",
  isAnonymous: false,
};

export function ComplaintsBoard({ entityId = "group" }: { entityId?: string }) {
  const { pushToast } = useToast();
  const [activeTab, setActiveTab] = useState<ComplaintTab>("my-queue");
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [selected, setSelected] = useState<Complaint | null>(null);
  const [busy, setBusy] = useState(false);
  const [escalateReason, setEscalateReason] = useState("");
  const [resolutionSummary, setResolutionSummary] = useState("");
  const [newNote, setNewNote] = useState("");

  const loadComplaints = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/hr/complaints?entityId=${entityId}&tab=${activeTab}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load complaints");
      setComplaints(data.complaints ?? []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load complaints";
      pushToast({ tone: "error", title: "Error", body: message });
    } finally {
      setIsLoading(false);
    }
  }, [entityId, activeTab, pushToast]);

  useEffect(() => {
    Promise.resolve().then(() => {
      loadComplaints();
      fetch(`/api/identity/users?entityId=${entityId}`)
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data.users)) setUsers(data.users);
        })
        .catch(() => {});
    });
  }, [loadComplaints, entityId]);

  const userName = (id: string | null) => (id ? users.find((u) => u.id === id)?.name ?? "Unknown" : null);

  const openCreateModal = () => {
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.subject.trim() || !form.description.trim()) {
      pushToast({ tone: "error", title: "Missing details", body: "Subject and description are required." });
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch("/api/hr/complaints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityId,
          category: form.category,
          subject: form.subject,
          description: form.description,
          namedPersonId: form.namedPersonId || undefined,
          isAnonymous: form.isAnonymous,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to file complaint");

      pushToast({ tone: "success", title: "Complaint Filed", body: "Your complaint has been submitted and routed." });
      setModalOpen(false);
      loadComplaints();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to file complaint";
      pushToast({ tone: "error", title: "Error", body: message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleEscalate = async () => {
    if (!selected || !escalateReason.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/hr/complaints/${selected.id}/escalate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: escalateReason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to escalate");
      pushToast({ tone: "success", title: "Escalated", body: "Complaint escalated to the next tier." });
      setSelected(null);
      setEscalateReason("");
      loadComplaints();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to escalate complaint";
      pushToast({ tone: "error", title: "Error", body: message });
    } finally {
      setBusy(false);
    }
  };

  const handleResolve = async () => {
    if (!selected || !resolutionSummary.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/hr/complaints/${selected.id}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolutionSummary }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to resolve");
      pushToast({ tone: "success", title: "Resolved", body: "Complaint marked resolved and filer notified." });
      setSelected(null);
      setResolutionSummary("");
      loadComplaints();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to resolve complaint";
      pushToast({ tone: "error", title: "Error", body: message });
    } finally {
      setBusy(false);
    }
  };

  const handleAddNote = async () => {
    if (!selected || !newNote.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/hr/complaints/${selected.id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: newNote }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add note");
      setSelected(data.complaint);
      setNewNote("");
      pushToast({ tone: "success", title: "Note Added", body: "Internal note recorded." });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to add note";
      pushToast({ tone: "error", title: "Error", body: message });
    } finally {
      setBusy(false);
    }
  };

  const openCount = complaints.filter((c) => c.status === "open").length;

  return (
    <PageTransition className="mx-auto flex max-w-[98rem] flex-col gap-4">
      <BoardHeader
        eyebrow={<Badge tone="warning">HR</Badge>}
        title="Complaints"
        description="Confidential complaint intake and escalation — HR Head, GM, and CEO tiers only. Content stays out of the general audit log."
        actions={
          <Button size="sm" onClick={openCreateModal}>
            <IconPlus size={14} /> File Complaint
          </Button>
        }
      />

      <div className="gsap-stagger grid grid-cols-2 gap-3 md:grid-cols-3">
        <KpiCard icon={IconInbox} label="In Your Queue" value={String(activeTab === "my-queue" ? complaints.length : openCount)} tone="neutral" />
        <KpiCard icon={IconArrowUp} label="Escalated" value={String(activeTab === "escalated" ? complaints.length : 0)} tone="warning" />
        <KpiCard icon={IconCheck} label="Resolved" value={String(activeTab === "resolved" ? complaints.length : 0)} tone="success" />
      </div>

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
              className="body-sm px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 text-slate-500 hover:text-slate-900 hover:bg-white/45"
            >
              <span>Approvals</span>
              <span className="bg-slate-200 text-slate-650 px-1.5 py-0.2 rounded-full text-meta-muted-strong">Queue</span>
            </Link>
            <Link
              href="/admin/hr/complaints"
              className="body-sm px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 bg-[#151936] text-white shadow-sm"
            >
              <IconAlertTriangle size={14} />
              <span>Complaints</span>
            </Link>
            <Link
              href="/admin/support"
              className="body-sm px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 text-slate-500 hover:text-slate-900 hover:bg-white/45"
            >
              <IconLifebuoy size={14} />
              <span>Support Tickets</span>
            </Link>
            <Link
              href="/admin/reports"
              className="body-sm px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 text-slate-500 hover:text-slate-900 hover:bg-white/45"
            >
              <IconReportAnalytics size={14} />
              <span>Reports Center</span>
            </Link>
            <Link
              href="/admin/system"
              className="body-sm px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 text-slate-500 hover:text-slate-900 hover:bg-white/45"
            >
              <IconDatabase size={14} />
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
                  "flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-1.5 text-body-primary transition-all duration-200",
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

      <BoardPanel className="p-4 sm:p-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <LoadingSpinner size="md" />
          </div>
        ) : complaints.length === 0 ? (
          <EmptyState
            icon={IconInbox}
            title="Queue clear"
            description="No complaints in this view right now."
            action="File Complaint"
            onClick={openCreateModal}
          />
        ) : (
          <div className="space-y-2.5">
            {complaints.map((c) => {
              const meta = CATEGORY_META[c.category];
              return (
                <div
                  key={c.id}
                  onClick={() => setSelected(c)}
                  className="flex items-start gap-4 rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm hover:shadow-md hover:border-slate-300 transition-all cursor-pointer"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-body-primary text-slate-900 truncate">{c.subject}</h4>
                      <span className="text-meta-muted whitespace-nowrap">{new Date(c.createdAt).toLocaleDateString("en-KE")}</span>
                    </div>
                    <p className="text-body-regular text-slate-500 mt-0.5 line-clamp-1">{c.description}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <Badge tone={meta.tone}>{meta.label}</Badge>
                      {c.isAnonymous && (
                        <span className="text-meta-muted-strong flex items-center gap-1">
                          <IconEyeOff size={12} /> Anonymous
                        </span>
                      )}
                      {c.namedPersonId && (
                        <Badge tone="neutral">Names: {userName(c.namedPersonId)}</Badge>
                      )}
                      {c.status === "escalated" && <Badge tone="warning">Escalated</Badge>}
                      {c.status === "resolved" && <Badge tone="success">Resolved</Badge>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </BoardPanel>

      {/* File Complaint Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="File Complaint" description="Confidential — routed to the correct tier automatically" size="md">
        <div className="space-y-4">
          <div>
            <label className="label-caps text-slate-500 mb-1.5 block">Subject</label>
            <input
              className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-base text-slate-800 focus:outline-none focus:border-[#151936]/40 transition-colors"
              value={form.subject}
              onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
              placeholder="Brief summary"
            />
          </div>

          <div>
            <label className="label-caps text-slate-500 mb-1.5 block">Category</label>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(CATEGORY_META) as ComplaintCategory[]).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, category: cat }))}
                  className={cn(
                    "px-3.5 py-1.5 rounded-lg text-sm font-medium border transition-all",
                    form.category === cat ? "bg-[#151936] text-white border-[#151936]" : "bg-white text-slate-500 border-slate-200 hover:border-slate-300",
                  )}
                >
                  {CATEGORY_META[cat].label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label-caps text-slate-500 mb-1.5 block">Names Someone (optional)</label>
            <select
              className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-base text-slate-800 focus:outline-none focus:border-[#151936]/40 transition-colors"
              value={form.namedPersonId}
              onChange={(e) => setForm((f) => ({ ...f, namedPersonId: e.target.value }))}
            >
              <option value="">None</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label-caps text-slate-500 mb-1.5 block">Description</label>
            <textarea
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-base text-slate-800 resize-none h-28 focus:outline-none focus:border-[#151936]/40 transition-colors"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Full details"
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isAnonymous}
              onChange={(e) => setForm((f) => ({ ...f, isAnonymous: e.target.checked }))}
              className="size-4 rounded border-slate-300"
            />
            <span className="text-body-regular text-slate-600">File anonymously (identity withheld from everyone but you)</span>
          </label>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
            <Button type="button" variant="secondary" size="sm" onClick={() => setModalOpen(false)} disabled={isSaving}>Cancel</Button>
            <Button type="button" size="sm" onClick={handleSubmit} disabled={isSaving}>
              {isSaving ? "Filing…" : "File Complaint"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Detail Modal */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title="Complaint Details" size="md">
        {selected && (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
                <IconAlertTriangle size={20} />
              </div>
              <div>
                <h3 className="text-title-primary">{selected.subject}</h3>
                <p className="text-meta-muted">Filed {new Date(selected.createdAt).toLocaleDateString("en-KE")}{selected.isAnonymous ? " · Anonymous" : ""}</p>
              </div>
            </div>

            <p className="text-body-regular text-slate-700 bg-slate-50 rounded-lg p-3 border border-slate-100">{selected.description}</p>

            {selected.namedPersonId && (
              <p className="text-body-regular text-slate-600">Names: <span className="text-slate-900">{userName(selected.namedPersonId)}</span></p>
            )}

            {selected.internalNotes.length > 0 && (
              <div>
                <label className="label-caps text-slate-400 block mb-1.5">Internal Notes</label>
                <div className="space-y-2">
                  {selected.internalNotes.map((n, i) => (
                    <div key={i} className="bg-slate-50 rounded-lg p-2.5 border border-slate-100">
                      <p className="text-body-regular text-slate-700">{n.note}</p>
                      <p className="text-meta-muted mt-1">{new Date(n.at).toLocaleString("en-KE")}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selected.status === "resolved" ? (
              <div className="bg-emerald-50/50 border border-emerald-100 rounded-lg p-3">
                <p className="label-caps text-emerald-700 mb-1">Resolution</p>
                <p className="text-body-regular text-slate-700">{selected.resolutionSummary}</p>
              </div>
            ) : (
              <>
                <div>
                  <label className="label-caps text-slate-500 mb-1.5 block">Add Note</label>
                  <div className="flex gap-2">
                    <input
                      className="flex-1 h-10 rounded-lg border border-slate-200 bg-white px-3 text-base text-slate-800 focus:outline-none focus:border-[#151936]/40"
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      placeholder="Internal note…"
                    />
                    <Button type="button" size="sm" onClick={handleAddNote} disabled={busy || !newNote.trim()}>
                      <IconMessageCircle size={14} />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-100">
                  <div>
                    <label className="label-caps text-slate-500 mb-1.5 block">Escalate</label>
                    <textarea
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-base text-slate-800 resize-none h-20 focus:outline-none focus:border-[#151936]/40"
                      value={escalateReason}
                      onChange={(e) => setEscalateReason(e.target.value)}
                      placeholder="Reason for escalation"
                    />
                    <Button type="button" variant="secondary" size="sm" className="w-full mt-2" onClick={handleEscalate} disabled={busy || !escalateReason.trim()}>
                      <IconArrowUp size={14} /> Escalate
                    </Button>
                  </div>
                  <div>
                    <label className="label-caps text-slate-500 mb-1.5 block">Resolve</label>
                    <textarea
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-base text-slate-800 resize-none h-20 focus:outline-none focus:border-[#151936]/40"
                      value={resolutionSummary}
                      onChange={(e) => setResolutionSummary(e.target.value)}
                      placeholder="Resolution summary (shared with filer)"
                    />
                    <Button type="button" size="sm" className="w-full mt-2" onClick={handleResolve} disabled={busy || !resolutionSummary.trim()}>
                      <IconCheck size={14} /> Resolve
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </Modal>
    </PageTransition>
  );
}
