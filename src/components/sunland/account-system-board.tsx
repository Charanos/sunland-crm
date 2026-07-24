"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  IconAdjustments,
  IconBell,
  IconBuilding,
  IconBuildingSkyscraper,
  IconCash,
  IconFileCertificate,
  IconMessage2,
  IconServerCog,
  IconShieldCheck,
  IconShieldLock,
  IconUser,
  IconUserCircle,
  IconUserPlus,
  IconUsersGroup,
  type Icon,
} from "@tabler/icons-react";
import { Avatar, Badge, BoardHeader } from "@/components/ui/erp-primitives";
import { PageTransition } from "@/components/shared/page-transition";
import { MessagesPageContent } from "@/components/shared/messages-page-content";
import { useUIStore } from "@/store/ui";
import { usePresence } from "@/hooks/use-presence";
import { cn } from "@/lib/utils/cn";
import { formatCompactKES } from "@/lib/utils/format";
import { RingGauge, initialsOf, scoreColor } from "./account-ui";
import {
  DirectorySection,
  NotificationsSection,
  PoliciesSection,
  PreferencesSection,
  SecuritySection,
  SystemSection,
  type Pulse,
} from "./account-sections";
import {
  ORG_SECTIONS,
  PERSONAL_SECTIONS,
  consoleRouteFor,
  type ConsoleScope,
  type ConsoleSection,
  type OrgSection,
  type PersonalSection,
} from "./account-constants";

function tLabel(s: string): string {
  const map: Record<string, string> = {
    messages: "Messages",
    notifications: "Notifications",
    preferences: "Preferences",
    security: "Account Protection",
    directory: "Directory & Roles",
    policies: "Access Policies",
    system: "System & Integrations",
  };
  return map[s] ?? s;
}

export function AccountSystemBoard({ entityId, startScope, startSection }: {
  entityId: string;
  /** Set by the route that rendered the console - each pretty route owns a (scope, section). */
  startScope?: ConsoleScope;
  startSection?: ConsoleSection;
}) {
  const { openChat } = useUIStore();
  const router = useRouter();
  const searchParams = useSearchParams();

  const paramSection = searchParams.get("section") ?? "";
  const [scope, setScope] = useState<ConsoleScope>(startScope ?? (searchParams.get("scope") === "org" ? "org" : "personal"));
  const [pSection, setPSection] = useState<PersonalSection>(() => {
    const candidate = (PERSONAL_SECTIONS as string[]).includes(paramSection) ? paramSection : startSection;
    return (PERSONAL_SECTIONS as string[]).includes(candidate ?? "") ? (candidate as PersonalSection) : "messages";
  });
  const [oSection, setOSection] = useState<OrgSection>(() => {
    const candidate = (ORG_SECTIONS as string[]).includes(paramSection) ? paramSection : startSection;
    return (ORG_SECTIONS as string[]).includes(candidate ?? "") ? (candidate as OrgSection) : "directory";
  });
  const isPersonal = scope === "personal";
  const section = isPersonal ? pSection : oSection;

  const [me, setMe] = useState<{ id: string; name: string; role: string; avatarUrl: string | null } | null>(null);
  const [pulse, setPulse] = useState<Pulse | null>(null);
  const [unreadNotif, setUnreadNotif] = useState(0);

  useEffect(() => {
    fetch("/api/auth/me").then((r) => r.json()).then((d) => { if (d.user) setMe({ id: d.user.id, name: d.user.name, role: d.user.role, avatarUrl: d.user.avatarUrl ?? null }); }).catch(() => { });
    fetch("/api/notifications?unreadOnly=true").then((r) => r.json()).then((d) => setUnreadNotif((d.notifications ?? []).length)).catch(() => { });
  }, []);

  const loadPulse = useCallback(() => {
    fetch(`/api/account/console-pulse?entityId=${entityId}&scope=${scope}`).then((r) => r.json()).then((d) => { if (d.pulse) setPulse(d.pulse); }).catch(() => { });
  }, [entityId, scope]);
  useEffect(() => { loadPulse(); }, [loadPulse]);

  // Write the pretty route back so the sidebar highlight follows in-console
  // section switches (ADR 019) - not `/admin/account?scope=&section=`, which
  // every nav item would tie on.
  useEffect(() => {
    router.replace(consoleRouteFor(scope, section), { scroll: false });
  }, [scope, section, router]);

  const presentIds = usePresence(entityId, me?.id ?? null);

  const scopeTitle = isPersonal ? "Personal Console" : "Organization Console";
  const scopeSub = isPersonal
    ? "Your inbox, alerts, workspace preferences and account protection."
    : "Members, roles, access policies and connected systems — org-wide.";
  const sectionLabel = isPersonal ? "Your Pulse" : "Organization Pulse";

  const pTabs: Array<{ key: PersonalSection; label: string; icon: Icon; badge?: number }> = [
    { key: "messages", label: "Messages", icon: IconMessage2 },
    { key: "notifications", label: "Notifications", icon: IconBell, badge: unreadNotif || undefined },
    { key: "preferences", label: "Preferences", icon: IconAdjustments },
    { key: "security", label: "Security", icon: IconShieldLock },
  ];
  const oTabs: Array<{ key: OrgSection; label: string; icon: Icon }> = [
    { key: "directory", label: "Directory & Roles", icon: IconUsersGroup },
    { key: "policies", label: "Access Policies", icon: IconShieldCheck },
    { key: "system", label: "System", icon: IconServerCog },
  ];

  return (
    <PageTransition className="mx-auto flex max-w-[92rem] flex-col gap-4">
      <BoardHeader
        eyebrow={<Badge tone="primary">Account &amp; System</Badge>}
        title={scopeTitle}
        description={scopeSub}
        actions={
          <div className="flex items-center gap-3 bg-white border border-slate-100 rounded-2xl pl-1.5 pr-4 py-1.5 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
            <Avatar src={me?.avatarUrl ?? undefined} fallback={initialsOf(me?.name ?? "?")} className="size-10 rounded-xl" />
            <div className="leading-tight">
              <p className="text-sm font-medium text-slate-900">{me?.name ?? "—"}</p>
              <p className="text-xs text-slate-400 capitalize">{(me?.role ?? "").replace(/_/g, " ")}</p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xxs font-medium uppercase tracking-wide bg-[rgba(18,42,32,0.07)] border border-[rgba(18,42,32,0.14)] text-[#122a20]"><IconShieldCheck size={12} /> Super-admin</span>
          </div>
        }
      />

      {/* Hub card: scope switcher */}
      <div className="flex items-center justify-between gap-4 flex-wrap bg-white border border-slate-100 rounded-[20px] shadow-[0_8px_30px_rgba(0,0,0,0.04)] px-4 py-3.5">
        <div className="flex items-center gap-3 min-w-0">
          <span className={cn("size-11 rounded-[13px] flex items-center justify-center shrink-0", isPersonal ? "bg-[rgba(18,42,32,0.08)] text-[#122a20]" : "bg-[rgba(21,25,54,0.08)] text-[#151936]")}>
            {isPersonal ? <IconUserCircle size={22} /> : <IconBuildingSkyscraper size={22} />}
          </span>
          <div className="min-w-0">
            <p className="text-base font-medium text-slate-900">{isPersonal ? "My Account" : "Sunland Organization"}</p>
            <p className="text-xs text-slate-400">{isPersonal ? "Settings that affect only you." : `Super-admin · affects all ${pulse?.memberCount ?? "—"} members.`}</p>
          </div>
        </div>
        <div className="inline-flex items-center gap-1 bg-[#151936] p-1.5 rounded-[14px]">
          {([{ key: "personal", label: "My Account", icon: IconUser }, { key: "org", label: "Organization", icon: IconBuilding }] as const).map((sc) => {
            const on = scope === sc.key;
            const badge = sc.key === "personal" ? unreadNotif : (pulse?.pendingAccess ?? 0);
            return (
              <button key={sc.key} onClick={() => setScope(sc.key)} aria-pressed={on}
                className={cn("inline-flex items-center gap-2 rounded-[10px] px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap", on ? "bg-white text-[#151936] shadow" : "bg-transparent text-white/60 hover:text-white/90")}>
                <sc.icon size={15} /> {sc.label}
                {badge > 0 && <span className={cn("min-w-[18px] h-[18px] px-1.5 rounded-full inline-flex items-center justify-center text-xxs font-mono font-medium", on ? "bg-[#f3df27] text-[#151936]" : "bg-white/[0.16] text-white/85")}>{badge}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Section hub tabs */}
      <div className="flex gap-1.5 bg-white border border-slate-100 rounded-2xl p-1.5 shadow-[0_8px_30px_rgba(0,0,0,0.04)] w-fit max-w-full overflow-x-auto">
        {(isPersonal ? pTabs : oTabs).map((t) => {
          const active = section === t.key;
          const badge = "badge" in t ? t.badge : undefined;
          return (
            <button key={t.key} onClick={() => (isPersonal ? setPSection(t.key as PersonalSection) : setOSection(t.key as OrgSection))} aria-pressed={active}
              className={cn("inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap", active ? "bg-[#151936] text-white shadow-sm" : "text-slate-500 hover:text-slate-900")}>
              <t.icon size={15} /> {t.label}
              {badge ? <span className={cn("min-w-[18px] h-[18px] px-1.5 rounded-full inline-flex items-center justify-center text-xxs font-mono font-medium", active ? "bg-[#f3df27] text-[#151936]" : "bg-slate-200 text-slate-600")}>{badge}</span> : null}
            </button>
          );
        })}
      </div>

      {/* Console Pulse */}
      <div className="flex items-center gap-3 mt-1.5 mb-1">
        <span className="text-xs font-medium uppercase tracking-[0.12em] text-slate-400 whitespace-nowrap">{sectionLabel}</span>
        <span className="flex-1 h-px bg-slate-200" />
      </div>
      <ConsolePulse pulse={pulse} scope={scope} onGoSecurity={() => { setScope("personal"); setPSection("security"); }} onGoPolicies={() => { setScope("org"); setOSection("policies"); }} onGoDirectory={() => { setScope("org"); setOSection("directory"); }} />

      {/* Active section divider - the Messenger renders its own richer heading
          (with real unread/conversation counts), so it isn't doubled up here. */}
      {!(isPersonal && pSection === "messages") && (
        <div className="flex items-center gap-3 mt-2 mb-1">
          <span className="text-xs font-medium uppercase tracking-[0.12em] text-slate-400 whitespace-nowrap">{tLabel(section)}</span>
          <span className="flex-1 h-px bg-slate-200" />
        </div>
      )}

      {isPersonal && pSection === "messages" && <MessagesPageContent entityId={entityId} />}
      {isPersonal && pSection === "notifications" && <NotificationsSection meId={me?.id ?? null} onUnreadChange={setUnreadNotif} />}
      {isPersonal && pSection === "preferences" && <PreferencesSection entityId={entityId} meId={me?.id ?? null} onSaved={loadPulse} />}
      {isPersonal && pSection === "security" && <SecuritySection onChanged={loadPulse} />}
      {!isPersonal && oSection === "directory" && <DirectorySection entityId={entityId} presentIds={presentIds} onOpenChat={openChat} onChanged={loadPulse} />}
      {!isPersonal && oSection === "policies" && <PoliciesSection entityId={entityId} memberTotal={pulse?.memberCount ?? 0} onChanged={loadPulse} />}
      {!isPersonal && oSection === "system" && <SystemSection entityId={entityId} />}

      <p className="mt-5 text-xs text-slate-400">Sunland ERP · Account &amp; System · Viewing as {me?.name ?? "—"} (super-admin)</p>
    </PageTransition>
  );
}

// ── Console Pulse tier ───────────────────────────────────────────────────────
function ConsolePulse({ pulse, scope, onGoSecurity, onGoPolicies, onGoDirectory }: {
  pulse: Pulse | null; scope: ConsoleScope; onGoSecurity: () => void; onGoPolicies: () => void; onGoDirectory: () => void;
}) {
  const cellBase = "relative px-6 py-5 flex flex-col gap-3 overflow-hidden text-left cursor-pointer transition-colors hover:bg-white/[0.04]";
  const border = "border-l border-white/[0.08]";
  return (
    <div className="gsap-stagger rounded-3xl overflow-hidden border border-[rgba(18,42,32,0.8)] shadow-[0_16px_40px_rgba(12,31,36,0.28)] bg-tertiary-gradient">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {scope === "personal" ? (
          <>
            <StatCell className={cellBase} label="Awaiting your sign-off" value={String(pulse?.pendingApprovals ?? 0)} note="approvals" gold bgIcon={IconFileCertificate} onClick={onGoSecurity} />
            <button onClick={onGoSecurity} className={cn(cellBase, border)}>
              <div className="flex items-center gap-4">
                <RingGauge pct={pulse?.securityScorePct ?? 0} color={scoreColor(pulse?.securityScorePct ?? 0)} />
                <div>
                  <p className="text-sm font-medium text-white/55">Security posture</p>
                  <p className="font-mono text-2xl text-white leading-none">{pulse?.securityScorePct ?? "—"}%</p>
                  <p className="mt-1.5 text-xs font-medium uppercase tracking-wide text-emerald-300">{pulse?.securityScoreLabel ?? ""}</p>
                </div>
              </div>
            </button>
            <StatCell className={cn(cellBase, border)} label="Enterprise seats" value={`${pulse?.seatsUsed ?? 0}/${pulse?.seatsTotal ?? 0}`} note="in use" gold bgIcon={IconUsersGroup} onClick={onGoDirectory} />
            <div className={cn("px-6 py-5 flex flex-col gap-2.5 justify-center", border)}>
              <p className="flex items-center gap-1.5 text-xxs font-medium uppercase tracking-[0.1em] text-[#f3df27]"><IconShieldCheck size={12} /> Sunland Enterprise</p>
              <div className="h-1.5 rounded-full bg-white/15 overflow-hidden"><div className="h-full rounded-full bg-[#f3df27]" style={{ width: `${Math.min(100, Math.round(((pulse?.seatsUsed ?? 0) / (pulse?.seatsTotal || 1)) * 100))}%` }} /></div>
              <p className="font-mono text-xs text-white/60">{pulse?.seatsUsed ?? 0} / {pulse?.seatsTotal ?? 0} seats used</p>
            </div>
          </>
        ) : (
          <>
            <StatCell className={cellBase} label="Team members" value={String(pulse?.memberCount ?? 0)} note="active" bgIcon={IconUsersGroup} onClick={onGoDirectory} />
            <StatCell className={cn(cellBase, border)} label="Pending access" value={String(pulse?.pendingAccess ?? 0)} note="never signed in" gold bgIcon={IconUserPlus} onClick={onGoDirectory} />
            <button onClick={onGoPolicies} className={cn(cellBase, border)}>
              <div className="flex items-center gap-4">
                <RingGauge pct={pulse?.orgSecurityPct ?? 0} color={scoreColor(pulse?.orgSecurityPct ?? 0)} />
                <div>
                  <p className="text-sm font-medium text-white/55">Org security</p>
                  <p className="font-mono text-2xl text-white leading-none">{pulse?.orgSecurityPct ?? "—"}%</p>
                  <p className="mt-1.5 text-xs font-medium uppercase tracking-wide text-emerald-300">{pulse?.orgSecurityLabel ?? ""}</p>
                </div>
              </div>
            </button>
            <StatCell className={cn(cellBase, border)} label="Monthly op-spend (MTD)" value={pulse?.monthlySpendKes != null ? formatCompactKES(pulse.monthlySpendKes) : "—"} note="this month" gold bgIcon={IconCash} onClick={() => { }} />
          </>
        )}
      </div>
    </div>
  );
}

function StatCell({ className, label, value, note, gold, bgIcon: BgIcon, onClick }: { className: string; label: string; value: string; note: string; gold?: boolean; bgIcon: Icon; onClick: () => void }) {
  return (
    <button onClick={onClick} className={className}>
      <BgIcon size={92} className="absolute -right-2.5 -bottom-4 pointer-events-none" style={{ color: gold ? "rgba(243,223,39,0.09)" : "rgba(255,255,255,0.05)" }} />
      <p className="relative text-sm font-medium text-white/55">{label}</p>
      <div className="relative flex items-end justify-between gap-2.5">
        <span className="font-mono text-3xl text-white leading-none">{value}</span>
        <span className={cn("text-xs font-medium uppercase tracking-wide", gold ? "text-[#f3df27]" : "text-emerald-300")}>{note}</span>
      </div>
    </button>
  );
}
