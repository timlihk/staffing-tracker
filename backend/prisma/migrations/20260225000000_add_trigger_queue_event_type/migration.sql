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

-- Backfill event_type for sweep-created rows (no project_event link)
UPDATE "billing_milestone_trigger_queue"
SET "event_type" = "new_status"
WHERE "event_type" IS NULL
  AND "new_status" IN ('MILESTONE_DUE_DATE_PASSED', 'MILESTONE_AI_DATE_PASSED');

-- Replace (milestone_id, new_status, status) unique constraint with
-- (milestone_id, event_type, status) so different event types for the
-- same milestone are not collapsed into a single trigger
DROP INDEX IF EXISTS "idx_trigger_unique_pending";
CREATE UNIQUE INDEX "idx_trigger_unique_pending"
ON "billing_milestone_trigger_queue" ("milestone_id", "event_type", "status");
