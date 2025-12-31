import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    Alert,
    Box,
    Typography,
    Snackbar,
    Stack,
    LinearProgress,
    CircularProgress,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button
} from '@mui/material';
import type { AlertColor } from '@mui/material/Alert';

import { appointmentsApi } from '@/api/appointments';
import { parseDrfError } from '@/utils/drfErrors';
import { Appointment, AppointmentStatus, DRFPaginated } from '@/types';

// Import Twoich nowych komponentów
import { ClientAppointmentCard } from './components/ClientAppointmentCard';
import { ClientAppointmentFilters } from './components/ClientAppointmentFilters';

type StatusFilter = AppointmentStatus | 'ALL';
type Ordering = 'start' | '-start' | 'status' | '-status' | 'created_at' | '-created_at';

type SnackState = { open: boolean; msg: string; severity: AlertColor };

const EMPTY_PAGE: DRFPaginated<Appointment> = {
    count: 0,
    next: null,
    previous: null,
    results: [],
};

export default function ClientAppointmentsPage(): JSX.Element {
    const location = useLocation();
    const navigate = useNavigate();

    // Stan danych i paginacji
    const [data, setData] = useState<DRFPaginated<Appointment>>(EMPTY_PAGE);
    const [page, setPage] = useState(1);

    // Filtry zastosowane (do API)
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
    const [ordering, setOrdering] = useState<Ordering>('start');

    // Filtry "robocze" (w UI przed kliknięciem Zastosuj)
    const [draftStatus, setDraftStatus] = useState<StatusFilter>('ALL');
    const [draftOrdering, setDraftOrdering] = useState<Ordering>('start');

    const [loading, setLoading] = useState(true);
    const [busyCancelId, setBusyCancelId] = useState<number | null>(null);
    const [pageError, setPageError] = useState<string | null>(null);
    const [snack, setSnack] = useState<SnackState>({ open: false, msg: '', severity: 'info' });

    const [cancelDialog, setCancelDialog] = useState<{ open: boolean; appt: Appointment | null }>({
        open: false,
        appt: null,
    });

    const busy = loading || busyCancelId != null;
    const isDirty = draftStatus !== statusFilter || draftOrdering !== ordering;
    const results = useMemo(() => data.results ?? [], [data.results]);

    // ✅ Obsługa powiadomienia po rezerwacji
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        if (params.get('msg') === 'reserved') {
            setSnack({ open: true, msg: 'Wizyta została zarezerwowana.', severity: 'success' });
            params.delete('msg');
            navigate({ pathname: location.pathname, search: params.toString() }, { replace: true });
        }
    }, [location.pathname, location.search, navigate]);

    // Ładowanie danych
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
        } catch (e) {
            setPageError(parseDrfError(e).message || 'Nie udało się pobrać wizyt.');
            setData(EMPTY_PAGE);
        } finally {
            setLoading(false);
        }
    }, [page, ordering, statusFilter]);

    useEffect(() => { void load(); }, [load]);

    // Akcja anulowania
    const confirmCancel = async () => {
        if (!cancelDialog.appt) return;
        const apptId = cancelDialog.appt.id;

        setBusyCancelId(apptId);
        try {
            const updated = await appointmentsApi.cancel(apptId);

            // Lokalna aktualizacja listy (optymistyczna)
            setData(prev => ({
                ...prev,
                results: prev.results.map(r => r.id === updated.id ? updated : r)
                    .filter(r => statusFilter === 'ALL' || r.status === statusFilter)
            }));

            setSnack({ open: true, msg: 'Wizyta została anulowana.', severity: 'success' });
            setCancelDialog({ open: false, appt: null });
        } catch (e) {
            setPageError(parseDrfError(e).message || 'Błąd podczas anulowania.');
        } finally {
            setBusyCancelId(null);
        }
    };

    // Obsługa filtrów
    const applyFilters = () => {
        setPage(1);
        setStatusFilter(draftStatus);
        setOrdering(draftOrdering);
    };

    const clearFilters = () => {
        setDraftStatus('ALL');
        setDraftOrdering('start');
        setStatusFilter('ALL');
        setOrdering('start');
        setPage(1);
    };

    return (
        <Stack spacing={2} sx={{ maxWidth: 980, mx: 'auto', p: { xs: 1.5, sm: 2.5 } }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                    <Typography variant="h5" fontWeight={900}>Moje wizyty</Typography>
                    <Typography variant="body2" color="text.secondary">Zarządzaj swoimi terminami</Typography>
                </Box>
                <Button variant="outlined" onClick={() => void load()} disabled={busy}>Odśwież</Button>
            </Box>

            {busy && <LinearProgress />}

            {pageError && <Alert severity="error" onClose={() => setPageError(null)}>{pageError}</Alert>}

            <ClientAppointmentFilters
                status={draftStatus}
                ordering={draftOrdering}
                onStatusChange={setDraftStatus}
                onOrderingChange={(val) => setDraftOrdering(val as Ordering)}
                onApply={applyFilters}
                onClear={clearFilters}
                onRefresh={load}
                busy={busy}
                isDirty={isDirty}
                count={data.count}
                page={page}
                onPageChange={setPage}
                canNext={!!data.next}
                canPrev={!!data.previous}
            />

            {loading && results.length === 0 ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}><CircularProgress /></Box>
            ) : results.length === 0 ? (
                <Alert severity="info">Brak wizyt do wyświetlenia.</Alert>
            ) : (
                <Stack spacing={1.5}>
                    {results.map((a) => (
                        <ClientAppointmentCard
                            key={a.id}
                            appointment={a}
                            onCancel={(appt) => setCancelDialog({ open: true, appt })}
                            busy={busyCancelId === a.id}
                        />
                    ))}
                </Stack>
            )}

            {/* Dialog potwierdzenia anulowania */}
            <Dialog open={cancelDialog.open} onClose={() => !busy && setCancelDialog({ open: false, appt: null })}>
                <DialogTitle>Anulować wizytę?</DialogTitle>
                <DialogContent>
                    <Typography>Czy na pewno chcesz zrezygnować z wizyty: <strong>{cancelDialog.appt?.service_name}</strong>?</Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setCancelDialog({ open: false, appt: null })} disabled={busy}>Wróć</Button>
                    <Button variant="contained" color="error" onClick={() => void confirmCancel()} disabled={busy}>
                        {busy ? <CircularProgress size={20} /> : 'Potwierdzam anulowanie'}
                    </Button>
                </DialogActions>
            </Dialog>

            <Snackbar
                open={snack.open}
                autoHideDuration={3000}
                onClose={() => setSnack(p => ({ ...p, open: false }))}
            >
                <Alert severity={snack.severity} sx={{ width: '100%' }}>{snack.msg}</Alert>
            </Snackbar>
        </Stack>
    );
}