-- Migration: Add billing sweep settings to app_settings
-- Created: 2026-02-22

BEGIN;

ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS billing_date_sweep_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS billing_date_sweep_limit INTEGER NOT NULL DEFAULT 2000,
  ADD COLUMN IF NOT EXISTS billing_ai_sweep_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS billing_ai_sweep_limit INTEGER NOT NULL DEFAULT 300,
  ADD COLUMN IF NOT EXISTS billing_ai_sweep_batch_size INTEGER NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS billing_ai_sweep_min_confidence DOUBLE PRECISION NOT NULL DEFAULT 0.75,
  ADD COLUMN IF NOT EXISTS billing_ai_sweep_auto_confirm_confidence DOUBLE PRECISION NOT NULL DEFAULT 0.92;

COMMIT;
