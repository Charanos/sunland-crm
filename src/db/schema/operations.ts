import { boolean, date, index, integer, jsonb, numeric, pgEnum, pgTable, text, uuid } from "drizzle-orm/pg-core";
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
