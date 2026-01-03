import React from 'react';
import { Box, Button, ButtonGroup, Chip, Stack, Typography } from '@mui/material';
import type { GridColDef } from '@mui/x-data-grid';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import KeyIcon from '@mui/icons-material/Key';

import type { Employee } from '@/types';

type Args = {
    busy: boolean;
    onResetPassword: (employee: Employee) => void;
    onEdit: (employee: Employee) => void;
    onDelete: (employee: Employee) => void;
    formatPLN: (value: string | number) => string;
};

export function getEmployeesColumns(args: Args): GridColDef<Employee>[] {
    const { busy, onResetPassword, onEdit, onDelete, formatPLN } = args;

    return [
        {
            field: 'employee_number',
            headerName: 'Nr',
            minWidth: 90,
            flex: 0.45,
            valueGetter: (_v, row) => row.employee_number || '—',
            sortable: true,
        },
        {
            field: 'full_name',
            headerName: 'Pracownik',
            minWidth: 170,
            flex: 1.1,
            sortable: false,
            renderCell: (params) => (
                <Stack spacing={0.25} sx={{ py: 0.5, minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>
                        {`${params.row.first_name ?? ''} ${params.row.last_name ?? ''}`.trim()}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap>
                        {params.row.phone || '—'}
                    </Typography>
                </Stack>
            ),
        },
        {
            field: 'contact',
            headerName: 'Kontakt',
            minWidth: 170,
            flex: 1.05,
            sortable: false,
            valueGetter: (_v, row) => `${row.user_username || ''} ${row.user_email || ''}`.trim(),
            renderCell: (params) => (
                <Stack spacing={0.25} sx={{ py: 0.5, minWidth: 0 }}>
                    <Typography variant="body2" noWrap>
                        {params.row.user_username || '—'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap>
                        {params.row.user_email || '—'}
                    </Typography>
                </Stack>
            ),
        },
        {
            field: 'is_active',
            headerName: 'Status',
            minWidth: 110,
            flex: 0.6,
            sortable: false,
            renderCell: (params) =>
                params.row.is_active ? (
                    <Chip label="Aktywny" color="success" size="small" />
                ) : (
                    <Chip label="Nieaktywny" size="small" />
                ),
        },
        {
            field: 'appointments_count',
            headerName: 'Wizyty',
            minWidth: 80,
            flex: 0.5,
            valueGetter: (_v, row) => row.appointments_count ?? 0,
            sortable: false,
        },
        {
            field: 'completed_appointments_count',
            headerName: 'Zakończone',
            minWidth: 105,
            flex: 0.7,
            valueGetter: (_v, row) => row.completed_appointments_count ?? 0,
            sortable: false,
        },
        {
            field: 'revenue_completed_total',
            headerName: 'Przychód',
            minWidth: 105,
            flex: 0.7,
            valueGetter: (_v, row) => formatPLN(row.revenue_completed_total ?? '0'),
            sortable: false,
        },
        {
            field: 'skills',
            headerName: 'Usługi',
            minWidth: 150,
            flex: 0.95,
            sortable: false,
            renderCell: (params) => {
                const list = params.row.skills || [];
                if (!list.length) return '—';
                return (
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', py: 0.5 }}>
                        {list.slice(0, 2).map((s) => (
                            <Chip key={s.id} label={s.name} size="small" />
                        ))}
                        {list.length > 2 && (
                            <Chip label={`+${list.length - 2}`} size="small" variant="outlined" />
                        )}
                    </Box>
                );
            },
        },
        {
            field: 'actions',
            headerName: 'Akcje',
            minWidth: 280,
            flex: 1.05,
            sortable: false,
            filterable: false,
            align: 'right',
            headerAlign: 'right',
            renderCell: (params) => (
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
                    <ButtonGroup
                        variant="text"
                        size="small"
                        aria-label="Akcje pracownika"
                        disabled={busy}
                        sx={{
                            '& .MuiButton-root': { whiteSpace: 'nowrap', px: 1, minWidth: 'auto' },
                        }}
                    >
                        <Button
                            onClick={() => onResetPassword(params.row)}
                            startIcon={<KeyIcon fontSize="small" />}
                        >
                            Hasło
                        </Button>
                        <Button
                            onClick={() => onEdit(params.row)}
                            startIcon={<EditIcon fontSize="small" />}
                            color="primary"
                        >
                            Edytuj
                        </Button>
                        <Button
                            onClick={() => onDelete(params.row)}
                            startIcon={<DeleteIcon fontSize="small" />}
                            color="error"
                        >
                            Usuń
                        </Button>
                    </ButtonGroup>
                </Box>
            ),
        },
    ];
}
