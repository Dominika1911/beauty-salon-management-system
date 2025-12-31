import React from 'react';
import {
  Box,
  Button,
  Chip,
  Paper,
  Stack,
  Typography,
} from '@mui/material';

import type { Appointment } from '@/types';

type Props = {
  appointment: Appointment;
  onEdit: (a: Appointment) => void;
};

const statusLabelMap: Record<string, string> = {
  PENDING: 'Oczekuje',
  CONFIRMED: 'Potwierdzona',
  COMPLETED: 'Zakończona',
  CANCELLED: 'Anulowana',
};

const statusColorMap: Record<
  string,
  'default' | 'primary' | 'success' | 'error'
> = {
  PENDING: 'default',
  CONFIRMED: 'primary',
  COMPLETED: 'success',
  CANCELLED: 'error',
};

export default function AppointmentListItem({
  appointment,
  onEdit,
}: Props) {
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        justifyContent="space-between"
        alignItems={{ sm: 'center' }}
      >
        {/* Left */}
        <Stack spacing={0.5}>
          <Typography fontWeight={600}>
            {new Date(appointment.start).toLocaleString()}
          </Typography>

          <Typography variant="body2" color="text.secondary">
            Klient ID: {appointment.client} • Pracownik ID:{' '}
            {appointment.employee}
          </Typography>

          <Typography variant="body2" color="text.secondary">
            Usługa ID: {appointment.service}
          </Typography>
        </Stack>

        {/* Right */}
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          justifyContent="flex-end"
        >
          <Chip
            label={statusLabelMap[appointment.status]}
            color={statusColorMap[appointment.status]}
            size="small"
          />

          <Box>
            <Button
              size="small"
              variant="outlined"
              onClick={() => onEdit(appointment)}
            >
              Edytuj
            </Button>
          </Box>
        </Stack>
      </Stack>
    </Paper>
  );
}
