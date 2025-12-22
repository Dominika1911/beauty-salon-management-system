import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Container, Typography, Button } from '@mui/material';
import { Home, BlockOutlined } from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';

const AccessDeniedPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleGoHome = () => {
    if (user) {
      // Przekieruj na odpowiedni dashboard
      switch (user.role) {
        case 'ADMIN':
          navigate('/admin/dashboard');
          break;
        case 'EMPLOYEE':
          navigate('/employee/dashboard');
          break;
        case 'CLIENT':
          navigate('/client/dashboard');
          break;
        default:
          navigate('/');
      }
    } else {
      navigate('/');
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
      }}
    >
      <Container maxWidth="sm" sx={{ textAlign: 'center' }}>
        <BlockOutlined sx={{ fontSize: 120, color: 'warning.main', mb: 2 }} />
        <Typography variant="h1" fontWeight="bold" gutterBottom>
          403
        </Typography>
        <Typography variant="h5" color="text.secondary" paragraph>
          Brak dostępu
        </Typography>
        <Typography variant="body1" color="text.secondary" paragraph>
          Nie masz uprawnień do przeglądania tej strony.
        </Typography>
        <Button
          variant="contained"
          startIcon={<Home />}
          onClick={handleGoHome}
          sx={{ mt: 2 }}
        >
          Wróć do strony głównej
        </Button>
      </Container>
    </Box>
  );
};

export default AccessDeniedPage;
