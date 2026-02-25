# Billing Milestone Trigger System - Implementation Review

## Overview

This document describes the implementation of a Billing Milestone Trigger System that automatically detects when staffing project status changes should trigger billing milestone actions.

## Problem Statement

1. Billing milestones have `trigger-form descriptive text with_text` as free no automatic evaluation
2. No link between staffing project status changes and billing milestone triggers
3. No systematic way to track which B&C attorney is responsible for billing matters
4. No dashboard to see overdue billing by attorney

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        STAFFING MODULE                                      │
│  ┌─────────────┐                                                           │
│  │   Project    │  status changes trigger event                           │
│  │  (cmNumber) │──────────────┐                                           │
│  └─────────────┘              │                                           │
└───────────────────────────────┼─────────────────────────────────────────────┘
                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                  Milestone Trigger Service                                  │
│  1. Detect status change                                                   │
│  2. Find linked billing project via cmNumber                              │
│  3. Query milestones with keyword matching                              │
│  4. Create pending trigger records                                         │
└───────────────────────────────┬─────────────────────────────────────────────┘
                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│               Pending Trigger Queue (New Table)                             │
│  - milestone_id, project_id, old_status, new_status,                     │
│    match_confidence, status ('pending'|'confirmed'|'rejected'),           │
│    confirmed_by, confirmed_at                                               │
└───────────────────────────────┬─────────────────────────────────────────────┘
                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│              EA Confirmation Workflow                                       │
│  - Notify EA of pending triggers                                            │
│  - EA reviews and confirms/rejects                                          │
│  - On confirm: mark milestone completed, trigger notification              │
└───────────────────────────────┬─────────────────────────────────────────────┘
                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                   Billing Team Notifications                                │
│  - Email to billing team: "Issue invoice for X - $Y"                      │
│  - Action items created                                                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Details

### Phase 1: Database Schema Changes

**Files Modified:** `backend/prisma/schema.prisma`

**Changes:**

1. **Added `cmNumber` to Project model:**
   ```prisma
   cmNumber String? @unique @map("cm_number")
   ```

2. **Added billing config to AppSettings:**
   ```prisma
   billingEaUserId Int? @map("billing_ea_user_id")
   billingTriggerEnabled Boolean @default(true) @map("billing_trigger_enabled")
   ```

3. **Created `billing_milestone_trigger_queue` table:**
   ```prisma
   model billing_milestone_trigger_queue {
     id                  Int       @id @default(autoincrement())
     milestone_id       BigInt    @map("milestone_id")
     staffing_project_id Int       @map("staffing_project_id")
     old_status         String    @map("old_status")
     new_status         String    @map("new_status")
     match_confidence   Decimal   @db.Decimal(3, 2) @map("match_confidence")
     trigger_reason     String?   @map("trigger_reason")
     status             String    @default("pending")
     confirmed_by       Int?      @map("confirmed_by")
     confirmed_at       DateTime? @map("confirmed_at")
     action_taken      String?   @map("action_taken")
     created_at         DateTime  @default(now()) @map("created_at")

     // Relations
     milestone          billing_milestone @relation(...)
     project           Project           @relation(...)
     confirmedBy       User?            @relation(...)
     billing_action_item billing_action_item[]
   }
   ```

4. **Created `billing_action_item` table:**
   ```prisma
   model billing_action_item {
     id                  Int       @id @default(autoincrement())
     trigger_queue_id   Int?      @map("trigger_queue_id")
     milestone_id       BigInt    @map("milestone_id")
     action_type        String    @map("action_type")
     description        String
     due_date           DateTime? @map("due_date")
     assigned_to        Int?      @map("assigned_to")
     status             String    @default("pending")
     completed_at       DateTime? @map("completed_at")
     created_at         DateTime  @default(now()) @map("created_at")

     // Relations
     trigger_queue      billing_milestone_trigger_queue? @relation(...)
     milestone          billing_milestone @relation(...)
     assignedTo         Staff?    @relation(...)
   }
   ```

### Phase 2: Database Migration

**File Created:** `backend/prisma/migrations/20260221000000_billing_trigger_system/migration.sql`

Applied manually to database:
- Added `cm_number` column to `projects` table
- Added `billing_ea_user_id` and `billing_trigger_enabled` to `app_settings`
- Created `billing_milestone_trigger_queue` table
- Created `billing_action_item` table
- Created `billing_overdue_by_attorney` view

### Phase 3: Core Service

**File Created:** `backend/src/services/project-status-trigger.service.ts`

**Key Functions:**

1. **`processStatusChange(projectId, oldStatus, newStatus)`**
   - Main entry point when project status changes
   - Checks if trigger system is enabled
   - Finds matching milestones
   - Creates pending triggers

2. **`findMatchingMilestones(cmNumber, newStatus)`**
   - Finds incomplete milestones for the C/M number
   - Returns milestones that might be triggered by new status

3. **`evaluateTrigger(triggerText, newStatus)`**
   - Keyword-based matching logic
   - Status: "Closed" → keywords: ['close', 'completion', 'final', 'complete', 'done', 'finished']
   - Status: "Terminated" → keywords: ['terminat', 'cancel', 'termination', 'cancellation']
   - Status: "Suspended" → keywords: ['suspend', 'halt', 'pause']
   - Status: "Slow-down" → keywords: ['slow', 'delay', 'defer']
   - Status: "On Hold" → keywords: ['hold', 'wait', 'on']

4. **`createPendingTrigger(data)`**
   - Creates pending trigger record
   - **Includes deduplication check** to prevent duplicate triggers

5. **`confirmTrigger(triggerId, userId)`**
   - Marks milestone as complete
   - Creates action item
   - Updates trigger status

6. **`rejectTrigger(triggerId, userId)`**
   - Rejects trigger without changing milestone

7. **`getOverdueByAttorney(filters)`**
   - Returns overdue milestones grouped by B&C attorney

### Phase 4: API Endpoints

**File Modified:** `backend/src/routes/billing.routes.ts`

**New Endpoints:**

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/billing/triggers/pending` | GET | List pending triggers for EA review |
| `/api/billing/triggers` | GET | List all triggers with filters |
| `/api/billing/triggers/:id/confirm` | POST | EA confirms trigger |
| `/api/billing/triggers/:id/reject` | POST | EA rejects trigger |
| `/api/billing/overdue-by-attorney` | GET | Get overdue billing by attorney |

### Phase 5: Integration with Project Controller

**File Modified:** `backend/src/controllers/project.controller.ts`

Added hook into `updateProject()` function:
- After status change is saved, calls `ProjectStatusTriggerService.processStatusChange()`
- Runs asynchronously (fire-and-forget)
- Logs triggers created

```typescript
// Process billing milestone triggers if status changed
if (status && status !== existingProject.status) {
  ProjectStatusTriggerService.processStatusChange(
    projectId,
    existingProject.status,
    status
  ).then((result) => {
    if (result.triggersCreated > 0) {
      req.log?.info('Billing triggers created...');
    }
  }).catch((err) => {
    req.log?.error('Failed to process billing triggers', { error: err });
  });
}
```

### Phase 6: Dashboard View

**File Modified:** `backend/src/controllers/admin.controller.ts`

Added `billing_overdue_by_attorney` view creation in `recreateBillingViews()`.

### Phase 7: Data Migration - C/M Number Matching

**Files Created:**
- `backend/scripts/import-cm-mapping.ts`
- `backend/scripts/export-missing-cm.ts`
- `backend/scripts/apply-cm-matches.ts`

**Process:**
1. Loaded `project_cm_mapping.json` (213 entries)
2. Matched staffing project names to billing C/M numbers
3. Applied 89 matches to `projects.cm_number` field

---

## Key Features Implemented

### 1. Automatic Trigger Detection
- When project status changes, system checks for linked billing milestones
- Uses keyword matching to determine if milestone should be triggered

### 2. Deduplication
- Prevents creating duplicate pending triggers for same milestone + status
- Check implemented in `createPendingTrigger()` method

### 3. EA Confirmation Workflow
- EA can review pending triggers
- Confirm → milestone marked complete, action item created
- Reject → trigger marked as rejected

### 4. Action Items
- Created automatically when trigger is confirmed
- Includes action type (issue_invoice, follow_up_payment, etc.)
- Due date calculated based on action type

### 5. Overdue Dashboard
- View to track overdue billing by B&C attorney
- Groups milestones by attorney with totals

---

## Files Created/Modified

| File | Action | Purpose |
|------|--------|---------|
| `backend/prisma/schema.prisma` | Modified | Added new models and relations |
| `backend/prisma/migrations/20260221000000_billing_trigger_system/migration.sql` | Created | SQL migration |
| `backend/src/services/project-status-trigger.service.ts` | Created | Core trigger logic |
| `backend/src/controllers/billing-trigger.controller.ts` | Created | API controllers |
| `backend/src/routes/billing.routes.ts` | Modified | Added trigger endpoints |
| `backend/src/controllers/project.controller.ts` | Modified | Hook into status updates |
| `backend/src/controllers/admin.controller.ts` | Modified | Added dashboard view |
| `backend/scripts/import-cm-mapping.ts` | Created | Import C/M matches |
| `backend/scripts/export-missing-cm.ts` | Created | Export unmatched projects |
| `backend/scripts/apply-cm-matches.ts` | Created | Apply matched C/Ms |

---

## Configuration

**Environment Variables:**
- `BILLING_TRIGGER_ENABLED` - Enable/disable trigger system (default: true)

**Database Settings:**
- `AppSettings.billingEaUserId` - User ID of EA for billing confirmations

---

## Testing Checklist

- [x] Change project status to "Closed" → Pending trigger created with confidence >= 0.8
- [x] Same status change again → No duplicate trigger (deduplication works)
- [x] EA confirms trigger → Milestone marked complete, action item created
- [x] EA rejects trigger → Trigger status = 'rejected', no milestone change
- [x] `/api/billing/overdue-by-attorney` → Returns overdue milestones grouped by attorney
- [x] `/api/billing/triggers/pending` → Returns list of pending triggers
- [x] Lifecycle stage change → Creates project_event → Triggers milestone matching
- [x] Date-based sweep → Catches date-driven milestones
- [x] AI-assisted sweep → Reviews events against milestone language
- [x] B&C attorney access → Filtered to own projects only
- [x] Control Tower Finance View → Full invoice workflow functional
- [x] Control Tower My Projects → Shows attorney-specific data

---

## Current Status

- ✅ Schema designed with proper relations
- ✅ Service layer with deduplication
- ✅ API endpoints implemented (14 trigger/control tower endpoints)
- ✅ Integration with project controller (status changes + lifecycle stage changes)
- ✅ Dashboard view created
- ✅ 89+ projects linked to C/M numbers
- ✅ Build successful and deployed to production
- ✅ Database migrations applied via Prisma
- ✅ Frontend Control Tower with 3-view architecture (Finance, Management, My Projects)
- ✅ Date-based and AI-assisted daily sweeps operational
- ✅ Trigger rules with confidence scoring and auto-confirm
- ✅ B&C attorney access enabled (filtered server-side)
- ✅ In-app guides documenting the full workflow

---

## Outstanding Items

1. **Email Notifications:** Billing-specific email alerts not yet implemented (optional enhancement)

## Recent Updates (Feb 25, 2026)

### Frontend Control Tower — Now Implemented ✅
The billing trigger system now has a full frontend UI via the **Billing Control Tower** (`/billing/control-tower`):

- **Finance View** (admin): Two-stage invoice workflow — Needs Confirmation → Ready To Invoice → Invoice Sent
- **Management View** (admin): Read-only portfolio oversight with long stop date risks
- **My Projects** (B&C attorneys + admin): Filtered view showing only the logged-in attorney's triggered milestones, risks, and unpaid invoices

### Additional Trigger Sources
Beyond the original status-change triggers, two additional detection methods now feed the queue:
1. **Date-based sweep** (daily 2 AM HKT) — `billing-milestone-date-sweep.service.ts`
2. **AI-assisted sweep** (daily 2:30 AM HKT) — `billing-milestone-ai-sweep.service.ts` (DeepSeek)

### Lifecycle Stage Triggers
The trigger system now also fires on **lifecycle stage changes** (not just project status changes):
- `ProjectEventTriggerService.processProjectTransition()` runs when lifecycle stage is updated
- Creates `project_event` records → matches milestones → inserts into `billing_milestone_trigger_queue`

### Access Control Updates
- Trigger queue, long stop risks, unpaid invoices, and time-windowed metrics endpoints now use `checkBillingAccess` instead of `adminOnly`
- B&C attorneys can access these endpoints (filtered to their projects server-side)

### Guides Page
- Best Practice Guide updated to explain all three milestone detection methods
- Control Tower workflow documented for each role (Deal Team, Finance, Managers)
