CREATE TYPE "public"."mandate_status" AS ENUM('draft', 'pending_approval', 'active', 'terminated');--> statement-breakpoint
CREATE TABLE "property_mandates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"landlord_contact_id" uuid NOT NULL,
	"mandate_rate" numeric(5, 4) DEFAULT '0.1000' NOT NULL,
	"rate_justification" text,
	"unit_count" integer DEFAULT 1 NOT NULL,
	"start_date" timestamp with time zone NOT NULL,
	"end_date" timestamp with time zone,
	"status" "mandate_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "property_mandates" ADD CONSTRAINT "property_mandates_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_mandates" ADD CONSTRAINT "property_mandates_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_mandates" ADD CONSTRAINT "property_mandates_landlord_contact_id_contacts_id_fk" FOREIGN KEY ("landlord_contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "property_mandates_property_idx" ON "property_mandates" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "property_mandates_entity_idx" ON "property_mandates" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "property_mandates_status_idx" ON "property_mandates" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "property_mandates_active_unique_idx" ON "property_mandates" USING btree ("property_id") WHERE "property_mandates"."status" in ('pending_approval', 'active');