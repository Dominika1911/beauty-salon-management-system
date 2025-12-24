import React, { useEffect, useState, useMemo } from "react";
import {
  Alert,
  CircularProgress,
  Grid,
  Paper,
  Stack,
  Typography,
  Box
} from "@mui/material";
import { getDashboard } from "../../api/dashboard";
import type { AdminDashboard, DashboardResponse } from "../../types";

export default function AdminDashboardPage() {
  const [data, setData] = useState<AdminDashboard | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    getDashboard()
      .then((d: DashboardResponse) => {
        if (d.role === "ADMIN") setData(d);
        else setErr("To nie jest dashboard admina.");
      })
      .catch((e: any) => setErr(e?.response?.data?.detail || e?.message || "Błąd"));
  }, []);

  // Funkcja pomocnicza do formatowania waluty
  const formatCurrency = (value: number | string) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(num || 0);
  };

  // Funkcja pomocnicza do formatowania daty
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('pl-PL', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit'
    });
  };

  if (err) return <Alert severity="error">{err}</Alert>;
  if (!data) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
      <CircularProgress />
    </Box>
  );

  return (
    <Stack spacing={3}>
      <Typography variant="h4" fontWeight={600}>Dashboard Administratora</Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2, textAlign: 'center', borderTop: '4px solid #1976d2' }}>
            <Typography color="textSecondary" variant="subtitle2">Wizyty dzisiaj</Typography>
            <Typography variant="h4" fontWeight={700}>{data.today.appointments_count}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2, textAlign: 'center', borderTop: '4px solid #ed6c02' }}>
            <Typography color="textSecondary" variant="subtitle2">Oczekujące (Pending)</Typography>
            <Typography variant="h4" fontWeight={700}>{data.pending_appointments}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2, textAlign: 'center', borderTop: '4px solid #2e7d32' }}>
            <Typography color="textSecondary" variant="subtitle2">Przychód (miesiąc)</Typography>
            <Typography variant="h4" fontWeight={700} color="primary">
              {formatCurrency(data.current_month.revenue)}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2, textAlign: 'center', borderTop: '4px solid #9c27b0' }}>
            <Typography color="textSecondary" variant="subtitle2">Aktywne usługi</Typography>
            <Typography variant="h4" fontWeight={700}>{data.system.active_services}</Typography>
          </Paper>
        </Grid>
      </Grid>

      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>Dzisiejszy harmonogram</Typography>
        <Stack spacing={2} sx={{ mt: 2 }}>
          {data.today.appointments.length === 0 ? (
            <Alert severity="info">Brak zaplanowanych wizyt na dziś.</Alert>
          ) : (
            data.today.appointments.map((a) => (
              <Paper key={a.id} variant="outlined" sx={{ p: 2, backgroundColor: '#fafafa' }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography fontWeight={600} variant="body1">
                      {a.service_name} — {a.client_name ?? "Klient nieokreślony"}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Pracownik: {a.employee_name}
                    </Typography>
                    <Typography variant="caption" sx={{ mt: 1, display: 'block', fontWeight: 500 }}>
                      {formatDate(a.start)} – {formatDate(a.end)}
                    </Typography>
                  </Box>
                  {/* Wyświetlanie ceny przy wizycie (wymaga poprawki w serializers.py) */}
                  <Typography fontWeight={700} color="primary.main">
                    {a.service_price ? formatCurrency(a.service_price) : "—"}
                  </Typography>
                </Stack>
              </Paper>
            ))
          )}
        </Stack>
      </Paper>
    </Stack>
  );
}