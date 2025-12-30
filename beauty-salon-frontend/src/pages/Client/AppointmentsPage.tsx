import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    Alert,
    Box,
    Button,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    FormControl,
    InputLabel,
    MenuItem,
    Paper,
    Select,
    Snackbar,
    Stack,
    Typography,
    Chip,
    LinearProgress,
} from '@mui/material';
import type { AlertColor } from '@mui/material/Alert';

import type { Appointment, AppointmentStatus, DRFPaginated } from '@/types';
import { appointmentsApi } from '@/api/appointments';
import { parseDrfError } from '@/utils/drfErrors';

type StatusFilter = AppointmentStatus | 'ALL';
type Ordering = 'start' | '-start' | 'status' | '-status' | 'created_at' | '-created_at';

type SnackState = { open: boolean; msg: string; severity: AlertColor };
type CancelDialogState = { open: boolean; appt: Appointment | null };

const EMPTY_PAGE: DRFPaginated<Appointment> = {
    count: 0,
    next: null,
    previous: null,
    results: [],
};

function formatPL(dt: string): string {
    const d = new Date(dt);
    return Number.isNaN(d.getTime())
        ? dt
        : d.toLocaleString('pl-PL', {
              dateStyle: 'long',
              timeStyle: 'short',
          });
}

function formatPrice(price?: string | number): string {
    if (price == null) return '—';
    const n = Number(price);
    if (Number.isNaN(n)) return '—';
    return new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(n);
}

function statusChipColor(status: AppointmentStatus): 'default' | 'warning' | 'success' | 'error' {
    switch (status) {
        case 'PENDING':
            return 'warning';
        case 'CONFIRMED':
            return 'success';
        case 'COMPLETED':
            return 'default';
        case 'CANCELLED':
            return 'error';
        case 'NO_SHOW':
            return 'error';
        default:
            return 'default';
    }
}

function statusLabel(status: StatusFilter): string {
    switch (status) {
        case 'ALL':
            return 'Wszystkie';
        case 'PENDING':
            return 'Oczekujące';
        case 'CONFIRMED':
            return 'Potwierdzone';
        case 'COMPLETED':
            return 'Zakończone';
        case 'CANCELLED':
            return 'Anulowane';
        case 'NO_SHOW':
            return 'No-show';
        default:
            return String(status);
    }
}

function orderingLabel(ordering: Ordering): string {
    switch (ordering) {
        case 'start':
            return 'Najbliższe terminy';
        case '-start':
            return 'Najdalsze terminy';
        case '-created_at':
            return 'Najnowsze rezerwacje';
        case 'created_at':
            return 'Najstarsze rezerwacje';
        case 'status':
            return 'Status (A→Z)';
        case '-status':
            return 'Status (Z→A)';
        default:
            return 'Domyślne';
    }
}

export default function ClientAppointmentsPage(): JSX.Element {
    const location = useLocation();
    const navigate = useNavigate();

    const [data, setData] = useState<DRFPaginated<Appointment>>(EMPTY_PAGE);
    const [page, setPage] = useState(1);

    // applied (real request params)
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
    const [ordering, setOrdering] = useState<Ordering>('start'); // klient: domyślnie najbliższe terminy

    // draft (UI)
    const [draftStatus, setDraftStatus] = useState<StatusFilter>('ALL');
    const [draftOrdering, setDraftOrdering] = useState<Ordering>('start');

    const [loading, setLoading] = useState(true);
    const [busyCancelId, setBusyCancelId] = useState<number | null>(null);

    const [pageError, setPageError] = useState<string | null>(null);
    const [snack, setSnack] = useState<SnackState>({ open: false, msg: '', severity: 'info' });

    const [cancelDialog, setCancelDialog] = useState<CancelDialogState>({
        open: false,
        appt: null,
    });

    const busy = loading || busyCancelId != null;
    const isDirty = draftStatus !== statusFilter || draftOrdering !== ordering;

    // ✅ snackbar po rezerwacji z BookingPage
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const msg = params.get('msg');
        if (msg !== 'reserved') return;

        setSnack({ open: true, msg: 'Wizyta została zarezerwowana.', severity: 'success' });

        // usuń ?msg=reserved z URL (żeby nie pokazywać ponownie po refresh/back)
        params.delete('msg');
        const nextSearch = params.toString();
        navigate(
            { pathname: location.pathname, search: nextSearch ? `?${nextSearch}` : '' },
            { replace: true },
        );
    }, [location.pathname, location.search, navigate]);

    // reset page when applied filters change
    useEffect(() => {
        setPage(1);
    }, [statusFilter, ordering]);

    const load = useCallback(async () => {
        setLoading(true);
        setPageError(null);

        try {
            const res = await appointmentsApi.list({
                page,
                ordering,
                status: statusFilter === 'ALL' ? undefined : statusFilter,
                // CLIENT backend i tak zwraca tylko własne wizyty
            });
            setData(res);
        } catch (e: unknown) {
            const parsed = parseDrfError(e);
            setPageError(parsed.message || 'Nie udało się pobrać wizyt.');
            setData(EMPTY_PAGE);
        } finally {
            setLoading(false);
        }
    }, [page, ordering, statusFilter]);

    useEffect(() => {
        void load();
    }, [load]);

    const canPrev = Boolean(data.previous) && !loading;
    const canNext = Boolean(data.next) && !loading;

    const results = useMemo(() => data.results ?? [], [data.results]);

    const emptyText = useMemo(() => {
        const hasFilters = statusFilter !== 'ALL';
        if (hasFilters) return `Brak wizyt dla statusu: ${statusLabel(statusFilter)}.`;
        return 'Na razie nie masz żadnych wizyt.';
    }, [statusFilter]);


    const canCancelClientUi = (appt: Appointment): boolean => {
    const statusBlocked = appt.status === 'COMPLETED' || appt.status === 'CANCELLED';
    const isPast = new Date(appt.start).getTime() <= Date.now();
    return appt.can_cancel && !statusBlocked && !isPast;
    };


    const openCancel = (appt: Appointment) => {
    if (!canCancelClientUi(appt)) return;
    setCancelDialog({ open: true, appt });
    };


    const closeCancel = () => {
        if (busyCancelId != null) return;
        setCancelDialog({ open: false, appt: null });
    };

    const confirmCancel = async () => {
        const appt = cancelDialog.appt;
        if (!appt) return;

        setBusyCancelId(appt.id);
        setPageError(null);

        try {
            const updated = await appointmentsApi.cancel(appt.id);

            // ✅ bez reloadu – patchujemy rekord lokalnie
            setData((prev) => {
                const prevResults = prev.results ?? [];
                const nextResultsRaw = prevResults.map((r) => (r.id === updated.id ? updated : r));

                // jeśli filtr aktywny, a status po cancel nie pasuje -> usuń z listy
                const filterActive = statusFilter !== 'ALL';
                const nextResults = filterActive
                    ? nextResultsRaw.filter((r) => r.status === statusFilter)
                    : nextResultsRaw;

                // korekta count, gdy filtr aktywny i element znika z listy
                const removedByFilter =
                    filterActive &&
                    nextResultsRaw.some((r) => r.id === updated.id) &&
                    updated.status !== statusFilter;

                const nextCount = removedByFilter ? Math.max(0, (prev.count ?? 0) - 1) : prev.count;

                return { ...prev, count: nextCount, results: nextResults };
            });

            setSnack({ open: true, msg: 'Wizyta została anulowana.', severity: 'success' });
            setCancelDialog({ open: false, appt: null });
        } catch (e: unknown) {
            const parsed = parseDrfError(e);
            setPageError(parsed.message || 'Nie udało się anulować wizyty.');
        } finally {
            setBusyCancelId(null);
        }
    };

    const applyFilters = () => {
        if (!isDirty) return;
        setStatusFilter(draftStatus);
        setOrdering(draftOrdering);
        setSnack({
            open: true,
            msg: `Zastosowano: ${statusLabel(draftStatus)} • ${orderingLabel(draftOrdering)}.`,
            severity: 'info',
        });
    };

    const clearFilters = () => {
        const nextStatus: StatusFilter = 'ALL';
        const nextOrdering: Ordering = 'start';

        setDraftStatus(nextStatus);
        setDraftOrdering(nextOrdering);
        setStatusFilter(nextStatus);
        setOrdering(nextOrdering);

        setSnack({ open: true, msg: 'Wyczyszczono filtry.', severity: 'info' });
    };

    return (
        <Stack spacing={2} sx={{ maxWidth: 980, mx: 'auto', p: { xs: 1.5, sm: 2.5 } }}>
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
                        Sprawdź terminy, status i szczegóły wizyt.
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                        Widok: {statusLabel(statusFilter)} • Sortowanie: {orderingLabel(ordering)}
                    </Typography>
                </Box>

                <Stack
                    direction="row"
                    spacing={1}
                    justifyContent={{ xs: 'flex-start', md: 'flex-end' }}
                >
                    <Button variant="outlined" onClick={() => void load()} disabled={busy}>
                        Odśwież
                    </Button>
                </Stack>
            </Stack>

            {(loading || busyCancelId != null) && <LinearProgress />}

            {pageError && (
                <Alert severity="error" onClose={() => setPageError(null)}>
                    {pageError}
                </Alert>
            )}

            {/* FILTERS (draft -> apply) */}
            <Paper variant="outlined" sx={{ p: 2 }}>
                <Stack spacing={2}>
                    <Stack
                        direction={{ xs: 'column', md: 'row' }}
                        spacing={2}
                        alignItems={{ md: 'center' }}
                    >
                        <FormControl size="small" sx={{ minWidth: 220 }} disabled={busy}>
                            <InputLabel>Status</InputLabel>
                            <Select
                                label="Status"
                                value={draftStatus}
                                onChange={(e) => setDraftStatus(e.target.value as StatusFilter)}
                            >
                                <MenuItem value="ALL">Wszystkie</MenuItem>
                                <MenuItem value="PENDING">Oczekujące</MenuItem>
                                <MenuItem value="CONFIRMED">Potwierdzone</MenuItem>
                                <MenuItem value="COMPLETED">Zakończone</MenuItem>
                                <MenuItem value="CANCELLED">Anulowane</MenuItem>
                                <MenuItem value="NO_SHOW">No-show</MenuItem>
                            </Select>
                        </FormControl>

                        <FormControl size="small" sx={{ minWidth: 260 }} disabled={busy}>
                            <InputLabel>Sortowanie</InputLabel>
                            <Select
                                label="Sortowanie"
                                value={draftOrdering}
                                onChange={(e) => setDraftOrdering(e.target.value as Ordering)}
                            >
                                <MenuItem value="start">Najbliższe terminy</MenuItem>
                                <MenuItem value="-start">Najdalsze terminy</MenuItem>
                                <MenuItem value="-created_at">Najnowsze rezerwacje</MenuItem>
                                <MenuItem value="created_at">Najstarsze rezerwacje</MenuItem>
                                <MenuItem value="status">Status (A→Z)</MenuItem>
                                <MenuItem value="-status">Status (Z→A)</MenuItem>
                            </Select>
                        </FormControl>

                        <Box sx={{ flex: 1 }} />

                        <Stack
                            direction="row"
                            spacing={1}
                            justifyContent={{ xs: 'stretch', md: 'flex-end' }}
                        >
                            <Button
                                variant="outlined"
                                onClick={clearFilters}
                                disabled={
                                    busy ||
                                    (!isDirty && statusFilter === 'ALL' && ordering === 'start')
                                }
                            >
                                Wyczyść filtry
                            </Button>
                            <Button
                                variant="contained"
                                onClick={applyFilters}
                                disabled={busy || !isDirty}
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

            {/* LIST */}
            {loading && results.length === 0 ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
                    <CircularProgress />
                </Box>
            ) : results.length === 0 ? (
                <Alert severity="info">{emptyText}</Alert>
            ) : (
                <Stack spacing={1.5}>
                    {results.map((a) => (
                        <Paper key={a.id} variant="outlined" sx={{ p: 2 }}>
                            <Stack spacing={1}>
                                <Stack
                                    direction={{ xs: 'column', sm: 'row' }}
                                    justifyContent="space-between"
                                    alignItems={{ xs: 'flex-start', sm: 'flex-start' }}
                                    spacing={1.5}
                                >
                                    <Box>
                                        <Typography fontWeight={900}>{a.service_name}</Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            Pracownik: {a.employee_name}
                                        </Typography>
                                    </Box>

                                    <Stack
                                        alignItems={{ xs: 'flex-start', sm: 'flex-end' }}
                                        spacing={0.5}
                                    >
                                        <Chip
                                            size="small"
                                            label={a.status_display || statusLabel(a.status)}
                                            color={statusChipColor(a.status)}
                                        />
                                        <Typography fontWeight={800}>
                                            {formatPrice(a.service_price)}
                                        </Typography>
                                    </Stack>
                                </Stack>

                                <Divider />

                                <Typography variant="body2">
                                    {formatPL(a.start)} – {formatPL(a.end)}
                                </Typography>

                                {canCancelClientUi(a)  && (
                                    <Box>
                                        <Button
                                            size="small"
                                            color="error"
                                            variant="outlined"
                                            disabled={busyCancelId === a.id || busy}
                                            onClick={() => openCancel(a)}
                                        >
                                            Anuluj wizytę
                                        </Button>
                                    </Box>
                                )}
                            </Stack>
                        </Paper>
                    ))}
                </Stack>
            )}

            {/* CANCEL DIALOG */}
            <Dialog open={cancelDialog.open} onClose={closeCancel} maxWidth="xs" fullWidth>
                <DialogTitle>Anulować wizytę?</DialogTitle>
                <DialogContent>
                    <Typography variant="body2" color="text.secondary">
                        Salon dostanie informację o rezygnacji z terminu.
                    </Typography>
                    {cancelDialog.appt ? (
                        <Box sx={{ mt: 2 }}>
                            <Typography fontWeight={800}>
                                {cancelDialog.appt.service_name}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                {formatPL(cancelDialog.appt.start)}
                            </Typography>
                        </Box>
                    ) : null}
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={closeCancel} disabled={busyCancelId != null}>
                        Wróć
                    </Button>
                    <Button
                        variant="contained"
                        color="error"
                        onClick={() => void confirmCancel()}
                        disabled={busyCancelId != null}
                        startIcon={
                            busyCancelId != null ? <CircularProgress size={18} /> : undefined
                        }
                    >
                        Anuluj
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
    );
}
