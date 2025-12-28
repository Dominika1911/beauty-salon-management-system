import React, { useCallback, useEffect, useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import type { EventInput, EventClickArg } from "@fullcalendar/core";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import plLocale from "@fullcalendar/core/locales/pl";
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
} from "@mui/material";
import type { AlertColor } from "@mui/material/Alert";

import { appointmentsApi } from "@/api/appointments";
import type { Appointment, AppointmentStatus } from "@/types";
import { parseDrfError } from "@/utils/drfErrors";

/* =========================
   HELPERS
   ========================= */

type SnackState = { open: boolean; msg: string; severity: AlertColor };

function statusChipColor(
  status: AppointmentStatus
): "default" | "success" | "warning" | "error" {
  switch (status) {
    case "CONFIRMED":
      return "success";
    case "PENDING":
      return "warning";
    case "CANCELLED":
      return "error";
    case "COMPLETED":
      return "success";
    case "NO_SHOW":
      return "error";
    default:
      return "default";
  }
}

// ✅ bez custom kolorów (czytelnie i spójnie z MUI); zostawiamy eventy neutralne
function formatPL(dt: string): string {
  const d = new Date(dt);
  return Number.isNaN(d.getTime())
    ? dt
    : d.toLocaleString("pl-PL", { dateStyle: "long", timeStyle: "short" });
}

function statusLabel(status: AppointmentStatus): string {
  switch (status) {
    case "PENDING":
      return "Oczekuje";
    case "CONFIRMED":
      return "Potwierdzona";
    case "COMPLETED":
      return "Zakończona";
    case "CANCELLED":
      return "Anulowana";
    case "NO_SHOW":
      return "No-show";
    default:
      return status;
  }
}

/* =========================
   COMPONENT
   ========================= */

export default function EmployeeCalendarPage(): JSX.Element {
  const [events, setEvents] = useState<EventInput[]>([]);
  const [loading, setLoading] = useState(true);

  const [pageError, setPageError] = useState<string | null>(null);
  const [snack, setSnack] = useState<SnackState>({
    open: false,
    msg: "",
    severity: "info",
  });

  const [selectedAppt, setSelectedAppt] = useState<Appointment | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [busyAction, setBusyAction] = useState(false);

  const busy = loading || busyAction;

  /* =========================
     LOAD ALL APPOINTMENTS (ALL PAGES)
     ========================= */
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

      const calendarEvents: EventInput[] = all.map((a) => ({
        id: String(a.id),
        title: `${a.service_name} • ${a.client_name ?? "Klient"}`,
        start: a.start,
        end: a.end,
        extendedProps: { ...a },
      }));

      setEvents(calendarEvents);
    } catch (e: unknown) {
      const parsed = parseDrfError(e);
      setPageError(parsed.message || "Nie udało się pobrać terminarza.");
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAppointments();
  }, [loadAppointments]);

  /* =========================
     EVENT HANDLERS
     ========================= */

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
    // 1) update modal state
    setSelectedAppt(updated);

    // 2) update event in calendar list
    setEvents((prev) =>
      prev.map((ev) => {
        if (String(ev.id) !== String(updated.id)) return ev;
        return {
          ...ev,
          title: `${updated.service_name} • ${updated.client_name ?? "Klient"}`,
          start: updated.start,
          end: updated.end,
          extendedProps: { ...updated },
        };
      })
    );
  }, []);

  const handleAction = async (fn: (id: number) => Promise<Appointment>, successMsg: string) => {
    if (!selectedAppt) return;

    setBusyAction(true);
    setPageError(null);

    try {
      const updated = await fn(selectedAppt.id);
      patchEvent(updated); // ✅ bez reloadu wszystkich stron
      setSnack({ open: true, msg: successMsg, severity: "success" });
      closeModal();
    } catch (e: unknown) {
      const parsed = parseDrfError(e);
      setPageError(parsed.message || "Nie udało się wykonać akcji.");
    } finally {
      setBusyAction(false);
    }
  };

  /* =========================
     BACKEND FLAGS
     ========================= */

  const canConfirm = useMemo(() => Boolean(selectedAppt?.can_confirm), [selectedAppt]);
  const canComplete = useMemo(() => Boolean(selectedAppt?.can_complete), [selectedAppt]);
  const canCancel = useMemo(() => Boolean(selectedAppt?.can_cancel), [selectedAppt]);
  const canNoShow = useMemo(() => Boolean(selectedAppt?.can_no_show), [selectedAppt]);

  /* =========================
     RENDER
     ========================= */

  if (loading && events.length === 0) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", p: 5 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Stack
      spacing={2.5}
      sx={{ width: "100%", maxWidth: 1200, mx: "auto", px: { xs: 1, sm: 2 }, py: { xs: 2, sm: 3 } }}
    >
      {loading && <LinearProgress />}

      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={2}
        alignItems={{ xs: "stretch", md: "center" }}
        justifyContent="space-between"
      >
        <Box>
          <Typography variant="h5" fontWeight={900}>
            Mój terminarz
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Kliknij wizytę w kalendarzu, aby zobaczyć szczegóły i dostępne akcje.
          </Typography>
        </Box>

        <Button variant="outlined" onClick={() => void loadAppointments()} disabled={busy}>
          Odśwież
        </Button>
      </Stack>

      {pageError && (
        <Alert severity="error" onClose={() => setPageError(null)}>
          {pageError}
        </Alert>
      )}

      <Paper variant="outlined" sx={{ p: { xs: 1, sm: 2 }, borderRadius: 2 }}>
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: "dayGridMonth,timeGridWeek,timeGridDay",
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
            hour: "2-digit",
            minute: "2-digit",
            meridiem: false,
          }}
        />
      </Paper>

      {/* =========================
         MODAL
         ========================= */}
      <Dialog open={modalOpen} onClose={closeModal} maxWidth="xs" fullWidth>
        <DialogTitle>Szczegóły wizyty</DialogTitle>

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
                  {selectedAppt.client_name ?? "—"}
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
                    label={selectedAppt.status_display || statusLabel(selectedAppt.status)}
                    size="small"
                    color={statusChipColor(selectedAppt.status)}
                    variant="outlined"
                  />
                </Box>
              </Box>

              {(canConfirm || canComplete || canCancel || canNoShow) ? null : (
                <Alert severity="info" sx={{ mb: 0 }}>
                  Dla tej wizyty nie ma dostępnych akcji.
                </Alert>
              )}
            </Stack>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={closeModal} disabled={busyAction}>
            Zamknij
          </Button>

          {selectedAppt && (
            <Stack direction="row" spacing={1} sx={{ ml: "auto" }}>
              {canConfirm && (
                <Button
                  variant="contained"
                  onClick={() => void handleAction(appointmentsApi.confirm, "Wizyta potwierdzona.")}
                  disabled={busyAction}
                  startIcon={busyAction ? <CircularProgress size={18} /> : undefined}
                >
                  Potwierdź
                </Button>
              )}

              {canComplete && (
                <Button
                  variant="contained"
                  color="success"
                  onClick={() => void handleAction(appointmentsApi.complete, "Wizyta zakończona.")}
                  disabled={busyAction}
                  startIcon={busyAction ? <CircularProgress size={18} /> : undefined}
                >
                  Zakończ
                </Button>
              )}

              {canCancel && (
                <Button
                  variant="outlined"
                  color="error"
                  onClick={() => void handleAction(appointmentsApi.cancel, "Wizyta anulowana.")}
                  disabled={busyAction}
                  startIcon={busyAction ? <CircularProgress size={18} /> : undefined}
                >
                  Anuluj
                </Button>
              )}

              {canNoShow && (
                <Button
                  variant="contained"
                  color="error"
                  onClick={() => void handleAction(appointmentsApi.noShow, "Ustawiono no-show.")}
                  disabled={busyAction}
                  startIcon={busyAction ? <CircularProgress size={18} /> : undefined}
                >
                  No-show
                </Button>
              )}
            </Stack>
          )}
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snack.open}
        autoHideDuration={3000}
        onClose={() => setSnack((p) => ({ ...p, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity={snack.severity}
          onClose={() => setSnack((p) => ({ ...p, open: false }))}
          sx={{ width: "100%" }}
        >
          {snack.msg}
        </Alert>
      </Snackbar>
    </Stack>
  );
}
