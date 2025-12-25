import React, { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  TextField,
  Typography,
  Chip,
} from "@mui/material";
import { DatePicker, LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { pl } from "date-fns/locale";

import type { TimeOff, TimeOffStatus } from "../../types";
import { getTimeOffs, createTimeOff } from "../../api/timeOff";

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

function toYmd(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function EmployeeTimeOffPage() {
  const [items, setItems] = useState<TimeOff[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  const [from, setFrom] = useState<Date | null>(new Date());
  const [to, setTo] = useState<Date | null>(new Date());
  const [reason, setReason] = useState("");

  async function load() {
    setLoading(true);
    setErr("");
    try {
      // EMPLOYEE dostanie tylko swoje (backend filtruje)
      const data = await getTimeOffs({ ordering: "-created_at" });
      setItems(data);
    } catch (e: any) {
      setErr(e?.response?.data?.detail || "Nie udało się pobrać urlopów.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function submit() {
    setErr("");
    setMsg("");

    if (!from || !to) {
      setErr("Ustaw daty.");
      return;
    }
    if (from.getTime() > to.getTime()) {
      setErr("Data od nie może być później niż data do.");
      return;
    }

    try {
      // EMPLOYEE NIE wysyła employee — backend sam przypisze
      await createTimeOff({
        date_from: toYmd(from),
        date_to: toYmd(to),
        reason: reason || "",
      });

      setMsg("Wniosek urlopowy wysłany (PENDING).");
      setReason("");
      await load();
    } catch (e: any) {
      const data = e?.response?.data;
      setErr(
        data?.detail ||
          (typeof data === "string" ? data : "Nie udało się wysłać wniosku.")
      );
    }
  }

  if (loading && !items) return <CircularProgress />;

  return (
    <Stack spacing={2} sx={{ maxWidth: 700 }}>
      <Typography variant="h5" fontWeight={700}>
        Urlopy
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

      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>
          Zgłoś urlop
        </Typography>

        <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={pl}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <DatePicker
              label="Od"
              value={from}
              onChange={setFrom}
              slotProps={{ textField: { fullWidth: true } }}
            />
            <DatePicker
              label="Do"
              value={to}
              onChange={setTo}
              slotProps={{ textField: { fullWidth: true } }}
            />
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
          <Button variant="contained" onClick={submit}>
            Wyślij wniosek
          </Button>
        </Box>
      </Paper>

      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>
          Moje wnioski
        </Typography>

        <Stack spacing={1}>
          {(items || []).length === 0 ? (
            <Alert severity="info">Brak wniosków.</Alert>
          ) : (
            (items || []).map((x) => (
              <Paper key={x.id} variant="outlined" sx={{ p: 1.5 }}>
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                >
                  <Box>
                    <Typography fontWeight={600}>
                      {x.date_from} → {x.date_to}
                    </Typography>
                    {x.reason ? (
                      <Typography variant="body2" sx={{ opacity: 0.8 }}>
                        {x.reason}
                      </Typography>
                    ) : null}
                  </Box>
                  {statusChip(x.status)}
                </Stack>
              </Paper>
            ))
          )}
        </Stack>
      </Paper>
    </Stack>
  );
}
