import React from 'react';
import {
    Alert,
    Button,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    TextField,
} from '@mui/material';
import type { Client } from '@/types';

export default function ResetClientPasswordDialog(props: {
    open: boolean;
    client: Client | null;
    p1: string;
    p2: string;
    setP1: (v: string) => void;
    setP2: (v: string) => void;
    error: string | null;
    saving: boolean;
    onClose: () => void;
    onConfirm: () => Promise<void>;
}) {
    const { open, client, p1, p2, setP1, setP2, error, saving, onClose, onConfirm } = props;

    return (
        <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="xs" fullWidth PaperProps={{ variant: 'outlined' }}>
            <DialogTitle>Reset hasła klienta</DialogTitle>
            <DialogContent dividers>
                {error && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                        {error}
                    </Alert>
                )}

                <TextField
                    label="Nowe hasło"
                    type="password"
                    margin="dense"
                    value={p1}
                    onChange={(e) => setP1(e.target.value)}
                    disabled={!client || saving}
                    fullWidth
                    helperText="Hasło musi być mocne"
                />
                <TextField
                    label="Powtórz nowe hasło"
                    type="password"
                    margin="dense"
                    value={p2}
                    onChange={(e) => setP2(e.target.value)}
                    disabled={!client || saving}
                    fullWidth
                />
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
                <Button onClick={onClose} disabled={saving}>
                    Anuluj
                </Button>
                <Button
                    variant="contained"
                    disabled={!client || saving}
                    onClick={() => void onConfirm()}
                    startIcon={saving ? <CircularProgress size={16} /> : undefined}
                >
                    Resetuj
                </Button>
            </DialogActions>
        </Dialog>
    );
}
