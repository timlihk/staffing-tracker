import React, { useState, useEffect, useCallback } from 'react';
import { Box, IconButton, useMediaQuery, useTheme } from '@mui/material';
import { Menu as MenuIcon } from '@mui/icons-material';
import Sidebar from './Sidebar';

interface LayoutProps {
  children: React.ReactNode;
}

const drawerWidth = 280;
const collapsedWidth = 80;

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // Load collapsed state from localStorage, default to true on desktop, always collapsed on mobile
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (isMobile) return true;
    const saved = localStorage.getItem('sidebarCollapsed');
    return saved !== null ? JSON.parse(saved) : true;
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
    <Box sx={{
      display: 'flex',
      minHeight: '100vh',
      bgcolor: 'background.default',
      width: '100vw',
      maxWidth: '100vw',
      margin: 0,
      padding: 0,
      justifyContent: 'flex-start',
      alignItems: 'flex-start',
    }}>
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
            boxShadow: theme.shadows[2],
            '&:hover': {
              bgcolor: 'background.paper',
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
          py: { xs: 6, sm: 4, md: 6 },
          px: { xs: 2, sm: 3, md: 4 },
          // Add padding on mobile to account for the hamburger menu
          pt: isMobile ? 8 : undefined,
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
