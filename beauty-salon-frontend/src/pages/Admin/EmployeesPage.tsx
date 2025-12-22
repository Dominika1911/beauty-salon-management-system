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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  OutlinedInput,
} from '@mui/material';
import { Add, Edit, Delete } from '@mui/icons-material';
import { getEmployees, createEmployee, updateEmployee, deleteEmployee } from '../../api/employees';
import { getServices } from '../../api/services';
import type { Employee, Service } from '../../types';

const AdminEmployeesPage: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    password_confirm: '',
    first_name: '',
    last_name: '',
    phone: '',
    skill_ids: [] as number[],
  });

  useEffect(() => {
    fetchEmployees();
    fetchServices();
  }, []);

  const fetchEmployees = async () => {
    try {
      const data = await getEmployees();
      setEmployees(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchServices = async () => {
    try {
      const data = await getServices();
      setServices(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenDialog = (employee?: Employee) => {
    if (employee) {
      setEditingEmployee(employee);
      setFormData({
        email: employee.user_email,
        password: '',
        password_confirm: '',
        first_name: employee.first_name,
        last_name: employee.last_name,
        phone: employee.phone,
        skill_ids: employee.skills.map(s => s.id),
      });
    } else {
      setEditingEmployee(null);
      setFormData({
        email: '',
        password: '',
        password_confirm: '',
        first_name: '',
        last_name: '',
        phone: '',
        skill_ids: [],
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingEmployee(null);
  };

  const handleSubmit = async () => {
    try {
      if (editingEmployee) {
        // Edycja - tylko profil
        const employeeData = {
          first_name: formData.first_name,
          last_name: formData.last_name,
          phone: formData.phone,
          skill_ids: formData.skill_ids,
        };
        await updateEmployee(editingEmployee.id, employeeData);
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

        // JEDEN request - backend zrobi wszystko
        await createEmployee({
          email: formData.email,
          password: formData.password,
          first_name: formData.first_name,
          last_name: formData.last_name,
          phone: formData.phone,
          skill_ids: formData.skill_ids,
        });
      }

      await fetchEmployees();
      handleCloseDialog();
    } catch (err: any) {
      console.error(err);
      const errorMessage = err.response?.data?.detail
        || JSON.stringify(err.response?.data)
        || 'Błąd podczas zapisywania pracownika';
      alert(errorMessage);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Czy na pewno chcesz usunąć tego pracownika?')) return;

    try {
      await deleteEmployee(id);
      fetchEmployees();
    } catch (err) {
      console.error(err);
      alert('Błąd podczas usuwania pracownika');
    }
  };

  if (loading) {
    return <Typography>Ładowanie...</Typography>;
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight="bold">
          Zarządzanie pracownikami
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => handleOpenDialog()}
        >
          Dodaj pracownika
        </Button>
      </Box>

      <Grid container spacing={3}>
        {employees.length === 0 ? (
          <Grid item xs={12}>
            <Paper sx={{ p: 3, textAlign: 'center' }}>
              <Typography color="text.secondary">
                Brak pracowników
              </Typography>
            </Paper>
          </Grid>
        ) : (
          employees.map((employee) => (
            <Grid item xs={12} sm={6} md={4} key={employee.id}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 2 }}>
                    <Typography variant="h6">
                      {employee.first_name} {employee.last_name}
                    </Typography>
                    <Chip
                      label={employee.is_active ? 'Aktywny' : 'Nieaktywny'}
                      color={employee.is_active ? 'success' : 'default'}
                      size="small"
                    />
                  </Box>

                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Nr pracownika: {employee.employee_number}
                  </Typography>

                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Email: {employee.user_email}
                  </Typography>

                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Telefon: {employee.phone}
                  </Typography>

                  <Box sx={{ mt: 2 }}>
                    <Typography variant="body2" fontWeight="bold" gutterBottom>
                      Umiejętności:
                    </Typography>
                    {employee.skills.length === 0 ? (
                      <Typography variant="body2" color="text.secondary">
                        Brak przypisanych usług
                      </Typography>
                    ) : (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {employee.skills.map((skill) => (
                          <Chip
                            key={skill.id}
                            label={skill.name}
                            size="small"
                            variant="outlined"
                          />
                        ))}
                      </Box>
                    )}
                  </Box>
                </CardContent>
                <CardActions>
                  <Button
                    size="small"
                    startIcon={<Edit />}
                    onClick={() => handleOpenDialog(employee)}
                  >
                    Edytuj
                  </Button>
                  <Button
                    size="small"
                    color="error"
                    startIcon={<Delete />}
                    onClick={() => handleDelete(employee.id)}
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
          {editingEmployee ? 'Edytuj pracownika' : 'Dodaj nowego pracownika'}
        </DialogTitle>
        <DialogContent>
          {!editingEmployee && (
            <>
              <TextField
                fullWidth
                label="Email (login)"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                margin="normal"
                required
                placeholder="np. anna.kowalska@salon.pl"
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
                helperText="Minimum 8 znaków - pracownik użyje tego do logowania"
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

          <FormControl fullWidth margin="normal">
            <InputLabel>Umiejętności (usługi)</InputLabel>
            <Select
              multiple
              value={formData.skill_ids}
              onChange={(e) => setFormData({ ...formData, skill_ids: e.target.value as number[] })}
              input={<OutlinedInput label="Umiejętności (usługi)" />}
              renderValue={(selected) => (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {selected.map((value) => {
                    const service = services.find(s => s.id === value);
                    return <Chip key={value} label={service?.name} size="small" />;
                  })}
                </Box>
              )}
            >
              {services.map((service) => (
                <MenuItem key={service.id} value={service.id}>
                  {service.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Anuluj</Button>
          <Button onClick={handleSubmit} variant="contained">
            {editingEmployee ? 'Zapisz' : 'Dodaj'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AdminEmployeesPage;