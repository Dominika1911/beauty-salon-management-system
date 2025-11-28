// src/pages/DashboardPage.tsx

import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { dashboardAPI } from '../api';
import type { DashboardData } from '../api/dashboard';
import './DashboardPage.css';

export const DashboardPage = () => {
  const { user, isClient, isEmployee, isManager } = useAuth();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const { data } = await dashboardAPI.get();
      setDashboardData(data);
    } catch (err: any) {
      console.error('Dashboard load failed:', err);
      setError(err.response?.data?.detail || 'Błąd ładowania dashboardu');
    } finally {
      setLoading(false);
    }
  };

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

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>Dashboard</h1>
        <p className="user-welcome">Witaj, {user?.email} ({user?.role_display})</p>
      </div>

      {isClient && dashboardData && <ClientDashboard data={dashboardData} />}
      {isEmployee && dashboardData && <EmployeeDashboard data={dashboardData} />}
      {isManager && dashboardData && <ManagerDashboard data={dashboardData} />}
    </div>
  );
};

// ==================== DASHBOARD KLIENTA ====================

const ClientDashboard = ({ data }: { data: DashboardData }) => (
  <div className="client-dashboard">
    <div className="stats-row">
      <div className="stat-card">
        <div className="stat-icon">💰</div>
        <div className="stat-content">
          <h3>Łączne wydatki</h3>
          <p className="stat-value">{data.total_spent || '0.00'} PLN</p>
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
          data.upcoming_appointments.map((apt: any) => (
            <div key={apt.id} className="appointment-card">
              <h3>{apt.service_name}</h3>
              <p className="apt-date">📅 {new Date(apt.start).toLocaleString('pl-PL')}</p>
              <p className="apt-employee">👤 {apt.employee_name}</p>
              <span className={`status-badge ${apt.status}`}>{apt.status_display}</span>
            </div>
          ))
        ) : (
          <p className="no-data">Brak nadchodzących wizyt</p>
        )}
      </div>
    </div>

    <div className="appointments-section">
      <h2>📜 Ostatnie wizyty</h2>
      <div className="appointments-grid">
        {data.last_visits && data.last_visits.length > 0 ? (
          data.last_visits.map((apt: any) => (
            <div key={apt.id} className="appointment-card past">
              <h3>{apt.service_name}</h3>
              <p className="apt-date">📅 {new Date(apt.start).toLocaleString('pl-PL')}</p>
              <span className={`status-badge ${apt.status}`}>{apt.status_display}</span>
            </div>
          ))
        ) : (
          <p className="no-data">Brak historii wizyt</p>
        )}
      </div>
    </div>
  </div>
);

// ==================== DASHBOARD PRACOWNIKA ====================

const EmployeeDashboard = ({ data }: { data: DashboardData }) => (
  <div className="employee-dashboard">
    <div className="stats-row">
      <div className="stat-card highlight">
        <div className="stat-icon">📅</div>
        <div className="stat-content">
          <h3>Wizyty dzisiaj</h3>
          <p className="stat-value">{data.today_appointments_count || 0}</p>
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-icon">📆</div>
        <div className="stat-content">
          <h3>Nadchodzące</h3>
          <p className="stat-value">{data.upcoming_appointments_count || 0}</p>
        </div>
      </div>
    </div>

    <div className="appointments-section">
      <h2>🕐 Dzisiejsze wizyty</h2>
      <div className="appointments-grid">
        {data.today_appointments && data.today_appointments.length > 0 ? (
          data.today_appointments.map((apt: any) => (
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
          <p className="no-data">Brak wizyt dzisiaj</p>
        )}
      </div>
    </div>

    <div className="appointments-section">
      <h2>📆 Nadchodzące wizyty</h2>
      <div className="appointments-grid">
        {data.upcoming_appointments && data.upcoming_appointments.length > 0 ? (
          data.upcoming_appointments.slice(0, 6).map((apt: any) => (
            <div key={apt.id} className="appointment-card">
              <h3>{apt.service_name}</h3>
              <p className="apt-client">👤 {apt.client_name}</p>
              <p className="apt-date">📅 {new Date(apt.start).toLocaleString('pl-PL')}</p>
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

// ==================== DASHBOARD MANAGERA ====================

const ManagerDashboard = ({ data }: { data: DashboardData }) => (
  <div className="manager-dashboard">
    <div className="stats-row">
      <div className="stat-card">
        <div className="stat-icon">📅</div>
        <div className="stat-content">
          <h3>Wizyty dzisiaj</h3>
          <p className="stat-value">{data.today?.total_appointments || 0}</p>
        </div>
      </div>

      <div className="stat-card success">
        <div className="stat-icon">✅</div>
        <div className="stat-content">
          <h3>Zrealizowane</h3>
          <p className="stat-value">{data.today?.completed_appointments || 0}</p>
        </div>
      </div>

      <div className="stat-card warning">
        <div className="stat-icon">❌</div>
        <div className="stat-content">
          <h3>Anulowane</h3>
          <p className="stat-value">{data.today?.cancelled_appointments || 0}</p>
        </div>
      </div>

      <div className="stat-card highlight">
        <div className="stat-icon">💰</div>
        <div className="stat-content">
          <h3>Przychód dziś</h3>
          <p className="stat-value">{data.today?.revenue || '0.00'} PLN</p>
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-icon">👥</div>
        <div className="stat-content">
          <h3>Nowi klienci</h3>
          <p className="stat-value">{data.today?.new_clients || 0}</p>
        </div>
      </div>
    </div>

    <div className="appointments-section">
      <h2>📆 Nadchodzące wizyty</h2>
      <div className="appointments-list">
        {data.upcoming_appointments && data.upcoming_appointments.length > 0 ? (
          data.upcoming_appointments.slice(0, 10).map((apt: any) => (
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