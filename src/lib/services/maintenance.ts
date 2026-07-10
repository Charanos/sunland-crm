import { and, desc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { contacts, maintenancePriority, maintenanceRequests, maintenanceStatus, properties } from "@/db/schema";
import { authorize } from "@/lib/authz/can";
import { writeAudit } from "@/lib/authz/audit";
import { DomainValidationError, NotFoundError } from "@/lib/authz/errors";
import { resolveEntityId } from "@/lib/services/entity";
import type { CallerContext } from "@/lib/services/types";
import { createMaintenanceRequestSchema, updateMaintenanceRequestSchema } from "@/lib/validation/maintenance";
import { parseInput } from "@/lib/validation/parse";

const reporterContacts = alias(contacts, "reporter_contacts");
const contractorContacts = alias(contacts, "contractor_contacts");

export async function listMaintenanceRequests(
  ctx: CallerContext,
  filters: { status?: string; priority?: string; propertyId?: string } = {},
) {
  if (!ctx.entityId) throw new DomainValidationError("entityId is required");
  const entityId = await resolveEntityId(ctx.entityId);
  await authorize(ctx, "properties.maintenance.read", entityId);

  const conditions = [eq(maintenanceRequests.entityId, entityId)];
  if (filters.propertyId) conditions.push(eq(maintenanceRequests.propertyId, filters.propertyId));
  if (filters.status && (maintenanceStatus.enumValues as readonly string[]).includes(filters.status)) {
    conditions.push(eq(maintenanceRequests.status, filters.status as (typeof maintenanceStatus.enumValues)[number]));
  }
  if (filters.priority && (maintenancePriority.enumValues as readonly string[]).includes(filters.priority)) {
    conditions.push(eq(maintenanceRequests.priority, filters.priority as (typeof maintenancePriority.enumValues)[number]));
  }

  return db
    .select({
      id: maintenanceRequests.id,
      entityId: maintenanceRequests.entityId,
      propertyId: maintenanceRequests.propertyId,
      propertyName: properties.name,
      propertyCode: properties.propertyCode,
      title: maintenanceRequests.title,
      description: maintenanceRequests.description,
      priority: maintenanceRequests.priority,
      status: maintenanceRequests.status,
      dueAt: maintenanceRequests.dueAt,
      resolvedAt: maintenanceRequests.resolvedAt,
      createdAt: maintenanceRequests.createdAt,
      updatedAt: maintenanceRequests.updatedAt,
      reportedByContactId: maintenanceRequests.reportedByContactId,
      reportedByName: reporterContacts.displayName,
      assignedContractorId: maintenanceRequests.assignedContractorId,
      assignedContractorName: contractorContacts.displayName,
    })
    .from(maintenanceRequests)
    .innerJoin(properties, eq(maintenanceRequests.propertyId, properties.id))
    .leftJoin(reporterContacts, eq(maintenanceRequests.reportedByContactId, reporterContacts.id))
    .leftJoin(contractorContacts, eq(maintenanceRequests.assignedContractorId, contractorContacts.id))
    .where(and(...conditions))
    .orderBy(desc(maintenanceRequests.createdAt));
}

export async function createMaintenanceRequest(ctx: CallerContext, rawInput: unknown) {
  const input = parseInput(createMaintenanceRequestSchema, rawInput);
  const entityId = await resolveEntityId(input.entityId);
  await authorize(ctx, "properties.maintenance.write", entityId);

  const [property] = await db
    .select()
    .from(properties)
    .where(and(eq(properties.id, input.propertyId), eq(properties.entityId, entityId)))
    .limit(1);
  if (!property) throw new NotFoundError("Property not found");

  return db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(maintenanceRequests)
      .values({
        entityId,
        propertyId: input.propertyId,
        reportedByContactId: input.reportedByContactId ?? null,
        assignedContractorId: input.assignedContractorId ?? null,
        title: input.title,
        description: input.description,
        priority: input.priority,
        status: input.assignedContractorId ? "assigned" : "open",
        dueAt: input.dueAt ? new Date(input.dueAt) : null,
      })
      .returning();

    await writeAudit(tx, ctx, {
      action: "properties.maintenance.create",
      associatedType: "maintenance_request",
      associatedId: inserted.id,
      summary: `Reported maintenance issue "${input.title}" on property ${property.name}`,
      entityId,
      before: null,
      after: inserted,
    });

    return inserted;
  });
}

export async function updateMaintenanceRequest(ctx: CallerContext, requestId: string, rawInput: unknown) {
  const input = parseInput(updateMaintenanceRequestSchema, rawInput);

  const [existing] = await db
    .select()
    .from(maintenanceRequests)
    .where(eq(maintenanceRequests.id, requestId))
    .limit(1);
  if (!existing) throw new NotFoundError("Maintenance request not found");

  await authorize(ctx, "properties.maintenance.write", existing.entityId);

  const updatable: Partial<typeof maintenanceRequests.$inferInsert> = {};
  if (input.title !== undefined) updatable.title = input.title;
  if (input.description !== undefined) updatable.description = input.description;
  if (input.priority !== undefined) updatable.priority = input.priority;
  if (input.dueAt !== undefined) updatable.dueAt = input.dueAt ? new Date(input.dueAt) : null;

  // Assigning a contractor to an open request implicitly advances it —
  // there's no separate "assign" status transition for the caller to forget.
  if (input.assignedContractorId !== undefined) {
    updatable.assignedContractorId = input.assignedContractorId;
    if (input.assignedContractorId && existing.status === "open" && input.status === undefined) {
      updatable.status = "assigned";
    }
  }

  if (input.status !== undefined) {
    updatable.status = input.status;
    const isClosing = input.status === "resolved" || input.status === "closed";
    const wasClosed = existing.status === "resolved" || existing.status === "closed";
    if (isClosing && !wasClosed) {
      updatable.resolvedAt = new Date();
    } else if (!isClosing && wasClosed) {
      // Reopening clears the stale resolution timestamp.
      updatable.resolvedAt = null;
    }
  }

  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(maintenanceRequests)
      .set({ ...updatable, updatedAt: new Date() })
      .where(eq(maintenanceRequests.id, requestId))
      .returning();

    await writeAudit(tx, ctx, {
      action: "properties.maintenance.update",
      associatedType: "maintenance_request",
      associatedId: requestId,
      summary: `Updated maintenance request "${existing.title}"`,
      entityId: existing.entityId,
      before: existing,
      after: updated,
    });

    return updated;
  });
}

export async function deleteMaintenanceRequest(ctx: CallerContext, requestId: string) {
  const [existing] = await db
    .select()
    .from(maintenanceRequests)
    .where(eq(maintenanceRequests.id, requestId))
    .limit(1);
  if (!existing) throw new NotFoundError("Maintenance request not found");

  await authorize(ctx, "properties.maintenance.write", existing.entityId);

  return db.transaction(async (tx) => {
    await tx.delete(maintenanceRequests).where(eq(maintenanceRequests.id, requestId));

    await writeAudit(tx, ctx, {
      action: "properties.maintenance.delete",
      associatedType: "maintenance_request",
      associatedId: requestId,
      summary: `Deleted maintenance request "${existing.title}"`,
      entityId: existing.entityId,
      before: existing,
      after: null,
    });

    return { success: true };
  });
}
