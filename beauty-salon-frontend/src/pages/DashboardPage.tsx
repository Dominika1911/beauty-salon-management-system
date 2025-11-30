import React, { useEffect, useState, useCallback } from 'react';
import type { ReactElement } from 'react';
import { useAuth } from '../hooks/useAuth';
import { dashboardAPI } from '../api';
import type {
  DashboardData,
  ClientDashboardData,
  EmployeeDashboardData,
  ManagerDashboardData,
  DashboardAppointment,
} from '../types';
import './DashboardPage.css';

// --- DEFINICJE INTERFEJSÓW DLA PROPSÓW KOMPONENTÓW ---
interface ClientProps { data: ClientDashboardData; }
interface EmployeeProps { data: EmployeeDashboardData; }
interface ManagerProps { data: ManagerDashboardData; }


// ==================== DASHBOARD KLIENTA ====================

const ClientDashboard: React.FC<ClientProps> = ({ data }: { data: ClientDashboardData }): ReactElement => (
  <div className="client-dashboard">
    <div className="stats-row">
      <div className="stat-card">
        <div className="stat-icon">💰</div>
        <div className="stat-content">
          <h3>Łączne wydatki</h3>
          <p className="stat-value">{(data as ClientDashboardData).total_spent || '0.00'} PLN</p>
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-icon">📅</div>
        <div className="stat-content">
          <h3>Liczba wizyt</h3>
          <p className="stat-value">{(data as ClientDashboardData).client?.visits_count || 0}</p>
        </div>
      </div>
    </div>

    <div className="appointments-section">
      <h2>📆 Nadchodzące wizyty ({(data as ClientDashboardData).upcoming_appointments?.length || 0})</h2>
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

const EmployeeDashboard: React.FC<EmployeeProps> = ({ data }: { data: EmployeeDashboardData }): ReactElement => (
  <div className="employee-dashboard">
    <div className="stats-row">
      <div className="stat-card highlight">
        <div className="stat-icon">📅</div>
        <div className="stat-content">
          <h3>Wizyty dzisiaj</h3>
          <p className="stat-value">{(data as EmployeeDashboardData).today_appointments_count || 0}</p>
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-icon">📆</div>
        <div className="stat-content">
          <h3>Nadchodzące</h3>
          <p className="stat-value">{(data as EmployeeDashboardData).upcoming_appointments_count || 0}</p>
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

const ManagerDashboard: React.FC<ManagerProps> = ({ data }: { data: ManagerDashboardData }): ReactElement => (
  <div className="manager-dashboard">
    <div className="stats-row">
      <div className="stat-card">
        <div className="stat-icon">📅</div>
        <div className="stat-content">
          <h3>Wizyty dzisiaj</h3>
          <p className="stat-value">{(data as ManagerDashboardData).today?.total_appointments || 0}</p>
        </div>
      </div>
      {/* ... (pozostałe stat-cards menedżera) ... */}
    </div>

    <div className="appointments-section">
      <h2>📆 Nadchodzące wizyty</h2>
      <div className="appointments-list">
        {data.upcoming_appointments && data.upcoming_appointments.length > 0 ? (
          data.upcoming_appointments.slice(0, 10).map((apt: DashboardAppointment) => (
            <div key={apt.id} className="appointment-row">
              <div className="apt-time-col">
                {new Date(apt.start).toLocaleString('pl-PL')}
              </div>
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
  </div>
);


// ==================== KOMPONENT GŁÓWNY (DashboardPage) ====================

// FIX: Jawne typowanie zmiennej loadDashboard i typu zwracanego
export const DashboardPage: React.FC = (): ReactElement => {
  const { user, isClient, isEmployee, isManager } = useAuth();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);


  const loadDashboard = useCallback(async (): Promise<void> => {
  try {
    setLoading(true);
    setError(null);

    const { data } = await dashboardAPI.get(); // ⬅ TU wracamy do get()
    setDashboardData(data as DashboardData);
  } catch (err) {
    console.error('Błąd ładowania dashboardu', err);
    setError('Nie udało się załadować danych dashboardu.');
  } finally {
    setLoading(false);
  }
}, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Ładowanie dashboardu...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <h2>❌ Błąd</h2>
        <p>{error}</p>
        <button onClick={loadDashboard}>Spróbuj ponownie</button>
      </div>
    );
  }

    const clientData: ClientDashboardData = dashboardData as ClientDashboardData;
    const employeeData: EmployeeDashboardData = dashboardData as EmployeeDashboardData;
    const managerData: ManagerDashboardData = dashboardData as ManagerDashboardData;

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>Dashboard</h1>
        <p className="user-welcome">Witaj, {user?.email} ({user?.role_display})</p>
      </div>

      {isClient && dashboardData && <ClientDashboard data={clientData} />}
      {isEmployee && dashboardData && <EmployeeDashboard data={employeeData} />}
      {isManager && dashboardData && <ManagerDashboard data={managerData} />}
    </div>
  );
};