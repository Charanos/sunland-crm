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
});
