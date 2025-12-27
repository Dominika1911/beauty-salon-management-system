import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Alert,
  CircularProgress,
  FormControlLabel,
  Switch,
  Stack,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from "@mui/material";
import { Add, Edit, Delete, Visibility } from "@mui/icons-material";
import KeyIcon from "@mui/icons-material/Key";
import { Formik, Form, Field } from "formik";
import * as Yup from "yup";

import { clientsApi } from "@/api/clients";
import { usersApi } from "@/api/users";
import type { Client, DRFPaginated } from "@/types";

/**
 * Backend (ClientViewSet):
 * - filterset_fields = ["is_active", "client_number"]
 * - search_fields = ["client_number", "first_name", "last_name", "email", "phone"]
 * - ordering_fields = ["id", "client_number", "last_name", "created_at"]
 */

const ORDERING_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "-created_at", label: "Najnowsi (created_at desc)" },
  { value: "created_at", label: "Najstarsi (created_at asc)" },
  { value: "last_name", label: "Nazwisko (A→Z)" },
  { value: "-last_name", label: "Nazwisko (Z→A)" },
  { value: "client_number", label: "Nr klienta (A→Z)" },
  { value: "-client_number", label: "Nr klienta (Z→A)" },
  { value: "id", label: "ID (rosnąco)" },
  { value: "-id", label: "ID (malejąco)" },
];

/**
 * ✅ Dopasowanie do backendu:
 * - email: w serializerze może być null/blank, ale przy CREATE klucz "email" musi istnieć (api/clients.ts)
 * - phone: backend dopuszcza blank
 * - password: wymagane tylko przy CREATE (tu: tylko dla nowego klienta)
 */
const ClientSchema = Yup.object().shape({
  first_name: Yup.string()
    .min(2, "Imię musi mieć co najmniej 2 znaki")
    .required("Imię jest wymagane"),
  last_name: Yup.string()
    .min(2, "Nazwisko musi mieć co najmniej 2 znaki")
    .required("Nazwisko jest wymagane"),
  phone: Yup.string()
    .matches(/^[0-9+\s-()]*$/, "Nieprawidłowy format telefonu")
    .notRequired(),
  email: Yup.string().email("Nieprawidłowy adres email").notRequired(),
  password: Yup.string().when("$isNew", {
    is: true,
    then: (schema) =>
      schema.min(8, "Hasło musi mieć co najmniej 8 znaków").required("Hasło jest wymagane"),
    otherwise: (schema) => schema.notRequired(),
  }),
  internal_notes: Yup.string()
    .max(1000, "Notatki mogą mieć maksymalnie 1000 znaków")
    .notRequired(),
  is_active: Yup.boolean(),
});

interface ClientFormData {
  first_name: string;
  last_name: string;
  phone: string;
  email: string; // UI string; do API mapujemy "" -> null
  password?: string; // używane tylko przy CREATE
  internal_notes: string; // UI string; do API wysyłamy string ("" jest OK)
  is_active: boolean;
}

function getErrorMessage(err: unknown): string {
  const e = err as any;
  return e?.response?.data?.detail || e?.response?.data?.message || e?.message || "Wystąpił błąd.";
}

const ClientsPage: React.FC = () => {
  const [data, setData] = useState<DRFPaginated<Client> | null>(null);
  const [page, setPage] = useState(1);

  // backend params
  const [search, setSearch] = useState("");
  const [clientNumber, setClientNumber] = useState(""); // backend filter: client_number
  const [onlyActive, setOnlyActive] = useState<boolean>(false);
  const [ordering, setOrdering] = useState<string>("-created_at"); // backend ordering

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);

  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewingClient, setViewingClient] = useState<Client | null>(null);

  // ✅ Reset hasła (u Ciebie w typach: user_id)
  const [resetOpen, setResetOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<Client | null>(null);
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [resetErr, setResetErr] = useState<string | null>(null);
  const [resetSaving, setResetSaving] = useState(false);

  // reset page when backend params change
  useEffect(() => {
    setPage(1);
  }, [search, clientNumber, onlyActive, ordering]);

  const loadClients = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await clientsApi.list({
        page,
        ordering,
        search: search.trim() || undefined,
        is_active: onlyActive ? true : undefined,
        client_number: clientNumber.trim() || undefined,
      });

      setData(res);
    } catch (err) {
      setError(getErrorMessage(err));
      setData({
        count: 0,
        next: null,
        previous: null,
        results: [],
      });
    } finally {
      setLoading(false);
    }
  }, [page, search, clientNumber, onlyActive, ordering]);

  useEffect(() => {
    void loadClients();
  }, [loadClients]);

  const clients = useMemo(() => data?.results ?? [], [data]);

  const handleOpenDialog = (client?: Client) => {
    setEditingClient(client || null);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingClient(null);
  };

  const handleSubmit = async (values: ClientFormData, { setErrors }: any) => {
    try {
      setError(null);

      const emailToSend: string | null = values.email.trim() ? values.email.trim() : null;
      const notesToSend: string = values.internal_notes.trim(); // ✅ wysyłamy string ("" jest OK)

      if (!editingClient) {
        // ✅ create: backend wymaga klucza email + password
        await clientsApi.create({
          first_name: values.first_name.trim(),
          last_name: values.last_name.trim(),
          phone: values.phone.trim() || undefined,
          email: emailToSend,
          internal_notes: notesToSend,
          password: values.password || "",
          is_active: values.is_active,
        });
      } else {
        // ✅ update: BEZ zmiany hasła (hasło tylko przez kluczyk)
        const payload: any = {
          first_name: values.first_name.trim(),
          last_name: values.last_name.trim(),
          phone: values.phone.trim() || undefined,
          email: emailToSend,
          internal_notes: notesToSend,
          is_active: values.is_active,
        };

        await clientsApi.update(editingClient.id, payload);
      }

      await loadClients();
      handleCloseDialog();
    } catch (err: any) {
      const backendErrors = err?.response?.data;

      if (backendErrors && typeof backendErrors === "object" && !Array.isArray(backendErrors)) {
        setErrors(backendErrors);
        if (backendErrors.detail) setError(String(backendErrors.detail));
      } else {
        setError("Nie udało się zapisać klienta.");
      }
    }
  };

  const handleDelete = async () => {
    if (!clientToDelete) return;

    try {
      setError(null);
      await clientsApi.delete(clientToDelete.id);
      await loadClients();
      setDeleteDialogOpen(false);
      setClientToDelete(null);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const canPrev = Boolean(data?.previous) && !loading;
  const canNext = Boolean(data?.next) && !loading;

  if (loading && !data) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 10 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 3, gap: 2 }}>
        <Box>
          <Typography variant="h4" fontWeight={700}>
            Zarządzanie klientami
          </Typography>
          <Typography color="textSecondary">
            Łącznie (backend): {data?.count ?? "—"} • Strona: {page} • ordering: {ordering}
          </Typography>
        </Box>

        <Box sx={{ display: "flex", gap: 2, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
          <TextField size="small" label="search (backend)" value={search} onChange={(e) => setSearch(e.target.value)} />

          <TextField
            size="small"
            label="client_number (backend)"
            value={clientNumber}
            onChange={(e) => setClientNumber(e.target.value)}
            placeholder="np. 00000001"
          />

          <FormControl size="small" sx={{ minWidth: 220 }}>
            <InputLabel id="ordering-label">ordering (backend)</InputLabel>
            <Select
              labelId="ordering-label"
              value={ordering}
              label="ordering (backend)"
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
            control={<Switch checked={onlyActive} onChange={(e) => setOnlyActive(e.target.checked)} />}
            label="Tylko aktywni"
          />

          <Button variant="contained" startIcon={<Add />} onClick={() => handleOpenDialog()}>
            Dodaj klienta
          </Button>
        </Box>
      </Box>

      {error && (
        <Box sx={{ mb: 2 }}>
          <Alert severity="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        </Box>
      )}

      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Button disabled={!canPrev} variant="outlined" onClick={() => setPage((p) => Math.max(1, p - 1))}>
            Poprzednia
          </Button>
          <Button disabled={!canNext} variant="contained" onClick={() => setPage((p) => p + 1)}>
            Następna
          </Button>
        </Stack>
      </Paper>

      <TableContainer component={Paper} sx={{ borderRadius: 2, boxShadow: 3 }}>
        <Table>
          <TableHead sx={{ bgcolor: "grey.100" }}>
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>Klient</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Kontakt</TableCell>
              <TableCell align="center" sx={{ fontWeight: 700 }}>
                Wizyty
              </TableCell>
              <TableCell align="center" sx={{ fontWeight: 700 }}>
                Status
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>
                Akcje
              </TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5}>
                  <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                    <CircularProgress />
                  </Box>
                </TableCell>
              </TableRow>
            ) : (
              clients.map((client) => (
                <TableRow key={client.id} hover>
                  <TableCell>
                    <Typography variant="body1" fontWeight={600}>
                      {client.first_name} {client.last_name}
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      {client.client_number}
                    </Typography>
                  </TableCell>

                  <TableCell>
                    <Typography variant="body2">{client.email || "—"}</Typography>
                    <Typography variant="body2" color="textSecondary">
                      {client.phone || "—"}
                    </Typography>
                  </TableCell>

                  <TableCell align="center">
                    <Chip label={client.appointments_count} size="small" variant="outlined" color="primary" />
                  </TableCell>

                  <TableCell align="center">
                    <Chip
                      label={client.is_active ? "Aktywny" : "Nieaktywny"}
                      color={client.is_active ? "success" : "default"}
                      size="small"
                    />
                  </TableCell>

                  <TableCell align="right">
                    <IconButton
                      onClick={() => {
                        setViewingClient(client);
                        setViewDialogOpen(true);
                      }}
                    >
                      <Visibility />
                    </IconButton>

                    <IconButton onClick={() => handleOpenDialog(client)} color="primary">
                      <Edit />
                    </IconButton>

                    <IconButton
                      onClick={() => {
                        setResetErr(null);
                        setP1("");
                        setP2("");
                        setResetTarget(client);
                        setResetOpen(true);
                      }}
                      disabled={client.user_id == null}
                      title={client.user_id != null ? "Reset hasła" : "Klient nie ma konta"}
                    >
                      <KeyIcon />
                    </IconButton>

                    <IconButton
                      onClick={() => {
                        setClientToDelete(client);
                        setDeleteDialogOpen(true);
                      }}
                      color="error"
                    >
                      <Delete />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}

            {!loading && clients.length === 0 && (
              <TableRow>
                <TableCell colSpan={5}>
                  <Typography color="textSecondary" align="center" sx={{ py: 4 }}>
                    Brak klientów do wyświetlenia.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Formularz */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editingClient ? "Edytuj klienta" : "Nowy klient"}</DialogTitle>

        <Formik
          enableReinitialize
          initialValues={{
            first_name: editingClient?.first_name || "",
            last_name: editingClient?.last_name || "",
            phone: editingClient?.phone || "",
            email: editingClient?.email ?? "",
            password: "", // tylko przy CREATE
            internal_notes: editingClient?.internal_notes ?? "",
            is_active: editingClient?.is_active ?? true,
          }}
          validationSchema={ClientSchema}
          context={{ isNew: !editingClient }}
          onSubmit={handleSubmit}
        >
          {({ errors, touched, values, setFieldValue }) => (
            <Form>
              <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <Field
                  as={TextField}
                  name="first_name"
                  label="Imię"
                  fullWidth
                  error={touched.first_name && !!errors.first_name}
                  helperText={touched.first_name && (errors.first_name as any)}
                />
                <Field
                  as={TextField}
                  name="last_name"
                  label="Nazwisko"
                  fullWidth
                  error={touched.last_name && !!errors.last_name}
                  helperText={touched.last_name && (errors.last_name as any)}
                />
                <Field
                  as={TextField}
                  name="phone"
                  label="Telefon"
                  fullWidth
                  error={touched.phone && !!errors.phone}
                  helperText={touched.phone && (errors.phone as any)}
                />
                <Field
                  as={TextField}
                  name="email"
                  label="Email (opcjonalnie)"
                  fullWidth
                  error={touched.email && !!errors.email}
                  helperText={touched.email && (errors.email as any)}
                />

                {/* Hasło TYLKO przy tworzeniu klienta */}
                {!editingClient && (
                  <Field
                    as={TextField}
                    name="password"
                    label="Hasło"
                    type="password"
                    fullWidth
                    error={touched.password && !!errors.password}
                    helperText={touched.password && (errors.password as any)}
                  />
                )}

                <Field
                  as={TextField}
                  name="internal_notes"
                  label="Notatki"
                  multiline
                  rows={3}
                  fullWidth
                  error={touched.internal_notes && !!errors.internal_notes}
                  helperText={touched.internal_notes && (errors.internal_notes as any)}
                />
                <FormControlLabel
                  control={
                    <Switch checked={values.is_active} onChange={(e) => setFieldValue("is_active", e.target.checked)} />
                  }
                  label="Aktywny"
                />
              </DialogContent>

              <DialogActions sx={{ p: 3 }}>
                <Button onClick={handleCloseDialog}>Anuluj</Button>
                <Button type="submit" variant="contained">
                  Zapisz
                </Button>
              </DialogActions>
            </Form>
          )}
        </Formik>
      </Dialog>

      {/* Dialog Usuwania */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Usunąć klienta?</DialogTitle>
        <DialogContent>
          <Typography>
            {clientToDelete?.first_name} {clientToDelete?.last_name} zostanie usunięty z bazy.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDeleteDialogOpen(false)}>Anuluj</Button>
          <Button onClick={handleDelete} color="error" variant="contained">
            Usuń
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog Podglądu */}
      <Dialog open={viewDialogOpen} onClose={() => setViewDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Karta Klienta</DialogTitle>
        <DialogContent>
          {viewingClient && (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, py: 1 }}>
              <Typography variant="h6">
                {viewingClient.first_name} {viewingClient.last_name}
              </Typography>
              <Typography variant="body2">
                <strong>Nr klienta:</strong> {viewingClient.client_number}
              </Typography>
              <Typography variant="body2">
                <strong>Email:</strong> {viewingClient.email || "—"}
              </Typography>
              <Typography variant="body2">
                <strong>Telefon:</strong> {viewingClient.phone || "—"}
              </Typography>
              <Typography variant="body2">
                <strong>Wizyty:</strong> {viewingClient.appointments_count}
              </Typography>
              <Typography variant="body2">
                <strong>Notatki:</strong> {viewingClient.internal_notes || "Brak"}
              </Typography>
              <Typography variant="body2">
                <strong>Dołączył:</strong> {new Date(viewingClient.created_at).toLocaleDateString("pl-PL")}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewDialogOpen(false)}>Zamknij</Button>
        </DialogActions>
      </Dialog>

      {/* Dialog Resetu Hasła */}
      <Dialog open={resetOpen} onClose={() => setResetOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Reset hasła klienta</DialogTitle>
        <DialogContent>
          {resetErr && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {resetErr}
            </Alert>
          )}

          {resetTarget?.user_id == null && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              Ten klient nie ma konta użytkownika — nie da się zresetować hasła.
            </Alert>
          )}

          <TextField
            label="Nowe hasło"
            type="password"
            fullWidth
            margin="dense"
            value={p1}
            onChange={(e) => setP1(e.target.value)}
            disabled={resetTarget?.user_id == null || resetSaving}
          />
          <TextField
            label="Powtórz nowe hasło"
            type="password"
            fullWidth
            margin="dense"
            value={p2}
            onChange={(e) => setP2(e.target.value)}
            disabled={resetTarget?.user_id == null || resetSaving}
          />
        </DialogContent>

        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setResetOpen(false)} disabled={resetSaving}>
            Anuluj
          </Button>

          <Button
            variant="contained"
            disabled={resetTarget?.user_id == null || resetSaving}
            onClick={async () => {
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
                setResetOpen(false);
                await loadClients();
              } catch (err: any) {
                const d = err?.response?.data;
                setResetErr(
                  d?.detail ||
                    d?.new_password?.[0] ||
                    d?.new_password2?.[0] ||
                    "Nie udało się zresetować hasła."
                );
              } finally {
                setResetSaving(false);
              }
            }}
          >
            Resetuj
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ClientsPage;
