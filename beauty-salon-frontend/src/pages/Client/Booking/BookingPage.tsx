import React, { useEffect, useMemo, useState } from 'react';
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

import { servicesApi } from '@/api/services.ts';
import { employeesApi, type EmployeePublic } from '@/api/employees.ts';
import { appointmentsApi } from '@/api/appointments.ts';
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
    const [employees, setEmployees] = useState<EmployeePublic[]>([]);

    const [selectedService, setSelectedService] = useState<Service | null>(null);
    const [selectedEmployee, setSelectedEmployee] = useState<EmployeePublic | null>(null);
    const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());

    const [availableSlots, setAvailableSlots] = useState<AvailabilitySlot[]>([]);
    const [selectedSlotStart, setSelectedSlotStart] = useState<string | null>(null);

    const [error, setError] = useState('');

    const [serviceQuery, setServiceQuery] = useState('');
    const [serviceSort, setServiceSort] = useState<ServiceSort>('name');

    const clearError = () => setError('');

    useEffect(() => {
        (async () => {
            try {
                const res = await servicesApi.list({ is_active: true });
                setServices(res.results);
            } catch (e) {
                setError(getErrorMessage(e));
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const visibleServices = useMemo(() => {
        const q = serviceQuery.toLowerCase();
        const list = services.filter((s) => s.name.toLowerCase().includes(q));

        return [...list].sort((a, b) => {
            if (serviceSort === 'price') return Number(a.price) - Number(b.price);
            if (serviceSort === 'duration') return a.duration_minutes - b.duration_minutes;
            return a.name.localeCompare(b.name, 'pl');
        });
    }, [services, serviceQuery, serviceSort]);

    const pickService = (s: Service) => {
        setError('');
        setSelectedService(s);
        setSelectedEmployee(null);
        setEmployees([]);
        setSelectedSlotStart(null);
        setAvailableSlots([]);
        setSelectedDate(new Date());
    };

    const pickEmployee = (e: EmployeePublic) => {
        setError('');
        setSelectedEmployee(e);
        setSelectedSlotStart(null);
        setAvailableSlots([]);
    };

    useEffect(() => {
        if (!selectedService) return;

        (async () => {
            try {
                setError('');
                const res = await employeesApi.list({ service_id: selectedService.id });
                setEmployees(res.results);
            } catch (e) {
                setError(getErrorMessage(e));
                setEmployees([]);
            }
        })();
    }, [selectedService]);

    useEffect(() => {
        if (activeStep !== 2 || !selectedEmployee || !selectedService || !selectedDate) return;

        (async () => {
            setFetchingSlots(true);
            setError('');
            setAvailableSlots([]);

            try {
                const res = await appointmentsApi.getAvailableSlots(
                    selectedEmployee.id,
                    selectedService.id,
                    toLocalISODate(selectedDate),
                );
                setAvailableSlots(res.slots);
            } catch (e) {
                setError(getErrorMessage(e));
                setAvailableSlots([]);
            } finally {
                setFetchingSlots(false);
            }
        })();
    }, [activeStep, selectedEmployee, selectedService, selectedDate]);

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

    const goNext = () => {
        setError('');
        setActiveStep((s) => s + 1);
    };

    const goBack = () => {
        setError('');
        setActiveStep((s) => s - 1);
    };

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
                <Typography variant="h4" fontWeight={800} align="center" gutterBottom>
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
                        serviceQuery={serviceQuery}
                        onServiceQueryChange={setServiceQuery}
                        serviceSort={serviceSort}
                        onServiceSortChange={setServiceSort}
                        services={visibleServices}
                        selectedServiceId={selectedService?.id ?? null}
                        onPickService={pickService}
                        onUserInteraction={clearError}
                    />
                )}

                {activeStep === 1 && (
                    <EmployeeStep
                        employees={employees}
                        selectedEmployeeId={selectedEmployee?.id ?? null}
                        onPickEmployee={pickEmployee}
                        onUserInteraction={clearError}
                    />
                )}

                {activeStep === 2 && (
                    <DateTimeStep
                        selectedDate={selectedDate}
                        onDateChange={(d) => {
                            setError('');
                            setSelectedDate(d);
                            setSelectedSlotStart(null);
                            setAvailableSlots([]);
                        }}
                        fetchingSlots={fetchingSlots}
                        availableSlots={availableSlots}
                        selectedSlotStart={selectedSlotStart}
                        onPickSlotStart={(start) => {
                            setError('');
                            setSelectedSlotStart(start);
                        }}
                        onUserInteraction={clearError}
                    />
                )}

                <Divider sx={{ my: 4 }} />

                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Button disabled={activeStep === 0} onClick={goBack}>
                        Wstecz
                    </Button>

                    <Button
                        variant="contained"
                        disabled={nextDisabled}
                        onClick={activeStep === 2 ? handleConfirmBooking : goNext}
                    >
                        {booking
                            ? 'Rezerwuję…'
                            : activeStep === 2
                              ? 'Potwierdzam rezerwację'
                              : 'Dalej'}
                    </Button>
                </Box>
            </Paper>
        </Box>
    );
}
