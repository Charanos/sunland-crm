CREATE TYPE "public"."remittance_status" AS ENUM('pending', 'released', 'flagged');--> statement-breakpoint
CREATE TABLE "remittance_advices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid NOT NULL,
	"mandate_id" uuid NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"collected_kes" numeric(14, 2) NOT NULL,
	"management_fee_kes" numeric(14, 2) NOT NULL,
	"expenses_kes" numeric(14, 2) NOT NULL,
	"net_remittance_kes" numeric(14, 2) NOT NULL,
	"status" "remittance_status" DEFAULT 'pending' NOT NULL,
	"verification_token" text NOT NULL,
	"generated_by_id" uuid NOT NULL,
	"released_by_id" uuid,
	"released_at" timestamp with time zone,
	"flag_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "remittance_advices_verification_token_unique" UNIQUE("verification_token")
);
--> statement-breakpoint
ALTER TABLE "remittance_advices" ADD CONSTRAINT "remittance_advices_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "remittance_advices" ADD CONSTRAINT "remittance_advices_mandate_id_property_mandates_id_fk" FOREIGN KEY ("mandate_id") REFERENCES "public"."property_mandates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "remittance_advices" ADD CONSTRAINT "remittance_advices_generated_by_id_users_id_fk" FOREIGN KEY ("generated_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "remittance_advices" ADD CONSTRAINT "remittance_advices_released_by_id_users_id_fk" FOREIGN KEY ("released_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "remittance_advices_mandate_idx" ON "remittance_advices" USING btree ("mandate_id");--> statement-breakpoint
CREATE INDEX "remittance_advices_entity_idx" ON "remittance_advices" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "remittance_advices_status_idx" ON "remittance_advices" USING btree ("status");--> statement-breakpoint
CREATE INDEX "remittance_advices_token_idx" ON "remittance_advices" USING btree ("verification_token");