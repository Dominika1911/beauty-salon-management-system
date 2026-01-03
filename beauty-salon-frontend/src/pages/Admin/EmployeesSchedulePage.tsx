import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    Alert,
    Box,
    Button,
    Chip,
    CircularProgress,
    Divider,
    FormControl,
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
} from '@mui/material';
import Grid from '@mui/material/Unstable_Grid2';
import type { SelectChangeEvent } from '@mui/material/Select';
import type { AlertColor } from '@mui/material/Alert';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';

import { employeesApi, type EmployeeListItem } from '@/api/employees';
import { parseDrfError } from '@/utils/drfErrors';
import { hasOverlaps, hhmmToMinutes, isHHMM, sanitizePeriods, sortPeriods } from '@/utils/time';

type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
type Period = { start: string; end: string };
type WeeklyDraft = Partial<Record<DayKey, Period[]>>;

type Employee = {
    id: number;
    employee_number: string;
    first_name: string;
    last_name: string;
    full_name: string;
};

type SnackState = {
    open: boolean;
    msg: string;
    severity: AlertColor;
};

const dayLabels: Record<DayKey, string> = {
    mon: 'Poniedziałek',
    tue: 'Wtorek',
    wed: 'Środa',
    thu: 'Czwartek',
    fri: 'Piątek',
    sat: 'Sobota',
    sun: 'Niedziela',
};

function isEmployee(row: EmployeeListItem): row is Employee {
    return (row as Employee).employee_number !== undefined;
}

function normalizeWeeklyHours(input: unknown): WeeklyDraft {
    const base: WeeklyDraft = {};
    if (!input || typeof input !== 'object') return base;

    const obj = input as Record<string, unknown>;
    for (const day of Object.keys(dayLabels) as DayKey[]) {
        base[day] = sanitizePeriods(obj[day]);
    }
    return base;
}

export default function EmployeesSchedulePage() {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [employeeId, setEmployeeId] = useState('');

    const [loadingEmployees, setLoadingEmployees] = useState(true);
    const [loadingSchedule, setLoadingSchedule] = useState(false);
    const [saving, setSaving] = useState(false);

    const [weekly, setWeekly] = useState<WeeklyDraft>({});
    const [formError, setFormError] = useState<string | null>(null);
    const [pageError, setPageError] = useState<string | null>(null);
    const [snack, setSnack] = useState<SnackState>({ open: false, msg: '', severity: 'success' });

    const busy = loadingEmployees || loadingSchedule || saving;
    const scheduleReqToken = useRef(0);

    const selectedEmployee = useMemo(() => {
        const id = Number(employeeId);
        if (!id) return null;
        return employees.find((e) => e.id === id) ?? null;
    }, [employeeId, employees]);

    useEffect(() => {
        const loadEmployees = async () => {
            try {
                setPageError(null);
                setLoadingEmployees(true);

                const all: Employee[] = [];
                let page = 1;
                const MAX_PAGES = 50;

                while (true) {
                    const data = await employeesApi.list({ page });
                    const rows = (data?.results || []).filter(isEmployee);
                    all.push(...rows);

                    if (!data?.next) break;
                    page += 1;
                    if (page > MAX_PAGES) break;
                }

                setEmployees(all);
            } catch (e: unknown) {
                const parsed = parseDrfError(e);
                setPageError(parsed.message || 'Nie udało się pobrać listy pracowników.');
                setEmployees([]);
            } finally {
                setLoadingEmployees(false);
            }
        };

        void loadEmployees();
    }, []);

    useEffect(() => {
        const loadSchedule = async () => {
            const id = Number(employeeId);

            scheduleReqToken.current += 1;
            const token = scheduleReqToken.current;

            if (!id) {
                setWeekly({});
                setLoadingSchedule(false);
                return;
            }

            try {
                setFormError(null);
                setPageError(null);
                setLoadingSchedule(true);

                const schedule = await employeesApi.getSchedule(id);

                if (token !== scheduleReqToken.current) return;

                setWeekly(normalizeWeeklyHours(schedule?.weekly_hours));
            } catch (e: unknown) {
                if (token !== scheduleReqToken.current) return;

                const parsed = parseDrfError(e);
                setPageError(parsed.message || 'Nie udało się pobrać grafiku pracownika.');
                setWeekly({});
           } finally {
        if (token === scheduleReqToken.current) {
            setLoadingSchedule(false);
        }
    }
};

void loadSchedule();
}, [employeeId]);

    const handleEmployeeChange = (e: SelectChangeEvent) => {
        setEmployeeId(e.target.value);
        setFormError(null);
        setPageError(null);
    };

    const ensureDayArray = (day: DayKey): Period[] => {
        const v = weekly[day];
        return Array.isArray(v) ? v : [];
    };

    const handleAddPeriod = (day: DayKey) => {
        setWeekly((prev) => {
            const next: WeeklyDraft = { ...prev };
            const arr = ensureDayArray(day);
            next[day] = [...arr, { start: '09:00', end: '17:00' }];
            return next;
        });
        setFormError(null);
    };

    const handleChangePeriod = (day: DayKey, idx: number, field: 'start' | 'end', value: string) => {
        setWeekly((prev) => {
            const next: WeeklyDraft = { ...prev };
            const arr = ensureDayArray(day);
            next[day] = arr.map((p, i) => (i === idx ? { ...p, [field]: value } : p));
            return next;
        });
        setFormError(null);
    };

    const handleRemovePeriod = (day: DayKey, idx: number) => {
        setWeekly((prev) => {
            const next: WeeklyDraft = { ...prev };
            const arr = ensureDayArray(day);
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
                if (!isHHMM(p.start) || !isHHMM(p.end)) {
                    return `W ${dayLabels[day]} godziny muszą mieć format HH:MM.`;
                }
                if (hhmmToMinutes(p.start) >= hhmmToMinutes(p.end)) {
                    return `W ${dayLabels[day]} godzina rozpoczęcia musi być wcześniejsza niż zakończenia.`;
                }
            }

            const cleaned = sortPeriods(periods);
            if (hasOverlaps(cleaned)) {
                return `W ${dayLabels[day]} przedziały godzin nachodzą na siebie.`;
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
            const payload: Record<string, Array<{ start: string; end: string }>> = {};
            for (const day of Object.keys(dayLabels) as DayKey[]) {
                const periods = weekly[day];
                if (!periods || !Array.isArray(periods)) continue;
                payload[day] = sortPeriods(periods).map((p) => ({ start: p.start.trim(), end: p.end.trim() }));
            }

            await employeesApi.updateSchedule(Number(employeeId), payload);
            setSnack({ open: true, msg: 'Grafik zapisany.', severity: 'success' });
        } catch (e: unknown) {
            const parsed = parseDrfError(e);
            setFormError(parsed.message || 'Nie udało się zapisać grafiku.');
            setSnack({ open: true, msg: parsed.message || 'Błąd zapisu grafiku.', severity: 'error' });
        } finally {
            setSaving(false);
        }
    };

    const closeSnack = () => setSnack((s) => ({ ...s, open: false }));

    return (
        <Box>
            <Typography variant="h4" sx={{ mb: 2 }}>
                Grafik pracowników
            </Typography>

            {(loadingEmployees || loadingSchedule) && <LinearProgress sx={{ mb: 2 }} />}

            {pageError && (
                <Alert severity="error" sx={{ mb: 2 }}>
                    {pageError}
                </Alert>
            )}

            <Paper sx={{ p: 2, mb: 2 }}>
                <Grid container spacing={2} alignItems="center">
                    <Grid xs={12} md={6}>
                        <FormControl fullWidth disabled={loadingEmployees}>
                            <InputLabel id="emp-select-label">Pracownik</InputLabel>
                            <Select
                                labelId="emp-select-label"
                                label="Pracownik"
                                value={employeeId}
                                onChange={handleEmployeeChange}
                            >
                                <MenuItem value="">
                                    <em>Wybierz</em>
                                </MenuItem>
                                {employees.map((e) => (
                                    <MenuItem key={e.id} value={String(e.id)}>
                                        {e.employee_number} — {e.full_name || `${e.first_name} ${e.last_name}`.trim()}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>

                    <Grid xs={12} md={6}>
                        {selectedEmployee ? (
                            <Stack direction="row" spacing={1} alignItems="center">
                                <Chip label={`ID: ${selectedEmployee.id}`} />
                                <Chip label={`Nr: ${selectedEmployee.employee_number}`} />
                                <Chip
                                    label={selectedEmployee.full_name || `${selectedEmployee.first_name} ${selectedEmployee.last_name}`.trim()}
                                />
                            </Stack>
                        ) : (
                            <Typography variant="body2" color="text.secondary">
                                Wybierz pracownika, aby edytować grafik.
                            </Typography>
                        )}
                    </Grid>
                </Grid>
            </Paper>

            {employeeId && !loadingSchedule && (
                <Paper sx={{ p: 2 }}>
                    <Stack spacing={2}>
                        {formError && <Alert severity="warning">{formError}</Alert>}

                        <Divider />

                        <Grid container spacing={2}>
                            {(Object.keys(dayLabels) as DayKey[]).map((day) => {
                                const periods = ensureDayArray(day);

                                return (
                                    <Grid key={day} xs={12} md={6} lg={4}>
                                        <Paper variant="outlined" sx={{ p: 2 }}>
                                            <Stack spacing={1}>
                                                <Stack direction="row" justifyContent="space-between" alignItems="center">
                                                    <Typography fontWeight={600}>{dayLabels[day]}</Typography>
                                                    <Button
                                                        size="small"
                                                        startIcon={<AddIcon />}
                                                        onClick={() => handleAddPeriod(day)}
                                                        disabled={busy}
                                                    >
                                                        Dodaj
                                                    </Button>
                                                </Stack>

                                                {periods.length === 0 ? (
                                                    <Typography variant="body2" color="text.secondary">
                                                        Brak godzin — dzień wolny.
                                                    </Typography>
                                                ) : (
                                                    periods.map((p, idx) => (
                                                        <Stack key={`${day}-${idx}`} direction="row" spacing={1} alignItems="center">
                                                            <TextField
                                                                label="Start"
                                                                size="small"
                                                                value={p.start}
                                                                onChange={(e) => handleChangePeriod(day, idx, 'start', e.target.value)}
                                                                disabled={busy}
                                                                sx={{ flex: 1 }}
                                                            />
                                                            <TextField
                                                                label="Koniec"
                                                                size="small"
                                                                value={p.end}
                                                                onChange={(e) => handleChangePeriod(day, idx, 'end', e.target.value)}
                                                                disabled={busy}
                                                                sx={{ flex: 1 }}
                                                            />
                                                            <IconButton
                                                                aria-label="Usuń"
                                                                onClick={() => handleRemovePeriod(day, idx)}
                                                                disabled={busy}
                                                            >
                                                                <DeleteIcon />
                                                            </IconButton>
                                                        </Stack>
                                                    ))
                                                )}
                                            </Stack>
                                        </Paper>
                                    </Grid>
                                );
                            })}
                        </Grid>

                        <Divider />

                        <Stack direction="row" spacing={2} alignItems="center">
                            <Button variant="contained" onClick={handleSave} disabled={busy || !employeeId}>
                                {saving ? <CircularProgress size={20} /> : 'Zapisz'}
                            </Button>
                            <Typography variant="body2" color="text.secondary">
                                Uwaga: backend waliduje godziny względem godzin otwarcia salonu.
                            </Typography>
                        </Stack>
                    </Stack>
                </Paper>
            )}

            <Snackbar open={snack.open} autoHideDuration={4000} onClose={closeSnack}>
                <Alert severity={snack.severity} onClose={closeSnack} sx={{ width: '100%' }}>
                    {snack.msg}
                </Alert>
            </Snackbar>
        </Box>
    );
}
