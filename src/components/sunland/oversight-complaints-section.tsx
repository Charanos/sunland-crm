"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  IconAlertTriangle,
  IconBuildingEstate,
  IconCheck,
  IconCircleCheck,
  IconClock,
  IconFlame,
  IconSearch,
  IconShieldLock,
  IconUser,
} from "@tabler/icons-react";
import { Button, DropdownItem, DropdownMenu, Modal, SkeletonBlock } from "@/components/ui/erp-primitives";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast-provider";
import { cn } from "@/lib/utils/cn";
import {
  COMPLAINT_CATEGORY_META,
  COMPLAINT_OWNER_LABEL,
  COMPLAINT_STATUS_META,
  type ComplaintCategory,
  type ComplaintStatus,
} from "./oversight-constants";

interface ComplaintRow {
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
  createdAt: string;
}

type Tab = "my-queue" | "escalated" | "resolved";

const TABS: Array<{ key: Tab; label: string }> = [
  { key: "my-queue", label: "Open" },
  { key: "escalated", label: "Escalated" },
  { key: "resolved", label: "Resolved" },
];

function ageLabel(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days < 1) return "today";
  return days === 1 ? "1 day" : `${days} days`;
}

export function ComplaintsSection({ entityId, onChanged }: { entityId: string; onChanged: () => void }) {
  const { pushToast } = useToast();
  const [tab, setTab] = useState<Tab>("my-queue");
  const [rows, setRows] = useState<Record<Tab, ComplaintRow[]>>({ "my-queue": [], escalated: [], resolved: [] });
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [escalateTarget, setEscalateTarget] = useState<ComplaintRow | null>(null);
  const [resolveTarget, setResolveTarget] = useState<ComplaintRow | null>(null);

  /**
   * All three tabs are loaded together so the filter chips can show real
   * counts. The service tier-scopes each list, so this never widens what the
   * caller is allowed to see (HR spec §6.4).
   */
  const load = useCallback(() => {
    setLoading(true);
    Promise.all(
      TABS.map((t) =>
        fetch(`/api/hr/complaints?entityId=${entityId}&tab=${t.key}`)
          .then((r) => r.json())
          .then((d) => [t.key, Array.isArray(d.complaints) ? d.complaints : []] as const)
          .catch(() => [t.key, []] as const),
      ),
    )
      .then((pairs) => setRows(Object.fromEntries(pairs) as Record<Tab, ComplaintRow[]>))
      .finally(() => setLoading(false));
  }, [entityId]);

  useEffect(() => {
    Promise.resolve().then(load);
  }, [load]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = rows[tab] ?? [];
    if (!q) return list;
    return list.filter((c) => [c.subject, c.category, c.id].some((v) => (v ?? "").toLowerCase().includes(q)));
  }, [rows, tab, query]);

  const stats = useMemo(() => {
    const all = [...rows["my-queue"], ...rows.escalated, ...rows.resolved];
    return [
      { label: "Open", value: rows["my-queue"].length, icon: IconAlertTriangle, tone: "text-amber-600 bg-amber-50" },
      { label: "Escalated", value: rows.escalated.length, icon: IconFlame, tone: "text-rose-600 bg-rose-50" },
      { label: "Resolved", value: rows.resolved.length, icon: IconCircleCheck, tone: "text-emerald-600 bg-emerald-50" },
      { label: "Total cases", value: all.length, icon: IconShieldLock, tone: "text-slate-600 bg-slate-100" },
    ];
  }, [rows]);

  const act = async (row: ComplaintRow, path: string, body: Record<string, unknown>, successTitle: string) => {
    try {
      const res = await fetch(`/api/hr/complaints/${row.id}/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Action failed");
      pushToast({ tone: "success", title: successTitle, body: row.subject });
      load();
      onChanged();
    } catch (err) {
      pushToast({ tone: "error", title: "Couldn't complete", body: err instanceof Error ? err.message : "Try again." });
    }
  };

  return (
    <div className="flex flex-col gap-3.5">
      {/* Confidentiality note - this queue is genuinely need-to-know */}
      <div className="flex items-center gap-2.5 rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
        <span className="size-9 rounded-xl bg-[rgba(124,58,237,0.1)] text-[#7c3aed] flex items-center justify-center shrink-0">
          <IconShieldLock size={18} />
        </span>
        <p className="text-xs text-slate-500 leading-relaxed">
          Confidential. You only see cases currently routed to your tier, and anonymous filers stay masked —
          enforced in the service, not in this view.
        </p>
      </div>

      {/* Stats */}
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

      {/* Toolbar */}
      <div className="flex items-center gap-2.5 flex-wrap">
        <div className="flex gap-1.5 flex-wrap">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              aria-pressed={tab === t.key}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                tab === t.key ? "bg-[#151936] text-white border-[#151936]" : "bg-white text-slate-500 border-slate-200 hover:border-slate-300",
              )}
            >
              {t.label}
              <span className={cn(
                "font-mono text-xxs rounded-full px-1.5",
                tab === t.key ? "bg-[#f3df27] text-[#151936]" : "bg-slate-100 text-slate-500",
              )}>{rows[t.key].length}</span>
            </button>
          ))}
        </div>
        <div className="relative ml-auto w-full sm:w-64">
          <IconSearch size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search complaints…"
            aria-label="Search complaints"
            className="w-full box-border bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-sm text-slate-800 outline-none focus:border-[#151936]/30 transition-colors"
          />
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonBlock key={i} className="h-20 w-full rounded-2xl" />)}
        </div>
      ) : visible.length === 0 ? (
        <div className="bg-white border border-slate-100 rounded-3xl p-8">
          <EmptyState
            icon={IconCircleCheck}
            title={query ? "No complaints match" : "Nothing in this queue"}
            description={query ? "Try a different search term." : "Cases routed to your tier will appear here."}
            action={query ? "Clear search" : "Refresh"}
            onClick={() => (query ? setQuery("") : load())}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {visible.map((c) => {
            const cat = COMPLAINT_CATEGORY_META[c.category] ?? COMPLAINT_CATEGORY_META.other;
            const st = COMPLAINT_STATUS_META[c.status] ?? COMPLAINT_STATUS_META.open;
            return (
              <div key={c.id} className="flex items-start gap-3 bg-white border border-slate-100 rounded-2xl p-4 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
                <span className={cn("w-1 self-stretch rounded-full shrink-0", st.dot)} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xxs text-slate-400">CMP-{c.id.slice(0, 6).toUpperCase()}</span>
                    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xxs font-medium uppercase tracking-wide", cat.pill)}>
                      {cat.label}
                    </span>
                    {c.status === "escalated" && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-xxs font-medium uppercase tracking-wide text-rose-700">
                        <IconFlame size={9} /> Escalated
                      </span>
                    )}
                  </div>

                  <p className="text-sm font-medium text-slate-900 mt-1.5">{c.subject}</p>

                  <div className="flex items-center gap-3 mt-1.5 flex-wrap text-xs text-slate-400">
                    <span className="inline-flex items-center gap-1">
                      <IconUser size={12} /> {c.isAnonymous || !c.filedById ? "Anonymous filer" : "Named filer"}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <IconBuildingEstate size={12} /> {COMPLAINT_OWNER_LABEL[c.currentOwnerRole] ?? c.currentOwnerRole}
                    </span>
                    <span className="inline-flex items-center gap-1"><IconClock size={12} /> {ageLabel(c.createdAt)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xxs font-medium", st.pill)}>
                    <span className={cn("size-1.5 rounded-full", st.dot)} />
                    {st.label}
                  </span>
                  {c.status !== "resolved" && (
                    <DropdownMenu
                      label="Manage complaint"
                      align="right"
                      trigger={
                        <div className="size-8 rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 flex items-center justify-center">
                          <IconCheck size={15} />
                        </div>
                      }
                    >
                      {c.status === "open" && (
                        <DropdownItem onClick={() => setEscalateTarget(c)}>Escalate case</DropdownItem>
                      )}
                      <DropdownItem onClick={() => setResolveTarget(c)}>Resolve case</DropdownItem>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {escalateTarget && (
        <ReasonModal
          title="Escalate this complaint"
          description="It moves to the next tier, who are notified. The reason is recorded on the case."
          label="Escalation reason"
          confirmLabel="Escalate"
          onClose={() => setEscalateTarget(null)}
          onSubmit={(reason) => {
            act(escalateTarget, "escalate", { reason }, "Complaint escalated");
            setEscalateTarget(null);
          }}
        />
      )}

      {resolveTarget && (
        <ReasonModal
          title="Resolve this complaint"
          description="A resolution summary is required and stays on the permanent case record."
          label="Resolution summary"
          confirmLabel="Resolve case"
          onClose={() => setResolveTarget(null)}
          onSubmit={(summary) => {
            act(resolveTarget, "resolve", { resolutionSummary: summary }, "Complaint resolved");
            setResolveTarget(null);
          }}
        />
      )}
    </div>
  );
}

function ReasonModal({
  title, description, label, confirmLabel, onClose, onSubmit,
}: {
  title: string;
  description: string;
  label: string;
  confirmLabel: string;
  onClose: () => void;
  onSubmit: (value: string) => void;
}) {
  const [value, setValue] = useState("");
  return (
    <Modal open onClose={onClose} size="sm" title={title} description={description}>
      <div className="flex flex-col gap-3">
        <div>
          <label className="label-caps text-slate-400 mb-1.5 block">{label}</label>
          <textarea
            className="w-full box-border border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 resize-none h-24 outline-none focus:border-[#151936]/40 transition-colors"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoFocus
          />
        </div>
        <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
          <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={() => onSubmit(value.trim())} disabled={!value.trim()}>{confirmLabel}</Button>
        </div>
      </div>
    </Modal>
  );
}
