import { eq, and, desc } from "drizzle-orm";
import { db } from "@/db";
import { properties, leases, documents, reportExports } from "@/db/schema";
import { authorize } from "@/lib/authz/can";
import { writeAudit } from "@/lib/authz/audit";
import { DomainValidationError, NotFoundError } from "@/lib/authz/errors";
import type { CallerContext } from "@/lib/services/types";

// ─── Properties ──────────────────────────────────────────────────────────────

export async function listProperties(
  ctx: CallerContext,
  filters: { ownerContactId?: string } = {}
) {
  const entityId = ctx.entityId;
  if (!entityId) throw new DomainValidationError("entityId is required");
  await authorize(ctx, "properties.property.read", entityId);

  let conditions = eq(properties.entityId, entityId);
  if (filters.ownerContactId) {
    conditions = and(conditions, eq(properties.ownerContactId, filters.ownerContactId)) as any;
  }

  return db.select().from(properties).where(conditions);
}

export async function createProperty(
  ctx: CallerContext,
  input: {
    propertyCode: string;
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
  }
) {
  const entityId = ctx.entityId;
  if (!entityId) throw new DomainValidationError("entityId is required");
  await authorize(ctx, "properties.property.write", entityId);

  if (!input.propertyCode || !input.name || !input.propertyType || !input.listingType || !input.location) {
    throw new DomainValidationError("Code, name, type, listing type, and location are required.");
  }

  return db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(properties)
      .values({
        entityId,
        propertyCode: input.propertyCode,
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

// ─── Leases ──────────────────────────────────────────────────────────────────

export async function listLeases(ctx: CallerContext) {
  const entityId = ctx.entityId;
  if (!entityId) throw new DomainValidationError("entityId is required");
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
  const entityId = ctx.entityId;
  if (!entityId) throw new DomainValidationError("entityId is required");
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

    // 3. Flip unit status to occupied
    const [updatedProp] = await tx
      .update(properties)
      .set({ status: "occupied" })
      .where(eq(properties.id, input.propertyId))
      .returning();

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
  const entityId = ctx.entityId;
  if (!entityId) throw new DomainValidationError("entityId is required");

  // Require broad crm.contact.read to view digitized files
  await authorize(ctx, "crm.contact.read", entityId);

  let conditions = eq(documents.entityId, entityId);
  if (filters.ownerContactId) {
    conditions = and(conditions, eq(documents.ownerContactId, filters.ownerContactId)) as any;
  }
  if (filters.type) {
    conditions = and(conditions, eq(documents.type, filters.type)) as any;
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
  const entityId = ctx.entityId;
  if (!entityId) throw new DomainValidationError("entityId is required");
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
