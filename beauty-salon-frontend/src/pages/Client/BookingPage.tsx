import React from 'react';
import { Box, Typography, Paper } from '@mui/material';

const ClientBookingPage: React.FC = () => {
  return (
    <Box>
      <Typography variant="h4" gutterBottom fontWeight="bold">
        Rezerwacja wizyty
      </Typography>
      <Paper sx={{ p: 3, mt: 3 }}>
        <Typography variant="body1" color="text.secondary">
          Formularz rezerwacji - w przygotowaniu
        </Typography>
      </Paper>
    </Box>
  );
};

export default ClientBookingPage;