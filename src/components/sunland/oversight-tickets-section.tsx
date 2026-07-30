"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  IconAlertTriangle,
  IconCheck,
  IconCircleCheck,
  IconClock,
  IconLifebuoy,
  IconMessageReply,
  IconPlus,
  IconProgress,
} from "@tabler/icons-react";
import { Avatar, Button, Drawer, Modal, SkeletonBlock } from "@/components/ui/erp-primitives";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast-provider";
import { cn } from "@/lib/utils/cn";
import { SLA_STATE_META } from "./maintenance-constants";
import {
  TICKET_CHANNEL_META,
  TICKET_PRIORITY_META,
  TICKET_SLA_DEFAULT_HOURS,
  TICKET_STATUS_META,
  ticketSlaFor,
  type TicketChannel,
  type TicketPriority,
  type TicketStatus,
} from "./oversight-constants";

interface TicketRow {
  id: string;
  entityId: string;
  raisedById: string;
  category: string;
  subject: string;
  description: string;
  priority: TicketPriority;
  status: TicketStatus;
  channel: TicketChannel;
  assignedToId: string | null;
  firstRespondedAt: string | null;
  resolutionNotes: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

interface TicketMessage {
  id: string;
  authorId: string;
  authorName: string;
  body: string;
  isInternal: boolean;
  createdAt: string;
}

interface StaffUser { id: string; name: string; avatarUrl: string | null }

type Filter = "open" | "in_progress" | "breached" | "resolved" | "all";

function initialsOf(name: string) {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p[1]?.[0] ?? "")).toUpperCase() || "?";
}

function ageLabel(iso: string): string {
  const hrs = Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000);
  if (hrs < 1) return "<1h";
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

export function TicketsSection({ entityId, onChanged }: { entityId: string; onChanged: () => void }) {
  const { pushToast } = useToast();
  const [rows, setRows] = useState<TicketRow[]>([]);
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("open");
  const [newOpen, setNewOpen] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/support/tickets?entityId=${entityId}&scope=all`)
      .then((r) => r.json())
      .then((d) => setRows(Array.isArray(d.tickets) ? d.tickets : Array.isArray(d) ? d : []))
      .catch(() => pushToast({ tone: "error", title: "Couldn't load tickets", body: "Try again." }))
      .finally(() => setLoading(false));
  }, [entityId, pushToast]);

  useEffect(() => {
    Promise.resolve().then(() => {
      load();
      fetch("/api/identity/users?entityId=group")
        .then((r) => r.json())
        .then((d) => { if (Array.isArray(d.users)) setStaff(d.users); })
        .catch(() => { });
    });
  }, [load]);

  const staffById = useMemo(() => new Map(staff.map((s) => [s.id, s])), [staff]);

  /** Real SLA derivation - the same computation the service uses for the pulse. */
  const slaOf = useCallback((t: TicketRow) => ticketSlaFor({
    priority: t.priority,
    createdAt: t.createdAt,
    firstRespondedAt: t.firstRespondedAt,
    resolvedAt: t.resolvedAt,
    targetHours: TICKET_SLA_DEFAULT_HOURS[t.priority],
  }), []);

  const counts = useMemo(() => ({
    open: rows.filter((t) => t.status === "open").length,
    in_progress: rows.filter((t) => t.status === "in_progress").length,
    breached: rows.filter((t) => (t.status === "open" || t.status === "in_progress") && slaOf(t).state === "breached").length,
    resolved: rows.filter((t) => t.status === "resolved" || t.status === "closed").length,
    all: rows.length,
  }), [rows, slaOf]);

  const visible = useMemo(() => {
    switch (filter) {
      case "open": return rows.filter((t) => t.status === "open");
      case "in_progress": return rows.filter((t) => t.status === "in_progress");
      case "breached": return rows.filter((t) => (t.status === "open" || t.status === "in_progress") && slaOf(t).state === "breached");
      case "resolved": return rows.filter((t) => t.status === "resolved" || t.status === "closed");
      default: return rows;
    }
  }, [rows, filter, slaOf]);

  const stats = [
    { label: "Open", value: counts.open, icon: IconLifebuoy, tone: "text-amber-600 bg-amber-50" },
    { label: "In progress", value: counts.in_progress, icon: IconProgress, tone: "text-indigo-600 bg-indigo-50" },
    { label: "SLA breached", value: counts.breached, icon: IconAlertTriangle, tone: "text-rose-600 bg-rose-50" },
    { label: "Resolved", value: counts.resolved, icon: IconCircleCheck, tone: "text-emerald-600 bg-emerald-50" },
  ];

  const resolve = async (t: TicketRow) => {
    const notes = t.resolutionNotes ?? "Resolved from the Oversight Console.";
    try {
      const res = await fetch(`/api/support/tickets/${t.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "resolved", resolutionNotes: notes }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Could not resolve");
      pushToast({ tone: "success", title: "Ticket resolved", body: t.subject });
      load();
      onChanged();
    } catch (err) {
      pushToast({ tone: "error", title: "Couldn't resolve", body: err instanceof Error ? err.message : "Try again." });
    }
  };

  return (
    <div className="flex flex-col gap-3.5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        {stats.map((s) => (
          <div key={s.label} className="flex items-center gap-3 bg-white border border-slate-100 rounded-2xl px-4 py-3.5 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
            <span className={cn("size-9 rounded-xl flex items-center justify-center shrink-0", s.tone)}>
              <s.icon size={18} />
            </span>
            <div>
              <p className="font-mono font-medium text-xl text-slate-900 leading-none">{s.value}</p>
              <p className="text-xs text-slate-400 mt-1">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2.5 flex-wrap">
        <div className="flex gap-1.5 flex-wrap">
          {([
            ["open", "Open", counts.open],
            ["in_progress", "In progress", counts.in_progress],
            ["breached", "SLA breached", counts.breached],
            ["resolved", "Resolved", counts.resolved],
            ["all", "All", counts.all],
          ] as Array<[Filter, string, number]>).map(([key, label, count]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
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
        <Button size="sm" className="ml-auto" onClick={() => setNewOpen(true)}>
          <IconPlus size={14} /> Log ticket
        </Button>
      </div>

      {loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, i) => <SkeletonBlock key={i} className="h-16 w-full rounded-2xl" />)}
        </div>
      ) : visible.length === 0 ? (
        <div className="bg-white border border-slate-100 rounded-3xl p-8">
          <EmptyState
            icon={IconCircleCheck}
            title="Nothing in this queue"
            description="Support tickets filed from any portal land here."
            action="Log ticket"
            onClick={() => setNewOpen(true)}
          />
        </div>
      ) : (
        <div className="bg-white border border-slate-100 rounded-3xl shadow-[0_8px_30px_rgba(0,0,0,0.04)] overflow-hidden">
          {/* Desktop table */}
          <div className="hidden lg:grid grid-cols-[1.9fr_0.7fr_0.7fr_0.9fr_0.5fr_auto] gap-3 px-5 py-3 border-b border-slate-100">
            {["Ticket", "Priority", "Channel", "Assignee", "Age", ""].map((h, i) => (
              <span key={i} className="label-caps text-slate-400">{h}</span>
            ))}
          </div>

          {visible.map((t) => {
            const prio = TICKET_PRIORITY_META[t.priority] ?? TICKET_PRIORITY_META.normal;
            const st = TICKET_STATUS_META[t.status] ?? TICKET_STATUS_META.open;
            const chan = TICKET_CHANNEL_META[t.channel] ?? TICKET_CHANNEL_META.portal;
            const sla = slaOf(t);
            const assignee = t.assignedToId ? staffById.get(t.assignedToId) : null;
            const breached = sla.state === "breached" && (t.status === "open" || t.status === "in_progress");

            return (
              <div
                key={t.id}
                className="grid grid-cols-1 lg:grid-cols-[1.9fr_0.7fr_0.7fr_0.9fr_0.5fr_auto] gap-3 px-5 py-3.5 border-b border-slate-50 items-center hover:bg-slate-50/60 transition-colors"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xxs text-slate-400">TKT-{t.id.slice(0, 6).toUpperCase()}</span>
                    {breached && <span className="size-1.5 rounded-full bg-rose-500" title="SLA breached" />}
                    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xxs font-medium", st.pill)}>{st.label}</span>
                  </div>
                  <p className="text-sm font-medium text-slate-900 truncate mt-0.5">{t.subject}</p>
                  <p className={cn("text-xs mt-0.5", breached ? "text-rose-600" : "text-slate-400")}>
                    {t.firstRespondedAt
                      ? `First reply in ${Math.round(sla.hoursElapsed)}h · ${SLA_STATE_META[sla.state].label}`
                      : `No reply yet · ${SLA_STATE_META[sla.state].label}`}
                  </p>
                </div>

                <span className={cn("inline-flex w-fit rounded-full px-2 py-0.5 text-xxs font-medium uppercase tracking-wide", prio.pill)}>
                  {prio.label}
                </span>

                <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                  <chan.icon size={14} className="text-slate-400" /> {chan.label}
                </span>

                <span className="inline-flex items-center gap-2 min-w-0">
                  {assignee ? (
                    <>
                      <Avatar src={assignee.avatarUrl ?? undefined} fallback={initialsOf(assignee.name)} className="size-6 rounded-full shrink-0" />
                      <span className="text-xs text-slate-600 truncate">{assignee.name}</span>
                    </>
                  ) : (
                    <span className="text-xs text-slate-400">Unassigned</span>
                  )}
                </span>

                <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                  <IconClock size={12} /> {ageLabel(t.createdAt)}
                </span>

                <div className="flex gap-1.5 shrink-0">
                  <button
                    onClick={() => setThreadId(t.id)}
                    aria-label="Reply"
                    className="size-8 rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 flex items-center justify-center"
                  >
                    <IconMessageReply size={14} />
                  </button>
                  {t.status !== "resolved" && t.status !== "closed" && (
                    <button
                      onClick={() => resolve(t)}
                      aria-label="Resolve"
                      className="size-8 rounded-lg border border-slate-200 bg-white text-emerald-600 hover:bg-emerald-50 flex items-center justify-center"
                    >
                      <IconCheck size={14} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {newOpen && (
        <NewTicketModal
          entityId={entityId}
          onClose={() => setNewOpen(false)}
          onCreated={() => { setNewOpen(false); load(); onChanged(); }}
        />
      )}

      {threadId && (
        <TicketThread
          ticket={rows.find((t) => t.id === threadId)!}
          onClose={() => setThreadId(null)}
          onReplied={() => { load(); onChanged(); }}
        />
      )}
    </div>
  );
}

/** The real reply thread. The first staff reply stamps firstRespondedAt server-side. */
function TicketThread({
  ticket, onClose, onReplied,
}: {
  ticket: TicketRow;
  onClose: () => void;
  onReplied: () => void;
}) {
  const { pushToast } = useToast();
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [body, setBody] = useState("");
  const [internal, setInternal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    fetch(`/api/support/tickets/${ticket.id}/messages`)
      .then((r) => r.json())
      .then((d) => setMessages(Array.isArray(d.messages) ? d.messages : []))
      .catch(() => { })
      .finally(() => setLoading(false));
  }, [ticket.id]);

  useEffect(() => {
    Promise.resolve().then(load);
  }, [load]);

  const send = async () => {
    if (!body.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/support/tickets/${ticket.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: body.trim(), isInternal: internal }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Could not send");
      setBody("");
      load();
      onReplied();
      pushToast({
        tone: "success",
        title: internal ? "Internal note added" : "Reply sent",
        body: internal ? "Visible to support staff only." : "The filer has been notified.",
      });
    } catch (err) {
      pushToast({ tone: "error", title: "Couldn't send", body: err instanceof Error ? err.message : "Try again." });
    } finally {
      setBusy(false);
    }
  };

  const prio = TICKET_PRIORITY_META[ticket.priority] ?? TICKET_PRIORITY_META.normal;

  return (
    <Drawer
      open
      onClose={onClose}
      title={ticket.subject}
      width="30rem"
      footer={
        <div className="flex flex-col gap-2.5">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            placeholder={internal ? "Internal note — the filer will not see this…" : "Write a reply…"}
            className="w-full box-border resize-none border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-[#151936]/40 transition-colors"
          />
          <div className="flex items-center justify-between gap-2">
            <label className="inline-flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
              <input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} className="size-4 rounded accent-[#151936]" />
              Internal note
            </label>
            <Button size="sm" onClick={send} disabled={busy || !body.trim()}>{busy ? "Sending…" : "Send"}</Button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-xs text-slate-400">TKT-{ticket.id.slice(0, 6).toUpperCase()}</span>
          <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xxs font-medium uppercase tracking-wide", prio.pill)}>{prio.label}</span>
          <span className="text-xs text-slate-400 capitalize">{ticket.category} · {ticket.channel}</span>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-[#fafbf8] px-3.5 py-3">
          <p className="label-caps text-slate-400 mb-1">Original report</p>
          <p className="text-sm text-slate-700 leading-relaxed">{ticket.description}</p>
        </div>

        <div>
          <p className="label-caps text-slate-400 mb-2">Thread</p>
          {loading ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 2 }).map((_, i) => <SkeletonBlock key={i} className="h-14 w-full rounded-xl" />)}
            </div>
          ) : messages.length === 0 ? (
            <p className="text-xs text-slate-400">No replies yet. The first staff reply starts the SLA response clock.</p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={cn(
                    "rounded-xl border px-3.5 py-2.5",
                    m.isInternal ? "border-amber-200 bg-amber-50/60" : "border-slate-100 bg-white",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-slate-800">{m.authorName}</span>
                    <span className="font-mono text-xxs text-slate-400">
                      {new Date(m.createdAt).toLocaleString("en-KE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false })}
                    </span>
                  </div>
                  {m.isInternal && (
                    <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xxs font-medium uppercase tracking-wide text-amber-700 mt-1">
                      Internal
                    </span>
                  )}
                  <p className="text-sm text-slate-700 mt-1 leading-relaxed">{m.body}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Drawer>
  );
}

function NewTicketModal({
  entityId, onClose, onCreated,
}: {
  entityId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { pushToast } = useToast();
  const [form, setForm] = useState({
    subject: "", description: "", category: "technical",
    priority: "normal" as TicketPriority, channel: "portal" as TicketChannel,
  });
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!form.subject.trim() || !form.description.trim()) {
      pushToast({ tone: "warning", title: "Missing details", body: "A subject and description are required." });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/support/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityId, ...form, subject: form.subject.trim(), description: form.description.trim() }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Could not log the ticket");
      pushToast({ tone: "success", title: "Ticket logged", body: form.subject.trim() });
      onCreated();
    } catch (err) {
      pushToast({ tone: "error", title: "Couldn't log ticket", body: err instanceof Error ? err.message : "Try again." });
    } finally {
      setBusy(false);
    }
  };

  const field = "w-full box-border border border-slate-200 rounded-lg h-10 px-3 text-sm text-slate-800 outline-none focus:border-[#151936]/40 transition-colors";

  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      title="Log a support ticket"
      description="Record a difficulty raised through any channel — the channel you pick is stored as real provenance."
    >
      <div className="flex flex-col gap-3.5">
        <div>
          <label className="label-caps text-slate-400 mb-1.5 block">Subject</label>
          <input className={field} value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} autoFocus />
        </div>
        <div>
          <label className="label-caps text-slate-400 mb-1.5 block">What happened</label>
          <textarea
            className="w-full box-border border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 resize-none h-24 outline-none focus:border-[#151936]/40 transition-colors"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label-caps text-slate-400 mb-1.5 block">Category</label>
            <select className={cn(field, "bg-white")} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {["technical", "access", "data", "other"].map((c) => <option key={c} value={c} className="capitalize">{c}</option>)}
            </select>
          </div>
          <div>
            <label className="label-caps text-slate-400 mb-1.5 block">Channel</label>
            <select className={cn(field, "bg-white")} value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value as TicketChannel })}>
              {(Object.keys(TICKET_CHANNEL_META) as TicketChannel[]).map((c) => (
                <option key={c} value={c}>{TICKET_CHANNEL_META[c].label}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="label-caps text-slate-400 mb-1.5 block">Priority</label>
          <div className="flex gap-1.5 flex-wrap">
            {(Object.keys(TICKET_PRIORITY_META) as TicketPriority[]).map((p) => (
              <button
                key={p}
                onClick={() => setForm({ ...form, priority: p })}
                aria-pressed={form.priority === p}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  form.priority === p ? "bg-[#151936] text-white border-[#151936]" : "bg-white text-slate-600 border-slate-200 hover:border-slate-300",
                )}
              >{TICKET_PRIORITY_META[p].label}</button>
            ))}
          </div>
          <p className="text-xs text-slate-400 mt-1.5">
            First-response target: {TICKET_SLA_DEFAULT_HOURS[form.priority]}h.
          </p>
        </div>
        <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
          <Button variant="secondary" size="sm" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button size="sm" onClick={submit} disabled={busy}>{busy ? "Logging…" : "Log ticket"}</Button>
        </div>
      </div>
    </Modal>
  );
}
