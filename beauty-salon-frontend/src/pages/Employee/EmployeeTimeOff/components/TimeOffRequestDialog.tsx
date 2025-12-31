import React from 'react';
import {
    Alert,
    Box,
    Button,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    LinearProgress,
    TextField,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers';
import dayjs, { Dayjs } from 'dayjs';

interface Props {
    open: boolean;
    loading: boolean;
    error: string | null;

    startDate: Dayjs | null;
    endDate: Dayjs | null;
    comment: string;

    onClose: () => void;
    onSubmit: () => void;

    onStartDateChange: (value: Dayjs | null) => void;
    onEndDateChange: (value: Dayjs | null) => void;
    onCommentChange: (value: string) => void;
}

const TimeOffRequestDialog: React.FC<Props> = ({
    open,
    loading,
    error,
    startDate,
    endDate,
    comment,
    onClose,
    onSubmit,
    onStartDateChange,
    onEndDateChange,
    onCommentChange,
}) => {
    const today = dayjs().startOf('day');

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
            <DialogTitle>Nowy wniosek urlopowy</DialogTitle>

            <DialogContent>
                {loading && <LinearProgress />}

                {error && (
                    <Alert severity="error" sx={{ mt: 2 }}>
                        {error}
                    </Alert>
                )}

                <Box mt={2} display="flex" flexDirection="column" gap={2}>
                    <DatePicker
                        label="Data od"
                        value={startDate}
                        onChange={onStartDateChange}
                        minDate={today}
                        disablePast
                    />

                    <DatePicker
                        label="Data do"
                        value={endDate}
                        onChange={onEndDateChange}
                        minDate={startDate ?? today}
                        disablePast
                        disabled={!startDate}
                    />

                    <TextField
                        label="Powód"
                        value={comment}
                        onChange={(e) => onCommentChange(e.target.value)}
                        multiline
                        minRows={3}
                        fullWidth
                    />
                </Box>
            </DialogContent>

            <DialogActions>
                <Button onClick={onClose} disabled={loading}>
                    Anuluj
                </Button>
                <Button
                    onClick={onSubmit}
                    variant="contained"
                    disabled={loading}
                >
                    {loading ? <CircularProgress size={20} /> : 'Wyślij'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default TimeOffRequestDialog;
