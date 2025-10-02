# TODO List - Staffing Tracker

## 🚨 High Priority (Security & Stability)

### Testing
- [ ] Add backend unit tests (Jest)
  - [ ] Test auth controller (login, register, JWT validation)
  - [ ] Test project controller CRUD operations
  - [ ] Test staff controller CRUD operations
  - [ ] Test assignment controller
  - [ ] Test project report service
- [ ] Add backend integration tests (Supertest)
  - [ ] Test API endpoints with authentication
  - [ ] Test role-based authorization
  - [ ] Test error handling
- [ ] Add frontend tests (Vitest + React Testing Library)
  - [ ] Test authentication flow
  - [ ] Test protected routes
  - [ ] Test form submissions
  - [ ] Test data table interactions

### Security Improvements
- [ ] Implement Zod schemas for request validation
  - [ ] Project create/update validation
  - [ ] Staff create/update validation
  - [ ] Assignment validation
  - [ ] Auth validation (email format, password strength)
- [ ] Add password strength requirements
  - [ ] Minimum 8 characters
  - [ ] Require uppercase, lowercase, number, special character
  - [ ] Password confirmation field
  - [ ] Password change functionality
- [ ] Add rate limiting
  - [ ] Login endpoint (5 attempts per 15 minutes)
  - [ ] Registration endpoint (3 per hour per IP)
  - [ ] API endpoints (100 per minute per user)
- [ ] Add JWT token expiration and refresh tokens
  - [ ] Set token expiration (e.g., 24 hours)
  - [ ] Implement refresh token endpoint
  - [ ] Auto-refresh before expiration

### Error Handling
- [ ] Improve error messages throughout the application
  - [ ] Backend: Specific error messages (not just "Internal server error")
  - [ ] Frontend: User-friendly error displays
  - [ ] Toast notifications for errors
- [ ] Add error logging service
  - [ ] Backend: Winston or Pino logger
  - [ ] Frontend: Error boundary with logging
  - [ ] Log errors to monitoring service

---

## ⚙️ Medium Priority (Code Quality & Performance)

### Code Refactoring
- [ ] Extract magic strings to shared constants
  - [ ] backend/src/types/constants.ts (roles, departments, statuses)
  - [ ] frontend/src/types/constants.ts (mirror backend constants)
- [ ] Remove console.log statements from production code
  - [ ] frontend/src/pages/Projects.tsx:49-50
- [ ] Remove TestPage before final production release
  - [ ] Delete frontend/src/pages/TestPage.tsx
  - [ ] Remove route from frontend/src/App.tsx

### Performance Optimization
- [ ] Implement proper pagination (replace limit=1000)
- [ ] Add database query optimization
- [ ] Implement caching strategy

### JWT Improvements
- [ ] Add token expiration validation
- [ ] Implement refresh token mechanism
- [ ] Add token blacklist for logout

---

## 📦 Low Priority (Features & Enhancements)

### New Features
- [ ] Assignment management dedicated page
- [ ] Data export functionality (Excel/PDF)
- [ ] Advanced search capabilities
- [ ] Email notifications
- [ ] User profile management

### Documentation
- [ ] Add API documentation with Swagger/OpenAPI
- [ ] Add inline code documentation (JSDoc)
- [ ] Create user guide with screenshots

### DevOps & Monitoring
- [ ] Add logging framework (Winston/Pino)
- [ ] Add APM (Sentry, DataDog, New Relic)
- [ ] Set up CI/CD pipeline with GitHub Actions
- [ ] Add health check endpoints

### UI/UX Enhancements
- [ ] Improve mobile responsiveness
- [ ] Add keyboard shortcuts
- [ ] Add dark mode
- [ ] Add accessibility improvements (WCAG 2.1 AA)

---

## ✅ Completed

### Initial Development
- [x] Backend REST API implementation
- [x] Frontend React application
- [x] Authentication with JWT
- [x] Role-based access control
- [x] Project CRUD operations
- [x] Staff CRUD operations
- [x] Project Report with filtering and sorting
- [x] Table alignment fixes
- [x] Column width optimization
- [x] Role naming update (Income Partner → Partner)
- [x] Staff member merge (Jing/Jing Du)
- [x] Railway deployment (backend + frontend)
- [x] Database migrations
- [x] Change history tracking
- [x] Activity logging
- [x] Dashboard with charts
- [x] Hot module replacement setup
- [x] Responsive design
- [x] Protected routes

### Phase 4: Modern Frontend (2025-10-03)
- [x] TanStack Query (React Query) v5 implementation
  - [x] Created custom hooks: useDashboard, useProjects, useStaff
  - [x] Automatic cache management with strategic invalidation
  - [x] Background refetching and optimistic updates infrastructure
  - [x] Configured with 5min stale time, 10min garbage collection
  - [x] Migrated Dashboard, Projects, Staff pages to use query hooks
- [x] React Hook Form + Zod validation
  - [x] Created validation schemas in lib/validations.ts
  - [x] Migrated Login form to React Hook Form
  - [x] Migrated ProjectForm to React Hook Form with Controller
  - [x] Migrated StaffForm to React Hook Form with Controller
  - [x] Type-safe form validation with helpful error messages
- [x] Toast notifications (Sonner)
  - [x] Integrated toast library with proper positioning
  - [x] Added success/error toasts to all mutations
  - [x] Created toast wrapper utility
- [x] Loading skeletons
  - [x] Created reusable skeleton components (DashboardSkeleton, ProjectListSkeleton, StaffListSkeleton, TableSkeleton)
  - [x] Replaced CircularProgress spinners with content-aware skeletons
  - [x] Improved perceived performance across all pages
- [x] Global error boundary
  - [x] Created ErrorBoundary component with user-friendly error UI
  - [x] Wrapped entire app with error boundary
  - [x] Added error details display with reload/home options
- [x] Component decomposition
  - [x] Extracted ProjectStatusChart from Dashboard
  - [x] Extracted ProjectCategoryChart from Dashboard
  - [x] Improved code organization and reusability

### Bug Fixes & Data Cleanup (2025-10-03)
- [x] Fixed CircularProgress production errors
  - [x] Removed orphaned CircularProgress usage from Projects.tsx
  - [x] Removed loading prop from StyledDataGrid components
  - [x] Updated error handling to use inline conditional rendering
- [x] Staff data cleanup
  - [x] Created merge-staff.ts script
  - [x] Merged William/WIlliam duplicates (2 assignments consolidated)
  - [x] Merged Tingting/TIngting duplicates (11 assignments consolidated)
  - [x] Verified no suspended staff records exist
- [x] Project Report navigation
  - [x] Added clickable rows to Project Report table
  - [x] Fixed navigation by including projectId in backend response (both reports.service.ts and project-report.service.ts)
  - [x] Updated frontend to use real database IDs instead of synthetic ones
  - [x] Resolved "project not found" errors

### UI/UX Improvements (2025-10-03)
- [x] Restructured StaffDetail page layout
  - [x] Changed from sidebar layout to horizontal single-row layout
  - [x] Display Role, Department, Email, Active Projects in first row
  - [x] Show Notes in full width below
  - [x] Move Projects table below staff info section
  - [x] Improved mobile responsiveness
- [x] Removed "Lead" field completely from entire application
  - [x] Frontend removals:
    - [x] Removed "Lead" chip from StaffDetail project assignments
    - [x] Removed "Lead" chip from ProjectDetail staff assignments
    - [x] Removed "Lead" column from Reports page
    - [x] Removed isLead from TypeScript types (index.ts)
  - [x] Backend schema and migrations:
    - [x] Removed isLead from Prisma schema
    - [x] Created database migration 20251003034500_remove_is_lead
    - [x] Applied migration to production database
    - [x] Regenerated Prisma client
  - [x] Backend controllers and services:
    - [x] Updated assignment controller (create/update/bulk)
    - [x] Updated reports service and types
    - [x] Updated dashboard controller (workload report)
    - [x] Updated migrate-excel.ts script
    - [x] Updated sync-from-excel.ts script (2 locations)
    - [x] Updated reports.excel.ts (Excel export)

---

**Last Updated:** 2025-10-03
