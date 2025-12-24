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

import type { Employee } from "../../types";
import { getEmployees } from "../../api/employees";
import {
  getEmployeeSchedule,
  updateEmployeeSchedule,
  WeeklyHours,
} from "../../api/employees";

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

function normalizeWeeklyHours(input: any): Partial<WeeklyHours> {
  if (!input || typeof input !== "object") return {};
  return input;
}

// POPRAWKA: walidacja realnych godzin
function isValidHHMM(s: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
}

export default function EmployeesSchedulePage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeId, setEmployeeId] = useState<number | "">("");

  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [saving, setSaving] = useState(false);

  const [weekly, setWeekly] = useState<Partial<WeeklyHours>>({});
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const selectedEmployee = useMemo(
    () => employees.find((e) => e.id === employeeId) || null,
    [employees, employeeId]
  );

  useEffect(() => {
    (async () => {
      setLoadingEmployees(true);
      setErr("");
      try {
        const data = await getEmployees();
        setEmployees(data);
        if (data.length > 0) setEmployeeId(data[0].id);
      } catch (e: any) {
        setErr(e?.response?.data?.detail || e?.message || "Błąd pobierania pracowników.");
      } finally {
        setLoadingEmployees(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!employeeId) return;

    (async () => {
      setLoadingSchedule(true);
      setErr("");
      setMsg("");
      try {
        const sch = await getEmployeeSchedule(Number(employeeId));
        setWeekly(normalizeWeeklyHours(sch.weekly_hours));
      } catch (e: any) {
        setWeekly({});
        setErr(e?.response?.data?.detail || e?.message || "Błąd pobierania grafiku.");
      } finally {
        setLoadingSchedule(false);
      }
    })();
  }, [employeeId]);

  const setPeriod = (day: DayKey, idx: number, field: "start" | "end", value: string) => {
    setWeekly((prev) => {
      const copy = { ...(prev || {}) };
      const arr = Array.isArray((copy as any)[day]) ? [...((copy as any)[day] as any[])] : [];
      const row = { ...(arr[idx] || { start: "09:00", end: "17:00" }) };
      row[field] = value;
      arr[idx] = row;
      (copy as any)[day] = arr;
      return copy;
    });
  };

  const addPeriod = (day: DayKey) => {
    setWeekly((prev) => {
      const copy = { ...(prev || {}) };
      const arr = Array.isArray((copy as any)[day]) ? [...((copy as any)[day] as any[])] : [];
      arr.push({ start: "09:00", end: "17:00" });
      (copy as any)[day] = arr;
      return copy;
    });
  };

  const removePeriod = (day: DayKey, idx: number) => {
    setWeekly((prev) => {
      const copy = { ...(prev || {}) };
      const arr = Array.isArray((copy as any)[day]) ? [...((copy as any)[day] as any[])] : [];
      arr.splice(idx, 1);
      (copy as any)[day] = arr;
      return copy;
    });
  };

  const validateAll = (): string | null => {
    for (const day of Object.keys(dayLabels) as DayKey[]) {
      const periods = (weekly as any)?.[day];
      if (!periods) continue;
      if (!Array.isArray(periods)) return `Błędny format dla dnia ${dayLabels[day]}.`;

      for (const p of periods) {
        const start = p?.start;
        const end = p?.end;

        if (!isValidHHMM(start) || !isValidHHMM(end)) {
          return `Nieprawidłowy format godziny w ${dayLabels[day]} (użyj HH:MM).`;
        }

        // Porównanie stringów działa dla HH:MM
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
      await updateEmployeeSchedule(Number(employeeId), weekly);
      setMsg("Zapisano grafik.");
    } catch (e: any) {
      setErr(e?.response?.data?.detail || e?.message || "Błąd zapisu grafiku.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Stack spacing={2}>
      <Typography variant="h5">Grafiki pracowników</Typography>

      {msg && <Alert severity="success">{msg}</Alert>}
      {err && <Alert severity="error">{err}</Alert>}

      <Paper sx={{ p: 2 }}>
        {loadingEmployees ? (
          <Stack direction="row" spacing={2} alignItems="center">
            <CircularProgress size={22} />
            <Typography>Ładowanie pracowników...</Typography>
          </Stack>
        ) : (
          <FormControl fullWidth>
            <InputLabel>Pracownik</InputLabel>
            <Select
              value={employeeId}
              label="Pracownik"
              onChange={(e) => setEmployeeId(Number(e.target.value))}
            >
              {employees.map((e) => (
                <MenuItem key={e.id} value={e.id}>
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
                          {/* POPRAWKA: type="time" => bez literówek, zawsze HH:MM */}
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

                          <IconButton
                            color="error"
                            onClick={() => removePeriod(day, idx)}
                            aria-label="usuń"
                          >
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
