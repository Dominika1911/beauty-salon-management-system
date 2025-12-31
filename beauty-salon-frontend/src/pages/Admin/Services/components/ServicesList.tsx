import React from 'react';
import {
    Box,
    Button,
    Chip,
    Paper,
    Stack,
    Tooltip,
    Typography,
    Pagination,
} from '@mui/material';

import type { Service } from '@/types';

type Props = {
    items: Service[];
    loading: boolean;
    busy: boolean;

    hasActiveFiltersApplied: boolean;

    openCreate: () => void;
    openEditDialog: (s: Service) => void;
    toggleActive: (s: Service) => Promise<void>;

    togglingId: number | null;

    pageCount: number;
    page: number;
    setPage: (p: number) => void;

    resetFilters: () => void;
};

export default function ServicesList(props: Props): JSX.Element {
    const {
        items,
        loading,
        busy,
        hasActiveFiltersApplied,
        openCreate,
        openEditDialog,
        toggleActive,
        togglingId,
        pageCount,
        page,
        setPage,
        resetFilters,
    } = props;

    if (!loading && items.length === 0) {
        return (
            <Box sx={{ py: 4 }}>
                <Typography variant="h6">Brak danych</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    {hasActiveFiltersApplied
                        ? 'Nie znaleziono usług dla wybranych filtrów. Zmień filtry i kliknij „Zastosuj”.'
                        : 'Nie masz jeszcze żadnych usług. Dodaj pierwszą usługę, aby rozpocząć.'}
                </Typography>

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 2 }}>
                    {hasActiveFiltersApplied && (
                        <Button variant="outlined" onClick={resetFilters} disabled={busy}>
                            Wyczyść filtry
                        </Button>
                    )}
                    <Button variant="contained" onClick={openCreate} disabled={busy}>
                        Dodaj usługę
                    </Button>
                </Stack>
            </Box>
        );
    }

    return (
        <Stack spacing={1.5}>
            {items.map((s) => {
                const isToggling = togglingId === s.id;

                return (
                    <Paper key={s.id} variant="outlined" sx={{ p: 2, opacity: busy && !isToggling ? 0.75 : 1 }}>
                        <Stack
                            direction={{ xs: 'column', sm: 'row' }}
                            justifyContent="space-between"
                            alignItems={{ xs: 'stretch', sm: 'center' }}
                            spacing={1.5}
                        >
                            <Box sx={{ minWidth: 0 }}>
                                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                                    <Typography fontWeight={700} sx={{ wordBreak: 'break-word' }}>
                                        {s.name}
                                    </Typography>

                                    <Chip
                                        size="small"
                                        label={s.is_active ? 'Aktywna' : 'Wyłączona'}
                                        color={s.is_active ? 'success' : 'default'}
                                        variant={s.is_active ? 'filled' : 'outlined'}
                                    />

                                    {s.category ? (
                                        <Chip size="small" label={s.category} variant="outlined" />
                                    ) : null}
                                </Stack>

                                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                    {s.duration_minutes} min • {s.price} zł
                                </Typography>

                                {s.description ? (
                                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                                        {s.description}
                                    </Typography>
                                ) : null}
                            </Box>

                            <Stack direction="row" spacing={1} justifyContent={{ xs: 'flex-start', sm: 'flex-end' }}>
                                <Button onClick={() => openEditDialog(s)} disabled={busy}>
                                    Edytuj
                                </Button>

                                <Tooltip
                                    title={
                                        s.is_active
                                            ? 'Wyłączy usługę (nie będzie dostępna w rezerwacji)'
                                            : 'Włączy usługę'
                                    }
                                >
                                    <span>
                                        <Button
                                            color={s.is_active ? 'error' : 'success'}
                                            variant="outlined"
                                            onClick={() => void toggleActive(s)}
                                            disabled={busy}
                                        >
                                            {isToggling ? 'Zmieniam...' : s.is_active ? 'Wyłącz' : 'Włącz'}
                                        </Button>
                                    </span>
                                </Tooltip>
                            </Stack>
                        </Stack>
                    </Paper>
                );
            })}

            {pageCount > 1 && (
                <Stack direction="row" justifyContent="center" sx={{ pt: 1 }}>
                    <Pagination
                        count={pageCount}
                        page={page}
                        onChange={(_, p) => setPage(p)}
                        disabled={loading}
                        showFirstButton
                        showLastButton
                    />
                </Stack>
            )}
        </Stack>
    );
}
