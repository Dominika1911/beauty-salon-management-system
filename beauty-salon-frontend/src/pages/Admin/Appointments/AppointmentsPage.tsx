import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Container,
  LinearProgress,
  Paper,
  Snackbar,
  Stack,
  Typography,
} from '@mui/material';
import type { AlertColor } from '@mui/material/Alert';

import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { pl } from 'date-fns/locale';

import type { Appointment, DRFPaginated } from '@/types';
import { appointmentsApi } from '@/api/appointments';
import { clientsApi } from '@/api/clients';
import { employeesApi } from '@/api/employees';
import { servicesApi } from '@/api/services';
import { parseDrfError } from '@/utils/drfErrors';

import AppointmentFilters from './components/AppointmentFilters';
import AppointmentListItem from './components/AppointmentListItem';
import AppointmentFormDialog from './components/AppointmentFormDialog';

import type {
  AdminAppointmentFormData,
  ClientSelectItem,
  EmployeeSelectItem,
  ServiceSelectItem,
  StatusFilter,
} from './types';

/* ===================== CONST ===================== */

const EMPTY_PAGE: DRFPaginated<Appointment> = {
  count: 0,
  next: null,
  previous: null,
  results: [],
};

const EMPTY_FORM: AdminAppointmentFormData = {
  client: null,
  employee: null,
  service: null,
  start: null,
  status: 'PENDING',
  internal_notes: '',
};

/* ===================== PAGE ===================== */

export default function AdminAppointmentsPage() {
  const [data, setData] = useState<DRFPaginated<Appointment>>(EMPTY_PAGE);
  const [loading, setLoading] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);

  const [filters, setFilters] = useState<{ status: StatusFilter }>({
    status: 'ALL',
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);

  const [formData, setFormData] = useState<AdminAppointmentFormData>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [clients, setClients] = useState<ClientSelectItem[]>([]);
  const [employees, setEmployees] = useState<EmployeeSelectItem[]>([]);
  const [services, setServices] = useState<ServiceSelectItem[]>([]);
  const [loadingLookups, setLoadingLookups] = useState(false);

  const [snack, setSnack] = useState<{
    open: boolean;
    msg: string;
    severity: AlertColor;
  }>({
    open: false,
    msg: '',
    severity: 'success',
  });

  const rows = useMemo(() => data.results ?? [], [data.results]);

  const showSnack = (msg: string, severity: AlertColor = 'success') => {
    setSnack({ open: true, msg, severity });
  };

  /* ===== LOAD ===== */

  const load = useCallback(async () => {
    setLoading(true);
    setPageError(null);

    try {
      const params: Record<string, any> = {};
      if (filters.status !== 'ALL') params.status = filters.status;
      const res = await appointmentsApi.list(params);
      setData(res);
    } catch (err: any) {
      setPageError(parseDrfError(err).message ?? 'Błąd ładowania wizyt.');
      setData(EMPTY_PAGE);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void load();
  }, [load]);

  /* ===== LOOKUPS ===== */

  const loadLookups = async () => {
    setLoadingLookups(true);
    try {
      const [c, e, s] = await Promise.all([
        clientsApi.list(),
        employeesApi.list(),
        servicesApi.list(),
      ]);

      setClients(
        (c.results ?? []).map((cl: any) => ({
          id: cl.id,
          label: [cl.first_name, cl.last_name].filter(Boolean).join(' ') || cl.email,
        }))
      );

      setEmployees(
        (e.results ?? []).map((emp: any) => ({
          id: emp.id,
          label: emp.full_name || emp.user_email || `#${emp.id}`,
          skills: emp.skills ?? [],
        }))
      );

      setServices(
        (s.results ?? []).map((srv: any) => ({
          id: srv.id,
          name: srv.name,
          duration_minutes: srv.duration_minutes,
          price: srv.price,
        }))
      );
    } catch (err: any) {
      showSnack(parseDrfError(err).message ?? 'Błąd ładowania danych.', 'error');
    } finally {
      setLoadingLookups(false);
    }
  };

  /* ===== DIALOG ACTIONS ===== */

  const openCreateDialog = () => {
    setEditId(null);
    setFormData(EMPTY_FORM);
    setFormError(null);
    setDialogOpen(true);
    void loadLookups();
  };

  const openEditDialog = (a: Appointment) => {
    setEditId(a.id);
    setFormData({
      client: a.client,
      employee: a.employee,
      service: a.service,
      start: new Date(a.start),
      status: a.status,
      internal_notes: a.internal_notes || '',
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

  /* ===== SAVE LOGIC ===== */

  const handleSave = async () => {
    setSubmitting(true);
    setFormError(null);

    try {
      const now = new Date();
      const service = services.find((s) => s.id === formData.service);

      // --- WALIDACJA ---
      if (!formData.client || !formData.employee || !formData.service || !formData.start) {
        setFormError('Uzupełnij wszystkie wymagane pola.');
        setSubmitting(false);
        return;
      }

      if (!service) {
        setFormError('Nie znaleziono wybranej usługi.');
        setSubmitting(false);
        return;
      }

      const end = new Date(formData.start.getTime() + service.duration_minutes * 60 * 1000);

      // --- EDYCJA ---
      if (editId) {
        const isPast = new Date(formData.start) <= now;

        if (isPast) {
          await appointmentsApi.update(editId, {
            internal_notes: formData.internal_notes,
          });
          showSnack('Notatka została zapisana.');
        } else {
          await appointmentsApi.update(editId, {
            client: formData.client,
            employee: formData.employee,
            service: formData.service,
            start: formData.start,
            end,
            status: formData.status,
            internal_notes: formData.internal_notes,
          });
          showSnack('Wizyta została zaktualizowana.');
        }
      }
      // --- TWORZENIE ---
      else {
        if (formData.start <= now) {
          setFormError('Nie można utworzyć wizyty w przeszłości.');
          setSubmitting(false);
          return;
        }

        await appointmentsApi.create({
          client: formData.client,
          employee: formData.employee,
          service: formData.service,
          start: formData.start,
          end,
          status: formData.status,
          internal_notes: formData.internal_notes,
        });
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

  /* ===== RENDER ===== */

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={pl}>
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Stack spacing={3}>
          <Typography variant="h5" fontWeight={700}>
            Zarządzanie wizytami
          </Typography>

          <Paper variant="outlined" sx={{ p: 2 }}>
            <AppointmentFilters
              filters={filters}
              setFilters={setFilters}
              onCreate={openCreateDialog}
              loading={loading}
            />
            {loading && <LinearProgress sx={{ mt: 2 }} />}
          </Paper>

          {pageError ? (
            <Alert severity="error">{pageError}</Alert>
          ) : (
            <Stack spacing={1.5}>
              {rows.map((a) => (
                <AppointmentListItem
                  key={a.id}
                  appointment={a}
                  onEdit={openEditDialog}
                />
              ))}
              {!loading && rows.length === 0 && (
                <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
                  Brak wizyt pasujących do filtrów.
                </Typography>
              )}
            </Stack>
          )}

          <AppointmentFormDialog
            open={dialogOpen}
            editMode={Boolean(editId)}
            submitting={submitting}
            formError={formError}
            formData={formData}
            setFormData={setFormData}
            clients={clients}
            employees={employees}
            services={services}
            loadingLookups={loadingLookups}
            onClose={closeDialog}
            onSubmit={handleSave}
          />

          <Snackbar
            open={snack.open}
            autoHideDuration={3000}
            onClose={() => setSnack((s) => ({ ...s, open: false }))}
          >
            <Alert severity={snack.severity} variant="filled" sx={{ width: '100%' }}>
              {snack.msg}
            </Alert>
          </Snackbar>
        </Stack>
      </Container>
    </LocalizationProvider>
  );
}