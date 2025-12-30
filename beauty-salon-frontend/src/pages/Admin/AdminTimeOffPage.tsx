// AdminTimeOffPage.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Alert,
    Box,
    Button,
    ButtonGroup,
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
} from '@mui/material';
import Pagination from '@mui/material/Pagination';

import { timeOffApi } from '@/api/timeOff';
import { employeesApi } from '@/api/employees';
import type { EmployeeListItem } from '@/api/employees';
import type { DRFPaginated, TimeOff, TimeOffStatus } from '@/types';
import { parseDrfError } from '@/utils/drfErrors';

type StatusFilter = TimeOffStatus | 'ALL';

type SnackbarState = { open: boolean; msg: string; severity: 'success' | 'info' | 'error' };

function isValidYmd(s: string): boolean {
    return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function StatusChip({ status, label }: { status: TimeOffStatus; label: string }) {
    switch (status) {
        case 'PENDING':
            return <Chip label={label} color="warning" size="small" />;
        case 'APPROVED':
            return <Chip label={label} color="success" size="small" />;
        case 'REJECTED':
            return <Chip label={label} color="error" size="small" />;
        case 'CANCELLED':
            return <Chip label={label} color="default" size="small" />;
        default:
            return <Chip label={label} size="small" />;
    }
}

export default function AdminTimeOffsPage(): JSX.Element {
    const [data, setData] = useState<DRFPaginated<TimeOff> | null>(null);
    const [page, setPage] = useState(1);

    const [employees, setEmployees] = useState<EmployeeListItem[]>([]);
    const [loadingEmployees, setLoadingEmployees] = useState(true);

    // ---- Draft filters (bez requestów) ----
    const [draftStatusFilter, setDraftStatusFilter] = useState<StatusFilter>('ALL');
    const [draftEmployeeId, setDraftEmployeeId] = useState<string>('');
    const [draftSearch, setDraftSearch] = useState('');
    const [draftOrdering, setDraftOrdering] = useState('-created_at');
    const [draftDateFrom, setDraftDateFrom] = useState<string>('');
    const [draftDateTo, setDraftDateTo] = useState<string>('');

    // ---- Applied filters (to idzie do backendu) ----
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
    const [employeeId, setEmployeeId] = useState<string>('');
    const [search, setSearch] = useState('');
    const [ordering, setOrdering] = useState('-created_at');
    const [dateFrom, setDateFrom] = useState<string>('');
    const [dateTo, setDateTo] = useState<string>('');

    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);

    const [pageError, setPageError] = useState<string | null>(null);
    const [snack, setSnack] = useState<SnackbarState>({ open: false, msg: '', severity: 'info' });

    const [pageSize, setPageSize] = useState<number | null>(null);

    const busy = loading || actionLoading;

    const employeeMap = useMemo(() => {
        const m = new Map<number, EmployeeListItem>();
        for (const e of employees) m.set(e.id, e);
        return m;
    }, [employees]);

    const isDirty =
        draftStatusFilter !== statusFilter ||
        draftEmployeeId !== employeeId ||
        draftSearch !== search ||
        draftOrdering !== ordering ||
        draftDateFrom !== dateFrom ||
        draftDateTo !== dateTo;

    const hasActiveFiltersApplied =
        statusFilter !== 'ALL' ||
        Boolean(employeeId) ||
        Boolean(search.trim()) ||
        ordering !== '-created_at' ||
        Boolean(dateFrom) ||
        Boolean(dateTo);

    const loadEmployees = useCallback(async () => {
        setLoadingEmployees(true);
        try {
            const res = await employeesApi.list({ page: 1, is_active: true });
            setEmployees(res.results ?? []);
        } catch {
            setEmployees([]);
        } finally {
            setLoadingEmployees(false);
        }
    }, []);

    const load = useCallback(async () => {
        setLoading(true);
        setPageError(null);

        try {
            const res = await timeOffApi.list({
                page,
                ordering,
                status: statusFilter === 'ALL' ? undefined : statusFilter,
                employee: employeeId ? Number(employeeId) : undefined,
                search: search.trim() || undefined,
                date_from: dateFrom && isValidYmd(dateFrom) ? dateFrom : undefined,
                date_to: dateTo && isValidYmd(dateTo) ? dateTo : undefined,
            });

            setData(res);

            if (page === 1 && res.results?.length) {
                setPageSize(res.results.length);
            }
        } catch (e: unknown) {
            const parsed = parseDrfError(e);
            setPageError(parsed.message || 'Nie udało się pobrać wniosków. Spróbuj ponownie.');
            setData({ count: 0, next: null, previous: null, results: [] });
        } finally {
            setLoading(false);
        }
    }, [page, ordering, statusFilter, employeeId, search, dateFrom, dateTo]);

    useEffect(() => {
        void loadEmployees();
    }, [loadEmployees]);

    useEffect(() => {
        void load();
    }, [load]);

    const totalPages = useMemo(() => {
        const count = data?.count ?? 0;
        const ps = pageSize ?? 10;
        return Math.max(1, Math.ceil(count / ps));
    }, [data, pageSize]);

    const emptyInfo = useMemo(() => {
        if (loading) return null;
        const len = data?.results?.length ?? 0;
        if (len > 0) return null;
        if (hasActiveFiltersApplied)
            return 'Brak wyników dla podanych filtrów. Zmień filtry i kliknij „Zastosuj”.';
        return 'Brak wniosków urlopowych.';
    }, [loading, data, hasActiveFiltersApplied]);

    const applyFilters = () => {
        setPage(1);
        setStatusFilter(draftStatusFilter);
        setEmployeeId(draftEmployeeId);
        setSearch(draftSearch);
        setOrdering(draftOrdering);
        setDateFrom(draftDateFrom);
        setDateTo(draftDateTo);
    };

    const clearFilters = () => {
        setDraftStatusFilter('ALL');
        setDraftEmployeeId('');
        setDraftSearch('');
        setDraftOrdering('-created_at');
        setDraftDateFrom('');
        setDraftDateTo('');

        setPage(1);
        setStatusFilter('ALL');
        setEmployeeId('');
        setSearch('');
        setOrdering('-created_at');
        setDateFrom('');
        setDateTo('');
    };

    const runAction = useCallback(
        async (fn: (id: number) => Promise<TimeOff>, id: number, successMsg: string) => {
            setActionLoading(true);
            setPageError(null);

            try {
                await fn(id);
                setSnack({ open: true, msg: successMsg, severity: 'success' });
                await load();
            } catch (e: unknown) {
                const parsed = parseDrfError(e);
                const msg = parsed.message || 'Nie udało się wykonać operacji. Spróbuj ponownie.';
                setPageError(msg);
                setSnack({ open: true, msg, severity: 'error' });
            } finally {
                setActionLoading(false);
            }
        },
        [load],
    );

    return (
        <Stack spacing={2}>
            <Box>
                <Typography variant="h5" fontWeight={800}>
                    Wnioski urlopowe
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    Łącznie: {data?.count ?? '—'} • Strona: {page}
                </Typography>
            </Box>

            {pageError && (
                <Alert severity="error" onClose={() => setPageError(null)}>
                    {pageError}
                </Alert>
            )}

            <Paper sx={{ p: 2, position: 'relative' }} variant="outlined">
                {loading && (
                    <LinearProgress sx={{ position: 'absolute', left: 0, right: 0, top: 0 }} />
                )}

                <Stack spacing={2} sx={{ pt: loading ? 1 : 0 }}>
                    <Stack spacing={1.5}>
                        <Stack
                            direction={{ xs: 'column', md: 'row' }}
                            spacing={2}
                            alignItems={{ xs: 'stretch', md: 'center' }}
                        >
                            <FormControl size="small" sx={{ minWidth: 200 }} disabled={busy}>
                                <InputLabel>Status</InputLabel>
                                <Select
                                    label="Status"
                                    value={draftStatusFilter}
                                    onChange={(e) =>
                                        setDraftStatusFilter(e.target.value as StatusFilter)
                                    }
                                >
                                    <MenuItem value="ALL">Wszystkie</MenuItem>
                                    <MenuItem value="PENDING">Oczekujące</MenuItem>
                                    <MenuItem value="APPROVED">Zaakceptowane</MenuItem>
                                    <MenuItem value="REJECTED">Odrzucone</MenuItem>
                                    <MenuItem value="CANCELLED">Anulowane</MenuItem>
                                </Select>
                            </FormControl>

                            <FormControl size="small" sx={{ minWidth: 260 }} disabled={busy}>
                                <InputLabel>Pracownik</InputLabel>
                                <Select
                                    label="Pracownik"
                                    value={draftEmployeeId}
                                    onChange={(e) => setDraftEmployeeId(String(e.target.value))}
                                >
                                    <MenuItem value="">Wszyscy</MenuItem>
                                    {loadingEmployees ? (
                                        <MenuItem value="" disabled>
                                            Ładowanie listy…
                                        </MenuItem>
                                    ) : (
                                        employees.map((e) => (
                                            <MenuItem key={e.id} value={String(e.id)}>
                                                {e.first_name} {e.last_name}
                                                {'employee_number' in e && e.employee_number
                                                    ? ` (${e.employee_number})`
                                                    : ''}
                                            </MenuItem>
                                        ))
                                    )}
                                </Select>
                            </FormControl>

                            <TextField
                                size="small"
                                label="Szukaj"
                                value={draftSearch}
                                onChange={(e) => setDraftSearch(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
                                placeholder="Imię, nazwisko, powód…"
                                disabled={busy}
                                fullWidth
                            />

                            <TextField
                                size="small"
                                label="Data od"
                                type="date"
                                InputLabelProps={{ shrink: true }}
                                value={draftDateFrom}
                                onChange={(e) => setDraftDateFrom(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
                                disabled={busy}
                            />

                            <TextField
                                size="small"
                                label="Data do"
                                type="date"
                                InputLabelProps={{ shrink: true }}
                                value={draftDateTo}
                                onChange={(e) => setDraftDateTo(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
                                disabled={busy}
                            />

                            <FormControl size="small" sx={{ minWidth: 220 }} disabled={busy}>
                                <InputLabel>Sortuj</InputLabel>
                                <Select
                                    label="Sortuj"
                                    value={draftOrdering}
                                    onChange={(e) => setDraftOrdering(String(e.target.value))}
                                >
                                    <MenuItem value="-created_at">Ostatnio dodane</MenuItem>
                                    <MenuItem value="created_at">Najpierw dodane</MenuItem>
                                    <MenuItem value="date_from">Najbliższy start</MenuItem>
                                    <MenuItem value="-date_from">Najdalszy start</MenuItem>
                                    <MenuItem value="date_to">Najbliższy koniec</MenuItem>
                                    <MenuItem value="-date_to">Najdalszy koniec</MenuItem>
                                    <MenuItem value="status">Status A → Z</MenuItem>
                                    <MenuItem value="-status">Status Z → A</MenuItem>
                                </Select>
                            </FormControl>

                            <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
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
                    </Stack>

                    <Divider />

                    {loading && !data ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                            <CircularProgress />
                        </Box>
                    ) : emptyInfo ? (
                        <Alert severity="info">{emptyInfo}</Alert>
                    ) : (
                        <Stack spacing={1}>
                            {(data?.results ?? []).map((x) => {
                                const emp = employeeMap.get(x.employee);
                                const employeeHint =
                                    emp && 'employee_number' in emp && emp.employee_number
                                        ? ` (${emp.employee_number})`
                                        : '';

                                return (
                                    <Paper key={x.id} variant="outlined" sx={{ p: 1.75 }}>
                                        <Stack
                                            direction={{ xs: 'column', md: 'row' }}
                                            spacing={1.5}
                                            alignItems={{ md: 'center' }}
                                        >
                                            <Box sx={{ minWidth: 260 }}>
                                                <Typography
                                                    fontWeight={800}
                                                    sx={{ lineHeight: 1.2 }}
                                                >
                                                    {x.employee_name}
                                                    {employeeHint}
                                                </Typography>
                                                <Typography variant="body2" color="text.secondary">
                                                    {x.date_from} → {x.date_to}
                                                </Typography>
                                                <Typography
                                                    variant="body2"
                                                    sx={{ mt: 0.5 }}
                                                    color={
                                                        x.reason ? 'text.primary' : 'text.secondary'
                                                    }
                                                >
                                                    {x.reason || 'Brak powodu'}
                                                </Typography>
                                            </Box>

                                            <StatusChip
                                                status={x.status}
                                                label={x.status_display}
                                            />
                                            <Box sx={{ flex: 1 }} />

                                            <Box
                                                sx={{
                                                    display: 'flex',
                                                    justifyContent: {
                                                        xs: 'flex-start',
                                                        md: 'flex-end',
                                                    },
                                                    width: '100%',
                                                }}
                                            >
                                                <ButtonGroup
                                                    variant="outlined"
                                                    size="small"
                                                    disabled={busy}
                                                    sx={{
                                                        flexWrap: 'wrap',
                                                        '& .MuiButton-root': {
                                                            whiteSpace: 'nowrap',
                                                        },
                                                    }}
                                                >
                                                    <Button
                                                        variant="contained"
                                                        color="success"
                                                        disabled={busy || !x.can_approve}
                                                        onClick={() =>
                                                            void runAction(
                                                                timeOffApi.approve,
                                                                x.id,
                                                                'Wniosek zaakceptowany.',
                                                            )
                                                        }
                                                    >
                                                        Akceptuj
                                                    </Button>
                                                    <Button
                                                        color="error"
                                                        disabled={busy || !x.can_reject}
                                                        onClick={() =>
                                                            void runAction(
                                                                timeOffApi.reject,
                                                                x.id,
                                                                'Wniosek odrzucony.',
                                                            )
                                                        }
                                                    >
                                                        Odrzuć
                                                    </Button>
                                                </ButtonGroup>
                                            </Box>
                                        </Stack>
                                    </Paper>
                                );
                            })}
                        </Stack>
                    )}

                    <Divider />

                    <Stack
                        direction={{ xs: 'column', sm: 'row' }}
                        justifyContent="space-between"
                        alignItems={{ xs: 'stretch', sm: 'center' }}
                        spacing={1}
                    >
                        <Typography variant="body2" color="text.secondary">
                            Łącznie: {data?.count ?? 0}
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
}
