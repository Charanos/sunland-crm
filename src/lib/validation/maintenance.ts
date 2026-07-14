import { z } from "zod";

// Accepts the DB enum values plus the two aliases the original inline route
// established ("medium"→"normal", "urgent"→"critical") - kept for backward
// compatibility with any caller still sending the old vocabulary.
const priorityInput = z
  .enum(["low", "normal", "medium", "high", "critical", "urgent"])
  .transform((v) => (v === "medium" ? "normal" : v === "urgent" ? "critical" : v));

const statusEnum = z.enum(["open", "assigned", "in_progress", "resolved", "closed"]);

export const createMaintenanceRequestSchema = z.object({
  entityId: z.string().min(1),
  propertyId: z.string().uuid(),
  reportedByContactId: z.string().uuid().optional(),
  assignedContractorId: z.string().uuid().optional(),
  title: z.string().min(1),
  description: z.string().min(1),
  priority: priorityInput.default("normal"),
  dueAt: z.string().nullable().optional(),
});

export const updateMaintenanceRequestSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  priority: priorityInput.optional(),
  status: statusEnum.optional(),
  assignedContractorId: z.string().uuid().nullable().optional(),
  dueAt: z.string().nullable().optional(),
});
