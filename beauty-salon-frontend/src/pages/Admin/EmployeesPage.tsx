// src/pages/Admin/EmployeesPage.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  ButtonGroup,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  LinearProgress,
  ListItemText,
  MenuItem,
  OutlinedInput,
  Paper,
  Select,
  Snackbar,
  Stack,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { DataGrid, GridColDef, GridSortModel, type GridColumnVisibilityModel } from "@mui/x-data-grid";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import RefreshIcon from "@mui/icons-material/Refresh";
import KeyIcon from "@mui/icons-material/Key";

import type { DRFPaginated, Employee, Service } from "@/types";
import { employeesApi, type EmployeeListItem } from "@/api/employees";
import { servicesApi } from "@/api/services";
import { usersApi } from "@/api/users";
import { parseDrfError, pickFieldErrors } from "@/utils/drfErrors";

const ORDERING_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "-created_at", label: "Najnowsi" },
  { value: "created_at", label: "Najstarsi" },
  { value: "last_name", label: "Nazwisko (A→Z)" },
  { value: "-last_name", label: "Nazwisko (Z→A)" },
  { value: "employee_number", label: "Nr pracownika (rosnąco)" },
  { value: "-employee_number", label: "Nr pracownika (malejąco)" },
  { value: "id", label: "ID (rosnąco)" },
  { value: "-id", label: "ID (malejąco)" },
];

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
  email: string; // create: wymagany
  password: string; // create: wymagany
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

type FieldErrors = Partial<Record<keyof EmployeeFormState, string>>;

function formatPLN(value: string | number) {
  const n = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(n)) return "0,00 zł";
  return new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN" }).format(n);
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

type AxiosLikeError = { response?: { data?: unknown } };
function getResponseData(err: unknown): unknown {
  if (typeof err !== "object" || err === null) return undefined;
  if (!("response" in err)) return undefined;
  return (err as AxiosLikeError).response?.data;
}

function extractDrfMessage(data: unknown): string | undefined {
  if (!data) return undefined;
  if (typeof data === "string") return data;

  if (Array.isArray(data)) {
    const first = data[0];
    if (typeof first === "string") return first;
    return undefined;
  }

  if (typeof data === "object") {
    const obj = data as Record<string, unknown>;

    const candidateKeys = ["detail", "message", "error", "non_field_errors", "errors"];
    for (const k of candidateKeys) {
      const v = obj[k];
      if (typeof v === "string") return v;
      if (Array.isArray(v) && v.length && typeof v[0] === "string") return String(v[0]);
    }

    const maybe0 = obj["0"];
    if (typeof maybe0 === "string") return maybe0;

    const all = obj["__all__"];
    if (Array.isArray(all) && all.length && typeof all[0] === "string") return String(all[0]);
  }

  return undefined;
}

function mapEmployeeCreateMessage(msg: string): string {
  const m = msg.toLowerCase();

  const isLoginGeneratorProblem =
    m.includes("login") &&
    (m.includes("nie można wygenerować") ||
      m.includes("nie mozna wygenerowac") ||
      m.includes("unikaln") ||
      m.includes("już istnieje") ||
      m.includes("istnieje"));

  if (isLoginGeneratorProblem) {
    return "Nie udało się utworzyć pracownika — system nie mógł wygenerować unikalnych danych konta. Spróbuj ponownie.";
  }

  return msg;
}


export default function EmployeesPage(): JSX.Element {
  const theme = useTheme();
  const isDownMd = useMediaQuery(theme.breakpoints.down("md"));
  const isDownSm = useMediaQuery(theme.breakpoints.down("sm"));

  const [employeesData, setEmployeesData] = useState<DRFPaginated<Employee> | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  const [publicDataWarning, setPublicDataWarning] = useState(false);

  const [search, setSearch] = useState("");
  const [isActiveFilter, setIsActiveFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [serviceIdFilter, setServiceIdFilter] = useState<number | "">("");

  const [page, setPage] = useState(1);
  const [sortModel, setSortModel] = useState<GridSortModel>([{ field: "created_at", sort: "desc" }]);

  const [pageError, setPageError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [formFieldErrors, setFormFieldErrors] = useState<FieldErrors>({});

  const [dialogOpen, setDialogOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [form, setForm] = useState<EmployeeFormState>(emptyForm);

  const [confirmDelete, setConfirmDelete] = useState<Employee | null>(null);

  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<Employee | null>(null);
  const [resetPass1, setResetPass1] = useState("");
  const [resetPass2, setResetPass2] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const [actionLoading, setActionLoading] = useState(false);

  const [snack, setSnack] = useState<{ open: boolean; msg: string; severity: "success" | "info" }>({
    open: false,
    msg: "",
    severity: "info",
  });

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
    setPageError(null);

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
        setPageError("Część danych pracowników jest ukryta. Sprawdź, czy jesteś zalogowany jako ADMIN.");
      }

      setEmployeesData({
        count: res.count,
        next: res.next,
        previous: res.previous,
        results: fullEmployees,
      });
    } catch (e: unknown) {
      setEmployeesData({ count: 0, next: null, previous: null, results: [] });
      setPublicDataWarning(false);

      const parsed = parseDrfError(e);
      setPageError(parsed.message || "Nie udało się pobrać pracowników. Spróbuj ponownie.");
    } finally {
      setLoading(false);
    }
  }, [page, sortModel, search, isActiveFilter, serviceIdFilter]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setPageError(null);
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
  const canPrev = Boolean(employeesData?.previous) && !loading;
  const canNext = Boolean(employeesData?.next) && !loading;

  const openCreate = () => {
    setIsEdit(false);
    setForm({ ...emptyForm });
    setFormError(null);
    setFormFieldErrors({});
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
      password: "",
    });
    setFormError(null);
    setFormFieldErrors({});
    setDialogOpen(true);
  };

  const closeDialog = () => {
    if (actionLoading) return;
    setDialogOpen(false);
    setForm({ ...emptyForm });
    setFormError(null);
    setFormFieldErrors({});
  };

  const handleSave = async () => {
    setFormError(null);
    setFormFieldErrors({});
    setActionLoading(true);

    try {
      if (!form.first_name.trim() || !form.last_name.trim()) {
        setFormError("Uzupełnij imię i nazwisko.");
        return;
      }

      if (!isEdit) {
        if (!form.email.trim() || !form.password.trim()) {
          setFormError("Email i hasło są wymagane przy tworzeniu pracownika.");
          return;
        }
        if (form.password.trim().length < 8) {
          setFormFieldErrors({ password: "Hasło musi mieć minimum 8 znaków." });
          setFormError("Nie udało się zapisać — popraw zaznaczone pola i spróbuj ponownie.");
          return;
        }
      }

      const basePayload = {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        phone: form.phone.trim() || undefined,
        is_active: form.is_active,
        skill_ids: form.skill_ids,
      };

      if (!isEdit) {
        // ✅ FIX TS2353: employeesApi.create nie przyjmuje `username` w payloadzie
        await employeesApi.create({
          ...basePayload,
          email: form.email.trim(),
          password: form.password,
        });
        setSnack({ open: true, msg: "Utworzono pracownika.", severity: "success" });
      } else if (form.id) {
        await employeesApi.update(form.id, basePayload);
        setSnack({ open: true, msg: "Zapisano zmiany.", severity: "success" });
      }

      closeDialog();
      await loadEmployees();
    } catch (e: unknown) {
      const { message, fieldErrors } = parseDrfError(e);
      const nextFieldErrors = pickFieldErrors(fieldErrors, emptyForm);
      setFormFieldErrors(nextFieldErrors);

      const rawData = getResponseData(e);
      const fallbackMsg = extractDrfMessage(rawData);
      const msg = message || fallbackMsg;

      if (msg) {
        setFormError(mapEmployeeCreateMessage(msg));
      } else if (Object.keys(nextFieldErrors).length) {
        setFormError("Nie udało się zapisać — popraw zaznaczone pola i spróbuj ponownie.");
      } else {
        setFormError("Nie udało się zapisać pracownika. Spróbuj ponownie.");
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setPageError(null);
    setActionLoading(true);

    try {
      await employeesApi.delete(confirmDelete.id);
      setSnack({ open: true, msg: "Usunięto pracownika.", severity: "success" });
      setConfirmDelete(null);
      await loadEmployees();
    } catch (e: unknown) {
      const parsed = parseDrfError(e);
      setPageError(parsed.message || "Nie udało się usunąć pracownika. Sprawdź powiązania i spróbuj ponownie.");
    } finally {
      setActionLoading(false);
    }
  };

  const openResetDialog = (emp: Employee) => {
    setResetTarget(emp);
    setResetPass1("");
    setResetPass2("");
    setResetError(null);
    setResetDialogOpen(true);
  };

  const closeResetDialog = () => {
    if (resetLoading) return;
    setResetDialogOpen(false);
    setResetTarget(null);
    setResetPass1("");
    setResetPass2("");
    setResetLoading(false);
    setResetError(null);
  };

  const handleResetPassword = async () => {
    if (!resetTarget) return;

    setResetError(null);

    if (resetPass1.trim().length < 8) {
      setResetError("Hasło musi mieć minimum 8 znaków.");
      return;
    }
    if (resetPass1 !== resetPass2) {
      setResetError("Hasła nie są identyczne.");
      return;
    }

    try {
      setResetLoading(true);
      await usersApi.resetPassword(resetTarget.user, {
        new_password: resetPass1,
        new_password2: resetPass2,
      });

      setSnack({ open: true, msg: "Zresetowano hasło pracownika.", severity: "success" });
      closeResetDialog();
      await loadEmployees();
    } catch (e: unknown) {
      const parsed = parseDrfError(e);

      const data = getResponseData(e);
      const dataObj = typeof data === "object" && data !== null ? (data as Record<string, unknown>) : undefined;

      const np = dataObj?.new_password;
      const np2 = dataObj?.new_password2;

      const msg =
        parsed.message ||
        (Array.isArray(np) && np.length ? String(np[0]) : undefined) ||
        (Array.isArray(np2) && np2.length ? String(np2[0]) : undefined) ||
        "Nie udało się zresetować hasła. Spróbuj ponownie.";

      setResetError(String(msg));
    } finally {
      setResetLoading(false);
    }
  };

  const busy = loading || resetLoading || actionLoading;

  const hasActiveFilters = Boolean(search.trim()) || isActiveFilter !== "ALL" || serviceIdFilter !== "";
  const emptyInfo = useMemo(() => {
    if (loading) return null;
    if (rows.length) return null;
    if (hasActiveFilters) return "Brak wyników dla podanych filtrów. Zmień filtry lub je wyczyść.";
    return "Brak pracowników. Dodaj pierwszego pracownika, aby zarządzać grafikiem i wizytami.";
  }, [loading, rows.length, hasActiveFilters]);

  const columns: GridColDef<Employee>[] = [
    {
      field: "employee_number",
      headerName: "Nr",
      minWidth: 90,
      flex: 0.45,
      valueGetter: (_v, row) => row.employee_number || "—",
      sortable: true,
    },
    {
      field: "full_name",
      headerName: "Pracownik",
      minWidth: 170,
      flex: 1.1,
      sortable: false,
      renderCell: (params) => (
        <Stack spacing={0.25} sx={{ py: 0.5, minWidth: 0 }}>
          <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>
            {`${params.row.first_name ?? ""} ${params.row.last_name ?? ""}`.trim()}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap>
            {params.row.phone || "—"}
          </Typography>
        </Stack>
      ),
    },
    {
      field: "contact",
      headerName: "Kontakt",
      minWidth: 170,
      flex: 1.05,
      sortable: false,
      valueGetter: (_v, row) => `${row.user_username || ""} ${row.user_email || ""}`.trim(),
      renderCell: (params) => (
        <Stack spacing={0.25} sx={{ py: 0.5, minWidth: 0 }}>
          <Typography variant="body2" noWrap>
            {params.row.user_username || "—"}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap>
            {params.row.user_email || "—"}
          </Typography>
        </Stack>
      ),
    },
    {
      field: "is_active",
      headerName: "Status",
      minWidth: 110,
      flex: 0.6,
      sortable: false,
      renderCell: (params) =>
        params.row.is_active ? <Chip label="Aktywny" color="success" size="small" /> : <Chip label="Nieaktywny" size="small" />,
    },
    {
      field: "appointments_count",
      headerName: "Wizyty",
      minWidth: 80,
      flex: 0.5,
      valueGetter: (_v, row) => row.appointments_count ?? 0,
      sortable: false,
    },
    {
      field: "completed_appointments_count",
      headerName: "Zakończone",
      minWidth: 105,
      flex: 0.7,
      valueGetter: (_v, row) => row.completed_appointments_count ?? 0,
      sortable: false,
    },
    {
      field: "revenue_completed_total",
      headerName: "Przychód",
      minWidth: 105,
      flex: 0.7,
      valueGetter: (_v, row) => formatPLN(row.revenue_completed_total ?? "0"),
      sortable: false,
    },
    {
      field: "skills",
      headerName: "Usługi",
      minWidth: 150,
      flex: 0.95,
      sortable: false,
      renderCell: (params) => {
        const list = params.row.skills || [];
        if (!list.length) return "—";
        return (
          <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", py: 0.5 }}>
            {list.slice(0, 2).map((s) => (
              <Chip key={s.id} label={s.name} size="small" />
            ))}
            {list.length > 2 && <Chip label={`+${list.length - 2}`} size="small" variant="outlined" />}
          </Box>
        );
      },
    },
    {
      field: "actions",
      headerName: "Akcje",
      minWidth: 280,
      flex: 1.05,
      sortable: false,
      filterable: false,
      align: "right",
      headerAlign: "right",
      renderCell: (params) => (
        <Box sx={{ display: "flex", justifyContent: "flex-end", width: "100%" }}>
          <ButtonGroup
            variant="text"
            size="small"
            aria-label="Akcje pracownika"
            disabled={busy}
            sx={{ "& .MuiButton-root": { whiteSpace: "nowrap", px: 1, minWidth: "auto" } }}
          >
            <Button onClick={() => openResetDialog(params.row)} startIcon={<KeyIcon fontSize="small" />}>
              Hasło
            </Button>
            <Button onClick={() => openEdit(params.row)} startIcon={<EditIcon fontSize="small" />} color="primary">
              Edytuj
            </Button>
            <Button onClick={() => setConfirmDelete(params.row)} startIcon={<DeleteIcon fontSize="small" />} color="error">
              Usuń
            </Button>
          </ButtonGroup>
        </Box>
      ),
    },
  ];

  const columnVisibilityModel = useMemo<GridColumnVisibilityModel>(() => {
    if (isDownSm) return { revenue_completed_total: false, completed_appointments_count: false, skills: false } as GridColumnVisibilityModel;
    if (isDownMd) return { skills: false } as GridColumnVisibilityModel;
    return {} as GridColumnVisibilityModel;
  }, [isDownMd, isDownSm]);

  const ordering = sortModelToOrdering(sortModel) || "-created_at";
  const orderingLabel = ORDERING_OPTIONS.find((o) => o.value === ordering)?.label ?? ordering;

  return (
    <Stack spacing={2}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: { xs: "stretch", md: "flex-start" }, gap: 2, flexWrap: "wrap" }}>
        <Box sx={{ minWidth: 240 }}>
          <Typography variant="h5" sx={{ fontWeight: 800 }}>
            Pracownicy
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Łącznie: {employeesData?.count ?? "—"} • Strona: {page} • Sortowanie: {orderingLabel}
          </Typography>
        </Box>

        <Stack direction="row" spacing={1} alignItems="center">
          <Tooltip title="Odśwież">
            <span>
              <IconButton onClick={() => loadAll()} disabled={busy} aria-label="Odśwież listę">
                <RefreshIcon />
              </IconButton>
            </span>
          </Tooltip>

          <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate} disabled={busy}>
            Dodaj pracownika
          </Button>
        </Stack>
      </Box>

      {pageError && (
        <Alert severity={publicDataWarning ? "warning" : "error"} onClose={() => setPageError(null)}>
          {pageError}
        </Alert>
      )}

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ xs: "stretch", md: "center" }}>
          <TextField
            label="Szukaj"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nr, imię, nazwisko, login, e-mail…"
            disabled={busy}
            fullWidth
          />

          <FormControl sx={{ minWidth: 220 }} disabled={busy}>
            <InputLabel id="is-active-label">Status</InputLabel>
            <Select
              labelId="is-active-label"
              value={isActiveFilter}
              label="Status"
              onChange={(e) => setIsActiveFilter(e.target.value as "ALL" | "ACTIVE" | "INACTIVE")}
            >
              <MenuItem value="ALL">Wszystkie</MenuItem>
              <MenuItem value="ACTIVE">Tylko aktywni</MenuItem>
              <MenuItem value="INACTIVE">Tylko nieaktywni</MenuItem>
            </Select>
          </FormControl>

          <FormControl sx={{ minWidth: 260 }} disabled={busy}>
            <InputLabel id="service-filter-label">Usługa</InputLabel>
            <Select
              labelId="service-filter-label"
              value={serviceIdFilter}
              label="Usługa"
              onChange={(e) => setServiceIdFilter(e.target.value === "" ? "" : Number(e.target.value))}
            >
              <MenuItem value="">Wszystkie</MenuItem>
              {services.map((s) => (
                <MenuItem key={s.id} value={s.id}>
                  {s.name} ({formatPLN(s.price)})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ xs: "stretch", sm: "center" }}>
          <Stack direction="row" spacing={1}>
            <Button disabled={!canPrev} variant="outlined" onClick={() => setPage((p) => Math.max(1, p - 1))}>
              Poprzednia
            </Button>
            <Button disabled={!canNext} variant="contained" onClick={() => setPage((p) => p + 1)}>
              Następna
            </Button>
          </Stack>
          <Box sx={{ flex: 1 }} />
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            {loading ? "Odświeżanie…" : `Wyświetlono: ${rows.length}`}
          </Typography>
        </Stack>
      </Paper>

      <Card>
        <CardContent>
          {loading ? <LinearProgress sx={{ mb: 2 }} /> : null}

          {emptyInfo ? (
            <Alert severity="info" sx={{ mb: 2 }}>
              {emptyInfo}
            </Alert>
          ) : null}

          <Box sx={{ height: "calc(100vh - 420px)", minHeight: 420, width: "100%" }}>
            <DataGrid
              rows={rows}
              columns={columns}
              getRowId={(r) => r.id}
              disableRowSelectionOnClick
              sortingMode="server"
              sortModel={sortModel}
              onSortModelChange={(model) => setSortModel(model)}
              paginationMode="server"
              rowCount={employeesData?.count ?? 0}
              paginationModel={{ page: page - 1, pageSize: 20 }}
              onPaginationModelChange={(model) => setPage(model.page + 1)}
              loading={loading}
              hideFooter
              columnVisibilityModel={columnVisibilityModel}
              sx={{ "& .MuiDataGrid-columnHeaders": { borderBottomColor: "divider" }, "& .MuiDataGrid-cell": { alignItems: "center" } }}
              localeText={{
                noRowsLabel: "Brak danych.",
                noResultsOverlayLabel: "Brak wyników.",
              }}
            />
          </Box>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onClose={busy ? undefined : closeDialog} fullWidth maxWidth="sm">
        <DialogTitle>{isEdit ? "Edytuj pracownika" : "Dodaj pracownika"}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            {formError && (
              <Alert severity="error" onClose={() => setFormError(null)}>
                {formError}
              </Alert>
            )}

            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                label="Imię"
                value={form.first_name}
                onChange={(e) => setForm((p) => ({ ...p, first_name: e.target.value }))}
                fullWidth
                disabled={busy}
                error={Boolean(formFieldErrors.first_name)}
                helperText={formFieldErrors.first_name || " "}
              />
              <TextField
                label="Nazwisko"
                value={form.last_name}
                onChange={(e) => setForm((p) => ({ ...p, last_name: e.target.value }))}
                fullWidth
                disabled={busy}
                error={Boolean(formFieldErrors.last_name)}
                helperText={formFieldErrors.last_name || " "}
              />
            </Stack>

            <TextField
              label="Telefon"
              value={form.phone}
              onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
              fullWidth
              placeholder="+48123123123"
              disabled={busy}
              error={Boolean(formFieldErrors.phone)}
              helperText={formFieldErrors.phone || " "}
            />

            {!isEdit && (
              <TextField
                label="Email (dla konta)"
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                fullWidth
                required
                disabled={busy}
                error={Boolean(formFieldErrors.email)}
                helperText={formFieldErrors.email || " "}
              />
            )}

            {!isEdit && (
              <TextField
                label="Hasło"
                type="password"
                value={form.password}
                onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                fullWidth
                required
                disabled={busy}
                error={Boolean(formFieldErrors.password)}
                helperText={formFieldErrors.password || "Minimum 8 znaków"}
                autoComplete="new-password"
              />
            )}

            <FormControl fullWidth disabled={busy} error={Boolean(formFieldErrors.skill_ids)}>
              <InputLabel id="skills-label">Usługi</InputLabel>
              <Select
                labelId="skills-label"
                multiple
                value={form.skill_ids}
                onChange={(e) => setForm((p) => ({ ...p, skill_ids: e.target.value as number[] }))}
                input={<OutlinedInput label="Usługi" />}
                renderValue={(selected) => (selected as number[]).map((id) => serviceMap.get(id)?.name || `#${id}`).join(", ")}
              >
                {services.map((s) => (
                  <MenuItem key={s.id} value={s.id}>
                    <Checkbox checked={form.skill_ids.includes(s.id)} />
                    <ListItemText primary={s.name} secondary={s.category || ""} />
                  </MenuItem>
                ))}
              </Select>
              <Typography variant="caption" color={formFieldErrors.skill_ids ? "error" : "text.secondary"} sx={{ mt: 0.5 }}>
                {formFieldErrors.skill_ids || " "}
              </Typography>
            </FormControl>

            <FormControl fullWidth disabled={busy}>
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
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog} disabled={busy}>
            Anuluj
          </Button>
          <Button
            onClick={handleSave}
            variant="contained"
            disabled={busy}
            startIcon={actionLoading ? <CircularProgress size={18} /> : undefined}
          >
            Zapisz
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={resetDialogOpen} onClose={resetLoading ? undefined : closeResetDialog} fullWidth maxWidth="sm">
        <DialogTitle>Reset hasła pracownika</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            {resetError && (
              <Alert severity="error" onClose={() => setResetError(null)}>
                {resetError}
              </Alert>
            )}

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
              disabled={resetLoading}
              autoComplete="new-password"
            />
            <TextField
              label="Powtórz nowe hasło"
              type="password"
              value={resetPass2}
              onChange={(e) => setResetPass2(e.target.value)}
              fullWidth
              disabled={resetLoading}
              autoComplete="new-password"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeResetDialog} disabled={resetLoading}>
            Anuluj
          </Button>
          <Button
            onClick={handleResetPassword}
            variant="contained"
            disabled={resetLoading}
            startIcon={resetLoading ? <CircularProgress size={16} /> : undefined}
          >
            Resetuj
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(confirmDelete)} onClose={busy ? undefined : () => setConfirmDelete(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Usuń pracownika</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2">
            Czy na pewno chcesz usunąć pracownika{" "}
            <b>
              {confirmDelete?.first_name} {confirmDelete?.last_name}
            </b>
            ?
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Tej operacji nie można cofnąć. Jeśli są powiązane wizyty, usunięcie może być zablokowane.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDelete(null)} disabled={busy}>
            Anuluj
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={handleDelete}
            disabled={busy}
            startIcon={actionLoading ? <CircularProgress size={18} /> : undefined}
          >
            Usuń
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snack.open}
        autoHideDuration={3200}
        onClose={() => setSnack((p) => ({ ...p, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert onClose={() => setSnack((p) => ({ ...p, open: false }))} severity={snack.severity} sx={{ width: "100%" }}>
          {snack.msg}
        </Alert>
      </Snackbar>
    </Stack>
  );
}
