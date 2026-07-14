import { and, desc, eq, gte } from "drizzle-orm";
import { db } from "@/db";
import {
  activityLogs,
  approvalRequests,
  leads,
  leases,
  maintenanceRequests,
  properties,
  settings,
  transactions,
  users,
} from "@/db/schema";
import { authorize } from "@/lib/authz/can";
import { resolveEntityId } from "@/lib/services/entity";
import type { CallerContext } from "@/lib/services/types";
import type { UserRole } from "@/types";

// Confirmed: docs/SUNLAND_FINANCE_LEDGER_ARCHITECTURE.md §6.1 - mandateRate
// defaults to 0.1000 (10%), management fee = collected x rate, never off
// expected rent. Real per-mandate rates land in P1/P2 (property_mandates);
// this is the correct interim assumption rather than treating gross rent
// collected as Sunland's own revenue (the exact mistake that doc calls out
// as the single most consequential error a property-management ledger can make).
const MANAGEMENT_FEE_RATE = 0.1;

// Approvals spec §4.1/§8.1: "Awaiting My Decision" is scoped to whichever
// step tier is the viewer's own - approval_requests.requiredApproverRole is
// one of gm/ceo/department_head, not a specific role, so every role maps to
// at most one tier. Roles with no tier (everyone below head-level) simply
// never have anything awaiting their decision on Overview.
const ROLE_APPROVAL_TIER: Partial<Record<UserRole, "ceo" | "gm" | "department_head">> = {
  ceo: "ceo",
  general_manager: "gm",
  finance_head: "department_head",
  hr_head: "department_head",
  front_office_head: "department_head",
};

type TransactionRow = typeof transactions.$inferSelect;
type LeadRow = typeof leads.$inferSelect;

function toNumber(value: string | null): number {
  if (!value) return 0;
  const n = parseFloat(value);
  return Number.isNaN(n) ? 0 : n;
}

/** Sunland's own earned revenue for a set of transactions - never gross rent collected. */
function computeIncome(rows: TransactionRow[]): number {
  return rows.reduce((sum, t) => {
    const amt = toNumber(t.amountKes);
    if (t.type === "rent") return sum + amt * MANAGEMENT_FEE_RATE;
    if (t.type === "commission" || t.type === "valuation_fee") return sum + amt;
    return sum; // deposit (liability) and expense/other never count as income
  }, 0);
}

function computeExpenses(rows: TransactionRow[]): number {
  return rows.filter((t) => t.type === "expense").reduce((sum, t) => sum + toNumber(t.amountKes), 0);
}

function percentChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function inRange<T extends { occurredAt: Date } | { createdAt: Date }>(
  rows: T[],
  field: "occurredAt" | "createdAt",
  start: Date,
  end?: Date,
): T[] {
  return rows.filter((r) => {
    const value = (r as unknown as Record<string, Date>)[field];
    return value >= start && (!end || value < end);
  });
}

export type ChartPeriod = "week" | "month" | "quarter";

type ChartPoint = { day: string; Revenue: number; Transactions: number; Leads: number };

function buildChartSeries(period: ChartPeriod, txns: TransactionRow[], leadRows: LeadRow[]): ChartPoint[] {
  const now = new Date();

  if (period === "week") {
    const points: ChartPoint[] = [];
    for (let i = 6; i >= 0; i--) {
      const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const nextDay = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1);
      const dayTxns = inRange(txns, "occurredAt", day, nextDay);
      const dayLeads = inRange(leadRows, "createdAt", day, nextDay);
      points.push({
        day: day.toLocaleDateString("en-KE", { weekday: "short" }),
        Revenue: computeIncome(dayTxns),
        Transactions: dayTxns.length,
        Leads: dayLeads.length,
      });
    }
    return points;
  }

  if (period === "month") {
    const points: ChartPoint[] = [];
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    let weekStart = startOfMonth;
    let weekNum = 1;
    while (weekStart <= now) {
      const weekEnd = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 7);
      const wTxns = inRange(txns, "occurredAt", weekStart, weekEnd);
      const wLeads = inRange(leadRows, "createdAt", weekStart, weekEnd);
      points.push({
        day: `Week ${weekNum}`,
        Revenue: computeIncome(wTxns),
        Transactions: wTxns.length,
        Leads: wLeads.length,
      });
      weekStart = weekEnd;
      weekNum++;
    }
    return points;
  }

  // quarter: last 3 months, bucketed by month
  const points: ChartPoint[] = [];
  for (let i = 2; i >= 0; i--) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const mTxns = inRange(txns, "occurredAt", monthStart, monthEnd);
    const mLeads = inRange(leadRows, "createdAt", monthStart, monthEnd);
    points.push({
      day: monthStart.toLocaleDateString("en-KE", { month: "short" }),
      Revenue: computeIncome(mTxns),
      Transactions: mTxns.length,
      Leads: mLeads.length,
    });
  }
  return points;
}

export async function getDashboardOverview(ctx: CallerContext, period: ChartPeriod = "week") {
  const entityId = await resolveEntityId(ctx.entityId || "group");
  await authorize(ctx, "properties.property.read", entityId);

  const now = new Date();
  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const startOfThisWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
  const lookback = new Date(now.getFullYear(), now.getMonth() - 3, 1); // covers quarter charting + mom trends

  const [allProperties, recentTransactions, allLeads, recentLogs, allMaintenanceRequests, allLeases] =
    await Promise.all([
      db.select().from(properties).where(eq(properties.entityId, entityId)),
      db
        .select()
        .from(transactions)
        .where(and(eq(transactions.entityId, entityId), gte(transactions.occurredAt, lookback))),
      db.select().from(leads).where(eq(leads.entityId, entityId)),
      db
        .select()
        .from(activityLogs)
        .where(eq(activityLogs.entityId, entityId))
        .orderBy(desc(activityLogs.createdAt))
        .limit(8),
      db.select().from(maintenanceRequests).where(eq(maintenanceRequests.entityId, entityId)),
      db.select().from(leases).where(eq(leases.entityId, entityId)),
    ]);

  // ── Portfolio ──
  const totalProperties = allProperties.length;
  const occupiedProperties = allProperties.filter((p) => p.status === "occupied").length;
  const occupancyRate = totalProperties > 0 ? Math.round((occupiedProperties / totalProperties) * 100) : 0;
  const propertiesThisMonth = allProperties.filter((p) => p.createdAt >= startOfThisMonth).length;
  const propertiesLastMonth = allProperties.filter(
    (p) => p.createdAt >= startOfLastMonth && p.createdAt < startOfThisMonth,
  ).length;
  const totalPropertiesTrend = percentChange(propertiesThisMonth, propertiesLastMonth);

  let rentPool = 0;
  for (const p of allProperties) rentPool += toNumber(p.monthlyRentKes);

  // ── Revenue (real, management-fee-aware - never gross rent collected) ──
  const txnsThisMonth = inRange(recentTransactions, "occurredAt", startOfThisMonth);
  const txnsLastMonth = inRange(recentTransactions, "occurredAt", startOfLastMonth, startOfThisMonth);
  const incomeThisMonth = computeIncome(txnsThisMonth);
  const incomeLastMonth = computeIncome(txnsLastMonth);
  const expensesThisMonth = computeExpenses(txnsThisMonth);
  const expensesLastMonth = computeExpenses(txnsLastMonth);
  const profitThisMonth = incomeThisMonth - expensesThisMonth;
  const profitLastMonth = incomeLastMonth - expensesLastMonth;

  // ── CRM / Pipeline (leads) ──
  const closedWon = allLeads.filter((l) => l.stage === "closed_won");
  const closedWonThisMonth = closedWon.filter((l) => l.closedAt && l.closedAt >= startOfThisMonth);
  const closedWonLastMonth = closedWon.filter(
    (l) => l.closedAt && l.closedAt >= startOfLastMonth && l.closedAt < startOfThisMonth,
  );
  const activePipeline = allLeads.filter((l) => l.stage !== "closed_won" && l.stage !== "closed_lost");
  const newLeadsThisMonth = allLeads.filter((l) => l.createdAt >= startOfThisMonth);
  const newLeadsLastMonth = allLeads.filter(
    (l) => l.createdAt >= startOfLastMonth && l.createdAt < startOfThisMonth,
  );
  const propertyInquiriesThisWeek = allLeads.filter((l) => l.createdAt >= startOfThisWeek);
  const conversionRate = allLeads.length > 0 ? Math.round((closedWon.length / allLeads.length) * 1000) / 10 : 0;

  // ── Department stats (Internal Structure & Scheduler panel) ──
  // Real, relevant counts tied to what each card actually links to - not
  // literal headcounts, since no HR employee/headcount table exists yet:
  // Sales -> active pipeline, Ops -> open maintenance work, Legal -> active leases.
  const openMaintenanceCount = allMaintenanceRequests.filter((m) =>
    ["open", "assigned", "in_progress"].includes(m.status),
  ).length;
  const activeLeaseCount = allLeases.filter((l) => l.isActive).length;
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const expiringLeases30d = allLeases.filter((l) => l.isActive && l.endsAt >= now && l.endsAt <= in30Days).length;
  const departmentStats = {
    sales: activePipeline.length,
    ops: openMaintenanceCount,
    legal: activeLeaseCount,
  };

  // ── Awaiting My Decision (spec §8.1) - pending approvals at the viewer's own tier ──
  const approvalTier = ROLE_APPROVAL_TIER[ctx.user.role as UserRole];
  let awaitingMyDecision: {
    count: number;
    items: Array<{ id: string; requestType: string; amountKes: number | null; requestedAt: Date; relatedTable: string }>;
  } = { count: 0, items: [] };

  if (approvalTier) {
    const pendingForTier = await db
      .select()
      .from(approvalRequests)
      .where(
        and(
          eq(approvalRequests.entityId, entityId),
          eq(approvalRequests.status, "pending"),
          eq(approvalRequests.requiredApproverRole, approvalTier),
        ),
      )
      .orderBy(approvalRequests.requestedAt);

    awaitingMyDecision = {
      count: pendingForTier.length,
      items: pendingForTier.slice(0, 3).map((r) => ({
        id: r.id,
        requestType: r.requestType,
        amountKes: r.amountKes ? toNumber(r.amountKes) : null,
        requestedAt: r.requestedAt,
        relatedTable: r.relatedTable,
      })),
    };
  }

  // ── System Health (spec §8.1/§4.1 - CEO-only, absent for GM and everyone else) ──
  let systemHealth: { activeUserCount: number; lastThresholdChangeAt: Date | null } | null = null;
  if (ctx.user.role === "ceo") {
    const [activeUsers, allSettings] = await Promise.all([
      db.select().from(users).where(eq(users.isActive, true)),
      db.select().from(settings),
    ]);
    const lastThresholdChangeAt = allSettings.reduce<Date | null>(
      (latest, s) => (!latest || s.updatedAt > latest ? s.updatedAt : latest),
      null,
    );
    systemHealth = { activeUserCount: activeUsers.length, lastThresholdChangeAt };
  }

  return {
    // Portfolio
    totalProperties,
    totalPropertiesTrend,
    occupancyRate,
    occupiedProperties,
    rentPool,
    expiringLeases30d,

    // Revenue (management-fee-aware)
    incomeKes: Math.round(incomeThisMonth),
    incomeTrend: percentChange(incomeThisMonth, incomeLastMonth),
    expensesKes: Math.round(expensesThisMonth),
    expensesTrend: percentChange(expensesThisMonth, expensesLastMonth),
    profitKes: Math.round(profitThisMonth),
    profitTrend: percentChange(profitThisMonth, profitLastMonth),

    // CRM / Pipeline
    closedDealsCount: closedWon.length,
    closedDealsTrend: percentChange(closedWonThisMonth.length, closedWonLastMonth.length),
    activePipelineCount: activePipeline.length,
    newLeadsCount: newLeadsThisMonth.length,
    newLeadsTrend: percentChange(newLeadsThisMonth.length, newLeadsLastMonth.length),
    propertyInquiriesCount: propertyInquiriesThisWeek.length,
    conversionRate,

    // Approvals / Administration (spec §8.1)
    awaitingMyDecision,
    systemHealth,
    departmentStats,

    // Chart
    chartSeries: buildChartSeries(period, recentTransactions, allLeads),

    // Listings + activity (unchanged shape, real image now sourced from media)
    recentListings: [...allProperties]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 10)
      .map((p) => {
        let status: "Available" | "Occupied" | "Under Offer" | "Sold" = "Available";
        if (p.status === "occupied") status = "Occupied";
        else if (p.status === "under_offer") status = "Under Offer";
        else if (p.status === "off_market") status = "Sold";

        let priceStr = "N/A";
        if (p.monthlyRentKes) priceStr = `KES ${parseFloat(p.monthlyRentKes).toLocaleString()} / mo`;
        else if (p.askingPriceKes) priceStr = `KES ${parseFloat(p.askingPriceKes).toLocaleString()}`;

        const media = p.media as Array<{ url: string; alt?: string }> | null;

        return {
          id: p.id,
          name: p.name,
          location: p.location,
          type: p.propertyType,
          status,
          roi: "N/A",
          price: priceStr,
          imageUrl: media?.[0]?.url ?? null,
        };
      }),
    activityLogs: recentLogs.map((l) => {
      let type: "call" | "viewing" | "payment" | "update" | "system" = "system";
      let icon: "phone" | "eye" | "receipt" | "edit" | "activity" = "activity";

      const act = l.action.toLowerCase();
      if (act.includes("contact")) {
        type = "call";
        icon = "phone";
      } else if (act.includes("document")) {
        type = "viewing";
        icon = "eye";
      } else if (act.includes("transaction") || act.includes("payment")) {
        type = "payment";
        icon = "receipt";
      } else if (act.includes("update") || act.includes("edit")) {
        type = "update";
        icon = "edit";
      }

      const minutes = Math.floor((Date.now() - new Date(l.createdAt).getTime()) / 60000);
      let time = "Just now";
      if (minutes > 0 && minutes < 60) time = `${minutes} min ago`;
      else if (minutes >= 60 && minutes < 1440) {
        const hours = Math.floor(minutes / 60);
        time = `${hours} hour${hours > 1 ? "s" : ""} ago`;
      } else if (minutes >= 1440) {
        const days = Math.floor(minutes / 1440);
        time = days === 1 ? "Yesterday" : `${days} days ago`;
      }

      return { id: l.id, time, text: l.summary, type, icon };
    }),
  };
}
