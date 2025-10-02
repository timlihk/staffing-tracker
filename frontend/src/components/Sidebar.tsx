import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Divider,
} from '@mui/material';
import {
  Dashboard,
  FolderOpen,
  People,
  Assignment,
  Assessment,
} from '@mui/icons-material';

interface SidebarProps {
  drawerWidth: number;
}

const Sidebar: React.FC<SidebarProps> = ({ drawerWidth }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    { text: 'Dashboard', icon: <Dashboard />, path: '/' },
    { text: 'Projects', icon: <FolderOpen />, path: '/projects' },
    { text: 'Staff', icon: <People />, path: '/staff' },
    { text: 'Assignments', icon: <Assignment />, path: '/assignments' },
    { text: 'Reports', icon: <Assessment />, path: '/reports' },
  ];

  const drawer = (
    <div>
      <Toolbar>
        <img
          src="https://via.placeholder.com/150x50/003D7A/FFFFFF?text=K%26E"
          alt="K&E Logo"
          style={{ width: '100%', padding: '8px' }}
        />
      </Toolbar>
      <Divider />
      <List>
        {menuItems.map((item) => (
          <ListItem key={item.text} disablePadding>
            <ListItemButton
              selected={location.pathname === item.path}
              onClick={() => navigate(item.path)}
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.text} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </div>
  );

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: drawerWidth,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: drawerWidth,
          boxSizing: 'border-box',
        },
      }}
    >
      {drawer}
    </Drawer>
  );
};

export default Sidebar;
