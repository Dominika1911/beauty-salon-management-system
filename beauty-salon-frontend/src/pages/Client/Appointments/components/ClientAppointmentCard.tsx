import React from 'react';
import { Paper, Stack, Box, Typography, Chip, Divider, Button } from '@mui/material';
import type { Appointment } from '@/types';
import { formatPL, formatPrice, statusChipColor } from '../utils';

interface Props {
    appointment: Appointment;
    onCancel: (appt: Appointment) => void;
    busy: boolean;
}

export const ClientAppointmentCard: React.FC<Props> = ({ appointment: a, onCancel, busy }) => {
    const canCancel =
        a.can_cancel &&
        !['COMPLETED', 'CANCELLED'].includes(a.status) &&
        new Date(a.start).getTime() > Date.now();

    return (
        <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack spacing={1}>
                <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1.5}>
                    <Box>
                        <Typography fontWeight={900}>{a.service_name}</Typography>
                        <Typography variant="body2" color="text.secondary">
                            Pracownik: {a.employee_name}
                        </Typography>
                    </Box>

                    <Stack alignItems={{ xs: 'flex-start', sm: 'flex-end' }} spacing={0.5}>
                        <Chip size="small" label={a.status_display} color={statusChipColor(a.status)} />
                        <Typography fontWeight={800}>{formatPrice(a.service_price)}</Typography>
                    </Stack>
                </Stack>

                <Divider />

                <Typography variant="body2">
                    {formatPL(a.start)} – {formatPL(a.end)}
                </Typography>

                {canCancel && (
                    <Box>
                        <Button
                            size="small"
                            color="error"
                            variant="outlined"
                            disabled={busy}
                            onClick={() => onCancel(a)}
                        >
                            Anuluj wizytę
                        </Button>
                    </Box>
                )}
            </Stack>
        </Paper>
    );
};
