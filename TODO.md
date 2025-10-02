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
- [ ] Add loading skeletons
- [ ] Add toast notifications
- [ ] Improve mobile responsiveness
- [ ] Add keyboard shortcuts
- [ ] Add dark mode
- [ ] Add accessibility improvements (WCAG 2.1 AA)

---

## ✅ Completed

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

---

**Last Updated:** 2025-10-02
