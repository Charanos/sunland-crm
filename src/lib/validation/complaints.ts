import { z } from "zod";

const categorySchema = z.enum(["conduct", "harassment", "policy", "safety", "other"]);

export const createComplaintSchema = z.object({
  entityId: z.string().min(1),
  namedPersonId: z.string().uuid().optional(),
  category: categorySchema.default("other"),
  subject: z.string().min(1),
  description: z.string().min(1),
  isAnonymous: z.boolean().default(false),
});

export const escalateComplaintSchema = z.object({
  reason: z.string().min(1),
});

export const resolveComplaintSchema = z.object({
  resolutionSummary: z.string().min(1),
});

export const addComplaintNoteSchema = z.object({
  note: z.string().min(1),
});
