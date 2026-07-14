"use client";

import { useEffect, useState } from "react";
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
      <div className="flex flex-col gap-6 mt-2">
        {/* Header Section */}
        <div className="bg-slate-50/50 p-5 rounded-xl border border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className={cn("px-2.5 py-1 font-medium rounded-md text-xs uppercase tracking-wider border shadow-sm", style.bg, style.text, style.border)}>
                {project.department.replace("_", " ")}
              </span>
              <span className="px-2.5 py-1 font-medium rounded-md text-xs uppercase tracking-wider bg-white border border-slate-200 text-slate-600 shadow-sm">
                {PROJECT_STATUS_LABEL[project.status]}
              </span>
            </div>
            <h2 className="text-xl font-medium text-slate-900">{project.title}</h2>
            {project.description && (
              <p className="text-body-regular text-slate-400 mt-2 max-w-xl">{project.description}</p>
            )}
          </div>

          <Link
            href="/admin/projects"
            className="flex items-center gap-2 px-4 py-2 bg-[#151936] text-white rounded-lg shadow-md hover:bg-slate-800 transition-colors whitespace-nowrap"
            onClick={onClose}
          >
            <span>Manage Project</span>
            <IconExternalLink size={16} stroke={2} />
          </Link>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm flex flex-col gap-1">
            <span className="text-meta-muted flex items-center gap-1.5">
              <IconProgress size={16} /> Progress
            </span>
            <span className="text-lg text-slate-800 mono-data">
              {project.progressPercent !== null ? `${project.progressPercent}%` : "N/A"}
            </span>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm flex flex-col gap-1">
            <span className="text-meta-muted flex items-center gap-1.5">
              <IconUser size={16} /> Assignees
            </span>
            <span className="text-lg text-slate-800 mono-data">
              {project.assigneeIds.length} members
            </span>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm flex flex-col gap-1">
            <span className="text-meta-muted flex items-center gap-1.5">
              <IconClock size={16} /> Target Completion
            </span>
            <span className="text-lg text-slate-800 mono-data">
              {project.dueDate
                ? new Date(project.dueDate).toLocaleDateString("en-KE", { month: "short", day: "numeric", year: "numeric" })
                : "TBD"}
            </span>
          </div>
        </div>

        {/* Audit Log Section */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="bg-slate-50/80 px-5 py-3 border-b border-slate-200/80 flex items-center gap-2">
            <IconHistory size={18} className="text-slate-400" />
            <h3 className="text-body-primary font-medium text-slate-800">Recent Activity & Audit Trail</h3>
          </div>
          <div className="p-5">
            {isLoadingLogs ? (
              <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                <LoadingSpinner size="md" className="mb-2" />
                <span className="text-sm">Fetching immutable logs...</span>
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-body-regular">
                No recorded activity found for this operational project.
              </div>
            ) : (
              <div className="space-y-5 relative before:absolute before:inset-0 before:ml-[11px] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-slate-200">
                {logs.map((log) => (
                  <div key={log.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                    {/* Icon marker */}
                    <div className="flex items-center justify-center size-6 rounded-full border-2 border-white bg-slate-200 text-slate-400 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                      <div className="size-2 rounded-full bg-slate-500" />
                    </div>
                    {/* Content */}
                    <div className="w-[calc(100%-3rem)] md:w-[calc(50%-1.5rem)] bg-white p-3 rounded border border-slate-200 shadow-sm">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-100 uppercase">
                          {log.action.split(".").pop()}
                        </span>
                        <span className="text-xs text-slate-400 mono-data">
                          {new Date(log.createdAt).toLocaleDateString("en-KE", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <p className="text-sm text-slate-700">{log.summary}</p>
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
