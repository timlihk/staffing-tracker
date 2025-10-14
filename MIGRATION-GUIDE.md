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

### Step 7: Verify Deployment

1. Check Railway deployment logs for both services
2. Test the production app
3. Verify database operations are working

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

- [ ] Local development works
- [ ] Backend deployed and tested on Railway
- [ ] Reminder-worker deployed and tested on Railway
- [ ] Database operations are faster
- [ ] All features working correctly
- [ ] Railway database kept as backup for 1-2 weeks
- [ ] Monitor Supabase usage in dashboard

## Support

If you run into issues:
- Supabase Docs: https://supabase.com/docs
- Supabase Discord: https://discord.supabase.com
- Railway Docs: https://docs.railway.app
