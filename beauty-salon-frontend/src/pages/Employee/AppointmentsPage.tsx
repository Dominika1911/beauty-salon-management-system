import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Typography,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Divider,
} from "@mui/material";

import type { Appointment, AppointmentStatus, DRFPaginated } from "@/types";
import { appointmentsApi } from "@/api/appointments";

type StatusColor = "warning" | "success" | "default" | "error";
type Ordering = "start" | "-start" | "status" | "-status" | "created_at" | "-created_at";

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

function formatPL(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("pl-PL");
}

function formatPrice(price?: string | number): string {
  if (price == null) return "—";
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN",
  }).format(Number(price));
}

function getErrorMessage(err: unknown): string {
  const e = err as any;
  return (
    e?.response?.data?.detail ||
    e?.response?.data?.message ||
    e?.message ||
    "Wystąpił błąd."
  );
}

export default function EmployeeAppointmentsPage(): JSX.Element {
  const [page, setPage] = useState(1);
  const [ordering, setOrdering] = useState<Ordering>("-start");

  const [data, setData] = useState<DRFPaginated<Appointment> | null>(null);
  const [loading, setLoading] = useState(true);

  const [busyId, setBusyId] = useState<number | null>(null);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  // reset page when backend params change
  useEffect(() => {
    setPage(1);
  }, [ordering]);

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");

    try {
      const res = await appointmentsApi.getMy({ page, ordering });
      setData(res);
    } catch (e) {
      setErr(getErrorMessage(e));
      setData({ count: 0, next: null, previous: null, results: [] });
    } finally {
      setLoading(false);
    }
  }, [page, ordering]);

  useEffect(() => {
    void load();
  }, [load]);

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

  const canPrev = Boolean(data?.previous) && !loading;
  const canNext = Boolean(data?.next) && !loading;

  const results = useMemo(() => data?.results ?? [], [data]);

  if (loading && !data) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", p: 5 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Stack spacing={3}>
      <Typography variant="h5" fontWeight={600}>
        Moje wizyty (EMPLOYEE)
      </Typography>

      {msg && <Alert severity="success" onClose={() => setMsg("")}>{msg}</Alert>}
      {err && <Alert severity="error" onClose={() => setErr("")}>{err}</Alert>}

      {/* FILTERS (backend) */}
      <Paper sx={{ p: 2 }}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={2}
          justifyContent="space-between"
          alignItems={{ md: "center" }}
        >
          <FormControl size="small" sx={{ minWidth: 240 }}>
            <InputLabel>ordering (backend)</InputLabel>
            <Select
              value={ordering}
              label="ordering (backend)"
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

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", p: 3 }}>
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
                      Klient: {a.client_name ?? "—"}
                    </Typography>
                  </Box>

                  <Stack alignItems="flex-end" spacing={0.5}>
                    <Chip
                      label={a.status_display || a.status}
                      size="small"
                      color={statusColor(a.status)}
                    />
                    <Typography fontWeight={700}>{formatPrice(a.service_price)}</Typography>
                  </Stack>
                </Stack>

                <Divider />

                <Typography variant="body2">
                  Termin: {formatPL(a.start)} – {formatPL(a.end)}
                </Typography>

                <Stack direction="row" spacing={1}>
                  {a.can_confirm && (
                    <Button
                      size="small"
                      variant="contained"
                      disabled={busyId === a.id}
                      onClick={() => runAction(appointmentsApi.confirm, a.id, "Wizyta potwierdzona.")}
                    >
                      Potwierdź
                    </Button>
                  )}

                  {a.can_cancel && (
                    <Button
                      size="small"
                      color="error"
                      variant="outlined"
                      disabled={busyId === a.id}
                      onClick={() => runAction(appointmentsApi.cancel, a.id, "Wizyta anulowana.")}
                    >
                      Anuluj
                    </Button>
                  )}

                  {a.can_complete && (
                    <Button
                      size="small"
                      color="success"
                      variant="contained"
                      disabled={busyId === a.id}
                      onClick={() => runAction(appointmentsApi.complete, a.id, "Wizyta zakończona.")}
                    >
                      Zakończ
                    </Button>
                  )}
                </Stack>
              </Stack>
            </Paper>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
