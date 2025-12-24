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
  Card,
  CardActionArea,
  CardContent,
  Stack,
  Alert,
  CircularProgress,
  Divider,
  TextField,
  InputAdornment,
  FormControl,
  Select,
  MenuItem,
  Pagination,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";

import { LocalizationProvider, DatePicker } from "@mui/x-date-pickers";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { pl } from "date-fns/locale";

import { getServices } from "../../api/services";
import { getEmployees } from "../../api/employees";
import { getAvailableSlots, createAppointment } from "../../api/appointments";
import type { Service, Employee, BookingCreate } from "../../types";

const steps = ["Wybierz usługę", "Wybierz specjalistę", "Termin wizyty"];

// Ujednolicona obsługa błędów (bez dodatkowych plików)
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

// YYYY-MM-DD w lokalnym czasie (bez przesunięć strefy)
function toLocalISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

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

  // UX: wyszukiwanie/sort/paginacja usług
  const [serviceQuery, setServiceQuery] = useState("");
  const [serviceSort, setServiceSort] = useState<"name" | "price" | "duration">("name");
  const [page, setPage] = useState(1);
  const pageSize = 9;

  // 1) Inicjalne ładowanie danych
  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        setLoading(true);
        const [sData, eData] = await Promise.all([getServices(), getEmployees()]);
        if (!mounted) return;

        setServices(sData);
        setEmployees(eData);
      } catch (e) {
        if (!mounted) return;
        setError(getErrorMessage(e, "Błąd połączenia z serwerem."));
      } finally {
        if (mounted) setLoading(false);
      }
    }

    init();
    return () => {
      mounted = false;
    };
  }, []);

  // 2) Widoczne usługi: filtr + sort
  const visibleServices = useMemo(() => {
    const q = serviceQuery.trim().toLowerCase();

    let list = services.filter((s) => {
      if (!q) return true;
      const name = (s.name || "").toLowerCase();
      return name.includes(q);
    });

    list = [...list].sort((a, b) => {
  if (serviceSort === "price") {
    // Number() zamienia string/Decimal na liczbę, || 0 chroni przed undefined
    const priceA = Number(a.price) || 0;
    const priceB = Number(b.price) || 0;
    return priceA - priceB;
  }
  if (serviceSort === "duration") {
    const durA = Number(a.duration_minutes) || 0;
    const durB = Number(b.duration_minutes) || 0;
    return durA - durB;
  }
  return (a.name || "").localeCompare(b.name || "", "pl");
});

    return list;
  }, [services, serviceQuery, serviceSort]);

  // Paginacja usług
  const pageCount = Math.max(1, Math.ceil(visibleServices.length / pageSize));
  const pageServices = useMemo(() => {
    const start = (page - 1) * pageSize;
    return visibleServices.slice(start, start + pageSize);
  }, [visibleServices, page]);

  useEffect(() => {
    setPage(1);
  }, [serviceQuery, serviceSort]);

  // 3) Filtrowanie pracowników pod wybraną usługę
  const filteredEmployees = useMemo(() => {
    const sid = selectedService?.id;
    if (!sid) return [];
    return employees.filter(
      (emp) => emp.skill_ids?.includes(sid) || emp.skills?.some((s) => s.id === sid)
    );
  }, [employees, selectedService]);

  // 4) Przy zmianie usługi: reset pracownika + terminu
  useEffect(() => {
    setSelectedEmployee(null);
    setSelectedSlot(null);
    setAvailableSlots([]);
  }, [selectedService?.id]);

  // 5) Przy zmianie pracownika: reset terminu
  useEffect(() => {
    setSelectedSlot(null);
    setAvailableSlots([]);
  }, [selectedEmployee?.id]);

  // 6) Pobieranie realnych slotów z backendu (krok 3)
  useEffect(() => {
    let mounted = true;

    async function loadSlots() {
      if (activeStep !== 2) return;
      if (!selectedEmployee || !selectedService || !selectedDate) return;

      setFetchingSlots(true);
      setError("");

      const dateStr = toLocalISODate(selectedDate);

      try {
        const slots = await getAvailableSlots(selectedEmployee.id, dateStr, selectedService.id);
        if (!mounted) return;
        setAvailableSlots(slots);
      } catch (e) {
        if (!mounted) return;
        setError(getErrorMessage(e, "Nie udało się pobrać wolnych terminów."));
        setAvailableSlots([]);
      } finally {
        if (mounted) setFetchingSlots(false);
      }
    }

    loadSlots();
    return () => {
      mounted = false;
    };
  }, [activeStep, selectedEmployee?.id, selectedService?.id, selectedDate]);

  const handleNext = () => {
    setError("");
    setActiveStep((prev) => prev + 1);
  };

  const handleBack = () => {
    setError("");
    setActiveStep((prev) => prev - 1);
  };

  const handleConfirmBooking = async () => {
    if (!selectedService || !selectedEmployee || !selectedDate || !selectedSlot) return;

    setError("");

    const dateStr = toLocalISODate(selectedDate);

    const payload: BookingCreate = {
      employee_id: selectedEmployee.id,
      service_id: selectedService.id,
      start: `${dateStr}T${selectedSlot}:00`,
    };

    try {
      await createAppointment(payload);
      navigate("/client/appointments?msg=reserved");
    } catch (e) {
      setError(getErrorMessage(e, "Ten termin został właśnie zajęty. Wybierz inny."));
    }
  };

  const nextDisabled =
    (activeStep === 0 && !selectedService) ||
    (activeStep === 1 && !selectedEmployee) ||
    (activeStep === 2 && (!selectedSlot || fetchingSlots));

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", p: 5 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 950, mx: "auto", py: 4, px: 2 }}>
      <Paper sx={{ p: 4, borderRadius: 4, boxShadow: "0 8px 32px rgba(0,0,0,0.1)" }}>
        <Typography variant="h4" fontWeight={800} textAlign="center" gutterBottom color="primary">
          Rezerwacja wizyty
        </Typography>

        {/* Podsumowanie wyboru (małe, ale bardzo pomaga) */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Wybrano:{" "}
            <b>{selectedService ? selectedService.name : "—"}</b>{" "}
            • Specjalista: <b>{selectedEmployee ? `${selectedEmployee.first_name} ${selectedEmployee.last_name}` : "—"}</b>{" "}
            • Termin: <b>{selectedDate ? toLocalISODate(selectedDate) : "—"}</b>{" "}
            {selectedSlot ? ` ${selectedSlot}` : ""}
          </Typography>
        </Box>

        <Stepper activeStep={activeStep} sx={{ mb: 5, mt: 2 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError("")}>
            {error}
          </Alert>
        )}

        <Box sx={{ minHeight: 360 }}>
          {/* KROK 1: USŁUGA (bez nieskończonego scrolla) */}
          {activeStep === 0 && (
            <Stack spacing={2}>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} md={7}>
                  <TextField
                    fullWidth
                    label="Szukaj usługi"
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
                </Grid>

                <Grid item xs={12} md={5}>
                  <FormControl fullWidth>
                    <Select
                      value={serviceSort}
                      onChange={(e) => setServiceSort(e.target.value as "name" | "price" | "duration")}
                    >
                      <MenuItem value="name">Sortuj: nazwa</MenuItem>
                      <MenuItem value="price">Sortuj: cena rosnąco</MenuItem>
                      <MenuItem value="duration">Sortuj: czas trwania rosnąco</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>

              {pageServices.length === 0 ? (
                <Alert severity="info">Brak usług dla podanego wyszukiwania.</Alert>
              ) : (
                <Grid container spacing={2}>
                  {pageServices.map((s) => (
                    <Grid item xs={12} sm={6} md={4} key={s.id}>
                      <Card
                        variant="outlined"
                        sx={{
                          height: "100%",
                          borderRadius: 3,
                          transition: "0.2s",
                          borderColor: selectedService?.id === s.id ? "primary.main" : "divider",
                          bgcolor: selectedService?.id === s.id ? "primary.light" : "inherit",
                          "&:hover": { boxShadow: 3, transform: "translateY(-2px)" },
                        }}
                      >
                        <CardActionArea sx={{ height: "100%" }} onClick={() => setSelectedService(s)}>
                          <CardContent sx={{ p: 3 }}>
                            <Typography variant="h6" fontWeight={800} sx={{ mb: 0.5 }}>
                              {s.name}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {s.duration_display || `${s.duration_minutes} min`}
                            </Typography>

                            <Divider sx={{ my: 1.5 }} />

                            <Typography variant="h5" color="primary.main" fontWeight={900}>
                              {s.price} zł
                            </Typography>
                          </CardContent>
                        </CardActionArea>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              )}

              {pageCount > 1 && (
                <Box sx={{ display: "flex", justifyContent: "center", pt: 1 }}>
                  <Pagination count={pageCount} page={page} onChange={(_, p) => setPage(p)} color="primary" />
                </Box>
              )}
            </Stack>
          )}

          {/* KROK 2: PRACOWNIK */}
          {activeStep === 1 && (
            <Grid container spacing={2}>
              {filteredEmployees.length === 0 ? (
                <Grid item xs={12}>
                  <Alert severity="info">Przepraszamy, obecnie żaden pracownik nie wykonuje tej usługi.</Alert>
                </Grid>
              ) : (
                filteredEmployees.map((e) => (
                  <Grid item xs={12} sm={6} md={4} key={e.id}>
                    <Card
                      variant="outlined"
                      sx={{
                        borderRadius: 3,
                        borderColor: selectedEmployee?.id === e.id ? "primary.main" : "divider",
                        height: "100%",
                      }}
                    >
                      <CardActionArea onClick={() => setSelectedEmployee(e)} sx={{ height: "100%" }}>
                        <CardContent sx={{ p: 4, textAlign: "center" }}>
                          <Box
                            sx={{
                              width: 64,
                              height: 64,
                              bgcolor: "secondary.main",
                              color: "white",
                              borderRadius: "50%",
                              mx: "auto",
                              mb: 2,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "1.5rem",
                              fontWeight: 800,
                            }}
                          >
                            {(e.first_name?.[0] || "?") + (e.last_name?.[0] || "?")}
                          </Box>

                          <Typography variant="h6" fontWeight={800}>
                            {e.first_name} {e.last_name}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Specjalista
                          </Typography>
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
                  onChange={(val) => {
                    setSelectedDate(val);
                    setSelectedSlot(null);
                    setAvailableSlots([]);
                    setError("");
                  }}
                  disablePast
                  slotProps={{ textField: { fullWidth: true } }}
                />

                <Box>
                  <Typography variant="subtitle1" fontWeight={800} sx={{ mb: 2 }}>
                    Dostępne godziny:
                  </Typography>

                  {fetchingSlots ? (
                    <Box sx={{ textAlign: "center" }}>
                      <CircularProgress size={24} />
                    </Box>
                  ) : (
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.25 }}>
                      {availableSlots.length > 0 ? (
                        availableSlots.map((slot) => (
                          <Button
                            key={slot}
                            variant={selectedSlot === slot ? "contained" : "outlined"}
                            onClick={() => setSelectedSlot(slot)}
                            sx={{ borderRadius: 2, minWidth: 96, py: 1 }}
                          >
                            {slot}
                          </Button>
                        ))
                      ) : (
                        <Alert severity="warning" sx={{ width: "100%" }}>
                          Brak wolnych terminów u tego pracownika w wybranym dniu.
                        </Alert>
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
          <Button disabled={activeStep === 0} onClick={handleBack} size="large">
            Wstecz
          </Button>

          <Button
            variant="contained"
            size="large"
            disabled={nextDisabled}
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
