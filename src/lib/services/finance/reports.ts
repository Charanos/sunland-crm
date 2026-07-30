import { randomBytes } from "crypto";
import { and, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { db } from "@/db";
import { contacts, entities, properties, reportExports, reportSchedules, transactions, users } from "@/db/schema";
import { authorize } from "@/lib/authz/can";
import { writeAudit } from "@/lib/authz/audit";
import { DomainValidationError, NotFoundError } from "@/lib/authz/errors";
import { computeExpenses, computeIncome, MANAGEMENT_FEE_RATE } from "@/lib/services/dashboard";
import { resolveEntityId } from "@/lib/services/entity";
import type { CallerContext } from "@/lib/services/types";
import { generatePnLReportSchema, upsertReportScheduleSchema } from "@/lib/validation/finance";
import { parseInput } from "@/lib/validation/parse";

function generateVerificationToken(): string {
  return randomBytes(24).toString("base64url");
}

/**
 * Real profit & loss statement, replacing the "Property Mandates Summary"
 * report type per the 2026-07-17 client call note (see
 * docs/SUNLAND_CLIENT_CALL_REQUIREMENTS_SPEC.md item 3). Reuses the exact
 * same computeIncome/computeExpenses logic that backs the CEO dashboard's
 * Total P&L card, so this document and that card can never silently diverge -
 * the whole point of this fix (docs/SUNLAND_FINANCE_LEDGER_ARCHITECTURE.md
 * §5.2) was to make that one figure trustworthy.
 */
export async function generatePnLReport(ctx: CallerContext, rawInput: unknown) {
  const input = parseInput(generatePnLReportSchema, rawInput);

  const entityId = await resolveEntityId(input.entityId || ctx.entityId || "group");
  await authorize(ctx, "finance.transaction.write", entityId);

  const [entity] = await db.select().from(entities).where(eq(entities.id, entityId)).limit(1);
  if (!entity) throw new NotFoundError("Entity not found");

  const periodStart = new Date(input.periodStart);
  const periodEnd = new Date(input.periodEnd);
  if (Number.isNaN(periodStart.getTime()) || Number.isNaN(periodEnd.getTime()) || periodStart >= periodEnd) {
    throw new DomainValidationError("Invalid report period - periodStart must be before periodEnd.");
  }

  const periodTx = await db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.entityId, entityId),
        gte(transactions.occurredAt, periodStart),
        lte(transactions.occurredAt, periodEnd),
      ),
    );

  // Revenue-by-stream breakdown - same per-type treatment as computeIncome,
  // just itemized instead of summed into one number.
  const managementFeeRevenue = periodTx.filter((t) => t.type === "rent").reduce((s, t) => s + Number(t.amountKes) * MANAGEMENT_FEE_RATE, 0);
  const commissionRevenue = periodTx.filter((t) => t.type === "commission").reduce((s, t) => s + Number(t.amountKes), 0);
  const valuationFeeRevenue = periodTx.filter((t) => t.type === "valuation_fee").reduce((s, t) => s + Number(t.amountKes), 0);
  const agreementFeeRevenue = periodTx.filter((t) => t.type === "agreement_fee").reduce((s, t) => s + Number(t.amountKes), 0);
  const salesCommissionRevenue = periodTx.filter((t) => t.type === "sales_commission").reduce((s, t) => s + Number(t.amountKes), 0);

  const totalRevenue = computeIncome(periodTx);
  const operatingExpenses = computeExpenses(periodTx);
  const netProfit = totalRevenue - operatingExpenses;

  return db.transaction(async (tx) => {
    const token = generateVerificationToken();

    const snapshot = {
      entityId,
      entityName: entity.name,
      periodStart: periodStart.toISOString().split("T")[0],
      periodEnd: periodEnd.toISOString().split("T")[0],
      revenueByStream: {
        managementFeeRevenue: Math.round(managementFeeRevenue),
        commissionRevenue: Math.round(commissionRevenue),
        valuationFeeRevenue: Math.round(valuationFeeRevenue),
        agreementFeeRevenue: Math.round(agreementFeeRevenue),
        salesCommissionRevenue: Math.round(salesCommissionRevenue),
      },
      totalRevenueKes: Math.round(totalRevenue),
      operatingExpensesKes: Math.round(operatingExpenses),
      netProfitKes: Math.round(netProfit),
      generatedBy: ctx.user.name,
    };

    const [report] = await tx
      .insert(reportExports)
      .values({
        entityId,
        reportType: "profit_and_loss",
        generatedById: ctx.user.id,
        verificationToken: token,
        snapshot,
      })
      .returning();

    await writeAudit(tx, ctx, {
      action: "finance.report.generate_pnl",
      associatedType: "report_export",
      associatedId: report.id,
      summary: `${ctx.user.name} generated a Profit & Loss Statement for ${entity.name} covering ${snapshot.periodStart} to ${snapshot.periodEnd} (net profit KES ${netProfit.toLocaleString()})`,
      entityId,
      before: null,
      after: report,
    });

    return report;
  });
}

const REVENUE_STREAM_LABELS = {
  management_fee: "Management Fees",
  commission: "Letting Commissions",
  valuation_fee: "Valuation Fees",
  agreement_fee: "Agreement Fees",
  sales_commission: "Sales Commissions",
} as const;

type RevenueStreamKey = keyof typeof REVENUE_STREAM_LABELS;

/**
 * Real revenue-by-stream breakdown with per-transaction drill-down, replacing
 * the hardcoded STREAM_DATA/REVENUE_DISTRIBUTION_DATA mocks on Finance
 * Overview (client call note item 5: "have a drop down of the revenue
 * streams, with the details available for each on clicking"). Same per-type
 * income treatment as computeIncome - the "Management Fees" stream shows the
 * 10% fee actually recognised on each rent transaction, not the raw rent
 * amount collected on the landlord's behalf.
 */
export async function getRevenueStreamBreakdown(ctx: CallerContext, entityIdOrSlug: string, periodStartRaw?: string, periodEndRaw?: string) {
  const entityId = await resolveEntityId(entityIdOrSlug || ctx.entityId || "group");
  await authorize(ctx, "finance.transaction.read", entityId);

  const now = new Date();
  const periodStart = periodStartRaw ? new Date(periodStartRaw) : new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = periodEndRaw ? new Date(periodEndRaw) : now;
  if (Number.isNaN(periodStart.getTime()) || Number.isNaN(periodEnd.getTime()) || periodStart >= periodEnd) {
    throw new DomainValidationError("Invalid period - periodStart must be before periodEnd.");
  }

  const periodTx = await db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.entityId, entityId),
        gte(transactions.occurredAt, periodStart),
        lte(transactions.occurredAt, periodEnd),
        inArray(transactions.type, ["rent", "commission", "valuation_fee", "agreement_fee", "sales_commission"]),
      ),
    );

  const contactIds = [...new Set(periodTx.map((t) => t.contactId).filter((id): id is string => !!id))];
  const propertyIds = [...new Set(periodTx.map((t) => t.propertyId).filter((id): id is string => !!id))];
  const [contactRows, propertyRows] = await Promise.all([
    contactIds.length ? db.select({ id: contacts.id, displayName: contacts.displayName }).from(contacts).where(inArray(contacts.id, contactIds)) : Promise.resolve([]),
    propertyIds.length ? db.select({ id: properties.id, name: properties.name }).from(properties).where(inArray(properties.id, propertyIds)) : Promise.resolve([]),
  ]);
  const contactNameById = new Map(contactRows.map((c) => [c.id, c.displayName]));
  const propertyNameById = new Map(propertyRows.map((p) => [p.id, p.name]));

  const streamKeyForType: Record<string, RevenueStreamKey> = {
    rent: "management_fee",
    commission: "commission",
    valuation_fee: "valuation_fee",
    agreement_fee: "agreement_fee",
    sales_commission: "sales_commission",
  };

  const streams = (Object.keys(REVENUE_STREAM_LABELS) as RevenueStreamKey[]).map((key) => {
    const rowsForStream = periodTx.filter((t) => streamKeyForType[t.type] === key);
    const detail = rowsForStream
      .map((t) => ({
        id: t.id,
        occurredAt: t.occurredAt.toISOString(),
        amountKes: Math.round(t.type === "rent" ? Number(t.amountKes) * MANAGEMENT_FEE_RATE : Number(t.amountKes)),
        counterparty: t.contactId ? (contactNameById.get(t.contactId) ?? null) : null,
        propertyName: t.propertyId ? (propertyNameById.get(t.propertyId) ?? null) : null,
        notes: t.notes,
      }))
      .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());

    return {
      key,
      label: REVENUE_STREAM_LABELS[key],
      totalKes: detail.reduce((s, d) => s + d.amountKes, 0),
      transactionCount: detail.length,
      transactions: detail,
    };
  });

  return {
    entityId,
    periodStart: periodStart.toISOString().split("T")[0],
    periodEnd: periodEnd.toISOString().split("T")[0],
    streams,
    totalRevenueKes: streams.reduce((s, st) => s + st.totalKes, 0),
  };
}

// ─── Report schedules (Oversight Console, ADR 020) ───────────────────────────
// Real, editable delivery intent. There is no scheduler in this codebase, so
// nothing here fires on its own - the console says so plainly and offers a
// "Run now" that performs the genuine generation below and stamps lastRunAt.

export async function listReportSchedules(ctx: CallerContext, entityIdOrSlug?: string) {
  const entityId = await resolveEntityId(entityIdOrSlug || ctx.entityId || "group");
  await authorize(ctx, "finance.transaction.read", entityId);

  return db
    .select()
    .from(reportSchedules)
    .where(eq(reportSchedules.entityId, entityId))
    .orderBy(reportSchedules.reportType);
}

/** One schedule per (entity, reportType) - toggling or re-cadencing updates in place. */
export async function upsertReportSchedule(ctx: CallerContext, rawInput: unknown) {
  const input = parseInput(upsertReportScheduleSchema, rawInput);
  const entityId = await resolveEntityId(input.entityId);
  await authorize(ctx, "finance.transaction.write", entityId);

  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(reportSchedules)
      .where(and(eq(reportSchedules.entityId, entityId), eq(reportSchedules.reportType, input.reportType)))
      .limit(1);

    const [saved] = existing
      ? await tx
        .update(reportSchedules)
        .set({
          cadence: input.cadence,
          recipientIds: input.recipientIds,
          enabled: input.enabled,
          updatedAt: new Date(),
        })
        .where(eq(reportSchedules.id, existing.id))
        .returning()
      : await tx
        .insert(reportSchedules)
        .values({
          entityId,
          reportType: input.reportType,
          cadence: input.cadence,
          recipientIds: input.recipientIds,
          enabled: input.enabled,
          createdById: ctx.user.id,
        })
        .returning();

    await writeAudit(tx, ctx, {
      action: "finance.report.schedule",
      associatedType: "report_schedule",
      associatedId: saved.id,
      summary: `${ctx.user.name} ${existing ? "updated" : "created"} the ${input.cadence} schedule for ${input.reportType} (${input.enabled ? "enabled" : "paused"})`,
      entityId,
      before: existing ?? null,
      after: saved,
    });

    return saved;
  });
}

/**
 * Runs a scheduled report immediately. This is a real generation - it produces
 * a genuine, QR-verifiable report_exports row through the same path the manual
 * button uses - and stamps lastRunAt so the console shows when it truly last
 * produced output.
 */
export async function runReportSchedule(ctx: CallerContext, scheduleId: string) {
  const [schedule] = await db.select().from(reportSchedules).where(eq(reportSchedules.id, scheduleId)).limit(1);
  if (!schedule) throw new NotFoundError("Report schedule not found");
  await authorize(ctx, "finance.transaction.write", schedule.entityId);

  if (schedule.reportType !== "pnl") {
    throw new DomainValidationError(`No generator exists for report type "${schedule.reportType}"`);
  }

  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const report = await generatePnLReport(ctx, {
    entityId: schedule.entityId,
    periodStart,
    periodEnd: now.toISOString(),
  });

  const [updated] = await db
    .update(reportSchedules)
    .set({ lastRunAt: new Date(), updatedAt: new Date() })
    .where(eq(reportSchedules.id, scheduleId))
    .returning();

  return { schedule: updated, report };
}

/** Recent verifiable exports for the console's "Recent exports" rail. */
export async function listRecentReportExports(ctx: CallerContext, entityIdOrSlug?: string, limit = 8) {
  const entityId = await resolveEntityId(entityIdOrSlug || ctx.entityId || "group");
  await authorize(ctx, "finance.transaction.read", entityId);

  return db
    .select({
      id: reportExports.id,
      reportType: reportExports.reportType,
      verificationToken: reportExports.verificationToken,
      generatedById: reportExports.generatedById,
      generatedByName: users.name,
      createdAt: reportExports.createdAt,
    })
    .from(reportExports)
    .innerJoin(users, eq(reportExports.generatedById, users.id))
    .where(eq(reportExports.entityId, entityId))
    .orderBy(desc(reportExports.createdAt))
    .limit(limit);
}
