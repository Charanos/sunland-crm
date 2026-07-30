import { and, desc, eq, gte } from "drizzle-orm";
import { db } from "@/db";
import { approvalRequests, complaints, serviceHealthChecks, supportTickets } from "@/db/schema";
import { DomainValidationError } from "@/lib/authz/errors";
import { resolveEntityId } from "@/lib/services/entity";
import { getGroupSettingValue } from "@/lib/services/settings";
import type { CallerContext } from "@/lib/services/types";
import {
  CEO_APPROVAL_THRESHOLD_KEY,
  MONITORED_SERVICES,
  TICKET_SLA_DEFAULT_HOURS,
  TICKET_SLA_SETTING_KEYS,
  ticketSlaFor,
  type ServiceHealthStatus,
  type TicketPriority,
} from "@/components/sunland/oversight-constants";

/**
 * The four real cells behind the Oversight Console's pulse tier (ADR 020),
 * plus the per-tab counts the hub tabs badge themselves with.
 *
 * Deliberately permission-light: it reads only counts and aggregates the
 * caller can already reach through the individual section services, and each
 * of those services enforces its own gate when the section is actually opened.
 * Complaint counts are the one exception worth calling out - see below.
 */
export async function getOversightPulse(ctx: CallerContext, entityIdOrSlug?: string) {
  const rawEntityId = entityIdOrSlug ?? ctx.entityId;
  if (!rawEntityId) throw new DomainValidationError("entityId is required");
  const entityId = await resolveEntityId(rawEntityId);

  // Fetch then reduce in JS - the house convention, and necessary here anyway
  // because the ticket SLA is a derivation, not a column.
  const [approvalRows, complaintRows, ticketRows, healthRows, ceoThreshold] = await Promise.all([
    db.select().from(approvalRequests).where(eq(approvalRequests.entityId, entityId)),
    db.select().from(complaints).where(eq(complaints.entityId, entityId)),
    db.select().from(supportTickets).where(eq(supportTickets.entityId, entityId)),
    db
      .select()
      .from(serviceHealthChecks)
      .where(gte(serviceHealthChecks.checkedAt, new Date(Date.now() - 7 * 86_400_000)))
      .orderBy(desc(serviceHealthChecks.checkedAt)),
    getGroupSettingValue<number>(CEO_APPROVAL_THRESHOLD_KEY, 150_000),
  ]);

  // ── Approvals ──
  const pending = approvalRows.filter((a) => a.status === "pending");
  const pendingValue = pending.reduce((sum, a) => sum + Number(a.amountKes ?? 0), 0);
  const aboveThreshold = pending.filter((a) => Number(a.amountKes ?? 0) > ceoThreshold).length;

  // ── Complaints ──
  // Confidentiality (HR spec §6.4) is enforced inside complaints.ts when the
  // section is opened; the pulse deliberately exposes counts only - never a
  // title, filer, or category - so a number can't leak case content.
  const openComplaints = complaintRows.filter((c) => c.status !== "resolved");
  const escalated = complaintRows.filter((c) => c.status === "escalated").length;

  // ── Tickets ──
  const slaTargets = await resolveTicketSlaTargets();
  const openTickets = ticketRows.filter((t) => t.status === "open" || t.status === "in_progress");
  const breached = openTickets.filter((t) => {
    const sla = ticketSlaFor({
      priority: t.priority as TicketPriority,
      createdAt: t.createdAt,
      firstRespondedAt: t.firstRespondedAt,
      resolvedAt: t.resolvedAt,
      targetHours: slaTargets[t.priority as TicketPriority],
    });
    return sla.state === "breached";
  }).length;

  // ── System health ──
  // Scored over the services we actually measured in the last 7 days. With no
  // probe recorded yet the score is null, and the UI shows "not yet measured"
  // rather than a reassuring 100%.
  const latestByService = new Map<string, ServiceHealthStatus>();
  for (const row of healthRows) {
    if (!latestByService.has(row.service)) latestByService.set(row.service, row.status as ServiceHealthStatus);
  }
  const measured = MONITORED_SERVICES.filter((s) => latestByService.has(s.key));
  const healthy = measured.filter((s) => latestByService.get(s.key) === "healthy").length;
  const healthPct = measured.length > 0 ? Math.round((healthy / measured.length) * 100) : null;

  return {
    approvals: {
      pending: pending.length,
      pendingValueKes: pendingValue,
      aboveThreshold,
      thresholdKes: ceoThreshold,
    },
    complaints: {
      open: openComplaints.length,
      escalated,
      total: complaintRows.length,
    },
    tickets: {
      open: openTickets.length,
      breached,
      total: ticketRows.length,
    },
    system: {
      healthPct,
      measuredServices: measured.length,
      totalServices: MONITORED_SERVICES.length,
      degraded: measured.filter((s) => {
        const st = latestByService.get(s.key);
        return st === "degraded" || st === "down";
      }).length,
    },
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Per-priority first-response targets, real settings rows overriding the
 * documented defaults - "thresholds as data, never hardcoded" (backend master
 * §5.1), the same treatment the finance and maintenance thresholds get.
 */
export async function resolveTicketSlaTargets(): Promise<Record<TicketPriority, number>> {
  const entries = await Promise.all(
    (Object.keys(TICKET_SLA_SETTING_KEYS) as TicketPriority[]).map(async (priority) => {
      const value = await getGroupSettingValue<number>(
        TICKET_SLA_SETTING_KEYS[priority],
        TICKET_SLA_DEFAULT_HOURS[priority],
      );
      return [priority, Number(value) || TICKET_SLA_DEFAULT_HOURS[priority]] as const;
    }),
  );
  return Object.fromEntries(entries) as Record<TicketPriority, number>;
}

/** Lightweight per-tab badge counts, shared by the console's hub tabs. */
export async function getOversightCounts(ctx: CallerContext, entityIdOrSlug?: string) {
  const pulse = await getOversightPulse(ctx, entityIdOrSlug);
  return {
    approvals: pulse.approvals.pending,
    complaints: pulse.complaints.open,
    tickets: pulse.tickets.open,
    reports: 0,
    system: pulse.system.degraded,
  };
}

/** Recent decided approvals, for the queue's "recently decided" strip. */
export async function listRecentDecisions(ctx: CallerContext, entityIdOrSlug?: string, limit = 6) {
  const rawEntityId = entityIdOrSlug ?? ctx.entityId;
  if (!rawEntityId) throw new DomainValidationError("entityId is required");
  const entityId = await resolveEntityId(rawEntityId);

  return db
    .select()
    .from(approvalRequests)
    .where(and(eq(approvalRequests.entityId, entityId), eq(approvalRequests.status, "approved")))
    .orderBy(desc(approvalRequests.decidedAt))
    .limit(limit);
}
