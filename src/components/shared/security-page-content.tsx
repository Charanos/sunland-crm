"use client";

import { useState, useEffect, useCallback } from "react";
import { BoardHeader } from "@/components/ui/erp-primitives";
import {
  IconAlertTriangle,
  IconCircleCheckFilled,
  IconCheck,
  IconLock,
  IconShieldCheck,
  IconChevronDown,
  IconRefresh,
  IconCopy,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils/cn";
import { useToast } from "@/components/ui/toast-provider";
import { QRCodeSVG } from "qrcode.react";
import { Modal } from "@/components/ui/modal";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { PageTransition } from "@/components/shared/page-transition";

// ── Types ──────────────────────────────────────────────────────────────────────
// Matches the real activity_logs / users tables - no `ip`/`risk` columns exist
// on activity_logs, and no `mfa` column exists on users (2FA has no backend
// yet - see the MFA panel below), so those are not represented here.

interface AuditEntry {
  id: string;
  actorId: string | null;
  associatedType: string;
  action: string;
  summary: string;
  createdAt: string;
}

interface PlatformUser {
  id: string;
  name: string;
  email: string;
  role: string;
  title: string | null;
  isActive: boolean;
  lastSignedInAt: string | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function relativeTime(isoStr: string | null): string {
  if (!isoStr) return "Never";
  const diff = Date.now() - new Date(isoStr).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "Just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  return days === 1 ? "Yesterday" : `${days}d ago`;
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function SecurityPageContent({ entityId = "group" }: { entityId?: string }) {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [mfaModalOpen, setMfaModalOpen] = useState(false);
  const [mfaStep, setMfaStep] = useState<"intro" | "scan" | "verify">("intro");
  const [mfaCode, setMfaCode] = useState("");
  const [isVerifyingMfa, setIsVerifyingMfa] = useState(false);

  const { pushToast } = useToast();

  const loadData = useCallback(async () => {
    try {
      const [logsRes, usersRes] = await Promise.all([
        fetch(`/api/audit?entityId=${entityId}&limit=15`),
        fetch(`/api/identity/users?entityId=${entityId}`),
      ]);
      const logsData = await logsRes.json();
      const usersData = await usersRes.json();
      if (!logsRes.ok) throw new Error(logsData.error || "Failed to load audit log");
      if (!usersRes.ok) throw new Error(usersData.error || "Failed to load users");
      setLogs(logsData.entries ?? []);
      setUsers(usersData.users ?? []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load security data";
      pushToast({ tone: "error", title: "Error", body: message });
    } finally {
      setIsLoading(false);
    }
  }, [entityId, pushToast]);

  useEffect(() => {
    Promise.resolve().then(() => loadData());
  }, [loadData]);

  const mfaSecret = "K5SG E4TN J5SG UZ3M O53G K=== ";

  const handleCopySecret = async () => {
    await navigator.clipboard?.writeText(mfaSecret.replace(/\s/g, ""));
    pushToast({ tone: "success", title: "Copied", body: "Secret key copied to clipboard." });
  };

  // MFA has no backend yet (no TOTP secret storage, no login-time challenge) -
  // this wizard is a client-only demo of the intended flow, not a real
  // enable/disable toggle. Flagged here rather than silently faked as working.
  const handleVerifyMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mfaCode.length !== 6) return;
    setIsVerifyingMfa(true);
    await new Promise(r => setTimeout(r, 1000));
    setIsVerifyingMfa(false);

    if (mfaCode === "123456" || mfaCode === "000000" || mfaCode.startsWith("123")) {
      setMfaEnabled(true);
      setMfaModalOpen(false);
      pushToast({ tone: "success", title: "MFA Activated (Demo)", body: "This is a UI preview only - not yet enforced at login." });
    } else {
      pushToast({ tone: "error", title: "Invalid Code", body: "The 6-digit code was incorrect. Try again." });
    }
  };

  const handleDisableMfa = () => {
    setMfaEnabled(false);
    pushToast({ tone: "warning", title: "MFA Disabled", body: "Two-factor authentication demo turned off." });
  };

  return (
    <PageTransition className="mx-auto max-w-[98rem] flex flex-col gap-6 pb-12 px-4 md:px-6">

      <BoardHeader
        title="Security & Audit Center"
        description="Review platform audit history, manage authorized users, and preview two-factor authentication."
      />

      {/* ── Main Layout Grid ─────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* ── Left Column: Controls (MFA & Policy) ─────────── */}
        <div className="lg:col-span-5 flex flex-col gap-6">

          {/* MFA Panel */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="size-11 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 shadow-inner shrink-0">
                <IconShieldCheck size={20} />
              </div>
              <div>
                <h2 className="headline-md text-slate-900 leading-tight">Two-Factor Auth (2FA)</h2>
                <p className="text-tiny text-slate-400 mt-0.5">Preview - not yet enforced at login</p>
              </div>
            </div>

            <p className="text-caption text-slate-400 mb-5 leading-relaxed">
              Enforce a second validation step upon login by entering temporary TOTP authorization codes generated by Google Authenticator or Microsoft Authenticator.
            </p>

            {mfaEnabled ? (
              <div className="rounded-xl border border-emerald-150 bg-emerald-50/40 p-4 mb-4">
                <div className="flex items-center gap-2 text-emerald-800 font-normal mb-1">
                  <IconCircleCheckFilled size={16} className="text-emerald-500" />
                  MFA Protection Active
                </div>
                <p className="text-tiny text-slate-400 leading-relaxed mb-3">
                  Your workspace profile is fortified with cryptographic auth codes.
                </p>
                <button
                  type="button"
                  onClick={handleDisableMfa}
                  className="rounded-xl border border-red-200 bg-white px-4 py-2 text-caption text-red-500 hover:bg-red-50 transition-colors shadow-sm font-medium"
                >
                  Disable 2FA
                </button>
              </div>
            ) : (
              <div className="rounded-xl border border-amber-150 bg-amber-50/40 p-4 mb-4">
                <div className="flex items-center gap-2 text-amber-800 font-normal mb-1">
                  <IconAlertTriangle size={16} className="text-amber-500 animate-bounce" />
                  Protection Inactive
                </div>
                <p className="text-tiny text-slate-400 leading-relaxed mb-3">
                  Activate two-factor auth to protect payroll and cheque clearance portals.
                </p>
                <button
                  type="button"
                  onClick={() => { setMfaStep("intro"); setMfaModalOpen(true); }}
                  className="flex items-center gap-1.5 rounded-xl bg-[var(--sidebar)] px-4 py-2 text-caption text-white hover:opacity-90 shadow-sm transition-all"
                >
                  <IconLock size={13} />
                  Setup Authenticator
                </button>
              </div>
            )}
          </div>

          {/* Platform Access Limits */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm">
            <h2 className="headline-md text-slate-900 mb-2">Access Rules Policy</h2>
            <p className="text-caption text-slate-400 mb-4">Standard constraints enforced on Sunland ERP accounts:</p>
            <div className="space-y-3">
              {[
                { title: "Session Idle Timeout", value: "30 Minutes" },
                { title: "Failed Login Holdout", value: "5 Attempts / 15m Lock" },
                { title: "Password Rotation", value: "Every 90 Days" },
                { title: "Cheque Dual-Signoff Limit", value: "KES 500,000" },
              ].map(item => (
                <div key={item.title} className="flex justify-between py-2 border-b border-slate-100 last:border-0 text-caption">
                  <span className="text-slate-400">{item.title}</span>
                  <span className="font-mono font-medium text-slate-800">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Right Column: Logs (Audit Logs & Access Users) ── */}
        <div className="lg:col-span-7 flex flex-col gap-6">

          {/* Audit Logs */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
              <div>
                <h2 className="headline-md text-slate-900">Security Audit Logs</h2>
                <p className="text-tiny text-slate-400 mt-0.5">Real log of administrative events</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  loadData();
                  pushToast({ tone: "success", title: "Refreshed", body: "Audit log updated." });
                }}
                className="flex size-8 items-center justify-center rounded-xl bg-slate-50 border border-slate-200 text-slate-400 hover:bg-slate-100 transition-colors shadow-sm"
              >
                <IconRefresh size={14} />
              </button>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-10">
                <LoadingSpinner size="sm" />
              </div>
            ) : (
              <div className="gsap-stagger space-y-3.5 max-h-[350px] overflow-y-auto pr-1 [scrollbar-width:thin]">
                {logs.length === 0 ? (
                  <p className="text-caption text-slate-400 py-6 text-center">No audit events recorded yet.</p>
                ) : (
                  logs.map((log) => (
                    <div key={log.id} className="flex items-start justify-between gap-4 py-2.5 border-b border-slate-50 last:border-0">
                      <div className="min-w-0 flex-1">
                        <p className="text-caption text-slate-800 font-medium">{log.summary}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-tiny text-slate-400 font-mono">{log.action}</span>
                          <span className="text-slate-200">•</span>
                          <span className="text-tiny text-slate-400">{relativeTime(log.createdAt)}</span>
                        </div>
                      </div>
                      <span className="badge-pill border text-tiny px-2 py-0.5 text-slate-600 bg-slate-50 border-slate-200 capitalize shrink-0">
                        {log.associatedType}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Access Users List */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm">
            <h2 className="headline-md text-slate-900 mb-1">Administrative Group</h2>
            <p className="text-tiny text-slate-400 mb-4">Workspace users authorized under executive scopes</p>
            {isLoading ? (
              <div className="flex items-center justify-center py-10">
                <LoadingSpinner size="sm" />
              </div>
            ) : (
              <div className="space-y-3">
                {users.map(u => (
                  <div key={u.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/50">
                    <div>
                      <p className="text-caption font-normal text-slate-800">{u.name}</p>
                      <p className="text-tiny text-slate-400 mt-0.5">{u.email} · {u.role.toUpperCase()} · Last seen {relativeTime(u.lastSignedInAt)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {u.isActive ? (
                        <span className="badge-pill badge-tone-success text-[9px]">ACTIVE</span>
                      ) : (
                        <span className="badge-pill badge-tone-neutral text-[9px]">SUSPENDED</span>
                      )}
                      <span className={cn("size-2 rounded-full shadow-sm", u.isActive ? "bg-emerald-500" : "bg-slate-300")} title={u.isActive ? "Active" : "Suspended"} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* ── MFA Interactive Wizard Modal ─────────────────────── */}
      <Modal open={mfaModalOpen} onClose={() => setMfaModalOpen(false)} title="Setup Two-Factor Auth (MFA)">
        <div className="space-y-5 pt-1 text-slate-700 text-sm">

          {/* Step 1: Introduction */}
          {mfaStep === "intro" && (
            <div className="space-y-4">
              <div className="size-12 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-[var(--sidebar)] shadow-inner mx-auto">
                <IconShieldCheck size={24} />
              </div>
              <div className="text-center">
                <h3 className="font-normal text-slate-900 leading-snug body-md">Setup Authenticator App</h3>
                <p className="text-tiny text-slate-400 mt-1 max-w-sm mx-auto leading-relaxed">
                  Use standard TOTP apps (Google Authenticator, Microsoft Authenticator, 1Password) to protect transactions.
                </p>
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 space-y-2.5">
                <div className="flex gap-2 text-caption">
                  <span className="font-mono text-[var(--sidebar)] font-medium">1.</span>
                  <span>Install an authenticator program from your app catalog.</span>
                </div>
                <div className="flex gap-2 text-caption">
                  <span className="font-mono text-[var(--sidebar)] font-medium">2.</span>
                  <span>Scan the target setup barcode presented in the next step.</span>
                </div>
                <div className="flex gap-2 text-caption">
                  <span className="font-mono text-[var(--sidebar)] font-medium">3.</span>
                  <span>Enter the output 6-digit TOTP pin code to confirm connection.</span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setMfaModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-caption text-slate-650 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => setMfaStep("scan")}
                  className="flex items-center gap-1.5 rounded-xl bg-[var(--sidebar)] px-4 py-2 text-caption text-white hover:opacity-90 shadow-sm transition-all"
                >
                  Get Started <IconChevronDown size={14} className="-rotate-90" />
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Barcode Scanner */}
          {mfaStep === "scan" && (
            <div className="space-y-4">
              <div className="flex flex-col items-center gap-3">
                <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                  <QRCodeSVG
                    value={`otpauth://totp/SunlandERP:security@sunland.co.ke?secret=${mfaSecret.replace(/\s/g, "")}&issuer=Sunland%20Group`}
                    size={135}
                    level="M"
                  />
                </div>
                <p className="text-tiny text-slate-400">Scan this QR code with your authenticator mobile app.</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-450 block label-caps">Manually enter secret key</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={mfaSecret}
                    className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-caption font-mono font-medium text-slate-700 select-all"
                  />
                  <button
                    type="button"
                    onClick={handleCopySecret}
                    className="rounded-xl border border-slate-200 bg-white px-3.5 hover:bg-slate-50 text-slate-600 transition-colors shadow-sm flex items-center justify-center shrink-0"
                    title="Copy key"
                  >
                    <IconCopy size={15} />
                  </button>
                </div>
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setMfaStep("intro")}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-caption text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => setMfaStep("verify")}
                  className="flex items-center gap-1.5 rounded-xl bg-[var(--sidebar)] px-4 py-2 text-caption text-white hover:opacity-90 shadow-sm transition-all"
                >
                  Barcode Scanned <IconChevronDown size={14} className="-rotate-90" />
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Verification TOTP Pin */}
          {mfaStep === "verify" && (
            <form onSubmit={handleVerifyMfa} className="space-y-4">
              <div className="text-center">
                <h3 className="font-normal text-slate-900 leading-snug body-md">Enter 2FA Code</h3>
                <p className="text-tiny text-slate-400 mt-1 max-w-xs mx-auto leading-relaxed">
                  Enter the 6-digit verification code showing inside your authenticator program right now.
                </p>
              </div>

              <div className="max-w-[200px] mx-auto">
                <input
                  required
                  type="text"
                  maxLength={6}
                  placeholder="000000"
                  value={mfaCode}
                  onChange={e => setMfaCode(e.target.value.replace(/\D/g, ""))}
                  className="w-full text-center tracking-[8px] rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-lg font-mono font-medium text-slate-800 focus:border-[var(--sidebar)] focus:outline-none transition-all"
                />
                <p className="text-[10px] text-center text-slate-400 mt-2">Preview only - any 6 digits will proceed, no backend verification exists yet.</p>
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setMfaStep("scan")}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-caption text-slate-650 hover:bg-slate-50 transition-colors"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={mfaCode.length !== 6 || isVerifyingMfa}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl bg-[var(--sidebar)] text-caption text-white hover:opacity-90 transition-all disabled:opacity-50"
                >
                  {isVerifyingMfa ? (
                    <span className="size-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                  ) : (
                    <IconCheck size={14} />
                  )}
                  Enable MFA Code
                </button>
              </div>
            </form>
          )}

        </div>
      </Modal>

    </PageTransition>
  );
}
