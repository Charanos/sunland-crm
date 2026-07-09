"use client";

import { useCallback, useEffect, useState } from "react";
import {
  IconBriefcase,
  IconCheck,
  IconClock,
  IconLayoutKanban,
  IconPlus,
  IconProgress,
  IconTrash,
  IconX,
  IconCalendarEvent,
} from "@tabler/icons-react";
import Link from "next/link";
import { Badge, BoardHeader, BoardPanel, Button, KpiCard } from "@/components/ui/erp-primitives";
import { EmptyState } from "@/components/ui/empty-state";
import { Modal } from "@/components/ui/modal";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { PageTransition } from "@/components/shared/page-transition";
import { useToast } from "@/components/ui/toast-provider";
import { cn } from "@/lib/utils/cn";

type Department = "sales" | "ops" | "legal" | "finance" | "hr" | "front_office";
type Status = "planning" | "in_progress" | "awaiting_review" | "on_hold" | "completed";

interface Project {
  id: string;
  title: string;
  description: string | null;
  department: Department;
  status: Status;
  progressPercent: number | null;
  assigneeIds: string[];
  dueDate: string | null;
  createdById: string;
  createdAt: string;
}

interface StaffUser {
  id: string;
  name: string;
  role: string;
}

const DEPARTMENTS: { value: Department; label: string }[] = [
  { value: "sales", label: "Sales" },
  { value: "ops", label: "Ops" },
  { value: "legal", label: "Legal" },
  { value: "finance", label: "Finance" },
  { value: "hr", label: "HR" },
  { value: "front_office", label: "Front Office" },
];

const STATUSES: { value: Status; label: string }[] = [
  { value: "planning", label: "Planning" },
  { value: "in_progress", label: "In Progress" },
  { value: "awaiting_review", label: "Awaiting Review" },
  { value: "on_hold", label: "On Hold" },
  { value: "completed", label: "Completed" },
];

function statusTone(status: Status): "warning" | "success" | "data" | "neutral" | "risk" {
  if (status === "completed") return "success";
  if (status === "in_progress") return "data";
  if (status === "awaiting_review") return "warning";
  if (status === "on_hold") return "risk";
  return "neutral";
}

const EMPTY_FORM = {
  title: "",
  description: "",
  department: "sales" as Department,
  status: "planning" as Status,
  progressPercent: "",
  assigneeIds: [] as string[],
  dueDate: "",
};

export function ProjectsBoard({ entityId = "group" }: { entityId?: string }) {
  const { pushToast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [departmentFilter, setDepartmentFilter] = useState<Department | "all">("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadProjects = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/operations/projects?entityId=${entityId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load projects");
      setProjects(data.projects ?? []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load projects";
      pushToast({ tone: "error", title: "Error", body: message });
    } finally {
      setIsLoading(false);
    }
  }, [entityId, pushToast]);

  useEffect(() => {
    Promise.resolve().then(() => {
      loadProjects();
      // Assignee picker is scoped to group-level staff (department heads and
      // above) — the realistic owners of a cross-department initiative.
      fetch(`/api/identity/users?entityId=group`)
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data.users)) setStaff(data.users);
        })
        .catch(() => {});
    });
  }, [loadProjects]);

  const openCreateModal = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEditModal = (project: Project) => {
    setEditingId(project.id);
    setForm({
      title: project.title,
      description: project.description ?? "",
      department: project.department,
      status: project.status,
      progressPercent: project.progressPercent?.toString() ?? "",
      assigneeIds: project.assigneeIds,
      dueDate: project.dueDate ?? "",
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.title.trim()) {
      pushToast({ tone: "error", title: "Title required", body: "Give the project a title." });
      return;
    }
    setIsSaving(true);
    try {
      const body = {
        entityId,
        title: form.title,
        description: form.description || undefined,
        department: form.department,
        status: form.status,
        progressPercent: form.progressPercent ? Number(form.progressPercent) : undefined,
        assigneeIds: form.assigneeIds,
        dueDate: form.dueDate || undefined,
      };
      const res = await fetch(editingId ? `/api/operations/projects/${editingId}` : "/api/operations/projects", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save project");

      pushToast({
        tone: "success",
        title: editingId ? "Project Updated" : "Project Created",
        body: `"${form.title}" has been saved.`,
      });
      setModalOpen(false);
      loadProjects();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save project";
      pushToast({ tone: "error", title: "Error", body: message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (project: Project) => {
    setDeletingId(project.id);
    try {
      const res = await fetch(`/api/operations/projects/${project.id}?entityId=${entityId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete project");
      pushToast({ tone: "success", title: "Project Deleted", body: `"${project.title}" has been removed.` });
      loadProjects();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete project";
      pushToast({ tone: "error", title: "Error", body: message });
    } finally {
      setDeletingId(null);
    }
  };

  const filtered = departmentFilter === "all" ? projects : projects.filter((p) => p.department === departmentFilter);
  const inProgressCount = projects.filter((p) => p.status === "in_progress").length;
  const awaitingReviewCount = projects.filter((p) => p.status === "awaiting_review").length;
  const completedCount = projects.filter((p) => p.status === "completed").length;

  return (
    <PageTransition className="mx-auto flex max-w-[98rem] flex-col gap-4">
      <BoardHeader
        eyebrow={<Badge tone="data">Operations</Badge>}
        title="Projects"
        description="Cross-department initiatives — recruitment drives, escrow clearances, safety audits, and everything else that spans more than one desk."
        actions={
          <Button size="sm" onClick={openCreateModal}>
            <IconPlus size={14} /> New Project
          </Button>
        }
      />

      {/* ── Scheduling Hub Navigator ── */}
      <div className="flex items-center justify-between flex-wrap gap-4 bg-white border border-slate-100 p-4 rounded-[20px] shadow-sm">
        <div className="flex items-center gap-2">
          <div className="size-8 rounded-lg bg-indigo-50 text-indigo-650 flex items-center justify-center">
            <IconCalendarEvent size={16} />
          </div>
          <div>
            <h3 className="text-base font-medium text-slate-800 leading-none">Scheduling Hub</h3>
            <p className="text-sm text-slate-400 mt-1">Coordinate cross-department projects and calendar events.</p>
          </div>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-xl flex-wrap gap-1">
          <Link
            href="/admin/projects"
            className="body-sm px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 bg-[#151936] text-white shadow-sm"
          >
            <span>Projects</span>
            <span className="bg-[#f3df27] text-[#151936] px-1.5 py-0.2 rounded-full text-meta-muted-strong">Active</span>
          </Link>
          <Link
            href="/admin/events"
            className="body-sm px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 text-slate-500 hover:text-slate-900 hover:bg-white/45"
          >
            <span>Events</span>
          </Link>
        </div>
      </div>

      <div className="gsap-stagger grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard icon={IconLayoutKanban} label="Total Projects" value={String(projects.length)} tone="neutral" />
        <KpiCard icon={IconProgress} label="In Progress" value={String(inProgressCount)} tone="data" />
        <KpiCard icon={IconClock} label="Awaiting Review" value={String(awaitingReviewCount)} tone="warning" />
        <KpiCard icon={IconCheck} label="Completed" value={String(completedCount)} tone="success" />
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => setDepartmentFilter("all")}
          className={cn(
            "px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all",
            departmentFilter === "all" ? "bg-[#151936] text-white shadow-sm" : "bg-slate-100 text-slate-500 hover:bg-slate-200/60",
          )}
        >
          All
        </button>
        {DEPARTMENTS.map((d) => (
          <button
            key={d.value}
            type="button"
            onClick={() => setDepartmentFilter(d.value)}
            className={cn(
              "px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all",
              departmentFilter === d.value ? "bg-[#151936] text-white shadow-sm" : "bg-slate-100 text-slate-500 hover:bg-slate-200/60",
            )}
          >
            {d.label}
          </button>
        ))}
      </div>

      <BoardPanel className="p-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <LoadingSpinner size="md" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={IconBriefcase}
            title="No projects here yet"
            description="Cross-department initiatives you create will show up here and on the Executive Overview."
            action="New Project"
            onClick={openCreateModal}
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((project) => (
              <div
                key={project.id}
                className="group flex flex-col gap-3 rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm transition-all hover:border-slate-300 hover:shadow-md cursor-pointer"
                onClick={() => openEditModal(project)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="text-body-primary text-slate-900 truncate">{project.title}</h3>
                    {project.description && (
                      <p className="text-body-regular text-slate-500 mt-1 line-clamp-2">{project.description}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(project);
                    }}
                    disabled={deletingId === project.id}
                    className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100"
                    aria-label="Delete project"
                  >
                    <IconTrash size={15} />
                  </button>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <Badge tone="neutral">{DEPARTMENTS.find((d) => d.value === project.department)?.label}</Badge>
                  <Badge tone={statusTone(project.status)}>{STATUSES.find((s) => s.value === project.status)?.label}</Badge>
                </div>

                {project.status === "in_progress" && project.progressPercent !== null ? (
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div className="h-full bg-[#151936] rounded-full" style={{ width: `${project.progressPercent}%` }} />
                    </div>
                    <span className="mono-data text-slate-600 whitespace-nowrap">{project.progressPercent}%</span>
                  </div>
                ) : project.dueDate ? (
                  <div className="flex items-center gap-1.5 text-meta-muted-strong">
                    <IconClock size={14} className="text-slate-400" />
                    Due {new Date(project.dueDate).toLocaleDateString("en-KE", { month: "short", day: "numeric", year: "numeric" })}
                  </div>
                ) : null}

                {project.assigneeIds.length > 0 && (
                  <p className="text-meta-muted">
                    {project.assigneeIds.length} assignee{project.assigneeIds.length === 1 ? "" : "s"}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </BoardPanel>

      <Modal
        open={modalOpen}
        onClose={() => !isSaving && setModalOpen(false)}
        title={editingId ? "Edit Project" : "New Project"}
        description="Cross-department initiative details"
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="label-caps text-slate-500 mb-1.5 block">Title</label>
            <input
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-base text-slate-800 focus:outline-none focus:border-[#151936]/40 transition-colors"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Q3 Broker Recruitment Drive"
            />
          </div>

          <div>
            <label className="label-caps text-slate-500 mb-1.5 block">Description</label>
            <textarea
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-base text-slate-800 resize-none h-20 focus:outline-none focus:border-[#151936]/40 transition-colors"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="What's this initiative about?"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-caps text-slate-500 mb-1.5 block">Department</label>
              <select
                className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-base text-slate-800 focus:outline-none focus:border-[#151936]/40 transition-colors"
                value={form.department}
                onChange={(e) => setForm((f) => ({ ...f, department: e.target.value as Department }))}
              >
                {DEPARTMENTS.map((d) => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-caps text-slate-500 mb-1.5 block">Status</label>
              <select
                className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-base text-slate-800 focus:outline-none focus:border-[#151936]/40 transition-colors"
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as Status }))}
              >
                {STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-caps text-slate-500 mb-1.5 block">Progress % (if in progress)</label>
              <input
                type="number"
                min={0}
                max={100}
                className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-base mono-data text-slate-800 focus:outline-none focus:border-[#151936]/40 transition-colors"
                value={form.progressPercent}
                onChange={(e) => setForm((f) => ({ ...f, progressPercent: e.target.value }))}
              />
            </div>
            <div>
              <label className="label-caps text-slate-500 mb-1.5 block">Due Date</label>
              <input
                type="date"
                className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-base text-slate-800 focus:outline-none focus:border-[#151936]/40 transition-colors"
                value={form.dueDate}
                onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <label className="label-caps text-slate-500 mb-1.5 block">Assignees</label>
            <div className="flex flex-wrap gap-1.5">
              {staff.map((user) => {
                const selected = form.assigneeIds.includes(user.id);
                return (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        assigneeIds: selected ? f.assigneeIds.filter((id) => id !== user.id) : [...f.assigneeIds, user.id],
                      }))
                    }
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-sm font-medium border transition-all",
                      selected ? "bg-[#151936] text-white border-[#151936]" : "bg-white text-slate-600 border-slate-200 hover:border-slate-300",
                    )}
                  >
                    {user.name}
                  </button>
                );
              })}
              {staff.length === 0 && <p className="text-meta-muted">No staff available to assign.</p>}
            </div>
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
            <Button type="button" variant="secondary" size="sm" onClick={() => setModalOpen(false)} disabled={isSaving}>
              <IconX size={14} /> Cancel
            </Button>
            <Button type="button" size="sm" onClick={handleSubmit} disabled={isSaving}>
              {isSaving ? "Saving…" : editingId ? "Save Changes" : "Create Project"}
            </Button>
          </div>
        </div>
      </Modal>
    </PageTransition>
  );
}
