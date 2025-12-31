import React, { useMemo } from 'react';
import type { Appointment } from '@/types';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material';
import { formatPL, statusChipColor, statusLabel } from '../utils';

type Props = {
  open: boolean;
  busyAction: boolean;
  selectedAppt: Appointment | null;
  pageError: string | null;

  onClose: () => void;

  onConfirm: () => void;
  onComplete: () => void;
  onCancel: () => void;
  onNoShow: () => void;
};

export function AppointmentDetailsDialog({
  open,
  busyAction,
  selectedAppt,
  pageError,
  onClose,
  onConfirm,
  onComplete,
  onCancel,
  onNoShow,
}: Props): JSX.Element {
  const canConfirm = useMemo(() => Boolean(selectedAppt?.can_confirm), [selectedAppt]);
  const canComplete = useMemo(() => Boolean(selectedAppt?.can_complete), [selectedAppt]);
  const canCancel = useMemo(() => Boolean(selectedAppt?.can_cancel), [selectedAppt]);
  const canNoShow = useMemo(() => Boolean(selectedAppt?.can_no_show), [selectedAppt]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
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
            {pageError && (
              <Typography variant="body2" color="error">
                {pageError}
              </Typography>
            )}

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
                {selectedAppt.client_name ?? 'Klient'}
              </Typography>
            </Box>

            <Box>
              <Typography variant="caption" color="text.secondary">
                Termin
              </Typography>
              <Typography variant="body2">
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
                  sx={{ fontWeight: 700 }}
                />
              </Box>
            </Box>
          </Stack>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={busyAction}>
          Zamknij
        </Button>

        {selectedAppt && (
          <Stack direction="row" spacing={1} sx={{ ml: 'auto' }}>
            {canConfirm && (
              <Button variant="contained" onClick={onConfirm} disabled={busyAction}>
                Potwierdź
              </Button>
            )}

            {canComplete && (
              <Button
                variant="contained"
                color="success"
                onClick={onComplete}
                disabled={busyAction}
              >
                Zakończ
              </Button>
            )}

            {canCancel && (
              <Button variant="outlined" color="error" onClick={onCancel} disabled={busyAction}>
                Anuluj
              </Button>
            )}

            {canNoShow && (
              <Button variant="contained" color="error" onClick={onNoShow} disabled={busyAction}>
                {busyAction ? (
                  <CircularProgress size={18} sx={{ mr: 1 }} />
                ) : null}
                No-show
              </Button>
            )}
          </Stack>
        )}
      </DialogActions>
    </Dialog>
  );
}
