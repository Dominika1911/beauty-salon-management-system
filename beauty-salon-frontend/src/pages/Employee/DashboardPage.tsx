import React, { useEffect, useState } from "react";
import { Alert, CircularProgress, Grid, Paper, Stack, Typography } from "@mui/material";
import { getDashboard } from "../../api/dashboard";
import type { DashboardResponse, EmployeeDashboard } from "../../types";

export default function EmployeeDashboardPage() {
  const [data, setData] = useState<EmployeeDashboard | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    getDashboard()
      .then((d: DashboardResponse) => {
        if (d.role === "EMPLOYEE") setData(d);
        else setErr("To nie jest dashboard pracownika.");
      })
      .catch((e: any) => setErr(e?.response?.data?.detail || e?.message || "Błąd"));
  }, []);

  if (err) return <Alert severity="error">{err}</Alert>;
  if (!data) return <CircularProgress />;

  return (
    <Stack spacing={2}>
      <Typography variant="h5">{data.full_name}</Typography>

      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6">Dzisiaj wizyt</Typography>
            <Typography variant="h4">{data.today.appointments.length}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6">Zakończone w tym miesiącu</Typography>
            <Typography variant="h4">{data.this_month.completed_appointments}</Typography>
          </Paper>
        </Grid>
      </Grid>

      <Paper sx={{ p: 2 }}>
        <Typography variant="h6">Nadchodzące (7 dni)</Typography>
        <Stack spacing={1} sx={{ mt: 1 }}>
          {data.upcoming.appointments.length === 0 ? (
            <Alert severity="info">Brak nadchodzących wizyt.</Alert>
          ) : (
            data.upcoming.appointments.map((a) => (
              <Paper key={a.id} variant="outlined" sx={{ p: 1.5 }}>
                <Typography>{a.service_name} • {a.client_name ?? "—"}</Typography>
                <Typography variant="body2" sx={{ opacity: 0.8 }}>
                  {new Date(a.start).toLocaleString()} – {new Date(a.end).toLocaleString()}
                </Typography>
              </Paper>
            ))
          )}
        </Stack>
      </Paper>
    </Stack>
  );
}
