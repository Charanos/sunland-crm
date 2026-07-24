"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  IconAlertTriangle,
  IconArrowUpRight,
  IconCalendarBolt,
  IconChartBar,
  IconCheck,
  IconLayoutKanban,
  IconLink,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";
import {
  Avatar,
  Badge,
  Button,
  ConfirmDialog,
  Drawer,
  Modal,
  SkeletonBlock,
} from "@/components/ui/erp-primitives";
import { EmptyState } from "@/components/ui/empty-state";
import { PageTransition } from "@/components/shared/page-transition";
import { useToast } from "@/components/ui/toast-provider";
import { cn } from "@/lib/utils/cn";
import { formatCompactKES } from "@/lib/utils/format";
import {
  BOARD_COLUMN_META,
  BOARD_COLUMN_ORDER,
  PROJECT_DEPT_META,
  boardColumnFor,
  boardStateForColumn,
  deptMeta,
  milestoneProgress,
  type BoardColumn,
  type Milestone,
} from "./scheduler-constants";

interface ProjectRow {
  id: string;
  title: string;
  description: string | null;
  department: string;
  status: string;
  progressPercent: number | null;
  assigneeIds: string[] | null;
  dueDate: string | null;
  startDate: string | null;
  milestones: Milestone[] | null;
  atRisk: boolean;
  budgetKes: string | null;
  linkedRecordType: string | null;
  linkedRecordId: string | null;
  createdById: string;
  createdAt: string;
}

interface StaffUser { id: string; name: string; role: string; avatarUrl: string | null }

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function initialsOf(name: string) {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p[1]?.[0] ?? "")).toUpperCase() || "?";
}

function shortRange(p: ProjectRow) {
  const fmt = (s: string | null) => (s ? new Date(s).toLocaleDateString("en-KE", { day: "2-digit", month: "short" }) : "—");
  return `${fmt(p.startDate)} – ${fmt(p.dueDate)}`;
}

/** Positions a bar on the 12-month planner from the project's real dates. */
function yearSpan(p: ProjectRow) {
  const year = new Date().getFullYear();
  const start = p.startDate ? new Date(p.startDate) : null;
  const end = p.dueDate ? new Date(p.dueDate) : null;
  const s = start && start.getFullYear() === year ? start.getMonth() : 0;
  const e = end && end.getFullYear() === year ? end.getMonth() : s;
  const from = Math.min(s, e);
  const to = Math.max(s, e);
  return { left: (from / 12) * 100, width: Math.max(4, ((to - from + 1) / 12) * 100) };
}

function recordHref(type: string | null, id: string | null): string | null {
  if (!type || !id) return null;
  switch (type) {
    case "maintenance_request": return `/admin/maintenance/${id}`;
    case "lease": return `/admin/leases/${id}`;
    case "property": return `/admin/properties/${id}`;
    case "lead": return "/admin/pipeline";
    default: return null;
  }
}

export function ProjectsBoard({ entityId = "group" }: { entityId?: string }) {
  const { pushToast } = useToast();
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"board" | "timeline">("board");
  const [dragId, setDragId] = useState<string | null>(null);
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ProjectRow | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/operations/projects?entityId=${entityId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed to load projects");
      setProjects(Array.isArray(data.projects) ? data.projects : []);
    } catch (err) {
      pushToast({ tone: "error", title: "Couldn't load projects", body: err instanceof Error ? err.message : "Try again." });
    } finally {
      setLoading(false);
    }
  }, [entityId, pushToast]);

  useEffect(() => {
    Promise.resolve().then(() => {
      load();
      fetch("/api/identity/users?entityId=group").then((r) => r.json()).then((d) => { if (Array.isArray(d.users)) setStaff(d.users); }).catch(() => { });
    });
  }, [load]);

  const staffById = useMemo(() => new Map(staff.map((s) => [s.id, s])), [staff]);
  const ownerOf = (p: ProjectRow) => staffById.get(p.assigneeIds?.[0] ?? p.createdById);

  const columns = useMemo(() => BOARD_COLUMN_ORDER.map((col) => ({
    id: col,
    ...BOARD_COLUMN_META[col],
    cards: projects.filter((p) => boardColumnFor(p.status, p.atRisk) === col),
  })), [projects]);

  const inFlight = projects.filter((p) => p.status !== "completed" && p.status !== "planning").length;
  const atRisk = projects.filter((p) => p.atRisk && p.status !== "completed");
  const doneThisMonth = projects.filter((p) => {
    if (p.status !== "completed") return false;
    const d = p.dueDate ? new Date(p.dueDate) : new Date(p.createdAt);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  const drawerProject = projects.find((p) => p.id === drawerId) ?? null;

  // ── Actions ────────────────────────────────────────────────────────────────
  const moveTo = async (project: ProjectRow, column: BoardColumn) => {
    if (boardColumnFor(project.status, project.atRisk) === column) return;
    const next = boardStateForColumn(column);
    setProjects((prev) => prev.map((p) => (p.id === project.id
      ? { ...p, status: next.status ?? p.status, atRisk: next.atRisk, progressPercent: column === "done" ? 100 : p.progressPercent }
      : p)));
    try {
      const res = await fetch(`/api/operations/projects/${project.id}/board-state`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Failed to move");
      pushToast({ tone: column === "risk" ? "warning" : "success", title: `Moved to ${BOARD_COLUMN_META[column].label}`, body: project.title });
      load();
    } catch (err) {
      load();
      pushToast({ tone: "error", title: "Couldn't move project", body: err instanceof Error ? err.message : "Try again." });
    }
  };

  const toggleMilestone = async (project: ProjectRow, index: number, done: boolean) => {
    setProjects((prev) => prev.map((p) => (p.id === project.id
      ? { ...p, milestones: (p.milestones ?? []).map((m, i) => (i === index ? { ...m, done } : m)) }
      : p)));
    try {
      const res = await fetch(`/api/operations/projects/${project.id}/milestone`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ index, done }),
      });
      if (!res.ok) throw new Error("Failed");
      load();
    } catch {
      load();
      pushToast({ tone: "warning", title: "Couldn't update milestone", body: "Try again." });
    }
  };

  const remove = async (project: ProjectRow) => {
    try {
      const res = await fetch(`/api/operations/projects/${project.id}?entityId=${entityId}`, { method: "DELETE" });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Failed to delete");
      pushToast({ tone: "success", title: "Project deleted", body: `"${project.title}" was removed.` });
      setDrawerId(null);
      load();
    } catch (err) {
      pushToast({ tone: "error", title: "Couldn't delete", body: err instanceof Error ? err.message : "Try again." });
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <PageTransition className="mx-auto flex max-w-[98rem] flex-col gap-4">
      {/* ══ Header ══ */}
      <div className="flex items-end justify-between gap-4 flex-wrap border-b border-slate-200/60 pb-3">
        <div className="flex items-baseline gap-4 flex-wrap">
          <h1 className="title-serif text-slate-900">Projects</h1>
          <div className="flex gap-1 bg-white border border-slate-100 rounded-xl p-1 shadow-sm" role="tablist" aria-label="Projects view">
            {([["board", "Board", IconLayoutKanban], ["timeline", "Timeline", IconChartBar]] as const).map(([key, label, Ico]) => (
              <button
                key={key}
                role="tab"
                aria-selected={view === key}
                onClick={() => setView(key)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors",
                  view === key ? "bg-[#151936] text-white shadow-sm" : "text-slate-500 hover:text-slate-900",
                )}
              ><Ico size={14} /> {label}</button>
            ))}
          </div>
          <Link href="/admin/scheduler?mode=projects" className="inline-flex items-center gap-1.5 text-xs font-medium text-[#122a20] hover:underline">
            <IconCalendarBolt size={14} /> Open in Scheduler
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center">
            {staff.slice(0, 4).map((s) => (
              <Avatar key={s.id} src={s.avatarUrl ?? undefined} fallback={initialsOf(s.name)} className="size-8 rounded-full -ml-2 first:ml-0 ring-2 ring-white" />
            ))}
          </div>
          <Button size="sm" onClick={() => setNewOpen(true)}><IconPlus size={14} /> New Project</Button>
        </div>
      </div>

      {/* ══ Hero ══ */}
      <div
        className="gsap-stagger relative rounded-[28px] overflow-hidden shadow-[0_16px_40px_rgba(21,25,54,0.16)]"
        style={{ background: "linear-gradient(115deg,#0a0d1c 0%,#151936 45%,#122a20 100%)" }}
      >
        <IconChartBar size={220} stroke={1} className="absolute -right-8 -bottom-14 text-white/[0.05] pointer-events-none" />
        <div className="relative flex items-center justify-between gap-5 flex-wrap p-6">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#f3df27] px-2.5 py-1 text-xxs font-medium uppercase tracking-[0.06em] text-[#151936]">
              <IconChartBar size={12} /> Initiative tracking
            </span>
            <p className="mt-2.5 text-3xl font-medium text-white leading-tight">
              {new Date().toLocaleDateString("en-KE", { month: "long", year: "numeric" })} — {inFlight} initiative{inFlight === 1 ? "" : "s"} in flight
            </p>
            <p className="mt-1 text-sm text-white/70">
              {atRisk.length > 0
                ? `${atRisk.length} at risk — ${atRisk.slice(0, 3).map((p) => p.title).join(", ")}`
                : "Everything on track."}
            </p>
          </div>
          <div className="flex gap-2.5 flex-wrap">
            <HeroStat label="In flight" value={inFlight} color="#ffffff" />
            <HeroStat label="At risk" value={atRisk.length} color={atRisk.length ? "#fda4af" : "#ffffff"} />
            <HeroStat label="Done this month" value={doneThisMonth} color="#6ee7b7" />
          </div>
        </div>
      </div>

      {/* ══ BOARD ══ */}
      {view === "board" && (
        loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => <SkeletonBlock key={i} className="h-64 rounded-[20px]" />)}
          </div>
        ) : projects.length === 0 ? (
          <div className="bg-white border border-slate-100 rounded-3xl p-8">
            <EmptyState
              icon={IconLayoutKanban}
              title="No initiatives yet"
              description="Cross-department projects you create show up here and on the Scheduler's year planner."
              action="New Project"
              onClick={() => setNewOpen(true)}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 items-start">
            {columns.map((col) => (
              <div
                key={col.id}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const id = dragId ?? e.dataTransfer.getData("text/plain");
                  const project = projects.find((p) => p.id === id);
                  if (project) moveTo(project, col.id);
                  setDragId(null);
                }}
                className="bg-[#eef1e9] border border-slate-200/70 rounded-[20px] p-3 min-w-0"
              >
                <div className="flex items-center justify-between px-1 pb-2.5">
                  <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.09em] text-slate-500">
                    <span className="size-2 rounded-full" style={{ background: col.color }} />
                    {col.label}
                  </p>
                  <span className="font-mono font-medium text-xs text-slate-400">{col.cards.length}</span>
                </div>

                <div className="flex flex-col gap-2.5 min-h-[60px]">
                  {col.cards.map((p) => {
                    const dept = deptMeta(p.department);
                    const owner = ownerOf(p);
                    const ms = milestoneProgress(p.milestones);
                    return (
                      <div
                        key={p.id}
                        draggable
                        onDragStart={(e) => { setDragId(p.id); try { e.dataTransfer.setData("text/plain", p.id); } catch { /* Safari */ } }}
                        onDragEnd={() => setDragId(null)}
                        onClick={() => setDrawerId(p.id)}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setDrawerId(p.id); } }}
                        role="button"
                        tabIndex={0}
                        className={cn(
                          "bg-white border border-slate-100 rounded-2xl p-3.5 cursor-pointer shadow-[0_4px_14px_rgba(0,0,0,0.03)] hover:shadow-[0_12px_30px_rgba(0,0,0,0.09)] transition-shadow",
                          dragId === p.id && "opacity-50",
                        )}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xxs font-medium uppercase tracking-wide", dept.chip)}>{dept.label}</span>
                          <span className="font-mono text-xxs text-slate-400">{shortRange(p)}</span>
                        </div>
                        <p className="text-sm font-medium text-slate-900 leading-snug">{p.title}</p>
                        <p className="text-xs text-slate-400 mt-0.5 truncate">{p.description ?? "No description"}</p>
                        <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden my-2.5" aria-hidden>
                          <div className="h-full rounded-full" style={{ width: `${p.progressPercent ?? 0}%`, background: col.bar }} />
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-2">
                            <Avatar src={owner?.avatarUrl ?? undefined} fallback={initialsOf(owner?.name ?? "?")} className="size-6 rounded-full" />
                            <span className="text-xs text-slate-500">{ms.done}/{ms.total} milestones</span>
                          </span>
                          <span className="font-mono font-medium text-xs text-[#122a20]">{p.progressPercent ?? 0}%</span>
                        </div>
                      </div>
                    );
                  })}
                  {col.cards.length === 0 && (
                    <div className="border border-dashed border-slate-300 rounded-2xl p-5 text-center text-xs text-slate-400">Drop a project here</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* ══ TIMELINE ══ */}
      {view === "timeline" && (
        <div className="bg-white border border-slate-100 rounded-3xl shadow-[0_8px_30px_rgba(0,0,0,0.04)] p-5">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
            <p className="text-base font-medium text-slate-900">
              {new Date().getFullYear()} planner <span className="font-mono font-medium text-xs text-slate-400">{projects.length} initiatives</span>
            </p>
            <div className="flex gap-3.5 flex-wrap">
              {BOARD_COLUMN_ORDER.map((c) => (
                <span key={c} className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                  <span className="w-3 h-1 rounded-full" style={{ background: BOARD_COLUMN_META[c].color }} />
                  {BOARD_COLUMN_META[c].label}
                </span>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col gap-2">{Array.from({ length: 6 }).map((_, i) => <SkeletonBlock key={i} className="h-11 w-full rounded-xl" />)}</div>
          ) : projects.length === 0 ? (
            <p className="text-sm text-slate-400 py-8 text-center">Nothing to plot yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-[860px]">
                <div className="grid grid-cols-[230px_repeat(12,1fr)] border-b border-slate-100 pb-1.5">
                  <span />
                  {MONTHS.map((m) => <span key={m} className="font-mono text-xxs text-slate-400 pl-1">{m}</span>)}
                </div>
                {projects.map((p) => {
                  const span = yearSpan(p);
                  const col = boardColumnFor(p.status, p.atRisk);
                  const owner = ownerOf(p);
                  return (
                    <div key={p.id} className="grid grid-cols-[230px_1fr] items-center py-2.5 border-b border-slate-50">
                      <button onClick={() => setDrawerId(p.id)} className="flex items-center gap-2.5 pr-3 min-w-0 text-left">
                        <Avatar src={owner?.avatarUrl ?? undefined} fallback={initialsOf(owner?.name ?? "?")} className="size-7 rounded-full shrink-0" />
                        <span className="min-w-0">
                          <span className="block text-xs font-medium text-slate-900 truncate">{p.title}</span>
                          <span className="block text-xs text-slate-400 truncate capitalize">{p.department.replace(/_/g, " ")}</span>
                        </span>
                      </button>
                      <div className="relative h-6">
                        <div className="absolute inset-0 flex" aria-hidden>
                          {MONTHS.map((m) => <span key={m} className="flex-1 border-l border-dashed border-slate-100" />)}
                        </div>
                        <button
                          onClick={() => setDrawerId(p.id)}
                          aria-label={`Open ${p.title}`}
                          className="absolute inset-y-0.5 rounded-full flex items-center overflow-hidden hover:brightness-110 transition-all"
                          style={{ left: `${span.left}%`, width: `${span.width}%`, background: BOARD_COLUMN_META[col].bar }}
                        >
                          <span className="absolute inset-y-0 left-0 bg-white/25" style={{ width: `${p.progressPercent ?? 0}%` }} />
                          <span className="relative font-mono text-xxs text-white px-2 whitespace-nowrap">{p.progressPercent ?? 0}%</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      <p className="mt-5 text-xs text-slate-400">Sunland ERP · Projects · Cross-department initiatives</p>

      {/* ══ Drawer ══ */}
      {drawerProject && (
        <ProjectDrawer
          project={drawerProject}
          owner={ownerOf(drawerProject)}
          onClose={() => setDrawerId(null)}
          onMove={moveTo}
          onToggleMilestone={toggleMilestone}
          onDelete={() => setDeleteTarget(drawerProject)}
        />
      )}

      <NewProjectModal
        open={newOpen}
        entityId={entityId}
        staff={staff}
        onClose={() => setNewOpen(false)}
        onCreated={() => { setNewOpen(false); load(); }}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => { if (deleteTarget) remove(deleteTarget); setDeleteTarget(null); }}
        title="Delete this project?"
        description={deleteTarget ? `"${deleteTarget.title}" will be removed permanently. Projects with linked calendar events can't be deleted until those are unlinked.` : ""}
        confirmLabel="Delete project"
        tone="danger"
      />
    </PageTransition>
  );
}

function HeroStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-2xl border border-white/20 bg-white/[0.14] backdrop-blur-md px-4 py-3 min-w-[108px]">
      <p className="text-xxs font-medium uppercase tracking-[0.1em] text-white/60">{label}</p>
      <p className="mt-1 font-mono font-medium text-xl leading-none" style={{ color }}>{value}</p>
    </div>
  );
}

// ── Drawer ───────────────────────────────────────────────────────────────────

function ProjectDrawer({
  project, owner, onClose, onMove, onToggleMilestone, onDelete,
}: {
  project: ProjectRow;
  owner: StaffUser | undefined;
  onClose: () => void;
  onMove: (p: ProjectRow, c: BoardColumn) => void;
  onToggleMilestone: (p: ProjectRow, i: number, done: boolean) => void;
  onDelete: () => void;
}) {
  const col = boardColumnFor(project.status, project.atRisk);
  const dept = deptMeta(project.department);
  const href = recordHref(project.linkedRecordType, project.linkedRecordId);

  return (
    <Drawer
      open
      onClose={onClose}
      title={project.title}
      width="28rem"
      footer={
        <div className="flex items-center justify-between gap-2">
          <button onClick={onDelete} className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-3.5 py-2.5 text-xs font-medium text-rose-600 hover:bg-rose-50">
            <IconTrash size={14} /> Delete
          </button>
          <button onClick={onClose} className="rounded-xl bg-[#151936] px-4 py-2.5 text-xs font-medium text-white hover:opacity-90">Done</button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge tone={col === "risk" ? "risk" : col === "done" ? "neutral" : "success"}>{BOARD_COLUMN_META[col].label}</Badge>
          <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xxs font-medium uppercase tracking-wide", dept.chip)}>{dept.label}</span>
          <span className="font-mono text-xs text-slate-400">{shortRange(project)}</span>
        </div>

        {project.atRisk && (
          <div className="flex items-start gap-2.5 rounded-2xl border border-rose-200 bg-rose-50 px-3.5 py-3">
            <IconAlertTriangle size={16} className="text-rose-600 mt-0.5 shrink-0" />
            <p className="text-xs text-rose-800 leading-relaxed">Flagged at risk. It still counts as in-progress work — clear the flag by moving it back to In Progress.</p>
          </div>
        )}

        <p className="text-sm text-slate-700 leading-relaxed">{project.description ?? "No description provided."}</p>

        <div className="grid grid-cols-2 gap-2.5">
          <StatBox label="Owner">
            <span className="flex items-center gap-2">
              <Avatar src={owner?.avatarUrl ?? undefined} fallback={initialsOf(owner?.name ?? "?")} className="size-5 rounded-full" />
              <span className="text-sm font-medium text-slate-900 truncate">{owner?.name ?? "Unassigned"}</span>
            </span>
          </StatBox>
          <StatBox label="Progress">
            <span className="font-mono font-medium text-sm text-[#122a20]">{project.progressPercent ?? 0}%</span>
          </StatBox>
          <StatBox label="Budget">
            <span className="font-mono font-medium text-sm text-slate-900">
              {project.budgetKes ? formatCompactKES(Number(project.budgetKes)) : "—"}
            </span>
          </StatBox>
          <StatBox label="Linked record">
            {href ? (
              <Link href={href} className="inline-flex items-center gap-1 text-sm font-medium text-[#122a20] hover:underline">
                <IconLink size={13} /> Open <IconArrowUpRight size={12} />
              </Link>
            ) : <span className="text-sm text-slate-400">None</span>}
          </StatBox>
        </div>

        <div>
          <p className="text-sm font-medium text-slate-800 mb-2">Milestones</p>
          <div className="flex flex-col gap-1.5">
            {(project.milestones ?? []).length === 0 ? (
              <p className="text-xs text-slate-400">No milestones set for this project.</p>
            ) : (project.milestones ?? []).map((m, i) => (
              <button
                key={i}
                onClick={() => onToggleMilestone(project, i, !m.done)}
                className="flex items-center gap-2.5 rounded-xl border border-slate-100 bg-[#fafbf8] px-3 py-2.5 text-left hover:bg-slate-50 transition-colors"
              >
                <span className={cn(
                  "size-4 rounded-md border flex items-center justify-center shrink-0",
                  m.done ? "bg-[#122a20] border-[#122a20] text-white" : "bg-white border-slate-300",
                )}>{m.done && <IconCheck size={10} />}</span>
                <span className={cn("text-sm", m.done ? "text-slate-400 line-through" : "text-slate-700")}>{m.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm font-medium text-slate-800 mb-2">Move to</p>
          <div className="flex gap-1.5 flex-wrap">
            {BOARD_COLUMN_ORDER.map((c) => (
              <button
                key={c}
                onClick={() => onMove(project, c)}
                aria-pressed={c === col}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  c === col ? "bg-[#151936] text-white border-[#151936]" : "bg-white text-slate-600 border-slate-200 hover:border-slate-300",
                )}
              >{BOARD_COLUMN_META[c].label}</button>
            ))}
          </div>
        </div>
      </div>
    </Drawer>
  );
}

function StatBox({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-[#fafbf8] px-3 py-2.5 min-w-0">
      <p className="text-xs text-slate-400 mb-0.5">{label}</p>
      {children}
    </div>
  );
}

// ── New project modal ────────────────────────────────────────────────────────

function NewProjectModal({
  open, entityId, staff, onClose, onCreated,
}: {
  open: boolean;
  entityId: string;
  staff: StaffUser[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const { pushToast } = useToast();
  const [form, setForm] = useState({ title: "", department: "ops", ownerId: "", startDate: "", dueDate: "", budget: "", description: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);

  const submit = async () => {
    if (!form.title.trim()) { setErr(true); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/operations/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityId,
          title: form.title.trim(),
          description: form.description || undefined,
          department: form.department,
          status: "planning",
          assigneeIds: form.ownerId ? [form.ownerId] : [],
          startDate: form.startDate || undefined,
          dueDate: form.dueDate || undefined,
          budgetKes: form.budget ? Number(form.budget) : undefined,
          milestones: [
            { label: "Kickoff", done: false },
            { label: "Midpoint review", done: false },
            { label: "Close-out", done: false },
          ],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed to create project");
      pushToast({ tone: "success", title: "Project created", body: `"${form.title.trim()}" landed in Planned.` });
      setForm({ title: "", department: "ops", ownerId: "", startDate: "", dueDate: "", budget: "", description: "" });
      onCreated();
    } catch (e) {
      pushToast({ tone: "error", title: "Couldn't create project", body: e instanceof Error ? e.message : "Try again." });
    } finally {
      setBusy(false);
    }
  };

  const field = "w-full box-border border border-slate-200 rounded-lg h-10 px-3 text-sm text-slate-800 outline-none focus:border-[#151936]/40 transition-colors";

  return (
    <Modal open={open} onClose={onClose} title="New project" description="It lands in Planned with a starter milestone checklist you can edit." size="md">
      <div className="flex flex-col gap-3.5">
        <div>
          <label className="label-caps text-slate-400 mb-1.5 block">Project name</label>
          <input
            className={field}
            value={form.title}
            onChange={(e) => { setForm({ ...form, title: e.target.value }); setErr(false); }}
            placeholder="e.g. Kileleshwa Duplex Onboarding"
            autoFocus
          />
          {err && <p className="text-xs text-rose-600 mt-1">A project name is required.</p>}
        </div>

        <div>
          <label className="label-caps text-slate-400 mb-1.5 block">Department</label>
          <div className="flex gap-1.5 flex-wrap">
            {Object.entries(PROJECT_DEPT_META).map(([key, meta]) => (
              <button
                key={key}
                onClick={() => setForm({ ...form, department: key })}
                aria-pressed={form.department === key}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  form.department === key ? "bg-[#151936] text-white border-[#151936]" : "bg-white text-slate-600 border-slate-200 hover:border-slate-300",
                )}
              >{meta.label}</button>
            ))}
          </div>
        </div>

        <div>
          <label className="label-caps text-slate-400 mb-1.5 block">Owner</label>
          <select className={cn(field, "bg-white")} value={form.ownerId} onChange={(e) => setForm({ ...form, ownerId: e.target.value })}>
            <option value="">Unassigned</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="label-caps text-slate-400 mb-1.5 block">Start</label>
            <input type="date" className={field} value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
          </div>
          <div>
            <label className="label-caps text-slate-400 mb-1.5 block">Due</label>
            <input type="date" className={field} value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
          </div>
          <div>
            <label className="label-caps text-slate-400 mb-1.5 block">Budget (KES)</label>
            <input type="number" min={0} className={cn(field, "font-mono")} value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} placeholder="0" />
          </div>
        </div>

        <div>
          <label className="label-caps text-slate-400 mb-1.5 block">Description</label>
          <textarea
            className="w-full box-border border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 resize-none h-20 outline-none focus:border-[#151936]/40 transition-colors"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="What's this initiative about?"
          />
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
          <Button variant="secondary" size="sm" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button size="sm" onClick={submit} disabled={busy || !form.title.trim()}>{busy ? "Creating…" : "Create project"}</Button>
        </div>
      </div>
    </Modal>
  );
}
