-- Contacts CRM precision rebuild - real "viewing" scheduling linked to a
-- lead/contact (fixes "Today's Viewings"/"Property Appointments" having no
-- honest backing - previously calendar_events had no relational link to a
-- contact or lead at all).

ALTER TYPE "public"."calendar_event_type" ADD VALUE 'viewing';--> statement-breakpoint

ALTER TABLE "calendar_events" ADD COLUMN "contact_id" uuid REFERENCES "contacts"("id");--> statement-breakpoint
ALTER TABLE "calendar_events" ADD COLUMN "lead_id" uuid REFERENCES "leads"("id");--> statement-breakpoint
CREATE INDEX "calendar_events_contact_idx" ON "calendar_events" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "calendar_events_lead_idx" ON "calendar_events" USING btree ("lead_id");
