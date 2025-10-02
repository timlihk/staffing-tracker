# Deployment Guide - Kirkland & Ellis Staffing Tracker

**Complete step-by-step guide for deploying to Railway.app**

---

## 🎯 Quick Start Checklist

- [ ] Railway.app account created
- [ ] PostgreSQL database deployed
- [ ] Backend service deployed
- [ ] Database migrations run
- [ ] Excel data imported
- [ ] Frontend deployed
- [ ] Default admin password changed

---

## 1. Deploy PostgreSQL Database

### Create Railway Project

1. Go to https://railway.app/new
2. Click **"Empty Project"**
3. Name it: `staffing-tracker`

### Add PostgreSQL

1. Click **"+ New"** → **"Database"** → **"Add PostgreSQL"**
2. Railway automatically:
   - Provisions PostgreSQL 17
   - Generates `DATABASE_URL`
   - Enables daily backups

### Verify Database Running

Check logs - should see:
```
✅ Database system is ready to accept connections
```

---

## 2. Deploy Backend Service

### Add Backend from GitHub

1. Click **"+ New"** → **"GitHub Repo"**
2. Select `timlihk/staffing-tracker`
3. **Configure before deploying:**

### Critical Settings

**Go to Settings → Service:**
- **Root Directory**: `backend` ⚠️ **REQUIRED**
- Start Command: `npm start` (auto-detected)

**Go to Variables → Add:**
```bash
NODE_ENV=production
JWT_SECRET=YOUR-SECRET-KEY-CHANGE-THIS-32-CHARS-MIN
JWT_EXPIRES_IN=7d
```

Note: `DATABASE_URL` auto-shared from PostgreSQL!

### Deploy Process

Railway will:
1. Pull code from GitHub
2. Run `npm install`
3. Run `prisma generate && tsc`
4. Start with `node dist/server.js`

### Get Backend URL

1. Settings → Networking
2. Copy public domain (e.g., `staffing-tracker-production.up.railway.app`)
3. Test: `https://YOUR-URL/api/health` → Returns `{"status":"ok"}`

---

## 3. Initialize Database

### Install Railway CLI

```bash
npm install -g @railway/cli
railway login
railway link  # Select: staffing-tracker project, backend service
```

### Run Migrations

```bash
# Create tables
railway run npx prisma migrate deploy
```

Expected output:
```
✅ Applying migration `20250101000000_init`
✅ Database schema is up to date
```

### Import Excel Data

```bash
# Import projects, staff, assignments
railway run npx ts-node src/scripts/migrate-excel.ts
```

Expected output:
```
✅ Created 25-30 staff members
✅ Created ~100 projects  
✅ Created 200+ assignments
✅ Created admin user
```

---

## 4. Deploy Frontend

### Option A: Vercel (Recommended)

1. Go to https://vercel.com
2. Import `timlihk/staffing-tracker`
3. Configure:
   - **Framework**: Vite
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Environment Variable**:
     ```
     VITE_API_URL=https://YOUR-BACKEND-URL/api
     ```
4. Deploy

### Option B: Railway

1. Click **"+ New"** → **"GitHub Repo"**
2. Select repository
3. Settings → Service:
   - **Root Directory**: `frontend`
4. Variables:
   ```
   VITE_API_URL=https://YOUR-BACKEND-URL/api
   ```
5. Deploy

### Update Backend CORS

Add to backend variables:
```
FRONTEND_URL=https://your-frontend-url.vercel.app
```

---

## 5. Access Application

### Login Credentials

```
Username: admin
Password: admin123
```

⚠️ **CHANGE IMMEDIATELY AFTER FIRST LOGIN!**

### Test Everything

- [ ] Backend health: `https://backend-url/api/health`
- [ ] Frontend loads
- [ ] Can login
- [ ] Dashboard shows data
- [ ] Projects list populated
- [ ] Staff list populated

---

## Environment Variables Reference

### Backend

| Variable | Value | Required |
|----------|-------|----------|
| `DATABASE_URL` | Auto-set by Railway | ✅ |
| `NODE_ENV` | `production` | ✅ |
| `JWT_SECRET` | 32+ char random string | ✅ |
| `JWT_EXPIRES_IN` | `7d` | ✅ |
| `FRONTEND_URL` | Frontend URL for CORS | ✅ |

### Frontend

| Variable | Value |
|----------|-------|
| `VITE_API_URL` | `https://backend-url/api` |

---

## Troubleshooting

### Backend: "Cannot find module '/app/index.js'"

**Cause:** Root Directory not set
**Fix:** Settings → Service → Root Directory: `backend`

### Backend: TypeScript Errors

**Cause:** Old code
**Fix:** Latest code is pushed (fixed Oct 2, 2025)

### Database: Can't Connect

**Cause:** DATABASE_URL not set
**Fix:** Verify PostgreSQL service is linked

### Frontend: CORS Errors

**Cause:** Missing FRONTEND_URL
**Fix:** Add FRONTEND_URL to backend variables

---

## Railway CLI Commands

```bash
# View logs
railway logs

# Run migrations
railway run npx prisma migrate deploy

# Import data
railway run npx ts-node src/scripts/migrate-excel.ts

# Open dashboard
railway open

# Connect to database
railway connect postgres
```

---

## Security

### Generate Strong JWT Secret

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Post-Deployment Security

1. Change admin password
2. Update JWT_SECRET to generated value
3. Enable 2FA on Railway
4. Review user access logs

---

## Cost Estimate

**Railway Hobby Plan:** $5/month
- PostgreSQL: ~$2/month
- Backend: ~$3/month
- Total covered by $5 plan credit

**Vercel:** Free tier sufficient

**Total:** ~$5/month

---

## Support

- **Backend Issues:** Check Deploy Logs and Build Logs
- **Database Issues:** Check PostgreSQL service logs
- **Frontend Issues:** Check browser console
- **Railway Docs:** https://docs.railway.app
- **Railway Discord:** https://discord.gg/railway

---

**Last Updated:** October 2, 2025  
**Version:** 1.0  
**Status:** ✅ Backend Production-Ready | 🔄 Frontend Complete & Deployed
