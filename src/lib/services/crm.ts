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
