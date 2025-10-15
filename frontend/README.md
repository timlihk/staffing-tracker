# Staffing Tracker Frontend

Modern React-based frontend application for the Kirkland & Ellis Staffing Tracker with Material-UI design.

## 🛠️ Tech Stack

- **Framework**: React 19
- **Language**: TypeScript
- **Build Tool**: Vite 7
- **UI Library**: Material-UI (MUI) v7
- **Routing**: React Router v6
- **State Management**: TanStack Query v5 (React Query)
- **Form Management**: React Hook Form v7 + Zod v4
- **HTTP Client**: Axios
- **Charts**: Recharts
- **Notifications**: Sonner v2

## 🚀 Setup

### Prerequisites

- Node.js 18+
- Backend API running (see `../backend/README.md`)

### Installation

1. **Install dependencies:**
```bash
npm install
```

2. **Set up environment variables:**
```bash
cp .env.example .env
```

Edit `.env`:
```env
VITE_API_URL=http://localhost:3000/api
```

For production, update to your backend URL:
```env
VITE_API_URL=https://your-backend-url.com/api
```

### Development

Start development server with hot reload:
```bash
npm run dev
```

Application will run on `http://localhost:5173`

### Production Build

```bash
# Build for production
npm run build

# Preview production build locally
npm run preview
```

### Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

## 📁 Project Structure

```
frontend/
├── src/
│   ├── api/                    # API client and services
│   │   └── client.ts          # Axios instance with interceptors
│   ├── components/            # Reusable components
│   │   ├── dashboard/         # Dashboard-specific components
│   │   └── ui/                # UI components (skeletons, etc.)
│   ├── context/               # React contexts
│   │   └── AuthContext.tsx   # Authentication state
│   ├── hooks/                 # Custom React hooks
│   │   ├── useDashboard.ts   # Dashboard data & mutations
│   │   ├── useProjects.ts    # Project CRUD operations
│   │   ├── useStaff.ts       # Staff CRUD operations
│   │   └── ...               # Other domain-specific hooks
│   ├── lib/                   # Shared utilities
│   │   ├── query-client.ts   # TanStack Query configuration
│   │   ├── validations.ts    # Zod schemas
│   │   └── toast.tsx         # Toast notifications wrapper
│   ├── pages/                 # Page components
│   │   ├── Dashboard.tsx     # Main dashboard
│   │   ├── Login.tsx         # Authentication
│   │   ├── Projects.tsx      # Project list
│   │   ├── ProjectDetail.tsx # Project details
│   │   ├── ProjectForm.tsx   # Create/edit project
│   │   ├── Staff.tsx         # Staff list
│   │   ├── StaffDetail.tsx   # Staff details
│   │   ├── StaffForm.tsx     # Create/edit staff
│   │   ├── UserManagement.tsx # Admin user management
│   │   └── ...
│   ├── types/                 # TypeScript type definitions
│   ├── App.tsx                # Main app component
│   └── main.tsx               # Application entry point
├── public/                    # Static assets
├── .env.example               # Environment variables template
├── vite.config.ts             # Vite configuration
├── tsconfig.json              # TypeScript configuration
└── package.json               # Dependencies and scripts
```

## 🎨 Key Features

### Authentication & Authorization
- ✅ JWT-based authentication with refresh tokens
- ✅ Role-based access control (Admin, Editor, Viewer)
- ✅ Protected routes with automatic redirects
- ✅ 30-minute inactivity timeout
- ✅ Manual logout with cache clearing

### Dashboard
- ✅ Real-time summary statistics
- ✅ Interactive charts (project status, categories)
- ✅ Activity feed with recent changes
- ✅ Deal Radar with calendar view
- ✅ Staffing heatmap visualization
- ✅ Weekly review for project confirmation

### Project Management
- ✅ Full CRUD operations
- ✅ Advanced filtering and search
- ✅ Team member assignments with jurisdictions
- ✅ B&C attorney management
- ✅ Change history tracking
- ✅ Project confirmation workflow
- ✅ Email notifications on updates

### Staff Management
- ✅ Full CRUD operations
- ✅ Workload visualization
- ✅ Change history tracking
- ✅ Project assignments overview

### Reporting
- ✅ Comprehensive project reports
- ✅ Excel export functionality
- ✅ Multi-filter support
- ✅ Print-friendly layouts

### Modern UX
- ✅ Loading skeletons for better perceived performance
- ✅ Toast notifications for user feedback
- ✅ Error boundaries for graceful error handling
- ✅ Responsive Material-UI design
- ✅ Smart back navigation
- ✅ Row click navigation

## 🔧 Development

### Code Quality

The project uses:
- **ESLint** for code linting
- **TypeScript** for type safety
- **Vite** for fast builds and HMR
- **TanStack Query** for data caching and synchronization

### Best Practices

1. **Data Fetching**: Use custom hooks (`useProjects`, `useStaff`, etc.)
2. **Forms**: Use React Hook Form with Zod validation
3. **Styling**: Use MUI's `sx` prop for component-specific styles
4. **Navigation**: Use React Router's `useNavigate` hook
5. **State**: Prefer TanStack Query for server state
6. **Errors**: Let Error Boundary handle unexpected errors

### Adding New Features

1. **Create API service** in `src/api/`
2. **Add custom hook** in `src/hooks/`
3. **Create page component** in `src/pages/`
4. **Add route** in `src/App.tsx`
5. **Update navigation** in `src/components/Sidebar.tsx`

## 🌐 Deployment

### Railway (Current Deployment)

The frontend is deployed on Railway with automatic deployments from the `main` branch.

**Production URL**: https://staffing-tracker-frontend-production.up.railway.app

### Environment Variables (Railway)

Set in Railway dashboard:
```
VITE_API_URL=https://staffing-tracker-production.up.railway.app/api
```

### Build Command

```bash
npm run build
```

### Start Command

Railway automatically serves the built files from the `dist/` directory.

## 🔗 Related Documentation

- **Backend API**: See `../backend/README.md`
- **API Documentation**: See `../backend/API_DOCUMENTATION.md`
- **Main README**: See `../README.md`

## 📝 License

Proprietary - Kirkland & Ellis
