import React from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from '@mui/material';
import type { Client } from '@/types';

export default function ClientViewDialog(props: { open: boolean; client: Client | null; onClose: () => void }) {
    const { open, client, onClose } = props;

    return (
        <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ variant: 'outlined' }}>
            <DialogTitle>Karta klienta</DialogTitle>
            <DialogContent dividers>
                {client && (
                    <Stack spacing={1.25} sx={{ py: 1 }}>
                        <Typography variant="h6" sx={{ fontWeight: 800 }}>
                            {client.first_name} {client.last_name}
                        </Typography>
                        <Typography variant="body2">
                            <strong>Nr klienta:</strong> {client.client_number}
                        </Typography>
                        <Typography variant="body2">
                            <strong>E-mail:</strong> {client.email || '—'}
                        </Typography>
                        <Typography variant="body2">
                            <strong>Telefon:</strong> {client.phone || '—'}
                        </Typography>
                        <Typography variant="body2">
                            <strong>Wizyty:</strong> {client.appointments_count}
                        </Typography>
                        <Typography variant="body2">
                            <strong>Notatki:</strong> {client.internal_notes || 'Brak'}
                        </Typography>
                        <Typography variant="body2">
                            <strong>Dołączył:</strong> {new Date(client.created_at).toLocaleDateString('pl-PL')}
                        </Typography>
                    </Stack>
                )}
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
                <Button onClick={onClose}>Zamknij</Button>
            </DialogActions>
        </Dialog>
    );
}
