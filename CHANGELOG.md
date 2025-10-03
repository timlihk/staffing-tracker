# Changelog

All notable changes to the Staffing Tracker application will be documented in this file.

## [1.3.1] - 2025-10-03

### Changed
- 📚 Documented the `npm run db:fix-ip-role` maintenance script used to normalize legacy "IP" assignments to "Partner" after historical imports.
- 🗒️ Added notes clarifying that older planning docs reference "IP" as the former label for partners.


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
