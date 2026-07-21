import { z } from "zod";

// Accepts the DB's real 3-tier severity vocabulary plus the previous 4-tier
// low/normal/medium/high/critical values, so any stale caller keeps working.
// "urgent" used to alias to "critical" (there was no real middle tier); it's
// now a real, distinct value and passes through unchanged.
const priorityInput = z
  .enum(["routine", "urgent", "critical", "low", "normal", "medium", "high"])
  .transform((v) => (v === "low" || v === "normal" || v === "medium" ? "routine" : v === "high" ? "urgent" : v));

const categoryInput = z.enum(["reactive", "planned", "compliance"]);

const statusEnum = z.enum(["reported", "awaiting_approval", "scheduled", "in_progress", "done"]);

export const createMaintenanceRequestSchema = z.object({
  entityId: z.string().min(1),
  propertyId: z.string().uuid(),
  reportedByContactId: z.string().uuid().optional(),
  assignedContractorId: z.string().uuid().optional(),
  title: z.string().min(1),
  description: z.string().min(1),
  priority: priorityInput.default("routine"),
  category: categoryInput.default("reactive"),
  dueAt: z.string().nullable().optional(),
  // Optional at creation - when given, createMaintenanceRequest routes it
  // through the same real cost-approval-tier ladder submitMaintenanceCostForApproval uses.
  estimatedCostKes: z.number().positive().optional(),
});

export const updateMaintenanceRequestSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  priority: priorityInput.optional(),
  category: categoryInput.optional(),
  status: statusEnum.optional(),
  assignedContractorId: z.string().uuid().nullable().optional(),
  dueAt: z.string().nullable().optional(),
  estimatedCostKes: z.string().nullable().optional(),
  actualCostKes: z.string().nullable().optional(),
});

// Explicit action, not an implicit side-effect of a generic PATCH - see
// submitMaintenanceCostForApproval in maintenance.ts.
export const submitMaintenanceCostSchema = z.object({
  entityId: z.string().min(1),
  costKes: z.number().positive(),
});

// Explicit action - see scheduleMaintenanceVisit in maintenance.ts. Reused
// for both the initial booking and a reschedule (same shape either way).
export const scheduleMaintenanceVisitSchema = z.object({
  entityId: z.string().min(1),
  startsAt: z.string().min(1),
  endsAt: z.string().min(1),
  attendees: z
    .array(z.object({ name: z.string().min(1), email: z.string().email().optional(), userId: z.string().uuid().optional() }))
    .optional(),
});
