import { z } from "zod";

export const upsertSettingSchema = z.object({
  entityId: z.string().uuid(),
  key: z.string().min(1),
  value: z.unknown(),
  description: z.string().optional(),
});
