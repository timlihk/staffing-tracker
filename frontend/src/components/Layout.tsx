import React, { useState, useEffect } from 'react';
import { Box } from '@mui/material';
import Sidebar from './Sidebar';

interface LayoutProps {
  children: React.ReactNode;
}

const drawerWidth = 280;
const collapsedWidth = 80;

const Layout: React.FC<LayoutProps> = ({ children }) => {
  // Load collapsed state from localStorage, default to true
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    return saved !== null ? JSON.parse(saved) : true;
  });

  // Save collapsed state to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', JSON.stringify(isCollapsed));
  }, [isCollapsed]);

  const handleToggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
  };

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
      <Box
        sx={{
          flexShrink: 0,
          height: '100vh',
          position: 'relative',
        }}
      >
        <Sidebar
          drawerWidth={drawerWidth}
          collapsedWidth={collapsedWidth}
          collapsed={isCollapsed}
          onToggle={handleToggleSidebar}
        />
      </Box>
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          flexShrink: 0,
          flexBasis: 0,
          minWidth: 0,
          overflow: 'auto',
          py: { xs: 4, md: 6 },
        }}
      >
        {children}
      </Box>
    </Box>
  );
};

export default Layout;
