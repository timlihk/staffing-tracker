# Changelog

All notable changes to the Staffing Tracker application will be documented in this file.

## [5.2.0] - 2026-02-26

### Performance, Reliability & UX Polish

#### Backend Optimizations
- **N+1 Query Elimination** — Billing milestone date sweep refactored from per-candidate DB queries to batch-prefetch architecture:
  - 3 upfront `Promise.all` queries build `triggeredSet`, `linkMap`, and `cmProjectMap`
  - `processCandidateWithMaps` uses O(1) Set/Map lookups instead of per-candidate DB calls
  - CM fallback auto-linking pre-populated before parallel batch processing (eliminates race conditions)
  - Auto-link DB inserts bounded to batches of 10 to prevent connection pool saturation
  - `autoLinked` metric correctly counts distinct billing projects (not per-candidate)
- **Excel Sync Atomicity** — Milestone upserts wrapped in transactions with batched writes and RowAccumulator pattern
- **Input Validation Hardening**:
  - `parseOptionalIntQuery` changed from `parseInt()` to `Number()` — rejects partial numerics like `"42abc"` and floats like `"3.5"`
  - Duplicate `milestone_id` rejection in bulk milestone update endpoint (400 response)
- **Migration Safety** — `DROP INDEX CONCURRENTLY` for non-blocking index drops in production

#### Frontend Performance
- **Render Optimization**:
  - `DealRadarCard`: `CustomDay` component wrapped in `useCallback` to prevent re-creation on every render
  - `InsightsPanel`: 4 DonutChart data arrays memoized with `useMemo` (categories, statuses, sectors, sides)
  - `StaffingHeatmapCard`: Sorting replaced with `useMemo`-based pre-computed `sortedRowsByGroup` Map
- **Type Restoration** — 12 missing type exports restored for frontend type safety

#### Billing Control Tower UX
- **Sortable Tables** — Project/Billing Matter column headers now support click-to-sort (asc/desc toggle) across all three views (Invoice Queue, Long Stop Risk, Unpaid Invoices)
- **Searchable Attorney Filter** — B&C Attorney dropdown replaced with MUI `Autocomplete` with type-ahead search

#### Testing
- Added `"42abc"` and `"3.5"` attorneyId rejection tests for billing trigger controller
- Added duplicate `milestone_id` rejection test with 400 assertion for project controller
- Strengthened unique `milestone_id` test to assert full 200 success path with payload validation

### Files Changed
- 10 files modified, ~400 lines added, ~150 lines removed

---

## [5.1.0] - 2026-02-25

### Billing Control Tower & Milestone Detection

#### Control Tower — Three-View Architecture
- **Finance View** (admin only): Full invoice issuance workflow
  - Two-stage process: Needs Confirmation → Confirm + Queue Invoice → Mark Invoice Sent
  - Unpaid invoices tracking (30+ days) for collections follow-up
  - 30/60/90-day billed & collected metrics
- **Management View** (admin only): Portfolio oversight
  - Long stop date risk monitoring (past due + at risk)
  - Read-only invoice queue for awareness
  - Same 30/60/90-day metrics
- **My Projects** (B&C attorneys + admin): Attorney-filtered view
  - Triggered milestones, long stop risks, unpaid invoices for own projects only
  - B&C attorneys can now access Control Tower (previously admin-only)
- All sections collapsible with count badges and arrow toggles

#### Automatic Milestone Trigger Detection
- Three complementary detection methods feeding the Invoice Queue:
  1. **Lifecycle stage changes** (real-time): System checks milestones when deal team updates lifecycle stage
  2. **Date-based sweep** (daily 2 AM HKT): Catches date-driven milestones automatically
  3. **AI-assisted sweep** (daily 2:30 AM HKT): DeepSeek reviews project events as safety net
- `ProjectEventTriggerService.processProjectTransition()` creates project events → matches milestones → queues triggers

#### B&C Attorney Access
- Added `AdminOrBcAttorneyRoute` component for Control Tower access
- Control Tower sidebar menu item now visible to B&C attorneys
- Billing trigger/risk/unpaid endpoints switched from `adminOnly` to `checkBillingAccess` middleware

#### Best Practice Guide Updates
- New section: "How Milestone Detection Works" — explains all three trigger methods with timing
- New section: "Control Tower Workflow" — describes Finance View, Management View, My Projects
- Updated role ownership: Deal Team, Finance, and Manager responsibilities now reference milestone triggers and Control Tower
- Lifecycle Stages section: added alert explaining that stage changes trigger automatic milestone detection
- Billing Best Practice: added items about lifecycle stage updates and Control Tower review

#### React Query Performance Optimizations
- Increased `staleTime` and `gcTime` across billing, project, and staff hooks
- Disabled `refetchOnWindowFocus` to reduce redundant API calls
- Updated default query client settings for better caching behavior

#### Backend Changes
- New endpoint: `GET /billing/time-windowed-metrics` — 30/60/90-day billed & collected totals
- Routes updated: `triggers`, `long-stop-risks`, `unpaid-invoices`, `time-windowed-metrics` now use `checkBillingAccess`
- New hook: `useTimeWindowedMetrics()` for metrics data

#### Frontend Changes
- Updated: `BillingControlTower.tsx` — Complete rewrite with tabbed layout, collapsible sections, attorney-filtered data
- Updated: `App.tsx` — Added `AdminOrBcAttorneyRoute`, new routes
- Updated: `Sidebar.tsx` — Control Tower visible for B&C attorneys
- Updated: `BestPracticeGuide.tsx` — New milestone detection and Control Tower documentation
- Updated: `useBilling.ts` — New hooks, improved caching

### Files Changed
- 9 files changed, 465 insertions, 150 deletions

---

## [5.0.0] - 2026-02-22

### Major Feature: Billing Excel Sync Engine

#### Finance Excel Upload & Sync
- **Excel Parser** (`billing-excel-sync.service.ts`) — Comprehensive parser for the HKCM Project List Excel:
  - Column mapping for 20+ fields (financials, milestones, metadata)
  - Milestone extraction with ordinal detection (`(a)`, `(b)`, `1.`, `2.`, `(i)`, `(ii)`)
  - Amount parsing via 3 regex strategies: end-of-line dash, inline currency, bare number
  - Currency detection (USD default, CNY for RMB/人民币/¥)
  - Percentage extraction alongside amounts
  - Strikethrough completion detection from Excel rich text character-level font data
  - Full-width CJK character normalization (（→(, ）→), etc.)
  - XML namespace preprocessing (`x:`, `ap:`, `vt:` prefix stripping) for ExcelJS compatibility

- **EL Section Splitting** — Single milestone cells split into multiple engagement sections:
  - EL header patterns: `Original EL:`, `Supplemental EL:`, `Updated EL:`, `EL2:`, etc.
  - Ordinals restart per section with suffix deduplication (`(a)`, `(a-2)`, `(a-3)`)

- **Period/Commencement Headers** — 5 new engagement section separators:
  - Chinese date ranges: `(自2023年9月至2024年9月)`
  - Chinese start-only: `(自2021年2月26日計)`
  - English commencement: `(Commencement date: Nov 9, 2021)`
  - Signed-on patterns: `NEW EL signed on Nov 8, 2022`
  - Narrative periods: `本协议的有效期限自2026年1月10日至2027年1月9日`

- **LSD Parsing** — Multiple date format support:
  - English day-first: `31 Mar 2025`
  - English month-first: `Dec 31, 2021`
  - Chinese: `2024年1月31日`
  - ISO: `2024-01-31`
  - Typo handling: `Seo` → September, `Decmeber` → December

#### Unmatched C/M Creation
- New billing projects + C/M records auto-created for Excel rows with unrecognized C/M numbers
- TBC placeholders skipped (not created)
- 45 new billing projects created from Excel

#### Auto-linking to Staffing Projects
- 3-strategy matching for new billing projects:
  1. Exact `cm_number` match on staffing `projects` table
  2. C/M prefix match (e.g., `51251-00002` matches project with `51251-00001`)
  3. PostgreSQL `similarity()` name matching (requires pg_trgm, graceful fallback)
- 34 staffing projects auto-linked, C/M numbers set on staffing project records
- 11 unmatched projects highlighted for manual review

#### Sync Report & History
- **Sync Report Page** (`/billing/sync-report/:id`) — Print-friendly web page:
  - Summary stats (updated, new, skipped, engagements, milestones, staffing links)
  - Unmatched projects section with warning highlight
  - Staffing links table with match method details
  - New billing projects table
  - Financial update diffs with old/new values per field
  - Print CSS with `@media print` rules
- **Sync History Page** (`/billing/sync-history`) — Lists all past sync runs
- **Sync Run Persistence** (`billing_sync_run` table):
  - Stores Excel file (BYTEA), summary JSON, detailed changes JSON
  - Excel file downloadable from any past sync run
  - Indexed by `uploaded_at DESC`

#### Detailed Change Tracking
- Financial field diffs captured before/after for every updated C/M (12 fields tracked)
- New CMs recorded with project name, client, engagement counts
- Staffing link results recorded with match method and whether C/M was set
- Unmatched and skipped CMs tracked for reporting

#### AI Validation (Optional)
- `ai-validation.service.ts` — Reviews parsed milestones against raw text using Claude API
- Flags: missing milestones, ordinal gaps, amount mismatches, unparsed amounts
- Configured via `ANTHROPIC_API_KEY` environment variable (optional)

#### Backend Changes
- New controller: `billing-excel-sync.controller.ts` (preview, apply, history, detail, download)
- New service: `billing-excel-sync.service.ts` (~1,200 lines)
- New service: `ai-validation.service.ts`
- New routes: 5 Excel sync endpoints added to `billing.routes.ts`
- New migration: `20260222000000_add_billing_sync_run`
- New Prisma model: `billing_sync_run` with User relation
- New scripts: `apply-sync.ts`, `dry-run-updates.ts`, `dry-run-excel-sync.ts`

#### Frontend Changes
- New page: `SyncReport.tsx` — Print-friendly sync report with collapsible sections
- New page: `SyncHistory.tsx` — Upload history list with summary stats
- Updated: `BillingExcelSyncPanel.tsx` — Passes filename, shows "View Full Sync Report" link and "Sync History" button
- Updated: `billing.ts` API — Added `SyncRunSummary`, `SyncRunDetail` types and history API functions
- Updated: `App.tsx` — Registered `/billing/sync-report/:id` and `/billing/sync-history` routes

#### Applied Sync Results
- 210 projects updated (165 existing + 45 new)
- 261 engagements upserted
- 266 milestones created, 345 marked completed (strikethrough)
- 34 staffing projects auto-linked
- 11 unmatched new projects (need manual linking)
- 1 skipped (TBC placeholder)

### Files Changed
- 16 files changed (9 modified, 7 new)
- 2,456 lines added, 94 lines removed

---

## [1.6.0] - 2025-01-27

### Code Quality Improvements

#### Backend Architecture
- **Split Billing Controller** - Refactored 1,592-line billing.controller.ts into 8 focused modules:
  - billing-project.controller.ts - Project endpoints
  - billing-engagement.controller.ts - Engagement endpoints  
  - billing-milestone.controller.ts - Milestone endpoints
  - billing-financials.controller.ts - Financial endpoints
  - billing-mapping.controller.ts - Project mapping endpoints
  - billing-settings.controller.ts - Settings endpoints
  - billing-attorney.controller.ts - Attorney endpoints
  - billing.utils.ts - Shared utilities

- **Split Dashboard Controller** - Refactored 926-line dashboard.controller.ts into 6 modules:
  - dashboard-summary.controller.ts - Summary and trends
  - dashboard-activity.controller.ts - Activity logs
  - dashboard-history.controller.ts - Change history
  - dashboard-workload.controller.ts - Workload reports
  - dashboard-heatmap.controller.ts - Staffing heatmap
  - dashboard.utils.ts - Shared utilities

#### Type Safety & Validation
- Fixed JWT type safety - replaced 3 `as any` casts with proper `SignOptions` type
- Added Zod validation for query parameters in project-report.controller.ts
- Added type definitions for Prisma raw queries (8 interfaces)
- Standardized parseInt usage with radix 10 across all controllers

#### Error Handling
- Fixed 18 missing `return` statements in error handlers across 5 controllers
- Prevents "Cannot set headers after they are sent" errors

#### Logging
- Replaced all console.log/console.error in worker and services with structured logger
- Worker script (reminder-cron.ts) now uses logger utility
- Email service logging standardized
- Reports and project-report services use proper log levels

#### Security
- Centralized process.env access through config module
- Strict Helmet CSP with upgradeInsecureRequests, noSniff, xssFilter
- Added request size limits (bulk: 1MB, milestones: 500KB, projects: 2MB)

#### Testing
- Added 3 new billing controller test files with comprehensive coverage
- Fixed test file types - replaced `any` with proper Express types

### Frontend Improvements

#### New Features
- **API Health Monitoring** - Added useHealthCheck hook and HealthStatus component
  - Periodic health checks (30-second interval)
  - Visual alert when server connection fails
  - Retry button for manual health checks

#### Code Quality
- **Date Utilities** - Created frontend/src/lib/date.ts with:
  - Time constants (SECOND, MINUTE, HOUR, DAY, WEEK)
  - DateHelpers utilities (daysAgo, isStale, formatDaysAgo, formatDate, formatDateTime)
  - Replaced magic date calculations across components

- **Pagination** - Fixed hardcoded `limit: 1000` in Projects and Staff pages
  - Proper server-side pagination with DataGrid
  - Page size options: 10, 25, 50, 100

#### Performance
- Lazy loaded Dashboard components (DealRadarCard, StaffingHeatmapCard)
- Optimized Vite bundle with manual chunk splitting
- Memoized date calculations

#### Error Handling
- Added 30-second timeout to API requests
- Network error detection (ECONNABORTED, ERR_NETWORK)
- 5xx server error handling
- User-friendly error messages

### Files Changed
- 26 new files created
- 25+ files modified
- 2,500+ lines added
- 1,600+ lines removed

## [1.14.0] - 2025-10-06

### Added
- ✅ **Weekly Project Confirmation System**
  - New "Weekly Review" page for partners to confirm project details
  - Smart categorization logic identifies projects needing attention vs. all good
  - Projects flagged when: not confirmed in 7+ days, updated since last confirmation, missing critical data, status/team changes
  - Urgency scoring system prioritizes projects by importance
  - "Last Confirmed" tracking shows when and by whom projects were last reviewed

- 🎯 **Intelligent Issue Detection**
  - Separate alerts for "Missing Information" (red, blocks confirmation) vs "Needs Review" (orange, informational)
  - Missing data detection: unassigned BC Attorney, no team, missing filing date
  - Recent change detection: status changes, team composition changes in last 7 days
  - Conditional actions: "Edit to Fix" button for missing data, "Confirm Details" for review-only

- 📊 **Enhanced Project Views**
  - Added "Last Confirmed" column to Projects list with color-coded status (green < 7 days, orange > 7 days, red > 14 days)
  - "Confirm Details" button added to Project Detail page header
  - Shows confirmation timestamp and confirming user
  - User-specific filtering: partners see only their assigned projects, admins see all

- 🎨 **Minimalist UI Design**
  - Clean, focused Weekly Review interface showing only projects needing attention
  - Removed redundant team structure display from project cards
  - Simplified alert titles and removed instructional text
  - Summary cards showing total projects, needing attention count, and all good count

### Technical Details
**Backend:**
- Added `lastConfirmedAt` and `lastConfirmedBy` fields to Project model
- Created `confirmProject()` endpoint (POST /projects/:id/confirm)
- Created `getProjectsNeedingAttention()` endpoint with smart categorization
- Implemented urgency scoring algorithm considering multiple factors
- Added filtering logic: staff-linked users see their projects, admins see all
- Created database indexes for `lastConfirmedAt` field

**Frontend:**
- Created `WeeklyReview.tsx` page component with conditional UI logic
- Added `useConfirmProject()` and `useProjectsNeedingAttention()` hooks
- Updated Project type to include confirmation fields
- Added route `/weekly-review` to App.tsx
- Enhanced Projects list and ProjectDetail pages with confirmation UI
- Implemented separate alert rendering for missing data vs review items

## [1.13.0] - 2025-10-05

### Added
- 📧 **Email Notification Settings Panel**
  - Admin-only settings page in User Management section
  - Global toggle to enable/disable all email notifications
  - Position-specific toggles for granular control (Partner, Associate, Junior FLIC, Senior FLIC, Intern, B&C Working Attorney)
  - Individual toggles automatically disabled when global toggle is off
  - Settings persist across sessions
  - Real-time notification filtering based on settings

- 👥 **Enhanced Deal Radar Team Display**
  - Team members separated into dedicated columns (Partner, Associate, FLIC, Intern)
  - Each column displays all members of that position type
  - Alphabetically sorted names within each position category
  - FLIC column includes both Senior FLIC and Junior FLIC
  - Empty columns show "—" placeholder
  - Added "Side" field column showing project side (buyer/seller/etc.)
  - Removed "Priority" and "Status" columns for cleaner layout

- 🎨 **UI Improvements**
  - Calendar cards wrapped in bordered boxes with grey background
  - Alternating row shading in Deal Radar project table (grey/white)
  - Improved table readability with consistent row backgrounds
  - Simplified Actions column showing only Edit button (removed View/Delete)
  - Deal Radar pagination: Show 10 projects by default with "Show More" button

- 🧪 **Automated Testing Suite** - 52 comprehensive tests added
  - **Backend Tests (33 tests):**
    - Email Settings Controller: 8 tests for GET/PATCH endpoints
    - Email Service: 17 tests for filtering, deduplication, error handling
    - Dashboard Controller: 8 tests including team deduplication
  - **Frontend Tests (19 tests):**
    - useEmailSettings Hook: 8 tests for queries/mutations
    - Dashboard Utils: 11 tests for team categorization logic

- 🔙 **Smart Back Navigation**
  - Created `useSmartBack` hook with 3-tier fallback strategy
  - Checks location.state for 'from' path first
  - Uses browser history navigate(-1) as fallback
  - Defaults to logical path if no history available
  - Applied to all detail and form pages

### Fixed
- 🐛 **Team Member Deduplication** - Fixed duplicate team member entries
  - Staff members with multiple assignments (e.g., Partner + B&C Working Attorney) now appear only once
  - Backend deduplication by staff ID ensures unique team members per project
  - Position shown is the primary staff position from their record

### Changed
- 🔄 **Email Service Enhancements**
  - Email recipients filtered based on position settings before sending
  - Global email toggle checked before processing any notifications
  - Automatic deduplication of email addresses to prevent duplicate sends
  - Enhanced logging showing filtering and deduplication process

### Technical Details
**Backend:**
- Added `EmailSettings` model to Prisma schema with global and position-specific toggles
- Created `email-settings.controller.ts` with GET and PATCH endpoints
- Created `email-settings.routes.ts` with admin-only access control
- Updated `email.service.ts` with:
  - `shouldReceiveNotification()` function to check position-based settings
  - Enhanced `sendProjectUpdateEmails()` with filtering and deduplication
  - Comprehensive logging for email recipient processing
- Updated `dashboard.controller.ts`:
  - Added `side` and `teamMembers` fields to Deal Radar response
  - Implemented team member deduplication using Map by staff ID
  - Included position data in team member objects
- Updated `project.controller.ts` to include staff position in update emails
- Registered email settings routes in `server.ts`

**Frontend:**
- Created `useEmailSettings.ts` hook with GET and PATCH operations
- Updated `UserManagement.tsx`:
  - Added "Email Settings" tab (4th tab)
  - Global toggle using Switch component with enabled/disabled states
  - Six position-specific Switch components
  - Toast notifications on setting updates
  - All position toggles disabled when global toggle is off
- Updated `Dashboard.tsx`:
  - Created `categorizeTeamMembers()` helper function
  - Replaced single Team Members column with 4 separate columns
  - Added "Side" column, removed "Status" column
  - Added alternating row background colors (grey.50 / background.paper)
  - Wrapped calendar cards in bordered Box components with grey.50 background
  - Added pagination: Show 10 events by default, "Show More" to expand
  - Auto-reset pagination when time range changes
- Updated `types/index.ts`:
  - Added `side` and `teamMembers` fields to DashboardSummary.dealRadar type
  - Team members include id, name, and position
- Created `useSmartBack.ts` hook for intelligent back navigation
- Updated `Projects.tsx` and `Staff.tsx`:
  - Simplified Actions column to show only Edit button
  - Removed View and Delete buttons for cleaner interface
- Updated `ProjectDetail.tsx`, `ProjectForm.tsx`, `StaffDetail.tsx`, `StaffForm.tsx`:
  - Integrated useSmartBack hook for proper navigation history

**Testing:**
- Backend: Created comprehensive test suites with Jest
  - `email-settings.controller.test.ts`: 8 tests
  - `email.service.test.ts`: 17 tests
  - `dashboard.controller.test.ts`: Added 3 tests for deduplication
- Frontend: Created test suites with Vitest
  - `useEmailSettings.test.tsx`: 8 tests for hook behavior
  - `dashboard.utils.test.ts`: 11 tests for team categorization
- All 52 tests passing with proper mocking and edge case coverage

## [1.12.0] - 2025-10-05

### Added
- 🎯 **Team Members on Project Creation Page**
  - Select staff members when creating new projects
  - Autocomplete dropdown with duplicate prevention
  - Auto-assign jurisdiction (default: HK Law)
  - Display team members with position and jurisdiction info
  - Visual chips showing: "Name - Position (Jurisdiction)"
  - Bulk assignment API call after project creation
  - Full-width staff selector using flex layout
  - Remove team members before submission

### Fixed
- 🐛 **Project Creation Bug** - Critical fix for "Invalid project ID" error
  - Fixed isEdit condition using Boolean check with NaN validation
  - Changed from `id !== 'new'` to `Boolean(id && id !== 'new' && !isNaN(Number(id)))`
  - Added NaN validation in updateProject controller
  - Better error logging showing ID parameter value
  - Proper "Invalid project ID" error response for NaN values

### Technical Details
**Backend:**
- Enhanced `updateProject` in `project.controller.ts`:
  - Added projectId validation: `const projectId = parseInt(id); if (isNaN(projectId)) return 400`
  - Improved logging: `console.log('Update project request - ID:', id, 'Body:', ...)`
  - Returns proper 400 error for invalid IDs

**Frontend:**
- Updated `ProjectForm.tsx` with team members feature:
  - New TeamMember interface with staffId, staffName, position, jurisdiction
  - State management for team members, selected staff, jurisdiction
  - `handleAddTeamMember` and `handleRemoveTeamMember` functions
  - Bulk assignment API call: `POST /assignments/bulk`
  - Position data pulled from staff.position
  - Autocomplete with staff filtering (removes already-added members)
- Fixed isEdit logic to prevent false positives

## [1.11.0] - 2025-10-05

### Added
- 📅 **Dashboard Time Range Selector**
  - Time range dropdown at top-right of dashboard (30 days, 2 months, 3 months, 4 months)
  - Applies to both Deal Radar and Staffing Heatmap
  - Backend accepts `days` query parameter in `/api/dashboard/summary`

- 📆 **Calendar View in Deal Radar**
  - Multiple calendar cards displaying 1-4 months based on selected time range
  - Color-coded dots on calendar dates: blue for Filing events, purple for Listing events
  - Legend showing Filing (blue) and Listing (purple) indicators
  - Calendars use `referenceDate` prop to control displayed months
  - Only today's date highlighted in blue across all calendars
  - Dots only appear for events within the displayed month (no overflow from adjacent months)

- 📋 **Table Format for Deal Radar Events**
  - Replaced card-based event display with compact table
  - Columns: Date, Type, Project, Category, Status, Priority
  - All events sorted chronologically by date
  - Clickable rows navigate to project details
  - More space-efficient layout

- 📊 **Dynamic Staffing Heatmap Intervals**
  - Smart interval calculation to maintain ~6 columns maximum
  - 30 days: 7-day intervals (weekly view)
  - 60 days: 10-day intervals (biweekly view)
  - 90 days: 15-day intervals
  - 120 days: 20-day intervals (monthly view)
  - Period-based architecture with `findPeriodForDate` helper function

- 🍔 **Hamburger Menu Sidebar Toggle**
  - Click-based sidebar toggle replaces hover-based expansion
  - Hamburger menu button positioned at top-left of sidebar
  - Button centered when collapsed, left-aligned when expanded
  - Smooth 0.2s transitions

### Fixed
- 🐛 **Calendar Date Timezone Issues**
  - Fixed dots appearing on wrong dates due to UTC conversion
  - Use local timezone components (`getFullYear()`, `getMonth()`, `getDate()`)
  - Extract date strings directly without `new Date()` conversion on event dates

- 🐛 **Calendar Highlighting**
  - Fixed first day of each month being highlighted in blue
  - Changed from `value={month}` to `value={null}` with `referenceDate={month}`

- 🐛 **Calendar Month Display**
  - Fixed all calendars showing same month (October repeated 4 times)
  - Properly generate array of consecutive months
  - Use unique keys based on year and month

### Changed
- 🎨 **Sidebar Interaction** - Changed from hover-based to click-based expansion
- 📐 **Toolbar Spacing** - Reduced toolbar padding from `py: 2` to `py: 1`

### Technical Details
**Backend:**
- Updated `dashboard.controller.ts` to accept `days` query parameter (default 30)
- Implemented dynamic period calculation with smart interval strategy
- Created `Period` interface with `key`, `start`, `end` properties
- Added `findPeriodForDate` helper to map milestone dates to periods
- Updated `formatWeekKey` to accept optional `customEndDate` parameter
- Period definitions built before mapping milestone dates

**Frontend:**
- Added time range state management in `Dashboard.tsx`
- Updated `useDashboard` hook to accept and pass `days` parameter
- Included `days` in TanStack Query key for proper cache management
- Imported MUI X Date Pickers components (`DateCalendar`, `LocalizationProvider`, `AdapterDateFns`, `PickersDay`)
- Created `CustomDay` component to render dots on calendar dates
- Used `outsideCurrentMonth` prop to hide dots for adjacent month dates
- Updated `Layout.tsx` to pass `onToggle` callback to `Sidebar`
- Added `Menu` icon button to `Sidebar.tsx` with click handler
- Removed `onMouseEnter`/`onMouseLeave` events from layout

## [1.10.0] - 2025-10-04

### Added
- 📊 **Enhanced Admin Panel Activity Tracking**
  - New detailed Activity Log showing field-level changes for staff and projects
  - Shows exactly what changed: "Changed from X to Y" instead of generic descriptions
  - Separated User Change Log and Activity Log (staff/project changes) into different tabs
  - Clickable entity names to navigate directly to staff or project detail pages
  - Displays field name, old value, new value, who made the change, and when

### Changed
- 🔗 **Clickable Usernames** - Usernames in admin panel now link to staff detail pages (when staff record exists)
- 📧 **Email Normalization** - New user emails are automatically stored in lowercase
- 🔙 **Smart Back Button** - Staff detail page back button returns to admin panel when navigated from there
- 📱 **Responsive Tables** - Improved DataGrid column width behavior - columns now shrink and expand with window resize
- 🎨 **UI Improvements** - Removed user count subtitle from Admin Panel header

### Technical Details
**Backend:**
- Added `getDetailedChangeHistory` endpoint at `/dashboard/change-history`
- Fetches from `StaffChangeHistory` and `ProjectChangeHistory` tables
- Returns field-level change details including old/new values, field names, and change types
- Supports filtering by entity type (staff/project) or combined view

**Frontend:**
- Updated `UserManagement.tsx` with three-tab layout: Users, User Change Log, Activity Log
- New column structure showing entity type, entity name, field, changes, and performed by
- Added window resize handler to force DataGrid remount for proper column width recalculation
- Enhanced navigation with location state to preserve user flow from admin panel
- Made username cells clickable when linked to staff records

## [1.9.0] - 2025-10-04

### Added
- 📧 **Email Notifications** - Automatic email notifications for project updates
  - Staff members receive emails when projects they're assigned to are updated
  - Notifications sent for status changes, date changes, and other project updates
  - Professional HTML email templates with project details and direct links
  - Only staff with email addresses on file receive notifications
  - All notification emails automatically BCC mengyu.lu@kirkland.hk for oversight
  - Uses Resend email service (free tier: 3,000 emails/month)
- 🎨 **Table Styling Improvements**
  - Deep blue header backgrounds on all data tables (Staff, Projects, Project Report)
  - White text and icons for better contrast
  - Darker alternating row colors (grey.100) for improved readability
  - Print-friendly version of Project Report showing all filtered rows

### Technical Details
**Backend:**
- Installed Resend package (`resend@^6.1.2`)
- Created `/backend/src/services/email.service.ts` - Email service with templates and change detection
- Updated project controller to send email notifications on updates
- Added environment variables: `RESEND_API_KEY`, `EMAIL_FROM`

**Frontend:**
- Updated StyledDataGrid component with professional color scheme
- Updated ProjectReport with print-only table variant
- White sort icons and improved hover states

**Documentation:**
- Created `EMAIL_SETUP.md` - Complete guide for setting up Resend with Cloudflare domain

## [1.8.1] - 2025-10-04

### Changed
- 🎨 Improved table styling with deep blue headers and alternating row colors

## [1.8.0] - 2025-10-04

### Added
- 📊 Excel export functionality for Project Report page
  - Professional formatting with summary and data sheets
  - Includes all project details and team assignments by position
  - Respects current filter selections (category, status, priority, team member)
  - Auto-filter enabled for easy data manipulation
  - Zebra striping and borders for improved readability
- 🔒 Permission-based access controls for Project Report export/print features
  - Export Excel and Print buttons only visible to Admin and Editor roles
  - Viewer role users cannot access export functionality

### Changed
- 🎨 Updated Project Report page header with new Export Excel button

### Technical Details
**Backend:**
- Created `/backend/src/services/project-report.excel.ts` - Excel workbook builder using ExcelJS
- Added `getProjectReportExcel` controller method in `/backend/src/controllers/project-report.controller.ts`
- Added `/api/reports/project-report/excel` route endpoint

**Frontend:**
- Implemented `onExportExcel` handler with blob download in `/frontend/src/pages/ProjectReport.tsx`
- Integrated `usePermissions` hook to control button visibility
- Added FileDownloadIcon for Export Excel button

## [1.7.1] - 2025-10-04

### Added
- 🔍 Added team member filter to Projects page - filter projects by assigned staff member.
- 📊 Added team member filter to Project Report page - filter report by staff assignments.

### Changed
- 🏢 Removed "B&C" as a valid department option for staff - only "US Law" and "HK Law" are now available.
- 🔍 Updated staff list page filter to use "Position" terminology instead of "Role".

### Fixed
- 🐛 Fixed position filtering on staff list page - backend now correctly accepts 'position' query parameter.
- 🎨 Fixed staff table not displaying position values due to field name mismatch.

## [1.7.0] - 2025-10-04

### Changed
- 🔄 **BREAKING**: Renamed `Staff.role` to `Staff.position` across database, API, and UI for clearer terminology.
- 🗑️ **BREAKING**: Removed `ProjectAssignment.roleInProject` field - staff position is now the single source of truth.
- 🔒 Updated unique constraint on assignments to `(projectId, staffId, jurisdiction)` to prevent duplicates.
- 📊 Modified dashboard staffing heatmap to group by staff position instead of removed roleInProject.
- 📝 Updated all reports and exports to display staff position consistently.
- 🎯 Simplified assignment tracking - position comes from staff record, eliminating data inconsistencies.

### Fixed
- ✅ Resolved data consistency issues where staff members showed different positions across projects.
- 🐛 Fixed dashboard heatmap incorrectly grouping all staff under "Other Roles".
- 🔧 Fixed StaffDetail page crash from accessing undefined roles array.

### Migration
- Automatic database migration removes duplicate assignments and renames fields.
- Existing data preserved - staff position remains consistent across all projects.

## [1.6.1] - 2025-10-03

### Added
- 🔒 Dedicated logout control in the sidebar so users can immediately end their session.

### Changed
- ⏱️ Sessions now expire automatically after 30 minutes of inactivity and notify the user before redirecting to the login screen.
- 🧹 Frontend cache is cleared on logout to ensure sensitive data is removed from memory.


## [1.3.1] - 2025-10-03

### Changed
- 📚 Documented the `npm run db:fix-ip-role` maintenance script used to normalize legacy "IP" assignments to "Partner" after historical imports.
- 🗒️ Added notes clarifying that older planning docs reference "IP" as the former label for partners.


## [1.4.0] - 2025-10-03

### Added
- 📅 Introduced dedicated `filingDate` and `listingDate` fields across the API, reports, and UI (project forms, detail, and staffing report exports).
- 🗂️ Expanded project report table with filing/listing columns and sortable headers; staff assignment tables now show the same dates with sorting.
- 📈 Reimagined dashboard with an upcoming milestones timeline and "busy staff" focus driven by filing/listing dates.

### Changed
- 🔁 Shortened project category labels to `HK Trx`, `US Trx`, `HK Comp`, `US Comp`, `Others`, and migrated existing data/scripts accordingly.
- 👥 Streamlined staff detail and edit layouts (vertical fields, resized edit button) and removed B&C attorneys from the Team Members card.
- 🛡️ Adjusted data imports to respect the new categories and optional admin seeding flag while retaining separate B&C attorney presentation.


## [1.5.0] - 2025-10-03

### Added
- 🧑‍💼 Admin-facing user management API (`/api/users`) with list, create, role-update, and password-reset support.
- 🔐 Password reset enforcement workflow: new users receive a temporary password, must reset on first login, and admins can regenerate temps on demand.
- 🌐 Frontend "User Management" page (admin-only) plus a first-login `ResetPassword` screen; sidebar navigation now surfaces the admin tool.

### Changed
- 🔑 Login responses flag accounts that require a reset and deliver a short-lived token for the reset endpoint.
- 📦 Prisma schema now tracks `mustResetPassword`; migration guards prevent conflicts with existing columns.


## [1.6.0] - 2025-10-03

### Added
- 📅 "Deal Radar" view highlighting filings/listings over the next 30 days with lead-partner context and quick navigation.
- 🔥 Staffing heatmap and action cards for unstaffed milestones and pending password resets.

### Changed
- 📊 Dashboard summary cards now emphasize active counts and upcoming filings/listings.
- 🎨 Updated layout combines a streamlined deal radar with a rank-grouped staffing heatmap for quick scanning.
- 👥 Project detail pages now show the team roster in a sortable table for faster scanning.


## [1.3.0] - 2025-10-03


### Added
- ✨ TanStack Query (React Query) v5 for intelligent data caching and synchronization
- ✨ React Hook Form + Zod for type-safe form validation
- ✨ Sonner toast notifications for user feedback
- ✨ Loading skeleton screens for improved perceived performance
- ✨ Global error boundary for graceful error handling
- ✨ Clickable rows in Project Report for navigation to project details
- 📊 Restructured StaffDetail page with horizontal layout
- 📝 Added frontend `.env` configuration for localhost development

### Fixed
- 🐛 Fixed CircularProgress errors in production (removed orphaned imports from Projects.tsx and Staff.tsx)
- 🐛 Fixed project navigation from Project Report using real database IDs
- 🐛 Fixed project-report.service.ts to include projectId in response
- 🐛 Fixed TypeScript compilation errors preventing deployment (removed all isLead references)
- 🐛 Fixed localhost development environment by creating frontend `.env` file and regenerating Prisma client

### Changed
- 🔄 **BREAKING**: Completely removed "Lead" field from application
  - Removed `isLead` from ProjectAssignment model in database
  - Removed "Lead" chips from StaffDetail and ProjectDetail displays
  - Removed "Lead" column from Reports page and Excel exports
  - Updated all controllers, services, and migration scripts
- 🎨 Improved StaffDetail layout with Role, Department, Email, and Active Projects in single row
- 🎨 Component decomposition: Extracted chart components from Dashboard
- 🔧 Merged duplicate staff records (William/WIlliam, Tingting/TIngting)

### Technical Details
**Frontend:**
- Migrated to TanStack Query with custom hooks (useDashboard, useProjects, useStaff)
- Implemented React Hook Form in Login, ProjectForm, and StaffForm
- Created reusable skeleton components for loading states
- Removed isLead from TypeScript types (frontend/src/types/index.ts)
- Updated StaffDetail.tsx with horizontal layout
- Updated ProjectDetail.tsx, Reports.tsx to remove Lead displays

**Backend:**
- Created migration `20251003034500_remove_is_lead` to drop is_lead column
- Removed isLead from Prisma schema
- Updated assignment.controller.ts (create/update/bulk operations)
- Updated dashboard.controller.ts (workload report)
- Updated reports.service.ts and reports.types.ts
- Updated project-report.service.ts (added projectId)
- Updated migrate-excel.ts and sync-from-excel.ts scripts
- Updated reports.excel.ts (Excel export)

### Database
- Migration: `20251003034500_remove_is_lead` - Dropped is_lead column from project_assignments table
- Merged duplicate staff records in production

## [1.2.0] - 2025-10-02

### Added
- ✨ Sorting functionality to Project Report table (project name and category columns)
- 📊 TableSortLabel components with ascending/descending toggle
- 🎯 Memoized sorting logic for improved performance

### Fixed
- 🐛 Project Report table alignment issues - removed artificial centering
- 🐛 Fixed CSS layout conflicts in `index.css`, `App.css`, and `Layout.tsx`
- 🐛 Optimized column widths across all tables (Projects, Staff, Project Report)
- 🐛 Fixed search box width in Projects page
- 🐛 Increased project list pagination to show all 90 projects (from 50)

### Changed
- 🔄 Updated role naming from "Income Partner" to "Partner" throughout the system
- 🔄 Database migration: Updated 10 staff records with new role name
- 🔄 Updated frontend filters and backend services for Partner role
- 🔄 Merged duplicate staff members (Jing and Jing Du into single "Jing Du" entry)
- 🔄 Replaced MUI DataGrid with standard Table component in Project Report for better layout control

### Technical Details
- Updated `backend/src/services/project-report.service.ts` (Partner role)
- Updated `frontend/src/pages/ProjectReport.tsx` (sorting + layout fixes)
- Updated `frontend/src/pages/Projects.tsx` (column widths + limit=1000)
- Updated `frontend/src/pages/Staff.tsx` (column widths + Partner filter)
- Updated `frontend/src/components/Layout.tsx` (justifyContent: flex-start)
- Updated `frontend/src/index.css` (removed flex centering)
- Updated `frontend/src/App.css` (removed max-width constraint)

### Database
- Migration: `20251002214500_rename_ip_to_partner`
- Updated 10 staff records in production database
- Merged staff member IDs (60 → 18) with 16 project assignments

## [1.1.0] - 2025-10-02

### Added
- 🚀 Initial production deployment to Railway
- 📊 Complete Project Report with filtering capabilities
- 🔐 JWT authentication with role-based access control
- 📈 Dashboard with charts and analytics
- 👥 Staff management with CRUD operations
- 📋 Project management with CRUD operations
- 🔄 Change history tracking for projects and staff
- 📝 Activity logging throughout the application

### Features
- Backend: Express.js + TypeScript + Prisma + PostgreSQL
- Frontend: React 19 + TypeScript + Material-UI v7 + Vite
- Hot module replacement for development
- Responsive design with sidebar navigation
- Protected routes with authentication guards
- Excel data migration scripts

## [1.0.0] - 2025-10-02

### Initial Release
- 🎉 Initial scaffolding and project setup
- 📦 Database schema design with Prisma
- 🏗️ Backend API implementation
- 🎨 Frontend application structure
- 🔧 Development environment configuration
- 📚 Documentation (README, IMPLEMENTATION_PLAN, DEPLOYMENT_GUIDE)

---

**Format:** [Version] - YYYY-MM-DD
**Categories:** Added, Changed, Deprecated, Removed, Fixed, Security
