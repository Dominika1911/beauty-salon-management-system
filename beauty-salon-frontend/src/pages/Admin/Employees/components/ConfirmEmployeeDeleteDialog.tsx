import React from 'react';
import { Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material';
import type { Employee } from '@/types';

type Props = {
    open: boolean;
    busy: boolean;

    employee: Employee | null;

    onClose: () => void;
    onConfirm: () => void;

    actionLoading: boolean;
};

export default function ConfirmEmployeeDeleteDialog(props: Props) {
    const { open, busy, employee, onClose, onConfirm, actionLoading } = props;

    return (
        <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="xs" fullWidth>
            <DialogTitle>Usuń pracownika</DialogTitle>
            <DialogContent dividers>
                <Typography variant="body2">
                    Czy na pewno chcesz usunąć pracownika{' '}
                    <b>
                        {employee?.first_name} {employee?.last_name}
                    </b>
                    ?
                </Typography>
                <Typography variant="caption" color="text.secondary">
                    Tej operacji nie można cofnąć. Jeśli są powiązane wizyty, usunięcie może być zablokowane.
                </Typography>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} disabled={busy}>
                    Anuluj
                </Button>
                <Button
                    color="error"
                    variant="contained"
                    onClick={onConfirm}
                    disabled={busy}
                    startIcon={actionLoading ? <CircularProgress size={18} /> : undefined}
                >
                    Usuń
                </Button>
            </DialogActions>
        </Dialog>
    );
}
