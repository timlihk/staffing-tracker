-- AlterTable: Change timetable from Text to String (VARCHAR)
-- This allows the field to be used as a dropdown with specific values
-- Values: Pre-A1, A1, Hearing, Listing

-- The column type change from TEXT to VARCHAR(255)
-- Existing text values will be preserved
ALTER TABLE "projects" ALTER COLUMN "timetable" TYPE VARCHAR(255);
