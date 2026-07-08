import { z } from "zod";

export const createChannelSchema = z.object({
  entityId: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  participantUserIds: z.array(z.string().uuid()).default([]),
});

export const getOrCreateDmSchema = z.object({
  entityId: z.string().min(1),
  otherUserId: z.string().uuid(),
});

export const sendMessageSchema = z.object({
  content: z.string().min(1),
});
