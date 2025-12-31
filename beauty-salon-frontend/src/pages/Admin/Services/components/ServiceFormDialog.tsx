import React from 'react';
import {
    Alert,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControlLabel,
    Stack,
    Switch,
    TextField,
} from '@mui/material';

import type { Service } from '@/types';
import type { FormState } from '../types';

export default function ServiceFormDialog(props: {
    open: boolean;
    edit: Service | null;
    form: FormState;
    setForm: React.Dispatch<React.SetStateAction<FormState>>;
    fieldErrors: Partial<Record<keyof FormState, string>>;
    formError: string | null;
    saving: boolean;
    onClose: () => void;
    onSave: () => Promise<void>;
}) {
    const { open, edit, form, setForm, fieldErrors, formError, saving, onClose, onSave } = props;

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
            <DialogTitle>{edit ? 'Edytuj usługę' : 'Dodaj usługę'}</DialogTitle>

            <DialogContent>
                <Stack spacing={2} sx={{ mt: 1 }}>
                    {formError && <Alert severity="error">{formError}</Alert>}

                    <TextField
                        label="Nazwa"
                        value={form.name}
                        onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                        required
                        fullWidth
                        autoFocus
                        disabled={saving}
                        error={Boolean(fieldErrors.name)}
                        helperText={fieldErrors.name}
                    />

                    <TextField
                        label="Kategoria"
                        value={form.category}
                        onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                        fullWidth
                        disabled={saving}
                        error={Boolean(fieldErrors.category)}
                        helperText={fieldErrors.category || 'Opcjonalnie (ułatwia filtrowanie i wyszukiwanie).'}
                    />

                    <TextField
                        label="Opis"
                        value={form.description}
                        onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                        fullWidth
                        disabled={saving}
                        multiline
                        minRows={3}
                        error={Boolean(fieldErrors.description)}
                        helperText={fieldErrors.description}
                    />

                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                        <TextField
                            label="Cena (zł)"
                            value={form.price}
                            onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))}
                            fullWidth
                            disabled={saving}
                            inputMode="decimal"
                            error={Boolean(fieldErrors.price)}
                            helperText={fieldErrors.price}
                        />

                        <TextField
                            label="Czas (min)"
                            value={form.duration_minutes}
                            onChange={(e) => setForm((p) => ({ ...p, duration_minutes: e.target.value }))}
                            fullWidth
                            disabled={saving}
                            inputMode="numeric"
                            error={Boolean(fieldErrors.duration_minutes)}
                            helperText={fieldErrors.duration_minutes}
                        />
                    </Stack>

                    <FormControlLabel
                        control={
                            <Switch
                                checked={form.is_active}
                                onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))}
                                disabled={saving}
                            />
                        }
                        label="Usługa aktywna"
                    />
                </Stack>
            </DialogContent>

            <DialogActions>
                <Button onClick={onClose} disabled={saving}>
                    Anuluj
                </Button>
                <Button onClick={() => void onSave()} variant="contained" disabled={saving}>
                    {saving ? 'Zapisuję...' : 'Zapisz'}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
