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
import { appointmentsApi } from '@/api/appointments.ts';
import { clientsApi } from '@/api/clients.ts';
import { employeesApi } from '@/api/employees.ts';
import { servicesApi } from '@/api/services.ts';
import { parseDrfError } from '@/utils/drfErrors.ts';
import { useAuth } from '@/context/AuthContext.tsx';

import type {
  FormData,
  Ordering,
  SnackState,
  EmployeeSelectItem,
} from './types.ts';
import { EMPTY_FORM, EMPTY_PAGE, orderingLabel } from './utils.ts';
import AppointmentCard from './components/AppointmentCard.tsx';
import AppointmentFormDialog from './components/AppointmentFormDialog.tsx';

type EmployeeApiItem = {
  id: number;
  full_name?: string | null;
  user_email?: string | null;
  skills?: unknown;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === 'object';
}

function toErrorMessage(err: unknown): string | undefined {
  if (err instanceof Error) return err.message;
  const e = err as { message?: unknown };
  return typeof e.message === 'string' ? e.message : undefined;
}

export default function AppointmentsPage() {
  const { user } = useAuth();

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

  const [ordering, setOrdering] = useState<Ordering>('start');
  const [draftOrdering, setDraftOrdering] = useState<Ordering>('start');

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


  const showSnack = (msg: string, severity: SnackState['severity'] = 'success') => {
    setSnack({ open: true, msg, severity });
  };

  const getOnlyEmployeeId = (emps: EmployeeSelectItem[]) => {
    if (!emps?.length) return null;
    if (emps.length === 1) return emps[0].id;
    return emps[0].id;
  };

  const mapEmployeeSkillsToIds = (skills: unknown): number[] => {
    if (!Array.isArray(skills)) return [];

    const ids: number[] = [];
    for (const x of skills) {
      if (typeof x === 'number' && Number.isFinite(x)) {
        ids.push(x);
        continue;
      }
      if (isRecord(x) && typeof x.id === 'number' && Number.isFinite(x.id)) {
        ids.push(x.id);
      }
    }
    return ids;
  };


  const load = useCallback(async () => {
    setLoading(true);
    setPageError(null);
    try {
      const res = await appointmentsApi.getMy({ ordering });
      setData(res);
    } catch (err: unknown) {
      setPageError(parseDrfError(err).message ?? 'Błąd ładowania danych.');
      setData(EMPTY_PAGE);
    } finally {
      setLoading(false);
    }
  }, [ordering]);

  useEffect(() => {
    void load();
  }, [load]);


  const loadLookups = async (opts?: { keepFormEmployee?: boolean }) => {
    setLoadingLookups(true);
    try {
      const [c, e, s] = await Promise.all([
        clientsApi.list(),
        employeesApi.list(),
        servicesApi.list(),
      ]);

      setClients(c.results ?? []);

      const mappedEmployees: EmployeeSelectItem[] = (e.results ?? []).map((empRaw) => {
        const emp = empRaw as EmployeeApiItem;

        const label = emp.full_name || emp.user_email || `#${emp.id}`;

        return {
          id: emp.id,
          label,
          skills: mapEmployeeSkillsToIds(emp.skills),
        };
      });

      setEmployees(mappedEmployees);
      setServices(s.results ?? []);

      const onlyEmpId = getOnlyEmployeeId(mappedEmployees);
      if (onlyEmpId) {
        setFormData((prev) => {
          const keep = opts?.keepFormEmployee && prev.employee;
          return {
            ...prev,
            employee: keep ? prev.employee : onlyEmpId,
          };
        });
      }
    } catch (err: unknown) {
      showSnack(parseDrfError(err).message ?? toErrorMessage(err) ?? 'Błąd ładowania danych.', 'error');
    } finally {
      setLoadingLookups(false);
    }
  };


  const applyFilters = () => setOrdering(draftOrdering);
  const clearFilters = () => {
    setDraftOrdering('start');
    setOrdering('start');
  };


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
    void loadLookups({ keepFormEmployee: true });
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditId(null);
    setFormError(null);
  };


  const handleSave = async () => {
    setFormError(null);
    setSubmitting(true);

    try {
      if (!editMode) {
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

        await appointmentsApi.create({
          client: formData.client,
          employee: formData.employee,
          service: formData.service,
          start: formData.start.toISOString(),
          end: formData.end.toISOString(),
          status: 'CONFIRMED',
          internal_notes: formData.internal_notes ?? '',
        });

        showSnack('Wizyta została utworzona.');
        closeDialog();
        await load();
        return;
      }

      if (!editId) {
        setFormError('Brak ID wizyty.');
        return;
      }

      if (isPastEdit) {
        await appointmentsApi.updateNotes(editId, formData.internal_notes ?? '');
        showSnack('Notatki zostały zapisane.');
        closeDialog();
        await load();
        return;
      }

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

      await appointmentsApi.update(editId, {
        client: formData.client,
        employee: formData.employee,
        service: formData.service,
        start: formData.start.toISOString(),
        end: formData.end.toISOString(),
        status: formData.status as AppointmentStatus,
        internal_notes: formData.internal_notes ?? '',
      });

      showSnack('Wizyta została zaktualizowana.');
      closeDialog();
      await load();
    } catch (err: unknown) {
      setFormError(parseDrfError(err).message ?? 'Błąd zapisu.');
    } finally {
      setSubmitting(false);
    }
  };


  const patchRow = (id: number, patch: Partial<Appointment>) => {
    setData((prev) => ({
      ...prev,
      results: (prev.results ?? []).map((r) => (r.id === id ? { ...r, ...patch } : r)),
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
    } catch (err: unknown) {
      showSnack(parseDrfError(err).message ?? 'Błąd operacji.', 'error');
    } finally {
      setBusy(false);
      setBusyId(null);
    }
  };


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
                <MenuItem value="start">{orderingLabel('-start')}</MenuItem>
                <MenuItem value="-start">{orderingLabel('start')}</MenuItem>
                <MenuItem value="-created_at">{orderingLabel('-created_at')}</MenuItem>
                <MenuItem value="created_at">{orderingLabel('created_at')}</MenuItem>
                <MenuItem value="-status">{orderingLabel('-status')}</MenuItem>
                <MenuItem value="status">{orderingLabel('status')}</MenuItem>
              </Select>
            </FormControl>

            <Button
              variant="contained"
              onClick={applyFilters}
              disabled={!hasUnappliedFilters || loading || busy}
            >
              Zastosuj
            </Button>
            <Button variant="outlined" onClick={clearFilters} disabled={loading || busy}>
              Wyczyść
            </Button>
            <Button variant="contained" onClick={openCreateDialog} disabled={loading || busy}>
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
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert
            onClose={() => setSnack((s) => ({ ...s, open: false }))}
            severity={snack.severity}
            sx={{ width: '100%' }}
          >
            {snack.msg}
          </Alert>
        </Snackbar>
      </Stack>
    </LocalizationProvider>
  );
}
