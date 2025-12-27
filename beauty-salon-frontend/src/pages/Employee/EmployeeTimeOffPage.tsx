// EmployeeTimeOffPage.tsx
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
import Pagination from "@mui/material/Pagination";

import { timeOffApi } from "@/api/timeOff";
import type { DRFPaginated, TimeOff, TimeOffStatus } from "@/types";

type StatusFilter = TimeOffStatus | "ALL";

function toYmd(d: Date): string {
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
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

function StatusChip({ status, label }: { status: TimeOffStatus; label: string }) {
  switch (status) {
    case "PENDING":
      return <Chip label={label} color="warning" size="small" />;
    case "APPROVED":
      return <Chip label={label} color="success" size="small" />;
    case "REJECTED":
      return <Chip label={label} color="error" size="small" />;
    case "CANCELLED":
      return <Chip label={label} color="default" size="small" />;
    default:
      return <Chip label={label} size="small" />;
  }
}

export default function EmployeeTimeOffPage(): JSX.Element {
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

  const items = useMemo(() => data?.results ?? [], [data]);

  const isValidRange = useMemo(() => {
    if (!from || !to) return false;
    return from.getTime() <= to.getTime();
  }, [from, to]);

  const totalPages = useMemo(() => {
    const count = data?.count ?? 0;
    return Math.max(1, Math.ceil(count / 10));
  }, [data]);

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
  }, [page, ordering, statusFilter, search]);

  useEffect(() => {
    load();
  }, [load]);

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

  return (
    <Stack spacing={2}>
      <Typography variant="h5" fontWeight={700}>
        Moje wnioski urlopowe
      </Typography>

      {msg && <Alert severity="success">{msg}</Alert>}
      {err && <Alert severity="error">{err}</Alert>}

      <Paper sx={{ p: 2 }}>
        <Stack spacing={2}>
          <Typography fontWeight={700}>Nowy wniosek</Typography>

          <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ md: "center" }}>
            <TextField
              size="small"
              label="Data od (YYYY-MM-DD)"
              value={from ? toYmd(from) : ""}
              onChange={(e) => {
                const v = e.target.value;
                const parts = v.split("-");
                if (parts.length === 3) {
                  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
                  if (!Number.isNaN(d.getTime())) setFrom(d);
                }
              }}
            />

            <TextField
              size="small"
              label="Data do (YYYY-MM-DD)"
              value={to ? toYmd(to) : ""}
              onChange={(e) => {
                const v = e.target.value;
                const parts = v.split("-");
                if (parts.length === 3) {
                  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
                  if (!Number.isNaN(d.getTime())) setTo(d);
                }
              }}
            />

            <TextField
              size="small"
              label="Powód (opcjonalnie)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              sx={{ minWidth: 260 }}
            />

            <Button variant="contained" onClick={submit} disabled={submitting || !isValidRange}>
              Wyślij
            </Button>
          </Stack>

          {!isValidRange && <Alert severity="warning">Zakres dat jest niepoprawny.</Alert>}
        </Stack>
      </Paper>

      <Paper sx={{ p: 2 }}>
        <Stack spacing={2}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ md: "center" }}>
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>Status</InputLabel>
              <Select
                label="Status"
                value={statusFilter}
                onChange={(e) => {
                  setPage(1);
                  setStatusFilter(e.target.value as StatusFilter);
                }}
              >
                <MenuItem value="ALL">ALL</MenuItem>
                <MenuItem value="PENDING">PENDING</MenuItem>
                <MenuItem value="APPROVED">APPROVED</MenuItem>
                <MenuItem value="REJECTED">REJECTED</MenuItem>
                <MenuItem value="CANCELLED">CANCELLED</MenuItem>
              </Select>
            </FormControl>

            <TextField
              size="small"
              label="Szukaj"
              value={search}
              onChange={(e) => {
                setPage(1);
                setSearch(e.target.value);
              }}
            />

            <Box sx={{ flex: 1 }} />

            <Button variant="outlined" onClick={load} disabled={loading || submitting}>
              Odśwież
            </Button>
          </Stack>

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

                    {x.can_cancel && (
                      <Box sx={{ mt: 1 }}>
                        <Button
                          size="small"
                          variant="outlined"
                          disabled={submitting}
                          onClick={async () => {
                            if (!confirm("Anulować ten wniosek?")) return;
                            setErr("");
                            setMsg("");
                            setSubmitting(true);
                            try {
                              await timeOffApi.cancel(x.id);
                              setMsg("Wniosek anulowany.");
                              await load();
                            } catch (e) {
                              setErr(getErrorMessage(e));
                            } finally {
                              setSubmitting(false);
                            }
                          }}
                        >
                          Anuluj
                        </Button>
                      </Box>
                    )}
                  </Paper>
                ))
              )}
            </Stack>
          </Paper>

          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="body2">Łącznie: {data?.count ?? 0}</Typography>
            <Pagination
              count={totalPages}
              page={page}
              onChange={(_, p) => setPage(p)}
              disabled={loading || submitting}
            />
          </Stack>
        </Stack>
      </Paper>
    </Stack>
  );
}
