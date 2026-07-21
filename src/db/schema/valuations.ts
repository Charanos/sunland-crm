import {
  boolean,
  index,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { entities, timestamps, users } from "@/db/schema/platform";
import { contacts } from "@/db/schema/crm";
import { properties } from "@/db/schema/properties";
import { propertyMandates } from "@/db/schema/mandates";

// New-mandate acquisition funnel (2026-07-17 repurpose, per client call note
// item on the Valuations page): a property manager scouts and values a
// prospect, Front Office sends the landlord a management offer, and
// acceptance becomes a real property_mandates row. "Declined" is reachable
// from any non-terminal stage; a declined prospect can only be re-opened
// back to "valued" or "requested" - see canMoveToStage() in
// src/lib/services/valuations.ts, the single place this adjacency rule is
// enforced (server-side, not just a frontend convenience ladder).
export const valuationStage = pgEnum("valuation_stage", [
  "requested",
  "site_visit",
  "valued",
  "offer_sent",
  "accepted",
  "mandate_signed",
  "declined",
]);

export const valuations = pgTable(
  "valuations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    entityId: uuid("entity_id").references(() => entities.id).notNull(),
    valuationCode: text("valuation_code").notNull(),
    // Either a portfolio property or an external (prospect, not yet onboarded)
    // subject. Exactly one of the two is required, enforced in the service
    // layer. signMandateFromValuation() creates a real properties row from
    // the external fields the moment a mandate is actually signed - there is
    // no lightweight "draft property" concept elsewhere in this schema.
    propertyId: uuid("property_id").references(() => properties.id),
    externalPropertyName: text("external_property_name"),
    externalLocation: text("external_location"),
    landlordContactId: uuid("landlord_contact_id").references(() => contacts.id),
    // Scouting/assigned property manager - mirrors property_mandates.assignedPmId,
    // same "must be role=property_manager" validation, since a real mandate
    // (and its own assignedPmId) doesn't exist yet at this stage.
    assignedManagerId: uuid("assigned_manager_id").references(() => users.id),
    // Valuer identity: Sunland Valuers Ltd (a real, separate entities row -
    // see entities.slug 'valuers') is the default/main valuer whenever both
    // of these are null. valuerId optionally names a specific staff member
    // who did the work (at Sunland Valuers or elsewhere); externalValuerName
    // is set only when an independent/external firm did it instead. Not a
    // DB-enforced XOR - the UI never presents both as active at once.
    valuerId: uuid("valuer_id").references(() => users.id),
    externalValuerName: text("external_valuer_name"),
    isLand: boolean("is_land").default(false).notNull(),
    stage: valuationStage("stage").default("requested").notNull(),
    // "Assessed value" once valued.
    marketValueKes: numeric("market_value_kes", { precision: 16, scale: 2 }),
    // Proposed management-fee rate if this becomes a mandate - same shape as
    // property_mandates.mandateRate for a direct handoff at signing.
    proposedFeeRate: numeric("proposed_fee_rate", { precision: 5, scale: 4 }),
    methodology: text("methodology"),
    // User-entered comparable evidence (name, pricePerSqft, adjustmentPct,
    // adjustedValueKes) - captured by whoever submits the valuation, never
    // synthesized/derived automatically.
    comparables: jsonb("comparables").$type<
      Array<{ name: string; pricePerSqft: number; adjustmentPct: number; adjustedValueKes: number }>
    >(),
    siteVisitAt: timestamp("site_visit_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    validUntil: timestamp("valid_until", { withTimezone: true }),
    reportUrl: text("report_url"),
    notes: text("notes"),
    // Updated on every stage transition - powers "stalled > 21 days," the
    // acquisition-fit score's freshness component, and the stage stepper's
    // "updated N days ago" label. More honest than a single overall-age
    // field since it reflects time stuck in the *current* stage.
    stageEnteredAt: timestamp("stage_entered_at", { withTimezone: true }).defaultNow().notNull(),
    // Set once stage becomes "mandate_signed" - a real deep link into the
    // mandate this prospect became, not a static route.
    resultingMandateId: uuid("resulting_mandate_id").references(() => propertyMandates.id),
    // User-curated highlight, same concept/parity as properties.isFeatured -
    // separate column (not a reuse of properties.isFeatured) since an
    // external/prospect valuation has no properties row yet to toggle.
    isFeatured: boolean("is_featured").default(false).notNull(),
    ...timestamps,
  },
  (table) => ({
    codeIdx: uniqueIndex("valuations_code_idx").on(table.valuationCode),
    entityIdx: index("valuations_entity_idx").on(table.entityId),
    stageIdx: index("valuations_stage_idx").on(table.stage),
    propertyIdx: index("valuations_property_idx").on(table.propertyId),
  }),
);
