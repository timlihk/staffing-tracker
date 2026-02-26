-- Performance indexes for hot-path billing queries
-- Targets missing indexes identified in performance audit

-- billing_milestone: composite for engagement listing with completion filter
CREATE INDEX IF NOT EXISTS "idx_billing_milestone_engagement_completion"
ON "billing_milestone" ("engagement_id", "completed", "due_date");

-- billing_milestone: completion_date for recently-completed queries
CREATE INDEX IF NOT EXISTS "idx_billing_milestone_completion_date"
ON "billing_milestone" ("completion_date" DESC);

-- billing_milestone_trigger_queue: composite for auto-resolve lookups
CREATE INDEX IF NOT EXISTS "idx_trigger_queue_milestone_status"
ON "billing_milestone_trigger_queue" ("milestone_id", "status");

-- billing_milestone_trigger_queue: timeline queries with status filter
CREATE INDEX IF NOT EXISTS "idx_trigger_queue_created_status"
ON "billing_milestone_trigger_queue" ("created_at" DESC, "status");

-- billing_action_item: pending action items per milestone
CREATE INDEX IF NOT EXISTS "idx_action_item_milestone_status"
ON "billing_action_item" ("milestone_id", "status");

-- billing_action_item: recent items sorted by creation
CREATE INDEX IF NOT EXISTS "idx_action_item_created_at"
ON "billing_action_item" ("created_at" DESC);

-- billing_invoice: status filtering (draft/issued/paid)
CREATE INDEX IF NOT EXISTS "idx_billing_invoice_status"
ON "billing_invoice" ("status");

-- billing_invoice: unpaid invoice queries (WHERE paid_date IS NULL)
CREATE INDEX IF NOT EXISTS "idx_billing_invoice_paid_date"
ON "billing_invoice" ("paid_date");

-- billing_event: source transaction lookups
CREATE INDEX IF NOT EXISTS "idx_billing_event_source_id"
ON "billing_event" ("source_id");
