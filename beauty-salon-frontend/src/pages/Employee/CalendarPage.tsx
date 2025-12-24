import React, { useEffect, useState } from "react";
import FullCalendar from "@fullcalendar/react";
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
  Chip
} from "@mui/material";

import {
  getMyAppointments,
  confirmAppointment,
  cancelAppointment,
  completeAppointment
} from "../../api/appointments";
import type { Appointment } from "../../types";

export default function EmployeeCalendarPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // Stan dla Modala
  const [selectedAppt, setSelectedAppt] = useState<Appointment | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const now = new Date();

  const loadAppointments = async () => {
    try {
      const data = await getMyAppointments();
      const calendarEvents = data.map((a: Appointment) => ({
        id: String(a.id),
        title: a.service_name,
        start: a.start,
        end: a.end,
        // Kolory spójne z resztą systemu
        backgroundColor: a.status === "CONFIRMED" ? "#2e7d32" :
                         a.status === "PENDING" ? "#ed6c02" :
                         a.status === "COMPLETED" ? "#1976d2" : "#d32f2f",
        borderColor: "transparent",
        extendedProps: { ...a }
      }));
      setEvents(calendarEvents);
    } catch (e: any) {
      setErr("Błąd podczas ładowania terminarza.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAppointments();
  }, []);

  const handleEventClick = (info: any) => {
    setSelectedAppt(info.event.extendedProps as Appointment);
    setModalOpen(true);
  };

  const handleAction = async (fn: (id: number) => Promise<any>) => {
    if (!selectedAppt) return;
    try {
      await fn(selectedAppt.id);
      setModalOpen(false);
      await loadAppointments(); // Odświeżamy kalendarz
    } catch (e: any) {
      alert("Błąd podczas wykonywania akcji.");
    }
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}><CircularProgress /></Box>;

  return (
    <Box sx={{ p: { xs: 1, md: 3 } }}>
      <Typography variant="h5" fontWeight={600} gutterBottom>
        Mój Terminarz
      </Typography>

      {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}

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
          nowIndicator={true}
          stickyHeaderDates={true}
          eventClick={handleEventClick}
          eventTimeFormat={{
            hour: '2-digit',
            minute: '2-digit',
            meridiem: false
          }}
        />
      </Paper>

      {/* MODAL SZCZEGÓŁÓW WIZYTY */}
      <Dialog open={modalOpen} onClose={() => setModalOpen(false)} maxWidth="xs" fullWidth>
        {selectedAppt && (
          <>
            <DialogTitle sx={{ bgcolor: '#f5f5f5' }}>
              Szczegóły wizyty
            </DialogTitle>
            <DialogContent dividers>
              <Stack spacing={2} sx={{ mt: 1 }}>
                <Box>
                  <Typography variant="caption" color="textSecondary">Usługa</Typography>
                  <Typography variant="h6">{selectedAppt.service_name}</Typography>
                </Box>

                <Box>
                  <Typography variant="caption" color="textSecondary">Klient</Typography>
                  <Typography variant="body1" fontWeight={500}>{selectedAppt.client_name || "Brak danych"}</Typography>
                </Box>

                <Box>
                  <Typography variant="caption" color="textSecondary">Termin</Typography>
                  <Typography variant="body1">
                    {new Date(selectedAppt.start).toLocaleString('pl-PL')}
                  </Typography>
                </Box>

                <Box>
                  <Typography variant="caption" color="textSecondary">Status</Typography>
                  <Box sx={{ mt: 0.5 }}>
                    <Chip
                      label={selectedAppt.status_display || selectedAppt.status}
                      size="small"
                      color={selectedAppt.status === "CONFIRMED" ? "success" : "warning"}
                    />
                  </Box>
                </Box>
              </Stack>
            </DialogContent>
            <DialogActions sx={{ p: 2, justifyContent: 'space-between' }}>
              <Button onClick={() => setModalOpen(false)} color="inherit">Zamknij</Button>

              <Stack direction="row" spacing={1}>
                {selectedAppt.status === "PENDING" && (
                  <Button variant="contained" onClick={() => handleAction(confirmAppointment)}>
                    Potwierdź
                  </Button>
                )}

                {/* Logika przycisków uzależniona od czasu (tak jak na liście) */}
                {new Date(selectedAppt.start) <= now && (selectedAppt.status === 'CONFIRMED' || selectedAppt.status === 'PENDING') && (
                  <Button variant="contained" color="success" onClick={() => handleAction(completeAppointment)}>
                    Zakończ
                  </Button>
                )}

                {(selectedAppt.status === 'CONFIRMED' || selectedAppt.status === 'PENDING') && (
                  <Button color="error" onClick={() => handleAction(cancelAppointment)}>
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