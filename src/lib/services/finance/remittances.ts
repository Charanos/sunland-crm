import { randomBytes } from "crypto";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import { db } from "@/db";
import { contacts, propertyMandates, properties, remittanceAdvices, reportExports, transactions } from "@/db/schema";
import { authorize } from "@/lib/authz/can";
import { writeAudit } from "@/lib/authz/audit";
import { DomainValidationError, NotFoundError } from "@/lib/authz/errors";
import type { CallerContext } from "@/lib/services/types";
import { appendSystemMessage, resolveUserIdsByTiers } from "@/lib/services/messaging";
import { decideRemittanceSchema, generateRemittanceSchema } from "@/lib/validation/finance";
import { parseInput } from "@/lib/validation/parse";

function generateVerificationToken(): string {
  return randomBytes(24).toString("base64url");
}

/**
 * Sums collected rent and approved expenses for the mandate's property within
 * a period, and derives the management fee from the mandate's own rate - the
 * same computation already built for getPropertyWithDetails's currentPeriod
 * block, applied over a caller-chosen period instead of "this month".
 */
export async function generateRemittanceAdvice(ctx: CallerContext, mandateId: string, rawInput: unknown) {
  const input = parseInput(generateRemittanceSchema, rawInput);

  const [mandate] = await db.select().from(propertyMandates).where(eq(propertyMandates.id, mandateId)).limit(1);
  if (!mandate) throw new NotFoundError("Mandate not found");

  await authorize(ctx, "finance.transaction.write", mandate.entityId);

  const periodStart = new Date(input.periodStart);
  const periodEnd = new Date(input.periodEnd);
  if (Number.isNaN(periodStart.getTime()) || Number.isNaN(periodEnd.getTime()) || periodStart >= periodEnd) {
    throw new DomainValidationError("Invalid remittance period - periodStart must be before periodEnd.");
  }

  const [property, landlord] = await Promise.all([
    db.select().from(properties).where(eq(properties.id, mandate.propertyId)).then((r) => r[0]),
    db.select().from(contacts).where(eq(contacts.id, mandate.landlordContactId)).then((r) => r[0]),
  ]);
  if (!property) throw new NotFoundError("Property not found");

  const periodTx = await db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.propertyId, mandate.propertyId),
        gte(transactions.occurredAt, periodStart),
        lte(transactions.occurredAt, periodEnd),
      ),
    );

  const collected = periodTx.filter((t) => t.type === "rent").reduce((sum, t) => sum + Number(t.amountKes), 0);
  const expenses = periodTx.filter((t) => t.type === "expense").reduce((sum, t) => sum + Number(t.amountKes), 0);
  const managementFee = collected * Number(mandate.mandateRate);
  const net = collected - managementFee - expenses;

  return db.transaction(async (tx) => {
    const token = generateVerificationToken();

    const [advice] = await tx
      .insert(remittanceAdvices)
      .values({
        entityId: mandate.entityId,
        mandateId,
        periodStart,
        periodEnd,
        collectedKes: collected.toFixed(2),
        managementFeeKes: managementFee.toFixed(2),
        expensesKes: expenses.toFixed(2),
        netRemittanceKes: net.toFixed(2),
        status: "pending",
        verificationToken: token,
        generatedById: ctx.user.id,
      })
      .returning();

    await tx.insert(reportExports).values({
      entityId: mandate.entityId,
      reportType: "remittance_advice",
      generatedById: ctx.user.id,
      verificationToken: token,
      snapshot: {
        remittanceAdviceId: advice.id,
        mandateId,
        property: property.name,
        landlord: landlord?.displayName ?? null,
        periodStart: periodStart.toISOString().split("T")[0],
        periodEnd: periodEnd.toISOString().split("T")[0],
        collectedKes: collected,
        managementFeeKes: managementFee,
        expensesKes: expenses,
        netRemittanceKes: net,
        generatedBy: ctx.user.name,
      },
    });

    await writeAudit(tx, ctx, {
      action: "finance.remittance.generate",
      associatedType: "remittance_advice",
      associatedId: advice.id,
      summary: `${ctx.user.name} generated a remittance advice for ${property.name} covering ${periodStart.toISOString().split("T")[0]} to ${periodEnd.toISOString().split("T")[0]} (net KES ${net.toLocaleString()})`,
      entityId: mandate.entityId,
      before: null,
      after: advice,
    });

    return advice;
  });
}

export async function listRemittancesForMandate(ctx: CallerContext, mandateId: string) {
  const [mandate] = await db.select().from(propertyMandates).where(eq(propertyMandates.id, mandateId)).limit(1);
  if (!mandate) throw new NotFoundError("Mandate not found");

  await authorize(ctx, "finance.transaction.read", mandate.entityId);

  return db
    .select()
    .from(remittanceAdvices)
    .where(eq(remittanceAdvices.mandateId, mandateId))
    .orderBy(desc(remittanceAdvices.periodEnd));
}

export async function decideRemittanceAdvice(ctx: CallerContext, remittanceId: string, rawInput: unknown) {
  const input = parseInput(decideRemittanceSchema, rawInput);

  const [existing] = await db.select().from(remittanceAdvices).where(eq(remittanceAdvices.id, remittanceId)).limit(1);
  if (!existing) throw new NotFoundError("Remittance advice not found");

  await authorize(ctx, "finance.transaction.write", existing.entityId);

  if (existing.status !== "pending") {
    throw new DomainValidationError("Only a pending remittance advice can be released or flagged.");
  }
  if (input.action === "flag" && !input.reason?.trim()) {
    throw new DomainValidationError("A reason is required to flag a remittance advice.");
  }

  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(remittanceAdvices)
      .set(
        input.action === "release"
          ? { status: "released", releasedById: ctx.user.id, releasedAt: new Date(), updatedAt: new Date() }
          : { status: "flagged", flagReason: input.reason!.trim(), updatedAt: new Date() },
      )
      .where(eq(remittanceAdvices.id, remittanceId))
      .returning();

    await writeAudit(tx, ctx, {
      action: input.action === "release" ? "finance.remittance.release" : "finance.remittance.flag",
      associatedType: "remittance_advice",
      associatedId: remittanceId,
      summary:
        input.action === "release"
          ? `${ctx.user.name} released a remittance payment of KES ${Number(existing.netRemittanceKes).toLocaleString()}`
          : `${ctx.user.name} flagged a remittance advice: ${input.reason!.trim()}`,
      entityId: existing.entityId,
      before: existing,
      after: updated,
    });

    // Real producer for the Messenger's "Ledger" system feed - the thread
    // exists because a payout actually released, not for display (ADR 019).
    if (input.action === "release") {
      const recipients = await resolveUserIdsByTiers(tx, ["superadmin", "admin", "finance"]);
      if (recipients.length > 0) {
        await appendSystemMessage(tx, ctx.user.id, {
          entityId: existing.entityId,
          feedName: "Ledger",
          content: `Remittance run RMT-${existing.id.slice(0, 6).toUpperCase()} released: KES ${Number(existing.netRemittanceKes).toLocaleString()} net to the landlord.`,
          recipientUserIds: recipients,
          linkedRecordType: "remittance_advice",
          linkedRecordId: existing.id,
          linkedRecordCode: `RMT-${existing.id.slice(0, 6).toUpperCase()}`,
        });
      }
    }

    return updated;
  });
}

// Internal helper reused by mandates.ts (Mandate File "remittance due" vitals
// tile and the register's per-row pending flag) - kept here since the
// service that owns the table also owns its non-list read shapes.
export async function getLatestPendingRemittance(mandateId: string) {
  const [row] = await db
    .select()
    .from(remittanceAdvices)
    .where(and(eq(remittanceAdvices.mandateId, mandateId), eq(remittanceAdvices.status, "pending")))
    .orderBy(desc(remittanceAdvices.createdAt))
    .limit(1);
  return row ?? null;
}
