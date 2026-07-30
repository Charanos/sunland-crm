"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  IconAlertTriangle,
  IconChecklist,
  IconLifebuoy,
  IconServerBolt,
  IconShieldCheck,
  type Icon,
} from "@tabler/icons-react";
import { Avatar, Badge, BoardHeader } from "@/components/ui/erp-primitives";
import { PageTransition } from "@/components/shared/page-transition";
import { useUIStore } from "@/store/ui";
import { cn } from "@/lib/utils/cn";
import { formatCompactKES } from "@/lib/utils/format";
import { RingGauge, initialsOf, scoreColor } from "./account-ui";
import {
  OVERSIGHT_SECTIONS,
  SECTION_META,
  oversightRouteFor,
  type OversightSection,
} from "./oversight-constants";
import { ApprovalsSection } from "./oversight-approvals-section";
import { ComplaintsSection } from "./oversight-complaints-section";
import { TicketsSection } from "./oversight-tickets-section";
import { ReportsSection } from "./oversight-reports-section";
import { SystemSection } from "./oversight-system-section";

export interface OversightPulse {
  approvals: { pending: number; pendingValueKes: number; aboveThreshold: number; thresholdKes: number };
  complaints: { open: number; escalated: number; total: number };
  tickets: { open: number; breached: number; total: number };
  system: { healthPct: number | null; measuredServices: number; totalServices: number; degraded: number };
  generatedAt: string;
}

type Counts = Record<OversightSection, number>;

function relativeAge(iso: string | null): string {
  if (!iso) return "—";
  const secs = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

export function OversightBoard({
  entityId,
  startSection = "approvals",
}: {
  entityId: string;
  /** Set by the route that rendered the console - each Oversight route owns a section. */
  startSection?: OversightSection;
}) {
  const router = useRouter();
  const { activeEntityId } = useUIStore();
  const scopeEntityId = entityId || activeEntityId;

  const [section, setSection] = useState<OversightSection>(startSection);
  const [pulse, setPulse] = useState<OversightPulse | null>(null);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [me, setMe] = useState<{ name: string; role: string; avatarUrl: string | null } | null>(null);
  const [tick, setTick] = useState(0);

  const loadPulse = useCallback(() => {
    fetch(`/api/oversight/pulse?entityId=${scopeEntityId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.pulse) setPulse(d.pulse);
        if (d.counts) setCounts(d.counts);
      })
      .catch(() => { });
  }, [scopeEntityId]);

  useEffect(() => {
    Promise.resolve().then(() => {
      loadPulse();
      fetch("/api/auth/me")
        .then((r) => r.json())
        .then((d) => {
          if (d?.user) setMe({ name: d.user.name, role: d.user.role, avatarUrl: d.user.avatarUrl ?? null });
        })
        .catch(() => { });
    });
  }, [loadPulse]);

  // Re-render the "updated Xs ago" heartbeat without re-fetching.
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 15_000);
    return () => clearInterval(id);
  }, []);

  // Write the pretty route back so the sidebar highlight follows in-console
  // tab switches (the ADR 019 routing rule).
  useEffect(() => {
    router.replace(oversightRouteFor(section), { scroll: false });
  }, [section, router]);

  const meta = SECTION_META[section];

  const pulseCells = useMemo(() => {
    if (!pulse) return [];
    return [
      {
        key: "approvals" as const,
        kind: "stat" as const,
        label: "Awaiting your decision",
        value: String(pulse.approvals.pending),
        note: pulse.approvals.aboveThreshold > 0
          ? `${pulse.approvals.aboveThreshold} over threshold`
          : formatCompactKES(pulse.approvals.pendingValueKes),
        tone: pulse.approvals.aboveThreshold > 0 ? "gold" : "emerald",
        icon: IconChecklist,
        onClick: () => setSection("approvals"),
      },
      {
        key: "complaints" as const,
        kind: "stat" as const,
        label: "Open complaints",
        value: String(pulse.complaints.open),
        note: pulse.complaints.escalated > 0 ? `${pulse.complaints.escalated} escalated` : "none escalated",
        tone: pulse.complaints.escalated > 0 ? "rose" : "emerald",
        icon: IconAlertTriangle,
        onClick: () => setSection("complaints"),
      },
      {
        key: "tickets" as const,
        kind: "stat" as const,
        label: "Open tickets",
        value: String(pulse.tickets.open),
        note: pulse.tickets.breached > 0 ? `${pulse.tickets.breached} SLA breached` : "all within SLA",
        tone: pulse.tickets.breached > 0 ? "rose" : "emerald",
        icon: IconLifebuoy,
        onClick: () => setSection("tickets"),
      },
      {
        key: "system" as const,
        kind: "gauge" as const,
        label: "Service health",
        // Never a reassuring 100% before anything was measured.
        value: pulse.system.healthPct === null ? "—" : `${pulse.system.healthPct}%`,
        note: pulse.system.healthPct === null
          ? "not yet measured"
          : `${pulse.system.measuredServices}/${pulse.system.totalServices} services checked`,
        pct: pulse.system.healthPct ?? 0,
        icon: IconServerBolt,
        onClick: () => setSection("system"),
      },
    ];
  }, [pulse]);

  const tabs: Array<{ key: OversightSection; label: string; icon: Icon; badge: number }> = OVERSIGHT_SECTIONS.map((s) => ({
    key: s,
    label: SECTION_META[s].label,
    icon: SECTION_META[s].icon,
    badge: counts?.[s] ?? 0,
  }));

  return (
    <PageTransition className="mx-auto flex max-w-[98rem] flex-col gap-4">
      <BoardHeader
        eyebrow={<Badge tone="primary">Oversight</Badge>}
        title={meta.title}
        description={meta.sub}
        actions={
          <div className="flex items-center gap-3 bg-white border border-slate-100 rounded-2xl pl-1.5 pr-4 py-1.5 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
            <Avatar src={me?.avatarUrl ?? undefined} fallback={initialsOf(me?.name ?? "?")} className="size-10 rounded-xl" />
            <div className="leading-tight">
              <p className="text-sm font-medium text-slate-900">{me?.name ?? "—"}</p>
              <p className="text-xs text-slate-400 capitalize">{(me?.role ?? "").replace(/_/g, " ")}</p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xxs font-medium uppercase tracking-wide bg-[rgba(18,42,32,0.07)] border border-[rgba(18,42,32,0.14)] text-[#122a20]">
              <IconShieldCheck size={12} /> Super-admin
            </span>
          </div>
        }
      />

      {/* Section hub tabs */}
      <div className="flex gap-1.5 bg-white border border-slate-100 rounded-2xl p-1.5 shadow-[0_8px_30px_rgba(0,0,0,0.04)] w-fit max-w-full overflow-x-auto">
        {tabs.map((t) => {
          const active = section === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setSection(t.key)}
              aria-pressed={active}
              className={cn(
                "inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap",
                active ? "bg-[#151936] text-white shadow-sm" : "text-slate-500 hover:text-slate-900",
              )}
            >
              <t.icon size={15} /> {t.label}
              {t.badge > 0 && (
                <span className={cn(
                  "min-w-[18px] h-[18px] px-1.5 rounded-full inline-flex items-center justify-center text-xxs font-mono font-medium",
                  active ? "bg-[#f3df27] text-[#151936]" : "bg-slate-200 text-slate-600",
                )}>{t.badge}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Oversight pulse */}
      <div className="flex items-center gap-3 mt-1.5 mb-1">
        <span className="text-xxs font-medium uppercase tracking-[0.12em] text-slate-400 whitespace-nowrap">Oversight Pulse</span>
        <span className="flex-1 h-px bg-slate-200" />
        <span key={tick} className="inline-flex items-center gap-1.5 text-xs text-slate-400 whitespace-nowrap">
          <span className="size-1.5 rounded-full bg-emerald-500" />
          Live · updated {relativeAge(pulse?.generatedAt ?? null)}
        </span>
      </div>

      <div
        className="gsap-stagger rounded-3xl overflow-hidden border border-[rgba(18,42,32,0.8)] shadow-[0_16px_40px_rgba(12,31,36,0.28)]"
        style={{ background: "linear-gradient(135deg,#0c1f24 0%,#122a20 50%,#1e1b4b 100%)" }}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {pulseCells.length === 0
            ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className={cn("px-6 py-5 h-[116px]", i > 0 && "border-l border-white/[0.08]")}>
                <div className="h-3 w-24 rounded bg-white/10" />
                <div className="mt-4 h-7 w-16 rounded bg-white/10" />
              </div>
            ))
            : pulseCells.map((cell, i) => (
              <button
                key={cell.key}
                onClick={cell.onClick}
                className={cn(
                  "relative px-6 py-5 flex flex-col gap-3 overflow-hidden text-left transition-colors hover:bg-white/[0.04]",
                  i > 0 && "border-l border-white/[0.08]",
                )}
              >
                {cell.kind === "stat" ? (
                  <>
                    <cell.icon
                      size={92}
                      className="absolute -right-2.5 -bottom-4 pointer-events-none"
                      style={{ color: cell.tone === "gold" ? "rgba(243,223,39,0.09)" : cell.tone === "rose" ? "rgba(251,113,133,0.09)" : "rgba(255,255,255,0.05)" }}
                    />
                    <p className="relative text-sm font-medium text-white/55">{cell.label}</p>
                    <div className="relative flex items-end justify-between gap-2.5">
                      <span className="font-mono font-medium text-3xl text-white leading-none">{cell.value}</span>
                      <span className={cn(
                        "text-xxs font-medium uppercase tracking-wide",
                        cell.tone === "gold" ? "text-[#f3df27]" : cell.tone === "rose" ? "text-rose-300" : "text-emerald-300",
                      )}>{cell.note}</span>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center gap-4">
                    <RingGauge pct={cell.pct ?? 0} color={scoreColor(cell.pct ?? 0)} />
                    <div>
                      <p className="text-sm font-medium text-white/55">{cell.label}</p>
                      <p className="font-mono font-medium text-2xl text-white leading-none mt-0.5">{cell.value}</p>
                      <p className="mt-1.5 text-xxs font-medium uppercase tracking-wide text-emerald-300">{cell.note}</p>
                    </div>
                  </div>
                )}
              </button>
            ))}
        </div>
      </div>

      {/* Active section divider */}
      <div className="flex items-center gap-3 mt-2 mb-1">
        <span className="text-xxs font-medium uppercase tracking-[0.12em] text-slate-400 whitespace-nowrap">{meta.divider}</span>
        <span className="flex-1 h-px bg-slate-200" />
      </div>

      {section === "approvals" && <ApprovalsSection entityId={scopeEntityId} pulse={pulse} onChanged={loadPulse} />}
      {section === "complaints" && <ComplaintsSection entityId={scopeEntityId} onChanged={loadPulse} />}
      {section === "tickets" && <TicketsSection entityId={scopeEntityId} onChanged={loadPulse} />}
      {section === "reports" && <ReportsSection entityId={scopeEntityId} />}
      {section === "system" && <SystemSection entityId={scopeEntityId} onChanged={loadPulse} />}

      <p className="mt-5 text-xs text-slate-400">
        Sunland ERP · Oversight · Viewing as {me?.name ?? "—"} (super-admin)
      </p>
    </PageTransition>
  );
}
