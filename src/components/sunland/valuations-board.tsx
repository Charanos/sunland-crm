"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  IconBuildingCommunity,
  IconCalendarEvent,
  IconCash,
  IconCheck,
  IconChevronRight,
  IconEdit,
  IconExternalLink,
  IconFileAnalytics,
  IconFileCheck,
  IconMapPin,
  IconPlus,
  IconRefresh,
  IconReceipt,
  IconSearch,
  IconTrash,
  IconUser,
  IconX,
  IconDotsVertical,
} from "@tabler/icons-react";
import Link from "next/link";
import {
  Badge,
  BoardHeader,
  Button,
  PaginationControls,
  ConfirmDialog,
  DropdownMenu,
  DropdownItem,
} from "@/components/ui/erp-primitives";
import { Modal } from "@/components/ui/modal";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { PageTransition } from "@/components/shared/page-transition";
import { formatCompactKES } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { useToast } from "@/components/ui/toast-provider";

// ── Types (mirror the real /api/valuations response shape) ────────────────────

type ValuationType = "market" | "mortgage_security" | "insurance" | "rental_assessment" | "land";
type ValuationStatus = "requested" | "scheduled" | "in_progress" | "report_draft" | "completed" | "cancelled";

interface Valuation {
  id: string;
  valuationCode: string;
  propertyId: string | null;
  externalPropertyName: string | null;
  externalLocation: string | null;
  clientContactId: string | null;
  valuerId: string | null;
  type: ValuationType;
  purpose: string | null;
  status: ValuationStatus;
  marketValueKes: string | null;
  forcedSaleValueKes: string | null;
  insuranceValueKes: string | null;
  feeKes: string | null;
  feePaid: boolean;
  siteVisitAt: string | null;
  completedAt: string | null;
  validUntil: string | null;
  reportUrl: string | null;
  notes: string | null;
  createdAt: string;
}

interface PropertyOption {
  id: string;
  name: string;
  location: string;
}

interface ContactOption {
  id: string;
  displayName: string;
}

interface UserOption {
  id: string;
  name: string;
}

// ── Display metadata ───────────────────────────────────────────────────────────

const TYPE_META: Record<ValuationType, string> = {
  market: "Open Market",
  mortgage_security: "Mortgage Security",
  insurance: "Insurance",
  rental_assessment: "Rental Assessment",
  land: "Land",
};

const STATUS_META: Record<ValuationStatus, { label: string; tone: "neutral" | "data" | "warning" | "primary" | "success" | "risk" }> = {
  requested: { label: "Requested", tone: "neutral" },
  scheduled: { label: "Site Visit Booked", tone: "data" },
  in_progress: { label: "Inspection", tone: "warning" },
  report_draft: { label: "Report Draft", tone: "primary" },
  completed: { label: "Completed", tone: "success" },
  cancelled: { label: "Cancelled", tone: "risk" },
};

// The workflow ladder — each active stage advances to exactly one next stage;
// completion goes through the record-values modal instead of a blind advance.
const NEXT_STAGE: Partial<Record<ValuationStatus, { status: ValuationStatus; label: string }>> = {
  requested: { status: "scheduled", label: "Mark Site Visit Booked" },
  scheduled: { status: "in_progress", label: "Begin Inspection" },
  in_progress: { status: "report_draft", label: "Move to Report Draft" },
};

const STATUS_FILTERS: Array<{ id: ValuationStatus | "all"; label: string }> = [
  { id: "all", label: "All" },
  { id: "requested", label: "Requested" },
  { id: "scheduled", label: "Scheduled" },
  { id: "in_progress", label: "Inspection" },
  { id: "report_draft", label: "Drafting" },
  { id: "completed", label: "Completed" },
  { id: "cancelled", label: "Cancelled" },
];

const EMPTY_FORM = {
  subjectMode: "portfolio" as "portfolio" | "external",
  propertyId: "",
  externalPropertyName: "",
  externalLocation: "",
  clientContactId: "",
  valuerId: "",
  type: "market" as ValuationType,
  purpose: "",
  feeKes: "",
  siteVisitAt: "",
  notes: "",
};

const EMPTY_COMPLETE_FORM = {
  marketValueKes: "",
  forcedSaleValueKes: "",
  insuranceValueKes: "",
  validUntil: "",
  reportUrl: "",
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" });
}

function toDatetimeLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ── Board ──────────────────────────────────────────────────────────────────────

export function ValuationsBoard({ entityId = "group" }: { entityId?: string }) {
  const { pushToast } = useToast();

  const [valuations, setValuations] = useState<Valuation[]>([]);
  const [properties, setProperties] = useState<PropertyOption[]>([]);
  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [staff, setStaff] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);

  const [statusFilter, setStatusFilter] = useState<ValuationStatus | "all">("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const rowsPerPage = 8;

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Valuation | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);

  const [completing, setCompleting] = useState<Valuation | null>(null);
  const [completeForm, setCompleteForm] = useState(EMPTY_COMPLETE_FORM);
  const [isCompleting, setIsCompleting] = useState(false);

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadValuations = useCallback(async () => {
    Promise.resolve().then(() => setLoading(true));
    try {
      const res = await fetch(`/api/valuations?entityId=${entityId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load valuations");
      setValuations(data.valuations ?? []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load valuations";
      pushToast({ tone: "error", title: "Error", body: message });
    } finally {
      setLoading(false);
    }
  }, [entityId, pushToast]);

  useEffect(() => {
    Promise.resolve().then(() => {
      loadValuations();
      fetch(`/api/properties?entityId=${entityId}`)
        .then((r) => r.json())
        .then((d) => {
          if (Array.isArray(d.properties)) {
            setProperties(d.properties.map((p: { id: string; name: string; location: string }) => ({ id: p.id, name: p.name, location: p.location })));
          }
        })
        .catch(() => {});
      fetch(`/api/contacts?entityId=${entityId}`)
        .then((r) => r.json())
        .then((d) => {
          if (Array.isArray(d.contacts)) {
            setContacts(d.contacts.map((c: { id: string; displayName: string }) => ({ id: c.id, displayName: c.displayName })));
          }
        })
        .catch(() => {});
      fetch(`/api/identity/users?entityId=${entityId}`)
        .then((r) => r.json())
        .then((d) => {
          if (Array.isArray(d.users)) setStaff(d.users.map((u: { id: string; name: string }) => ({ id: u.id, name: u.name })));
        })
        .catch(() => {});
    });
  }, [loadValuations, entityId]);

  const propertyOf = useCallback((id: string | null) => (id ? properties.find((p) => p.id === id) ?? null : null), [properties]);
  const contactName = useCallback((id: string | null) => (id ? contacts.find((c) => c.id === id)?.displayName ?? "—" : "—"), [contacts]);
  const staffName = useCallback((id: string | null) => (id ? staff.find((u) => u.id === id)?.name ?? "Unassigned" : "Unassigned"), [staff]);

  const subjectOf = useCallback((v: Valuation): { name: string; location: string; portfolio: boolean } => {
    const prop = propertyOf(v.propertyId);
    if (prop) return { name: prop.name, location: prop.location, portfolio: true };
    return { name: v.externalPropertyName ?? "Unknown subject", location: v.externalLocation ?? "—", portfolio: false };
  }, [propertyOf]);

  // ── Derived analytics ────────────────────────────────────────────────────────

  const kpis = useMemo(() => {
    const active = valuations.filter((v) => v.status !== "completed" && v.status !== "cancelled");
    const upcomingVisits = valuations.filter(
      (v) => v.siteVisitAt && new Date(v.siteVisitAt) >= new Date() && v.status !== "cancelled" && v.status !== "completed",
    ).length;
    const appraised = valuations
      .filter((v) => v.status === "completed" && v.marketValueKes)
      .reduce((sum, v) => sum + parseFloat(v.marketValueKes!), 0);
    const billable = valuations.filter((v) => v.feeKes && v.status !== "cancelled");
    const totalFees = billable.reduce((sum, v) => sum + parseFloat(v.feeKes!), 0);
    const collected = billable.filter((v) => v.feePaid).reduce((sum, v) => sum + parseFloat(v.feeKes!), 0);
    return {
      active: active.length,
      upcomingVisits,
      appraised,
      totalFees,
      collected,
      collectionRate: totalFees > 0 ? (collected / totalFees) * 100 : 0,
    };
  }, [valuations]);

  const statusCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const v of valuations) counts.set(v.status, (counts.get(v.status) ?? 0) + 1);
    return counts;
  }, [valuations]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return valuations
      .filter((v) => statusFilter === "all" || v.status === statusFilter)
      .filter((v) => {
        if (!q) return true;
        const subject = subjectOf(v);
        return [v.valuationCode, subject.name, subject.location, contactName(v.clientContactId), TYPE_META[v.type]]
          .some((s) => s?.toLowerCase().includes(q));
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [valuations, statusFilter, query, subjectOf, contactName]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const visible = filtered.slice((page - 1) * rowsPerPage, page * rowsPerPage);

  // ── Mutations ────────────────────────────────────────────────────────────────

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
  };

  const openEdit = (v: Valuation) => {
    setEditing(v);
    setForm({
      subjectMode: v.propertyId ? "portfolio" : "external",
      propertyId: v.propertyId ?? "",
      externalPropertyName: v.externalPropertyName ?? "",
      externalLocation: v.externalLocation ?? "",
      clientContactId: v.clientContactId ?? "",
      valuerId: v.valuerId ?? "",
      type: v.type,
      purpose: v.purpose ?? "",
      feeKes: v.feeKes ?? "",
      siteVisitAt: toDatetimeLocal(v.siteVisitAt),
      notes: v.notes ?? "",
    });
    setFormOpen(true);
  };

  const handleSubmit = async () => {
    if (form.subjectMode === "portfolio" && !form.propertyId) {
      pushToast({ tone: "error", title: "Missing subject", body: "Pick the portfolio property being valued." });
      return;
    }
    if (form.subjectMode === "external" && !form.externalPropertyName.trim()) {
      pushToast({ tone: "error", title: "Missing subject", body: "Name the external property being valued." });
      return;
    }
    setIsSaving(true);
    try {
      const payload = {
        entityId,
        propertyId: form.subjectMode === "portfolio" ? form.propertyId : null,
        externalPropertyName: form.subjectMode === "external" ? form.externalPropertyName.trim() : null,
        externalLocation: form.subjectMode === "external" ? (form.externalLocation.trim() || null) : null,
        clientContactId: form.clientContactId || null,
        valuerId: form.valuerId || null,
        type: form.type,
        purpose: form.purpose.trim() || null,
        feeKes: form.feeKes.trim() || null,
        siteVisitAt: form.siteVisitAt ? new Date(form.siteVisitAt).toISOString() : null,
        notes: form.notes.trim() || null,
      };
      // Create rejects nulls for optional fields it treats as absent — strip them.
      const createPayload = Object.fromEntries(Object.entries(payload).filter(([, v]) => v !== null));

      const res = await fetch(editing ? `/api/valuations/${editing.id}` : "/api/valuations", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing ? payload : createPayload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save valuation");

      pushToast({
        tone: "success",
        title: editing ? "Valuation Updated" : "Instruction Opened",
        body: editing ? `${editing.valuationCode} has been updated.` : `Valuation ${data.valuation.valuationCode} created.`,
      });
      setFormOpen(false);
      setEditing(null);
      loadValuations();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save valuation";
      pushToast({ tone: "error", title: "Error", body: message });
    } finally {
      setIsSaving(false);
    }
  };

  const patchValuation = async (id: string, patch: Record<string, unknown>, successBody: string) => {
    try {
      const res = await fetch(`/api/valuations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityId, ...patch }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update valuation");
      pushToast({ tone: "success", title: "Valuation Updated", body: successBody });
      loadValuations();
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update valuation";
      pushToast({ tone: "error", title: "Error", body: message });
      return false;
    }
  };

  const openComplete = (v: Valuation) => {
    setCompleting(v);
    setCompleteForm({
      marketValueKes: v.marketValueKes ?? "",
      forcedSaleValueKes: v.forcedSaleValueKes ?? "",
      insuranceValueKes: v.insuranceValueKes ?? "",
      validUntil: v.validUntil ? v.validUntil.slice(0, 10) : "",
      reportUrl: v.reportUrl ?? "",
    });
  };

  const handleComplete = async () => {
    if (!completing) return;
    if (!completeForm.marketValueKes.trim()) {
      pushToast({ tone: "error", title: "Market value required", body: "Record the appraised market value to complete." });
      return;
    }
    setIsCompleting(true);
    const ok = await patchValuation(
      completing.id,
      {
        status: "completed",
        marketValueKes: completeForm.marketValueKes.trim(),
        forcedSaleValueKes: completeForm.forcedSaleValueKes.trim() || null,
        insuranceValueKes: completeForm.insuranceValueKes.trim() || null,
        validUntil: completeForm.validUntil ? new Date(completeForm.validUntil).toISOString() : null,
        reportUrl: completeForm.reportUrl.trim() || null,
      },
      `${completing.valuationCode} completed and report values recorded.`,
    );
    setIsCompleting(false);
    if (ok) setCompleting(null);
  };

  const handleDelete = async () => {
    if (!deleteConfirmId) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/valuations/${deleteConfirmId}?entityId=${entityId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete valuation");
      pushToast({ tone: "success", title: "Valuation Deleted", body: "The instruction has been removed." });
      loadValuations();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete valuation";
      pushToast({ tone: "error", title: "Error", body: message });
    } finally {
      setIsDeleting(false);
      setDeleteConfirmId(null);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <PageTransition className="mx-auto flex max-w-[98rem] flex-col gap-5">
      <BoardHeader
        eyebrow={<Badge tone="primary">Advisory</Badge>}
        title="Valuations"
        description="Chargeable valuation instructions — site visits, report preparation, appraised values, and fee collection across the advisory book."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={loadValuations}>
              <IconRefresh size={14} /> Refresh
            </Button>
            <Button size="sm" onClick={openCreate}>
              <IconPlus size={14} /> New Valuation
            </Button>
          </div>
        }
      />

      {/* ── Property Portfolio Hub Navigator ── */}
      <div className="flex items-center justify-between flex-wrap gap-4 bg-white border border-slate-100 p-4 rounded-[20px] shadow-sm">
        <div className="flex items-center gap-2">
          <div className="size-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
            <IconBuildingCommunity size={20} />
          </div>
          <div>
            <h3 className="text-title-primary">Property Portfolio Hub</h3>
            <p className="text-desc-secondary mt-1">Manage property inventory, tenancies, maintenance requests, and valuations.</p>
          </div>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-xl flex-wrap gap-1">
          <Link
            href="/admin/properties"
            className="body-sm px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 text-slate-500 hover:text-slate-900 hover:bg-white/45"
          >
            <span>Properties</span>
          </Link>
          <Link
            href="/admin/leases"
            className="body-sm px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 text-slate-500 hover:text-slate-900 hover:bg-white/45"
          >
            <span>Leases</span>
          </Link>
          <Link
            href="/admin/maintenance"
            className="body-sm px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 text-slate-500 hover:text-slate-900 hover:bg-white/45"
          >
            <span>Maintenance</span>
          </Link>
          <Link
            href="/admin/valuations"
            className="body-sm px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 bg-[#151936] text-white shadow-sm"
          >
            <span>Valuations</span>
          </Link>
        </div>
      </div>

      <div className="flex items-center gap-4 mt-2">
        <hr className="flex-1 border-slate-200/60" />
        <span className="label-caps text-slate-400 tracking-wider">Advisory Command</span>
        <hr className="flex-1 border-slate-200/60" />
      </div>

      {/* ── Dense, High-Contrast Dark KPI Tier ── */}
      <div className="gsap-stagger bg-tertiary-gradient border border-[#122a20]/80 p-1.5 rounded-[24px] shadow-xl relative overflow-hidden group">
        <div className="absolute right-0 top-0 size-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-emerald-500/20 transition-colors duration-700 -z-10" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-white/10">

          <div className="p-5 sm:p-6 flex flex-col justify-between">
            <div className="flex items-center gap-3 mb-4">
              <div className="size-8 rounded-xl bg-white/5 flex items-center justify-center text-slate-300 border border-white/10 shadow-sm">
                <IconFileAnalytics size={16} />
              </div>
              <span className="body-sm text-slate-400">Active Instructions</span>
            </div>
            <span className="mono-stat text-white text-[32px] leading-none tracking-tight">{kpis.active}</span>
          </div>

          <div className="p-5 sm:p-6 flex flex-col justify-between">
            <div className="flex items-center gap-3 mb-4">
              <div className="size-8 rounded-xl bg-sky-500/10 flex items-center justify-center text-sky-400 border border-sky-500/20 shadow-sm">
                <IconCalendarEvent size={16} />
              </div>
              <span className="body-sm text-slate-400">Upcoming Site Visits</span>
            </div>
            <span className="mono-stat text-white text-[32px] leading-none tracking-tight">{kpis.upcomingVisits}</span>
          </div>

          <div className="p-5 sm:p-6 flex flex-col justify-between">
            <div className="flex items-center gap-3 mb-4">
              <div className="size-8 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 border border-emerald-500/20 shadow-sm">
                <IconFileCheck size={16} />
              </div>
              <span className="body-sm text-slate-400">Appraised Value Delivered</span>
            </div>
            <span className="mono-stat text-white text-[32px] leading-none tracking-tight">{formatCompactKES(kpis.appraised)}</span>
          </div>

          <div className="p-5 sm:p-6 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="size-8 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 border border-amber-500/20 shadow-sm">
                  <IconCash size={16} />
                </div>
                <span className="body-sm text-slate-400">Fees Collected</span>
              </div>
              <span className="mono-stat text-white text-lg">{formatCompactKES(kpis.collected)}</span>
            </div>
            <div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-amber-400 transition-all duration-1000"
                  style={{ width: `${Math.max(0, Math.min(kpis.collectionRate, 100))}%` }}
                />
              </div>
              <p className="body-sm text-slate-400 mt-2">of {formatCompactKES(kpis.totalFees)} billed</p>
            </div>
          </div>

        </div>
      </div>

      <div className="flex items-center gap-4 mt-4">
        <hr className="flex-1 border-slate-200/60" />
        <span className="label-caps text-slate-400 tracking-wider">Instruction Ledger</span>
        <hr className="flex-1 border-slate-200/60" />
      </div>

      {/* ── Data Tier: Instruction Ledger ── */}
      <div className="bg-transparent lg:bg-white border-transparent lg:border-slate-100 p-0 lg:p-8 rounded-none lg:rounded-[24px] shadow-none lg:shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b-0 lg:border-b border-slate-100 pb-2 lg:pb-5 mb-4 lg:mb-5">
          <div className="w-full md:w-auto md:flex-1 max-w-md">
            <div className="relative flex items-center group w-full">
              <IconSearch size={16} className="absolute left-3.5 text-slate-400 group-focus-within:text-[#151936] transition-colors" />
              <input
                value={query}
                onChange={(e) => { setQuery(e.target.value); setPage(1); }}
                placeholder="Search by code, subject, client, or type…"
                className="w-full bg-slate-50 lg:bg-slate-50 border border-slate-200/60 rounded-xl pl-10 pr-4 py-2.5 body-sm text-slate-900 outline-none placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-[#151936]/10 focus:border-[#151936]/30 transition-all shadow-sm"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-2 md:pb-0 -mx-4 px-4 md:mx-0 md:px-0">
            <div className="flex bg-slate-100 p-1 rounded-xl shrink-0">
              {STATUS_FILTERS.map((f) => {
                const count = f.id === "all" ? valuations.length : (statusCounts.get(f.id) ?? 0);
                return (
                  <button
                    key={f.id}
                    onClick={() => { setStatusFilter(f.id); setPage(1); }}
                    className={cn(
                      "px-3 py-1.5 body-sm font-medium rounded-lg transition-colors flex items-center gap-1.5",
                    statusFilter === f.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700",
                  )}
                >
                  {f.label}
                  {count > 0 && (
                    <span className={cn(
                      "text-xs font-mono px-1.5 py-0.5 rounded-full",
                      statusFilter === f.id ? "bg-[#f3df27] text-[#151936]" : "bg-slate-200/70 text-slate-500",
                    )}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          </div>
        </div>

        {loading ? (
          <div className="space-y-4 py-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 py-3 border-b border-slate-50">
                <div className="h-5 w-24 bg-slate-100 animate-pulse rounded"></div>
                <div className="h-5 w-56 bg-slate-100 animate-pulse rounded"></div>
                <div className="h-5 w-28 bg-slate-100 animate-pulse rounded"></div>
                <div className="h-5 w-32 bg-slate-100 animate-pulse rounded"></div>
                <div className="h-5 w-24 bg-slate-100 animate-pulse rounded ml-auto"></div>
              </div>
            ))}
          </div>
        ) : valuations.length === 0 ? (
          <div className="py-12">
            <EmptyState
              icon={IconFileAnalytics}
              title="No valuations yet"
              description="Open the first valuation instruction — portfolio properties and external subjects both qualify."
              action="New Valuation"
              onClick={openCreate}
            />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12">
            <EmptyState
              icon={IconSearch}
              title="Nothing matches"
              description="No instructions match the current filter or search."
              action="Clear Filters"
              onClick={() => { setStatusFilter("all"); setQuery(""); setPage(1); }}
            />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Mobile/Tablet Card Grid (hidden on desktop) */}
            <div className="block lg:hidden space-y-4">
              {visible.map((v) => {
                const subject = subjectOf(v);
                const status = STATUS_META[v.status];
                return (
                  <div
                    key={v.id}
                    onClick={() => openEdit(v)}
                    className="p-5 bg-white border border-slate-100 rounded-2xl shadow-sm hover:shadow-md transition-all flex flex-col gap-4 relative cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "size-11 shrink-0 rounded-xl border flex items-center justify-center",
                          subject.portfolio ? "bg-teal-50 border-teal-100 text-teal-600" : "bg-slate-50 border-slate-200 text-slate-400",
                        )}>
                          {subject.portfolio ? <IconBuildingCommunity size={18} /> : <IconExternalLink size={18} />}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-title-primary leading-snug truncate">{subject.name}</h4>
                          <span className="mono-data text-slate-400 text-xs">{v.valuationCode}</span>
                        </div>
                      </div>
                      <Badge tone={status.tone}>{status.label}</Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-y-3 gap-x-2 text-xs border-t border-slate-50 pt-3">
                      <div>
                        <p className="label-caps text-slate-400 mb-0.5">Client &amp; Type</p>
                        <span className="body-sm text-slate-700 block truncate">{contactName(v.clientContactId)}</span>
                        <span className="body-sm text-slate-500 block truncate">{TYPE_META[v.type]}</span>
                      </div>
                      <div>
                        <p className="label-caps text-slate-400 mb-0.5">Valuer</p>
                        <span className="body-sm text-slate-700 block truncate">{staffName(v.valuerId)}</span>
                      </div>
                      <div>
                        <p className="label-caps text-slate-400 mb-0.5">Market Value</p>
                        <span className="mono-amount text-slate-900 text-sm">
                          {v.marketValueKes ? formatCompactKES(parseFloat(v.marketValueKes)) : "—"}
                        </span>
                      </div>
                      <div>
                        <p className="label-caps text-slate-400 mb-0.5">Fee &amp; Payment</p>
                        <span className="mono-amount text-slate-900 text-sm flex items-center gap-1">
                          {v.feeKes ? formatCompactKES(parseFloat(v.feeKes)) : "—"}
                          {v.feeKes && (
                            <span
                              className={cn("size-1.5 rounded-full", v.feePaid ? "bg-emerald-500" : "bg-amber-400")}
                            />
                          )}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-slate-55 pt-3 border-slate-50 text-xs" onClick={(e) => e.stopPropagation()}>
                      <span className="text-slate-400 flex items-center gap-1">
                        <IconCalendarEvent size={12} />
                        {v.status === "completed" ? `Done ${fmtDate(v.completedAt)}` : v.siteVisitAt ? `Visit ${fmtDate(v.siteVisitAt)}` : "Visit unbooked"}
                      </span>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => openEdit(v)}
                        >
                          <IconEdit size={13} className="mr-1" /> Edit
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Table wrapper: hidden on mobile, visible on desktop */}
            <div className="hidden lg:block overflow-x-auto custom-scrollbar pb-2">
              <table className="w-full min-w-[1000px] text-left">
                <thead>
                  <tr className="border-b border-slate-100 label-caps text-slate-500 bg-slate-50/50">
                    <th className="px-4 py-3">Code</th>
                    <th className="px-4 py-3">Subject</th>
                    <th className="px-4 py-3">Client</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Valuer</th>
                    <th className="px-4 py-3 text-right">Market Value</th>
                    <th className="px-4 py-3 text-right">Fee</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visible.map((v) => {
                    const subject = subjectOf(v);
                    const status = STATUS_META[v.status];
                    const nextStage = NEXT_STAGE[v.status];
                    return (
                      <tr
                        key={v.id}
                        className="transition-colors hover:bg-slate-50/80 group cursor-pointer"
                        onClick={() => openEdit(v)}
                      >
                        <td className="px-4 py-4 mono-data text-slate-500 group-hover:text-slate-900 transition-colors whitespace-nowrap">{v.valuationCode}</td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "size-9 shrink-0 rounded-lg border flex items-center justify-center",
                              subject.portfolio ? "bg-teal-50 border-teal-100 text-teal-600" : "bg-slate-50 border-slate-200 text-slate-400",
                            )}>
                              {subject.portfolio ? <IconBuildingCommunity size={16} /> : <IconExternalLink size={16} />}
                            </div>
                            <div className="min-w-0">
                              <p className="text-title-primary truncate">{subject.name}</p>
                              <p className="text-meta-muted flex items-center gap-1 mt-0.5">
                                <IconMapPin size={11} /> {subject.location}
                                {!subject.portfolio && <span className="ml-1 px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 text-[10px] uppercase tracking-wide">External</span>}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 body-sm text-slate-600 whitespace-nowrap">{contactName(v.clientContactId)}</td>
                        <td className="px-4 py-4 body-sm text-slate-600 whitespace-nowrap">{TYPE_META[v.type]}</td>
                        <td className="px-4 py-4 body-sm text-slate-600 whitespace-nowrap">
                          <span className="flex items-center gap-1.5">
                            <IconUser size={13} className="text-slate-300" /> {staffName(v.valuerId)}
                          </span>
                          <span className="text-meta-muted flex items-center gap-1 mt-0.5">
                            <IconCalendarEvent size={11} className="text-slate-300" />
                            {v.status === "completed" ? `Done ${fmtDate(v.completedAt)}` : v.siteVisitAt ? `Visit ${fmtDate(v.siteVisitAt)}` : "Visit unbooked"}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-right mono-amount text-slate-900 whitespace-nowrap">
                          {v.marketValueKes ? formatCompactKES(parseFloat(v.marketValueKes)) : "—"}
                        </td>
                        <td className="px-4 py-4 text-right whitespace-nowrap">
                          {v.feeKes ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <span className="mono-amount text-slate-900">{formatCompactKES(parseFloat(v.feeKes))}</span>
                              <span
                                className={cn("size-2 rounded-full", v.feePaid ? "bg-emerald-500" : "bg-amber-400")}
                                title={v.feePaid ? "Fee collected" : "Fee outstanding"}
                              />
                            </div>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-center">
                          <Badge tone={status.tone}>{status.label}</Badge>
                        </td>
                        <td className="px-4 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu
                            label="Valuation actions"
                            trigger={
                              <div
                                className="p-1.5 rounded-md text-slate-400 hover:bg-white hover:shadow-sm hover:text-slate-900 transition-all border border-transparent hover:border-slate-200"
                                aria-label="Valuation actions"
                              >
                                <IconDotsVertical size={16} />
                              </div>
                            }
                            align="right"
                          >
                            {nextStage && (
                              <DropdownItem
                                icon={IconChevronRight}
                                onClick={() => patchValuation(v.id, { status: nextStage.status }, `${v.valuationCode} → ${STATUS_META[nextStage.status].label}.`)}
                              >
                                {nextStage.label}
                              </DropdownItem>
                            )}
                            {(v.status === "report_draft" || v.status === "in_progress") && (
                              <DropdownItem icon={IconFileCheck} onClick={() => openComplete(v)}>
                                Record Values & Complete
                              </DropdownItem>
                            )}
                            {v.feeKes && (
                              <DropdownItem
                                icon={IconReceipt}
                                onClick={() => patchValuation(v.id, { feePaid: !v.feePaid }, v.feePaid ? "Fee marked outstanding." : "Fee marked collected.")}
                              >
                                {v.feePaid ? "Mark Fee Outstanding" : "Mark Fee Collected"}
                              </DropdownItem>
                            )}
                            <DropdownItem icon={IconEdit} onClick={() => openEdit(v)}>
                              Edit Instruction
                            </DropdownItem>
                            {v.status !== "completed" && v.status !== "cancelled" && (
                              <DropdownItem
                                icon={IconX}
                                onClick={() => patchValuation(v.id, { status: "cancelled" }, `${v.valuationCode} cancelled.`)}
                              >
                                Cancel Instruction
                              </DropdownItem>
                            )}
                            <div className="my-1 h-px bg-slate-100" />
                            <DropdownItem icon={IconTrash} variant="danger" onClick={() => setDeleteConfirmId(v.id)}>
                              Delete
                            </DropdownItem>
                          </DropdownMenu>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="border-t border-slate-100 pt-5">
              <PaginationControls
                currentPage={page}
                totalPages={totalPages}
                onPageChange={setPage}
                label={`${filtered.length} instruction${filtered.length === 1 ? "" : "s"}`}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Create / Edit Modal ── */}
      <Modal
        open={formOpen}
        onClose={() => !isSaving && setFormOpen(false)}
        title={editing ? `Edit ${editing.valuationCode}` : "New Valuation Instruction"}
        description={editing ? "Update the instruction details" : "Open a chargeable valuation instruction for a portfolio or external subject"}
        size="lg"
      >
        <div className="space-y-5">
          {/* Subject */}
          <div className="bg-slate-50/50 rounded-xl p-5 border border-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <h3 className="text-title-primary">Subject Property</h3>
              <div className="flex bg-slate-100 p-1 rounded-lg">
                {(["portfolio", "external"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, subjectMode: m }))}
                    className={cn(
                      "px-3 py-1 text-sm font-medium rounded-md transition-colors capitalize",
                      form.subjectMode === m ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700",
                    )}
                  >
                    {m === "portfolio" ? "Portfolio" : "External"}
                  </button>
                ))}
              </div>
            </div>

            {form.subjectMode === "portfolio" ? (
              <div>
                <label className="label-caps text-slate-500 mb-1.5 block">Portfolio Property</label>
                <select
                  className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-body-primary focus:outline-none focus:border-[#151936]/40 transition-colors shadow-sm"
                  value={form.propertyId}
                  onChange={(e) => setForm((f) => ({ ...f, propertyId: e.target.value }))}
                >
                  <option value="">-- Select property --</option>
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} · {p.location}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label-caps text-slate-500 mb-1.5 block">Property Name</label>
                  <input
                    className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-body-primary placeholder:text-slate-400 focus:outline-none focus:border-[#151936]/40 transition-colors shadow-sm"
                    placeholder="e.g. Riverside Grove Office Park"
                    value={form.externalPropertyName}
                    onChange={(e) => setForm((f) => ({ ...f, externalPropertyName: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="label-caps text-slate-500 mb-1.5 block">Location</label>
                  <input
                    className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-body-primary placeholder:text-slate-400 focus:outline-none focus:border-[#151936]/40 transition-colors shadow-sm"
                    placeholder="e.g. Riverside Drive, Nairobi"
                    value={form.externalLocation}
                    onChange={(e) => setForm((f) => ({ ...f, externalLocation: e.target.value }))}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Instruction */}
          <div className="bg-slate-50/50 rounded-xl p-5 border border-slate-100 space-y-4">
            <h3 className="text-title-primary border-b border-slate-200 pb-2">Instruction Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label-caps text-slate-500 mb-1.5 block">Valuation Type</label>
                <select
                  className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-body-primary focus:outline-none focus:border-[#151936]/40 transition-colors shadow-sm"
                  value={form.type}
                  onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as ValuationType }))}
                >
                  {(Object.keys(TYPE_META) as ValuationType[]).map((t) => (
                    <option key={t} value={t}>{TYPE_META[t]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label-caps text-slate-500 mb-1.5 block">Client</label>
                <select
                  className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-body-primary focus:outline-none focus:border-[#151936]/40 transition-colors shadow-sm"
                  value={form.clientContactId}
                  onChange={(e) => setForm((f) => ({ ...f, clientContactId: e.target.value }))}
                >
                  <option value="">-- No client on record --</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>{c.displayName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label-caps text-slate-500 mb-1.5 block">Assigned Valuer</label>
                <select
                  className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-body-primary focus:outline-none focus:border-[#151936]/40 transition-colors shadow-sm"
                  value={form.valuerId}
                  onChange={(e) => setForm((f) => ({ ...f, valuerId: e.target.value }))}
                >
                  <option value="">-- Unassigned --</option>
                  {staff.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label-caps text-slate-500 mb-1.5 block">Professional Fee (KES)</label>
                <input
                  type="number"
                  className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 mono-data placeholder:text-slate-400 focus:outline-none focus:border-[#151936]/40 transition-colors shadow-sm"
                  placeholder="e.g. 150000"
                  value={form.feeKes}
                  onChange={(e) => setForm((f) => ({ ...f, feeKes: e.target.value }))}
                />
              </div>
              <div>
                <label className="label-caps text-slate-500 mb-1.5 block">Site Visit</label>
                <input
                  type="datetime-local"
                  className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 mono-data text-slate-800 focus:outline-none focus:border-[#151936]/40 transition-colors shadow-sm"
                  value={form.siteVisitAt}
                  onChange={(e) => setForm((f) => ({ ...f, siteVisitAt: e.target.value }))}
                />
              </div>
              <div>
                <label className="label-caps text-slate-500 mb-1.5 block">Purpose</label>
                <input
                  className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-body-primary placeholder:text-slate-400 focus:outline-none focus:border-[#151936]/40 transition-colors shadow-sm"
                  placeholder="e.g. Mortgage security for facility renewal"
                  value={form.purpose}
                  onChange={(e) => setForm((f) => ({ ...f, purpose: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <label className="label-caps text-slate-500 mb-1.5 block">Notes</label>
              <textarea
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-body-primary resize-none h-20 placeholder:text-slate-400 focus:outline-none focus:border-[#151936]/40 transition-colors shadow-sm"
                placeholder="Access arrangements, comparables, internal context…"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
            <Button variant="secondary" onClick={() => setFormOpen(false)} disabled={isSaving}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={isSaving}>
              {isSaving ? (
                <><LoadingSpinner size="sm" /><span className="ml-2">{editing ? "Saving…" : "Opening…"}</span></>
              ) : (
                editing ? "Save Changes" : "Open Instruction"
              )}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Record Values & Complete Modal ── */}
      <Modal
        open={!!completing}
        onClose={() => !isCompleting && setCompleting(null)}
        title={completing ? `Complete ${completing.valuationCode}` : "Complete Valuation"}
        description="Record the appraised values and deliver the report"
        size="md"
      >
        {completing && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="label-caps text-slate-500 mb-1.5 block">Open Market Value (KES) <span className="text-rose-500">*</span></label>
                <input
                  type="number"
                  className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 mono-data placeholder:text-slate-400 focus:outline-none focus:border-[#151936]/40 transition-colors shadow-sm"
                  placeholder="e.g. 48500000"
                  value={completeForm.marketValueKes}
                  onChange={(e) => setCompleteForm((f) => ({ ...f, marketValueKes: e.target.value }))}
                />
              </div>
              <div>
                <label className="label-caps text-slate-500 mb-1.5 block">Forced Sale Value (KES)</label>
                <input
                  type="number"
                  className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 mono-data placeholder:text-slate-400 focus:outline-none focus:border-[#151936]/40 transition-colors shadow-sm"
                  placeholder="Typically ~80% of OMV"
                  value={completeForm.forcedSaleValueKes}
                  onChange={(e) => setCompleteForm((f) => ({ ...f, forcedSaleValueKes: e.target.value }))}
                />
              </div>
              <div>
                <label className="label-caps text-slate-500 mb-1.5 block">Insurance Value (KES)</label>
                <input
                  type="number"
                  className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 mono-data placeholder:text-slate-400 focus:outline-none focus:border-[#151936]/40 transition-colors shadow-sm"
                  placeholder="Reinstatement cost"
                  value={completeForm.insuranceValueKes}
                  onChange={(e) => setCompleteForm((f) => ({ ...f, insuranceValueKes: e.target.value }))}
                />
              </div>
              <div>
                <label className="label-caps text-slate-500 mb-1.5 block">Valid Until</label>
                <input
                  type="date"
                  className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 mono-data text-slate-800 focus:outline-none focus:border-[#151936]/40 transition-colors shadow-sm"
                  value={completeForm.validUntil}
                  onChange={(e) => setCompleteForm((f) => ({ ...f, validUntil: e.target.value }))}
                />
                <p className="text-meta-muted mt-1">Defaults to 6 months if left blank.</p>
              </div>
              <div>
                <label className="label-caps text-slate-500 mb-1.5 block">Report URL</label>
                <input
                  className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-body-primary placeholder:text-slate-400 focus:outline-none focus:border-[#151936]/40 transition-colors shadow-sm"
                  placeholder="Link to the delivered report"
                  value={completeForm.reportUrl}
                  onChange={(e) => setCompleteForm((f) => ({ ...f, reportUrl: e.target.value }))}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
              <Button variant="secondary" onClick={() => setCompleting(null)} disabled={isCompleting}>Cancel</Button>
              <Button onClick={handleComplete} disabled={isCompleting}>
                {isCompleting ? (
                  <><LoadingSpinner size="sm" /><span className="ml-2">Completing…</span></>
                ) : (
                  <><IconCheck size={14} /> Complete Valuation</>
                )}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleteConfirmId}
        title="Delete Valuation"
        description="This permanently removes the valuation instruction and its recorded values. The deletion itself stays on the audit trail."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        tone="danger"
        isLoading={isDeleting}
        onConfirm={handleDelete}
        onClose={() => setDeleteConfirmId(null)}
      />
    </PageTransition>
  );
}
