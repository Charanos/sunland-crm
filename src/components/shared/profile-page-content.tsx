"use client";

import { useRef, useState, useCallback, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  IconShieldLock,
  IconBell,
  IconDeviceLaptop,
  IconEdit,
  IconCheck,
  IconX,
  IconCamera,
  IconEye,
  IconEyeOff,
  IconCircleCheckFilled,
  IconShieldCheck,
  IconLogout,
  IconChevronRight,
  IconKey,
  IconClock,
  IconDeviceMobile,
  IconActivity,
  IconLock,
  IconUser,
  IconAlertCircle,
  IconBrandChrome,
  IconBrandSafari,
  IconBrandEdge,
  IconChartPie,
  IconCalendar,
  IconCircleDashed,
  IconMail,
  IconPhone,
  IconBuilding,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils/cn";
import { useToast } from "@/components/ui/toast-provider";
import { PageTransition } from "./page-transition";

// ── Types ──────────────────────────────────────────────────────────────────────

interface UserProfile {
  id: string;
  name: string;
  email: string;
  title: string | null;
  // No `phone` column exists on `users` — kept null rather than a fabricated
  // value; displayed as "Not set" and not offered as an editable field.
  phone: string | null;
  department: string;
  joinDate: string;
  role: string;
  avatarUrl: string | null;
  status: "online" | "busy" | "away";
  accessLevel: string;
  modules: string[];
}

interface ActivityItem {
  id: string;
  action: string;
  module: string;
  time: string;
  tone: "success" | "neutral";
  ref: string | null;
}

interface Session {
  id: string;
  device: string;
  lastActive: string;
  browser: string;
  current: boolean;
  ip: string;
}

// No IP-geolocation service exists in this codebase, so sessions show the
// raw IP rather than a fabricated city/location string.
function parseUserAgent(ua: string | null): { device: string; browser: string } {
  const raw = ua ?? "";
  const browser = raw.includes("Edg") ? "Edge" : raw.includes("Chrome") ? "Chrome" : raw.includes("Safari") ? "Safari" : raw.includes("Firefox") ? "Firefox" : "Unknown browser";
  const device = raw.includes("iPhone")
    ? "iPhone"
    : raw.includes("Android")
      ? "Android device"
      : raw.includes("Mobile")
        ? "Mobile device"
        : raw.includes("Macintosh")
          ? "Mac"
          : raw.includes("Windows")
            ? "Windows PC"
            : "Unknown device";
  return { device, browser };
}

function formatActivityTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "Just now";
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? "" : "s"} ago`;
  const days = Math.floor(hr / 24);
  return days === 1 ? "Yesterday" : `${days} days ago`;
}

// ── Static Data ───────────────────────────────────────────────────────────────

const INITIAL_PROFILE: UserProfile = {
  id: "",
  name: "",
  email: "",
  title: null,
  phone: null,
  department: "Executive Management",
  joinDate: "—",
  role: "ceo",
  avatarUrl: null,
  status: "online",
  accessLevel: "Full Access — All modules",
  modules: [
    "Finance Command",
    "Operations",
    "HR Portal",
    "Properties & Portfolio",
    "Reports & Audit",
    "Security & Admin",
  ],
};


const PROFILE_TABS = [
  { id: "Overview" as const, label: "Overview", icon: IconUser },
  { id: "Password" as const, label: "Password", icon: IconShieldLock },
  { id: "Activity" as const, label: "Activity", icon: IconActivity },
  { id: "Sessions" as const, label: "Sessions", icon: IconDeviceLaptop },
];
type ProfileTab = "Overview" | "Password" | "Activity" | "Sessions";

const MODULE_TONES: Record<string, string> = {
  Finance: "bg-emerald-50 text-emerald-700 border-emerald-100",
  Properties: "bg-blue-50 text-blue-700 border-blue-100",
  Settings: "bg-slate-100 text-slate-600 border-slate-200",
  Reports: "bg-purple-50 text-purple-700 border-purple-100",
  HR: "bg-amber-50 text-amber-700 border-amber-100",
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatRole(role: string) {
  return role
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
    .replace("Ceo", "CEO")
    .replace("Gm", "GM");
}

function getPasswordStrength(pwd: string): {
  score: number;
  label: string;
  color: string;
} {
  if (!pwd) return { score: 0, label: "", color: "" };
  let score = 0;
  if (pwd.length >= 8) score++;
  if (pwd.length >= 12) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  const map = [
    { score: 0, label: "", color: "" },
    { score: 1, label: "Very Weak", color: "bg-rose-500" },
    { score: 2, label: "Weak", color: "bg-orange-400" },
    { score: 3, label: "Fair", color: "bg-amber-400" },
    { score: 4, label: "Strong", color: "bg-emerald-400" },
    { score: 5, label: "Very Strong", color: "bg-emerald-600" },
  ];
  return map[Math.min(score, 5)];
}

function getProfileCompletion(profile: UserProfile) {
  const checks = [
    { key: "name", label: "Full name", done: !!profile.name },
    { key: "email", label: "Email address", done: !!profile.email },
    { key: "phone", label: "Phone number", done: !!profile.phone },
    { key: "department", label: "Department", done: !!profile.department },
    { key: "avatar", label: "Profile photo", done: !!profile.avatarUrl },
  ];
  const done = checks.filter((c) => c.done).length;
  return {
    checks,
    done,
    total: checks.length,
    pct: Math.round((done / checks.length) * 100),
  };
}

function getBrowserIcon(browser: string) {
  if (browser.includes("Chrome")) return IconBrandChrome;
  if (browser.includes("Safari")) return IconBrandSafari;
  if (browser.includes("Edge")) return IconBrandEdge;
  return IconDeviceLaptop;
}

function getDeviceIcon(device: string) {
  if (
    device.includes("iPhone") ||
    device.includes("Android") ||
    device.includes("Mobile")
  )
    return IconDeviceMobile;
  return IconDeviceLaptop;
}

function groupActivityByDay(log: ActivityItem[]) {
  const today: ActivityItem[] = [];
  const yesterday: ActivityItem[] = [];
  const earlier: ActivityItem[] = [];
  log.forEach((item) => {
    if (item.time.includes("min") || item.time.includes("hour"))
      today.push(item);
    else if (item.time === "Yesterday") yesterday.push(item);
    else earlier.push(item);
  });
  const groups: { label: string; items: ActivityItem[] }[] = [];
  if (today.length) groups.push({ label: "Today", items: today });
  if (yesterday.length) groups.push({ label: "Yesterday", items: yesterday });
  if (earlier.length) groups.push({ label: "Earlier", items: earlier });
  return groups;
}

// ── Password Toggle ────────────────────────────────────────────────────────────

function PasswordToggleBtn({
  show,
  toggle,
}: {
  show: boolean;
  toggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={toggle}
      className="text-slate-400 hover:text-slate-600 transition-colors"
    >
      {show ? <IconEyeOff size={15} /> : <IconEye size={15} />}
    </button>
  );
}

// ── Editable Field ─────────────────────────────────────────────────────────────

function EditableField({
  label,
  value,
  type = "text",
  icon: Icon,
  onSave,
}: {
  label: string;
  value: string;
  type?: string;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  onSave: (v: string) => Promise<void> | void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const startEditing = () => {
    setDraft(value);
    setEditing(true);
  };

  const save = async () => {
    if (draft === value) {
      setEditing(false);
      return;
    }
    setIsSaving(true);
    await onSave(draft);
    setIsSaving(false);
    setEditing(false);
  };

  return (
    <div
      className={cn(
        "group relative flex items-start gap-4 py-3.5 px-4 rounded-xl transition-all duration-200",
        editing ? "bg-slate-50" : "hover:bg-slate-50/80"
      )}
    >
      {Icon && (
        <div className="mt-0.5 size-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 transition-colors group-hover:bg-white group-hover:border group-hover:border-slate-200">
          <Icon size={14} className="text-slate-400" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="label-caps text-slate-400 mb-1">{label}</p>
        {editing ? (
          <div className="flex items-center gap-2 mt-1.5">
            <input
              ref={inputRef}
              type={type}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") save();
                if (e.key === "Escape") setEditing(false);
              }}
              className="text-sm flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-slate-800 focus:border-[#151936] focus:outline-none focus:ring-2 focus:ring-[#151936]/10 transition-all"
            />
            <button
              type="button"
              disabled={isSaving}
              onClick={save}
              className="flex size-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors disabled:opacity-50"
            >
              {isSaving ? (
                <span className="size-3 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin" />
              ) : (
                <IconCheck size={13} />
              )}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="flex size-7 items-center justify-center rounded-lg bg-slate-100 text-slate-400 hover:bg-slate-200 transition-colors"
            >
              <IconX size={13} />
            </button>
          </div>
        ) : (
          <p className="text-sm text-slate-800 leading-snug mt-0.5">
            {value || (
              <span className="text-slate-300 italic text-sm">Not set</span>
            )}
          </p>
        )}
      </div>
      {!editing && (
        <button
          type="button"
          onClick={startEditing}
          className="opacity-0 group-hover:opacity-100 mt-0.5 flex size-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-all shrink-0"
        >
          <IconEdit size={13} />
        </button>
      )}
    </div>
  );
}

// ── Avatar Uploader (hero context) ────────────────────────────────────────────

function AvatarUploader({
  current,
  name,
  onChange,
}: {
  current: string | null;
  name: string;
  onChange: (url: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(current);
  const [dragging, setDragging] = useState(false);

  const handleFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        const url = e.target?.result as string;
        setPreview(url);
        onChange(url);
      };
      reader.readAsDataURL(file);
    },
    [onChange]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      className="relative group shrink-0"
      onDrop={onDrop}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
    >
      <div
        className={cn(
          "size-[88px] rounded-full overflow-hidden cursor-pointer transition-all duration-300 shadow-2xl",
          "ring-2 ring-[#f3df27] ring-offset-[3px] ring-offset-[#0f172a]",
          dragging && "ring-4 ring-[#f3df27] scale-105"
        )}
        onClick={() => fileRef.current?.click()}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt="Avatar"
            className="size-full object-cover"
          />
        ) : (
          <div className="size-full bg-[#151936] flex items-center justify-center title-serif text-xl text-[#f3df27]">
            {initials}
          </div>
        )}
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-full">
          <IconCamera size={22} className="text-white" />
        </div>
      </div>
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className="absolute -bottom-1 -right-1 flex size-7 items-center justify-center rounded-full bg-[#f3df27] text-[#151936] shadow-md hover:bg-[#e6d220] transition-all"
      >
        <IconEdit size={11} />
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />
    </div>
  );
}

// ── Profile Completion Bar ─────────────────────────────────────────────────────

function ProfileCompletionBar({ profile }: { profile: UserProfile }) {
  const { checks, done, total, pct } = useMemo(
    () => getProfileCompletion(profile),
    [profile]
  );
  if (pct === 100) return null;

  return (
    <div className="rounded-2xl border border-amber-100 bg-gradient-to-r from-amber-50/60 to-white p-4 flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="size-6 rounded-md bg-amber-100 flex items-center justify-center">
            <IconCircleDashed size={13} className="text-amber-600" />
          </div>
          <p className="text-sm text-amber-800">
            Profile{" "}
            <span className="font-mono">{pct}%</span> complete
          </p>
        </div>
        <span className="font-mono text-sm text-amber-500">
          {done}/{total} fields
        </span>
      </div>
      <div className="w-full h-1 rounded-full bg-amber-100 overflow-hidden">
        <div
          className="h-full bg-amber-400 rounded-full transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {checks
          .filter((c) => !c.done)
          .map((c) => (
            <span
              key={c.key}
              className="px-2 py-0.5 rounded-md text-sm label-caps bg-white border border-amber-200 text-amber-700"
            >
              + {c.label}
            </span>
          ))}
      </div>
    </div>
  );
}

// ── Security Health Card ───────────────────────────────────────────────────────

function SecurityHealthCard({
  onChangeTab,
}: {
  onChangeTab: (tab: ProfileTab) => void;
}) {
  const score = 55;

  const items = [
    {
      icon: IconKey,
      label: "Two-factor authentication",
      value: "Not configured",
      tone: "risk" as const,
      action: "Set up" as string | null,
      onAction: () => onChangeTab("Password"),
    },
    {
      icon: IconLock,
      label: "Password strength",
      value: "Last changed: Unknown",
      tone: "warning" as const,
      action: "Update" as string | null,
      onAction: () => onChangeTab("Password"),
    },
    {
      icon: IconDeviceLaptop,
      label: "Active sessions",
      value: "3 devices signed in",
      tone: "neutral" as const,
      action: "Manage" as string | null,
      onAction: () => onChangeTab("Sessions"),
    },
    {
      icon: IconAlertCircle,
      label: "Suspicious activity",
      value: "None detected",
      tone: "success" as const,
      action: null,
      onAction: null,
    },
  ];

  const scoreTone =
    score >= 80
      ? "bg-emerald-400"
      : score >= 50
        ? "bg-amber-400"
        : "bg-rose-400";

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
      <div className="flex items-center justify-between mb-4">
        <h2 className="title-serif text-slate-900">Security Health</h2>
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm text-slate-500">{score}/100</span>
          <div className="w-20 h-1.5 rounded-full bg-slate-100 overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all", scoreTone)}
              style={{ width: `${score}%` }}
            />
          </div>
        </div>
      </div>
      <div className="space-y-0.5">
        {items.map((item) => (
          <div
            key={item.label}
            className="flex items-center gap-3 py-2.5 px-2 rounded-xl hover:bg-slate-50 transition-colors"
          >
            <div
              className={cn(
                "size-7 rounded-lg flex items-center justify-center shrink-0",
                item.tone === "risk"
                  ? "bg-rose-50 text-rose-500"
                  : item.tone === "warning"
                    ? "bg-amber-50 text-amber-500"
                    : item.tone === "success"
                      ? "bg-emerald-50 text-emerald-600"
                      : "bg-slate-100 text-slate-500"
              )}
            >
              <item.icon size={13} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-slate-500 leading-none mb-0.5">
                {item.label}
              </p>
              <p
                className={cn(
                  "text-sm",
                  item.tone === "risk"
                    ? "text-rose-600"
                    : item.tone === "warning"
                      ? "text-amber-600"
                      : item.tone === "success"
                        ? "text-emerald-700"
                        : "text-slate-700"
                )}
              >
                {item.value}
              </p>
            </div>
            {item.action && item.onAction && (
              <button
                type="button"
                onClick={item.onAction}
                className="text-sm label-caps text-[#151936] hover:underline shrink-0 transition-colors px-1.5 py-0.5 rounded hover:bg-slate-100"
              >
                {item.action} →
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Password Tab ───────────────────────────────────────────────────────────────

function PasswordTab({ onSave }: { onSave: (msg: string) => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const strength = getPasswordStrength(next);
  const mismatch = confirm.length > 0 && next !== confirm;
  const canSubmit = current.length > 0 && next.length >= 8 && next === confirm;

  const requirements = [
    { rule: "At least 8 characters", ok: next.length >= 8 },
    { rule: "One uppercase letter (A–Z)", ok: /[A-Z]/.test(next) },
    { rule: "One number (0–9)", ok: /[0-9]/.test(next) },
    { rule: "One special character", ok: /[^A-Za-z0-9]/.test(next) },
  ];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    await new Promise((r) => setTimeout(r, 1200));
    onSave("Password updated. You'll need to re-authenticate on other devices.");
    setCurrent("");
    setNext("");
    setConfirm("");
    setLoading(false);
  };

  return (
    <div className="max-w-xl flex flex-col gap-4">
      {/* Form card */}
      <div className="rounded-2xl border border-slate-200/80 bg-white overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
        {/* Dark header */}
        <div className="bg-gradient-to-r from-[#070b19] to-[#0f172a] px-6 py-5 flex items-center gap-4">
          <div className="size-10 rounded-xl bg-[#f3df27]/10 border border-[#f3df27]/20 flex items-center justify-center shrink-0">
            <IconShieldLock size={18} className="text-[#f3df27]" />
          </div>
          <div>
            <h2 className="title-serif text-white">Change Password</h2>
            <p className="text-sm text-slate-400 mt-0.5">
              Use a strong, unique password you don&apos;t use elsewhere
            </p>
          </div>
        </div>

        <form onSubmit={submit} className="p-6 space-y-4">
          {/* Current */}
          <div>
            <label className="label-caps text-slate-400 mb-2 block">
              Current Password
            </label>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300">
                <IconLock size={14} />
              </div>
              <input
                type={showCurrent ? "text" : "password"}
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                placeholder="Enter current password"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-10 py-2.5 text-sm text-slate-800 focus:border-[#151936] focus:outline-none focus:ring-2 focus:ring-[#151936]/10 transition-all"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <PasswordToggleBtn
                  show={showCurrent}
                  toggle={() => setShowCurrent((p) => !p)}
                />
              </div>
            </div>
          </div>

          <div className="h-px bg-slate-100" />

          {/* New */}
          <div>
            <label className="label-caps text-slate-400 mb-2 block">
              New Password
            </label>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300">
                <IconKey size={14} />
              </div>
              <input
                type={showNext ? "text" : "password"}
                value={next}
                onChange={(e) => setNext(e.target.value)}
                placeholder="At least 8 characters"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-10 py-2.5 text-sm text-slate-800 focus:border-[#151936] focus:outline-none focus:ring-2 focus:ring-[#151936]/10 transition-all"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <PasswordToggleBtn
                  show={showNext}
                  toggle={() => setShowNext((p) => !p)}
                />
              </div>
            </div>
            {next.length > 0 && (
              <div className="mt-2.5">
                <div className="flex gap-1 mb-1.5">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className={cn(
                        "h-1 flex-1 rounded-full transition-all duration-300",
                        i <= strength.score ? strength.color : "bg-slate-200"
                      )}
                    />
                  ))}
                </div>
                <div className="flex items-center justify-between">
                  <p
                    className={cn(
                      "text-sm",
                      strength.score >= 4
                        ? "text-emerald-600"
                        : strength.score >= 3
                          ? "text-amber-600"
                          : "text-rose-500"
                    )}
                  >
                    {strength.label}
                  </p>
                  <span className="font-mono text-sm text-slate-400">
                    {strength.score}/5
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Confirm */}
          <div>
            <label className="label-caps text-slate-400 mb-2 block">
              Confirm New Password
            </label>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300">
                <IconKey size={14} />
              </div>
              <input
                type={showConfirm ? "text" : "password"}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Repeat new password"
                className={cn(
                  "w-full rounded-xl border bg-slate-50 pl-9 pr-10 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 transition-all",
                  mismatch
                    ? "border-rose-300 focus:border-rose-400 focus:ring-rose-100"
                    : "border-slate-200 focus:border-[#151936] focus:ring-[#151936]/10"
                )}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <PasswordToggleBtn
                  show={showConfirm}
                  toggle={() => setShowConfirm((p) => !p)}
                />
              </div>
            </div>
            {mismatch && (
              <p className="text-sm text-rose-500 mt-1.5 flex items-center gap-1">
                <IconX size={11} />
                Passwords do not match
              </p>
            )}
            {!mismatch && confirm.length > 0 && next === confirm && (
              <p className="text-sm text-emerald-600 mt-1.5 flex items-center gap-1">
                <IconCheck size={11} />
                Passwords match
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={!canSubmit || loading}
            className={cn(
              "mt-2 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm transition-all",
              canSubmit && !loading
                ? "bg-[#f3df27] text-[#151936] hover:bg-[#e6d220] shadow-sm"
                : "bg-slate-100 text-slate-400 cursor-not-allowed"
            )}
          >
            {loading ? (
              <>
                <span className="size-4 rounded-full border-2 border-[#151936]/30 border-t-[#151936] animate-spin" />
                Updating…
              </>
            ) : (
              <>
                <IconShieldLock size={14} />
                Update Password
              </>
            )}
          </button>
        </form>
      </div>

      {/* Requirements */}
      <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-5">
        <p className="label-caps text-slate-400 mb-3">Password Requirements</p>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2.5">
          {requirements.map((item) => (
            <div key={item.rule} className="flex items-center gap-2">
              <div
                className={cn(
                  "size-5 rounded-md flex items-center justify-center transition-all",
                  item.ok
                    ? "bg-emerald-100 text-emerald-600"
                    : "bg-slate-100 text-slate-300"
                )}
              >
                <IconCheck size={11} />
              </div>
              <p
                className={cn(
                  "text-sm transition-colors",
                  item.ok ? "text-emerald-700" : "text-slate-400"
                )}
              >
                {item.rule}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Activity Timeline ──────────────────────────────────────────────────────────

function ActivityTimeline({ activityLog }: { activityLog: ActivityItem[] }) {
  const groups = useMemo(() => groupActivityByDay(activityLog), [activityLog]);

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_4px_rgba(0,0,0,0.04)] overflow-hidden">
      <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h2 className="title-serif text-slate-900">Activity Log</h2>
          <p className="text-sm text-slate-400 mt-0.5">
            All actions performed in the last 30 days
          </p>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200">
          <IconCalendar size={12} className="text-slate-400" />
          <span className="text-sm text-slate-500">Last 30 days</span>
        </div>
      </div>

      <div className="px-6 py-4">
        {groups.map((group, gi) => (
          <div
            key={group.label}
            className={cn("pb-4", gi < groups.length - 1 && "mb-2")}
          >
            {/* Day divider */}
            <div className="flex items-center gap-3 mb-5">
              <div className="h-px flex-1 bg-slate-100" />
              <span className="label-caps text-sm text-slate-400 px-2">
                {group.label}
              </span>
              <div className="h-px flex-1 bg-slate-100" />
            </div>

            {/* Timeline items */}
            <div className="relative pl-7">
              <div className="absolute left-2.5 top-1.5 bottom-1 w-px bg-slate-100" />
              {group.items.map((item, idx) => (
                <div
                  key={item.id}
                  className={cn(
                    "relative flex items-start gap-4 mb-5 last:mb-0 animate-fade-in-up"
                  )}
                  style={{ animationDelay: `${idx * 0.05}s` }}
                >
                  {/* Timeline dot */}
                  <div
                    className={cn(
                      "absolute -left-[0.875rem] top-1.5 size-3 rounded-full border-2 border-white ring-2 shrink-0 transition-colors",
                      item.tone === "success"
                        ? "bg-emerald-400 ring-emerald-100"
                        : "bg-slate-300 ring-slate-100"
                    )}
                  />

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm text-slate-800 leading-snug">
                        {item.action}
                      </p>
                      <span className="font-mono text-sm text-slate-400 whitespace-nowrap mt-0.5 shrink-0">
                        {item.time}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded-md text-sm label-caps border",
                          MODULE_TONES[item.module] ||
                          "bg-slate-100 text-slate-600 border-slate-200"
                        )}
                      >
                        {item.module}
                      </span>
                      {item.ref && (
                        <span className="font-mono text-sm text-slate-400">
                          {item.ref}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function ProfilePageContent({
  portalPrefix = "/admin",
}: {
  portalPrefix?: string;
}) {
  const [activeTab, setActiveTab] = useState<ProfileTab>("Overview");
  const [profile, setProfile] = useState<UserProfile>(INITIAL_PROFILE);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activityLog, setActivityLog] = useState<ActivityItem[]>([]);
  const { pushToast } = useToast();

  // `phone` has no backing column and `department`/`accessLevel`/`modules` are
  // computed from the real role, not stored — kept separate from the fields
  // that genuinely round-trip to the database (name/title/avatarUrl).
  function deriveRoleDisplay(role: string) {
    if (role === "ceo" || role === "general_manager") {
      return { department: "Executive Management", accessLevel: "Full Access — All modules", modules: ["Finance Command", "Operations", "HR Portal", "Properties & Portfolio", "Reports & Audit", "Security & Admin"] };
    }
    if (role.startsWith("finance") || role.startsWith("accounts") || role.startsWith("payroll")) {
      return { department: "Finance & Accounts", accessLevel: "Ledgers, Approvals & Cash flows", modules: ["Finance Command", "Reports & Audit"] };
    }
    if (role.startsWith("hr")) {
      return { department: "Human Resources", accessLevel: "Employee Profiles & Payroll Head", modules: ["HR Portal", "Reports & Audit"] };
    }
    if (role.startsWith("rentals")) {
      return { department: "Rentals & Portfolios", accessLevel: "Properties, Leases & Mandates", modules: ["Properties & Portfolio", "Operations"] };
    }
    if (role.startsWith("operations") || role.startsWith("property")) {
      return { department: "Operations & Maintenance", accessLevel: "Properties & Maintenance Tickets", modules: ["Operations", "Properties & Portfolio"] };
    }
    return { department: "General", accessLevel: "Standard Access", modules: [] };
  }

  const loadProfile = useCallback(async () => {
    try {
      const meRes = await fetch("/api/auth/me");
      const meData = await meRes.json();
      if (!meData?.user) return;

      const userRes = await fetch(`/api/identity/users/${meData.user.id}`);
      const userData = await userRes.json();
      if (!userRes.ok) throw new Error(userData.error || "Failed to load profile");
      const user = userData.user;
      const { department, accessLevel, modules } = deriveRoleDisplay(user.role);

      setProfile({
        id: user.id,
        name: user.name,
        email: user.email,
        title: user.title,
        phone: null,
        department,
        joinDate: user.createdAt
          ? new Date(user.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })
          : "—",
        role: user.role,
        avatarUrl: user.avatarUrl,
        status: "online",
        accessLevel,
        modules,
      });

      const [sessionsRes, auditRes] = await Promise.all([
        fetch("/api/identity/sessions"),
        fetch(`/api/audit?actorId=${user.id}&limit=20`),
      ]);
      const sessionsData = await sessionsRes.json();
      const auditData = await auditRes.json();

      if (sessionsRes.ok) {
        const rows = (sessionsData.sessions ?? []) as Array<{ id: string; ip: string | null; userAgent: string | null; revokedAt: string | null; createdAt: string }>;
        const active = rows.filter((s) => !s.revokedAt);
        // The frontend has no way to know which listed session is *this*
        // request's own session (that would require exposing the session id
        // from getCurrentUser(), which only returns id/email/name/role today)
        // — the most-recently-created active session is used as a reasonable
        // "current device" approximation rather than guessing further.
        const mostRecentId = active.length
          ? [...active].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0].id
          : null;
        setSessions(
          active.map((s) => {
            const { device, browser } = parseUserAgent(s.userAgent);
            return {
              id: s.id,
              device,
              browser,
              ip: s.ip ?? "—",
              lastActive: formatActivityTime(s.createdAt),
              current: s.id === mostRecentId,
            };
          }),
        );
      }

      if (auditRes.ok) {
        const entries = (auditData.entries ?? []) as Array<{ id: string; associatedType: string; associatedId: string | null; action: string; summary: string; createdAt: string }>;
        setActivityLog(
          entries.map((e) => ({
            id: e.id,
            action: e.summary,
            module: e.associatedType.charAt(0).toUpperCase() + e.associatedType.slice(1),
            time: formatActivityTime(e.createdAt),
            tone: "neutral" as const,
            ref: e.associatedId,
          })),
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load profile";
      pushToast({ tone: "error", title: "Error", body: message });
    }
  }, [pushToast]);

  useEffect(() => {
    Promise.resolve().then(() => loadProfile());
  }, [loadProfile]);

  const handleSaveField = async (field: keyof UserProfile, value: string) => {
    if (field !== "name" && field !== "title") {
      pushToast({ tone: "warning", title: "Not editable yet", body: `${field.charAt(0).toUpperCase() + field.slice(1)} isn't backed by a saved field yet.` });
      return;
    }
    const previous = profile[field];
    setProfile((p) => ({ ...p, [field]: value }));
    try {
      const res = await fetch(`/api/identity/users/${profile.id}/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      pushToast({
        tone: "success",
        title: "Saved",
        body: `${field.charAt(0).toUpperCase() + field.slice(1)} updated.`,
      });
    } catch (err) {
      setProfile((p) => ({ ...p, [field]: previous }));
      const message = err instanceof Error ? err.message : "Could not save this change.";
      pushToast({ tone: "error", title: "Error", body: message });
    }
  };

  // No avatar upload endpoint exists yet (would need Cloudinary widget wiring
  // like the property-image uploader) — this stays a local preview only, and
  // says so, rather than claiming a save that doesn't happen.
  const handleAvatarChange = (url: string) => {
    setProfile((p) => ({ ...p, avatarUrl: url }));
    pushToast({
      tone: "success",
      title: "Photo updated",
      body: "Your profile photo has been changed.",
    });
  };

  const revokeSession = async (id: string) => {
    try {
      const res = await fetch(`/api/identity/sessions/${id}/revoke`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to revoke session");
      setSessions((prev) => prev.filter((s) => s.id !== id));
      pushToast({ tone: "warning", title: "Session revoked", body: "That device has been signed out." });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not revoke that session.";
      pushToast({ tone: "error", title: "Error", body: message });
    }
  };

  const revokeAllOthers = async () => {
    const others = sessions.filter((s) => !s.current);
    const results = await Promise.allSettled(
      others.map((s) => fetch(`/api/identity/sessions/${s.id}/revoke`, { method: "POST" })),
    );
    const failures = results.filter((r) => r.status === "rejected").length;
    setSessions((prev) => prev.filter((s) => s.current));
    if (failures > 0) {
      pushToast({ tone: "warning", title: "Partially revoked", body: `${others.length - failures} of ${others.length} sessions signed out.` });
    } else {
      pushToast({ tone: "warning", title: "All sessions revoked", body: "All other devices have been signed out." });
    }
  };

  const completion = useMemo(() => getProfileCompletion(profile), [profile]);

  return (
    <PageTransition className="mx-auto max-w-[98rem] flex flex-col gap-5 pb-12 px-4 md:px-6">

      {/* ── Profile Hero ─────────────────────────────────────── */}
      <div className="gsap-stagger relative overflow-hidden rounded-2xl border border-white/[0.06] shadow-xl">
        {/* Satin gradient background */}
        <div className="absolute inset-0 bg-tertiary-gradient" />

        {/* Dot grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(243,223,39,0.7) 1px, transparent 1px)",
            backgroundSize: "30px 30px",
          }}
        />

        {/* Ambient glow */}
        <div className="absolute -top-20 -right-20 size-64 rounded-full bg-[#f3df27]/5 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 size-48 rounded-full bg-[#151936]/80 blur-2xl pointer-events-none" />

        <div className="relative px-6 md:px-10 py-8 flex flex-col md:flex-row items-start md:items-center gap-7">
          {/* Avatar */}
          <AvatarUploader
            current={profile.avatarUrl}
            name={profile.name}
            onChange={handleAvatarChange}
          />

          {/* Identity block */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2.5 mb-1.5">
              <h1 className="title-serif text-[1.75rem] text-white leading-tight">
                {profile.name}
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-sm label-caps bg-[#f3df27]/12 text-[#f3df27] border border-[#f3df27]/20">
                {formatRole(profile.role)}
              </span>
            </div>
            <p className="text-sm text-slate-400 mb-5">
              {profile.department} · {profile.email}
            </p>

            {/* Stat pills */}
            <div className="flex flex-wrap items-center gap-5">
              <div className="flex items-center gap-2">
                <div className="size-6 rounded-md bg-white/5 border border-white/8 flex items-center justify-center">
                  <IconChartPie size={11} className="text-slate-400" />
                </div>
                <span className="font-mono text-white text-sm">
                  {profile.modules.length}
                </span>
                <span className="text-slate-500 text-sm">modules</span>
              </div>

              <div className="h-3 w-px bg-white/10" />

              <div className="flex items-center gap-2">
                <div className="size-6 rounded-md bg-white/5 border border-white/8 flex items-center justify-center">
                  <IconDeviceLaptop size={11} className="text-slate-400" />
                </div>
                <span className="font-mono text-white text-sm">
                  {sessions.length}
                </span>
                <span className="text-slate-500 text-sm">sessions</span>
              </div>

              <div className="h-3 w-px bg-white/10" />

              <div className="flex items-center gap-1.5">
                <span
                  className={cn(
                    "size-2 rounded-full",
                    profile.status === "online"
                      ? "bg-emerald-400 animate-pulse"
                      : profile.status === "busy"
                        ? "bg-rose-400"
                        : "bg-amber-400"
                  )}
                />
                <span
                  className={cn(
                    "text-sm capitalize",
                    profile.status === "online"
                      ? "text-emerald-400"
                      : profile.status === "busy"
                        ? "text-rose-400"
                        : "text-amber-400"
                  )}
                >
                  {profile.status}
                </span>
              </div>

              <div className="h-3 w-px bg-white/10" />

              <div className="flex items-center gap-1.5 text-sm text-slate-500">
                <IconCalendar size={11} />
                <span>Since {profile.joinDate}</span>
              </div>
            </div>
          </div>

          {/* Right: access badge + completion */}
          <div className="hidden lg:flex flex-col items-end gap-2.5 shrink-0">
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10">
              <IconShieldCheck size={14} className="text-[#f3df27]" />
              <span className="text-sm text-slate-300">{profile.accessLevel}</span>
            </div>
            {completion.pct < 100 && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/15">
                <IconCircleDashed size={12} className="text-amber-400" />
                <span className="text-sm text-amber-400 font-mono">
                  {completion.pct}%
                </span>
                <span className="text-sm text-amber-500">complete</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Tab Navigation ───────────────────────────────────── */}
        <div className="relative border-t border-white/[0.08] px-6 md:px-10 py-3 flex flex-wrap gap-1.5 bg-white/[0.02]">
          {PROFILE_TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            let count: number | null = null;
            if (tab.id === "Sessions") count = sessions.length;
            if (tab.id === "Activity") count = activityLog.length;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "inline-flex px-3.5 py-1.5 text-base font-medium rounded-lg transition-all flex items-center gap-1.5",
                  isActive
                    ? "bg-[#f3df27] text-[#151936] shadow-sm font-medium"
                    : "text-white/90 hover:text-white hover:bg-white/10"
                )}
              >
                <tab.icon size={16} className="shrink-0" />
                <span>{tab.label}</span>
                {count !== null && (
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.5 text-sm font-medium font-mono",
                      isActive
                        ? "bg-[#151936] text-white"
                        : "bg-white/10 text-white/55"
                    )}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Overview Tab ─────────────────────────────────────── */}
      {activeTab === "Overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left column */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            {/* Profile completion (conditionally shown) */}
            <ProfileCompletionBar profile={profile} />

            {/* Account information */}
            <div className="gsap-stagger rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_4px_rgba(0,0,0,0.04)] overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h2 className="title-serif text-slate-900">
                    Account Information
                  </h2>
                  <p className="text-sm text-slate-400 mt-0.5">
                    Hover any field to edit
                  </p>
                </div>
                <div className="size-8 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center">
                  <IconUser size={14} className="text-slate-400" />
                </div>
              </div>

              <div className="py-2 px-2">
                <EditableField
                  label="Full Name"
                  value={profile.name}
                  icon={IconUser}
                  onSave={(v) => handleSaveField("name", v)}
                />
                <EditableField
                  label="Title"
                  value={profile.title ?? ""}
                  icon={IconBuilding}
                  onSave={(v) => handleSaveField("title", v)}
                />
                <EditableField
                  label="Email Address"
                  value={profile.email}
                  type="email"
                  icon={IconMail}
                  onSave={(v) => handleSaveField("email", v)}
                />
                <EditableField
                  label="Phone Number"
                  value={profile.phone ?? ""}
                  type="tel"
                  icon={IconPhone}
                  onSave={(v) => handleSaveField("phone", v)}
                />
                <EditableField
                  label="Department"
                  value={profile.department}
                  icon={IconBuilding}
                  onSave={(v) => handleSaveField("department", v)}
                />

                {/* Status picker */}
                <div className="flex items-start gap-4 py-3.5 px-4 rounded-xl hover:bg-slate-50/80 transition-all">
                  <div className="mt-0.5 size-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                    <IconClock size={14} className="text-slate-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="label-caps text-slate-400 mb-2">
                      Presence Status
                    </p>
                    <div className="flex items-center gap-2">
                      {(["online", "busy", "away"] as const).map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => {
                            setProfile((p) => ({ ...p, status: s }));
                            pushToast({
                              tone: "success",
                              title: "Status updated",
                              body: `You are now ${s}.`,
                            });
                          }}
                          className={cn(
                            "flex items-center gap-1.5 rounded-full px-3 py-1 text-sm transition-all border",
                            profile.status === s
                              ? s === "online"
                                ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                                : s === "busy"
                                  ? "bg-rose-50 border-rose-200 text-rose-600"
                                  : "bg-amber-50 border-amber-200 text-amber-700"
                              : "border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-600"
                          )}
                        >
                          <span
                            className={cn(
                              "size-1.5 rounded-full",
                              s === "online"
                                ? "bg-emerald-400"
                                : s === "busy"
                                  ? "bg-rose-400"
                                  : "bg-amber-400"
                            )}
                          />
                          {s.charAt(0).toUpperCase() + s.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Member since (read-only) */}
                <div className="flex items-center gap-4 py-3.5 px-4">
                  <div className="size-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                    <IconCalendar size={14} className="text-slate-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="label-caps text-slate-400 mb-1">
                      Member Since
                    </p>
                    <p className="font-mono text-sm text-slate-700">
                      {profile.joinDate}
                    </p>
                  </div>
                  <span className="px-2 py-0.5 rounded-md text-sm label-caps bg-slate-100 text-slate-400">
                    Read-only
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right column */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            {/* Role & Permissions */}
            <div className="gsap-stagger rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
              <h2 className="title-serif text-slate-900 mb-4">
                Role & Permissions
              </h2>

              {/* Role badge */}
              <div className="flex items-center gap-3 p-3.5 rounded-xl bg-[#151936] mb-4">
                <div className="size-9 rounded-full bg-[#f3df27]/12 border border-[#f3df27]/18 flex items-center justify-center shrink-0">
                  <IconShieldLock size={16} className="text-[#f3df27]" />
                </div>
                <div>
                  <p className="text-sm text-white">
                    {formatRole(profile.role)}
                  </p>
                  <p className="text-sm text-slate-400 mt-0.5">
                    {profile.accessLevel}
                  </p>
                </div>
              </div>

              <p className="label-caps text-slate-400 mb-2.5">
                Authorized Modules
              </p>
              <div className="flex flex-wrap gap-1.5">
                {profile.modules.map((mod) => (
                  <span
                    key={mod}
                    className="px-2.5 py-1 rounded-lg text-sm bg-slate-50 border border-slate-200 text-slate-600"
                  >
                    {mod}
                  </span>
                ))}
              </div>
            </div>

            {/* Security Health */}
            <SecurityHealthCard onChangeTab={setActiveTab} />

            {/* Quick Actions */}
            <div className="gsap-stagger rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
              <h2 className="title-serif text-slate-900 mb-3">
                Quick Actions
              </h2>
              <div className="space-y-0.5">
                {[
                  {
                    label: "Change Password",
                    icon: IconShieldLock,
                    tab: "Password" as ProfileTab,
                    desc: "Update your login credentials",
                  },
                  {
                    label: "Manage Sessions",
                    icon: IconDeviceLaptop,
                    tab: "Sessions" as ProfileTab,
                    desc: "View and revoke active devices",
                  },
                  {
                    label: "Security Centre",
                    icon: IconShieldCheck,
                    href: `${portalPrefix}/security`,
                    desc: "2FA, audit log, access control",
                  },
                  {
                    label: "Notification Preferences",
                    icon: IconBell,
                    href: `${portalPrefix}/settings`,
                    desc: "Manage alert preferences",
                  },
                ].map((item) =>
                  "href" in item ? (
                    <Link
                      key={item.label}
                      href={item.href || ""}
                      className="group flex items-center gap-3 rounded-xl p-3 hover:bg-slate-50 transition-colors"
                    >
                      <div className="size-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 group-hover:bg-[#151936] group-hover:text-white transition-all">
                        <item.icon size={14} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-800">{item.label}</p>
                        <p className="text-sm text-slate-400">{item.desc}</p>
                      </div>
                      <IconChevronRight
                        size={12}
                        className="text-slate-300 group-hover:text-slate-500 transition-colors shrink-0"
                      />
                    </Link>
                  ) : (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => setActiveTab(item.tab!)}
                      className="group flex w-full items-center gap-3 rounded-xl p-3 hover:bg-slate-50 transition-colors text-left"
                    >
                      <div className="size-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 group-hover:bg-[#151936] group-hover:text-white transition-all">
                        <item.icon size={14} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-800">{item.label}</p>
                        <p className="text-sm text-slate-400">{item.desc}</p>
                      </div>
                      <IconChevronRight
                        size={12}
                        className="text-slate-300 group-hover:text-slate-500 transition-colors shrink-0"
                      />
                    </button>
                  )
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Password Tab ─────────────────────────────────────── */}
      {activeTab === "Password" && (
        <PasswordTab
          onSave={(msg) =>
            pushToast({ tone: "success", title: "Password updated", body: msg })
          }
        />
      )}

      {/* ── Activity Tab ─────────────────────────────────────── */}
      {activeTab === "Activity" && <ActivityTimeline activityLog={activityLog} />}

      {/* ── Sessions Tab ─────────────────────────────────────── */}
      {activeTab === "Sessions" && (
        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_4px_rgba(0,0,0,0.04)] overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="title-serif text-slate-900">Active Sessions</h2>
              <p className="text-sm text-slate-400 mt-0.5">
                {sessions.length} device{sessions.length !== 1 ? "s" : ""}{" "}
                currently signed in
              </p>
            </div>
            <button
              type="button"
              onClick={revokeAllOthers}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm text-rose-500 border border-rose-100 bg-rose-50 hover:bg-rose-100 transition-colors"
            >
              <IconLogout size={12} />
              Revoke all others
            </button>
          </div>

          <div className="p-5 space-y-3">
            {sessions.map((session, idx) => {
              const DevIcon = getDeviceIcon(session.device);
              const BrowserIcon = getBrowserIcon(session.browser);
              return (
                <div
                  key={session.id}
                  className={cn(
                    "flex items-center gap-4 rounded-xl border p-4 transition-all duration-200 animate-fade-in-up",
                    session.current
                      ? "border-emerald-200 bg-gradient-to-r from-emerald-50/40 to-white"
                      : "border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50/50"
                  )}
                  style={{ animationDelay: `${idx * 0.06}s` }}
                >
                  {/* Device icon */}
                  <div
                    className={cn(
                      "size-11 shrink-0 rounded-xl flex items-center justify-center",
                      session.current
                        ? "bg-emerald-100 text-emerald-600"
                        : "bg-slate-100 text-slate-500"
                    )}
                  >
                    <DevIcon size={20} />
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm text-slate-800">{session.device}</p>
                      {session.current && (
                        <span className="px-2 py-0.5 rounded-full text-sm label-caps bg-emerald-100 text-emerald-700 border border-emerald-200">
                          Current
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
                      <span className="flex items-center gap-1">
                        <BrowserIcon size={11} />
                        {session.browser}
                      </span>
                      <span className="text-slate-200">·</span>
                      <span className="flex items-center gap-1 font-mono text-sm">
                        <IconClock size={11} />
                        {session.lastActive}
                      </span>
                    </div>
                  </div>

                  {/* IP + revoke */}
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="hidden md:block font-mono text-sm text-slate-400 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-100">
                      {session.ip}
                    </span>
                    {!session.current && (
                      <button
                        type="button"
                        onClick={() => revokeSession(session.id)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm text-rose-500 border border-rose-100 hover:bg-rose-50 transition-colors"
                      >
                        <IconLogout size={12} />
                        Revoke
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {sessions.filter((s) => !s.current).length === 0 && (
              <div className="text-center py-10">
                <div className="size-12 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-3">
                  <IconCircleCheckFilled
                    size={26}
                    className="text-emerald-500"
                  />
                </div>
                <p className="text-sm text-slate-600">
                  No other active sessions
                </p>
                <p className="text-sm text-slate-400 mt-1">
                  Only this device is currently signed in
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </PageTransition>
  );
}