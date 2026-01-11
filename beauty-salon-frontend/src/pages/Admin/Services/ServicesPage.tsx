import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, LinearProgress, Paper, Snackbar, Stack, Typography } from '@mui/material';

import type { Service } from '@/types';
import { servicesApi } from '@/api/services';
import { parseDrfError, pickFieldErrors } from '@/utils/drfErrors';

import ServicesFiltersPanel from './components/ServicesFiltersPanel';
import ServicesList from './components/ServicesList';
import ServiceFormDialog from './components/ServiceFormDialog';

import {
    emptyForm,
    type FormState,
    type IsActiveFilter,
    type SortDir,
    type SortKey,
    type SnackbarState,
} from './types';
import { buildServicePayload, getBestErrorMessage, validateServiceForm } from './utils';

export default function ServicesPage() {
    const [items, setItems] = useState<Service[]>([]);
    const [count, setCount] = useState(0);
    const [pageSize, setPageSize] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [draftQuery, setDraftQuery] = useState('');
    const [draftIsActive, setDraftIsActive] = useState<IsActiveFilter>('all');
    const [draftCategory, setDraftCategory] = useState('');
    const [draftSortKey, setDraftSortKey] = useState<SortKey>('name');
    const [draftSortDir, setDraftSortDir] = useState<SortDir>('asc');
    const [query, setQuery] = useState('');
    const [isActiveFilter, setIsActiveFilter] = useState<IsActiveFilter>('all');
    const [categoryFilter, setCategoryFilter] = useState('');
    const [sortKey, setSortKey] = useState<SortKey>('name');
    const [sortDir, setSortDir] = useState<SortDir>('asc');

    const [pageError, setPageError] = useState<string | null>(null);
    const [formError, setFormError] = useState<string | null>(null);
    const [snack, setSnack] = useState<SnackbarState>({ open: false, msg: '', severity: 'info' });

    const [open, setOpen] = useState(false);
    const [edit, setEdit] = useState<Service | null>(null);
    const [form, setForm] = useState<FormState>(emptyForm);

    const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof FormState, string>>>({});
    const [saving, setSaving] = useState(false);
    const [togglingId, setTogglingId] = useState<number | null>(null);

    const busy = loading || saving || togglingId !== null;

    const pageCount = useMemo(() => {
        const ps = pageSize ?? 10;
        return Math.max(1, Math.ceil(count / ps));
    }, [count, pageSize]);

    const orderingParam = useMemo(() => {
        return sortDir === 'desc' ? `-${sortKey}` : sortKey;
    }, [sortKey, sortDir]);

    const is_active_param = useMemo(() => {
        if (isActiveFilter === 'all') return undefined;
        return isActiveFilter === 'active';
    }, [isActiveFilter]);

    const hasActiveFiltersDraft =
        Boolean(draftQuery.trim()) ||
        Boolean(draftCategory.trim()) ||
        draftIsActive !== 'all' ||
        draftSortKey !== 'name' ||
        draftSortDir !== 'asc';

    const hasActiveFiltersApplied =
        Boolean(query.trim()) ||
        Boolean(categoryFilter.trim()) ||
        isActiveFilter !== 'all' ||
        sortKey !== 'name' ||
        sortDir !== 'asc';

    const hasUnappliedChanges =
        draftQuery !== query ||
        draftCategory !== categoryFilter ||
        draftIsActive !== isActiveFilter ||
        draftSortKey !== sortKey ||
        draftSortDir !== sortDir;

    async function load(): Promise<void> {
        setLoading(true);
        setPageError(null);

        try {
            const res = await servicesApi.list({
                page,
                search: query.trim() || undefined,
                ordering: orderingParam,
                is_active: is_active_param,
                category: categoryFilter.trim() || undefined,
            });

            setItems(res.results || []);
            setCount(res.count ?? 0);

            if (page === 1 && res.results?.length) {
                setPageSize(res.results.length);
            }
        } catch (e: unknown) {
            const parsed = parseDrfError(e);
            setPageError(parsed.message || 'Nie udało się pobrać usług. Spróbuj ponownie.');
            setItems([]);
            setCount(0);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        void load();
    }, [page, orderingParam, query, is_active_param, categoryFilter]);

    useEffect(() => {
        if (page !== 1) {
            setPage(1);
        }
    }, [orderingParam]);

    function applyFilters() {
        setPage(1);

        setQuery(draftQuery);
        setCategoryFilter(draftCategory);
        setIsActiveFilter(draftIsActive);
        setSortKey(draftSortKey);
        setSortDir(draftSortDir);
    }

    function resetFilters() {
        setDraftQuery('');
        setDraftCategory('');
        setDraftIsActive('all');
        setDraftSortKey('name');
        setDraftSortDir('asc');

        setPage(1);
        setQuery('');
        setCategoryFilter('');
        setIsActiveFilter('all');
        setSortKey('name');
        setSortDir('asc');
    }

    function openCreate() {
        setEdit(null);
        setForm(emptyForm);
        setFieldErrors({});
        setFormError(null);
        setOpen(true);
    }

    function openEditDialog(s: Service) {
        setEdit(s);
        setFieldErrors({});
        setFormError(null);
        setForm({
            name: s.name ?? '',
            category: s.category ?? '',
            description: s.description ?? '',
            price: String(s.price ?? ''),
            duration_minutes: String(s.duration_minutes ?? ''),
            is_active: Boolean(s.is_active),
        });
        setOpen(true);
    }

    function closeDialog() {
        if (saving) return;
        setOpen(false);
    }

    async function save(): Promise<void> {
        setFormError(null);
        setFieldErrors({});

        const validation = validateServiceForm(form);
        setFieldErrors(validation.errors);

        if (!validation.valid) {
            setFormError('Popraw błędy w formularzu.');
            return;
        }

        setSaving(true);
        try {
            const payload = buildServicePayload(form);

            if (edit) {
                await servicesApi.update(edit.id, payload);
                setSnack({ open: true, msg: 'Zapisano zmiany.', severity: 'success' });
            } else {
                await servicesApi.create(payload);
                setSnack({ open: true, msg: 'Dodano usługę.', severity: 'success' });
            }

            setOpen(false);
            await load();
        } catch (e: unknown) {
            setFormError(getBestErrorMessage(e) || 'Nie udało się zapisać. Spróbuj ponownie.');
            const parsed = parseDrfError(e);
            setFieldErrors(pickFieldErrors<FormState>(parsed.fieldErrors, emptyForm));
        } finally {
            setSaving(false);
        }
    }

    async function toggleActive(s: Service): Promise<void> {
        setPageError(null);
        setTogglingId(s.id);

        try {
            if (s.is_active) {
                await servicesApi.disable(s.id);
                setSnack({ open: true, msg: `Wyłączono usługę: ${s.name}`, severity: 'info' });
            } else {
                await servicesApi.enable(s.id);
                setSnack({ open: true, msg: `Włączono usługę: ${s.name}`, severity: 'info' });
            }
            await load();
        } catch (e: unknown) {
            const parsed = parseDrfError(e);
            setPageError(parsed.message || 'Nie udało się zmienić statusu usługi. Spróbuj ponownie.');
        } finally {
            setTogglingId(null);
        }
    }

    return (
        <Stack spacing={2}>
            <Stack
                direction={{ xs: 'column', sm: 'row' }}
                alignItems={{ xs: 'stretch', sm: 'center' }}
                justifyContent="space-between"
                gap={1}
            >
                <Box>
                    <Typography variant="h5">Usługi</Typography>
                    <Typography variant="body2" color="text.secondary">
                        Zarządzaj ofertą usług i ich dostępnością.
                    </Typography>
                </Box>

                <Button
                    variant="contained"
                    onClick={openCreate}
                    disabled={busy}
                    aria-label="Dodaj usługę (nagłówek)"
                >
                    Dodaj usługę
                </Button>
            </Stack>

            {pageError && <Alert severity="error">{pageError}</Alert>}

            <Paper sx={{ p: 2, position: 'relative' }}>
                {loading && <LinearProgress sx={{ position: 'absolute', left: 0, top: 0, right: 0 }} />}

                <Stack spacing={2} sx={{ pt: loading ? 1 : 0 }}>
                    <ServicesFiltersPanel
                        busy={busy}
                        draftQuery={draftQuery}
                        setDraftQuery={setDraftQuery}
                        draftCategory={draftCategory}
                        setDraftCategory={setDraftCategory}
                        draftIsActive={draftIsActive}
                        setDraftIsActive={setDraftIsActive}
                        draftSortKey={draftSortKey}
                        setDraftSortKey={setDraftSortKey}
                        draftSortDir={draftSortDir}
                        setDraftSortDir={setDraftSortDir}
                        hasActiveFiltersDraft={hasActiveFiltersDraft}
                        hasActiveFiltersApplied={hasActiveFiltersApplied}
                        hasUnappliedChanges={hasUnappliedChanges}
                        applyFilters={applyFilters}
                        resetFilters={resetFilters}
                    />

                    <ServicesList
                        items={items}
                        loading={loading}
                        busy={busy}
                        hasActiveFiltersApplied={hasActiveFiltersApplied}
                        openCreate={openCreate}
                        openEditDialog={openEditDialog}
                        toggleActive={toggleActive}
                        togglingId={togglingId}
                        pageCount={pageCount}
                        page={page}
                        setPage={setPage}
                        resetFilters={resetFilters}
                    />
                </Stack>
            </Paper>

            <ServiceFormDialog
                open={open}
                edit={edit}
                form={form}
                setForm={setForm}
                fieldErrors={fieldErrors}
                formError={formError}
                saving={saving}
                onClose={closeDialog}
                onSave={save}
            />

            <Snackbar
                open={snack.open}
                autoHideDuration={3500}
                onClose={() => setSnack((s) => ({ ...s, open: false }))}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert
                    onClose={() => setSnack((s) => ({ ...s, open: false }))}
                    severity={snack.severity}
                    variant="filled"
                    sx={{ width: '100%' }}
                >
                    {snack.msg}
                </Alert>
            </Snackbar>
        </Stack>
    );
}
