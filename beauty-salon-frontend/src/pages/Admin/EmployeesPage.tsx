import React from 'react';
import { Box, Typography, Paper } from '@mui/material';

const AdminEmployeesPage: React.FC = () => {
  return (
    <Box>
      <Typography variant="h4" gutterBottom fontWeight="bold">
        Zarządzanie pracownikami
      </Typography>
      <Paper sx={{ p: 3, mt: 3 }}>
        <Typography variant="body1" color="text.secondary">
          Lista pracowników - w przygotowaniu
        </Typography>
      </Paper>
    </Box>
  );
};

export default AdminEmployeesPage;
