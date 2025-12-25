import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import type { TimeOff, TimeOffStatus } from "../../types";
import { approveTimeOff, getTimeOffs, rejectTimeOff } from "../../api/timeOff";


function statusChip(status: TimeOffStatus) {
  switch (status) {
    case "PENDING":
      return <Chip label="Oczekuje" color="warning" size="small" />;
    case "APPROVED":
      return <Chip label="Zaakceptowany" color="success" size="small" />;
    case "REJECTED":
      return <Chip label="Odrzucony" color="error" size="small" />;
    default:
      return <Chip label={status} size="small" />;
  }
}

export default function AdminTimeOffsPage() {
  const [items, setItems] = useState<TimeOff[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  // filtry
  const [statusFilter, setStatusFilter] = useState<TimeOffStatus | "ALL">("PENDING");
  const [employeeFilter, setEmployeeFilter] = useState<string>(""); // id jako string
  const [dateFrom, setDateFrom] = useState<string>(""); // YYYY-MM-DD
  const [dateTo, setDateTo] = useState<string>("");     // YYYY-MM-DD
  const [search, setSearch] = useState<string>("");

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const data = await getTimeOffs({
        status: statusFilter === "ALL" ? undefined : statusFilter,
        employee: employeeFilter || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        search: search || undefined,
        ordering: "-created_at",
      });
      setItems(data);
    } catch (e: any) {
      setErr(e?.response?.data?.detail || e?.message || "Błąd pobierania urlopów.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // odświeżaj po zmianie filtrów (opcjonalnie)
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, employeeFilter, dateFrom, dateTo, search]);

  async function runAction(fn: (id: number) => Promise<any>, id: number, successMsg: string) {
    setMsg("");
    setErr("");
    try {
      await fn(id);
      setMsg(successMsg);
      await load();
    } catch (e: any) {
      setErr(e?.response?.data?.detail || e?.message || "Błąd akcji.");
    }
  }

  // lista unikalnych pracowników do filtra (z obecnych danych)
  const employeeOptions = useMemo(() => {
    const map = new Map<number, string>();
    (items || []).forEach((x) => {
      if (x.employee != null) {
        map.set(x.employee, x.employee_name || `ID: ${x.employee}`);
      }
    });
    return Array.from(map.entries())
      .sort((a, b) => a[1].localeCompare(b[1], "pl"))
      .map(([id, name]) => ({ id, name }));
  }, [items]);

  if (loading && !items) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", p: 5 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Stack spacing={3}>
      <Typography variant="h5" fontWeight={600}>
        Urlopy (ADMIN)
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

      {/* FILTRY */}
      <Paper sx={{ p: 2 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={statusFilter}
              label="Status"
              onChange={(e) => setStatusFilter(e.target.value as any)}
            >
              <MenuItem value="ALL">Wszystkie</MenuItem>
              <MenuItem value="PENDING">Oczekujące</MenuItem>
              <MenuItem value="APPROVED">Zaakceptowane</MenuItem>
              <MenuItem value="REJECTED">Odrzucone</MenuItem>
            </Select>
          </FormControl>

          <TextField
            size="small"
            label="Pracownik (ID)"
            value={employeeFilter}
            onChange={(e) => setEmployeeFilter(e.target.value)}
            placeholder="np. 3"
          />

          <TextField
            size="small"
            label="Data od (YYYY-MM-DD)"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            placeholder="2025-01-01"
          />
          <TextField
            size="small"
            label="Data do (YYYY-MM-DD)"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            placeholder="2025-01-31"
          />

          <TextField
            size="small"
            label="Szukaj (powód / nazwisko)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </Stack>

        {employeeOptions.length > 0 && (
          <Box sx={{ mt: 2, opacity: 0.9 }}>
            <Typography variant="caption">
              Szybki wybór pracownika z listy:
            </Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: "wrap" }}>
              {employeeOptions.slice(0, 10).map((opt) => (
                <Chip
                  key={opt.id}
                  label={opt.name}
                  size="small"
                  variant={String(opt.id) === employeeFilter ? "filled" : "outlined"}
                  onClick={() => setEmployeeFilter(String(opt.id))}
                />
              ))}
              {employeeFilter && (
                <Chip
                  label="Wyczyść pracownika"
                  size="small"
                  color="default"
                  onClick={() => setEmployeeFilter("")}
                />
              )}
            </Stack>
          </Box>
        )}
      </Paper>

      {/* LISTA */}
      <Typography variant="h6" color="primary">
        Wnioski
      </Typography>

      <Stack spacing={1}>
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", p: 3 }}>
            <CircularProgress size={24} />
          </Box>
        ) : !items || items.length === 0 ? (
          <Alert severity="info">Brak wniosków dla wybranych filtrów.</Alert>
        ) : (
          items.map((x) => (
            <Paper key={x.id} variant="outlined" sx={{ p: 2 }}>
              <Stack spacing={1.5}>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                  <Box>
                    <Typography fontWeight={700}>
                      {x.employee_name || `Pracownik ID: ${x.employee}`}
                    </Typography>
                    <Typography variant="body2" sx={{ opacity: 0.8 }}>
                      {x.date_from} → {x.date_to}
                    </Typography>
                    {x.reason ? (
                      <Typography variant="body2" sx={{ opacity: 0.85, mt: 0.5 }}>
                        Powód: {x.reason}
                      </Typography>
                    ) : null}
                  </Box>
                  <Stack alignItems="flex-end" spacing={0.5}>
                    {statusChip(x.status)}
                    {x.created_at ? (
                      <Typography variant="caption" sx={{ opacity: 0.7 }}>
                        Utworzono: {new Date(x.created_at).toLocaleString("pl-PL")}
                      </Typography>
                    ) : null}
                  </Stack>
                </Stack>

                {x.status === "PENDING" ? (
                  <Stack direction="row" spacing={1}>
                    <Button
                      size="small"
                      variant="contained"
                      color="success"
                      onClick={() => runAction(approveTimeOff, x.id, "Wniosek zaakceptowany.")}
                    >
                      Akceptuj
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      color="error"
                      onClick={() => runAction(rejectTimeOff, x.id, "Wniosek odrzucony.")}
                    >
                      Odrzuć
                    </Button>
                  </Stack>
                ) : (
                  <Box sx={{ opacity: 0.85 }}>
                    <Divider sx={{ my: 1 }} />
                    <Typography variant="caption">
                      Decyzja: {x.decided_at ? new Date(x.decided_at).toLocaleString("pl-PL") : "—"}
                    </Typography>
                  </Box>
                )}
              </Stack>
            </Paper>
          ))
        )}
      </Stack>
    </Stack>
  );
}
