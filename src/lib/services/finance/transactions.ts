import { randomBytes } from "crypto";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { contacts, properties, reportExports, transactions } from "@/db/schema";
import { authorize } from "@/lib/authz/can";
import { writeAudit } from "@/lib/authz/audit";
import { DomainValidationError } from "@/lib/authz/errors";
import { resolveEntityId } from "@/lib/services/entity";
import type { CallerContext } from "@/lib/services/types";
import { recordTransactionSchema } from "@/lib/validation/finance";
import { parseInput } from "@/lib/validation/parse";

function generateVerificationToken(): string {
  return randomBytes(24).toString("base64url");
}

/**
 * Routine transaction logging (rent collection, cheque deposit, etc.) -
 * distinct from the approvals-gated disbursement path in finance/approvals.ts,
 * which is for consequential/threshold-crossing money movements. Recording a
 * rent receipt additionally generates a QR-verifiable report_exports snapshot
 * (ERP spec §5.9) - this was a real, confirmed gap: the verification schema
 * and read endpoint existed with nothing anywhere writing to report_exports.
 */
export async function recordTransaction(ctx: CallerContext, rawInput: unknown) {
  const input = parseInput(recordTransactionSchema, rawInput);
  const entityId = await resolveEntityId(input.entityId);
  await authorize(ctx, "finance.transaction.write", entityId);

  return db.transaction(async (tx) => {
    const [transaction] = await tx
      .insert(transactions)
      .values({
        entityId,
        type: input.type,
        contactId: input.contactId,
        propertyId: input.propertyId,
        leaseId: input.leaseId,
        amountKes: input.amountKes.toString(),
        occurredAt: input.occurredAt ? new Date(input.occurredAt) : new Date(),
        recordedById: ctx.user.id,
        notes: input.notes,
      })
      .returning();

    let reportExport: typeof reportExports.$inferSelect | null = null;

    if (input.type === "rent") {
      const snapshot: Record<string, unknown> = {
        transactionId: transaction.id,
        type: transaction.type,
        amountKes: input.amountKes,
        occurredAt: (transaction.occurredAt instanceof Date ? transaction.occurredAt : new Date(transaction.occurredAt)).toISOString().split("T")[0],
        recordedBy: ctx.user.name,
      };

      if (input.contactId) {
        const [tenant] = await tx.select().from(contacts).where(eq(contacts.id, input.contactId)).limit(1);
        if (tenant) snapshot.tenant = tenant.displayName;
      }
      if (input.propertyId) {
        const [property] = await tx.select().from(properties).where(eq(properties.id, input.propertyId)).limit(1);
        if (property) snapshot.property = property.name;
      }

      [reportExport] = await tx
        .insert(reportExports)
        .values({
          entityId,
          reportType: "rent_receipt",
          generatedById: ctx.user.id,
          verificationToken: generateVerificationToken(),
          snapshot,
        })
        .returning();
    }

    await writeAudit(tx, ctx, {
      action: "finance.transaction.record",
      associatedType: "transaction",
      associatedId: transaction.id,
      summary: `${ctx.user.name} recorded a ${input.type} transaction of KES ${input.amountKes.toLocaleString()}`,
      entityId,
      after: transaction,
    });

    return { transaction, reportExport };
  });
}

export async function listTransactions(ctx: CallerContext, filters: { entityId?: string; leaseId?: string } = {}) {
  const entityIdParam = filters.entityId ?? ctx.entityId;
  if (!entityIdParam) throw new DomainValidationError("entityId is required");
  const entityId = await resolveEntityId(entityIdParam);
  await authorize(ctx, "finance.transaction.read", entityId);

  return db
    .select()
    .from(transactions)
    .where(and(eq(transactions.entityId, entityId), filters.leaseId ? eq(transactions.leaseId, filters.leaseId) : undefined))
    .orderBy(desc(transactions.occurredAt));
}
