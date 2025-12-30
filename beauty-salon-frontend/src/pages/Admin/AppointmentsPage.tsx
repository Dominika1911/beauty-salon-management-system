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
    Pagination,
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

type StatusFilter = AppointmentStatus | 'ALL';
type StatusColor = 'default' | 'success' | 'warning' | 'error';

type SnackState = {
    open: boolean;
    msg: string;
    severity: AlertColor;
};

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

const PAGE_SIZE = 20;

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

function statusLabel(status: AppointmentStatus): string {
    switch (status) {
        case 'PENDING':
            return 'Oczekuje';
        case 'CONFIRMED':
            return 'Potwierdzona';
        case 'COMPLETED':
            return 'Zakończona';
        case 'CANCELLED':
            return 'Anulowana';
        case 'NO_SHOW':
            return 'No-show';
        default:
            return status;
    }
}

function formatPrice(price?: string | number): string {
    if (price == null) return '—';
    const n = Number(price);
    if (Number.isNaN(n)) return '—';
    return new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(n);
}

function formatDateTimePL(iso: string): string {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('pl-PL');
}

export default function AdminAppointmentsPage(): JSX.Element {
    const [data, setData] = useState<DRFPaginated<Appointment>>(EMPTY_PAGE);
    const [page, setPage] = useState(1);

    // applied filters
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
    const [ordering] = useState<string>('-created_at');

    // draft filters
    const [draftStatusFilter, setDraftStatusFilter] = useState<StatusFilter>('ALL');

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

    // 🔥 SYSTEM SETTINGS (opening_hours)
    const [openingHours, setOpeningHours] = useState<any>(null);

    const rows = useMemo(() => data.results ?? [], [data.results]);

    const initialLoading = loading && rows.length === 0;
    const busy = loading || busyId !== null;

    // reset page when applied filter changes
    useEffect(() => {
        setPage(1);
    }, [statusFilter]);

    // keep draft synced with applied
    useEffect(() => {
        setDraftStatusFilter(statusFilter);
    }, [statusFilter]);

    const load = useCallback(async () => {
        setLoading(true);
        setPageError(null);

        try {
            const res = await appointmentsApi.list({
                page,
                ordering,
                status: statusFilter === 'ALL' ? undefined : statusFilter,
            });
            setData(res);
        } catch (e: unknown) {
            const parsed = parseDrfError(e);
            setPageError(parsed.message || 'Nie udało się pobrać wizyt. Spróbuj ponownie.');
            setData(EMPTY_PAGE);
        } finally {
            setLoading(false);
        }
    }, [page, statusFilter, ordering]);

    useEffect(() => {
        void load();
    }, [load]);

    const hasUnappliedChanges = useMemo(
        () => draftStatusFilter !== statusFilter,
        [draftStatusFilter, statusFilter],
    );

    const hasActiveFiltersApplied = useMemo(() => statusFilter !== 'ALL', [statusFilter]);

    const applyFilters = () => {
        setPage(1);
        setStatusFilter(draftStatusFilter);
    };

    const resetFilters = () => {
        setDraftStatusFilter('ALL');
        setPage(1);
        setStatusFilter('ALL');
    };

    const totalPages = useMemo(() => {
        const count = data.count ?? 0;
        return Math.max(1, Math.ceil(count / PAGE_SIZE));
    }, [data.count]);

    const emptyInfo = useMemo(() => {
        if (loading) return null;
        if (rows.length > 0) return null;
        if (hasActiveFiltersApplied) return 'Brak wizyt dla wybranego statusu.';
        return 'Brak wizyt.';
    }, [loading, rows.length, hasActiveFiltersApplied]);

    const patchRowAndCount = useCallback(
        (updated: Appointment) => {
            setData((prev) => {
                const prevResults = prev.results ?? [];

                const nextResultsRaw = prevResults.map((r) => (r.id === updated.id ? updated : r));

                const filterActive = statusFilter !== 'ALL';
                const nextResults = filterActive
                    ? nextResultsRaw.filter((r) => r.status === statusFilter)
                    : nextResultsRaw;

                const removedByFilter = filterActive && updated.status !== statusFilter;

                const nextCount = removedByFilter ? Math.max(0, (prev.count ?? 0) - 1) : prev.count;

                return { ...prev, count: nextCount, results: nextResults };
            });
        },
        [statusFilter],
    );

    const runAction = async (
        fn: (id: number) => Promise<Appointment>,
        id: number,
        successMsg: string,
    ) => {
        setBusyId(id);
        setPageError(null);

        try {
            const updated = await fn(id);
            patchRowAndCount(updated);
            setSnack({ open: true, msg: successMsg, severity: 'success' });
        } catch (e: unknown) {
            const parsed = parseDrfError(e);
            setPageError(parsed.message || 'Nie udało się wykonać operacji. Spróbuj ponownie.');
        } finally {
            setBusyId(null);
        }
    };

    // 🔥 LOAD LOOKUPS (clients, employees, services)
    const loadLookups = useCallback(async () => {
        setLoadingLookups(true);
        try {
            const [clientsRes, employeesRes, servicesRes, settingsRes] = await Promise.all([
                clientsApi.list({ is_active: true }),
                employeesApi.list({ is_active: true }),
                servicesApi.list({ is_active: true }),
                systemSettingsApi.get(), // 🔥 Pobierz opening_hours
            ]);
            setClients(clientsRes.results);
            // Admin zawsze dostaje pełny Employee type (z employee_number)
            setEmployees(employeesRes.results as Employee[]);
            setServices(servicesRes.results);
            setOpeningHours(settingsRes.opening_hours || {}); // 🔥 Zapisz opening_hours
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
        setFormData(EMPTY_FORM);
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

    // 🔥 HANDLE SAVE (CREATE or UPDATE)
    const handleSave = async () => {
        setFormError(null);

        // Validation
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

            // Mapuj day of week (0=Sunday, 1=Monday) na klucze opening_hours
            const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
            const startDayKey = dayNames[startDate.getDay()];
            const endDayKey = dayNames[endDate.getDay()];

            const startDayHours = openingHours[startDayKey] || [];
            const endDayHours = openingHours[endDayKey] || [];

            // Sprawdź czy są godziny otwarcia w tym dniu
            if (startDayHours.length === 0) {
                setFormError(`Salon jest zamknięty w tym dniu (${startDayKey.toUpperCase()}).`);
                return;
            }

            // Format czasu wizyty jako "HH:MM"
            const formatTime = (date: Date) => {
                const h = date.getHours().toString().padStart(2, '0');
                const m = date.getMinutes().toString().padStart(2, '0');
                return `${h}:${m}`;
            };

            const startTime = formatTime(startDate);
            const endTime = formatTime(endDate);

            // Sprawdź czy wizyta mieści się w godzinach otwarcia
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

        // 🔥 WALIDACJA: Maksymalny czas wizyty (np. 8 godzin)
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
            // Backend zwraca skills (Service[]), nie skill_ids
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
                // UPDATE
                const updated = await appointmentsApi.update(editId, payload);
                patchRowAndCount(updated);
                setSnack({ open: true, msg: 'Wizyta zaktualizowana.', severity: 'success' });
            } else {
                // CREATE
                await appointmentsApi.create(payload);
                await load(); // Reload because new item
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

    if (initialLoading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={pl}>
            <Stack
                spacing={2}
                sx={{
                    width: '100%',
                    maxWidth: 1200,
                    mx: 'auto',
                    px: { xs: 1, sm: 2 },
                    py: { xs: 2, sm: 3 },
                }}
            >
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
                            Zarządzanie wizytami
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            Przeglądaj i zarządzaj wizytami — filtruj po statusie i wykonuj akcje.
                        </Typography>
                    </Box>

                    <Stack direction="row" spacing={1} alignItems="center">
                        {/* 🔥 PRZYCISK "UTWÓRZ WIZYTĘ" */}
                        <Button variant="contained" onClick={openCreateDialog} disabled={busy}>
                            + Utwórz wizytę
                        </Button>

                        <Typography variant="body2" color="text.secondary">
                            Łącznie: {data.count} • Strona: {page} / {totalPages}
                        </Typography>
                    </Stack>
                </Box>

                {pageError && (
                    <Alert severity="error" onClose={() => setPageError(null)}>
                        {pageError}
                    </Alert>
                )}

                <Paper variant="outlined" sx={{ p: 2, position: 'relative' }}>
                    {loading && (
                        <LinearProgress sx={{ position: 'absolute', left: 0, right: 0, top: 0 }} />
                    )}

                    <Stack spacing={2} sx={{ pt: loading ? 1 : 0 }}>
                        {/* Filters */}
                        <Stack
                            direction={{ xs: 'column', md: 'row' }}
                            spacing={2}
                            alignItems={{ md: 'center' }}
                            justifyContent="space-between"
                        >
                            <FormControl size="small" sx={{ minWidth: 240 }} disabled={busy}>
                                <InputLabel>Status</InputLabel>
                                <Select
                                    label="Status"
                                    value={draftStatusFilter}
                                    onChange={(e) =>
                                        setDraftStatusFilter(e.target.value as StatusFilter)
                                    }
                                >
                                    <MenuItem value="ALL">Wszystkie</MenuItem>
                                    <MenuItem value="PENDING">Oczekuje</MenuItem>
                                    <MenuItem value="CONFIRMED">Potwierdzona</MenuItem>
                                    <MenuItem value="COMPLETED">Zakończona</MenuItem>
                                    <MenuItem value="CANCELLED">Anulowana</MenuItem>
                                    <MenuItem value="NO_SHOW">No-show</MenuItem>
                                </Select>
                            </FormControl>

                            <Stack
                                direction={{ xs: 'column', sm: 'row' }}
                                spacing={1}
                                justifyContent="flex-end"
                            >
                                <Button
                                    variant="outlined"
                                    onClick={resetFilters}
                                    disabled={
                                        busy || (!hasActiveFiltersApplied && !hasUnappliedChanges)
                                    }
                                >
                                    Wyczyść filtry
                                </Button>
                                <Button
                                    variant="contained"
                                    onClick={applyFilters}
                                    disabled={busy || !hasUnappliedChanges}
                                >
                                    Zastosuj
                                </Button>
                                <Button
                                    variant="outlined"
                                    onClick={() => void load()}
                                    disabled={busy}
                                >
                                    Odśwież
                                </Button>
                            </Stack>
                        </Stack>

                        <Divider />

                        {/* List */}
                        {loading && rows.length > 0 ? (
                            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                                <CircularProgress />
                            </Box>
                        ) : emptyInfo ? (
                            <Alert severity="info">{emptyInfo}</Alert>
                        ) : (
                            <Stack spacing={1}>
                                {rows.map((a) => {
                                    const isBusy = busyId === a.id;

                                    const canConfirm = a.can_confirm;
                                    const canCancel = a.can_cancel;
                                    const canComplete = a.can_complete;
                                    const canNoShow = a.can_no_show;

                                    return (
                                        <Paper key={a.id} variant="outlined" sx={{ p: 2 }}>
                                            <Stack spacing={1.5}>
                                                <Stack
                                                    direction={{ xs: 'column', sm: 'row' }}
                                                    justifyContent="space-between"
                                                    alignItems={{ sm: 'flex-start' }}
                                                    spacing={1}
                                                >
                                                    <Box>
                                                        <Typography fontWeight={800}>
                                                            {a.service_name}
                                                        </Typography>
                                                        <Typography
                                                            variant="body2"
                                                            color="text.secondary"
                                                        >
                                                            Pracownik: {a.employee_name} • Klient:{' '}
                                                            {a.client_name ?? '—'}
                                                        </Typography>
                                                    </Box>

                                                    <Stack
                                                        alignItems={{
                                                            xs: 'flex-start',
                                                            sm: 'flex-end',
                                                        }}
                                                        spacing={0.5}
                                                    >
                                                        <Chip
                                                            label={
                                                                a.status_display ||
                                                                statusLabel(a.status)
                                                            }
                                                            color={statusColor(a.status)}
                                                            size="small"
                                                        />
                                                        <Typography fontWeight={800}>
                                                            {formatPrice(a.service_price)}
                                                        </Typography>
                                                    </Stack>
                                                </Stack>

                                                <Typography variant="body2">
                                                    {formatDateTimePL(a.start)} —{' '}
                                                    {formatDateTimePL(a.end)}
                                                </Typography>

                                                {a.internal_notes ? (
                                                    <Typography
                                                        variant="caption"
                                                        color="text.secondary"
                                                        sx={{ whiteSpace: 'pre-wrap' }}
                                                    >
                                                        {a.internal_notes}
                                                    </Typography>
                                                ) : null}

                                                {(canConfirm ||
                                                    canCancel ||
                                                    canComplete ||
                                                    canNoShow) && <Divider />}

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
                                                                    'Wizyta potwierdzona.',
                                                                )
                                                            }
                                                        >
                                                            {isBusy ? '...' : 'Potwierdź'}
                                                        </Button>
                                                    )}

                                                    {canCancel && (
                                                        <Button
                                                            size="small"
                                                            variant="outlined"
                                                            color="error"
                                                            disabled={busy || isBusy}
                                                            onClick={() =>
                                                                void runAction(
                                                                    appointmentsApi.cancel,
                                                                    a.id,
                                                                    'Wizyta anulowana.',
                                                                )
                                                            }
                                                        >
                                                            {isBusy ? '...' : 'Anuluj'}
                                                        </Button>
                                                    )}

                                                    {canComplete && (
                                                        <Button
                                                            size="small"
                                                            variant="contained"
                                                            color="success"
                                                            disabled={busy || isBusy}
                                                            onClick={() =>
                                                                void runAction(
                                                                    appointmentsApi.complete,
                                                                    a.id,
                                                                    'Wizyta zakończona.',
                                                                )
                                                            }
                                                        >
                                                            {isBusy ? '...' : 'Zakończ'}
                                                        </Button>
                                                    )}

                                                    {canNoShow && (
                                                        <Button
                                                            size="small"
                                                            variant="contained"
                                                            color="error"
                                                            disabled={busy || isBusy}
                                                            onClick={() =>
                                                                void runAction(
                                                                    appointmentsApi.noShow,
                                                                    a.id,
                                                                    'Ustawiono no-show.',
                                                                )
                                                            }
                                                        >
                                                            {isBusy ? '...' : 'No-show'}
                                                        </Button>
                                                    )}
                                                </Stack>
                                            </Stack>
                                        </Paper>
                                    );
                                })}
                            </Stack>
                        )}

                        <Divider />

                        <Stack
                            direction={{ xs: 'column', sm: 'row' }}
                            spacing={2}
                            alignItems={{ sm: 'center' }}
                            justifyContent="space-between"
                        >
                            <Typography variant="body2" color="text.secondary">
                                Łącznie: {data.count}
                            </Typography>

                            <Pagination
                                count={totalPages}
                                page={page}
                                onChange={(_, p) => setPage(p)}
                                disabled={busy}
                            />
                        </Stack>
                    </Stack>
                </Paper>

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

                                {/* Employee */}
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
                                                // 🔥 Reset service gdy zmieniamy pracownika
                                                service: null,
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

                                                // 🔥 Auto-calculate end date bazując na duration
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
                                                // Backend zwraca skills (Service[]), nie skill_ids
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

                                            // 🔥 Auto-update end gdy zmieniamy start
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

                                {/* End DateTime - 🔥 READ-ONLY, auto-calculated */}
                                <DateTimePicker
                                    label="Zakończenie (automatyczne)"
                                    value={formData.end}
                                    onChange={(date) =>
                                        setFormData((prev) => ({ ...prev, end: date }))
                                    }
                                    disabled={true} // 🔥 Zawsze disabled - auto-calculate!
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
        </LocalizationProvider>
    );
}
