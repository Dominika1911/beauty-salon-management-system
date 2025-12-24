import React, { useEffect, useState } from "react";
import {
  Alert,
  Button,
  CircularProgress,
  Paper,
  Stack,
  Typography,
  Chip,
  Box,
} from "@mui/material";
import type { Appointment } from "../../types";
import { getAppointments, cancelAppointment } from "../../api/appointments";

// Funkcja pomocnicza do mapowania statusów na polskie nazwy i kolory
function renderStatusChip(status: string) {
  const statusMap: Record<string, { label: string; color: "warning" | "success" | "default" | "error" }> = {
    PENDING: { label: "Oczekująca", color: "warning" },
    CONFIRMED: { label: "Potwierdzona", color: "success" },
    COMPLETED: { label: "Zakończona", color: "default" },
    CANCELLED: { label: "Anulowana", color: "error" },
  };

  const current = statusMap[status] || { label: status, color: "default" };
  return <Chip size="small" label={current.label} color={current.color} />;
}

export default function ClientAppointmentsPage() {
  const [items, setItems] = useState<Appointment[] | null>(null);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  async function load() {
    setErr("");
    setMsg("");
    try {
      const res = await getAppointments();
      setItems(res);
    } catch (e: any) {
      setErr(e?.response?.data?.detail || e?.message || "Błąd podczas ładowania wizyt.");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCancel(id: number) {
    if (!window.confirm("Czy na pewno chcesz anulować tę wizytę?")) return;

    setErr("");
    setMsg("");
    try {
      await cancelAppointment(id);
      setMsg("Wizyta została pomyślnie anulowana.");
      await load();
    } catch (e: any) {
      setErr(e?.response?.data?.detail || e?.message || "Nie udało się anulować wizyty.");
    }
  }

  if (err) return <Alert severity="error" sx={{ m: 2 }}>{err}</Alert>;
  if (!items) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
      <CircularProgress />
    </Box>
  );

  const upcoming = items.filter((a) => a.status === "PENDING" || a.status === "CONFIRMED");
  const history = items.filter((a) => a.status === "COMPLETED" || a.status === "CANCELLED");

  return (
    <Stack spacing={3} sx={{ p: { xs: 1, md: 3 } }}>
      <Typography variant="h5" fontWeight="bold">Moje wizyty</Typography>

      {msg && <Alert severity="success">{msg}</Alert>}

      <Paper sx={{ p: 2, borderRadius: 2 }}>
        <Typography variant="h6" gutterBottom color="primary">Nadchodzące</Typography>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {upcoming.length === 0 ? (
            <Alert severity="info">Brak nadchodzących wizyt.</Alert>
          ) : (
            upcoming.map((a) => (
              <Paper key={a.id} variant="outlined" sx={{ p: 2, transition: '0.2s', '&:hover': { boxShadow: 1 } }}>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                  <Box>
                    <Typography variant="subtitle1" fontWeight="bold">
                      {a.service_name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Pracownik: {a.employee_name}
                    </Typography>
                  </Box>
                  {renderStatusChip(a.status)}
                </Stack>

                <Typography variant="body2" sx={{ mt: 1, fontWeight: 500 }}>
                  {new Date(a.start).toLocaleString('pl-PL', { dateStyle: 'long', timeStyle: 'short' })}
                </Typography>

                <Button
                  size="small"
                  sx={{ mt: 2 }}
                  color="error"
                  variant="outlined"
                  onClick={() => handleCancel(a.id)}
                >
                  Anuluj wizytę
                </Button>
              </Paper>
            ))
          )}
        </Stack>
      </Paper>

      <Paper sx={{ p: 2, borderRadius: 2 }}>
        <Typography variant="h6" gutterBottom color="text.secondary">Historia wizyt</Typography>
        <Stack spacing={1} sx={{ mt: 1 }}>
          {history.length === 0 ? (
            <Alert severity="info">Brak historii wizyt.</Alert>
          ) : (
            history.map((a) => (
              <Paper key={a.id} variant="outlined" sx={{ p: 1.5, opacity: 0.8, backgroundColor: '#fcfcfc' }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography variant="body1">{a.service_name} • {a.employee_name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {new Date(a.start).toLocaleString('pl-PL')}
                    </Typography>
                  </Box>
                  {renderStatusChip(a.status)}
                </Stack>
              </Paper>
            ))
          )}
        </Stack>
      </Paper>
    </Stack>
  );
}