import React, { useState } from 'react';
import { Box } from '@mui/material';
import Sidebar from './Sidebar';

interface LayoutProps {
  children: React.ReactNode;
}

const drawerWidth = 280;
const collapsedWidth = 80;

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [isCollapsed, setIsCollapsed] = useState(true);

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
          mt: 0,
          p: 2,
          overflow: 'auto',
        }}
      >
        {children}
      </Box>
    </Box>
  );
};

export default Layout;
