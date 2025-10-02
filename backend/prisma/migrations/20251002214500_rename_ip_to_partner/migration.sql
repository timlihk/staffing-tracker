-- Update all 'IP' role assignments to 'Partner'
UPDATE "project_assignments"
SET "role_in_project" = 'Partner'
WHERE "role_in_project" = 'IP';
