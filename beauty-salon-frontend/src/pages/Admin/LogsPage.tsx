import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Alert,
    Box,
    Button,
    Chip,
    FormControl,
    Grid,
    InputLabel,
    LinearProgress,
    MenuItem,
    Pagination,
    Paper,
    Select,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    Typography,
} from '@mui/material';

import type { DRFPaginated, SystemLog } from '@/types';
import { auditLogsApi } from '@/api/auditLogs';
import { parseDrfError } from '@/utils/drfErrors';

type ActionGroup =
    | 'ALL'
    | 'AUTH'
    | 'APPOINTMENTS'
    | 'SERVICES'
    | 'EMPLOYEES'
    | 'CLIENTS'
    | 'TIMEOFF'
    | 'SETTINGS'
    | 'OTHER';

type Ordering = 'timestamp' | '-timestamp';


function groupFromAction(action: string): ActionGroup {
    if (!action) return 'OTHER';
    const a = action.toUpperCase().trim();

    if (
        a.includes('AUTH') ||
        a.includes('LOGIN') ||
        a.includes('LOGOUT') ||
        a.includes('PASSWORD') ||
        a.includes('HASŁO')
    ) {
        return 'AUTH';
    }

    if (a.includes('APPOINTMENT') || a.includes('WIZYT') || a.includes('BOOKING')) {
        return 'APPOINTMENTS';
    }

    if (a.includes('SERVICE') || a.includes('USŁUG')) {
        return 'SERVICES';
    }

    if (a.includes('EMPLOYEE') || a.includes('PRAC')) {
        return 'EMPLOYEES';
    }

    if (a.includes('CLIENT') || a.includes('KLIENT')) {
        return 'CLIENTS';
    }

    if (a.includes('TIMEOFF') || a.includes('URLOP')) {
        return 'TIMEOFF';
    }

    if (a.includes('SETTINGS') || a.includes('USTAWIENIA')) {
        return 'SETTINGS';
    }

    return 'OTHER';
}

function chipPropsForGroup(g: ActionGroup) {
    switch (g) {
        case 'AUTH':
            return { color: 'primary' as const, label: 'Logowanie' };
        case 'APPOINTMENTS':
            return { color: 'success' as const, label: 'Wizyty' };
        case 'SERVICES':
            return { color: 'secondary' as const, label: 'Usługi' };
        case 'EMPLOYEES':
            return { color: 'info' as const, label: 'Pracownicy', variant: 'filled' as const };
        case 'CLIENTS':
            return { color: 'info' as const, label: 'Klienci', variant: 'outlined' as const };
        case 'TIMEOFF':
            return { color: 'warning' as const, label: 'Urlopy' };
        case 'SETTINGS':
            return { color: 'warning' as const, label: 'Ustawienia', variant: 'outlined' as const };
        default:
            return { color: 'default' as const, label: 'Inne' };
    }
}

const GROUP_LABEL: Record<ActionGroup, string> = {
    ALL: 'Wszystkie',
    AUTH: 'Logowanie',
    APPOINTMENTS: 'Wizyty',
    SERVICES: 'Usługi',
    EMPLOYEES: 'Pracownicy',
    CLIENTS: 'Klienci',
    TIMEOFF: 'Urlopy',
    SETTINGS: 'Ustawienia',
    OTHER: 'Inne',
};

function niceActor(s: string | null) {
    if (!s) return '-';
    return s.replace(/^(.+?)-0+(\d+)$/, '$1-$2');
}

export default function LogsPage(){
    const [data, setData] = useState<DRFPaginated<SystemLog> | null>(null);
    const [loading, setLoading] = useState(true);
    const [pageError, setPageError] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState<number | null>(null);

    const [actionFilter, setActionFilter] = useState('');
    const [performedBy, setPerformedBy] = useState<number | ''>('');
    const [targetUser, setTargetUser] = useState<number | ''>('');
    const [ordering, setOrdering] = useState<Ordering>('-timestamp');
    const [group, setGroup] = useState<ActionGroup>('ALL');
    const [search, setSearch] = useState('');

    const [draftActionFilter, setDraftActionFilter] = useState('');
    const [draftPerformedBy, setDraftPerformedBy] = useState<number | ''>('');
    const [draftTargetUser, setDraftTargetUser] = useState<number | ''>('');
    const [draftOrdering, setDraftOrdering] = useState<Ordering>('-timestamp');
    const [draftGroup, setDraftGroup] = useState<ActionGroup>('ALL');
    const [draftSearch, setDraftSearch] = useState('');

    const busy = loading;

    const load = useCallback(async () => {
        setLoading(true);
        setPageError(null);
        try {
            const res = await auditLogsApi.list({
                page,
                ordering,
                action: actionFilter || undefined,
                performed_by: performedBy === '' ? undefined : performedBy,
                target_user: targetUser === '' ? undefined : targetUser,
            });
            setData(res);
            const len = res.results?.length ?? 0;
            if (len > 0) setPageSize((p) => p ?? len);
        } catch (e: unknown) {
            const parsed = parseDrfError(e);
            setPageError(parsed.message || 'Błąd pobierania danych.');
        } finally {
            setLoading(false);
        }
    }, [page, ordering, actionFilter, performedBy, targetUser]);

    useEffect(() => {
        void load();
    }, [load]);

    useEffect(() => {
        setDraftActionFilter(actionFilter);
        setDraftPerformedBy(performedBy);
        setDraftTargetUser(targetUser);
        setDraftOrdering(ordering);
        setDraftGroup(group);
        setDraftSearch(search);
    }, [actionFilter, performedBy, targetUser, ordering, group, search]);

    const hasUnappliedChanges = useMemo(
        () =>
            draftActionFilter !== actionFilter ||
            draftPerformedBy !== performedBy ||
            draftTargetUser !== targetUser ||
            draftOrdering !== ordering ||
            draftGroup !== group ||
            draftSearch !== search,
        [
            draftActionFilter,
            actionFilter,
            draftPerformedBy,
            performedBy,
            draftTargetUser,
            targetUser,
            draftOrdering,
            ordering,
            draftGroup,
            group,
            draftSearch,
            search,
        ],
    );

    const applyFilters = () => {
        setPage(1);
        setActionFilter(draftActionFilter);
        setPerformedBy(draftPerformedBy);
        setTargetUser(draftTargetUser);
        setOrdering(draftOrdering);
        setGroup(draftGroup);
        setSearch(draftSearch);
    };

    const resetFilters = () => {
        const defaultOrdering = '-timestamp';
        setDraftActionFilter('');
        setDraftPerformedBy('');
        setDraftTargetUser('');
        setDraftOrdering(defaultOrdering);
        setDraftGroup('ALL');
        setDraftSearch('');
        setPage(1);
        setActionFilter('');
        setPerformedBy('');
        setTargetUser('');
        setOrdering(defaultOrdering);
        setGroup('ALL');
        setSearch('');
    };

    const rows = useMemo(() => {
        const base = data?.results ?? [];
        const s = search.trim().toLowerCase();
        return base.filter((l) => {
            const g = groupFromAction(l.action_display || l.action);
            if (group !== 'ALL' && g !== group) return false;
            if (!s) return true;
            const hay = [
                l.action_display,
                l.action,
                l.performed_by_username,
                l.target_user_username,
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();
            return hay.includes(s);
        });
    }, [data, group, search]);

    const totalPages = useMemo(() => {
        const count = data?.count ?? 0;
        const size = pageSize ?? 10;
        return Math.max(1, Math.ceil(count / size));
    }, [data, pageSize]);

    return (
        <Stack spacing={2} sx={{ width: '100%', maxWidth: 1200, mx: 'auto', px: 2, py: 3 }}>
            <Box
                sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 2,
                }}
            >
                <Box>
                    <Typography variant="h5" fontWeight={900}>
                        Logi systemowe
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        Pełna spójność z bazą danych klientów i pracowników.
                    </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                    Łącznie: {data?.count ?? '—'}
                </Typography>
            </Box>

            {pageError && <Alert severity="error">{pageError}</Alert>}

            <Paper variant="outlined" sx={{ p: 2, position: 'relative' }}>
                {loading && (
                    <LinearProgress sx={{ position: 'absolute', top: 0, left: 0, right: 0 }} />
                )}
                <Stack spacing={2} sx={{ pt: 1 }}>
                    <Grid container spacing={2}>
                        <Grid item xs={12} sm={6} md={3}>
                            <FormControl size="small" fullWidth>
                                <InputLabel>Kategoria</InputLabel>
                                <Select
                                    label="Kategoria"
                                    value={draftGroup}
                                    onChange={(e) => setDraftGroup(e.target.value as ActionGroup)}
                                >
                                    {Object.entries(GROUP_LABEL).map(([val, lab]) => (
                                        <MenuItem key={val} value={val}>
                                            {lab}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} sm={6} md={6}>
                            <TextField
                                size="small"
                                fullWidth
                                label="Szukaj w treści..."
                                value={draftSearch}
                                onChange={(e) => setDraftSearch(e.target.value)}
                            />
                        </Grid>
                        <Grid item xs={12} md={3}>
                            <Stack direction="row" spacing={1}>
                                <Button variant="outlined" fullWidth onClick={resetFilters}>
                                    Reset
                                </Button>
                                <Button
                                    variant="contained"
                                    fullWidth
                                    onClick={applyFilters}
                                    disabled={!hasUnappliedChanges}
                                >
                                    Filtruj
                                </Button>
                            </Stack>
                        </Grid>
                    </Grid>

                    <TableContainer component={Paper} variant="outlined">
                        <Table size="small">
                            <TableHead>
                                <TableRow sx={{ backgroundColor: 'rgba(0,0,0,0.02)' }}>
                                    <TableCell>Czas</TableCell>
                                    <TableCell>Grupa</TableCell>
                                    <TableCell>Akcja</TableCell>
                                    <TableCell>Wykonał</TableCell>
                                    <TableCell>Dotyczy</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {rows.length === 0 && !loading ? (
                                    <TableRow>
                                        <TableCell colSpan={5} align="center" sx={{ py: 3 }}>
                                            Brak wyników
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    rows.map((l) => {
                                        const badge = chipPropsForGroup(
                                            groupFromAction(l.action_display || l.action),
                                        );
                                        return (
                                            <TableRow key={l.id} hover>
                                                <TableCell sx={{ whiteSpace: 'nowrap' }}>
                                                    {new Date(l.timestamp).toLocaleString('pl-PL')}
                                                </TableCell>
                                                <TableCell>
                                                    <Chip
                                                        size="small"
                                                        color={badge.color}
                                                        label={badge.label}
                                                        variant={badge.variant || 'filled'}
                                                        sx={{ fontWeight: 600 }}
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Typography variant="body2" fontWeight={700}>
                                                        {l.action_display || l.action}
                                                    </Typography>
                                                    <Typography
                                                        variant="caption"
                                                        color="text.disabled"
                                                    >
                                                        Kod: {l.action}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell>
                                                    {l.performed_by_username
                                                        ? niceActor(l.performed_by_username)
                                                        : 'System'}
                                                </TableCell>
                                                <TableCell>
                                                    {l.target_user_username ? (
                                                        <Typography
                                                            variant="body2"
                                                            color="primary.main"
                                                            fontWeight={600}
                                                        >
                                                            {niceActor(l.target_user_username)}
                                                        </Typography>
                                                    ) : (
                                                        '-'
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>

                    <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                        <Pagination
                            count={totalPages}
                            page={page}
                            onChange={(_, p) => setPage(p)}
                            color="primary"
                            disabled={busy}
                        />
                    </Box>
                </Stack>
            </Paper>
        </Stack>
    );
}
