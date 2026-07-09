"use client";

import { useCallback, useEffect, useState } from "react";
import {
  IconAlertTriangle,
  IconCheck,
  IconClock,
  IconInbox,
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

type TicketCategory = "technical" | "access" | "data" | "other";
type TicketPriority = "low" | "normal" | "high" | "critical";
type TicketStatus = "open" | "in_progress" | "resolved" | "closed";
type TicketTab = "open" | "in_progress" | "resolved";

interface SupportTicket {
  id: string;
  entityId: string;
  raisedById: string;
  category: TicketCategory;
  subject: string;
  description: string;
  priority: TicketPriority;
  status: TicketStatus;
  assignedToId: string | null;
  resolutionNotes: string | null;
  resolvedById: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

interface UserOption {
  id: string;
  name: string;
}

const CATEGORY_META: Record<TicketCategory, { label: string; tone: "data" | "risk" | "warning" | "neutral" }> = {
  technical: { label: "Technical", tone: "risk" },
  access: { label: "Access / Auth", tone: "warning" },
  data: { label: "Data Error", tone: "data" },
  other: { label: "Other", tone: "neutral" },
};

const PRIORITY_META: Record<TicketPriority, { label: string; tone: "neutral" | "data" | "warning" | "risk" }> = {
  low: { label: "Low", tone: "neutral" },
  normal: { label: "Normal", tone: "data" },
  high: { label: "High", tone: "warning" },
  critical: { label: "Critical", tone: "risk" },
};

const TABS: { id: TicketTab; label: string }[] = [
  { id: "open", label: "Open Tickets" },
  { id: "in_progress", label: "In Progress" },
  { id: "resolved", label: "Resolved & Closed" },
];

const EMPTY_FORM = {
  category: "technical" as TicketCategory,
  subject: "",
  description: "",
  priority: "normal" as TicketPriority,
};

export function SupportTicketsBoard({ entityId = "group" }: { entityId?: string }) {
  const { pushToast } = useToast();
  const [activeTab, setActiveTab] = useState<TicketTab>("open");
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [staff, setStaff] = useState<UserOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [selected, setSelected] = useState<SupportTicket | null>(null);
  const [busy, setBusy] = useState(false);
  // Org-wide triage (scope=all) requires support.ticket.manage (CEO/GM). Any
  // other authenticated staff member can still reach this page to file and
  // track their own tickets ("admin is the main support endpoint" — the
  // backend scopes them to scope=mine automatically), so a 403 on the
  // org-wide query falls back to the caller's own queue rather than erroring.
  const [scope, setScope] = useState<"all" | "mine">("all");

  // Edit / Resolve form state
  const [editStatus, setEditStatus] = useState<TicketStatus>("open");
  const [editPriority, setEditPriority] = useState<TicketPriority>("normal");
  const [editAssignedToId, setEditAssignedToId] = useState<string>("");
  const [editResolutionNotes, setEditResolutionNotes] = useState<string>("");

  const loadTickets = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/support/tickets?entityId=${entityId}&scope=${scope}`);
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 403 && scope === "all") {
          setScope("mine");
          return;
        }
        throw new Error(data.error || "Failed to load support tickets");
      }
      setTickets(data.tickets ?? []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load support tickets";
      pushToast({ tone: "error", title: "Error", body: message });
    } finally {
      setIsLoading(false);
    }
  }, [entityId, scope, pushToast]);

  const loadStaff = useCallback(async () => {
    try {
      const res = await fetch(`/api/identity/users?entityId=group`);
      const data = await res.json();
      if (Array.isArray(data.users)) {
        setStaff(data.users);
      }
    } catch (err) {
      console.error("Failed to load staff list:", err);
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(() => {
      loadTickets();
      loadStaff();
    });
  }, [loadTickets, loadStaff]);

  const handleCreate = async () => {
    if (!form.subject.trim() || !form.description.trim()) {
      pushToast({ tone: "error", title: "Validation Error", body: "Please fill in all fields." });
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch("/api/support/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityId,
          ...form,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create support ticket");
      pushToast({ tone: "success", title: "Ticket Created", body: "Your support ticket was filed successfully." });
      setForm(EMPTY_FORM);
      setModalOpen(false);
      loadTickets();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create ticket";
      pushToast({ tone: "error", title: "Error", body: message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!selected) return;
    if (editStatus === "resolved" && !editResolutionNotes.trim() && !selected.resolutionNotes) {
      pushToast({ tone: "error", title: "Validation Error", body: "Resolution notes are required to resolve a ticket." });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/support/tickets/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: editStatus,
          priority: editPriority,
          assignedToId: editAssignedToId || null,
          resolutionNotes: editResolutionNotes || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update ticket");
      pushToast({ tone: "success", title: "Ticket Updated", body: "Support ticket details have been updated." });
      setSelected(null);
      loadTickets();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update ticket";
      pushToast({ tone: "error", title: "Error", body: message });
    } finally {
      setBusy(false);
    }
  };

  const staffName = (id: string | null) => {
    if (!id) return "Unassigned";
    return staff.find((u) => u.id === id)?.name ?? "Unknown Staff";
  };

  // Filter tickets based on active tab
  const filteredTickets = tickets.filter((t) => {
    if (activeTab === "open") return t.status === "open";
    if (activeTab === "in_progress") return t.status === "in_progress";
    return t.status === "resolved" || t.status === "closed";
  });

  const openCount = tickets.filter((t) => t.status === "open").length;
  const inProgressCount = tickets.filter((t) => t.status === "in_progress").length;
  const resolvedCount = tickets.filter((t) => t.status === "resolved" || t.status === "closed").length;

  return (
    <PageTransition className="mx-auto flex max-w-[98rem] flex-col gap-4">
      <BoardHeader
        eyebrow={<Badge tone="warning">Technical Support</Badge>}
        title="Support Tickets"
        description="ERP system administration support requests. Staff difficulty tickets are consolidated here for GM/CEO triage."
        actions={
          <Button size="sm" onClick={() => setModalOpen(true)}>
            <IconPlus size={14} /> File Ticket
          </Button>
        }
      />

      <div className="gsap-stagger grid grid-cols-2 gap-3 md:grid-cols-3">
        <KpiCard icon={IconInbox} label="Open Tickets" value={String(openCount)} tone={openCount > 0 ? "warning" : "neutral"} />
        <KpiCard icon={IconClock} label="In Progress" value={String(inProgressCount)} tone="data" />
        <KpiCard icon={IconCheck} label="Resolved & Closed" value={String(resolvedCount)} tone="success" />
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
              className="body-sm px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 text-slate-500 hover:text-slate-900 hover:bg-white/45"
            >
              <IconAlertTriangle size={14} />
              <span>Complaints</span>
            </Link>
            <Link
              href="/admin/support"
              className="body-sm px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 bg-[#151936] text-white shadow-sm"
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
        ) : filteredTickets.length === 0 ? (
          <EmptyState
            icon={IconLifebuoy}
            title="All clear"
            description="No tickets in this view right now."
            action="File Ticket"
            onClick={() => setModalOpen(true)}
          />
        ) : (
          <div className="space-y-2.5">
            {filteredTickets.map((t) => {
              const catMeta = CATEGORY_META[t.category];
              const prioMeta = PRIORITY_META[t.priority];
              return (
                <div
                  key={t.id}
                  onClick={() => {
                    setSelected(t);
                    setEditStatus(t.status);
                    setEditPriority(t.priority);
                    setEditAssignedToId(t.assignedToId || "");
                    setEditResolutionNotes(t.resolutionNotes || "");
                  }}
                  className="flex items-start gap-4 rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm hover:shadow-md hover:border-slate-300 transition-all cursor-pointer"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-body-primary text-slate-900 truncate">{t.subject}</h4>
                      <span className="text-meta-muted whitespace-nowrap">{new Date(t.createdAt).toLocaleDateString("en-KE")}</span>
                    </div>
                    <p className="text-body-regular text-slate-500 mt-0.5 line-clamp-1">{t.description}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <Badge tone={catMeta.tone}>{catMeta.label}</Badge>
                      <Badge tone={prioMeta.tone}>{prioMeta.label} Priority</Badge>
                      <Badge tone="neutral">Assignee: {staffName(t.assignedToId)}</Badge>
                      {t.status === "in_progress" && <Badge tone="warning">In Progress</Badge>}
                      {t.status === "resolved" && <Badge tone="success">Resolved</Badge>}
                      {t.status === "closed" && <Badge tone="neutral">Closed</Badge>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </BoardPanel>

      {/* File Ticket Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="File Support Ticket" description="File a technical issue or request help with the ERP portal" size="md">
        <div className="space-y-4">
          <div>
            <label className="label-caps text-slate-500 mb-1.5 block">Subject</label>
            <input
              className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-base text-slate-800 focus:outline-none focus:border-[#151936]/40 transition-colors"
              value={form.subject}
              onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
              placeholder="Brief summary of the issue"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label-caps text-slate-500 mb-1.5 block">Category</label>
              <select
                className="w-full h-10 rounded-lg border border-slate-200 bg-white px-2 text-base text-slate-800 focus:outline-none focus:border-[#151936]/40 transition-colors"
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as TicketCategory }))}
              >
                <option value="technical">Technical Support</option>
                <option value="access">Access & Auth</option>
                <option value="data">Data Discrepancy</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="label-caps text-slate-500 mb-1.5 block">Priority</label>
              <select
                className="w-full h-10 rounded-lg border border-slate-200 bg-white px-2 text-base text-slate-800 focus:outline-none focus:border-[#151936]/40 transition-colors"
                value={form.priority}
                onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value as TicketPriority }))}
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label-caps text-slate-500 mb-1.5 block">Description</label>
            <textarea
              rows={4}
              className="w-full rounded-lg border border-slate-200 bg-white p-3 text-base text-slate-800 focus:outline-none focus:border-[#151936]/40 transition-colors resize-none"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Provide context or step-by-step description of the issue..."
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={isSaving}>
              {isSaving ? "Filing..." : "File Ticket"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Ticket Details / Triage Drawer/Modal */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title="Manage Support Ticket" description="Triage and update support ticket details" size="lg">
        {selected && (
          <div className="space-y-5">
            <div className="rounded-xl bg-slate-50 p-4 space-y-2 border border-slate-100">
              <div className="flex items-center justify-between gap-4">
                <span className="label-caps text-slate-400">Ticket Subject</span>
                <span className="text-meta-muted">{new Date(selected.createdAt).toLocaleString("en-KE")}</span>
              </div>
              <h3 className="text-title-primary text-slate-900">{selected.subject}</h3>
              <p className="text-body-regular text-slate-600 whitespace-pre-line pt-2">{selected.description}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label-caps text-slate-500 mb-1.5 block">Status</label>
                <select
                  className="w-full h-10 rounded-lg border border-slate-200 bg-white px-2 text-base text-slate-800 focus:outline-none focus:border-[#151936]/40 transition-colors"
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as TicketStatus)}
                >
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </select>
              </div>

              <div>
                <label className="label-caps text-slate-500 mb-1.5 block">Priority</label>
                <select
                  className="w-full h-10 rounded-lg border border-slate-200 bg-white px-2 text-base text-slate-800 focus:outline-none focus:border-[#151936]/40 transition-colors"
                  value={editPriority}
                  onChange={(e) => setEditPriority(e.target.value as TicketPriority)}
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="label-caps text-slate-500 mb-1.5 block">Assign To Staff</label>
                <select
                  className="w-full h-10 rounded-lg border border-slate-200 bg-white px-2 text-base text-slate-800 focus:outline-none focus:border-[#151936]/40 transition-colors"
                  value={editAssignedToId}
                  onChange={(e) => setEditAssignedToId(e.target.value)}
                >
                  <option value="">-- Unassigned --</option>
                  {staff.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="label-caps text-slate-500 mb-1.5 block">
                Resolution Notes {editStatus === "resolved" && <span className="text-rose-600">*</span>}
              </label>
              <textarea
                rows={3}
                className="w-full rounded-lg border border-slate-200 bg-white p-3 text-base text-slate-800 focus:outline-none focus:border-[#151936]/40 transition-colors resize-none"
                value={editResolutionNotes}
                onChange={(e) => setEditResolutionNotes(e.target.value)}
                placeholder="Details about how this issue was resolved..."
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button variant="secondary" onClick={() => setSelected(null)} disabled={busy}>
                Close
              </Button>
              <Button onClick={handleUpdate} disabled={busy}>
                {busy ? "Updating..." : "Save Changes"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </PageTransition>
  );
}
