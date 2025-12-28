import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  InputLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  Stack,
  Typography,
} from "@mui/material";
import type { AlertColor } from "@mui/material/Alert";

import type { Appointment, AppointmentStatus, DRFPaginated } from "@/types";
import { appointmentsApi } from "@/api/appointments";
import { parseDrfError } from "@/utils/drfErrors";

type StatusColor = "warning" | "success" | "default" | "error";
type Ordering = "start" | "-start" | "status" | "-status" | "created_at" | "-created_at";

type SnackState = { open: boolean; msg: string; severity: AlertColor };

const EMPTY_PAGE: DRFPaginated<Appointment> = {
  count: 0,
  next: null,
  previous: null,
  results: [],
};

function statusColor(status: AppointmentStatus): StatusColor {
  switch (status) {
    case "CONFIRMED":
      return "success";
    case "PENDING":
      return "warning";
    case "CANCELLED":
      return "error";
    case "COMPLETED":
      return "success";
    case "NO_SHOW":
      return "error";
    default:
      return "default";
  }
}

function formatPL(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("pl-PL");
}

function formatPrice(price?: string | number): string {
  if (price == null) return "—";
  const n = Number(price);
  if (Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN",
  }).format(n);
}

function orderingLabel(o: Ordering): string {
  // Uwaga: DRF "ordering" działa jak sortowanie rosnąco/malejąco po polu.
  // start: rosnąco -> najbliższe terminy pierwsze
  // -start: malejąco -> najdalsze terminy pierwsze
  switch (o) {
    case "start":
      return "Najbliższe terminy";
    case "-start":
      return "Najdalsze terminy";
    case "-created_at":
      return "Najnowsze dodane";
    case "created_at":
      return "Najstarsze dodane";
    // status: alfabetycznie po kodzie statusu
    case "-status":
      return "Status: od oczekujących";
    case "status":
      return "Status: od anulowanych";
    default:
      return "Sortowanie";
  }
}

export default function EmployeeAppointmentsPage(): JSX.Element {
  const [data, setData] = useState<DRFPaginated<Appointment>>(EMPTY_PAGE);
  const [page, setPage] = useState(1);

  // ✅ domyślnie: najbliższe terminy (bardziej naturalne dla pracownika)
  const [draftOrdering, setDraftOrdering] = useState<Ordering>("start");
  const [ordering, setOrdering] = useState<Ordering>("start");

  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  const [pageError, setPageError] = useState<string | null>(null);
  const [snack, setSnack] = useState<SnackState>({ open: false, msg: "", severity: "info" });

  const busy = loading || busyId != null;
  const hasUnappliedFilters = draftOrdering !== ordering;

  // reset page when applied backend params change
  useEffect(() => {
    setPage(1);
  }, [ordering]);

  const load = useCallback(async () => {
    setLoading(true);
    setPageError(null);

    try {
      const res = await appointmentsApi.getMy({ page, ordering });
      setData(res);
    } catch (e: unknown) {
      const parsed = parseDrfError(e);
      setPageError(parsed.message || "Nie udało się wczytać wizyt. Spróbuj ponownie.");
      setData(EMPTY_PAGE);
    } finally {
      setLoading(false);
    }
  }, [page, ordering]);

  useEffect(() => {
    void load();
  }, [load]);

  const canPrev = Boolean(data.previous) && !loading;
  const canNext = Boolean(data.next) && !loading;

  const applyFilters = () => {
    if (!hasUnappliedFilters) return;
    setOrdering(draftOrdering);
    setSnack({
      open: true,
      msg: `Zastosowano sortowanie: ${orderingLabel(draftOrdering)}.`,
      severity: "info",
    });
  };

  const clearFilters = () => {
    setDraftOrdering("start");
    setOrdering("start");
    setSnack({ open: true, msg: "Przywrócono domyślne sortowanie.", severity: "info" });
  };

  const patchRow = useCallback((updated: Appointment) => {
    setData((prev) => {
      const prevResults = prev.results ?? [];
      const nextResults = prevResults.map((r) => (r.id === updated.id ? updated : r));
      return { ...prev, results: nextResults };
    });
  }, []);

  const runAction = async (
    fn: (id: number) => Promise<Appointment>,
    id: number,
    successMsg: string
  ) => {
    setBusyId(id);
    setPageError(null);

    try {
      const updated = await fn(id);
      patchRow(updated); // ✅ bez reloadu
      setSnack({ open: true, msg: successMsg, severity: "success" });
    } catch (e: unknown) {
      const parsed = parseDrfError(e);
      setPageError(parsed.message || "Nie udało się wykonać akcji. Spróbuj ponownie.");
    } finally {
      setBusyId(null);
    }
  };

  const rows = useMemo(() => data.results ?? [], [data.results]);

  const emptyText = useMemo(() => {
    if (ordering === "start") return "Nie masz jeszcze żadnych wizyt.";
    return `Brak wizyt dla wybranego sortowania („${orderingLabel(ordering)}”).`;
  }, [ordering]);

  // Loader na start (pierwsze ładowanie)
  if (loading && rows.length === 0) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", p: 5 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Stack
      spacing={2.5}
      sx={{
        width: "100%",
        maxWidth: 1200,
        mx: "auto",
        px: { xs: 1, sm: 2 },
        py: { xs: 2, sm: 3 },
      }}
    >
      {loading && <LinearProgress />}

      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={2}
        alignItems={{ xs: "stretch", md: "center" }}
        justifyContent="space-between"
      >
        <Box>
          <Typography variant="h5" fontWeight={900}>
            Moje wizyty
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Tutaj zobaczysz swoje terminy i wykonasz dostępne akcje.
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Sortowanie: <strong>{orderingLabel(ordering)}</strong>
          </Typography>
        </Box>

        <Button variant="outlined" onClick={() => void load()} disabled={busy}>
          Odśwież
        </Button>
      </Stack>

      {pageError && (
        <Alert severity="error" onClose={() => setPageError(null)}>
          {pageError}
        </Alert>
      )}

      {/* FILTERS + PAGINATION */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={2}>
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={2}
            justifyContent="space-between"
            alignItems={{ xs: "stretch", md: "center" }}
          >
            <FormControl size="small" sx={{ minWidth: 260 }} disabled={busy}>
              <InputLabel>Sortowanie</InputLabel>
              <Select
                value={draftOrdering}
                label="Sortowanie"
                onChange={(e) => setDraftOrdering(e.target.value as Ordering)}
              >
                <MenuItem value="start">Najbliższe terminy</MenuItem>
                <MenuItem value="-start">Najdalsze terminy</MenuItem>
                <MenuItem value="-created_at">Najnowsze dodane</MenuItem>
                <MenuItem value="created_at">Najstarsze dodane</MenuItem>
                <MenuItem value="-status">Status: od oczekujących</MenuItem>
                <MenuItem value="status">Status: od anulowanych</MenuItem>
              </Select>
            </FormControl>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
              <Button variant="outlined" onClick={clearFilters} disabled={busy}>
                Wyczyść
              </Button>
              <Button
                variant="contained"
                onClick={applyFilters}
                disabled={busy || !hasUnappliedFilters}
              >
                Zastosuj
              </Button>
            </Stack>
          </Stack>

          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1}
            alignItems={{ sm: "center" }}
            justifyContent="space-between"
          >
            <Typography variant="body2" color="text.secondary">
              Wyniki: {data.count} • Strona: {page}
            </Typography>

            <Stack direction="row" spacing={1}>
              <Button
                variant="outlined"
                disabled={!canPrev}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Poprzednia
              </Button>
              <Button variant="contained" disabled={!canNext} onClick={() => setPage((p) => p + 1)}>
                Następna
              </Button>
            </Stack>
          </Stack>
        </Stack>
      </Paper>

      {/* LIST */}
      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
          <CircularProgress />
        </Box>
      ) : rows.length === 0 ? (
        <Alert severity="info">{emptyText}</Alert>
      ) : (
        <Stack spacing={1.5}>
          {rows.map((a) => {
            const isBusy = busyId === a.id;

            // backend jest jedynym źródłem prawdy dla UI akcji
            const canConfirm = a.can_confirm;
            const canCancel = a.can_cancel;
            const canComplete = a.can_complete;
            const canNoShow = a.can_no_show;

            return (
              <Paper key={a.id} variant="outlined" sx={{ p: 2 }}>
                <Stack spacing={1.25}>
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    justifyContent="space-between"
                    alignItems={{ sm: "flex-start" }}
                    spacing={2}
                  >
                    <Box sx={{ flex: 1 }}>
                      <Typography fontWeight={900}>{a.service_name}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Klient: {a.client_name ?? "—"}
                      </Typography>
                      <Typography variant="body2" sx={{ mt: 0.75 }}>
                        Termin: {formatPL(a.start)} – {formatPL(a.end)}
                      </Typography>
                    </Box>

                    <Stack alignItems={{ xs: "flex-start", sm: "flex-end" }} spacing={0.5}>
                      <Chip label={a.status_display || a.status} size="small" color={statusColor(a.status)} />
                      <Typography fontWeight={800}>{formatPrice(a.service_price)}</Typography>
                    </Stack>
                  </Stack>

                  {(canConfirm || canCancel || canComplete || canNoShow) && (
                    <>
                      <Divider />
                      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                        {canConfirm && (
                          <Button
                            size="small"
                            variant="contained"
                            disabled={busy || isBusy}
                            onClick={() =>
                              void runAction(
                                appointmentsApi.confirm,
                                a.id,
                                "Wizyta została potwierdzona."
                              )
                            }
                            startIcon={isBusy ? <CircularProgress size={18} /> : undefined}
                          >
                            Potwierdź
                          </Button>
                        )}

                        {canCancel && (
                          <Button
                            size="small"
                            color="error"
                            variant="outlined"
                            disabled={busy || isBusy}
                            onClick={() =>
                              void runAction(appointmentsApi.cancel, a.id, "Wizyta została anulowana.")
                            }
                            startIcon={isBusy ? <CircularProgress size={18} /> : undefined}
                          >
                            Anuluj
                          </Button>
                        )}

                        {canComplete && (
                          <Button
                            size="small"
                            color="success"
                            variant="contained"
                            disabled={busy || isBusy}
                            onClick={() =>
                              void runAction(
                                appointmentsApi.complete,
                                a.id,
                                "Wizyta została zakończona."
                              )
                            }
                            startIcon={isBusy ? <CircularProgress size={18} /> : undefined}
                          >
                            Zakończ
                          </Button>
                        )}

                        {canNoShow && (
                          <Button
                            size="small"
                            color="error"
                            variant="contained"
                            disabled={busy || isBusy}
                            onClick={() =>
                              void runAction(appointmentsApi.noShow, a.id, "Ustawiono no-show.")
                            }
                            startIcon={isBusy ? <CircularProgress size={18} /> : undefined}
                          >
                            No-show
                          </Button>
                        )}
                      </Stack>
                    </>
                  )}
                </Stack>
              </Paper>
            );
          })}
        </Stack>
      )}

      <Snackbar
        open={snack.open}
        autoHideDuration={3000}
        onClose={() => setSnack((p) => ({ ...p, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity={snack.severity}
          onClose={() => setSnack((p) => ({ ...p, open: false }))}
          sx={{ width: "100%" }}
        >
          {snack.msg}
        </Alert>
      </Snackbar>
    </Stack>
  );
}
