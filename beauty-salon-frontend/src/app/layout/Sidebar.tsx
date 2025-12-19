import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/shared/hooks/useAuth';
import type { UserRole } from '@/shared/types';
import { Modal } from "@/shared/ui/Modal";

type NavItem = {
  label: string;
  path?: string;
  roles: UserRole[];
  type?: 'link' | 'header';
};

const baseLinkStyle = (isActive: boolean): React.CSSProperties => ({
  padding: '10px 14px',
  borderRadius: 8,
  textDecoration: 'none',
  color: '#5a2a35',
  backgroundColor: isActive ? '#f8c1cc' : 'transparent',
  fontWeight: isActive ? 700 : 500,
});

const headerStyle: React.CSSProperties = {
  marginTop: 14,
  marginBottom: 6,
  fontWeight: 800,
  color: '#8b2c3b',
  fontSize: 14,
};

export function Sidebar(): ReactElement | null {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [logoutModalOpen, setLogoutModalOpen] = useState(false);

  const navItems: NavItem[] = useMemo(() => {
    if (!user) return [];

    return [
      { label: 'Dashboard', path: '/dashboard', roles: ['manager', 'employee', 'client'], type: 'link' },

      // EMPLOYEE
      { label: 'Pracownik', roles: ['employee'], type: 'header' },
      { label: 'Mój profil', path: '/my-profile', roles: ['employee'], type: 'link' },
      { label: 'Moja dostępność', path: '/my-availability', roles: ['employee'], type: 'link' },
      { label: 'Mój grafik', path: '/my-schedule', roles: ['employee'], type: 'link' },
      // ✅ NOWE
      { label: 'Moje urlopy', path: '/my-time-off', roles: ['employee'], type: 'link' },

      // SERVICES
      {
        label: user.role === 'client' ? 'Usługi' : 'Usługi (zarządzanie)',
        path: '/services',
        roles: ['manager', 'employee', 'client'],
        type: 'link',
      },

      // SHARED
      { label: 'Moje wizyty', path: '/my-appointments', roles: ['employee', 'client'], type: 'link' },

      // CLIENT
      { label: 'Klient', roles: ['client'], type: 'header' },
      { label: 'Umów wizytę', path: '/book', roles: ['client'], type: 'link' },

      // MANAGER
      { label: 'Manager', roles: ['manager'], type: 'header' },
      { label: 'Profil', path: '/profile', roles: ['manager'], type: 'link' },
      { label: 'Wizyty (kalendarz)', path: '/appointments', roles: ['manager'], type: 'link' },
      { label: 'Wizyty (lista)', path: '/appointments-management', roles: ['manager'], type: 'link' },
      { label: 'Grafik (zarządzanie)', path: '/schedule', roles: ['manager'], type: 'link' },
      { label: 'Klienci', path: '/clients', roles: ['manager'], type: 'link' },
      { label: 'Pracownicy', path: '/employees', roles: ['manager'], type: 'link' },
      { label: 'Płatności', path: '/payments', roles: ['manager'], type: 'link' },
      { label: 'Faktury', path: '/invoices', roles: ['manager'], type: 'link' },
      { label: 'Powiadomienia', path: '/notifications', roles: ['manager'], type: 'link' },
      { label: 'Raporty', path: '/reports', roles: ['manager'], type: 'link' },
      { label: 'Logi systemowe', path: '/system-logs', roles: ['manager'], type: 'link' },
      { label: 'Statystyki', path: '/statistics', roles: ['manager'], type: 'link' },
      { label: 'Ustawienia', path: '/settings', roles: ['manager'], type: 'link' },
    ];
  }, [user]);

  if (!user) return null;

  const visibleItems = navItems.filter((it) => it.roles.includes(user.role));

  const handleLogout = async (): Promise<void> => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <aside
      style={{
        width: 260,
        padding: 16,
        backgroundColor: '#fde2e4',
        borderRight: '1px solid #f3c4cc',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
    >
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {visibleItems.map((item) => {
          if (item.type === 'header') {
            return (
              <div key={`h-${item.label}`} style={headerStyle}>
                {item.label}
              </div>
            );
          }

          if (!item.path) return null;

          return (
            <NavLink key={`${item.path}-${item.label}`} to={item.path} style={({ isActive }) => baseLinkStyle(isActive)}>
              {item.label}
            </NavLink>
          );
        })}
      </nav>

      <button
        type="button"
        onClick={() => setLogoutModalOpen(true)}
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

      <Modal isOpen={logoutModalOpen} onClose={() => setLogoutModalOpen(false)} title="Wylogowanie">
        <div style={{ padding: 12 }}>
          <p style={{ marginTop: 0 }}>Czy na pewno chcesz się wylogować?</p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
            <button
              type="button"
              onClick={() => setLogoutModalOpen(false)}
              style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid #ccc', cursor: 'pointer' }}
            >
              Anuluj
            </button>
            <button
              type="button"
              onClick={() => void handleLogout()}
              style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid #ccc', cursor: 'pointer' }}
            >
              Wyloguj
            </button>
          </div>
        </div>
      </Modal>
    </aside>
  );
}
