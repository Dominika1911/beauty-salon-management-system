// src/components/Layout/Layout.tsx

import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './Layout.css';

export const Layout = () => {
  const { user, logout, isManager, isEmployee, isClient } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // Jeśli nie zalogowany, pokaż tylko content (dla /login)
  if (!user) {
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