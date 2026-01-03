import React, { useEffect, useMemo, useState } from 'react';
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
import { useAuth } from '../context/AuthContext';

const HomePage: React.FC = () => {
    const { isAuthenticated, loading } = useAuth();
    const navigate = useNavigate();
    const [showFallback, setShowFallback] = useState(false);

    useEffect(() => {
        if (loading) return;

        navigate(isAuthenticated ? '/dashboard' : '/login', { replace: true });
    }, [isAuthenticated, loading, navigate]);

    useEffect(() => {
        const t = window.setTimeout(() => setShowFallback(true), 2500);
        return () => window.clearTimeout(t);
    }, []);

    const target = useMemo(() => (isAuthenticated ? '/dashboard' : '/login'), [isAuthenticated]);

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
                <Paper
                    variant="outlined"
                    sx={{
                        borderRadius: 3,
                        p: { xs: 2.5, sm: 4 },
                    }}
                >
                    <Stack spacing={2.5} alignItems="center" textAlign="center">
                        <CircularProgress />

                        <Box>
                            <Typography fontWeight={900}>Uruchamiamy aplikację…</Typography>
                            <Typography variant="body2" color="text.secondary">
                                Sprawdzamy Twoją sesję i przekierowujemy do właściwego panelu.
                            </Typography>
                        </Box>

                        {showFallback && (
                            <Stack spacing={1} sx={{ width: '100%' }}>
                                <Alert severity="info" sx={{ textAlign: 'left' }}>
                                    Jeśli przekierowanie nie nastąpiło, możesz przejść dalej
                                    ręcznie.
                                </Alert>

                                <Button
                                    variant="contained"
                                    onClick={() => navigate(target, { replace: true })}
                                    fullWidth
                                >
                                    Przejdź dalej
                                </Button>

                                <Button
                                    variant="outlined"
                                    onClick={() => window.location.reload()}
                                    fullWidth
                                >
                                    Odśwież stronę
                                </Button>
                            </Stack>
                        )}
                    </Stack>
                </Paper>
            </Container>
        </Box>
    );
};

export default HomePage;
