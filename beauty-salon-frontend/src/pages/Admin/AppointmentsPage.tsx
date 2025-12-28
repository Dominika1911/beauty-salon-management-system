// src/pages/Admin/AdminAppointmentsPage.tsx
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
  Pagination,
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

type StatusFilter = AppointmentStatus | "ALL";
type StatusColor = "default" | "success" | "warning" | "error";

type SnackState = {
  open: boolean;
  msg: string;
  severity: AlertColor;
};

const PAGE_SIZE = 20;

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

function statusLabel(status: AppointmentStatus): string {
  switch (status) {
    case "PENDING":
      return "Oczekuje";
    case "CONFIRMED":
      return "Potwierdzona";
    case "COMPLETED":
      return "Zakończona";
    case "CANCELLED":
      return "Anulowana";
    case "NO_SHOW":
      return "No-show";
    default:
      return status;
  }
}

function formatPrice(price?: string | number): string {
  if (price == null) return "—";
  const n = Number(price);
  if (Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN" }).format(n);
}

function formatDateTimePL(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("pl-PL");
}

export default function AdminAppointmentsPage(): JSX.Element {
  const [data, setData] = useState<DRFPaginated<Appointment>>(EMPTY_PAGE);
  const [page, setPage] = useState(1); // DRF page is 1-indexed

  // applied filters
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [ordering] = useState<string>("-created_at");

  // draft filters
  const [draftStatusFilter, setDraftStatusFilter] = useState<StatusFilter>("ALL");

  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  const [pageError, setPageError] = useState<string | null>(null);
  const [snack, setSnack] = useState<SnackState>({ open: false, msg: "", severity: "info" });

  const rows = useMemo(() => data.results ?? [], [data.results]);

  const initialLoading = loading && rows.length === 0;
  const busy = loading || busyId !== null;

  // reset page when applied filter changes
  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  // keep draft synced with applied
  useEffect(() => {
    setDraftStatusFilter(statusFilter);
  }, [statusFilter]);

  const load = useCallback(async () => {
    setLoading(true);
    setPageError(null);

    try {
      const res = await appointmentsApi.list({
        page,
        ordering,
        status: statusFilter === "ALL" ? undefined : statusFilter,
      });
      setData(res);
    } catch (e: unknown) {
      const parsed = parseDrfError(e);
      setPageError(parsed.message || "Nie udało się pobrać wizyt. Spróbuj ponownie.");
      setData(EMPTY_PAGE);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, ordering]);

  useEffect(() => {
    void load();
  }, [load]);

  const hasUnappliedChanges = useMemo(
    () => draftStatusFilter !== statusFilter,
    [draftStatusFilter, statusFilter]
  );

  const hasActiveFiltersApplied = useMemo(() => statusFilter !== "ALL", [statusFilter]);

  const applyFilters = () => {
    setPage(1);
    setStatusFilter(draftStatusFilter);
  };

  const resetFilters = () => {
    setDraftStatusFilter("ALL");
    setPage(1);
    setStatusFilter("ALL");
  };

  const totalPages = useMemo(() => {
    const count = data.count ?? 0;
    return Math.max(1, Math.ceil(count / PAGE_SIZE));
  }, [data.count]);

  const emptyInfo = useMemo(() => {
    if (loading) return null;
    if (rows.length > 0) return null;
    if (hasActiveFiltersApplied) return "Brak wizyt dla wybranego statusu.";
    return "Brak wizyt.";
  }, [loading, rows.length, hasActiveFiltersApplied]);

  const patchRowAndCount = useCallback(
    (updated: Appointment) => {
      setData((prev) => {
        const prevResults = prev.results ?? [];

        const nextResultsRaw = prevResults.map((r) => (r.id === updated.id ? updated : r));

        const filterActive = statusFilter !== "ALL";
        const nextResults = filterActive
          ? nextResultsRaw.filter((r) => r.status === statusFilter)
          : nextResultsRaw;

        // jeśli filtr aktywny i status po akcji nie pasuje -> element znika z listy
        const removedByFilter = filterActive && updated.status !== statusFilter;

        const nextCount = removedByFilter ? Math.max(0, (prev.count ?? 0) - 1) : prev.count;

        return { ...prev, count: nextCount, results: nextResults };
      });
    },
    [statusFilter]
  );

  const runAction = async (fn: (id: number) => Promise<Appointment>, id: number, successMsg: string) => {
    setBusyId(id);
    setPageError(null);

    try {
      const updated = await fn(id);
      patchRowAndCount(updated);
      setSnack({ open: true, msg: successMsg, severity: "success" });
    } catch (e: unknown) {
      const parsed = parseDrfError(e);
      setPageError(parsed.message || "Nie udało się wykonać operacji. Spróbuj ponownie.");
    } finally {
      setBusyId(null);
    }
  };

  if (initialLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", p: 5 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Stack
      spacing={2}
      sx={{
        width: "100%",
        maxWidth: 1200,
        mx: "auto",
        px: { xs: 1, sm: 2 },
        py: { xs: 2, sm: 3 },
      }}
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
            Zarządzanie wizytami
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Przeglądaj i zarządzaj wizytami — filtruj po statusie i wykonuj akcje.
          </Typography>
        </Box>

        <Typography variant="body2" color="text.secondary">
          Łącznie: {data.count} • Strona: {page} / {totalPages}
        </Typography>
      </Box>

      {pageError && (
        <Alert severity="error" onClose={() => setPageError(null)}>
          {pageError}
        </Alert>
      )}

      <Paper variant="outlined" sx={{ p: 2, position: "relative" }}>
        {loading && <LinearProgress sx={{ position: "absolute", left: 0, right: 0, top: 0 }} />}

        <Stack spacing={2} sx={{ pt: loading ? 1 : 0 }}>
          {/* Filters */}
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={2}
            alignItems={{ md: "center" }}
            justifyContent="space-between"
          >
            <FormControl size="small" sx={{ minWidth: 240 }} disabled={busy}>
              <InputLabel>Status</InputLabel>
              <Select
                label="Status"
                value={draftStatusFilter}
                onChange={(e) => setDraftStatusFilter(e.target.value as StatusFilter)}
              >
                <MenuItem value="ALL">Wszystkie</MenuItem>
                <MenuItem value="PENDING">Oczekuje</MenuItem>
                <MenuItem value="CONFIRMED">Potwierdzona</MenuItem>
                <MenuItem value="COMPLETED">Zakończona</MenuItem>
                <MenuItem value="CANCELLED">Anulowana</MenuItem>
                <MenuItem value="NO_SHOW">No-show</MenuItem>
              </Select>
            </FormControl>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} justifyContent="flex-end">
              <Button
                variant="outlined"
                onClick={resetFilters}
                disabled={busy || (!hasActiveFiltersApplied && !hasUnappliedChanges)}
              >
                Wyczyść filtry
              </Button>
              <Button variant="contained" onClick={applyFilters} disabled={busy || !hasUnappliedChanges}>
                Zastosuj
              </Button>
              <Button variant="outlined" onClick={() => void load()} disabled={busy}>
                Odśwież
              </Button>
            </Stack>
          </Stack>

          <Divider />

          {/* List */}
          {loading && rows.length > 0 ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
              <CircularProgress />
            </Box>
          ) : emptyInfo ? (
            <Alert severity="info">{emptyInfo}</Alert>
          ) : (
            <Stack spacing={1}>
              {rows.map((a) => {
                const isBusy = busyId === a.id;

                const canConfirm = a.can_confirm;
                const canCancel = a.can_cancel;
                const canComplete = a.can_complete;
                const canNoShow = a.can_no_show;

                return (
                  <Paper key={a.id} variant="outlined" sx={{ p: 2 }}>
                    <Stack spacing={1.5}>
                      <Stack
                        direction={{ xs: "column", sm: "row" }}
                        justifyContent="space-between"
                        alignItems={{ sm: "flex-start" }}
                        spacing={1}
                      >
                        <Box>
                          <Typography fontWeight={800}>{a.service_name}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            Pracownik: {a.employee_name} • Klient: {a.client_name ?? "—"}
                          </Typography>
                        </Box>

                        <Stack alignItems={{ xs: "flex-start", sm: "flex-end" }} spacing={0.5}>
                          <Chip
                            label={a.status_display || statusLabel(a.status)}
                            color={statusColor(a.status)}
                            size="small"
                          />
                          <Typography fontWeight={800}>{formatPrice(a.service_price)}</Typography>
                        </Stack>
                      </Stack>

                      <Typography variant="body2">
                        {formatDateTimePL(a.start)} – {formatDateTimePL(a.end)}
                      </Typography>

                      {a.internal_notes ? (
                        <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: "pre-wrap" }}>
                          {a.internal_notes}
                        </Typography>
                      ) : null}

                      {(canConfirm || canCancel || canComplete || canNoShow) && <Divider />}

                      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                        {canConfirm && (
                          <Button
                            size="small"
                            variant="contained"
                            disabled={busy || isBusy}
                            onClick={() => void runAction(appointmentsApi.confirm, a.id, "Wizyta potwierdzona.")}
                          >
                            {isBusy ? "..." : "Potwierdź"}
                          </Button>
                        )}

                        {canCancel && (
                          <Button
                            size="small"
                            variant="outlined"
                            color="error"
                            disabled={busy || isBusy}
                            onClick={() => void runAction(appointmentsApi.cancel, a.id, "Wizyta anulowana.")}
                          >
                            {isBusy ? "..." : "Anuluj"}
                          </Button>
                        )}

                        {canComplete && (
                          <Button
                            size="small"
                            variant="contained"
                            color="success"
                            disabled={busy || isBusy}
                            onClick={() => void runAction(appointmentsApi.complete, a.id, "Wizyta zakończona.")}
                          >
                            {isBusy ? "..." : "Zakończ"}
                          </Button>
                        )}

                        {canNoShow && (
                          <Button
                            size="small"
                            variant="contained"
                            color="error"
                            disabled={busy || isBusy}
                            onClick={() => void runAction(appointmentsApi.noShow, a.id, "Ustawiono no-show.")}
                          >
                            {isBusy ? "..." : "No-show"}
                          </Button>
                        )}
                      </Stack>
                    </Stack>
                  </Paper>
                );
              })}
            </Stack>
          )}

          <Divider />

          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={2}
            alignItems={{ sm: "center" }}
            justifyContent="space-between"
          >
            <Typography variant="body2" color="text.secondary">
              Łącznie: {data.count}
            </Typography>

            <Pagination
              count={totalPages}
              page={page}
              onChange={(_, p) => setPage(p)}
              disabled={busy}
            />
          </Stack>
        </Stack>
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
