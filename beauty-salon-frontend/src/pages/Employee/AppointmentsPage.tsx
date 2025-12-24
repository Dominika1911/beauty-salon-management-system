import React, { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Typography,
  Box,
  Divider,
} from "@mui/material";

import type { Appointment, AppointmentStatus } from "../../types";
import {
  getMyAppointments,
  confirmAppointment,
  cancelAppointment,
  completeAppointment,
} from "../../api/appointments";

function statusColor(status: AppointmentStatus): "default" | "success" | "warning" | "error" {
  switch (status) {
    case "CONFIRMED": return "success";
    case "PENDING": return "warning";
    case "CANCELLED": return "error";
    case "COMPLETED": return "success";
    default: return "default";
  }
}

export default function EmployeeAppointmentsPage() {
  const [items, setItems] = useState<Appointment[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const formatPrice = (price: string | number) => {
    return new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(Number(price));
  };

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const data = await getMyAppointments();
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

  async function action(fn: (id: number) => Promise<any>, id: number, successMsg: string) {
    setErr("");
    setMsg("");
    try {
      await fn(id);
      setMsg(successMsg);
      await load();
    } catch (e: any) {
      setErr(e?.response?.data?.detail || e?.message || "Błąd akcji");
    }
  }

  if (loading && !items) return <CircularProgress />;

  const now = new Date();

  // LOGIKA FILTROWANIA:
  // 1. Nadchodzące: Status PENDING/CONFIRMED I data startu jest w przyszłości
  const upcoming = items?.filter(a =>
    (a.status === "PENDING" || a.status === "CONFIRMED") &&
    new Date(a.start) > now
  ) || [];

  // 2. Historia i Do rozliczenia: Status COMPLETED/CANCELLED LUB (PENDING/CONFIRMED i data startu minęła)
  const history = items?.filter(a =>
    a.status === "COMPLETED" ||
    a.status === "CANCELLED" ||
    ((a.status === "PENDING" || a.status === "CONFIRMED") && new Date(a.start) <= now)
  ) || [];

  return (
    <Stack spacing={3}>
      <Typography variant="h5" fontWeight={600}>Moje wizyty</Typography>

      {msg && <Alert severity="success" onClose={() => setMsg("")}>{msg}</Alert>}
      {err && <Alert severity="error" onClose={() => setErr("")}>{err}</Alert>}

      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom color="primary">Nadchodzące wizyty</Typography>
        <Stack spacing={2} sx={{ mt: 2 }}>
          {upcoming.length === 0 ? (
            <Alert severity="info">Brak zaplanowanych wizyt w przyszłości.</Alert>
          ) : (
            upcoming.map((a) => (
              <Paper key={a.id} variant="outlined" sx={{ p: 2 }}>
                <Stack spacing={2}>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                    <Box>
                      <Typography variant="subtitle1" fontWeight={700}>{a.service_name}</Typography>
                      <Typography variant="body2" color="textSecondary">
                        Klient: {a.client_name ?? "Brak danych"}
                      </Typography>
                    </Box>
                    <Stack alignItems="flex-end" spacing={1}>
                      <Chip label={a.status_display || a.status} size="small" color={statusColor(a.status)} />
                      <Typography variant="subtitle2" fontWeight={700}>
                        {a.service_price ? formatPrice(a.service_price) : "—"}
                      </Typography>
                    </Stack>
                  </Stack>

                  <Typography variant="body2">
                    Termin: {new Date(a.start).toLocaleString('pl-PL')} – {new Date(a.end).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}
                  </Typography>

                  <Stack direction="row" spacing={1}>
                    {a.status === "PENDING" && (
                      <Button variant="contained" size="small" onClick={() => action(confirmAppointment, a.id, "Potwierdzono.")}>
                        Potwierdź
                      </Button>
                    )}
                    <Button variant="text" color="error" size="small" onClick={() => action(cancelAppointment, a.id, "Anulowano.")}>
                      Anuluj
                    </Button>
                  </Stack>
                </Stack>
              </Paper>
            ))
          )}
        </Stack>
      </Paper>

      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom color="textSecondary">Historia i do rozliczenia</Typography>
        <Stack spacing={1} sx={{ mt: 2 }}>
          {history.length === 0 ? (
            <Alert severity="info">Historia jest pusta.</Alert>
          ) : (
            history.map((a) => {
              const isToComplete = a.status === "PENDING" || a.status === "CONFIRMED";

              return (
                <Paper
                  key={a.id}
                  variant="outlined"
                  sx={{
                    p: 2,
                    bgcolor: isToComplete ? "#fff9c4" : "transparent", // Żółte tło dla wizyt do rozliczenia
                    border: isToComplete ? "1px solid #fbc02d" : "1px solid #e0e0e0"
                  }}
                >
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Box>
                      <Typography variant="body2" fontWeight={600}>
                        {a.service_name} • {a.client_name ?? "—"}
                      </Typography>
                      <Typography variant="caption" color="textSecondary" display="block">
                        {new Date(a.start).toLocaleString('pl-PL')} | {a.service_price ? formatPrice(a.service_price) : ""}
                      </Typography>
                      {isToComplete && (
                        <Typography variant="caption" color="error" fontWeight={700}>
                          OCZEKUJE NA ZAKOŃCZENIE
                        </Typography>
                      )}
                    </Box>

                    <Stack direction="row" spacing={1} alignItems="center">
                      <Chip label={a.status_display || a.status} size="small" variant="outlined" color={statusColor(a.status)} />
                      {isToComplete && (
                        <Button
                          variant="contained"
                          color="success"
                          size="small"
                          onClick={() => action(completeAppointment, a.id, "Zakończono.")}
                        >
                          Zakończ
                        </Button>
                      )}
                    </Stack>
                  </Stack>
                </Paper>
              );
            })
          )}
        </Stack>
      </Paper>
    </Stack>
  );
}