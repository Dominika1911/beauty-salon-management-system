import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Stepper,
  Step,
  StepLabel,
  Button,
  Typography,
  Paper,
  Grid,
  Stack,
  Alert,
  CircularProgress,
  Divider,
  TextField,
  InputAdornment,
  FormControl,
  Select,
  MenuItem,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";

import { LocalizationProvider, DatePicker } from "@mui/x-date-pickers";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { pl } from "date-fns/locale";

import { servicesApi } from "@/api/services";
import { employeesApi, type EmployeePublic } from "@/api/employees";
import { appointmentsApi } from "@/api/appointments";
import type { BookingCreate, Service } from "@/types";

const steps = ["Wybierz usługę", "Wybierz specjalistę", "Termin wizyty"];

type AvailabilitySlot = { start: string; end: string };

function getErrorMessage(e: unknown, fallback = "Wystąpił błąd"): string {
  const anyErr = e as any;
  const d = anyErr?.response?.data;

  if (typeof d?.detail === "string") return d.detail;
  if (d && typeof d === "object") {
    const k = Object.keys(d)[0];
    const v = d[k];
    if (Array.isArray(v) && v.length) return String(v[0]);
    if (typeof v === "string") return v;
  }
  return anyErr?.message || fallback;
}

function toLocalISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatTimeRange(start: string, end: string): string {
  const s = new Date(start).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
  const e = new Date(end).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
  return `${s} – ${e}`;
}

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

  const [error, setError] = useState("");

  const [serviceQuery, setServiceQuery] = useState("");
  const [serviceSort, setServiceSort] = useState<"name" | "price" | "duration">("name");

  // === LOAD SERVICES ===
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

  // === FILTER + SORT ===
  const visibleServices = useMemo(() => {
    const q = serviceQuery.toLowerCase();
    const list = services.filter((s) => s.name.toLowerCase().includes(q));

    return [...list].sort((a, b) => {
      if (serviceSort === "price") return Number(a.price) - Number(b.price);
      if (serviceSort === "duration") return a.duration_minutes - b.duration_minutes;
      return a.name.localeCompare(b.name, "pl");
    });
  }, [services, serviceQuery, serviceSort]);

  // === LOAD EMPLOYEES ===
  useEffect(() => {
    if (!selectedService) return;

    (async () => {
      try {
        const res = await employeesApi.list({ service_id: selectedService.id });
        setEmployees(res.results);
      } catch (e) {
        setError(getErrorMessage(e));
      }
    })();
  }, [selectedService]);

  // === LOAD SLOTS ===
  useEffect(() => {
    if (activeStep !== 2 || !selectedEmployee || !selectedService || !selectedDate) return;

    (async () => {
      setFetchingSlots(true);
      try {
        const res = await appointmentsApi.getAvailableSlots(
          selectedEmployee.id,
          selectedService.id,
          toLocalISODate(selectedDate)
        );
        setAvailableSlots(res.slots);
      } catch (e) {
        setError(getErrorMessage(e));
      } finally {
        setFetchingSlots(false);
      }
    })();
  }, [activeStep, selectedEmployee, selectedService, selectedDate]);

  const handleConfirmBooking = async () => {
    if (!selectedService || !selectedEmployee || !selectedSlotStart) return;

    setBooking(true);
    setError("");

    const payload: BookingCreate = {
      service_id: selectedService.id,
      employee_id: selectedEmployee.id,
      start: selectedSlotStart,
    };

    try {
      await appointmentsApi.book(payload);
      navigate("/client/appointments?msg=reserved");
    } catch (e) {
      setError(getErrorMessage(e, "Termin został zajęty. Wybierz inny."));
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
      <Box sx={{ display: "flex", justifyContent: "center", p: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 950, mx: "auto", py: 4 }}>
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

        {/* STEP 0 – SERVICES */}
        {activeStep === 0 && (
          <Stack spacing={3}>
            <TextField
              placeholder="Szukaj usługi"
              value={serviceQuery}
              onChange={(e) => setServiceQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
            />

            <FormControl size="small" sx={{ maxWidth: 240 }}>
              <Select value={serviceSort} onChange={(e) => setServiceSort(e.target.value as any)}>
                <MenuItem value="name">Nazwa</MenuItem>
                <MenuItem value="price">Cena</MenuItem>
                <MenuItem value="duration">Czas</MenuItem>
              </Select>
            </FormControl>

            <Grid container spacing={2}>
              {visibleServices.map((s) => (
                <Grid item xs={12} sm={6} md={4} key={s.id}>
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 2,
                      cursor: "pointer",
                      borderColor: selectedService?.id === s.id ? "primary.main" : undefined,
                    }}
                    onClick={() => setSelectedService(s)}
                  >
                    <Typography fontWeight={700}>{s.name}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {s.duration_display} • {s.price} zł
                    </Typography>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </Stack>
        )}

        {/* STEP 1 – EMPLOYEES */}
        {activeStep === 1 && (
          <Stack spacing={2}>
            {employees.length === 0 ? (
              <Alert severity="info">Brak dostępnych specjalistów.</Alert>
            ) : (
              employees.map((e) => (
                <Button
                  key={e.id}
                  variant={selectedEmployee?.id === e.id ? "contained" : "outlined"}
                  onClick={() => setSelectedEmployee(e)}
                >
                  {e.full_name}
                </Button>
              ))
            )}
          </Stack>
        )}

        {/* STEP 2 – DATE + SLOTS */}
        {activeStep === 2 && (
          <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={pl}>
            <Stack spacing={3}>
              <DatePicker
                label="Dzień wizyty"
                value={selectedDate}
                disablePast
                onChange={(d) => {
                  setSelectedDate(d);
                  setSelectedSlotStart(null);
                }}
              />

              {fetchingSlots ? (
                <CircularProgress />
              ) : (
                <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
                  {availableSlots.map((slot) => (
                    <Button
                      key={slot.start}
                      variant={selectedSlotStart === slot.start ? "contained" : "outlined"}
                      onClick={() => setSelectedSlotStart(slot.start)}
                    >
                      {formatTimeRange(slot.start, slot.end)}
                    </Button>
                  ))}
                </Box>
              )}
            </Stack>
          </LocalizationProvider>
        )}

        <Divider sx={{ my: 4 }} />

        <Box sx={{ display: "flex", justifyContent: "space-between" }}>
          <Button disabled={activeStep === 0} onClick={() => setActiveStep((s) => s - 1)}>
            Wstecz
          </Button>

          <Button
            variant="contained"
            disabled={nextDisabled}
            onClick={activeStep === 2 ? handleConfirmBooking : () => setActiveStep((s) => s + 1)}
          >
            {booking ? "Rezerwuję…" : activeStep === 2 ? "Potwierdzam rezerwację" : "Dalej"}
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}
