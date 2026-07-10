ALTER TYPE "public"."user_role" ADD VALUE 'head_of_strategy' BEFORE 'finance_head';--> statement-breakpoint
ALTER TYPE "public"."document_type" ADD VALUE 'offer_letter';--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "id_number" text;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "verified_by_id" uuid;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_verified_by_id_users_id_fk" FOREIGN KEY ("verified_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;