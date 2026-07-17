import { randomBytes } from "crypto";
import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { db } from "@/db";
import { contacts, entities, properties, reportExports, transactions } from "@/db/schema";
import { authorize } from "@/lib/authz/can";
import { writeAudit } from "@/lib/authz/audit";
import { DomainValidationError, NotFoundError } from "@/lib/authz/errors";
import { computeExpenses, computeIncome, MANAGEMENT_FEE_RATE } from "@/lib/services/dashboard";
import { resolveEntityId } from "@/lib/services/entity";
import type { CallerContext } from "@/lib/services/types";
import { generatePnLReportSchema } from "@/lib/validation/finance";
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
