import React from 'react';
import { Box } from '@mui/material';
import Sidebar from './Sidebar';
import Header from './Header';

interface LayoutProps {
  children: React.ReactNode;
}

const drawerWidth = 280;

const Layout: React.FC<LayoutProps> = ({ children }) => {
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
      <Header drawerWidth={drawerWidth} />
      <Sidebar drawerWidth={drawerWidth} />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          flexShrink: 0,
          flexBasis: 0,
          minWidth: 0,
          mt: { xs: 7, sm: 8 },
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
