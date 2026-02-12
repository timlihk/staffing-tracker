-- Add missing columns to billing_milestone (may already exist from db push)
ALTER TABLE "billing_milestone" ADD COLUMN IF NOT EXISTS "last_reminder_sent_at" TIMESTAMPTZ(6);
ALTER TABLE "billing_milestone" ADD COLUMN IF NOT EXISTS "reminder_frequency" TEXT DEFAULT 'weekly';
ALTER TABLE "billing_milestone" ADD COLUMN IF NOT EXISTS "reminder_enabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'billing_milestone'
      AND column_name = 'last_reminder_sent_at'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS "idx_billing_milestone_last_reminder_sent" ON "billing_milestone"("last_reminder_sent_at")';
  END IF;
END $$;
