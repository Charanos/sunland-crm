import { eq, and, or, ilike, desc, gte, inArray, getTableColumns, SQL } from "drizzle-orm";
import { db } from "@/db";
import { contacts } from "@/db/schema/crm";
import { properties, propertyMandates, leases, transactions, documents, remittanceAdvices, users } from "@/db/schema";
import { authorize } from "@/lib/authz/can";
import { writeAudit } from "@/lib/authz/audit";
import { DomainValidationError, NotFoundError } from "@/lib/authz/errors";
import { resolveEntityId } from "@/lib/services/entity";
import { listAuditLog } from "@/lib/services/audit-log";
import { toISOStringSafe } from "@/lib/services/properties";
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

  return db.select().from(contacts).where(conditions);
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
