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
  IconButton,
} from '@mui/material';
import { Dashboard, FolderOpen, People, BarChart, ManageAccounts, Logout, Menu, AttachMoney } from '@mui/icons-material';
import { useAuth } from '../hooks/useAuth';

interface SidebarProps {
  drawerWidth: number;
  collapsedWidth?: number;
  collapsed?: boolean;
  onToggle?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ drawerWidth, collapsedWidth = 80, collapsed = false, onToggle }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const { user, logout } = useAuth();

  const width = collapsed ? collapsedWidth : drawerWidth;

  const menuItems = [
    { text: 'Dashboard', icon: <Dashboard />, path: '/' },
    { text: 'Projects', icon: <FolderOpen />, path: '/projects' },
    { text: 'Staff', icon: <People />, path: '/staff' },
    { text: 'Project Report', icon: <BarChart />, path: '/project-report' },
    { text: 'Billing', icon: <AttachMoney />, path: '/billing' },
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
        width,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width,
          transition: 'width 0.2s ease',
          boxSizing: 'border-box',
          borderRight: `1px solid ${theme.palette.divider}`,
          display: 'flex',
          flexDirection: 'column',
          overflowX: 'hidden',
        },
      }}
    >
      {/* Menu Toggle Button */}
      <Box sx={{ p: 1, display: 'flex', justifyContent: collapsed ? 'center' : 'flex-start' }}>
        <IconButton
          onClick={onToggle}
          sx={{
            color: 'text.secondary',
            '&:hover': {
              bgcolor: alpha(theme.palette.primary.main, 0.08),
              color: 'primary.main',
            },
          }}
        >
          <Menu />
        </IconButton>
      </Box>

      <Toolbar sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 1 }}>
        <Box textAlign="center" sx={{ width: '100%' }}>
          {collapsed ? (
            <Typography
              variant="h6"
              sx={{
                fontWeight: 800,
                letterSpacing: 1.5,
                background: 'linear-gradient(135deg, #2563EB 0%, #7C3AED 100%)',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              CM
            </Typography>
          ) : (
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
          )}
        </Box>
      </Toolbar>

      <List sx={{ px: collapsed ? 1 : 2, py: 1, flexGrow: 1 }}>
        {menuItems.map((item) => {
          const active = isActive(item.path);
          return (
            <ListItemButton
              key={item.text}
              onClick={() => navigate(item.path)}
              sx={{
                mb: 0.5,
                borderRadius: 2,
                py: collapsed ? 1 : 1.25,
                transition: 'all 0.2s',
                justifyContent: collapsed ? 'center' : 'flex-start',
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
                  minWidth: collapsed ? 0 : 40,
                  color: active ? 'primary.main' : 'text.secondary',
                  display: 'flex',
                  justifyContent: 'center',
                }}
              >
                {item.icon}
              </ListItemIcon>
              {!collapsed && (
                <ListItemText
                  primary={item.text}
                  primaryTypographyProps={{
                    fontWeight: active ? 600 : 500,
                    fontSize: '0.875rem',
                  }}
                />
              )}
            </ListItemButton>
          );
        })}
      </List>

      <Box sx={{ px: collapsed ? 1 : 2, pb: 3 }}>
        {!collapsed && <Divider sx={{ mb: 2 }} />}
        {user && !collapsed && (
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
            py: collapsed ? 1 : 1.25,
            color: collapsed ? 'text.secondary' : 'text.secondary',
            '&:hover': {
              bgcolor: alpha(theme.palette.error.main, 0.08),
              color: 'error.main',
            },
            justifyContent: collapsed ? 'center' : 'flex-start',
          }}
        >
          <ListItemIcon
            sx={{
              minWidth: collapsed ? 0 : 40,
              color: 'inherit',
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            <Logout />
          </ListItemIcon>
          {!collapsed && <ListItemText primary="Log out" primaryTypographyProps={{ fontWeight: 600 }} />}
        </ListItemButton>
      </Box>
    </Drawer>
  );
};

export default Sidebar;
