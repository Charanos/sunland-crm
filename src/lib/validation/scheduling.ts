import { z } from "zod";

const attendeeSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional(),
  userId: z.string().uuid().optional(),
});

const eventTypeSchema = z.enum(["internal", "external", "legal", "maintenance", "viewing"]);
const eventOutcomeSchema = z.enum(["pending", "completed", "deferred", "cancelled", "no_show"]);
// Mirrors RoleTier in components/sunland/account-constants.ts.
const roleTierSchema = z.enum(["superadmin", "admin", "manager", "finance", "agent", "viewer"]);

export const createCalendarEventSchema = z.object({
  entityId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  type: eventTypeSchema.default("internal"),
  startsAt: z.string(),
  endsAt: z.string(),
  location: z.string().optional(),
  attendees: z.array(attendeeSchema).optional(),
  projectId: z.string().uuid().optional(),
  contactId: z.string().uuid().optional(),
  leadId: z.string().uuid().optional(),
  isCritical: z.boolean().default(false),
  notifyRoleTiers: z.array(roleTierSchema).default([]),
});

export const updateCalendarEventSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  type: eventTypeSchema.optional(),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
  location: z.string().optional(),
  attendees: z.array(attendeeSchema).optional(),
  projectId: z.string().uuid().nullable().optional(),
  contactId: z.string().uuid().nullable().optional(),
  leadId: z.string().uuid().nullable().optional(),
  isCritical: z.boolean().optional(),
  notifyRoleTiers: z.array(roleTierSchema).optional(),
});

export const setEventOutcomeSchema = z.object({
  outcome: eventOutcomeSchema,
});

/** Re-notify the event's role tiers, optionally with added context. */
export const notifyEventSchema = z.object({
  note: z.string().max(500).optional(),
});
