import { and, desc, eq, gte, ilike, inArray, or, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { contacts, documents, leadNotes, leads, leases, properties, propertyMandates, propertyUnits, transactions, users } from "@/db/schema";
import { authorize } from "@/lib/authz/can";
import { writeAudit } from "@/lib/authz/audit";
import { ConflictError, DomainValidationError, NotFoundError } from "@/lib/authz/errors";
import { resolveEntityId } from "@/lib/services/entity";
import { listAuditLog } from "@/lib/services/audit-log";
import { toISOStringSafe } from "@/lib/services/properties";
import type { CallerContext } from "@/lib/services/types";
import { canMoveLeadStage, type PipelineStage } from "@/components/sunland/lead-constants";
import { addLeadNoteSchema, createLeadSchema, transitionLeadStageSchema, updateLeadSchema } from "@/lib/validation/leads";
import { parseInput } from "@/lib/validation/parse";

export { canMoveLeadStage };

// Real backend for the CRM/BD pipeline (ADR 015 §15.4) - the `leads` table
// was already real (contactId/propertyId/assignedToId FKs), only the read/
// write surface was missing. listLeads/getLead deliberately return a shape
// compatible with pipeline-board.tsx's existing (previously mock-only) `Lead`
// UI type, so the current board can be wired to real data now without also
// being visually rebuilt - that redesign pass is separate, later work.

function mapLeadRow(row: {
  id: string;
  stage: string;
  priority: string;
  contactId: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  contactAvatarUrl: string | null;
  propertyId: string | null;
  propertyName: string | null;
  propertyMedia: unknown;
  propertyLocation: string | null;
  expectedValueKes: string | null;
  probability: number;
  source: string | null;
  assignedToId: string | null;
  assignedToName: string | null;
  assignedToAvatarUrl: string | null;
  notes: string | null;
  nextActionAt: Date | null;
  createdAt: Date;
  closedAt: Date | null;
}) {
  const media = Array.isArray(row.propertyMedia) ? (row.propertyMedia as Array<{ url: string; isPrimary?: boolean }>) : [];
  return {
    id: row.id,
    contactId: row.contactId,
    clientName: row.contactName ?? "Unknown Client",
    email: row.contactEmail ?? "",
    phone: row.contactPhone ?? "",
    clientAvatarUrl: row.contactAvatarUrl,
    budget: row.expectedValueKes ? parseFloat(row.expectedValueKes) : 0,
    probability: row.probability,
    propertyId: row.propertyId,
    propertyInterest: row.propertyName ?? "General Inquiry",
    propertyLocation: row.propertyLocation,
    propertyImageUrl: media.find((m) => m.isPrimary)?.url ?? media[0]?.url ?? null,
    source: row.source ?? "website",
    stage: row.stage,
    priority: row.priority,
    assignedToId: row.assignedToId,
    assignedAgent: row.assignedToName ?? "Unassigned",
    assignedAgentAvatarUrl: row.assignedToAvatarUrl,
    nextActionAt: toISOStringSafe(row.nextActionAt),
    createdDate: toISOStringSafe(row.createdAt)?.slice(0, 10) ?? "",
    createdAt: toISOStringSafe(row.createdAt) ?? "",
    closedAt: toISOStringSafe(row.closedAt),
    notes: row.notes ?? undefined,
  };
}

const LEAD_LIST_COLUMNS = {
  id: leads.id,
  stage: leads.stage,
  priority: leads.priority,
  contactId: leads.contactId,
  contactName: contacts.displayName,
  contactEmail: contacts.email,
  contactPhone: contacts.phone,
  contactAvatarUrl: contacts.avatarUrl,
  propertyId: leads.propertyId,
  propertyName: properties.name,
  propertyMedia: properties.media,
  propertyLocation: properties.location,
  expectedValueKes: leads.expectedValueKes,
  probability: leads.probability,
  source: leads.source,
  assignedToId: leads.assignedToId,
  assignedToName: users.name,
  assignedToAvatarUrl: users.avatarUrl,
  notes: leads.notes,
  nextActionAt: leads.nextActionAt,
  createdAt: leads.createdAt,
  closedAt: leads.closedAt,
};

export async function listLeads(
  ctx: CallerContext,
  filters: { stage?: string; assignedToId?: string; contactId?: string; search?: string } = {},
) {
  if (!ctx.entityId) throw new DomainValidationError("entityId is required");
  const entityId = await resolveEntityId(ctx.entityId);
  await authorize(ctx, "crm.lead.read", entityId);

  let conditions: SQL | undefined = eq(leads.entityId, entityId);
  if (filters.stage) conditions = and(conditions, eq(leads.stage, filters.stage as (typeof leads.stage.enumValues)[number]));
  if (filters.assignedToId) conditions = and(conditions, eq(leads.assignedToId, filters.assignedToId));
  if (filters.contactId) conditions = and(conditions, eq(leads.contactId, filters.contactId));
  if (filters.search) {
    const q = `%${filters.search}%`;
    conditions = and(conditions, or(ilike(contacts.displayName, q), ilike(properties.name, q)));
  }

  const rows = await db
    .select(LEAD_LIST_COLUMNS)
    .from(leads)
    .innerJoin(contacts, eq(leads.contactId, contacts.id))
    .leftJoin(properties, eq(leads.propertyId, properties.id))
    .leftJoin(users, eq(leads.assignedToId, users.id))
    .where(conditions)
    .orderBy(desc(leads.createdAt));

  const leadIds = rows.map((r) => r.id);
  const [noteRows, docRows] = leadIds.length
    ? await Promise.all([
      db.select({ leadId: leadNotes.leadId }).from(leadNotes).where(and(eq(leadNotes.entityId, entityId), inArray(leadNotes.leadId, leadIds))),
      db.select({ leadId: documents.leadId }).from(documents).where(and(eq(documents.entityId, entityId), inArray(documents.leadId, leadIds))),
    ])
    : [[], []];
  const noteCountByLead = new Map<string, number>();
  for (const n of noteRows) noteCountByLead.set(n.leadId, (noteCountByLead.get(n.leadId) ?? 0) + 1);
  const docCountByLead = new Map<string, number>();
  for (const d of docRows) if (d.leadId) docCountByLead.set(d.leadId, (docCountByLead.get(d.leadId) ?? 0) + 1);

  return rows.map((row) => ({
    ...mapLeadRow(row),
    noteCount: noteCountByLead.get(row.id) ?? 0,
    documentCount: docCountByLead.get(row.id) ?? 0,
  }));
}

/**
 * Real occupancy/rent-roll/balance/yield for a lead's linked property - only
 * returned when that property is genuinely under an active Sunland mandate
 * (this is a resale/re-let of an already-managed property, not a brand-new
 * external listing), mirroring mandates' real originValuation cross-link
 * (ADR 015 §15.3) rather than the design mockup's fixed per-deal numbers.
 */
async function getLeadPropertyPerformance(propertyId: string) {
  const [mandateRow] = await db
    .select({ id: propertyMandates.id })
    .from(propertyMandates)
    .where(and(eq(propertyMandates.propertyId, propertyId), eq(propertyMandates.status, "active")))
    .limit(1);
  if (!mandateRow) return null;

  const [property] = await db.select({ askingPriceKes: properties.askingPriceKes }).from(properties).where(eq(properties.id, propertyId)).limit(1);
  const activeLeases = await db.select({ id: leases.id, monthlyRentKes: leases.monthlyRentKes }).from(leases).where(and(eq(leases.propertyId, propertyId), eq(leases.isActive, true)));
  const unitRows = await db.select({ status: propertyUnits.status }).from(propertyUnits).where(eq(propertyUnits.propertyId, propertyId));

  const occupancyPct = unitRows.length > 0
    ? Math.round((unitRows.filter((u) => u.status === "occupied").length / unitRows.length) * 100)
    : activeLeases.length > 0 ? 100 : 0;

  const rentRollKes = activeLeases.reduce((sum, l) => sum + parseFloat(l.monthlyRentKes), 0);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const leaseIds = activeLeases.map((l) => l.id);
  const collectedThisMonth = leaseIds.length
    ? (await db.select({ amountKes: transactions.amountKes }).from(transactions).where(and(inArray(transactions.leaseId, leaseIds), eq(transactions.type, "rent"), gte(transactions.occurredAt, monthStart))))
      .reduce((sum, t) => sum + parseFloat(t.amountKes), 0)
    : 0;
  const balanceKes = Math.max(0, rentRollKes - collectedThisMonth);

  const askingPriceKes = property?.askingPriceKes ? parseFloat(property.askingPriceKes) : null;
  const yieldPct = askingPriceKes && askingPriceKes > 0 && rentRollKes > 0 ? Math.round(((rentRollKes * 12) / askingPriceKes) * 1000) / 10 : null;

  return { mandateId: mandateRow.id, occupancyPct, rentRollKes, balanceKes, yieldPct };
}

export async function getLead(ctx: CallerContext, leadId: string) {
  if (!ctx.entityId) throw new DomainValidationError("entityId is required");
  const entityId = await resolveEntityId(ctx.entityId);
  await authorize(ctx, "crm.lead.read", entityId);

  const [row] = await db
    .select({ ...LEAD_LIST_COLUMNS, lostReason: leads.lostReason })
    .from(leads)
    .innerJoin(contacts, eq(leads.contactId, contacts.id))
    .leftJoin(properties, eq(leads.propertyId, properties.id))
    .leftJoin(users, eq(leads.assignedToId, users.id))
    .where(and(eq(leads.id, leadId), eq(leads.entityId, entityId)))
    .limit(1);

  if (!row) throw new NotFoundError("Lead not found");

  const [activity, noteRows, docRows, propertyPerformance] = await Promise.all([
    listAuditLog(ctx, { entityId, associatedType: "lead", associatedId: leadId, limit: 50 }),
    db
      .select({ id: leadNotes.id, text: leadNotes.text, createdAt: leadNotes.createdAt, authorName: users.name, authorAvatarUrl: users.avatarUrl })
      .from(leadNotes)
      .leftJoin(users, eq(leadNotes.authorId, users.id))
      .where(eq(leadNotes.leadId, leadId))
      .orderBy(desc(leadNotes.createdAt)),
    db.select().from(documents).where(eq(documents.leadId, leadId)).orderBy(desc(documents.createdAt)),
    row.propertyId ? getLeadPropertyPerformance(row.propertyId) : Promise.resolve(null),
  ]);

  const timeline = [
    ...activity.map((a) => ({ id: a.id, date: toISOStringSafe(a.createdAt) ?? "", type: "system" as const, summary: a.summary, details: a.actorName })),
    ...noteRows.map((n) => ({ id: n.id, date: toISOStringSafe(n.createdAt) ?? "", type: "note" as const, summary: n.authorName ? `${n.authorName} added a note` : "Note added", details: n.text })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return {
    ...mapLeadRow(row),
    lostReason: row.lostReason,
    closedAt: toISOStringSafe(row.closedAt),
    timeline,
    documents: docRows.map((d) => ({ id: d.id, name: d.title, type: d.type, url: d.fileUrl, fileSizeBytes: d.fileSizeBytes, createdAt: toISOStringSafe(d.createdAt) })),
    propertyPerformance,
  };
}

export async function addLeadNote(ctx: CallerContext, leadId: string, rawInput: unknown) {
  const input = parseInput(addLeadNoteSchema, rawInput);
  const entityId = await resolveEntityId(input.entityId);
  await authorize(ctx, "crm.lead.write", entityId);

  const [existing] = await db.select().from(leads).where(and(eq(leads.id, leadId), eq(leads.entityId, entityId))).limit(1);
  if (!existing) throw new NotFoundError("Lead not found");

  return db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(leadNotes)
      .values({ entityId, leadId, authorId: ctx.user.id, text: input.text })
      .returning();

    await writeAudit(tx, ctx, {
      action: "crm.lead.note",
      associatedType: "lead",
      associatedId: leadId,
      summary: `${ctx.user.name} added a note to the opportunity`,
      entityId,
      before: null,
      after: inserted,
    });

    return { id: inserted.id, text: inserted.text, createdAt: toISOStringSafe(inserted.createdAt), authorName: ctx.user.name };
  });
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
        priority: input.priority,
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
        priority: input.priority ?? existing.priority,
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

/**
 * Real adjacency guard (mirrors valuations' canMoveToStage precedent) - not
 * left to the client UI to enforce alone. "Mark Lost" is the one exception,
 * valid from any non-terminal stage regardless of adjacency (matches the
 * design's own canMove(), which has no closed_lost branch at all since
 * closed_lost is never a drag target, only an explicit action).
 */
export async function transitionLeadStage(ctx: CallerContext, leadId: string, rawInput: unknown) {
  const input = parseInput(transitionLeadStageSchema, rawInput);
  const entityId = await resolveEntityId(input.entityId);
  await authorize(ctx, "crm.lead.write", entityId);

  const [existing] = await db.select().from(leads).where(and(eq(leads.id, leadId), eq(leads.entityId, entityId))).limit(1);
  if (!existing) throw new NotFoundError("Lead not found");

  const isClosing = input.stage === "closed_won" || input.stage === "closed_lost";
  const wasTerminal = existing.stage === "closed_won" || existing.stage === "closed_lost";

  if (input.stage === "closed_lost") {
    if (existing.stage === "closed_won") throw new ConflictError("A won deal cannot be marked lost.");
  } else if (wasTerminal) {
    throw new ConflictError("This deal is already closed.");
  } else if (!canMoveLeadStage(existing.stage as PipelineStage, input.stage as PipelineStage)) {
    throw new DomainValidationError(`Cannot move from "${existing.stage}" to "${input.stage}" - only adjacent stages are allowed.`);
  }

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
