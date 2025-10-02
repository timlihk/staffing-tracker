# Change History Implementation Guide

## Overview
This document outlines the comprehensive change tracking system that replaces the redundant Activity Log for projects and staff with a detailed field-level change history.

---

## What Has Been Implemented

### 1. Database Schema (✅ Complete)
**New Tables:**
- `project_change_history` - Tracks all field changes for projects
- `staff_change_history` - Tracks all field changes for staff

**Fields Tracked:**
- Field name (name, status, priority, dates, notes, assignments, etc.)
- Old value and new value
- Change type (update, assignment_added, assignment_removed)
- User who made the change
- Timestamp

**Migration File:** `/backend/prisma/migrations/add_change_history/migration.sql`

### 2. Backend Implementation (✅ Complete)

**Change Tracking Utility:** `/backend/src/utils/changeTracking.ts`
- `trackFieldChanges()` - Automatically detects and logs all field changes
- `trackAssignmentChange()` - Logs team member additions/removals

**Controllers Updated:**
- `project.controller.ts` - Tracks all project field changes
- `staff.controller.ts` - Tracks all staff field changes

**New API Endpoints:**
```
GET /api/projects/:id/change-history - Get all changes for a project
GET /api/staff/:id/change-history - Get all changes for a staff member
```

**Old Endpoint Replaced:**
```
GET /api/projects/:id/activity-log - REPLACED with change-history
```

###3. What Fields Are Tracked

**For Projects:**
- name (project name changes)
- projectCode
- category
- status (also kept in project_status_history for legacy)
- priority
- startDate
- targetFilingDate
- actualFilingDate
- notes
- timelineStatus
- assignments (team member add/remove)

**For Staff:**
- name
- email
- role
- department
- status
- notes
- assignments (project assignments add/remove)

---

## What Still Needs To Be Done

### 1. Database Migration (❌ To Do)
**Action Required:** Run the migration SQL on Railway database

**Steps:**
1. Go to Railway.app → Your Project → PostgreSQL database
2. Click "Data" tab
3. Click "Query" button
4. Copy and paste the contents of `/backend/prisma/migrations/add_change_history/migration.sql`
5. Execute the query
6. Verify tables created successfully

**Alternative:** Deploy backend to Railway - it will auto-generate Prisma client with new models

### 2. Frontend Updates (❌ To Do)

**ProjectDetail.tsx Updates Needed:**
```typescript
// Change API endpoint from:
api.get(`/projects/${id}/activity-log`)

// To:
api.get(`/projects/${id}/change-history`)

// Update display to show:
// - Field name: "status", "priority", "startDate", etc.
// - Old value → New value
// - Changed by user
// - Timestamp
```

**StaffDetail.tsx Updates Needed:**
```typescript
// Add change history section similar to ProjectDetail
// Fetch from: api.get(`/staff/${id}/change-history`)
// Display all field changes and assignment changes
```

**Remove Activity Log References:**
- Remove `ActivityFeed.tsx` component or update to use change history
- Update imports in components that reference activity log

### 3. Assignment Tracking Enhancement (⏳ Optional)
**To fully track assignment changes:**

Update `/backend/src/controllers/assignment.controller.ts` to call:
```typescript
import { trackAssignmentChange } from '../utils/changeTracking';

// When creating assignment:
await trackAssignmentChange(
  projectId,
  'project',
  'assignment_added',
  `${staff.name} assigned as ${roleInProject}`,
  req.user?.userId
);

// Also track for staff:
await trackAssignmentChange(
  staffId,
  'staff',
  'assignment_added',
  `Assigned to ${project.name} as ${roleInProject}`,
  req.user?.userId
);
```

---

## Benefits of This System

1. **Complete Audit Trail**
   - Every field change is tracked with old → new values
   - Know exactly what changed, when, and by whom

2. **No Redundancy**
   - Replaced generic activity log with specific field-level tracking
   - Status history kept for compatibility

3. **Better UX**
   - Users can see "priority changed from Medium → High"
   - Instead of just "Project updated"

4. **Scalable**
   - Easy to add more tracked fields
   - Works for any entity (projects, staff, assignments)

---

## Testing Checklist

After deployment:
- [ ] Create a new project → Check change history shows creation
- [ ] Update project name → Check old name → new name logged
- [ ] Change project status → Check both status_history and change_history
- [ ] Change project priority → Check priority change logged
- [ ] Update staff name → Check staff change history
- [ ] Change staff role → Check role change logged
- [ ] View ProjectDetail change history tab
- [ ] View StaffDetail change history tab

---

## Rollback Plan

If issues occur:
1. Revert API endpoint changes in routes (change-history → activity-log)
2. Revert controller changes (remove trackFieldChanges calls)
3. Keep new tables (no harm, just unused)
4. Frontend will work with old activity log endpoint

---

## Future Enhancements

1. **Assignment Change Tracking**
   - Track when team members are added/removed from projects
   - Show in both project and staff change history

2. **Bulk Changes**
   - Track bulk operations separately
   - Show "5 staff members reassigned" as one entry

3. **Change Comparison View**
   - Side-by-side comparison of old vs new values
   - Especially useful for long text fields (notes)

4. **Export Change History**
   - Export to Excel/PDF for compliance
   - Filter by date range, user, field

---

## API Response Format

**GET /api/projects/:id/change-history**
```json
[
  {
    "id": 1,
    "fieldName": "priority",
    "oldValue": "Medium",
    "newValue": "High",
    "changeType": "update",
    "username": "admin",
    "changedAt": "2025-10-02T10:30:00Z"
  },
  {
    "fieldName": "status",
    "oldValue": "Active",
    "newValue": "Slow-down",
    "changeType": "update",
    "username": "john.doe",
    "changedAt": "2025-10-01T15:45:00Z"
  }
]
```

**GET /api/staff/:id/change-history**
```json
[
  {
    "id": 1,
    "fieldName": "role",
    "oldValue": "Junior FLIC",
    "newValue": "Senior FLIC",
    "changeType": "update",
    "username": "hr_admin",
    "changedAt": "2025-09-15T09:00:00Z"
  }
]
```

---

## Summary

✅ **Completed:**
- Database schema with change history tables
- Backend change tracking utility
- Project and Staff controllers updated
- New API endpoints created

❌ **Remaining:**
- Run database migration on Railway
- Update frontend to use new endpoints
- Remove old activity log UI
- Optional: Track assignment changes

**Estimated Time to Complete:** 1-2 hours
**Priority:** High (needed for comprehensive audit trail)
