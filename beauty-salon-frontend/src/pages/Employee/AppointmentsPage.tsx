import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
} from '@mui/material';
import { getAppointments } from '../../api/appointments';
import { useAuth } from '../../context/AuthContext';
import type { Appointment } from '../../types';

const EmployeeAppointmentsPage: React.FC = () => {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAppointments = async () => {
      if (!user?.employee_profile?.id) return;

      try {
        const data = await getAppointments({ employee: user.employee_profile.id });
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

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Data</TableCell>
              <TableCell>Godzina</TableCell>
              <TableCell>Klient</TableCell>
              <TableCell>Usługa</TableCell>
              <TableCell>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {appointments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  <Typography color="text.secondary" sx={{ py: 3 }}>
                    Brak wizyt
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              appointments.map((appointment) => (
                <TableRow key={appointment.id}>
                  <TableCell>
                    {new Date(appointment.start).toLocaleDateString('pl-PL')}
                  </TableCell>
                  <TableCell>
                    {new Date(appointment.start).toLocaleTimeString('pl-PL', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </TableCell>
                  <TableCell>{appointment.client_name || 'Brak danych'}</TableCell>
                  <TableCell>{appointment.service_name}</TableCell>
                  <TableCell>
                    <Chip
                      label={appointment.status_display}
                      color={getStatusColor(appointment.status)}
                      size="small"
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default EmployeeAppointmentsPage;