import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Alert,
    Box,
    Button,
    Chip,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
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
} from '@mui/material';
import type { AlertColor } from '@mui/material/Alert';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { pl } from 'date-fns/locale';

import type {
    Appointment,
    AppointmentStatus,
    DRFPaginated,
    Service,
    Client,
    Employee,
} from '@/types';
import { appointmentsApi } from '@/api/appointments';
import { servicesApi } from '@/api/services';
import { clientsApi } from '@/api/clients';
import { employeesApi } from '@/api/employees';
import { systemSettingsApi } from '@/api/systemSettings';
import { parseDrfError } from '@/utils/drfErrors';
import { useAuth } from '@/context/AuthContext';

type StatusColor = 'warning' | 'success' | 'default' | 'error';
type Ordering = 'start' | '-start' | 'status' | '-status' | 'created_at' | '-created_at';

type SnackState = { open: boolean; msg: string; severity: AlertColor };

type FormData = {
    client: number | null;
    employee: number | null;
    service: number | null;
    start: Date | null;
    end: Date | null;
    status: AppointmentStatus;
    internal_notes: string;
};

const EMPTY_FORM: FormData = {
    client: null,
    employee: null,
    service: null,
    start: null,
    end: null,
    status: 'PENDING',
    internal_notes: '',
};

const EMPTY_PAGE: DRFPaginated<Appointment> = {
    count: 0,
    next: null,
    previous: null,
    results: [],
};

function statusColor(status: AppointmentStatus): StatusColor {
    switch (status) {
        case 'CONFIRMED':
            return 'success';
        case 'PENDING':
            return 'warning';
        case 'CANCELLED':
            return 'error';
        case 'COMPLETED':
            return 'success';
        case 'NO_SHOW':
            return 'error';
        default:
            return 'default';
    }
}

function formatPL(iso: string): string {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('pl-PL');
}

function formatPrice(price?: string | number): string {
    if (price == null) return '—';
    const n = Number(price);
    if (Number.isNaN(n)) return '—';
    return new Intl.NumberFormat('pl-PL', {
        style: 'currency',
        currency: 'PLN',
    }).format(n);
}

function orderingLabel(o: Ordering): string {
    switch (o) {
        case 'start':
            return 'Najbliższe terminy';
        case '-start':
            return 'Najdalsze terminy';
        case '-created_at':
            return 'Najnowsze dodane';
        case 'created_at':
            return 'Najstarsze dodane';
        case '-status':
            return 'Status: od oczekujących';
        case 'status':
            return 'Status: od anulowanych';
        default:
            return 'Sortowanie';
    }
}

export default function EmployeeAppointmentsPage(): JSX.Element {
    const { user } = useAuth();
    const currentEmployeeId = user?.employee_profile?.id ?? null;

    const [data, setData] = useState<DRFPaginated<Appointment>>(EMPTY_PAGE);
    const [page, setPage] = useState(1);

    const [draftOrdering, setDraftOrdering] = useState<Ordering>('start');
    const [ordering, setOrdering] = useState<Ordering>('start');

    const [loading, setLoading] = useState(true);
    const [busyId, setBusyId] = useState<number | null>(null);

    const [pageError, setPageError] = useState<string | null>(null);
    const [snack, setSnack] = useState<SnackState>({ open: false, msg: '', severity: 'info' });

    // 🔥 CREATE/UPDATE DIALOG STATE
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [editId, setEditId] = useState<number | null>(null);
    const [formData, setFormData] = useState<FormData>(EMPTY_FORM);
    const [formError, setFormError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    // 🔥 LOOKUP DATA
    const [clients, setClients] = useState<Client[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [services, setServices] = useState<Service[]>([]);
    const [loadingLookups, setLoadingLookups] = useState(false);

    // 🔥 SYSTEM SETTINGS
    const [openingHours, setOpeningHours] = useState<any>(null);

    const busy = loading || busyId != null;
    const hasUnappliedFilters = draftOrdering !== ordering;

    useEffect(() => {
        setPage(1);
    }, [ordering]);

    const load = useCallback(async () => {
        setLoading(true);
        setPageError(null);

        try {
            const res = await appointmentsApi.getMy({ page, ordering });
            setData(res);
        } catch (e: unknown) {
            const parsed = parseDrfError(e);
            setPageError(parsed.message || 'Nie udało się wczytać wizyt. Spróbuj ponownie.');
            setData(EMPTY_PAGE);
        } finally {
            setLoading(false);
        }
    }, [page, ordering]);

    useEffect(() => {
        void load();
    }, [load]);

    const canPrev = Boolean(data.previous) && !loading;
    const canNext = Boolean(data.next) && !loading;

    const applyFilters = () => {
        if (!hasUnappliedFilters) return;
        setOrdering(draftOrdering);
        setSnack({
            open: true,
            msg: `Zastosowano sortowanie: ${orderingLabel(draftOrdering)}.`,
            severity: 'info',
        });
    };

    const clearFilters = () => {
        setDraftOrdering('start');
        setOrdering('start');
        setSnack({ open: true, msg: 'Przywrócono domyślne sortowanie.', severity: 'info' });
    };

    const patchRow = useCallback((updated: Appointment) => {
        setData((prev) => {
            const prevResults = prev.results ?? [];
            const nextResults = prevResults.map((r) => (r.id === updated.id ? updated : r));
            return { ...prev, results: nextResults };
        });
    }, []);

    const runAction = async (
        fn: (id: number) => Promise<Appointment>,
        id: number,
        successMsg: string,
    ) => {
        setBusyId(id);
        setPageError(null);

        try {
            const updated = await fn(id);
            patchRow(updated);
            setSnack({ open: true, msg: successMsg, severity: 'success' });
        } catch (e: unknown) {
            const parsed = parseDrfError(e);
            setPageError(parsed.message || 'Nie udało się wykonać akcji. Spróbuj ponownie.');
        } finally {
            setBusyId(null);
        }
    };

    // 🔥 LOAD LOOKUPS
    const loadLookups = useCallback(async () => {
        setLoadingLookups(true);
        try {
            const [clientsRes, employeesRes, servicesRes, settingsRes] = await Promise.all([
                clientsApi.list({ is_active: true }),
                employeesApi.list({ is_active: true }),
                servicesApi.list({ is_active: true }),
                systemSettingsApi.get(),
            ]);
            setClients(clientsRes.results);
            setEmployees(employeesRes.results as Employee[]);
            setServices(servicesRes.results);
            setOpeningHours(settingsRes.opening_hours || {});
        } catch (e: unknown) {
            const parsed = parseDrfError(e);
            setFormError(parsed.message || 'Nie udało się załadować danych.');
        } finally {
            setLoadingLookups(false);
        }
    }, []);

    // 🔥 OPEN CREATE DIALOG
    const openCreateDialog = () => {
        setEditMode(false);
        setEditId(null);
        // 🔥 Pre-fill employee z current user
        setFormData({
            ...EMPTY_FORM,
            employee: currentEmployeeId,
        });
        setFormError(null);
        setDialogOpen(true);
        void loadLookups();
    };

    // 🔥 OPEN EDIT DIALOG
    const openEditDialog = (appointment: Appointment) => {
        setEditMode(true);
        setEditId(appointment.id);
        setFormData({
            client: appointment.client,
            employee: appointment.employee,
            service: appointment.service,
            start: new Date(appointment.start),
            end: new Date(appointment.end),
            status: appointment.status,
            internal_notes: appointment.internal_notes || '',
        });
        setFormError(null);
        setDialogOpen(true);
        void loadLookups();
    };

    // 🔥 CLOSE DIALOG
    const closeDialog = () => {
        if (submitting) return;
        setDialogOpen(false);
        setFormData(EMPTY_FORM);
        setFormError(null);
    };

    // 🔥 HANDLE SAVE
    const handleSave = async () => {
        setFormError(null);

        if (!formData.client) {
            setFormError('Wybierz klienta.');
            return;
        }
        if (!formData.employee) {
            setFormError('Wybierz pracownika.');
            return;
        }
        if (!formData.service) {
            setFormError('Wybierz usługę.');
            return;
        }
        if (!formData.start) {
            setFormError('Wybierz datę rozpoczęcia.');
            return;
        }
        if (!formData.end) {
            setFormError('Wybierz datę zakończenia.');
            return;
        }

        // 🔥 WALIDACJA: Nie można ustawiać wizyt w przeszłości
        const now = new Date();
        if (formData.start < now) {
            setFormError('Nie można umówić wizyty w przeszłości.');
            return;
        }

        // 🔥 WALIDACJA: Godziny otwarcia salonu (z SystemSettings)
        if (openingHours && Object.keys(openingHours).length > 0) {
            const startDate = formData.start;
            const endDate = formData.end;

            const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
            const startDayKey = dayNames[startDate.getDay()];
            const endDayKey = dayNames[endDate.getDay()];

            const startDayHours = openingHours[startDayKey] || [];
            const endDayHours = openingHours[endDayKey] || [];

            if (startDayHours.length === 0) {
                setFormError(`Salon jest zamknięty w tym dniu (${startDayKey.toUpperCase()}).`);
                return;
            }

            const formatTime = (date: Date) => {
                const h = date.getHours().toString().padStart(2, '0');
                const m = date.getMinutes().toString().padStart(2, '0');
                return `${h}:${m}`;
            };

            const startTime = formatTime(startDate);
            const endTime = formatTime(endDate);

            let isStartValid = false;
            let isEndValid = false;

            for (const period of startDayHours) {
                if (startTime >= period.start && startTime < period.end) {
                    isStartValid = true;
                }
                if (endTime > period.start && endTime <= period.end) {
                    isEndValid = true;
                }
            }

            if (!isStartValid) {
                const periods = startDayHours.map((p: any) => `${p.start}-${p.end}`).join(', ');
                setFormError(
                    `Wizyta rozpoczyna się poza godzinami otwarcia. Godziny otwarcia: ${periods}`,
                );
                return;
            }

            if (!isEndValid) {
                const periods = endDayHours.map((p: any) => `${p.start}-${p.end}`).join(', ');
                setFormError(
                    `Wizyta kończy się poza godzinami otwarcia. Godziny otwarcia: ${periods}`,
                );
                return;
            }
        }

        // 🔥 WALIDACJA: Data zakończenia > rozpoczęcia
        if (formData.end <= formData.start) {
            setFormError('Data zakończenia musi być późniejsza niż rozpoczęcia.');
            return;
        }

        // 🔥 WALIDACJA: Maksymalny czas wizyty
        const durationMs = formData.end.getTime() - formData.start.getTime();
        const durationHours = durationMs / (1000 * 60 * 60);
        if (durationHours > 8) {
            setFormError('Wizyta nie może trwać dłużej niż 8 godzin.');
            return;
        }

        // 🔥 WALIDACJA: Sprawdź czy pracownik ma skill dla wybranej usługi
        const selectedEmployee = employees.find((e) => e.id === formData.employee);
        const selectedService = services.find((s) => s.id === formData.service);

        if (selectedEmployee && selectedService) {
            const employeeSkillIds = (selectedEmployee.skills || []).map((skill: any) => skill.id);
            if (!employeeSkillIds.includes(selectedService.id)) {
                setFormError(
                    `Pracownik ${selectedEmployee.full_name} nie obsługuje usługi "${selectedService.name}". ` +
                        `Wybierz innego pracownika lub inną usługę.`,
                );
                return;
            }
        }

        setSubmitting(true);

        try {
            const payload = {
                client: formData.client,
                employee: formData.employee,
                service: formData.service,
                start: formData.start.toISOString(),
                end: formData.end.toISOString(),
                status: formData.status,
                internal_notes: formData.internal_notes.trim() || undefined,
            };

            if (editMode && editId) {
                const updated = await appointmentsApi.update(editId, payload);
                patchRow(updated);
                setSnack({ open: true, msg: 'Wizyta zaktualizowana.', severity: 'success' });
            } else {
                await appointmentsApi.create(payload);
                await load();
                setSnack({ open: true, msg: 'Wizyta utworzona.', severity: 'success' });
            }

            closeDialog();
        } catch (e: unknown) {
            const parsed = parseDrfError(e);
            setFormError(parsed.message || 'Nie udało się zapisać wizyty.');
        } finally {
            setSubmitting(false);
        }
    };

    const rows = useMemo(() => data.results ?? [], [data.results]);

    const emptyText = useMemo(() => {
        if (ordering === 'start') return 'Nie masz jeszcze żadnych wizyt.';
        return `Brak wizyt dla wybranego sortowania („${orderingLabel(ordering)}").`;
    }, [ordering]);

    if (loading && rows.length === 0) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={pl}>
            <Stack
                spacing={2.5}
                sx={{
                    width: '100%',
                    maxWidth: 1200,
                    mx: 'auto',
                    px: { xs: 1, sm: 2 },
                    py: { xs: 2, sm: 3 },
                }}
            >
                {loading && <LinearProgress />}

                <Stack
                    direction={{ xs: 'column', md: 'row' }}
                    spacing={2}
                    alignItems={{ xs: 'stretch', md: 'center' }}
                    justifyContent="space-between"
                >
                    <Box>
                        <Typography variant="h5" fontWeight={900}>
                            Moje wizyty
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            Tutaj zobaczysz swoje terminy i wykonasz dostępne akcje.
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            Sortowanie: <strong>{orderingLabel(ordering)}</strong>
                        </Typography>
                    </Box>

                    <Stack direction="row" spacing={1}>
                        {/* 🔥 PRZYCISK "UTWÓRZ WIZYTĘ" */}
                        <Button variant="contained" onClick={openCreateDialog} disabled={busy}>
                            + Utwórz wizytę
                        </Button>

                        <Button variant="outlined" onClick={() => void load()} disabled={busy}>
                            Odśwież
                        </Button>
                    </Stack>
                </Stack>

                {pageError && (
                    <Alert severity="error" onClose={() => setPageError(null)}>
                        {pageError}
                    </Alert>
                )}

                <Paper variant="outlined" sx={{ p: 2 }}>
                    <Stack spacing={2}>
                        <Stack
                            direction={{ xs: 'column', md: 'row' }}
                            spacing={2}
                            justifyContent="space-between"
                            alignItems={{ xs: 'stretch', md: 'center' }}
                        >
                            <FormControl size="small" sx={{ minWidth: 260 }} disabled={busy}>
                                <InputLabel>Sortowanie</InputLabel>
                                <Select
                                    value={draftOrdering}
                                    label="Sortowanie"
                                    onChange={(e) => setDraftOrdering(e.target.value as Ordering)}
                                >
                                    <MenuItem value="start">Najbliższe terminy</MenuItem>
                                    <MenuItem value="-start">Najdalsze terminy</MenuItem>
                                    <MenuItem value="-created_at">Najnowsze dodane</MenuItem>
                                    <MenuItem value="created_at">Najstarsze dodane</MenuItem>
                                    <MenuItem value="-status">Status: od oczekujących</MenuItem>
                                    <MenuItem value="status">Status: od anulowanych</MenuItem>
                                </Select>
                            </FormControl>

                            <Stack
                                direction={{ xs: 'column', sm: 'row' }}
                                spacing={1}
                                alignItems={{ sm: 'center' }}
                            >
                                <Button variant="outlined" onClick={clearFilters} disabled={busy}>
                                    Wyczyść
                                </Button>
                                <Button
                                    variant="contained"
                                    onClick={applyFilters}
                                    disabled={busy || !hasUnappliedFilters}
                                >
                                    Zastosuj
                                </Button>
                            </Stack>
                        </Stack>

                        <Stack
                            direction={{ xs: 'column', sm: 'row' }}
                            spacing={1}
                            alignItems={{ sm: 'center' }}
                            justifyContent="space-between"
                        >
                            <Typography variant="body2" color="text.secondary">
                                Wyniki: {data.count} • Strona: {page}
                            </Typography>

                            <Stack direction="row" spacing={1}>
                                <Button
                                    variant="outlined"
                                    disabled={!canPrev}
                                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                                >
                                    Poprzednia
                                </Button>
                                <Button
                                    variant="contained"
                                    disabled={!canNext}
                                    onClick={() => setPage((p) => p + 1)}
                                >
                                    Następna
                                </Button>
                            </Stack>
                        </Stack>
                    </Stack>
                </Paper>

                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                        <CircularProgress />
                    </Box>
                ) : rows.length === 0 ? (
                    <Alert severity="info">{emptyText}</Alert>
                ) : (
                    <Stack spacing={1.5}>
                        {rows.map((a) => {
                            const isBusy = busyId === a.id;

                            const canConfirm = a.can_confirm;
                            const canCancel = a.can_cancel;
                            const canComplete = a.can_complete;
                            const canNoShow = a.can_no_show;

                            return (
                                <Paper key={a.id} variant="outlined" sx={{ p: 2 }}>
                                    <Stack spacing={1.25}>
                                        <Stack
                                            direction={{ xs: 'column', sm: 'row' }}
                                            justifyContent="space-between"
                                            alignItems={{ sm: 'flex-start' }}
                                            spacing={2}
                                        >
                                            <Box sx={{ flex: 1 }}>
                                                <Typography fontWeight={900}>
                                                    {a.service_name}
                                                </Typography>
                                                <Typography variant="body2" color="text.secondary">
                                                    Klient: {a.client_name ?? '—'}
                                                </Typography>
                                                <Typography variant="body2" sx={{ mt: 0.75 }}>
                                                    Termin: {formatPL(a.start)} — {formatPL(a.end)}
                                                </Typography>
                                            </Box>

                                            <Stack
                                                alignItems={{ xs: 'flex-start', sm: 'flex-end' }}
                                                spacing={0.5}
                                            >
                                                <Chip
                                                    label={a.status_display || a.status}
                                                    size="small"
                                                    color={statusColor(a.status)}
                                                />
                                                <Typography fontWeight={800}>
                                                    {formatPrice(a.service_price)}
                                                </Typography>
                                            </Stack>
                                        </Stack>

                                        {(canConfirm || canCancel || canComplete || canNoShow) && (
                                            <>
                                                <Divider />
                                                <Stack
                                                    direction="row"
                                                    spacing={1}
                                                    flexWrap="wrap"
                                                    useFlexGap
                                                >
                                                    {/* 🔥 PRZYCISK "EDYTUJ" */}
                                                    <Button
                                                        size="small"
                                                        variant="outlined"
                                                        disabled={busy || isBusy}
                                                        onClick={() => openEditDialog(a)}
                                                    >
                                                        Edytuj
                                                    </Button>

                                                    {canConfirm && (
                                                        <Button
                                                            size="small"
                                                            variant="contained"
                                                            disabled={busy || isBusy}
                                                            onClick={() =>
                                                                void runAction(
                                                                    appointmentsApi.confirm,
                                                                    a.id,
                                                                    'Wizyta została potwierdzona.',
                                                                )
                                                            }
                                                            startIcon={
                                                                isBusy ? (
                                                                    <CircularProgress size={18} />
                                                                ) : undefined
                                                            }
                                                        >
                                                            Potwierdź
                                                        </Button>
                                                    )}

                                                    {canCancel && (
                                                        <Button
                                                            size="small"
                                                            color="error"
                                                            variant="outlined"
                                                            disabled={busy || isBusy}
                                                            onClick={() =>
                                                                void runAction(
                                                                    appointmentsApi.cancel,
                                                                    a.id,
                                                                    'Wizyta została anulowana.',
                                                                )
                                                            }
                                                            startIcon={
                                                                isBusy ? (
                                                                    <CircularProgress size={18} />
                                                                ) : undefined
                                                            }
                                                        >
                                                            Anuluj
                                                        </Button>
                                                    )}

                                                    {canComplete && (
                                                        <Button
                                                            size="small"
                                                            color="success"
                                                            variant="contained"
                                                            disabled={busy || isBusy}
                                                            onClick={() =>
                                                                void runAction(
                                                                    appointmentsApi.complete,
                                                                    a.id,
                                                                    'Wizyta została zakończona.',
                                                                )
                                                            }
                                                            startIcon={
                                                                isBusy ? (
                                                                    <CircularProgress size={18} />
                                                                ) : undefined
                                                            }
                                                        >
                                                            Zakończ
                                                        </Button>
                                                    )}

                                                    {canNoShow && (
                                                        <Button
                                                            size="small"
                                                            color="error"
                                                            variant="contained"
                                                            disabled={busy || isBusy}
                                                            onClick={() =>
                                                                void runAction(
                                                                    appointmentsApi.noShow,
                                                                    a.id,
                                                                    'Ustawiono no-show.',
                                                                )
                                                            }
                                                            startIcon={
                                                                isBusy ? (
                                                                    <CircularProgress size={18} />
                                                                ) : undefined
                                                            }
                                                        >
                                                            No-show
                                                        </Button>
                                                    )}
                                                </Stack>
                                            </>
                                        )}
                                    </Stack>
                                </Paper>
                            );
                        })}
                    </Stack>
                )}

                {/* 🔥 CREATE/UPDATE DIALOG */}
                <Dialog open={dialogOpen} onClose={closeDialog} maxWidth="sm" fullWidth>
                    <DialogTitle>{editMode ? 'Edytuj wizytę' : 'Utwórz wizytę'}</DialogTitle>

                    <DialogContent dividers>
                        {loadingLookups ? (
                            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                                <CircularProgress />
                            </Box>
                        ) : (
                            <Stack spacing={2.5} sx={{ mt: 1 }}>
                                {formError && <Alert severity="error">{formError}</Alert>}

                                {/* Client */}
                                <FormControl fullWidth required>
                                    <InputLabel>Klient</InputLabel>
                                    <Select
                                        label="Klient"
                                        value={formData.client || ''}
                                        onChange={(e) =>
                                            setFormData((prev) => ({
                                                ...prev,
                                                client: Number(e.target.value),
                                            }))
                                        }
                                        disabled={submitting}
                                    >
                                        {clients.map((c) => (
                                            <MenuItem key={c.id} value={c.id}>
                                                {c.first_name} {c.last_name} ({c.client_number})
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>

                                {/* Employee - pre-filled z current user */}
                                <FormControl fullWidth required>
                                    <InputLabel>Pracownik</InputLabel>
                                    <Select
                                        label="Pracownik"
                                        value={formData.employee || ''}
                                        onChange={(e) => {
                                            const newEmployeeId = Number(e.target.value);
                                            setFormData((prev) => ({
                                                ...prev,
                                                employee: newEmployeeId,
                                                service: null, // 🔥 Reset service
                                            }));
                                        }}
                                        disabled={submitting}
                                    >
                                        {employees.map((e) => (
                                            <MenuItem key={e.id} value={e.id}>
                                                {e.full_name} ({e.employee_number})
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>

                                {/* Service - 🔥 FILTROWANE po skillach pracownika */}
                                <FormControl fullWidth required disabled={!formData.employee}>
                                    <InputLabel>Usługa</InputLabel>
                                    <Select
                                        label="Usługa"
                                        value={formData.service || ''}
                                        onChange={(e) => {
                                            const serviceId = Number(e.target.value);
                                            const selectedService = services.find(
                                                (s) => s.id === serviceId,
                                            );

                                            setFormData((prev) => {
                                                const newData = { ...prev, service: serviceId };

                                                // 🔥 Auto-calculate end date
                                                if (selectedService && prev.start) {
                                                    const durationMs =
                                                        selectedService.duration_minutes *
                                                        60 *
                                                        1000;
                                                    newData.end = new Date(
                                                        prev.start.getTime() + durationMs,
                                                    );
                                                }

                                                return newData;
                                            });
                                        }}
                                        disabled={submitting || !formData.employee}
                                    >
                                        {!formData.employee ? (
                                            <MenuItem disabled>
                                                Najpierw wybierz pracownika
                                            </MenuItem>
                                        ) : (
                                            (() => {
                                                const selectedEmp = employees.find(
                                                    (e) => e.id === formData.employee,
                                                );
                                                const empSkillIds = (selectedEmp?.skills || []).map(
                                                    (skill: any) => skill.id,
                                                );
                                                const availableServices = services.filter((s) =>
                                                    empSkillIds.includes(s.id),
                                                );

                                                if (availableServices.length === 0) {
                                                    return (
                                                        <MenuItem disabled>
                                                            Pracownik nie obsługuje żadnych usług
                                                        </MenuItem>
                                                    );
                                                }

                                                return availableServices.map((s) => (
                                                    <MenuItem key={s.id} value={s.id}>
                                                        {s.name} — {s.price} zł,{' '}
                                                        {s.duration_minutes} min
                                                    </MenuItem>
                                                ));
                                            })()
                                        )}
                                    </Select>
                                    {formData.employee &&
                                        (() => {
                                            const selectedEmp = employees.find(
                                                (e) => e.id === formData.employee,
                                            );
                                            const empSkillIds = (selectedEmp?.skills || []).map(
                                                (skill: any) => skill.id,
                                            );
                                            const availableCount = services.filter((s) =>
                                                empSkillIds.includes(s.id),
                                            ).length;
                                            return (
                                                <Typography
                                                    variant="caption"
                                                    color="text.secondary"
                                                    sx={{ mt: 0.5 }}
                                                >
                                                    Dostępne usługi: {availableCount} /{' '}
                                                    {services.length}
                                                </Typography>
                                            );
                                        })()}
                                </FormControl>

                                {/* Start DateTime */}
                                <DateTimePicker
                                    label="Rozpoczęcie *"
                                    value={formData.start}
                                    onChange={(date) => {
                                        setFormData((prev) => {
                                            const newData = { ...prev, start: date };

                                            // 🔥 Auto-update end
                                            if (date && prev.service) {
                                                const selectedService = services.find(
                                                    (s) => s.id === prev.service,
                                                );
                                                if (selectedService) {
                                                    const durationMs =
                                                        selectedService.duration_minutes *
                                                        60 *
                                                        1000;
                                                    newData.end = new Date(
                                                        date.getTime() + durationMs,
                                                    );
                                                }
                                            }

                                            return newData;
                                        });
                                    }}
                                    disabled={submitting}
                                    minDateTime={new Date()} // 🔥 Nie można wybrać przeszłości!
                                    slotProps={{
                                        textField: {
                                            fullWidth: true,
                                            required: true,
                                        },
                                    }}
                                />

                                {/* End DateTime - READ-ONLY */}
                                <DateTimePicker
                                    label="Zakończenie (automatyczne)"
                                    value={formData.end}
                                    onChange={(date) =>
                                        setFormData((prev) => ({ ...prev, end: date }))
                                    }
                                    disabled={true}
                                    slotProps={{
                                        textField: {
                                            fullWidth: true,
                                            required: true,
                                            helperText:
                                                formData.service && formData.start
                                                    ? `Czas trwania: ${services.find((s) => s.id === formData.service)?.duration_minutes || 0} min`
                                                    : 'Wybierz usługę i datę rozpoczęcia',
                                        },
                                    }}
                                />

                                {/* Status */}
                                <FormControl fullWidth required>
                                    <InputLabel>Status</InputLabel>
                                    <Select
                                        label="Status"
                                        value={formData.status}
                                        onChange={(e) =>
                                            setFormData((prev) => ({
                                                ...prev,
                                                status: e.target.value as AppointmentStatus,
                                            }))
                                        }
                                        disabled={submitting}
                                    >
                                        <MenuItem value="PENDING">Oczekuje</MenuItem>
                                        <MenuItem value="CONFIRMED">Potwierdzona</MenuItem>
                                    </Select>
                                </FormControl>

                                {/* Internal Notes */}
                                <TextField
                                    label="Notatki wewnętrzne"
                                    multiline
                                    rows={3}
                                    value={formData.internal_notes}
                                    onChange={(e) =>
                                        setFormData((prev) => ({
                                            ...prev,
                                            internal_notes: e.target.value,
                                        }))
                                    }
                                    disabled={submitting}
                                    fullWidth
                                />
                            </Stack>
                        )}
                    </DialogContent>

                    <DialogActions>
                        <Button onClick={closeDialog} disabled={submitting}>
                            Anuluj
                        </Button>
                        <Button
                            variant="contained"
                            onClick={handleSave}
                            disabled={submitting || loadingLookups}
                        >
                            {submitting ? 'Zapisuję...' : editMode ? 'Zapisz' : 'Utwórz'}
                        </Button>
                    </DialogActions>
                </Dialog>

                <Snackbar
                    open={snack.open}
                    autoHideDuration={3000}
                    onClose={() => setSnack((p) => ({ ...p, open: false }))}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                >
                    <Alert
                        severity={snack.severity}
                        onClose={() => setSnack((p) => ({ ...p, open: false }))}
                        sx={{ width: '100%' }}
                    >
                        {snack.msg}
                    </Alert>
                </Snackbar>
            </Stack>
        </LocalizationProvider>
    );
}
