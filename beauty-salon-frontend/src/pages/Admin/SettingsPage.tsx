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

import type { SystemSettings } from '@/types';
import { systemSettingsApi } from '@/api/systemSettings';
import { parseDrfError, pickFieldErrors } from '@/utils/drfErrors';
import { hasOverlaps, hhmmToMinutes, isHHMM, sortPeriods } from '@/utils/time';

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

    if (oh && typeof oh === 'object') {
        for (const d of DAYS) {
            const raw = (oh as Record<string, unknown>)[d.key];
            if (Array.isArray(raw)) {
                base[d.key] = raw
                    .map((x) => {
                        if (!x || typeof x !== 'object') return null;
                        const o = x as { start?: unknown; end?: unknown };
                        const start = typeof o.start === 'string' ? o.start : '';
                        const end = typeof o.end === 'string' ? o.end : '';
                        return { start, end };
                    })
                    .filter(Boolean) as Slot[];
            } else {
                base[d.key] = [];
            }
        }
    }

    return base;
}

function cleanSlots(slots: Slot[]): Slot[] {
    // trim + drop empties + stable sort
    const cleaned = slots
        .map((s) => ({ start: String(s.start ?? '').trim(), end: String(s.end ?? '').trim() }))
        .filter((s) => s.start !== '' && s.end !== '');

    return sortPeriods(cleaned);
}

const SettingsPage: React.FC = () => {
    const [settings, setSettings] = useState<SystemSettings | null>(null);
    const [basicDraft, setBasicDraft] = useState<Record<BasicFieldKey, string>>({ ...emptyBasicTemplate });
    const [openingHours, setOpeningHours] = useState<OpeningHours>({ ...emptyOpeningHours });

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [pageError, setPageError] = useState<string | null>(null);
    const [formError, setFormError] = useState<string | null>(null);

    const [fieldErrors, setFieldErrors] = useState<BasicFieldErrors>({});

    const [snack, setSnack] = useState<SnackState>({
        open: false,
        msg: '',
        severity: 'success',
    });

    const busy = loading || saving;

    const load = async () => {
        try {
            setPageError(null);
            setFormError(null);
            setFieldErrors({});
            setLoading(true);

            const data = await systemSettingsApi.get();
            setSettings(data);

            setBasicDraft({
                salon_name: String(data.salon_name ?? ''),
                slot_minutes: data.slot_minutes === null || data.slot_minutes === undefined ? '' : String(data.slot_minutes),
                buffer_minutes: data.buffer_minutes === null || data.buffer_minutes === undefined ? '' : String(data.buffer_minutes),
            });

            setOpeningHours(ensureOpeningHours(data.opening_hours));
        } catch (e: unknown) {
            const parsed = parseDrfError(e);
            setPageError(parsed.message || 'Nie udało się pobrać ustawień systemowych.');
            setSettings(null);
            setBasicDraft({ ...emptyBasicTemplate });
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
            const raw = e.target.value;

            setBasicDraft((prev) => ({
                ...prev,
                [field]: raw,
            }));

            setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
            setFormError(null);
        };

    const addSlot = (day: DayKey) => {
        setOpeningHours((prev) => {
            const next: OpeningHours = { ...prev };
            next[day] = [...next[day], { start: '09:00', end: '17:00' }];
            return next;
        });
        setFormError(null);
    };

    const removeSlot = (day: DayKey, idx: number) => {
        setOpeningHours((prev) => {
            const next: OpeningHours = { ...prev };
            next[day] = next[day].filter((_, i) => i !== idx);
            return next;
        });
        setFormError(null);
    };

    const updateSlot = (day: DayKey, idx: number, field: keyof Slot, value: string) => {
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
            const salonName = String(basicDraft.salon_name ?? '').trim();
            if (!salonName) return 'Nazwa salonu nie może być pusta.';

            const slotMinutes = Number(String(basicDraft.slot_minutes ?? '').trim());
            if (!Number.isFinite(slotMinutes) || Number.isNaN(slotMinutes) || slotMinutes < 5) {
                return 'Długość slotu musi być liczbą ≥ 5.';
            }

            const bufferMinutes = Number(String(basicDraft.buffer_minutes ?? '').trim());
            if (!Number.isFinite(bufferMinutes) || Number.isNaN(bufferMinutes) || bufferMinutes < 0) {
                return 'Bufor musi być liczbą ≥ 0.';
            }
        }

        for (const day of Object.keys(openingHours) as DayKey[]) {
            const slots = openingHours[day] ?? [];

            // walidujemy tylko te sloty, które mają oba pola wpisane
            const candidate = cleanSlots(slots);

            for (const slot of candidate) {
                if (!isHHMM(slot.start) || !isHHMM(slot.end)) {
                    return 'Godziny muszą mieć format HH:MM (np. 09:00).';
                }
                if (hhmmToMinutes(slot.start) >= hhmmToMinutes(slot.end)) {
                    return 'Godzina rozpoczęcia musi być wcześniejsza niż zakończenia.';
                }
            }

            if (hasOverlaps(candidate)) {
                return `W dniu: ${DAYS.find((d) => d.key === day)?.label ?? day} przedziały godzin nachodzą na siebie.`;
            }
        }
        return null;
    }, [openingHours, settings, basicDraft]);

    const canSave = !!settings && !validationMessage;

    const handleSave = async () => {
        if (!settings) return;

        try {
            setFormError(null);
            setPageError(null);
            setFieldErrors({});
            setSaving(true);

            const payloadOpening: OpeningHours = { ...emptyOpeningHours };
            for (const d of DAYS) {
                payloadOpening[d.key] = cleanSlots(openingHours[d.key] ?? []);
            }

            const payload = {
                salon_name: String(basicDraft.salon_name ?? '').trim(),
                slot_minutes: Number(String(basicDraft.slot_minutes ?? '').trim()),
                buffer_minutes: Number(String(basicDraft.buffer_minutes ?? '').trim()),
                opening_hours: payloadOpening,
            };

            const saved = await systemSettingsApi.update(payload);

            setSettings(saved);
            setBasicDraft({
                salon_name: String(saved.salon_name ?? ''),
                slot_minutes: saved.slot_minutes === null || saved.slot_minutes === undefined ? '' : String(saved.slot_minutes),
                buffer_minutes: saved.buffer_minutes === null || saved.buffer_minutes === undefined ? '' : String(saved.buffer_minutes),
            });
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
                        : 'Nie udało się zapisać ustawień.'),
            );

            setSnack({
                open: true,
                msg: parsed.message || 'Błąd zapisu ustawień.',
                severity: 'error',
            });
        } finally {
            setSaving(false);
        }
    };

    const closeSnack = () => setSnack((s) => ({ ...s, open: false }));

    if (loading) {
        return (
            <Box>
                <Typography variant="h4" sx={{ mb: 2 }}>
                    Ustawienia systemowe
                </Typography>
                <LinearProgress sx={{ mb: 2 }} />
                <Stack direction="row" alignItems="center" spacing={2}>
                    <CircularProgress size={24} />
                    <Typography>Ładowanie...</Typography>
                </Stack>
            </Box>
        );
    }

    return (
        <Box>
            <Typography variant="h4" sx={{ mb: 2 }}>
                Ustawienia systemowe
            </Typography>

            {pageError && (
                <Alert severity="error" sx={{ mb: 2 }}>
                    {pageError}
                </Alert>
            )}

            <Grid container spacing={2}>
                <Grid item xs={12} md={5}>
                    <Card>
                        <CardContent>
                            <Typography variant="h6" sx={{ mb: 2 }}>
                                Podstawowe
                            </Typography>

                            {formError && (
                                <Alert severity="warning" sx={{ mb: 2 }}>
                                    {formError}
                                </Alert>
                            )}

                            {validationMessage && (
                                <Alert severity="info" sx={{ mb: 2 }}>
                                    {validationMessage}
                                </Alert>
                            )}

                            <Stack spacing={2}>
                                <TextField
                                    label="Nazwa salonu"
                                    value={basicDraft.salon_name}
                                    onChange={handleBasicChange('salon_name')}
                                    disabled={busy}
                                    error={!!fieldErrors.salon_name}
                                    helperText={fieldErrors.salon_name || ''}
                                    fullWidth
                                />

                                <TextField
                                    label="Długość slotu (min)"
                                    type="number"
                                    value={basicDraft.slot_minutes}
                                    onChange={handleBasicChange('slot_minutes')}
                                    disabled={busy}
                                    error={!!fieldErrors.slot_minutes}
                                    helperText={fieldErrors.slot_minutes || 'Min. 5'}
                                    fullWidth
                                    inputProps={{ min: 5 }}
                                />

                                <TextField
                                    label="Bufor (min)"
                                    type="number"
                                    value={basicDraft.buffer_minutes}
                                    onChange={handleBasicChange('buffer_minutes')}
                                    disabled={busy}
                                    error={!!fieldErrors.buffer_minutes}
                                    helperText={fieldErrors.buffer_minutes || 'Min. 0'}
                                    fullWidth
                                    inputProps={{ min: 0 }}
                                />

                                <Divider />

                                <Button
                                    variant="contained"
                                    onClick={handleSave}
                                    disabled={!canSave || busy}
                                >
                                    {saving ? <CircularProgress size={20} /> : 'Zapisz'}
                                </Button>

                                {!!settings && (
                                    <Stack direction="row" spacing={1} flexWrap="wrap">
                                        <Chip label={`ID: ${settings.id}`} />
                                        <Chip label={`Aktualizacja: ${new Date(settings.updated_at).toLocaleString()}`} />
                                        {settings.updated_by_username && (
                                            <Chip label={`Przez: ${settings.updated_by_username}`} />
                                        )}
                                    </Stack>
                                )}
                            </Stack>
                        </CardContent>
                    </Card>
                </Grid>

                <Grid item xs={12} md={7}>
                    <Card>
                        <CardContent>
                            <Typography variant="h6" sx={{ mb: 2 }}>
                                Godziny otwarcia
                            </Typography>

                            <Stack spacing={2}>
                                {DAYS.map((d) => (
                                    <Box key={d.key}>
                                        <Stack
                                            direction="row"
                                            justifyContent="space-between"
                                            alignItems="center"
                                            sx={{ mb: 1 }}
                                        >
                                            <Typography fontWeight={600}>{d.label}</Typography>
                                            <Button
                                                size="small"
                                                startIcon={<AddIcon />}
                                                onClick={() => addSlot(d.key)}
                                                disabled={busy}
                                            >
                                                Dodaj
                                            </Button>
                                        </Stack>

                                        {openingHours[d.key].length === 0 ? (
                                            <Typography variant="body2" color="text.secondary">
                                                Dzień zamknięty.
                                            </Typography>
                                        ) : (
                                            <Stack spacing={1}>
                                                {openingHours[d.key].map((slot, idx) => (
                                                    <Stack key={`${d.key}-${idx}`} direction="row" spacing={1} alignItems="center">
                                                        <TextField
                                                            label="Start"
                                                            size="small"
                                                            value={slot.start}
                                                            onChange={(e) => updateSlot(d.key, idx, 'start', e.target.value)}
                                                            disabled={busy}
                                                            sx={{ flex: 1 }}
                                                        />
                                                        <TextField
                                                            label="Koniec"
                                                            size="small"
                                                            value={slot.end}
                                                            onChange={(e) => updateSlot(d.key, idx, 'end', e.target.value)}
                                                            disabled={busy}
                                                            sx={{ flex: 1 }}
                                                        />
                                                        <IconButton
                                                            aria-label="Usuń"
                                                            onClick={() => removeSlot(d.key, idx)}
                                                            disabled={busy}
                                                        >
                                                            <DeleteIcon />
                                                        </IconButton>
                                                    </Stack>
                                                ))}
                                            </Stack>
                                        )}
                                        <Divider sx={{ mt: 2 }} />
                                    </Box>
                                ))}
                            </Stack>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>

            <Snackbar open={snack.open} autoHideDuration={4000} onClose={closeSnack}>
                <Alert severity={snack.severity} onClose={closeSnack} sx={{ width: '100%' }}>
                    {snack.msg}
                </Alert>
            </Snackbar>
        </Box>
    );
};

export default SettingsPage;
