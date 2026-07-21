-- Clear existing maintenance_requests rows (demo data only - npm run db:seed
-- regenerates them with the new vocabulary immediately after this migration,
-- same reasoning as the earlier valuation_stage repurpose, migration 0022).
DELETE FROM "maintenance_requests";--> statement-breakpoint

ALTER TABLE "maintenance_requests" ALTER COLUMN "priority" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "maintenance_requests" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint

-- Severity: 4-tier low/normal/high/critical -> real 3-tier routine/urgent/critical.
ALTER TABLE "maintenance_requests" ALTER COLUMN "priority" TYPE text;--> statement-breakpoint
DROP TYPE "public"."maintenance_priority";--> statement-breakpoint
CREATE TYPE "public"."maintenance_priority" AS ENUM('routine', 'urgent', 'critical');--> statement-breakpoint
ALTER TABLE "maintenance_requests" ALTER COLUMN "priority" TYPE "public"."maintenance_priority" USING "priority"::"public"."maintenance_priority";--> statement-breakpoint
ALTER TABLE "maintenance_requests" ALTER COLUMN "priority" SET DEFAULT 'routine';--> statement-breakpoint
ALTER TABLE "maintenance_requests" ALTER COLUMN "priority" SET NOT NULL;--> statement-breakpoint

-- Status: open/assigned/in_progress/resolved/closed -> real 5-stage flow with
-- a genuine approval gate (reported/awaiting_approval/scheduled/in_progress/done).
ALTER TABLE "maintenance_requests" ALTER COLUMN "status" TYPE text;--> statement-breakpoint
DROP TYPE "public"."maintenance_status";--> statement-breakpoint
CREATE TYPE "public"."maintenance_status" AS ENUM('reported', 'awaiting_approval', 'scheduled', 'in_progress', 'done');--> statement-breakpoint
ALTER TABLE "maintenance_requests" ALTER COLUMN "status" TYPE "public"."maintenance_status" USING "status"::"public"."maintenance_status";--> statement-breakpoint
ALTER TABLE "maintenance_requests" ALTER COLUMN "status" SET DEFAULT 'reported';--> statement-breakpoint
ALTER TABLE "maintenance_requests" ALTER COLUMN "status" SET NOT NULL;--> statement-breakpoint

-- New category dimension.
CREATE TYPE "public"."maintenance_category" AS ENUM('reactive', 'planned', 'compliance');--> statement-breakpoint
ALTER TABLE "maintenance_requests" ADD COLUMN "category" "public"."maintenance_category" DEFAULT 'reactive' NOT NULL;--> statement-breakpoint
CREATE INDEX "maintenance_category_idx" ON "maintenance_requests" USING btree ("category");--> statement-breakpoint

-- Real Scheduler linkage: calendar_events can now point back at the work
-- order whose visit they represent (Maintenance Board "Scheduled Visits").
ALTER TABLE "calendar_events" ADD COLUMN "maintenance_request_id" uuid REFERENCES "maintenance_requests"("id");--> statement-breakpoint
CREATE INDEX "calendar_events_maintenance_request_idx" ON "calendar_events" USING btree ("maintenance_request_id");
