import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    CircularProgress,
    Container,
    Divider,
    LinearProgress,
    List,
    ListItem,
    ListItemText,
    Snackbar,
    Stack,
    Typography,
} from '@mui/material';
import type { AlertColor } from '@mui/material/Alert';

import type { Appointment, AppointmentStatus, DashboardResponse } from '@/types';
import { dashboardApi } from '@/api/dashboard';
import { parseDrfError } from '@/utils/drfErrors';


type ViewState =
    | { status: 'idle' }
    | { status: 'loading' }
    | { status: 'success'; data: DashboardResponse }
    | { status: 'error'; message: string };

type SnackState = {
    open: boolean;
    msg: string;
    severity: AlertColor;
};

function formatDateTime(iso: string): string {
    const d = new Date(iso);
    return Number.isNaN(d.getTime())
        ? iso
        : d.toLocaleString('pl-PL', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
          });
}

function isAppointmentStatus(value: string): value is AppointmentStatus {
    return (
        value === 'PENDING' ||
        value === 'CONFIRMED' ||
        value === 'COMPLETED' ||
        value === 'CANCELLED' ||
        value === 'NO_SHOW'
    );
}

function statusChipProps(status: string): {
    label: string;
    color: 'default' | 'warning' | 'success' | 'error';
} {
    if (!isAppointmentStatus(status)) {
        return { label: status, color: 'default' };
    }

    switch (status) {
        case 'PENDING':
            return { label: 'Oczekuje', color: 'warning' };
        case 'CONFIRMED':
            return { label: 'Potwierdzona', color: 'success' };
        case 'COMPLETED':
            return { label: 'Zakończona', color: 'default' };
        case 'CANCELLED':
            return { label: 'Anulowana', color: 'error' };
        case 'NO_SHOW':
            return { label: 'No-show', color: 'error' };
        default:
            return { label: status, color: 'default' };
    }
}

function formatMoneyPLN(value: number): string {
    return new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(value);
}

export default function DashboardPage() {
    const [state, setState] = React.useState<ViewState>({ status: 'idle' });
    const [snack, setSnack] = React.useState<SnackState>({
        open: false,
        msg: '',
        severity: 'info',
    });

    const load = React.useCallback(async (showSnack = false) => {
        setState({ status: 'loading' });
        try {
            const data = await dashboardApi.get();
            setState({ status: 'success', data });
            if (showSnack) {
                setSnack({ open: true, msg: 'Dane odświeżone.', severity: 'info' });
            }
        } catch (e: unknown) {
            const parsed = parseDrfError(e);
            setState({
                status: 'error',
                message: parsed.message || 'Nie udało się pobrać danych.',
            });
        }
    }, []);

    React.useEffect(() => {
        void load(false);
    }, [load]);

    const loading = state.status === 'idle' || state.status === 'loading';

    return (
        <Container maxWidth="lg" sx={{ py: { xs: 2, sm: 3 } }}>
            <Stack spacing={2}>
                <Box
                    sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: { xs: 'flex-start', sm: 'center' },
                        gap: 2,
                        flexWrap: 'wrap',
                    }}
                >
                    <Box>
                        <Typography variant="h5" fontWeight={900}>
                            Dashboard
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            Najważniejsze informacje w jednym miejscu
                        </Typography>
                    </Box>

                    <Button variant="outlined" onClick={() => void load(true)} disabled={loading}>
                        Odśwież
                    </Button>
                </Box>

                {state.status === 'error' && (
                    <Alert severity="error" onClose={() => setState({ status: 'idle' })}>
                        {state.message}
                    </Alert>
                )}

                {loading ? (
                    <Card variant="outlined" sx={{ position: 'relative' }}>
                        <LinearProgress sx={{ position: 'absolute', left: 0, right: 0, top: 0 }} />
                        <CardContent>
                            <Stack direction="row" spacing={2} alignItems="center" sx={{ pt: 1 }}>
                                <CircularProgress size={20} />
                                <Typography>Ładowanie danych…</Typography>
                            </Stack>
                        </CardContent>
                    </Card>
                ) : state.status === 'success' ? (
                    <RoleDashboard data={state.data} />
                ) : null}
            </Stack>

            <Snackbar
                open={snack.open}
                autoHideDuration={2500}
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
        </Container>
    );
}

function RoleDashboard({ data }: { data: DashboardResponse }) {
    if (data.role === 'ADMIN') return <AdminDashboardView data={data} />;
    if (data.role === 'EMPLOYEE') return <EmployeeDashboardView data={data} />;
    return <ClientDashboardView data={data} />;
}

function StatCard({
    title,
    value,
    hint,
    action,
}: {
    title: string;
    value: React.ReactNode;
    hint?: string;
    action?: React.ReactNode;
}) {
    return (
        <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
                <Stack spacing={1}>
                    <Typography variant="overline" color="text.secondary">
                        {title}
                    </Typography>
                    <Typography variant="h5" fontWeight={900}>
                        {value}
                    </Typography>
                    {hint && (
                        <Typography variant="body2" color="text.secondary">
                            {hint}
                        </Typography>
                    )}
                    {action}
                </Stack>
            </CardContent>
        </Card>
    );
}

function AppointmentsList({
    items,
    emptyText,
    showClient = true,
    showEmployee = true,
}: {
    items: Appointment[];
    emptyText: string;
    showClient?: boolean;
    showEmployee?: boolean;
}) {
    if (items.length === 0) {
        return <Typography color="text.secondary">{emptyText}</Typography>;
    }

    return (
        <List disablePadding>
            {items.map((apt) => {
                const chip = statusChipProps(apt.status);
                return (
                    <ListItem key={apt.id} divider>
                        <ListItemText
                            primary={
                                <Stack
                                    direction="row"
                                    spacing={1}
                                    alignItems="center"
                                    flexWrap="wrap"
                                >
                                    <Typography variant="body1" fontWeight={600}>
                                        {apt.service_name}
                                    </Typography>
                                    <Chip
                                        size="small"
                                        label={chip.label}
                                        color={chip.color}
                                        variant="outlined"
                                    />
                                </Stack>
                            }
                            secondary={
                                <Stack spacing={0.5} sx={{ mt: 0.5 }}>
                                    <Typography variant="body2" color="text.secondary">
                                        {formatDateTime(apt.start)} – {formatDateTime(apt.end)}
                                    </Typography>
                                    {showClient && apt.client_name && (
                                        <Typography variant="body2">
                                            Klient: {apt.client_name}
                                        </Typography>
                                    )}
                                    {showEmployee && apt.employee_name && (
                                        <Typography variant="body2">
                                            Pracownik: {apt.employee_name}
                                        </Typography>
                                    )}
                                    {apt.service_price && (
                                        <Typography variant="body2" fontWeight={600}>
                                            {formatMoneyPLN(parseFloat(apt.service_price))}
                                        </Typography>
                                    )}
                                </Stack>
                            }
                        />
                    </ListItem>
                );
            })}
        </List>
    );
}

function AdminDashboardView({
    data,
}: {
    data: Extract<DashboardResponse, { role: 'ADMIN' }>;
}) {
    return (
        <Stack spacing={2}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                <Box sx={{ flex: 1 }}>
                    <StatCard
                        title="Wizyty dzisiaj"
                        value={data.today.appointments_count}
                        hint={data.today.date}
                    />
                </Box>
                <Box sx={{ flex: 1 }}>
                    <StatCard
                        title="Oczekujące wizyty"
                        value={data.pending_appointments}
                        hint="Do potwierdzenia"
                    />
                </Box>
                <Box sx={{ flex: 1 }}>
                    <StatCard
                        title="Przychód w tym miesiącu"
                        value={formatMoneyPLN(data.current_month.revenue)}
                        hint={`${data.current_month.completed_appointments} ukończonych wizyt`}
                    />
                </Box>
            </Stack>

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                <Box sx={{ flex: 1 }}>
                    <StatCard title="Aktywni pracownicy" value={data.system.active_employees} />
                </Box>
                <Box sx={{ flex: 1 }}>
                    <StatCard title="Aktywni klienci" value={data.system.active_clients} />
                </Box>
                <Box sx={{ flex: 1 }}>
                    <StatCard title="Aktywne usługi" value={data.system.active_services} />
                </Box>
            </Stack>

            <Card variant="outlined">
                <CardContent>
                    <Typography variant="h6" fontWeight={900}>
                        Wizyty dzisiaj
                    </Typography>
                    <Divider sx={{ my: 1 }} />
                    <AppointmentsList
                        items={data.today.appointments}
                        emptyText="Brak wizyt na dzisiaj."
                    />
                </CardContent>
            </Card>
        </Stack>
    );
}

function EmployeeDashboardView({
    data,
}: {
    data: Extract<DashboardResponse, { role: 'EMPLOYEE' }>;
}) {
    return (
        <Stack spacing={2}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                <Box sx={{ flex: 1 }}>
                    <StatCard
                        title="Profil"
                        value={data.full_name}
                        hint={`Nr: ${data.employee_number}`}
                    />
                </Box>
                <Box sx={{ flex: 1 }}>
                    <StatCard
                        title="Wizyty dziś"
                        value={data.today.appointments.length}
                        hint={data.today.date}
                    />
                </Box>
                <Box sx={{ flex: 1 }}>
                    <StatCard
                        title="Zakończone w tym miesiącu"
                        value={data.this_month.completed_appointments}
                    />
                </Box>
            </Stack>

            <Card variant="outlined">
                <CardContent>
                    <Typography variant="h6" fontWeight={900}>
                        Dzisiaj
                    </Typography>
                    <Divider sx={{ my: 1 }} />
                    <AppointmentsList
                        items={data.today.appointments}
                        emptyText="Brak wizyt dzisiaj."
                        showEmployee={false}
                    />
                </CardContent>
            </Card>

            <Card variant="outlined">
                <CardContent>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Typography variant="h6" fontWeight={900}>
                            Najbliższe 7 dni
                        </Typography>
                        <Chip
                            size="small"
                            label={`Razem: ${data.upcoming.count}`}
                            variant="outlined"
                        />
                    </Stack>
                    <Divider sx={{ my: 1 }} />
                    <AppointmentsList
                        items={data.upcoming.appointments}
                        emptyText="Brak nadchodzących wizyt."
                        showEmployee={false}
                    />
                </CardContent>
            </Card>
        </Stack>
    );
}

function ClientDashboardView({
    data,
}: {
    data: Extract<DashboardResponse, { role: 'CLIENT' }>;
}) {
    return (
        <Stack spacing={2}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                <Box sx={{ flex: 1 }}>
                    <StatCard
                        title="Nadchodzące wizyty"
                        value={data.upcoming_appointments.count}
                        action={
                            <Button component={RouterLink} to="/client/booking">
                                Umów wizytę
                            </Button>
                        }
                    />
                </Box>
                <Box sx={{ flex: 1 }}>
                    <StatCard
                        title="Historia wizyt"
                        value={data.history.total_completed}
                        hint="Zakończone wizyty"
                    />
                </Box>
            </Stack>

            <Card variant="outlined">
                <CardContent>
                    <Typography variant="h6" fontWeight={900}>
                        Nadchodzące
                    </Typography>
                    <Divider sx={{ my: 1 }} />
                    <AppointmentsList
                        items={data.upcoming_appointments.appointments}
                        emptyText="Brak nadchodzących wizyt."
                        showClient={false}
                    />
                </CardContent>
            </Card>

            <Card variant="outlined">
                <CardContent>
                    <Typography variant="h6" fontWeight={900}>
                        Ostatnie zakończone
                    </Typography>
                    <Divider sx={{ my: 1 }} />
                    <AppointmentsList
                        items={data.history.recent}
                        emptyText="Brak zakończonych wizyt w historii."
                        showClient={false}
                    />
                </CardContent>
            </Card>
        </Stack>
    );
}
