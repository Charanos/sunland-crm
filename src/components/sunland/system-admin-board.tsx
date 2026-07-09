"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  IconAlertTriangle,
  IconCheck,
  IconCircleCheck,
  IconDatabase,
  IconDotsVertical,
  IconFileText,
  IconKey,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconSettings,
  IconShieldLock,
  IconUsers,
  IconX,
  IconClipboardCheck,
  IconLifebuoy,
  IconReportAnalytics,
} from "@tabler/icons-react";
import Link from "next/link";
import {
  Badge,
  BoardHeader,
  BoardPanel,
  Button,
  KpiCard,
  PaginationControls,
} from "@/components/ui/erp-primitives";
import { EmptyState } from "@/components/ui/empty-state";
import { PageTransition } from "@/components/shared/page-transition";
import { cn } from "@/lib/utils/cn";

// ─── Types ────────────────────────────────────────────────────────────────────

type SystemUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  primaryEntityId: string | null;
  isActive: boolean;
  createdAt: string;
};

type SystemRole = {
  id: string;
  slug: string;
  name: string;
  scopeType: string;
  isSystem: boolean;
  permissionCount?: number;
};

type Threshold = {
  key: string;
  value: string;
  entityId: string;
  updatedAt: string | null;
};

type AuditEntry = {
  id: string;
  actorId: string;
  actorName?: string;
  action: string;
  module: string;
  resourceType: string;
  resourceId?: string;
  description?: string;
  createdAt: string;
};

// ─── Tab definitions ──────────────────────────────────────────────────────────

const TABS = [
  { id: "users-roles", label: "Users & Roles", icon: IconUsers },
  { id: "thresholds", label: "Approval Thresholds", icon: IconKey },
  { id: "audit", label: "Audit Log", icon: IconFileText },
  { id: "entities", label: "Entities & Divisions", icon: IconDatabase },
  { id: "settings", label: "System Settings", icon: IconSettings },
] as const;

type TabId = (typeof TABS)[number]["id"];

// ─── Threshold label map ───────────────────────────────────────────────────────

const THRESHOLD_META: Record<string, { label: string; description: string; unit: string }> = {
  cheque_hold_threshold_kes: {
    label: "Cheque Hold Threshold",
    description: "Banker's cheques above this value require GM/CEO approval before crediting.",
    unit: "KES",
  },
  petty_cash_approval_threshold_kes: {
    label: "Petty Cash Approval Threshold",
    description: "Petty cash disbursements above this value require approval routing.",
    unit: "KES",
  },
  mandate_unit_approval_threshold: {
    label: "Mandate Unit Approval Threshold",
    description: "Property mandates with more units than this value trigger the GM/CEO approval flow.",
    unit: "units",
  },
  mandate_default_rate: {
    label: "Default Mandate Management Rate",
    description: "The default management fee rate applied to mandate collections.",
    unit: "%",
  },
};

function formatKeyToLabel(key: string): string {
  return key
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
    .replace(' Kes', '');
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatThresholdValue(key: string, value: string): string {
  const isRate = key.includes("rate") || key.includes("pct") || key.includes("percent");
  const isKes = key.includes("kes") || key.includes("limit") || key.includes("amount") || key.includes("payout");
  const meta = THRESHOLD_META[key] ?? { unit: isKes ? "KES" : isRate ? "%" : "" };
  
  const num = parseFloat(value);
  if (isNaN(num)) return value;

  if (isRate) return `${(num * 100).toFixed(1)}%`;
  if (meta.unit === "KES") {
    return `KES ${num.toLocaleString("en-KE")}`;
  }
  return `${num} ${meta.unit}`.trim();
}

function roleTone(role: string): "success" | "data" | "warning" | "neutral" {
  if (role === "ceo") return "warning";
  if (role === "general_manager") return "data";
  if (role.includes("head")) return "success";
  return "neutral";
}

// ─── Grant Access Modal ───────────────────────────────────────────────────────

function GrantAccessModal({
  roles,
  onClose,
  onSuccess,
}: {
  roles: SystemRole[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState({ name: "", email: "", role: "", entityId: "group" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.role) {
      setError("Name, email, and role are required.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/identity/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          roleSlug: form.role,
          primaryEntityId: form.entityId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create user");
      onSuccess();
      onClose();
    } catch (err) {
      const error = err as Error;
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-heading-primary">Grant System Access</h2>
            <p className="mt-0.5 text-slate-500 text-base">Create a staff login linked to a system role.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            aria-label="Close"
          >
            <IconX size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="flex items-start gap-2.5 rounded-lg bg-rose-50 border border-rose-200 px-3 py-2.5">
              <IconAlertTriangle size={15} className="text-rose-500 mt-0.5 shrink-0" />
              <p className="text-base text-rose-700">{error}</p>
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="grant-name" className="label-caps text-slate-500">Full Name</label>
            <input
              id="grant-name"
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Dennis Munge"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-800 outline-none focus:border-[#151936] focus:bg-white transition-colors text-base"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="grant-email" className="label-caps text-slate-500">Work Email</label>
            <input
              id="grant-email"
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="e.g. dennis@sunlandre.co.ke"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-800 outline-none focus:border-[#151936] focus:bg-white transition-colors text-base"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="grant-role" className="label-caps text-slate-500">System Role</label>
            <select
              id="grant-role"
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-800 outline-none focus:border-[#151936] focus:bg-white transition-colors text-base"
            >
              <option value="">Select a role…</option>
              {roles.map((r) => (
                <option key={r.id} value={r.slug}>{r.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <Button type="button" variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
            <Button type="submit" size="sm" disabled={loading}>
              {loading ? "Creating…" : "Grant Access"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Tab: Users & Roles ───────────────────────────────────────────────────────

function UsersRolesTab() {
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [roles, setRoles] = useState<SystemRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [showGrantModal, setShowGrantModal] = useState(false);
  const rowsPerPage = 8;

  const loadData = useCallback(async () => {
    Promise.resolve().then(() => setLoading(true));
    try {
      const [usersRes, rolesRes] = await Promise.all([
        fetch("/api/identity/users"),
        fetch("/api/identity/roles"),
      ]);
      const [usersData, rolesData] = await Promise.all([usersRes.json(), rolesRes.json()]);
      setUsers(usersData.users ?? []);
      setRoles(rolesData.roles ?? []);
    } catch (err) {
      console.error("Failed to load users/roles:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(() => loadData());
  }, [loadData]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      [u.name, u.email, u.role].some((v) => v?.toLowerCase().includes(q)),
    );
  }, [users, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const visible = filtered.slice((page - 1) * rowsPerPage, page * rowsPerPage);

  const activeCount = users.filter((u) => u.isActive).length;
  const suspendedCount = users.filter((u) => !u.isActive).length;

  return (
    <div className="space-y-4">
      {/* KPI strip */}
      <div className="gsap-stagger grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard icon={IconUsers} label="Total Staff" value={String(users.length)} tone="data" />
        <KpiCard icon={IconCircleCheck} label="Active Accounts" value={String(activeCount)} tone="success" />
        <KpiCard icon={IconAlertTriangle} label="Suspended" value={String(suspendedCount)} tone="warning" />
        <KpiCard icon={IconKey} label="System Roles" value={String(roles.length)} tone="neutral" />
      </div>

      <BoardPanel className="gsap-stagger space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-heading-primary">Staff Accounts</h2>
            <p className="mt-0.5 text-slate-500 text-base">All system users, roles, and access status.</p>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 min-w-[200px] items-center gap-2 rounded-lg border border-slate-200 bg-white px-3">
              <IconSearch size={14} className="text-slate-400" />
              <input
                value={query}
                onChange={(e) => { setQuery(e.target.value); setPage(1); }}
                placeholder="Search users…"
                className="w-full bg-transparent text-slate-700 outline-none placeholder:text-slate-400 text-base"
              />
            </div>
            <Button variant="secondary" size="sm" onClick={loadData}>
              <IconRefresh size={14} /> Refresh
            </Button>
            <Button size="sm" onClick={() => setShowGrantModal(true)}>
              <IconPlus size={14} /> Grant Access
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400 text-base">
            Loading staff accounts…
          </div>
        ) : visible.length === 0 ? (
          <EmptyState
            icon={IconUsers}
            title="No staff accounts found"
            description={query ? "Clear the search to see all accounts." : "No users have been provisioned yet."}
            action="Grant First Access"
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-left text-body-regular">
                <thead>
                  <tr className="border-b border-slate-100 label-caps text-slate-400">
                    <th className="px-2 py-2.5">Staff Member</th>
                    <th className="px-2 py-2.5">Role</th>
                    <th className="px-2 py-2.5">Scope</th>
                    <th className="px-2 py-2.5">Status</th>
                    <th className="px-2 py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visible.map((user) => (
                    <tr key={user.id} className="transition-colors hover:bg-slate-50/80">
                      <td className="px-2 py-3">
                        <p className="text-title-primary">{user.name}</p>
                        <p className="text-slate-500 text-base">{user.email}</p>
                      </td>
                      <td className="px-2 py-3">
                        <Badge tone={roleTone(user.role)}>{user.role.replace(/_/g, " ")}</Badge>
                      </td>
                      <td className="px-2 py-3 text-slate-600 text-base">
                        {user.primaryEntityId ?? "Global"}
                      </td>
                      <td className="px-2 py-3">
                        <Badge tone={user.isActive ? "success" : "risk"}>
                          {user.isActive ? "Active" : "Suspended"}
                        </Badge>
                      </td>
                      <td className="px-2 py-3 text-right">
                        <button
                          type="button"
                          aria-label={`Actions for ${user.name}`}
                          className="inline-flex size-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                        >
                          <IconDotsVertical size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <PaginationControls
              currentPage={page}
              totalPages={totalPages}
              onPageChange={setPage}
              label={`${filtered.length} staff members`}
            />
          </>
        )}
      </BoardPanel>

      {showGrantModal && (
        <GrantAccessModal
          roles={roles}
          onClose={() => setShowGrantModal(false)}
          onSuccess={loadData}
        />
      )}
    </div>
  );
}

// ─── Tab: Approval Thresholds ─────────────────────────────────────────────────

function ThresholdsTab() {
  const [thresholds, setThresholds] = useState<Threshold[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);

  const loadThresholds = useCallback(async () => {
    Promise.resolve().then(() => setLoading(true));
    try {
      const res = await fetch("/api/settings?entityId=group");
      const data = await res.json();
      setThresholds(data.settings ?? []);
    } catch (err) {
      console.error("Failed to load thresholds:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(() => loadThresholds());
  }, [loadThresholds]);

  const handleSave = async (key: string) => {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value: editValue, entityId: "group" }),
      });
      if (!res.ok) throw new Error("Save failed");
      await loadThresholds();
      setEditing(null);
    } catch (err) {
      console.error("Failed to save threshold:", err);
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (t: Threshold) => {
    setEditing(t.key);
    // Show as % for rate fields, raw number otherwise
    const num = parseFloat(t.value);
    const isRate = t.key.includes("rate") || t.key.includes("pct") || t.key.includes("percent");
    setEditValue(isRate && !isNaN(num) ? String(num * 100) : t.value);
  };

  return (
    <div className="space-y-4">
      <BoardPanel className="gsap-stagger space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-heading-primary">Approval Authority Thresholds</h2>
            <p className="mt-0.5 text-slate-500 text-base">
              Operational limits stored as data — no code deploy required. Every save is logged to the Audit Log.
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={loadThresholds}>
            <IconRefresh size={14} /> Refresh
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400 text-base">Loading thresholds…</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {thresholds.map((t) => {
              const isRate = t.key.includes("rate") || t.key.includes("pct") || t.key.includes("percent");
              const isKes = t.key.includes("kes") || t.key.includes("limit") || t.key.includes("amount") || t.key.includes("payout");
              const meta = THRESHOLD_META[t.key] ?? { 
                label: formatKeyToLabel(t.key), 
                description: "System configuration parameter.", 
                unit: isKes ? "KES" : isRate ? "%" : "" 
              };
              const isEditing = editing === t.key;
              return (
                <div key={t.key} className="flex flex-wrap items-start justify-between gap-4 py-4 first:pt-0 last:pb-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-title-primary">{meta.label}</p>
                    <p className="mt-0.5 text-slate-500 text-base max-w-md">{meta.description}</p>
                    {t.updatedAt && (
                      <p className="mt-1 text-slate-400 text-sm">
                        Last updated: {new Date(t.updatedAt).toLocaleDateString("en-KE")}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    {isEditing ? (
                      <>
                        <div className="flex items-center gap-1.5">
                          {meta.unit === "%" && (
                            <span className="text-slate-500 text-base">%</span>
                          )}
                          <input
                            type="number"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="w-28 rounded-lg border border-[#151936] bg-white px-3 py-1.5 text-slate-800 outline-none text-base mono-data"
                            autoFocus
                          />
                          {meta.unit === "KES" && (
                            <span className="text-slate-500 text-base">KES</span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleSave(t.key)}
                          disabled={saving}
                          className="flex size-8 items-center justify-center rounded-lg bg-[#151936] text-white hover:bg-[#1e2654] transition-colors disabled:opacity-50"
                          aria-label="Save"
                        >
                          <IconCheck size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditing(null)}
                          className="flex size-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 transition-colors"
                          aria-label="Cancel"
                        >
                          <IconX size={14} />
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="mono-data text-slate-900 text-base">
                          {formatThresholdValue(t.key, t.value)}
                        </span>
                        <button
                          type="button"
                          onClick={() => startEdit(t)}
                          className="rounded-lg border border-slate-200 px-2.5 py-1 text-slate-600 hover:border-slate-300 hover:bg-slate-50 transition-colors text-base"
                        >
                          Edit
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}

            {thresholds.length === 0 && (
              <EmptyState
                icon={IconKey}
                title="No thresholds configured"
                description="Default thresholds will be loaded from the seed data."
                action="Seed Defaults"
              />
            )}
          </div>
        )}
      </BoardPanel>
    </div>
  );
}

// ─── Tab: Audit Log ───────────────────────────────────────────────────────────

function AuditLogTab() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const rowsPerPage = 10;

  const loadAudit = useCallback(async () => {
    Promise.resolve().then(() => setLoading(true));
    try {
      const res = await fetch("/api/audit?limit=100");
      const data = await res.json();
      setEntries(data.entries ?? []);
    } catch (err) {
      console.error("Failed to load audit log:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(() => loadAudit());
  }, [loadAudit]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((e) =>
      [e.action, e.module, e.resourceType, e.description].some((v) =>
        v?.toLowerCase().includes(q),
      ),
    );
  }, [entries, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const visible = filtered.slice((page - 1) * rowsPerPage, page * rowsPerPage);

  return (
    <div className="space-y-4">
      <BoardPanel className="gsap-stagger space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-heading-primary">Consolidated Audit Log</h2>
            <p className="mt-0.5 text-slate-500 text-base">
              Cross-module record of every significant system action. CEO-exclusive view.
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 min-w-[200px] items-center gap-2 rounded-lg border border-slate-200 bg-white px-3">
              <IconSearch size={14} className="text-slate-400" />
              <input
                value={query}
                onChange={(e) => { setQuery(e.target.value); setPage(1); }}
                placeholder="Search audit log…"
                className="w-full bg-transparent text-slate-700 outline-none placeholder:text-slate-400 text-base"
              />
            </div>
            <Button variant="secondary" size="sm" onClick={loadAudit}>
              <IconRefresh size={14} /> Refresh
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400 text-base">Loading audit log…</div>
        ) : visible.length === 0 ? (
          <EmptyState
            icon={IconFileText}
            title="No audit entries found"
            description={query ? "Clear the search to see all entries." : "No audit events have been recorded yet."}
            action="Refresh"
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-body-regular">
                <thead>
                  <tr className="border-b border-slate-100 label-caps text-slate-400">
                    <th className="px-2 py-2.5">Timestamp</th>
                    <th className="px-2 py-2.5">Module</th>
                    <th className="px-2 py-2.5">Action</th>
                    <th className="px-2 py-2.5">Resource</th>
                    <th className="px-2 py-2.5">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visible.map((entry) => (
                    <tr key={entry.id} className="transition-colors hover:bg-slate-50/80">
                      <td className="px-2 py-3 text-slate-500 mono-data whitespace-nowrap">
                        {new Date(entry.createdAt).toLocaleString("en-KE")}
                      </td>
                      <td className="px-2 py-3">
                        <Badge tone="data">{entry.module}</Badge>
                      </td>
                      <td className="px-2 py-3 text-slate-700 text-base">{entry.action}</td>
                      <td className="px-2 py-3 text-slate-600 text-base">{entry.resourceType}</td>
                      <td className="px-2 py-3 text-slate-500 text-base max-w-xs truncate">
                        {entry.description ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <PaginationControls
              currentPage={page}
              totalPages={totalPages}
              onPageChange={setPage}
              label={`${filtered.length} audit entries`}
            />
          </>
        )}
      </BoardPanel>
    </div>
  );
}

// ─── Tab: Entities & Divisions (read-only scaffold) ───────────────────────────

const ENTITIES_SCAFFOLD = [
  { id: "group", name: "Sunland Group", subtitle: "Consolidated entity", status: "active", divisions: 4 },
  { id: "commercial", name: "Sunland Commercial", subtitle: "Commercial property division", status: "active", divisions: 0 },
  { id: "residential", name: "Sunland Residential", subtitle: "Residential property division", status: "active", divisions: 0 },
  { id: "valuers", name: "Sunland Valuers Ltd", subtitle: "Valuation & survey division", status: "active", divisions: 0 },
];

function EntitiesTab() {
  return (
    <div className="space-y-4">
      <BoardPanel className="gsap-stagger space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-heading-primary">Entities & Divisions</h2>
            <p className="mt-0.5 text-slate-500 text-base">
              Structural entities that define the scope of all ERP data. Edit surface coming in P2.
            </p>
          </div>
          <Button size="sm" disabled>
            <IconPlus size={14} /> Add Division
          </Button>
        </div>
        <div className="divide-y divide-slate-100">
          {ENTITIES_SCAFFOLD.map((entity) => (
            <div key={entity.id} className="flex items-center justify-between py-4 first:pt-0 last:pb-0">
              <div>
                <p className="text-title-primary">{entity.name}</p>
                <p className="mt-0.5 text-slate-500 text-base">{entity.subtitle}</p>
              </div>
              <div className="flex items-center gap-3">
                {entity.id === "group" && <Badge tone="data">Consolidated</Badge>}
                <Badge tone="success">Active</Badge>
              </div>
            </div>
          ))}
        </div>
      </BoardPanel>
    </div>
  );
}

// ─── Tab: System Settings (placeholder) ──────────────────────────────────────

function SystemSettingsTab() {
  const SETTINGS_SECTIONS = [
    {
      title: "Statutory Rates",
      description: "PAYE bands, NSSF, SHIF, and Affordable Housing Levy rates. Read by Finance Payroll — changes take effect on the next payroll run.",
      items: [
        { label: "NSSF Employee Rate", value: "6% of gross (capped KES 2,160)", status: "Seeded" },
        { label: "SHIF Rate", value: "2.75% of gross", status: "Seeded" },
        { label: "Affordable Housing Levy", value: "1.5% employer + 1.5% employee", status: "Seeded" },
      ],
    },
    {
      title: "SLA Windows",
      description: "Handling-window thresholds for badge severity coloring across all department specs. Edit surface live in a future backend phase.",
      items: [
        { label: "Maintenance Complaint SLA", value: "48 hours", status: "Default" },
        { label: "Approval Decision SLA", value: "72 hours", status: "Default" },
        { label: "Cheque Credit SLA", value: "5 business days", status: "Default" },
      ],
    },
  ];

  return (
    <div className="space-y-4 animate-fade-in">
      {SETTINGS_SECTIONS.map((section) => (
        <BoardPanel key={section.title} className="space-y-4">
          <div>
            <h2 className="text-heading-primary">{section.title}</h2>
            <p className="mt-0.5 text-slate-500 text-base max-w-2xl">{section.description}</p>
          </div>
          <div className="divide-y divide-slate-100">
            {section.items.map((item) => (
              <div key={item.label} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                <p className="text-slate-700 text-base">{item.label}</p>
                <div className="flex items-center gap-3">
                  <span className="mono-data text-slate-900">{item.value}</span>
                  <Badge tone="neutral">{item.status}</Badge>
                </div>
              </div>
            ))}
          </div>
        </BoardPanel>
      ))}
    </div>
  );
}

// ─── Main Board ───────────────────────────────────────────────────────────────

export function SystemAdminBoard() {
  const [activeTab, setActiveTab] = useState<TabId>("users-roles");

  return (
    <PageTransition className="mx-auto flex max-w-[98rem] flex-col gap-4">
      <BoardHeader
        eyebrow={<Badge tone="warning">CEO Only</Badge>}
        title="System Administration"
        description="User management, permission grants, approval thresholds, and the consolidated audit log. Every action here is logged."
        actions={
          <div className="flex items-center gap-2">
            <Badge tone="data">
              <IconShieldLock size={12} className="mr-1" />
              CEO Access Only
            </Badge>
          </div>
        }
      />

      {/* ── Oversight Control Hub Navigator & Tabs ── */}
      <div className="bg-white border border-slate-100 rounded-[20px] shadow-sm overflow-hidden">
        {/* Top Navigator */}
        <div className="flex items-center justify-between flex-wrap gap-4 p-4">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center">
              <IconClipboardCheck size={16} />
            </div>
            <div>
              <h3 className="text-base font-medium text-slate-800 leading-none">Oversight Control Hub</h3>
              <p className="text-sm text-slate-400 mt-1">Cross-department audits and system management.</p>
            </div>
          </div>

          <div className="flex bg-slate-100 p-1 rounded-xl flex-wrap gap-1">
            <Link
              href="/admin/approvals"
              className="body-sm px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 text-slate-500 hover:text-slate-900 hover:bg-white/45"
            >
              <span>Approvals</span>
              <span className="bg-slate-200 text-slate-600 px-1.5 py-0.2 rounded-full text-meta-muted-strong">Queue</span>
            </Link>
            <Link
              href="/admin/hr/complaints"
              className="body-sm px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 text-slate-500 hover:text-slate-900 hover:bg-white/45"
            >
              <span>Complaints</span>
            </Link>
            <Link
              href="/admin/support"
              className="body-sm px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 text-slate-500 hover:text-slate-900 hover:bg-white/45"
            >
              <span>Support Tickets</span>
            </Link>
            <Link
              href="/admin/reports"
              className="body-sm px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 text-slate-500 hover:text-slate-900 hover:bg-white/45"
            >
              <span>Reports Center</span>
            </Link>
            <Link
              href="/admin/system"
              className="body-sm px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 bg-[#151936] text-white shadow-sm"
            >
              <span>System & Roles</span>
            </Link>
          </div>
        </div>

        {/* Bottom Tab Strip */}
        <div className="border-t border-slate-100 bg-slate-50/50 p-2 px-4 flex items-center gap-1 overflow-x-auto [scrollbar-width:none]">
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider mr-2">View:</span>
          {TABS.map((tab) => {
            const TabIcon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-1.5 text-sm transition-all duration-200 font-medium",
                  isActive
                    ? "bg-[#151936] text-white shadow-sm"
                    : "text-slate-500 hover:bg-slate-200/50 hover:text-slate-800",
                )}
              >
                <TabIcon size={15} aria-hidden />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content */}
      {activeTab === "users-roles" && <UsersRolesTab />}
      {activeTab === "thresholds" && <ThresholdsTab />}
      {activeTab === "audit" && <AuditLogTab />}
      {activeTab === "entities" && <EntitiesTab />}
      {activeTab === "settings" && <SystemSettingsTab />}
    </PageTransition>
  );
}
