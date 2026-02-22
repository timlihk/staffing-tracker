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
import { tokens } from '../theme';

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
  collapsedWidth = 72,
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
  const { colors, gradients } = tokens;

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
    menuItems.push({ text: 'Control Tower', icon: <DevicesOther />, path: '/billing/control-tower' });
    menuItems.push({ text: 'Admin', icon: <ManageAccounts />, path: '/users' });
  }

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const drawerContent = (
    <>
      {/* Menu Toggle Button - Only show on desktop */}
      {!isMobile && (
        <Box sx={{ p: 1.5, display: 'flex', justifyContent: collapsed ? 'center' : 'flex-end' }}>
          <IconButton
            onClick={onToggle}
            sx={{
              color: colors.slate[400],
              width: 36,
              height: 36,
              '&:hover': {
                bgcolor: alpha(colors.indigo[500], 0.08),
                color: colors.indigo[500],
              },
            }}
          >
            <Menu sx={{ fontSize: 20 }} />
          </IconButton>
        </Box>
      )}

      {/* Close button for mobile */}
      {isMobile && (
        <Box sx={{ p: 1.5, display: 'flex', justifyContent: 'flex-end' }}>
          <IconButton
            onClick={onMobileClose}
            sx={{
              color: colors.slate[400],
              '&:hover': {
                bgcolor: alpha(colors.indigo[500], 0.08),
                color: colors.indigo[500],
              },
            }}
          >
            <Menu />
          </IconButton>
        </Box>
      )}

      {/* Logo Section */}
      <Toolbar sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 1.5, px: 2 }}>
        <Box textAlign="center" sx={{ width: '100%' }}>
          {collapsed ? (
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: gradients.primary,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto',
                boxShadow: `0 8px 24px ${alpha(colors.indigo[500], 0.35)}`,
              }}
            >
              <Typography
                variant="h6"
                sx={{
                  fontWeight: 800,
                  color: '#FFFFFF',
                  fontSize: '1.125rem',
                }}
              >
                CM
              </Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, justifyContent: 'center' }}>
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: gradients.primary,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: `0 8px 24px ${alpha(colors.indigo[500], 0.35)}`,
                }}
              >
                <Typography
                  variant="h6"
                  sx={{
                    fontWeight: 800,
                    color: '#FFFFFF',
                    fontSize: '1rem',
                  }}
                >
                  CM
                </Typography>
              </Box>
              <Typography
                variant="h6"
                sx={{
                  fontWeight: 800,
                  fontSize: '1.125rem',
                  color: colors.slate[800],
                  letterSpacing: '-0.02em',
                }}
              >
                Staffing
              </Typography>
            </Box>
          )}
        </Box>
      </Toolbar>

      {/* Navigation Menu */}
      <List sx={{ px: collapsed ? 1.5 : 2, py: 2, flexGrow: 1 }}>
        {menuItems.map((item) => {
          const active = isActive(item.path);
          return (
            <ListItemButton
              key={item.text}
              onClick={() => handleNavigation(item.path)}
              sx={{
                mb: 0.75,
                borderRadius: 12,
                py: collapsed ? 1.25 : 1.25,
                minHeight: 48,
                transition: 'all 0.2s ease',
                justifyContent: collapsed ? 'center' : 'flex-start',
                position: 'relative',
                overflow: 'hidden',
                ...(active && {
                  background: gradients.primary,
                  color: '#FFFFFF',
                  boxShadow: `0 8px 24px ${alpha(colors.indigo[500], 0.35)}`,
                  '&:hover': {
                    background: gradients.primary,
                    boxShadow: `0 10px 30px ${alpha(colors.indigo[500], 0.45)}`,
                    transform: 'translateY(-1px)',
                  },
                }),
                ...(!active && {
                  color: colors.slate[500],
                  '&:hover': {
                    bgcolor: alpha(colors.slate[500], 0.06),
                    color: colors.slate[700],
                    transform: 'translateX(2px)',
                  },
                }),
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: collapsed ? 0 : 40,
                  color: active ? '#FFFFFF' : 'inherit',
                  display: 'flex',
                  justifyContent: 'center',
                  '& .MuiSvgIcon-root': { fontSize: 22 },
                }}
              >
                {item.icon}
              </ListItemIcon>
              {!collapsed && (
                <ListItemText
                  primary={item.text}
                  primaryTypographyProps={{
                    fontWeight: active ? 600 : 500,
                    fontSize: '0.9375rem',
                  }}
                />
              )}
            </ListItemButton>
          );
        })}
      </List>

      {/* User Section */}
      <Box sx={{ px: collapsed ? 1.5 : 2, pb: 3 }}>
        {!collapsed && <Divider sx={{ mb: 2, borderColor: colors.slate[200] }} />}
        
        {/* User Info Card */}
        {!collapsed && user && (
          <Box
            sx={{
              mb: 2,
              p: 2,
              borderRadius: 12,
              bgcolor: alpha(colors.slate[100], 0.5),
              border: `1px solid ${colors.slate[200]}`,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: gradients.subtle,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: `2px solid ${colors.slate[200]}`,
                }}
              >
                <AccountCircle sx={{ fontSize: 20, color: colors.indigo[500] }} />
              </Box>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography
                  variant="subtitle2"
                  sx={{
                    fontWeight: 600,
                    color: colors.slate[800],
                    fontSize: '0.875rem',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {user.staff?.name ?? user.username}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    color: colors.slate[500],
                    textTransform: 'capitalize',
                    fontWeight: 500,
                  }}
                >
                  {user.role}
                </Typography>
              </Box>
            </Box>
          </Box>
        )}

        {/* Logout Button */}
        <ListItemButton
          onClick={collapsed ? handleLogout : handleLogoutMenuOpen}
          sx={{
            borderRadius: 12,
            py: collapsed ? 1.25 : 1.25,
            minHeight: 48,
            color: colors.slate[500],
            justifyContent: collapsed ? 'center' : 'flex-start',
            transition: 'all 0.2s ease',
            '&:hover': {
              bgcolor: alpha(colors.error, 0.08),
              color: colors.error,
            },
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
            <Logout sx={{ fontSize: 20 }} />
          </ListItemIcon>
          {!collapsed && (
            <ListItemText
              primary="Log out"
              primaryTypographyProps={{
                fontWeight: 500,
                fontSize: '0.9375rem',
              }}
            />
          )}
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
          PaperProps={{
            sx: {
              borderRadius: 12,
              boxShadow: tokens.shadows.lg,
              minWidth: 200,
            },
          }}
        >
          <MenuItem onClick={handleLogout}>
            <ListItemIcon>
              <Logout fontSize="small" sx={{ color: colors.slate[500] }} />
            </ListItemIcon>
            <ListItemText primary="Log out" />
          </MenuItem>
          <MenuItem onClick={handleLogoutAll}>
            <ListItemIcon>
              <DevicesOther fontSize="small" sx={{ color: colors.slate[500] }} />
            </ListItemIcon>
            <ListItemText primary="Log out all devices" />
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
            borderRight: `1px solid ${colors.slate[200]}`,
            display: 'flex',
            flexDirection: 'column',
            overflowX: 'hidden',
            background: alpha('#FFFFFF', 0.98),
            backdropFilter: 'blur(20px)',
          },
        }}
        ModalProps={{
          keepMounted: true,
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
          transition: 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          boxSizing: 'border-box',
          borderRight: `1px solid ${colors.slate[200]}`,
          display: 'flex',
          flexDirection: 'column',
          overflowX: 'hidden',
          background: alpha('#FFFFFF', 0.95),
          backdropFilter: 'blur(20px)',
          boxShadow: `4px 0 24px ${alpha(colors.slate[900], 0.04)}`,
        },
      }}
    >
      {drawerContent}
    </Drawer>
  );
};

export default Sidebar;
