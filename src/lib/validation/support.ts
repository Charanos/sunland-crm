import { z } from "zod";

const categorySchema = z.enum(["technical", "access", "data", "other"]);
const prioritySchema = z.enum(["low", "normal", "high", "critical"]);
const statusSchema = z.enum(["open", "in_progress", "resolved", "closed"]);
const channelSchema = z.enum(["portal", "email", "phone", "whatsapp"]);

export const createSupportTicketSchema = z.object({
  entityId: z.string().min(1),
  category: categorySchema.default("technical"),
  subject: z.string().min(1),
  description: z.string().min(1),
  priority: prioritySchema.default("normal"),
  // How the ticket actually reached the desk. "portal" is the honest default
  // for anything filed through the app itself; an admin logging a call or an
  // emailed request records that provenance instead.
  channel: channelSchema.default("portal"),
});

export const updateSupportTicketSchema = z.object({
  status: statusSchema.optional(),
  priority: prioritySchema.optional(),
  assignedToId: z.string().uuid().nullable().optional(),
  resolutionNotes: z.string().optional(),
});

/** A real reply on a ticket thread. Internal notes never notify the raiser. */
export const addTicketMessageSchema = z.object({
  body: z.string().min(1, "A message body is required"),
  isInternal: z.boolean().default(false),
});
