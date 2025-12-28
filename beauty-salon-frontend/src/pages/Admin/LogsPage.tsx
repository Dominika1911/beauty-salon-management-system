// src/pages/Admin/LogsPage.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  Grid,
  InputLabel,
  LinearProgress,
  MenuItem,
  Pagination,
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
import { parseDrfError } from "@/utils/drfErrors";

type ActionGroup =
  | "ALL"
  | "AUTH"
  | "APPOINTMENTS"
  | "TIMEOFF"
  | "SETTINGS"
  | "USERS"
  | "OTHER";

type Ordering = "timestamp" | "-timestamp";

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

const GROUP_LABEL: Record<ActionGroup, string> = {
  ALL: "Wszystkie",
  AUTH: "Logowanie",
  APPOINTMENTS: "Wizyty",
  TIMEOFF: "Urlopy",
  SETTINGS: "Ustawienia",
  USERS: "Użytkownicy",
  OTHER: "Inne",
};

export default function LogsPage(): JSX.Element {
  const [data, setData] = useState<DRFPaginated<SystemLog> | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | null>(null);

  // applied filters (backend + UI)
  const [actionFilter, setActionFilter] = useState<string>("");
  const [performedBy, setPerformedBy] = useState<number | "">("");
  const [targetUser, setTargetUser] = useState<number | "">("");
  const [ordering, setOrdering] = useState<Ordering>("-timestamp");

  const [group, setGroup] = useState<ActionGroup>("ALL"); // UI only
  const [search, setSearch] = useState(""); // UI only (filters current page)

  // draft filters (UX: no auto-request while typing)
  const [draftActionFilter, setDraftActionFilter] = useState<string>("");
  const [draftPerformedBy, setDraftPerformedBy] = useState<number | "">("");
  const [draftTargetUser, setDraftTargetUser] = useState<number | "">("");
  const [draftOrdering, setDraftOrdering] = useState<Ordering>("-timestamp");
  const [draftGroup, setDraftGroup] = useState<ActionGroup>("ALL");
  const [draftSearch, setDraftSearch] = useState("");

  const busy = loading;

  const load = useCallback(async () => {
    setLoading(true);
    setPageError(null);

    try {
      const res = await auditLogsApi.list({
        page,
        ordering,
        action: actionFilter || undefined,
        performed_by: performedBy === "" ? undefined : performedBy,
        target_user: targetUser === "" ? undefined : targetUser,
      });

      setData(res);

      const len = res.results?.length ?? 0;
      if (len > 0) setPageSize((p) => p ?? len);
    } catch (e: unknown) {
      const parsed = parseDrfError(e);
      setPageError(parsed.message || "Nie udało się pobrać logów. Spróbuj ponownie.");
      setData({ count: 0, next: null, previous: null, results: [] });
    } finally {
      setLoading(false);
    }
  }, [page, ordering, actionFilter, performedBy, targetUser]);

  useEffect(() => {
    void load();
  }, [load]);

  // keep draft synced
  useEffect(() => {
    setDraftActionFilter(actionFilter);
    setDraftPerformedBy(performedBy);
    setDraftTargetUser(targetUser);
    setDraftOrdering(ordering);
    setDraftGroup(group);
    setDraftSearch(search);
  }, [actionFilter, performedBy, targetUser, ordering, group, search]);

  const hasUnappliedChanges = useMemo(() => {
    return (
      draftActionFilter !== actionFilter ||
      draftPerformedBy !== performedBy ||
      draftTargetUser !== targetUser ||
      draftOrdering !== ordering ||
      draftGroup !== group ||
      draftSearch !== search
    );
  }, [
    draftActionFilter,
    actionFilter,
    draftPerformedBy,
    performedBy,
    draftTargetUser,
    targetUser,
    draftOrdering,
    ordering,
    draftGroup,
    group,
    draftSearch,
    search,
  ]);

  const hasActiveFiltersDraft = useMemo(() => {
    return (
      Boolean(draftActionFilter.trim()) ||
      draftPerformedBy !== "" ||
      draftTargetUser !== "" ||
      draftOrdering !== "-timestamp" ||
      draftGroup !== "ALL" ||
      Boolean(draftSearch.trim())
    );
  }, [
    draftActionFilter,
    draftPerformedBy,
    draftTargetUser,
    draftOrdering,
    draftGroup,
    draftSearch,
  ]);

  const hasActiveFiltersApplied = useMemo(() => {
    return (
      Boolean(actionFilter.trim()) ||
      performedBy !== "" ||
      targetUser !== "" ||
      ordering !== "-timestamp" ||
      group !== "ALL" ||
      Boolean(search.trim())
    );
  }, [actionFilter, performedBy, targetUser, ordering, group, search]);

  const applyFilters = () => {
    setPage(1);
    setActionFilter(draftActionFilter);
    setPerformedBy(draftPerformedBy);
    setTargetUser(draftTargetUser);
    setOrdering(draftOrdering);
    setGroup(draftGroup);
    setSearch(draftSearch);
  };

  const resetFilters = () => {
    setDraftActionFilter("");
    setDraftPerformedBy("");
    setDraftTargetUser("");
    setDraftOrdering("-timestamp");
    setDraftGroup("ALL");
    setDraftSearch("");

    setPage(1);
    setActionFilter("");
    setPerformedBy("");
    setTargetUser("");
    setOrdering("-timestamp");
    setGroup("ALL");
    setSearch("");
  };

  const rows = useMemo(() => {
    const base = data?.results ?? [];
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

  const totalPages = useMemo(() => {
    const count = data?.count ?? 0;
    const size = pageSize ?? (data?.results?.length ? data.results.length : 10);
    if (size <= 0) return 1;
    return Math.max(1, Math.ceil(count / size));
  }, [data, pageSize]);

  const emptyInfo = useMemo(() => {
    if (loading) return null;

    const baseLen = data?.results?.length ?? 0;
    if (baseLen === 0) {
      if (hasActiveFiltersApplied) return "Brak logów dla wybranych filtrów.";
      return "Brak logów.";
    }

    if (rows.length === 0) {
      // backend dał wyniki, ale UI filtr (kategoria/szukaj) odciął wszystko na tej stronie
      const hasUi = group !== "ALL" || Boolean(search.trim());
      if (hasUi) {
        const parts: string[] = [];
        if (group !== "ALL") parts.push(`kategoria: ${GROUP_LABEL[group]}`);
        if (search.trim()) parts.push(`szukaj: „${search.trim()}”`);
        return `Brak wyników dla ${parts.join(", ")}.`;
      }
      return "Brak wyników.";
    }

    return null;
  }, [loading, data, rows.length, hasActiveFiltersApplied, group, search]);

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
            Logi operacji
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Historia działań w systemie — filtruj i przeglądaj zdarzenia.
          </Typography>
        </Box>

        <Typography variant="body2" color="text.secondary">
          Łącznie: {data?.count ?? "—"} • Strona: {page}
        </Typography>
      </Box>

      {pageError && (
        <Alert severity="error" onClose={() => setPageError(null)}>
          {pageError}
        </Alert>
      )}

      {/* FILTERS */}
      <Paper variant="outlined" sx={{ p: 2, position: "relative" }}>
        {loading && <LinearProgress sx={{ position: "absolute", left: 0, right: 0, top: 0 }} />}

        <Stack spacing={2} sx={{ pt: loading ? 1 : 0 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={6} md={3}>
              <FormControl size="small" fullWidth disabled={busy}>
                <InputLabel>Kategoria</InputLabel>
                <Select
                  label="Kategoria"
                  value={draftGroup}
                  onChange={(e) => setDraftGroup(e.target.value as ActionGroup)}
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
            </Grid>

            <Grid item xs={12} sm={6} md={5}>
              <TextField
                size="small"
                fullWidth
                label="Akcja"
                value={draftActionFilter}
                onChange={(e) => setDraftActionFilter(e.target.value)}
                placeholder="np. logowanie, appointment…"
                disabled={busy}
              />
            </Grid>

            <Grid item xs={12} sm={6} md={2}>
              <TextField
                size="small"
                fullWidth
                label="Wykonał (ID)"
                type="number"
                value={draftPerformedBy}
                onChange={(e) => setDraftPerformedBy(e.target.value ? Number(e.target.value) : "")}
                disabled={busy}
              />
            </Grid>

            <Grid item xs={12} sm={6} md={2}>
              <TextField
                size="small"
                fullWidth
                label="Dotyczy (ID)"
                type="number"
                value={draftTargetUser}
                onChange={(e) => setDraftTargetUser(e.target.value ? Number(e.target.value) : "")}
                disabled={busy}
              />
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <FormControl size="small" fullWidth disabled={busy}>
                <InputLabel>Sortowanie</InputLabel>
                <Select
                  label="Sortowanie"
                  value={draftOrdering}
                  onChange={(e) => setDraftOrdering(e.target.value as Ordering)}
                >
                  <MenuItem value="-timestamp">Najnowsze</MenuItem>
                  <MenuItem value="timestamp">Najstarsze</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6} md={6}>
              <TextField
                size="small"
                fullWidth
                label="Szukaj"
                value={draftSearch}
                onChange={(e) => setDraftSearch(e.target.value)}
                placeholder="np. admin, maria, urlop…"
                disabled={busy}
              />
            </Grid>

            <Grid item xs={12} md={3}>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1}
                alignItems="stretch"
                justifyContent={{ xs: "flex-start", md: "flex-end" }}
                sx={{ height: "100%" }}
              >
                <Button
                  variant="outlined"
                  onClick={resetFilters}
                  disabled={busy || (!hasActiveFiltersDraft && !hasActiveFiltersApplied)}
                  fullWidth
                >
                  Wyczyść
                </Button>
                <Button
                  variant="contained"
                  onClick={applyFilters}
                  disabled={busy || !hasUnappliedChanges}
                  fullWidth
                >
                  Zastosuj
                </Button>
                <Button variant="outlined" onClick={() => void load()} disabled={busy} fullWidth>
                  Odśwież
                </Button>
              </Stack>
            </Grid>
          </Grid>

          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            {hasActiveFiltersDraft && <Chip size="small" label="Ustawione filtry" />}
            {hasUnappliedChanges && (
              <Chip size="small" color="warning" label="Niezastosowane zmiany" variant="outlined" />
            )}
          </Stack>

          <Divider />

          {/* TABLE */}
          {loading && !data ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 5 }}>
              <CircularProgress />
            </Box>
          ) : emptyInfo ? (
            <Alert severity="info">{emptyInfo}</Alert>
          ) : (
            <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ backgroundColor: "rgba(0,0,0,0.02)" }}>
                    <TableCell sx={{ width: 190, fontWeight: "bold" }}>Data i czas</TableCell>
                    <TableCell sx={{ width: 140, fontWeight: "bold" }}>Kategoria</TableCell>
                    <TableCell sx={{ fontWeight: "bold" }}>Zdarzenie</TableCell>
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
                            <Chip
                              size="small"
                              color={badge.color}
                              label={badge.label}
                              sx={{ fontWeight: 500 }}
                            />
                          </TableCell>

                          <TableCell>
                            <Typography variant="body2" sx={{ fontWeight: 700 }}>
                              {l.action_display || l.action}
                            </Typography>
                            <Typography
                              variant="caption"
                              sx={{ color: "text.disabled", display: "block" }}
                            >
                              Szczegóły: {l.action}
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

          <Divider />

          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={2}
            alignItems={{ sm: "center" }}
            justifyContent="space-between"
          >
            <Typography variant="body2" color="text.secondary">
              Na stronie: {data?.results?.length ?? 0} • Po filtrach: {rows.length}
            </Typography>

            <Pagination count={totalPages} page={page} onChange={(_, p) => setPage(p)} disabled={busy} />
          </Stack>
        </Stack>
      </Paper>
    </Stack>
  );
}
