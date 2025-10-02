-- CreateEnum: Add Timetable enum
CREATE TYPE "Timetable" AS ENUM ('PRE_A1', 'A1', 'HEARING', 'LISTING');

-- Step 1: Add new bc_attorney column
ALTER TABLE "projects" ADD COLUMN "bc_attorney" VARCHAR(255);

-- Step 2: Make projectCode non-nullable and unique (if it has null values, set them to name first)
-- Update any null project_code values to use the name value
UPDATE "projects" SET "project_code" = "name" WHERE "project_code" IS NULL;

-- Make project_code required and unique
ALTER TABLE "projects" ALTER COLUMN "project_code" SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "projects_project_code_key" ON "projects"("project_code");

-- Step 3: Convert timetable from VARCHAR to enum
-- First, create a temporary column with the new enum type
ALTER TABLE "projects" ADD COLUMN "timetable_new" "Timetable";

-- Map existing text values to enum values
UPDATE "projects" SET "timetable_new" =
  CASE
    WHEN "timetable" = 'Pre-A1' THEN 'PRE_A1'::"Timetable"
    WHEN "timetable" = 'A1' THEN 'A1'::"Timetable"
    WHEN "timetable" = 'Hearing' THEN 'HEARING'::"Timetable"
    WHEN "timetable" = 'Listing' THEN 'LISTING'::"Timetable"
    ELSE NULL
  END;

-- Drop old timetable column and rename new one
ALTER TABLE "projects" DROP COLUMN "timetable";
ALTER TABLE "projects" RENAME COLUMN "timetable_new" TO "timetable";

-- Step 4: Remove start_date column
ALTER TABLE "projects" DROP COLUMN "start_date";

-- Step 5: Remove name column (data already copied to project_code in step 2)
-- First drop the unique constraint on name
DROP INDEX IF EXISTS "projects_name_key";
ALTER TABLE "projects" DROP COLUMN "name";
