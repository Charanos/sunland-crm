import { z } from "zod";

export const createApprovalRequestSchema = z.object({
  entityId: z.string().min(1),
  requestType: z.string().min(1),
  relatedTable: z.string().min(1),
  relatedId: z.string().uuid(),
  amountKes: z.number().nonnegative().optional(),
  requiredApproverRole: z.enum(["gm", "ceo", "department_head"]),
});

export const decideApprovalRequestSchema = z.object({
  requestId: z.string().uuid(),
  status: z.enum(["approved", "rejected"]),
  decisionNotes: z.string().optional(),
  // Set only when a higher-authority actor (e.g. CEO) is deciding a request
  // still pending at a lower tier (e.g. GM) - see decideApprovalRequest for
  // the audit/notification behavior this triggers.
  overrideNote: z.string().optional(),
});

export const recordTransactionSchema = z.object({
  entityId: z.string().min(1),
  type: z.enum(["rent", "commission", "valuation_fee", "expense", "deposit", "other"]),
  contactId: z.string().uuid().optional(),
  propertyId: z.string().uuid().optional(),
  leaseId: z.string().uuid().optional(),
  amountKes: z.number().positive(),
  occurredAt: z.string().optional(),
  notes: z.string().optional(),
});
