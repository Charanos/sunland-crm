-- Repurpose valuations from a fee-for-service report workflow into the
-- new-mandate acquisition pipeline (2026-07-17). Zero real data existed in
-- this table, so this drops the old shape outright rather than migrating
-- data.
ALTER TABLE "valuations" DROP COLUMN IF EXISTS "type";--> statement-breakpoint
ALTER TABLE "valuations" DROP COLUMN IF EXISTS "purpose";--> statement-breakpoint
ALTER TABLE "valuations" DROP COLUMN IF EXISTS "status";--> statement-breakpoint
ALTER TABLE "valuations" DROP COLUMN IF EXISTS "forced_sale_value_kes";--> statement-breakpoint
ALTER TABLE "valuations" DROP COLUMN IF EXISTS "insurance_value_kes";--> statement-breakpoint
ALTER TABLE "valuations" DROP COLUMN IF EXISTS "fee_kes";--> statement-breakpoint
ALTER TABLE "valuations" DROP COLUMN IF EXISTS "fee_paid";--> statement-breakpoint
ALTER TABLE "valuations" DROP COLUMN IF EXISTS "client_contact_id";--> statement-breakpoint
DROP INDEX IF EXISTS "valuations_status_idx";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."valuation_status";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."valuation_type";--> statement-breakpoint
CREATE TYPE "public"."valuation_stage" AS ENUM('requested', 'site_visit', 'valued', 'offer_sent', 'accepted', 'mandate_signed', 'declined');--> statement-breakpoint
ALTER TABLE "valuations" ADD COLUMN "landlord_contact_id" uuid;--> statement-breakpoint
ALTER TABLE "valuations" ADD COLUMN "assigned_manager_id" uuid;--> statement-breakpoint
ALTER TABLE "valuations" ADD COLUMN "external_valuer_name" text;--> statement-breakpoint
ALTER TABLE "valuations" ADD COLUMN "is_land" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "valuations" ADD COLUMN "stage" "valuation_stage" DEFAULT 'requested' NOT NULL;--> statement-breakpoint
ALTER TABLE "valuations" ADD COLUMN "proposed_fee_rate" numeric(5, 4);--> statement-breakpoint
ALTER TABLE "valuations" ADD COLUMN "methodology" text;--> statement-breakpoint
ALTER TABLE "valuations" ADD COLUMN "comparables" jsonb;--> statement-breakpoint
ALTER TABLE "valuations" ADD COLUMN "stage_entered_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "valuations" ADD COLUMN "resulting_mandate_id" uuid;--> statement-breakpoint
ALTER TABLE "valuations" ADD CONSTRAINT "valuations_landlord_contact_id_contacts_id_fk" FOREIGN KEY ("landlord_contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "valuations" ADD CONSTRAINT "valuations_assigned_manager_id_users_id_fk" FOREIGN KEY ("assigned_manager_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "valuations" ADD CONSTRAINT "valuations_resulting_mandate_id_property_mandates_id_fk" FOREIGN KEY ("resulting_mandate_id") REFERENCES "public"."property_mandates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "valuations_stage_idx" ON "valuations" USING btree ("stage");--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "valuation_id" uuid;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_valuation_id_valuations_id_fk" FOREIGN KEY ("valuation_id") REFERENCES "public"."valuations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "documents_valuation_idx" ON "documents" USING btree ("valuation_id");--> statement-breakpoint
ALTER TYPE "public"."document_type" ADD VALUE 'valuation_report';
