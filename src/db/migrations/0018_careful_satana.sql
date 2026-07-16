CREATE TYPE "public"."unit_status" AS ENUM('vacant', 'occupied', 'reserved', 'maintenance');--> statement-breakpoint
CREATE TABLE "property_units" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"unit_label" text NOT NULL,
	"unit_type" text,
	"monthly_rent_kes" numeric(14, 2),
	"status" "unit_status" DEFAULT 'vacant' NOT NULL,
	"current_lease_id" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "leases" ADD COLUMN "unit_id" uuid;--> statement-breakpoint
ALTER TABLE "leases" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "property_units" ADD CONSTRAINT "property_units_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_units" ADD CONSTRAINT "property_units_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_units" ADD CONSTRAINT "property_units_current_lease_id_leases_id_fk" FOREIGN KEY ("current_lease_id") REFERENCES "public"."leases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "property_units_property_idx" ON "property_units" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "property_units_entity_idx" ON "property_units" USING btree ("entity_id");--> statement-breakpoint
ALTER TABLE "leases" ADD CONSTRAINT "leases_unit_id_property_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."property_units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "leases_unit_idx" ON "leases" USING btree ("unit_id");