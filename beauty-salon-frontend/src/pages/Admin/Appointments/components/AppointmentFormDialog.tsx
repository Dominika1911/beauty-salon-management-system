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
  Typography,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';

import type { AppointmentStatus } from '@/types';
import type {
  AdminAppointmentFormData,
  ClientSelectItem,
  EmployeeSelectItem,
  ServiceSelectItem,
  Slot,
} from '../types';

type Props = {
  open: boolean;
  editMode: boolean;

  submitting: boolean;
  formError: string | null;

  formData: AdminAppointmentFormData;
  setFormData: React.Dispatch<React.SetStateAction<AdminAppointmentFormData>>;

  clients: ClientSelectItem[];

  loadingLookups: boolean;

  coreFieldsLocked?: boolean;
  coreFieldsLockMessage?: string;

  filteredEmployees: EmployeeSelectItem[];
  filteredServices: ServiceSelectItem[];

  slotDay: Date | null;
  setSlotDay: (d: Date | null) => void;

  slotsLoading: boolean;
  slotsError: string | null;
  slots: Slot[];
  selectedSlotStart: string | null;
  onSelectSlotStart: (isoStart: string) => void;

  onClose: () => void;
  onSubmit: () => void;

  canSubmit?: boolean;
};

function formatTimeLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '--:--';
  return d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
}

export default function AppointmentFormDialog({
  open,
  editMode,
  submitting,
  formError,
  formData,
  setFormData,
  clients,
  loadingLookups,
  coreFieldsLocked = false,
  coreFieldsLockMessage,
  filteredEmployees,
  filteredServices,
  slotDay,
  setSlotDay,
  slotsLoading,
  slotsError,
  slots,
  selectedSlotStart,
  onSelectSlotStart,
  onClose,
  onSubmit,
  canSubmit = true,
}: Props) {
  const disableCore = submitting || coreFieldsLocked;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{editMode ? 'Edytuj wizytę' : 'Utwórz wizytę'}</DialogTitle>

      <DialogContent dividers>
        {loadingLookups ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            {coreFieldsLocked && (
              <Alert severity="info">
                {coreFieldsLockMessage ||
                  'Ta wizyta już się rozpoczęła - możesz zmienić tylko notatki wewnętrzne.'}
              </Alert>
            )}

            {formError && <Alert severity="error">{formError}</Alert>}

            <FormControl fullWidth required>
              <InputLabel>Klient</InputLabel>
              <Select
                label="Klient"
                value={formData.client ?? ''}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, client: Number(e.target.value) }))
                }
                disabled={disableCore}
              >
                {clients.map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth required>
              <InputLabel>Pracownik</InputLabel>
              <Select
                label="Pracownik"
                value={formData.employee ?? ''}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, employee: Number(e.target.value) }))
                }
                disabled={disableCore}
              >
                {filteredEmployees.map((emp) => (
                  <MenuItem key={emp.id} value={emp.id}>
                    {emp.label}
                  </MenuItem>
                ))}
              </Select>

              {!disableCore && filteredEmployees.length === 0 && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                  Brak pracowników wykonujących wybraną usługę.
                </Typography>
              )}
            </FormControl>

            <FormControl fullWidth required>
              <InputLabel>Usługa</InputLabel>
              <Select
                label="Usługa"
                value={formData.service ?? ''}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, service: Number(e.target.value) }))
                }
                disabled={disableCore}
              >
                {filteredServices.map((s) => (
                  <MenuItem key={s.id} value={s.id}>
                    {s.name}
                  </MenuItem>
                ))}
              </Select>

              {!disableCore && filteredServices.length === 0 && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                  Ten pracownik nie ma przypisanych usług.
                </Typography>
              )}
            </FormControl>

            <Stack spacing={1}>
              <DatePicker
                label="Dzień"
                value={slotDay}
                onChange={(d: Date | null) => setSlotDay(d)}
                disabled={disableCore}
                disablePast={!editMode}
                slotProps={{
                  textField: {
                    fullWidth: true,
                    required: true,
                    helperText:
                      'Dostępne godziny wynikają z grafiku, dostępności pracownika oraz godzin otwarcia salonu.',
                  },
                }}
              />

              <FormControl
                fullWidth
                required
                disabled={disableCore || !formData.employee || !formData.service || !slotDay}
              >
                <InputLabel>Godzina (wolne terminy)</InputLabel>
                <Select
                  label="Godzina (wolne terminy)"
                  value={selectedSlotStart ?? ''}
                  onChange={(e) => onSelectSlotStart(String(e.target.value))}
                >
                  {slots.map((sl) => (
                    <MenuItem key={sl.start} value={sl.start}>
                      {formatTimeLabel(sl.start)} - {formatTimeLabel(sl.end)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {!disableCore && slotsLoading && (
                <Typography variant="caption" color="text.secondary">
                  Ładowanie wolnych terminów...
                </Typography>
              )}

              {!disableCore && slotsError && (
                <Alert severity="warning" sx={{ mt: 1 }}>
                  {slotsError}
                </Alert>
              )}

              {!disableCore &&
                !slotsLoading &&
                !slotsError &&
                formData.employee &&
                formData.service &&
                slotDay &&
                slots.length === 0 && <Alert severity="info">Brak wolnych terminów w tym dniu.</Alert>}
            </Stack>

            {editMode && (
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
                  disabled={disableCore}
                >
                  <MenuItem value="PENDING">Oczekuje</MenuItem>
                  <MenuItem value="CONFIRMED">Potwierdzona</MenuItem>
                  <MenuItem value="CANCELLED">Anulowana</MenuItem>
                  <MenuItem value="COMPLETED">Zakończona</MenuItem>
                  <MenuItem value="NO_SHOW">Nieobecność</MenuItem>
                </Select>
              </FormControl>
            )}

            <TextField
              label="Notatki wewnętrzne"
              multiline
              rows={3}
              value={formData.internal_notes}
              onChange={(e) => setFormData((prev) => ({ ...prev, internal_notes: e.target.value }))}
              disabled={submitting}
              helperText={
                coreFieldsLocked
                  ? 'W tej sytuacji tylko notatki są zapisywane.'
                  : undefined
              }
            />
          </Stack>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={submitting}>
          Anuluj
        </Button>
        <Button
          onClick={onSubmit}
          variant="contained"
          disabled={submitting || loadingLookups || !canSubmit}
        >
          {submitting ? <CircularProgress size={20} /> : editMode ? 'Zapisz' : 'Utwórz'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}