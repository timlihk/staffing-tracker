# Breaking Changes - Project Schema Refactor

**Date**: October 2, 2025

## Database Changes

### Fields Removed:
1. **`name`** - Project name field removed (replaced by `projectCode`)
2. **`startDate`** - Start date field removed from projects

### Fields Modified:
1. **`projectCode`** - Now required (`NOT NULL`) and unique
2. **`timetable`** - Changed from VARCHAR to ENUM with values:
   - `PRE_A1`
   - `A1`
   - `HEARING`
   - `LISTING`

### Fields Added:
1. **`bcAttorney`** - B&C Attorney assigned to project (VARCHAR)

## Migration Steps

The migration (`20251002200500_refactor_project_fields`) will:
1. Copy `name` values to `projectCode` where `projectCode` is NULL
2. Make `projectCode` non-nullable and unique
3. Create `Timetable` enum type
4. Convert existing timetable text values to enum
5. Add `bcAttorney` column
6. Drop `name` and `startDate` columns

## Manual Backend Fixes Required

After deployment, the following files may need updates to reference `projectCode` instead of `name`:
- `src/controllers/assignment.controller.ts`
- `src/controllers/dashboard.controller.ts`
- `src/controllers/project.controller.ts`
- `src/scripts/migrate-excel.ts`

Search for `project.name` and replace with `project.projectCode`.

## Frontend Changes

✅ Already updated:
- Type definitions (Timetable enum)
- ProjectForm (removed name/startDate, added bcAttorney, enum timetable)
- Projects list page (shows projectCode)
- ProjectDetail page (shows projectCode, bcAttorney, formatted timetable)
- Project report service

## Rollback Plan

If needed, rollback with:
```sql
-- Revert migration (restore from backup recommended)
DROP TYPE "Timetable";
ALTER TABLE "projects" ADD COLUMN "name" VARCHAR(255);
ALTER TABLE "projects" ADD COLUMN "start_date" TIMESTAMP;
ALTER TABLE "projects" DROP COLUMN "bc_attorney";
```
