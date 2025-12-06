// src/components/Layout/Sidebar.tsx

import React, { type ReactElement } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/useAuth'; // Ścieżka do useAuth w context/
import type { UserRole } from '../../../types'; // Używa typu UserRole (zapewnia bezpieczeństwo)

// Definicja linków nawigacyjnych
interface NavLinkItem {
    to: string;
    label: string;
    // Pusta tablica oznacza, że jest widoczny dla wszystkich zalogowanych.
    roles: UserRole[];
}

const navItems: NavLinkItem[] = [
    // Widoczne dla wszystkich zalogowanych
    { to: 'dashboard', label: 'Dashboard', roles: [] },
    { to: 'services', label: 'Katalog Usług', roles: [] },

    // ZARZĄDZANIE (Manager, Pracownik)
    { to: 'appointments', label: 'Wizyty (Zarządzanie)', roles: ['manager', 'employee'] },
    { to: 'clients', label: 'Klienci', roles: ['manager', 'employee'] },

    // SPECIFICZNE DLA PRACOWNIKA
    { to: 'my-schedule', label: 'Mój Grafik', roles: ['employee'] },

    // SPECIFICZNE DLA KLIENTA
    { to: 'my-appointments', label: 'Moje Rezerwacje', roles: ['client'] },

    // TYLKO MANAGER
    { to: 'employees', label: 'Pracownicy', roles: ['manager'] },
    { to: 'statistics', label: 'Statystyki', roles: ['manager'] },
    { to: 'settings', label: 'Ustawienia Systemu', roles: ['manager'] },
];

export const Sidebar: React.FC = (): ReactElement => {
    const { user, isManager, isEmployee, isClient, logout } = useAuth();

    // Funkcja filtrująca linki według uprawnień
    const isLinkVisible = (roles: NavLinkItem['roles']): boolean => {
        if (roles.length === 0) return true; // Dla wszystkich zalogowanych

        return (
            (isManager && roles.includes('manager')) ||
            (isEmployee && roles.includes('employee')) ||
            (isClient && roles.includes('client'))
        );
    };

    const handleLogout = () => {
        void logout(); // Wywołanie asynchronicznej funkcji logout
    };

    return (
        <aside className="sidebar">
            <div className="sidebar-header">
                <h2>💅 Salon System</h2>
            </div>

            <nav className="sidebar-nav">
                {navItems
                    .filter(item => isLinkVisible(item.roles))
                    .map((item) => (
                        <NavLink
                            key={item.to}
                            to={`/${item.to}`}
                            className={({ isActive }) =>
                                isActive ? 'nav-link active' : 'nav-link'
                            }
                        >
                            {item.label}
                        </NavLink>
                    ))
                }
            </nav>

            <div className="sidebar-footer">
                <div className="user-info">
                    <p>Zalogowano jako:</p>
                    <strong>{user?.email}</strong>
                    <span className={`user-role role-${user?.role}`}>{user?.role}</span>
                </div>
                <button onClick={handleLogout} className="logout-btn">
                    Wyloguj
                </button>
            </div>
        </aside>
    );
};