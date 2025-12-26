// src/pages/Admin/ReportsPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Grid,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { DatePicker, LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { pl } from "date-fns/locale";
import { PictureAsPdf as PdfIcon, Refresh as RefreshIcon } from "@mui/icons-material";

import { reportsApi, type ReportType, type RevenueGroupBy } from "@/api/reports";
import type { AvailableReport, RevenueReportResponse } from "@/api/reports";

function getErrorMessage(e: unknown, fallback: string) {
  const anyErr = e as any;
  const d = anyErr?.response?.data;
  if (typeof d?.detail === "string") return d.detail;
  if (typeof anyErr?.message === "string" && anyErr.message) return anyErr.message;
  return fallback;
}

function toYmd(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

export default function ReportsPage(): JSX.Element {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ✅ backend-driven list of reports
  const [available, setAvailable] = useState<AvailableReport[]>([]);

  const [reportType, setReportType] = useState<ReportType>("revenue");

  const [dateFrom, setDateFrom] = useState<Date | null>(
    new Date(new Date().setMonth(new Date().getMonth() - 1))
  );
  const [dateTo, setDateTo] = useState<Date | null>(new Date());

  const [groupBy, setGroupBy] = useState<RevenueGroupBy>("day");
  const [revenueData, setRevenueData] = useState<RevenueReportResponse | null>(null);

  const showRevenueUi = reportType === "revenue";

  const validateDates = (required: boolean): string | null => {
    if (!required) return null;
    if (!dateFrom || !dateTo) return "Ustaw zakres dat.";
    if (dateFrom.getTime() > dateTo.getTime()) return "Data 'od' nie może być późniejsza niż 'do'.";
    return null;
  };

  // ✅ tylko revenue potrzebuje group_by
  const revenueParams = useMemo(() => {
    if (!dateFrom || !dateTo) return null;
    return {
      date_from: toYmd(dateFrom),
      date_to: toYmd(dateTo),
      group_by: groupBy,
    };
  }, [dateFrom, dateTo, groupBy]);

  // ✅ params dla PDF / innych raportów (bez group_by)
  const commonParams = useMemo(() => {
    if (!dateFrom || !dateTo) return {};
    return {
      date_from: toYmd(dateFrom),
      date_to: toYmd(dateTo),
    };
  }, [dateFrom, dateTo]);

  const loadAvailableReports = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await reportsApi.list();
      setAvailable(res.available_reports || []);

      // jeśli backend nie zwróci aktualnie wybranego typu, ustaw pierwszy dostępny
      if (res.available_reports?.length) {
        const exists = res.available_reports.some((r) => r.type === reportType);
        if (!exists) setReportType(res.available_reports[0].type);
      }
    } catch (e) {
      setAvailable([]);
      setError(getErrorMessage(e, "Nie udało się pobrać listy raportów (/reports/)."));
    } finally {
      setLoading(false);
    }
  };

  const fetchRevenue = async () => {
    const v = validateDates(true);
    if (v) {
      setError(v);
      return;
    }
    if (!revenueParams) return;

    setLoading(true);
    setError(null);

    try {
      // ✅ backend revenue JSON
      const data = await reportsApi.getRevenue(revenueParams);
      setRevenueData(data);
    } catch (e) {
      setRevenueData(null);
      setError(getErrorMessage(e, "Nie udało się pobrać danych przychodów (JSON)."));
    } finally {
      setLoading(false);
    }
  };

  const downloadPdf = async () => {
    // W Twoim UI: revenue wymaga zakresu.
    // Pozostałe raporty mogą działać bez dat, ale zostawiamy date_from/date_to jeśli ustawione.
    const v = validateDates(reportType === "revenue");
    if (v) {
      setError(v);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { blob, filename } = await reportsApi.pdf(reportType, commonParams);

      const fallbackName =
        reportType === "revenue" && commonParams.date_from && commonParams.date_to
          ? `raport_${reportType}_${commonParams.date_from}_${commonParams.date_to}.pdf`
          : `raport_${reportType}.pdf`;

      downloadBlob(blob, filename || fallbackName);
    } catch (e) {
      setError(getErrorMessage(e, "Nie udało się pobrać PDF. Sprawdź endpoint /reports/<typ>/pdf/."));
    } finally {
      setLoading(false);
    }
  };

  // init: load available reports
  useEffect(() => {
    void loadAvailableReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // gdy zmienisz typ raportu:
  useEffect(() => {
    setError(null);

    if (reportType === "revenue") {
      void fetchRevenue();
    } else {
      // ✅ dla innych raportów UI nie trzyma JSON (bo backend w Twoim założeniu: PDF)
      setRevenueData(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportType]);

  const reportDescription = useMemo(() => {
    const found = available.find((r) => r.type === reportType);
    return found?.description || null;
  }, [available, reportType]);

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight={800} color="primary">
            Raporty
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Źródło: backend <code>GET /api/reports/</code>
            {reportDescription ? ` • ${reportDescription}` : ""}
          </Typography>
        </Box>

        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={() => void loadAvailableReports()}
            disabled={loading}
          >
            Odśwież listę
          </Button>

          <Button
            variant="contained"
            color="secondary"
            startIcon={<PdfIcon />}
            onClick={() => void downloadPdf()}
            disabled={loading}
          >
            Pobierz PDF
          </Button>
        </Stack>
      </Stack>

      <Paper sx={{ p: 3, mb: 3, borderRadius: 3 }}>
        <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={pl}>
          <Grid container spacing={3} alignItems="center">
            <Grid item xs={12} sm={3}>
              <TextField
                select
                label="Rodzaj raportu (backend)"
                fullWidth
                value={reportType}
                onChange={(e) => setReportType(e.target.value as ReportType)}
                disabled={loading}
              >
                {available.length === 0 ? (
                  // fallback jeśli list() padnie – nadal pozwala używać UI
                  <>
                    <MenuItem value="revenue">Przychody</MenuItem>
                    <MenuItem value="employees">Pracownicy</MenuItem>
                    <MenuItem value="clients">Klienci</MenuItem>
                    <MenuItem value="today">Grafik na dziś</MenuItem>
                  </>
                ) : (
                  available.map((r) => (
                    <MenuItem key={r.type} value={r.type}>
                      {r.description || r.type}
                    </MenuItem>
                  ))
                )}
              </TextField>
            </Grid>

            <Grid item xs={12} sm={3}>
              <DatePicker
                label="Data od"
                value={dateFrom}
                onChange={(v) => setDateFrom(v)}
                slotProps={{ textField: { fullWidth: true } }}
                disabled={!showRevenueUi || loading}
              />
            </Grid>

            <Grid item xs={12} sm={3}>
              <DatePicker
                label="Data do"
                value={dateTo}
                onChange={(v) => setDateTo(v)}
                slotProps={{ textField: { fullWidth: true } }}
                disabled={!showRevenueUi || loading}
              />
            </Grid>

            <Grid item xs={12} sm={3}>
              {showRevenueUi ? (
                <Button
                  variant="outlined"
                  fullWidth
                  startIcon={<RefreshIcon />}
                  onClick={() => void fetchRevenue()}
                  disabled={loading}
                  sx={{ height: "56px", borderRadius: 2 }}
                >
                  Odśwież dane
                </Button>
              ) : (
                <Alert severity="info" sx={{ mb: 0 }}>
                  Ten raport jest dostępny jako PDF.
                </Alert>
              )}
            </Grid>

            {showRevenueUi && (
              <Grid item xs={12} sm={3}>
                <TextField
                  select
                  label="Grupowanie"
                  fullWidth
                  value={groupBy}
                  onChange={(e) => setGroupBy(e.target.value as RevenueGroupBy)}
                  disabled={loading}
                >
                  <MenuItem value="day">Dziennie</MenuItem>
                  <MenuItem value="month">Miesięcznie</MenuItem>
                </TextField>
              </Grid>
            )}
          </Grid>
        </LocalizationProvider>
      </Paper>

      {loading && (
        <Box sx={{ textAlign: "center", py: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {showRevenueUi && revenueData && !loading && (
        <>
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} md={4}>
              <Card sx={{ bgcolor: "primary.main", color: "white", borderRadius: 3 }}>
                <CardContent>
                  <Typography variant="subtitle2" sx={{ opacity: 0.8 }}>
                    Całkowity przychód
                  </Typography>
                  <Typography variant="h4" fontWeight={700}>
                    {Number(revenueData.summary.total_revenue).toFixed(2)} zł
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={4}>
              <Card sx={{ borderRadius: 3 }}>
                <CardContent>
                  <Typography variant="subtitle2" color="text.secondary">
                    Zrealizowane wizyty
                  </Typography>
                  <Typography variant="h4" fontWeight={700}>
                    {revenueData.summary.total_appointments}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={4}>
              <Card sx={{ borderRadius: 3 }}>
                <CardContent>
                  <Typography variant="subtitle2" color="text.secondary">
                    Średnia wartość wizyty
                  </Typography>
                  <Typography variant="h4" fontWeight={700}>
                    {Number(revenueData.summary.average_per_appointment).toFixed(2)} zł
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <TableContainer component={Paper} sx={{ borderRadius: 3, overflow: "hidden" }}>
            <Table>
              <TableHead sx={{ bgcolor: "grey.50" }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>
                    Okres ({groupBy === "day" ? "Dzień" : "Miesiąc"})
                  </TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700 }}>
                    Liczba wizyt
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>
                    Przychód
                  </TableCell>
                </TableRow>
              </TableHead>

              <TableBody>
                {revenueData.data.map((row) => (
                  <TableRow key={row.period} hover>
                    <TableCell sx={{ fontWeight: 500 }}>{row.period}</TableCell>
                    <TableCell align="center">{row.appointments_count}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, color: "success.main" }}>
                      {Number(row.revenue).toFixed(2)} zł
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
