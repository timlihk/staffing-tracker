# Staffing Tracker Application

A modern web-based application for tracking law firm staffing assignments, project status, and workload management.

## 🎯 Project Overview

This application replaces the Excel-based staffing tracker with a full-stack web application featuring:
- Real-time project and staff management
- Automated workload tracking and capacity planning
- Role-based access control
- Comprehensive dashboard with analytics
- Data migration from existing Excel sheets

## 📋 Current Status

### ✅ Backend (100% Complete - Production Deployed)
- Full REST API with Express.js + TypeScript
- PostgreSQL database with Prisma ORM
- JWT authentication with role-based access
- Complete CRUD operations for Projects, Staff, and Assignments
- Dashboard and reporting endpoints
- Project Report service with staffing aggregation
- Excel data migration script
- Railway.app deployment configuration
- **Status**: ✅ Deployed and running in production

### ✅ Frontend (100% Complete - Production Deployed)
- Full React 19 + TypeScript application
- Material-UI v7 with responsive design
- Complete authentication flow (Login, Protected Routes)
- Session security with manual logout control and 30-minute inactivity timeout
- Dashboard with charts and analytics
- Projects management (List, Detail, Create/Edit, Delete)
- Staff management (List, Detail, Create/Edit, Delete)
- Project Report with filtering and sorting
- Admin-only user management panel with on-demand password resets
- Responsive layout with sidebar navigation
- Hot module replacement for development
- **Status**: ✅ Deployed and running in production

### 🎉 Recent Updates (Oct 2025)

**Latest Features (Oct 5, 2025):**
- ✅ **Email Notification Settings** - Granular control over project update emails
  - Admin-only settings panel in User Management section
  - Global toggle to enable/disable all email notifications
  - Position-specific toggles for granular control (Partner, Associate, Junior FLIC, Senior FLIC, Intern, B&C Working Attorney)
  - Real-time filtering of email recipients based on settings
  - Automatic deduplication to prevent duplicate emails
  - Settings persist across sessions
- ✅ **Enhanced Dashboard Deal Radar** - Improved team visibility and readability
  - Team members separated into dedicated columns (Partner, Associate, FLIC, Intern)
  - Alphabetically sorted names within each position category
  - Added "Side" field column showing project side
  - Removed "Priority" and "Status" columns for cleaner layout
  - Calendar cards with bordered boxes and grey background
  - Alternating row shading in project table for better readability
  - Fixed team member deduplication (prevents duplicate entries when staff has multiple roles)
  - **Pagination**: Show 10 projects by default with "Show More" button to expand
- ✅ **Automated Testing Suite** - 52 comprehensive tests for quality assurance
  - Backend: 33 tests (email settings, email service, dashboard deduplication)
  - Frontend: 19 tests (email settings hook, dashboard utils)
  - Full coverage of new features with Jest and Vitest
  - Proper mocking and edge case handling
- ✅ **Smart Back Navigation** - Intelligent navigation history tracking
  - New useSmartBack hook with 3-tier fallback strategy
  - Remembers where users came from (dashboard, admin panel, etc.)
  - Works from any entry point including direct URLs
  - Applied to all detail and form pages
- ✅ **UI Simplification** - Cleaner interface with focused actions
  - Actions column shows only Edit button (removed View/Delete)
  - Click anywhere on row to view details
  - Less clutter, more intuitive navigation
- ✅ **Team Members on Project Creation** - Add team members when creating projects
  - Select staff members from autocomplete dropdown
  - Auto-assign jurisdiction (HK Law, US Law, B&C)
  - Display team members with position and jurisdiction
  - Visual chips showing: "Name - Position (Jurisdiction)"
  - Bulk assignment API integration
  - Clean, modern UI with full-width staff selector
- ✅ **Project Creation Bug Fixes** - Fixed critical issues
  - Fixed "Invalid project ID" error when creating projects
  - Added NaN validation in update controller
  - Improved isEdit detection logic
  - Better error logging and messages
- ✅ **Dashboard Enhancements** - Improved time range options and visualization
  - Time range selector at top of dashboard (30 days, 2 months, 3 months, 4 months)
  - Multiple calendar view in Deal Radar showing filing/listing events with color-coded dots
  - Blue dots for Filing events, purple dots for Listing events
  - Calendar displays correct number of months based on selected time range
  - Table format for Deal Radar events (replaces cards for better space efficiency)
  - Dynamic staffing heatmap with ~6 columns maximum across all time ranges
  - Smart interval calculation: 7-day (30 days), 10-day (60 days), 15-day (90 days), 20-day (120 days)
  - Fixed timezone issues causing calendar dots to appear on wrong dates
  - Only today's date highlighted in blue across all calendar cards
  - Calendar dots only show for events within the displayed month
- ✅ **Sidebar Navigation Improvements** - Modern click-based toggle
  - Hamburger menu button at top-left of sidebar for expand/collapse
  - Click-based toggle replaces hover-based expansion
  - Smooth animations and transitions

**Earlier Updates (Oct 4, 2025):**
- ✅ **Daily Partner Reminders** - Automated email notifications
  - Railway Worker service with node-cron scheduler
  - Daily reminders at 9 AM HKT for partners with incomplete projects
  - Filters for HK Trx and US Trx categories only (excludes Comp and Other)
  - Consolidated emails showing all missing fields per project
  - Professional HTML templates with direct project update links
  - Rate-limited sending (600ms delay) to comply with Resend limits
  - Test mode and feature flags for safe rollout
  - Runs continuously on Railway worker (separate from backend service)
- ✅ **Email Service Improvements**
  - Removed BCC from project update emails for cleaner delivery
- ✅ **Welcome Email for New Users** - Automated onboarding
  - New users automatically receive welcome email with credentials
  - Professional HTML template with username and temporary password
  - Direct login link to the application
  - Instructions for mandatory password reset on first login
  - Branded as "Asia CM Team" with consistent styling
- ✅ **Admin Panel Enhancements** - User management improvements
  - Renamed "Users" menu to "Admin" for better clarity
  - Added "Change Log" tab showing all user management activities
  - Real-time activity tracking (create, update, delete, password reset)
  - Color-coded action indicators (green for create, red for delete, blue for update)
  - Dedicated view for user audit trail
- ✅ **Email Notifications** - Automatic email alerts for project updates
  - Staff members receive emails when projects they're assigned to are updated
  - Professional HTML email templates with change summaries
  - Direct links to view updated projects
  - Resend email service integration (free tier: 3,000 emails/month)
  - Email sender displays as "Asia CM Team" instead of generic "notifications"
- ✅ **Excel Export & Print Improvements** - Professional output formatting
  - Excel exports now branded as "Asia CM" (updated from previous branding)
  - Print layouts optimized to show all columns including Notes
  - Reduced font sizes (8pt) for better column fitting
  - Enhanced word-wrap and text handling for long content
  - Export button available to Admin and Editor users only
  - Summary sheet with filter details and totals
  - Professional formatting with auto-filter, zebra striping, and borders
  - Respects all current filter selections (category, status, priority, team member)
- ✅ **Table Styling Improvements** - Professional UI enhancements
  - Deep blue header backgrounds on all data tables
  - White text and icons for better contrast
  - Alternating row colors for improved readability
  - Print-friendly Project Report showing all filtered rows
- ✅ **Permission-Based UI Controls** - Enhanced security UX
  - Export and Print buttons hidden from Viewer role users
  - Consistent permission checks across all detail pages

**Phase 4: Modern Frontend (Oct 3, 2025)**
- ✅ **TanStack Query v5** - Replaced manual data fetching with React Query
  - Custom hooks for all data operations (useDashboard, useProjects, useStaff)
  - Automatic caching with 5min stale time, 10min garbage collection
  - Strategic cache invalidation on mutations
  - Background refetching for always-fresh data
- ✅ **React Hook Form + Zod** - Type-safe form validation
  - Migrated all forms (Login, ProjectForm, StaffForm)
  - Client-side validation with helpful error messages
  - Better performance with reduced re-renders
- ✅ **Toast Notifications** - User feedback with Sonner
  - Success/error toasts on all CRUD operations
  - Replaced alert() calls with professional notifications
- ✅ **Loading Skeletons** - Content-aware loading states
  - Replaced spinners with skeleton screens
  - Improved perceived performance
  - Created reusable skeleton components
- ✅ **Global Error Boundary** - Graceful error handling
  - Catches and displays React errors elegantly
  - User-friendly error UI with reload/home options
- ✅ **Component Decomposition** - Better code organization
  - Extracted chart components from Dashboard
  - Improved maintainability and reusability

**Security Enhancements (Oct 3, 2025):**
- ✅ Added prominent logout control to let users securely end sessions from anywhere in the app
- ✅ Implemented automatic logout after 30 minutes of inactivity with user-facing notification and cache clearing

**Bug Fixes & Improvements (Oct 3, 2025):**
- ✅ Fixed CircularProgress errors in production (removed orphaned imports)
- ✅ Merged duplicate staff records (William/WIlliam, Tingting/TIngting)
- ✅ Added clickable rows to Project Report for navigation
- ✅ Fixed project navigation using real database IDs instead of synthetic ones
- ✅ Enhanced Project Report with proper project linking (fixed both report services)
- ✅ Restructured StaffDetail page with horizontal layout for better UX
- ✅ Completely removed "Lead" field from entire application:
  - Frontend: Removed chips from StaffDetail and ProjectDetail, removed column from Reports
  - Backend: Removed from all controllers, services, and migration scripts
  - Database: Dropped is_lead column with migration 20251003034500_remove_is_lead
  - Scripts: Updated Excel migration and sync scripts
  - Excel Export: Removed Lead column from reports

**Earlier Updates:**
- ✅ Fixed table alignment issues in Project Report
- ✅ Added sorting functionality to Project Report (project name, category)
- ✅ Optimized column widths across all tables
- ✅ Updated role naming: "Income Partner" → "Partner"
- ✅ Increased project list pagination to show all projects
- ✅ Fixed CSS layout issues (removed artificial centering)

## 🏗️ Architecture

```
Frontend (React + TypeScript)
    ↓ HTTPS/REST API
Backend (Node.js + Express)
    ↓ Prisma ORM
Database (PostgreSQL)
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL (or Railway account for cloud database)
- npm or yarn

### Backend Setup

1. Navigate to backend directory:
```bash
cd backend
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your DATABASE_URL and JWT_SECRET
```

**Note for localhost development**: The backend `.env` file is not tracked in Git. If you need to run locally, copy `.env.example` to `.env` and configure your database connection.

3. Run database migrations:
```bash
npx prisma generate
npx prisma migrate dev
```

4. (Optional) Migrate data from Excel:
```bash
npx ts-node src/scripts/migrate-excel.ts
```

5. (Optional) Normalize legacy roles after importing historical data:
```bash
npm run db:fix-ip-role
```
This maintenance script converts any remaining `IP` project assignments to the current `Partner` label.

6. Start development server:
```bash
npm run dev
```

Backend will run on `http://localhost:3000`

> **Admin workflow:** Use the new `/users` admin page to provision accounts. Each user receives a temporary password and must set a new one on first login.

### Frontend Setup

1. Navigate to frontend directory:
```bash
cd frontend
npm install
```

2. Create `.env` file:
```bash
cp .env.example .env
# File should contain: VITE_API_URL=http://localhost:3000/api
```

**Note for localhost development**: The frontend `.env` file is not tracked in Git. Copy `.env.example` to `.env` to configure the API URL for local development.

3. Start development server:
```bash
npm run dev
```

Frontend will run on `http://localhost:5173`

## 📦 Technology Stack

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js
- **Language**: TypeScript
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Auth**: JWT + bcrypt
- **Validation**: Express middleware

### Frontend
- **Framework**: React 19
- **Language**: TypeScript
- **UI Library**: Material-UI v7 (MUI)
- **Routing**: React Router v6
- **State Management**: TanStack Query v5 (React Query)
- **Form Management**: React Hook Form v7 + Zod v4
- **HTTP Client**: Axios
- **Charts**: Recharts
- **Notifications**: Sonner v2
- **Build Tool**: Vite v7

## 🗂️ Project Structure

```
staffing-tracker/
├── backend/
│   ├── src/
│   │   ├── controllers/          # Business logic
│   │   │   ├── auth.controller.ts
│   │   │   ├── project.controller.ts
│   │   │   ├── staff.controller.ts
│   │   │   ├── assignment.controller.ts
│   │   │   └── dashboard.controller.ts
│   │   ├── routes/               # API routes
│   │   ├── middleware/           # Auth & validation
│   │   ├── utils/                # Utilities (Prisma, JWT)
│   │   ├── scripts/              # Migration scripts
│   │   └── server.ts             # Main entry point
│   ├── prisma/
│   │   └── schema.prisma         # Database schema
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── pages/                # Page components (TO BUILD)
│   │   ├── components/           # Reusable components (TO BUILD)
│   │   ├── context/              # React contexts
│   │   ├── api/                  # API client
│   │   ├── types/                # TypeScript types
│   │   └── App.tsx               # Main app component
│   └── package.json
│
├── IMPLEMENTATION_PLAN.md         # Detailed implementation plan
├── DEPLOYMENT_GUIDE.md            # Railway deployment guide
└── README.md                      # This file
```

## 🔐 API Endpoints

### Authentication
```
POST   /api/auth/login      - User login
POST   /api/auth/register   - User registration
GET    /api/auth/me         - Get current user
```

### Projects
```
GET    /api/projects        - List projects (with filters)
GET    /api/projects/:id    - Get project details
GET    /api/projects/:id/activity-log - Get project change log
POST   /api/projects        - Create project (admin/editor)
PUT    /api/projects/:id    - Update project (admin/editor)
DELETE /api/projects/:id    - Delete project (admin)
GET    /api/projects/categories - Get categories
```

### Staff
```
GET    /api/staff           - List staff
GET    /api/staff/:id       - Get staff details
GET    /api/staff/:id/workload - Get workload metrics
POST   /api/staff           - Create staff (admin/editor)
PUT    /api/staff/:id       - Update staff (admin/editor)
DELETE /api/staff/:id       - Delete staff (admin)
```

### Assignments
```
GET    /api/assignments     - List assignments
GET    /api/assignments/:id - Get assignment
POST   /api/assignments     - Create assignment (admin/editor)
POST   /api/assignments/bulk - Bulk create (admin/editor)
PUT    /api/assignments/:id - Update assignment (admin/editor)
DELETE /api/assignments/:id - Delete assignment (admin/editor)
```

### Dashboard
```
GET    /api/dashboard/summary         - Dashboard summary
GET    /api/dashboard/workload-report - Workload report
GET    /api/dashboard/activity-log    - Activity log
```

## 🗄️ Database Schema

### Core Tables

**users** - Application users
- id, username, email, password_hash, role, staff_id, last_login

**staff** - Law firm staff members
- id, name, email, role, department, status, notes

**projects** - Client projects
- id, name, project_code, category, status, priority
- el_status, start_date, timetable, actual_filing_date
- notes

**project_assignments** - Staff-to-project assignments
- id, project_id, staff_id, role_in_project, jurisdiction
- allocation_percentage, is_lead, start_date, end_date

**project_status_history** - Audit trail
- id, project_id, old_status, new_status, changed_by, change_reason

**activity_log** - System activity
- id, user_id, action_type, entity_type, entity_id, description

## 🌐 Deployment to Railway.app

### Step 1: Prepare Repository
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin YOUR_GITHUB_REPO
git push -u origin main
```

### Step 2: Deploy Backend

1. Create Railway project: https://railway.app
2. Add PostgreSQL database
3. Add backend service from GitHub
4. Set environment variables:
   - `NODE_ENV=production`
   - `JWT_SECRET=your-secret-key`
   - `FRONTEND_URL=your-frontend-url`
5. Deploy!

### Step 3: Deploy Frontend

1. Add frontend service in same Railway project
2. Set environment variable:
   - `VITE_API_URL=your-backend-url/api`
3. Deploy!

**Detailed deployment instructions**: See `DEPLOYMENT_GUIDE.md`

## 👤 Default Credentials

After running the migration script:

**Username**: `admin`
**Password**: `admin123`

⚠️ **Change immediately after first login!**

## 📧 Daily Partner Reminders

Automated daily emails to partners about projects with missing critical information.

**Schedule**: 9 AM HKT (1 AM UTC) via Railway Worker with node-cron
**Recipient**: Partners (position='Partner', status='active', email not null)
**Projects**: Active and Slow-down status, HK Trx and US Trx categories only
**Missing Fields**: Filing Date, Listing Date, EL Status, B&C Attorney

### Railway Worker Setup

The reminder system runs as a dedicated Railway worker service:
1. **Create Worker Service** in Railway dashboard
2. **Deploy from GitHub** repo (same as backend)
3. **Start Command**: `npm run start:worker`
4. **Environment Variables**:
   - `DATABASE_URL=${{Postgres.DATABASE_URL}}`
   - `RESEND_API_KEY` - Your Resend API key
   - `EMAIL_FROM=notifications@asia-cm.team`
   - `FRONTEND_URL` - Your production frontend URL
   - `ENABLE_PROJECT_REMINDERS=true` - Master switch to enable/disable
   - `EMAIL_TEST_MODE=false` - Set to `true` to redirect all emails in testing
   - `EMAIL_TEST_RECIPIENT=admin@example.com` - Test recipient address
   - `LOG_EMAIL_PAYLOADS=false` - Debug logging (optional)
   - `RUN_REMINDERS_ON_START=true` - Run immediately on deployment (optional, for testing)

The worker runs continuously and executes the reminder job daily at 1 AM UTC using the `Asia/Hong_Kong` timezone.

### Development

**Preview Email Template** (requires ts-node dev dependency):
```bash
cd backend
npm run preview:emails
open email-previews/partner-reminder.html
```

**Test Mode Run** (requires ts-node dev dependency):
```bash
cd backend
EMAIL_TEST_MODE=true \
EMAIL_TEST_RECIPIENT=test@example.com \
ENABLE_PROJECT_REMINDERS=true \
npm run send:reminders:dev
```

**Manual Run** (production build):
```bash
cd backend
npm run build
npm run send:reminders
```

### Edge Cases
- **Projects without active partner emails**: Silently skipped (expected)
- **Inactive partners**: Not notified (filtered out)
- **Multiple partners per project**: Each receives the project once
- **Null/missing project fields**: Display as '-' in email

---

## 🔧 Development

### Running Tests
```bash
cd backend
npm test  # (tests need to be added)
```

### Database Management
```bash
# Generate Prisma client
npx prisma generate

# Create migration
npx prisma migrate dev --name migration_name

# View database
npx prisma studio

# Reset database (CAUTION)
npx prisma migrate reset
```

### Building for Production
```bash
# Backend
cd backend
npm run build
npm start

# Frontend
cd frontend
npm run build
npm run preview
```

## 📊 Features

### Completed - Backend (100%)
- ✅ User authentication (JWT-based)
- ✅ Role-based access control (admin, editor, viewer)
- ✅ Project CRUD operations
- ✅ Staff CRUD operations
- ✅ Assignment management (including bulk operations)
- ✅ Project status tracking with history
- ✅ Activity logging and audit trail
- ✅ Dashboard API with summaries
- ✅ Workload reporting
- ✅ Project-specific change log API
- ✅ Excel data migration script
- ✅ Railway deployment configuration

### Completed - Frontend (100%)
- ✅ Login/Register UI with authentication
- ✅ Dashboard with charts and analytics
- ✅ Project list with filters, search, and pagination
- ✅ Project detail views with team assignments
- ✅ Project create/edit/delete operations
- ✅ Project change log display
- ✅ Project Report with multi-filter and sorting
- ✅ Staff list with role and department filters
- ✅ Staff detail views with project assignments
- ✅ Staff create/edit/delete operations
- ✅ Staff workload visualization
- ✅ Activity feed on dashboard
- ✅ Responsive Material-UI design
- ✅ Protected routes and authorization
- ✅ Optimized table layouts and column widths

### To Be Implemented (Future Enhancements)
- [ ] Assignment management UI (dedicated page for bulk operations)
- [ ] Advanced search with full-text capabilities
- [ ] Automated testing suite (Jest, Vitest)
- [ ] Input validation with Zod schemas on backend
- [ ] Password strength requirements
- [ ] Rate limiting for auth endpoints
- [ ] JWT refresh tokens for enhanced security
- [ ] Enhanced logging with Winston/Pino

## 🛡️ Security Features

- JWT-based authentication with 7-day expiration
- Password hashing with bcrypt (10 rounds)
- Role-based authorization (admin, editor, viewer)
- **30-minute inactivity timeout** - Automatic logout after no user activity
- SQL injection protection (Prisma ORM with parameterized queries)
- CORS configuration
- Environment variable management (.env files)
- Comprehensive activity audit logging
- Secure password reset flow with temporary tokens
- Protected API endpoints with middleware

## 📈 Recommended Improvements

### High Priority
1. **Testing** - Add unit and integration tests
   - Backend: Jest + Supertest for API endpoints
   - Frontend: Vitest + React Testing Library
2. **Input Validation** - Implement Zod schemas for request validation
3. **Error Handling** - Improve error messages (user-friendly + detailed logging)
4. **Security** - Add password strength requirements and rate limiting

### Medium Priority
5. **Code Quality** - Extract magic strings to shared constants
6. **Performance** - Implement proper pagination (avoid limit=1000)
7. **JWT Enhancement** - Add token expiration and refresh tokens
8. **Monitoring** - Add logging framework (Winston/Pino) and APM

### Low Priority
9. **Features** - Data export (Excel/PDF), email notifications
10. **Documentation** - API documentation with Swagger/OpenAPI
11. **CI/CD** - Automated testing and deployment pipeline

## 📝 License

Proprietary - Asia CM Team

## 👥 Support

For questions or issues:
1. Check `IMPLEMENTATION_PLAN.md` for detailed specifications
2. Check `DEPLOYMENT_GUIDE.md` for deployment help
3. Review API documentation in backend README

---

## 🗄️ Database Migrations

The application uses Prisma for database migrations. Current migrations:

1. `20251002083013_init` - Initial schema setup
2. `20251002194800_change_timetable_to_dropdown` - Timetable enum
3. `20251002200500_refactor_project_fields` - Project field updates
4. `20251002205110_rename_project_code_to_name` - Renamed projectCode → name
5. `20251002210638_remove_allocation_percentage` - Removed allocation field
6. `20251002214500_rename_ip_to_partner` - Renamed Income Partner → Partner
7. `add_change_history` - Added audit trail tables

8. `20251003034500_remove_is_lead` - Removed isLead field from ProjectAssignment

**All migrations deployed to production.**

---

## 🎨 Component Architecture

### Frontend Structure (All Complete ✅)

**Pages:**
- `Login.tsx` - Authentication page ✅
- `Dashboard.tsx` - Main dashboard with charts ✅
- `Projects.tsx` - Project list with filters ✅
- `ProjectDetail.tsx` - Project detail view ✅
- `ProjectForm.tsx` - Create/edit project form ✅
- `ProjectReport.tsx` - Comprehensive report with filtering and sorting ✅
- `Staff.tsx` - Staff list with filters ✅
- `StaffDetail.tsx` - Staff detail view ✅
- `StaffForm.tsx` - Create/edit staff form ✅
- `TestPage.tsx` - Testing page (remove before final deployment) ⚠️

**Components:**
- `Layout.tsx` - Main layout wrapper ✅
- `Sidebar.tsx` - Navigation sidebar ✅
- `Header.tsx` - Top header with user menu ✅
- `ProtectedRoute.tsx` - Route guard ✅
- `SummaryCards.tsx` - Dashboard metric cards ✅
- `ActivityFeed.tsx` - Recent activity list ✅
- `StyledDataGrid.tsx` - Reusable table component ✅
- `EmptyState.tsx` - Empty state component ✅
- `Page.tsx` - Page wrapper component ✅
- `ErrorBoundary.tsx` - Global error handler ✅
- `ui/Skeleton.tsx` - Loading skeleton components ✅
- `dashboard/ProjectStatusChart.tsx` - Pie chart component ✅
- `dashboard/ProjectCategoryChart.tsx` - Bar chart component ✅

**Context:**
- `AuthContext.tsx` - Authentication state management ✅

**API & Data:**
- `api/client.ts` - Axios client with JWT interceptors ✅
- `hooks/useDashboard.ts` - Dashboard data hook ✅
- `hooks/useProjects.ts` - Projects CRUD hooks ✅
- `hooks/useStaff.ts` - Staff CRUD hooks ✅
- `lib/query-client.ts` - TanStack Query configuration ✅
- `lib/validations.ts` - Zod validation schemas ✅
- `lib/toast.tsx` - Toast notification wrapper ✅

---

## 📊 Production Deployment

**Backend:** https://staffing-tracker-production.up.railway.app
**Frontend:** https://staffing-tracker-frontend-production.up.railway.app
**Database:** PostgreSQL on Railway

**Deployment Status:** ✅ Both services deployed and running

**Auto-deploy:** Enabled via GitHub integration (pushes to `main` trigger deployments)

---

**Application is production-ready and fully deployed! 🚀**
