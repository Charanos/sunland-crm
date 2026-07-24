-- Operations Scheduler + Projects Board + Messenger rebuild (ADR 019).
-- Additive only: every column is nullable or defaulted, and the enum gains a
-- value rather than changing existing ones, so this is safe to apply against
-- live data with no backfill step.

-- ── projects: real timeline span, milestones, at-risk state, budget, link ────
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "start_date" date;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "milestones" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "at_risk" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "budget_kes" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "linked_record_type" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "linked_record_id" uuid;--> statement-breakpoint

-- ── calendar_events: critical flag + notify role tiers ───────────────────────
ALTER TABLE "calendar_events" ADD COLUMN IF NOT EXISTS "is_critical" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD COLUMN IF NOT EXISTS "notify_role_tiers" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint

-- ── conversations: linked record + system thread kind ────────────────────────
-- ALTER TYPE ... ADD VALUE is transaction-safe on PG12+ as long as the new
-- value isn't used in the same transaction - this migration only declares it.
ALTER TYPE "conversation_type" ADD VALUE IF NOT EXISTS 'system';--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "linked_record_type" text;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "linked_record_id" uuid;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "linked_record_code" text;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "conversations_linked_record_idx" ON "conversations" ("linked_record_type","linked_record_id");--> statement-breakpoint

-- ── conversation_participants: per-user archive ──────────────────────────────
ALTER TABLE "conversation_participants" ADD COLUMN IF NOT EXISTS "archived_at" timestamp with time zone;
