import React from 'react';
import {
    Button,
    Chip,
    Divider,
    FormControl,
    InputLabel,
    MenuItem,
    Select,
    Stack,
    TextField,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material/Select';

import type { IsActiveFilter, SortDir, SortKey } from '../types';
import { SORT_OPTIONS } from '../types';

type Props = {
    busy: boolean;

    // draft values
    draftQuery: string;
    setDraftQuery: (v: string) => void;

    draftCategory: string;
    setDraftCategory: (v: string) => void;

    draftIsActive: IsActiveFilter;
    setDraftIsActive: (v: IsActiveFilter) => void;

    draftSortKey: SortKey;
    setDraftSortKey: (v: SortKey) => void;

    draftSortDir: SortDir;
    setDraftSortDir: (v: SortDir) => void;

    // state chips
    hasActiveFiltersDraft: boolean;
    hasActiveFiltersApplied: boolean;
    hasUnappliedChanges: boolean;

    // actions
    applyFilters: () => void;
    resetFilters: () => void;
};

export default function ServicesFiltersPanel(props: Props): JSX.Element {
    const {
        busy,
        draftQuery,
        setDraftQuery,
        draftCategory,
        setDraftCategory,
        draftIsActive,
        setDraftIsActive,
        draftSortKey,
        setDraftSortKey,
        draftSortDir,
        setDraftSortDir,
        hasActiveFiltersDraft,
        hasActiveFiltersApplied,
        hasUnappliedChanges,
        applyFilters,
        resetFilters,
    } = props;

    const onDraftStatusChange = (e: SelectChangeEvent) => {
        setDraftIsActive(e.target.value as IsActiveFilter);
    };

    const onDraftSortKeyChange = (e: SelectChangeEvent) => {
        setDraftSortKey(e.target.value as SortKey);
    };

    const onDraftSortDirChange = (e: SelectChangeEvent) => {
        setDraftSortDir(e.target.value as SortDir);
    };

    return (
        <Stack spacing={2}>
            {/* Filtry (draft) */}
            <Stack
                direction={{ xs: 'column', md: 'row' }}
                spacing={2}
                alignItems={{ xs: 'stretch', md: 'center' }}
            >
                <TextField
                    label="Szukaj"
                    value={draftQuery}
                    onChange={(e) => setDraftQuery(e.target.value)}
                    fullWidth
                    disabled={busy}
                    placeholder="Nazwa, kategoria lub opis"
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') applyFilters();
                    }}
                />

                <TextField
                    label="Kategoria"
                    value={draftCategory}
                    onChange={(e) => setDraftCategory(e.target.value)}
                    disabled={busy}
                    sx={{ minWidth: { md: 220 } }}
                    placeholder="np. Kosmetyka"
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') applyFilters();
                    }}
                />

                <FormControl size="small" sx={{ minWidth: 170 }} disabled={busy}>
                    <InputLabel>Status</InputLabel>
                    <Select label="Status" value={draftIsActive} onChange={onDraftStatusChange}>
                        <MenuItem value="all">Wszystkie</MenuItem>
                        <MenuItem value="active">Aktywne</MenuItem>
                        <MenuItem value="disabled">Wyłączone</MenuItem>
                    </Select>
                </FormControl>

                <FormControl size="small" sx={{ minWidth: 200 }} disabled={busy}>
                    <InputLabel>Sortowanie</InputLabel>
                    <Select label="Sortowanie" value={draftSortKey} onChange={onDraftSortKeyChange}>
                        {SORT_OPTIONS.map((o) => (
                            <MenuItem key={o.value} value={o.value}>
                                {o.label}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>

                <FormControl size="small" sx={{ minWidth: 160 }} disabled={busy}>
                    <InputLabel>Kierunek</InputLabel>
                    <Select label="Kierunek" value={draftSortDir} onChange={onDraftSortDirChange}>
                        <MenuItem value="asc">Rosnąco</MenuItem>
                        <MenuItem value="desc">Malejąco</MenuItem>
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
                        <Chip
                            size="small"
                            color="warning"
                            label="Masz niezastosowane zmiany"
                            variant="outlined"
                        />
                    )}
                </Stack>

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                    <Button
                        variant="outlined"
                        onClick={resetFilters}
                        disabled={busy || (!hasActiveFiltersDraft && !hasActiveFiltersApplied)}
                    >
                        Wyczyść filtry
                    </Button>
                    <Button variant="contained" onClick={applyFilters} disabled={busy || !hasUnappliedChanges}>
                        Zastosuj
                    </Button>
                </Stack>
            </Stack>

            <Divider />
        </Stack>
    );
}
