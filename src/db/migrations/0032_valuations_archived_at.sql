-- Custom SQL migration file, put your code below! --

ALTER TABLE "valuations" ADD COLUMN "archived_at" timestamp with time zone;
CREATE INDEX "valuations_archived_idx" ON "valuations" USING btree ("archived_at");
