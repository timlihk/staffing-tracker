-- Add finance_management_view_enabled column to billing_access_settings
ALTER TABLE billing_access_settings
  ADD COLUMN IF NOT EXISTS finance_management_view_enabled BOOLEAN DEFAULT false;
