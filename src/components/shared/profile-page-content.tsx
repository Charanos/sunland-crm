"use client";

import { useRef, useState, useCallback, useEffect } from "react";
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
  IconUpload,
  IconTrash,
  IconShieldCheck,
  IconLogout,
  IconChevronRight,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils/cn";
import { useToast } from "@/components/ui/toast-provider";

// ── Types ──────────────────────────────────────────────────────────────────────

interface UserProfile {
  name: string;
  email: string;
  phone: string;
  department: string;
  joinDate: string;
  role: string;
  avatarUrl: string | null;
  status: "online" | "busy" | "away";
  accessLevel: string;
  modules: string[];
}

// ── Initial state (would be loaded from /api/auth/me in production) ─────────

const INITIAL_PROFILE: UserProfile = {
  name: "Paul Amos",
  email: "paul.amos@sunland.co.ke",
  phone: "+254 712 345 678",
  department: "Executive Management",
  joinDate: "March 2021",
  role: "ceo",
  avatarUrl: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop&crop=face",
  status: "online",
  accessLevel: "Full Access — All modules",
  modules: ["Finance Command", "Operations", "HR Portal", "Properties & Portfolio", "Reports & Audit", "Security & Admin"],
};

const ACTIVITY_LOG = [
  { id: "1", action: "Approved payroll run PR-2026-06", module: "Finance", time: "10 min ago", tone: "success" },
  { id: "2", action: "Reviewed Kilimani Heights mandate MDT-005", module: "Properties", time: "1 hour ago", tone: "neutral" },
  { id: "3", action: "Signed off on cheque CHQ-0098 clearance", module: "Finance", time: "3 hours ago", tone: "success" },
  { id: "4", action: "Updated user preferences", module: "Settings", time: "Yesterday", tone: "neutral" },
  { id: "5", action: "Generated Monthly Report RPT-208", module: "Reports", time: "2 days ago", tone: "neutral" },
];

const SESSIONS = [
  { id: "1", device: "MacBook Pro 14\"", location: "Nairobi, KE", lastActive: "Active now", browser: "Chrome 126", current: true },
  { id: "2", device: "iPhone 15 Pro", location: "Nairobi, KE", lastActive: "2 hours ago", browser: "Safari Mobile", current: false },
  { id: "3", device: "Windows PC", location: "Westlands, Nairobi", lastActive: "Yesterday 4:32 PM", browser: "Edge 125", current: false },
];

const PROFILE_TABS = ["Overview", "Password", "Activity", "Sessions"] as const;
type ProfileTab = typeof PROFILE_TABS[number];

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatRole(role: string) {
  return role.split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")
    .replace("Ceo", "CEO").replace("Gm", "GM");
}

function getPasswordStrength(pwd: string): { score: number; label: string; color: string } {
  if (!pwd) return { score: 0, label: "", color: "" };
  let score = 0;
  if (pwd.length >= 8) score++;
  if (pwd.length >= 12) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  const map = [
    { score: 0, label: "", color: "" },
    { score: 1, label: "Very Weak", color: "bg-red-500" },
    { score: 2, label: "Weak", color: "bg-orange-400" },
    { score: 3, label: "Fair", color: "bg-amber-400" },
    { score: 4, label: "Strong", color: "bg-emerald-400" },
    { score: 5, label: "Very Strong", color: "bg-emerald-600" },
  ];
  return map[Math.min(score, 5)];
}

// ── Password visibility toggle (module-level to avoid recreating in render) ────

function PasswordToggleBtn({ show, toggle }: { show: boolean; toggle: () => void }) {
  return (
    <button type="button" onClick={toggle} className="text-slate-400 hover:text-slate-600 transition-colors">
      {show ? <IconEyeOff size={15} /> : <IconEye size={15} />}
    </button>
  );
}

// ── Editable field ─────────────────────────────────────────────────────────────

function EditableField({
  label, value, type = "text", onSave
}: {
  label: string; value: string; type?: string; onSave: (v: string) => Promise<void> | void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when entering edit mode — intentionally targeting DOM (valid side effect)
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  // Sync draft from parent when entering edit mode (not via effect)
  const startEditing = () => {
    setDraft(value); // reset to latest parent value on every edit start
    setEditing(true);
  };

  const save = async () => {
    if (draft === value) { setEditing(false); return; }
    setIsSaving(true);
    await onSave(draft);
    setIsSaving(false);
    setEditing(false);
  };

  return (
    <div className="group flex items-start justify-between py-3.5 border-b border-slate-100 last:border-0">
      <div className="flex-1 min-w-0 pr-4">
        <p className="label-caps text-slate-400 mb-1">{label}</p>
        {editing ? (
          <div className="flex items-center gap-2 mt-1.5">
            <input
              ref={inputRef}
              type={type}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") save(); if (e.key === "Escape") { setEditing(false); } }}
              className="text-caption flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-800 focus:border-[var(--sidebar)] focus:outline-none focus:ring-2 focus:ring-[var(--sidebar)]/10 transition-all"
            />
            <button type="button" disabled={isSaving} onClick={save}
              className="flex size-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors disabled:opacity-50">
              {isSaving ? <span className="size-3 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin" /> : <IconCheck size={14} />}
            </button>
            <button type="button" onClick={() => setEditing(false)}
              className="flex size-8 items-center justify-center rounded-xl bg-slate-50 text-slate-400 hover:bg-slate-100 transition-colors">
              <IconX size={14} />
            </button>
          </div>
        ) : (
          <p className="text-caption text-slate-800 mt-1">{value || <span className="text-slate-300 italic">Not set</span>}</p>
        )}
      </div>
      {!editing && (
        <button type="button" onClick={startEditing}
          className="opacity-0 group-hover:opacity-100 flex size-8 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-all">
          <IconEdit size={14} />
        </button>
      )}
    </div>
  );
}

// ── Avatar Uploader ────────────────────────────────────────────────────────────

function AvatarUploader({ current, onChange }: { current: string | null; onChange: (url: string) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(current);
  const [dragging, setDragging] = useState(false);

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const url = e.target?.result as string;
      setPreview(url);
      onChange(url);
    };
    reader.readAsDataURL(file);
  }, [onChange]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Avatar with camera overlay */}
      <div className="relative group">
        <div
          className={cn(
            "size-24 rounded-full overflow-hidden ring-4 ring-white shadow-lg cursor-pointer transition-all",
            dragging && "ring-[var(--sidebar)] ring-offset-2"
          )}
          onDrop={onDrop}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onClick={() => fileRef.current?.click()}
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Avatar preview" className="size-full object-cover" />
          ) : (
            <div className="size-full bg-[var(--sidebar)] flex items-center justify-center text-white text-2xl">
              {INITIAL_PROFILE.name.split(" ").map(n => n[0]).join("")}
            </div>
          )}
          {/* Camera overlay on hover */}
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-full">
            <IconCamera size={24} className="text-white" />
          </div>
        </div>
        {/* Upload badge */}
        <button type="button" onClick={() => fileRef.current?.click()}
          className="absolute -bottom-1 -right-1 flex size-7 items-center justify-center rounded-full bg-[var(--sidebar)] text-white shadow-md hover:brightness-90 transition-all">
          <IconEdit size={12} />
        </button>
      </div>

      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />

      <div className="flex items-center gap-2">
        <button type="button" onClick={() => fileRef.current?.click()}
          className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-tiny text-slate-600 hover:bg-slate-50 transition-colors shadow-sm">
          <IconUpload size={12} />
          Upload photo
        </button>
        {preview && preview !== INITIAL_PROFILE.avatarUrl && (
          <button type="button" onClick={() => { setPreview(INITIAL_PROFILE.avatarUrl); onChange(INITIAL_PROFILE.avatarUrl || ""); }}
            className="flex items-center gap-1.5 rounded-xl border border-red-100 bg-red-50 px-3 py-1.5 text-tiny text-red-500 hover:bg-red-100 transition-colors">
            <IconTrash size={12} />
            Remove
          </button>
        )}
      </div>
      <p className="text-tiny text-slate-400">JPG, PNG or GIF · Max 4MB · Drag & drop supported</p>
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

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    await new Promise(r => setTimeout(r, 1200));
    onSave("Password updated successfully. You'll need to log in again on other devices.");
    setCurrent(""); setNext(""); setConfirm("");
    setLoading(false);
  };

  return (
    <form onSubmit={submit} className="max-w-md space-y-5">
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
        <h2 className="headline-md font-serif text-slate-900 mb-5">Change Password</h2>

        {/* Current */}
        <div className="space-y-4">
          <div>
            <label className="label-caps text-slate-400 mb-1.5 block">Current Password</label>
            <div className="relative">
              <input type={showCurrent ? "text" : "password"} value={current} onChange={e => setCurrent(e.target.value)}
                placeholder="Enter current password"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 pr-10 text-caption text-slate-800 focus:border-[var(--sidebar)] focus:outline-none focus:ring-2 focus:ring-[var(--sidebar)]/10 transition-all" />
              <div className="absolute right-3 top-1/2 -translate-y-1/2"><PasswordToggleBtn show={showCurrent} toggle={() => setShowCurrent(p => !p)} /></div>
            </div>
          </div>

          {/* New */}
          <div>
            <label className="label-caps text-slate-400 mb-1.5 block">New Password</label>
            <div className="relative">
              <input type={showNext ? "text" : "password"} value={next} onChange={e => setNext(e.target.value)}
                placeholder="At least 8 characters"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 pr-10 text-caption text-slate-800 focus:border-[var(--sidebar)] focus:outline-none focus:ring-2 focus:ring-[var(--sidebar)]/10 transition-all" />
              <div className="absolute right-3 top-1/2 -translate-y-1/2"><PasswordToggleBtn show={showNext} toggle={() => setShowNext(p => !p)} /></div>
            </div>
            {/* Strength meter */}
            {next.length > 0 && (
              <div className="mt-2">
                <div className="flex gap-1 mb-1">
                  {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className={cn("h-1 flex-1 rounded-full transition-all duration-300",
                      i <= strength.score ? strength.color : "bg-slate-200")} />
                  ))}
                </div>
                <p className={cn("text-tiny", strength.score >= 4 ? "text-emerald-600" : strength.score >= 3 ? "text-amber-600" : "text-red-500")}>
                  {strength.label}
                </p>
              </div>
            )}
          </div>

          {/* Confirm */}
          <div>
            <label className="label-caps text-slate-400 mb-1.5 block">Confirm New Password</label>
            <div className="relative">
              <input type={showConfirm ? "text" : "password"} value={confirm} onChange={e => setConfirm(e.target.value)}
                placeholder="Repeat new password"
                className={cn(
                  "w-full rounded-xl border bg-slate-50 px-3 py-2.5 pr-10 text-caption text-slate-800 focus:outline-none focus:ring-2 transition-all",
                  mismatch ? "border-red-300 focus:border-red-400 focus:ring-red-100" : "border-slate-200 focus:border-[var(--sidebar)] focus:ring-[var(--sidebar)]/10"
                )} />
              <div className="absolute right-3 top-1/2 -translate-y-1/2"><PasswordToggleBtn show={showConfirm} toggle={() => setShowConfirm(p => !p)} /></div>
            </div>
            {mismatch && <p className="text-tiny text-red-500 mt-1">Passwords do not match</p>}
            {!mismatch && confirm.length > 0 && next === confirm && (
              <p className="text-tiny text-emerald-600 mt-1 flex items-center gap-1"><IconCheck size={11} />Passwords match</p>
            )}
          </div>
        </div>

        <button type="submit" disabled={!canSubmit || loading}
          className={cn(
            "mt-6 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-caption text-white shadow-sm transition-all",
            canSubmit && !loading ? "bg-[var(--sidebar)] hover:opacity-90" : "bg-slate-300 cursor-not-allowed"
          )}>
          {loading ? (
            <><span className="size-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />Updating…</>
          ) : (
            <><IconShieldLock size={14} />Update Password</>
          )}
        </button>
      </div>

      {/* Password tips */}
      <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
        <p className="label-caps text-slate-400 mb-2.5">Requirements</p>
        {[
          { rule: "At least 8 characters", ok: next.length >= 8 },
          { rule: "At least one uppercase letter (A–Z)", ok: /[A-Z]/.test(next) },
          { rule: "At least one number (0–9)", ok: /[0-9]/.test(next) },
          { rule: "At least one special character", ok: /[^A-Za-z0-9]/.test(next) },
        ].map(item => (
          <div key={item.rule} className="flex items-center gap-2 py-1">
            <div className={cn("size-4 rounded-full flex items-center justify-center", item.ok ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-300")}>
              <IconCheck size={10} />
            </div>
            <p className={cn("text-tiny", item.ok ? "text-emerald-700" : "text-slate-400")}>{item.rule}</p>
          </div>
        ))}
      </div>
    </form>
  );
}

// ── Main Content Component ──────────────────────────────────────────────────────

export function ProfilePageContent({ portalPrefix = "/admin" }: { portalPrefix?: string }) {
  const [activeTab, setActiveTab] = useState<ProfileTab>("Overview");
  const [profile, setProfile] = useState<UserProfile>(INITIAL_PROFILE);
  const [sessions, setSessions] = useState(SESSIONS);
  const { pushToast } = useToast();

  const handleSaveField = async (field: keyof UserProfile, value: string) => {
    // Simulate PATCH /api/users/me
    await new Promise(r => setTimeout(r, 600));
    setProfile(p => ({ ...p, [field]: value }));
    pushToast({ tone: "success", title: "Saved", body: `${field.charAt(0).toUpperCase() + field.slice(1)} updated.` });
  };

  const handleAvatarChange = (url: string) => {
    setProfile(p => ({ ...p, avatarUrl: url }));
    pushToast({ tone: "success", title: "Photo updated", body: "Your profile photo has been changed." });
  };

  const revokeSession = (id: string) => {
    setSessions(prev => prev.filter(s => s.id !== id));
    pushToast({ tone: "warning", title: "Session revoked", body: "That device has been signed out." });
  };

  const revokeAllOthers = () => {
    setSessions(prev => prev.filter(s => s.current));
    pushToast({ tone: "warning", title: "All sessions revoked", body: "All other devices have been signed out." });
  };

  const handlePasswordSave = (msg: string) => {
    pushToast({ tone: "success", title: "Password updated", body: msg });
  };

  return (
    <div className="mx-auto max-w-[98rem] flex flex-col gap-6 pb-12 animate-fade-in px-4 md:px-6">

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="relative rounded-2xl overflow-hidden bg-tertiary-gradient p-6 md:p-8">
        <div className="absolute inset-0 opacity-[0.04]" style={{
          backgroundImage: "radial-gradient(circle at 25% 25%, white 1px, transparent 0), radial-gradient(circle at 75% 75%, white 1px, transparent 0)",
          backgroundSize: "40px 40px"
        }} />
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="headline-lg font-serif text-white leading-tight">{profile.name}</h1>
              <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 label-caps text-emerald-300">
                {formatRole(profile.role)}
              </span>
            </div>
            <p className="body-sm text-white/60 mt-1">{profile.department} · {profile.email}</p>
            <div className="flex items-center gap-4 mt-3">
              <div className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-tiny text-white/60">Active now</span>
              </div>
              <span className="text-white/20">·</span>
              <span className="text-tiny text-white/60">Member since {profile.joinDate}</span>
            </div>
          </div>
          
          <div className="relative shrink-0">
            <AvatarUploader current={profile.avatarUrl} onChange={handleAvatarChange} />
          </div>
        </div>
      </section>

      {/* ── Tabs ─────────────────────────────────────────────── */}
      <div className="px-2 pt-2.5 flex flex-wrap gap-1.5 bg-transparent border-b border-slate-100">
        {PROFILE_TABS.map(tab => (
          <button key={tab} type="button" onClick={() => setActiveTab(tab)}
            className={cn(
              "inline-flex px-3.5 py-1.5 text-base font-medium rounded-lg transition-all flex items-center gap-1.5",
              activeTab === tab
                ? "bg-[#151936] text-white shadow-sm"
                : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
            )}>
            {tab}
          </button>
        ))}
      </div>

      {/* ── Overview Tab ─────────────────────────────────────── */}
      {activeTab === "Overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Account info (editable) */}
          <div className="lg:col-span-7 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
            <div className="flex items-center justify-between mb-2">
              <h2 className="headline-md font-serif text-slate-900">Account Information</h2>
              <span className="label-caps text-slate-400">Hover to edit</span>
            </div>
            <EditableField label="Full Name" value={profile.name} onSave={v => handleSaveField("name", v)} />
            <EditableField label="Email Address" value={profile.email} type="email" onSave={v => handleSaveField("email", v)} />
            <EditableField label="Phone Number" value={profile.phone} type="tel" onSave={v => handleSaveField("phone", v)} />
            <EditableField label="Department" value={profile.department} onSave={v => handleSaveField("department", v)} />
            <div className="py-3.5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <p className="label-caps text-slate-400 mb-1">Member Since</p>
                <p className="text-caption text-slate-800">{profile.joinDate}</p>
              </div>
            </div>
            <div className="py-3.5 flex items-center justify-between">
              <div>
                <p className="label-caps text-slate-400 mb-1">Status</p>
                <div className="flex items-center gap-2 mt-1">
                  {(["online", "busy", "away"] as const).map(s => (
                    <button key={s} type="button" onClick={() => {
                      setProfile(p => ({ ...p, status: s }));
                      pushToast({ tone: "success", title: "Status updated", body: `You are now ${s}.` });
                    }}
                      className={cn(
                        "flex items-center gap-1.5 rounded-full px-3 py-1 text-tiny transition-all border",
                        profile.status === s
                          ? s === "online" ? "bg-emerald-50 border-emerald-200 text-emerald-700" : s === "busy" ? "bg-red-50 border-red-200 text-red-600" : "bg-amber-50 border-amber-200 text-amber-700"
                          : "border-slate-200 text-slate-400 hover:border-slate-300"
                      )}>
                      <span className={cn("size-1.5 rounded-full", s === "online" ? "bg-emerald-400" : s === "busy" ? "bg-red-400" : "bg-amber-400")} />
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Role & modules */}
          <div className="lg:col-span-5 flex flex-col gap-5">
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
              <h2 className="headline-md font-serif text-slate-900 mb-4">Role & Permissions</h2>
              <div className="flex items-center gap-3 mb-4 p-3 rounded-xl bg-slate-50">
                <div className="size-10 rounded-full bg-[var(--sidebar)] flex items-center justify-center shrink-0">
                  <IconShieldLock size={18} className="text-white" />
                </div>
                <div>
                  <p className="text-label text-slate-800">{formatRole(profile.role)}</p>
                  <p className="text-tiny text-slate-500">{profile.accessLevel}</p>
                </div>
              </div>
              <p className="label-caps text-slate-400 mb-2.5">Authorized Modules</p>
              <div className="flex flex-wrap gap-1.5">
                {profile.modules.map(mod => (
                  <span key={mod} className="badge-pill badge-tone-brand">{mod}</span>
                ))}
              </div>
            </div>

            {/* Quick actions */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
              <h2 className="headline-md font-serif text-slate-900 mb-3">Quick Actions</h2>
              <div className="space-y-1">
                {[
                  { label: "Change Password", icon: IconShieldLock, tab: "Password" as ProfileTab, desc: "Update your login credentials" },
                  { label: "Manage Sessions", icon: IconDeviceLaptop, tab: "Sessions" as ProfileTab, desc: "View & revoke active sessions" },
                  { label: "Security Centre", icon: IconShieldCheck, href: `${portalPrefix}/security`, desc: "2FA, audit log, access control" },
                  { label: "Notification Prefs", icon: IconBell, href: `${portalPrefix}/settings`, desc: "Manage alert preferences" },
                ].map(item => (
                  item.href ? (
                    <Link key={item.label} href={item.href}
                      className="group flex items-center gap-3 rounded-xl p-3 hover:bg-slate-50 transition-colors">
                      <div className="size-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 group-hover:bg-[var(--sidebar)] group-hover:text-white transition-all">
                        <item.icon size={15} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-caption text-slate-800">{item.label}</p>
                        <p className="text-tiny text-slate-400">{item.desc}</p>
                      </div>
                      <IconChevronRight size={13} className="text-slate-300 group-hover:text-slate-500 transition-colors" />
                    </Link>
                  ) : (
                    <button key={item.label} type="button" onClick={() => setActiveTab(item.tab!)}
                      className="group flex w-full items-center gap-3 rounded-xl p-3 hover:bg-slate-50 transition-colors text-left">
                      <div className="size-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 group-hover:bg-[var(--sidebar)] group-hover:text-white transition-all">
                        <item.icon size={15} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-caption text-slate-800">{item.label}</p>
                        <p className="text-tiny text-slate-400">{item.desc}</p>
                      </div>
                      <IconChevronRight size={13} className="text-slate-300 group-hover:text-slate-500 transition-colors" />
                    </button>
                  )
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Password Tab ─────────────────────────────────────── */}
      {activeTab === "Password" && <PasswordTab onSave={handlePasswordSave} />}

      {/* ── Activity Tab ─────────────────────────────────────── */}
      {activeTab === "Activity" && (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
          <div className="flex items-center justify-between mb-5">
            <h2 className="headline-md font-serif text-slate-900">Recent Activity</h2>
            <span className="label-caps text-slate-400">Last 30 days</span>
          </div>
          <div className="space-y-1">
            {ACTIVITY_LOG.map((item, idx) => (
              <div key={item.id} className="flex items-start gap-4 py-3 border-b border-slate-100 last:border-0 animate-fade-in-up" style={{ animationDelay: `${idx * 0.04}s` }}>
                <div className={cn(
                  "size-8 shrink-0 rounded-full flex items-center justify-center mt-0.5",
                  item.tone === "success" ? "bg-emerald-50 text-emerald-600" : "bg-slate-50 text-slate-500"
                )}>
                  <IconCircleCheckFilled size={15} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-caption text-slate-800">{item.action}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="badge-pill badge-tone-neutral">{item.module}</span>
                    <span className="text-tiny text-slate-400">{item.time}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Sessions Tab ─────────────────────────────────────── */}
      {activeTab === "Sessions" && (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
          <div className="flex items-center justify-between mb-5">
            <h2 className="headline-md font-serif text-slate-900">Active Sessions</h2>
            <button type="button" onClick={revokeAllOthers}
              className="text-caption text-rose-500 hover:text-rose-700 transition-colors">
              Revoke all others
            </button>
          </div>
          <div className="space-y-3">
            {sessions.map((session, idx) => (
              <div key={session.id} className={cn(
                "flex items-center gap-4 rounded-xl border p-4 transition-all animate-fade-in-up",
                session.current ? "border-emerald-200 bg-emerald-50/50" : "border-slate-100 bg-white hover:bg-slate-50/50"
              )} style={{ animationDelay: `${idx * 0.05}s` }}>
                <div className={cn(
                  "size-10 shrink-0 rounded-full flex items-center justify-center",
                  session.current ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-500"
                )}>
                  <IconDeviceLaptop size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-caption text-slate-800">{session.device}</p>
                    {session.current && <span className="badge-pill badge-tone-success">Current</span>}
                  </div>
                  <p className="text-tiny text-slate-500 mt-0.5">{session.browser} · {session.location} · {session.lastActive}</p>
                </div>
                {!session.current && (
                  <button type="button" onClick={() => revokeSession(session.id)}
                    className="flex items-center gap-1 text-tiny text-rose-500 hover:text-rose-700 transition-colors shrink-0">
                    <IconLogout size={12} />
                    Revoke
                  </button>
                )}
              </div>
            ))}
            {sessions.filter(s => !s.current).length === 0 && (
              <div className="text-center py-6">
                <IconCircleCheckFilled size={28} className="text-emerald-400 mx-auto mb-2" />
                <p className="text-caption text-slate-500">No other active sessions</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
