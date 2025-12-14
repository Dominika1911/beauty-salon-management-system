import React, { type ReactElement, useMemo } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import type { UserRole } from '../../types';

interface NavLinkItem {
  to: string;          // ścieżka BEZ wiodącego "/"
  label: string;
  roles: UserRole[];   // [] = dostępne dla wszystkich zalogowanych
}

const navItems: NavLinkItem[] = [
  // === WSPÓLNE ===
  { to: 'dashboard', label: 'Dashboard', roles: [] },
  { to: 'services', label: 'Katalog Usług', roles: [] },

  // === MANAGER + EMPLOYEE ===
  { to: 'appointments', label: 'Wizyty (Zarządzanie)', roles: ['manager', 'employee'] },
  { to: 'appointments-calendar', label: 'Wizyty (Kalendarz)', roles: ['manager', 'employee'] },
  { to: 'clients', label: 'Klienci', roles: ['manager', 'employee'] },
  { to: 'employees', label: 'Pracownicy', roles: ['manager', 'employee'] },

  // === MANAGER ===
  { to: 'schedule', label: 'Grafiki Pracowników', roles: ['manager'] },
  { to: 'reports', label: 'Raporty (PDF)', roles: ['manager'] },        // ✅ DODANE
  { to: 'audit-logs', label: 'Logi Operacji', roles: ['manager'] },     // ✅ DODANE
  { to: 'statistics', label: 'Statystyki', roles: ['manager', 'employee'] },
  { to: 'settings', label: 'Ustawienia Systemu', roles: ['manager'] },

  // === EMPLOYEE ===
  { to: 'my-schedule', label: 'Mój Grafik', roles: ['employee'] },

  // === CLIENT ===
  { to: 'my-appointments', label: 'Moje Rezerwacje', roles: ['client'] },
];

export const Sidebar: React.FC = (): ReactElement => {
  const { user, logout } = useAuth();
  const role = user?.role;

  const visibleNavItems = useMemo(() => {
    return navItems.filter((item) => {
      if (item.roles.length === 0) return true;
      if (!role) return false;
      return item.roles.includes(role);
    });
  }, [role]);

  const handleLogout = (): void => {
    void logout();
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h2>💅 Beauty Salon</h2>
        <small>Management System</small>
      </div>

      <nav className="sidebar-nav">
        {visibleNavItems.map((item) => (
          <NavLink
            key={item.to}
            to={`/${item.to}`}
            className={({ isActive }) =>
              isActive ? 'nav-link active' : 'nav-link'
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="user-info">
          <p>Zalogowano jako:</p>
          <strong>{user?.email ?? '—'}</strong>
          <span className={`user-role role-${user?.role ?? 'unknown'}`}>
            {user?.role ?? 'unknown'}
          </span>
        </div>

        <button onClick={handleLogout} className="logout-btn">
          Wyloguj
        </button>
      </div>
    </aside>
  );
};
