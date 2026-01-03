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
import ConfirmActionDialog from './components/ConfirmActionDialog';

import type {
  AdminAppointmentFormData,
  ClientSelectItem,
  EmployeeSelectItem,
  ServiceSelectItem,
  StatusFilter,
} from './types';

import {
  canEmployeeDoService,
  friendlyAvailabilityError,
  isValidDate,
  normalizeStatus,
  toIsoString,
  toYyyyMmDd,
} from './utils';


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
  status: 'CONFIRMED',
  internal_notes: '',
};


type Slot = { start: string; end: string };

type PendingAction =
  | { type: 'cancel'; appointment: Appointment }
  | { type: 'noShow'; appointment: Appointment }
  | { type: 'complete'; appointment: Appointment }
  | null;

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export default function AppointmentsPage() {
  const [loading, setLoading] = useState(false);
  const [loadingLookups, setLoadingLookups] = useState(false);

  const [page, setPage] = useState<DRFPaginated<Appointment>>(EMPTY_PAGE);
  const [pageError, setPageError] = useState<string | null>(null);

  const [filters, setFilters] = useState<{ status: StatusFilter }>({
    status: 'ALL',
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);

  const [coreFieldsLocked, setCoreFieldsLocked] = useState(false);
  const [coreFieldsLockMessage, setCoreFieldsLockMessage] = useState<string | null>(null);

  const [formData, setFormData] = useState<AdminAppointmentFormData>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [clients, setClients] = useState<ClientSelectItem[]>([]);
  const [employees, setEmployees] = useState<EmployeeSelectItem[]>([]);
  const [services, setServices] = useState<ServiceSelectItem[]>([]);

  const [snack, setSnack] = useState<{ open: boolean; msg: string; severity: AlertColor }>({
    open: false,
    msg: '',
    severity: 'success',
  });

  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const [slotDay, setSlotDay] = useState<Date | null>(startOfDay(new Date()));
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedSlotStart, setSelectedSlotStart] = useState<string | null>(null);

  const rows = useMemo(() => page.results ?? [], [page.results]);

  const showSnack = (msg: string, severity: AlertColor = 'success') => {
    setSnack({ open: true, msg, severity });
  };

  const replaceRow = useCallback((updated: Appointment) => {
    setPage((prev) => ({
      ...prev,
      results: (prev.results ?? []).map((a) => (a.id === updated.id ? updated : a)),
    }));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setPageError(null);
    try {
      const res = await appointmentsApi.list({
        ordering: '-start',
        ...(filters.status !== 'ALL' ? { status: filters.status } : {}),
      });
      setPage(res);
    } catch (err: any) {
      setPageError(parseDrfError(err).message ?? 'Nie udało się pobrać wizyt.');
      setPage(EMPTY_PAGE);
    } finally {
      setLoading(false);
    }
  }, [filters.status]);

  const loadLookups = useCallback(async () => {
    setLoadingLookups(true);
    try {
      const [c, e, s] = await Promise.all([
        clientsApi.list({ ordering: 'last_name' }),
        employeesApi.list({ ordering: 'id' }),
        servicesApi.list({ ordering: 'name' }),
      ]);

      setClients(
        (c.results ?? []).map((cl: any) => ({
          id: cl.id,
          label: [cl.first_name, cl.last_name].filter(Boolean).join(' ') || cl.email,
        })),
      );

      setEmployees(
        (e.results ?? []).map((emp: any) => {
          const skillIds: number[] = Array.isArray(emp.skill_ids)
            ? emp.skill_ids
            : Array.isArray(emp.skills)
              ? emp.skills
                  .map((s: any) => s?.id)
                  .filter((id: any) => typeof id === 'number')
              : [];

          return {
            id: emp.id,
            label: emp.full_name || emp.user_email || `#${emp.id}`,
            skills: skillIds,
          };
        }),
      );

      setServices(
        (s.results ?? []).map((srv: any) => ({
          id: srv.id,
          name: srv.name,
          duration_minutes: srv.duration_minutes,
          price: Number(srv.price ?? 0),
        })),
      );
    } catch (err: any) {
      showSnack(parseDrfError(err).message ?? 'Nie udało się załadować danych pomocniczych.', 'error');
    } finally {
      setLoadingLookups(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreateDialog = () => {
    setEditId(null);
    setCoreFieldsLocked(false);
    setCoreFieldsLockMessage(null);
    setFormData(EMPTY_FORM);
    setFormError(null);

    const today = startOfDay(new Date());
    setSlotDay(today);
    setSlots([]);
    setSelectedSlotStart(null);
    setSlotsError(null);

    setDialogOpen(true);
    void loadLookups();
  };

  const openEditDialog = (a: Appointment) => {
    const startDate = new Date(a.start);
    const started = isValidDate(startDate) ? startDate <= new Date() : false;

    setEditId(a.id);
    setCoreFieldsLocked(started);
    setCoreFieldsLockMessage(
      started
        ? 'Ta wizyta już się rozpoczęła, możesz edytować tylko notatki wewnętrzne.'
        : null,
    );

    if (isValidDate(startDate)) {
      setSlotDay(startOfDay(startDate));
      setSelectedSlotStart(started ? null : a.start);
    } else {
      setSlotDay(startOfDay(new Date()));
      setSelectedSlotStart(null);
    }

    setFormData({
      client: a.client,
      employee: a.employee,
      service: a.service,
      start: isValidDate(startDate) ? startDate : null,
      status: normalizeStatus(a.status) ?? 'PENDING',
      internal_notes: a.internal_notes || '',
    });

    setFormError(null);
    setSlotsError(null);
    setSlots([]);
    setDialogOpen(true);
    void loadLookups();
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditId(null);
    setCoreFieldsLocked(false);
    setCoreFieldsLockMessage(null);
    setFormError(null);
    setFormData(EMPTY_FORM);

    setSlots([]);
    setSlotsError(null);
    setSelectedSlotStart(null);
  };

  const filteredServices: ServiceSelectItem[] = useMemo(() => {
    if (!formData.employee) return services;
    const emp = employees.find((e) => e.id === formData.employee);
    if (!emp || !Array.isArray(emp.skills)) return [];
    return services.filter((s) => emp.skills.includes(s.id));
  }, [employees, services, formData.employee]);

  const filteredEmployees: EmployeeSelectItem[] = useMemo(() => {
    if (!formData.service) return employees;
    const sid = formData.service;
    return employees.filter((e) => Array.isArray(e.skills) && e.skills.includes(sid));
  }, [employees, formData.service]);

  useEffect(() => {
    if (!dialogOpen || coreFieldsLocked) return;

    if (formData.employee && formData.service) {
      const emp = employees.find((e) => e.id === formData.employee);
      const ok = emp && Array.isArray(emp.skills) && emp.skills.includes(formData.service);

      if (!ok) {
        setFormData((p) => ({ ...p, service: null, start: null }));
        setSelectedSlotStart(null);
        setSlots([]);
        setSlotsError(null);
      }
    }

    if (formData.service) {
      const anyEmp = employees.some((e) => Array.isArray(e.skills) && e.skills.includes(formData.service!));
      if (!anyEmp && formData.employee) {
        setFormData((p) => ({ ...p, employee: null, start: null }));
        setSelectedSlotStart(null);
        setSlots([]);
        setSlotsError(null);
      }
    }
  }, [dialogOpen, coreFieldsLocked, employees, formData.employee, formData.service]);


  const fetchSlots = useCallback(async () => {
    if (!dialogOpen || coreFieldsLocked) return;
    if (!formData.employee || !formData.service || !slotDay) {
      setSlots([]);
      setSelectedSlotStart(null);
      return;
    }

    setSlotsLoading(true);
    setSlotsError(null);

    try {
      const dateStr = toYyyyMmDd(slotDay);
      const resp = await appointmentsApi.getAvailableSlots(formData.employee, formData.service, dateStr);
      const nextSlots: Slot[] = Array.isArray(resp?.slots) ? resp.slots : [];

      setSlots(nextSlots);

      if (selectedSlotStart && !nextSlots.some((s) => s.start === selectedSlotStart)) {
        setSelectedSlotStart(null);
        setFormData((p) => ({ ...p, start: null }));
      }
    } catch (err: any) {
      setSlots([]);
      setSelectedSlotStart(null);
      setFormData((p) => ({ ...p, start: null }));
      setSlotsError('Nie udało się pobrać wolnych terminów. Spróbuj ponownie lub zmień dzień.');
    } finally {
      setSlotsLoading(false);
    }
  }, [dialogOpen, coreFieldsLocked, formData.employee, formData.service, slotDay, selectedSlotStart]);

  useEffect(() => {
    void fetchSlots();
  }, [fetchSlots]);

  const onSelectSlotStart = (isoStart: string) => {
    setSelectedSlotStart(isoStart);
    const d = new Date(isoStart);
    setFormData((p) => ({ ...p, start: isValidDate(d) ? d : null }));
  };

  const canSubmit = useMemo(() => {
    if (loadingLookups || submitting) return false;
    if (!dialogOpen) return true;
    if (editId && coreFieldsLocked) return true;

    return Boolean(formData.client && formData.employee && formData.service && formData.start && selectedSlotStart);
  }, [
    dialogOpen,
    loadingLookups,
    submitting,
    editId,
    coreFieldsLocked,
    formData.client,
    formData.employee,
    formData.service,
    formData.start,
    selectedSlotStart,
  ]);

  const handleSave = async () => {
    setSubmitting(true);
    setFormError(null);

    try {
      if (editId && coreFieldsLocked) {
        const updated = await appointmentsApi.updateNotes(editId, formData.internal_notes);
        replaceRow(updated);
        showSnack('Notatka została zapisana.');
        closeDialog();
        return;
      }

      if (!formData.client || !formData.employee || !formData.service || !formData.start || !selectedSlotStart) {
        setFormError('Uzupełnij wymagane pola i wybierz wolny termin.');
        return;
      }

      if (!isValidDate(formData.start)) {
        setFormError('Nieprawidłowa data rozpoczęcia.');
        return;
      }

      const now = new Date();
      if (!editId && formData.start <= now) {
        setFormError('Nie można utworzyć wizyty w przeszłości.');
        return;
      }

      const status = normalizeStatus(formData.status);
      if (!status) {
        setFormError('Nieprawidłowy status wizyty.');
        return;
      }

      const employee = employees.find((e) => e.id === formData.employee);
      if (!employee) {
        setFormError('Nie znaleziono wybranego pracownika.');
        return;
      }

      const service = services.find((s) => s.id === formData.service);
      if (!service) {
        setFormError('Nie znaleziono wybranej usługi.');
        return;
      }

      if (!canEmployeeDoService(employee.skills, service.id)) {
        setFormError('Wybrany pracownik nie wykonuje tej usługi.');
        return;
      }

      const availability = await appointmentsApi.checkAvailability(
        employee.id,
        service.id,
        toIsoString(formData.start),
      );

      if (!availability.available) {
        setFormError(friendlyAvailabilityError(availability.reason));
        void fetchSlots();
        return;
      }

      const startIso = availability.start ?? toIsoString(formData.start);
      const endIso = availability.end ?? toIsoString(new Date(formData.start.getTime() + service.duration_minutes * 60 * 1000));

      if (editId) {
        const updated = await appointmentsApi.update(editId, {
          client: formData.client,
          employee: employee.id,
          service: service.id,
          start: startIso,
          end: endIso,
          status,
          internal_notes: formData.internal_notes,
        });
        replaceRow(updated);
        showSnack('Wizyta została zaktualizowana.');
      } else {
        await appointmentsApi.create({
          client: formData.client,
          employee: employee.id,
          service: service.id,
          start: startIso,
          end: endIso,
          status,
          internal_notes: formData.internal_notes,
        });
        showSnack('Wizyta została utworzona.');
        await load();
      }

      closeDialog();
    } catch (err: any) {
      setFormError(parseDrfError(err).message ?? 'Błąd zapisu.');
    } finally {
      setSubmitting(false);
    }
  };

  const runStatusAction = useCallback(
    async (
      a: Appointment,
      action: 'confirm' | 'cancel' | 'complete' | 'noShow',
      successMsg: string,
    ) => {
      setActionLoading(true);
      try {
        let updated: Appointment;
        if (action === 'confirm') updated = await appointmentsApi.confirm(a.id);
        else if (action === 'cancel') updated = await appointmentsApi.cancel(a.id);
        else if (action === 'complete') updated = await appointmentsApi.complete(a.id);
        else updated = await appointmentsApi.noShow(a.id);

        replaceRow(updated);
        showSnack(successMsg);
      } catch (err: any) {
        showSnack(parseDrfError(err).message ?? 'Nie udało się wykonać akcji.', 'error');
        await load();
      } finally {
        setActionLoading(false);
        setPendingAction(null);
      }
    },
    [load, replaceRow],
  );

  const confirmDialogConfig = useMemo(() => {
    if (!pendingAction) return null;

    const a = pendingAction.appointment;
    const base = `${a.client_name ?? 'Klient'} • ${a.service_name} • ${new Date(a.start).toLocaleString('pl-PL', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })}`;

    if (pendingAction.type === 'cancel') {
      return {
        title: 'Anulować wizytę?',
        description: `Czy na pewno chcesz anulować wizytę: ${base}?`,
        confirmLabel: 'Anuluj wizytę',
        severity: 'warning' as const,
        onConfirm: () => runStatusAction(a, 'cancel', 'Wizyta została anulowana.'),
      };
    }

    if (pendingAction.type === 'noShow') {
      return {
        title: 'Oznaczyć jako No-show?',
        description: `Czy na pewno chcesz oznaczyć jako No-show: ${base}?`,
        confirmLabel: 'Ustaw No-show',
        severity: 'warning' as const,
        onConfirm: () => runStatusAction(a, 'noShow', 'Ustawiono status: No-show.'),
      };
    }

    return {
      title: 'Zakończyć wizytę?',
      description: `Czy na pewno chcesz zakończyć wizytę: ${base}?`,
      confirmLabel: 'Zakończ wizytę',
      severity: 'info' as const,
      onConfirm: () => runStatusAction(a, 'complete', 'Wizyta została zakończona.'),
    };
  }, [pendingAction, runStatusAction]);

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={pl}>
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Stack spacing={3}>
          <Typography variant="h5" fontWeight={700}>
            Zarządzanie wizytami
          </Typography>

          <Paper variant="outlined" sx={{ p: 2 }}>
            <AppointmentFilters
              status={filters.status}
              onStatusChange={(status) => setFilters((prev) => ({ ...prev, status }))}
              onCreate={openCreateDialog}
            />
          </Paper>

          {pageError && <Alert severity="error">{pageError}</Alert>}

          {loading && <LinearProgress />}

          {!loading && (
            <Stack spacing={1.5}>
              {rows.map((a) => (
                <AppointmentListItem
                  key={a.id}
                  appointment={a}
                  onEdit={openEditDialog}
                  onConfirm={(ap) => runStatusAction(ap, 'confirm', 'Wizyta została potwierdzona.')}
                  onCancel={(ap) => setPendingAction({ type: 'cancel', appointment: ap })}
                  onComplete={(ap) => setPendingAction({ type: 'complete', appointment: ap })}
                  onNoShow={(ap) => setPendingAction({ type: 'noShow', appointment: ap })}
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
            loadingLookups={loadingLookups}
            coreFieldsLocked={coreFieldsLocked}
            coreFieldsLockMessage={coreFieldsLockMessage ?? undefined}
            filteredEmployees={filteredEmployees}
            filteredServices={filteredServices}
            slotDay={slotDay}
            setSlotDay={(d) => {
              setSlotDay(d ? startOfDay(d) : null);
              setSelectedSlotStart(null);
              setFormData((p) => ({ ...p, start: null }));
            }}
            slotsLoading={slotsLoading}
            slotsError={slotsError}
            slots={slots}
            selectedSlotStart={selectedSlotStart}
            onSelectSlotStart={onSelectSlotStart}
            onClose={closeDialog}
            onSubmit={handleSave}
            canSubmit={canSubmit}
          />

          {confirmDialogConfig && (
            <ConfirmActionDialog
              open={Boolean(confirmDialogConfig)}
              title={confirmDialogConfig.title}
              description={confirmDialogConfig.description}
              confirmLabel={confirmDialogConfig.confirmLabel}
              severity={confirmDialogConfig.severity}
              loading={actionLoading}
              onCancel={() => setPendingAction(null)}
              onConfirm={confirmDialogConfig.onConfirm}
            />
          )}

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