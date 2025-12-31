import React from 'react';
import {
    Paper,
    Stack,
    Box,
    Button,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Typography,
    Divider,
} from '@mui/material';
import type { Ordering, StatusFilter } from '../types';

interface Props {
    status: StatusFilter;
    ordering: Ordering;
    onStatusChange: (val: StatusFilter) => void;
    onOrderingChange: (val: Ordering) => void;
    onApply: () => void;
    onClear: () => void;
    onRefresh: () => void;
    busy: boolean;
    isDirty: boolean;
    count: number;
    page: number;
    onPageChange: React.Dispatch<React.SetStateAction<number>>;
    canNext: boolean;
    canPrev: boolean;
}

export const ClientAppointmentFilters: React.FC<Props> = ({
    status,
    ordering,
    onStatusChange,
    onOrderingChange,
    onApply,
    onClear,
    onRefresh,
    busy,
    isDirty,
    count,
    page,
    onPageChange,
    canNext,
    canPrev,
}) => {
    return (
        <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack spacing={2}>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
                    <FormControl size="small" sx={{ minWidth: 220 }} disabled={busy}>
                        <InputLabel>Status</InputLabel>
                        <Select
                            label="Status"
                            value={status}
                            onChange={(e) => onStatusChange(e.target.value as StatusFilter)}
                        >
                            <MenuItem value="ALL">Wszystkie</MenuItem>
                            <MenuItem value="PENDING">Oczekujące</MenuItem>
                            <MenuItem value="CONFIRMED">Potwierdzone</MenuItem>
                            <MenuItem value="COMPLETED">Zakończone</MenuItem>
                            <MenuItem value="CANCELLED">Anulowane</MenuItem>
                            <MenuItem value="NO_SHOW">No-show</MenuItem>
                        </Select>
                    </FormControl>

                    <FormControl size="small" sx={{ minWidth: 220 }} disabled={busy}>
                        <InputLabel>Sortowanie</InputLabel>
                        <Select
                            label="Sortowanie"
                            value={ordering}
                            onChange={(e) => onOrderingChange(e.target.value as Ordering)}
                        >
                            <MenuItem value="start">Najbliższe terminy</MenuItem>
                            <MenuItem value="-start">Najdalsze terminy</MenuItem>
                            <MenuItem value="-created_at">Najnowsze rezerwacje</MenuItem>
                            <MenuItem value="created_at">Najstarsze rezerwacje</MenuItem>
                        </Select>
                    </FormControl>

                    <Box sx={{ flex: 1 }} />

                    <Stack direction="row" spacing={1} justifyContent={{ xs: 'stretch', md: 'flex-end' }}>
                        <Button variant="outlined" onClick={onClear} disabled={busy}>
                            Wyczyść
                        </Button>
                        <Button variant="contained" onClick={onApply} disabled={busy || !isDirty}>
                            Zastosuj
                        </Button>
                        <Button variant="outlined" onClick={onRefresh} disabled={busy}>
                            Odśwież
                        </Button>
                    </Stack>
                </Stack>

                <Divider />

                <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={1}
                    alignItems={{ sm: 'center' }}
                    justifyContent="space-between"
                >
                    <Typography variant="body2" color="text.secondary" fontWeight={500}>
                        Znaleziono wizyt: {count} • Strona: {page}
                    </Typography>

                    <Stack direction="row" spacing={1}>
                        <Button
                            size="small"
                            variant="outlined"
                            disabled={!canPrev || busy}
                            onClick={() => onPageChange((p) => Math.max(1, p - 1))}
                        >
                            Poprzednia
                        </Button>
                        <Button
                            size="small"
                            variant="contained"
                            disabled={!canNext || busy}
                            onClick={() => onPageChange((p) => p + 1)}
                        >
                            Następna
                        </Button>
                    </Stack>
                </Stack>
            </Stack>
        </Paper>
    );
};
