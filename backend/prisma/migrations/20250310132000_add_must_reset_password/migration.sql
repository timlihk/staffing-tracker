ALTER TABLE "users" ADD COLUMN "must_reset_password" BOOLEAN NOT NULL DEFAULT false;

-- Ensure existing users are marked as not requiring reset by default
UPDATE "users" SET "must_reset_password" = false WHERE "must_reset_password" IS NULL;
