import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  Typography,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Divider,
} from "@mui/material";

import type { Appointment, AppointmentStatus, DRFPaginated } from "@/types";
import { appointmentsApi } from "@/api/appointments";

type StatusFilter = AppointmentStatus | "ALL";
type Ordering = "start" | "-start" | "status" | "-status" | "created_at" | "-created_at";

function getErrorMessage(e: unknown, fallback = "Wystąpił błąd"): string {
  const anyErr = e as any;
  return (
    anyErr?.response?.data?.detail ||
    anyErr?.response?.data?.message ||
    anyErr?.message ||
    fallback
  );
}

function formatPL(dt: string): string {
  const d = new Date(dt);
  return Number.isNaN(d.getTime())
    ? dt
    : d.toLocaleString("pl-PL", {
        dateStyle: "long",
        timeStyle: "short",
      });
}

function formatPrice(price?: string | number): string {
  if (price == null) return "—";
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN",
  }).format(Number(price));
}

function statusChipColor(status: AppointmentStatus): "default" | "warning" | "success" | "error" {
  switch (status) {
    case "PENDING":
      return "warning";
    case "CONFIRMED":
      return "success";
    case "COMPLETED":
      return "default";
    case "CANCELLED":
      return "error";
    default:
      return "default";
  }
}

export default function ClientAppointmentsPage(): JSX.Element {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  const [page, setPage] = useState(1);
  const [data, setData] = useState<DRFPaginated<Appointment> | null>(null);

  // backend filters (100% AppointmentViewSet.filterset_fields + ordering_fields)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [ordering, setOrdering] = useState<Ordering>("-start");

  const [busyCancelId, setBusyCancelId] = useState<number | null>(null);

  // reset page on backend param change
  useEffect(() => {
    setPage(1);
  }, [statusFilter, ordering]);

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");

    try {
      const res = await appointmentsApi.list({
        page,
        ordering,
        status: statusFilter === "ALL" ? undefined : statusFilter,
        // NIE wysyłamy client=... — backend dla CLIENT i tak zwróci tylko jego wizyty
      });
      setData(res);
    } catch (e) {
      setErr(getErrorMessage(e, "Błąd podczas ładowania wizyt."));
      setData({ count: 0, next: null, previous: null, results: [] });
    } finally {
      setLoading(false);
    }
  }, [page, ordering, statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const canPrev = Boolean(data?.previous) && !loading;
  const canNext = Boolean(data?.next) && !loading;

  const handleCancel = async (a: Appointment) => {
    if (!a.can_cancel) return;

    const ok = window.confirm("Czy na pewno chcesz anulować tę wizytę?");
    if (!ok) return;

    setBusyCancelId(a.id);
    setErr("");
    setMsg("");

    try {
      await appointmentsApi.cancel(a.id);
      setMsg("Wizyta została anulowana.");
      await load();
    } catch (e) {
      setErr(getErrorMessage(e, "Nie udało się anulować wizyty."));
    } finally {
      setBusyCancelId(null);
    }
  };

  const results = useMemo(() => data?.results ?? [], [data]);

  if (loading && !data) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", p: 5 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Stack spacing={3} sx={{ maxWidth: 900, mx: "auto", p: 2 }}>
      <Stack spacing={0.5}>
        <Typography variant="h5" fontWeight={900}>
          Moje wizyty
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Backend: <code>GET /api/appointments/</code> (CLIENT → tylko własne wizyty)
        </Typography>
      </Stack>

      {msg && <Alert severity="success" onClose={() => setMsg("")}>{msg}</Alert>}
      {err && <Alert severity="error" onClose={() => setErr("")}>{err}</Alert>}

      {/* FILTERS */}
      <Paper sx={{ p: 2 }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }} justifyContent="space-between">
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <FormControl size="small" sx={{ minWidth: 220 }}>
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

            <FormControl size="small" sx={{ minWidth: 220 }}>
              <InputLabel>ordering (backend)</InputLabel>
              <Select
                label="ordering (backend)"
                value={ordering}
                onChange={(e) => setOrdering(e.target.value as Ordering)}
              >
                <MenuItem value="-start">-start</MenuItem>
                <MenuItem value="start">start</MenuItem>
                <MenuItem value="-created_at">-created_at</MenuItem>
                <MenuItem value="created_at">created_at</MenuItem>
                <MenuItem value="-status">-status</MenuItem>
                <MenuItem value="status">status</MenuItem>
              </Select>
            </FormControl>
          </Stack>

          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="body2" color="text.secondary">
              Łącznie: {data?.count ?? "—"} • Strona: {page}
            </Typography>

            <Button variant="outlined" disabled={!canPrev} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              Poprzednia
            </Button>
            <Button variant="contained" disabled={!canNext} onClick={() => setPage((p) => p + 1)}>
              Następna
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {/* LIST */}
      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", p: 2 }}>
          <CircularProgress />
        </Box>
      ) : results.length === 0 ? (
        <Alert severity="info">Brak wizyt.</Alert>
      ) : (
        <Stack spacing={1.5}>
          {results.map((a) => (
            <Paper key={a.id} variant="outlined" sx={{ p: 2 }}>
              <Stack spacing={1}>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
                  <Box>
                    <Typography fontWeight={800}>{a.service_name}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Pracownik: {a.employee_name}
                    </Typography>
                  </Box>

                  <Stack alignItems="flex-end" spacing={0.5}>
                    <Chip
                      size="small"
                      label={a.status_display || a.status}
                      color={statusChipColor(a.status)}
                    />
                    <Typography fontWeight={700}>{formatPrice(a.service_price)}</Typography>
                  </Stack>
                </Stack>

                <Divider />

                <Typography variant="body2">
                  {formatPL(a.start)} – {formatPL(a.end)}
                </Typography>

                {a.can_cancel && (
                  <Button
                    size="small"
                    color="error"
                    variant="outlined"
                    disabled={busyCancelId === a.id}
                    onClick={() => void handleCancel(a)}
                  >
                    Anuluj wizytę
                  </Button>
                )}
              </Stack>
            </Paper>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
