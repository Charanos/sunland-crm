"use client";

import { useState, useEffect } from "react";
import {
  IconShieldLock,
  IconDeviceLaptop,
  IconEye,
  IconEyeOff,
  IconKey,
  IconAlertTriangle,
  IconCircleCheckFilled,
  IconCheck,
  IconUsers,
  IconActivity,
  IconLock,
  IconShieldCheck,
  IconChevronDown,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils/cn";
import { useToast } from "@/components/ui/toast-provider";
import type { UserRole } from "@/types";

// ── RBAC config for security section visibility ───────────────────────────────

const SECURITY_ROLE_CONFIG: Record<string, {
  canSeeUserManagement: boolean;
  canSeeAuditLog: boolean;
  canSeeThreatMonitor: boolean;
  canSeeSessionManagement: boolean;
}> = {
  // Global executives — full access
  ceo: { canSeeUserManagement: true, canSeeAuditLog: true, canSeeThreatMonitor: true, canSeeSessionManagement: true },
  general_manager: { canSeeUserManagement: true, canSeeAuditLog: true, canSeeThreatMonitor: true, canSeeSessionManagement: true },
  auditor: { canSeeUserManagement: false, canSeeAuditLog: true, canSeeThreatMonitor: true, canSeeSessionManagement: false },
  auditor_compliance: { canSeeUserManagement: false, canSeeAuditLog: true, canSeeThreatMonitor: true, canSeeSessionManagement: false },
  // Finance admin — finance-scoped
  finance_head: { canSeeUserManagement: false, canSeeAuditLog: true, canSeeThreatMonitor: false, canSeeSessionManagement: true },
  accounts_manager: { canSeeUserManagement: false, canSeeAuditLog: true, canSeeThreatMonitor: false, canSeeSessionManagement: true },
  // Finance members — own sessions only
  finance_officer: { canSeeUserManagement: false, canSeeAuditLog: false, canSeeThreatMonitor: false, canSeeSessionManagement: true },
  accounts_officer: { canSeeUserManagement: false, canSeeAuditLog: false, canSeeThreatMonitor: false, canSeeSessionManagement: true },
};

function getRoleConfig(role: string) {
  return SECURITY_ROLE_CONFIG[role] ?? {
    canSeeUserManagement: false, canSeeAuditLog: false, canSeeThreatMonitor: false, canSeeSessionManagement: true
  };
}

// ── Mock data ──────────────────────────────────────────────────────────────────

const AUDIT_LOG = [
  { id: "1", actor: "Paul Amos", action: "Approved payroll run PR-2026-06", ip: "196.254.12.8", at: "10 min ago", risk: "low" as const },
  { id: "2", actor: "Grace Omondi", action: "Exported chart of accounts (CSV)", ip: "41.215.8.122", at: "1 hour ago", risk: "medium" as const },
  { id: "3", actor: "James Mutua", action: "3 failed login attempts", ip: "197.248.64.10", at: "2 hours ago", risk: "high" as const },
  { id: "4", actor: "System", action: "Automated backup completed", ip: "Internal", at: "4 hours ago", risk: "low" as const },
  { id: "5", actor: "Amina Hassan", action: "Role changed: rentals_officer → finance_officer", ip: "41.215.8.121", at: "Yesterday", risk: "medium" as const },
  { id: "6", actor: "Paul Amos", action: "Two-factor auth configured for peter.k@sunland.co.ke", ip: "196.254.12.8", at: "2 days ago", risk: "low" as const },
];

const PLATFORM_USERS = [
  { id: "u1", name: "Paul Amos", email: "paul.amos@sunland.co.ke", role: "ceo", status: "active", lastLogin: "Active now", mfa: true },
  { id: "u2", name: "Grace Omondi", email: "grace.omondi@sunland.co.ke", role: "finance_officer", status: "active", lastLogin: "2h ago", mfa: false },
  { id: "u3", name: "James Mutua", email: "james.mutua@sunland.co.ke", role: "bd_head", status: "active", lastLogin: "Yesterday", mfa: true },
  { id: "u4", name: "Amina Hassan", email: "amina.hassan@sunland.co.ke", role: "property_manager", status: "active", lastLogin: "3h ago", mfa: false },
  { id: "u5", name: "Peter Kariuki", email: "peter.k@sunland.co.ke", role: "operations_lead", status: "inactive", lastLogin: "5 days ago", mfa: true },
];

const RISK_COLORS = {
  low: "text-emerald-600 bg-emerald-50",
  medium: "text-amber-600 bg-amber-50",
  high: "text-red-600 bg-red-50",
};

// ── Password Change Form ───────────────────────────────────────────────────────

function PasswordSection({ onSave }: { onSave: () => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);

  const strength = next.length === 0 ? 0 : next.length < 6 ? 1 : next.length < 10 ? 2 : next.length < 14 ? 3 : 4;
  const strengthLabels = ["", "Weak", "Fair", "Strong", "Very Strong"];
  const strengthColors = ["", "bg-red-400", "bg-amber-400", "bg-emerald-400", "bg-emerald-600"];

  return (
    <div className="space-y-4">
      {/* Password strength indicator */}
      {next.length > 0 && (
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-tiny text-slate-500">Password strength</span>
            <span className={cn("text-tiny", strength >= 3 ? "text-emerald-600" : strength === 2 ? "text-amber-600" : "text-red-500")}>
              {strengthLabels[strength]}
            </span>
          </div>
          <div className="flex gap-1">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className={cn("h-1.5 flex-1 rounded-full transition-all", i <= strength ? strengthColors[strength] : "bg-slate-200")} />
            ))}
          </div>
        </div>
      )}

      {[
        { label: "Current password", value: current, onChange: setCurrent, show: showCurrent, toggle: () => setShowCurrent(p => !p) },
        { label: "New password", value: next, onChange: setNext, show: showNext, toggle: () => setShowNext(p => !p) },
        { label: "Confirm new password", value: confirm, onChange: setConfirm, show: showNext, toggle: () => {} },
      ].map(field => (
        <div key={field.label}>
          <label className="label-caps text-slate-400 mb-1.5 block">{field.label}</label>
          <div className="relative">
            <input
              type={field.show ? "text" : "password"}
              value={field.value}
              onChange={e => field.onChange(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 pr-10 text-caption text-slate-800 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-100 transition-all"
            />
            {field.label !== "Confirm new password" && (
              <button type="button" onClick={field.toggle}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                {field.show ? <IconEyeOff size={15} /> : <IconEye size={15} />}
              </button>
            )}
          </div>
        </div>
      ))}

      <button type="button" onClick={onSave}
        className="flex items-center gap-2 rounded-xl bg-[var(--sidebar)] px-4 py-2.5 text-caption text-white shadow-sm hover:opacity-90 transition-opacity">
        <IconKey size={14} />
        Update Password
      </button>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function SecurityPage() {
  const { pushToast } = useToast();

  // Mock current user role (in production, derive from session)
  const [currentRole] = useState<UserRole>("ceo");
  const perms = getRoleConfig(currentRole);

  const formatRole = (role: string) =>
    role.split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")
      .replace("Ceo", "CEO").replace("Bd", "BD").replace("Hr", "HR");

  return (
    <div className="mx-auto max-w-[88rem] flex flex-col gap-6 pb-12 animate-fade-in">

      {/* ── Header ───────────────────────────────────────── */}
      <div>
        <p className="label-caps text-[var(--on-surface-dim)] mb-1">Access Control</p>
        <h1 className="headline-lg text-slate-900">Security & Access</h1>
        <p className="body-sm text-slate-500 mt-1">Manage platform security settings, session control, and access audit logs.</p>
      </div>

      {/* ── Security Score Banner ────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-tertiary-gradient p-5 md:p-6">
        <div className="absolute inset-0 opacity-[0.04]" style={{
          backgroundImage: "radial-gradient(circle at 20% 50%, white 2px, transparent 0)",
          backgroundSize: "40px 40px"
        }} />
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center gap-4">
          <div className="size-14 shrink-0 rounded-2xl bg-white/10 flex items-center justify-center">
            <IconShieldCheck size={28} className="text-white" />
          </div>
          <div className="flex-1">
            <p className="text-caption text-white/60 mb-0.5">Platform Security Score</p>
            <div className="flex items-center gap-3">
              <span className="headline-lg text-white">82 / 100</span>
              <span className="badge-pill bg-emerald-400/20 text-emerald-300 border border-emerald-400/20">Good</span>
            </div>
            <div className="mt-2 h-1.5 w-56 rounded-full bg-white/10">
              <div className="h-full w-[82%] rounded-full bg-emerald-400" />
            </div>
          </div>
          <div className="text-right">
            <p className="text-tiny text-white/50">Next recommendation</p>
            <p className="text-caption text-amber-300 mt-0.5 flex items-center gap-1.5">
              <IconAlertTriangle size={13} />
              Enable 2FA for 3 users
            </p>
          </div>
        </div>
      </div>

      {/* ── Main Grid ────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

        {/* Left column */}
        <div className="lg:col-span-5 flex flex-col gap-5">

          {/* Password */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
            <div className="flex items-center gap-3 mb-5">
              <div className="size-9 rounded-xl bg-slate-100 flex items-center justify-center">
                <IconKey size={17} className="text-slate-600" />
              </div>
              <h2 className="headline-md text-slate-900">Change Password</h2>
            </div>
            <PasswordSection onSave={() => pushToast({ tone: "success", title: "Password updated", body: "Your new password is active." })} />
          </div>

          {/* Two-factor auth */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
            <div className="flex items-center gap-3 mb-4">
              <div className="size-9 rounded-xl bg-slate-100 flex items-center justify-center">
                <IconShieldLock size={17} className="text-slate-600" />
              </div>
              <h2 className="headline-md text-slate-900">Two-Factor Auth</h2>
            </div>
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-100 flex items-start gap-2.5 mb-4">
              <IconAlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
              <p className="text-caption text-amber-700">2FA is not yet enabled on your account. Enable it to protect your session.</p>
            </div>
            <button type="button" onClick={() => pushToast({ tone: "success", title: "2FA setup started", body: "Check your authenticator app." })}
              className="flex items-center gap-2 rounded-xl bg-[var(--sidebar)] px-4 py-2.5 text-caption text-white shadow-sm hover:opacity-90 transition-opacity">
              <IconShieldLock size={14} />
              Enable Two-Factor Auth
            </button>
          </div>

          {/* Active sessions — always visible */}
          {perms.canSeeSessionManagement && (
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="size-9 rounded-xl bg-slate-100 flex items-center justify-center">
                    <IconDeviceLaptop size={17} className="text-slate-600" />
                  </div>
                  <h2 className="headline-md text-slate-900">Active Sessions</h2>
                </div>
                <button type="button" onClick={() => pushToast({ tone: "warning", title: "Sessions revoked", body: "All other devices have been signed out." })}
                  className="text-tiny text-rose-500 hover:text-rose-700 transition-colors">
                  Revoke all others
                </button>
              </div>
              <div className="space-y-2">
                {[
                  { device: "MacBook Pro 14\"", browser: "Chrome 126", location: "Nairobi, KE", time: "Active now", current: true },
                  { device: "iPhone 15 Pro", browser: "Safari Mobile", location: "Nairobi, KE", time: "2 hours ago", current: false },
                ].map((s, i) => (
                  <div key={i} className={cn(
                    "flex items-center gap-3 rounded-xl border p-3",
                    s.current ? "border-emerald-200 bg-emerald-50/50" : "border-slate-100"
                  )}>
                    <IconDeviceLaptop size={16} className={s.current ? "text-emerald-600" : "text-slate-400"} />
                    <div className="flex-1 min-w-0">
                      <p className="text-caption text-slate-800">{s.device}</p>
                      <p className="text-tiny text-slate-400">{s.browser} · {s.location} · {s.time}</p>
                    </div>
                    {s.current
                      ? <span className="badge-pill badge-tone-success">Current</span>
                      : <button type="button" onClick={() => pushToast({ tone: "warning", title: "Session revoked", body: `${s.device} has been signed out.` })}
                          className="text-tiny text-rose-500 hover:text-rose-700">Revoke</button>
                    }
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="lg:col-span-7 flex flex-col gap-5">

          {/* User management — CEO / GM only */}
          {perms.canSeeUserManagement && (
            <div className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_4px_rgba(0,0,0,0.04)] overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="size-9 rounded-xl bg-slate-100 flex items-center justify-center">
                    <IconUsers size={17} className="text-slate-600" />
                  </div>
                  <h2 className="headline-md text-slate-900">Platform Users</h2>
                </div>
                <button type="button" className="text-tiny text-[var(--tertiary)] hover:opacity-70 transition-opacity flex items-center gap-1">
                  Manage all <IconChevronDown size={12} className="rotate-[-90deg]" />
                </button>
              </div>
              <div className="divide-y divide-slate-100">
                {PLATFORM_USERS.map(user => (
                  <div key={user.id} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50/50 transition-colors">
                    <div className="size-8 shrink-0 rounded-full bg-[var(--sidebar)] flex items-center justify-center text-white text-tiny">
                      {user.name.split(" ").map(n => n[0]).join("")}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-caption text-slate-800 truncate">{user.name}</p>
                        {user.mfa && <IconShieldCheck size={12} className="text-emerald-500 shrink-0" title="MFA enabled" />}
                      </div>
                      <p className="text-tiny text-slate-400 truncate">{user.email}</p>
                    </div>
                    <div className="hidden sm:flex flex-col items-end gap-1 shrink-0">
                      <span className="badge-pill badge-tone-neutral">{formatRole(user.role)}</span>
                      <span className="text-tiny text-slate-400">{user.lastLogin}</span>
                    </div>
                    <div className={cn("size-2 shrink-0 rounded-full", user.status === "active" ? "bg-emerald-400" : "bg-slate-300")} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Audit log — finance_head+ and auditors */}
          {perms.canSeeAuditLog && (
            <div className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_4px_rgba(0,0,0,0.04)] overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="size-9 rounded-xl bg-slate-100 flex items-center justify-center">
                    <IconActivity size={17} className="text-slate-600" />
                  </div>
                  <h2 className="headline-md text-slate-900">Security Audit Log</h2>
                </div>
                <span className="label-caps text-slate-400">Last 48 hours</span>
              </div>
              <div className="divide-y divide-slate-100">
                {AUDIT_LOG.map(log => (
                  <div key={log.id} className="flex items-start gap-3 px-5 py-3 hover:bg-slate-50/50 transition-colors">
                    <div className={cn("mt-0.5 size-2 shrink-0 rounded-full", log.risk === "high" ? "bg-red-500" : log.risk === "medium" ? "bg-amber-400" : "bg-emerald-400")} />
                    <div className="flex-1 min-w-0">
                      <p className="text-caption text-slate-800">
                        <span className="text-slate-500">{log.actor}</span>
                        {" — "}
                        {log.action}
                      </p>
                      <p className="text-tiny text-slate-400 mt-0.5">{log.ip} · {log.at}</p>
                    </div>
                    <span className={cn("badge-pill shrink-0", RISK_COLORS[log.risk])}>
                      {log.risk}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* If limited role (finance members): show only personal notice */}
          {!perms.canSeeUserManagement && !perms.canSeeAuditLog && (
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_4px_rgba(0,0,0,0.04)] flex items-center gap-4">
              <div className="size-10 shrink-0 rounded-full bg-blue-50 flex items-center justify-center">
                <IconLock size={18} className="text-blue-500" />
              </div>
              <div>
                <p className="text-label text-slate-800">Limited Security View</p>
                <p className="text-caption text-slate-500 mt-0.5">You can manage your own password and active sessions. Contact an administrator for additional access.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
