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
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import type { AlertColor } from "@mui/material/Alert";

import type { Appointment, AppointmentStatus, DashboardResponse } from "@/types";
import { dashboardApi } from "@/api/dashboard";
import { statisticsApi } from "@/api/statistics";
import { parseDrfError } from "@/utils/drfErrors";

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

type SnackState = {
  open: boolean;
  msg: string;
  severity: AlertColor;
};

/* =============================================================================
 * Helpers
 * ============================================================================= */

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
    value === "CANCELLED" ||
    value === "NO_SHOW"
  );
}

function statusChipProps(status: string): {
  label: string;
  color: "default" | "warning" | "success" | "error";
} {
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
    case "NO_SHOW":
      return { label: "No-show", color: "error" };
    default:
      return { label: status, color: "default" };
  }
}

function formatMoneyPLN(value: number): string {
  return new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN" }).format(value);
}

/* =============================================================================
 * Page
 * ============================================================================= */

export default function DashboardPage(): JSX.Element {
  const [state, setState] = React.useState<ViewState>({ status: "idle" });
  const [snack, setSnack] = React.useState<SnackState>({
    open: false,
    msg: "",
    severity: "info",
  });

  const load = React.useCallback(async (showSnack = false) => {
    setState({ status: "loading" });
    try {
      const data = await dashboardApi.get();
      setState({ status: "success", data });
      if (showSnack) {
        setSnack({ open: true, msg: "Dane odświeżone.", severity: "info" });
      }
    } catch (e: unknown) {
      const parsed = parseDrfError(e);
      setState({ status: "error", message: parsed.message || "Nie udało się pobrać danych." });
    }
  }, []);

  React.useEffect(() => {
    void load(false); // bez snacka na wejściu (StrictMode w dev potrafi odpalić efekt 2x)
  }, [load]);

  const loading = state.status === "idle" || state.status === "loading";

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 2, sm: 3 } }}>
      <Stack spacing={2}>
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: { xs: "flex-start", sm: "center" },
            gap: 2,
            flexWrap: "wrap",
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

        {state.status === "error" && (
          <Alert severity="error" onClose={() => setState({ status: "idle" })}>
            {state.message}
          </Alert>
        )}

        {loading ? (
          <Card variant="outlined" sx={{ position: "relative" }}>
            <LinearProgress sx={{ position: "absolute", left: 0, right: 0, top: 0 }} />
            <CardContent>
              <Stack direction="row" spacing={2} alignItems="center" sx={{ pt: 1 }}>
                <CircularProgress size={20} />
                <Typography>Ładowanie danych…</Typography>
              </Stack>
            </CardContent>
          </Card>
        ) : state.status === "success" ? (
          <RoleDashboard data={state.data} />
        ) : null}
      </Stack>

      <Snackbar
        open={snack.open}
        autoHideDuration={2500}
        onClose={() => setSnack((p) => ({ ...p, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={() => setSnack((p) => ({ ...p, open: false }))}
          severity={snack.severity}
          sx={{ width: "100%" }}
        >
          {snack.msg}
        </Alert>
      </Snackbar>
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
    <Card variant="outlined" sx={{ height: "100%" }}>
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
}): JSX.Element {
  if (items.length === 0) {
    return <Typography color="text.secondary">{emptyText}</Typography>;
  }

  return (
    <List disablePadding>
      {items.map((a) => {
        const chip = statusChipProps(a.status);
        return (
          <ListItem key={a.id} disableGutters sx={{ py: 1 }}>
            <ListItemText
              primary={
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                  <Typography fontWeight={700}>{formatDateTime(a.start)}</Typography>
                  <Chip size="small" {...chip} />
                  <Typography>{a.service_name}</Typography>
                </Stack>
              }
              secondary={
                <Stack spacing={0.25} sx={{ mt: 0.5 }}>
                  {showEmployee && <Typography variant="body2">Pracownik: {a.employee_name}</Typography>}
                  {showClient && <Typography variant="body2">Klient: {a.client_name ?? "—"}</Typography>}
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

function AdminDashboardView({ data }: { data: Extract<DashboardResponse, { role: "ADMIN" }> }): JSX.Element {
  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
        <Box sx={{ flex: 1 }}>
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
        </Box>
        <Box sx={{ flex: 1 }}>
          <StatCard title="Oczekujące wizyty" value={data.pending_appointments} />
        </Box>
        <Box sx={{ flex: 1 }}>
          <StatCard
            title="Przychód (miesiąc)"
            value={formatMoneyPLN(data.current_month.revenue)}
            hint={`Zakończone: ${data.current_month.completed_appointments}`}
          />
        </Box>
      </Stack>

      <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
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

      <AdminStatisticsSection />

      <Card variant="outlined">
        <CardContent>
          <Typography variant="h6" fontWeight={900}>
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

  const [dateFrom, setDateFrom] = React.useState(toYmd(new Date(today.getTime() - 30 * 86400000)));
  const [dateTo, setDateTo] = React.useState(toYmd(today));

  const [draftFrom, setDraftFrom] = React.useState(dateFrom);
  const [draftTo, setDraftTo] = React.useState(dateTo);

  const [stats, setStats] = React.useState<StatsState>({ status: "idle" });
  const [formError, setFormError] = React.useState<string | null>(null);
  const [snack, setSnack] = React.useState<SnackState>({ open: false, msg: "", severity: "info" });

  const busy = stats.status === "loading";

  const hasUnapplied = draftFrom !== dateFrom || draftTo !== dateTo;

  const applyRange = () => {
    if (draftFrom && draftTo && draftFrom > draftTo) {
      setFormError("Sprawdź zakres dat — „Od” nie może być późniejsza niż „Do”.");
      return;
    }
    setFormError(null);
    setDateFrom(draftFrom);
    setDateTo(draftTo);
  };

  const load = async (showSnack = false) => {
    if (dateFrom && dateTo && dateFrom > dateTo) {
      setFormError("Sprawdź zakres dat — „Od” nie może być późniejsza niż „Do”.");
      return;
    }
    setFormError(null);

    setStats({ status: "loading" });
    try {
      const data = await statisticsApi.get({ date_from: dateFrom, date_to: dateTo });
      setStats({ status: "success", data });
      if (showSnack) {
        setSnack({ open: true, msg: "Statystyki odświeżone.", severity: "info" });
      }
    } catch (e: unknown) {
      const parsed = parseDrfError(e);
      setStats({ status: "error", message: parsed.message || "Nie udało się pobrać statystyk." });
    }
  };

  React.useEffect(() => {
    void load(false); // bez snacka na mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // po apply (zmianie range) pobierz dane, ale bez snacka (to nie jest "ręczne odświeżenie")
  React.useEffect(() => {
    void load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo]);

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={2}>
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: { xs: "flex-start", sm: "center" },
              gap: 2,
              flexWrap: "wrap",
            }}
          >
            <Typography variant="h6" fontWeight={900}>
              Statystyki
            </Typography>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <Button variant="outlined" size="small" onClick={() => void load(true)} disabled={busy}>
                Odśwież
              </Button>
            </Stack>
          </Box>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <TextField
              type="date"
              label="Od"
              value={draftFrom}
              onChange={(e) => setDraftFrom(e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
              disabled={busy}
            />
            <TextField
              type="date"
              label="Do"
              value={draftTo}
              onChange={(e) => setDraftTo(e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
              disabled={busy}
            />
          </Stack>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} justifyContent="flex-end">
            <Button
              variant="outlined"
              size="small"
              onClick={() => {
                setDraftFrom(dateFrom);
                setDraftTo(dateTo);
                setFormError(null);
              }}
              disabled={busy || !hasUnapplied}
            >
              Wyczyść
            </Button>
            <Button variant="contained" size="small" onClick={applyRange} disabled={busy || !hasUnapplied}>
              Zastosuj
            </Button>
          </Stack>

          {formError && <Alert severity="warning">{formError}</Alert>}

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
                <Box sx={{ flex: 1 }}>
                  <StatCard
                    title="Wizyty w zakresie"
                    value={stats.data.appointments.count_in_range}
                    hint={`${stats.data.range.from} → ${stats.data.range.to}`}
                  />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <StatCard
                    title="Przychód zakończonych (zakres)"
                    value={formatMoneyPLN(stats.data.appointments.revenue_completed_in_range)}
                    hint="Tylko zakończone wizyty"
                  />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <StatCard title="Wizyty (łącznie)" value={stats.data.appointments.total_all_time} />
                </Box>
              </Stack>

              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle1" fontWeight={900}>
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
                    <Typography variant="subtitle1" fontWeight={900}>
                      Top usługi (zakres)
                    </Typography>
                    <Divider sx={{ my: 1 }} />
                    {stats.data.top_services_in_range.length === 0 ? (
                      <Typography color="text.secondary">Brak danych.</Typography>
                    ) : (
                      <List disablePadding>
                        {stats.data.top_services_in_range.map((s) => (
                          <ListItem key={s.service__id} disableGutters>
                            <ListItemText primary={s.service__name} secondary={`Liczba wizyt: ${s.count}`} />
                          </ListItem>
                        ))}
                      </List>
                    )}
                  </CardContent>
                </Card>

                <Card variant="outlined" sx={{ flex: 1 }}>
                  <CardContent>
                    <Typography variant="subtitle1" fontWeight={900}>
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
                              secondary={`Liczba wizyt: ${e.count}`}
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
            <Typography color="text.secondary">Ustaw zakres i kliknij „Odśwież”.</Typography>
          )}
        </Stack>
      </CardContent>

      <Snackbar
        open={snack.open}
        autoHideDuration={2500}
        onClose={() => setSnack((p) => ({ ...p, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert onClose={() => setSnack((p) => ({ ...p, open: false }))} severity={snack.severity} sx={{ width: "100%" }}>
          {snack.msg}
        </Alert>
      </Snackbar>
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
        <Box sx={{ flex: 1 }}>
          <StatCard title="Profil" value={data.full_name} hint={`Nr: ${data.employee_number}`} />
        </Box>
        <Box sx={{ flex: 1 }}>
          <StatCard title="Wizyty dziś" value={data.today.appointments.length} hint={data.today.date} />
        </Box>
        <Box sx={{ flex: 1 }}>
          <StatCard title="Zakończone w tym miesiącu" value={data.this_month.completed_appointments} />
        </Box>
      </Stack>

      <Card variant="outlined">
        <CardContent>
          <Typography variant="h6" fontWeight={900}>
            Dzisiaj
          </Typography>
          <Divider sx={{ my: 1 }} />
          <AppointmentsList items={data.today.appointments} emptyText="Brak wizyt dzisiaj." showEmployee={false} />
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h6" fontWeight={900}>
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
          <StatCard title="Historia wizyt" value={data.history.total_completed} hint="Zakończone wizyty" />
        </Box>
      </Stack>

      <Card variant="outlined">
        <CardContent>
          <Typography variant="h6" fontWeight={900}>
            Nadchodzące
          </Typography>
          <Divider sx={{ my: 1 }} />
          <AppointmentsList items={data.upcoming_appointments.appointments} emptyText="Brak nadchodzących wizyt." showClient={false} />
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent>
          <Typography variant="h6" fontWeight={900}>
            Ostatnie zakończone
          </Typography>
          <Divider sx={{ my: 1 }} />
          <AppointmentsList items={data.history.recent} emptyText="Brak zakończonych wizyt w historii." showClient={false} />
        </CardContent>
      </Card>
    </Stack>
  );
}
