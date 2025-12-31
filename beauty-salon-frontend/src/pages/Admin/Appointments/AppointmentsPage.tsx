import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Stack, Typography, Button, Paper, LinearProgress, Pagination, Snackbar, Alert, CircularProgress } from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { pl } from 'date-fns/locale';

import { appointmentsApi } from '@/api/appointments';
import { servicesApi } from '@/api/services';
import { clientsApi } from '@/api/clients';
import { employeesApi } from '@/api/employees';
import { parseDrfError } from '@/utils/drfErrors';

import { AppointmentListItem } from '@/pages/Admin/Appointments/components/AppointmentListItem.tsx';
import { AppointmentFormDialog } from '@/pages/Admin/Appointments/components/AppointmentFormDialog.tsx';
import { AppointmentFilters } from '@/pages/Admin/Appointments/components/AppointmentFilters.tsx';
import { Appointment, AppointmentStatus, DRFPaginated, Client, Employee, Service } from '@/types';

type StatusFilter = AppointmentStatus | 'ALL';
const PAGE_SIZE = 20;

// Definicja typów dla lookupów, żeby TS nie krzyczał "never[]"
interface LookupState {
    clients: Client[];
    employees: Employee[];
    services: Service[];
}

export default function AdminAppointmentsPage(): JSX.Element {
    const [data, setData] = useState<DRFPaginated<Appointment>>({ count: 0, next: null, previous: null, results: [] });
    const [page, setPage] = useState(1);
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
    const [draftStatusFilter, setDraftStatusFilter] = useState<StatusFilter>('ALL');

    const [loading, setLoading] = useState(true);
    const [busyId, setBusyId] = useState<number | null>(null);
    const [snack, setSnack] = useState({ open: false, msg: '', severity: 'info' as any });

    const [dialogOpen, setDialogOpen] = useState(false);
    const [editId, setEditId] = useState<number | null>(null);

    // 1. NAPRAWA BŁĘDU NULL: Inicjalizujemy pustym obiektem zamiast null
    const [formData, setFormData] = useState<any>({});

    // 2. NAPRAWA BŁĘDU TS2322 (never[]): Jawnie określamy typy
    const [lookups, setLookups] = useState<LookupState>({ clients: [], employees: [], services: [] });

    const busy = loading || busyId !== null;
    const hasUnappliedChanges = draftStatusFilter !== statusFilter;
    const totalPages = Math.max(1, Math.ceil((data.count || 0) / PAGE_SIZE));

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await appointmentsApi.list({
                page,
                ordering: '-created_at',
                status: statusFilter === 'ALL' ? undefined : statusFilter,
            });
            setData(res);
        } catch (e) {
            setSnack({ open: true, msg: 'Błąd pobierania wizyt', severity: 'error' });
        } finally {
            setLoading(false);
        }
    }, [page, statusFilter]);

    useEffect(() => { void load(); }, [load]);

    const runAction = async (fn: (id: number) => Promise<Appointment>, id: number, msg: string) => {
        setBusyId(id);
        try {
            const updated = await fn(id);
            setData(prev => ({
                ...prev,
                results: prev.results.map(r => r.id === updated.id ? updated : r)
            }));
            setSnack({ open: true, msg, severity: 'success' });
        } catch (e) {
            setSnack({ open: true, msg: parseDrfError(e).message || 'Błąd akcji', severity: 'error' });
        } finally { setBusyId(null); }
    };

    const handleSave = async (payload: any) => {
        if (editId) {
            const updated = await appointmentsApi.update(editId, payload);
            setData(prev => ({
                ...prev,
                results: prev.results.map(r => r.id === updated.id ? updated : r)
            }));
            setSnack({ open: true, msg: 'Zaktualizowano wizytę.', severity: 'success' });
        } else {
            await appointmentsApi.create(payload);
            void load();
            setSnack({ open: true, msg: 'Utworzono wizytę.', severity: 'success' });
        }
    };

    const openCreate = () => {
        setEditId(null);
        setFormData({ client: '', employee: '', service: '', start: new Date(), status: 'PENDING', internal_notes: '' });
        setDialogOpen(true);
        void loadLookups();
    };

    const openEdit = (a: Appointment) => {
        setEditId(a.id);
        setFormData({ ...a, start: new Date(a.start) });
        setDialogOpen(true);
        void loadLookups();
    };

    const loadLookups = async () => {
        try {
            const [c, e, s] = await Promise.all([
                clientsApi.list({ is_active: true }),
                employeesApi.list({ is_active: true }),
                servicesApi.list({ is_active: true })
            ]);
            setLookups({
                clients: c.results,
                employees: e.results as Employee[],
                services: s.results
            });
        } catch (e) {
            setSnack({ open: true, msg: 'Błąd ładowania danych pomocniczych', severity: 'error' });
        }
    };

    return (
        <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={pl}>
            <Stack spacing={2} sx={{ width: '100%', maxWidth: 1200, mx: 'auto', p: { xs: 1, sm: 3 } }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="h5" fontWeight={900}>Zarządzanie wizytami</Typography>
                    <Button variant="contained" onClick={openCreate}>+ Utwórz wizytę</Button>
                </Box>

                <AppointmentFilters
                    statusFilter={draftStatusFilter}
                    onStatusChange={setDraftStatusFilter}
                    onApply={() => { setPage(1); setStatusFilter(draftStatusFilter); }}
                    onReset={() => { setDraftStatusFilter('ALL'); setStatusFilter('ALL'); }}
                    onRefresh={load}
                    busy={busy}
                    hasActiveFilters={statusFilter !== 'ALL'}
                    hasUnappliedChanges={hasUnappliedChanges}
                />

                <Paper variant="outlined" sx={{ p: 2, position: 'relative', minHeight: 200 }}>
                    {loading && <LinearProgress sx={{ position: 'absolute', top: 0, left: 0, right: 0 }} />}

                    {data.results.length === 0 && !loading ? (
                        <Box sx={{ p: 4, textAlign: 'center' }}>
                            <Typography color="text.secondary">Brak wizyt do wyświetlenia.</Typography>
                        </Box>
                    ) : (
                        <Stack spacing={1}>
                            {data.results.map(a => (
                                <AppointmentListItem
                                    key={a.id} appointment={a} busyId={busyId} busyGlobal={busy}
                                    onEdit={openEdit} onAction={runAction}
                                />
                            ))}
                        </Stack>
                    )}

                    <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center' }}>
                        <Pagination count={totalPages} page={page} onChange={(_, p) => setPage(p)} disabled={busy} />
                    </Box>
                </Paper>

                <AppointmentFormDialog
                    open={dialogOpen} onClose={() => setDialogOpen(false)}
                    editId={editId} initialData={formData} onSave={handleSave}
                    clients={lookups.clients} employees={lookups.employees} services={lookups.services}
                />

                <Snackbar open={snack.open} autoHideDuration={3000} onClose={() => setSnack(s => ({ ...s, open: false }))}>
                    <Alert severity={snack.severity}>{snack.msg}</Alert>
                </Snackbar>
            </Stack>
        </LocalizationProvider>
    );
}