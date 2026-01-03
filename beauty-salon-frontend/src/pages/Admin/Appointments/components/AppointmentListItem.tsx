import React, { useMemo } from 'react';
import { Button, Chip, Paper, Stack, Typography } from '@mui/material';

import type { Appointment } from '@/types';

type Props = {
  appointment: Appointment;
  onEdit: (a: Appointment) => void;

  onConfirm: (a: Appointment) => void;
  onCancel: (a: Appointment) => void;
  onComplete: (a: Appointment) => void;
  onNoShow: (a: Appointment) => void;
};

const statusColorMap: Record<
  Appointment['status'],
  'default' | 'primary' | 'success' | 'error' | 'warning' | 'info' | 'secondary'
> = {
  PENDING: 'default',
  CONFIRMED: 'primary',
  COMPLETED: 'success',
  CANCELLED: 'error',
  NO_SHOW: 'warning',
};

function safeFormatDateTime(iso: string): { dateLabel: string; timeLabel: string } {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { dateLabel: '—', timeLabel: '—' };

  return {
    dateLabel: d.toLocaleDateString('pl-PL', { year: 'numeric', month: '2-digit', day: '2-digit' }),
    timeLabel: d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' }),
  };
}

function safeMoneyFromString(value: string | null | undefined): string | null {
  if (!value) return null;
  const n = Number(value);
  if (Number.isNaN(n)) return null;
  return `${n.toFixed(2)} zł`;
}

export default function AppointmentListItem({
  appointment,
  onEdit,
  onConfirm,
  onCancel,
  onComplete,
  onNoShow,
}: Props) {
  const { dateLabel, timeLabel } = useMemo(
    () => safeFormatDateTime(appointment.start),
    [appointment.start],
  );

  const started = useMemo(() => {
    const d = new Date(appointment.start);
    if (Number.isNaN(d.getTime())) return false;
    return d <= new Date();
  }, [appointment.start]);

  const statusColor = statusColorMap[appointment.status] ?? 'default';
  const priceLabel = safeMoneyFromString(appointment.service_price);
  const clientLabel = appointment.client_name ?? (appointment.client ? `#${appointment.client}` : '—');

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={2}
        alignItems={{ xs: 'flex-start', md: 'center' }}
        justifyContent="space-between"
      >
        <Stack spacing={0.75} sx={{ minWidth: 0 }}>
          <Typography variant="subtitle1" fontWeight={700}>
            {dateLabel} • {timeLabel}
          </Typography>

          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Typography variant="body2" color="text.secondary">
              <strong>Klient:</strong> {clientLabel}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              <strong>Pracownik:</strong> {appointment.employee_name}
            </Typography>
          </Stack>

          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Typography variant="body2" color="text.secondary">
              <strong>Usługa:</strong> {appointment.service_name}
            </Typography>
            {priceLabel && (
              <Typography variant="body2" color="text.secondary">
                <strong>Cena:</strong> {priceLabel}
              </Typography>
            )}
          </Stack>

          <Typography variant="body2" color="text.secondary">
            ID wizyty: {appointment.id}
          </Typography>

          {started && (
            <Typography variant="body2" color="text.secondary">
              Edycja ograniczona: tylko notatki
            </Typography>
          )}
        </Stack>

        <Stack spacing={1} alignItems={{ xs: 'flex-start', md: 'flex-end' }}>
          <Stack direction="row" spacing={1} alignItems="center" justifyContent="flex-end">
            <Chip label={appointment.status_display} color={statusColor} size="small" />
            <Button size="small" variant="outlined" onClick={() => onEdit(appointment)}>
              {started ? 'Edytuj notatki' : 'Edytuj'}
            </Button>
          </Stack>

          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Button
              size="small"
              variant="contained"
              disabled={!appointment.can_confirm}
              onClick={() => onConfirm(appointment)}
            >
              Potwierdź
            </Button>

            <Button
              size="small"
              variant="outlined"
              disabled={!appointment.can_cancel}
              onClick={() => onCancel(appointment)}
            >
              Anuluj
            </Button>

            <Button
              size="small"
              variant="contained"
              disabled={!appointment.can_complete}
              onClick={() => onComplete(appointment)}
            >
              Zakończ
            </Button>

            <Button
              size="small"
              variant="outlined"
              disabled={!appointment.can_no_show}
              onClick={() => onNoShow(appointment)}
            >
              No-show
            </Button>
          </Stack>
        </Stack>
      </Stack>
    </Paper>
  );
}
