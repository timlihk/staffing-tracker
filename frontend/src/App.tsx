import { ReactNode, useState, useMemo, lazy, Suspense, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import { getTheme } from './theme';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './hooks/useAuth';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import { HealthStatus } from './components/HealthStatus';
import { AUTH_ERROR_EVENT } from './api/client';
import { toast } from './lib/toast';

const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Projects = lazy(() => import('./pages/Projects'));
const ProjectDetail = lazy(() => import('./pages/ProjectDetail'));
const ProjectForm = lazy(() => import('./pages/ProjectForm'));
const Staff = lazy(() => import('./pages/Staff'));
const StaffDetail = lazy(() => import('./pages/StaffDetail'));
const StaffForm = lazy(() => import('./pages/StaffForm'));

const UserManagement = lazy(() => import('./pages/UserManagement'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const WeeklyReview = lazy(() => import('./pages/WeeklyReview'));
const BillingMatters = lazy(() => import('./pages/BillingMatters'));
const BillingMatterDetail = lazy(() => import('./pages/BillingMatterDetail'));
const BillingControlTower = lazy(() => import('./pages/BillingControlTower'));

const AdminRoute = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  if (user?.role !== 'admin') {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
};

const LoadingScreen = () => (
  <Box
    sx={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
    }}
  >
    <CircularProgress />
  </Box>
);

const SuspenseFallback = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => setVisible(true), 200);
    return () => window.clearTimeout(timeout);
  }, []);

  return visible ? <LoadingScreen /> : null;
};

// Component to handle auth errors from API interceptor
const AuthErrorHandler = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();

  useEffect(() => {
    const handleAuthError = (event: Event) => {
      const customEvent = event as CustomEvent<{ from: string }>;

      // Call logout from auth context
      logout();

      // Show toast notification
      toast.error('Session expired', 'Please log in again');

      // Navigate to login with state to remember where user was
      navigate('/login', {
        replace: true,
        state: { from: customEvent.detail?.from || location.pathname }
      });
    };

    window.addEventListener(AUTH_ERROR_EVENT, handleAuthError);
    return () => window.removeEventListener(AUTH_ERROR_EVENT, handleAuthError);
  }, [logout, navigate, location]);

  return null;
};

function App() {
  const mode: 'light' | 'dark' = 'light';
  const theme = useMemo(() => getTheme(mode), [mode]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <HealthStatus />
      <AuthProvider>
        <Router>
          <AuthErrorHandler />
          <ErrorBoundary>
            <Suspense fallback={<SuspenseFallback />}>
              <Routes>
            {/* Public routes */}
            <Route path="/login" element={<Login />} />

            {/* Public utility routes */}
            <Route path="/reset-password" element={<ResetPassword />} />

            {/* Protected routes */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Dashboard />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/projects"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Projects />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/projects/new"
              element={
                <ProtectedRoute>
                  <Layout>
                    <ProjectForm />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/projects/:id"
              element={
                <ProtectedRoute>
                  <Layout>
                    <ProjectDetail />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/projects/:id/edit"
              element={
                <ProtectedRoute>
                  <Layout>
                    <ProjectForm />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/weekly-review"
              element={
                <ProtectedRoute>
                  <Layout>
                    <WeeklyReview />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/staff"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Staff />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/staff/new"
              element={
                <ProtectedRoute>
                  <Layout>
                    <StaffForm />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/staff/:id/edit"
              element={
                <ProtectedRoute>
                  <Layout>
                    <StaffForm />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/staff/:id"
              element={
                <ProtectedRoute>
                  <Layout>
                    <StaffDetail />
                  </Layout>
                </ProtectedRoute>
              }
            />

            {/* Billing */}
            <Route
              path="/billing"
              element={
                <ProtectedRoute>
                  <Layout>
                    <BillingMatters />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/billing/:id"
              element={
                <ProtectedRoute>
                  <Layout>
                    <BillingMatterDetail />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/billing/control-tower"
              element={
                <ProtectedRoute>
                  <AdminRoute>
                    <Layout>
                      <BillingControlTower />
                    </Layout>
                  </AdminRoute>
                </ProtectedRoute>
              }
            />

            {/* Admin */}
            <Route
              path="/users"
              element={
                <ProtectedRoute>
                  <AdminRoute>
                    <Layout>
                      <UserManagement />
                    </Layout>
                  </AdminRoute>
                </ProtectedRoute>
              }
            />


            {/* Catch all */}
            <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
