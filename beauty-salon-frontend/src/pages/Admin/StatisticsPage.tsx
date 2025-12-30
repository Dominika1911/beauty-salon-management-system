import React, { useEffect, useState } from 'react';
import {
    Alert,
    Box,
    Card,
    CardContent,
    CircularProgress,
    Grid,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Typography,
    Paper,
} from '@mui/material';
import { statisticsApi } from '@/api/statistics';
import type { Statistics } from '@/types';

export default function StatisticsPage(): JSX.Element {
    const [stats, setStats] = useState<Statistics | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadStatistics();
    }, []);

    const loadStatistics = async () => {
        try {
            setLoading(true);
            const data = await statisticsApi.get();
            setStats(data);
        } catch (e: any) {
            console.error(e);
            setError('Nie udało się załadować statystyk.');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
                <CircularProgress />
            </Box>
        );
    }

    if (error || !stats) {
        return <Alert>{error || 'Brak danych'}</Alert>;
    }

    return (
        <Box sx={{ p: 3 }}>
            <Typography variant="h4" fontWeight={900} gutterBottom>
                Statystyki Salonu
            </Typography>

            <Typography variant="h6" fontWeight={700} sx={{ mt: 3, mb: 2 }}>
                Wizyty
            </Typography>
            <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={4}>
                    <Card>
                        <CardContent>
                            <Typography variant="body2">Wszystkie wizyty</Typography>
                            <Typography variant="h4" fontWeight={700}>
                                {stats.appointments.total_all_time}
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>

                <Grid item xs={12} sm={6} md={4}>
                    <Card>
                        <CardContent>
                            <Typography variant="body2">Ostatnie 30 dni</Typography>
                            <Typography variant="h4" fontWeight={700}>
                                {stats.appointments.last_30_days}
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>

                <Grid item xs={12} sm={6} md={4}>
                    <Card>
                        <CardContent>
                            <Typography variant="body2">Ukończone (30 dni)</Typography>
                            <Typography variant="h4" fontWeight={700}>
                                {stats.appointments.completed_last_30d}
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>

                <Grid item xs={12} sm={6} md={4}>
                    <Card>
                        <CardContent>
                            <Typography variant="body2">Anulowane (30 dni)</Typography>
                            <Typography variant="h4" fontWeight={700}>
                                {stats.appointments.cancelled_last_30d}
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>

                <Grid item xs={12} sm={6} md={4}>
                    <Card>
                        <CardContent>
                            <Typography variant="body2">Nieobecność (30 dni)</Typography>
                            <Typography variant="h4" fontWeight={700}>
                                {stats.appointments.no_shows_last_30d}
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>

                <Grid item xs={12} sm={6} md={4}>
                    <Card>
                        <CardContent>
                            <Typography variant="body2">Nadchodzące</Typography>
                            <Typography variant="h4" fontWeight={700}>
                                {stats.appointments.upcoming}
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>

            <Typography variant="h6" fontWeight={700} sx={{ mt: 4, mb: 2 }}>
                Przychody
            </Typography>
            <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={4}>
                    <Card>
                        <CardContent>
                            <Typography variant="body2">Całkowity przychód</Typography>
                            <Typography variant="h4" fontWeight={700}>
                                {stats.revenue.total_all_time.toFixed(2)} zł
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>

                <Grid item xs={12} sm={6} md={4}>
                    <Card>
                        <CardContent>
                            <Typography variant="body2">Przychód (30 dni)</Typography>
                            <Typography variant="h4" fontWeight={700}>
                                {stats.revenue.last_30_days.toFixed(2)} zł
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>

                <Grid item xs={12} sm={6} md={4}>
                    <Card>
                        <CardContent>
                            <Typography variant="body2">Średnia na wizytę</Typography>
                            <Typography variant="h4" fontWeight={700}>
                                {stats.revenue.avg_appointment_value.toFixed(2)} zł
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>

            <Typography variant="h6" fontWeight={700} sx={{ mt: 4, mb: 2 }}>
                Pracownicy i Klienci
            </Typography>
            <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={3}>
                    <Card>
                        <CardContent>
                            <Typography variant="body2">Wszyscy pracownicy</Typography>
                            <Typography variant="h4" fontWeight={700}>
                                {stats.employees.total}
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                    <Card>
                        <CardContent>
                            <Typography variant="body2">Aktywni pracownicy</Typography>
                            <Typography variant="h4" fontWeight={700}>
                                {stats.employees.active}
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                    <Card>
                        <CardContent>
                            <Typography variant="body2">Wszyscy klienci</Typography>
                            <Typography variant="h4" fontWeight={700}>
                                {stats.clients.total}
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                    <Card>
                        <CardContent>
                            <Typography variant="body2">Aktywni klienci</Typography>
                            <Typography variant="h4" fontWeight={700}>
                                {stats.clients.active}
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>

            <Typography variant="h6" fontWeight={700} sx={{ mt: 4, mb: 2 }}>
                Usługi
            </Typography>
            <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                    <Card>
                        <CardContent>
                            <Typography variant="body2">Wszystkie usługi</Typography>
                            <Typography variant="h4" fontWeight={700}>
                                {stats.services.total}
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>

                <Grid item xs={12} sm={6}>
                    <Card>
                        <CardContent>
                            <Typography variant="body2">Aktywne usługi</Typography>
                            <Typography variant="h4" fontWeight={700}>
                                {stats.services.active}
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>

            <Typography variant="h6" fontWeight={700} sx={{ mt: 4, mb: 2 }}>
                Top 10 najpopularniejszych usług (ostatnie 30 dni)
            </Typography>
            <TableContainer component={Paper}>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>
                                <strong>Usługa</strong>
                            </TableCell>
                            <TableCell>
                                <strong>Kategoria</strong>
                            </TableCell>
                            <TableCell align="right">
                                <strong>Liczba rezerwacji</strong>
                            </TableCell>
                            <TableCell align="right">
                                <strong>Przychód</strong>
                            </TableCell>
                            <TableCell align="right">
                                <strong>Cena</strong>
                            </TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {stats.popular_services.map((service) => (
                            <TableRow key={service.id}>
                                <TableCell>{service.name}</TableCell>
                                <TableCell>{service.category || '—'}</TableCell>
                                <TableCell align="right">{service.booking_count}</TableCell>
                                <TableCell align="right">
                                    {service.total_revenue.toFixed(2)} zł
                                </TableCell>
                                <TableCell align="right">{service.price.toFixed(2)} zł</TableCell>
                            </TableRow>
                        ))}
                        {stats.popular_services.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={5} align="center">
                                    Brak danych
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </TableContainer>
        </Box>
    );
}
