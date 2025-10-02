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
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <Header drawerWidth={drawerWidth} />
      <Sidebar drawerWidth={drawerWidth} />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          ml: { sm: `${drawerWidth}px` },
          mt: { xs: 7, sm: 8 },
          p: { xs: 2, sm: 2.5, md: 3 },
          maxWidth: '100%',
          overflow: 'hidden',
        }}
      >
        <Box sx={{ width: '100%', maxWidth: '100%' }}>
          {children}
        </Box>
      </Box>
    </Box>
  );
};

export default Layout;
