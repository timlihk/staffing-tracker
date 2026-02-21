-- Migration: Add billing milestone trigger system
-- Created: 2026-02-21

BEGIN;

-- Add cmNumber to projects table
ALTER TABLE projects ADD COLUMN IF NOT EXISTS cm_number VARCHAR(255);
CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_cm_number ON projects(cm_number) WHERE cm_number IS NOT NULL;

-- Add billing_ea_user_id and billing_trigger_enabled to app_settings
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS billing_ea_user_id INTEGER;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS billing_trigger_enabled BOOLEAN DEFAULT true;

-- Create billing_milestone_trigger_queue table
CREATE TABLE IF NOT EXISTS billing_milestone_trigger_queue (
    id SERIAL PRIMARY KEY,
    milestone_id BIGINT NOT NULL,
    staffing_project_id INTEGER NOT NULL,
    old_status VARCHAR(100) NOT NULL,
    new_status VARCHAR(100) NOT NULL,
    match_confidence DECIMAL(3, 2) NOT NULL,
    trigger_reason TEXT,
    status VARCHAR(20) DEFAULT 'pending' NOT NULL,
    confirmed_by INTEGER,
    confirmed_at TIMESTAMPTZ,
    action_taken VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trigger_queue_status ON billing_milestone_trigger_queue(status);
CREATE INDEX IF NOT EXISTS idx_trigger_queue_project ON billing_milestone_trigger_queue(staffing_project_id);
CREATE INDEX IF NOT EXISTS idx_trigger_queue_created ON billing_milestone_trigger_queue(created_at);
DELETE FROM billing_milestone_trigger_queue t1
USING billing_milestone_trigger_queue t2
WHERE t1.id < t2.id
  AND t1.milestone_id = t2.milestone_id
  AND t1.new_status = t2.new_status
  AND t1.status = t2.status;
CREATE UNIQUE INDEX IF NOT EXISTS idx_trigger_unique_pending
  ON billing_milestone_trigger_queue(milestone_id, new_status, status);

-- Create billing_action_item table
CREATE TABLE IF NOT EXISTS billing_action_item (
    id SERIAL PRIMARY KEY,
    trigger_queue_id INTEGER,
    milestone_id BIGINT NOT NULL,
    action_type VARCHAR(50) NOT NULL,
    description TEXT NOT NULL,
    due_date DATE,
    assigned_to INTEGER,
    status VARCHAR(20) DEFAULT 'pending' NOT NULL,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_action_item_status ON billing_action_item(status);
CREATE INDEX IF NOT EXISTS idx_action_item_assigned ON billing_action_item(assigned_to);

-- Create billing_overdue_by_attorney view
CREATE OR REPLACE VIEW billing_overdue_by_attorney AS
SELECT
    s.id AS staff_id,
    s.name AS attorney_name,
    s.position AS attorney_position,
    COUNT(DISTINCT m.milestone_id) AS overdue_milestones,
    SUM(m.amount_value) AS overdue_amount,
    MIN(m.due_date) AS next_due_date,
    bp.project_id AS billing_project_id,
    bp.project_name,
    p.id AS staffing_project_id,
    p.name AS staffing_project_name,
    p.status AS staffing_project_status,
    m.milestone_id,
    m.title AS milestone_title,
    m.amount_value AS milestone_amount,
    m.due_date AS milestone_due_date,
    m.trigger_text AS milestone_trigger_text
FROM billing_milestone m
JOIN billing_engagement e ON m.engagement_id = e.engagement_id
JOIN billing_project_cm_no cm ON e.cm_id = cm.cm_id
JOIN billing_project bp ON cm.project_id = bp.project_id
JOIN billing_project_bc_attorneys bpa ON bp.project_id = bpa.billing_project_id
JOIN staff s ON bpa.staff_id = s.id
LEFT JOIN billing_staffing_project_link bspl ON bp.project_id = bspl.billing_project_id
LEFT JOIN projects p ON bspl.staffing_project_id = p.id
WHERE m.completed = false
    AND m.due_date < NOW()
GROUP BY s.id, s.name, s.position, bp.project_id, bp.project_name, p.id, p.name, p.status, m.milestone_id, m.title, m.amount_value, m.due_date, m.trigger_text
ORDER BY overdue_amount DESC;

COMMIT;
