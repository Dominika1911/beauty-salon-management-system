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
  filters: {
    status: StatusFilter;
  };
  setFilters: React.Dispatch<
    React.SetStateAction<{
      status: StatusFilter;
    }>
  >;

  onCreate: () => void;
  loading: boolean;
};

export default function AppointmentFilters({
  filters,
  setFilters,
  onCreate,
  loading,
}: Props) {
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      spacing={1.5}
      justifyContent="space-between"
    >
      <FormControl size="small" sx={{ minWidth: 220 }}>
        <InputLabel>Status</InputLabel>
        <Select
          label="Status"
          value={filters.status}
          onChange={(e) =>
            setFilters((prev) => ({
              ...prev,
              status: e.target.value as StatusFilter,
            }))
          }
          disabled={loading}
        >
          <MenuItem value="ALL">Wszystkie</MenuItem>
          <MenuItem value="PENDING">Oczekujące</MenuItem>
          <MenuItem value="CONFIRMED">Potwierdzone</MenuItem>
          <MenuItem value="COMPLETED">Zakończone</MenuItem>
          <MenuItem value="CANCELLED">Anulowane</MenuItem>
        </Select>
      </FormControl>

      <Button
        variant="contained"
        onClick={onCreate}
        disabled={loading}
      >
        Dodaj wizytę
      </Button>
    </Stack>
  );
}
