// src/pages/Admin/AdminAppointmentsPage.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Typography,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Box,
  Divider,
} from "@mui/material";

import type { Appointment, AppointmentStatus, DRFPaginated } from "@/types";
import { appointmentsApi } from "@/api/appointments";

type StatusFilter = AppointmentStatus | "ALL";
type StatusColor = "default" | "success" | "warning" | "error";

/** ✅ stała – dzięki temu data nigdy nie jest null */
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
    default:
      return "default";
  }
}

function getErrorMessage(err: unknown): string {
  if (err && typeof err === "object") {
    const e = err as any;
    return e.response?.data?.detail || e.response?.data?.message || e.message || "Wystąpił błąd.";
  }
  return "Wystąpił błąd.";
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

function formatDateTimePL(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("pl-PL");
}

export default function AdminAppointmentsPage(): JSX.Element {
  const [data, setData] = useState<DRFPaginated<Appointment>>(EMPTY_PAGE);
  const [page, setPage] = useState(1); // DRF: page jest 1-indexed
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");

  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  // backend filter -> wracamy na 1 stronę
  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");

    try {
      const res = await appointmentsApi.list({
        page,
        ordering: "-created_at",
        status: statusFilter === "ALL" ? undefined : statusFilter,
      });

      setData(res);
    } catch (e) {
      setErr(getErrorMessage(e));
      setData(EMPTY_PAGE);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const canPrev = Boolean(data.previous) && !loading;
  const canNext = Boolean(data.next) && !loading;

  const goPrev = () => {
    if (!data.previous) return;
    setPage((p) => Math.max(1, p - 1));
  };

  const goNext = () => {
    if (!data.next) return;
    setPage((p) => p + 1);
  };

  const runAction = async (
    fn: (id: number) => Promise<Appointment>,
    id: number,
    successMsg: string
  ) => {
    setBusyId(id);
    setErr("");
    setMsg("");

    try {
      await fn(id);
      setMsg(successMsg);
      await load();
    } catch (e) {
      setErr(getErrorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  const rows = useMemo(() => data.results ?? [], [data.results]);

  // Loader na start (pierwsze ładowanie)
  if (loading && rows.length === 0) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", p: 5 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Stack spacing={3}>
      <Typography variant="h5" fontWeight={700}>
        Zarządzanie wizytami (ADMIN)
      </Typography>

      {msg && (
        <Alert severity="success" onClose={() => setMsg("")}>
          {msg}
        </Alert>
      )}

      {err && (
        <Alert severity="error" onClose={() => setErr("")}>
          {err}
        </Alert>
      )}

      {/* FILTER + PAGINATION */}
      <Paper sx={{ p: 2 }}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={2}
          justifyContent="space-between"
          alignItems={{ xs: "stretch", md: "center" }}
        >
          <FormControl size="small" sx={{ minWidth: 240 }}>
            <InputLabel>Status (backend)</InputLabel>
            <Select
              label="Status (backend)"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            >
              <MenuItem value="ALL">Wszystkie</MenuItem>
              <MenuItem value="PENDING">PENDING</MenuItem>
              <MenuItem value="CONFIRMED">CONFIRMED</MenuItem>
              <MenuItem value="COMPLETED">COMPLETED</MenuItem>
              <MenuItem value="CANCELLED">CANCELLED</MenuItem>
            </Select>
          </FormControl>

          <Stack direction="row" spacing={1} alignItems="center" justifyContent="flex-end">
            <Typography variant="body2" color="text.secondary">
              Łącznie: {data.count} • Strona: {page}
            </Typography>

            <Button variant="outlined" onClick={goPrev} disabled={!canPrev}>
              Poprzednia
            </Button>
            <Button variant="contained" onClick={goNext} disabled={!canNext}>
              Następna
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {/* LIST */}
      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", p: 3 }}>
          <CircularProgress />
        </Box>
      ) : rows.length === 0 ? (
        <Alert severity="info">Brak wizyt.</Alert>
      ) : (
        <Stack spacing={1}>
          {rows.map((a) => {
            const isBusy = busyId === a.id;

            // backend jest jedynym źródłem prawdy dla UI akcji
            const canConfirm = a.can_confirm;
            const canCancel = a.can_cancel;
            const canComplete = a.can_complete;

            return (
              <Paper key={a.id} variant="outlined" sx={{ p: 2 }}>
                <Stack spacing={1.5}>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                    <Box>
                      <Typography fontWeight={700}>{a.service_name}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Pracownik: {a.employee_name} • Klient: {a.client_name ?? "—"}
                      </Typography>
                    </Box>

                    <Stack alignItems="flex-end" spacing={0.5}>
                      <Chip
                        label={a.status_display || a.status}
                        color={statusColor(a.status)}
                        size="small"
                      />
                      <Typography fontWeight={700}>{formatPrice(a.service_price)}</Typography>
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

                  {(canConfirm || canCancel || canComplete) && <Divider />}

                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    {canConfirm && (
                      <Button
                        size="small"
                        variant="contained"
                        disabled={isBusy}
                        onClick={() => runAction(appointmentsApi.confirm, a.id, "Wizyta potwierdzona.")}
                      >
                        Potwierdź
                      </Button>
                    )}

                    {canCancel && (
                      <Button
                        size="small"
                        variant="outlined"
                        color="error"
                        disabled={isBusy}
                        onClick={() => runAction(appointmentsApi.cancel, a.id, "Wizyta anulowana.")}
                      >
                        Anuluj
                      </Button>
                    )}

                    {canComplete && (
                      <Button
                        size="small"
                        variant="contained"
                        color="success"
                        disabled={isBusy}
                        onClick={() => runAction(appointmentsApi.complete, a.id, "Wizyta zakończona.")}
                      >
                        Zakończ
                      </Button>
                    )}
                  </Stack>
                </Stack>
              </Paper>
            );
          })}
        </Stack>
      )}
    </Stack>
  );
}
