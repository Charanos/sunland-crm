CREATE TYPE "public"."document_type" AS ENUM('mandate_letter', 'lease_agreement', 'rent_receipt', 'statement');--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid NOT NULL,
	"type" "document_type" NOT NULL,
	"title" text NOT NULL,
	"file_url" text NOT NULL,
	"uploaded_by_id" uuid NOT NULL,
	"owner_contact_id" uuid,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report_exports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid NOT NULL,
	"report_type" text NOT NULL,
	"generated_by_id" uuid NOT NULL,
	"verification_token" text NOT NULL,
	"expires_at" timestamp with time zone,
	"snapshot" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "report_exports_verification_token_unique" UNIQUE("verification_token")
);
--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploaded_by_id_users_id_fk" FOREIGN KEY ("uploaded_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_owner_contact_id_contacts_id_fk" FOREIGN KEY ("owner_contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_exports" ADD CONSTRAINT "report_exports_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_exports" ADD CONSTRAINT "report_exports_generated_by_id_users_id_fk" FOREIGN KEY ("generated_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "documents_entity_idx" ON "documents" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "documents_owner_contact_idx" ON "documents" USING btree ("owner_contact_id");--> statement-breakpoint
CREATE INDEX "documents_type_idx" ON "documents" USING btree ("type");--> statement-breakpoint
CREATE INDEX "report_exports_entity_idx" ON "report_exports" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "report_exports_token_idx" ON "report_exports" USING btree ("verification_token");