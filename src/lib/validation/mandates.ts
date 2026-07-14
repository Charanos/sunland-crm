import { z } from "zod";

// mandateRate/startDate/endDate travel as strings from the form, same
// rationale as valuations - explicit null handling in the service rather
// than z.coerce.date() silently turning null into 1970-01-01.
export const createMandateSchema = z.object({
  entityId: z.string().min(1),
  propertyId: z.string().uuid(),
  landlordContactId: z.string().uuid().optional(),
  mandateRate: z.string().optional(),
  rateJustification: z.string().optional(),
  unitCount: z.coerce.number().int().min(1).optional(),
  startDate: z.string().optional(),
  endDate: z.string().nullable().optional(),
  assignedPmId: z.string().uuid().nullable().optional(),
});

export const terminateMandateSchema = z.object({
  entityId: z.string().min(1),
  reason: z.string().optional(),
});

export const assignMandateManagerSchema = z.object({
  entityId: z.string().min(1),
  assignedPmId: z.string().uuid().nullable(),
});
