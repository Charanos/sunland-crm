"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  IconClock,
  IconExternalLink,
  IconHistory,
  IconProgress,
  IconUser,
} from "@tabler/icons-react";
import { Modal } from "@/components/ui/modal";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";

interface Project {
  id: string;
  title: string;
  description: string | null;
  department: "sales" | "ops" | "legal" | "finance" | "hr" | "front_office";
  status: "planning" | "in_progress" | "awaiting_review" | "on_hold" | "completed";
  progressPercent: number | null;
  assigneeIds: string[];
  dueDate: string | null;
}

interface AuditLog {
  id: string;
  action: string;
  summary: string;
  createdAt: string;
  actorId: string;
}

const PROJECT_DEPARTMENT_STYLES: Record<Project["department"], { bg: string; text: string; border: string }> = {
  sales: { bg: "bg-teal-50", text: "text-teal-700", border: "border-teal-200" },
  legal: { bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-200" },
  ops: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  finance: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  hr: { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" },
  front_office: { bg: "bg-sky-50", text: "text-sky-700", border: "border-sky-200" },
};

const PROJECT_STATUS_LABEL: Record<Project["status"], string> = {
  planning: "Planning",
  in_progress: "In Progress",
  awaiting_review: "Awaiting Review",
  on_hold: "On Hold",
  completed: "Completed",
};

export function ProjectDetailModal({
  project,
  open,
  onClose,
}: {
  project: Project | null;
  open: boolean;
  onClose: () => void;
}) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(true);

  useEffect(() => {
    if (!open || !project) return;
    let isMounted = true;

    fetch(`/api/audit?associatedType=project&associatedId=${project.id}&limit=10`)
      .then((res) => res.json())
      .then((data) => {
        if (isMounted && data.entries) {
          setLogs(data.entries);
        }
      })
      .catch((e) => console.error("Failed to fetch project audit logs:", e))
      .finally(() => {
        if (isMounted) setIsLoadingLogs(false);
      });

    return () => {
      isMounted = false;
    };
  }, [project, open]);

  if (!project) return null;

  const style = PROJECT_DEPARTMENT_STYLES[project.department];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Project Details"
      description="Cross-department operational insights and audit trail."
      size="lg"
    >
      <div className="flex flex-col mt-4 px-2">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 pb-6 border-b border-slate-100">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge tone={
                project.department === "sales" ? "primary" :
                project.department === "finance" ? "success" :
                project.department === "legal" ? "neutral" :
                "warning"
              } className="px-2.5 py-0.5 text-[10px] tracking-widest uppercase shadow-sm">
                {project.department.replace("_", " ")}
              </Badge>
              <Badge tone="neutral" className="px-2.5 py-0.5 text-[10px] tracking-widest uppercase shadow-sm bg-white">
                {PROJECT_STATUS_LABEL[project.status]}
              </Badge>
            </div>
            <div>
              <h2 className="text-xl font-medium text-slate-900">{project.title}</h2>
              {project.description && (
                <p className="text-sm text-slate-500 mt-1 max-w-xl leading-relaxed">{project.description}</p>
              )}
            </div>
          </div>

          <Link
            href="/admin/projects"
            className="flex items-center gap-2 h-9 px-4 bg-[#151936] text-white text-sm font-medium rounded-lg shadow-sm hover:bg-slate-800 transition-all whitespace-nowrap"
            onClick={onClose}
          >
            <span>Manage Project</span>
            <IconExternalLink size={14} stroke={2} />
          </Link>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-3 gap-6 py-6 border-b border-slate-100">
          <div className="flex flex-col gap-2">
            <span className="label-caps text-slate-400 flex items-center gap-1.5">
              <IconProgress size={14} /> Progress
            </span>
            <span className="text-lg text-slate-800 mono-data font-medium">
              {project.progressPercent !== null ? `${project.progressPercent}%` : "N/A"}
            </span>
          </div>
          <div className="flex flex-col gap-2">
            <span className="label-caps text-slate-400 flex items-center gap-1.5">
              <IconUser size={14} /> Assignees
            </span>
            <div className="flex items-center gap-2">
              <div className="flex -space-x-1.5">
                {project.assigneeIds.slice(0, 3).map((id) => (
                  <Image key={id} src={`https://i.pravatar.cc/150?u=${id}`} alt="assignee" width={24} height={24} className="size-6 rounded-full ring-2 ring-white bg-slate-100 shadow-sm object-cover" />
                ))}
                {project.assigneeIds.length > 3 && (
                  <div className="size-6 rounded-full ring-2 ring-white bg-slate-50 flex items-center justify-center text-[10px] font-medium text-slate-600 shadow-sm z-10">
                    +{project.assigneeIds.length - 3}
                  </div>
                )}
              </div>
              {project.assigneeIds.length === 0 && (
                <span className="text-sm text-slate-400">Unassigned</span>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <span className="label-caps text-slate-400 flex items-center gap-1.5">
              <IconClock size={14} /> Target
            </span>
            <span className="text-lg text-slate-800 mono-data font-medium">
              {project.dueDate
                ? new Date(project.dueDate).toLocaleDateString("en-KE", { month: "short", day: "numeric", year: "numeric" })
                : "TBD"}
            </span>
          </div>
        </div>

        {/* Audit Log Section */}
        <div className="pt-6">
          <div className="flex items-center gap-2 mb-5">
            <div className="size-5 rounded-md bg-slate-100 border border-slate-200 flex items-center justify-center">
              <IconHistory size={12} stroke={2} className="text-slate-500" />
            </div>
            <h3 className="label-caps text-slate-700 m-0">Recent Activity & Audit Trail</h3>
          </div>
          <div>
            {isLoadingLogs ? (
              <div className="flex flex-col items-center justify-center py-6 text-slate-400">
                <LoadingSpinner size="md" className="mb-2" />
                <span className="text-xs font-medium">Fetching immutable logs...</span>
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-sm">
                No recorded activity found for this operational project.
              </div>
            ) : (
              <div className="space-y-4 relative before:absolute before:inset-0 before:ml-2.5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-px before:bg-slate-200">
                {logs.map((log) => (
                  <div key={log.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                    {/* Icon marker */}
                    <div className="flex items-center justify-center size-5 rounded-full border border-white bg-slate-200 text-slate-400 shadow-sm shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                      <div className="size-1.5 rounded-full bg-slate-400" />
                    </div>
                    {/* Content */}
                    <div className="w-[calc(100%-2rem)] md:w-[calc(50%-1.5rem)] bg-white p-3 rounded-lg border border-slate-100 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="label-caps px-1.5 py-0.5 rounded bg-slate-50 border border-slate-100">
                          {log.action.split(".").pop()}
                        </span>
                        <span className="text-xs text-slate-400 mono-data">
                          {new Date(log.createdAt).toLocaleDateString("en-KE", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 leading-relaxed">{log.summary}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
