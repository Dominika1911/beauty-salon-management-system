import React from 'react';
import { Box, Typography, Paper } from '@mui/material';

const EmployeeSchedulePage: React.FC = () => {
  return (
    <Box>
      <Typography variant="h4" gutterBottom fontWeight="bold">
        Mój grafik
      </Typography>
      <Paper sx={{ p: 3, mt: 3 }}>
        <Typography variant="body1" color="text.secondary">
          Grafik pracy - w przygotowaniu
        </Typography>
      </Paper>
    </Box>
  );
};

export default EmployeeSchedulePage;