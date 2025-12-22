import React from 'react';
import { Box, Grid, Paper, Typography, Card, CardContent } from '@mui/material';
import {
  Event,
  People,
  Person,
  ContentCut,
  AttachMoney,
  TrendingUp,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { getDashboard } from '../../api/dashboard';
import type { AdminDashboard } from '../../types';

const AdminDashboardPage: React.FC = () => {
  const { data, isLoading } = useQuery<AdminDashboard>({
    queryKey: ['admin-dashboard'],
    queryFn: getDashboard,
  });

  if (isLoading) {
    return <Typography>Ładowanie...</Typography>;
  }

  const stats = [
    {
      title: 'Wizyty oczekujące',
      value: data?.pending_appointments_count || 0,
      icon: <Event fontSize="large" />,
      color: '#ff9800',
    },
    {
      title: 'Aktywni pracownicy',
      value: data?.active_employees || 0,
      icon: <People fontSize="large" />,
      color: '#2196f3',
    },
    {
      title: 'Aktywni klienci',
      value: data?.active_clients || 0,
      icon: <Person fontSize="large" />,
      color: '#4caf50',
    },
    {
      title: 'Aktywne usługi',
      value: data?.active_services || 0,
      icon: <ContentCut fontSize="large" />,
      color: '#9c27b0',
    },
    {
      title: 'Przychód (miesiąc)',
      value: `${data?.monthly_revenue || '0.00'} PLN`,
      icon: <AttachMoney fontSize="large" />,
      color: '#4caf50',
    },
  ];

  return (
    <Box>
      <Typography variant="h4" gutterBottom fontWeight="bold">
        Panel Administracyjny
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        Witaj w systemie zarządzania salonem kosmetycznym
      </Typography>

      <Grid container spacing={3} sx={{ mt: 2 }}>
        {stats.map((stat, index) => (
          <Grid item xs={12} sm={6} md={4} key={index}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box
                    sx={{
                      p: 1.5,
                      borderRadius: 2,
                      bgcolor: `${stat.color}20`,
                      color: stat.color,
                    }}
                  >
                    {stat.icon}
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      {stat.title}
                    </Typography>
                    <Typography variant="h5" fontWeight="bold">
                      {stat.value}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={3} sx={{ mt: 2 }}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Dzisiejsze wizyty
            </Typography>
            {data?.today_appointments && data.today_appointments.length > 0 ? (
              data.today_appointments.map((appointment) => (
                <Box key={appointment.id} sx={{ mb: 2, pb: 2, borderBottom: '1px solid #eee' }}>
                  <Typography variant="body2">
                    {new Date(appointment.start).toLocaleTimeString('pl-PL', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}{' '}
                    - {appointment.service_name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Pracownik: {appointment.employee_name}
                  </Typography>
                </Box>
              ))
            ) : (
              <Typography variant="body2" color="text.secondary">
                Brak wizyt na dziś
              </Typography>
            )}
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Szybkie akcje
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Funkcjonalność w przygotowaniu...
            </Typography>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default AdminDashboardPage;
