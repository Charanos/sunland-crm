ALTER TABLE "documents" ADD COLUMN "file_size_bytes" integer;--> statement-breakpoint
ALTER TABLE "property_mandates" ADD COLUMN "maintenance_authority_kes" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "property_mandates" ADD COLUMN "renewal_type" text;--> statement-breakpoint
ALTER TABLE "property_mandates" ADD COLUMN "notice_period_days" integer;--> statement-breakpoint
ALTER TABLE "property_mandates" ADD COLUMN "scope_description" text;