import React, { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Grid,
  Paper,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  MenuItem,
  Button,
  CircularProgress,
  Alert,
  Stack,
} from "@mui/material";
import { DatePicker, LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { pl } from "date-fns/locale";
import axiosInstance from "../../api/axios";
import { PictureAsPdf as PdfIcon, Refresh as RefreshIcon } from "@mui/icons-material";

type ReportType = "revenue" | "employees" | "clients" | "today";

// revenue JSON
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

function toYmd(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function ReportsPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [reportType, setReportType] = useState<ReportType>("revenue");

  const [dateFrom, setDateFrom] = useState<Date | null>(
    new Date(new Date().setMonth(new Date().getMonth() - 1))
  );
  const [dateTo, setDateTo] = useState<Date | null>(new Date());
  const [groupBy, setGroupBy] = useState<"day" | "month">("day");

  const [revenueData, setRevenueData] = useState<RevenueReportResponse | null>(null);

  const validateDates = () => {
    if (!dateFrom || !dateTo) return "Ustaw zakres dat.";
    if (dateFrom.getTime() > dateTo.getTime()) return "Data 'od' nie może być późniejsza niż 'do'.";
    return null;
  };

  const fetchRevenue = async () => {
    const v = validateDates();
    if (v) {
      setError(v);
      return;
    }

    setLoading(true);
    setError(null);

    const fromStr = toYmd(dateFrom!);
    const toStr = toYmd(dateTo!);

    try {
      const res = await axiosInstance.get<RevenueReportResponse>("/reports/revenue/", {
        params: { date_from: fromStr, date_to: toStr, group_by: groupBy },
      });
      setRevenueData(res.data);
    } catch (err) {
      setError("Nie udało się pobrać danych przychodów (JSON). Sprawdź /reports/revenue/.");
      console.error(err);
      setRevenueData(null);
    } finally {
      setLoading(false);
    }
  };

  const downloadPdf = async () => {
    // revenue ma daty, reszta może nie potrzebować, ale bezpiecznie wysyłamy jeśli są
    const v = validateDates();
    if (reportType === "revenue" && v) {
      setError(v);
      return;
    }

    setLoading(true);
    setError(null);

    const params: any = {};
    if (dateFrom && dateTo) {
      params.date_from = toYmd(dateFrom);
      params.date_to = toYmd(dateTo);
    }
    if (reportType === "revenue") {
      params.group_by = groupBy;
    }

    try {
      const res = await axiosInstance.get(`/reports/${reportType}/pdf/`, {
        params,
        responseType: "blob",
      });

      const filename = `raport_${reportType}_${params.date_from || "today"}_${params.date_to || ""}.pdf`
        .replace(/__$/, "");
      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();

      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError("Nie udało się pobrać PDF. Sprawdź /reports/<typ>/pdf/.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // tylko revenue ma sens auto-wczytać
    if (reportType === "revenue") void fetchRevenue();
    else setRevenueData(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportType]);

  const showRevenueUi = reportType === "revenue";

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h4" fontWeight={800} color="primary">
          Raporty
        </Typography>

        <Button
          variant="contained"
          color="secondary"
          startIcon={<PdfIcon />}
          onClick={() => void downloadPdf()}
          disabled={loading || (showRevenueUi && !revenueData)}
        >
          Pobierz PDF
        </Button>
      </Stack>

      <Paper sx={{ p: 3, mb: 3, borderRadius: 3 }}>
        <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={pl}>
          <Grid container spacing={3} alignItems="center">
            <Grid item xs={12} sm={3}>
              <TextField
                select
                label="Rodzaj raportu"
                fullWidth
                value={reportType}
                onChange={(e) => setReportType(e.target.value as ReportType)}
              >
                <MenuItem value="revenue">Przychody</MenuItem>
                <MenuItem value="employees">Pracownicy (PDF)</MenuItem>
                <MenuItem value="clients">Klienci (PDF)</MenuItem>
                <MenuItem value="today">Grafik na dziś (PDF)</MenuItem>
              </TextField>
            </Grid>

            <Grid item xs={12} sm={3}>
              <DatePicker
                label="Data od"
                value={dateFrom}
                onChange={(v) => setDateFrom(v)}
                slotProps={{ textField: { fullWidth: true } }}
                disabled={!showRevenueUi}
              />
            </Grid>

            <Grid item xs={12} sm={3}>
              <DatePicker
                label="Data do"
                value={dateTo}
                onChange={(v) => setDateTo(v)}
                slotProps={{ textField: { fullWidth: true } }}
                disabled={!showRevenueUi}
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
                  onChange={(e) => setGroupBy(e.target.value as "day" | "month")}
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

      {/* UI tylko dla revenue */}
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
                    {revenueData.summary.total_revenue.toFixed(2)} zł
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={4}>
              <Card sx={{ borderRadius: 3 }}>
                <CardContent>
                  <Typography variant="subtitle2" color="textSecondary">
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
                  <Typography variant="subtitle2" color="textSecondary">
                    Średnia wartość wizyty
                  </Typography>
                  <Typography variant="h4" fontWeight={700}>
                    {revenueData.summary.average_per_appointment.toFixed(2)} zł
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
