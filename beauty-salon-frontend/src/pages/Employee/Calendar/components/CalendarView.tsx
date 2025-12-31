import React from 'react';
import FullCalendar from '@fullcalendar/react';
import type { EventInput, EventClickArg } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import plLocale from '@fullcalendar/core/locales/pl';
import { Paper, useTheme } from '@mui/material';

type Props = {
  events: EventInput[];
  onEventClick: (info: EventClickArg) => void;
};

export function CalendarView({ events, onEventClick }: Props): JSX.Element {
  const theme = useTheme();

  return (
    <Paper
      variant="outlined"
      sx={{
        p: { xs: 1, sm: 2 },
        borderRadius: 2,

        // dopasowanie FC do motywu aplikacji
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
        '& .fc-button-primary:disabled': {
          backgroundColor: theme.palette.primary.light,
          borderColor: theme.palette.primary.light,
        },

        '& .fc-toolbar-title': {
          fontWeight: 900,
          color: theme.palette.primary.main,
        },

        // najważniejsze: czytelność eventów
        '& .fc-event': {
          cursor: 'pointer',
          borderRadius: '8px',
          border: '1px solid',
          fontWeight: 800,
          fontSize: '0.85rem',
          padding: '2px 6px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
        },
        '& .fc-event-title': {
          whiteSpace: 'normal',
          lineHeight: 1.2,
        },
        '& .fc-event-time': {
          fontWeight: 900,
        },
      }}
    >
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="timeGridWeek"
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'timeGridDay,timeGridWeek,dayGridMonth',
        }}
        locale={plLocale}
        firstDay={1}
        nowIndicator
        stickyHeaderDates
        events={events}
        slotMinTime="07:00:00"
        slotMaxTime="22:00:00"
        allDaySlot={false}
        height="75vh"
        eventClick={onEventClick}
        eventTimeFormat={{
          hour: '2-digit',
          minute: '2-digit',
          meridiem: false,
        }}
      />
    </Paper>
  );
}
