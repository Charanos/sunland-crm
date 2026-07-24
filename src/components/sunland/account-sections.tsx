"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  IconAlertCircle,
  IconBell,
  IconBuildingSkyscraper,
  IconCloudCheck,
  IconDatabaseCog,
  IconDeviceDesktop,
  IconDots,
  IconHistory,
  IconKey,
  IconLockCheck,
  IconLogout,
  IconMessage2,
  IconPalette,
  IconPlugConnected,
  IconRestore,
  IconShieldCheck,
  IconUserCircle,
  IconUserPlus,
} from "@tabler/icons-react";
import { Avatar, Button, ConfirmDialog, DropdownItem, DropdownMenu, Modal, SkeletonBlock } from "@/components/ui/erp-primitives";
import { useToast } from "@/components/ui/toast-provider";
import { useAblyChannel } from "@/hooks/use-ably-channel";
import { cn } from "@/lib/utils/cn";
import {
  Card,
  CardHeader,
  NOTIF_CATEGORY_ORDER,
  Toggle,
  categoryOf,
  deviceIconFor,
  deviceLabel,
  fieldLabel,
  initialsOf,
  inputCls,
  relativeTime,
  scoreColor,
  selectCls,
  toneForAction,
} from "./account-ui";
import {
  NOTIF_CATEGORY_META,
  ROLE_TIER_META,
  ROLE_TIER_ORDER,
  type ConsoleScope,
  type RoleTier,
} from "./account-constants";

export interface Pulse {
  scope: ConsoleScope;
  securityScorePct?: number;
  securityScoreLabel?: string;
  pendingApprovals?: number;
  seatsUsed?: number;
  seatsTotal?: number;
  memberCount?: number;
  pendingAccess?: number;
  orgSecurityPct?: number;
  orgSecurityLabel?: string;
  monthlySpendKes?: number;
}

interface NotifPrefRow { category: string; inApp: boolean; email: boolean; sms: boolean }
interface InboxNotification { id: string; type: string; title: string; body: string; href: string | null; readAt: string | null; createdAt: string }
interface SecurityOverview { scorePct: number; scoreLabel: string; twofaEnabled: boolean; passwordAgeDays: number | null; activeSessionCount: number; accessLog: Array<{ id: string; action: string; summary: string; createdAt: string }> }
interface SessionRow { id: string; ip: string | null; userAgent: string | null; createdAt: string; revokedAt: string | null }
interface DirectoryMember { id: string; name: string; title: string; role: string; tier: RoleTier; avatarUrl: string | null; isActive: boolean; pending: boolean; lastActive: string | null; isSelf: boolean }
interface DirectoryOverview { totalMembers: number; pendingCount: number; tierCounts: Array<{ tier: RoleTier; count: number }>; members: DirectoryMember[] }
interface OrgPolicies { enforce2fa: boolean; sso: boolean; ipAllowlist: boolean; deviceTrust: boolean; dualRemit: boolean; pwdStrength: "standard" | "strong" | "max"; sessionTimeout: string }
interface Integration { key: string; name: string; kind: string; status: string; meta: string }

/**
 * Today/Earlier split for the notification inbox. Module-level rather than
 * inline in render because reading the clock is impure - keeping it out of the
 * component body is the same shape relativeTime() in account-ui.tsx uses.
 */
function groupByRecency(items: InboxNotification[]): Array<{ label: string; items: InboxNotification[] }> {
  const cutoff = Date.now() - 86_400_000;
  const today: InboxNotification[] = [];
  const earlier: InboxNotification[] = [];
  for (const n of items) {
    (new Date(n.createdAt).getTime() >= cutoff ? today : earlier).push(n);
  }
  return [
    { label: "Today", items: today },
    { label: "Earlier", items: earlier },
  ].filter((g) => g.items.length > 0);
}

// ── NOTIFICATIONS (personal) ─────────────────────────────────────────────────
export function NotificationsSection({ meId, onUnreadChange }: { meId: string | null; onUnreadChange: (n: number) => void }) {
  const { pushToast } = useToast();
  const [tab, setTab] = useState<"inbox" | "routing">("inbox");
  const [items, setItems] = useState<InboxNotification[]>([]);
  const [filter, setFilter] = useState("all");
  const [prefs, setPrefs] = useState<NotifPrefRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch("/api/notifications").then((r) => r.json()),
      fetch("/api/notifications/prefs").then((r) => r.json()),
    ]).then(([n, p]) => { setItems(n.notifications ?? []); setPrefs(p.prefs ?? []); }).catch(() => { }).finally(() => setLoading(false));
  }, []);
  useEffect(() => { Promise.resolve().then(load); }, [load]);

  const unread = useMemo(() => items.filter((n) => !n.readAt).length, [items]);
  useEffect(() => { onUnreadChange(unread); }, [unread, onUnreadChange]);

  const liveHandler = useCallback((d: { id: string; type: string; title: string; body: string; createdAt: string }) => {
    setItems((prev) => prev.some((n) => n.id === d.id) ? prev : [{ id: d.id, type: d.type, title: d.title, body: d.body, href: null, readAt: null, createdAt: d.createdAt }, ...prev]);
  }, []);
  useAblyChannel(meId ? `private-user-${meId}` : null, "notification", liveHandler);

  const markRead = (id: string) => {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)));
    fetch(`/api/notifications/${id}/read`, { method: "PATCH" }).catch(() => { });
  };
  const markAll = () => {
    setItems((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
    fetch("/api/notifications/mark-all-read", { method: "POST" }).catch(() => { });
  };
  const saveRoutingRow = (row: NotifPrefRow, next: Partial<NotifPrefRow>) => {
    const merged = prefs.some((p) => p.category === row.category)
      ? prefs.map((p) => (p.category === row.category ? { ...p, ...next } : p))
      : [...prefs, { ...row, ...next }];
    setPrefs(merged);
    fetch("/api/notifications/prefs", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows: merged.map(({ category, inApp, email, sms }) => ({ category, inApp, email, sms })) }) })
      .then((r) => r.json()).then((d) => { if (d.prefs) setPrefs(d.prefs); }).catch(() => pushToast({ tone: "warning", title: "Error", body: "Couldn't save routing." }));
  };

  const filtered = filter === "all" ? items : items.filter((n) => categoryOf(n.type) === filter);
  const groups = groupByRecency(filtered);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {(["inbox", "routing"] as const).map((k) => (
          <button key={k} onClick={() => setTab(k)} className={cn("inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium capitalize transition-colors", tab === k ? "bg-white text-slate-900 shadow-sm" : "text-slate-500")}>
            {k}{k === "inbox" && unread > 0 ? <span className="text-xxs font-mono bg-[#f3df27] text-[#151936] rounded-full px-1.5">{unread}</span> : null}
          </button>
        ))}
      </div>

      {tab === "inbox" ? (
        <Card>
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex gap-1.5 flex-wrap">
              {["all", "approval", "system", "remittance", "maintenance"].map((f) => {
                const cnt = f === "all" ? unread : items.filter((n) => !n.readAt && categoryOf(n.type) === f).length;
                return (
                  <button key={f} onClick={() => setFilter(f)} className={cn("inline-flex items-center rounded-full px-3 py-1.5 text-xs font-medium capitalize border transition-colors", filter === f ? "bg-[#151936] text-white border-[#151936]" : "bg-white text-slate-500 border-slate-200")}>
                    {f}{cnt > 0 ? <span className={cn("ml-1.5 text-xxs font-mono rounded-full px-1", filter === f ? "bg-[#f3df27] text-[#151936]" : "bg-slate-200 text-slate-600")}>{cnt}</span> : null}
                  </button>
                );
              })}
            </div>
            <button onClick={markAll} className="text-xs font-medium text-slate-500 hover:text-slate-800">Mark all read</button>
          </div>
          <div className="p-4">
            {loading ? <div className="flex flex-col gap-2">{Array.from({ length: 4 }).map((_, i) => <SkeletonBlock key={i} className="h-16 w-full rounded-2xl" />)}</div>
              : groups.length === 0 ? <p className="text-sm text-slate-400 text-center py-10">You&apos;re all caught up.</p>
                : groups.map((g) => (
                  <div key={g.label} className="mb-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-400 px-2 mb-1.5">{g.label}</p>
                    {g.items.map((n) => {
                      const meta = NOTIF_CATEGORY_META[categoryOf(n.type)] ?? NOTIF_CATEGORY_META.system;
                      return (
                        <button key={n.id} onClick={() => markRead(n.id)} className={cn("w-full text-left flex gap-3 items-start p-3 rounded-2xl transition-colors", !n.readAt ? "bg-[#fdfcf3] hover:bg-[#fbf9ec]" : "hover:bg-slate-50")}>
                          <span className="size-9 rounded-xl shrink-0 flex items-center justify-center" style={{ background: `${meta.color}14`, color: meta.color }}><IconBell size={16} /></span>
                          <span className="flex-1 min-w-0">
                            <span className="flex items-center justify-between gap-2">
                              <span className="text-sm font-medium text-slate-900 truncate">{n.title}</span>
                              <span className="text-xs font-mono text-slate-400 shrink-0">{relativeTime(n.createdAt)}</span>
                            </span>
                            <span className="block text-xs text-slate-500 mt-0.5">{n.body}</span>
                          </span>
                          {!n.readAt && <span className="size-[7px] rounded-full bg-[#f3df27] shrink-0 mt-2 ring-4 ring-[rgba(243,223,39,0.25)]" />}
                        </button>
                      );
                    })}
                  </div>
                ))}
          </div>
        </Card>
      ) : (
        <Card>
          <CardHeader icon={IconBell} iconBg="rgba(243,223,39,0.2)" iconColor="#151936" title="Delivery matrix" sub="Choose how each operations event reaches you." action={<span className="inline-flex items-center gap-1.5 text-xs text-slate-400"><IconAlertCircle size={13} /> Email &amp; SMS delivery pending provider</span>} />
          <div className="px-5 pb-4">
            <div className="grid grid-cols-[1fr_62px_62px_62px] gap-2 items-center py-3 border-b border-slate-100">
              <span className="text-xxs font-medium uppercase tracking-wide text-slate-400">Event type</span>
              {["In-app", "Email", "SMS"].map((c) => <span key={c} className="text-center text-xxs font-medium uppercase text-slate-400">{c}</span>)}
            </div>
            {NOTIF_CATEGORY_ORDER.map((cat) => {
              const row = prefs.find((p) => p.category === cat) ?? { category: cat, inApp: true, email: false, sms: false };
              const meta = NOTIF_CATEGORY_META[cat];
              const lockedInApp = cat === "maintenance";
              return (
                <div key={cat} className="grid grid-cols-[1fr_62px_62px_62px] gap-2 items-center py-3 border-b border-slate-50">
                  <span className="flex items-center gap-2.5 min-w-0">
                    <span className="size-[30px] rounded-lg shrink-0 flex items-center justify-center" style={{ background: `${meta.color}14`, color: meta.color }}><IconBell size={15} /></span>
                    <span className="min-w-0"><span className="block text-sm font-medium text-slate-700">{meta.label}</span><span className="block text-xs text-slate-400 truncate">{meta.hint}</span></span>
                  </span>
                  <span className="flex justify-center"><Toggle label={`${meta.label} in-app`} on={lockedInApp ? true : row.inApp} disabled={lockedInApp} onClick={() => saveRoutingRow(row, { inApp: !row.inApp })} /></span>
                  <span className="flex justify-center"><Toggle label={`${meta.label} email`} on={row.email} onClick={() => saveRoutingRow(row, { email: !row.email })} /></span>
                  <span className="flex justify-center"><Toggle label={`${meta.label} sms`} on={row.sms} onClick={() => saveRoutingRow(row, { sms: !row.sms })} /></span>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}

// ── PREFERENCES (personal) ───────────────────────────────────────────────────
const CURRENCY_OPTS = [["KES", "KES — Kenyan Shilling"], ["USD", "USD — US Dollar"], ["EUR", "EUR — Euro"], ["GBP", "GBP — Pound Sterling"]];
const TZ_OPTS = [["EAT", "EAT — East Africa (UTC+3)"], ["CAT", "CAT — Central Africa (UTC+2)"], ["GMT", "GMT — Greenwich (UTC+0)"]];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const REMIT_OPTS = [["1", "1st of month"], ["5", "5th of month"], ["10", "10th of month"], ["last", "Last working day"]];
const LANG_OPTS = [["en", "English"], ["sw", "Kiswahili"], ["fr", "Français"]];
const DATE_FMT_OPTS = [["dmy", "31 Jul 2026"], ["mdy", "07/31/2026"], ["iso", "2026-07-31"]];
const ACCENTS = [["#f3df27", "Gold", "#151936"], ["#122a20", "Emerald", "#fff"], ["#2A6FDB", "Blue", "#fff"], ["#7c3aed", "Violet", "#fff"]];

export function PreferencesSection({ entityId, meId, onSaved }: { entityId: string; meId: string | null; onSaved: () => void }) {
  const { pushToast } = useToast();
  const [identity, setIdentity] = useState({ name: "", title: "", phone: "", email: "" });
  const [org, setOrg] = useState({ legalName: "", currency: "KES", timezone: "EAT", fiscal: "1", remit: "5" });
  const [prefs, setPrefs] = useState<Record<string, string>>({ language: "en", dateFmt: "dmy", accent: "#f3df27", density: "comfortable" });
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!meId) return;
    Promise.allSettled([
      fetch(`/api/identity/users/${meId}`).then((r) => r.json()).then((d) => {
        if (d) setIdentity({ name: d.name ?? "", title: d.title ?? "", phone: d.phone ?? "", email: d.email ?? "" });
      }),
      fetch(`/api/identity/users/${meId}/preferences`).then((r) => r.json()).then((d) => {
        if (d.preferences) setPrefs((prev) => ({ ...prev, ...d.preferences }));
      }),
      fetch(`/api/settings?entityId=${entityId}`).then((r) => r.json()).then((d) => {
        const rows: Array<{ key: string; value: unknown }> = d.settings ?? [];
        const get = (k: string, f: string) => { const r = rows.find((x) => x.key === k); return r ? String(r.value) : f; };
        setOrg({ legalName: get("org.legal_name", ""), currency: get("org.currency", "KES"), timezone: get("org.timezone", "EAT"), fiscal: get("org.fiscal_year_start", "1"), remit: get("org.remittance_day", "5") });
      }),
    ]).finally(() => setLoading(false));
  }, [meId, entityId]);

  const setId = (k: keyof typeof identity, v: string) => { setIdentity((p) => ({ ...p, [k]: v })); setDirty(true); };
  const setOrgV = (k: keyof typeof org, v: string) => { setOrg((p) => ({ ...p, [k]: v })); setDirty(true); };
  const setPref = (k: string, v: string) => { setPrefs((p) => ({ ...p, [k]: v })); setDirty(true); };

  const save = async () => {
    if (!meId) return;
    setSaving(true);
    try {
      await fetch(`/api/identity/users/${meId}/profile`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: identity.name, title: identity.title, phone: identity.phone || null }) });
      await fetch(`/api/identity/users/${meId}/preferences`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ preferences: Object.entries(prefs).map(([key, value]) => ({ key, value })) }) });
      // Org defaults (super-admin gated via settings.entity.write).
      const orgKeys: Array<[string, string]> = [["org.legal_name", org.legalName], ["org.currency", org.currency], ["org.timezone", org.timezone], ["org.fiscal_year_start", org.fiscal], ["org.remittance_day", org.remit]];
      await Promise.all(orgKeys.map(([key, value]) => fetch("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ entityId, key, value }) })));
      pushToast({ tone: "success", title: "Preferences saved", body: "Your workspace preferences are up to date." });
      setDirty(false);
      onSaved();
    } catch {
      pushToast({ tone: "warning", title: "Couldn't save", body: "Try again." });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-4 items-start">
          <SkeletonBlock className="h-[290px] rounded-3xl" />
          <SkeletonBlock className="h-[290px] rounded-3xl" />
        </div>
        <SkeletonBlock className="h-[300px] rounded-3xl" />
      </div>
    );
  }

  return (
    <div className="gsap-stagger flex flex-col gap-4">
      <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-4 items-start">
        <Card>
          <CardHeader icon={IconUserCircle} iconBg="rgba(18,42,32,0.08)" iconColor="#122a20" title="Identity" sub="How you appear across the workspace." />
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="sm:col-span-2"><label className={fieldLabel}>Full name</label><input className={inputCls} value={identity.name} onChange={(e) => setId("name", e.target.value)} /></div>
            <div><label className={fieldLabel}>Role title</label><input className={inputCls} value={identity.title} onChange={(e) => setId("title", e.target.value)} /></div>
            <div><label className={fieldLabel}>Phone</label><input className={inputCls + " font-mono"} value={identity.phone} onChange={(e) => setId("phone", e.target.value)} placeholder="+254 7XX XXX XXX" /></div>
            <div className="sm:col-span-2"><label className={fieldLabel}>Email</label><input className={inputCls + " font-mono bg-slate-50 text-slate-500"} value={identity.email} readOnly title="Email changes require verification (not enabled this pass)" /></div>
          </div>
        </Card>
        <Card>
          <CardHeader icon={IconBuildingSkyscraper} iconBg="rgba(42,111,219,0.1)" iconColor="#2A6FDB" title="Organization defaults" sub="Financial and regional defaults for Sunland ERP." />
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="sm:col-span-2"><label className={fieldLabel}>Legal entity</label><input className={inputCls} value={org.legalName} onChange={(e) => setOrgV("legalName", e.target.value)} placeholder="Sunland Property Group Ltd" /></div>
            <div><label className={fieldLabel}>Base currency</label><select className={selectCls} value={org.currency} onChange={(e) => setOrgV("currency", e.target.value)}>{CURRENCY_OPTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
            <div><label className={fieldLabel}>Time zone</label><select className={selectCls} value={org.timezone} onChange={(e) => setOrgV("timezone", e.target.value)}>{TZ_OPTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
            <div><label className={fieldLabel}>Fiscal year starts</label><select className={selectCls} value={org.fiscal} onChange={(e) => setOrgV("fiscal", e.target.value)}>{MONTHS.map((m, i) => <option key={m} value={String(i + 1)}>{m}</option>)}</select></div>
            <div><label className={fieldLabel}>Default remittance day</label><select className={selectCls} value={org.remit} onChange={(e) => setOrgV("remit", e.target.value)}>{REMIT_OPTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader icon={IconPalette} iconBg="rgba(124,58,237,0.1)" iconColor="#7c3aed" title="Workspace & interface" sub="Personal display settings — only affect your view." />
        <div className="px-5 py-2">
          <PrefRow label="Language" hint="Interface language for menus and labels.">
            <select className={selectCls + " max-w-[180px]"} value={prefs.language} onChange={(e) => setPref("language", e.target.value)}>{LANG_OPTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          </PrefRow>
          <PrefRow label="Date format" hint="Used everywhere dates are shown.">
            <Segmented options={DATE_FMT_OPTS.map(([v, l]) => ({ v, l }))} value={prefs.dateFmt} onChange={(v) => setPref("dateFmt", v)} />
          </PrefRow>
          <PrefRow label="Accent color" hint="Highlight color for selections and chips.">
            <div className="flex gap-2.5">
              {ACCENTS.map(([v, name, tick]) => (
                <button key={v} aria-label={name} onClick={() => setPref("accent", v)} className="size-8 rounded-[10px] flex items-center justify-center" style={{ background: v, border: prefs.accent === v ? "2px solid #0f172a" : "2px solid transparent" }}>
                  {prefs.accent === v && <span style={{ color: tick, fontSize: 13 }}>✓</span>}
                </button>
              ))}
            </div>
          </PrefRow>
          <PrefRow label="Density" hint="Row height across tables and lists." last>
            <Segmented options={[{ v: "comfortable", l: "Comfortable" }, { v: "compact", l: "Compact" }]} value={prefs.density} onChange={(v) => setPref("density", v)} />
          </PrefRow>
        </div>
      </Card>

      {dirty && (
        <div className="sticky bottom-3.5 z-10 flex items-center justify-between gap-3.5 bg-[#151936] rounded-2xl px-4 py-3 shadow-[0_18px_44px_rgba(21,25,54,0.28)]">
          <p className="flex items-center gap-2 text-sm font-medium text-white"><IconAlertCircle size={17} className="text-[#f3df27]" /> You have unsaved changes.</p>
          <div className="flex gap-2">
            <button onClick={() => window.location.reload()} className="bg-white/12 text-white border border-white/20 rounded-[10px] px-4 py-2 text-sm font-medium hover:bg-white/20">Discard</button>
            <button onClick={save} disabled={saving} className="bg-[#f3df27] text-[#151936] rounded-[10px] px-4.5 py-2 text-sm font-medium hover:brightness-105 disabled:opacity-60">{saving ? "Saving…" : "Save changes"}</button>
          </div>
        </div>
      )}
    </div>
  );
}
function PrefRow({ label, hint, children, last }: { label: string; hint: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div className={cn("flex items-center justify-between gap-4 py-3.5 flex-wrap", !last && "border-b border-slate-50")}>
      <div><p className="text-sm font-medium text-slate-700">{label}</p><p className="text-xs text-slate-400 mt-0.5">{hint}</p></div>
      {children}
    </div>
  );
}
function Segmented({ options, value, onChange }: { options: Array<{ v: string; l: string }>; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex bg-slate-100 p-[3px] rounded-xl gap-[3px]">
      {options.map((o) => (
        <button key={o.v} onClick={() => onChange(o.v)} aria-pressed={value === o.v} className={cn("rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors", value === o.v ? "bg-white text-slate-900 shadow-sm" : "text-slate-500")}>{o.l}</button>
      ))}
    </div>
  );
}

// ── SECURITY (personal) ──────────────────────────────────────────────────────
export function SecuritySection({ onChanged }: { onChanged: () => void }) {
  const { pushToast } = useToast();
  const [overview, setOverview] = useState<SecurityOverview | null>(null);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [pwdOpen, setPwdOpen] = useState(false);
  const [twoFaOpen, setTwoFaOpen] = useState(false);
  const [confirmSignOutAll, setConfirmSignOutAll] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<SessionRow | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch("/api/account/security-overview").then((r) => r.json()),
      fetch("/api/identity/sessions").then((r) => r.json()),
    ]).then(([o, s]) => {
      setOverview(o.overview ?? null);
      setSessions((Array.isArray(s) ? s : s.sessions ?? []).filter((x: SessionRow) => !x.revokedAt));
    }).catch(() => { }).finally(() => setLoading(false));
  }, []);
  useEffect(() => { Promise.resolve().then(load); }, [load]);

  const revoke = (id: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== id));
    fetch(`/api/identity/sessions/${id}/revoke`, { method: "POST" }).then(() => { load(); onChanged(); }).catch(() => { });
  };
  const signOutAll = () => {
    fetch("/api/identity/sessions/revoke-all", { method: "POST" }).then((r) => r.json()).then((d) => {
      pushToast({ tone: "success", title: "Signed out everywhere else", body: `${d.revokedCount ?? 0} other device(s) ended.` });
      load(); onChanged();
    }).catch(() => { }).finally(() => setConfirmSignOutAll(false));
  };

  const pct = overview?.scorePct ?? 0;
  const facts = [
    { on: overview?.twofaEnabled, label: overview?.twofaEnabled ? "2FA enabled" : "2FA off" },
    { on: (overview?.passwordAgeDays ?? 999) <= 180, label: "Password fresh" },
    { on: (overview?.activeSessionCount ?? 0) <= 2, label: `${overview?.activeSessionCount ?? 0} active sessions` },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="relative rounded-3xl overflow-hidden p-5 shadow-[0_14px_34px_rgba(21,25,54,0.2)]" style={{ background: "linear-gradient(135deg,#151936,#122a20)" }}>
          <div className="absolute inset-0" style={{ background: "radial-gradient(400px 160px at 90% -20%,rgba(243,223,39,0.16),transparent 70%)" }} />
          <div className="relative">
            <p className="flex items-center gap-1.5 text-xxs font-medium uppercase tracking-[0.11em] text-white/60"><IconShieldCheck size={13} /> Security posture</p>
            <div className="flex items-baseline gap-2.5 mt-2.5"><span className="text-3xl font-medium text-white">{overview?.scoreLabel ?? "—"}</span><span className="font-mono font-medium text-sm text-[#f3df27]">{pct}%</span></div>
            <div className="h-1.5 rounded-full bg-white/15 overflow-hidden mt-3"><div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: scoreColor(pct) }} /></div>
            <div className="flex gap-2 flex-wrap mt-3.5">
              {facts.map((f) => (
                <span key={f.label} className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium bg-white/10 border border-white/[0.16] text-white/85">
                  <span style={{ color: f.on ? "#4ade80" : "#fb7185" }}>{f.on ? "✓" : "✕"}</span>{f.label}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <div className="bg-white border border-slate-100 rounded-[18px] shadow-[0_8px_30px_rgba(0,0,0,0.04)] p-4 flex items-center gap-3.5">
            <span className="size-10 rounded-xl bg-[rgba(4,120,87,0.1)] text-[#047857] flex items-center justify-center shrink-0"><IconKey size={20} /></span>
            <div className="flex-1 min-w-0"><p className="text-sm font-medium text-slate-900">Password</p><p className="text-xs text-slate-400">{overview?.passwordAgeDays != null ? `Last changed ${overview.passwordAgeDays} days ago` : "—"}</p></div>
            <Button size="sm" variant="secondary" onClick={() => setPwdOpen(true)}>Change</Button>
          </div>
          <div className="bg-white border border-slate-100 rounded-[18px] shadow-[0_8px_30px_rgba(0,0,0,0.04)] p-4 flex items-center gap-3.5">
            <span className={cn("size-10 rounded-xl flex items-center justify-center shrink-0", overview?.twofaEnabled ? "bg-[rgba(4,120,87,0.1)] text-[#047857]" : "bg-[rgba(244,63,94,0.1)] text-[#be123c]")}><IconLockCheck size={20} /></span>
            <div className="flex-1 min-w-0"><p className="text-sm font-medium text-slate-900">Two-factor authentication</p><p className="text-xs text-slate-400">{overview?.twofaEnabled ? "On · Authenticator app" : "Off · your account is less protected"}</p></div>
            <Button size="sm" variant={overview?.twofaEnabled ? "secondary" : "primary"} onClick={() => setTwoFaOpen(true)}>{overview?.twofaEnabled ? "Manage" : "Enable"}</Button>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader icon={IconDeviceDesktop} iconBg="rgba(42,111,219,0.1)" iconColor="#2A6FDB" title={`Active sessions (${sessions.length})`} sub="Devices currently signed in to your account." action={sessions.length > 1 ? <button onClick={() => setConfirmSignOutAll(true)} className="inline-flex items-center gap-1.5 bg-white border border-rose-200 rounded-[10px] px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50"><IconLogout size={14} /> Sign out all others</button> : undefined} />
        <div className="px-5 pb-3.5">
          {loading ? <div className="flex flex-col gap-2 py-2">{Array.from({ length: 3 }).map((_, i) => <SkeletonBlock key={i} className="h-12 w-full rounded-xl" />)}</div>
            : sessions.length === 0 ? <p className="text-sm text-slate-400 text-center py-6">No active sessions.</p>
              : sessions.map((s, idx) => {
                const Icon = deviceIconFor(s.userAgent);
                const isCurrent = idx === 0;
                return (
                  <div key={s.id} className="flex items-center gap-3.5 py-3 border-b border-slate-50">
                    <span className="size-10 rounded-xl bg-slate-50 text-slate-500 flex items-center justify-center shrink-0"><Icon size={19} /></span>
                    <div className="flex-1 min-w-0">
                      <p className="flex items-center gap-2 text-sm font-medium text-slate-900">{deviceLabel(s.userAgent)}{isCurrent && <span className="bg-[rgba(4,120,87,0.1)] text-[#047857] rounded-full px-2 py-0.5 text-xxs font-medium uppercase tracking-wide">This device</span>}</p>
                      <p className="text-xs text-slate-400 mt-0.5"><span className="font-mono">{s.ip ?? "unknown IP"}</span> · signed in {relativeTime(s.createdAt)}</p>
                    </div>
                    {!isCurrent && <button onClick={() => setRevokeTarget(s)} className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-rose-50 hover:border-rose-200 hover:text-rose-600">Revoke</button>}
                  </div>
                );
              })}
        </div>
      </Card>

      <Card>
        <CardHeader icon={IconHistory} iconBg="rgba(124,58,237,0.1)" iconColor="#7c3aed" title="Recent access log" sub="Security-relevant activity on your account." />
        <ul className="px-5 py-4 flex flex-col">
          {(overview?.accessLog ?? []).length === 0 ? <li className="text-sm text-slate-400 text-center py-4">No recent security activity.</li>
            : (overview?.accessLog ?? []).map((l, i, arr) => (
              <li key={l.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span className={cn("size-[11px] rounded-full mt-0.5 shrink-0 ring-2 ring-white", toneForAction(l.action))} />
                  {i !== arr.length - 1 && <span className="w-[1.5px] flex-1 bg-slate-100 my-1" />}
                </div>
                <div className="min-w-0 flex-1 pb-4">
                  <p className="text-sm text-slate-700"><span className="font-medium text-slate-900">{l.summary}</span></p>
                  <p className="text-xs font-mono text-slate-400 mt-0.5">{relativeTime(l.createdAt)}</p>
                </div>
              </li>
            ))}
        </ul>
      </Card>

      {pwdOpen && <ChangePasswordModal onClose={() => setPwdOpen(false)} onDone={() => { setPwdOpen(false); load(); onChanged(); }} />}
      {twoFaOpen && <TwoFactorModal enabled={!!overview?.twofaEnabled} onClose={() => setTwoFaOpen(false)} onDone={() => { setTwoFaOpen(false); load(); onChanged(); }} />}
      <ConfirmDialog open={confirmSignOutAll} onClose={() => setConfirmSignOutAll(false)} onConfirm={signOutAll} title="Sign out all other devices?" description="Every session except this one will be ended immediately. You'll stay signed in here." confirmLabel="Sign out others" tone="danger" />
      <ConfirmDialog
        open={!!revokeTarget}
        onClose={() => setRevokeTarget(null)}
        onConfirm={() => { if (revokeTarget) revoke(revokeTarget.id); setRevokeTarget(null); }}
        title="Revoke this session?"
        description={revokeTarget ? `${deviceLabel(revokeTarget.userAgent)} will be signed out immediately and will need to sign in again.` : ""}
        confirmLabel="Revoke session"
        tone="danger"
      />
    </div>
  );
}

function ChangePasswordModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { pushToast } = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (next !== confirm) { pushToast({ tone: "warning", title: "Passwords don't match", body: "Re-enter the new password." }); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/change-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currentPassword: current, newPassword: next }) });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Failed to change password");
      pushToast({ tone: "success", title: "Password changed", body: "Other devices were signed out." });
      onDone();
    } catch (err) {
      pushToast({ tone: "warning", title: "Couldn't change password", body: err instanceof Error ? err.message : "Try again." });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open onClose={onClose} size="sm" title="Change password" description="Changing your password signs you out on all other devices.">
      <div className="flex flex-col gap-3">
        <div><label className={fieldLabel}>Current password</label><input type="password" className={inputCls} value={current} onChange={(e) => setCurrent(e.target.value)} autoFocus /></div>
        <div><label className={fieldLabel}>New password</label><input type="password" className={inputCls} value={next} onChange={(e) => setNext(e.target.value)} /></div>
        <div><label className={fieldLabel}>Confirm new password</label><input type="password" className={inputCls} value={confirm} onChange={(e) => setConfirm(e.target.value)} /></div>
        <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
          <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={submit} disabled={busy || !current || next.length < 8}>{busy ? "Saving…" : "Update password"}</Button>
        </div>
      </div>
    </Modal>
  );
}

function TwoFactorModal({ enabled, onClose, onDone }: { enabled: boolean; onClose: () => void; onDone: () => void }) {
  const { pushToast } = useToast();
  const [enroll, setEnroll] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDisable, setConfirmDisable] = useState(false);

  useEffect(() => {
    if (!enabled) {
      fetch("/api/auth/2fa/enroll", { method: "POST" }).then((r) => r.json()).then((d) => { if (d.secret) setEnroll(d); }).catch(() => { });
    }
  }, [enabled]);

  const verify = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/auth/2fa/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Verification failed");
      pushToast({ tone: "success", title: "Two-factor enabled", body: "You'll confirm sign-ins with your authenticator." });
      onDone();
    } catch (err) {
      pushToast({ tone: "warning", title: "Verification failed", body: err instanceof Error ? err.message : "Try again." });
    } finally { setBusy(false); }
  };
  const disable = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/auth/2fa/disable", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Couldn't disable 2FA");
      pushToast({ tone: "info", title: "Two-factor disabled", body: "We recommend keeping 2FA on." });
      onDone();
    } catch (err) {
      pushToast({ tone: "warning", title: "Couldn't disable", body: err instanceof Error ? err.message : "Try again." });
    } finally { setBusy(false); }
  };

  return (
    <>
      <Modal
        open
        onClose={onClose}
        size="sm"
        title={enabled ? "Manage two-factor" : "Enable two-factor"}
        description={enabled
          ? "Two-factor authentication is on. Enter a current 6-digit code to turn it off."
          : "Scan this QR with Google Authenticator (or any TOTP app), then enter the 6-digit code to confirm."}
      >
        {enabled ? (
          <div className="flex flex-col gap-3">
            <input inputMode="numeric" maxLength={6} className={inputCls + " font-mono text-center text-lg tracking-[0.3em]"} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="000000" autoFocus />
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
              <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
              <Button size="sm" className="text-rose-600 hover:bg-rose-50" variant="secondary" onClick={() => setConfirmDisable(true)} disabled={busy || code.length !== 6}>{busy ? "…" : "Disable 2FA"}</Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3.5">
            <div className="flex justify-center bg-white border border-slate-100 rounded-2xl p-4">
              {enroll ? <QRCodeSVG value={enroll.otpauthUrl} size={168} /> : <SkeletonBlock className="size-[168px] rounded-lg" />}
            </div>
            {enroll && <p className="text-center text-xs font-mono text-slate-400 break-all">Manual key: {enroll.secret}</p>}
            <input inputMode="numeric" maxLength={6} className={inputCls + " font-mono text-center text-lg tracking-[0.3em]"} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="000000" />
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
              <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
              <Button size="sm" onClick={verify} disabled={busy || code.length !== 6 || !enroll}>{busy ? "Verifying…" : "Verify & enable"}</Button>
            </div>
          </div>
        )}
      </Modal>
      <ConfirmDialog
        open={confirmDisable}
        onClose={() => setConfirmDisable(false)}
        onConfirm={() => { setConfirmDisable(false); disable(); }}
        title="Turn off two-factor authentication?"
        description="Your account will be protected by password alone, and your security score will drop. You can re-enable it at any time."
        confirmLabel="Disable 2FA"
        tone="danger"
      />
    </>
  );
}

// ── DIRECTORY & ROLES (org) ──────────────────────────────────────────────────
export function DirectorySection({ entityId, presentIds, onOpenChat, onChanged }: { entityId: string; presentIds: Set<string>; onOpenChat: () => void; onChanged: () => void }) {
  const { pushToast } = useToast();
  const [data, setData] = useState<DirectoryOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [tierFilter, setTierFilter] = useState<RoleTier | "all">("all");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [deactivateTarget, setDeactivateTarget] = useState<DirectoryMember | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/account/directory-overview?entityId=${entityId}`).then((r) => r.json()).then((d) => setData(d.overview ?? null)).catch(() => { }).finally(() => setLoading(false));
  }, [entityId]);
  useEffect(() => { Promise.resolve().then(load); }, [load]);

  const toggleActive = (m: DirectoryMember) => {
    fetch(`/api/identity/users/${m.id}/access`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ entityId, isActive: !m.isActive }) })
      .then((r) => r.json()).then((d) => { if (d.error) throw new Error(d.error); pushToast({ tone: "success", title: m.isActive ? "Member deactivated" : "Member reactivated", body: m.name }); load(); onChanged(); })
      .catch((e) => pushToast({ tone: "warning", title: "Error", body: e instanceof Error ? e.message : "Try again." }));
  };

  const members = (data?.members ?? []).filter((m) => {
    if (tierFilter !== "all" && m.tier !== tierFilter) return false;
    const q = query.trim().toLowerCase();
    return !q || m.name.toLowerCase().includes(q) || m.title.toLowerCase().includes(q);
  });

  return (
    <div className="flex flex-col gap-4">
      {/* Role tiers */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {ROLE_TIER_ORDER.map((tier) => {
          const cnt = data?.tierCounts.find((t) => t.tier === tier)?.count ?? 0;
          const meta = ROLE_TIER_META[tier];
          const active = tierFilter === tier;
          return (
            <button key={tier} onClick={() => setTierFilter(active ? "all" : tier)} aria-pressed={active} className={cn("bg-white border rounded-3xl p-4 text-left transition-colors", active ? "border-[#151936]" : "border-slate-100 hover:border-slate-300")}>
              <span className="flex items-center justify-between gap-2">
                <span className="size-2.5 rounded-full" style={{ background: meta.color }} />
                <span className="font-mono text-xl text-slate-900">{cnt}</span>
              </span>
              <span className="block mt-2 text-xs font-medium text-slate-700">{meta.label}</span>
              <span className="block mt-0.5 text-xs text-slate-400">{meta.scope}</span>
            </button>
          );
        })}
      </div>

      <Card className="p-5">
        <div className="flex items-center gap-2.5 flex-wrap border-b border-slate-100 pb-4 mb-1">
          <div><p className="text-base font-medium text-slate-900">Members <span className="font-mono text-xs text-slate-400">{members.length}</span></p><p className="text-xs text-slate-400">{tierFilter === "all" ? "All members" : `${ROLE_TIER_META[tierFilter].label} tier`}</p></div>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search people…" className="ml-auto max-w-[280px] w-full box-border bg-slate-50 border border-slate-100 rounded-xl px-3.5 py-2 text-sm outline-none focus:border-[#151936]/30 focus:bg-white" />
          <button onClick={() => setInviteOpen(true)} className="inline-flex items-center gap-1.5 text-white rounded-xl px-4 py-2.5 text-sm font-medium" style={{ background: "linear-gradient(135deg,#122a20 0%,#1e1b4b 100%)" }}><IconUserPlus size={15} /> Invite member</button>
        </div>

        {data && data.pendingCount > 0 && (
          <div className="flex items-center gap-2.5 bg-amber-50 border border-amber-200 rounded-2xl px-3.5 py-2.5 my-3">
            <IconAlertCircle size={18} className="text-amber-600" />
            <p className="flex-1 text-xs font-medium text-amber-800">{data.pendingCount} member{data.pendingCount === 1 ? "" : "s"} never signed in — their temporary credentials are unaccepted.</p>
          </div>
        )}

        <div className="flex flex-col">
          {loading ? Array.from({ length: 5 }).map((_, i) => <SkeletonBlock key={i} className="h-16 w-full rounded-2xl mb-1.5" />)
            : members.length === 0 ? <p className="text-sm text-slate-400 text-center py-10">No members match.</p>
              : members.map((m) => {
                const meta = ROLE_TIER_META[m.tier];
                const online = presentIds.has(m.id);
                return (
                  <div key={m.id} className={cn("flex items-center gap-3 py-3 border-b border-slate-50", !m.isActive && "opacity-60")}>
                    <span className="relative shrink-0">
                      <Avatar src={m.avatarUrl ?? undefined} fallback={initialsOf(m.name)} className="size-[42px] rounded-[13px]" />
                      {online && <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full bg-emerald-500 border-2 border-white" />}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="flex items-center gap-2 text-sm font-medium text-slate-900"><span className="truncate">{m.name}</span>{m.isSelf && <span className="bg-[rgba(4,120,87,0.1)] text-[#047857] rounded-full px-2 py-px text-xxs font-medium uppercase tracking-wide shrink-0">You</span>}{m.pending && <span className="bg-amber-50 text-amber-700 rounded-full px-2 py-px text-xxs font-medium uppercase tracking-wide shrink-0">Pending</span>}</p>
                      <p className="text-xs text-slate-400 truncate">{m.title || meta.label} · {m.role.replace(/_/g, " ")}</p>
                    </div>
                    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium shrink-0" style={{ background: `${meta.color}14`, color: meta.color }}><span className="size-1.5 rounded-full" style={{ background: meta.color }} />{meta.label}</span>
                    <span className="w-24 text-right text-xs text-slate-400 shrink-0 hidden md:block">{online ? "Active now" : m.lastActive ? relativeTime(m.lastActive) : "Never"}</span>
                    <div className="flex gap-1.5 shrink-0">
                      <button onClick={onOpenChat} aria-label="Message" className="size-[34px] rounded-[10px] border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 flex items-center justify-center"><IconMessage2 size={15} /></button>
                      {!m.isSelf && (
                        <DropdownMenu label="Manage member" align="right" trigger={<div className="size-[34px] rounded-[10px] border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 flex items-center justify-center"><IconDots size={15} /></div>}>
                          <DropdownItem onClick={() => (m.isActive ? setDeactivateTarget(m) : toggleActive(m))}>{m.isActive ? "Deactivate member" : "Reactivate member"}</DropdownItem>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>
                );
              })}
        </div>
      </Card>

      {inviteOpen && <InviteMemberModal entityId={entityId} onClose={() => setInviteOpen(false)} onDone={() => { setInviteOpen(false); load(); onChanged(); }} />}
      <ConfirmDialog
        open={!!deactivateTarget}
        onClose={() => setDeactivateTarget(null)}
        onConfirm={() => { if (deactivateTarget) toggleActive(deactivateTarget); setDeactivateTarget(null); }}
        title="Deactivate this member?"
        description={deactivateTarget ? `${deactivateTarget.name} will lose access to Sunland ERP immediately. Their records and history are kept, and you can reactivate them at any time.` : ""}
        confirmLabel="Deactivate member"
        tone="danger"
      />
    </div>
  );
}

function InviteMemberModal({ entityId, onClose, onDone }: { entityId: string; onClose: () => void; onDone: () => void }) {
  const { pushToast } = useToast();
  const [form, setForm] = useState({ name: "", email: "", role: "property_manager" });
  const [temp, setTemp] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/identity/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, primaryEntityId: entityId }) });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Failed to invite");
      setTemp(data.temporaryPassword ?? null);
      pushToast({ tone: "success", title: "Member invited", body: `${form.name} added.` });
    } catch (err) {
      pushToast({ tone: "warning", title: "Couldn't invite", body: err instanceof Error ? err.message : "Try again." });
    } finally { setBusy(false); }
  };
  const ROLE_OPTS = [["property_manager", "Property Manager"], ["finance_officer", "Finance Officer"], ["bd_agent", "Sales Agent"], ["general_manager", "General Manager"], ["auditor", "Auditor (read-only)"]];
  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title="Invite member"
      description={temp ? undefined : "They'll get a temporary password you share directly — no email service is configured yet."}
    >
      {temp ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-slate-600">Account created. Share this one-time temporary password with {form.name} out-of-band:</p>
          <p className="font-mono font-medium text-center text-lg bg-slate-50 border border-slate-200 rounded-xl py-3 select-all">{temp}</p>
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200"><Button size="sm" onClick={onDone}>Done</Button></div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div><label className={fieldLabel}>Full name</label><input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus /></div>
          <div><label className={fieldLabel}>Email</label><input type="email" className={inputCls} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div><label className={fieldLabel}>Role</label><select className={selectCls} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>{ROLE_OPTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" onClick={submit} disabled={busy || !form.name || !form.email}>{busy ? "Inviting…" : "Send invite"}</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ── ACCESS POLICIES (org) ────────────────────────────────────────────────────
export function PoliciesSection({ entityId, memberTotal, onChanged }: { entityId: string; memberTotal: number; onChanged: () => void }) {
  const { pushToast } = useToast();
  const [policies, setPolicies] = useState<OrgPolicies | null>(null);
  const [score, setScore] = useState<{ pct: number; label: string } | null>(null);

  const load = useCallback(() => {
    fetch(`/api/account/org-policies?entityId=${entityId}`).then((r) => r.json()).then((d) => { setPolicies(d.policies ?? null); setScore(d.score ?? null); }).catch(() => { });
  }, [entityId]);
  useEffect(() => { Promise.resolve().then(load); }, [load]);

  const patch = (next: Partial<OrgPolicies>) => {
    if (!policies) return;
    const merged = { ...policies, ...next };
    setPolicies(merged);
    fetch("/api/account/org-policies", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ entityId, policies: next }) })
      .then((r) => r.json()).then((d) => { if (d.score) setScore(d.score); onChanged(); })
      .catch(() => pushToast({ tone: "warning", title: "Error", body: "Couldn't save policy." }));
  };

  if (!policies) return <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">{Array.from({ length: 3 }).map((_, i) => <SkeletonBlock key={i} className="h-52 rounded-3xl" />)}</div>;

  const cards: Array<{ title: string; sub: string; icon: typeof IconShieldCheck; iconBg: string; iconColor: string; rows: React.ReactNode }> = [
    {
      title: "Authentication", sub: "How members prove who they are.", icon: IconLockCheck, iconBg: "rgba(4,120,87,0.1)", iconColor: "#047857",
      rows: (
        <>
          <PolicyToggle label="Enforce 2FA org-wide" hint="Require every member to enable an authenticator." on={policies.enforce2fa} onClick={() => patch({ enforce2fa: !policies.enforce2fa })} />
          <PolicySelect label="Password strength" hint="Minimum complexity for new passwords." value={policies.pwdStrength} opts={[["standard", "Standard"], ["strong", "Strong"], ["max", "Maximum"]]} onChange={(v) => patch({ pwdStrength: v as OrgPolicies["pwdStrength"] })} />
          <PolicyToggle label="Single sign-on (SSO)" hint="Delegate auth to an identity provider." on={policies.sso} onClick={() => patch({ sso: !policies.sso })} last />
        </>
      ),
    },
    {
      title: "Access control", sub: "Where and how members can connect.", icon: IconShieldCheck, iconBg: "rgba(42,111,219,0.1)", iconColor: "#2A6FDB",
      rows: (
        <>
          <PolicyToggle label="IP allowlist" hint="Restrict sign-in to approved networks." on={policies.ipAllowlist} onClick={() => patch({ ipAllowlist: !policies.ipAllowlist })} />
          <PolicyToggle label="Device trust" hint="Remember and verify known devices." on={policies.deviceTrust} onClick={() => patch({ deviceTrust: !policies.deviceTrust })} />
          <PolicySelect label="Session timeout" hint="Auto-sign-out after inactivity." value={policies.sessionTimeout} opts={[["1h", "1 hour"], ["8h", "8 hours"], ["24h", "24 hours"], ["7d", "7 days"]]} onChange={(v) => patch({ sessionTimeout: v })} last />
        </>
      ),
    },
    {
      title: "Financial controls", sub: "Dual-control on money movement.", icon: IconShieldCheck, iconBg: "rgba(124,58,237,0.1)", iconColor: "#7c3aed",
      rows: (
        <>
          <PolicyToggle label="Dual approval on remittances" hint="Two sign-offs before a payout releases." on={policies.dualRemit} onClick={() => patch({ dualRemit: !policies.dualRemit })} last />
          <div className="pt-2 text-xs text-slate-400">Spend approval thresholds are managed by the finance approval engine and are already enforced live.</div>
        </>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {cards.map((c) => (
          <Card key={c.title} className="flex flex-col">
            <CardHeader icon={c.icon} iconBg={c.iconBg} iconColor={c.iconColor} title={c.title} sub={c.sub} />
            <div className="px-5 pb-3 flex-1">{c.rows}</div>
          </Card>
        ))}
      </div>
      <div className="flex items-center gap-3 bg-[#151936] rounded-[18px] px-4.5 py-3.5 shadow-[0_12px_30px_rgba(21,25,54,0.18)] flex-wrap">
        <IconShieldCheck size={20} className="text-[#f3df27] shrink-0" />
        <p className="flex-1 text-xs text-white/80 leading-relaxed">Policy changes apply organization-wide and are logged to the audit trail. As super-admin, your edits take effect immediately across all {memberTotal} members. Org security posture: <span className="font-medium text-white">{score?.label ?? "—"} ({score?.pct ?? "—"}%)</span>.</p>
      </div>
    </div>
  );
}
function PolicyToggle({ label, hint, on, onClick, last }: { label: string; hint: string; on: boolean; onClick: () => void; last?: boolean }) {
  return (
    <div className={cn("flex items-center justify-between gap-3.5 py-3", !last && "border-b border-slate-50")}>
      <div className="min-w-0"><p className="text-sm font-medium text-slate-700">{label}</p><p className="text-xs text-slate-400 mt-0.5 leading-snug">{hint}</p></div>
      <Toggle label={label} on={on} onClick={onClick} />
    </div>
  );
}
function PolicySelect({ label, hint, value, opts, onChange, last }: { label: string; hint: string; value: string; opts: string[][]; onChange: (v: string) => void; last?: boolean }) {
  return (
    <div className={cn("flex items-center justify-between gap-3.5 py-3", !last && "border-b border-slate-50")}>
      <div className="min-w-0"><p className="text-sm font-medium text-slate-700">{label}</p><p className="text-xs text-slate-400 mt-0.5 leading-snug">{hint}</p></div>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="box-border border border-slate-200 rounded-[10px] px-3 py-2 text-xs font-medium text-slate-700 bg-white outline-none">{opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
    </div>
  );
}

// ── SYSTEM (org) ─────────────────────────────────────────────────────────────
export function SystemSection({ entityId }: { entityId: string }) {
  const [data, setData] = useState<{ integrations: { integrations: Integration[]; healthy: number; total: number }; audit: Array<{ id: string; actorName: string | null; action: string; summary: string; createdAt: string }> } | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    Promise.resolve().then(() => {
      setLoading(true);
      fetch(`/api/account/system-overview?entityId=${entityId}`).then((r) => r.json()).then((d) => setData({ integrations: d.integrations, audit: d.audit ?? [] })).catch(() => { }).finally(() => setLoading(false));
    });
  }, [entityId]);

  const statusStyle = (s: string) => s === "healthy" ? { dot: "#10b981", pill: "bg-emerald-50 text-emerald-700" } : s === "down" ? { dot: "#f43f5e", pill: "bg-rose-50 text-rose-700" } : { dot: "#94a3b8", pill: "bg-slate-100 text-slate-500" };

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader icon={IconPlugConnected} iconBg="rgba(16,185,129,0.12)" iconColor="#10b981" title={`Integrations ${data ? `${data.integrations.healthy}/${data.integrations.total} healthy` : ""}`} sub="Systems feeding the Sunland ledger and comms." />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-5">
          {loading ? Array.from({ length: 6 }).map((_, i) => <SkeletonBlock key={i} className="h-24 rounded-2xl" />)
            : data?.integrations.integrations.map((ig) => {
              const st = statusStyle(ig.status);
              return (
                <div key={ig.key} className="border border-slate-100 rounded-2xl p-4 flex flex-col gap-2.5 bg-[#fcfcfa]">
                  <div className="flex items-center gap-2.5">
                    <span className="size-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-slate-500 shrink-0"><IconDatabaseCog size={20} /></span>
                    <div className="flex-1 min-w-0"><p className="text-sm font-medium text-slate-900 truncate">{ig.name}</p><p className="text-xs text-slate-400">{ig.kind}</p></div>
                    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium capitalize", st.pill)}><span className="size-1.5 rounded-full" style={{ background: st.dot }} />{ig.status}</span>
                  </div>
                  <div className="border-t border-slate-100 pt-2.5"><span className="text-xs font-mono text-slate-400">{ig.meta}</span></div>
                </div>
              );
            })}
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-4 items-start">
        <Card className="p-5 flex flex-col gap-3.5">
          <div className="flex items-center gap-2.5">
            <span className="size-9 rounded-xl bg-[rgba(124,58,237,0.1)] text-[#7c3aed] flex items-center justify-center"><IconDatabaseCog size={19} /></span>
            <div><p className="text-base font-medium text-slate-900">Data &amp; keys</p><p className="text-xs text-slate-400">Exports and backups.</p></div>
          </div>
          <div className="flex items-center gap-2.5 bg-[#fafbf8] border border-slate-100 rounded-2xl px-3.5 py-3">
            <IconCloudCheck size={19} className="text-emerald-500 shrink-0" />
            <div><p className="text-xs font-medium text-slate-700">Neon automated backups</p><p className="text-xs font-mono text-slate-400">Point-in-time recovery · managed by Neon</p></div>
          </div>
          <a href={`/api/audit?entityId=${entityId}&limit=200`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50"><IconRestore size={15} /> Export org audit (JSON)</a>
        </Card>

        <Card>
          <CardHeader icon={IconHistory} iconBg="rgba(21,25,54,0.07)" iconColor="#151936" title="Organization audit log" sub="Admin &amp; security events across the org." />
          <ul className="px-5 py-4 flex flex-col">
            {loading ? Array.from({ length: 4 }).map((_, i) => <SkeletonBlock key={i} className="h-10 w-full rounded-lg mb-2" />)
              : (data?.audit ?? []).length === 0 ? <li className="text-sm text-slate-400 text-center py-4">No recent activity.</li>
                : (data?.audit ?? []).map((l, i, arr) => (
                  <li key={l.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span className={cn("size-[11px] rounded-full mt-0.5 shrink-0 ring-2 ring-white", toneForAction(l.action))} />
                      {i !== arr.length - 1 && <span className="w-[1.5px] flex-1 bg-slate-100 my-1" />}
                    </div>
                    <div className="min-w-0 flex-1 pb-3.5">
                      <p className="text-xs text-slate-700"><span className="font-medium text-slate-900">{l.actorName ?? "System"}</span> · {l.summary}</p>
                      <p className="text-xxs font-mono text-slate-400 mt-0.5">{relativeTime(l.createdAt)}</p>
                    </div>
                  </li>
                ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

