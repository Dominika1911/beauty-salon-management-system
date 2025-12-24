import React, { useEffect, useState } from 'react';
import {
    Box,
    Card,
    CardContent,
    Typography,
    TextField,
    Button,
    Grid,
    CircularProgress,
    Alert
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import apiClient from "../../api/axios";

// Definicja typu zgodna z Twoim backendem
interface SystemSettings {
    salon_name: string;
    slot_minutes: number;
    buffer_minutes: number;
}

const SystemSettingsPage: React.FC = () => {
    const [settings, setSettings] = useState<SystemSettings | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [saving, setSaving] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            setLoading(true);
            const response = await apiClient.get<SystemSettings>('/system-settings/');
            setSettings(response.data);
        } catch (err) {
            setError('Nie udało się pobrać ustawień salonu.');
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        if (settings) {
            setSettings({
                ...settings,
                [name]: name === 'salon_name' ? value : parseInt(value) || 0
            });
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!settings) return;

        try {
            setSaving(true);
            await apiClient.patch('/system-settings/', settings);
            // Możesz tu dodać np. Snackbar (powiadomienie) o sukcesie
            alert('Ustawienia zapisane pomyślnie!');
        } catch (err) {
            setError('Błąd podczas zapisywania ustawień.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return (
        <Box display="flex" justifyContent="center" mt={10}>
            <CircularProgress />
        </Box>
    );

    return (
        <Box sx={{ p: 4, maxWidth: 800, margin: '0 auto' }}>
            <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold' }}>
                Ustawienia Systemowe
            </Typography>
            <Typography variant="body1" color="text.secondary" paragraph>
                Te ustawienia kontrolują działanie Twojego salonu, w tym czas trwania slotów w kalendarzu oraz wymagany bufor między wizytami.
            </Typography>

            {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

            <Card elevation={3}>
                <CardContent>
                    <Box component="form" onSubmit={handleSubmit}>
                        <Grid container spacing={3}>
                            {/* Nazwa Salonu */}
                            <Grid item xs={12}>
                                <TextField
                                    fullWidth
                                    label="Nazwa Salonu"
                                    name="salon_name"
                                    value={settings?.salon_name || ''}
                                    onChange={handleChange}
                                    required
                                />
                            </Grid>

                            {/* Slot Minutes */}
                            <Grid item xs={12} md={6}>
                                <TextField
                                    fullWidth
                                    type="number"
                                    label="Czas slotu (minuty)"
                                    name="slot_minutes"
                                    value={settings?.slot_minutes || ''}
                                    onChange={handleChange}
                                    helperText="Podstawowy podział czasu w kalendarzu"
                                    required
                                />
                            </Grid>

                            {/* Buffer Minutes */}
                            <Grid item xs={12} md={6}>
                                <TextField
                                    fullWidth
                                    type="number"
                                    label="Bufor (minuty)"
                                    name="buffer_minutes"
                                    value={settings?.buffer_minutes || ''}
                                    onChange={handleChange}
                                    helperText="Czas wolny między usługami"
                                    required
                                />
                            </Grid>

                            <Grid item xs={12}>
                                <Button
                                    type="submit"
                                    variant="contained"
                                    size="large"
                                    startIcon={saving ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
                                    disabled={saving}
                                >
                                    {saving ? 'Zapisywanie...' : 'Zapisz zmiany'}
                                </Button>
                            </Grid>
                        </Grid>
                    </Box>
                </CardContent>
            </Card>
        </Box>
    );
};

export default SystemSettingsPage;