import { z } from "zod";

const valuationTypeSchema = z.enum([
  "market",
  "mortgage_security",
  "insurance",
  "rental_assessment",
  "land",
]);

const valuationStatusSchema = z.enum([
  "requested",
  "scheduled",
  "in_progress",
  "report_draft",
  "completed",
  "cancelled",
]);

// Dates arrive as datetime-local strings from the form - kept as strings here
// and converted with explicit null handling in the service, since
// z.coerce.date() turns null into 1970-01-01 silently.
export const createValuationSchema = z.object({
  entityId: z.string().min(1),
  propertyId: z.string().uuid().optional(),
  externalPropertyName: z.string().min(1).optional(),
  externalLocation: z.string().optional(),
  clientContactId: z.string().uuid().optional(),
  valuerId: z.string().uuid().optional(),
  type: valuationTypeSchema.default("market"),
  purpose: z.string().optional(),
  feeKes: z.string().optional(),
  siteVisitAt: z.string().optional(),
  notes: z.string().optional(),
});

export const updateValuationSchema = z.object({
  propertyId: z.string().uuid().nullable().optional(),
  externalPropertyName: z.string().nullable().optional(),
  externalLocation: z.string().nullable().optional(),
  clientContactId: z.string().uuid().nullable().optional(),
  valuerId: z.string().uuid().nullable().optional(),
  type: valuationTypeSchema.optional(),
  purpose: z.string().nullable().optional(),
  status: valuationStatusSchema.optional(),
  marketValueKes: z.string().nullable().optional(),
  forcedSaleValueKes: z.string().nullable().optional(),
  insuranceValueKes: z.string().nullable().optional(),
  feeKes: z.string().nullable().optional(),
  feePaid: z.boolean().optional(),
  siteVisitAt: z.string().nullable().optional(),
  validUntil: z.string().nullable().optional(),
  reportUrl: z.string().url().nullable().optional(),
  notes: z.string().nullable().optional(),
});
