import { z } from "zod";

const categorySchema = z.enum(["technical", "access", "data", "other"]);
const prioritySchema = z.enum(["low", "normal", "high", "critical"]);
const statusSchema = z.enum(["open", "in_progress", "resolved", "closed"]);

export const createSupportTicketSchema = z.object({
  entityId: z.string().min(1),
  category: categorySchema.default("technical"),
  subject: z.string().min(1),
  description: z.string().min(1),
  priority: prioritySchema.default("normal"),
});

export const updateSupportTicketSchema = z.object({
  status: statusSchema.optional(),
  priority: prioritySchema.optional(),
  assignedToId: z.string().uuid().nullable().optional(),
  resolutionNotes: z.string().optional(),
});
