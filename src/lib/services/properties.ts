import { randomBytes } from "crypto";
import { eq, and, ne, desc, SQL } from "drizzle-orm";
import { db } from "@/db";
import { properties, leases, documents, transactions } from "@/db/schema";
import { authorize } from "@/lib/authz/can";
import { writeAudit } from "@/lib/authz/audit";
import { ConflictError, DomainValidationError, NotFoundError } from "@/lib/authz/errors";
import { resolveEntityId } from "@/lib/services/entity";
import type { CallerContext } from "@/lib/services/types";

// ─── Properties ──────────────────────────────────────────────────────────────

export async function listProperties(
  ctx: CallerContext,
  filters: { ownerContactId?: string } = {}
) {
  if (!ctx.entityId) throw new DomainValidationError("entityId is required");
  const entityId = await resolveEntityId(ctx.entityId);
  await authorize(ctx, "properties.property.read", entityId);

  let conditions: SQL | undefined = eq(properties.entityId, entityId);
  if (filters.ownerContactId) {
    conditions = and(conditions, eq(properties.ownerContactId, filters.ownerContactId));
  }

  return db.select().from(properties).where(conditions);
}

type UnitBreakdownEntry = { unitType: string; count: number; monthlyRentKes?: string };
type MediaEntry = { url: string; alt?: string };

function validateUnitBreakdown(entries: UnitBreakdownEntry[] | undefined | null): UnitBreakdownEntry[] {
  if (!entries || entries.length === 0) return [];
  for (const entry of entries) {
    if (!entry.unitType || typeof entry.unitType !== "string") {
      throw new DomainValidationError("Each unit breakdown entry needs a unit type.");
    }
    if (!Number.isFinite(entry.count) || entry.count < 1) {
      throw new DomainValidationError(`Unit count for "${entry.unitType}" must be at least 1.`);
    }
  }
  return entries;
}

function generatePropertyCode(propertyType: string): string {
  const typeMap: Record<string, string> = {
    Commercial: "COM",
    Residential: "RES",
    Industrial: "IND",
    Land: "LND",
  };
  const typeCode = typeMap[propertyType] || "OTH";
  const date = new Date();
  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const hash = randomBytes(2).toString('hex').toUpperCase();
  return `SL-${typeCode}-${yy}${mm}-${hash}`;
}

export async function createProperty(
  ctx: CallerContext,
  input: {
    propertyCode?: string;
    name: string;
    propertyType: string;
    listingType: string;
    location: string;
    ownerContactId?: string | null;
    askingPriceKes?: string | null;
    monthlyRentKes?: string | null;
    bedrooms?: number | null;
    bathrooms?: number | null;
    sizeSqft?: number | null;
    media?: MediaEntry[];
    unitBreakdown?: UnitBreakdownEntry[];
  }
) {
  if (!ctx.entityId) throw new DomainValidationError("entityId is required");
  const entityId = await resolveEntityId(ctx.entityId);
  await authorize(ctx, "properties.property.write", entityId);

  if (!input.name || !input.propertyType || !input.listingType || !input.location) {
    throw new DomainValidationError("Name, type, listing type, and location are required.");
  }
  const unitBreakdown = validateUnitBreakdown(input.unitBreakdown);

  return db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(properties)
      .values({
        entityId,
        propertyCode: input.propertyCode || generatePropertyCode(input.propertyType),
        name: input.name,
        propertyType: input.propertyType,
        listingType: input.listingType,
        location: input.location,
        ownerContactId: input.ownerContactId ?? null,
        askingPriceKes: input.askingPriceKes ?? null,
        monthlyRentKes: input.monthlyRentKes ?? null,
        bedrooms: input.bedrooms ?? null,
        bathrooms: input.bathrooms ?? null,
        sizeSqft: input.sizeSqft ?? null,
        media: input.media ?? [],
        unitBreakdown,
        status: "available",
      })
      .returning();

    await writeAudit(tx, ctx, {
      action: "properties.property.create",
      associatedType: "property",
      associatedId: inserted.id,
      summary: `Registered property ${inserted.name} (Code: ${inserted.propertyCode})`,
      entityId,
      before: null,
      after: inserted,
    });

    return inserted;
  });
}

export async function updateProperty(
  ctx: CallerContext,
  propertyId: string,
  input: Partial<{
    propertyCode: string;
    name: string;
    propertyType: string;
    listingType: string;
    location: string;
    ownerContactId: string | null;
    askingPriceKes: string | null;
    monthlyRentKes: string | null;
    bedrooms: number | null;
    bathrooms: number | null;
    sizeSqft: number | null;
    status: "available" | "occupied" | "under_offer" | "off_market" | "maintenance";
    media: MediaEntry[];
    unitBreakdown: UnitBreakdownEntry[];
  }>
) {
  if (!ctx.entityId) throw new DomainValidationError("entityId is required");
  const entityId = await resolveEntityId(ctx.entityId);
  await authorize(ctx, "properties.property.write", entityId);

  const [existing] = await db
    .select()
    .from(properties)
    .where(and(eq(properties.id, propertyId), eq(properties.entityId, entityId)));
  if (!existing) throw new NotFoundError("Property not found");

  if (input.unitBreakdown !== undefined) {
    validateUnitBreakdown(input.unitBreakdown);
  }

  // Explicitly whitelisted rather than spreading `input` — the route forwards
  // the raw request body, which routinely carries an `entityId` (a slug like
  // "group", used only for scoping) that is NOT a real column value; blindly
  // spreading it into .set() wrote that literal string into the entity_id
  // uuid column and crashed every edit that included it. Real bug, caught by
  // testing the actual PATCH payload shape a client sends, not just the
  // service function in isolation.
  const updatableFields = {
    propertyCode: input.propertyCode,
    name: input.name,
    propertyType: input.propertyType,
    listingType: input.listingType,
    location: input.location,
    ownerContactId: input.ownerContactId,
    askingPriceKes: input.askingPriceKes,
    monthlyRentKes: input.monthlyRentKes,
    bedrooms: input.bedrooms,
    bathrooms: input.bathrooms,
    sizeSqft: input.sizeSqft,
    status: input.status,
    media: input.media,
    unitBreakdown: input.unitBreakdown,
  };
  for (const key of Object.keys(updatableFields) as (keyof typeof updatableFields)[]) {
    if (updatableFields[key] === undefined) delete updatableFields[key];
  }

  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(properties)
      .set({
        ...updatableFields,
        updatedAt: new Date(),
      })
      .where(and(eq(properties.id, propertyId), eq(properties.entityId, entityId)))
      .returning();

    await writeAudit(tx, ctx, {
      action: "properties.property.update",
      associatedType: "property",
      associatedId: updated.id,
      summary: `Updated property details for ${updated.name}`,
      entityId,
      before: existing,
      after: updated,
    });

    return updated;
  });
}

export async function deleteProperty(ctx: CallerContext, propertyId: string) {
  if (!ctx.entityId) throw new DomainValidationError("entityId is required");
  const entityId = await resolveEntityId(ctx.entityId);
  await authorize(ctx, "properties.property.write", entityId);

  const [existing] = await db
    .select()
    .from(properties)
    .where(and(eq(properties.id, propertyId), eq(properties.entityId, entityId)));
  if (!existing) throw new NotFoundError("Property not found");

  // Block on the common blockers with a clear message rather than letting a
  // raw Postgres FK violation surface as an opaque 500 (leases/transactions/
  // maintenance_requests/leads all reference properties.id with no cascade).
  const [existingLease] = await db.select({ id: leases.id }).from(leases).where(eq(leases.propertyId, propertyId)).limit(1);
  if (existingLease) {
    throw new ConflictError("Property has lease history and cannot be deleted; mark it off-market instead.");
  }
  const [existingTransaction] = await db
    .select({ id: transactions.id })
    .from(transactions)
    .where(eq(transactions.propertyId, propertyId))
    .limit(1);
  if (existingTransaction) {
    throw new ConflictError("Property has recorded transactions and cannot be deleted; mark it off-market instead.");
  }

  return db.transaction(async (tx) => {
    try {
      await tx
        .delete(properties)
        .where(and(eq(properties.id, propertyId), eq(properties.entityId, entityId)));
    } catch {
      // Fallback for less common referencing tables (maintenance_requests, leads).
      throw new ConflictError("Property is referenced by other records and cannot be deleted; mark it off-market instead.");
    }

    await writeAudit(tx, ctx, {
      action: "properties.property.delete",
      associatedType: "property",
      associatedId: propertyId,
      summary: `Deleted property ${existing.name} (Code: ${existing.propertyCode})`,
      entityId,
      before: existing,
      after: null,
    });
  });
}

// ─── Leases ──────────────────────────────────────────────────────────────────

export async function listLeases(ctx: CallerContext) {
  if (!ctx.entityId) throw new DomainValidationError("entityId is required");
  const entityId = await resolveEntityId(ctx.entityId);
  await authorize(ctx, "properties.lease.read", entityId);

  return db.select().from(leases).where(eq(leases.entityId, entityId));
}

export async function createLease(
  ctx: CallerContext,
  input: {
    propertyId: string;
    tenantContactId: string;
    startsAt: string;
    endsAt: string;
    monthlyRentKes: string;
    depositKes?: string | null;
  }
) {
  if (!ctx.entityId) throw new DomainValidationError("entityId is required");
  const entityId = await resolveEntityId(ctx.entityId);
  await authorize(ctx, "properties.lease.write", entityId);

  return db.transaction(async (tx) => {
    // 1. Fetch and verify property is available
    const [prop] = await tx
      .select()
      .from(properties)
      .where(and(eq(properties.id, input.propertyId), eq(properties.entityId, entityId)))
      .limit(1);

    if (!prop) throw new NotFoundError("Property not found");
    if (prop.status === "occupied") {
      throw new DomainValidationError("Property unit is already occupied by another active lease.");
    }

    // 2. Insert lease record
    const [inserted] = await tx
      .insert(leases)
      .values({
        entityId,
        propertyId: input.propertyId,
        tenantContactId: input.tenantContactId,
        startsAt: new Date(input.startsAt),
        endsAt: new Date(input.endsAt),
        monthlyRentKes: input.monthlyRentKes,
        depositKes: input.depositKes ?? null,
        isActive: true,
      })
      .returning();

    // 3. Flip unit status to occupied — guarded by status != occupied so a
    // concurrent lease on the same property can't both succeed (closes the
    // race between the check above and this write, same pattern used in
    // decideApprovalRequest).
    const [updatedProp] = await tx
      .update(properties)
      .set({ status: "occupied" })
      .where(and(eq(properties.id, input.propertyId), ne(properties.status, "occupied")))
      .returning();

    if (!updatedProp) {
      throw new ConflictError("Property unit is already occupied by another active lease.");
    }

    await writeAudit(tx, ctx, {
      action: "properties.lease.create",
      associatedType: "lease",
      associatedId: inserted.id,
      summary: `Created lease for tenant on property ${prop.name}`,
      entityId,
      before: null,
      after: { lease: inserted, propertyStatus: updatedProp.status },
    });

    return inserted;
  });
}

// ─── Digitized Documents ──────────────────────────────────────────────────────

export async function listDocuments(
  ctx: CallerContext,
  filters: { ownerContactId?: string; type?: typeof documents.type.enumValues[number] } = {}
) {
  if (!ctx.entityId) throw new DomainValidationError("entityId is required");
  const entityId = await resolveEntityId(ctx.entityId);

  // Require broad crm.contact.read to view digitized files
  await authorize(ctx, "crm.contact.read", entityId);

  let conditions: SQL | undefined = eq(documents.entityId, entityId);
  if (filters.ownerContactId) {
    conditions = and(conditions, eq(documents.ownerContactId, filters.ownerContactId));
  }
  if (filters.type) {
    conditions = and(conditions, eq(documents.type, filters.type));
  }

  return db.select().from(documents).where(conditions).orderBy(desc(documents.createdAt));
}

export async function createDocument(
  ctx: CallerContext,
  input: {
    type: typeof documents.type.enumValues[number];
    title: string;
    fileUrl: string;
    ownerContactId?: string | null;
    metadata?: Record<string, unknown>;
  }
) {
  if (!ctx.entityId) throw new DomainValidationError("entityId is required");
  const entityId = await resolveEntityId(ctx.entityId);
  await authorize(ctx, "crm.contact.write", entityId);

  if (!input.title || !input.fileUrl) {
    throw new DomainValidationError("Document title and fileUrl are required.");
  }

  return db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(documents)
      .values({
        entityId,
        type: input.type,
        title: input.title,
        fileUrl: input.fileUrl,
        uploadedById: ctx.user.id,
        ownerContactId: input.ownerContactId ?? null,
        metadata: input.metadata ?? {},
      })
      .returning();

    await writeAudit(tx, ctx, {
      action: "documents.upload",
      associatedType: "document",
      associatedId: inserted.id,
      summary: `Uploaded and cataloged digitized document: ${inserted.title} (${inserted.type})`,
      entityId,
      before: null,
      after: inserted,
    });

    return inserted;
  });
}
