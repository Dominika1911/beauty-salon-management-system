import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Alert,
    Box,
    Button,
    CircularProgress,
    Container,
    Paper,
    Snackbar,
    Stack,
    TextField,
    Typography,
} from '@mui/material';
import type { AlertColor } from '@mui/material/Alert';
import { Brush, Login } from '@mui/icons-material';

import { useAuth } from '@/context/AuthContext';
import { parseDrfError, pickFieldErrors } from '@/utils/drfErrors';

type SnackState = {
    open: boolean;
    msg: string;
    severity: AlertColor;
};

type LoginFieldErrors = {
    username?: string;
    password?: string;
};

const LoginPage: React.FC = () => {
    const { login, user } = useAuth();
    const navigate = useNavigate();

    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');

    const [loading, setLoading] = useState(false);

    // standard komunikatów
    const [formError, setFormError] = useState<string | null>(null);
    const [fieldErrors, setFieldErrors] = useState<LoginFieldErrors>({});
    const [snack, setSnack] = useState<SnackState>({ open: false, msg: '', severity: 'info' });

    const canSubmit = useMemo(
        () => username.trim().length > 0 && password.length > 0 && !loading,
        [username, password, loading],
    );

    useEffect(() => {
        if (!user) return;
        navigate('/dashboard', { replace: true });
    }, [user, navigate]);

    const clearErrors = () => {
        setFormError(null);
        setFieldErrors({});
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        clearErrors();

        setLoading(true);
        try {
            await login({ username, password });
            setSnack({ open: true, msg: 'Logowanie…', severity: 'info' });
            // navigate zrobi useEffect po ustawieniu user
        } catch (e: unknown) {
            const parsed = parseDrfError(e);

            setFormError(
                parsed.message || 'Nie udało się zalogować. Sprawdź dane i spróbuj ponownie.',
            );

            const picked = pickFieldErrors<LoginFieldErrors>(parsed.fieldErrors, {
                username: 'Nazwa użytkownika',
                password: 'Hasło',
            });
            setFieldErrors(picked);

            if (!picked.username && !picked.password && !parsed.message) {
                setFormError('Nieprawidłowa nazwa użytkownika lub hasło.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box
            sx={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                bgcolor: 'background.default',
                px: 2,
                py: 4,
            }}
        >
            <Container maxWidth="md" sx={{ width: '100%' }}>
                <Paper
                    variant="outlined"
                    sx={{
                        borderRadius: 3,
                        overflow: 'hidden',
                        maxWidth: 820,
                        mx: 'auto',
                    }}
                >
                    {/* header – bardziej “app-like”, jak pozostałe strony */}
                    <Box sx={{ px: { xs: 3, sm: 4 }, py: { xs: 3, sm: 3.5 } }}>
                        <Stack direction="row" spacing={2} alignItems="center">
                            <Box
                                sx={{
                                    width: 56,
                                    height: 56,
                                    borderRadius: 2,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    bgcolor: 'primary.main',
                                    color: 'primary.contrastText',
                                    flexShrink: 0,
                                }}
                            >
                                <Brush sx={{ fontSize: 30 }} />
                            </Box>

                            <Box sx={{ flex: 1 }}>
                                <Typography variant="h5" fontWeight={900} lineHeight={1.1}>
                                    Beauty Salon
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Zaloguj się do systemu
                                </Typography>
                            </Box>
                        </Stack>
                    </Box>

                    <Box sx={{ px: { xs: 3, sm: 4 }, pb: { xs: 3, sm: 4 } }}>
                        <Stack spacing={2.5}>
                            {formError && (
                                <Alert severity="error" onClose={() => setFormError(null)}>
                                    {formError}
                                </Alert>
                            )}

                            <Box component="form" onSubmit={handleSubmit} noValidate>
                                <Stack spacing={2}>
                                    <TextField
                                        fullWidth
                                        label="Nazwa użytkownika"
                                        value={username}
                                        onChange={(e) => {
                                            setUsername(e.target.value);
                                            setFieldErrors((p) => ({ ...p, username: undefined }));
                                            setFormError(null);
                                        }}
                                        required
                                        autoFocus
                                        disabled={loading}
                                        error={Boolean(fieldErrors.username)}
                                        helperText={fieldErrors.username || ' '}
                                        size="medium"
                                    />

                                    <TextField
                                        fullWidth
                                        label="Hasło"
                                        type="password"
                                        value={password}
                                        onChange={(e) => {
                                            setPassword(e.target.value);
                                            setFieldErrors((p) => ({ ...p, password: undefined }));
                                            setFormError(null);
                                        }}
                                        required
                                        disabled={loading}
                                        error={Boolean(fieldErrors.password)}
                                        helperText={fieldErrors.password || ' '}
                                        size="medium"
                                    />

                                    <Button
                                        fullWidth
                                        type="submit"
                                        variant="contained"
                                        size="large"
                                        disabled={!canSubmit}
                                        startIcon={
                                            loading ? <CircularProgress size={20} /> : <Login />
                                        }
                                        sx={{ py: 1.4, fontWeight: 800, borderRadius: 2 }}
                                    >
                                        {loading ? 'Logowanie…' : 'Zaloguj się'}
                                    </Button>

                                    <Typography
                                        variant="body2"
                                        color="text.secondary"
                                        sx={{ textAlign: 'center' }}
                                    >
                                        Jeśli masz problem z logowaniem, skontaktuj się z
                                        administratorem.
                                    </Typography>
                                </Stack>
                            </Box>
                        </Stack>
                    </Box>
                </Paper>
            </Container>

            <Snackbar
                open={snack.open}
                autoHideDuration={1500}
                onClose={() => setSnack((p) => ({ ...p, open: false }))}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert
                    onClose={() => setSnack((p) => ({ ...p, open: false }))}
                    severity={snack.severity}
                    sx={{ width: '100%' }}
                >
                    {snack.msg}
                </Alert>
            </Snackbar>
        </Box>
    );
};

export default LoginPage;
