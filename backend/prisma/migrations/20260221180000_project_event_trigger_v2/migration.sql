-- Migration: Event-driven milestone trigger model (v2)
-- Created: 2026-02-21

BEGIN;

-- ============================================================================
-- Projects: lifecycle metadata
-- ============================================================================

ALTER TABLE projects ADD COLUMN IF NOT EXISTS lifecycle_stage VARCHAR(100);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS lifecycle_stage_changed_at TIMESTAMPTZ;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS lifecycle_stage_changed_by INTEGER;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS stage_version INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_projects_lifecycle_stage ON projects(lifecycle_stage);
CREATE INDEX IF NOT EXISTS idx_projects_stage_version ON projects(stage_version);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_projects_lifecycle_changed_by'
  ) THEN
    ALTER TABLE projects
      ADD CONSTRAINT fk_projects_lifecycle_changed_by
      FOREIGN KEY (lifecycle_stage_changed_by)
      REFERENCES users(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================================
-- Project event log
-- ============================================================================

CREATE TABLE IF NOT EXISTS project_event (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  event_key VARCHAR(255),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status_from VARCHAR(100),
  status_to VARCHAR(100),
  lifecycle_stage_from VARCHAR(100),
  lifecycle_stage_to VARCHAR(100),
  source VARCHAR(50) NOT NULL DEFAULT 'system',
  payload JSONB,
  created_by INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_project_event_event_key ON project_event(event_key) WHERE event_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_project_event_project ON project_event(project_id);
CREATE INDEX IF NOT EXISTS idx_project_event_type ON project_event(event_type);
CREATE INDEX IF NOT EXISTS idx_project_event_occurred ON project_event(occurred_at);
CREATE INDEX IF NOT EXISTS idx_project_event_project_occurred ON project_event(project_id, occurred_at);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_project_event_project'
  ) THEN
    ALTER TABLE project_event
      ADD CONSTRAINT fk_project_event_project
      FOREIGN KEY (project_id)
      REFERENCES projects(id)
      ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_project_event_created_by'
  ) THEN
    ALTER TABLE project_event
      ADD CONSTRAINT fk_project_event_created_by
      FOREIGN KEY (created_by)
      REFERENCES users(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================================
-- Milestone trigger rules
-- ============================================================================

CREATE TABLE IF NOT EXISTS billing_milestone_trigger_rule (
  id SERIAL PRIMARY KEY,
  milestone_id BIGINT NOT NULL,
  trigger_mode VARCHAR(30) NOT NULL DEFAULT 'manual',
  anchor_event_type VARCHAR(100),
  requires_invoice_issued BOOLEAN NOT NULL DEFAULT false,
  requires_payment_received BOOLEAN NOT NULL DEFAULT false,
  due_in_business_days INTEGER,
  fallback_due_date DATE,
  recurrence VARCHAR(30) DEFAULT 'none',
  auto_confirm BOOLEAN NOT NULL DEFAULT false,
  manual_confirm_required BOOLEAN NOT NULL DEFAULT true,
  condition_json JSONB,
  confidence NUMERIC(3, 2),
  rule_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trigger_rule_milestone ON billing_milestone_trigger_rule(milestone_id);
CREATE INDEX IF NOT EXISTS idx_trigger_rule_mode ON billing_milestone_trigger_rule(trigger_mode);
CREATE INDEX IF NOT EXISTS idx_trigger_rule_anchor ON billing_milestone_trigger_rule(anchor_event_type);
CREATE INDEX IF NOT EXISTS idx_trigger_rule_auto_confirm ON billing_milestone_trigger_rule(auto_confirm);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_trigger_rule_milestone'
  ) THEN
    ALTER TABLE billing_milestone_trigger_rule
      ADD CONSTRAINT fk_trigger_rule_milestone
      FOREIGN KEY (milestone_id)
      REFERENCES billing_milestone(milestone_id)
      ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================================================
-- Trigger queue: event/rule linkage
-- ============================================================================

ALTER TABLE billing_milestone_trigger_queue ADD COLUMN IF NOT EXISTS project_event_id INTEGER;
ALTER TABLE billing_milestone_trigger_queue ADD COLUMN IF NOT EXISTS rule_id INTEGER;
ALTER TABLE billing_milestone_trigger_queue ADD COLUMN IF NOT EXISTS match_method VARCHAR(30);

CREATE INDEX IF NOT EXISTS idx_trigger_queue_event ON billing_milestone_trigger_queue(project_event_id);
CREATE INDEX IF NOT EXISTS idx_trigger_queue_rule ON billing_milestone_trigger_queue(rule_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_trigger_unique_event
  ON billing_milestone_trigger_queue(milestone_id, project_event_id)
  WHERE project_event_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_trigger_queue_event'
  ) THEN
    ALTER TABLE billing_milestone_trigger_queue
      ADD CONSTRAINT fk_trigger_queue_event
      FOREIGN KEY (project_event_id)
      REFERENCES project_event(id)
      ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_trigger_queue_rule'
  ) THEN
    ALTER TABLE billing_milestone_trigger_queue
      ADD CONSTRAINT fk_trigger_queue_rule
      FOREIGN KEY (rule_id)
      REFERENCES billing_milestone_trigger_rule(id)
      ON DELETE SET NULL;
  END IF;
END $$;

COMMIT;
