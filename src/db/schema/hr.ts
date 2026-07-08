import { boolean, index, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { entities, timestamps, users } from "@/db/schema/platform";

export const complaintCategory = pgEnum("complaint_category", [
  "conduct",
  "harassment",
  "policy",
  "safety",
  "other",
]);

export const complaintStatus = pgEnum("complaint_status", ["open", "escalated", "resolved"]);

// The tier currently responsible for a complaint. Routing between these is
// hardcoded logic (HR spec §6.4), never a configurable RBAC permission, so a
// future change to the general permission matrix can't accidentally widen
// who sees a complaint.
export const complaintOwnerRole = pgEnum("complaint_owner_role", ["hr_head", "gm", "ceo"]);

export const complaints = pgTable(
  "complaints",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    entityId: uuid("entity_id").references(() => entities.id).notNull(),
    filedById: uuid("filed_by_id").references(() => users.id).notNull(),
    // Identity is always captured (filedById above) — this only controls
    // display-layer masking for anyone other than the current owner.
    isAnonymous: boolean("is_anonymous").default(false).notNull(),
    // The person the complaint is about, if any — drives the hardcoded
    // routing rule (HR spec §6.4). Null for complaints not naming anyone.
    namedPersonId: uuid("named_person_id").references(() => users.id),
    category: complaintCategory("category").default("other").notNull(),
    subject: text("subject").notNull(),
    description: text("description").notNull(),
    status: complaintStatus("status").default("open").notNull(),
    currentOwnerRole: complaintOwnerRole("current_owner_role").notNull(),
    escalatedAt: timestamp("escalated_at", { withTimezone: true }),
    escalatedById: uuid("escalated_by_id").references(() => users.id),
    escalationReason: text("escalation_reason"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolvedById: uuid("resolved_by_id").references(() => users.id),
    resolutionSummary: text("resolution_summary"),
    // Lightweight "Add Note" support (HR spec §8.8 drawer action) — a full
    // notes table is unwarranted for what's currently a short internal log.
    internalNotes: jsonb("internal_notes")
      .$type<Array<{ authorId: string; note: string; at: string }>>()
      .default([]),
    ...timestamps,
  },
  (table) => ({
    entityIdx: index("complaints_entity_idx").on(table.entityId),
    statusIdx: index("complaints_status_idx").on(table.status),
    ownerRoleIdx: index("complaints_owner_role_idx").on(table.currentOwnerRole),
    filedByIdx: index("complaints_filed_by_idx").on(table.filedById),
  }),
);
