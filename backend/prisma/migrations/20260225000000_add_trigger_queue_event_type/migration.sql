-- Add event_type column to billing_milestone_trigger_queue
ALTER TABLE "billing_milestone_trigger_queue"
ADD COLUMN "event_type" VARCHAR(100);

-- Index for filtering by event type
CREATE INDEX "idx_trigger_queue_event_type"
ON "billing_milestone_trigger_queue" ("event_type");

-- Backfill event_type from linked project_event records
UPDATE "billing_milestone_trigger_queue" tq
SET "event_type" = pe."event_type"
FROM "project_event" pe
WHERE tq."project_event_id" = pe."id"
  AND tq."event_type" IS NULL;
