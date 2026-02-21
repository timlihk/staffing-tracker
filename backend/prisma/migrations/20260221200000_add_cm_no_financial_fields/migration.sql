-- Add new financial and metadata fields to billing_project_cm_no
ALTER TABLE billing_project_cm_no
  ADD COLUMN IF NOT EXISTS agreed_fee_usd DECIMAL(18,2),
  ADD COLUMN IF NOT EXISTS ar_usd DECIMAL(18,2),
  ADD COLUMN IF NOT EXISTS billed_but_unpaid DECIMAL(18,2),
  ADD COLUMN IF NOT EXISTS unbilled_per_el DECIMAL(18,2),
  ADD COLUMN IF NOT EXISTS finance_remarks TEXT,
  ADD COLUMN IF NOT EXISTS matter_notes TEXT;
