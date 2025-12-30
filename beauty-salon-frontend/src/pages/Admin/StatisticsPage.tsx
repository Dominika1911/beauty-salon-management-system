// src/pages/Admin/StatisticsPage.tsx
import React, { useEffect, useState } from 'react';
import { Alert, Box, CircularProgress, Grid, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography, Paper } from '@mui/material';
import { statisticsApi } from '@/api/statistics';
import type { Statistics } from '@/types';
import { formatPrice } from '@/utils/appointmentUtils';
import { StatCard } from '@/components/Statistics/StatCard';

export default function StatisticsPage(): JSX.Element {
    const [stats, setStats] = useState<Statistics | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => { loadStatistics(); }, []);

    const loadStatistics = async () => {
        try {
            setLoading(true);
            const data = await statisticsApi.get();
            setStats(data);
        } catch (e: any) {
            setError('Nie udało się załadować statystyk.');
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}><CircularProgress /></Box>;
    if (error || !stats) return <Box sx={{ p: 3 }}><Alert severity="error">{error || 'Brak danych'}</Alert></Box>;

    return (
        <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
            <Typography variant="h4" fontWeight={900} gutterBottom>Statystyki Salonu</Typography>

            <Typography variant="h6" fontWeight={700} sx={{ mt: 3, mb: 2 }}>Wizyty (30 dni)</Typography>
            <Grid container spacing={2}>
                <StatCard label="Wszystkie wizyty" value={stats.appointments.total_all_time} />
                <StatCard label="Ostatnie 30 dni" value={stats.appointments.last_30_days} />
                <StatCard label="Ukończone" value={stats.appointments.completed_last_30d} />
            </Grid>

            <Typography variant="h6" fontWeight={700} sx={{ mt: 4, mb: 2 }}>Finanse</Typography>
            <Grid container spacing={2}>
                <StatCard label="Przychód całkowity" value={formatPrice(stats.revenue.total_all_time)} />
                <StatCard label="Przychód (30 dni)" value={formatPrice(stats.revenue.last_30_days)} />
            </Grid>

            {/* ... tutaj dodaj resztę kart używając <StatCard /> ... */}

            <Typography variant="h6" fontWeight={700} sx={{ mt: 4, mb: 2 }}>Popularne Usługi</Typography>
            <TableContainer component={Paper} variant="outlined">
                <Table>
                    <TableHead sx={{ bgcolor: 'action.hover' }}>
                        <TableRow>
                            <TableCell><strong>Usługa</strong></TableCell>
                            <TableCell align="right"><strong>Rezerwacje</strong></TableCell>
                            <TableCell align="right"><strong>Przychód</strong></TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {stats.popular_services.map((s) => (
                            <TableRow key={s.id}>
                                <TableCell>{s.name}</TableCell>
                                <TableCell align="right">{s.booking_count}</TableCell>
                                <TableCell align="right">{formatPrice(s.total_revenue)}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
        </Box>
    );
}