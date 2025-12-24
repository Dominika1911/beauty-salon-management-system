import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  CircularProgress,
  Paper,
  Stack,
  Typography,
  Chip,
  Box,
  Divider,
  TextField,
  InputAdornment,
  FormControl,
  Select,
  MenuItem,
  Pagination,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import type { Appointment } from "../../types";
import { getAppointments, cancelAppointment } from "../../api/appointments";

type StatusColor = "warning" | "success" | "default" | "error" | "info";

function getErrorMessage(e: unknown, fallback = "Wystąpił błąd"): string {
  const anyErr = e as any;
  const d = anyErr?.response?.data;

  if (typeof d?.detail === "string") return d.detail;

  if (d && typeof d === "object") {
    const k = Object.keys(d)[0];
    const v = d[k];
    if (Array.isArray(v) && v.length) return String(v[0]);
    if (typeof v === "string") return v;
  }

  return anyErr?.message || fallback;
}

function statusMeta(status: string): { label: string; color: StatusColor } {
  const map: Record<string, { label: string; color: StatusColor }> = {
    PENDING: { label: "Oczekująca", color: "warning" },
    CONFIRMED: { label: "Potwierdzona", color: "success" },
    COMPLETED: { label: "Zakończona", color: "default" },
    CANCELLED: { label: "Anulowana", color: "error" },
  };
  return map[status] ?? { label: status, color: "default" };
}

function StatusChip({ status }: { status: string }) {
  const meta = statusMeta(status);
  return <Chip size="small" label={meta.label} color={meta.color as any} />;
}

function formatPL(dt: string) {
  return new Date(dt).toLocaleString("pl-PL", { dateStyle: "long", timeStyle: "short" });
}

function canCancel(a: Appointment) {
  // Bezpieczna logika: anulować można tylko PENDING/CONFIRMED.
  // (Jeśli backend ma inne zasady, to i tak UX będzie sensowny.)
  return a.status === "PENDING" || a.status === "CONFIRMED";
}

export default function ClientAppointmentsPage() {
  const [items, setItems] = useState<Appointment[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  // UX: wyszukiwanie + sort + paginacja (żeby nie scrollować w nieskończoność)
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"date_desc" | "date_asc">("date_desc");

  const [pageUpcoming, setPageUpcoming] = useState(1);
  const [pageHistory, setPageHistory] = useState(1);
  const pageSize = 6;

  const load = async () => {
    setErr("");
    setMsg("");
    setLoading(true);
    try {
      const res = await getAppointments();
      setItems(res);
    } catch (e) {
      setErr(getErrorMessage(e, "Błąd podczas ładowania wizyt."));
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const list = items ?? [];
    const q = query.trim().toLowerCase();

    let out = list;
    if (q) {
      out = out.filter((a) => {
        const service = (a.service_name ?? "").toLowerCase();
        const employee = (a.employee_name ?? "").toLowerCase();
        return service.includes(q) || employee.includes(q);
      });
    }

    out = [...out].sort((a, b) => {
      const da = new Date(a.start).getTime();
      const db = new Date(b.start).getTime();
      return sort === "date_asc" ? da - db : db - da;
    });

    return out;
  }, [items, query, sort]);

  const upcomingAll = useMemo(
    () => filtered.filter((a) => a.status === "PENDING" || a.status === "CONFIRMED"),
    [filtered]
  );
  const historyAll = useMemo(
    () => filtered.filter((a) => a.status === "COMPLETED" || a.status === "CANCELLED"),
    [filtered]
  );

  // paginacja
  const upcomingPageCount = Math.max(1, Math.ceil(upcomingAll.length / pageSize));
  const historyPageCount = Math.max(1, Math.ceil(historyAll.length / pageSize));

  const upcoming = useMemo(() => {
    const start = (pageUpcoming - 1) * pageSize;
    return upcomingAll.slice(start, start + pageSize);
  }, [upcomingAll, pageUpcoming]);

  const history = useMemo(() => {
    const start = (pageHistory - 1) * pageSize;
    return historyAll.slice(start, start + pageSize);
  }, [historyAll, pageHistory]);

  // reset stron przy zmianie wyszukiwania/sortu
  useEffect(() => {
    setPageUpcoming(1);
    setPageHistory(1);
  }, [query, sort]);

  const handleCancel = async (a: Appointment) => {
    if (!canCancel(a)) return;

    const ok = window.confirm("Czy na pewno chcesz anulować tę wizytę?");
    if (!ok) return;

    setErr("");
    setMsg("");

    try {
      await cancelAppointment(a.id);
      setMsg("Wizyta została pomyślnie anulowana.");
      await load();
    } catch (e) {
      setErr(getErrorMessage(e, "Nie udało się anulować wizyty."));
    }
  };

  if (loading && !items) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", p: 5 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Stack spacing={2.5} sx={{ p: { xs: 1, md: 3 }, maxWidth: 950, mx: "auto" }}>
      <Stack direction={{ xs: "column", md: "row" }} spacing={2} justifyContent="space-between">
        <Typography variant="h5" fontWeight={900}>
          Moje wizyty
        </Typography>

        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ width: { xs: "100%", md: "auto" } }}>
          <TextField
            label="Szukaj (usługa lub pracownik)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            sx={{ minWidth: { xs: "100%", sm: 340 } }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
          <FormControl sx={{ minWidth: { xs: "100%", sm: 220 } }}>
            <Select value={sort} onChange={(e) => setSort(e.target.value as any)}>
              <MenuItem value="date_desc">Sortuj: najnowsze</MenuItem>
              <MenuItem value="date_asc">Sortuj: najstarsze</MenuItem>
            </Select>
          </FormControl>
        </Stack>
      </Stack>

      {msg && <Alert severity="success">{msg}</Alert>}
      {err && (
        <Alert severity="error" action={<Button color="inherit" size="small" onClick={load}>Odśwież</Button>}>
          {err}
        </Alert>
      )}

      <Paper sx={{ p: 2, borderRadius: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h6" gutterBottom color="primary" fontWeight={800}>
            Nadchodzące
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {upcomingAll.length} wyników
          </Typography>
        </Stack>

        <Divider sx={{ mb: 2 }} />

        <Stack spacing={2}>
          {upcomingAll.length === 0 ? (
            <Alert severity="info">Brak nadchodzących wizyt.</Alert>
          ) : (
            upcoming.map((a) => (
              <Paper
                key={a.id}
                variant="outlined"
                sx={{ p: 2, transition: "0.2s", "&:hover": { boxShadow: 1 } }}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                  <Box>
                    <Typography variant="subtitle1" fontWeight={900}>
                      {a.service_name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Pracownik: {a.employee_name}
                    </Typography>
                  </Box>
                  <StatusChip status={a.status} />
                </Stack>

                <Typography variant="body2" sx={{ mt: 1, fontWeight: 600 }}>
                  {formatPL(a.start)}
                </Typography>

                <Button
                  size="small"
                  sx={{ mt: 2 }}
                  color="error"
                  variant="outlined"
                  disabled={!canCancel(a)}
                  onClick={() => handleCancel(a)}
                >
                  Anuluj wizytę
                </Button>
              </Paper>
            ))
          )}

          {upcomingPageCount > 1 && (
            <Box sx={{ display: "flex", justifyContent: "center", pt: 1 }}>
              <Pagination
                count={upcomingPageCount}
                page={pageUpcoming}
                onChange={(_, p) => setPageUpcoming(p)}
                color="primary"
              />
            </Box>
          )}
        </Stack>
      </Paper>

      <Paper sx={{ p: 2, borderRadius: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h6" gutterBottom color="text.secondary" fontWeight={800}>
            Historia wizyt
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {historyAll.length} wyników
          </Typography>
        </Stack>

        <Divider sx={{ mb: 2 }} />

        <Stack spacing={1.25}>
          {historyAll.length === 0 ? (
            <Alert severity="info">Brak historii wizyt.</Alert>
          ) : (
            history.map((a) => (
              <Paper
                key={a.id}
                variant="outlined"
                sx={{ p: 1.5, opacity: 0.9, backgroundColor: "#fcfcfc" }}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography variant="body1" fontWeight={700}>
                      {a.service_name} • {a.employee_name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {formatPL(a.start)}
                    </Typography>
                  </Box>
                  <StatusChip status={a.status} />
                </Stack>
              </Paper>
            ))
          )}

          {historyPageCount > 1 && (
            <Box sx={{ display: "flex", justifyContent: "center", pt: 1 }}>
              <Pagination
                count={historyPageCount}
                page={pageHistory}
                onChange={(_, p) => setPageHistory(p)}
                color="primary"
              />
            </Box>
          )}
        </Stack>
      </Paper>
    </Stack>
  );
}
