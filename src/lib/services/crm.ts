import { eq, and, or, ilike, SQL } from "drizzle-orm";
import { db } from "@/db";
import { contacts } from "@/db/schema/crm";
import { authorize } from "@/lib/authz/can";
import { writeAudit } from "@/lib/authz/audit";
import { DomainValidationError, NotFoundError } from "@/lib/authz/errors";
import { resolveEntityId } from "@/lib/services/entity";
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
 * "Confirm Landlord" (ADR 014 §14.4) — records/edits the ID number and marks
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
