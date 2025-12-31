import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  FormControl,
  InputLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  Stack,
  Typography,
} from '@mui/material';
import type { AlertColor } from '@mui/material/Alert';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { pl } from 'date-fns/locale';

import type {
  Appointment,
  AppointmentStatus,
  DRFPaginated,
  Client,
  Service,
} from '@/types';
import { appointmentsApi } from '@/api/appointments';
import { clientsApi } from '@/api/clients';
import { employeesApi } from '@/api/employees';
import { servicesApi } from '@/api/services';
import { parseDrfError } from '@/utils/drfErrors';
import { useAuth } from '@/context/AuthContext';

import type {
  FormData,
  Ordering,
  SnackState,
  EmployeeSelectItem,
} from './Appointments/types';
import { EMPTY_FORM, EMPTY_PAGE, orderingLabel } from './Appointments/utils';
import AppointmentCard from './Appointments/components/AppointmentCard';
import AppointmentFormDialog from './Appointments/components/AppointmentFormDialog';

export default function AppointmentsPage() {
  const { user } = useAuth();

  /* ===================== STATE ===================== */

  const [data, setData] = useState<DRFPaginated<Appointment>>(EMPTY_PAGE);
  const [loading, setLoading] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const [snack, setSnack] = useState<SnackState>({
    open: false,
    msg: '',
    severity: 'success',
  });

  const [ordering, setOrdering] = useState<Ordering>('-start');
  const [draftOrdering, setDraftOrdering] = useState<Ordering>('-start');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [isPastEdit, setIsPastEdit] = useState(false);

  const [formData, setFormData] = useState<FormData>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [clients, setClients] = useState<Client[]>([]);
  const [employees, setEmployees] = useState<EmployeeSelectItem[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loadingLookups, setLoadingLookups] = useState(false);

  const rows = useMemo(() => data.results ?? [], [data.results]);
  const hasUnappliedFilters = ordering !== draftOrdering;

  /* ===================== HELPERS ===================== */

  const showSnack = (msg: string, severity: AlertColor = 'success') => {
    setSnack({ open: true, msg, severity });
  };

  /* ===================== LOAD DATA ===================== */

  const load = useCallback(async () => {
    setLoading(true);
    setPageError(null);
    try {
      const res = await appointmentsApi.getMy({ ordering });
      setData(res);
    } catch (err: any) {
      setPageError(parseDrfError(err).message ?? 'Błąd ładowania danych.');
      setData(EMPTY_PAGE);
    } finally {
      setLoading(false);
    }
  }, [ordering]);

  useEffect(() => {
    void load();
  }, [load]);

  /* ===================== LOAD LOOKUPS ===================== */

  const loadLookups = async () => {
    setLoadingLookups(true);
    try {
      const [c, e, s] = await Promise.all([
        clientsApi.list(),
        employeesApi.list(),
        servicesApi.list(),
      ]);

      setClients(c.results ?? []);

      // 🔥 DTO -> MODEL UI (BEZ Employee)
      setEmployees(
        (e.results ?? []).map((emp: any): EmployeeSelectItem => ({
          id: emp.id,
          label: emp.full_name || emp.user_email || `#${emp.id}`,
          skills: emp.skills ?? [],
        })),
      );

      setServices(s.results ?? []);
    } catch (err: any) {
      showSnack(parseDrfError(err).message ?? 'Błąd ładowania danych.', 'error');
    } finally {
      setLoadingLookups(false);
    }
  };

  /* ===================== FILTERS ===================== */

  const applyFilters = () => setOrdering(draftOrdering);
  const clearFilters = () => {
    setDraftOrdering('-start');
    setOrdering('-start');
  };

  /* ===================== DIALOGS ===================== */

  const openCreateDialog = () => {
    setEditMode(false);
    setEditId(null);
    setIsPastEdit(false);
    setFormData(EMPTY_FORM);
    setFormError(null);
    setDialogOpen(true);
    void loadLookups();
  };

  const openEditDialog = (appointment: Appointment) => {
    setEditMode(true);
    setEditId(appointment.id);
    setIsPastEdit(new Date(appointment.start).getTime() < Date.now());
    setFormData({
      client: appointment.client,
      employee: appointment.employee,
      service: appointment.service,
      start: new Date(appointment.start),
      end: new Date(appointment.end),
      status: appointment.status,
      internal_notes: appointment.internal_notes || '',
    });
    setFormError(null);
    setDialogOpen(true);
    void loadLookups();
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditId(null);
    setFormError(null);
  };

  /* ===================== SAVE ===================== */

  const handleSave = async () => {
    if (
      !formData.client ||
      !formData.employee ||
      !formData.service ||
      !formData.start ||
      !formData.end
    ) {
      setFormError('Uzupełnij wszystkie wymagane pola.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        client: formData.client,
        employee: formData.employee,
        service: formData.service,
        start: formData.start.toISOString(),
        end: formData.end.toISOString(),
        status: formData.status as AppointmentStatus,
        internal_notes: formData.internal_notes,
      };

      if (editMode) {
        if (!editId) {
          setFormError('Brak ID wizyty.');
          return;
        }
        await appointmentsApi.update(editId, payload);
        showSnack('Wizyta została zaktualizowana.');
      } else {
        await appointmentsApi.create(payload);
        showSnack('Wizyta została utworzona.');
      }

      closeDialog();
      await load();
    } catch (err: any) {
      setFormError(parseDrfError(err).message ?? 'Błąd zapisu.');
    } finally {
      setSubmitting(false);
    }
  };

  /* ===================== ACTIONS ===================== */

  const patchRow = (id: number, patch: Partial<Appointment>) => {
    setData((prev) => ({
      ...prev,
      results: prev.results.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    }));
  };

  const runAction = async (
    action: (id: number) => Promise<Appointment>,
    id: number,
    msg: string,
  ) => {
    setBusy(true);
    setBusyId(id);
    try {
      const updated = await action(id);
      patchRow(id, updated);
      showSnack(msg);
    } catch (err: any) {
      showSnack(parseDrfError(err).message ?? 'Błąd operacji.', 'error');
    } finally {
      setBusy(false);
      setBusyId(null);
    }
  };

  /* ===================== RENDER ===================== */

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={pl}>
      <Stack spacing={2}>
        <Typography variant="h5" fontWeight={700}>
          Wizyty pracownika
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {user?.email}
        </Typography>

        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack direction="row" spacing={1.5}>
            <FormControl size="small" sx={{ minWidth: 260 }}>
              <InputLabel>Sortowanie</InputLabel>
              <Select
                label="Sortowanie"
                value={draftOrdering}
                onChange={(e) => setDraftOrdering(e.target.value as Ordering)}
              >
                <MenuItem value="-start">{orderingLabel('-start')}</MenuItem>
                <MenuItem value="start">{orderingLabel('start')}</MenuItem>
                <MenuItem value="-created_at">{orderingLabel('-created_at')}</MenuItem>
                <MenuItem value="created_at">{orderingLabel('created_at')}</MenuItem>
                <MenuItem value="-status">{orderingLabel('-status')}</MenuItem>
                <MenuItem value="status">{orderingLabel('status')}</MenuItem>
              </Select>
            </FormControl>

            <Button variant="contained" onClick={applyFilters} disabled={!hasUnappliedFilters}>
              Zastosuj
            </Button>
            <Button variant="outlined" onClick={clearFilters}>
              Wyczyść
            </Button>
            <Button variant="contained" onClick={openCreateDialog}>
              Dodaj wizytę
            </Button>
          </Stack>

          {(loading || busy) && <LinearProgress sx={{ mt: 2 }} />}
        </Paper>

        {pageError ? (
          <Alert severity="error">{pageError}</Alert>
        ) : (
          <Stack spacing={1.5}>
            {rows.map((a) => (
              <AppointmentCard
                key={a.id}
                a={a}
                busy={busy}
                isBusy={busyId === a.id}
                onEdit={openEditDialog}
                onConfirm={(id) =>
                  void runAction(appointmentsApi.confirm, id, 'Wizyta została potwierdzona.')
                }
                onCancel={(id) =>
                  void runAction(appointmentsApi.cancel, id, 'Wizyta została anulowana.')
                }
                onComplete={(id) =>
                  void runAction(appointmentsApi.complete, id, 'Wizyta została zakończona.')
                }
                onNoShow={(id) =>
                  void runAction(appointmentsApi.noShow, id, 'Ustawiono no-show.')
                }
              />
            ))}
          </Stack>
        )}

        <AppointmentFormDialog
          open={dialogOpen}
          editMode={editMode}
          isPastEdit={isPastEdit}
          submitting={submitting}
          formError={formError}
          formData={formData}
          setFormData={setFormData}
          clients={clients}
          employees={employees}
          services={services}
          loadingLookups={loadingLookups}
          onClose={closeDialog}
          onSubmit={() => void handleSave()}
        />

        <Snackbar
          open={snack.open}
          autoHideDuration={3000}
          onClose={() => setSnack((s) => ({ ...s, open: false }))}
          message={snack.msg}
        />
      </Stack>
    </LocalizationProvider>
  );
}
