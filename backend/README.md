# Staffing Tracker Backend API

Backend API for Kirkland & Ellis Staffing Tracker application with comprehensive OpenAPI/Swagger documentation.

## 📚 Documentation

- **📖 [Complete API Documentation](./API_DOCUMENTATION.md)** - Comprehensive guide with examples
- **🔧 [Interactive Swagger UI](http://localhost:3000/api-docs)** - Try the API interactively (development)
- **🌐 [Production Swagger UI](https://staffing-tracker-production.up.railway.app/api-docs)** - Production API docs

## 🛠️ Tech Stack

- **Runtime**: Node.js 18+ with TypeScript
- **Framework**: Express.js 5.x
- **Database**: PostgreSQL 16+
- **ORM**: Prisma 6.x
- **Authentication**: JWT with bcrypt
- **API Documentation**: OpenAPI 3.0 (Swagger)
- **Email Service**: Resend
- **Validation**: Zod
- **Testing**: Jest + Supertest

## 🚀 Setup

### Prerequisites

- Node.js 18+
- PostgreSQL database (or Railway PostgreSQL)
- npm or yarn

### Installation

1. **Install dependencies:**
```bash
npm install
```

2. **Set up environment variables:**
```bash
cp .env.example .env
```

Edit `.env` and configure:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/staffing_tracker"
JWT_SECRET="your-secret-key-here"
JWT_REFRESH_SECRET="your-refresh-secret-here"  # Optional, will derive from JWT_SECRET if not set
FRONTEND_URL="http://localhost:5173"
NODE_ENV="development"
RESEND_API_KEY="your-resend-api-key"  # For email notifications
EMAIL_FROM="notifications@your-domain.com"
```

3. **Generate Prisma client:**
```bash
npm run prisma:generate
```

4. **Run database migrations:**
```bash
npx prisma migrate dev
```

5. **(Optional) Seed database with Excel data:**
```bash
npx ts-node src/scripts/migrate-excel.ts
```

6. **(Optional) View database in Prisma Studio:**
```bash
npm run prisma:studio
```

### Development

Start development server with hot reload:
```bash
npm run dev
```

Server will run on `http://localhost:3000`

**API Documentation:** http://localhost:3000/api-docs

### Production Build

```bash
npm run build
npm start
```

### Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## 📡 API Overview

**Total Endpoints:** 60+ documented endpoints

### Quick Reference

| Module | Endpoints | Description |
|--------|-----------|-------------|
| **Authentication** | 7 | Login, register, refresh tokens, logout |
| **Projects** | 11 | CRUD, categories, B&C attorneys, history |
| **Staff** | 7 | CRUD, workload tracking, history |
| **Assignments** | 6 | CRUD, bulk operations |
| **Dashboard** | 4 | Summary, workload, activity logs |
| **Reports** | 4 | JSON and Excel exports |
| **Users** | 5 | User management (admin only) |
| **Billing** | 17 | Billing module with engagements |
| **Settings** | 2 | Email notification settings |

### Key Features

✅ **OpenAPI 3.0 Specification** - Full Swagger/OpenAPI documentation
✅ **Interactive API Docs** - Try endpoints directly in browser
✅ **JWT Authentication** - Secure token-based auth with refresh tokens
✅ **Role-Based Access** - Admin, Editor, and Viewer roles
✅ **Rate Limiting** - Protection against abuse
✅ **Request Validation** - Zod schema validation
✅ **Comprehensive Error Handling** - Consistent error responses
✅ **Change History Tracking** - Full audit trail
✅ **Email Notifications** - Automated project update emails

For detailed endpoint documentation, request/response examples, and authentication flows, see **[API_DOCUMENTATION.md](./API_DOCUMENTATION.md)**.

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

### Maintenance Scripts

Normalize legacy Income Partner assignments after importing historical data:
```bash
npm run db:fix-ip-role
```

This script converts any remaining `IP` project assignments to the current `Partner` label and reports if follow-up is needed.

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
