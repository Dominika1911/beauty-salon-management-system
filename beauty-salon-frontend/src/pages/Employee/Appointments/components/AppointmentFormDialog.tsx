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
import type { AppointmentStatus, Client, Service } from '@/types';
import type { FormData, EmployeeSelectItem } from '../types';

type Slot = { start: string; end: string };
type SlotsResponse = { date: string; slots: Slot[] };

type Props = {
  open: boolean;
  editMode: boolean;
  isPastEdit: boolean;

  submitting: boolean;
  formError: string | null;

  formData: FormData;
  setFormData: React.Dispatch<React.SetStateAction<FormData>>;

  clients: Client[];
  employees: EmployeeSelectItem[];
  services: Service[];
  loadingLookups: boolean;

  onClose: () => void;
  onSubmit: () => void;
};

// Jeśli masz inne base path, zmień tutaj:
const SLOTS_URL = '/api/availability/slots/';

function isRecord(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === 'object';
}

function getErrMessage(e: unknown): string | undefined {
  if (e instanceof Error) return e.message;
  const err = e as { message?: unknown };
  return typeof err.message === 'string' ? err.message : undefined;
}

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function toYMD(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function fmtHM(d: Date) {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export default function AppointmentFormDialog({
  open,
  editMode,
  isPastEdit,
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
  const [day, setDay] = React.useState<Date | null>(
    formData.start ? new Date(formData.start) : null,
  );

  const [slotsLoading, setSlotsLoading] = React.useState(false);
  const [slotsError, setSlotsError] = React.useState<string | null>(null);
  const [slots, setSlots] = React.useState<Slot[]>([]);
  const [slotValue, setSlotValue] = React.useState<string>(''); // value = slot.start

  // --- EMPLOYEE: bierzemy zalogowanego pracownika z formData.employee ---
  const employeeId = formData.employee ?? null;
  const employee = React.useMemo(
    () => employees.find((e) => e.id === employeeId) ?? null,
    [employees, employeeId],
  );

  const allowedServiceIds = React.useMemo(() => {
    return new Set<number>(employee?.skills ?? []);
  }, [employee]);

  const filteredServices = React.useMemo(() => {
    // Jeśli nie mamy pracownika – pokaż wszystkie (fallback)
    if (!employeeId) return services;
    return services.filter((s) => allowedServiceIds.has(s.id));
  }, [allowedServiceIds, employeeId, services]);

  // Sync local day with formData.start when opening dialog (np. edit)
  React.useEffect(() => {
    if (!open) return;
    const s = formData.start ? new Date(formData.start) : null;
    setDay(s);
    setSlotValue(s ? s.toISOString() : '');
    setSlotsError(null);
    setSlots([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const clearSlots = React.useCallback(() => {
    setSlots([]);
    setSlotValue('');
    setSlotsError(null);
  }, []);

  const fetchSlots = React.useCallback(async () => {
    // ✅ zgodnie z backendem: przy edycji przeszłej wizyty nie interesują nas sloty
    if (editMode && isPastEdit) {
      setSlots([]);
      setSlotsError(null);
      setSlotsLoading(false);
      return;
    }

    const serviceId = formData.service;

    if (!employeeId || !serviceId || !day) {
      clearSlots();
      return;
    }

    setSlotsLoading(true);
    setSlotsError(null);
    setSlots([]);

    try {
      const dateStr = toYMD(day);

      const url = new URL(SLOTS_URL, window.location.origin);
      url.searchParams.set('employee_id', String(employeeId));
      url.searchParams.set('service_id', String(serviceId));
      url.searchParams.set('date', dateStr);

      const res = await fetch(url.toString(), {
        method: 'GET',
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });

      const data: unknown = await res.json();

      if (!res.ok) {
        const msgFromBody =
          isRecord(data) && typeof data.detail === 'string'
            ? data.detail
            : isRecord(data) && typeof data.message === 'string'
              ? data.message
              : undefined;

        const msg = msgFromBody || `Nie udało się pobrać slotów (HTTP ${res.status}).`;
        throw new Error(msg);
      }

      const parsed = data as SlotsResponse;
      const newSlots = Array.isArray(parsed.slots) ? parsed.slots : [];

      setSlots(newSlots);

      // Jeśli obecny start nie jest w slotach, wyczyść start/end (ALE NIE dla isPastEdit)
      const currentStartIso = formData.start
        ? new Date(formData.start).toISOString()
        : '';
      const stillValid =
        currentStartIso &&
        newSlots.some((s) => new Date(s.start).toISOString() === currentStartIso);

      if (!stillValid) {
        setFormData((prev) => ({ ...prev, start: null, end: null }));
        setSlotValue('');
      } else {
        setSlotValue(currentStartIso);
      }
    } catch (e: unknown) {
      setSlotsError(getErrMessage(e) ?? 'Błąd pobierania slotów.');
      setSlots([]);
      setSlotValue('');
      setFormData((prev) => ({ ...prev, start: null, end: null }));
    } finally {
      setSlotsLoading(false);
    }
  }, [
    clearSlots,
    day,
    editMode,
    employeeId,
    formData.service,
    formData.start,
    isPastEdit,
    setFormData,
  ]);

  // Refetch slots whenever service/day changes (and dialog is open)
  React.useEffect(() => {
    if (!open) return;
    void fetchSlots();
  }, [open, fetchSlots]);

  // Gdy zmienia się pracownik (np. przy pierwszym load) – wyczyść service jeśli nie pasuje do skillów
  React.useEffect(() => {
    if (!open) return;
    if (!employeeId) return;

    // ✅ przy przeszłej edycji nic nie czyścimy – ma zostać jak było
    if (editMode && isPastEdit) return;

    if (formData.service && !allowedServiceIds.has(formData.service)) {
      setFormData((prev) => ({
        ...prev,
        service: null,
        start: null,
        end: null,
      }));
      clearSlots();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, employeeId]);

  const serviceSelected = !!formData.service;

  const submitDisabled = React.useMemo(() => {
    if (submitting || loadingLookups || slotsLoading || !employeeId) return true;

    // ✅ przeszła wizyta -> pozwalamy zapisać SAME notatki
    if (editMode && isPastEdit) return false;

    // create / przyszła edycja -> wymagamy pełnych danych
    return (
      !formData.client ||
      !formData.service ||
      !formData.start ||
      !formData.end
    );
  }, [
    editMode,
    employeeId,
    formData.client,
    formData.end,
    formData.service,
    formData.start,
    isPastEdit,
    loadingLookups,
    slotsLoading,
    submitting,
  ]);

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
            {formError && <Alert severity="error">{formError}</Alert>}

            {editMode && isPastEdit && (
              <Alert severity="info">
                Wizyta jest w przeszłości — możesz edytować tylko notatki.
              </Alert>
            )}

            {/* EMPLOYEE INFO */}
            <Box>
              <Typography variant="caption" color="text.secondary">
                Pracownik
              </Typography>
              <Typography variant="body2" fontWeight={700}>
                {employee?.label ?? '—'}
              </Typography>

              {employeeId && (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ mt: 0.5, display: 'block' }}
                >
                  Dostępne usługi: {filteredServices.length} / {services.length}
                </Typography>
              )}
            </Box>

            {/* Client */}
            <FormControl fullWidth required>
              <InputLabel>Klient</InputLabel>
              <Select
                label="Klient"
                value={formData.client ?? ''}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    client: e.target.value ? Number(e.target.value) : null,
                  }))
                }
                disabled={submitting || isPastEdit}
              >
                {clients.map((c) => {
                  const label =
                    [c.first_name, c.last_name].filter(Boolean).join(' ') || c.email;
                  return (
                    <MenuItem key={c.id} value={c.id}>
                      {label}
                    </MenuItem>
                  );
                })}
              </Select>
            </FormControl>

            {/* Service (filtered by employee skills) */}
            <FormControl fullWidth required disabled={!employeeId}>
              <InputLabel>Usługa</InputLabel>
              <Select
                label="Usługa"
                value={formData.service ?? ''}
                onChange={(e) => {
                  const serviceId = e.target.value ? Number(e.target.value) : null;
                  setFormData((prev) => ({
                    ...prev,
                    service: serviceId,
                    start: null,
                    end: null,
                  }));
                  clearSlots();
                }}
                disabled={submitting || isPastEdit || !employeeId}
              >
                {filteredServices.map((s) => (
                  <MenuItem key={s.id} value={s.id}>
                    {s.name}
                  </MenuItem>
                ))}
              </Select>

              {!filteredServices.length && employeeId && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                  Ten pracownik nie ma przypisanych usług (skills).
                </Typography>
              )}
            </FormControl>

            {/* Day */}
            <DatePicker
              label="Dzień"
              value={day}
              onChange={(d) => {
                setDay(d);
                setFormData((prev) => ({ ...prev, start: null, end: null }));
                clearSlots();
              }}
              disabled={submitting || isPastEdit}
              minDate={new Date()}
              slotProps={{
                textField: { fullWidth: true, required: true },
              }}
            />

            {/* Slots */}
            <FormControl
              fullWidth
              required
              disabled={
                submitting ||
                isPastEdit ||
                !employeeId ||
                !serviceSelected ||
                !day
              }
            >
              <InputLabel>Godzina (slot)</InputLabel>
              <Select
                label="Godzina (slot)"
                value={slotValue}
                onChange={(e) => {
                  const startIso = String(e.target.value || '');
                  setSlotValue(startIso);

                  const slot = slots.find(
                    (s) => new Date(s.start).toISOString() === startIso,
                  );
                  if (!slot) {
                    setFormData((prev) => ({ ...prev, start: null, end: null }));
                    return;
                  }

                  setFormData((prev) => ({
                    ...prev,
                    start: new Date(slot.start),
                    end: new Date(slot.end),
                  }));
                }}
              >
                {slots.map((s) => {
                  const start = new Date(s.start);
                  const end = new Date(s.end);
                  const value = start.toISOString();
                  return (
                    <MenuItem key={value} value={value}>
                      {fmtHM(start)} – {fmtHM(end)}
                    </MenuItem>
                  );
                })}
              </Select>

              {!isPastEdit && (
                <>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                    {slotsLoading
                      ? 'Ładowanie slotów…'
                      : slots.length
                        ? `Dostępnych slotów: ${slots.length}`
                        : 'Brak dostępnych slotów.'}
                  </Typography>

                  {slotsError && (
                    <Typography variant="caption" color="error" sx={{ mt: 0.5 }}>
                      {slotsError}
                    </Typography>
                  )}
                </>
              )}
            </FormControl>

            {/* Status */}
            {editMode ? (
              <FormControl fullWidth required>
                <InputLabel>Status</InputLabel>
                <Select
                  label="Status"
                  value={formData.status ?? 'CONFIRMED'}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      status: e.target.value as AppointmentStatus,
                    }))
                  }
                  disabled={submitting || isPastEdit}
                >
                  <MenuItem value="PENDING">Oczekuje</MenuItem>
                  <MenuItem value="CONFIRMED">Potwierdzona</MenuItem>
                  <MenuItem value="COMPLETED">Zakończona</MenuItem>
                  <MenuItem value="CANCELLED">Anulowana</MenuItem>
                  <MenuItem value="NO_SHOW">No-show</MenuItem>
                </Select>
              </FormControl>
            ) : (
              <Alert severity="info">
                Status nowej wizyty jest ustawiany automatycznie na <b>Potwierdzona</b>.
              </Alert>
            )}

            {/* Internal notes */}
            <TextField
              label="Notatki wewnętrzne"
              value={formData.internal_notes ?? ''}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  internal_notes: e.target.value,
                }))
              }
              fullWidth
              multiline
              minRows={3}
              disabled={submitting}
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
          disabled={submitDisabled}
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
