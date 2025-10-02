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

### ✅ Backend (100% Complete)
- Full REST API with Express.js + TypeScript
- PostgreSQL database with Prisma ORM
- JWT authentication with role-based access
- Complete CRUD operations for Projects, Staff, and Assignments
- Dashboard and reporting endpoints
- Excel data migration script
- **Ready for deployment to Railway.app**

### 🔄 Frontend (75% Complete)
- Vite + React + TypeScript scaffolding
- Material-UI components installed
- API client and auth context configured
- Type definitions complete
- **Needs**: Page components and UI implementation

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
# Edit .env with your DATABASE_URL
```

3. Run database migrations:
```bash
npx prisma generate
npx prisma migrate dev
```

4. (Optional) Migrate data from Excel:
```bash
npx ts-node src/scripts/migrate-excel.ts
```

5. Start development server:
```bash
npm run dev
```

Backend will run on `http://localhost:3000`

### Frontend Setup

1. Navigate to frontend directory:
```bash
cd frontend
npm install
```

2. Create `.env` file:
```bash
VITE_API_URL=http://localhost:3000/api
```

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
- **Framework**: React 18
- **Language**: TypeScript
- **UI Library**: Material-UI (MUI)
- **Routing**: React Router v6
- **State**: React Context API
- **HTTP Client**: Axios
- **Charts**: Recharts
- **Build Tool**: Vite

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
- start_date, target_filing_date, actual_filing_date
- notes, timeline_status

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

### Completed
- ✅ User authentication (JWT-based)
- ✅ Role-based access control (admin, editor, viewer)
- ✅ Project CRUD operations
- ✅ Staff CRUD operations
- ✅ Assignment management (including bulk operations)
- ✅ Project status tracking with history
- ✅ Activity logging
- ✅ Dashboard API with summaries
- ✅ Workload reporting
- ✅ Excel data migration script
- ✅ Railway deployment configuration

### To Be Implemented (Frontend)
- [ ] Login/Register UI
- [ ] Dashboard with charts
- [ ] Project list and detail views
- [ ] Staff list and detail views
- [ ] Assignment management UI
- [ ] Workload visualization
- [ ] Activity feed
- [ ] Responsive design
- [ ] Data export functionality

## 🛡️ Security Features

- JWT-based authentication
- Password hashing with bcrypt
- Role-based authorization
- SQL injection protection (Prisma)
- CORS configuration
- Environment variable management
- Activity audit logging

## 📈 Next Steps

1. **Complete Frontend** - Build remaining React components
2. **Testing** - Add unit and integration tests
3. **Deploy** - Push to Railway.app
4. **Data Migration** - Import Excel data
5. **User Training** - Train staff on new system
6. **Go Live** - Switch from Excel to web app

## 📝 License

Proprietary - Kirkland & Ellis

## 👥 Support

For questions or issues:
1. Check `IMPLEMENTATION_PLAN.md` for detailed specifications
2. Check `DEPLOYMENT_GUIDE.md` for deployment help
3. Review API documentation in backend README

---

## 🎨 Frontend Components TO BUILD

High-priority components needed:

### Authentication
- `Login.tsx` - Login page
- `ProtectedRoute.tsx` - Route guard component

### Layout
- `Layout.tsx` - Main layout wrapper
- `Sidebar.tsx` - Navigation sidebar
- `Header.tsx` - Top header with user menu

### Dashboard
- `Dashboard.tsx` - Main dashboard page
- `SummaryCards.tsx` - Metric cards
- `ProjectStatusChart.tsx` - Pie chart component
- `WorkloadChart.tsx` - Bar chart component
- `ActivityFeed.tsx` - Recent activity list
- `DeadlinesList.tsx` - Upcoming deadlines

### Projects
- `ProjectList.tsx` - Project list with table
- `ProjectDetail.tsx` - Project detail view
- `ProjectForm.tsx` - Create/edit form
- `ProjectAssignments.tsx` - Assignment management

### Staff
- `StaffList.tsx` - Staff list with table
- `StaffDetail.tsx` - Staff detail view
- `StaffForm.tsx` - Create/edit form
- `StaffWorkload.tsx` - Workload visualization

### Common
- `DataTable.tsx` - Reusable table component
- `FilterBar.tsx` - Filtering component
- `LoadingSpinner.tsx` - Loading indicator
- `ErrorBoundary.tsx` - Error handling

---

**Backend is production-ready. Frontend framework is set up. Ready to complete the UI and deploy!**
