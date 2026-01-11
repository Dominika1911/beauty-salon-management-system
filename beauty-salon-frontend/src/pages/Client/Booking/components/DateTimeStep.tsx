import React from 'react';
import { Alert, Box, Button, CircularProgress, Stack } from '@mui/material';

import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { pl } from 'date-fns/locale';

import type { AvailabilitySlot } from '../types';
import { formatTimeRange } from '../utils';

interface Props {
    selectedDate: Date | null;
    onDateChange: (d: Date | null) => void;

    fetchingSlots: boolean;
    availableSlots: AvailabilitySlot[];

    selectedSlotStart: string | null;
    onPickSlotStart: (start: string) => void;

    onUserInteraction: () => void;
}

export const DateTimeStep: React.FC<Props> = ({
    selectedDate,
    onDateChange,
    fetchingSlots,
    availableSlots,
    selectedSlotStart,
    onPickSlotStart,
    onUserInteraction,
}) => {
    return (
        <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={pl}>
            <Stack spacing={3}>
                <DatePicker
                    label="Dzień wizyty"
                    value={selectedDate}
                    disablePast
                    onChange={(d) => {
                        onUserInteraction();
                        onDateChange(d);
                    }}
                    slotProps={{
                        textField: {
                            id: 'booking-date',
                            inputProps: {
                                'data-testid': 'booking-date-input',
                            },
                        },
                    }}
                />

                {fetchingSlots ? (
                    <CircularProgress />
                ) : availableSlots.length === 0 ? (
                    <Alert severity="info">
                        Brak wolnych terminów w tym dniu. Wybierz inny dzień.
                    </Alert>
                ) : (
                    <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                        {availableSlots.map((slot) => (
                            <Button
                                key={slot.start}
                                variant={selectedSlotStart === slot.start ? 'contained' : 'outlined'}
                                onClick={() => {
                                    onUserInteraction();
                                    onPickSlotStart(slot.start);
                                }}
                            >
                                {formatTimeRange(slot.start, slot.end)}
                            </Button>
                        ))}
                    </Box>
                )}
            </Stack>
        </LocalizationProvider>
    );
};
