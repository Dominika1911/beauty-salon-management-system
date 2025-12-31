import React from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
} from '@mui/material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';

import type { AppointmentStatus } from '@/types';
import type {
  AdminAppointmentFormData,
  ClientSelectItem,
  EmployeeSelectItem,
  ServiceSelectItem,
} from '../types';


type Props = {
  open: boolean;
  editMode: boolean;

  submitting: boolean;
  formError: string | null;

  formData: AdminAppointmentFormData;
  setFormData: React.Dispatch<
    React.SetStateAction<AdminAppointmentFormData>
  >;

  clients: ClientSelectItem[];
  employees: EmployeeSelectItem[];
  services: ServiceSelectItem[];
  loadingLookups: boolean;

  onClose: () => void;
  onSubmit: () => void;
};

export default function AppointmentFormDialog({
  open,
  editMode,
  submitting,
  formError,
  formData,
  setFormData,
  clients,
  employees,
  services,
  loadingLookups,
  onClose,
  onSubmit,
}: Props) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {editMode ? 'Edytuj wizytę' : 'Utwórz wizytę'}
      </DialogTitle>

      <DialogContent dividers>
        {loadingLookups ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            {formError && <Alert severity="error">{formError}</Alert>}

            {/* Client */}
            <FormControl fullWidth required>
              <InputLabel>Klient</InputLabel>
              <Select
                label="Klient"
                value={formData.client ?? ''}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    client: e.target.value
                      ? Number(e.target.value)
                      : null,
                  }))
                }
                disabled={submitting}
              >
                {clients.map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Employee */}
            <FormControl fullWidth required>
              <InputLabel>Pracownik</InputLabel>
              <Select
                label="Pracownik"
                value={formData.employee ?? ''}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    employee: e.target.value
                      ? Number(e.target.value)
                      : null,
                  }))
                }
                disabled={submitting}
              >
                {employees.map((emp) => (
                  <MenuItem key={emp.id} value={emp.id}>
                    {emp.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Service */}
            <FormControl fullWidth required>
              <InputLabel>Usługa</InputLabel>
              <Select
                label="Usługa"
                value={formData.service ?? ''}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    service: e.target.value
                      ? Number(e.target.value)
                      : null,
                  }))
                }
                disabled={submitting}
              >
                {services.map((s) => (
                  <MenuItem key={s.id} value={s.id}>
                    {s.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Start */}
            <DateTimePicker
              label="Rozpoczęcie"
              value={formData.start}
              onChange={(date) =>
                setFormData((prev) => ({
                  ...prev,
                  start: date,
                }))
              }
              disabled={submitting}
              slotProps={{
                textField: {
                  fullWidth: true,
                  required: true,
                },
              }}
            />

            {/* Status */}
            <FormControl fullWidth required>
              <InputLabel>Status</InputLabel>
              <Select
                label="Status"
                value={formData.status}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    status: e.target.value as AppointmentStatus,
                  }))
                }
                disabled={submitting}
              >
                <MenuItem value="PENDING">Oczekuje</MenuItem>
                <MenuItem value="CONFIRMED">Potwierdzona</MenuItem>
                <MenuItem value="CANCELLED">Anulowana</MenuItem>
                <MenuItem value="COMPLETED">Zakończona</MenuItem>
              </Select>
            </FormControl>

            {/* Notes */}
            <TextField
              label="Notatki wewnętrzne"
              multiline
              rows={3}
              value={formData.internal_notes}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  internal_notes: e.target.value,
                }))
              }
              disabled={submitting}
              fullWidth
            />
          </Stack>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={submitting}>
          Anuluj
        </Button>
        <Button
          variant="contained"
          onClick={onSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <CircularProgress size={18} />
          ) : editMode ? (
            'Zapisz'
          ) : (
            'Utwórz'
          )}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
