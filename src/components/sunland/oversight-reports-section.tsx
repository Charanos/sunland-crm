"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  IconCalendarRepeat,
  IconClockHour4,
  IconDownload,
  IconFileAnalytics,
  IconInfoCircle,
  IconPlayerPlay,
  IconShieldCheck,
} from "@tabler/icons-react";
import { Button, SkeletonBlock } from "@/components/ui/erp-primitives";
import { useToast } from "@/components/ui/toast-provider";
import { cn } from "@/lib/utils/cn";
import { CADENCE_LABEL, NO_SCHEDULER_NOTE, REPORT_CATALOG, type ReportCadence } from "./oversight-constants";

interface ScheduleRow {
  id: string;
  reportType: string;
  cadence: ReportCadence;
  recipientIds: string[] | null;
  enabled: boolean;
  lastRunAt: string | null;
}

interface ExportRow {
  id: string;
  reportType: string;
  verificationToken: string;
  generatedByName: string;
  createdAt: string;
}

function when(iso: string | null): string {
  if (!iso) return "never";
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days === 0) return `today ${d.toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit", hour12: false })}`;
  if (days === 1) return "yesterday";
  return d.toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" });
}

export function ReportsSection({ entityId }: { entityId: string }) {
  const { pushToast } = useToast();
  const [schedules, setSchedules] = useState<ScheduleRow[]>([]);
  const [exports, setExports] = useState<ExportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/reports/schedules?entityId=${entityId}`)
      .then((r) => r.json())
      .then((d) => {
        setSchedules(Array.isArray(d.schedules) ? d.schedules : []);
        setExports(Array.isArray(d.exports) ? d.exports : []);
      })
      .catch(() => pushToast({ tone: "error", title: "Couldn't load reports", body: "Try again." }))
      .finally(() => setLoading(false));
  }, [entityId, pushToast]);

  useEffect(() => {
    Promise.resolve().then(load);
  }, [load]);

  /** Real generation - produces a QR-verifiable report_exports row. */
  const generate = async (reportType: string) => {
    setBusy(reportType);
    try {
      const now = new Date();
      const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const res = await fetch("/api/finance/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityId, reportType, periodStart, periodEnd: now.toISOString() }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Generation failed");
      pushToast({
        tone: "success",
        title: "Report generated",
        body: "A verifiable export was added to the library.",
      });
      load();
    } catch (err) {
      pushToast({ tone: "error", title: "Couldn't generate", body: err instanceof Error ? err.message : "Try again." });
    } finally {
      setBusy(null);
    }
  };

  const saveSchedule = async (reportType: string, patch: Partial<ScheduleRow>) => {
    const existing = schedules.find((s) => s.reportType === reportType);
    try {
      const res = await fetch("/api/reports/schedules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityId,
          reportType,
          cadence: patch.cadence ?? existing?.cadence ?? "monthly",
          recipientIds: existing?.recipientIds ?? [],
          enabled: patch.enabled !== undefined ? patch.enabled : (existing?.enabled ?? true),
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Could not save");
      load();
    } catch (err) {
      pushToast({ tone: "warning", title: "Couldn't save schedule", body: err instanceof Error ? err.message : "Try again." });
    }
  };

  const runNow = async (schedule: ScheduleRow) => {
    setBusy(schedule.id);
    try {
      const res = await fetch(`/api/reports/schedules/${schedule.id}/run`, { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Run failed");
      pushToast({ tone: "success", title: "Report generated", body: "The schedule's last-run time has been updated." });
      load();
    } catch (err) {
      pushToast({ tone: "error", title: "Couldn't run", body: err instanceof Error ? err.message : "Try again." });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-3.5">
      {/* Report catalog */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {REPORT_CATALOG.map((r) => {
          const schedule = schedules.find((s) => s.reportType === r.key);
          return (
            <div key={r.key} className="bg-white border border-slate-100 rounded-3xl shadow-[0_8px_30px_rgba(0,0,0,0.04)] p-5 flex flex-col">
              <div className="flex items-start gap-3">
                <span className="size-10 rounded-xl bg-[rgba(42,111,219,0.1)] text-[#2A6FDB] flex items-center justify-center shrink-0">
                  <r.icon size={20} />
                </span>
                <div className="min-w-0">
                  <p className="text-base font-medium text-slate-900">{r.name}</p>
                  <p className="text-xs text-slate-400 leading-relaxed mt-0.5">{r.desc}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 mt-3.5 text-xs text-slate-400">
                <IconClockHour4 size={13} />
                <span>Last generated {when(schedule?.lastRunAt ?? exports.find((e) => e.reportType.includes("profit"))?.createdAt ?? null)}</span>
              </div>

              <div className="flex gap-2 mt-4">
                <Button size="sm" onClick={() => generate(r.key)} disabled={busy === r.key}>
                  <IconFileAnalytics size={14} /> {busy === r.key ? "Generating…" : "Generate"}
                </Button>
                <button
                  onClick={() => saveSchedule(r.key, { enabled: !(schedule?.enabled ?? false) })}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  <IconCalendarRepeat size={14} /> {schedule?.enabled ? "Pause schedule" : "Schedule"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 items-start">
        {/* Scheduled */}
        <div className="bg-white border border-slate-100 rounded-3xl shadow-[0_8px_30px_rgba(0,0,0,0.04)] overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
            <span className="size-9 rounded-xl bg-[rgba(243,223,39,0.2)] text-[#151936] flex items-center justify-center">
              <IconCalendarRepeat size={18} />
            </span>
            <div>
              <p className="text-base font-medium text-slate-900">Scheduled</p>
              <p className="text-xs text-slate-400">Delivery intent, kept for when a scheduler exists.</p>
            </div>
          </div>

          {/* Honest: the schedule is stored, but nothing runs it automatically. */}
          <div className="mx-5 mt-4 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5">
            <IconInfoCircle size={15} className="text-amber-600 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-800 leading-relaxed">
              {NO_SCHEDULER_NOTE}. Cadence is saved as real intent, but reports are produced when you press
              <span className="font-medium"> Run now</span> — nothing fires on its own yet.
            </p>
          </div>

          <div className="p-5 flex flex-col gap-2.5">
            {loading ? (
              Array.from({ length: 2 }).map((_, i) => <SkeletonBlock key={i} className="h-16 w-full rounded-xl" />)
            ) : schedules.length === 0 ? (
              <p className="text-sm text-slate-400 py-2">No schedules yet — use “Schedule” on a report above.</p>
            ) : schedules.map((s) => {
              const cat = REPORT_CATALOG.find((r) => r.key === s.reportType);
              return (
                <div key={s.id} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-[#fafbf8] px-3.5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900">{cat?.name ?? s.reportType}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {CADENCE_LABEL[s.cadence]} · last run {when(s.lastRunAt)}
                    </p>
                  </div>

                  <select
                    value={s.cadence}
                    onChange={(e) => saveSchedule(s.reportType, { cadence: e.target.value as ReportCadence })}
                    aria-label={`${cat?.name ?? s.reportType} cadence`}
                    className="box-border border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white outline-none"
                  >
                    {(Object.keys(CADENCE_LABEL) as ReportCadence[]).map((c) => (
                      <option key={c} value={c}>{CADENCE_LABEL[c]}</option>
                    ))}
                  </select>

                  <button
                    onClick={() => runNow(s)}
                    disabled={busy === s.id}
                    aria-label={`Run ${cat?.name ?? s.reportType} now`}
                    className="size-8 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 flex items-center justify-center disabled:opacity-50 shrink-0"
                  >
                    <IconPlayerPlay size={14} />
                  </button>

                  <span className={cn(
                    "inline-flex rounded-full px-2 py-0.5 text-xxs font-medium uppercase tracking-wide shrink-0",
                    s.enabled ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500",
                  )}>
                    {s.enabled ? "Active" : "Paused"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent exports */}
        <div className="bg-white border border-slate-100 rounded-3xl shadow-[0_8px_30px_rgba(0,0,0,0.04)] overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
            <span className="size-9 rounded-xl bg-[rgba(16,185,129,0.12)] text-emerald-600 flex items-center justify-center">
              <IconDownload size={18} />
            </span>
            <div>
              <p className="text-base font-medium text-slate-900">Recent exports</p>
              <p className="text-xs text-slate-400">Every one carries a QR-verifiable token.</p>
            </div>
          </div>

          <div className="p-5 flex flex-col gap-2.5">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => <SkeletonBlock key={i} className="h-14 w-full rounded-xl" />)
            ) : exports.length === 0 ? (
              <p className="text-sm text-slate-400 py-2">No reports generated yet.</p>
            ) : exports.map((e) => (
              <div key={e.id} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-[#fafbf8] px-3.5 py-3">
                <span className="size-8 rounded-lg bg-white border border-slate-100 text-slate-500 flex items-center justify-center shrink-0">
                  <IconFileAnalytics size={15} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900 capitalize truncate">{e.reportType.replace(/_/g, " ")}</p>
                  <p className="text-xs text-slate-400 mt-0.5 truncate">
                    {e.generatedByName} · {when(e.createdAt)}
                  </p>
                </div>
                <Link
                  href={`/fin/reports/verify/${e.verificationToken}`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-[#122a20] hover:bg-slate-50 shrink-0"
                >
                  <IconShieldCheck size={13} /> Verify
                </Link>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
