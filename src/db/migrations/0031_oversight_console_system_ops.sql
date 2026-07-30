-- Oversight Console: system operations, ticket threads, report schedules
-- (ADR 020). Additive only - new tables plus nullable/defaulted columns on
-- support_tickets, so this is safe to apply against live data with no backfill.

-- ── support_tickets: real channel provenance + first-response measurement ────
DO $$ BEGIN
  CREATE TYPE "support_ticket_channel" AS ENUM ('portal', 'email', 'phone', 'whatsapp');
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint

ALTER TABLE "support_tickets" ADD COLUMN IF NOT EXISTS "channel" "support_ticket_channel" DEFAULT 'portal' NOT NULL;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD COLUMN IF NOT EXISTS "first_responded_at" timestamp with time zone;--> statement-breakpoint

-- ── support_ticket_messages: the real reply thread ───────────────────────────
CREATE TABLE IF NOT EXISTS "support_ticket_messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "ticket_id" uuid NOT NULL REFERENCES "support_tickets"("id"),
  "author_id" uuid NOT NULL REFERENCES "users"("id"),
  "body" text NOT NULL,
  "is_internal" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "support_ticket_messages_ticket_created_idx" ON "support_ticket_messages" ("ticket_id","created_at");--> statement-breakpoint

-- ── service_health_checks: recorded probe history (global infrastructure) ────
DO $$ BEGIN
  CREATE TYPE "service_health_status" AS ENUM ('healthy', 'degraded', 'down', 'not_configured');
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "service_health_checks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "service" text NOT NULL,
  "status" "service_health_status" NOT NULL,
  "latency_ms" integer,
  "detail" text,
  "checked_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "service_health_checks_service_checked_idx" ON "service_health_checks" ("service","checked_at");--> statement-breakpoint

-- ── job_runs: one row per real, operator-triggered execution ─────────────────
DO $$ BEGIN
  CREATE TYPE "job_run_status" AS ENUM ('running', 'success', 'failed');
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "job_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "entity_id" uuid NOT NULL REFERENCES "entities"("id"),
  "job_key" text NOT NULL,
  "status" "job_run_status" DEFAULT 'running' NOT NULL,
  "triggered_by_id" uuid NOT NULL REFERENCES "users"("id"),
  "started_at" timestamp with time zone DEFAULT now() NOT NULL,
  "finished_at" timestamp with time zone,
  "summary" text,
  "error" text
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_runs_job_started_idx" ON "job_runs" ("job_key","started_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_runs_entity_idx" ON "job_runs" ("entity_id");--> statement-breakpoint

-- ── report_schedules: persisted scheduling intent (no scheduler yet) ─────────
DO $$ BEGIN
  CREATE TYPE "report_cadence" AS ENUM ('daily', 'weekly', 'monthly', 'quarterly');
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "report_schedules" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "entity_id" uuid NOT NULL REFERENCES "entities"("id"),
  "report_type" text NOT NULL,
  "cadence" "report_cadence" DEFAULT 'monthly' NOT NULL,
  "recipient_ids" jsonb DEFAULT '[]'::jsonb,
  "enabled" boolean DEFAULT true NOT NULL,
  "last_run_at" timestamp with time zone,
  "created_by_id" uuid NOT NULL REFERENCES "users"("id"),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "report_schedules_entity_type_idx" ON "report_schedules" ("entity_id","report_type");
