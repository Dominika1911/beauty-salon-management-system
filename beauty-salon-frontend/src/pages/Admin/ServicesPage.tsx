import React from 'react';
import { Box, Typography, Paper } from '@mui/material';

const AdminServicesPage: React.FC = () => {
  return (
    <Box>
      <Typography variant="h4" gutterBottom fontWeight="bold">
        Services
      </Typography>
      <Paper sx={{ p: 3, mt: 3 }}>
        <Typography variant="body1" color="text.secondary">
          Strona w przygotowaniu
        </Typography>
      </Paper>
    </Box>
  );
};

export default AdminServicesPage;
