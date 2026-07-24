import { z } from "zod";

const departmentSchema = z.enum(["sales", "ops", "legal", "finance", "hr", "front_office"]);
const statusSchema = z.enum(["planning", "in_progress", "awaiting_review", "on_hold", "completed"]);

const milestoneSchema = z.object({
  label: z.string().min(1),
  done: z.boolean().default(false),
});

export const createProjectSchema = z.object({
  entityId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  department: departmentSchema,
  status: statusSchema.default("planning"),
  progressPercent: z.number().int().min(0).max(100).optional(),
  assigneeIds: z.array(z.string().uuid()).default([]),
  dueDate: z.string().optional(),
  startDate: z.string().optional(),
  milestones: z.array(milestoneSchema).default([]),
  atRisk: z.boolean().default(false),
  budgetKes: z.number().nonnegative().optional(),
  linkedRecordType: z.string().min(1).optional(),
  linkedRecordId: z.string().uuid().optional(),
});

export const updateProjectSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  department: departmentSchema.optional(),
  status: statusSchema.optional(),
  progressPercent: z.number().int().min(0).max(100).nullable().optional(),
  assigneeIds: z.array(z.string().uuid()).optional(),
  dueDate: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
  milestones: z.array(milestoneSchema).optional(),
  atRisk: z.boolean().optional(),
  budgetKes: z.number().nonnegative().nullable().optional(),
  linkedRecordType: z.string().min(1).nullable().optional(),
  linkedRecordId: z.string().uuid().nullable().optional(),
});

/** Ticking a single milestone off the board/scheduler card - index into the stored array. */
export const toggleMilestoneSchema = z.object({
  index: z.number().int().min(0),
  done: z.boolean(),
});

/**
 * The kanban's four columns map onto (status, atRisk) rather than a 6th status
 * value, so a drag writes both together.
 */
export const setProjectBoardStateSchema = z.object({
  status: statusSchema.optional(),
  atRisk: z.boolean().optional(),
}).refine((v) => v.status !== undefined || v.atRisk !== undefined, {
  message: "Provide status, atRisk, or both",
});
