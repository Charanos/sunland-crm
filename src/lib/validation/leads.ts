import { z } from "zod";

const pipelineStageSchema = z.enum([
  "inquiry",
  "qualification",
  "viewing",
  "offer",
  "negotiation",
  "closed_won",
  "closed_lost",
]);

const pipelineLeadPrioritySchema = z.enum(["low", "medium", "high"]);

// A lead names an existing contact (contactId) or captures a new prospect's
// details inline (displayName/email/phone) - createLead creates the contact
// row itself in the same transaction when contactId isn't given, same
// pattern as createContact in crm.ts. Exactly-one-of is enforced in the
// service, not here (mirrors createValuation's propertyId/externalName rule).
export const createLeadSchema = z.object({
  entityId: z.string().min(1),
  contactId: z.string().uuid().optional(),
  displayName: z.string().min(1).optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  propertyId: z.string().uuid().nullable().optional(),
  assignedToId: z.string().uuid().nullable().optional(),
  expectedValueKes: z.string().nullable().optional(),
  probability: z.coerce.number().int().min(0).max(100).optional(),
  priority: pipelineLeadPrioritySchema.optional(),
  source: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  nextActionAt: z.string().nullable().optional(),
});

export const updateLeadSchema = z.object({
  entityId: z.string().min(1),
  propertyId: z.string().uuid().nullable().optional(),
  assignedToId: z.string().uuid().nullable().optional(),
  expectedValueKes: z.string().nullable().optional(),
  probability: z.coerce.number().int().min(0).max(100).optional(),
  priority: pipelineLeadPrioritySchema.optional(),
  notes: z.string().nullable().optional(),
  nextActionAt: z.string().nullable().optional(),
});

export const transitionLeadStageSchema = z.object({
  entityId: z.string().min(1),
  stage: pipelineStageSchema,
  lostReason: z.string().nullable().optional(),
});

// Explicit action (not folded into updateLeadSchema) - see addLeadNote in leads.ts.
export const addLeadNoteSchema = z.object({
  entityId: z.string().min(1),
  text: z.string().min(1),
});
