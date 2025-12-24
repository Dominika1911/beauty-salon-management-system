import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box, Stepper, Step, StepLabel, Button, Typography, Paper,
  Grid, Card, CardActionArea, CardContent, Stack, Alert, CircularProgress,
  Divider
} from "@mui/material";
import { LocalizationProvider, DatePicker } from "@mui/x-date-pickers";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { pl } from "date-fns/locale";

import { getServices } from "../../api/services";
import { getEmployees } from "../../api/employees";
import { getAvailableSlots, createAppointment } from "../../api/appointments";
import type { Service, Employee } from "../../types";

const steps = ["Wybierz usługę", "Wybierz specjalistę", "Termin wizyty"];

export default function BookingPage() {
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [fetchingSlots, setFetchingSlots] = useState(false);

  // Dane z API
  const [services, setServices] = useState<Service[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  // Wybory klienta
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [error, setError] = useState("");

  // 1. Inicjalne ładowanie danych
  useEffect(() => {
    async function init() {
      try {
        const [sData, eData] = await Promise.all([getServices(), getEmployees()]);
        setServices(sData);
        setEmployees(eData);
      } catch (e) {
        setError("Błąd połączenia z serwerem.");
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  // 2. Pobieranie realnych slotów z backendu (zapobiega nakładaniu wizyt)
  useEffect(() => {
    async function loadSlots() {
      if (activeStep === 2 && selectedEmployee && selectedService && selectedDate) {
        setFetchingSlots(true);
        const dateStr = selectedDate.toISOString().split('T')[0];
        try {
          const slots = await getAvailableSlots(selectedEmployee.id, dateStr, selectedService.id);
          setAvailableSlots(slots);
        } catch (e) {
          setError("Nie udało się pobrać wolnych terminów.");
        } finally {
          setFetchingSlots(false);
        }
      }
    }
    loadSlots();
  }, [activeStep, selectedEmployee, selectedService, selectedDate]);

  // Filtrowanie pracowników pod wybraną usługę
  const filteredEmployees = employees.filter(emp =>
    emp.skill_ids?.includes(selectedService?.id || 0) ||
    emp.skills?.some(s => s.id === selectedService?.id)
  );

  const handleNext = () => setActiveStep((prev) => prev + 1);
  const handleBack = () => setActiveStep((prev) => prev - 1);

  const handleConfirmBooking = async () => {
    if (!selectedService || !selectedEmployee || !selectedDate || !selectedSlot) return;

    // Pobieramy czystą datę YYYY-MM-DD bez przesunięcia strefy czasowej
    const year = selectedDate.getFullYear();
    const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const day = String(selectedDate.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    const payload = {
      employee_id: selectedEmployee.id, // Poprawiono klucz na _id
      service_id: selectedService.id,   // Poprawiono klucz na _id
      start: `${dateStr}T${selectedSlot}:00`,
    };

    try {
      await createAppointment(payload as any); // Używamy rzutowania lub poprawiamy typ w wywołaniu
      navigate("/client/appointments?msg=reserved");
    } catch (e: any) {
      setError(e.response?.data?.detail || "Ten termin został właśnie zajęty. Wybierz inny.");
    }
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}><CircularProgress /></Box>;

  return (
    <Box sx={{ maxWidth: 850, mx: "auto", py: 4, px: 2 }}>
      <Paper sx={{ p: 4, borderRadius: 4, boxShadow: "0 8px 32px rgba(0,0,0,0.1)" }}>
        <Typography variant="h4" fontWeight={800} textAlign="center" gutterBottom color="primary">
          Rezerwacja wizyty
        </Typography>

        <Stepper activeStep={activeStep} sx={{ mb: 6, mt: 3 }}>
          {steps.map((label) => (
            <Step key={label}><StepLabel>{label}</StepLabel></Step>
          ))}
        </Stepper>

        {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError("")}>{error}</Alert>}

        <Box sx={{ minHeight: "350px" }}>
          {/* KROK 1: USŁUGA */}
          {activeStep === 0 && (
            <Grid container spacing={2}>
              {services.map((s) => (
                <Grid item xs={12} key={s.id}>
                  <Card
                    variant="outlined"
                    sx={{
                      borderRadius: 3,
                      transition: '0.3s',
                      borderColor: selectedService?.id === s.id ? 'primary.main' : 'divider',
                      bgcolor: selectedService?.id === s.id ? 'primary.light' : 'inherit',
                      '&:hover': { boxShadow: 4, transform: 'translateY(-2px)' }
                    }}
                  >
                    <CardActionArea onClick={() => setSelectedService(s)}>
                      <CardContent sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 3 }}>
                        <Box>
                          <Typography variant="h6" fontWeight={700}>{s.name}</Typography>
                          <Typography variant="body2" color="textSecondary">
                            {s.duration_display || `${s.duration_minutes} min`}
                          </Typography>
                        </Box>
                        <Typography variant="h5" color="primary.main" fontWeight={800}>{s.price} zł</Typography>
                      </CardContent>
                    </CardActionArea>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}

          {/* KROK 2: PRACOWNIK */}
          {activeStep === 1 && (
            <Grid container spacing={2}>
              {filteredEmployees.length === 0 ? (
                <Grid item xs={12}><Alert severity="info">Przepraszamy, obecnie żaden pracownik nie wykonuje tej usługi.</Alert></Grid>
              ) : (
                filteredEmployees.map((e) => (
                  <Grid item xs={12} sm={6} key={e.id}>
                    <Card variant="outlined" sx={{
                      borderRadius: 3,
                      borderColor: selectedEmployee?.id === e.id ? 'primary.main' : 'divider'
                    }}>
                      <CardActionArea onClick={() => setSelectedEmployee(e)}>
                        <CardContent sx={{ p: 4, textAlign: 'center' }}>
                          <Box sx={{ width: 64, height: 64, bgcolor: 'secondary.main', color: 'white', borderRadius: '50%', mx: 'auto', mb: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 700 }}>
                            {e.first_name[0]}{e.last_name[0]}
                          </Box>
                          <Typography variant="h6" fontWeight={700}>{e.first_name} {e.last_name}</Typography>
                          <Typography variant="body2" color="textSecondary">Specjalista</Typography>
                        </CardContent>
                      </CardActionArea>
                    </Card>
                  </Grid>
                ))
              )}
            </Grid>
          )}

          {/* KROK 3: TERMIN */}
          {activeStep === 2 && (
            <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={pl}>
              <Stack spacing={4}>
                <DatePicker
                  label="Dzień wizyty"
                  value={selectedDate}
                  onChange={(val) => { setSelectedDate(val); setSelectedSlot(null); }}
                  disablePast
                  slotProps={{ textField: { fullWidth: true } }}
                />

                <Box>
                  <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>Dostępne godziny:</Typography>
                  {fetchingSlots ? (
                    <Box sx={{ textAlign: 'center' }}><CircularProgress size={24} /></Box>
                  ) : (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
                      {availableSlots.length > 0 ? (
                        availableSlots.map(slot => (
                          <Button
                            key={slot}
                            variant={selectedSlot === slot ? "contained" : "outlined"}
                            onClick={() => setSelectedSlot(slot)}
                            sx={{ borderRadius: 2, minWidth: '90px', py: 1 }}
                          >
                            {slot}
                          </Button>
                        ))
                      ) : (
                        <Alert severity="warning" sx={{ width: '100%' }}>Brak wolnych terminów u tego pracownika w wybranym dniu.</Alert>
                      )}
                    </Box>
                  )}
                </Box>
              </Stack>
            </LocalizationProvider>
          )}
        </Box>

        <Divider sx={{ my: 4 }} />

        <Box sx={{ display: "flex", justifyContent: "space-between" }}>
          <Button disabled={activeStep === 0} onClick={handleBack} size="large">Wstecz</Button>
          <Button
            variant="contained"
            size="large"
            disabled={
              (activeStep === 0 && !selectedService) ||
              (activeStep === 1 && !selectedEmployee) ||
              (activeStep === 2 && !selectedSlot)
            }
            onClick={activeStep === steps.length - 1 ? handleConfirmBooking : handleNext}
            sx={{ px: 4, borderRadius: 2 }}
          >
            {activeStep === steps.length - 1 ? "Potwierdzam rezerwację" : "Dalej"}
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}