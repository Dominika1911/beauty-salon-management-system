import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  MenuItem,
  Button,
  Grid,
  Alert,
  CircularProgress,
} from '@mui/material';
import { CalendarMonth } from '@mui/icons-material';
import { getActiveServices } from '../../api/services';
import { getActiveEmployees } from '../../api/employees';
import { getAvailableSlots, bookAppointment } from '../../api/appointments';
import { useAuth } from '../../context/AuthContext';
import type { Service, Employee, AvailableSlot, BookingCreate } from '../../types';

const ClientBookingPage: React.FC = () => {
  const { user } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [availableSlots, setAvailableSlots] = useState<AvailableSlot[]>([]);

  const [selectedService, setSelectedService] = useState<number | ''>('');
  const [selectedEmployee, setSelectedEmployee] = useState<number | ''>('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedSlot, setSelectedSlot] = useState('');

  const [loading, setLoading] = useState(false);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetchServices();
    fetchEmployees();
  }, []);

  const fetchServices = async () => {
    try {
      const data = await getActiveServices();
      setServices(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchEmployees = async () => {
    try {
      const data = await getActiveEmployees();
      setEmployees(data);
    } catch (err) {
      console.error(err);
    }
  };

  const filteredEmployees = selectedService
    ? employees.filter(emp => emp.skills.some(skill => skill.id === selectedService))
    : [];

  const handleDateChange = async (date: string) => {
    const selectedDateObj = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (selectedDateObj < today) {
      setError('Nie możesz wybrać daty z przeszłości');
      return;
    }

    const oneYearFromNow = new Date();
    oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
    oneYearFromNow.setHours(0, 0, 0, 0);

    if (selectedDateObj > oneYearFromNow) {
      setError('Nie możesz rezerwować wizyt więcej niż rok w przód');
      return;
    }

    setSelectedDate(date);
    setSelectedSlot('');
    setError('');

    if (!selectedService || !selectedEmployee || !date) return;

    setSlotsLoading(true);
    try {
      const slots = await getAvailableSlots(
        Number(selectedEmployee),
        Number(selectedService),
        date
      );
      setAvailableSlots(slots);
    } catch (err) {
      console.error(err);
      setAvailableSlots([]);
    } finally {
      setSlotsLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!user?.client_profile?.id) {
      setError('Musisz być zalogowany jako klient');
      return;
    }

    if (!selectedService || !selectedEmployee || !selectedDate || !selectedSlot) {
      setError('Wszystkie pola są wymagane');
      return;
    }

    const bookingData: BookingCreate = {
      service_id: Number(selectedService),
      employee_id: Number(selectedEmployee),
      start: selectedSlot,
    };

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await bookAppointment(bookingData);
      setSuccess('Wizyta została zarezerwowana pomyślnie!');

      // Czyszczenie formularza po sukcesie
      setSelectedService('');
      setSelectedEmployee('');
      setSelectedDate('');
      setSelectedSlot('');
      setAvailableSlots([]);
    } catch (err: any) {
      console.error('Błąd rezerwacji:', err);

      const data = err.response?.data;
      let errorMessage = 'Błąd podczas rezerwacji wizyty';

      // Poprawiona logika wyciągania błędów z Django Rest Framework
      if (data) {
        if (data.non_field_errors) {
          errorMessage = Array.isArray(data.non_field_errors)
            ? data.non_field_errors[0]
            : data.non_field_errors;
        } else if (data.detail) {
          errorMessage = data.detail;
        } else if (typeof data === 'object') {
          // Łączenie błędów z poszczególnych pól (np. walidacja daty)
          errorMessage = Object.values(data).flat().join(' ');
        }
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const minDate = new Date().toISOString().split('T')[0];
  const maxDate = new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0];

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', py: 4 }}>
      <Typography variant="h4" fontWeight="bold" gutterBottom>
        Rezerwacja wizyty
      </Typography>

      {success && <Alert severity="success" sx={{ mb: 3 }}>{success}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      <Paper sx={{ p: 3 }}>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <TextField
              fullWidth
              select
              label="Wybierz usługę"
              value={selectedService}
              onChange={(e) => {
                const value = e.target.value;
                setSelectedService(value === '' ? '' : Number(value));
                setSelectedEmployee('');
                setSelectedDate('');
                setSelectedSlot('');
                setAvailableSlots([]);
              }}
              required
            >
              <MenuItem value="">Wybierz...</MenuItem>
              {services.map((service) => (
                <MenuItem key={service.id} value={service.id}>
                  {service.name} - {service.price} PLN ({service.duration_minutes} min)
                </MenuItem>
              ))}
            </TextField>
          </Grid>

          <Grid item xs={12}>
            <TextField
              fullWidth
              select
              label="Wybierz pracownika"
              value={selectedEmployee}
              onChange={(e) => {
                const value = e.target.value;
                setSelectedEmployee(value === '' ? '' : Number(value));
                setSelectedDate('');
                setSelectedSlot('');
                setAvailableSlots([]);
              }}
              disabled={!selectedService}
              required
            >
              <MenuItem value="">Wybierz...</MenuItem>
              {filteredEmployees.map((employee) => (
                <MenuItem key={employee.id} value={employee.id}>
                  {employee.first_name} {employee.last_name}
                </MenuItem>
              ))}
            </TextField>
            {selectedService && filteredEmployees.length === 0 && (
              <Typography variant="caption" color="error">
                Brak pracowników z tą umiejętnością
              </Typography>
            )}
          </Grid>

          <Grid item xs={12}>
            <TextField
              fullWidth
              type="date"
              label="Wybierz datę"
              value={selectedDate}
              onChange={(e) => handleDateChange(e.target.value)}
              disabled={!selectedEmployee}
              InputLabelProps={{ shrink: true }}
              inputProps={{ min: minDate, max: maxDate }}
              required
            />
          </Grid>

          <Grid item xs={12}>
            {slotsLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                <CircularProgress size={24} />
              </Box>
            ) : (
              <TextField
                fullWidth
                select
                label="Wybierz godzinę"
                value={selectedSlot}
                onChange={(e) => setSelectedSlot(e.target.value)}
                disabled={!selectedDate || availableSlots.length === 0}
                required
              >
                <MenuItem value="">Wybierz...</MenuItem>
                {availableSlots.map((slot, index) => (
                  <MenuItem key={index} value={slot.start}>
                    {new Date(slot.start).toLocaleTimeString('pl-PL', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </MenuItem>
                ))}
              </TextField>
            )}
            {selectedDate && availableSlots.length === 0 && !slotsLoading && (
              <Typography variant="caption" color="error">
                Brak dostępnych terminów w tym dniu
              </Typography>
            )}
          </Grid>

          <Grid item xs={12}>
            <Button
              fullWidth
              variant="contained"
              size="large"
              startIcon={<CalendarMonth />}
              onClick={handleSubmit}
              disabled={!selectedSlot || loading}
              sx={{ py: 1.5 }}
            >
              {loading ? <CircularProgress size={24} color="inherit" /> : 'Zarezerwuj wizytę'}
            </Button>
          </Grid>
        </Grid>
      </Paper>
    </Box>
  );
};

export default ClientBookingPage;