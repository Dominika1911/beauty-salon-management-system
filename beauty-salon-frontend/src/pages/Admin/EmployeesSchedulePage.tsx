import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Button,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Alert,
  IconButton,
} from '@mui/material';
import { Add, Delete, ArrowBack } from '@mui/icons-material';
import axiosInstance from '../../api/axios';

interface DaySchedule {
  start: string;
  end: string;
}

interface WeeklyHours {
  mon?: DaySchedule[];
  tue?: DaySchedule[];
  wed?: DaySchedule[];
  thu?: DaySchedule[];
  fri?: DaySchedule[];
  sat?: DaySchedule[];
  sun?: DaySchedule[];
}

const AdminEmployeeSchedulePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [employeeName, setEmployeeName] = useState('');
  const [weeklyHours, setWeeklyHours] = useState<WeeklyHours>({});
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetchSchedule();
  }, [id]);

  const fetchSchedule = async () => {
    try {
      const response = await axiosInstance.get(`/employees/${id}/schedule/`);
      setEmployeeName(response.data.employee_name);
      setWeeklyHours(response.data.weekly_hours || {});
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      await axiosInstance.patch(`/employees/${id}/schedule/`, {
        weekly_hours: weeklyHours,
      });
      setSuccess('Grafik został zapisany!');
      setError('');
    } catch (err: any) {
      console.error(err);
      setError('Błąd podczas zapisywania grafiku');
      setSuccess('');
    }
  };

  const addPeriod = (day: keyof WeeklyHours) => {
    setWeeklyHours({
      ...weeklyHours,
      [day]: [...(weeklyHours[day] || []), { start: '09:00', end: '17:00' }],
    });
  };

  const removePeriod = (day: keyof WeeklyHours, index: number) => {
    const periods = weeklyHours[day] || [];
    setWeeklyHours({
      ...weeklyHours,
      [day]: periods.filter((_, i) => i !== index),
    });
  };

  const updatePeriod = (day: keyof WeeklyHours, index: number, field: 'start' | 'end', value: string) => {
    const periods = [...(weeklyHours[day] || [])];
    periods[index] = { ...periods[index], [field]: value };
    setWeeklyHours({
      ...weeklyHours,
      [day]: periods,
    });
  };

  const dayNames: { [key: string]: string } = {
    mon: 'Poniedziałek',
    tue: 'Wtorek',
    wed: 'Środa',
    thu: 'Czwartek',
    fri: 'Piątek',
    sat: 'Sobota',
    sun: 'Niedziela',
  };

  if (loading) {
    return <Typography>Ładowanie...</Typography>;
  }

  return (
    <Box>
      <Button
        startIcon={<ArrowBack />}
        onClick={() => navigate('/admin/employees')}
        sx={{ mb: 2 }}
      >
        Powrót do listy
      </Button>

      <Typography variant="h4" fontWeight="bold" gutterBottom>
        Grafik: {employeeName}
      </Typography>

      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <TableContainer component={Paper} sx={{ mb: 3 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell><strong>Dzień</strong></TableCell>
              <TableCell><strong>Godziny pracy</strong></TableCell>
              <TableCell width={100}><strong>Akcje</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {Object.entries(dayNames).map(([key, name]) => {
              const periods = weeklyHours[key as keyof WeeklyHours] || [];
              return (
                <TableRow key={key}>
                  <TableCell>{name}</TableCell>
                  <TableCell>
                    {periods.length === 0 ? (
                      <Typography color="text.secondary">Dzień wolny</Typography>
                    ) : (
                      periods.map((period, idx) => (
                        <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                          <TextField
                            type="time"
                            size="small"
                            value={period.start}
                            onChange={(e) => updatePeriod(key as keyof WeeklyHours, idx, 'start', e.target.value)}
                            sx={{ width: 130 }}
                          />
                          <Typography>-</Typography>
                          <TextField
                            type="time"
                            size="small"
                            value={period.end}
                            onChange={(e) => updatePeriod(key as keyof WeeklyHours, idx, 'end', e.target.value)}
                            sx={{ width: 130 }}
                          />
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => removePeriod(key as keyof WeeklyHours, idx)}
                          >
                            <Delete />
                          </IconButton>
                        </Box>
                      ))
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      size="small"
                      startIcon={<Add />}
                      onClick={() => addPeriod(key as keyof WeeklyHours)}
                    >
                      Dodaj
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      <Button variant="contained" size="large" onClick={handleSave}>
        Zapisz grafik
      </Button>
    </Box>
  );
};

export default AdminEmployeeSchedulePage;