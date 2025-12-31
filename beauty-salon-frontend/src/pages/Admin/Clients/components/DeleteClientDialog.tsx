import React from 'react';
import {
    Button,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Typography,
} from '@mui/material';
import type { Client } from '@/types';

export default function DeleteClientDialog(props: {
    open: boolean;
    client: Client | null;
    deleting: boolean;
    onClose: () => void;
    onConfirm: () => Promise<void>;
}) {
    const { open, client, deleting, onClose, onConfirm } = props;

    return (
        <Dialog open={open} onClose={onClose} PaperProps={{ variant: 'outlined' }}>
            <DialogTitle>Usunąć klienta?</DialogTitle>
            <DialogContent dividers>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    {client?.first_name} {client?.last_name} zostanie trwale usunięty z bazy.
                </Typography>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
                <Button onClick={onClose} disabled={deleting}>
                    Anuluj
                </Button>
                <Button
                    onClick={() => void onConfirm()}
                    color="error"
                    variant="contained"
                    disabled={deleting}
                    startIcon={deleting ? <CircularProgress size={16} /> : undefined}
                >
                    Usuń
                </Button>
            </DialogActions>
        </Dialog>
    );
}
