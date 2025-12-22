import React from 'react';
import { Box, Typography, Paper } from '@mui/material';

const EmployeeDashboardPage: React.FC = () => {
  return (
    <Box>
      <Typography variant="h4" gutterBottom fontWeight="bold">
        Panel Pracownika
      </Typography>
      <Paper sx={{ p: 3, mt: 3 }}>
        <Typography variant="body1" color="text.secondary">
          Witaj w systemie Beauty Salon
        </Typography>
      </Paper>
    </Box>
  );
};

export default EmployeeDashboardPage;