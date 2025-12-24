import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
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
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Chip,
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
  ExitToApp,
  History,
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
  { text: 'Dashboard', icon: <Dashboard />, path: '/admin/dashboard', roles: ['ADMIN'] },
  { text: 'Wizyty', icon: <Event />, path: '/admin/appointments', roles: ['ADMIN'] },
  { text: 'Pracownicy', icon: <People />, path: '/admin/employees', roles: ['ADMIN'] },
  { text: 'Grafiki', icon: <Schedule />, path: '/admin/employees-schedule', roles: ['ADMIN'] },
  { text: 'Klienci', icon: <Person />, path: '/admin/clients', roles: ['ADMIN'] },
  { text: 'Usługi', icon: <ContentCut />, path: '/admin/services', roles: ['ADMIN'] },
  { text: 'Raporty', icon: <Assessment />, path: '/admin/reports', roles: ['ADMIN'] },
  { text: 'Ustawienia', icon: <Settings />, path: '/admin/settings', roles: ['ADMIN'] },
    { text: 'Logi', icon: <History />, path: '/admin/logs', roles: ['ADMIN'] },


  // Employee
  { text: 'Dashboard', icon: <Dashboard />, path: '/employee/dashboard', roles: ['EMPLOYEE'] },
  { text: 'Terminarz', icon: <CalendarMonth />, path: '/employee/calendar', roles: ['EMPLOYEE'] },
  { text: 'Moje wizyty', icon: <Event />, path: '/employee/appointments', roles: ['EMPLOYEE'] },
  { text: 'Grafik', icon: <Schedule />, path: '/employee/schedule', roles: ['EMPLOYEE'] },

  // Client
  { text: 'Dashboard', icon: <Dashboard />, path: '/client/dashboard', roles: ['CLIENT'] },
  { text: 'Rezerwacja', icon: <CalendarMonth />, path: '/client/booking', roles: ['CLIENT'] },
  { text: 'Moje wizyty', icon: <Event />, path: '/client/appointments', roles: ['CLIENT'] },
];

const Sidebar: React.FC = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [confirmOpen, setConfirmOpen] = useState(false);

  if (!user) return null;

  const filteredItems = menuItems.filter((item) => item.roles.includes(user.role));

  const roleColor = () => {
    switch (user.role) {
      case 'ADMIN':
        return 'error';
      case 'EMPLOYEE':
        return 'primary';
      case 'CLIENT':
        return 'success';
      default:
        return 'default';
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      setConfirmOpen(false);
      navigate('/login', { replace: true });
    }
  };

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: drawerWidth,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: drawerWidth,
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
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

      {/* Menu */}
      <Box sx={{ flex: 1, overflowY: 'auto' }}>
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
      </Box>

      <Divider />

      {/* Dolny pasek z userem i wylogowaniem */}
      <Box sx={{ p: 2 }}>
        <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
          {user.first_name} {user.last_name}
        </Typography>
        <Chip
          label={user.role_display}
          size="small"
          color={roleColor() as any}
          sx={{ mb: 1 }}
        />

        <Button
          fullWidth
          variant="outlined"
          color="error"
          startIcon={<ExitToApp />}
          onClick={() => setConfirmOpen(true)}
        >
          Wyloguj
        </Button>
      </Box>

      {/* Potwierdzenie */}
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>Wylogować się?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Zostaniesz wylogowany z systemu. Czy na pewno chcesz kontynuować?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)}>Anuluj</Button>
          <Button color="error" variant="contained" onClick={() => void handleLogout()}>
            Wyloguj
          </Button>
        </DialogActions>
      </Dialog>
    </Drawer>
  );
};

export default Sidebar;
