import React, { useState } from 'react';
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
  Menu as MuiMenu,
  MenuItem,
  SwipeableDrawer,
} from '@mui/material';
import {
  Dashboard,
  FolderOpen,
  People,
  ManageAccounts,
  Logout,
  Menu,
  AttachMoney,
  AccountCircle,
  DevicesOther,
} from '@mui/icons-material';
import { useAuth } from '../hooks/useAuth';
import apiClient from '../api/client';
import { toast } from '../lib/toast';

interface SidebarProps {
  drawerWidth: number;
  collapsedWidth?: number;
  collapsed?: boolean;
  onToggle?: () => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
  isMobile?: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({
  drawerWidth,
  collapsedWidth = 80,
  collapsed = false,
  onToggle,
  mobileOpen = false,
  onMobileClose,
  isMobile = false,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const { user, logout } = useAuth();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const width = collapsed ? collapsedWidth : drawerWidth;

  const handleLogoutMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleLogoutMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = async () => {
    handleLogoutMenuClose();
    await logout();
    navigate('/login', { replace: true });
  };

  const handleLogoutAll = async () => {
    handleLogoutMenuClose();
    try {
      await apiClient.post('/auth/logout-all');
      await logout();
      navigate('/login', { replace: true });
    } catch (error) {
      // Fallback to regular logout on error
      toast.error('Logout from all devices failed', 'Logging out from this device only');
      await logout();
      navigate('/login', { replace: true });
    }
  };

  const handleNavigation = (path: string) => {
    navigate(path);
    if (isMobile && onMobileClose) {
      onMobileClose();
    }
  };

  const menuItems = [
    { text: 'Dashboard', icon: <Dashboard />, path: '/' },
    { text: 'Projects', icon: <FolderOpen />, path: '/projects' },
    { text: 'Staff', icon: <People />, path: '/staff' },
    { text: 'Billing', icon: <AttachMoney />, path: '/billing' },
  ];

  if (user?.role === 'admin') {
    menuItems.push({ text: 'Billing Control', icon: <DevicesOther />, path: '/billing/control-tower' });
    menuItems.push({ text: 'Admin', icon: <ManageAccounts />, path: '/users' });
  }

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const drawerContent = (
    <>
      {/* Menu Toggle Button - Only show on desktop */}
      {!isMobile && (
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
      )}

      {/* Close button for mobile */}
      {isMobile && (
        <Box sx={{ p: 1, display: 'flex', justifyContent: 'flex-end' }}>
          <IconButton
            onClick={onMobileClose}
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
      )}

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
              onClick={() => handleNavigation(item.path)}
              sx={{
                mb: 0.5,
                borderRadius: 2,
                py: collapsed ? 1 : 1.25,
                minHeight: 48, // Better touch target for mobile
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
        {!collapsed && user && (
          <ListItemButton
            disableRipple
            component="div"
            sx={{
              mb: 1.5,
              borderRadius: 2,
              py: 0.75,
              cursor: 'default',
              color: 'text.primary',
              alignItems: 'flex-start',
              '&:hover': { bgcolor: 'transparent' },
            }}
          >
            <ListItemIcon
              sx={{
                minWidth: 40,
                color: 'primary.main',
                display: 'flex',
                justifyContent: 'center',
                pt: 0.25,
              }}
            >
              <AccountCircle fontSize="small" />
            </ListItemIcon>
            <ListItemText
              primary={user.staff?.name ?? user.username}
              secondary={user.role}
              primaryTypographyProps={{
                variant: 'subtitle2',
                fontWeight: 600,
                noWrap: true,
              }}
              secondaryTypographyProps={{
                variant: 'caption',
                color: 'text.secondary',
                sx: { textTransform: 'capitalize' },
              }}
            />
          </ListItemButton>
        )}
        <ListItemButton
          onClick={collapsed ? handleLogout : handleLogoutMenuOpen}
          sx={{
            borderRadius: 2,
            py: collapsed ? 1 : 1.25,
            minHeight: 48, // Better touch target for mobile
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

        <MuiMenu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleLogoutMenuClose}
          anchorOrigin={{
            vertical: 'top',
            horizontal: 'right',
          }}
          transformOrigin={{
            vertical: 'bottom',
            horizontal: 'left',
          }}
        >
          <MenuItem onClick={handleLogout}>
            <ListItemIcon>
              <Logout fontSize="small" />
            </ListItemIcon>
            <ListItemText>Log out</ListItemText>
          </MenuItem>
          <MenuItem onClick={handleLogoutAll}>
            <ListItemIcon>
              <DevicesOther fontSize="small" />
            </ListItemIcon>
            <ListItemText>Log out from all devices</ListItemText>
          </MenuItem>
        </MuiMenu>
      </Box>
    </>
  );

  // Mobile: Use SwipeableDrawer for better UX
  if (isMobile) {
    return (
      <SwipeableDrawer
        variant="temporary"
        open={mobileOpen}
        onOpen={() => {}}
        onClose={onMobileClose || (() => {})}
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
            borderRight: `1px solid ${theme.palette.divider}`,
            display: 'flex',
            flexDirection: 'column',
            overflowX: 'hidden',
          },
        }}
        ModalProps={{
          keepMounted: true, // Better mobile performance
        }}
      >
        {drawerContent}
      </SwipeableDrawer>
    );
  }

  // Desktop: Use permanent drawer
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
      {drawerContent}
    </Drawer>
  );
};

export default Sidebar;
