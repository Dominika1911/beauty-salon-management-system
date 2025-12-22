import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Grid,
  Card,
  CardContent,
  CardActions,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Chip,
} from '@mui/material';
import { Add, Edit, Delete } from '@mui/icons-material';
import { getClients, createClient, updateClient, deleteClient } from '../../api/clients';
import type { Client } from '../../types';

const AdminClientsPage: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    password_confirm: '',
    first_name: '',
    last_name: '',
    phone: '',
  });

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    try {
      const data = await getClients();
      setClients(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (client?: Client) => {
    if (client) {
      setEditingClient(client);
      setFormData({
        email: client.email,
        password: '',
        password_confirm: '',
        first_name: client.first_name,
        last_name: client.last_name,
        phone: client.phone,
      });
    } else {
      setEditingClient(null);
      setFormData({
        email: '',
        password: '',
        password_confirm: '',
        first_name: '',
        last_name: '',
        phone: '',
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingClient(null);
  };

  const handleSubmit = async () => {
    try {
      if (editingClient) {
        // Edycja - tylko profil
        const clientData = {
          first_name: formData.first_name,
          last_name: formData.last_name,
          email: formData.email,
          phone: formData.phone,
        };
        await updateClient(editingClient.id, clientData);
      } else {
        // Dodawanie - sprawdź hasła
        if (formData.password !== formData.password_confirm) {
          alert('Hasła się nie zgadzają!');
          return;
        }
        if (formData.password.length < 8) {
          alert('Hasło musi mieć minimum 8 znaków!');
          return;
        }

        // Jeden request - backend zrobi wszystko
        await createClient({
          email: formData.email,
          password: formData.password,
          first_name: formData.first_name,
          last_name: formData.last_name,
          phone: formData.phone,
        });
      }

      await fetchClients();
      handleCloseDialog();
    } catch (err: any) {
      console.error(err);
      const errorMessage = err.response?.data?.detail
        || JSON.stringify(err.response?.data)
        || 'Błąd podczas zapisywania klienta';
      alert(errorMessage);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Czy na pewno chcesz usunąć tego klienta?')) return;

    try {
      await deleteClient(id);
      fetchClients();
    } catch (err) {
      console.error(err);
      alert('Błąd podczas usuwania klienta');
    }
  };

  if (loading) {
    return <Typography>Ładowanie...</Typography>;
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight="bold">
          Zarządzanie klientami
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => handleOpenDialog()}
        >
          Dodaj klienta
        </Button>
      </Box>

      <Grid container spacing={3}>
        {clients.length === 0 ? (
          <Grid item xs={12}>
            <Paper sx={{ p: 3, textAlign: 'center' }}>
              <Typography color="text.secondary">
                Brak klientów
              </Typography>
            </Paper>
          </Grid>
        ) : (
          clients.map((client) => (
            <Grid item xs={12} sm={6} md={4} key={client.id}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 2 }}>
                    <Typography variant="h6">
                      {client.first_name} {client.last_name}
                    </Typography>
                    <Chip
                      label={client.is_active ? 'Aktywny' : 'Nieaktywny'}
                      color={client.is_active ? 'success' : 'default'}
                      size="small"
                    />
                  </Box>

                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Nr klienta: {client.client_number}
                  </Typography>

                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Email: {client.email}
                  </Typography>

                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Telefon: {client.phone}
                  </Typography>

                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Liczba wizyt: {client.appointments_count || 0}
                  </Typography>

                  {client.user_username && (
                    <Typography variant="body2" color="primary" gutterBottom>
                      Ma konto: {client.user_username}
                    </Typography>
                  )}
                </CardContent>
                <CardActions>
                  <Button
                    size="small"
                    startIcon={<Edit />}
                    onClick={() => handleOpenDialog(client)}
                  >
                    Edytuj
                  </Button>
                  <Button
                    size="small"
                    color="error"
                    startIcon={<Delete />}
                    onClick={() => handleDelete(client.id)}
                  >
                    Usuń
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))
        )}
      </Grid>

      {/* Dialog dodawania/edycji */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingClient ? 'Edytuj klienta' : 'Dodaj nowego klienta'}
        </DialogTitle>
        <DialogContent>
          {!editingClient && (
            <>
              <TextField
                fullWidth
                label="Email (login)"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                margin="normal"
                required
                placeholder="np. jan.kowalski@example.com"
                helperText="Email będzie używany jako login do systemu"
              />
              <TextField
                fullWidth
                label="Hasło"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                margin="normal"
                required
                placeholder="Minimum 8 znaków"
                helperText="Minimum 8 znaków - klient użyje tego do logowania"
              />
              <TextField
                fullWidth
                label="Potwierdź hasło"
                type="password"
                value={formData.password_confirm}
                onChange={(e) => setFormData({ ...formData, password_confirm: e.target.value })}
                margin="normal"
                required
                placeholder="Wpisz hasło ponownie"
              />
            </>
          )}
          <TextField
            fullWidth
            label="Imię"
            value={formData.first_name}
            onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
            margin="normal"
            required
          />
          <TextField
            fullWidth
            label="Nazwisko"
            value={formData.last_name}
            onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
            margin="normal"
            required
          />
          <TextField
            fullWidth
            label="Telefon"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            margin="normal"
            required
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Anuluj</Button>
          <Button onClick={handleSubmit} variant="contained">
            {editingClient ? 'Zapisz' : 'Dodaj'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AdminClientsPage;