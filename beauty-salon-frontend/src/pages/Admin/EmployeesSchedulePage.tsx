import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  Grid,
  InputLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  Stack,
  TextField,
  Typography,
  IconButton,
} from "@mui/material";
import type { AlertColor } from "@mui/material/Alert";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";

import type { Employee } from "@/types";
import { employeesApi, type WeeklyHours, type EmployeeListItem } from "@/api/employees";
import { parseDrfError } from "@/utils/drfErrors";

type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
type Period = { start: string; end: string };
type WeeklyDraft = Partial<Record<DayKey, Period[]>>;

type SnackState = {
  open: boolean;
  msg: string;
  severity: AlertColor;
};

const dayLabels: Record<DayKey, string> = {
  mon: "Poniedziałek",
  tue: "Wtorek",
  wed: "Środa",
  thu: "Czwartek",
  fri: "Piątek",
  sat: "Sobota",
  sun: "Niedziela",
};

/** ✅ type-guard: Admin/Employee widzi pełny EmployeeSerializer */
function isEmployee(row: EmployeeListItem): row is Employee {
  return (row as Employee).employee_number !== undefined;
}

function normalizeWeeklyHours(input: unknown): WeeklyDraft {
  if (!input || typeof input !== "object") return {};
  return input as WeeklyDraft;
}

function isValidHHMM(s: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
}

function toMinutes(hhmm: string) {
  const [h, m] = hhmm.split(":").map((n) => Number(n));
  return h * 60 + m;
}

export default function EmployeesSchedulePage(): JSX.Element {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeId, setEmployeeId] = useState<string>("");

  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [saving, setSaving] = useState(false);

  const [weekly, setWeekly] = useState<WeeklyDraft>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [snack, setSnack] = useState<SnackState>({ open: false, msg: "", severity: "success" });

  const selectedEmployee = useMemo(() => {
    const idNum = employeeId ? Number(employeeId) : null;
    if (!idNum) return null;
    return employees.find((e) => e.id === idNum) || null;
  }, [employees, employeeId]);

  const busy = loadingEmployees || loadingSchedule || saving;

  // 1) load employees (DRF paginated) - pobierz WSZYSTKIE strony
  useEffect(() => {
    (async () => {
      setLoadingEmployees(true);
      setPageError(null);
      setFormError(null);

      try {
        const all: Employee[] = [];
        let currentPage = 1;

        while (true) {
          const res = await employeesApi.list({ ordering: "last_name", page: currentPage });
          const list = (res.results ?? []).filter(isEmployee);
          all.push(...list);

          if (!res.next) break;
          currentPage += 1;
        }

        setEmployees(all);

        if (all.length > 0) setEmployeeId(String(all[0].id));
        else setEmployeeId("");
      } catch (e: unknown) {
        const parsed = parseDrfError(e);
        setPageError(parsed.message || "Nie udało się pobrać listy pracowników.");
        setEmployees([]);
        setEmployeeId("");
      } finally {
        setLoadingEmployees(false);
      }
    })();
  }, []);

  // 2) load schedule for selected employee
  useEffect(() => {
    if (!employeeId) return;

    (async () => {
      setLoadingSchedule(true);
      setPageError(null);
      setFormError(null);

      try {
        const sch = await employeesApi.getSchedule(Number(employeeId));
        setWeekly(normalizeWeeklyHours(sch.weekly_hours));
      } catch (e: unknown) {
        const parsed = parseDrfError(e);
        setWeekly({});
        setPageError(parsed.message || "Nie udało się pobrać grafiku pracownika.");
      } finally {
        setLoadingSchedule(false);
      }
    })();
  }, [employeeId]);

  const setPeriod = (day: DayKey, idx: number, field: "start" | "end", value: string) => {
    setWeekly((prev) => {
      const next: WeeklyDraft = { ...prev };
      const arr = Array.isArray(next[day]) ? [...(next[day] as Period[])] : [];
      const row: Period = { ...(arr[idx] ?? { start: "09:00", end: "17:00" }), [field]: value };
      arr[idx] = row;
      next[day] = arr;
      return next;
    });
    setFormError(null);
  };

  const addPeriod = (day: DayKey) => {
    setWeekly((prev) => {
      const next: WeeklyDraft = { ...prev };
      const arr = Array.isArray(next[day]) ? [...(next[day] as Period[])] : [];
      arr.push({ start: "09:00", end: "17:00" });
      next[day] = arr;
      return next;
    });
    setFormError(null);
  };

  const removePeriod = (day: DayKey, idx: number) => {
    setWeekly((prev) => {
      const next: WeeklyDraft = { ...prev };
      const arr = Array.isArray(next[day]) ? [...(next[day] as Period[])] : [];
      next[day] = arr.filter((_, i) => i !== idx);
      return next;
    });
    setFormError(null);
  };

  const validateAll = (): string | null => {
    for (const day of Object.keys(dayLabels) as DayKey[]) {
      const periods = weekly[day];
      if (!periods) continue;
      if (!Array.isArray(periods)) return `Nieprawidłowe godziny dla dnia: ${dayLabels[day]}.`;

      for (const p of periods) {
        if (!isValidHHMM(p.start) || !isValidHHMM(p.end)) {
          return `W ${dayLabels[day]} godziny muszą mieć format HH:MM.`;
        }
        if (toMinutes(p.start) >= toMinutes(p.end)) {
          return `W ${dayLabels[day]} godzina rozpoczęcia musi być wcześniejsza niż zakończenia.`;
        }
      }
    }
    return null;
  };

  const handleSave = async () => {
    if (!employeeId) return;

    setPageError(null);
    setFormError(null);

    const v = validateAll();
    if (v) {
      setFormError(v);
      return;
    }

    setSaving(true);
    try {
      // API oczekuje Record<string, Array<{start,end}>>
      const payload = (weekly || {}) as Record<string, Array<{ start: string; end: string }>>;
      await employeesApi.updateSchedule(Number(employeeId), payload);
      setSnack({ open: true, msg: "Grafik zapisany.", severity: "success" });
    } catch (e: unknown) {
      const parsed = parseDrfError(e);

      // POPRAWKA: Wyciąganie szczegółowego błędu z pola weekly_hours
      if (parsed.fieldErrors && parsed.fieldErrors.weekly_hours) {
        const error = parsed.fieldErrors.weekly_hours;
        // Jeśli błąd jest tablicą, bierzemy pierwszy element, w przeciwnym razie cały string
        setFormError(Array.isArray(error) ? error[0] : error);
      } else {
        setFormError(parsed.message || "Nie udało się zapisać grafiku.");
      }
    } finally {
      setSaving(false);
    }
  };

  const dayHasAnyInvalid = (day: DayKey, periods: Period[]) => {
    return periods.some(
      (p) =>
        !isValidHHMM(p.start) ||
        !isValidHHMM(p.end) ||
        (isValidHHMM(p.start) && isValidHHMM(p.end) && toMinutes(p.start) >= toMinutes(p.end))
    );
  };

  return (
    <Stack spacing={2} sx={{ width: "100%", maxWidth: 1200, mx: "auto", px: { xs: 1, sm: 2 }, py: { xs: 2, sm: 3 } }}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: { xs: "flex-start", sm: "center" },
          gap: 2,
          flexWrap: "wrap",
        }}
      >
        <Box>
          <Typography variant="h5" fontWeight={900}>
            Grafiki pracowników
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Wybierz pracownika i uzupełnij godziny pracy w tygodniu.
          </Typography>
        </Box>

        <Button variant="contained" onClick={() => void handleSave()} disabled={!employeeId || saving || loadingSchedule}>
          {saving ? "Zapisywanie..." : "Zapisz"}
        </Button>
      </Box>

      {pageError && (
        <Alert severity="error" onClose={() => setPageError(null)}>
          {pageError}
        </Alert>
      )}

      <Paper variant="outlined" sx={{ p: 2, position: "relative" }}>
        {(loadingEmployees || loadingSchedule || saving) && (
          <LinearProgress sx={{ position: "absolute", left: 0, right: 0, top: 0 }} />
        )}

        <Stack spacing={2} sx={{ pt: loadingEmployees || loadingSchedule || saving ? 1 : 0 }}>
          {loadingEmployees ? (
            <Stack direction="row" spacing={2} alignItems="center">
              <CircularProgress size={22} />
              <Typography>Ładowanie pracowników…</Typography>
            </Stack>
          ) : employees.length === 0 ? (
            <Alert severity="info">Brak pracowników do wyświetlenia.</Alert>
          ) : (
            <FormControl fullWidth size="small" disabled={busy}>
              <InputLabel>Pracownik</InputLabel>
              <Select
                value={employeeId}
                label="Pracownik"
                onChange={(e) => setEmployeeId(String(e.target.value))}
              >
                {employees.map((e) => (
                  <MenuItem key={e.id} value={String(e.id)}>
                    {e.first_name} {e.last_name} ({e.employee_number})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={1}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} justifyContent="space-between" alignItems={{ sm: "center" }}>
            <Box>
              <Typography variant="h6" fontWeight={800}>
                {selectedEmployee
                  ? `${selectedEmployee.first_name} ${selectedEmployee.last_name}`
                  : "Grafik tygodniowy"}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {selectedEmployee ? "Ustaw przedziały godzinowe dla każdego dnia." : "Wybierz pracownika, aby zobaczyć grafik."}
              </Typography>
            </Box>

            {selectedEmployee && (
              <Chip
                size="small"
                variant="outlined"
                label={loadingSchedule ? "Ładowanie grafiku…" : "Edytuj grafik"}
              />
            )}
          </Stack>

          <Divider />

          {formError && (
            <Alert severity="error" onClose={() => setFormError(null)}>
              {formError}
            </Alert>
          )}

          {!employeeId ? (
            <Alert severity="info">Wybierz pracownika, aby edytować grafik.</Alert>
          ) : loadingSchedule ? (
            <Stack direction="row" spacing={2} alignItems="center" sx={{ py: 1 }}>
              <CircularProgress size={22} />
              <Typography>Ładowanie grafiku…</Typography>
            </Stack>
          ) : (
            <Stack spacing={2}>
              {(Object.keys(dayLabels) as DayKey[]).map((day) => {
                const periods = (weekly[day] ?? []) as Period[];
                const isClosed = periods.length === 0;
                const hasInvalid = dayHasAnyInvalid(day, periods);

                return (
                  <Paper
                    key={day}
                    variant="outlined"
                    sx={{
                      p: 2,
                      borderColor: hasInvalid ? "error.light" : "divider",
                      bgcolor: hasInvalid ? "error.50" : "transparent",
                    }}
                  >
                    <Stack
                      direction={{ xs: "column", sm: "row" }}
                      justifyContent="space-between"
                      alignItems={{ sm: "center" }}
                      spacing={1}
                    >
                      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                        <Typography fontWeight={800}>{dayLabels[day]}</Typography>
                        {isClosed && <Chip size="small" label="Wolne" />}
                        {!isClosed && <Chip size="small" variant="outlined" label={`${periods.length} przedz.`} />}
                        {hasInvalid && <Chip size="small" color="error" label="Sprawdź godziny" />}
                      </Stack>

                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<AddIcon />}
                        onClick={() => addPeriod(day)}
                        disabled={busy}
                      >
                        Dodaj przedział
                      </Button>
                    </Stack>

                    {periods.length === 0 ? (
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        Brak godzin — dzień wolny.
                      </Typography>
                    ) : (
                      <Grid container spacing={1} sx={{ mt: 0.5 }}>
                        {periods.map((p, idx) => {
                          const badFormat = !isValidHHMM(p.start) || !isValidHHMM(p.end);
                          const badOrder =
                            isValidHHMM(p.start) &&
                            isValidHHMM(p.end) &&
                            toMinutes(p.start) >= toMinutes(p.end);

                          const helper = badFormat
                            ? "Format HH:MM (np. 09:00)"
                            : badOrder
                            ? "Start musi być wcześniej niż koniec"
                            : " ";

                          return (
                            <Grid item xs={12} key={`${day}-${idx}`}>
                              <Stack
                                direction={{ xs: "column", sm: "row" }}
                                spacing={1}
                                alignItems={{ sm: "center" }}
                              >
                                <TextField
                                  label="Start"
                                  type="time"
                                  value={p.start}
                                  onChange={(e) => setPeriod(day, idx, "start", e.target.value)}
                                  size="small"
                                  InputLabelProps={{ shrink: true }}
                                  inputProps={{ step: 300 }}
                                  sx={{ width: { sm: 200 } }}
                                  disabled={busy}
                                  error={badFormat || badOrder}
                                  helperText={helper}
                                />
                                <TextField
                                  label="Koniec"
                                  type="time"
                                  value={p.end}
                                  onChange={(e) => setPeriod(day, idx, "end", e.target.value)}
                                  size="small"
                                  InputLabelProps={{ shrink: true }}
                                  inputProps={{ step: 300 }}
                                  sx={{ width: { sm: 200 } }}
                                  disabled={busy}
                                  error={badFormat || badOrder}
                                  helperText={helper}
                                />

                                <Box sx={{ display: "flex", justifyContent: { xs: "flex-end", sm: "flex-start" } }}>
                                  <IconButton
                                    color="error"
                                    onClick={() => removePeriod(day, idx)}
                                    aria-label="Usuń przedział"
                                    disabled={busy}
                                  >
                                    <DeleteIcon />
                                  </IconButton>
                                </Box>
                              </Stack>
                            </Grid>
                          );
                        })}
                      </Grid>
                    )}
                  </Paper>
                );
              })}

              <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
                <Button variant="contained" onClick={() => void handleSave()} disabled={!employeeId || saving || loadingSchedule}>
                  {saving ? "Zapisywanie..." : "Zapisz grafik"}
                </Button>
              </Box>
            </Stack>
          )}
        </Stack>
      </Paper>

      <Snackbar
        open={snack.open}
        autoHideDuration={3200}
        onClose={() => setSnack((p) => ({ ...p, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={() => setSnack((p) => ({ ...p, open: false }))}
          severity={snack.severity}
          sx={{ width: "100%" }}
        >
          {snack.msg}
        </Alert>
      </Snackbar>
    </Stack>
  );
}
