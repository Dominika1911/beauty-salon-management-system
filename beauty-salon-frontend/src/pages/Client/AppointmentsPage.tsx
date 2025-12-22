import React from 'react';
import { Box, Typography, Paper } from '@mui/material';

const ClientAppointmentsPage: React.FC = () => {
  return (
    <Box>
      <Typography variant="h4" gutterBottom fontWeight="bold">
        Moje wizyty
      </Typography>
      <Paper sx={{ p: 3, mt: 3 }}>
        <Typography variant="body1" color="text.secondary">
          Lista Twoich wizyt - w przygotowaniu
        </Typography>
      </Paper>
    </Box>
  );
};

export default ClientAppointmentsPage;