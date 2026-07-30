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
  type: z.enum(["rent", "commission", "valuation_fee", "expense", "deposit", "other", "agreement_fee", "sales_commission"]),
  contactId: z.string().uuid().optional(),
  propertyId: z.string().uuid().optional(),
  leaseId: z.string().uuid().optional(),
  amountKes: z.number().positive(),
  occurredAt: z.string().optional(),
  notes: z.string().optional(),
});

export const generateRemittanceSchema = z.object({
  periodStart: z.string().min(1),
  periodEnd: z.string().min(1),
});

export const generatePnLReportSchema = z.object({
  entityId: z.string().min(1).optional(),
  periodStart: z.string().min(1),
  periodEnd: z.string().min(1),
});

export const decideRemittanceSchema = z.object({
  action: z.enum(["release", "flag"]),
  reason: z.string().optional(),
});

/**
 * Bulk decision from the Oversight Console's queue. Each id is decided through
 * the same decideApprovalRequest path, so per-item side-effects and guards all
 * still apply - this only saves the operator N round-trips.
 */
export const bulkDecideApprovalsSchema = z.object({
  requestIds: z.array(z.string().uuid()).min(1).max(50),
  status: z.enum(["approved", "rejected"]),
  decisionNotes: z.string().optional(),
});

/**
 * Hand an approval to a different authority tier. Reuses the table's existing
 * self-referencing escalatedFromId rather than inventing a delegation model.
 */
export const delegateApprovalSchema = z.object({
  requestId: z.string().uuid(),
  toRole: z.enum(["gm", "ceo", "department_head"]),
  note: z.string().min(1, "A reason is required when delegating"),
});

/** Report delivery schedule. Real, editable intent - execution waits on a scheduler. */
export const upsertReportScheduleSchema = z.object({
  entityId: z.string().min(1),
  reportType: z.string().min(1),
  cadence: z.enum(["daily", "weekly", "monthly", "quarterly"]).default("monthly"),
  recipientIds: z.array(z.string().uuid()).default([]),
  enabled: z.boolean().default(true),
});
