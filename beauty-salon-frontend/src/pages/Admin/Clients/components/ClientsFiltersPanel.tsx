import React from 'react';
import {
    Button,
    Chip,
    FormControl,
    FormControlLabel,
    InputLabel,
    MenuItem,
    Paper,
    Select,
    Stack,
    Switch,
    TextField,
} from '@mui/material';
import { ORDERING_OPTIONS } from '../utils';

type Props = {
    busy: boolean;

    // draft
    draftSearch: string;
    setDraftSearch: (v: string) => void;

    draftClientNumber: string;
    setDraftClientNumber: (v: string) => void;

    draftOnlyActive: boolean;
    setDraftOnlyActive: (v: boolean) => void;

    draftOrdering: string;
    setDraftOrdering: (v: string) => void;

    // state
    hasActiveFiltersDraft: boolean;
    hasActiveFiltersApplied: boolean;
    hasUnappliedChanges: boolean;

    // actions
    applyFilters: () => void;
    resetFilters: () => void;
};

export default function ClientsFiltersPanel(props: Props): JSX.Element {
    const {
        busy,
        draftSearch,
        setDraftSearch,
        draftClientNumber,
        setDraftClientNumber,
        draftOnlyActive,
        setDraftOnlyActive,
        draftOrdering,
        setDraftOrdering,
        hasActiveFiltersDraft,
        hasActiveFiltersApplied,
        hasUnappliedChanges,
        applyFilters,
        resetFilters,
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
                            if (e.key === 'Enter') applyFilters();
                        }}
                        placeholder="Nr klienta, imię, nazwisko, e-mail, telefon…"
                        disabled={busy}
                        fullWidth
                    />
                    <TextField
                        label="Nr klienta"
                        value={draftClientNumber}
                        onChange={(e) => setDraftClientNumber(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') applyFilters();
                        }}
                        placeholder="np. 00000001"
                        disabled={busy}
                        fullWidth
                    />
                    <FormControl sx={{ minWidth: 220 }} disabled={busy}>
                        <InputLabel id="ordering-label">Sortowanie</InputLabel>
                        <Select
                            labelId="ordering-label"
                            value={draftOrdering}
                            label="Sortowanie"
                            onChange={(e) => setDraftOrdering(String(e.target.value))}
                        >
                            {ORDERING_OPTIONS.map((o) => (
                                <MenuItem key={o.value} value={o.value}>
                                    {o.label}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    <FormControlLabel
                        control={
                            <Switch
                                checked={draftOnlyActive}
                                onChange={(e) => setDraftOnlyActive(e.target.checked)}
                                disabled={busy}
                            />
                        }
                        label="Tylko aktywni"
                        sx={{ ml: { md: 'auto' } }}
                    />
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
                                label="Niezastosowane zmiany"
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
                        <Button
                            variant="contained"
                            onClick={applyFilters}
                            disabled={busy || !hasUnappliedChanges}
                        >
                            Zastosuj
                        </Button>
                    </Stack>
                </Stack>
            </Stack>
        </Paper>
    );
}
