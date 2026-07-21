-- Sales Pipeline precision rebuild - real deal priority, persisted notes,
-- and real file-attachment scoping (ADR 016-adjacent follow-up).

-- New 3-tier deal-priority enum + column on leads.
CREATE TYPE "public"."pipeline_lead_priority" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "priority" "public"."pipeline_lead_priority" DEFAULT 'medium' NOT NULL;--> statement-breakpoint

-- Real, persisted, multi-entry interaction log (fixes the previously
-- ephemeral/never-saved quick-note UI).
CREATE TABLE "lead_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid NOT NULL,
	"lead_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "lead_notes" ADD CONSTRAINT "lead_notes_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_notes" ADD CONSTRAINT "lead_notes_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_notes" ADD CONSTRAINT "lead_notes_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lead_notes_lead_idx" ON "lead_notes" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "lead_notes_entity_idx" ON "lead_notes" USING btree ("entity_id");--> statement-breakpoint

-- Real file-attachment scoping for a lead's own deal documents (mirrors the
-- existing propertyId/leaseId/valuationId optional-scope pattern).
ALTER TABLE "documents" ADD COLUMN "lead_id" uuid;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "documents_lead_idx" ON "documents" USING btree ("lead_id");
