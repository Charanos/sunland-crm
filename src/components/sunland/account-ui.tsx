"use client";

import type { Icon } from "@tabler/icons-react";
import { IconDeviceDesktop, IconDeviceMobile } from "@tabler/icons-react";
import { cn } from "@/lib/utils/cn";

// Shared primitives + helpers for the Account & System console, imported by
// both account-system-board.tsx (shell) and account-sections.tsx (sections).

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

export function relativeTime(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "Just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  return days === 1 ? "Yesterday" : `${days}d ago`;
}

export function deviceIconFor(ua: string | null) {
  const u = (ua ?? "").toLowerCase();
  if (u.includes("iphone") || u.includes("android") || u.includes("mobile")) return IconDeviceMobile;
  return IconDeviceDesktop;
}

export function deviceLabel(ua: string | null): string {
  const u = ua ?? "";
  const browser = /chrome/i.test(u) ? "Chrome" : /firefox/i.test(u) ? "Firefox" : /safari/i.test(u) ? "Safari" : /edg/i.test(u) ? "Edge" : "Browser";
  const os = /windows/i.test(u) ? "Windows" : /mac os|macintosh/i.test(u) ? "macOS" : /android/i.test(u) ? "Android" : /iphone|ios/i.test(u) ? "iPhone" : /linux/i.test(u) ? "Linux" : "Device";
  return `${browser} · ${os}`;
}

export const NOTIF_CATEGORY_ORDER = ["viewing", "remittance", "maintenance", "approval", "renewal", "system"];

export function categoryOf(type: string): string {
  const prefix = (type.split(".")[0] ?? "").toLowerCase();
  const alias: Record<string, string> = { finance: "remittance", approvals: "approval", lease: "renewal", security: "system", manual: "system" };
  return alias[prefix] ?? (NOTIF_CATEGORY_ORDER.includes(prefix) ? prefix : "system");
}

export function toneForAction(action: string): string {
  if (action.includes("login")) return "bg-emerald-400";
  if (action.includes("2fa_disabled") || action.includes("revoke")) return "bg-amber-400";
  if (action.includes("password") || action.includes("2fa_enabled")) return "bg-indigo-400";
  return "bg-slate-300";
}

export function scoreColor(pct: number): string {
  return pct >= 80 ? "#4ade80" : pct >= 55 ? "#f3df27" : "#fb7185";
}

export function RingGauge({ pct, color }: { pct: number; color: string }) {
  const circ = 2 * Math.PI * 26;
  const dash = `${((pct / 100) * circ).toFixed(1)} ${circ.toFixed(1)}`;
  return (
    <svg width="56" height="56" viewBox="0 0 64 64" aria-hidden>
      <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="7" />
      <circle cx="32" cy="32" r="26" fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" strokeDasharray={dash} transform="rotate(-90 32 32)" />
    </svg>
  );
}

export function Toggle({ on, onClick, disabled, label }: { on: boolean; onClick: () => void; disabled?: boolean; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={cn("relative w-10 h-[23px] rounded-full transition-colors shrink-0", on ? "bg-[#122a20]" : "bg-slate-300", disabled && "opacity-55 cursor-not-allowed")}
    >
      <span className={cn("absolute top-[2.5px] left-[2.5px] size-[18px] rounded-full bg-white shadow transition-transform", on && "translate-x-[17px]")} />
    </button>
  );
}

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("bg-white border border-slate-100 rounded-3xl shadow-[0_8px_30px_rgba(0,0,0,0.04)] overflow-hidden", className)}>{children}</div>;
}

export function CardHeader({ icon: IconCmp, iconBg, iconColor, title, sub, action }: { icon: Icon; iconBg: string; iconColor: string; title: string; sub: string; action?: React.ReactNode }) {
  return (
    <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-3">
        <span className="size-9 rounded-xl flex items-center justify-center" style={{ background: iconBg, color: iconColor }}><IconCmp size={19} /></span>
        <div><p className="text-base font-medium text-slate-900">{title}</p><p className="text-xs text-slate-400">{sub}</p></div>
      </div>
      {action}
    </div>
  );
}

// Shared field styles for the Preferences forms.
export const fieldLabel = "block mb-1.5 text-xs font-medium uppercase tracking-[0.07em] text-slate-400";
export const inputCls = "w-full box-border border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-[#151936]/40 focus:ring-2 focus:ring-[#151936]/10 transition-colors";
export const selectCls = inputCls + " bg-white";
