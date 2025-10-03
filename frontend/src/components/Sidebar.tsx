import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Box,
  Typography,
  alpha,
  useTheme,
  Divider,
} from '@mui/material';
import { Dashboard, FolderOpen, People, BarChart, ManageAccounts, Logout } from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';

interface SidebarProps {
  drawerWidth: number;
}

const Sidebar: React.FC<SidebarProps> = ({ drawerWidth }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const { user, logout } = useAuth();

  const menuItems = [
    { text: 'Dashboard', icon: <Dashboard />, path: '/' },
    { text: 'Projects', icon: <FolderOpen />, path: '/projects' },
    { text: 'Staff', icon: <People />, path: '/staff' },
    { text: 'Project Report', icon: <BarChart />, path: '/project-report' },
  ];

  if (user?.role === 'admin') {
    menuItems.push({ text: 'Admin', icon: <ManageAccounts />, path: '/users' });
  }

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: drawerWidth,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: drawerWidth,
          boxSizing: 'border-box',
          borderRight: `1px solid ${theme.palette.divider}`,
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      <Toolbar sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 2 }}>
        <Box textAlign="center">
          <Typography
            variant="h5"
            sx={{
              fontWeight: 800,
              background: 'linear-gradient(135deg, #2563EB 0%, #7C3AED 100%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Capital Markets
          </Typography>
        </Box>
      </Toolbar>

      <List sx={{ px: 2, py: 1, flexGrow: 1 }}>
        {menuItems.map((item) => {
          const active = isActive(item.path);
          return (
            <ListItemButton
              key={item.text}
              onClick={() => navigate(item.path)}
              sx={{
                mb: 0.5,
                borderRadius: 2,
                py: 1.25,
                transition: 'all 0.2s',
                ...(active && {
                  bgcolor: alpha(theme.palette.primary.main, 0.12),
                  color: 'primary.main',
                  fontWeight: 600,
                  '&:hover': {
                    bgcolor: alpha(theme.palette.primary.main, 0.18),
                  },
                }),
                ...(!active && {
                  color: 'text.secondary',
                  '&:hover': {
                    bgcolor: alpha(theme.palette.text.primary, 0.04),
                  },
                }),
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: 40,
                  color: active ? 'primary.main' : 'text.secondary',
                }}
              >
                {item.icon}
              </ListItemIcon>
              <ListItemText
                primary={item.text}
                primaryTypographyProps={{
                  fontWeight: active ? 600 : 500,
                  fontSize: '0.875rem',
                }}
              />
            </ListItemButton>
          );
        })}
      </List>

      <Box sx={{ px: 2, pb: 3 }}>
        <Divider sx={{ mb: 2 }} />
        {user && (
          <Box sx={{ mb: 1.5 }}>
            <Typography variant="subtitle2" fontWeight={600} noWrap>
              {user.staff?.name ?? user.username}
            </Typography>
            <Typography variant="caption" color="text.secondary" textTransform="capitalize">
              {user.role}
            </Typography>
          </Box>
        )}
        <ListItemButton
          onClick={() => {
            logout();
            navigate('/login', { replace: true });
          }}
          sx={{
            borderRadius: 2,
            py: 1.25,
            color: 'text.secondary',
            '&:hover': {
              bgcolor: alpha(theme.palette.error.main, 0.08),
              color: 'error.main',
            },
          }}
        >
          <ListItemIcon sx={{ minWidth: 40, color: 'inherit' }}>
            <Logout />
          </ListItemIcon>
          <ListItemText primary="Log out" primaryTypographyProps={{ fontWeight: 600 }} />
        </ListItemButton>
      </Box>
    </Drawer>
  );
};

export default Sidebar;
