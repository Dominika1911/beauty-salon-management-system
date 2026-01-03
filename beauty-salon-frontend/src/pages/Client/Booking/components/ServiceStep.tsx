import React from 'react';
import {
    Grid,
    Paper,
    Stack,
    TextField,
    InputAdornment,
    FormControl,
    Select,
    MenuItem,
    Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';

import type { Service } from '@/types';
import type { ServiceSort } from '../types';

interface Props {
    serviceQuery: string;
    onServiceQueryChange: (val: string) => void;

    serviceSort: ServiceSort;
    onServiceSortChange: (val: ServiceSort) => void;

    services: Service[];
    selectedServiceId: number | null;
    onPickService: (s: Service) => void;

    onUserInteraction: () => void;
}

export const ServiceStep: React.FC<Props> = ({
    serviceQuery,
    onServiceQueryChange,
    serviceSort,
    onServiceSortChange,
    services,
    selectedServiceId,
    onPickService,
    onUserInteraction,
}) => {
    return (
        <Stack spacing={3}>
            <TextField
                placeholder="Szukaj usługi"
                value={serviceQuery}
                onChange={(e) => {
                    onUserInteraction();
                    onServiceQueryChange(e.target.value);
                }}
                InputProps={{
                    startAdornment: (
                        <InputAdornment position="start">
                            <SearchIcon />
                        </InputAdornment>
                    ),
                }}
            />

            <FormControl size="small" sx={{ maxWidth: 240 }}>
                <Select
                    value={serviceSort}
                    onChange={(e) => {
                        onUserInteraction();
                        onServiceSortChange(e.target.value as ServiceSort);
                    }}
                >
                    <MenuItem value="name">Nazwa</MenuItem>
                    <MenuItem value="price">Cena</MenuItem>
                    <MenuItem value="duration">Czas</MenuItem>
                </Select>
            </FormControl>

            <Grid container spacing={2}>
                {services.map((s) => (
                    <Grid item xs={12} sm={6} md={4} key={s.id}>
                        <Paper
                            variant="outlined"
                            sx={{
                                p: 2,
                                cursor: 'pointer',
                                borderColor:
                                    selectedServiceId === s.id ? 'primary.main' : undefined,
                            }}
                            onClick={() => onPickService(s)}
                        >
                            <Typography fontWeight={700}>{s.name}</Typography>
                            <Typography variant="body2" color="text.secondary">
                                {s.duration_display} • {s.price} zł
                            </Typography>
                        </Paper>
                    </Grid>
                ))}
            </Grid>
        </Stack>
    );
};
