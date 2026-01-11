import React, { useMemo, useState } from 'react';
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    CircularProgress,
    Divider,
    Grid,
    Snackbar,
    Stack,
    TextField,
    Typography,
} from '@mui/material';
import type { AlertColor } from '@mui/material/Alert';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';

import { useAuth } from '@/context/AuthContext';
import { authApi } from '@/api/auth';
import { parseDrfError, pickFieldErrors } from '@/utils/drfErrors';

type SnackState = {
    open: boolean;
    msg: string;
    severity: AlertColor;
};

type PasswordFields = {
    old_password?: string;
    new_password?: string;
    new_password2?: string;
};

const ProfilePage: React.FC = () => {
    const { user, refreshUser } = useAuth();

    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [newPassword2, setNewPassword2] = useState('');

    const [saving, setSaving] = useState(false);

    const [pageError, setPageError] = useState<string | null>(null);
    const [formError, setFormError] = useState<string | null>(null);
    const [fieldErrors, setFieldErrors] = useState<PasswordFields>({});
    const [snack, setSnack] = useState<SnackState>({ open: false, msg: '', severity: 'success' });

    const busy = saving;

    const roleChip = useMemo(() => {
        if (!user) return { label: '—', color: 'default' as const };
        if (user.role === 'ADMIN') return { label: user.role_display, color: 'error' as const };
        if (user.role === 'EMPLOYEE') return { label: user.role_display, color: 'primary' as const };
        return { label: user.role_display, color: 'success' as const };
    }, [user]);

    const clearErrors = () => {
        setPageError(null);
        setFormError(null);
        setFieldErrors({});
    };

    const validateClient = (): string | null => {
        if (newPassword !== newPassword2) return 'Nowe hasło i powtórzenie muszą być identyczne.';
        if (newPassword.length < 8) return 'Nowe hasło musi mieć co najmniej 8 znaków.';
        return null;
    };

    // Client-side helper texts (żeby nie czekać na submit)
    const clientErrors = useMemo(() => {
        const errs: Partial<PasswordFields> = {};

        // Nie pokazuj błędu długości, gdy pole puste – UX lepszy, a nie zmienia wymagań
        if (newPassword && newPassword.length < 8) {
            errs.new_password = 'Nowe hasło musi mieć co najmniej 8 znaków.';
        }

        // Mismatch pokazujemy dopiero gdy użytkownik coś wpisał w powtórzenie
        if (newPassword2 && newPassword !== newPassword2) {
            errs.new_password2 = 'Nowe hasło i powtórzenie muszą być identyczne.';
        }

        return errs;
    }, [newPassword, newPassword2]);

    const canSubmit =
        Boolean(oldPassword) &&
        Boolean(newPassword) &&
        Boolean(newPassword2) &&
        !busy &&
        Object.keys(clientErrors).length === 0;

    const handleChangePassword = async () => {
        if (!user) return;

        clearErrors();

        // Ochrona na wypadek ręcznego odpalenia handlera mimo disabled
        const v = validateClient();
        if (v) {
            setFormError(v);
            return;
        }

        try {
            setSaving(true);

            await authApi.changePassword({
                old_password: oldPassword,
                new_password: newPassword,
                new_password2: newPassword2,
            });

            setOldPassword('');
            setNewPassword('');
            setNewPassword2('');

            setSnack({ open: true, msg: 'Hasło zostało zmienione.', severity: 'success' });
            await refreshUser();
        } catch (e: unknown) {
            const parsed = parseDrfError(e);
            setFormError(parsed.message || 'Nie udało się zmienić hasła. Spróbuj ponownie.');

            const picked = pickFieldErrors<PasswordFields>(parsed.fieldErrors, {
                old_password: 'Aktualne hasło',
                new_password: 'Nowe hasło',
                new_password2: 'Powtórz nowe hasło',
            });

            setFieldErrors(picked);
        } finally {
            setSaving(false);
        }
    };

    if (!user) {
        return (
            <Box
                sx={{
                    width: '100%',
                    maxWidth: 900,
                    mx: 'auto',
                    px: { xs: 1, sm: 2 },
                    py: { xs: 2, sm: 3 },
                }}
            >
                <Alert severity="error">Nie jesteś zalogowany.</Alert>
            </Box>
        );
    }

    return (
        <Stack
            spacing={2}
            sx={{
                width: '100%',
                maxWidth: 1000,
                mx: 'auto',
                px: { xs: 1, sm: 2 },
                py: { xs: 2, sm: 3 },
            }}
        >
            <Box
                sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: { xs: 'flex-start', sm: 'center' },
                    gap: 2,
                    flexWrap: 'wrap',
                }}
            >
                <Box>
                    <Typography variant="h5" fontWeight={900}>
                        Mój profil
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        Dane konta i ustawienia bezpieczeństwa.
                    </Typography>
                </Box>

                <Button
                    variant="contained"
                    onClick={() => void handleChangePassword()}
                    disabled={!canSubmit}
                    startIcon={saving ? <CircularProgress size={18} /> : undefined}
                >
                    {saving ? 'Zapisywanie…' : 'Zmień hasło'}
                </Button>
            </Box>

            {pageError && (
                <Alert severity="error" onClose={() => setPageError(null)}>
                    {pageError}
                </Alert>
            )}

            <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                    <Card variant="outlined" sx={{ height: '100%' }}>
                        <CardContent>
                            <Stack spacing={2}>
                                <Box>
                                    <Typography variant="h6" fontWeight={900}>
                                        Dane użytkownika
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        Informacje konta są tylko do podglądu.
                                    </Typography>
                                </Box>

                                <Stack spacing={1.5}>
                                    <TextField
                                        label="Login"
                                        value={user.username}
                                        fullWidth
                                        disabled
                                        variant="outlined"
                                        size="small"
                                    />
                                    <TextField
                                        label="Imię"
                                        value={user.first_name || '—'}
                                        fullWidth
                                        disabled
                                        variant="outlined"
                                        size="small"
                                    />
                                    <TextField
                                        label="Nazwisko"
                                        value={user.last_name || '—'}
                                        fullWidth
                                        disabled
                                        variant="outlined"
                                        size="small"
                                    />
                                    <TextField
                                        label="Email"
                                        value={user.email || '—'}
                                        fullWidth
                                        disabled
                                        variant="outlined"
                                        size="small"
                                    />
                                </Stack>

                                <Divider />

                                <Stack
                                    direction="row"
                                    spacing={1}
                                    alignItems="center"
                                    flexWrap="wrap"
                                    useFlexGap
                                >
                                    <Typography variant="body2" color="text.secondary">
                                        Rola:
                                    </Typography>
                                    <Chip label={roleChip.label} color={roleChip.color} />
                                </Stack>
                            </Stack>
                        </CardContent>
                    </Card>
                </Grid>

                <Grid item xs={12} md={6}>
                    <Card variant="outlined" sx={{ height: '100%' }}>
                        <CardContent>
                            <Stack spacing={2}>
                                <Stack direction="row" spacing={1} alignItems="center">
                                    <LockOutlinedIcon fontSize="small" />
                                    <Box>
                                        <Typography variant="h6" fontWeight={900}>
                                            Bezpieczeństwo
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            Zmień hasło do swojego konta.
                                        </Typography>
                                    </Box>
                                </Stack>

                                {formError && (
                                    <Alert severity="error" onClose={() => setFormError(null)}>
                                        {formError}
                                    </Alert>
                                )}

                                <TextField
                                    label="Aktualne hasło"
                                    type="password"
                                    fullWidth
                                    value={oldPassword}
                                    onChange={(e) => {
                                        setOldPassword(e.target.value);
                                        setFieldErrors((p) => ({ ...p, old_password: undefined }));
                                        setFormError(null);
                                    }}
                                    autoComplete="current-password"
                                    disabled={busy}
                                    error={Boolean(fieldErrors.old_password)}
                                    helperText={fieldErrors.old_password || ' '}
                                />

                                <TextField
                                    label="Nowe hasło"
                                    type="password"
                                    fullWidth
                                    value={newPassword}
                                    onChange={(e) => {
                                        setNewPassword(e.target.value);
                                        setFieldErrors((p) => ({ ...p, new_password: undefined }));
                                        setFormError(null);
                                    }}
                                    autoComplete="new-password"
                                    disabled={busy}
                                    error={Boolean(fieldErrors.new_password || clientErrors.new_password)}
                                    helperText={
                                        fieldErrors.new_password ||
                                        clientErrors.new_password ||
                                        'Minimum 8 znaków.'
                                    }
                                />

                                <TextField
                                    label="Powtórz nowe hasło"
                                    type="password"
                                    fullWidth
                                    value={newPassword2}
                                    onChange={(e) => {
                                        setNewPassword2(e.target.value);
                                        setFieldErrors((p) => ({ ...p, new_password2: undefined }));
                                        setFormError(null);
                                    }}
                                    autoComplete="new-password"
                                    disabled={busy}
                                    error={Boolean(fieldErrors.new_password2 || clientErrors.new_password2)}
                                    helperText={fieldErrors.new_password2 || clientErrors.new_password2 || ' '}
                                />

                                <Divider />

                                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                                    <Button
                                        variant="contained"
                                        onClick={() => void handleChangePassword()}
                                        disabled={!canSubmit}
                                        startIcon={saving ? <CircularProgress size={18} /> : undefined}
                                        fullWidth
                                    >
                                        {saving ? 'Zapisywanie…' : 'Zaktualizuj hasło'}
                                    </Button>

                                    <Button
                                        variant="outlined"
                                        onClick={() => {
                                            if (busy) return;
                                            setOldPassword('');
                                            setNewPassword('');
                                            setNewPassword2('');
                                            clearErrors();
                                        }}
                                        disabled={busy}
                                        fullWidth
                                    >
                                        Wyczyść
                                    </Button>
                                </Stack>
                            </Stack>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>

            <Snackbar
                open={snack.open}
                autoHideDuration={3200}
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
        </Stack>
    );
};

export default ProfilePage;
