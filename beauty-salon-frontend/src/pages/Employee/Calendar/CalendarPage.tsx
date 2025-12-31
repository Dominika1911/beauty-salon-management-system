import React, { useCallback, useEffect, useMemo, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import type { EventInput, EventClickArg } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import plLocale from '@fullcalendar/core/locales/pl';
import {
    Alert,
    Box,
    Button,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    LinearProgress,
    Paper,
    Snackbar,
    Stack,
    Typography,
    Chip,
    useTheme, // Dodajemy useTheme
} from '@mui/material';
import type { AlertColor } from '@mui/material/Alert';

import { appointmentsApi } from '@/api/appointments';
import type { Appointment, AppointmentStatus } from '@/types';
import { parseDrfError } from '@/utils/drfErrors';

/* =========================
   HELPERS
   ========================= */

type SnackState = { open: boolean; msg: string; severity: AlertColor };

// Zmieniamy kolory statusów na bardziej pastelowe, pasujące do MUI
function statusChipColor(
    status: AppointmentStatus,
): 'default' | 'success' | 'warning' | 'error' | 'primary' {
    switch (status) {
        case 'CONFIRMED':
            return 'primary'; // Różowy dla potwierdzonych
        case 'PENDING':
            return 'warning';
        case 'CANCELLED':
            return 'error';
        case 'COMPLETED':
            return 'success';
        case 'NO_SHOW':
            return 'error';
        default:
            return 'default';
    }
}

function formatPL(dt: string): string {
    const d = new Date(dt);
    return Number.isNaN(d.getTime())
        ? dt
        : d.toLocaleString('pl-PL', { dateStyle: 'long', timeStyle: 'short' });
}

function statusLabel(status: AppointmentStatus): string {
    switch (status) {
        case 'PENDING':
            return 'Oczekuje';
        case 'CONFIRMED':
            return 'Potwierdzona';
        case 'COMPLETED':
            return 'Zakończona';
        case 'CANCELLED':
            return 'Anulowana';
        case 'NO_SHOW':
            return 'No-show';
        default:
            return status;
    }
}

/* =========================
   COMPONENT
   ========================= */

export default function EmployeeCalendarPage(): JSX.Element {
    const theme = useTheme(); // Wyciągamy kolory z motywu
    const [events, setEvents] = useState<EventInput[]>([]);
    const [loading, setLoading] = useState(true);

    const [pageError, setPageError] = useState<string | null>(null);
    const [snack, setSnack] = useState<SnackState>({
        open: false,
        msg: '',
        severity: 'info',
    });

    const [selectedAppt, setSelectedAppt] = useState<Appointment | null>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [busyAction, setBusyAction] = useState(false);

    const busy = loading || busyAction;

    const loadAppointments = useCallback(async () => {
        setPageError(null);
        setLoading(true);

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

            // Stylizujemy eventy kolorami z motywu
            const calendarEvents: EventInput[] = all.map((a) => ({
                id: String(a.id),
                title: `${a.service_name} • ${a.client_name ?? 'Klient'}`,
                start: a.start,
                end: a.end,
                extendedProps: { ...a },
                // Różowy dla wszystkich wizyt w kalendarzu
                backgroundColor: theme.palette.primary.light,
                borderColor: theme.palette.primary.main,
                textColor: theme.palette.primary.contrastText,
            }));

            setEvents(calendarEvents);
        } catch (e: unknown) {
            const parsed = parseDrfError(e);
            setPageError(parsed.message || 'Nie udało się pobrać terminarza.');
            setEvents([]);
        } finally {
            setLoading(false);
        }
    }, [theme]); // Dodajemy theme do dependencji

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
                return {
                    ...ev,
                    title: `${updated.service_name} • ${updated.client_name ?? 'Klient'}`,
                    start: updated.start,
                    end: updated.end,
                    extendedProps: { ...updated },
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

    const canConfirm = useMemo(() => Boolean(selectedAppt?.can_confirm), [selectedAppt]);
    const canComplete = useMemo(() => Boolean(selectedAppt?.can_complete), [selectedAppt]);
    const canCancel = useMemo(() => Boolean(selectedAppt?.can_cancel), [selectedAppt]);
    const canNoShow = useMemo(() => Boolean(selectedAppt?.can_no_show), [selectedAppt]);

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

            <Stack
                direction={{ xs: 'column', md: 'row' }}
                spacing={2}
                alignItems={{ xs: 'stretch', md: 'center' }}
                justifyContent="space-between"
            >
                <Box>
                    <Typography variant="h5" fontWeight={900} color="primary">
                        Mój terminarz
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        Kliknij wizytę w kalendarzu, aby zobaczyć szczegóły i dostępne akcje.
                    </Typography>
                </Box>

                <Button
                    variant="outlined"
                    color="primary"
                    onClick={() => void loadAppointments()}
                    disabled={busy}
                >
                    Odśwież
                </Button>
            </Stack>

            {pageError && (
                <Alert severity="error" onClose={() => setPageError(null)}>
                    {pageError}
                </Alert>
            )}

            <Paper
                variant="outlined"
                sx={{
                    p: { xs: 1, sm: 2 },
                    borderRadius: 2,
                    // CSS Override dla FullCalendar, aby pasował do różowego motywu
                    '& .fc': {
                        '--fc-today-bg-color': 'rgba(216, 27, 96, 0.05)',
                        '--fc-now-indicator-color': theme.palette.primary.main,
                        '--fc-border-color': 'rgba(216, 27, 96, 0.12)',
                    },
                    '& .fc-button-primary': {
                        backgroundColor: theme.palette.primary.main,
                        borderColor: theme.palette.primary.main,
                    },
                    '& .fc-button-primary:hover': {
                        backgroundColor: theme.palette.secondary.main,
                    },
                    '& .fc-event': {
                        cursor: 'pointer',
                        borderRadius: '6px',
                        border: 'none',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                        padding: '2px',
                    },
                }}
            >
                <FullCalendar
                    plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                    initialView="timeGridWeek"
                    headerToolbar={{
                        left: 'prev,next today',
                        center: 'title',
                        right: 'dayGridMonth,timeGridWeek,timeGridDay',
                    }}
                    locale={plLocale}
                    events={events}
                    slotMinTime="07:00:00"
                    slotMaxTime="22:00:00"
                    allDaySlot={false}
                    height="75vh"
                    nowIndicator
                    stickyHeaderDates
                    eventClick={handleEventClick}
                    eventTimeFormat={{
                        hour: '2-digit',
                        minute: '2-digit',
                        meridiem: false,
                    }}
                />
            </Paper>

            {/* MODAL I SNACKBAR BEZ ZMIAN (UŻYWAJĄ JUŻ PRIMARY) */}
            {/* ... reszta kodu Dialogu ... */}
            <Dialog open={modalOpen} onClose={closeModal} maxWidth="xs" fullWidth>
                <DialogTitle sx={{ fontWeight: 800, color: 'primary.main' }}>
                    Szczegóły wizyty
                </DialogTitle>
                <DialogContent dividers>
                    {!selectedAppt ? (
                        <Typography variant="body2" color="text.secondary">
                            Brak danych wizyty.
                        </Typography>
                    ) : (
                        <Stack spacing={2} sx={{ mt: 0.5 }}>
                            <Box>
                                <Typography variant="caption" color="text.secondary">
                                    Usługa
                                </Typography>
                                <Typography variant="h6" fontWeight={900}>
                                    {selectedAppt.service_name}
                                </Typography>
                            </Box>
                            <Box>
                                <Typography variant="caption" color="text.secondary">
                                    Klient
                                </Typography>
                                <Typography variant="body1" fontWeight={600}>
                                    {selectedAppt.client_name ?? '—'}
                                </Typography>
                            </Box>
                            <Box>
                                <Typography variant="caption" color="text.secondary">
                                    Termin
                                </Typography>
                                <Typography variant="body1">
                                    {formatPL(selectedAppt.start)} – {formatPL(selectedAppt.end)}
                                </Typography>
                            </Box>
                            <Box>
                                <Typography variant="caption" color="text.secondary">
                                    Status
                                </Typography>
                                <Box sx={{ mt: 0.5 }}>
                                    <Chip
                                        label={
                                            selectedAppt.status_display ||
                                            statusLabel(selectedAppt.status)
                                        }
                                        size="small"
                                        color={statusChipColor(selectedAppt.status)}
                                        variant="outlined"
                                        sx={{ fontWeight: 700 }}
                                    />
                                </Box>
                            </Box>
                        </Stack>
                    )}
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={closeModal} disabled={busyAction}>
                        Zamknij
                    </Button>
                    {selectedAppt && (
                        <Stack direction="row" spacing={1} sx={{ ml: 'auto' }}>
                            {canConfirm && (
                                <Button
                                    variant="contained"
                                    onClick={() =>
                                        void handleAction(
                                            appointmentsApi.confirm,
                                            'Wizyta potwierdzona.',
                                        )
                                    }
                                    disabled={busyAction}
                                >
                                    Potwierdź
                                </Button>
                            )}
                            {canComplete && (
                                <Button
                                    variant="contained"
                                    color="success"
                                    onClick={() =>
                                        void handleAction(
                                            appointmentsApi.complete,
                                            'Wizyta zakończona.',
                                        )
                                    }
                                    disabled={busyAction}
                                >
                                    Zakończ
                                </Button>
                            )}
                            {canCancel && (
                                <Button
                                    variant="outlined"
                                    color="error"
                                    onClick={() =>
                                        void handleAction(
                                            appointmentsApi.cancel,
                                            'Wizyta anulowana.',
                                        )
                                    }
                                    disabled={busyAction}
                                >
                                    Anuluj
                                </Button>
                            )}
                            {canNoShow && (
                                <Button
                                    variant="contained"
                                    color="error"
                                    onClick={() =>
                                        void handleAction(
                                            appointmentsApi.noShow,
                                            'Ustawiono no-show.',
                                        )
                                    }
                                    disabled={busyAction}
                                >
                                    No-show
                                </Button>
                            )}
                        </Stack>
                    )}
                </DialogActions>
            </Dialog>
            {/* ... reszta kodu Snackbar ... */}
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
