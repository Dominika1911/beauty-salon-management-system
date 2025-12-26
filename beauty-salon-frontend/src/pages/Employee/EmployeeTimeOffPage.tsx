import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { DatePicker, LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { pl } from "date-fns/locale";

import { timeOffApi } from "@/api/timeOff";
import type { DRFPaginated, TimeOff, TimeOffStatus } from "@/types";

/* =========================
   TYPES
   ========================= */
type StatusFilter = TimeOffStatus | "ALL";

/* =========================
   STATUS CHIP (backend-driven)
   ========================= */
function StatusChip({ status, label }: { status: TimeOffStatus; label: string }) {
  switch (status) {
    case "PENDING":
      return <Chip label={label} color="warning" size="small" />;
    case "APPROVED":
      return <Chip label={label} color="success" size="small" />;
    case "REJECTED":
      return <Chip label={label} color="error" size="small" />;
    default:
      return <Chip label={label} size="small" />;
  }
}

function toYmd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function getErrorMessage(err: unknown): string {
  const e = err as any;
  return (
    e?.response?.data?.detail ||
    e?.response?.data?.message ||
    e?.message ||
    "Nie udało się wykonać operacji."
  );
}

export default function EmployeeTimeOffPage(): JSX.Element {
  /* =========================
     STATE
     ========================= */
  const [data, setData] = useState<DRFPaginated<TimeOff> | null>(null);
  const [page, setPage] = useState(1);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [search, setSearch] = useState("");

  const ordering = "-created_at";

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  const [from, setFrom] = useState<Date | null>(new Date());
  const [to, setTo] = useState<Date | null>(new Date());
  const [reason, setReason] = useState("");

  /* =========================
     DERIVED
     ========================= */
  const items = useMemo(() => data?.results ?? [], [data]);

  const isValidRange = useMemo(() => {
    if (!from || !to) return false;
    return from.getTime() <= to.getTime();
  }, [from, to]);

  /* =========================
     EFFECTS
     ========================= */
  useEffect(() => {
    setPage(1);
  }, [statusFilter, search]);

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");

    try {
      const res = await timeOffApi.list({
        page,
        ordering,
        status: statusFilter === "ALL" ? undefined : statusFilter,
        search: search.trim() || undefined,
      });
      setData(res);
    } catch (e) {
      setErr(getErrorMessage(e));
      setData({ count: 0, next: null, previous: null, results: [] });
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, search]);

  useEffect(() => {
    void load();
  }, [load]);

  /* =========================
     ACTIONS
     ========================= */
  const submit = useCallback(async () => {
    setErr("");
    setMsg("");

    if (!from || !to || !isValidRange) {
      setErr("Zakres dat jest niepoprawny.");
      return;
    }

    setSubmitting(true);
    try {
      await timeOffApi.create({
        date_from: toYmd(from),
        date_to: toYmd(to),
        reason: reason.trim() || undefined,
      });

      setMsg("Wniosek urlopowy wysłany.");
      setReason("");
      setPage(1);
      await load();
    } catch (e) {
      setErr(getErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  }, [from, to, isValidRange, reason, load]);

  const canPrev = Boolean(data?.previous) && !loading;
  const canNext = Boolean(data?.next) && !loading;

  /* =========================
     RENDER
     ========================= */
  if (loading && !data) {
    return (
      <Stack alignItems="center" sx={{ py: 4 }}>
        <CircularProgress />
      </Stack>
    );
  }

  return (
    <Stack spacing={2} sx={{ maxWidth: 800 }}>
      <Typography variant="h5" fontWeight={700}>
        Urlopy
      </Typography>

      {msg && <Alert severity="success">{msg}</Alert>}
      {err && <Alert severity="error">{err}</Alert>}

      {/* CREATE */}
      <Paper sx={{ p: 2 }}>
        <Typography variant="h6">Zgłoś urlop</Typography>

        <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={pl}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mt: 2 }}>
            <DatePicker label="Od" value={from} onChange={setFrom} />
            <DatePicker label="Do" value={to} onChange={setTo} />
          </Stack>
        </LocalizationProvider>

        <TextField
          label="Powód (opcjonalnie)"
          fullWidth
          sx={{ mt: 2 }}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />

        <Box sx={{ mt: 2 }}>
          <Button variant="contained" onClick={submit} disabled={!isValidRange || submitting}>
            Wyślij wniosek
          </Button>
        </Box>
      </Paper>

      {/* LIST */}
      <Paper sx={{ p: 2 }}>
        <Stack spacing={1}>
          {loading ? (
            <CircularProgress size={24} />
          ) : items.length === 0 ? (
            <Alert severity="info">Brak wniosków.</Alert>
          ) : (
            items.map((x) => (
              <Paper key={x.id} variant="outlined" sx={{ p: 1.5 }}>
                <Stack direction="row" justifyContent="space-between">
                  <Box>
                    <Typography fontWeight={600}>
                      {x.date_from} → {x.date_to}
                    </Typography>
                    {x.reason && <Typography variant="body2">{x.reason}</Typography>}
                  </Box>
                  <StatusChip status={x.status} label={x.status_display} />
                </Stack>
              </Paper>
            ))
          )}
        </Stack>
      </Paper>
    </Stack>
  );
}
