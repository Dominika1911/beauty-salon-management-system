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
import { getServices, createService, updateService, deleteService } from '../../api/services';
import type { Service } from '../../types';

const AdminServicesPage: React.FC = () => {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    description: '',
    price: '',
    duration_minutes: '',
  });

  useEffect(() => {
    fetchServices();
  }, []);

  const fetchServices = async () => {
    try {
      console.log('Pobieram usługi...');
      const data = await getServices();
      console.log('Otrzymane usługi:', data);
      setServices(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (service?: Service) => {
    if (service) {
      setEditingService(service);
      setFormData({
        name: service.name,
        category: service.category,
        description: service.description,
        price: service.price,
        duration_minutes: service.duration_minutes.toString(),
      });
    } else {
      setEditingService(null);
      setFormData({
        name: '',
        category: '',
        description: '',
        price: '',
        duration_minutes: '',
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingService(null);
  };

  const handleSubmit = async () => {
    try {
      const serviceData = {
        name: formData.name,
        category: formData.category,
        description: formData.description,
        price: formData.price,
        duration_minutes: parseInt(formData.duration_minutes) || 0,
        is_active: true,
      };

      if (editingService) {
        await updateService(editingService.id, serviceData);
      } else {
        await createService(serviceData);
      }

      await fetchServices();
      handleCloseDialog();
    } catch (err: any) {
      console.error(err);
      // Pokaż błędy z backendu
      const errorMessage = err.response?.data?.detail
        || JSON.stringify(err.response?.data)
        || 'Błąd podczas zapisywania usługi';
      alert(errorMessage);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Czy na pewno chcesz usunąć tę usługę?')) return;

    try {
      await deleteService(id);
      fetchServices();
    } catch (err) {
      console.error(err);
      alert('Błąd podczas usuwania usługi');
    }
  };

  if (loading) {
    return <Typography>Ładowanie...</Typography>;
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight="bold">
          Zarządzanie usługami
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => handleOpenDialog()}
        >
          Dodaj usługę
        </Button>
      </Box>

      <Grid container spacing={3}>
        {services.length === 0 ? (
          <Grid item xs={12}>
            <Paper sx={{ p: 3, textAlign: 'center' }}>
              <Typography color="text.secondary">
                Brak usług
              </Typography>
            </Paper>
          </Grid>
        ) : (
          services.map((service) => (
            <Grid item xs={12} sm={6} md={4} key={service.id}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 1 }}>
                    <Typography variant="h6" gutterBottom>
                      {service.name}
                    </Typography>
                    <Chip
                      label={service.is_active ? 'Aktywna' : 'Nieaktywna'}
                      color={service.is_active ? 'success' : 'default'}
                      size="small"
                    />
                  </Box>
                  <Chip label={service.category} size="small" sx={{ mb: 1 }} />
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {service.description}
                  </Typography>
                  <Typography variant="h6" color="primary">
                    {service.price} PLN
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Czas trwania: {service.duration_minutes} min
                  </Typography>
                </CardContent>
                <CardActions>
                  <Button
                    size="small"
                    startIcon={<Edit />}
                    onClick={() => handleOpenDialog(service)}
                  >
                    Edytuj
                  </Button>
                  <Button
                    size="small"
                    color="error"
                    startIcon={<Delete />}
                    onClick={() => handleDelete(service.id)}
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
          {editingService ? 'Edytuj usługę' : 'Dodaj nową usługę'}
        </DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Nazwa usługi"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            margin="normal"
            required
          />
          <TextField
            fullWidth
            label="Kategoria"
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            margin="normal"
            required
          />
          <TextField
            fullWidth
            label="Opis"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            margin="normal"
            multiline
            rows={3}
          />
          <TextField
            fullWidth
            label="Cena (PLN)"
            type="number"
            value={formData.price}
            onChange={(e) => setFormData({ ...formData, price: e.target.value })}
            margin="normal"
            required
          />
          <TextField
            fullWidth
            label="Czas trwania (minuty)"
            type="number"
            value={formData.duration_minutes}
            onChange={(e) => setFormData({ ...formData, duration_minutes: e.target.value })}
            margin="normal"
            required
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Anuluj</Button>
          <Button onClick={handleSubmit} variant="contained">
            {editingService ? 'Zapisz' : 'Dodaj'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AdminServicesPage;