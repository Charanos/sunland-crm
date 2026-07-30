import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { jobRuns, serviceHealthChecks, settings } from "@/db/schema";
import { authorize } from "@/lib/authz/can";
import { writeAudit } from "@/lib/authz/audit";
import { DomainValidationError } from "@/lib/authz/errors";
import { resolveEntityId } from "@/lib/services/entity";
import type { CallerContext } from "@/lib/services/types";
import {
  JOB_REGISTRY,
  MAINTENANCE_MESSAGE_KEY,
  MAINTENANCE_MODE_KEY,
  MONITORED_SERVICES,
  type JobKey,
  type ServiceHealthStatus,
} from "@/components/sunland/oversight-constants";

/**
 * System operations behind the Oversight Console's System Administration
 * section (ADR 020).
 *
 * The honesty rule that shapes this whole file: there is no external uptime
 * monitor and no cron scheduler in this codebase. So health history is only
 * ever what this app itself recorded (a day with no probe reads as "no data",
 * never as green), and every job run is a real operator-triggered execution
 * rather than a scheduled one.
 */

// ── Maintenance mode ─────────────────────────────────────────────────────────

export async function getMaintenanceMode(entityIdOrSlug: string) {
  const entityId = await resolveEntityId(entityIdOrSlug);
  const rows = await db.select().from(settings).where(eq(settings.entityId, entityId));
  const flag = rows.find((r) => r.key === MAINTENANCE_MODE_KEY);
  const message = rows.find((r) => r.key === MAINTENANCE_MESSAGE_KEY);
  return {
    enabled: flag?.value === true,
    message: typeof message?.value === "string" ? message.value : "",
  };
}

/**
 * Toggling this genuinely gates the application - proxy.ts reads the same
 * settings row and routes non-super-admins to /maintenance. Every flip is
 * audited because it is an org-wide, user-visible outage.
 */
export async function setMaintenanceMode(
  ctx: CallerContext,
  entityIdOrSlug: string,
  input: { enabled: boolean; message?: string },
) {
  const entityId = await resolveEntityId(entityIdOrSlug);
  await authorize(ctx, "settings.entity.write", entityId);

  const before = await getMaintenanceMode(entityId);

  await db.transaction(async (tx) => {
    for (const [key, value] of [
      [MAINTENANCE_MODE_KEY, input.enabled],
      [MAINTENANCE_MESSAGE_KEY, input.message ?? before.message ?? ""],
    ] as Array<[string, unknown]>) {
      await tx
        .insert(settings)
        .values({ entityId, key, value })
        .onConflictDoUpdate({
          target: [settings.entityId, settings.key],
          set: { value, updatedAt: new Date() },
        });
    }

    await writeAudit(tx, ctx, {
      action: input.enabled ? "system.maintenance.enable" : "system.maintenance.disable",
      associatedType: "settings",
      associatedId: entityId,
      summary: `${ctx.user.name} turned maintenance mode ${input.enabled ? "ON" : "OFF"}`,
      entityId,
      before,
      after: { enabled: input.enabled, message: input.message ?? before.message },
    });
  });

  return getMaintenanceMode(entityId);
}

// ── Service health ───────────────────────────────────────────────────────────

const hasEnv = (v: string | undefined) => !!v && v.trim().length > 0;

/**
 * Measures each monitored service for real and records the result.
 *
 * "Real" differs per service and the detail string says which: the database is
 * genuinely round-tripped with a query, while the others are checked for
 * credential presence (we deliberately do not fire billable calls at M-Pesa on
 * every console load). A service with no credentials is `not_configured`,
 * never silently "healthy".
 */
export async function probeServiceHealth() {
  const results: Array<{ service: string; status: ServiceHealthStatus; latencyMs: number | null; detail: string }> = [];

  // Database - a real round-trip, timed.
  const dbStart = Date.now();
  try {
    await db.execute(sql`select 1`);
    const latency = Date.now() - dbStart;
    results.push({
      service: "database",
      // A round-trip this slow is genuinely degraded service, not an outage.
      status: latency > 2000 ? "degraded" : "healthy",
      latencyMs: latency,
      detail: `select 1 round-trip in ${latency}ms`,
    });
  } catch (err) {
    results.push({
      service: "database",
      status: "down",
      latencyMs: Date.now() - dbStart,
      detail: err instanceof Error ? err.message.slice(0, 200) : "Query failed",
    });
  }

  results.push({
    service: "realtime",
    status: hasEnv(process.env.ABLY_API_KEY) ? "healthy" : "not_configured",
    latencyMs: null,
    detail: hasEnv(process.env.ABLY_API_KEY)
      ? "API key present; live publish/subscribe enabled"
      : "ABLY_API_KEY not set - UI falls back to fetch-on-load",
  });

  const cacheReady = hasEnv(process.env.UPSTASH_REDIS_REST_URL) && hasEnv(process.env.UPSTASH_REDIS_REST_TOKEN);
  results.push({
    service: "cache",
    status: cacheReady ? "healthy" : "not_configured",
    latencyMs: null,
    detail: cacheReady ? "Rate limiting enforced" : "Not configured - limiter fails open",
  });

  const mpesaReady = hasEnv(process.env.MPESA_CONSUMER_KEY) && hasEnv(process.env.MPESA_CONSUMER_SECRET);
  results.push({
    service: "mpesa",
    status: mpesaReady ? "healthy" : "not_configured",
    latencyMs: null,
    detail: mpesaReady ? "Daraja credentials present" : "No live credentials - paybill is a scaffold (ADR H4)",
  });

  await db.insert(serviceHealthChecks).values(
    results.map((r) => ({
      service: r.service,
      status: r.status,
      latencyMs: r.latencyMs,
      detail: r.detail,
    })),
  );

  return results;
}

/**
 * Per-service history for the last `days` days. Buckets recorded checks by
 * calendar day and reduces each day to its worst observed status - a single
 * failure in a day should not be hidden by later successes.
 *
 * Days with no recorded check come back as `null`, which the UI renders as an
 * explicit gap. This is the whole point: absence of data is not uptime.
 */
export async function getServiceHealthHistory(days = 30) {
  const since = new Date(Date.now() - days * 86_400_000);
  const rows = await db
    .select()
    .from(serviceHealthChecks)
    .where(gte(serviceHealthChecks.checkedAt, since))
    .orderBy(desc(serviceHealthChecks.checkedAt));

  const dayKey = (d: Date) => d.toISOString().slice(0, 10);
  const severity: Record<ServiceHealthStatus, number> = { healthy: 0, not_configured: 1, degraded: 2, down: 3 };

  return MONITORED_SERVICES.map((svc) => {
    const mine = rows.filter((r) => r.service === svc.key);
    const latest = mine[0] ?? null;

    const byDay = new Map<string, ServiceHealthStatus>();
    for (const r of mine) {
      const key = dayKey(r.checkedAt);
      const current = byDay.get(key);
      const next = r.status as ServiceHealthStatus;
      if (!current || severity[next] > severity[current]) byDay.set(key, next);
    }

    const bars: Array<{ day: string; status: ServiceHealthStatus | null }> = [];
    for (let i = days - 1; i >= 0; i -= 1) {
      const key = dayKey(new Date(Date.now() - i * 86_400_000));
      bars.push({ day: key, status: byDay.get(key) ?? null });
    }

    // Uptime is computed over days we actually measured, and we report how
    // many those were so the figure can be read in context.
    const measured = bars.filter((b) => b.status !== null);
    const good = measured.filter((b) => b.status === "healthy").length;

    return {
      key: svc.key,
      name: svc.name,
      note: svc.note,
      status: (latest?.status ?? null) as ServiceHealthStatus | null,
      latencyMs: latest?.latencyMs ?? null,
      detail: latest?.detail ?? null,
      checkedAt: latest?.checkedAt?.toISOString() ?? null,
      bars,
      measuredDays: measured.length,
      uptimePct: measured.length > 0 ? Math.round((good / measured.length) * 100) : null,
    };
  });
}

// ── Background jobs ──────────────────────────────────────────────────────────

/** Registry entries joined to their real last run. */
export async function listJobs(ctx: CallerContext, entityIdOrSlug: string) {
  const entityId = await resolveEntityId(entityIdOrSlug);
  await authorize(ctx, "settings.entity.read", entityId);

  const runs = await db
    .select()
    .from(jobRuns)
    .where(eq(jobRuns.entityId, entityId))
    .orderBy(desc(jobRuns.startedAt))
    .limit(200);

  return JOB_REGISTRY.map((job) => {
    const last = runs.find((r) => r.jobKey === job.key) ?? null;
    return {
      key: job.key,
      name: job.name,
      desc: job.desc,
      lastStatus: last?.status ?? null,
      lastRunAt: last?.startedAt?.toISOString() ?? null,
      lastSummary: last?.summary ?? null,
      lastError: last?.error ?? null,
      durationMs: last?.finishedAt && last?.startedAt
        ? last.finishedAt.getTime() - last.startedAt.getTime()
        : null,
      runCount: runs.filter((r) => r.jobKey === job.key).length,
    };
  });
}

/**
 * Executes a registered job for real and records the run.
 *
 * The `job_runs` row is written OUTSIDE the job's own work rather than inside a
 * single transaction: a failed job must still leave a durable "failed" record
 * with its error, which a rolled-back transaction would erase.
 */
export async function runJob(ctx: CallerContext, entityIdOrSlug: string, jobKey: string) {
  const entityId = await resolveEntityId(entityIdOrSlug);
  await authorize(ctx, "settings.entity.write", entityId);

  const job = JOB_REGISTRY.find((j) => j.key === jobKey);
  if (!job) throw new DomainValidationError(`Unknown job "${jobKey}"`);

  const [run] = await db
    .insert(jobRuns)
    .values({ entityId, jobKey: job.key, status: "running", triggeredById: ctx.user.id })
    .returning();

  try {
    const summary = await executeJob(ctx, entityId, job.key as JobKey);

    const [finished] = await db
      .update(jobRuns)
      .set({ status: "success", finishedAt: new Date(), summary })
      .where(eq(jobRuns.id, run.id))
      .returning();

    await db.transaction(async (tx) => {
      await writeAudit(tx, ctx, {
        action: "system.job.run",
        associatedType: "job_run",
        associatedId: run.id,
        summary: `${ctx.user.name} ran "${job.name}" — ${summary}`,
        entityId,
        after: { jobKey: job.key, status: "success" },
      });
    });

    return finished;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Job failed";
    const [failed] = await db
      .update(jobRuns)
      .set({ status: "failed", finishedAt: new Date(), error: message.slice(0, 500) })
      .where(eq(jobRuns.id, run.id))
      .returning();
    return failed;
  }
}

/**
 * The actual work per job. Each branch calls a real service - nothing here is
 * a simulated delay or a canned success string.
 */
async function executeJob(ctx: CallerContext, entityId: string, key: JobKey): Promise<string> {
  switch (key) {
    case "health_probe": {
      const results = await probeServiceHealth();
      const healthy = results.filter((r) => r.status === "healthy").length;
      return `Probed ${results.length} services · ${healthy} healthy`;
    }
    case "pnl_snapshot": {
      const { generatePnLReport } = await import("@/lib/services/finance/reports");
      const now = new Date();
      const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const report = await generatePnLReport(ctx, {
        entityId,
        periodStart,
        periodEnd: now.toISOString(),
      });
      const token = (report as { verificationToken?: string }).verificationToken;
      return token ? `P&L export generated · token ${token}` : "P&L export generated";
    }
    case "remittance_run": {
      // Drafts advices for active mandates that have collected rent this
      // period. Reuses the real generator so every draft is a genuine,
      // QR-verifiable remittance_advices row.
      const { listMandates } = await import("@/lib/services/mandates");
      const { generateRemittanceAdvice } = await import("@/lib/services/finance/remittances");
      // listMandates scopes off ctx.entityId, not a filter argument - pass a
      // context pinned to the resolved entity rather than assuming the
      // caller's ctx already carries it.
      const mandates = await listMandates({ ...ctx, entityId }, { includeFinancials: true });
      const now = new Date();
      const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      let drafted = 0;
      let skipped = 0;
      for (const m of mandates as Array<{ id: string; status: string; currentPeriodCollected?: number }>) {
        if (m.status !== "active" || !m.currentPeriodCollected || m.currentPeriodCollected <= 0) {
          skipped += 1;
          continue;
        }
        try {
          await generateRemittanceAdvice(ctx, m.id, {
            entityId,
            periodStart,
            periodEnd: now.toISOString(),
          });
          drafted += 1;
        } catch {
          // A mandate with an existing pending advice is a legitimate skip,
          // not a job failure.
          skipped += 1;
        }
      }
      return `Drafted ${drafted} remittance advice(s) · ${skipped} skipped`;
    }
  }
}

/** Recent runs across all jobs, for the section's activity strip. */
export async function listRecentJobRuns(ctx: CallerContext, entityIdOrSlug: string, limit = 10) {
  const entityId = await resolveEntityId(entityIdOrSlug);
  await authorize(ctx, "settings.entity.read", entityId);

  return db
    .select()
    .from(jobRuns)
    .where(and(eq(jobRuns.entityId, entityId)))
    .orderBy(desc(jobRuns.startedAt))
    .limit(limit);
}
