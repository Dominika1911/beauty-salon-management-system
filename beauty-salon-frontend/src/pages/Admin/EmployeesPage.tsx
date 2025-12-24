// src/pages/Admin/EmployeesPage.tsx
import React, { useEffect, useMemo, useState } from "react";
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
} from "@mui/material";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import RefreshIcon from "@mui/icons-material/Refresh";

import type { Employee, Service } from "../../types";
import {
  getEmployees,
  createEmployee,
  updateEmployee,
  deleteEmployee,
} from "../../api/employees";
import { getActiveServices } from "../../api/services";

type EmployeeFormState = {
  id?: number;
  first_name: string;
  last_name: string;
  phone: string;
  is_active: boolean;
  skill_ids: number[];

  // create-only (backend wymaga przy tworzeniu)
  email?: string;
  password?: string;
};

const emptyForm: EmployeeFormState = {
  first_name: "",
  last_name: "",
  phone: "",
  is_active: true,
  skill_ids: [],
  email: "",
  password: "",
};

function formatPLN(value: string | number) {
  const n = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(n)) return "0.00 zł";
  return new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN" }).format(n);
}

export default function EmployeesPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Employee[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [search, setSearch] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [form, setForm] = useState<EmployeeFormState>(emptyForm);

  const [confirmDelete, setConfirmDelete] = useState<Employee | null>(null);

  const [snack, setSnack] = useState<{ open: boolean; msg: string; severity: "success" | "error" | "info" }>({
    open: false,
    msg: "",
    severity: "info",
  });

  const serviceMap = useMemo(() => {
    const map = new Map<number, Service>();
    services.forEach((s) => map.set(s.id, s));
    return map;
  }, [services]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((e) => {
      const full = `${e.first_name} ${e.last_name}`.toLowerCase();
      const num = (e.employee_number || "").toLowerCase();
      const username = (e.user_username || "").toLowerCase();
      const email = (e.user_email || "").toLowerCase();
      return full.includes(q) || num.includes(q) || username.includes(q) || email.includes(q);
    });
  }, [rows, search]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [emp, srv] = await Promise.all([getEmployees(), getActiveServices()]);
      setRows(emp as Employee[]);
      setServices(srv as Service[]);
    } catch (e: any) {
      setSnack({ open: true, msg: e?.response?.data?.detail || "Nie udało się pobrać danych.", severity: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      email: "", // nie wysyłamy przy edit jeśli nie zmieniasz
      password: "",
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setForm({ ...emptyForm });
  };

  const handleSave = async () => {
    try {
      // minimalna walidacja UI
      if (!form.first_name.trim() || !form.last_name.trim()) {
        setSnack({ open: true, msg: "Imię i nazwisko są wymagane.", severity: "error" });
        return;
      }

      if (!isEdit) {
        if (!form.email?.trim() || !form.password?.trim()) {
          setSnack({ open: true, msg: "Email i hasło są wymagane przy tworzeniu.", severity: "error" });
          return;
        }
      }

      const payload: any = {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        phone: form.phone.trim(),
        is_active: form.is_active,
        skill_ids: form.skill_ids,
      };

      // create-only
      if (!isEdit) {
        payload.email = form.email?.trim();
        payload.password = form.password;
      } else {
        // opcjonalnie przy edit: jeśli wpiszesz email/hasło, backend to przyjmie
        if (form.email?.trim()) payload.email = form.email.trim();
        if (form.password?.trim()) payload.password = form.password;
      }

      if (isEdit && form.id) {
        await updateEmployee(form.id, payload);
        setSnack({ open: true, msg: "Zaktualizowano pracownika.", severity: "success" });
      } else {
        await createEmployee(payload);
        setSnack({ open: true, msg: "Utworzono pracownika.", severity: "success" });
      }

      closeDialog();
      await loadAll();
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
      await deleteEmployee(confirmDelete.id);
      setSnack({ open: true, msg: "Usunięto pracownika.", severity: "success" });
      setConfirmDelete(null);
      await loadAll();
    } catch (e: any) {
      setSnack({ open: true, msg: e?.response?.data?.detail || "Nie udało się usunąć.", severity: "error" });
    }
  };

  const columns: GridColDef<Employee>[] = [
    { field: "employee_number", headerName: "Nr", width: 110 },
    {
      field: "full_name",
      headerName: "Pracownik",
      flex: 1,
      minWidth: 220,
      valueGetter: (_, row) => `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim(),
    },
    {
      field: "user_username",
      headerName: "Login",
      minWidth: 160,
      flex: 0.8,
      valueGetter: (_, row) => row.user_username || "—",
    },
    {
      field: "user_email",
      headerName: "Email",
      minWidth: 200,
      flex: 1,
      valueGetter: (_, row) => row.user_email || "—",
    },
    {
      field: "is_active",
      headerName: "Status",
      width: 120,
      renderCell: (params) =>
        params.row.is_active ? <Chip label="Aktywny" color="success" size="small" /> : <Chip label="Nieaktywny" size="small" />,
      sortable: true,
    },
    {
      field: "appointments_count",
      headerName: "Wizyty",
      width: 110,
      valueGetter: (_, row) => row.appointments_count ?? 0,
    },
    {
      field: "completed_appointments_count",
      headerName: "Zakończone",
      width: 130,
      valueGetter: (_, row) => row.completed_appointments_count ?? 0,
    },
    {
      field: "revenue_completed_total",
      headerName: "Przychód",
      width: 140,
      valueGetter: (_, row) => formatPLN(row.revenue_completed_total ?? "0"),
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
      width: 120,
      sortable: false,
      filterable: false,
      renderCell: (params) => (
        <Stack direction="row" spacing={1}>
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

  return (
    <Box sx={{ p: 3 }}>
      <Stack spacing={2}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }} justifyContent="space-between">
          <Box>
            <Typography variant="h4" fontWeight={700}>
              Pracownicy
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Zarządzanie pracownikami oraz ich usługami.
            </Typography>
          </Box>

          <Stack direction="row" spacing={1}>
            <Button variant="outlined" startIcon={<RefreshIcon />} onClick={loadAll}>
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
                label="Szukaj"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="np. Kowalska, pracownik-00000001, email..."
                fullWidth
              />
            </Stack>

            <Divider sx={{ mb: 2 }} />

            {loading ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
                <CircularProgress />
              </Box>
            ) : (
              <Box sx={{ height: 560, width: "100%" }}>
                <DataGrid
                  rows={filteredRows}
                  columns={columns}
                  getRowId={(r) => r.id}
                  pageSizeOptions={[10, 25, 50]}
                  initialState={{
                    pagination: { paginationModel: { pageSize: 10, page: 0 } },
                  }}
                  disableRowSelectionOnClick
                />
              </Box>
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

            {/* create required: email+password, edit optional */}
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                label="Email (dla konta)"
                value={form.email ?? ""}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                fullWidth
                required={!isEdit}
              />
              <TextField
                label="Hasło"
                value={form.password ?? ""}
                onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                fullWidth
                required={!isEdit}
                type="password"
              />
            </Stack>

            <FormControl fullWidth>
              <InputLabel id="skills-label">Usługi (skills)</InputLabel>
              <Select
                labelId="skills-label"
                multiple
                value={form.skill_ids}
                onChange={(e) => setForm((p) => ({ ...p, skill_ids: e.target.value as number[] }))}
                input={<OutlinedInput label="Usługi (skills)" />}
                renderValue={(selected) =>
                  (selected as number[])
                    .map((id) => serviceMap.get(id)?.name || `#${id}`)
                    .join(", ")
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
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog}>Anuluj</Button>
          <Button onClick={handleSave} variant="contained">
            Zapisz
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
            Uwaga: jeśli są powiązane wizyty, backend może zablokować usunięcie (PROTECT).
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
