# Breaking Changes

This document tracks all breaking changes to the Staffing Tracker application.

---

## Version 1.7.0 - Staff Position Refactor

**Date**: October 4, 2025

### Database Schema Changes

#### Fields Renamed:
1. **`Staff.role`** → **`Staff.position`**
   - All references to staff "role" now use "position" terminology
   - Affects API responses, frontend display, and database queries

#### Fields Removed:
1. **`ProjectAssignment.roleInProject`**
   - Removed redundant role tracking from assignments
   - Position now comes from Staff table only (single source of truth)

#### Constraints Modified:
1. **ProjectAssignment unique constraint** changed from:
   - Old: `(projectId, staffId, roleInProject, jurisdiction)`
   - New: `(projectId, staffId, jurisdiction)`

### Migration

The migration (`migrate.sql`) performs:
1. Renames `Staff.role` column to `Staff.position`
2. Drops old unique constraint with roleInProject
3. Deduplicates assignments (keeps first record per project+staff+jurisdiction)
4. Drops `ProjectAssignment.roleInProject` column
5. Creates new unique constraint without roleInProject

### Backend Changes

**Controllers Updated:**
- `assignment.controller.ts` - Uses `staff.position` for tracking
- `staff.controller.ts` - All role references changed to position
- `dashboard.controller.ts` - Heatmap queries use `staff.position`
- `project.controller.ts` - No changes needed

**Services Updated:**
- `reports.service.ts` - Filters by `staff.position`
- `reports.excel.ts` - "Role in Project" column removed
- `project-report.service.ts` - Groups by `staff.position`

**Types Updated:**
- `reports.types.ts` - Removed `roleInProject` from ReportRow

### Frontend Changes

**Type Definitions Updated:**
- `Staff.role` → `Staff.position`
- `ProjectAssignment.roleInProject` removed
- `DashboardSummary.staffingHeatmap[].role` → `.position`

**Components Updated:**
- `Dashboard.tsx` - Heatmap grouping uses position
- `ProjectDetail.tsx` - Displays `staff.position` instead of `roleInProject`
- `StaffDetail.tsx` - Shows position, removed role column from projects table
- `StaffForm.tsx` - Maps position field correctly

### Impact

**Advantages:**
- ✅ Eliminates data inconsistencies (e.g., same person showing different positions)
- ✅ Single source of truth for staff position
- ✅ Simplified data model
- ✅ Prevents duplicate assignments

**Breaking Changes:**
- ❌ API field names changed (`role` → `position`)
- ❌ Assignment API no longer accepts `roleInProject`
- ❌ Excel exports have one fewer column
- ❌ Existing integrations must update field references

### Rollback Plan

If needed, rollback with:
```sql
-- Restore old schema (BACKUP RECOMMENDED)
ALTER TABLE "staff" RENAME COLUMN "position" TO "role";
ALTER TABLE "project_assignments" ADD COLUMN "role_in_project" VARCHAR(255);
ALTER TABLE "project_assignments" DROP CONSTRAINT "project_assignments_project_id_staff_id_jurisdiction_key";
-- Note: Will need to repopulate role_in_project values manually
ALTER TABLE "project_assignments" ADD CONSTRAINT "project_assignments_project_id_staff_id_role_in_project_jurisdiction_key"
  UNIQUE ("project_id", "staff_id", "role_in_project", "jurisdiction");
```

---

## Version 1.0.0 - Project Schema Refactor

**Date**: October 2, 2025

### Database Changes

#### Fields Removed:
1. **`name`** - Project name field removed (replaced by `projectCode`)
2. **`startDate`** - Start date field removed from projects

#### Fields Modified:
1. **`projectCode`** - Now required (`NOT NULL`) and unique
2. **`timetable`** - Changed from VARCHAR to ENUM with values:
   - `PRE_A1`
   - `A1`
   - `HEARING`
   - `LISTING`

#### Fields Added:
1. **`bcAttorney`** - B&C Attorney assigned to project (VARCHAR)

### Migration Steps

The migration (`20251002200500_refactor_project_fields`) will:
1. Copy `name` values to `projectCode` where `projectCode` is NULL
2. Make `projectCode` non-nullable and unique
3. Create `Timetable` enum type
4. Convert existing timetable text values to enum
5. Add `bcAttorney` column
6. Drop `name` and `startDate` columns

### Manual Backend Fixes Required

After deployment, the following files may need updates to reference `projectCode` instead of `name`:
- `src/controllers/assignment.controller.ts`
- `src/controllers/dashboard.controller.ts`
- `src/controllers/project.controller.ts`
- `src/scripts/migrate-excel.ts`

Search for `project.name` and replace with `project.projectCode`.

### Frontend Changes

✅ Already updated:
- Type definitions (Timetable enum)
- ProjectForm (removed name/startDate, added bcAttorney, enum timetable)
- Projects list page (shows projectCode)
- ProjectDetail page (shows projectCode, bcAttorney, formatted timetable)
- Project report service

### Rollback Plan

If needed, rollback with:
```sql
-- Revert migration (restore from backup recommended)
DROP TYPE "Timetable";
ALTER TABLE "projects" ADD COLUMN "name" VARCHAR(255);
ALTER TABLE "projects" ADD COLUMN "start_date" TIMESTAMP;
ALTER TABLE "projects" DROP COLUMN "bc_attorney";
```
