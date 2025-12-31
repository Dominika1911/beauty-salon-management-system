import React, { useCallback, useEffect, useState } from 'react';
import {
    Alert,
    Box,
    Button,
    Chip,
    CircularProgress,
    Pagination,
} from '@mui/material';
import dayjs, { Dayjs } from 'dayjs';

import { timeOffApi } from '@/api/timeOff';
import type { DRFPaginated, TimeOff, TimeOffStatus } from '@/types';
import { parseDrfError } from '@/utils/drfErrors';

import TimeOffRequestDialog from './components/TimeOffRequestDialog';
import EmployeeTimeOffTable from './components/EmployeeTimeOffTable';
import DeleteTimeOffRequestDialog from './components/DeleteTimeOffRequestDialog';

type StatusFilter = 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED';


const STATUS_FILTER_LABEL: Record<StatusFilter, string> = {
    ALL: 'Wszystkie',
    PENDING: 'Oczekujące',
    APPROVED: 'Zatwierdzone',
    REJECTED: 'Odrzucone',
};

const EMPTY_PAGE: DRFPaginated<TimeOff> = {
    count: 0,
    next: null,
    previous: null,
    results: [],
};

export default function EmployeeTimeOffPage() {
    const [page, setPage] = useState(1);
    const [status, setStatus] = useState<StatusFilter>('ALL');

    const [data, setData] = useState<DRFPaginated<TimeOff>>(EMPTY_PAGE);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // CREATE
    const [openCreateDialog, setOpenCreateDialog] = useState(false);
    const [startDate, setStartDate] = useState<Dayjs | null>(null);
    const [endDate, setEndDate] = useState<Dayjs | null>(null);
    const [comment, setComment] = useState('');
    const [createLoading, setCreateLoading] = useState(false);
    const [createError, setCreateError] = useState<string | null>(null);

    // CANCEL
    const [openCancelDialog, setOpenCancelDialog] = useState(false);
    const [cancelId, setCancelId] = useState<number | null>(null);
    const [cancelLoading, setCancelLoading] = useState(false);

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const res = await timeOffApi.list({
                page,
                status: status === 'ALL' ? undefined : status,
            });

            setData(res);
        } catch (e) {
            setError(parseDrfError(e).message ?? 'Nie udało się pobrać danych');
        } finally {
            setLoading(false);
        }
    }, [page, status]);

    useEffect(() => {
        void fetchData();
    }, [fetchData]);

    const handleOpenCreate = () => {
        setStartDate(null);
        setEndDate(null);
        setComment('');
        setCreateError(null);
        setOpenCreateDialog(true);
    };

    const handleCloseCreate = () => {
        setOpenCreateDialog(false);
        setCreateError(null);
    };

    const handleSubmitCreate = async () => {
        // WALIDACJA
        if (!startDate || !endDate) {
            setCreateError('Proszę wybrać datę rozpoczęcia i zakończenia.');
            return;
        }

        if (endDate.isBefore(startDate, 'day')) {
            setCreateError('Data zakończenia nie może być wcześniejsza niż data rozpoczęcia.');
            return;
        }

        try {
            setCreateLoading(true);
            await timeOffApi.create({
                date_from: startDate.format('YYYY-MM-DD'),
                date_to: endDate.format('YYYY-MM-DD'),
                reason: comment || undefined,
            });

            handleCloseCreate();
            await fetchData();
        } catch (e) {
            setCreateError(parseDrfError(e).message ?? 'Nie udało się wysłać wniosku.');
        } finally {
            setCreateLoading(false);
        }
    };

    const handleOpenCancel = (req: TimeOff) => {
        setCancelId(req.id);
        setOpenCancelDialog(true);
    };

    const handleCloseCancel = () => {
        setCancelId(null);
        setOpenCancelDialog(false);
    };

    const handleConfirmCancel = async () => {
        if (cancelId === null) return;

        try {
            setCancelLoading(true);
            await timeOffApi.cancel(cancelId);
            handleCloseCancel();
            await fetchData();
        } finally {
            setCancelLoading(false);
        }
    };

    const pagesCount = Math.ceil(data.count / 10);

    return (
        <Box p={3}>
            <Box display="flex" justifyContent="space-between" mb={2}>
                <Box display="flex" gap={1}>
                    {(Object.keys(STATUS_FILTER_LABEL) as StatusFilter[]).map(
                        (s) => (
                            <Chip
                                key={s}
                                label={STATUS_FILTER_LABEL[s]}
                                color={status === s ? 'primary' : 'default'}
                                onClick={() => {
                                    setStatus(s);
                                    setPage(1);
                                }}
                            />
                        )
                    )}
                </Box>

                <Button variant="contained" onClick={handleOpenCreate}>
                    Nowy wniosek
                </Button>
            </Box>

            {loading && <CircularProgress />}
            {error && <Alert severity="error">{error}</Alert>}

            <EmployeeTimeOffTable
                data={data.results}
                onCancel={handleOpenCancel}
            />

            {pagesCount > 1 && (
                <Pagination
                    sx={{ mt: 2 }}
                    page={page}
                    count={pagesCount}
                    onChange={(_, v) => setPage(v)}
                />
            )}

            <TimeOffRequestDialog
                open={openCreateDialog}
                loading={createLoading}
                error={createError}
                startDate={startDate}
                endDate={endDate}
                comment={comment}
                onClose={handleCloseCreate}
                onSubmit={handleSubmitCreate}
                onStartDateChange={setStartDate}
                onEndDateChange={setEndDate}
                onCommentChange={setComment}
            />

            <DeleteTimeOffRequestDialog
                open={openCancelDialog}
                loading={cancelLoading}
                onClose={handleCloseCancel}
                onConfirm={handleConfirmCancel}
            />
        </Box>
    );
}
