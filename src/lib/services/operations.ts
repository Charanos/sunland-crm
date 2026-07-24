import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { calendarEvents, projectDepartment, projectStatus, projects } from "@/db/schema";
import { authorize } from "@/lib/authz/can";
import { writeAudit } from "@/lib/authz/audit";
import { ConflictError, DomainValidationError, NotFoundError } from "@/lib/authz/errors";
import { resolveEntityId } from "@/lib/services/entity";
import type { CallerContext } from "@/lib/services/types";
import {
  createProjectSchema,
  setProjectBoardStateSchema,
  toggleMilestoneSchema,
  updateProjectSchema,
} from "@/lib/validation/operations";
import { parseInput } from "@/lib/validation/parse";

type ProjectRow = typeof projects.$inferSelect;
type Milestone = { label: string; done: boolean };

const STATUS_LABEL: Record<string, string> = {
  planning: "Planned",
  in_progress: "In Progress",
  awaiting_review: "Awaiting Review",
  on_hold: "On Hold",
  completed: "Done",
};

/**
 * Human-legible audit summaries instead of a generic "Updated record" - the
 * same pattern describePropertyUpdate/describeMaintenanceUpdate established
 * (see src/lib/services/properties.ts).
 */
function describeProjectUpdate(before: ProjectRow, after: ProjectRow): string[] {
  const changes: string[] = [];
  if (before.title !== after.title) changes.push(`renamed to "${after.title}"`);
  if (before.status !== after.status) {
    changes.push(`moved from ${STATUS_LABEL[before.status] ?? before.status} to ${STATUS_LABEL[after.status] ?? after.status}`);
  }
  if (before.atRisk !== after.atRisk) changes.push(after.atRisk ? "flagged at risk" : "cleared the at-risk flag");
  if (before.progressPercent !== after.progressPercent) changes.push(`progress ${before.progressPercent ?? 0}% → ${after.progressPercent ?? 0}%`);
  if (before.department !== after.department) changes.push(`reassigned to ${after.department}`);
  if (String(before.dueDate ?? "") !== String(after.dueDate ?? "")) changes.push(`due date set to ${after.dueDate ?? "none"}`);
  if (String(before.startDate ?? "") !== String(after.startDate ?? "")) changes.push(`start date set to ${after.startDate ?? "none"}`);
  if (String(before.budgetKes ?? "") !== String(after.budgetKes ?? "")) changes.push(`budget set to ${after.budgetKes ?? "none"}`);
  if ((before.assigneeIds ?? []).length !== (after.assigneeIds ?? []).length) changes.push("changed assignees");
  return changes;
}

type ProjectDepartment = (typeof projectDepartment.enumValues)[number];
type ProjectStatus = (typeof projectStatus.enumValues)[number];

/** Projects are a shared, cross-department artifact, not personal data - no self-scoped "mine" split. */
export async function listProjects(
  ctx: CallerContext,
  filters: { entityId?: string; department?: string; status?: string } = {},
) {
  const rawEntityId = filters.entityId ?? ctx.entityId;
  if (!rawEntityId) throw new DomainValidationError("entityId is required");
  const entityId = await resolveEntityId(rawEntityId);
  await authorize(ctx, "operations.project.read", entityId);

  const conditions = [eq(projects.entityId, entityId)];
  if (filters.department && (projectDepartment.enumValues as readonly string[]).includes(filters.department)) {
    conditions.push(eq(projects.department, filters.department as ProjectDepartment));
  }
  if (filters.status && (projectStatus.enumValues as readonly string[]).includes(filters.status)) {
    conditions.push(eq(projects.status, filters.status as ProjectStatus));
  }

  return db
    .select()
    .from(projects)
    .where(and(...conditions))
    .orderBy(desc(projects.createdAt));
}

export async function createProject(ctx: CallerContext, rawInput: unknown) {
  const input = parseInput(createProjectSchema, rawInput);
  const entityId = await resolveEntityId(input.entityId);
  await authorize(ctx, "operations.project.write", entityId);

  return db.transaction(async (tx) => {
    const [project] = await tx
      .insert(projects)
      .values({
        entityId,
        title: input.title,
        description: input.description ?? null,
        department: input.department,
        status: input.status,
        progressPercent: input.progressPercent ?? null,
        assigneeIds: input.assigneeIds,
        dueDate: input.dueDate ?? null,
        startDate: input.startDate ?? null,
        milestones: input.milestones ?? [],
        atRisk: input.atRisk ?? false,
        budgetKes: input.budgetKes != null ? String(input.budgetKes) : null,
        linkedRecordType: input.linkedRecordType ?? null,
        linkedRecordId: input.linkedRecordId ?? null,
        createdById: ctx.user.id,
      })
      .returning();

    await writeAudit(tx, ctx, {
      action: "operations.project.create",
      associatedType: "project",
      associatedId: project.id,
      summary: `${ctx.user.name} created project "${project.title}"`,
      entityId,
      after: project,
    });

    return project;
  });
}

export async function getProject(ctx: CallerContext, projectId: string) {
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  if (!project) throw new NotFoundError("Project not found");
  await authorize(ctx, "operations.project.read", project.entityId);
  return project;
}

export async function updateProject(ctx: CallerContext, projectId: string, rawInput: unknown) {
  const input = parseInput(updateProjectSchema, rawInput);
  const [existing] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  if (!existing) throw new NotFoundError("Project not found");
  await authorize(ctx, "operations.project.write", existing.entityId);

  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(projects)
      .set({
        title: input.title ?? existing.title,
        description: input.description !== undefined ? input.description : existing.description,
        department: input.department ?? existing.department,
        status: input.status ?? existing.status,
        progressPercent: input.progressPercent !== undefined ? input.progressPercent : existing.progressPercent,
        assigneeIds: input.assigneeIds ?? existing.assigneeIds,
        dueDate: input.dueDate !== undefined ? input.dueDate : existing.dueDate,
        startDate: input.startDate !== undefined ? input.startDate : existing.startDate,
        milestones: input.milestones ?? existing.milestones,
        atRisk: input.atRisk !== undefined ? input.atRisk : existing.atRisk,
        budgetKes: input.budgetKes !== undefined ? (input.budgetKes === null ? null : String(input.budgetKes)) : existing.budgetKes,
        linkedRecordType: input.linkedRecordType !== undefined ? input.linkedRecordType : existing.linkedRecordType,
        linkedRecordId: input.linkedRecordId !== undefined ? input.linkedRecordId : existing.linkedRecordId,
        updatedAt: new Date(),
      })
      .where(eq(projects.id, projectId))
      .returning();

    const changes = describeProjectUpdate(existing, updated);
    await writeAudit(tx, ctx, {
      action: "operations.project.update",
      associatedType: "project",
      associatedId: projectId,
      summary: changes.length
        ? `${ctx.user.name} ${changes.join(", ")} on project "${updated.title}"`
        : `${ctx.user.name} updated project "${updated.title}"`,
      entityId: existing.entityId,
      before: existing,
      after: updated,
    });

    return updated;
  });
}

/**
 * Ticks a single milestone. Indexed into the stored array rather than given
 * its own table - a milestone has no identity or lifecycle beyond its parent
 * project, the same reasoning properties.media uses for a jsonb array.
 */
export async function toggleMilestone(ctx: CallerContext, projectId: string, rawInput: unknown) {
  const input = parseInput(toggleMilestoneSchema, rawInput);
  const [existing] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  if (!existing) throw new NotFoundError("Project not found");
  await authorize(ctx, "operations.project.write", existing.entityId);

  const milestones = (existing.milestones ?? []) as Milestone[];
  if (input.index >= milestones.length) {
    throw new DomainValidationError(`Milestone ${input.index} does not exist on this project`);
  }

  const next = milestones.map((m, i) => (i === input.index ? { ...m, done: input.done } : m));

  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(projects)
      .set({ milestones: next, updatedAt: new Date() })
      .where(eq(projects.id, projectId))
      .returning();

    await writeAudit(tx, ctx, {
      action: "operations.project.milestone",
      associatedType: "project",
      associatedId: projectId,
      summary: `${ctx.user.name} marked "${milestones[input.index].label}" ${input.done ? "complete" : "reopened"} on project "${updated.title}"`,
      entityId: existing.entityId,
      before: { milestones },
      after: { milestones: next },
    });

    return updated;
  });
}

/**
 * The Projects Board kanban has four columns - Planned / In Progress / At Risk
 * / Done - but "at risk" isn't a lifecycle stage, it's a warning on a project
 * that is still genuinely in progress. So a drag writes (status, atRisk)
 * together rather than pushing a 6th value into the status enum.
 */
export async function setProjectBoardState(ctx: CallerContext, projectId: string, rawInput: unknown) {
  const input = parseInput(setProjectBoardStateSchema, rawInput);
  const [existing] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  if (!existing) throw new NotFoundError("Project not found");
  await authorize(ctx, "operations.project.write", existing.entityId);

  const nextStatus = input.status ?? existing.status;
  const nextAtRisk = input.atRisk !== undefined ? input.atRisk : existing.atRisk;

  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(projects)
      .set({
        status: nextStatus,
        atRisk: nextAtRisk,
        // Landing in Done means done - keeps the card's progress bar honest
        // rather than showing a completed project at 40%.
        progressPercent: nextStatus === "completed" ? 100 : existing.progressPercent,
        updatedAt: new Date(),
      })
      .where(eq(projects.id, projectId))
      .returning();

    const changes = describeProjectUpdate(existing, updated);
    await writeAudit(tx, ctx, {
      action: "operations.project.board_state",
      associatedType: "project",
      associatedId: projectId,
      summary: changes.length
        ? `${ctx.user.name} ${changes.join(", ")} on project "${updated.title}"`
        : `${ctx.user.name} moved project "${updated.title}"`,
      entityId: existing.entityId,
      before: { status: existing.status, atRisk: existing.atRisk },
      after: { status: updated.status, atRisk: updated.atRisk },
    });

    return updated;
  });
}

export async function deleteProject(ctx: CallerContext, projectId: string) {
  const [existing] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  if (!existing) throw new NotFoundError("Project not found");
  await authorize(ctx, "operations.project.write", existing.entityId);

  const linkedEvents = await db.select().from(calendarEvents).where(eq(calendarEvents.projectId, projectId));
  if (linkedEvents.length > 0) {
    throw new ConflictError(
      `Cannot delete project with ${linkedEvents.length} linked calendar event(s) - unlink or delete them first`,
    );
  }

  return db.transaction(async (tx) => {
    await tx.delete(projects).where(eq(projects.id, projectId));

    await writeAudit(tx, ctx, {
      action: "operations.project.delete",
      associatedType: "project",
      associatedId: projectId,
      summary: `${ctx.user.name} deleted project "${existing.title}"`,
      entityId: existing.entityId,
      before: existing,
    });

    return { deleted: true };
  });
}
