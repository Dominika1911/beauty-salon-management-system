import React from 'react';
import {
    Alert,
    Box,
    Button,
    ButtonGroup,
    Chip,
    CircularProgress,
    LinearProgress,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Tooltip,
    Typography,
} from '@mui/material';
import { Delete, Edit, Visibility } from '@mui/icons-material';
import KeyIcon from '@mui/icons-material/Key';
import type { Client } from '@/types';

type Props = {
    clients: Client[];
    loading: boolean;
    busy: boolean;
    emptyInfo: string | null;

    onView: (c: Client) => void;
    onEdit: (c: Client) => void;
    onReset: (c: Client) => void;
    onDelete: (c: Client) => void;
};

export default function ClientsTable(props: Props) {
    const { clients, loading, busy, emptyInfo, onView, onEdit, onReset, onDelete } = props;

    return (
        <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
            {loading ? <LinearProgress /> : null}

            <TableContainer sx={{ overflowX: 'auto' }}>
                <Table aria-label="Lista klientów">
                    <TableHead>
                        <TableRow>
                            <TableCell>Klient</TableCell>
                            <TableCell>Kontakt</TableCell>
                            <TableCell align="center">Wizyty</TableCell>
                            <TableCell align="center">Status</TableCell>
                            <TableCell align="right">Akcje</TableCell>
                        </TableRow>
                    </TableHead>

                    <TableBody>
                        {!loading &&
                            clients.map((c) => (
                                <TableRow key={c.id} hover>
                                    <TableCell sx={{ minWidth: 220 }}>
                                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                            {c.first_name} {c.last_name}
                                        </Typography>
                                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                            {c.client_number}
                                        </Typography>
                                    </TableCell>

                                    <TableCell sx={{ minWidth: 220 }}>
                                        <Typography variant="body2">{c.email || '—'}</Typography>
                                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                            {c.phone || '—'}
                                        </Typography>
                                    </TableCell>

                                    <TableCell align="center">
                                        <Chip
                                            label={c.appointments_count}
                                            size="small"
                                            variant="outlined"
                                            color="primary"
                                        />
                                    </TableCell>

                                    <TableCell align="center">
                                        <Chip
                                            label={c.is_active ? 'Aktywny' : 'Nieaktywny'}
                                            color={c.is_active ? 'success' : 'default'}
                                            size="small"
                                            variant="outlined"
                                        />
                                    </TableCell>

                                    <TableCell align="right">
                                        <Box
                                            sx={{
                                                display: 'flex',
                                                justifyContent: 'flex-end',
                                                flexWrap: 'wrap',
                                                gap: 1,
                                            }}
                                        >
                                            <ButtonGroup
                                                variant="text"
                                                size="small"
                                                aria-label="Akcje klienta"
                                                disabled={busy}
                                            >
                                                <Button
                                                    onClick={() => onView(c)}
                                                    startIcon={<Visibility fontSize="small" />}
                                                >
                                                    Podgląd
                                                </Button>
                                                <Button
                                                    onClick={() => onEdit(c)}
                                                    startIcon={<Edit fontSize="small" />}
                                                    color="primary"
                                                >
                                                    Edytuj
                                                </Button>

                                                <Tooltip title="Ustaw nowe hasło dla konta klienta." arrow>
                                                    <span>
                                                        <Button
                                                            onClick={() => onReset(c)}
                                                            startIcon={<KeyIcon fontSize="small" />}
                                                            disabled={busy}
                                                        >
                                                            Hasło
                                                        </Button>
                                                    </span>
                                                </Tooltip>

                                                <Button
                                                    onClick={() => onDelete(c)}
                                                    startIcon={<Delete fontSize="small" />}
                                                    color="error"
                                                >
                                                    Usuń
                                                </Button>
                                            </ButtonGroup>
                                        </Box>
                                    </TableCell>
                                </TableRow>
                            ))}

                        {!loading && clients.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={5}>
                                    <Box sx={{ py: 2.5 }}>
                                        <Alert severity="info">{emptyInfo}</Alert>
                                    </Box>
                                </TableCell>
                            </TableRow>
                        )}

                        {loading && clients.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={5}>
                                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                                        <CircularProgress size={28} />
                                    </Box>
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </TableContainer>
        </Paper>
    );
}
