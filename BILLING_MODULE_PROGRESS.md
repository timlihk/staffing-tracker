# Billing Module - Implementation Progress

**Last Updated:** February 25, 2026
**Status:** Phase 8 Complete - Billing Control Tower with 3-View Architecture (v5.1.0)

---

## Table of Contents
1. [Completed Tasks](#completed-tasks)
2. [Current Status](#current-status)
3. [Pending Tasks](#pending-tasks)
4. [Known Issues](#known-issues)
5. [How to Use](#how-to-use)
6. [Technical Details](#technical-details)

---

## Completed Tasks

### Phase 1: Database Setup ✅

- [x] Created billing database schema migration (13 tables + 2 views)
  - `billing_project` - Main project information
  - `billing_project_cm_no` - C/M numbers for each project
  - `billing_engagement` - Engagement details with financial tracking
  - `billing_source_transactions_raw` - Raw CSV import data
  - `billing_fee_arrangement` - Fee agreement details with LSD tracking
  - `billing_milestone` - Parsed milestones with completion tracking
  - `billing_invoice` - Invoice records
  - `billing_payment` - Payment tracking
  - `billing_event` - Billing events timeline
  - `billing_finance_comment` - Financial comments
  - `billing_bc_attorney_staff_map` - Attorney name to staff mapping
  - `billing_staffing_project_link` - Link to staffing projects
  - `billing_access_settings` - Module access control
  - **Views:**
    - `billing_engagement_financial_summary` - Aggregated financial data
    - `billing_bc_attorney_dashboard` - Complete project view with all metrics

- [x] Applied migration successfully to Railway PostgreSQL
- [x] Imported 179 source transactions from CSV
- [x] Parsed into 177 billing projects

### Phase 2: Data Processing ✅

- [x] Created auto-mapping script for B&C attorneys
  - Uses Levenshtein distance algorithm (70% threshold)
  - Auto-mapped 9 attorneys
  - Flagged 50 for manual review

- [x] Created fee arrangement parser
  - Parses LSD (Long Stop Date) from text
  - Extracts milestones with amounts and percentages
  - Handles multiple formats (Chinese and English)
  - Successfully parsed 134 fee arrangements
  - Verified 92 fees against Excel source

- [x] Added bonus tracking
  - Created `bonus_usd` and `bonus_cny` fields in database
  - Parser extracts bonus amounts from Chinese text
  - Example: "不低于10万美元奖金" → $100,000 USD
  - Found and stored 1 bonus (Nature project: $100,000)

- [x] Multi-currency support
  - All financial fields have USD and CNY variants
  - Separate columns for: agreed_fee, billing, collection, ubt, billing_credit, bonus

### Phase 3: Backend API ✅

- [x] Created billing controller with 9 endpoints:
  - `GET /api/billing/projects` - List all projects (with B&C attorney filtering)
  - `GET /api/billing/projects/:id` - Get project detail
  - `PATCH /api/billing/projects/:id/financials` - Update UBT/Credits (admin only)
  - `GET /api/billing/settings/access` - Get access settings
  - `PATCH /api/billing/settings/access` - Update access settings (admin only)
  - `GET /api/billing/mapping/suggestions` - Get auto-mapping suggestions
  - `POST /api/billing/mapping/link` - Link billing to staffing projects
  - `GET /api/billing/attorneys/unmapped` - Get unmapped attorneys

- [x] Implemented access control middleware
  - Checks `billing_access_settings` table
  - Supports: `admin_only` and `admin_and_bc_attorney` modes
  - B&C attorneys only see their assigned projects

- [x] Fixed BigInt serialization issue
  - Added `convertBigIntToNumber()` helper function
  - Properly converts PostgreSQL BIGINT to JavaScript number for JSON

### Phase 4: Frontend UI ✅

- [x] Created API client (`frontend/src/api/billing.ts`)
  - TypeScript interfaces for all data types
  - Axios-based API calls

- [x] Created TanStack Query hooks (`frontend/src/hooks/useBilling.ts`)
  - Query keys pattern for cache management
  - Mutations with automatic cache invalidation
  - Optimistic updates

- [x] Created Billing Matters list page
  - DataGrid with sortable/filterable columns
  - Columns: Project Name, Client, C/M No, B&C Attorney, Fees, Billed, Collected, Credit, UBT, Bonus, Link status
  - Color-coded chips (Credit=green, UBT=warning, Bonus=blue)
  - Click row to navigate to detail page
  - Light grey header background for readability

- [x] Created Billing Matter Detail page
  - Three-tab interface:
    - **Fee Arrangement**: Original text, parsed milestones, LSD
    - **Milestones**: List of payment milestones with completion status
    - **Events Timeline**: Billing events history
  - Financial Summary card with USD/CNY sections
  - Admin-only "Update Financials" button
  - Link to associated staffing project (if mapped)

- [x] Added Billing Settings tab to Admin Panel
  - Master toggle: Enable/Disable billing module
  - Access level dropdown: Admin Only / Admin + B&C Attorneys
  - Informational notes about access restrictions

- [x] Added Billing menu item to Sidebar
  - AttachMoney icon
  - Appears for all users (access controlled server-side)

- [x] Integration with routing
  - Routes: `/billing` and `/billing/:id`
  - Protected routes with authentication
  - Lazy-loaded components

### Phase 5: Enhanced Data Import ✅

- [x] Imported additional financial data from parsed HTML JSON
  - Source: `merged_full_plus_milestones.json` (176 projects)
  - Successfully matched all projects using fuzzy name matching
  - Handled name variations (extra spaces, suffixes like "- supplemental", "- RMB")

- [x] Billing & Collection data import
  - Imported 112 billing invoice records ($85.5M total billed)
  - Imported 107 collection payment records ($80.8M total collected)
  - Created invoice-payment relationships
  - Removed 82 duplicate payments from previous runs

- [x] Finance Comments import
  - Imported 250 detailed finance comments
  - Includes billing dates, collection dates, and transaction details
  - Fingerprint-based deduplication
  - Example: "1st instalment $630K billed on 3 Mar 2021 (Rec'd 30 Mar 2021)"

- [x] Data verification
  - Sample verification confirmed amounts match source JSON
  - Fixed duplicate payment issue
  - Updated import script to prevent future duplicates
  - All 176 projects successfully matched and imported

- [x] Frontend notification
  - Added success alert banner on Billing Matters page
  - Shows import summary statistics
  - Reminds users to verify critical financial data

### Phase 6: Milestone Update Functionality ✅

- [x] Fixed milestone update display issue (Oct 7, 2025 22:26)
  - **Problem**: Milestone updates saved to database but not showing in UI table
  - **Root Cause**: React Query cache management conflict with optimistic updates
  - **Solution Implemented**:
    - Simplified cache invalidation in `useUpdateMilestones` hook
    - Removed complex optimistic updates causing cache conflicts
    - Added `removeQueries` to force fresh data fetch
    - Set `gcTime: 0` for billing project query to prevent stale cache
    - Added cache-control headers in backend responses
    - Added small delay after save to ensure DB commit completion

- [x] Enhanced milestone editing UI
  - Functional milestone edit dialog with proper data flow
  - Checkbox for completion status
  - Date pickers for invoice sent and payment received dates
  - Notes field for additional information
  - Real-time state management with proper React hooks

- [x] Backend API improvements
  - Added cache-control headers to milestone update endpoint
  - Ensured fresh data on every request to prevent stale reads
  - Proper logging for debugging milestone updates

- [x] Data flow verification
  - API endpoint: `PATCH /api/billing/milestones`
  - Proper data transformation from UI to API format
  - Confirmed database updates are executing correctly
  - Verified data retrieval includes all milestone fields

- [x] Files Modified for the Fix:
  - `frontend/src/hooks/useBilling.ts` - Simplified cache management (lines 107-125)
  - `frontend/src/pages/BillingMatterDetail.tsx` - Added delay after save (lines 333-339)
  - `backend/src/controllers/billing.controller.ts` - Added cache headers (lines 399-402)

### Phase 7: Finance Excel Sync Engine ✅ (Feb 2026, v5.0.0)

- [x] **Excel Parser** (`billing-excel-sync.service.ts`, ~1,200 lines)
  - Parses HKCM Project List Excel (data starts row 5, 20+ columns)
  - XML namespace preprocessing for ExcelJS compatibility
  - Full-width CJK character normalization
  - Sub-row inheritance (empty C/M inherits from parent row)
  - Milestone extraction with 3 amount regex strategies
  - Strikethrough completion detection from rich text font data
  - EL section splitting with ordinal restart per section
  - Period/commencement header detection (5 regex patterns)
  - LSD parsing from 4 date formats with typo handling
  - Currency and percentage detection

- [x] **Unmatched C/M Creation**
  - Auto-creates `billing_project` + `billing_project_cm_no` for new C/M numbers
  - Skips TBC placeholders
  - 45 new billing projects created from Excel upload

- [x] **Auto-linking to Staffing Projects**
  - 3-strategy matching: exact cm_number → C/M prefix → name similarity
  - 34 projects auto-linked, 11 unmatched
  - Sets `cm_number` on staffing project record if not already set
  - Creates `billing_staffing_project_link` record

- [x] **Detailed Change Tracking**
  - Financial field diffs (12 fields) captured before/after for each updated C/M
  - New CMs, staffing links, unmatched entries, skipped CMs recorded
  - `SyncRunChanges` interface with typed arrays for each category

- [x] **Sync Run Persistence** (`billing_sync_run` table)
  - Stores Excel file (BYTEA), summary JSON, changes JSON, staffing links JSON
  - Indexed by `uploaded_at DESC`
  - API endpoints: list history, get detail, download stored Excel

- [x] **Sync Report Page** (`/billing/sync-report/:id`)
  - Print-friendly layout with `@media print` CSS
  - Summary chips, unmatched projects warning, staffing links table
  - New billing projects table, financial update diffs
  - Collapsible sections, Print/Download/Back buttons

- [x] **Sync History Page** (`/billing/sync-history`)
  - Lists all past sync runs with summary stats
  - Click to view full report, clickable rows

- [x] **Frontend Integration**
  - `BillingExcelSyncPanel` passes filename, shows "View Full Sync Report" link
  - "Sync History" button added
  - New API types: `SyncRunSummary`, `SyncRunDetail`

- [x] **AI Validation** (optional)
  - Reviews parsed milestones against raw text using Claude API
  - Flags missing milestones, ordinal gaps, amount mismatches
  - Configured via `ANTHROPIC_API_KEY` env var

- [x] **Dry-run Scripts**
  - `dry-run-updates.ts` — Shows all DB updates with staffing matches
  - `dry-run-excel-sync.ts` — Shows raw parsing results
  - `apply-sync.ts` — Applies sync and stores run via CLI

- [x] **Applied Sync Results**
  - 210 projects updated (165 existing + 45 new)
  - 261 engagements, 266 milestones created, 345 marked completed
  - 34 staffing projects auto-linked
  - Sync run stored as ID 1

- [x] **Comprehensive Documentation**
  - `Billing/PARSING-GUIDE.md` — Complete parser reference (290 lines)
  - Covers: column mapping, row types, milestone parsing, EL sections, LSD parsing
  - Validation checklist for AI review (true issues vs false positives)
  - Known limitations documented

---

## Current Status

### ✅ Fully Operational Features

1. **Finance Excel Sync Engine** (NEW in v5.0.0)
   - Upload HKCM Project List Excel → auto-sync all billing data
   - 210 projects synced (165 updated + 45 newly created)
   - 261 engagements, 611 milestones (345 completed via strikethrough)
   - 34 staffing projects auto-linked by C/M number matching
   - Detailed sync reports with financial diffs
   - Upload history with stored Excel files
   - Print-friendly report pages

2. **Billing Dashboard**
   - View all 210+ billing projects
   - Multi-currency financial data (USD/CNY)
   - Financial fields synced directly from Excel (verbatim)
   - B&C attorney assignments
   - Link status to staffing projects

3. **Milestone Completion Detection** (RESOLVED in v5.0.0)
   - ✅ Excel strikethrough auto-detected from rich text formatting
   - 345 milestones auto-marked completed from strikethrough data
   - Completion is a one-way latch (won't unmark on re-upload)
   - Manual UI updates also supported

4. **Access Control**
   - Admin-only mode working
   - Admin + B&C attorney mode working
   - B&C attorneys filtered to see only their projects

5. **Financial Tracking**
   - All financial fields synced from Excel: agreed fees, billing, collection, billing credit, UBT, AR
   - USD and CNY variants for all fields
   - Billed but unpaid and unbilled per EL
   - Finance remarks and matter notes

6. **Milestone Management**
   - Full CRUD operations for milestone tracking
   - Completion status with checkbox interface
   - Invoice sent and payment received date tracking
   - Notes field for additional documentation
   - Real-time updates with proper cache management

7. **Sync Report & History**
   - Each sync stored with Excel file, changes JSON, and summary
   - Print-friendly report page with collapsible sections
   - Financial diffs showing old vs new values
   - Unmatched projects highlighted for manual linking
   - Staffing links with match method details

8. **Billing Control Tower** (NEW in v5.1.0)
   - Three-view tabbed interface:
     - **Finance View** (admin): Invoice issuance workflow — confirm triggered milestones → queue invoice → mark sent. Tracks unpaid invoices 30+ days.
     - **Management View** (admin): Portfolio oversight — long stop date risks, billing pipeline, read-only invoice queue.
     - **My Projects** (B&C attorneys + admin): Filtered to own projects — triggered milestones, long stop risks, unpaid invoices.
   - All sections collapsible with count badges (metrics, trigger queue, long stop risks, unpaid invoices)
   - 30/60/90-day billed & collected metrics via time-windowed endpoint
   - B&C attorneys can now access Control Tower (previously admin-only)

9. **Automatic Milestone Trigger Detection** (NEW in v5.1.0)
   - Three complementary detection methods:
     - **Lifecycle stage changes** (real-time): When deal team updates lifecycle stage, system immediately checks for matching milestones
     - **Date-based sweep** (daily 2 AM HKT): Catches date-driven milestones even if lifecycle wasn't updated
     - **AI-assisted sweep** (daily 2:30 AM HKT via DeepSeek): Safety net reviewing project events against milestone language
   - All triggers feed into Control Tower Invoice Queue for Finance confirmation
   - Two-stage invoice workflow: Needs Confirmation → Ready To Invoice → Invoice Sent

10. **Best Practice Guide Updates** (NEW in v5.1.0)
    - Guides page updated with milestone detection workflow explanation
    - Control Tower workflow documentation (Finance View, Management View, My Projects)
    - Role-specific responsibilities updated for billing milestone awareness
    - Three detection methods explained with timing details

11. **React Query Performance Optimizations** (NEW in v5.1.0)
    - Increased staleTime/gcTime across billing, project, and staff hooks
    - Disabled refetchOnWindowFocus to reduce redundant API calls
    - Updated default query client settings for better caching

---

## Pending Tasks

### High Priority

- [x] **Import Additional Financial Data** ✅
  - Imported billing invoices and collection payments from JSON
  - Imported finance comments with transaction details
  - Fuzzy matching for project name variations
  - Data verification completed

- [x] **Milestone Completion UI** ✅ (Completed Oct 7, 2025)
  - Added checkboxes in Billing Detail page to mark milestones complete
  - Updated backend API to handle milestone completion
  - Shows completion status in milestones tab
  - Tracks invoice sent and payment received dates
  - Fixed cache management issue for real-time updates

- [x] **Strikethrough Detection** ✅ (Completed Feb 2026, v5.0.0)
  - Implemented in `billing-excel-sync.service.ts` using ExcelJS rich text character-level font data
  - If >50% of non-whitespace characters struck through → milestone marked completed
  - 345 milestones auto-detected as completed
  - One-way latch: once marked completed, stays completed on re-upload

- [ ] **Bonus Display Enhancement**
  - Show bonus in project detail page
  - Add bonus description field to UI
  - Parse more bonus formats (currently only 1/177 projects detected)

### Medium Priority

- [ ] **B&C Attorney Manual Mapping UI**
  - Create interface to review 50 unmapped attorneys
  - Show name similarity suggestions
  - Allow manual selection from staff dropdown
  - Bulk mapping operations

- [ ] **Project Linking Interface**
  - UI to link billing projects to staffing projects
  - Search/autocomplete for project selection
  - Show linked project details
  - Unlink functionality

- [ ] **Financial Data Entry Enhancement**
  - Batch update UBT/Credits for multiple projects
  - Import from CSV/Excel
  - Audit trail for all changes
  - Change history view

- [ ] **Invoice & Payment Tracking**
  - Frontend UI for invoice management
  - Payment recording interface
  - Reconciliation views
  - Outstanding invoice reports

### Low Priority

- [ ] **Reporting & Analytics**
  - B&C attorney performance dashboard
  - Collection rate reports
  - Outstanding fees summary
  - Revenue projections

- [ ] **Email Notifications**
  - Milestone completion notifications
  - Payment received alerts
  - Overdue invoice reminders

- [ ] **Export Functionality**
  - Export to Excel
  - PDF reports
  - Custom date range exports

---

## Known Issues

### 1. Strikethrough Detection ✅ RESOLVED (v5.0.0)
**Previous Issue**: Excel strikethrough formatting not detected by `xlsx` library
**Resolution**: Switched to ExcelJS with XML namespace preprocessing. Rich text character-level font data used to detect strikethrough. If >50% of non-whitespace characters are struck through, milestone is marked completed.
**Result**: 345 milestones auto-detected as completed from strikethrough formatting.

### 2. Data Source Reconciliation ✅ (Improved)
**Previous Issue**: ~40 projects showed mismatch between Excel and parsed fees
**Resolution**:
- Imported billing and collection data directly from parsed JSON
- Finance comments provide detailed transaction history
- Manual verification still recommended for critical decisions

**Remaining Considerations**:
- Multiple data sources may have minor discrepancies
- Finance comments should be primary source for verification
- Excel, JSON, and database should be cross-referenced for important transactions

### 3. Limited Bonus Detection
**Issue**: Only 1 bonus detected out of potentially more
**Cause**: Regex patterns don't cover all bonus formats
**Solution**: Add more regex patterns and review all fee arrangements manually

### 4. No Agreed Fee in Excel Column
**Note**: Excel "Fees (US$)" column needs to be populated
**Current**: Agreed fees calculated from parsed milestones
**Future**: Cross-validate with Excel column when available

### 5. Engagement Detail Fallback ✅ (Completed)
**Issue**: Billing Matter detail page showed milestone counts but the milestone table stayed empty when the engagement detail endpoint did not respond.
**Root Cause**: The frontend only called the `view=summary` variant of `GET /billing/projects/:id`, which omits embedded engagement + milestone data. Without that fallback the UI relied solely on the additional engagement detail fetch.
**Resolution**:
- Updated the client to request the `view=full` payload for the detail page, ensuring each C/M includes its engagements and milestones.
- Normalised embedded engagement IDs so the first valid engagement auto-selects and feeds the milestones card even if lazy-loaded requests fail.
**Result**: Milestone tables now render immediately for each C/M (e.g., project 1216) without requiring manual engagement selection or extra retries.

### 6. Milestone Management UX ✅ (Completed)
**What changed**:
- Simplified the C/M tabs and summary card (removed milestone tallies, trimmed copy, added UBT & Billing Credits, and streamlined status chips).
- Added inline editing for milestone reference text plus CRUD controls (add/edit/remove) for individual milestones, all wired to the existing billing APIs.
- Refreshed the milestones table with action icons while keeping the detail panel responsive to engagement selection.
**Result**: Users can maintain milestones directly from the billing detail page without leaving the flow or relying on backend scripts.

---

## How to Use

### For Administrators

1. **Access Billing Module**
   - Navigate to Sidebar → Billing
   - View all 177 billing projects

2. **Configure Access**
   - Admin Panel → Billing Settings tab
   - Toggle "Enable Billing Module"
   - Select access level (Admin Only / Admin + B&C Attorneys)

3. **Update Financial Data**
   - Click any project in Billing list
   - Click "Update Financials" button (admin only)
   - Enter UBT and Billing Credits (USD/CNY)
   - Save changes

4. **Review Projects**
   - Check Fee Arrangement tab for original text
   - Review Milestones tab for parsed payment schedule
   - Verify LSD (Long Stop Date)
   - Check bonus amounts

### For B&C Attorneys

1. **View Assigned Projects**
   - Navigate to Sidebar → Billing
   - See only projects where you are attorney-in-charge
   - View financial summaries for your projects

2. **Control Tower — My Projects**
   - Navigate to Sidebar → Control Tower
   - See triggered milestones, long stop risks, and unpaid invoices for your projects
   - Review whether lifecycle stage changes triggered any billing milestones
   - All sections collapsible — expand what you need

3. **Check Milestone Progress**
   - Click project to view details
   - Review Milestones tab for completion status
   - Ensure lifecycle stages are current to trigger automatic milestone detection

### For Developers

1. **Run Data Parsers**
   ```bash
   # Parse fee arrangements (LSD, milestones)
   DATABASE_URL="postgresql://..." npm run billing:parse-fees

   # Parse bonuses and completion status
   DATABASE_URL="postgresql://..." npm run billing:parse-completion
   ```

2. **Access API Endpoints**
   ```bash
   GET  /api/billing/projects                  # List all projects
   GET  /api/billing/projects/:id              # Get project detail
   PATCH /api/billing/projects/:id/financials  # Update UBT/Credits
   GET  /api/billing/settings/access           # Get access settings
   PATCH /api/billing/settings/access          # Update access
   ```

3. **Database Scripts**
   - Import: `npm run billing:import`
   - Parse source: `npm run billing:parse`
   - Map attorneys: `npm run billing:map-attorneys`
   - Parse fees: `npm run billing:parse-fees`
   - Parse completion: `npm run billing:parse-completion`

---

## Technical Details

### Database Schema

**Main Tables:**
- `billing_project` (210+ rows) - Project information
- `billing_project_cm_no` (210+ rows) - C/M numbers with financials
- `billing_engagement` (261 rows) - Engagement records
- `billing_fee_arrangement` (261 rows) - Fee agreements with LSD and raw text
- `billing_milestone` (611 rows, 345 completed) - Parsed milestones
- `billing_bc_attorney_staff_map` (59 rows) - Attorney mappings
- `billing_staffing_project_link` (34+ rows) - Billing-to-staffing project links
- `billing_sync_run` - Excel sync audit trail

**Key Fields:**
- Multi-currency: All financial fields have `_usd` and `_cny` variants
- LSD tracking: `lsd_date` and `lsd_raw` in fee_arrangement
- Completion: `completed`, `completion_date`, `completion_source` in milestone
- Sync tracking: `summary_json`, `changes_json`, `excel_file` in sync_run

### Parser Algorithms

**Fee Arrangement Parser:**
```typescript
// LSD Pattern: "(LSD: 31 Dec 2025)"
/\(LSD:\s*([^)]+)\)/i

// Milestone Pattern: "(a) description (25%) - 226,000"
/\(([a-z])\)\s*([^(]+?)(?:\((\d+(?:\.\d+)?)%\))?\s*-\s*([\d,]+)/gi
```

**Bonus Parser:**
```typescript
// Chinese USD: "不低于10万美元奖金"
/(?:不低于)?(\d+(?:\.\d+)?)万美元奖金/

// Chinese CNY: "不低于10万人民币奖金"
/(?:不低于)?(\d+(?:\.\d+)?)万(?:人民币|元)奖金/

// English: "bonus of $100,000"
/bonus[:\s]+\$\s*([\d,]+)/i
```

**Attorney Mapping:**
- Levenshtein distance algorithm
- 70% similarity threshold
- Auto-mapped: 9 attorneys
- Manual review: 50 attorneys

### File Locations

**Backend:**
- Controllers:
  - `backend/src/controllers/billing-excel-sync.controller.ts` — Excel sync + history
  - `backend/src/controllers/billing-trigger.controller.ts` — Billing triggers
  - `backend/src/controllers/billing*.controller.ts` — Modular billing controllers
- Services:
  - `backend/src/services/billing-excel-sync.service.ts` — Excel parser + sync engine (~1,200 lines)
  - `backend/src/services/ai-validation.service.ts` — AI-powered milestone validation
- Routes: `backend/src/routes/billing.routes.ts`
- Scripts:
  - `backend/scripts/apply-sync.ts` — Apply Excel sync via CLI
  - `backend/scripts/dry-run-updates.ts` — Preview all DB changes
  - `backend/scripts/dry-run-excel-sync.ts` — Preview raw parsing results
- Migrations:
  - `backend/prisma/migrations/20251007_add_billing_schema/migration.sql`
  - `backend/prisma/migrations/20260222000000_add_billing_sync_run/migration.sql`

**Frontend:**
- Pages: `frontend/src/pages/`
  - `BillingMatters.tsx` — Billing projects list
  - `BillingMatterDetail.tsx` — Project detail with milestones
  - `BillingControlTower.tsx` — Three-view Control Tower (Finance, Management, My Projects)
  - `BestPracticeGuide.tsx` — Guides page with milestone detection + Control Tower workflow docs
  - `SyncReport.tsx` — Print-friendly sync report
  - `SyncHistory.tsx` — Upload history list
- Components:
  - `frontend/src/components/admin/BillingExcelSyncPanel.tsx` — Upload UI
- API: `frontend/src/api/billing.ts` — Types + API functions
- Hooks: `frontend/src/hooks/useBilling.ts` — All billing hooks including `useTimeWindowedMetrics`

**Documentation:**
- `Billing/PARSING-GUIDE.md` — Complete parser reference (290 lines)
- `BILLING_MODULE_PROGRESS.md` — This document

**Data:**
- Excel Source: `Billing/HKCM Project List (2026.02.12).xlsx`

---

## Next Steps

### Immediate Actions (This Week)

1. **Add Milestone Completion UI**
   - Create checkbox column in milestones table
   - Add API endpoint for updating completion status
   - Show completion date and source

2. **Display Finance Comments**
   - Add Finance Comments tab to project detail page
   - Show parsed transaction details
   - Enable editing/updating comments

3. **Test B&C Attorney Access**
   - Verify filtering works correctly
   - Test with actual B&C attorney accounts
   - Ensure data isolation

### Short Term (Next 2 Weeks)

1. **Attorney Mapping UI**
   - Build interface for 50 unmapped attorneys
   - Implement manual mapping functionality
   - Add confidence score display

2. **Project Linking**
   - Create UI to link billing to staffing projects
   - Show linked project details
   - Enable bi-directional navigation

3. **Enhanced Bonus Parsing**
   - Add more regex patterns
   - Manual review of all fee arrangements
   - Update parser to find all bonuses

### Long Term (Next Month)

1. **Invoice & Payment Module**
   - Design UI/UX
   - Implement CRUD operations
   - Add reconciliation logic

2. **Reporting Dashboard**
   - Design KPIs for B&C attorneys
   - Build data aggregation queries
   - Create visualization components

3. **Data Quality Improvements**
   - Regular import/sync from Excel
   - Data validation rules
   - Audit trail for all changes

---

## Success Metrics

### Current Achievement
- ✅ 210 projects synced from Excel (100%)
- ✅ 261 engagements upserted (100%)
- ✅ 611 milestones parsed (100%)
- ✅ 345 milestones auto-completed from strikethrough (100%)
- ✅ 34 staffing projects auto-linked (76% of new CMs)
- ✅ 100% backend API coverage (75+ endpoints total)
- ✅ 100% frontend UI coverage for core features
- ✅ Sync history with Excel file storage
- ✅ Print-friendly sync reports
- ✅ AI validation service (optional)

### Target Metrics
- ✅ 100% project data import (achieved!)
- ✅ All completed milestones marked from strikethrough (achieved!)
- ✅ Auto-linking to staffing projects (34/45 = 76%)
- 🎯 100% attorney mapping (currently 15% auto + manual review needed)
- 🎯 11 unmatched new projects need manual linking
- 🎯 All bonuses detected and tracked

---

## Team & Contacts

**Development:** Claude AI + Tim Li (User)
**Database:** Railway PostgreSQL
**Data Source:** Excel "HKCM Project List(81764217.1)_6Oct25.xlsx"
**Environment:**
- Backend: Node.js + TypeScript + Prisma ORM
- Frontend: React 19 + TypeScript + Material-UI v7 + TanStack Query v5

---

**Document Version:** 3.0
**Last Updated:** February 25, 2026
**Status:** Living Document - Update as progress is made

---

## Recent Updates (v3.0 - Feb 25, 2026)

### What Changed — Phase 8: Billing Control Tower & Milestone Detection (v5.1.0)
- ✅ **Control Tower — Three-View Architecture** — Finance View (invoice workflow), Management View (oversight), My Projects (attorney-filtered)
- ✅ **Automatic Milestone Trigger Detection** — Three methods: lifecycle changes (real-time), date sweep (daily), AI sweep (daily)
- ✅ **B&C Attorney Access** — Attorneys can now access Control Tower to see their own project triggers, risks, and unpaid invoices
- ✅ **Collapsible Sections** — All Control Tower sections collapsible with count badges
- ✅ **Best Practice Guide** — Updated with milestone detection workflow, Control Tower views, and role responsibilities
- ✅ **React Query Performance** — Improved caching, reduced redundant API calls

### Impact
- Finance team has a structured invoice issuance workflow (confirm → queue → send)
- B&C attorneys can self-serve billing awareness without admin intervention
- Three complementary detection methods minimize missed milestones
- Management has portfolio-level risk visibility (long stop dates, unpaid invoices)
- Guides page educates all roles on the milestone → billing → invoicing chain

### Previous Updates (v2.0 - Feb 22, 2026)
- ✅ **Complete Excel Sync Engine** — Parses HKCM Project List Excel and syncs all billing data
- ✅ **Strikethrough Detection Resolved** — 345 milestones auto-completed using character-level font data
- ✅ **Period/Commencement Headers** — 5 regex patterns for engagement section detection
- ✅ **Unmatched C/M Creation** — 45 new billing projects auto-created
- ✅ **Auto-linking** — 34 staffing projects linked via C/M number matching
- ✅ **Sync Report Page** — Print-friendly report with financial diffs
- ✅ **Sync History** — Each upload stored with Excel file for audit trail
- ✅ **AI Validation** — Optional Claude-powered milestone review

### Previous Updates (v1.2 - Oct 7, 2025)
- ✅ Fixed Milestone Update Display Issue (React Query cache)
- ✅ Enhanced Milestone Management (CRUD, completion, dates)
- ✅ Phase 5: Enhanced Data Import ($85.5M billing, $80.8M collection)
- ✅ Phase 6: Milestone Update Functionality
