import React, { useEffect, useMemo, useState } from 'react';
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    CircularProgress,
    Divider,
    Grid,
    IconButton,
    LinearProgress,
    Snackbar,
    Stack,
    TextField,
    Typography,
} from '@mui/material';
import type { AlertColor } from '@mui/material/Alert';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import SaveIcon from '@mui/icons-material/Save';

import { systemSettingsApi } from '@/api/systemSettings';
import type { SystemSettings } from '@/types';
import { parseDrfError, pickFieldErrors } from '@/utils/drfErrors';

type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
type Slot = { start: string; end: string };
type OpeningHours = Record<DayKey, Slot[]>;

type SnackState = {
    open: boolean;
    msg: string;
    severity: AlertColor;
};

type BasicFieldKey = 'salon_name' | 'slot_minutes' | 'buffer_minutes';
type BasicFieldErrors = Partial<Record<BasicFieldKey, string>>;

const DAYS: Array<{ key: DayKey; label: string }> = [
    { key: 'mon', label: 'Poniedziałek' },
    { key: 'tue', label: 'Wtorek' },
    { key: 'wed', label: 'Środa' },
    { key: 'thu', label: 'Czwartek' },
    { key: 'fri', label: 'Piątek' },
    { key: 'sat', label: 'Sobota' },
    { key: 'sun', label: 'Niedziela' },
];

const emptyOpeningHours: OpeningHours = {
    mon: [],
    tue: [],
    wed: [],
    thu: [],
    fri: [],
    sat: [],
    sun: [],
};

const emptyBasicTemplate: Record<BasicFieldKey, string> = {
    salon_name: '',
    slot_minutes: '',
    buffer_minutes: '',
};

function ensureOpeningHours(oh: SystemSettings['opening_hours'] | undefined): OpeningHours {
    const base: OpeningHours = { ...emptyOpeningHours };

    if (!oh || typeof oh !== 'object') return base;

    const rec = oh as Record<string, unknown>;
    for (const day of Object.keys(base) as DayKey[]) {
        const v = rec[day];
        if (Array.isArray(v)) {
            base[day] = v
                .filter((x) => typeof x === 'object' && x !== null)
                .map((x) => {
                    const obj = x as Record<string, unknown>;
                    return {
                        start: typeof obj.start === 'string' ? obj.start : '09:00',
                        end: typeof obj.end === 'string' ? obj.end : '17:00',
                    };
                });
        }
    }

    return base;
}

function isValidTime(t: string) {
    return /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
}

function timeToMinutes(t: string) {
    const [h, m] = t.split(':').map((n) => Number(n));
    return h * 60 + m;
}

const SettingsPage: React.FC = () => {
    const [settings, setSettings] = useState<SystemSettings | null>(null);
    const [openingHours, setOpeningHours] = useState<OpeningHours>({ ...emptyOpeningHours });

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // komunikaty wg standardu
    const [pageError, setPageError] = useState<string | null>(null);
    const [formError, setFormError] = useState<string | null>(null);
    const [fieldErrors, setFieldErrors] = useState<BasicFieldErrors>({});
    const [snack, setSnack] = useState<SnackState>({ open: false, msg: '', severity: 'success' });

    const busy = loading || saving;

    const load = async () => {
        try {
            setPageError(null);
            setFormError(null);
            setFieldErrors({});
            setLoading(true);

            const data = await systemSettingsApi.get();
            setSettings(data);
            setOpeningHours(ensureOpeningHours(data.opening_hours));
        } catch (e: unknown) {
            const parsed = parseDrfError(e);
            setPageError(parsed.message || 'Nie udało się pobrać ustawień systemowych.');
            setSettings(null);
            setOpeningHours({ ...emptyOpeningHours });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void load();
    }, []);

    const handleBasicChange =
        (field: BasicFieldKey) => (e: React.ChangeEvent<HTMLInputElement>) => {
            if (!settings) return;

            const raw = e.target.value;

            setSettings((prev) => {
                if (!prev) return prev;
                return {
                    ...prev,
                    [field]: field === 'salon_name' ? raw : Number(raw),
                } as SystemSettings;
            });

            // po edycji pola czyścimy błąd pola
            setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
            setFormError(null);
        };

    const addSlot = (day: DayKey) => {
        setOpeningHours((prev) => ({
            ...prev,
            [day]: [...prev[day], { start: '09:00', end: '17:00' }],
        }));
        setFormError(null);
    };

    const removeSlot = (day: DayKey, idx: number) => {
        setOpeningHours((prev) => ({
            ...prev,
            [day]: prev[day].filter((_, i) => i !== idx),
        }));
        setFormError(null);
    };

    const updateSlot = (day: DayKey, idx: number, field: 'start' | 'end', value: string) => {
        setOpeningHours((prev) => {
            const next: OpeningHours = { ...prev };
            next[day] = next[day].map((slot, i) =>
                i === idx ? { ...slot, [field]: value } : slot,
            );
            return next;
        });
        setFormError(null);
    };

    const validationMessage = useMemo(() => {
        if (settings) {
            if (Number.isNaN(Number(settings.slot_minutes)) || Number(settings.slot_minutes) < 5) {
                return 'Długość slotu musi być liczbą ≥ 5.';
            }
            if (
                Number.isNaN(Number(settings.buffer_minutes)) ||
                Number(settings.buffer_minutes) < 0
            ) {
                return 'Bufor musi być liczbą ≥ 0.';
            }
            if (!String(settings.salon_name ?? '').trim()) {
                return 'Nazwa salonu nie może być pusta.';
            }
        }

        for (const day of Object.keys(openingHours) as DayKey[]) {
            for (const slot of openingHours[day]) {
                if (!isValidTime(slot.start) || !isValidTime(slot.end)) {
                    return 'Godziny muszą mieć format HH:MM (np. 09:00).';
                }
                if (timeToMinutes(slot.start) >= timeToMinutes(slot.end)) {
                    return 'Godzina rozpoczęcia musi być wcześniejsza niż zakończenia.';
                }
            }
        }
        return null;
    }, [openingHours, settings]);

    const canSave = !!settings && !validationMessage;

    const handleSave = async () => {
        if (!settings) return;

        try {
            setFormError(null);
            setPageError(null);
            setFieldErrors({});
            setSaving(true);

            const payload = {
                salon_name: settings.salon_name,
                slot_minutes: settings.slot_minutes,
                buffer_minutes: settings.buffer_minutes,
                opening_hours: openingHours,
            };

            const saved = await systemSettingsApi.update(payload);

            setSettings(saved);
            setOpeningHours(ensureOpeningHours(saved.opening_hours));

            setSnack({ open: true, msg: 'Ustawienia zapisane.', severity: 'success' });
        } catch (e: unknown) {
            const parsed = parseDrfError(e);

            const picked = pickFieldErrors(parsed.fieldErrors, emptyBasicTemplate);
            if (Object.keys(picked).length) {
                setFieldErrors(picked);
            }

            setFormError(
                parsed.message ||
                    (Object.keys(picked).length
                        ? 'Popraw błędy w formularzu.'
                        : 'Błąd podczas zapisywania ustawień.'),
            );
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <Box sx={{ p: 3, display: 'flex', justifyContent: 'center' }}>
                <CircularProgress />
            </Box>
        );
    }

    if (!settings) {
        return (
            <Box sx={{ width: '100%', maxWidth: 1100, mx: 'auto', p: { xs: 2, sm: 3 } }}>
                {pageError && (
                    <Alert severity="error" sx={{ mb: 2 }} onClose={() => setPageError(null)}>
                        {pageError}
                    </Alert>
                )}
                <Alert severity="warning">Brak danych ustawień.</Alert>
                <Box sx={{ mt: 2 }}>
                    <Button variant="outlined" onClick={() => void load()}>
                        Spróbuj ponownie
                    </Button>
                </Box>
            </Box>
        );
    }

    return (
        <Stack spacing={2} sx={{ width: '100%', maxWidth: 1100, mx: 'auto', p: { xs: 2, sm: 3 } }}>
            <Box
                sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: { xs: 'flex-start', sm: 'center' },
                    gap: 2,
                    flexWrap: 'wrap',
                }}
            >
                <Box>
                    <Typography variant="h5" fontWeight={900}>
                        Ustawienia systemowe
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        Konfiguracja salonu oraz godzin otwarcia.
                    </Typography>
                </Box>

                <Stack direction="row" spacing={1} alignItems="center">
                    <Button variant="outlined" onClick={() => void load()} disabled={busy}>
                        Odśwież
                    </Button>
                    <Button
                        variant="contained"
                        startIcon={<SaveIcon />}
                        disabled={!canSave || saving}
                        onClick={() => void handleSave()}
                    >
                        {saving ? 'Zapisywanie...' : 'Zapisz'}
                    </Button>
                </Stack>
            </Box>

            {pageError && (
                <Alert severity="error" onClose={() => setPageError(null)}>
                    {pageError}
                </Alert>
            )}

            <Card variant="outlined" sx={{ position: 'relative' }}>
                {saving && (
                    <LinearProgress sx={{ position: 'absolute', left: 0, right: 0, top: 0 }} />
                )}
                <CardContent sx={{ pt: saving ? 3 : 2 }}>
                    <Stack spacing={2}>
                        {formError && (
                            <Alert severity="error" onClose={() => setFormError(null)}>
                                {formError}
                            </Alert>
                        )}

                        {validationMessage && <Alert severity="warning">{validationMessage}</Alert>}

                        <Grid container spacing={2}>
                            <Grid item xs={12} md={6}>
                                <TextField
                                    fullWidth
                                    label="Nazwa salonu"
                                    value={settings.salon_name ?? ''}
                                    onChange={handleBasicChange('salon_name')}
                                    disabled={busy}
                                    error={Boolean(fieldErrors.salon_name)}
                                    helperText={fieldErrors.salon_name || ' '}
                                />
                            </Grid>

                            <Grid item xs={12} md={3}>
                                <TextField
                                    fullWidth
                                    label="Długość slotu (min)"
                                    type="number"
                                    inputProps={{ min: 5, step: 5 }}
                                    value={settings.slot_minutes ?? 30}
                                    onChange={handleBasicChange('slot_minutes')}
                                    disabled={busy}
                                    error={Boolean(fieldErrors.slot_minutes)}
                                    helperText={fieldErrors.slot_minutes || ' '}
                                />
                            </Grid>

                            <Grid item xs={12} md={3}>
                                <TextField
                                    fullWidth
                                    label="Bufor między wizytami (min)"
                                    type="number"
                                    inputProps={{ min: 0, step: 5 }}
                                    value={settings.buffer_minutes ?? 0}
                                    onChange={handleBasicChange('buffer_minutes')}
                                    disabled={busy}
                                    error={Boolean(fieldErrors.buffer_minutes)}
                                    helperText={fieldErrors.buffer_minutes || ' '}
                                />
                            </Grid>
                        </Grid>

                        <Divider />

                        <Box>
                            <Typography variant="h6" fontWeight={800} gutterBottom>
                                Godziny otwarcia
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                Dodaj przedziały godzinowe dla dni otwartych. Jeśli dzień nie ma
                                przedziałów — traktujemy go jako zamknięty.
                            </Typography>
                        </Box>

                        <Stack spacing={2}>
                            {DAYS.map(({ key, label }) => {
                                const slots = openingHours[key];
                                const isClosed = slots.length === 0;

                                return (
                                    <Box
                                        key={key}
                                        sx={{
                                            border: '1px solid',
                                            borderColor: 'divider',
                                            borderRadius: 2,
                                            p: 2,
                                        }}
                                    >
                                        <Stack
                                            direction={{ xs: 'column', md: 'row' }}
                                            justifyContent="space-between"
                                            alignItems={{ xs: 'flex-start', md: 'center' }}
                                            spacing={1}
                                            sx={{ mb: 1.25 }}
                                        >
                                            <Stack
                                                direction="row"
                                                spacing={1}
                                                alignItems="center"
                                                flexWrap="wrap"
                                            >
                                                <Typography variant="subtitle1" fontWeight={800}>
                                                    {label}
                                                </Typography>
                                                {isClosed && (
                                                    <Chip size="small" label="Zamknięte" />
                                                )}
                                                {!isClosed && (
                                                    <Chip
                                                        size="small"
                                                        variant="outlined"
                                                        label={`${slots.length} przedz.`}
                                                    />
                                                )}
                                            </Stack>

                                            <Button
                                                size="small"
                                                variant="outlined"
                                                startIcon={<AddIcon />}
                                                onClick={() => addSlot(key)}
                                                disabled={busy}
                                            >
                                                Dodaj przedział
                                            </Button>
                                        </Stack>

                                        {slots.length === 0 ? (
                                            <Typography variant="body2" color="text.secondary">
                                                Brak godzin — dzień jest zamknięty.
                                            </Typography>
                                        ) : (
                                            <Stack spacing={1}>
                                                {slots.map((slot, idx) => {
                                                    const badStart = !isValidTime(slot.start);
                                                    const badEnd = !isValidTime(slot.end);
                                                    const badOrder =
                                                        isValidTime(slot.start) &&
                                                        isValidTime(slot.end) &&
                                                        timeToMinutes(slot.start) >=
                                                            timeToMinutes(slot.end);

                                                    const helper =
                                                        badStart || badEnd
                                                            ? 'Format HH:MM (np. 09:00)'
                                                            : badOrder
                                                              ? 'Start musi być wcześniej niż koniec'
                                                              : ' ';

                                                    return (
                                                        <Stack
                                                            key={`${key}-${idx}`}
                                                            direction={{ xs: 'column', sm: 'row' }}
                                                            spacing={1}
                                                            alignItems={{
                                                                xs: 'stretch',
                                                                sm: 'center',
                                                            }}
                                                        >
                                                            <TextField
                                                                label="Start"
                                                                type="time"
                                                                value={slot.start}
                                                                onChange={(e) =>
                                                                    updateSlot(
                                                                        key,
                                                                        idx,
                                                                        'start',
                                                                        e.target.value,
                                                                    )
                                                                }
                                                                InputLabelProps={{ shrink: true }}
                                                                inputProps={{ step: 300 }}
                                                                disabled={busy}
                                                                error={badStart || badOrder}
                                                                helperText={helper}
                                                                sx={{ width: { sm: 200 } }}
                                                            />
                                                            <TextField
                                                                label="Koniec"
                                                                type="time"
                                                                value={slot.end}
                                                                onChange={(e) =>
                                                                    updateSlot(
                                                                        key,
                                                                        idx,
                                                                        'end',
                                                                        e.target.value,
                                                                    )
                                                                }
                                                                InputLabelProps={{ shrink: true }}
                                                                inputProps={{ step: 300 }}
                                                                disabled={busy}
                                                                error={badEnd || badOrder}
                                                                helperText={helper}
                                                                sx={{ width: { sm: 200 } }}
                                                            />

                                                            <Box
                                                                sx={{
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: {
                                                                        xs: 'flex-end',
                                                                        sm: 'flex-start',
                                                                    },
                                                                }}
                                                            >
                                                                <IconButton
                                                                    aria-label="Usuń przedział"
                                                                    color="error"
                                                                    onClick={() =>
                                                                        removeSlot(key, idx)
                                                                    }
                                                                    disabled={busy}
                                                                >
                                                                    <DeleteIcon />
                                                                </IconButton>
                                                            </Box>
                                                        </Stack>
                                                    );
                                                })}
                                            </Stack>
                                        )}
                                    </Box>
                                );
                            })}
                        </Stack>

                        <Divider />

                        <Stack
                            direction={{ xs: 'column', sm: 'row' }}
                            spacing={1}
                            justifyContent="flex-end"
                        >
                            <Button variant="outlined" onClick={() => void load()} disabled={busy}>
                                Odśwież
                            </Button>
                            <Button
                                variant="contained"
                                startIcon={<SaveIcon />}
                                disabled={!canSave || saving}
                                onClick={() => void handleSave()}
                            >
                                {saving ? 'Zapisywanie...' : 'Zapisz'}
                            </Button>
                        </Stack>
                    </Stack>
                </CardContent>
            </Card>

            <Snackbar
                open={snack.open}
                autoHideDuration={3200}
                onClose={() => setSnack((p) => ({ ...p, open: false }))}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert
                    onClose={() => setSnack((p) => ({ ...p, open: false }))}
                    severity={snack.severity}
                    sx={{ width: '100%' }}
                >
                    {snack.msg}
                </Alert>
            </Snackbar>
        </Stack>
    );
};

export default SettingsPage;
