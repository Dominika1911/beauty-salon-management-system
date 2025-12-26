import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  CircularProgress,
  Paper,
  Stack,
  Typography,
  Grid,
  Box,
  Divider,
  Chip,
} from "@mui/material";
import { useAuth } from "../../context/AuthContext";
import { employeesApi } from "@/api/employees";
import { AccessTime, EventBusy } from "@mui/icons-material";

type Period = { start: string; end: string };
type WeeklyHours = Record<"mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun", Period[]>;

const DAYS: Array<{ key: keyof WeeklyHours; label: string }> = [
  { key: "mon", label: "Poniedziałek" },
  { key: "tue", label: "Wtorek" },
  { key: "wed", label: "Środa" },
  { key: "thu", label: "Czwartek" },
  { key: "fri", label: "Piątek" },
  { key: "sat", label: "Sobota" },
  { key: "sun", label: "Niedziela" },
];

function getErrorMessage(err: unknown): string {
  const e = err as any;
  return e?.response?.data?.detail || e?.response?.data?.message || e?.message || "Wystąpił błąd.";
}

function normalizeWeeklyHours(input: unknown): Partial<WeeklyHours> {
  // backend: weekly_hours to Record<string, Array<{start,end}>>
  // UI: chcemy tylko mon..sun, zawsze jako tablice
  const out: Partial<WeeklyHours> = {};
  if (!input || typeof input !== "object") return out;

  const obj = input as Record<string, any>;

  for (const day of DAYS.map((d) => d.key)) {
    const raw = obj[day];
    if (!Array.isArray(raw)) {
      out[day] = [];
      continue;
    }

    out[day] = raw
      .filter((p: any) => p && typeof p === "object")
      .map((p: any) => ({
        start: String(p.start ?? ""),
        end: String(p.end ?? ""),
      }))
      .filter((p: Period) => Boolean(p.start) && Boolean(p.end));
  }

  return out;
}

export default function EmployeeSchedulePage(): JSX.Element {
  const { user } = useAuth();
  // ✅ employee_profile.id z /api/users/me/ to EmployeeProfile.id (pk do /employees/{id}/schedule/)
  const employeeId = user?.employee_profile?.id ?? null;

  const [schedule, setSchedule] = useState<Partial<WeeklyHours>>({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let mounted = true;

    async function load() {
      setErr("");
      setLoading(true);

      if (!employeeId) {
        if (mounted) {
          setErr("Brak profilu pracownika (employee_profile).");
          setSchedule({});
          setLoading(false);
        }
        return;
      }

      try {
        const data = await employeesApi.getSchedule(employeeId);
        if (!mounted) return;
        setSchedule(normalizeWeeklyHours((data as any)?.weekly_hours));
      } catch (e) {
        if (!mounted) return;
        setErr(getErrorMessage(e) || "Nie udało się pobrać grafiku pracy.");
        setSchedule({});
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    }

    void load();
    return () => {
      mounted = false;
    };
  }, [employeeId]);

  const hasAnyHours = useMemo(() => {
    return DAYS.some((d) => (schedule[d.key] ?? []).some((p) => p?.start && p?.end));
  }, [schedule]);

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", p: 5 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Stack spacing={3} sx={{ maxWidth: 600, mx: "auto", mt: 2 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <AccessTime color="primary" />
        <Typography variant="h5" fontWeight={600}>
          Mój grafik pracy
        </Typography>
      </Box>

      <Alert severity="info" variant="outlined">
        Poniżej znajdują się Twoje standardowe godziny pracy. Jeśli potrzebujesz zmian, skontaktuj się z administratorem.
      </Alert>

      {err && <Alert severity="error">{err}</Alert>}

      {!err && !hasAnyHours && (
        <Alert severity="warning" variant="outlined">
          Nie masz ustawionych godzin pracy w grafiku.
        </Alert>
      )}

      <Paper sx={{ borderRadius: 3, overflow: "hidden", boxShadow: 2 }}>
        <Stack divider={<Divider />}>
          {DAYS.map((day) => {
            const periods = (schedule[day.key] ?? []).filter((p) => p?.start && p?.end);
            const isOff = periods.length === 0;

            return (
              <Box key={day.key} sx={{ p: 2, bgcolor: isOff ? "#fafafa" : "white" }}>
                <Grid container alignItems="center" spacing={1}>
                  <Grid item xs={12} sm={5}>
                    <Typography
                      variant="body1"
                      fontWeight={isOff ? 400 : 600}
                      color={isOff ? "text.secondary" : "text.primary"}
                    >
                      {day.label}
                    </Typography>
                  </Grid>

                  <Grid
                    item
                    xs={12}
                    sm={7}
                    sx={{
                      display: "flex",
                      justifyContent: { xs: "flex-start", sm: "flex-end" },
                      alignItems: "center",
                      gap: 1,
                      flexWrap: "wrap",
                    }}
                  >
                    {isOff ? (
                      <>
                        <EventBusy sx={{ fontSize: 18, color: "error.light" }} />
                        <Typography variant="body2" color="error.main" fontWeight={500}>
                          Wolne
                        </Typography>
                      </>
                    ) : (
                      periods.map((p, idx) => (
                        <Chip
                          key={`${day.key}-${idx}`}
                          label={`${p.start} — ${p.end}`}
                          size="small"
                          color="primary"
                          variant="outlined"
                        />
                      ))
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
