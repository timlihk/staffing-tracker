# Staffing Tracker Backend API

Backend API for Kirkland & Ellis Staffing Tracker application.

## Tech Stack

- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Authentication**: JWT with bcrypt

## Setup

### Prerequisites

- Node.js 18+
- PostgreSQL database (or Railway PostgreSQL)

### Installation

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env
```

Edit `.env` and update `DATABASE_URL` with your PostgreSQL connection string.

3. Generate Prisma client:
```bash
npm run prisma:generate
```

4. Run database migrations:
```bash
npx prisma migrate dev
```

5. (Optional) Seed database with Excel data:
```bash
npx ts-node src/scripts/migrate-excel.ts
```

### Development

Start development server:
```bash
npm run dev
```

Server will run on `http://localhost:3000`

### Production Build

```bash
npm run build
npm start
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `GET /api/auth/me` - Get current user (requires auth)

### Projects
- `GET /api/projects` - List all projects (with filters)
- `GET /api/projects/:id` - Get project details
- `POST /api/projects` - Create project (admin/editor)
- `PUT /api/projects/:id` - Update project (admin/editor)
- `DELETE /api/projects/:id` - Delete project (admin)
- `GET /api/projects/categories` - Get project categories

### Staff
- `GET /api/staff` - List all staff
- `GET /api/staff/:id` - Get staff details
- `GET /api/staff/:id/workload` - Get staff workload
- `POST /api/staff` - Create staff (admin/editor)
- `PUT /api/staff/:id` - Update staff (admin/editor)
- `DELETE /api/staff/:id` - Delete staff (admin)

### Assignments
- `GET /api/assignments` - List all assignments
- `GET /api/assignments/:id` - Get assignment details
- `POST /api/assignments` - Create assignment (admin/editor)
- `POST /api/assignments/bulk` - Bulk create assignments (admin/editor)
- `PUT /api/assignments/:id` - Update assignment (admin/editor)
- `DELETE /api/assignments/:id` - Delete assignment (admin/editor)

### Dashboard
- `GET /api/dashboard/summary` - Get dashboard summary
- `GET /api/dashboard/workload-report` - Get workload report
- `GET /api/dashboard/activity-log` - Get activity log

## Deployment to Railway

### Automatic Deployment

1. Push code to GitHub repository

2. Create new project on Railway.app

3. Add PostgreSQL database:
   - Click "New" → "Database" → "PostgreSQL"
   - Railway will automatically set `DATABASE_URL`

4. Add backend service:
   - Click "New" → "GitHub Repo"
   - Select your repository
   - Set root directory to `backend`

5. Environment variables (auto-set by Railway):
   - `DATABASE_URL` - Auto-configured from PostgreSQL service
   - `PORT` - Auto-configured by Railway

6. Add custom environment variables:
   - `JWT_SECRET` - Your JWT secret key
   - `NODE_ENV` - "production"
   - `FRONTEND_URL` - Your frontend URL (after deploying frontend)

7. Deploy!

### Manual Commands

Generate Prisma client:
```bash
npx prisma generate
```

Run migrations:
```bash
npx prisma migrate deploy
```

Seed data:
```bash
npx ts-node src/scripts/migrate-excel.ts
```

## Default Credentials (After Migration)

**Username**: `admin`
**Password**: `admin123`

⚠️ **IMPORTANT**: Change the default password immediately after first login!

## Database Schema

See `prisma/schema.prisma` for full schema definition.

Main entities:
- **User** - Application users with authentication
- **Staff** - Law firm staff members
- **Project** - Client projects/deals
- **ProjectAssignment** - Staff assignments to projects
- **ProjectStatusHistory** - Audit trail of status changes
- **ActivityLog** - System activity logging

## License

Proprietary - Kirkland & Ellis
