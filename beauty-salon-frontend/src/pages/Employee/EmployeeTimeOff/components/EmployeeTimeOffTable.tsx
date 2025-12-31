import React from 'react';
import {
    Box,
    Button,
    Chip,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    Typography,
} from '@mui/material';
import dayjs from 'dayjs';
import 'dayjs/locale/pl';

import type { TimeOff } from '@/types';

interface Props {
    data: TimeOff[];
    onCancel: (req: TimeOff) => void;
}

dayjs.locale('pl');

const STATUS_LABEL: Record<string, string> = {
    PENDING: 'Oczekuje',
    APPROVED: 'Zatwierdzony',
    REJECTED: 'Odrzucony',
    CANCELLED: 'Anulowany',
};

const STATUS_COLOR: Record<
    string,
    'default' | 'success' | 'error' | 'warning'
> = {
    PENDING: 'warning',
    APPROVED: 'success',
    REJECTED: 'error',
    CANCELLED: 'default',
};

const EmployeeTimeOffTable: React.FC<Props> = ({ data, onCancel }) => {
    if (!data.length) {
        return (
            <Typography sx={{ mt: 2 }} color="text.secondary">
                Brak wniosków urlopowych
            </Typography>
        );
    }

    return (
        <Table>
            <TableHead>
                <TableRow>
                    <TableCell>ID</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Utworzono</TableCell>
                    <TableCell align="right">Akcje</TableCell>
                </TableRow>
            </TableHead>

            <TableBody>
                {data.map((req) => (
                    <TableRow key={req.id}>
                        <TableCell>{req.id}</TableCell>

                        <TableCell>
                            <Chip
                                label={
                                    STATUS_LABEL[req.status] ?? req.status
                                }
                                color={
                                    STATUS_COLOR[req.status] ?? 'default'
                                }
                                size="small"
                            />
                        </TableCell>

                        <TableCell>
                            {dayjs(req.created_at).format(
                                'DD MMMM YYYY, HH:mm'
                            )}
                        </TableCell>

                        <TableCell align="right">
                            {req.status === 'PENDING' && (
                                <Box display="flex" justifyContent="flex-end">
                                    <Button
                                        size="small"
                                        color="error"
                                        variant="outlined"
                                        onClick={() => onCancel(req)}
                                    >
                                        Anuluj
                                    </Button>
                                </Box>
                            )}
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
};

export default EmployeeTimeOffTable;
