ALTER TABLE "maintenance_requests" ADD COLUMN "estimated_cost_kes" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "maintenance_requests" ADD COLUMN "actual_cost_kes" numeric(14, 2);
