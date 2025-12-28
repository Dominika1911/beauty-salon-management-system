// src/pages/Admin/ReportsPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  Grid,
  LinearProgress,
  MenuItem,
  Paper,
  Snackbar,
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
import type { AlertColor } from "@mui/material/Alert";
import { DatePicker, LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { pl } from "date-fns/locale";
import { PictureAsPdf as PdfIcon, Refresh as RefreshIcon } from "@mui/icons-material";

import { reportsApi, type ReportType, type RevenueGroupBy } from "@/api/reports";
import type { AvailableReport, RevenueReportResponse } from "@/api/reports";
import { parseDrfError } from "@/utils/drfErrors";

type SnackState = {
  open: boolean;
  msg: string;
  severity: AlertColor;
};

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

function formatMoneyPLN(v: unknown): string {
  const n = Number(v);
  if (Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN" }).format(n);
}

export default function ReportsPage(): JSX.Element {
  const [loading, setLoading] = useState(false);

  // komunikaty wg standardu
  const [pageError, setPageError] = useState<string | null>(null);
  const [snack, setSnack] = useState<SnackState>({ open: false, msg: "", severity: "success" });

  // ✅ backend-driven list of reports
  const [available, setAvailable] = useState<AvailableReport[]>([]);

  // applied selections
  const [reportType, setReportType] = useState<ReportType>("revenue");
  const [dateFrom, setDateFrom] = useState<Date | null>(
    new Date(new Date().setMonth(new Date().getMonth() - 1))
  );
  const [dateTo, setDateTo] = useState<Date | null>(new Date());
  const [groupBy, setGroupBy] = useState<RevenueGroupBy>("day");

  // draft selections (UX: no auto-request while changing)
  const [draftReportType, setDraftReportType] = useState<ReportType>("revenue");
  const [draftDateFrom, setDraftDateFrom] = useState<Date | null>(
    new Date(new Date().setMonth(new Date().getMonth() - 1))
  );
  const [draftDateTo, setDraftDateTo] = useState<Date | null>(new Date());
  const [draftGroupBy, setDraftGroupBy] = useState<RevenueGroupBy>("day");

  const [revenueData, setRevenueData] = useState<RevenueReportResponse | null>(null);

  const showRevenueUi = reportType === "revenue";
  const busy = loading;

  const validateDates = (required: boolean, from: Date | null, to: Date | null): string | null => {
    if (!required) return null;
    if (!from || !to) return "Ustaw zakres dat.";
    if (from.getTime() > to.getTime()) return "Data „od” nie może być późniejsza niż „do”.";
    return null;
  };

  // ✅ params dla PDF / innych raportów (bez group_by)
  const commonParams = useMemo(() => {
    if (!dateFrom || !dateTo) return {};
    return {
      date_from: toYmd(dateFrom),
      date_to: toYmd(dateTo),
    };
  }, [dateFrom, dateTo]);

  // ✅ tylko revenue potrzebuje group_by
  const revenueParams = useMemo(() => {
    if (!dateFrom || !dateTo) return null;
    return {
      date_from: toYmd(dateFrom),
      date_to: toYmd(dateTo),
      group_by: groupBy,
    };
  }, [dateFrom, dateTo, groupBy]);

  const loadAvailableReports = async () => {
    setPageError(null);
    setLoading(true);

    try {
      const res = await reportsApi.list();
      const list = res.available_reports || [];
      setAvailable(list);

      // jeśli backend nie zwróci aktualnie wybranego typu, ustaw pierwszy dostępny
      if (list.length) {
        const exists = list.some((r) => r.type === reportType);
        if (!exists) {
          setReportType(list[0].type);
        }
      }

      setSnack({ open: true, msg: "Lista raportów odświeżona.", severity: "info" });
    } catch (e: unknown) {
      setAvailable([]);
      const parsed = parseDrfError(e);
      setPageError(parsed.message || "Nie udało się pobrać listy raportów.");
    } finally {
      setLoading(false);
    }
  };

  const fetchRevenue = async () => {
    const v = validateDates(true, dateFrom, dateTo);
    if (v) {
      setPageError(v);
      return;
    }
    if (!revenueParams) return;

    setLoading(true);
    setPageError(null);

    try {
      const data = await reportsApi.getRevenue(revenueParams);
      setRevenueData(data);
      setSnack({ open: true, msg: "Dane przychodów odświeżone.", severity: "info" });
    } catch (e: unknown) {
      setRevenueData(null);
      const parsed = parseDrfError(e);
      setPageError(parsed.message || "Nie udało się pobrać danych przychodów.");
    } finally {
      setLoading(false);
    }
  };

  const downloadPdf = async () => {
    // revenue wymaga zakresu. Pozostałe raporty mogą działać bez dat.
    const v = validateDates(reportType === "revenue", dateFrom, dateTo);
    if (v) {
      setPageError(v);
      return;
    }

    setLoading(true);
    setPageError(null);

    try {
      const { blob, filename } = await reportsApi.pdf(reportType, commonParams);

      const fallbackName =
        reportType === "revenue" && commonParams.date_from && commonParams.date_to
          ? `raport_${reportType}_${commonParams.date_from}_${commonParams.date_to}.pdf`
          : `raport_${reportType}.pdf`;

      downloadBlob(blob, filename || fallbackName);
      setSnack({ open: true, msg: "PDF został pobrany.", severity: "success" });
    } catch (e: unknown) {
      const parsed = parseDrfError(e);
      setPageError(parsed.message || "Nie udało się pobrać pliku PDF.");
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    setPageError(null);

    // walidujemy wg nowego wyboru typu (draft)
    const requireDates = draftReportType === "revenue";
    const v = validateDates(requireDates, draftDateFrom, draftDateTo);
    if (v) {
      setPageError(v);
      return;
    }

    setReportType(draftReportType);
    setDateFrom(draftDateFrom);
    setDateTo(draftDateTo);
    setGroupBy(draftGroupBy);
  };

  const resetFilters = () => {
    const from = new Date(new Date().setMonth(new Date().getMonth() - 1));
    const to = new Date();

    setDraftReportType("revenue");
    setDraftDateFrom(from);
    setDraftDateTo(to);
    setDraftGroupBy("day");

    setReportType("revenue");
    setDateFrom(from);
    setDateTo(to);
    setGroupBy("day");

    setRevenueData(null);
    setPageError(null);
  };

  const hasUnappliedChanges = useMemo(() => {
    return (
      draftReportType !== reportType ||
      draftGroupBy !== groupBy ||
      (draftDateFrom?.getTime?.() ?? null) !== (dateFrom?.getTime?.() ?? null) ||
      (draftDateTo?.getTime?.() ?? null) !== (dateTo?.getTime?.() ?? null)
    );
  }, [draftReportType, reportType, draftGroupBy, groupBy, draftDateFrom, dateFrom, draftDateTo, dateTo]);

  const reportDescription = useMemo(() => {
    const found = available.find((r) => r.type === reportType);
    return found?.description || null;
  }, [available, reportType]);

  // init: load available reports
  useEffect(() => {
    void loadAvailableReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // gdy zmienisz typ raportu (applied) -> dla revenue domyślnie pobieramy dane
  useEffect(() => {
    setPageError(null);

    if (reportType === "revenue") {
      void fetchRevenue();
    } else {
      setRevenueData(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportType]);

  const inlineHint = useMemo(() => {
    if (draftReportType === "revenue") return "Wybierz zakres dat i (opcjonalnie) grupowanie.";
    return "Ten raport jest dostępny do pobrania jako PDF.";
  }, [draftReportType]);

  return (
    <Stack
      spacing={2}
      sx={{ width: "100%", maxWidth: 1200, mx: "auto", px: { xs: 1, sm: 2 }, py: { xs: 2, sm: 3 } }}
    >
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: { xs: "flex-start", sm: "center" },
          gap: 2,
          flexWrap: "wrap",
        }}
      >
        <Box>
          <Typography variant="h5" fontWeight={900}>
            Raporty
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Generuj podsumowania i pobieraj raporty.
            {reportDescription ? ` • ${reportDescription}` : ""}
          </Typography>
        </Box>

        <Stack direction="row" spacing={1} alignItems="center">
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={() => void loadAvailableReports()}
            disabled={busy}
          >
            Odśwież
          </Button>

          <Button
            variant="contained"
            color="secondary"
            startIcon={<PdfIcon />}
            onClick={() => void downloadPdf()}
            disabled={busy}
          >
            Pobierz PDF
          </Button>
        </Stack>
      </Box>

      {pageError && (
        <Alert severity="error" onClose={() => setPageError(null)}>
          {pageError}
        </Alert>
      )}

      <Paper variant="outlined" sx={{ p: 2, position: "relative" }}>
        {loading && <LinearProgress sx={{ position: "absolute", left: 0, right: 0, top: 0 }} />}

        <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={pl}>
          <Stack spacing={2} sx={{ pt: loading ? 1 : 0 }}>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  select
                  label="Rodzaj raportu"
                  fullWidth
                  value={draftReportType}
                  onChange={(e) => setDraftReportType(e.target.value as ReportType)}
                  disabled={busy}
                >
                  {available.length === 0 ? (
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

              <Grid item xs={12} sm={6} md={3}>
                <DatePicker
                  label="Data od"
                  value={draftDateFrom}
                  onChange={(v) => setDraftDateFrom(v)}
                  slotProps={{ textField: { fullWidth: true } }}
                  disabled={draftReportType !== "revenue" || busy}
                />
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <DatePicker
                  label="Data do"
                  value={draftDateTo}
                  onChange={(v) => setDraftDateTo(v)}
                  slotProps={{ textField: { fullWidth: true } }}
                  disabled={draftReportType !== "revenue" || busy}
                />
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                {draftReportType === "revenue" ? (
                  <TextField
                    select
                    label="Grupowanie"
                    fullWidth
                    value={draftGroupBy}
                    onChange={(e) => setDraftGroupBy(e.target.value as RevenueGroupBy)}
                    disabled={busy}
                  >
                    <MenuItem value="day">Dziennie</MenuItem>
                    <MenuItem value="month">Miesięcznie</MenuItem>
                  </TextField>
                ) : (
                  <Alert severity="info" sx={{ mb: 0 }}>
                    Ten raport jest dostępny jako PDF.
                  </Alert>
                )}
              </Grid>
            </Grid>

            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1}
              alignItems={{ xs: "stretch", sm: "center" }}
              justifyContent="space-between"
            >
              <Typography variant="body2" color="text.secondary">
                {inlineHint}
              </Typography>

              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                <Button variant="outlined" onClick={resetFilters} disabled={busy}>
                  Wyczyść
                </Button>
                <Button variant="contained" onClick={applyFilters} disabled={busy || !hasUnappliedChanges}>
                  Zastosuj
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<RefreshIcon />}
                  onClick={() => void fetchRevenue()}
                  disabled={busy || reportType !== "revenue"}
                >
                  Odśwież dane
                </Button>
              </Stack>
            </Stack>

            <Divider />
          </Stack>
        </LocalizationProvider>

        {loading && (
          <Box sx={{ textAlign: "center", py: 3 }}>
            <CircularProgress />
          </Box>
        )}

        {showRevenueUi && !loading && revenueData ? (
          <Stack spacing={2}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <Card variant="outlined" sx={{ borderRadius: 3 }}>
                  <CardContent>
                    <Typography variant="subtitle2" color="text.secondary">
                      Całkowity przychód
                    </Typography>
                    <Typography variant="h4" fontWeight={800}>
                      {formatMoneyPLN(revenueData.summary.total_revenue)}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={4}>
                <Card variant="outlined" sx={{ borderRadius: 3 }}>
                  <CardContent>
                    <Typography variant="subtitle2" color="text.secondary">
                      Zrealizowane wizyty
                    </Typography>
                    <Typography variant="h4" fontWeight={800}>
                      {revenueData.summary.total_appointments}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={4}>
                <Card variant="outlined" sx={{ borderRadius: 3 }}>
                  <CardContent>
                    <Typography variant="subtitle2" color="text.secondary">
                      Średnia wartość wizyty
                    </Typography>
                    <Typography variant="h4" fontWeight={800}>
                      {formatMoneyPLN(revenueData.summary.average_per_appointment)}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
              <Table>
                <TableHead sx={{ bgcolor: "grey.50" }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 800 }}>
                      Okres ({groupBy === "day" ? "Dzień" : "Miesiąc"})
                    </TableCell>
                    <TableCell align="center" sx={{ fontWeight: 800 }}>
                      Liczba wizyt
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 800 }}>
                      Przychód
                    </TableCell>
                  </TableRow>
                </TableHead>

                <TableBody>
                  {revenueData.data.map((row) => (
                    <TableRow key={row.period} hover>
                      <TableCell sx={{ fontWeight: 600 }}>{row.period}</TableCell>
                      <TableCell align="center">{row.appointments_count}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 800 }}>
                        {formatMoneyPLN(row.revenue)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Stack>
        ) : (
          !loading && (
            <Alert severity="info" sx={{ mt: 2 }}>
              {reportType === "revenue"
                ? "Ustaw filtry i kliknij „Zastosuj”, aby zobaczyć dane przychodów."
                : "Wybierz raport i kliknij „Pobierz PDF”."
              }
            </Alert>
          )
        )}
      </Paper>

      <Snackbar
        open={snack.open}
        autoHideDuration={3200}
        onClose={() => setSnack((p) => ({ ...p, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert onClose={() => setSnack((p) => ({ ...p, open: false }))} severity={snack.severity} sx={{ width: "100%" }}>
          {snack.msg}
        </Alert>
      </Snackbar>
    </Stack>
  );
}
