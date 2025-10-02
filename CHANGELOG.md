# Changelog

All notable changes to the Staffing Tracker application will be documented in this file.

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
