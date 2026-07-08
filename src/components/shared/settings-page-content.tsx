"use client";

import { useState, useCallback } from "react";
import { BoardHeader } from "@/components/ui/erp-primitives";
import {
  IconBuilding,
  IconClock,
  IconBell,
  IconPalette,
  IconInfoCircle,
  IconCheck,
  IconChevronRight,
  IconDatabase,
  IconDownload,
  IconMail,
  IconDeviceMobile,
  IconAlertTriangle,
  IconArrowsExchange,
  IconRefresh,
  IconSun,
  IconMoon,
  IconDeviceDesktop,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils/cn";
import { useToast } from "@/components/ui/toast-provider";
import { PageTransition } from "./page-transition";

// ── Types ──────────────────────────────────────────────────────────────────────

interface WorkspaceSettings {
  organizationName: string;
  timezone: string;
  currency: string;
  fiscalYearStart: string;
  dateFormat: string;
  country: string;
}

interface DisplaySettings {
  theme: "light" | "dark" | "system";
  sidebarCollapsed: boolean;
  compactTables: boolean;
  showAvatars: boolean;
  animationsEnabled: boolean;
  accentColor: string;
  density: "comfortable" | "compact" | "spacious";
}

interface NotificationSettings {
  emailDigest: boolean;
  pushNotifications: boolean;
  chequeAlerts: boolean;
  payrollReminders: boolean;
  leaseExpiry: boolean;
  approvalRequired: boolean;
  systemUpdates: boolean;
  marketingEmails: boolean;
  weeklyReport: boolean;
  digestFrequency: "daily" | "weekly" | "monthly";
}

interface DataSettings {
  autoBackup: boolean;
  backupFrequency: "daily" | "weekly" | "monthly";
  retentionPeriod: "90d" | "180d" | "1y" | "3y";
  exportFormat: "csv" | "xlsx" | "pdf";
  analyticsTracking: boolean;
}

interface AllSettings {
  workspace: WorkspaceSettings;
  display: DisplaySettings;
  notifications: NotificationSettings;
  data: DataSettings;
}

// ── Defaults ───────────────────────────────────────────────────────────────────

const DEFAULTS: AllSettings = {
  workspace: {
    organizationName: "Sunland Real Estate Limited",
    timezone: "Africa/Nairobi",
    currency: "KES",
    fiscalYearStart: "January",
    dateFormat: "DD/MM/YYYY",
    country: "Kenya",
  },
  display: {
    theme: "light",
    sidebarCollapsed: false,
    compactTables: false,
    showAvatars: true,
    animationsEnabled: true,
    accentColor: "#151936",
    density: "comfortable",
  },
  notifications: {
    emailDigest: true,
    pushNotifications: true,
    chequeAlerts: true,
    payrollReminders: true,
    leaseExpiry: true,
    approvalRequired: true,
    systemUpdates: true,
    weeklyReport: true,
    marketingEmails: false,
    digestFrequency: "weekly",
  },
  data: {
    autoBackup: true,
    backupFrequency: "daily",
    retentionPeriod: "1y",
    exportFormat: "xlsx",
    analyticsTracking: true,
  },
};

const STORAGE_KEY = "sunland_settings";

// ── Hooks ──────────────────────────────────────────────────────────────────────

function usePersistedSettings() {
  const [settings, setSettings] = useState<AllSettings>(() => {
    if (typeof window === "undefined") return DEFAULTS;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) return { ...DEFAULTS, ...JSON.parse(stored) } as AllSettings;
    } catch { /* ignore malformed JSON */ }
    return DEFAULTS;
  });

  const save = useCallback((updated: AllSettings) => {
    setSettings(updated);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(updated)); } catch { /* ignore */ }
  }, []);

  return { settings, save, loaded: true };
}

// ── Sub-components ─────────────────────────────────────────────────────────────

const SETTINGS_TABS = [
  { id: "workspace", label: "Workspace", icon: IconBuilding },
  { id: "display", label: "Display", icon: IconPalette },
  { id: "notifications", label: "Notifications", icon: IconBell },
  { id: "data", label: "Data & Export", icon: IconDatabase },
  { id: "about", label: "About", icon: IconInfoCircle },
] as const;

type SettingsTab = typeof SETTINGS_TABS[number]["id"];

function SettingRow({ label, desc, children }: { label: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-4 border-b border-slate-100 last:border-0">
      <div className="flex-1 pr-6">
        <p className="text-sm text-slate-800">{label}</p>
        {desc && <p className="text-sm text-slate-400 mt-0.5 leading-relaxed">{desc}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: () => void }) {
  return (
    <button type="button" onClick={onChange}
      className={cn("relative w-10 h-5 rounded-full transition-all duration-200", enabled ? "bg-[var(--sidebar)]" : "bg-slate-200")}>
      <span className={cn("absolute top-0.5 size-4 rounded-full bg-white shadow-sm transition-transform duration-200", enabled ? "translate-x-5" : "translate-x-0.5")} />
    </button>
  );
}

function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:border-[var(--sidebar)] transition-all">
      {options.map(o => <option key={o}>{o}</option>)}
    </select>
  );
}

function PanelCard({ title, desc, children, onSave }: { title: string; desc?: string; children: React.ReactNode; onSave?: () => void }) {
  return (
    <div className="gsap-stagger rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
      <div className="flex items-center justify-between mb-1">
        <h2 className="headline-md font-serif text-slate-900">{title}</h2>
        {onSave && (
          <button type="button" onClick={onSave}
            className="flex items-center gap-1.5 rounded-xl bg-[var(--sidebar)] px-4 py-1.5 text-sm text-white shadow-sm hover:opacity-90 transition-opacity">
            <IconCheck size={12} />
            Save
          </button>
        )}
      </div>
      {desc && <p className="text-sm text-slate-400 mb-4">{desc}</p>}
      <div>{children}</div>
    </div>
  );
}

// ── Main Shared Page ───────────────────────────────────────────────────────────

export function SettingsPageContent() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("workspace");
  const { settings, save, loaded } = usePersistedSettings();
  const { pushToast } = useToast();
  const [exporting, setExporting] = useState(false);
  const [clearing, setClearing] = useState(false);

  const update = <K extends keyof AllSettings>(section: K, patch: Partial<AllSettings[K]>) => {
    save({ ...settings, [section]: { ...settings[section], ...patch } });
  };

  const saveSection = (section: string) => {
    pushToast({ tone: "success", title: "Settings saved", body: `${section} preferences have been updated.` });
  };

  const handleExportData = async () => {
    setExporting(true);
    await new Promise(r => setTimeout(r, 1200));
    const blob = new Blob([JSON.stringify({ exported: new Date().toISOString(), settings }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "sunland-data-export.json"; a.click();
    URL.revokeObjectURL(url);
    setExporting(false);
    pushToast({ tone: "success", title: "Export complete", body: "Your data has been exported as JSON." });
  };

  const handleClearCache = async () => {
    setClearing(true);
    await new Promise(r => setTimeout(r, 800));
    try {
      Object.keys(localStorage).filter(k => k.startsWith("sunland_cache_")).forEach(k => localStorage.removeItem(k));
    } catch { /* ignore */ }
    setClearing(false);
    pushToast({ tone: "success", title: "Cache cleared", body: "Local data cache has been flushed." });
  };

  const handleResetSettings = () => {
    save(DEFAULTS);
    pushToast({ tone: "warning", title: "Settings reset", body: "All preferences restored to defaults." });
  };

  if (!loaded) {
    return <div className="h-48 rounded-2xl skeleton-shimmer bg-slate-100 animate-pulse animate-fade-in" />;
  }

  return (
    <PageTransition className="mx-auto max-w-[98rem] flex flex-col gap-6 pb-12 px-4 md:px-6">

      <BoardHeader
        title="Settings & Preferences"
        description="Manage workspace configuration, display, notifications, and data."
      />

      {/* ── Tabs ─── */}
      <div className="flex flex-wrap gap-2 border-b border-slate-100 pb-2 mb-2">
        {SETTINGS_TABS.map(tab => (
          <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)}
            className={cn(
              "inline-flex px-4 py-2 text-sm font-medium rounded-xl transition-all flex items-center gap-1.5",
              activeTab === tab.id
                ? "bg-[#151936] text-white shadow-sm"
                : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
            )}>
            <tab.icon size={14} className="shrink-0" />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-5">

        {/* ── Content ─── */}
        <div className="space-y-5 min-w-0">

          {/* Workspace */}
          {activeTab === "workspace" && (
            <PanelCard title="Workspace Configuration" desc="Global organizational settings for your Sunland ERP instance."
              onSave={() => saveSection("Workspace")}>
              {([
                {
                  label: "Organization Name", desc: "The legal trading name shown across all reports.",
                  control: (
                    <input value={settings.workspace.organizationName}
                      onChange={e => update("workspace", { organizationName: e.target.value })}
                      className="w-56 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:border-[var(--sidebar)] transition-all" />
                  )
                },
                {
                  label: "Country", desc: "Primary operating jurisdiction.",
                  control: <Select value={settings.workspace.country} onChange={v => update("workspace", { country: v })} options={["Kenya", "Uganda", "Tanzania", "Rwanda", "Ethiopia"]} />
                },
                {
                  label: "Timezone", desc: "System-wide timestamp reference.",
                  control: <Select value={settings.workspace.timezone} onChange={v => update("workspace", { timezone: v })} options={["Africa/Nairobi", "UTC", "Africa/Johannesburg", "Europe/London"]} />
                },
                {
                  label: "Currency", desc: "Base currency for financial reporting.",
                  control: <Select value={settings.workspace.currency} onChange={v => update("workspace", { currency: v })} options={["KES", "USD", "EUR", "GBP", "ZAR"]} />
                },
                {
                  label: "Fiscal Year Start", desc: "First month of your financial year.",
                  control: <Select value={settings.workspace.fiscalYearStart} onChange={v => update("workspace", { fiscalYearStart: v })} options={["January", "April", "July", "October"]} />
                },
                {
                  label: "Date Format", desc: "How dates are displayed across the platform.",
                  control: <Select value={settings.workspace.dateFormat} onChange={v => update("workspace", { dateFormat: v })} options={["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]} />
                },
              ] as { label: string; desc: string; control: React.ReactNode }[]).map(item => (
                <SettingRow key={item.label} label={item.label} desc={item.desc}>{item.control}</SettingRow>
              ))}
            </PanelCard>
          )}

          {/* Display */}
          {activeTab === "display" && (
            <PanelCard title="Display & Appearance" desc="Customize how the ERP looks and feels."
              onSave={() => saveSection("Display")}>

              {/* Theme selector */}
              <div className="py-4 border-b border-slate-100">
                <p className="text-sm text-slate-800 mb-3">Theme</p>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { value: "light", label: "Light", icon: IconSun },
                    { value: "dark", label: "Dark", icon: IconMoon },
                    { value: "system", label: "System", icon: IconDeviceDesktop },
                  ] as { value: DisplaySettings["theme"]; label: string; icon: typeof IconSun }[]).map(t => (
                    <button key={t.value} type="button" onClick={() => update("display", { theme: t.value })}
                      className={cn(
                        "flex flex-col items-center gap-1.5 rounded-xl border p-3 transition-all",
                        settings.display.theme === t.value
                          ? "border-[var(--sidebar)] bg-[var(--sidebar)]/5 text-[var(--sidebar)]"
                          : "border-slate-200 text-slate-500 hover:border-slate-300"
                      )}>
                      <t.icon size={18} />
                      <span className="text-sm">{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <SettingRow label="Density" desc="Controls table row height and spacing.">
                <Select value={settings.display.density}
                  onChange={v => update("display", { density: v as DisplaySettings["density"] })}
                  options={["comfortable", "compact", "spacious"]} />
              </SettingRow>
              <SettingRow label="Compact Tables" desc="Reduce padding in data tables.">
                <Toggle enabled={settings.display.compactTables} onChange={() => update("display", { compactTables: !settings.display.compactTables })} />
              </SettingRow>
              <SettingRow label="Show Avatars" desc="Display user avatars in tables and lists.">
                <Toggle enabled={settings.display.showAvatars} onChange={() => update("display", { showAvatars: !settings.display.showAvatars })} />
              </SettingRow>
              <SettingRow label="Animations" desc="Enable micro-animations and transitions.">
                <Toggle enabled={settings.display.animationsEnabled} onChange={() => update("display", { animationsEnabled: !settings.display.animationsEnabled })} />
              </SettingRow>
              <SettingRow label="Sidebar Auto-Collapse" desc="Collapse sidebar automatically on smaller screens.">
                <Toggle enabled={settings.display.sidebarCollapsed} onChange={() => update("display", { sidebarCollapsed: !settings.display.sidebarCollapsed })} />
              </SettingRow>

              {/* Accent color */}
              <div className="py-4 flex items-center justify-between border-b border-slate-100">
                <div>
                  <p className="text-sm text-slate-800">Accent Color</p>
                  <p className="text-sm text-slate-400 mt-0.5">Highlight color for buttons and active states.</p>
                </div>
                <div className="flex items-center gap-2">
                  {["#151936", "#122a20", "#1e3a5f", "#7c3aed", "#0ea5e9"].map(color => (
                    <button key={color} type="button" onClick={() => update("display", { accentColor: color })}
                      className={cn("size-7 rounded-full border-2 transition-all", settings.display.accentColor === color ? "border-[var(--sidebar)] scale-110 shadow-sm" : "border-transparent hover:scale-105")}
                      style={{ backgroundColor: color }} />
                  ))}
                  <input type="color" value={settings.display.accentColor}
                    onChange={e => update("display", { accentColor: e.target.value })}
                    className="size-7 rounded-full border-0 cursor-pointer bg-transparent" title="Custom color" />
                </div>
              </div>
            </PanelCard>
          )}

          {/* Notifications */}
          {activeTab === "notifications" && (
            <PanelCard title="Notification Preferences" desc="Choose which alerts and digests you receive."
              onSave={() => saveSection("Notifications")}>

              <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-100">
                <p className="text-sm text-slate-800">Digest Frequency</p>
                <Select value={settings.notifications.digestFrequency}
                  onChange={v => update("notifications", { digestFrequency: v as NotificationSettings["digestFrequency"] })}
                  options={["daily", "weekly", "monthly"]} />
              </div>

              {([
                { key: "emailDigest", label: "Email Digest", desc: "Receive a summary via email.", icon: IconMail },
                { key: "pushNotifications", label: "Push Notifications", desc: "Browser push alerts for critical events.", icon: IconDeviceMobile },
                { key: "chequeAlerts", label: "Cheque Clearance Alerts", desc: "Notify when a cheque is cleared or returned.", icon: IconAlertTriangle },
                { key: "payrollReminders", label: "Payroll Reminders", desc: "Alerts before payroll processing deadlines.", icon: IconClock },
                { key: "leaseExpiry", label: "Lease Expiry Notices", desc: "Early warnings for expiring lease agreements.", icon: IconBuilding },
                { key: "approvalRequired", label: "Approval Requests", desc: "Notify when your sign-off is required.", icon: IconCheck },
                { key: "systemUpdates", label: "System Updates", desc: "Platform maintenance and version notices.", icon: IconRefresh },
                { key: "weeklyReport", label: "Weekly Reports", desc: "Automated weekly performance digest.", icon: IconDatabase },
                { key: "marketingEmails", label: "Marketing Emails", desc: "Product updates and feature announcements.", icon: IconMail },
              ] as { key: keyof NotificationSettings; label: string; desc: string; icon: typeof IconMail }[]).map(item => (
                <SettingRow key={item.key} label={item.label} desc={item.desc}>
                  <Toggle
                    enabled={settings.notifications[item.key] as boolean}
                    onChange={() => update("notifications", { [item.key]: !settings.notifications[item.key] })}
                  />
                </SettingRow>
              ))}
            </PanelCard>
          )}

          {/* Data */}
          {activeTab === "data" && (
            <div className="space-y-5">
              <PanelCard title="Backup & Retention" desc="Control how your data is backed up and how long it is kept."
                onSave={() => saveSection("Data")}>
                <SettingRow label="Auto-Backup" desc="Automatically back up data at the set frequency.">
                  <Toggle enabled={settings.data.autoBackup} onChange={() => update("data", { autoBackup: !settings.data.autoBackup })} />
                </SettingRow>
                <SettingRow label="Backup Frequency" desc="How often automatic backups run.">
                  <Select value={settings.data.backupFrequency}
                    onChange={v => update("data", { backupFrequency: v as DataSettings["backupFrequency"] })}
                    options={["daily", "weekly", "monthly"]} />
                </SettingRow>
                <SettingRow label="Retention Period" desc="How long records are kept before archival.">
                  <Select value={settings.data.retentionPeriod}
                    onChange={v => update("data", { retentionPeriod: v as DataSettings["retentionPeriod"] })}
                    options={["90d", "180d", "1y", "3y"]} />
                </SettingRow>
                <SettingRow label="Default Export Format" desc="File format for data exports.">
                  <Select value={settings.data.exportFormat}
                    onChange={v => update("data", { exportFormat: v as DataSettings["exportFormat"] })}
                    options={["xlsx", "csv", "pdf"]} />
                </SettingRow>
                <SettingRow label="Analytics Tracking" desc="Allow anonymous usage analytics to improve the product.">
                  <Toggle enabled={settings.data.analyticsTracking} onChange={() => update("data", { analyticsTracking: !settings.data.analyticsTracking })} />
                </SettingRow>
              </PanelCard>

              <PanelCard title="Data Actions">
                <div className="grid gap-3">
                  {[
                    {
                      label: "Export My Data",
                      desc: "Download all your workspace data as JSON.",
                      icon: IconDownload,
                      tone: "slate",
                      action: handleExportData,
                      loading: exporting,
                      loadingLabel: "Exporting…",
                    },
                    {
                      label: "Clear Cache",
                      desc: "Remove locally cached data and refresh from server.",
                      icon: IconRefresh,
                      tone: "slate",
                      action: handleClearCache,
                      loading: clearing,
                      loadingLabel: "Clearing…",
                    },
                    {
                      label: "Reset All Settings",
                      desc: "Restore all preferences to factory defaults.",
                      icon: IconArrowsExchange,
                      tone: "red",
                      action: handleResetSettings,
                      loading: false,
                      loadingLabel: "",
                    },
                  ].map(item => (
                    <div key={item.label} className={cn(
                      "flex items-center justify-between p-4 rounded-xl border transition-colors",
                      item.tone === "red" ? "border-red-100 bg-red-50/50" : "border-slate-100 bg-white"
                    )}>
                      <div>
                        <p className={cn("text-sm", item.tone === "red" ? "text-red-700" : "text-slate-800")}>{item.label}</p>
                        <p className="text-sm text-slate-400 mt-0.5">{item.desc}</p>
                      </div>
                      <button type="button" onClick={item.action} disabled={item.loading}
                        className={cn(
                          "flex items-center gap-1.5 rounded-xl px-4 py-1.5 text-sm transition-all disabled:opacity-50",
                          item.tone === "red"
                            ? "bg-red-500 text-white hover:bg-red-600"
                            : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 shadow-sm"
                        )}>
                        {item.loading ? <span className="size-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" /> : <item.icon size={13} />}
                        {item.loading ? item.loadingLabel : item.label}
                      </button>
                    </div>
                  ))}
                </div>
              </PanelCard>
            </div>
          )}

          {/* About */}
          {activeTab === "about" && (
            <PanelCard title="About Sunland ERP">
              <div className="space-y-4">
                <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="size-12 rounded-xl bg-[var(--sidebar)] flex items-center justify-center">
                    <IconBuilding size={24} className="text-white" />
                  </div>
                  <div>
                    <p className="text-label text-slate-900">Sunland ERP Platform</p>
                    <p className="text-sm text-slate-500 mt-0.5">Version 2.1.0 · Build 20260627</p>
                  </div>
                </div>

                {[
                  { label: "Release Channel", value: "Production — Stable" },
                  { label: "License", value: "Enterprise — Unlimited Users" },
                  { label: "Data Region", value: "Africa (Nairobi, Kenya)" },
                  { label: "API Version", value: "v3.4.1" },
                  { label: "Last System Update", value: "June 26, 2026" },
                  { label: "Support Contact", value: "support@sunland.co.ke" },
                ].map(item => (
                  <div key={item.label} className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0">
                    <p className="text-sm text-slate-500">{item.label}</p>
                    <p className="text-sm text-slate-800 font-mono">{item.value}</p>
                  </div>
                ))}
              </div>
            </PanelCard>
          )}

        </div>
      </div>
    </PageTransition>
  );
}
