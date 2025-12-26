import React, { useEffect, useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import type { EventInput } from "@fullcalendar/core";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import plLocale from "@fullcalendar/core/locales/pl";
import {
  Paper,
  Box,
  CircularProgress,
  Typography,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Stack,
  Chip,
} from "@mui/material";

import { appointmentsApi } from "@/api/appointments";
import type { Appointment, AppointmentStatus } from "@/types";

/* =========================
   HELPERS
   ========================= */

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
    default:
      return "default";
  }
}

function eventBg(status: AppointmentStatus) {
  switch (status) {
    case "CONFIRMED":
      return "#2e7d32";
    case "PENDING":
      return "#ed6c02";
    case "COMPLETED":
      return "#1976d2";
    case "CANCELLED":
      return "#d32f2f";
    default:
      return "#9e9e9e";
  }
}

/* =========================
   COMPONENT
   ========================= */

export default function EmployeeCalendarPage(): JSX.Element {
  const [events, setEvents] = useState<EventInput[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [selectedAppt, setSelectedAppt] = useState<Appointment | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  /* =========================
     LOAD ALL APPOINTMENTS (ALL PAGES)
     ========================= */
  const loadAppointments = async () => {
    setErr("");
    setLoading(true);

    try {
      let page = 1;
      let all: Appointment[] = [];
      let next: string | null = null;

      do {
        const res = await appointmentsApi.getMy({ page });
        all = all.concat(res.results);
        next = res.next;
        page += 1;
      } while (next);

      const calendarEvents: EventInput[] = all.map((a) => ({
        id: String(a.id),
        title: a.service_name,
        start: a.start,
        end: a.end,
        backgroundColor: eventBg(a.status),
        borderColor: "transparent",
        extendedProps: { ...a },
      }));

      setEvents(calendarEvents);
    } catch (e: any) {
      setErr(
        e?.response?.data?.detail ||
          e?.message ||
          "Błąd podczas ładowania terminarza."
      );
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAppointments();
  }, []);

  /* =========================
     EVENT HANDLERS
     ========================= */

  const handleEventClick = (info: any) => {
    setSelectedAppt(info.event.extendedProps as Appointment);
    setModalOpen(true);
  };

  const handleAction = async (fn: (id: number) => Promise<Appointment>) => {
    if (!selectedAppt) return;

    setBusy(true);
    try {
      await fn(selectedAppt.id);
      setModalOpen(false);
      setSelectedAppt(null);
      await loadAppointments();
    } catch (e: any) {
      alert(
        e?.response?.data?.detail ||
          e?.message ||
          "Błąd podczas wykonywania akcji."
      );
    } finally {
      setBusy(false);
    }
  };

  /* =========================
     BACKEND FLAGS
     ========================= */

  const canConfirm = useMemo(
    () => Boolean(selectedAppt?.can_confirm),
    [selectedAppt]
  );
  const canComplete = useMemo(
    () => Boolean(selectedAppt?.can_complete),
    [selectedAppt]
  );
  const canCancel = useMemo(
    () => Boolean(selectedAppt?.can_cancel),
    [selectedAppt]
  );

  /* =========================
     RENDER
     ========================= */

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", p: 5 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 1, md: 3 } }}>
      <Typography variant="h5" fontWeight={600} gutterBottom>
        Mój Terminarz
      </Typography>

      {err && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {err}
        </Alert>
      )}

      <Paper sx={{ p: 2, borderRadius: 2, boxShadow: 3 }}>
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
      <Dialog
        open={modalOpen}
        onClose={() => (!busy ? setModalOpen(false) : null)}
        maxWidth="xs"
        fullWidth
      >
        {selectedAppt && (
          <>
            <DialogTitle sx={{ bgcolor: "#f5f5f5" }}>
              Szczegóły wizyty
            </DialogTitle>

            <DialogContent dividers>
              <Stack spacing={2} sx={{ mt: 1 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Usługa
                  </Typography>
                  <Typography variant="h6">
                    {selectedAppt.service_name}
                  </Typography>
                </Box>

                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Klient
                  </Typography>
                  <Typography variant="body1" fontWeight={500}>
                    {selectedAppt.client_name || "Brak danych"}
                  </Typography>
                </Box>

                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Termin
                  </Typography>
                  <Typography variant="body1">
                    {new Date(selectedAppt.start).toLocaleString("pl-PL")}
                  </Typography>
                </Box>

                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Status
                  </Typography>
                  <Box sx={{ mt: 0.5 }}>
                    <Chip
                      label={
                        selectedAppt.status_display || selectedAppt.status
                      }
                      size="small"
                      color={statusChipColor(selectedAppt.status)}
                      variant="outlined"
                    />
                  </Box>
                </Box>
              </Stack>
            </DialogContent>

            <DialogActions sx={{ p: 2, justifyContent: "space-between" }}>
              <Button
                onClick={() => setModalOpen(false)}
                color="inherit"
                disabled={busy}
              >
                Zamknij
              </Button>

              <Stack direction="row" spacing={1}>
                {canConfirm && (
                  <Button
                    variant="contained"
                    onClick={() =>
                      handleAction(appointmentsApi.confirm)
                    }
                    disabled={busy}
                  >
                    Potwierdź
                  </Button>
                )}

                {canComplete && (
                  <Button
                    variant="contained"
                    color="success"
                    onClick={() =>
                      handleAction(appointmentsApi.complete)
                    }
                    disabled={busy}
                  >
                    Zakończ
                  </Button>
                )}

                {canCancel && (
                  <Button
                    color="error"
                    onClick={() =>
                      handleAction(appointmentsApi.cancel)
                    }
                    disabled={busy}
                  >
                    Anuluj
                  </Button>
                )}
              </Stack>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
}
