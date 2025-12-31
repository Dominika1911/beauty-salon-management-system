import React from 'react';
import {
    Alert,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControlLabel,
    Switch,
    TextField,
} from '@mui/material';
import { Field, Form, Formik, type FormikHelpers } from 'formik';

import type { Client } from '@/types';
import type { ClientFormData } from '../types';
import { CreateClientSchema, EditClientSchema } from '../utils';

export default function ClientFormDialog(props: {
    open: boolean;
    editingClient: Client | null;
    onClose: () => void;
    onSubmit: (values: ClientFormData, helpers: FormikHelpers<ClientFormData>) => Promise<void>;
    formError: string | null;
    clearFormError: () => void;
}) {
    const { open, editingClient, onClose, onSubmit, formError, clearFormError } = props;

    const validationSchema = editingClient ? EditClientSchema : CreateClientSchema;

    return (
        <Formik<ClientFormData>
            enableReinitialize
            initialValues={{
                first_name: editingClient?.first_name || '',
                last_name: editingClient?.last_name || '',
                phone: editingClient?.phone || '',
                email: editingClient?.email ?? '',
                password: '',
                internal_notes: editingClient?.internal_notes ?? '',
                is_active: editingClient?.is_active ?? true,
            }}
            validationSchema={validationSchema}
            onSubmit={onSubmit}
        >
            {({ errors, touched, values, setFieldValue, isSubmitting }) => {
                const helper = <T extends keyof ClientFormData>(name: T) => {
                    const isTouched = Boolean(touched[name]);
                    const err = errors[name];
                    return isTouched && typeof err === 'string' ? err : ' ';
                };

                const hasErr = <T extends keyof ClientFormData>(name: T) =>
                    Boolean(touched[name] && errors[name]);

                return (
                    <Dialog
                        open={open}
                        onClose={
                            isSubmitting
                                ? undefined
                                : () => {
                                      clearFormError();
                                      onClose();
                                  }
                        }
                        disableEscapeKeyDown={isSubmitting}
                        maxWidth="sm"
                        fullWidth
                        PaperProps={{ variant: 'outlined' }}
                    >
                        <DialogTitle>{editingClient ? 'Edytuj klienta' : 'Nowy klient'}</DialogTitle>

                        <Form>
                            <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }} dividers>
                                {formError && (
                                    <Alert severity="error" onClose={clearFormError}>
                                        {formError}
                                    </Alert>
                                )}

                                <Field
                                    as={TextField}
                                    name="first_name"
                                    label="Imię"
                                    error={hasErr('first_name')}
                                    helperText={helper('first_name')}
                                    disabled={isSubmitting}
                                />
                                <Field
                                    as={TextField}
                                    name="last_name"
                                    label="Nazwisko"
                                    error={hasErr('last_name')}
                                    helperText={helper('last_name')}
                                    disabled={isSubmitting}
                                />
                                <Field
                                    as={TextField}
                                    name="phone"
                                    label="Telefon"
                                    error={hasErr('phone')}
                                    helperText={helper('phone')}
                                    disabled={isSubmitting}
                                />
                                <Field
                                    as={TextField}
                                    name="email"
                                    label="E-mail (opcjonalnie)"
                                    error={hasErr('email')}
                                    helperText={helper('email')}
                                    disabled={isSubmitting}
                                />

                                {!editingClient && (
                                    <Field
                                        as={TextField}
                                        name="password"
                                        label="Hasło"
                                        type="password"
                                        error={hasErr('password')}
                                        helperText={helper('password')}
                                        disabled={isSubmitting}
                                    />
                                )}

                                <Field
                                    as={TextField}
                                    name="internal_notes"
                                    label="Notatki"
                                    multiline
                                    rows={3}
                                    error={hasErr('internal_notes')}
                                    helperText={helper('internal_notes')}
                                    disabled={isSubmitting}
                                />

                                <FormControlLabel
                                    control={
                                        <Switch
                                            checked={values.is_active}
                                            onChange={(e) => setFieldValue('is_active', e.target.checked)}
                                            disabled={isSubmitting}
                                        />
                                    }
                                    label="Aktywny"
                                />
                            </DialogContent>

                            <DialogActions sx={{ px: 3, pb: 2 }}>
                                <Button
                                    onClick={() => {
                                        clearFormError();
                                        onClose();
                                    }}
                                    disabled={isSubmitting}
                                >
                                    Anuluj
                                </Button>
                                <Button type="submit" variant="contained" disabled={isSubmitting}>
                                    Zapisz
                                </Button>
                            </DialogActions>
                        </Form>
                    </Dialog>
                );
            }}
        </Formik>
    );
}
