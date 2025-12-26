import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
  IconButton,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";

import type { Employee } from "@/types";
import { employeesApi, type WeeklyHours, type EmployeeListItem } from "@/api/employees";

type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

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

function normalizeWeeklyHours(input: unknown): Partial<WeeklyHours> {
  if (!input || typeof input !== "object") return {};
  return input as Partial<WeeklyHours>;
}

function isValidHHMM(s: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
}

function getErrorMessage(err: unknown): string {
  const e = err as any;
  return e?.response?.data?.detail || e?.response?.data?.message || e?.message || "Wystąpił błąd.";
}

export default function EmployeesSchedulePage(): JSX.Element {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeId, setEmployeeId] = useState<string>("");

  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [saving, setSaving] = useState(false);

  const [weekly, setWeekly] = useState<Partial<WeeklyHours>>({});
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const selectedEmployee = useMemo(() => {
    const idNum = employeeId ? Number(employeeId) : null;
    if (!idNum) return null;
    return employees.find((e) => e.id === idNum) || null;
  }, [employees, employeeId]);

  // 1) load employees (DRF paginated) - pobierz WSZYSTKIE strony
  useEffect(() => {
    (async () => {
      setLoadingEmployees(true);
      setErr("");
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
      } catch (e) {
        setErr(getErrorMessage(e));
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
      setErr("");
      setMsg("");
      try {
        const sch = await employeesApi.getSchedule(Number(employeeId));
        setWeekly(normalizeWeeklyHours(sch.weekly_hours));
      } catch (e) {
        setWeekly({});
        setErr(getErrorMessage(e));
      } finally {
        setLoadingSchedule(false);
      }
    })();
  }, [employeeId]);

  const setPeriod = (day: DayKey, idx: number, field: "start" | "end", value: string) => {
    setWeekly((prev) => {
      const copy: Record<string, Array<{ start: string; end: string }>> = { ...(prev as any) };
      const arr = Array.isArray(copy[day]) ? [...copy[day]] : [];
      const row = { ...(arr[idx] || { start: "09:00", end: "17:00" }) };
      row[field] = value;
      arr[idx] = row;
      copy[day] = arr;
      return copy as any;
    });
  };

  const addPeriod = (day: DayKey) => {
    setWeekly((prev) => {
      const copy: Record<string, Array<{ start: string; end: string }>> = { ...(prev as any) };
      const arr = Array.isArray(copy[day]) ? [...copy[day]] : [];
      arr.push({ start: "09:00", end: "17:00" });
      copy[day] = arr;
      return copy as any;
    });
  };

  const removePeriod = (day: DayKey, idx: number) => {
    setWeekly((prev) => {
      const copy: Record<string, Array<{ start: string; end: string }>> = { ...(prev as any) };
      const arr = Array.isArray(copy[day]) ? [...copy[day]] : [];
      arr.splice(idx, 1);
      copy[day] = arr;
      return copy as any;
    });
  };

  const validateAll = (): string | null => {
    for (const day of Object.keys(dayLabels) as DayKey[]) {
      const periods: any = (weekly as any)?.[day];
      if (!periods) continue;
      if (!Array.isArray(periods)) return `Błędny format dla dnia ${dayLabels[day]}.`;

      for (const p of periods) {
        const start = p?.start;
        const end = p?.end;

        if (!isValidHHMM(start) || !isValidHHMM(end)) {
          return `Nieprawidłowy format godziny w ${dayLabels[day]} (użyj HH:MM).`;
        }
        if (start >= end) {
          return `Godzina start musi być < koniec w ${dayLabels[day]}.`;
        }
      }
    }
    return null;
  };

  const handleSave = async () => {
    if (!employeeId) return;

    setErr("");
    setMsg("");

    const v = validateAll();
    if (v) {
      setErr(v);
      return;
    }

    setSaving(true);
    try {
      // API oczekuje Record<string, Array<{start,end}>>
      const payload = (weekly || {}) as Record<string, Array<{ start: string; end: string }>>;
      await employeesApi.updateSchedule(Number(employeeId), payload);
      setMsg("Zapisano grafik.");
    } catch (e) {
      setErr(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Stack spacing={2}>
      <Typography variant="h5">Grafiki pracowników</Typography>

      {msg && (
        <Alert severity="success" onClose={() => setMsg("")}>
          {msg}
        </Alert>
      )}
      {err && (
        <Alert severity="error" onClose={() => setErr("")}>
          {err}
        </Alert>
      )}

      <Paper sx={{ p: 2 }}>
        {loadingEmployees ? (
          <Stack direction="row" spacing={2} alignItems="center">
            <CircularProgress size={22} />
            <Typography>Ładowanie pracowników...</Typography>
          </Stack>
        ) : (
          <FormControl fullWidth size="small">
            <InputLabel>Pracownik</InputLabel>
            <Select value={employeeId} label="Pracownik" onChange={(e) => setEmployeeId(String(e.target.value))}>
              {employees.map((e) => (
                <MenuItem key={e.id} value={String(e.id)}>
                  {e.first_name} {e.last_name} ({e.employee_number})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
      </Paper>

      <Paper sx={{ p: 2 }}>
        <Typography variant="h6">
          {selectedEmployee
            ? `${selectedEmployee.first_name} ${selectedEmployee.last_name} — grafik tygodniowy`
            : "Grafik tygodniowy"}
        </Typography>

        <Divider sx={{ my: 2 }} />

        {loadingSchedule ? (
          <Stack direction="row" spacing={2} alignItems="center">
            <CircularProgress size={22} />
            <Typography>Ładowanie grafiku...</Typography>
          </Stack>
        ) : (
          <Stack spacing={2}>
            {(Object.keys(dayLabels) as DayKey[]).map((day) => {
              const periods: Array<{ start: string; end: string }> = ((weekly as any)[day] ?? []) as any;

              return (
                <Paper key={day} variant="outlined" sx={{ p: 2 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography fontWeight={600}>{dayLabels[day]}</Typography>
                    <Button size="small" startIcon={<AddIcon />} onClick={() => addPeriod(day)}>
                      Dodaj przedział
                    </Button>
                  </Stack>

                  {periods.length === 0 ? (
                    <Typography variant="body2" sx={{ opacity: 0.8, mt: 1 }}>
                      Brak godzin (dzień wolny).
                    </Typography>
                  ) : (
                    <Stack spacing={1} sx={{ mt: 1 }}>
                      {periods.map((p, idx) => (
                        <Stack key={idx} direction="row" spacing={1} alignItems="center">
                          <TextField
                            label="Start"
                            type="time"
                            value={p.start}
                            onChange={(e) => setPeriod(day, idx, "start", e.target.value)}
                            size="small"
                            InputLabelProps={{ shrink: true }}
                            inputProps={{ step: 300 }}
                            sx={{ width: 160 }}
                          />
                          <TextField
                            label="Koniec"
                            type="time"
                            value={p.end}
                            onChange={(e) => setPeriod(day, idx, "end", e.target.value)}
                            size="small"
                            InputLabelProps={{ shrink: true }}
                            inputProps={{ step: 300 }}
                            sx={{ width: 160 }}
                          />

                          <IconButton color="error" onClick={() => removePeriod(day, idx)} aria-label="usuń">
                            <DeleteIcon />
                          </IconButton>
                        </Stack>
                      ))}
                    </Stack>
                  )}
                </Paper>
              );
            })}

            <Box>
              <Button variant="contained" onClick={handleSave} disabled={!employeeId || saving}>
                {saving ? "Zapisuję..." : "Zapisz grafik"}
              </Button>
            </Box>
          </Stack>
        )}
      </Paper>
    </Stack>
  );
}
