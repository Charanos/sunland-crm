import { eq, and, or, ilike, desc, gte, lte, inArray, getTableColumns, SQL } from "drizzle-orm";
import { db } from "@/db";
import { contacts } from "@/db/schema/crm";
import { properties, propertyMandates, leases, transactions, documents, remittanceAdvices, users, leads, calendarEvents } from "@/db/schema";
import { authorize } from "@/lib/authz/can";
import { writeAudit } from "@/lib/authz/audit";
import { ConflictError, DomainValidationError, NotFoundError } from "@/lib/authz/errors";
import { resolveEntityId } from "@/lib/services/entity";
import { listAuditLog } from "@/lib/services/audit-log";
import { toISOStringSafe } from "@/lib/services/properties";
import { listLeads } from "@/lib/services/leads";
import { listCalendarEvents } from "@/lib/services/scheduling";
import type { CallerContext } from "@/lib/services/types";

export async function listContacts(
  ctx: CallerContext,
  filters: { type?: typeof contacts.type.enumValues[number]; search?: string } = {}
) {
  if (!ctx.entityId) throw new DomainValidationError("entityId is required");
  const entityId = await resolveEntityId(ctx.entityId);
  await authorize(ctx, "crm.contact.read", entityId);

  let conditions: SQL | undefined = eq(contacts.entityId, entityId);

  if (filters.type) {
    conditions = and(conditions, eq(contacts.type, filters.type));
  }

  if (filters.search) {
    const q = `%${filters.search}%`;
    conditions = and(
      conditions,
      or(
        ilike(contacts.displayName, q),
        ilike(contacts.email, q),
        ilike(contacts.phone, q)
      )
    );
  }

  const rows = await db
    .select({ ...getTableColumns(contacts), assignedToName: users.name, assignedToAvatarUrl: users.avatarUrl })
    .from(contacts)
    .leftJoin(users, eq(users.id, contacts.assignedToId))
    .where(conditions);
  const contactIds = rows.map((r) => r.id);

  // Bulk "fetch then reduce in JS" signal-gathering (no SQL groupBy, matching
  // the rest of this service layer) so every contact in the Directory gets a
  // real derived status without an N+1 query per row.
  const [activeLeaseRows, activeMandateRows, leadRows] = contactIds.length
    ? await Promise.all([
      db.select({ id: leases.tenantContactId }).from(leases).where(and(inArray(leases.tenantContactId, contactIds), eq(leases.isActive, true))),
      db.select({ id: propertyMandates.landlordContactId }).from(propertyMandates).where(and(inArray(propertyMandates.landlordContactId, contactIds), eq(propertyMandates.status, "active"))),
      db.select({ id: leads.contactId, priority: leads.priority, stage: leads.stage }).from(leads).where(inArray(leads.contactId, contactIds)),
    ])
    : [[], [], []];

  const activeLeaseSet = new Set(activeLeaseRows.map((r) => r.id));
  const activeMandateSet = new Set(activeMandateRows.map((r) => r.id));
  const leadSignalByContact = new Map<string, { hasHighPriority: boolean; hasAny: boolean }>();
  for (const l of leadRows) {
    if (!l.id || !OPEN_LEAD_STAGES.has(l.stage)) continue;
    const cur = leadSignalByContact.get(l.id) ?? { hasHighPriority: false, hasAny: false };
    cur.hasAny = true;
    if (l.priority === "high") cur.hasHighPriority = true;
    leadSignalByContact.set(l.id, cur);
  }

  return rows.map((c) => {
    const leadSignal = leadSignalByContact.get(c.id);
    return {
      ...c,
      status: deriveContactStatus({
        hasActiveLeaseOrMandate: activeLeaseSet.has(c.id) || activeMandateSet.has(c.id),
        hasOpenHighPriorityLead: leadSignal?.hasHighPriority ?? false,
        hasOpenLead: leadSignal?.hasAny ?? false,
      }),
    };
  });
}

export async function createContact(
  ctx: CallerContext,
  input: {
    displayName: string;
    type: typeof contacts.type.enumValues[number];
    companyName?: string | null;
    email?: string | null;
    phone?: string | null;
    source?: string | null;
    metadata?: Record<string, unknown>;
  }
) {
  if (!ctx.entityId) throw new DomainValidationError("entityId is required");
  const entityId = await resolveEntityId(ctx.entityId);
  await authorize(ctx, "crm.contact.write", entityId);

  if (!input.displayName) {
    throw new DomainValidationError("displayName is required");
  }

  return db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(contacts)
      .values({
        entityId,
        displayName: input.displayName,
        type: input.type,
        companyName: input.companyName ?? null,
        email: input.email ?? null,
        phone: input.phone ?? null,
        source: input.source ?? "website",
        metadata: input.metadata ?? {},
      })
      .returning();

    await writeAudit(tx, ctx, {
      action: "crm.contact.create",
      associatedType: "contact",
      associatedId: inserted.id,
      summary: `Created contact ${inserted.displayName} of type ${inserted.type}`,
      entityId,
      before: null,
      after: inserted,
    });

    return inserted;
  });
}

export async function getContact(ctx: CallerContext, contactId: string) {
  if (!ctx.entityId) throw new DomainValidationError("entityId is required");
  const entityId = await resolveEntityId(ctx.entityId);
  await authorize(ctx, "crm.contact.read", entityId);

  const [target] = await db
    .select()
    .from(contacts)
    .where(and(eq(contacts.id, contactId), eq(contacts.entityId, entityId)))
    .limit(1);

  if (!target) throw new NotFoundError("Contact not found");
  return target;
}

/**
 * Was entirely missing until now - contacts-board.tsx's edit flow was a
 * client-only no-op that discarded every change. Whitelisted `.set()` fields
 * only, matching updateProperty's fix for the same class of bug.
 */
export async function updateContact(
  ctx: CallerContext,
  contactId: string,
  input: {
    displayName?: string;
    type?: typeof contacts.type.enumValues[number];
    companyName?: string | null;
    email?: string | null;
    phone?: string | null;
    source?: string | null;
    assignedToId?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  if (!ctx.entityId) throw new DomainValidationError("entityId is required");
  const entityId = await resolveEntityId(ctx.entityId);
  await authorize(ctx, "crm.contact.write", entityId);

  const [existing] = await db
    .select()
    .from(contacts)
    .where(and(eq(contacts.id, contactId), eq(contacts.entityId, entityId)))
    .limit(1);
  if (!existing) throw new NotFoundError("Contact not found");

  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(contacts)
      .set({
        displayName: input.displayName ?? existing.displayName,
        type: input.type ?? existing.type,
        companyName: input.companyName !== undefined ? input.companyName : existing.companyName,
        email: input.email !== undefined ? input.email : existing.email,
        phone: input.phone !== undefined ? input.phone : existing.phone,
        source: input.source !== undefined ? input.source : existing.source,
        assignedToId: input.assignedToId !== undefined ? input.assignedToId : existing.assignedToId,
        metadata: input.metadata ?? existing.metadata,
        updatedAt: new Date(),
      })
      .where(eq(contacts.id, contactId))
      .returning();

    await writeAudit(tx, ctx, {
      action: "crm.contact.update",
      associatedType: "contact",
      associatedId: contactId,
      summary: `${ctx.user.name} updated ${updated.displayName}`,
      entityId,
      before: existing,
      after: updated,
    });

    return updated;
  });
}

/**
 * Blocks on the common blockers with a clear message rather than letting a
 * raw Postgres FK violation surface as an opaque 500 - mirrors deleteProperty
 * (properties.ts:342-378). Leads/mandates/leases are checked explicitly since
 * they're the likely real-world blockers for a contact; anything less common
 * (documents, transactions, tenant_payments) falls through to the try/catch.
 */
export async function deleteContact(ctx: CallerContext, contactId: string) {
  if (!ctx.entityId) throw new DomainValidationError("entityId is required");
  const entityId = await resolveEntityId(ctx.entityId);
  await authorize(ctx, "crm.contact.write", entityId);

  const [existing] = await db
    .select()
    .from(contacts)
    .where(and(eq(contacts.id, contactId), eq(contacts.entityId, entityId)))
    .limit(1);
  if (!existing) throw new NotFoundError("Contact not found");

  const [existingLead] = await db.select({ id: leads.id }).from(leads).where(eq(leads.contactId, contactId)).limit(1);
  if (existingLead) {
    throw new ConflictError("Contact has pipeline deals and cannot be deleted; reassign or close those first.");
  }
  const [existingMandate] = await db.select({ id: propertyMandates.id }).from(propertyMandates).where(eq(propertyMandates.landlordContactId, contactId)).limit(1);
  if (existingMandate) {
    throw new ConflictError("Contact has landlord mandate history and cannot be deleted.");
  }
  const [existingLease] = await db.select({ id: leases.id }).from(leases).where(eq(leases.tenantContactId, contactId)).limit(1);
  if (existingLease) {
    throw new ConflictError("Contact has lease history and cannot be deleted.");
  }
  const [existingProperty] = await db.select({ id: properties.id }).from(properties).where(eq(properties.ownerContactId, contactId)).limit(1);
  if (existingProperty) {
    throw new ConflictError("Contact owns properties in the portfolio and cannot be deleted.");
  }

  return db.transaction(async (tx) => {
    try {
      await tx.delete(contacts).where(and(eq(contacts.id, contactId), eq(contacts.entityId, entityId)));
    } catch {
      throw new ConflictError("Contact is referenced by other records and cannot be deleted.");
    }

    await writeAudit(tx, ctx, {
      action: "crm.contact.delete",
      associatedType: "contact",
      associatedId: contactId,
      summary: `${ctx.user.name} removed contact ${existing.displayName}`,
      entityId,
      before: existing,
      after: null,
    });

    return { success: true };
  });
}

/**
 * "Confirm Landlord" (ADR 014 §14.4) - records/edits the ID number and marks
 * the contact identity-verified in one step. Generic to any contact, not
 * landlord-specific, though the property full-view's Owner card is the only
 * caller today.
 */
export async function verifyContact(
  ctx: CallerContext,
  contactId: string,
  input: { idNumber?: string | null }
) {
  if (!ctx.entityId) throw new DomainValidationError("entityId is required");
  const entityId = await resolveEntityId(ctx.entityId);
  await authorize(ctx, "crm.contact.write", entityId);

  const [existing] = await db
    .select()
    .from(contacts)
    .where(and(eq(contacts.id, contactId), eq(contacts.entityId, entityId)))
    .limit(1);
  if (!existing) throw new NotFoundError("Contact not found");

  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(contacts)
      .set({
        idNumber: input.idNumber !== undefined ? input.idNumber : existing.idNumber,
        verifiedAt: new Date(),
        verifiedById: ctx.user.id,
        updatedAt: new Date(),
      })
      .where(eq(contacts.id, contactId))
      .returning();

    await writeAudit(tx, ctx, {
      action: "crm.contact.verify",
      associatedType: "contact",
      associatedId: contactId,
      summary: `${ctx.user.name} confirmed ${existing.displayName}'s identity`,
      entityId,
      before: existing,
      after: updated,
    });

    return updated;
  });
}

/**
 * "Everything about one contact" - the aggregation that neither the bare
 * `getContact` above nor the Contacts board ever had (the board hardcodes
 * financials/associatedProperties to zero/empty because this didn't exist).
 * Follows the same "fetch base row + authorize + Promise.all fan-out + merge
 * in JS" template as getPropertyWithDetails/getMandateWithDetails
 * (properties.ts/mandates.ts) - no SQL groupBy, matching the rest of this
 * service layer. Branches on contact.type: a landlord's portfolio is their
 * owned properties/mandates/remittances; a tenant's is their leases/balance/
 * payment history. Shared: documents and cross-entity activity.
 */
export async function getContactProfile(ctx: CallerContext, contactId: string) {
  if (!ctx.entityId) throw new DomainValidationError("entityId is required");
  const entityId = await resolveEntityId(ctx.entityId);
  await authorize(ctx, "crm.contact.read", entityId);

  const [contact] = await db
    .select()
    .from(contacts)
    .where(and(eq(contacts.id, contactId), eq(contacts.entityId, entityId)))
    .limit(1);
  if (!contact) throw new NotFoundError("Contact not found");

  const isLandlord = contact.type === "landlord";
  const isTenant = contact.type === "tenant";

  const [ownedPropertyRows, mandateRows, leaseRows, paymentRows, ownerDocRows] = await Promise.all([
    isLandlord
      ? db
        .select({
          ...getTableColumns(properties),
          managerName: users.name,
          managerAvatarUrl: users.avatarUrl,
        })
        .from(properties)
        .leftJoin(
          propertyMandates,
          and(eq(propertyMandates.propertyId, properties.id), inArray(propertyMandates.status, ["pending_approval", "active"])),
        )
        .leftJoin(users, eq(users.id, propertyMandates.assignedPmId))
        .where(eq(properties.ownerContactId, contactId))
      : Promise.resolve([]),
    isLandlord
      ? db
        .select({ ...getTableColumns(propertyMandates), propertyName: properties.name })
        .from(propertyMandates)
        .innerJoin(properties, eq(propertyMandates.propertyId, properties.id))
        .where(eq(propertyMandates.landlordContactId, contactId))
        .orderBy(desc(propertyMandates.createdAt))
      : Promise.resolve([]),
    isTenant
      ? db
        .select({
          id: leases.id,
          propertyId: leases.propertyId,
          propertyName: properties.name,
          propertyCode: properties.propertyCode,
          startsAt: leases.startsAt,
          endsAt: leases.endsAt,
          monthlyRentKes: leases.monthlyRentKes,
          depositKes: leases.depositKes,
          isActive: leases.isActive,
        })
        .from(leases)
        .innerJoin(properties, eq(leases.propertyId, properties.id))
        .where(eq(leases.tenantContactId, contactId))
        .orderBy(desc(leases.startsAt))
      : Promise.resolve([]),
    isTenant
      ? db
        .select({ leaseId: transactions.leaseId, amountKes: transactions.amountKes, occurredAt: transactions.occurredAt })
        .from(transactions)
        .where(and(eq(transactions.contactId, contactId), eq(transactions.type, "rent")))
        .orderBy(desc(transactions.occurredAt))
      : Promise.resolve([]),
    db.select().from(documents).where(eq(documents.ownerContactId, contactId)).orderBy(desc(documents.createdAt)),
  ]);

  // Second phase - depends on phase-1 ids, same two-step shape
  // getPropertyWithDetails uses for its dependent pendingApproval lookup.
  const propertyIds = ownedPropertyRows.map((p) => p.id);
  const mandateIds = mandateRows.map((m) => m.id);
  const leaseIds = leaseRows.map((l) => l.id);

  const [propertyDocRows, leaseDocRows, remittanceRows] = await Promise.all([
    propertyIds.length ? db.select().from(documents).where(inArray(documents.propertyId, propertyIds)) : Promise.resolve([]),
    leaseIds.length ? db.select().from(documents).where(inArray(documents.leaseId, leaseIds)) : Promise.resolve([]),
    mandateIds.length
      ? db.select().from(remittanceAdvices).where(inArray(remittanceAdvices.mandateId, mandateIds)).orderBy(desc(remittanceAdvices.createdAt))
      : Promise.resolve([]),
  ]);

  // listAuditLog silently drops empty-id groups (returning unscoped,
  // entity-wide activity if that leaves it with none at all) - short-circuit
  // instead of relying on that when this contact has no mandates/leases yet.
  const relevantIds = isLandlord ? mandateIds : leaseIds;
  const activity = relevantIds.length
    ? await listAuditLog(ctx, {
      entityId,
      associatedGroups: [{ type: isLandlord ? "property_mandate" : "lease", ids: relevantIds }],
      limit: 50,
    })
    : [];

  // Current-month balance per active lease, same collected-vs-expected calc
  // as listLeases - computed here from paymentRows already fetched above
  // rather than a second query.
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const leasesWithBalance = leaseRows.map((l) => {
    if (!l.isActive) return { ...l, balanceKes: 0 };
    const collected = paymentRows
      .filter((t) => t.leaseId === l.id && t.occurredAt >= monthStart)
      .reduce((sum, t) => sum + parseFloat(t.amountKes), 0);
    return { ...l, balanceKes: Math.max(0, parseFloat(l.monthlyRentKes) - collected) };
  });
  const balanceKes = leasesWithBalance.reduce((sum, l) => sum + l.balanceKes, 0);
  const paidYtd = paymentRows
    .filter((t) => t.occurredAt.getFullYear() === now.getFullYear())
    .reduce((sum, t) => sum + parseFloat(t.amountKes), 0);

  const documentSummaries = [...ownerDocRows, ...propertyDocRows, ...leaseDocRows]
    .filter((d, i, arr) => arr.findIndex((x) => x.id === d.id) === i)
    .map((d) => ({ id: d.id, name: d.title, type: d.type, url: d.fileUrl, createdAt: toISOStringSafe(d.createdAt) }));

  return {
    ...contact,
    properties: ownedPropertyRows.map((p) => ({
      id: p.id,
      name: p.name,
      propertyCode: p.propertyCode,
      propertyType: p.propertyType,
      status: p.status,
      monthlyRentKes: p.monthlyRentKes,
      media: p.media,
      managerName: p.managerName,
      managerAvatarUrl: p.managerAvatarUrl,
    })),
    mandates: mandateRows.map((m) => ({
      id: m.id,
      propertyId: m.propertyId,
      propertyName: m.propertyName,
      mandateRate: m.mandateRate,
      status: m.status,
      startDate: toISOStringSafe(m.startDate),
      endDate: toISOStringSafe(m.endDate),
    })),
    remittances: remittanceRows.map((r) => ({
      id: r.id,
      mandateId: r.mandateId,
      netRemittanceKes: r.netRemittanceKes,
      status: r.status,
      createdAt: toISOStringSafe(r.createdAt),
    })),
    leases: leasesWithBalance.map((l) => ({
      ...l,
      startsAt: toISOStringSafe(l.startsAt),
      endsAt: toISOStringSafe(l.endsAt),
    })),
    balanceKes,
    paidYtd,
    documents: documentSummaries,
    activity: activity.map((a) => ({
      id: a.id,
      summary: a.summary,
      actorName: a.actorName,
      createdAt: toISOStringSafe(a.createdAt),
    })),
  };
}

export type ContactTouchChannel = "call" | "email" | "whatsapp";

const TOUCH_ACTION_BY_CHANNEL: Record<ContactTouchChannel, string> = {
  call: "crm.contact.call_logged",
  email: "crm.contact.email_logged",
  whatsapp: "crm.contact.whatsapp_logged",
};
const TOUCH_VERB_BY_CHANNEL: Record<ContactTouchChannel, string> = {
  call: "called",
  email: "emailed",
  whatsapp: "WhatsApp'd",
};

/**
 * Finally makes real what seed.ts's demo data only ever illustrated (a
 * `crm.contact.call_logged`-style row with no live code path producing it) -
 * a real, timestamped touchpoint via the standing writeAudit choke point, so
 * the Contacts CRM "Quick Connects" feed has genuine activity to show.
 */
export async function logContactTouch(ctx: CallerContext, contactId: string, channel: ContactTouchChannel) {
  if (!ctx.entityId) throw new DomainValidationError("entityId is required");
  const entityId = await resolveEntityId(ctx.entityId);
  await authorize(ctx, "crm.contact.write", entityId);

  const [existing] = await db
    .select()
    .from(contacts)
    .where(and(eq(contacts.id, contactId), eq(contacts.entityId, entityId)))
    .limit(1);
  if (!existing) throw new NotFoundError("Contact not found");

  return db.transaction(async (tx) => {
    await writeAudit(tx, ctx, {
      action: TOUCH_ACTION_BY_CHANNEL[channel],
      associatedType: "contact",
      associatedId: contactId,
      summary: `${ctx.user.name} ${TOUCH_VERB_BY_CHANNEL[channel]} ${existing.displayName}`,
      entityId,
      before: null,
      after: null,
    });
    return { success: true };
  });
}

export type ContactCrmStatus = "Active Client" | "Hot Prospect" | "Prospect" | "New Contact";

/**
 * Derived at read time, never stored (same reasoning as scheduling's
 * needsDisposition flag) - avoids a second status machine parallel to
 * leads.stage that could silently drift out of sync with it.
 */
export function deriveContactStatus(signals: {
  hasActiveLeaseOrMandate: boolean;
  hasOpenHighPriorityLead: boolean;
  hasOpenLead: boolean;
}): ContactCrmStatus {
  if (signals.hasActiveLeaseOrMandate) return "Active Client";
  if (signals.hasOpenHighPriorityLead) return "Hot Prospect";
  if (signals.hasOpenLead) return "Prospect";
  return "New Contact";
}

const OPEN_LEAD_STAGES = new Set(["inquiry", "qualification", "viewing", "offer", "negotiation"]);

/**
 * Single aggregate backing the Contacts CRM page's hero stats, Lead Status
 * Overview, Property Appointments, Follow-Up Tasks, and Quick Connects rail -
 * one server-side "fetch then reduce in JS" pass (no SQL groupBy), matching
 * every other aggregate in this service layer (getContactProfile above,
 * getDashboardOverview, getAgentPerformance).
 */
export async function getContactsCrmOverview(ctx: CallerContext) {
  if (!ctx.entityId) throw new DomainValidationError("entityId is required");
  const entityId = await resolveEntityId(ctx.entityId);
  await authorize(ctx, "crm.contact.read", entityId);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

  const [allContacts, allLeads, todaysViewings, recentTouchRows] = await Promise.all([
    db.select({ id: contacts.id, createdAt: contacts.createdAt }).from(contacts).where(eq(contacts.entityId, entityId)),
    listLeads(ctx, {}),
    listCalendarEvents(ctx, {
      entityId,
      startDate: todayStart.toISOString(),
      endDate: todayEnd.toISOString(),
      scope: "all",
      type: "viewing",
    }),
    listAuditLog(ctx, { entityId, associatedType: "contact", limit: 12 }),
  ]);

  const totalContacts = allContacts.length;
  const newThisMonth = allContacts.filter((c) => c.createdAt >= monthStart).length;

  const openLeads = allLeads.filter((l) => OPEN_LEAD_STAGES.has(l.stage));
  const hotLeads = openLeads.filter((l) => l.priority === "high").slice(0, 4);
  const followUpsDue = openLeads
    .filter((l) => l.nextActionAt && new Date(l.nextActionAt) <= todayEnd)
    .sort((a, b) => new Date(a.nextActionAt!).getTime() - new Date(b.nextActionAt!).getTime())
    .slice(0, 6);
  const newLeadsToday = allLeads.filter((l) => new Date(l.createdAt) >= todayStart).length;

  // Featured Quick Connects card: today's first viewing if one exists, else
  // the nearest future one - never a fabricated property/attendee list.
  const upcomingViewing = todaysViewings[0]
    ?? (await listCalendarEvents(ctx, { entityId, startDate: now.toISOString(), scope: "all", type: "viewing" }))[0]
    ?? null;

  return {
    totalContacts,
    newThisMonth,
    viewingsToday: todaysViewings.length,
    openLeadsCount: openLeads.length,
    followUpsDueCount: followUpsDue.length,
    newLeadsToday,
    hotLeads,
    followUpsDue,
    todaysViewings,
    upcomingViewing,
    recentTouches: recentTouchRows.map((a) => ({
      id: a.id,
      contactId: a.associatedId,
      summary: a.summary,
      actorName: a.actorName,
      createdAt: toISOStringSafe(a.createdAt),
    })),
  };
}
