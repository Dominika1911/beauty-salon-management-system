import React, { useCallback, useEffect, useState } from 'react';
import type { EventInput, EventClickArg } from '@fullcalendar/core';
import {
  Alert,
  Box,
  Chip,
  Divider,
  LinearProgress,
  Snackbar,
  Stack,
  Typography,
} from '@mui/material';
import type { AlertColor } from '@mui/material/Alert';

import { appointmentsApi } from '@/api/appointments';
import type { Appointment } from '@/types';
import { parseDrfError } from '@/utils/drfErrors';

import { CalendarView } from './components/CalendarView';
import { AppointmentDetailsDialog } from './components/AppointmentDetailsDialog';

type SnackState = { open: boolean; msg: string; severity: AlertColor };

const eventColorsByStatus = {
  CONFIRMED: {
    background: '#E3F2FD',
    border: '#1976D2',
    text: '#0D47A1',
  },
  PENDING: {
    background: '#FFF8E1',
    border: '#F9A825',
    text: '#6D4C41',
  },
  COMPLETED: {
    background: '#E8F5E9',
    border: '#2E7D32',
    text: '#1B5E20',
  },
  CANCELLED: {
    background: '#FCE4EC',
    border: '#C2185B',
    text: '#880E4F',
  },
  NO_SHOW: {
    background: '#F3E5F5',
    border: '#6A1B9A',
    text: '#4A148C',
  },
} as const;

export default function EmployeeCalendarPage() {
  const [events, setEvents] = useState<EventInput[]>([]);
  const [loading, setLoading] = useState(true);

  const [pageError, setPageError] = useState<string | null>(null);
  const [selectedAppt, setSelectedAppt] = useState<Appointment | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [busyAction, setBusyAction] = useState(false);

  const [snack, setSnack] = useState<SnackState>({
    open: false,
    msg: '',
    severity: 'success',
  });

  const loadAppointments = useCallback(async () => {
    setLoading(true);
    setPageError(null);

    try {
      let page = 1;
      let next: string | null = null;
      const all: Appointment[] = [];

      do {
        const res = await appointmentsApi.getMy({ page });
        all.push(...(res.results ?? []));
        next = res.next;
        page += 1;
      } while (next);

      const calendarEvents: EventInput[] = all.map((a) => {
        const color = eventColorsByStatus[a.status] ?? eventColorsByStatus.PENDING;
        const isPast = new Date(a.end) < new Date();

        return {
          id: String(a.id),
          title: `${a.service_name} • ${a.client_name ?? 'Klient'}`,
          start: a.start,
          end: a.end,
          extendedProps: { ...a },
          backgroundColor: color.background,
          borderColor: color.border,
          textColor: color.text,
          opacity: isPast ? 0.6 : 1,
        };
      });

      setEvents(calendarEvents);
    } catch (e: unknown) {
      const parsed = parseDrfError(e);
      setPageError(parsed.message || 'Nie udało się pobrać terminarza.');
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAppointments();
  }, [loadAppointments]);

  const handleEventClick = (info: EventClickArg) => {
    const appt = info.event.extendedProps as unknown as Appointment;
    setSelectedAppt(appt);
    setModalOpen(true);
  };

  const closeModal = () => {
    if (busyAction) return;
    setModalOpen(false);
    setSelectedAppt(null);
  };

  const patchEvent = useCallback((updated: Appointment) => {
    setSelectedAppt(updated);

    setEvents((prev) =>
      prev.map((ev) => {
        if (String(ev.id) !== String(updated.id)) return ev;

        const color = eventColorsByStatus[updated.status] ?? eventColorsByStatus.PENDING;
        const isPast = new Date(updated.end) < new Date();

        return {
          ...ev,
          title: `${updated.service_name} • ${updated.client_name ?? 'Klient'}`,
          start: updated.start,
          end: updated.end,
          extendedProps: { ...updated },
          backgroundColor: color.background,
          borderColor: color.border,
          textColor: color.text,
          opacity: isPast ? 0.6 : 1,
        };
      }),
    );
  }, []);

  const handleAction = async (fn: (id: number) => Promise<Appointment>, successMsg: string) => {
    if (!selectedAppt) return;

    setBusyAction(true);
    setPageError(null);

    try {
      const updated = await fn(selectedAppt.id);
      patchEvent(updated);
      setSnack({ open: true, msg: successMsg, severity: 'success' });
      closeModal();
    } catch (e: unknown) {
      const parsed = parseDrfError(e);
      setPageError(parsed.message || 'Nie udało się wykonać akcji.');
    } finally {
      setBusyAction(false);
    }
  };

  return (
    <Stack
      spacing={2.5}
      sx={{
        width: '100%',
        maxWidth: 1200,
        mx: 'auto',
        px: { xs: 1, sm: 2 },
        py: { xs: 2, sm: 3 },
      }}
    >
      {loading && <LinearProgress color="primary" />}

      <Box>
        <Typography variant="h5" fontWeight={900} color="primary">
          Mój terminarz
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Kolory oznaczają status wizyty.
        </Typography>
      </Box>

      <Stack spacing={1.2}>
        <Typography variant="subtitle2" fontWeight={800} color="primary">
          Legenda statusów
        </Typography>

        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
          <Chip label="Potwierdzona" size="small" variant="outlined"
            sx={{ bgcolor: '#E3F2FD', borderColor: '#1976D2', color: '#0D47A1', fontWeight: 800 }} />
          <Chip label="Oczekująca" size="small" variant="outlined"
            sx={{ bgcolor: '#FFF8E1', borderColor: '#F9A825', color: '#6D4C41', fontWeight: 800 }} />
          <Chip label="Zakończona" size="small" variant="outlined"
            sx={{ bgcolor: '#E8F5E9', borderColor: '#2E7D32', color: '#1B5E20', fontWeight: 800 }} />
          <Chip label="Anulowana" size="small" variant="outlined"
            sx={{ bgcolor: '#FCE4EC', borderColor: '#C2185B', color: '#880E4F', fontWeight: 800 }} />
          <Chip label="No-show" size="small" variant="outlined"
            sx={{ bgcolor: '#F3E5F5', borderColor: '#6A1B9A', color: '#4A148C', fontWeight: 800 }} />
        </Stack>

        <Divider />
      </Stack>

      {pageError && !modalOpen && (
        <Alert severity="error" variant="outlined">
          {pageError}
        </Alert>
      )}

      <CalendarView events={events} onEventClick={handleEventClick} />

      <AppointmentDetailsDialog
        open={modalOpen}
        busyAction={busyAction}
        selectedAppt={selectedAppt}
        pageError={pageError}
        onClose={closeModal}
        onConfirm={() => void handleAction(appointmentsApi.confirm, 'Wizyta potwierdzona.')}
        onComplete={() => void handleAction(appointmentsApi.complete, 'Wizyta zakończona.')}
        onCancel={() => void handleAction(appointmentsApi.cancel, 'Wizyta anulowana.')}
        onNoShow={() => void handleAction(appointmentsApi.noShow, 'Oznaczono jako no-show.')}
      />

      <Snackbar
        open={snack.open}
        autoHideDuration={3000}
        onClose={() => setSnack((p) => ({ ...p, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={snack.severity}
          onClose={() => setSnack((p) => ({ ...p, open: false }))}
          sx={{ width: '100%' }}
        >
          {snack.msg}
        </Alert>
      </Snackbar>
    </Stack>
  );
}