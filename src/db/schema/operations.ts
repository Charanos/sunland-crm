import { boolean, date, index, integer, jsonb, numeric, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { entities, timestamps, users } from "@/db/schema/platform";

export const projectDepartment = pgEnum("project_department", [
  "sales",
  "ops",
  "legal",
  "finance",
  "hr",
  "front_office",
]);

// Generic 5-state lifecycle rather than a bespoke enum per department - a
// progress bar (in_progress), a due-date-forward badge (planning/on_hold),
// and a review badge (awaiting_review) cover every real-world shape without
// inventing per-department status vocabularies.
export const projectStatus = pgEnum("project_status", [
  "planning",
  "in_progress",
  "awaiting_review",
  "on_hold",
  "completed",
]);

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    entityId: uuid("entity_id").references(() => entities.id).notNull(),
    title: text("title").notNull(),
    description: text("description"),
    department: projectDepartment("department").notNull(),
    status: projectStatus("status").default("planning").notNull(),
    progressPercent: integer("progress_percent"),
    assigneeIds: jsonb("assignee_ids").$type<string[]>().default([]),
    dueDate: date("due_date"),
    // Gantt/timeline needs a real span, not just an end date - the scheduler's
    // year planner and the Projects Board timeline both position bars from
    // startDate -> dueDate.
    startDate: date("start_date"),
    // A real checklist, persisted, so ticking a milestone on the board or in
    // the scheduler's focus card is a durable write rather than local state.
    milestones: jsonb("milestones").$type<Array<{ label: string; done: boolean }>>().default([]),
    // The kanban's "At Risk" column is a real, draggable-to state. Kept as a
    // flag beside `status` rather than a 6th status value so an at-risk
    // project is still legitimately "in progress" everywhere else.
    atRisk: boolean("at_risk").default(false).notNull(),
    budgetKes: numeric("budget_kes", { precision: 14, scale: 2 }),
    // Optional pointer to whatever the initiative is actually about (a
    // mandate, property, lease, lead) - resolved to a label + href client-side.
    linkedRecordType: text("linked_record_type"),
    linkedRecordId: uuid("linked_record_id"),
    createdById: uuid("created_by_id").references(() => users.id).notNull(),
    ...timestamps,
  },
  (table) => ({
    entityIdx: index("projects_entity_idx").on(table.entityId),
    departmentIdx: index("projects_department_idx").on(table.department),
    statusIdx: index("projects_status_idx").on(table.status),
  }),
);

// ─── Oversight Console: system operations (ADR 020) ──────────────────────────

export const serviceHealthStatus = pgEnum("service_health_status", [
  "healthy",
  "degraded",
  "down",
  "not_configured",
]);

/**
 * Recorded service-health history. Infrastructure is genuinely global, not
 * per-entity, so this table carries no entity_id (ADR 003's "unless it is
 * purely global configuration").
 *
 * Rows are written by a real probe - there is no external uptime monitor, so
 * the console's uptime bars plot only what this app actually recorded, and a
 * day with no row renders as "no data" rather than as green.
 */
export const serviceHealthChecks = pgTable(
  "service_health_checks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    service: text("service").notNull(),
    status: serviceHealthStatus("status").notNull(),
    latencyMs: integer("latency_ms"),
    detail: text("detail"),
    checkedAt: timestamp("checked_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    serviceCheckedIdx: index("service_health_checks_service_checked_idx").on(table.service, table.checkedAt),
  }),
);

export const jobRunStatus = pgEnum("job_run_status", ["running", "success", "failed"]);

/**
 * One row per actual execution of a registered background job. There is no
 * cron in this codebase, so every row here is a real, operator-triggered run
 * ("Run now") rather than a scheduled one - the console labels cadence
 * honestly as "manual - no scheduler configured".
 */
export const jobRuns = pgTable(
  "job_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    entityId: uuid("entity_id").references(() => entities.id).notNull(),
    jobKey: text("job_key").notNull(),
    status: jobRunStatus("status").default("running").notNull(),
    triggeredById: uuid("triggered_by_id").references(() => users.id).notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    summary: text("summary"),
    error: text("error"),
  },
  (table) => ({
    jobStartedIdx: index("job_runs_job_started_idx").on(table.jobKey, table.startedAt),
    entityIdx: index("job_runs_entity_idx").on(table.entityId),
  }),
);

export const reportCadence = pgEnum("report_cadence", ["daily", "weekly", "monthly", "quarterly"]);

/**
 * Persisted scheduling *intent* for a report. Real and editable, but with no
 * scheduler to execute it the console says so plainly and offers a "Run now"
 * that performs the real generation and stamps lastRunAt.
 */
export const reportSchedules = pgTable(
  "report_schedules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    entityId: uuid("entity_id").references(() => entities.id).notNull(),
    reportType: text("report_type").notNull(),
    cadence: reportCadence("cadence").default("monthly").notNull(),
    // Who the report is intended for. Stored as real user ids; actual delivery
    // waits on an email provider (none is configured).
    recipientIds: jsonb("recipient_ids").$type<string[]>().default([]),
    enabled: boolean("enabled").default(true).notNull(),
    lastRunAt: timestamp("last_run_at", { withTimezone: true }),
    createdById: uuid("created_by_id").references(() => users.id).notNull(),
    ...timestamps,
  },
  (table) => ({
    entityTypeIdx: index("report_schedules_entity_type_idx").on(table.entityId, table.reportType),
  }),
);
