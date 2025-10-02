# Kirkland & Ellis Staffing Tracker - Deployment Guide

## Project Status

### ✅ Completed Components

#### Backend (100% Complete)
- [x] Node.js + Express + TypeScript setup
- [x] PostgreSQL database schema with Prisma ORM
- [x] JWT-based authentication system
- [x] Complete REST API with all endpoints:
  - Authentication (login, register, me)
  - Projects CRUD
  - Staff CRUD
  - Assignments CRUD (including bulk operations)
  - Dashboard & reporting endpoints
- [x] Excel data migration script
- [x] Activity logging system
- [x] Role-based access control (admin, editor, viewer)
- [x] Railway.app configuration files

#### Frontend (In Progress)
- [x] Vite + React + TypeScript setup
- [x] Material-UI installed
- [x] React Router installed
- [ ] Component implementation (needs to be completed)

---

## Backend Deployment to Railway.app

### Step 1: Prepare Your Backend

The backend is fully ready for deployment. Here's what's included:

**Files:**
- `/backend/src/` - Complete TypeScript source code
- `/backend/prisma/schema.prisma` - Database schema
- `/backend/railway.json` - Railway configuration
- `/backend/package.json` - Dependencies and scripts

### Step 2: Deploy Backend to Railway

1. **Create Railway Account**
   - Go to https://railway.app
   - Sign up with GitHub

2. **Create New Project**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Connect your GitHub account and select your repository

3. **Add PostgreSQL Database**
   - In your project, click "+ New"
   - Select "Database" → "PostgreSQL"
   - Railway will automatically create `DATABASE_URL` environment variable

4. **Configure Backend Service**
   - Click "+ New" → "GitHub Repo"
   - Select your repository
   - **Important**: Set root directory to `backend`

5. **Set Environment Variables**
   In the backend service settings, add:
   ```
   NODE_ENV=production
   JWT_SECRET=your-super-secret-jwt-key-min-32-characters
   JWT_EXPIRES_IN=7d
   PORT=3000
   FRONTEND_URL=https://your-frontend-url.railway.app
   ```

   **Note**: `DATABASE_URL` and `PORT` are auto-configured by Railway

6. **Deploy**
   - Railway will automatically build and deploy
   - Build command: `npm install && npx prisma generate && npm run build`
   - Start command: `npx prisma migrate deploy && npm start`

7. **Run Data Migration**
   - After first deployment, go to Railway dashboard
   - Click on your backend service
   - Open "Settings" → "Deployments"
   - Click "Terminal" or "Deploy Logs"
   - Note: You'll need to manually upload the Excel file and run migration

   **Alternative**: Use the default user created by the migration script

### Step 3: Verify Backend

1. Visit your Railway backend URL + `/api/health`
   - Example: `https://your-backend.up.railway.app/api/health`
   - Should return: `{"status":"ok","message":"Staffing Tracker API is running"}`

2. Test login endpoint:
   ```bash
   curl -X POST https://your-backend.up.railway.app/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"username":"admin","password":"admin123"}'
   ```

---

## Frontend Deployment

### Option 1: Deploy Frontend to Railway (Recommended)

1. **Complete Frontend Development** (see Frontend Checklist below)

2. **Add Frontend Service to Railway**
   - In your Railway project, click "+ New"
   - Select "GitHub Repo" (same repository)
   - Set root directory to `frontend`

3. **Environment Variables for Frontend**
   ```
   VITE_API_URL=https://your-backend.up.railway.app/api
   ```

4. **Build Settings**
   - Build command: `npm install && npm run build`
   - Start command: `npm run preview` (or use static file serving)

### Option 2: Deploy Frontend to Vercel

1. Push frontend code to GitHub
2. Go to Vercel.com
3. Import your repository
4. Set root directory to `frontend`
5. Add environment variable:
   ```
   VITE_API_URL=https://your-backend.up.railway.app/api
   ```
6. Deploy!

---

## Frontend Development Checklist

The frontend is scaffolded but needs component implementation. Here's what needs to be built:

### Core Structure
- [ ] `/src/context/AuthContext.tsx` - Authentication context
- [ ] `/src/api/client.ts` - Axios API client
- [ ] `/src/types/` - TypeScript type definitions

### Pages
- [ ] `/src/pages/Login.tsx` - Login page
- [ ] `/src/pages/Dashboard.tsx` - Main dashboard
- [ ] `/src/pages/Projects.tsx` - Project list view
- [ ] `/src/pages/ProjectDetail.tsx` - Individual project view
- [ ] `/src/pages/Staff.tsx` - Staff list view
- [ ] `/src/pages/StaffDetail.tsx` - Individual staff view

### Components
- [ ] `/src/components/Layout.tsx` - Main layout with sidebar
- [ ] `/src/components/Sidebar.tsx` - Navigation sidebar
- [ ] `/src/components/ProjectTable.tsx` - Project data table
- [ ] `/src/components/StaffTable.tsx` - Staff data table
- [ ] `/src/components/ProjectForm.tsx` - Create/edit project form
- [ ] `/src/components/StaffForm.tsx` - Create/edit staff form
- [ ] `/src/components/AssignmentDialog.tsx` - Assignment management
- [ ] `/src/components/DashboardCharts.tsx` - Charts and visualizations

### Quick Start Frontend Template

I'll create a minimal working frontend for you now...

---

## Database Migration

### Initial Setup (After Backend Deployment)

1. **Access Railway PostgreSQL**
   - Get connection string from Railway dashboard
   - Use any PostgreSQL client (or Railway CLI)

2. **Run Migrations**
   ```bash
   # From your local machine with DATABASE_URL from Railway
   cd backend
   npx prisma migrate deploy
   ```

3. **Seed Data (Optional)**
   - Upload Excel file to backend
   - Run migration script via Railway terminal

### Alternative: Manual Data Entry

Use the API endpoints to manually create:
1. Admin user
2. Staff members
3. Projects
4. Assignments

---

## Security Checklist

Before going to production:

- [ ] Change default admin password
- [ ] Update `JWT_SECRET` to strong random value (min 32 characters)
- [ ] Set `NODE_ENV=production`
- [ ] Enable CORS only for your frontend domain
- [ ] Set up Railway custom domain with SSL
- [ ] Review and test role-based permissions
- [ ] Set up database backups in Railway
- [ ] Add rate limiting (optional enhancement)

---

## Testing Your Deployment

### Backend Tests

1. **Health Check**
   ```bash
   curl https://your-backend.up.railway.app/api/health
   ```

2. **Login**
   ```bash
   curl -X POST https://your-backend.up.railway.app/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"username":"admin","password":"admin123"}'
   ```

3. **Get Projects** (with token from login)
   ```bash
   curl https://your-backend.up.railway.app/api/projects \
     -H "Authorization: Bearer YOUR_TOKEN_HERE"
   ```

### Frontend Tests

1. Visit frontend URL
2. Login with admin credentials
3. Verify dashboard loads
4. Test creating a project
5. Test creating a staff member
6. Test assignment functionality

---

## Monitoring & Maintenance

### Railway Dashboard

- **Metrics**: Monitor CPU, memory, and bandwidth usage
- **Logs**: View application logs in real-time
- **Deployments**: Track deployment history
- **Database**: Monitor PostgreSQL metrics

### Recommended Monitoring

1. **Uptime Monitoring**: Set up UptimeRobot or similar
2. **Error Tracking**: Consider adding Sentry for error tracking
3. **Database Backups**: Configure automated backups in Railway

---

## Cost Estimates (Railway)

- **Hobby Plan** (Good for testing):
  - $5/month base
  - Includes $5 usage credit
  - Likely sufficient for small team

- **Pro Plan** (Production):
  - $20/month base
  - Includes $20 usage credit
  - Recommended for production use

**Estimated monthly cost**: $5-$30 depending on usage

---

## Troubleshooting

### Backend won't start
- Check environment variables are set
- Verify DATABASE_URL is correct
- Check deployment logs in Railway

### Database connection fails
- Ensure PostgreSQL service is running
- Verify DATABASE_URL format
- Check Railway network settings

### Frontend can't connect to backend
- Verify VITE_API_URL is correct
- Check CORS settings in backend
- Verify both services are deployed

### Migration fails
- Check Prisma schema syntax
- Ensure database is empty or migrations are in sync
- Try `npx prisma migrate reset` (CAUTION: deletes all data)

---

## Next Steps

1. ✅ Backend is complete and ready to deploy
2. 🔄 Complete frontend components (I can help with this)
3. 🚀 Deploy both to Railway
4. 🧪 Test thoroughly
5. 📊 Migrate Excel data
6. 👥 Train users
7. 🎉 Go live!

---

## Support

For issues or questions:
1. Check Railway documentation: https://docs.railway.app
2. Check Prisma documentation: https://www.prisma.io/docs
3. Check Material-UI documentation: https://mui.com

---

## Current Project Structure

```
staffing-tracker/
├── backend/                          ✅ COMPLETE
│   ├── src/
│   │   ├── controllers/             ✅ All 5 controllers implemented
│   │   ├── routes/                  ✅ All routes configured
│   │   ├── middleware/              ✅ Auth middleware ready
│   │   ├── utils/                   ✅ Prisma client & JWT utils
│   │   ├── scripts/                 ✅ Excel migration script
│   │   └── server.ts                ✅ Main server file
│   ├── prisma/
│   │   └── schema.prisma            ✅ Complete database schema
│   ├── package.json                 ✅ All dependencies listed
│   ├── tsconfig.json                ✅ TypeScript configured
│   ├── railway.json                 ✅ Railway config ready
│   └── README.md                    ✅ Documentation complete
│
├── frontend/                         🔄 IN PROGRESS
│   ├── src/
│   ├── package.json                 ✅ Dependencies installed
│   ├── tsconfig.json                ✅ TypeScript configured
│   └── vite.config.ts               ✅ Vite configured
│
├── IMPLEMENTATION_PLAN.md           ✅ Detailed planning doc
└── DEPLOYMENT_GUIDE.md              ✅ This file
```

---

**Ready to deploy the backend to Railway? Let me know when you're ready and I'll help you complete the frontend!**
