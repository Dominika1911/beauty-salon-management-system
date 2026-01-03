import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Alert,
    Box,
    Button,
    IconButton,
    Paper,
    Snackbar,
    Stack,
    Tooltip,
    Typography,
    useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { type GridColumnVisibilityModel, type GridSortModel } from '@mui/x-data-grid';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';

import type { DRFPaginated, Employee, Service } from '@/types';
import { employeesApi } from '@/api/employees';
import { servicesApi } from '@/api/services';
import { usersApi } from '@/api/users';
import { parseDrfError, pickFieldErrors } from '@/utils/drfErrors';

import EmployeesFiltersPanel from './components/EmployeesFiltersPanel';
import EmployeesTable from './components/EmployeesTable';
import { getEmployeesColumns } from './components/employeesColumns';
import EmployeeFormDialog from './components/EmployeeFormDialog';
import ResetEmployeePasswordDialog from './components/ResetEmployeePasswordDialog';
import ConfirmEmployeeDeleteDialog from './components/ConfirmEmployeeDeleteDialog';

import {
    emptyForm,
    type EmployeeFormState,
    type FieldErrors,
    type IsActiveFilter,
    type SnackbarState,
} from './types';
import {
    ORDERING_OPTIONS,
    buildEmployeePayload,
    formatPLN,
    getBestErrorMessage,
    getResponseData,
    isEmployee,
    mapEmployeeCreateMessage,
    sortModelToOrdering,
    validateEmployeeForm,
} from './utils';

export default function EmployeesPage(): React.ReactNode {
    const theme = useTheme();
    const isDownMd = useMediaQuery(theme.breakpoints.down('md'));
    const isDownSm = useMediaQuery(theme.breakpoints.down('sm'));

    const [employeesData, setEmployeesData] = useState<DRFPaginated<Employee> | null>(null);
    const [services, setServices] = useState<Service[]>([]);

    const [servicesLoaded, setServicesLoaded] = useState(false);
    const [servicesLoadFailed, setServicesLoadFailed] = useState(false);

    const [loading, setLoading] = useState(true);
    const [publicDataWarning, setPublicDataWarning] = useState(false);

    const [draftSearch, setDraftSearch] = useState('');
    const [draftIsActiveFilter, setDraftIsActiveFilter] = useState<IsActiveFilter>('ALL');
    const [draftServiceIdFilter, setDraftServiceIdFilter] = useState<number | ''>('');

    const [search, setSearch] = useState('');
    const [isActiveFilter, setIsActiveFilter] = useState<IsActiveFilter>('ALL');
    const [serviceIdFilter, setServiceIdFilter] = useState<number | ''>('');

    const [page, setPage] = useState(1);
    const [sortModel, setSortModel] = useState<GridSortModel>([{ field: 'created_at', sort: 'desc' }]);

    const [pageError, setPageError] = useState<string | null>(null);

    const [formError, setFormError] = useState<string | null>(null);
    const [formFieldErrors, setFormFieldErrors] = useState<FieldErrors>({});

    const [dialogOpen, setDialogOpen] = useState(false);
    const [isEdit, setIsEdit] = useState(false);
    const [form, setForm] = useState<EmployeeFormState>(emptyForm);

    const [confirmDelete, setConfirmDelete] = useState<Employee | null>(null);

    const [resetDialogOpen, setResetDialogOpen] = useState(false);
    const [resetTarget, setResetTarget] = useState<Employee | null>(null);
    const [resetPass1, setResetPass1] = useState('');
    const [resetPass2, setResetPass2] = useState('');
    const [resetLoading, setResetLoading] = useState(false);
    const [resetError, setResetError] = useState<string | null>(null);

    const [actionLoading, setActionLoading] = useState(false);

    const [snack, setSnack] = useState<SnackbarState>({
        open: false,
        msg: '',
        severity: 'info',
    });

    const serviceMap = useMemo(() => {
        const map = new Map<number, Service>();
        services.forEach((s) => map.set(s.id, s));
        return map;
    }, [services]);

    const hasActiveFiltersDraft =
        Boolean(draftSearch.trim()) || draftIsActiveFilter !== 'ALL' || draftServiceIdFilter !== '';

    const hasActiveFiltersApplied =
        Boolean(search.trim()) || isActiveFilter !== 'ALL' || serviceIdFilter !== '';

    const hasUnappliedChanges =
        draftSearch !== search ||
        draftIsActiveFilter !== isActiveFilter ||
        draftServiceIdFilter !== serviceIdFilter;

    const loadAllServices = useCallback(async () => {
        setServicesLoaded(false);
        setServicesLoadFailed(false);

        const all: Service[] = [];
        const MAX_PAGES = 50;
        let currentPage = 1;

        try {
            for (let i = 0; i < MAX_PAGES; i += 1) {
                const res = await servicesApi.list({
                    is_active: true,
                    page: currentPage,
                    ordering: 'name',
                });

                all.push(...res.results);

                if (!res.next) {
                    setServices(all);
                    setServicesLoaded(true);
                    return;
                }

                currentPage += 1;
            }

            setServices(all);
            setServicesLoaded(true);
            setServicesLoadFailed(true);
            setSnack({
                open: true,
                msg: 'Nie udało się wczytać pełnej listy usług (limit paginacji). Filtry mogą być niepełne.',
                severity: 'info',
            });
        } catch (e: unknown) {
            setServices([]);
            setServicesLoaded(true);
            setServicesLoadFailed(true);
            setSnack({
                open: true,
                msg: getBestErrorMessage(e) || 'Nie udało się wczytać listy usług.',
                severity: 'info',
            });
        }
    }, []);

    const loadEmployees = useCallback(async () => {
        setLoading(true);
        setPageError(null);

        try {
            const ordering = sortModelToOrdering(sortModel) || '-created_at';

            const res = await employeesApi.list({
                page,
                ordering,
                search: search.trim() || undefined,
                is_active: isActiveFilter === 'ALL' ? undefined : isActiveFilter === 'ACTIVE',
                service_id: serviceIdFilter === '' ? undefined : serviceIdFilter,
            });

            const fullEmployees = res.results.filter(isEmployee);
            const hadPublic = fullEmployees.length !== res.results.length;

            setPublicDataWarning(hadPublic);

            if (hadPublic) {
                setPageError('Część danych pracowników jest ukryta. Sprawdź, czy jesteś zalogowany jako ADMIN.');
            }

            setEmployeesData({
                count: res.count,
                next: res.next,
                previous: res.previous,
                results: fullEmployees,
            });
        } catch (e: unknown) {
            setEmployeesData({ count: 0, next: null, previous: null, results: [] });
            setPublicDataWarning(false);

            const parsed = parseDrfError(e);
            setPageError(parsed.message || 'Nie udało się pobrać pracowników. Spróbuj ponownie.');
        } finally {
            setLoading(false);
        }
    }, [page, sortModel, search, isActiveFilter, serviceIdFilter]);

    const loadAll = useCallback(async () => {
        setPageError(null);
        await Promise.all([loadAllServices(), loadEmployees()]);
    }, [loadAllServices, loadEmployees]);

    useEffect(() => {
        void loadAll();
    }, [loadAll]);

    const rows = useMemo(() => employeesData?.results ?? [], [employeesData]);
    const canPrev = Boolean(employeesData?.previous) && !loading;
    const canNext = Boolean(employeesData?.next) && !loading;

    const canOpenCreate = servicesLoaded && !servicesLoadFailed;

    const openCreate = () => {
        setIsEdit(false);
        setForm({ ...emptyForm });
        setFormError(null);
        setFormFieldErrors({});
        setDialogOpen(true);
    };

    const openEdit = (emp: Employee) => {
        setIsEdit(true);
        setForm({
            id: emp.id,
            first_name: emp.first_name || '',
            last_name: emp.last_name || '',
            phone: emp.phone || '',
            is_active: Boolean(emp.is_active),
            skill_ids: (emp.skills || []).map((s) => s.id),
            email: '',
            password: '',
        });
        setFormError(null);
        setFormFieldErrors({});
        setDialogOpen(true);
    };

    const closeDialog = () => {
        setDialogOpen(false);
    };

    const applyFilters = () => {
        setPage(1);
        setSearch(draftSearch);
        setIsActiveFilter(draftIsActiveFilter);
        setServiceIdFilter(draftServiceIdFilter);
    };

    const resetFilters = () => {
        setDraftSearch('');
        setDraftIsActiveFilter('ALL');
        setDraftServiceIdFilter('');

        setPage(1);
        setSearch('');
        setIsActiveFilter('ALL');
        setServiceIdFilter('');
    };

    const openResetDialog = (emp: Employee) => {
        setResetTarget(emp);
        setResetPass1('');
        setResetPass2('');
        setResetError(null);
        setResetDialogOpen(true);
    };

    const closeResetDialog = () => {
        setResetDialogOpen(false);
        setResetTarget(null);
        setResetPass1('');
        setResetPass2('');
        setResetError(null);
    };

    const handleSave = async () => {
        setFormError(null);
        setFormFieldErrors({});
        setActionLoading(true);

        const v = validateEmployeeForm(form, isEdit);
        if (!v.ok) {
            setFormError(v.formError);
            setFormFieldErrors(v.fieldErrors || {});
            setActionLoading(false);
            return;
        }

        try {
            if (!isEdit) {
                const payload = buildEmployeePayload(form, false);
                await employeesApi.create(payload);
                setSnack({ open: true, msg: 'Utworzono pracownika.', severity: 'success' });
            } else if (form.id) {
                const payload = buildEmployeePayload(form, true);
                await employeesApi.update(form.id, payload);
                setSnack({ open: true, msg: 'Zapisano zmiany.', severity: 'success' });
            } else {
                setFormError('Nieprawidłowe dane formularza (brak ID).');
                return;
            }

            closeDialog();
            await loadEmployees();
        } catch (e: unknown) {
            const parsed = parseDrfError(e);
            const nextFieldErrors = pickFieldErrors(parsed.fieldErrors, emptyForm);
            setFormFieldErrors(nextFieldErrors);

            const msg = getBestErrorMessage(e);

            if (msg) {
                setFormError(mapEmployeeCreateMessage(msg));
            } else if (Object.keys(nextFieldErrors).length) {
                setFormError('Nie udało się zapisać — popraw zaznaczone pola i spróbuj ponownie.');
            } else {
                setFormError('Nie udało się zapisać pracownika. Spróbuj ponownie.');
            }
        } finally {
            setActionLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!confirmDelete) return;
        setPageError(null);
        setActionLoading(true);

        try {
            await employeesApi.delete(confirmDelete.id);
            setSnack({ open: true, msg: 'Usunięto pracownika.', severity: 'success' });
            setConfirmDelete(null);
            await loadEmployees();
        } catch (e: unknown) {
            const parsed = parseDrfError(e);
            setPageError(
                parsed.message || 'Nie udało się usunąć pracownika. Sprawdź powiązania i spróbuj ponownie.',
            );
        } finally {
            setActionLoading(false);
        }
    };

    const handleResetPassword = async () => {
        if (!resetTarget) return;

        setResetError(null);

        if (resetPass1.trim().length < 8) {
            setResetError('Hasło musi mieć minimum 8 znaków.');
            return;
        }
        if (resetPass1 !== resetPass2) {
            setResetError('Hasła nie są identyczne.');
            return;
        }

        try {
            setResetLoading(true);
            await usersApi.resetPassword(resetTarget.user, {
                new_password: resetPass1,
                new_password2: resetPass2,
            });

            setSnack({ open: true, msg: 'Zresetowano hasło.', severity: 'success' });
            closeResetDialog();
        } catch (e: unknown) {
            const data = getResponseData(e);
            const dataObj =
                typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : undefined;

            const np = dataObj?.new_password;
            const np2 = dataObj?.new_password2;

            const npMsg =
                (Array.isArray(np) && np.length && typeof np[0] === 'string' ? String(np[0]) : undefined) ||
                (typeof np === 'string' ? np : undefined) ||
                (Array.isArray(np2) && np2.length && typeof np2[0] === 'string' ? String(np2[0]) : undefined) ||
                (typeof np2 === 'string' ? np2 : undefined);

            const msg = npMsg || getBestErrorMessage(e) || 'Nie udało się zresetować hasła. Spróbuj ponownie.';

            setResetError(msg);
        } finally {
            setResetLoading(false);
        }
    };

    const busy = loading || resetLoading || actionLoading;
    const actionsDisabled = busy || (servicesLoaded && servicesLoadFailed);

    const emptyInfo = useMemo(() => {
        if (loading) return null;
        if (rows.length) return null;
        if (hasActiveFiltersApplied) return 'Brak wyników dla podanych filtrów. Zmień filtry i kliknij „Zastosuj”.';
        return 'Brak pracowników. Dodaj pierwszego pracownika, aby zarządzać grafikiem i wizytami.';
    }, [loading, rows.length, hasActiveFiltersApplied]);

    const columns = useMemo(
        () =>
            getEmployeesColumns({
                busy: actionsDisabled,
                onResetPassword: openResetDialog,
                onEdit: openEdit,
                onDelete: (e) => setConfirmDelete(e),
                formatPLN,
            }),
        [actionsDisabled, openResetDialog, openEdit],
    );

    const columnVisibilityModel = useMemo<GridColumnVisibilityModel>(() => {
        if (isDownSm)
            return {
                revenue_completed_total: false,
                completed_appointments_count: false,
                skills: false,
            } as GridColumnVisibilityModel;
        if (isDownMd) return { skills: false } as GridColumnVisibilityModel;
        return {} as GridColumnVisibilityModel;
    }, [isDownMd, isDownSm]);

    const ordering = sortModelToOrdering(sortModel) || '-created_at';
    const orderingLabel = ORDERING_OPTIONS.find((o) => o.value === ordering)?.label ?? ordering;

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
                        Pracownicy
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        Łącznie: {employeesData?.count ?? '—'} • Strona: {page} • Sortowanie: {orderingLabel}
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

                    <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={openCreate}
                        disabled={busy || !canOpenCreate}
                    >
                        Dodaj pracownika
                    </Button>
                </Stack>
            </Box>

            {pageError && (
                <Alert severity={publicDataWarning ? 'warning' : 'error'} onClose={() => setPageError(null)}>
                    {pageError}
                </Alert>
            )}

            {servicesLoaded && servicesLoadFailed && (
                <Alert severity="info">
                    Nie udało się wczytać listy usług — dodawanie/edycja pracowników jest zablokowana. Odśwież stronę.
                </Alert>
            )}

            <EmployeesFiltersPanel
                services={services}
                busy={busy}
                draftSearch={draftSearch}
                setDraftSearch={setDraftSearch}
                draftIsActiveFilter={draftIsActiveFilter}
                setDraftIsActiveFilter={setDraftIsActiveFilter}
                draftServiceIdFilter={draftServiceIdFilter}
                setDraftServiceIdFilter={setDraftServiceIdFilter}
                hasActiveFiltersDraft={hasActiveFiltersDraft}
                hasActiveFiltersApplied={hasActiveFiltersApplied}
                hasUnappliedChanges={hasUnappliedChanges}
                onApply={applyFilters}
                onReset={resetFilters}
                formatPLN={formatPLN}
            />

            <Paper variant="outlined" sx={{ p: 2 }}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }}>
                    <Stack direction="row" spacing={1}>
                        <Button disabled={!canPrev} variant="outlined" onClick={() => setPage((p) => Math.max(1, p - 1))}>
                            Poprzednia
                        </Button>
                        <Button disabled={!canNext} variant="contained" onClick={() => setPage((p) => p + 1)}>
                            Następna
                        </Button>
                    </Stack>
                    <Box sx={{ flex: 1 }} />
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        {loading ? 'Odświeżanie…' : `Wyświetlono: ${rows.length}`}
                    </Typography>
                </Stack>
            </Paper>

            <EmployeesTable
                rows={rows}
                columns={columns}
                loading={loading}
                employeesData={employeesData}
                sortModel={sortModel}
                setSortModel={setSortModel}
                page={page}
                setPage={setPage}
                columnVisibilityModel={columnVisibilityModel}
                emptyInfo={emptyInfo}
            />

            <EmployeeFormDialog
                open={dialogOpen}
                onClose={closeDialog}
                busy={busy || (servicesLoaded && servicesLoadFailed)}
                isEdit={isEdit}
                form={form}
                setForm={setForm}
                services={services}
                serviceMap={serviceMap}
                formError={formError}
                setFormError={setFormError}
                formFieldErrors={formFieldErrors}
                onSave={handleSave}
                actionLoading={actionLoading}
            />

            <ResetEmployeePasswordDialog
                open={resetDialogOpen}
                onClose={closeResetDialog}
                resetLoading={resetLoading}
                resetError={resetError}
                setResetError={setResetError}
                resetTarget={resetTarget}
                resetPass1={resetPass1}
                setResetPass1={setResetPass1}
                resetPass2={resetPass2}
                setResetPass2={setResetPass2}
                onSubmit={handleResetPassword}
            />

            <ConfirmEmployeeDeleteDialog
                open={Boolean(confirmDelete)}
                busy={busy}
                employee={confirmDelete}
                onClose={() => setConfirmDelete(null)}
                onConfirm={handleDelete}
                actionLoading={actionLoading}
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
}
