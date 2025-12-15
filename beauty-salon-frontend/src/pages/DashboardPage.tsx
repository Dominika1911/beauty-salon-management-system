import React, { useEffect, useState, useCallback } from 'react';
import type { ReactElement } from 'react';
import { useAuth } from '../hooks/useAuth';
import { dashboardAPI, statisticsAPI } from '../api';
import { Modal } from '../components/UI/Modal';
import type {
  DashboardData,
  ClientDashboardData,
  EmployeeDashboardData,
  ManagerDashboardData,
  DashboardAppointment,
  StatisticsResponse,
} from '../types';
import './DashboardPage.css';

// --- DEFINICJE INTERFEJSÓW DLA PROPSÓW KOMPONENTÓW ---
interface ClientProps { data: ClientDashboardData; }
interface EmployeeProps { data: EmployeeDashboardData; }
interface ManagerProps {
  data: ManagerDashboardData;
  statsSummary30d: StatisticsResponse['summary'] | null;
}

// ==================== HELPERY ====================

const toNumber = (v: unknown): number => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v.replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
};

const toMoney = (v: unknown): string => {
  if (v === null || v === undefined) return '0.00';
  if (typeof v === 'number' && Number.isFinite(v)) return v.toFixed(2);
  if (typeof v === 'string') return v;
  return '0.00';
};

const sumManagerStats = (data: ManagerDashboardData): number => {
  // backend potrafi nie zwrócić stats -> zabezpieczenie
  const s = (data as unknown as { stats?: Record<string, unknown> }).stats ?? {};
  return (
    toNumber(s.total_appointments) +
    toNumber(s.pending_appointments) +
    toNumber(s.completed_today) +
    toNumber(s.total_clients) +
    toNumber(s.total_employees) +
    toNumber(s.active_employees) +
    toNumber(s.revenue_today) +
    toNumber(s.revenue_this_month)
  );
};

// ==================== DASHBOARD KLIENTA ====================

const ClientDashboard: React.FC<ClientProps> = ({ data }: ClientProps): ReactElement => (
  <div className="client-dashboard">
    <div className="stats-row">
      <div className="stat-card">
        <div className="stat-icon">💰</div>
        <div className="stat-content">
          <h3>Łączne wydatki</h3>
          <p className="stat-value">{data.total_spent || data.stats?.total_spent || '0.00'} PLN</p>
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-icon">📅</div>
        <div className="stat-content">
          <h3>Liczba wizyt</h3>
          <p className="stat-value">{data.client?.visits_count || 0}</p>
        </div>
      </div>
    </div>

    <div className="appointments-section">
      <h2>📆 Nadchodzące wizyty ({data.upcoming_appointments?.length || 0})</h2>
      <div className="appointments-grid">
        {data.upcoming_appointments && data.upcoming_appointments.length > 0 ? (
          data.upcoming_appointments.map((apt: DashboardAppointment) => (
            <div key={apt.id} className="appointment-card">
              <h3>{apt.service_name}</h3>
              <p className="apt-date">📅 {new Date(apt.start).toLocaleString('pl-PL')}</p>
              <p className="apt-employee">👤 {apt.employee_name}</p>
              <span className={`status-badge ${apt.status}`}>{apt.status_display}</span>
            </div>
          ))
        ) : (
          <div className="no-data">
            <p>Brak nadchodzących wizyt</p>
          </div>
        )}
      </div>
    </div>

    <div className="appointments-section">
      <h2>📜 Ostatnie wizyty</h2>
      <div className="appointments-grid">
        {data.last_visits && data.last_visits.length > 0 ? (
          data.last_visits.map((apt: DashboardAppointment) => (
            <div key={apt.id} className="appointment-card past">
              <h3>{apt.service_name}</h3>
              <p className="apt-date">📅 {new Date(apt.start).toLocaleString('pl-PL')}</p>
              <span className={`status-badge ${apt.status}`}>{apt.status_display}</span>
            </div>
          ))
        ) : (
          <div className="no-data">
            <p>Brak historii wizyt</p>
          </div>
        )}
      </div>
    </div>
  </div>
);

// ==================== DASHBOARD PRACOWNIKA ====================

const EmployeeDashboard: React.FC<EmployeeProps> = ({ data }: EmployeeProps): ReactElement => (
  <div className="employee-dashboard">
    <div className="stats-row">
      <div className="stat-card highlight">
        <div className="stat-icon">📅</div>
        <div className="stat-content">
          <h3>Wizyty dzisiaj</h3>
          <p className="stat-value">{data.stats?.today_appointments_count || data.stats?.today_appointments || 0}</p>
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-icon">📆</div>
        <div className="stat-content">
          <h3>Nadchodzące</h3>
          <p className="stat-value">{data.stats?.upcoming_appointments_count || data.upcoming_appointments?.length || 0}</p>
        </div>
      </div>
    </div>

    <div className="appointments-section">
      <h2>🕐 Dzisiejsze wizyty</h2>
      <div className="appointments-grid">
        {data.today_appointments && data.today_appointments.length > 0 ? (
          data.today_appointments.map((apt: DashboardAppointment) => (
            <div key={apt.id} className="appointment-card today">
              <h3>{apt.service_name}</h3>
              <p className="apt-client">👤 {apt.client_name}</p>
              <p className="apt-time">
                🕐 {new Date(apt.start).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}
              </p>
              <span className={`status-badge ${apt.status}`}>{apt.status_display}</span>
            </div>
          ))
        ) : (
          <div className="no-data">
            <p>Brak wizyt dzisiaj</p>
          </div>
        )}
      </div>
    </div>

    <div className="appointments-section">
      <h2>📆 Nadchodzące wizyty</h2>
      <div className="appointments-grid">
        {data.upcoming_appointments && data.upcoming_appointments.length > 0 ? (
          data.upcoming_appointments.slice(0, 6).map((apt: DashboardAppointment) => (
            <div key={apt.id} className="appointment-card">
              <h3>{apt.service_name}</h3>
              <p className="apt-client">👤 {apt.client_name}</p>
              <p className="apt-date">📅 {new Date(apt.start).toLocaleString('pl-PL')}</p>
              <span className={`status-badge ${apt.status}`}>{apt.status_display}</span>
            </div>
          ))
        ) : (
          <div className="no-data">
            <p>Brak nadchodzących wizyt</p>
          </div>
        )}
      </div>
    </div>
  </div>
);

// ==================== DASHBOARD MANAGERA ====================

const ManagerDashboard: React.FC<ManagerProps> = ({ data, statsSummary30d }: ManagerProps): ReactElement => {
  const isSameLocalDay = (a: Date, b: Date): boolean =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  const todayTotalFromRoot = toNumber(data.today?.total_appointments);
  const todayTotalFromUpcoming = Array.isArray(data.upcoming_appointments)
    ? data.upcoming_appointments.filter((apt) => {
        const d = new Date(apt.start);
        return Number.isFinite(d.getTime()) && isSameLocalDay(d, new Date());
      }).length
    : 0;

  const todayTotal = todayTotalFromRoot > 0 ? todayTotalFromRoot : todayTotalFromUpcoming;

  const dashboardStatsLooksEmpty = sumManagerStats(data) === 0;
  const useStatsSummary = dashboardStatsLooksEmpty && !!statsSummary30d;

  // stats może nie istnieć w runtime
  const stats = (data as unknown as { stats?: Record<string, unknown> }).stats ?? {};

  const totalAppointments = useStatsSummary ? statsSummary30d!.total_appointments : toNumber(stats.total_appointments);
  const totalClients = useStatsSummary ? statsSummary30d!.total_clients : toNumber(stats.total_clients);

  const completedAppointments = useStatsSummary ? statsSummary30d!.completed_appointments : toNumber(stats.completed_today);
  const cancelledAppointments = useStatsSummary ? statsSummary30d!.cancelled_appointments : 0;
  const noShowAppointments = useStatsSummary ? statsSummary30d!.no_show_appointments : 0;

  const totalRevenue = useStatsSummary ? statsSummary30d!.total_revenue : null;

  const pendingAppointments = toNumber(stats.pending_appointments);
  const totalEmployees = toNumber(stats.total_employees);
  const activeEmployees = toNumber(stats.active_employees);

  const revenueToday = toMoney(stats.revenue_today);
  const revenueThisMonth = toMoney(stats.revenue_this_month);

  return (
    <div className="manager-dashboard">
      <div className="stats-row">
        <div className="stat-card highlight">
          <div className="stat-icon">📅</div>
          <div className="stat-content">
            <h3>Wizyty dzisiaj</h3>
            <p className="stat-value">{todayTotal}</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">📋</div>
          <div className="stat-content">
            <h3>Wizyty (okres)</h3>
            <p className="stat-value">{totalAppointments}</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">👥</div>
          <div className="stat-content">
            <h3>Klienci (okres)</h3>
            <p className="stat-value">{totalClients}</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">✅</div>
          <div className="stat-content">
            <h3>Ukończone (okres)</h3>
            <p className="stat-value">{completedAppointments}</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">❌</div>
          <div className="stat-content">
            <h3>Anulowane (okres)</h3>
            <p className="stat-value">{cancelledAppointments}</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">🙈</div>
          <div className="stat-content">
            <h3>No-show (okres)</h3>
            <p className="stat-value">{noShowAppointments}</p>
          </div>
        </div>

        {totalRevenue !== null ? (
          <div className="stat-card">
            <div className="stat-icon">💰</div>
            <div className="stat-content">
              <h3>Przychód (okres)</h3>
              <p className="stat-value">{totalRevenue} PLN</p>
            </div>
          </div>
        ) : (
          <>
            <div className="stat-card">
              <div className="stat-icon">💵</div>
              <div className="stat-content">
                <h3>Przychód dzisiaj</h3>
                <p className="stat-value">{revenueToday} PLN</p>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon">📈</div>
              <div className="stat-content">
                <h3>Przychód w tym miesiącu</h3>
                <p className="stat-value">{revenueThisMonth} PLN</p>
              </div>
            </div>
          </>
        )}

        <div className="stat-card">
          <div className="stat-icon">⏳</div>
          <div className="stat-content">
            <h3>Oczekujące</h3>
            <p className="stat-value">{pendingAppointments}</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">🧑‍💼</div>
          <div className="stat-content">
            <h3>Pracownicy</h3>
            <p className="stat-value">{totalEmployees}</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">🟢</div>
          <div className="stat-content">
            <h3>Aktywni pracownicy</h3>
            <p className="stat-value">{activeEmployees}</p>
          </div>
        </div>
      </div>

      {useStatsSummary ? (
        <div className="no-data">
          <p>👄👄👄</p>
        </div>
      ) : null}

      <div className="appointments-section">
        <h2>📆 Nadchodzące wizyty</h2>
        <div className="appointments-list">
          {data.upcoming_appointments && data.upcoming_appointments.length > 0 ? (
            data.upcoming_appointments.slice(0, 10).map((apt: DashboardAppointment) => (
              <div key={apt.id} className="appointment-row">
                <div className="apt-time-col">{new Date(apt.start).toLocaleString('pl-PL')}</div>
                <div className="apt-service-col">{apt.service_name}</div>
                <div className="apt-client-col">👤 {apt.client_name}</div>
                <div className="apt-employee-col">👨‍💼 {apt.employee_name}</div>
                <span className={`status-badge ${apt.status}`}>{apt.status_display}</span>
              </div>
            ))
          ) : (
            <p className="no-data">Brak nadchodzących wizyt</p>
          )}
        </div>
      </div>

      <div className="appointments-section">
        <h2>🕘 Ostatnie wizyty</h2>
        <div className="appointments-list">
          {data.recent_appointments && data.recent_appointments.length > 0 ? (
            data.recent_appointments.slice(0, 10).map((apt: DashboardAppointment) => (
              <div key={apt.id} className="appointment-row">
                <div className="apt-time-col">{new Date(apt.start).toLocaleString('pl-PL')}</div>
                <div className="apt-service-col">{apt.service_name}</div>
                <div className="apt-client-col">👤 {apt.client_name}</div>
                <div className="apt-employee-col">👨‍💼 {apt.employee_name}</div>
                <span className={`status-badge ${apt.status}`}>{apt.status_display}</span>
              </div>
            ))
          ) : (
            <p className="no-data">Brak ostatnich wizyt</p>
          )}
        </div>
      </div>
    </div>
  );
};

// ==================== KOMPONENT GŁÓWNY (DashboardPage) ====================

export const DashboardPage: React.FC = (): ReactElement => {
  const { user, isClient, isEmployee, isManager } = useAuth();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [statsSummary30d, setStatsSummary30d] = useState<StatisticsResponse['summary'] | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadDashboard = useCallback(
    async (opts?: { showSuccess?: boolean }): Promise<void> => {
      try {
        setLoading(true);
        setError(null);

        const dashRes = await dashboardAPI.get();
        setDashboardData(dashRes.data as DashboardData);

        if (isManager) {
          try {
            const stats = await statisticsAPI.get(30);
            setStatsSummary30d(stats.summary);
          } catch (e) {
            console.error('Błąd ładowania statistics (fallback dla dashboardu)', e);
            setStatsSummary30d(null);
          }
        } else {
          setStatsSummary30d(null);
        }

        if (opts?.showSuccess) {
          setSuccessMsg('Dane dashboardu zostały odświeżone.');
        }
      } catch (err) {
        console.error('Błąd ładowania dashboardu', err);
        setError('Nie udało się załadować danych dashboardu.');
      } finally {
        setLoading(false);
      }
    },
    [isManager],
  );

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Ładowanie dashboardu...</p>
      </div>
    );
  }

  const clientData: ClientDashboardData = dashboardData as ClientDashboardData;
  const employeeData: EmployeeDashboardData = dashboardData as EmployeeDashboardData;
  const managerData: ManagerDashboardData = dashboardData as ManagerDashboardData;

  return (
    <div className="dashboard">
      <Modal isOpen={Boolean(error)} onClose={() => setError(null)} title="❌ Błąd">
        <p style={{ marginTop: 0 }}>{error}</p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
          <button type="button" onClick={() => setError(null)}>
            Zamknij
          </button>
          <button type="button" onClick={() => void loadDashboard()}>
            Spróbuj ponownie
          </button>
        </div>
      </Modal>

      <Modal isOpen={Boolean(successMsg)} onClose={() => setSuccessMsg(null)} title="✅ Sukces">
        <p style={{ marginTop: 0 }}>{successMsg}</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
          <button type="button" onClick={() => setSuccessMsg(null)}>
            OK
          </button>
        </div>
      </Modal>

      <div className="dashboard-header">
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
          <h1 style={{ margin: 0 }}>Dashboard</h1>
          <button type="button" onClick={() => void loadDashboard({ showSuccess: true })}>
            Odśwież
          </button>
        </div>
        <p className="user-welcome">
          Witaj, {user?.email} ({user?.role_display})
        </p>
      </div>

      {isClient && dashboardData && <ClientDashboard data={clientData} />}
      {isEmployee && dashboardData && <EmployeeDashboard data={employeeData} />}
      {isManager && dashboardData && <ManagerDashboard data={managerData} statsSummary30d={statsSummary30d} />}
    </div>
  );
};
