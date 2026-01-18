import React from 'react';
import {
    Alert,
    Button,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Stack,
    TextField,
    Typography,
} from '@mui/material';
import type { Employee } from '@/types';

type Props = {
    open: boolean;
    onClose: () => void;

    resetLoading: boolean;
    resetError: string | null;
    setResetError: (v: string | null) => void;

    resetTarget: Employee | null;

    resetPass1: string;
    setResetPass1: (v: string) => void;

    resetPass2: string;
    setResetPass2: (v: string) => void;

    onSubmit: () => void;
};

export default function ResetEmployeePasswordDialog(props: Props){
    const {
        open,
        onClose,
        resetLoading,
        resetError,
        setResetError,
        resetTarget,
        resetPass1,
        setResetPass1,
        resetPass2,
        setResetPass2,
        onSubmit,
    } = props;

    return (
        <Dialog open={open} onClose={resetLoading ? undefined : onClose} fullWidth maxWidth="sm">
            <DialogTitle>Reset hasła pracownika</DialogTitle>
            <DialogContent dividers>
                <Stack spacing={2}>
                    {resetError && (
                        <Alert severity="error" onClose={() => setResetError(null)}>
                            {resetError}
                        </Alert>
                    )}

                    <Typography variant="body2">
                        Pracownik: <b>{resetTarget?.full_name}</b>
                    </Typography>

                    <TextField
                        label="Nowe hasło"
                        type="password"
                        value={resetPass1}
                        onChange={(e) => setResetPass1(e.target.value)}
                        fullWidth
                        helperText="Wybierz mocne hasło"
                        disabled={resetLoading}
                        autoComplete="new-password"
                    />
                    <TextField
                        label="Powtórz nowe hasło"
                        type="password"
                        value={resetPass2}
                        onChange={(e) => setResetPass2(e.target.value)}
                        fullWidth
                        disabled={resetLoading}
                        autoComplete="new-password"
                    />
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} disabled={resetLoading}>
                    Anuluj
                </Button>
                <Button
                    onClick={onSubmit}
                    variant="contained"
                    disabled={resetLoading}
                    startIcon={resetLoading ? <CircularProgress size={16} /> : undefined}
                >
                    Resetuj
                </Button>
            </DialogActions>
        </Dialog>
    );
}
