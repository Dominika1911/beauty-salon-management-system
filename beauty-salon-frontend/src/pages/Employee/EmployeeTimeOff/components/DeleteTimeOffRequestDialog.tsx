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

interface Props {
    open: boolean;
    loading: boolean;
    onClose: () => void;
    onConfirm: () => void;
}

const DeleteTimeOffRequestDialog: React.FC<Props> = ({
    open,
    loading,
    onClose,
    onConfirm,
}) => {
    return (
        <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
            <DialogTitle>Usuń wniosek</DialogTitle>

            <DialogContent>
                <Typography>
                    Czy na pewno chcesz usunąć ten wniosek urlopowy?
                </Typography>
            </DialogContent>

            <DialogActions>
                <Button onClick={onClose} disabled={loading}>
                    Anuluj
                </Button>
                <Button
                    onClick={onConfirm}
                    color="error"
                    variant="contained"
                    disabled={loading}
                >
                    {loading ? <CircularProgress size={20} /> : 'Usuń'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default DeleteTimeOffRequestDialog;
