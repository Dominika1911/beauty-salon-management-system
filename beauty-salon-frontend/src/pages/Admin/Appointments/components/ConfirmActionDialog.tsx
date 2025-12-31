import React from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material';

type Props = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  severity?: 'warning' | 'error' | 'info';
  loading?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function ConfirmActionDialog({
  open,
  title,
  description,
  confirmLabel = 'Potwierdź',
  cancelLabel = 'Wróć',
  severity = 'warning',
  loading = false,
  onCancel,
  onConfirm,
}: Props) {
  return (
    <Dialog open={open} onClose={loading ? undefined : onCancel} maxWidth="xs" fullWidth>
      <DialogTitle>{title}</DialogTitle>

      <DialogContent dividers>
        <Stack spacing={2}>
          <Alert severity={severity}>
            <Typography variant="body2">{description}</Typography>
          </Alert>
          <Typography variant="body2" color="text.secondary">
            Tej operacji nie da się cofnąć w prosty sposób. Jeśli to pomyłka, anuluj.
          </Typography>
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onCancel} disabled={loading}>
          {cancelLabel}
        </Button>
        <Button onClick={onConfirm} variant="contained" disabled={loading}>
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
