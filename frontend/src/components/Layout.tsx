import React, { useState, useEffect, useCallback } from 'react';
import { Box, IconButton, useMediaQuery, useTheme, alpha } from '@mui/material';
import { Menu as MenuIcon } from '@mui/icons-material';
import Sidebar from './Sidebar';
import { tokens } from '../theme';

interface LayoutProps {
  children: React.ReactNode;
}

const drawerWidth = 260;
const collapsedWidth = 72;

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { colors } = tokens;

  // Load collapsed state from localStorage, default to false (expanded) on desktop
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (isMobile) return true;
    const saved = localStorage.getItem('sidebarCollapsed');
    return saved !== null ? JSON.parse(saved) : false;
  });

  // Mobile drawer state (for temporary drawer)
  const [mobileOpen, setMobileOpen] = useState(false);

  // Save collapsed state to localStorage whenever it changes
  useEffect(() => {
    if (!isMobile) {
      localStorage.setItem('sidebarCollapsed', JSON.stringify(isCollapsed));
    }
  }, [isCollapsed, isMobile]);

  // Handle mobile menu toggle
  const handleMobileToggle = useCallback(() => {
    setMobileOpen((prev) => !prev);
  }, []);

  // Handle mobile drawer close
  const handleMobileClose = useCallback(() => {
    setMobileOpen(false);
  }, []);

  // Handle desktop sidebar toggle
  const handleToggleSidebar = useCallback(() => {
    setIsCollapsed((prev: boolean) => !prev);
  }, []);

  // Width calculations
  const sidebarWidth = isMobile ? drawerWidth : (isCollapsed ? collapsedWidth : drawerWidth);

  return (
    <Box
      sx={{
        display: 'flex',
        minHeight: '100vh',
        width: '100vw',
        maxWidth: '100vw',
        margin: 0,
        padding: 0,
        justifyContent: 'flex-start',
        alignItems: 'flex-start',
        position: 'relative',
        // Subtle gradient background
        background: `linear-gradient(135deg, ${colors.slate[50]} 0%, ${alpha(colors.indigo[50], 0.3)} 50%, ${colors.slate[50]} 100%)`,
      }}
    >
      {/* Decorative background elements */}
      <Box
        sx={{
          position: 'fixed',
          top: -200,
          right: -200,
          width: 600,
          height: 600,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${alpha(colors.indigo[200], 0.15)} 0%, transparent 70%)`,
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />
      <Box
        sx={{
          position: 'fixed',
          bottom: -100,
          left: -100,
          width: 400,
          height: 400,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${alpha(colors.violet[400], 0.1)} 0%, transparent 70%)`,
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      {/* Mobile Menu Button */}
      {isMobile && (
        <IconButton
          onClick={handleMobileToggle}
          sx={{
            position: 'fixed',
            top: 12,
            left: 12,
            zIndex: theme.zIndex.drawer + 1,
            bgcolor: 'background.paper',
            boxShadow: tokens.shadows.md,
            width: 44,
            height: 44,
            '&:hover': {
              bgcolor: 'background.paper',
              boxShadow: tokens.shadows.lg,
            },
          }}
        >
          <MenuIcon />
        </IconButton>
      )}

      <Box
        className="sidebar-container"
        sx={{
          flexShrink: 0,
          height: '100vh',
          position: 'relative',
          zIndex: 1,
          '@media print': {
            display: 'none !important',
          },
        }}
      >
        <Sidebar
          drawerWidth={drawerWidth}
          collapsedWidth={collapsedWidth}
          collapsed={isMobile ? false : isCollapsed}
          onToggle={isMobile ? handleMobileClose : handleToggleSidebar}
          mobileOpen={mobileOpen}
          onMobileClose={handleMobileClose}
          isMobile={isMobile}
        />
      </Box>
      <Box
        component="main"
        className="main-content"
        sx={{
          flexGrow: 1,
          flexShrink: 0,
          flexBasis: 0,
          minWidth: 0,
          overflow: 'auto',
          position: 'relative',
          zIndex: 1,
          py: { xs: 6, sm: 4, md: 5 },
          px: { xs: 2, sm: 3, md: 4, lg: 5 },
          pt: isMobile ? 9 : undefined,
          // Full width when printing
          '@media print': {
            flexBasis: '100% !important',
            width: '100% !important',
            maxWidth: 'none !important',
            py: 2,
            px: 3,
          },
        }}
      >
        {children}
      </Box>
    </Box>
  );
};

export default Layout;
