// src/pages/DashboardPage.tsx
import React from "react";
import { Link as RouterLink } from "react-router-dom";
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
  List,
  ListItem,
  ListItemText,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import type { Appointment, AppointmentStatus, DashboardResponse } from "@/types";
import { dashboardApi } from "@/api/dashboard";
import { statisticsApi } from "@/api/statistics";

/* =============================================================================
 * Types
 * ============================================================================= */

type ViewState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: DashboardResponse }
  | { status: "error"; message: string };

type StatisticsResponse = Awaited<ReturnType<typeof statisticsApi.get>>;

type StatsState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: StatisticsResponse }
  | { status: "error"; message: string };

/* =============================================================================
 * Helpers (lokalne – bez utils)
 * ============================================================================= */

function getErrorMessage(err: unknown): string {
  if (err && typeof err === "object") {
    const e = err as any;
    return (
      e.response?.data?.detail ||
      e.response?.data?.message ||
      e.message ||
      "Nie udało się pobrać danych."
    );
  }
  return "Nie udało się pobrać danych.";
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString("pl-PL", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
}

function toYmd(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function isAppointmentStatus(value: string): value is AppointmentStatus {
  return (
    value === "PENDING" ||
    value === "CONFIRMED" ||
    value === "COMPLETED" ||
    value === "CANCELLED"
  );
}

function statusChipProps(
  status: string
): { label: string; color: "default" | "warning" | "success" | "error" } {
  if (!isAppointmentStatus(status)) {
    return { label: status, color: "default" };
  }

  switch (status) {
    case "PENDING":
      return { label: "Oczekuje", color: "warning" };
    case "CONFIRMED":
      return { label: "Potwierdzona", color: "success" };
    case "COMPLETED":
      return { label: "Zakończona", color: "default" };
    case "CANCELLED":
      return { label: "Anulowana", color: "error" };
    default:
      return { label: status, color: "default" };
  }
}

function formatMoneyPLN(value: number): string {
  return `${value.toFixed(2)} zł`;
}

/* =============================================================================
 * Page
 * ============================================================================= */

export default function DashboardPage(): JSX.Element {
  const [state, setState] = React.useState<ViewState>({ status: "idle" });

  const load = React.useCallback(async () => {
    setState({ status: "loading" });
    try {
      const data = await dashboardApi.get();
      setState({ status: "success", data });
    } catch (e) {
      setState({ status: "error", message: getErrorMessage(e) });
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Stack spacing={2}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="h4" fontWeight={700}>
              Dashboard
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Panel dopasowany do roli użytkownika
            </Typography>
          </Box>
          <Button variant="outlined" onClick={load}>
            Odśwież
          </Button>
        </Stack>

        {(state.status === "idle" || state.status === "loading") && (
          <Card variant="outlined">
            <CardContent>
              <Stack direction="row" spacing={2} alignItems="center">
                <CircularProgress size={20} />
                <Typography>Ładowanie danych…</Typography>
              </Stack>
            </CardContent>
          </Card>
        )}

        {state.status === "error" && <Alert severity="error">{state.message}</Alert>}

        {state.status === "success" && <RoleDashboard data={state.data} />}
      </Stack>
    </Container>
  );
}

/* =============================================================================
 * Role switch
 * ============================================================================= */

function RoleDashboard({ data }: { data: DashboardResponse }): JSX.Element {
  if (data.role === "ADMIN") return <AdminDashboardView data={data} />;
  if (data.role === "EMPLOYEE") return <EmployeeDashboardView data={data} />;
  return <ClientDashboardView data={data} />;
}

/* =============================================================================
 * Shared UI
 * ============================================================================= */

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
}): JSX.Element {
  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={1}>
          <Typography variant="overline" color="text.secondary">
            {title}
          </Typography>
          <Typography variant="h5" fontWeight={700}>
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
}): JSX.Element {
  if (items.length === 0) {
    return <Typography color="text.secondary">{emptyText}</Typography>;
  }

  return (
    <List disablePadding>
      {items.map((a) => {
        const chip = statusChipProps(a.status);
        return (
          <ListItem key={a.id} disableGutters>
            <ListItemText
              primary={
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                  <Typography fontWeight={600}>{formatDateTime(a.start)}</Typography>
                  <Chip size="small" {...chip} />
                  <Typography>{a.service_name}</Typography>
                </Stack>
              }
              secondary={
                <Stack spacing={0.25}>
                  {showEmployee && (
                    <Typography variant="body2">Pracownik: {a.employee_name}</Typography>
                  )}
                  {showClient && (
                    <Typography variant="body2">Klient: {a.client_name ?? "—"}</Typography>
                  )}
                  <Typography variant="body2">Cena: {a.service_price} zł</Typography>
                </Stack>
              }
            />
          </ListItem>
        );
      })}
    </List>
  );
}

/* =============================================================================
 * ADMIN
 * ============================================================================= */

function AdminDashboardView({
  data,
}: {
  data: Extract<DashboardResponse, { role: "ADMIN" }>;
}): JSX.Element {
  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
        <StatCard
          title="Wizyty dzisiaj"
          value={data.today.appointments_count}
          hint={data.today.date}
          action={
            <Button component={RouterLink} to="/admin/appointments" size="small">
              Zobacz
            </Button>
          }
        />
        <StatCard title="Oczekujące wizyty" value={data.pending_appointments} />
        <StatCard
          title="Przychód (miesiąc)"
          value={formatMoneyPLN(data.current_month.revenue)}
          hint={`Zakończone: ${data.current_month.completed_appointments}`}
        />
      </Stack>

      {/* ✅ wykorzystanie backend.system */}
      <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
        <StatCard title="Aktywni pracownicy" value={data.system.active_employees} />
        <StatCard title="Aktywni klienci" value={data.system.active_clients} />
        <StatCard title="Aktywne usługi" value={data.system.active_services} />
      </Stack>

      <AdminStatisticsSection />

      <Card variant="outlined">
        <CardContent>
          <Typography variant="h6" fontWeight={700}>
            Grafik na dziś
          </Typography>
          <Divider sx={{ my: 1 }} />
          <AppointmentsList items={data.today.appointments} emptyText="Brak wizyt na dziś." />
        </CardContent>
      </Card>
    </Stack>
  );
}

function AdminStatisticsSection(): JSX.Element {
  const today = new Date();
  const [dateFrom, setDateFrom] = React.useState(
    toYmd(new Date(today.getTime() - 30 * 86400000))
  );
  const [dateTo, setDateTo] = React.useState(toYmd(today));

  const [stats, setStats] = React.useState<StatsState>({ status: "idle" });
  const [localError, setLocalError] = React.useState<string | null>(null);

  const load = async () => {
    if (dateFrom && dateTo && dateFrom > dateTo) {
      setLocalError("Błędny zakres: data 'Od' nie może być późniejsza niż data 'Do'.");
      return;
    }
    setLocalError(null);

    setStats({ status: "loading" });
    try {
      const data = await statisticsApi.get({ date_from: dateFrom, date_to: dateTo });
      setStats({ status: "success", data });
    } catch (e) {
      setStats({ status: "error", message: getErrorMessage(e) });
    }
  };

  React.useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={2}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h6" fontWeight={700}>
              Statystyki
            </Typography>
            <Button variant="outlined" size="small" onClick={() => void load()}>
              Pobierz
            </Button>
          </Stack>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <TextField
              type="date"
              label="Od"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
            <TextField
              type="date"
              label="Do"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
          </Stack>

          {localError && <Alert severity="warning">{localError}</Alert>}

          {stats.status === "loading" ? (
            <Stack direction="row" spacing={1} alignItems="center">
              <CircularProgress size={18} />
              <Typography>Ładowanie statystyk…</Typography>
            </Stack>
          ) : stats.status === "error" ? (
            <Alert severity="error">{stats.message}</Alert>
          ) : stats.status === "success" ? (
            <Stack spacing={2}>
              <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                <StatCard
                  title="Wizyty w zakresie"
                  value={stats.data.appointments.count_in_range}
                  hint={`${stats.data.range.from} → ${stats.data.range.to}`}
                />
                <StatCard
                  title="Przychód zakończonych (zakres)"
                  value={formatMoneyPLN(stats.data.appointments.revenue_completed_in_range)}
                  hint="Tylko status COMPLETED"
                />
                <StatCard
                  title="Wizyty (wszystkie czasy)"
                  value={stats.data.appointments.total_all_time}
                />
              </Stack>

              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle1" fontWeight={700}>
                    Wizyty wg statusu
                  </Typography>
                  <Divider sx={{ my: 1 }} />
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    {stats.data.appointments.by_status.map((s) => {
                      const chip = statusChipProps(s.status);
                      return (
                        <Chip
                          key={s.status}
                          size="small"
                          label={`${chip.label}: ${s.count}`}
                          color={chip.color}
                          variant="outlined"
                        />
                      );
                    })}
                  </Stack>
                </CardContent>
              </Card>

              <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                <Card variant="outlined" sx={{ flex: 1 }}>
                  <CardContent>
                    <Typography variant="subtitle1" fontWeight={700}>
                      Top usługi (zakres)
                    </Typography>
                    <Divider sx={{ my: 1 }} />
                    {stats.data.top_services_in_range.length === 0 ? (
                      <Typography color="text.secondary">Brak danych.</Typography>
                    ) : (
                      <List disablePadding>
                        {stats.data.top_services_in_range.map((s) => (
                          <ListItem key={s.service__id} disableGutters>
                            <ListItemText
                              primary={s.service__name}
                              secondary={`Ilość wizyt: ${s.count}`}
                            />
                          </ListItem>
                        ))}
                      </List>
                    )}
                  </CardContent>
                </Card>

                <Card variant="outlined" sx={{ flex: 1 }}>
                  <CardContent>
                    <Typography variant="subtitle1" fontWeight={700}>
                      Top pracownicy (zakres)
                    </Typography>
                    <Divider sx={{ my: 1 }} />
                    {stats.data.top_employees_in_range.length === 0 ? (
                      <Typography color="text.secondary">Brak danych.</Typography>
                    ) : (
                      <List disablePadding>
                        {stats.data.top_employees_in_range.map((e) => (
                          <ListItem key={e.employee__id} disableGutters>
                            <ListItemText
                              primary={`Nr: ${e.employee__employee_number}`}
                              secondary={`Ilość wizyt: ${e.count}`}
                            />
                          </ListItem>
                        ))}
                      </List>
                    )}
                  </CardContent>
                </Card>
              </Stack>
            </Stack>
          ) : (
            <Typography color="text.secondary">Ustaw zakres i kliknij „Pobierz”.</Typography>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}

/* =============================================================================
 * EMPLOYEE
 * ============================================================================= */

function EmployeeDashboardView({
  data,
}: {
  data: Extract<DashboardResponse, { role: "EMPLOYEE" }>;
}): JSX.Element {
  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
        <StatCard title="Profil" value={data.full_name} hint={`Nr: ${data.employee_number}`} />
        <StatCard
          title="Wizyty dziś"
          value={data.today.appointments.length}
          hint={data.today.date}
        />
        <StatCard
          title="Zakończone w tym miesiącu"
          value={data.this_month.completed_appointments}
        />
      </Stack>

      <Card variant="outlined">
        <CardContent>
          <Typography variant="h6" fontWeight={700}>
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

      {/* ✅ wykorzystanie backend.upcoming */}
      <Card variant="outlined">
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h6" fontWeight={700}>
              Najbliższe 7 dni
            </Typography>
            <Chip size="small" label={`Razem: ${data.upcoming.count}`} variant="outlined" />
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

/* =============================================================================
 * CLIENT
 * ============================================================================= */

function ClientDashboardView({
  data,
}: {
  data: Extract<DashboardResponse, { role: "CLIENT" }>;
}): JSX.Element {
  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
        <StatCard
          title="Nadchodzące wizyty"
          value={data.upcoming_appointments.count}
          action={
            <Button component={RouterLink} to="/client/booking">
              Umów wizytę
            </Button>
          }
        />
        {/* ✅ wykorzystanie backend.history */}
        <StatCard
          title="Historia (zakończone)"
          value={data.history.total_completed}
          hint="Status COMPLETED"
        />
      </Stack>

      <Card variant="outlined">
        <CardContent>
          <Typography variant="h6" fontWeight={700}>
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

      {/* ✅ backend.history.recent */}
      <Card variant="outlined">
        <CardContent>
          <Typography variant="h6" fontWeight={700}>
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
