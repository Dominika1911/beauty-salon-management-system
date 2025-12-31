import React from 'react';
import { Box, Button, Chip, CircularProgress, Paper, Stack, Typography } from '@mui/material';
import type { Appointment } from '@/types';
import { statusColor, formatPrice, formatDateTimePL } from '@/utils/appointmentUtils';

type Props = {
  a: Appointment;
  busy: boolean;
  isBusy: boolean;

  onEdit: (a: Appointment) => void;
  onConfirm: (id: number) => void;
  onCancel: (id: number) => void;
  onComplete: (id: number) => void;
  onNoShow: (id: number) => void;
};

export default function AppointmentCard({
  a,
  busy,
  isBusy,
  onEdit,
  onConfirm,
  onCancel,
  onComplete,
  onNoShow,
}: Props) {
  const canConfirm = a.can_confirm;
  const canComplete = a.can_complete;
  const canNoShow = a.can_no_show;
  const statusBlockedForCancel = a.status === 'COMPLETED' || a.status === 'CANCELLED';
  const canCancelUi = a.can_cancel && !statusBlockedForCancel;

  return (
    <Paper key={a.id} variant="outlined" sx={{ p: 2 }}>
      <Stack spacing={1.25}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1}
          alignItems={{ sm: 'center' }}
          justifyContent="space-between"
        >
          <Box>
            <Typography variant="subtitle1" fontWeight={700}>
              {a.service_name}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Klient: <strong>{a.client_name ?? '—'}</strong>
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Termin: <strong>{formatDateTimePL(a.start)}</strong> –{' '}
              <strong>{formatDateTimePL(a.end)}</strong>
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Cena: <strong>{formatPrice(a.service_price)}</strong>
            </Typography>
          </Box>

          <Stack direction="row" spacing={1} alignItems="center" justifyContent="flex-end">
            <Chip label={a.status_display} color={statusColor(a.status)} variant="outlined" />
            <Button variant="outlined" size="small" disabled={busy || isBusy} onClick={() => onEdit(a)}>
              Edytuj
            </Button>
          </Stack>
        </Stack>

        {(canConfirm || canCancelUi || canComplete || canNoShow) && (
          <>
            <Box sx={{ height: 1 }} />
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {canConfirm && (
                <Button
                  size="small"
                  variant="contained"
                  disabled={busy || isBusy}
                  onClick={() => onConfirm(a.id)}
                  startIcon={isBusy ? <CircularProgress size={18} /> : undefined}
                >
                  Potwierdź
                </Button>
              )}

              {canCancelUi && (
                <Button
                  size="small"
                  variant="outlined"
                  color="error"
                  disabled={busy || isBusy}
                  onClick={() => onCancel(a.id)}
                  startIcon={isBusy ? <CircularProgress size={18} /> : undefined}
                >
                  Anuluj
                </Button>
              )}

              {canComplete && (
                <Button
                  size="small"
                  variant="contained"
                  color="success"
                  disabled={busy || isBusy}
                  onClick={() => onComplete(a.id)}
                  startIcon={isBusy ? <CircularProgress size={18} /> : undefined}
                >
                  Zakończ
                </Button>
              )}

              {canNoShow && (
                <Button
                  size="small"
                  color="error"
                  variant="contained"
                  disabled={busy || isBusy}
                  onClick={() => onNoShow(a.id)}
                  startIcon={isBusy ? <CircularProgress size={18} /> : undefined}
                >
                  No-show
                </Button>
              )}
            </Stack>
          </>
        )}
      </Stack>
    </Paper>
  );
}
