import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import axiosInstance from '../../api/axios';
import { useAuth } from '../../context/AuthContext';

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

interface Schedule {
  id: number;
  employee: number;
  employee_name: string;
  weekly_hours: WeeklyHours;
}

const EmployeeSchedulePage: React.FC = () => {
  const { user } = useAuth();
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchSchedule();
  }, [user]);

  const fetchSchedule = async () => {
    if (!user?.employee_profile?.id) return;

    try {
      const response = await axiosInstance.get(`/employees/${user.employee_profile.id}/schedule/`);
      setSchedule(response.data);
    } catch (err) {
      console.error(err);
      setError('Nie znaleziono grafiku. Skontaktuj się z administratorem.');
    } finally {
      setLoading(false);
    }
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

  if (error) {
    return <Alert severity="warning">{error}</Alert>;
  }

  return (
    <Box>
      <Typography variant="h4" fontWeight="bold" gutterBottom>
        Mój grafik pracy
      </Typography>

      {schedule && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell><strong>Dzień tygodnia</strong></TableCell>
                <TableCell><strong>Godziny pracy</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {Object.entries(dayNames).map(([key, name]) => {
                const hours = schedule.weekly_hours?.[key as keyof WeeklyHours];
                return (
                  <TableRow key={key}>
                    <TableCell>{name}</TableCell>
                    <TableCell>
                      {hours && hours.length > 0 ? (
                        hours.map((period, idx) => (
                          <Box key={idx} component="span" sx={{ display: 'block' }}>
                            {period.start} - {period.end}
                          </Box>
                        ))
                      ) : (
                        <Typography color="text.secondary">Dzień wolny</Typography>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {!schedule?.weekly_hours && (
        <Alert severity="info" sx={{ mt: 2 }}>
          Grafik nie został jeszcze ustawiony. Skontaktuj się z administratorem.
        </Alert>
      )}
    </Box>
  );
};

export default EmployeeSchedulePage;