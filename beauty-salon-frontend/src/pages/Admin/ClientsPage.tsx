import React, { useEffect, useMemo, useState } from 'react';
import {
  Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  IconButton, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TextField, Typography, Alert, CircularProgress,
  FormControlLabel, Switch,
} from '@mui/material';
import { Add, Edit, Delete, Visibility } from '@mui/icons-material';
import { Formik, Form, Field } from 'formik';
import * as Yup from 'yup';
import { getClients, createClient, updateClient, deleteClient } from '../../api/clients';
import type { Client } from '../../types';

// Walidacja formularza (hasło wymagane tylko przy tworzeniu)
const ClientSchema = Yup.object().shape({
  first_name: Yup.string().min(2, 'Imię musi mieć co najmniej 2 znaki').required('Imię jest wymagane'),
  last_name: Yup.string().min(2, 'Nazwisko musi mieć co najmniej 2 znaki').required('Nazwisko jest wymagane'),
  phone: Yup.string().matches(/^[0-9+\s-()]+$/, 'Nieprawidłowy format telefonu').required('Telefon jest wymagany'),
  email: Yup.string().email('Nieprawidłowy adres email').required('Email jest wymagany'),
  password: Yup.string().when('$isNew', {
    is: true,
    then: (schema) => schema.min(8, 'Hasło musi mieć co najmniej 8 znaków').required('Hasło jest wymagane'),
    otherwise: (schema) => schema.notRequired(),
  }),
  internal_notes: Yup.string().max(1000, 'Notatki mogą mieć maksymalnie 1000 znaków'),
  is_active: Yup.boolean(),
});

interface ClientFormData {
  first_name: string;
  last_name: string;
  phone: string;
  email: string; // jeśli w backendzie dopuszczasz null, możesz zmienić na string | null i w UI wymusić string
  password?: string;
  internal_notes: string;
  is_active: boolean;
}

const ClientsPage: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);

  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewingClient, setViewingClient] = useState<Client | null>(null);

  const [query, setQuery] = useState('');

  useEffect(() => {
    loadClients();
  }, []);

  const normalizeClientsResponse = (data: any): Client[] => {
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.results)) return data.results;
    return [];
  };

  const loadClients = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getClients();
      setClients(normalizeClientsResponse(data));
    } catch (err: any) {
      setError('Nie udało się załadować listy klientów.');
    } finally {
      setLoading(false);
    }
  };

  const filteredClients = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients;

    return clients.filter((c) => {
      const haystack = [
        c.first_name,
        c.last_name,
        c.client_number,
        c.phone,
        // email może być null po stronie backendu
        (c as any).email ?? '',
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [clients, query]);

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
      const clientData: any = {
        first_name: values.first_name,
        last_name: values.last_name,
        phone: values.phone,
        email: values.email,
        internal_notes: values.internal_notes,
        is_active: values.is_active,
      };

      if (!editingClient) {
        clientData.password = values.password;
        await createClient(clientData);
      } else {
        if (values.password) clientData.password = values.password;
        await updateClient(editingClient.id, clientData);
      }

      await loadClients();
      handleCloseDialog();
    } catch (err: any) {
      const backendErrors = err?.response?.data;

      if (backendErrors && typeof backendErrors === 'object') {
        setErrors(backendErrors);
      } else {
        setError(backendErrors?.detail || 'Nie udało się zapisać klienta.');
      }
    }
  };

  const handleDelete = async () => {
    if (!clientToDelete) return;
    try {
      await deleteClient(clientToDelete.id);
      await loadClients();
      setDeleteDialogOpen(false);
      setClientToDelete(null);
    } catch (err: any) {
      setError('Nie udało się usunąć klienta.');
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight={700}>Zarządzanie klientami</Typography>
          <Typography color="textSecondary">Razem: {filteredClients.length}</Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <TextField
            size="small"
            label="Szukaj (imię, email, tel...)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
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

      <TableContainer component={Paper} sx={{ borderRadius: 2, boxShadow: 3 }}>
        <Table>
          <TableHead sx={{ bgcolor: 'grey.100' }}>
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>Klient</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Kontakt</TableCell>
              <TableCell align="center" sx={{ fontWeight: 700 }}>Wizyty</TableCell>
              <TableCell align="center" sx={{ fontWeight: 700 }}>Status</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>Akcje</TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {filteredClients.map((client) => (
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
                  <Typography variant="body2">
                    {(client as any).email ?? '—'}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    {client.phone || '—'}
                  </Typography>
                </TableCell>

                <TableCell align="center">
                  <Chip label={client.appointments_count} size="small" variant="outlined" color="primary" />
                </TableCell>

                <TableCell align="center">
                  <Chip
                    label={client.is_active ? 'Aktywny' : 'Nieaktywny'}
                    color={client.is_active ? 'success' : 'default'}
                    size="small"
                  />
                </TableCell>

                <TableCell align="right">
                  <IconButton onClick={() => { setViewingClient(client); setViewDialogOpen(true); }}>
                    <Visibility />
                  </IconButton>
                  <IconButton onClick={() => handleOpenDialog(client)} color="primary">
                    <Edit />
                  </IconButton>
                  <IconButton onClick={() => { setClientToDelete(client); setDeleteDialogOpen(true); }} color="error">
                    <Delete />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}

            {filteredClients.length === 0 && (
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
        <DialogTitle>{editingClient ? 'Edytuj klienta' : 'Nowy klient'}</DialogTitle>

        <Formik
          enableReinitialize
          initialValues={{
            first_name: editingClient?.first_name || '',
            last_name: editingClient?.last_name || '',
            phone: editingClient?.phone || '',
            email: (editingClient as any)?.email || '',
            password: '',
            internal_notes: (editingClient as any)?.internal_notes || '',
            is_active: editingClient?.is_active ?? true,
          }}
          validationSchema={ClientSchema}
          context={{ isNew: !editingClient }}
          onSubmit={handleSubmit}
        >
          {({ errors, touched, values, setFieldValue }) => (
            <Form>
              <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Field
                  as={TextField}
                  name="first_name"
                  label="Imię"
                  fullWidth
                  error={touched.first_name && !!errors.first_name}
                  helperText={touched.first_name && errors.first_name}
                />
                <Field
                  as={TextField}
                  name="last_name"
                  label="Nazwisko"
                  fullWidth
                  error={touched.last_name && !!errors.last_name}
                  helperText={touched.last_name && errors.last_name}
                />
                <Field
                  as={TextField}
                  name="phone"
                  label="Telefon"
                  fullWidth
                  error={touched.phone && !!errors.phone}
                  helperText={touched.phone && errors.phone}
                />
                <Field
                  as={TextField}
                  name="email"
                  label="Email"
                  fullWidth
                  error={touched.email && !!errors.email}
                  helperText={touched.email && errors.email}
                />
                <Field
                  as={TextField}
                  name="password"
                  label={editingClient ? "Zmień hasło (opcjonalnie)" : "Hasło"}
                  type="password"
                  fullWidth
                  error={touched.password && !!errors.password}
                  helperText={touched.password && errors.password}
                />
                <Field as={TextField} name="internal_notes" label="Notatki" multiline rows={3} fullWidth />
                <FormControlLabel
                  control={<Switch checked={values.is_active} onChange={(e) => setFieldValue('is_active', e.target.checked)} />}
                  label="Aktywny"
                />
              </DialogContent>

              <DialogActions sx={{ p: 3 }}>
                <Button onClick={handleCloseDialog}>Anuluj</Button>
                <Button type="submit" variant="contained">Zapisz</Button>
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
          <Button onClick={handleDelete} color="error" variant="contained">Usuń</Button>
        </DialogActions>
      </Dialog>

      {/* Dialog Podglądu */}
      <Dialog open={viewDialogOpen} onClose={() => setViewDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Karta Klienta</DialogTitle>
        <DialogContent>
          {viewingClient && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, py: 1 }}>
              <Typography variant="h6">{viewingClient.first_name} {viewingClient.last_name}</Typography>
              <Typography variant="body2"><strong>Nr klienta:</strong> {viewingClient.client_number}</Typography>
              <Typography variant="body2"><strong>Email:</strong> {(viewingClient as any).email ?? '—'}</Typography>
              <Typography variant="body2"><strong>Telefon:</strong> {viewingClient.phone || '—'}</Typography>
              <Typography variant="body2"><strong>Wizyty:</strong> {viewingClient.appointments_count}</Typography>
              <Typography variant="body2"><strong>Notatki:</strong> {(viewingClient as any).internal_notes || 'Brak'}</Typography>
              <Typography variant="body2">
                <strong>Dołączył:</strong> {new Date(viewingClient.created_at).toLocaleDateString('pl-PL')}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewDialogOpen(false)}>Zamknij</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ClientsPage;
