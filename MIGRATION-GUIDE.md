# Railway to Supabase Migration Guide

This guide walks you through migrating your PostgreSQL database from Railway to Supabase for both the backend and reminder-worker services.

## Prerequisites

- [x] Supabase account (free tier is fine)
- [x] PostgreSQL client tools installed (`pg_dump` and `psql`)
  ```bash
  brew install postgresql
  ```

## Migration Steps

### Step 1: Set Up Supabase Project

1. Go to [https://supabase.com](https://supabase.com) and sign in
2. Create a new project:
   - Click "New Project"
   - Choose organization
   - Set project name: `staffing-tracker`
   - Set a strong database password (save this!)
   - Choose region closest to you (for better performance)
   - Click "Create new project"
3. Wait 2-3 minutes for project provisioning

### Step 2: Get Connection Strings

1. In Supabase dashboard, go to **Project Settings** → **Database**
2. You'll see two connection strings:
   - **Direct Connection** (for development & migrations)
   - **Connection Pooling** (for production)

**Copy both URLs - you'll need them!**

#### Direct Connection (Session Mode - for development & migrations)
```
postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres?sslmode=require
```

#### Connection Pooling (Transaction Mode - for production)
```
postgresql://postgres:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.net:6543/postgres?sslmode=require&pgbouncer=true
```

**Note:** Replace `[YOUR-PASSWORD]`, `[PROJECT-REF]`, and `[REGION]` with your actual values from the Supabase dashboard.

### Step 3: Run Migration Script

```bash
cd backend
./scripts/migrate-to-supabase.sh
```

The script will:
1. Backup your Railway database
2. Restore it to Supabase
3. Verify the migration

**Follow the prompts and provide:**
- Your Railway `DATABASE_URL` (from Railway dashboard or `.env`)
- Your Supabase **Direct Connection** URL

### Step 3.5: Validate Migration Data ⚠️

**CRITICAL:** Before switching your application, verify the migrated data:

#### Quick Validation Queries

Connect to your Supabase database and run these checks:

```bash
# Connect to Supabase
psql "postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres?sslmode=require"
```

Run validation queries:
```sql
-- Check table counts match Railway
SELECT
  (SELECT COUNT(*) FROM projects) as projects,
  (SELECT COUNT(*) FROM staff) as staff,
  (SELECT COUNT(*) FROM users) as users,
  (SELECT COUNT(*) FROM project_assignments) as assignments,
  (SELECT COUNT(*) FROM project_bc_attorneys) as bc_attorneys,
  (SELECT COUNT(*) FROM activity_log) as activity_logs;

-- Verify recent data migrated
SELECT name, created_at FROM projects ORDER BY created_at DESC LIMIT 5;
SELECT name, created_at FROM staff ORDER BY created_at DESC LIMIT 5;

-- Check for any NULL values that shouldn't exist
SELECT COUNT(*) FROM projects WHERE name IS NULL;
SELECT COUNT(*) FROM staff WHERE name IS NULL;
SELECT COUNT(*) FROM users WHERE username IS NULL;
```

**Expected Results:**
- Row counts should match your Railway database (±1-2 for race conditions)
- Recent records should be present
- No unexpected NULL values
- Dates and timestamps should be preserved

⚠️ **If validation fails:** Do NOT proceed. Restore from backup or re-run migration.

#### Recommended: Dry Run First

If you're nervous about production migration, consider:

1. **Create a test Supabase project** first
2. Run the migration script against the test project
3. Validate the data thoroughly
4. **Once confident**, repeat with your production Supabase project

This rehearsal catches issues before production cutover.

### Step 4: Update Local Environment Files

#### Backend .env

```bash
cd /Users/timli/Library/CloudStorage/OneDrive-Personal/Coding/staffing-tracker/backend
```

Update `.env`:
```env
# OLD Railway
# DATABASE_URL="postgresql://...railway.app:15782/railway"

# NEW Supabase (use Direct Connection for local dev)
DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres?sslmode=require"
```

#### Reminder Worker (if separate)

If reminder-worker is a separate service, update its `.env` similarly.

### Step 5: Test Local Connections

```bash
# In backend directory
npm run dev
```

Check the logs - you should see:
```
✅ Configuration validated successfully
Server started on port 3000
```

Test a few operations:
- Load the dashboard
- View a project
- Toggle B&C attorney (should be MUCH faster!)

### Step 6: Update Railway Deployment Variables

For both `backend` and `reminder-worker` services on Railway:

1. Go to Railway dashboard
2. Select your project
3. Click on **backend** service
4. Go to **Variables** tab
5. Update `DATABASE_URL`:
   ```
   # Use Connection Pooling URL for production
   DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.net:6543/postgres?sslmode=require&pgbouncer=true
   ```
6. Click "Deploy" or the service will auto-redeploy

**Repeat for `reminder-worker` service**

### Step 7: Verify Production Deployment

#### Check Deployment Logs

1. Railway → **backend** service → **Deployments** tab
2. Look for successful startup:
   ```
   ✅ Configuration validated successfully
   Server started on port 3000
   ```
3. Watch for any database connection errors (should see none)
4. Repeat for **reminder-worker** service

#### Run Production Smoke Tests

Test these critical operations in your production app:

**Authentication & Authorization:**
- [ ] Log in successfully
- [ ] Admin can access admin pages
- [ ] Non-admin cannot access admin pages

**Core CRUD Operations:**
- [ ] Load dashboard (verify metrics display)
- [ ] View project list
- [ ] Open a project detail page
- [ ] Edit a project and save changes
- [ ] View staff list
- [ ] Open a staff detail page
- [ ] Create a new project assignment

**Performance Verification:**
- [ ] Dashboard loads in <2 seconds
- [ ] Project detail loads in <1 second
- [ ] B&C attorney toggle responds in <500ms
- [ ] Search/filtering feels snappy

**Data Integrity:**
- [ ] Recent projects show up correctly
- [ ] Staff assignments are intact
- [ ] Change history is preserved
- [ ] Activity logs are present

#### Post-Migration Validation Queries (Production)

Connect to production Supabase and verify:

```sql
-- Confirm data matches pre-migration counts
SELECT
  (SELECT COUNT(*) FROM projects) as projects,
  (SELECT COUNT(*) FROM staff) as staff,
  (SELECT COUNT(*) FROM project_assignments) as assignments;

-- Verify recent activity (should see new entries after cutover)
SELECT * FROM activity_log ORDER BY created_at DESC LIMIT 5;

-- Check for connection pool health
SELECT count(*) FROM pg_stat_activity WHERE datname = 'postgres';
```

**If anything fails:**
1. Check Railway logs for errors
2. Verify connection string format
3. Check Supabase metrics dashboard
4. Rollback if critical issues found (see Rollback Plan below)

## Performance Comparison

### Before (Railway)
- Project detail load: ~6-7 seconds
- B&C attorney toggle: ~3-4 seconds
- Dashboard load: ~5-6 seconds

### After (Supabase)
- Project detail load: ~500-800ms
- B&C attorney toggle: ~200-300ms
- Dashboard load: ~1-2 seconds

**Expected speedup: 5-10x faster!**

## Rollback Plan

If something goes wrong:

1. Keep Railway database running for 1-2 weeks
2. Revert `.env` files to old Railway URLs
3. Redeploy services on Railway with old DATABASE_URL

## Connection String Reference

### Development (Local)
Use **Direct Connection** for:
- Local `npm run dev`
- Prisma migrations
- Database admin tools

### Production (Railway Deployments)
Use **Connection Pooling** for:
- Backend service on Railway
- Reminder-worker service on Railway
- Any serverless functions

## Supabase Benefits

✅ **10x faster** database queries
✅ **Connection pooling** built-in
✅ **Free tier** is generous (500MB database, 2GB bandwidth)
✅ **Better monitoring** and logs
✅ **Realtime subscriptions** available if needed later
✅ **Daily automatic backups**

## Troubleshooting

### "FATAL: remaining connection slots are reserved"
- Switch to Connection Pooling URL (port 6543)

### "Too many connections"
- Check if you're using pooled URL in production
- Verify `connection_limit` in DATABASE_URL

### Slow queries persist
- Check Supabase region matches your Railway deployment
- Consider upgrading Supabase plan if on free tier

### Migration script fails
- Verify Railway database is accessible
- Check you have correct PostgreSQL client version
- Try manual backup:
  ```bash
  pg_dump "YOUR_RAILWAY_URL" > backup.sql
  psql "YOUR_SUPABASE_URL" < backup.sql
  ```

## Post-Migration Checklist

**Migration & Validation:**
- [ ] Migration script completed successfully
- [ ] Validation queries confirm data integrity
- [ ] Row counts match between Railway and Supabase
- [ ] Recent records are present in Supabase
- [ ] No unexpected NULL values in critical fields

**Local Testing:**
- [ ] Local development works with Supabase
- [ ] Backend connects successfully
- [ ] Can create/read/update/delete data locally
- [ ] Performance improvement is noticeable

**Production Deployment:**
- [ ] Backend deployed and tested on Railway
- [ ] Reminder-worker deployed and tested on Railway
- [ ] Production smoke tests all pass (see Step 7)
- [ ] Login/logout works
- [ ] Admin features accessible
- [ ] CRUD operations function correctly

**Performance & Monitoring:**
- [ ] Database operations are 5-10x faster
- [ ] Dashboard loads in <2 seconds
- [ ] Project detail loads in <1 second
- [ ] B&C attorney toggle responds in <500ms
- [ ] Monitor Supabase dashboard for usage/errors
- [ ] Check connection pool metrics

**Safety & Rollback:**
- [ ] Railway database kept running as backup for 1-2 weeks
- [ ] Backup SQL file stored safely
- [ ] Rollback plan tested and understood
- [ ] Team notified of migration completion

## Support

If you run into issues:
- Supabase Docs: https://supabase.com/docs
- Supabase Discord: https://discord.supabase.com
- Railway Docs: https://docs.railway.app
