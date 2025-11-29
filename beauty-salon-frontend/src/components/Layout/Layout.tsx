// src/components/Layout/Layout.tsx (POPRAWIONY I KOMPLETNIE TYPOWANY)

import React, { useCallback } from 'react';
import { Outlet, Link, useNavigate, type NavigateFunction } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import './Layout.css';

// DODANO JAWNY TYP DLA KOMPONENTU I TYP ZWRACANY
export const Layout: React.FC = (): React.ReactElement => {
  const { user, logout, isManager, isEmployee, isClient } = useAuth();

  // DODANO JAWNY TYP DLA ZMIENNEJ navigate
  const navigate: NavigateFunction = useNavigate();

  // DODANO JAWNY TYP ZWRACANY (Promise<void>) I użyto useCallback
  const handleLogout: () => Promise<void> = useCallback(async (): Promise<void> => {
    await logout();
    navigate('/login');
}, [logout, navigate]);
  // Jeśli nie zalogowany, pokaż tylko content (dla /login)
  // UWAGA: ProtectedRoute już chroni trasy, ale ten warunek jest OK dla samego Layoutu
  if (!user) {
    // Layout powinien być renderowany tylko dla ścieżek dziecka.
    // Jeśli tu trafi, oznacza to, że trasa nie jest chroniona (np. 404 bez Layoutu)
    return <Outlet />;
  }

  return (
    <div className="layout">
      <nav className="navbar">
        <div className="nav-brand">
          <h2>💅 Beauty Salon</h2>
        </div>

        <div className="nav-links">
          <Link to="/dashboard">Dashboard</Link>
          <Link to="/appointments">Wizyty</Link>

          {/* Manager widzi wszystko */}
          {isManager && (
            <>
              <Link to="/clients">Klienci</Link>
              <Link to="/employees">Pracownicy</Link>
              <Link to="/services">Usługi</Link>
              <Link to="/statistics">Statystyki</Link>
              <Link to="/settings">Ustawienia</Link>
            </>
          )}

          {/* Pracownik */}
          {isEmployee && (
            <>
              <Link to="/clients">Klienci</Link>
              <Link to="/my-schedule">Mój grafik</Link>
            </>
          )}

          {/* Klient */}
          {isClient && (
            <>
              <Link to="/services">Usługi</Link>
              <Link to="/my-appointments">Moje wizyty</Link>
            </>
          )}

          <Link to="/profile">Profil</Link>
        </div>

        <div className="nav-user">
          <span className="user-info">
            {user.email}
            <span className="user-role">({user.role_display})</span>
          </span>
          <button onClick={handleLogout} className="logout-btn">
            Wyloguj
          </button>
        </div>
      </nav>

      <main className="content">
        <Outlet />
      </main>

      <footer className="footer">
        <p>&copy; 2025 Beauty Salon Management System</p>
      </footer>
    </div>
  );
};