import React, { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Typography,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Box,
  Divider,
} from "@mui/material";

import type { Appointment, AppointmentStatus } from "../../types";
import {
  getAppointments,
  confirmAppointment,
  cancelAppointment,
  completeAppointment,
} from "../../api/appointments";

function statusColor(
  status: AppointmentStatus
): "default" | "success" | "warning" | "error" {
  switch (status) {
    case "CONFIRMED":
      return "success";
    case "PENDING":
      return "warning";
    case "CANCELLED":
      return "error";
    case "COMPLETED":
      return "success";
    default:
      return "default";
  }
}

export default function AdminAppointmentsPage() {
  const [items, setItems] = useState<Appointment[] | null>(null);
  const [statusFilter, setStatusFilter] = useState<AppointmentStatus | "ALL">(
    "ALL"
  );
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const now = new Date();

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const data = await getAppointments();
      setItems(data);
    } catch (e: any) {
      setErr(e?.response?.data?.detail || e?.message || "Błąd pobierania danych");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const formatPrice = (price: string | number) => {
    return new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(Number(price));
  };

  async function action(
    fn: (id: number) => Promise<any>,
    id: number,
    successMsg: string
  ) {
    setMsg("");
    setErr("");
    try {
      await fn(id);
      setMsg(successMsg);
      await load();
    } catch (e: any) {
      setErr(e?.response?.data?.detail || e?.message || "Błąd akcji");
    }
  }

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}><CircularProgress /></Box>;
  if (!items) return null;

  // Logika filtrowania: Status + Czas
  const allFiltered = statusFilter === "ALL"
    ? items
    : items.filter((a) => a.status === statusFilter);

  const upcoming = allFiltered.filter(a =>
    (a.status === "PENDING" || a.status === "CONFIRMED") && new Date(a.start) > now
  );

  const history = allFiltered.filter(a =>
    a.status === "COMPLETED" ||
    a.status === "CANCELLED" ||
    ((a.status === "PENDING" || a.status === "CONFIRMED") && new Date(a.start) <= now)
  );

  return (
    <Stack spacing={3}>
      <Typography variant="h5" fontWeight={600}>Zarządzanie wizytami (ADMIN)</Typography>

      {msg && <Alert severity="success" onClose={() => setMsg("")}>{msg}</Alert>}
      {err && <Alert severity="error" onClose={() => setErr("")}>{err}</Alert>}

      <Paper sx={{ p: 2 }}>
        <FormControl sx={{ minWidth: 200 }} size="small">
          <InputLabel>Filtruj wg statusu</InputLabel>
          <Select
            value={statusFilter}
            label="Filtruj wg statusu"
            onChange={(e) => setStatusFilter(e.target.value as AppointmentStatus | "ALL")}
          >
            <MenuItem value="ALL">Wszystkie statusy</MenuItem>
            <MenuItem value="PENDING">Oczekujące (Pending)</MenuItem>
            <MenuItem value="CONFIRMED">Potwierdzone (Confirmed)</MenuItem>
            <MenuItem value="COMPLETED">Zakończone (Completed)</MenuItem>
            <MenuItem value="CANCELLED">Anulowane (Cancelled)</MenuItem>
          </Select>
        </FormControl>
      </Paper>

      {/* SEKCJA: NADCHODZĄCE */}
      <Typography variant="h6" color="primary">Nadchodzące i zaplanowane</Typography>
      <Stack spacing={1}>
        {upcoming.length === 0 ? (
          <Alert severity="info">Brak nadchodzących wizyt o wybranym statusie.</Alert>
        ) : (
          upcoming.map((a) => (
            <Paper key={a.id} variant="outlined" sx={{ p: 2 }}>
              <Stack spacing={1.5}>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                  <Box>
                    <Typography fontWeight={700}>{a.service_name}</Typography>
                    <Typography variant="body2" color="textSecondary">
                      Pracownik: {a.employee_name} | Klient: {a.client_name ?? "—"}
                    </Typography>
                  </Box>
                  <Stack alignItems="flex-end" spacing={0.5}>
                    <Chip label={a.status_display || a.status} color={statusColor(a.status)} size="small" />
                    <Typography variant="subtitle2" fontWeight={700}>
                      {a.service_price ? formatPrice(a.service_price) : ""}
                    </Typography>
                  </Stack>
                </Stack>

                <Typography variant="body2" fontWeight={500}>
                  {new Date(a.start).toLocaleString('pl-PL')} – {new Date(a.end).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}
                </Typography>

                <Stack direction="row" spacing={1}>
                  {a.status === "PENDING" && (
                    <Button size="small" variant="contained" onClick={() => action(confirmAppointment, a.id, "Wizyta została potwierdzona.")}>
                      Potwierdź
                    </Button>
                  )}
                  <Button size="small" variant="outlined" color="error" onClick={() => action(cancelAppointment, a.id, "Wizyta została anulowana.")}>
                    Anuluj
                  </Button>
                </Stack>
              </Stack>
            </Paper>
          ))
        )}
      </Stack>

      <Divider />

      {/* SEKCJA: HISTORIA I W TRAKCIE */}
      <Typography variant="h6" color="textSecondary">Historia</Typography>
      <Stack spacing={1}>
        {history.length === 0 ? (
          <Alert severity="info">Brak wizyt w historii.</Alert>
        ) : (
          history.map((a) => (
            <Paper key={a.id} variant="outlined" sx={{ p: 2, bgcolor: '#fafafa', opacity: a.status === 'CANCELLED' ? 0.7 : 1 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography fontWeight={600}>{a.service_name} • {a.client_name ?? "—"}</Typography>
                  <Typography variant="caption" display="block" color="textSecondary">
                    {new Date(a.start).toLocaleString('pl-PL')} | {a.employee_name}
                  </Typography>
                </Box>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Typography variant="subtitle2" fontWeight={700}>
                    {a.service_price ? formatPrice(a.service_price) : ""}
                  </Typography>
                  <Chip label={a.status_display || a.status} color={statusColor(a.status)} size="small" variant="outlined" />

                  {/* Przycisk Zakończ tylko dla wizyt, których czas już nadszedł/minął i nie są jeszcze zakończone/anulowane */}
                  {(a.status === "PENDING" || a.status === "CONFIRMED") && (
                    <Button size="small" variant="contained" color="success" onClick={() => action(completeAppointment, a.id, "Wizyta została zakończona.")}>
                      Zakończ
                    </Button>
                  )}
                </Stack>
              </Stack>
            </Paper>
          ))
        )}
      </Stack>
    </Stack>
  );
}