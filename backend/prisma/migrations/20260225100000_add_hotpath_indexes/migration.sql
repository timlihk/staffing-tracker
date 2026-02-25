-- Hot-path indexes for billing queries
-- These cover the most frequently queried columns that lack indexes.

-- billing_milestone: due_date is queried by date sweep, pipeline insights,
-- unpaid invoices, and overdue-by-attorney endpoints
CREATE INDEX IF NOT EXISTS "idx_billing_milestone_due_date"
ON "billing_milestone" ("due_date");

-- billing_milestone: composite (completed, due_date) for sweep candidates
-- which always filter WHERE completed IS NOT TRUE AND due_date <= CURRENT_DATE
CREATE INDEX IF NOT EXISTS "idx_billing_milestone_completed_due_date"
ON "billing_milestone" ("completed", "due_date");

-- billing_action_item: trigger_queue_id is used for lookups and updates
-- when confirming/rejecting triggers
CREATE INDEX IF NOT EXISTS "idx_action_item_trigger_queue"
ON "billing_action_item" ("trigger_queue_id");

-- Enable pg_trgm extension for similarity-based project name matching
-- used by the billing mapping suggestions endpoint
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN trigram index on billing_project.project_name for similarity() queries
CREATE INDEX IF NOT EXISTS "idx_billing_project_name_trgm"
ON "billing_project" USING gin ("project_name" gin_trgm_ops);
