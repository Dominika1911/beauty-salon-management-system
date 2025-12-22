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
  TablePagination,
  Chip,
  IconButton,
  TextField,
  MenuItem,
  Grid,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  CheckCircle,
  Cancel,
  Refresh,
  Add,
} from '@mui/icons-material';
import { getAppointments, confirmAppointment, cancelAppointment, completeAppointment } from '../../api/appointments';
import type { Appointment, AppointmentStatus } from '../../types';

const AdminAppointmentsPage: React.FC = () => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [statusFilter, setStatusFilter] = useState<AppointmentStatus | 'ALL'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    appointmentId: number | null;
    action: 'confirm' | 'cancel' | 'complete' | null;
  }>({ open: false, appointmentId: null, action: null });

  // Pobierz wizyty
  const fetchAppointments = async () => {
    try {
      setLoading(true);
      const data = await getAppointments(statusFilter !== 'ALL' ? { status: statusFilter } : {});
      setAppointments(data);
      setError('');
    } catch (err) {
      setError('Błąd podczas ładowania wizyt');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAppointments();
  }, [statusFilter]);

  // Akcje
  const handleConfirmAction = async () => {
    if (!confirmDialog.appointmentId || !confirmDialog.action) return;

    try {
      switch (confirmDialog.action) {
        case 'confirm':
          await confirmAppointment(confirmDialog.appointmentId);
          break;
        case 'cancel':
          await cancelAppointment(confirmDialog.appointmentId);
          break;
        case 'complete':
          await completeAppointment(confirmDialog.appointmentId);
          break;
      }
      setConfirmDialog({ open: false, appointmentId: null, action: null });
      fetchAppointments(); // Odśwież listę
    } catch (err) {
      console.error('Błąd akcji:', err);
      alert('Wystąpił błąd podczas wykonywania akcji');
    }
  };

  // Filtrowanie
  const filteredAppointments = Array.isArray(appointments)
    ? appointments.filter((appointment) => {
        const matchesSearch =
          appointment.client_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          appointment.employee_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          appointment.service_name.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesSearch;
      })
    : [];

  // Paginacja
  const paginatedAppointments = filteredAppointments.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleAction = (action: 'confirm' | 'cancel' | 'complete', id: number) => {
    setConfirmDialog({ open: true, appointmentId: id, action });
  };

  const getStatusColor = (status: AppointmentStatus) => {
    switch (status) {
      case 'PENDING':
        return 'warning';
      case 'CONFIRMED':
        return 'info';
      case 'COMPLETED':
        return 'success';
      case 'CANCELLED':
        return 'error';
      default:
        return 'default';
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight="bold">
          Zarządzanie wizytami
        </Typography>
        <Button variant="contained" startIcon={<Add />}>
          Nowa wizyta
        </Button>
      </Box>

      {/* Filtry */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Wyszukaj"
              placeholder="Klient, pracownik, usługa..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              select
              label="Status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as AppointmentStatus | 'ALL')}
            >
              <MenuItem value="ALL">Wszystkie</MenuItem>
              <MenuItem value="PENDING">Oczekujące</MenuItem>
              <MenuItem value="CONFIRMED">Potwierdzone</MenuItem>
              <MenuItem value="COMPLETED">Zakończone</MenuItem>
              <MenuItem value="CANCELLED">Anulowane</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={12} md={3}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<Refresh />}
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('ALL');
              }}
            >
              Wyczyść filtry
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Tabela */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>Data i godzina</TableCell>
              <TableCell>Klient</TableCell>
              <TableCell>Pracownik</TableCell>
              <TableCell>Usługa</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Akcje</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {paginatedAppointments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  <Typography color="text.secondary" sx={{ py: 3 }}>
                    Brak wizyt do wyświetlenia
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              paginatedAppointments.map((appointment) => (
                <TableRow key={appointment.id} hover>
                  <TableCell>#{appointment.id}</TableCell>
                  <TableCell>
                    {new Date(appointment.start).toLocaleString('pl-PL', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </TableCell>
                  <TableCell>{appointment.client_name || 'Brak danych'}</TableCell>
                  <TableCell>{appointment.employee_name}</TableCell>
                  <TableCell>{appointment.service_name}</TableCell>
                  <TableCell>
                    <Chip
                      label={appointment.status_display}
                      color={getStatusColor(appointment.status)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell align="right">
                    {appointment.status === 'PENDING' && (
                      <>
                        <Button
                          size="small"
                          variant="outlined"
                          color="success"
                          onClick={() => handleAction('confirm', appointment.id)}
                          sx={{ mr: 1 }}
                        >
                          Potwierdź
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          color="error"
                          onClick={() => handleAction('cancel', appointment.id)}
                        >
                          Anuluj
                        </Button>
                      </>
                    )}
                    {appointment.status === 'CONFIRMED' && (
                      <>
                        <Button
                          size="small"
                          variant="outlined"
                          color="success"
                          onClick={() => handleAction('complete', appointment.id)}
                          sx={{ mr: 1 }}
                        >
                          Zakończ
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          color="error"
                          onClick={() => handleAction('cancel', appointment.id)}
                        >
                          Anuluj
                        </Button>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <TablePagination
          component="div"
          count={filteredAppointments.length}
          page={page}
          onPageChange={handleChangePage}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          labelRowsPerPage="Wierszy na stronie:"
          labelDisplayedRows={({ from, to, count }) => `${from}-${to} z ${count}`}
        />
      </TableContainer>

      {/* Dialog potwierdzenia */}
      <Dialog open={confirmDialog.open} onClose={() => setConfirmDialog({ open: false, appointmentId: null, action: null })}>
        <DialogTitle>Potwierdź akcję</DialogTitle>
        <DialogContent>
          <Typography>
            Czy na pewno chcesz{' '}
            {confirmDialog.action === 'confirm' && 'potwierdzić'}
            {confirmDialog.action === 'cancel' && 'anulować'}
            {confirmDialog.action === 'complete' && 'oznaczyć jako zakończoną'}{' '}
            tę wizytę?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialog({ open: false, appointmentId: null, action: null })}>
            Anuluj
          </Button>
          <Button onClick={handleConfirmAction} variant="contained">
            Potwierdź
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AdminAppointmentsPage;