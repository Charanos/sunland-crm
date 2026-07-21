import { and, desc, eq, ilike, or, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { contacts, leads, properties, users } from "@/db/schema";
import { authorize } from "@/lib/authz/can";
import { writeAudit } from "@/lib/authz/audit";
import { DomainValidationError, NotFoundError } from "@/lib/authz/errors";
import { resolveEntityId } from "@/lib/services/entity";
import { listAuditLog } from "@/lib/services/audit-log";
import { toISOStringSafe } from "@/lib/services/properties";
import type { CallerContext } from "@/lib/services/types";
import { createLeadSchema, transitionLeadStageSchema, updateLeadSchema } from "@/lib/validation/leads";
import { parseInput } from "@/lib/validation/parse";

// Real backend for the CRM/BD pipeline (ADR 015 §15.4) - the `leads` table
// was already real (contactId/propertyId/assignedToId FKs), only the read/
// write surface was missing. listLeads/getLead deliberately return a shape
// compatible with pipeline-board.tsx's existing (previously mock-only) `Lead`
// UI type, so the current board can be wired to real data now without also
// being visually rebuilt - that redesign pass is separate, later work.

function mapLeadRow(row: {
  id: string;
  stage: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  propertyId: string | null;
  propertyName: string | null;
  expectedValueKes: string | null;
  source: string | null;
  assignedToId: string | null;
  assignedToName: string | null;
  notes: string | null;
  createdAt: Date;
}) {
  return {
    id: row.id,
    clientName: row.contactName ?? "Unknown Client",
    email: row.contactEmail ?? "",
    phone: row.contactPhone ?? "",
    budget: row.expectedValueKes ? parseFloat(row.expectedValueKes) : 0,
    propertyId: row.propertyId,
    propertyInterest: row.propertyName ?? "General Inquiry",
    source: row.source ?? "website",
    stage: row.stage,
    assignedToId: row.assignedToId,
    assignedAgent: row.assignedToName ?? "Unassigned",
    createdDate: toISOStringSafe(row.createdAt)?.slice(0, 10) ?? "",
    notes: row.notes ?? undefined,
  };
}

export async function listLeads(
  ctx: CallerContext,
  filters: { stage?: string; assignedToId?: string; search?: string } = {},
) {
  if (!ctx.entityId) throw new DomainValidationError("entityId is required");
  const entityId = await resolveEntityId(ctx.entityId);
  await authorize(ctx, "crm.lead.read", entityId);

  let conditions: SQL | undefined = eq(leads.entityId, entityId);
  if (filters.stage) conditions = and(conditions, eq(leads.stage, filters.stage as (typeof leads.stage.enumValues)[number]));
  if (filters.assignedToId) conditions = and(conditions, eq(leads.assignedToId, filters.assignedToId));
  if (filters.search) {
    const q = `%${filters.search}%`;
    conditions = and(conditions, or(ilike(contacts.displayName, q), ilike(properties.name, q)));
  }

  const rows = await db
    .select({
      id: leads.id,
      stage: leads.stage,
      contactName: contacts.displayName,
      contactEmail: contacts.email,
      contactPhone: contacts.phone,
      propertyId: leads.propertyId,
      propertyName: properties.name,
      expectedValueKes: leads.expectedValueKes,
      source: leads.source,
      assignedToId: leads.assignedToId,
      assignedToName: users.name,
      notes: leads.notes,
      createdAt: leads.createdAt,
    })
    .from(leads)
    .innerJoin(contacts, eq(leads.contactId, contacts.id))
    .leftJoin(properties, eq(leads.propertyId, properties.id))
    .leftJoin(users, eq(leads.assignedToId, users.id))
    .where(conditions)
    .orderBy(desc(leads.createdAt));

  return rows.map(mapLeadRow);
}

export async function getLead(ctx: CallerContext, leadId: string) {
  if (!ctx.entityId) throw new DomainValidationError("entityId is required");
  const entityId = await resolveEntityId(ctx.entityId);
  await authorize(ctx, "crm.lead.read", entityId);

  const [row] = await db
    .select({
      id: leads.id,
      stage: leads.stage,
      contactId: leads.contactId,
      contactName: contacts.displayName,
      contactEmail: contacts.email,
      contactPhone: contacts.phone,
      propertyId: leads.propertyId,
      propertyName: properties.name,
      expectedValueKes: leads.expectedValueKes,
      source: leads.source,
      assignedToId: leads.assignedToId,
      assignedToName: users.name,
      notes: leads.notes,
      createdAt: leads.createdAt,
      lostReason: leads.lostReason,
      closedAt: leads.closedAt,
    })
    .from(leads)
    .innerJoin(contacts, eq(leads.contactId, contacts.id))
    .leftJoin(properties, eq(leads.propertyId, properties.id))
    .leftJoin(users, eq(leads.assignedToId, users.id))
    .where(and(eq(leads.id, leadId), eq(leads.entityId, entityId)))
    .limit(1);

  if (!row) throw new NotFoundError("Lead not found");

  const activity = await listAuditLog(ctx, { entityId, associatedType: "lead", associatedId: leadId, limit: 50 });

  return {
    ...mapLeadRow(row),
    lostReason: row.lostReason,
    closedAt: toISOStringSafe(row.closedAt),
    timeline: activity.map((a) => ({
      id: a.id,
      date: toISOStringSafe(a.createdAt) ?? "",
      type: "system" as const,
      summary: a.summary,
      details: a.actorName,
    })),
  };
}

export async function createLead(ctx: CallerContext, rawInput: unknown) {
  const input = parseInput(createLeadSchema, rawInput);
  const entityId = await resolveEntityId(input.entityId);
  await authorize(ctx, "crm.lead.write", entityId);

  if (!input.contactId && !input.displayName) {
    throw new DomainValidationError("Either an existing contactId or a displayName for a new contact is required.");
  }

  return db.transaction(async (tx) => {
    let contactId = input.contactId ?? null;
    let contactName = "";

    if (contactId) {
      const [existing] = await tx.select().from(contacts).where(eq(contacts.id, contactId)).limit(1);
      if (!existing) throw new NotFoundError("Contact not found");
      contactName = existing.displayName;
    } else {
      const [newContact] = await tx
        .insert(contacts)
        .values({
          entityId,
          type: "buyer",
          displayName: input.displayName!,
          email: input.email ?? null,
          phone: input.phone ?? null,
          source: input.source ?? "website",
        })
        .returning();
      contactId = newContact.id;
      contactName = newContact.displayName;
    }

    let propertyName: string | null = null;
    if (input.propertyId) {
      const [property] = await tx.select({ name: properties.name }).from(properties).where(eq(properties.id, input.propertyId)).limit(1);
      if (!property) throw new NotFoundError("Property not found");
      propertyName = property.name;
    }

    const [inserted] = await tx
      .insert(leads)
      .values({
        entityId,
        title: `${contactName} · ${propertyName ?? "General Inquiry"}`,
        contactId,
        propertyId: input.propertyId ?? null,
        assignedToId: input.assignedToId ?? null,
        expectedValueKes: input.expectedValueKes ?? null,
        probability: input.probability,
        source: input.source ?? null,
        notes: input.notes ?? null,
        nextActionAt: input.nextActionAt ? new Date(input.nextActionAt) : null,
      })
      .returning();

    await writeAudit(tx, ctx, {
      action: "crm.lead.create",
      associatedType: "lead",
      associatedId: inserted.id,
      summary: `${ctx.user.name} logged a new opportunity for ${contactName}`,
      entityId,
      before: null,
      after: inserted,
    });

    return inserted;
  });
}

export async function updateLead(ctx: CallerContext, leadId: string, rawInput: unknown) {
  const input = parseInput(updateLeadSchema, rawInput);
  const entityId = await resolveEntityId(input.entityId);
  await authorize(ctx, "crm.lead.write", entityId);

  const [existing] = await db.select().from(leads).where(and(eq(leads.id, leadId), eq(leads.entityId, entityId))).limit(1);
  if (!existing) throw new NotFoundError("Lead not found");

  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(leads)
      .set({
        propertyId: input.propertyId !== undefined ? input.propertyId : existing.propertyId,
        assignedToId: input.assignedToId !== undefined ? input.assignedToId : existing.assignedToId,
        expectedValueKes: input.expectedValueKes !== undefined ? input.expectedValueKes : existing.expectedValueKes,
        probability: input.probability ?? existing.probability,
        notes: input.notes !== undefined ? input.notes : existing.notes,
        nextActionAt: input.nextActionAt !== undefined ? (input.nextActionAt ? new Date(input.nextActionAt) : null) : existing.nextActionAt,
        updatedAt: new Date(),
      })
      .where(eq(leads.id, leadId))
      .returning();

    await writeAudit(tx, ctx, {
      action: "crm.lead.update",
      associatedType: "lead",
      associatedId: leadId,
      summary: `${ctx.user.name} updated opportunity details`,
      entityId,
      before: existing,
      after: updated,
    });

    return updated;
  });
}

export async function deleteLead(ctx: CallerContext, leadId: string) {
  if (!ctx.entityId) throw new DomainValidationError("entityId is required");
  const entityId = await resolveEntityId(ctx.entityId);
  await authorize(ctx, "crm.lead.write", entityId);

  const [existing] = await db.select().from(leads).where(and(eq(leads.id, leadId), eq(leads.entityId, entityId))).limit(1);
  if (!existing) throw new NotFoundError("Lead not found");

  return db.transaction(async (tx) => {
    await tx.delete(leads).where(eq(leads.id, leadId));

    await writeAudit(tx, ctx, {
      action: "crm.lead.delete",
      associatedType: "lead",
      associatedId: leadId,
      summary: `${ctx.user.name} removed an opportunity from the pipeline`,
      entityId,
      before: existing,
      after: null,
    });

    return { success: true };
  });
}

export async function transitionLeadStage(ctx: CallerContext, leadId: string, rawInput: unknown) {
  const input = parseInput(transitionLeadStageSchema, rawInput);
  const entityId = await resolveEntityId(input.entityId);
  await authorize(ctx, "crm.lead.write", entityId);

  const [existing] = await db.select().from(leads).where(and(eq(leads.id, leadId), eq(leads.entityId, entityId))).limit(1);
  if (!existing) throw new NotFoundError("Lead not found");

  const isClosing = input.stage === "closed_won" || input.stage === "closed_lost";

  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(leads)
      .set({
        stage: input.stage,
        closedAt: isClosing ? (existing.closedAt ?? new Date()) : null,
        lostReason: input.stage === "closed_lost" ? (input.lostReason ?? existing.lostReason) : null,
        updatedAt: new Date(),
      })
      .where(eq(leads.id, leadId))
      .returning();

    await writeAudit(tx, ctx, {
      action: "crm.lead.transition",
      associatedType: "lead",
      associatedId: leadId,
      summary: `${ctx.user.name} moved the opportunity from ${existing.stage.replace("_", " ")} to ${input.stage.replace("_", " ")}`,
      entityId,
      before: existing,
      after: updated,
    });

    return updated;
  });
}
