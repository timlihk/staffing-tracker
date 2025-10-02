import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Projects from './pages/Projects';
import ProjectDetail from './pages/ProjectDetail';
import ProjectForm from './pages/ProjectForm';
import Staff from './pages/Staff';
import StaffDetail from './pages/StaffDetail';
import StaffForm from './pages/StaffForm';

// Create Kirkland & Ellis theme
const theme = createTheme({
  palette: {
    primary: {
      main: '#003D7A', // K&E Blue
    },
    secondary: {
      main: '#E31837', // K&E Red
    },
    success: {
      main: '#4CAF50', // Active projects
    },
    warning: {
      main: '#FF9800', // Slow-down projects
    },
    error: {
      main: '#F44336', // Suspended projects
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
  },
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <Router>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<Login />} />

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
              path="/staff/:id"
              element={
                <ProtectedRoute>
                  <Layout>
                    <StaffDetail />
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

            {/* Placeholder routes */}
            <Route
              path="/assignments"
              element={
                <ProtectedRoute>
                  <Layout>
                    <div style={{ padding: '20px' }}>
                      <h2>Assignments</h2>
                      <p>Assignment management coming soon...</p>
                    </div>
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/reports"
              element={
                <ProtectedRoute>
                  <Layout>
                    <div style={{ padding: '20px' }}>
                      <h2>Reports</h2>
                      <p>Reports coming soon...</p>
                    </div>
                  </Layout>
                </ProtectedRoute>
              }
            />

            {/* Catch all */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
