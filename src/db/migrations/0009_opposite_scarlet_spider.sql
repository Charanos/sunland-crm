CREATE TYPE "public"."valuation_status" AS ENUM('requested', 'scheduled', 'in_progress', 'report_draft', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."valuation_type" AS ENUM('market', 'mortgage_security', 'insurance', 'rental_assessment', 'land');--> statement-breakpoint
CREATE TABLE "valuations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid NOT NULL,
	"valuation_code" text NOT NULL,
	"property_id" uuid,
	"external_property_name" text,
	"external_location" text,
	"client_contact_id" uuid,
	"valuer_id" uuid,
	"type" "valuation_type" DEFAULT 'market' NOT NULL,
	"purpose" text,
	"status" "valuation_status" DEFAULT 'requested' NOT NULL,
	"market_value_kes" numeric(16, 2),
	"forced_sale_value_kes" numeric(16, 2),
	"insurance_value_kes" numeric(16, 2),
	"fee_kes" numeric(14, 2),
	"fee_paid" boolean DEFAULT false NOT NULL,
	"site_visit_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"valid_until" timestamp with time zone,
	"report_url" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "valuations" ADD CONSTRAINT "valuations_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "valuations" ADD CONSTRAINT "valuations_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "valuations" ADD CONSTRAINT "valuations_client_contact_id_contacts_id_fk" FOREIGN KEY ("client_contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "valuations" ADD CONSTRAINT "valuations_valuer_id_users_id_fk" FOREIGN KEY ("valuer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "valuations_code_idx" ON "valuations" USING btree ("valuation_code");--> statement-breakpoint
CREATE INDEX "valuations_entity_idx" ON "valuations" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "valuations_status_idx" ON "valuations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "valuations_property_idx" ON "valuations" USING btree ("property_id");