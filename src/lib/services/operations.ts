import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { calendarEvents, projectDepartment, projectStatus, projects } from "@/db/schema";
import { authorize } from "@/lib/authz/can";
import { writeAudit } from "@/lib/authz/audit";
import { ConflictError, DomainValidationError, NotFoundError } from "@/lib/authz/errors";
import { resolveEntityId } from "@/lib/services/entity";
import type { CallerContext } from "@/lib/services/types";
import { createProjectSchema, updateProjectSchema } from "@/lib/validation/operations";
import { parseInput } from "@/lib/validation/parse";

type ProjectDepartment = (typeof projectDepartment.enumValues)[number];
type ProjectStatus = (typeof projectStatus.enumValues)[number];

/** Projects are a shared, cross-department artifact, not personal data — no self-scoped "mine" split. */
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
        updatedAt: new Date(),
      })
      .where(eq(projects.id, projectId))
      .returning();

    await writeAudit(tx, ctx, {
      action: "operations.project.update",
      associatedType: "project",
      associatedId: projectId,
      summary: `${ctx.user.name} updated project "${updated.title}" (${updated.status})`,
      entityId: existing.entityId,
      before: existing,
      after: updated,
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
      `Cannot delete project with ${linkedEvents.length} linked calendar event(s) — unlink or delete them first`,
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
