import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Card,
  CardContent,
  Chip,
  Grid,
} from '@mui/material';
import { getAppointments } from '../../api/appointments';
import { useAuth } from '../../context/AuthContext';
import type { Appointment } from '../../types';

const ClientAppointmentsPage: React.FC = () => {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAppointments = async () => {
      if (!user?.client_profile?.id) return;

      try {
        const data = await getAppointments({ client: user.client_profile.id });
        setAppointments(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchAppointments();
  }, [user]);

  const getStatusColor = (status: string) => {
    if (status === 'PENDING') return 'warning';
    if (status === 'CONFIRMED') return 'info';
    if (status === 'COMPLETED') return 'success';
    if (status === 'CANCELLED') return 'error';
    return 'default';
  };

  if (loading) {
    return <Typography>Ładowanie...</Typography>;
  }

  return (
    <Box>
      <Typography variant="h4" fontWeight="bold" gutterBottom>
        Moje wizyty
      </Typography>

      <Paper sx={{ p: 3 }}>
        {appointments.length === 0 ? (
          <Typography color="text.secondary">
            Nie masz żadnych wizyt
          </Typography>
        ) : (
          appointments.map((appointment) => (
            <Card key={appointment.id} sx={{ mb: 2 }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                  <Typography variant="h6">
                    {appointment.service_name}
                  </Typography>
                  <Chip
                    label={appointment.status_display}
                    color={getStatusColor(appointment.status)}
                    size="small"
                  />
                </Box>

                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">
                      Data
                    </Typography>
                    <Typography variant="body1">
                      {new Date(appointment.start).toLocaleDateString('pl-PL')}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">
                      Godzina
                    </Typography>
                    <Typography variant="body1">
                      {new Date(appointment.start).toLocaleTimeString('pl-PL', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Typography>
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="body2" color="text.secondary">
                      Pracownik
                    </Typography>
                    <Typography variant="body1">
                      {appointment.employee_name}
                    </Typography>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          ))
        )}
      </Paper>
    </Box>
  );
};

export default ClientAppointmentsPage;