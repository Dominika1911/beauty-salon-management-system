import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Stepper,
  Step,
  StepLabel,
  Button,
  Typography,
  Paper,
  Alert,
  CircularProgress,
  Divider,
} from '@mui/material';

import { servicesApi } from '@/api/services';
import { employeesApi } from '@/api/employees';
import { appointmentsApi } from '@/api/appointments';
import type { BookingCreate, Service } from '@/types';

import type { AvailabilitySlot, ServiceSort } from './types';
import { getErrorMessage, toLocalISODate } from './utils';

import { ServiceStep } from './components/ServiceStep';
import { EmployeeStep } from './components/EmployeeStep';
import { DateTimeStep } from './components/DateTimeStep';

const steps = ['Wybierz usługę', 'Wybierz specjalistę', 'Termin wizyty'];

export default function BookingPage() {
  const navigate = useNavigate();

  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [fetchingSlots, setFetchingSlots] = useState(false);
  const [booking, setBooking] = useState(false);

  const [services, setServices] = useState<Service[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);

  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<any | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());

  const [availableSlots, setAvailableSlots] = useState<AvailabilitySlot[]>([]);
  const [selectedSlotStart, setSelectedSlotStart] = useState<string | null>(null);

  const [error, setError] = useState('');
  const [serviceQuery, setServiceQuery] = useState('');
  const [serviceSort, setServiceSort] = useState<ServiceSort>('name');

  const clearError = () => setError('');

  /* ---------------- LOAD SERVICES ---------------- */
  useEffect(() => {
    (async () => {
      try {
        const res = await servicesApi.list({ is_active: true });
        setServices(res?.results ?? []);
      } catch (e) {
        setError(getErrorMessage(e));
        setServices([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

const visibleServices = useMemo(() => {
    const q = serviceQuery.toLowerCase();

      const base = (services ?? []).filter((s) => {
      const nameMatch = s.name.toLowerCase().includes(q);
      const priceMatch = s.price?.toString().includes(q);
      return nameMatch || priceMatch;
    });

    return [...base].sort((a: any, b: any) => {
      if (serviceSort === 'name') {
        return a.name.localeCompare(b.name, 'pl');
      }

      if (serviceSort === 'price') {
        return (Number(a.price) || 0) - (Number(b.price) || 0);
      }

      if (serviceSort === 'duration') {
        const timeA = a.duration || a.duration_minutes || a.time || 0;
        const timeB = b.duration || b.duration_minutes || b.time || 0;
        return timeA - timeB;
      }

      return 0;
    });
  }, [services, serviceQuery, serviceSort]);

  /* ---------------- LOAD EMPLOYEES ---------------- */
  useEffect(() => {
    if (!selectedService) return;

    (async () => {
      try {
        const res = await employeesApi.list({ service_id: selectedService.id });
        setEmployees(res?.results ?? []);
      } catch (e) {
        setError(getErrorMessage(e));
        setEmployees([]);
      }
    })();
  }, [selectedService]);

  /* ---------------- LOAD SLOTS (FIX) ---------------- */
  const loadSlots = useCallback(async () => {
    if (!selectedEmployee || !selectedService || !selectedDate) return;

    setFetchingSlots(true);
    setError('');
    setAvailableSlots([]);

    try {
      const res = await appointmentsApi.getAvailableSlots(
        selectedEmployee.id,
        selectedService.id,
        toLocalISODate(selectedDate),
      );
      setAvailableSlots(res?.slots ?? []);
    } catch (e) {
      setError(getErrorMessage(e));
      setAvailableSlots([]);
    } finally {
      setFetchingSlots(false);
    }
  }, [selectedEmployee, selectedService, selectedDate]);

  // fallback (np. zmiana daty)
  useEffect(() => {
    if (activeStep === 2) {
      loadSlots();
    }
  }, [activeStep, loadSlots]);

  /* ---------------- NAVIGATION ---------------- */
  const goNext = () => {
    clearError();
    setActiveStep((s) => {
      const next = s + 1;
      if (next === 2) {
        //  KLUCZOWA LINIA – wymuszenie fetchu slotów
        setTimeout(loadSlots, 0);
      }
      return next;
    });
  };

  const goBack = () => {
    clearError();
    setActiveStep((s) => s - 1);
  };

  /* ---------------- BOOK ---------------- */
  const handleConfirmBooking = async () => {
    if (!selectedService || !selectedEmployee || !selectedSlotStart) return;

    setBooking(true);
    setError('');

    const payload: BookingCreate = {
      service_id: selectedService.id,
      employee_id: selectedEmployee.id,
      start: selectedSlotStart,
    };

    try {
      await appointmentsApi.book(payload);
      navigate('/client/appointments?msg=reserved');
    } catch (e) {
      setError(getErrorMessage(e, 'Termin został zajęty. Wybierz inny.'));
    } finally {
      setBooking(false);
    }
  };

  const nextDisabled =
    (activeStep === 0 && !selectedService) ||
    (activeStep === 1 && !selectedEmployee) ||
    (activeStep === 2 && (!selectedSlotStart || fetchingSlots || booking));

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 950, mx: 'auto', py: 4 }}>
      <Paper sx={{ p: 4, borderRadius: 4 }}>
        <Typography variant="h4" align="center" gutterBottom>
          Rezerwacja wizyty
        </Typography>

        <Stepper activeStep={activeStep} sx={{ my: 4 }}>
          {steps.map((s) => (
            <Step key={s}>
              <StepLabel>{s}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {error && <Alert severity="error">{error}</Alert>}

        {activeStep === 0 && (
          <ServiceStep
            services={visibleServices}
            selectedServiceId={selectedService?.id ?? null}
            onPickService={setSelectedService}
            serviceQuery={serviceQuery}
            onServiceQueryChange={setServiceQuery}
            serviceSort={serviceSort}
            onServiceSortChange={setServiceSort}
            onUserInteraction={clearError}
          />
        )}

        {activeStep === 1 && (
          <EmployeeStep
            employees={employees}
            selectedEmployeeId={selectedEmployee?.id ?? null}
            onPickEmployee={setSelectedEmployee}
            onUserInteraction={clearError}
          />
        )}

        {activeStep === 2 && (
          <DateTimeStep
            selectedDate={selectedDate}
            onDateChange={(d) => {
              setSelectedDate(d);
              setSelectedSlotStart(null);
            }}
            fetchingSlots={fetchingSlots}
            availableSlots={availableSlots}
            selectedSlotStart={selectedSlotStart}
            onPickSlotStart={setSelectedSlotStart}
            onUserInteraction={clearError}
          />
        )}

        <Divider sx={{ my: 4 }} />

        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Button data-testid="booking-back" disabled={activeStep === 0} onClick={goBack}>
            Wstecz
          </Button>

          <Button
            data-testid="booking-next"
            variant="contained"
            disabled={nextDisabled}
            onClick={activeStep === 2 ? handleConfirmBooking : goNext}
          >
            {activeStep === 2 ? 'Potwierdzam rezerwację' : 'Dalej'}
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}
