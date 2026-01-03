import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormikHelpers } from 'formik';
import { Add } from '@mui/icons-material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { Alert, Box, Button, IconButton, Paper, Snackbar, Stack, Tooltip, Typography } from '@mui/material';

import { clientsApi } from '@/api/clients';
import { usersApi } from '@/api/users';
import type { Client, DRFPaginated } from '@/types';
import { parseDrfError } from '@/utils/drfErrors';

import type { ClientFormData, SnackbarState } from './types';
import {
    buildClientCreatePayload,
    buildClientUpdatePayload,
    firstFromDrf,
    getBestErrorMessage,
    getResponseData,
    ORDERING_OPTIONS,
} from './utils';

import ClientsFiltersPanel from './components/ClientsFiltersPanel';
import ClientsTable from './components/ClientsTable';
import ClientFormDialog from './components/ClientFormDialog';
import DeleteClientDialog from './components/DeleteClientDialog';
import ClientViewDialog from './components/ClientViewDialog';
import ResetClientPasswordDialog from './components/ResetClientPasswordDialog';

const ClientsPage: React.FC = () => {
    const [data, setData] = useState<DRFPaginated<Client> | null>(null);
    const [page, setPage] = useState(1);

    const [draftSearch, setDraftSearch] = useState('');
    const [draftClientNumber, setDraftClientNumber] = useState('');
    const [draftOnlyActive, setDraftOnlyActive] = useState(false);
    const [draftOrdering, setDraftOrdering] = useState<string>('-created_at');

    const [search, setSearch] = useState('');
    const [clientNumber, setClientNumber] = useState('');
    const [onlyActive, setOnlyActive] = useState(false);
    const [ordering, setOrdering] = useState<string>('-created_at');

    const [loading, setLoading] = useState(true);

    const [pageError, setPageError] = useState<string | null>(null);
    const [formError, setFormError] = useState<string | null>(null);

    const [snack, setSnack] = useState<SnackbarState>({ open: false, msg: '', severity: 'info' });

    const [formOpen, setFormOpen] = useState(false);
    const [editingClient, setEditingClient] = useState<Client | null>(null);

    const [deleteOpen, setDeleteOpen] = useState(false);
    const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
    const [deleting, setDeleting] = useState(false);

    const [viewOpen, setViewOpen] = useState(false);
    const [viewingClient, setViewingClient] = useState<Client | null>(null);

    const [resetOpen, setResetOpen] = useState(false);
    const [resetTarget, setResetTarget] = useState<Client | null>(null);
    const [p1, setP1] = useState('');
    const [p2, setP2] = useState('');
    const [resetErr, setResetErr] = useState<string | null>(null);
    const [resetSaving, setResetSaving] = useState(false);

    const busy = loading || deleting || resetSaving;

    const hasActiveFiltersDraft =
        Boolean(draftSearch.trim()) ||
        Boolean(draftClientNumber.trim()) ||
        draftOnlyActive ||
        draftOrdering !== '-created_at';

    const hasActiveFiltersApplied =
        Boolean(search.trim()) ||
        Boolean(clientNumber.trim()) ||
        onlyActive ||
        ordering !== '-created_at';

    const hasUnappliedChanges =
        draftSearch !== search ||
        draftClientNumber !== clientNumber ||
        draftOnlyActive !== onlyActive ||
        draftOrdering !== ordering;

    const applyFilters = () => {
        setPage(1);
        setSearch(draftSearch);
        setClientNumber(draftClientNumber);
        setOnlyActive(draftOnlyActive);
        setOrdering(draftOrdering);
    };

    const resetFilters = () => {
        setDraftSearch('');
        setDraftClientNumber('');
        setDraftOnlyActive(false);
        setDraftOrdering('-created_at');

        setPage(1);
        setSearch('');
        setClientNumber('');
        setOnlyActive(false);
        setOrdering('-created_at');
    };

    const loadClients = useCallback(async () => {
        try {
            setLoading(true);
            setPageError(null);

            const res = await clientsApi.list({
                page,
                ordering,
                search: search.trim() || undefined,
                is_active: onlyActive ? true : undefined,
                client_number: clientNumber.trim() || undefined,
            });

            setData(res);
        } catch (err: unknown) {
            const parsed = parseDrfError(err);
            setPageError(parsed.message || 'Nie udało się pobrać klientów. Spróbuj ponownie.');
            setData({ count: 0, next: null, previous: null, results: [] });
        } finally {
            setLoading(false);
        }
    }, [page, ordering, search, onlyActive, clientNumber]);

    const loadAll = useCallback(async () => {
        await loadClients();
    }, [loadClients]);

    useEffect(() => {
        void loadAll();
    }, [loadAll]);

    const clients = useMemo(() => data?.results ?? [], [data]);

    const canPrev = Boolean(data?.previous) && !busy;
    const canNext = Boolean(data?.next) && !busy;

    const openCreate = () => {
        setFormError(null);
        setEditingClient(null);
        setFormOpen(true);
    };

    const openEdit = (client: Client) => {
        setFormError(null);
        setEditingClient(client);
        setFormOpen(true);
    };

    const openView = (client: Client) => {
        setViewingClient(client);
        setViewOpen(true);
    };

    const openReset = (client: Client) => {
        setResetErr(null);
        setP1('');
        setP2('');
        setResetTarget(client);
        setResetOpen(true);
    };

    const openDelete = (client: Client) => {
        setPageError(null);
        setClientToDelete(client);
        setDeleteOpen(true);
    };

    const handleSubmit = async (
    values: ClientFormData,
    helpers: FormikHelpers<ClientFormData>,
) => {
    const { setErrors } = helpers;


        try {
            setFormError(null);

            if (!editingClient) {
                const payload = buildClientCreatePayload(values);
                await clientsApi.create(payload);
                setSnack({ open: true, msg: 'Utworzono klienta.', severity: 'success' });
            } else {
                const payload = buildClientUpdatePayload(values);
                await clientsApi.update(editingClient.id, payload);
                setSnack({ open: true, msg: 'Zapisano zmiany.', severity: 'success' });
            }

            await loadAll();
            setFormOpen(false);
            setEditingClient(null);
        } catch (err: unknown) {
            const { fieldErrors } = parseDrfError(err);

            const d = getResponseData(err);
const nextFieldErrors: Record<string, string> = { ...(fieldErrors || {}) };

if (!editingClient && !nextFieldErrors.password) {
    const obj = d && typeof d === 'object' ? (d as Record<string, unknown>) : undefined;
    const nfe = firstFromDrf(obj?.non_field_errors);
    if (nfe) nextFieldErrors.password = nfe;
}


            if (Object.keys(nextFieldErrors).length) setErrors(nextFieldErrors);

            const msg = getBestErrorMessage(err);

            if (msg) setFormError(msg);
            else if (Object.keys(nextFieldErrors).length)
                setFormError('Nie udało się zapisać — popraw zaznaczone pola i spróbuj ponownie.');
            else setFormError('Nie udało się zapisać. Spróbuj ponownie.');
        }
    };

    const handleDelete = async () => {
        if (!clientToDelete) return;
        try {
            setDeleting(true);
            setPageError(null);
            await clientsApi.delete(clientToDelete.id);
            setSnack({ open: true, msg: 'Usunięto klienta.', severity: 'success' });

            setDeleteOpen(false);
            setClientToDelete(null);
            await loadAll();
        } catch (err: unknown) {
            const parsed = parseDrfError(err);
            setPageError(parsed.message || 'Nie udało się usunąć klienta. Spróbuj ponownie.');
        } finally {
            setDeleting(false);
        }
    };

    const handleResetPassword = async () => {
        if (!resetTarget) return;

        setResetErr(null);

        if (p1.length < 8) {
            setResetErr('Hasło musi mieć co najmniej 8 znaków.');
            return;
        }
        if (p1 !== p2) {
            setResetErr('Hasła nie są identyczne.');
            return;
        }

        try {
            setResetSaving(true);
            await usersApi.resetPassword(resetTarget.user_id, {
                new_password: p1,
                new_password2: p2,
            });

            setSnack({ open: true, msg: 'Zresetowano hasło klienta.', severity: 'success' });
            setResetOpen(false);
            await loadAll();
        } catch (err: unknown) {
            const d = getResponseData(err);
const obj = d && typeof d === 'object' ? (d as Record<string, unknown>) : undefined;

setResetErr(
    getBestErrorMessage(err) ||
        firstFromDrf(obj?.new_password) ||
        firstFromDrf(obj?.new_password2) ||
        'Nie udało się zresetować hasła. Spróbuj ponownie.',
);

        } finally {
            setResetSaving(false);
        }
    };

    const emptyInfo =
        !loading && clients.length === 0
            ? hasActiveFiltersApplied
                ? 'Brak wyników dla podanych filtrów. Zmień filtry i kliknij „Zastosuj”.'
                : 'Brak klientów. Dodaj pierwszego klienta.'
            : null;

    return (
        <Stack spacing={2}>
            <Box
                sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: { xs: 'stretch', md: 'flex-start' },
                    gap: 2,
                    flexWrap: 'wrap',
                }}
            >
                <Box sx={{ minWidth: 240 }}>
                    <Typography variant="h5" sx={{ fontWeight: 800 }}>
                        Zarządzanie klientami
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        Łącznie: {data?.count ?? '—'} • Strona: {page} • Sortowanie:{' '}
                        {ORDERING_OPTIONS.find((o) => o.value === ordering)?.label ?? ordering}
                    </Typography>
                </Box>

                <Stack direction="row" spacing={1} alignItems="center">
                    <Tooltip title="Odśwież">
                        <span>
                            <IconButton onClick={() => void loadAll()} disabled={busy} aria-label="Odśwież listę">
                                <RefreshIcon />
                            </IconButton>
                        </span>
                    </Tooltip>

                    <Button variant="contained" startIcon={<Add />} onClick={openCreate} disabled={busy}>
                        Dodaj klienta
                    </Button>
                </Stack>
            </Box>

            {pageError && (
                <Alert severity="error" onClose={() => setPageError(null)}>
                    {pageError}
                </Alert>
            )}

            <ClientsFiltersPanel
                busy={busy}
                draftSearch={draftSearch}
                setDraftSearch={setDraftSearch}
                draftClientNumber={draftClientNumber}
                setDraftClientNumber={setDraftClientNumber}
                draftOnlyActive={draftOnlyActive}
                setDraftOnlyActive={setDraftOnlyActive}
                draftOrdering={draftOrdering}
                setDraftOrdering={setDraftOrdering}
                hasActiveFiltersDraft={hasActiveFiltersDraft}
                hasActiveFiltersApplied={hasActiveFiltersApplied}
                hasUnappliedChanges={hasUnappliedChanges}
                applyFilters={applyFilters}
                resetFilters={resetFilters}
            />

            <Paper variant="outlined" sx={{ p: 2 }}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }}>
                    <Stack direction="row" spacing={1}>
                        <Button
                            disabled={!canPrev}
                            variant="outlined"
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                        >
                            Poprzednia
                        </Button>
                        <Button disabled={!canNext} variant="contained" onClick={() => setPage((p) => p + 1)}>
                            Następna
                        </Button>
                    </Stack>
                    <Box sx={{ flex: 1 }} />
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        {loading ? 'Odświeżanie…' : `Wyświetlono: ${clients.length}`}
                    </Typography>
                </Stack>
            </Paper>

            <ClientsTable
                clients={clients}
                loading={loading}
                busy={busy}
                emptyInfo={emptyInfo}
                onView={openView}
                onEdit={openEdit}
                onReset={openReset}
                onDelete={openDelete}
            />

            <ClientFormDialog
                open={formOpen}
                editingClient={editingClient}
                onClose={() => {
                    if (busy) return;
                    setFormOpen(false);
                    setEditingClient(null);
                    setFormError(null);
                }}
                onSubmit={handleSubmit}
                formError={formError}
                clearFormError={() => setFormError(null)}
            />

            <DeleteClientDialog
                open={deleteOpen}
                client={clientToDelete}
                deleting={deleting}
                onClose={() => {
                    if (deleting) return;
                    setDeleteOpen(false);
                }}
                onConfirm={handleDelete}
            />

            <ClientViewDialog open={viewOpen} client={viewingClient} onClose={() => setViewOpen(false)} />

            <ResetClientPasswordDialog
                open={resetOpen}
                client={resetTarget}
                p1={p1}
                p2={p2}
                setP1={setP1}
                setP2={setP2}
                error={resetErr}
                saving={resetSaving}
                onClose={() => {
                    if (resetSaving) return;
                    setResetOpen(false);
                }}
                onConfirm={handleResetPassword}
            />

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

export default ClientsPage;
