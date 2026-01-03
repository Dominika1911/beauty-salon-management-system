import React, { useEffect, useMemo, useState } from 'react';
import {
    Alert,
    CircularProgress,
    Paper,
    Stack,
    Typography,
    Box,
    Divider,
    Chip,
} from '@mui/material';
import Grid from '@mui/material/Unstable_Grid2';
import { AccessTime, EventBusy } from '@mui/icons-material';

import { useAuth } from '@/context/AuthContext';
import { employeesApi } from '@/api/employees';
import { parseDrfError } from '@/utils/drfErrors';
import { sanitizePeriods } from '@/utils/time';

type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
type Period = { start: string; end: string };
type WeeklyHours = Record<DayKey, Period[]>;

const DAYS: Array<{ key: DayKey; label: string }> = [
    { key: 'mon', label: 'Poniedziałek' },
    { key: 'tue', label: 'Wtorek' },
    { key: 'wed', label: 'Środa' },
    { key: 'thu', label: 'Czwartek' },
    { key: 'fri', label: 'Piątek' },
    { key: 'sat', label: 'Sobota' },
    { key: 'sun', label: 'Niedziela' },
];

const EMPTY_SCHEDULE: WeeklyHours = {
    mon: [],
    tue: [],
    wed: [],
    thu: [],
    fri: [],
    sat: [],
    sun: [],
};

function normalizeWeeklyHours(input: unknown): WeeklyHours {
    const out: WeeklyHours = { ...EMPTY_SCHEDULE };
    if (!input || typeof input !== 'object') return out;

    const obj = input as Record<string, unknown>;
    for (const d of DAYS) {
        out[d.key] = sanitizePeriods(obj[d.key]);
    }
    return out;
}

export default function EmployeeSchedulePage() {
    const { user } = useAuth();
    // employee_profile.id z /api/users/me/ -> pk do /employees/{id}/schedule/
    const employeeId = user?.employee_profile?.id ?? null;

    const [schedule, setSchedule] = useState<WeeklyHours>(EMPTY_SCHEDULE);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);

    useEffect(() => {
        let alive = true;

        const load = async () => {
            if (alive) setErr(null);
            if (alive) setLoading(true);

            if (!employeeId) {
                if (alive) setSchedule(EMPTY_SCHEDULE);
                if (alive) setErr('Brak profilu pracownika (employee_profile).');
                if (alive) setLoading(false);
                return;
            }

            try {
                const data = await employeesApi.getSchedule(employeeId);
                if (!alive) return;

                setSchedule(normalizeWeeklyHours(data?.weekly_hours as unknown));
            } catch (e: unknown) {
                if (!alive) return;
                setSchedule(EMPTY_SCHEDULE);
                const parsed = parseDrfError(e);
                setErr(parsed.message || 'Nie udało się pobrać grafiku pracy.');
            } finally {
                if (alive) setLoading(false);
            }
        };

        void load();

        return () => {
            alive = false;
        };
    }, [employeeId]);

    const hasAnyHours = useMemo(
        () => DAYS.some((d) => schedule[d.key].some((p) => p.start && p.end)),
        [schedule],
    );

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Stack spacing={3} sx={{ maxWidth: 650, mx: 'auto', mt: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <AccessTime color="primary" />
                <Typography variant="h5" fontWeight={800}>
                    Mój grafik pracy
                </Typography>
            </Box>

            <Alert severity="info" variant="outlined">
                Poniżej znajdują się Twoje standardowe godziny pracy. Jeśli potrzebujesz zmian,
                skontaktuj się z administratorem.
            </Alert>

            {err && <Alert severity="error">{err}</Alert>}

            {!err && !hasAnyHours && (
                <Alert severity="warning" variant="outlined">
                    Nie masz ustawionych godzin pracy w grafiku.
                </Alert>
            )}

            <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden' }}>
                <Stack divider={<Divider />}>
                    {DAYS.map((day) => {
                        const periods = schedule[day.key];
                        const isOff = periods.length === 0;

                        return (
                            <Box
                                key={day.key}
                                sx={{
                                    p: 2,
                                    bgcolor: isOff ? 'action.hover' : 'background.paper',
                                }}
                            >
                                <Grid container alignItems="center" spacing={1}>
                                    <Grid xs={12} sm={5}>
                                        <Typography
                                            variant="body1"
                                            fontWeight={isOff ? 500 : 800}
                                            color={isOff ? 'text.secondary' : 'text.primary'}
                                        >
                                            {day.label}
                                        </Typography>
                                    </Grid>

                                    <Grid
                                        xs={12}
                                        sm={7}
                                        sx={{
                                            display: 'flex',
                                            justifyContent: { xs: 'flex-start', sm: 'flex-end' },
                                            alignItems: 'center',
                                            gap: 1,
                                            flexWrap: 'wrap',
                                        }}
                                    >
                                        {isOff ? (
                                            <Stack direction="row" spacing={1} alignItems="center">
                                                <EventBusy sx={{ fontSize: 18, color: 'text.secondary' }} />
                                                <Typography variant="body2" color="text.secondary" fontWeight={600}>
                                                    Wolne
                                                </Typography>
                                            </Stack>
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
