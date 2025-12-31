import React from 'react';
import {
    Alert,
    Button,
    Checkbox,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControl,
    InputLabel,
    ListItemText,
    MenuItem,
    OutlinedInput,
    Select,
    Stack,
    TextField,
    Typography,
} from '@mui/material';
import type { Service } from '@/types';
import type { EmployeeFormState, FieldErrors } from '../types';

type Props = {
    open: boolean;
    onClose: () => void;

    busy: boolean;
    isEdit: boolean;

    form: EmployeeFormState;
    setForm: React.Dispatch<React.SetStateAction<EmployeeFormState>>;

    services: Service[];
    serviceMap: Map<number, Service>;

    formError: string | null;
    setFormError: (v: string | null) => void;

    formFieldErrors: FieldErrors;

    onSave: () => void;
    actionLoading: boolean;
};

export default function EmployeeFormDialog(props: Props): JSX.Element {
    const {
        open,
        onClose,
        busy,
        isEdit,
        form,
        setForm,
        services,
        serviceMap,
        formError,
        setFormError,
        formFieldErrors,
        onSave,
        actionLoading,
    } = props;

    return (
        <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="sm">
            <DialogTitle>{isEdit ? 'Edytuj pracownika' : 'Dodaj pracownika'}</DialogTitle>
            <DialogContent dividers>
                <Stack spacing={2}>
                    {formError && (
                        <Alert severity="error" onClose={() => setFormError(null)}>
                            {formError}
                        </Alert>
                    )}

                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                        <TextField
                            label="Imię"
                            value={form.first_name}
                            onChange={(e) => setForm((p) => ({ ...p, first_name: e.target.value }))}
                            fullWidth
                            disabled={busy}
                            error={Boolean(formFieldErrors.first_name)}
                            helperText={formFieldErrors.first_name || ' '}
                        />
                        <TextField
                            label="Nazwisko"
                            value={form.last_name}
                            onChange={(e) => setForm((p) => ({ ...p, last_name: e.target.value }))}
                            fullWidth
                            disabled={busy}
                            error={Boolean(formFieldErrors.last_name)}
                            helperText={formFieldErrors.last_name || ' '}
                        />
                    </Stack>

                    <TextField
                        label="Telefon"
                        value={form.phone}
                        onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                        fullWidth
                        placeholder="+48123123123"
                        disabled={busy}
                        error={Boolean(formFieldErrors.phone)}
                        helperText={formFieldErrors.phone || ' '}
                    />

                    {!isEdit && (
                        <TextField
                            label="Email (dla konta)"
                            value={form.email}
                            onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                            fullWidth
                            required
                            disabled={busy}
                            error={Boolean(formFieldErrors.email)}
                            helperText={formFieldErrors.email || ' '}
                        />
                    )}

                    {!isEdit && (
                        <TextField
                            label="Hasło"
                            type="password"
                            value={form.password}
                            onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                            fullWidth
                            required
                            disabled={busy}
                            error={Boolean(formFieldErrors.password)}
                            helperText={formFieldErrors.password || 'Minimum 8 znaków'}
                            autoComplete="new-password"
                        />
                    )}

                    <FormControl fullWidth disabled={busy} error={Boolean(formFieldErrors.skill_ids)}>
                        <InputLabel id="skills-label">Usługi</InputLabel>
                        <Select
                            labelId="skills-label"
                            multiple
                            value={form.skill_ids}
                            onChange={(e) => setForm((p) => ({ ...p, skill_ids: e.target.value as number[] }))}
                            input={<OutlinedInput label="Usługi" />}
                            renderValue={(selected) =>
                                (selected as number[])
                                    .map((id) => serviceMap.get(id)?.name || `#${id}`)
                                    .join(', ')
                            }
                        >
                            {services.map((s) => (
                                <MenuItem key={s.id} value={s.id}>
                                    <Checkbox checked={form.skill_ids.includes(s.id)} />
                                    <ListItemText primary={s.name} secondary={s.category || ''} />
                                </MenuItem>
                            ))}
                        </Select>
                        <Typography
                            variant="caption"
                            color={formFieldErrors.skill_ids ? 'error' : 'text.secondary'}
                            sx={{ mt: 0.5 }}
                        >
                            {formFieldErrors.skill_ids || ' '}
                        </Typography>
                    </FormControl>

                    <FormControl fullWidth disabled={busy}>
                        <InputLabel id="active-label">Status</InputLabel>
                        <Select
                            labelId="active-label"
                            value={form.is_active ? '1' : '0'}
                            label="Status"
                            onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.value === '1' }))}
                        >
                            <MenuItem value="1">Aktywny</MenuItem>
                            <MenuItem value="0">Nieaktywny</MenuItem>
                        </Select>
                    </FormControl>
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} disabled={busy}>
                    Anuluj
                </Button>
                <Button
                    onClick={onSave}
                    variant="contained"
                    disabled={busy}
                    startIcon={actionLoading ? <CircularProgress size={18} /> : undefined}
                >
                    Zapisz
                </Button>
            </DialogActions>
        </Dialog>
    );
}
