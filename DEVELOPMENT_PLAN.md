# Staffing Tracker - Development Plan & Roadmap

**Last Updated**: October 4, 2025
**Status**: Phase 1 Ready to Start
**Current Focus**: Critical Security Fixes

---

## 📊 Project Status Overview

### Recently Completed ✅
- Email diff logic fixed (no more false "Removed" messages)
- Production monitoring for email failures (logged to ActivityLog)
- .env security verified (not in git, properly ignored)
- Daily partner reminder system (Railway Worker)
- Email rate limiting (600ms delay, respects Resend limits)
- Test mode safety (prevents accidental partner emails)

### Current Code Quality
- **Test Coverage**: ~5% (minimal)
- **TypeScript Strict**: Disabled
- **Input Validation**: Partial (basic checks only)
- **Type Safety**: ~100 `any` types across codebase
- **Performance**: N+1 queries in dashboard, no database indexes

---

## 🎯 Implementation Phases

### Phase 1: Critical Security Fixes
**Timeline**: 3 days (20-24 hours)
**Focus**: Harden auth and validation on highest-risk endpoints

### Phase 2: Type Safety & Architecture
**Timeline**: 2 weeks (50-60 hours)
**Focus**: Complete validation, enable strict mode, infrastructure

### Phase 3: Performance & UX
**Timeline**: 3 weeks (60-80 hours)
**Focus**: Optimize queries, add indexes, refine rate limiting

### Phase 4: Quality & Maintainability
**Timeline**: Ongoing (100+ hours)
**Focus**: Tests, logging, monitoring, documentation

---

## 🚨 Phase 1: Critical Security Fixes (3 Days)

### Slice 1a: Auth Surface Hardening (Day 1, 6-8 hours)

#### 1. Strengthen Password Requirements
- [ ] Create `backend/src/schemas/auth.schema.ts`
- [ ] Implement password validation schema:
  ```typescript
  const passwordSchema = z.string()
    .min(8, 'Minimum 8 characters')
    .max(100, 'Maximum 100 characters')
    .regex(/[a-z]/, 'Must contain lowercase letter')
    .regex(/[A-Z]/, 'Must contain uppercase letter')
    .regex(/[0-9]/, 'Must contain digit')
    .regex(/[^a-zA-Z0-9]/, 'Must contain special character');
  ```
- [ ] Apply to `auth.controller.ts`:
  - Password reset endpoint
  - Password change endpoint
- [ ] **Skip**: Temporary password (user requirement: keep '0000')

#### 2. Add Zod Validation - Auth Endpoints
- [ ] Create schemas in `auth.schema.ts`:
  - `loginSchema` (username, password)
  - `passwordResetSchema` (oldPassword, newPassword)
  - `passwordChangeSchema` (newPassword)
- [ ] Update `auth.controller.ts`:
  - Parse requests with Zod
  - Return validation errors in standard format
  - Test all auth flows

#### 3. Rate Limiting - Password Reset
- [ ] Add password reset rate limiter:
  ```typescript
  const passwordResetLimiter = rateLimit({
    windowMs: 3600000, // 1 hour
    max: parseInt(process.env.PASSWORD_RESET_LIMIT || '5'),
    message: 'Too many password reset attempts'
  });
  ```
- [ ] Apply to password reset endpoint
- [ ] Document override in README: `PASSWORD_RESET_LIMIT` env var
- [ ] **Note**: Login rate limiting already implemented ✅

**Success Criteria**:
- ✅ Weak passwords rejected with clear error messages
- ✅ All auth endpoints validated with Zod
- ✅ Rate limiting prevents brute force on password reset
- ✅ Zero validation errors bypass checks

---

### Slice 1b: User Management (Day 2, 4-6 hours)

#### 4. Add Zod Validation - User Endpoints
- [ ] Create `backend/src/schemas/user.schema.ts`
- [ ] Implement schemas:
  ```typescript
  createUserSchema = z.object({
    username: z.string().min(3).max(50),
    email: z.string().email().max(100),
    role: z.enum(['admin', 'editor', 'viewer']),
    staffId: z.number().int().positive().optional().nullable()
  });

  updateUserSchema = z.object({
    username: z.string().min(3).max(50).optional(),
    email: z.string().email().max(100).optional(),
    role: z.enum(['admin', 'editor', 'viewer']).optional(),
    staffId: z.number().int().positive().optional().nullable()
  }).partial();
  ```
- [ ] Update `user.controller.ts`:
  - Validate create/update requests
  - Return descriptive errors
  - Test with invalid data

#### 5. Rate Limiting - User Creation
- [ ] Add user creation rate limiter:
  ```typescript
  const userCreationLimiter = rateLimit({
    windowMs: 3600000,
    max: parseInt(process.env.USER_CREATION_LIMIT || '10'),
    message: 'Too many user creation requests'
  });
  ```
- [ ] Apply to `POST /api/users`
- [ ] Document in README: Default 10/hour, configurable for bulk imports
- [ ] Test with rapid requests

**Success Criteria**:
- ✅ Invalid emails rejected
- ✅ Invalid roles rejected
- ✅ Rate limiting prevents spam user creation
- ✅ Bulk admin operations still possible (via override)

---

### Slice 1c: Project Mutations (Day 2-3, 6-8 hours)

#### 6. Add Zod Validation - Project Endpoints
- [ ] Create `backend/src/schemas/project.schema.ts`
- [ ] Implement schemas:
  ```typescript
  createProjectSchema = z.object({
    name: z.string().min(1).max(200),
    category: z.enum(['HK Trx', 'US Trx', 'HK Comp', 'US Comp', 'Others']),
    status: z.enum(['Active', 'Slow-down', 'Suspended']),
    priority: z.enum(['High', 'Medium', 'Low']).optional(),
    elStatus: z.string().max(100).optional(),
    timetable: z.enum(['PRE_A1', 'A1', 'HEARING', 'LISTING']).optional(),
    filingDate: z.string().datetime().optional().nullable(),
    listingDate: z.string().datetime().optional().nullable(),
    bcAttorney: z.string().max(200).optional(),
    notes: z.string().max(5000).optional()
  });

  updateProjectSchema = createProjectSchema.partial();

  projectFilterSchema = z.object({
    status: z.string().optional(),
    category: z.string().optional(),
    search: z.string().max(200).optional(),
    staffId: z.string().optional(),
    page: z.string().optional(),
    limit: z.string().optional()
  });
  ```
- [ ] Update `project.controller.ts`:
  - Validate create/update/filter requests
  - Test with invalid enums, long strings, malformed dates

**Success Criteria**:
- ✅ Invalid categories/statuses rejected
- ✅ Notes truncated at 5000 chars
- ✅ Search strings limited to 200 chars (prevents DoS)
- ✅ Invalid dates rejected

---

### Quick Win: Remove Unused Dependency (15 minutes)

- [ ] Run `npm uninstall csurf` in backend
- [ ] Verify no imports: `grep -r "csurf" backend/src`
- [ ] Commit: "Remove unused csurf dependency"
- [ ] **Rationale**: Bearer tokens provide CSRF protection

---

## 🔧 Phase 2: Type Safety & Architecture (2 Weeks)

### Week 1: Complete Validation Coverage

#### 7. Add Zod Validation - Staff Endpoints (4-6 hours)
- [ ] Create `backend/src/schemas/staff.schema.ts`
- [ ] Schemas: create, update, filter
- [ ] Validate position, status, department enums
- [ ] Update `staff.controller.ts`

#### 8. Add Zod Validation - Assignment Endpoints (2-3 hours)
- [ ] Create `backend/src/schemas/assignment.schema.ts`
- [ ] Validate projectId, staffId, jurisdiction
- [ ] Update `assignment.controller.ts`

#### 9. Add Zod Validation - Dashboard/Reports (2-3 hours)
- [ ] Validate query parameters
- [ ] Sanitize filter inputs
- [ ] Update `dashboard.controller.ts`

**Total Schemas**: 15 schemas across 5 controller files

---

### Week 2: TypeScript Strict Mode

#### 10. Enable Strict Mode Incrementally
- [ ] Create feature branch: `feat/typescript-strict`
- [ ] Enable flags one at a time in `tsconfig.json`:
  ```json
  {
    "strictNullChecks": true,           // ~60 errors
    "strictFunctionTypes": true,        // ~20 errors
    "noImplicitAny": true,              // ~30 errors
    "exactOptionalPropertyTypes": true  // ~20 errors
  }
  ```
- [ ] Fix errors by area:
  - [ ] Controllers first
  - [ ] Services second
  - [ ] Utils third
- [ ] Add tests as you fix (keep master green)
- [ ] Merge when all tests pass

**Expected**: 100-150 type errors total
**Approach**: Fix incrementally, test continuously
**Fallback**: If >2 weeks, defer to Phase 4

---

### Infrastructure

#### 11. Reduce `any` Usage (Ongoing)
- [ ] Replace `any` in files modified during validation work
- [ ] Use Zod inferred types: `z.infer<typeof createProjectSchema>`
- [ ] Use Prisma generated types
- [ ] Create proper interfaces
- [ ] **Scope**: Only modified files (not entire codebase)
- [ ] Track remaining `any` as tech debt

#### 12. Configure Database Connection Pool (1 day)
- [ ] Update DATABASE_URL in Railway:
  ```
  postgresql://...?connection_limit=20&pool_timeout=20&connect_timeout=10
  ```
- [ ] Document in README:
  - Railway free tier: 20 connections max
  - Formula: (workers × connections_per_worker) < 20
  - Default: 1 worker × 10 connections = safe
- [ ] Test connection stability under load

#### 13. Add Worker Health Checks with Retry (1 day)
- [ ] Implement in `worker/reminder-cron.ts`:
  ```typescript
  async function checkDatabaseConnection(maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await prisma.$queryRaw`SELECT 1`;
        console.log('✅ Database connection verified');
        return true;
      } catch (error) {
        console.error(`❌ DB connection attempt ${attempt}/${maxRetries} failed`);

        if (attempt === maxRetries) {
          console.error('💥 Max retries reached - exiting for Railway restart');
          process.exit(1);
        }

        const backoff = Math.min(5000 * attempt, 15000);
        await delay(backoff);
      }
    }
  }
  ```
- [ ] Call on worker startup before cron schedule
- [ ] Test: Disconnect Postgres, verify retry → exit → Railway restart
- [ ] **Dependency**: Connection pool config (#12)

---

## ⚡ Phase 3: Performance & UX (3 Weeks)

### Database Optimization

#### 14. Add Performance Indexes (1 day)
- [ ] Create migration: `add_performance_indexes`
- [ ] Add indexes:
  ```prisma
  model User {
    @@index([role])
    @@index([staffId])
  }

  model Staff {
    @@index([status])
    @@index([department])
    @@index([position])
  }

  model ActivityLog {
    @@index([entityType])
    @@index([actionType])
    @@index([userId, createdAt(sort: Desc)])
  }

  model Project {
    @@index([status, category]) // Composite for common filter
  }
  ```
- [ ] Run migration: `npx prisma migrate deploy`
- [ ] Verify with `EXPLAIN ANALYZE` on common queries
- [ ] Measure before/after query times

**Expected**: 8 new indexes, significant performance improvement

---

#### 15. Optimize Dashboard Queries (2-3 days)
- [ ] Audit current queries (12 separate calls)
- [ ] Implement aggregations:
  ```typescript
  // Query 1: Project stats
  const projectStats = await prisma.$queryRaw`
    SELECT
      COUNT(*) FILTER (WHERE status = 'Active') as active,
      COUNT(*) FILTER (WHERE status = 'Slow-down') as slowdown,
      COUNT(*) FILTER (WHERE priority = 'High') as high_priority,
      -- ... more aggregations
    FROM projects
  `;

  // Query 2: Staff stats
  const staffStats = await prisma.$queryRaw`...`;
  ```
- [ ] Reduce to 2 aggregate queries
- [ ] Measure performance: Target <500ms dashboard load
- [ ] Test with larger datasets

**Current**: 12 queries
**Target**: 2 queries
**Goal**: <500ms load time

---

### Advanced Rate Limiting

#### 16. Per-User Rate Limiting for Reports (1 day)
- [ ] Implement per-user (not per-IP) limiting:
  ```typescript
  const reportLimiter = rateLimit({
    windowMs: 60000,
    max: 5,
    keyGenerator: (req) => {
      const user = (req as AuthRequest).user;
      return user?.userId?.toString() || req.ip;
    }
  });
  ```
- [ ] Apply to `/api/reports` endpoints
- [ ] Test with multiple users from same IP
- [ ] **Rationale**: Shared networks (office, VPN)

#### 17. Add Pagination Limits (2 hours)
- [ ] Enforce max pagination:
  ```typescript
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
  ```
- [ ] Apply to all list endpoints:
  - Projects
  - Staff
  - Users
  - Assignments
  - Activity logs
- [ ] Document in API docs

---

### Token Management

#### 18. Token Invalidation (Design + Implementation)
- [ ] **Design Decision Required**:
  - Option A: Revocation list (new RevokedToken table)
  - Option B: Refresh tokens (15min JWT + 7 day refresh)
  - Option C: Check user status on every request
- [ ] **Recommendation**: Option B (refresh tokens)
- [ ] Create Prisma model:
  ```prisma
  model RefreshToken {
    id        Int      @id @default(autoincrement())
    userId    Int
    token     String   @unique
    expiresAt DateTime
    createdAt DateTime @default(now())
    user      User     @relation(fields: [userId], references: [id])
  }
  ```
- [ ] Implement token refresh endpoint
- [ ] Update frontend to handle token refresh
- [ ] Test: Delete user, verify session invalidated

**Note**: Requires frontend changes - coordinate carefully

---

## 🧪 Phase 4: Quality & Maintainability (Ongoing)

### Test Coverage Milestones

#### Milestone 1: 30% Coverage (2-3 weeks)
- [ ] Auth controller tests
  - [ ] Login success/failure
  - [ ] Password reset flow
  - [ ] Token validation
- [ ] Email service tests
  - [ ] Welcome email generation
  - [ ] Project update email generation
  - [ ] Partner reminder logic
- [ ] Validation schema tests
  - [ ] All Zod schemas with valid/invalid data
- [ ] Set up Jest coverage reporting

#### Milestone 2: 50% Coverage (4-6 weeks)
- [ ] All controller CRUD tests
  - [ ] Projects: create, update, delete, list
  - [ ] Staff: create, update, delete, list
  - [ ] Users: create, update, delete, list
  - [ ] Assignments: bulk create, delete
- [ ] Service layer tests
  - [ ] Project reminder service
  - [ ] Change tracking service
- [ ] Error handling tests
  - [ ] Invalid inputs
  - [ ] Database errors
  - [ ] Network failures

#### Milestone 3: 80% Coverage (8-12 weeks)
- [ ] Integration tests
  - [ ] Auth flow end-to-end
  - [ ] Project CRUD with assignments
  - [ ] Email sending with rate limiting
- [ ] E2E critical flows
  - [ ] User login → create project → assign staff
  - [ ] Admin creates user → user resets password
  - [ ] Partner receives reminder → updates project
- [ ] Edge cases
  - [ ] Concurrent updates
  - [ ] Rate limit boundary conditions
  - [ ] Token expiration scenarios

---

### Infrastructure & Monitoring

#### 19. Structured Logging (1-2 weeks)
- [ ] Install Pino: `npm install pino pino-pretty`
- [ ] Configure logger:
  ```typescript
  const logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    transport: process.env.NODE_ENV === 'development'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined
  });
  ```
- [ ] Replace `console.log` calls:
  - [ ] Controllers
  - [ ] Services
  - [ ] Worker
  - [ ] Server startup
- [ ] Add contextual logging:
  ```typescript
  logger.info({ userId, projectId, duration }, 'Project updated');
  logger.error({ err, email }, 'Email send failed');
  ```

#### 20. Enhanced Health Checks (2-3 days)
- [ ] Update `/api/health` endpoint:
  ```typescript
  app.get('/api/health', async (req, res) => {
    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: 'checking',
      email: 'checking'
    };

    try {
      await prisma.$queryRaw`SELECT 1`;
      health.database = 'connected';
    } catch (error) {
      health.database = 'disconnected';
      health.status = 'degraded';
    }

    // Optional: Check Resend API
    // health.email = await checkResend();

    const statusCode = health.status === 'ok' ? 200 : 503;
    res.status(statusCode).json(health);
  });
  ```
- [ ] Test failure scenarios
- [ ] Use in Railway monitoring

#### 21. Standardize Error Responses (1 week)
- [ ] Create error response interface:
  ```typescript
  interface ErrorResponse {
    error: {
      message: string;
      code?: string;
      details?: ValidationError[];
    };
  }
  ```
- [ ] Update all controllers to use format
- [ ] Include Zod validation details
- [ ] Test client-side error handling

#### 22. Request Timeouts (1 day)
- [ ] Configure Express server:
  ```typescript
  server.timeout = 30000; // 30 seconds
  server.keepAliveTimeout = 65000; // > load balancer timeout
  ```
- [ ] Test with slow endpoints
- [ ] Document timeout behavior

---

## 📈 Dependencies & Timeline

### Dependency Tree

```
Phase 1 (Sequential):
  Slice 1a → Slice 1b → Slice 1c
  Quick Win (parallel)

Phase 2 (Dependencies):
  Week 1 (Validation) → Week 2 (TypeScript Strict)
  Connection Pool (#12) → Worker Health Checks (#13)

Phase 3 (Some parallel):
  Database Indexes (#14) ───┐
  Dashboard Optimization (#15) ← Can use indexes
  Rate Limiting (#16) ────────┘
  Token Invalidation (#18) ← Requires design decision

Phase 4 (All parallel):
  Test coverage milestones
  Logging, health checks, error handling
```

### Critical Path
1. Phase 1 (3 days) → Security hardened
2. Phase 2 (2 weeks) → Type-safe & validated
3. Phase 3 (3 weeks) → Performant
4. Phase 4 (ongoing) → Maintainable

**Total to "Production Ready"**: ~6 weeks

---

## ✅ Success Criteria by Phase

### Phase 1 Complete When:
- [ ] All auth, user, project endpoints have Zod validation
- [ ] Password complexity enforced (8 chars, mixed case, digit, special)
- [ ] Rate limiting active on password reset and user creation
- [ ] Zero validation errors bypass checks to reach database
- [ ] csurf dependency removed
- [ ] No breaking changes to existing functionality

### Phase 2 Complete When:
- [ ] All 15 Zod schemas implemented across all controllers
- [ ] TypeScript strict mode enabled with 0 compiler errors
- [ ] `any` types removed from all controllers and services
- [ ] Database connection pool configured (20 connections)
- [ ] Worker health checks retry 3x before exit
- [ ] All tests passing in strict mode

### Phase 3 Complete When:
- [ ] 8 database indexes deployed to production
- [ ] Dashboard loads in <500ms (measured)
- [ ] Per-user rate limiting on reports (not per-IP)
- [ ] Pagination capped at 100 items
- [ ] Token invalidation working (deleted user sessions end)
- [ ] No N+1 queries in dashboard

### Phase 4 Complete When:
- [ ] 80% test coverage achieved
- [ ] Structured logging in all production code
- [ ] Health check returns all system statuses
- [ ] All error responses follow standard format
- [ ] Request timeouts configured
- [ ] CI/CD pipeline running tests on every commit

---

## ⚠️ Risk Mitigation

### TypeScript Strict Mode
- **Risk**: 100+ errors blocks development
- **Mitigation**:
  - Work in feature branch
  - Fix incrementally by area
  - Add tests as you go
  - Keep master green
- **Fallback**: Defer to Phase 4 if >2 weeks to fix

### Rate Limiting
- **Risk**: Legitimate bulk operations blocked
- **Mitigation**:
  - Environment variable overrides (`PASSWORD_RESET_LIMIT`, `USER_CREATION_LIMIT`)
  - Document in README
  - Monitor rate limit hits in ActivityLog
- **Rollback**: Can disable per-endpoint if issues

### Worker Retry Logic
- **Risk**: Infinite retry loop, resource exhaustion
- **Mitigation**:
  - Max 3 retry attempts
  - Exponential backoff (5s, 10s, 15s max)
  - Exit after max retries → Railway restarts worker
  - Log each attempt for debugging
- **Monitoring**: Track restart frequency

### Database Connection Pool
- **Risk**: Connection exhaustion, deadlocks
- **Mitigation**:
  - Conservative limit (20 connections)
  - Monitor connection usage
  - Graceful degradation on pool exhaustion
- **Adjust**: Can tune based on production metrics

### Test Coverage
- **Risk**: Tests become maintenance burden
- **Mitigation**:
  - Focus on critical paths first
  - Write tests alongside features
  - Use integration tests for flows, unit tests for logic
  - Skip low-value tests
- **Goal**: Quality over quantity

---

## 📝 Notes & Assumptions

### Design Decisions
- **Temp Password**: Keep '0000' (user requirement - acceptable as reset required)
- **CSRF Protection**: Bearer tokens sufficient, remove csurf
- **Rate Limiting**: Per-IP for auth, per-user for reports
- **Token Strategy**: TBD - needs design review (Phase 3)

### Technical Debt
- Remaining `any` types outside modified files
- Test coverage below 80%
- No E2E tests for frontend
- Manual deployment process
- No automated security scanning

### Future Considerations
- Implement CI/CD pipeline (GitHub Actions)
- Add frontend E2E tests (Playwright/Cypress)
- Security audit and penetration testing
- Performance monitoring (APM tool)
- Error tracking (Sentry/DataDog)
- API documentation (OpenAPI/Swagger)

---

## 🚀 Getting Started

### To Begin Phase 1:
```bash
cd backend
npm install zod  # If not already installed
git checkout -b feat/phase-1-security
```

### Create First Schema:
```bash
mkdir -p src/schemas
touch src/schemas/auth.schema.ts
```

### Run Tests After Each Change:
```bash
npm test
npm run build  # Verify no TS errors
```

### Track Progress:
- Update checkboxes in this document
- Commit after each completed task
- Create PR after each slice completes

---

**Ready to start? Begin with Slice 1a: Auth Surface Hardening** ✨
