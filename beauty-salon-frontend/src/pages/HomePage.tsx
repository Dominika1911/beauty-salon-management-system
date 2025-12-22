import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Container, Typography, Button, Paper } from '@mui/material';
import { ContentCut } from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';

const HomePage: React.FC = () => {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  // Przekieruj zalogowanych użytkowników na odpowiedni dashboard
  useEffect(() => {
    if (isAuthenticated && user) {
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
      }
    }
  }, [isAuthenticated, user, navigate]);

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      }}
    >
      <Container maxWidth="md">
        <Paper
          elevation={24}
          sx={{
            p: 6,
            textAlign: 'center',
            borderRadius: 3,
          }}
        >
          <Box sx={{ mb: 3 }}>
            <ContentCut sx={{ fontSize: 64, color: 'primary.main' }} />
          </Box>
          <Typography variant="h2" gutterBottom fontWeight="bold">
            Beauty Salon
          </Typography>
          <Typography variant="h5" color="text.secondary" paragraph>
            System zarządzania salonem kosmetycznym
          </Typography>
          <Typography variant="body1" color="text.secondary" paragraph sx={{ mb: 4 }}>
            Zaloguj się aby uzyskać dostęp do systemu
          </Typography>
          <Button
            variant="contained"
            size="large"
            onClick={() => navigate('/login')}
            sx={{ px: 6, py: 1.5 }}
          >
            Zaloguj się
          </Button>
        </Paper>
      </Container>
    </Box>
  );
};

export default HomePage;
