import { NavLink, useNavigate } from 'react-router-dom';
import type { ReactElement } from 'react';
import { useAuth } from '../../hooks/useAuth';
import type { UserRole } from '../../types';

interface NavItem {
  label: string;
  path: string;
  roles: UserRole[];
}

export function Sidebar(): ReactElement | null {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) {
    return null;
  }

  const navItems: NavItem[] = [
    {
      label: 'Dashboard',
      path: '/dashboard',
      roles: ['manager', 'employee', 'client'],
    },

    // ✅ NOWE: Profil (manager)
    {
      label: 'Profil',
      path: '/profile',
      roles: ['manager'],
    },

    {
      label: 'Wizyty (zarządzanie)',
      path: '/appointments',
      roles: ['manager'],
    },

    // MANAGER
    {
      label: 'Grafik (zarządzanie)',
      path: '/schedule',
      roles: ['manager'],
    },

    // Statystyki (manager)
    {
      label: 'Statystyki',
      path: '/statistics',
      roles: ['manager'],
    },

    // EMPLOYEE
    {
      label: 'Mój grafik',
      path: '/my-schedule',
      roles: ['employee'],
    },

    // ✅ JEDEN wpis /services (etykieta zależna od roli)
    {
      label: user.role === 'client' ? 'Usługi' : 'Usługi (zarządzanie)',
      path: '/services',
      roles: ['manager', 'employee', 'client'],
    },

    // CLIENT
    {
      label: 'Umów wizytę',
      path: '/book',
      roles: ['client'],
    },

    {
      label: 'Moje wizyty',
      path: '/my-appointments',
      roles: ['employee', 'client'],
    },
    {
      label: 'Klienci',
      path: '/clients',
      roles: ['manager'],
    },

    // Manager: Payments, Invoices, Notifications
    {
      label: 'Płatności',
      path: '/payments',
      roles: ['manager'],
    },
    {
      label: 'Faktury',
      path: '/invoices',
      roles: ['manager'],
    },
    {
      label: 'Powiadomienia',
      path: '/notifications',
      roles: ['manager'],
    },

    // Raporty / Logi
    {
      label: 'Raporty',
      path: '/reports',
      roles: ['manager'],
    },
    {
      label: 'Logi systemowe',
      path: '/system-logs',
      roles: ['manager'],
    },

    {
      label: 'Pracownicy',
      path: '/employees',
      roles: ['manager'],
    },
    {
      label: 'Ustawienia',
      path: '/settings',
      roles: ['manager'],
    },
  ];

  const handleLogout = async (): Promise<void> => {
    const ok = window.confirm('Czy na pewno chcesz się wylogować?');
    if (!ok) return;

    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <aside
      style={{
        width: 220,
        padding: 16,
        backgroundColor: '#fde2e4',
        borderRight: '1px solid #f3c4cc',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
    >
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {navItems
          .filter((item) => item.roles.includes(user.role))
          .map((item) => (
            <NavLink
              key={`${item.path}-${item.label}`}
              to={item.path}
              style={({ isActive }) => ({
                padding: '10px 14px',
                borderRadius: 8,
                textDecoration: 'none',
                color: '#5a2a35',
                backgroundColor: isActive ? '#f8c1cc' : 'transparent',
                fontWeight: isActive ? 700 : 500,
              })}
            >
              {item.label}
            </NavLink>
          ))}
      </nav>

      <button
        onClick={() => void handleLogout()}
        style={{
          marginTop: 20,
          padding: '10px 14px',
          borderRadius: 8,
          border: '1px solid #e6a1ad',
          backgroundColor: '#fff0f3',
          color: '#8b2c3b',
          cursor: 'pointer',
          fontWeight: 700,
        }}
      >
        Wyloguj
      </button>
    </aside>
  );
}
