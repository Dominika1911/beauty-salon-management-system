// src/pages/Admin/EmployeesPage.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Stack,
  TextField,
  Typography,
  Alert,
  Snackbar,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  OutlinedInput,
  Checkbox,
  ListItemText,
  Paper,
} from "@mui/material";
import { DataGrid, GridColDef, GridSortModel } from "@mui/x-data-grid";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import RefreshIcon from "@mui/icons-material/Refresh";
import KeyIcon from "@mui/icons-material/Key";

import type { DRFPaginated, Employee, Service } from "@/types";
import { employeesApi, type EmployeeListItem } from "@/api/employees";
import { servicesApi } from "@/api/services";
import { usersApi } from "@/api/users";

/** ✅ type-guard: ADMIN ma pełny EmployeeSerializer */
function isEmployee(row: EmployeeListItem): row is Employee {
  return (row as Employee).employee_number !== undefined;
}

type EmployeeFormState = {
  id?: number;
  first_name: string;
  last_name: string;
  phone: string;
  is_active: boolean;
  skill_ids: number[];
  email?: string; // ✅ zostaje
};

const emptyForm: EmployeeFormState = {
  first_name: "",
  last_name: "",
  phone: "",
  is_active: true,
  skill_ids: [],
  email: "",
};

function formatPLN(value: string | number) {
  const n = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(n)) return "0,00 zł";
  return new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN" }).format(n);
}

function getErrorMessage(err: unknown): string {
  const e = err as any;
  return e?.response?.data?.detail || e?.response?.data?.message || e?.message || "Wystąpił błąd.";
}

function sortModelToOrdering(sortModel: GridSortModel): string | undefined {
  if (!sortModel || sortModel.length === 0) return undefined;

  const first = sortModel[0];
  const field = first.field;
  const direction = first.sort;

  const allowed = new Set(["id", "employee_number", "last_name", "created_at"]);
  if (!allowed.has(field)) return undefined;
  if (!direction) return undefined;

  return direction === "desc" ? `-${field}` : field;
}

export default function EmployeesPage(): JSX.Element {
  const [employeesData, setEmployeesData] = useState<DRFPaginated<Employee> | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  const [publicDataWarning, setPublicDataWarning] = useState(false);

  const [search, setSearch] = useState("");
  const [isActiveFilter, setIsActiveFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [serviceIdFilter, setServiceIdFilter] = useState<number | "">("");

  const [page, setPage] = useState(1);
  const [sortModel, setSortModel] = useState<GridSortModel>([{ field: "created_at", sort: "desc" }]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [form, setForm] = useState<EmployeeFormState>(emptyForm);

  const [confirmDelete, setConfirmDelete] = useState<Employee | null>(null);

  // ===================== RESET PASSWORD DIALOG =====================
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<Employee | null>(null);
  const [resetPass1, setResetPass1] = useState("");
  const [resetPass2, setResetPass2] = useState("");
  const [resetLoading, setResetLoading] = useState(false);

  const openResetDialog = (emp: Employee) => {
    setResetTarget(emp);
    setResetPass1("");
    setResetPass2("");
    setResetDialogOpen(true);
  };

  const closeResetDialog = () => {
    setResetDialogOpen(false);
    setResetTarget(null);
    setResetPass1("");
    setResetPass2("");
    setResetLoading(false);
  };

  const handleResetPassword = async () => {
    if (!resetTarget) return;

    if (resetPass1.trim().length < 8) {
      setSnack({ open: true, msg: "Hasło musi mieć minimum 8 znaków.", severity: "error" });
      return;
    }
    if (resetPass1 !== resetPass2) {
      setSnack({ open: true, msg: "Hasła nie są identyczne.", severity: "error" });
      return;
    }

    try {
      setResetLoading(true);
      await usersApi.resetPassword(resetTarget.user, {
        new_password: resetPass1,
        new_password2: resetPass2,
      });
      setSnack({ open: true, msg: `Zresetowano hasło dla: ${resetTarget.full_name}`, severity: "success" });
      closeResetDialog();
    } catch (e: any) {
      const msg =
        e?.response?.data?.detail ||
        e?.response?.data?.new_password?.[0] ||
        e?.response?.data?.new_password2?.[0] ||
        "Nie udało się zresetować hasła.";
      setSnack({ open: true, msg, severity: "error" });
    } finally {
      setResetLoading(false);
    }
  };

  // ===================== SNACK =====================
  const [snack, setSnack] = useState<{
    open: boolean;
    msg: string;
    severity: "success" | "error" | "info";
  }>({ open: false, msg: "", severity: "info" });

  const serviceMap = useMemo(() => {
    const map = new Map<number, Service>();
    services.forEach((s) => map.set(s.id, s));
    return map;
  }, [services]);

  useEffect(() => {
    setPage(1);
  }, [search, isActiveFilter, serviceIdFilter]);

  const loadAllServices = useCallback(async () => {
    const all: Service[] = [];
    let currentPage = 1;

    while (true) {
      const res = await servicesApi.list({ is_active: true, page: currentPage, ordering: "name" });
      all.push(...res.results);
      if (!res.next) break;
      currentPage += 1;
    }

    setServices(all);
  }, []);

  const loadEmployees = useCallback(async () => {
    setLoading(true);

    try {
      const ordering = sortModelToOrdering(sortModel) || "-created_at";

      const res = await employeesApi.list({
        page,
        ordering,
        search: search.trim() || undefined,
        is_active: isActiveFilter === "ALL" ? undefined : isActiveFilter === "ACTIVE",
        service_id: serviceIdFilter === "" ? undefined : serviceIdFilter,
      });

      const fullEmployees = res.results.filter(isEmployee);
      const hadPublic = fullEmployees.length !== res.results.length;

      setPublicDataWarning(hadPublic);

      if (hadPublic) {
        setSnack({
          open: true,
          msg: "Backend zwrócił niepełne dane pracowników (EmployeePublic). Sprawdź czy jesteś zalogowany jako ADMIN.",
          severity: "error",
        });
      }

      setEmployeesData({
        count: res.count,
        next: res.next,
        previous: res.previous,
        results: fullEmployees,
      });
    } catch (e) {
      setEmployeesData({ count: 0, next: null, previous: null, results: [] });
      setPublicDataWarning(false);
      setSnack({
        open: true,
        msg: getErrorMessage(e) || "Nie udało się pobrać pracowników.",
        severity: "error",
      });
    } finally {
      setLoading(false);
    }
  }, [page, sortModel, search, isActiveFilter, serviceIdFilter]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([loadAllServices(), loadEmployees()]);
    } finally {
      setLoading(false);
    }
  }, [loadAllServices, loadEmployees]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    void loadEmployees();
  }, [loadEmployees]);

  const rows = useMemo(() => employeesData?.results ?? [], [employeesData]);

  const openCreate = () => {
    setIsEdit(false);
    setForm({ ...emptyForm });
    setDialogOpen(true);
  };

  const openEdit = (emp: Employee) => {
    setIsEdit(true);
    setForm({
      id: emp.id,
      first_name: emp.first_name || "",
      last_name: emp.last_name || "",
      phone: emp.phone || "",
      is_active: !!emp.is_active,
      skill_ids: (emp.skills || []).map((s) => s.id),
      email: "",
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setForm({ ...emptyForm });
  };

  const handleSave = async () => {
    try {
      if (!form.first_name.trim() || !form.last_name.trim()) {
        setSnack({ open: true, msg: "Imię i nazwisko są wymagane.", severity: "error" });
        return;
      }

      // ✅ jeśli backend wymaga email przy CREATE – zostawiamy walidację email
      if (!isEdit) {
        if (!form.email?.trim()) {
          setSnack({ open: true, msg: "Email jest wymagany przy tworzeniu.", severity: "error" });
          return;
        }
      }

      const payload: {
        first_name: string;
        last_name: string;
        phone: string;
        is_active: boolean;
        skill_ids: number[];
        email?: string;
      } = {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        phone: form.phone.trim(),
        is_active: form.is_active,
        skill_ids: form.skill_ids,
      };

      if (!isEdit) {
        payload.email = form.email?.trim();
        await employeesApi.create(payload as any);
        setSnack({ open: true, msg: "Utworzono pracownika.", severity: "success" });
      } else {
        if (form.email?.trim()) payload.email = form.email.trim();
        if (form.id) {
          await employeesApi.update(form.id, payload as any);
          setSnack({ open: true, msg: "Zaktualizowano pracownika.", severity: "success" });
        }
      }

      closeDialog();
      await loadEmployees();
    } catch (e: any) {
      const msg =
        e?.response?.data?.detail ||
        (typeof e?.response?.data === "object" ? JSON.stringify(e.response.data) : null) ||
        "Nie udało się zapisać pracownika.";
      setSnack({ open: true, msg, severity: "error" });
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await employeesApi.delete(confirmDelete.id);
      setSnack({ open: true, msg: "Usunięto pracownika.", severity: "success" });
      setConfirmDelete(null);
      await loadEmployees();
    } catch (e: any) {
      setSnack({
        open: true,
        msg: e?.response?.data?.detail || "Nie udało się usunąć.",
        severity: "error",
      });
    }
  };

  const columns: GridColDef<Employee>[] = [
    {
      field: "employee_number",
      headerName: "Nr",
      width: 110,
      valueGetter: (_value, row) => row.employee_number || "—",
      sortable: true,
    },
    {
      field: "full_name",
      headerName: "Pracownik",
      flex: 1,
      minWidth: 220,
      valueGetter: (_value, row) => `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim(),
      sortable: false,
    },
    {
      field: "user_username",
      headerName: "Login",
      minWidth: 160,
      flex: 0.8,
      valueGetter: (_value, row) => row.user_username || "—",
      sortable: false,
    },
    {
      field: "user_email",
      headerName: "Email",
      minWidth: 200,
      flex: 1,
      valueGetter: (_value, row) => row.user_email || "—",
      sortable: false,
    },
    {
      field: "is_active",
      headerName: "Status",
      width: 120,
      renderCell: (params) =>
        params.row.is_active ? <Chip label="Aktywny" color="success" size="small" /> : <Chip label="Nieaktywny" size="small" />,
      sortable: false,
    },
    {
      field: "appointments_count",
      headerName: "Wizyty",
      width: 110,
      valueGetter: (_value, row) => row.appointments_count ?? 0,
      sortable: false,
    },
    {
      field: "completed_appointments_count",
      headerName: "Zakończone",
      width: 130,
      valueGetter: (_value, row) => row.completed_appointments_count ?? 0,
      sortable: false,
    },
    {
      field: "revenue_completed_total",
      headerName: "Przychód",
      width: 160,
      valueGetter: (_value, row) => formatPLN(row.revenue_completed_total ?? "0"),
      sortable: false,
    },
    {
      field: "skills",
      headerName: "Usługi",
      flex: 1,
      minWidth: 240,
      sortable: false,
      renderCell: (params) => {
        const list = params.row.skills || [];
        if (!list.length) return "—";
        return (
          <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
            {list.slice(0, 3).map((s) => (
              <Chip key={s.id} label={s.name} size="small" />
            ))}
            {list.length > 3 && <Chip label={`+${list.length - 3}`} size="small" variant="outlined" />}
          </Box>
        );
      },
    },
    {
      field: "actions",
      headerName: "",
      width: 150,
      sortable: false,
      filterable: false,
      renderCell: (params) => (
        <Stack direction="row" spacing={1}>
          {/* 🔐 reset hasła */}
          <IconButton size="small" onClick={() => openResetDialog(params.row)} aria-label="reset-password">
            <KeyIcon fontSize="small" />
          </IconButton>

          <IconButton size="small" onClick={() => openEdit(params.row)} aria-label="edit">
            <EditIcon fontSize="small" />
          </IconButton>

          <IconButton size="small" onClick={() => setConfirmDelete(params.row)} aria-label="delete">
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Stack>
      ),
    },
  ];

  const canPrev = Boolean(employeesData?.previous) && !loading;
  const canNext = Boolean(employeesData?.next) && !loading;

  return (
    <Box sx={{ p: 3 }}>
      <Stack spacing={2}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          alignItems={{ sm: "center" }}
          justifyContent="space-between"
        >
          <Box>
            <Typography variant="h4" fontWeight={700}>
              Pracownicy
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Backend: paginacja PageNumberPagination (PAGE_SIZE=20) • Łącznie: {employeesData?.count ?? "—"} • Strona: {page}
            </Typography>
          </Box>

          <Stack direction="row" spacing={1}>
            <Button variant="outlined" startIcon={<RefreshIcon />} onClick={() => loadAll()}>
              Odśwież
            </Button>
            <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
              Dodaj pracownika
            </Button>
          </Stack>
        </Stack>

        <Card>
          <CardContent>
            <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ md: "center" }} sx={{ mb: 2 }}>
              <TextField
                label="search (backend)"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="np. 00000001, Kowalska..."
                fullWidth
              />

              <FormControl sx={{ minWidth: 220 }}>
                <InputLabel id="is-active-label">Status (backend)</InputLabel>
                <Select
                  labelId="is-active-label"
                  value={isActiveFilter}
                  label="Status (backend)"
                  onChange={(e) => setIsActiveFilter(e.target.value as any)}
                >
                  <MenuItem value="ALL">Wszystkie</MenuItem>
                  <MenuItem value="ACTIVE">Tylko aktywni</MenuItem>
                  <MenuItem value="INACTIVE">Tylko nieaktywni</MenuItem>
                </Select>
              </FormControl>

              <FormControl sx={{ minWidth: 260 }}>
                <InputLabel id="service-filter-label">service_id (backend)</InputLabel>
                <Select
                  labelId="service-filter-label"
                  value={serviceIdFilter}
                  label="service_id (backend)"
                  onChange={(e) => setServiceIdFilter(e.target.value === "" ? "" : Number(e.target.value))}
                >
                  <MenuItem value="">Wszystkie usługi</MenuItem>
                  {services.map((s) => (
                    <MenuItem key={s.id} value={s.id}>
                      {s.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>

            <Divider sx={{ mb: 2 }} />

            <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
              <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">
                  ordering (backend): {sortModelToOrdering(sortModel) || "-created_at"}
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

            {loading ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
                <CircularProgress />
              </Box>
            ) : (
              <>
                {publicDataWarning && (
                  <Alert severity="error" sx={{ mb: 2 }}>
                    Backend zwrócił część rekordów w trybie publicznym (EmployeePublic). To zwykle oznacza problem z
                    autoryzacją/rolą — sprawdź czy jesteś zalogowany jako <b>ADMIN</b>.
                  </Alert>
                )}

                <Box sx={{ height: 560, width: "100%" }}>
                  <DataGrid
                    rows={rows}
                    columns={columns}
                    getRowId={(r) => r.id}
                    disableRowSelectionOnClick
                    sortingMode="server"
                    sortModel={sortModel}
                    onSortModelChange={(model) => setSortModel(model)}
                    pageSizeOptions={[20]}
                    paginationMode="server"
                    rowCount={employeesData?.count ?? 0}
                    paginationModel={{ page: page - 1, pageSize: 20 }}
                    onPaginationModelChange={(model) => setPage(model.page + 1)}
                  />
                </Box>
              </>
            )}
          </CardContent>
        </Card>
      </Stack>

      {/* CREATE / EDIT DIALOG */}
      <Dialog open={dialogOpen} onClose={closeDialog} fullWidth maxWidth="sm">
        <DialogTitle>{isEdit ? "Edytuj pracownika" : "Dodaj pracownika"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                label="Imię"
                value={form.first_name}
                onChange={(e) => setForm((p) => ({ ...p, first_name: e.target.value }))}
                fullWidth
              />
              <TextField
                label="Nazwisko"
                value={form.last_name}
                onChange={(e) => setForm((p) => ({ ...p, last_name: e.target.value }))}
                fullWidth
              />
            </Stack>

            <TextField
              label="Telefon"
              value={form.phone}
              onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
              fullWidth
              placeholder="+48123123123"
            />

            {/* ✅ Email zostaje, hasła NIE ma */}
            <TextField
              label="Email (dla konta)"
              value={form.email ?? ""}
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              fullWidth
              required={!isEdit}
            />

            <FormControl fullWidth>
              <InputLabel id="skills-label">Usługi (skills)</InputLabel>
              <Select
                labelId="skills-label"
                multiple
                value={form.skill_ids}
                onChange={(e) => setForm((p) => ({ ...p, skill_ids: e.target.value as number[] }))}
                input={<OutlinedInput label="Usługi (skills)" />}
                renderValue={(selected) =>
                  (selected as number[]).map((id) => serviceMap.get(id)?.name || `#${id}`).join(", ")
                }
              >
                {services.map((s) => (
                  <MenuItem key={s.id} value={s.id}>
                    <Checkbox checked={form.skill_ids.includes(s.id)} />
                    <ListItemText primary={s.name} secondary={s.category || ""} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel id="active-label">Status</InputLabel>
              <Select
                labelId="active-label"
                value={form.is_active ? "1" : "0"}
                label="Status"
                onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.value === "1" }))}
              >
                <MenuItem value="1">Aktywny</MenuItem>
                <MenuItem value="0">Nieaktywny</MenuItem>
              </Select>
            </FormControl>

            {!isEdit && (
              <Alert severity="info">
                Przy tworzeniu pracownika backend wygeneruje <b>employee_number</b> i ustawi login w formacie{" "}
                <b>pracownik-XXXXXXXX</b>.
              </Alert>
            )}

            <Alert severity="info">
              Zmiana hasła pracownika odbywa się <b>tylko</b> przez akcję <b>Reset hasła</b> (ikona klucza w tabeli).
            </Alert>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog}>Anuluj</Button>
          <Button onClick={handleSave} variant="contained">
            Zapisz
          </Button>
        </DialogActions>
      </Dialog>

      {/* RESET PASSWORD DIALOG */}
      <Dialog open={resetDialogOpen} onClose={closeResetDialog} fullWidth maxWidth="sm">
        <DialogTitle>Reset hasła pracownika</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography variant="body2">
              Pracownik: <b>{resetTarget?.full_name}</b>
            </Typography>

            <TextField
              label="Nowe hasło"
              type="password"
              value={resetPass1}
              onChange={(e) => setResetPass1(e.target.value)}
              fullWidth
              helperText="Minimum 8 znaków"
            />

            <TextField
              label="Powtórz nowe hasło"
              type="password"
              value={resetPass2}
              onChange={(e) => setResetPass2(e.target.value)}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeResetDialog} disabled={resetLoading}>
            Anuluj
          </Button>
          <Button onClick={handleResetPassword} variant="contained" disabled={resetLoading}>
            {resetLoading ? "Resetuję..." : "Resetuj"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* DELETE CONFIRM */}
      <Dialog open={!!confirmDelete} onClose={() => setConfirmDelete(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Usuń pracownika</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mt: 1 }}>
            Czy na pewno chcesz usunąć pracownika{" "}
            <b>
              {confirmDelete?.first_name} {confirmDelete?.last_name}
            </b>
            ?
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Uwaga: jeśli są powiązane wizyty, backend może zablokować usunięcie (np. przez constraints).
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDelete(null)}>Anuluj</Button>
          <Button color="error" variant="contained" onClick={handleDelete}>
            Usuń
          </Button>
        </DialogActions>
      </Dialog>

      {/* SNACKBAR */}
      <Snackbar
        open={snack.open}
        autoHideDuration={3500}
        onClose={() => setSnack((p) => ({ ...p, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert onClose={() => setSnack((p) => ({ ...p, open: false }))} severity={snack.severity} sx={{ width: "100%" }}>
          {snack.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}
