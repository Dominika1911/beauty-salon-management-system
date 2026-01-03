import React from 'react';
import { Box, Button, Chip, FormControl, InputLabel, MenuItem, Paper, Select, Stack, TextField, Typography } from '@mui/material';
import type { Service } from '@/types';
import type { IsActiveFilter } from '../types';

type Props = {
    services: Service[];
    busy: boolean;

    draftSearch: string;
    setDraftSearch: (v: string) => void;

    draftIsActiveFilter: IsActiveFilter;
    setDraftIsActiveFilter: (v: IsActiveFilter) => void;

    draftServiceIdFilter: number | '';
    setDraftServiceIdFilter: (v: number | '') => void;

    hasActiveFiltersDraft: boolean;
    hasActiveFiltersApplied: boolean;
    hasUnappliedChanges: boolean;

    onApply: () => void;
    onReset: () => void;

    formatPLN: (v: string | number) => string;
};

export default function EmployeesFiltersPanel(props: Props): JSX.Element {
    const {
        services,
        busy,
        draftSearch,
        setDraftSearch,
        draftIsActiveFilter,
        setDraftIsActiveFilter,
        draftServiceIdFilter,
        setDraftServiceIdFilter,
        hasActiveFiltersDraft,
        hasActiveFiltersApplied,
        hasUnappliedChanges,
        onApply,
        onReset,
        formatPLN,
    } = props;

    return (
        <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack spacing={1.5}>
                <Stack
                    direction={{ xs: 'column', md: 'row' }}
                    spacing={2}
                    alignItems={{ xs: 'stretch', md: 'center' }}
                >
                    <TextField
                        label="Szukaj"
                        value={draftSearch}
                        onChange={(e) => setDraftSearch(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') onApply();
                        }}
                        placeholder="Nr, imię, nazwisko, login, e-mail…"
                        disabled={busy}
                        fullWidth
                    />

                    <FormControl sx={{ minWidth: 220 }} disabled={busy}>
                        <InputLabel id="is-active-label">Status</InputLabel>
                        <Select
                            labelId="is-active-label"
                            value={draftIsActiveFilter}
                            label="Status"
                            onChange={(e) => setDraftIsActiveFilter(e.target.value as IsActiveFilter)}
                        >
                            <MenuItem value="ALL">Wszystkie</MenuItem>
                            <MenuItem value="ACTIVE">Tylko aktywni</MenuItem>
                            <MenuItem value="INACTIVE">Tylko nieaktywni</MenuItem>
                        </Select>
                    </FormControl>

                    <FormControl sx={{ minWidth: 260 }} disabled={busy}>
                        <InputLabel id="service-filter-label">Usługa</InputLabel>
                        <Select
                            labelId="service-filter-label"
                            value={draftServiceIdFilter}
                            label="Usługa"
                            onChange={(e) =>
                                setDraftServiceIdFilter(e.target.value === '' ? '' : Number(e.target.value))
                            }
                        >
                            <MenuItem value="">Wszystkie</MenuItem>
                            {services.map((s) => (
                                <MenuItem key={s.id} value={s.id}>
                                    {s.name} ({formatPLN(s.price)})
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </Stack>

                <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={1}
                    alignItems={{ xs: 'stretch', sm: 'center' }}
                    justifyContent="space-between"
                >
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                        {hasActiveFiltersDraft && <Chip size="small" label="Ustawione filtry" />}
                        {hasUnappliedChanges && (
                            <Chip size="small" color="warning" label="Niezastosowane zmiany" variant="outlined" />
                        )}
                    </Stack>

                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                        <Button
                            variant="outlined"
                            onClick={onReset}
                            disabled={busy || (!hasActiveFiltersDraft && !hasActiveFiltersApplied)}
                        >
                            Wyczyść filtry
                        </Button>
                        <Button variant="contained" onClick={onApply} disabled={busy || !hasUnappliedChanges}>
                            Zastosuj
                        </Button>
                    </Stack>
                </Stack>

                <Box sx={{ display: 'none' }}>
                    <Typography variant="caption" />
                </Box>
            </Stack>
        </Paper>
    );
}
