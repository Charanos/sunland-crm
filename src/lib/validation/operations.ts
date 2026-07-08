import { z } from "zod";

const departmentSchema = z.enum(["sales", "ops", "legal", "finance", "hr", "front_office"]);
const statusSchema = z.enum(["planning", "in_progress", "awaiting_review", "on_hold", "completed"]);

export const createProjectSchema = z.object({
  entityId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  department: departmentSchema,
  status: statusSchema.default("planning"),
  progressPercent: z.number().int().min(0).max(100).optional(),
  assigneeIds: z.array(z.string().uuid()).default([]),
  dueDate: z.string().optional(),
});

export const updateProjectSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  department: departmentSchema.optional(),
  status: statusSchema.optional(),
  progressPercent: z.number().int().min(0).max(100).nullable().optional(),
  assigneeIds: z.array(z.string().uuid()).optional(),
  dueDate: z.string().nullable().optional(),
});
