CREATE INDEX IF NOT EXISTS "idx_billing_milestone_last_reminder_sent"
ON "billing_milestone"("last_reminder_sent_at");
