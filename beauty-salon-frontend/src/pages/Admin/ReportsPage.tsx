import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Grid, Paper, Card, CardContent, 
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TextField, MenuItem, Button, CircularProgress, Alert, Stack
} from '@mui/material';
import { DatePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { pl } from 'date-fns/locale';
import axiosInstance from '../../api/axios';
import { PictureAsPdf as PdfIcon, Refresh as RefreshIcon } from '@mui/icons-material';

// Interfejsy danych zgodne z backendem
interface RevenueData {
  period: string;
  revenue: number;
  appointments_count: number;
}

interface RevenueReportResponse {
  summary: {
    total_revenue: number;
    total_appointments: number;
    average_per_appointment: number;
  };
  data: RevenueData[];
}

export default function ReportsPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filtry (domyślnie ostatni miesiąc)
  const [dateFrom, setDateFrom] = useState<Date | null>(new Date(new Date().setMonth(new Date().getMonth() - 1)));
  const [dateTo, setDateTo] = useState<Date | null>(new Date());
  const [groupBy, setGroupBy] = useState<'day' | 'month'>('day');

  const [reportData, setReportData] = useState<RevenueReportResponse | null>(null);

  // Pobieranie danych JSON
  const fetchReport = async () => {
    if (!dateFrom || !dateTo) return;
    setLoading(true);
    setError(null);

    const fromStr = dateFrom.toISOString().split('T')[0];
    const toStr = dateTo.toISOString().split('T')[0];

    try {
      const response = await axiosInstance.get('/reports/revenue/', {
        params: { date_from: fromStr, date_to: toStr, group_by: groupBy }
      });
      setReportData(response.data);
    } catch (err: any) {
      setError('Nie udało się pobrać danych raportu. Sprawdź czy backend działa.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Pobieranie PDF
  const downloadPDF = () => {
    if (!dateFrom || !dateTo) return;
    const fromStr = dateFrom.toISOString().split('T')[0];
    const toStr = dateTo.toISOString().split('T')[0];

    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
    const url = `${baseUrl}/reports/revenue/pdf/?date_from=${fromStr}&date_to=${toStr}`;
    window.open(url, '_blank');
  };

  useEffect(() => {
    fetchReport();
  }, []);

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight={800} color="primary">
          Raporty Finansowe
        </Typography>
        <Button
          variant="contained"
          color="secondary"
          startIcon={<PdfIcon />}
          onClick={downloadPDF}
          disabled={!reportData || loading}
        >
          Eksportuj do PDF
        </Button>
      </Stack>

      {/* SEKACJA FILTRÓW */}
      <Paper sx={{ p: 3, mb: 4, borderRadius: 3, boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
        <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={pl}>
          <Grid container spacing={3} alignItems="center">
            <Grid item xs={12} sm={3}>
              <DatePicker
                label="Data od"
                value={dateFrom}
                onChange={(newValue) => setDateFrom(newValue)}
                slotProps={{ textField: { fullWidth: true } }}
              />
            </Grid>
            <Grid item xs={12} sm={3}>
              <DatePicker
                label="Data do"
                value={dateTo}
                onChange={(newValue) => setDateTo(newValue)}
                slotProps={{ textField: { fullWidth: true } }}
              />
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField
                select
                label="Grupowanie"
                fullWidth
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value as 'day' | 'month')}
              >
                <MenuItem value="day">Dziennie</MenuItem>
                <MenuItem value="month">Miesięcznie</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={3}>
              <Button
                variant="outlined"
                fullWidth
                startIcon={<RefreshIcon />}
                onClick={fetchReport}
                disabled={loading}
                sx={{ height: '56px', borderRadius: 2 }}
              >
                Odśwież dane
              </Button>
            </Grid>
          </Grid>
        </LocalizationProvider>
      </Paper>

      {loading && <Box sx={{ textAlign: 'center', py: 5 }}><CircularProgress /></Box>}
      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      {reportData && !loading && (
        <>
          {/* PODSUMOWANIE WIDGETY */}
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} md={4}>
              <Card sx={{ bgcolor: 'primary.main', color: 'white', borderRadius: 3 }}>
                <CardContent>
                  <Typography variant="subtitle2" sx={{ opacity: 0.8 }}>Całkowity Przychód</Typography>
                  <Typography variant="h4" fontWeight={700}>{reportData.summary.total_revenue.toFixed(2)} zł</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={4}>
              <Card sx={{ borderRadius: 3 }}>
                <CardContent>
                  <Typography variant="subtitle2" color="textSecondary">Zrealizowane Wizyty</Typography>
                  <Typography variant="h4" fontWeight={700}>{reportData.summary.total_appointments}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={4}>
              <Card sx={{ borderRadius: 3 }}>
                <CardContent>
                  <Typography variant="subtitle2" color="textSecondary">Średnia Wartość Wizyty</Typography>
                  <Typography variant="h4" fontWeight={700}>{reportData.summary.average_per_appointment.toFixed(2)} zł</Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* TABELA DANYCH */}
          <TableContainer component={Paper} sx={{ borderRadius: 3, overflow: 'hidden' }}>
            <Table>
              <TableHead sx={{ bgcolor: 'grey.50' }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Okres ({groupBy === 'day' ? 'Dzień' : 'Miesiąc'})</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700 }}>Liczba wizyt</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>Przychód (brutto)</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {reportData.data.map((row) => (
                  <TableRow key={row.period} hover>
                    {/* NAPRAWIONE: Stylizacja przez sx zamiast bezpośredniego propa */}
                    <TableCell sx={{ fontWeight: 500 }}>
                      {row.period}
                    </TableCell>
                    <TableCell align="center">
                      {row.appointments_count}
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, color: 'success.main' }}>
                      {row.revenue.toFixed(2)} zł
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}
    </Box>
  );
}