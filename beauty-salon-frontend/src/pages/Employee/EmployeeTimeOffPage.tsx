// EmployeeTimeOffPage.tsx
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
import Pagination from '@mui/material/Pagination';

import { timeOffApi } from '@/api/timeOff';
import type { DRFPaginated, TimeOff, TimeOffStatus } from '@/types';
import { parseDrfError } from '@/utils/drfErrors';

type StatusFilter = TimeOffStatus | 'ALL';
type SnackState = { open: boolean; msg: string; severity: AlertColor };

const EMPTY_PAGE: DRFPaginated<TimeOff> = { count: 0, next: null, previous: null, results: [] };

function toYmd(d: Date): string {
    const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function parseYmdOrNull(v: string): Date | null {
    if (!v) return null;
    const [y, m, d] = v.split('-').map(Number);
    if (!y || !m || !d) return null;
    const dt = new Date(y, m - 1, d);
    return Number.isNaN(dt.getTime()) ? null : dt;
}

function statusLabel(status: StatusFilter): string {
    switch (status) {
        case 'ALL':
            return 'Wszystkie';
        case 'PENDING':
            return 'Oczekujące';
        case 'APPROVED':
            return 'Zaakceptowane';
        case 'REJECTED':
            return 'Odrzucone';
        case 'CANCELLED':
            return 'Anulowane';
        default:
            return status;
    }
}

function StatusChip({ status, label }: { status: TimeOffStatus; label: string }) {
    switch (status) {
        case 'PENDING':
            return (
                <Chip label={label || 'Oczekuje'} color="warning" size="small" variant="outlined" />
            );
        case 'APPROVED':
            return (
                <Chip
                    label={label || 'Zaakceptowany'}
                    color="success"
                    size="small"
                    variant="outlined"
                />
            );
        case 'REJECTED':
            return (
                <Chip label={label || 'Odrzucony'} color="error" size="small" variant="outlined" />
            );
        case 'CANCELLED':
            return (
                <Chip
                    label={label || 'Anulowany'}
                    color="default"
                    size="small"
                    variant="outlined"
                />
            );
        default:
            return <Chip label={label || status} size="small" variant="outlined" />;
    }
}

export default function EmployeeTimeOffPage(): JSX.Element {
    const [data, setData] = useState<DRFPaginated<TimeOff>>(EMPTY_PAGE);
    const [page, setPage] = useState(1);

    // ✅ APPLIED (to naprawdę wysyłamy do backendu)
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
    const [search, setSearch] = useState('');

    // ✅ DRAFT (UI – nie powoduje przeładowań)
    const [draftStatus, setDraftStatus] = useState<StatusFilter>('ALL');
    const [draftSearch, setDraftSearch] = useState('');

    const isDirty = draftStatus !== statusFilter || draftSearch !== search;

    const ordering = '-created_at';

    // loading rozbijamy na: initial + refresh (żeby nie “czyścić” widoku)
    const [initialLoading, setInitialLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const [submitting, setSubmitting] = useState(false);
    const [pageError, setPageError] = useState<string | null>(null);
    const [snack, setSnack] = useState<SnackState>({ open: false, msg: '', severity: 'info' });

    // new request form
    const [from, setFrom] = useState<Date | null>(new Date());
    const [to, setTo] = useState<Date | null>(new Date());
    const [reason, setReason] = useState('');

    // cancel dialog
    const [cancelOpen, setCancelOpen] = useState(false);
    const [cancelTarget, setCancelTarget] = useState<TimeOff | null>(null);

    const busy = submitting || refreshing || initialLoading;

    const items = useMemo(() => data.results ?? [], [data.results]);

    const isValidRange = useMemo(() => {
        if (!from || !to) return false;
        return from.getTime() <= to.getTime();
    }, [from, to]);

    const totalPages = useMemo(() => Math.max(1, Math.ceil((data.count ?? 0) / 10)), [data.count]);

    const load = useCallback(
        async (mode: 'initial' | 'refresh' = 'refresh') => {
            setPageError(null);

            if (mode === 'initial') setInitialLoading(true);
            else setRefreshing(true);

            try {
                const res = await timeOffApi.list({
                    page,
                    ordering,
                    status: statusFilter === 'ALL' ? undefined : statusFilter,
                    search: search.trim() || undefined,
                });
                setData(res);
            } catch (e: unknown) {
                const parsed = parseDrfError(e);
                setPageError(parsed.message || 'Nie udało się pobrać wniosków urlopowych.');
                // ✅ nie czyścimy listy na refresh – żeby “nie przeładowywało”
                if (mode === 'initial') setData(EMPTY_PAGE);
            } finally {
                if (mode === 'initial') setInitialLoading(false);
                else setRefreshing(false);
            }
        },
        [ordering, page, search, statusFilter],
    );

    useEffect(() => {
        void load('initial');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ✅ przeładowanie tylko gdy zmieni się APPLIED status/search albo page
    useEffect(() => {
        // po starcie i tak już load("initial") poleciał
        if (initialLoading) return;
        void load('refresh');
    }, [page, statusFilter, search]); // <- UWAGA: to są APPLIED, nie draft

    const applyFilters = () => {
        if (!isDirty) return;
        setPage(1); // bo zmieniłeś filtr
        setStatusFilter(draftStatus);
        setSearch(draftSearch);
    };

    const clearFilters = () => {
        setDraftStatus('ALL');
        setDraftSearch('');
        setPage(1);
        setStatusFilter('ALL');
        setSearch('');
    };

    const submit = useCallback(async () => {
        setPageError(null);

        if (!from || !to) {
            setPageError('Wybierz datę rozpoczęcia i zakończenia.');
            return;
        }
        if (!isValidRange) {
            setPageError('Data „od” nie może być późniejsza niż data „do”.');
            return;
        }

        setSubmitting(true);
        try {
            await timeOffApi.create({
                date_from: toYmd(from),
                date_to: toYmd(to),
                reason: reason.trim() || undefined,
            });

            setSnack({ open: true, msg: 'Wniosek urlopowy został wysłany.', severity: 'success' });
            setReason('');
            setPage(1);
            await load('refresh');
        } catch (e: unknown) {
            const parsed = parseDrfError(e);
            setPageError(parsed.message || 'Nie udało się wysłać wniosku. Spróbuj ponownie.');
        } finally {
            setSubmitting(false);
        }
    }, [from, to, isValidRange, reason, load]);

    const openCancel = (x: TimeOff) => {
        if (!x.can_cancel) return;
        setCancelTarget(x);
        setCancelOpen(true);
    };

    const closeCancel = () => {
        if (submitting) return;
        setCancelOpen(false);
        setCancelTarget(null);
    };

    const confirmCancel = async () => {
        if (!cancelTarget) return;

        setSubmitting(true);
        setPageError(null);

        try {
            await timeOffApi.cancel(cancelTarget.id);
            setSnack({ open: true, msg: 'Wniosek został anulowany.', severity: 'success' });
            closeCancel();
            await load('refresh');
        } catch (e: unknown) {
            const parsed = parseDrfError(e);
            setPageError(parsed.message || 'Nie udało się anulować wniosku.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
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
            {(refreshing || submitting) && <LinearProgress />}

            <Stack
                direction={{ xs: 'column', md: 'row' }}
                spacing={2}
                justifyContent="space-between"
                alignItems={{ md: 'center' }}
            >
                <Box>
                    <Typography variant="h5" fontWeight={900}>
                        Moje wnioski urlopowe
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        Złóż wniosek i sprawdzaj jego status.
                    </Typography>
                </Box>

                <Button variant="outlined" onClick={() => void load('refresh')} disabled={busy}>
                    Odśwież
                </Button>
            </Stack>

            {pageError && (
                <Alert severity="error" onClose={() => setPageError(null)}>
                    {pageError}
                </Alert>
            )}

            {/* NEW REQUEST */}
            <Paper variant="outlined" sx={{ p: 2 }}>
                <Stack spacing={2}>
                    <Typography fontWeight={900}>Nowy wniosek</Typography>

                    <Stack
                        direction={{ xs: 'column', md: 'row' }}
                        spacing={2}
                        alignItems={{ md: 'center' }}
                    >
                        <TextField
                            size="small"
                            type="date"
                            label="Data od"
                            value={from ? toYmd(from) : ''}
                            onChange={(e) => setFrom(parseYmdOrNull(e.target.value))}
                            InputLabelProps={{ shrink: true }}
                            disabled={busy}
                            sx={{ width: { xs: '100%', md: 200 } }}
                        />

                        <TextField
                            size="small"
                            type="date"
                            label="Data do"
                            value={to ? toYmd(to) : ''}
                            onChange={(e) => setTo(parseYmdOrNull(e.target.value))}
                            InputLabelProps={{ shrink: true }}
                            disabled={busy}
                            sx={{ width: { xs: '100%', md: 200 } }}
                        />

                        <TextField
                            size="small"
                            label="Powód (opcjonalnie)"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            disabled={busy}
                            sx={{ flex: 1, minWidth: { md: 260 } }}
                            placeholder="np. lekarz, wyjazd…"
                        />

                        <Button
                            variant="contained"
                            onClick={() => void submit()}
                            disabled={busy || !isValidRange}
                        >
                            Wyślij wniosek
                        </Button>
                    </Stack>

                    {!isValidRange && (
                        <Alert severity="warning" sx={{ mb: 0 }}>
                            Sprawdź zakres dat — data „od” nie może być późniejsza niż data „do”.
                        </Alert>
                    )}
                </Stack>
            </Paper>

            {/* FILTERS + LIST */}
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
                                <MenuItem value="APPROVED">Zaakceptowane</MenuItem>
                                <MenuItem value="REJECTED">Odrzucone</MenuItem>
                                <MenuItem value="CANCELLED">Anulowane</MenuItem>
                            </Select>
                        </FormControl>

                        <TextField
                            size="small"
                            label="Szukaj w powodzie"
                            value={draftSearch}
                            onChange={(e) => setDraftSearch(e.target.value)}
                            disabled={busy}
                            sx={{ minWidth: 240 }}
                            placeholder="np. lekarz, wyjazd…"
                        />

                        <Box sx={{ flex: 1 }} />

                        <Stack direction="row" spacing={1}>
                            <Button
                                variant="text"
                                onClick={clearFilters}
                                disabled={busy && !isDirty}
                            >
                                Wyczyść
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
                        direction="row"
                        spacing={1}
                        alignItems="center"
                        flexWrap="wrap"
                        useFlexGap
                    >
                        <Chip
                            size="small"
                            variant="outlined"
                            label={`Status: ${statusLabel(statusFilter)}`}
                        />
                        {search.trim() ? (
                            <Chip
                                size="small"
                                variant="outlined"
                                label={`Szukaj: „${search.trim()}”`}
                            />
                        ) : null}
                    </Stack>

                    <Paper variant="outlined" sx={{ p: 2 }}>
                        {initialLoading ? (
                            <Stack direction="row" spacing={2} alignItems="center">
                                <CircularProgress size={22} />
                                <Typography color="text.secondary">Ładowanie wniosków…</Typography>
                            </Stack>
                        ) : items.length === 0 ? (
                            <Alert severity="info" sx={{ mb: 0 }}>
                                Brak wniosków do wyświetlenia.
                            </Alert>
                        ) : (
                            <Stack spacing={1}>
                                {items.map((x) => (
                                    <Paper key={x.id} variant="outlined" sx={{ p: 1.5 }}>
                                        <Stack
                                            direction={{ xs: 'column', sm: 'row' }}
                                            spacing={1}
                                            justifyContent="space-between"
                                        >
                                            <Box>
                                                <Typography fontWeight={900}>
                                                    {x.date_from} → {x.date_to}
                                                </Typography>
                                                {x.reason ? (
                                                    <Typography
                                                        variant="body2"
                                                        color="text.secondary"
                                                        sx={{ mt: 0.25 }}
                                                    >
                                                        {x.reason}
                                                    </Typography>
                                                ) : (
                                                    <Typography
                                                        variant="body2"
                                                        color="text.disabled"
                                                        sx={{ mt: 0.25 }}
                                                    >
                                                        Brak podanego powodu
                                                    </Typography>
                                                )}
                                            </Box>

                                            <Stack
                                                direction="row"
                                                spacing={1}
                                                alignItems="center"
                                                justifyContent="flex-end"
                                            >
                                                <StatusChip
                                                    status={x.status}
                                                    label={x.status_display}
                                                />
                                                {x.can_cancel && (
                                                    <Button
                                                        size="small"
                                                        color="error"
                                                        variant="outlined"
                                                        disabled={busy}
                                                        onClick={() => openCancel(x)}
                                                    >
                                                        Anuluj
                                                    </Button>
                                                )}
                                            </Stack>
                                        </Stack>
                                    </Paper>
                                ))}
                            </Stack>
                        )}
                    </Paper>

                    <Stack
                        direction={{ xs: 'column', sm: 'row' }}
                        spacing={1}
                        justifyContent="space-between"
                        alignItems={{ sm: 'center' }}
                    >
                        <Typography variant="body2" color="text.secondary">
                            Łącznie: {data.count} • Strona: {page} / {totalPages}
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

            {/* CANCEL DIALOG */}
            <Dialog open={cancelOpen} onClose={closeCancel} maxWidth="xs" fullWidth>
                <DialogTitle>Anulować wniosek?</DialogTitle>
                <DialogContent dividers>
                    <Typography variant="body2" color="text.secondary">
                        Jeśli anulujesz wniosek, administrator nie będzie go już rozpatrywać.
                    </Typography>

                    {cancelTarget ? (
                        <Box sx={{ mt: 2 }}>
                            <Typography fontWeight={900}>
                                {cancelTarget.date_from} → {cancelTarget.date_to}
                            </Typography>
                            {cancelTarget.reason ? (
                                <Typography variant="body2" color="text.secondary">
                                    {cancelTarget.reason}
                                </Typography>
                            ) : null}
                        </Box>
                    ) : null}
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={closeCancel} disabled={submitting}>
                        Wróć
                    </Button>
                    <Button
                        variant="contained"
                        color="error"
                        onClick={() => void confirmCancel()}
                        disabled={submitting}
                        startIcon={submitting ? <CircularProgress size={18} /> : undefined}
                    >
                        Anuluj wniosek
                    </Button>
                </DialogActions>
            </Dialog>

            {/* SNACKBAR */}
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
