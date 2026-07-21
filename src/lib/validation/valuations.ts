import { z } from "zod";

export const valuationStageSchema = z.enum([
  "requested",
  "site_visit",
  "valued",
  "offer_sent",
  "accepted",
  "mandate_signed",
  "declined",
]);

const comparableSchema = z.object({
  name: z.string().min(1),
  pricePerSqft: z.number(),
  adjustmentPct: z.number(),
  adjustedValueKes: z.number(),
});

// Dates arrive as datetime-local strings from the form - kept as strings here
// and converted with explicit null handling in the service, since
// z.coerce.date() turns null into 1970-01-01 silently.
export const createValuationSchema = z.object({
  entityId: z.string().min(1),
  propertyId: z.string().uuid().optional(),
  externalPropertyName: z.string().min(1).optional(),
  externalLocation: z.string().optional(),
  landlordContactId: z.string().uuid().optional(),
  assignedManagerId: z.string().uuid().optional(),
  valuerId: z.string().uuid().optional(),
  externalValuerName: z.string().optional(),
  isLand: z.boolean().default(false),
  siteVisitAt: z.string().optional(),
  notes: z.string().optional(),
});

// Descriptive-field edits only - stage never travels through here.
// transitionValuationStage()/submitValuation()/signMandateFromValuation()
// are the only paths that change `stage`, so canMoveToStage() can never be
// bypassed by a generic PATCH.
export const updateValuationSchema = z.object({
  propertyId: z.string().uuid().nullable().optional(),
  externalPropertyName: z.string().nullable().optional(),
  externalLocation: z.string().nullable().optional(),
  landlordContactId: z.string().uuid().nullable().optional(),
  assignedManagerId: z.string().uuid().nullable().optional(),
  valuerId: z.string().uuid().nullable().optional(),
  externalValuerName: z.string().nullable().optional(),
  isLand: z.boolean().optional(),
  marketValueKes: z.string().nullable().optional(),
  proposedFeeRate: z.string().nullable().optional(),
  methodology: z.string().nullable().optional(),
  siteVisitAt: z.string().nullable().optional(),
  validUntil: z.string().nullable().optional(),
  reportUrl: z.string().url().nullable().optional(),
  notes: z.string().nullable().optional(),
  isFeatured: z.boolean().optional(),
});

// site_visit -> valued transition: captures the real assessed value/fee/
// methodology/comparables a valuer submits, in the same call that advances
// the stage - mirrors the old ValuationCompleteModal's "capture then
// transition" shape.
export const submitValuationSchema = z.object({
  marketValueKes: z.string().min(1),
  proposedFeeRate: z.string().min(1),
  methodology: z.string().optional(),
  comparables: z.array(comparableSchema).optional(),
});

// Generic stage-transition endpoint (kanban drag, detail-page action
// buttons, decline/reopen) - canMoveToStage() in the service is the single
// place adjacency is actually enforced.
export const transitionStageSchema = z.object({
  stage: valuationStageSchema,
});
