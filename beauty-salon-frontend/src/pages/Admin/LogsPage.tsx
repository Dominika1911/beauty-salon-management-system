// src/pages/Admin/LogsPage.tsx
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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";

import type { DRFPaginated, SystemLog } from "@/types";
import { auditLogsApi } from "@/api/auditLogs";

type ActionGroup =
  | "ALL"
  | "AUTH"
  | "APPOINTMENTS"
  | "TIMEOFF"
  | "SETTINGS"
  | "USERS"
  | "OTHER";

function groupFromAction(action: string): ActionGroup {
  const a = (action || "").toLowerCase();

  if (a.includes("login") || a.includes("logout")) return "AUTH";
  if (a.includes("appointment") || a.includes("booking") || a.includes("reservation"))
    return "APPOINTMENTS";
  if (a.includes("timeoff") || a.includes("time off") || a.includes("urlop")) return "TIMEOFF";
  if (a.includes("settings")) return "SETTINGS";
  if (a.includes("user") || a.includes("client") || a.includes("employee")) return "USERS";

  return "OTHER";
}

function chipPropsForGroup(g: ActionGroup) {
  switch (g) {
    case "AUTH":
      return { color: "primary" as const, label: "Logowanie" };
    case "APPOINTMENTS":
      return { color: "success" as const, label: "Wizyty" };
    case "TIMEOFF":
      return { color: "info" as const, label: "Urlopy" };
    case "SETTINGS":
      return { color: "warning" as const, label: "Ustawienia" };
    case "USERS":
      return { color: "secondary" as const, label: "Użytkownicy" };
    case "OTHER":
      return { color: "default" as const, label: "Inne" };
    default:
      return { color: "default" as const, label: "Wszystkie" };
  }
}

function niceActor(s: string | null) {
  if (!s) return "—";
  return s.replace(/^(.+?)-0+(\d+)$/, "$1-$2");
}

function getErrorMessage(err: unknown): string {
  const e = err as any;
  return e?.response?.data?.detail || e?.response?.data?.message || e?.message || "Wystąpił błąd.";
}

export default function LogsPage(): JSX.Element {
  const [data, setData] = useState<DRFPaginated<SystemLog> | null>(null);
  const [page, setPage] = useState(1);

  // backend filters (prawdziwe)
  const [actionFilter, setActionFilter] = useState<string>(""); // action code, np. AUTH_LOGIN
  const [performedBy, setPerformedBy] = useState<number | "">("");
  const [targetUser, setTargetUser] = useState<number | "">("");
  const [ordering, setOrdering] = useState<"timestamp" | "-timestamp">("-timestamp");

  // frontend filter (bo backend nie ma SearchFilter)
  const [group, setGroup] = useState<ActionGroup>("ALL");
  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // reset page when backend filters change
  useEffect(() => {
    setPage(1);
  }, [actionFilter, performedBy, targetUser, ordering]);

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");

    try {
      const res = await auditLogsApi.list({
        page,
        ordering,
        action: actionFilter || undefined,
        performed_by: performedBy === "" ? undefined : performedBy,
        target_user: targetUser === "" ? undefined : targetUser,
      });

      setData(res);
    } catch (e) {
      setErr(getErrorMessage(e));
      setData({ count: 0, next: null, previous: null, results: [] });
    } finally {
      setLoading(false);
    }
  }, [page, ordering, actionFilter, performedBy, targetUser]);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = useMemo(() => {
    const base = data?.results ?? [];

    // FRONTEND group + search (na aktualnej stronie paginacji)
    const s = search.trim().toLowerCase();

    return base.filter((l) => {
      const g = groupFromAction(l.action_display || l.action);
      if (group !== "ALL" && g !== group) return false;

      if (!s) return true;

      const hay = [
        l.action_display,
        l.action,
        l.performed_by_username,
        l.target_user_username,
        l.timestamp,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return hay.includes(s);
    });
  }, [data, group, search]);

  const canPrev = Boolean(data?.previous) && !loading;
  const canNext = Boolean(data?.next) && !loading;

  return (
    <Box sx={{ p: 3 }}>
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={2}
        alignItems={{ xs: "stretch", md: "center" }}
        sx={{ mb: 2 }}
      >
        <Box sx={{ flex: 1 }}>
          <Typography variant="h4" fontWeight={700}>
            Logi operacji
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            DRF: paginacja + filtry backendowe (action / performed_by / target_user) + ordering po timestamp
          </Typography>
          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            Łącznie (backend): {data?.count ?? "—"} • Strona: {page}
          </Typography>
        </Box>

        <Button variant="outlined" onClick={() => void load()} disabled={loading}>
          Odśwież
        </Button>
      </Stack>

      {err && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr("")}>
          {err}
        </Alert>
      )}

      {/* FILTERS */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack spacing={2} direction={{ xs: "column", md: "row" }} alignItems={{ md: "center" }}>
          {/* Frontend group (UX) */}
          <FormControl size="small" sx={{ minWidth: 190 }}>
            <InputLabel>Kategoria (UI)</InputLabel>
            <Select
              label="Kategoria (UI)"
              value={group}
              onChange={(e) => setGroup(e.target.value as ActionGroup)}
            >
              <MenuItem value="ALL">Wszystkie</MenuItem>
              <MenuItem value="AUTH">Logowanie</MenuItem>
              <MenuItem value="APPOINTMENTS">Wizyty</MenuItem>
              <MenuItem value="TIMEOFF">Urlopy</MenuItem>
              <MenuItem value="SETTINGS">Ustawienia</MenuItem>
              <MenuItem value="USERS">Użytkownicy</MenuItem>
              <MenuItem value="OTHER">Inne</MenuItem>
            </Select>
          </FormControl>

          {/* Backend filters */}
          <TextField
            size="small"
            label="action (backend)"
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            placeholder="np. AUTH_LOGIN"
            sx={{ minWidth: 220 }}
          />

          <TextField
            size="small"
            label="performed_by (id)"
            type="number"
            value={performedBy}
            onChange={(e) => setPerformedBy(e.target.value ? Number(e.target.value) : "")}
            sx={{ width: 170 }}
          />

          <TextField
            size="small"
            label="target_user (id)"
            type="number"
            value={targetUser}
            onChange={(e) => setTargetUser(e.target.value ? Number(e.target.value) : "")}
            sx={{ width: 170 }}
          />

          <FormControl size="small" sx={{ minWidth: 190 }}>
            <InputLabel>ordering (backend)</InputLabel>
            <Select
              label="ordering (backend)"
              value={ordering}
              onChange={(e) => setOrdering(e.target.value as any)}
            >
              <MenuItem value="-timestamp">-timestamp (najnowsze)</MenuItem>
              <MenuItem value="timestamp">timestamp (najstarsze)</MenuItem>
            </Select>
          </FormControl>

          {/* Frontend search */}
          <TextField
            size="small"
            label="Szukaj (UI)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="np. admin, urlop, maria…"
            sx={{ minWidth: 240 }}
          />
        </Stack>
      </Paper>

      {/* PAGINATION */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
          <Typography variant="body2" color="text.secondary">
            Wyniki na stronie: {data?.results?.length ?? 0} • Po filtrze UI: {rows.length}
          </Typography>

          <Stack direction="row" spacing={1}>
            <Button disabled={!canPrev} variant="outlined" onClick={() => setPage((p) => Math.max(1, p - 1))}>
              Poprzednia
            </Button>
            <Button disabled={!canNext} variant="contained" onClick={() => setPage((p) => p + 1)}>
              Następna
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {/* TABLE */}
      {loading && !data ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer component={Paper} sx={{ borderRadius: 2, boxShadow: 3 }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ backgroundColor: "rgba(0,0,0,0.02)" }}>
                <TableCell sx={{ width: 190, fontWeight: "bold" }}>Data i czas</TableCell>
                <TableCell sx={{ width: 140, fontWeight: "bold" }}>Kategoria</TableCell>
                <TableCell sx={{ fontWeight: "bold" }}>Opis zdarzenia</TableCell>
                <TableCell sx={{ width: 220, fontWeight: "bold" }}>Wykonał</TableCell>
                <TableCell sx={{ width: 220, fontWeight: "bold" }}>Dotyczy</TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5}>
                    <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                      <CircularProgress size={22} />
                    </Box>
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 3 }}>
                    Brak logów spełniających kryteria.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((l) => {
                  const g = groupFromAction(l.action_display || l.action);
                  const badge = chipPropsForGroup(g);

                  return (
                    <TableRow key={l.id} hover>
                      <TableCell sx={{ color: "text.secondary" }}>
                        {new Date(l.timestamp).toLocaleString("pl-PL")}
                      </TableCell>

                      <TableCell>
                        <Chip size="small" color={badge.color} label={badge.label} sx={{ fontWeight: 500 }} />
                      </TableCell>

                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {l.action_display || l.action}
                        </Typography>
                        <Typography variant="caption" sx={{ color: "text.disabled", display: "block" }}>
                          Kod: {l.action}
                        </Typography>
                      </TableCell>

                      <TableCell sx={{ fontWeight: 500 }}>
                        {l.performed_by_username ? niceActor(l.performed_by_username) : "System"}
                      </TableCell>

                      <TableCell>
                        {l.target_user_username ? (
                          <Typography variant="body2" color="primary.main" sx={{ fontWeight: 600 }}>
                            {niceActor(l.target_user_username)}
                          </Typography>
                        ) : (
                          <Typography variant="body2" color="text.disabled">
                            —
                          </Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
