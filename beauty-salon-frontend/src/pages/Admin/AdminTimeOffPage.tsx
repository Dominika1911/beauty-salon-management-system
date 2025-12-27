// AdminTimeOffPage.tsx
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
} from "@mui/material";
import Pagination from "@mui/material/Pagination";

import { timeOffApi } from "@/api/timeOff";
import { employeesApi } from "@/api/employees";
import type { EmployeeListItem } from "@/api/employees";
import type { DRFPaginated, TimeOff, TimeOffStatus } from "@/types";

type StatusFilter = TimeOffStatus | "ALL";

function getErrorMessage(err: unknown): string {
  const e = err as any;
  return (
    e?.response?.data?.detail ||
    e?.response?.data?.message ||
    e?.message ||
    "Nie udało się wykonać operacji."
  );
}

function isValidYmd(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
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

export default function AdminTimeOffsPage(): JSX.Element {
  const [data, setData] = useState<DRFPaginated<TimeOff> | null>(null);
  const [page, setPage] = useState(1);

  const [employees, setEmployees] = useState<EmployeeListItem[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(true);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("PENDING");
  const [employeeId, setEmployeeId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [ordering, setOrdering] = useState("-created_at");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  const [loading, setLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  const [editing, setEditing] = useState<TimeOff | null>(null);
  const [editDateFrom, setEditDateFrom] = useState("");
  const [editDateTo, setEditDateTo] = useState("");
  const [editReason, setEditReason] = useState("");
  const [editStatus, setEditStatus] = useState<TimeOffStatus>("PENDING");

  const employeeMap = useMemo(() => {
    const m = new Map<number, EmployeeListItem>();
    for (const e of employees) m.set(e.id, e);
    return m;
  }, [employees]);

  const loadEmployees = useCallback(async () => {
    setLoadingEmployees(true);
    try {
      const res = await employeesApi.list({ page: 1, is_active: true });
      setEmployees(res.results ?? []);
    } catch {
      setEmployees([]);
    } finally {
      setLoadingEmployees(false);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    setMsg("");

    try {
      const res = await timeOffApi.list({
        page,
        ordering,
        status: statusFilter === "ALL" ? undefined : statusFilter,
        employee: employeeId ? Number(employeeId) : undefined,
        search: search.trim() || undefined,
        date_from: dateFrom && isValidYmd(dateFrom) ? dateFrom : undefined,
        date_to: dateTo && isValidYmd(dateTo) ? dateTo : undefined,
      });
      setData(res);
    } catch (e) {
      setErr(getErrorMessage(e));
      setData({ count: 0, next: null, previous: null, results: [] });
    } finally {
      setLoading(false);
    }
  }, [page, ordering, statusFilter, employeeId, search, dateFrom, dateTo]);

  useEffect(() => {
    void loadEmployees();
  }, [loadEmployees]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalPages = useMemo(() => {
    const count = data?.count ?? 0;
    return Math.max(1, Math.ceil(count / 10));
  }, [data]);

  const runAction = useCallback(
    async (fn: (id: number) => Promise<TimeOff>, id: number, successMsg: string) => {
      setIsBusy(true);
      setErr("");
      setMsg("");
      try {
        await fn(id);
        setMsg(successMsg);
        await load();
      } catch (e) {
        setErr(getErrorMessage(e));
      } finally {
        setIsBusy(false);
      }
    },
    [load]
  );

  const openEdit = (x: TimeOff) => {
    setEditing(x);
    setEditDateFrom(x.date_from);
    setEditDateTo(x.date_to);
    setEditReason(x.reason || "");
    setEditStatus(x.status);
    setErr("");
    setMsg("");
  };

  const closeEdit = () => setEditing(null);

  const saveEdit = useCallback(async () => {
    if (!editing) return;

    setIsBusy(true);
    setErr("");
    setMsg("");

    try {
      await timeOffApi.update(editing.id, {
        date_from: editDateFrom || undefined,
        date_to: editDateTo || undefined,
        reason: editReason || undefined,
        status: editStatus,
      });
      setMsg("Zapisano zmiany.");
      setEditing(null);
      await load();
    } catch (e) {
      setErr(getErrorMessage(e));
    } finally {
      setIsBusy(false);
    }
  }, [editing, editDateFrom, editDateTo, editReason, editStatus, load]);

  return (
    <Stack spacing={2}>
      <Typography variant="h5" fontWeight={700}>
        Wnioski urlopowe
      </Typography>

      {msg && <Alert severity="success">{msg}</Alert>}
      {err && <Alert severity="error">{err}</Alert>}

      <Paper sx={{ p: 2 }}>
        <Stack spacing={2}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
            <FormControl size="small" sx={{ minWidth: 180 }}>
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

            <FormControl size="small" sx={{ minWidth: 240 }}>
              <InputLabel>Pracownik</InputLabel>
              <Select
                label="Pracownik"
                value={employeeId === "" ? "" : String(employeeId)}
                onChange={(e) => {
                  setPage(1);
                  setEmployeeId(e.target.value);
                }}
              >
                <MenuItem value="">(wszyscy)</MenuItem>
                {loadingEmployees ? (
                  <MenuItem value="" disabled>
                    Ładowanie...
                  </MenuItem>
                ) : (
                  employees.map((e) => (
                    <MenuItem key={e.id} value={String(e.id)}>
                      {e.first_name} {e.last_name} {"employee_number" in e ? `(${e.employee_number})` : ""}
                    </MenuItem>
                  ))
                )}
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

            <TextField
              size="small"
              label="date_from (YYYY-MM-DD)"
              value={dateFrom}
              onChange={(e) => {
                setPage(1);
                setDateFrom(e.target.value);
              }}
            />

            <TextField
              size="small"
              label="date_to (YYYY-MM-DD)"
              value={dateTo}
              onChange={(e) => {
                setPage(1);
                setDateTo(e.target.value);
              }}
            />

            <FormControl size="small" sx={{ minWidth: 220 }}>
              <InputLabel>Sortowanie</InputLabel>
              <Select
                label="Sortowanie"
                value={ordering}
                onChange={(e) => {
                  setPage(1);
                  setOrdering(e.target.value);
                }}
              >
                <MenuItem value="-created_at">-created_at</MenuItem>
                <MenuItem value="created_at">created_at</MenuItem>
                <MenuItem value="-date_from">-date_from</MenuItem>
                <MenuItem value="date_from">date_from</MenuItem>
                <MenuItem value="-date_to">-date_to</MenuItem>
                <MenuItem value="date_to">date_to</MenuItem>
                <MenuItem value="-status">-status</MenuItem>
                <MenuItem value="status">status</MenuItem>
              </Select>
            </FormControl>

            <Box sx={{ flex: 1 }} />

            <Button variant="outlined" onClick={load} disabled={loading || isBusy}>
              Odśwież
            </Button>
          </Stack>

          <Divider />

          {loading ? (
            <CircularProgress size={24} />
          ) : (data?.results?.length ?? 0) === 0 ? (
            <Alert severity="info">Brak wniosków.</Alert>
          ) : (
            <Stack spacing={1}>
              {data!.results.map((x) => {
                const canApprove = x.can_approve;
                const canReject = x.can_reject;
                const canCancel = x.can_cancel;

                const emp = employeeMap.get(x.employee);
                const employeeHint =
                  emp && "employee_number" in emp && emp.employee_number ? ` (${emp.employee_number})` : "";

                return (
                  <Paper key={x.id} variant="outlined" sx={{ p: 1.5 }}>
                    <Stack direction={{ xs: "column", md: "row" }} spacing={1} alignItems={{ md: "center" }}>
                      <Box sx={{ minWidth: 260 }}>
                        <Typography fontWeight={600}>
                          {x.employee_name}
                          {employeeHint}
                        </Typography>
                        <Typography variant="body2">
                          {x.date_from} → {x.date_to}
                        </Typography>
                        {x.reason && <Typography variant="body2">{x.reason}</Typography>}
                      </Box>

                      <StatusChip status={x.status} label={x.status_display} />

                      <Box sx={{ flex: 1 }} />

                      <Stack direction="row" spacing={1} flexWrap="wrap">
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

                        <Button
                          size="small"
                          variant="outlined"
                          disabled={isBusy || !canCancel}
                          onClick={() => runAction(timeOffApi.cancel, x.id, "Wniosek anulowany.")}
                        >
                          Anuluj
                        </Button>

                        <Button size="small" variant="outlined" onClick={() => openEdit(x)} disabled={isBusy}>
                          Edytuj
                        </Button>

                        <Button
                          size="small"
                          variant="outlined"
                          color="error"
                          disabled={isBusy}
                          onClick={async () => {
                            if (!confirm("Usunąć wniosek?")) return;
                            setIsBusy(true);
                            setErr("");
                            setMsg("");
                            try {
                              await timeOffApi.remove(x.id);
                              setMsg("Usunięto wniosek.");
                              await load();
                            } catch (e) {
                              setErr(getErrorMessage(e));
                            } finally {
                              setIsBusy(false);
                            }
                          }}
                        >
                          Usuń
                        </Button>
                      </Stack>
                    </Stack>
                  </Paper>
                );
              })}
            </Stack>
          )}

          <Divider />

          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="body2">Łącznie: {data?.count ?? 0}</Typography>
            <Pagination
              count={totalPages}
              page={page}
              onChange={(_, p) => setPage(p)}
              disabled={loading || isBusy}
            />
          </Stack>
        </Stack>
      </Paper>

      {editing && (
        <Paper sx={{ p: 2 }} variant="outlined">
          <Typography fontWeight={700}>Edycja wniosku #{editing.id}</Typography>

          <Stack spacing={2} sx={{ mt: 1 }}>
            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <TextField
                size="small"
                label="date_from (YYYY-MM-DD)"
                value={editDateFrom}
                onChange={(e) => setEditDateFrom(e.target.value)}
              />
              <TextField
                size="small"
                label="date_to (YYYY-MM-DD)"
                value={editDateTo}
                onChange={(e) => setEditDateTo(e.target.value)}
              />
              <FormControl size="small" sx={{ minWidth: 220 }}>
                <InputLabel>Status</InputLabel>
                <Select
                  label="Status"
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as TimeOffStatus)}
                >
                  <MenuItem value="PENDING">PENDING</MenuItem>
                  <MenuItem value="APPROVED">APPROVED</MenuItem>
                  <MenuItem value="REJECTED">REJECTED</MenuItem>
                  <MenuItem value="CANCELLED">CANCELLED</MenuItem>
                </Select>
              </FormControl>
            </Stack>

            <TextField
              size="small"
              label="Powód"
              value={editReason}
              onChange={(e) => setEditReason(e.target.value)}
              fullWidth
            />

            <Stack direction="row" spacing={1}>
              <Button variant="contained" onClick={saveEdit} disabled={isBusy}>
                Zapisz
              </Button>
              <Button variant="outlined" onClick={closeEdit} disabled={isBusy}>
                Anuluj
              </Button>
            </Stack>
          </Stack>
        </Paper>
      )}
    </Stack>
  );
}
