import React from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Typography,
    CircularProgress,
} from '@mui/material';
import type { Appointment } from '@/types';

interface Props {
    open: boolean;
    appointment: Appointment | null;
    busy: boolean;
    onClose: () => void;
    onConfirm: () => void;
}

export const CancelAppointmentDialog: React.FC<Props> = ({
    open,
    appointment,
    busy,
    onClose,
    onConfirm,
}) => {
    return (
        <Dialog open={open} onClose={() => !busy && onClose()}>
            <DialogTitle>Anulować wizytę?</DialogTitle>
            <DialogContent>
                <Typography>
                    Czy na pewno chcesz zrezygnować z wizyty:{' '}
                    <strong>{appointment?.service_name}</strong>?
                </Typography>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} disabled={busy}>
                    Wróć
                </Button>
                <Button variant="contained" color="error" onClick={onConfirm} disabled={busy}>
                    {busy ? <CircularProgress size={20} /> : 'Potwierdzam anulowanie'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};
