import React, { useCallback, useEffect, useMemo, useState } from "react";
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";

import type { DRFPaginated, TimeOff, TimeOffStatus, Employee } from "@/types";
import { timeOffApi } from "@/api/timeOff";
import { employeesApi, type EmployeeListItem } from "@/api/employees";

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

function getErrorMessage(err: unknown): string {
  const e = err as any;
  return e?.response?.data?.detail || e?.response?.data?.message || e?.message || "Wystąpił błąd.";
}

/** ADMIN powinien widzieć pełny EmployeeSerializer, ale API type to union */
function isEmployee(x: EmployeeListItem): x is Employee {
  return (x as Employee).employee_number !== undefined;
}

function isValidYmd(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export default function AdminTimeOffsPage(): JSX.Element {
  const [data, setData] = useState<DRFPaginated<TimeOff> | null>(null);
  const [page, setPage] = useState(1);

  // employees for filter select
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(true);

  // backend filters
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("PENDING");
  const [employeeId, setEmployeeId] = useState<number | "">("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  // edit dialog (ADMIN PATCH)
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<TimeOff | null>(null);
  const [editDateFrom, setEditDateFrom] = useState("");
  const [editDateTo, setEditDateTo] = useState("");
  const [editReason, setEditReason] = useState("");
  const [editStatus, setEditStatus] = useState<TimeOffStatus>("PENDING");

  // delete confirm
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState<TimeOff | null>(null);

  const employeeMap = useMemo(() => {
    const m = new Map<number, Employee>();
    employees.forEach((e) => m.set(e.id, e));
    return m;
  }, [employees]);

  // reset page on backend params change
  useEffect(() => {
    setPage(1);
  }, [statusFilter, employeeId, dateFrom, dateTo, search]);

  // =========================
  // LOAD EMPLOYEES (for filter)
  // =========================
  const loadAllEmployees = useCallback(async () => {
    setLoadingEmployees(true);
    try {
      const all: Employee[] = [];
      let p = 1;

      while (true) {
        const res = await employeesApi.list({ page: p, ordering: "last_name", is_active: undefined });
        const onlyFull = (res.results ?? []).filter(isEmployee) as Employee[];
        all.push(...onlyFull);

        if (!res.next) break;
        p += 1;

        // bezpieczny limit na wypadek dziwnego next (nie refaktorujemy, tylko guard)
        if (p > 50) break;
      }

      setEmployees(all);
    } catch (e) {
      // nie blokuj strony timeoff jeśli employees się nie wczytają
      setEmployees([]);
    } finally {
      setLoadingEmployees(false);
    }
  }, []);

  // =========================
  // LOAD TIMEOFFS
  // =========================
  const load = useCallback(async () => {
    setLoading(true);
    setErr("");

    // prosta walidacja zakresu dat (żeby nie walić 400)
    if (dateFrom && (!isValidYmd(dateFrom) || (dateTo && !isValidYmd(dateTo)))) {
      setErr("Błędny format daty. Użyj YYYY-MM-DD.");
      setData({
        count: 0,
        next: null,
        previous: null,
        results: [],
      });
      setLoading(false);
      return;
    }
    if (dateFrom && dateTo && dateFrom > dateTo) {
      setErr("Błędny zakres: date_from nie może być późniejsze niż date_to.");
      setData({
        count: 0,
        next: null,
        previous: null,
        results: [],
      });
      setLoading(false);
      return;
    }

    try {
      const res = await timeOffApi.list({
        page,
        ordering: "-created_at",
        status: statusFilter === "ALL" ? undefined : statusFilter,
        employee: employeeId === "" ? undefined : employeeId,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        search: search.trim() || undefined,
      });

      setData(res);
    } catch (e) {
      setErr(getErrorMessage(e));
      setData({
        count: 0,
        next: null,
        previous: null,
        results: [],
      });
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, employeeId, dateFrom, dateTo, search]);

  useEffect(() => {
    void loadAllEmployees();
  }, [loadAllEmployees]);

  useEffect(() => {
    void load();
  }, [load]);

  const runAction = async (fn: (id: number) => Promise<TimeOff>, id: number, successMsg: string) => {
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

  const openEdit = (x: TimeOff) => {
    setEditing(x);
    setEditDateFrom(x.date_from || "");
    setEditDateTo(x.date_to || "");
    setEditReason(x.reason || "");
    setEditStatus(x.status);
    setEditOpen(true);
  };

  const closeEdit = () => {
    setEditOpen(false);
    setEditing(null);
    setEditDateFrom("");
    setEditDateTo("");
    setEditReason("");
    setEditStatus("PENDING");
  };

  const saveEdit = async () => {
    if (!editing) return;

    setErr("");
    setMsg("");

    if (!editDateFrom || !editDateTo || !isValidYmd(editDateFrom) || !isValidYmd(editDateTo)) {
      setErr("Uzupełnij date_from/date_to w formacie YYYY-MM-DD.");
      return;
    }
    if (editDateFrom > editDateTo) {
      setErr("Błędny zakres: date_from nie może być późniejsze niż date_to.");
      return;
    }

    setBusyId(editing.id);
    try {
      await timeOffApi.update(editing.id, {
        date_from: editDateFrom,
        date_to: editDateTo,
        reason: editReason,
        status: editStatus,
      });
      setMsg("Zapisano zmiany.");
      closeEdit();
      await load();
    } catch (e) {
      setErr(getErrorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  const openDelete = (x: TimeOff) => {
    setDeleting(x);
    setDeleteOpen(true);
  };

  const closeDelete = () => {
    setDeleteOpen(false);
    setDeleting(null);
  };

  const confirmDelete = async () => {
    if (!deleting) return;

    setErr("");
    setMsg("");
    setBusyId(deleting.id);

    try {
      await timeOffApi.remove(deleting.id);
      setMsg("Usunięto wniosek.");
      closeDelete();
      await load();
    } catch (e) {
      setErr(getErrorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  if (loading && !data) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", p: 5 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} spacing={1}>
        <Box>
          <Typography variant="h5" fontWeight={700}>
            Urlopy (ADMIN)
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Łącznie (backend): {data?.count ?? "—"} • Strona: {page}
          </Typography>
        </Box>

        <Button variant="outlined" onClick={() => void load()}>
          Odśwież
        </Button>
      </Stack>

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

      {/* FILTERS */}
      <Paper sx={{ p: 2 }}>
        <Stack spacing={2} direction={{ xs: "column", md: "row" }} alignItems={{ md: "center" }}>
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>Status</InputLabel>
            <Select value={statusFilter} label="Status" onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}>
              <MenuItem value="ALL">Wszystkie</MenuItem>
              <MenuItem value="PENDING">PENDING</MenuItem>
              <MenuItem value="APPROVED">APPROVED</MenuItem>
              <MenuItem value="REJECTED">REJECTED</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 260 }}>
            <InputLabel>Pracownik (employee)</InputLabel>
            <Select
              value={employeeId === "" ? "" : String(employeeId)}
              label="Pracownik (employee)"
              onChange={(e) => setEmployeeId(e.target.value ? Number(e.target.value) : "")}
              disabled={loadingEmployees}
            >
              <MenuItem value="">Wszyscy</MenuItem>
              {employees.map((e) => (
                <MenuItem key={e.id} value={String(e.id)}>
                  {e.first_name} {e.last_name} ({e.employee_number})
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            size="small"
            label="date_from"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            InputLabelProps={{ shrink: true }}
            helperText="YYYY-MM-DD"
          />

          <TextField
            size="small"
            label="date_to"
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            InputLabelProps={{ shrink: true }}
            helperText="YYYY-MM-DD"
          />

          <TextField
            size="small"
            label="search (backend)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="reason, imię, nazwisko…"
            sx={{ minWidth: 220 }}
          />
        </Stack>
      </Paper>

      {/* LIST */}
      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
          <CircularProgress />
        </Box>
      ) : data?.results.length === 0 ? (
        <Alert severity="info">Brak wyników.</Alert>
      ) : (
        <Stack spacing={1}>
          {data!.results.map((x) => {
            const isBusy = busyId === x.id;

            // Backend jest jedynym źródłem prawdy dla uprawnień UI
            const canApprove = x.can_approve;
            const canReject = x.can_reject;

            const emp = employeeMap.get(x.employee);
            const employeeHint = emp ? ` (${emp.employee_number})` : "";

            return (
              <Paper key={x.id} variant="outlined" sx={{ p: 2 }}>
                <Stack spacing={1.5}>
                  <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={1}>
                    <Box>
                      <Typography fontWeight={700}>
                        {x.employee_name}
                        {employeeHint}
                      </Typography>

                      <Typography variant="body2">
                        {x.date_from} → {x.date_to}
                      </Typography>

                      {x.reason && (
                        <Typography variant="body2" sx={{ opacity: 0.85 }}>
                          Powód: {x.reason}
                        </Typography>
                      )}

                      <Typography variant="caption" color="text.secondary">
                        Utworzono: {x.created_at ? new Date(x.created_at).toLocaleString("pl-PL") : "—"}
                        {" • "}
                        Requested by: {x.requested_by ?? "—"}
                        {" • "}
                        Decided by: {x.decided_by ?? "—"}
                        {" • "}
                        Decided at: {x.decided_at ? new Date(x.decided_at).toLocaleString("pl-PL") : "—"}
                      </Typography>
                    </Box>

                    <StatusChip status={x.status} label={x.status_display} />
                  </Stack>

                  <Divider />

                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                      <Button
                        size="small"
                        variant="contained"
                        color="success"
                        disabled={isBusy || !canApprove}
                        onClick={() => runAction(timeOffApi.approve, x.id, "Wniosek zaakceptowany.")}
                      >
                        Akceptuj
                      </Button>

                      <Button
                        size="small"
                        variant="outlined"
                        color="error"
                        disabled={isBusy || !canReject}
                        onClick={() => runAction(timeOffApi.reject, x.id, "Wniosek odrzucony.")}
                      >
                        Odrzuć
                      </Button>
                    </Stack>

                    <Box sx={{ flex: 1 }} />

                    <Stack direction="row" spacing={1}>
                      <Button size="small" variant="outlined" onClick={() => openEdit(x)} disabled={isBusy}>
                        Edytuj
                      </Button>
                      <Button size="small" color="error" variant="outlined" onClick={() => openDelete(x)} disabled={isBusy}>
                        Usuń
                      </Button>
                    </Stack>
                  </Stack>
                </Stack>
              </Paper>
            );
          })}
        </Stack>
      )}

      {/* PAGINATION */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
          <Typography variant="body2" color="text.secondary">
            Paginacja DRF: previous/next
          </Typography>

          <Stack direction="row" spacing={1}>
            <Button disabled={!canPrev} onClick={() => setPage((p) => Math.max(1, p - 1))} variant="outlined">
              Poprzednia
            </Button>
            <Button disabled={!canNext} onClick={() => setPage((p) => p + 1)} variant="contained">
              Następna
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {/* EDIT DIALOG */}
      <Dialog open={editOpen} onClose={closeEdit} maxWidth="sm" fullWidth>
        <DialogTitle>Edytuj wniosek</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="date_from"
              type="date"
              value={editDateFrom}
              onChange={(e) => setEditDateFrom(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="date_to"
              type="date"
              value={editDateTo}
              onChange={(e) => setEditDateTo(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Powód"
              value={editReason}
              onChange={(e) => setEditReason(e.target.value)}
              multiline
              rows={3}
            />

            <FormControl size="small">
              <InputLabel>Status</InputLabel>
              <Select value={editStatus} label="Status" onChange={(e) => setEditStatus(e.target.value as TimeOffStatus)}>
                <MenuItem value="PENDING">PENDING</MenuItem>
                <MenuItem value="APPROVED">APPROVED</MenuItem>
                <MenuItem value="REJECTED">REJECTED</MenuItem>
              </Select>
            </FormControl>

            <Alert severity="info">
              Backend pozwala ADMIN na PATCH (w tym zmianę statusu). Pamiętaj: approve/reject są preferowane, ale PATCH jest dostępny.
            </Alert>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeEdit}>Anuluj</Button>
          <Button onClick={saveEdit} variant="contained" disabled={!editing || busyId === editing?.id}>
            Zapisz
          </Button>
        </DialogActions>
      </Dialog>

      {/* DELETE CONFIRM */}
      <Dialog open={deleteOpen} onClose={closeDelete} maxWidth="xs" fullWidth>
        <DialogTitle>Usuń wniosek</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mt: 1 }}>
            Czy na pewno chcesz usunąć wniosek urlopowy dla <b>{deleting?.employee_name}</b>?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDelete}>Anuluj</Button>
          <Button onClick={confirmDelete} color="error" variant="contained" disabled={!deleting || busyId === deleting?.id}>
            Usuń
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
