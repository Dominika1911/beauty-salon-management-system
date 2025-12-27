import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  ButtonGroup,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  InputLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { Add, Delete, Edit, Visibility } from "@mui/icons-material";
import KeyIcon from "@mui/icons-material/Key";
import { Field, Form, Formik, type FormikHelpers } from "formik";
import * as Yup from "yup";

import { clientsApi } from "@/api/clients";
import { usersApi } from "@/api/users";
import type { Client, DRFPaginated } from "@/types";
import { parseDrfError } from "@/utils/drfErrors";

const ORDERING_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "-created_at", label: "Najnowsi" },
  { value: "created_at", label: "Najstarsi" },
  { value: "last_name", label: "Nazwisko (A→Z)" },
  { value: "-last_name", label: "Nazwisko (Z→A)" },
  { value: "client_number", label: "Nr klienta (rosnąco)" },
  { value: "-client_number", label: "Nr klienta (malejąco)" },
  { value: "id", label: "ID (rosnąco)" },
  { value: "-id", label: "ID (malejąco)" },
];

interface ClientFormData {
  first_name: string;
  last_name: string;
  phone: string;
  email: string; // UI string; wysyłamy "" -> null
  password: string; // Formik initialValues zawsze ma string (przy edycji zostaje "")
  internal_notes: string;
  is_active: boolean;
}

const BaseClientSchema = Yup.object().shape({
  first_name: Yup.string().min(2, "Imię musi mieć co najmniej 2 znaki").required("Imię jest wymagane"),
  last_name: Yup.string().min(2, "Nazwisko musi mieć co najmniej 2 znaki").required("Nazwisko jest wymagane"),
  phone: Yup.string()
    .matches(/^\+?\d{9,15}$/, "Telefon musi mieć 9–15 cyfr (może zaczynać się od +).")
    .notRequired(),
  email: Yup.string().email("Nieprawidłowy adres e-mail").notRequired(),
  internal_notes: Yup.string().max(1000, "Notatki mogą mieć maksymalnie 1000 znaków").notRequired(),
  is_active: Yup.boolean(),
});

const CreateClientSchema = BaseClientSchema.shape({
  password: Yup.string().min(8, "Hasło musi mieć co najmniej 8 znaków").required("Hasło jest wymagane"),
});

const EditClientSchema = BaseClientSchema.shape({
  password: Yup.string().notRequired(),
});

function firstFromDrf(v: unknown): string | null {
  if (!v) return null;
  if (typeof v === "string") return v;
  if (Array.isArray(v) && v.length) return String(v[0]);
  return null;
}

type SnackbarState = { open: boolean; msg: string; severity: "success" | "info" };

const ClientsPage: React.FC = () => {
  const [data, setData] = useState<DRFPaginated<Client> | null>(null);
  const [page, setPage] = useState(1);

  // backend params
  const [search, setSearch] = useState("");
  const [clientNumber, setClientNumber] = useState("");
  const [onlyActive, setOnlyActive] = useState(false);
  const [ordering, setOrdering] = useState<string>("-created_at");

  const [loading, setLoading] = useState(true);

  // komunikaty: lista vs formularz
  const [pageError, setPageError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [snack, setSnack] = useState<SnackbarState>({ open: false, msg: "", severity: "info" });

  // dialogs
  const [formOpen, setFormOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [viewOpen, setViewOpen] = useState(false);
  const [viewingClient, setViewingClient] = useState<Client | null>(null);

  const [resetOpen, setResetOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<Client | null>(null);
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [resetErr, setResetErr] = useState<string | null>(null);
  const [resetSaving, setResetSaving] = useState(false);

  const busy = loading || deleting || resetSaving;

  const hasActiveFilters =
    Boolean(search.trim()) || Boolean(clientNumber.trim()) || onlyActive || ordering !== "-created_at";

  useEffect(() => {
    setPage(1);
  }, [search, clientNumber, onlyActive, ordering]);

  const loadClients = useCallback(async () => {
    try {
      setLoading(true);
      setPageError(null);

      const res = await clientsApi.list({
        page,
        ordering,
        search: search.trim() || undefined,
        is_active: onlyActive ? true : undefined,
        client_number: clientNumber.trim() || undefined,
      });

      setData(res);
    } catch (err: unknown) {
      const parsed = parseDrfError(err);
      setPageError(parsed.message || "Nie udało się pobrać klientów. Spróbuj ponownie.");
      setData({ count: 0, next: null, previous: null, results: [] });
    } finally {
      setLoading(false);
    }
  }, [page, ordering, search, onlyActive, clientNumber]);

  useEffect(() => {
    void loadClients();
  }, [loadClients]);

  const clients = useMemo(() => data?.results ?? [], [data]);
  const canPrev = Boolean(data?.previous) && !loading;
  const canNext = Boolean(data?.next) && !loading;

  const openCreate = () => {
    setFormError(null);
    setEditingClient(null);
    setFormOpen(true);
  };

  const openEdit = (client: Client) => {
    setFormError(null);
    setEditingClient(client);
    setFormOpen(true);
  };

  const openView = (client: Client) => {
    setViewingClient(client);
    setViewOpen(true);
  };

  const openReset = (client: Client) => {
    setResetErr(null);
    setP1("");
    setP2("");
    setResetTarget(client);
    setResetOpen(true);
  };

  const openDelete = (client: Client) => {
    setPageError(null);
    setClientToDelete(client);
    setDeleteOpen(true);
  };

  const handleSubmit = async (values: ClientFormData, helpers: FormikHelpers<ClientFormData>) => {
    const { setErrors } = helpers;

    try {
      setFormError(null);

      const emailToSend: string | null = values.email.trim() ? values.email.trim() : null;
      const notesToSend: string = values.internal_notes.trim();

      if (!editingClient) {
        const payload: Parameters<typeof clientsApi.create>[0] = {
          first_name: values.first_name.trim(),
          last_name: values.last_name.trim(),
          phone: values.phone.trim() || undefined,
          email: emailToSend,
          internal_notes: notesToSend,
          password: values.password || "",
          is_active: values.is_active,
        };

        await clientsApi.create(payload);
        setSnack({ open: true, msg: "Utworzono klienta.", severity: "success" });
      } else {
        const payload: Parameters<typeof clientsApi.update>[1] = {
          first_name: values.first_name.trim(),
          last_name: values.last_name.trim(),
          phone: values.phone.trim() || undefined,
          email: emailToSend,
          internal_notes: notesToSend,
          is_active: values.is_active,
        };

        await clientsApi.update(editingClient.id, payload);
        setSnack({ open: true, msg: "Zapisano zmiany.", severity: "success" });
      }

      await loadClients();
      setFormOpen(false);
      setEditingClient(null);
    } catch (err: unknown) {
      const { message, fieldErrors } = parseDrfError(err);

      const d =
        typeof err === "object" && err !== null && "response" in err
          ? (err as { response?: { data?: unknown } }).response?.data
          : undefined;

      // 1) błędy pól -> helperText
      const nextFieldErrors: Record<string, string> = { ...(fieldErrors || {}) };

      // UX: czasem backend wrzuca komunikat hasła do non_field_errors przy CREATE
      if (!editingClient && !nextFieldErrors.password) {
        const nonFieldErrors =
          d && typeof d === "object" && d !== null && "non_field_errors" in d
            ? (d as Record<string, unknown>).non_field_errors
            : undefined;

        const nfe = firstFromDrf(nonFieldErrors);
        if (nfe) nextFieldErrors.password = nfe;
      }

      if (Object.keys(nextFieldErrors).length) setErrors(nextFieldErrors);

      // 2) globalny komunikat
      if (message) setFormError(message);
      else if (Object.keys(nextFieldErrors).length)
        setFormError("Nie udało się zapisać — popraw zaznaczone pola i spróbuj ponownie.");
      else setFormError("Nie udało się zapisać. Spróbuj ponownie.");
    }
  };

  const handleDelete = async () => {
    if (!clientToDelete) return;
    try {
      setDeleting(true);
      setPageError(null);
      await clientsApi.delete(clientToDelete.id);
      setSnack({ open: true, msg: "Usunięto klienta.", severity: "success" });
      await loadClients();
      setDeleteOpen(false);
      setClientToDelete(null);
    } catch (err: unknown) {
      const parsed = parseDrfError(err);
      setPageError(parsed.message || "Nie udało się usunąć klienta. Spróbuj ponownie.");
    } finally {
      setDeleting(false);
    }
  };

  const handleResetPassword = async () => {
    if (resetTarget?.user_id == null) return;

    setResetErr(null);

    if (p1.length < 8) {
      setResetErr("Hasło musi mieć co najmniej 8 znaków.");
      return;
    }
    if (p1 !== p2) {
      setResetErr("Hasła nie są identyczne.");
      return;
    }

    try {
      setResetSaving(true);
      await usersApi.resetPassword(resetTarget.user_id, {
        new_password: p1,
        new_password2: p2,
      });
      setSnack({ open: true, msg: "Zresetowano hasło klienta.", severity: "success" });
      setResetOpen(false);
      await loadClients();
    } catch (err: unknown) {
      const parsed = parseDrfError(err);

      const d =
        typeof err === "object" && err !== null && "response" in err
          ? (err as { response?: { data?: unknown } }).response?.data
          : undefined;

      const obj = d && typeof d === "object" && d !== null ? (d as Record<string, unknown>) : undefined;

      setResetErr(
        parsed.message ||
          firstFromDrf(obj?.new_password) ||
          firstFromDrf(obj?.new_password2) ||
          "Nie udało się zresetować hasła. Spróbuj ponownie."
      );
    } finally {
      setResetSaving(false);
    }
  };

  if (loading && !data) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 10 }}>
        <CircularProgress />
      </Box>
    );
  }

  const emptyInfo =
    !loading && clients.length === 0
      ? hasActiveFilters
        ? "Brak wyników dla podanych filtrów."
        : "Brak klientów. Dodaj pierwszego klienta."
      : null;

  return (
    <Stack spacing={2}>
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: { xs: "stretch", md: "flex-start" },
          gap: 2,
          flexWrap: "wrap",
        }}
      >
        <Box sx={{ minWidth: 240 }}>
          <Typography variant="h5" sx={{ fontWeight: 800 }}>
            Zarządzanie klientami
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Łącznie: {data?.count ?? "—"} • Strona: {page} • Sortowanie:{" "}
            {ORDERING_OPTIONS.find((o) => o.value === ordering)?.label ?? ordering}
          </Typography>
        </Box>

        <Button variant="contained" startIcon={<Add />} onClick={openCreate} disabled={busy}>
          Dodaj klienta
        </Button>
      </Box>

      {pageError && (
        <Alert severity="error" onClose={() => setPageError(null)}>
          {pageError}
        </Alert>
      )}

      {/* Filters */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ xs: "stretch", md: "center" }}>
          <TextField
            label="Szukaj"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nr klienta, imię, nazwisko, e-mail, telefon…"
            disabled={busy}
            fullWidth
          />
          <TextField
            label="Nr klienta"
            value={clientNumber}
            onChange={(e) => setClientNumber(e.target.value)}
            placeholder="np. 00000001"
            disabled={busy}
            fullWidth
          />
          <FormControl sx={{ minWidth: 220 }} disabled={busy}>
            <InputLabel id="ordering-label">Sortowanie</InputLabel>
            <Select
              labelId="ordering-label"
              value={ordering}
              label="Sortowanie"
              onChange={(e) => setOrdering(String(e.target.value))}
            >
              {ORDERING_OPTIONS.map((o) => (
                <MenuItem key={o.value} value={o.value}>
                  {o.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControlLabel
            control={<Switch checked={onlyActive} onChange={(e) => setOnlyActive(e.target.checked)} disabled={busy} />}
            label="Tylko aktywni"
            sx={{ ml: { md: "auto" } }}
          />
        </Stack>
      </Paper>

      {/* Pagination */}
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
            {loading ? "Odświeżanie…" : `Wyświetlono: ${clients.length}`}
          </Typography>
        </Stack>
      </Paper>

      {/* Table */}
      <Paper variant="outlined" sx={{ overflow: "hidden" }}>
        {loading ? <LinearProgress /> : null}

        <TableContainer sx={{ overflowX: "auto" }}>
          <Table aria-label="Lista klientów">
            <TableHead>
              <TableRow>
                <TableCell>Klient</TableCell>
                <TableCell>Kontakt</TableCell>
                <TableCell align="center">Wizyty</TableCell>
                <TableCell align="center">Status</TableCell>
                <TableCell align="right">Akcje</TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {!loading &&
                clients.map((c) => (
                  <TableRow key={c.id} hover>
                    <TableCell sx={{ minWidth: 220 }}>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {c.first_name} {c.last_name}
                      </Typography>
                      <Typography variant="caption" sx={{ color: "text.secondary" }}>
                        {c.client_number}
                      </Typography>
                    </TableCell>

                    <TableCell sx={{ minWidth: 220 }}>
                      <Typography variant="body2">{c.email || "—"}</Typography>
                      <Typography variant="body2" sx={{ color: "text.secondary" }}>
                        {c.phone || "—"}
                      </Typography>
                    </TableCell>

                    <TableCell align="center">
                      <Chip label={c.appointments_count} size="small" variant="outlined" color="primary" />
                    </TableCell>

                    <TableCell align="center">
                      <Chip
                        label={c.is_active ? "Aktywny" : "Nieaktywny"}
                        color={c.is_active ? "success" : "default"}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>

                    <TableCell align="right">
                      <Box sx={{ display: "flex", justifyContent: "flex-end", flexWrap: "wrap", gap: 1 }}>
                        <ButtonGroup variant="text" size="small" aria-label="Akcje klienta" disabled={busy}>
                          <Button onClick={() => openView(c)} startIcon={<Visibility fontSize="small" />}>
                            Podgląd
                          </Button>
                          <Button onClick={() => openEdit(c)} startIcon={<Edit fontSize="small" />} color="primary">
                            Edytuj
                          </Button>

                          <Tooltip
                            title={
                              c.user_id == null
                                ? "Ten klient nie ma konta użytkownika — reset hasła jest niedostępny."
                                : "Ustaw nowe hasło dla konta klienta."
                            }
                            arrow
                          >
                            <span>
                              <Button
                                onClick={() => openReset(c)}
                                startIcon={<KeyIcon fontSize="small" />}
                                disabled={c.user_id == null || busy}
                              >
                                Hasło
                              </Button>
                            </span>
                          </Tooltip>

                          <Button onClick={() => openDelete(c)} startIcon={<Delete fontSize="small" />} color="error">
                            Usuń
                          </Button>
                        </ButtonGroup>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}

              {!loading && clients.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5}>
                    <Box sx={{ py: 2.5 }}>
                      <Alert severity="info">{emptyInfo}</Alert>
                    </Box>
                  </TableCell>
                </TableRow>
              )}

              {loading && clients.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5}>
                    <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                      <CircularProgress size={28} />
                    </Box>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Dialogs */}
      <ClientFormDialog
        open={formOpen}
        editingClient={editingClient}
        onClose={() => {
          if (busy) return;
          setFormOpen(false);
          setEditingClient(null);
          setFormError(null);
        }}
        onSubmit={handleSubmit}
        formError={formError}
        clearFormError={() => setFormError(null)}
      />

      <DeleteClientDialog
        open={deleteOpen}
        client={clientToDelete}
        deleting={deleting}
        onClose={() => {
          if (deleting) return;
          setDeleteOpen(false);
        }}
        onConfirm={handleDelete}
      />

      <ClientViewDialog open={viewOpen} client={viewingClient} onClose={() => setViewOpen(false)} />

      <ResetPasswordDialog
        open={resetOpen}
        client={resetTarget}
        p1={p1}
        p2={p2}
        setP1={setP1}
        setP2={setP2}
        error={resetErr}
        saving={resetSaving}
        onClose={() => {
          if (resetSaving) return;
          setResetOpen(false);
        }}
        onConfirm={handleResetPassword}
      />

      <Snackbar
        open={snack.open}
        autoHideDuration={3200}
        onClose={() => setSnack((p) => ({ ...p, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={() => setSnack((p) => ({ ...p, open: false }))}
          severity={snack.severity}
          sx={{ width: "100%" }}
        >
          {snack.msg}
        </Alert>
      </Snackbar>
    </Stack>
  );
};

export default ClientsPage;

/* -------------------- Dialog components (same file) -------------------- */

function ClientFormDialog(props: {
  open: boolean;
  editingClient: Client | null;
  onClose: () => void;
  onSubmit: (values: ClientFormData, helpers: FormikHelpers<ClientFormData>) => Promise<void>;
  formError: string | null;
  clearFormError: () => void;
}) {
  const { open, editingClient, onClose, onSubmit, formError, clearFormError } = props;

  const validationSchema = editingClient ? EditClientSchema : CreateClientSchema;

  return (
    <Formik<ClientFormData>
      enableReinitialize
      initialValues={{
        first_name: editingClient?.first_name || "",
        last_name: editingClient?.last_name || "",
        phone: editingClient?.phone || "",
        email: editingClient?.email ?? "",
        password: "",
        internal_notes: editingClient?.internal_notes ?? "",
        is_active: editingClient?.is_active ?? true,
      }}
      validationSchema={validationSchema}
      onSubmit={onSubmit}
    >
      {({ errors, touched, values, setFieldValue, isSubmitting }) => {
        const helper = <T extends keyof ClientFormData>(name: T) => {
          const isTouched = Boolean(touched[name]);
          const err = errors[name];
          return isTouched && typeof err === "string" ? err : " ";
        };

        const hasErr = <T extends keyof ClientFormData>(name: T) => Boolean(touched[name] && errors[name]);

        return (
          <Dialog
            open={open}
            onClose={
              isSubmitting
                ? undefined
                : () => {
                    clearFormError();
                    onClose();
                  }
            }
            disableEscapeKeyDown={isSubmitting}
            maxWidth="sm"
            fullWidth
            PaperProps={{ variant: "outlined" }}
          >
            <DialogTitle>{editingClient ? "Edytuj klienta" : "Nowy klient"}</DialogTitle>

            <Form>
              <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2 }} dividers>
                {formError && (
                  <Alert severity="error" onClose={clearFormError}>
                    {formError}
                  </Alert>
                )}

                <Field
                  as={TextField}
                  name="first_name"
                  label="Imię"
                  error={hasErr("first_name")}
                  helperText={helper("first_name")}
                  disabled={isSubmitting}
                />
                <Field
                  as={TextField}
                  name="last_name"
                  label="Nazwisko"
                  error={hasErr("last_name")}
                  helperText={helper("last_name")}
                  disabled={isSubmitting}
                />
                <Field
                  as={TextField}
                  name="phone"
                  label="Telefon"
                  error={hasErr("phone")}
                  helperText={helper("phone")}
                  disabled={isSubmitting}
                />
                <Field
                  as={TextField}
                  name="email"
                  label="E-mail (opcjonalnie)"
                  error={hasErr("email")}
                  helperText={helper("email")}
                  disabled={isSubmitting}
                />

                {!editingClient && (
                  <Field
                    as={TextField}
                    name="password"
                    label="Hasło"
                    type="password"
                    error={hasErr("password")}
                    helperText={helper("password")}
                    disabled={isSubmitting}
                  />
                )}

                <Field
                  as={TextField}
                  name="internal_notes"
                  label="Notatki"
                  multiline
                  rows={3}
                  error={hasErr("internal_notes")}
                  helperText={helper("internal_notes")}
                  disabled={isSubmitting}
                />

                <FormControlLabel
                  control={
                    <Switch
                      checked={values.is_active}
                      onChange={(e) => setFieldValue("is_active", e.target.checked)}
                      disabled={isSubmitting}
                    />
                  }
                  label="Aktywny"
                />
              </DialogContent>

              <DialogActions sx={{ px: 3, pb: 2 }}>
                <Button
                  onClick={() => {
                    clearFormError();
                    onClose();
                  }}
                  disabled={isSubmitting}
                >
                  Anuluj
                </Button>
                <Button type="submit" variant="contained" disabled={isSubmitting}>
                  Zapisz
                </Button>
              </DialogActions>
            </Form>
          </Dialog>
        );
      }}
    </Formik>
  );
}

function DeleteClientDialog(props: {
  open: boolean;
  client: Client | null;
  deleting: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const { open, client, deleting, onClose, onConfirm } = props;

  return (
    <Dialog open={open} onClose={onClose} PaperProps={{ variant: "outlined" }}>
      <DialogTitle>Usunąć klienta?</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          {client?.first_name} {client?.last_name} zostanie trwale usunięty z bazy.
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={deleting}>
          Anuluj
        </Button>
        <Button
          onClick={() => void onConfirm()}
          color="error"
          variant="contained"
          disabled={deleting}
          startIcon={deleting ? <CircularProgress size={16} /> : undefined}
        >
          Usuń
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function ClientViewDialog(props: { open: boolean; client: Client | null; onClose: () => void }) {
  const { open, client, onClose } = props;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ variant: "outlined" }}>
      <DialogTitle>Karta klienta</DialogTitle>
      <DialogContent dividers>
        {client && (
          <Stack spacing={1.25} sx={{ py: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>
              {client.first_name} {client.last_name}
            </Typography>
            <Typography variant="body2">
              <strong>Nr klienta:</strong> {client.client_number}
            </Typography>
            <Typography variant="body2">
              <strong>E-mail:</strong> {client.email || "—"}
            </Typography>
            <Typography variant="body2">
              <strong>Telefon:</strong> {client.phone || "—"}
            </Typography>
            <Typography variant="body2">
              <strong>Wizyty:</strong> {client.appointments_count}
            </Typography>
            <Typography variant="body2">
              <strong>Notatki:</strong> {client.internal_notes || "Brak"}
            </Typography>
            <Typography variant="body2">
              <strong>Dołączył:</strong> {new Date(client.created_at).toLocaleDateString("pl-PL")}
            </Typography>
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Zamknij</Button>
      </DialogActions>
    </Dialog>
  );
}

function ResetPasswordDialog(props: {
  open: boolean;
  client: Client | null;
  p1: string;
  p2: string;
  setP1: (v: string) => void;
  setP2: (v: string) => void;
  error: string | null;
  saving: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const { open, client, p1, p2, setP1, setP2, error, saving, onClose, onConfirm } = props;

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="xs" fullWidth PaperProps={{ variant: "outlined" }}>
      <DialogTitle>Reset hasła klienta</DialogTitle>
      <DialogContent dividers>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {client?.user_id == null && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Ten klient nie ma konta użytkownika — reset hasła jest niedostępny.
          </Alert>
        )}

        <TextField
          label="Nowe hasło"
          type="password"
          margin="dense"
          value={p1}
          onChange={(e) => setP1(e.target.value)}
          disabled={client?.user_id == null || saving}
          fullWidth
          helperText="Minimum 8 znaków"
        />
        <TextField
          label="Powtórz nowe hasło"
          type="password"
          margin="dense"
          value={p2}
          onChange={(e) => setP2(e.target.value)}
          disabled={client?.user_id == null || saving}
          fullWidth
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={saving}>
          Anuluj
        </Button>
        <Button
          variant="contained"
          disabled={client?.user_id == null || saving}
          onClick={() => void onConfirm()}
          startIcon={saving ? <CircularProgress size={16} /> : undefined}
        >
          Resetuj
        </Button>
      </DialogActions>
    </Dialog>
  );
}
