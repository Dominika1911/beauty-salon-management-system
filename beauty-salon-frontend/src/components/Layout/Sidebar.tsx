import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Divider,
  Box,
  Typography,
} from '@mui/material';
import {
  Dashboard,
  Event,
  People,
  ContentCut,
  Person,
  Assessment,
  Settings,
  CalendarMonth,
  Schedule,
} from '@mui/icons-material';
import { useAuth } from '../../context/AuthContext';

const drawerWidth = 240;

interface MenuItem {
  text: string;
  icon: React.ReactElement;
  path: string;
  roles: ('ADMIN' | 'EMPLOYEE' | 'CLIENT')[];
}

const menuItems: MenuItem[] = [
  // Admin
  {
    text: 'Dashboard',
    icon: <Dashboard />,
    path: '/admin/dashboard',
    roles: ['ADMIN'],
  },
  {
    text: 'Wizyty',
    icon: <Event />,
    path: '/admin/appointments',
    roles: ['ADMIN'],
  },
  {
    text: 'Pracownicy',
    icon: <People />,
    path: '/admin/employees',
    roles: ['ADMIN'],
  },
  {
    text: 'Klienci',
    icon: <Person />,
    path: '/admin/clients',
    roles: ['ADMIN'],
  },
  {
    text: 'Usługi',
    icon: <ContentCut />,
    path: '/admin/services',
    roles: ['ADMIN'],
  },
  {
    text: 'Raporty',
    icon: <Assessment />,
    path: '/admin/reports',
    roles: ['ADMIN'],
  },
  {
    text: 'Ustawienia',
    icon: <Settings />,
    path: '/admin/settings',
    roles: ['ADMIN'],
  },

  // Employee
  {
    text: 'Dashboard',
    icon: <Dashboard />,
    path: '/employee/dashboard',
    roles: ['EMPLOYEE'],
  },
  {
    text: 'Moje wizyty',
    icon: <Event />,
    path: '/employee/appointments',
    roles: ['EMPLOYEE'],
  },
  {
    text: 'Grafik',
    icon: <Schedule />,
    path: '/employee/schedule',
    roles: ['EMPLOYEE'],
  },

  // Client
  {
    text: 'Dashboard',
    icon: <Dashboard />,
    path: '/client/dashboard',
    roles: ['CLIENT'],
  },
  {
    text: 'Rezerwacja',
    icon: <CalendarMonth />,
    path: '/client/booking',
    roles: ['CLIENT'],
  },
  {
    text: 'Moje wizyty',
    icon: <Event />,
    path: '/client/appointments',
    roles: ['CLIENT'],
  },
];

const Sidebar: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) return null;

  // Filtruj menu items dla aktualnej roli
  const filteredItems = menuItems.filter((item) => item.roles.includes(user.role));

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
      <Toolbar>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ContentCut color="primary" />
          <Typography variant="h6" noWrap component="div">
            Beauty Salon
          </Typography>
        </Box>
      </Toolbar>
      <Divider />
      <List>
        {filteredItems.map((item) => (
          <ListItem key={item.path} disablePadding>
            <ListItemButton
              component={Link}
              to={item.path}
              selected={location.pathname === item.path}
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.text} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Drawer>
  );
};

export default Sidebar;
