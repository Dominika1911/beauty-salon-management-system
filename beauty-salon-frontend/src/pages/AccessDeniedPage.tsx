import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Alert,
    Box,
    Button,
    CircularProgress,
    Container,
    Paper,
    Stack,
    Typography,
} from '@mui/material';
import { Home, Login, BlockOutlined } from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';

const AccessDeniedPage: React.FC = () => {
    const navigate = useNavigate();
    const { isAuthenticated, loading } = useAuth();

    const goHome = () => {
        if (loading) return;
        navigate(isAuthenticated ? '/dashboard' : '/login', { replace: true });
    };

    const goLogin = () => {
        if (loading) return;
        navigate('/login');
    };

    return (
        <Box
            sx={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: 'background.default',
                px: 2,
                py: 4,
            }}
        >
            <Container maxWidth="sm">
                <Paper variant="outlined" sx={{ borderRadius: 3, p: { xs: 2.5, sm: 4 } }}>
                    <Stack spacing={2.5} alignItems="center" textAlign="center">
                        <BlockOutlined sx={{ fontSize: 72, color: 'warning.main' }} />

                        <Box>
                            <Typography variant="h4" fontWeight={900} gutterBottom>
                                Brak dostępu
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                Nie masz uprawnień do przeglądania tej strony.
                            </Typography>
                        </Box>

                        <Alert severity="info" sx={{ width: '100%' }}>
                            Jeśli to pomyłka — zaloguj się na inne konto lub skontaktuj się z
                            administratorem.
                        </Alert>

                        <Stack
                            direction={{ xs: 'column', sm: 'row' }}
                            spacing={1}
                            sx={{ width: '100%' }}
                        >
                            <Button
                                variant="contained"
                                startIcon={loading ? <CircularProgress size={18} /> : <Home />}
                                onClick={goHome}
                                disabled={loading}
                                fullWidth
                            >
                                {loading ? 'Sprawdzanie…' : 'Przejdź dalej'}
                            </Button>

                            <Button
                                variant="outlined"
                                startIcon={<Login />}
                                onClick={goLogin}
                                disabled={loading}
                                fullWidth
                            >
                                Zaloguj się
                            </Button>
                        </Stack>

                        <Typography variant="caption" color="text.disabled">
                            Kod: 403
                        </Typography>
                    </Stack>
                </Paper>
            </Container>
        </Box>
    );
};

export default AccessDeniedPage;
