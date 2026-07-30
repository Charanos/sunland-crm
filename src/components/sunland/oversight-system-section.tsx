"use client";

import { useCallback, useEffect, useState } from "react";
import {
  IconAlertTriangle,
  IconCpu,
  IconDatabaseCog,
  IconHeartbeat,
  IconHistory,
  IconPlayerPlay,
  IconPlugConnected,
  IconRefresh,
  IconRestore,
  IconTool,
} from "@tabler/icons-react";
import { Button, ConfirmDialog, Modal, SkeletonBlock } from "@/components/ui/erp-primitives";
import { useToast } from "@/components/ui/toast-provider";
import { cn } from "@/lib/utils/cn";
import { Toggle, relativeTime, toneForAction } from "./account-ui";
import {
  HEALTH_STATUS_META,
  JOB_REGISTRY,
  NO_SCHEDULER_NOTE,
  type ServiceHealthStatus,
} from "./oversight-constants";

interface ServiceHealth {
  key: string;
  name: string;
  note: string;
  status: ServiceHealthStatus | null;
  latencyMs: number | null;
  detail: string | null;
  checkedAt: string | null;
  bars: Array<{ day: string; status: ServiceHealthStatus | null }>;
  measuredDays: number;
  uptimePct: number | null;
}

interface JobRow {
  key: string;
  name: string;
  desc: string;
  lastStatus: "running" | "success" | "failed" | null;
  lastRunAt: string | null;
  lastSummary: string | null;
  lastError: string | null;
  durationMs: number | null;
  runCount: number;
}

interface AuditRow {
  id: string;
  actorName: string | null;
  action: string;
  summary: string;
  createdAt: string;
}

interface Integration { key: string; name: string; kind: string; status: string; meta: string }

/** A recorded day renders in its status colour; an unmeasured day stays grey. */
function barColor(status: ServiceHealthStatus | null): string {
  if (status === null) return "#e2e8f0";
  return HEALTH_STATUS_META[status].color;
}

export function SystemSection({ entityId, onChanged }: { entityId: string; onChanged: () => void }) {
  const { pushToast } = useToast();
  const [services, setServices] = useState<ServiceHealth[]>([]);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [maintenance, setMaintenance] = useState<{ enabled: boolean; message: string }>({ enabled: false, message: "" });
  const [loading, setLoading] = useState(true);
  const [probing, setProbing] = useState(false);
  const [runningJob, setRunningJob] = useState<string | null>(null);
  const [confirmMaintenance, setConfirmMaintenance] = useState(false);
  const [messageOpen, setMessageOpen] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.allSettled([
      fetch(`/api/system/health?entityId=${entityId}`).then((r) => r.json()).then((d) => setServices(d.services ?? [])),
      fetch(`/api/system/jobs?entityId=${entityId}`).then((r) => r.json()).then((d) => setJobs(d.jobs ?? [])),
      fetch(`/api/system/maintenance?entityId=${entityId}`).then((r) => r.json()).then((d) => { if (d.maintenance) setMaintenance(d.maintenance); }),
      fetch(`/api/account/system-overview?entityId=${entityId}`).then((r) => r.json()).then((d) => {
        setIntegrations(d.integrations?.integrations ?? []);
        setAudit(d.audit ?? []);
      }),
    ]).finally(() => setLoading(false));
  }, [entityId]);

  useEffect(() => {
    Promise.resolve().then(load);
  }, [load]);

  const probe = async () => {
    setProbing(true);
    try {
      const res = await fetch("/api/system/health", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Probe failed");
      setServices(data.services ?? []);
      pushToast({ tone: "success", title: "Health probe complete", body: "The result has been recorded." });
      onChanged();
    } catch (err) {
      pushToast({ tone: "error", title: "Probe failed", body: err instanceof Error ? err.message : "Try again." });
    } finally {
      setProbing(false);
    }
  };

  const runJob = async (jobKey: string, name: string) => {
    setRunningJob(jobKey);
    try {
      const res = await fetch("/api/system/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityId, jobKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Job failed to start");

      const failed = data.run?.status === "failed";
      pushToast({
        tone: failed ? "error" : "success",
        title: failed ? `${name} failed` : `${name} finished`,
        body: failed ? (data.run?.error ?? "See the run record for details.") : (data.run?.summary ?? "Completed."),
      });
      load();
      onChanged();
    } catch (err) {
      pushToast({ tone: "error", title: "Couldn't run job", body: err instanceof Error ? err.message : "Try again." });
    } finally {
      setRunningJob(null);
    }
  };

  const setMaintenanceMode = async (enabled: boolean, message?: string) => {
    try {
      const res = await fetch("/api/system/maintenance", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityId, enabled, message }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Could not change maintenance mode");
      setMaintenance(data.maintenance);
      pushToast({
        tone: enabled ? "warning" : "success",
        title: enabled ? "Maintenance mode ON" : "Maintenance mode OFF",
        body: enabled
          ? "Everyone except super-admins now sees the maintenance notice."
          : "Normal access has been restored for everyone.",
      });
    } catch (err) {
      pushToast({ tone: "error", title: "Couldn't change maintenance mode", body: err instanceof Error ? err.message : "Try again." });
    }
  };

  return (
    <div className="flex flex-col gap-3.5">
      {/* Maintenance mode - a real gate, so it reads like one */}
      <div className={cn(
        "flex items-center gap-3 flex-wrap rounded-2xl border px-4 py-3.5 shadow-[0_8px_30px_rgba(0,0,0,0.04)]",
        maintenance.enabled ? "border-amber-200 bg-amber-50" : "border-slate-100 bg-white",
      )}>
        <span className={cn(
          "size-10 rounded-xl flex items-center justify-center shrink-0",
          maintenance.enabled ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500",
        )}>
          <IconTool size={20} />
        </span>
        <div className="flex-1 min-w-[220px]">
          <p className={cn("text-sm font-medium", maintenance.enabled ? "text-amber-900" : "text-slate-900")}>
            {maintenance.enabled ? "Maintenance mode is ON" : "Maintenance mode is off"}
          </p>
          <p className={cn("text-xs mt-0.5", maintenance.enabled ? "text-amber-700" : "text-slate-400")}>
            {maintenance.enabled
              ? "Everyone except super-admins is being redirected to the maintenance notice. You keep full access."
              : "Turning this on redirects everyone except super-admins to a maintenance notice. You will not be locked out."}
          </p>
        </div>
        <button
          onClick={() => setMessageOpen(true)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 shrink-0"
        >
          Edit notice
        </button>
        <Toggle
          label="Maintenance mode"
          on={maintenance.enabled}
          onClick={() => (maintenance.enabled ? setMaintenanceMode(false) : setConfirmMaintenance(true))}
        />
      </div>

      {/* Service health */}
      <div className="bg-white border border-slate-100 rounded-3xl shadow-[0_8px_30px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <span className="size-9 rounded-xl bg-[rgba(16,185,129,0.12)] text-emerald-600 flex items-center justify-center">
              <IconHeartbeat size={18} />
            </span>
            <div>
              <p className="text-base font-medium text-slate-900">Service health</p>
              <p className="text-xs text-slate-400">Recorded by this app — a day with no probe shows as a gap, not as uptime.</p>
            </div>
          </div>
          <Button size="sm" variant="secondary" onClick={probe} disabled={probing}>
            <IconRefresh size={14} className={probing ? "animate-spin" : undefined} /> {probing ? "Probing…" : "Probe now"}
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 p-5">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => <SkeletonBlock key={i} className="h-32 rounded-2xl" />)
            : services.map((sv) => {
              const meta = sv.status ? HEALTH_STATUS_META[sv.status] : null;
              return (
                <div key={sv.key} className="border border-slate-100 rounded-2xl p-4 bg-[#fcfcfa]">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <p className="text-sm font-medium text-slate-900 truncate">{sv.name}</p>
                    <span className={cn(
                      "inline-flex rounded-full px-2 py-0.5 text-xxs font-medium shrink-0",
                      meta?.pill ?? "bg-slate-100 text-slate-500",
                    )}>
                      {sv.uptimePct !== null ? `${sv.uptimePct}%` : "no data"}
                    </span>
                  </div>

                  <div className="flex gap-[2px] h-6 items-end" aria-hidden>
                    {sv.bars.map((b) => (
                      <span
                        key={b.day}
                        title={`${b.day}: ${b.status ?? "no data recorded"}`}
                        className="flex-1 rounded-[2px]"
                        style={{ background: barColor(b.status), height: b.status === null ? "35%" : "100%" }}
                      />
                    ))}
                  </div>

                  <p className="font-mono text-xxs text-slate-400 mt-2.5">
                    {sv.latencyMs != null ? `${sv.latencyMs}ms · ` : ""}
                    {sv.measuredDays > 0 ? `${sv.measuredDays}d measured` : "never measured"}
                  </p>
                  {sv.detail && <p className="text-xs text-slate-400 mt-1 line-clamp-2">{sv.detail}</p>}
                </div>
              );
            })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 items-start">
        {/* Background jobs */}
        <div className="bg-white border border-slate-100 rounded-3xl shadow-[0_8px_30px_rgba(0,0,0,0.04)] overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
            <span className="size-9 rounded-xl bg-[rgba(42,111,219,0.1)] text-[#2A6FDB] flex items-center justify-center">
              <IconCpu size={18} />
            </span>
            <div>
              <p className="text-base font-medium text-slate-900">Background jobs</p>
              <p className="text-xs text-slate-400">{NO_SCHEDULER_NOTE} — every run below was triggered by a person.</p>
            </div>
          </div>

          <div className="px-5 py-2">
            {loading
              ? Array.from({ length: 3 }).map((_, i) => <SkeletonBlock key={i} className="h-14 w-full rounded-xl my-2" />)
              : JOB_REGISTRY.map((reg) => {
                const job = jobs.find((j) => j.key === reg.key);
                const failed = job?.lastStatus === "failed";
                return (
                  <div key={reg.key} className="flex items-center gap-3 py-3 border-b border-slate-50 last:border-0">
                    <span className={cn(
                      "size-9 rounded-xl flex items-center justify-center shrink-0",
                      failed ? "bg-rose-50 text-rose-600" : "bg-slate-100 text-slate-500",
                    )}>
                      <reg.icon size={17} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900">{reg.name}</p>
                      <p className="font-mono text-xxs text-slate-400 mt-0.5 truncate">
                        {job?.lastRunAt ? `last run ${relativeTime(job.lastRunAt)}` : "never run"}
                        {job?.durationMs != null ? ` · ${job.durationMs}ms` : ""}
                        {job?.runCount ? ` · ${job.runCount} run(s)` : ""}
                      </p>
                      {failed && job?.lastError && (
                        <p className="text-xs text-rose-600 mt-0.5 truncate">{job.lastError}</p>
                      )}
                      {!failed && job?.lastSummary && (
                        <p className="text-xs text-slate-400 mt-0.5 truncate">{job.lastSummary}</p>
                      )}
                    </div>
                    <span className={cn(
                      "inline-flex rounded-full px-2 py-0.5 text-xxs font-medium uppercase tracking-wide shrink-0",
                      job?.lastStatus === "success" ? "bg-emerald-50 text-emerald-700"
                        : failed ? "bg-rose-50 text-rose-700"
                          : "bg-slate-100 text-slate-500",
                    )}>
                      {job?.lastStatus ?? "idle"}
                    </span>
                    <button
                      onClick={() => runJob(reg.key, reg.name)}
                      disabled={runningJob === reg.key}
                      aria-label={`Run ${reg.name} now`}
                      className="size-8 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 flex items-center justify-center disabled:opacity-50 shrink-0"
                    >
                      <IconPlayerPlay size={14} className={runningJob === reg.key ? "animate-pulse" : undefined} />
                    </button>
                  </div>
                );
              })}
          </div>
        </div>

        {/* Integrations */}
        <div className="bg-white border border-slate-100 rounded-3xl shadow-[0_8px_30px_rgba(0,0,0,0.04)] overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
            <span className="size-9 rounded-xl bg-[rgba(16,185,129,0.12)] text-emerald-600 flex items-center justify-center">
              <IconPlugConnected size={18} />
            </span>
            <div>
              <p className="text-base font-medium text-slate-900">Integrations</p>
              <p className="text-xs text-slate-400">Configuration-derived — reflects what is actually wired up.</p>
            </div>
          </div>
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {loading
              ? Array.from({ length: 4 }).map((_, i) => <SkeletonBlock key={i} className="h-20 rounded-2xl" />)
              : integrations.map((ig) => (
                <div key={ig.key} className="border border-slate-100 rounded-2xl p-3.5 bg-[#fcfcfa]">
                  <div className="flex items-center gap-2.5">
                    <span className="size-9 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                      <IconDatabaseCog size={17} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{ig.name}</p>
                      <p className="text-xs text-slate-400">{ig.kind}</p>
                    </div>
                    <span className={cn(
                      "inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize shrink-0",
                      ig.status === "healthy" ? "bg-emerald-50 text-emerald-700"
                        : ig.status === "down" ? "bg-rose-50 text-rose-700"
                          : "bg-slate-100 text-slate-500",
                    )}>{ig.status}</span>
                  </div>
                  <p className="font-mono text-xxs text-slate-400 mt-2 pt-2 border-t border-slate-100">{ig.meta}</p>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* Org audit log */}
      <div className="bg-white border border-slate-100 rounded-3xl shadow-[0_8px_30px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <span className="size-9 rounded-xl bg-[rgba(21,25,54,0.07)] text-[#151936] flex items-center justify-center">
              <IconHistory size={18} />
            </span>
            <div>
              <p className="text-base font-medium text-slate-900">Organisation audit log</p>
              <p className="text-xs text-slate-400">Admin and security events across the org.</p>
            </div>
          </div>
          <a
            href={`/api/audit?entityId=${entityId}&limit=200`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            <IconRestore size={14} /> Export (JSON)
          </a>
        </div>

        <ul className="px-5 py-4 flex flex-col">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => <SkeletonBlock key={i} className="h-10 w-full rounded-lg mb-2" />)
          ) : audit.length === 0 ? (
            <li className="text-sm text-slate-400 text-center py-4">No recent activity.</li>
          ) : audit.map((l, i, arr) => (
            <li key={l.id} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span className={cn("size-[11px] rounded-full mt-0.5 shrink-0 ring-2 ring-white", toneForAction(l.action))} />
                {i !== arr.length - 1 && <span className="w-[1.5px] flex-1 bg-slate-100 my-1" />}
              </div>
              <div className="min-w-0 flex-1 pb-3.5">
                <p className="text-xs text-slate-700">
                  <span className="font-medium text-slate-900">{l.actorName ?? "System"}</span> · {l.summary}
                </p>
                <p className="font-mono text-xxs text-slate-400 mt-0.5">{relativeTime(l.createdAt)}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <ConfirmDialog
        open={confirmMaintenance}
        onClose={() => setConfirmMaintenance(false)}
        onConfirm={() => { setConfirmMaintenance(false); setMaintenanceMode(true); }}
        title="Turn on maintenance mode?"
        description="Everyone except super-admins will immediately be redirected to the maintenance notice and will not be able to use the app. You keep full access, so you can switch it back off from here at any time."
        confirmLabel="Turn on maintenance mode"
        tone="danger"
      />

      {messageOpen && (
        <MaintenanceMessageModal
          initial={maintenance.message}
          onClose={() => setMessageOpen(false)}
          onSave={(msg) => { setMaintenanceMode(maintenance.enabled, msg); setMessageOpen(false); }}
        />
      )}
    </div>
  );
}

function MaintenanceMessageModal({
  initial, onClose, onSave,
}: {
  initial: string;
  onClose: () => void;
  onSave: (message: string) => void;
}) {
  const [message, setMessage] = useState(initial);
  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title="Maintenance notice"
      description="Shown on the maintenance page. Leave it blank to use the default wording."
    >
      <div className="flex flex-col gap-3">
        <textarea
          className="w-full box-border border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 resize-none h-24 outline-none focus:border-[#151936]/40 transition-colors"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="e.g. Scheduled upgrade — back by 14:00 EAT."
          autoFocus
        />
        <div className="flex items-start gap-2 rounded-xl border border-slate-100 bg-[#fafbf8] px-3 py-2.5">
          <IconAlertTriangle size={14} className="text-slate-400 mt-0.5 shrink-0" />
          <p className="text-xs text-slate-500 leading-relaxed">
            Saving the notice does not turn maintenance mode on — use the switch for that.
          </p>
        </div>
        <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
          <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={() => onSave(message)}>Save notice</Button>
        </div>
      </div>
    </Modal>
  );
}
