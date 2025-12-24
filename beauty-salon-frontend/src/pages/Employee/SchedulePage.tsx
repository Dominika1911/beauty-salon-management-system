import React, { useEffect, useState } from "react";
import {
  Alert, CircularProgress, Paper, Stack, Typography, Grid, Box, Divider
} from "@mui/material";
import { useAuth } from "../../context/AuthContext";
import { getEmployeeSchedule } from "../../api/employees";
import { AccessTime, EventBusy } from "@mui/icons-material";

const DAYS = [
  { key: "mon", label: "Poniedziałek" },
  { key: "tue", label: "Wtorek" },
  { key: "wed", label: "Środa" },
  { key: "thu", label: "Czwartek" },
  { key: "fri", label: "Piątek" },
  { key: "sat", label: "Sobota" },
  { key: "sun", label: "Niedziela" },
];

export default function EmployeeSchedulePage() {
  const { user } = useAuth();
  const employeeId = user?.employee_profile?.id;

  const [schedule, setSchedule] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (employeeId) {
      getEmployeeSchedule(employeeId)
        .then(data => setSchedule(data.weekly_hours || {}))
        .catch(() => setErr("Nie udało się pobrać grafiku pracy."))
        .finally(() => setLoading(false));
    }
  }, [employeeId]);

  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
      <CircularProgress />
    </Box>
  );

  return (
    <Stack spacing={3} sx={{ maxWidth: 600, mx: "auto", mt: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <AccessTime color="primary" />
        <Typography variant="h5" fontWeight={600}>Mój grafik pracy</Typography>
      </Box>

      <Alert severity="info" variant="outlined">
        Poniżej znajdują się Twoje standardowe godziny pracy. Jeśli potrzebujesz zmian, skontaktuj się z administratorem.
      </Alert>

      {err && <Alert severity="error">{err}</Alert>}

      <Paper sx={{ borderRadius: 3, overflow: 'hidden', boxShadow: 2 }}>
        <Stack divider={<Divider />}>
          {DAYS.map((day) => {
            const period = schedule[day.key]?.[0];
            const isOff = !period || (!period.start && !period.end);

            return (
              <Box key={day.key} sx={{ p: 2, bgcolor: isOff ? "#fafafa" : "white" }}>
                <Grid container alignItems="center">
                  <Grid item xs={6}>
                    <Typography
                      variant="body1"
                      fontWeight={isOff ? 400 : 600}
                      color={isOff ? "text.secondary" : "text.primary"}
                    >
                      {day.label}
                    </Typography>
                  </Grid>
                  <Grid item xs={6} sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 1 }}>
                    {isOff ? (
                      <>
                        <EventBusy sx={{ fontSize: 18, color: 'error.light' }} />
                        <Typography variant="body2" color="error.main" fontWeight={500}>
                          Wolne
                        </Typography>
                      </>
                    ) : (
                      <Typography variant="body1" fontWeight={700} color="primary.main">
                        {period.start} — {period.end}
                      </Typography>
                    )}
                  </Grid>
                </Grid>
              </Box>
            );
          })}
        </Stack>
      </Paper>
    </Stack>
  );
}