-- Rename role column to position in staff table
ALTER TABLE "staff" RENAME COLUMN "role" TO "position";

-- Drop the old unique constraint that includes role_in_project
ALTER TABLE "project_assignments" DROP CONSTRAINT IF EXISTS "project_assignments_project_id_staff_id_role_in_project_jurisdiction_key";

-- Delete duplicate assignments (keep the first one for each project+staff+jurisdiction combo)
DELETE FROM "project_assignments" a USING "project_assignments" b
WHERE a.id > b.id
AND a.project_id = b.project_id
AND a.staff_id = b.staff_id
AND (a.jurisdiction = b.jurisdiction OR (a.jurisdiction IS NULL AND b.jurisdiction IS NULL));

-- Drop role_in_project column from project_assignments
ALTER TABLE "project_assignments" DROP COLUMN IF EXISTS "role_in_project";

-- Add new unique constraint without role_in_project
ALTER TABLE "project_assignments" ADD CONSTRAINT "project_assignments_project_id_staff_id_jurisdiction_key" UNIQUE ("project_id", "staff_id", "jurisdiction");
