import React from 'react';
import {
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
} from '@mui/material';

import type { StatusFilter } from '../types';

type Props = {
  status: StatusFilter;
  onStatusChange: (status: StatusFilter) => void;
  onCreate: () => void;
};

export default function AppointmentFilters({
  status,
  onStatusChange,
  onCreate,
}: Props) {
  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
      <FormControl size="small" sx={{ minWidth: 220 }}>
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
          <MenuItem value="NO_SHOW">Nie przyszedł</MenuItem>
        </Select>
      </FormControl>

      <Button variant="contained" onClick={onCreate}>
        Dodaj wizytę
      </Button>
    </Stack>
  );
}
